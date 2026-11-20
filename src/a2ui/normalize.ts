import { type IcmLocalePack, formatLocaleTemplate, mergeIcmLocalePack } from '../interactions/index.js';
import { stripFootnotesPreservingWordBoundaries } from '../okf/index.js';
import type { A2uiChecklistGroup, A2uiChecklistItem } from './types.js';

/**
 * Determines whether a `$...$` candidate inner substring is genuine inline LaTeX math
 * rather than a pair of currency `$` signs or a span crossing Markdown table pipes / footnotes.
 */
export function isInlineLatexMathSpan(inner: string): boolean {
  if (!inner || typeof inner !== 'string') return false;
  if (/^\s|\s$/.test(inner)) return false;
  if (/[\r\n|]/.test(inner)) return false;
  if (inner.includes('[^')) return false;
  if (/\*\*|__/.test(inner)) return false;
  if (/(?:^|[^\\])~$/.test(inner)) return false;
  if (/^[A-Z]{1,5}\/[A-Z]{1,5}$/.test(inner)) return true;
  if (/^[a-zA-Z]$/.test(inner)) return true;
  if (/^\d+\.\d{3,}$/.test(inner)) return true;
  if (/^[a-zA-Z](?:_[a-zA-Z0-9]+)?\s*(?:=|<|>|<=|>=|≈|~|±)\s*[+-]?\d+(?:[.,]\d+)?%?$/.test(inner)) return true;
  if (
    /^\d[\d,.]*(?:\s*(?:[BMKTbmkt](?![\^_])\b|billion|million|trillion|thousand|bn\b|mn\b|\/(?![a-zA-Z0-9_()]*[\^_\\])|\s+(?:per|to|and|or|in|at|for|from|of|vs)\b|-|–|—|\)|\s*$))/i.test(
      inner
    )
  ) {
    return false;
  }
  if (
    !/(?:\\[a-zA-Z !,;:%$&_#]|[A-Za-z0-9)\]}][\^_](?:\{[^{}\r\n]+\}|[A-Za-z0-9+\-°]))/.test(inner)
  ) {
    return false;
  }
  if (/^\d/.test(inner)) {
    if (
      !/^\d+(?:[.,]\d+)*(?:\s*[+\-*/]?\s*(?:\\|[\^_])|\s+[a-zA-Z]{1,4}[\^_]|\s*[*/]\s*[a-zA-Z0-9()]+\s*[\^_])/.test(
        inner
      ) &&
      !/^0\.\d{3,}$/.test(inner)
    ) {
      return false;
    }
  }
  return true;
}

/**
 * Safely scans a string for inline `$...$` and display `$$...$$` LaTeX math spans without allowing a rejected currency `$`
 * earlier on a line to consume the opening `$` of a valid inline math span later on the same line,
 * and never matching across Markdown table pipes (`|`) or line breaks.
 */
export function replaceInlineLatexSpansTs(
  str: string,
  replacer: (fullMatch: string, inner: string) => string
): string {
  const s = String(str || '');
  let out = '';
  let i = 0;
  while (i < s.length) {
    const ch = s[i];
    if (ch === '\\' && i + 1 < s.length && s[i + 1] === '$') {
      out += s.slice(i, i + 2);
      i += 2;
      continue;
    }
    if (ch !== '$') {
      out += ch;
      i++;
      continue;
    }
    if (i + 1 < s.length && s[i + 1] === '$') {
      let j = i + 2;
      while (j + 1 < s.length) {
        if (s[j] === '\\' && j + 1 < s.length) {
          j += 2;
          continue;
        }
        if (s[j] === '$' && s[j + 1] === '$') {
          break;
        }
        if (s[j] === '|' || (s[j] === '\n' && /^\r?\n\s*\r?\n/.test(s.slice(j)))) {
          break;
        }
        j++;
      }
      if (j + 1 < s.length && s[j] === '$' && s[j + 1] === '$') {
        const innerDisp = s.slice(i + 2, j).replace(/\s+/g, ' ').trim();
        if (isInlineLatexMathSpan(innerDisp)) {
          out += replacer(s.slice(i, j + 2), innerDisp);
          i = j + 2;
          continue;
        }
      }
    }
    let j = i + 1;
    while (j < s.length) {
      if (s[j] === '\\' && j + 1 < s.length) {
        j += 2;
        continue;
      }
      if (s[j] === '$' || s[j] === '\n' || s[j] === '\r' || s[j] === '|') {
        break;
      }
      j++;
    }
    if (j < s.length && s[j] === '$') {
      const inner = s.slice(i + 1, j);
      if (isInlineLatexMathSpan(inner)) {
        out += replacer(s.slice(i, j + 1), inner);
        i = j + 1;
        continue;
      }
    }
    out += '$';
    i++;
  }
  return out;
}

/**
 * Strips OKF footnote markers (`[^id]`), inline LaTeX math (`$\text{CO}_2$`, `$30 \text{ min}$`, `$\rightarrow$`),
 * and excess Markdown formatting from extracted checklist items for clean UI labels while preserving currency `$`.
 */
export function cleanChecklistLabel(rawText: string): string {
  const supMap: Record<string, string> = {
    '0': '⁰',
    '1': '¹',
    '2': '²',
    '3': '³',
    '4': '⁴',
    '5': '⁵',
    '6': '⁶',
    '7': '⁷',
    '8': '⁸',
    '9': '⁹',
    '+': '⁺',
    '-': '⁻',
    '=': '⁼',
    '(': '⁽',
    ')': '⁾',
    a: 'ᵃ',
    b: 'ᵇ',
    c: 'ᶜ',
    d: 'ᵈ',
    e: 'ᵉ',
    f: 'ᶠ',
    g: 'ᵍ',
    h: 'ʰ',
    i: 'ⁱ',
    j: 'ʲ',
    k: 'ᵏ',
    l: 'ˡ',
    m: 'ᵐ',
    n: 'ⁿ',
    o: 'ᵒ',
    p: 'ᵖ',
    r: 'ʳ',
    s: 'ˢ',
    t: 'ᵗ',
    u: 'ᵘ',
    v: 'ᵛ',
    w: 'ʷ',
    x: 'ˣ',
    y: 'ʸ',
    z: 'ᶻ',
  };
  const subMap: Record<string, string> = {
    '0': '₀',
    '1': '₁',
    '2': '₂',
    '3': '₃',
    '4': '₄',
    '5': '₅',
    '6': '₆',
    '7': '₇',
    '8': '₈',
    '9': '₉',
    '+': '₊',
    '-': '₋',
    '=': '₌',
    '(': '₍',
    ')': '₎',
    a: 'ₐ',
    e: 'ₑ',
    h: 'ₕ',
    i: 'ᵢ',
    j: 'ⱼ',
    k: 'ₖ',
    l: 'ₗ',
    m: 'ₘ',
    n: 'ₙ',
    o: 'ₒ',
    p: 'ₚ',
    r: 'ᵣ',
    s: 'ₛ',
    t: 'ₜ',
    u: 'ᵤ',
    v: 'ᵥ',
    x: 'ₓ',
  };
  const cleanLatexFragment = (frag: string, isInsideMathSpan: boolean): string => {
    let out = String(frag || '')
      .replace(/\\(?:left|right)\s*([()[\]|.])?/g, '$1')
      .replace(/\\mathcal\{R\}/g, 'ℛ')
      .replace(/\\mathcal\{([A-Za-z0-9]+)\}/g, '$1')
      .replace(/\\(?:[,;:]|\s+|quad\b|qquad\b)/g, ' ')
      .replace(/\\!/g, '')
      .replace(/\\sim(?![a-zA-Z])/g, '~')
      .replace(/\\leftrightarrow/g, '↔')
      .replace(/\\Leftrightarrow|\\iff(?![a-zA-Z])/g, '⇔')
      .replace(/\\rightarrow|\\to(?![a-zA-Z])/g, '→')
      .replace(/\\Rightarrow|\\implies(?![a-zA-Z])/g, '⇒')
      .replace(/\\leftarrow/g, '←')
      .replace(/\\Leftarrow/g, '⇐')
      .replace(/\\(?:ge|geq)(?![a-zA-Z])/g, '≥')
      .replace(/\\(?:le|leq)(?![a-zA-Z])/g, '≤')
      .replace(/\\(?:neq|ne)(?![a-zA-Z])/g, '≠')
      .replace(/\\approx(?![a-zA-Z])/g, '≈')
      .replace(/\\times(?![a-zA-Z])/g, '×')
      .replace(/\\div(?![a-zA-Z])/g, '÷')
      .replace(/\\pm(?![a-zA-Z])/g, '±')
      .replace(/\\cdot(?![a-zA-Z])/g, '·')
      .replace(/\\(?:dots|ldots|cdots)(?![a-zA-Z])/g, '…')
      .replace(/\\infty(?![a-zA-Z])/g, '∞')
      .replace(/\\sum(?![a-zA-Z])/g, '∑')
      .replace(/\\prod(?![a-zA-Z])/g, '∏')
      .replace(/\\int(?![a-zA-Z])/g, '∫')
      .replace(/\\partial(?![a-zA-Z])/g, '∂')
      .replace(/\\nabla(?![a-zA-Z])/g, '∇')
      .replace(/\\propto(?![a-zA-Z])/g, '∝')
      .replace(/\\perp(?![a-zA-Z])/g, '⊥')
      .replace(/\\parallel(?![a-zA-Z])/g, '∥')
      .replace(/\\Delta\s+([a-zA-Z])(?![a-zA-Z])/g, 'Δ$1')
      .replace(/\\Delta(?![a-zA-Z])/g, 'Δ')
      .replace(/\\delta(?![a-zA-Z])/g, 'δ')
      .replace(/\\mu(?![a-zA-Z])/g, 'μ')
      .replace(/\\Omega(?![a-zA-Z])/g, 'Ω')
      .replace(/\\omega(?![a-zA-Z])/g, 'ω')
      .replace(/\\alpha(?![a-zA-Z])/g, 'α')
      .replace(/\\beta(?![a-zA-Z])/g, 'β')
      .replace(/\\gamma(?![a-zA-Z])/g, 'γ')
      .replace(/\\lambda(?![a-zA-Z])/g, 'λ')
      .replace(/\\pi(?![a-zA-Z])/g, 'π')
      .replace(/\\sigma(?![a-zA-Z])/g, 'σ')
      .replace(/\\rho(?![a-zA-Z])/g, 'ρ')
      .replace(/\\theta(?![a-zA-Z])/g, 'θ')
      .replace(/\\tau(?![a-zA-Z])/g, 'τ')
      .replace(/\\phi(?![a-zA-Z])|\\varphi(?![a-zA-Z])/g, 'φ')
      .replace(/\\eta(?![a-zA-Z])/g, 'η')
      .replace(/\\kappa(?![a-zA-Z])/g, 'κ')
      .replace(/\\epsilon(?![a-zA-Z])|\\varepsilon(?![a-zA-Z])/g, 'ε')
      .replace(/\\(?:ln|exp|log|sin|cos|tan|min|max|lim|sup|inf)(?![a-zA-Z])/g, (m) => m.slice(1))
      .replace(/\\(?:circ|degree)(?![a-z])/g, '°')
      .replace(/\\([$&%_#])/g, '$1');
    for (let pass = 0; pass < 3; pass++) {
      out = out
        .replace(/\\(?:text|mathrm|textbf|textit|mathit|mathsf|emph|operatorname)\{([^{}]*)\}/g, '$1')
        .replace(/\\(?:xrightleftharpoons|rightleftharpoons)(?:\[[^\]]*\])?(?:\{[^{}]*\})?/g, '⇌')
        .replace(/\\(?:xrightarrow|xleftarrow)(?:\[[^\]]*\])?(?:\{[^{}]*\})?/g, '→')
        .replace(/\\sqrt\{\s*([^{}]+?)\s*\}/g, '√($1)')
        .replace(/\\(?:overline|hat|bar|tilde|vec)\{\s*([^{}]+?)\s*\}/g, '$1')
        .replace(/\^\{\s*(?:°|o)\s*([CFK])?\s*\}|\^°/g, '°$1')
        .replace(
          /\^\{\s*([0-9+\-=()a-pr-z]+)\s*\}|\^([0-9+\-a-pr-z])(?![a-zA-Z0-9])/g,
          (_m, b: string, s: string) =>
            String(b || s).replace(/[0-9+\-=()a-pr-z]/g, (d) => supMap[d] || d)
        )
        .replace(/_\{\s*([+-]?[0-9]+|[+-=()]+)\s*\}/g, (_m, b: string) =>
          String(b).replace(/[0-9+\-=()]/g, (d) => subMap[d] || d)
        );
      if (isInsideMathSpan) {
        out = out
          .replace(/~/g, ' ')
          .replace(/_([+-]?[0-9])(?![0-9])/g, (_sub, s: string) =>
            String(s).replace(/[0-9+-]/g, (d) => subMap[d] || d)
          )
          .replace(
            /_\{\s*([aehijklmnoprstuvx]+)\s*\}|_([aehijklmnoprstuvx])(?![a-zA-Z0-9])/g,
            (_m, b: string, s: string) =>
              String(b || s).replace(/[aehijklmnoprstuvx]/g, (d) => subMap[d] || d)
          )
          .replace(/_\{\s*([^{}]+?)\s*\}/g, '_$1')
          .replace(/\^\{\s*([^{}]+?)\s*\}/g, '^$1');
      }
      out = out.replace(/\\frac\{\s*([^{}]+?)\s*\}\{\s*([^{}]+?)\s*\}/g, '$1/$2');
    }
    return out.replace(/\\([{}])/g, '$1');
  };

  let text = String(rawText || '').trim();
  // Remove footnote references like [^primary-source], [^1] while preserving word boundaries
  text = stripFootnotesPreservingWordBoundaries(text);
  // Process inline TeX math spans $...$ / $$...$$ safely without consuming currency $ pairs
  text = replaceInlineLatexSpansTs(text, (_m, inner: string) =>
    cleanLatexFragment(inner, true).trim()
  );
  // Clean any remaining bare LaTeX macros/superscripts outside $...$
  text = cleanLatexFragment(text, false);
  // Convert bare chemical/variable subscripts outside $...$ (e.g. CO_2, H_2O, O_2, NO_x, A_2) while preserving snake_case like zone_2
  text = text.replace(
    /\b(CO|H|O|N|SO|NO|CH|NH|SF|[A-Z])_([0-9]|x)(?![a-zA-Z0-9])/g,
    (_m, prefix: string, s: string) => `${prefix}${subMap[s] || s}`
  );
  // Convert markdown links [label](url) -> label
  text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
  // Strip inline code backticks, bold-italic, bold, and italic markers without stripping spaced multiplication asterisks (e.g. "2 * 3 * 4")
  text = text
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*\*(?!\s)([^*]*?\S)\*\*\*/g, '$1')
    .replace(/\*\*(?!\s)([^*]*?\S)\*\*/g, '$1')
    .replace(/\*(?!\s)([^*]*?\S)\*/g, '$1');
  // Normalize whitespace and trailing punctuation spacing
  text = text.replace(/\s+/g, ' ').replace(/\s+([.,;:?!])/g, '$1').trim();
  return text;
}

/**
 * Extracts structured checklist groups and items (`- [ ] ...` or `- [x] ...`) from OKF Markdown,
 * supporting Markdown headings (`### ...`), nested category bullets (`- [ ] **Category**:`),
 * and multi-level (2-level / 3-level+) hierarchical task lists.
 */
export function extractChecklistGroupsFromMarkdown(
  rawMarkdown: string,
  locale?: Partial<IcmLocalePack> | null
): A2uiChecklistGroup[] {
  const loc = mergeIcmLocalePack(locale);
  const defaultHeading = loc.ui.checklistDefaultHeading;
  const defaultGroupFallback = loc.ui.checklistDefaultGroup;
  const lines = String(rawMarkdown || '').split(/\r?\n/);
  const groups: A2uiChecklistGroup[] = [];
  let currentHeading = defaultHeading;
  const categoryStack: Array<{ indent: number; title: string }> = [];
  let sectionGroupStartIdx = 0;
  let itemCounter = 0;

  const getOrCreateGroup = (title: string): A2uiChecklistGroup => {
    const cleanTitle =
      cleanChecklistLabel(title.replace(/\*\*([^*]+)\*\*/g, '$1').replace(/:+\s*$/, '')) ||
      defaultGroupFallback;
    for (let gIdx = groups.length - 1; gIdx >= sectionGroupStartIdx; gIdx--) {
      if (groups[gIdx].title === cleanTitle) {
        return groups[gIdx];
      }
    }
    const created: A2uiChecklistGroup = {
      id: `chk_grp_${groups.length + 1}`,
      title: cleanTitle,
      items: [],
    };
    groups.push(created);
    return created;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const headingMatch = line.match(/^(#{2,4})\s+(.+?)\s*$/);
    if (headingMatch) {
      currentHeading = headingMatch[2].replace(/^\d+(\.\d+)*\.?\s*/, '').trim();
      categoryStack.length = 0;
      sectionGroupStartIdx = groups.length;
      continue;
    }

    const checkboxMatch = line.match(/^(\s*)(?:[-*+]|\d+[.)])\s+\[([ xX])\]\s+(.+?)\s*$/);
    if (!checkboxMatch) continue;

    const indent = checkboxMatch[1].length;
    const isChecked = checkboxMatch[2].toLowerCase() === 'x';
    const rawContent = checkboxMatch[3].trim();

    // Pop any category headers at the same or deeper indentation level
    while (categoryStack.length > 0 && categoryStack[categoryStack.length - 1].indent >= indent) {
      categoryStack.pop();
    }

    // Check if this is a parent category line followed by deeper-indented sub-checkboxes
    let hasIndentedSubItems = false;
    for (let j = i + 1; j < lines.length; j++) {
      const nextLine = lines[j];
      if (!nextLine.trim()) continue;
      const nextCheckbox = nextLine.match(/^(\s*)(?:[-*+]|\d+[.)])\s+\[([ xX])\]\s+(.+?)\s*$/);
      if (nextCheckbox && nextCheckbox[1].length > indent) {
        hasIndentedSubItems = true;
      }
      break;
    }

    const contentWithoutFootnotes = stripFootnotesPreservingWordBoundaries(rawContent).trim();
    const isBoldColonHeader = /^\*\*[^*]+\*\*:?\s*$/.test(contentWithoutFootnotes);

    if (isBoldColonHeader || hasIndentedSubItems) {
      const headerTitle = cleanChecklistLabel(
        contentWithoutFootnotes.replace(/\*\*([^*]+)\*\*/g, '$1').replace(/:+\s*$/, '').trim()
      );
      if (headerTitle) {
        categoryStack.push({ indent, title: headerTitle });
      }
      continue;
    }

    let groupTitle = currentHeading;
    const rawItemText = rawContent;

    if (categoryStack.length > 0) {
      const stackTitle = categoryStack.map((c) => c.title).join(' — ');
      groupTitle =
        currentHeading &&
        currentHeading !== defaultHeading &&
        !stackTitle.startsWith(currentHeading)
          ? `${currentHeading} — ${stackTitle}`
          : stackTitle;
    }

    const cleanedLabel = cleanChecklistLabel(rawItemText);
    if (!cleanedLabel) continue;
    itemCounter++;
    const group = getOrCreateGroup(groupTitle);

    group.items.push({
      id: `chk_item_${itemCounter}`,
      label: cleanedLabel,
      checked: isChecked,
      category: group.title,
    });
  }

  return groups.filter((g) => g.items.length > 0);
}

export interface NormalizedA2uiDialogueTurn {
  speaker?: string;
  text: string;
  style?: string;
}

export interface NormalizedA2uiModule {
  id: string;
  number: number;
  title: string;
  subtitleOrBasis: string;
  durationOrMeta: string;
  narration: string;
  spokenNarration?: string;
  dialogueTurns?: NormalizedA2uiDialogueTurn[];
  actionItem: string;
  bullets: string[];
  visualPrompt?: string;
  imageUrl?: string;
  imageCaption?: string;
  audioUrl?: string;
  audioVoices?: string;
}

export interface NormalizedA2uiQuizQuestion {
  id: string;
  question: string;
  options: Array<{ label: string; value: string }>;
  correctValue: string;
  explanation: string;
  sourceModule?: string;
}

export interface NormalizedA2uiCaseItem {
  id: string;
  title: string;
  basisOrContext: string;
  scenario: string;
  recommendedAction: string;
}

/**
 * Splits a single monolithic wall of prose (`> 420` characters with no `\n\n` paragraph breaks)
 * into readable 2–3 sentence paragraphs while preserving existing multi-paragraph text intact.
 */
export function formatSingleWallParagraphs(text: string): string {
  const raw = String(text || '').trim();
  if (
    !raw ||
    /\r?\n\s*\r?\n/.test(raw) ||
    raw.length <= 420 ||
    /(?:^|\r?\n)\s*(?:#{1,6}\s|[-*+]\s|\d+[.)]\s|\|)/.test(raw)
  ) {
    return raw;
  }
  const abbrevToken = '\u0000';
  const protectedText = raw.replace(
    /\b(e\.g|i\.e|vs|approx|ca|cf|al|Fig|Eq|No|Dr|Mr|Mrs|Ms|Prof|Inc|Corp|Ltd|Co|St|Jr|Sr|U\.S|Ph\.D)\.\s+/gi,
    `$1.${abbrevToken}`
  );
  const sentences = protectedText
    .split(/(?<=[.!?])\s+(?=[\p{Lu}"“'(\[$~+\-0-9])/u)
    .map((s) => s.replaceAll(abbrevToken, ' ').trim())
    .filter(Boolean);
  if (sentences.length < 4) {
    return raw;
  }
  const paragraphs: string[] = [];
  let current: string[] = [];
  let currentLen = 0;
  for (let i = 0; i < sentences.length; i++) {
    const s = sentences[i];
    current.push(s);
    currentLen += s.length;
    const remaining = sentences.length - 1 - i;
    if (
      (current.length >= 3 || (current.length >= 2 && currentLen >= 280)) &&
      remaining >= 2
    ) {
      paragraphs.push(current.join(' '));
      current = [];
      currentLen = 0;
    }
  }
  if (current.length > 0) {
    paragraphs.push(current.join(' '));
  }
  return paragraphs.join('\n\n');
}

/**
 * Normalizes any Stage 2 `script_draft.json` payload into A2UI data model structures.
 * Works seamlessly across:
 * - Generic Stage 2 output (`{ title, scriptBody, estimatedDuration }`)
 * - Domain compliance studios (`trainingModules`, `keyTakeaways`, `boardActionItem`)
 * - Course studios (`lessons`, `learningObjectives`, `slideCues`, `quizQuestion`/`quizOptions`)
 * - Analytical / IC / decision memos (`pillars`/`analysisPillars`/`sections`, `thesisPoints`/`keyTakeaways`, `recommendation`/`icDirective`, `stressTests`/`scenarios`)
 * - Custom schemas with `modules`, `slides`, `cases`, `scenarios`, or `quiz`/`questions` arrays.
 */
export function normalizeStage2ForA2ui(
  scriptDraft: Record<string, unknown> | null,
  fallbackTitle: string,
  locale?: Partial<IcmLocalePack> | null
): {
  title: string;
  subtitle: string;
  targetAudience: string;
  estimatedDuration: number | string;
  scriptBody: string;
  spokenScript: string;
  overviewDialogueTurns?: NormalizedA2uiDialogueTurn[];
  overviewVisualPrompt?: string;
  highlights: string[];
  modules: NormalizedA2uiModule[];
  quiz: NormalizedA2uiQuizQuestion[];
  cases: NormalizedA2uiCaseItem[];
  checklistGroups: A2uiChecklistGroup[];
} {
  if (!scriptDraft || typeof scriptDraft !== 'object') {
    return {
      title: fallbackTitle,
      subtitle: '',
      targetAudience: '',
      estimatedDuration: 0,
      scriptBody: '',
      spokenScript: '',
      overviewVisualPrompt: '',
      highlights: [],
      modules: [],
      quiz: [],
      cases: [],
      checklistGroups: [],
    };
  }

  const loc = mergeIcmLocalePack(locale);
  const isPillarSchema =
    Array.isArray(scriptDraft.pillars) || Array.isArray(scriptDraft.analysisPillars);

  const title = String(
    scriptDraft.title ||
      scriptDraft.courseTitle ||
      scriptDraft.reportTitle ||
      scriptDraft.memoTitle ||
      fallbackTitle ||
      'ICM Run Studio'
  );
  const subtitle = String(
    scriptDraft.subtitle || scriptDraft.description || scriptDraft.verdict || ''
  );
  const targetAudience = String(
    scriptDraft.targetAudience || scriptDraft.audience || scriptDraft.verdict || ''
  );

  const rawMinField =
    scriptDraft.totalEstimatedMinutes ??
    scriptDraft.totalDurationMinutes ??
    scriptDraft.durationMinutes ??
    scriptDraft.readingTimeMinutes;
  const rawEstDur = scriptDraft.estimatedDuration ?? scriptDraft.duration;

  let estimatedDuration: number | string = '';
  let hasExplicitMinutesField = false;
  if (typeof rawMinField === 'number' && Number.isFinite(rawMinField) && rawMinField > 0) {
    estimatedDuration = `${rawMinField} min`;
    hasExplicitMinutesField = true;
  } else if (typeof rawMinField === 'string' && rawMinField.trim()) {
    const trimmed = rawMinField.trim();
    if (/^\d+(\.\d+)?$/.test(trimmed) && Number(trimmed) > 0) {
      estimatedDuration = `${Number(trimmed)} min`;
      hasExplicitMinutesField = true;
    } else if (/^\d/.test(trimmed) && /[a-zA-Z]/.test(trimmed)) {
      estimatedDuration = trimmed;
      hasExplicitMinutesField = true;
    }
  } else if (typeof rawEstDur === 'number' && Number.isFinite(rawEstDur) && rawEstDur > 0) {
    estimatedDuration = `${rawEstDur}s`;
  } else if (typeof rawEstDur === 'string' && rawEstDur.trim()) {
    const trimmed = rawEstDur.trim();
    if (/^\d+(\.\d+)?$/.test(trimmed) && Number(trimmed) > 0) {
      estimatedDuration = `${Number(trimmed)}s`;
    } else if (/^\d/.test(trimmed) && /[a-zA-Z]/.test(trimmed)) {
      estimatedDuration = trimmed;
    }
  }

  const rawScriptBody = String(
    scriptDraft.visualSummary ||
      scriptDraft.visualBody ||
      scriptDraft.executiveSummary ||
      scriptDraft.investmentThesis ||
      scriptDraft.memoBody ||
      scriptDraft.overview ||
      scriptDraft.scriptBody ||
      scriptDraft.narration ||
      ''
  );
  const scriptBody = formatSingleWallParagraphs(rawScriptBody);
  const spokenScript = String(
    scriptDraft.spokenScript ||
      scriptDraft.spokenNarration ||
      scriptDraft.narrationScript ||
      (scriptDraft.visualSummary ||
      scriptDraft.visualBody ||
      scriptDraft.executiveSummary ||
      scriptDraft.investmentThesis ||
      scriptDraft.memoBody ||
      scriptDraft.overview
        ? scriptDraft.scriptBody || ''
        : '') ||
      scriptBody
  ).trim();

  // Extract highlights (`keyTakeaways`, `thesisPoints`, `learningObjectives`, or `highlights`)
  const rawHighlights = Array.isArray(scriptDraft.keyTakeaways)
    ? scriptDraft.keyTakeaways
    : Array.isArray(scriptDraft.thesisPoints)
      ? scriptDraft.thesisPoints
      : Array.isArray(scriptDraft.learningObjectives)
        ? scriptDraft.learningObjectives
        : Array.isArray(scriptDraft.highlights)
          ? scriptDraft.highlights
          : [];
  const highlights = rawHighlights.map((h) => String(h || '').trim()).filter(Boolean);

  // Extract modules from `trainingModules`, `modules`, `pillars`, `analysisPillars`, `lessons`, `sections`, or `slides`
  const rawModules = Array.isArray(scriptDraft.trainingModules)
    ? scriptDraft.trainingModules
    : Array.isArray(scriptDraft.modules)
      ? scriptDraft.modules
      : Array.isArray(scriptDraft.pillars)
        ? scriptDraft.pillars
        : Array.isArray(scriptDraft.analysisPillars)
          ? scriptDraft.analysisPillars
          : Array.isArray(scriptDraft.lessons)
            ? scriptDraft.lessons
            : Array.isArray(scriptDraft.sections)
              ? scriptDraft.sections
              : Array.isArray(scriptDraft.slides)
                ? scriptDraft.slides
                : [];

  const modules: NormalizedA2uiModule[] = [];
  const quiz: NormalizedA2uiQuizQuestion[] = [];
  const cases: NormalizedA2uiCaseItem[] = [];

  rawModules.forEach((rawMod: any, idx: number) => {
    if (!rawMod || typeof rawMod !== 'object') return;
    const modNum = Number(
      rawMod.moduleNumber ??
        rawMod.pillarNumber ??
        rawMod.lessonNumber ??
        rawMod.sectionNumber ??
        rawMod.slideNumber ??
        idx + 1
    );
    const modTitle = String(
      rawMod.moduleTitle ||
        rawMod.pillarTitle ||
        rawMod.lessonTitle ||
        rawMod.sectionTitle ||
        rawMod.title ||
        (isPillarSchema ? `Pillar ${modNum}` : `Module ${modNum}`)
    );
    const subtitleOrBasis = String(
      rawMod.regulatoryBasis ||
        rawMod.legalBasis ||
        rawMod.legalReference ||
        rawMod.legalRef ||
        rawMod.lawReference ||
        rawMod.statute ||
        rawMod.analyticalFramework ||
        rawMod.valuationMethodology ||
        rawMod.framework ||
        rawMod.methodology ||
        rawMod.coreConcept ||
        rawMod.subtitle ||
        ''
    );
    const rawModDurVal = rawMod.durationMinutes ?? rawMod.readingTimeMinutes;
    const rawModDurMin =
      rawModDurVal !== undefined && rawModDurVal !== null ? String(rawModDurVal).trim() : '';
    const rawModEstDur =
      rawMod.estimatedDuration !== undefined && rawMod.estimatedDuration !== null
        ? String(rawMod.estimatedDuration).trim()
        : '';
    const durationOrMeta = rawModDurMin
      ? /[a-zA-Z]/.test(rawModDurMin)
        ? rawModDurMin
        : `${rawModDurMin} min`
      : rawModEstDur
        ? /[a-zA-Z]/.test(rawModEstDur)
          ? rawModEstDur
          : `${rawModEstDur}s`
        : '';
    const rawNarration = String(
      rawMod.visualAnalysis ||
        rawMod.visualSummary ||
        rawMod.analysis ||
        rawMod.content ||
        rawMod.summary ||
        rawMod.spokenNarration ||
        rawMod.narrationScript ||
        rawMod.narration ||
        rawMod.scriptBody ||
        ''
    );
    const narration = formatSingleWallParagraphs(rawNarration);
    const spokenNarration = String(
      rawMod.spokenNarration ||
        rawMod.narrationScript ||
        rawMod.spokenScript ||
        narration
    ).trim();
    const actionItem = String(
      rawMod.boardActionItem ||
        rawMod.actionItem ||
        rawMod.recommendation ||
        rawMod.icDirective ||
        rawMod.practicalTask ||
        rawMod.exercise ||
        rawMod.caseActionItem ||
        rawMod.caseResolution ||
        rawMod.recommendedAction ||
        rawMod.mitigation ||
        rawMod.resolution ||
        rawMod.caseSolution ||
        rawMod.solution ||
        ''
    ).trim();
    const bulletsRaw = Array.isArray(rawMod.slideCues)
      ? rawMod.slideCues
      : Array.isArray(rawMod.keyPoints)
        ? rawMod.keyPoints
        : Array.isArray(rawMod.keyTakeaways)
          ? rawMod.keyTakeaways
          : Array.isArray(rawMod.thesisPoints)
            ? rawMod.thesisPoints
            : Array.isArray(rawMod.bullets)
              ? rawMod.bullets
              : [];
    const bullets = bulletsRaw.map((b: unknown) => String(b || '').trim()).filter(Boolean);
    const modVisualPrompt = String(
      rawMod.visualPrompt ||
        rawMod.imagePrompt ||
        rawMod.illustrationPrompt ||
        rawMod.sceneFocus ||
        ''
    ).trim();
    const rawModTurns = Array.isArray(rawMod.dialogueTurns)
      ? rawMod.dialogueTurns
      : Array.isArray(rawMod.speakerTurns)
        ? rawMod.speakerTurns
        : Array.isArray(rawMod.turns)
          ? rawMod.turns
          : [];
    const modDialogueTurns: NormalizedA2uiDialogueTurn[] = rawModTurns
      .map((t: any) =>
        t && typeof t === 'object' && typeof t.text === 'string' && t.text.trim()
          ? {
              ...(typeof t.speaker === 'string' && t.speaker.trim()
                ? { speaker: t.speaker.trim() }
                : {}),
              text: t.text.trim(),
              ...(typeof t.style === 'string' && t.style.trim() ? { style: t.style.trim() } : {}),
            }
          : null
      )
      .filter((t: NormalizedA2uiDialogueTurn | null): t is NormalizedA2uiDialogueTurn => Boolean(t));

    modules.push({
      id: `mod_${idx + 1}`,
      number: modNum,
      title: modTitle,
      subtitleOrBasis,
      durationOrMeta,
      narration,
      spokenNarration,
      ...(modDialogueTurns.length > 0 ? { dialogueTurns: modDialogueTurns } : {}),
      actionItem,
      bullets,
      ...(modVisualPrompt ? { visualPrompt: modVisualPrompt } : {}),
    });

    // If module has an embedded quizQuestion (for course/training pipelines)
    if (typeof rawMod.quizQuestion === 'string' && Array.isArray(rawMod.quizOptions)) {
      const options = rawMod.quizOptions.map((opt: unknown, oIdx: number) => ({
        label: String(opt),
        value: String(oIdx),
      }));
      const rawCorrectIdx =
        rawMod.quizCorrectIndex ?? rawMod.correctOptionIndex ?? rawMod.correctIndex;
      const correctIdx =
        typeof rawCorrectIdx === 'number' && Number.isFinite(rawCorrectIdx)
          ? String(rawCorrectIdx)
          : typeof rawCorrectIdx === 'string' && /^\d+$/.test(rawCorrectIdx.trim())
            ? rawCorrectIdx.trim()
            : '0';
      quiz.push({
        id: `quiz_mod_${idx + 1}`,
        question: rawMod.quizQuestion,
        options,
        correctValue: correctIdx,
        explanation: String(rawMod.quizExplanation || ''),
        sourceModule: modTitle,
      });
    }

    // If module has an actionItem / recommendation or explicit caseScenario / stressTest / dilemma, populate a situational scenario case
    const explicitCaseScenario = String(
      rawMod.caseScenario || rawMod.stressTest || rawMod.dilemma || rawMod.scenario || ''
    ).trim();
    const hasPrimaryActionField = Boolean(
      rawMod.boardActionItem || rawMod.actionItem || rawMod.icDirective
    );
    const explicitCaseResolution =
      String(rawMod.caseResolution ?? '').trim() ||
      String(rawMod.recommendedAction ?? '').trim() ||
      String(rawMod.mitigation ?? '').trim() ||
      String(rawMod.resolution ?? '').trim() ||
      String(rawMod.caseSolution ?? '').trim() ||
      String(rawMod.solution ?? '').trim() ||
      String(rawMod.caseActionItem ?? '').trim() ||
      (hasPrimaryActionField ? String(rawMod.recommendation ?? '').trim() : '');
    const caseActionText = explicitCaseResolution || actionItem;
    const hasTopLevelCases = [scriptDraft.cases, scriptDraft.scenarios, scriptDraft.stressTests].some(
      (arr) => Array.isArray(arr) && arr.some((c: any) => c && typeof c === 'object')
    );
    if (explicitCaseScenario || (!hasTopLevelCases && caseActionText)) {
      let synthesizedScenario = explicitCaseScenario;
      if (!synthesizedScenario) {
        const scenarioParts: string[] = [];
        const paragraphs = rawNarration
          .split(/\r?\n\r?\n/)
          .map((p) => p.trim())
          .filter(Boolean);
        const firstPara = paragraphs[0] || '';
        const quizQ = typeof rawMod.quizQuestion === 'string' ? rawMod.quizQuestion.trim() : '';
        if (firstPara && paragraphs.length > 1) {
          scenarioParts.push(firstPara);
        } else if (firstPara && !quizQ) {
          const conciseOpening =
            firstPara.length > 360
              ? firstPara.split(/(?<=[.!?])\s+/).slice(0, 2).join(' ')
              : firstPara;
          scenarioParts.push(conciseOpening);
        }
        if (quizQ) {
          scenarioParts.push(
            formatLocaleTemplate(loc.ui.challengePrefix, { question: quizQ })
          );
        }
        if (bullets.length > 0) {
          const contextHeader = subtitleOrBasis
            ? formatLocaleTemplate(loc.ui.keyCheckpointsWithBasis, { basis: subtitleOrBasis })
            : loc.ui.keyCheckpoints;
          scenarioParts.push(
            `${contextHeader}\n${bullets.slice(0, 4).map((b: string) => `• ${b}`).join('\n')}`
          );
        }
        synthesizedScenario = scenarioParts.join('\n\n') || firstPara || rawNarration;
      }

      const quizExpl =
        typeof rawMod.quizExplanation === 'string' ? rawMod.quizExplanation.trim() : '';
      const rationaleLabel = loc.ui.rationaleLabel;
      const enrichedRecommendation =
        !explicitCaseScenario && caseActionText && quizExpl
          ? `${caseActionText}\n\n${rationaleLabel} ${quizExpl}`
          : caseActionText || quizExpl;

      cases.push({
        id: `case_mod_${idx + 1}`,
        title: `${modTitle}`,
        basisOrContext: subtitleOrBasis,
        scenario: synthesizedScenario,
        recommendedAction: enrichedRecommendation,
      });
    }
  });

  if (rawModules.length > 0) {
    const totalModMinutes = rawModules.reduce((acc: number, rm: any) => {
      const rawDm = rm?.durationMinutes ?? rm?.readingTimeMinutes;
      const dm =
        typeof rawDm === 'number'
          ? rawDm
          : typeof rawDm === 'string'
            ? Number(rawDm.replace(/[^\d.]+/g, ''))
            : NaN;
      return Number.isFinite(dm) && dm > 0 ? acc + dm : acc;
    }, 0);
    if (totalModMinutes > 0) {
      if (
        !hasExplicitMinutesField &&
        rawEstDur !== undefined &&
        rawEstDur !== null &&
        rawEstDur !== '' &&
        ((typeof rawEstDur === 'number' && Number.isFinite(rawEstDur) && rawEstDur > 0) ||
          (typeof rawEstDur === 'string' &&
            /^\d+(\.\d+)?$/.test(rawEstDur.trim()) &&
            Number(rawEstDur.trim()) > 0))
      ) {
        estimatedDuration = `${Number(String(rawEstDur).trim())} min`;
      } else if (!estimatedDuration) {
        estimatedDuration = `${totalModMinutes} min`;
      }
    } else if (!estimatedDuration) {
      const totalModSeconds = rawModules.reduce((acc: number, rm: any) => {
        const ds = Number(rm?.estimatedDuration);
        return Number.isFinite(ds) && ds > 0 ? acc + ds : acc;
      }, 0);
      if (totalModSeconds > 0) {
        estimatedDuration = `${totalModSeconds}s`;
      }
    }
  }

  // Synthesize highlights from modules if top-level keyTakeaways / thesisPoints / learningObjectives / highlights is empty
  if (highlights.length === 0 && modules.length > 0) {
    const modPrefix = isPillarSchema ? loc.ui.pillarPrefix : loc.ui.modulePrefix;
    for (let idx = 0; idx < modules.length; idx++) {
      const m = modules[idx];
      const basisPart = m.subtitleOrBasis ? ` (${m.subtitleOrBasis})` : '';
      const actionPart = m.actionItem ? ` — ${m.actionItem}` : '';
      highlights.push(`${modPrefix} ${idx + 1}: ${m.title}${basisPart}${actionPart}`);
    }
  }

  // Top-level `quiz` or `questions` array
  const rawQuizList = Array.isArray(scriptDraft.quiz)
    ? scriptDraft.quiz
    : Array.isArray(scriptDraft.questions)
      ? scriptDraft.questions
      : [];
  rawQuizList.forEach((q: any, idx: number) => {
    if (!q || typeof q !== 'object') return;
    const rawOpts = Array.isArray(q.options)
      ? q.options
      : Array.isArray(q.quizOptions)
        ? q.quizOptions
        : [];
    const options = rawOpts.map((opt: any, oIdx: number) =>
      typeof opt === 'object' && opt !== null
        ? { label: String(opt.label || opt.text || oIdx), value: String(opt.value ?? oIdx) }
        : { label: String(opt), value: String(oIdx) }
    );
    const correctValue = String(
      q.correctValue ?? q.correctIndex ?? q.quizCorrectIndex ?? q.answer ?? '0'
    );
    quiz.push({
      id: `quiz_${idx + 1}`,
      question: String(q.question || q.quizQuestion || `Question ${idx + 1}`),
      options,
      correctValue,
      explanation: String(q.explanation || q.quizExplanation || ''),
      sourceModule: String(q.moduleTitle || ''),
    });
  });

  // Top-level `cases`, `scenarios`, or `stressTests` array
  const rawCasesList = Array.isArray(scriptDraft.cases)
    ? scriptDraft.cases
    : Array.isArray(scriptDraft.scenarios)
      ? scriptDraft.scenarios
      : Array.isArray(scriptDraft.stressTests)
        ? scriptDraft.stressTests
        : [];
  rawCasesList.forEach((c: any, idx: number) => {
    if (!c || typeof c !== 'object') return;
    cases.push({
      id: `case_${idx + 1}`,
      title: String(c.title || c.caseTitle || c.scenarioTitle || `Scenario ${idx + 1}`),
      basisOrContext: String(
        c.regulatoryBasis ||
          c.legalBasis ||
          c.legalReference ||
          c.legalRef ||
          c.lawReference ||
          c.statute ||
          c.analyticalFramework ||
          c.valuationMethodology ||
          c.framework ||
          c.methodology ||
          c.coreConcept ||
          c.subtitle ||
          c.context ||
          c.category ||
          ''
      ),
      scenario: String(
        c.scenario || c.caseScenario || c.stressTest || c.dilemma || c.description || c.prompt || ''
      ),
      recommendedAction: String(
        c.recommendedAction ||
          c.recommendation ||
          c.mitigation ||
          c.caseResolution ||
          c.resolution ||
          c.caseSolution ||
          c.solution ||
          c.boardActionItem ||
          c.actionItem ||
          c.icDirective ||
          c.caseActionItem ||
          c.practicalTask ||
          c.exercise ||
          ''
      ),
    });
  });

  // Top-level `checklistGroups` (`{ category, items: string[] }[]`)
  const checklistGroups: A2uiChecklistGroup[] = [];
  if (Array.isArray(scriptDraft.checklistGroups)) {
    let chkCounter = 0;
    const defaultGrpPrefix = loc.ui.groupPrefix;
    scriptDraft.checklistGroups.forEach((rawGrp: any, gIdx: number) => {
      if (!rawGrp || typeof rawGrp !== 'object') return;
      const grpTitle =
        cleanChecklistLabel(
          String(
            rawGrp.category ||
              rawGrp.title ||
              rawGrp.groupTitle ||
              `${defaultGrpPrefix} ${gIdx + 1}`
          )
        ) || `${defaultGrpPrefix} ${gIdx + 1}`;
      const rawItems = Array.isArray(rawGrp.items) ? rawGrp.items : [];
      const items: A2uiChecklistItem[] = [];
      rawItems.forEach((it: any) => {
        const rawLabel =
          typeof it === 'object' && it !== null
            ? String(it.label || it.text || it.item || '')
            : String(it || '');
        const cleaned = cleanChecklistLabel(rawLabel);
        if (!cleaned) return;
        chkCounter++;
        items.push({
          id: `chk_s2_${chkCounter}`,
          label: cleaned,
          checked: Boolean(typeof it === 'object' && it !== null && it.checked),
          category: grpTitle,
        });
      });
      if (items.length > 0) {
        checklistGroups.push({
          id: `chk_s2_grp_${checklistGroups.length + 1}`,
          title: grpTitle,
          items,
        });
      }
    });
  }

  const overviewVisualPrompt = String(
    scriptDraft.overviewVisualPrompt ||
      scriptDraft.heroVisualPrompt ||
      scriptDraft.visualPrompt ||
      scriptDraft.imagePrompt ||
      ''
  ).trim();
  const rawOverviewTurns = Array.isArray(scriptDraft.overviewDialogueTurns)
    ? scriptDraft.overviewDialogueTurns
    : Array.isArray(scriptDraft.dialogueTurns)
      ? scriptDraft.dialogueTurns
      : Array.isArray(scriptDraft.speakerTurns)
        ? scriptDraft.speakerTurns
        : [];
  const overviewDialogueTurns: NormalizedA2uiDialogueTurn[] = rawOverviewTurns
    .map((t: any) =>
      t && typeof t === 'object' && typeof t.text === 'string' && t.text.trim()
        ? {
            ...(typeof t.speaker === 'string' && t.speaker.trim()
              ? { speaker: t.speaker.trim() }
              : {}),
            text: t.text.trim(),
            ...(typeof t.style === 'string' && t.style.trim() ? { style: t.style.trim() } : {}),
          }
        : null
    )
    .filter((t: NormalizedA2uiDialogueTurn | null): t is NormalizedA2uiDialogueTurn => Boolean(t));

  return {
    title,
    subtitle,
    targetAudience,
    estimatedDuration,
    scriptBody,
    spokenScript,
    ...(overviewDialogueTurns.length > 0 ? { overviewDialogueTurns } : {}),
    ...(overviewVisualPrompt ? { overviewVisualPrompt } : {}),
    highlights,
    modules,
    quiz,
    cases,
    checklistGroups,
  };
}
