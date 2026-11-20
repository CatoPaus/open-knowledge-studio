import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { execFileSync, spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

import { DEFAULT_EN_UI_LOCALE, DEFAULT_ICM_LOCALE, GEMINI_4_ARGON_MODEL, GEMINI_FLASH_TTS_MODEL, GEMINI_NANO_BANANA_MODEL, type IcmLocalePack, MAX_TTS_CHARS_PER_CALL, VOICES_API_URL, computeVoiceLockFingerprint, createPromptedVoice, detectMediaMimeAndExtension, ensureWorkspaceLockedVoice, generateFlashTtsAudioInteraction, getPrebuiltStudioVoiceProfile, inferBcp47LanguageCode, isCustomVoiceId, isPrebuiltStudioVoiceName, loadDotEnvIfExists, loadStagePromptContract, loadWorkspaceLocale, mergeIcmLocalePack, parseWavMetadata, renderPromptTemplate, resampleWav16BitMono, resolveWorkspaceLocalePath, sanitizeStyleForLockedVoice, saveWorkspaceLocale, splitTtsTranscriptIntoSafeChunks, wrapPcm16InWavHeader } from '../interactions/index.js';
import { type OkfAdjudicationItem, appendBundleLog, applyIntermissionAdjudications, cleanGroundingLinks, curateOkfSources, decodeHtmlEntities, enrichBareDomainSourceTitle, extractHtmlModifiedFromSnippet, extractHtmlTitleFromSnippet, extractIntermissionAdjudications, extractPdfModifiedFromLatin1, findTrailingRelatedConceptsHeadingIndex, formatSourceUrlMiddleEllipsis, generateSourceSlugId, getCanonicalSourceDedupeKeys, getOkfTrustTier, healOrphanOkfFootnotes, inferSourceMimeTypeFromUrl, injectBidirectionalBundleLinks, inspectReferenceExtractionIntegrity, inspectSourceDomainProvenance, isInternalConceptLinkBullet, isLowSignalGroundingUrl, isMultiRecordArchiveUrl, isOkfBlank, isOkfStale, isOkfStatusCurrent, isPdfBlockedByBrowserCsp, mergeConceptDocuments, normalizeCanonicalSourceUrl, normalizeHttpMimeType, normalizeOkfActor, normalizeOkfSources, normalizeOkfTags, parseOkfDocument, parseOkfTimestampMs, parsePdfDateToIso, regenerateBundleIndexes, resolveRedirect, sanitizeDominantScriptBpeOutliers, serializeOkfDocument, shouldUpgradeSourceTitle, stripTrailingEmptyCitationSection, stripTrailingPortalViewChrome, syncRunToBundle, transliterateNordicAscii, truncateSlugAtWordBoundary, validateOkfBundle } from '../okf/index.js';
import { OKF_VIZ_JS, detectIcmDomainMode, detectIcmLanguage, generateBundleVisualization, walkBundleConcepts } from '../viz/index.js';
import { A2UI_BASIC_CATALOG_ID, A2UI_ICM_CATALOG_ID, A2UI_STUDIO_CSS, A2UI_STUDIO_JS, type A2uiEnvelopeMessage, type A2uiUpdateComponentsMessage, type A2uiUpdateDataModelMessage, DEFAULT_MAX_ARTIFACT_AUDIO_BYTES, cleanChecklistLabel, closeActiveA2uiPingPongListener, extractChecklistGroupsFromMarkdown, extractDiagramsFromMarkdown, generateA2uiSurface, hasAntigravityBrowserCapability, isAllowedA2uiMediaUrl, normalizeStage2ForA2ui, setJsonPointer, startA2uiPingPongListener, syncA2uiToArtifactDir, validateA2uiSurfaceMessages } from '../a2ui/index.js';
import { checkUpstreamSpecs, formatIcmPipelineStatus, getIcmPipelineStatus } from '../ops/index.js';
import { type VerifyOkfOptions, buildDefaultVoiceLockPrompt, buildStage2AdjudicationsPreamble, classifyBlockRegisterHeuristic, directSemanticDualVoiceAssignment, ensureWorkspaceLocaleConfig, loadWorkspaceLayers, mergeConsecutiveSpeakerTurns, prepareTextForStudioTts, resolveDownstreamRunId, resolveStage4LanguageCode, resolveStage4VoiceDesignPrompt, runStage1Flow, runStage2Flow, runStage3Flow, runStage4Flow, sanitizeSpokenJson, sanitizeTtsStyleInstruction, segmentStage4DialogueTurns, verifyOkfConcept } from '../pipeline/index.js';

const NB_NO_TEST_LOCALE: Partial<IcmLocalePack> = {
  bcp47: 'nb-NO',
  languageName: 'Norwegian Bokmål',
  ui: {
    ...DEFAULT_ICM_LOCALE.ui,
    relatedConceptsHeading: '## Relaterte konsepter i kunnskapsbasen',
    referencedInConcept: '- **Referert i konsept:** [/{id}.md](/{id}.md) (*{title}*)',
    challengePrefix: 'Utfordring / Spørsmål: {question}',
    keyCheckpoints: 'Sentrale kontrollpunkter:',
    keyCheckpointsWithBasis: 'Sentrale kontrollpunkter ({basis}):',
    rationaleLabel: '📌 Faglig begrunnelse:',
    defaultVerifierActor: 'human:fagansvarlig',
    verifiedSourcesCount: '{count} verifiserte kilder',
    tabSearchTraceCount: '🔎 Søk & Grounding-logg ({count} søk)',
    tabChecklistCount: '✅ Interaktiv Sjekkliste ({count})',
    tabModulesCourseCount: '🎓 Moduler ({count})',
    tabQuizCount: '🧪 Quiz ({count})',
    stage1TelemetryHeading: '### 📊 Stage 1 Telemetri & Grounding-statistikk',
    stage1ExecutedQueriesHeading: '### 🔎 Utførte Google-søk ({count})',
    agyApproveStage1:
      'Jeg har gjennomgått a2ui.html og godkjenner alle kildene — kjør {cli} og gå videre til Stage 2.',
    agyApproveFull:
      'Jeg har gjennomgått a2ui.html og godkjenner alle kildene — kjør {cli} og oppdater A2UI-studioet.',
    agyRejectPrefix: 'Avvis kilder: [{list}].',
    agyReplacePrefix: 'Erstatt siteringer: [{list}].',
    agyAddPrefix: 'Legg til kilder: [{list}].',
    agyCurateRunStage1:
      'Kjør {cli} (bruk --replace-source i cli:verify) og gå videre til Stage 2.',
    agyCurateRunFull:
      'Kjør {cli} for å oppdatere kunnskapsgrunnlaget og A2UI-studioet (uten å kjøre Stage 2 på nytt med mindre påstander må endres).',
  },
  prosody: {
    ...DEFAULT_ICM_LOCALE.prosody,
    to: 'til',
    minus: 'minus',
    negative: 'minus',
    plus: 'pluss',
    approximately: 'omtrent',
    plusOrMinus: 'pluss eller minus',
    atMost: 'inntil',
    atLeast: 'minst',
    lessOrEqual: 'mindre enn eller lik',
    greaterOrEqual: 'større enn eller lik',
    notEqual: 'ikke lik',
    times: 'ganger',
    dividedBy: 'delt på',
    inEquilibriumWith: 'i likevekt med',
    section: 'paragraf',
    sections: 'paragrafene',
    percent: 'prosent',
    degrees: 'grader',
    degreesCelsius: 'grader celsius',
    degreesFahrenheit: 'grader fahrenheit',
    specificImpulse: 'spesifikk impuls',
    decibels: 'desibel',
    squareMeters: 'kvadratmeter',
    cubicMeters: 'kubikkmeter',
    squareKilometers: 'kvadratkilometer',
    kilograms: 'kilo',
    centimeters: 'centimeter',
    millimeters: 'millimeter',
    meter: 'meter',
    meters: 'meter',
    gramsPerCm3: 'gram per kubikkcentimeter',
    dollarSingular: 'dollar',
    dollarPlural: 'dollar',
    per: 'per',
    abbreviations: {
      'f.eks.': 'for eksempel',
      'dvs.': 'det vil si',
      'kl.': 'klokken',
      'vs.': 'versus',
    },
  },
};

/**
 * Runs a zero-token, zero-network self-test suite covering:
 * 1. OKF v0.3 parser/serializer round-trip, current-only trust tiers, and staleness detection (`retrieved_at`, `last_modified`).
 * 2. `cleanGroundingLinks()` multi-byte UTF-8 byte-offset snapping (`æ`, `ø`, `å`, `§`, `—`), Markdown heading/table guards,
 *    closing emphasis/bracket snapping (`**bold**`, `(Tier 1)`), `.^id` / `.[^id]` normalization, `isFinalStep` filtering,
 *    and cited-only footnote definitions (`citedFootnoteIds`).
 * 3. A2UI v1.0 `validateA2uiSurfaceMessages()`, `cleanChecklistLabel()` (`**bold**`, `*italic*`, `` `code` ``, `[^id]`),
 *    and `normalizeStage2ForA2ui()` concise `CaseSimulator` synthesis.
 */
export async function runIcmSelfTests(): Promise<{ passed: number }> {
  let assertions = 0;
  function assert(condition: unknown, message: string): void {
    if (!condition) {
      throw new Error(`[ICM Self-Test FAILED] ${message}`);
    }
    assertions++;
  }

  // 0. Programmatic TypeScript typecheck (tsc --noEmit) so `npm test` needs no shell `&&` chaining.
  // Supports zero-node_modules clones & Git worktrees (resolving typescript from the main worktree when present).
  const repoRootForTsc = fileURLToPath(new URL('../..', import.meta.url));
  const tscCandidates = [
    path.resolve(process.cwd(), 'node_modules/typescript/bin/tsc'),
    path.resolve(process.cwd(), 'node_modules/typescript/lib/tsc.js'),
    path.resolve(repoRootForTsc, 'node_modules/typescript/bin/tsc'),
    path.resolve(repoRootForTsc, 'node_modules/typescript/lib/tsc.js'),
  ];
  const dotGitPath = path.join(repoRootForTsc, '.git');
  let extraTypeRoot: string | null = null;
  if (fs.existsSync(dotGitPath) && fs.statSync(dotGitPath).isFile()) {
    const gitDirRaw = fs.readFileSync(dotGitPath, 'utf-8').trim();
    const m = /^gitdir:\s*(.+)$/i.exec(gitDirRaw);
    if (m) {
      const worktreeGitDir = path.resolve(repoRootForTsc, m[1].trim());
      const commonMainRoot = path.resolve(worktreeGitDir, '../../..');
      const commonTypes = path.join(commonMainRoot, 'node_modules/@types');
      if (fs.existsSync(commonTypes)) {
        extraTypeRoot = commonTypes;
      }
      tscCandidates.push(
        path.join(commonMainRoot, 'node_modules/typescript/bin/tsc'),
        path.join(commonMainRoot, 'node_modules/typescript/lib/tsc.js')
      );
    }
  }
  const resolvedTscBin = tscCandidates.find((p) => fs.existsSync(p));
  const tscCwd = fs.existsSync(path.resolve(process.cwd(), 'tsconfig.json'))
    ? process.cwd()
    : repoRootForTsc;
  const localTypesExist = fs.existsSync(path.join(tscCwd, 'node_modules/@types/node'));
  try {
    if (resolvedTscBin && (localTypesExist || extraTypeRoot)) {
      const tscArgs = ['--noEmit', ...(!localTypesExist && extraTypeRoot ? ['--typeRoots', extraTypeRoot] : [])];
      execFileSync(process.execPath, [resolvedTscBin, ...tscArgs], {
        cwd: tscCwd,
        stdio: 'pipe',
        encoding: 'utf-8',
      });
    }
    assertions++;
  } catch (err: any) {
    const stderr = err?.stderr || err?.stdout || err?.message || String(err);
    throw new Error(`[ICM Self-Test FAILED] TypeScript typecheck (tsc --noEmit) failed:\n${stderr}`);
  }

  // 1. OKF v0.3 round-trip, trust tier, and staleness
  const rawOkfSample = [
    '---',
    'type: Research Concept',
    'title: "Krisevernleders plikter — æøå § 11"',
    'description: "Systematisk sikkerhetsarbeid i henhold til FOB og BPL."',
    'tags: [krisevern, fob, kontroll]',
    'status: draft',
    'generated:',
    '  by: agent:gemini-4-argon',
    '  at: 2026-10-30T10:00:00Z',
    'stale_after: 2099-01-01',
    'sources:',
    '  - id: lovdata-fob',
    '    title: "Forskrift om kriseforebygging (FOB)"',
    '    resource: "https://lovdata.no/dokument/SF/forskrift/2015-12-17-1710"',
    '    retrieved_at: 2026-10-30',
    '    last_modified: 2024-01-01',
    '---',
    '',
    '# Oversikt',
    '',
    'Eier skal dokumentere krisesikkerhet[^lovdata-fob].',
    '',
    '[^lovdata-fob]: Forskrift om kriseforebygging (FOB)',
    '',
  ].join('\n');

  const parsedOkf = parseOkfDocument(rawOkfSample);
  assert(parsedOkf.frontmatter.title === 'Krisevernleders plikter — æøå § 11', 'OKF title parsed');
  assert(getOkfTrustTier(parsedOkf.frontmatter) === 'unverified', 'Draft status maps to unverified trust tier');
  assert(isOkfStale(parsedOkf.frontmatter) === false, 'Future stale_after is fresh');
  assert(
    Array.isArray(parsedOkf.frontmatter.sources) &&
      parsedOkf.frontmatter.sources[0]?.retrieved_at === '2026-10-30' &&
      parsedOkf.frontmatter.sources[0]?.last_modified === '2024-01-01',
    'OKF source retrieved_at and last_modified preserved on parse'
  );

  const serializedOkf = serializeOkfDocument(parsedOkf);
  const reparsedOkf = parseOkfDocument(serializedOkf);
  assert(
    reparsedOkf.frontmatter.sources?.[0]?.retrieved_at === '2026-10-30T00:00:00Z' &&
      reparsedOkf.frontmatter.sources?.[0]?.last_modified === '2024-01-01T00:00:00Z',
    'OKF source retrieved_at and last_modified normalize to ISO 8601 UTC and survive serialize -> parse round-trip'
  );
  assert(
    getOkfTrustTier({ status: 'stable', verified: [{ by: 'human:ana', at: '2026-10-30' }] }) === 'human-reviewed',
    'Human verifier yields human-reviewed trust tier'
  );
  assert(
    getOkfTrustTier({ status: 'stable', verified: [{ by: 'agent:gemini-4-argon', at: '2026-10-30' }] }) ===
      'machine-confirmed',
    'Agent verifier yields machine-confirmed trust tier'
  );
  assert(isOkfStale({ stale_after: '2020-01-01' }) === true, 'Past stale_after is detected as stale');

  // 2. cleanGroundingLinks() UTF-8, heading/table skip, closing emphasis/paren/section snap, slash-joined word snap, .^id typo, isFinalStep, citedFootnoteIds, bare-domain enrichment & uncited fm.sources filtering
  const lineHeading = '## 1. Hovedkrav for særskilte kriseobjekter (§ 13)';
  const lineTable = '| Risikoklasse | Krav til rømningsvei | Kontroll |';
  const lineProse =
    'Etter FOB § 4 skal krisevernleder påse at **rømningsveier** og (RK 1) er frie og forebygge overtredelser/avvik i drift. Kravet gjelder også næringsbygg.^dibk-no.^lovdata-fob Dette er påbudt.[^lovdata-fob]';
  const bodyMd = [
    lineHeading,
    '',
    lineTable,
    '',
    lineProse,
    '',
    '[^lovdata-fob]: Forskrift om kriseforebygging',
    '[^dibk-no]: dibk.no',
    '[^uncited-dangling]: Dangling Uncited Source',
  ].join('\n');

  const fmPrefix = [
    '---',
    'type: Research Concept',
    'title: "Test UTF-8 Grounding"',
    'status: draft',
    'sources:',
    '  - id: lovdata-fob',
    '    title: "Forskrift om kriseforebygging"',
    '    resource: "https://lovdata.no/dokument/SF/forskrift/2015-12-17-1710"',
    '  - id: dibk-no',
    '    title: "dibk.no"',
    '    resource: "https://dibk.no/regelverk/byggteknisk-forskrift-tek17/"',
    '  - id: uncited-fm-source',
    '    title: "Uncited Frontmatter Source"',
    '    resource: "https://example.com/uncited-fm"',
    '---',
    '',
  ].join('\n');
  const rawTestMarkdown = `${fmPrefix}${bodyMd}`;
  const fmBytePrefix = Buffer.byteLength(fmPrefix, 'utf-8');

  const bodyBuf = Buffer.from(bodyMd, 'utf-8');
  // Byte offset inside the heading (should be skipped)
  const headingByteOffset = fmBytePrefix + Buffer.from('## 1. Hovedkrav for sær', 'utf-8').length;
  // Byte offset inside the table row (should be skipped)
  const tableStartByte =
    fmBytePrefix + Buffer.from(lineHeading + '\n\n| Risikoklasse | Krav til røm', 'utf-8').length;
  // Byte offset right after '§' in 'Etter FOB § 4 skal' (should snap past ' 4' and NOT consume 'skal krisevernleder...')
  const sectionSymbolByteOffset =
    fmBytePrefix + Buffer.from(lineHeading + '\n\n' + lineTable + '\n\nEtter FOB §', 'utf-8').length;
  // Byte offset landing mid-word and mid-UTF8 on 'rømningsveier' inside **rømningsveier**
  const prosePrefixBeforeRomning =
    lineHeading + '\n\n' + lineTable + '\n\nEtter FOB § 4 skal krisevernleder påse at **r';
  // +1 byte into 'ø' (0xC3 0xB8) to test mid-codepoint UTF-8 continuation byte safety + snapping past **
  const midUtf8BoldByteOffset =
    fmBytePrefix + Buffer.from(prosePrefixBeforeRomning, 'utf-8').length + 1;
  // Byte offset landing inside (RK 1) right before closing ')'
  const prosePrefixBeforeParen =
    lineHeading + '\n\n' + lineTable + '\n\nEtter FOB § 4 skal krisevernleder påse at **rømningsveier** og (RK 1';
  const insideParenByteOffset = fmBytePrefix + Buffer.from(prosePrefixBeforeParen, 'utf-8').length;
  // Byte offset landing right before '/avvik' in 'overtredelser/avvik'
  const prosePrefixBeforeSlashWord =
    lineHeading +
    '\n\n' +
    lineTable +
    '\n\nEtter FOB § 4 skal krisevernleder påse at **rømningsveier** og (RK 1) er frie og forebygge overtredelser';
  const slashWordByteOffset = fmBytePrefix + Buffer.from(prosePrefixBeforeSlashWord, 'utf-8').length;

  const mockOutputs = [
    // Intermediate draft step (should be ignored because a later model_output exists)
    {
      type: 'model_output',
      content: [
        {
          type: 'text',
          text: 'Draft step text',
          annotations: [
            {
              type: 'url_citation',
              url: 'https://example.com/draft-ignored',
              title: 'Draft Ignored Source',
              start_index: 0,
              end_index: 10,
            },
          ],
        },
      ],
    },
    // Final model_output step
    {
      type: 'model_output',
      content: [
        {
          type: 'text',
          text: rawTestMarkdown,
          annotations: [
            {
              type: 'url_citation',
              url: 'https://lovdata.no/dokument/SF/forskrift/2015-12-17-1710',
              title: 'Forskrift om kriseforebygging',
              start_index: fmBytePrefix,
              end_index: headingByteOffset,
            },
            {
              type: 'url_citation',
              url: 'https://lovdata.no/dokument/SF/forskrift/2015-12-17-1710',
              title: 'Forskrift om kriseforebygging',
              start_index: headingByteOffset + 5,
              end_index: tableStartByte,
            },
            {
              type: 'url_citation',
              url: 'https://lovdata.no/dokument/SF/forskrift/2015-12-17-1710',
              title: 'Forskrift om kriseforebygging',
              start_index: tableStartByte + 5,
              end_index: sectionSymbolByteOffset,
            },
            {
              type: 'url_citation',
              url: 'https://lovdata.no/dokument/SF/forskrift/2015-12-17-1710',
              title: 'Forskrift om kriseforebygging',
              start_index: sectionSymbolByteOffset + 5,
              end_index: midUtf8BoldByteOffset,
            },
            {
              type: 'url_citation',
              url: 'https://dibk.no/regelverk/byggteknisk-forskrift-tek17/',
              title: 'dibk.no',
              start_index: midUtf8BoldByteOffset + 5,
              end_index: insideParenByteOffset,
            },
            {
              type: 'url_citation',
              url: 'https://lovdata.no/dokument/SF/forskrift/2015-12-17-1710',
              title: 'Forskrift om kriseforebygging',
              start_index: insideParenByteOffset + 5,
              end_index: slashWordByteOffset,
            },
          ],
        },
      ],
    },
  ];

  assert(
    fmBytePrefix + bodyBuf.length > slashWordByteOffset,
    'UTF-8 buffer covers test byte offsets'
  );
  const cleanedMd = await cleanGroundingLinks(rawTestMarkdown, mockOutputs, {
    bundleRoot: path.join(os.tmpdir(), 'icm-selftest-empty-bundle'),
  });
  assert(!cleanedMd.includes('\uFFFD'), 'No UTF-8 replacement characters (U+FFFD) after byte-offset injection');
  assert(
    cleanedMd.includes('## 1. Hovedkrav for særskilte kriseobjekter (§ 13)'),
    'Heading was not corrupted by byte-offset citation injection'
  );
  assert(
    cleanedMd.includes('| Risikoklasse | Krav til rømningsvei | Kontroll |'),
    'Markdown table row was not corrupted by byte-offset citation injection'
  );
  assert(
    cleanedMd.includes('Etter FOB § 4[^lovdata-fob] skal krisevernleder'),
    `Citation right after § snaps past section number " 4" without consuming subsequent words (got: "${cleanedMd}")`
  );
  assert(
    cleanedMd.includes('**rømningsveier**[^lovdata-fob]'),
    'Citation snapped cleanly past multi-byte ø and closing **bold** markers'
  );
  assert(
    cleanedMd.includes('(RK 1)[^dibk-no]'),
    'Citation snapped cleanly past closing parenthesis of (RK 1)'
  );
  assert(
    cleanedMd.includes('overtredelser/avvik[^lovdata-fob]') &&
      !cleanedMd.includes('overtredelser[^lovdata-fob]/avvik'),
    `Citation inside slash-joined word pair snaps past entire "overtredelser/avvik" token (got: "${cleanedMd}")`
  );
  assert(
    cleanedMd.includes('næringsbygg[^dibk-no] [^lovdata-fob].') && !cleanedMd.includes('..'),
    `Chained .^dibk-no.^lovdata-fob typos normalized to [^dibk-no] [^lovdata-fob]. without double period (got: "${cleanedMd}")`
  );
  assert(
    cleanedMd.includes('Dette er påbudt[^lovdata-fob].'),
    'Trailing .[^lovdata-fob] normalized to [^lovdata-fob].'
  );
  assert(
    !cleanedMd.includes('uncited-dangling') &&
      !cleanedMd.includes('draft-ignored') &&
      !cleanedMd.includes('uncited-fm-source'),
    'Uncited footnote definitions, uncited frontmatter sources, and non-final draft step sources are excluded'
  );
  assert(
    cleanedMd.includes('title: dibk.no — Byggteknisk forskrift tek17') &&
      cleanedMd.includes('[^dibk-no]: dibk.no — Byggteknisk forskrift tek17'),
    `Bare-domain title "dibk.no" enriched from URL slug in both frontmatter and footnote definition (got: "${cleanedMd}")`
  );
  assert(
    enrichBareDomainSourceTitle('dsb.no', 'https://dsb.no/') === 'dsb.no' &&
      enrichBareDomainSourceTitle('example.no', 'https://example.no/12345') === 'example.no',
    'Root-only and numeric-only URL paths fall back to clean bare domain'
  );
  assert(
    enrichBareDomainSourceTitle('snl.no', 'https://snl.no/krisevern_%C3%A6%C3%B8%C3%A5') ===
      'snl.no — Krisevern æøå' &&
      enrichBareDomainSourceTitle(
        'stortinget.no',
        'https://www.stortinget.no/no/Saker-og-publikasjoner/Vedtak/Beslutninger/Odelstinget/2008-2009/beso-200809-118/1'
      ) === 'stortinget.no — Beso 200809-118' &&
      enrichBareDomainSourceTitle(
        'www.ha.no',
        'https://www.ha.no/_f/p1/i71e106c5-9925-4d53-8efc-f5736e3ee5f0/veiledning-tilrettelegging-for-innsats-for-redning-og-slokkemannskaper-ha-kommune-uu.pdf'
      ) ===
        'ha.no — Veiledning tilrettelegging for innsats for redning og slokkemannskaper ha kommune uu' &&
      enrichBareDomainSourceTitle(
        'ilo.org',
        'https://wwwex.ilo.org/dyn/legosh_en/f?p=14100:503:0::NO::P503_REFERENCE_ID:310536'
      ) === 'ilo.org' &&
      enrichBareDomainSourceTitle(
        'ilo.org — Legosh en',
        'https://wwwex.ilo.org/dyn/legosh_en/f?p=14100:503:0::NO::P503_REFERENCE_ID:310536'
      ) === 'ilo.org' &&
      enrichBareDomainSourceTitle(
        'example.org',
        'https://example.org/pls/apex/f?p=100:1'
      ) === 'example.org' &&
      enrichBareDomainSourceTitle('Sommerskolen', 'https://orkrise.no/sommerskolen') ===
        'orkrise.no — Sommerskolen' &&
      enrichBareDomainSourceTitle('Sommerskolen', 'https://en.orkrise.no/sommerskolen') ===
        'en.orkrise.no — Sommerskolen' &&
      enrichBareDomainSourceTitle('dibk.no', 'https://www.dibk.no/regelverk/tek/3/11/iv/11-12') ===
        'dibk.no — Tek 11-12' &&
      enrichBareDomainSourceTitle(
        'lovdata.no',
        'https://lovdata.no/dokument/SF/forskrift/2015-12-17-1710/1'
      ) === 'lovdata.no — Forskrift 2015-12-17-1710' &&
      enrichBareDomainSourceTitle('example.no', 'https://example.no/nyheter/2024/11/12') ===
        'example.no — Nyheter 2024-11-12' &&
      enrichBareDomainSourceTitle(
        'dibk.no',
        'https://www.dibk.no/contentassets/c50f3c7dcbaa47a3bf4221ee88196aa5/-12-13.-dor-port-og-lignende-01.10.2030.09.21.pdf'
      ) === 'dibk.no — 12-13. Dor port og lignende 01.10.2030.09.21' &&
      enrichBareDomainSourceTitle(
        'regjeringen.no',
        'https://www.regjeringen.no/no/dokumenter/krise--og-eksplosjonsvernloven/id87138/'
      ) === 'regjeringen.no — Krise og eksplosjonsvernloven' &&
      enrichBareDomainSourceTitle(
        'regjeringen.no — Id87138',
        'https://www.regjeringen.no/no/dokumenter/krise--og-eksplosjonsvernloven/id87138/'
      ) === 'regjeringen.no — Krise og eksplosjonsvernloven' &&
      enrichBareDomainSourceTitle(
        'kniftrygghet.no',
        'https://www.kniftrygghet.no/ResourceServlet/af1f7f4264e0453ea33e7e2d0dd8680e'
      ) === 'kniftrygghet.no' &&
      enrichBareDomainSourceTitle(
        'kniftrygghet.no — ResourceServlet',
        'https://www.kniftrygghet.no/ResourceServlet/af1f7f4264e0453ea33e7e2d0dd8680e'
      ) === 'kniftrygghet.no',
    'enrichBareDomainSourceTitle decodes UTF-8, skips 1-char/APEX servlet (f?p=..., legosh_en, /pls/apex/f), Episerver /id<digits>/, and *Servlet paths, prefixes domain on 1-word titles ("Sommerskolen" -> "orkrise.no — Sommerskolen", including subdomains), and self-heals polluted titles'
  );
  assert(
    shouldUpgradeSourceTitle(
      'Regelverk med veiledning',
      'Veiledning til forskrift om kriseforebygging (§ 11 og § 12) — Direktoratet for samfunnssikkerhet og beredskap'
    ) === true &&
      shouldUpgradeSourceTitle(
        'Veiledning til forskrift om kriseforebygging (§ 11 og § 12) — Direktoratet for samfunnssikkerhet og beredskap',
        'Regelverk med veiledning'
      ) === false &&
      shouldUpgradeSourceTitle(
        'orkrise.no — Sommerskolen',
        'Sommerskolen',
        'https://orkrise.no/sommerskolen'
      ) === false,
    'shouldUpgradeSourceTitle upgrades short generic <4-word titles (<32 chars) when candidate is >=2x longer and >=45 chars, and never downgrades domain-prefixed 1-word titles'
  );

  // 2b. Duplicate-URL footnote alias rewriting & orphan footnote healing (cleanGroundingLinks + healOrphanOkfFootnotes)
  const dupAliasRawMd = [
    '---',
    'type: Research Concept',
    'title: "Test Duplicate URL Alias & Orphan Footnote Healing"',
    'status: draft',
    'sources:',
    '  - id: dsb-veiledning-kriseforebygging',
    '    title: "Veiledning til forskrift om kriseforebygging"',
    '    resource: "https://www.dsb.no/lover/krisevern-krisevesen-nodnett/veiledning-til-forskrift-om-kriseforebygging/"',
    '  - id: dsb-veiledning-kap3-4',
    '    title: "Veiledning til forskrift om kriseforebygging (§§ 13–15)"',
    '    resource: "https://www.dsb.no/lover/krisevern-krisevesen-nodnett/veiledning-til-forskrift-om-kriseforebygging/"',
    '  - id: dsb-faq-kriseforebygging',
    '    title: "Ofte stilte spørsmål til forskrift om kriseforebygging - DSB"',
    '    resource: "https://www.dsb.no/lover/krisevern-krisevesen-nodnett/artikler/ofte-stilte-sporsmal-til-forskrift-om-kriseforebygging/"',
    '  - id: snl-no',
    '    title: "snl.no — Internkontrollforskriften"',
    '    resource: "https://snl.no/internkontrollforskriften"',
    '  - id: regjeringen-no',
    '    title: "regjeringen.no — Id87138"',
    '    resource: "https://www.regjeringen.no/no/dokumenter/krise--og-eksplosjonsvernloven/id87138/"',
    '  - id: kniftrygghet-no',
    '    title: "kniftrygghet.no — ResourceServlet"',
    '    resource: "https://www.kniftrygghet.no/ResourceServlet/af1f7f4264e0453ea33e7e2d0dd8680e"',
    '---',
    '',
    'Eier har ansvar etter veiledningen^[^dsb-veiledning-kriseforebygging] og kapittel 3–4:[^dsb-veiledning-kap3-4]',
    'Slokkeutstyr kontrolleres jevnlig.[^dsb-faq-slokkeutstyr] I tråd med internkontroll;[^snl-internkontrollforskriften]',
    'Kriseloven[^regjeringen-no]:[^kniftrygghet-no] gjelder også[^hallucinated-nonexistent-999]. Samlet krav:[^dsb-veiledning-kriseforebygging];[^regjeringen-no].[^kniftrygghet-no]',
    '',
    '[^dsb-veiledning-kriseforebygging]: Veiledning til forskrift om kriseforebygging',
    '[^dsb-veiledning-kap3-4]: Veiledning til forskrift om kriseforebygging (§§ 13–15) - DSB',
    '[^dsb-faq-slokkeutstyr]: Ofte stilte spørsmål til forskrift om kriseforebygging (slokkeutstyr og NS 3910) - DSB',
    '[^snl-internkontrollforskriften]: snl-internkontrollforskriften',
    '[^regjeringen-no]: regjeringen.no — Id87138',
    '[^kniftrygghet-no]: kniftrygghet.no — ResourceServlet',
    '',
  ].join('\n');

  const cleanedDupMd = await cleanGroundingLinks(dupAliasRawMd, [], {
    bundleRoot: path.join(os.tmpdir(), 'icm-selftest-empty-bundle'),
  });
  const parsedCleanedDup = parseOkfDocument(cleanedDupMd);
  assert(
    !parsedCleanedDup.body.includes('[^dsb-veiledning-kap3-4]') &&
      !parsedCleanedDup.body.includes('[^dsb-faq-slokkeutstyr]') &&
      !parsedCleanedDup.body.includes('[^snl-internkontrollforskriften]') &&
      !parsedCleanedDup.body.includes('[^hallucinated-nonexistent-999]') &&
      !parsedCleanedDup.body.includes('^[^'),
    `cleanGroundingLinks rewrites duplicate-URL alias and orphan footnotes, strips redundant ^[^id] carets, and strips ungrounded footnotes (got body: "${parsedCleanedDup.body}")`
  );
  assert(
    parsedCleanedDup.body.includes('veiledningen[^dsb-veiledning-kriseforebygging]') &&
      parsedCleanedDup.body.includes('kapittel 3–4[^dsb-veiledning-kriseforebygging]:') &&
      parsedCleanedDup.body.includes('jevnlig[^dsb-faq-kriseforebygging].') &&
      parsedCleanedDup.body.includes('internkontroll[^snl-no];') &&
      parsedCleanedDup.body.includes('Kriseloven[^regjeringen-no] [^kniftrygghet-no]:') &&
      parsedCleanedDup.body.includes('Samlet krav[^dsb-veiledning-kriseforebygging] [^regjeringen-no] [^kniftrygghet-no].'),
    `cleanGroundingLinks normalizes sentence and clause punctuation ([.?!:;], including 3+ footnote chains) after footnote brackets and maps [^dsb-faq-slokkeutstyr] -> [^dsb-faq-kriseforebygging] and [^snl-internkontrollforskriften] -> [^snl-no] (got body: "${parsedCleanedDup.body}")`
  );
  const cleanedDupDefMatches = Array.from(parsedCleanedDup.body.matchAll(/^\[\^([^\]]+)\]:/gm));
  assert(
    Array.isArray(parsedCleanedDup.frontmatter.sources) &&
      parsedCleanedDup.frontmatter.sources.length === 5 &&
      cleanedDupDefMatches.length === 5,
    `cleanGroundingLinks produces exact 1:1 parity between frontmatter sources (5) and footnote definitions (got sources=${parsedCleanedDup.frontmatter.sources?.length}, defs=${cleanedDupDefMatches.length})`
  );

  // Also test healOrphanOkfFootnotes() directly on an already-saved OKF document with 26-style sources and 3 orphan footnotes
  const savedOrphanDoc = parseOkfDocument(
    dupAliasRawMd.replace(
      '  - id: dsb-veiledning-kap3-4\n    title: "Veiledning til forskrift om kriseforebygging (§§ 13–15)"\n    resource: "https://www.dsb.no/lover/krisevern-krisevesen-nodnett/veiledning-til-forskrift-om-kriseforebygging/"\n',
      ''
    )
  );
  const healedChanged = healOrphanOkfFootnotes(savedOrphanDoc);
  const healedDefMatches = Array.from(savedOrphanDoc.body.matchAll(/^\[\^([^\]]+)\]:/gm));
  const healedRegjeringen = savedOrphanDoc.frontmatter.sources?.find((s) => s.id === 'regjeringen-no');
  const healedKnif = savedOrphanDoc.frontmatter.sources?.find((s) => s.id === 'kniftrygghet-no');
  assert(
    healedChanged === true &&
      healedDefMatches.length === 5 &&
      !savedOrphanDoc.body.includes('[^dsb-veiledning-kap3-4]') &&
      !savedOrphanDoc.body.includes('[^dsb-faq-slokkeutstyr]') &&
      !savedOrphanDoc.body.includes('[^snl-internkontrollforskriften]') &&
      !savedOrphanDoc.body.includes('^[^') &&
      savedOrphanDoc.body.includes('veiledningen[^dsb-veiledning-kriseforebygging]') &&
      savedOrphanDoc.body.includes('kapittel 3–4[^dsb-veiledning-kriseforebygging]:') &&
      savedOrphanDoc.body.includes('jevnlig[^dsb-faq-kriseforebygging].') &&
      savedOrphanDoc.body.includes('internkontroll[^snl-no];') &&
      savedOrphanDoc.body.includes('Kriseloven[^regjeringen-no] [^kniftrygghet-no]:') &&
      savedOrphanDoc.body.includes('Samlet krav[^dsb-veiledning-kriseforebygging] [^regjeringen-no] [^kniftrygghet-no].') &&
      healedRegjeringen?.title === 'regjeringen.no — Krise og eksplosjonsvernloven' &&
      healedKnif?.title === 'kniftrygghet.no',
    `healOrphanOkfFootnotes self-heals orphan footnotes, strips ^[^id], normalizes [.?!:;] punctuation before footnotes (including 3+ footnote chains), and heals polluted Episerver/Servlet titles (defs=${healedDefMatches.length}, reg="${healedRegjeringen?.title}", knif="${healedKnif?.title}")`
  );

  // Test duplicate-URL title upgrade (bare-domain/short generic title -> rich descriptive title),
  // 1-token `.^alias` typo rewriting before alias cleanup, and trailing empty `## Kildehenvisninger` removal
  const shortTitleAndDotAliasMd = [
    '---',
    'type: Research Concept',
    'title: "Test Duplicate URL Title Upgrade & Dot-Caret Alias"',
    'status: draft',
    'sources:',
    '  - id: dsb-short',
    '    title: "DSB"',
    '    resource: "https://www.dsb.no/krisesikkerhet/veiledning-til-forskrift-om-kriseforebygging/"',
    '  - id: dup1',
    '    title: "Veiledning til forskrift om kriseforebygging (§§ 13–15) - DSB"',
    '    resource: "https://www.dsb.no/krisesikkerhet/veiledning-til-forskrift-om-kriseforebygging/"',
    '---',
    '',
    'Første krav[^dsb-short] og andre krav.^dup1',
    '',
    '---',
    '',
    '## Kildehenvisninger',
    '',
    '[^dsb-short]: DSB',
    '[^dup1]: Veiledning til forskrift om kriseforebygging (§§ 13–15) - DSB',
    '',
  ].join('\n');
  const cleanedShortAliasMd = await cleanGroundingLinks(shortTitleAndDotAliasMd, [], {
    bundleRoot: path.join(os.tmpdir(), 'icm-selftest-empty-bundle'),
  });
  const parsedShortAlias = parseOkfDocument(cleanedShortAliasMd);
  assert(
    parsedShortAlias.frontmatter.sources?.length === 1 &&
      parsedShortAlias.frontmatter.sources[0]?.id === 'dsb-short' &&
      parsedShortAlias.frontmatter.sources[0]?.title ===
        'Veiledning til forskrift om kriseforebygging (§§ 13–15) - DSB' &&
      !parsedShortAlias.body.includes('dup1') &&
      !parsedShortAlias.body.includes('## Kildehenvisninger'),
    `cleanGroundingLinks upgrades short generic duplicate-URL title, rewrites 1-token .^dup1 typo via sourceIdAliases, and strips trailing empty ## Kildehenvisninger (got: "${cleanedShortAliasMd}")`
  );
  assert(
    transliterateNordicAscii('Krisevern i Østfold: æøå ÆØÅ, arbeidsmiljøet og førstehjelp') ===
      'Krisevern i Ostfold: aeoa AeOA, arbeidsmiljoet og forstehjelp' &&
      generateSourceSlugId(
        'Østfold krise — Førstehjelp i arbeidsmiljøet',
        'https://ostfold-krise.no/forebyggende',
        new Set()
      ) === 'ostfold-krise-forstehjelp-i',
    'transliterateNordicAscii transliterates æ/ø/å/Æ/Ø/Å to ae/o/a/Ae/O/A before NFD normalization'
  );
  assert(
    truncateSlugAtWordBoundary(
      'systematisk-krisevern-ansvarsfordeling-og-krav-til-romningsveier-i-naeringsbygg',
      48
    ) === 'systematisk-krisevern-ansvarsfordeling-og-krav' &&
      truncateSlugAtWordBoundary(
        'systematisk-krisevern-ansvarsfordeling-og-krav-til-romningsveier-i-naeringsbygg',
        32
      ) === 'systematisk-krisevern' &&
      truncateSlugAtWordBoundary('krisesikker-bruk-av-elsparkesykkel', 32) ===
        'krisesikker-bruk-av',
    'truncateSlugAtWordBoundary snaps 48-char and 32-char slugs (including 34-char 4-word slugs like krisesikker-bruk-av-elsparkesykkel -> krisesikker-bruk-av) to the last word boundary dash'
  );

  // 3. A2UI v1.0 validation, checklist label cleaning, checklist group hierarchy/ordering, totalEstimatedMinutes, synthesized highlights, and CaseSimulator synthesis
  const cleanedChkLabel = cleanChecklistLabel(
    '***Viktig*** **Krisevernleder** skal kontrollere *varme arbeider* (*FOB § 4*), måle 2 * 3 * 4 meter og `internkontroll` [^lovdata-fob]'
  );
  assert(
    cleanedChkLabel ===
      'Viktig Krisevernleder skal kontrollere varme arbeider (FOB § 4), måle 2 * 3 * 4 meter og internkontroll',
    `cleanChecklistLabel strips ***bold-italic***, **bold**, *italic*, \`code\`, and [^id] while preserving "2 * 3 * 4" (got: "${cleanedChkLabel}")`
  );

  const sampleChecklistMd = [
    '### 4.1 Daglig og ukentlig kontroll',
    '- [ ] **Frie rømningsveier**: Kontroller korridorer.',
    '### 4.2 Månedlig og kvartalsvis kontroll',
    '- [ ] **Nødbelysning**: Sjekk grønn LED.',
    '- [ ] **Manuelt slokkeutstyr**:',
    '  - [ ] Kontroller manometer på håndslokkere.',
    '- [ ] **Tekniske rom og tavlerom**: Kontroller at elektro- og ventilasjonsrom ikke brukes som lager.',
    '- [ ] **Beredskapssekk**: Sjekk lommelykt og varmetepper.',
    '### 4.3 Halvårlig og årlig kontroll',
    '- [ ] **Kriseøvelse (`FOB § 12`)**:',
    '  - [ ] Er årlig evakueringsøvelse gjennomført?',
    '- [ ] **Tekniske anlegg**:',
    '  - [ ] **Krisealarmanlegg** (`NS 3960`)',
    '    1. [ ] Foreligger årsrapport uten åpne avvik?',
  ].join('\n');
  const chkGroups = extractChecklistGroupsFromMarkdown(sampleChecklistMd);
  assert(
    chkGroups.length === 5 &&
      chkGroups[0].title === 'Daglig og ukentlig kontroll' &&
      chkGroups[1].title === 'Månedlig og kvartalsvis kontroll' &&
      chkGroups[1].items.length === 3 &&
      chkGroups[1].items[0]?.id === 'chk_item_2' &&
      chkGroups[1].items[1]?.id === 'chk_item_4' &&
      chkGroups[1].items[1]?.label.startsWith('Tekniske rom og tavlerom:') &&
      chkGroups[1].items[2]?.id === 'chk_item_5' &&
      chkGroups[1].items[2]?.label.startsWith('Beredskapssekk:') &&
      chkGroups[2].title === 'Månedlig og kvartalsvis kontroll — Manuelt slokkeutstyr' &&
      chkGroups[2].items.length === 1 &&
      chkGroups[2].items[0]?.id === 'chk_item_3' &&
      chkGroups[3].title === 'Halvårlig og årlig kontroll — Kriseøvelse (FOB § 12)' &&
      chkGroups[4].title ===
        'Halvårlig og årlig kontroll — Tekniske anlegg — Krisealarmanlegg (NS 3960)' &&
      chkGroups[4].items[0]?.label === 'Foreligger årsrapport uten åpne avvik?',
    `extractChecklistGroupsFromMarkdown reunites post-subgroup top-level bullets into their parent section group without 1-item fragmentation and preserves 3-level hierarchy (got: ${chkGroups.map((g) => `${g.title}[${g.items.length}]`).join(' | ')})`
  );

  const stage2Norm = normalizeStage2ForA2ui(
    {
      courseTitle: 'Testkurs i Krisevern',
      totalEstimatedMinutes: 55,
      executiveSummary: 'Kort sammendrag.',
      trainingModules: [
        {
          moduleNumber: 1,
          moduleTitle: 'Krisevernleders rolle',
          durationMinutes: 15,
          regulatoryBasis: 'FOB § 4–10',
          spokenNarration:
            'Første avsnitt beskriver den konkrete utfordringen i bygget.\n\nAndre avsnitt er lang forelesningstekst.\n\nTredje avsnitt er mer bakgrunn.\n\nFjerde avsnitt oppsummerer.',
          slideCues: ['Kontroller rømningsveier', 'Dokumenter avvik'],
          boardActionItem: 'Vedta årshjul for krisevern og utpek stedfortreder.',
          quizQuestion: 'Hva må eier gjøre dersom leietaker blokkerer rømningsvei?',
          quizOptions: ['Ingenting', 'Stanse bruken eller utbedre umiddelbart', 'Vente til neste år'],
          correctOptionIndex: 1,
          quizExplanation: 'Eier har det overordnede ansvaret etter FOB § 6.',
        },
        {
          moduleNumber: 2,
          moduleTitle: 'Bruksendring i kombinasjonsbygg',
          durationMinutes: 12,
          regulatoryBasis: 'TEK17 § 11-2',
          spokenNarration: 'Kort fortelling.',
          caseScenario: 'Leietaker vil bygge om kontor i 1. etasje til treningssenter for 180 personer.',
          caseResolution: '   ',
          caseSolution: 'Stans ombyggingen og krev revidert krisekonsept for RKL 5.',
          boardActionItem: 'Generisk handlingspunkt for styret.',
          quizQuestion: 'Hvilken kriseklasse gjelder for 4 etasjer?',
          quizOptions: ['BKL 1', 'BKL 2'],
          correctOptionIndex: 1,
          quizExplanation: '4 etasjer ligger normalt i BKL 2.',
        },
      ],
    },
    'Fallback',
    NB_NO_TEST_LOCALE
  );
  assert(stage2Norm.title === 'Testkurs i Krisevern', 'courseTitle extracted as normalized title');
  assert(
    stage2Norm.estimatedDuration === '55 min',
    `totalEstimatedMinutes formatted with " min" unit (got: "${stage2Norm.estimatedDuration}")`
  );
  assert(
    stage2Norm.highlights.length === 2 && stage2Norm.highlights[0].includes('Krisevernleders rolle'),
    'When top-level keyTakeaways is omitted, highlights are synthesized from trainingModules'
  );
  assert(stage2Norm.modules[0]?.durationOrMeta === '15 min', 'Module durationMinutes preserved as durationOrMeta');
  assert(stage2Norm.quiz[0]?.correctValue === '1', 'correctOptionIndex extracted as quiz correctValue');
  assert(stage2Norm.cases.length === 2, 'Extracted 2 cases from trainingModules');
  assert(
    stage2Norm.cases[0].scenario.includes('Første avsnitt beskriver den konkrete utfordringen i bygget.') &&
      stage2Norm.cases[0].scenario.includes(
        'Utfordring / Spørsmål: Hva må eier gjøre dersom leietaker blokkerer rømningsvei?'
      ) &&
      stage2Norm.cases[0].scenario.includes('Sentrale kontrollpunkter'),
    `Synthesized case scenario includes firstPara context + Utfordring/Spørsmål + Sentrale kontrollpunkter (got: "${stage2Norm.cases[0].scenario}")`
  );
  assert(
    !stage2Norm.cases[0].scenario.includes('Andre avsnitt er lang forelesningstekst'),
    'Synthesized case scenario does NOT dump the entire multi-paragraph lecture narration'
  );
  assert(
    stage2Norm.cases[0].recommendedAction.includes('📌 Faglig begrunnelse:'),
    'Synthesized case recommendedAction includes quizExplanation rationale'
  );
  assert(
    stage2Norm.cases[1].scenario ===
      'Leietaker vil bygge om kontor i 1. etasje til treningssenter for 180 personer.' &&
      stage2Norm.cases[1].recommendedAction ===
        'Stans ombyggingen og krev revidert krisekonsept for RKL 5.' &&
      !stage2Norm.cases[1].recommendedAction.includes('📌 Faglig begrunnelse:'),
    'Explicit caseScenario uses non-empty caseSolution fallback and does NOT append unrelated quizExplanation'
  );

  // Verify estimatedDuration minute inference when modules have durationMinutes vs short script in seconds
  const estDur100 = normalizeStage2ForA2ui(
    {
      title: 'Kurs 100 min',
      estimatedDuration: 100,
      trainingModules: [
        { moduleNumber: 1, title: 'M1', durationMinutes: 50 },
        { moduleNumber: 2, title: 'M2', durationMinutes: 50 },
      ],
    },
    'Fallback',
    NB_NO_TEST_LOCALE
  );
  assert(
    estDur100.estimatedDuration === '100 min',
    `estimatedDuration: 100 with module durationMinutes (totalModMinutes = 100) formats as "100 min" (got: "${estDur100.estimatedDuration}")`
  );

  const estDur105 = normalizeStage2ForA2ui(
    {
      title: 'Kurs 105 min (med intro/outro)',
      estimatedDuration: 105,
      sections: [
        { moduleNumber: 1, title: 'S1', durationMinutes: 50, legalBasis: 'FOB § 4', narration: 'Tekst', keyPoints: ['P1'], practicalTask: 'Oppgave', dilemma: 'Dilemma', recommendedAction: 'Tiltak' },
        { moduleNumber: 2, title: 'S2', durationMinutes: 50, statute: 'FOB § 11', summary: 'Oppsummering', solution: 'Løsning' },
      ],
      overview: 'Kursoversikt',
      checklistGroups: [{ category: 'Daglig kontroll', items: ['Sjekk rømningsveier'] }],
    },
    'Fallback'
  );
  assert(
    estDur105.estimatedDuration === '105 min' &&
      estDur105.scriptBody === 'Kursoversikt' &&
      estDur105.modules.length === 2 &&
      estDur105.modules[0].subtitleOrBasis === 'FOB § 4' &&
      estDur105.modules[0].bullets[0] === 'P1' &&
      estDur105.modules[0].actionItem === 'Oppgave' &&
      estDur105.cases[0].scenario === 'Dilemma' &&
      estDur105.cases[0].recommendedAction === 'Tiltak' &&
      estDur105.checklistGroups.length === 1 &&
      estDur105.checklistGroups[0].title === 'Daglig kontroll',
    `estimatedDuration: 105 with module durationMinutes (totalModMinutes = 100) formats as "105 min" and maps documented Stage 2 A2UI schema keys cleanly (got: "${estDur105.estimatedDuration}")`
  );

  const estDur90s = normalizeStage2ForA2ui(
    {
      title: 'Kort videomanus',
      estimatedDuration: 90,
      scriptBody: 'Kort fortellertekst på 90 sekunder.',
    },
    'Fallback'
  );
  assert(
    estDur90s.estimatedDuration === '90s',
    `estimatedDuration: 90 without module durationMinutes (totalModMinutes = 0) formats as "90s" (got: "${estDur90s.estimatedDuration}")`
  );

  const estDurInvalidFallback = normalizeStage2ForA2ui(
    {
      title: 'Kurs med ugyldig estimatedDuration-streng',
      estimatedDuration: '-10',
      modules: [
        { moduleNumber: 1, title: 'M1', durationMinutes: '50 min', quizQuestion: 'Q1?', quizOptions: ['A', 'B', 'C'], quizCorrectIndex: '2' },
        { moduleNumber: 2, title: 'M2', durationMinutes: 50 },
      ],
    },
    'Fallback',
    NB_NO_TEST_LOCALE
  );
  const estDurAbcFallback = normalizeStage2ForA2ui(
    {
      title: 'Kurs med ikke-numerisk estimatedDuration',
      estimatedDuration: 'abc',
      modules: [{ moduleNumber: 1, title: 'M1', durationMinutes: 60 }],
    },
    'Fallback'
  );
  const estDurUnitPreserved = normalizeStage2ForA2ui(
    {
      title: 'Kurs med eksplisitt tidsenhet',
      estimatedDuration: '2 timer',
      modules: [{ moduleNumber: 1, title: 'M1', durationMinutes: 60 }],
    },
    'Fallback'
  );
  assert(
    estDurInvalidFallback.estimatedDuration === '100 min' &&
      estDurInvalidFallback.modules[0].durationOrMeta === '50 min' &&
      estDurInvalidFallback.quiz[0].correctValue === '2' &&
      estDurAbcFallback.estimatedDuration === '60 min' &&
      estDurUnitPreserved.estimatedDuration === '2 timer',
    `Invalid/negative estimatedDuration ("-10", "abc") falls back to totalModMinutes while preserving valid unit strings ("2 timer") and string quizCorrectIndex ("2")`
  );

  const validMessages: A2uiEnvelopeMessage[] = [
    {
      version: '1.0',
      createSurface: {
        surfaceId: 'test_surface',
        catalogId: A2UI_BASIC_CATALOG_ID,
        sendDataModel: true,
      },
    },
    {
      version: '1.0',
      updateComponents: {
        surfaceId: 'test_surface',
        components: [
          { id: 'root', component: 'Column', children: ['title_txt', 'status_badge'] },
          {
            id: 'title_txt',
            component: 'Text',
            variant: 'body',
            text: { '@call': 'formatString', args: { value: '# ${/okf/title}' } },
          },
          {
            id: 'status_badge',
            component: 'Badge',
            '@catalogId': A2UI_ICM_CATALOG_ID,
            tone: 'success',
            text: { '@path': '/okf/title' },
          },
        ],
      },
    },
    {
      version: '1.0',
      updateDataModel: {
        surfaceId: 'test_surface',
        path: '/',
        value: { okf: { title: 'Hei A2UI v1.0' } },
      },
    },
  ];
  const validationRes = validateA2uiSurfaceMessages(validMessages);
  assert(
    validationRes.valid === true,
    `Valid A2UI v1.0 messages with Basic default catalog + @catalogId Tier 2 mixing pass validation (${validationRes.errors.join('; ')})`
  );

  const invalidRes = validateA2uiSurfaceMessages([
    {
      version: '1.0',
      updateComponents: {
        surfaceId: 'broken',
        components: [{ id: 'not_root', component: 'Text', text: 'Missing root' }],
      },
    },
  ]);
  assert(invalidRes.valid === false && invalidRes.errors.length > 0, 'Missing root component is rejected by validator');

  // Verify Tier 2 ICM/OKF catalog JSON Schema on disk (`specification/v1_0/catalogs/icm-okf-v0.3/catalog.json`),
  // `specification/UPSTREAM_LOCK.json`, and strict A2UI v1.0 protocol validation rules
  const icmCatalogDiskPath = path.resolve(
    process.cwd(),
    'specification',
    'v1_0',
    'catalogs',
    'icm-okf-v0.3',
    'catalog.json'
  );
  const upstreamLockDiskPath = path.resolve(process.cwd(), 'specification', 'UPSTREAM_LOCK.json');
  const icmCatalogDiskJson = JSON.parse(fs.readFileSync(icmCatalogDiskPath, 'utf-8'));
  const upstreamLockJson = JSON.parse(fs.readFileSync(upstreamLockDiskPath, 'utf-8'));
  const invalidSchemaRes = validateA2uiSurfaceMessages([
    {
      version: '1.0',
      createSurface: {
        surfaceId: 'schema_test',
        catalogId: A2UI_BASIC_CATALOG_ID,
        theme: { primaryColor: '#1d4ed8' },
      } as any,
    },
    {
      version: '1.0',
      updateComponents: {
        surfaceId: 'schema_test',
        components: [
          {
            id: 'root',
            component: 'Column',
            children: [
              'bad_widget',
              'missing_prop_chk',
              'missing_cat_badge',
              'legacy_h1_txt',
              'legacy_path_txt',
              'bad_tts_audio',
              'valid_speech_player',
            ],
          },
          { id: 'bad_widget', component: 'NonExistentWidget' },
          {
            id: 'missing_prop_chk',
            component: 'InteractiveChecklist',
            '@catalogId': A2UI_ICM_CATALOG_ID,
            title: 'Missing groupsPath',
          },
          { id: 'missing_cat_badge', component: 'Badge', text: 'Missing @catalogId' },
          { id: 'legacy_h1_txt', component: 'Text', variant: 'h1', text: 'Legacy heading' },
          { id: 'legacy_path_txt', component: 'Text', text: { path: '/meta/title' } as any },
          { id: 'bad_tts_audio', component: 'AudioPlayer', url: 'tts://web-speech/narration' },
          {
            id: 'valid_speech_player',
            component: 'SpeechPlayer',
            '@catalogId': A2UI_ICM_CATALOG_ID,
            ttsText: 'Hei verden',
          },
        ],
      },
    },
    {
      version: '1.0',
      updateDataModel: {
        surfaceId: 'schema_test',
        path: '/temp',
      } as any,
    },
  ]);
  assert(
    icmCatalogDiskJson.catalogId === A2UI_ICM_CATALOG_ID &&
      icmCatalogDiskJson.protocolVersion === '1.0' &&
      !('extendsCatalogId' in icmCatalogDiskJson) &&
      upstreamLockJson?.a2ui?.protocolVersion === '1.0' &&
      Boolean(icmCatalogDiskJson.components?.OkfMarkdown) &&
      Boolean(icmCatalogDiskJson.components?.OkfKnowledgeGraph) &&
      Boolean(icmCatalogDiskJson.components?.InteractiveChecklist) &&
      Boolean(icmCatalogDiskJson.components?.ModuleCarousel) &&
      Boolean(icmCatalogDiskJson.components?.QuizRunner) &&
      Boolean(icmCatalogDiskJson.components?.CaseSimulator) &&
      Boolean(icmCatalogDiskJson.components?.Badge) &&
      Boolean(icmCatalogDiskJson.components?.SpeechPlayer) &&
      Boolean(icmCatalogDiskJson.functions?.verifyOkfSources) &&
      isAllowedA2uiMediaUrl('https://example.com/audio.mp3') === true &&
      isAllowedA2uiMediaUrl('./assets/audio.mp3') === true &&
      isAllowedA2uiMediaUrl('data:audio/wav;base64,UklGRg==') === true &&
      isAllowedA2uiMediaUrl('tts://web-speech/module/1') === false &&
      isAllowedA2uiMediaUrl('javascript:alert(1)') === false &&
      invalidSchemaRes.valid === false &&
      invalidSchemaRes.errors.some((e) => e.includes('unsupported A2UI v1.0 property "theme"')) &&
      invalidSchemaRes.errors.some((e) => e.includes('NonExistentWidget')) &&
      invalidSchemaRes.errors.some((e) => e.includes('missing required catalog property "groupsPath"')) &&
      invalidSchemaRes.errors.some((e) => e.includes('missing_cat_badge') && e.includes('@catalogId')) &&
      invalidSchemaRes.errors.some((e) => e.includes('legacy_h1_txt') && e.includes('invalid variant "h1"')) &&
      invalidSchemaRes.errors.some((e) => e.includes('legacy_path_txt') && e.includes('legacy "{ path }"')) &&
      invalidSchemaRes.errors.some((e) => e.includes('bad_tts_audio') && e.includes('disallowed media URL scheme')) &&
      invalidSchemaRes.errors.some((e) => e.includes('missing required "value" property')) &&
      !invalidSchemaRes.errors.some((e) => e.includes('valid_speech_player')),
    `specification/v1_0/catalogs/icm-okf-v0.3/catalog.json + validateA2uiSurfaceMessages enforce strict A2UI v1.0 rules (no createSurface.theme, @catalogId ownership, @path/@call, Basic Text variants, media URL allowlist, and required updateDataModel.value)`
  );

  // Verify embedded A2UI_STUDIO_JS and OKF_VIZ_JS have zero JavaScript syntax errors and test their runtime formatting hooks
  let studioJsSyntaxValid = false;
  const studioHooks: Record<string, any> = {};
  const vizHooks: Record<string, any> = {};
  try {
    // eslint-disable-next-line no-new-func
    new Function('window', A2UI_STUDIO_JS)({ __ICM_TEST_HOOKS__: studioHooks });
    // eslint-disable-next-line no-new-func
    new Function('window', OKF_VIZ_JS)({ __ICM_TEST_HOOKS__: vizHooks });
    studioJsSyntaxValid = true;
  } catch (err: any) {
    throw new Error(`[ICM Self-Test FAILED] Embedded JS syntax error: ${err?.message || String(err)}`);
  }
  assert(
    studioJsSyntaxValid &&
      A2UI_STUDIO_JS.includes('okf-md-back-primary-btn') &&
      A2UI_STUDIO_JS.includes('okf-graph-back-btn') &&
      OKF_VIZ_JS.includes('viz-stub-back-btn') &&
      typeof studioHooks.formatInlineLatexAndFootnotes === 'function' &&
      typeof studioHooks.cleanClientChecklistLabel === 'function' &&
      typeof vizHooks.renderMarkdownWithOkfFootnotes === 'function',
    'A2UI_STUDIO_JS and OKF_VIZ_JS parse with zero syntax errors and expose runtime test hooks'
  );

  // Verify A2UI v1.0 client runtime hooks (@path, @call formatString, @index with offset, updateDataModel null deletion, and preserveLeadingH1)
  studioHooks.processMessage({
    version: '1.0',
    createSurface: {
      surfaceId: 'v1_hook_surface',
      catalogId: A2UI_BASIC_CATALOG_ID,
      dataModel: { meta: { title: 'Åpen Kunnskap' }, tempKey: 'to-delete' },
    },
  });
  studioHooks.processMessage({
    version: '1.0',
    updateDataModel: {
      surfaceId: 'v1_hook_surface',
      path: '/tempKey',
      value: null,
    },
  });
  const hookSurface = studioHooks.surfaces.v1_hook_surface;
  const resolvedAtPath = studioHooks.resolveDynamic({ '@path': '/meta/title' }, hookSurface, undefined, 0);
  const resolvedFmtHeading = studioHooks.resolveDynamic(
    { '@call': 'formatString', args: { value: '# ${/meta/title} (#${@index})' } },
    hookSurface,
    undefined,
    2
  );
  const resolvedAtIndex = studioHooks.resolveDynamic(
    { '@call': '@index', args: { offset: 1 } },
    hookSurface,
    undefined,
    2
  );
  const preservedH1Out = String(
    studioHooks.formatInlineLatexAndFootnotes('# Beholdt Overskrift\n\nBrødtekst', [], undefined, true)
  );
  const strippedH1Out = String(
    studioHooks.formatInlineLatexAndFootnotes('# Fjernet Overskrift\n\nBrødtekst', [])
  );
  assert(
    resolvedAtPath === 'Åpen Kunnskap' &&
      resolvedFmtHeading === '# Åpen Kunnskap (#2)' &&
      resolvedAtIndex === 3 &&
      !('tempKey' in hookSurface.dataModel) &&
      preservedH1Out.includes('# Beholdt Overskrift') &&
      !strippedH1Out.includes('Fjernet Overskrift') &&
      studioHooks.isAllowedMediaUrl('tts://foo') === false &&
      studioHooks.isAllowedMediaUrl('https://a2ui.org/demo.mp3') === true,
    'A2UI_STUDIO_JS evaluates v1.0 @path, formatString, @index(offset), updateDataModel null deletion, media URL allowlist, and preserveLeadingH1'
  );

  // Verify compound trailing citation-section headings (## Kilder og fotnoter, ## Referanser og fotnoter, ## Sources and Footnotes, bold headings, trailing ---, etc.)
  assert(
    stripTrailingEmptyCitationSection('Brødtekst her.\n\n---\n\n## Kilder og fotnoter\n') === 'Brødtekst her.' &&
      stripTrailingEmptyCitationSection('Brødtekst her.\n\n## Referanser og fotnoter') === 'Brødtekst her.' &&
      stripTrailingEmptyCitationSection('Brødtekst her.\n\n## Kildehenvisninger og fotnoter') === 'Brødtekst her.' &&
      stripTrailingEmptyCitationSection('Brødtekst her.\n\n### 6. Sources and Footnotes:') === 'Brødtekst her.' &&
      stripTrailingEmptyCitationSection('Brødtekst her.\n\n#### **Kildeliste / fotnoter**\n\n---\n') === 'Brødtekst her.',
    'stripTrailingEmptyCitationSection strips compound Norwegian and English trailing citation/footnote headings (including bolded headings and trailing ---)'
  );

  // Verify LaTeX superscripts/subscripts in cleanChecklistLabel and cleanClientChecklistLabel
  const latexChecklistInput =
    'Kontroller kriseceller over $800\\text{ m}^2$, volum $100\\text{ m}^{3}$, temperatur $20^\\circ\\text{C}$, $\\text{H}_2\\text{O}$ og $\\text{CO}_2$-slokkere i sone_2 [^dibk-tek17]';
  const expectedCleanChecklist =
    'Kontroller kriseceller over 800 m², volum 100 m³, temperatur 20°C, H₂O og CO₂-slokkere i sone_2';
  const serverCleanedLatexChk = cleanChecklistLabel(latexChecklistInput);
  const clientCleanedLatexChk = studioHooks.cleanClientChecklistLabel(latexChecklistInput);
  assert(
    serverCleanedLatexChk === expectedCleanChecklist &&
      clientCleanedLatexChk === expectedCleanChecklist,
    `cleanChecklistLabel and cleanClientChecklistLabel convert $800\\text{ m}^2$ -> 800 m², $100\\text{ m}^{3}$ -> 100 m³, $20^\\circ\\text{C}$ -> 20°C, $\\text{H}_2\\text{O}$ -> H₂O, and $\\text{CO}_2$ -> CO₂ while preserving sone_2 (got server="${serverCleanedLatexChk}", client="${clientCleanedLatexChk}")`
  );

  // Verify edge-case LaTeX patterns: leading/trailing space inside \text{...}, nested braces inside \text{...}, signed exponents, escaped spaces, and alphabetic subscripts
  const edgeLatexChecklistInput =
    'Kontroller $\\text{ EI 60}$ og $800\\text{ m }$, lekkasje $10^{-3}$, luftveksling $2\\text{ h}^{-1}$, areal $800\\ \\text{m}^2$, temp $20^{\\circ\\text{C}}$, $\\text{areal > 800 m^{2} i bygg}$, utslipp $\\text{NO}_x$ og sone $x_i$';
  const expectedEdgeCleanChecklist =
    'Kontroller EI 60 og 800 m, lekkasje 10⁻³, luftveksling 2 h⁻¹, areal 800 m², temp 20°C, areal > 800 m² i bygg, utslipp NOₓ og sone xᵢ';
  const serverEdgeChk = cleanChecklistLabel(edgeLatexChecklistInput);
  const clientEdgeChk = studioHooks.cleanClientChecklistLabel(edgeLatexChecklistInput);
  assert(
    serverEdgeChk === expectedEdgeCleanChecklist && clientEdgeChk === expectedEdgeCleanChecklist,
    `cleanChecklistLabel and cleanClientChecklistLabel handle leading/trailing spaces inside \\text{...}, nested braces, signed exponents, escaped spaces, and alphabetic subscripts (got server="${serverEdgeChk}", client="${clientEdgeChk}")`
  );

  // Verify formatInlineLatexAndFootnotes (a2ui.html) and renderMarkdownWithOkfFootnotes (viz.html):
  // 1) Strip redundant leading `# <Title>` heading while keeping `## 1. Deloverskrift`
  // 2) Convert inline `$800\text{ m}^2$` -> `800 m²`, `$\text{CO}_2$` -> `CO₂`, `$10^{-3}$` -> `10⁻³`, `$800\ \text{m}^2$` -> `800 m²`, `$\text{NO}_x$` -> `NOₓ` without raw `$` or `<code>`
  // 3) Strip trailing `---\n\n## **Kilder og fotnoter**\n\n---\n\n[^id]: ...`
  const samplePreviewMd = [
    '# Systematisk kriseforebyggende arbeid i næringsbygg',
    '',
    'Kriseceller over $800\\text{ m}^2$, $800\\ \\text{m}^2$ og $\\text{CO}_2$-slokkere ved el-tavler[^dibk-tek17].',
    '',
    '## 1. Tekniske krav',
    '',
    'Krav til $\\text{H}_2\\text{O}$, $100\\text{ m}^3$, luftveksling $2\\text{ h}^{-1}$, temperatur $20^{\\circ\\text{C}}$, $\\text{areal > 800 m^{2} i bygg}$ og $\\text{NO}_x$.',
    '',
    '---',
    '',
    '## **Kilder og fotnoter**',
    '',
    '---',
    '',
    '[^dibk-tek17]: Byggteknisk forskrift (TEK17)',
  ].join('\n');
  const formattedA2uiPreview = String(studioHooks.formatInlineLatexAndFootnotes(samplePreviewMd, []));
  const renderedVizPreview = String(
    vizHooks.renderMarkdownWithOkfFootnotes(samplePreviewMd, [
      { id: 'dibk-tek17', title: 'Byggteknisk forskrift (TEK17)', resource: 'https://www.dibk.no/tek17' },
    ])
  );
  assert(
    !formattedA2uiPreview.includes('# Systematisk kriseforebyggende arbeid') &&
      formattedA2uiPreview.includes('## 1. Tekniske krav') &&
      formattedA2uiPreview.includes('800 m²') &&
      formattedA2uiPreview.includes('CO₂-slokkere') &&
      formattedA2uiPreview.includes('H₂O') &&
      formattedA2uiPreview.includes('100 m³') &&
      formattedA2uiPreview.includes('2 h⁻¹') &&
      formattedA2uiPreview.includes('20°C') &&
      formattedA2uiPreview.includes('areal > 800 m² i bygg') &&
      formattedA2uiPreview.includes('NOₓ') &&
      !formattedA2uiPreview.includes('$800') &&
      !formattedA2uiPreview.includes('<code>') &&
      !formattedA2uiPreview.includes('Kilder og fotnoter'),
    `formatInlineLatexAndFootnotes strips leading H1 and trailing "## **Kilder og fotnoter**" and formats 800 m² / CO₂ / 2 h⁻¹ / 20°C / NOₓ cleanly (got: "${formattedA2uiPreview}")`
  );
  assert(
    !renderedVizPreview.includes('# Systematisk kriseforebyggende arbeid') &&
      !renderedVizPreview.includes('Systematisk kriseforebyggende arbeid</h1>') &&
      renderedVizPreview.includes('<h2>1. Tekniske krav</h2>') &&
      renderedVizPreview.includes('800 m²') &&
      renderedVizPreview.includes('CO₂-slokkere') &&
      renderedVizPreview.includes('H₂O') &&
      renderedVizPreview.includes('100 m³') &&
      renderedVizPreview.includes('2 h⁻¹') &&
      renderedVizPreview.includes('20°C') &&
      renderedVizPreview.includes('areal &gt; 800 m² i bygg') &&
      renderedVizPreview.includes('NOₓ') &&
      !renderedVizPreview.includes('$800') &&
      !renderedVizPreview.includes('<code>800') &&
      !renderedVizPreview.includes('<code>2') &&
      !renderedVizPreview.includes('<code>NO') &&
      !renderedVizPreview.includes('<code>areal') &&
      !renderedVizPreview.includes('Kilder og fotnoter'),
    `renderMarkdownWithOkfFootnotes strips leading H1 and trailing "## **Kilder og fotnoter**" and formats 800 m² / CO₂ / 2 h⁻¹ / 20°C / NOₓ cleanly (got: "${renderedVizPreview}")`
  );

  // Verify package.json cli* scripts use --env-file-if-exists=.env.local (never bare --env-file=.env.local)
  const pkgJsonPath = path.resolve('./package.json');
  const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8'));
  const cliScriptKeys = ['cli', 'cli:stage1', 'cli:stage2', 'cli:verify', 'cli:viz', 'cli:a2ui'];
  for (const scriptKey of cliScriptKeys) {
    const scriptCmd = String(pkgJson?.scripts?.[scriptKey] || '');
    assert(
      scriptCmd.includes('--env-file-if-exists=.env.local') &&
        !scriptCmd.includes('--env-file=.env.local'),
      `package.json script "${scriptKey}" uses --env-file-if-exists=.env.local instead of bare --env-file=.env.local`
    );
  }

  // Verify loadDotEnvIfExists() precedence (.env.local > .env, existing env preserved, quotes/comments/multi-line/UTF-16LE BOM handled)
  const tmpDotEnvDir = fs.mkdtempSync(path.join(os.tmpdir(), 'icm-dotenv-test-'));
  fs.mkdirSync(tmpDotEnvDir, { recursive: true });
  try {
    fs.writeFileSync(
      path.join(tmpDotEnvDir, '.env.local'),
      [
        '# Comment line',
        'GEMINI_API_KEY="from-dotenv-local" # trailing comment after double quotes',
        'export PRESERVED_KEY="should-not-overwrite"',
        'INLINE_KEY=unquoted-val # inline comment',
        'HASH_INSIDE_QUOTES="val # not a comment" # trailing comment',
        'ESCAPED_QUOTES="hello \\"world\\"" # trailing comment',
        'MULTI_LINE="line 1',
        'line 2" # multi-line comment',
        'EMPTY_OVERRIDE=""',
        'COMMENT_ONLY=# comment at start of unquoted value',
      ].join('\n'),
      'utf-8'
    );
    fs.writeFileSync(
      path.join(tmpDotEnvDir, '.env'),
      [
        'GEMINI_API_KEY="from-dotenv-fallback"',
        "FALLBACK_ONLY='single-quoted' # trailing comment after single quotes",
        'EMPTY_OVERRIDE="should-not-override-empty-env-local"',
      ].join('\n'),
      'utf-8'
    );
    const mockEnv: Record<string, string | undefined> = {
      PRESERVED_KEY: 'already-set-in-shell',
    };
    const loadedVars = loadDotEnvIfExists(tmpDotEnvDir, mockEnv);
    assert(
      mockEnv.GEMINI_API_KEY === 'from-dotenv-local' &&
        mockEnv.PRESERVED_KEY === 'already-set-in-shell' &&
        mockEnv.INLINE_KEY === 'unquoted-val' &&
        mockEnv.HASH_INSIDE_QUOTES === 'val # not a comment' &&
        mockEnv.ESCAPED_QUOTES === 'hello "world"' &&
        mockEnv.MULTI_LINE === 'line 1\nline 2' &&
        mockEnv.EMPTY_OVERRIDE === '' &&
        mockEnv.COMMENT_ONLY === '' &&
        mockEnv.FALLBACK_ONLY === 'single-quoted' &&
        loadedVars.GEMINI_API_KEY === 'from-dotenv-local' &&
        loadedVars.PRESERVED_KEY === undefined,
      `loadDotEnvIfExists loads .env.local and .env while preserving existing process.env keys and handling quoted inline comments, escapes, and multi-line values (got: ${JSON.stringify(mockEnv)})`
    );

    // Also test UTF-16LE BOM (Windows PowerShell 5.1 ">" redirection)
    const utf16Content = Buffer.concat([
      Buffer.from([0xff, 0xfe]),
      Buffer.from('GEMINI_API_KEY="utf16le-key"\r\n', 'utf16le'),
    ]);
    fs.writeFileSync(path.join(tmpDotEnvDir, '.env.local'), utf16Content);
    const mockUtf16Env: Record<string, string | undefined> = {};
    loadDotEnvIfExists(tmpDotEnvDir, mockUtf16Env);
    assert(
      mockUtf16Env.GEMINI_API_KEY === 'utf16le-key',
      `loadDotEnvIfExists decodes UTF-16LE BOM .env.local cleanly (got: "${mockUtf16Env.GEMINI_API_KEY}")`
    );
  } finally {
    fs.rmSync(tmpDotEnvDir, { recursive: true, force: true });
  }

  // Issue 1 Self-Test: Analytical / decision pipeline Stage 2 schema normalization (no quiz fields) + domainMode detection
  const analyticalStage2Payload = {
    reportTitle: 'SpaceX Institutional Equity Valuation',
    verdict: 'Buy / Accumulate',
    readingTimeMinutes: 35,
    investmentThesis: 'Core SOTP valuation thesis driven by Starlink cash flows and Starship cadence.',
    thesisPoints: [
      'Starlink EBITDA inflection exceeds $10B annualized run-rate.',
      'Starship v3 lowers marginal payload cost per kg by >70%.',
    ],
    pillars: [
      {
        pillarNumber: 1,
        pillarTitle: 'Starlink Unit Economics',
        analyticalFramework: 'DCF & Subscriber Cohort Model',
        durationMinutes: 15,
        analysis: 'Detailed analysis of ROIC and terminal bandwidth capacity.',
        keyPoints: ['Residential ARPU stability', 'Aviation & Maritime enterprise attach rate'],
        recommendation: 'Monitor ARPU expansion and Direct-to-Cell spectrum ramp.',
        caseScenario: 'Bear-case LEO congestion cap in high-density cells.',
        mitigation: 'Deploy v3 satellites with 1 Tbps laser backhaul.',
      },
    ],
    stressTests: [
      {
        title: 'Starship FAA Launch Cadence Delay',
        scenario: '12-month environmental review delay at Starbase.',
        recommendedAction: 'Shift commercial manifest to Falcon 9 pads LC-39A and SLC-40.',
        legalRef: 'FAA Part 450',
      },
    ],
  };
  const analyticalNorm = normalizeStage2ForA2ui(analyticalStage2Payload, 'Fallback');
  const detectedAnalyticalMode = detectIcmDomainMode(
    analyticalStage2Payload,
    analyticalNorm.quiz.length,
    `${analyticalNorm.title} ${analyticalNorm.scriptBody}`
  );
  const detectedCourseMode = detectIcmDomainMode(
    { trainingModules: [{ title: 'M1' }] },
    2,
    'Kurs i krisevern og opplæring'
  );
  assert(
    analyticalNorm.title === 'SpaceX Institutional Equity Valuation' &&
      analyticalNorm.targetAudience === 'Buy / Accumulate' &&
      analyticalNorm.estimatedDuration === '35 min' &&
      analyticalNorm.scriptBody.includes('Core SOTP valuation thesis') &&
      analyticalNorm.highlights.length === 2 &&
      analyticalNorm.modules.length === 1 &&
      analyticalNorm.modules[0].title === 'Starlink Unit Economics' &&
      analyticalNorm.modules[0].subtitleOrBasis === 'DCF & Subscriber Cohort Model' &&
      analyticalNorm.modules[0].narration.includes('Detailed analysis of ROIC') &&
      analyticalNorm.modules[0].actionItem.includes('Monitor ARPU expansion') &&
      analyticalNorm.cases.length === 2 &&
      analyticalNorm.cases[0].title === 'Starlink Unit Economics' &&
      analyticalNorm.cases[0].recommendedAction === 'Deploy v3 satellites with 1 Tbps laser backhaul.' &&
      analyticalNorm.cases[1].title === 'Starship FAA Launch Cadence Delay' &&
      analyticalNorm.cases[1].basisOrContext === 'FAA Part 450' &&
      analyticalNorm.quiz.length === 0 &&
      detectedAnalyticalMode === 'analysis' &&
      detectedCourseMode === 'course',
    `normalizeStage2ForA2ui maps analytical/decision schema aliases (including legalRef) cleanly with 0 quizzes and detectIcmDomainMode distinguishes 'analysis' vs 'course'`
  );

  // Verify top-level `scenarios[]` suppresses synthetic module `actionItem` duplicate cases while preserving dedicated scenarios
  const dedicatedScenariosNorm = normalizeStage2ForA2ui(
    {
      title: 'Operational Readiness Course',
      scriptBody: 'Overview introduction.\n\nSecond paragraph.',
      trainingModules: [
        {
          moduleNumber: 1,
          title: 'Module 1: Statutory Duties',
          narration: 'Detailed statutory walkthrough.\n\nFollow-up paragraph.',
          slideCues: ['Owner duties', 'User duties'],
          actionItem: 'Verify building safety logbook.',
        },
        {
          moduleNumber: 2,
          title: 'Module 2: Evacuation Protocol',
          narration: 'Evacuation sequence walkthrough.',
          slideCues: ['Assembly point', 'Roll call'],
          actionItem: 'Inspect evacuation routes daily.',
        },
      ],
      scenarios: [
        {
          title: 'Scenario 1: Midday Alarm During Rest Period',
          legalBasis: 'Section 12',
          scenario: 'Alarm triggers during winter rest period with reduced staffing.',
          recommendedAction: 'Prioritize infant evacuation trolley, sweep rooms, and verify roll call at assembly point.',
        },
      ],
    },
    'Fallback',
    NB_NO_TEST_LOCALE
  );
  assert(
    dedicatedScenariosNorm.modules.length === 2 &&
      dedicatedScenariosNorm.cases.length === 1 &&
      dedicatedScenariosNorm.cases[0].id === 'case_1' &&
      dedicatedScenariosNorm.cases[0].title === 'Scenario 1: Midday Alarm During Rest Period' &&
      dedicatedScenariosNorm.cases[0].basisOrContext === 'Section 12',
    `normalizeStage2ForA2ui suppresses synthetic module actionItem case duplicates when top-level scenarios[] is provided (got ${dedicatedScenariosNorm.cases.length} case(s))`
  );

  // Issue 2 Self-Test: Guard inline LaTeX $...$ against currency $ pairs ($800.0B ... ~$420.00) and Markdown table pipes (|)
  const currencyChecklistLine =
    'Verify December 2025 tender at $800.0B valuation (~$420.00/sh pre-split) and $150 billion to $180 billion Starlink SOTP [^ebc-valuation-800b-2025]';
  const expectedCurrencyChecklist =
    'Verify December 2025 tender at $800.0B valuation (~$420.00/sh pre-split) and $150 billion to $180 billion Starlink SOTP';
  const serverCurrencyChk = cleanChecklistLabel(currencyChecklistLine);
  const clientCurrencyChk = studioHooks.cleanClientChecklistLabel(currencyChecklistLine);
  assert(
    serverCurrencyChk === expectedCurrencyChecklist &&
      clientCurrencyChk === expectedCurrencyChecklist,
    `cleanChecklistLabel and cleanClientChecklistLabel preserve currency $ figures ($800.0B, ~$420.00/sh, $150 billion to $180 billion) without stripping $ or ~ (got server="${serverCurrencyChk}", client="${clientCurrencyChk}")`
  );

  const mixedCurrencyAndMathLine =
    'At $65.00–$75.00 per share (tier_1 ~$70.00), verify area > $800 m^2$, DCF $\\left(1+r\\right)^{-t}$, and ARPU $\\ge \\$68$/month';
  const expectedMixedChecklist =
    'At $65.00–$75.00 per share (tier_1 ~$70.00), verify area > 800 m², DCF (1+r)⁻ᵗ, and ARPU ≥ $68/month';
  const serverMixedChk = cleanChecklistLabel(mixedCurrencyAndMathLine);
  const clientMixedChk = studioHooks.cleanClientChecklistLabel(mixedCurrencyAndMathLine);
  assert(
    serverMixedChk === expectedMixedChecklist && clientMixedChk === expectedMixedChecklist,
    `cleanChecklistLabel and cleanClientChecklistLabel preserve currency $ earlier on a line while converting valid inline math ($800 m^2$ -> 800 m², $\\left(1+r\\right)^{-t}$ -> (1+r)⁻ᵗ, $\\ge \\$68$ -> ≥ $68) later on the same line (got server="${serverMixedChk}", client="${clientMixedChk}")`
  );

  const currencyTableMd = [
    '# SpaceX Institutional Valuation',
    '',
    '| Transaction Date | Implied Valuation | Share Price | Multiple |',
    '| :--- | :--- | :--- | :--- |',
    '| **Dec 2025 Tender** | **$800.0B**[^ebc-valuation-800b-2025] | ~$420.00 (Pre-Split)[^ebc-valuation-800b-2025] | 31.7x |',
    '| **Starlink SOTP** | $150 billion to $180 billion | $185/sh to $212/sh | $65.00–$75.00 |',
    '',
    'At $65.00 per share, area is $800\\text{ m}^2$ ($800 m^2$), discount factor $\\left(1+r\\right)^{-t}$, and ARPU $\\ge$ $68/month.',
  ].join('\n');
  const formattedTableA2ui = String(studioHooks.formatInlineLatexAndFootnotes(currencyTableMd, []));
  const renderedTableViz = String(
    vizHooks.renderMarkdownWithOkfFootnotes(currencyTableMd, [
      { id: 'ebc-valuation-800b-2025', title: 'SpaceX Tender Offer 2025', resource: 'https://example.com/spacex' },
    ])
  );
  assert(
    formattedTableA2ui.includes('**$800.0B**') &&
      formattedTableA2ui.includes('~$420.00 (Pre-Split)') &&
      formattedTableA2ui.includes('$150 billion to $180 billion') &&
      formattedTableA2ui.includes('$185/sh to $212/sh') &&
      formattedTableA2ui.includes('$65.00–$75.00') &&
      formattedTableA2ui.includes('$65.00 per share') &&
      formattedTableA2ui.includes('800 m² (800 m²)') &&
      formattedTableA2ui.includes('(1+r)⁻ᵗ') &&
      formattedTableA2ui.includes('≥ $68/month') &&
      !formattedTableA2ui.includes('<code>') &&
      renderedTableViz.includes('<table>') &&
      renderedTableViz.includes('<strong>$800.0B</strong>') &&
      renderedTableViz.includes('~$420.00 (Pre-Split)') &&
      renderedTableViz.includes('$150 billion to $180 billion') &&
      renderedTableViz.includes('$185/sh to $212/sh') &&
      renderedTableViz.includes('$65.00–$75.00') &&
      renderedTableViz.includes('800 m² (800 m²)') &&
      renderedTableViz.includes('(1+r)⁻ᵗ') &&
      renderedTableViz.includes('≥ $68/month') &&
      !renderedTableViz.includes('<code>800') &&
      !renderedTableViz.includes('<code>|') &&
      !renderedTableViz.includes('<code>[^'),
    `formatInlineLatexAndFootnotes and renderMarkdownWithOkfFootnotes preserve currency $ and ~$ across Markdown table pipes (|) without injecting <code> while converting valid inline math`
  );

  // Issue 3 & Issue 4 Self-Test: TTS language detection ("for", "SOM", "LOV", "FRA", and mixed-language immunity), English/Analytical vs Norwegian/Course A2UI localization, and Verified Source graph nodes in standalone viz.html
  assert(
    typeof studioHooks.detectSpeechLang === 'function' &&
      studioHooks.detectSpeechLang(
        'The valuation for SpaceX is $800B for institutional investors with strong free cash flow for 2026.'
      ) === 'en-US' &&
      studioHooks.detectSpeechLang(
        'TAM, SAM, and SOM analysis shows SOM reaches $10B under NASA LOV and FRA safety thresholds.'
      ) === 'en-US' &&
      studioHooks.detectSpeechLang(
        'The offshore wind benchmark from Ørsted and Ångström unit economics show strong returns that will compound through 2028.'
      ) === 'en-US' &&
      studioHooks.detectSpeechLang(
        'Styret og krisevernleder har ansvar for systematisk sikkerhetsarbeid i virksomheten.'
      ) === 'nb-NO' &&
      detectIcmLanguage('SpaceX institutional equity valuation for 2026 IPO readiness.') === 'en' &&
      detectIcmLanguage(
        'TAM, SAM, and SOM analysis shows SOM reaches $10B, capturing 15% of SOM under NASA LOV and FRA rules.'
      ) === 'en' &&
      detectIcmLanguage(
        'The valuation for SpaceX and Ørsted is $800B with strong free cash flow that will grow through 2026.'
      ) === 'en' &&
      detectIcmLanguage('Systematisk kriseforebyggende arbeid og kontroll i næringsbygg.') === 'no',
    'detectSpeechLang and detectIcmLanguage accurately classify English text containing "for", "SOM"/"LOV"/"FRA" acronyms, or single foreign names as en-US/en and Norwegian text as nb-NO/no'
  );

  const tmpAuditDir = fs.mkdtempSync(path.join(os.tmpdir(), 'icm-audit-i18n-viz-'));
  fs.mkdirSync(tmpAuditDir, { recursive: true });
  try {
    const enBundleRoot = path.join(tmpAuditDir, 'bundle');
    const enResearchDir = path.join(enBundleRoot, 'research');
    const enRunId = 'spacex-test-run';
    const enStage1OutDir = path.join(tmpAuditDir, 'runs', enRunId, 'stages', '01_research', 'output');
    const enStage2OutDir = path.join(tmpAuditDir, 'runs', enRunId, 'stages', '02_script', 'output');
    fs.mkdirSync(enResearchDir, { recursive: true });
    fs.mkdirSync(enStage1OutDir, { recursive: true });
    fs.mkdirSync(enStage2OutDir, { recursive: true });

    const enOkfMarkdown = [
      '---',
      'type: Equity Research Report',
      'title: SpaceX Institutional Equity Valuation',
      'description: Institutional sum-of-the-parts valuation for SpaceX.',
      'status: stable',
      'generated:',
      '  by: icm-stage1/gemini-4-argon',
      '  at: 2026-11-01T10:00:00Z',
      'verified:',
      '  - by: human:analyst',
      '    at: 2026-11-01T11:00:00Z',
      'stale_after: 2027-11-01T00:00:00Z',
      'x-links_to:',
      '  - research/starlink-sotp',
      '  - research/starship-economics',
      'sources:',
      '  - id: ebc-valuation-800b-2025',
      '    title: SpaceX Secondary Tender Offer Valuation ($800B)',
      '    resource: https://example.com/spacex-800b',
      '    retrieved_at: 2026-11-01T10:00:00Z',
      '  - id: fcc-gen2-starlink',
      '    title: FCC Gen2 Starlink Orbital Modification Order',
      '    resource: https://example.com/fcc-gen2',
      '    retrieved_at: 2026-11-01T10:00:00Z',
      '---',
      '# SpaceX Institutional Equity Valuation',
      '',
      'Valuation cleared at **$800.0B** (~$420.00/sh)[^ebc-valuation-800b-2025] with FCC Gen2 authorization[^fcc-gen2-starlink].',
      '',
      'See related concepts [Starlink SOTP](/research/starlink-sotp.md) and [Starship Economics](/research/starship-economics.md).',
      '',
      '## Due Diligence Verification Checklist',
      '- [ ] Verify secondary tender offer valuation at $800.0B (~$420.00/sh)[^ebc-valuation-800b-2025]',
    ].join('\n');

    fs.writeFileSync(path.join(enResearchDir, `${enRunId}.md`), enOkfMarkdown, 'utf-8');
    fs.writeFileSync(path.join(enStage1OutDir, 'research_summary.md'), enOkfMarkdown, 'utf-8');
    fs.writeFileSync(
      path.join(enStage2OutDir, 'script_draft.json'),
      JSON.stringify(analyticalStage2Payload, null, 2),
      'utf-8'
    );
    fs.writeFileSync(
      path.join(tmpAuditDir, 'runs', enRunId, 'meta.json'),
      JSON.stringify({ runId: enRunId, model: GEMINI_4_ARGON_MODEL }, null, 2),
      'utf-8'
    );

    const enVizResult = generateBundleVisualization(enBundleRoot);
    const enVizHtml = fs.readFileSync(enVizResult.outputPath, 'utf-8');
    assert(
      enVizResult.concepts === 1 &&
        enVizResult.nodes === 3 &&
        enVizResult.edges === 2 &&
        enVizHtml.includes('"group":"source"') &&
        enVizHtml.includes('"type":"Verified Source"') &&
        enVizHtml.includes('"color":"#10b981"') &&
        enVizHtml.includes('"label":"cites"') &&
        enVizHtml.includes('viz-source-back-btn'),
      `generateBundleVisualization expands c.sources into Verified Source nodes (#10b981) and cites edges (expected 3 nodes / 2 edges, got ${enVizResult.nodes} nodes / ${enVizResult.edges} edges)`
    );

    const enA2uiResult = generateA2uiSurface({
      workspaceRoot: tmpAuditDir,
      runId: enRunId,
    });
    const fallbackA2uiResult = generateA2uiSurface({
      workspaceRoot: tmpAuditDir,
      runId: 'non-existent-ghost-run-id',
    });
    const enA2uiHtml = fs.readFileSync(enA2uiResult.htmlOutputPath, 'utf-8');
    assert(
      enA2uiResult.quizCount === 0 &&
        enA2uiResult.tabCount === 6 &&
        fallbackA2uiResult.runId === enRunId &&
        fallbackA2uiResult.moduleCount === 1 &&
        !fs.existsSync(path.join(tmpAuditDir, 'runs', 'non-existent-ghost-run-id')) &&
        enA2uiHtml.includes('<html lang="en">') &&
        enA2uiHtml.includes('📋 Executive Summary') &&
        enA2uiHtml.includes('📊 Deep-Dive Pillars (1)') &&
        enA2uiHtml.includes('⚖️ Scenario Simulator (2)') &&
        enA2uiHtml.includes('📚 OKF v0.3 Knowledge Base') &&
        enA2uiHtml.includes('🕸️ OKF Knowledge Graph (5)') &&
        enA2uiHtml.includes('2 verified sources') &&
        enA2uiHtml.includes('Target Audience: Buy / Accumulate') &&
        enA2uiHtml.includes('⬇ Export A2UI State (.json)') &&
        !enA2uiHtml.includes('🧪') &&
        !enA2uiHtml.includes('Oversikt & Sammendrag') &&
        !enA2uiHtml.includes('verifiserte kilder') &&
        !enA2uiHtml.includes('Målgruppe:') &&
        !enA2uiHtml.includes('Eksporter A2UI Tilstand'),
      `generateA2uiSurface renders 100% English analytical UI chrome with 6 tabs (no Quiz tab), 0 leaked Norwegian labels, and falls back to the latest valid run when a non-existent runId is supplied`
    );
  } finally {
    fs.rmSync(tmpAuditDir, { recursive: true, force: true });
  }

  // Fix 1 Self-Test: Deep-clone protection in setJsonPointer and client A2UI setPointer (no reference aliasing)
  const rawInitialModel = {
    modules: { currentIndex: 0, total: 5 },
    checklist: { completedCount: 0, groups: [{ id: 'g1', items: [{ id: 'i1', checked: false }] }] },
  };
  const serverModelRoot: Record<string, unknown> = {};
  setJsonPointer(serverModelRoot, '/', rawInitialModel);
  (serverModelRoot.modules as Record<string, unknown>).currentIndex = 4;
  ((serverModelRoot.checklist as Record<string, unknown>).groups as Array<{ items: Array<{ checked: boolean }> }>)[0].items[0].checked = true;
  assert(
    rawInitialModel.modules.currentIndex === 0 &&
      rawInitialModel.checklist.groups[0].items[0].checked === false,
    'setJsonPointer deep-clones assigned objects so mutating the target dataModel never mutates the source message value'
  );

  const clientModelRoot: Record<string, unknown> = {};
  studioHooks.setPointer(clientModelRoot, '/', rawInitialModel);
  (clientModelRoot.modules as Record<string, unknown>).currentIndex = 3;
  ((clientModelRoot.checklist as Record<string, unknown>).groups as Array<{ items: Array<{ checked: boolean }> }>)[0].items[0].checked = true;
  assert(
    rawInitialModel.modules.currentIndex === 0 &&
      rawInitialModel.checklist.groups[0].items[0].checked === false,
    'A2UI_STUDIO_JS setPointer deep-clones assigned objects so UI interactions never mutate historical messages[2].updateDataModel.value'
  );

  // Fix 2 Self-Test: LaTeX-to-Unicode macro ordering (6\text{ }\mu\text{g} -> 6 μg), acronym ratios ($SC/OC$), leading-digit math ($8,450+\text{ t}$), nested \frac, $$...$$ display math, and word-boundary footnote stripping
  const asteroidLatexChecklist =
    'Verify $6\\text{ }\\mu\\text{g}$ sample, ($a$) = 2.81 AU, $e = 0.5818$, $SC/OC$ = $0.3600$, $\\frac{1}{r^{2}}$ flux, $\\frac{v_{\\text{esc}}}{c}$ ratio, $8,450+\\text{ t}$ mass, $\\Delta v = 4.630\\text{ km/s}$, $\\mathcal{R}$, and $\\text{Ni(CO)}_4 \\xrightleftharpoons[50^\\circ\\text{C}]{180^\\circ\\text{C}} \\text{Ni} + 4\\text{CO}$ across Boulder[^src-1]Armoring and orbital[^src-2]TRL 6 while keeping $62M–$70M and $1,438/oz';
  const expectedAsteroidChecklist =
    'Verify 6 μg sample, (a) = 2.81 AU, e = 0.5818, SC/OC = 0.3600, 1/r² flux, v_esc/c ratio, 8,450+ t mass, Δv = 4.630 km/s, ℛ, and Ni(CO)₄ ⇌ Ni + 4CO across Boulder Armoring and orbital TRL 6 while keeping $62M–$70M and $1,438/oz';
  const serverAsteroidChk = cleanChecklistLabel(asteroidLatexChecklist);
  const clientAsteroidChk = studioHooks.cleanClientChecklistLabel(asteroidLatexChecklist);
  assert(
    serverAsteroidChk === expectedAsteroidChecklist &&
      clientAsteroidChk === expectedAsteroidChecklist,
    `cleanChecklistLabel and cleanClientChecklistLabel convert $6\\text{ }\\mu\\text{g}$ -> 6 μg, $SC/OC$ -> SC/OC, nested \\frac{v_{\\text{esc}}}{c} -> v_esc/c, $8,450+\\text{ t}$ -> 8,450+ t, \\mathcal{R} -> ℛ, \\xrightleftharpoons -> ⇌, and preserve word boundaries around footnotes (got server="${serverAsteroidChk}", client="${clientAsteroidChk}")`
  );

  const displayAndComplexMathMd = [
    '$$NPV_8 = \\sum_{t=1}^{15} \\frac{FCF_t}{(1+r)^t} - CAPEX_0$$',
    '',
    'Sample mass is $6\\text{ }\\mu\\text{g}$, polarization ratio $SC/OC$ = $0.3600$, flux $\\frac{1}{r^{2}}$, escape ratio $\\frac{v_{\\text{esc}}}{c}$, payload $100,000+\\text{ kg}$, reflectance $\\mathcal{R}$, $\\Delta v$, and $NPV_{8,\\text{base}}$ at $62M–$70M ($1,438/oz).',
  ].join('\n');
  const formattedComplexA2ui = String(studioHooks.formatInlineLatexAndFootnotes(displayAndComplexMathMd, []));
  const renderedComplexViz = String(vizHooks.renderMarkdownWithOkfFootnotes(displayAndComplexMathMd, []));
  assert(
    formattedComplexA2ui.includes('6 μg') &&
      formattedComplexA2ui.includes('SC/OC = 0.3600') &&
      formattedComplexA2ui.includes('1/r²') &&
      formattedComplexA2ui.includes('v<sub>esc</sub>/c') &&
      formattedComplexA2ui.includes('100,000+ kg') &&
      formattedComplexA2ui.includes('ℛ') &&
      formattedComplexA2ui.includes('Δv') &&
      formattedComplexA2ui.includes('<sub>8,base</sub>') &&
      formattedComplexA2ui.includes('$62M–$70M ($1,438/oz)') &&
      !formattedComplexA2ui.includes('6\\mug') &&
      !formattedComplexA2ui.includes('<code>') &&
      renderedComplexViz.includes('6 μg') &&
      renderedComplexViz.includes('SC/OC = 0.3600') &&
      renderedComplexViz.includes('1/r²') &&
      renderedComplexViz.includes('v<sub>esc</sub>/c') &&
      renderedComplexViz.includes('100,000+ kg') &&
      renderedComplexViz.includes('ℛ') &&
      renderedComplexViz.includes('Δv') &&
      renderedComplexViz.includes('<sub>8,base</sub>') &&
      renderedComplexViz.includes('$62M–$70M ($1,438/oz)') &&
      !renderedComplexViz.includes('6\\mug') &&
      !renderedComplexViz.includes('<code>'),
    `formatInlineLatexAndFootnotes and renderMarkdownWithOkfFootnotes render $$...$$ display math, nested \\frac{v_{\\text{esc}}}{c}, 6 μg, SC/OC, 100,000+ kg, ℛ, Δv, and multi-char subscripts via <sub> without <code> fallbacks (got A2UI="${formattedComplexA2ui}")`
  );

  // Fix 3 Self-Test: Dual-register TTS normalizer & automatic multi-paragraph splitting for wall-of-text Stage 2 fields
  const ttsSampleEn =
    'NPV_8 of -$1,795.7M at 3.88 ± 0.25 g/cm³, Iₛₚ of 380 s, 6 μg sample, §§ 4–10 and § 12 at -10 °C, and Δv of 4.630 km/s with $10,000/kg cap, $1.77T–$1.98T range, and ~$800.0B valuation.';
  const normalizedTtsEn = String(studioHooks.normalizeTextForTts(ttsSampleEn, 'en-US'));
  const normalizedTtsNo = String(
    studioHooks.normalizeTextForTts(
      '3,88 ± 0,25 g/cm³, Iₛₚ på 380 s, §§ 4–10, TEK17 §§ 11-13 og 11-14 samt § 11-2 ved -10 °C',
      NB_NO_TEST_LOCALE
    )
  );
  assert(
    normalizedTtsEn.includes('NPV 8 of negative 1,795.7 million dollars') &&
      normalizedTtsEn.includes('3.88 plus or minus 0.25 grams per cubic centimeter') &&
      normalizedTtsEn.includes('specific impulse of 380 s') &&
      normalizedTtsEn.includes('6 micro-g sample') &&
      normalizedTtsEn.includes('sections 4 to 10 and section 12 at minus 10 degrees Celsius') &&
      normalizedTtsEn.includes('delta-v of 4.630 kilometers per second') &&
      normalizedTtsEn.includes('10,000 dollars per kilogram cap') &&
      normalizedTtsEn.includes('1.77 trillion dollars to 1.98 trillion dollars range') &&
      normalizedTtsEn.includes('approximately 800.0 billion dollars valuation') &&
      normalizedTtsNo.includes('3,88 pluss eller minus 0,25 gram per kubikkcentimeter') &&
      normalizedTtsNo.includes('spesifikk impuls på 380 s') &&
      normalizedTtsNo.includes('paragrafene 4 til 10') &&
      normalizedTtsNo.includes('TEK17 paragrafene 11-13 og 11-14') &&
      normalizedTtsNo.includes('paragraf 11-2 ved minus 10 grader celsius'),
    `normalizeTextForTts expands symbolic financial/scientific/legal notation into natural spoken English and Norwegian for Web Speech API (got EN="${normalizedTtsEn}", NO="${normalizedTtsNo}")`
  );

  const wallOfTextThesis = [
    'Sentence one establishes the macro thesis for orbital resource extraction across near-Earth C-type and M-type targets.',
    'Sentence two quantifies the launch cost threshold at $500/kg required for positive net present value.',
    'Sentence three evaluates the astrobiological sample return constraints and cohesive boulder armoring.',
    'Sentence four models the 15-year discounted cash flow trajectory under 25% annual supply shock decay.',
    'Sentence five stress-tests platinum group metal market elasticity and refining capital intensity.',
    'Sentence six concludes with a disciplined capital allocation recommendation for institutional portfolios.',
  ].join(' ');
  const wallNorm = normalizeStage2ForA2ui(
    {
      reportTitle: 'Wall of Text Test',
      visualSummary: wallOfTextThesis,
      spokenScript: 'Spoken narration version without symbols.',
      pillars: [
        {
          pillarNumber: 1,
          pillarTitle: 'Pillar 1',
          analysis: wallOfTextThesis,
          spokenNarration: 'Spoken pillar narration.',
        },
      ],
    },
    'Fallback',
    NB_NO_TEST_LOCALE
  );
  assert(
    wallNorm.scriptBody.includes('\n\n') &&
      wallNorm.spokenScript === 'Spoken narration version without symbols.' &&
      wallNorm.modules[0].narration.includes('\n\n') &&
      wallNorm.modules[0].spokenNarration === 'Spoken pillar narration.',
    'normalizeStage2ForA2ui automatically splits dense single-paragraph Stage 2 prose (> 420 chars, 5+ sentences) into readable multi-paragraph blocks and preserves separate visualSummary vs spokenScript fields'
  );

  // Fix 4 Self-Test: Low-signal grounding domain filter, HTML <title> extraction (including 302 redirects), and bare-domain source title enrichment
  assert(
    isLowSignalGroundingUrl('https://www.facebook.com/groups/space/posts/12345') &&
      isLowSignalGroundingUrl('https://old.reddit.com/r/SpaceXLounge/comments/abc') &&
      isLowSignalGroundingUrl('https://www.quora.com/What-is-asteroid-mining') &&
      isLowSignalGroundingUrl('https://gradesfixer.com/free-essay-examples/asteroid-mining/') &&
      !isLowSignalGroundingUrl('https://ntrs.nasa.gov/api/citations/20240001/downloads/report.pdf') &&
      !isLowSignalGroundingUrl('https://arxiv.org/pdf/2401.12345.pdf') &&
      !isLowSignalGroundingUrl('https://www.sec.gov/Archives/edgar/data/0001/filing.htm'),
    'isLowSignalGroundingUrl filters social media, forum, and essay-mill domains while preserving institutional, academic, and regulatory sources'
  );

  assert(
    extractHtmlTitleFromSnippet(
      '<html><head><meta property="og:title" content="JPL Small-Body Database &#8212; 1986 DA"><title>Fallback</title></head></html>'
    ) === 'JPL Small-Body Database — 1986 DA' &&
      extractHtmlTitleFromSnippet('<html><head><title>NASA Technical Reports Server - Psyche Mission</title></head></html>') ===
        'NASA Technical Reports Server - Psyche Mission',
    'extractHtmlTitleFromSnippet extracts and decodes og:title and <title> from HTML snippets'
  );

  assert(
    extractHtmlModifiedFromSnippet(
      '<html><head><meta property="article:modified_time" content="2023-11-04T14:22:10+01:00"></head></html>'
    ) === '2023-11-04T13:22:10Z' &&
      extractHtmlModifiedFromSnippet(
        '<html><head><script type="application/ld+json">{"@type":"WebPage","dateModified":"2025-02-18T08:00:00Z"}</script></head></html>'
      ) === '2025-02-18T08:00:00Z' &&
      extractHtmlModifiedFromSnippet(
        '<html><head><meta name="dcterms.issued" content="2019-06-01"></head></html>'
      ) === '2019-06-01T00:00:00Z' &&
      parsePdfDateToIso("D:20170830125340Z00'00'") === '2017-08-30T12:53:40Z' &&
      parsePdfDateToIso("D:20170701120000+02'00'") === '2017-07-01T10:00:00Z' &&
      extractPdfModifiedFromLatin1(
        "%PDF-1.3\n422 0 obj\n(D:20170830125340Z00'00')\nendobj\n1 0 obj\n<< /CreationDate 422 0 R /ModDate 422 0 R >>\nendobj"
      ) === '2017-08-30T12:53:40Z' &&
      extractPdfModifiedFromLatin1(
        '%PDF-1.7\n<x:xmpmeta><rdf:Description><xmp:ModifyDate>2022-09-15T16:45:00+02:00</xmp:ModifyDate></rdf:Description></x:xmpmeta>'
      ) === '2022-09-15T14:45:00Z',
    'extractHtmlModifiedFromSnippet, parsePdfDateToIso, and extractPdfModifiedFromLatin1 parse W3C/OpenGraph/JSON-LD/DublinCore and ISO 32000 direct/indirect PDF + Adobe XMP timestamps'
  );

  const originalFetch = globalThis.fetch;
  try {
    const mockPdfTrailer =
      "\n422 0 obj\n(D:20170830125340Z00'00')\nendobj\n1 0 obj\n<< /CreationDate 422 0 R /ModDate 422 0 R >>\nendobj\n%%EOF";
    const mockPdfBody90k = '%PDF-1.3\n' + 'A'.repeat(90000) + mockPdfTrailer;

    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const reqUrl = String(input);
      const rangeHdr =
        (init?.headers && typeof init.headers === 'object' && !Array.isArray(init.headers)
          ? (init.headers as Record<string, string>)['Range'] ||
            (init.headers as Record<string, string>)['range']
          : '') || '';
      if (reqUrl.includes('vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQ_pdf206')) {
        return new Response('', {
          status: 302,
          headers: { location: 'https://example.gov/archive/2017_edition_206.pdf' },
        });
      }
      if (reqUrl === 'https://example.gov/archive/2017_edition_206.pdf') {
        const total = mockPdfBody90k.length;
        if (rangeHdr.startsWith('bytes=0-')) {
          return new Response(Buffer.from(mockPdfBody90k.slice(0, 16384), 'latin1'), {
            status: 206,
            headers: {
              'content-type': 'application/pdf',
              'content-range': `bytes 0-16383/${total}`,
            },
          });
        }
        const tailMatch = rangeHdr.match(/^bytes=(\d+)-(\d+)$/);
        if (tailMatch) {
          const s = Number(tailMatch[1]);
          const e = Number(tailMatch[2]) + 1;
          return new Response(Buffer.from(mockPdfBody90k.slice(s, e), 'latin1'), {
            status: 206,
            headers: {
              'content-type': 'application/pdf',
              'content-range': `bytes ${s}-${e - 1}/${total}`,
            },
          });
        }
      }
      if (reqUrl === 'https://example.gov/archive/2017_edition_varnish200.pdf') {
        return new Response(Buffer.from(mockPdfBody90k, 'latin1'), {
          status: 200,
          headers: {
            'content-type': 'application/pdf',
            'content-length': String(mockPdfBody90k.length),
          },
        });
      }
      if (reqUrl === 'https://example.gov/rules/html_meta_only') {
        return new Response(
          '<html><head><title>Current Regulation &#8211; § 11-12</title><meta property="article:modified_time" content="2026-01-10T09:00:00Z"></head></html>',
          {
            status: 200,
            headers: { 'content-type': 'text/html; charset=utf-8' },
          }
        );
      }
      if (reqUrl.includes('vertexaisearch.cloud.google.com/grounding-api-redirect/')) {
        return new Response('', {
          status: 302,
          headers: { location: 'https://ntrs.nasa.gov/citations/20240001' },
        });
      }
      return new Response(
        '<html><head><title>NASA Technical Reports Server &#x2014; Psyche Mission</title></head></html>',
        {
          status: 200,
          headers: {
            'content-type': 'text/html; charset=utf-8',
            'last-modified': 'Wed, 15 May 2024 12:00:00 GMT',
          },
        }
      );
    }) as typeof fetch;
    const redirectResult = await resolveRedirect(
      'https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQ_mock'
    );
    const pdf206Result = await resolveRedirect(
      'https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQ_pdf206'
    );
    const pdf200Result = await resolveRedirect(
      'https://example.gov/archive/2017_edition_varnish200.pdf'
    );
    const htmlMetaResult = await resolveRedirect('https://example.gov/rules/html_meta_only');
    assert(
      redirectResult.url === 'https://ntrs.nasa.gov/citations/20240001' &&
        redirectResult.pageTitle === 'NASA Technical Reports Server — Psyche Mission' &&
        redirectResult.lastModified === '2024-05-15T12:00:00Z' &&
        pdf206Result.url === 'https://example.gov/archive/2017_edition_206.pdf' &&
        pdf206Result.lastModified === '2017-08-30T12:53:40Z' &&
        pdf200Result.lastModified === '2017-08-30T12:53:40Z' &&
        htmlMetaResult.pageTitle === 'Current Regulation – § 11-12' &&
        htmlMetaResult.lastModified === '2026-01-10T09:00:00Z',
      `resolveRedirect extracts HTTP Last-Modified, HTML <meta> modified timestamps, and ISO 32000 PDF trailer timestamps across both 206 Range and 200 full-stream responses`
    );
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert(
    enrichBareDomainSourceTitle('arxiv.org', 'https://arxiv.org/pdf/2305.09876.pdf') ===
      'arxiv.org — arXiv:2305.09876' &&
      enrichBareDomainSourceTitle('arxiv.org — 1810.03706V2', 'https://arxiv.org/pdf/1810.03706v2.pdf') ===
        'arxiv.org — arXiv:1810.03706v2' &&
      enrichBareDomainSourceTitle('instagram.com — Dc4kfsNgXId', 'https://www.instagram.com/p/Dc4kfsNgXId/') ===
        'instagram.com' &&
      enrichBareDomainSourceTitle(
        'downloads',
        'https://ntrs.nasa.gov/api/citations/20190002745/downloads/20190002745.pdf'
      ) === 'ntrs.nasa.gov — Citations 20190002745' &&
      enrichBareDomainSourceTitle(
        'scirp.org — paperinformation',
        'https://www.scirp.org/journal/paperinformation?paperid=112233'
      ) === 'scirp.org — Paper 112233',
    'enrichBareDomainSourceTitle enriches bare domain, arXiv ID ("arxiv.org — 1810.03706V2" -> "arxiv.org — arXiv:1810.03706v2"), opaque short-code ("instagram.com — Dc4kfsNgXId" -> "instagram.com"), and path-segment titles ("downloads", "paperinformation")'
  );

  const lowSignalOkfDoc = parseOkfDocument(
    [
      '---',
      'type: Research Report',
      'title: Low Signal Pruning Test',
      'description: Test pruning of auto-generated low-signal sources.',
      'status: draft',
      'generated:',
      '  by: icm-stage1/gemini-4-argon',
      '  at: 2026-11-01T10:00:00Z',
      'sources:',
      '  - id: nasa-ntrs-2026',
      '    title: NASA Technical Reports Server (NTRS)',
      '    resource: https://ntrs.nasa.gov/citations/20260001',
      '    retrieved_at: 2026-11-01T10:00:00Z',
      '  - id: src-4',
      '    title: facebook.com',
      '    resource: https://www.facebook.com/groups/space/posts/999',
      '    retrieved_at: 2026-11-01T10:00:00Z',
      '---',
      'Verified Boulder[^src-4]Armoring and orbital[^nasa-ntrs-2026]TRL 6.',
    ].join('\n')
  );
  const healedLowSignalChanged = healOrphanOkfFootnotes(lowSignalOkfDoc);
  assert(
    healedLowSignalChanged === true &&
      lowSignalOkfDoc.frontmatter.sources?.length === 1 &&
      lowSignalOkfDoc.frontmatter.sources[0].id === 'nasa-ntrs-2026' &&
      lowSignalOkfDoc.body.includes('Boulder Armoring') &&
      !lowSignalOkfDoc.body.includes('[^src-4]') &&
      lowSignalOkfDoc.body.includes('[^nasa-ntrs-2026]'),
    `healOrphanOkfFootnotes prunes auto-generated low-signal sources (src-4 facebook.com) and preserves word boundaries ("Boulder Armoring")`
  );

  // Fixes A–F Self-Test: Multi-Run A2UI Switcher, Cross-Run Source Deduplication, Bidirectional Bundle Links, Relative .md Link Resolution, and HTML Entity / Webflow Hex Prefix Cleaning
  assert(
    decodeHtmlEntities(
      'Forskrift om kriseforebygging &sect; 11 &ndash; Krise&oslash;velser i kontorhus &aelig;&aring; &#x00F8; &#248;'
    ) === 'Forskrift om kriseforebygging § 11 – Kriseøvelser i kontorhus æå ø ø',
    'decodeHtmlEntities decodes Nordic (&oslash;, &aelig;, &aring;), typographic (&sect;, &ndash;), and hex/decimal numeric HTML entities'
  );

  assert(
    enrichBareDomainSourceTitle(
      'assets.website-files.com',
      'https://assets.website-files.com/61a9b/6a9e9cef4a0a559c1c162d3e_6d.%20Den%20lille%20krisevern%20boka.pdf'
    ) === 'website-files.com — 6d. Den lille krisevern boka' &&
      enrichBareDomainSourceTitle(
        'Krise&oslash;velser &ndash; Sikker Hverdag',
        'https://www.sikkerhverdag.no/krise/kriseovelser/'
      ) === 'Kriseøvelser – Sikker Hverdag',
    'enrichBareDomainSourceTitle strips 24-hex Webflow CDN ObjectId prefixes while preserving list numbering ("6d. Den lille krisevern boka") and decodes HTML entities in existing titles'
  );

  assert(
    normalizeCanonicalSourceUrl('https://www.lovdata.no/dokument/SF/forskrift/2015-12-17-1710/?utm_source=test#KAPITTEL_3') ===
      'https://lovdata.no/dokument/SF/forskrift/2015-12-17-1710',
    'normalizeCanonicalSourceUrl normalizes protocol, strips www., trailing slashes, hash fragments, and UTM params'
  );

  const tmpMultiRunDir = fs.mkdtempSync(path.join(os.tmpdir(), 'icm-multirun-test-'));
  fs.mkdirSync(tmpMultiRunDir, { recursive: true });
  try {
    const mrBundleDir = path.join(tmpMultiRunDir, 'bundle');
    const mrResearchDir = path.join(mrBundleDir, 'research');
    const mrRunsDir = path.join(tmpMultiRunDir, 'runs');
    fs.mkdirSync(mrResearchDir, { recursive: true });
    fs.mkdirSync(mrRunsDir, { recursive: true });
    saveWorkspaceLocale(tmpMultiRunDir, NB_NO_TEST_LOCALE);

    const mod1Md = [
      '---',
      'type: Research Concept',
      'title: "Modul 1: Lovverk og ansvar"',
      'description: "Lovkrav for krisevern i kontorbygg."',
      'status: stable',
      'generated:',
      '  by: icm-stage1/gemini-4-argon',
      '  at: 2026-11-01T10:00:00Z',
      'verified:',
      '  - by: human:fagansvarlig',
      '    at: 2026-11-01T11:00:00Z',
      'sources:',
      '  - id: lovdata-kriseforebygging',
      '    title: "Forskrift om kriseforebygging — Lovdata"',
      '    resource: https://lovdata.no/dokument/SF/forskrift/2015-12-17-1710',
      '    retrieved_at: 2026-11-01T10:00:00Z',
      '---',
      '# Modul 1: Lovverk og ansvar',
      '',
      'Avdelingen skal ha dokumentert internkontroll [^lovdata-kriseforebygging].',
      '',
      '## Sjekkliste Modul 1',
      '- [x] Kontroller lovpålagt dokumentasjon [^lovdata-kriseforebygging]',
      '',
      '[^lovdata-kriseforebygging]: [Forskrift om kriseforebygging — Lovdata](https://lovdata.no/dokument/SF/forskrift/2015-12-17-1710)',
    ].join('\n');

    fs.writeFileSync(path.join(mrResearchDir, 'modul-1-lovverk.md'), mod1Md, 'utf-8');

    // Test Fix C: cleanGroundingLinks reuses canonical source ID & human title from existing bundle
    const cleanedRun2Md = await cleanGroundingLinks(
      [
        '---',
        'type: Research Concept',
        'title: "Modul 2"',
        'description: "Test"',
        'status: draft',
        'sources:',
        '  - id: lovdata-kriseforebygging-2015',
        '    title: "lovdata.no"',
        '    url: https://www.lovdata.no/dokument/SF/forskrift/2015-12-17-1710/#KAPITTEL_3',
        '---',
        'Praktiske rutiner bygger på forskriften [^lovdata-kriseforebygging-2015].',
      ].join('\n'),
      [],
      {
        generatedAt: '2026-11-01T12:00:00Z',
        workspaceRoot: tmpMultiRunDir,
      }
    );
    const cleanedRun2Doc = parseOkfDocument(cleanedRun2Md);
    assert(
      cleanedRun2Doc.frontmatter.sources?.length === 1 &&
        cleanedRun2Doc.frontmatter.sources[0].id === 'lovdata-kriseforebygging' &&
        cleanedRun2Doc.frontmatter.sources[0].title === 'Forskrift om kriseforebygging — Lovdata' &&
        cleanedRun2Doc.body.includes('[^lovdata-kriseforebygging]') &&
        !cleanedRun2Doc.body.includes('[^lovdata-kriseforebygging-2015]'),
      `cleanGroundingLinks reuses existing bundle canonical source ID ("lovdata-kriseforebygging") and human title across runs and rewrites body alias footnotes (got ${JSON.stringify(cleanedRun2Doc.frontmatter.sources)})`
    );

    const mod2Md = [
      '---',
      'type: Research Concept',
      'title: "Modul 2: Praktiske krisevernrutiner"',
      'description: "Praktiske sjekklister og øvelser."',
      'status: draft',
      'generated:',
      '  model: gemini-4-argon',
      '  timestamp: 2026-11-01T12:00:00Z',
      'sources:',
      '  - id: lovdata-kriseforebygging-2015',
      '    title: "Forskrift om kriseforebygging — Lovdata"',
      '    url: https://www.lovdata.no/dokument/SF/forskrift/2015-12-17-1710/',
      '    retrieved_at: 2026-11-01T12:00:00Z',
      '  - id: krisevern-boka',
      '    title: "Krise&oslash;velse &ndash; Veileder"',
      '    url: https://assets.website-files.com/61a/6a9e9cef4a0a559c1c162d3e_6d.%20Den%20lille%20krisevern%20boka.pdf',
      '    retrieved_at: 2026-11-01T12:00:00Z',
      '---',
      '# Modul 2: Praktiske krisevernrutiner',
      '',
      'Dette bygger på [Modul 1: Lovverk og ansvar](/research/modul-1-lovverk.md) [^lovdata-kriseforebygging-2015] og veilederen [^krisevern-boka].',
      '',
      '## Sjekkliste Modul 2',
      '- [ ] Gjennomfør månedlig kriseøvelse [^krisevern-boka]',
      '- [ ] Sjekk rømningsveier mot snø og is [^lovdata-kriseforebygging-2015]',
      '',
      '[^lovdata-kriseforebygging-2015]: [Forskrift om kriseforebygging — Lovdata](https://www.lovdata.no/dokument/SF/forskrift/2015-12-17-1710/)',
      '[^krisevern-boka]: [Krise&oslash;velse &ndash; Veileder](https://assets.website-files.com/61a/6a9e9cef4a0a559c1c162d3e_6d.%20Den%20lille%20krisevern%20boka.pdf)',
    ].join('\n');

    fs.writeFileSync(path.join(mrResearchDir, 'modul-2-praktiske-rutiner.md'), mod2Md, 'utf-8');

    const run1Id = 'run-modul-1-1776670029755';
    const run2Id = 'run-modul-2-1776677941391';
    const run1Dir = path.join(mrRunsDir, run1Id);
    const run2Dir = path.join(mrRunsDir, run2Id);
    fs.mkdirSync(path.join(run1Dir, 'stages', '01_research', 'output'), { recursive: true });
    fs.mkdirSync(path.join(run1Dir, 'stages', '02_script', 'output'), { recursive: true });
    fs.mkdirSync(path.join(run2Dir, 'stages', '01_research', 'output'), { recursive: true });
    fs.mkdirSync(path.join(run2Dir, 'stages', '02_script', 'output'), { recursive: true });

    fs.writeFileSync(
      path.join(run1Dir, 'meta.json'),
      JSON.stringify({ runId: run1Id, okf: { bundleConceptId: 'research/modul-1-lovverk' } }, null, 2),
      'utf-8'
    );
    fs.writeFileSync(
      path.join(run1Dir, 'stages', '01_research', 'output', 'research_summary.md'),
      mod1Md,
      'utf-8'
    );
    fs.writeFileSync(
      path.join(run1Dir, 'stages', '02_script', 'output', 'script_draft.json'),
      JSON.stringify({
        courseTitle: 'Modul 1: Lovverk og ansvar',
        visualSummary: 'Oversikt for Modul 1.',
        spokenScript: 'Lydmanus for Modul 1.',
        trainingModules: [{ moduleNumber: 1, title: 'Lovkrav', narration: 'Innhold M1', keyPoints: ['P1'] }],
        quiz: [{ question: 'Spørsmål M1?', options: ['A', 'B'], correctIndex: 0, explanation: 'Fordi A.' }],
      }),
      'utf-8'
    );

    fs.writeFileSync(
      path.join(run2Dir, 'meta.json'),
      JSON.stringify({ runId: run2Id, okf: { bundleConceptId: 'research/modul-2-praktiske-rutiner' } }, null, 2),
      'utf-8'
    );
    fs.writeFileSync(
      path.join(run2Dir, 'stages', '01_research', 'output', 'research_summary.md'),
      mod2Md,
      'utf-8'
    );
    fs.writeFileSync(
      path.join(run2Dir, 'stages', '02_script', 'output', 'script_draft.json'),
      JSON.stringify({
        courseTitle: 'Modul 2: Praktiske krisevernrutiner',
        visualSummary: 'Oversikt for Modul 2.',
        spokenScript: 'Lydmanus for Modul 2.',
        trainingModules: [
          { moduleNumber: 1, title: 'Rømningsveier', narration: 'Innhold M2-1', keyPoints: ['P1'] },
          { moduleNumber: 2, title: 'Kriseøvelser', narration: 'Innhold M2-2', keyPoints: ['P2'] },
        ],
        quiz: [
          { question: 'Spørsmål M2-1?', options: ['A', 'B'], correctIndex: 0, explanation: 'Fordi A.' },
          { question: 'Spørsmål M2-2?', options: ['A', 'B'], correctIndex: 1, explanation: 'Fordi B.' },
        ],
      }),
      'utf-8'
    );

    // Test Fix D: injectBidirectionalBundleLinks updates both bundle/research/modul-1-lovverk.md and run1's research_summary.md
    const updatedBidirectional = injectBidirectionalBundleLinks(
      tmpMultiRunDir,
      'research/modul-2-praktiske-rutiner'
    );
    const updatedMod1Bundle = fs.readFileSync(path.join(mrResearchDir, 'modul-1-lovverk.md'), 'utf-8');
    const updatedMod1Run = fs.readFileSync(
      path.join(run1Dir, 'stages', '01_research', 'output', 'research_summary.md'),
      'utf-8'
    );
    const relHeadingIdx = updatedMod1Bundle.indexOf('## Relaterte konsepter i kunnskapsbasen');
    const fnDefIdx = updatedMod1Bundle.indexOf('[^lovdata-kriseforebygging]:');
    assert(
      updatedBidirectional.some((p) => p.replace(/\\/g, '/').includes('research/modul-1-lovverk')) &&
        updatedMod1Bundle.includes('[Modul 2: Praktiske krisevernrutiner](/research/modul-2-praktiske-rutiner.md)') &&
        updatedMod1Run.includes('[Modul 2: Praktiske krisevernrutiner](/research/modul-2-praktiske-rutiner.md)') &&
        relHeadingIdx !== -1 &&
        fnDefIdx !== -1 &&
        relHeadingIdx < fnDefIdx,
      'injectBidirectionalBundleLinks injects reciprocal concept links before footnote definitions in bundle/research/*.md and syncs them back to workspace/runs/*/stages/01_research/output/research_summary.md'
    );

    // Test Fix B & Fix E: generateBundleVisualization deduplicates shared URL sources into a single hub node and OKF_VIZ_JS resolves relative links
    const mrVizResult = generateBundleVisualization(mrBundleDir);
    const mrVizHtml = fs.readFileSync(mrVizResult.outputPath, 'utf-8');
    assert(
      mrVizResult.nodes === 4 &&
        mrVizResult.edges === 5 &&
        mrVizHtml.includes('[/research/modul-1-lovverk.md](/research/modul-1-lovverk.md)') &&
        mrVizHtml.includes('[/research/modul-2-praktiske-rutiner.md](/research/modul-2-praktiske-rutiner.md)') &&
        mrVizHtml.includes('Kriseøvelse – Veileder') &&
        !mrVizHtml.includes('&oslash;'),
      `generateBundleVisualization merges sources sharing the same canonical URL into a single hub node with clickable links to both concepts and decodes HTML entities (expected 4 nodes / 5 edges, got ${mrVizResult.nodes} nodes / ${mrVizResult.edges} edges)`
    );

    assert(
      vizHooks.resolveInternalConceptId('./modul-1-lovverk.md', 'research/modul-2-praktiske-rutiner') ===
        'research/modul-1-lovverk' &&
        vizHooks.resolveInternalConceptId('../research/modul-2-praktiske-rutiner.md', 'research/modul-2-praktiske-rutiner') ===
          'research/modul-2-praktiske-rutiner' &&
        vizHooks.resolveInternalConceptId('https://lovdata.no/test.md', 'research/modul-2-praktiske-rutiner') === null,
      'OKF_VIZ_JS resolveInternalConceptId resolves relative ./ and ../ .md links to canonical concept IDs while ignoring external https://*.md links'
    );

    // Test Fix A: Multi-run A2UI generation, bundleRuns switcher, and OkfMarkdown cross-concept navigation without corrupting active run checklist
    const mrA2uiResult = generateA2uiSurface({
      workspaceRoot: tmpMultiRunDir,
      runId: run2Id,
    });
    const mrA2uiHtml = fs.readFileSync(mrA2uiResult.htmlOutputPath, 'utf-8');
    assert(
      Array.isArray(mrA2uiResult.bundleRuns) &&
        mrA2uiResult.bundleRuns.length === 2 &&
        mrA2uiResult.bundleRuns[0].runId === run1Id &&
        mrA2uiResult.bundleRuns[0].conceptId === 'research/modul-1-lovverk' &&
        mrA2uiResult.bundleRuns[0].status === 'stable' &&
        mrA2uiResult.bundleRuns[0].trustTier === 'human-reviewed' &&
        mrA2uiResult.bundleRuns[0].sourcesCount === 1 &&
        mrA2uiResult.bundleRuns[0].checklistCount === 1 &&
        Boolean(mrA2uiResult.bundleRuns[0].shortLabel) &&
        mrA2uiResult.bundleRuns[1].runId === run2Id &&
        mrA2uiResult.bundleRuns[1].conceptId === 'research/modul-2-praktiske-rutiner' &&
        mrA2uiResult.bundleRuns[1].status === 'draft' &&
        mrA2uiResult.bundleRuns[1].trustTier === 'unverified' &&
        mrA2uiResult.bundleRuns[1].sourcesCount === 2 &&
        mrA2uiResult.bundleRuns[1].checklistCount === 2 &&
        mrA2uiResult.conceptCount === 4 &&
        mrA2uiHtml.includes('a2ui-run-switcher') &&
        mrA2uiHtml.includes('Kriseøvelse – Veileder') &&
        !mrA2uiHtml.includes('&oslash;'),
      `generateA2uiSurface embeds chronological bundleRuns with complete A2uiBundleRunEntry metadata for multi-module run switching and deduplicates shared graph source nodes`
    );

    const run1SiblingA2uiPath = path.join(run1Dir, 'a2ui.html');
    const run1SiblingHtml = fs.existsSync(run1SiblingA2uiPath)
      ? fs.readFileSync(run1SiblingA2uiPath, 'utf-8')
      : '';
    assert(
      fs.existsSync(run1SiblingA2uiPath) &&
        run1SiblingHtml.includes('a2ui-run-switcher') &&
        run1SiblingHtml.includes(`"surfaceId":"icm_${run1Id.replace(/[^a-zA-Z0-9_-]/g, '_')}"`),
      'generateA2uiSurface auto-refreshes sibling completed runs a2ui.html files with their own surfaceId and the unified multi-run switcher'
    );

    assert(
      studioHooks.resolveClientConceptId('./modul-1-lovverk.md', 'research/modul-2-praktiske-rutiner') ===
        'research/modul-1-lovverk' &&
        studioHooks.resolveClientConceptId('../research/modul-1-lovverk.md', 'research/modul-2-praktiske-rutiner') ===
          'research/modul-1-lovverk' &&
        studioHooks.resolveClientConceptId('https://lovdata.no/foo.md', 'research/modul-2-praktiske-rutiner') === null,
      'A2UI_STUDIO_JS resolveClientConceptId resolves root and relative .md links while rejecting external URLs'
    );

    // Verify navigateOkfMarkdownConcept updates sources/badges/title, preserves checkbox toggles made while viewing a cross-referenced concept, and switchActiveRun switches runs cleanly
    const payloadMatch = mrA2uiHtml.match(/window\.A2UI_SURFACE_PAYLOAD\s*=\s*(\{[\s\S]*?\});\s*<\/script>/);
    assert(Boolean(payloadMatch), 'A2UI HTML contains window.A2UI_SURFACE_PAYLOAD JSON');
    const parsedPayload = JSON.parse(payloadMatch![1]);
    const sharedSourceNode = (parsedPayload.bundleGraph?.nodes || []).find(
      (n: any) => n?.data?.id === 'source:lovdata-kriseforebygging'
    );
    assert(
      Boolean(sharedSourceNode) &&
        Array.isArray(sharedSourceNode.data.citedByConcepts) &&
        sharedSourceNode.data.citedByConcepts.includes('research/modul-1-lovverk') &&
        sharedSourceNode.data.citedByConcepts.includes('research/modul-2-praktiske-rutiner'),
      'generateA2uiSurface records all citing concepts in citedByConcepts on shared source hub nodes'
    );

    const simDataModel = JSON.parse(JSON.stringify(mrA2uiResult.bundleRuns![1].dataModel));
    const simSurface: Record<string, any> = {
      surfaceId: mrA2uiResult.surfaceId,
      activeRunId: run2Id,
      components: {
        badge_status: { id: 'badge_status', component: 'Badge', tone: 'warn' },
        badge_trust: { id: 'badge_trust', component: 'Badge', tone: 'primary' },
        badge_freshness: { id: 'badge_freshness', component: 'Badge', tone: 'success' },
        main_tabs: {
          id: 'main_tabs',
          component: 'Tabs',
          tabs: [
            { child: 'tab_checklist', title: '✅ Interaktiv Sjekkliste (2)' },
            { child: 'tab_modules', title: '🎓 Moduler (2)' },
            { child: 'tab_quiz', title: '🧪 Quiz (2)' },
          ],
        },
      },
      dataModel: simDataModel,
    };
    const origChecklistCount = simSurface.dataModel.checklist.totalCount;
    const activeHooks: Record<string, any> = {};
    // eslint-disable-next-line no-new-func
    new Function('window', A2UI_STUDIO_JS)({
      A2UI_SURFACE_PAYLOAD: parsedPayload,
      __ICM_TEST_HOOKS__: activeHooks,
    });

    activeHooks.navigateOkfMarkdownConcept(simSurface, 'research/modul-1-lovverk', 'Modul 1');
    assert(
      simSurface.dataModel.okf.activeConceptId === 'research/modul-1-lovverk' &&
        simSurface.dataModel.okf.viewingStubConcept === true &&
        simSurface.dataModel.okf.trustTier === 'human-reviewed' &&
        simSurface.components.badge_status.tone === 'success' &&
        simSurface.components.badge_trust.tone === 'accent' &&
        simSurface.dataModel.okf.sources.length === 1 &&
        simSurface.dataModel.okf.sources[0].id === 'lovdata-kriseforebygging' &&
        simSurface.dataModel.checklist.totalCount === origChecklistCount &&
        origChecklistCount === 2,
      `navigateOkfMarkdownConcept updates /okf/title, /okf/sources, /okf/trustTier, and badge tones to the linked concept while preserving the active run checklist (got ${JSON.stringify({ activeCid: simSurface.dataModel.okf.activeConceptId, viewingStub: simSurface.dataModel.okf.viewingStubConcept, trustTier: simSurface.dataModel.okf.trustTier, sources: simSurface.dataModel.okf.sources, origChecklistCount, afterChecklistCount: simSurface.dataModel.checklist.totalCount })})`
    );

    // Toggle a checkbox in Tab 2 while viewing a cross-referenced concept in Tab 6, then return to primaryConceptId
    simSurface.dataModel.checklist.groups[0].items[0].checked = true;
    activeHooks.syncChecklistToOkfBody(simSurface);

    activeHooks.navigateOkfMarkdownConcept(simSurface, 'research/modul-2-praktiske-rutiner');
    assert(
      simSurface.dataModel.okf.activeConceptId === 'research/modul-2-praktiske-rutiner' &&
        simSurface.dataModel.okf.viewingStubConcept === false &&
        simSurface.dataModel.okf.trustTier === 'unverified' &&
        simSurface.components.badge_status.tone === 'warn' &&
        simSurface.components.badge_trust.tone === 'primary' &&
        simSurface.dataModel.okf.sources.length === 2 &&
        simSurface.dataModel.checklist.groups[0].items[0].checked === true,
      `navigateOkfMarkdownConcept restores primary concept sources, badges, and viewingStubConcept=false while preserving checkbox toggles made while viewing a cross-referenced concept`
    );

    // Switch active run from Run 2 to Run 1 and back
    const switchedToRun1 = activeHooks.switchActiveRun(simSurface, run1Id);
    assert(
      switchedToRun1 === true &&
        simSurface.activeRunId === run1Id &&
        simSurface.dataModel.meta.runId === run1Id &&
        simSurface.components.badge_status.tone === 'success' &&
        simSurface.components.badge_trust.tone === 'accent' &&
        simSurface.components.main_tabs.tabs.find((t: any) => t.child === 'tab_checklist')?.title ===
          '✅ Interaktiv Sjekkliste (1)' &&
        simSurface.components.main_tabs.tabs.find((t: any) => t.child === 'tab_modules')?.title ===
          '🎓 Moduler (1)' &&
        simSurface.components.main_tabs.tabs.find((t: any) => t.child === 'tab_quiz')?.title ===
          '🧪 Quiz (1)',
      'switchActiveRun switches surface state, badge tones, and main_tabs counts to Run 1 while caching Run 2 state'
    );
    const switchedBackToRun2 = activeHooks.switchActiveRun(simSurface, run2Id);
    assert(
      switchedBackToRun2 === true &&
        simSurface.activeRunId === run2Id &&
        simSurface.dataModel.checklist.groups[0].items[0].checked === true &&
        simSurface.components.main_tabs.tabs.find((t: any) => t.child === 'tab_checklist')?.title ===
          '✅ Interaktiv Sjekkliste (2)',
      'switchActiveRun restores cached Run 2 state including in-session checklist progress'
    );

    // Test Item 4: Navigating to a cross-referenced concept (viewingStubConcept = true) and immediately switching runs resets viewingStubConcept before snapshotting the outgoing run
    activeHooks.navigateOkfMarkdownConcept(simSurface, 'research/modul-1-lovverk', 'Modul 1');
    assert(
      simSurface.viewingStubConcept === true &&
        simSurface.dataModel.okf.viewingStubConcept === true &&
        simSurface.dataModel.okf.activeConceptId === 'research/modul-1-lovverk',
      'Precondition: viewingStubConcept is true on Run 2 before switching runs'
    );
    activeHooks.switchActiveRun(simSurface, run1Id);
    activeHooks.switchActiveRun(simSurface, run2Id);
    assert(
      simSurface.viewingStubConcept === false &&
        simSurface.dataModel.okf.viewingStubConcept === false &&
        simSurface.dataModel.okf.activeConceptId === 'research/modul-2-praktiske-rutiner' &&
        simSurface.dataModel.okf.title === 'Modul 2: Praktiske krisevernrutiner' &&
        simSurface.components.badge_status.tone === 'warn' &&
        simSurface.components.badge_trust.tone === 'primary',
      'switchActiveRun restores the outgoing run primary concept before snapshotting runStates[curRunId] so switching back never leaves the run stuck on a foreign stub concept'
    );
    simSurface.viewingStubConcept = true;
    simSurface.dataModel.okf.viewingStubConcept = false;
    simSurface.dataModel.okf.title = 'Foreign Stub Title';
    simSurface.dataModel.okf.body = 'Foreign Stub Body';
    activeHooks.switchActiveRun(simSurface, run1Id);
    activeHooks.switchActiveRun(simSurface, run2Id);
    assert(
      simSurface.viewingStubConcept === false &&
        simSurface.dataModel.okf.title === 'Modul 2: Praktiske krisevernrutiner',
      'switchActiveRun restores primaryTitle even when only surface.viewingStubConcept is true without overwriting primaryTitle'
    );

    // Test Item 8: Disambiguated --2 source node visual label & URL path slug parenthetical in generateBundleVisualization() and generateA2uiSurface()
    const mod1WithDsb = `${mod1Md.replace(
      'sources:\n',
      [
        'sources:',
        '  - id: dsb-veiledning-kriseforebygging',
        '    title: "Veiledning til forskrift om kriseforebygging — DSB"',
        '    url: https://www.dsb.no/krisesikkerhet/tema/forskrift-om-kriseforebygging/',
        '    retrieved_at: 2026-11-01T10:00:00Z',
      ].join('\n') + '\n'
    )}\nVeiledning [^dsb-veiledning-kriseforebygging].\n[^dsb-veiledning-kriseforebygging]: Veiledning til forskrift om kriseforebygging — DSB\n`;
    const mod2WithDsb = `${mod2Md.replace(
      'sources:\n',
      [
        'sources:',
        '  - id: dsb-veiledning-kriseforebygging',
        '    title: "Veiledning til forskrift om kriseforebygging — DSB"',
        '    url: https://www.dsb.no/lover/krisevern-krisevesen-nodnett/veiledning-til-forskrift-om-kriseforebygging/',
        '    retrieved_at: 2026-11-01T12:00:00Z',
      ].join('\n') + '\n'
    )}\nVeiledning [^dsb-veiledning-kriseforebygging].\n[^dsb-veiledning-kriseforebygging]: Veiledning til forskrift om kriseforebygging — DSB\n`;
    fs.writeFileSync(path.join(mrResearchDir, 'modul-1-lovverk.md'), mod1WithDsb, 'utf-8');
    fs.writeFileSync(path.join(mrResearchDir, 'modul-2-praktiske-rutiner.md'), mod2WithDsb, 'utf-8');
    const disambigViz = generateBundleVisualization(mrBundleDir);
    const disambigVizHtml = fs.readFileSync(disambigViz.outputPath, 'utf-8');
    const disambigA2ui = generateA2uiSurface({ workspaceRoot: tmpMultiRunDir, runId: run2Id });
    const disambigA2uiHtml = fs.readFileSync(disambigA2ui.htmlOutputPath, 'utf-8');
    const disambigA2uiPayloadMatch = disambigA2uiHtml.match(
      /window\.A2UI_SURFACE_PAYLOAD\s*=\s*(\{[\s\S]*?\});\s*<\/script>/
    );
    const disambigA2uiPayload = disambigA2uiPayloadMatch
      ? JSON.parse(disambigA2uiPayloadMatch[1])
      : null;
    const disambigA2uiNode2 = disambigA2uiPayload?.bundleGraph?.nodes?.find(
      (n: any) => n?.data?.id === 'source:dsb-veiledning-kriseforebygging--2'
    )?.data;
    assert(
      disambigVizHtml.includes('"id":"source:dsb-veiledning-kriseforebygging--2"') &&
        disambigVizHtml.includes('[^dsb-veiledning-kriseforebygging--2]') &&
        disambigVizHtml.includes('(veiledning-til-forskrift-om-kriseforebygging)') &&
        disambigA2uiNode2 &&
        String(disambigA2uiNode2.label).includes('[^dsb-veiledning-kriseforebygging--2]') &&
        String(disambigA2uiNode2.label).includes('(veiledning-til-forskrift-om-kriseforebygging)') &&
        String(disambigA2uiNode2.fullTitle).includes('[^dsb-veiledning-kriseforebygging--2]') &&
        String(disambigA2uiNode2.fullTitle).includes('(veiledning-til-forskrift-om-kriseforebygging)'),
      'generateBundleVisualization and generateA2uiSurface disambiguate --2 source node visual labels (both label and fullTitle) and append the last URL path slug in parentheses when titles match'
    );
  } finally {
    fs.rmSync(tmpMultiRunDir, { recursive: true, force: true });
  }

  // Stage-1 Intermission A2UI Review Mode & Interactive Source Curation Suite Self-Tests
  const tmpStage1ReviewDir = fs.mkdtempSync(path.join(os.tmpdir(), 'icm-stage1-curation-'));
  try {
    const s1RunId = 'krisevern-stage1-review-1775500000000';
    const s1RunDir = path.join(tmpStage1ReviewDir, 'runs', s1RunId);
    const s1OutDir = path.join(s1RunDir, 'stages', '01_research', 'output');
    const s1BundleDir = path.join(tmpStage1ReviewDir, 'bundle');
    const s1BundleResearchDir = path.join(s1BundleDir, 'research');
    fs.mkdirSync(s1OutDir, { recursive: true });
    fs.mkdirSync(s1BundleResearchDir, { recursive: true });
    saveWorkspaceLocale(tmpStage1ReviewDir, NB_NO_TEST_LOCALE);

    const s1InitialMd = [
      '---',
      'type: Research Concept',
      'title: "Krisevern i kontorbygg — Modul 1"',
      'description: "Stage 1 kunnskapsgrunnlag for krisevern i kontorbygg."',
      'tags:',
      '  - krisevern',
      '  - kontorhus',
      'status: draft',
      'generated:',
      '  at: 2026-11-02T10:00:00Z',
      `  by: model:${GEMINI_4_ARGON_MODEL}`,
      'stale_after: 2027-05-02T00:00:00Z',
      'sources:',
      '  - id: lovdata-internkontroll',
      '    title: "Internkontrollforskriften § 5 — Lovdata"',
      '    url: https://lovdata.no/dokument/SF/forskrift/1996-12-06-1127',
      '    retrieved_at: 2026-11-02T10:00:00Z',
      '  - id: svak-blogg-kilde',
      '    title: "Uoffisiell blogg om krisevern"',
      '    url: https://example.com/blogg/krisevern-tips',
      '    retrieved_at: 2026-11-02T10:00:00Z',
      '---',
      '# Krisevern i kontorbygg — Modul 1',
      '',
      'Leder skal dokumentere systematisk HMS-arbeid og krisevern i avdelingen[^lovdata-internkontroll].',
      '',
      'Uverifisert påstand om at kriseøvelse kun trengs hvert tredje år[^svak-blogg-kilde].',
      '',
      '## Sjekkliste',
      '- [ ] Gjennomfør risikovurdering for avdelingen[^lovdata-internkontroll]',
      '',
      '[^lovdata-internkontroll]: Internkontrollforskriften § 5 — Lovdata',
      '[^svak-blogg-kilde]: Uoffisiell blogg om krisevern',
      '',
    ].join('\n');

    fs.writeFileSync(path.join(s1OutDir, 'research_summary.md'), s1InitialMd, 'utf-8');
    fs.writeFileSync(
      path.join(s1BundleResearchDir, 'krisevern-i-kontorbygg-modul-1.md'),
      s1InitialMd,
      'utf-8'
    );
    fs.writeFileSync(
      path.join(s1OutDir, 'thinking_trace.md'),
      [
        '# Stage 1 Thinking & Search Trace',
        '',
        `- **Model:** \`${GEMINI_4_ARGON_MODEL}\``,
        '- **Thinking Level:** `HIGH`',
        '- **Duration:** 14.2s',
        '- **Input Tokens:** 1200',
        '- **Thinking Tokens:** 800',
        '- **Output Tokens:** 950',
        '- **Total Tokens:** 2950',
        '',
        '## Executed Google Search Queries',
        '1. `forskrift om kriseforebygging kontorhus lovdata`',
        '2. `internkontrollforskriften leder ansvar kontorhus`',
        '',
        '## Reasoning Steps',
        'Verified statutory obligations for kindergarten fire safety.',
      ].join('\n'),
      'utf-8'
    );
    fs.writeFileSync(
      path.join(s1RunDir, 'meta.json'),
      JSON.stringify(
        {
          runId: s1RunId,
          topic: 'Krisevern i kontorbygg — Modul 1',
          model: GEMINI_4_ARGON_MODEL,
          status: 'stage1_completed',
          stage1Telemetry: {
            thinkingLevel: 'HIGH',
            thoughtSteps: 4,
            searchQueries: [
              'forskrift om kriseforebygging kontorhus lovdata',
              'internkontrollforskriften leder ansvar kontorhus',
            ],
            inputTokens: 1200,
            thoughtsTokens: 800,
            outputTokens: 950,
            totalTokens: 2950,
            durationMs: 14200,
          },
          okf: {
            bundleConceptId: 'research/krisevern-i-kontorbygg-modul-1',
            trustTier: 'auto',
            isStale: false,
          },
        },
        null,
        2
      ),
      'utf-8'
    );

    // 1. Verify generateA2uiSurface() in Stage-1 Intermission Review Mode (`isStage1Only === true`)
    const s1A2uiRes = generateA2uiSurface({
      workspaceRoot: tmpStage1ReviewDir,
      runId: s1RunId,
    });
    const s1Html = fs.readFileSync(s1A2uiRes.htmlOutputPath, 'utf-8');
    const s1UpdateCompsMsg = s1A2uiRes.messages.find(
      (m): m is A2uiUpdateComponentsMessage => 'updateComponents' in m
    );
    const s1MainTabsComp = s1UpdateCompsMsg?.updateComponents.components.find(
      (c) => c.id === 'main_tabs'
    );
    const s1UpdateDataMsg = s1A2uiRes.messages.find(
      (m): m is A2uiUpdateDataModelMessage => 'updateDataModel' in m
    );
    const s1DataModel = (s1UpdateDataMsg?.updateDataModel.value || {}) as Record<string, any>;
    assert(
      s1A2uiRes.isStage1Only === true &&
        s1A2uiRes.tabCount === 3 &&
        s1A2uiRes.checklistItemCount === 0 &&
        Array.isArray(s1MainTabsComp?.tabs) &&
        s1MainTabsComp!.tabs.length === 3 &&
        s1MainTabsComp!.tabs[0].child === 'tab_okf_markdown' &&
        s1MainTabsComp!.tabs[0].title.includes('(2)') &&
        s1MainTabsComp!.tabs[1].child === 'tab_overview' &&
        s1MainTabsComp!.tabs[1].title.includes('2 søk') &&
        s1MainTabsComp!.tabs[2].child === 'tab_okf_graph' &&
        !s1MainTabsComp!.tabs.some((t: any) => t.child === 'tab_checklist') &&
        !s1UpdateCompsMsg?.updateComponents.components.some((c) => c.id === 'tab_checklist') &&
        String(s1DataModel?.okf?.body || '').includes('- [ ] Gjennomfør risikovurdering') &&
        s1A2uiRes.surfaceJsonPath.replace(/\\/g, '/').includes('stages/01_research/output/a2ui_surface.json') &&
        !fs.existsSync(path.join(s1RunDir, 'stages', '02_script', 'output')) &&
        Array.isArray(s1DataModel?.okf?.stage1Trace?.searchQueries) &&
        s1DataModel.okf.stage1Trace.searchQueries.length === 2 &&
        s1Html.includes('okf-curation-banner') &&
        s1Html.includes('toggleRejectSourceInStudio') &&
        s1Html.includes('addSourceInStudio'),
      `generateA2uiSurface in Stage-1 Intermission Review Mode gates out tab_checklist (strictly 3 epistemic tabs while keeping - [ ] inside okf/body), places tab_okf_markdown first, populates stage1Trace, and writes a2ui_surface.json to stages/01_research/output/ without creating stages/02_script/output`
    );

    const s1TraceBody = String(s1DataModel?.stage2?.scriptBody || '');
    assert(
      s1TraceBody.includes('### 📊 Stage 1 Telemetri & Grounding-statistikk') &&
        s1TraceBody.includes('### 🔎 Utførte Google-søk (2)') &&
        !s1TraceBody.includes('- **Total Tokens:**') &&
        !s1TraceBody.includes('## Executed Google Search Queries') &&
        s1TraceBody.includes('## Reasoning Steps'),
      `formatStage1TraceOverviewBody deduplicates top telemetry bullets and Executed Google Search Queries header from thinking_trace.md while preserving ## Reasoning Steps (got: ${JSON.stringify(s1TraceBody)})`
    );

    // 2. Verify A2UI_STUDIO_JS interactive source curation hooks (inspectSourceCitationsInBody, toggleRejectSourceInStudio, addSourceInStudio, buildCurationPrompts)
    const s1PayloadMatch = s1Html.match(
      /window\.A2UI_SURFACE_PAYLOAD\s*=\s*(\{[\s\S]*?\});\s*<\/script>/
    );
    const s1ParsedPayload = s1PayloadMatch ? JSON.parse(s1PayloadMatch[1]) : {};
    const s1Hooks: Record<string, any> = {};
    // eslint-disable-next-line no-new-func
    new Function('window', A2UI_STUDIO_JS)({
      A2UI_SURFACE_PAYLOAD: s1ParsedPayload,
      __ICM_TEST_HOOKS__: s1Hooks,
    });
    const clientChkGroups = s1Hooks.extractChecklistGroupsClient(sampleChecklistMd);
    const chkSyncSim: Record<string, any> = {
      surfaceId: 'chk-sync-test',
      components: {},
      dataModel: {
        okf: { body: sampleChecklistMd, primaryBody: sampleChecklistMd, viewingStubConcept: false },
        checklist: { fromStage2: false, groups: JSON.parse(JSON.stringify(clientChkGroups)) },
      },
    };
    chkSyncSim.dataModel.checklist.groups[1].items[1].checked = true; // chk_item_4 (post-subgroup top-level item)
    s1Hooks.syncChecklistToOkfBody(chkSyncSim);
    assert(
      clientChkGroups.length === 5 &&
        clientChkGroups[1].items.length === 3 &&
        clientChkGroups[1].items[1].id === 'chk_item_4' &&
        chkSyncSim.dataModel.okf.body.includes('- [x] **Tekniske rom og tavlerom**:') &&
        chkSyncSim.dataModel.okf.body.includes('  - [ ] Kontroller manometer på håndslokkere.'),
      `extractChecklistGroupsClient matches server subgroup reunion and syncChecklistToOkfBody maps chk_item_<N> to exact leaf line in okf/body`
    );

    const s1SimSurface: Record<string, any> = {
      surfaceId: s1A2uiRes.surfaceId,
      activeRunId: s1RunId,
      components: {},
      dataModel: JSON.parse(JSON.stringify(s1DataModel)),
    };

    const initialPrompts = s1Hooks.buildCurationPrompts(s1SimSurface);
    assert(
      initialPrompts.agyText.includes('godkjenner alle kildene') &&
        initialPrompts.cliText === `npm run cli:verify -- ${s1RunId} --by human:fagansvarlig`,
      `buildCurationPrompts generates clean sign-off prompt when 0 sources are rejected or added (got: ${JSON.stringify(initialPrompts)})`
    );

    const afterReject = s1Hooks.toggleRejectSourceInStudio(s1SimSurface, 'svak-blogg-kilde');
    const rejStats = s1SimSurface.dataModel.okf.sourceCitationStats?.['svak-blogg-kilde'];
    const formattedWithRejected = s1Hooks.formatInlineLatexAndFootnotes(
      s1SimSurface.dataModel.okf.body,
      s1SimSurface.dataModel.okf.sources,
      s1SimSurface.dataModel.okf.rejectedSources
    );
    assert(
      Array.isArray(afterReject) &&
        afterReject.includes('svak-blogg-kilde') &&
        s1SimSurface.dataModel.okf.sourcesBadge === '1 verifiserte kilder' &&
        rejStats &&
        rejStats.mentionCount === 1 &&
        Array.isArray(rejStats.soleClaimLines) &&
        rejStats.soleClaimLines.length === 1 &&
        rejStats.soleClaimLines[0].includes('hvert tredje år') &&
        formattedWithRejected.includes('class="fn-ref fn-rejected"') &&
        String(s1SimSurface.dataModel.okf.curationCliText).includes('--reject-source svak-blogg-kilde'),
      `toggleRejectSourceInStudio marks source rejected, updates active sourcesBadge, computes soleClaimLines, styles inline footnote as fn-rejected, and updates CLI curation command`
    );

    const addedSrcObj = s1Hooks.addSourceInStudio(
      s1SimSurface,
      'https://lovdata.no/dokument/SF/forskrift/2015-12-17-1710',
      'Forskrift om kriseforebygging §§ 11–13'
    );
    assert(
      Boolean(addedSrcObj) &&
        addedSrcObj.id.startsWith('forskrift-om-kriseforebyggin') &&
        s1SimSurface.dataModel.okf.sources.length === 3 &&
        s1SimSurface.dataModel.okf.addedSources.length === 1 &&
        s1SimSurface.dataModel.okf.sourcesBadge === '2 verifiserte kilder' &&
        String(s1SimSurface.dataModel.okf.body).includes(`[^${addedSrcObj.id}]: Forskrift om kriseforebygging §§ 11–13`) &&
        String(s1SimSurface.dataModel.okf.curationAgyText).includes('Avvis kilder: [svak-blogg-kilde].') &&
        String(s1SimSurface.dataModel.okf.curationAgyText).includes('Legg til kilder: [https://lovdata.no/dokument/SF/forskrift/2015-12-17-1710|Forskrift om kriseforebygging §§ 11–13].') &&
        String(s1SimSurface.dataModel.okf.curationCliText).includes('--reject-source svak-blogg-kilde') &&
        String(s1SimSurface.dataModel.okf.curationCliText).includes('--add-source "https://lovdata.no/dokument/SF/forskrift/2015-12-17-1710|Forskrift om kriseforebygging §§ 11–13"'),
      `addSourceInStudio appends human source to /okf/sources, /okf/addedSources, and /okf/body and generates full AGY + CLI curation commands`
    );

    // 3. Verify curateOkfSources() and verifyOkfConcept() with rejectSourceIds + addSources (3-way footnote parity & auto-refresh of a2ui.html)
    const verifyCuratedRes = verifyOkfConcept(s1RunId, {
      workspaceRoot: tmpStage1ReviewDir,
      by: 'human:fagansvarlig',
      rejectSourceIds: ['svak-blogg-kilde'],
      addSources: [
        {
          url: 'https://lovdata.no/dokument/SF/forskrift/2015-12-17-1710',
          title: 'Forskrift om kriseforebygging §§ 11–13',
        },
      ],
    });
    const postVerifyRunMd = fs.readFileSync(path.join(s1OutDir, 'research_summary.md'), 'utf-8');
    const postVerifyBundleMd = fs.readFileSync(
      path.join(s1BundleResearchDir, 'krisevern-i-kontorbygg-modul-1.md'),
      'utf-8'
    );
    const postVerifyDoc = parseOkfDocument(postVerifyRunMd);
    const postVerifySourceIds = (postVerifyDoc.frontmatter.sources || []).map((s) => s.id);
    const postVerifyA2uiHtml = fs.readFileSync(path.join(s1RunDir, 'a2ui.html'), 'utf-8');
    assert(
      verifyCuratedRes.status === 'stable' &&
        verifyCuratedRes.trust_tier === 'human-reviewed' &&
        Array.isArray(verifyCuratedRes.rejectedIds) &&
        verifyCuratedRes.rejectedIds.includes('svak-blogg-kilde') &&
        Array.isArray(verifyCuratedRes.addedSources) &&
        verifyCuratedRes.addedSources.length === 1 &&
        Array.isArray(verifyCuratedRes.orphanClaimLines) &&
        verifyCuratedRes.orphanClaimLines.length === 1 &&
        verifyCuratedRes.orphanClaimLines[0].includes('hvert tredje år') &&
        !postVerifySourceIds.includes('svak-blogg-kilde') &&
        !postVerifyRunMd.includes('svak-blogg-kilde') &&
        !postVerifyBundleMd.includes('svak-blogg-kilde') &&
        postVerifyRunMd.includes('Forskrift om kriseforebygging §§ 11–13') &&
        postVerifyBundleMd.includes('Forskrift om kriseforebygging §§ 11–13') &&
        postVerifyRunMd.includes(`[^${verifyCuratedRes.addedSources[0].id}]`) &&
        postVerifyRunMd.includes(`[^${verifyCuratedRes.addedSources[0].id}]:`) &&
        postVerifyA2uiHtml.includes('trust: human-reviewed') &&
        !postVerifyA2uiHtml.includes('svak-blogg-kilde'),
      `verifyOkfConcept with rejectSourceIds and addSources enforces 3-way OKF v0.3 footnote parity, reports orphanClaimLines, syncs bundle without re-merging rejected sources, and refreshes a2ui.html`
    );

    // 4. Edge cases: un-reject toggle in Studio, rejecting a human-added source, prefix-overlapping source IDs (lovdata-2 vs lovdata-20), table cells, multi-sentence orphan claims, and duplicate canonical URLs in curateOkfSources
    const afterUnreject = s1Hooks.toggleRejectSourceInStudio(s1SimSurface, 'svak-blogg-kilde');
    assert(
      Array.isArray(afterUnreject) &&
        !afterUnreject.includes('svak-blogg-kilde') &&
        s1SimSurface.dataModel.okf.sourcesBadge === '3 verifiserte kilder' &&
        !String(s1SimSurface.dataModel.okf.curationCliText).includes('--reject-source'),
      `toggleRejectSourceInStudio un-rejects a previously rejected source and restores active source count`
    );

    // Rejecting a human-added source in Studio should cancel its addition rather than emitting both --reject-source and --add-source
    s1Hooks.toggleRejectSourceInStudio(s1SimSurface, addedSrcObj.id);
    assert(
      !String(s1SimSurface.dataModel.okf.curationCliText).includes('--reject-source') &&
        !String(s1SimSurface.dataModel.okf.curationCliText).includes('--add-source'),
      `Rejecting a human-added source in Studio cancels its pending --add-source without emitting a contradictory --reject-source`
    );
    // Un-reject the human-added source and re-reject svak-blogg-kilde for subsequent checks
    s1Hooks.toggleRejectSourceInStudio(s1SimSurface, addedSrcObj.id);
    s1Hooks.toggleRejectSourceInStudio(s1SimSurface, 'svak-blogg-kilde');

    // 5. Execute OkfMarkdown DOM rendering via renderComponent with a lightweight mock document
    const createMockElement = (tag: string): any => {
      const el: any = {
        tagName: String(tag || 'div').toUpperCase(),
        id: '',
        className: '',
        textContent: '',
        innerHTML: '',
        type: '',
        placeholder: '',
        value: '',
        rows: 0,
        style: {},
        attributes: {} as Record<string, string>,
        children: [] as any[],
        listeners: {} as Record<string, Function[]>,
        appendChild(child: any) {
          if (child) this.children.push(child);
          return child;
        },
        setAttribute(k: string, v: string) {
          this.attributes[k] = String(v);
          if (k === 'id') this.id = String(v);
          if (k === 'class') this.className = String(v);
        },
        getAttribute(k: string) {
          return this.attributes[k] || '';
        },
        addEventListener(ev: string, fn: Function) {
          this.listeners[ev] = this.listeners[ev] || [];
          this.listeners[ev].push(fn);
        },
        querySelector() {
          return null;
        },
        querySelectorAll() {
          return [];
        },
      };
      return el;
    };
    const findInMockDom = (root: any, predicate: (node: any) => boolean): any => {
      if (!root) return null;
      if (predicate(root)) return root;
      for (const ch of root.children || []) {
        const found = findInMockDom(ch, predicate);
        if (found) return found;
      }
      return null;
    };
    const prevGlobalDoc = (globalThis as any).document;
    try {
      (globalThis as any).document = {
        createElement: createMockElement,
        getElementById: () => null,
        querySelector: () => null,
        querySelectorAll: () => [],
      };
      const okfMdComp = s1UpdateCompsMsg?.updateComponents.components.find(
        (c) => c.id === 'tab_okf_markdown'
      );
      s1Hooks.mountSurface(s1SimSurface);
      const renderedOkfDom = s1Hooks.renderComponent(s1SimSurface, okfMdComp);
      const bannerNode = findInMockDom(renderedOkfDom, (n) => n.id === 'okf-curation-banner');
      const agyTextNode = findInMockDom(renderedOkfDom, (n) => n.id === 'okf-curation-agy-text');
      const cliTextNode = findInMockDom(renderedOkfDom, (n) => n.id === 'okf-curation-cli-text');
      const addUrlNode = findInMockDom(renderedOkfDom, (n) => n.id === 'okf-add-source-url');
      const addBtnNode = findInMockDom(renderedOkfDom, (n) => n.id === 'okf-add-source-btn');
      const rejBtnNode = findInMockDom(
        renderedOkfDom,
        (n) => typeof n.className === 'string' && n.className.includes('okf-reject-btn')
      );
      assert(
        Boolean(bannerNode) &&
          Boolean(agyTextNode) &&
          String(agyTextNode.textContent).includes('Avvis kilder: [svak-blogg-kilde]') &&
          Boolean(cliTextNode) &&
          String(cliTextNode.textContent).includes('--reject-source svak-blogg-kilde') &&
          Boolean(addUrlNode) &&
          Boolean(addBtnNode) &&
          Boolean(rejBtnNode),
        `OkfMarkdown renderComponent builds #okf-curation-banner, #okf-curation-agy-text, #okf-curation-cli-text, #okf-add-source-url, and .okf-reject-btn DOM nodes`
      );
    } finally {
      if (prevGlobalDoc === undefined) {
        delete (globalThis as any).document;
      } else {
        (globalThis as any).document = prevGlobalDoc;
      }
    }

    // 6. Verify curateOkfSources with table cells, multi-sentence orphan claims, stacked footnotes, code fences, and lastModified preservation
    const overlapMd = [
      '---',
      'type: Research Concept',
      'title: "Overlap Test"',
      'description: "Prefix overlap test"',
      'status: draft',
      'sources:',
      '  - id: lovdata-2',
      '    title: "Lovdata Kort ID"',
      '    url: https://lovdata.no/kort',
      '    retrieved_at: 2026-11-02T10:00:00Z',
      '  - id: lovdata-20',
      '    title: "Lovdata Lang ID"',
      '    url: https://lovdata.no/lang',
      '    retrieved_at: 2026-11-02T10:00:00Z',
      '---',
      '# Overlap Test',
      '',
      '```markdown',
      'Kodeblokk som ikke skal få fotnote.',
      '```',
      '',
      'Kort påstand[^lovdata-2] og lang påstand[^lovdata-20].',
      '',
      'Første setning er dokumentert[^lovdata-20]. Andre setning hviler kun på kort kilde[^lovdata-2].',
      '',
      '| Krav | Hjemmel |',
      '| --- | --- |',
      '| Internkontroll | [^lovdata-20] |',
      '| Svakt krav | Hjemmel [^lovdata-2] |',
      '',
      '[^lovdata-2]: Lovdata Kort ID',
      '[^lovdata-20]: Lovdata Lang ID',
      '',
    ].join('\n');
    const overlapCurated = curateOkfSources(overlapMd, {
      rejectSourceIds: ['[^lovdata-2]'],
      addSources: [
        // Duplicate canonical URL (differing only by www. and trailing slash) should be deduplicated
        { url: 'https://www.lovdata.no/lang/#section1', title: 'Duplicate Lang' },
        // New source with lastModified (camelCase) and last_modified (snake_case) support
        {
          url: 'https://www.dsb.no/veiledninger/krisevern',
          title: 'DSB Veiledning om krisevern',
          lastModified: '2026-05-01T00:00:00Z',
        },
      ],
    });
    const overlapDoc = parseOkfDocument(overlapCurated.markdown);
    const dsbSrc = (overlapDoc.frontmatter.sources || []).find((s) =>
      String(s.resource || s.url || '').includes('dsb.no')
    );
    assert(
      overlapCurated.rejectedIds.length === 1 &&
        overlapCurated.rejectedIds[0] === 'lovdata-2' &&
        overlapCurated.addedSources.length === 1 &&
        Boolean(dsbSrc) &&
        dsbSrc?.last_modified === '2026-05-01T00:00:00Z' &&
        overlapCurated.orphanClaimLines.some((l) => l.includes('Andre setning hviler kun på kort kilde')) &&
        overlapCurated.orphanClaimLines.some((l) => l.includes('Svakt krav')) &&
        overlapDoc.frontmatter.sources?.length === 2 &&
        !overlapCurated.markdown.includes('[^lovdata-2]') &&
        overlapCurated.markdown.includes('[^lovdata-20]') &&
        overlapCurated.markdown.includes('| Internkontroll | [^lovdata-20] |') &&
        overlapCurated.markdown.includes('| Svakt krav | Hjemmel |') &&
        !overlapCurated.markdown.includes('Kodeblokk som ikke skal få fotnote[^') &&
        overlapCurated.markdown.includes(`Kort påstand og lang påstand[^lovdata-20] [^${dsbSrc?.id}].`),
      `curateOkfSources strips exact rejected footnote [^lovdata-2], preserves table cell spacing, detects sentence-level and table-row orphan claims, skips code fences when weaving citations, and preserves last_modified`
    );

    // 7. Verify multi-run Stage-1-only + completed Stage 1+2 run coexistence, bullet search query fallback parsing, and one-off edit before cli:verify
    const s2RunId = 'krisevern-modul-2-1775500000100';
    const s2RunDir = path.join(tmpStage1ReviewDir, 'runs', s2RunId);
    const s2Stage1Out = path.join(s2RunDir, 'stages', '01_research', 'output');
    const s2Stage2Out = path.join(s2RunDir, 'stages', '02_script', 'output');
    fs.mkdirSync(s2Stage1Out, { recursive: true });
    fs.mkdirSync(s2Stage2Out, { recursive: true });
    fs.writeFileSync(
      path.join(s2Stage1Out, 'research_summary.md'),
      [
        '---',
        'type: Research Concept',
        'title: "Krisevern Modul 2"',
        'description: "Evakueringsrutiner"',
        'status: stable',
        'verified:',
        '  - by: human:fagansvarlig',
        '    at: 2026-11-02T11:00:00Z',
        'sources:',
        '  - id: dsb-evakuering',
        '    title: "DSB Evakueringsveileder"',
        '    resource: https://www.dsb.no/evakuering',
        '    retrieved_at: 2026-11-02T10:00:00Z',
        '---',
        '# Krisevern Modul 2',
        '',
        'Evakueringsplan skal øves jevnlig[^dsb-evakuering].',
        '',
        '[^dsb-evakuering]: DSB Evakueringsveileder',
        '',
      ].join('\n'),
      'utf-8'
    );
    fs.writeFileSync(
      path.join(s2Stage1Out, 'thinking_trace.md'),
      [
        '# Stage 1 Thinking & Search Trace (`krisevern-modul-2`)',
        '',
        '## Executed Google Search Queries',
        '- `dsb evakueringsplan kontorhus`',
        '- `kriseøvelse kontorhus krav`',
        '',
        '## Model Thinking & Reasoning Process',
        'Checked DSB guidance.',
      ].join('\n'),
      'utf-8'
    );
    fs.writeFileSync(
      path.join(s2Stage2Out, 'script_draft.json'),
      JSON.stringify(
        {
          title: 'Krisevern Modul 2 — Kurs',
          targetAudience: 'Ansatte i kontorhus',
          estimatedDuration: '10 min',
          scriptBody: 'Dette er hovedmanuset for modul 2.',
          highlights: ['Kjenn rømningsveiene', 'Tell barna på møteplass'],
          checklistGroups: [{ category: 'Evakuering', items: ['Tell alle barna på møteplass'] }],
        },
        null,
        2
      ),
      'utf-8'
    );
    fs.writeFileSync(
      path.join(s2RunDir, 'meta.json'),
      JSON.stringify(
        {
          runId: s2RunId,
          topic: 'Krisevern Modul 2',
          model: GEMINI_4_ARGON_MODEL,
          status: 'completed',
          stage1Telemetry: {
            thinkingLevel: 'HIGH',
            thoughtSteps: 2,
            searchQueries: [], // empty in meta.json to test fallback parsing from `- \`...\`` bullets in thinking_trace.md
          },
        },
        null,
        2
      ),
      'utf-8'
    );

    // Re-generate A2UI surface from a Stage-1-only run while a completed Stage 1+2 sibling run exists
    const s1UnverifiedRunId = 'krisevern-modul-3-1775500000200';
    const s1UnverifiedDir = path.join(tmpStage1ReviewDir, 'runs', s1UnverifiedRunId);
    const s1UnverifiedOut = path.join(s1UnverifiedDir, 'stages', '01_research', 'output');
    fs.mkdirSync(s1UnverifiedOut, { recursive: true });
    fs.writeFileSync(path.join(s1UnverifiedOut, 'research_summary.md'), s1InitialMd, 'utf-8');
    fs.writeFileSync(
      path.join(s1BundleResearchDir, 'krisevern-modul-3.md'),
      s1InitialMd,
      'utf-8'
    );
    fs.writeFileSync(
      path.join(s1UnverifiedDir, 'meta.json'),
      JSON.stringify(
        {
          runId: s1UnverifiedRunId,
          topic: 'Krisevern Modul 3',
          model: GEMINI_4_ARGON_MODEL,
          status: 'stage1_completed',
          okf: { bundleConceptId: 'research/krisevern-modul-3' },
        },
        null,
        2
      ),
      'utf-8'
    );

    const multiRunRes = generateA2uiSurface({
      workspaceRoot: tmpStage1ReviewDir,
      runId: s1UnverifiedRunId,
    });
    const s2SiblingHtml = fs.readFileSync(path.join(s2RunDir, 'a2ui.html'), 'utf-8');
    const s2SiblingMatch = s2SiblingHtml.match(
      /window\.A2UI_SURFACE_PAYLOAD\s*=\s*(\{[\s\S]*?\});\s*<\/script>/
    );
    const s2SiblingPayload = s2SiblingMatch ? JSON.parse(s2SiblingMatch[1]) : {};
    const s2SiblingComps =
      s2SiblingPayload.messages?.find((m: any) => 'updateComponents' in m)?.updateComponents
        ?.components || [];
    const s2SiblingTabsComp = s2SiblingComps.find((c: any) => c.id === 'main_tabs');
    const s2SiblingOverviewCol = s2SiblingComps.find((c: any) => c.id === 'overview_narration_col');
    const s2SiblingBundleEntry = (s2SiblingPayload.bundleRuns || []).find(
      (r: any) => r.runId === s2RunId
    );
    assert(
      multiRunRes.isStage1Only === true &&
        multiRunRes.tabCount === 3 &&
        multiRunRes.checklistItemCount === 0 &&
        s2SiblingTabsComp?.tabs?.[0]?.child === 'tab_overview' &&
        s2SiblingTabsComp?.tabs?.[1]?.child === 'tab_checklist' &&
        Array.isArray(s2SiblingOverviewCol?.children) &&
        s2SiblingOverviewCol.children.includes('overview_tts_player') &&
        s2SiblingBundleEntry?.dataModel?.okf?.stage1Trace?.searchQueries?.length === 2 &&
        s2SiblingBundleEntry?.dataModel?.stage2?.overviewHeading?.includes('Stage 2'),
      `generateA2uiSurface keeps Stage-1-only runs at 3 epistemic tabs while preserving Stage 2 overview/checklist tabs, TTS, and heading on completed sibling runs`
    );

    // Verify one-off manual edit to research_summary.md before verifyOkfConcept does NOT resurrect rejected source from bundle draft
    const manuallyEditedMd = curateOkfSources(s1InitialMd, {
      rejectSourceIds: ['svak-blogg-kilde'],
    }).markdown.replace(
      'Uverifisert påstand om at kriseøvelse kun trengs hvert tredje år.',
      ''
    );
    fs.writeFileSync(path.join(s1UnverifiedOut, 'research_summary.md'), manuallyEditedMd, 'utf-8');
    const verifyAfterManualEdit = verifyOkfConcept(s1UnverifiedRunId, {
      workspaceRoot: tmpStage1ReviewDir,
      by: 'human:fagansvarlig',
      rejectSourceIds: ['svak-blogg-kilde'],
    });
    const bundleAfterManualEdit = fs.readFileSync(
      path.join(s1BundleResearchDir, 'krisevern-modul-3.md'),
      'utf-8'
    );
    assert(
      verifyAfterManualEdit.rejectedIds.includes('svak-blogg-kilde') &&
        !bundleAfterManualEdit.includes('svak-blogg-kilde'),
      `verifyOkfConcept overwrites bundle draft without resurrecting sources that were manually edited out of research_summary.md before cli:verify`
    );

    // Verify named verifier replaces default placeholder (`human:fagansvarlig`), deduplicates same-day Verification log entry, and populates `/okf/verifierActor`
    const verifyNamedActor = verifyOkfConcept(s1UnverifiedRunId, {
      workspaceRoot: tmpStage1ReviewDir,
      by: 'Ana Lindqvist',
    });
    const logAfterTwoVerifies = fs.readFileSync(
      path.join(tmpStage1ReviewDir, 'bundle', 'log.md'),
      'utf-8'
    );
    const mod3VerifyLines = logAfterTwoVerifies
      .split(/\r?\n/)
      .filter((l) => l.includes('* **Verification**:') && l.includes('/research/krisevern-modul-3.md'));
    const s1UpdatedHtml = fs.readFileSync(path.join(s1UnverifiedDir, 'a2ui.html'), 'utf-8');
    assert(
      verifyNamedActor.verified.length === 1 &&
        verifyNamedActor.verified[0].by === 'human:Ana-Lindqvist' &&
        mod3VerifyLines.length === 1 &&
        s1UpdatedHtml.includes('okf-verifier-actor-input') &&
        s1UpdatedHtml.includes('human:Ana-Lindqvist') &&
        s1UpdatedHtml.includes('uten å kjøre Stage 2 på nytt'),
      `verifyOkfConcept replaces default placeholder with named human verifier, deduplicates same-day Verification log bullets, and embeds verifier input + stage-aware curation prompt in a2ui.html`
    );

    // Verify curateOkfSources snaps spaces after bold (`**word** [^id]`) and before colons (`[^id] :`) when stripping rejected footnotes
    const boldColonMd = [
      '---',
      'type: Research Concept',
      'title: Bold & Colon Test',
      'status: draft',
      'sources:',
      '  - id: keep-a',
      '    title: Keep A',
      '    resource: https://example.com/a',
      '  - id: rej-b',
      '    title: Reject B',
      '    resource: https://example.com/b',
      '---',
      'Kontorbygg i **risikoklasse 3**[^rej-b] [^keep-a] må oppfylle følgende krav[^keep-a] [^rej-b]:',
      '',
      '[^keep-a]: Keep A',
      '[^rej-b]: Reject B',
      '',
    ].join('\n');
    const curatedBoldColon = curateOkfSources(boldColonMd, {
      rejectSourceIds: ['rej-b'],
    });
    assert(
      curatedBoldColon.markdown.includes('**risikoklasse 3**[^keep-a] må oppfylle følgende krav[^keep-a]:') &&
        !curatedBoldColon.markdown.includes('**risikoklasse 3** [^keep-a]') &&
        !curatedBoldColon.markdown.includes('[^keep-a] :'),
      `curateOkfSources snaps spaces after bold markers and before colons when stripping adjacent rejected footnotes`
    );

    // Verify comma/semicolon-separated footnote brackets (`[^id1, ^id2]` and `[^id1,[^id2] 4]`) expand to `[^id1][^id2]` and syncA2uiToArtifactDir mirrors artifacts
    const multiFnDoc = parseOkfDocument(
      [
        '---',
        'type: Research Concept',
        'title: Multi Footnote Test',
        'status: draft',
        'sources:',
        '  - id: dibk-tek17-11-1',
        '    title: TEK17 § 11-1',
        '    resource: https://example.com/11-1',
        '  - id: dibk-tek17-11-2',
        '    title: TEK17 § 11-2',
        '    resource: https://example.com/11-2',
        '  - id: dibk-tek17-11-4',
        '    title: TEK17 § 11-4',
        '    resource: https://example.com/11-4',
        '---',
        'Krav til konstruksjon og bæreevne[^dibk-tek17-11-1, ^dibk-tek17-11-2] samt krisemotstand[^dibk-tek17-11-1,[^dibk-tek17-11-1] 4] gjelder for kontorbygg.',
        '',
      ].join('\n')
    );
    const multiFnHealed = healOrphanOkfFootnotes(multiFnDoc);
    assert(
      multiFnHealed &&
        multiFnDoc.body.includes('bæreevne[^dibk-tek17-11-1] [^dibk-tek17-11-2]') &&
        multiFnDoc.body.includes('krisemotstand[^dibk-tek17-11-1] [^dibk-tek17-11-4]'),
      `healOrphanOkfFootnotes expands comma-separated [^id1, ^id2] and woven [^id1,[^id1] 4] into separate [^id1] [^id2] footnotes`
    );

    const tmpArtifactDir = path.join(tmpStage1ReviewDir, 'agy_brain_artifacts');
    const syncedArtifacts = generateA2uiSurface(s1UnverifiedRunId, {
      workspaceRoot: tmpStage1ReviewDir,
      artifactDir: tmpArtifactDir,
      enablePingPong: true,
    });
    const htmlWithPingPong = fs.readFileSync(syncedArtifacts.htmlOutputPath, 'utf-8');
    const surfaceWithoutPingPong = generateA2uiSurface(s1UnverifiedRunId, {
      workspaceRoot: tmpStage1ReviewDir,
      enablePingPong: false,
    });
    const htmlWithoutPingPong = fs.readFileSync(surfaceWithoutPingPong.htmlOutputPath, 'utf-8');
    assert(
      Boolean(syncedArtifacts.artifactHtmlPath && fs.existsSync(syncedArtifacts.artifactHtmlPath)) &&
        fs.existsSync(`${syncedArtifacts.artifactHtmlPath}.metadata.json`) &&
        Boolean(syncedArtifacts.artifactVizPath && fs.existsSync(syncedArtifacts.artifactVizPath)) &&
        fs.existsSync(`${syncedArtifacts.artifactVizPath}.metadata.json`) &&
        /"canPingPong":\s*true/.test(htmlWithPingPong) &&
        htmlWithPingPong.includes('okf-pingpong-agy-btn') &&
        /"canPingPong":\s*false/.test(htmlWithoutPingPong),
      `generateA2uiSurface with artifactDir copies a2ui_studio.html + okf_viz_studio.html, writes .metadata.json descriptors, and gates canPingPong on Antigravity 2.0 /browser capability`
    );

    const emptyHomeDir = path.join(tmpStage1ReviewDir, 'empty_home');
    fs.mkdirSync(emptyHomeDir, { recursive: true });
    const mockAgyHomeDir = path.join(tmpStage1ReviewDir, 'mock_agy_home');
    fs.mkdirSync(path.join(mockAgyHomeDir, '.gemini', 'antigravity', 'brain'), { recursive: true });
    fs.mkdirSync(path.join(mockAgyHomeDir, '.gemini', 'antigravity', 'browser_recordings'), {
      recursive: true,
    });
    assert(
      hasAntigravityBrowserCapability({ homeDir: emptyHomeDir }) === false &&
        hasAntigravityBrowserCapability({ homeDir: mockAgyHomeDir }) === true,
      `hasAntigravityBrowserCapability returns true only when Antigravity 2.0 and /browser capabilities are installed`
    );

    // Verify run-root mirror of `a2ui_surface.json` and `a2ui_surface.jsonl` alongside `a2ui.html`
    assert(
      fs.existsSync(path.join(s1UnverifiedDir, 'a2ui_surface.json')) &&
        fs.existsSync(path.join(s1UnverifiedDir, 'a2ui_surface.jsonl')) &&
        fs.existsSync(syncedArtifacts.surfaceJsonPath),
      `generateA2uiSurface writes a2ui_surface.json and a2ui_surface.jsonl at both stages/<stage>/output/ and workspace/runs/<runId>/`
    );

    // Verify domain-neutral `inspectSourceDomainProvenance` & `inspectClientSourceDomainProvenance` across Norwegian, US, and umbrella domains
    const provMirrorPdf = inspectSourceDomainProvenance({
      id: 'kontorhusloven-lovdata',
      title: 'Lov om kontorbygg (kontorhusloven) – Lovdata',
      resource: 'https://mirror.kontorhus.no/Getfile.aspx/123/Lov_om_kontorbygg.pdf',
    });
    const provS3Bucket = inspectSourceDomainProvenance({
      id: 'forskrift-kriseforebygging',
      title: 'Forskrift om kriseforebygging – Lovdata',
      resource: 'https://secure.mirror.org/s3assets-public/show/67781',
    });
    const provScribdSec = inspectSourceDomainProvenance({
      id: 'form-10k-sec',
      title: 'Annual Form 10-K – SEC',
      resource: 'https://www.scribd.com/document/999/form-10k.pdf',
    });
    const provRealLovdata = inspectSourceDomainProvenance({
      id: 'lovdata-krise',
      title: 'Forskrift om kriseforebygging – Lovdata',
      resource: 'https://lovdata.no/dokument/SF/forskrift/2015-12-17-1710',
    });
    const provDsbAcronym = inspectSourceDomainProvenance({
      id: 'dsb-veiledning',
      title: 'Veiledning om krisevern – Direktoratet for samfunnssikkerhet og beredskap (DSB)',
      resource: 'https://www.dsb.no/lover/krisevern/',
    });
    const provUdirAbbrev = inspectSourceDomainProvenance({
      id: 'udir-beredskap',
      title: 'Beredskap i avdelingen – Utdanningsdirektoratet',
      resource: 'https://www.udir.no/sikkerhet-og-beredskap/',
    });
    const provRegjeringenUmbrella = inspectSourceDomainProvenance({
      id: 'kd-veileder',
      title: 'Sikkerhet i kontorbygg – Kunnskapsdepartementet',
      resource: 'https://www.regjeringen.no/no/dokumenter/id12345/',
    });
    const provRealSecGov = inspectSourceDomainProvenance({
      id: 'sec-10k',
      title: 'Form 10-K – U.S. Securities and Exchange Commission',
      resource: 'https://www.sec.gov/ix?doc=/Archives/edgar/data/10k.htm',
    });
    const provGenericSubtitle = inspectSourceDomainProvenance({
      id: 'krisevern-guide',
      title: 'Krisevern i avdelingen – Praktisk veiledning',
      resource: 'https://krisevernforeningen.no/kontorhus',
    });
    const provHostPrefixedTitle = inspectSourceDomainProvenance({
      id: 'dibk-no',
      title: 'dibk.no – Byggteknisk forskrift tek17',
      resource: 'https://dibk.no/regelverk/byggteknisk-forskrift-tek17/',
    });
    const provDibkSyllabic = inspectSourceDomainProvenance({
      id: 'dibk-tek17-11-2',
      title: 'Byggteknisk forskrift (TEK17) § 11-2 Risikoklasser - Direktoratet for byggkvalitet',
      resource: 'https://www.dibk.no/regelverk/byggteknisk-forskrift-tek17/11/i/11-2',
    });
    const provDigdirCompound = inspectSourceDomainProvenance({
      id: 'digdir-veileder',
      title: 'Innebygd personvern - Digitaliseringsdirektoratet',
      resource: 'https://www.digdir.no/informasjonssikkerhet/innebygd-personvern/123',
    });
    const clientProvMirror = s1Hooks.inspectClientSourceDomainProvenance({
      id: 'kontorhusloven-lovdata',
      title: 'Lov om kontorbygg (kontorhusloven) – Lovdata (via mirror.kontorhus.no)',
      url: 'https://mirror.kontorhus.no/Getfile.aspx/123/Lov_om_kontorbygg.pdf',
    });
    const clientProvUdir = s1Hooks.inspectClientSourceDomainProvenance({
      id: 'udir-beredskap',
      title: 'Beredskap i avdelingen – Utdanningsdirektoratet',
      url: 'https://www.udir.no/sikkerhet-og-beredskap/',
    });
    const clientProvDibk = s1Hooks.inspectClientSourceDomainProvenance({
      id: 'dibk-tek17-11-2',
      title: 'Byggteknisk forskrift (TEK17) § 11-2 Risikoklasser - Direktoratet for byggkvalitet',
      url: 'https://www.dibk.no/regelverk/byggteknisk-forskrift-tek17/11/i/11-2',
    });
    const provPubFirstDsb = inspectSourceDomainProvenance({
      id: 'dsb-rodsprit',
      title: 'Direktoratet for samfunnssikkerhet og beredskap (DSB) / Sikker hverdag – Unngå ulykker med rødsprit',
      resource: 'https://www.dsb.no/sikkerhverdag/gass-og-krisefarlig-vaske/unnga-ulykker-med-rodsprit/',
    });
    const provPubFirstDibkNoAcronym = inspectSourceDomainProvenance({
      id: 'tek17-11-2',
      title: 'Direktoratet for byggkvalitet – Risikoklasser i TEK17',
      resource: 'https://www.dibk.no/regelverk/byggteknisk-forskrift-tek17/11/i/11-2',
    });
    const provPubFirstTwoWordOrg = inspectSourceDomainProvenance({
      id: 'lading-krisefare',
      title: 'Norsk krisevernforening – Lading av batterier',
      resource: 'https://krisevernforeningen.no/krisesikkerhet/lading/',
    });
    const provAdvSubdomainMirrorNoIdSlug = inspectSourceDomainProvenance({
      id: 'kontorhusloven',
      title: 'Lov om kontorbygg – Lovdata',
      resource: 'https://mirror.kontorhus.no/Getfile.aspx/123/Lov_om_kontorbygg.pdf',
    });
    const provAdvRootMirrorSinglePub = inspectSourceDomainProvenance({
      id: 'kontorhusloven',
      title: 'Norske kontorbygg – Lovdata',
      resource: 'https://www.kontorhus.no/dokumenter/kontorhusloven.pdf',
    });
    const provAdvPrepositionMirror = inspectSourceDomainProvenance({
      id: 'strategi-dok',
      title: 'Strategi om kontorbygg – U.S. Department of Education',
      resource: 'https://www.kontorhus.no/dokumenter/strategi.pdf',
    });
    const clientProvPubFirstDsb = s1Hooks.inspectClientSourceDomainProvenance({
      id: 'dsb-rodsprit',
      title: 'Direktoratet for samfunnssikkerhet og beredskap (DSB) / Sikker hverdag – Unngå ulykker med rødsprit',
      url: 'https://www.dsb.no/sikkerhverdag/gass-og-krisefarlig-vaske/unnga-ulykker-med-rodsprit/',
    });
    const clientProvAdvSubdomainMirror = s1Hooks.inspectClientSourceDomainProvenance({
      id: 'kontorhusloven',
      title: 'Lov om kontorbygg – Lovdata',
      url: 'https://mirror.kontorhus.no/Getfile.aspx/123/Lov_om_kontorbygg.pdf',
    });
    const clientProvAdvRootMirrorSinglePub = s1Hooks.inspectClientSourceDomainProvenance({
      id: 'kontorhusloven',
      title: 'Norske kontorbygg – Lovdata',
      url: 'https://www.kontorhus.no/dokumenter/kontorhusloven.pdf',
    });
    const provIntlArticleOrg = inspectSourceDomainProvenance({
      id: 'climate-emissions',
      title: 'The Guardian – Global methane emissions hit record high',
      resource: 'https://www.theguardian.com/environment/methane-emissions',
    });
    const provIntlDutchInitialism = inspectSourceDomainProvenance({
      id: 'financial-stability',
      title: 'De Nederlandsche Bank – Financial Stability in Autumn',
      resource: 'https://www.dnb.nl/en/publications/financial-stability/',
    });
    const provIntlUkSecondLevel = inspectSourceDomainProvenance({
      id: 'lunar-basalt',
      title: 'Royal Astronomical Society – Lunar Basalt Isotopes',
      resource: 'https://ras.ac.uk/news-and-press/lunar-basalt',
    });
    const provIntlJpCcTld = inspectSourceDomainProvenance({
      id: 'hayabusa2-sample',
      title: 'Ryugu Asteroid Sample Curation – Japan Aerospace Exploration Agency (JAXA)',
      resource: 'https://www.jaxa.jp/projects/sas/hayabusa2/index_e.html',
    });
    const provAdvStatuteActMirror = inspectSourceDomainProvenance({
      id: 'commercial-act',
      title: 'Spaceflight Act – Federal Aviation Administration',
      resource: 'https://www.spaceflight.com/uploads/commercial-spaceflight-act.pdf',
    });
    const clientProvIntlArticleOrg = s1Hooks.inspectClientSourceDomainProvenance({
      id: 'climate-emissions',
      title: 'The Guardian – Global methane emissions hit record high',
      url: 'https://www.theguardian.com/environment/methane-emissions',
    });
    const clientProvAdvStatuteActMirror = s1Hooks.inspectClientSourceDomainProvenance({
      id: 'commercial-act',
      title: 'Spaceflight Act – Federal Aviation Administration',
      url: 'https://www.spaceflight.com/uploads/commercial-spaceflight-act.pdf',
    });
    const provMultiSepEnDashHyphen = inspectSourceDomainProvenance({
      id: 'starship-catch-analysis',
      title: 'Starship Flight 5 – Booster Catch Telemetry - SpaceX',
      resource: 'https://www.aerospaceblog.org/posts/starship-flight-5/',
    });
    const provMultiSepDoubleHyphen = inspectSourceDomainProvenance({
      id: 'aktuelt-krisevern',
      title: 'Krisevern i avdelingen - dette bør ansatte vite - Norsk krisevernforening',
      resource: 'https://www.abckrisevern.no/aktuelt-krisevern-i-avdelingen/',
    });
    const provMultiSepHyphenatedOrgTrueHost = inspectSourceDomainProvenance({
      id: 'rolls-royce-ultrafan',
      title: 'UltraFan Engine Architecture | Testbed 80 - Rolls-Royce',
      resource: 'https://www.rolls-royce.com/innovation/ultrafan.aspx',
    });
    const clientProvMultiSepEnDashHyphen = s1Hooks.inspectClientSourceDomainProvenance({
      id: 'starship-catch-analysis',
      title: 'Starship Flight 5 – Booster Catch Telemetry - SpaceX',
      url: 'https://www.aerospaceblog.org/posts/starship-flight-5/',
    });
    const clientProvMultiSepDoubleHyphen = s1Hooks.inspectClientSourceDomainProvenance({
      id: 'aktuelt-krisevern',
      title: 'Krisevern i avdelingen – dette bør ansatte vite - Norsk krisevernforening',
      url: 'https://www.abckrisevern.no/aktuelt-krisevern-i-avdelingen/',
    });
    assert(
      provMirrorPdf.domainMismatch === true &&
        provMirrorPdf.hostname === 'mirror.kontorhus.no' &&
        provMirrorPdf.isDirectFileAsset === true &&
        provMirrorPdf.claimedPublisher === 'Lovdata' &&
        provS3Bucket.domainMismatch === true &&
        provS3Bucket.hostname === 'secure.mirror.org' &&
        provScribdSec.domainMismatch === true &&
        provRealLovdata.domainMismatch === false &&
        provDsbAcronym.domainMismatch === false &&
        provUdirAbbrev.domainMismatch === false &&
        provRegjeringenUmbrella.domainMismatch === false &&
        provRealSecGov.domainMismatch === false &&
        provGenericSubtitle.domainMismatch === false &&
        provHostPrefixedTitle.domainMismatch === false &&
        provDibkSyllabic.domainMismatch === false &&
        provDigdirCompound.domainMismatch === false &&
        provPubFirstDsb.domainMismatch === false &&
        provPubFirstDibkNoAcronym.domainMismatch === false &&
        provPubFirstTwoWordOrg.domainMismatch === false &&
        provIntlArticleOrg.domainMismatch === false &&
        provIntlDutchInitialism.domainMismatch === false &&
        provIntlUkSecondLevel.domainMismatch === false &&
        provIntlJpCcTld.domainMismatch === false &&
        provAdvSubdomainMirrorNoIdSlug.domainMismatch === true &&
        provAdvSubdomainMirrorNoIdSlug.claimedPublisher === 'Lovdata' &&
        provAdvRootMirrorSinglePub.domainMismatch === true &&
        provAdvRootMirrorSinglePub.claimedPublisher === 'Lovdata' &&
        provAdvPrepositionMirror.domainMismatch === true &&
        provAdvPrepositionMirror.claimedPublisher === 'U.S. Department of Education' &&
        provAdvStatuteActMirror.domainMismatch === true &&
        provAdvStatuteActMirror.claimedPublisher === 'Federal Aviation Administration' &&
        provMultiSepEnDashHyphen.domainMismatch === true &&
        provMultiSepEnDashHyphen.claimedPublisher === 'SpaceX' &&
        provMultiSepDoubleHyphen.domainMismatch === true &&
        provMultiSepDoubleHyphen.claimedPublisher === 'Norsk krisevernforening' &&
        provMultiSepHyphenatedOrgTrueHost.domainMismatch === false &&
        provMultiSepHyphenatedOrgTrueHost.claimedPublisher === 'Rolls-Royce' &&
        clientProvMirror.domainMismatch === true &&
        clientProvMirror.claimedPublisher === 'Lovdata' &&
        clientProvUdir.domainMismatch === false &&
        clientProvDibk.domainMismatch === false &&
        clientProvPubFirstDsb.domainMismatch === false &&
        clientProvIntlArticleOrg.domainMismatch === false &&
        clientProvAdvSubdomainMirror.domainMismatch === true &&
        clientProvAdvSubdomainMirror.claimedPublisher === 'Lovdata' &&
        clientProvAdvRootMirrorSinglePub.domainMismatch === true &&
        clientProvAdvRootMirrorSinglePub.claimedPublisher === 'Lovdata' &&
        clientProvAdvStatuteActMirror.domainMismatch === true &&
        clientProvAdvStatuteActMirror.claimedPublisher === 'Federal Aviation Administration' &&
        clientProvMultiSepEnDashHyphen.domainMismatch === true &&
        clientProvMultiSepEnDashHyphen.claimedPublisher === 'SpaceX' &&
        clientProvMultiSepDoubleHyphen.domainMismatch === true &&
        clientProvMultiSepDoubleHyphen.claimedPublisher === 'Norsk krisevernforening',
      `inspectSourceDomainProvenance and inspectClientSourceDomainProvenance flag third-party mirrors masquerading as authorities while allowing true domains, acronyms, compound abbreviations, syllabic initialisms, Publisher-First titles, multi-separator titles, and umbrella portals`
    );

    // Verify server/client parity when formal regulation ID precedes parenthetical publisher (e.g., "Title — FOR-1996-12-06-1127 (Lovdata Open Data)") or stands alone
    const openDataIdParenSource = {
      id: 'lovdata-internkontrollforskriften',
      title: 'Internkontrollforskriften — FOR-1996-12-06-1127 (Lovdata Open Data)',
      resource: 'https://api.lovdata.no/v1/publicData/get/gjeldende-sentrale-forskrifter.tar.bz2#sf/sf-19961206-1127.xml',
    };
    const bareDocIdSuffixSource = {
      id: 'lovdata-internkontrollforskriften',
      title: 'Internkontrollforskriften — FOR-1996-12-06-1127',
      resource: 'https://api.lovdata.no/v1/publicData/get/gjeldende-sentrale-forskrifter.tar.bz2#sf/sf-19961206-1127.xml',
    };
    const serverOpenDataIdParen = inspectSourceDomainProvenance(openDataIdParenSource);
    const clientOpenDataIdParen = s1Hooks.inspectClientSourceDomainProvenance(openDataIdParenSource);
    const serverBareDocIdSuffix = inspectSourceDomainProvenance(bareDocIdSuffixSource);
    const clientBareDocIdSuffix = s1Hooks.inspectClientSourceDomainProvenance(bareDocIdSuffixSource);
    assert(
      serverOpenDataIdParen.domainMismatch === false &&
        clientOpenDataIdParen.domainMismatch === false &&
        serverBareDocIdSuffix.domainMismatch === false &&
        clientBareDocIdSuffix.domainMismatch === false,
      `inspectSourceDomainProvenance and inspectClientSourceDomainProvenance agree (domainMismatch=false) on formal document IDs with or without parenthetical Open Data publisher`
    );

    // Verify `cleanGroundingLinks()` annotates `(via <hostname>)` on masquerading mirror titles
    const cleanedMasquerade = await cleanGroundingLinks(
      [
        '---',
        'type: Research Concept',
        'title: Provenance Test',
        'sources:',
        '  - id: kontorhusloven-lovdata',
        '    resource: https://mirror.kontorhus.no/Getfile.aspx/Lov_om_kontorbygg.pdf',
        '    title: Lov om kontorbygg (kontorhusloven) – Lovdata',
        '---',
        'Avdelingen skal ha internkontroll[^kontorhusloven-lovdata].',
        '',
        '[^kontorhusloven-lovdata]: Lov om kontorbygg (kontorhusloven) – Lovdata',
      ].join('\n'),
      []
    );
    assert(
      cleanedMasquerade.includes('(via mirror.kontorhus.no)'),
      `cleanGroundingLinks appends (via <hostname>) when a source title claims a publisher that does not match its resolved host`
    );

    // Verify zero-token `--replace-source` (`replaceSourceMap`) re-anchoring to both existing IDs and newly added URLs
    const replaceInputMd = [
      '---',
      'type: Research Concept',
      'title: Re-Anchor Test',
      'status: draft',
      'sources:',
      '  - id: dsb-veiledning',
      '    title: Veiledning til forskrift om kriseforebygging – DSB',
      '    resource: https://www.dsb.no/lover/kriseforebygging/',
      '  - id: mirror-forskrift',
      '    title: Forskrift om kriseforebygging – Lovdata (via secure.mirror.org)',
      '    resource: https://secure.mirror.org/s3assets-public/show/67781',
      '  - id: mirror-kontorhusloven',
      '    title: Lov om kontorbygg – Lovdata (via mirror.kontorhus.no)',
      '    resource: https://mirror.kontorhus.no/Getfile.aspx/Lov.pdf',
      '---',
      'Innledning med generell kontekst.',
      '',
      'Krisesikkerhet krever systematisk kartlegging[^mirror-forskrift].',
      'Samme krav følger av veiledningen[^dsb-veiledning] [^mirror-forskrift].',
      'Leder har ansvar for internkontroll etter § 9[^mirror-kontorhusloven].',
      '',
      '[^dsb-veiledning]: Veiledning til forskrift om kriseforebygging – DSB',
      '[^mirror-forskrift]: Forskrift om kriseforebygging – Lovdata (via secure.mirror.org)',
      '[^mirror-kontorhusloven]: Lov om kontorbygg – Lovdata (via mirror.kontorhus.no)',
      '',
    ].join('\n');
    const replacedCurated = curateOkfSources(replaceInputMd, {
      rejectSourceIds: ['mirror-forskrift', 'mirror-kontorhusloven'],
      replaceSourceMap: {
        'mirror-forskrift': 'dsb-veiledning',
        'mirror-kontorhusloven': 'https://lovdata.no/dokument/NL/lov/2005-06-17-64',
      },
      addSources: [
        {
          url: 'https://lovdata.no/dokument/NL/lov/2005-06-17-64',
          title: 'Lov om kontorbygg (kontorhusloven) – Lovdata',
        },
      ],
    });
    const newKontorhusSlug = replacedCurated.replacedMap['mirror-kontorhusloven'];
    assert(
      replacedCurated.orphanClaimLines.length === 0 &&
        replacedCurated.replacedMap['mirror-forskrift'] === 'dsb-veiledning' &&
        Boolean(newKontorhusSlug) &&
        replacedCurated.markdown.includes('kartlegging[^dsb-veiledning].') &&
        replacedCurated.markdown.includes('veiledningen[^dsb-veiledning].') &&
        !replacedCurated.markdown.includes('[^dsb-veiledning] [^dsb-veiledning]') &&
        replacedCurated.markdown.includes(`§ 9[^${newKontorhusSlug}].`) &&
        replacedCurated.markdown.includes('\nInnledning med generell kontekst.\n') &&
        !replacedCurated.markdown.includes('mirror-forskrift') &&
        !replacedCurated.markdown.includes('mirror-kontorhusloven'),
      `curateOkfSources replaceSourceMap re-anchors citations to existing IDs and newly added URLs with 0 orphan claims, deduplicated footnotes, and no dummy first-paragraph weave`
    );

    // Verify standalone `replaceSourceMap` URL replacement WITHOUT `addSources` or `rejectSourceIds`
    const standaloneUrlReplaced = curateOkfSources(replaceInputMd, {
      replaceSourceMap: {
        'mirror-forskrift': 'dsb-veiledning',
        'mirror-kontorhusloven':
          'https://www.dibk.no/regelverk/byggteknisk-forskrift-tek17/11/iv/11-12|Byggteknisk forskrift (TEK17) § 11-12 – DiBK',
      },
    });
    const standaloneNewSlug = standaloneUrlReplaced.replacedMap['mirror-kontorhusloven'];
    assert(
      standaloneUrlReplaced.orphanClaimLines.length === 0 &&
        standaloneUrlReplaced.addedSources.length === 1 &&
        Boolean(standaloneNewSlug) &&
        standaloneUrlReplaced.addedSources[0].resource ===
          'https://www.dibk.no/regelverk/byggteknisk-forskrift-tek17/11/iv/11-12' &&
        standaloneUrlReplaced.markdown.includes(`§ 9[^${standaloneNewSlug}].`) &&
        !standaloneUrlReplaced.markdown.includes('mirror-kontorhusloven') &&
        !standaloneUrlReplaced.markdown.includes('mirror-forskrift'),
      `curateOkfSources auto-registers standalone https:// replacement URLs in replaceSourceMap without requiring a separate addSources call`
    );

    // Verify Studio `setReplaceSourceInStudio` + `toggleReplacePanelInStudio` (direct swap without clicking Reject first) + `buildCurationPrompts`
    s1Hooks.setReplaceSourceInStudio(s1SimSurface, 'svak-blogg-kilde', 'https://lovdata.no/dokument/SF/forskrift/2015-12-17-1710');
    const replPrompts = s1Hooks.buildCurationPrompts(s1SimSurface);
    s1Hooks.setReplaceSourceInStudio(
      s1SimSurface,
      'svak-blogg-kilde',
      'www.dibk.no/regelverk/byggteknisk-forskrift-tek17/11/iv/11-12'
    );
    const bareHostPrompts = s1Hooks.buildCurationPrompts(s1SimSurface);

    // Direct swap on an active (non-rejected) source via `🔀 Erstatt kilde`
    const openState1 = s1Hooks.toggleReplacePanelInStudio(s1SimSurface, 'dsb-veiledning');
    s1Hooks.setReplaceSourceInStudio(
      s1SimSurface,
      'dsb-veiledning',
      'https://lovdata.no/dokument/NL/lov/2002-06-14-20'
    );
    const directSwapPrompts = s1Hooks.buildCurationPrompts(s1SimSurface);
    const undoOpenState = s1Hooks.toggleReplacePanelInStudio(s1SimSurface, 'dsb-veiledning');
    const afterUndoSwapPrompts = s1Hooks.buildCurationPrompts(s1SimSurface);

    const formattedBoldList = s1Hooks.formatInlineLatexAndFootnotes(
      '1. **Tellingsansvarlig**: teller barn.\n2. ** gjennomsøkingsansvarlig (søkeleder)**: sjekker toaletter.',
      [],
      []
    );
    const s1HtmlRendered = fs.readFileSync(multiRunRes.htmlOutputPath, 'utf-8');
    assert(
      replPrompts.cliText.includes('--replace-source svak-blogg-kilde=https://lovdata.no/dokument/SF/forskrift/2015-12-17-1710') &&
        replPrompts.agyText.includes('--replace-source') &&
        bareHostPrompts.cliText.includes(
          '--replace-source svak-blogg-kilde=https://www.dibk.no/regelverk/byggteknisk-forskrift-tek17/11/iv/11-12'
        ) &&
        openState1['dsb-veiledning'] === true &&
        directSwapPrompts.cliText.includes(
          '--replace-source dsb-veiledning=https://lovdata.no/dokument/NL/lov/2002-06-14-20'
        ) &&
        !directSwapPrompts.cliText.includes('dsb-veiledning,') &&
        !undoOpenState['dsb-veiledning'] &&
        !afterUndoSwapPrompts.cliText.includes('dsb-veiledning=') &&
        formattedBoldList.includes('2. **gjennomsøkingsansvarlig (søkeleder)**:') &&
        s1HtmlRendered.includes('okf-open-replace-btn') &&
        s1HtmlRendered.includes('okf-jump-sources-btn') &&
        s1HtmlRendered.includes('okf-replace-url-input') &&
        s1HtmlRendered.includes('okf-replace-url-btn') &&
        s1HtmlRendered.includes('color-scheme: light;') &&
        s1HtmlRendered.includes('color-scheme: dark;') &&
        /\.okf-add-source-box input\s*\{[^}]*background:\s*var\(--surface-input\);[^}]*color:\s*var\(--text\);/.test(
          s1HtmlRendered
        ),
      `toggleReplacePanelInStudio, setReplaceSourceInStudio, and buildCurationPrompts support 1-click direct source swap (without requiring Reject first), 1-step inline URLs, jump-to-sources button, BPE bold-space normalization, and explicit dark-webview input contrast`
    );

    // Verify zero-CDN / sandboxed Auxiliary Pane CSP Markdown rendering (`window.marked === undefined`)
    const cspOverviewRendered = s1Hooks.renderMarkdownBlock(
      '**Trygghet når sekundene teller:** I en kontorhus har vi omsorg for samfunnets aller yngste borgere fra 0 til 6 år.\n\n**Ansvarsdeling og systematisk HMS-arbeid:** Norsk lovverk skiller tydelig mellom byggeier og bruker.',
      []
    );
    const cspComplexRendered = s1Hooks.renderMarkdownBlock(
      '## 1. Hovedkrav\n\n1. **Krisevernleder**: utpekes av leder[^dsb-veiledning].\n2. **Rømningsvei**: holdes fri.\n\n| Krav | Hjemmel |\n| --- | --- |\n| **Risikoklasse 3** | `TEK17 § 11-2` |',
      [{ id: 'dsb-veiledning', title: 'DSB Veiledning', resource: 'https://www.dsb.no/' }]
    );
    const cspInlineRendered = s1Hooks.renderInlineMarkdown(
      '• **Ansvarsdeling (§§ 4–13):** Bruk `kriseperm` og se [Lovdata](https://lovdata.no).'
    );
    assert(
      cspOverviewRendered.includes('<p><strong>Trygghet når sekundene teller:</strong> I en kontorhus') &&
        cspOverviewRendered.includes('<p><strong>Ansvarsdeling og systematisk HMS-arbeid:</strong> Norsk lovverk') &&
        !cspOverviewRendered.includes('**Trygghet') &&
        cspComplexRendered.includes('<h2>1. Hovedkrav</h2>') &&
        cspComplexRendered.includes('<ol><li><strong>Krisevernleder</strong>:') &&
        cspComplexRendered.includes('data-fn="dsb-veiledning"') &&
        cspComplexRendered.includes('<table><thead><tr><th>Krav</th><th>Hjemmel</th></tr></thead>') &&
        cspComplexRendered.includes('<td><strong>Risikoklasse 3</strong></td><td><code>TEK17 § 11-2</code></td>') &&
        cspInlineRendered.includes('<strong>Ansvarsdeling (§§ 4–13):</strong>') &&
        cspInlineRendered.includes('<code>kriseperm</code>'),
      `renderMarkdownBlock and renderInlineMarkdown render bold lead-ins, paragraphs, headings, lists, GFM tables, inline code, and OKF footnotes cleanly when external CDN marked.js is blocked by CSP or offline`
    );

    // Verify primary `updateDataModel` (`dataModel.okf.verifierActor`) parity with `bundleRuns`
    const s1UpdatedSurfaceJson = JSON.parse(
      fs.readFileSync(path.join(s1UnverifiedDir, 'a2ui_surface.json'), 'utf-8')
    );
    const s1PrimaryDataModelMsg = (s1UpdatedSurfaceJson.messages || []).find(
      (m: any) => m && m.updateDataModel
    );
    assert(
      s1PrimaryDataModelMsg?.updateDataModel?.value?.okf?.verifierActor === 'human:Ana-Lindqvist',
      `generateA2uiSurface populates primary dataModel.okf.verifierActor directly in a2ui_surface.json`
    );

    // Verify IDF-weighted lexical line matching in `curateOkfSources` for standalone `--add-source`
    const lexicalWeaveInput = [
      '---',
      'type: Research Concept',
      'title: Krisevern i kontorhus',
      'status: draft',
      'sources:',
      '  - id: dsb-veiledning',
      '    title: Veiledning til forskrift om kriseforebygging – DSB',
      '    resource: https://www.dsb.no/lover/kriseforebygging/',
      '---',
      'Generell innledning om kontorhusbygg, rømningsveier og slokkeutstyr i kommunen[^dsb-veiledning].',
      '',
      '1. **Krise- og eksplosjonsvernloven**: Stiller krav til aktsomhet[^dsb-veiledning].',
      '2. **Internkontrollforskriften og arbeidsmiljøloven § 3-1**: Leder skal dokumentere HMS-arbeidet systematisk.',
      '',
      '[^dsb-veiledning]: Veiledning til forskrift om kriseforebygging – DSB',
      '',
    ].join('\n');
    const lexicalWeaved = curateOkfSources(lexicalWeaveInput, {
      addSources: [
        {
          url: 'https://lovdata.no/dokument/NL/lov/2005-06-17-62',
          title: 'Lov om arbeidsmiljø, arbeidstid og stillingsvern mv. (arbeidsmiljøloven)',
        },
      ],
    });
    const amlSlug = lexicalWeaved.addedSources[0]?.id;
    assert(
      Boolean(amlSlug) &&
        lexicalWeaved.markdown.includes(
          `arbeidsmiljøloven § 3-1**: Leder skal dokumentere HMS-arbeidet systematisk[^${amlSlug}].`
        ) &&
        !lexicalWeaved.markdown.includes(`kommunen[^dsb-veiledning][^${amlSlug}].`),
      `curateOkfSources weaves standalone added sources onto the lexically matching claim line rather than blindly attaching to paragraph 1`
    );

    // Verify `resolveSpeechVoice` across Norwegian BCP-47 / Android underscore tags (`nb-NO`, `no-NO`, `no_NO`, `nn-NO`), neural ranking, and missing-voice Web Remote fallback
    const mockVoicesWithAndroidNo = [
      { name: 'Google US English', lang: 'en-US', localService: false, default: true },
      { name: 'eSpeak nb', lang: 'nb', localService: true, default: false },
      { name: 'Google norsk', lang: 'no_NO', localService: false, default: false },
    ];
    const resolvedNoAndroid = s1Hooks.resolveSpeechVoice('nb-NO', mockVoicesWithAndroidNo);
    const mockEnglishOnlyVoices = [
      { name: 'Samantha', lang: 'en-US', localService: true, default: true },
      { name: 'Daniel', lang: 'en-GB', localService: true, default: false },
    ];
    const resolvedMissingNo = s1Hooks.resolveSpeechVoice('nb-NO', mockEnglishOnlyVoices);
    const resolvedEnMatch = s1Hooks.resolveSpeechVoice('en-US', mockEnglishOnlyVoices);
    assert(
      resolvedNoAndroid.matchedTargetLanguage === true &&
        resolvedNoAndroid.voice?.name === 'Google norsk' &&
        resolvedNoAndroid.effectiveLang === 'no-NO' &&
        resolvedMissingNo.matchedTargetLanguage === false &&
        resolvedMissingNo.voice === null &&
        resolvedMissingNo.effectiveLang === 'nb-NO' &&
        resolvedEnMatch.matchedTargetLanguage === true &&
        resolvedEnMatch.voice?.name === 'Samantha',
      `resolveSpeechVoice binds Norwegian voices across nb-NO/no-NO/no_NO, prefers neural/cloud over eSpeak, and reports matchedTargetLanguage=false without binding English voices when remote client lacks Norwegian TTS`
    );

    // Verify `startA2uiPingPongListener` GIF beacon mode (`format=gif`) + `Access-Control-Allow-Private-Network: true`
    let pingPongBoundPort = 0;
    const pingPongPromise = startA2uiPingPongListener({
      port: 0,
      force: true,
      workspaceRoot: tmpStage1ReviewDir,
      onListening: (p) => {
        pingPongBoundPort = p;
      },
    });
    for (let waitIdx = 0; waitIdx < 40 && pingPongBoundPort === 0; waitIdx++) {
      await new Promise((r) => setTimeout(r, 10));
    }
    const gifRes = await fetch(
      `http://127.0.0.1:${pingPongBoundPort}/ping-pong?payload=${encodeURIComponent(
        JSON.stringify({ runId: 'test-gif-run', verifierActor: 'human:tester' })
      )}&format=gif`
    );
    const gifBytes = Buffer.from(await gifRes.arrayBuffer());
    const pingPongOut = await pingPongPromise;
    assert(
      gifRes.status === 200 &&
        gifRes.headers.get('content-type') === 'image/gif' &&
        gifRes.headers.get('access-control-allow-private-network') === 'true' &&
        gifBytes.subarray(0, 6).toString('ascii') === 'GIF89a' &&
        pingPongOut.payload?.runId === 'test-gif-run',
      `startA2uiPingPongListener serves valid 1x1 GIF89a with Access-Control-Allow-Private-Network header on format=gif so img.onload/onerror accurately distinguishes local wakeup from Web Remote / CSP fallback`
    );

    // Verify A2UI v1.0 `callAgentFunction` (`verifyOkfSources`) -> `agentFunctionResponse` RPC round-trip on `startA2uiPingPongListener`
    let rpcPort = 0;
    const rpcPromise = startA2uiPingPongListener({
      port: 0,
      force: true,
      workspaceRoot: tmpStage1ReviewDir,
      onListening: (p) => {
        rpcPort = p;
      },
    });
    for (let waitIdx = 0; waitIdx < 40 && rpcPort === 0; waitIdx++) {
      await new Promise((r) => setTimeout(r, 10));
    }
    const rpcRes = await fetch(`http://127.0.0.1:${rpcPort}/ping-pong`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        version: '1.0',
        callAgentFunction: {
          surfaceId: 'icm_rpc_test',
          functionCallId: 'verify_rpc_1',
          callFunction: {
            '@call': 'verifyOkfSources',
            catalogId: A2UI_ICM_CATALOG_ID,
            args: {
              runId: 'test-rpc-run',
              verifierActor: 'human:fagansvarlig',
              rejectedSources: ['src-a'],
            },
          },
        },
      }),
    });
    const rpcAckJson = (await rpcRes.json()) as Record<string, any>;
    const rpcResolved = await rpcPromise;
    assert(
      rpcRes.status === 200 &&
        rpcAckJson.version === '1.0' &&
        rpcAckJson.agentFunctionResponse?.functionCallId === 'verify_rpc_1' &&
        rpcAckJson.agentFunctionResponse?.value?.ok === true &&
        rpcResolved.payload?.runId === 'test-rpc-run' &&
        rpcResolved.payload?.verifierActor === 'human:fagansvarlig' &&
        Array.isArray(rpcResolved.payload?.rejectedSources) &&
        rpcResolved.payload.rejectedSources[0] === 'src-a',
      `startA2uiPingPongListener unwraps A2UI v1.0 callAgentFunction(verifyOkfSources) envelopes and replies with a valid v1.0 agentFunctionResponse`
    );

    // Verify `closeActiveA2uiPingPongListener` auto-closes an idle Intermission Ping-Pong listener on CLI verification/Stage 2 and no-ops cleanly when unbound
    let autoClosePort = 0;
    const autoClosePromise = startA2uiPingPongListener({
      port: 0,
      force: true,
      workspaceRoot: tmpStage1ReviewDir,
      onListening: (p) => {
        autoClosePort = p;
      },
    });
    for (let waitIdx = 0; waitIdx < 40 && autoClosePort === 0; waitIdx++) {
      await new Promise((r) => setTimeout(r, 10));
    }
    const closedActive = await closeActiveA2uiPingPongListener({
      port: autoClosePort,
      reason: 'verified',
    });
    const autoCloseResolved = await autoClosePromise;
    const closedAfterExit = await closeActiveA2uiPingPongListener({
      port: autoClosePort,
      reason: 'stage2',
    });
    assert(
      closedActive === true &&
        autoCloseResolved.skipped === true &&
        autoCloseResolved.payload?.superseded === true &&
        autoCloseResolved.payload?.reason === 'verified' &&
        closedAfterExit === false,
      `closeActiveA2uiPingPongListener cleanly closes idle Intermission Ping-Pong listeners via POST /supersede?reason=verified and returns false when unbound`
    );

    // Verify 3-pillar `specification/UPSTREAM_LOCK.json` (`icm`, `okf`, `a2ui`) and zero-token `getIcmPipelineStatus` / `formatIcmPipelineStatus` (`npm run cli:status`)
    const lockRawJson = JSON.parse(
      fs.readFileSync(path.resolve(process.cwd(), 'specification', 'UPSTREAM_LOCK.json'), 'utf-8')
    );
    assert(
      lockRawJson?.icm?.repository === 'RinDig/Interpretable-Context-Methodology' &&
        typeof lockRawJson?.icm?.commit === 'string' &&
        lockRawJson.icm.commit.length === 40 &&
        lockRawJson?.icm?.paperUrl === 'https://arxiv.org/abs/2603.16021' &&
        lockRawJson?.okf?.repository === 'open-knowledge-format/open-knowledge-format' &&
        typeof lockRawJson?.okf?.commit === 'string' &&
        lockRawJson.okf.commit.length === 40 &&
        lockRawJson?.okf?.okfVersion === '0.3' &&
        lockRawJson?.a2ui?.repository === 'google/A2UI' &&
        lockRawJson?.a2ui?.protocolVersion === '1.0',
      `specification/UPSTREAM_LOCK.json pins all three open pillars (ICM, OKF v0.3, A2UI v1.0) with 40-char commit SHAs`
    );

    const tmpVerifyArtifactDir = fs.mkdtempSync(path.join(os.tmpdir(), 'icm-verify-artifacts-'));
    const prevAgyArtifactDir = process.env.AGY_ARTIFACT_DIR;
    let firstSignOff: ReturnType<typeof verifyOkfConcept>;
    let secondSignOff: ReturnType<typeof verifyOkfConcept>;
    try {
      process.env.AGY_ARTIFACT_DIR = tmpVerifyArtifactDir;
      firstSignOff = verifyOkfConcept(s2RunId, {
        workspaceRoot: tmpStage1ReviewDir,
        by: 'human:qa-lead',
      });
      secondSignOff = verifyOkfConcept(s2RunId, {
        workspaceRoot: tmpStage1ReviewDir,
        by: 'human:final-approver',
      });
      assert(
        Boolean(secondSignOff.a2uiOutputPath) &&
          Boolean(secondSignOff.vizOutputPath) &&
          Boolean(secondSignOff.artifactHtmlPath) &&
          fs.existsSync(secondSignOff.artifactHtmlPath!) &&
          Boolean(secondSignOff.artifactVizPath) &&
          fs.existsSync(secondSignOff.artifactVizPath!) &&
          firstSignOff.verified.length === 1 &&
          secondSignOff.verified.length === 2,
        `verifyOkfConcept surfaces a2uiOutputPath, vizOutputPath, artifactHtmlPath, and artifactVizPath in a single call`
      );
    } finally {
      if (prevAgyArtifactDir === undefined) {
        delete process.env.AGY_ARTIFACT_DIR;
      } else {
        process.env.AGY_ARTIFACT_DIR = prevAgyArtifactDir;
      }
      fs.rmSync(tmpVerifyArtifactDir, { recursive: true, force: true });
    }

    const populatedStatus = getIcmPipelineStatus({ workspaceRoot: tmpStage1ReviewDir });
    const populatedFormatted = formatIcmPipelineStatus(populatedStatus);
    const s1StatusEntry = populatedStatus.runs.find((r) => r.runId === s1UnverifiedRunId);
    const s2StatusEntry = populatedStatus.runs.find((r) => r.runId === s2RunId);
    const s2BundleEntry = populatedStatus.bundle.concepts.find((c) =>
      c.relativePath.includes('krisevern-modul-2')
    );

    const tmpEmptyWs = fs.mkdtempSync(path.join(os.tmpdir(), 'icm-empty-status-'));
    let emptyStatusFormatted = '';
    let emptyStatusRunCount = -1;
    try {
      const emptyStatus = getIcmPipelineStatus({ workspaceRoot: tmpEmptyWs });
      emptyStatusRunCount = emptyStatus.runs.length;
      emptyStatusFormatted = formatIcmPipelineStatus(emptyStatus);
    } finally {
      fs.rmSync(tmpEmptyWs, { recursive: true, force: true });
    }

    assert(
      populatedStatus.bundle.conceptCount >= 1 &&
        populatedStatus.bundle.humanReviewedCount >= 1 &&
        populatedStatus.bundle.hasVizHtml === true &&
        populatedStatus.bundle.hasA2uiHtml === true &&
        s1StatusEntry?.stage1State === 'COMPLETE' &&
        s1StatusEntry?.okfGateState === 'VERIFIED' &&
        s1StatusEntry?.stage2State === 'PENDING' &&
        s1StatusEntry?.a2uiState === 'INTERMISSION' &&
        s2StatusEntry?.stage1State === 'COMPLETE' &&
        s2StatusEntry?.stage2State === 'COMPLETE' &&
        s2StatusEntry?.a2uiState === 'READY' &&
        s2StatusEntry?.verifiedBy === 'human:final-approver' &&
        s2BundleEntry?.verifiedBy === 'human:final-approver' &&
        populatedFormatted.includes('trust=human-reviewed (human:final-approver)') &&
        populatedFormatted.includes('[01_research: COMPLETE] ---> [OKF Gate: VERIFIED] ---> [02_script: PENDING] ---> [A2UI v1.0: INTERMISSION]') &&
        emptyStatusRunCount === 0 &&
        emptyStatusFormatted.includes('[01_research: PENDING] ---> [OKF Gate: PENDING] ---> [02_script: PENDING] ---> [A2UI v1.0: PENDING]'),
      `getIcmPipelineStatus and formatIcmPipelineStatus report the latest verifier sign-off, OKF bundle state, Stage-1 Intermission runs, full Stage-2+A2UI runs, and empty workspaces`
    );

    const tmpRefWs = fs.mkdtempSync(path.join(os.tmpdir(), 'icm-bundle-refs-'));
    let refHydratedBundleCtx = '';
    try {
      const refBundleRoot = path.join(tmpRefWs, 'bundle');
      fs.mkdirSync(path.join(refBundleRoot, 'research'), { recursive: true });
      fs.mkdirSync(path.join(refBundleRoot, 'references'), { recursive: true });
      const futureIso = new Date(Date.now() + 86_400_000 * 30).toISOString();
      fs.writeFileSync(
        path.join(refBundleRoot, 'research/prior-note.md'),
        [
          '---',
          'type: Research Concept',
          'title: Prior Research Summary',
          'description: Earlier synthesis note.',
          'status: stable',
          `stale_after: ${futureIso}`,
          '---',
          'UNIQUE_RESEARCH_BODY_SENTINEL_DO_NOT_HYDRATE',
        ].join('\n'),
        'utf-8'
      );
      fs.writeFileSync(
        path.join(refBundleRoot, 'references/aaa-unrelated-agro.md'),
        [
          '---',
          'type: Reference',
          'title: Agricultural Soil Directive',
          'description: Crop rotation thresholds.',
          'status: stable',
          `stale_after: ${futureIso}`,
          'sources:',
          '  - id: agro-dir',
          '    title: Soil Directive Official Registry',
          '    resource: https://registry.example.org/agro/soil-101',
          '---',
          'Crop rotation minimum interval is 3 years.',
        ].join('\n'),
        'utf-8'
      );
      fs.writeFileSync(
        path.join(refBundleRoot, 'references/zzz-orbital-debris.md'),
        [
          '---',
          'type: Reference',
          'title: Orbital Debris Mitigation Standard',
          'description: Post-mission disposal requirements in LEO.',
          'tags: [orbital, debris, spacecraft]',
          'status: stable',
          `stale_after: ${futureIso}`,
          'verified:',
          '  by: human:connector',
          `  at: ${new Date().toISOString()}`,
          'sources:',
          '  - id: orbital-std-primary',
          '    title: Space Systems Debris Mitigation Registry',
          '    resource: https://standards.example.org/space/ISO-24113',
          '---',
          'Formal identifier `ISO 24113`: Spacecraft in LEO shall complete disposal within 5 years[^orbital-std-primary].',
          '',
          '[^orbital-std-primary]: Space Systems Debris Mitigation Registry',
        ].join('\n'),
        'utf-8'
      );
      refHydratedBundleCtx = loadWorkspaceLayers(
        tmpRefWs,
        'Orbital debris post-mission spacecraft disposal'
      ).bundleContext;
    } finally {
      fs.rmSync(tmpRefWs, { recursive: true, force: true });
    }

    assert(
      refHydratedBundleCtx.includes('[/research/prior-note.md]') &&
        !refHydratedBundleCtx.includes('UNIQUE_RESEARCH_BODY_SENTINEL_DO_NOT_HYDRATE') &&
        refHydratedBundleCtx.includes('Hydrated Authoritative Reference Records (`workspace/bundle/references/`') &&
        refHydratedBundleCtx.includes('https://standards.example.org/space/ISO-24113') &&
        refHydratedBundleCtx.includes('Formal identifier `ISO 24113`') &&
        refHydratedBundleCtx.indexOf('[/references/zzz-orbital-debris.md]') !== -1 &&
        refHydratedBundleCtx.indexOf('### [/references/zzz-orbital-debris.md]') <
          refHydratedBundleCtx.indexOf('### [/references/aaa-unrelated-agro.md]'),
      `loadWorkspaceLayers hydrates workspace/bundle/references/*.md with canonical sources and topic-relevance ranking while keeping workspace/bundle/research/*.md in Progressive Disclosure summary form`
    );

    // Phase 4 Multimodal Engine (`03_visuals` + `04_audio`), Magic-Byte MIME Detection & A2UI Media Hydration Self-Tests
    const jpegMagic = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
    const pngMagic = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);
    const webpMagic = Buffer.concat([
      Buffer.from('RIFF', 'ascii'),
      Buffer.from([0x10, 0x00, 0x00, 0x00]),
      Buffer.from('WEBP', 'ascii'),
    ]);
    const mp3Magic = Buffer.from([0x49, 0x44, 0x33, 0x04, 0x00, 0x00]);
    const wrappedWav = wrapPcm16InWavHeader(Buffer.alloc(480, 0), 24000, 1);

    const detectedJpeg = detectMediaMimeAndExtension(jpegMagic, 'image/png', 'image');
    const detectedPng = detectMediaMimeAndExtension(pngMagic, 'image/jpeg', 'image');
    const detectedWebp = detectMediaMimeAndExtension(webpMagic, undefined, 'image');
    const detectedMp3 = detectMediaMimeAndExtension(mp3Magic, 'audio/wav', 'audio');
    const detectedWav = detectMediaMimeAndExtension(wrappedWav, 'audio/l16', 'audio');

    assert(
      detectedJpeg.mimeType === 'image/jpeg' &&
        detectedJpeg.ext === '.jpg' &&
        detectedPng.mimeType === 'image/png' &&
        detectedPng.ext === '.png' &&
        detectedWebp.mimeType === 'image/webp' &&
        detectedWebp.ext === '.webp' &&
        detectedMp3.mimeType === 'audio/mpeg' &&
        detectedMp3.ext === '.mp3' &&
        wrappedWav.length === 524 &&
        detectedWav.mimeType === 'audio/wav' &&
        detectedWav.ext === '.wav',
      'detectMediaMimeAndExtension prioritizes binary magic bytes (preventing JPEG-saved-as-.png mismatches) and wrapPcm16InWavHeader produces valid RIFF WAVE buffers'
    );

    const tmpMultimodalRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'icm-multimodal-test-'));
    try {
      const tmpMmPrompts = path.join(tmpMultimodalRoot, 'prompts');
      const tmpMmWs = path.join(tmpMultimodalRoot, 'workspace');
      fs.mkdirSync(tmpMmPrompts, { recursive: true });
      fs.mkdirSync(path.join(tmpMmWs, '_config'), { recursive: true });
      fs.writeFileSync(path.join(tmpMmWs, 'GEMINI.md'), '# Global Identity\nNeutral factual tone.\n', 'utf-8');
      fs.writeFileSync(path.join(tmpMmWs, 'CONTEXT.md'), '# Workspace Route\nTechnical systems analysis.\n', 'utf-8');
      fs.writeFileSync(path.join(tmpMmWs, '_config', 'voice_guide.md'), '# Voice Guide\nClear, calm studio delivery.\n', 'utf-8');

      fs.writeFileSync(
        path.join(tmpMmPrompts, '03_visuals.md'),
        [
          '---',
          'aspectRatio: "16:9"',
          'imageSize: "1K"',
          'output:',
          '  format: image',
          '---',
          'Render a clean 16:9 editorial diagram for {{slotTitle}} ({{courseTitle}}).',
          'Scene: {{visualPrompt}}',
          'Key points: {{slideCues}}',
        ].join('\n'),
        'utf-8'
      );
      fs.writeFileSync(
        path.join(tmpMmPrompts, '04_audio.md'),
        [
          '---',
          'voice: "Kore"',
          'audioMimeType: "audio/wav"',
          'sampleRate: 24000',
          'output:',
          '  format: audio',
          '---',
          '{{#if voiceGuide}}{{voiceGuide}}{{/if}}',
          '',
          '{{spokenText}}',
        ].join('\n'),
        'utf-8'
      );

      const stage3Contract = loadStagePromptContract('03_visuals', tmpMmPrompts);
      const stage4Contract = loadStagePromptContract('04_audio', tmpMmPrompts);
      assert(
        stage3Contract.outputFormat === 'image' &&
          stage3Contract.model === GEMINI_NANO_BANANA_MODEL &&
          stage3Contract.aspectRatio === '16:9' &&
          stage3Contract.imageSize === '1K' &&
          stage4Contract.outputFormat === 'audio' &&
          stage4Contract.model === GEMINI_FLASH_TTS_MODEL &&
          stage4Contract.voice === 'Kore' &&
          stage4Contract.audioMimeType === 'audio/wav' &&
          stage4Contract.sampleRate === 24000,
        'loadStagePromptContract parses image/audio multimodal frontmatter contracts with GEMINI_NANO_BANANA_MODEL and GEMINI_FLASH_TTS_MODEL defaults'
      );

      const mmRunId = 'grid-storage-architecture-1790000000001';
      const mmRunDir = path.join(tmpMmWs, 'runs', mmRunId);
      const mmStage1Out = path.join(mmRunDir, 'stages', '01_research', 'output');
      const mmStage2Out = path.join(mmRunDir, 'stages', '02_script', 'output');
      fs.mkdirSync(mmStage1Out, { recursive: true });
      fs.mkdirSync(mmStage2Out, { recursive: true });

      fs.writeFileSync(
        path.join(mmStage1Out, 'research_summary.md'),
        [
          '---',
          'type: Research Concept',
          'title: Grid Storage Architecture',
          'description: Technical synthesis of long-duration grid storage.',
          'tags:',
          '  - energy',
          'status: stable',
          'generated: 2026-11-14T12:00:00Z',
          'stale_after: 2027-11-14T12:00:00Z',
          'sources:',
          '  - id: grid-ref-1',
          '    title: Grid Reliability Standard',
          '    resource: https://standards.example.org/grid-101',
          '    retrieved_at: 2026-11-14T12:00:00Z',
          '---',
          '',
          '# Grid Storage Architecture',
          '',
          ' Grid-forming inverters stabilize frequency under low inertia [^grid-ref-1].',
          '',
          '[^grid-ref-1]: Grid Reliability Standard (https://standards.example.org/grid-101)',
          '',
        ].join('\n'),
        'utf-8'
      );

      fs.writeFileSync(
        path.join(mmStage2Out, 'script_draft.json'),
        JSON.stringify(
          {
            title: 'Grid Storage Briefing',
            subtitle: 'Inverter Dynamics & Dispatch',
            durationMinutes: 12,
            overviewVisualPrompt: 'Wide architectural schematic of a grid-forming battery substation at dusk, zero text.',
            scriptBody: '## Executive Overview\n\n**Grid-forming controls** synthesize virtual inertia during contingency events.',
            modules: [
              {
                moduleNumber: 1,
                title: 'Virtual Inertia Control Loops',
                durationMinutes: 6,
                narration: '**Primary droop control** responds within milliseconds.\n\nOperators verify phase-angle stability across feeders.',
                visualPrompt: 'Clean isometric diagram of an inverter phase-angle control loop with waveformoscilloscope, no labels.',
                slideCues: ['Sub-cycle synthetic inertia response', 'Feeder phase-angle damping'],
                actionItem: 'Validate synthetic inertia step response prior to commissioning.',
              },
            ],
          },
          null,
          2
        ),
        'utf-8'
      );

      fs.writeFileSync(
        path.join(mmRunDir, 'meta.json'),
        JSON.stringify(
          {
            runId: mmRunId,
            topic: 'Grid Storage Architecture',
            status: 'completed',
            stage1Telemetry: { totalTokens: 1000 },
            stage2Telemetry: { totalTokens: 500 },
          },
          null,
          2
        ),
        'utf-8'
      );

      assert(
        resolveDownstreamRunId(tmpMmWs) === mmRunId &&
          resolveDownstreamRunId(tmpMmWs, '1790000000001') === mmRunId,
        'resolveDownstreamRunId resolves latest Stage-2-complete run automatically or by timestamp suffix'
      );

      const s3Dry = await runStage3Flow({
        workspaceRoot: tmpMmWs,
        promptDir: tmpMmPrompts,
        dryRun: true,
      });
      const s4Dry = await runStage4Flow({
        workspaceRoot: tmpMmWs,
        promptDir: tmpMmPrompts,
        dryRun: true,
      });
      const s3Assembled = fs.readFileSync(
        path.join(mmRunDir, 'stages', '03_visuals', 'input', 'prompt_assembled.md'),
        'utf-8'
      );
      const s4Assembled = fs.readFileSync(
        path.join(mmRunDir, 'stages', '04_audio', 'input', 'prompt_assembled.md'),
        'utf-8'
      );
      assert(
        s3Dry.dryRun === true &&
          s3Dry.slotCount === 2 &&
          s3Dry.items.length === 0 &&
          s3Assembled.includes('grid-forming battery substation') &&
          s3Assembled.includes('inverter phase-angle control loop') &&
          s4Dry.dryRun === true &&
          s4Dry.slotCount === 2 &&
          s4Dry.items.length === 0 &&
          s4Assembled.includes('Grid-forming controls synthesize virtual inertia') &&
          !s4Assembled.includes('**Grid-forming controls**'),
        'runStage3Flow and runStage4Flow dry-runs assemble overview + module_XX visual and Markdown-stripped TTS prompts at zero token cost'
      );

      // Verify RIFF sub-chunk WAV parser (`parseWavMetadata`) & 5-tap FIR downsampler (`resampleWav16BitMono`)
      const pcm24k2Sec = Buffer.alloc(96000);
      for (let sIdx = 0; sIdx < 48000; sIdx++) {
        pcm24k2Sec.writeInt16LE(Math.round(8000 * Math.sin((2 * Math.PI * 440 * sIdx) / 24000)), sIdx * 2);
      }
      const base24kWav = wrapPcm16InWavHeader(pcm24k2Sec, 24000, 1);
      const listChunkPayload = Buffer.from('INFOISFT\x0c\x00\x00\x00GeminiTTS\x00\x00\x00', 'binary');
      const listChunkHeader = Buffer.alloc(8);
      listChunkHeader.write('LIST', 0, 'ascii');
      listChunkHeader.writeUInt32LE(listChunkPayload.length, 4);
      const wavWithListChunk = Buffer.concat([
        base24kWav.subarray(0, 36),
        listChunkHeader,
        listChunkPayload,
        base24kWav.subarray(36),
      ]);
      wavWithListChunk.writeUInt32LE(wavWithListChunk.length - 8, 4);
      const parsedListWav = parseWavMetadata(wavWithListChunk);
      const downsampled12kWav = resampleWav16BitMono(wavWithListChunk, 12000);
      const parsed12kWav = parseWavMetadata(downsampled12kWav);
      assert(
        parsedListWav.isWav === true &&
          parsedListWav.sampleRate === 24000 &&
          parsedListWav.channels === 1 &&
          parsedListWav.bitsPerSample === 16 &&
          parsedListWav.dataBytes === 96000 &&
          parsedListWav.durationSeconds === 2 &&
          parsed12kWav.isWav === true &&
          parsed12kWav.sampleRate === 12000 &&
          parsed12kWav.channels === 1 &&
          parsed12kWav.dataBytes === 48000 &&
          parsed12kWav.durationSeconds === 2 &&
          downsampled12kWav.length === 48044,
        'parseWavMetadata skips auxiliary RIFF chunks (LIST/INFO) and resampleWav16BitMono 5-tap FIR downsamples 24 kHz -> 12 kHz mono at 50% PCM byte size'
      );

      // Verify domain-neutral Layer 3 locale pack (`NB_NO_TEST_LOCALE` & built-in English) prosody normalization (`prepareTextForStudioTts`)
      const ttsNormNo = prepareTextForStudioTts(
        '**Ansvarsdeling:** I TEK17 §§ 11-12 og 11-13 samt forskriften (FOR-2015-12-17-1710) §§ 4–10 kreves ≤ 30 m avstand, ≥ 85 dB(A) og maks 15 % avvik kl. 08:00 f.eks. ved øvelse.',
        NB_NO_TEST_LOCALE
      );
      const ttsNormEn = prepareTextForStudioTts(
        '**Thermal Margin:** Under §§ 4-8, maintain ≥ 25 m clearance, ≤ 5 % drift, e.g. at 70 dB.',
        'en'
      );
      assert(
        ttsNormNo.startsWith('Ansvarsdeling. I TEK17 paragrafene 11-12 og 11-13') &&
          ttsNormNo.includes('paragrafene 4 til 10') &&
          !ttsNormNo.includes('FOR-2015-12-17-1710') &&
          ttsNormNo.includes('inntil 30 meter') &&
          ttsNormNo.includes('minst 85 desibel') &&
          ttsNormNo.includes('15 prosent') &&
          ttsNormNo.includes('klokken 08:00') &&
          ttsNormNo.includes('for eksempel') &&
          ttsNormEn.startsWith('Thermal Margin. Under sections 4 to 8') &&
          ttsNormEn.includes('at least 25 meters') &&
          ttsNormEn.includes('at most 5 percent') &&
          ttsNormEn.includes('for example,') &&
          ttsNormEn.includes('70 decibels'),
        'prepareTextForStudioTts expands statutory section ranges, bold lead-ins, inequalities, abbreviations, and physical units without corrupting chapter-hyphenated IDs'
      );

      // Verify multi-speaker Stage 4 contract (`primaryVoice` + `secondaryVoice`) & dialogue segmentation dry-run
      fs.writeFileSync(
        path.join(tmpMmPrompts, '04_audio_dialogue.md'),
        [
          '---',
          'primarySpeaker: "Lead"',
          'primaryVoice: "Sulafat"',
          'secondarySpeaker: "Specialist"',
          'secondaryVoice: "Kore"',
          'audioMimeType: "audio/wav"',
          'sampleRate: 24000',
          'output:',
          '  format: audio',
          '---',
          'Deliver "{{slotTitle}}" with calm studio clarity.',
        ].join('\n'),
        'utf-8'
      );
      const multiVoiceContract = loadStagePromptContract('04_audio_dialogue', tmpMmPrompts);
      const s4MultiDry = await runStage4Flow({
        workspaceRoot: tmpMmWs,
        promptDir: tmpMmPrompts,
        promptName: '04_audio_dialogue',
        dryRun: true,
      });
      const s4MultiAssembled = fs.readFileSync(
        path.join(mmRunDir, 'stages', '04_audio', 'input', 'prompt_assembled.md'),
        'utf-8'
      );
      assert(
        multiVoiceContract.primaryVoice === 'Sulafat' &&
          multiVoiceContract.secondaryVoice === 'Kore' &&
          multiVoiceContract.voice === 'Sulafat' &&
          s4MultiDry.dryRun === true &&
          s4MultiDry.slotCount === 2 &&
          s4MultiAssembled.includes('primaryVoice: "Sulafat"') &&
          s4MultiAssembled.includes('secondaryVoice: "Kore"') &&
          s4MultiAssembled.includes('[Lead (Sulafat)]:') &&
          s4MultiAssembled.includes('[Specialist (Kore)]:') &&
          s4MultiAssembled.includes('Validate synthetic inertia step response prior to commissioning.'),
        'loadStagePromptContract and runStage4Flow support zero-patch multi-speaker dialogue segmentation and actionItem wrap-up turns'
      );

      const s3OutDir = path.join(mmRunDir, 'stages', '03_visuals', 'output');
      const s4OutDir = path.join(mmRunDir, 'stages', '04_audio', 'output');
      fs.mkdirSync(s3OutDir, { recursive: true });
      fs.mkdirSync(s4OutDir, { recursive: true });
      const uniqueOvJpg = Buffer.concat([jpegMagic, Buffer.from('OV_HERO_UNIQUE_BYTES')]);
      const uniqueModJpg = Buffer.concat([jpegMagic, Buffer.from('MOD_01_UNIQUE_BYTES')]);
      // Write a > 8 MB (8.6 MB) 24 kHz mono WAV for module_01 to verify lossless 24 kHz studio WAV HTML inlining
      const large9MbWav = wrapPcm16InWavHeader(Buffer.alloc(9_000_000), 24000, 1);
      fs.writeFileSync(path.join(s3OutDir, 'overview.jpg'), uniqueOvJpg);
      fs.writeFileSync(path.join(s3OutDir, 'module_01.jpg'), uniqueModJpg);
      fs.writeFileSync(path.join(s4OutDir, 'overview.wav'), base24kWav);
      fs.writeFileSync(path.join(s4OutDir, 'module_01.wav'), large9MbWav);
      fs.writeFileSync(
        path.join(s4OutDir, 'audio_manifest.json'),
        JSON.stringify(
          {
            stage: '04_audio',
            runId: mmRunId,
            model: GEMINI_FLASH_TTS_MODEL,
            voice: 'Sulafat & Kore',
            voicesUsed: ['Sulafat', 'Kore'],
            items: [
              {
                slotId: 'overview',
                moduleNumber: 0,
                fileName: 'overview.wav',
                voicesUsed: ['Sulafat', 'Kore'],
              },
              {
                slotId: 'module_01',
                moduleNumber: 1,
                fileName: 'module_01.wav',
                voicesUsed: ['Sulafat', 'Kore'],
              },
            ],
          },
          null,
          2
        ),
        'utf-8'
      );

      fs.writeFileSync(
        path.join(mmRunDir, 'meta.json'),
        JSON.stringify(
          {
            runId: mmRunId,
            topic: 'Grid Storage Architecture',
            status: 'completed',
            stage1Telemetry: { totalTokens: 1000 },
            stage2Telemetry: { totalTokens: 500 },
            stage3Telemetry: { totalTokens: 2600, imageCount: 2 },
            stage4Telemetry: { totalTokens: 400, trackCount: 2 },
          },
          null,
          2
        ),
        'utf-8'
      );

      const prevEnvArtifactDir = process.env.AGY_ARTIFACT_DIR;
      let mmA2ui: ReturnType<typeof generateA2uiSurface>;
      try {
        delete process.env.AGY_ARTIFACT_DIR;
        mmA2ui = generateA2uiSurface(mmRunId, { workspaceRoot: tmpMmWs });
      } finally {
        if (prevEnvArtifactDir !== undefined) process.env.AGY_ARTIFACT_DIR = prevEnvArtifactDir;
      }
      const mmValidation = validateA2uiSurfaceMessages(mmA2ui.messages);
      const mmSurfaceJsonRaw = fs.readFileSync(mmA2ui.surfaceJsonPath, 'utf-8');
      const mmHtmlRaw = fs.readFileSync(mmA2ui.htmlOutputPath, 'utf-8');
      const mmBundleHtmlRaw = mmA2ui.bundleHtmlPath
        ? fs.readFileSync(mmA2ui.bundleHtmlPath, 'utf-8')
        : '';
      const mmPayloadMatch = mmHtmlRaw.match(/<script>\s*window\.A2UI_SURFACE_PAYLOAD\s*=\s*([\s\S]*?);\s*<\/script>/);
      const mmParsedPayload = mmPayloadMatch ? JSON.parse(mmPayloadMatch[1]) : null;
      const mmBundlePayloadMatch = mmBundleHtmlRaw.match(
        /<script>\s*window\.A2UI_SURFACE_PAYLOAD\s*=\s*([\s\S]*?);\s*<\/script>/
      );
      const mmBundleParsedPayload = mmBundlePayloadMatch ? JSON.parse(mmBundlePayloadMatch[1]) : null;

      const mmRunHooks: Record<string, any> = {};
      // eslint-disable-next-line no-new-func
      new Function('window', A2UI_STUDIO_JS)({
        A2UI_SURFACE_PAYLOAD: mmParsedPayload,
        __ICM_TEST_HOOKS__: mmRunHooks,
      });
      const mmBundleHooks: Record<string, any> = {};
      // eslint-disable-next-line no-new-func
      new Function('window', A2UI_STUDIO_JS)({
        A2UI_SURFACE_PAYLOAD: mmBundleParsedPayload,
        __ICM_TEST_HOOKS__: mmBundleHooks,
      });
      const resolvedRunDiskAudio = mmRunHooks.resolveClientMediaUri(
        './stages/04_audio/output/module_01.wav',
        { dataModel: { meta: { runId: mmRunId } } }
      );
      const resolvedBundleDiskAudio = mmBundleHooks.resolveClientMediaUri(
        './stages/04_audio/output/module_01.wav',
        { dataModel: { meta: { runId: mmRunId } } }
      );

      const tmpMmArtDir = path.join(tmpMultimodalRoot, 'artifact_out');
      const mmA2uiWithArt = generateA2uiSurface(mmRunId, {
        workspaceRoot: tmpMmWs,
        artifactDir: tmpMmArtDir,
      });
      const mmArtHtmlRaw = mmA2uiWithArt.artifactHtmlPath
        ? fs.readFileSync(mmA2uiWithArt.artifactHtmlPath, 'utf-8')
        : '';
      const mmArtPayloadMatch = mmArtHtmlRaw.match(
        /<script>\s*window\.A2UI_SURFACE_PAYLOAD\s*=\s*([\s\S]*?);\s*<\/script>/
      );
      const mmArtParsedPayload = mmArtPayloadMatch ? JSON.parse(mmArtPayloadMatch[1]) : null;
      const ovImgExpectedUri = `data:image/jpeg;base64,${uniqueOvJpg.toString('base64')}`;
      const ovImgOccurrences = mmArtHtmlRaw.split(ovImgExpectedUri).length - 1;
      const mmArtHooks: Record<string, any> = {};
      // eslint-disable-next-line no-new-func
      new Function('window', A2UI_STUDIO_JS)({
        A2UI_SURFACE_PAYLOAD: mmArtParsedPayload,
        __ICM_TEST_HOOKS__: mmArtHooks,
      });
      const resolvedClientModAudio = mmArtHooks.resolveClientMediaUri(
        './stages/04_audio/output/module_01.wav',
        { dataModel: { meta: { runId: mmRunId } } },
        mmArtParsedPayload?.mediaUrisByRun
      );
      const inlinedModWavMeta =
        typeof resolvedClientModAudio === 'string' && resolvedClientModAudio.startsWith('data:audio/wav;base64,')
          ? parseWavMetadata(Buffer.from(resolvedClientModAudio.slice('data:audio/wav;base64,'.length), 'base64'))
          : null;
      const mmStatus = getIcmPipelineStatus({ workspaceRoot: tmpMmWs, runId: mmRunId });
      const mmStatusFormatted = formatIcmPipelineStatus(mmStatus);

      assert(
        mmValidation.valid === true &&
          mmSurfaceJsonRaw.includes('./stages/03_visuals/output/overview.jpg') &&
          mmSurfaceJsonRaw.includes('./stages/03_visuals/output/module_01.jpg') &&
          mmSurfaceJsonRaw.includes('./stages/04_audio/output/overview.wav') &&
          mmSurfaceJsonRaw.includes('./stages/04_audio/output/module_01.wav') &&
          !mmSurfaceJsonRaw.includes('data:image/jpeg;base64,') &&
          !mmSurfaceJsonRaw.includes('data:audio/wav;base64,') &&
          !mmHtmlRaw.includes('data:image/jpeg;base64,') &&
          !mmHtmlRaw.includes('data:audio/wav;base64,') &&
          !mmBundleHtmlRaw.includes('data:image/jpeg;base64,') &&
          !mmBundleHtmlRaw.includes('data:audio/wav;base64,') &&
          mmParsedPayload?.mediaBaseMode === 'run' &&
          mmParsedPayload?.hostRunId === mmRunId &&
          Object.keys(mmParsedPayload?.mediaUrisByRun || {}).length === 0 &&
          mmBundleParsedPayload?.mediaBaseMode === 'bundle' &&
          mmBundleParsedPayload?.hostRunId === '' &&
          Object.keys(mmBundleParsedPayload?.mediaUrisByRun || {}).length === 0 &&
          resolvedRunDiskAudio === './stages/04_audio/output/module_01.wav' &&
          resolvedBundleDiskAudio === `../runs/${encodeURIComponent(mmRunId)}/stages/04_audio/output/module_01.wav` &&
          mmArtParsedPayload?.mediaBaseMode === 'artifact' &&
          mmArtHtmlRaw.includes('overview_hero_image') &&
          ovImgOccurrences === 1 &&
          mmParsedPayload?.messages?.[2]?.updateDataModel?.value?.stage2?.overviewAudioUrl ===
            './stages/04_audio/output/overview.wav' &&
          mmParsedPayload?.messages?.[2]?.updateDataModel?.value?.stage2?.overviewAudioVoices ===
            'Sulafat & Kore' &&
          typeof resolvedClientModAudio === 'string' &&
          resolvedClientModAudio.startsWith('data:audio/wav;base64,') &&
          inlinedModWavMeta?.sampleRate === 24000 &&
          inlinedModWavMeta?.dataBytes === 9_000_000 &&
          mmStatus.runs[0]?.totalTokens === 4500 &&
          mmStatusFormatted.includes('Downstream: 3,000'),
        'generateA2uiSurface emits zero-Base64 relative disk HTMLs (run & bundle), deduplicates base64 media into artifact a2ui_studio.html (1x), preserves lossless 24 kHz WAV studio audio in artifact data URIs, keeps surface.dataModel lightweight, and binds voicesLabel'
      );
    } finally {
      fs.rmSync(tmpMultimodalRoot, { recursive: true, force: true });
    }

    // Source MIME-Type (`mime_type`), Middle-Ellipsis URL Formatting, Archive Attention Cues & A2UI Filter Bar Self-Tests
    {
      const archivePdfUrl =
        'https://www.dibk.no/globalassets/endringshistorikk/byggteknisk-forskrift/tek--11-12_01.07.2010-30.06.2011.pdf';
      const activeHtmlUrl =
        'https://www.dibk.no/regelverk/byggteknisk-forskrift-tek17/11/v/11-12';
      const xmlFeedUrl = 'https://api.example.gov/regulations/current.xml';

      assert(
        normalizeHttpMimeType('application/pdf; charset=binary') === 'application/pdf' &&
          normalizeHttpMimeType('Text/HTML; charset=UTF-8') === 'text/html' &&
          inferSourceMimeTypeFromUrl(archivePdfUrl) === 'application/pdf' &&
          inferSourceMimeTypeFromUrl(xmlFeedUrl) === 'application/xml' &&
          inferSourceMimeTypeFromUrl(activeHtmlUrl) === undefined,
        'normalizeHttpMimeType & inferSourceMimeTypeFromUrl normalize HTTP Content-Type headers and infer explicit file media types'
      );

      const serverEllipsis = formatSourceUrlMiddleEllipsis(archivePdfUrl, 78);
      const clientEllipsis = s1Hooks.formatClientUrlMiddleEllipsis(archivePdfUrl, 78);
      assert(
        serverEllipsis === clientEllipsis &&
          serverEllipsis.includes('dibk.no') &&
          serverEllipsis.includes('endringshistorikk') &&
          serverEllipsis.endsWith('tek--11-12_01.07.2010-30.06.2011.pdf') &&
          serverEllipsis.length <= 82,
        `Middle-ellipsis URL formatting preserves host, semantic archive segment, and full filename (${serverEllipsis})`
      );

      // OKF v0.3 YAML round-trip for `mime_type`
      const mimeYamlDoc = serializeOkfDocument({
        frontmatter: {
          type: 'Research Concept',
          title: 'MIME Provenance Roundtrip',
          status: 'draft',
          sources: [
            {
              id: 'reg-pdf',
              title: 'Official Regulation Snapshot',
              mime_type: 'application/pdf',
              resource: archivePdfUrl,
              retrieved_at: '2026-11-15T08:00:00Z',
            },
          ],
        },
        body: 'Claim[^reg-pdf].\n\n[^reg-pdf]: Official Regulation Snapshot\n',
      });
      const reparsedMimeDoc = parseOkfDocument(mimeYamlDoc);
      assert(
        mimeYamlDoc.includes('mime_type: application/pdf') &&
          mimeYamlDoc.indexOf('title:') < mimeYamlDoc.indexOf('mime_type:') &&
          mimeYamlDoc.indexOf('mime_type:') < mimeYamlDoc.indexOf('retrieved_at:') &&
          reparsedMimeDoc.frontmatter.sources?.[0]?.mime_type === 'application/pdf',
        'OKFSource.mime_type serializes in canonical YAML order after title and before retrieved_at, and round-trips cleanly'
      );

      // Mocked `resolveRedirect` HTTP `Content-Type` and `%PDF-` magic-byte detection on extensionless download URLs
      const origFetchMime = globalThis.fetch;
      try {
        globalThis.fetch = (async (input: any) => {
          const u = String(input);
          if (u.includes('/download/extensionless-pdf')) {
            const pdfBytes = Buffer.from('%PDF-1.7\n1 0 obj\n<< /CreationDate (D:20240501120000Z) >>\n', 'latin1');
            return new Response(pdfBytes, {
              status: 200,
              headers: { 'content-type': 'application/octet-stream' },
            });
          }
          return new Response('<html><head><title>Guidance Portal</title></head><body>ok</body></html>', {
            status: 200,
            headers: { 'content-type': 'text/html; charset=utf-8' },
          });
        }) as typeof fetch;

        const extlessPdfRes = await resolveRedirect('https://authority.example.gov/download/extensionless-pdf');
        const htmlPortalRes = await resolveRedirect('https://authority.example.gov/guidance/portal');
        assert(
          extlessPdfRes.mimeType === 'application/pdf' &&
            htmlPortalRes.mimeType === 'text/html',
          `resolveRedirect detects application/pdf from %PDF- magic bytes even on octet-stream extensionless URLs and text/html on web pages`
        );
      } finally {
        globalThis.fetch = origFetchMime;
      }

      // Client MIME & archive attention hooks + curateOkfSources MIME stamping
      const pdfMimeClient = s1Hooks.inferClientSourceMimeInfo({ resource: archivePdfUrl });
      const htmlMimeClient = s1Hooks.inferClientSourceMimeInfo({ resource: activeHtmlUrl });
      const xhtmlArchiveMime = s1Hooks.inferClientSourceMimeInfo({
        resource: 'https://api.example.gov/v1/publicData/get/statutes.tar.bz2#act-2002-020.xml',
        mime_type: 'application/xhtml+xml',
      });
      const xmlFragmentNoMime = s1Hooks.inferClientSourceMimeInfo({
        resource: 'https://api.example.gov/v1/publicData/get/statutes.tar.bz2#act-2002-020.xml',
      });
      const xhtmlWebPageMime = s1Hooks.inferClientSourceMimeInfo({
        resource: 'https://www.example.gov/regulations/overview.xhtml',
        mime_type: 'application/xhtml+xml',
      });
      const archiveProv = s1Hooks.inspectClientSourceDomainProvenance({
        id: 'dibk-old',
        title: 'Direktoratet for byggkvalitet (DiBK) — Veiledning § 11-12',
        resource: archivePdfUrl,
      });
      const activeProv = s1Hooks.inspectClientSourceDomainProvenance({
        id: 'dibk-active',
        title: 'Direktoratet for byggkvalitet (DiBK) — Byggteknisk forskrift § 11-12',
        resource: activeHtmlUrl,
      });
      const archiveAttn = s1Hooks.inspectClientSourceAttentionSignals(
        { resource: archivePdfUrl },
        archiveProv
      );
      const activeAttn = s1Hooks.inspectClientSourceAttentionSignals(
        { resource: activeHtmlUrl },
        activeProv
      );
      const curatedMimeSwap = curateOkfSources(mimeYamlDoc, {
        replaceSourceMap: { 'reg-pdf': activeHtmlUrl },
        addSources: [{ url: xmlFeedUrl, title: 'Official XML Feed' }],
      });
      const curatedParsed = parseOkfDocument(curatedMimeSwap.markdown);
      const addedXmlSrc = curatedParsed.frontmatter.sources?.find((s) => s.resource === xmlFeedUrl);

      const stage2CiteSources = [
        {
          id: 'dibk-tek17-11-2',
          title: 'Byggteknisk forskrift (TEK17) § 11-2 — Risikoklasser',
          resource: 'https://www.dibk.no/regelverk/byggteknisk-forskrift-tek17/11/i/11-2',
        },
        {
          id: 'lovdata-brannforebygging',
          title: 'Forskrift om brannforebygging',
          resource:
            'https://api.lovdata.no/v1/publicData/get/gjeldende-sentrale-forskrifter.tar.bz2#sf/sf-20151217-1710.xml',
        },
      ];
      const stage2BlockHtml = s1Hooks.renderMarkdownBlock(
        'Ordinære barnehager plasseres i risikoklasse 3[^dibk-tek17-11-2] og følger forskriften[^lovdata-brannforebygging][^ukjent-id].',
        stage2CiteSources,
        [],
        false,
        true
      );
      const stage2InlineHtml = s1Hooks.renderInlineMarkdown(
        'Krav til risikoklasse 3[^dibk-tek17-11-2].',
        stage2CiteSources,
        [],
        true
      );

      const stage1BlockHtml = s1Hooks.renderMarkdownBlock(
        'Ordinære barnehager plasseres i risikoklasse 3[^dibk-tek17-11-2].',
        stage2CiteSources,
        []
      );

      // Verify zero-CDN Mermaid flowchart & +---+ / Unicode box-diagram A2UI FlowDiagram rendering (leaving plain ASCII tables as <pre><code>)
      const mermaidMd = [
        '```mermaid',
        'flowchart TD',
        '  Top["CORE SPECIFICATION (STD-2025-100)\\nSection 6 Baseline Controls | Section 8 Audit"]',
        '  Owner["INFRASTRUCTURE OWNER\\nREG-2025-01 §§ 4–10\\n- Maintain core hardware (§ 5)\\n- Upgrade legacy systems (§ 8)"]',
        '  Operator["SYSTEM OPERATOR\\nREG-2025-01 §§ 11–13\\n- Keep primary pathways clear (§ 11 b)\\n- Execute incident drills (§ 12)"]',
        '  Top --> Owner & Operator',
        '  Owner <-->|"Shared handoff & reporting"| Operator',
        '```',
      ].join('\n');
      const asciiDiagramMd = [
        '```',
        '+-------------------------------------------------------------------------+',
        '|                  CORE SPECIFICATION (STD-2025-100)                      |',
        '|           Section 6 Baseline Controls  |  Section 8 Audit               |',
        '+-----------------------------------+-------------------------------------+',
        '                                    |',
        '          +-------------------------+-------------------------+',
        '          |                                                   |',
        '          v                                                   v',
        '+-----------------------------------+       +-----------------------------------+',
        '|      INFRASTRUCTURE OWNER         |       |        SYSTEM OPERATOR            |',
        '|      REG-2025-01 §§ 4–10          |       |      REG-2025-01 §§ 11–13         |',
        '+-----------------------------------+       +-----------------------------------+',
        '| - Know baseline specs and active  |       | - Operate system within certified |',
        '|   installations (§ 4)             |<----->|   parameters (§ 11 a)             |',
        '| - Inspect technical subsystems    | Co-   | - Keep primary pathways clear and |',
        '|   and documentation (§§ 5, 10)    | ord-  |   report anomalies (§ 11 b–c)     |',
        '|                                   | ina-  |                                   |',
        '|                                   | tion  |                                   |',
        '+-----------------------------------+       +-----------------------------------+',
        '```',
      ].join('\n');
      const horizUnicodeDiagramMd = [
        '```',
        '╭───────────────────╮      ╭───────────────────╮      ╭───────────────────╮',
        '│  1. 収集フェーズ  │ ---> │  2. 検証フェーズ  │ ---> │  3. 公開フェーズ  │',
        '╰───────────────────╯      ╰───────────────────╯      ╰───────────────────╯',
        '```',
      ].join('\n');
      const plainSqlTableMd = [
        '```',
        '+-------+-------+',
        '| col_a | col_b |',
        '+-------+-------+',
        '|   100 |   200 |',
        '+-------+-------+',
        '```',
      ].join('\n');
      const collapsedAsciiDiagramMd = asciiDiagramMd.replace(/(?<=\S)[ \t]{2,}/g, ' ');
      const renderedMermaidHtml = s1Hooks.renderMarkdownBlock(mermaidMd, [], []);
      const renderedAsciiDiagHtml = s1Hooks.renderMarkdownBlock(asciiDiagramMd, [], []);
      const renderedCollapsedAsciiHtml = s1Hooks.renderMarkdownBlock(collapsedAsciiDiagramMd, [], []);
      const renderedHorizUnicodeHtml = s1Hooks.renderMarkdownBlock(horizUnicodeDiagramMd, [], []);
      const renderedPlainTableHtml = s1Hooks.renderMarkdownBlock(plainSqlTableMd, [], []);
      assert(
        renderedMermaidHtml.includes('data-a2ui-component="FlowDiagram"') &&
          renderedMermaidHtml.includes('CORE SPECIFICATION (STD-2025-100)') &&
          renderedMermaidHtml.includes('a2ui-flow-node-subtitles') &&
          renderedMermaidHtml.includes('Shared handoff &amp; reporting') &&
          renderedMermaidHtml.includes('a2ui-flow-connector-band') &&
          renderedMermaidHtml.includes('a2ui-flow-bridge') &&
          !renderedMermaidHtml.includes('<pre><code>') &&
          renderedAsciiDiagHtml.includes('data-a2ui-component="FlowDiagram"') &&
          renderedAsciiDiagHtml.includes('INFRASTRUCTURE OWNER') &&
          renderedAsciiDiagHtml.includes('SYSTEM OPERATOR') &&
          renderedAsciiDiagHtml.includes('Coordination') &&
          renderedAsciiDiagHtml.includes('Know baseline specs and active installations (§ 4)') &&
          renderedAsciiDiagHtml.includes('a2ui-flow-source-disclosure') &&
          !renderedAsciiDiagHtml.includes('<pre><code>') &&
          renderedCollapsedAsciiHtml.includes('data-a2ui-component="FlowDiagram"') &&
          renderedCollapsedAsciiHtml.includes('INFRASTRUCTURE OWNER') &&
          renderedCollapsedAsciiHtml.includes('SYSTEM OPERATOR') &&
          renderedCollapsedAsciiHtml.includes('Coordination') &&
          !renderedCollapsedAsciiHtml.includes('<pre><code>') &&
          renderedHorizUnicodeHtml.includes('dir-lr') &&
          renderedHorizUnicodeHtml.includes('1. 収集フェーズ') &&
          renderedHorizUnicodeHtml.includes('3. 公開フェーズ') &&
          renderedPlainTableHtml.includes('<pre><code>') &&
          !renderedPlainTableHtml.includes('a2ui-flow-diagram'),
        'renderMarkdownBlock renders Mermaid flowcharts, intact & space-collapsed +---+ ASCII hierarchies, and non-Latin Unicode LR box diagrams as responsive A2UI FlowDiagram cards + SVG connectors while preserving plain ASCII tables in <pre><code>'
      );

      assert(
        pdfMimeClient.mimeType === 'application/pdf' &&
          pdfMimeClient.group === 'pdf' &&
          pdfMimeClient.badgeLabel.includes('application/pdf') &&
          htmlMimeClient.mimeType === 'text/html' &&
          htmlMimeClient.group === 'html' &&
          xhtmlArchiveMime.group === 'data' &&
          xhtmlArchiveMime.shortLabel === 'XML' &&
          xmlFragmentNoMime.group === 'data' &&
          xmlFragmentNoMime.shortLabel === 'XML' &&
          xhtmlWebPageMime.group === 'html' &&
          xhtmlWebPageMime.shortLabel === 'HTML' &&
          typeof s1Hooks.attachDeepResearchCitations === 'function' &&
          stage1BlockHtml.includes('class="fn-ref okf-num-cite"') &&
          stage1BlockHtml.includes('>1</a></sup>') &&
          stage2BlockHtml.includes('href="https://www.dibk.no/regelverk/byggteknisk-forskrift-tek17/11/i/11-2"') &&
          stage2BlockHtml.includes('target="_blank"') &&
          stage2BlockHtml.includes('>1</a></sup>') &&
          stage2BlockHtml.includes('data-fn-jump="lovdata-brannforebygging"') &&
          stage2BlockHtml.includes('>2</a></sup>') &&
          !stage2BlockHtml.includes('ukjent-id') &&
          stage2InlineHtml.includes('href="https://www.dibk.no/regelverk/byggteknisk-forskrift-tek17/11/i/11-2"') &&
          archiveAttn.isHistoricalOrArchiveUrl === true &&
          archiveAttn.needsAttention === true &&
          activeAttn.isHistoricalOrArchiveUrl === false &&
          activeAttn.needsAttention === false &&
          addedXmlSrc?.mime_type === 'application/xml',
        'Client MIME/attention hooks flag /endringshistorikk/ archive PDFs while keeping active authority HTML pages clean, and curateOkfSources stamps mime_type'
      );

      // RFC 6839 +json/+xml OpenAPI Vendor Media Types, OGC/CKAN Query Params & data.<registry> Provenance
      const vendorJsonMime = s1Hooks.inferClientSourceMimeInfo({
        resource: 'https://data.registry.example.org/api/entities/976673824',
        mime_type: 'application/vnd.registry.entity.v2+json; charset=UTF-8',
      });
      const halJsonMime = s1Hooks.inferClientSourceMimeInfo({
        resource: 'https://api.registry.example.org/v1/establishments/100',
        mime_type: 'application/hal+json',
      });
      const atomXmlMime = s1Hooks.inferClientSourceMimeInfo({
        resource: 'https://data.registry.example.org/feeds/updates',
        mime_type: 'application/atom+xml',
      });
      const svgImageMime = s1Hooks.inferClientSourceMimeInfo({
        resource: 'https://registry.example.org/assets/diagram.svg',
        mime_type: 'image/svg+xml',
      });
      const ogcQueryClientMime = s1Hooks.inferClientSourceMimeInfo({
        resource: 'https://geo.example.gov/collections/parcels/items?f=json',
      });
      const entityDataUrl = 'https://data.natreg.example.org/registry/api/establishments/976673824';
      const entityServerProv = inspectSourceDomainProvenance({
        id: 'natreg-establishment-976673824',
        title: 'National Entity Register – OAKRIDGE FACILITY (reg. no. 976673824)',
        resource: entityDataUrl,
      });
      const entityClientProv = s1Hooks.inspectClientSourceDomainProvenance({
        id: 'natreg-establishment-976673824',
        title: 'National Entity Register – OAKRIDGE FACILITY (reg. no. 976673824)',
        resource: entityDataUrl,
      });
      const cadastreWsUrl = 'https://ws.geoportal.example.org/addresses/v1/search?q=Oak+Road+463';
      const cadastreServerProv = inspectSourceDomainProvenance({
        id: 'cadastre-oak-road-463',
        title: 'National Cadastre Search – Oak Road 463, 5307 OAKRIDGE',
        resource: cadastreWsUrl,
      });
      const cadastreClientProv = s1Hooks.inspectClientSourceDomainProvenance({
        id: 'cadastre-oak-road-463',
        title: 'National Cadastre Search – Oak Road 463, 5307 OAKRIDGE',
        resource: cadastreWsUrl,
      });
      const wfsBuildingUrl =
        'https://wfs.geoportal.example.org/skwms1/wfs.cadastre-buildings?service=WFS&version=2.0.0&request=GetFeature&typenames=app:Building';
      const wfsClientMime = s1Hooks.inferClientSourceMimeInfo({ resource: wfsBuildingUrl });
      const wfsBuildingServerProv = inspectSourceDomainProvenance({
        id: 'cadastre-building-22988441',
        title: 'Cadastre Building Points – Building 22988441',
        resource: wfsBuildingUrl,
      });
      const wfsBuildingClientProv = s1Hooks.inspectClientSourceDomainProvenance({
        id: 'cadastre-building-22988441',
        title: 'Cadastre Building Points – Building 22988441',
        resource: wfsBuildingUrl,
      });
      const lidarCoordProv = inspectSourceDomainProvenance({
        id: 'elevation-dtm-dom',
        title: 'National Elevation Service – DTM1/DOM1 (60.4849, 5.2113)',
        resource: 'https://ws.geoportal.example.org/elevation/v1/point?lat=60.4849&lon=5.2113',
      });
      const mirrorDatedTitleProv = inspectSourceDomainProvenance({
        id: 'mirror-agency-2024',
        title: 'Safety Standard – National Safety Agency (2024)',
        resource: 'https://mirror.thirdparty.example.com/files/safety.pdf',
      });
      const entityClientAttn = s1Hooks.inspectClientSourceAttentionSignals(
        {
          resource: entityDataUrl,
          mime_type: 'application/vnd.natreg.establishment.v2+json',
        },
        entityClientProv
      );
      assert(
        vendorJsonMime.group === 'data' &&
          vendorJsonMime.shortLabel === 'JSON' &&
          vendorJsonMime.badgeLabel.includes('JSON') &&
          halJsonMime.group === 'data' &&
          halJsonMime.shortLabel === 'JSON' &&
          atomXmlMime.group === 'data' &&
          atomXmlMime.shortLabel === 'XML' &&
          svgImageMime.group !== 'data' &&
          ogcQueryClientMime.group === 'data' &&
          ogcQueryClientMime.shortLabel === 'JSON' &&
          inferSourceMimeTypeFromUrl('https://geo.example.gov/collections/parcels/items?f=json') ===
            'application/json' &&
          inferSourceMimeTypeFromUrl('https://ckan.example.gov/api/action/datastore_search?wt=json') ===
            'application/json' &&
          inferSourceMimeTypeFromUrl(
            'https://data.example.gov/api/entities/42?format=application%2Fld%2Bjson'
          ) === 'application/ld+json' &&
          inferSourceMimeTypeFromUrl(wfsBuildingUrl) === 'application/gml+xml' &&
          inferSourceMimeTypeFromUrl(`${wfsBuildingUrl}&outputFormat=application%2Fjson`) ===
            'application/json' &&
          wfsClientMime.group === 'data' &&
          wfsClientMime.shortLabel === 'XML' &&
          entityServerProv.domainMismatch === false &&
          entityClientProv.domainMismatch === false &&
          cadastreServerProv.domainMismatch === false &&
          cadastreClientProv.domainMismatch === false &&
          wfsBuildingServerProv.domainMismatch === false &&
          wfsBuildingClientProv.domainMismatch === false &&
          lidarCoordProv.domainMismatch === false &&
          mirrorDatedTitleProv.domainMismatch === true &&
          entityClientAttn.needsAttention === false,
        'RFC 6839 +json/+xml media types, OGC WFS/API query params, and Registry-First entity/building/coordinate OpenAPI provenance classify cleanly'
      );

      // W3C CSP `object-src 'none'` PDF Viewer Block, Leaf-Parent Middle-Ellipsis, Numeric Static-Snapshot Age & OKF v0.3 `machine-confirmed` -> `human-reviewed` Lifecycle
      assert(
        isPdfBlockedByBrowserCsp("default-src 'self'; object-src 'none'; frame-ancestors 'none'", 'application/pdf') === true &&
          isPdfBlockedByBrowserCsp("default-src 'none'; script-src 'self'", 'application/pdf') === true &&
          isPdfBlockedByBrowserCsp("default-src 'self'; object-src 'self'", 'application/pdf') === false &&
          isPdfBlockedByBrowserCsp("default-src 'self'; object-src 'none'", 'text/html; charset=utf-8') === false,
        'isPdfBlockedByBrowserCsp accurately detects W3C CSP object-src/default-src \'none\' inline-viewer blocks strictly on application/pdf'
      );

      const origFetchCsp = globalThis.fetch;
      try {
        globalThis.fetch = (async (input: any) => {
          const u = String(input);
          if (u.includes('/blocked.pdf')) {
            return new Response(Buffer.from('%PDF-1.7\n', 'latin1'), {
              status: 200,
              headers: {
                'content-type': 'application/pdf',
                'content-security-policy': "default-src 'self'; img-src 'self' data:; object-src 'none'",
              },
            });
          }
          if (u.includes('/open.pdf')) {
            return new Response(Buffer.from('%PDF-1.7\n', 'latin1'), {
              status: 200,
              headers: {
                'content-type': 'application/pdf',
                'content-security-policy': "default-src 'self'; object-src 'self'",
              },
            });
          }
          return new Response('<html><head><title>Active HTML Rule</title></head><body>ok</body></html>', {
            status: 200,
            headers: {
              'content-type': 'text/html; charset=utf-8',
              'content-security-policy': "default-src 'self'; object-src 'none'",
            },
          });
        }) as typeof fetch;

        const blockedPdfRes = await resolveRedirect('https://authority.example.gov/files/blocked.pdf');
        const openPdfRes = await resolveRedirect('https://authority.example.gov/files/open.pdf');
        const cspHtmlRes = await resolveRedirect('https://authority.example.gov/rules/section-11');
        assert(
          blockedPdfRes.browserBlockedPdf === true &&
            !openPdfRes.browserBlockedPdf &&
            !cspHtmlRes.browserBlockedPdf,
          'resolveRedirect flags browserBlockedPdf only when application/pdf carries CSP object-src \'none\''
        );
      } finally {
        globalThis.fetch = origFetchCsp;
      }

      const datedCmsPdfUrl =
        'https://www.dibk.no/globalassets/byggeregler/tidligere_regelverk/byggteknisk_forskrift_des_2014.pdf';
      const serverLeafEllipsis = formatSourceUrlMiddleEllipsis(datedCmsPdfUrl, 78);
      const clientLeafEllipsis = s1Hooks.formatClientUrlMiddleEllipsis(datedCmsPdfUrl, 78);
      assert(
        serverLeafEllipsis === clientLeafEllipsis &&
          serverLeafEllipsis.includes('byggeregler') &&
          serverLeafEllipsis.includes('tidligere_regelverk') &&
          serverLeafEllipsis.endsWith('byggteknisk_forskrift_des_2014.pdf'),
        `Leaf-parent middle-ellipsis preserves parent folder context (${serverLeafEllipsis})`
      );

      const dated2014Prov = s1Hooks.inspectClientSourceDomainProvenance({
        id: 'reg-2014',
        title: 'Building Regulation Snapshot',
        resource: datedCmsPdfUrl,
      });
      const dated2014Attn = s1Hooks.inspectClientSourceAttentionSignals(
        { resource: datedCmsPdfUrl, mime_type: 'application/pdf' },
        dated2014Prov
      );
      const oldModPdfUrl = 'https://authority.example.gov/documents/technical_guide.pdf';
      const oldModProv = s1Hooks.inspectClientSourceDomainProvenance({
        id: 'guide-old-mod',
        title: 'Technical Guide',
        resource: oldModPdfUrl,
      });
      const oldModAttn = s1Hooks.inspectClientSourceAttentionSignals(
        {
          resource: oldModPdfUrl,
          mime_type: 'application/pdf',
          last_modified: '2015-05-01T00:00:00Z',
        },
        oldModProv
      );
      const freshYear = new Date().getUTCFullYear() - 1;
      const freshPdfUrl = `https://authority.example.gov/documents/thematic_guide_${freshYear}.pdf`;
      const freshPdfProv = s1Hooks.inspectClientSourceDomainProvenance({
        id: 'guide-fresh',
        title: 'Current Thematic Guide',
        resource: freshPdfUrl,
      });
      const freshPdfAttn = s1Hooks.inspectClientSourceAttentionSignals(
        { resource: freshPdfUrl, mime_type: 'application/pdf' },
        freshPdfProv
      );
      const consolidatedActUrl = 'https://registry.example.gov/statutes/act/2002-06-14-20';
      const consolidatedProv = s1Hooks.inspectClientSourceDomainProvenance({
        id: 'act-2002',
        title: 'Consolidated National Act',
        resource: consolidatedActUrl,
      });
      const consolidatedAttn = s1Hooks.inspectClientSourceAttentionSignals(
        {
          resource: consolidatedActUrl,
          mime_type: 'text/html',
          last_modified: '2026-01-01T00:00:00Z',
        },
        consolidatedProv
      );
      assert(
        dated2014Attn.isDatedStaticSnapshot === true &&
          dated2014Attn.needsAttention === true &&
          oldModAttn.isDatedStaticSnapshot === true &&
          oldModAttn.needsAttention === true &&
          freshPdfAttn.isDatedStaticSnapshot === false &&
          freshPdfAttn.needsAttention === false &&
          consolidatedAttn.isDatedStaticSnapshot === false &&
          consolidatedAttn.needsAttention === false,
        'Universal numeric static-snapshot staleness flags >=5-year-old static PDFs (by last_modified or URL year) while keeping recent PDFs and consolidated HTML statutes clean'
      );

      // Verify 1-click Copy URL button (`okf-copy-url-btn`) renders in OkfMarkdown mock DOM
      const prevDocCopyTest = (globalThis as any).document;
      try {
        (globalThis as any).document = {
          createElement: createMockElement,
          getElementById: () => null,
          querySelector: () => null,
          querySelectorAll: () => [],
        };
        const okfCompForCopy = s1UpdateCompsMsg?.updateComponents.components.find(
          (c) => c.id === 'tab_okf_markdown'
        );
        const copyDom = s1Hooks.renderComponent(s1SimSurface, okfCompForCopy);
        const copyUrlBtn = findInMockDom(
          copyDom,
          (n) =>
            typeof n.className === 'string' &&
            n.className.includes('okf-copy-url-btn') &&
            Boolean(n.getAttribute('data-src-url'))
        );
        assert(
          Boolean(copyUrlBtn) && String(copyUrlBtn.getAttribute('data-src-url')).startsWith('https://'),
          'OkfMarkdown source card renders a 1-click Copy URL button (okf-copy-url-btn) bound to rawUrl'
        );
      } finally {
        (globalThis as any).document = prevDocCopyTest;
      }

      // Verify OKF v0.3 two-step `machine-confirmed` (draft preserved) -> `human-reviewed` (promoted to stable) lifecycle
      const tmpMachineCurateRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'icm-machine-curate-'));
      try {
        const mcWs = path.join(tmpMachineCurateRoot, 'workspace');
        const mcArtDir = path.join(tmpMachineCurateRoot, 'artifacts');
        const mcRunId = 'reg-curation-1795000000000';
        const mcOutDir = path.join(mcWs, 'runs', mcRunId, 'stages/01_research/output');
        fs.mkdirSync(mcOutDir, { recursive: true });
        fs.mkdirSync(path.join(mcWs, 'bundle/research'), { recursive: true });
        fs.writeFileSync(
          path.join(mcWs, 'runs', mcRunId, 'meta.json'),
          JSON.stringify(
            {
              runId: mcRunId,
              topic: 'Regulatory Compliance Audit',
              model: GEMINI_4_ARGON_MODEL,
              createdAt: '2026-11-15T09:00:00Z',
              status: 'stage1_completed',
            },
            null,
            2
          ),
          'utf-8'
        );
        const mcInitialDoc = serializeOkfDocument({
          frontmatter: {
            type: 'Regulatory Guide',
            title: 'Active Building Safety Standards',
            description: 'Authoritative overview of active safety rules.',
            tags: ['safety', 'regulations'],
            status: 'draft',
            generated: { by: 'icm-stage1/gemini-4-argon', at: '2026-11-15T09:00:00Z' },
            stale_after: '2027-11-15T00:00:00Z',
            sources: [
              {
                id: 'superseded-2014-pdf',
                title: 'Superseded 2014 Regulation Snapshot',
                mime_type: 'application/pdf',
                resource: datedCmsPdfUrl,
                retrieved_at: '2026-11-15T09:00:00Z',
              },
              {
                id: 'active-authority-html',
                title: 'Consolidated Active Regulation Chapter 11',
                mime_type: 'text/html',
                resource: activeHtmlUrl,
                retrieved_at: '2026-11-15T09:00:00Z',
                last_modified: '2026-07-01T00:00:00Z',
              },
            ],
          },
          body:
            '# Requirements\n\nEscape routes must remain unobstructed[^superseded-2014-pdf]. Active smoke detection applies to all rooms[^active-authority-html].\n\n[^superseded-2014-pdf]: Superseded 2014 Regulation Snapshot\n[^active-authority-html]: Consolidated Active Regulation Chapter 11\n',
        });
        fs.writeFileSync(path.join(mcOutDir, 'research_summary.md'), mcInitialDoc, 'utf-8');

        // Step 1: Pre-Intermission Co-Architect machine curation (`trust_tier: machine-confirmed`, `status: draft` preserved)
        const mcStep1 = verifyOkfConcept(mcRunId, {
          workspaceRoot: mcWs,
          artifactDir: mcArtDir,
          by: 'icm-co-architect/gemini-4-argon',
          at: '2026-11-15T09:01:00Z',
          replaceSourceMap: { 'superseded-2014-pdf': 'active-authority-html' },
          rejectSourceIds: ['superseded-2014-pdf'],
        });
        const mcMetaAfter1 = JSON.parse(
          fs.readFileSync(path.join(mcWs, 'runs', mcRunId, 'meta.json'), 'utf-8')
        );
        const mcDocAfter1 = parseOkfDocument(
          fs.readFileSync(path.join(mcOutDir, 'research_summary.md'), 'utf-8')
        );
        assert(
          mcStep1.trust_tier === 'machine-confirmed' &&
            mcStep1.status === 'draft' &&
            mcDocAfter1.frontmatter.status === 'draft' &&
            mcMetaAfter1.status === 'stage1_completed' &&
            mcStep1.verified.length === 1 &&
            mcStep1.verified[0]?.by === 'icm-co-architect/gemini-4-argon' &&
            mcDocAfter1.frontmatter.sources?.length === 1 &&
            mcDocAfter1.frontmatter.sources?.[0]?.id === 'active-authority-html' &&
            !mcDocAfter1.body.includes('superseded-2014-pdf') &&
            Boolean(mcStep1.artifactHtmlPath) &&
            fs.existsSync(mcStep1.artifactHtmlPath!),
          'Pre-Intermission verifyOkfConcept (--by icm-co-architect/gemini-4-argon) re-anchors superseded sources, records machine-confirmed, preserves status: draft, and syncs artifactDir'
        );

        const mcStatusAfter1 = getIcmPipelineStatus({ workspaceRoot: mcWs, runId: mcRunId });
        const mcStatusFmtAfter1 = formatIcmPipelineStatus(mcStatusAfter1);
        assert(
          mcStatusAfter1.bundle.conceptCount === 1 &&
            mcStatusAfter1.bundle.humanReviewedCount === 0 &&
            mcStatusAfter1.bundle.machineConfirmedCount === 1 &&
            mcStatusAfter1.bundle.unverifiedCount === 0 &&
            mcStatusAfter1.runs[0]?.okfGateState === 'AWAITING REVIEW' &&
            mcStatusAfter1.runs[0]?.nextStepHint.includes('cli:verify') &&
            !mcStatusAfter1.runs[0]?.nextStepHint.includes('cli:stage2') &&
            mcStatusFmtAfter1.includes('1 machine-confirmed') &&
            mcStatusFmtAfter1.includes('[OKF Gate: AWAITING REVIEW (machine-curated)]'),
          'getIcmPipelineStatus & formatIcmPipelineStatus keep OKF Gate at AWAITING REVIEW (machine-curated) and prompt human sign-off (not Stage 2) on machine-confirmed Stage-1 drafts'
        );

        const mcSurfaceAfter1 = JSON.parse(
          fs.readFileSync(path.join(mcWs, 'runs', mcRunId, 'a2ui_surface.json'), 'utf-8')
        );
        const mcDmAfter1 = (mcSurfaceAfter1.messages || []).find((m: any) => m.updateDataModel)
          ?.updateDataModel?.value;
        assert(
          mcDmAfter1?.okf?.verifierActor === 'human:reviewer',
          'generateA2uiSurface keeps /okf/verifierActor reserved for human sign-off (never pre-filling machine actor icm-co-architect/gemini-4-argon)'
        );

        // Step 2: Human Intermission sign-off (`trust_tier: human-reviewed`, `status: stable` promoted, both audit entries preserved)
        const mcStep2 = verifyOkfConcept(mcRunId, {
          workspaceRoot: mcWs,
          artifactDir: mcArtDir,
          by: 'human:lead-auditor',
          at: '2026-11-15T09:05:00Z',
        });
        const mcMetaAfter2 = JSON.parse(
          fs.readFileSync(path.join(mcWs, 'runs', mcRunId, 'meta.json'), 'utf-8')
        );
        const mcSurfaceAfter2 = JSON.parse(
          fs.readFileSync(path.join(mcWs, 'runs', mcRunId, 'a2ui_surface.json'), 'utf-8')
        );
        const mcDmAfter2 = (mcSurfaceAfter2.messages || []).find((m: any) => m.updateDataModel)
          ?.updateDataModel?.value;
        assert(
          mcStep2.trust_tier === 'human-reviewed' &&
            mcStep2.status === 'stable' &&
            mcMetaAfter2.status === 'stage1_verified' &&
            mcStep2.verified.length === 2 &&
            mcStep2.verified[0]?.by === 'icm-co-architect/gemini-4-argon' &&
            mcStep2.verified[1]?.by === 'human:lead-auditor' &&
            mcDmAfter2?.okf?.verifierActor === 'human:lead-auditor',
          'Subsequent human verifyOkfConcept (--by human:lead-auditor) promotes status: stable, sets trust_tier: human-reviewed, updates /okf/verifierActor, and preserves the prior machine-confirmed entry in verified[]'
        );

        const mcStatusAfter2 = getIcmPipelineStatus({ workspaceRoot: mcWs, runId: mcRunId });
        const mcStatusFmtAfter2 = formatIcmPipelineStatus(mcStatusAfter2);
        assert(
          mcStatusAfter2.bundle.humanReviewedCount === 1 &&
            mcStatusAfter2.bundle.machineConfirmedCount === 0 &&
            mcStatusAfter2.runs[0]?.okfGateState === 'VERIFIED' &&
            mcStatusAfter2.runs[0]?.nextStepHint.includes('cli:stage2') &&
            mcStatusFmtAfter2.includes('[OKF Gate: VERIFIED]') &&
            !mcStatusFmtAfter2.includes('machine-confirmed'),
          'getIcmPipelineStatus & formatIcmPipelineStatus advance OKF Gate to VERIFIED and unlock Stage 2 after human sign-off'
        );

        // Verify SPEC.md §4.3 resource-bound Reference normalization + multi-word parenthetical publisher provenance + archive MIME inference
        fs.mkdirSync(path.join(mcWs, 'bundle/references'), { recursive: true });
        fs.writeFileSync(
          path.join(mcWs, 'bundle/references/statutes-open-data.md'),
          [
            '---',
            'type: Reference',
            'title: "Active Safety Statute Archive"',
            'description: "Official public Open Data statute archive."',
            'tags: [statutes, safety]',
            'status: stable',
            'resource: "https://api.example-registry.org/v1/publicData/active-statutes.tar.bz2"',
            'retrieved_at: "2026-11-15T10:00:00Z"',
            '---',
            '',
            '# Active Safety Statute Archive',
            '',
            'Verbatim statutory sections hydrated from Open Data.',
          ].join('\n'),
          'utf-8'
        );
        const refWalked = walkBundleConcepts(path.join(mcWs, 'bundle')).find((n) =>
          n.id.endsWith('statutes-open-data')
        );
        const refLayers = loadWorkspaceLayers(mcWs, 'Active Safety Standards');
        const refStatus = getIcmPipelineStatus({ workspaceRoot: mcWs });
        const refStatusItem = refStatus.bundle.concepts.find((c) =>
          c.relativePath.includes('statutes-open-data')
        );
        assert(
          inferSourceMimeTypeFromUrl(
            'https://api.example-registry.org/v1/publicData/active-statutes.tar.bz2'
          ) === 'application/x-bzip2' &&
            inferSourceMimeTypeFromUrl('https://data.example-registry.org/dump.tar.gz') ===
              'application/gzip' &&
            inferSourceMimeTypeFromUrl('https://data.example-registry.org/metrics.parquet') ===
              'application/vnd.apache.parquet' &&
            refWalked?.sources.length === 1 &&
            refWalked?.sources[0]?.mime_type === 'application/x-bzip2' &&
            refStatusItem?.sourcesCount === 1 &&
            refLayers.bundleContext.includes('Canonical Sources:') &&
            refLayers.bundleContext.includes('active-statutes.tar.bz2'),
          'Archive MIME inference (.tar.bz2/.tar.gz/.parquet) and SPEC.md §4.3 top-level resource Reference normalization work across walkBundleConcepts, loadWorkspaceLayers, and getIcmPipelineStatus'
        );

        const openDataParenProv = inspectSourceDomainProvenance({
          id: 'registry-safety-regulation',
          title: 'Fire Prevention Regulation – REG-2015-12-17-1710 (ExampleRegistry Open Data)',
          resource: 'https://api.exampleregistry.org/v1/publicData/central-regulations.tar.bz2',
        });
        const mirrorParenProv = inspectSourceDomainProvenance({
          id: 'registry-safety-regulation',
          title: 'Fire Prevention Regulation – REG-2015-12-17-1710 (ExampleRegistry Open Data)',
          resource: 'https://thirdparty-blog.net/uploads/central-regulations.pdf',
        });
        const pureStdCodeProv = inspectSourceDomainProvenance({
          id: 'iso-27001-overview',
          title: 'Information Security Standard – ISO 27001:2022',
          resource: 'https://standards-portal.org/guides/iso-27001',
        });
        assert(
          openDataParenProv.domainMismatch === false &&
            mirrorParenProv.domainMismatch === true &&
            pureStdCodeProv.domainMismatch === false,
          'inspectSourceDomainProvenance matches multi-word parenthetical publisher attributions on api./data. hosts and ignores pure formal standard codes while still flagging third-party mirrors'
        );

        // Multi-record Open-Data archive URL normalization & non-colliding deduplication
        const archiveWithFragA = normalizeCanonicalSourceUrl(
          'https://API.ExampleRegistry.org/v1/publicData/get/active-regulations.tar.bz2#sf\\reg-2015-1710.xml'
        );
        const archiveWithFragB = normalizeCanonicalSourceUrl(
          'https://api.exampleregistry.org/v1/publicData/get/active-regulations.tar.bz2#sf/reg-2017-840.xml'
        );
        const htmlWithHash = normalizeCanonicalSourceUrl(
          'https://www.exampleregistry.org/guidance/overview#section-2'
        );
        assert(
          isMultiRecordArchiveUrl(archiveWithFragA) &&
            archiveWithFragA ===
              'https://api.exampleregistry.org/v1/publicData/get/active-regulations.tar.bz2#sf/reg-2015-1710.xml' &&
            archiveWithFragA !== archiveWithFragB &&
            htmlWithHash === 'https://exampleregistry.org/guidance/overview',
          'normalizeCanonicalSourceUrl preserves normalized #<entry-path> fragments on multi-record archives while stripping #hash anchors on single-document pages'
        );

        const sharedBareArchiveUrl =
          'https://api.exampleregistry.org/v1/publicData/get/active-regulations.tar.bz2';
        const multiArchiveBundleDir = path.join(tmpMachineCurateRoot, 'multi-archive-ws', 'bundle');
        fs.mkdirSync(path.join(multiArchiveBundleDir, 'references'), { recursive: true });
        fs.writeFileSync(
          path.join(multiArchiveBundleDir, 'references', 'reg-short-safety.md'),
          [
            '---',
            'type: Reference',
            'title: Safety Prevention Rule',
            'status: stable',
            'sources:',
            '  - id: reg-short-safety',
            `    resource: ${sharedBareArchiveUrl}`,
            '    title: Safety Prevention Rule',
            '    mime_type: application/xml',
            '    retrieved_at: 2026-11-15T10:00:00Z',
            '    last_modified: 2026-11-10T00:00:00Z',
            '---',
            '# Safety Prevention Rule',
            'Primary duties[^reg-short-safety].',
            '',
            '[^reg-short-safety]: Safety Prevention Rule',
          ].join('\n'),
          'utf-8'
        );
        fs.writeFileSync(
          path.join(multiArchiveBundleDir, 'references', 'reg-long-technical-code.md'),
          [
            '---',
            'type: Reference',
            'title: Regulation on Technical Structural Requirements (Technical Building Code)',
            'status: stable',
            'sources:',
            '  - id: reg-long-technical-code',
            `    resource: ${sharedBareArchiveUrl}`,
            '    title: Regulation on Technical Structural Requirements (Technical Building Code)',
            '    mime_type: application/xml',
            '    retrieved_at: 2026-11-15T10:00:00Z',
            '    last_modified: 2026-11-14T00:00:00Z',
            '---',
            '# Technical Building Code',
            'Risk classes[^reg-long-technical-code].',
            '',
            '[^reg-long-technical-code]: Regulation on Technical Structural Requirements (Technical Building Code)',
          ].join('\n'),
          'utf-8'
        );

        const rawMultiArchiveDraft = [
          '---',
          'type: Regulatory Guide',
          'title: Combined Compliance Overview',
          'status: draft',
          'sources:',
          '  - id: reg-short-safety',
          `    resource: ${sharedBareArchiveUrl}`,
          '    title: Safety Prevention Rule',
          '    mime_type: application/xml',
          '  - id: reg-long-technical-code',
          `    resource: ${sharedBareArchiveUrl}`,
          '    title: Regulation on Technical Structural Requirements (Technical Building Code)',
          '    mime_type: application/xml',
          '  - id: reg-short-safety-dup',
          `    resource: ${sharedBareArchiveUrl}`,
          '    title: Safety Prevention Rule',
          '    mime_type: application/xml',
          '---',
          '# Combined Compliance Overview',
          '',
          'Systematic duties follow the safety rule[^reg-short-safety] and duplicate ref[^reg-short-safety-dup], while building design follows the technical code[^reg-long-technical-code].',
        ].join('\n');

        const cleanedMultiArchiveMd = await cleanGroundingLinks(rawMultiArchiveDraft, [], {
          bundleRoot: multiArchiveBundleDir,
        });
        const cleanedMultiDoc = parseOkfDocument(cleanedMultiArchiveMd);
        const cleanedShortSrc = (cleanedMultiDoc.frontmatter.sources || []).find(
          (s) => s.id === 'reg-short-safety'
        );
        const cleanedLongSrc = (cleanedMultiDoc.frontmatter.sources || []).find(
          (s) => s.id === 'reg-long-technical-code'
        );
        const mergedMultiDoc = mergeConceptDocuments(
          {
            frontmatter: {
              type: 'Regulatory Guide',
              title: 'Combined Compliance Overview',
              status: 'draft',
              sources: [cleanedShortSrc!],
            },
            body: 'Systematic duties[^reg-short-safety].\n\n[^reg-short-safety]: Safety Prevention Rule\n',
          },
          cleanedMultiDoc
        );
        const curatedMulti = curateOkfSources(cleanedMultiArchiveMd, {
          addSources: [
            {
              id: 'reg-third-statute',
              url: sharedBareArchiveUrl,
              title: 'Workplace Environment Act',
              mime_type: 'application/xml',
            },
          ],
        });
        const curatedMultiDoc = parseOkfDocument(curatedMulti.markdown);
        assert(
          getCanonicalSourceDedupeKeys(sharedBareArchiveUrl, 'reg-short-safety', 'Safety Prevention Rule').length === 2 &&
            (cleanedMultiDoc.frontmatter.sources || []).length === 2 &&
            cleanedShortSrc?.title === 'Safety Prevention Rule' &&
            cleanedShortSrc?.last_modified === '2026-11-10T00:00:00Z' &&
            cleanedLongSrc?.title ===
              'Regulation on Technical Structural Requirements (Technical Building Code)' &&
            cleanedLongSrc?.last_modified === '2026-11-14T00:00:00Z' &&
            cleanedMultiDoc.body.includes('[^reg-short-safety]') &&
            cleanedMultiDoc.body.includes('[^reg-long-technical-code]') &&
            !cleanedMultiDoc.body.includes('[^reg-short-safety-dup]') &&
            (mergedMultiDoc.frontmatter.sources || []).length === 2 &&
            (curatedMultiDoc.frontmatter.sources || []).length === 3,
          'cleanGroundingLinks, mergeConceptDocuments, and curateOkfSources keep distinct records sharing a bare bulk archive URL separate without overwriting shorter titles while still deduplicating genuine duplicates'
        );
      } finally {
        fs.rmSync(tmpMachineCurateRoot, { recursive: true, force: true });
      }

      // Verify prompts/01_research.md expands {{bundleContext}} at most once (no literal prose echo)
      const stage1PromptDiskPath = path.resolve(
        fileURLToPath(new URL('../..', import.meta.url)),
        'prompts/01_research.md'
      );
      const stage1PromptRaw = fs.readFileSync(stage1PromptDiskPath, 'utf-8');
      const bundleContextMatches = stage1PromptRaw.match(/\{\{\s*bundleContext\s*\}\}/g) || [];
      assert(
        bundleContextMatches.length === 1,
        `prompts/01_research.md references {{bundleContext}} exactly once (found ${bundleContextMatches.length})`
      );
    }
  } finally {
    fs.rmSync(tmpStage1ReviewDir, { recursive: true, force: true });
  }

  // Modular ICM `src/` Architecture Invariants:
  // 1) `src/CONTEXT.md` + every `src/<subsystem>/CONTEXT.md` exists and documents all owned source/asset files
  // 2) Standalone client `.css`/`.js` assets exist on disk and parse as valid JS without escaping corruption
  // 3) Strict one-way topological subsystem DAG (`0` circular or upward cross-package imports)
  {
    const srcRootDir = fileURLToPath(new URL('..', import.meta.url));
    const rootContextPath = path.join(srcRootDir, 'CONTEXT.md');
    assert(fs.existsSync(rootContextPath), 'src/CONTEXT.md master routing map exists');
    const rootContextText = fs.readFileSync(rootContextPath, 'utf-8');

    const subsystems = ['interactions', 'okf', 'viz', 'a2ui', 'ops', 'pipeline', 'tests'] as const;
    const allowedPkgDeps: Record<string, Set<string>> = {
      interactions: new Set(),
      okf: new Set(['interactions']),
      viz: new Set(['interactions', 'okf']),
      a2ui: new Set(['interactions', 'okf', 'viz']),
      ops: new Set(['okf', 'viz', 'a2ui']),
      pipeline: new Set(['interactions', 'okf', 'viz', 'a2ui']),
      tests: new Set(['interactions', 'okf', 'viz', 'a2ui', 'ops', 'pipeline']),
    };

    let missingChunkDoc: string | null = null;
    let illegalDepEdge: string | null = null;

    for (const sub of subsystems) {
      const subDir = path.join(srcRootDir, sub);
      const subCtxPath = path.join(subDir, 'CONTEXT.md');
      if (!fs.existsSync(subCtxPath) || !rootContextText.includes(`${sub}/CONTEXT.md`)) {
        missingChunkDoc = `${sub}/CONTEXT.md`;
        break;
      }
      const subCtxText = fs.readFileSync(subCtxPath, 'utf-8');

      const walkRel = (dir: string, prefix = ''): string[] => {
        const out: string[] = [];
        for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
          const rel = prefix ? `${prefix}/${ent.name}` : ent.name;
          const abs = path.join(dir, ent.name);
          if (ent.isDirectory()) out.push(...walkRel(abs, rel));
          else out.push(rel);
        }
        return out;
      };

      for (const relFile of walkRel(subDir)) {
        if (relFile === 'CONTEXT.md') continue;
        if (!subCtxText.includes(relFile)) {
          missingChunkDoc = `src/${sub}/${relFile} not documented in src/${sub}/CONTEXT.md`;
          break;
        }
        if (relFile.endsWith('.ts')) {
          const tsText = fs.readFileSync(path.join(subDir, relFile), 'utf-8');
          const importRe = /from\s+['"](\.\.\/([a-z0-9_-]+)\/[^'"]+)['"]/gi;
          let m: RegExpExecArray | null;
          while ((m = importRe.exec(tsText)) !== null) {
            const targetPkg = m[2];
            if (!allowedPkgDeps[sub]?.has(targetPkg)) {
              illegalDepEdge = `src/${sub}/${relFile} -> ${m[1]}`;
              break;
            }
          }
        }
      }
      if (missingChunkDoc || illegalDepEdge) break;
    }

    let clientJsSyntaxValid = false;
    try {
      const studioJsDisk = fs.readFileSync(path.join(srcRootDir, 'a2ui', 'client', 'studio.js'), 'utf-8');
      const vizJsDisk = fs.readFileSync(path.join(srcRootDir, 'viz', 'client', 'viz.js'), 'utf-8');
      const studioCssDisk = fs.readFileSync(path.join(srcRootDir, 'a2ui', 'client', 'studio.css'), 'utf-8');
      const vizCssDisk = fs.readFileSync(path.join(srcRootDir, 'viz', 'client', 'viz.css'), 'utf-8');
      // Compile without executing to verify pure standalone JS syntax
      new Function(studioJsDisk);
      new Function(vizJsDisk);
      clientJsSyntaxValid = studioCssDisk.length > 500 && vizCssDisk.length > 500;
    } catch {
      clientJsSyntaxValid = false;
    }

    assert(
      missingChunkDoc === null && illegalDepEdge === null && clientJsSyntaxValid,
      `Modular ICM src/ invariants hold (missingChunkDoc=${missingChunkDoc}, illegalDepEdge=${illegalDepEdge}, clientJsSyntaxValid=${clientJsSyntaxValid})`
    );
  }

  // Stage 4 Voice Design Lock (`/v1beta/voices`), `speech_metadata.style` Anti-Drift Sanitizer & Custom-Voice Stitching
  {
    const tmpVoiceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'icm-voice-lock-'));
    const origFetch = globalThis.fetch;
    const origApiKey = process.env.GEMINI_API_KEY;
    process.env.GEMINI_API_KEY = origApiKey || 'test-mock-key';
    try {
      const promptPath = path.join(tmpVoiceDir, '04_audio.md');
      fs.writeFileSync(
        promptPath,
        [
          '---',
          'model: gemini-3.8-flash-tts',
          'voice: "Kore"',
          'languageCode: "nb-no"',
          'voiceLock: true',
          'voiceDesignPrompt: "Warm studio narrator with consistent standard regional pronunciation."',
          'primaryVoiceDesignPrompt: "Primary host with crisp standard studio pronunciation."',
          'secondaryVoiceDesignPrompt: "Secondary specialist with calm steady pronunciation."',
          'audioMimeType: "audio/wav"',
          'sampleRate: 24000',
          'output:',
          '  format: audio',
          '---',
          'Calm, warm, reassuring instructional studio pacing.',
        ].join('\n'),
        'utf-8'
      );
      const parsedContract = loadStagePromptContract('04_audio', tmpVoiceDir);
      assert(
        parsedContract.languageCode === 'nb-no' &&
          parsedContract.voiceLock === true &&
          parsedContract.voiceDesignPrompt ===
            'Warm studio narrator with consistent standard regional pronunciation.' &&
          parsedContract.primaryVoiceDesignPrompt ===
            'Primary host with crisp standard studio pronunciation.' &&
          parsedContract.secondaryVoiceDesignPrompt ===
            'Secondary specialist with calm steady pronunciation.' &&
          resolveStage4LanguageCode(parsedContract.languageCode, 'en') === 'nb-NO' &&
          resolveStage4LanguageCode(undefined, 'no') === 'nb-NO' &&
          resolveStage4LanguageCode(undefined, 'en') === 'en-US' &&
          inferBcp47LanguageCode('Mindestens 50 % der Fläche sind für die Sicherheit und nicht auf dem Flur.') === 'de-DE' &&
          inferBcp47LanguageCode('Detta är en genomgång av verksamheten och underhåll från början.') === 'sv-SE' &&
          inferBcp47LanguageCode('Dette bliver vurderet af virksomheden for arbejdsmiljø og sikkerhed.') === 'da-DK' &&
          inferBcp47LanguageCode('Korleis verksemda ikkje skal fråvike ein eller eit krav mellom avdelingar.') === 'nn-NO' &&
          inferBcp47LanguageCode('Hvordan virksomheten ikke skal fravike krav mellom avdelinger på stedet.') === 'nb-NO' &&
          inferBcp47LanguageCode('Los sistemas de energía para las instalaciones con más capacidad.') === 'es-ES' &&
          inferBcp47LanguageCode('蓄電池システムの設計と安全基準についての概要です。') === 'ja-JP' &&
          detectIcmLanguage('Detta är en genomgång av verksamheten och underhåll från början.') === 'sv' &&
          prepareTextForStudioTts('**Hinweis:** Mindestens 50 % auf 120 m² bei 20 °C gemäß § 12.', 'de-DE') ===
            'Hinweis. Mindestens 50 % auf 120 m² bei 20 °C gemäß § 12.',
        'loadStagePromptContract, inferBcp47LanguageCode & prepareTextForStudioTts work abstractly across world languages without injecting English words into non-English prose'
      );

      const bloatedStyle = [
        'Deliver "Module 3: Prevention" (Course Title) in natural, clear, warm studio narration.',
        '# Layer 3: Brand Voice & Pacing Guide (`voice_guide.md`)',
        '- **Language & Register:** Write in clear prose.',
        '- **Zero Reference Leakage:** Never include raw URLs.',
      ].join('\n');
      const sanitizedStyle = sanitizeTtsStyleInstruction(bloatedStyle);
      assert(
        sanitizedStyle === 'natural, clear, warm studio narration.' &&
          sanitizedStyle.length <= 140 &&
          !sanitizedStyle.includes('Layer 3') &&
          !sanitizedStyle.includes('Module 3') &&
          isCustomVoiceId('voice_1gimkh2ahr6y') &&
          isCustomVoiceId('voicekey_abc_123') &&
          !isCustomVoiceId('Kore') &&
          isPrebuiltStudioVoiceName('Kore') &&
          !isPrebuiltStudioVoiceName('ko-kr-advisor-1') &&
          buildDefaultVoiceLockPrompt('Kore', 'nb-NO').includes('Urban East Norwegian') &&
          computeVoiceLockFingerprint({
            model: GEMINI_FLASH_TTS_MODEL,
            baseVoice: 'Kore',
            languageCode: 'nb-NO',
            voiceDesignPrompt: 'Warm steady voice',
          }).length === 16,
        'sanitizeTtsStyleInstruction strips multi-bullet voice_guide Markdown and module titles to prevent Gemini 3.8 TTS dialect drift'
      );

      let createVoiceCalls = 0;
      let getVoiceCalls = 0;
      let interactionsCalls = 0;
      const sampleWav = wrapPcm16InWavHeader(Buffer.alloc(4800, 0), 24000, 1);

      globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
        const reqUrl = String(input);
        const method = (init?.method || 'GET').toUpperCase();
        if (reqUrl === VOICES_API_URL && method === 'POST') {
          createVoiceCalls++;
          return new Response(
            JSON.stringify({
              id: 'voice_mocklocked01',
              display_name: 'Kore (nb-NO Studio Lock)',
              language_code: 'nb-NO',
              expire_time: '2027-11-17T00:00:00Z',
              sample_audio: { mime_type: 'audio/wav', data: sampleWav.toString('base64') },
              usage: {
                total_input_tokens: 200,
                total_thought_tokens: 100,
                total_output_tokens: 150,
                total_tokens: 450,
              },
            }),
            { status: 200, headers: { 'content-type': 'application/json' } }
          );
        }
        if (reqUrl === `${VOICES_API_URL}/voice_mocklocked01` && method === 'GET') {
          getVoiceCalls++;
          return new Response(
            JSON.stringify({ id: 'voice_mocklocked01', type: 'prompted' }),
            { status: 200, headers: { 'content-type': 'application/json' } }
          );
        }
        if (reqUrl.includes('/v1beta/interactions') && method === 'POST') {
          interactionsCalls++;
          const reqBody = JSON.parse(String(init?.body || '{}'));
          const sc = reqBody?.generation_config?.speech_config;
          assert(
            Array.isArray(sc) && sc.length === 1 && sc[0].language === 'nb-NO',
            'Custom locked voice synthesis sends single-speaker speech_config with explicit language tag'
          );
          return new Response(
            JSON.stringify({
              id: `inter_${interactionsCalls}`,
              status: 'completed',
              steps: [
                {
                  type: 'model_output',
                  content: [
                    { type: 'audio', mime_type: 'audio/wav', data: sampleWav.toString('base64') },
                  ],
                },
              ],
              usage: { total_input_tokens: 50, total_output_tokens: 100, total_tokens: 150 },
            }),
            { status: 200, headers: { 'content-type': 'application/json' } }
          );
        }
        throw new Error(`Unexpected mock fetch: ${method} ${reqUrl}`);
      }) as typeof fetch;

      const locksPath = path.join(tmpVoiceDir, '_config', 'voice_locks.json');
      const previewPath = path.join(tmpVoiceDir, 'preview.wav');
      const firstLock = await ensureWorkspaceLockedVoice({
        locksFilePath: locksPath,
        baseVoice: 'Kore',
        languageCode: 'nb-NO',
        voiceDesignPrompt: buildDefaultVoiceLockPrompt('Kore', 'nb-NO'),
        samplePreviewOutPath: previewPath,
      });
      const secondLock = await ensureWorkspaceLockedVoice({
        locksFilePath: locksPath,
        baseVoice: 'Kore',
        languageCode: 'nb-NO',
        voiceDesignPrompt: buildDefaultVoiceLockPrompt('Kore', 'nb-NO'),
      });

      const stitchedMulti = await generateFlashTtsAudioInteraction({
        turns: [
          { speaker: 'Host', voice: 'voice_mocklocked01', text: 'First speaker turn.' },
          { speaker: 'Guest', voice: 'voice_mocklocked02', text: 'Second speaker turn.' },
        ],
        speakers: [
          { speaker: 'Host', voice: 'voice_mocklocked01' },
          { speaker: 'Guest', voice: 'voice_mocklocked02' },
        ],
        languageCode: 'nb-NO',
        sampleRate: 24000,
      });
      const stitchedMeta = parseWavMetadata(stitchedMulti.audioBuffer);

      assert(
        firstLock.voiceId === 'voice_mocklocked01' &&
          firstLock.cached === false &&
          firstLock.usage.totalTokens === 450 &&
          fs.existsSync(locksPath) &&
          fs.existsSync(previewPath) &&
          secondLock.voiceId === 'voice_mocklocked01' &&
          secondLock.cached === true &&
          secondLock.usage.totalTokens === 0 &&
          createVoiceCalls === 1 &&
          getVoiceCalls === 1 &&
          interactionsCalls === 2 &&
          stitchedMeta.isWav &&
          stitchedMeta.sampleRate === 24000 &&
          stitchedMulti.usage.totalTokens === 300,
        'ensureWorkspaceLockedVoice caches /v1beta/voices locks across runs and generateFlashTtsAudioInteraction stitches multi-speaker custom voice_... turns seamlessly'
      );
    } finally {
      globalThis.fetch = origFetch;
      if (origApiKey === undefined) delete process.env.GEMINI_API_KEY;
      else process.env.GEMINI_API_KEY = origApiKey;
      fs.rmSync(tmpVoiceDir, { recursive: true, force: true });
    }
  }

  // Stage 4 Role-Matched Dual-Voice Director (`dialogueMode: "semantic"`, `primaryRole`, `secondaryRole`)
  {
    const tmpRoleDir = fs.mkdtempSync(path.join(os.tmpdir(), 'icm-role-voice-'));
    const origFetch = globalThis.fetch;
    const origApiKey = process.env.GEMINI_API_KEY;
    process.env.GEMINI_API_KEY = origApiKey || 'test-mock-key';
    try {
      fs.writeFileSync(
        path.join(tmpRoleDir, '04_audio_semantic.md'),
        [
          '---',
          'model: gemini-3.8-flash-tts',
          'dialogueMode: "semantic"',
          'primarySpeaker: "Guide"',
          'primaryVoice: "Sulafat"',
          'primaryRole: "Warm pedagogical guide for everyday context and takeaways."',
          'secondarySpeaker: "Specialist"',
          'secondaryVoice: "Charon"',
          'secondaryRole: "Serious regulatory and hazard specialist for binding rules."',
          'output:',
          '  format: audio',
          '---',
          'Calm, clear studio pacing.',
        ].join('\n'),
        'utf-8'
      );
      const roleContract = loadStagePromptContract('04_audio_semantic', tmpRoleDir);

      const multiParaText = [
        'Every morning starts with a busy team welcoming colleagues and visitors into the building in a calm, friendly routine.',
        'Under section 11 and ISO safety standards, the facility owner bears mandatory legal liability for maintaining emergency evacuation routes and fire alarm integrity.',
        'Any obstruction of critical emergency exits is strictly prohibited under statutory supervision and triggers immediate compliance sanctions.',
      ].join('\n\n');

      const semanticTurns = segmentStage4DialogueTurns({
        slotKind: 'module',
        title: 'Facility Safety & Duties',
        spokenText: multiParaText,
        actionItem: 'Walk your corridor with the team this Friday to confirm clear access.',
        lang: 'en-US',
        dialogueMode: 'semantic',
        primarySpeaker: 'Guide',
        primaryVoice: 'Sulafat',
        secondarySpeaker: 'Specialist',
        secondaryVoice: 'Charon',
      });

      const ssePayload = [
        `data: ${JSON.stringify({
          event_type: 'interaction.completed',
          interaction: {
            id: 'inter_director_01',
            status: 'completed',
            steps: [
              {
                type: 'model_output',
                content: [
                  {
                    type: 'text',
                    text: JSON.stringify({
                      slots: [
                        {
                          slotId: 'module_01',
                          blocks: [
                            { blockIndex: 0, speakerRole: 'primary', rationale: 'Everyday morning framing' },
                            { blockIndex: 1, speakerRole: 'secondary', rationale: 'Mandatory statutory liability' },
                            { blockIndex: 2, speakerRole: 'secondary', rationale: 'Emergency exit prohibition' },
                            { blockIndex: 3, speakerRole: 'primary', rationale: 'Practical team action item' },
                          ],
                        },
                      ],
                    }),
                  },
                ],
              },
            ],
            usage: { total_input_tokens: 180, total_thought_tokens: 40, total_output_tokens: 90, total_tokens: 310 },
          },
        })}\n\n`,
      ].join('');

      globalThis.fetch = (async () =>
        new Response(ssePayload, {
          status: 200,
          headers: { 'content-type': 'text/event-stream' },
        })) as typeof fetch;

      const directed = await directSemanticDualVoiceAssignment({
        courseTitle: 'Safety Program',
        primarySpeaker: 'Guide',
        primaryRole: roleContract.primaryRole || '',
        secondarySpeaker: 'Specialist',
        secondaryRole: roleContract.secondaryRole || '',
        slots: [
          {
            slotId: 'module_01',
            slotKind: 'module',
            title: 'Facility Safety & Duties',
            blocks: [
              { kind: 'narration', text: 'Opening context.' },
              { kind: 'narration', text: 'Mandatory section 11 rule.' },
              { kind: 'narration', text: 'Critical emergency exit rule.' },
              { kind: 'actionItem', text: 'Walk the corridor.' },
            ],
          },
        ],
      });
      const slotRoles = directed.assignmentsBySlot.get('module_01')?.map((a) => a.speakerRole) || [];

      assert(
        roleContract.dialogueMode === 'semantic' &&
          roleContract.primaryRole?.includes('Warm pedagogical guide') &&
          roleContract.secondaryRole?.includes('Serious regulatory') &&
          classifyBlockRegisterHeuristic('Everyday welcoming team routine in the morning.', 'narration') === 'primary' &&
          classifyBlockRegisterHeuristic('Under § 11, mandatory evacuation compliance and legal liability apply.', 'narration') === 'secondary' &&
          classifyBlockRegisterHeuristic('Check § 11 posters with staff.', 'actionItem') === 'primary' &&
          semanticTurns.length === 3 &&
          semanticTurns[0].speaker === 'Guide' &&
          semanticTurns[1].speaker === 'Specialist' &&
          semanticTurns[1].text.includes('mandatory legal liability') &&
          semanticTurns[1].text.includes('strictly prohibited') &&
          semanticTurns[2].speaker === 'Guide' &&
          slotRoles.join(',') === 'primary,secondary,secondary,primary' &&
          directed.usage.totalTokens === 310,
        'Role-Matched Dual-Voice Director routes pedagogical vs. serious/statutory blocks and merges consecutive same-speaker turns cleanly'
      );
    } finally {
      globalThis.fetch = origFetch;
      if (origApiKey === undefined) delete process.env.GEMINI_API_KEY;
      else process.env.GEMINI_API_KEY = origApiKey;
      fs.rmSync(tmpRoleDir, { recursive: true, force: true });
    }
  }

  // Verify `cleanGroundingLinks` never splits `[label](url)` Markdown links when grounding byte offsets land mid-link or between `]` and `(`
  {
    const mdLinkDraft = [
      '---',
      'type: Research Concept',
      'title: Link Snapping Check',
      'status: draft',
      'sources: []',
      '---',
      'System duties follow [Internal Control Regulation](/references/internal-control.md) § 5 and [Health and Environment Code](/references/health-env.md) § 18.',
    ].join('\n');
    const firstWordEnd = Buffer.byteLength(
      mdLinkDraft.slice(0, mdLinkDraft.indexOf('[Internal Control Regulation]') + '[Internal Control Regulation'.length),
      'utf8'
    );
    const midSecondLabelEnd = Buffer.byteLength(
      mdLinkDraft.slice(0, mdLinkDraft.indexOf('[Health and') + '[Health'.length),
      'utf8'
    );
    const snappedMd = await cleanGroundingLinks(mdLinkDraft, [
      {
        type: 'model_output',
        content: [
          {
            type: 'text',
            text: mdLinkDraft,
            annotations: [
              {
                type: 'url_citation',
                start_index: firstWordEnd - 10,
                end_index: firstWordEnd,
                url: 'https://authority.example.gov/internal-control',
                title: 'Authority Guidance',
              },
              {
                type: 'url_citation',
                start_index: midSecondLabelEnd - 5,
                end_index: midSecondLabelEnd,
                url: 'https://authority.example.gov/internal-control',
                title: 'Authority Guidance',
              },
            ],
          },
        ],
      },
    ]);
    assert(
      snappedMd.includes('[Internal Control Regulation](/references/internal-control.md)[^authority-guidance] § 5') &&
        snappedMd.includes('[Health and Environment Code](/references/health-env.md)[^authority-guidance] § 18') &&
        !snappedMd.includes('][^authority-guidance]('),
      'cleanGroundingLinks snaps byte-offset footnotes past closing `)` of `[label](url)` Markdown links without splitting bundle links'
    );
  }

  // Verify Stage 4 telemetry breakdown (`ttsTokens`, `directorTokens`, `voiceLockTokens`) & `getIcmPipelineStatus` `voice_reference_*` filtering
  {
    const tmpStage4Ws = fs.mkdtempSync(path.join(os.tmpdir(), 'icm-stage4-tel-'));
    const origFetch = globalThis.fetch;
    const origApiKey = process.env.GEMINI_API_KEY;
    process.env.GEMINI_API_KEY = origApiKey || 'test-mock-key';
    try {
      const wsDir = path.join(tmpStage4Ws, 'workspace');
      const promptsDir = path.join(tmpStage4Ws, 'prompts');
      const runId = 'telemetry-breakdown-1795000001000';
      const runDir = path.join(wsDir, 'runs', runId);
      const s1Out = path.join(runDir, 'stages', '01_research', 'output');
      const s2Out = path.join(runDir, 'stages', '02_script', 'output');
      const s4Out = path.join(runDir, 'stages', '04_audio', 'output');
      fs.mkdirSync(promptsDir, { recursive: true });
      fs.mkdirSync(s1Out, { recursive: true });
      fs.mkdirSync(s2Out, { recursive: true });
      fs.mkdirSync(s4Out, { recursive: true });

      fs.writeFileSync(
        path.join(s1Out, 'research_summary.md'),
        [
          '---',
          'type: Regulatory Guide',
          'title: Safety Program',
          'status: stable',
          'verified:',
          '  - by: human:reviewer',
          '    at: "2026-11-17T10:00:00Z"',
          'sources:',
          '  - id: auth-1',
          '    title: Official Safety Code',
          '    resource: https://authority.example.gov/code',
          '---',
          'Mandatory evacuation rules apply[^auth-1].',
          '',
          '[^auth-1]: Official Safety Code',
        ].join('\n'),
        'utf-8'
      );
      fs.writeFileSync(
        path.join(s2Out, 'script_draft.json'),
        JSON.stringify({
          title: 'Safety Program',
          scriptBody:
            'Welcome to the daily team briefing.\n\nUnder § 11, mandatory evacuation routes must remain clear at all times.',
        }),
        'utf-8'
      );
      fs.writeFileSync(path.join(s4Out, 'voice_reference_sulafat.wav'), Buffer.alloc(64, 0));

      // Before real tracks exist, `voice_reference_*.wav` alone must NOT mark `04_audio` COMPLETE
      const preStatus = getIcmPipelineStatus({ workspaceRoot: wsDir, runId });
      const preAudioNode = preStatus.runs[0]?.downstreamStages.find((d) => d.stageName === '04_audio');

      fs.writeFileSync(
        path.join(promptsDir, '04_audio.md'),
        [
          '---',
          'model: gemini-3.8-flash-tts',
          'languageCode: "de-DE"',
          'dialogueMode: "semantic"',
          'primarySpeaker: "Guide"',
          'primaryVoice: "Sulafat"',
          'primaryRole: "Warm everyday guide."',
          'secondarySpeaker: "Specialist"',
          'secondaryVoice: "Charon"',
          'secondaryRole: "Calm regulatory specialist."',
          'output:',
          '  format: audio',
          '---',
          'Calm, clear studio delivery.',
        ].join('\n'),
        'utf-8'
      );

      const sampleWav = wrapPcm16InWavHeader(Buffer.alloc(4800, 0), 24000, 1);
      let lockIdx = 0;
      globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
        const reqUrl = String(input);
        const method = (init?.method || 'GET').toUpperCase();
        if (reqUrl === VOICES_API_URL && method === 'POST') {
          lockIdx++;
          return new Response(
            JSON.stringify({
              id: `voice_locked0${lockIdx}`,
              sample_audio: { mime_type: 'audio/wav', data: sampleWav.toString('base64') },
              usage: { total_input_tokens: 100, total_thought_tokens: 50, total_output_tokens: 50, total_tokens: 200 },
            }),
            { status: 200, headers: { 'content-type': 'application/json' } }
          );
        }
        if (reqUrl.includes('/v1beta/interactions') && method === 'POST') {
          const bodyObj = JSON.parse(String(init?.body || '{}'));
          if (bodyObj.model === GEMINI_4_ARGON_MODEL) {
            const sse = `data: ${JSON.stringify({
              event_type: 'interaction.completed',
              interaction: {
                id: 'inter_dir_tel',
                status: 'completed',
                steps: [
                  {
                    type: 'model_output',
                    content: [
                      {
                        type: 'text',
                        text: JSON.stringify({
                          slots: [
                            {
                              slotId: 'overview',
                              blocks: [
                                { blockIndex: 0, speakerRole: 'primary', rationale: 'Warm intro' },
                                { blockIndex: 1, speakerRole: 'secondary', rationale: 'Statutory mandate' },
                              ],
                            },
                          ],
                        }),
                      },
                    ],
                  },
                ],
                usage: { total_input_tokens: 120, total_thought_tokens: 30, total_output_tokens: 50, total_tokens: 200 },
              },
            })}\n\n`;
            return new Response(sse, { status: 200, headers: { 'content-type': 'text/event-stream' } });
          }
          return new Response(
            JSON.stringify({
              id: 'inter_tts_tel',
              status: 'completed',
              steps: [
                {
                  type: 'model_output',
                  content: [{ type: 'audio', mime_type: 'audio/wav', data: sampleWav.toString('base64') }],
                },
              ],
              usage: { total_input_tokens: 40, total_thought_tokens: 0, total_output_tokens: 110, total_tokens: 150 },
            }),
            { status: 200, headers: { 'content-type': 'application/json' } }
          );
        }
        throw new Error(`Unexpected Stage 4 telemetry mock fetch: ${method} ${reqUrl}`);
      }) as typeof fetch;

      await runStage4Flow({ workspaceRoot: wsDir, promptDir: promptsDir, runId });

      const postMeta = JSON.parse(fs.readFileSync(path.join(runDir, 'meta.json'), 'utf-8'));
      const postManifest = JSON.parse(fs.readFileSync(path.join(s4Out, 'audio_manifest.json'), 'utf-8'));
      const postTrace = fs.readFileSync(path.join(s4Out, 'thinking_trace.md'), 'utf-8');
      const postStatus = getIcmPipelineStatus({ workspaceRoot: wsDir, runId });
      const postAudioNode = postStatus.runs[0]?.downstreamStages.find((d) => d.stageName === '04_audio');

      // 2 TTS turn calls (2 * 150 = 300) + 1 Director call (200) + 2 Voice Lock calls (2 * 200 = 400) = 900 total
      assert(
        preAudioNode?.state === 'PENDING' &&
          preAudioNode.outputFiles.length === 0 &&
          postAudioNode?.state === 'COMPLETE' &&
          postAudioNode.outputFiles.every((f) => !f.startsWith('voice_reference_')) &&
          postMeta.stage4Telemetry.ttsTokens === 300 &&
          postMeta.stage4Telemetry.directorTokens === 200 &&
          postMeta.stage4Telemetry.voiceLockTokens === 400 &&
          postMeta.stage4Telemetry.totalTokens === 900 &&
          postManifest.ttsTokens === 300 &&
          postManifest.directorTokens === 200 &&
          postManifest.voiceLockTokens === 400 &&
          postManifest.totalTokens === 900 &&
          postTrace.includes('900 (tts=300, director=200, voiceLock=400)'),
        'runStage4Flow records explicit ttsTokens/directorTokens/voiceLockTokens breakdown and getIcmPipelineStatus ignores voice_reference_* preview files'
      );
    } finally {
      globalThis.fetch = origFetch;
      if (origApiKey === undefined) delete process.env.GEMINI_API_KEY;
      else process.env.GEMINI_API_KEY = origApiKey;
      fs.rmSync(tmpStage4Ws, { recursive: true, force: true });
    }
  }

  // Permanent Engine Domain-Neutrality Gate (`src/` outside `src/tests/`) & `injectBidirectionalBundleLinks` Language Guard
  {
    const srcRootForLeakCheck = path.resolve(import.meta.dirname, '..');
    const leakedEngineHits: string[] = [];
    const forbiddenEngineRe = new RegExp(
      '(?:' +
        [
          '\\bbr' + 'ann\\w*',
          '\\bbarne' + 'hag\\w*',
          '\\bhuman:st' + 'yrer\\b',
          '\\blov' + 'data\\w*',
          '\\bgjeldende-lover\\b',
          '\\bdsb\\b',
          '\\bdibk\\b',
          '\\budir\\b',
          '\\bdigdir\\b',
          '\\btek(?:17|\\s*\\\\d)',
          '\\bsak(?:10|\\s*\\\\d)',
          '\\bpbl\\\\',
          '\\baml\\\\',
          '\\bFOR-\\d{4}',
          '\\bLOV-\\d{4}',
          '\\bFOB\\b',
          '\\bRK\\s*1\\b',
          'EI\\s*\\}\\s*60',
          '\\bsone_2\\b',
          '\\bovertredels\\w*',
          'Alternativ\\s+indeks',
          'Kilde\\[\\^',
          '\\blegosh\\b',
          '\\bpaperinformation\\b',
          'website-files\\.com',
          'bandladder\\.com',
          'vocal\\.media',
          '1,795\\.7',
          '\\bspace' + 'x\\w*',
          '\\bstar' + 'ship\\w*',
          '\\baster' + 'oid\\w*',
          '\\bisNo\\b',
          '\\bisNorwegian\\w*',
          '\\bisLikelyNorwegian\\w*',
          'Relaterte\\s+konsepter',
          'verifiserte\\s+kilder',
          'Kunnskapsgrunnlag',
          'Interaktiv\\s+Sjekkliste',
          '\\bparagrafene\\b',
          '\\bkubikkcentimeter\\b',
          '\\bfagansvarlig\\b',
          '\\bDomeneavvik\\b',
        ].join('|') +
        ')',
      'i'
    );
    const scanSrcForLeaks = (dir: string) => {
      for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, ent.name);
        if (ent.isDirectory()) {
          if (ent.name === 'tests') continue;
          scanSrcForLeaks(full);
        } else if (ent.isFile() && /\.(?:ts|js|css|md)$/i.test(ent.name)) {
          const lines = fs.readFileSync(full, 'utf-8').split(/\r?\n/);
          lines.forEach((ln, idx) => {
            const m = ln.match(forbiddenEngineRe);
            if (m) {
              leakedEngineHits.push(`${path.relative(srcRootForLeakCheck, full)}:${idx + 1} (${m[0]})`);
            }
          });
        }
      }
    };
    scanSrcForLeaks(srcRootForLeakCheck);

    const tmpBundleLangDir = fs.mkdtempSync(path.join(os.tmpdir(), 'icm-bundle-lang-'));
    try {
      const enBundle = path.join(tmpBundleLangDir, 'en', 'bundle', 'research');
      fs.mkdirSync(enBundle, { recursive: true });
      fs.writeFileSync(
        path.join(enBundle, 'alpha.md'),
        [
          '---',
          'type: Research Concept',
          'title: Grid Storage for Microgrids',
          'status: stable',
          '---',
          'I evaluated battery storage for peak demand. See [Beta](/research/beta.md).',
        ].join('\n'),
        'utf-8'
      );
      fs.writeFileSync(
        path.join(enBundle, 'beta.md'),
        [
          '---',
          'type: Research Concept',
          'title: Inverter Protection for Microgrids',
          'status: stable',
          '---',
          'I verified relay settings for fault isolation in grid systems.',
        ].join('\n'),
        'utf-8'
      );
      injectBidirectionalBundleLinks(path.join(tmpBundleLangDir, 'en', 'bundle'));
      const betaEnAfter = fs.readFileSync(path.join(enBundle, 'beta.md'), 'utf-8');

      const noUnconfiguredBundle = path.join(tmpBundleLangDir, 'no-default', 'bundle', 'research');
      fs.mkdirSync(noUnconfiguredBundle, { recursive: true });
      fs.writeFileSync(
        path.join(noUnconfiguredBundle, 'alfa.md'),
        [
          '---',
          'type: Regulatory Guide',
          'title: Veileder om sikkerhet',
          'status: stable',
          '---',
          'Virksomheten skal vurdere tiltak etter [Beta](/research/beta.md).',
        ].join('\n'),
        'utf-8'
      );
      fs.writeFileSync(
        path.join(noUnconfiguredBundle, 'beta.md'),
        [
          '---',
          'type: Regulatory Guide',
          'title: Krav til opplæring',
          'status: stable',
          '---',
          'Arbeidsgiver må gjennomføre systematisk vurdering av ansvar og tiltak.',
        ].join('\n'),
        'utf-8'
      );
      injectBidirectionalBundleLinks(path.join(tmpBundleLangDir, 'no-default', 'bundle'));
      const betaNoUnconfiguredAfter = fs.readFileSync(path.join(noUnconfiguredBundle, 'beta.md'), 'utf-8');

      const noWsRoot = path.join(tmpBundleLangDir, 'no');
      const noBundle = path.join(noWsRoot, 'bundle', 'research');
      fs.mkdirSync(noBundle, { recursive: true });
      saveWorkspaceLocale(noWsRoot, NB_NO_TEST_LOCALE);
      fs.writeFileSync(
        path.join(noBundle, 'alfa.md'),
        [
          '---',
          'type: Regulatory Guide',
          'title: Veileder om sikkerhet',
          'status: stable',
          '---',
          'Virksomheten skal vurdere tiltak etter [Beta](/research/beta.md).',
        ].join('\n'),
        'utf-8'
      );
      fs.writeFileSync(
        path.join(noBundle, 'beta.md'),
        [
          '---',
          'type: Regulatory Guide',
          'title: Krav til opplæring',
          'status: stable',
          '---',
          'Arbeidsgiver må gjennomføre systematisk vurdering av ansvar og tiltak.',
        ].join('\n'),
        'utf-8'
      );
      injectBidirectionalBundleLinks(path.join(noWsRoot, 'bundle'));
      const betaNoAfter = fs.readFileSync(path.join(noBundle, 'beta.md'), 'utf-8');

      // Verify German (`de-DE`) Layer 3 `_config/locale.json` across bundle links, structural grounding skip, A2UI surface, and Stage 4 prosody
      const deWsRoot = path.join(tmpBundleLangDir, 'de');
      const deBundle = path.join(deWsRoot, 'bundle', 'research');
      const deRunId = 'de-sicherheit-run';
      const deRunOut = path.join(deWsRoot, 'runs', deRunId, 'stages', '01_research', 'output');
      fs.mkdirSync(deBundle, { recursive: true });
      fs.mkdirSync(deRunOut, { recursive: true });
      saveWorkspaceLocale(deWsRoot, {
        bcp47: 'de-DE',
        languageName: 'German',
        ui: {
          ...DEFAULT_ICM_LOCALE.ui,
          relatedConceptsHeading: '## Verwandte Konzepte im Wissensbündel',
          referencedInConcept: '- **Referenziert in Konzept:** [/{id}.md](/{id}.md) (*{title}*)',
          verifiedSourcesCount: '{count} verifizierte Quellen',
          tabOkfSourcesCount: '📚 OKF v0.3 Wissensbasis & Quellen ({count})',
        },
        prosody: {
          ...DEFAULT_ICM_LOCALE.prosody,
          to: 'bis',
          atMost: 'höchstens',
          atLeast: 'mindestens',
          section: 'Paragraph',
          sections: 'Paragraphen',
          percent: 'Prozent',
          degreesCelsius: 'Grad Celsius',
          meter: 'Meter',
          meters: 'Meter',
          abbreviations: {
            'z.B.': 'zum Beispiel',
          },
        },
      });
      fs.writeFileSync(
        path.join(deBundle, 'alpha.md'),
        [
          '---',
          'type: Regulatory Guide',
          'title: Betriebssicherheit',
          'status: stable',
          'sources:',
          '  - id: bmas-leitfaden',
          '    title: BMAS Leitfaden',
          '    resource: https://www.bmas.de/leitfaden',
          '    retrieved_at: 2026-11-01T10:00:00Z',
          '---',
          'Die Anforderungen gelten für alle Anlagen nach [Beta](/research/beta.md)[^bmas-leitfaden].',
          '',
          '[^bmas-leitfaden]: BMAS Leitfaden — https://www.bmas.de/leitfaden',
        ].join('\n'),
        'utf-8'
      );
      fs.writeFileSync(
        path.join(deBundle, 'beta.md'),
        [
          '---',
          'type: Regulatory Guide',
          'title: Schutzmaßnahmen',
          'status: stable',
          'sources:',
          '  - id: baua-regel',
          '    title: BAuA Technische Regel',
          '    resource: https://www.baua.de/regel',
          '    retrieved_at: 2026-11-01T10:00:00Z',
          '---',
          '# Schutzmaßnahmen',
          '',
          'Mindestens zweimal jährlich sind die Sicherheitswege zu prüfen[^baua-regel].',
          '',
          '[^baua-regel]: BAuA Technische Regel — https://www.baua.de/regel',
        ].join('\n'),
        'utf-8'
      );
      const betaDeRaw = fs.readFileSync(path.join(deBundle, 'beta.md'), 'utf-8');
      fs.writeFileSync(path.join(deRunOut, 'research_summary.md'), betaDeRaw, 'utf-8');
      injectBidirectionalBundleLinks(path.join(deWsRoot, 'bundle'), undefined, deWsRoot);
      const betaDeAfter = fs.readFileSync(path.join(deBundle, 'beta.md'), 'utf-8');
      const runSummaryDeAfter = fs.readFileSync(path.join(deRunOut, 'research_summary.md'), 'utf-8');
      const deCleanedWithBacklink = await cleanGroundingLinks(betaDeAfter, [], {
        workspaceRoot: deWsRoot,
      });
      const deVizRes = generateBundleVisualization(path.join(deWsRoot, 'bundle'));
      const deVizHtml = fs.readFileSync(deVizRes.outputPath, 'utf-8');
      const deA2uiRes = generateA2uiSurface({ workspaceRoot: deWsRoot, runId: deRunId });
      const deA2uiHtml = fs.readFileSync(deA2uiRes.htmlOutputPath, 'utf-8');
      const deTtsNorm = prepareTextForStudioTts(
        '**Sicherheit:** Gemäß §§ 4–8 sind ≤ 25 m und 15 % z.B. bei 20 °C einzuhalten.',
        'de-DE',
        deWsRoot
      );

      assert(
        leakedEngineHits.length === 0 &&
          betaEnAfter.includes('## Related Bundle Concepts') &&
          betaNoUnconfiguredAfter.includes('## Related Bundle Concepts') &&
          !betaNoUnconfiguredAfter.includes('Relaterte konsepter') &&
          betaNoAfter.includes('## Relaterte konsepter i kunnskapsbasen') &&
          betaDeAfter.includes('## Verwandte Konzepte im Wissensbündel') &&
          runSummaryDeAfter.includes('## Verwandte Konzepte im Wissensbündel') &&
          !runSummaryDeAfter.includes('## Related Concepts') &&
          betaDeAfter.includes('- [Betriebssicherheit](/research/alpha.md)') &&
          deVizHtml.includes('- **Referenziert in Konzept:** [/research/alpha.md](/research/alpha.md)') &&
          isInternalConceptLinkBullet('- [Betriebssicherheit](/research/alpha.md)') &&
          isInternalConceptLinkBullet('- **Referenziert in Konzept:** [/research/alpha.md](/research/alpha.md)') &&
          findTrailingRelatedConceptsHeadingIndex(parseOkfDocument(betaDeAfter).body.split(/\r?\n/)) !== -1 &&
          deCleanedWithBacklink.includes('## Verwandte Konzepte im Wissensbündel') &&
          deA2uiHtml.includes('<html lang="de">') &&
          deA2uiHtml.includes('📚 OKF v0.3 Wissensbasis & Quellen (1)') &&
          deA2uiHtml.includes('1 verifizierte Quellen') &&
          deTtsNorm.includes('Paragraphen 4 bis 8') &&
          deTtsNorm.includes('höchstens 25 Meter') &&
          deTtsNorm.includes('15 Prozent') &&
          deTtsNorm.includes('zum Beispiel') &&
          deTtsNorm.includes('20 Grad Celsius'),
        `Engine src/ stays 100% language-neutral (${leakedEngineHits.join(', ') || '0 leaks'}) while Layer 3 _config/locale.json localizes bundle headings, viz.html, A2UI surfaces, and Stage 4 prosody across any target language`
      );

      // Verify on-the-fly Layer 3 `ensureWorkspaceLocaleConfig()` synthesis, zero-token caching, and English fast path
      const origFetchLocale = globalThis.fetch;
      const origKeyLocale = process.env.GEMINI_API_KEY;
      process.env.GEMINI_API_KEY = origKeyLocale || 'test-mock-locale-key';
      let localeApiCalls = 0;
      let capturedLocaleReqBody = null as Record<string, any> | null;
      try {
        const frMockLocalePayload = {
          bcp47: 'fr-FR',
          languageName: 'French',
          ui: {
            ...DEFAULT_ICM_LOCALE.ui,
            relatedConceptsHeading: '## Concepts associés du référentiel',
            verifiedSourcesCount: '{count} sources vérifiées',
            activeSourcesChip: '✅ {nombre} sources actives',
          },
          prosody: {
            ...DEFAULT_ICM_LOCALE.prosody,
            section: 'article',
            sections: 'articles',
            percent: 'pour cent',
            abbreviations: [{ shortForm: 'p.ex.', spokenExpansion: 'par exemple' }],
          },
        };
        const localeSse = `data: ${JSON.stringify({
          event_type: 'interaction.completed',
          interaction: {
            id: 'inter_locale_fr_01',
            status: 'completed',
            steps: [
              {
                type: 'model_output',
                content: [
                  {
                    type: 'text',
                    text: `\`\`\`json\n${JSON.stringify(frMockLocalePayload, null, 2)}\n\`\`\``,
                  },
                ],
              },
            ],
            usage: { total_input_tokens: 400, total_thought_tokens: 50, total_output_tokens: 350, total_tokens: 800 },
          },
        })}\n\n`;
        globalThis.fetch = (async (_url: any, init?: RequestInit) => {
          localeApiCalls++;
          if (init?.body && typeof init.body === 'string') {
            capturedLocaleReqBody = JSON.parse(init.body);
          }
          return new Response(localeSse, {
            status: 200,
            headers: { 'content-type': 'text/event-stream' },
          });
        }) as typeof fetch;

        const frWsRoot = path.join(tmpBundleLangDir, 'fr-onthefly');
        fs.mkdirSync(frWsRoot, { recursive: true });
        const enFastRes = await ensureWorkspaceLocaleConfig(
          frWsRoot,
          'The institutional portfolio allocation framework requires strict risk controls under section 12.'
        );
        const frFirstRes = await ensureWorkspaceLocaleConfig(
          frWsRoot,
          'Les exigences de sécurité pour les installations industrielles sont définies dans cette réglementation.'
        );
        const frCachedRes = await ensureWorkspaceLocaleConfig(
          frWsRoot,
          'Les exigences de sécurité pour les installations industrielles sont définies dans cette réglementation.'
        );
        const frTtsNorm = prepareTextForStudioTts(
          'Conformité de 20 % selon § 8 p.ex. dans le rapport.',
          'fr-FR',
          frWsRoot
        );

        assert(
          enFastRes.generatedOnTheFly === false &&
            enFastRes.tokensUsed === 0 &&
            frFirstRes.generatedOnTheFly === true &&
            frFirstRes.tokensUsed === 800 &&
            frFirstRes.locale.bcp47 === 'fr-FR' &&
            frFirstRes.locale.ui.relatedConceptsHeading === '## Concepts associés du référentiel' &&
            frFirstRes.locale.ui.activeSourcesChip === DEFAULT_ICM_LOCALE.ui.activeSourcesChip &&
            capturedLocaleReqBody?.response_format?.mime_type === 'application/json' &&
            capturedLocaleReqBody?.response_format?.schema === undefined &&
            fs.existsSync(path.join(frWsRoot, '_config', 'locale.json')) &&
            frCachedRes.generatedOnTheFly === false &&
            frCachedRes.tokensUsed === 0 &&
            localeApiCalls === 1 &&
            frTtsNorm.includes('20 pour cent') &&
            frTtsNorm.includes('article 8') &&
            frTtsNorm.includes('par exemple'),
          `ensureWorkspaceLocaleConfig uses unconstrained JSON mode (avoiding 150+-property schema FSM limits), guards {placeholder} tokens, synthesizes _config/locale.json once on the fly, and caches at 0 tokens`
        );
      } finally {
        globalThis.fetch = origFetchLocale;
        if (origKeyLocale === undefined) delete process.env.GEMINI_API_KEY;
        else process.env.GEMINI_API_KEY = origKeyLocale;
      }

      // Verify abstract cross-portal view-chrome stripping, generic CDN subdomain / record-router enrichment, Unicode .^id curation, and universal prosody IDs
      const unicodeCurateRes = curateOkfSources(
        [
          '---',
          'type: Research Concept',
          'title: Unicode Caret Normalization',
          'status: draft',
          'sources:',
          '  - id: bad-src',
          '    title: Unverified Blog',
          '    resource: https://example.com/bad',
          '  - id: good-src',
          '    title: Official Standard',
          '    resource: https://standards.example.org/spec',
          '---',
          'Conformité vérifiée^bad-src et sécurité^good-src.',
          '',
          '[^bad-src]: Unverified Blog',
          '[^good-src]: Official Standard',
        ].join('\n'),
        { rejectSourceIds: ['bad-src'] }
      );
      const abstractTtsEn = prepareTextForStudioTts(
        'Under NFPA 72 §§ 10-14 and (REG-2024-05-01-42) §§ 2-5, verify R_0 and zone_2.',
        'en'
      );
      const standaloneCodeAndBoldTtsNo = prepareTextForStudioTts(
        'Oppdatert etter **forskrift om helse og miljø (FOR-2023-03-28-449)** og *forskrift om brannforebygging *. Er eldre regler erstattet med FOR-2023-03-28-449 og FOR-2015-12-17-1710 etter **FOR-2023-03-28-449 § 3** (faktor 2 * 3 * 4)?',
        NB_NO_TEST_LOCALE
      );
      assert(
        stripTrailingPortalViewChrome('29 CFR 1910.38 (Print View)') === '29 CFR 1910.38' &&
          stripTrailingPortalViewChrome('Statutory Act (Alternativ indeks)') === 'Statutory Act' &&
          stripTrailingPortalViewChrome('Directive 2024/1689 [Printer-friendly version]') ===
            'Directive 2024/1689' &&
          stripTrailingPortalViewChrome('Information Security Standard (ISO 27001)') ===
            'Information Security Standard (ISO 27001)' &&
          enrichBareDomainSourceTitle(
            'cdn.example.org',
            'https://cdn.example.org/files/6a9e9cef4a0a559c1c162d3e_annual-safety-report.pdf'
          ) === 'example.org — Annual safety report' &&
          enrichBareDomainSourceTitle(
            'ieee.org — documentdetails',
            'https://ieeexplore.ieee.org/document/documentdetails?docid=998877'
          ) === 'ieee.org — Document 998877' &&
          enrichBareDomainSourceTitle(
            'oracle.com — Portal fr',
            'https://apex.oracle.com/pls/apex/portal_fr/f?p=200:1'
          ) === 'oracle.com' &&
          !unicodeCurateRes.markdown.includes('bad-src') &&
          unicodeCurateRes.markdown.includes('sécurité[^good-src].') &&
          cleanChecklistLabel('Verify R_0 and CO_2 in zone_2') === 'Verify R₀ and CO₂ in zone_2' &&
          abstractTtsEn.includes('NFPA 72 sections 10-14') &&
          abstractTtsEn.includes('sections 2 to 5') &&
          !abstractTtsEn.includes('REG-2024-05-01-42') &&
          standaloneCodeAndBoldTtsNo.includes('Oppdatert etter forskrift om helse og miljø og forskrift om brannforebygging.') &&
          standaloneCodeAndBoldTtsNo.includes('erstattet med FOR-2023-03-28-449 og FOR-2015-12-17-1710 etter FOR-2023-03-28-449 paragraf 3') &&
          standaloneCodeAndBoldTtsNo.includes('2 * 3 * 4') &&
          !standaloneCodeAndBoldTtsNo.includes('**') &&
          !standaloneCodeAndBoldTtsNo.includes('*forskrift'),
        'Portal view-chrome stripping, generic CDN/router/APEX title enrichment, Unicode .^id curation, chemical/variable subscripts, and prosody parenthetical-vs-standalone registry rules work abstractly'
      );
    } finally {
      fs.rmSync(tmpBundleLangDir, { recursive: true, force: true });
    }

    // Verify `specification/STANDARDS_AND_REFERENCES.md` progressive-disclosure routing & relative file-link integrity
    const repoRootDir = path.resolve(import.meta.dirname, '../..');
    const standardsDocPath = path.join(repoRootDir, 'specification', 'STANDARDS_AND_REFERENCES.md');
    const standardsDocExists = fs.existsSync(standardsDocPath);
    const standardsDocText = standardsDocExists ? fs.readFileSync(standardsDocPath, 'utf-8') : '';
    const brokenRelativeLinks: string[] = [];
    for (const m of standardsDocText.matchAll(/\[[^\]]+\]\((\.\.?\/[^)#\s]+)(?:#[^)\s]*)?\)/g)) {
      const relTarget = m[1];
      const absTarget = path.resolve(path.dirname(standardsDocPath), relTarget);
      if (!fs.existsSync(absTarget)) {
        brokenRelativeLinks.push(relTarget);
      }
    }
    const readmeLinksStandards = fs
      .readFileSync(path.join(repoRootDir, 'README.md'), 'utf-8')
      .includes('specification/STANDARDS_AND_REFERENCES.md');
    const primaryRulesPath = fs.existsSync(path.join(repoRootDir, 'GEMINI.md'))
      ? path.join(repoRootDir, 'GEMINI.md')
      : path.join(repoRootDir, 'rules', 'AGENTS.md');
    const primarySkillPath = fs.existsSync(
      path.join(repoRootDir, '.agents', 'skills', 'icm-co-architect', 'SKILL.md')
    )
      ? path.join(repoRootDir, '.agents', 'skills', 'icm-co-architect', 'SKILL.md')
      : path.join(repoRootDir, 'skills', 'icm-co-architect', 'SKILL.md');
    const geminiLinksStandards = fs
      .readFileSync(primaryRulesPath, 'utf-8')
      .includes('specification/STANDARDS_AND_REFERENCES.md');
    const skillLinksStandards = fs
      .readFileSync(primarySkillPath, 'utf-8')
      .includes('specification/STANDARDS_AND_REFERENCES.md');
    const srcContextLinksStandards = fs
      .readFileSync(path.join(repoRootDir, 'src', 'CONTEXT.md'), 'utf-8')
      .includes('specification/STANDARDS_AND_REFERENCES.md');
    assert(
      standardsDocExists &&
        brokenRelativeLinks.length === 0 &&
        readmeLinksStandards &&
        geminiLinksStandards &&
        skillLinksStandards &&
        srcContextLinksStandards,
      `specification/STANDARDS_AND_REFERENCES.md exists with 0 broken relative repo links (${brokenRelativeLinks.join(', ') || '0 broken'}) and is wired into README.md, rules, SKILL.md, and src/CONTEXT.md`
    );

    // Verify single-pass non-recursive `renderPromptTemplate()` (never re-expands literal `{{...}}` inside variable values)
    const singlePassRendered = renderPromptTemplate(
      [
        'GLOBAL:',
        '{{globalIdentity}}',
        '{{#if workspaceContext}}',
        'WORKSPACE ({{topic}}):',
        '{{workspaceContext}}',
        '{{/if}}',
        '{{#if bundleContext}}',
        'BUNDLE:',
        '{{bundleContext}}',
        '{{/if}}',
      ].join('\n'),
      {
        globalIdentity: 'Layer 0 documents `{{bundleContext}}` and `{{topic}}` literally.',
        workspaceContext: 'Layer 1 routes `workspace/bundle/references/*.md` into `{{bundleContext}}` without recursive expansion.',
        bundleContext: 'ACTUAL_BUNDLE_PAYLOAD_ONCE',
        topic: 'Fire Safety',
      }
    );
    const actualBundleOccurrences = singlePassRendered.split('ACTUAL_BUNDLE_PAYLOAD_ONCE').length - 1;
    assert(
      actualBundleOccurrences === 1 &&
        singlePassRendered.includes('Layer 0 documents `{{bundleContext}}` and `{{topic}}` literally.') &&
        singlePassRendered.includes('WORKSPACE (Fire Safety):') &&
        singlePassRendered.includes('into `{{bundleContext}}` without recursive expansion.'),
      `renderPromptTemplate performs single-pass non-recursive substitution (bundle occurrences=${actualBundleOccurrences})`
    );

    // Verify multilingual document-type subtitle suffixes (`– Veileder`, `– Leitfaden`, `– Whitepaper`) in server + client provenance
    const clientHooks: Record<string, any> = {};
    // eslint-disable-next-line no-new-func
    new Function('window', A2UI_STUDIO_JS)({
      A2UI_SURFACE_PAYLOAD: {},
      __ICM_TEST_HOOKS__: clientHooks,
    });
    const helsedirVeilederSrc = {
      id: 'helsedirektoratet-no',
      title: 'helsedirektoratet.no — Kommunens tilsyn med miljørettet helsevern. Regelverk, metodikk og saksbehandling – Veileder',
      resource: 'https://www.helsedirektoratet.no/veiledere/kommunens-tilsyn-med-miljorettet-helsevern.pdf',
      url: 'https://www.helsedirektoratet.no/veiledere/kommunens-tilsyn-med-miljorettet-helsevern.pdf',
    };
    const bauaLeitfadenSrc = {
      id: 'baua-technische-regeln',
      title: 'Technische Sicherheit am Arbeitsplatz – Leitfaden',
      resource: 'https://www.baua.de/DE/Angebote/Publikationen/leitfaden.pdf',
      url: 'https://www.baua.de/DE/Angebote/Publikationen/leitfaden.pdf',
    };
    const clinicalWhitepaperSrc = {
      id: 'clinical-risk-wp',
      title: 'Perioperative Airway Management – Whitepaper',
      resource: 'https://www.apsf.org/wp-content/uploads/airway-whitepaper.pdf',
      url: 'https://www.apsf.org/wp-content/uploads/airway-whitepaper.pdf',
    };
    const realInstMismatchSrc = {
      id: 'brannvern-dibk',
      title: 'Brannsikkerhet i byggverk – Direktoratet for byggkvalitet',
      resource: 'https://thirdparty-blog.example.com/uploads/brannsikkerhet.pdf',
      url: 'https://thirdparty-blog.example.com/uploads/brannsikkerhet.pdf',
    };
    const instWithGuideWordMismatchSrc = {
      id: 'agency-safety-doc',
      title: 'Occupational Safety – European Agency Guide',
      resource: 'https://thirdparty-blog.example.com/uploads/agency-guide.pdf',
      url: 'https://thirdparty-blog.example.com/uploads/agency-guide.pdf',
    };
    assert(
      inspectSourceDomainProvenance(helsedirVeilederSrc).domainMismatch === false &&
        clientHooks.inspectClientSourceDomainProvenance(helsedirVeilederSrc).domainMismatch === false &&
        inspectSourceDomainProvenance(bauaLeitfadenSrc).domainMismatch === false &&
        clientHooks.inspectClientSourceDomainProvenance(bauaLeitfadenSrc).domainMismatch === false &&
        inspectSourceDomainProvenance(clinicalWhitepaperSrc).domainMismatch === false &&
        clientHooks.inspectClientSourceDomainProvenance(clinicalWhitepaperSrc).domainMismatch === false &&
        inspectSourceDomainProvenance(realInstMismatchSrc).domainMismatch === true &&
        clientHooks.inspectClientSourceDomainProvenance(realInstMismatchSrc).domainMismatch === true &&
        inspectSourceDomainProvenance(instWithGuideWordMismatchSrc).domainMismatch === true &&
        clientHooks.inspectClientSourceDomainProvenance(instWithGuideWordMismatchSrc).domainMismatch === true,
      'inspectSourceDomainProvenance and inspectClientSourceDomainProvenance recognize multilingual document-type subtitle suffixes without masking institutional publisher mismatches'
    );

    // Verify Stage 4 native non-English Voice Design conditioning (omits `en-US` `base_voice`), `<= 950`-char sub-window chunking, locked-voice style hygiene, and compound-slash / comma-code prosody
    {
      const origFetch = globalThis.fetch;
      const origKey = process.env.GEMINI_API_KEY;
      process.env.GEMINI_API_KEY = 'test-key-tts-chunking';
      try {
        const capturedVoicePayloads: Array<Record<string, any>> = [];
        const capturedTtsTexts: string[] = [];
        const capturedTtsAnnotations: Array<any> = [];
        const mockClipWav = wrapPcm16InWavHeader(Buffer.alloc(4800, 0), 24000, 1);

        globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
          const url = String(input);
          const method = (init?.method || 'GET').toUpperCase();
          if (url === VOICES_API_URL && method === 'POST') {
            const parsed = JSON.parse(String(init?.body || '{}'));
            capturedVoicePayloads.push(parsed);
            return new Response(
              JSON.stringify({
                id: `voice_test_${capturedVoicePayloads.length}`,
                language_code: parsed?.voice?.language_code,
                sample_audio: { mime_type: 'audio/wav', data: mockClipWav.toString('base64') },
                usage: { total_input_tokens: 100, total_output_tokens: 100, total_tokens: 200 },
              }),
              { status: 200, headers: { 'content-type': 'application/json' } }
            );
          }
          if (url.includes('/v1beta/interactions') && method === 'POST') {
            const parsed = JSON.parse(String(init?.body || '{}'));
            const part = parsed?.input?.[0]?.content?.[0] || {};
            capturedTtsTexts.push(String(part.text || ''));
            capturedTtsAnnotations.push(part.annotations || null);
            return new Response(
              JSON.stringify({
                id: `tts_chunk_${capturedTtsTexts.length}`,
                status: 'completed',
                steps: [
                  {
                    type: 'model_output',
                    content: [{ type: 'audio', mime_type: 'audio/wav', data: mockClipWav.toString('base64') }],
                  },
                ],
                usage: { total_input_tokens: 40, total_output_tokens: 80, total_tokens: 120 },
              }),
              { status: 200, headers: { 'content-type': 'application/json' } }
            );
          }
          throw new Error(`Unexpected mock fetch in TTS chunking test: ${method} ${url}`);
        }) as typeof fetch;

        await createPromptedVoice({
          promptInput: 'En rolig og tydelig mannlig spesialist fra Oslo som snakker østnorsk bokmål.',
          baseVoice: 'Charon',
          languageCode: 'nb-NO',
        });
        await createPromptedVoice({
          promptInput: 'Preserve Charon with a standard British accent.',
          baseVoice: 'Charon',
          languageCode: 'en-GB',
        });

        const nbVoiceSpec = capturedVoicePayloads[0]?.voice || {};
        const enGbVoiceSpec = capturedVoicePayloads[1]?.voice || {};

        const p1 = 'Første avsnitt om risikoklasse 3 i barnehagen. '.repeat(15).trim(); // ~705 chars
        const p2 = 'Andre avsnitt om brannceller og rømningsveier i avdelingen. '.repeat(13).trim(); // ~780 chars
        const p3 = 'Tredje avsnitt om brannalarmanlegg og slokkeutstyr. '.repeat(14).trim(); // ~728 chars
        const action = 'Gå en runde i avdelingen og kontroller at rømningsveien er fri.';

        const mergedCapCheck = mergeConsecutiveSpeakerTurns([
          { speaker: 'Spesialist', voice: 'Charon', text: p1 },
          { speaker: 'Spesialist', voice: 'Charon', text: p2 },
          { speaker: 'Spesialist', voice: 'Charon', text: p3 },
          { speaker: 'Veileder', voice: 'Sulafat', text: action },
        ]);

        const oversizedTurnText = [p1, p2, p3].join('\n\n');
        const splitCheck = splitTtsTranscriptIntoSafeChunks(oversizedTurnText, MAX_TTS_CHARS_PER_CALL);

        const multiChunkRes = await generateFlashTtsAudioInteraction({
          turns: [
            {
              speaker: 'Spesialist',
              voice: 'voice_locked_charon',
              text: oversizedTurnText,
              style: 'Calm, authoritative, serious Norwegian studio pacing',
            },
            {
              speaker: 'Veileder',
              voice: 'voice_locked_sulafat',
              text: action,
              style: 'Warm, approachable, encouraging Norwegian studio pacing',
            },
          ],
          speakers: [
            { speaker: 'Spesialist', voice: 'voice_locked_charon' },
            { speaker: 'Veileder', voice: 'voice_locked_sulafat' },
          ],
          languageCode: 'nb-NO',
          sampleRate: 24000,
        });

        await generateFlashTtsAudioInteraction({
          transcriptText: `[Veileder (Sulafat)]: ${p1}\n\n[Veileder (Sulafat)]: ${p2}`,
          turns: [
            { speaker: 'Veileder', voice: 'voice_locked_sulafat', text: p1 },
            { speaker: 'Veileder', voice: 'voice_locked_sulafat', text: p2 },
          ],
          speakers: [{ speaker: 'Veileder', voice: 'voice_locked_sulafat' }],
          languageCode: 'nb-NO',
          sampleRate: 24000,
        });

        const customNbLocale = mergeIcmLocalePack({
          ...NB_NO_TEST_LOCALE,
          prosody: {
            ...NB_NO_TEST_LOCALE.prosody,
            or: 'eller',
            voicePersonas: {
              warmGuideFemale:
                'En varm, klar og vennlig kvinnelig kursleder fra Oslo som snakker naturlig østnorsk bokmål i jevnt studiotempo.',
              warmGuideMale:
                'En varm, klar og vennlig mannlig kursleder fra Oslo som snakker naturlig østnorsk bokmål i jevnt studiotempo.',
              calmSpecialistMale:
                'En rolig, tydelig og autoritativ mannlig fagspesialist fra Oslo som snakker klart østnorsk bokmål i jevnt studiotempo.',
              calmSpecialistFemale:
                'En rolig, tydelig og autoritativ kvinnelig fagspesialist fra Oslo som snakker klart østnorsk bokmål i jevnt studiotempo.',
            },
          },
        });

        const upgradedPrompt = resolveStage4VoiceDesignPrompt({
          baseVoice: 'Charon',
          languageCode: 'nb-NO',
          speakerRole: 'specialist',
          explicitPrompt:
            "Preserve Charon's calm, authoritative timbre speaking the exact same standard Eastern Norwegian (nb-NO) accent.",
          locale: customNbLocale,
        });
        const preservedNativePrompt = resolveStage4VoiceDesignPrompt({
          baseVoice: 'Sulafat',
          languageCode: 'nb-NO',
          speakerRole: 'guide',
          explicitPrompt: 'En rolig kvinnelig veileder fra Trondheim med trøndersk tonefall.',
          locale: customNbLocale,
        });

        const prosodySlashAndCommaCode = prepareTextForStudioTts(
          'Etter Byggteknisk forskrift (TEK17, FOR-2017-06-19-840) kreves skum-/vannapparat og kontroll av tørkeskap/tørketrommel.',
          customNbLocale
        );

        assert(
          getPrebuiltStudioVoiceProfile('Charon')?.gender === 'male' &&
            getPrebuiltStudioVoiceProfile('Sulafat')?.gender === 'female' &&
            nbVoiceSpec.gender === 'male' &&
            nbVoiceSpec.region_code === 'NO' &&
            nbVoiceSpec.prompted?.base_voice === undefined &&
            enGbVoiceSpec.gender === 'male' &&
            enGbVoiceSpec.region_code === 'GB' &&
            enGbVoiceSpec.prompted?.base_voice === 'Charon' &&
            mergedCapCheck.length === 4 &&
            splitCheck.length === 3 &&
            splitCheck.every((c) => c.length <= MAX_TTS_CHARS_PER_CALL) &&
            capturedTtsTexts.length === 6 &&
            capturedTtsTexts.every((c) => c.length <= MAX_TTS_CHARS_PER_CALL && !c.includes('[Veileder')) &&
            capturedTtsAnnotations.every((a) => a === null) &&
            sanitizeStyleForLockedVoice('Calm, clear, reassuring Norwegian studio pacing.') === '' &&
            sanitizeStyleForLockedVoice('whispered urgently') === 'whispered urgently' &&
            parseWavMetadata(multiChunkRes.audioBuffer).sampleRate === 24000 &&
            upgradedPrompt?.includes('mannlig fagspesialist fra Oslo') &&
            preservedNativePrompt === 'En rolig kvinnelig veileder fra Trondheim med trøndersk tonefall.' &&
            prosodySlashAndCommaCode.includes('Byggteknisk forskrift (TEK17)') &&
            !prosodySlashAndCommaCode.includes('FOR-2017-06-19-840') &&
            prosodySlashAndCommaCode.includes('skum- eller vannapparat') &&
            prosodySlashAndCommaCode.includes('tørkeskap eller tørketrommel'),
          'Stage 4 omits en-US base_voice on non-English Voice Design, splits turns <= 950 chars below server context rollover, strips competing locked-voice style prompts, upgrades English remix prompts to native locale.json voicePersonas, and expands compound slashes / comma-joined parenthetical codes'
        );
      } finally {
        globalThis.fetch = origFetch;
        if (origKey === undefined) delete process.env.GEMINI_API_KEY;
        else process.env.GEMINI_API_KEY = origKey;
      }
    }
  }

  // Pure OKF v0.3 Conformance Suite (SPEC.md §§3.2, 4, 5.2–5.5, 6, 7, 8.1, 9, 11.2)
  {
    const okfActorRe = /^([^\s/:]+\/\S+|[A-Za-z][A-Za-z0-9+.-]*:\S+)$/;

    // 1. Current-only verification events (`verified[].at >= generated.at`) & `team:` vs `human:` trust tiers (§5.2 & §5.3)
    assert(
      getOkfTrustTier({
        generated: { by: 'icm-stage1/gemini-4-argon', at: '2026-11-19T12:00:00Z' },
        verified: [{ by: 'human:ana', at: '2026-11-19T11:59:59Z' }],
      }) === 'unverified' &&
        getOkfTrustTier({
          generated: { by: 'icm-stage1/gemini-4-argon', at: '2026-11-19T12:00:00Z' },
          verified: [{ by: 'human:ana', at: '2026-11-19T12:00:00Z' }],
        }) === 'human-reviewed' &&
        getOkfTrustTier({
          generated: { by: 'icm-stage1/gemini-4-argon', at: '2026-11-19T12:00:00Z' },
          verified: [{ by: 'team:data-platform', at: '2026-11-19T13:00:00Z' }],
        }) === 'machine-confirmed' &&
        getOkfTrustTier({
          verified: [{ by: 'human:ana' } as any],
        }) === 'unverified',
      'OKF v0.3 §5.2 & §5.3: getOkfTrustTier ignores events missing `at` or older than `generated.at`, treats `team:` as machine-confirmed, and treats current `human:` as human-reviewed'
    );

    // 2. Malformed `stale_after` is NEVER fresh (§5.5 & §11.2)
    const refNow = new Date('2026-11-19T12:00:00Z');
    assert(
      isOkfStale({}, refNow) === false &&
        isOkfStale({ stale_after: null }, refNow) === false &&
        isOkfStale({ stale_after: '' }, refNow) === false &&
        isOkfStale({ stale_after: 'tomorrow' }, refNow) === true &&
        isOkfStale({ stale_after: '2027-06-30T14:00:00' }, refNow) === true &&
        isOkfStale({ stale_after: '2027-02-30' }, refNow) === true &&
        isOkfStale({ stale_after: '2026-11-19' }, refNow) === true &&
        isOkfStale({ stale_after: '2026-11-20' }, refNow) === false &&
        parseOkfTimestampMs('2026-11-19T14:00:00+02:00') === Date.parse('2026-11-19T12:00:00Z'),
      'OKF v0.3 §5.5 & §11.2: isOkfStale treats null/empty stale_after as absent (false) and unparseable/offset-less/invalid-date stale_after as stale (true)'
    );

    // 3. Duplicate YAML keys rejected across root, nested, sequence-item, and flow mappings (§4 E007)
    let dupRootCaught = false;
    let dupFlowCaught = false;
    let dupSeqCaught = false;
    try {
      parseOkfDocument('---\ntype: Metric\ntitle: First\ntitle: Second\n---\nBody');
    } catch (e: any) {
      dupRootCaught = String(e?.message || '').includes('Duplicate YAML frontmatter key: title');
    }
    try {
      parseOkfDocument('---\ntype: Metric\ngenerated: { by: a/1, by: b/2 }\n---\nBody');
    } catch (e: any) {
      dupFlowCaught = String(e?.message || '').includes('Duplicate YAML frontmatter key: by');
    }
    try {
      parseOkfDocument(
        '---\ntype: Metric\nsources:\n  - id: s1\n    resource: https://example.org/a\n    id: s2\n---\nBody'
      );
    } catch (e: any) {
      dupSeqCaught = String(e?.message || '').includes('Duplicate YAML frontmatter key: id');
    }
    assert(
      dupRootCaught && dupFlowCaught && dupSeqCaught,
      'OKF v0.3 §4 (E007): parseOkfDocument rejects duplicate YAML mapping keys across block, sequence-item, and flow mappings'
    );

    // 4. Null/empty/single-item normalization (§11.2), lifecycle status (§5.4), and actor convention (§7 W103)
    const singleTagRes = normalizeOkfTags('billing, revenue');
    const singleSrcRes = normalizeOkfSources({
      sources: { id: 's1', resource: 'https://example.org/spec' },
    });
    const ignoredSrcRes = normalizeOkfSources({
      sources: [{ id: 'missing-res', title: 'No Resource' }],
    });
    assert(
      isOkfBlank(null) &&
        isOkfBlank('') &&
        isOkfBlank([]) &&
        singleTagRes.length === 1 &&
        singleTagRes[0] === 'billing, revenue' &&
        singleSrcRes.length === 1 &&
        singleSrcRes[0].id === 's1' &&
        ignoredSrcRes.length === 0 &&
        isOkfStatusCurrent({}) === true &&
        isOkfStatusCurrent({ status: 'stable' }) === true &&
        isOkfStatusCurrent({ status: 'draft' }) === false &&
        isOkfStatusCurrent({ status: 'deprecated' }) === false &&
        isOkfStatusCurrent({ status: 'archived' }) === false &&
        normalizeOkfActor('Ana Lindqvist') === 'human:Ana-Lindqvist' &&
        normalizeOkfActor('team:data platform') === 'team:data-platform' &&
        normalizeOkfActor('icm-stage1/gemini 4 argon') === 'icm-stage1/gemini-4-argon' &&
        okfActorRe.test(normalizeOkfActor('Ana Lindqvist')) &&
        okfActorRe.test(normalizeOkfActor('team:data platform')) &&
        okfActorRe.test(normalizeOkfActor('icm-stage1/gemini 4 argon')),
      'OKF v0.3 §5.4, §7 & §11.2: scalar tags preserve commas, single-item sources normalize cleanly, unknown status is non-current, and normalizeOkfActor guarantees W103-compliant actor strings'
    );

    // 5. Bundle v0.3 rules: root `index.md` metadata preservation (§8.1), sub-`index.md` & `log.md` zero frontmatter (§8/§9),
    // `.`-directory & non-concept `.md` skipping (§3.2), `superseded_by` graph edge (§5.4/§6.4), and NO v0.2 bare-path root fallback (§6.2)
    const tmpV03Bundle = fs.mkdtempSync(path.join(os.tmpdir(), 'okf-v03-bundle-'));
    try {
      fs.mkdirSync(path.join(tmpV03Bundle, 'research'), { recursive: true });
      fs.mkdirSync(path.join(tmpV03Bundle, 'references'), { recursive: true });
      fs.mkdirSync(path.join(tmpV03Bundle, '.hidden'), { recursive: true });

      fs.writeFileSync(
        path.join(tmpV03Bundle, 'index.md'),
        [
          '---',
          'okf_version: "0.2"',
          'title: Enterprise Safety Bundle',
          'description: Verified regulatory knowledge graph.',
          'license: Apache-2.0',
          'x-owner: team:safety-ops',
          '---',
          '',
          '# Old Index',
        ].join('\n'),
        'utf-8'
      );

      // Non-concept `.md` without `type` (§3.2 rule 2) and `.hidden` concept (§3.2 rule 4)
      fs.writeFileSync(path.join(tmpV03Bundle, 'README_NOTES.md'), '# Scratch Notes\nNot a concept.\n', 'utf-8');
      fs.writeFileSync(
        path.join(tmpV03Bundle, '.hidden', 'secret.md'),
        '---\ntype: Reference\ntitle: Hidden Concept\n---\nIgnored.\n',
        'utf-8'
      );

      // Reference concept at `/references/std-core.md`
      fs.writeFileSync(
        path.join(tmpV03Bundle, 'references', 'std-core.md'),
        [
          '---',
          'type: Reference',
          'title: Core Safety Standard',
          'status: stable',
          'sources:',
          '  - id: std-primary',
          '    title: Official Standard Portal',
          '    resource: https://standards.example.gov/core',
          '---',
          'Core requirement text[^std-primary].',
          '',
          '[^std-primary]: Official Standard Portal',
        ].join('\n'),
        'utf-8'
      );

      // Deprecated concept with `superseded_by: ./active-v2.md` AND bare path `references/std-core.md` (which MUST NOT resolve to root in v0.3!)
      fs.writeFileSync(
        path.join(tmpV03Bundle, 'research', 'deprecated-v1.md'),
        [
          '---',
          'type: Regulatory Guide',
          'title: Legacy Rule v1',
          'status: deprecated',
          'superseded_by: ./active%20v2.md',
          'resource: references/std-core.md',
          '---',
          'Legacy guidance text. Inline code link `[Ignored](/references/std-core.md)` is literal.',
        ].join('\n'),
        'utf-8'
      );

      // Active v2 concept with space in filename (`active v2.md`) and root-prefixed `/references/std-core.md`
      fs.writeFileSync(
        path.join(tmpV03Bundle, 'research', 'active v2.md'),
        [
          '---',
          'type: Regulatory Guide',
          'title: Active Rule v2',
          'sources:',
          '  - id: core-ref',
          '    title: Core Safety Standard',
          '    resource: /references/std-core.md',
          '---',
          'Active rule grounded in [Core Safety Standard](/references/std-core.md)[^core-ref].',
          '',
          '[^core-ref]: Core Safety Standard',
        ].join('\n'),
        'utf-8'
      );

      // Ensure appendBundleLog strips accidental frontmatter on log.md (§9 E006)
      fs.writeFileSync(
        path.join(tmpV03Bundle, 'log.md'),
        '---\ntitle: Bad Log Frontmatter\n---\n\n# Directory Update Log\n\n## 2026-11-01\n* **Initialization**: Init\n',
        'utf-8'
      );
      appendBundleLog(tmpV03Bundle, 'Update', 'research/active v2', 'Active Rule v2');
      regenerateBundleIndexes(tmpV03Bundle);

      const rootIndexDoc = parseOkfDocument(fs.readFileSync(path.join(tmpV03Bundle, 'index.md'), 'utf-8'));
      const subIndexRaw = fs.readFileSync(path.join(tmpV03Bundle, 'research', 'index.md'), 'utf-8');
      const cleanedLogRaw = fs.readFileSync(path.join(tmpV03Bundle, 'log.md'), 'utf-8');
      const walkedV03 = walkBundleConcepts(tmpV03Bundle);
      const depNode = walkedV03.find((c) => c.id === 'research/deprecated-v1');
      const actNode = walkedV03.find((c) => c.id === 'research/active v2');

      assert(
        rootIndexDoc.frontmatter.okf_version === '0.3' &&
          rootIndexDoc.frontmatter.title === 'Enterprise Safety Bundle' &&
          rootIndexDoc.frontmatter.description === 'Verified regulatory knowledge graph.' &&
          rootIndexDoc.frontmatter.license === 'Apache-2.0' &&
          rootIndexDoc.frontmatter['x-owner'] === 'team:safety-ops' &&
          !rootIndexDoc.body.includes('README_NOTES') &&
          !subIndexRaw.startsWith('---') &&
          !cleanedLogRaw.startsWith('---') &&
          walkedV03.length === 3 &&
          !walkedV03.some((c) => c.id.includes('secret') || c.id.includes('README_NOTES')) &&
          depNode?.superseded_by === './active%20v2.md' &&
          depNode?.links_to.includes('research/active v2') &&
          !depNode?.links_to.includes('references/std-core') &&
          actNode?.status === 'stable' &&
          actNode?.links_to.includes('references/std-core') &&
          vizHooks.resolveInternalConceptId('std-core.md', 'research/active v2') === 'research/std-core' &&
          vizHooks.resolveInternalConceptId('../../outside.md', 'research/active v2') === null,
        'OKF v0.3 §§3.2, 5.4, 6, 8.1 & 9: root index.md preserves metadata with okf_version "0.3", sub-index/log have zero frontmatter, non-concepts & dot-paths are skipped, superseded_by + %20 resolve, inline code links are literal, and v0.2 bare-path root fallback is removed'
      );
    } finally {
      fs.rmSync(tmpV03Bundle, { recursive: true, force: true });
    }
  }

  // Zero-dependency TypeScript `validateOkfBundle()` (E002-E007, W101-W126) & <24 KB loader-cap checks
  {
    const repoRoot = fileURLToPath(new URL('../..', import.meta.url));
    const liveBundleVal = validateOkfBundle(path.join(repoRoot, 'workspace', 'bundle'), {
      strict: true,
    });
    const rulePath = fs.existsSync(path.join(repoRoot, 'GEMINI.md'))
      ? path.join(repoRoot, 'GEMINI.md')
      : path.join(repoRoot, 'rules', 'AGENTS.md');
    const skillPath = fs.existsSync(
      path.join(repoRoot, '.agents', 'skills', 'icm-co-architect', 'SKILL.md')
    )
      ? path.join(repoRoot, '.agents', 'skills', 'icm-co-architect', 'SKILL.md')
      : path.join(repoRoot, 'skills', 'icm-co-architect', 'SKILL.md');

    const tmpValBundle = fs.mkdtempSync(path.join(os.tmpdir(), 'oks-val-v03-'));
    try {
      fs.mkdirSync(path.join(tmpValBundle, 'sub'), { recursive: true });
      fs.mkdirSync(path.join(tmpValBundle, 'research'), { recursive: true });
      fs.writeFileSync(
        path.join(tmpValBundle, 'index.md'),
        '---\nokf_version: "0.3"\n---\n# Test Bundle\n',
        'utf-8'
      );
      fs.writeFileSync(
        path.join(tmpValBundle, 'sub', 'index.md'),
        '---\ntitle: Illegal Sub Index\n---\n# Sub\n',
        'utf-8'
      );
      fs.writeFileSync(
        path.join(tmpValBundle, 'log.md'),
        '---\ntitle: Illegal Log\n---\n# Log\n',
        'utf-8'
      );
      fs.writeFileSync(
        path.join(tmpValBundle, 'research', 'dup.md'),
        '---\ntype: Metric\ntitle: A\ntitle: B\n---\nBody\n',
        'utf-8'
      );
      fs.writeFileSync(
        path.join(tmpValBundle, 'research', 'warns.md'),
        '---\ntype: Metric\ngenerated: { by: "bad actor", at: "2026-11-20T10:00:00Z" }\nstale_after: tomorrow\n---\nBody\n',
        'utf-8'
      );
      const brokenVal = validateOkfBundle(tmpValBundle, { strict: true });
      const brokenCodes = new Set(brokenVal.findings.map((f) => f.code));

      assert(
        liveBundleVal.passed === true &&
          liveBundleVal.errors === 0 &&
          liveBundleVal.warnings === 0 &&
          fs.statSync(rulePath).size < 24000 &&
          fs.statSync(skillPath).size < 24000 &&
          brokenVal.passed === false &&
          brokenCodes.has('E004') &&
          brokenCodes.has('E006') &&
          brokenCodes.has('E007') &&
          brokenCodes.has('W101') &&
          brokenCodes.has('W103'),
        'Zero-dependency validateOkfBundle passes strict mode on workspace/bundle, catches E004/E006/E007/W101/W103, and keeps rules + SKILL.md below 24,000 bytes'
      );
    } finally {
      fs.rmSync(tmpValBundle, { recursive: true, force: true });
    }

    // 7. cleanGroundingLinks() snaps byte-offset citations out of multi-word `**bold**` and `` `code` `` spans,
    // and skips standalone bold list-group headers (`1. **Section Header**:`) just like `##` headings
    const boldAndCodePrefix = '---\ntype: Regulatory Guide\ntitle: Span Snap Test\nstatus: draft\n---\n\n';
    const standaloneHeaderLine = '1. **Drill Frequency and Inspection Intervals (Functional Rule vs. Local Practice)**:';
    const proseBulletLine =
      '- **[Core Safety Standard (`REG-2020-05-01`)](/references/std-core.md)**: Requires **automatic fire suppression systems** and `ISO-24113` compliance in active facilities.';
    const rawSpanMd = `${boldAndCodePrefix}${standaloneHeaderLine}\n${proseBulletLine}\n`;
    const pfxBytes = Buffer.byteLength(boldAndCodePrefix, 'utf-8');
    const midHeaderOffset = pfxBytes + Buffer.byteLength('1. **Drill Frequency', 'utf-8');
    const line2StartBytes = pfxBytes + Buffer.byteLength(`${standaloneHeaderLine}\n`, 'utf-8');
    const midNestedCodeBoldLinkOffset =
      line2StartBytes + Buffer.byteLength('- **[Core Safety Standard (`REG-2020', 'utf-8');
    const midMultiWordBoldOffset =
      line2StartBytes +
      Buffer.byteLength(
        '- **[Core Safety Standard (`REG-2020-05-01`)](/references/std-core.md)**: Requires **automatic fire',
        'utf-8'
      );
    const midInlineCodeOffset =
      line2StartBytes +
      Buffer.byteLength(
        '- **[Core Safety Standard (`REG-2020-05-01`)](/references/std-core.md)**: Requires **automatic fire suppression systems** and `ISO-',
        'utf-8'
      );
    const snappedSpanMd = await cleanGroundingLinks(rawSpanMd, [
      {
        type: 'model_output',
        content: [
          {
            type: 'text',
            text: rawSpanMd,
            annotations: [
              {
                type: 'url_citation',
                url: 'https://authority.example.gov/header-ignored',
                title: 'Header Ignored Source',
                start_index: pfxBytes,
                end_index: midHeaderOffset,
              },
              {
                type: 'url_citation',
                url: 'https://authority.example.gov/std-core',
                title: 'Core Safety Authority',
                start_index: line2StartBytes,
                end_index: midNestedCodeBoldLinkOffset,
              },
              {
                type: 'url_citation',
                url: 'https://authority.example.gov/suppression',
                title: 'Suppression Authority',
                start_index: line2StartBytes + 10,
                end_index: midMultiWordBoldOffset,
              },
              {
                type: 'url_citation',
                url: 'https://authority.example.gov/iso',
                title: 'ISO Registry',
                start_index: line2StartBytes + 20,
                end_index: midInlineCodeOffset,
              },
            ],
          },
        ],
      },
    ]);
    assert(
      snappedSpanMd.includes(standaloneHeaderLine) &&
        !snappedSpanMd.includes('header-ignored') &&
        snappedSpanMd.includes('**[Core Safety Standard (`REG-2020-05-01`)](/references/std-core.md)**[^') &&
        snappedSpanMd.includes('**automatic fire suppression systems**[^') &&
        snappedSpanMd.includes('`ISO-24113`[^'),
      'cleanGroundingLinks skips standalone bold list-group headers and snaps byte-offset citations cleanly outside nested `code` / `[link](...)` / `**bold**` spans'
    );

    // 8. Verify non-English `voicePersonas` English gloss stripping, `prosody.cardinals` section numeral expansion,
    // `spokenActionItem` normalization, and `application/xhtml+xml` Open-Data archive MIME grouping
    const glossMergedLocale = mergeIcmLocalePack({
      bcp47: 'nb-NO',
      languageName: 'Norwegian Bokmål',
      prosody: {
        section: 'paragraf',
        sections: 'paragrafene',
        to: 'til',
        cardinals: {
          '0': 'null',
          '2': 'to',
          '3': 'tre',
          '4': 'fire',
          '5': 'fem',
          '8': 'åtte',
          '10': 'ti',
          '11': 'elleve',
          '12': 'tolv',
          '13': 'tretten',
          '14': 'fjorten',
          '18': 'atten',
        },
        voicePersonas: {
          warmGuideFemale:
            'En varm kvinnelig kursleder som snakker standard østnorsk (Urban East Norwegian) (nb-NO) med tydelig uttale (østlandsk bokmål).',
          warmGuideMale:
            'En varm mannlig kursleder som snakker standard østnorsk (Urban East Norwegian) med tydelig uttale.',
          calmSpecialistMale:
            'En rolig mannlig fagspesialist som snakker standard østnorsk (Standard Eastern Norwegian) i jevnt tempo.',
          calmSpecialistFemale:
            'En rolig kvinnelig fagspesialist som snakker standard østnorsk (Urban East Norwegian) i jevnt tempo.',
        },
      },
    });
    const cardinalSectionTts = prepareTextForStudioTts(
      'Kontroller at kravene i forskriften § 5[^lovdata-brann], § 8, § 11-2, TEK17 paragraf 11-12, § 13, §§ 4–10, §§ 11-11 til 11-14 og §§ 11 og 12 følges på avdeling (0–3 år) i bygg oppført før 1984.',
      glossMergedLocale
    );
    const verifiedStage2Set = new Set(['dibk-tek17-11-2', 'dsb-veiledning']);
    const verifiedUrlMap = new Map([
      ['https://www.dibk.no/tek17/11-2', 'dibk-tek17-11-2'],
    ]);
    const sanitizedStage2WithCites = sanitizeSpokenJson(
      {
        title: 'Brannvern i barnehagen[^dibk-tek17-11-2]',
        scriptBody:
          'Ordinære barnehager hører under risikoklasse 3[^dibk-tek17-11-2] og følger veiledningen[^hallucinated-id] (https://www.dibk.no/tek17/11-2) og https://unverified.example.com/blog.',
        overviewVisualPrompt: 'Warm timber kindergarten interior[^dibk-tek17-11-2]',
        trainingModules: [
          {
            title: 'Modul 1[^dsb-veiledning]',
            narration: 'Krav om øvelser[DSB](verified-source:dsb-veiledning).',
            spokenNarration: 'Muntlig tekst[^dsb-veiledning].',
            slideCues: ['Frie rømningsveier[^dsb-veiledning]'],
            actionItem: 'Gjennomgå rutiner[^dsb-veiledning][^fake-ref].',
          },
        ],
        quiz: [
          {
            question: 'Hvilken risikoklasse gjelder[^dibk-tek17-11-2]?',
            options: ['Risikoklasse 3[^dibk-tek17-11-2]', 'Risikoklasse 6'],
            explanation: 'Se TEK17 § 11-2[^dibk-tek17-11-2].',
          },
        ],
      },
      verifiedStage2Set,
      verifiedUrlMap
    );
    const spokenActionNorm = normalizeStage2ForA2ui(
      {
        title: 'Testkurs',
        scriptBody: 'Oversikt.',
        trainingModules: [
          {
            moduleNumber: 1,
            title: 'Modul 1',
            durationMinutes: 5,
            narration: 'Visuell tekst.',
            spokenNarration: 'Muntlig tekst.',
            slideCues: ['Punkt 1'],
            actionItem: 'Sjekk brannvernperm etter § 5.',
            spokenActionItem: 'Sjekk brannvernpermen etter paragraf fem.',
          },
        ],
      },
      'Testkurs'
    );
    assert(
      !glossMergedLocale.prosody.voicePersonas.warmGuideFemale.includes('Urban East') &&
        !glossMergedLocale.prosody.voicePersonas.warmGuideFemale.includes('nb-NO') &&
        glossMergedLocale.prosody.voicePersonas.warmGuideFemale.includes('(østlandsk bokmål)') &&
        !glossMergedLocale.prosody.voicePersonas.calmSpecialistMale.includes('Standard Eastern Norwegian') &&
        cardinalSectionTts.includes(
          'paragraf fem, paragraf åtte, paragraf elleve-to, TEK17 paragraf elleve-tolv, paragraf tretten, paragrafene fire til ti, paragrafene elleve-elleve til elleve-fjorten og paragrafene elleve og tolv'
        ) &&
        !cardinalSectionTts.includes('lovdata-brann') &&
        cardinalSectionTts.includes('(0 til 3 år)') &&
        cardinalSectionTts.includes('før 1984.') &&
        sanitizedStage2WithCites.title === 'Brannvern i barnehagen' &&
        sanitizedStage2WithCites.overviewVisualPrompt === 'Warm timber kindergarten interior' &&
        sanitizedStage2WithCites.scriptBody.includes('risikoklasse 3[^dibk-tek17-11-2]') &&
        !sanitizedStage2WithCites.scriptBody.includes('hallucinated-id') &&
        !sanitizedStage2WithCites.scriptBody.includes('unverified.example.com') &&
        sanitizedStage2WithCites.trainingModules[0].title === 'Modul 1' &&
        (sanitizedStage2WithCites.trainingModules[0].narration === 'Krav om øvelser DSB[^dsb-veiledning].' ||
          sanitizedStage2WithCites.trainingModules[0].narration === 'Krav om øvelserDSB[^dsb-veiledning].') &&
        sanitizedStage2WithCites.trainingModules[0].spokenNarration === 'Muntlig tekst.' &&
        sanitizedStage2WithCites.trainingModules[0].slideCues[0] === 'Frie rømningsveier[^dsb-veiledning]' &&
        sanitizedStage2WithCites.trainingModules[0].actionItem === 'Gjennomgå rutiner[^dsb-veiledning].' &&
        sanitizedStage2WithCites.quiz[0].question === 'Hvilken risikoklasse gjelder?' &&
        sanitizedStage2WithCites.quiz[0].options[0] === 'Risikoklasse 3' &&
        sanitizedStage2WithCites.quiz[0].explanation === 'Se TEK17 § 11-2[^dibk-tek17-11-2].' &&
        spokenActionNorm.modules[0]?.actionItem === 'Sjekk brannvernperm etter § 5.' &&
        spokenActionNorm.modules[0]?.spokenActionItem === 'Sjekk brannvernpermen etter paragraf fem.',
      'Stage 2 preserves verified [^id] citations on prose/explanations, strips unknown [^id] and URLs, keeps titles/visualPrompts/options clean, and expands spelled-out paragraf 11-12'
    );

    // 9. Reference extraction integrity gates (`X-OKS-W01` mid-sentence truncation & `X-OKS-W02` missing scoped title target)
    // and `loadWorkspaceLayers` quarantine of `references/*.md` frontmatter `description:`
    const crossDomainFinanceBroken = inspectReferenceExtractionIntegrity({
      relPath: 'references/filing-item1a.md',
      type: 'Reference',
      title: 'Annual Filing – Item 1A Risk Factors',
      body: 'Cover Page: Fiscal Year 2026. Part I. Item 1. Business Overview and Operations. '.repeat(8).trim(),
    });
    const crossDomainFinanceClean = inspectReferenceExtractionIntegrity({
      relPath: 'references/filing-item1a.md',
      type: 'Reference',
      title: 'Annual Filing – Item 1A Risk Factors',
      body: '## Item 1A. Risk Factors\n\nSupply chain and market liquidity risks are evaluated quarterly. '.repeat(5).trim(),
    });
    const crossDomainIsoNoFalsePositive = inspectReferenceExtractionIntegrity({
      relPath: 'references/iso-overview.md',
      type: 'Reference',
      title: 'Information Security Management (ISO 27001)',
      body: 'Access control, asset inventory, and cryptographic key lifecycle controls apply organization-wide. '.repeat(5).trim(),
    });
    assert(
      crossDomainFinanceBroken.missingTitleTarget === 'Item 1A' &&
        !crossDomainFinanceClean.missingTitleTarget &&
        !crossDomainIsoNoFalsePositive.missingTitleTarget,
      'inspectReferenceExtractionIntegrity verifies scoped <Label> <N> title designators across arbitrary non-legal domains without false positives on parenthetical ALL-CAPS standard codes'
    );
    const tmpRefGateWs = fs.mkdtempSync(path.join(os.tmpdir(), 'icm-ref-gate-'));
    try {
      const refGateBundle = path.join(tmpRefGateWs, 'bundle');
      fs.mkdirSync(path.join(refGateBundle, 'references'), { recursive: true });
      fs.writeFileSync(
        path.join(refGateBundle, 'index.md'),
        '---\nokf_version: "0.3"\n---\n# Index\n\n- [Ref](/references/broken-ch11.md)\n- [Clean](/references/clean-ch11.md)\n',
        'utf-8'
      );
      const preambleTocPadding =
        'Hjemmel: Fastsatt med hjemmel i lov om planlegging § 11-1. Innhold: Kapittel 1. Felles bestemmelser § 1-1. Formål. '.repeat(
          6
        ) + '\nKapittel 9. Ytre miljø § 9-9. Sluttrapport for faktisk disponeri';
      fs.writeFileSync(
        path.join(refGateBundle, 'references', 'broken-ch11.md'),
        [
          '---',
          'type: Reference',
          'title: Building Code – Kapittel 11 Fire Safety',
          'description: Parametric hallucination (SENTINEL_UNVERIFIED_CLASS_99).',
          'status: stable',
          'generated: { by: open-data-sync/1.0, at: "2026-11-23T12:00:00Z" }',
          'verified:',
          '  - { by: open-data-sync/1.0, at: "2026-11-23T12:00:00Z" }',
          'stale_after: "2099-01-01T00:00:00Z"',
          'sources:',
          '  - id: reg-ch11',
          '    resource: https://api.example.gov/regulations.tar.bz2#reg.xml',
          '    title: Official Building Code',
          '    mime_type: application/xml',
          '---',
          '',
          preambleTocPadding,
          '',
          '[^reg-ch11]: Official Building Code',
        ].join('\n'),
        'utf-8'
      );
      const cleanCh11Body =
        '## Kapittel 11. Sikkerhet ved brann\n\n### § 11-2. Risikoklasser\n\n| Virksomhet | Risikoklasse |\n| --- | --- |\n| Barnehage | 3 |\n| Forsamlingslokale | 5 |\n\n' +
        'Ordinære barnehager for dagopphold plasseres i risikoklasse 3[^reg-clean]. '.repeat(8).trim();
      fs.writeFileSync(
        path.join(refGateBundle, 'references', 'clean-ch11.md'),
        [
          '---',
          'type: Reference',
          'title: Building Code – Kapittel 11 Fire Safety',
          'description: Neutral chapter scope (SENTINEL_REF_DESC_QUARANTINED).',
          'status: stable',
          'generated: { by: open-data-sync/1.0, at: "2026-11-23T12:00:00Z" }',
          'verified:',
          '  - { by: open-data-sync/1.0, at: "2026-11-23T12:00:00Z" }',
          'stale_after: "2099-01-01T00:00:00Z"',
          'sources:',
          '  - id: reg-clean',
          '    resource: https://api.example.gov/regulations.tar.bz2#clean.xml',
          '    title: Official Building Code Clean',
          '    mime_type: application/xml',
          '---',
          '',
          cleanCh11Body,
          '',
          '[^reg-clean]: Official Building Code Clean',
        ].join('\n'),
        'utf-8'
      );
      const strictRefGateVal = validateOkfBundle(refGateBundle, { strict: true });
      const findingCodesByFile = strictRefGateVal.findings.map(
        (f) => `${path.posix.basename(f.path.replace(/\\/g, '/'))}:${f.code}`
      );
      const hydratedGateCtx = loadWorkspaceLayers(tmpRefGateWs, 'Fire safety building code').bundleContext;
      assert(
        strictRefGateVal.passed === false &&
          findingCodesByFile.includes('broken-ch11.md:X-OKS-W01') &&
          findingCodesByFile.includes('broken-ch11.md:X-OKS-W02') &&
          !findingCodesByFile.some((x) => x.startsWith('clean-ch11.md:')) &&
          !hydratedGateCtx.includes('SENTINEL_UNVERIFIED_CLASS_99') &&
          !hydratedGateCtx.includes('SENTINEL_REF_DESC_QUARANTINED') &&
          hydratedGateCtx.includes('[/references/broken-ch11.md] **Building Code – Kapittel 11 Fire Safety** (Reference, trust_tier: unverified)') &&
          hydratedGateCtx.includes('[/references/clean-ch11.md] **Building Code – Kapittel 11 Fire Safety** (Reference, trust_tier: machine-confirmed)'),
        'validateOkfBundle --strict catches X-OKS-W01 mid-sentence truncation and X-OKS-W02 missing scoped title targets on Reference files, and loadWorkspaceLayers quarantines Reference descriptions while demoting defective extractions to unverified'
      );
    } finally {
      fs.rmSync(tmpRefGateWs, { recursive: true, force: true });
    }

    // 10. Checklist / bullet leading list-marker stripping & 3+ comma-enumerated section-list prosody expansion
    const bulletNormalized = normalizeStage2ForA2ui(
      {
        title: 'Checklist Bullet Hygiene',
        scriptBody: 'Overview prose.',
        learningObjectives: ['- First objective[^src-a]', '2. Second objective'],
        checklistGroups: [
          {
            category: 'Daily Checks',
            items: [
              '- Inspect escape routes and doors[^src-a][^src-b].',
              '- [x] Verify alarm panel status.',
              '• Confirm roster availability.',
            ],
          },
        ],
        trainingModules: [
          {
            moduleNumber: 1,
            title: 'Module 1',
            durationMinutes: 5,
            narration: 'Module narration.',
            slideCues: ['* Cue one[^src-a]', '- Cue two'],
            actionItem: 'Walk the corridor.',
          },
        ],
      },
      'Fallback'
    );
    const nbMultiSecTts = prepareTextForStudioTts(
      'Etter §§ 3, 14 og 18 samt paragrafene 4, 5 og 11 og § 12–13 må avstanden være minst 3,5 meter.',
      glossMergedLocale
    );
    const enMultiSecTts = prepareTextForStudioTts(
      'Under §§ 2, 4, and 6 and sections 8, 10, or 12.',
      mergeIcmLocalePack({
        bcp47: 'en-US',
        prosody: {
          cardinals: {
            '2': 'two',
            '4': 'four',
            '6': 'six',
            '8': 'eight',
            '10': 'ten',
            '12': 'twelve',
          },
        },
      })
    );
    assert(
      bulletNormalized.highlights[0] === 'First objective[^src-a]' &&
        bulletNormalized.highlights[1] === 'Second objective' &&
        bulletNormalized.modules[0]?.bullets[0] === 'Cue one[^src-a]' &&
        bulletNormalized.modules[0]?.bullets[1] === 'Cue two' &&
        bulletNormalized.checklistGroups[0]?.items[0]?.label === 'Inspect escape routes and doors.' &&
        bulletNormalized.checklistGroups[0]?.items[0]?.checked === false &&
        bulletNormalized.checklistGroups[0]?.items[1]?.label === 'Verify alarm panel status.' &&
        bulletNormalized.checklistGroups[0]?.items[1]?.checked === true &&
        bulletNormalized.checklistGroups[0]?.items[2]?.label === 'Confirm roster availability.' &&
        nbMultiSecTts ===
          'Etter paragrafene tre, fjorten og atten samt paragrafene fire, fem og elleve og paragraf tolv til tretten må avstanden være minst 3,5 meter.' &&
        enMultiSecTts === 'Under sections two, four, and six and sections eight, ten, or twelve.',
      'normalizeStage2ForA2ui strips leading list/checkbox markers from checklistGroups/highlights/slideCues and prepareTextForStudioTts expands 3+ comma-enumerated section lists via cardinals'
    );

    // 11. Symmetric closed-class intra-family BCP-47 resolution (`nn-NO` vs `nb-NO` vs `da-DK`, `zh-TW` vs `zh-CN`, `be-BY`/`bg-BG`) & subtag preservation
    const longNnProse =
      'Dette dokumentet gjev ei oversikt over korleis dei ulike ledda skal fungere i lag på arbeidsplassen, og kvifor det ikkje er nok med berre muntlege avtalar når fleire einingar deler lokalar frå morgon til kveld (jf. Internkontrollforskriften). '.repeat(
        6
      );
    const longNbProse =
      'Dette dokumentet gir en oversikt over hvordan de ulike leddene skal fungere sammen på arbeidsplassen, og hvorfor det ikke er nok med bare muntlige avtaler når flere enheter deler lokaler fra morgen til kveld. '.repeat(
        6
      );
    const longDaProse =
      'Dette dokument beskriver hvorledes sikkerheden bliver varetaget gennem faste rutiner mellem afdelingerne, således at der ikke opstår nogen tvivl om ansvaret på arbejdspladsen. '.repeat(
        6
      );
    const tmpSubtagWs = fs.mkdtempSync(path.join(os.tmpdir(), 'icm-bcp47-subtag-'));
    try {
      saveWorkspaceLocale(tmpSubtagWs, mergeIcmLocalePack({ bcp47: 'nb-NO', languageName: 'Norwegian Bokmål' }));
      const nnDryLocale = await ensureWorkspaceLocaleConfig(tmpSubtagWs, longNnProse, { dryRun: true });
      saveWorkspaceLocale(tmpSubtagWs, mergeIcmLocalePack({ bcp47: 'fr-CA', languageName: 'Canadian French' }));
      const frKeepRegional = await ensureWorkspaceLocaleConfig(
        tmpSubtagWs,
        'Les équipes sont dans une phase importante pour les opérations avec plus de sécurité.',
        { dryRun: true }
      );
      assert(
        inferBcp47LanguageCode(longNnProse) === 'nn-NO' &&
          inferBcp47LanguageCode(longNbProse) === 'nb-NO' &&
          inferBcp47LanguageCode(longDaProse) === 'da-DK' &&
          inferBcp47LanguageCode('我們這個研究為系統架構與資料安全提供了完整的驗證方法。') === 'zh-TW' &&
          inferBcp47LanguageCode('我们这个研究为系统架构与数据安全提供了完整的验证方法。') === 'zh-CN' &&
          inferBcp47LanguageCode('Гэта даследаванне паказвае ўплыў новых метадаў.') === 'be-BY' &&
          inferBcp47LanguageCode('Това изследване е свързано със системата, която няма аналог.') === 'bg-BG' &&
          nnDryLocale.locale.bcp47 === 'nn-NO' &&
          frKeepRegional.locale.bcp47 === 'fr-CA',
        'inferBcp47LanguageCode resolves intra-family sister standards symmetrically without shared-word bias and ensureWorkspaceLocaleConfig preserves distinct primary subtags and regional packs'
      );
    } finally {
      fs.rmSync(tmpSubtagWs, { recursive: true, force: true });
    }

    // 12. Verify A2UI v1.0 Tier-2 `FlowDiagram` catalog validation, Stage 2 diagram normalization, and fenced-diagram TTS stripping
    const flowSurfaceValidation = validateA2uiSurfaceMessages([
      {
        version: '1.0',
        createSurface: {
          surfaceId: 'diag_test',
          catalogId: 'https://a2ui.org/specification/v1_0/catalogs/basic/catalog.json',
          components: [
            { id: 'root', component: 'Column', children: ['diag_1'] },
            {
              id: 'diag_1',
              component: 'FlowDiagram',
              '@catalogId': A2UI_ICM_CATALOG_ID,
              title: 'System Hierarchy',
              direction: 'TD',
              nodes: [
                { id: 'n1', title: 'Core Standard', subtitle: 'ISO-100', bullets: ['Scope A'] },
                { id: 'n2', title: 'Operator', bullets: ['Daily checks'] },
              ],
              edges: [{ from: 'n1', to: 'n2', label: 'Applies to' }],
            },
          ],
        },
      },
    ]);
    const diagStage2Norm = normalizeStage2ForA2ui(
      {
        title: 'Diagram Course',
        scriptBody: 'Intro prose.\n\n```mermaid\nflowchart TD\n  A["Start"] --> B["End"]\n```\n\nClosing prose.',
        overviewDiagram: {
          title: 'Overview Map',
          nodes: [{ id: 'a', title: 'Parent' }, { id: 'b', title: 'Child' }],
          edges: [{ from: 'a', to: 'b' }],
        },
        trainingModules: [
          {
            moduleNumber: 1,
            title: 'Mod 1',
            durationMinutes: 5,
            narration: 'Module prose.',
            slideCues: ['Cue'],
            actionItem: 'Act.',
            diagram: 'flowchart LR\n  X["Input"] --> Y["Output"]',
          },
        ],
      },
      'Diagram Course'
    );
    const extractedMdDiags = extractDiagramsFromMarkdown(
      [
        '## Architecture',
        '```mermaid',
        'flowchart TD',
        '  Узел_1["Модуль А"] --> Узел_2["Модуль Б"]',
        '```',
        '',
        '```',
        '+--------------+      +--------------+',
        '|   Stage 1    | ---> |   Stage 2    |',
        '+--------------+      +--------------+',
        '```',
        '',
        '```',
        '+-----+-----+',
        '|  x  |  y  |',
        '+-----+-----+',
        '```',
      ].join('\n')
    );
    const ttsWithoutMermaid = prepareTextForStudioTts(diagStage2Norm.scriptBody, 'en-US');
    assert(
      flowSurfaceValidation.valid === true &&
        diagStage2Norm.overviewDiagram?.nodes?.length === 2 &&
        diagStage2Norm.modules[0]?.diagram?.mermaid?.includes('flowchart LR') &&
        diagStage2Norm.modules[0]?.diagram?.nodes?.length === 2 &&
        extractedMdDiags.length === 2 &&
        extractedMdDiags[0]?.direction === 'TD' &&
        extractedMdDiags[0]?.nodes?.[0]?.title === 'Модуль А' &&
        extractedMdDiags[1]?.direction === 'LR' &&
        extractedMdDiags[1]?.nodes?.length === 2 &&
        ttsWithoutMermaid === 'Intro prose.\n\nClosing prose.' &&
        !ttsWithoutMermaid.includes('flowchart'),
      'FlowDiagram validates cleanly in icm-okf-v0.3 catalog, extractDiagramsFromMarkdown extracts TD/LR/Unicode diagrams into A2UI data models, and prepareTextForStudioTts strips fenced diagram blocks'
    );
    // 13. Verify `curateOkfSources` & `healOrphanOkfFootnotes` preserve interior whitespace alignment inside fenced ``` blocks
    const fencedDiagramBody = [
      '```',
      '+-----------------------------------------+',
      '|        PRIMARY STANDARD (STD-1)         |',
      '+--------------------+--------------------+',
      '                     |',
      '       +-------------+-------------+',
      '       |                           |',
      '       v                           v',
      '+---------------+         +---------------+',
      '|   ENTITY A    | <-----> |   ENTITY B    |',
      '+---------------+         +---------------+',
      '```',
    ].join('\n');
    const docWithFenceAndRej = [
      '---',
      'type: Specification',
      'title: Fenced Diagram Preservation Test',
      'description: Ensures source rejection never collapses spaces inside fenced blocks.',
      'tags: [architecture, specification]',
      'status: draft',
      'generated: { by: icm-stage1/gemini-4-argon, at: 2026-11-24T12:00:00Z }',
      'sources:',
      '  - id: primary-std',
      '    resource: https://standards.example.org/std-1',
      '    title: Primary Standard STD-1',
      '    mime_type: text/html',
      '    retrieved_at: 2026-11-24T12:00:00Z',
      '  - id: weak-blog',
      '    resource: https://blog.example.com/post',
      '    title: Weak Secondary Blog',
      '    mime_type: text/html',
      '    retrieved_at: 2026-11-24T12:00:00Z',
      '---',
      '',
      '# Fenced Diagram Preservation Test',
      '',
      'Baseline prose backed by both sources[^primary-std] [^weak-blog].',
      '',
      fencedDiagramBody,
      '',
      '[^primary-std]: Primary Standard STD-1',
      '[^weak-blog]: Weak Secondary Blog',
    ].join('\n');
    const curatedWithFence = curateOkfSources(docWithFenceAndRej, {
      rejectSourceIds: ['weak-blog'],
    });
    const healedFenceParsed = parseOkfDocument(curatedWithFence.markdown);
    healOrphanOkfFootnotes(healedFenceParsed);
    const collapsedFenceDiags = extractDiagramsFromMarkdown(
      fencedDiagramBody.replace(/(?<=\S)[ \t]{2,}/g, ' ')
    );
    assert(
      curatedWithFence.markdown.includes(fencedDiagramBody) &&
        healedFenceParsed.body.includes(fencedDiagramBody) &&
        !curatedWithFence.markdown.includes('[^weak-blog]') &&
        collapsedFenceDiags.length === 1 &&
        collapsedFenceDiags[0]?.nodes?.length === 3 &&
        collapsedFenceDiags[0]?.edges?.length === 3,
      'curateOkfSources and healOrphanOkfFootnotes preserve exact whitespace inside fenced code blocks, and extractDiagramsFromMarkdown self-heals space-collapsed ASCII diagrams'
    );
    // 14. Verify dominant-script BCP-47 resilience, BPE script-outlier sanitization, and Stage 4 TTS language_code fallback
    const samiWithBpeGlitch =
      'Dát oahppogirji čilge mot vuogádat galgá doaibmat sihke árgabeaivve ja erenoamáš dilálašvuođain. ' +
      'Juohke oassi lea čadnojuvvon vuođđonjuolggadusaide, ja geaidnu galgá doalahit johtinfریجvuođa (standard clause) ' +
      'vai máŋgga هەوا/eallima suodjaleapmi sihkkarastojuvvo, বিশেষकर dalle go resursat leat unnit.';
    const englishWithMathGreek =
      'The thermal conductivity model evaluates α = 0.05, ΔT = 12 °C, and μ = 3.2 across the primary boundary layer ' +
      'while ensuring that the control loop remains stable under transient load perturbations.';
    const cleanedBpeProse = sanitizeDominantScriptBpeOutliers(
      `${samiWithBpeGlitch} Intentional gloss (العربية) and math Δx = 2 with студиоundervisar and ланjаin.`
    );
    const preservedMinorityPrompt = resolveStage4VoiceDesignPrompt({
      baseVoice: 'Sulafat',
      languageCode: 'cy-GB',
      speakerRole: 'guide',
      explicitPrompt: 'Llais benywaidd cynnes a chlir yn siarad Cymraeg safonol gyda chyflymder naturiol.',
    });

    const origFetchTts = globalThis.fetch;
    const origKeyTts = process.env.GEMINI_API_KEY;
    const seenVoicePayloads: any[] = [];
    const seenTtsPayloads: any[] = [];
    try {
      process.env.GEMINI_API_KEY = 'test-key-minority-tts';
      const dummyWavB64 = wrapPcm16InWavHeader(Buffer.alloc(480, 0), 24000, 1).toString('base64');
      globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
        const urlStr = String(url);
        const bodyObj = init?.body ? JSON.parse(String(init.body)) : {};
        if (urlStr.includes('/voices')) {
          seenVoicePayloads.push(bodyObj);
          if (bodyObj?.voice?.language_code === 'se-NO') {
            return new Response(
              JSON.stringify({ error: { code: 400, message: 'Invalid or unsupported language_code: se-NO' } }),
              { status: 400, statusText: 'Bad Request' }
            );
          }
          return new Response(
            JSON.stringify({
              id: 'voice_sami_lock01',
              display_name: bodyObj?.voice?.display_name,
              sample_audio: { data: dummyWavB64 },
              usage: { total_input_tokens: 40, total_output_tokens: 60, total_tokens: 100 },
            }),
            { status: 200, statusText: 'OK' }
          );
        }
        seenTtsPayloads.push(bodyObj);
        const sc = bodyObj?.generation_config?.speech_config;
        const langSent = Array.isArray(sc) ? sc[0]?.language : sc?.speakers?.[0]?.language;
        if (langSent === 'se-NO') {
          return new Response(
            JSON.stringify({ error: { code: 400, message: 'Unsupported language code: se-NO' } }),
            { status: 400, statusText: 'Bad Request' }
          );
        }
        return new Response(
          JSON.stringify({
            id: 'inter_tts_fallback',
            status: 'completed',
            outputs: [{ type: 'audio', data: dummyWavB64, mime_type: 'audio/wav' }],
            usage: { total_input_tokens: 30, total_output_tokens: 50, total_tokens: 80 },
          }),
          { status: 200, statusText: 'OK' }
        );
      }) as typeof fetch;

      const voiceFallbackRes = await createPromptedVoice({
        promptInput: 'Čielga ja oadjebas davvisámegielat studioráđđeaddi.',
        baseVoice: 'Sulafat',
        languageCode: 'se-NO',
        displayName: 'Sulafat (se-NO)',
      });
      const ttsFallbackRes1 = await generateFlashTtsAudioInteraction({
        transcriptText: 'Bures boahtin dán oahpahussii.',
        voice: voiceFallbackRes.id,
        languageCode: 'se-NO',
      });
      const ttsFallbackRes2 = await generateFlashTtsAudioInteraction({
        transcriptText: 'Nubbi oassi joatká njuolga.',
        voice: voiceFallbackRes.id,
        languageCode: 'se-NO',
      });

      assert(
        inferBcp47LanguageCode(samiWithBpeGlitch) === 'se-NO' &&
          inferBcp47LanguageCode(englishWithMathGreek) === 'en-US' &&
          inferBcp47LanguageCode('مرحبا بكم في هذا الدليل الشامل للسلامة والأنظمة الحديثة') === 'ar-SA' &&
          inferBcp47LanguageCode('Αυτός ο οδηγός παρουσιάζει τις βασικές αρχές του συστήματος') === 'el-GR' &&
          cleanedBpeProse.includes('johtinfvuođa') &&
          cleanedBpeProse.includes('máŋgga eallima') &&
          !cleanedBpeProse.includes('বিশেষकर') &&
          cleanedBpeProse.includes('(العربية)') &&
          cleanedBpeProse.includes('Δx = 2') &&
          cleanedBpeProse.includes('studioundervisar') &&
          cleanedBpeProse.includes('lanjain') &&
          preservedMinorityPrompt?.startsWith('Llais benywaidd') === true &&
          voiceFallbackRes.id === 'voice_sami_lock01' &&
          seenVoicePayloads.length === 2 &&
          seenVoicePayloads[1]?.voice?.language_code === undefined &&
          seenVoicePayloads[1]?.voice?.region_code === 'NO' &&
          ttsFallbackRes1.audioBuffer.length > 44 &&
          ttsFallbackRes2.audioBuffer.length > 44 &&
          seenTtsPayloads.length === 3 &&
          seenTtsPayloads[2]?.generation_config?.speech_config?.[0]?.language === undefined,
        'Dominant-script BCP-47 detection ignores stray BPE/math symbols, sanitizeDominantScriptBpeOutliers cleans chimeric tokens while preserving glosses/math, and Stage 4 TTS falls back cleanly on unlisted language_code tags'
      );
    } finally {
      globalThis.fetch = origFetchTts;
      if (origKeyTts === undefined) delete process.env.GEMINI_API_KEY;
      else process.env.GEMINI_API_KEY = origKeyTts;
    }

    // 15. Verify Gemini TTS native-catalog gate, IEEE-float / heterogeneous WAV PCM normalization, and provider-abstract HTTP Open-TTS Stage 4 synthesis
    const {
      extractNormalizedMono16PcmFromWav,
      isGeminiTtsNativelySupported,
      buildExternalHttpTtsUrl,
      generateExternalHttpTtsAudio,
    } = await import('../interactions/index.js');

    // Construct a synthetic 32-bit IEEE float stereo 16 kHz RIFF/WAVE clip and normalize to 22,050 Hz 16-bit mono
    const floatStereoFrames = 160;
    const floatStereoData = Buffer.alloc(floatStereoFrames * 2 * 4);
    for (let i = 0; i < floatStereoFrames; i++) {
      const sample = Math.sin((2 * Math.PI * i) / 32) * 0.5;
      floatStereoData.writeFloatLE(sample, i * 8);
      floatStereoData.writeFloatLE(sample * 0.5, i * 8 + 4);
    }
    const floatWavHeader = Buffer.alloc(44);
    floatWavHeader.write('RIFF', 0, 'ascii');
    floatWavHeader.writeUInt32LE(36 + floatStereoData.length, 4);
    floatWavHeader.write('WAVE', 8, 'ascii');
    floatWavHeader.write('fmt ', 12, 'ascii');
    floatWavHeader.writeUInt32LE(16, 16);
    floatWavHeader.writeUInt16LE(3, 20); // IEEE float = 3
    floatWavHeader.writeUInt16LE(2, 22); // stereo = 2
    floatWavHeader.writeUInt32LE(16000, 24);
    floatWavHeader.writeUInt32LE(16000 * 2 * 4, 28);
    floatWavHeader.writeUInt16LE(8, 32);
    floatWavHeader.writeUInt16LE(32, 34);
    floatWavHeader.write('data', 36, 'ascii');
    floatWavHeader.writeUInt32LE(floatStereoData.length, 40);
    const floatStereoWav = Buffer.concat([floatWavHeader, floatStereoData]);
    const normalizedFromFloat = extractNormalizedMono16PcmFromWav(floatStereoWav, 22050);

    const resolvedOpenTtsUrl = buildExternalHttpTtsUrl(
      'https://open-tts.example.edu/tts/{lang}/{voice}',
      {
        text: 'Sample regional sentence.',
        voice: 'speaker_f',
        speaker: 'Guide',
        languageCode: 'se-NO',
      }
    );

    const origFetchOpenTts = globalThis.fetch;
    const seenOpenTtsCalls: Array<{ url: string; method: string; body: any }> = [];
    try {
      const wav22k = wrapPcm16InWavHeader(Buffer.alloc(2205 * 2, 64), 22050, 1);
      globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
        const u = String(url);
        const m = String(init?.method || 'GET').toUpperCase();
        const b = init?.body ? JSON.parse(String(init.body)) : null;
        seenOpenTtsCalls.push({ url: u, method: m, body: b });
        if (u.endsWith('/speaker_m')) {
          return new Response(
            JSON.stringify({ audio: floatStereoWav.toString('base64'), mime_type: 'audio/wav' }),
            { status: 200, headers: { 'content-type': 'application/json' } }
          );
        }
        return new Response(new Uint8Array(wav22k), {
          status: 200,
          headers: { 'content-type': 'audio/wav' },
        });
      }) as typeof fetch;

      const stitchedOpenTts = await generateExternalHttpTtsAudio({
        endpointTemplate: 'https://open-tts.example.edu/tts/{lang}/{voice}',
        languageCode: 'se-NO',
        turns: [
          { speaker: 'Guide', voice: 'speaker_f', text: 'First CODE17 paragraph.\n\nSecond ISO9001 paragraph.' },
          { speaker: 'Specialist', voice: 'speaker_m', text: 'Third binding CO2 clause.' },
        ],
      });
      const stitchedMeta = parseWavMetadata(stitchedOpenTts.audioBuffer);

      assert(
        isGeminiTtsNativelySupported('nb-NO') === true &&
          isGeminiTtsNativelySupported('nn-NO') === true &&
          isGeminiTtsNativelySupported('en-US') === true &&
          isGeminiTtsNativelySupported('fi-FI') === true &&
          isGeminiTtsNativelySupported('se-NO') === false &&
          isGeminiTtsNativelySupported('sma-NO') === false &&
          isGeminiTtsNativelySupported('smj-NO') === false &&
          isGeminiTtsNativelySupported('cy-GB') === false &&
          isGeminiTtsNativelySupported('mi-NZ') === false &&
          normalizedFromFloat !== null &&
          normalizedFromFloat.sampleRate === 22050 &&
          normalizedFromFloat.pcm.length > 300 &&
          resolvedOpenTtsUrl === 'https://open-tts.example.edu/tts/se/speaker_f' &&
          seenOpenTtsCalls.length === 3 &&
          seenOpenTtsCalls[0]?.url === 'https://open-tts.example.edu/tts/se/speaker_f' &&
          seenOpenTtsCalls[0]?.body?.text === 'First CODE 17 paragraph.' &&
          seenOpenTtsCalls[1]?.body?.text === 'Second ISO 9001 paragraph.' &&
          seenOpenTtsCalls[2]?.url === 'https://open-tts.example.edu/tts/se/speaker_m' &&
          seenOpenTtsCalls[2]?.body?.text === 'Third binding CO2 clause.' &&
          stitchedMeta.isWav === true &&
          stitchedMeta.sampleRate === 22050 &&
          stitchedMeta.channels === 1 &&
          stitchedMeta.bitsPerSample === 16 &&
          stitchedMeta.durationSeconds > 0.6,
        'isGeminiTtsNativelySupported gates unlisted languages, extractNormalizedMono16PcmFromWav converts stereo IEEE-float WAVs, and generateExternalHttpTtsAudio stitches multi-speaker Open-TTS WAV/JSON turns seamlessly'
      );

      // End-to-end Stage 4 Open-TTS HTTP contract + runStage4Flow verification (zero Gemini API key needed)
      const tmpOpenTtsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'icm-opentts-s4-'));
      try {
        const tmpWs = path.join(tmpOpenTtsDir, 'workspace');
        const tmpPrompts = path.join(tmpOpenTtsDir, 'prompts');
        const tmpRunId = 'opentts-run-1';
        const tmpS2Dir = path.join(tmpWs, 'runs', tmpRunId, 'stages', '02_script', 'output');
        const tmpS4Out = path.join(tmpWs, 'runs', tmpRunId, 'stages', '04_audio', 'output');
        fs.mkdirSync(tmpS2Dir, { recursive: true });
        fs.mkdirSync(tmpS4Out, { recursive: true });
        fs.mkdirSync(tmpPrompts, { recursive: true });
        // Stale voice_reference clip from a prior zero-shot run should be cleaned up automatically
        fs.writeFileSync(path.join(tmpS4Out, 'voice_reference_sulafat.wav'), Buffer.from('stale'));
        fs.writeFileSync(
          path.join(tmpS2Dir, 'script_draft.json'),
          JSON.stringify({
            title: 'Regional Safety Module',
            scriptBody: 'Everyday operational orientation for local teams.',
            trainingModules: [
              {
                moduleNumber: 1,
                title: 'Module One',
                durationMinutes: 3,
                narration: 'Practical team routine.\n\nMandatory § 4 statutory inspection requirement.',
                slideCues: ['Point A'],
                actionItem: 'Verify exit clearance daily.',
              },
            ],
          }),
          'utf-8'
        );
        fs.writeFileSync(
          path.join(tmpPrompts, '04_audio.md'),
          [
            '---',
            'ttsProvider: "http"',
            'ttsEndpoint: "https://open-tts.example.edu/tts/{lang}/{voice}"',
            'languageCode: "se-NO"',
            'dialogueMode: "semantic"',
            'primarySpeaker: "Guide"',
            'primaryVoice: "speaker_f"',
            'secondarySpeaker: "Specialist"',
            'secondaryVoice: "speaker_m"',
            'audioMimeType: "audio/wav"',
            'output:',
            '  format: audio',
            '---',
            '',
          ].join('\n'),
          'utf-8'
        );

        fs.writeFileSync(
          path.join(tmpPrompts, '03_visuals.md'),
          [
            '---',
            'model: gemini-nano-banana-2.1',
            'aspectRatio: "16:9"',
            'imageSize: "1K"',
            'output:',
            '  format: image',
            '---',
            'Scene direction: {{visualPrompt}}',
            '',
          ].join('\n'),
          'utf-8'
        );
        const mergedWithVisualCtx = mergeIcmLocalePack({
          bcp47: 'se-NO',
          languageName: 'Northern Sámi',
          visualContext:
            'Subarctic birch landscape, vernacular timber structures, and practical everyday outdoor workwear with subtle woven regional craft accents; zero embedded text.',
        });
        saveWorkspaceLocale(tmpWs, mergedWithVisualCtx);
        const s3DryRes = await runStage3Flow({
          workspaceRoot: tmpWs,
          runId: tmpRunId,
          promptDir: tmpPrompts,
          dryRun: true,
        });
        const assembledS3 = fs.readFileSync(
          path.join(tmpWs, 'runs', tmpRunId, 'stages', '03_visuals', 'input', 'prompt_assembled.md'),
          'utf-8'
        );

        const prevKey = process.env.GEMINI_API_KEY;
        delete process.env.GEMINI_API_KEY;
        try {
          const parsedContract = loadStagePromptContract('04_audio', tmpPrompts);
          const dryRes = await runStage4Flow({
            workspaceRoot: tmpWs,
            runId: tmpRunId,
            promptDir: tmpPrompts,
            dryRun: true,
          });
          const liveRes = await runStage4Flow({
            workspaceRoot: tmpWs,
            runId: tmpRunId,
            promptDir: tmpPrompts,
            openBrowser: false,
          });
          const manifestJson = JSON.parse(
            fs.readFileSync(path.join(tmpS4Out, 'audio_manifest.json'), 'utf-8')
          );
          assert(
            s3DryRes.dryRun === true &&
              assembledS3.includes('Regional & Cultural Context: Subarctic birch landscape') &&
              parsedContract.ttsProvider === 'http' &&
              parsedContract.ttsEndpoint === 'https://open-tts.example.edu/tts/{lang}/{voice}' &&
              dryRes.dryRun === true &&
              dryRes.slotCount === 2 &&
              liveRes.success === true &&
              liveRes.items.length === 2 &&
              !fs.existsSync(path.join(tmpS4Out, 'voice_reference_sulafat.wav')) &&
              fs.existsSync(path.join(tmpS4Out, 'overview.wav')) &&
              fs.existsSync(path.join(tmpS4Out, 'module_01.wav')) &&
              manifestJson.ttsProvider === 'http' &&
              Array.isArray(manifestJson.voicesUsed) &&
              manifestJson.voicesUsed.join(',') === 'speaker_f,speaker_m',
            'runStage3Flow auto-injects Layer 3 locale visualContext, and runStage4Flow supports declarative ttsProvider: "http" Open-TTS synthesis, purges stale voice_reference clips, and writes audio_manifest.json + hydrated A2UI Studio'
          );
        } finally {
          if (prevKey !== undefined) process.env.GEMINI_API_KEY = prevKey;
        }
      } finally {
        fs.rmSync(tmpOpenTtsDir, { recursive: true, force: true });
      }
    } finally {
      globalThis.fetch = origFetchOpenTts;
    }
  }

  // P1 Regression: Multi-Run Zero-Base64 Disk HTML, Cross-Run Media Isolation, Priority-Capped Artifact WAVs, AGY_ARTIFACT_DIR Fallback & syncA2uiToArtifactDir Compatibility
  {
    const tmpR1Dir = fs.mkdtempSync(path.join(os.tmpdir(), 'icm-r1-test-'));
    const prevArtEnv = process.env.AGY_ARTIFACT_DIR;
    try {
      const ws = path.join(tmpR1Dir, 'workspace');
      const artDir = path.join(tmpR1Dir, 'artifact');
      const runA = 'run-alpha-1000000001';
      const runB = 'run-beta-1000000002';
      const runC = 'run gamma 1000000003';

      const tinyJpg = (tag: number) =>
        Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, tag, 0xff, 0xd9]);
      const wav500Kb = wrapPcm16InWavHeader(Buffer.alloc(500 * 1024, 0x22), 24000);

      const mkR1Run = (
        rId: string,
        title: string,
        opts: { jpgTag: number; withOverviewWav?: boolean; withModuleWav?: boolean }
      ) => {
        const rDir = path.join(ws, 'runs', rId);
        const s1Out = path.join(rDir, 'stages', '01_research', 'output');
        const s2Out = path.join(rDir, 'stages', '02_script', 'output');
        const s3Out = path.join(rDir, 'stages', '03_visuals', 'output');
        const s4Out = path.join(rDir, 'stages', '04_audio', 'output');
        fs.mkdirSync(s1Out, { recursive: true });
        fs.mkdirSync(s2Out, { recursive: true });
        fs.mkdirSync(s3Out, { recursive: true });
        fs.mkdirSync(s4Out, { recursive: true });
        fs.writeFileSync(
          path.join(s1Out, 'research_summary.md'),
          `---\ntitle: "${title}"\nstatus: stable\n---\n\n# ${title}\n\nSummary.\n`,
          'utf-8'
        );
        fs.writeFileSync(
          path.join(s2Out, 'script_draft.json'),
          JSON.stringify(
            {
              title,
              scriptBody: `Body for ${title}`,
              trainingModules: [{ number: 1, title: 'M1', narration: 'Narration 1' }],
              quiz: [{ id: 'q1', question: 'Q1?', options: ['A', 'B'], correctIndex: 0 }],
            },
            null,
            2
          ),
          'utf-8'
        );
        fs.writeFileSync(path.join(s3Out, 'overview.jpg'), tinyJpg(opts.jpgTag));
        if (opts.withOverviewWav) {
          fs.writeFileSync(path.join(s4Out, 'overview.wav'), wav500Kb);
        }
        if (opts.withModuleWav) {
          fs.writeFileSync(path.join(s4Out, 'module_01.wav'), wav500Kb);
        }
        fs.writeFileSync(path.join(rDir, 'meta.json'), JSON.stringify({ runId: rId, topic: title }), 'utf-8');
      };

      mkR1Run(runA, 'Alpha Course', { jpgTag: 0x01, withOverviewWav: true });
      mkR1Run(runB, 'Beta Course', { jpgTag: 0x02, withOverviewWav: true, withModuleWav: true });
      mkR1Run(runC, 'Gamma Course', { jpgTag: 0x03 });

      delete process.env.AGY_ARTIFACT_DIR;
      const diskRes = generateA2uiSurface(runA, { workspaceRoot: ws });
      const runAHtml = fs.readFileSync(diskRes.htmlOutputPath, 'utf-8');
      const runBHtml = fs.readFileSync(path.join(ws, 'runs', runB, 'a2ui.html'), 'utf-8');
      const runCHtml = fs.readFileSync(path.join(ws, 'runs', runC, 'a2ui.html'), 'utf-8');
      const bundleHtml = fs.readFileSync(diskRes.bundleHtmlPath!, 'utf-8');

      const parsePayloadFromHtml = (raw: string) => {
        const m = raw.match(/<script>\s*window\.A2UI_SURFACE_PAYLOAD\s*=\s*([\s\S]*?);\s*<\/script>/);
        return m ? JSON.parse(m[1]) : null;
      };
      const runAPayload = parsePayloadFromHtml(runAHtml);
      const runBPayload = parsePayloadFromHtml(runBHtml);
      const bundlePayload = parsePayloadFromHtml(bundleHtml);

      const mkHooks = (p: any) => {
        const h: Record<string, any> = {};
        // eslint-disable-next-line no-new-func
        new Function('window', A2UI_STUDIO_JS)({ A2UI_SURFACE_PAYLOAD: p, __ICM_TEST_HOOKS__: h });
        return h;
      };
      const runAHooks = mkHooks(runAPayload);
      const runBHooks = mkHooks(runBPayload);
      const bundleHooks = mkHooks(bundlePayload);

      assert(
        DEFAULT_MAX_ARTIFACT_AUDIO_BYTES === 128 * 1024 * 1024 &&
          ![runAHtml, runBHtml, runCHtml, bundleHtml].some(
            (h) => h.includes('data:image/jpeg;base64,') || h.includes('data:audio/wav;base64,')
          ) &&
          runAPayload?.mediaBaseMode === 'run' &&
          runAPayload?.hostRunId === runA &&
          runBPayload?.mediaBaseMode === 'run' &&
          runBPayload?.hostRunId === runB &&
          bundlePayload?.mediaBaseMode === 'bundle' &&
          bundlePayload?.hostRunId === '' &&
          Object.keys(runAPayload?.mediaUrisByRun || {}).length === 0 &&
          Object.keys(runBPayload?.mediaUrisByRun || {}).length === 0 &&
          Object.keys(bundlePayload?.mediaUrisByRun || {}).length === 0 &&
          runAHooks.resolveClientMediaUri('./stages/04_audio/output/overview.wav', {
            dataModel: { meta: { runId: runA } },
          }) === './stages/04_audio/output/overview.wav' &&
          runAHooks.resolveClientMediaUri('stages/04_audio/output/overview.wav', {
            dataModel: { meta: { runId: runB } },
          }) === `../${encodeURIComponent(runB)}/stages/04_audio/output/overview.wav` &&
          runAHooks.resolveClientMediaUri('./stages/03_visuals/output/overview.jpg', {
            dataModel: { meta: { runId: runC } },
          }) === `../${encodeURIComponent(runC)}/stages/03_visuals/output/overview.jpg` &&
          runBHooks.resolveClientMediaUri('./stages/04_audio/output/overview.wav', {
            dataModel: { meta: { runId: runB } },
          }) === './stages/04_audio/output/overview.wav' &&
          runBHooks.resolveClientMediaUri('./stages/04_audio/output/overview.wav', {
            dataModel: { meta: { runId: runA } },
          }) === `../${encodeURIComponent(runA)}/stages/04_audio/output/overview.wav` &&
          bundleHooks.resolveClientMediaUri('./stages/03_visuals/output/overview.jpg', {
            dataModel: { meta: { runId: runC } },
          }) === `../runs/${encodeURIComponent(runC)}/stages/03_visuals/output/overview.jpg`,
        'R1 disk HTMLs (primary run, sibling runs, bundle) emit zero Base64 and resolve relative paths accurately including URL-encoded runIds and stages/ paths'
      );

      // Active-run-first cumulative WAV cap in a2ui_studio.html & no cross-run fallback
      const artCapRes = generateA2uiSurface(runA, {
        workspaceRoot: ws,
        artifactDir: artDir,
        maxArtifactAudioBytes: 700 * 1024,
      });
      const artCapHtml = fs.readFileSync(artCapRes.artifactHtmlPath!, 'utf-8');
      const artCapPayload = parsePayloadFromHtml(artCapHtml);
      const artCapHooks = mkHooks(artCapPayload);

      const artRunAAudio = artCapHooks.resolveClientMediaUri('./stages/04_audio/output/overview.wav', {
        dataModel: { meta: { runId: runA } },
      });
      const artRunBAudio = artCapHooks.resolveClientMediaUri('./stages/04_audio/output/overview.wav', {
        dataModel: { meta: { runId: runB } },
      });
      const artRunCAudio = artCapHooks.resolveClientMediaUri('./stages/04_audio/output/overview.wav', {
        dataModel: { meta: { runId: runC } },
      });
      assert(
        artCapPayload?.mediaBaseMode === 'artifact' &&
          Boolean(artCapPayload?.mediaUrisByRun?.[runA]?.['./stages/03_visuals/output/overview.jpg']) &&
          Boolean(artCapPayload?.mediaUrisByRun?.[runB]?.['./stages/03_visuals/output/overview.jpg']) &&
          Boolean(artCapPayload?.mediaUrisByRun?.[runC]?.['./stages/03_visuals/output/overview.jpg']) &&
          artRunAAudio.startsWith('data:audio/wav;base64,') &&
          artRunBAudio === '' &&
          artRunCAudio === '' &&
          artCapHooks.isAllowedMediaUrl(artRunCAudio) === false,
        'R1 artifact HTML inlines all JPEGs, prioritizes active-run WAV under cumulative budget, excludes over-budget sibling WAVs, and never leaks across runs'
      );

      // Regression: stages/... (without ./) in artifact mode resolves ./stages/... in mediaUrisByRun[runId] without cross-run leak
      const artRunANoDotAudio = artCapHooks.resolveClientMediaUri('stages/04_audio/output/overview.wav', {
        dataModel: { meta: { runId: runA } },
      });
      const artRunBNoDotAudio = artCapHooks.resolveClientMediaUri('stages/04_audio/output/overview.wav', {
        dataModel: { meta: { runId: runB } },
      });
      const artReverseNoDotAudio = artCapHooks.resolveClientMediaUri(
        './stages/04_audio/output/overview.wav',
        { dataModel: { meta: { runId: runA } } },
        { [runA]: { 'stages/04_audio/output/overview.wav': 'data:audio/wav;base64,AAAA' } }
      );
      assert(
        artRunANoDotAudio === artRunAAudio &&
          artRunBNoDotAudio === '' &&
          artReverseNoDotAudio === 'data:audio/wav;base64,AAAA',
        'R1 resolveClientMediaUri normalizes ./stages/ and stages/ keys within mediaUrisByRun[runId] in artifact mode without cross-run fallback'
      );

      // maxArtifactAudioBytes: 0 edge case + AGY_ARTIFACT_DIR env fallback + syncA2uiToArtifactDir htmlContent fallback
      const artZeroRes = generateA2uiSurface(runA, {
        workspaceRoot: ws,
        artifactDir: artDir,
        maxArtifactAudioBytes: 0,
      });
      const artZeroPayload = parsePayloadFromHtml(fs.readFileSync(artZeroRes.artifactHtmlPath!, 'utf-8'));
      assert(
        Boolean(artZeroPayload?.mediaUrisByRun?.[runA]?.['./stages/03_visuals/output/overview.jpg']) &&
          !artZeroPayload?.mediaUrisByRun?.[runA]?.['./stages/04_audio/output/overview.wav'],
        'R1 maxArtifactAudioBytes: 0 suppresses all WAV inlining while retaining JPEGs'
      );

      const envArtDir = path.join(tmpR1Dir, 'artifact_env');
      process.env.AGY_ARTIFACT_DIR = envArtDir;
      const envArtRes = generateA2uiSurface(runA, {
        workspaceRoot: ws,
        maxArtifactAudioBytes: 0,
      });
      delete process.env.AGY_ARTIFACT_DIR;
      const envArtHtml = fs.readFileSync(envArtRes.artifactHtmlPath!, 'utf-8');
      const envArtPayload = parsePayloadFromHtml(envArtHtml);
      assert(
        envArtRes.artifactHtmlPath === path.join(envArtDir, 'a2ui_studio.html') &&
          envArtPayload?.mediaBaseMode === 'artifact',
        'R1 generateA2uiSurface honors AGY_ARTIFACT_DIR when options.artifactDir is omitted'
      );

      const legacyArtDir = path.join(tmpR1Dir, 'artifact_legacy');
      const legacySync = syncA2uiToArtifactDir({
        artifactDir: legacyArtDir,
        htmlOutputPath: diskRes.htmlOutputPath,
        runId: runA,
      });
      const customArtDir = path.join(tmpR1Dir, 'artifact_custom');
      const customSync = syncA2uiToArtifactDir({
        artifactDir: customArtDir,
        htmlContent: '<html><body>custom-artifact</body></html>',
        runId: runA,
      });
      assert(
        Boolean(legacySync.artifactHtmlPath) &&
          fs.readFileSync(legacySync.artifactHtmlPath!, 'utf-8') === runAHtml &&
          Boolean(customSync.artifactHtmlPath) &&
          fs.readFileSync(customSync.artifactHtmlPath!, 'utf-8') ===
            '<html><body>custom-artifact</body></html>',
        'syncA2uiToArtifactDir supports both htmlContent and legacy htmlOutputPath copy'
      );
    } finally {
      if (prevArtEnv !== undefined) process.env.AGY_ARTIFACT_DIR = prevArtEnv;
      else delete process.env.AGY_ARTIFACT_DIR;
      fs.rmSync(tmpR1Dir, { recursive: true, force: true });
    }
  }

  // P2 Regression: Per-Run Tab Gating, switchActiveRun() Tab Swap & Preservation/Clamping, Dynamic isAnalysis Titles, & Sibling a2ui_surface.json Sync
  {
    const tmpR2Dir = fs.mkdtempSync(path.join(os.tmpdir(), 'icm-r2-test-'));
    try {
      const ws = path.join(tmpR2Dir, 'workspace');
      const run1Id = 'r2-course-1000000001';
      const run2Id = 'r2-analysis-1000000002';
      const run3Id = 'r2-stage1-1000000003';

      // Run 1: Stage 2 Course (checklist + modules + cases + quiz + highlights)
      const r1Dir = path.join(ws, 'runs', run1Id);
      fs.mkdirSync(path.join(r1Dir, 'stages', '01_research', 'output'), { recursive: true });
      fs.mkdirSync(path.join(r1Dir, 'stages', '02_script', 'output'), { recursive: true });
      fs.writeFileSync(
        path.join(r1Dir, 'stages', '01_research', 'output', 'research_summary.md'),
        '---\ntitle: "Course Run"\nstatus: stable\n---\n\n# Course Run\n\n- [ ] Check 1\n- [ ] Check 2\n',
        'utf-8'
      );
      fs.writeFileSync(
        path.join(r1Dir, 'stages', '02_script', 'output', 'script_draft.json'),
        JSON.stringify(
          {
            title: 'Course Run',
            scriptBody: 'Course overview.',
            highlights: ['H1'],
            trainingModules: [
              { number: 1, title: 'Mod 1', narration: 'N1' },
              { number: 2, title: 'Mod 2', narration: 'N2' },
            ],
            cases: [{ id: 'c1', title: 'Case 1', scenario: 'Scen 1', recommendedAction: 'Act 1' }],
            quiz: [
              { id: 'q1', question: 'Q1?', options: ['A', 'B'], correctIndex: 0 },
              { id: 'q2', question: 'Q2?', options: ['A', 'B'], correctIndex: 1 },
            ],
          },
          null,
          2
        ),
        'utf-8'
      );
      fs.writeFileSync(path.join(r1Dir, 'meta.json'), JSON.stringify({ runId: run1Id, topic: 'Course Run' }), 'utf-8');

      // Run 2: Stage 2 Analysis (0 checklist, decisionPillars, scenarios, 0 quiz, 0 highlights)
      const r2Dir = path.join(ws, 'runs', run2Id);
      fs.mkdirSync(path.join(r2Dir, 'stages', '01_research', 'output'), { recursive: true });
      fs.mkdirSync(path.join(r2Dir, 'stages', '02_script', 'output'), { recursive: true });
      fs.writeFileSync(
        path.join(r2Dir, 'stages', '01_research', 'output', 'research_summary.md'),
        '---\ntitle: "Analysis Run"\nstatus: stable\n---\n\n# Analysis Run\n\nThesis narrative without checklists.\n',
        'utf-8'
      );
      fs.writeFileSync(
        path.join(r2Dir, 'stages', '02_script', 'output', 'script_draft.json'),
        JSON.stringify(
          {
            title: 'Analysis Run',
            scriptBody: 'Executive thesis summary.',
            pillars: [
              { number: 1, title: 'Pillar 1', analysis: 'T1' },
              { number: 2, title: 'Pillar 2', analysis: 'T2' },
            ],
            scenarios: [{ id: 's1', title: 'Scenario 1', scenario: 'Bull case', recommendedAction: 'Hold' }],
          },
          null,
          2
        ),
        'utf-8'
      );
      fs.writeFileSync(path.join(r2Dir, 'meta.json'), JSON.stringify({ runId: run2Id, topic: 'Analysis Run' }), 'utf-8');

      // Run 3: Stage-1-only
      const r3Dir = path.join(ws, 'runs', run3Id);
      fs.mkdirSync(path.join(r3Dir, 'stages', '01_research', 'output'), { recursive: true });
      fs.writeFileSync(
        path.join(r3Dir, 'stages', '01_research', 'output', 'research_summary.md'),
        '---\ntitle: "Stage 1 Run"\nstatus: draft\n---\n\n# Stage 1 Run\n\nRaw research notes.\n',
        'utf-8'
      );
      fs.writeFileSync(
        path.join(r3Dir, 'meta.json'),
        JSON.stringify({ runId: run3Id, topic: 'Stage 1 Run', stage1Telemetry: { searchQueries: ['q1'] } }),
        'utf-8'
      );

      // Run 4: Stage 2 Analysis Memo with 0 modules & 0 highlights (only scenarios)
      const run4Id = 'r2-memo-1000000004';
      const r4Dir = path.join(ws, 'runs', run4Id);
      fs.mkdirSync(path.join(r4Dir, 'stages', '01_research', 'output'), { recursive: true });
      fs.mkdirSync(path.join(r4Dir, 'stages', '02_script', 'output'), { recursive: true });
      fs.writeFileSync(
        path.join(r4Dir, 'stages', '01_research', 'output', 'research_summary.md'),
        '---\ntitle: "Memo Run"\nstatus: stable\n---\n\n# Memo Run\n\nShort memo.\n',
        'utf-8'
      );
      fs.writeFileSync(
        path.join(r4Dir, 'stages', '02_script', 'output', 'script_draft.json'),
        JSON.stringify(
          {
            memoTitle: 'Memo Run',
            memoBody: 'Short executive memo without pillars or highlights.',
            scenarios: [{ id: 's1', title: 'Scenario A', scenario: 'Base case', recommendedAction: 'Monitor' }],
          },
          null,
          2
        ),
        'utf-8'
      );
      fs.writeFileSync(path.join(r4Dir, 'meta.json'), JSON.stringify({ runId: run4Id, topic: 'Memo Run' }), 'utf-8');

      const res = generateA2uiSurface({ workspaceRoot: ws, runId: run4Id });
      const primaryUpdateComps = (
        res.messages.find((m) => 'updateComponents' in m) as A2uiUpdateComponentsMessage
      ).updateComponents.components;
      const compById = Object.fromEntries(primaryUpdateComps.map((c) => [c.id, c]));
      const mainTabs = (compById.main_tabs as any).tabs as Array<{ title: string; child: string }>;

      const sib1RootJson = JSON.parse(fs.readFileSync(path.join(r1Dir, 'a2ui_surface.json'), 'utf-8'));
      const sib1StageJson = JSON.parse(
        fs.readFileSync(path.join(r1Dir, 'stages', '02_script', 'output', 'a2ui_surface.json'), 'utf-8')
      );
      const sib1JsonlExists = fs.existsSync(
        path.join(r1Dir, 'stages', '02_script', 'output', 'a2ui_surface.jsonl')
      );
      const sib1Validation = validateA2uiSurfaceMessages(sib1RootJson.messages);
      const sib1Comps = Object.fromEntries(
        (sib1RootJson.messages[1] as A2uiUpdateComponentsMessage).updateComponents.components.map((c) => [
          c.id,
          c,
        ])
      );

      const sib2RootJson = JSON.parse(fs.readFileSync(path.join(r2Dir, 'a2ui_surface.json'), 'utf-8'));
      const sib2StageJson = JSON.parse(
        fs.readFileSync(path.join(r2Dir, 'stages', '02_script', 'output', 'a2ui_surface.json'), 'utf-8')
      );
      const sib2Validation = validateA2uiSurfaceMessages(sib2RootJson.messages);
      const sib2Comps = Object.fromEntries(
        (sib2RootJson.messages[1] as A2uiUpdateComponentsMessage).updateComponents.components.map((c) => [
          c.id,
          c,
        ])
      );

      const sib3RootJson = JSON.parse(fs.readFileSync(path.join(r3Dir, 'a2ui_surface.json'), 'utf-8'));
      const sib3StageJson = JSON.parse(
        fs.readFileSync(path.join(r3Dir, 'stages', '01_research', 'output', 'a2ui_surface.json'), 'utf-8')
      );
      const sib3JsonlExists = fs.existsSync(
        path.join(r3Dir, 'stages', '01_research', 'output', 'a2ui_surface.jsonl')
      );
      const sib3Validation = validateA2uiSurfaceMessages(sib3RootJson.messages);
      const sib3Comps = Object.fromEntries(
        (sib3RootJson.messages[1] as A2uiUpdateComponentsMessage).updateComponents.components.map((c) => [
          c.id,
          c,
        ])
      );

      assert(
        res.tabCount === 4 &&
          mainTabs.map((t) => t.child).join(',') ===
            'tab_overview,tab_cases,tab_okf_markdown,tab_okf_graph' &&
          !mainTabs.some((t) => /\(0\)/.test(t.title)) &&
          JSON.stringify((compById.tab_overview as any).children) === '["overview_narration_card"]' &&
          (compById.tab_modules as any).title === 'Analytical Pillars & Valuation Deep-Dives' &&
          (compById.tab_cases as any).title === 'Scenario & Decision Simulator' &&
          Boolean(compById.overview_highlights_card) &&
          Boolean(compById.tab_checklist) &&
          Boolean(compById.tab_modules) &&
          Boolean(compById.tab_quiz) &&
          res.bundleRuns![0].tabs!.length === 7 &&
          res.bundleRuns![1].tabs!.length === 5 &&
          res.bundleRuns![2].tabs!.length === 3 &&
          res.bundleRuns![3].tabs!.length === 4 &&
          sib1Validation.valid === true &&
          JSON.stringify(sib1RootJson) === JSON.stringify(sib1StageJson) &&
          sib1JsonlExists &&
          (sib1Comps.tab_overview as any).children.includes('overview_highlights_card') &&
          (sib1Comps.overview_highlights_title as any).text ===
            '### Key Takeaways & Learning Objectives' &&
          (sib1Comps.tab_modules as any).title === 'Training Modules & Lessons' &&
          (sib1Comps.tab_cases as any).title === 'Case & Action Simulator' &&
          (sib1Comps.main_tabs as any).tabs.length === 7 &&
          sib2Validation.valid === true &&
          JSON.stringify(sib2RootJson) === JSON.stringify(sib2StageJson) &&
          (sib2Comps.overview_highlights_title as any).text ===
            '### Key Takeaways & Thesis Highlights' &&
          (sib2Comps.tab_modules as any).title === 'Analytical Pillars & Valuation Deep-Dives' &&
          (sib2Comps.tab_cases as any).title === 'Scenario & Decision Simulator' &&
          (sib2Comps.main_tabs as any).tabs.length === 5 &&
          sib3Validation.valid === true &&
          JSON.stringify(sib3RootJson) === JSON.stringify(sib3StageJson) &&
          sib3JsonlExists &&
          (sib3Comps.main_tabs as any).tabs.length === 3 &&
          !fs.existsSync(path.join(r3Dir, 'stages', '02_script')),
        'R2 gates primary/bundleRuns tabs per-run, retains anyRunHas* component definitions, updates sibling isAnalysis titles & a2ui_surface.json/.jsonl without creating 02_script on Stage-1-only runs'
      );

      // Client switchActiveRun() tests
      const r4HtmlRaw = fs.readFileSync(res.htmlOutputPath, 'utf-8');
      const r4PayloadMatch = r4HtmlRaw.match(
        /<script>\s*window\.A2UI_SURFACE_PAYLOAD\s*=\s*([\s\S]*?);\s*<\/script>/
      );
      const r4ParsedPayload = r4PayloadMatch ? JSON.parse(r4PayloadMatch[1]) : null;
      const r2Hooks: Record<string, any> = {};
      // eslint-disable-next-line no-new-func
      new Function('window', A2UI_STUDIO_JS)({
        A2UI_SURFACE_PAYLOAD: r4ParsedPayload,
        __ICM_TEST_HOOKS__: r2Hooks,
      });
      for (const m of res.messages) {
        r2Hooks.processMessage(m);
      }
      const r2Surface = r2Hooks.surfaces[res.surfaceId];
      r2Surface.activeRunId = run4Id;

      r2Hooks.switchActiveRun(r2Surface, run1Id);
      assert(
        r2Surface.components.main_tabs.tabs.length === 7 &&
          r2Surface.components.main_tabs.tabs.some((t: any) => t.child === 'tab_quiz') &&
          r2Surface.components.main_tabs.tabs.some((t: any) => t.child === 'tab_checklist') &&
          r2Surface.components.tab_overview.children.includes('overview_highlights_card') &&
          r2Surface.components.overview_highlights_title.text ===
            '### Key Takeaways & Learning Objectives' &&
          r2Surface.components.tab_modules.title === 'Training Modules & Lessons' &&
          r2Surface.components.tab_cases.title === 'Case & Action Simulator',
        'R2 switchActiveRun (Memo -> Course) expands tabs to 7, restores highlights card, and updates component titles to Course'
      );

      // Preserve tab_modules across index shift (idx 2 in Run 1 -> idx 1 in Run 2)
      r2Surface.uiState.activeTabs.main_tabs = 2;
      r2Hooks.switchActiveRun(r2Surface, run2Id);
      assert(
        r2Surface.components.main_tabs.tabs.length === 5 &&
          r2Surface.uiState.activeTabs.main_tabs === 1 &&
          r2Surface.components.overview_highlights_title.text ===
            '### Key Takeaways & Thesis Highlights' &&
          r2Surface.components.tab_modules.title === 'Analytical Pillars & Valuation Deep-Dives' &&
          r2Surface.components.tab_cases.title === 'Scenario & Decision Simulator',
        'R2 switchActiveRun (Course -> Analysis) preserves active tab_modules across index shift and switches titles to Analysis'
      );

      // Switch to Run 4 (no highlights) -> hides overview_highlights_card
      r2Hooks.switchActiveRun(r2Surface, run4Id);
      assert(
        r2Surface.components.main_tabs.tabs.length === 4 &&
          !r2Surface.components.tab_overview.children.includes('overview_highlights_card'),
        'R2 switchActiveRun (Analysis -> Memo without highlights) hides overview_highlights_card'
      );

      // Clamp to 0 when active tab (tab_quiz at idx 4) does not exist in target run
      r2Hooks.switchActiveRun(r2Surface, run1Id);
      r2Surface.uiState.activeTabs.main_tabs = 4;
      r2Hooks.switchActiveRun(r2Surface, run2Id);
      assert(
        r2Surface.uiState.activeTabs.main_tabs === 0,
        'R2 switchActiveRun clamps activeTabs.main_tabs to 0 when tab_quiz is absent in target run'
      );

      // Clamp when switching Run 2 (tab_modules at idx 1) -> Run 3 (Stage-1-only) -> Run 1
      r2Surface.uiState.activeTabs.main_tabs = 1;
      r2Hooks.switchActiveRun(r2Surface, run3Id);
      assert(
        r2Surface.components.main_tabs.tabs.length === 3 &&
          r2Surface.uiState.activeTabs.main_tabs === 0,
        'R2 switchActiveRun (Analysis -> Stage-1-only) swaps to 3 Stage-1 tabs and clamps active tab to 0'
      );
      r2Hooks.switchActiveRun(r2Surface, run1Id);
      assert(
        r2Surface.components.main_tabs.tabs.length === 7 &&
          r2Surface.components.tab_modules.title === 'Training Modules & Lessons',
        'R2 switchActiveRun (Stage-1-only -> Course) restores 7 Course tabs and Course titles'
      );

      // Custom locale check via saveWorkspaceLocale
      saveWorkspaceLocale(
        ws,
        mergeIcmLocalePack({
          ...NB_NO_TEST_LOCALE,
          ui: {
            ...DEFAULT_ICM_LOCALE.ui,
            ...NB_NO_TEST_LOCALE.ui,
            highlightsHeadingAnalysis: '### NB Analyse Høydepunkter',
            modulesCardTitleAnalysis: 'NB Analyse Søyler',
            casesCardTitleAnalysis: 'NB Analyse Scenarier',
          },
        })
      );
      const nbRes = generateA2uiSurface({ workspaceRoot: ws, runId: run1Id });
      const nbHtmlRaw = fs.readFileSync(nbRes.htmlOutputPath, 'utf-8');
      const nbPayloadMatch = nbHtmlRaw.match(
        /<script>\s*window\.A2UI_SURFACE_PAYLOAD\s*=\s*([\s\S]*?);\s*<\/script>/
      );
      const nbParsedPayload = nbPayloadMatch ? JSON.parse(nbPayloadMatch[1]) : null;
      const nbHooks: Record<string, any> = {};
      // eslint-disable-next-line no-new-func
      new Function('window', A2UI_STUDIO_JS)({
        A2UI_SURFACE_PAYLOAD: nbParsedPayload,
        __ICM_TEST_HOOKS__: nbHooks,
      });
      for (const m of nbRes.messages) {
        nbHooks.processMessage(m);
      }
      const nbSurface = nbHooks.surfaces[nbRes.surfaceId];
      nbSurface.activeRunId = run1Id;
      nbHooks.switchActiveRun(nbSurface, run2Id);
      assert(
        nbSurface.components.overview_highlights_title.text === '### NB Analyse Høydepunkter' &&
          nbSurface.components.tab_modules.title === 'NB Analyse Søyler' &&
          nbSurface.components.tab_cases.title === 'NB Analyse Scenarier',
        'R2 switchActiveRun uses workspace payload.locale.ui translations when custom locale is active'
      );

      // Regression: synthetic surface missing uiState + targetEntry omitting .tabs with #a2ui-surface-root mounted
      const prevSynthDoc = (globalThis as any).document;
      try {
        const mkSynthEl = (tag: string): any => ({
          tagName: String(tag || 'div').toUpperCase(),
          id: '',
          className: '',
          textContent: '',
          innerHTML: '',
          style: {},
          attributes: {} as Record<string, string>,
          children: [] as any[],
          appendChild(child: any) {
            if (child) this.children.push(child);
            return child;
          },
          replaceChildren(...nodes: any[]) {
            this.children = nodes.filter(Boolean);
          },
          setAttribute(k: string, v: string) {
            this.attributes[k] = String(v);
          },
          addEventListener() {},
          classList: {
            add() {},
            remove() {},
            contains: () => false,
          },
        });
        const synthRootMount = mkSynthEl('div');
        synthRootMount.id = 'a2ui-surface-root';
        (globalThis as any).document = {
          title: '',
          createElement: mkSynthEl,
          createTextNode: (txt: string) => ({ nodeType: 3, textContent: String(txt) }),
          getElementById: (id: string) => (id === 'a2ui-surface-root' ? synthRootMount : null),
          querySelector: () => null,
          querySelectorAll: () => [],
        };
        const synthBundleRuns = [
          { runId: 'r1', title: 'R1', dataModel: { meta: { runId: 'r1', title: 'R1' } } },
          { runId: 'r2', title: 'R2', dataModel: { meta: { runId: 'r2', title: 'R2' } } },
        ];
        const synthHooks: Record<string, any> = {};
        // eslint-disable-next-line no-new-func
        new Function('window', A2UI_STUDIO_JS)({
          A2UI_SURFACE_PAYLOAD: {
            surfaceId: 'synth_surface',
            messages: [],
            bundleRuns: synthBundleRuns,
          },
          __ICM_TEST_HOOKS__: synthHooks,
        });
        const synthSurface: any = {
          surfaceId: 'synth_surface',
          activeRunId: 'r1',
          components: {
            root: { id: 'root', component: 'Column', children: ['main_tabs'] },
            main_tabs: {
              id: 'main_tabs',
              component: 'Tabs',
              tabs: [{ title: 'Overview', child: 'tab_overview' }],
            },
            tab_overview: { id: 'tab_overview', component: 'Text', text: 'Synth overview' },
          },
          dataModel: { meta: { runId: 'r1', title: 'R1' } },
          runStates: {
            r1: { meta: { runId: 'r1', title: 'R1' } },
            r2: { meta: { runId: 'r2', title: 'R2' } },
          },
        };
        synthHooks.mountSurface(synthSurface);
        const switchedOk = synthHooks.switchActiveRun(synthSurface, 'r2', synthBundleRuns);

        const synthDirectSurface: any = {
          surfaceId: 'synth_direct',
          components: {
            main_tabs: {
              id: 'main_tabs',
              component: 'Tabs',
              tabs: [{ title: 'Direct', child: 'tab_direct' }],
            },
            tab_direct: { id: 'tab_direct', component: 'Text', text: 'Direct body' },
          },
          dataModel: {},
        };
        const directTabsEl = synthHooks.renderComponent(
          synthDirectSurface,
          synthDirectSurface.components.main_tabs
        );
        assert(
          switchedOk === true &&
            Boolean(synthSurface.uiState?.activeTabs) &&
            synthRootMount.children.length === 1 &&
            Boolean(synthDirectSurface.uiState?.activeTabs) &&
            Boolean(directTabsEl),
          'R2 switchActiveRun and Tabs rendering safely initialize surface.uiState.activeTabs when targetEntry omits .tabs and #a2ui-surface-root is mounted'
        );
      } finally {
        if (prevSynthDoc === undefined) {
          delete (globalThis as any).document;
        } else {
          (globalThis as any).document = prevSynthDoc;
        }
      }
    } finally {
      fs.rmSync(tmpR2Dir, { recursive: true, force: true });
    }
  }

  // P3 Regression: Self-Test Fixture Isolation (`os.tmpdir()`) & Restricted `resolveWorkspaceLocalePath()` Upward Walk
  {
    const selfTestsSource = fs.readFileSync(
      path.join(repoRootForTsc, 'src', 'tests', 'self-tests.ts'),
      'utf-8'
    );
    const forbiddenLiveFixtureRe = new RegExp("['\"`]\\./workspace/runs\\b");
    assert(
      !forbiddenLiveFixtureRe.test(selfTestsSource),
      'P3 self-tests.ts contains zero live ./workspace/runs test fixtures'
    );

    const tmpR3Dir = fs.mkdtempSync(path.join(os.tmpdir(), 'icm-r3-test-'));
    try {
      const parentWs = path.join(tmpR3Dir, 'parent_ws');
      const bundleResearch = path.join(parentWs, 'bundle', 'research');
      const bundleRefs = path.join(parentWs, 'bundle', 'references');
      const runDir = path.join(parentWs, 'runs', 'run-123');
      const nestedExtra = path.join(runDir, 'nested_extra');
      const customSub = path.join(parentWs, 'custom_sub');
      fs.mkdirSync(bundleResearch, { recursive: true });
      fs.mkdirSync(bundleRefs, { recursive: true });
      fs.mkdirSync(nestedExtra, { recursive: true });
      fs.mkdirSync(customSub, { recursive: true });
      saveWorkspaceLocale(parentWs, NB_NO_TEST_LOCALE);

      const expectedParentLocale = path.join(parentWs, '_config', 'locale.json');
      const freshWs = path.join(tmpR3Dir, 'fresh_ws');
      const freshBundleResearch = path.join(freshWs, 'bundle', 'research');
      const freshRunDir = path.join(freshWs, 'runs', 'run-456');
      fs.mkdirSync(freshBundleResearch, { recursive: true });
      fs.mkdirSync(freshRunDir, { recursive: true });

      assert(
        resolveWorkspaceLocalePath(parentWs) === expectedParentLocale &&
          resolveWorkspaceLocalePath(path.join(parentWs, 'bundle')) === expectedParentLocale &&
          resolveWorkspaceLocalePath(bundleResearch) === expectedParentLocale &&
          resolveWorkspaceLocalePath(bundleRefs) === expectedParentLocale &&
          resolveWorkspaceLocalePath(path.join(parentWs, 'runs')) === expectedParentLocale &&
          resolveWorkspaceLocalePath(runDir) === expectedParentLocale &&
          resolveWorkspaceLocalePath(customSub) === path.join(customSub, '_config', 'locale.json') &&
          loadWorkspaceLocale(customSub).hasCustomFile === false &&
          resolveWorkspaceLocalePath(nestedExtra) ===
            path.join(nestedExtra, '_config', 'locale.json') &&
          loadWorkspaceLocale(nestedExtra).hasCustomFile === false &&
          resolveWorkspaceLocalePath(freshBundleResearch) ===
            path.join(freshWs, '_config', 'locale.json') &&
          resolveWorkspaceLocalePath(freshRunDir) === path.join(freshWs, '_config', 'locale.json'),
        'P3 resolveWorkspaceLocalePath walks up only through recognized subdirectories (bundle, runs, runs/<runId>, research, references) and never leaks from arbitrary subdirectories'
      );
    } finally {
      fs.rmSync(tmpR3Dir, { recursive: true, force: true });
    }
  }

  // P4 Regression: 12k/36k/6-Ref Boundary Hydration, Immutable `references/*.md`, Inline `{{#if}}` Newlines
  {
    const tmpR4Dir = fs.mkdtempSync(path.join(os.tmpdir(), 'icm-r4-test-'));
    try {
      // 4.1a: 6-ref selection cap (ref-07 excluded)
      const capWs = path.join(tmpR4Dir, 'cap_ws');
      const capRefsDir = path.join(capWs, 'bundle', 'references');
      fs.mkdirSync(capRefsDir, { recursive: true });
      for (let i = 1; i <= 7; i++) {
        const slug = `ref-0${i}`;
        const scoreWord = i <= 6 ? 'safety standard requirement' : 'unrelated archive';
        fs.writeFileSync(
          path.join(capRefsDir, `${slug}.md`),
          [
            '---',
            'type: Reference',
            `title: "Reference Record ${i}"`,
            'status: stable',
            'generated:',
            '  by: open-data-sync/1.0',
            '  at: 2026-11-01T00:00:00Z',
            'verified:',
            '  - by: open-data-sync/1.0',
            '    at: 2026-11-01T00:00:00Z',
            'stale_after: 2027-11-01T00:00:00Z',
            'sources:',
            `  - id: src-${i}`,
            `    title: "Source ${i}"`,
            `    resource: "https://example.org/ref/${i}"`,
            '---',
            `# Reference ${i}`,
            '',
            `Authoritative ${scoreWord} clause ${i}.`,
          ].join('\n'),
          'utf-8'
        );
      }
      const capLayers = loadWorkspaceLayers(capWs, 'safety standard requirement');
      const hydratedPart =
        capLayers.bundleContext.split('Hydrated Authoritative Reference Records')[1] || '';
      assert(
        hydratedPart.includes('### [/references/ref-01.md]') &&
          hydratedPart.includes('### [/references/ref-06.md]') &&
          !hydratedPart.includes('/references/ref-07.md'),
        'P4 loadWorkspaceLayers hydrates at most 6 top-ranked references into bundleContext'
      );

      // 4.1b: 12,000-char per-file boundary-aware slicing & 36,000-char combined budget
      const budgetWs = path.join(tmpR4Dir, 'budget_ws');
      const budgetRefsDir = path.join(budgetWs, 'bundle', 'references');
      fs.mkdirSync(budgetRefsDir, { recursive: true });
      const para = 'Authoritative operational requirement for system integrity and verification. '.repeat(12).trim();
      const buildLargeRefBody = (idx: number): string => {
        const chunks: string[] = [];
        let len = 0;
        let sec = 1;
        while (len < 11_930) {
          const block = `## Section ${idx}.${sec}\n\n${para}\n\n`;
          chunks.push(block);
          len += block.length;
          sec++;
        }
        // Place a heading right around the 11,980–12,010 char boundary so raw slicing would split or orphan it
        const padNeeded = Math.max(0, 11_975 - len);
        if (padNeeded > 0) {
          chunks.push(`${'x'.repeat(padNeeded)}\n\n`);
        }
        chunks.push(`## Heading At Boundary ${idx}\n\nFollowing paragraph beyond twelve thousand characters. ${para}`);
        return chunks.join('');
      };
      for (let i = 1; i <= 4; i++) {
        fs.writeFileSync(
          path.join(budgetRefsDir, `large-0${i}.md`),
          [
            '---',
            'type: Reference',
            `title: "Large Reference ${i}"`,
            'status: stable',
            'generated:',
            '  by: open-data-sync/1.0',
            '  at: 2026-11-01T00:00:00Z',
            'verified:',
            '  - by: open-data-sync/1.0',
            '    at: 2026-11-01T00:00:00Z',
            'stale_after: 2027-11-01T00:00:00Z',
            'sources:',
            `  - id: large-${i}`,
            `    title: "Large Source ${i}"`,
            `    resource: "https://example.org/large/${i}"`,
            '---',
            buildLargeRefBody(i),
          ].join('\n'),
          'utf-8'
        );
      }
      const budgetLayers = loadWorkspaceLayers(budgetWs, 'Authoritative operational requirement');
      const excerptSections = budgetLayers.bundleContext
        .split('Authoritative Content:\n')
        .slice(1)
        .map((chunk) => {
          const nextHeader = chunk.indexOf('\n### [/references/');
          return (nextHeader >= 0 ? chunk.slice(0, nextHeader) : chunk).trimEnd();
        });
      const totalExcerptChars = excerptSections.reduce((sum, s) => sum + s.length, 0);
      assert(
        excerptSections.length >= 3 &&
          excerptSections.length <= 4 &&
          excerptSections.slice(0, 3).every((ex) => ex.length > 8_000 && ex.length <= 12_000) &&
          excerptSections.every((ex) => ex.length <= 12_000) &&
          totalExcerptChars > 24_000 &&
          totalExcerptChars <= 36_000 &&
          excerptSections.every((ex) => ex.endsWith('\n...[truncated]')) &&
          excerptSections.every((ex) => {
            const beforeMarker = ex.slice(0, ex.length - '\n...[truncated]'.length).trimEnd();
            const lastLine = beforeMarker.slice(beforeMarker.lastIndexOf('\n') + 1);
            return !/^\s*#{1,6}(?:\s|$)/.test(lastLine);
          }),
        `P4 loadWorkspaceLayers enforces 12,000-char boundary-aware per-file slicing and 36,000-char combined budget without orphaned headings (count=${excerptSections.length}, lengths=${excerptSections.map((e) => e.length).join(',')}, total=${totalExcerptChars})`
      );

      // 4.1b-tiny: Tiny remaining budget (< 64 chars) skips truncated ref instead of emitting orphan header/sources
      const tinyBudgetWs = path.join(tmpR4Dir, 'tiny_budget_ws');
      const tinyRefsDir = path.join(tinyBudgetWs, 'bundle', 'references');
      fs.mkdirSync(tinyRefsDir, { recursive: true });
      const exactBody11995 = `Authoritative clause text. ${'x'.repeat(11_995 - 28)}.`;
      for (let i = 1; i <= 4; i++) {
        fs.writeFileSync(
          path.join(tinyRefsDir, `t-${i}.md`),
          [
            '---',
            'type: Reference',
            `title: "Tiny Budget Reference ${i}"`,
            'status: stable',
            'generated:',
            '  by: open-data-sync/1.0',
            '  at: 2026-11-01T00:00:00Z',
            'verified:',
            '  - by: open-data-sync/1.0',
            '    at: 2026-11-01T00:00:00Z',
            'stale_after: 2027-11-01T00:00:00Z',
            'sources:',
            `  - id: tiny-${i}`,
            `    title: "Tiny Source ${i}"`,
            `    resource: "https://example.org/tiny/${i}"`,
            '---',
            i <= 3 ? exactBody11995 : `Oversized trailing body. ${'y'.repeat(300)}.`,
          ].join('\n'),
          'utf-8'
        );
      }
      const tinyBudgetLayers = loadWorkspaceLayers(tinyBudgetWs);
      const tinyRefHeaders = tinyBudgetLayers.bundleContext
        .split('\n### [/references/')
        .slice(1);
      assert(
        tinyRefHeaders.length === 3 &&
          !tinyBudgetLayers.bundleContext.includes('### [/references/t-4.md]') &&
          tinyRefHeaders.every((sec) => sec.includes('Authoritative Content:')),
        `P4 loadWorkspaceLayers skips truncated refs when remaining budget is below minimum threshold so no orphan metadata-only header is emitted (headers=${tinyRefHeaders.length})`
      );

      // 4.1c: `injectBidirectionalBundleLinks`, `walkBundleConcepts`, `generateBundleVisualization`, and `generateA2uiSurface` never mutate `references/*.md` or `machine-confirmed` References
      const immWs = path.join(tmpR4Dir, 'imm_ws');
      const immRefsDir = path.join(immWs, 'bundle', 'references');
      const immResearchDir = path.join(immWs, 'bundle', 'research');
      fs.mkdirSync(immRefsDir, { recursive: true });
      fs.mkdirSync(immResearchDir, { recursive: true });
      const refAPath = path.join(immRefsDir, 'ref-a.md');
      const refBPath = path.join(immRefsDir, 'ref-b.md');
      const refCPath = path.join(immResearchDir, 'ref-c.md');
      const concept1Path = path.join(immResearchDir, 'concept-1.md');
      const concept2Path = path.join(immResearchDir, 'concept-2.md');
      const refAContent = [
        '---',
        'type: Reference',
        'title: "Statutory Reference A"',
        'status: stable',
        'generated:',
        '  by: open-data-sync/1.0',
        '  at: 2026-11-01T00:00:00Z',
        'verified:',
        '  - by: open-data-sync/1.0',
        '    at: 2026-11-01T00:00:00Z',
        'stale_after: 2027-11-01T00:00:00Z',
        '---',
        '# Statutory Reference A',
        '',
        'Authoritative clause A.',
      ].join('\n');
      const refBContent = refAContent.replace(/Reference A/g, 'Reference B').replace('clause A', 'clause B');
      const refCContent = refAContent.replace(/Reference A/g, 'Reference C').replace('clause A', 'clause C');
      fs.writeFileSync(refAPath, refAContent, 'utf-8');
      fs.writeFileSync(refBPath, refBContent, 'utf-8');
      fs.writeFileSync(refCPath, refCContent, 'utf-8');
      fs.writeFileSync(
        concept1Path,
        [
          '---',
          'type: Research Concept',
          'title: "Concept One"',
          'status: stable',
          '---',
          '# Concept One',
          '',
          'Grounded in [Statutory Reference A](/references/ref-a.md).[^orphan]',
        ].join('\n'),
        'utf-8'
      );
      fs.writeFileSync(
        concept2Path,
        [
          '---',
          'type: Research Concept',
          'title: "Concept Two"',
          'status: stable',
          '---',
          '# Concept Two',
          '',
          'Builds on [Concept One](/research/concept-1.md) and [Statutory Reference C](/research/ref-c.md).',
        ].join('\n'),
        'utf-8'
      );

      const updatedAll = injectBidirectionalBundleLinks(immWs);
      const updatedCurrent = injectBidirectionalBundleLinks(immWs, 'research/concept-1');
      const allUpdatedPaths = [...updatedAll, ...updatedCurrent];
      const immWalked = walkBundleConcepts(path.join(immWs, 'bundle'));
      const immViz = generateBundleVisualization(path.join(immWs, 'bundle'));
      generateA2uiSurface({ workspaceRoot: immWs });
      const refAAfter = fs.readFileSync(refAPath, 'utf-8');
      const refBAfter = fs.readFileSync(refBPath, 'utf-8');
      const refCAfter = fs.readFileSync(refCPath, 'utf-8');
      const concept1After = fs.readFileSync(concept1Path, 'utf-8');
      const immVizHtml = fs.readFileSync(immViz.outputPath, 'utf-8');
      assert(
        refAAfter === refAContent &&
          refBAfter === refBContent &&
          refCAfter === refCContent &&
          !allUpdatedPaths.some(
            (p) => p.replace(/\\/g, '/').includes('/references/') || p.replace(/\\/g, '/').endsWith('/ref-c.md')
          ) &&
          concept1After.includes('/research/concept-2.md') &&
          !concept1After.includes('[^orphan]') &&
          immWalked.some((n) => n.id === 'references/ref-a') &&
          immWalked.some((n) => n.id === 'references/ref-b') &&
          immWalked.some((n) => n.id === 'research/ref-c') &&
          immViz.nodes >= 5 &&
          immViz.edges >= 2 &&
          immVizHtml.includes('"id":"references/ref-a"') &&
          immVizHtml.includes('"id":"references/ref-b"') &&
          immVizHtml.includes('"id":"research/ref-c"') &&
          immVizHtml.includes('research/concept-1__references/ref-a'),
        'P4 bundle linking, walkBundleConcepts, viz generation, and A2UI surface keep references/*.md and machine-confirmed Reference files byte-for-byte immutable while healing research/*.md and preserving viz.html nodes/edges'
      );

      // 4.2: `renderPromptTemplate` inline & block `{{#if}}` newline preservation (LF & CRLF)
      assert(
        renderPromptTemplate('Line 1\n{{#if visualContext}}Regional: {{visualContext}}{{/if}}\nStrictly zero text', {
          visualContext: 'Coastal pines',
        }) === 'Line 1\nRegional: Coastal pines\nStrictly zero text' &&
          renderPromptTemplate('Line 1\r\n{{#if visualContext}}Regional: {{visualContext}}{{/if}}\r\nStrictly zero text', {
            visualContext: 'Coastal pines',
          }) === 'Line 1\r\nRegional: Coastal pines\r\nStrictly zero text' &&
          renderPromptTemplate('Line 1\n{{#if visualContext}}Regional: {{visualContext}}{{/if}}\nStrictly zero text', {
            visualContext: '',
          }) === 'Line 1\nStrictly zero text' &&
          renderPromptTemplate('Line 1\r\n{{#if visualContext}}Regional: {{visualContext}}{{/if}}\r\nStrictly zero text', {
            visualContext: '',
          }) === 'Line 1\r\nStrictly zero text' &&
          renderPromptTemplate('Hello{{#if name}}, {{name}}{{/if}}\nNext', { name: 'Ada' }) ===
            'Hello, Ada\nNext' &&
          renderPromptTemplate('Hello{{#if name}}, {{name}}{{/if}}\nNext', { name: '' }) ===
            'Hello\nNext' &&
          renderPromptTemplate('A\n{{#if blk}}\n{{blk}}\n{{/if}}\nB', { blk: 'X' }) === 'A\nX\nB' &&
          renderPromptTemplate('A\r\n{{#if blk}}\r\n{{blk}}\r\n{{/if}}\r\nB', { blk: 'X' }) ===
            'A\r\nX\r\nB' &&
          renderPromptTemplate('A\n{{#if blk}}\n{{blk}}\n{{/if}}\nB', { blk: '' }) === 'A\nB',
        'P4 renderPromptTemplate preserves trailing newlines on truthy inline {{#if}} while preserving falsy line-start and block-form behavior (LF & CRLF)'
      );
    } finally {
      fs.rmSync(tmpR4Dir, { recursive: true, force: true });
    }
  }

  // P5 Regression: Cardinals > 20, Regional Sub-Dialect, Acronym-Hyphen Compounds, Early `getApiKey()` Gate, 48-Char Slug Stopwords
  {
    // 5.1a: `mergeIcmLocalePack` preserves `""` & `boolean` + `resolveCardinal` > 20
    const baseTenFirstPack = mergeIcmLocalePack({
      bcp47: 'nb-NO',
      languageName: 'Norwegian Bokmål',
      prosody: {
        ...NB_NO_TEST_LOCALE.prosody,
        cardinalTensJoiner: '',
        cardinalUnitBeforeTen: false,
        cardinals: {
          '0': 'null',
          '1': 'en',
          '2': 'to',
          '3': 'tre',
          '4': 'fire',
          '5': 'fem',
          '6': 'seks',
          '7': 'sju',
          '8': 'åtte',
          '9': 'ni',
          '10': 'ti',
          '11': 'elleve',
          '12': 'tolv',
          '13': 'tretten',
          '14': 'fjorten',
          '15': 'femten',
          '16': 'seksten',
          '17': 'sytten',
          '18': 'atten',
          '19': 'nitten',
          '20': 'tjue',
          '30': 'tretti',
          '40': 'førti',
          '50': 'femti',
          '60': 'seksti',
          '70': 'sytti',
          '80': 'åtti',
          '90': 'nitti',
          '100': 'hundre',
        },
      },
    });
    const unitBeforeTenPack = mergeIcmLocalePack({
      bcp47: 'de-DE',
      languageName: 'German',
      prosody: {
        to: 'bis',
        section: 'Paragraf',
        sections: 'Paragrafen',
        cardinalTensJoiner: 'und',
        cardinalUnitBeforeTen: true,
        cardinals: {
          '1': 'eins',
          '2': 'zwei',
          '3': 'drei',
          '4': 'vier',
          '5': 'fünf',
          '11': 'elf',
          '20': 'zwanzig',
          '30': 'dreißig',
          '40': 'vierzig',
          '100': 'einhundert',
        },
      },
    });
    const tensFirstTts = prepareTextForStudioTts(
      'Se § 25, § 142, §§ 11-24 og §§ 21–35.',
      baseTenFirstPack
    );
    const unitFirstTts = prepareTextForStudioTts(
      'Siehe § 25, § 142, § 242 und §§ 21–35.',
      unitBeforeTenPack
    );
    const enDefaultTts = prepareTextForStudioTts('Under §§ 4-8, check § 25.', 'en');
    assert(
      baseTenFirstPack.prosody.cardinalTensJoiner === '' &&
        baseTenFirstPack.prosody.cardinalUnitBeforeTen === false &&
        unitBeforeTenPack.prosody.cardinalTensJoiner === 'und' &&
        unitBeforeTenPack.prosody.cardinalUnitBeforeTen === true &&
        tensFirstTts.includes('paragraf tjuefem') &&
        tensFirstTts.includes('paragraf hundre førtito') &&
        tensFirstTts.includes('paragrafene elleve til tjuefire') &&
        tensFirstTts.includes('paragrafene tjueen til trettifem') &&
        unitFirstTts.includes('Paragraf fünfundzwanzig') &&
        unitFirstTts.includes('Paragraf einhundert zweiundvierzig') &&
        unitFirstTts.includes('Paragraf zweihundert zweiundvierzig') &&
        unitFirstTts.includes('Paragrafen einsundzwanzig bis fünfunddreißig') &&
        enDefaultTts.includes('Under sections 4 to 8, check section 25.'),
      `P5.1a mergeIcmLocalePack preserves cardinalTensJoiner="" & boolean flags and resolveCardinal expands 21..999 across both tens-first and unit-before-tens packs (got tensFirst="${tensFirstTts}", unitFirst="${unitFirstTts}")`
    );

    // 5.1c: `separateAcronymHyphenCompounds` across `prosody` and `!prosody` paths
    const acronymProsodyEn = prepareTextForStudioTts(
      'Check API-key, ISO-standard, HTTP-/HTTPS-proxy, E-mail, X-ray, FOR-2023-03-28-449, DOC-rev2, REV-alpha-01, CODE-a, iOS-app, /docs/API-guide, and foam-/water.',
      'en'
    );
    const acronymNoProsodyFi = prepareTextForStudioTts(
      'Tarkista API-key, ISO-standard, HTTP-/HTTPS-proxy, ÆØÅ-test, E-mail, DOC-rev2, CODE-a, iOS-app ja docs/API-guide.',
      'fi-FI'
    );
    assert(
      acronymProsodyEn.includes('API key') &&
        acronymProsodyEn.includes('ISO standard') &&
        acronymProsodyEn.includes('HTTP- or HTTPS proxy') &&
        acronymProsodyEn.includes('E-mail') &&
        acronymProsodyEn.includes('X-ray') &&
        acronymProsodyEn.includes('FOR-2023-03-28-449') &&
        acronymProsodyEn.includes('DOC-rev2') &&
        acronymProsodyEn.includes('REV-alpha-01') &&
        acronymProsodyEn.includes('CODE-a') &&
        acronymProsodyEn.includes('iOS-app') &&
        acronymProsodyEn.includes('/docs/API-guide') &&
        acronymProsodyEn.includes('foam- or water') &&
        acronymNoProsodyFi.includes('API key') &&
        acronymNoProsodyFi.includes('ISO standard') &&
        acronymNoProsodyFi.includes('HTTP-/HTTPS proxy') &&
        acronymNoProsodyFi.includes('ÆØÅ test') &&
        acronymNoProsodyFi.includes('E-mail') &&
        acronymNoProsodyFi.includes('DOC-rev2') &&
        acronymNoProsodyFi.includes('CODE-a') &&
        acronymNoProsodyFi.includes('iOS-app') &&
        acronymNoProsodyFi.includes('docs/API-guide'),
      `P5.1c separateAcronymHyphenCompounds separates uppercase acronym compounds while preserving single-letter prefixes, codes, and paths (en="${acronymProsodyEn}", fi="${acronymNoProsodyFi}")`
    );

    // 5.1b: `ensureWorkspaceLocaleConfig` reads Layer 0/1 regional identity & requests 30..100 + joiner/order
    const tmpDialectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'icm-p5-dialect-'));
    const origFetchDialect = globalThis.fetch;
    const prevKeyDialect = process.env.GEMINI_API_KEY;
    let capturedDialectPrompt = '';
    try {
      fs.writeFileSync(
        path.join(tmpDialectDir, 'GEMINI.md'),
        '# Workspace Identity\nPrimary municipality: Bergen, Vestland (western coastal fjords).',
        'utf-8'
      );
      fs.writeFileSync(
        path.join(tmpDialectDir, 'CONTEXT.md'),
        '# Context\nLocal coastal operations in Vestland.',
        'utf-8'
      );
      process.env.GEMINI_API_KEY = 'test-mock-dialect-key';
      globalThis.fetch = (async (_url: string | URL | Request, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body || '{}'));
        capturedDialectPrompt = String(
          typeof body?.input === 'string'
            ? body.input
            : body?.input?.[0]?.content?.[0]?.text || ''
        );
        const mockPack = {
          bcp47: 'nb-NO',
          languageName: 'Norwegian Bokmål',
          visualContext: 'Rainy coastal timber roofs along western fjords in practical rainwear; zero embedded text.',
          ui: DEFAULT_ICM_LOCALE.ui,
          prosody: {
            ...baseTenFirstPack.prosody,
            voicePersonas: {
              warmGuideFemale: 'En varm kvinnelig formidler fra Bergen med vestlandsk tone.',
              warmGuideMale: 'En varm mannlig formidler fra Bergen med vestlandsk tone.',
              calmSpecialistMale: 'En rolig mannlig fagspesialist fra Vestland.',
              calmSpecialistFemale: 'En rolig kvinnelig fagspesialist fra Vestland.',
            },
          },
        };
        const ssePayload = `data: ${JSON.stringify({
          event_type: 'interaction.completed',
          interaction: {
            id: 'inter_dialect_nb_01',
            status: 'completed',
            steps: [
              {
                type: 'model_output',
                content: [{ type: 'text', text: JSON.stringify(mockPack) }],
              },
            ],
            usage: { total_input_tokens: 10, total_thought_tokens: 0, total_output_tokens: 10, total_tokens: 20 },
          },
        })}\n\n`;
        return new Response(ssePayload, {
          status: 200,
          headers: { 'content-type': 'text/event-stream' },
        });
      }) as typeof fetch;

      const synthLocaleRes = await ensureWorkspaceLocaleConfig(
        tmpDialectDir,
        'Dette er en norsk fagtekst om beredskap i kommunen.',
        { forceBcp47: 'nb-NO' }
      );
      assert(
        synthLocaleRes.generatedOnTheFly === true &&
          capturedDialectPrompt.includes('"30"') &&
          capturedDialectPrompt.includes('"90"') &&
          capturedDialectPrompt.includes('"100"') &&
          capturedDialectPrompt.includes('cardinalTensJoiner') &&
          capturedDialectPrompt.includes('cardinalUnitBeforeTen') &&
          capturedDialectPrompt.includes('WORKSPACE IDENTITY / REGIONAL CONTEXT') &&
          capturedDialectPrompt.includes('Bergen, Vestland'),
        'P5.1b ensureWorkspaceLocaleConfig forwards Layer 0/1 regional context and requests cardinals 30..100 + joiner/order + sub-national dialect voicePersonas'
      );
    } finally {
      globalThis.fetch = origFetchDialect;
      if (prevKeyDialect === undefined) delete process.env.GEMINI_API_KEY;
      else process.env.GEMINI_API_KEY = prevKeyDialect;
      fs.rmSync(tmpDialectDir, { recursive: true, force: true });
    }

    // 5.2: Early `getApiKey()` gate before `mkdirSync` across CLI & Stages 1–4
    const tmpGateDir = fs.mkdtempSync(path.join(os.tmpdir(), 'icm-p5-keygate-'));
    const prevGateCwd = process.cwd();
    const prevEnvGemini = process.env.GEMINI_API_KEY;
    const prevEnvGoogle = process.env.GOOGLE_API_KEY;
    const prevEnvGenai = process.env.GOOGLE_GENAI_API_KEY;
    try {
      const gateWs = path.join(tmpGateDir, 'workspace');
      const gatePrompts = path.join(tmpGateDir, 'prompts');
      fs.mkdirSync(path.join(gateWs, 'runs'), { recursive: true });
      fs.mkdirSync(gatePrompts, { recursive: true });
      fs.writeFileSync(
        path.join(gatePrompts, '01_research.md'),
        '---\nmodel: gemini-4-argon\nthinkingLevel: HIGH\nmaxOutputTokens: 65536\noutput:\n  format: markdown\n---\nResearch: {{topic}}',
        'utf-8'
      );
      fs.writeFileSync(
        path.join(gatePrompts, '02_script.md'),
        '---\nmodel: gemini-4-argon\nthinkingLevel: MEDIUM\nmaxOutputTokens: 32768\noutput:\n  format: json\n---\nScript for {{researchSummary}}',
        'utf-8'
      );
      fs.writeFileSync(
        path.join(gatePrompts, '03_visuals.md'),
        '---\nmodel: gemini-nano-banana-2.1\naspectRatio: "16:9"\nimageSize: "1K"\noutput:\n  format: image\n---\nScene: {{visualPrompt}}',
        'utf-8'
      );
      fs.writeFileSync(
        path.join(gatePrompts, '04_audio.md'),
        '---\nmodel: gemini-3.8-flash-tts\nlanguageCode: "en-US"\nvoice: "Kore"\noutput:\n  format: audio\n---\n',
        'utf-8'
      );

      // Prepare Stage 2/3/4 prerequisite run fixtures without their downstream stage directories
      const s2GateRun = path.join(gateWs, 'runs', 'gate-r2', 'stages', '01_research', 'output');
      fs.mkdirSync(s2GateRun, { recursive: true });
      fs.writeFileSync(
        path.join(s2GateRun, 'research_summary.md'),
        '---\ntype: Research Concept\ntitle: "Gate Test"\nstatus: stable\n---\nBody.',
        'utf-8'
      );
      for (const rId of ['gate-r3', 'gate-r4']) {
        const s2Out = path.join(gateWs, 'runs', rId, 'stages', '02_script', 'output');
        fs.mkdirSync(s2Out, { recursive: true });
        fs.writeFileSync(
          path.join(s2Out, 'script_draft.json'),
          JSON.stringify({
            title: 'Gate Test',
            scriptBody: 'Overview script.',
            trainingModules: [
              {
                moduleNumber: 1,
                title: 'Module 1',
                durationMinutes: 2,
                narration: 'Narration line.',
                slideCues: ['Cue 1'],
                actionItem: 'Action 1.',
              },
            ],
          }),
          'utf-8'
        );
      }

      delete process.env.GEMINI_API_KEY;
      delete process.env.GOOGLE_API_KEY;
      delete process.env.GOOGLE_GENAI_API_KEY;
      process.chdir(tmpGateDir);

      const expectMissingKey = async (fn: () => Promise<unknown>, label: string) => {
        let msg = '';
        try {
          await fn();
        } catch (err: any) {
          msg = err?.message || String(err);
        }
        assert(/Missing GEMINI_API_KEY/.test(msg), `${label} rejects with Missing GEMINI_API_KEY (got "${msg}")`);
      };

      await expectMissingKey(
        () => runStage1Flow({ workspaceRoot: './workspace', runId: 'gate-r1', topic: 'Gate Topic', dryRun: false }),
        'P5.2 runStage1Flow'
      );
      await expectMissingKey(
        () => runStage2Flow({ workspaceRoot: './workspace', runId: 'gate-r2', dryRun: false }),
        'P5.2 runStage2Flow'
      );
      await expectMissingKey(
        () => runStage3Flow({ workspaceRoot: './workspace', runId: 'gate-r3', promptDir: './prompts', dryRun: false }),
        'P5.2 runStage3Flow'
      );
      await expectMissingKey(
        () => runStage4Flow({ workspaceRoot: './workspace', runId: 'gate-r4', promptDir: './prompts', dryRun: false }),
        'P5.2 runStage4Flow (Gemini TTS)'
      );
      const gateDryRes = await runStage1Flow({
        workspaceRoot: './workspace',
        runId: 'gate-dry',
        topic: 'Gate Topic',
        dryRun: true,
      });

      const childEnv = { ...process.env };
      delete childEnv.GEMINI_API_KEY;
      delete childEnv.GOOGLE_API_KEY;
      delete childEnv.GOOGLE_GENAI_API_KEY;
      const cliGateProc = spawnSync(
        process.execPath,
        [path.join(repoRootForTsc, 'bin', 'oks.mjs'), '--stage1', 'Gate CLI Topic'],
        { cwd: tmpGateDir, env: childEnv, encoding: 'utf-8' }
      );
      const cliOut = `${cliGateProc.stdout || ''}\n${cliGateProc.stderr || ''}`;
      const runEntriesAfter = fs.readdirSync(path.join(gateWs, 'runs'));
      assert(
        gateDryRes.dryRun === true &&
          !fs.existsSync(path.join(gateWs, 'runs', 'gate-r1')) &&
          !fs.existsSync(path.join(gateWs, 'runs', 'gate-r2', 'stages', '02_script')) &&
          !fs.existsSync(path.join(gateWs, 'runs', 'gate-r3', 'stages', '03_visuals')) &&
          !fs.existsSync(path.join(gateWs, 'runs', 'gate-r4', 'stages', '04_audio')) &&
          cliGateProc.status !== 0 &&
          /Missing GEMINI_API_KEY/.test(cliOut) &&
          !runEntriesAfter.some((name) => name.startsWith('gate-cli-topic-')),
        `P5.2 early getApiKey() gate aborts CLI --stage1 and Stages 1-4 before mkdirSync creates run/stage directories while preserving dryRun (runs=${runEntriesAfter.join(',')})`
      );
    } finally {
      process.chdir(prevGateCwd);
      if (prevEnvGemini !== undefined) process.env.GEMINI_API_KEY = prevEnvGemini;
      else delete process.env.GEMINI_API_KEY;
      if (prevEnvGoogle !== undefined) process.env.GOOGLE_API_KEY = prevEnvGoogle;
      else delete process.env.GOOGLE_API_KEY;
      if (prevEnvGenai !== undefined) process.env.GOOGLE_GENAI_API_KEY = prevEnvGenai;
      else delete process.env.GOOGLE_GENAI_API_KEY;
      fs.rmSync(tmpGateDir, { recursive: true, force: true });
    }

    // 5.4: 48-char concept slug trailing 1–2 char stopword stripping
    const tmpSlugDir = fs.mkdtempSync(path.join(os.tmpdir(), 'icm-p5-slug-'));
    try {
      const slugWs = path.join(tmpSlugDir, 'workspace');
      const slugRunId = 'slug-test-1';
      const slugS1Out = path.join(slugWs, 'runs', slugRunId, 'stages', '01_research', 'output');
      fs.mkdirSync(slugS1Out, { recursive: true });
      fs.writeFileSync(
        path.join(slugS1Out, 'research_summary.md'),
        [
          '---',
          'type: Research Concept',
          'title: "Comprehensive Operational Readiness Guide in Europe"',
          'status: stable',
          '---',
          '# Comprehensive Operational Readiness Guide in Europe',
          '',
          'Grounded operational summary.',
        ].join('\n'),
        'utf-8'
      );
      const syncedSlugRes = syncRunToBundle(slugWs, slugRunId);
      assert(
        truncateSlugAtWordBoundary('comprehensive-operational-readiness-guide-in-europe', 48, 12, true) ===
          'comprehensive-operational-readiness-guide' &&
          truncateSlugAtWordBoundary('comprehensive-operational-readiness-guide-in-a-zone', 48, 12, true) ===
            'comprehensive-operational-readiness-guide' &&
          truncateSlugAtWordBoundary('plan-a', 48, 12, true) === 'plan-a' &&
          truncateSlugAtWordBoundary('guide-v2-in-practice', 48, 12, true) === 'guide-v2-in-practice' &&
          truncateSlugAtWordBoundary('comprehensive-operational-readiness-guide-v2-europe', 48, 12, true) ===
            'comprehensive-operational-readiness-guide-v2' &&
          syncedSlugRes?.conceptId === 'research/comprehensive-operational-readiness-guide',
        `P5.4 truncateSlugAtWordBoundary(..., 48, 12, true) strips trailing 1-2 char stopwords when truncated while keeping <=48 slugs and digit-suffixed segments intact (conceptId=${syncedSlugRes?.conceptId})`
      );
    } finally {
      fs.rmSync(tmpSlugDir, { recursive: true, force: true });
    }

    // 5.5: `checkUpstreamSpecs` `{ versions: [...] }` object shape & `getIcmPipelineStatus` `meta.createdAt` timestamp resolution
    const origFetchSpecCheck = globalThis.fetch;
    try {
      const lockPin = JSON.parse(
        fs.readFileSync(path.join(repoRootForTsc, 'specification', 'UPSTREAM_LOCK.json'), 'utf-8')
      );
      let mockA2uiCurrentVer = `v${lockPin?.a2ui?.protocolVersion || '1.0'}`;
      globalThis.fetch = (async (url: string | URL | Request) => {
        const u = String(url);
        if (u.endsWith('/versions.json')) {
          return new Response(
            JSON.stringify({
              $comment: 'Single source of truth for A2UI protocol version status.',
              versions: [
                { version: mockA2uiCurrentVer, status: 'current' },
                { version: 'v0.9', status: 'previous' },
              ],
            }),
            { status: 200, headers: { 'content-type': 'application/json' } }
          );
        }
        if (u.endsWith('/SPEC.md')) {
          return new Response(`# Open Knowledge Format\n\n**Version ${lockPin?.okf?.okfVersion || '0.3'}**\n`, {
            status: 200,
            headers: { 'content-type': 'text/plain; charset=utf-8' },
          });
        }
        const sha = u.includes(lockPin?.icm?.repository)
          ? lockPin.icm.commit
          : u.includes(lockPin?.okf?.repository)
            ? lockPin.okf.commit
            : lockPin.a2ui.commit;
        return new Response(
          JSON.stringify([{ sha, commit: { committer: { date: '2026-11-01T00:00:00Z' } } }]),
          { status: 200, headers: { 'content-type': 'application/json' } }
        );
      }) as typeof fetch;

      const specUpToDate = await checkUpstreamSpecs({
        lockPath: path.join(repoRootForTsc, 'specification', 'UPSTREAM_LOCK.json'),
      });
      mockA2uiCurrentVer = 'v2.0';
      const specNewProto = await checkUpstreamSpecs({
        lockPath: path.join(repoRootForTsc, 'specification', 'UPSTREAM_LOCK.json'),
      });
      assert(
        specUpToDate.status === 'up-to-date' &&
          specUpToDate.pillars.a2ui.status === 'up-to-date' &&
          specUpToDate.pillars.a2ui.upstreamCurrentVersion === '1.0' &&
          specNewProto.status === 'new-protocol-version' &&
          specNewProto.pillars.a2ui.status === 'new-protocol-version' &&
          specNewProto.pillars.a2ui.upstreamCurrentVersion === '2.0',
        `P5.5 checkUpstreamSpecs unwraps { versions: [...] } manifest objects to detect up-to-date (v1.0) and new-protocol-version (v2.0)`
      );
    } finally {
      globalThis.fetch = origFetchSpecCheck;
    }

    const tmpStatusMetaDir = fs.mkdtempSync(path.join(os.tmpdir(), 'icm-p5-status-created-'));
    try {
      const statusWs = path.join(tmpStatusMetaDir, 'workspace');
      for (const [rId, metaObj] of [
        ['run-older', { runId: 'run-older', topic: 'Older', createdAt: '2026-01-10T08:00:00Z' }],
        ['run-newer', { runId: 'run-newer', topic: 'Newer', createdAt: '2026-06-15T12:30:00Z' }],
        ['run-legacy', { runId: 'run-legacy', topic: 'Legacy', startedAt: '2025-05-01T00:00:00Z' }],
      ] as const) {
        const rDir = path.join(statusWs, 'runs', rId);
        fs.mkdirSync(rDir, { recursive: true });
        fs.writeFileSync(path.join(rDir, 'meta.json'), JSON.stringify(metaObj), 'utf-8');
      }
      const statusCreatedReport = getIcmPipelineStatus({ workspaceRoot: statusWs });
      assert(
        statusCreatedReport.runs.length === 3 &&
          statusCreatedReport.runs[0]?.runId === 'run-newer' &&
          statusCreatedReport.runs[0]?.startedAt === '2026-06-15T12:30:00Z' &&
          statusCreatedReport.runs[1]?.runId === 'run-older' &&
          statusCreatedReport.runs[1]?.startedAt === '2026-01-10T08:00:00Z' &&
          statusCreatedReport.runs[2]?.runId === 'run-legacy' &&
          statusCreatedReport.runs[2]?.startedAt === '2025-05-01T00:00:00Z' &&
          inferSourceMimeTypeFromUrl(
            'https://api.example-registry.org/v1/publicData/active-statutes.tar.bz2#sf/reg-101.xml'
          ) === 'application/xml' &&
          inferSourceMimeTypeFromUrl(
            'https://api.example-registry.org/v1/publicData/active-statutes.tar.bz2'
          ) === 'application/x-bzip2',
        `P5.5 getIcmPipelineStatus populates startedAt and sorts runs chronologically from meta.createdAt (with meta.startedAt fallback), and inferSourceMimeTypeFromUrl resolves #entry.xml archive fragments`
      );
    } finally {
      fs.rmSync(tmpStatusMetaDir, { recursive: true, force: true });
    }
  }

  // P6: Interactive Intermission Adjudication (OKF x-adjudications, Auto-Extraction, Studio Controls, CLI --verify & Stage 2 Preamble)
  {
    // 6.0: UI Locale keys & {resolved}/{deferred} placeholder guard
    const invalidCounterPack = mergeIcmLocalePack({
      bcp47: 'nb-NO',
      ui: { adjudicateCounterLabel: 'Ugyldig teller uten plassholdere' },
    });
    assert(
      DEFAULT_EN_UI_LOCALE.adjudicateApproveSwitch === 'Approve Source Switch' &&
        DEFAULT_EN_UI_LOCALE.adjudicateCheckLater === 'Check Later' &&
        DEFAULT_EN_UI_LOCALE.adjudicateResolved === 'Resolved' &&
        DEFAULT_EN_UI_LOCALE.adjudicateSaveNote === 'Save Decision' &&
        DEFAULT_EN_UI_LOCALE.adjudicateNotePlaceholder ===
          'Optional local note or verified value...' &&
        DEFAULT_EN_UI_LOCALE.adjudicateCounterLabel ===
          '{resolved} resolved · {deferred} check later' &&
        DEFAULT_ICM_LOCALE.ui.adjudicateCounterLabel ===
          DEFAULT_EN_UI_LOCALE.adjudicateCounterLabel &&
        invalidCounterPack.ui.adjudicateCounterLabel ===
          '{resolved} resolved · {deferred} check later',
      'P6.0 locale.ts exposes all 6 adjudicate* keys and guards {resolved}/{deferred} placeholders'
    );

    // 6.1: parseOkfDocument / serializeOkfDocument lossless round-trip of x-adjudications
    const roundTripItems: OkfAdjudicationItem[] = [
      {
        id: 'item-1-archive-mismatch',
        number: 1,
        kind: 'source-switch',
        title: 'Archive Reference Mismatch',
        summary: 'Archive extract cites old snapshot[^legacy-src], active statute is in [^active-src].',
        options: [
          {
            label: 'legacy-src -> active-src',
            value: 'replace:legacy-src=active-src',
            sourceIds: ['active-src'],
            replaceSource: { oldId: 'legacy-src', newTarget: 'active-src' },
          },
        ],
        status: 'resolved',
        selected: 'replace:legacy-src=active-src',
        decided_by: 'human:reviewer',
        decided_at: '2026-11-27T10:00:00Z',
      },
      {
        id: 'item-2-service-hours',
        number: 2,
        kind: 'select-value',
        title: 'Operating Window (`07:00–16:30` vs. `07:00–17:00`)',
        summary: 'Portal states 07:00–16:30[^active-src].',
        options: [
          { label: '07:00–16:30', value: '07:00–16:30', sourceIds: ['active-src'] },
          { label: '07:00–17:00', value: '07:00–17:00', sourceIds: ['legacy-src'] },
        ],
        status: 'resolved',
        selected: '07:00–16:30',
        note: 'Confirmed: winter schedule applies',
        decided_by: 'human:reviewer',
        decided_at: '2026-11-27T10:00:00Z',
      },
      {
        id: 'item-3-internal-roster',
        number: 3,
        kind: 'open-gap',
        title: 'Internal Shift Roster',
        summary: 'Unpublished operational detail.',
        options: [],
        status: 'check-later',
        note: 'Verify during on-site walkthrough',
        decided_by: 'human:reviewer',
        decided_at: '2026-11-27T10:00:00Z',
      },
    ];
    const rtRawDoc = parseOkfDocument(
      [
        '---',
        'type: Research Concept',
        'title: "Adjudication Round-Trip Concept"',
        'description: "Verifies lossless YAML serialization of x-adjudications."',
        'status: stable',
        'generated:',
        '  by: agent:gemini-4-argon',
        '  at: 2026-11-27T09:00:00Z',
        'verified:',
        '  - by: human:reviewer',
        '    at: 2026-11-27T10:00:00Z',
        'sources:',
        '  - id: active-src',
        '    title: "Active Official Registry"',
        '    resource: "https://registry.example.org/statutes/active"',
        '    retrieved_at: 2026-11-27T09:00:00Z',
        '---',
        '# Adjudication Round-Trip Concept',
        '',
        'Active requirement applies[^active-src].',
        '',
        '[^active-src]: Active Official Registry',
        '',
      ].join('\n')
    );
    rtRawDoc.frontmatter['x-adjudications'] = roundTripItems;
    const rtSerialized = serializeOkfDocument(rtRawDoc);
    const rtReparsed = parseOkfDocument(rtSerialized);
    const rtAdj = rtReparsed.frontmatter['x-adjudications'] || [];
    assert(
      rtAdj.length === 3 &&
        rtAdj[0]?.id === 'item-1-archive-mismatch' &&
        rtAdj[0]?.kind === 'source-switch' &&
        rtAdj[0]?.options?.[0]?.replaceSource?.oldId === 'legacy-src' &&
        rtAdj[0]?.options?.[0]?.replaceSource?.newTarget === 'active-src' &&
        rtAdj[1]?.kind === 'select-value' &&
        rtAdj[1]?.selected === '07:00–16:30' &&
        rtAdj[1]?.note === 'Confirmed: winter schedule applies' &&
        rtAdj[2]?.kind === 'open-gap' &&
        rtAdj[2]?.status === 'check-later' &&
        rtAdj[2]?.decided_by === 'human:reviewer',
      `P6.1 parseOkfDocument/serializeOkfDocument round-trips x-adjudications losslessly (got ${JSON.stringify(rtAdj)})`
    );

    // 6.2: extractIntermissionAdjudications auto-detecting source-switch, 2-way & 3-way select-value, and open-gap
    const sampleIntermissionMd = [
      '---',
      'type: Research Concept',
      'title: "Operational Facility Compliance Audit"',
      'description: "Grounded compliance synthesis with trailing Intermission conflicts."',
      'tags: [compliance, audit, operations]',
      'status: draft',
      'generated:',
      '  by: agent:gemini-4-argon',
      '  at: 2026-11-27T09:00:00Z',
      'stale_after: 2027-11-27T00:00:00Z',
      'sources:',
      '  - id: archive-snapshot',
      '    title: "Historical Archive Snapshot 2019"',
      '    resource: "https://archive.example.org/snapshots/2019-reg"',
      '    retrieved_at: 2026-11-27T09:00:00Z',
      '  - id: primary-statute',
      '    title: "Current National Facility Regulation"',
      '    resource: "https://registry.example.org/regulations/current-2026"',
      '    retrieved_at: 2026-11-27T09:00:00Z',
      '  - id: municipal-portal',
      '    title: "Municipal Facility Information Page"',
      '    resource: "https://municipality.example.org/facilities/unit-4"',
      '    retrieved_at: 2026-11-27T09:00:00Z',
      '  - id: national-cadastre',
      '    title: "National Facility Registry Feed"',
      '    resource: "https://cadastre.example.org/units/unit-4"',
      '    retrieved_at: 2026-11-27T09:00:00Z',
      '---',
      '# Operational Facility Compliance Audit',
      '',
      '## 1. Statutory Baseline',
      '',
      'The facility operates under current national safety regulations[^primary-statute] and historical extract notes[^archive-snapshot], with published municipal profile[^municipal-portal] and registry metrics[^national-cadastre].',
      '',
      '## 6. Kildekonflikter, avvik og uavklarte punkter (Intermission)',
      '',
      '1. **Arkivavvik i referanseutdrag**:',
      '   - Det eldre arkivutdraget viser til utgått forskriftstekst[^archive-snapshot].',
      '   - Gjeldende forskrift i hovedregisteret er den autoritative kilden[^primary-statute].',
      '2. **Åpningstid (`07:00–16:30` vs. `07:00–17:00`)**:',
      '   - Kommunens informasjonsside oppgir `07:00–16:30`[^municipal-portal].',
      '   - Nasjonalt enhetsregister oppgir `07:00–17:00`[^national-cadastre].',
      '3. **Kapasitetstak (`60 plasser` vs. `75 plasser` vs. `90 plasser`)**:',
      '   - Kommunal nettside nevner `60 plasser`[^municipal-portal], tilsynsvedtak oppgir `75 plasser`[^primary-statute], og eldre ramme viser `90 plasser`[^national-cadastre].',
      '4. **Interne driftsdetaljer og lokal vaktplan**:',
      '   - Intern sjekkrutine og romfordeling er ikke offentlig publisert og må verifiseres lokalt[^municipal-portal].',
      '',
      '[^archive-snapshot]: Historical Archive Snapshot 2019',
      '[^primary-statute]: Current National Facility Regulation',
      '[^municipal-portal]: Municipal Facility Information Page',
      '[^national-cadastre]: National Facility Registry Feed',
      '',
    ].join('\n');

    const extractedAdj = extractIntermissionAdjudications(parseOkfDocument(sampleIntermissionMd));
    assert(
      extractedAdj.length === 4 &&
        extractedAdj[0]?.kind === 'source-switch' &&
        extractedAdj[0]?.options?.some(
          (o) =>
            o.replaceSource?.oldId === 'archive-snapshot' &&
            o.replaceSource?.newTarget === 'primary-statute'
        ) &&
        extractedAdj[1]?.kind === 'select-value' &&
        extractedAdj[1]?.options?.length === 2 &&
        extractedAdj[1]?.options?.[0]?.value === '07:00–16:30' &&
        extractedAdj[1]?.options?.[1]?.value === '07:00–17:00' &&
        extractedAdj[2]?.kind === 'select-value' &&
        extractedAdj[2]?.options?.length === 3 &&
        extractedAdj[2]?.options?.[2]?.value === '90 plasser' &&
        extractedAdj[3]?.kind === 'open-gap',
      `P6.2 extractIntermissionAdjudications detects source-switch, 2-way & 3-way select-value, and open-gap from trailing Konflikter/Intermission section (got ${JSON.stringify(extractedAdj)})`
    );

    const directApplied = applyIntermissionAdjudications(sampleIntermissionMd, {
      resolveMap: { '1': 'replace:archive-snapshot=primary-statute', '2': '07:00–16:30' },
      deferIds: ['4'],
      noteMap: { '4': 'Confirm roster on site' },
      actor: 'human:inspector',
      nowIso: '2026-11-27T11:00:00Z',
    });
    assert(
      directApplied.autoReplaceSources['archive-snapshot'] === 'primary-statute' &&
        directApplied.items.find((it) => it.number === 1)?.status === 'resolved' &&
        directApplied.items.find((it) => it.number === 2)?.selected === '07:00–16:30' &&
        directApplied.items.find((it) => it.number === 4)?.status === 'check-later' &&
        directApplied.items.find((it) => it.number === 4)?.note === 'Confirm roster on site',
      'P6.2b applyIntermissionAdjudications resolves items by number/id, records autoReplaceSources, and preserves check-later with note'
    );

    // 6.3 & 6.4: Studio adjudicateItemInStudio + .okf-adj-bar DOM + verifyOkfConcept + strict validateOkfBundle + Stage 2 --dry-run + CLI --verify
    const tmpAdjWsRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'icm-p6-adj-'));
    try {
      const adjWs = path.join(tmpAdjWsRoot, 'workspace');
      const adjPrompts = path.join(tmpAdjWsRoot, 'prompts');
      const adjRunId = 'facility-audit-1795765000000';
      const adjS1Out = path.join(adjWs, 'runs', adjRunId, 'stages', '01_research', 'output');
      fs.mkdirSync(adjS1Out, { recursive: true });
      fs.mkdirSync(adjPrompts, { recursive: true });
      fs.writeFileSync(path.join(adjS1Out, 'research_summary.md'), sampleIntermissionMd, 'utf-8');
      fs.writeFileSync(
        path.join(adjWs, 'runs', adjRunId, 'meta.json'),
        JSON.stringify(
          {
            runId: adjRunId,
            topic: 'Operational Facility Compliance Audit',
            model: GEMINI_4_ARGON_MODEL,
            createdAt: '2026-11-27T09:00:00Z',
            status: 'stage1_completed',
          },
          null,
          2
        ),
        'utf-8'
      );
      syncRunToBundle(adjWs, adjRunId);

      const adjSurfaceRes = generateA2uiSurface({ workspaceRoot: adjWs, runId: adjRunId });
      const adjHtml = fs.readFileSync(adjSurfaceRes.htmlOutputPath, 'utf-8');
      const adjPayloadMatch = adjHtml.match(
        /<script>\s*window\.A2UI_SURFACE_PAYLOAD\s*=\s*([\s\S]*?);\s*<\/script>/
      );
      const adjPayload = adjPayloadMatch ? JSON.parse(adjPayloadMatch[1]) : {};
      const adjHooks: Record<string, any> = {};
      // eslint-disable-next-line no-new-func
      new Function('window', A2UI_STUDIO_JS)({
        A2UI_SURFACE_PAYLOAD: adjPayload,
        __ICM_TEST_HOOKS__: adjHooks,
      });
      for (const msg of adjSurfaceRes.messages) {
        adjHooks.processMessage(msg);
      }
      const adjSurface = adjHooks.surfaces[adjSurfaceRes.surfaceId];
      const surfaceAdjList: OkfAdjudicationItem[] =
        adjHooks.resolvePointer(adjSurface.dataModel, '/okf/adjudications') || [];
      assert(
        typeof adjHooks.adjudicateItemInStudio === 'function' && surfaceAdjList.length === 4,
        `P6.3 surface /okf/adjudications exposes 4 extracted items and window.__ICM_TEST_HOOKS__.adjudicateItemInStudio`
      );

      const item1Id = surfaceAdjList[0]!.id;
      const item2Id = surfaceAdjList[1]!.id;
      const item4Id = surfaceAdjList[3]!.id;
      const item1SwitchVal =
        surfaceAdjList[0]!.options?.[0]?.value || 'replace:archive-snapshot=primary-statute';

      adjHooks.adjudicateItemInStudio(adjSurface, item1Id, {
        status: 'resolved',
        selected: item1SwitchVal,
        replaceSource: { oldId: 'archive-snapshot', newTarget: 'primary-statute' },
      });
      adjHooks.adjudicateItemInStudio(adjSurface, item2Id, {
        status: 'resolved',
        selected: '07:00–16:30',
        note: 'Verified with unit coordinator',
      });
      adjHooks.adjudicateItemInStudio(adjSurface, item4Id, {
        status: 'check-later',
        note: 'Inspect binder on site',
      });

      const adjPromptsBuilt = adjHooks.buildCurationPrompts(adjSurface);
      assert(
        adjPromptsBuilt.cliText.includes('--replace-source archive-snapshot=primary-statute') &&
          adjPromptsBuilt.cliText.includes(`--resolve`) &&
          adjPromptsBuilt.cliText.includes('07:00–16:30') &&
          adjPromptsBuilt.cliText.includes(`--defer`) &&
          adjPromptsBuilt.cliText.includes(item4Id) &&
          adjPromptsBuilt.cliText.includes(`--note`) &&
          adjPromptsBuilt.cliText.includes('Inspect binder on site'),
        `P6.3b adjudicateItemInStudio + buildCurationPrompts emits --replace-source, --resolve, --defer, and --note (got cliText="${adjPromptsBuilt.cliText}")`
      );

      // Verify OkfMarkdown renders .okf-adj-bar controls in DOM
      const prevAdjDoc = (globalThis as any).document;
      let renderedHasAdjBar = false;
      try {
        const mkDomNode = (tag: string): any => {
          const classes = new Set<string>();
          const node: any = {
            nodeType: 1,
            tagName: String(tag || 'div').toUpperCase(),
            id: '',
            _className: '',
            get className() {
              return this._className;
            },
            set className(val: string) {
              this._className = String(val || '');
              classes.clear();
              for (const tok of this._className.split(/\s+/).filter(Boolean)) classes.add(tok);
            },
            textContent: '',
            _innerHTML: '',
            get innerHTML() {
              return this._innerHTML;
            },
            set innerHTML(val: string) {
              this._innerHTML = String(val || '');
            },
            value: '',
            type: '',
            placeholder: '',
            title: '',
            style: {},
            dataset: {} as Record<string, string>,
            attributes: {} as Record<string, string>,
            children: [] as any[],
            parentNode: null as any,
            appendChild(child: any) {
              if (child) {
                child.parentNode = this;
                this.children.push(child);
              }
              return child;
            },
            insertBefore(newNode: any, refNode: any) {
              if (!newNode) return newNode;
              newNode.parentNode = this;
              const idx = this.children.indexOf(refNode);
              if (idx >= 0) this.children.splice(idx, 0, newNode);
              else this.children.push(newNode);
              return newNode;
            },
            replaceChildren(...nodes: any[]) {
              this.children = [];
              for (const n of nodes) {
                if (n) this.appendChild(n);
              }
            },
            setAttribute(k: string, v: string) {
              this.attributes[k] = String(v);
              if (k === 'class') this.className = String(v);
              if (k === 'id') this.id = String(v);
            },
            getAttribute(k: string) {
              return Object.prototype.hasOwnProperty.call(this.attributes, k)
                ? this.attributes[k]
                : null;
            },
            addEventListener() {},
            querySelectorAll(selector: string) {
              const found: any[] = [];
              const matchSimple = (el: any): boolean => {
                if (!el || el.nodeType !== 1) return false;
                return selector
                  .split(',')
                  .map((s) => s.trim())
                  .some((sel) => {
                    if (sel.startsWith('.')) return el.classList.contains(sel.slice(1));
                    if (/^[a-z0-9]+$/i.test(sel)) return el.tagName === sel.toUpperCase();
                    if (sel === 'ol > li' || sel === 'li') return el.tagName === 'LI';
                    return false;
                  });
              };
              const walk = (cur: any) => {
                for (const ch of cur.children || []) {
                  if (matchSimple(ch)) found.push(ch);
                  walk(ch);
                }
              };
              walk(this);
              return found;
            },
            querySelector(selector: string) {
              return this.querySelectorAll(selector)[0] || null;
            },
            classList: {
              add(...tokens: string[]) {
                for (const t of tokens) {
                  if (t) classes.add(t);
                }
                node._className = Array.from(classes).join(' ');
              },
              remove(...tokens: string[]) {
                for (const t of tokens) classes.delete(t);
                node._className = Array.from(classes).join(' ');
              },
              toggle(t: string, force?: boolean) {
                const next = force !== undefined ? force : !classes.has(t);
                if (next) classes.add(t);
                else classes.delete(t);
                node._className = Array.from(classes).join(' ');
                return next;
              },
              contains: (t: string) => classes.has(t),
            },
          };
          return node;
        };
        (globalThis as any).document = {
          title: '',
          createElement: mkDomNode,
          createTextNode: (txt: string) => ({ nodeType: 3, textContent: String(txt) }),
          getElementById: () => null,
          querySelector: () => null,
          querySelectorAll: () => [],
        };
        const okfMdComp = Object.values(adjSurface.components).find(
          (c: any) => c && c.component === 'OkfMarkdown'
        );
        const renderedMdEl = okfMdComp ? adjHooks.renderComponent(adjSurface, okfMdComp) : null;
        const treeContainsAdjBar = (el: any): boolean => {
          if (!el) return false;
          if (
            String(el.className || '').includes('okf-adj-bar') ||
            String(el.innerHTML || '').includes('okf-adj-bar')
          ) {
            return true;
          }
          return Array.isArray(el.children) && el.children.some((ch: any) => treeContainsAdjBar(ch));
        };
        renderedHasAdjBar = treeContainsAdjBar(renderedMdEl);
      } finally {
        if (prevAdjDoc === undefined) delete (globalThis as any).document;
        else (globalThis as any).document = prevAdjDoc;
      }
      assert(
        renderedHasAdjBar === true,
        'P6.3c OkfMarkdown renders interactive .okf-adj-bar controls when /okf/adjudications is populated'
      );

      // 6.4: verifyOkfConcept with VerifyOkfOptions (resolveMap, deferIds, noteMap) + strict validateOkfBundle + Stage 2 --dry-run
      const verifyOpts: VerifyOkfOptions = {
        workspaceRoot: adjWs,
        by: 'human:compliance-lead',
        resolveMap: {
          [item1Id]: item1SwitchVal,
          [item2Id]: '07:00–16:30',
          '3': '75 plasser',
        },
        deferIds: [item4Id],
        noteMap: {
          [item2Id]: 'Verified with unit coordinator',
          [item4Id]: 'Inspect binder on site',
        },
      };
      const adjVerifyRes = verifyOkfConcept(adjRunId, verifyOpts);
      const verifiedRunMd = fs.readFileSync(path.join(adjS1Out, 'research_summary.md'), 'utf-8');
      const verifiedRunDoc = parseOkfDocument(verifiedRunMd);
      const persistedAdj = verifiedRunDoc.frontmatter['x-adjudications'] || [];
      const strictAdjBundleReport = validateOkfBundle(path.join(adjWs, 'bundle'), { strict: true });

      assert(
        adjVerifyRes.status === 'stable' &&
          adjVerifyRes.trust_tier === 'human-reviewed' &&
          adjVerifyRes.replacedMap['archive-snapshot'] === 'primary-statute' &&
          !verifiedRunDoc.frontmatter.sources?.some((s) => s.id === 'archive-snapshot') &&
          persistedAdj.length === 4 &&
          persistedAdj.find((i) => i.id === item2Id)?.selected === '07:00–16:30' &&
          persistedAdj.find((i) => i.id === item4Id)?.status === 'check-later' &&
          strictAdjBundleReport.passed === true &&
          strictAdjBundleReport.errors === 0 &&
          strictAdjBundleReport.warnings === 0 &&
          strictAdjBundleReport.info === 0,
        `P6.4a verifyOkfConcept persists x-adjudications, auto-executes source-switch replacement, and passes strict validateOkfBundle with 0 findings (findings=${JSON.stringify(strictAdjBundleReport.findings)})`
      );

      // Stage 2 --dry-run preamble injection check
      const prevAdjCwd = process.cwd();
      try {
        fs.copyFileSync(
          path.join(repoRootForTsc, 'prompts', '02_script.md'),
          path.join(adjPrompts, '02_script.md')
        );
        process.chdir(tmpAdjWsRoot);
        const s2DryAdj = await runStage2Flow({
          workspaceRoot: adjWs,
          runId: adjRunId,
          dryRun: true,
        });
        const s2AssembledMd = fs.readFileSync(s2DryAdj.outputPath, 'utf-8');
        assert(
          s2AssembledMd.includes('VERIFIED INTERMISSION ADJUDICATIONS') &&
            s2AssembledMd.includes(
              'Use "07:00–16:30" (Verified with unit coordinator) as the verified authoritative value; do not hedge with rejected alternatives.'
            ) &&
            s2AssembledMd.includes('Use "75 plasser" as the verified authoritative value') &&
            s2AssembledMd.includes('[CHECK LATER]') &&
            s2AssembledMd.includes('(Inspect binder on site): Treat as unconfirmed locally'),
          'P6.4b runStage2Flow --dry-run injects VERIFIED INTERMISSION ADJUDICATIONS ([RESOLVED] & [CHECK LATER]) into 02_script/input/prompt_assembled.md'
        );
      } finally {
        process.chdir(prevAdjCwd);
      }

      // CLI --verify end-to-end check for --resolve, --defer, and --note
      const cliAdjRunId = 'cli-adj-run-1795765000001';
      const cliAdjOut = path.join(adjWs, 'runs', cliAdjRunId, 'stages', '01_research', 'output');
      fs.mkdirSync(cliAdjOut, { recursive: true });
      fs.writeFileSync(path.join(cliAdjOut, 'research_summary.md'), sampleIntermissionMd, 'utf-8');
      const cliVerifyProc = spawnSync(
        process.execPath,
        [
          path.join(repoRootForTsc, 'bin', 'oks.mjs'),
          '--cwd',
          tmpAdjWsRoot,
          '--verify',
          cliAdjRunId,
          '--resolve',
          `${item1Id}=${item1SwitchVal}`,
          '--resolve',
          `${item2Id}=07:00–17:00`,
          '--defer',
          `${item4Id}`,
          '--note',
          `${item4Id}=Local walkthrough scheduled`,
          '--by',
          'human:cli-reviewer',
        ],
        { encoding: 'utf-8' }
      );
      const cliVerifiedDoc = parseOkfDocument(
        fs.readFileSync(path.join(cliAdjOut, 'research_summary.md'), 'utf-8')
      );
      const cliSavedAdj = cliVerifiedDoc.frontmatter['x-adjudications'] || [];
      assert(
        cliVerifyProc.status === 0 &&
          cliVerifiedDoc.frontmatter.status === 'stable' &&
          cliSavedAdj.find((i) => i.id === item2Id)?.selected === '07:00–17:00' &&
          cliSavedAdj.find((i) => i.id === item4Id)?.status === 'check-later' &&
          cliSavedAdj.find((i) => i.id === item4Id)?.note === 'Local walkthrough scheduled',
        `P6.4c CLI --verify parses repeatable --resolve, --defer, and --note flags cleanly (exit=${cliVerifyProc.status}, stderr=${cliVerifyProc.stderr})`
      );
    } finally {
      fs.rmSync(tmpAdjWsRoot, { recursive: true, force: true });
    }
  }

  // P7: A2UI Studio Unified Light/Dark Semantic Theme Tokens, Toggle Button, and Regression Guards
  {
    const parseCssVarBlock = (blockBody: string): Map<string, string> => {
      const out = new Map<string, string>();
      const re = /(--[a-zA-Z0-9_-]+)\s*:\s*([^;]+);/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(blockBody)) !== null) {
        out.set(m[1]!, m[2]!.trim());
      }
      return out;
    };

    const lightRootMatch = A2UI_STUDIO_CSS.match(
      /:root\s*,\s*:root\[data-theme="light"\]\s*\{([\s\S]*?)\}/
    );
    const mediaDarkMatch = A2UI_STUDIO_CSS.match(
      /@media\s*\(prefers-color-scheme:\s*dark\)\s*\{\s*:root:not\(\[data-theme="light"\]\)\s*\{([\s\S]*?)\}\s*\}/
    );
    const explicitDarkMatch = A2UI_STUDIO_CSS.match(
      /:root\[data-theme="dark"\][^{]*\{([\s\S]*?)\}/
    );

    const lightVars = parseCssVarBlock(lightRootMatch?.[1] || '');
    const mediaDarkVars = parseCssVarBlock(mediaDarkMatch?.[1] || '');
    const explicitDarkVars = parseCssVarBlock(explicitDarkMatch?.[1] || '');

    const requiredThemeTokens = [
      '--bg',
      '--surface',
      '--surface-elevated',
      '--surface-2',
      '--surface-subtle',
      '--surface-3',
      '--surface-input',
      '--code-bg',
      '--code-fg',
      '--text',
      '--text-secondary',
      '--text-muted',
      '--heading',
      '--border',
      '--border-strong',
      '--shadow-sm',
      '--link',
      '--link-hover',
      '--accent-soft-bg',
      '--accent-soft-fg',
      '--accent-soft-border',
      '--ok-bg',
      '--ok-fg',
      '--ok-border',
      '--warn-bg',
      '--warn-fg',
      '--warn-border',
      '--err-bg',
      '--err-fg',
      '--err-border',
      '--info-bg',
      '--info-fg',
      '--info-border',
    ];

    const allRequiredPresent = requiredThemeTokens.every(
      (tok) => lightVars.has(tok) && mediaDarkVars.has(tok) && explicitDarkVars.has(tok)
    );
    const darkKeys = Array.from(explicitDarkVars.keys()).sort();
    const mediaKeys = Array.from(mediaDarkVars.keys()).sort();
    const darkParityExact =
      darkKeys.length > 0 &&
      darkKeys.length === mediaKeys.length &&
      darkKeys.every(
        (k, idx) => k === mediaKeys[idx] && explicitDarkVars.get(k) === mediaDarkVars.get(k)
      );

    assert(
      allRequiredPresent && darkParityExact,
      'P7.1 studio.css defines complete semantic tokens with exact parity between :root[data-theme="dark"] and @media (prefers-color-scheme: dark) :root:not([data-theme="light"])'
    );

    // WCAG AA (>= 4.5:1) mathematical contrast check on core Light & Dark pairs
    const hexLuminance = (hex: string): number => {
      const h = hex.trim().replace(/^#/, '');
      const r = parseInt(h.slice(0, 2), 16) / 255;
      const g = parseInt(h.slice(2, 4), 16) / 255;
      const b = parseInt(h.slice(4, 6), 16) / 255;
      const chan = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
      return 0.2126 * chan(r) + 0.7152 * chan(g) + 0.0722 * chan(b);
    };
    const contrastRatio = (fg: string, bg: string): number => {
      const l1 = hexLuminance(fg);
      const l2 = hexLuminance(bg);
      return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    };
    assert(
      contrastRatio(lightVars.get('--text')!, lightVars.get('--surface')!) >= 4.5 &&
        contrastRatio(lightVars.get('--text-muted')!, lightVars.get('--surface-subtle')!) >= 4.5 &&
        contrastRatio(lightVars.get('--link')!, lightVars.get('--surface')!) >= 4.5 &&
        contrastRatio(explicitDarkVars.get('--heading')!, explicitDarkVars.get('--surface')!) >= 4.5 &&
        contrastRatio(explicitDarkVars.get('--text')!, explicitDarkVars.get('--bg')!) >= 4.5 &&
        contrastRatio(explicitDarkVars.get('--text-secondary')!, explicitDarkVars.get('--surface-subtle')!) >= 4.5 &&
        contrastRatio(explicitDarkVars.get('--text-muted')!, explicitDarkVars.get('--surface-subtle')!) >= 4.5 &&
        contrastRatio(explicitDarkVars.get('--link')!, explicitDarkVars.get('--surface-subtle')!) >= 4.5 &&
        contrastRatio(explicitDarkVars.get('--ok-fg')!, explicitDarkVars.get('--ok-bg')!) >= 4.5 &&
        contrastRatio(explicitDarkVars.get('--warn-fg')!, explicitDarkVars.get('--warn-bg')!) >= 4.5 &&
        contrastRatio(explicitDarkVars.get('--err-fg')!, explicitDarkVars.get('--err-bg')!) >= 4.5 &&
        contrastRatio(explicitDarkVars.get('--info-fg')!, explicitDarkVars.get('--info-bg')!) >= 4.5,
      'P7.1b Light and Dark semantic text, link, and status tokens satisfy WCAG AA (>= 4.5:1) contrast'
    );

    // P7.2: Theme toggle button in generated Studio HTML + setStudioTheme / toggleStudioTheme hook behavior
    const storageBacking = new Map<string, string>();
    const mockStorage = {
      getItem: (k: string) => (storageBacking.has(k) ? storageBacking.get(k)! : null),
      setItem: (k: string, v: string) => {
        storageBacking.set(k, String(v));
      },
      removeItem: (k: string) => {
        storageBacking.delete(k);
      },
    };
    const rootAttrs: Record<string, string> = {};
    const btnAttrs: Record<string, string> = {};
    let clickHandler: (() => void) | null = null;
    const mockToggleBtn: any = {
      id: 'a2ui-theme-toggle',
      textContent: '',
      title: '',
      setAttribute(k: string, v: string) {
        btnAttrs[k] = String(v);
      },
      getAttribute(k: string) {
        return Object.prototype.hasOwnProperty.call(btnAttrs, k) ? btnAttrs[k]! : null;
      },
      addEventListener(ev: string, fn: () => void) {
        if (ev === 'click') clickHandler = fn;
      },
    };
    const mockDoc = {
      documentElement: {
        attributes: rootAttrs,
        setAttribute(k: string, v: string) {
          rootAttrs[k] = String(v);
        },
        getAttribute(k: string) {
          return Object.prototype.hasOwnProperty.call(rootAttrs, k) ? rootAttrs[k]! : null;
        },
        removeAttribute(k: string) {
          delete rootAttrs[k];
        },
        classList: { contains: () => false },
      },
      body: { classList: { contains: () => false } },
      getElementById: (id: string) => (id === 'a2ui-theme-toggle' ? mockToggleBtn : null),
      querySelector: () => null,
    };
    const themeHooks: Record<string, any> = {};
    // eslint-disable-next-line no-new-func
    new Function('window', A2UI_STUDIO_JS)({
      document: mockDoc,
      localStorage: mockStorage,
      matchMedia: (q: string) => ({
        matches: q.includes('dark'),
        addEventListener() {},
      }),
      __ICM_TEST_HOOKS__: themeHooks,
    });

    const initialOsTheme = themeHooks.initStudioTheme();
    const afterSetLight = themeHooks.setStudioTheme('light');
    const lightSaved = mockStorage.getItem('icm_a2ui_theme');
    const lightAttr = rootAttrs['data-theme'];
    const lightBtnLabel = String(mockToggleBtn.textContent);
    if (clickHandler) (clickHandler as () => void)();
    const afterClickDark = themeHooks.getEffectiveStudioTheme();
    const darkSaved = mockStorage.getItem('icm_a2ui_theme');
    const darkAttr = rootAttrs['data-theme'];
    const darkBtnLabel = String(mockToggleBtn.textContent);
    const afterResetAuto = themeHooks.setStudioTheme('auto');

    assert(
      initialOsTheme === 'dark' &&
        afterSetLight === 'light' &&
        lightSaved === 'light' &&
        lightAttr === 'light' &&
        lightBtnLabel.includes('Dark') &&
        btnAttrs['aria-pressed'] === 'true' &&
        afterClickDark === 'dark' &&
        darkSaved === 'dark' &&
        darkAttr === 'dark' &&
        darkBtnLabel.includes('Light') &&
        afterResetAuto === 'dark' &&
        rootAttrs['data-theme'] === undefined &&
        mockStorage.getItem('icm_a2ui_theme') === null,
      `P7.2 initStudioTheme honors OS prefers-color-scheme, setStudioTheme/toggleStudioTheme toggle data-theme & icm_a2ui_theme in localStorage, and 'auto' resets cleanly`
    );

    // P7.3: Zero hardcoded white-background / dark-heading regressions on .curation-card / .okf-curation-banner, Markdown headings, .okf-adj-bar, and citation avatars
    const extractCssRuleBodies = (css: string, selectorSubstr: string): string => {
      const blocks: string[] = [];
      const ruleRe = /([^{}]+)\{([^{}]*)\}/g;
      let m: RegExpExecArray | null;
      while ((m = ruleRe.exec(css)) !== null) {
        const sel = m[1]!.trim();
        if (sel.includes(':root')) continue;
        if (sel.includes(selectorSubstr)) {
          blocks.push(m[2]!);
        }
      }
      return blocks.join('\n');
    };

    const curationRuleCss =
      extractCssRuleBodies(A2UI_STUDIO_CSS, '.okf-curation-banner') +
      '\n' +
      extractCssRuleBodies(A2UI_STUDIO_CSS, '.curation-card');
    const mdHeadingRuleCss =
      extractCssRuleBodies(A2UI_STUDIO_CSS, '.okf-md-body h1') +
      '\n' +
      extractCssRuleBodies(A2UI_STUDIO_CSS, '.okf-md-body h2') +
      '\n' +
      extractCssRuleBodies(A2UI_STUDIO_CSS, '.okf-md-body h3') +
      '\n' +
      extractCssRuleBodies(A2UI_STUDIO_CSS, '.okf-md-body h4');
    const adjBarRuleCss = extractCssRuleBodies(A2UI_STUDIO_CSS, '.okf-adj-bar');
    const citeDrawerRuleCss =
      extractCssRuleBodies(A2UI_STUDIO_CSS, '.dr-cite-toggle') +
      '\n' +
      extractCssRuleBodies(A2UI_STUDIO_CSS, '.dr-cite-card');

    const hardcodedWhiteBgRe = /#(?:fff(?:fff)?|f8fafc|eff6ff|f0f4f9|e9eef6)\b|\bwhite\b/i;
    const hardcodedDarkHeadingRe = /#(?:0f172a|1e293b|334155|1f1f1f)\b/i;
    const sampleAvatar = themeHooks.computeCitationChipAvatar(
      'https://lov-example.org/doc',
      { mime_type: 'text/html' },
      's1'
    );
    const pdfAvatar = themeHooks.computeCitationChipAvatar(
      'https://example.org/spec.pdf',
      { mime_type: 'application/pdf' },
      's2'
    );

    const tmpThemeSurfaceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'icm-p7-theme-'));
    let generatedThemeHtml = '';
    try {
      const themeWs = path.join(tmpThemeSurfaceDir, 'workspace');
      fs.mkdirSync(path.join(themeWs, 'bundle'), { recursive: true });
      const themeSurf = generateA2uiSurface({ workspaceRoot: themeWs });
      generatedThemeHtml = fs.readFileSync(themeSurf.htmlOutputPath, 'utf-8');
    } finally {
      fs.rmSync(tmpThemeSurfaceDir, { recursive: true, force: true });
    }

    assert(
      curationRuleCss.includes('var(--curation-bg)') &&
        !hardcodedWhiteBgRe.test(curationRuleCss) &&
        mdHeadingRuleCss.includes('var(--heading)') &&
        !hardcodedDarkHeadingRe.test(mdHeadingRuleCss) &&
        adjBarRuleCss.includes('var(--adj-bg)') &&
        !hardcodedWhiteBgRe.test(adjBarRuleCss) &&
        !hardcodedWhiteBgRe.test(citeDrawerRuleCss) &&
        !hardcodedDarkHeadingRe.test(citeDrawerRuleCss) &&
        String(sampleAvatar?.bg || '').startsWith('var(--avatar-') &&
        String(pdfAvatar?.bg || '').startsWith('var(--avatar-') &&
        generatedThemeHtml.includes('id="a2ui-theme-toggle"') &&
        generatedThemeHtml.includes('icm_a2ui_theme'),
      'P7.3 .curation-card/.okf-curation-banner, Markdown headings, .okf-adj-bar, Deep Research drawers, and citation avatars have zero hardcoded light-only/dark-heading regressions and generated HTML mounts #a2ui-theme-toggle'
    );
  }

  // P8: Post-Cold-Run-21 Polish Regressions (Scoped Ping-Pong, LR Flow Card Flex, Stage 2 Replace Preamble, Reference Auto-Deprecation, Sentence-Initial TTS Section Casing)
  {
    // P8.a: Scoped closeActiveA2uiPingPongListener (ephemeral port: 0, runId & workspaceRoot isolation)
    const tmpPingRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'icm-p8-pingpong-'));
    try {
      const tmpPingWs = path.join(tmpPingRoot, 'workspace-alpha');
      const tmpOtherWs = path.join(tmpPingRoot, 'workspace-other');
      fs.mkdirSync(path.join(tmpPingWs, 'runs', 'run-alpha'), { recursive: true });
      fs.mkdirSync(tmpOtherWs, { recursive: true });

      let boundPort = 0;
      const listenerState = { settled: false };
      let listenReadyResolve!: (port: number) => void;
      const listenReadyPromise = new Promise<number>((res) => {
        listenReadyResolve = res;
      });

      const listenerPromise = startA2uiPingPongListener({
        port: 0,
        workspaceRoot: tmpPingWs,
        runId: 'run-alpha',
        onListening: (p) => {
          boundPort = p;
          listenReadyResolve(p);
        },
      }).then((res) => {
        listenerState.settled = true;
        return res;
      });

      await listenReadyPromise;
      assert(boundPort > 0, 'P8.a1 startA2uiPingPongListener binds ephemeral port > 0');

      const wrongRunClosed = await closeActiveA2uiPingPongListener({
        port: boundPort,
        reason: 'verified',
        runId: 'run-other',
      });
      const untrackedWsClosed = await closeActiveA2uiPingPongListener({
        workspaceRoot: tmpOtherWs,
        reason: 'verified',
        runId: 'run-alpha',
      });
      assert(
        wrongRunClosed === false &&
          untrackedWsClosed === false &&
          listenerState.settled === false &&
          fs.existsSync(path.join(tmpPingWs, '.a2ui-ping-pong.json')),
        `P8.a2 closeActiveA2uiPingPongListener ignores mismatched runId (${wrongRunClosed}) and untracked workspaceRoot (${untrackedWsClosed}) while keeping active listener open`
      );

      const matchingRunClosed = await closeActiveA2uiPingPongListener({
        port: boundPort,
        reason: 'verified',
        runId: 'run-alpha',
      });
      const listenerExit = await listenerPromise;
      assert(
        matchingRunClosed === true &&
          listenerExit.port === boundPort &&
          listenerState.settled === true &&
          !fs.existsSync(path.join(tmpPingWs, '.a2ui-ping-pong.json')),
        'P8.a3 closeActiveA2uiPingPongListener returns true for matching runId, resolves listener cleanly, and cleans up .a2ui-ping-pong.json'
      );
    } finally {
      fs.rmSync(tmpPingRoot, { recursive: true, force: true });
    }

    // P8.b: studio.css flowchart LR vertical stretch fix (.a2ui-flow-ranks.dir-lr .a2ui-flow-node-card { flex: 0 0 auto })
    assert(
      /\.a2ui-flow-ranks\.dir-lr\s+\.a2ui-flow-node-card\s*\{[^}]*flex\s*:\s*0\s+0\s+auto\b/i.test(
        A2UI_STUDIO_CSS
      ),
      'P8.b studio.css defines .a2ui-flow-ranks.dir-lr .a2ui-flow-node-card with flex: 0 0 auto'
    );

    // P8.c: buildStage2AdjudicationsPreamble clean replace:old-src=new-src formatting
    const preambleDoc = parseOkfDocument(
      [
        '---',
        'type: Research Concept',
        'title: "Facility Compliance Baseline"',
        'status: stable',
        '---',
        '# Baseline',
      ].join('\n')
    );
    preambleDoc.frontmatter['x-adjudications'] = [
      {
        id: 'item-1-source-switch',
        number: 1,
        title: 'Archive snapshot mismatch',
        kind: 'source-switch',
        status: 'resolved',
        selected: 'replace:old-src=new-src',
        note: 'Verified primary registry HTML',
      },
    ];
    const preambleOut = buildStage2AdjudicationsPreamble(preambleDoc);
    assert(
      preambleOut.includes(
        'Cite verified source [^new-src] in place of rejected source [^old-src]'
      ) && !preambleOut.includes('replace:'),
      `P8.c buildStage2AdjudicationsPreamble formats replace:old-src=new-src cleanly with zero raw replace: tokens (got: ${preambleOut})`
    );

    // P8.d: verifyOkfConcept auto-deprecates fully-rejected bundle/references/<slug>.md & loadWorkspaceLayers omits deprecated references + localized topbar buttons
    const tmpRefDepRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'icm-p8-refdep-'));
    try {
      const refWs = path.join(tmpRefDepRoot, 'workspace');
      const refBundleRefs = path.join(refWs, 'bundle', 'references');
      const refRunId = 'facility-baseline-1795790000000';
      const refRunOut = path.join(refWs, 'runs', refRunId, 'stages', '01_research', 'output');
      fs.mkdirSync(refBundleRefs, { recursive: true });
      fs.mkdirSync(refRunOut, { recursive: true });
      fs.mkdirSync(path.join(refWs, '_config'), { recursive: true });

      saveWorkspaceLocale(refWs, {
        ...DEFAULT_ICM_LOCALE,
        bcp47: 'de-DE',
        languageName: 'German',
        ui: {
          ...DEFAULT_ICM_LOCALE.ui,
          themeLightLabel: '☀️ Hell',
          themeDarkLabel: '🌙 Dunkel',
          themeToggleTitle: 'Zwischen hellem und dunklem Design wechseln',
          inspectorButtonLabel: '🔍 A2UI-Oberfläche und Datenmodell',
        },
      });

      const staleRefPath = path.join(refBundleRefs, 'wrong-archive-record.md');
      const activeRefPath = path.join(refBundleRefs, 'active-statute-record.md');
      fs.writeFileSync(
        staleRefPath,
        [
          '---',
          'type: Reference',
          'title: "Wrong Archive Extract"',
          'description: "Pre-synced extract pointing to an unrelated temporary record."',
          'status: stable',
          'generated:',
          '  by: "registry-open-data-sync/1.0"',
          '  at: "2026-11-27T08:00:00Z"',
          'verified:',
          '  - by: "registry-open-data-sync/1.0"',
          '    at: "2026-11-27T08:00:00Z"',
          'sources:',
          '  - id: old-src',
          '    title: "Wrong Archive Extract"',
          '    resource: "https://registry.example.org/archive.tar.bz2#wrong-record.xml"',
          '    mime_type: "application/xml"',
          '    retrieved_at: "2026-11-27T08:00:00Z"',
          '---',
          '',
          '# Wrong Archive Extract',
          '',
          'Temporary unrelated provision[^old-src].',
          '',
          '[^old-src]: Wrong Archive Extract',
          '',
        ].join('\n'),
        'utf-8'
      );
      fs.writeFileSync(
        activeRefPath,
        [
          '---',
          'type: Reference',
          'title: "Active Primary Statute Extract"',
          'description: "Verified primary statute extract."',
          'status: stable',
          'generated:',
          '  by: "registry-open-data-sync/1.0"',
          '  at: "2026-11-27T08:00:00Z"',
          'verified:',
          '  - by: "registry-open-data-sync/1.0"',
          '    at: "2026-11-27T08:00:00Z"',
          'sources:',
          '  - id: new-src',
          '    title: "Active Primary Statute Extract"',
          '    resource: "https://registry.example.org/archive.tar.bz2#active-statute.xml"',
          '    mime_type: "application/xml"',
          '    retrieved_at: "2026-11-27T08:00:00Z"',
          '---',
          '',
          '# Active Primary Statute Extract',
          '',
          'Mandatory safety requirement[^new-src].',
          '',
          '[^new-src]: Active Primary Statute Extract',
          '',
        ].join('\n'),
        'utf-8'
      );
      fs.writeFileSync(
        path.join(refRunOut, 'research_summary.md'),
        [
          '---',
          'type: Research Concept',
          'title: "Facility Safety Compliance"',
          'status: draft',
          'generated:',
          '  by: "agent:gemini-4-argon"',
          '  at: "2026-11-27T09:00:00Z"',
          'sources:',
          '  - id: old-src',
          '    title: "Wrong Archive Extract"',
          '    resource: "https://registry.example.org/archive.tar.bz2#wrong-record.xml"',
          '    retrieved_at: "2026-11-27T08:00:00Z"',
          '  - id: new-src',
          '    title: "Active Primary Statute Extract"',
          '    resource: "https://registry.example.org/archive.tar.bz2#active-statute.xml"',
          '    retrieved_at: "2026-11-27T08:00:00Z"',
          '---',
          '',
          '# Facility Safety Compliance',
          '',
          'Safety rule applies[^new-src] with archive note[^old-src].',
          '',
          '[^old-src]: Wrong Archive Extract',
          '[^new-src]: Active Primary Statute Extract',
          '',
        ].join('\n'),
        'utf-8'
      );

      const depVerifyRes = verifyOkfConcept(refRunId, {
        workspaceRoot: refWs,
        by: 'icm-co-architect/gemini-4-argon',
        replaceSourceMap: { 'old-src': 'new-src' },
      });
      const staleRefAfter = parseOkfDocument(fs.readFileSync(staleRefPath, 'utf-8'));
      const activeRefAfter = parseOkfDocument(fs.readFileSync(activeRefPath, 'utf-8'));
      const layersAfter = loadWorkspaceLayers(refWs);
      const a2uiLocalizedHtml = depVerifyRes.a2uiOutputPath
        ? fs.readFileSync(depVerifyRes.a2uiOutputPath, 'utf-8')
        : '';
      const vizLocalizedHtml = depVerifyRes.vizOutputPath
        ? fs.readFileSync(depVerifyRes.vizOutputPath, 'utf-8')
        : '';

      assert(
        staleRefAfter.frontmatter.status === 'deprecated' &&
          activeRefAfter.frontmatter.status === 'stable' &&
          !layersAfter.bundleContext.includes('wrong-archive-record') &&
          layersAfter.bundleContext.includes('active-statute-record') &&
          a2uiLocalizedHtml.includes('data-label-light="☀️ Hell"') &&
          a2uiLocalizedHtml.includes('🔍 A2UI-Oberfläche und Datenmodell') &&
          vizLocalizedHtml.includes('data-label-light="☀️ Hell"'),
        'P8.d verifyOkfConcept auto-deprecates fully-rejected references/<slug>.md, loadWorkspaceLayers omits deprecated references, and topbar theme/inspector labels localize cleanly'
      );
    } finally {
      fs.rmSync(tmpRefDepRoot, { recursive: true, force: true });
    }

    // P8.e: prepareTextForStudioTts preserves leading uppercase on sentence-initial section labels and sentence-initial § 5, while keeping mid-sentence § 5 lowercase
    const customClauseLocale: Partial<IcmLocalePack> = {
      bcp47: 'en-GB',
      languageName: 'English',
      prosody: {
        ...DEFAULT_ICM_LOCALE.prosody,
        section: 'clause',
        sections: 'clauses',
        to: 'to',
        cardinals: {
          '5': 'five',
          '6': 'six',
        },
      },
    };
    const ttsWordLead = prepareTextForStudioTts(
      'Clause 5 sets the baseline, see clause 5 and § 5 for details.',
      customClauseLocale
    );
    const ttsSymbolLead = prepareTextForStudioTts(
      '§ 5 sets the baseline. §§ 5–6 expand the rule, whereas § 5 applies daily.',
      customClauseLocale
    );
    assert(
      ttsWordLead.startsWith('Clause five sets the baseline') &&
        ttsWordLead.includes('see clause five and clause five') &&
        ttsSymbolLead.startsWith('Clause five sets the baseline.') &&
        ttsSymbolLead.includes('. Clauses five to six expand') &&
        ttsSymbolLead.includes('whereas clause five applies'),
      `P8.e prepareTextForStudioTts preserves leading uppercase on sentence-initial section words and §/§§ while keeping mid-sentence § 5 lowercase (word="${ttsWordLead}", sym="${ttsSymbolLead}")`
    );
  }

  console.log(`[ICM Self-Test] ✅ All ${assertions} assertions passed (0 tokens, including tsc --noEmit).`);
  return { passed: assertions };
}
