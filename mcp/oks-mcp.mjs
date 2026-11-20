#!/usr/bin/env node
/**
 * Zero-dependency Open Knowledge Studio MCP Server (`mcp/oks-mcp.mjs`).
 * Exposes zero-token ICM + OKF v0.3 + A2UI v1.0 workspace initialization, status inspection,
 * strict OKF v0.3 bundle validation, `<50ms` source curation/verification, Studio compilation,
 * and 3-pillar upstream spec checks over stdio JSON-RPC 2.0 without any `node_modules`.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
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
      const candidateTs = path.resolve(path.dirname(parentPath), `${specifier.slice(0, -3)}.ts`);
      if (fs.existsSync(candidateTs)) {
        return nextResolve(pathToFileURL(candidateTs).href, context);
      }
    }
    return nextResolve(specifier, context);
  },
});

// Redirect engine diagnostic console.log calls to stderr so stdout remains pure stdio JSON-RPC 2.0
console.log = (...args) => console.error(...args);

const engine = await import('../src/index.ts');

const SERVER_INFO = {
  name: 'open-knowledge-studio',
  version: '2.0.0',
};

const TOOLS = [
  {
    name: 'oks_init_workspace',
    description:
      'Initialize a clean Open Knowledge Studio workspace (prompts/01_research.md, prompts/02_script.md, workspace/GEMINI.md, workspace/CONTEXT.md, workspace/_config/voice_guide.md, workspace/bundle/index.md, workspace/bundle/log.md, .gitignore) in a target directory without copying engine source code.',
    inputSchema: {
      type: 'object',
      properties: {
        targetDir: {
          type: 'string',
          description: 'Target project directory to initialize (defaults to current working directory).',
        },
        overwrite: {
          type: 'boolean',
          description: 'Overwrite existing starter files if true (defaults to false).',
        },
      },
    },
  },
  {
    name: 'oks_status',
    description:
      'Inspect ICM + OKF v0.3 + A2UI v1.0 pipeline status, bundle concepts, trust tiers, staleness, and token telemetry at zero LLM token cost.',
    inputSchema: {
      type: 'object',
      properties: {
        workspaceRoot: {
          type: 'string',
          description: 'Path to the workspace directory (e.g., "<project>/workspace").',
        },
        runId: {
          type: 'string',
          description: 'Optional run ID filter.',
        },
        format: {
          type: 'string',
          enum: ['ascii', 'json'],
          description: 'Output format: "ascii" dashboard (default) or "json".',
        },
      },
    },
  },
  {
    name: 'oks_validate_bundle',
    description:
      'Validate an OKF v0.3 knowledge bundle directory against SPEC.md §11 conformance and extraction-integrity rules (E002, E004-E007, W101-W108, W110, W115-W118, W120, W122-W123, W125, I201, I203-I204, X-OKS-W01..W02) with zero Python/PyYAML dependency.',
    inputSchema: {
      type: 'object',
      properties: {
        bundleRoot: {
          type: 'string',
          description: 'Path to the OKF v0.3 bundle directory (e.g., "<project>/workspace/bundle").',
        },
        strict: {
          type: 'boolean',
          description: 'Treat warnings as failures when true (defaults to true).',
        },
      },
      required: ['bundleRoot'],
    },
  },
  {
    name: 'oks_verify_sources',
    description:
      'Execute <50ms zero-token OKF v0.3 source curation (--reject-source, --replace-source, --add-source) and Intermission conflict/gap adjudication (--resolve, --defer, --note), stamping machine-confirmed or human-reviewed verification onto a Stage 1 run or bundle concept and automatically refreshing a2ui.html and viz.html.',
    inputSchema: {
      type: 'object',
      properties: {
        runIdOrPath: {
          type: 'string',
          description: 'Stage 1 runId or path to an OKF concept .md file.',
        },
        workspaceRoot: {
          type: 'string',
          description: 'Path to the workspace directory (e.g., "<project>/workspace").',
        },
        by: {
          type: 'string',
          description:
            'OKF v0.3 verifier actor (<producer>/<version> such as "icm-co-architect/gemini-4-argon" for machine-confirmed, or "human:<id>" for human-reviewed).',
        },
        rejectSourceIds: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional list of source IDs to reject.',
        },
        replaceSourceMap: {
          type: 'object',
          additionalProperties: { type: 'string' },
          description: 'Optional map of { oldSourceId: newSourceIdOrCanonicalUrl } to re-anchor citations.',
        },
        addSources: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              url: { type: 'string' },
              title: { type: 'string' },
              id: { type: 'string' },
            },
            required: ['url'],
          },
          description: 'Optional list of canonical sources to add.',
        },
        resolveMap: {
          type: 'object',
          additionalProperties: { type: 'string' },
          description:
            'Optional map of { adjudicationIdOrNumber: selectedAuthoritativeValue } to resolve Intermission conflicts or source switches (--resolve <id=val>).',
        },
        deferIds: {
          type: 'array',
          items: { type: 'string' },
          description:
            'Optional list of Intermission adjudication IDs or item numbers to mark as check-later (--defer <id>).',
        },
        noteMap: {
          type: 'object',
          additionalProperties: { type: 'string' },
          description:
            'Optional map of { adjudicationIdOrNumber: noteText } to attach reviewer notes to Intermission items (--note <id=text>).',
        },
        artifactDir: {
          type: 'string',
          description: 'Optional Antigravity brain/<conversation-id> directory to sync a2ui_studio.html and okf_viz_studio.html.',
        },
      },
      required: ['runIdOrPath'],
    },
  },
  {
    name: 'oks_compile_studio',
    description:
      'Compile declarative A2UI v1.0 surface artifacts (a2ui_surface.json, a2ui.html) and the standalone Cytoscape OKF v0.3 knowledge graph explorer (viz.html) at zero LLM token cost.',
    inputSchema: {
      type: 'object',
      properties: {
        workspaceRoot: {
          type: 'string',
          description: 'Path to the workspace directory (e.g., "<project>/workspace").',
        },
        runId: {
          type: 'string',
          description: 'Optional run ID (defaults to latest run in workspace/runs/).',
        },
        artifactDir: {
          type: 'string',
          description: 'Optional Antigravity brain/<conversation-id> directory to sync a2ui_studio.html and okf_viz_studio.html.',
        },
      },
    },
  },
  {
    name: 'oks_spec_check',
    description:
      'Check live upstream specification parity across all three open pillars: ICM (RinDig/Interpretable-Context-Methodology), OKF v0.3 (open-knowledge-format/open-knowledge-format), and A2UI v1.0 (google/A2UI).',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
];

function resolveWorkspaceDir(rawWs) {
  if (rawWs && String(rawWs).trim()) {
    const resolved = path.resolve(String(rawWs).trim());
    if (
      path.basename(resolved).toLowerCase() !== 'workspace' &&
      fs.existsSync(path.join(resolved, 'workspace'))
    ) {
      return path.join(resolved, 'workspace');
    }
    return resolved;
  }
  return path.resolve(process.cwd(), 'workspace');
}

async function handleToolCall(name, args = {}) {
  switch (name) {
    case 'oks_init_workspace': {
      const res = engine.initOksWorkspace(args.targetDir || process.cwd(), {
        overwrite: Boolean(args.overwrite),
      });
      return JSON.stringify(res, null, 2);
    }
    case 'oks_status': {
      const wsDir = resolveWorkspaceDir(args.workspaceRoot);
      const report = engine.getIcmPipelineStatus({
        workspaceRoot: wsDir,
        runId: args.runId ? String(args.runId) : undefined,
      });
      return args.format === 'json'
        ? JSON.stringify(report, null, 2)
        : engine.formatIcmPipelineStatus(report);
    }
    case 'oks_validate_bundle': {
      const strict = args.strict !== undefined ? Boolean(args.strict) : true;
      const report = engine.validateOkfBundle(String(args.bundleRoot || './workspace/bundle'), {
        strict,
      });
      return JSON.stringify(report, null, 2);
    }
    case 'oks_verify_sources': {
      const wsDir = resolveWorkspaceDir(args.workspaceRoot);
      const toStringRecord = (obj) => {
        if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return undefined;
        const out = {};
        for (const [k, v] of Object.entries(obj)) {
          if (v !== undefined && v !== null) out[String(k)] = String(v);
        }
        return out;
      };
      const res = engine.verifyOkfConcept(String(args.runIdOrPath), {
        workspaceRoot: wsDir,
        by: args.by ? String(args.by) : undefined,
        rejectSourceIds: Array.isArray(args.rejectSourceIds)
          ? args.rejectSourceIds.map(String)
          : undefined,
        replaceSourceMap: toStringRecord(args.replaceSourceMap),
        addSources: Array.isArray(args.addSources) ? args.addSources : undefined,
        resolveMap: toStringRecord(args.resolveMap),
        deferIds: Array.isArray(args.deferIds) ? args.deferIds.map(String) : undefined,
        noteMap: toStringRecord(args.noteMap),
        artifactDir: args.artifactDir ? String(args.artifactDir) : undefined,
      });
      if (res.status === 'stable') {
        await engine.closeActiveA2uiPingPongListener?.({
          reason: 'verified',
          workspaceRoot: wsDir,
          runId: res.runId || String(args.runIdOrPath),
        });
      }
      return JSON.stringify(res, null, 2);
    }
    case 'oks_compile_studio': {
      const wsDir = resolveWorkspaceDir(args.workspaceRoot);
      const a2uiRes = engine.generateA2uiSurface({
        workspaceRoot: wsDir,
        runId: args.runId ? String(args.runId) : undefined,
        artifactDir: args.artifactDir ? String(args.artifactDir) : undefined,
      });
      const vizRes = a2uiRes.bundleVizPath ? { outputPath: a2uiRes.bundleVizPath } : null;
      return JSON.stringify({ a2ui: a2uiRes, viz: vizRes }, null, 2);
    }
    case 'oks_spec_check': {
      const res = await engine.checkUpstreamSpecs();
      return JSON.stringify(res, null, 2);
    }
    default:
      throw new Error(`Unknown MCP tool: ${name}`);
  }
}

let useContentLengthFraming = false;

function sendRpcMessage(obj) {
  const json = JSON.stringify(obj);
  if (useContentLengthFraming) {
    const byteLen = Buffer.byteLength(json, 'utf8');
    process.stdout.write(`Content-Length: ${byteLen}\r\n\r\n${json}`);
  } else {
    process.stdout.write(`${json}\n`);
  }
}

async function dispatchRpc(msg) {
  if (!msg || typeof msg !== 'object') return;
  const { id, method, params } = msg;

  // Notifications have no `id`
  if (id === undefined || id === null) {
    return;
  }

  try {
    if (method === 'initialize') {
      const clientProto = String(params?.protocolVersion || '2024-11-05');
      sendRpcMessage({
        jsonrpc: '2.0',
        id,
        result: {
          protocolVersion: clientProto,
          capabilities: {
            tools: {},
          },
          serverInfo: SERVER_INFO,
        },
      });
      return;
    }

    if (method === 'ping') {
      sendRpcMessage({ jsonrpc: '2.0', id, result: {} });
      return;
    }

    if (method === 'tools/list') {
      sendRpcMessage({
        jsonrpc: '2.0',
        id,
        result: { tools: TOOLS },
      });
      return;
    }

    if (method === 'tools/call') {
      const toolName = String(params?.name || '');
      const toolArgs = params?.arguments || {};
      try {
        const textOut = await handleToolCall(toolName, toolArgs);
        sendRpcMessage({
          jsonrpc: '2.0',
          id,
          result: {
            content: [{ type: 'text', text: textOut }],
          },
        });
      } catch (toolErr) {
        sendRpcMessage({
          jsonrpc: '2.0',
          id,
          result: {
            content: [
              {
                type: 'text',
                text: `Error executing ${toolName}: ${toolErr?.message || String(toolErr)}`,
              },
            ],
            isError: true,
          },
        });
      }
      return;
    }

    sendRpcMessage({
      jsonrpc: '2.0',
      id,
      error: { code: -32601, message: `Method not found: ${method}` },
    });
  } catch (err) {
    sendRpcMessage({
      jsonrpc: '2.0',
      id,
      error: { code: -32603, message: err?.message || String(err) },
    });
  }
}

let rawBuffer = Buffer.alloc(0);
process.stdin.on('data', (chunk) => {
  rawBuffer = Buffer.concat([rawBuffer, Buffer.from(chunk)]);
  while (rawBuffer.length > 0) {
    const preview = rawBuffer.subarray(0, Math.min(rawBuffer.length, 64)).toString('utf8');
    if (/^Content-Length:/i.test(preview)) {
      useContentLengthFraming = true;
      const headerEnd = rawBuffer.indexOf('\r\n\r\n');
      if (headerEnd === -1) break;
      const headerStr = rawBuffer.subarray(0, headerEnd).toString('utf8');
      const lenMatch = headerStr.match(/Content-Length:\s*(\d+)/i);
      if (!lenMatch) {
        rawBuffer = rawBuffer.subarray(headerEnd + 4);
        continue;
      }
      const bodyLen = parseInt(lenMatch[1], 10);
      const totalNeeded = headerEnd + 4 + bodyLen;
      if (rawBuffer.length < totalNeeded) break;
      const bodyStr = rawBuffer.subarray(headerEnd + 4, totalNeeded).toString('utf8');
      rawBuffer = rawBuffer.subarray(totalNeeded);
      try {
        void dispatchRpc(JSON.parse(bodyStr));
      } catch {
        // Ignore malformed frame
      }
    } else {
      const nlIdx = rawBuffer.indexOf('\n');
      if (nlIdx === -1) break;
      const lineStr = rawBuffer.subarray(0, nlIdx).toString('utf8').trim();
      rawBuffer = rawBuffer.subarray(nlIdx + 1);
      if (!lineStr) continue;
      try {
        void dispatchRpc(JSON.parse(lineStr));
      } catch {
        // Ignore non-JSON line
      }
    }
  }
});
