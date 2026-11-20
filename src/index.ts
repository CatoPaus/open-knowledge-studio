import * as fs from 'fs';
import * as path from 'path';

import { GEMINI_4_ARGON_MODEL } from './interactions/index.js';
import { inferSourceMimeTypeFromUrl, normalizeCanonicalSourceUrl, regenerateBundleIndexes, resolveRedirect, transliterateNordicAscii, truncateSlugAtWordBoundary, validateOkfBundle } from './okf/index.js';
import { generateBundleVisualization } from './viz/index.js';
import { closeActiveA2uiPingPongListener, generateA2uiSurface, openFileInSystemBrowser, startA2uiPingPongListener } from './a2ui/index.js';
import { checkUpstreamSpecs, formatIcmPipelineStatus, getIcmPipelineStatus, initOksWorkspace } from './ops/index.js';
import { runStage1Flow, runStage2Flow, runStage3Flow, runStage4Flow, verifyOkfConcept } from './pipeline/index.js';

export * from './interactions/index.js';
export * from './okf/index.js';
export * from './viz/index.js';
export * from './a2ui/index.js';
export * from './ops/index.js';
export * from './pipeline/index.js';

/**
 * Runs the zero-token, zero-network ICM + OKF v0.3 + A2UI v1.0 self-test suite (including `tsc --noEmit`).
 * Lazy-loaded so normal CLI invocations (`cli:status`, `cli:stage1`, etc.) never parse test fixtures.
 */
export async function runIcmSelfTests(): Promise<{ passed: number }> {
  const { runIcmSelfTests: runSuite } = await import('./tests/self-tests.js');
  return runSuite();
}

// 4. Headless CLI Entrypoint (Linux / macOS / Windows / SSH / Cron / Terminal execution)
if (
  process.argv.includes('--test') ||
  process.argv.includes('--spec-check') ||
  process.argv.includes('--status') ||
  process.argv.includes('--validate-bundle') ||
  process.argv.includes('--init') ||
  process.argv.includes('--cli') ||
  process.argv.includes('--stage1') ||
  process.argv.includes('--stage2') ||
  process.argv.includes('--stage3') ||
  process.argv.includes('--stage4') ||
  process.argv.includes('--verify') ||
  process.argv.includes('--viz') ||
  process.argv.includes('--a2ui') ||
  process.argv.includes('--ping-pong')
) {
  (async () => {
    if (process.argv.includes('--test')) {
      await runIcmSelfTests();
      return;
    }

    if (process.argv.includes('--init')) {
      const initIdx = process.argv.indexOf('--init');
      const overwrite = process.argv.includes('--overwrite');
      const targetArg = process.argv
        .slice(initIdx + 1)
        .find((a) => !a.startsWith('--'));
      const res = initOksWorkspace(targetArg || process.cwd(), { overwrite });
      console.log(
        `[Open Knowledge Studio Init]: Initialized ${res.targetDir} (${res.createdFiles.length} created, ${res.skippedFiles.length} kept existing)`
      );
      return;
    }

    if (process.argv.includes('--validate-bundle')) {
      const valIdx = process.argv.indexOf('--validate-bundle');
      const strict = process.argv.includes('--strict');
      const targetArg = process.argv
        .slice(valIdx + 1)
        .find((a) => !a.startsWith('--'));
      const report = validateOkfBundle(targetArg || './workspace/bundle', { strict });
      if (process.argv.includes('--json')) {
        console.log(JSON.stringify(report, null, 2));
      } else {
        for (const f of report.findings) {
          const loc = f.line ? `${f.path}:${f.line}` : f.path;
          console.log(`${loc}: ${f.level} ${f.code} ${f.message}`);
        }
        const verdict = report.conformant ? 'conformant' : 'not conformant';
        console.log(
          `${report.files_checked} files checked: ${report.errors} errors, ${report.warnings} warnings, ${report.info} info. The bundle is ${verdict}.`
        );
      }
      if (!report.passed) {
        process.exit(1);
      }
      return;
    }

    if (process.argv.includes('--spec-check')) {
      const specStatus = await checkUpstreamSpecs();
      console.log('[Upstream 3-Pillar Spec Check (ICM · OKF · A2UI)]:', specStatus);
      return;
    }

    if (process.argv.includes('--status')) {
      const statusIdx = process.argv.indexOf('--status');
      const wsFlagIdx = process.argv.indexOf('--workspace');
      const customWs =
        wsFlagIdx !== -1 &&
        process.argv[wsFlagIdx + 1] &&
        !process.argv[wsFlagIdx + 1].startsWith('--')
          ? process.argv[wsFlagIdx + 1]
          : './workspace';
      const rawTail = process.argv.slice(statusIdx + 1);
      const positional: string[] = [];
      for (let i = 0; i < rawTail.length; i++) {
        if (rawTail[i] === '--workspace') {
          i++;
          continue;
        }
        if (rawTail[i].startsWith('--')) continue;
        positional.push(rawTail[i]);
      }
      const statusReport = getIcmPipelineStatus({
        workspaceRoot: customWs,
        runId: positional[0],
      });
      if (process.argv.includes('--json')) {
        console.log(JSON.stringify(statusReport, null, 2));
      } else {
        console.log(formatIcmPipelineStatus(statusReport));
      }
      return;
    }

    const isStage1Only = process.argv.includes('--stage1');
    const isStage2Only = process.argv.includes('--stage2');
    const isStage3Only = process.argv.includes('--stage3');
    const isStage4Only = process.argv.includes('--stage4');
    const isFullCli = process.argv.includes('--cli');
    const hasVerify = process.argv.includes('--verify');
    const hasViz = process.argv.includes('--viz');
    const hasA2ui = process.argv.includes('--a2ui');
    const hasPingPong = process.argv.includes('--ping-pong');
    const isDryRun = process.argv.includes('--dry-run');
    const hasOpen = process.argv.includes('--open');

    const artifactDirFlagIdx = process.argv.indexOf('--artifact-dir');
    if (
      artifactDirFlagIdx !== -1 &&
      process.argv[artifactDirFlagIdx + 1] &&
      !process.argv[artifactDirFlagIdx + 1].startsWith('--')
    ) {
      process.env.AGY_ARTIFACT_DIR = process.argv[artifactDirFlagIdx + 1];
    }

    // Standalone `--ping-pong` listener for Antigravity 2.0 Reactive Wakeup
    if (
      hasPingPong &&
      !isStage1Only &&
      !isStage2Only &&
      !isStage3Only &&
      !isStage4Only &&
      !isFullCli &&
      !hasVerify &&
      !hasA2ui &&
      !hasViz
    ) {
      const ppIdx = process.argv.indexOf('--ping-pong');
      const ppArgs = process.argv
        .slice(ppIdx + 1)
        .filter((a) => !a.startsWith('--'));
      const targetRunId = ppArgs[0];
      await startA2uiPingPongListener({
        workspaceRoot: './workspace',
        runId: targetRunId,
      });
      return;
    }

    const extractCliByTokens = (
      argv: string[],
      byIdx: number
    ): { value?: string; count: number } => {
      if (byIdx === -1 || byIdx + 1 >= argv.length || argv[byIdx + 1].startsWith('--')) {
        return { value: undefined, count: 0 };
      }
      const tokens: string[] = [argv[byIdx + 1]];
      let k = byIdx + 2;
      while (k < argv.length) {
        const tok = argv[k];
        if (tok.startsWith('--')) break;
        if (/\d{10,}$|[\/\\]|\.md$/i.test(tok)) break;
        tokens.push(tok);
        k++;
      }
      return { value: tokens.join(' ').trim(), count: tokens.length };
    };

    const byFlagIdx = process.argv.indexOf('--by');
    const byParsed = extractCliByTokens(process.argv, byFlagIdx);
    const verifierBy = byParsed.value;

    // Standalone `--a2ui` execution
    if (hasA2ui && !isStage1Only && !isStage2Only && !isStage3Only && !isStage4Only && !isFullCli && !hasVerify) {
      const a2uiIdx = process.argv.indexOf('--a2ui');
      const rawA2uiTail = process.argv.slice(a2uiIdx + 1);
      const a2uiArgs: string[] = [];
      for (let i = 0; i < rawA2uiTail.length; i++) {
        if (rawA2uiTail[i] === '--artifact-dir') {
          i++;
          continue;
        }
        if (rawA2uiTail[i].startsWith('--')) continue;
        a2uiArgs.push(rawA2uiTail[i]);
      }
      const targetRunOrPath = a2uiArgs[0];
      const customHtmlOut = a2uiArgs[1];
      const a2uiResult = generateA2uiSurface({
        workspaceRoot: './workspace',
        runId: targetRunOrPath,
        outputHtmlPath: customHtmlOut,
        openBrowser: hasOpen,
      });
      console.log('A2UI v1.0 Surface & Studio Generated:', {
        runId: a2uiResult.runId,
        surfaceId: a2uiResult.surfaceId,
        componentCount: a2uiResult.componentCount,
        tabCount: a2uiResult.tabCount,
        checklistItemCount: a2uiResult.checklistItemCount,
        moduleCount: a2uiResult.moduleCount,
        quizCount: a2uiResult.quizCount,
        caseCount: a2uiResult.caseCount,
        surfaceJsonPath: a2uiResult.surfaceJsonPath,
        surfaceJsonlPath: a2uiResult.surfaceJsonlPath,
        htmlOutputPath: a2uiResult.htmlOutputPath,
        bundleHtmlPath: a2uiResult.bundleHtmlPath,
        bundleVizPath: a2uiResult.bundleVizPath,
        artifactHtmlPath: a2uiResult.artifactHtmlPath,
        artifactVizPath: a2uiResult.artifactVizPath,
        browserOpened: a2uiResult.browserOpened,
      });
      return;
    }

    // Standalone `--viz` execution
    if (hasViz && !isStage1Only && !isStage2Only && !isStage3Only && !isStage4Only && !isFullCli && !hasVerify) {
      const vizIdx = process.argv.indexOf('--viz');
      const rawVizTail = process.argv.slice(vizIdx + 1);
      const vizArgs: string[] = [];
      for (let i = 0; i < rawVizTail.length; i++) {
        if (rawVizTail[i] === '--artifact-dir') {
          i++;
          continue;
        }
        if (rawVizTail[i].startsWith('--')) continue;
        vizArgs.push(rawVizTail[i]);
      }
      const bundleDir = vizArgs[0] || './workspace/bundle';
      const outPath = vizArgs[1] || path.join(bundleDir, 'viz.html');
      regenerateBundleIndexes(bundleDir);
      const vizResult = generateBundleVisualization(bundleDir, outPath);
      if (hasOpen) {
        openFileInSystemBrowser(vizResult.outputPath);
      }
      console.log('OKF Bundle Visualization Generated:', vizResult);
      return;
    }

    // Standalone `--stage3` (`03_visuals`) and `--stage4` (`04_audio`) multimodal execution
    if (isStage3Only || isStage4Only) {
      const mmFlag = isStage3Only ? '--stage3' : '--stage4';
      const mmIdx = process.argv.indexOf(mmFlag);
      const rawMmTail = process.argv.slice(mmIdx + 1);
      const mmPositional: string[] = [];
      let concurrencyOverride: number | undefined;
      for (let i = 0; i < rawMmTail.length; i++) {
        const tok = rawMmTail[i];
        if (tok === '--artifact-dir') {
          i++;
          continue;
        }
        if (tok === '--concurrency' && rawMmTail[i + 1] && !rawMmTail[i + 1].startsWith('--')) {
          const parsedConc = parseInt(rawMmTail[i + 1], 10);
          if (Number.isFinite(parsedConc) && parsedConc > 0) concurrencyOverride = parsedConc;
          i++;
          continue;
        }
        if (tok.startsWith('--')) continue;
        mmPositional.push(tok);
      }
      const targetRunId = mmPositional[0]?.trim() || undefined;
      if (isStage3Only) {
        const stage3Result = await runStage3Flow({
          workspaceRoot: './workspace',
          runId: targetRunId,
          concurrency: concurrencyOverride,
          dryRun: isDryRun,
          artifactDir: process.env.AGY_ARTIFACT_DIR || undefined,
          openBrowser: hasOpen,
        });
        console.log(
          `Stage 3 Visuals CLI ${isDryRun ? 'Dry-Run ' : 'Run '}Complete (${stage3Result.runId}):`,
          {
            runId: stage3Result.runId,
            outputDir: stage3Result.outputDir,
            manifestPath: stage3Result.manifestPath,
            imageCount: stage3Result.items.length,
            totalTokens: stage3Result.usage.totalTokens,
            a2uiHtmlPath: stage3Result.a2uiHtmlPath,
            artifactHtmlPath: stage3Result.artifactHtmlPath,
            dryRun: stage3Result.dryRun || false,
          }
        );
      } else {
        const stage4Result = await runStage4Flow({
          workspaceRoot: './workspace',
          runId: targetRunId,
          concurrency: concurrencyOverride,
          dryRun: isDryRun,
          artifactDir: process.env.AGY_ARTIFACT_DIR || undefined,
          openBrowser: hasOpen,
        });
        console.log(
          `Stage 4 Audio CLI ${isDryRun ? 'Dry-Run ' : 'Run '}Complete (${stage4Result.runId}):`,
          {
            runId: stage4Result.runId,
            outputDir: stage4Result.outputDir,
            manifestPath: stage4Result.manifestPath,
            trackCount: stage4Result.items.length,
            ...(stage4Result.totalDurationSeconds !== undefined
              ? { totalDurationSeconds: stage4Result.totalDurationSeconds }
              : {}),
            totalTokens: stage4Result.usage.totalTokens,
            a2uiHtmlPath: stage4Result.a2uiHtmlPath,
            artifactHtmlPath: stage4Result.artifactHtmlPath,
            dryRun: stage4Result.dryRun || false,
          }
        );
      }
      return;
    }

    const rejectSourceIdsCli: string[] = [];
    const replaceSourceMapCli: Record<string, string> = {};
    const rawAddSourceSpecsCli: string[] = [];
    const resolveMapCli: Record<string, string> = {};
    const deferIdsCli: string[] = [];
    const noteMapCli: Record<string, string> = {};
    for (let i = 0; i < process.argv.length; i++) {
      if (process.argv[i] === '--reject-source' && process.argv[i + 1]) {
        const parts = process.argv[i + 1]
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
        rejectSourceIdsCli.push(...parts);
        i++;
      } else if (process.argv[i] === '--replace-source' && process.argv[i + 1]) {
        const pairs = process.argv[i + 1]
          .split(/,\s*(?=[A-Za-z0-9_\-\[\]\^]+\s*=)/)
          .map((s) => s.trim())
          .filter(Boolean);
        for (const pair of pairs) {
          const eqIdx = pair.indexOf('=');
          if (eqIdx > 0) {
            const oldKey = pair
              .slice(0, eqIdx)
              .trim()
              .replace(/^\[\^/, '')
              .replace(/\]$/, '')
              .trim();
            const newTarget = pair
              .slice(eqIdx + 1)
              .trim()
              .replace(/^\[\^/, '')
              .replace(/\]$/, '')
              .trim();
            if (oldKey && newTarget) {
              replaceSourceMapCli[oldKey] = newTarget;
            }
          }
        }
        i++;
      } else if (process.argv[i] === '--add-source' && process.argv[i + 1]) {
        const specs = process.argv[i + 1]
          .split(';')
          .map((s) => s.trim())
          .filter(Boolean);
        rawAddSourceSpecsCli.push(...specs);
        i++;
      } else if (process.argv[i] === '--resolve' && process.argv[i + 1]) {
        const rawSpec = String(process.argv[i + 1]).trim();
        const eqIdx = rawSpec.indexOf('=');
        if (eqIdx > 0) {
          const itemKey = rawSpec.slice(0, eqIdx).trim();
          const itemVal = rawSpec.slice(eqIdx + 1).trim();
          if (itemKey && itemVal.length > 0) {
            resolveMapCli[itemKey] = itemVal;
          }
        }
        i++;
      } else if (process.argv[i] === '--defer' && process.argv[i + 1]) {
        const parts = process.argv[i + 1]
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
        for (const p of parts) {
          if (!deferIdsCli.includes(p)) {
            deferIdsCli.push(p);
          }
        }
        i++;
      } else if (process.argv[i] === '--note' && process.argv[i + 1]) {
        const rawSpec = String(process.argv[i + 1]).trim();
        const eqIdx = rawSpec.indexOf('=');
        if (eqIdx > 0) {
          const itemKey = rawSpec.slice(0, eqIdx).trim();
          const itemNote = rawSpec.slice(eqIdx + 1).trim();
          if (itemKey && itemNote.length > 0) {
            noteMapCli[itemKey] = itemNote;
          }
        }
        i++;
      }
    }

    type CliResolvedSourceItem = {
      url: string;
      title?: string;
      id?: string;
      mimeType?: string;
      mime_type?: string;
      lastModified?: string;
      last_modified?: string;
    };

    const resolveCliAddedSources = async (
      specs: string[]
    ): Promise<CliResolvedSourceItem[]> => {
      const resolvedList: CliResolvedSourceItem[] = [];
      for (const rawSpec of specs) {
        let customId: string | undefined;
        let spec = rawSpec.trim();
        const idPrefixMatch = spec.match(/^id=([A-Za-z0-9_\-]+)\|([\s\S]+)$/i);
        if (idPrefixMatch) {
          customId = idPrefixMatch[1].trim();
          spec = idPrefixMatch[2].trim();
        }
        const pipeIdx = spec.indexOf('|');
        const rawUrl = (pipeIdx !== -1 ? spec.slice(0, pipeIdx) : spec).trim();
        const explicitTitle = pipeIdx !== -1 ? spec.slice(pipeIdx + 1).trim() : '';
        if (!rawUrl) continue;
        let finalUrl = rawUrl;
        let lastModified: string | undefined;
        let fetchedTitle: string | undefined;
        let mimeType: string | undefined;
        if (/^https?:\/\//i.test(rawUrl)) {
          try {
            const info = await resolveRedirect(rawUrl);
            if (info.url) finalUrl = info.url;
            if (info.lastModified) lastModified = info.lastModified;
            if (info.pageTitle) fetchedTitle = info.pageTitle;
            if (info.mimeType) mimeType = info.mimeType;
          } catch {
            // Non-fatal if offline
          }
        }
        if (!mimeType) {
          mimeType = inferSourceMimeTypeFromUrl(finalUrl);
        }
        resolvedList.push({
          url: finalUrl,
          title: explicitTitle || fetchedTitle || undefined,
          ...(customId ? { id: customId } : {}),
          ...(mimeType ? { mimeType, mime_type: mimeType } : {}),
          ...(lastModified ? { lastModified, last_modified: lastModified } : {}),
        });
      }
      return resolvedList;
    };

    const resolveCliCurationInputs = async (): Promise<{
      addSourcesResolved: CliResolvedSourceItem[];
      normalizedReplaceSourceMap: Record<string, string>;
    }> => {
      const addSourcesResolved = await resolveCliAddedSources(rawAddSourceSpecsCli);
      const seenCanonUrls = new Set<string>(
        addSourcesResolved
          .map((item) => normalizeCanonicalSourceUrl(item.url) || item.url)
          .filter(Boolean)
      );
      const normalizedReplaceSourceMap: Record<string, string> = { ...replaceSourceMapCli };
      for (const [, resVal] of Object.entries(resolveMapCli)) {
        const replUrlMatch = resVal.match(
          /^replace:([A-Za-z0-9_\-\[\]\^]+)=((?:id=[A-Za-z0-9_\-]+\|)?https?:\/\/.+)$/i
        );
        if (replUrlMatch) {
          const cleanOld = replUrlMatch[1]
            .trim()
            .replace(/^\[\^/, '')
            .replace(/\]$/, '')
            .trim();
          const rawUrlTarget = replUrlMatch[2].trim();
          if (
            cleanOld &&
            rawUrlTarget &&
            !Object.prototype.hasOwnProperty.call(normalizedReplaceSourceMap, cleanOld)
          ) {
            normalizedReplaceSourceMap[cleanOld] = rawUrlTarget;
          }
        }
      }
      for (const [oldKey, rawTarget] of Object.entries({ ...normalizedReplaceSourceMap })) {
        if (/^(?:id=[A-Za-z0-9_\-]+\|)?https?:\/\//i.test(rawTarget)) {
          const [resolvedItem] = await resolveCliAddedSources([rawTarget]);
          if (resolvedItem && resolvedItem.url) {
            const canon = normalizeCanonicalSourceUrl(resolvedItem.url) || resolvedItem.url;
            if (!seenCanonUrls.has(canon)) {
              addSourcesResolved.push(resolvedItem);
              seenCanonUrls.add(canon);
            }
            normalizedReplaceSourceMap[oldKey] = resolvedItem.id || resolvedItem.url;
          }
        }
      }
      return { addSourcesResolved, normalizedReplaceSourceMap };
    };

    // Standalone `--verify` execution
    if (hasVerify && !isStage1Only && !isStage2Only && !isFullCli) {
      const verifyIdx = process.argv.indexOf('--verify');
      const rawArgs = process.argv.slice(verifyIdx + 1);
      const filteredArgs: string[] = [];
      for (let i = 0; i < rawArgs.length; i++) {
        if (rawArgs[i] === '--by') {
          i += Math.max(1, extractCliByTokens(rawArgs, i).count);
          continue;
        }
        if (
          rawArgs[i] === '--reject-source' ||
          rawArgs[i] === '--replace-source' ||
          rawArgs[i] === '--add-source' ||
          rawArgs[i] === '--resolve' ||
          rawArgs[i] === '--defer' ||
          rawArgs[i] === '--note' ||
          rawArgs[i] === '--artifact-dir'
        ) {
          i++;
          continue;
        }
        if (rawArgs[i].startsWith('--')) continue;
        filteredArgs.push(rawArgs[i]);
      }
      const target = filteredArgs[0];
      if (!target) {
        console.error(
          'Usage: npm run cli:verify -- <runIdOrConceptPath> [--reject-source id1,id2] [--replace-source oldId=newIdOrUrl] [--add-source "<url>[|<title>]"] [--resolve id=val] [--defer id] [--note id=text] [--by human:<reviewer>] [--open] [--artifact-dir <dir>]'
        );
        process.exit(1);
      }
      const { addSourcesResolved, normalizedReplaceSourceMap } = await resolveCliCurationInputs();
      const verifyResult = verifyOkfConcept(target, {
        workspaceRoot: './workspace',
        artifactDir: process.env.AGY_ARTIFACT_DIR || undefined,
        by: verifierBy,
        rejectSourceIds: rejectSourceIdsCli,
        replaceSourceMap: normalizedReplaceSourceMap,
        addSources: addSourcesResolved,
        resolveMap: resolveMapCli,
        deferIds: deferIdsCli,
        noteMap: noteMapCli,
      });
      if (hasViz && !verifyResult.vizOutputPath) {
        const vizResult = generateBundleVisualization('./workspace/bundle');
        console.log('OKF Bundle Visualization Generated:', vizResult);
      }
      if (hasA2ui && !verifyResult.a2uiOutputPath) {
        const a2uiResult = generateA2uiSurface({
          workspaceRoot: './workspace',
          runId: target,
          openBrowser: hasOpen,
        });
        console.log('A2UI v1.0 Surface Generated:', a2uiResult.htmlOutputPath);
      } else if (hasOpen && verifyResult.a2uiOutputPath) {
        openFileInSystemBrowser(verifyResult.a2uiOutputPath);
      }
      if (verifyResult.status === 'stable') {
        await closeActiveA2uiPingPongListener({
          reason: 'verified',
          workspaceRoot: './workspace',
          runId: verifyResult.runId || target,
        });
      }
      console.log('OKF Verification Complete:', verifyResult);
      return;
    }

    const flag = isStage2Only ? '--stage2' : isStage1Only ? '--stage1' : '--cli';
    const flagIndex = process.argv.indexOf(flag);
    const tailArgs = process.argv.slice(flagIndex + 1);
    const cleanedPositional: string[] = [];
    for (let i = 0; i < tailArgs.length; i++) {
      const token = tailArgs[i];
      if (token === '--by') {
        i += Math.max(1, extractCliByTokens(tailArgs, i).count);
        continue;
      }
      if (
        token === '--reject-source' ||
        token === '--replace-source' ||
        token === '--add-source' ||
        token === '--resolve' ||
        token === '--defer' ||
        token === '--note' ||
        token === '--artifact-dir'
      ) {
        i++;
        continue;
      }
      if (
        token === '--dry-run' ||
        token === '--verify' ||
        token === '--viz' ||
        token === '--a2ui' ||
        token === '--open'
      ) {
        continue;
      }
      cleanedPositional.push(token);
    }
    const argValue = cleanedPositional.join(' ').trim();

    if (!argValue) {
      console.error(
        isStage2Only
          ? 'Usage: npm run cli:stage2 -- [--dry-run] [--verify] [--by human:<id>] [--a2ui] [--open] [--artifact-dir <dir>] <runId>'
          : isStage1Only
            ? 'Usage: npm run cli:stage1 -- [--dry-run] [--viz] [--a2ui] [--open] [--artifact-dir <dir>] "<Research Topic>"'
            : 'Usage: npm run cli -- [--dry-run] [--verify] [--viz] [--a2ui] [--open] [--artifact-dir <dir>] "<Research Topic>"'
      );
      process.exit(1);
    }

    if (isStage2Only) {
      if (hasVerify) {
        const { addSourcesResolved, normalizedReplaceSourceMap } = await resolveCliCurationInputs();
        verifyOkfConcept(argValue, {
          workspaceRoot: './workspace',
          artifactDir: process.env.AGY_ARTIFACT_DIR || undefined,
          by: verifierBy,
          rejectSourceIds: rejectSourceIdsCli,
          replaceSourceMap: normalizedReplaceSourceMap,
          addSources: addSourcesResolved,
          resolveMap: resolveMapCli,
          deferIds: deferIdsCli,
          noteMap: noteMapCli,
        });
      }
      const runDir = path.resolve('./workspace/runs', argValue);
      const result = await runStage2Flow({
        workspaceRoot: './workspace',
        runId: argValue,
        thinkingLevel: 'MEDIUM',
        dryRun: isDryRun,
      });
      if (!isDryRun) {
        const metaPath = path.join(runDir, 'meta.json');
        if (fs.existsSync(metaPath)) {
          const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
          meta.status = 'completed';
          fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2), 'utf-8');
        }
      }
      if (hasViz) {
        const vizResult = generateBundleVisualization('./workspace/bundle');
        console.log('OKF Bundle Visualization Generated:', vizResult);
      }
      if (hasA2ui && !isDryRun) {
        const a2uiResult = generateA2uiSurface({ workspaceRoot: './workspace', runId: argValue });
        console.log('A2UI v1.0 Surface Generated:', a2uiResult.htmlOutputPath);
      }
      console.log('Stage 2 CLI Run Complete:', result);
    } else {
      const slug = truncateSlugAtWordBoundary(
        transliterateNordicAscii(argValue)
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, ''),
        32
      );
      const runId = isDryRun ? '_dry_run' : `${slug || 'run'}-${Date.now()}`;
      if (!isDryRun) {
        const { getApiKey } = await import('./interactions/index.js');
        getApiKey();
      }
      const runDir = path.resolve('./workspace/runs', runId);
      fs.mkdirSync(runDir, { recursive: true });
      if (!isDryRun) {
        fs.writeFileSync(
          path.join(runDir, 'meta.json'),
          JSON.stringify(
            {
              runId,
              topic: argValue,
              model: GEMINI_4_ARGON_MODEL,
              researchThinkingLevel: 'HIGH',
              scriptThinkingLevel: 'MEDIUM',
              createdAt: new Date().toISOString(),
              status: 'running',
            },
            null,
            2
          ),
          'utf-8'
        );
      }

      if (isStage1Only || isDryRun) {
        console.log(
          `Starting headless ${isDryRun ? 'DRY-RUN ' : ''}Stage 1 ICM run: ${runId}`
        );
        const result = await runStage1Flow({
          workspaceRoot: './workspace',
          runId,
          topic: argValue,
          thinkingLevel: 'HIGH',
          dryRun: isDryRun,
        });
        if (!isDryRun) {
          const metaPath = path.join(runDir, 'meta.json');
          if (fs.existsSync(metaPath)) {
            const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
            meta.status = 'stage1_completed';
            fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2), 'utf-8');
          }
          if (hasVerify) {
            const { addSourcesResolved, normalizedReplaceSourceMap } = await resolveCliCurationInputs();
            verifyOkfConcept(runId, {
              workspaceRoot: './workspace',
              artifactDir: process.env.AGY_ARTIFACT_DIR || undefined,
              by: verifierBy,
              rejectSourceIds: rejectSourceIdsCli,
              replaceSourceMap: normalizedReplaceSourceMap,
              addSources: addSourcesResolved,
              resolveMap: resolveMapCli,
              deferIds: deferIdsCli,
              noteMap: noteMapCli,
            });
          }
        }
        if (hasViz) {
          const vizResult = generateBundleVisualization('./workspace/bundle');
          console.log('OKF Bundle Visualization Generated:', vizResult);
        }
        if (hasA2ui && !isDryRun) {
          const a2uiResult = generateA2uiSurface({ workspaceRoot: './workspace', runId });
          console.log('A2UI v1.0 Surface Generated:', a2uiResult.htmlOutputPath);
        }
        console.log(
          `Stage 1 CLI ${isDryRun ? 'Dry-Run ' : 'Run '}Complete (${runId}):`,
          result
        );
      } else {
        console.log(`Starting headless full ICM run: ${runId}`);
        await runStage1Flow({
          workspaceRoot: './workspace',
          runId,
          topic: argValue,
          thinkingLevel: 'HIGH',
        });
        if (hasVerify) {
          const { addSourcesResolved, normalizedReplaceSourceMap } = await resolveCliCurationInputs();
          verifyOkfConcept(runId, {
            workspaceRoot: './workspace',
            artifactDir: process.env.AGY_ARTIFACT_DIR || undefined,
            by: verifierBy,
            rejectSourceIds: rejectSourceIdsCli,
            replaceSourceMap: normalizedReplaceSourceMap,
            addSources: addSourcesResolved,
            resolveMap: resolveMapCli,
            deferIds: deferIdsCli,
            noteMap: noteMapCli,
          });
        }
        const stage2Result = await runStage2Flow({
          workspaceRoot: './workspace',
          runId,
          thinkingLevel: 'MEDIUM',
        });
        const metaPath = path.join(runDir, 'meta.json');
        if (fs.existsSync(metaPath)) {
          const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
          meta.status = 'completed';
          fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2), 'utf-8');
        }
        if (hasViz) {
          const vizResult = generateBundleVisualization('./workspace/bundle');
          console.log('OKF Bundle Visualization Generated:', vizResult);
        }
        if (hasA2ui) {
          const a2uiResult = generateA2uiSurface({ workspaceRoot: './workspace', runId });
          console.log('A2UI v1.0 Surface Generated:', a2uiResult.htmlOutputPath);
        }
        console.log(`Headless ICM Run Complete (${runId}):`, {
          status: 'Pipeline executed successfully',
          outputPath: stage2Result.outputPath,
          trust_tier: stage2Result.trust_tier,
          is_stale: stage2Result.is_stale,
        });
      }
    }
  })().catch((err) => {
    console.error('Headless CLI execution failed:', err);
    process.exit(1);
  });
}
