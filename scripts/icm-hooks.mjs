import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const engineRoot = path.resolve(__dirname, '..');

const mode = process.argv[2];
const isPluginInvocation = process.argv.includes('--source=plugin');

function readStdinJson() {
  try {
    const raw = fs.readFileSync(0, 'utf-8');
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function resolveActiveWorkspace(payload) {
  const candidates = [
    ...(Array.isArray(payload?.workspacePaths) ? payload.workspacePaths : []),
    payload?.cwd,
  ];
  for (const raw of candidates) {
    if (typeof raw === 'string' && raw.trim()) {
      const trimmed = raw.trim();
      let resolved;
      if (/^file:\/\//i.test(trimmed)) {
        try {
          resolved = fileURLToPath(trimmed);
        } catch {
          continue;
        }
      } else {
        resolved = path.resolve(trimmed);
      }
      if (resolved && fs.existsSync(resolved)) return resolved;
    }
  }
  return engineRoot;
}

function isOksWorkspace(wsRoot) {
  return (
    fs.existsSync(path.join(wsRoot, 'workspace', 'GEMINI.md')) ||
    fs.existsSync(path.join(wsRoot, 'prompts', '01_research.md'))
  );
}

function hasLocalWorkspaceHooks(wsRoot) {
  return fs.existsSync(path.join(wsRoot, '.agents', 'hooks.json'));
}

if (mode === 'session-start') {
  const payload = readStdinJson();
  const activeWorkspace = resolveActiveWorkspace(payload);

  // Silent no-op when installed globally as a plugin and opened inside a non-OKS project
  if (!isOksWorkspace(activeWorkspace)) {
    process.stdout.write(JSON.stringify({}));
    process.exit(0);
  }

  // Avoid duplicate injection when both global plugin and local .agents/hooks.json are active
  if (isPluginInvocation && hasLocalWorkspaceHooks(activeWorkspace)) {
    process.stdout.write(JSON.stringify({}));
    process.exit(0);
  }

  const runsDir = path.join(activeWorkspace, 'workspace', 'runs');
  let latestRunInfo = 'No runs executed yet in workspace/runs/.';
  if (fs.existsSync(runsDir)) {
    const runFolders = fs
      .readdirSync(runsDir)
      .filter((name) => name !== '_dry_run' && !name.startsWith('.'))
      .map((name) => {
        const full = path.join(runsDir, name);
        try {
          const stat = fs.statSync(full);
          return stat.isDirectory() ? { name, mtimeMs: stat.mtimeMs } : null;
        } catch {
          return null;
        }
      })
      .filter(Boolean)
      .sort((a, b) => b.mtimeMs - a.mtimeMs);

    if (runFolders.length > 0) {
      const latest = runFolders[0].name;
      const metaPath = path.join(runsDir, latest, 'meta.json');
      let status = 'unknown';
      let topic = '';
      if (fs.existsSync(metaPath)) {
        try {
          const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
          status = meta.status || 'unknown';
          topic = meta.topic || '';
        } catch {
          // ignore
        }
      }
      latestRunInfo = `Latest run: "${latest}" (status: ${status}${topic ? `, topic: "${topic}"` : ''}). Total runs: ${runFolders.length}.`;
    }
  }

  const projectFolderName = path.basename(activeWorkspace);
  const isBaseTemplateFolder = ['open-knowledge-studio', 'icm', 'jolly-hertz'].includes(
    projectFolderName.toLowerCase()
  );
  const folderSignalLine = isBaseTemplateFolder
    ? `- Project Folder Name: "${projectFolderName}" (default template repository name — ask the user what target domain they want to specialize for in Question 1 rather than inferring a domain from "${projectFolderName}").`
    : `- Project Folder Name (Domain Signal): "${projectFolderName}" (use this folder name to infer the user's likely project domain and pre-populate tailored "(Recommended)" options when asking Question 1 via ask_question).`;

  const hasLocalCliScripts = fs.existsSync(path.join(activeWorkspace, 'bin', 'oks.mjs'));
  const cliHint = hasLocalCliScripts
    ? '- Engine CLI: Run via `npm run cli:stage1`, `cli:verify`, `cli:stage2`, `cli:stage3`, `cli:stage4`, `cli:status`, `cli:validate` (or `node bin/oks.mjs`).'
    : `- Plugin Engine CLI (Zero-Dependency): \`node "${path.join(engineRoot, 'bin', 'oks.mjs').replace(/\\/g, '/')}" --cwd "${activeWorkspace.replace(/\\/g, '/')}"\` (plus \`open-knowledge-studio\` MCP tools).`;

  const msg = [
    '[ICM Co-Architect Session Context]',
    `- Workspace Root: ${activeWorkspace}`,
    folderSignalLine,
    `- ${latestRunInfo}`,
    cliHint,
    '- Pure ICM Filesystem Traces: Every stage writes input/prompt_assembled.md, output/thinking_trace.md, and token telemetry in workspace/runs/<runId>/meta.json.',
    '- Reminder: Activate the `icm-co-architect` skill and follow the one-question / one-stage-at-a-time workflow. Never dump multi-step plans before testing Stage 1.',
  ].join('\n');

  process.stdout.write(
    JSON.stringify({
      injectSteps: [
        {
          systemMessage: {
            systemMessage: msg,
          },
        },
      ],
    })
  );
  process.exit(0);
}

if (mode === 'pre-tool-use') {
  const payload = readStdinJson();
  const activeWorkspace = resolveActiveWorkspace(payload);

  if (!isOksWorkspace(activeWorkspace)) {
    process.stdout.write(JSON.stringify({ decision: 'allow' }));
    process.exit(0);
  }
  if (isPluginInvocation && hasLocalWorkspaceHooks(activeWorkspace)) {
    process.stdout.write(JSON.stringify({ decision: 'allow' }));
    process.exit(0);
  }

  const args = payload?.toolCall?.args || {};
  const targetPath = String(args.Path || '');
  const contentToWrite = String(args.Content || args.Replacement || '');

  const normalizedPath = targetPath.replace(/\\/g, '/');
  const isPromptOrSource =
    normalizedPath.includes('/prompts/') || normalizedPath.includes('/src/');

  if (isPromptOrSource && contentToWrite) {
    const forbiddenModelMatch = contentToWrite.match(/gemini-(1\.5|2\.0|2\.5|3\.0|3\.5)/i);
    if (forbiddenModelMatch) {
      process.stdout.write(
        JSON.stringify({
          decision: 'deny',
          reason: `Blocked by ICM Argon Guard: Legacy model "${forbiddenModelMatch[0]}" is forbidden. Use only "gemini-4-argon".`,
        })
      );
      process.exit(0);
    }

    const isPromptFile = normalizedPath.includes('/prompts/');
    const forbiddenSamplingMatch = contentToWrite.match(/\b(temperature|topP|topK)\s*:/);
    if (isPromptFile && forbiddenSamplingMatch) {
      process.stdout.write(
        JSON.stringify({
          decision: 'deny',
          reason: `Blocked by ICM Argon Guard: Sampling parameter "${forbiddenSamplingMatch[1]}" is forbidden on Gemini 4 Argon. Use thinkingConfig.thinkingLevel (LOW | MEDIUM | HIGH) instead.`,
        })
      );
      process.exit(0);
    }
  }

  process.stdout.write(JSON.stringify({ decision: 'allow' }));
  process.exit(0);
}

process.stdout.write(JSON.stringify({}));
