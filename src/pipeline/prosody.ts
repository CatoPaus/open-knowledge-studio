import * as fs from 'fs';
import * as path from 'path';

import {
  DEFAULT_ICM_LOCALE,
  type IcmLocalePack,
  type IcmProsodyLocale,
  inferBcp47LanguageCode,
  loadWorkspaceLocale,
  mergeIcmLocalePack,
} from '../interactions/index.js';
import { sanitizeSpokenScript } from './stages-text.js';

/**
 * Resolves a requested `<runId>` (exact, suffix, or substring match) or automatically selects
 * the latest run in `workspace/runs/` that has a completed Stage 2 `script_draft.json`.
 */
export function resolveDownstreamRunId(workspaceRoot: string, requestedRunId?: string): string {
  const workspacePath = path.resolve(workspaceRoot || './workspace');
  const runsRoot = path.join(workspacePath, 'runs');
  const trimmed = String(requestedRunId || '').trim();
  if (trimmed) {
    const exactDir = path.join(runsRoot, trimmed);
    if (fs.existsSync(exactDir)) return trimmed;
    if (fs.existsSync(runsRoot)) {
      const matched = fs
        .readdirSync(runsRoot, { withFileTypes: true })
        .filter((d) => d.isDirectory() && d.name !== '_dry_run')
        .map((d) => d.name)
        .find((name) => name.endsWith(`-${trimmed}`) || name.includes(trimmed));
      if (matched) return matched;
    }
    return trimmed;
  }

  if (!fs.existsSync(runsRoot)) {
    throw new Error(`No workspace/runs directory found at ${runsRoot}`);
  }
  const candidates = fs
    .readdirSync(runsRoot, { withFileTypes: true })
    .filter((d) => d.isDirectory() && d.name !== '_dry_run')
    .map((d) => {
      const fullPath = path.join(runsRoot, d.name);
      const hasStage2 = fs.existsSync(
        path.join(fullPath, 'stages', '02_script', 'output', 'script_draft.json')
      );
      const tsMatch = d.name.match(/-(\d{10,})$/);
      const sortKey = tsMatch ? Number(tsMatch[1]) : fs.statSync(fullPath).mtimeMs;
      return { name: d.name, hasStage2, sortKey };
    })
    .filter((c) => c.hasStage2)
    .sort((a, b) => b.sortKey - a.sortKey || b.name.localeCompare(a.name));

  if (candidates.length === 0) {
    throw new Error(
      `No completed Stage 2 run (stages/02_script/output/script_draft.json) found in ${runsRoot}. Run Stage 2 first via 'npm run cli:stage2 -- <runId>'.`
    );
  }
  return candidates[0].name;
}

function canonicalProsodyBaseLang(tagOrLang: string): string {
  const base = String(tagOrLang || '')
    .trim()
    .toLowerCase()
    .replace(/_/g, '-')
    .split('-')[0];
  if (base === 'nb' || base === 'nn' || base === 'no') return 'no';
  if (base === 'cmn' || base === 'yue' || base === 'zh') return 'zh';
  return base || 'en';
}

/**
 * Domain-neutral multilingual prosody & Markdown normalizer for Stage 4 neural TTS (`gemini-3.8-flash-tts`).
 * Preserves `\n\n` paragraph breaks while converting Markdown lead-ins (`**Heading:**` -> `Heading.`) and stripping
 * URLs/footnotes across all 130+ supported TTS languages. Applies symbol/unit/section verbalization using either the
 * built-in English default (`DEFAULT_ICM_LOCALE.prosody`) or a matching Layer 3 `workspace/_config/locale.json` pack,
 * preserving native symbols (`%`, `§`, `°C`, `m²`) untouched for unlocalized non-English languages so the neural TTS
 * engine pronounces them natively without splicing English words into non-English prose.
 */
export function prepareTextForStudioTts(
  text: string,
  langOrLocale?: string | Partial<IcmLocalePack>,
  workspaceRoot?: string
): string {
  const raw = String(text || '');
  if (!raw.trim()) return '';

  let targetTag = '';
  let explicitPack: Partial<IcmLocalePack> | undefined;
  if (langOrLocale && typeof langOrLocale === 'object') {
    explicitPack = langOrLocale;
    targetTag = String(langOrLocale.bcp47 || '');
  } else if (typeof langOrLocale === 'string' && langOrLocale.trim()) {
    targetTag = langOrLocale.trim();
  }
  if (!targetTag) {
    targetTag = inferBcp47LanguageCode(raw);
  }
  const targetBase = canonicalProsodyBaseLang(targetTag);

  let prosody: IcmProsodyLocale | null = null;
  if (explicitPack && explicitPack.prosody) {
    prosody = mergeIcmLocalePack(explicitPack).prosody;
  } else if (workspaceRoot) {
    const wsLocale = loadWorkspaceLocale(workspaceRoot);
    if (wsLocale.hasCustomFile && canonicalProsodyBaseLang(wsLocale.bcp47) === targetBase) {
      prosody = wsLocale.prosody;
    }
  }
  if (!prosody && targetBase === 'en') {
    prosody = DEFAULT_ICM_LOCALE.prosody;
  }

  let s = sanitizeSpokenScript(raw)
    // Strip parenthetical date-serial registry codes — both standalone `(REG-2020-05-01-42)` and comma/semicolon-joined
    // `(NFPA 72, REG-2020-05-01-42)` -> `(NFPA 72)` — while preserving standalone non-parenthetical codes used as nouns
    .replace(/[ \t]*\(\s*[A-Z]{2,5}-\d{4}-\d{2}-\d{2}-\d+\s*\)/g, '')
    .replace(/(\([^()\r\n]*?)(?:,\s*|;\s*)[A-Z]{2,5}-\d{4}-\d{2}-\d{2}-\d+\s*(?=\))/g, '$1')
    .replace(/\(\s*[A-Z]{2,5}-\d{4}-\d{2}-\d{2}-\d+\s*(?:,\s*|;\s*)(?=[^()\r\n]+\))/g, '(')
    // Convert ATX Markdown headings to clean sentence lines
    .replace(/^\s*#{1,6}\s+([^\r\n]+?)\s*$/gm, (_m, h: string) => {
      const trimmedH = h.replace(/[:\s]+$/, '').trim();
      if (!trimmedH) return '';
      return /[.!?]$/.test(trimmedH) ? trimmedH : `${trimmedH}.`;
    })
    // Convert bold topic lead-ins with trailing colon (**Heading:** or **Heading**:) into crisp sentence pauses
    .replace(/\*\*\s*([^*\r\n]*?\S):\s*\*\*[ \t]*/g, '$1. ')
    .replace(/\*\*\s*([^*\r\n]*?\S)\s*\*\*:[ \t]*/g, '$1. ')
    // Strip Markdown list bullets, inline code backticks, and remaining bold/italic wrappers
    .replace(/^\s*(?:[-*+]|\d+[.)])\s+/gm, '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*\*\s*([^*\r\n]+?)\s*\*\*\*/g, (_m, inner: string) => inner.trim())
    .replace(/\*\*\s*([^*\r\n]+?)\s*\*\*/g, (_m, inner: string) => inner.trim())
    .replace(/\*(?!\s)([^*\r\n]+?)\*/g, (_m, inner: string) => inner.trim());

  if (!prosody) {
    return s
      .replace(/[ \t]{2,}/g, ' ')
      .replace(/[ \t]*\r?\n[ \t]*/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  const p = prosody;

  // Expand statutory section symbols (preserving chapter-hyphenated IDs like 11-12, 11-13)
  s = s
    .replace(
      /§§\s*(\d+[A-Za-z]?(?:-\d+[A-Za-z]?)?)\s*(?:[–—]|\s+-\s+)\s*(\d+[A-Za-z]?(?:-\d+[A-Za-z]?)?)/g,
      (_m, a, b) => `${p.sections} ${a} ${p.to} ${b}`
    )
    .replace(/§§\s*(\d+)-(\d+)\b/g, (full, a, b, offset, str) => {
      const fullStr = String(str);
      const before = fullStr.slice(Math.max(0, Number(offset) - 28), Number(offset));
      const rest = fullStr.slice(Number(offset) + full.length);
      if (
        /\b(?:[\p{Lu}]{2,8}\s*\d+|[\p{L}]{2,6}\.)\s*$/u.test(before) ||
        /^\s*(?:,|[^\d\s,.]{1,8}\s+)\d+-/u.test(rest) ||
        Number(a) >= Number(b)
      ) {
        return `${p.sections} ${a}-${b}`;
      }
      return `${p.sections} ${a} ${p.to} ${b}`;
    })
    .replace(/§§\s*(?=\d)/g, `${p.sections} `)
    .replace(/§\s*(?=\d)/g, `${p.section} `);

  // Expand percentages, inequalities, and temperatures
  s = s
    .replace(/(\d+(?:[.,]\d+)?)\s*%/g, (_m, n) => `${n} ${p.percent}`)
    .replace(/≤\s*(\d)/g, (_m, d) => `${p.atMost} ${d}`)
    .replace(/≥\s*(\d)/g, (_m, d) => `${p.atLeast} ${d}`)
    .replace(/≤/g, ` ${p.lessOrEqual} `)
    .replace(/≥/g, ` ${p.greaterOrEqual} `)
    .replace(/±/g, ` ${p.plusOrMinus} `)
    .replace(/≈/g, ` ${p.approximately} `)
    .replace(/°C\b/g, ` ${p.degreesCelsius}`)
    .replace(/°F\b/g, ` ${p.degreesFahrenheit}`);

  // Expand configured locale abbreviations (longest keys first)
  const abbrEntries = Object.entries(p.abbreviations || {})
    .filter(([k, v]) => Boolean(k && v))
    .sort((a, b) => b[0].length - a[0].length);
  for (const [abbr, expansion] of abbrEntries) {
    const escaped = abbr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const leadBoundary = /^[\p{L}\p{N}]/u.test(abbr) ? '(?<![\\p{L}\\p{N}])' : '';
    const re = new RegExp(`${leadBoundary}${escaped}(?=\\s|$|[),;:])`, 'giu');
    s = s.replace(re, expansion);
  }

  // Expand compound word slashes (e.g. "foam-/water" -> "foam- or water", "washer/dryer" -> "washer or dryer")
  if (p.or && p.or.trim()) {
    const orWord = p.or.trim();
    s = s
      .replace(/([\p{L}]{2,})-\/([\p{L}]{2,})/gu, (_m, a: string, b: string) => `${a}- ${orWord} ${b}`)
      .replace(
        /(?<![:/\p{L}\p{N}$.])([\p{L}]{3,})\/([\p{L}]{3,})(?![/\p{L}\p{N}])/gu,
        (_m, a: string, b: string) => `${a} ${orWord} ${b}`
      );
  }

  // Expand physical units following numeric quantities
  s = s
    .replace(
      /(\b\d+(?:[.,]\d+)?)\s*dB(?:\(A\))?(?![A-Za-z0-9])/g,
      (_m, n) => `${n} ${p.decibels}`
    )
    .replace(
      /(\b\d+(?:[.,]\d+)?)\s*m(?:²|\^2)(?![A-Za-z0-9])/g,
      (_m, n) => `${n} ${p.squareMeters}`
    )
    .replace(
      /(\b\d+(?:[.,]\d+)?)\s*m(?:³|\^3)(?![A-Za-z0-9])/g,
      (_m, n) => `${n} ${p.cubicMeters}`
    )
    .replace(
      /(\b\d+(?:[.,]\d+)?)\s+kg(?=[.,;:!?)\]\s]|$)(?!\s*\/)/g,
      (_m, n) => `${n} ${p.kilograms}`
    )
    .replace(
      /(\b\d+(?:[.,]\d+)?)\s+cm(?=[.,;:!?)\]\s]|$)(?!\s*\/)/g,
      (_m, n) => `${n} ${p.centimeters}`
    )
    .replace(
      /(\b\d+(?:[.,]\d+)?)\s+mm(?=[.,;:!?)\]\s]|$)(?!\s*\/)/g,
      (_m, n) => `${n} ${p.millimeters}`
    )
    .replace(
      /(?<!\$)(\b\d+(?:[.,]\d+)?)\s+m(?=[.,;:!?)\]\s]|$)(?!\s*\/)/g,
      (_m, n) => `${n} ${n === '1' ? p.meter : p.meters}`
    );

  return s
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/[ \t]*\r?\n[ \t]*/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function stripMarkdownForTts(text: string): string {
  return prepareTextForStudioTts(text);
}
