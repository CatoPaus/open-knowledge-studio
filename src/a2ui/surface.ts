import * as fs from 'fs';
import * as path from 'path';

import { GEMINI_4_ARGON_MODEL, type IcmLocalePack, detectMediaMimeAndExtension, formatLocaleTemplate, loadWorkspaceLocale, wrapPcm16InWavHeader } from '../interactions/index.js';
import { type OKFDocument, type OKFSource, type OkfAdjudicationItem, decodeHtmlEntities, enrichBareDomainSourceTitle, extractIntermissionAdjudications, getOkfTrustTier, healOrphanOkfFootnotes, inferSourceMimeTypeFromUrl, injectBidirectionalBundleLinks, isOkfStale, normalizeCanonicalSourceUrl, normalizeHttpMimeType, normalizeOkfTags, normalizeVerified, parseOkfDocument, regenerateBundleIndexes, serializeOkfDocument, shouldUpgradeSourceTitle, transliterateNordicAscii, truncateSlugAtWordBoundary } from '../okf/index.js';
import { detectIcmDomainMode, detectIcmLanguage, extractConceptLinks, extractLastUrlPathSlug, generateBundleVisualization, getOkfTypeColor, walkBundleConcepts } from '../viz/index.js';
import { A2UI_BASIC_CATALOG_ID, A2UI_ICM_CATALOG_ID, A2UI_MIME_TYPE, A2UI_PROTOCOL_VERSION, type A2uiBundleRunEntry, type A2uiComponent, type A2uiEnvelopeMessage, type A2uiSurfaceGenerationOptions, type A2uiSurfaceGenerationResult } from './types.js';
import { A2UI_PING_PONG_DEFAULT_PORT, hasAntigravityBrowserCapability, openFileInSystemBrowser, readActivePingPongState, syncA2uiToArtifactDir } from './browser-bridge.js';
import { A2UI_ICM_CATALOG_SCHEMA, escapeA2uiHtml } from './catalog-schema.js';
import { extractChecklistGroupsFromMarkdown, normalizeStage2ForA2ui } from './normalize.js';
import { validateA2uiSurfaceMessages } from './schema.js';
import { A2UI_STUDIO_CSS, A2UI_STUDIO_JS } from './client-assets.js';

export const DEFAULT_MAX_ARTIFACT_AUDIO_BYTES = 128 * 1024 * 1024;

/**
 * Generates an A2UI v1.0 Declarative Surface (`a2ui_surface.json` + `a2ui_surface.jsonl`)
 * and a zero-dependency Bi-Directional A2UI Studio HTML renderer (`a2ui.html`) for any ICM run.
 */
export function generateA2uiSurface(
  runIdOrOptions?: string | A2uiSurfaceGenerationOptions,
  maybeOptions?: A2uiSurfaceGenerationOptions
): A2uiSurfaceGenerationResult {
  const options: A2uiSurfaceGenerationOptions =
    typeof runIdOrOptions === 'string'
      ? { ...maybeOptions, runId: runIdOrOptions }
      : { ...runIdOrOptions, ...maybeOptions };

  const workspaceRoot = path.resolve(options.workspaceRoot || './workspace');
  const bundleRoot = path.resolve(options.bundleRoot || path.join(workspaceRoot, 'bundle'));
  const runsRoot = path.join(workspaceRoot, 'runs');

  if (fs.existsSync(bundleRoot)) {
    injectBidirectionalBundleLinks(bundleRoot, undefined, workspaceRoot);
  }

  // Resolve target run directory
  let resolvedRunDir = '';
  let resolvedRunId = options.runId || '';

  const isValidRunDir = (dirPath: string): boolean =>
    fs.existsSync(path.join(dirPath, 'meta.json')) ||
    fs.existsSync(path.join(dirPath, 'stages', '01_research', 'output', 'research_summary.md')) ||
    fs.existsSync(path.join(dirPath, 'stages', '02_script', 'output', 'script_draft.json'));

  const isCompleteRunDir = (dirPath: string): boolean =>
    fs.existsSync(path.join(dirPath, 'stages', '01_research', 'output', 'research_summary.md')) &&
    fs.existsSync(path.join(dirPath, 'stages', '02_script', 'output', 'script_draft.json'));

  if (resolvedRunId && fs.existsSync(resolvedRunId) && fs.statSync(resolvedRunId).isDirectory()) {
    resolvedRunDir = path.resolve(resolvedRunId);
    resolvedRunId = path.basename(resolvedRunDir);
  } else if (
    resolvedRunId &&
    fs.existsSync(path.join(runsRoot, resolvedRunId)) &&
    fs.statSync(path.join(runsRoot, resolvedRunId)).isDirectory() &&
    isValidRunDir(path.join(runsRoot, resolvedRunId))
  ) {
    resolvedRunDir = path.join(runsRoot, resolvedRunId);
  } else if (fs.existsSync(runsRoot)) {
    const allDirs = fs
      .readdirSync(runsRoot, { withFileTypes: true })
      .filter((d) => d.isDirectory() && d.name !== '_dry_run')
      .map((d) => {
        const fullPath = path.join(runsRoot, d.name);
        return {
          name: d.name,
          fullPath,
          complete: isCompleteRunDir(fullPath),
          valid: isValidRunDir(fullPath),
          mtime: fs.statSync(fullPath).mtimeMs,
        };
      });
    const completeCandidates = allDirs.filter((d) => d.complete).sort((a, b) => b.mtime - a.mtime);
    const validCandidates = allDirs.filter((d) => d.valid).sort((a, b) => b.mtime - a.mtime);
    const candidates =
      completeCandidates.length > 0
        ? completeCandidates
        : validCandidates.length > 0
          ? validCandidates
          : allDirs.sort((a, b) => b.mtime - a.mtime);
    if (candidates.length > 0) {
      resolvedRunId = candidates[0].name;
      resolvedRunDir = candidates[0].fullPath;
    } else if (resolvedRunId) {
      resolvedRunDir = path.join(runsRoot, resolvedRunId);
    }
  } else if (resolvedRunId) {
    resolvedRunDir = path.join(runsRoot, resolvedRunId);
  }

  // Load Run Metadata, Stage 1 OKF v0.3 Artifact, and Stage 2 JSON Artifact
  let meta: Record<string, any> = {};
  if (resolvedRunDir && fs.existsSync(path.join(resolvedRunDir, 'meta.json'))) {
    try {
      meta = JSON.parse(fs.readFileSync(path.join(resolvedRunDir, 'meta.json'), 'utf-8'));
    } catch {
      meta = {};
    }
  }

  let rawOkfMarkdown = '';
  const stage1OutputPath = resolvedRunDir
    ? path.join(resolvedRunDir, 'stages', '01_research', 'output', 'research_summary.md')
    : '';
  if (stage1OutputPath && fs.existsSync(stage1OutputPath)) {
    rawOkfMarkdown = fs.readFileSync(stage1OutputPath, 'utf-8');
  } else if (fs.existsSync(bundleRoot)) {
    const bundleConcepts = walkBundleConcepts(bundleRoot);
    if (bundleConcepts.length > 0) {
      const firstPath = path.join(bundleRoot, `${bundleConcepts[0].id}.md`);
      if (fs.existsSync(firstPath)) {
        rawOkfMarkdown = fs.readFileSync(firstPath, 'utf-8');
      }
    }
  }

  const okfDoc = rawOkfMarkdown
    ? parseOkfDocument(rawOkfMarkdown)
    : { frontmatter: { title: resolvedRunId || 'ICM Studio', status: 'draft' }, body: '' };
  const okfDocHealed = healOrphanOkfFootnotes(okfDoc);
  const okfTrustTier = getOkfTrustTier(okfDoc.frontmatter);
  const okfStale = isOkfStale(okfDoc.frontmatter);
  const enrichSourceMimeForSurface = (src: OKFSource): OKFSource => {
    if (!src || typeof src !== 'object') return src;
    const rawUrl = String((src as any).resource || (src as any).url || '').trim();
    const mime =
      normalizeHttpMimeType(src.mime_type) ||
      (rawUrl ? inferSourceMimeTypeFromUrl(rawUrl) || (/^https?:\/\//i.test(rawUrl) ? 'text/html' : undefined) : undefined);
    if (!mime || src.mime_type === mime) return src;
    return { ...src, mime_type: mime };
  };
  const okfSources = (Array.isArray(okfDoc.frontmatter.sources) ? okfDoc.frontmatter.sources : []).map(
    enrichSourceMimeForSurface
  );
  const buildAdjudicationDecisionsMap = (
    items: OkfAdjudicationItem[]
  ): Record<string, { status: string; selected: string; note: string }> => {
    const decisions: Record<string, { status: string; selected: string; note: string }> = {};
    for (const item of items) {
      if (!item || !item.id) continue;
      if (item.status !== 'open' || item.note) {
        decisions[item.id] = {
          status: item.status,
          selected: item.selected || '',
          note: item.note || '',
        };
      }
    }
    return decisions;
  };
  const okfAdjudications = extractIntermissionAdjudications(okfDoc);
  const okfAdjudicationDecisions = buildAdjudicationDecisionsMap(okfAdjudications);
  if (okfDocHealed && stage1OutputPath && fs.existsSync(stage1OutputPath)) {
    fs.writeFileSync(stage1OutputPath, serializeOkfDocument(okfDoc), 'utf-8');
  }
  if (fs.existsSync(bundleRoot) && stage1OutputPath && fs.existsSync(stage1OutputPath)) {
    const rawTitleSlug = transliterateNordicAscii(String(okfDoc.frontmatter.title || resolvedRunId))
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/-\d{10,}$/, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    const canonicalTitleSlug = truncateSlugAtWordBoundary(rawTitleSlug, 48, 12, true) || 'research-concept';
    const existingCid = String(meta?.okf?.bundleConceptId || '').trim();
    const existingSlug = existingCid.startsWith('research/')
      ? existingCid.slice('research/'.length)
      : '';
    let migratedSlug = false;
    if (existingSlug && rawTitleSlug.startsWith(existingSlug) && existingSlug !== canonicalTitleSlug) {
      const oldBundleFile = path.join(bundleRoot, 'research', `${existingSlug}.md`);
      const newBundleFile = path.join(bundleRoot, 'research', `${canonicalTitleSlug}.md`);
      if (fs.existsSync(oldBundleFile)) {
        if (!fs.existsSync(newBundleFile)) {
          fs.renameSync(oldBundleFile, newBundleFile);
        } else {
          fs.unlinkSync(oldBundleFile);
        }
        migratedSlug = true;
      }
      if (meta?.okf) {
        meta.okf.bundleConceptId = `research/${canonicalTitleSlug}`;
        const metaPath = path.join(resolvedRunDir, 'meta.json');
        if (fs.existsSync(metaPath)) {
          fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2), 'utf-8');
        }
      }
      const logPath = path.join(bundleRoot, 'log.md');
      if (fs.existsSync(logPath)) {
        const logTxt = fs.readFileSync(logPath, 'utf-8');
        const updatedLog = logTxt.replaceAll(
          `/research/${existingSlug}.md`,
          `/research/${canonicalTitleSlug}.md`
        );
        if (updatedLog !== logTxt) {
          fs.writeFileSync(logPath, updatedLog, 'utf-8');
        }
      }
    }
    const targetSlug =
      existingSlug && (!rawTitleSlug.startsWith(existingSlug) || existingSlug === canonicalTitleSlug)
        ? existingSlug
        : canonicalTitleSlug;
    const targetBundleFile = path.join(bundleRoot, 'research', `${targetSlug}.md`);
    if ((okfDocHealed || migratedSlug) && fs.existsSync(targetBundleFile)) {
      fs.writeFileSync(targetBundleFile, serializeOkfDocument(okfDoc), 'utf-8');
      regenerateBundleIndexes(bundleRoot);
    } else if (migratedSlug) {
      regenerateBundleIndexes(bundleRoot);
    }
  }

  let rawStage2: Record<string, unknown> | null = null;
  const stage2OutputPath = resolvedRunDir
    ? path.join(resolvedRunDir, 'stages', '02_script', 'output', 'script_draft.json')
    : '';
  if (stage2OutputPath && fs.existsSync(stage2OutputPath)) {
    try {
      rawStage2 = JSON.parse(fs.readFileSync(stage2OutputPath, 'utf-8'));
    } catch {
      rawStage2 = null;
    }
  }
  const isStage1Only = !(stage2OutputPath && fs.existsSync(stage2OutputPath) && rawStage2);

  const extractStage1Trace = (runDir: string, runMeta: Record<string, any>) => {
    const tel = (
      runMeta && typeof runMeta.stage1Telemetry === 'object' && runMeta.stage1Telemetry
        ? runMeta.stage1Telemetry
        : {}
    ) as Record<string, any>;
    const tracePath = runDir
      ? path.join(runDir, 'stages', '01_research', 'output', 'thinking_trace.md')
      : '';
    const thinkingTraceMarkdown =
      tracePath && fs.existsSync(tracePath) ? fs.readFileSync(tracePath, 'utf-8') : '';
    const rawQueries: string[] = Array.isArray(tel.searchQueries)
      ? tel.searchQueries.map((q: unknown) => String(q || '').trim()).filter(Boolean)
      : [];
    if (rawQueries.length === 0 && thinkingTraceMarkdown) {
      const sqSectionMatch = thinkingTraceMarkdown.match(
        /##\s+Executed Google Search Queries[\s\S]*?(?=\n##\s+|\s*$)/i
      );
      if (sqSectionMatch) {
        for (const line of sqSectionMatch[0].split(/\r?\n/)) {
          const m = line.match(/^\s*(?:[-*+]|\d+\.)\s+`?([^`\r\n]+?)`?\s*$/);
          if (m && m[1] && !/^\*?No search queries/i.test(m[1].trim())) {
            rawQueries.push(m[1].trim());
          }
        }
      }
    }
    return {
      thinkingLevel: String(tel.thinkingLevel || 'HIGH'),
      thoughtSteps: Number(tel.thoughtSteps || 0),
      searchQueries: rawQueries,
      inputTokens: Number(tel.inputTokens || 0),
      thoughtsTokens: Number(tel.thoughtsTokens || 0),
      outputTokens: Number(tel.outputTokens || 0),
      totalTokens: Number(tel.totalTokens || 0),
      durationMs: Number(tel.durationMs || 0),
      thinkingTraceMarkdown,
    };
  };

  const formatStage1TraceOverviewBody = (
    trace: ReturnType<typeof extractStage1Trace>,
    loc: IcmLocalePack,
    fallbackDesc: string
  ): string => {
    const lines: string[] = [];
    lines.push(loc.ui.stage1TelemetryHeading);
    lines.push(
      formatLocaleTemplate(loc.ui.stage1TelemetryStats, {
        level: trace.thinkingLevel,
        steps: trace.thoughtSteps,
        queries: trace.searchQueries.length,
      })
    );
    if (trace.totalTokens > 0 || trace.durationMs > 0) {
      const sec = (trace.durationMs / 1000).toFixed(1);
      lines.push(
        formatLocaleTemplate(loc.ui.stage1TelemetryTokens, {
          total: trace.totalTokens,
          input: trace.inputTokens,
          thoughts: trace.thoughtsTokens,
          output: trace.outputTokens,
          sec,
        })
      );
    }
    lines.push('');
    lines.push(
      formatLocaleTemplate(loc.ui.stage1ExecutedQueriesHeading, {
        count: trace.searchQueries.length,
      })
    );
    if (trace.searchQueries.length > 0) {
      trace.searchQueries.forEach((q, idx) => {
        lines.push(`${idx + 1}. \`${q}\``);
      });
    } else {
      lines.push(loc.ui.stage1NoQueries);
    }
    if (trace.thinkingTraceMarkdown.trim()) {
      const cleanedTrace = trace.thinkingTraceMarkdown
        .replace(/^\s*#\s+[^\r\n]*(?:\r?\n|$)/, '')
        .replace(
          /^\s*(?:[-*+]\s+\*\*(?:Model|Thinking Level|Duration|Input Tokens|Thinking Tokens|Output Tokens|Total Tokens):\*\*[^\r\n]*(?:\r?\n|$))+\s*/i,
          ''
        )
        .replace(/(?:^|\r?\n)##\s+Executed Google Search Queries\b[\s\S]*?(?=\r?\n##\s+|$)/i, '')
        .trim();
      if (cleanedTrace) {
        lines.push('');
        lines.push('---');
        lines.push('');
        lines.push(cleanedTrace);
      }
    } else if (fallbackDesc.trim()) {
      lines.push('');
      lines.push(fallbackDesc.trim());
    }
    return lines.join('\n');
  };

  const stage1Trace = extractStage1Trace(resolvedRunDir, meta);

  const fallbackTitle = String(
    okfDoc.frontmatter.title || meta.topic || resolvedRunId || 'ICM Studio Surface'
  );
  const workspaceLocale = loadWorkspaceLocale(workspaceRoot);
  const detectedSurfaceLang = detectIcmLanguage(
    `${okfDoc.frontmatter.title || ''} ${okfDoc.frontmatter.description || ''} ${okfDoc.body || ''} ${JSON.stringify(rawStage2 || {})}`
  );
  const surfaceLang = workspaceLocale.hasCustomFile
    ? workspaceLocale.bcp47.split('-')[0].toLowerCase().replace(/^(?:nb|nn)$/, 'no')
    : detectedSurfaceLang;
  interface DiscoveredRunMediaEntry {
    relUrl: string;
    fullPath: string;
    kind: 'image' | 'audio';
    isRawPcm?: boolean;
  }
  const runDiscoveredMedia = new Map<string, DiscoveredRunMediaEntry[]>();
  const hydrateRunMultimodalMedia = (
    targetRunDir: string,
    norm: ReturnType<typeof normalizeStage2ForA2ui>
  ): {
    overviewImageUrl: string;
    overviewImageCaption: string;
    overviewAudioUrl: string;
    overviewAudioVoices: string;
    discoveredMedia: DiscoveredRunMediaEntry[];
  } => {
    const discoveredMedia: DiscoveredRunMediaEntry[] = [];
    const seenRelUrls = new Set<string>();
    const recordMedia = (entry: DiscoveredRunMediaEntry) => {
      if (!seenRelUrls.has(entry.relUrl)) {
        seenRelUrls.add(entry.relUrl);
        discoveredMedia.push(entry);
      }
    };
    let overviewImageUrl = '';
    let overviewImageCaption = norm.title || '';
    let overviewAudioUrl = '';
    let overviewAudioVoices = '';
    if (!targetRunDir || !fs.existsSync(targetRunDir)) {
      return {
        overviewImageUrl,
        overviewImageCaption,
        overviewAudioUrl,
        overviewAudioVoices,
        discoveredMedia,
      };
    }

    const visualsOutDir = path.join(targetRunDir, 'stages', '03_visuals', 'output');
    if (fs.existsSync(visualsOutDir)) {
      let manifestItems: Array<Record<string, any>> = [];
      const vManifestPath = path.join(visualsOutDir, 'visuals_manifest.json');
      if (fs.existsSync(vManifestPath)) {
        try {
          const parsed = JSON.parse(fs.readFileSync(vManifestPath, 'utf-8'));
          if (Array.isArray(parsed?.items)) manifestItems = parsed.items;
        } catch {
          manifestItems = [];
        }
      }
      const imgExts = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
      const resolveVisualSlot = (
        candidateBases: string[],
        slotMatchFn: (it: Record<string, any>) => boolean
      ): { relUrl: string; caption?: string } | null => {
        const mItem = manifestItems.find(slotMatchFn);
        const candidateFiles: string[] = [];
        if (mItem && typeof mItem.fileName === 'string' && mItem.fileName.trim()) {
          candidateFiles.push(path.basename(mItem.fileName.trim()));
        }
        for (const base of candidateBases) {
          for (const ext of imgExts) {
            candidateFiles.push(`${base}${ext}`);
          }
        }
        for (const fName of candidateFiles) {
          const full = path.join(visualsOutDir, fName);
          if (fs.existsSync(full) && fs.statSync(full).isFile()) {
            const relUrl = `./stages/03_visuals/output/${fName}`;
            recordMedia({ relUrl, fullPath: full, kind: 'image' });
            return {
              relUrl,
              caption: typeof mItem?.caption === 'string' ? mItem.caption.trim() : undefined,
            };
          }
        }
        return null;
      };

      const ovVis = resolveVisualSlot(
        ['overview', 'hero'],
        (it) => it?.slotId === 'overview' || Number(it?.moduleNumber) === 0
      );
      if (ovVis) {
        overviewImageUrl = ovVis.relUrl;
        if (ovVis.caption) overviewImageCaption = ovVis.caption;
      }

      norm.modules.forEach((mod, idx) => {
        const slotNum = idx + 1;
        const padSlot = String(slotNum).padStart(2, '0');
        const modNum = mod.number || slotNum;
        const padMod = String(modNum).padStart(2, '0');
        const bases = Array.from(
          new Set([
            `module_${padSlot}`,
            `module_${slotNum}`,
            `module_${padMod}`,
            `module_${modNum}`,
          ])
        );
        const modVis = resolveVisualSlot(
          bases,
          (it) =>
            it?.slotId === `module_${padSlot}` ||
            it?.slotId === `module_${slotNum}` ||
            Number(it?.moduleNumber) === modNum
        );
        if (modVis) {
          mod.imageUrl = modVis.relUrl;
          if (modVis.caption) mod.imageCaption = modVis.caption;
        }
      });
    }

    const audioOutDir = path.join(targetRunDir, 'stages', '04_audio', 'output');
    if (fs.existsSync(audioOutDir)) {
      let audioItems: Array<Record<string, any>> = [];
      let manifestVoiceFallback = '';
      const aManifestPath = path.join(audioOutDir, 'audio_manifest.json');
      if (fs.existsSync(aManifestPath)) {
        try {
          const parsed = JSON.parse(fs.readFileSync(aManifestPath, 'utf-8'));
          if (Array.isArray(parsed?.items)) audioItems = parsed.items;
          if (Array.isArray(parsed?.voicesUsed) && parsed.voicesUsed.length > 0) {
            manifestVoiceFallback = parsed.voicesUsed.join(' & ');
          } else if (typeof parsed?.voice === 'string' && parsed.voice.trim()) {
            manifestVoiceFallback = parsed.voice.trim();
          }
        } catch {
          audioItems = [];
        }
      }
      const audExts = ['.wav', '.mp3', '.ogg', '.m4a', '.webm', '.pcm'];
      const resolveAudioSlot = (
        candidateBases: string[],
        slotMatchFn: (it: Record<string, any>) => boolean
      ): { relUrl: string; voicesLabel: string } | null => {
        const mItem = audioItems.find(slotMatchFn);
        const slotVoicesLabel =
          Array.isArray(mItem?.voicesUsed) && mItem.voicesUsed.length > 0
            ? mItem.voicesUsed.join(' & ')
            : typeof mItem?.voice === 'string' && mItem.voice.trim()
              ? mItem.voice.trim()
              : manifestVoiceFallback;
        const candidateFiles: string[] = [];
        if (mItem && typeof mItem.fileName === 'string' && mItem.fileName.trim()) {
          candidateFiles.push(path.basename(mItem.fileName.trim()));
        }
        for (const base of candidateBases) {
          for (const ext of audExts) {
            candidateFiles.push(`${base}${ext}`);
          }
        }
        for (const fName of candidateFiles) {
          const full = path.join(audioOutDir, fName);
          if (fs.existsSync(full) && fs.statSync(full).isFile()) {
            const relUrl = `./stages/04_audio/output/${fName}`;
            recordMedia({
              relUrl,
              fullPath: full,
              kind: 'audio',
              isRawPcm: fName.toLowerCase().endsWith('.pcm'),
            });
            return { relUrl, voicesLabel: slotVoicesLabel };
          }
        }
        return null;
      };

      const ovAud = resolveAudioSlot(
        ['overview', 'hero'],
        (it) => it?.slotId === 'overview' || Number(it?.moduleNumber) === 0
      );
      if (ovAud) {
        overviewAudioUrl = ovAud.relUrl;
        overviewAudioVoices = ovAud.voicesLabel;
      }

      norm.modules.forEach((mod, idx) => {
        const slotNum = idx + 1;
        const padSlot = String(slotNum).padStart(2, '0');
        const modNum = mod.number || slotNum;
        const padMod = String(modNum).padStart(2, '0');
        const bases = Array.from(
          new Set([
            `module_${padSlot}`,
            `module_${slotNum}`,
            `module_${padMod}`,
            `module_${modNum}`,
          ])
        );
        const modAud = resolveAudioSlot(
          bases,
          (it) =>
            it?.slotId === `module_${padSlot}` ||
            it?.slotId === `module_${slotNum}` ||
            Number(it?.moduleNumber) === modNum
        );
        if (modAud) {
          mod.audioUrl = modAud.relUrl;
          if (modAud.voicesLabel) mod.audioVoices = modAud.voicesLabel;
        }
      });
    }

    return {
      overviewImageUrl,
      overviewImageCaption,
      overviewAudioUrl,
      overviewAudioVoices,
      discoveredMedia,
    };
  };

  const stage2Norm = normalizeStage2ForA2ui(rawStage2, fallbackTitle, workspaceLocale);
  const activeMedia = hydrateRunMultimodalMedia(resolvedRunDir, stage2Norm);
  runDiscoveredMedia.set(resolvedRunId || 'workspace', activeMedia.discoveredMedia);
  const domainMode = detectIcmDomainMode(
    rawStage2,
    stage2Norm.quiz.length,
    `${okfDoc.frontmatter.title || ''} ${okfDoc.frontmatter.description || ''} ${stage2Norm.title} ${stage2Norm.scriptBody}`
  );
  const isAnalysis = domainMode === 'analysis';
  const mdChecklistGroups = isStage1Only
    ? []
    : extractChecklistGroupsFromMarkdown(okfDoc.body, workspaceLocale);
  const checklistFromStage2 = !isStage1Only && stage2Norm.checklistGroups.length > 0;
  const checklistGroups = isStage1Only
    ? []
    : checklistFromStage2
      ? stage2Norm.checklistGroups
      : mdChecklistGroups;

  let totalChecklistItems = 0;
  for (const g of checklistGroups) {
    totalChecklistItems += g.items.length;
  }

  const deriveRunConceptId = (
    runMeta: Record<string, any>,
    runOkfDoc: OKFDocument,
    runIdStr: string
  ): string => {
    const existing = String(runMeta?.okf?.bundleConceptId || '').trim();
    if (existing) return existing;
    const rawSlug = transliterateNordicAscii(String(runOkfDoc.frontmatter.title || runIdStr))
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/-\d{10,}$/, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    return `research/${truncateSlugAtWordBoundary(rawSlug, 48, 12, true) || 'current'}`;
  };

  const primaryConceptId = deriveRunConceptId(meta, okfDoc, resolvedRunId || 'current');

  // Helper to build a run's dataModel and tabTitles for multi-run A2UI Studio switching
  const buildRunBundleEntry = (
    rId: string,
    rDir: string,
    rMeta: Record<string, any>,
    rOkfDoc: OKFDocument,
    rRawStage2: Record<string, unknown> | null,
    graphNodeCount: number,
    runIndex = 0
  ): A2uiBundleRunEntry => {
    const rIsStage1Only = !rRawStage2;
    const rStage1Trace = extractStage1Trace(rDir, rMeta);
    const rFallbackTitle = String(
      rOkfDoc.frontmatter.title || rMeta.topic || rId || 'ICM Studio Surface'
    );
    const rDetectedLang = detectIcmLanguage(
      `${rOkfDoc.frontmatter.title || ''} ${rOkfDoc.frontmatter.description || ''} ${rOkfDoc.body || ''} ${JSON.stringify(rRawStage2 || {})}`
    );
    const rLang = workspaceLocale.hasCustomFile
      ? workspaceLocale.bcp47.split('-')[0].toLowerCase().replace(/^(?:nb|nn)$/, 'no')
      : rDetectedLang;
    const rStage2Norm = normalizeStage2ForA2ui(rRawStage2, rFallbackTitle, workspaceLocale);
    const rMedia = hydrateRunMultimodalMedia(rDir, rStage2Norm);
    runDiscoveredMedia.set(rId || 'workspace', rMedia.discoveredMedia);
    const rDomainMode = detectIcmDomainMode(
      rRawStage2,
      rStage2Norm.quiz.length,
      `${rOkfDoc.frontmatter.title || ''} ${rOkfDoc.frontmatter.description || ''} ${rStage2Norm.title} ${rStage2Norm.scriptBody}`
    );
    const rIsAnalysis = rDomainMode === 'analysis';
    const rMdChecklistGroups = rIsStage1Only
      ? []
      : extractChecklistGroupsFromMarkdown(rOkfDoc.body, workspaceLocale);
    const rChecklistFromStage2 = !rIsStage1Only && rStage2Norm.checklistGroups.length > 0;
    const rChecklistGroups = rIsStage1Only
      ? []
      : rChecklistFromStage2
        ? rStage2Norm.checklistGroups
        : rMdChecklistGroups;
    let rTotalChecklist = 0;
    for (const g of rChecklistGroups) {
      rTotalChecklist += g.items.length;
    }
    const rCompletedChecklist = rChecklistGroups.reduce(
      (acc, g) => acc + g.items.filter((i) => i.checked).length,
      0
    );
    const rChecklistPct =
      rTotalChecklist > 0 ? Math.round((rCompletedChecklist / rTotalChecklist) * 100) : 0;
    const rFormattedDuration = rStage2Norm.estimatedDuration
      ? /[a-zA-Z]/.test(String(rStage2Norm.estimatedDuration))
        ? String(rStage2Norm.estimatedDuration)
        : `${rStage2Norm.estimatedDuration}s`
      : '';
    const rStatus = String(rOkfDoc.frontmatter.status || 'draft');
    const rTrustTier = getOkfTrustTier(rOkfDoc.frontmatter);
    const rStale = isOkfStale(rOkfDoc.frontmatter);
    const rVerifiedList = normalizeVerified(rOkfDoc.frontmatter);
    const rHumanVerifiers = rVerifiedList.filter(
      (v) => typeof v.by === 'string' && /^human:/i.test(v.by.trim())
    );
    const rNonDefaultHuman = [...rHumanVerifiers]
      .reverse()
      .find(
        (v) =>
          v.by !== workspaceLocale.ui.defaultVerifierActor && v.by !== 'human:reviewer'
      );
    const rVerifierActor =
      rNonDefaultHuman?.by ||
      rHumanVerifiers[rHumanVerifiers.length - 1]?.by ||
      workspaceLocale.ui.defaultVerifierActor;
    const rSources = (
      Array.isArray(rOkfDoc.frontmatter.sources) ? rOkfDoc.frontmatter.sources : []
    ).map(enrichSourceMimeForSurface);
    const rAdjudications = extractIntermissionAdjudications(rOkfDoc);
    const rAdjudicationDecisions = buildAdjudicationDecisionsMap(rAdjudications);
    const rConceptId = deriveRunConceptId(rMeta, rOkfDoc, rId || 'current');
    const rTitle = String(rOkfDoc.frontmatter.title || rStage2Norm.title);
    const rBody = rOkfDoc.body || workspaceLocale.ui.noOkfBody;
    const rStatusBadge = `status: ${rStatus}`;
    const rTrustBadge = `trust: ${rTrustTier}`;
    const rFreshnessBadge = rStale ? 'stale' : 'fresh';
    const rSourcesBadge = formatLocaleTemplate(workspaceLocale.ui.verifiedSourcesCount, {
      count: rSources.length,
    });
    const rShortTitle =
      rStage2Norm.title.length > 52
        ? `${rStage2Norm.title.slice(0, 52).trimEnd()}…`
        : rStage2Norm.title;
    const rShortLabel = formatLocaleTemplate(workspaceLocale.ui.runLabelPrefix, {
      n: runIndex + 1,
      title: rShortTitle,
    });

    const rOverviewBody = rIsStage1Only
      ? formatStage1TraceOverviewBody(
          rStage1Trace,
          workspaceLocale,
          String(rOkfDoc.frontmatter.description || '')
        )
      : rStage2Norm.scriptBody ||
        String(rOkfDoc.frontmatter.description || '') ||
        workspaceLocale.ui.noStage2Body;

    const rOverviewHeading = rIsStage1Only
      ? workspaceLocale.ui.stage1OverviewHeading
      : rIsAnalysis
        ? workspaceLocale.ui.stage2OverviewHeadingAnalysis
        : workspaceLocale.ui.stage2OverviewHeadingCourse;

    const rActivePingPong = readActivePingPongState(workspaceRoot, rId);
    const canPingPongRun =
      options.enablePingPong === false
        ? false
        : Boolean(rActivePingPong) ||
          hasAntigravityBrowserCapability({
            artifactDir: options.artifactDir,
            enablePingPong: options.enablePingPong,
          });
    const rPingPongUrl = canPingPongRun
      ? rActivePingPong?.pingPongUrl ||
        `http://127.0.0.1:${A2UI_PING_PONG_DEFAULT_PORT}/ping-pong`
      : '';
    const rDataModel = {
      meta: {
        runId: rId || 'workspace',
        lang: rLang,
        bcp47: workspaceLocale.hasCustomFile
          ? workspaceLocale.bcp47
          : rLang === 'en'
            ? 'en-US'
            : rLang,
        domainMode: rDomainMode,
        isStage1Only: rIsStage1Only,
        canPingPong: canPingPongRun,
        pingPongUrl: rPingPongUrl,
        title: rStage2Norm.title,
        subtitle: rStage2Norm.subtitle,
        targetAudience: rStage2Norm.targetAudience,
        estimatedDuration: rStage2Norm.estimatedDuration,
        model: rMeta.model || GEMINI_4_ARGON_MODEL,
        subtitleLine: [
          rStage2Norm.targetAudience
            ? `${workspaceLocale.ui.targetAudienceLabel}: ${rStage2Norm.targetAudience}`
            : '',
          rFormattedDuration
            ? `${workspaceLocale.ui.durationLabel}: ${rFormattedDuration}`
            : '',
          `${workspaceLocale.ui.modelLabel}: ${rMeta.model || GEMINI_4_ARGON_MODEL}`,
          `Run: ${rId || 'workspace'}`,
        ]
          .filter(Boolean)
          .join('  •  '),
      },
      okf: {
        primaryConceptId: rConceptId,
        activeConceptId: rConceptId,
        viewingStubConcept: false,
        primaryTitle: rTitle,
        primaryBody: rBody,
        primarySources: rSources,
        primaryAdjudications: rAdjudications,
        primaryAdjudicationDecisions: rAdjudicationDecisions,
        primaryStatus: rStatus,
        primaryTrustTier: rTrustTier,
        primaryIsStale: rStale,
        primaryStatusBadge: rStatusBadge,
        primaryTrustBadge: rTrustBadge,
        primaryFreshnessBadge: rFreshnessBadge,
        primarySourcesBadge: rSourcesBadge,
        title: rTitle,
        type: String(rOkfDoc.frontmatter.type || 'Research Concept'),
        status: rStatus,
        trustTier: rTrustTier,
        isStale: rStale,
        statusBadge: rStatusBadge,
        trustBadge: rTrustBadge,
        freshnessBadge: rFreshnessBadge,
        sourcesBadge: rSourcesBadge,
        sources: rSources,
        adjudications: rAdjudications,
        adjudicationDecisions: rAdjudicationDecisions,
        verifierActor: rVerifierActor,
        rejectedSources: [] as string[],
        replacedSources: {} as Record<string, string>,
        addedSources: [] as Array<{ id: string; url: string; title: string }>,
        stage1Trace: rStage1Trace,
        body: rBody,
        editMode: false,
      },
      checklist: {
        groups: rChecklistGroups,
        fromStage2: rChecklistFromStage2,
        completedCount: rCompletedChecklist,
        totalCount: rTotalChecklist,
        percent: rChecklistPct,
        summaryText: formatLocaleTemplate(workspaceLocale.ui.completedSummary, {
          completed: rCompletedChecklist,
          total: rTotalChecklist,
          pct: rChecklistPct,
        }),
      },
      stage2: {
        overviewHeading: rOverviewHeading,
        overviewImageUrl: rMedia.overviewImageUrl,
        overviewImageCaption: rMedia.overviewImageCaption,
        overviewAudioUrl: rMedia.overviewAudioUrl,
        overviewAudioVoices: rMedia.overviewAudioVoices,
        scriptBody: rOverviewBody,
        overviewDiagram: rStage2Norm.overviewDiagram || null,
        spokenScript:
          rStage2Norm.spokenScript ||
          rStage2Norm.scriptBody ||
          rOkfDoc.frontmatter.description ||
          workspaceLocale.ui.noStage2Body,
        highlights: rStage2Norm.highlights,
        highlightsObjects: rStage2Norm.highlights.map((h, idx) => ({
          id: `hl_${idx + 1}`,
          label: `• ${h}`,
        })),
        modules: rStage2Norm.modules,
        activeModuleIndex: 0,
        cases: rStage2Norm.cases,
        caseResponses: {},
        caseRevealed: {},
        quiz: rStage2Norm.quiz,
        quizAnswers: {},
      },
    };

    const rTabTitles: Record<string, string> = {
      tab_overview: rIsStage1Only
        ? formatLocaleTemplate(workspaceLocale.ui.tabSearchTraceCount, {
            count: rStage1Trace.searchQueries.length,
          })
        : rIsAnalysis
          ? workspaceLocale.ui.tabOverviewAnalysis
          : workspaceLocale.ui.tabOverviewCourse,
      tab_okf_markdown: rIsStage1Only
        ? formatLocaleTemplate(workspaceLocale.ui.tabOkfSourcesCount, {
            count: rSources.length,
          })
        : workspaceLocale.ui.tabOkfBase,
      tab_okf_graph: formatLocaleTemplate(workspaceLocale.ui.tabOkfGraphCount, {
        count: graphNodeCount,
      }),
    };
    if (rTotalChecklist > 0) {
      rTabTitles.tab_checklist = formatLocaleTemplate(workspaceLocale.ui.tabChecklistCount, {
        count: rTotalChecklist,
      });
    }
    if (rStage2Norm.modules.length > 0) {
      rTabTitles.tab_modules = formatLocaleTemplate(
        rIsAnalysis
          ? workspaceLocale.ui.tabModulesAnalysisCount
          : workspaceLocale.ui.tabModulesCourseCount,
        { count: rStage2Norm.modules.length }
      );
    }
    if (rStage2Norm.cases.length > 0) {
      rTabTitles.tab_cases = formatLocaleTemplate(
        rIsAnalysis
          ? workspaceLocale.ui.tabCasesAnalysisCount
          : workspaceLocale.ui.tabCasesCourseCount,
        { count: rStage2Norm.cases.length }
      );
    }
    if (rStage2Norm.quiz.length > 0) {
      rTabTitles.tab_quiz = formatLocaleTemplate(workspaceLocale.ui.tabQuizCount, {
        count: rStage2Norm.quiz.length,
      });
    }

    return {
      runId: rId || 'workspace',
      conceptId: rConceptId,
      title: rStage2Norm.title,
      shortLabel: rShortLabel,
      isStage1Only: rIsStage1Only,
      status: rStatus,
      trustTier: rTrustTier,
      isStale: rStale,
      sourcesCount: rSources.length,
      checklistCount: rTotalChecklist,
      checklistItemCount: rTotalChecklist,
      moduleCount: rStage2Norm.modules.length,
      caseCount: rStage2Norm.cases.length,
      quizCount: rStage2Norm.quiz.length,
      tabTitles: rTabTitles,
      dataModel: rDataModel,
    };
  };

  // Discover all runs in workspace/runs for multi-run switching in A2UI Studio
  const hasStage1OrComplete = (dirPath: string): boolean =>
    fs.existsSync(path.join(dirPath, 'stages', '01_research', 'output', 'research_summary.md')) ||
    fs.existsSync(path.join(dirPath, 'stages', '02_script', 'output', 'script_draft.json'));

  const candidateRunDirs: Array<{
    name: string;
    fullPath: string;
    sortKey: number;
    hasArtifact: boolean;
  }> = [];
  if (fs.existsSync(runsRoot)) {
    for (const d of fs.readdirSync(runsRoot, { withFileTypes: true })) {
      if (!d.isDirectory() || d.name === '_dry_run') continue;
      const fullPath = path.join(runsRoot, d.name);
      if (!isValidRunDir(fullPath)) continue;
      const tsMatch = d.name.match(/-(\d{10,})$/);
      const sortKey = tsMatch ? Number(tsMatch[1]) : fs.statSync(fullPath).mtimeMs;
      candidateRunDirs.push({
        name: d.name,
        fullPath,
        sortKey,
        hasArtifact: hasStage1OrComplete(fullPath),
      });
    }
  }
  const hasAnyArtifactRun = candidateRunDirs.some((d) => d.hasArtifact);
  const rawRunDirs: Array<{ name: string; fullPath: string; sortKey: number }> = (
    hasAnyArtifactRun ? candidateRunDirs.filter((d) => d.hasArtifact) : candidateRunDirs
  ).map(({ name, fullPath, sortKey }) => ({ name, fullPath, sortKey }));

  if (
    resolvedRunDir &&
    fs.existsSync(resolvedRunDir) &&
    !rawRunDirs.some((d) => path.resolve(d.fullPath) === path.resolve(resolvedRunDir))
  ) {
    const tsMatch = (resolvedRunId || '').match(/-(\d{10,})$/);
    const sortKey = tsMatch ? Number(tsMatch[1]) : fs.statSync(resolvedRunDir).mtimeMs;
    rawRunDirs.push({
      name: resolvedRunId || path.basename(resolvedRunDir),
      fullPath: resolvedRunDir,
      sortKey,
    });
  }
  rawRunDirs.sort((a, b) => a.sortKey - b.sortKey || a.name.localeCompare(b.name));

  // Collect OKF Bundle Graph Data for OkfKnowledgeGraph
  const concepts = fs.existsSync(bundleRoot) ? walkBundleConcepts(bundleRoot) : [];
  if (concepts.length === 0 && okfDoc.body) {
    const synthId = primaryConceptId || `research/${resolvedRunId || 'current'}`;
    concepts.push({
      id: synthId,
      type: String(okfDoc.frontmatter.type || 'Research Concept'),
      title: String(okfDoc.frontmatter.title || stage2Norm.title),
      description: String(okfDoc.frontmatter.description || ''),
      resource: String(okfDoc.frontmatter.resource || ''),
      tags: normalizeOkfTags(okfDoc.frontmatter.tags),
      body: okfDoc.body,
      status: String(okfDoc.frontmatter.status || 'draft'),
      generated: (okfDoc.frontmatter.generated as any) || {},
      verified: [],
      stale_after: String(okfDoc.frontmatter.stale_after || ''),
      sources: okfSources,
      trust_tier: okfTrustTier,
      stale: okfStale,
      links_to: extractConceptLinks(
        okfDoc.body,
        okfDoc.frontmatter,
        path.join(bundleRoot, 'research'),
        bundleRoot
      ),
    });
  }

  // Pre-build bundleRuns entries (we will update tab_okf_graph count once graphNodes is finalized)
  const bundleRuns: A2uiBundleRunEntry[] = [];
  for (let rIdx = 0; rIdx < rawRunDirs.length; rIdx++) {
    const rd = rawRunDirs[rIdx];
    if (resolvedRunDir && path.resolve(rd.fullPath) === path.resolve(resolvedRunDir)) {
      bundleRuns.push(buildRunBundleEntry(rd.name, rd.fullPath, meta, okfDoc, rawStage2, 0, rIdx));
      continue;
    }
    let rMeta: Record<string, any> = {};
    const rMetaPath = path.join(rd.fullPath, 'meta.json');
    if (fs.existsSync(rMetaPath)) {
      try {
        rMeta = JSON.parse(fs.readFileSync(rMetaPath, 'utf-8'));
      } catch {
        rMeta = {};
      }
    }
    const rStage1Path = path.join(
      rd.fullPath,
      'stages',
      '01_research',
      'output',
      'research_summary.md'
    );
    const rStage2Path = path.join(
      rd.fullPath,
      'stages',
      '02_script',
      'output',
      'script_draft.json'
    );
    const rRawOkf = fs.existsSync(rStage1Path) ? fs.readFileSync(rStage1Path, 'utf-8') : '';
    const rOkfDoc = rRawOkf
      ? parseOkfDocument(rRawOkf)
      : { frontmatter: { title: rd.name, status: 'draft' }, body: '' };
    healOrphanOkfFootnotes(rOkfDoc);
    let rRawStage2: Record<string, unknown> | null = null;
    if (fs.existsSync(rStage2Path)) {
      try {
        rRawStage2 = JSON.parse(fs.readFileSync(rStage2Path, 'utf-8'));
      } catch {
        rRawStage2 = null;
      }
    }
    bundleRuns.push(buildRunBundleEntry(rd.name, rd.fullPath, rMeta, rOkfDoc, rRawStage2, 0, rIdx));
  }
  if (bundleRuns.length === 0) {
    bundleRuns.push(
      buildRunBundleEntry(resolvedRunId || 'workspace', resolvedRunDir, meta, okfDoc, rawStage2, 0, 0)
    );
  }

  const conceptToRunId = new Map<string, string>();
  for (const br of bundleRuns) {
    if (br.conceptId) {
      conceptToRunId.set(br.conceptId, br.runId);
    }
  }

  const conceptBacklinks = new Map<string, Array<{ id: string; title: string }>>();
  for (const c of concepts) {
    for (const target of c.links_to) {
      if (target === c.id) continue;
      const list = conceptBacklinks.get(target) || [];
      if (!list.some((b) => b.id === c.id)) {
        list.push({ id: c.id, title: c.title || c.id });
      }
      conceptBacklinks.set(target, list);
    }
  }

  const conceptMeta: Record<string, Record<string, any>> = {};
  for (const c of concepts) {
    const cSources = Array.isArray(c.sources) ? c.sources : [];
    conceptMeta[c.id] = {
      id: c.id,
      title: c.title || c.id,
      type: c.type,
      description: c.description,
      status: c.status,
      trustTier: c.trust_tier,
      isStale: c.stale,
      statusBadge: `status: ${c.status || 'draft'}`,
      trustBadge: `trust: ${c.trust_tier || 'unverified'}`,
      freshnessBadge: c.stale ? 'stale' : 'fresh',
      sourcesBadge: formatLocaleTemplate(workspaceLocale.ui.verifiedSourcesCount, {
        count: cSources.length,
      }),
      sources: cSources,
      backlinks: conceptBacklinks.get(c.id) || [],
      runId: conceptToRunId.get(c.id) || null,
    };
  }

  const conceptIds = new Set(concepts.map((c) => c.id));
  const graphNodes: Array<{ data: Record<string, any> }> = concepts.map((c) => ({
    data: {
      id: c.id,
      group: 'concept',
      label: c.title || c.id,
      type: c.type,
      description: c.description,
      status: c.status,
      trust_tier: c.trust_tier,
      stale: c.stale,
      sources: c.sources || [],
      tags: c.tags || [],
      generated: c.generated || {},
      verified: c.verified || [],
      stale_after: c.stale_after || '',
      backlinks: conceptBacklinks.get(c.id) || [],
      runId: conceptToRunId.get(c.id) || null,
      color: getOkfTypeColor(c.type),
      size: 32 + Math.min(48, Math.floor(c.body.length / 250)),
    },
  }));
  const graphBodies: Record<string, string> = {};
  for (const c of concepts) {
    graphBodies[c.id] = c.body;
  }

  // Ensure every discovered run's concept metadata and body are registered even if bundle wasn't synced yet
  for (const br of bundleRuns) {
    const cid = br.conceptId;
    const rOkf = br.dataModel?.okf;
    if (cid && rOkf) {
      if (!graphBodies[cid] && rOkf.primaryBody) {
        graphBodies[cid] = rOkf.primaryBody;
      }
      if (!conceptMeta[cid]) {
        conceptMeta[cid] = {
          id: cid,
          title: rOkf.primaryTitle || br.title,
          type: rOkf.type || 'Research Concept',
          description: '',
          status: rOkf.status || 'draft',
          trustTier: rOkf.primaryTrustTier || 'unverified',
          isStale: Boolean(rOkf.primaryIsStale),
          statusBadge: rOkf.primaryStatusBadge || 'status: draft',
          trustBadge: rOkf.primaryTrustBadge || 'trust: unverified',
          freshnessBadge: rOkf.primaryFreshnessBadge || 'fresh',
          sourcesBadge: rOkf.primarySourcesBadge || '0 sources',
          sources: rOkf.primarySources || [],
          backlinks: conceptBacklinks.get(cid) || [],
          runId: br.runId,
        };
      }
    }
  }

  const graphEdges: Array<{ data: { id: string; source: string; target: string; label?: string } }> = [];
  const seenEdgeKeys = new Set<string>();
  const sourceNodeIdByCanonicalUrl = new Map<string, string>();
  const sourceNodeDataById = new Map<string, Record<string, any>>();
  const sourceNodeByFnId: Record<string, Record<string, string>> = {};
  const sourceNodeByAnyFnId: Record<string, string> = {};

  for (const c of concepts) {
    sourceNodeByFnId[c.id] = {};
    for (const target of c.links_to) {
      if (target === c.id) continue;
      if (!conceptIds.has(target)) {
        conceptIds.add(target);
        const shortLabel = target
          .replace(/^research\//, '')
          .replace(/-/g, ' ')
          .replace(/\b\w/g, (m) => m.toUpperCase());
        graphNodes.push({
          data: {
            id: target,
            group: 'concept',
            label: shortLabel,
            parentConceptId: c.id,
            type: 'Linked Concept',
            description: formatLocaleTemplate(workspaceLocale.ui.referencedConceptDesc, {
              id: c.id,
            }),
            status: 'draft',
            trust_tier: 'unverified',
            stale: false,
            sources: [],
            backlinks: conceptBacklinks.get(target) || [],
            color: '#64748b',
            size: 28,
          },
        });
        graphBodies[target] = formatLocaleTemplate(workspaceLocale.ui.stubConceptBody, {
          label: shortLabel,
          id: target,
          parent: c.title || c.id,
        });
      }
      const key = `${c.id}__${target}`;
      if (seenEdgeKeys.has(key)) continue;
      seenEdgeKeys.add(key);
      graphEdges.push({ data: { id: key, source: c.id, target } });
    }
    for (const src of c.sources || []) {
      const rawSrcId = String(src.id || src.title || 'ref').trim();
      const srcUrl = String((src as any).url || (src as any).resource || '').trim();
      const canonicalUrl = normalizeCanonicalSourceUrl(srcUrl);
      const decodedTitle = decodeHtmlEntities(String(src.title || srcUrl || rawSrcId).trim());
      const fullTitleText = enrichBareDomainSourceTitle(decodedTitle, srcUrl) || decodedTitle;
      const shortTitleText =
        fullTitleText.length > 42
          ? `${fullTitleText.slice(0, 42).trimEnd()}…`
          : fullTitleText;
      const refLine = formatLocaleTemplate(workspaceLocale.ui.referencedInConcept, {
        id: c.id,
        title: c.title || c.id,
      });

      let srcNodeId = '';
      if (canonicalUrl && sourceNodeIdByCanonicalUrl.has(canonicalUrl)) {
        srcNodeId = sourceNodeIdByCanonicalUrl.get(canonicalUrl)!;
        const existingNodeData = sourceNodeDataById.get(srcNodeId);
        if (existingNodeData) {
          const curTitleSummary = String(existingNodeData.titleSummary || '');
          if (shouldUpgradeSourceTitle(curTitleSummary, fullTitleText, srcUrl)) {
            const primaryFnId = String(existingNodeData.primaryFnId || rawSrcId);
            existingNodeData.titleSummary = fullTitleText;
            existingNodeData.fullTitle = `[^${primaryFnId}] ${fullTitleText}`;
            existingNodeData.label = `[^${primaryFnId}] ${shortTitleText}`;
          }
          const citedBy = Array.isArray(existingNodeData.citedByConcepts)
            ? (existingNodeData.citedByConcepts as string[])
            : [];
          if (!citedBy.includes(c.id)) {
            citedBy.push(c.id);
            existingNodeData.citedByConcepts = citedBy;
          }
        }
        if (graphBodies[srcNodeId] && !graphBodies[srcNodeId].includes(refLine)) {
          graphBodies[srcNodeId] = `${graphBodies[srcNodeId]}\n${refLine}`;
        }
      } else {
        let candidateNodeId = `source:${rawSrcId}`;
        let suffix = 2;
        while (conceptIds.has(candidateNodeId)) {
          candidateNodeId = `source:${rawSrcId}--${suffix}`;
          suffix++;
        }
        srcNodeId = candidateNodeId;
        conceptIds.add(srcNodeId);
        if (canonicalUrl) {
          sourceNodeIdByCanonicalUrl.set(canonicalUrl, srcNodeId);
        }
        const displayFnId = srcNodeId.replace(/^source:/, '');
        let effectiveFullTitle = fullTitleText;
        let effectiveShortTitle = shortTitleText;
        if (displayFnId !== rawSrcId) {
          const firstBaseNode = sourceNodeDataById.get(`source:${rawSrcId}`);
          const firstBaseTitle = String(
            firstBaseNode?.baseTitle || firstBaseNode?.titleSummary || ''
          ).trim();
          if (firstBaseTitle && firstBaseTitle.toLowerCase() === fullTitleText.toLowerCase()) {
            const pathSlug = extractLastUrlPathSlug(srcUrl);
            if (pathSlug) {
              effectiveFullTitle = `${fullTitleText} (${pathSlug})`;
              effectiveShortTitle = `${shortTitleText} (${pathSlug})`;
            }
          }
        }
        const nodeData: Record<string, any> = {
          id: srcNodeId,
          group: 'source',
          primaryFnId: displayFnId,
          baseTitle: fullTitleText,
          titleSummary: effectiveFullTitle,
          label: `[^${displayFnId}] ${effectiveShortTitle}`,
          fullTitle: `[^${displayFnId}] ${effectiveFullTitle}`,
          parentConceptId: c.id,
          citedByConcepts: [c.id],
          type: 'Verified Source',
          description: srcUrl || effectiveFullTitle,
          resource: srcUrl,
          status: 'stable',
          trust_tier: c.trust_tier,
          stale: false,
          color: '#10b981',
          size: 24,
        };
        sourceNodeDataById.set(srcNodeId, nodeData);
        graphNodes.push({ data: nodeData });
        graphBodies[srcNodeId] = [
          src.mime_type
            ? formatLocaleTemplate(workspaceLocale.ui.sourceMimeBullet, { value: src.mime_type })
            : '',
          src.retrieved_at
            ? formatLocaleTemplate(workspaceLocale.ui.sourceRetrievedBullet, {
                value: src.retrieved_at,
              })
            : '',
          src.last_modified
            ? formatLocaleTemplate(workspaceLocale.ui.sourceModifiedBullet, {
                value: src.last_modified,
              })
            : '',
          refLine,
        ]
          .filter(Boolean)
          .join('\n');
      }
      sourceNodeByFnId[c.id][rawSrcId] = srcNodeId;
      if (!sourceNodeByAnyFnId[rawSrcId]) {
        sourceNodeByAnyFnId[rawSrcId] = srcNodeId;
      }
      const edgeKey = `${c.id}__${srcNodeId}`;
      if (!seenEdgeKeys.has(edgeKey)) {
        seenEdgeKeys.add(edgeKey);
        graphEdges.push({ data: { id: edgeKey, source: c.id, target: srcNodeId, label: 'cites' } });
      }
    }
  }

  const anyRunHasHighlights =
    stage2Norm.highlights.length > 0 ||
    bundleRuns.some((r) => (r.dataModel?.stage2?.highlights?.length || 0) > 0);
  const anyRunHasChecklist =
    (!isStage1Only && totalChecklistItems > 0) ||
    bundleRuns.some((r) => !r.isStage1Only && r.checklistItemCount > 0);
  const anyRunHasModules =
    stage2Norm.modules.length > 0 || bundleRuns.some((r) => r.moduleCount > 0);
  const anyRunHasCases =
    stage2Norm.cases.length > 0 || bundleRuns.some((r) => r.caseCount > 0);
  const anyRunHasQuiz =
    stage2Norm.quiz.length > 0 || bundleRuns.some((r) => r.quizCount > 0);

  for (const br of bundleRuns) {
    br.tabTitles.tab_okf_graph = formatLocaleTemplate(workspaceLocale.ui.tabOkfGraphCount, {
      count: graphNodes.length,
    });
    if (br.isStage1Only) {
      br.tabs = [
        { title: br.tabTitles.tab_okf_markdown, child: 'tab_okf_markdown' },
        { title: br.tabTitles.tab_overview, child: 'tab_overview' },
        { title: br.tabTitles.tab_okf_graph, child: 'tab_okf_graph' },
      ];
    } else {
      const brTabs: Array<{ title: string; child: string }> = [
        { title: br.tabTitles.tab_overview, child: 'tab_overview' },
      ];
      if (!br.isStage1Only && br.checklistCount > 0 && br.tabTitles.tab_checklist) {
        brTabs.push({ title: br.tabTitles.tab_checklist, child: 'tab_checklist' });
      }
      if (br.moduleCount > 0 && br.tabTitles.tab_modules) {
        brTabs.push({ title: br.tabTitles.tab_modules, child: 'tab_modules' });
      }
      if (br.caseCount > 0 && br.tabTitles.tab_cases) {
        brTabs.push({ title: br.tabTitles.tab_cases, child: 'tab_cases' });
      }
      if (br.quizCount > 0 && br.tabTitles.tab_quiz) {
        brTabs.push({ title: br.tabTitles.tab_quiz, child: 'tab_quiz' });
      }
      brTabs.push(
        { title: br.tabTitles.tab_okf_markdown, child: 'tab_okf_markdown' },
        { title: br.tabTitles.tab_okf_graph, child: 'tab_okf_graph' }
      );
      br.tabs = brTabs;
    }
  }

  const surfaceId =
    options.surfaceId ||
    `icm_${(resolvedRunId || 'workspace').replace(/[^a-zA-Z0-9_-]/g, '_')}`;

  // Construct A2UI v1.0 Component Adjacency List (Basic default catalog + Tier 2 @catalogId mixing)
  const components: A2uiComponent[] = [];
  const tabs: Array<{ title: string; child: string }> = [];

  // Header Components
  components.push(
    {
      id: 'header_card',
      component: 'Card',
      child: 'header_col',
    },
    {
      id: 'header_col',
      component: 'Column',
      children: ['header_top_row', 'header_meta_row'],
    },
    {
      id: 'header_top_row',
      component: 'Row',
      justify: 'spaceBetween',
      children: ['header_title', 'header_badges_row'],
    },
    {
      id: 'header_title',
      component: 'Text',
      variant: 'body',
      text: { '@call': 'formatString', args: { value: '# ${/meta/title}' } },
    },
    {
      id: 'header_badges_row',
      component: 'Row',
      children: ['badge_status', 'badge_trust', 'badge_freshness', 'badge_sources'],
    },
    {
      id: 'badge_status',
      component: 'Badge',
      '@catalogId': A2UI_ICM_CATALOG_ID,
      tone: okfDoc.frontmatter.status === 'stable' ? 'success' : 'warn',
      text: { '@path': '/okf/statusBadge' },
    },
    {
      id: 'badge_trust',
      component: 'Badge',
      '@catalogId': A2UI_ICM_CATALOG_ID,
      tone: okfTrustTier === 'human-reviewed' ? 'accent' : 'primary',
      text: { '@path': '/okf/trustBadge' },
    },
    {
      id: 'badge_freshness',
      component: 'Badge',
      '@catalogId': A2UI_ICM_CATALOG_ID,
      tone: okfStale ? 'danger' : 'success',
      text: { '@path': '/okf/freshnessBadge' },
    },
    {
      id: 'badge_sources',
      component: 'Badge',
      '@catalogId': A2UI_ICM_CATALOG_ID,
      tone: 'neutral',
      text: { '@path': '/okf/sourcesBadge' },
    },
    {
      id: 'header_meta_row',
      component: 'Row',
      children: ['header_subtitle'],
    },
    {
      id: 'header_subtitle',
      component: 'Text',
      variant: 'caption',
      text: { '@path': '/meta/subtitleLine' },
    }
  );

  // Overview / Search & Grounding Trace Component Tree
  const overviewChildren = ['overview_narration_card'];
  if (!isStage1Only && stage2Norm.highlights.length > 0) {
    overviewChildren.push('overview_highlights_card');
  }
  const overviewNarrationChildren = isStage1Only
    ? ['overview_narration_heading', 'overview_narration_body']
    : [
        'overview_hero_image',
        'overview_narration_heading',
        'overview_tts_player',
        'overview_narration_body',
        'overview_flow_diagram',
      ];
  components.push(
    {
      id: 'tab_overview',
      component: 'Column',
      children: overviewChildren,
    },
    {
      id: 'overview_narration_card',
      component: 'Card',
      child: 'overview_narration_col',
    },
    {
      id: 'overview_narration_col',
      component: 'Column',
      children: overviewNarrationChildren,
    },
    {
      id: 'overview_hero_image',
      component: 'Image',
      variant: 'header',
      fit: 'cover',
      url: { '@path': '/stage2/overviewImageUrl' },
      description: { '@path': '/stage2/overviewImageCaption' },
    },
    {
      id: 'overview_narration_heading',
      component: 'Text',
      variant: 'body',
      text: { '@call': 'formatString', args: { value: '## ${/stage2/overviewHeading}' } },
    },
    {
      id: 'overview_tts_player',
      component: 'SpeechPlayer',
      '@catalogId': A2UI_ICM_CATALOG_ID,
      description: { '@path': '/meta/title' },
      ttsText: { '@path': '/stage2/spokenScript' },
      audioUrl: { '@path': '/stage2/overviewAudioUrl' },
      voicesLabel: { '@path': '/stage2/overviewAudioVoices' },
    },
    {
      id: 'overview_narration_body',
      component: 'Text',
      variant: 'body',
      text: { '@path': '/stage2/scriptBody' },
    },
    {
      id: 'overview_flow_diagram',
      component: 'FlowDiagram',
      '@catalogId': A2UI_ICM_CATALOG_ID,
      diagram: { '@path': '/stage2/overviewDiagram' },
    }
  );

  if (anyRunHasHighlights) {
    components.push(
      {
        id: 'overview_highlights_card',
        component: 'Card',
        child: 'overview_highlights_col',
      },
      {
        id: 'overview_highlights_col',
        component: 'Column',
        children: ['overview_highlights_title', 'overview_highlights_list'],
      },
      {
        id: 'overview_highlights_title',
        component: 'Text',
        variant: 'body',
        text: isAnalysis
          ? workspaceLocale.ui.highlightsHeadingAnalysis
          : workspaceLocale.ui.highlightsHeadingCourse,
      },
      {
        id: 'overview_highlights_list',
        component: 'List',
        children: {
          path: '/stage2/highlightsObjects',
          componentId: 'highlight_item_text',
        },
      },
      {
        id: 'highlight_item_text',
        component: 'Text',
        variant: 'body',
        text: { '@path': 'label' },
      }
    );
  }

  // Register Conditional & Domain Components
  if (anyRunHasChecklist) {
    components.push({
      id: 'tab_checklist',
      component: 'InteractiveChecklist',
      '@catalogId': A2UI_ICM_CATALOG_ID,
      title: workspaceLocale.ui.checklistCardTitle,
      groupsPath: '/checklist/groups',
    });
  }

  if (anyRunHasModules) {
    components.push({
      id: 'tab_modules',
      component: 'ModuleCarousel',
      '@catalogId': A2UI_ICM_CATALOG_ID,
      title: isAnalysis
        ? workspaceLocale.ui.modulesCardTitleAnalysis
        : workspaceLocale.ui.modulesCardTitleCourse,
      modulesPath: '/stage2/modules',
      activeIndexPath: '/stage2/activeModuleIndex',
    });
  }

  if (anyRunHasCases) {
    components.push({
      id: 'tab_cases',
      component: 'CaseSimulator',
      '@catalogId': A2UI_ICM_CATALOG_ID,
      title: isAnalysis
        ? workspaceLocale.ui.casesCardTitleAnalysis
        : workspaceLocale.ui.casesCardTitleCourse,
      casesPath: '/stage2/cases',
      responsesPath: '/stage2/caseResponses',
    });
  }

  if (anyRunHasQuiz) {
    components.push({
      id: 'tab_quiz',
      component: 'QuizRunner',
      '@catalogId': A2UI_ICM_CATALOG_ID,
      title: workspaceLocale.ui.quizCardTitle,
      questionsPath: '/stage2/quiz',
      answersPath: '/stage2/quizAnswers',
    });
  }

  components.push(
    {
      id: 'tab_okf_markdown',
      component: 'OkfMarkdown',
      '@catalogId': A2UI_ICM_CATALOG_ID,
      title: { '@path': '/okf/title' },
      body: { '@path': '/okf/body' },
      sources: { '@path': '/okf/sources' },
      trustTier: { '@path': '/okf/trustTier' },
      isStale: { '@path': '/okf/isStale' },
    },
    {
      id: 'tab_okf_graph',
      component: 'OkfKnowledgeGraph',
      '@catalogId': A2UI_ICM_CATALOG_ID,
      title: workspaceLocale.ui.okfGraphTitle,
    }
  );

  // Assemble `tabs` order based on `isStage1Only` vs Full Studio Mode
  if (isStage1Only) {
    tabs.push(
      {
        title: formatLocaleTemplate(workspaceLocale.ui.tabOkfSourcesCount, {
          count: okfSources.length,
        }),
        child: 'tab_okf_markdown',
      },
      {
        title: formatLocaleTemplate(workspaceLocale.ui.tabSearchTraceCount, {
          count: stage1Trace.searchQueries.length,
        }),
        child: 'tab_overview',
      },
      {
        title: formatLocaleTemplate(workspaceLocale.ui.tabOkfGraphCount, {
          count: graphNodes.length,
        }),
        child: 'tab_okf_graph',
      }
    );
  } else {
    tabs.push({
      title: isAnalysis
        ? workspaceLocale.ui.tabOverviewAnalysis
        : workspaceLocale.ui.tabOverviewCourse,
      child: 'tab_overview',
    });
    if (totalChecklistItems > 0) {
      tabs.push({
        title: formatLocaleTemplate(workspaceLocale.ui.tabChecklistCount, {
          count: totalChecklistItems,
        }),
        child: 'tab_checklist',
      });
    }
    if (stage2Norm.modules.length > 0) {
      tabs.push({
        title: formatLocaleTemplate(
          isAnalysis
            ? workspaceLocale.ui.tabModulesAnalysisCount
            : workspaceLocale.ui.tabModulesCourseCount,
          { count: stage2Norm.modules.length }
        ),
        child: 'tab_modules',
      });
    }
    if (stage2Norm.cases.length > 0) {
      tabs.push({
        title: formatLocaleTemplate(
          isAnalysis
            ? workspaceLocale.ui.tabCasesAnalysisCount
            : workspaceLocale.ui.tabCasesCourseCount,
          { count: stage2Norm.cases.length }
        ),
        child: 'tab_cases',
      });
    }
    if (stage2Norm.quiz.length > 0) {
      tabs.push({
        title: formatLocaleTemplate(workspaceLocale.ui.tabQuizCount, {
          count: stage2Norm.quiz.length,
        }),
        child: 'tab_quiz',
      });
    }
    tabs.push(
      {
        title: workspaceLocale.ui.tabOkfBase,
        child: 'tab_okf_markdown',
      },
      {
        title: formatLocaleTemplate(workspaceLocale.ui.tabOkfGraphCount, {
          count: graphNodes.length,
        }),
        child: 'tab_okf_graph',
      }
    );
  }

  // Root & Main Tabs Component
  components.push(
    {
      id: 'main_tabs',
      component: 'Tabs',
      tabs,
    },
    {
      id: 'root',
      component: 'Column',
      children: ['header_card', 'main_tabs'],
    }
  );

  const completedChecklistCount = checklistGroups.reduce(
    (acc, g) => acc + g.items.filter((i) => i.checked).length,
    0
  );
  const checklistPct =
    totalChecklistItems > 0 ? Math.round((completedChecklistCount / totalChecklistItems) * 100) : 0;

  const formattedDuration = stage2Norm.estimatedDuration
    ? /[a-zA-Z]/.test(String(stage2Norm.estimatedDuration))
      ? String(stage2Norm.estimatedDuration)
      : `${stage2Norm.estimatedDuration}s`
    : '';

  const primaryTitleStr = String(okfDoc.frontmatter.title || stage2Norm.title);
  const primaryBodyStr = okfDoc.body || workspaceLocale.ui.noOkfBody;
  const primaryStatusStr = String(okfDoc.frontmatter.status || 'draft');
  const primaryVerifiedList = normalizeVerified(okfDoc.frontmatter);
  const primaryHumanVerifiers = primaryVerifiedList.filter(
    (v) => typeof v.by === 'string' && /^human:/i.test(v.by.trim())
  );
  const primaryNonDefaultHuman = [...primaryHumanVerifiers]
    .reverse()
    .find(
      (v) =>
        v.by !== workspaceLocale.ui.defaultVerifierActor && v.by !== 'human:reviewer'
    );
  const primaryVerifierActor =
    primaryNonDefaultHuman?.by ||
    primaryHumanVerifiers[primaryHumanVerifiers.length - 1]?.by ||
    workspaceLocale.ui.defaultVerifierActor;
  const primaryStatusBadgeStr = `status: ${primaryStatusStr}`;
  const primaryTrustBadgeStr = `trust: ${okfTrustTier}`;
  const primaryFreshnessBadgeStr = okfStale ? 'stale' : 'fresh';
  const primarySourcesBadgeStr = formatLocaleTemplate(workspaceLocale.ui.verifiedSourcesCount, {
    count: okfSources.length,
  });

  const activeOverviewBody = isStage1Only
    ? formatStage1TraceOverviewBody(
        stage1Trace,
        workspaceLocale,
        String(okfDoc.frontmatter.description || '')
      )
    : stage2Norm.scriptBody ||
      String(okfDoc.frontmatter.description || '') ||
      workspaceLocale.ui.noStage2Body;

  const activeOverviewHeading = isStage1Only
    ? workspaceLocale.ui.stage1OverviewHeading
    : isAnalysis
      ? workspaceLocale.ui.stage2OverviewHeadingAnalysis
      : workspaceLocale.ui.stage2OverviewHeadingCourse;

  const activeMainPingPong = readActivePingPongState(workspaceRoot, resolvedRunId);
  const canPingPongMain =
    options.enablePingPong === false
      ? false
      : Boolean(activeMainPingPong) ||
        hasAntigravityBrowserCapability({
          artifactDir: options.artifactDir,
          enablePingPong: options.enablePingPong,
        });
  const mainPingPongUrl = canPingPongMain
    ? activeMainPingPong?.pingPongUrl ||
      `http://127.0.0.1:${A2UI_PING_PONG_DEFAULT_PORT}/ping-pong`
    : '';
  const dataModel = {
    meta: {
      runId: resolvedRunId || 'workspace',
      lang: surfaceLang,
      bcp47: workspaceLocale.hasCustomFile
        ? workspaceLocale.bcp47
        : surfaceLang === 'en'
          ? 'en-US'
          : surfaceLang,
      domainMode,
      isStage1Only,
      canPingPong: canPingPongMain,
      pingPongUrl: mainPingPongUrl,
      title: stage2Norm.title,
      subtitle: stage2Norm.subtitle,
      targetAudience: stage2Norm.targetAudience,
      estimatedDuration: stage2Norm.estimatedDuration,
      model: meta.model || GEMINI_4_ARGON_MODEL,
      subtitleLine: [
        stage2Norm.targetAudience
          ? `${workspaceLocale.ui.targetAudienceLabel}: ${stage2Norm.targetAudience}`
          : '',
        formattedDuration ? `${workspaceLocale.ui.durationLabel}: ${formattedDuration}` : '',
        `${workspaceLocale.ui.modelLabel}: ${meta.model || GEMINI_4_ARGON_MODEL}`,
        `Run: ${resolvedRunId || 'workspace'}`,
      ]
        .filter(Boolean)
        .join('  •  '),
    },
    okf: {
      primaryConceptId,
      activeConceptId: primaryConceptId,
      viewingStubConcept: false,
      primaryTitle: primaryTitleStr,
      primaryBody: primaryBodyStr,
      primarySources: okfSources,
      primaryAdjudications: okfAdjudications,
      primaryAdjudicationDecisions: okfAdjudicationDecisions,
      primaryStatus: primaryStatusStr,
      primaryTrustTier: okfTrustTier,
      primaryIsStale: okfStale,
      primaryStatusBadge: primaryStatusBadgeStr,
      primaryTrustBadge: primaryTrustBadgeStr,
      primaryFreshnessBadge: primaryFreshnessBadgeStr,
      primarySourcesBadge: primarySourcesBadgeStr,
      title: primaryTitleStr,
      type: String(okfDoc.frontmatter.type || 'Research Concept'),
      status: primaryStatusStr,
      trustTier: okfTrustTier,
      isStale: okfStale,
      verifierActor: primaryVerifierActor,
      statusBadge: primaryStatusBadgeStr,
      trustBadge: primaryTrustBadgeStr,
      freshnessBadge: primaryFreshnessBadgeStr,
      sourcesBadge: primarySourcesBadgeStr,
      sources: okfSources,
      adjudications: okfAdjudications,
      adjudicationDecisions: okfAdjudicationDecisions,
      rejectedSources: [] as string[],
      replacedSources: {} as Record<string, string>,
      addedSources: [] as Array<{ id: string; url: string; title: string }>,
      stage1Trace,
      body: primaryBodyStr,
      editMode: false,
    },
    checklist: {
      groups: checklistGroups,
      fromStage2: checklistFromStage2,
      completedCount: completedChecklistCount,
      totalCount: totalChecklistItems,
      percent: checklistPct,
      summaryText: formatLocaleTemplate(workspaceLocale.ui.completedSummary, {
        completed: completedChecklistCount,
        total: totalChecklistItems,
        pct: checklistPct,
      }),
    },
    stage2: {
      overviewHeading: activeOverviewHeading,
      overviewImageUrl: activeMedia.overviewImageUrl,
      overviewImageCaption: activeMedia.overviewImageCaption,
      overviewAudioUrl: activeMedia.overviewAudioUrl,
      overviewAudioVoices: activeMedia.overviewAudioVoices,
      scriptBody: activeOverviewBody,
      overviewDiagram: stage2Norm.overviewDiagram || null,
      spokenScript:
        stage2Norm.spokenScript ||
        stage2Norm.scriptBody ||
        okfDoc.frontmatter.description ||
        workspaceLocale.ui.noStage2Body,
      highlights: stage2Norm.highlights,
      highlightsObjects: stage2Norm.highlights.map((h, idx) => ({
        id: `hl_${idx + 1}`,
        label: `• ${h}`,
      })),
      modules: stage2Norm.modules,
      activeModuleIndex: 0,
      cases: stage2Norm.cases,
      caseResponses: {},
      caseRevealed: {},
      quiz: stage2Norm.quiz,
      quizAnswers: {},
    },
  };

  const messages: A2uiEnvelopeMessage[] = [
    {
      version: A2UI_PROTOCOL_VERSION,
      createSurface: {
        surfaceId,
        catalogId: A2UI_BASIC_CATALOG_ID,
        sendDataModel: true,
      },
    },
    {
      version: A2UI_PROTOCOL_VERSION,
      updateComponents: {
        surfaceId,
        components,
      },
    },
    {
      version: A2UI_PROTOCOL_VERSION,
      updateDataModel: {
        surfaceId,
        path: '/',
        value: dataModel,
      },
    },
  ];

  const validation = validateA2uiSurfaceMessages(messages);
  if (!validation.valid) {
    throw new Error(`Invalid A2UI v1.0 surface generated: ${validation.errors.join('; ')}`);
  }

  // Determine output paths (supports `outputDir` override for non-destructive external testing)
  const baseOutDir = options.outputDir
    ? path.resolve(options.outputDir)
    : resolvedRunDir || workspaceRoot;
  const stageSubDir = isStage1Only
    ? path.join('stages', '01_research', 'output')
    : path.join('stages', '02_script', 'output');
  const stageOutDir = options.outputDir
    ? path.join(baseOutDir, stageSubDir)
    : resolvedRunDir
      ? path.join(resolvedRunDir, stageSubDir)
      : path.join(workspaceRoot, 'bundle');

  fs.mkdirSync(stageOutDir, { recursive: true });

  const surfaceJsonPath = path.join(stageOutDir, 'a2ui_surface.json');
  const surfaceJsonlPath = path.join(stageOutDir, 'a2ui_surface.jsonl');
  const htmlOutputPath = options.outputHtmlPath
    ? path.resolve(options.outputHtmlPath)
    : path.join(baseOutDir, 'a2ui.html');

  const surfaceJsonDoc = {
    version: A2UI_PROTOCOL_VERSION,
    mimeType: A2UI_MIME_TYPE,
    surfaceId,
    catalogId: A2UI_BASIC_CATALOG_ID,
    domainCatalogId: A2UI_ICM_CATALOG_ID,
    catalogIds: [A2UI_BASIC_CATALOG_ID, A2UI_ICM_CATALOG_ID],
    catalogSchema: A2UI_ICM_CATALOG_SCHEMA,
    generatedAt: new Date().toISOString(),
    runId: resolvedRunId || 'workspace',
    messages,
  };

  const serializedSurfaceJson = JSON.stringify(surfaceJsonDoc, null, 2);
  const serializedSurfaceJsonl = messages.map((m) => JSON.stringify(m)).join('\n') + '\n';
  fs.writeFileSync(surfaceJsonPath, serializedSurfaceJson, 'utf-8');
  fs.writeFileSync(surfaceJsonlPath, serializedSurfaceJsonl, 'utf-8');

  // Also mirror `a2ui_surface.json` & `a2ui_surface.jsonl` at the run root (`workspace/runs/<runId>/`) alongside `a2ui.html`
  if (resolvedRunDir && path.resolve(baseOutDir) !== path.resolve(stageOutDir)) {
    fs.mkdirSync(baseOutDir, { recursive: true });
    fs.writeFileSync(path.join(baseOutDir, 'a2ui_surface.json'), serializedSurfaceJson, 'utf-8');
    fs.writeFileSync(path.join(baseOutDir, 'a2ui_surface.jsonl'), serializedSurfaceJsonl, 'utf-8');
  }

  const activeRunKey = resolvedRunId || 'workspace';
  const clientPayload = {
    surfaceId,
    catalogId: A2UI_BASIC_CATALOG_ID,
    domainCatalogId: A2UI_ICM_CATALOG_ID,
    ...(workspaceLocale.hasCustomFile ? { locale: workspaceLocale } : {}),
    ...(mainPingPongUrl ? { pingPongUrl: mainPingPongUrl } : {}),
    mediaBaseMode: 'run' as const,
    hostRunId: activeRunKey,
    messages,
    bundleRuns,
    mediaUrisByRun: {} as Record<string, Record<string, string>>,
    bundleGraph: {
      nodes: graphNodes,
      edges: graphEdges,
      bodies: graphBodies,
      conceptMeta,
      sourceNodeByFnId,
      sourceNodeByAnyFnId,
    },
  };

  const renderA2uiHtmlDocument = (
    docLang: string,
    docTitle: string,
    loc: IcmLocalePack,
    payload: Record<string, any>
  ): string => {
    const themeLightLabel = loc.ui.themeLightLabel || '☀️ Light';
    const themeDarkLabel = loc.ui.themeDarkLabel || '🌙 Dark';
    const themeToggleTitle = loc.ui.themeToggleTitle || 'Switch between Light and Dark theme';
    const inspectorButtonLabel =
      loc.ui.inspectorButtonLabel || '🔍 A2UI Surface & Data Model Inspector';
    return `<!DOCTYPE html>
<html lang="${docLang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeA2uiHtml(docTitle)} — A2UI v${A2UI_PROTOCOL_VERSION} Studio</title>
<script>
(function(){try{var t=localStorage.getItem("icm_a2ui_theme");if(t==="dark"||t==="light")document.documentElement.setAttribute("data-theme",t);}catch(_e){}})();
</script>
<script src="https://cdn.jsdelivr.net/npm/marked@12.0.0/marked.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/cytoscape@3.28.1/dist/cytoscape.min.js"></script>
<style>
${A2UI_STUDIO_CSS}
</style>
</head>
<body>
<header class="a2ui-topbar">
  <div class="a2ui-topbar-brand">
    <span class="a2ui-protocol-pill">A2UI v${A2UI_PROTOCOL_VERSION}</span>
    <span class="a2ui-topbar-title">${escapeA2uiHtml(docTitle)}</span>
  </div>
  <div class="a2ui-topbar-actions">
    <button class="a2ui-top-btn a2ui-theme-toggle" id="a2ui-theme-toggle" type="button" aria-label="${escapeA2uiHtml(themeToggleTitle)}" title="${escapeA2uiHtml(themeToggleTitle)}" data-label-light="${escapeA2uiHtml(themeLightLabel)}" data-label-dark="${escapeA2uiHtml(themeDarkLabel)}">${escapeA2uiHtml(themeDarkLabel)}</button>
    <button class="a2ui-top-btn" id="a2ui-open-inspector" type="button">${escapeA2uiHtml(inspectorButtonLabel)}</button>
    <button class="a2ui-top-btn" id="a2ui-export-json" type="button">${escapeA2uiHtml(loc.ui.exportStateBtn)}</button>
  </div>
</header>

<main class="a2ui-root-Mount" id="a2ui-surface-root"></main>

<div class="a2ui-modal-backdrop" id="a2ui-inspector-modal" hidden>
  <div class="a2ui-modal-dialog">
    <div class="a2ui-modal-header">
      <strong>${escapeA2uiHtml(formatLocaleTemplate(loc.ui.inspectorTitle, { version: A2UI_PROTOCOL_VERSION }))}</strong>
      <button class="a2ui-btn" id="a2ui-close-inspector" type="button">${escapeA2uiHtml(loc.ui.closeBtn)}</button>
    </div>
    <div class="a2ui-modal-body">
      <pre class="a2ui-inspector-pre" id="a2ui-inspector-content"></pre>
    </div>
  </div>
</div>

<script>
window.A2UI_SURFACE_PAYLOAD = ${JSON.stringify(payload).replace(/<\//g, '<\\/')};
</script>
<script>
${A2UI_STUDIO_JS}
</script>
</body>
</html>
`;
  };

  const html = renderA2uiHtmlDocument(surfaceLang, stage2Norm.title, workspaceLocale, clientPayload);

  fs.mkdirSync(path.dirname(htmlOutputPath), { recursive: true });
  fs.writeFileSync(htmlOutputPath, html, 'utf-8');

  let bundleHtmlPath: string | undefined;
  let bundleVizPath: string | undefined;
  const shouldMirrorBundle =
    options.mirrorBundleHtml !== undefined ? options.mirrorBundleHtml : !options.outputDir;
  if (shouldMirrorBundle) {
    fs.mkdirSync(bundleRoot, { recursive: true });
    bundleHtmlPath = path.join(bundleRoot, 'a2ui.html');
    const bundleHtml = renderA2uiHtmlDocument(
      surfaceLang,
      stage2Norm.title,
      workspaceLocale,
      {
        ...clientPayload,
        mediaBaseMode: 'bundle',
        hostRunId: '',
        mediaUrisByRun: {},
      }
    );
    fs.writeFileSync(bundleHtmlPath, bundleHtml, 'utf-8');
    try {
      const vizResult = generateBundleVisualization(bundleRoot);
      bundleVizPath = vizResult.outputPath;
    } catch {
      // Non-fatal if bundle has no concepts yet
    }
  }

  // Also refresh sibling runs' a2ui.html and surface JSON/JSONL so every run has the full multi-run switcher and unified bundle graph
  if (shouldMirrorBundle && bundleRuns.length > 1) {
    for (const br of bundleRuns) {
      if (!br.runId || br.runId === activeRunKey || br.runId === 'workspace') continue;
      const siblingRunDir = path.join(runsRoot, br.runId);
      if (!fs.existsSync(siblingRunDir) || !hasStage1OrComplete(siblingRunDir)) continue;
      const siblingHtmlPath = path.join(siblingRunDir, 'a2ui.html');
      if (path.resolve(siblingHtmlPath) === path.resolve(htmlOutputPath)) continue;
      const siblingSurfaceId = `icm_${br.runId.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
      const siblingLang = String(br.dataModel?.meta?.lang || surfaceLang);
      const rIsAnalysis = br.dataModel?.meta?.domainMode === 'analysis';
      const brHasHighlights =
        Array.isArray(br.dataModel?.stage2?.highlights) && br.dataModel.stage2.highlights.length > 0;
      const siblingComponents = components.map((comp) => {
        if (comp.id === 'badge_status') {
          return { ...comp, tone: br.status === 'stable' ? 'success' : 'warn' };
        }
        if (comp.id === 'badge_trust') {
          return { ...comp, tone: br.trustTier === 'human-reviewed' ? 'accent' : 'primary' };
        }
        if (comp.id === 'badge_freshness') {
          return { ...comp, tone: br.isStale ? 'danger' : 'success' };
        }
        if (comp.id === 'tab_overview') {
          return {
            ...comp,
            children:
              !br.isStage1Only && brHasHighlights
                ? ['overview_narration_card', 'overview_highlights_card']
                : ['overview_narration_card'],
          };
        }
        if (comp.id === 'overview_highlights_title') {
          return {
            ...comp,
            text: rIsAnalysis
              ? workspaceLocale.ui.highlightsHeadingAnalysis
              : workspaceLocale.ui.highlightsHeadingCourse,
          };
        }
        if (comp.id === 'tab_modules') {
          return {
            ...comp,
            title: rIsAnalysis
              ? workspaceLocale.ui.modulesCardTitleAnalysis
              : workspaceLocale.ui.modulesCardTitleCourse,
          };
        }
        if (comp.id === 'tab_cases') {
          return {
            ...comp,
            title: rIsAnalysis
              ? workspaceLocale.ui.casesCardTitleAnalysis
              : workspaceLocale.ui.casesCardTitleCourse,
          };
        }
        if (comp.id === 'overview_narration_col') {
          return {
            ...comp,
            children: br.isStage1Only
              ? ['overview_narration_heading', 'overview_narration_body']
              : [
                  'overview_hero_image',
                  'overview_narration_heading',
                  'overview_tts_player',
                  'overview_narration_body',
                  'overview_flow_diagram',
                ],
          };
        }
        if (comp.id === 'main_tabs' && Array.isArray((comp as any).tabs)) {
          return {
            ...comp,
            tabs: Array.isArray(br.tabs) && br.tabs.length > 0
              ? br.tabs
              : (comp as any).tabs.map((t: { title: string; child: string }) => ({
                  ...t,
                  title: br.tabTitles?.[t.child] || t.title,
                })),
          };
        }
        return comp;
      });
      const siblingMessages: A2uiEnvelopeMessage[] = [
        {
          version: A2UI_PROTOCOL_VERSION,
          createSurface: {
            surfaceId: siblingSurfaceId,
            catalogId: A2UI_BASIC_CATALOG_ID,
            sendDataModel: true,
          },
        },
        {
          version: A2UI_PROTOCOL_VERSION,
          updateComponents: {
            surfaceId: siblingSurfaceId,
            components: siblingComponents,
          },
        },
        {
          version: A2UI_PROTOCOL_VERSION,
          updateDataModel: {
            surfaceId: siblingSurfaceId,
            path: '/',
            value: br.dataModel,
          },
        },
      ];
      const sibValidation = validateA2uiSurfaceMessages(siblingMessages);
      if (!sibValidation.valid) {
        throw new Error(
          `Invalid sibling A2UI v1.0 surface generated for ${br.runId}: ${sibValidation.errors.join('; ')}`
        );
      }
      const siblingStageSubDir = br.isStage1Only
        ? path.join('stages', '01_research', 'output')
        : path.join('stages', '02_script', 'output');
      const siblingStageOutDir = path.join(siblingRunDir, siblingStageSubDir);
      fs.mkdirSync(siblingStageOutDir, { recursive: true });
      const siblingSurfaceJsonDoc = {
        version: A2UI_PROTOCOL_VERSION,
        mimeType: A2UI_MIME_TYPE,
        surfaceId: siblingSurfaceId,
        catalogId: A2UI_BASIC_CATALOG_ID,
        domainCatalogId: A2UI_ICM_CATALOG_ID,
        catalogIds: [A2UI_BASIC_CATALOG_ID, A2UI_ICM_CATALOG_ID],
        catalogSchema: A2UI_ICM_CATALOG_SCHEMA,
        generatedAt: new Date().toISOString(),
        runId: br.runId,
        messages: siblingMessages,
      };
      const siblingSerializedJson = JSON.stringify(siblingSurfaceJsonDoc, null, 2);
      const siblingSerializedJsonl =
        siblingMessages.map((m) => JSON.stringify(m)).join('\n') + '\n';
      fs.writeFileSync(
        path.join(siblingStageOutDir, 'a2ui_surface.json'),
        siblingSerializedJson,
        'utf-8'
      );
      fs.writeFileSync(
        path.join(siblingStageOutDir, 'a2ui_surface.jsonl'),
        siblingSerializedJsonl,
        'utf-8'
      );
      fs.writeFileSync(
        path.join(siblingRunDir, 'a2ui_surface.json'),
        siblingSerializedJson,
        'utf-8'
      );
      fs.writeFileSync(
        path.join(siblingRunDir, 'a2ui_surface.jsonl'),
        siblingSerializedJsonl,
        'utf-8'
      );
      const siblingPingPongUrl = String(br.dataModel?.meta?.pingPongUrl || '');
      const siblingPayload = {
        surfaceId: siblingSurfaceId,
        catalogId: A2UI_BASIC_CATALOG_ID,
        domainCatalogId: A2UI_ICM_CATALOG_ID,
        ...(workspaceLocale.hasCustomFile ? { locale: workspaceLocale } : {}),
        ...(siblingPingPongUrl ? { pingPongUrl: siblingPingPongUrl } : {}),
        mediaBaseMode: 'run' as const,
        hostRunId: br.runId,
        messages: siblingMessages,
        bundleRuns,
        mediaUrisByRun: {},
        bundleGraph: clientPayload.bundleGraph,
      };
      const siblingHtml = renderA2uiHtmlDocument(
        siblingLang,
        br.title || stage2Norm.title,
        workspaceLocale,
        siblingPayload
      );
      fs.writeFileSync(siblingHtmlPath, siblingHtml, 'utf-8');
    }
  }

  const resolvedArtifactDir = (options.artifactDir || process.env.AGY_ARTIFACT_DIR || '').trim();
  let artifactHtmlContent: string | undefined;
  if (resolvedArtifactDir) {
    const maxArtifactAudioBytes =
      typeof options.maxArtifactAudioBytes === 'number' &&
      Number.isFinite(options.maxArtifactAudioBytes) &&
      options.maxArtifactAudioBytes >= 0
        ? options.maxArtifactAudioBytes
        : DEFAULT_MAX_ARTIFACT_AUDIO_BYTES;
    const artifactMediaUrisByRun: Record<string, Record<string, string>> = {};
    const allRunKeys = Array.from(runDiscoveredMedia.keys());
    const prioritizedRunKeys = [
      ...(runDiscoveredMedia.has(activeRunKey) ? [activeRunKey] : []),
      ...allRunKeys.filter((k) => k !== activeRunKey).reverse(),
    ];

    for (const rKey of prioritizedRunKeys) {
      const items = runDiscoveredMedia.get(rKey) || [];
      for (const item of items) {
        if (item.kind !== 'image') continue;
        try {
          const st = fs.statSync(item.fullPath);
          if (!st.isFile() || st.size <= 0 || st.size > 12 * 1024 * 1024) continue;
          const buf = fs.readFileSync(item.fullPath);
          if (buf.length > 0 && buf.length <= 12 * 1024 * 1024) {
            const det = detectMediaMimeAndExtension(buf, undefined, 'image');
            artifactMediaUrisByRun[rKey] = artifactMediaUrisByRun[rKey] || {};
            artifactMediaUrisByRun[rKey][item.relUrl] =
              `data:${det.mimeType};base64,${buf.toString('base64')}`;
          }
        } catch {
          // Keep unresolved fallback
        }
      }
    }

    let cumulativeAudioBytes = 0;
    for (const rKey of prioritizedRunKeys) {
      const items = runDiscoveredMedia.get(rKey) || [];
      for (const item of items) {
        if (item.kind !== 'audio') continue;
        try {
          const st = fs.statSync(item.fullPath);
          if (!st.isFile() || st.size <= 0 || st.size > 128 * 1024 * 1024) continue;
          if (st.size > maxArtifactAudioBytes || cumulativeAudioBytes + st.size > maxArtifactAudioBytes) {
            continue;
          }
          let buf: Buffer = fs.readFileSync(item.fullPath);
          if (buf.length <= 0 || buf.length > 128 * 1024 * 1024) continue;
          let det = detectMediaMimeAndExtension(buf, undefined, 'audio');
          if (
            buf.length >= 4 &&
            buf.subarray(0, 4).toString('ascii') !== 'RIFF' &&
            item.isRawPcm
          ) {
            buf = wrapPcm16InWavHeader(buf, 24000);
            det = { mimeType: 'audio/wav', ext: '.wav' };
          }
          if (
            buf.length <= 128 * 1024 * 1024 &&
            cumulativeAudioBytes + buf.length <= maxArtifactAudioBytes
          ) {
            artifactMediaUrisByRun[rKey] = artifactMediaUrisByRun[rKey] || {};
            artifactMediaUrisByRun[rKey][item.relUrl] =
              `data:${det.mimeType};base64,${buf.toString('base64')}`;
            cumulativeAudioBytes += buf.length;
          }
        } catch {
          // Keep unresolved fallback
        }
      }
    }

    artifactHtmlContent = renderA2uiHtmlDocument(
      surfaceLang,
      stage2Norm.title,
      workspaceLocale,
      {
        ...clientPayload,
        mediaBaseMode: 'artifact',
        hostRunId: activeRunKey,
        mediaUrisByRun: artifactMediaUrisByRun,
      }
    );
  }

  const artifactSynced = syncA2uiToArtifactDir({
    artifactDir: options.artifactDir,
    htmlOutputPath,
    htmlContent: artifactHtmlContent,
    bundleVizPath,
    runId: activeRunKey,
    title: stage2Norm.title,
    isStage1Only,
  });

  const shouldOpenBrowser =
    Boolean(options.openBrowser) ||
    process.argv.includes('--open') ||
    process.env.ICM_OPEN_A2UI === '1';
  const browserOpened = shouldOpenBrowser ? openFileInSystemBrowser(htmlOutputPath) : false;

  return {
    runId: resolvedRunId || 'workspace',
    surfaceId,
    catalogId: A2UI_BASIC_CATALOG_ID,
    isStage1Only,
    componentCount: components.length,
    tabCount: tabs.length,
    checklistItemCount: totalChecklistItems,
    moduleCount: stage2Norm.modules.length,
    quizCount: stage2Norm.quiz.length,
    caseCount: stage2Norm.cases.length,
    conceptCount: graphNodes.length,
    surfaceJsonPath,
    surfaceJsonlPath,
    htmlOutputPath,
    bundleHtmlPath,
    bundleVizPath,
    artifactHtmlPath: artifactSynced.artifactHtmlPath,
    artifactVizPath: artifactSynced.artifactVizPath,
    browserOpened,
    messages,
    bundleRuns,
  };
}
