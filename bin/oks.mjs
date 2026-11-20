#!/usr/bin/env node
/**
 * Zero-dependency Open Knowledge Studio CLI Launcher (`bin/oks.mjs`).
 * Runs `src/index.ts` directly on Node.js >= 22.15 / 24+ using built-in TypeScript
 * type-stripping and `node:module` `registerHooks` — requiring ZERO `npm install` or `node_modules`.
 *
 * Supports `--cwd <projectDir>` so an installed Antigravity/Claude/Codex plugin can execute
 * Stage 1–4, `verify`, `a2ui`, `viz`, `status`, `validate-bundle`, or `init` against any folder.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
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

const cwdFlagIdx = process.argv.indexOf('--cwd');
if (cwdFlagIdx !== -1 && process.argv[cwdFlagIdx + 1]) {
  const targetCwd = path.resolve(process.argv[cwdFlagIdx + 1]);
  process.argv.splice(cwdFlagIdx, 2);
  if (fs.existsSync(targetCwd)) {
    process.chdir(targetCwd);
  }
}

const { loadDotEnvIfExists } = await import('../src/interactions/env.ts');
loadDotEnvIfExists(process.cwd());
const homeGeminiDir = path.join(os.homedir(), '.gemini');
if (!process.env.GEMINI_API_KEY && fs.existsSync(homeGeminiDir)) {
  loadDotEnvIfExists(homeGeminiDir);
}

await import('../src/index.ts');
