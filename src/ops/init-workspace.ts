import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

export interface InitOksWorkspaceOptions {
  overwrite?: boolean;
}

export interface InitOksWorkspaceResult {
  targetDir: string;
  createdFiles: string[];
  skippedFiles: string[];
}

const STARTER_REL_PATHS = [
  'prompts/01_research.md',
  'prompts/02_script.md',
  'workspace/GEMINI.md',
  'workspace/CONTEXT.md',
  'workspace/_config/voice_guide.md',
  'workspace/bundle/index.md',
  'workspace/bundle/log.md',
  '.gitignore',
] as const;

/**
 * Initializes a lightweight Open Knowledge Studio workspace (`prompts/` + `workspace/`)
 * in `targetDir` using the starter files bundled with this plugin/repository, without
 * copying `src/`, `specification/`, or `node_modules/`.
 */
export function initOksWorkspace(
  targetDir: string = process.cwd(),
  options?: InitOksWorkspaceOptions
): InitOksWorkspaceResult {
  const engineRoot = fileURLToPath(new URL('../..', import.meta.url));
  const resolvedTarget = path.resolve(targetDir);
  fs.mkdirSync(resolvedTarget, { recursive: true });
  fs.mkdirSync(path.join(resolvedTarget, 'workspace', 'bundle', 'research'), { recursive: true });
  fs.mkdirSync(path.join(resolvedTarget, 'workspace', 'runs'), { recursive: true });

  const createdFiles: string[] = [];
  const skippedFiles: string[] = [];
  const today = new Date().toISOString().slice(0, 10);

  for (const relPath of STARTER_REL_PATHS) {
    const srcFile = path.join(engineRoot, relPath);
    const dstFile = path.join(resolvedTarget, relPath);
    if (!fs.existsSync(srcFile)) continue;
    if (fs.existsSync(dstFile) && !options?.overwrite) {
      skippedFiles.push(relPath);
      continue;
    }
    fs.mkdirSync(path.dirname(dstFile), { recursive: true });
    if (relPath === 'workspace/bundle/log.md') {
      fs.writeFileSync(
        dstFile,
        `# Directory Update Log\n\n## ${today}\n* **Initialization**: Initialized OKF v0.3 workspace knowledge bundle (\`workspace/bundle/\`).\n`,
        'utf-8'
      );
    } else {
      fs.copyFileSync(srcFile, dstFile);
    }
    createdFiles.push(relPath);
  }

  return {
    targetDir: resolvedTarget,
    createdFiles,
    skippedFiles,
  };
}
