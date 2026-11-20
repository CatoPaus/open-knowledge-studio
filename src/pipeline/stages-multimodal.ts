import * as fs from 'fs';
import * as path from 'path';

import { DEFAULT_ICM_LOCALE, type FlashTtsDialogueTurn, GEMINI_4_ARGON_MODEL, GEMINI_FLASH_TTS_MODEL, GEMINI_NANO_BANANA_MODEL, INTERACTIONS_API_URL, type InteractionUsageTelemetry, type IcmLocalePack, MAX_TTS_CHARS_PER_CALL, type ThinkingLevel, VOICES_API_URL, ensureWorkspaceLockedVoice, executeWithRetryAndFallback, generateFlashTtsAudioInteraction, generateNanoBananaImageInteraction, getPrebuiltStudioVoiceProfile, inferBcp47LanguageCode, isCustomVoiceId, isPrebuiltStudioVoiceName, loadStagePromptContract, loadWorkspaceLocale, normalizeBcp47Tag, parseWavMetadata, renderPromptTemplate } from '../interactions/index.js';
import { detectIcmDomainMode } from '../viz/index.js';
import { type NormalizedA2uiDialogueTurn, generateA2uiSurface, normalizeStage2ForA2ui } from '../a2ui/index.js';
import { loadWorkspaceLayers } from './layers.js';
import { runStage1Flow, runStage2Flow } from './stages-text.js';
import { prepareTextForStudioTts, resolveDownstreamRunId } from './prosody.js';

export interface Stage3VisualManifestItem {
  slotId: string;
  moduleNumber: number;
  title: string;
  caption: string;
  fileName: string;
  relativePath: string;
  mimeType: string;
  bytes: number;
  aspectRatio: string;
  imageSize: string;
}

/**
 * 2b. Optional Phase 4 Stage 3 Visual Synthesis Runner (`prompts/03_visuals.md` -> `gemini-nano-banana-2.1`).
 * Generates `overview` + `module_XX` illustrations in `stages/03_visuals/output/` with true binary
 * MIME/extension fidelity (`.jpg` / `.png` / `.webp`), writes `visuals_manifest.json` + `thinking_trace.md`,
 * updates `meta.stage3Telemetry`, and automatically hydrates `a2ui.html` & `a2ui_studio.html`.
 */
export async function runStage3Flow(input: {
  workspaceRoot: string;
  runId?: string;
  promptName?: string;
  promptDir?: string;
  concurrency?: number;
  dryRun?: boolean;
  artifactDir?: string;
  openBrowser?: boolean;
}): Promise<{
  success: boolean;
  runId: string;
  outputDir: string;
  slotCount: number;
  manifestPath?: string;
  a2uiHtmlPath?: string;
  artifactHtmlPath?: string;
  items: Stage3VisualManifestItem[];
  usage: InteractionUsageTelemetry;
  dryRun?: boolean;
}> {
  const workspacePath = path.resolve(input.workspaceRoot || './workspace');
  const resolvedRunId = resolveDownstreamRunId(workspacePath, input.runId);
  const runDir = path.join(workspacePath, 'runs', resolvedRunId);
  const stage2Path = path.join(runDir, 'stages', '02_script', 'output', 'script_draft.json');
  if (!fs.existsSync(stage2Path)) {
    throw new Error(
      `Stage 2 artifact not found at ${stage2Path}. Run 'npm run cli:stage2 -- ${resolvedRunId}' before Stage 3.`
    );
  }

  const promptName = input.promptName || '03_visuals';
  const contract = loadStagePromptContract(promptName, input.promptDir || './prompts');
  const resolvedModel = contract.model || GEMINI_NANO_BANANA_MODEL;
  const aspectRatio = contract.aspectRatio || '16:9';
  const imageSize = contract.imageSize || '1K';
  const concurrency = Math.max(1, Math.min(4, input.concurrency ?? 2));

  const workspaceLocale = loadWorkspaceLocale(workspacePath);
  const rawStage2 = JSON.parse(fs.readFileSync(stage2Path, 'utf-8')) as Record<string, unknown>;
  const stage2Norm = normalizeStage2ForA2ui(rawStage2, resolvedRunId, workspaceLocale);
  const isAnalysis = detectIcmDomainMode(rawStage2, stage2Norm.quiz.length, stage2Norm.title) === 'analysis';
  const { globalIdentity, workspaceContext, toneGuide } = loadWorkspaceLayers(workspacePath);

  interface VisualSlotSpec {
    slotId: string;
    moduleNumber: number;
    itemTitle: string;
    subtitleOrBasis: string;
    sceneFocus: string;
    narration: string;
    slideCues: string;
    actionItem: string;
    caption: string;
    promptText: string;
  }

  const overviewFocus =
    stage2Norm.overviewVisualPrompt ||
    [stage2Norm.subtitle, ...stage2Norm.highlights.slice(0, 3)].filter(Boolean).join(' — ') ||
    stage2Norm.scriptBody.slice(0, 360);
  const overviewSlideCues = stage2Norm.highlights
    .slice(0, 4)
    .map((h) => `- ${h}`)
    .join('\n');

  const rawSlots: Omit<VisualSlotSpec, 'promptText'>[] = [
    {
      slotId: 'overview',
      moduleNumber: 0,
      itemTitle: stage2Norm.title,
      subtitleOrBasis: stage2Norm.subtitle,
      sceneFocus: overviewFocus,
      narration: stage2Norm.scriptBody.slice(0, 600),
      slideCues: overviewSlideCues,
      actionItem: '',
      caption: stage2Norm.title,
    },
    ...stage2Norm.modules.map((mod, idx) => {
      const slotNum = idx + 1;
      const slotId = `module_${String(slotNum).padStart(2, '0')}`;
      const modFocus =
        mod.visualPrompt ||
        [mod.subtitleOrBasis, ...mod.bullets.slice(0, 3), mod.actionItem]
          .filter(Boolean)
          .join(' — ') ||
        mod.narration.slice(0, 360);
      const modCues = mod.bullets.map((b) => `- ${b}`).join('\n');
      const itemPrefix = isAnalysis
        ? workspaceLocale.ui.pillarPrefix
        : workspaceLocale.ui.modulePrefix;
      return {
        slotId,
        moduleNumber: mod.number || slotNum,
        itemTitle: mod.title,
        subtitleOrBasis: mod.subtitleOrBasis,
        sceneFocus: modFocus,
        narration: mod.narration.slice(0, 600),
        slideCues: modCues,
        actionItem: mod.actionItem,
        caption: `${itemPrefix} ${mod.number || slotNum}: ${mod.title}`,
      };
    }),
  ];

  const slots: VisualSlotSpec[] = rawSlots.map((slot) => {
    const fallbackTemplate = [
      'Generate a clean, professional editorial illustration without embedded text labels.',
      'Course / Deliverable: {{courseTitle}}',
      'Slot: {{visualSlot}} — {{itemTitle}}',
      '{{#if sceneFocus}}Scene & Visual Focus: {{sceneFocus}}{{/if}}',
      '{{#if slideCues}}Key Visual Elements:\n{{slideCues}}{{/if}}',
      '{{#if actionItem}}Practical Action Context: {{actionItem}}{{/if}}',
    ].join('\n\n');
    const promptText = renderPromptTemplate(contract.template || fallbackTemplate, {
      courseTitle: stage2Norm.title,
      title: stage2Norm.title,
      subtitle: stage2Norm.subtitle,
      visualSlot: slot.slotId,
      slotId: slot.slotId,
      slotKind: slot.slotId === 'overview' ? 'overview' : 'module',
      moduleNumber: String(slot.moduleNumber),
      slotTitle: slot.itemTitle,
      itemTitle: slot.itemTitle,
      moduleTitle: slot.itemTitle,
      subtitleOrBasis: slot.subtitleOrBasis,
      visualPrompt: slot.sceneFocus,
      sceneFocus: slot.sceneFocus,
      visualBrief: slot.sceneFocus,
      narration: slot.narration,
      slideCues: slot.slideCues,
      bullets: slot.slideCues,
      actionItem: slot.actionItem,
      targetAudience: stage2Norm.targetAudience,
      voiceGuide: toneGuide,
      globalIdentity,
      workspaceContext,
    });
    return { ...slot, promptText };
  });

  const stage3Dir = path.join(runDir, 'stages', '03_visuals');
  const stage3OutDir = path.join(stage3Dir, 'output');
  const stage3InputPath = path.join(stage3Dir, 'input', 'prompt_assembled.md');
  fs.mkdirSync(path.dirname(stage3InputPath), { recursive: true });
  fs.mkdirSync(stage3OutDir, { recursive: true });

  const assembledDoc = [
    '---',
    `stage: 03_visuals`,
    `model: ${resolvedModel}`,
    `outputFormat: image`,
    `aspectRatio: "${aspectRatio}"`,
    `imageSize: "${imageSize}"`,
    `slotCount: ${slots.length}`,
    `assembledAt: ${new Date().toISOString()}`,
    '---',
    '',
    ...slots.flatMap((s) => [
      `## Slot: \`${s.slotId}\` — ${s.itemTitle}`,
      '',
      s.promptText,
      '',
      '---',
      '',
    ]),
  ].join('\n');
  fs.writeFileSync(stage3InputPath, assembledDoc, 'utf-8');

  console.log(
    `--- Executing Stage 3: Visual Synthesis for Run: ${resolvedRunId} [model: ${resolvedModel}, aspectRatio: ${aspectRatio}, imageSize: ${imageSize}, slots: ${slots.length}${input.dryRun ? ', DRY-RUN' : ''}] ---`
  );

  if (input.dryRun) {
    const metaPath = path.join(runDir, 'meta.json');
    try {
      const meta: Record<string, any> = fs.existsSync(metaPath)
        ? JSON.parse(fs.readFileSync(metaPath, 'utf-8'))
        : { runId: resolvedRunId, createdAt: new Date().toISOString() };
      meta.stage3DryRun = {
        model: resolvedModel,
        aspectRatio,
        imageSize,
        slotCount: slots.length,
        assembledInputPath: stage3InputPath,
      };
      fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2), 'utf-8');
    } catch {
      // Ignore metadata update errors
    }
    const sampleBody = {
      model: resolvedModel,
      input: [
        {
          type: 'user_input',
          content: [
            {
              type: 'text',
              text: `[Slot 1/${slots.length} (${slots[0]?.slotId}): ${slots[0]?.promptText.length || 0} chars -> ${stage3InputPath}]`,
            },
          ],
        },
      ],
      response_format: {
        type: 'image',
        aspect_ratio: aspectRatio,
        image_size: imageSize,
      },
      store: false,
    };
    console.log(`[DRY-RUN] Stage: 03_visuals (${slots.length} image slot(s))`);
    console.log(`[DRY-RUN] Assembled Stage 3 Prompts written to: ${stage3InputPath}`);
    console.log(`[DRY-RUN] Would send ${slots.length}x POST ${INTERACTIONS_API_URL}`);
    console.log(`[DRY-RUN] Sample Body:\n${JSON.stringify(sampleBody, null, 2)}`);
    console.log(`[DRY-RUN] Network calls skipped. Zero tokens spent.`);
    return {
      success: true,
      runId: resolvedRunId,
      outputDir: stage3OutDir,
      slotCount: slots.length,
      items: [],
      usage: { inputTokens: 0, thoughtsTokens: 0, outputTokens: 0, totalTokens: 0 },
      dryRun: true,
    };
  }

  const startTimeMs = Date.now();
  const resultsByIdx: Array<{
    item: Stage3VisualManifestItem;
    thoughts: string[];
    usage: InteractionUsageTelemetry;
  }> = new Array(slots.length);

  let nextIdx = 0;
  const worker = async () => {
    while (true) {
      const idx = nextIdx++;
      if (idx >= slots.length) break;
      const slot = slots[idx];
      console.log(
        `[Stage 3 Visual ${idx + 1}/${slots.length}]: Generating ${slot.slotId} ("${slot.itemTitle}")...`
      );
      const imgRes = await generateNanoBananaImageInteraction({
        promptText: slot.promptText,
        model: resolvedModel,
        aspectRatio,
        imageSize,
      });

      // Remove any stale sibling image files for the same slot (e.g. `.png` vs `.jpg`)
      for (const oldExt of ['.jpg', '.jpeg', '.png', '.webp', '.gif']) {
        const oldPath = path.join(stage3OutDir, `${slot.slotId}${oldExt}`);
        if (oldExt !== imgRes.ext && fs.existsSync(oldPath)) {
          try {
            fs.unlinkSync(oldPath);
          } catch {
            // Ignore cleanup errors
          }
        }
      }

      const fileName = `${slot.slotId}${imgRes.ext}`;
      const outPath = path.join(stage3OutDir, fileName);
      fs.writeFileSync(outPath, imgRes.imageBuffer);
      console.log(
        `[Stage 3 Visual ${idx + 1}/${slots.length}]: Saved ${fileName} (${imgRes.mimeType}, ${(imgRes.imageBuffer.length / 1024).toFixed(1)} KB, ${imgRes.usage.totalTokens} tokens)`
      );

      resultsByIdx[idx] = {
        item: {
          slotId: slot.slotId,
          moduleNumber: slot.moduleNumber,
          title: slot.itemTitle,
          caption: slot.caption,
          fileName,
          relativePath: `./stages/03_visuals/output/${fileName}`,
          mimeType: imgRes.mimeType,
          bytes: imgRes.imageBuffer.length,
          aspectRatio,
          imageSize,
        },
        thoughts: imgRes.thoughts.map((t) => `[${slot.slotId}] ${t}`),
        usage: imgRes.usage,
      };
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(concurrency, slots.length) }, () => worker())
  );

  const items = resultsByIdx.map((r) => r.item);
  const allThoughts = resultsByIdx.flatMap((r) => r.thoughts);
  const aggUsage: InteractionUsageTelemetry = resultsByIdx.reduce(
    (acc, r) => ({
      inputTokens: acc.inputTokens + r.usage.inputTokens,
      thoughtsTokens: acc.thoughtsTokens + r.usage.thoughtsTokens,
      outputTokens: acc.outputTokens + r.usage.outputTokens,
      totalTokens: acc.totalTokens + r.usage.totalTokens,
    }),
    { inputTokens: 0, thoughtsTokens: 0, outputTokens: 0, totalTokens: 0 }
  );
  const durationMs = Date.now() - startTimeMs;

  const manifestPath = path.join(stage3OutDir, 'visuals_manifest.json');
  fs.writeFileSync(
    manifestPath,
    JSON.stringify(
      {
        stage: '03_visuals',
        runId: resolvedRunId,
        model: resolvedModel,
        aspectRatio,
        imageSize,
        generatedAt: new Date().toISOString(),
        items,
      },
      null,
      2
    ),
    'utf-8'
  );

  const traceLines: string[] = [
    `# 03_visuals — Multimodal Image Synthesis Trace`,
    '',
    `- **Model:** \`${resolvedModel}\``,
    `- **Aspect Ratio / Size:** \`${aspectRatio}\` @ \`${imageSize}\``,
    `- **Generated Assets:** ${items.length} (${items.map((it) => `\`${it.fileName}\``).join(', ')})`,
    `- **Duration:** ${(durationMs / 1000).toFixed(1)}s`,
    `- **Input Tokens:** ${aggUsage.inputTokens}`,
    `- **Thinking Tokens:** ${aggUsage.thoughtsTokens}`,
    `- **Output Tokens:** ${aggUsage.outputTokens}`,
    `- **Total Tokens:** ${aggUsage.totalTokens}`,
    '',
    `## Reasoning Steps (${allThoughts.length})`,
    '',
    ...(allThoughts.length > 0
      ? allThoughts.flatMap((t, idx) => [`### Step ${idx + 1}`, t, ''])
      : ['_No reasoning summary steps emitted._']),
  ];
  fs.writeFileSync(path.join(stage3OutDir, 'thinking_trace.md'), traceLines.join('\n'), 'utf-8');

  const metaPath = path.join(runDir, 'meta.json');
  try {
    const meta: Record<string, any> = fs.existsSync(metaPath)
      ? JSON.parse(fs.readFileSync(metaPath, 'utf-8'))
      : { runId: resolvedRunId, createdAt: new Date().toISOString() };
    meta.stage3Telemetry = {
      model: resolvedModel,
      aspectRatio,
      imageSize,
      imageCount: items.length,
      files: items.map((it) => it.fileName),
      inputTokens: aggUsage.inputTokens,
      thoughtsTokens: aggUsage.thoughtsTokens,
      outputTokens: aggUsage.outputTokens,
      totalTokens: aggUsage.totalTokens,
      durationMs,
    };
    fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2), 'utf-8');
  } catch {
    // Ignore meta update errors
  }

  console.log(
    `[Stage 3 Telemetry]: images=${items.length}, input=${aggUsage.inputTokens}, thoughts=${aggUsage.thoughtsTokens}, output=${aggUsage.outputTokens}, total=${aggUsage.totalTokens} tokens (${(durationMs / 1000).toFixed(1)}s)`
  );

  let a2uiHtmlPath: string | undefined;
  let artifactHtmlPath: string | undefined;
  try {
    const a2uiRes = generateA2uiSurface(resolvedRunId, {
      workspaceRoot: workspacePath,
      artifactDir: input.artifactDir,
      openBrowser: input.openBrowser,
    });
    a2uiHtmlPath = a2uiRes.htmlOutputPath;
    artifactHtmlPath = a2uiRes.artifactHtmlPath;
    console.log(
      `[Stage 3 A2UI Studio Hydrated]: ${a2uiRes.htmlOutputPath}${a2uiRes.artifactHtmlPath ? ` (artifact: ${a2uiRes.artifactHtmlPath})` : ''}`
    );
  } catch (err: any) {
    console.warn(`[Stage 3 A2UI Warning]: ${err?.message || String(err)}`);
  }

  return {
    success: true,
    runId: resolvedRunId,
    outputDir: stage3OutDir,
    slotCount: slots.length,
    manifestPath,
    ...(a2uiHtmlPath ? { a2uiHtmlPath } : {}),
    ...(artifactHtmlPath ? { artifactHtmlPath } : {}),
    items,
    usage: aggUsage,
  };
}

export interface Stage4AudioManifestItem {
  slotId: string;
  moduleNumber: number;
  title: string;
  voice: string;
  voicesUsed?: string[];
  lockedVoicesUsed?: string[];
  languageCode?: string;
  turnCount?: number;
  durationSeconds?: number;
  fileName: string;
  relativePath: string;
  mimeType: string;
  bytes: number;
  charCount: number;
}

/**
 * Normalizes an explicit BCP-47 speech language tag (e.g. `nb-no` -> `nb-NO`) or auto-infers
 * the BCP-47 language tag from Stage 2 prose across world scripts and languages.
 */
export function resolveStage4LanguageCode(
  explicitCode?: string,
  textOrDetectedLang?: string
): string {
  const raw = String(explicitCode || '').trim();
  if (raw) {
    return normalizeBcp47Tag(raw);
  }
  return inferBcp47LanguageCode(textOrDetectedLang);
}

/**
 * Builds a concise, domain-neutral 1-sentence `/v1beta/voices` Voice Design prompt that anchors
 * a studio narrator to a single standard regional accent/dialect across podcasts, analytical
 * briefings, courses, and reports when `voiceDesignPrompt` is omitted.
 */
export function buildDefaultVoiceLockPrompt(baseVoice: string, languageCode: string): string {
  const norm = languageCode.trim().toLowerCase();
  const dialectMap: Record<string, string> = {
    'nb-no': 'standard Urban East Norwegian (Bokmål, Oslo rolled-r)',
    'no-no': 'standard Urban East Norwegian (Bokmål, Oslo rolled-r)',
    no: 'standard Urban East Norwegian (Bokmål, Oslo rolled-r)',
    nb: 'standard Urban East Norwegian (Bokmål, Oslo rolled-r)',
    'nn-no': 'standard Norwegian Nynorsk',
    nn: 'standard Norwegian Nynorsk',
    'sv-se': 'standard Central Swedish',
    'da-dk': 'standard Copenhagen Danish',
    'fi-fi': 'standard Helsinki Finnish',
    'is-is': 'standard Reykjavík Icelandic',
    'de-de': 'standard High German',
    'de-at': 'standard Austrian German',
    'de-ch': 'standard Swiss High German',
    'fr-fr': 'standard Metropolitan French',
    'fr-ca': 'standard Canadian French',
    'es-es': 'standard Castilian Spanish',
    'es-mx': 'standard Mexican Spanish',
    'es-419': 'standard Latin American Spanish',
    'pt-br': 'standard Brazilian Portuguese',
    'pt-pt': 'standard European Portuguese',
    'it-it': 'standard Italian',
    'nl-nl': 'standard Netherlandic Dutch',
    'pl-pl': 'standard Polish',
    'ja-jp': 'standard Tokyo Japanese',
    'ko-kr': 'standard Seoul Korean',
    'zh-cn': 'standard Mandarin Chinese',
    'zh-tw': 'standard Taiwanese Mandarin',
    'ar-sa': 'Modern Standard Arabic',
    'hi-in': 'standard Hindi',
    'uk-ua': 'standard Ukrainian',
    'ru-ru': 'standard Russian',
    'el-gr': 'standard Modern Greek',
    'he-il': 'standard Modern Hebrew',
    'th-th': 'standard Central Thai',
    'en-gb': 'standard Southern British English',
    'en-au': 'standard Australian English',
    'en-ca': 'standard Canadian English',
    'en-in': 'standard Indian English',
    'en-us': 'standard General American English',
  };
  const accentDesc = dialectMap[norm] || `consistent standard ${languageCode} regional`;
  if (/^en(?:-|$)/.test(norm)) {
    return `Preserve the natural studio timbre, pitch, and warmth of ${baseVoice} with a single ${accentDesc} accent and steady, natural studio delivery.`;
  }
  const profile = getPrebuiltStudioVoiceProfile(baseVoice);
  const genderWord =
    profile?.gender === 'male' ? 'male' : profile?.gender === 'female' ? 'female' : 'adult';
  const possWord =
    profile?.gender === 'male' ? 'his' : profile?.gender === 'female' ? 'her' : 'their';
  const isAuth = profile?.archetype === 'authoritative';
  const toneDesc = isAuth ? 'calm, authoritative, and articulate' : 'warm, clear, and reassuring';
  const ageDesc = isAuth ? '40s' : '30s';
  return `A ${toneDesc} ${genderWord} studio narrator in ${possWord} ${ageDesc} speaking clear ${accentDesc} at a steady, natural broadcast pace without hesitation.`;
}

/**
 * Resolves the optimal Voice Design prompt for Stage 4:
 * - For English locales (`en*`), uses any explicit `voiceDesignPrompt` or `buildDefaultVoiceLockPrompt()`.
 * - For non-English locales (`nb-NO`, `de-DE`, `fr-FR`, `ja-JP`, etc.), preserves custom prompts
 *   already written in the target language, while upgrading generic English `base_voice` remix prompts
 *   (e.g. `"Preserve Charon's..."`) or omitted prompts to Layer 3 `locale.prosody.voicePersonas`
 *   when available so `CreateVoice` synthesizes `sample_audio` natively in the target language.
 */
export function resolveStage4VoiceDesignPrompt(options: {
  baseVoice: string;
  languageCode: string;
  speakerRole?: 'guide' | 'specialist';
  explicitPrompt?: string;
  locale?: IcmLocalePack;
}): string | undefined {
  const { baseVoice, languageCode, speakerRole, explicitPrompt, locale } = options;
  const trimmedExplicit = String(explicitPrompt || '').trim();
  const isNonEnglish = !/^en(?:-|$)/i.test(languageCode.trim());
  const profile = getPrebuiltStudioVoiceProfile(baseVoice);
  const isMale = profile?.gender === 'male';
  const isSpecialist =
    speakerRole === 'specialist' || (!speakerRole && profile?.archetype === 'authoritative');

  const hasNativeLocalePersonas =
    Boolean(locale) &&
    !/^en(?:-|$)/i.test(String(locale?.bcp47 || '')) &&
    Boolean(locale?.prosody?.voicePersonas) &&
    locale!.prosody.voicePersonas.warmGuideFemale !==
      DEFAULT_ICM_LOCALE.prosody.voicePersonas.warmGuideFemale;

  if (trimmedExplicit) {
    if (!isNonEnglish) return trimmedExplicit;
    const isEnglishBaseVoiceRemix =
      /\bpreserve\b/i.test(trimmedExplicit) ||
      inferBcp47LanguageCode(trimmedExplicit).toLowerCase().startsWith('en');
    if (!isEnglishBaseVoiceRemix) {
      return trimmedExplicit;
    }
    if (hasNativeLocalePersonas && locale) {
      const vp = locale.prosody.voicePersonas;
      if (isSpecialist) return isMale ? vp.calmSpecialistMale : vp.calmSpecialistFemale;
      return isMale ? vp.warmGuideMale : vp.warmGuideFemale;
    }
    return buildDefaultVoiceLockPrompt(baseVoice, languageCode);
  }

  if (hasNativeLocalePersonas && locale && isNonEnglish) {
    const vp = locale.prosody.voicePersonas;
    if (isSpecialist) return isMale ? vp.calmSpecialistMale : vp.calmSpecialistFemale;
    return isMale ? vp.warmGuideMale : vp.warmGuideFemale;
  }

  return buildDefaultVoiceLockPrompt(baseVoice, languageCode);
}

/**
 * Sanitizes `speech_metadata.style` per Gemini 3.8 TTS best practices:
 * strips Markdown headings/bullets (such as accidentally injected `voice_guide.md` blocks),
 * removes per-slot title lead-ins (`Deliver "..." (...) in `), and caps length to a concise,
 * constant turn-delivery cue (`<= 140` chars) so long style blocks never trigger dialect or speaker drift.
 */
export function sanitizeTtsStyleInstruction(rawStyle?: string): string {
  if (!rawStyle) return '';
  const keptLines = rawStyle
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(
      (line) =>
        Boolean(line) &&
        !/^#+(\s|$)/.test(line) &&
        !/^[-*+]\s+/.test(line) &&
        !/^\d+\.\s+/.test(line) &&
        !/^>\s*/.test(line)
    );
  if (keptLines.length === 0) return '';

  let cleaned = keptLines
    .join(' ')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(
      /^deliver\s+(?:["'«][^"'»]*["'»]\s*)?(?:\([^)]*\)\s*)?(?:in\s+(?:a|an)\s+|in\s+)/i,
      ''
    )
    .replace(/\b(?:do not|never)\s+switch\s+speaker[^.;]*/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (cleaned.length > 140) {
    const firstSentence = cleaned.match(/^(.{20,140}?[.!?])(?:\s|$)/);
    if (firstSentence) {
      cleaned = firstSentence[1].trim();
    } else {
      const cut = cleaned.slice(0, 140);
      const lastSpace = cut.lastIndexOf(' ');
      cleaned = (lastSpace > 60 ? cut.slice(0, lastSpace) : cut).replace(/[,;:\s]+$/, '').trim();
    }
  }
  return cleaned;
}

export interface Stage4SpeechBlock {
  kind: 'narration' | 'actionItem';
  text: string;
}

/**
 * Splits a Stage 2 slot's normalized spoken text (plus optional module `actionItem`) into clean
 * paragraph-level speech blocks without rewriting or altering a single word of verified Stage 2 prose.
 */
export function extractStage4SpeechBlocks(options: {
  slotKind: 'overview' | 'module';
  spokenText: string;
  actionItem?: string;
  lang?: string;
  workspaceRoot?: string;
}): Stage4SpeechBlock[] {
  const { slotKind, spokenText, actionItem, lang, workspaceRoot } = options;
  const normalizedBody = prepareTextForStudioTts(spokenText, lang, workspaceRoot);
  if (!normalizedBody) return [];

  const rawParagraphs = normalizedBody
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  // Merge tiny heading/lead-in fragments (< 65 chars) into the following paragraph
  const paragraphs: string[] = [];
  for (let i = 0; i < rawParagraphs.length; i++) {
    const cur = rawParagraphs[i];
    if (cur.length < 65 && i + 1 < rawParagraphs.length) {
      rawParagraphs[i + 1] = `${/[.!?]$/.test(cur) ? cur : `${cur}.`} ${rawParagraphs[i + 1]}`;
    } else if (cur.length < 65 && paragraphs.length > 0) {
      paragraphs[paragraphs.length - 1] = `${paragraphs[paragraphs.length - 1]} ${cur}`;
    } else {
      paragraphs.push(cur);
    }
  }

  const cleanAction =
    slotKind === 'module' && actionItem
      ? prepareTextForStudioTts(actionItem, lang, workspaceRoot)
      : '';
  const shouldAppendAction =
    Boolean(cleanAction) &&
    !normalizedBody
      .toLowerCase()
      .includes(cleanAction.slice(0, Math.min(40, cleanAction.length)).toLowerCase());

  const blocks: Stage4SpeechBlock[] = [];
  if (paragraphs.length === 1) {
    const sentences = paragraphs[0]
      .split(/(?<=[.!?])\s+(?=[\p{Lu}"“'(\[0-9])/u)
      .map((s) => s.trim())
      .filter(Boolean);
    if (sentences.length >= 4 || (!shouldAppendAction && sentences.length >= 2)) {
      const mid = Math.ceil(sentences.length / 2);
      blocks.push({ kind: 'narration', text: sentences.slice(0, mid).join(' ') });
      blocks.push({ kind: 'narration', text: sentences.slice(mid).join(' ') });
    } else {
      blocks.push({ kind: 'narration', text: paragraphs[0] });
    }
  } else {
    for (const p of paragraphs) {
      blocks.push({ kind: 'narration', text: p });
    }
  }

  if (shouldAppendAction) {
    blocks.push({ kind: 'actionItem', text: cleanAction });
  }
  return blocks;
}

/**
 * Zero-token multilingual register classifier used for `--dry-run` previews and as a deterministic
 * fallback when semantic dual-voice routing is active: assigns practical/pedagogical/contextual
 * blocks to `'primary'` and high-stakes statutory, safety, clinical, financial, or risk blocks to `'secondary'`.
 */
export function classifyBlockRegisterHeuristic(
  blockText: string,
  blockKind: 'narration' | 'actionItem' = 'narration'
): 'primary' | 'secondary' {
  if (blockKind === 'actionItem') return 'primary';
  const s = String(blockText || '');
  let gravityScore = 0;

  // Statutory / regulatory / standards citations across languages
  const statutoryHits =
    s.match(
      /(?:§|\b(?:section|sections|article|clause|cfr|usc|iso|iec|nfpa|osha|gdpr|nis2|dora|gesetz\w*|verordnung\w*|règlement|reglamento|decreto)\b)/gi
    ) || [];
  gravityScore += Math.min(4, statutoryHits.length * 2);

  // Binding duties, legal liability, audit/supervision, and non-compliance markers
  const obligationHits =
    s.match(
      /\b(?:mandatory|obligat\w*|prohibit\w*|liabilit\w*|penalt\w*|sanction\w*|violat\w*|non-compliance|statutory|verpflicht\w*|haftung|bußgeld|interdit)\b/gi
    ) || [];
  gravityScore += Math.min(4, obligationHits.length);

  // Life-safety, clinical, engineering, or financial hazard/crisis markers
  const hazardHits =
    s.match(
      /\b(?:evacuat\w*|hazard\w*|emergency|fatal\w*|toxic\w*|flammab\w*|smoke|alarm\w*|critical|catastroph\w*|insolven\w*|default|breach|contraindicat\w*|overdose)\b/gi
    ) || [];
  gravityScore += Math.min(3, hazardHits.length);

  if (/[≤≥]/.test(s)) gravityScore += 1;

  return gravityScore >= 3 ? 'secondary' : 'primary';
}

/**
 * Merges consecutive turns spoken by the exact same speaker, voice, and style while staying
 * within `maxMergedChars` (`<= 950` chars by default) so short adjacent paragraphs flow in one
 * breath without ever approaching `gemini-3.8-flash-tts`'s ~140s server context-buffer rollover.
 */
export function mergeConsecutiveSpeakerTurns(
  turns: FlashTtsDialogueTurn[],
  maxMergedChars: number = MAX_TTS_CHARS_PER_CALL
): FlashTtsDialogueTurn[] {
  const merged: FlashTtsDialogueTurn[] = [];
  for (const t of turns) {
    const prev = merged[merged.length - 1];
    if (
      prev &&
      prev.speaker === t.speaker &&
      prev.voice === t.voice &&
      (prev.style || '') === (t.style || '') &&
      prev.text.length + 2 + t.text.length <= maxMergedChars
    ) {
      prev.text = `${prev.text}\n\n${t.text}`;
    } else {
      merged.push({ ...t });
    }
  }
  return merged;
}

/**
 * Runs a single lightweight `gemini-4-argon` (`thinkingLevel: LOW`) Voice Register Director pass
 * across all Stage 4 slots to assign each paragraph block to `'primary'` (e.g., Warm Educator / Guide)
 * or `'secondary'` (e.g., Serious Regulatory / Safety / Risk Specialist) based purely on content gravity,
 * without modifying a single word of verified Stage 2 prose.
 */
export async function directSemanticDualVoiceAssignment(options: {
  courseTitle: string;
  primarySpeaker: string;
  primaryRole: string;
  secondarySpeaker: string;
  secondaryRole: string;
  slots: Array<{
    slotId: string;
    slotKind: 'overview' | 'module';
    title: string;
    blocks: Stage4SpeechBlock[];
  }>;
}): Promise<{
  assignmentsBySlot: Map<string, Array<{ speakerRole: 'primary' | 'secondary'; rationale: string }>>;
  thoughts: string[];
  usage: InteractionUsageTelemetry;
}> {
  const promptLines: string[] = [
    `You are an audio Voice Register Director for "${options.courseTitle}".`,
    `Assign each numbered spoken block in each slot to either "primary" or "secondary" based strictly on content register and gravity:`,
    `- "primary" (${options.primarySpeaker}): ${options.primaryRole}`,
    `- "secondary" (${options.secondarySpeaker}): ${options.secondaryRole}`,
    '',
    'DIRECTING RULES:',
    '1. Do NOT alternate mechanically (A, B, A, B). Keep consecutive blocks on the same speaker whenever their register stays the same.',
    '2. Assign "primary" to introductions, relatable everyday scenarios, pedagogical explanations, practical routines, and actionItem wrap-ups.',
    '3. Assign "secondary" specifically when the text shifts to serious/high-stakes material: binding statutory or regulatory mandates, legal liability, technical safety/compliance thresholds, critical hazards, emergency/evacuation procedures, or severe risk warnings.',
    '4. Purely introductory or purely practical slots may use "primary" throughout, while across the full multi-slot program both "primary" and "secondary" should appear naturally wherever serious/normative blocks occur.',
    '5. Return exact blockIndex coverage for every slot in JSON.',
    '',
    'SLOTS TO DIRECT:',
    JSON.stringify(
      options.slots.map((s) => ({
        slotId: s.slotId,
        slotKind: s.slotKind,
        title: s.title,
        blocks: s.blocks.map((b, idx) => ({
          blockIndex: idx,
          kind: b.kind,
          text: b.text,
        })),
      })),
      null,
      2
    ),
  ];

  const outputJsonSchema = {
    type: 'object',
    properties: {
      slots: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            slotId: { type: 'string' },
            blocks: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  blockIndex: { type: 'integer' },
                  speakerRole: { type: 'string', enum: ['primary', 'secondary'] },
                  rationale: { type: 'string' },
                },
                required: ['blockIndex', 'speakerRole', 'rationale'],
              },
            },
          },
          required: ['slotId', 'blocks'],
        },
      },
    },
    required: ['slots'],
  };

  const { result } = await executeWithRetryAndFallback(
    {
      promptText: promptLines.join('\n'),
      thinkingLevel: 'LOW',
      maxOutputTokens: 8192,
      includeThoughts: true,
      outputFormat: 'json',
      outputJsonSchema,
      store: false,
    },
    1
  );

  const parsed = JSON.parse(result.text) as {
    slots?: Array<{
      slotId: string;
      blocks?: Array<{ blockIndex: number; speakerRole: string; rationale?: string }>;
    }>;
  };
  const assignmentsBySlot = new Map<
    string,
    Array<{ speakerRole: 'primary' | 'secondary'; rationale: string }>
  >();

  for (const slotSpec of options.slots) {
    const matched = parsed?.slots?.find((s) => s?.slotId === slotSpec.slotId);
    const mappedBlocks = slotSpec.blocks.map((b, idx) => {
      const entry = matched?.blocks?.find((eb) => Number(eb?.blockIndex) === idx);
      const role: 'primary' | 'secondary' =
        entry?.speakerRole === 'secondary'
          ? 'secondary'
          : entry?.speakerRole === 'primary'
            ? 'primary'
            : classifyBlockRegisterHeuristic(b.text, b.kind);
      return {
        speakerRole: role,
        rationale: String(entry?.rationale || '').trim() || 'Heuristic register fallback',
      };
    });
    assignmentsBySlot.set(slotSpec.slotId, mappedBlocks);
  }

  return {
    assignmentsBySlot,
    thoughts: result.thoughts,
    usage: result.usage,
  };
}

/**
 * Domain-neutral multi-speaker turn segmentation for Stage 4 (`04_audio`).
 * Honors explicit Stage 2 `dialogueTurns` when present, supports semantic register-matched routing
 * (`dialogueMode: 'semantic'`, merging consecutive same-speaker blocks), or alternates paragraphs (`'alternating'`).
 */
export function segmentStage4DialogueTurns(options: {
  slotKind: 'overview' | 'module';
  moduleNumber?: number;
  title: string;
  spokenText: string;
  actionItem?: string;
  explicitTurns?: NormalizedA2uiDialogueTurn[];
  lang?: string;
  workspaceRoot?: string;
  dialogueMode?: 'semantic' | 'alternating';
  blockAssignments?: Array<'primary' | 'secondary'>;
  primarySpeaker: string;
  primaryVoice: string;
  primaryStyle?: string;
  secondarySpeaker: string;
  secondaryVoice: string;
  secondaryStyle?: string;
}): FlashTtsDialogueTurn[] {
  const {
    slotKind,
    spokenText,
    actionItem,
    explicitTurns,
    lang,
    workspaceRoot,
    dialogueMode = 'alternating',
    blockAssignments,
    primarySpeaker,
    primaryVoice,
    primaryStyle,
    secondarySpeaker,
    secondaryVoice,
    secondaryStyle,
  } = options;

  const makeTurn = (isSecondary: boolean, text: string, customStyle?: string): FlashTtsDialogueTurn => ({
    speaker: isSecondary ? secondarySpeaker : primarySpeaker,
    voice: isSecondary ? secondaryVoice : primaryVoice,
    text,
    ...(customStyle || (isSecondary ? secondaryStyle : primaryStyle)
      ? { style: customStyle || (isSecondary ? secondaryStyle : primaryStyle) }
      : {}),
  });

  if (Array.isArray(explicitTurns) && explicitTurns.length > 0) {
    const mapped: FlashTtsDialogueTurn[] = [];
    const pLower = primarySpeaker.toLowerCase();
    const sLower = secondarySpeaker.toLowerCase();
    explicitTurns.forEach((rawTurn, idx) => {
      const cleaned = prepareTextForStudioTts(rawTurn.text, lang, workspaceRoot);
      if (!cleaned) return;
      const spRaw = String(rawTurn.speaker || '').trim().toLowerCase();
      let useSecondary: boolean;
      if (spRaw && spRaw === sLower) {
        useSecondary = true;
      } else if (spRaw && spRaw === pLower) {
        useSecondary = false;
      } else if (spRaw && /^(?:2|speaker[_\s-]*2|expert|specialist|guest|co-?host)$/i.test(spRaw)) {
        useSecondary = true;
      } else if (spRaw && /^(?:1|speaker[_\s-]*1|host|narrator|moderator|lead)$/i.test(spRaw)) {
        useSecondary = false;
      } else {
        useSecondary = idx % 2 === 1;
      }
      mapped.push(makeTurn(useSecondary, cleaned, rawTurn.style));
    });
    if (mapped.length > 0) {
      return mapped;
    }
  }

  const blocks = extractStage4SpeechBlocks({
    slotKind,
    spokenText,
    actionItem,
    lang,
    workspaceRoot,
  });
  if (blocks.length === 0) return [];

  if (dialogueMode === 'semantic' || (Array.isArray(blockAssignments) && blockAssignments.length > 0)) {
    const rawTurns = blocks.map((b, idx) => {
      const assigned =
        blockAssignments && blockAssignments[idx]
          ? blockAssignments[idx]
          : classifyBlockRegisterHeuristic(b.text, b.kind);
      return makeTurn(assigned === 'secondary', b.text);
    });
    return mergeConsecutiveSpeakerTurns(rawTurns);
  }

  const turns: FlashTtsDialogueTurn[] = [];
  blocks.forEach((b, idx) => {
    if (b.kind === 'actionItem' && turns.length > 0) {
      const lastIsSecondary = turns[turns.length - 1].speaker === secondarySpeaker;
      turns.push(makeTurn(!lastIsSecondary, b.text));
    } else {
      turns.push(makeTurn(idx % 2 === 1, b.text));
    }
  });
  return turns;
}

/**
 * 2c. Optional Phase 4 Stage 4 Studio Narration Runner (`prompts/04_audio.md` -> `gemini-3.8-flash-tts`).
 * Synthesizes `overview` + `module_XX` studio voiceover tracks (single-speaker or multi-speaker dialogue)
 * in `stages/04_audio/output/`, writes `audio_manifest.json` + `thinking_trace.md`, updates `meta.stage4Telemetry`,
 * and automatically hydrates `SpeechPlayer` across `a2ui.html` & `a2ui_studio.html`.
 */
export async function runStage4Flow(input: {
  workspaceRoot: string;
  runId?: string;
  promptName?: string;
  promptDir?: string;
  concurrency?: number;
  dryRun?: boolean;
  artifactDir?: string;
  openBrowser?: boolean;
}): Promise<{
  success: boolean;
  runId: string;
  outputDir: string;
  slotCount: number;
  totalDurationSeconds?: number;
  manifestPath?: string;
  a2uiHtmlPath?: string;
  artifactHtmlPath?: string;
  items: Stage4AudioManifestItem[];
  usage: InteractionUsageTelemetry;
  dryRun?: boolean;
}> {
  const workspacePath = path.resolve(input.workspaceRoot || './workspace');
  const resolvedRunId = resolveDownstreamRunId(workspacePath, input.runId);
  const runDir = path.join(workspacePath, 'runs', resolvedRunId);
  const stage2Path = path.join(runDir, 'stages', '02_script', 'output', 'script_draft.json');
  if (!fs.existsSync(stage2Path)) {
    throw new Error(
      `Stage 2 artifact not found at ${stage2Path}. Run 'npm run cli:stage2 -- ${resolvedRunId}' before Stage 4.`
    );
  }

  const promptName = input.promptName || '04_audio';
  const contract = loadStagePromptContract(promptName, input.promptDir || './prompts');
  const resolvedModel = contract.model || GEMINI_FLASH_TTS_MODEL;
  const primaryVoice = (contract.primaryVoice || contract.voice || 'Kore').trim() || 'Kore';
  const secondaryVoice = (contract.secondaryVoice || '').trim();
  const isMultiSpeaker = Boolean(secondaryVoice && secondaryVoice.toLowerCase() !== primaryVoice.toLowerCase());
  const primarySpeaker = (contract.primarySpeaker || 'Host').trim() || 'Host';
  const secondarySpeaker = (contract.secondarySpeaker || 'Expert').trim() || 'Expert';
  const dialogueMode: 'semantic' | 'alternating' =
    contract.dialogueMode === 'semantic' ||
    (!contract.dialogueMode && Boolean(contract.primaryRole || contract.secondaryRole))
      ? 'semantic'
      : 'alternating';
  const primaryRole =
    (contract.primaryRole || '').trim() ||
    'Warm pedagogical/editorial guide for everyday context, practical explanation, and actionable takeaways.';
  const secondaryRole =
    (contract.secondaryRole || '').trim() ||
    'Calm, serious domain/regulatory/risk specialist who steps in specifically for binding rules, critical hazards, statutory/technical mandates, and high-stakes warnings.';
  const resolvedVoiceLabel = isMultiSpeaker ? `${primaryVoice} & ${secondaryVoice}` : primaryVoice;
  const audioMimeType = contract.audioMimeType;
  const sampleRate = contract.sampleRate;
  const concurrency = Math.max(1, Math.min(4, input.concurrency ?? 2));

  const workspaceLocale = loadWorkspaceLocale(workspacePath);
  const rawStage2 = JSON.parse(fs.readFileSync(stage2Path, 'utf-8')) as Record<string, unknown>;
  const stage2Norm = normalizeStage2ForA2ui(rawStage2, resolvedRunId, workspaceLocale);
  loadWorkspaceLayers(workspacePath);
  const stage4Sample = `${stage2Norm.title}\n${stage2Norm.spokenScript || stage2Norm.scriptBody}`;
  const languageCode = resolveStage4LanguageCode(
    contract.languageCode ||
      (workspaceLocale.hasCustomFile && inferBcp47LanguageCode(stage4Sample) !== 'en-US'
        ? workspaceLocale.bcp47
        : undefined),
    stage4Sample
  );
  const isNonDefaultAccentLang = languageCode.toLowerCase() !== 'en-us';
  const rawPrimaryExplicit = contract.primaryVoiceDesignPrompt || contract.voiceDesignPrompt;
  const rawSecondaryExplicit = contract.secondaryVoiceDesignPrompt || contract.voiceDesignPrompt;
  const primaryDesignPrompt =
    rawPrimaryExplicit ||
    (isPrebuiltStudioVoiceName(primaryVoice) &&
      (contract.voiceLock === true || (contract.voiceLock !== false && isNonDefaultAccentLang)))
      ? resolveStage4VoiceDesignPrompt({
          baseVoice: primaryVoice,
          languageCode,
          speakerRole: isMultiSpeaker ? 'guide' : undefined,
          explicitPrompt: rawPrimaryExplicit,
          locale: workspaceLocale,
        })
      : undefined;
  const secondaryDesignPrompt =
    isMultiSpeaker &&
    (rawSecondaryExplicit ||
      (isPrebuiltStudioVoiceName(secondaryVoice) &&
        (contract.voiceLock === true || (contract.voiceLock !== false && isNonDefaultAccentLang))))
      ? resolveStage4VoiceDesignPrompt({
          baseVoice: secondaryVoice,
          languageCode,
          speakerRole: 'specialist',
          explicitPrompt: rawSecondaryExplicit,
          locale: workspaceLocale,
        })
      : undefined;
  const shouldLockPrimary =
    isPrebuiltStudioVoiceName(primaryVoice) &&
    contract.voiceLock !== false &&
    Boolean(primaryDesignPrompt);
  const shouldLockSecondary =
    isMultiSpeaker &&
    isPrebuiltStudioVoiceName(secondaryVoice) &&
    contract.voiceLock !== false &&
    Boolean(secondaryDesignPrompt);

  interface AudioSlotSpec {
    slotId: string;
    slotKind: 'overview' | 'module';
    moduleNumber: number;
    itemTitle: string;
    transcriptText: string;
    styleInstruction: string;
    turns?: FlashTtsDialogueTurn[];
    speakers?: Array<{ speaker: string; voice: string }>;
  }

  const rawSlots: Array<{
    slotId: string;
    slotKind: 'overview' | 'module';
    moduleNumber: number;
    itemTitle: string;
    subtitleOrBasis?: string;
    rawSourceText: string;
    actionItem?: string;
    dialogueTurns?: NormalizedA2uiDialogueTurn[];
  }> = [];

  const rawOverviewSource = stage2Norm.spokenScript || stage2Norm.scriptBody;
  if (
    prepareTextForStudioTts(rawOverviewSource, languageCode, workspacePath) ||
    stage2Norm.overviewDialogueTurns?.length
  ) {
    rawSlots.push({
      slotId: 'overview',
      slotKind: 'overview',
      moduleNumber: 0,
      itemTitle: stage2Norm.title,
      subtitleOrBasis: stage2Norm.subtitle,
      rawSourceText: rawOverviewSource,
      dialogueTurns: stage2Norm.overviewDialogueTurns,
    });
  }

  stage2Norm.modules.forEach((mod, idx) => {
    const slotNum = idx + 1;
    const slotId = `module_${String(slotNum).padStart(2, '0')}`;
    const rawModSource = mod.spokenNarration || mod.narration;
    if (
      prepareTextForStudioTts(rawModSource, languageCode, workspacePath) ||
      mod.dialogueTurns?.length
    ) {
      rawSlots.push({
        slotId,
        slotKind: 'module',
        moduleNumber: mod.number || slotNum,
        itemTitle: mod.title,
        subtitleOrBasis: mod.subtitleOrBasis,
        rawSourceText: rawModSource,
        actionItem: mod.actionItem,
        dialogueTurns: mod.dialogueTurns,
      });
    }
  });

  if (rawSlots.length === 0) {
    throw new Error(
      `No spoken narration text found in ${stage2Path} to synthesize in Stage 4.`
    );
  }

  // Render a single constant, concise delivery style across all slots (omitting multi-bullet
  // `voice_guide.md` Markdown and per-slot varying module titles, which cause Gemini 3.8 TTS voice drift).
  const constantStyleInstruction = contract.template
    ? sanitizeTtsStyleInstruction(
        renderPromptTemplate(contract.template, {
          courseTitle: stage2Norm.title,
          title: stage2Norm.title,
          subtitle: stage2Norm.subtitle,
          subtitleOrBasis: stage2Norm.subtitle,
          audioSlot: 'course',
          slotId: 'course',
          slotKind: 'module',
          moduleNumber: '1',
          slotTitle: stage2Norm.title,
          itemTitle: stage2Norm.title,
          moduleTitle: stage2Norm.title,
          spokenText: '',
          dialogueTranscript: '',
          primarySpeaker,
          primaryVoice,
          secondarySpeaker,
          secondaryVoice,
          voice: primaryVoice,
          languageCode,
          targetAudience: stage2Norm.targetAudience,
          voiceGuide: '',
          toneRules: '',
          globalIdentity: '',
          workspaceContext: '',
        })
      )
    : '';

  const startTimeMs = Date.now();
  const directorUsage: InteractionUsageTelemetry = {
    inputTokens: 0,
    thoughtsTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
  };
  const directorTraceLines: string[] = [];
  let semanticAssignmentsBySlot:
    | Map<string, Array<{ speakerRole: 'primary' | 'secondary'; rationale: string }>>
    | undefined;

  const unlabeledSemanticSlots =
    isMultiSpeaker && dialogueMode === 'semantic'
      ? rawSlots
          .filter((rs) => !Array.isArray(rs.dialogueTurns) || rs.dialogueTurns.length === 0)
          .map((rs) => ({
            slotId: rs.slotId,
            slotKind: rs.slotKind,
            title: rs.itemTitle,
            blocks: extractStage4SpeechBlocks({
              slotKind: rs.slotKind,
              spokenText: rs.rawSourceText,
              actionItem: rs.actionItem,
              lang: languageCode,
              workspaceRoot: workspacePath,
            }),
          }))
          .filter((s) => s.blocks.length > 0)
      : [];

  if (!input.dryRun && unlabeledSemanticSlots.length > 0) {
    try {
      console.log(
        `[Stage 4 Voice Director]: Routing ${unlabeledSemanticSlots.length} slot(s) between "${primarySpeaker}" (${primaryVoice}) and "${secondarySpeaker}" (${secondaryVoice}) via ${GEMINI_4_ARGON_MODEL} (LOW)...`
      );
      const dirRes = await directSemanticDualVoiceAssignment({
        courseTitle: stage2Norm.title,
        primarySpeaker,
        primaryRole,
        secondarySpeaker,
        secondaryRole,
        slots: unlabeledSemanticSlots,
      });
      semanticAssignmentsBySlot = dirRes.assignmentsBySlot;
      directorUsage.inputTokens += dirRes.usage.inputTokens;
      directorUsage.thoughtsTokens += dirRes.usage.thoughtsTokens;
      directorUsage.outputTokens += dirRes.usage.outputTokens;
      directorUsage.totalTokens += dirRes.usage.totalTokens;
      console.log(
        `[Stage 4 Voice Director]: Semantic register assignment complete (${dirRes.usage.totalTokens} tokens)`
      );
      for (const s of unlabeledSemanticSlots) {
        const assigned = semanticAssignmentsBySlot.get(s.slotId) || [];
        const summary = assigned
          .map(
            (a, bIdx) =>
              `block ${bIdx + 1} -> \`${a.speakerRole === 'secondary' ? secondarySpeaker : primarySpeaker}\` (${a.rationale})`
          )
          .join('; ');
        directorTraceLines.push(`- **\`${s.slotId}\` (${s.title}):** ${summary}`);
      }
    } catch (err: any) {
      console.warn(
        `[Stage 4 Voice Director Warning]: Falling back to deterministic register heuristic: ${err?.message || String(err)}`
      );
    }
  }

  const slots: AudioSlotSpec[] = rawSlots.map((slot) => {
    if (isMultiSpeaker) {
      const pStyle =
        sanitizeTtsStyleInstruction(contract.primaryStyle) ||
        constantStyleInstruction ||
        undefined;
      const sStyle =
        sanitizeTtsStyleInstruction(contract.secondaryStyle) ||
        constantStyleInstruction ||
        undefined;
      const directedRoles = semanticAssignmentsBySlot
        ?.get(slot.slotId)
        ?.map((a) => a.speakerRole);
      const turns = segmentStage4DialogueTurns({
        slotKind: slot.slotKind,
        moduleNumber: slot.moduleNumber,
        title: slot.itemTitle,
        spokenText: slot.rawSourceText,
        actionItem: slot.actionItem,
        explicitTurns: slot.dialogueTurns,
        lang: languageCode,
        workspaceRoot: workspacePath,
        dialogueMode,
        blockAssignments: directedRoles,
        primarySpeaker,
        primaryVoice,
        primaryStyle: pStyle,
        secondarySpeaker,
        secondaryVoice,
        secondaryStyle: sStyle,
      });
      const dialogueTranscript = turns
        .map((t) => `[${t.speaker} (${t.voice})]: ${t.text}`)
        .join('\n\n');
      const usedSpeakerMap = new Map<string, string>();
      for (const t of turns) {
        if (t.speaker && t.voice && !usedSpeakerMap.has(t.speaker)) {
          usedSpeakerMap.set(t.speaker, t.voice);
        }
      }
      return {
        slotId: slot.slotId,
        slotKind: slot.slotKind,
        moduleNumber: slot.moduleNumber,
        itemTitle: slot.itemTitle,
        transcriptText: dialogueTranscript,
        styleInstruction: constantStyleInstruction,
        turns,
        speakers: Array.from(usedSpeakerMap.entries()).map(([speaker, voice]) => ({
          speaker,
          voice,
        })),
      };
    }

    const cleanedSingle = prepareTextForStudioTts(slot.rawSourceText, languageCode, workspacePath);
    return {
      slotId: slot.slotId,
      slotKind: slot.slotKind,
      moduleNumber: slot.moduleNumber,
      itemTitle: slot.itemTitle,
      transcriptText: cleanedSingle,
      styleInstruction: constantStyleInstruction,
    };
  });

  const stage4Dir = path.join(runDir, 'stages', '04_audio');
  const stage4OutDir = path.join(stage4Dir, 'output');
  const stage4InputPath = path.join(stage4Dir, 'input', 'prompt_assembled.md');
  fs.mkdirSync(path.dirname(stage4InputPath), { recursive: true });
  fs.mkdirSync(stage4OutDir, { recursive: true });

  const assembledDoc = [
    '---',
    `stage: 04_audio`,
    `model: ${resolvedModel}`,
    `outputFormat: audio`,
    `voice: "${resolvedVoiceLabel}"`,
    `languageCode: "${languageCode}"`,
    `voiceLock: ${shouldLockPrimary || shouldLockSecondary || isCustomVoiceId(primaryVoice)}`,
    ...(primaryDesignPrompt ? [`voiceDesignPrompt: ${JSON.stringify(primaryDesignPrompt)}`] : []),
    ...(isMultiSpeaker
      ? [
          `dialogueMode: "${dialogueMode}"`,
          `primarySpeaker: "${primarySpeaker}"`,
          `primaryVoice: "${primaryVoice}"`,
          ...(dialogueMode === 'semantic' ? [`primaryRole: ${JSON.stringify(primaryRole)}`] : []),
          `secondarySpeaker: "${secondarySpeaker}"`,
          `secondaryVoice: "${secondaryVoice}"`,
          ...(dialogueMode === 'semantic' ? [`secondaryRole: ${JSON.stringify(secondaryRole)}`] : []),
        ]
      : []),
    ...(audioMimeType ? [`audioMimeType: "${audioMimeType}"`] : []),
    ...(sampleRate ? [`sampleRate: ${sampleRate}`] : []),
    `slotCount: ${slots.length}`,
    `assembledAt: ${new Date().toISOString()}`,
    '---',
    '',
    ...slots.flatMap((s) => [
      `## Slot: \`${s.slotId}\` — ${s.itemTitle}`,
      ...(s.turns && s.turns.length > 0
        ? [
            '',
            `**Speakers:** ${s.speakers?.map((sp) => `${sp.speaker} (\`${sp.voice}\`)`).join(', ') || resolvedVoiceLabel} (${s.turns.length} turn(s))`,
          ]
        : []),
      ...(s.styleInstruction
        ? ['', `**Speech Metadata Style:**`, '', `> ${s.styleInstruction.replace(/\r?\n/g, '\n> ')}`]
        : []),
      '',
      `**Transcript (${s.transcriptText.length} chars):**`,
      '',
      s.transcriptText,
      '',
      '---',
      '',
    ]),
  ].join('\n');
  fs.writeFileSync(stage4InputPath, assembledDoc, 'utf-8');

  console.log(
    `--- Executing Stage 4: Studio Narration for Run: ${resolvedRunId} [model: ${resolvedModel}, voice: ${resolvedVoiceLabel}, lang: ${languageCode}${isMultiSpeaker ? `, mode: ${dialogueMode}` : ''}, slots: ${slots.length}${input.dryRun ? ', DRY-RUN' : ''}] ---`
  );

  if (input.dryRun) {
    const metaPath = path.join(runDir, 'meta.json');
    try {
      const meta: Record<string, any> = fs.existsSync(metaPath)
        ? JSON.parse(fs.readFileSync(metaPath, 'utf-8'))
        : { runId: resolvedRunId, createdAt: new Date().toISOString() };
      meta.stage4DryRun = {
        model: resolvedModel,
        voice: resolvedVoiceLabel,
        languageCode,
        ...(isMultiSpeaker ? { dialogueMode } : {}),
        voiceLock: shouldLockPrimary || shouldLockSecondary || isCustomVoiceId(primaryVoice),
        ...(primaryDesignPrompt ? { voiceDesignPrompt: primaryDesignPrompt } : {}),
        ...(isMultiSpeaker ? { voicesUsed: [primaryVoice, secondaryVoice] } : {}),
        ...(audioMimeType ? { audioMimeType } : {}),
        ...(sampleRate ? { sampleRate } : {}),
        slotCount: slots.length,
        assembledInputPath: stage4InputPath,
      };
      fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2), 'utf-8');
    } catch {
      // Ignore metadata update errors
    }
    const firstSlot = slots[0];
    const sampleBody =
      firstSlot?.turns && firstSlot.speakers && firstSlot.speakers.length >= 2
        ? {
            model: resolvedModel,
            input: [
              {
                type: 'user_input',
                content: firstSlot.turns.map((t, tIdx) => ({
                  type: 'text',
                  text: `[Turn ${tIdx + 1}/${firstSlot.turns!.length} (${t.speaker}): ${t.text.length} chars -> ${stage4InputPath}]`,
                  annotations: [
                    {
                      type: 'speech_metadata',
                      speaker: t.speaker,
                      ...(t.style ? { style: t.style } : {}),
                    },
                  ],
                })),
              },
            ],
            response_format: {
              type: 'audio',
              ...(audioMimeType ? { mime_type: audioMimeType } : {}),
              ...(sampleRate ? { sample_rate: sampleRate } : {}),
            },
            generation_config: {
              speech_config: {
                speakers: firstSlot.speakers.map((sp) => ({
                  ...sp,
                  language: languageCode,
                })),
              },
            },
            store: false,
          }
        : {
            model: resolvedModel,
            input: [
              {
                type: 'user_input',
                content: [
                  {
                    type: 'text',
                    text: `[Slot 1/${slots.length} (${firstSlot?.slotId}): ${firstSlot?.transcriptText.length || 0} chars -> ${stage4InputPath}]`,
                    ...(firstSlot?.styleInstruction
                      ? {
                          annotations: [
                            { type: 'speech_metadata', style: firstSlot.styleInstruction },
                          ],
                        }
                      : {}),
                  },
                ],
              },
            ],
            response_format: {
              type: 'audio',
              ...(audioMimeType ? { mime_type: audioMimeType } : {}),
              ...(sampleRate ? { sample_rate: sampleRate } : {}),
            },
            generation_config: {
              speech_config: [
                {
                  voice: shouldLockPrimary ? `voice_<locked:${primaryVoice}>` : primaryVoice,
                  language: languageCode,
                },
              ],
            },
            store: false,
          };
    console.log(
      `[DRY-RUN] Stage: 04_audio (${slots.length} narration track(s), voice: ${resolvedVoiceLabel}, lang: ${languageCode}${isMultiSpeaker ? `, mode: ${dialogueMode}` : ''})`
    );
    if (unlabeledSemanticSlots.length > 0) {
      console.log(
        `[DRY-RUN] Dual-Voice Director: Would run 1x ${GEMINI_4_ARGON_MODEL} (LOW) semantic register pass across ${unlabeledSemanticSlots.length} slot(s)`
      );
    }
    if (shouldLockPrimary || shouldLockSecondary) {
      console.log(
        `[DRY-RUN] Voice Lock: Would resolve/cache Voice Design persona via POST ${VOICES_API_URL} (workspace/_config/voice_locks.json)`
      );
    }
    console.log(`[DRY-RUN] Assembled Stage 4 Transcripts written to: ${stage4InputPath}`);
    console.log(`[DRY-RUN] Would send ${slots.length}x POST ${INTERACTIONS_API_URL}`);
    console.log(`[DRY-RUN] Sample Body:\n${JSON.stringify(sampleBody, null, 2)}`);
    console.log(`[DRY-RUN] Network calls skipped. Zero tokens spent.`);
    return {
      success: true,
      runId: resolvedRunId,
      outputDir: stage4OutDir,
      slotCount: slots.length,
      items: [],
      usage: { inputTokens: 0, thoughtsTokens: 0, outputTokens: 0, totalTokens: 0 },
      dryRun: true,
    };
  }

  const locksFilePath = path.join(workspacePath, '_config', 'voice_locks.json');
  let synthesisPrimaryVoice = primaryVoice;
  let synthesisSecondaryVoice = secondaryVoice;
  const voiceLockOnlyUsage: InteractionUsageTelemetry = {
    inputTokens: 0,
    thoughtsTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
  };
  const voiceLockTraceNotes: string[] = [];

  if (shouldLockPrimary && primaryDesignPrompt) {
    try {
      const lockRes = await ensureWorkspaceLockedVoice({
        locksFilePath,
        baseVoice: primaryVoice,
        languageCode,
        voiceDesignPrompt: primaryDesignPrompt,
        displayName: `${primaryVoice} (${languageCode} Studio Lock)`,
        model: resolvedModel,
        samplePreviewOutPath: path.join(
          stage4OutDir,
          `voice_reference_${primaryVoice.toLowerCase()}.wav`
        ),
      });
      synthesisPrimaryVoice = lockRes.voiceId;
      voiceLockOnlyUsage.inputTokens += lockRes.usage.inputTokens;
      voiceLockOnlyUsage.thoughtsTokens += lockRes.usage.thoughtsTokens;
      voiceLockOnlyUsage.outputTokens += lockRes.usage.outputTokens;
      voiceLockOnlyUsage.totalTokens += lockRes.usage.totalTokens;
      const statusTag = lockRes.cached ? 'cached' : `created (${lockRes.usage.totalTokens} tokens)`;
      console.log(
        `[Stage 4 Voice Lock]: Locked ${primaryVoice} -> ${lockRes.voiceId} (${languageCode}, ${statusTag})`
      );
      voiceLockTraceNotes.push(
        `\`${primaryVoice}\` -> \`${lockRes.voiceId}\` (\`${languageCode}\`, ${statusTag})`
      );
    } catch (err: any) {
      console.warn(
        `[Stage 4 Voice Lock Warning]: Falling back to prebuilt voice "${primaryVoice}": ${err?.message || String(err)}`
      );
    }
  }

  if (shouldLockSecondary && secondaryDesignPrompt) {
    try {
      const lockRes = await ensureWorkspaceLockedVoice({
        locksFilePath,
        baseVoice: secondaryVoice,
        languageCode,
        voiceDesignPrompt: secondaryDesignPrompt,
        displayName: `${secondaryVoice} (${languageCode} Studio Lock)`,
        model: resolvedModel,
        samplePreviewOutPath: path.join(
          stage4OutDir,
          `voice_reference_${secondaryVoice.toLowerCase()}.wav`
        ),
      });
      synthesisSecondaryVoice = lockRes.voiceId;
      voiceLockOnlyUsage.inputTokens += lockRes.usage.inputTokens;
      voiceLockOnlyUsage.thoughtsTokens += lockRes.usage.thoughtsTokens;
      voiceLockOnlyUsage.outputTokens += lockRes.usage.outputTokens;
      voiceLockOnlyUsage.totalTokens += lockRes.usage.totalTokens;
      const statusTag = lockRes.cached ? 'cached' : `created (${lockRes.usage.totalTokens} tokens)`;
      console.log(
        `[Stage 4 Voice Lock]: Locked ${secondaryVoice} -> ${lockRes.voiceId} (${languageCode}, ${statusTag})`
      );
      voiceLockTraceNotes.push(
        `\`${secondaryVoice}\` -> \`${lockRes.voiceId}\` (\`${languageCode}\`, ${statusTag})`
      );
    } catch (err: any) {
      console.warn(
        `[Stage 4 Voice Lock Warning]: Falling back to prebuilt voice "${secondaryVoice}": ${err?.message || String(err)}`
      );
    }
  }

  const mapDisplayVoiceToSynthesis = (v: string): string => {
    if (v === primaryVoice) return synthesisPrimaryVoice;
    if (isMultiSpeaker && v === secondaryVoice) return synthesisSecondaryVoice;
    return v;
  };

  const resultsByIdx: Array<{
    item: Stage4AudioManifestItem;
    thoughts: string[];
    usage: InteractionUsageTelemetry;
  }> = new Array(slots.length);

  let nextIdx = 0;
  const worker = async () => {
    while (true) {
      const idx = nextIdx++;
      if (idx >= slots.length) break;
      const slot = slots[idx];
      const slotDisplayVoices =
        slot.speakers && slot.speakers.length > 0
          ? slot.speakers.map((sp) => sp.voice)
          : [primaryVoice];
      const slotSynthesisVoices = slotDisplayVoices.map(mapDisplayVoiceToSynthesis);
      const slotVoiceStr = slotDisplayVoices.join(' & ');
      const synthesisTurns = slot.turns?.map((t) => ({
        ...t,
        voice: t.voice ? mapDisplayVoiceToSynthesis(t.voice) : undefined,
      }));
      const synthesisSpeakers = slot.speakers?.map((sp) => ({
        speaker: sp.speaker,
        voice: mapDisplayVoiceToSynthesis(sp.voice),
      }));
      console.log(
        `[Stage 4 Audio ${idx + 1}/${slots.length}]: Synthesizing ${slot.slotId} ("${slot.itemTitle}", ${slot.transcriptText.length} chars, voice=${slotVoiceStr}, lang=${languageCode})...`
      );
      const ttsRes = await generateFlashTtsAudioInteraction({
        transcriptText: slot.transcriptText,
        styleInstruction: slot.styleInstruction || undefined,
        turns: synthesisTurns,
        speakers: synthesisSpeakers,
        model: resolvedModel,
        voice: synthesisPrimaryVoice,
        languageCode,
        audioMimeType,
        sampleRate,
      });

      for (const oldExt of ['.wav', '.mp3', '.ogg', '.pcm']) {
        const oldPath = path.join(stage4OutDir, `${slot.slotId}${oldExt}`);
        if (oldExt !== ttsRes.ext && fs.existsSync(oldPath)) {
          try {
            fs.unlinkSync(oldPath);
          } catch {
            // Ignore cleanup errors
          }
        }
      }

      const fileName = `${slot.slotId}${ttsRes.ext}`;
      const outPath = path.join(stage4OutDir, fileName);
      fs.writeFileSync(outPath, ttsRes.audioBuffer);
      const trackDur = ttsRes.durationSeconds ?? parseWavMetadata(ttsRes.audioBuffer).durationSeconds;
      console.log(
        `[Stage 4 Audio ${idx + 1}/${slots.length}]: Saved ${fileName} (${ttsRes.mimeType}, ${(ttsRes.audioBuffer.length / 1024).toFixed(1)} KB${trackDur > 0 ? `, ${trackDur.toFixed(1)}s` : ''}, ${ttsRes.usage.totalTokens} tokens)`
      );

      resultsByIdx[idx] = {
        item: {
          slotId: slot.slotId,
          moduleNumber: slot.moduleNumber,
          title: slot.itemTitle,
          voice: slotVoiceStr,
          voicesUsed: slotDisplayVoices,
          ...(slotSynthesisVoices.some((v, i) => v !== slotDisplayVoices[i])
            ? { lockedVoicesUsed: slotSynthesisVoices }
            : {}),
          languageCode,
          ...(slot.turns ? { turnCount: slot.turns.length } : {}),
          ...(trackDur > 0 ? { durationSeconds: trackDur } : {}),
          fileName,
          relativePath: `./stages/04_audio/output/${fileName}`,
          mimeType: ttsRes.mimeType,
          bytes: ttsRes.audioBuffer.length,
          charCount: slot.transcriptText.length,
        },
        thoughts: ttsRes.thoughts.map((t) => `[${slot.slotId}] ${t}`),
        usage: ttsRes.usage,
      };
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(concurrency, slots.length) }, () => worker())
  );

  const items = resultsByIdx.map((r) => r.item);
  const totalDurationSeconds = Number(
    items.reduce((sum, it) => sum + (it.durationSeconds || 0), 0).toFixed(2)
  );
  const allVoicesUsed = isMultiSpeaker ? [primaryVoice, secondaryVoice] : [primaryVoice];
  const allLockedVoicesUsed = isMultiSpeaker
    ? [synthesisPrimaryVoice, synthesisSecondaryVoice]
    : [synthesisPrimaryVoice];
  const hasVoiceLocks = allLockedVoicesUsed.some((v, i) => v !== allVoicesUsed[i]);
  const allThoughts = resultsByIdx.flatMap((r) => r.thoughts);
  const ttsUsage: InteractionUsageTelemetry = resultsByIdx.reduce(
    (acc, r) => ({
      inputTokens: acc.inputTokens + r.usage.inputTokens,
      thoughtsTokens: acc.thoughtsTokens + r.usage.thoughtsTokens,
      outputTokens: acc.outputTokens + r.usage.outputTokens,
      totalTokens: acc.totalTokens + r.usage.totalTokens,
    }),
    { inputTokens: 0, thoughtsTokens: 0, outputTokens: 0, totalTokens: 0 }
  );
  const aggUsage: InteractionUsageTelemetry = {
    inputTokens:
      ttsUsage.inputTokens + directorUsage.inputTokens + voiceLockOnlyUsage.inputTokens,
    thoughtsTokens:
      ttsUsage.thoughtsTokens + directorUsage.thoughtsTokens + voiceLockOnlyUsage.thoughtsTokens,
    outputTokens:
      ttsUsage.outputTokens + directorUsage.outputTokens + voiceLockOnlyUsage.outputTokens,
    totalTokens:
      ttsUsage.totalTokens + directorUsage.totalTokens + voiceLockOnlyUsage.totalTokens,
  };
  const hasAuxStage4Tokens =
    directorUsage.totalTokens > 0 || voiceLockOnlyUsage.totalTokens > 0;
  const tokenBreakdownParts: string[] = [
    `tts=${ttsUsage.totalTokens}`,
    ...(directorUsage.totalTokens > 0 ? [`director=${directorUsage.totalTokens}`] : []),
    ...(voiceLockOnlyUsage.totalTokens > 0 ? [`voiceLock=${voiceLockOnlyUsage.totalTokens}`] : []),
  ];
  const durationMs = Date.now() - startTimeMs;

  const manifestPath = path.join(stage4OutDir, 'audio_manifest.json');
  fs.writeFileSync(
    manifestPath,
    JSON.stringify(
      {
        stage: '04_audio',
        runId: resolvedRunId,
        model: resolvedModel,
        voice: resolvedVoiceLabel,
        voicesUsed: allVoicesUsed,
        ...(isMultiSpeaker ? { dialogueMode } : {}),
        ...(hasVoiceLocks ? { lockedVoicesUsed: allLockedVoicesUsed } : {}),
        languageCode,
        ...(totalDurationSeconds > 0 ? { totalDurationSeconds } : {}),
        ...(audioMimeType ? { audioMimeType } : {}),
        ...(sampleRate ? { sampleRate } : {}),
        ttsTokens: ttsUsage.totalTokens,
        ...(directorUsage.totalTokens > 0 ? { directorTokens: directorUsage.totalTokens } : {}),
        ...(voiceLockOnlyUsage.totalTokens > 0
          ? { voiceLockTokens: voiceLockOnlyUsage.totalTokens }
          : {}),
        totalTokens: aggUsage.totalTokens,
        generatedAt: new Date().toISOString(),
        items,
      },
      null,
      2
    ),
    'utf-8'
  );

  const traceLines: string[] = [
    `# 04_audio — Studio Speech Synthesis Trace`,
    '',
    `- **Model:** \`${resolvedModel}\``,
    `- **Voice(s):** \`${resolvedVoiceLabel}\``,
    ...(isMultiSpeaker ? [`- **Dialogue Mode:** \`${dialogueMode}\``] : []),
    `- **Language Code:** \`${languageCode}\``,
    ...(voiceLockTraceNotes.length > 0
      ? [`- **Voice Design Lock (\`/v1beta/voices\`):** ${voiceLockTraceNotes.join(', ')}`]
      : []),
    `- **Generated Tracks:** ${items.length} (${items.map((it) => `\`${it.fileName}\``).join(', ')})`,
    ...(totalDurationSeconds > 0
      ? [`- **Total Audio Duration:** ${totalDurationSeconds.toFixed(1)}s (${(totalDurationSeconds / 60).toFixed(1)} min)`]
      : []),
    `- **Wall-Clock Synthesis Time:** ${(durationMs / 1000).toFixed(1)}s`,
    `- **Input Tokens:** ${aggUsage.inputTokens}`,
    `- **Thinking Tokens:** ${aggUsage.thoughtsTokens}`,
    `- **Output Tokens:** ${aggUsage.outputTokens}`,
    `- **Total Tokens:** ${aggUsage.totalTokens}${hasAuxStage4Tokens ? ` (${tokenBreakdownParts.join(', ')})` : ''}`,
    ...(directorTraceLines.length > 0
      ? ['', `## Dual-Voice Register Director (\`${GEMINI_4_ARGON_MODEL}\` LOW)`, '', ...directorTraceLines]
      : []),
    '',
    `## Reasoning Steps (${allThoughts.length})`,
    '',
    ...(allThoughts.length > 0
      ? allThoughts.flatMap((t, idx) => [`### Step ${idx + 1}`, t, ''])
      : ['_No reasoning summary steps emitted._']),
  ];
  fs.writeFileSync(path.join(stage4OutDir, 'thinking_trace.md'), traceLines.join('\n'), 'utf-8');

  const metaPath = path.join(runDir, 'meta.json');
  try {
    const meta: Record<string, any> = fs.existsSync(metaPath)
      ? JSON.parse(fs.readFileSync(metaPath, 'utf-8'))
      : { runId: resolvedRunId, createdAt: new Date().toISOString() };
    meta.stage4Telemetry = {
      model: resolvedModel,
      voice: resolvedVoiceLabel,
      voicesUsed: allVoicesUsed,
      ...(isMultiSpeaker ? { dialogueMode } : {}),
      ...(hasVoiceLocks ? { lockedVoicesUsed: allLockedVoicesUsed } : {}),
      languageCode,
      trackCount: items.length,
      ...(totalDurationSeconds > 0 ? { totalDurationSeconds } : {}),
      files: items.map((it) => it.fileName),
      ttsTokens: ttsUsage.totalTokens,
      ...(directorUsage.totalTokens > 0 ? { directorTokens: directorUsage.totalTokens } : {}),
      ...(voiceLockOnlyUsage.totalTokens > 0
        ? { voiceLockTokens: voiceLockOnlyUsage.totalTokens }
        : {}),
      inputTokens: aggUsage.inputTokens,
      thoughtsTokens: aggUsage.thoughtsTokens,
      outputTokens: aggUsage.outputTokens,
      totalTokens: aggUsage.totalTokens,
      durationMs,
    };
    fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2), 'utf-8');
  } catch {
    // Ignore meta update errors
  }

  console.log(
    `[Stage 4 Telemetry]: tracks=${items.length}, voice=${resolvedVoiceLabel}${totalDurationSeconds > 0 ? `, audio=${totalDurationSeconds.toFixed(1)}s` : ''}, input=${aggUsage.inputTokens}, thoughts=${aggUsage.thoughtsTokens}, output=${aggUsage.outputTokens}, total=${aggUsage.totalTokens} tokens${hasAuxStage4Tokens ? ` [${tokenBreakdownParts.join(', ')}]` : ''} (${(durationMs / 1000).toFixed(1)}s)`
  );

  let a2uiHtmlPath: string | undefined;
  let artifactHtmlPath: string | undefined;
  try {
    const a2uiRes = generateA2uiSurface(resolvedRunId, {
      workspaceRoot: workspacePath,
      artifactDir: input.artifactDir,
      openBrowser: input.openBrowser,
    });
    a2uiHtmlPath = a2uiRes.htmlOutputPath;
    artifactHtmlPath = a2uiRes.artifactHtmlPath;
    console.log(
      `[Stage 4 A2UI Studio Hydrated]: ${a2uiRes.htmlOutputPath}${a2uiRes.artifactHtmlPath ? ` (artifact: ${a2uiRes.artifactHtmlPath})` : ''}`
    );
  } catch (err: any) {
    console.warn(`[Stage 4 A2UI Warning]: ${err?.message || String(err)}`);
  }

  return {
    success: true,
    runId: resolvedRunId,
    outputDir: stage4OutDir,
    slotCount: slots.length,
    ...(totalDurationSeconds > 0 ? { totalDurationSeconds } : {}),
    manifestPath,
    ...(a2uiHtmlPath ? { a2uiHtmlPath } : {}),
    ...(artifactHtmlPath ? { artifactHtmlPath } : {}),
    items,
    usage: aggUsage,
  };
}

// 3. Central Orchestration Runner (Layer 1 Task Router: Stage 1 -> Stage 2)
export async function icmOrchestratorFlow(input: {
  workspaceRoot: string;
  runId: string;
  topic: string;
  researchThinkingLevel?: ThinkingLevel | string;
  scriptThinkingLevel?: ThinkingLevel | string;
}): Promise<{
  status: string;
  outputPath: string;
}> {
  await runStage1Flow({
    workspaceRoot: input.workspaceRoot,
    runId: input.runId,
    topic: input.topic,
    thinkingLevel: input.researchThinkingLevel,
  });

  // --- INTERMISSION: HUMAN-IN-THE-LOOP FILESYSTEM GATE ---
  // Between Stage 1 and Stage 2, the reviewer can inspect/edit `research_summary.md`,
  // stamp human sign-off via `npm run cli:verify -- <runId>`,
  // and re-run Stage 2 standalone at any time via `runStage2Flow` (`npm run cli:stage2 -- <runId>`).

  const stage2Result = await runStage2Flow({
    workspaceRoot: input.workspaceRoot,
    runId: input.runId,
    thinkingLevel: input.scriptThinkingLevel,
  });

  return {
    status: 'Pipeline executed successfully',
    outputPath: stage2Result.outputPath,
  };
}
