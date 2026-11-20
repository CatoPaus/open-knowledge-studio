import * as fs from 'fs';
import * as path from 'path';

import { GEMINI_4_ARGON_MODEL, INTERACTIONS_API_REVISION, INTERACTIONS_API_URL, type InteractionUsageTelemetry, type ThinkingLevel } from '../interactions/index.js';
import { type OKFSource, RESERVED_OKF_FILENAMES, getOkfTrustTier, inspectReferenceExtractionIntegrity, isOkfConceptDocument, isOkfStale, normalizeOkfTags, parseOkfDocument } from '../okf/index.js';

const MAX_HYDRATED_REFERENCES = 6;
const MAX_HYDRATED_REF_CHARS_PER_FILE = 12_000;
const MAX_HYDRATED_REF_TOTAL_CHARS = 36_000;

function truncateReferenceBodyAtBoundary(body: string, maxChars: number): string {
  if (body.length <= maxChars) return body;
  const marker = '\n...[truncated]';
  const sliceBudget = Math.max(0, maxChars - marker.length);
  if (sliceBudget <= 0) return '';
  const window = body.slice(0, sliceBudget);
  const minSnapPos = Math.floor(sliceBudget * 0.5);

  const lastPara = window.lastIndexOf('\n\n');
  const lastLine = window.lastIndexOf('\n');
  let cutIdx = sliceBudget;
  if (lastPara >= minSnapPos) {
    cutIdx = lastPara;
  } else if (lastLine >= minSnapPos) {
    cutIdx = lastLine;
  } else {
    // If sliceBudget landed inside an ATX heading line, still snap back to the preceding newline
    const tailLineStart = lastLine >= 0 ? lastLine + 1 : 0;
    if (/^\s*#{1,6}(?:\s|$)/.test(window.slice(tailLineStart)) && lastLine > 0) {
      cutIdx = lastLine;
    } else {
      const lastSpace = window.lastIndexOf(' ');
      if (lastSpace >= minSnapPos) cutIdx = lastSpace;
    }
  }

  let trimmed = body.slice(0, cutIdx).trimEnd();
  // Drop trailing orphaned ATX heading(s) when preceded by body content
  while (trimmed) {
    const nl = trimmed.lastIndexOf('\n');
    const lastNonEmpty = nl >= 0 ? trimmed.slice(nl + 1) : trimmed;
    if (/^\s*#{1,6}(?:\s|$)/.test(lastNonEmpty) && nl > 0) {
      const beforeHeading = trimmed.slice(0, nl).trimEnd();
      if (beforeHeading.length > 0) {
        trimmed = beforeHeading;
        continue;
      }
    }
    break;
  }
  if (!trimmed) {
    trimmed = window.trimEnd();
  }
  return `${trimmed}${marker}`;
}

// Helper to load ICM Layer 0 (GEMINI.md), Layer 1 (CONTEXT.md), and Layer 3 (_config/voice_guide.md + bundle/index.md + bundle/references/*.md) from disk
export function loadWorkspaceLayers(workspacePath: string, topic?: string) {
  const geminiGuidePath = path.join(workspacePath, 'GEMINI.md');
  const contextGuidePath = path.join(workspacePath, 'CONTEXT.md');
  const toneGuidePath = path.join(workspacePath, '_config/voice_guide.md');
  const bundleRoot = path.join(workspacePath, 'bundle');

  let bundleContext = '';
  if (fs.existsSync(bundleRoot) && fs.statSync(bundleRoot).isDirectory()) {
    const freshSummaries: string[] = [];
    const staleConceptRelPaths: string[] = [];
    const deprecatedConceptRelPaths: string[] = [];
    const referenceCandidates: Array<{
      relCid: string;
      title: string;
      type: string;
      tier: string;
      sources: OKFSource[];
      body: string;
      score: number;
    }> = [];

    const topicTokens = Array.from(
      new Set(
        String(topic || '')
          .toLowerCase()
          .match(/[\p{L}\p{N}][\p{L}\p{N}-]{2,}/gu) || []
      )
    );

    const scanBundleConcepts = (dir: string) => {
      const entries = fs
        .readdirSync(dir, { withFileTypes: true })
        .sort((a, b) => a.name.localeCompare(b.name));
      for (const entry of entries) {
        if (entry.name.startsWith('.')) continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          scanBundleConcepts(full);
        } else if (
          entry.isFile() &&
          entry.name.endsWith('.md') &&
          !RESERVED_OKF_FILENAMES.has(entry.name)
        ) {
          try {
            const doc = parseOkfDocument(fs.readFileSync(full, 'utf-8'));
            if (!isOkfConceptDocument(doc)) continue;
            const relFile = path.relative(bundleRoot, full).replace(/\\/g, '/');
            const relCid = relFile.replace(/\.md$/i, '');
            const status = String(doc.frontmatter.status || 'stable')
              .trim()
              .toLowerCase();
            const isReferenceConcept = relFile.startsWith('references/');
            if (status === 'deprecated') {
              // Omit deprecated pre-synced `references/*.md` files completely so rejected references never re-hydrate
              if (!isReferenceConcept) {
                deprecatedConceptRelPaths.push(`\`${relFile}\``);
              }
            } else if (isOkfStale(doc.frontmatter)) {
              staleConceptRelPaths.push(`\`${relFile}\``);
            } else {
              const rawTier = getOkfTrustTier(doc.frontmatter);
              const refIntegrity = isReferenceConcept
                ? inspectReferenceExtractionIntegrity({
                    relPath: relFile,
                    title: String(doc.frontmatter.title || ''),
                    type: String(doc.frontmatter.type || ''),
                    body: doc.body,
                  })
                : { truncatedMidSentence: false };
              const hasExtractionDefect = Boolean(
                refIntegrity.truncatedMidSentence || refIntegrity.missingTitleTarget
              );
              if (hasExtractionDefect) {
                console.warn(
                  `[Bundle Reference Integrity Warning] ${relFile}: ${refIntegrity.missingTitleTarget ? `missing title target "${refIntegrity.missingTitleTarget}" in body` : `body ends mid-sentence ("…${refIntegrity.tailSnippet || ''}")`} — demoting from ${rawTier} to unverified until fixed.`
                );
              }
              const tier = hasExtractionDefect ? 'unverified' : rawTier;
              // Never inject hand-authored YAML `description` prose on `references/*` under `trust_tier: machine-confirmed`
              // (only `title`, `sources[]`, and verbatim `body` carry primary-registry provenance).
              freshSummaries.push(
                isReferenceConcept
                  ? `- [/${relCid}.md] **${doc.frontmatter.title || relCid}** (${doc.frontmatter.type || 'Reference'}, trust_tier: ${tier})`
                  : `- [/${relCid}.md] **${doc.frontmatter.title || relCid}** (${doc.frontmatter.type || 'Concept'}, trust_tier: ${tier}): ${doc.frontmatter.description || ''}`
              );
              if (isReferenceConcept) {
                const metaHay = `${doc.frontmatter.title || ''} ${normalizeOkfTags(doc.frontmatter.tags).join(' ')} ${relCid}`.toLowerCase();
                const bodyHay = String(doc.body || '').slice(0, 6000).toLowerCase();
                let score = topicTokens.length === 0 ? 1 : 0;
                for (const tok of topicTokens) {
                  const stem = tok.length >= 6 ? tok.slice(0, tok.length - 1) : tok;
                  if (metaHay.includes(tok) || (stem.length >= 5 && metaHay.includes(stem))) {
                    score += 3;
                  } else if (bodyHay.includes(tok) || (stem.length >= 5 && bodyHay.includes(stem))) {
                    score += 1;
                  }
                }
                const refSources: OKFSource[] = Array.isArray(doc.frontmatter.sources)
                  ? [...doc.frontmatter.sources]
                  : [];
                if (
                  refSources.length === 0 &&
                  typeof doc.frontmatter.resource === 'string' &&
                  /^https?:\/\//i.test(doc.frontmatter.resource.trim())
                ) {
                  refSources.push({
                    id: path.posix.basename(relCid),
                    resource: doc.frontmatter.resource.trim(),
                    title: String(doc.frontmatter.title || relCid),
                    ...(typeof doc.frontmatter.mime_type === 'string'
                      ? { mime_type: doc.frontmatter.mime_type }
                      : {}),
                    ...(typeof doc.frontmatter.retrieved_at === 'string'
                      ? { retrieved_at: doc.frontmatter.retrieved_at }
                      : {}),
                    ...(typeof doc.frontmatter.last_modified === 'string'
                      ? { last_modified: doc.frontmatter.last_modified }
                      : {}),
                  });
                }
                referenceCandidates.push({
                  relCid,
                  title: String(doc.frontmatter.title || relCid),
                  type: String(doc.frontmatter.type || 'Reference'),
                  tier,
                  sources: refSources,
                  body: String(doc.body || '').trim(),
                  score,
                });
              }
            }
          } catch {
            // Ignore unreadable concept files
          }
        }
      }
    };

    scanBundleConcepts(bundleRoot);
    if (
      freshSummaries.length > 0 ||
      staleConceptRelPaths.length > 0 ||
      deprecatedConceptRelPaths.length > 0
    ) {
      const lines: string[] = [
        'Progressive Disclosure Index (`workspace/bundle/index.md`) — Fresh Active Concepts (`now < stale_after`):',
        ...freshSummaries.slice(0, 25),
      ];
      if (staleConceptRelPaths.length > 0) {
        lines.push(
          `Skipped stale concepts (${staleConceptRelPaths.length}): ${staleConceptRelPaths.join(', ')}`
        );
      }
      if (deprecatedConceptRelPaths.length > 0) {
        lines.push(
          `Skipped deprecated concepts (${deprecatedConceptRelPaths.length}): ${deprecatedConceptRelPaths.join(', ')}`
        );
      }
      if (referenceCandidates.length > 0) {
        referenceCandidates.sort(
          (a, b) => b.score - a.score || a.relCid.localeCompare(b.relCid)
        );
        const selectedRefs = referenceCandidates
          .filter((r) => r.score > 0 || referenceCandidates.length <= MAX_HYDRATED_REFERENCES)
          .slice(0, MAX_HYDRATED_REFERENCES);
        if (selectedRefs.length > 0) {
          lines.push(
            '',
            'Hydrated Authoritative Reference Records (`workspace/bundle/references/` — cite canonical `sources` URLs & verbatim formal identifiers directly when applicable):'
          );
          const MIN_TRUNCATED_REF_EXCERPT_BUDGET = 64;
          let remainingBudget = MAX_HYDRATED_REF_TOTAL_CHARS;
          for (const ref of selectedRefs) {
            if (remainingBudget <= 0) break;
            const maxExcerpt = Math.min(MAX_HYDRATED_REF_CHARS_PER_FILE, remainingBudget);
            const excerpt = ref.body
              ? maxExcerpt < MIN_TRUNCATED_REF_EXCERPT_BUDGET && ref.body.length > maxExcerpt
                ? ''
                : truncateReferenceBodyAtBoundary(ref.body, maxExcerpt)
              : '';
            if (ref.body && !excerpt.trim()) continue;
            lines.push(`### [/${ref.relCid}.md] ${ref.title} (${ref.type}, trust_tier: ${ref.tier})`);
            if (ref.sources.length > 0) {
              lines.push('Canonical Sources:');
              for (const s of ref.sources) {
                lines.push(
                  `- id: \`${s.id || 'source'}\` | title: "${s.title || s.resource}" | resource: ${s.resource}${s.last_modified ? ` | last_modified: ${s.last_modified}` : ''}`
                );
              }
            }
            if (excerpt) {
              lines.push('Authoritative Content:', excerpt);
              remainingBudget -= excerpt.length;
            }
          }
        }
      }
      bundleContext = lines.join('\n');
    }
  }

  return {
    globalIdentity: fs.existsSync(geminiGuidePath)
      ? fs.readFileSync(geminiGuidePath, 'utf-8')
      : '',
    workspaceContext: fs.existsSync(contextGuidePath)
      ? fs.readFileSync(contextGuidePath, 'utf-8')
      : '',
    toneGuide: fs.existsSync(toneGuidePath)
      ? fs.readFileSync(toneGuidePath, 'utf-8')
      : 'Maintain a professional and clear tone.',
    bundleContext,
  };
}

export function writeStageAssembledInput(
  stageDir: string,
  metadata: {
    stage: string;
    model: string;
    thinkingLevel: ThinkingLevel;
    maxOutputTokens: number;
    useGoogleSearch: boolean;
    outputFormat: string;
  },
  assembledPrompt: string
) {
  const inputFile = path.join(stageDir, 'input/prompt_assembled.md');
  fs.mkdirSync(path.dirname(inputFile), { recursive: true });
  const header = [
    '---',
    `stage: ${metadata.stage}`,
    `model: ${metadata.model}`,
    `thinkingLevel: ${metadata.thinkingLevel}`,
    `maxOutputTokens: ${metadata.maxOutputTokens}`,
    `googleSearch: ${metadata.useGoogleSearch}`,
    `outputFormat: ${metadata.outputFormat}`,
    `assembledAt: ${new Date().toISOString()}`,
    '---',
    '',
  ].join('\n');
  fs.writeFileSync(inputFile, `${header}${assembledPrompt}\n`, 'utf-8');
  return inputFile;
}

export function printDryRunPreview(
  stage: string,
  assembledInputPath: string,
  assembledPrompt: string,
  options: {
    thinkingLevel: ThinkingLevel;
    maxOutputTokens: number;
    includeThoughts: boolean;
    useGoogleSearch: boolean;
    outputFormat: 'text' | 'json';
    outputJsonSchema?: Record<string, any>;
  }
) {
  const approxTokens = Math.ceil(assembledPrompt.length / 4);
  const previewBody: Record<string, any> = {
    model: GEMINI_4_ARGON_MODEL,
    ...(options.useGoogleSearch ? { tools: [{ type: 'google_search' }] } : {}),
    generation_config: {
      max_output_tokens: options.maxOutputTokens,
      thinking_level: options.thinkingLevel.toLowerCase(),
      thinking_summaries: options.includeThoughts ? 'auto' : 'none',
    },
    ...(options.outputFormat === 'json'
      ? {
          response_format: {
            type: 'text',
            mime_type: 'application/json',
            ...(options.outputJsonSchema ? { schema: options.outputJsonSchema } : {}),
          },
        }
      : {}),
    stream: true,
    store: false,
    input: `[1 user_input step (${assembledPrompt.length} chars, ~${approxTokens} tokens) -> ${assembledInputPath}]`,
  };

  console.log(`[DRY-RUN] Stage: ${stage}`);
  console.log(
    `[DRY-RUN] Assembled 5-Layer ICM Input written to: ${assembledInputPath} (${assembledPrompt.length} chars, ~${approxTokens} est. input tokens)`
  );
  console.log(`[DRY-RUN] Would send: POST ${INTERACTIONS_API_URL}`);
  console.log(`[DRY-RUN] Headers:`);
  console.log(`    Content-Type: application/json`);
  console.log(`    Api-Revision: ${INTERACTIONS_API_REVISION}`);
  console.log(`    x-goog-api-key: <REDACTED>`);
  console.log(`[DRY-RUN] Body:\n${JSON.stringify(previewBody, null, 2)}`);
  console.log(`[DRY-RUN] Network call skipped. Zero tokens spent.`);
}

export function writeStageThinkingTrace(
  stageDir: string,
  metadata: {
    stage: string;
    thinkingLevel: ThinkingLevel;
    durationMs: number;
    usage: InteractionUsageTelemetry;
    thoughts: string[];
    searchQueries?: string[];
  }
) {
  const traceFile = path.join(stageDir, 'output/thinking_trace.md');
  fs.mkdirSync(path.dirname(traceFile), { recursive: true });

  const lines: string[] = [
    `# ${metadata.stage} — Gemini 4 Argon Thinking & Telemetry Trace`,
    '',
    `- **Model:** \`${GEMINI_4_ARGON_MODEL}\``,
    `- **Thinking Level:** \`${metadata.thinkingLevel}\``,
    `- **Duration:** ${(metadata.durationMs / 1000).toFixed(1)}s`,
    `- **Input Tokens:** ${metadata.usage.inputTokens}`,
    `- **Thinking Tokens:** ${metadata.usage.thoughtsTokens}`,
    `- **Output Tokens:** ${metadata.usage.outputTokens}`,
    `- **Total Tokens:** ${metadata.usage.totalTokens}`,
    '',
  ];

  if (metadata.searchQueries && metadata.searchQueries.length > 0) {
    lines.push('## Executed Google Search Queries');
    for (const q of metadata.searchQueries) {
      lines.push(`- \`${q}\``);
    }
    lines.push('');
  }

  lines.push(`## Reasoning Steps (${metadata.thoughts.length})`);
  lines.push('');
  if (metadata.thoughts.length === 0) {
    lines.push('_No reasoning summary steps emitted._');
  } else {
    metadata.thoughts.forEach((step, idx) => {
      lines.push(`### Step ${idx + 1}`);
      lines.push(step);
      lines.push('');
    });
  }

  fs.writeFileSync(traceFile, lines.join('\n'), 'utf-8');
}
