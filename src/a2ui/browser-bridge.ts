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
  htmlOutputPath: string;
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

    if (input.htmlOutputPath && fs.existsSync(input.htmlOutputPath)) {
      artifactHtmlPath = path.join(resolvedDir, 'a2ui_studio.html');
      fs.copyFileSync(input.htmlOutputPath, artifactHtmlPath);
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
  payload: Record<string, any>;
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
  const workspaceRoot = path.resolve(options?.workspaceRoot || './workspace');
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
        handled = true;
        const reason = String(parsedUrl.searchParams.get('reason') || '').trim();
        const normalizedReason = reason || 'newer_listener';
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
          const normalizedPayload: Record<string, any> =
            parsed?.callAgentFunction?.callFunction?.args &&
            typeof parsed.callAgentFunction.callFunction.args === 'object'
              ? parsed.callAgentFunction.callFunction.args
              : parsed;
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
}): Promise<boolean> {
  const port = options?.port !== undefined ? options.port : A2UI_PING_PONG_DEFAULT_PORT;
  if (!port || port <= 0) return Promise.resolve(false);
  const reason = encodeURIComponent(String(options?.reason || 'verified').trim() || 'verified');
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
        path: `/supersede?reason=${reason}`,
        method: 'POST',
        timeout: timeoutMs,
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => {
          body += chunk.toString('utf-8');
        });
        res.on('end', () => {
          finish(res.statusCode === 200 && body.includes('"superseded":true'));
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
