import * as fs from 'fs';
import * as path from 'path';

export interface IcmUiLocale {
  // Bundle & OKF Graph / Markdown labels
  relatedConceptsHeading: string;
  referencedInConcept: string;
  referencedConceptDesc: string;
  stubConceptBody: string;
  stubConceptInlineNote: string;
  stubConceptVizHint: string;
  sourceMimeBullet: string;
  sourceRetrievedBullet: string;
  sourceModifiedBullet: string;
  backToConcept: string;
  backToPrimaryConcept: string;

  // Stage 2 Normalization & Multimodal prefixes
  checklistDefaultHeading: string;
  checklistDefaultGroup: string;
  groupPrefix: string;
  modulePrefix: string;
  pillarPrefix: string;
  casePrefix: string;
  scenarioPrefix: string;
  challengePrefix: string;
  keyCheckpoints: string;
  keyCheckpointsWithBasis: string;
  rationaleLabel: string;
  selectBestResponseCourse: string;
  selectBestOptionAnalysis: string;
  reviewModuleGuidanceCourse: string;
  applyAnalyticalConclusion: string;

  // A2UI Surface, Tabs & Header chrome
  defaultVerifierActor: string;
  verifierPlaceholder: string;
  verifiedSourcesCount: string;
  runLabelPrefix: string;
  switchRunAriaLabel: string;
  switchToRun: string;
  switchToRunWithId: string;
  targetAudienceLabel: string;
  durationLabel: string;
  modelLabel: string;
  completedSummary: string;
  completedWord: string;
  noOkfBody: string;
  noStage2Body: string;
  stage1TelemetryHeading: string;
  stage1TelemetryStats: string;
  stage1TelemetryTokens: string;
  stage1ExecutedQueriesHeading: string;
  stage1NoQueries: string;
  stage1OverviewHeading: string;
  stage2OverviewHeadingCourse: string;
  stage2OverviewHeadingAnalysis: string;
  highlightsHeadingCourse: string;
  highlightsHeadingAnalysis: string;
  tabOkfSourcesCount: string;
  tabOkfBase: string;
  tabSearchTraceCount: string;
  tabOkfGraphCount: string;
  okfGraphTitle: string;
  tabOverviewCourse: string;
  tabOverviewAnalysis: string;
  tabChecklistCount: string;
  checklistCardTitle: string;
  checklistShortTitle: string;
  tabModulesCourseCount: string;
  tabModulesAnalysisCount: string;
  modulesCardTitleCourse: string;
  modulesCardTitleAnalysis: string;
  tabCasesCourseCount: string;
  tabCasesAnalysisCount: string;
  casesCardTitleCourse: string;
  casesCardTitleAnalysis: string;
  tabQuizCount: string;
  quizCardTitle: string;
  quizShortTitle: string;
  exportStateBtn: string;
  inspectorTitle: string;
  closeBtn: string;

  // A2UI Client Studio interactive controls
  listenNarration: string;
  stopNarration: string;
  studioAudioBadge: string;
  studioAudioVoicesBadge: string;
  missingBrowserVoiceHint: string;
  checkAllBtn: string;
  resetChecklistBtn: string;
  noModulesEmpty: string;
  keyPointsCourse: string;
  keyPointsAnalysis: string;
  actionItemCourse: string;
  actionItemAnalysis: string;
  prevModuleCourse: string;
  prevModuleAnalysis: string;
  nextModuleCourse: string;
  nextModuleAnalysis: string;
  quizScoreBadge: string;
  quizCorrect: string;
  quizIncorrect: string;
  caseResponseLabelCourse: string;
  caseResponseLabelAnalysis: string;
  caseResponsePlaceholderCourse: string;
  caseResponsePlaceholderAnalysis: string;
  showRecommendedAction: string;
  hideRecommendedAction: string;
  recommendedActionHeader: string;
  copiedFeedback: string;
  intermissionBannerStage1: string;
  intermissionBannerFull: string;
  activeSourcesChip: string;
  rejectedSourcesChip: string;
  replacedSourcesChip: string;
  addedSourcesChip: string;
  jumpToSourcesBtn: string;
  verifierLabel: string;
  approveAndSendBtn: string;
  sendingToAgyBtn: string;
  sentToAgyBtn: string;
  copiedPasteInChatBtn: string;
  copyReplyForAgyBtn: string;
  copyCliCommandBtn: string;
  stage1KnowledgeBaseTitle: string;
  previewOkfMarkdownBtn: string;
  editOkfMarkdownBtn: string;
  editableMarkdownLabel: string;
  sourcesAndProvenanceHeading: string;
  stage1SearchQueriesSummary: string;
  addMissingSourceLabel: string;
  optionalSourceTitlePlaceholder: string;
  addSourceBtn: string;
  showingSourcesCount: string;
  filterAllPill: string;
  filterReviewPill: string;
  filterSourcesPlaceholder: string;
  resetFilterBtn: string;
  rejectedBadge: string;
  addedBadge: string;
  historicalArchiveBadge: string;
  domainMismatchPrefix: string;
  citationsWord: string;
  soleSourceWarning: string;
  copyUrlBtn: string;
  undoReplaceBtn: string;
  closeReplaceBtn: string;
  replaceSourceBtn: string;
  undoRejectBtn: string;
  rejectSourceBtn: string;
  replaceCitationsWithLabel: string;
  letAgyChooseOption: string;
  selectOrPasteSourceOption: string;
  pasteCanonicalUrlPlaceholder: string;
  useUrlBtn: string;
  showSoleClaimsSummary: string;
  graphClickHint: string;
  sourcesCountHeading: string;
  citedByCountHeading: string;
  noGraphNodesEmpty: string;
  agyApproveStage1: string;
  agyApproveFull: string;
  agyRejectPrefix: string;
  agyReplacePrefix: string;
  agyAddPrefix: string;
  agyCurateRunStage1: string;
  agyCurateRunFull: string;
}

export interface IcmVoicePersonaLocale {
  warmGuideFemale: string;
  warmGuideMale: string;
  calmSpecialistMale: string;
  calmSpecialistFemale: string;
}

export interface IcmProsodyLocale {
  to: string;
  or: string;
  minus: string;
  negative: string;
  plus: string;
  approximately: string;
  plusOrMinus: string;
  atMost: string;
  atLeast: string;
  lessOrEqual: string;
  greaterOrEqual: string;
  notEqual: string;
  times: string;
  dividedBy: string;
  inEquilibriumWith: string;
  section: string;
  sections: string;
  percent: string;
  degrees: string;
  degreesCelsius: string;
  degreesFahrenheit: string;
  specificImpulse: string;
  decibels: string;
  squareMeters: string;
  cubicMeters: string;
  squareKilometers: string;
  kilograms: string;
  centimeters: string;
  millimeters: string;
  meter: string;
  meters: string;
  perHour: string;
  perSecond: string;
  microG: string;
  micrometers: string;
  gramsPerCm3: string;
  kgPerM3: string;
  kmPerS: string;
  mPerS2: string;
  mPerS: string;
  wattsPerM2: string;
  kwPerKg: string;
  dollarSingular: string;
  dollarPlural: string;
  per: string;
  clockPrefix?: string;
  magnitudes: Record<string, string>;
  unitSlashes: Record<string, string>;
  abbreviations: Record<string, string>;
  voicePersonas: IcmVoicePersonaLocale;
}

export interface IcmLocalePack {
  bcp47: string;
  languageName: string;
  ui: IcmUiLocale;
  prosody: IcmProsodyLocale;
}

export const DEFAULT_ICM_UI_LOCALE: IcmUiLocale = {
  relatedConceptsHeading: '## Related Bundle Concepts',
  referencedInConcept: '- **Referenced in concept:** [/{id}.md](/{id}.md) (*{title}*)',
  referencedConceptDesc: 'Referenced OKF concept from {id}',
  stubConceptBody:
    '# {label}\n\n*This OKF concept (`/{id}.md`) is referenced from **{parent}**.*\n\nRun `npm run cli:stage1 -- "{label}"` to generate and verify this concept in the knowledge bundle.',
  stubConceptInlineNote:
    '*This OKF concept (`/{id}.md`) is cross-referenced from the primary concept.*',
  stubConceptVizHint:
    'This OKF concept is cross-referenced from <code>{parent}</code>. Run <code>npm run cli:stage1 -- "{label}"</code> to generate and verify this concept in the knowledge bundle.',
  sourceMimeBullet: '- **MIME type (`mime_type`):** `{value}`',
  sourceRetrievedBullet: '- **Retrieved (`retrieved_at`):** `{value}`',
  sourceModifiedBullet: '- **Last modified (`last_modified`):** `{value}`',
  backToConcept: '← Back to concept',
  backToPrimaryConcept: '← Back to primary concept',

  checklistDefaultHeading: 'Checklist / Action Items',
  checklistDefaultGroup: 'General',
  groupPrefix: 'Group',
  modulePrefix: 'Module',
  pillarPrefix: 'Pillar',
  casePrefix: 'Case',
  scenarioPrefix: 'Scenario',
  challengePrefix: 'Challenge / Question: {question}',
  keyCheckpoints: 'Key Checkpoints:',
  keyCheckpointsWithBasis: 'Key Checkpoints ({basis}):',
  rationaleLabel: '📌 Rationale:',
  selectBestResponseCourse: 'Select the most accurate response among: {options}',
  selectBestOptionAnalysis: 'Evaluate the options: {options}',
  reviewModuleGuidanceCourse:
    'Review the module guidance and apply the verified requirement in practice.',
  applyAnalyticalConclusion: 'Apply the analytical conclusion from this section.',

  defaultVerifierActor: 'human:reviewer',
  verifierPlaceholder: 'human:Name or role',
  verifiedSourcesCount: '{count} verified sources',
  runLabelPrefix: 'Run {n}: {title}',
  switchRunAriaLabel: 'Switch active course / run',
  switchToRun: '🚀 Switch to Run',
  switchToRunWithId: '🚀 Switch to Run ({id})',
  targetAudienceLabel: 'Target Audience',
  durationLabel: 'Duration',
  modelLabel: 'Model',
  completedSummary: '{completed} / {total} completed ({pct}%)',
  completedWord: 'completed',
  noOkfBody: '*No Stage 1 OKF body found.*',
  noStage2Body: 'No Stage 2 synthesis text generated yet.',
  stage1TelemetryHeading: '### 📊 Stage 1 Telemetry & Grounding Metrics',
  stage1TelemetryStats:
    '- **Thinking Level:** `{level}`  •  **Reasoning Steps:** {steps}  •  **Google Searches Executed:** {queries}',
  stage1TelemetryTokens:
    '- **Tokens:** {total} total (input: {input}, thinking: {thoughts}, output: {output})  •  **Duration:** {sec}s',
  stage1ExecutedQueriesHeading: '### 🔎 Executed Google Search Queries ({count})',
  stage1NoQueries: '*No search queries logged in meta.json.*',
  stage1OverviewHeading: 'Stage 1 Search Queries, Telemetry & Reasoning Trace',
  stage2OverviewHeadingCourse: 'Stage 2 Synthesis & Core Narrative',
  stage2OverviewHeadingAnalysis: 'Stage 2 Executive Synthesis & Thesis',
  highlightsHeadingCourse: '### Key Takeaways & Learning Objectives',
  highlightsHeadingAnalysis: '### Key Takeaways & Thesis Highlights',
  tabOkfSourcesCount: '📚 OKF v0.3 Knowledge Base & Sources ({count})',
  tabOkfBase: '📚 OKF v0.3 Knowledge Base',
  tabSearchTraceCount: '🔎 Search & Grounding Trace ({count} queries)',
  tabOkfGraphCount: '🕸️ OKF Knowledge Graph ({count})',
  okfGraphTitle: 'OKF v0.3 Knowledge Graph',
  tabOverviewCourse: '📋 Overview & Summary',
  tabOverviewAnalysis: '📋 Executive Summary',
  tabChecklistCount: '✅ Interactive Checklist ({count})',
  checklistCardTitle: 'Interactive Checklist (OKF v0.3 Verification Items)',
  checklistShortTitle: 'Interactive Checklist',
  tabModulesCourseCount: '🎓 Modules ({count})',
  tabModulesAnalysisCount: '📊 Deep-Dive Pillars ({count})',
  modulesCardTitleCourse: 'Training Modules & Lessons',
  modulesCardTitleAnalysis: 'Analytical Pillars & Valuation Deep-Dives',
  tabCasesCourseCount: '⚖️ Cases & Actions ({count})',
  tabCasesAnalysisCount: '⚖️ Scenario Simulator ({count})',
  casesCardTitleCourse: 'Case & Action Simulator',
  casesCardTitleAnalysis: 'Scenario & Decision Simulator',
  tabQuizCount: '🧪 Knowledge Check ({count})',
  quizCardTitle: 'Interactive Knowledge Check',
  quizShortTitle: 'Knowledge Check',
  exportStateBtn: '⬇ Export A2UI State (.json)',
  inspectorTitle: 'A2UI v{version} Declarative Surface, Data Model & Action Log',
  closeBtn: 'Close',

  listenNarration: '🔊 Listen to narration ({desc})',
  stopNarration: '⏹ Stop',
  studioAudioBadge: '🎙️ Studio Audio',
  studioAudioVoicesBadge: '🎙️ Studio Audio ({voices})',
  missingBrowserVoiceHint:
    '⚠️ No browser Web Speech voice installed for {lang} — run Stage 4 (gemini-3.8-flash-tts) for native studio narration',
  checkAllBtn: '✓ Check all',
  resetChecklistBtn: '↺ Reset checklist',
  noModulesEmpty: 'No modules or pillars found in Stage 2 artifact.',
  keyPointsCourse: 'Key Learning Points & Slide Cues',
  keyPointsAnalysis: 'Key Analytical Findings & Evidence',
  actionItemCourse: '⚡ Action Item / Practical Exercise:',
  actionItemAnalysis: '⚡ Recommendation / Decision Directive:',
  prevModuleCourse: '← Previous module',
  prevModuleAnalysis: '← Previous pillar',
  nextModuleCourse: 'Next module →',
  nextModuleAnalysis: 'Next pillar →',
  quizScoreBadge: 'Score: {correct} / {total} correct ({answered} answered)',
  quizCorrect: '✓ Correct!',
  quizIncorrect: '✗ Not quite.',
  caseResponseLabelCourse: 'Your proposed action plan (saved live in A2UI Data Model):',
  caseResponseLabelAnalysis:
    'Your analytical notes / decision stance (saved live in A2UI Data Model):',
  caseResponsePlaceholderCourse: 'Write your assessment and recommended steps here...',
  caseResponsePlaceholderAnalysis: 'Record committee notes, conditions, or risk mitigations...',
  showRecommendedAction: 'Show recommended action',
  hideRecommendedAction: 'Hide recommended action',
  recommendedActionHeader: '⚡ Recommended Action & Resolution:',
  copiedFeedback: '✓ Copied!',
  intermissionBannerStage1: '🛡️ Intermission Source Curation & Sign-Off (Stage 1 → Stage 2)',
  intermissionBannerFull: '🛡️ OKF v0.3 Source Curation & Verification',
  activeSourcesChip: '✅ {count} active sources',
  rejectedSourcesChip: '🚫 {count} rejected',
  replacedSourcesChip: '🔀 {count} replaced',
  addedSourcesChip: '➕ {count} added',
  jumpToSourcesBtn: '⬇️ Sources & Replace ({count})',
  verifierLabel: 'Verifier:',
  approveAndSendBtn: '🚀 Approve & Send to AGY',
  sendingToAgyBtn: '⏳ Sending to AGY...',
  sentToAgyBtn: '✅ Sent to AGY! (Check chat)',
  copiedPasteInChatBtn: '📋 Copied! Paste in AGY chat',
  copyReplyForAgyBtn: '📋 Copy Reply for AGY',
  copyCliCommandBtn: '💻 Copy CLI Command',
  stage1KnowledgeBaseTitle: 'Stage 1 OKF v0.3 Knowledge Base',
  previewOkfMarkdownBtn: '👁 Preview OKF Markdown',
  editOkfMarkdownBtn: '✏️ Edit OKF Markdown (Layer 4)',
  editableMarkdownLabel:
    'Editable OKF v0.3 Markdown (live-updates A2UI Data Model and Checklist):',
  sourcesAndProvenanceHeading: 'Sources & Provenance ({count})',
  stage1SearchQueriesSummary: '🔎 Stage 1 Search Queries ({count} queries)',
  addMissingSourceLabel: '➕ Add Missing Source (URL + optional title)',
  optionalSourceTitlePlaceholder: 'Optional title (e.g. Regulatory Standard § 12)',
  addSourceBtn: '➕ Add Source',
  showingSourcesCount: 'Showing {visible} of {total} sources',
  filterAllPill: 'All ({count})',
  filterReviewPill: '⚠️ Review ({count})',
  filterSourcesPlaceholder: '🔎 Filter sources by filename, URL, title, MIME, or [^id]…',
  resetFilterBtn: 'Reset filter',
  rejectedBadge: '🚫 REJECTED',
  addedBadge: '➕ ADDED',
  historicalArchiveBadge: 'Historical / archive path',
  domainMismatchPrefix: 'Domain mismatch: ',
  citationsWord: 'citations',
  soleSourceWarning: 'Sole source for {count} claim(s)',
  copyUrlBtn: '📋 Copy URL',
  undoReplaceBtn: '↩ Undo replace',
  closeReplaceBtn: '✕ Close replace',
  replaceSourceBtn: '🔀 Replace source',
  undoRejectBtn: '↩ Undo reject',
  rejectSourceBtn: '🚫 Reject source',
  replaceCitationsWithLabel: '🔀 Replace {count} citation(s) with:',
  letAgyChooseOption: '(Let AGY choose / strip footnote)',
  selectOrPasteSourceOption: '(Select existing source or paste URL below…)',
  pasteCanonicalUrlPlaceholder: 'Or paste canonical https:// URL directly (1 step)…',
  useUrlBtn: 'Use URL',
  showSoleClaimsSummary: 'Show {count} claim(s) backed solely by [^{id}]',
  graphClickHint: 'Click an OKF node in the graph to inspect the concept and its citations.',
  sourcesCountHeading: 'Sources ({count}):',
  citedByCountHeading: 'Cited by ({count}):',
  noGraphNodesEmpty: 'No nodes in OKF knowledge graph yet.',
  agyApproveStage1:
    'I have reviewed a2ui.html and approve all sources — run {cli} and proceed to Stage 2.',
  agyApproveFull:
    'I have reviewed a2ui.html and approve all sources — run {cli} and refresh the A2UI studio.',
  agyRejectPrefix: 'Reject sources: [{list}].',
  agyReplacePrefix: 'Replace citations: [{list}].',
  agyAddPrefix: 'Add sources: [{list}].',
  agyCurateRunStage1:
    'Run {cli} (use --replace-source oldId=newId_or_URL in cli:verify to re-anchor citations from rejected sources to existing/added sources without rewriting research_summary.md; only edit specific sentences if factual claims must change) and proceed to Stage 2.',
  agyCurateRunFull:
    'Run {cli} (use --replace-source oldId=newId_or_URL in cli:verify to re-anchor citations without rewriting research_summary.md) to refresh the knowledge base and A2UI studio (without re-running Stage 2 unless claims changed).',
};

export const DEFAULT_ICM_PROSODY_LOCALE: IcmProsodyLocale = {
  to: 'to',
  or: 'or',
  minus: 'minus',
  negative: 'negative',
  plus: 'plus',
  approximately: 'approximately',
  plusOrMinus: 'plus or minus',
  atMost: 'at most',
  atLeast: 'at least',
  lessOrEqual: 'less than or equal to',
  greaterOrEqual: 'greater than or equal to',
  notEqual: 'not equal to',
  times: 'times',
  dividedBy: 'divided by',
  inEquilibriumWith: 'in equilibrium with',
  section: 'section',
  sections: 'sections',
  percent: 'percent',
  degrees: 'degrees',
  degreesCelsius: 'degrees Celsius',
  degreesFahrenheit: 'degrees Fahrenheit',
  specificImpulse: 'specific impulse',
  decibels: 'decibels',
  squareMeters: 'square meters',
  cubicMeters: 'cubic meters',
  squareKilometers: 'square kilometers',
  kilograms: 'kilograms',
  centimeters: 'centimeters',
  millimeters: 'millimeters',
  meter: 'meter',
  meters: 'meters',
  perHour: 'per hour',
  perSecond: 'per second',
  microG: 'micro-g',
  micrometers: 'micrometers',
  gramsPerCm3: 'grams per cubic centimeter',
  kgPerM3: 'kilograms per cubic meter',
  kmPerS: 'kilometers per second',
  mPerS2: 'meters per second squared',
  mPerS: 'meters per second',
  wattsPerM2: 'watts per square meter',
  kwPerKg: 'kilowatts per kilogram',
  dollarSingular: 'dollar',
  dollarPlural: 'dollars',
  per: 'per',
  magnitudes: {
    B: 'billion',
    M: 'million',
    T: 'trillion',
    K: 'thousand',
    bn: 'billion',
    mn: 'million',
  },
  unitSlashes: {
    kg: 'kilogram',
    g: 'gram',
    t: 'metric ton',
    ton: 'ton',
    tonne: 'metric ton',
    oz: 'ounce',
    sh: 'share',
    share: 'share',
    yr: 'year',
    year: 'year',
    mo: 'month',
    month: 'month',
    kwh: 'kilowatt-hour',
    mwh: 'megawatt-hour',
    kw: 'kilowatt',
    mw: 'megawatt',
  },
  abbreviations: {
    'e.g.,': 'for example,',
    'e.g.': 'for example,',
    'i.e.,': 'that is,',
    'i.e.': 'that is,',
    'vs.': 'versus',
  },
  voicePersonas: {
    warmGuideFemale:
      'A warm, clear, and reassuring female studio educator in her 30s speaking standard General American English at a steady, natural broadcast pace without hesitation.',
    warmGuideMale:
      'A warm, clear, and approachable male studio educator in his 30s speaking standard General American English at a steady, natural broadcast pace without hesitation.',
    calmSpecialistMale:
      'A calm, authoritative, and articulate male subject-matter specialist in his 40s with a steady low-mid studio baritone speaking standard General American English clearly without hesitation.',
    calmSpecialistFemale:
      'A calm, authoritative, and articulate female subject-matter specialist in her 40s speaking standard General American English in a clear, steady studio voice without hesitation.',
  },
};

export const DEFAULT_ICM_LOCALE: IcmLocalePack = {
  bcp47: 'en-US',
  languageName: 'English',
  ui: DEFAULT_ICM_UI_LOCALE,
  prosody: DEFAULT_ICM_PROSODY_LOCALE,
};

/**
 * Interpolates `{key}` tokens inside a locale template string.
 */
export function formatLocaleTemplate(
  template: string,
  vars?: Record<string, string | number | undefined>
): string {
  const raw = String(template ?? '');
  if (!vars) return raw;
  return raw.replace(/\{([a-zA-Z0-9_]+)\}/g, (match, key: string) => {
    const val = vars[key];
    return val === undefined || val === null ? match : String(val);
  });
}

/**
 * Deep-merges a partial Layer 3 `locale.json` object onto `DEFAULT_ICM_LOCALE`.
 */
export function mergeIcmLocalePack(
  partial?: Partial<IcmLocalePack> | Record<string, any> | null
): IcmLocalePack {
  if (!partial || typeof partial !== 'object') {
    return {
      bcp47: DEFAULT_ICM_LOCALE.bcp47,
      languageName: DEFAULT_ICM_LOCALE.languageName,
      ui: { ...DEFAULT_ICM_UI_LOCALE },
      prosody: {
        ...DEFAULT_ICM_PROSODY_LOCALE,
        magnitudes: { ...DEFAULT_ICM_PROSODY_LOCALE.magnitudes },
        unitSlashes: { ...DEFAULT_ICM_PROSODY_LOCALE.unitSlashes },
        abbreviations: { ...DEFAULT_ICM_PROSODY_LOCALE.abbreviations },
        voicePersonas: { ...DEFAULT_ICM_PROSODY_LOCALE.voicePersonas },
      },
    };
  }
  const rawUi = partial.ui && typeof partial.ui === 'object' ? partial.ui : {};
  const rawProsody =
    partial.prosody && typeof partial.prosody === 'object' ? partial.prosody : {};

  const cleanUi: Record<string, string> = { ...DEFAULT_ICM_UI_LOCALE };
  const defaultUiRecord = DEFAULT_ICM_UI_LOCALE as unknown as Record<string, string>;
  for (const [k, v] of Object.entries(rawUi)) {
    if (typeof v === 'string' && v.trim()) {
      const baseTemplate = defaultUiRecord[k];
      if (typeof baseTemplate === 'string') {
        const requiredPlaceholders = baseTemplate.match(/\{[a-zA-Z0-9_]+\}/g) || [];
        if (requiredPlaceholders.some((tok) => !v.includes(tok))) {
          continue;
        }
      }
      cleanUi[k] = v;
    }
  }

  let normalizedAbbreviations: Record<string, string> | undefined;
  if (Array.isArray(rawProsody.abbreviations)) {
    normalizedAbbreviations = {};
    for (const item of rawProsody.abbreviations) {
      if (
        item &&
        typeof item === 'object' &&
        typeof item.shortForm === 'string' &&
        typeof item.spokenExpansion === 'string'
      ) {
        const sk = item.shortForm.trim();
        const sv = item.spokenExpansion.trim();
        if (sk && sv) normalizedAbbreviations[sk] = sv;
      }
    }
  } else if (rawProsody.abbreviations && typeof rawProsody.abbreviations === 'object') {
    normalizedAbbreviations = {};
    for (const [ak, av] of Object.entries(rawProsody.abbreviations)) {
      if (typeof av === 'string' && ak.trim() && av.trim()) {
        normalizedAbbreviations[ak.trim()] = av.trim();
      }
    }
  }

  const rawPersonas =
    rawProsody.voicePersonas && typeof rawProsody.voicePersonas === 'object'
      ? rawProsody.voicePersonas
      : {};
  const mergedVoicePersonas: IcmVoicePersonaLocale = {
    ...DEFAULT_ICM_PROSODY_LOCALE.voicePersonas,
  };
  for (const pk of [
    'warmGuideFemale',
    'warmGuideMale',
    'calmSpecialistMale',
    'calmSpecialistFemale',
  ] as const) {
    if (typeof rawPersonas[pk] === 'string' && rawPersonas[pk].trim()) {
      mergedVoicePersonas[pk] = rawPersonas[pk].trim();
    }
  }

  const cleanProsody: Record<string, any> = {
    ...DEFAULT_ICM_PROSODY_LOCALE,
    magnitudes: {
      ...DEFAULT_ICM_PROSODY_LOCALE.magnitudes,
      ...(rawProsody.magnitudes && typeof rawProsody.magnitudes === 'object'
        ? rawProsody.magnitudes
        : {}),
    },
    unitSlashes: {
      ...DEFAULT_ICM_PROSODY_LOCALE.unitSlashes,
      ...(rawProsody.unitSlashes && typeof rawProsody.unitSlashes === 'object'
        ? rawProsody.unitSlashes
        : {}),
    },
    abbreviations:
      normalizedAbbreviations !== undefined
        ? normalizedAbbreviations
        : String(partial.bcp47 || '').toLowerCase().startsWith('en')
          ? { ...DEFAULT_ICM_PROSODY_LOCALE.abbreviations }
          : {},
    voicePersonas: mergedVoicePersonas,
  };
  for (const [k, v] of Object.entries(rawProsody)) {
    if (
      k === 'magnitudes' ||
      k === 'unitSlashes' ||
      k === 'abbreviations' ||
      k === 'voicePersonas'
    ) {
      continue;
    }
    if (typeof v === 'string' && v.length > 0) {
      cleanProsody[k] = v;
    }
  }

  return {
    bcp47:
      typeof partial.bcp47 === 'string' && partial.bcp47.trim()
        ? normalizeBcp47Tag(partial.bcp47)
        : DEFAULT_ICM_LOCALE.bcp47,
    languageName:
      typeof partial.languageName === 'string' && partial.languageName.trim()
        ? partial.languageName.trim()
        : DEFAULT_ICM_LOCALE.languageName,
    ui: cleanUi as unknown as IcmUiLocale,
    prosody: cleanProsody as unknown as IcmProsodyLocale,
  };
}

/**
 * Resolves the canonical `<workspaceRoot>/_config/locale.json` path from a workspace root,
 * `bundle/` subdirectory, or `runs/<runId>` subdirectory.
 */
export function resolveWorkspaceLocalePath(workspaceOrSubPath?: string): string {
  const startDir = path.resolve(workspaceOrSubPath || './workspace');
  const directCandidate = path.join(startDir, '_config', 'locale.json');
  if (fs.existsSync(directCandidate)) return directCandidate;

  // Walk up at most 3 levels (e.g. `workspace/bundle/research` or `workspace/runs/<runId>`)
  let current = startDir;
  for (let depth = 0; depth < 3; depth++) {
    const baseName = path.basename(current).toLowerCase();
    const parent = path.dirname(current);
    if (parent === current) break;
    const parentCandidate = path.join(parent, '_config', 'locale.json');
    if (fs.existsSync(parentCandidate)) {
      return parentCandidate;
    }
    if (baseName === 'bundle' || baseName === 'runs') {
      return parentCandidate;
    }
    current = parent;
  }
  return directCandidate;
}

/**
 * Synchronously loads Layer 3 `<workspaceRoot>/_config/locale.json` if present on disk,
 * falling back to `DEFAULT_ICM_LOCALE` (English) at zero token cost.
 */
export function loadWorkspaceLocale(workspaceOrSubPath?: string): IcmLocalePack & { hasCustomFile: boolean } {
  const localePath = resolveWorkspaceLocalePath(workspaceOrSubPath);
  if (fs.existsSync(localePath)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(localePath, 'utf-8'));
      return { ...mergeIcmLocalePack(parsed), hasCustomFile: true };
    } catch {
      // Fall back to default English pack on malformed JSON
    }
  }
  return { ...mergeIcmLocalePack(null), hasCustomFile: false };
}

/**
 * Persists a Layer 3 `locale.json` pack to `<workspaceRoot>/_config/locale.json`.
 */
export function saveWorkspaceLocale(
  workspaceRoot: string,
  pack: Partial<IcmLocalePack>
): string {
  const localePath = path.join(path.resolve(workspaceRoot), '_config', 'locale.json');
  const merged = mergeIcmLocalePack(pack);
  fs.mkdirSync(path.dirname(localePath), { recursive: true });
  fs.writeFileSync(localePath, JSON.stringify(merged, null, 2) + '\n', 'utf-8');
  return localePath;
}

/**
 * Normalizes a BCP-47 tag (`nb-no` -> `nb-NO`, `en` -> `en`).
 */
export function normalizeBcp47Tag(rawTag: string): string {
  const parts = String(rawTag || '')
    .trim()
    .replace(/_/g, '-')
    .split('-')
    .filter(Boolean);
  if (parts.length === 0) return 'en-US';
  if (parts.length === 1) return parts[0].toLowerCase();
  return [
    parts[0].toLowerCase(),
    ...parts.slice(1).map((p) => (p.length === 2 || /^\d+$/.test(p) ? p.toUpperCase() : p)),
  ].join('-');
}

/**
 * Infers a primary IETF BCP-47 language tag across 20+ world scripts and languages
 * using Unicode script blocks and pure closed-class function words (zero domain nouns).
 */
export function inferBcp47LanguageCode(text?: string): string {
  const sample = String(text || '').trim();
  if (!sample) return 'en-US';
  if (/^[a-z]{2}(?:-[a-zA-Z0-9]{2,4})?$/.test(sample)) {
    const low = sample.toLowerCase();
    if (low === 'no' || low === 'nb') return 'nb-NO';
    if (low === 'nn') return 'nn-NO';
    if (low === 'en') return 'en-US';
    if (sample.includes('-')) return normalizeBcp47Tag(sample);
  }

  // Non-Latin script blocks
  if (/[\u3040-\u30ff]/.test(sample)) return 'ja-JP';
  if (/[\uac00-\ud7af]/.test(sample)) return 'ko-KR';
  if (/[\u4e00-\u9fff]/.test(sample)) return 'zh-CN';
  if (/[\u0600-\u06ff]/.test(sample)) return 'ar-SA';
  if (/[\u0400-\u04ff]/.test(sample)) {
    return /[іїєґІЇЄҐ]/.test(sample) ? 'uk-UA' : 'ru-RU';
  }
  if (/[\u0900-\u097f]/.test(sample)) return 'hi-IN';
  if (/[\u0370-\u03ff]/.test(sample)) return 'el-GR';
  if (/[\u0590-\u05ff]/.test(sample)) return 'he-IL';
  if (/[\u0e00-\u0e7f]/.test(sample)) return 'th-TH';

  // Distinctive Latin orthographies
  if (/[ðþÐÞ]/.test(sample)) return 'is-IS';
  if ((sample.match(/[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/g) || []).length >= 2) return 'pl-PL';

  const count = (re: RegExp): number => (sample.match(re) || []).length;

  // Pure function-word + diacritic scoring across European languages (case-sensitive on short tokens to avoid English ALL-CAPS acronym collisions like SOM/FRA/LOV)
  const fiScore = count(/\b(ja|on|ei|että|mutta|kanssa|ovat|kuin|myös|sekä|tämä)\b/gi) * 3;
  const svScore =
    count(/\b(och|att|är|inte|från|också|detta|genom\w*|finns|mycket)\b/gi) * 3 +
    count(/[äöÄÖ]/g) +
    count(/[åÅ]/g);
  const deScore =
    count(/[ß]/g) * 4 +
    count(/\b(der|die|das|und|nicht|mit|für|von|auf|ist|sind|werden|auch|oder|durch|gemäß)\b/gi) * 2;
  const daScore =
    count(/\b(af|bliver|blevet|hvordan|også|gennem\w*|deres|mellem|skulle)\b/gi) * 3 +
    count(/\b\w{4,}hed(?:en|er|ens)?\b/gi) * 2 +
    count(/[æøåÆØÅ]/g);
  const nnScore =
    count(/\b(ikkje|korleis|kva|ein|eit|dei|frå\w*|mellom|også|vert)\b/gi) * 4 +
    count(/[æøåÆØÅ]/g);
  const nbScore =
    count(/\b(ikke|hvordan|hvorfor|mellom|gjennom\w*|dersom|blir|blitt|også|deres|annet|ulike)\b/gi) * 3 +
    count(/\b\w{4,}het(?:en|er|ens|ene)?\b/gi) * 2 +
    count(/\b(og|det|som|med|til|fra|har|i|skal|må|kan|ved|av|på)\b/g) +
    count(/[æøåÆØÅ]/g) * 2;
  const frScore =
    count(/[œçàèùâêîôû]/gi) +
    count(/\b(les|des|est|une|dans|pour|pas|plus|avec|sur|sont|cette|aux|mais)\b/gi) * 2;
  const esScore =
    count(/[ñ¿¡]/gi) * 4 +
    count(/\b(los|las|del|una|para|con|por|como|más|pero|sus|esta|entre|sobre)\b/gi) * 2;
  const ptScore =
    count(/[ãõ]/gi) * 4 +
    count(/\b(não|uma|para|com|dos|das|mais|como|pelo|pela|são|está|entre)\b/gi) * 2;
  const itScore =
    count(/\b(che|non|per|una|con|del|della|sono|anche|più|questo|questa|degli|delle)\b/gi) * 2;
  const nlScore =
    count(/\b(het|een|van|dat|niet|voor|met|zijn|worden|naar|ook|deze|door)\b/gi) * 2;
  const enScore =
    count(
      /\b(the|and|with|from|that|this|are|was|were|have|has|had|will|would|should|could|which|their|there|about|into|between|without|within|through|during|before|after|under)\b/gi
    ) * 2;

  const candidates: Array<[string, number]> = [
    ['fi-FI', fiScore],
    ['sv-SE', svScore],
    ['de-DE', deScore],
    ['nn-NO', nnScore],
    ['da-DK', daScore > nbScore ? daScore : 0],
    ['nb-NO', nbScore],
    ['fr-FR', frScore],
    ['es-ES', esScore],
    ['pt-BR', ptScore],
    ['it-IT', itScore],
    ['nl-NL', nlScore],
    ['en-US', enScore],
  ];
  candidates.sort((a, b) => b[1] - a[1]);
  if (candidates[0][1] >= 3) {
    if (candidates[0][0] === 'nb-NO' && enScore >= nbScore) {
      return 'en-US';
    }
    return candidates[0][0];
  }
  return 'en-US';
}
