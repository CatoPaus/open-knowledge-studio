#!/usr/bin/env node
/**
 * Open Knowledge Studio — Dual-Mode Plugin & MCP E2E Self-Test Suite
 * Kept outside `src/tests/self-tests.ts` so `feat/antigravity-plugin` never
 * collides with new unit tests appended at EOF on `main`.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { execFileSync } from 'node:child_process';
import { registerHooks } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (
      (specifier.startsWith('./') || specifier.startsWith('../')) &&
      specifier.endsWith('.js') &&
      context.parentURL
    ) {
      const parentPath = fileURLToPath(context.parentURL);
      const candidateTs = path.resolve(path.dirname(parentPath), specifier.slice(0, -3) + '.ts');
      if (fs.existsSync(candidateTs)) {
        return nextResolve(pathToFileURL(candidateTs).href, context);
      }
    }
    return nextResolve(specifier, context);
  },
});

const repoRoot = fileURLToPath(new URL('..', import.meta.url));

function assert(cond, msg) {
  if (!cond) {
    throw new Error(`[Plugin Self-Test Failed]: ${msg}`);
  }
}

const agyPluginJson = JSON.parse(
  fs.readFileSync(path.join(repoRoot, '.antigravity-plugin', 'plugin.json'), 'utf-8')
);
const mcpConfigJson = JSON.parse(
  fs.readFileSync(path.join(repoRoot, 'mcp_config.json'), 'utf-8')
);
const skill1Size = fs.statSync(path.join(repoRoot, 'skills', 'icm-co-architect', 'SKILL.md')).size;
const skill2Size = fs.statSync(path.join(repoRoot, 'skills', 'okf-bundle', 'SKILL.md')).size;
const pluginRuleSize = fs.statSync(path.join(repoRoot, 'rules', 'AGENTS.md')).size;
const wsRuleSize = fs.statSync(path.join(repoRoot, '.agents', 'rules', 'icm-co-architect.md')).size;

assert(
  agyPluginJson.name === 'open-knowledge-studio' &&
    agyPluginJson.logo === 'assets/logo.svg' &&
    fs.existsSync(path.join(repoRoot, 'assets', 'logo.svg')) &&
    Boolean(mcpConfigJson?.mcpServers?.['open-knowledge-studio']) &&
    !('type' in mcpConfigJson.mcpServers['open-knowledge-studio']) &&
    skill1Size < 24000 &&
    skill2Size < 24000 &&
    pluginRuleSize < 24000 &&
    wsRuleSize < 24000,
  `Plugin manifests (.antigravity-plugin/plugin.json, mcp_config.json, assets/logo.svg) are valid and all SKILL.md / rule files stay below Antigravity's 24,000-byte loader cap`
);

const tmpPluginProj = fs.mkdtempSync(path.join(os.tmpdir(), 'oks-plugin-proj-'));
const tmpNonOksProj = fs.mkdtempSync(path.join(os.tmpdir(), 'oks-non-icm-proj-'));
try {
  const { initOksWorkspace } = await import('../src/ops/index.js');
  const { validateOkfBundle } = await import('../src/okf/index.js');

  const initRes = initOksWorkspace(tmpPluginProj);
  const cleanVal = validateOkfBundle(path.join(tmpPluginProj, 'workspace', 'bundle'), {
    strict: true,
  });

  const hookScript = path.join(repoRoot, 'scripts', 'icm-hooks.mjs');
  const nonOksHookOut = JSON.parse(
    execFileSync(process.execPath, [hookScript, 'session-start', '--source=plugin'], {
      input: JSON.stringify({ workspacePaths: [tmpNonOksProj], cwd: tmpNonOksProj }),
      encoding: 'utf-8',
    })
  );
  const oksHookOut = JSON.parse(
    execFileSync(process.execPath, [hookScript, 'session-start', '--source=plugin'], {
      input: JSON.stringify({ workspacePaths: [tmpPluginProj], cwd: tmpPluginProj }),
      encoding: 'utf-8',
    })
  );

  const mcpScript = path.join(repoRoot, 'mcp', 'oks-mcp.mjs');
  const rpcInput =
    [
      JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: { protocolVersion: '2024-11-05' },
      }),
      JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} }),
      JSON.stringify({
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: {
          name: 'oks_validate_bundle',
          arguments: {
            bundleRoot: path.join(tmpPluginProj, 'workspace', 'bundle'),
            strict: true,
          },
        },
      }),
      JSON.stringify({
        jsonrpc: '2.0',
        id: 4,
        method: 'tools/call',
        params: {
          name: 'oks_status',
          arguments: {
            workspaceRoot: path.join(tmpPluginProj, 'workspace'),
            format: 'ascii',
          },
        },
      }),
    ].join('\n') + '\n';

  const mcpStdout = execFileSync(process.execPath, [mcpScript], {
    input: rpcInput,
    encoding: 'utf-8',
  });
  const mcpReplies = mcpStdout
    .trim()
    .split(/\r?\n/)
    .map((line) => JSON.parse(line));
  const toolsList = mcpReplies.find((r) => r.id === 2)?.result?.tools || [];
  const verifyToolDef = toolsList.find((t) => t.name === 'oks_verify_sources');
  const valToolReply = JSON.parse(
    mcpReplies.find((r) => r.id === 3)?.result?.content?.[0]?.text || '{}'
  );
  const statusToolText = String(
    mcpReplies.find((r) => r.id === 4)?.result?.content?.[0]?.text || ''
  );

  // Content-Length framed stdio JSON-RPC test for oks_verify_sources + Intermission adjudication (guards against console.log stdout corruption)
  const draftConceptPath = path.join(tmpPluginProj, 'workspace', 'bundle', 'research', 'mcp-framed-draft.md');
  fs.writeFileSync(
    draftConceptPath,
    [
      '---',
      'type: Research Concept',
      'title: Framed MCP Verification Test',
      'description: Verifies Content-Length JSON-RPC framing and Intermission adjudication forwarding during oks_verify_sources.',
      'status: draft',
      'generated:',
      '  by: oks-test/2.0',
      '  at: "2026-11-20T10:00:00Z"',
      'sources:',
      '  - id: primary-gov-2026',
      '    resource: https://authority.example.gov/statute',
      '    title: Primary Statute',
      '  - id: secondary-dir-2026',
      '    resource: https://directory.example.org/entry',
      '    title: Secondary Directory Summary',
      '---',
      '',
      'Verified statutory obligation[^primary-gov-2026].',
      '',
      '## Open Discrepancies for Intermission',
      '',
      '1. **Inspection Interval (`12 months` vs. `24 months`)**',
      '   - Primary statute specifies `12 months`[^primary-gov-2026].',
      '   - Secondary summary lists `24 months`[^secondary-dir-2026].',
      '2. **Internal Calibration Log Storage**',
      '   - Local log location is not published in external filings[^primary-gov-2026].',
      '',
      '[^primary-gov-2026]: Primary Statute',
      '[^secondary-dir-2026]: Secondary Directory Summary',
      '',
    ].join('\n'),
    'utf-8'
  );
  const encodeFramedRpc = (obj) => {
    const json = JSON.stringify(obj);
    return `Content-Length: ${Buffer.byteLength(json, 'utf8')}\r\n\r\n${json}`;
  };
  const framedInput =
    encodeFramedRpc({
      jsonrpc: '2.0',
      id: 10,
      method: 'initialize',
      params: { protocolVersion: '2024-11-05' },
    }) +
    encodeFramedRpc({
      jsonrpc: '2.0',
      id: 11,
      method: 'tools/call',
      params: {
        name: 'oks_verify_sources',
        arguments: {
          runIdOrPath: draftConceptPath,
          workspaceRoot: path.join(tmpPluginProj, 'workspace'),
          by: 'human:framed-reviewer',
          resolveMap: { '1': '12 months' },
          deferIds: ['2'],
          noteMap: { '2': 'Verify during local site walkthrough' },
        },
      },
    });
  const framedStdoutBuf = execFileSync(process.execPath, [mcpScript], {
    input: framedInput,
  });
  const framedReplies = [];
  let cursor = 0;
  while (cursor < framedStdoutBuf.length) {
    const hdrEnd = framedStdoutBuf.indexOf('\r\n\r\n', cursor);
    assert(hdrEnd !== -1, 'Content-Length header delimiter missing in oks-mcp.mjs stdout');
    const hdrText = framedStdoutBuf.subarray(cursor, hdrEnd).toString('utf8');
    const lenMatch = hdrText.match(/^Content-Length:\s*(\d+)$/i);
    assert(Boolean(lenMatch), `Stdout corrupted before Content-Length header: ${JSON.stringify(hdrText)}`);
    const bodyLen = parseInt(lenMatch[1], 10);
    const bodyStart = hdrEnd + 4;
    const bodyEnd = bodyStart + bodyLen;
    assert(bodyEnd <= framedStdoutBuf.length, 'Truncated Content-Length frame in oks-mcp.mjs stdout');
    framedReplies.push(JSON.parse(framedStdoutBuf.subarray(bodyStart, bodyEnd).toString('utf8')));
    cursor = bodyEnd;
  }
  const framedVerifyReply = JSON.parse(
    framedReplies.find((r) => r.id === 11)?.result?.content?.[0]?.text || '{}'
  );
  const okfExports = await import('../src/okf/index.js');
  const postVerifyConceptRaw = fs.readFileSync(draftConceptPath, 'utf-8');
  const postVerifyBundleVal = validateOkfBundle(path.join(tmpPluginProj, 'workspace', 'bundle'), {
    strict: true,
  });
  const adjudicationPersistedOk =
    typeof okfExports.applyIntermissionAdjudications === 'function'
      ? postVerifyConceptRaw.includes('x-adjudications:') &&
        postVerifyConceptRaw.includes('12 months') &&
        postVerifyConceptRaw.includes('check-later')
      : true;

  assert(
    initRes.createdFiles.includes('prompts/01_research.md') &&
      initRes.createdFiles.includes('workspace/bundle/index.md') &&
      !fs.existsSync(path.join(tmpPluginProj, 'src')) &&
      cleanVal.passed === true &&
      cleanVal.errors === 0 &&
      cleanVal.warnings === 0 &&
      Object.keys(nonOksHookOut).length === 0 &&
      String(oksHookOut?.injectSteps?.[0]?.systemMessage?.systemMessage || '').includes(
        '[ICM Co-Architect Session Context]'
      ) &&
      toolsList.length === 6 &&
      verifyToolDef?.inputSchema?.properties?.resolveMap?.type === 'object' &&
      verifyToolDef?.inputSchema?.properties?.deferIds?.type === 'array' &&
      verifyToolDef?.inputSchema?.properties?.noteMap?.type === 'object' &&
      valToolReply.passed === true &&
      statusToolText.includes('OKF v0.3 Bundle:') &&
      framedReplies.length === 2 &&
      framedVerifyReply.status === 'stable' &&
      framedVerifyReply.trust_tier === 'human-reviewed' &&
      adjudicationPersistedOk &&
      postVerifyBundleVal.passed === true &&
      postVerifyBundleVal.errors === 0 &&
      postVerifyBundleVal.warnings === 0,
    'initOksWorkspace, workspace-scoped plugin hooks, and stdio MCP server (oks-mcp.mjs newline + Content-Length oks_verify_sources with resolveMap/deferIds/noteMap) pass end-to-end'
  );

  console.log('[Plugin Self-Test] ✅ All dual-mode plugin, hook, initOksWorkspace, & MCP assertions passed (0 tokens).');
} finally {
  fs.rmSync(tmpPluginProj, { recursive: true, force: true });
  fs.rmSync(tmpNonOksProj, { recursive: true, force: true });
}
