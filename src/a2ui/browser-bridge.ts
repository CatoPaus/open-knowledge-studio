import * as fs from 'fs';
import * as path from 'path';
import * as http from 'http';
import * as os from 'os';
import { spawn } from 'child_process';

import { A2UI_PROTOCOL_VERSION } from './types.js';

/**
 * Opens a generated HTML file (`a2ui.html` or `viz.html`) in the system browser
 * (`Start-Process` / `cmd /c start` on Windows, `open` on macOS, `xdg-open` on Linux).
 * Suppressed automatically during `--test` and `CI=true`.
 */
export function openFileInSystemBrowser(filePath: string): boolean {
  if (!filePath || !fs.existsSync(filePath)) return false;
  if (process.argv.includes('--test') || process.env.CI === 'true') return false;
  try {
    const absPath = path.resolve(filePath);
    if (process.platform === 'win32') {
      const child = spawn('cmd.exe', ['/c', 'start', '""', absPath], {
        detached: true,
        stdio: 'ignore',
        windowsHide: true,
      });
      child.unref();
    } else if (process.platform === 'darwin') {
      const child = spawn('open', [absPath], {
        detached: true,
        stdio: 'ignore',
      });
      child.unref();
    } else {
      const child = spawn('xdg-open', [absPath], {
        detached: true,
        stdio: 'ignore',
      });
      child.unref();
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Copies `a2ui.html` and `viz.html` into an Antigravity 2.0 conversation Artifact Directory
 * (`<appDataDir>/brain/<conversation-id>/`) along with `.metadata.json` descriptors so the
 * HTML Auxiliary Pane can render the live interactive studio without reading/echoing ~500 KB of HTML.
 */
export function syncA2uiToArtifactDir(input: {
  artifactDir?: string;
  htmlOutputPath?: string;
  htmlContent?: string;
  bundleVizPath?: string;
  runId?: string;
  title?: string;
  isStage1Only?: boolean;
}): { artifactHtmlPath?: string; artifactVizPath?: string } {
  const rawDir = (input.artifactDir || process.env.AGY_ARTIFACT_DIR || '').trim();
  if (!rawDir) return {};
  try {
    const resolvedDir = path.resolve(rawDir);
    fs.mkdirSync(resolvedDir, { recursive: true });
    let artifactHtmlPath: string | undefined;
    let artifactVizPath: string | undefined;
    const nowIso = new Date().toISOString();
    const labelTitle = input.title || input.runId || 'ICM Run';
    const stageDesc = input.isStage1Only
      ? 'Stage 1 Intermission OKF v0.3 Source Curation & Review Studio'
      : 'Full Stage 1 + Stage 2 A2UI v1.0 Interactive Surface Studio';

    const hasHtmlContent = typeof input.htmlContent === 'string' && input.htmlContent.length > 0;
    if (hasHtmlContent || (input.htmlOutputPath && fs.existsSync(input.htmlOutputPath))) {
      artifactHtmlPath = path.join(resolvedDir, 'a2ui_studio.html');
      if (hasHtmlContent) {
        fs.writeFileSync(artifactHtmlPath, input.htmlContent!, 'utf-8');
      } else {
        fs.copyFileSync(input.htmlOutputPath!, artifactHtmlPath);
      }
      fs.writeFileSync(
        `${artifactHtmlPath}.metadata.json`,
        JSON.stringify(
          {
            summary: `${labelTitle} — ${stageDesc} (run: ${input.runId || 'workspace'}).`,
            updatedAt: nowIso,
            userFacing: true,
          },
          null,
          2
        ),
        'utf-8'
      );
    }

    if (input.bundleVizPath && fs.existsSync(input.bundleVizPath)) {
      artifactVizPath = path.join(resolvedDir, 'okf_viz_studio.html');
      fs.copyFileSync(input.bundleVizPath, artifactVizPath);
      fs.writeFileSync(
        `${artifactVizPath}.metadata.json`,
        JSON.stringify(
          {
            summary: `${labelTitle} — OKF v0.3 Interactive Knowledge Graph & Provenance Explorer (run: ${input.runId || 'workspace'}).`,
            updatedAt: nowIso,
            userFacing: true,
          },
          null,
          2
        ),
        'utf-8'
      );
    }

    return { artifactHtmlPath, artifactVizPath };
  } catch {
    return {};
  }
}

export const A2UI_PING_PONG_DEFAULT_PORT = 44820;

export interface A2uiPingPongPayload {
  runId?: string;
  verifierActor?: string;
  rejectedSources?: string[];
  replacedSources?: Record<string, string>;
  addedSources?: Array<{ id?: string; url: string; title?: string }>;
  resolvedAdjudications?: Record<string, string>;
  deferredAdjudications?: string[];
  adjudicationNotes?: Record<string, string>;
  agyText?: string;
  cliText?: string;
  timestamp?: string;
  [key: string]: any;
}

function isPidAlive(pid: number): boolean {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (err: any) {
    return err?.code === 'EPERM';
  }
}

/**
 * Reads any persisted active Ping-Pong listener state for `runId` (or workspace) without
 * sending a network request to `/ping-pong` (which is a one-shot wakeup endpoint).
 */
export function readActivePingPongState(
  workspaceRoot?: string,
  runId?: string
): { port: number; pingPongUrl: string; pid?: number; runId?: string; workspaceRoot?: string } | null {
  try {
    const resolvedWs = path.resolve(workspaceRoot || './workspace');
    const candidates: string[] = [];
    if (runId && String(runId).trim()) {
      const cleanRunId = String(runId).trim();
      candidates.push(path.join(resolvedWs, 'runs', cleanRunId, '.a2ui-ping-pong.json'));
    }
    candidates.push(path.join(resolvedWs, '.a2ui-ping-pong.json'));
    for (const statePath of candidates) {
      if (!fs.existsSync(statePath)) continue;
      try {
        const parsed = JSON.parse(fs.readFileSync(statePath, 'utf-8'));
        const port = Number(parsed?.port || 0);
        if (!Number.isInteger(port) || port <= 0 || port > 65535) continue;
        const pid = parsed?.pid !== undefined ? Number(parsed.pid) : undefined;
        if (pid !== undefined && !isPidAlive(pid)) {
          continue;
        }
        if (runId && parsed?.runId && String(parsed.runId) !== String(runId)) {
          continue;
        }
        return {
          port,
          pingPongUrl:
            typeof parsed?.pingPongUrl === 'string' && parsed.pingPongUrl.trim()
              ? parsed.pingPongUrl.trim()
              : `http://127.0.0.1:${port}/ping-pong`,
          ...(pid !== undefined ? { pid } : {}),
          ...(parsed?.runId ? { runId: String(parsed.runId) } : {}),
          ...(typeof parsed?.workspaceRoot === 'string' && parsed.workspaceRoot.trim()
            ? { workspaceRoot: parsed.workspaceRoot.trim() }
            : {}),
        };
      } catch {
        // Ignore malformed state file
      }
    }
  } catch {
    // Ignore FS errors
  }
  return null;
}

/**
 * Detects whether the user has Antigravity 2.0 installed with `/browser` capabilities
 * (`~/.gemini/antigravity/browser_recordings`, `~/.gemini/antigravity/html_artifacts`, or
 * `~/.gemini/config/plugins/chrome-devtools-plugin` alongside `~/.gemini/antigravity/brain`).
 * Can also be explicitly overridden via `options.enablePingPong` or `AGY_PING_PONG=1|0`.
 */
export function hasAntigravityBrowserCapability(options?: {
  artifactDir?: string;
  enablePingPong?: boolean;
  homeDir?: string;
}): boolean {
  if (options?.enablePingPong === false || process.env.AGY_PING_PONG === '0') {
    return false;
  }
  if (
    options?.enablePingPong === true ||
    process.env.AGY_PING_PONG === '1' ||
    process.argv.includes('--ping-pong')
  ) {
    return true;
  }
  try {
    const baseHome = options?.homeDir || os.homedir();
    if (!baseHome) return false;
    const agyDir = path.join(baseHome, '.gemini', 'antigravity');
    const brainDir = path.join(agyDir, 'brain');
    if (!fs.existsSync(agyDir) || !fs.existsSync(brainDir)) {
      return false;
    }
    const browserRecordingsDir = path.join(agyDir, 'browser_recordings');
    const htmlArtifactsDir = path.join(agyDir, 'html_artifacts');
    const chromeDevtoolsPluginDir = path.join(
      baseHome,
      '.gemini',
      'config',
      'plugins',
      'chrome-devtools-plugin'
    );
    return (
      fs.existsSync(browserRecordingsDir) ||
      fs.existsSync(htmlArtifactsDir) ||
      fs.existsSync(chromeDevtoolsPluginDir)
    );
  } catch {
    return false;
  }
}

/**
 * Starts a zero-dependency one-shot HTTP loopback listener (`127.0.0.1:44820` by default)
 * for Antigravity 2.0's Reactive Wakeup ("Ping-Pong") workflow.
 * Supports both A2UI v1.0 `callAgentFunction` (`verifyOkfSources`) RPC envelopes (returning a
 * canonical `agentFunctionResponse` envelope) and 1x1 GIF query-string beacons (`?payload=...&format=gif`).
 */
export function startA2uiPingPongListener(options?: {
  port?: number;
  workspaceRoot?: string;
  runId?: string;
  htmlPath?: string;
  force?: boolean;
  onListening?: (port: number) => void;
}): Promise<{
  skipped?: boolean;
  port: number;
  payload: A2uiPingPongPayload;
}> {
  if (
    !options?.force &&
    !hasAntigravityBrowserCapability({ enablePingPong: options?.force })
  ) {
    console.log(
      '[A2UI Ping-Pong]: Skipped (Antigravity 2.0 /browser capability not detected on this system).'
    );
    return Promise.resolve({ skipped: true, port: 0, payload: {} });
  }

  const requestedPort =
    options?.port !== undefined ? options.port : A2UI_PING_PONG_DEFAULT_PORT;
  const resolvedWorkspaceRoot = options?.workspaceRoot
    ? path.resolve(options.workspaceRoot)
    : undefined;
  const workspaceRoot = resolvedWorkspaceRoot || path.resolve('./workspace');
  const activeRunId = options?.runId ? String(options.runId).trim() : '';
  const runDirForState =
    activeRunId && fs.existsSync(path.join(workspaceRoot, 'runs', activeRunId))
      ? path.join(workspaceRoot, 'runs', activeRunId)
      : '';
  const stateFilePaths = Array.from(
    new Set(
      [
        resolvedWorkspaceRoot && fs.existsSync(resolvedWorkspaceRoot)
          ? path.join(resolvedWorkspaceRoot, '.a2ui-ping-pong.json')
          : '',
        runDirForState ? path.join(runDirForState, '.a2ui-ping-pong.json') : '',
      ].filter(Boolean)
    )
  );
  const cleanupStateFile = (expectedPort?: number) => {
    for (const sfPath of stateFilePaths) {
      if (!sfPath || !fs.existsSync(sfPath)) continue;
      try {
        const cur = JSON.parse(fs.readFileSync(sfPath, 'utf-8'));
        if (
          (cur?.pid === undefined || cur.pid === process.pid) &&
          (expectedPort === undefined || cur?.port === expectedPort)
        ) {
          fs.unlinkSync(sfPath);
        }
      } catch {
        // Non-fatal cleanup
      }
    }
  };
  let resolvedHtmlPath = options?.htmlPath ? path.resolve(options.htmlPath) : '';
  if (!resolvedHtmlPath && options?.runId) {
    const candidate = path.join(workspaceRoot, 'runs', options.runId, 'a2ui.html');
    if (fs.existsSync(candidate)) resolvedHtmlPath = candidate;
  }
  if (!resolvedHtmlPath) {
    const bundleHtml = path.join(workspaceRoot, 'bundle', 'a2ui.html');
    if (fs.existsSync(bundleHtml)) resolvedHtmlPath = bundleHtml;
  }

  return new Promise((resolve, reject) => {
    let handled = false;
    let retriedSupersede = false;
    const transparentGif1x1 = Buffer.from(
      'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
      'base64'
    );
    const server = http.createServer((req, res) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      res.setHeader('Access-Control-Allow-Private-Network', 'true');

      if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
      }

      const actualAddress = server.address();
      const boundPort =
        typeof actualAddress === 'object' && actualAddress
          ? actualAddress.port
          : requestedPort;
      const parsedUrl = new URL(req.url || '/', `http://127.0.0.1:${boundPort}`);

      if (parsedUrl.pathname === '/' && req.method === 'GET') {
        if (resolvedHtmlPath && fs.existsSync(resolvedHtmlPath)) {
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(fs.readFileSync(resolvedHtmlPath, 'utf-8'));
        } else {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ status: 'waiting_for_ping_pong', port: boundPort }));
        }
        return;
      }

      if (parsedUrl.pathname === '/supersede') {
        const reason = String(parsedUrl.searchParams.get('reason') || '').trim();
        const normalizedReason = reason || 'newer_listener';
        if (normalizedReason === 'verified' || normalizedReason === 'stage2') {
          const reqRunId = String(parsedUrl.searchParams.get('runId') || '').trim();
          const reqWorkspace = String(parsedUrl.searchParams.get('workspaceRoot') || '').trim();
          const runMismatch = Boolean(activeRunId && (!reqRunId || reqRunId !== activeRunId));
          const workspaceMismatch = Boolean(
            resolvedWorkspaceRoot &&
              reqWorkspace &&
              path.resolve(reqWorkspace) !== resolvedWorkspaceRoot
          );
          if (runMismatch || workspaceMismatch) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(
              JSON.stringify({
                ok: false,
                superseded: false,
                ignored: true,
                reason: 'scope_mismatch',
              })
            );
            return;
          }
        }
        if (handled) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              ok: true,
              superseded: true,
              duplicate: true,
              reason: normalizedReason,
            })
          );
          return;
        }
        handled = true;
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, superseded: true, reason: normalizedReason }));
        if (normalizedReason === 'verified' || normalizedReason === 'stage2') {
          console.log(
            `[A2UI Ping-Pong]: Intermission completed via CLI (${normalizedReason}); closing idle Ping-Pong listener on port ${boundPort} (no action required).`
          );
        } else {
          console.log(
            `[A2UI Ping-Pong]: Port ${boundPort} superseded by a newer Ping-Pong listener; closing stale listener.`
          );
        }
        cleanupStateFile(boundPort);
        server.close(() => {
          resolve({
            skipped: true,
            port: boundPort,
            payload: { superseded: true, reason: normalizedReason },
          });
        });
        return;
      }

      if (parsedUrl.pathname === '/ping-pong') {
        const wantsGif =
          parsedUrl.searchParams.get('format') === 'gif' ||
          (req.method === 'GET' && /^image\//i.test(String(req.headers.accept || '')));
        const sendAck = (bodyObj: Record<string, any>) => {
          if (wantsGif) {
            res.writeHead(200, {
              'Content-Type': 'image/gif',
              'Cache-Control': 'no-store, no-cache, must-revalidate',
              'Content-Length': String(transparentGif1x1.length),
            });
            res.end(transparentGif1x1);
          } else {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(bodyObj));
          }
        };

        let body = '';
        req.on('data', (chunk) => {
          body += chunk.toString('utf-8');
        });
        req.on('end', () => {
          if (handled) {
            sendAck({ ok: true, duplicate: true });
            return;
          }
          handled = true;
          const rawBodyPayload = body || parsedUrl.searchParams.get('payload') || '{}';
          let parsed: Record<string, any> = {};
          try {
            parsed = JSON.parse(rawBodyPayload);
          } catch {
            const queryFallback = parsedUrl.searchParams.get('payload');
            if (queryFallback) {
              try {
                parsed = JSON.parse(queryFallback);
              } catch {
                parsed = { raw: rawBodyPayload };
              }
            } else {
              parsed = { raw: rawBodyPayload };
            }
          }
          const fnCallId =
            typeof parsed?.callAgentFunction?.functionCallId === 'string'
              ? parsed.callAgentFunction.functionCallId
              : '';
          const rawArgs: Record<string, any> =
            parsed?.callAgentFunction?.callFunction?.args &&
            typeof parsed.callAgentFunction.callFunction.args === 'object'
              ? parsed.callAgentFunction.callFunction.args
              : parsed;
          const normalizedPayload: A2uiPingPongPayload = { ...rawArgs };
          if (
            rawArgs?.resolvedAdjudications &&
            typeof rawArgs.resolvedAdjudications === 'object' &&
            !Array.isArray(rawArgs.resolvedAdjudications)
          ) {
            const cleanResolved: Record<string, string> = {};
            for (const [k, v] of Object.entries(rawArgs.resolvedAdjudications)) {
              const key = String(k || '').trim();
              const val = String(v ?? '').trim();
              if (key && val) cleanResolved[key] = val;
            }
            normalizedPayload.resolvedAdjudications = cleanResolved;
          }
          if (Array.isArray(rawArgs?.deferredAdjudications)) {
            normalizedPayload.deferredAdjudications = rawArgs.deferredAdjudications
              .map((id: unknown) => String(id || '').trim())
              .filter(Boolean);
          }
          if (
            rawArgs?.adjudicationNotes &&
            typeof rawArgs.adjudicationNotes === 'object' &&
            !Array.isArray(rawArgs.adjudicationNotes)
          ) {
            const cleanNotes: Record<string, string> = {};
            for (const [k, v] of Object.entries(rawArgs.adjudicationNotes)) {
              const key = String(k || '').trim();
              const val = String(v ?? '').trim();
              if (key && val) cleanNotes[key] = val;
            }
            normalizedPayload.adjudicationNotes = cleanNotes;
          }
          const ackBody = fnCallId
            ? {
                version: A2UI_PROTOCOL_VERSION,
                agentFunctionResponse: {
                  functionCallId: fnCallId,
                  value: { ok: true, received: normalizedPayload },
                },
              }
            : { ok: true, received: normalizedPayload };
          sendAck(ackBody);

          console.log('\n=== [AGY PING-PONG REACTIVE WAKEUP TRIGGERED] ===');
          console.log(JSON.stringify(normalizedPayload, null, 2));
          cleanupStateFile(boundPort);
          server.close(() => {
            resolve({ port: boundPort, payload: normalizedPayload });
          });
        });
        return;
      }

      res.writeHead(404);
      res.end('Not found');
    });

    const onListenReady = () => {
      const addr = server.address();
      const boundPort =
        typeof addr === 'object' && addr ? addr.port : requestedPort;
      if (stateFilePaths.length > 0) {
        const serializedState = JSON.stringify(
          {
            runId: options?.runId,
            ...(resolvedWorkspaceRoot ? { workspaceRoot: resolvedWorkspaceRoot } : {}),
            port: boundPort,
            pid: process.pid,
            pingPongUrl: `http://127.0.0.1:${boundPort}/ping-pong`,
            startedAt: new Date().toISOString(),
          },
          null,
          2
        );
        for (const sfPath of stateFilePaths) {
          try {
            fs.writeFileSync(sfPath, serializedState, 'utf-8');
          } catch {
            // Non-fatal if read-only
          }
        }
      }
      console.log(
        `[A2UI Ping-Pong Listener]: Waiting for button click on http://127.0.0.1:${boundPort}/ping-pong ...`
      );
      if (typeof options?.onListening === 'function') {
        options.onListening(boundPort);
      }
    };

    server.on('error', (err: any) => {
      if (err?.code === 'EADDRINUSE' && requestedPort !== 0) {
        if (!retriedSupersede) {
          retriedSupersede = true;
          const supReq = http.request(
            {
              hostname: '127.0.0.1',
              port: requestedPort,
              path: '/supersede',
              method: 'POST',
              timeout: 500,
            },
            (supRes) => {
              supRes.resume();
              supRes.on('end', () => {
                setTimeout(() => server.listen(requestedPort, '127.0.0.1', onListenReady), 120);
              });
            }
          );
          supReq.on('error', () => {
            console.log(
              `[A2UI Ping-Pong]: Port ${requestedPort} is already active; reusing existing listener.`
            );
            resolve({ skipped: true, port: requestedPort, payload: {} });
          });
          supReq.end();
          return;
        }
        console.log(
          `[A2UI Ping-Pong]: Port ${requestedPort} is already active; reusing existing listener.`
        );
        resolve({ skipped: true, port: requestedPort, payload: {} });
        return;
      }
      reject(err);
    });

    server.listen(requestedPort, '127.0.0.1', onListenReady);
  });
}

/**
 * Closes any active one-shot `127.0.0.1:44820` Ping-Pong listener by sending a fast loopback
 * `POST /supersede?reason=...` request (`200ms` default timeout). Resolves `true` if an active
 * listener acknowledged and closed, or `false` immediately if no listener is bound on the port.
 * Used by `cli:verify` (on `status: stable`) and `runStage2Flow()` so an Intermission background
 * task never stays spinning when the user approves via clipboard paste from a CSP-sandboxed pane.
 */
export function closeActiveA2uiPingPongListener(options?: {
  port?: number;
  reason?: string;
  timeoutMs?: number;
  workspaceRoot?: string;
  runId?: string;
}): Promise<boolean> {
  const resolvedWorkspaceRoot = options?.workspaceRoot
    ? path.resolve(options.workspaceRoot)
    : undefined;
  let effectiveRunId = options?.runId ? String(options.runId).trim() : '';
  let port: number;

  if (options?.port !== undefined) {
    port = options.port;
  } else if (resolvedWorkspaceRoot) {
    const stateCandidates = [
      path.join(resolvedWorkspaceRoot, '.a2ui-ping-pong.json'),
      ...(effectiveRunId
        ? [path.join(resolvedWorkspaceRoot, 'runs', effectiveRunId, '.a2ui-ping-pong.json')]
        : []),
    ];
    const existingStatePath = stateCandidates.find((p) => fs.existsSync(p));
    if (!existingStatePath) {
      return Promise.resolve(false);
    }
    try {
      const state = JSON.parse(fs.readFileSync(existingStatePath, 'utf-8'));
      const stateRunId = typeof state?.runId === 'string' ? state.runId.trim() : '';
      if (effectiveRunId && stateRunId && stateRunId !== effectiveRunId) {
        return Promise.resolve(false);
      }
      const statePort = Number(state?.port || 0);
      port =
        Number.isInteger(statePort) && statePort > 0 && statePort <= 65535
          ? statePort
          : A2UI_PING_PONG_DEFAULT_PORT;
      if (!effectiveRunId && stateRunId) {
        effectiveRunId = stateRunId;
      }
    } catch {
      return Promise.resolve(false);
    }
  } else {
    port = A2UI_PING_PONG_DEFAULT_PORT;
  }

  if (!port || port <= 0) return Promise.resolve(false);
  const rawReason = String(options?.reason || 'verified').trim() || 'verified';
  const queryParams = new URLSearchParams({ reason: rawReason });
  if (effectiveRunId) {
    queryParams.set('runId', effectiveRunId);
  }
  if (resolvedWorkspaceRoot) {
    queryParams.set('workspaceRoot', resolvedWorkspaceRoot);
  }
  const timeoutMs = options?.timeoutMs !== undefined ? options.timeoutMs : 200;
  return new Promise((resolve) => {
    let settled = false;
    const finish = (closed: boolean) => {
      if (settled) return;
      settled = true;
      resolve(closed);
    };
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path: `/supersede?${queryParams.toString()}`,
        method: 'POST',
        timeout: timeoutMs,
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => {
          body += chunk.toString('utf-8');
        });
        res.on('end', () => {
          if (res.statusCode !== 200) {
            finish(false);
            return;
          }
          try {
            const parsed = JSON.parse(body);
            finish(parsed?.superseded === true);
          } catch {
            finish(body.includes('"superseded":true'));
          }
        });
      }
    );
    req.on('timeout', () => {
      req.destroy();
      finish(false);
    });
    req.on('error', () => {
      finish(false);
    });
    req.end();
  });
}
