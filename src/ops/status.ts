import * as fs from 'fs';
import * as path from 'path';

import { type TrustTier, getOkfTrustTier, inspectSourceDomainProvenance, isOkfBlank, isOkfConceptDocument, isOkfStale, normalizeOkfSources, normalizeVerified, parseOkfDocument } from '../okf/index.js';

export interface IcmBundleConceptStatus {
  relativePath: string;
  title: string;
  type: string;
  status: string;
  trustTier: TrustTier;
  verifiedBy?: string;
  isStale: boolean;
  sourcesCount: number;
}

export interface IcmRunStageNodeStatus {
  stageName: string;
  state: 'COMPLETE' | 'PENDING';
  outputFiles: string[];
}

export interface IcmRunPipelineStatus {
  runId: string;
  topic: string;
  startedAt?: string;
  stage1State: 'COMPLETE' | 'PENDING';
  okfGateState: 'VERIFIED' | 'AWAITING REVIEW' | 'PENDING';
  stage2State: 'COMPLETE' | 'PENDING';
  downstreamStages: IcmRunStageNodeStatus[];
  a2uiState: 'READY' | 'INTERMISSION' | 'PENDING';
  okfStatus?: string;
  trustTier?: TrustTier;
  verifiedBy?: string;
  isStale?: boolean;
  sourcesCount: number;
  domainWarningCount: number;
  stage1Tokens: number;
  stage2Tokens: number;
  totalTokens: number;
  nextStepHint: string;
}

export interface IcmPipelineStatusReport {
  workspaceRoot: string;
  layers: {
    globalIdentity: boolean;
    workspaceContext: boolean;
    voiceGuide: boolean;
  };
  bundle: {
    conceptCount: number;
    humanReviewedCount: number;
    machineConfirmedCount: number;
    unverifiedCount: number;
    staleCount: number;
    hasVizHtml: boolean;
    hasA2uiHtml: boolean;
    concepts: IcmBundleConceptStatus[];
  };
  runs: IcmRunPipelineStatus[];
}

/**
 * Inspects `workspace/runs/` and `workspace/bundle/` at zero LLM token cost (`npm run cli:status`)
 * and returns structured ICM + OKF v0.3 + A2UI v1.0 pipeline state inspired by
 * `RinDig/Interpretable-Context-Methodology` (`_core/CONVENTIONS.md` `status` command).
 */
export function getIcmPipelineStatus(options?: {
  workspaceRoot?: string;
  runId?: string;
}): IcmPipelineStatusReport {
  const workspaceRoot = path.resolve(options?.workspaceRoot || './workspace');
  const layers = {
    globalIdentity: fs.existsSync(path.join(workspaceRoot, 'GEMINI.md')),
    workspaceContext: fs.existsSync(path.join(workspaceRoot, 'CONTEXT.md')),
    voiceGuide: fs.existsSync(path.join(workspaceRoot, '_config', 'voice_guide.md')),
  };

  const bundleDir = path.join(workspaceRoot, 'bundle');
  const bundleConcepts: IcmBundleConceptStatus[] = [];
  const walkBundleConcepts = (dir: string) => {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith('.')) continue;
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walkBundleConcepts(fullPath);
      } else if (
        entry.isFile() &&
        entry.name.endsWith('.md') &&
        entry.name !== 'index.md' &&
        entry.name !== 'log.md'
      ) {
        try {
          const raw = fs.readFileSync(fullPath, 'utf-8');
          const doc = parseOkfDocument(raw);
          if (!isOkfConceptDocument(doc)) continue;
          const fm = doc.frontmatter || {};
          const verifiedList = normalizeVerified(fm);
          const normSources = normalizeOkfSources(fm);
          const relPath =
            '/' + path.relative(bundleDir, fullPath).replace(/\\/g, '/').replace(/^\/+/, '');
          bundleConcepts.push({
            relativePath: relPath,
            title: String(fm.title || path.basename(entry.name, '.md')),
            type: String(fm.type).trim(),
            status: isOkfBlank(fm.status) ? 'stable' : String(fm.status).trim(),
            trustTier: getOkfTrustTier(fm),
            verifiedBy: verifiedList[verifiedList.length - 1]?.by,
            isStale: isOkfStale(fm),
            sourcesCount:
              normSources.length > 0
                ? normSources.length
                : typeof fm.resource === 'string' && /^https?:\/\//i.test(fm.resource.trim())
                  ? 1
                  : 0,
          });
        } catch {
          // Ignore malformed non-OKF markdown files
        }
      }
    }
  };
  walkBundleConcepts(bundleDir);
  bundleConcepts.sort((a, b) => a.relativePath.localeCompare(b.relativePath));

  const runsDir = path.join(workspaceRoot, 'runs');
  const runs: Array<IcmRunPipelineStatus & { _sortMs: number }> = [];
  const filterRunId = options?.runId?.trim();

  if (fs.existsSync(runsDir)) {
    for (const entry of fs.readdirSync(runsDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const runName = entry.name;
      if (runName === '_dry_run' || runName.startsWith('.')) {
        continue;
      }
      if (filterRunId && runName !== filterRunId && !runName.includes(filterRunId)) {
        continue;
      }

      const runDir = path.join(runsDir, runName);
      let mtimeMs = 0;
      try {
        mtimeMs = fs.statSync(runDir).mtimeMs;
      } catch {
        mtimeMs = 0;
      }

      const metaPath = path.join(runDir, 'meta.json');
      let meta: Record<string, any> = {};
      if (fs.existsSync(metaPath)) {
        try {
          meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
        } catch {
          meta = {};
        }
      }

      const s1SummaryPath = path.join(
        runDir,
        'stages',
        '01_research',
        'output',
        'research_summary.md'
      );
      const s2DraftPath = path.join(runDir, 'stages', '02_script', 'output', 'script_draft.json');
      const a2uiHtmlPath = path.join(runDir, 'a2ui.html');
      const a2uiSurfacePath = path.join(runDir, 'a2ui_surface.json');

      const stage1Complete = fs.existsSync(s1SummaryPath);
      const stage2Complete = fs.existsSync(s2DraftPath);
      const hasA2uiArtifacts = fs.existsSync(a2uiHtmlPath) || fs.existsSync(a2uiSurfacePath);

      let okfStatus: string | undefined;
      let trustTier: TrustTier | undefined;
      let verifiedBy: string | undefined;
      let staleFlag: boolean | undefined;
      let sourcesCount = 0;
      let domainWarningCount = 0;
      let inferredTopic = String(meta.topic || '');

      if (stage1Complete) {
        try {
          const s1Doc = parseOkfDocument(fs.readFileSync(s1SummaryPath, 'utf-8'));
          const fm = s1Doc.frontmatter || {};
          okfStatus = String(fm.status || 'draft');
          trustTier = getOkfTrustTier(fm);
          const verifiedEvents = normalizeVerified(fm);
          verifiedBy = verifiedEvents[verifiedEvents.length - 1]?.by;
          staleFlag = isOkfStale(fm);
          const sources = Array.isArray(fm.sources) ? fm.sources : [];
          sourcesCount = sources.length;
          domainWarningCount = sources.filter(
            (s: any) => inspectSourceDomainProvenance(s).domainMismatch
          ).length;
          if (!inferredTopic && fm.title) {
            inferredTopic = String(fm.title);
          }
        } catch {
          okfStatus = meta?.okf?.status;
          trustTier = meta?.okf?.trust_tier;
          sourcesCount = Number(meta?.okf?.sourcesCount || 0);
        }
      }

      const stagesRoot = path.join(runDir, 'stages');
      const downstreamStages: IcmRunStageNodeStatus[] = [];
      if (fs.existsSync(stagesRoot)) {
        const stageEntries = fs
          .readdirSync(stagesRoot, { withFileTypes: true })
          .filter(
            (d) =>
              d.isDirectory() &&
              d.name !== '01_research' &&
              d.name !== '02_script' &&
              !d.name.startsWith('.')
          )
          .sort((a, b) => a.name.localeCompare(b.name));
        for (const st of stageEntries) {
          const outDir = path.join(stagesRoot, st.name, 'output');
          const outFiles = fs.existsSync(outDir)
            ? fs
                .readdirSync(outDir)
                .filter(
                  (f) =>
                    f !== 'thinking_trace.md' &&
                    f !== 'a2ui_surface.json' &&
                    f !== 'a2ui_surface.jsonl' &&
                    !/^voice_reference_/i.test(f) &&
                    !f.startsWith('.')
                )
            : [];
          downstreamStages.push({
            stageName: st.name,
            state: outFiles.length > 0 ? 'COMPLETE' : 'PENDING',
            outputFiles: outFiles,
          });
        }
      }

      const stage1State: 'COMPLETE' | 'PENDING' = stage1Complete ? 'COMPLETE' : 'PENDING';
      const isGateVerified =
        trustTier === 'human-reviewed' ||
        (okfStatus === 'stable' && trustTier === 'machine-confirmed');
      const okfGateState: 'VERIFIED' | 'AWAITING REVIEW' | 'PENDING' = !stage1Complete
        ? 'PENDING'
        : isGateVerified
          ? 'VERIFIED'
          : 'AWAITING REVIEW';
      const stage2State: 'COMPLETE' | 'PENDING' = stage2Complete ? 'COMPLETE' : 'PENDING';
      const a2uiState: 'READY' | 'INTERMISSION' | 'PENDING' =
        stage2Complete && hasA2uiArtifacts
          ? 'READY'
          : stage1Complete && hasA2uiArtifacts
            ? 'INTERMISSION'
            : 'PENDING';

      const stage1Tokens = Number(meta?.stage1Telemetry?.totalTokens || 0);
      const stage2Tokens = Number(meta?.stage2Telemetry?.totalTokens || 0);
      let downstreamTokens = 0;
      if (meta && typeof meta === 'object') {
        for (const [k, v] of Object.entries(meta)) {
          if (
            /^stage\d+Telemetry$/.test(k) &&
            k !== 'stage1Telemetry' &&
            k !== 'stage2Telemetry' &&
            v &&
            typeof v === 'object'
          ) {
            downstreamTokens += Number((v as Record<string, unknown>).totalTokens || 0);
          }
        }
      }
      const totalTokens = stage1Tokens + stage2Tokens + downstreamTokens;

      let nextStepHint: string;
      if (!stage1Complete) {
        nextStepHint = `Run Stage 1 grounded research: npm run cli:stage1 -- "<topic>"`;
      } else if (okfGateState === 'AWAITING REVIEW' && !stage2Complete) {
        nextStepHint =
          trustTier === 'machine-confirmed'
            ? `Pre-curated (${verifiedBy || 'machine-confirmed'}) — review workspace/runs/${runName}/a2ui.html & sign off: npm run cli:verify -- ${runName} --by "human:<reviewer>"`
            : `Review workspace/runs/${runName}/a2ui.html & verify sources: npm run cli:verify -- ${runName} --by "human:<reviewer>"`;
      } else if (!stage2Complete) {
        nextStepHint = `Run Stage 2 structured synthesis: npm run cli:stage2 -- ${runName}`;
      } else if (okfGateState === 'AWAITING REVIEW') {
        nextStepHint =
          trustTier === 'machine-confirmed'
            ? `Stage 2 complete on machine-curated draft — sign off Stage 1 sources: npm run cli:verify -- ${runName} --by "human:<reviewer>"`
            : `Stage 2 complete on unverified draft — verify Stage 1 sources: npm run cli:verify -- ${runName} --by "human:<reviewer>"`;
      } else if (!hasA2uiArtifacts) {
        nextStepHint = `Compile A2UI v1.0 Studio surface: npm run cli:a2ui -- ${runName}`;
      } else {
        nextStepHint = `Pipeline complete — open workspace/runs/${runName}/a2ui.html (or re-run Stage 2 via npm run cli:stage2 -- ${runName})`;
      }

      const rawStartedAt = meta.createdAt ?? meta.startedAt;
      const parsedStartMs = rawStartedAt ? Date.parse(String(rawStartedAt)) || mtimeMs : mtimeMs;
      runs.push({
        runId: runName,
        topic: inferredTopic || runName,
        startedAt: rawStartedAt ? String(rawStartedAt) : undefined,
        stage1State,
        okfGateState,
        stage2State,
        downstreamStages,
        a2uiState,
        okfStatus,
        trustTier,
        verifiedBy,
        isStale: staleFlag,
        sourcesCount,
        domainWarningCount,
        stage1Tokens,
        stage2Tokens,
        totalTokens,
        nextStepHint,
        _sortMs: parsedStartMs,
      });
    }
  }

  runs.sort((a, b) => b._sortMs - a._sortMs || b.runId.localeCompare(a.runId));
  const cleanRuns: IcmRunPipelineStatus[] = runs.map(({ _sortMs: _ignored, ...rest }) => rest);

  return {
    workspaceRoot,
    layers,
    bundle: {
      conceptCount: bundleConcepts.length,
      humanReviewedCount: bundleConcepts.filter((c) => c.trustTier === 'human-reviewed').length,
      machineConfirmedCount: bundleConcepts.filter((c) => c.trustTier === 'machine-confirmed')
        .length,
      unverifiedCount: bundleConcepts.filter((c) => c.trustTier === 'unverified').length,
      staleCount: bundleConcepts.filter((c) => c.isStale).length,
      hasVizHtml: fs.existsSync(path.join(bundleDir, 'viz.html')),
      hasA2uiHtml: fs.existsSync(path.join(bundleDir, 'a2ui.html')),
      concepts: bundleConcepts,
    },
    runs: cleanRuns,
  };
}

/**
 * Formats an `IcmPipelineStatusReport` as a clean ASCII pipeline & OKF v0.3 bundle dashboard.
 */
export function formatIcmPipelineStatus(report: IcmPipelineStatusReport): string {
  const lines: string[] = [];
  lines.push('=== Open Knowledge Studio — ICM · OKF v0.3 · A2UI v1.0 Pipeline Status ===');
  lines.push(`Workspace: ${report.workspaceRoot}`);
  lines.push(
    `Context Layers: Layer 0 GEMINI.md [${report.layers.globalIdentity ? 'OK' : 'MISSING'}] | Layer 1 CONTEXT.md [${report.layers.workspaceContext ? 'OK' : 'MISSING'}] | Layer 3 voice_guide.md [${report.layers.voiceGuide ? 'OK' : 'MISSING'}]`
  );
  const machineBundlePart =
    report.bundle.machineConfirmedCount > 0
      ? `, ${report.bundle.machineConfirmedCount} machine-confirmed`
      : '';
  lines.push(
    `OKF v0.3 Bundle: ${report.bundle.conceptCount} concept(s) (${report.bundle.humanReviewedCount} human-reviewed${machineBundlePart}, ${report.bundle.unverifiedCount} unverified, ${report.bundle.staleCount} stale) | viz.html [${report.bundle.hasVizHtml ? 'READY' : 'NONE'}] | a2ui.html [${report.bundle.hasA2uiHtml ? 'READY' : 'NONE'}]`
  );
  for (const c of report.bundle.concepts) {
    lines.push(
      `  • ${c.relativePath} — "${c.title}" [${c.type} | status=${c.status} | trust=${c.trustTier}${c.verifiedBy ? ` (${c.verifiedBy})` : ''}${c.isStale ? ' | STALE' : ''} | ${c.sourcesCount} sources]`
    );
  }
  lines.push('');

  if (report.runs.length === 0) {
    lines.push('Pipeline Runs: 0 active runs in workspace/runs/');
    lines.push('  Flow: [01_research: PENDING] ---> [OKF Gate: PENDING] ---> [02_script: PENDING] ---> [A2UI v1.0: PENDING]');
    lines.push('  Next: Preview Stage 1 at zero token cost via `npm run cli:stage1 -- --dry-run "<topic>"`');
    return lines.join('\n');
  }

  lines.push(`Pipeline Runs (${report.runs.length}):`);
  for (const r of report.runs) {
    const extraStagesFlow = r.downstreamStages
      .map((ds) => ` ---> [${ds.stageName}: ${ds.state}]`)
      .join('');
    const okfGateLabel =
      r.okfGateState === 'AWAITING REVIEW' && r.trustTier === 'machine-confirmed'
        ? 'AWAITING REVIEW (machine-curated)'
        : r.okfGateState;
    const flowLine = `[01_research: ${r.stage1State}] ---> [OKF Gate: ${okfGateLabel}] ---> [02_script: ${r.stage2State}]${extraStagesFlow} ---> [A2UI v1.0: ${r.a2uiState}]`;
    lines.push(`  Run: ${r.runId}`);
    lines.push(`    Topic:    ${r.topic}`);
    lines.push(`    Flow:     ${flowLine}`);
    if (r.stage1State === 'COMPLETE') {
      lines.push(
        `    OKF v0.3: status=${r.okfStatus || 'draft'} | trust=${r.trustTier || 'unverified'}${r.verifiedBy ? ` (${r.verifiedBy})` : ''} | sources=${r.sourcesCount} (${r.domainWarningCount} domain warning${r.domainWarningCount === 1 ? '' : 's'}) | stale=${Boolean(r.isStale)}`
      );
    }
    if (r.totalTokens > 0) {
      const downstreamToks = Math.max(0, r.totalTokens - r.stage1Tokens - r.stage2Tokens);
      const downstreamPart =
        downstreamToks > 0 ? ` | Downstream: ${downstreamToks.toLocaleString('en-US')}` : '';
      lines.push(
        `    Tokens:   ${r.totalTokens.toLocaleString('en-US')} total (Stage 1: ${r.stage1Tokens.toLocaleString('en-US')} | Stage 2: ${r.stage2Tokens.toLocaleString('en-US')}${downstreamPart})`
      );
    }
    lines.push(`    Next:     ${r.nextStepHint}`);
  }
  return lines.join('\n');
}
