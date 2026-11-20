import * as fs from 'fs';
import * as path from 'path';

import {
  DEFAULT_ICM_LOCALE,
  GEMINI_4_ARGON_MODEL,
  type IcmLocalePack,
  type ThinkingLevel,
  executeWithRetryAndFallback,
  getApiKey,
  inferBcp47LanguageCode,
  loadStagePromptContract,
  loadWorkspaceLocale,
  mergeIcmLocalePack,
  normalizeBcp47Tag,
  normalizeThinkingLevel,
  renderPromptTemplate,
  resolveWorkspaceLocalePath,
  saveWorkspaceLocale,
} from '../interactions/index.js';
import { type CurateOkfSourcesOptions, type OKFActorEvent, type OKFDocument, type OKFFrontmatter, type OKFSource, type OkfAdjudicationItem, RESERVED_OKF_FILENAMES, type TrustTier, appendBundleLog, applyIntermissionAdjudications, cleanGroundingLinks, curateOkfSources, getOkfTrustTier, isOkfConceptDocument, isOkfStale, normalizeIsoTimestamp, normalizeOkfActor, normalizeVerified, parseOkfDocument, parseOkfTimestampMs, regenerateBundleIndexes, sanitizeDominantScriptBpeOutliers, serializeOkfDocument, syncRunToBundle } from '../okf/index.js';
import { generateBundleVisualization } from '../viz/index.js';
import { closeActiveA2uiPingPongListener, generateA2uiSurface } from '../a2ui/index.js';
import { loadWorkspaceLayers, printDryRunPreview, writeStageAssembledInput, writeStageThinkingTrace } from './layers.js';

function canonicalLocaleIdentity(tag: string): string {
  const parts = String(tag || '')
    .trim()
    .toLowerCase()
    .replace(/_/g, '-')
    .split('-')
    .filter(Boolean);
  let primary = parts[0] || 'en';
  if (primary === 'no') primary = 'nb';
  if (primary === 'cmn') primary = 'zh';
  if (primary === 'iw') primary = 'he';
  if (primary === 'in') primary = 'id';
  if (primary === 'ji') primary = 'yi';
  const rest = parts.slice(1);
  return rest.length > 0 ? `${primary}-${rest.join('-')}` : primary;
}

const NON_LATIN_PRIMARY_SUBTAGS = new Set([
  'ar', 'fa', 'ur', 'ps', 'he', 'yi', 'ru', 'uk', 'be', 'bg', 'mk', 'kk', 'ky', 'mn', 'tg',
  'el', 'hi', 'mr', 'ne', 'bn', 'pa', 'gu', 'or', 'ta', 'te', 'kn', 'ml', 'si', 'th', 'lo',
  'my', 'km', 'ka', 'hy', 'am', 'ti', 'ja', 'ko', 'zh', 'yue',
]);

function extractCompatibleExplicitBcp47(
  contextText: string | undefined,
  inferredBcp47: string,
  sampleText?: string
): string | undefined {
  if (!contextText) return undefined;
  const inferredPrimary = canonicalLocaleIdentity(inferredBcp47).split('-')[0];
  const sample = String(sampleText || '');
  const totalLetters = (sample.match(/\p{L}/gu) || []).length;
  const latinLetters = (sample.match(/\p{Script=Latin}/gu) || []).length;
  const sampleIsPredominantlyNonLatin = totalLetters >= 20 && latinLetters < totalLetters * 0.35;
  const sampleIsPredominantlyLatin = totalLetters >= 20 && latinLetters >= totalLetters * 0.5;

  // Prefer backticked or quoted BCP-47 tags first (e.g. `` `se-NO` ``, `"cy-GB"`), then bare tags
  const candidates: string[] = [];
  for (const m of contextText.matchAll(
    /[`"']([a-z]{2,3}(?:-[A-Z][a-z]{3})?-(?:[A-Z]{2}|\d{3}))[`"']/g
  )) {
    candidates.push(normalizeBcp47Tag(m[1]));
  }
  for (const m of contextText.matchAll(
    /(?<![A-Za-z0-9-])([a-z]{2,3}(?:-[A-Z][a-z]{3})?-(?:[A-Z]{2}|\d{3}))(?![A-Za-z0-9-])/g
  )) {
    candidates.push(normalizeBcp47Tag(m[1]));
  }

  for (const candidate of candidates) {
    const candId = canonicalLocaleIdentity(candidate);
    const candPrimary = candId.split('-')[0];
    // Ignore default English tags when the generated document is clearly non-English
    if (candPrimary === 'en' && inferredPrimary !== 'en') continue;
    const candExpectsNonLatin =
      NON_LATIN_PRIMARY_SUBTAGS.has(candPrimary) && !/-(?:Latn)(?:-|$)/i.test(candidate);
    if (candExpectsNonLatin && sampleIsPredominantlyLatin) continue;
    if (!candExpectsNonLatin && sampleIsPredominantlyNonLatin) continue;
    return candidate;
  }
  return undefined;
}

function extractJsonObjectText(raw: string): string {
  const trimmed = String(raw || '').trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fenced) return fenced[1].trim();
  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1);
  }
  return trimmed;
}

/**
 * Ensures Layer 3 `<workspaceRoot>/_config/locale.json` exists when the workspace target language
 * is non-English. English runs (`en*`) and workspaces with an existing matching `locale.json`
 * spend zero tokens (`0ms`). On the first non-English live run without a matching `locale.json`,
 * synthesizes and caches a complete UI + TTS prosody locale pack once via `gemini-4-argon` (`LOW`)
 * using unconstrained JSON mode (`mime_type: "application/json"` without a 150+-property grammar
 * constraint that would exceed `/v1beta/interactions` FSM state limits) and validates all keys and
 * `{placeholder}` tokens via `mergeIcmLocalePack()`.
 */
export async function ensureWorkspaceLocaleConfig(
  workspaceRoot: string,
  sampleText: string,
  options?: { forceBcp47?: string; dryRun?: boolean; workspaceIdentityText?: string }
): Promise<{
  locale: IcmLocalePack;
  generatedOnTheFly: boolean;
  localePath?: string;
  tokensUsed: number;
}> {
  const workspacePath = path.resolve(workspaceRoot || './workspace');
  const existing = loadWorkspaceLocale(workspacePath);
  const detectedBcp47 = normalizeBcp47Tag(
    options?.forceBcp47 || inferBcp47LanguageCode(sampleText)
  );
  const detectedId = canonicalLocaleIdentity(detectedBcp47);
  const detectedPrimary = detectedId.split('-')[0];

  if (detectedId === 'en' || detectedId === 'en-us') {
    const pack =
      existing.hasCustomFile && canonicalLocaleIdentity(existing.bcp47).split('-')[0] === 'en'
        ? existing
        : mergeIcmLocalePack(null);
    return { locale: pack, generatedOnTheFly: false, tokensUsed: 0 };
  }

  if (existing.hasCustomFile) {
    const existingId = canonicalLocaleIdentity(existing.bcp47);
    const matchesExact = existingId === detectedId;
    const matchesPrimaryWithoutExplicitOverride =
      !options?.forceBcp47 && existingId.split('-')[0] === detectedPrimary;
    if (matchesExact || matchesPrimaryWithoutExplicitOverride) {
      return {
        locale: existing,
        generatedOnTheFly: false,
        localePath: resolveWorkspaceLocalePath(workspacePath),
        tokensUsed: 0,
      };
    }
  }

  if (options?.dryRun || !process.env.GEMINI_API_KEY) {
    return {
      locale: mergeIcmLocalePack({ bcp47: detectedBcp47 }),
      generatedOnTheFly: false,
      tokensUsed: 0,
    };
  }

  try {
    console.log(
      `[Stage 1 Locale Synthesis]: Generating Layer 3 locale pack for ${detectedBcp47} -> _config/locale.json...`
    );
    const rawIdentityText =
      typeof options?.workspaceIdentityText === 'string'
        ? options.workspaceIdentityText
        : [
            fs.existsSync(path.join(workspacePath, 'GEMINI.md'))
              ? fs.readFileSync(path.join(workspacePath, 'GEMINI.md'), 'utf-8')
              : '',
            fs.existsSync(path.join(workspacePath, 'CONTEXT.md'))
              ? fs.readFileSync(path.join(workspacePath, 'CONTEXT.md'), 'utf-8')
              : '',
          ]
            .filter(Boolean)
            .join('\n\n');
    const identityExcerpt = rawIdentityText.trim().slice(0, 4_000);
    const promptText = [
      `Translate the following ICM / OKF v0.3 / A2UI v1.0 Studio UI & TTS Prosody Locale Pack from English into natural, idiomatic ${detectedBcp47}.`,
      'Return ONLY a single valid JSON object with top-level keys ("bcp47", "languageName", "visualContext", "ui", "prosody") and exact nested property keys.',
      'STRICT RULES:',
      `1. Set "bcp47" to "${detectedBcp47}" and "languageName" to the English name of the exact language/standard corresponding to "${detectedBcp47}".`,
      '2. Preserve EVERY {placeholder} token verbatim (such as {count}, {id}, {title}, {label}, {parent}, {value}, {options}, {basis}, {question}, {n}, {completed}, {total}, {pct}, {level}, {steps}, {queries}, {input}, {thoughts}, {output}, {sec}, {version}, {desc}, {voices}, {lang}, {correct}, {answered}, {visible}, {cli}, {list}, {resolved}, {deferred}, and [^{id}]).',
      '3. Preserve leading emoji / symbol cues (such as ←, 🚀, 📚, 🔎, 🕸️, 📋, ✅, 🎓, 📊, ⚖️, 🧪, ⬇, 🔊, ⏹, 🎙️, ⚠️, ✓, ↺, ⚡, 🛡️, 🚫, 🔀, ➕, 👁, ✏️, 💻) and Markdown formatting (**bold**, *italic*, `code`) where present.',
      '4. Keep CLI flags (--replace-source, --reject-source, --add-source, --resolve, --defer, --note, cli:verify, research_summary.md, a2ui.html, Stage 1, Stage 2, OKF v0.3, A2UI) intact inside agy* templates.',
      '5. DOMAIN SENSE DISAMBIGUATION: "Intermission" in UI banners ("intermissionBannerStage1", "intermissionBannerFull") means a human-in-the-loop review checkpoint / pause between pipeline stages (Stage 1 -> Stage 2) — translate it using the target-language term for a review checkpoint, stage pause, or intermission (NEVER mistranslate "Intermission" as a historical era such as the Middle Ages).',
      '6. In "prosody", provide natural spoken words in the target language for numbers ("cardinals" as a JSON object mapping "0" through "20", plus "30", "40", "50", "60", "70", "80", "90", and "100", to invariant spoken citation numerals used after §), "cardinalTensJoiner" (string: "" for direct concatenation, "-" for hyphenated tens-units, or " <conjunction> " when a spoken conjunction joins tens and units), "cardinalUnitBeforeTen" (boolean: true when units are spoken before tens like "one-and-twenty", otherwise false), units, sections (§ / §§), "or", currency magnitudes, and 5–10 common target-language prose abbreviations in "abbreviations" (as a JSON object mapping shortForm -> spokenExpansion, e.g. target-language equivalents of "e.g.", "i.e.", "etc.").',
      `7. In "prosody.voicePersonas" ("warmGuideFemale", "warmGuideMale", "calmSpecialistMale", "calmSpecialistFemale"), write each 1-sentence studio Voice Design persona description 100% IN THE TARGET LANGUAGE (${detectedBcp47}). If the Workspace Identity / Regional Context below names a specific sub-national region, province, island, valley, or municipality, adopt that authentic local regional spoken variety/dialect of ${detectedBcp47}; otherwise use the standard broadcast dialect of ${detectedBcp47}. Write using ONLY the native script and vocabulary of ${detectedBcp47} — NEVER mix foreign Unicode scripts (such as Cyrillic homoglyphs inside Latin words) and NEVER include BCP-47 tags or parenthetical English glosses/translations inside non-English voicePersonas strings — with clear, steady studio delivery and zero hesitation fillers.`,
      `8. Set top-level "visualContext" to 1 concise English art-direction sentence describing the authentic everyday geographic landscape, seasonal natural light, vernacular architecture and outdoor structures, and practical contemporary everyday/working attire (with subtle everyday regional textile or craft accents where culturally natural) typical of the named sub-national locality in the Workspace Identity / Regional Context (or the broader ${detectedBcp47} speech community when no specific locality is named) — explicitly avoiding ceremonial, festive, or folkloric costume stereotypes during ordinary work and specifying zero embedded text or signage.`,
      ...(identityExcerpt
        ? [
            '',
            'WORKSPACE IDENTITY / REGIONAL CONTEXT (Layer 0 / Layer 1):',
            identityExcerpt,
          ]
        : []),
      '',
      'REFERENCE ENGLISH PACK:',
      JSON.stringify(DEFAULT_ICM_LOCALE, null, 2),
    ].join('\n');

    const { result } = await executeWithRetryAndFallback(
      {
        promptText,
        thinkingLevel: 'LOW',
        maxOutputTokens: 16384,
        includeThoughts: false,
        useGoogleSearch: false,
        outputFormat: 'json',
      },
      1,
      'LOW'
    );

    const parsed = JSON.parse(extractJsonObjectText(result.text)) as Record<string, any>;
    const merged = mergeIcmLocalePack({
      ...parsed,
      bcp47: detectedBcp47,
    });
    const savedPath = saveWorkspaceLocale(workspacePath, merged);
    console.log(
      `[Stage 1 Locale Synthesis]: Saved Layer 3 locale pack (${merged.bcp47} — ${merged.languageName}) -> ${savedPath} (${result.usage.totalTokens} tokens)`
    );
    return {
      locale: merged,
      generatedOnTheFly: true,
      localePath: savedPath,
      tokensUsed: result.usage.totalTokens,
    };
  } catch (err: any) {
    console.warn(
      `[Stage 1 Locale Synthesis Warning]: Falling back to built-in English UI labels (${err?.message || String(err)})`
    );
    return {
      locale: mergeIcmLocalePack({ bcp47: detectedBcp47 }),
      generatedOnTheFly: false,
      tokensUsed: 0,
    };
  }
}

// 1. Standalone Stage 1 Research Runner (Stops at the Human-in-the-Loop Intermission Gate)
export async function runStage1Flow(input: {
  workspaceRoot: string;
  runId: string;
  topic: string;
  thinkingLevel?: ThinkingLevel | string;
  dryRun?: boolean;
}): Promise<{
  success: boolean;
  runId: string;
  outputPath: string;
  bundleConceptId?: string;
  dryRun?: boolean;
}> {
  const workspacePath = path.resolve(input.workspaceRoot);
  const runDir = path.join(workspacePath, 'runs', input.runId);
  const { globalIdentity, workspaceContext, bundleContext } = loadWorkspaceLayers(
    workspacePath,
    input.topic
  );

  const contract = loadStagePromptContract('01_research');
  const stage1ThinkingLevel = normalizeThinkingLevel(input.thinkingLevel, contract.thinkingLevel);
  const stage1FallbackThinkingLevel: ThinkingLevel =
    stage1ThinkingLevel === 'HIGH' ? 'MEDIUM' : 'LOW';

  console.log(
    `--- Executing Stage 1: Research [model: ${GEMINI_4_ARGON_MODEL}, thinkingLevel: ${stage1ThinkingLevel}${input.dryRun ? ', DRY-RUN' : ''}] ---`
  );

  const stage1Dir = path.join(runDir, 'stages/01_research');
  const researchFileTarget = path.join(stage1Dir, 'output/research_summary.md');
  const researchStreamTarget = path.join(stage1Dir, 'output/research_stream.md');
  if (!input.dryRun) {
    getApiKey();
  }
  fs.mkdirSync(path.dirname(researchFileTarget), { recursive: true });

  // Assemble Layer 0 + Layer 1 + Layer 2 + Layer 3 (OKF Bundle Index) prompt and persist to stages/01_research/input/prompt_assembled.md
  const assembledPrompt = renderPromptTemplate(contract.template, {
    topic: input.topic,
    globalIdentity,
    workspaceContext,
    bundleContext,
  });

  const assembledInputPath = writeStageAssembledInput(
    stage1Dir,
    {
      stage: '01_research',
      model: GEMINI_4_ARGON_MODEL,
      thinkingLevel: stage1ThinkingLevel,
      maxOutputTokens: contract.maxOutputTokens,
      useGoogleSearch: contract.useGoogleSearch,
      outputFormat: contract.outputFormat,
    },
    assembledPrompt
  );

  if (input.dryRun) {
    const metaPath = path.join(runDir, 'meta.json');
    try {
      const meta: Record<string, any> = fs.existsSync(metaPath)
        ? JSON.parse(fs.readFileSync(metaPath, 'utf-8'))
        : {
            runId: input.runId,
            topic: input.topic,
            model: GEMINI_4_ARGON_MODEL,
            researchThinkingLevel: stage1ThinkingLevel,
            createdAt: new Date().toISOString(),
          };
      meta.status = 'stage1_dry_run';
      meta.dryRun = true;
      fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2), 'utf-8');
    } catch {
      // Ignore metadata update errors
    }
    printDryRunPreview('01_research', assembledInputPath, assembledPrompt, {
      thinkingLevel: stage1ThinkingLevel,
      maxOutputTokens: contract.maxOutputTokens,
      includeThoughts: contract.includeThoughts,
      useGoogleSearch: contract.useGoogleSearch,
      outputFormat: contract.outputFormat === 'json' ? 'json' : 'text',
    });
    return {
      success: true,
      runId: input.runId,
      outputPath: assembledInputPath,
      dryRun: true,
    };
  }

  const startTimeMs = Date.now();
  let latestStreamedText = '';

  const updateLiveStreamFile = (allThoughts: string[], bodyText: string) => {
    const latestThought =
      allThoughts.length > 0
        ? `> **Gemini 4 Argon Thinking (${allThoughts.length} steps):**\n> ${allThoughts[allThoughts.length - 1].replace(/\n/g, '\n> ')}\n\n---\n\n`
        : `> **Gemini 4 Argon is researching and verifying sources via Google Search...**\n\n---\n\n`;
    const liveBody = bodyText || '_Synthesizing findings from grounded search results..._';
    try {
      fs.writeFileSync(researchStreamTarget, `${latestThought}${liveBody}`, 'utf-8');
    } catch {
      // Ignore transient file write errors during live stream preview
    }
  };

  const { result: stage1Response, usedThinkingLevel } = await executeWithRetryAndFallback(
    {
      promptText: assembledPrompt,
      thinkingLevel: stage1ThinkingLevel,
      maxOutputTokens: contract.maxOutputTokens,
      includeThoughts: contract.includeThoughts,
      useGoogleSearch: contract.useGoogleSearch,
      outputFormat: contract.outputFormat === 'json' ? 'json' : 'text',
      onThought: (thoughtStep, allThoughts) => {
        const previewSnippet = thoughtStep.replace(/\s+/g, ' ').slice(0, 120);
        console.log(`[Stage 1 Thought]: ${previewSnippet}...`);
        updateLiveStreamFile(allThoughts, latestStreamedText);
      },
      onSearchQuery: (queries) => {
        console.log(`[Stage 1 Google Search]: ${queries.join(' | ')}`);
      },
      onTextDelta: (_delta, accumulatedText) => {
        latestStreamedText = accumulatedText;
      },
    },
    1,
    stage1FallbackThinkingLevel
  );

  if (!stage1Response.text || stage1Response.text.trim() === '') {
    throw new Error(
      'Research summary output was empty. This is typically caused by safety/privacy filters blocking search queries about private individuals, or Google Grounding returning no results.'
    );
  }

  const cleanedText = await cleanGroundingLinks(stage1Response.text, stage1Response.steps, {
    topic: input.topic,
    model: GEMINI_4_ARGON_MODEL,
    workspaceRoot: workspacePath,
  });
  fs.writeFileSync(researchFileTarget, cleanedText, 'utf-8');
  if (fs.existsSync(researchStreamTarget)) {
    try {
      fs.unlinkSync(researchStreamTarget);
    } catch {
      // Ignore cleanup errors
    }
  }

  const stage1Doc = parseOkfDocument(cleanedText);
  const stage1SampleText = `${stage1Doc.frontmatter.title || input.topic}\n${stage1Doc.body}`;
  const inferredStage1Bcp47 = inferBcp47LanguageCode(stage1SampleText);
  const explicitLayerBcp47 = extractCompatibleExplicitBcp47(
    `${globalIdentity || ''}\n${workspaceContext || ''}\n${contract.template || ''}`,
    inferredStage1Bcp47,
    stage1SampleText
  );
  const localeRes = await ensureWorkspaceLocaleConfig(workspacePath, stage1SampleText, {
    ...(explicitLayerBcp47 ? { forceBcp47: explicitLayerBcp47 } : {}),
    workspaceIdentityText: [globalIdentity, workspaceContext].filter(Boolean).join('\n\n'),
  });
  const syncedBundle = syncRunToBundle(workspacePath, input.runId);

  const durationMs = Date.now() - startTimeMs;
  const usage = stage1Response.usage;

  // Persist Gemini 4 Argon's reasoning chain & search queries to stages/01_research/output/thinking_trace.md
  writeStageThinkingTrace(stage1Dir, {
    stage: '01_research',
    thinkingLevel: usedThinkingLevel,
    durationMs,
    usage,
    thoughts: stage1Response.thoughts,
    searchQueries: stage1Response.searchQueries,
  });

  console.log(
    `[Stage 1 Telemetry]: input=${usage.inputTokens}, thoughts=${usage.thoughtsTokens}, output=${usage.outputTokens}, total=${usage.totalTokens} tokens (${(durationMs / 1000).toFixed(1)}s)`
  );
  console.log(`Stage 1 complete. Output written to: ${researchFileTarget}`);
  if (syncedBundle) {
    console.log(
      `[OKF Bundle Sync]: Synced concept '${syncedBundle.conceptId}' -> ${syncedBundle.bundleFilePath}`
    );
  }

  const metaPath = path.join(runDir, 'meta.json');
  try {
    const meta: Record<string, any> = fs.existsSync(metaPath)
      ? JSON.parse(fs.readFileSync(metaPath, 'utf-8'))
      : {
          runId: input.runId,
          topic: input.topic,
          model: GEMINI_4_ARGON_MODEL,
          researchThinkingLevel: usedThinkingLevel,
          createdAt: new Date().toISOString(),
          status: 'stage1_completed',
        };
    if (
      !meta.status ||
      meta.status === 'running' ||
      meta.status === 'stage1_running' ||
      meta.status === 'stage1_dry_run'
    ) {
      meta.status = 'stage1_completed';
    }
    const trustTier = getOkfTrustTier(stage1Doc.frontmatter);
    const stale = isOkfStale(stage1Doc.frontmatter);
    const sourcesCount = Array.isArray(stage1Doc.frontmatter.sources)
      ? stage1Doc.frontmatter.sources.length
      : 0;
    meta.stage1Telemetry = {
      thinkingLevel: usedThinkingLevel,
      thoughtSteps: stage1Response.thoughts.length,
      searchQueries: stage1Response.searchQueries,
      inputTokens: usage.inputTokens,
      thoughtsTokens: usage.thoughtsTokens,
      outputTokens: usage.outputTokens,
      totalTokens: usage.totalTokens,
      durationMs,
      trust_tier: trustTier,
      is_stale: stale,
      sourcesCount,
      ...(localeRes.tokensUsed > 0
        ? {
            localeSynthesisTokens: localeRes.tokensUsed,
            localeBcp47: localeRes.locale.bcp47,
          }
        : {}),
    };
    meta.okf = {
      type: stage1Doc.frontmatter.type || 'Research Concept',
      title: stage1Doc.frontmatter.title || input.topic,
      status: stage1Doc.frontmatter.status || 'draft',
      trust_tier: trustTier,
      is_stale: stale,
      stale_after: stage1Doc.frontmatter.stale_after,
      generated: stage1Doc.frontmatter.generated,
      verified: normalizeVerified(stage1Doc.frontmatter),
      sourcesCount,
      bundleConceptId: syncedBundle?.conceptId,
    };
    fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2), 'utf-8');
  } catch {
    // Ignore metadata update errors
  }

  try {
    const bundleDir = path.join(workspacePath, 'bundle');
    if (fs.existsSync(bundleDir)) {
      const vizRes = generateBundleVisualization(bundleDir);
      console.log(`[OKF Graph Viz]: ${vizRes.outputPath}`);
    }
    const a2uiRes = generateA2uiSurface(input.runId, { workspaceRoot: workspacePath });
    console.log(
      `[Stage 1 Intermission A2UI Review]: ${a2uiRes.htmlOutputPath}${a2uiRes.bundleHtmlPath ? ` (bundle mirror: ${a2uiRes.bundleHtmlPath})` : ''}`
    );
  } catch (err: any) {
    console.warn(`[Stage 1 A2UI Review Warning]: ${err?.message || String(err)}`);
  }

  return {
    success: true,
    runId: input.runId,
    outputPath: researchFileTarget,
    bundleConceptId: syncedBundle?.conceptId,
  };
}

function normalizeVerifierActor(actor?: string): string {
  return normalizeOkfActor(actor, 'human');
}

export interface VerifyOkfOptions {
  workspaceRoot?: string;
  artifactDir?: string;
  by?: string;
  at?: string;
  rejectSourceIds?: string[];
  replaceSourceMap?: Record<string, string>;
  addSources?: CurateOkfSourcesOptions['addSources'];
  resolveMap?: Record<string, string>;
  deferIds?: string[];
  noteMap?: Record<string, string>;
}

/**
 * Stamps OKF v0.3 `verified: [{ by, at }]` onto a Stage 1 `research_summary.md` (by `<runId>`)
 * or a bundle concept `.md` file, optionally curating sources (`rejectSourceIds`, `replaceSourceMap`, `addSources`)
 * and adjudicating Intermission conflicts/gaps (`resolveMap`, `deferIds`, `noteMap`),
 * updates `meta.json`, syncs to `workspace/bundle/`, and refreshes `viz.html` & `a2ui.html`.
 * Per OKF v0.3 (`SPEC.md` §§5.2–5.4 & §7), `human:<id>` sign-off sets `trust_tier: human-reviewed` and
 * transitions `status: stable` (`meta.status: stage1_verified`), whereas non-`human:` actors
 * (`icm-co-architect/gemini-4-argon`, `team:<id>`, `process:<id>`) record `trust_tier: machine-confirmed`
 * while preserving `status: draft` on Stage-1 drafts (`meta.status: stage1_completed`).
 */
export function verifyOkfConcept(
  runIdOrPath: string,
  options?: VerifyOkfOptions
): {
  filePath: string;
  runId?: string;
  bundleConceptId?: string;
  status: string;
  trust_tier: TrustTier;
  is_stale: boolean;
  verified: OKFActorEvent[];
  rejectedIds: string[];
  replacedMap: Record<string, string>;
  addedSources: OKFSource[];
  orphanClaimLines: string[];
  adjudications?: OkfAdjudicationItem[];
  vizOutputPath?: string;
  a2uiOutputPath?: string;
  artifactHtmlPath?: string;
  artifactVizPath?: string;
} {
  const workspacePath = path.resolve(options?.workspaceRoot || './workspace');
  const actor = normalizeVerifierActor(options?.by);

  const candidateRunDir = path.join(workspacePath, 'runs', runIdOrPath);
  const candidateRunResearch = path.join(
    candidateRunDir,
    'stages/01_research/output/research_summary.md'
  );

  let targetFilePath = '';
  let detectedRunId: string | undefined;

  if (fs.existsSync(candidateRunResearch)) {
    targetFilePath = candidateRunResearch;
    detectedRunId = runIdOrPath;
  } else if (fs.existsSync(path.resolve(runIdOrPath))) {
    targetFilePath = path.resolve(runIdOrPath);
  } else {
    const runsRoot = path.join(workspacePath, 'runs');
    if (fs.existsSync(runsRoot)) {
      const matchingRun = fs
        .readdirSync(runsRoot, { withFileTypes: true })
        .filter((d) => d.isDirectory() && d.name !== '_dry_run')
        .map((d) => d.name)
        .find((name) => name.endsWith(`-${runIdOrPath}`) || name.includes(runIdOrPath));
      if (matchingRun) {
        const matchedResearch = path.join(
          runsRoot,
          matchingRun,
          'stages/01_research/output/research_summary.md'
        );
        if (fs.existsSync(matchedResearch)) {
          targetFilePath = matchedResearch;
          detectedRunId = matchingRun;
        }
      }
    }
    if (!targetFilePath) {
      const bundleCandidate = path.join(
        workspacePath,
        'bundle',
        runIdOrPath.endsWith('.md') ? runIdOrPath : `${runIdOrPath}.md`
      );
      if (fs.existsSync(bundleCandidate)) {
        targetFilePath = bundleCandidate;
      } else {
        throw new Error(
          `Could not find Stage 1 research artifact or OKF concept for "${runIdOrPath}".`
        );
      }
    }
  }

  let raw = fs.readFileSync(targetFilePath, 'utf-8');
  const initialGeneratedMs = parseOkfTimestampMs(parseOkfDocument(raw).frontmatter?.generated?.at);
  let resolvedAtIso = options?.at
    ? normalizeIsoTimestamp(options.at)
    : new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
  if (!options?.at && initialGeneratedMs !== undefined) {
    const candidateMs = parseOkfTimestampMs(resolvedAtIso);
    if (candidateMs !== undefined && candidateMs < initialGeneratedMs) {
      resolvedAtIso = new Date(initialGeneratedMs).toISOString();
    }
  }

  const effectiveReplaceMap: Record<string, string> = {
    ...(options?.replaceSourceMap || {}),
  };
  const hasResolveEntries =
    Boolean(options?.resolveMap) && Object.keys(options?.resolveMap || {}).length > 0;
  const hasDeferEntries = Boolean(options?.deferIds && options.deferIds.length > 0);
  const hasNoteEntries =
    Boolean(options?.noteMap) && Object.keys(options?.noteMap || {}).length > 0;
  let adjudicatedItems: OkfAdjudicationItem[] | undefined;

  if (hasResolveEntries || hasDeferEntries || hasNoteEntries) {
    const adjRes = applyIntermissionAdjudications(raw, {
      resolveMap: options?.resolveMap,
      deferIds: options?.deferIds,
      noteMap: options?.noteMap,
      actor,
      nowIso: resolvedAtIso,
    });
    raw = adjRes.markdown;
    adjudicatedItems = adjRes.items;
    for (const [oldId, newTarget] of Object.entries(adjRes.autoReplaceSources || {})) {
      const cleanOld = String(oldId || '')
        .trim()
        .replace(/^\[\^/, '')
        .replace(/\]$/, '')
        .trim();
      const cleanTarget = String(newTarget || '').trim();
      if (
        cleanOld &&
        cleanTarget &&
        !Object.prototype.hasOwnProperty.call(effectiveReplaceMap, cleanOld)
      ) {
        effectiveReplaceMap[cleanOld] = cleanTarget;
      }
    }
  }

  let rejectedIds: string[] = [];
  let replacedMap: Record<string, string> = {};
  let addedSources: OKFSource[] = [];
  let orphanClaimLines: string[] = [];
  const hasReplaceMap = Object.keys(effectiveReplaceMap).length > 0;

  if (
    (options?.rejectSourceIds && options.rejectSourceIds.length > 0) ||
    hasReplaceMap ||
    (options?.addSources && options.addSources.length > 0)
  ) {
    const curated = curateOkfSources(raw, {
      rejectSourceIds: options?.rejectSourceIds,
      replaceSourceMap: effectiveReplaceMap,
      addSources: options?.addSources,
    });
    raw = curated.markdown;
    rejectedIds = curated.rejectedIds;
    replacedMap = curated.replacedMap;
    addedSources = curated.addedSources;
    orphanClaimLines = curated.orphanClaimLines;
    if (options?.rejectSourceIds && options.rejectSourceIds.length > 0) {
      for (const reqId of options.rejectSourceIds) {
        const cleanId = String(reqId || '')
          .trim()
          .replace(/^\[\^/, '')
          .replace(/\]$/, '')
          .trim();
        if (cleanId && !rejectedIds.includes(cleanId)) {
          rejectedIds.push(cleanId);
        }
      }
    }
  }

  const doc = parseOkfDocument(raw);
  if (
    adjudicatedItems &&
    adjudicatedItems.length > 0 &&
    !Array.isArray(doc.frontmatter['x-adjudications'])
  ) {
    doc.frontmatter['x-adjudications'] = adjudicatedItems;
  }
  if (!doc.frontmatter.type) {
    doc.frontmatter.type = 'Research Concept';
  }
  if (
    typeof doc.frontmatter.stale_after === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(doc.frontmatter.stale_after.trim())
  ) {
    doc.frontmatter.stale_after = `${doc.frontmatter.stale_after.trim()}T00:00:00Z`;
  }
  if (
    doc.frontmatter.generated &&
    typeof doc.frontmatter.generated === 'object' &&
    typeof doc.frontmatter.generated.at === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(doc.frontmatter.generated.at.trim())
  ) {
    doc.frontmatter.generated = {
      ...doc.frontmatter.generated,
      at: `${doc.frontmatter.generated.at.trim()}T00:00:00Z`,
    };
  }

  const workspaceDefaultActor = normalizeOkfActor(
    loadWorkspaceLocale(workspacePath).ui.defaultVerifierActor,
    'human'
  );
  const defaultPlaceholders = new Set(['human:reviewer', workspaceDefaultActor]);
  const generatedMs = parseOkfTimestampMs(doc.frontmatter?.generated?.at);
  if (!options?.at && generatedMs !== undefined) {
    const candidateMs = parseOkfTimestampMs(resolvedAtIso);
    if (candidateMs !== undefined && candidateMs < generatedMs) {
      resolvedAtIso = new Date(generatedMs).toISOString();
    }
  }
  let existingVerified = normalizeVerified(doc.frontmatter);
  if (!defaultPlaceholders.has(actor)) {
    existingVerified = existingVerified.filter((v) => !defaultPlaceholders.has(v.by));
  }
  const existingActorIdx = existingVerified.findIndex((v) => v.by === actor);
  if (existingActorIdx >= 0) {
    existingVerified[existingActorIdx] = { by: actor, at: resolvedAtIso };
  } else {
    existingVerified.push({ by: actor, at: resolvedAtIso });
  }
  doc.frontmatter.verified = existingVerified;
  const trustTier = getOkfTrustTier(doc.frontmatter);
  if (trustTier === 'human-reviewed') {
    doc.frontmatter.status = 'stable';
  } else if (!doc.frontmatter.status) {
    doc.frontmatter.status = 'draft';
  }

  const serialized = serializeOkfDocument(doc);
  fs.writeFileSync(targetFilePath, serialized, 'utf-8');

  // Auto-deprecate any pre-synced `bundle/references/*.md` concept whose `sources[]` are all rejected
  const allRejectedSourceIds = new Set<string>();
  const recordRejectedSourceId = (rawId: unknown) => {
    const clean = String(rawId || '')
      .trim()
      .replace(/^\[\^/, '')
      .replace(/\]$/, '')
      .trim();
    if (clean) allRejectedSourceIds.add(clean);
  };
  for (const reqId of options?.rejectSourceIds || []) recordRejectedSourceId(reqId);
  for (const rejId of rejectedIds) recordRejectedSourceId(rejId);
  for (const [oldKey, newTarget] of Object.entries({ ...effectiveReplaceMap, ...replacedMap })) {
    const cleanOld = String(oldKey || '')
      .trim()
      .replace(/^\[\^/, '')
      .replace(/\]$/, '')
      .trim();
    const cleanNew = String(newTarget || '')
      .trim()
      .replace(/^\[\^/, '')
      .replace(/\]$/, '')
      .trim();
    if (cleanOld && cleanOld !== cleanNew) {
      allRejectedSourceIds.add(cleanOld);
    }
  }
  for (const adjItem of Array.isArray(doc.frontmatter['x-adjudications'])
    ? doc.frontmatter['x-adjudications']
    : []) {
    if (adjItem?.status === 'resolved' && typeof adjItem.selected === 'string') {
      const m = adjItem.selected.trim().match(/^replace:([^=\s]+)=(.+)$/i);
      if (m) {
        const cleanOld = m[1].trim().replace(/^\[\^/, '').replace(/\]$/, '').trim();
        const cleanNew = m[2].trim().replace(/^\[\^/, '').replace(/\]$/, '').trim();
        if (cleanOld && cleanOld !== cleanNew) {
          allRejectedSourceIds.add(cleanOld);
        }
      }
    }
  }

  const deprecatedReferenceRelIds: string[] = [];
  if (allRejectedSourceIds.size > 0) {
    const bundleRefsDir = path.join(workspacePath, 'bundle', 'references');
    if (fs.existsSync(bundleRefsDir) && fs.statSync(bundleRefsDir).isDirectory()) {
      const resolvedTarget = path.resolve(targetFilePath);
      const scanReferencesForDeprecation = (dir: string) => {
        const entries = fs
          .readdirSync(dir, { withFileTypes: true })
          .sort((a, b) => a.name.localeCompare(b.name));
        for (const entry of entries) {
          if (entry.name.startsWith('.')) continue;
          const refFull = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            scanReferencesForDeprecation(refFull);
          } else if (
            entry.isFile() &&
            entry.name.endsWith('.md') &&
            !RESERVED_OKF_FILENAMES.has(entry.name) &&
            path.resolve(refFull) !== resolvedTarget
          ) {
            try {
              const refDoc = parseOkfDocument(fs.readFileSync(refFull, 'utf-8'));
              if (!isOkfConceptDocument(refDoc)) continue;
              const refType = String(refDoc.frontmatter.type || 'Reference')
                .trim()
                .toLowerCase();
              const refStatus = String(refDoc.frontmatter.status || 'stable')
                .trim()
                .toLowerCase();
              const refSources = Array.isArray(refDoc.frontmatter.sources)
                ? refDoc.frontmatter.sources
                : [];
              if (
                refType === 'reference' &&
                refStatus !== 'deprecated' &&
                refSources.length > 0 &&
                refSources.every((s) => {
                  const sid = String(s?.id || '')
                    .trim()
                    .replace(/^\[\^/, '')
                    .replace(/\]$/, '')
                    .trim();
                  return Boolean(sid) && allRejectedSourceIds.has(sid);
                })
              ) {
                refDoc.frontmatter.status = 'deprecated';
                fs.writeFileSync(refFull, serializeOkfDocument(refDoc), 'utf-8');
                const relCid = path
                  .relative(path.join(workspacePath, 'bundle'), refFull)
                  .replace(/\\/g, '/')
                  .replace(/\.md$/i, '');
                deprecatedReferenceRelIds.push(relCid);
              }
            } catch {
              // Ignore unreadable reference files
            }
          }
        }
      };
      scanReferencesForDeprecation(bundleRefsDir);
    }
  }
  if (deprecatedReferenceRelIds.length > 0) {
    const bundleDir = path.join(workspacePath, 'bundle');
    if (fs.existsSync(bundleDir)) {
      regenerateBundleIndexes(bundleDir);
    }
  }

  const stale = isOkfStale(doc.frontmatter);
  let bundleConceptId: string | undefined;
  let vizOutputPath: string | undefined;
  let a2uiOutputPath: string | undefined;
  let artifactHtmlPath: string | undefined;
  let artifactVizPath: string | undefined;

  if (detectedRunId) {
    const synced = syncRunToBundle(workspacePath, detectedRunId, {
      actionOverride: trustTier === 'human-reviewed' ? 'Verification' : 'Update',
      allowDestructiveOverwrite: true,
    });
    bundleConceptId = synced?.conceptId;

    const resolvedRunDir = path.join(workspacePath, 'runs', detectedRunId);
    const metaPath = path.join(resolvedRunDir, 'meta.json');
    try {
      const meta: Record<string, any> = fs.existsSync(metaPath)
        ? JSON.parse(fs.readFileSync(metaPath, 'utf-8'))
        : {
            runId: detectedRunId,
            topic: doc.frontmatter.title || detectedRunId,
            model: GEMINI_4_ARGON_MODEL,
            createdAt: new Date().toISOString(),
            status: trustTier === 'human-reviewed' ? 'stage1_verified' : 'stage1_completed',
          };
      const sourcesCount = Array.isArray(doc.frontmatter.sources)
        ? doc.frontmatter.sources.length
        : 0;
      if (
        trustTier === 'human-reviewed' &&
        (!meta.status ||
          meta.status === 'running' ||
          meta.status === 'stage1_running' ||
          meta.status === 'stage1_completed')
      ) {
        meta.status = 'stage1_verified';
      } else if (
        trustTier !== 'human-reviewed' &&
        (!meta.status || meta.status === 'running' || meta.status === 'stage1_running')
      ) {
        meta.status = 'stage1_completed';
      }
      meta.okf = {
        ...(meta.okf || {}),
        type: doc.frontmatter.type,
        title: doc.frontmatter.title,
        status: doc.frontmatter.status,
        trust_tier: trustTier,
        is_stale: stale,
        stale_after: doc.frontmatter.stale_after,
        generated: doc.frontmatter.generated,
        verified: existingVerified,
        sourcesCount,
        bundleConceptId: bundleConceptId || meta.okf?.bundleConceptId,
      };
      if (meta.stage1Telemetry) {
        meta.stage1Telemetry.trust_tier = trustTier;
        meta.stage1Telemetry.is_stale = stale;
        meta.stage1Telemetry.sourcesCount = sourcesCount;
      }
      fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2), 'utf-8');
    } catch {
      // Ignore meta update errors
    }

    try {
      const a2uiRes = generateA2uiSurface(detectedRunId, {
        workspaceRoot: workspacePath,
        artifactDir: options?.artifactDir,
      });
      a2uiOutputPath = a2uiRes.htmlOutputPath;
      vizOutputPath = a2uiRes.bundleVizPath;
      artifactHtmlPath = a2uiRes.artifactHtmlPath;
      artifactVizPath = a2uiRes.artifactVizPath;
      if (!vizOutputPath) {
        const bundleDir = path.join(workspacePath, 'bundle');
        if (fs.existsSync(bundleDir)) {
          vizOutputPath = generateBundleVisualization(bundleDir).outputPath;
        }
      }
    } catch {
      // Ignore visualization/A2UI refresh errors during verification
    }
  } else {
    const bundleRoot = path.join(workspacePath, 'bundle');
    if (targetFilePath.startsWith(bundleRoot)) {
      const relCid = path
        .relative(bundleRoot, targetFilePath)
        .replace(/\\/g, '/')
        .replace(/\.md$/i, '');
      bundleConceptId = relCid;
      regenerateBundleIndexes(bundleRoot);
      appendBundleLog(
        bundleRoot,
        trustTier === 'human-reviewed' ? 'Verification' : 'Update',
        relCid,
        String(doc.frontmatter.title || relCid),
        `verified by ${actor}, status: ${doc.frontmatter.status}, trust_tier: ${trustTier}`
      );
      try {
        vizOutputPath = generateBundleVisualization(bundleRoot).outputPath;
      } catch {
        // Ignore visualization errors
      }
    }
  }

  const replacedSummary = Object.entries(replacedMap)
    .map(([k, v]) => `${k}->${v}`)
    .join(', ');
  console.log(
    `[OKF Verification Gate]: ${trustTier === 'human-reviewed' ? 'Verified' : 'Curated'} ${targetFilePath} (by: ${actor}, status: ${doc.frontmatter.status}, trust_tier: ${trustTier}, is_stale: ${stale}${rejectedIds.length > 0 ? `, rejected: [${rejectedIds.join(', ')}]` : ''}${replacedSummary ? `, replaced: [${replacedSummary}]` : ''}${addedSources.length > 0 ? `, added: [${addedSources.map((s) => s.id).join(', ')}]` : ''})`
  );
  if (orphanClaimLines.length > 0) {
    console.warn(
      `[OKF Source Curation Notice]: ${orphanClaimLines.length} claim line(s) were backed solely by rejected source(s): ${JSON.stringify(orphanClaimLines)}`
    );
  }

  return {
    filePath: targetFilePath,
    runId: detectedRunId,
    bundleConceptId,
    status: String(doc.frontmatter.status),
    trust_tier: trustTier,
    is_stale: stale,
    verified: existingVerified,
    rejectedIds,
    replacedMap,
    addedSources,
    orphanClaimLines,
    ...(Array.isArray(doc.frontmatter['x-adjudications'])
      ? { adjudications: doc.frontmatter['x-adjudications'] }
      : {}),
    ...(vizOutputPath ? { vizOutputPath } : {}),
    ...(a2uiOutputPath ? { a2uiOutputPath } : {}),
    ...(artifactHtmlPath ? { artifactHtmlPath } : {}),
    ...(artifactVizPath ? { artifactVizPath } : {}),
  };
}

const STAGE2_CITATION_EXEMPT_KEYS = new Set([
  'title',
  'subtitle',
  'targetaudience',
  'category',
  'moduletitle',
  'legalbasis',
  'visualprompt',
  'overviewvisualprompt',
  'imageprompt',
  'illustrationprompt',
  'scenefocus',
  'spokenscript',
  'spokennarration',
  'spokenactionitem',
  'actionitemspoken',
  'options',
  'quizoptions',
  'question',
  'quizquestion',
]);

/**
 * Strips raw URLs (`https://...`), Markdown links (`[label](url)` and internal `[label](/concept.md)`),
 * `verified-source:...` tokens, and unverified OKF footnote tags (`[^id]`) from script text.
 * When `allowedSourceIds` is supplied (for Stage 2 visual/read-along JSON prose), preserves verified
 * `[^id]` tags present in `allowedSourceIds` (and upgrades `[label](verified-source:<id>)` or matching
 * verified URLs to `[^id]`), while stripping all unknown `[^id]` tags and raw URLs.
 */
export function sanitizeSpokenScript(
  text: string,
  allowedSourceIds?: ReadonlySet<string>,
  urlToSourceId?: ReadonlyMap<string, string>
): string {
  if (!text) return '';
  const hasAllowed = Boolean(allowedSourceIds && allowedSourceIds.size > 0);
  const resolveUrlCitation = (rawUrl: string): string => {
    if (!hasAllowed || !urlToSourceId) return '';
    const cleaned = rawUrl.replace(/[.,;:!?)]+$/, '').trim();
    const matched = urlToSourceId.get(cleaned);
    return matched && allowedSourceIds!.has(matched) ? `[^${matched}]` : '';
  };

  let out = sanitizeDominantScriptBpeOutliers(text)
    .replace(
      /\s*\(\s*(?<!\!)\[([^\]]+)\]\((?:(https?:\/\/[^\s)]+)|verified-source:([A-Za-z0-9_\-]+))\)\s*\)/g,
      (_m, _lbl: string, httpUrl?: string, vsId?: string) => {
        if (hasAllowed && vsId && allowedSourceIds!.has(vsId)) return `[^${vsId}]`;
        if (httpUrl) return resolveUrlCitation(httpUrl);
        return '';
      }
    )
    .replace(
      /(?<!\!)\[([^\]]+)\]\((?:(https?:\/\/[^\s)]+)|verified-source:([A-Za-z0-9_\-]+)|(?:\/|\.\.?\/|[^)\s]+\.md)[^\s)]*)\)/g,
      (_m, lbl: string, httpUrl?: string, vsId?: string) => {
        if (hasAllowed && vsId && allowedSourceIds!.has(vsId)) return `${lbl}[^${vsId}]`;
        if (httpUrl) return `${lbl}${resolveUrlCitation(httpUrl)}`;
        return lbl;
      }
    )
    .replace(/\[\^[A-Za-z0-9_\-]+\]:\s*.*$/gm, '')
    .replace(/\s*\(\s*((?:\[\^[A-Za-z0-9_\-]+\][\s,;]*)+)\)/g, (_m, group: string) => {
      if (!hasAllowed) return '';
      const kept = Array.from(group.matchAll(/\[\^([A-Za-z0-9_\-]+)\]/g))
        .map((m) => m[1])
        .filter((id) => allowedSourceIds!.has(id))
        .map((id) => `[^${id}]`)
        .join('');
      return kept;
    })
    .replace(/\[\^([A-Za-z0-9_\-]+)\]/g, (_m, id: string) =>
      hasAllowed && allowedSourceIds!.has(id) ? `[^${id}]` : ''
    )
    .replace(/\s*\(\s*(https?:\/\/[^\s)]+|verified-source:[A-Za-z0-9_\-]+)\s*\)/g, (_m, tok: string) => {
      if (hasAllowed && tok.startsWith('verified-source:')) {
        const id = tok.slice('verified-source:'.length);
        return allowedSourceIds!.has(id) ? `[^${id}]` : '';
      }
      if (tok.startsWith('http')) return resolveUrlCitation(tok);
      return '';
    })
    .replace(/(?:https?:\/\/|verified-source:)\S+/g, '')
    .replace(/\s*\(\s*[,;:\s]*\)/g, '')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/[ \t]+([.,;!?])/g, '$1');

  if (hasAllowed) {
    // Deduplicate adjacent identical `[^a][^a]` markers and snap trailing sentence punctuation after `[^id]`
    out = out
      .replace(/(\[\^[A-Za-z0-9_\-]+\])(?:\s*\1)+/g, '$1')
      .replace(/[ \t]+(\[\^[A-Za-z0-9_\-]+\])/g, '$1');
  }

  return out.replace(/\n{3,}/g, '\n\n').trim();
}

/**
 * Recursively applies `sanitizeSpokenScript()` across all string values in a parsed Stage 2 JSON
 * payload. When `allowedSourceIds` is provided, keeps verified Stage 1 `[^id]` citations on prose
 * and explanation fields while keeping titles, Stage 3 visual prompts, quiz options, and explicit
 * `spoken*` fields completely citation-free.
 */
export function sanitizeSpokenJson<T>(
  value: T,
  allowedSourceIds?: ReadonlySet<string>,
  urlToSourceId?: ReadonlyMap<string, string>,
  currentKey?: string
): T {
  const keyLower = (currentKey || '').toLowerCase();
  const effectiveIds =
    keyLower && STAGE2_CITATION_EXEMPT_KEYS.has(keyLower) ? undefined : allowedSourceIds;
  const effectiveUrlMap = effectiveIds ? urlToSourceId : undefined;

  if (typeof value === 'string') {
    return sanitizeSpokenScript(value, effectiveIds, effectiveUrlMap) as unknown as T;
  }
  if (Array.isArray(value)) {
    return value.map((item) =>
      sanitizeSpokenJson(item, effectiveIds, effectiveUrlMap, currentKey)
    ) as unknown as T;
  }
  if (value && typeof value === 'object') {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = sanitizeSpokenJson(v, effectiveIds, effectiveUrlMap, k);
    }
    return out as T;
  }
  return value;
}

function formatResearchForStage2Prompt(doc: OKFDocument, rawText: string): string {
  if (!doc.frontmatter || Object.keys(doc.frontmatter).length === 0) {
    return rawText;
  }
  const sanitizedFm: OKFFrontmatter = {
    ...doc.frontmatter,
  };
  if (Array.isArray(sanitizedFm.sources)) {
    sanitizedFm.sources = sanitizedFm.sources.map((s) => ({
      id: s.id,
      resource: s.title ? `verified-source:${s.id || 'ref'}` : s.resource,
      title: s.title || s.id || 'Verified Source',
      ...(s.retrieved_at ? { retrieved_at: s.retrieved_at } : {}),
      ...(s.last_modified ? { last_modified: s.last_modified } : {}),
      ...(s.author ? { author: s.author } : {}),
      ...(s.usage_count !== undefined ? { usage_count: s.usage_count } : {}),
      ...(s.usage_window ? { usage_window: s.usage_window } : {}),
    }));
  }
  return serializeOkfDocument({
    frontmatter: sanitizedFm,
    body: doc.body,
  });
}

export function buildStage2AdjudicationsPreamble(doc: OKFDocument): string {
  const rawItems = doc.frontmatter?.['x-adjudications'];
  if (!Array.isArray(rawItems) || rawItems.length === 0) return '';
  const lines: string[] = [];
  for (const item of rawItems) {
    if (!item || typeof item !== 'object') continue;
    const title = String(item.title || item.id || '').trim();
    if (!title) continue;
    const note = typeof item.note === 'string' ? item.note.trim() : '';
    if (item.status === 'resolved') {
      const selected = String(item.selected ?? note ?? '').trim();
      const noteSuffix =
        note && note !== selected && !/^replace:/i.test(note) ? ` (${note})` : '';
      const replaceMatch = selected.match(/^replace:([^=\s]+)=(.+)$/i);
      if (replaceMatch) {
        const oldId = replaceMatch[1]
          .trim()
          .replace(/^\[\^/, '')
          .replace(/\]$/, '')
          .trim();
        const rawNew = replaceMatch[2].trim();
        const idPref = rawNew.match(/^id=([A-Za-z0-9_\-]+)\|/i);
        const newId = idPref
          ? idPref[1].trim()
          : rawNew.replace(/^\[\^/, '').replace(/\]$/, '').trim();
        lines.push(
          `- [RESOLVED] ${title}: Cite verified source [^${newId}] in place of rejected source [^${oldId}]${noteSuffix}; do not cite or rely on rejected source [^${oldId}].`
        );
      } else {
        lines.push(
          `- [RESOLVED] ${title}: Use "${selected}"${noteSuffix} as the verified authoritative value; do not hedge with rejected alternatives.`
        );
      }
    } else if (item.status === 'check-later') {
      lines.push(
        `- [CHECK LATER] ${title}${note ? ` (${note})` : ''}: Treat as unconfirmed locally; do not state unverified figures as settled fact, and include a concrete local verification item in checklistGroups.`
      );
    }
  }
  if (lines.length === 0) return '';
  return ['VERIFIED INTERMISSION ADJUDICATIONS:', ...lines, ''].join('\n');
}

// 2. Standalone Stage 2 Scriptwriting Runner (Reads Verified Stage 1 Artifact from Disk)
export async function runStage2Flow(input: {
  workspaceRoot: string;
  runId: string;
  thinkingLevel?: ThinkingLevel | string;
  dryRun?: boolean;
}): Promise<{
  success: boolean;
  outputPath: string;
  trust_tier: TrustTier;
  is_stale: boolean;
  dryRun?: boolean;
}> {
  const workspacePath = path.resolve(input.workspaceRoot);
  const runDir = path.join(workspacePath, 'runs', input.runId);
  const researchFileTarget = path.join(runDir, 'stages/01_research/output/research_summary.md');
  const stage2Dir = path.join(runDir, 'stages/02_script');
  const scriptOutputTarget = path.join(stage2Dir, 'output/script_draft.json');

  const contract = loadStagePromptContract('02_script');
  const stage2ThinkingLevel = normalizeThinkingLevel(input.thinkingLevel, contract.thinkingLevel);
  const { globalIdentity, workspaceContext, toneGuide } = loadWorkspaceLayers(workspacePath);

  if (!fs.existsSync(researchFileTarget)) {
    throw new Error(`Research summary not found for run ${input.runId}`);
  }

  if (!input.dryRun) {
    getApiKey();
    await closeActiveA2uiPingPongListener({
      reason: 'stage2',
      workspaceRoot: workspacePath,
      runId: input.runId,
    });
  }

  fs.mkdirSync(path.dirname(scriptOutputTarget), { recursive: true });

  const startTimeMs = Date.now();
  const activeResearchData = fs.readFileSync(researchFileTarget, 'utf-8');
  const researchDoc = parseOkfDocument(activeResearchData);
  const trustTier = getOkfTrustTier(researchDoc.frontmatter);
  const stale = isOkfStale(researchDoc.frontmatter);
  const docStatus = String(researchDoc.frontmatter.status || 'stable');
  const sourcesCount = Array.isArray(researchDoc.frontmatter.sources)
    ? researchDoc.frontmatter.sources.length
    : 0;

  console.log(
    `--- Executing Stage 2: Scriptwriting for Run: ${input.runId} [model: ${GEMINI_4_ARGON_MODEL}, thinkingLevel: ${stage2ThinkingLevel}${input.dryRun ? ', DRY-RUN' : ''}] ---`
  );
  console.log(
    `[Stage 2 OKF Gate]: status=${docStatus}, trust_tier=${trustTier}, is_stale=${stale}, sources=${sourcesCount}`
  );
  if (stale) {
    console.warn(
      `[Stage 2 OKF Warning]: Source concept is STALE (stale_after: ${researchDoc.frontmatter.stale_after}). Consider refreshing Stage 1.`
    );
  } else if (trustTier === 'unverified') {
    console.log(
      `[Stage 2 OKF Advisory]: Consuming unverified Stage 1 artifact (run 'npm run cli:verify -- ${input.runId}' to stamp human-reviewed sign-off).`
    );
  }

  const stage2BaseResearch = formatResearchForStage2Prompt(researchDoc, activeResearchData);
  const adjudicationsPreamble = buildStage2AdjudicationsPreamble(researchDoc);
  const stage2ResearchInput = adjudicationsPreamble
    ? `${adjudicationsPreamble}\n${stage2BaseResearch}`
    : stage2BaseResearch;

  // Assemble Layer 0 + Layer 1 + Layer 2 + Layer 3 + Layer 4 prompt and persist to stages/02_script/input/prompt_assembled.md
  const assembledPrompt = renderPromptTemplate(contract.template, {
    researchFile: stage2ResearchInput,
    toneRules: toneGuide,
    globalIdentity,
    workspaceContext,
  });

  const assembledInputPath = writeStageAssembledInput(
    stage2Dir,
    {
      stage: '02_script',
      model: GEMINI_4_ARGON_MODEL,
      thinkingLevel: stage2ThinkingLevel,
      maxOutputTokens: contract.maxOutputTokens,
      useGoogleSearch: contract.useGoogleSearch,
      outputFormat: contract.outputFormat,
    },
    assembledPrompt
  );

  const updateMetaWithStage2Okf = (telemetryExtra?: Record<string, any>) => {
    const metaPath = path.join(runDir, 'meta.json');
    try {
      const meta: Record<string, any> = fs.existsSync(metaPath)
        ? JSON.parse(fs.readFileSync(metaPath, 'utf-8'))
        : {
            runId: input.runId,
            topic: researchDoc.frontmatter.title || input.runId,
            model: GEMINI_4_ARGON_MODEL,
            scriptThinkingLevel: stage2ThinkingLevel,
            createdAt: new Date().toISOString(),
            status: input.dryRun ? 'stage2_dry_run' : 'completed',
          };
      if (
        !input.dryRun &&
        telemetryExtra &&
        (!meta.status ||
          meta.status === 'running' ||
          meta.status === 'stage1_completed' ||
          meta.status === 'stage1_verified' ||
          meta.status === 'stage2_running' ||
          meta.status === 'stage2_dry_run')
      ) {
        meta.status = 'completed';
      }
      meta.okf = {
        ...(meta.okf || {}),
        type: researchDoc.frontmatter.type || 'Research Concept',
        title: researchDoc.frontmatter.title || meta.topic,
        status: docStatus,
        trust_tier: trustTier,
        is_stale: stale,
        stale_after: researchDoc.frontmatter.stale_after,
        generated: researchDoc.frontmatter.generated,
        verified: normalizeVerified(researchDoc.frontmatter),
        sourcesCount,
      };
      meta.stage2Telemetry = {
        ...(meta.stage2Telemetry || {}),
        trust_tier: trustTier,
        is_stale: stale,
        sourceStatus: docStatus,
        sourcesCount,
        ...(telemetryExtra || {}),
      };
      fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2), 'utf-8');
    } catch {
      // Ignore metadata update errors
    }
  };

  if (input.dryRun) {
    updateMetaWithStage2Okf();
    printDryRunPreview('02_script', assembledInputPath, assembledPrompt, {
      thinkingLevel: stage2ThinkingLevel,
      maxOutputTokens: contract.maxOutputTokens,
      includeThoughts: contract.includeThoughts,
      useGoogleSearch: contract.useGoogleSearch,
      outputFormat: contract.outputFormat === 'json' ? 'json' : 'text',
      outputJsonSchema: contract.outputJsonSchema,
    });
    return {
      success: true,
      outputPath: assembledInputPath,
      trust_tier: trustTier,
      is_stale: stale,
      dryRun: true,
    };
  }

  const { result: stage2Response, usedThinkingLevel } = await executeWithRetryAndFallback(
    {
      promptText: assembledPrompt,
      thinkingLevel: stage2ThinkingLevel,
      maxOutputTokens: contract.maxOutputTokens,
      includeThoughts: contract.includeThoughts,
      useGoogleSearch: contract.useGoogleSearch,
      outputFormat: contract.outputFormat === 'json' ? 'json' : 'text',
      outputJsonSchema: contract.outputJsonSchema,
      onThought: (thoughtStep) => {
        const previewSnippet = thoughtStep.replace(/\s+/g, ' ').slice(0, 120);
        console.log(`[Stage 2 Thought]: ${previewSnippet}...`);
      },
    },
    2
  );

  if (contract.outputFormat === 'json') {
    const verifiedSourceIds = new Set<string>();
    const urlToSourceId = new Map<string, string>();
    for (const s of researchDoc.frontmatter.sources || []) {
      const sid = String(s?.id || '').trim();
      if (!sid) continue;
      verifiedSourceIds.add(sid);
      const sUrl = String(s?.resource || '').trim();
      if (sUrl && !urlToSourceId.has(sUrl)) {
        urlToSourceId.set(sUrl, sid);
      }
    }
    const parsedJson = sanitizeSpokenJson(
      JSON.parse(stage2Response.text),
      verifiedSourceIds,
      urlToSourceId
    );
    fs.writeFileSync(scriptOutputTarget, JSON.stringify(parsedJson, null, 2), 'utf-8');
  } else {
    fs.writeFileSync(scriptOutputTarget, sanitizeSpokenScript(stage2Response.text), 'utf-8');
  }

  const durationMs = Date.now() - startTimeMs;
  const usage = stage2Response.usage;

  // Persist Gemini 4 Argon's Stage 2 reasoning chain to stages/02_script/output/thinking_trace.md
  writeStageThinkingTrace(stage2Dir, {
    stage: '02_script',
    thinkingLevel: usedThinkingLevel,
    durationMs,
    usage,
    thoughts: stage2Response.thoughts,
  });

  console.log(
    `[Stage 2 Telemetry]: input=${usage.inputTokens}, thoughts=${usage.thoughtsTokens}, output=${usage.outputTokens}, total=${usage.totalTokens} tokens (${(durationMs / 1000).toFixed(1)}s)`
  );
  console.log(`Stage 2 complete. Output written to: ${scriptOutputTarget}`);

  updateMetaWithStage2Okf({
    thinkingLevel: usedThinkingLevel,
    thoughtSteps: stage2Response.thoughts.length,
    inputTokens: usage.inputTokens,
    thoughtsTokens: usage.thoughtsTokens,
    outputTokens: usage.outputTokens,
    totalTokens: usage.totalTokens,
    durationMs,
  });

  try {
    const a2uiRes = generateA2uiSurface(input.runId, { workspaceRoot: workspacePath });
    console.log(
      `[Stage 2 A2UI Studio]: ${a2uiRes.htmlOutputPath}${a2uiRes.bundleHtmlPath ? ` (bundle mirror: ${a2uiRes.bundleHtmlPath})` : ''}`
    );
  } catch (err: any) {
    console.warn(`[Stage 2 A2UI Warning]: ${err?.message || String(err)}`);
  }

  return {
    success: true,
    outputPath: scriptOutputTarget,
    trust_tier: trustTier,
    is_stale: stale,
  };
}
