import * as fs from 'fs';
import * as path from 'path';

/**
 * Lightweight, zero-dependency `.env.local` / `.env` loader.
 * Safely reads `.env.local` and `.env` in `cwd` (default `process.cwd()`) if present,
 * populating `envTarget[key]` only for keys not already set in `envTarget`.
 * Supports UTF-8, UTF-8 BOM, and UTF-16LE BOM (e.g. Windows PowerShell `>`).
 */
export function loadDotEnvIfExists(
  cwd: string = process.cwd(),
  envTarget: Record<string, string | undefined> = process.env
): Record<string, string> {
  const loaded: Record<string, string> = {};
  const seenKeys = new Set<string>();
  for (const fileName of ['.env.local', '.env']) {
    const filePath = path.resolve(cwd, fileName);
    if (!fs.existsSync(filePath)) continue;
    try {
      const rawBuf = fs.readFileSync(filePath);
      const rawContent =
        rawBuf.length >= 2 && rawBuf[0] === 0xff && rawBuf[1] === 0xfe
          ? rawBuf.subarray(2).toString('utf16le')
          : rawBuf.toString('utf-8').replace(/^\uFEFF/, '');
      const lines = rawContent.split(/\r?\n/);
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line || line.startsWith('#')) continue;
        const match = line.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
        if (!match) continue;
        const key = match[1];
        const rawVal = match[2].trim();
        let val = rawVal;

        if (rawVal.startsWith('"') || rawVal.startsWith("'")) {
          const quote = rawVal[0];
          const findClosingQuote = (str: string): number => {
            for (let c = 1; c < str.length; c++) {
              if (quote === '"' && str[c] === '\\') {
                c++;
                continue;
              }
              if (str[c] === quote) {
                return c;
              }
            }
            return -1;
          };

          let closeIdx = findClosingQuote(rawVal);
          let lookaheadIdx = i;
          let candidateVal = rawVal;
          while (closeIdx === -1 && lookaheadIdx + 1 < lines.length) {
            lookaheadIdx++;
            candidateVal += '\n' + lines[lookaheadIdx];
            closeIdx = findClosingQuote(candidateVal);
          }

          const trailingAfterQuote = closeIdx !== -1 ? candidateVal.slice(closeIdx + 1) : '';
          if (closeIdx !== -1 && /^\s*(?:#.*)?$/.test(trailingAfterQuote)) {
            i = lookaheadIdx;
            const inner = candidateVal.slice(1, closeIdx);
            val =
              quote === '"'
                ? inner.replace(/\\(["\\nrt])/g, (_, ch: string) => {
                    if (ch === 'n') return '\n';
                    if (ch === 'r') return '\r';
                    if (ch === 't') return '\t';
                    return ch;
                  })
                : inner;
          } else {
            const commentIdx = rawVal.search(/(?:^|\s+)#/);
            val = (commentIdx !== -1 ? rawVal.slice(0, commentIdx) : rawVal).trim();
          }
        } else {
          const commentIdx = rawVal.search(/(?:^|\s+)#/);
          val = (commentIdx !== -1 ? rawVal.slice(0, commentIdx) : rawVal).trim();
        }

        if (seenKeys.has(key)) continue;
        seenKeys.add(key);
        if (envTarget[key] === undefined) {
          envTarget[key] = val;
          loaded[key] = val;
        }
      }
    } catch {
      // Ignore unreadable dotenv file
    }
  }
  return loaded;
}

loadDotEnvIfExists();

export const GEMINI_4_ARGON_MODEL = 'gemini-4-argon' as const;
export const GEMINI_NANO_BANANA_MODEL = 'gemini-nano-banana-2.1' as const;
export const GEMINI_FLASH_TTS_MODEL = 'gemini-3.8-flash-tts' as const;
export const INTERACTIONS_API_URL = 'https://generativelanguage.googleapis.com/v1beta/interactions';
export const VOICES_API_URL = 'https://generativelanguage.googleapis.com/v1beta/voices';
export const INTERACTIONS_API_REVISION = '2026-05-20';

/**
 * Gemini 4 Argon Thinking Level (`LOW`, `MEDIUM`, `HIGH`).
 * Note: `MINIMAL` is not supported by Gemini 4 Argon, and legacy sampling parameters
 * (`temperature`, `topP`, `topK`) are deprecated and omitted.
 *
 * - HIGH: Maximizes reasoning depth. Best for Stage 1 in-depth multi-source research.
 * - MEDIUM: Balanced reasoning effort, latency, and token usage (default). Best for Stage 2 structured synthesis/scriptwriting.
 * - LOW: Minimizes latency and token usage. Best for fast tool routing & interactive approval gates.
 */
export type ThinkingLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export function normalizeThinkingLevel(
  level?: string,
  defaultLevel: ThinkingLevel = 'MEDIUM'
): ThinkingLevel {
  if (!level) return defaultLevel;
  const upper = level.trim().toUpperCase();
  if (upper === 'LOW' || upper === 'MEDIUM' || upper === 'HIGH') {
    return upper;
  }
  return defaultLevel;
}
