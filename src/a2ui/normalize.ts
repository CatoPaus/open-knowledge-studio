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

export interface NormalizedA2uiFlowDiagramNode {
  id: string;
  title: string;
  subtitle?: string;
  group?: string;
  bullets?: string[];
  shape?: 'rect' | 'round' | 'stadium' | 'diamond';
}

export interface NormalizedA2uiFlowDiagramEdge {
  from: string;
  to: string;
  label?: string;
  bidirectional?: boolean;
  dashed?: boolean;
}

export interface NormalizedA2uiFlowDiagram {
  title?: string;
  direction?: 'TD' | 'TB' | 'LR' | 'RL';
  mermaid?: string;
  nodes?: NormalizedA2uiFlowDiagramNode[];
  edges?: NormalizedA2uiFlowDiagramEdge[];
}

function splitDiagramNodeLinesTs(
  rawLines: string[],
  keepAllBullets = false
): { title: string; subtitle?: string; bullets: string[] } {
  const headers: string[] = [];
  const bullets: string[] = [];
  for (let i = 0; i < rawLines.length; i++) {
    const raw = String(rawLines[i] || '')
      .replace(/\s+/g, ' ')
      .trim();
    if (!raw) continue;
    const bMatch = raw.match(/^(?:[-*•])\s+(.+)$/);
    if (bMatch) {
      bullets.push(bMatch[1].trim());
    } else if (bullets.length > 0) {
      const prev = bullets[bullets.length - 1];
      bullets[bullets.length - 1] = prev.endsWith('-')
        ? prev.slice(0, -1) + raw
        : `${prev} ${raw}`;
    } else {
      headers.push(raw);
    }
  }
  const title = headers[0] || (keepAllBullets ? '' : bullets.shift()) || '';
  const subtitle = headers
    .slice(1)
    .join(' · ')
    .replace(/\s*\|\s*/g, ' · ')
    .trim();
  return { title, ...(subtitle ? { subtitle } : {}), bullets };
}

export function parseMermaidFlowchartSpec(rawCode: string): NormalizedA2uiFlowDiagram | undefined {
  const cleaned = String(rawCode || '')
    .replace(/^\s*---[\s\S]*?---\s*\n/, '')
    .replace(/^\s*%%.*$/gm, '')
    .trim();
  const headerMatch = cleaned.match(
    /^\s*(?:flowchart|graph)(?:[ \t]+(TD|TB|BT|LR|RL))?\s*(?:;|\r?\n|$)/i
  );
  if (!headerMatch) return undefined;
  const rawDir = String(headerMatch[1] || 'TD').toUpperCase();
  let direction: NormalizedA2uiFlowDiagram['direction'] =
    rawDir === 'LR' || rawDir === 'RL' ? rawDir : 'TD';

  const body = cleaned.slice(headerMatch[0].length).replace(/\r\n/g, '\n');
  const statements: string[] = [];
  {
    let cur = '';
    let quoteCh = '';
    let bracketDepth = 0;
    for (let i = 0; i < body.length; i++) {
      const ch = body[i];
      if (quoteCh) {
        cur += ch;
        if (ch === quoteCh && body[i - 1] !== '\\') quoteCh = '';
        continue;
      }
      if (ch === '"' || ch === "'") {
        quoteCh = ch;
        cur += ch;
        continue;
      }
      if (ch === '[' || ch === '(' || ch === '{') {
        bracketDepth++;
        cur += ch;
        continue;
      }
      if (ch === ']' || ch === ')' || ch === '}') {
        if (bracketDepth > 0) bracketDepth--;
        cur += ch;
        continue;
      }
      if (bracketDepth === 0 && (ch === '\n' || ch === ';')) {
        if (cur.trim()) statements.push(cur.trim());
        cur = '';
        continue;
      }
      cur += ch;
    }
    if (cur.trim()) statements.push(cur.trim());
  }

  const normalizeInlineLabels = (stmt: string): string => {
    let out = '';
    let i = 0;
    let quoteCh = '';
    let bracketDepth = 0;
    while (i < stmt.length) {
      const ch = stmt[i];
      if (quoteCh) {
        out += ch;
        if (ch === quoteCh && stmt[i - 1] !== '\\') quoteCh = '';
        i++;
        continue;
      }
      if (ch === '"' || ch === "'") {
        quoteCh = ch;
        out += ch;
        i++;
        continue;
      }
      if (ch === '[' || ch === '(' || ch === '{') {
        bracketDepth++;
        out += ch;
        i++;
        continue;
      }
      if (ch === ']' || ch === ')' || ch === '}') {
        if (bracketDepth > 0) bracketDepth--;
        out += ch;
        i++;
        continue;
      }
      if (bracketDepth === 0) {
        const rest = stmt.slice(i);
        const bi = rest.match(/^<--\s+([^|\-\n]+?)\s+-->/);
        if (bi) {
          out += `<-->|${bi[1].trim()}|`;
          i += bi[0].length;
          continue;
        }
        const dir = rest.match(/^--\s+([^|\-\n]+?)\s+-->/);
        if (dir) {
          out += `-->|${dir[1].trim()}|`;
          i += dir[0].length;
          continue;
        }
        const dot = rest.match(/^-\.\s+([^|\n]+?)\s+\.->/);
        if (dot) {
          out += `-.->|${dot[1].trim()}|`;
          i += dot[0].length;
          continue;
        }
      }
      out += ch;
      i++;
    }
    return out;
  };

  const splitAmpersand = (groupText: string): string[] => {
    const out: string[] = [];
    let cur = '';
    let quoteCh = '';
    let bracketDepth = 0;
    for (let i = 0; i < groupText.length; i++) {
      const ch = groupText[i];
      if (quoteCh) {
        cur += ch;
        if (ch === quoteCh && groupText[i - 1] !== '\\') quoteCh = '';
        continue;
      }
      if (ch === '"' || ch === "'") {
        quoteCh = ch;
        cur += ch;
        continue;
      }
      if (ch === '[' || ch === '(' || ch === '{') {
        bracketDepth++;
        cur += ch;
        continue;
      }
      if (ch === ']' || ch === ')' || ch === '}') {
        if (bracketDepth > 0) bracketDepth--;
        cur += ch;
        continue;
      }
      if (bracketDepth === 0 && ch === '&') {
        if (cur.trim()) out.push(cur.trim());
        cur = '';
        continue;
      }
      cur += ch;
    }
    if (cur.trim()) out.push(cur.trim());
    return out;
  };

  const parseNodeExpr = (
    expr: string,
    currentGroup: string
  ): (NormalizedA2uiFlowDiagramNode & { hasExplicitLabel: boolean }) | null => {
    const trimmed = String(expr || '').trim();
    if (!trimmed) return null;
    const m = trimmed.match(
      /^([\p{L}\p{N}_-]+)\s*(?:(\(\[|\[\[|\(\(|\{\{|\[|\(|\{)([\s\S]*?)(\]\)|\]\]|\)\)|\}\}|\]|\)|\}))?$/u
    );
    if (!m) return null;
    const id = m[1];
    const openBr = m[2] || '';
    let rawInner = m[3] !== undefined ? String(m[3]).trim() : '';
    if (
      (rawInner.startsWith('"') && rawInner.endsWith('"')) ||
      (rawInner.startsWith("'") && rawInner.endsWith("'"))
    ) {
      rawInner = rawInner.slice(1, -1);
    }
    rawInner = rawInner.replace(/<br\s*\/?>/gi, '\n').replace(/\\n/g, '\n');
    let shape: NormalizedA2uiFlowDiagramNode['shape'];
    if (openBr === '{' || openBr === '{{') shape = 'diamond';
    else if (openBr === '([' || openBr === '((') shape = 'stadium';
    else if (openBr === '(') shape = 'round';
    if (!openBr) {
      return {
        id,
        title: id,
        ...(currentGroup ? { group: currentGroup } : {}),
        ...(shape ? { shape } : {}),
        hasExplicitLabel: false,
      };
    }
    const parts = splitDiagramNodeLinesTs(rawInner.split(/\r?\n/));
    return {
      id,
      title: parts.title || id,
      ...(parts.subtitle ? { subtitle: parts.subtitle } : {}),
      ...(parts.bullets.length > 0 ? { bullets: parts.bullets } : {}),
      ...(currentGroup ? { group: currentGroup } : {}),
      ...(shape ? { shape } : {}),
      hasExplicitLabel: true,
    };
  };

  const nodeMap = new Map<string, NormalizedA2uiFlowDiagramNode & { hasExplicitLabel: boolean }>();
  const nodeOrder: Array<NormalizedA2uiFlowDiagramNode & { hasExplicitLabel: boolean }> = [];
  const edges: NormalizedA2uiFlowDiagramEdge[] = [];
  const subgraphStack: string[] = [];
  const subgraphIds = new Set<string>();

  const upsertNode = (
    parsed: (NormalizedA2uiFlowDiagramNode & { hasExplicitLabel: boolean }) | null
  ) => {
    if (!parsed || !parsed.id || subgraphIds.has(parsed.id)) return null;
    const existing = nodeMap.get(parsed.id);
    if (!existing) {
      nodeMap.set(parsed.id, parsed);
      nodeOrder.push(parsed);
      return parsed;
    }
    if (
      parsed.hasExplicitLabel &&
      (!existing.hasExplicitLabel ||
        (parsed.bullets?.length || 0) > (existing.bullets?.length || 0))
    ) {
      existing.title = parsed.title || existing.title;
      if (parsed.subtitle) existing.subtitle = parsed.subtitle;
      if (parsed.bullets && parsed.bullets.length > 0) existing.bullets = parsed.bullets;
      if (parsed.shape) existing.shape = parsed.shape;
      existing.hasExplicitLabel = true;
    }
    if (!existing.group && parsed.group) existing.group = parsed.group;
    return existing;
  };

  for (const rawStmt of statements) {
    const stmt = rawStmt.trim();
    if (!stmt || /^%%/.test(stmt)) continue;
    if (/^(?:classDef|class|style|linkStyle|click)\b/i.test(stmt)) continue;
    const dirOverride = stmt.match(/^direction\s+(TD|TB|BT|LR|RL)\b/i);
    if (dirOverride && subgraphStack.length === 0) {
      const d = dirOverride[1].toUpperCase();
      direction = d === 'LR' || d === 'RL' ? d : 'TD';
      continue;
    }
    const subMatch = stmt.match(/^subgraph\s+(.+)$/i);
    if (subMatch) {
      const rawSub = subMatch[1].trim();
      const idBracket = rawSub.match(/^([\p{L}\p{N}_-]+)\s*\[\s*["']?([^"'\]]+)["']?\s*\]$/u);
      if (idBracket) {
        subgraphIds.add(idBracket[1]);
        subgraphStack.push(idBracket[2].trim());
      } else {
        subgraphStack.push(rawSub.replace(/^["']|["']$/g, '').trim());
      }
      continue;
    }
    if (/^end$/i.test(stmt)) {
      if (subgraphStack.length > 0) subgraphStack.pop();
      continue;
    }

    const activeGroup = subgraphStack.length > 0 ? subgraphStack[subgraphStack.length - 1] : '';
    const normalized = normalizeInlineLabels(stmt);
    const chain: Array<
      | { type: 'nodes'; text: string }
      | { type: 'arrow'; bidirectional: boolean; dashed: boolean; label: string }
    > = [];
    {
      let cur = '';
      let quoteCh = '';
      let bracketDepth = 0;
      let i = 0;
      while (i < normalized.length) {
        const ch = normalized[i];
        if (quoteCh) {
          cur += ch;
          if (ch === quoteCh && normalized[i - 1] !== '\\') quoteCh = '';
          i++;
          continue;
        }
        if (ch === '"' || ch === "'") {
          quoteCh = ch;
          cur += ch;
          i++;
          continue;
        }
        if (ch === '[' || ch === '(' || ch === '{') {
          bracketDepth++;
          cur += ch;
          i++;
          continue;
        }
        if (ch === ']' || ch === ')' || ch === '}') {
          if (bracketDepth > 0) bracketDepth--;
          cur += ch;
          i++;
          continue;
        }
        if (bracketDepth === 0) {
          const rest = normalized.slice(i);
          const arrowMatch = rest.match(
            /^(<--+>|<==+>|<\.-\.->|<-+\.->|--+>|==+>|-\.+->|--+[ox]|---)(?:\s*\|([^|]*)\|)?/
          );
          if (arrowMatch) {
            chain.push({ type: 'nodes', text: cur.trim() });
            cur = '';
            const op = arrowMatch[1];
            let lbl = (arrowMatch[2] || '').trim();
            if (
              (lbl.startsWith('"') && lbl.endsWith('"')) ||
              (lbl.startsWith("'") && lbl.endsWith("'"))
            ) {
              lbl = lbl.slice(1, -1).trim();
            }
            chain.push({
              type: 'arrow',
              bidirectional: op.startsWith('<') && op.endsWith('>'),
              dashed: op.includes('.'),
              label: lbl.replace(/<br\s*\/?>/gi, ' ').replace(/\\n/g, ' '),
            });
            i += arrowMatch[0].length;
            continue;
          }
        }
        cur += ch;
        i++;
      }
      if (cur.trim()) chain.push({ type: 'nodes', text: cur.trim() });
    }

    if (chain.length === 1 && chain[0].type === 'nodes') {
      for (const expr of splitAmpersand(chain[0].text)) {
        upsertNode(parseNodeExpr(expr, activeGroup));
      }
      continue;
    }
    for (let cIdx = 0; cIdx + 2 < chain.length; cIdx += 2) {
      const leftPart = chain[cIdx];
      const arrowPart = chain[cIdx + 1];
      const rightPart = chain[cIdx + 2];
      if (leftPart.type !== 'nodes' || arrowPart.type !== 'arrow' || rightPart.type !== 'nodes') {
        continue;
      }
      const leftNodes = splitAmpersand(leftPart.text)
        .map((e) => upsertNode(parseNodeExpr(e, activeGroup)))
        .filter((n): n is NonNullable<typeof n> => Boolean(n));
      const rightNodes = splitAmpersand(rightPart.text)
        .map((e) => upsertNode(parseNodeExpr(e, activeGroup)))
        .filter((n): n is NonNullable<typeof n> => Boolean(n));
      for (const ln of leftNodes) {
        for (const rn of rightNodes) {
          edges.push({
            from: ln.id,
            to: rn.id,
            ...(arrowPart.label ? { label: arrowPart.label } : {}),
            ...(arrowPart.bidirectional ? { bidirectional: true } : {}),
            ...(arrowPart.dashed ? { dashed: true } : {}),
          });
        }
      }
    }
  }

  if (nodeOrder.length === 0) return undefined;
  const cleanNodes: NormalizedA2uiFlowDiagramNode[] = nodeOrder.map(
    ({ hasExplicitLabel: _drop, ...rest }) => rest
  );
  return {
    direction,
    mermaid: String(rawCode || '').trim(),
    nodes: cleanNodes,
    edges,
  };
}

function reflowCollapsedAsciiBoxLinesTs(srcLines: string[]): string[] | null {
  if (!Array.isArray(srcLines) || srcLines.length < 3) return null;
  const norm = srcLines.map((line) =>
    String(line || '')
      .replace(/[┌┐└┘├┤┬┴┼╭╮╯╰╔╗╚╝╠╣╦╩╬]/g, '+')
      .replace(/[─━═╌╍┄┅┈┉]/g, '-')
      .replace(/[│┃║╎╏┆┇┊┋]/g, '|')
      .replace(/[▼▾⬇↓]/g, 'v')
      .replace(/[▲▴⬆↑]/g, '^')
      .replace(/[◄◂⬅←]/g, '<')
      .replace(/[►▸➡→]/g, '>')
  );
  const isPipeContent = (idx: number): boolean => {
    if (idx < 0 || idx >= norm.length) return false;
    const t = norm[idx].trim();
    if (t.length < 3 || t[0] !== '|' || t[t.length - 1] !== '|') return false;
    return /[\p{L}\p{N}]/u.test(srcLines[idx]) || (t.match(/\|/g) || []).length >= 4;
  };
  const isBoxBorder = norm.map((line, idx) => {
    const t = line.trim();
    if (!t || !/^[+\-\s]+$/.test(t) || !/\+[+\-]{7,}\+/.test(t)) return false;
    return isPipeContent(idx - 1) || isPipeContent(idx + 1);
  });

  const out = norm.slice();
  const rawOut = srcLines.map((l) => String(l || ''));
  let changed = false;

  let r = 0;
  while (r < norm.length) {
    if (!isBoxBorder[r]) {
      r++;
      continue;
    }
    let gEnd = r;
    while (gEnd + 1 < norm.length && (isBoxBorder[gEnd + 1] || isPipeContent(gEnd + 1))) {
      gEnd++;
    }
    if (gEnd <= r || !isBoxBorder[gEnd]) {
      r = gEnd + 1;
      continue;
    }
    const spans: Array<{ c1: number; w: number }> = [];
    const spanRe = /\+[+\-]{7,}\+/g;
    let sm: RegExpExecArray | null;
    while ((sm = spanRe.exec(norm[r])) !== null) {
      spans.push({ c1: sm.index, w: sm[0].length - 1 });
    }
    const K = spans.length;
    if (K === 1) {
      let innerW = spans[0].w - 1;
      for (let rr = r; rr <= gEnd; rr++) {
        if (!isBoxBorder[rr] && isPipeContent(rr)) {
          const txt = rawOut[rr].trim().slice(1, -1).trim();
          if (txt.length + 2 > innerW) innerW = txt.length + 2;
        }
      }
      const c1 = spans[0].c1;
      for (let rr = r; rr <= gEnd; rr++) {
        if (isBoxBorder[rr]) {
          const chars = (`+${'-'.repeat(innerW)}+`).split('');
          for (let cc = c1 + 1; cc < Math.min(norm[rr].length - 1, c1 + innerW + 1); cc++) {
            if (norm[rr][cc] === '+') chars[cc - c1] = '+';
          }
          const nextLine = `${' '.repeat(c1)}${chars.join('')}`;
          if (nextLine !== rawOut[rr]) changed = true;
          rawOut[rr] = nextLine;
          out[rr] = nextLine;
        } else if (isPipeContent(rr)) {
          const txt = rawOut[rr].trim().slice(1, -1).trim();
          const nextLine = `${' '.repeat(c1)}|${` ${txt}`.padEnd(innerW, ' ')}|`;
          if (nextLine !== rawOut[rr]) changed = true;
          rawOut[rr] = nextLine;
          out[rr] = nextLine;
        }
      }
    } else if (K >= 2) {
      const boxW = spans.map((s) => s.w - 1);
      const gutW: number[] = [];
      for (let m = 0; m < K - 1; m++) {
        gutW.push(Math.max(1, spans[m + 1].c1 - (spans[m].c1 + spans[m].w) - 1));
      }
      for (let rr = r; rr <= gEnd; rr++) {
        if (!isBoxBorder[rr] && isPipeContent(rr)) {
          const toks = rawOut[rr].trim().split('|').slice(1, -1);
          if (toks.length === 2 * K - 1) {
            for (let m = 0; m < K; m++) {
              const bt = toks[2 * m].trim();
              if (bt.length + 2 > boxW[m]) boxW[m] = bt.length + 2;
            }
            for (let m = 0; m < K - 1; m++) {
              const gt = norm[rr].trim().split('|').slice(1, -1)[2 * m + 1].trim();
              if (gt.length > gutW[m]) gutW[m] = gt.length;
            }
          }
        }
      }
      const padLead = ' '.repeat(spans[0].c1);
      for (let rr = r; rr <= gEnd; rr++) {
        if (isBoxBorder[rr]) {
          let line = padLead;
          for (let m = 0; m < K; m++) {
            line += `+${'-'.repeat(boxW[m])}+`;
            if (m < K - 1) line += ' '.repeat(gutW[m]);
          }
          if (line !== rawOut[rr]) changed = true;
          rawOut[rr] = line;
          out[rr] = line;
        } else if (isPipeContent(rr)) {
          const rawToks = rawOut[rr].trim().split('|').slice(1, -1);
          if (rawToks.length === 2 * K - 1) {
            let line = padLead;
            for (let m = 0; m < K; m++) {
              line += `|${` ${rawToks[2 * m].trim()}`.padEnd(boxW[m], ' ')}|`;
              if (m < K - 1) {
                line += rawToks[2 * m + 1].trim().padEnd(gutW[m], ' ');
              }
            }
            if (line !== rawOut[rr]) changed = true;
            rawOut[rr] = line;
            out[rr] = line;
          }
        }
      }
    }
    r = gEnd + 1;
  }

  for (let i = 0; i < out.length; i++) {
    if (isBoxBorder[i] || isPipeContent(i)) continue;
    const t = out[i].trim();
    if (!/^[|vV^](?:\s+[|vV^])+$/.test(t)) continue;
    const wireToks = t.split(/\s+/);
    let splitCols: number[] | null = null;
    for (let up = i - 1; up >= Math.max(0, i - 4); up--) {
      if (isBoxBorder[up] || isPipeContent(up)) break;
      if (/\+[+\-]{4,}\+/.test(out[up])) {
        const cols: number[] = [];
        for (let c = 0; c < out[up].length; c++) {
          if (out[up][c] === '+') cols.push(c);
        }
        if (cols.length >= 2) {
          splitCols = cols;
          break;
        }
      }
    }
    if (!splitCols) continue;
    const targetCols =
      wireToks.length === 2
        ? [splitCols[0], splitCols[splitCols.length - 1]]
        : wireToks.length === splitCols.length
          ? splitCols
          : null;
    if (!targetCols) continue;
    const width = targetCols[targetCols.length - 1] + 1;
    if (out[i].trimEnd().length < width - 1) {
      const arr = new Array(width).fill(' ');
      for (let wi = 0; wi < wireToks.length; wi++) {
        arr[targetCols[wi]] = wireToks[wi];
      }
      const rebuilt = arr.join('');
      rawOut[i] = rebuilt;
      out[i] = rebuilt;
      changed = true;
    }
  }

  return changed ? rawOut : null;
}

export function parseAsciiBoxDiagramSpec(rawCode: string): NormalizedA2uiFlowDiagram | undefined {
  const srcLines = String(rawCode || '')
    .replace(/\r\n/g, '\n')
    .split('\n');
  if (srcLines.length < 3) return undefined;
  const direct = parseAsciiBoxDiagramLinesTs(srcLines);
  if (direct) return direct;
  const reflowed = reflowCollapsedAsciiBoxLinesTs(srcLines);
  return reflowed ? parseAsciiBoxDiagramLinesTs(reflowed) : undefined;
}

function parseAsciiBoxDiagramLinesTs(srcLines: string[]): NormalizedA2uiFlowDiagram | undefined {
  const expandMono = (line: string): string => {
    let out = '';
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      out += ch;
      if (
        /[\u1100-\u115F\u2E80-\u303E\u3041-\u33FF\u3400-\u4DBF\u4E00-\u9FFF\uA960-\uA97C\uAC00-\uD7FF\uF900-\uFAFF\uFE10-\uFE6F\uFF01-\uFF60\uFFE0-\uFFE6]/.test(
          ch
        )
      ) {
        out += '\x00';
      }
    }
    return out;
  };
  const rawLines = srcLines.map(expandMono);
  let maxCols = 0;
  for (let r = 0; r < rawLines.length; r++) {
    if (rawLines[r].length > maxCols) maxCols = rawLines[r].length;
  }
  if (maxCols < 12 || maxCols > 260) return undefined;

  const normLines = rawLines.map((line) =>
    line
      .padEnd(maxCols, ' ')
      .replace(/[┌┐└┘├┤┬┴┼╭╮╯╰╔╗╚╝╠╣╦╩╬]/g, '+')
      .replace(/[─━═╌╍┄┅┈┉]/g, '-')
      .replace(/[│┃║╎╏┆┇┊┋]/g, '|')
      .replace(/[▼▾⬇↓]/g, 'v')
      .replace(/[▲▴⬆↑]/g, '^')
      .replace(/[◄◂⬅←]/g, '<')
      .replace(/[►▸➡→]/g, '>')
  );

  const isHorizBorder = (r: number, c1: number, c2: number): boolean => {
    if (c2 - c1 < 8) return false;
    const row = normLines[r];
    if (row[c1] !== '+' || row[c2] !== '+') return false;
    for (let c = c1 + 1; c < c2; c++) {
      if (row[c] !== '-' && row[c] !== '+') return false;
    }
    return true;
  };

  interface BoxCompartment {
    r1: number;
    c1: number;
    r2: number;
    c2: number;
    lines: string[];
  }
  const compartments: BoxCompartment[] = [];
  for (let r1 = 0; r1 < normLines.length - 2; r1++) {
    const row1 = normLines[r1];
    if (!row1.includes('+')) continue;
    const plusCols: number[] = [];
    for (let c = 0; c < maxCols; c++) {
      if (row1[c] === '+') plusCols.push(c);
    }
    for (let pi = 0; pi < plusCols.length; pi++) {
      const c1 = plusCols[pi];
      for (let pj = pi + 1; pj < plusCols.length; pj++) {
        const c2 = plusCols[pj];
        if (!isHorizBorder(r1, c1, c2)) continue;
        let r2 = -1;
        let wallsIntact = true;
        for (let r = r1 + 1; r < normLines.length; r++) {
          const leftCh = normLines[r][c1];
          const rightCh = normLines[r][c2];
          if (r >= r1 + 2 && isHorizBorder(r, c1, c2)) {
            r2 = r;
            break;
          }
          if ((leftCh !== '|' && leftCh !== '+') || (rightCh !== '|' && rightCh !== '+')) {
            wallsIntact = false;
            break;
          }
        }
        if (!wallsIntact || r2 === -1) continue;
        let hasFullInteriorWall = false;
        for (let cm = c1 + 2; cm <= c2 - 2; cm++) {
          let allVert = true;
          for (let r = r1 + 1; r < r2; r++) {
            const ch = normLines[r][cm];
            if (ch !== '|' && ch !== '+') {
              allVert = false;
              break;
            }
          }
          if (allVert && normLines[r1][cm] === '+' && normLines[r2][cm] === '+') {
            hasFullInteriorWall = true;
            break;
          }
        }
        if (hasFullInteriorWall) continue;
        const innerLines: string[] = [];
        let hasAlphaNum = false;
        for (let r = r1 + 1; r < r2; r++) {
          const padded = (rawLines[r] || '').padEnd(maxCols, ' ').slice(c1 + 1, c2).replace(/\x00/g, '');
          if (/[\p{L}\p{N}]/u.test(padded)) hasAlphaNum = true;
          innerLines.push(padded);
        }
        if (!hasAlphaNum) continue;
        compartments.push({ r1, c1, r2, c2, lines: innerLines });
        break;
      }
    }
  }

  if (compartments.length < 2) return undefined;
  compartments.sort((a, b) => a.r1 - b.r1 || a.c1 - b.c1);

  const mergedBoxes: Array<{
    r1: number;
    c1: number;
    r2: number;
    c2: number;
    sections: string[][];
  }> = [];
  const usedComp = new Set<number>();
  for (let i = 0; i < compartments.length; i++) {
    if (usedComp.has(i)) continue;
    usedComp.add(i);
    const cur = {
      r1: compartments[i].r1,
      c1: compartments[i].c1,
      r2: compartments[i].r2,
      c2: compartments[i].c2,
      sections: [compartments[i].lines],
    };
    let extended = true;
    while (extended) {
      extended = false;
      for (let j = i + 1; j < compartments.length; j++) {
        if (usedComp.has(j)) continue;
        if (
          compartments[j].r1 === cur.r2 &&
          compartments[j].c1 === cur.c1 &&
          compartments[j].c2 === cur.c2
        ) {
          usedComp.add(j);
          cur.r2 = compartments[j].r2;
          cur.sections.push(compartments[j].lines);
          extended = true;
        }
      }
    }
    mergedBoxes.push(cur);
  }
  if (mergedBoxes.length < 2) return undefined;

  const ownerGrid = Array.from({ length: normLines.length }, () => new Int16Array(maxCols).fill(-1));
  for (let bi = 0; bi < mergedBoxes.length; bi++) {
    const b = mergedBoxes[bi];
    for (let r = b.r1; r <= b.r2; r++) {
      for (let c = b.c1; c <= b.c2; c++) {
        ownerGrid[r][c] = bi;
      }
    }
  }

  let hasExteriorArrow = false;
  for (let r = 0; r < normLines.length && !hasExteriorArrow; r++) {
    for (let c = 0; c < maxCols; c++) {
      if (ownerGrid[r][c] === -1 && /[vV^<>]/.test(normLines[r][c])) {
        hasExteriorArrow = true;
        break;
      }
    }
  }
  if (!hasExteriorArrow) return undefined;

  const nodes: NormalizedA2uiFlowDiagramNode[] = mergedBoxes.map((b, idx) => {
    let title = '';
    let subtitle: string | undefined;
    let bullets: string[] = [];
    if (b.sections.length >= 2) {
      const hdr = splitDiagramNodeLinesTs(b.sections[0]);
      title = hdr.title;
      subtitle = hdr.subtitle;
      bullets = [...hdr.bullets];
      for (let si = 1; si < b.sections.length; si++) {
        const sec = splitDiagramNodeLinesTs(b.sections[si], true);
        if (sec.title) bullets.push(sec.title);
        if (sec.subtitle) bullets.push(sec.subtitle);
        bullets.push(...sec.bullets);
      }
    } else {
      const single = splitDiagramNodeLinesTs(b.sections[0]);
      title = single.title;
      subtitle = single.subtitle;
      bullets = single.bullets;
    }
    return {
      id: `box_${idx}`,
      title: title || `Node ${idx + 1}`,
      ...(subtitle ? { subtitle } : {}),
      ...(bullets.length > 0 ? { bullets } : {}),
    };
  });

  const edges: NormalizedA2uiFlowDiagramEdge[] = [];
  const seenEdges = new Set<string>();
  let horizDirectedCount = 0;
  let vertDirectedCount = 0;

  const addEdge = (
    fromIdx: number,
    toIdx: number,
    label: string,
    bidirectional: boolean
  ): boolean => {
    if (fromIdx === toIdx || fromIdx < 0 || toIdx < 0) return false;
    const key = bidirectional
      ? `${Math.min(fromIdx, toIdx)}<->${Math.max(fromIdx, toIdx)}`
      : `${fromIdx}->${toIdx}`;
    if (seenEdges.has(key)) return false;
    seenEdges.add(key);
    edges.push({
      from: `box_${fromIdx}`,
      to: `box_${toIdx}`,
      ...(label ? { label } : {}),
      ...(bidirectional ? { bidirectional: true } : {}),
    });
    return true;
  };

  for (let i = 0; i < mergedBoxes.length; i++) {
    for (let j = 0; j < mergedBoxes.length; j++) {
      if (i === j) continue;
      const left = mergedBoxes[i];
      const right = mergedBoxes[j];
      if (left.c2 >= right.c1 || right.c1 - left.c2 > 48) continue;
      const rOverlapStart = Math.max(left.r1, right.r1);
      const rOverlapEnd = Math.min(left.r2, right.r2);
      if (rOverlapEnd - rOverlapStart < 2) continue;
      let blocked = false;
      for (let r = rOverlapStart; r <= rOverlapEnd && !blocked; r++) {
        for (let c = left.c2 + 1; c < right.c1; c++) {
          if (ownerGrid[r][c] !== -1) {
            blocked = true;
            break;
          }
        }
      }
      if (blocked) continue;
      let hasLeftTip = false;
      let hasRightTip = false;
      const labelTokens: string[] = [];
      for (let r = rOverlapStart; r <= rOverlapEnd; r++) {
        const normSlice = normLines[r].slice(left.c2 + 1, right.c1).replace(/\x00/g, '').trim();
        const rawSlice = (rawLines[r] || '').padEnd(maxCols, ' ').slice(left.c2 + 1, right.c1).replace(/\x00/g, '').trim();
        if (!normSlice) continue;
        if (/^<?[-=]+>?$/.test(normSlice)) {
          if (normSlice.startsWith('<')) hasLeftTip = true;
          if (normSlice.endsWith('>')) hasRightTip = true;
        } else {
          const inlineArrow = normSlice.match(/^(<)?[-=]+\s*(.+?)\s*[-=]+(>)?$/);
          if (inlineArrow && (inlineArrow[1] || inlineArrow[3])) {
            if (inlineArrow[1]) hasLeftTip = true;
            if (inlineArrow[3]) hasRightTip = true;
            const rawClean = rawSlice
              .replace(/^[<>=\-|]+\s*/, '')
              .replace(/\s*[<>=\-|]+$/, '')
              .trim();
            if (rawClean) labelTokens.push(rawClean);
          } else {
            const cleanLbl = rawSlice.replace(/^[<>=\-|]+|(?:--+|==+|[<>|])+$/g, '').trim();
            if (cleanLbl) labelTokens.push(cleanLbl);
          }
        }
      }
      if (hasLeftTip || hasRightTip) {
        let joinedLabel = '';
        for (const tok of labelTokens) {
          if (!joinedLabel) joinedLabel = tok;
          else if (joinedLabel.endsWith('-')) joinedLabel = joinedLabel.slice(0, -1) + tok;
          else joinedLabel += ` ${tok}`;
        }
        if (hasLeftTip && hasRightTip) {
          addEdge(i, j, joinedLabel, true);
        } else if (hasRightTip) {
          if (addEdge(i, j, joinedLabel, false)) horizDirectedCount++;
        } else {
          if (addEdge(j, i, joinedLabel, false)) horizDirectedCount++;
        }
      }
    }
  }

  const visitedConn = Array.from({ length: normLines.length }, () => new Uint8Array(maxCols));
  const isWireChar = (ch: string) =>
    ch === '|' || ch === '+' || ch === '-' || ch === 'v' || ch === 'V' || ch === '^';
  const dirs = [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
  ];
  for (let r = 0; r < normLines.length; r++) {
    for (let c = 0; c < maxCols; c++) {
      if (ownerGrid[r][c] !== -1 || visitedConn[r][c] || !isWireChar(normLines[r][c])) continue;
      const queue: Array<[number, number]> = [[r, c]];
      visitedConn[r][c] = 1;
      const sources = new Set<number>();
      const targets = new Set<number>();
      let head = 0;
      while (head < queue.length) {
        const [cr, cc] = queue[head++];
        const ch = normLines[cr][cc];
        if (cr + 1 < normLines.length && ownerGrid[cr + 1][cc] !== -1) {
          const belowBox = ownerGrid[cr + 1][cc];
          if (ch === 'v' || ch === 'V' || ch === '|' || ch === '+') targets.add(belowBox);
        }
        if (cr - 1 >= 0 && ownerGrid[cr - 1][cc] !== -1) {
          const aboveBox = ownerGrid[cr - 1][cc];
          if (ch === '^') targets.add(aboveBox);
          else if (ch === '|' || ch === '+') sources.add(aboveBox);
        }
        for (const [dr, dc] of dirs) {
          const nr = cr + dr;
          const nc = cc + dc;
          if (
            nr >= 0 &&
            nr < normLines.length &&
            nc >= 0 &&
            nc < maxCols &&
            ownerGrid[nr][nc] === -1 &&
            !visitedConn[nr][nc] &&
            isWireChar(normLines[nr][nc])
          ) {
            visitedConn[nr][nc] = 1;
            queue.push([nr, nc]);
          }
        }
      }
      sources.forEach((sIdx) => {
        targets.forEach((tIdx) => {
          if (sIdx !== tIdx && addEdge(sIdx, tIdx, '', false)) vertDirectedCount++;
        });
      });
    }
  }

  if (edges.length === 0) return undefined;
  const direction: NormalizedA2uiFlowDiagram['direction'] =
    vertDirectedCount === 0 && horizDirectedCount > 0 ? 'LR' : 'TD';
  return {
    direction,
    nodes,
    edges,
  };
}

export function extractDiagramsFromMarkdown(markdown: string): NormalizedA2uiFlowDiagram[] {
  const out: NormalizedA2uiFlowDiagram[] = [];
  if (!markdown) return out;
  const normalized = String(markdown).replace(/\r\n/g, '\n');
  const fenceRegex = /^```([^\n]*)\n([\s\S]*?)^```\s*$/gm;
  let m: RegExpExecArray | null;
  while ((m = fenceRegex.exec(normalized)) !== null) {
    const lang = (String(m[1] || '').trim().toLowerCase().split(/\s+/)[0] || '').trim();
    const codeBody = m[2] || '';
    if (lang === 'mermaid') {
      const parsed = parseMermaidFlowchartSpec(codeBody);
      if (parsed) out.push(parsed);
    } else if (!lang || lang === 'text' || lang === 'plaintext' || lang === 'ascii' || lang === 'diagram') {
      const parsed = parseAsciiBoxDiagramSpec(codeBody);
      if (parsed) out.push(parsed);
    }
  }
  return out;
}

export function normalizeFlowDiagramSpec(raw: unknown): NormalizedA2uiFlowDiagram | undefined {
  if (!raw) return undefined;
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return undefined;
    const parsed = parseMermaidFlowchartSpec(trimmed) || parseAsciiBoxDiagramSpec(trimmed);
    return parsed || { mermaid: trimmed };
  }
  if (typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const obj = raw as Record<string, any>;
  if (typeof obj.mermaid === 'string' && obj.mermaid.trim()) {
    const rawDir = String(obj.direction || '').trim().toUpperCase();
    const direction =
      rawDir === 'TD' || rawDir === 'TB' || rawDir === 'LR' || rawDir === 'RL' ? rawDir : undefined;
    const parsed = parseMermaidFlowchartSpec(obj.mermaid);
    return {
      ...(typeof obj.title === 'string' && obj.title.trim() ? { title: obj.title.trim() } : {}),
      direction: direction || parsed?.direction || 'TD',
      mermaid: obj.mermaid.trim(),
      ...(parsed?.nodes ? { nodes: parsed.nodes } : {}),
      ...(parsed?.edges ? { edges: parsed.edges } : {}),
    };
  }
  const rawNodes = Array.isArray(obj.nodes) ? obj.nodes : [];
  if (rawNodes.length === 0) return undefined;
  const nodes: NormalizedA2uiFlowDiagramNode[] = rawNodes
    .map((n: any, idx: number): NormalizedA2uiFlowDiagramNode | null => {
      if (!n || typeof n !== 'object') return null;
      const id = String(n.id || `node_${idx + 1}`).trim();
      const title = String(n.title || n.label || id).trim();
      if (!id || !title) return null;
      const subtitle = String(n.subtitle || n.badge || n.code || '').trim();
      const group = String(n.group || n.subgraph || '').trim();
      const bullets = Array.isArray(n.bullets || n.items)
        ? (n.bullets || n.items).map((b: unknown) => String(b || '').trim()).filter(Boolean)
        : [];
      const rawShape = String(n.shape || '').trim().toLowerCase();
      const shape: NormalizedA2uiFlowDiagramNode['shape'] =
        rawShape === 'round' || rawShape === 'stadium' || rawShape === 'diamond'
          ? rawShape
          : undefined;
      return {
        id,
        title,
        ...(subtitle ? { subtitle } : {}),
        ...(group ? { group } : {}),
        ...(bullets.length > 0 ? { bullets } : {}),
        ...(shape ? { shape } : {}),
      };
    })
    .filter((n: NormalizedA2uiFlowDiagramNode | null): n is NormalizedA2uiFlowDiagramNode => Boolean(n));
  if (nodes.length === 0) return undefined;
  const rawEdges = Array.isArray(obj.edges) ? obj.edges : [];
  const edges: NormalizedA2uiFlowDiagramEdge[] = rawEdges
    .map((e: any) => {
      if (!e || typeof e !== 'object') return null;
      const from = String(e.from || e.source || '').trim();
      const to = String(e.to || e.target || '').trim();
      if (!from || !to) return null;
      const label = String(e.label || '').trim();
      return {
        from,
        to,
        ...(label ? { label } : {}),
        ...(e.bidirectional ? { bidirectional: true } : {}),
        ...(e.dashed ? { dashed: true } : {}),
      };
    })
    .filter((e: NormalizedA2uiFlowDiagramEdge | null): e is NormalizedA2uiFlowDiagramEdge => Boolean(e));
  const rawDir = String(obj.direction || '').trim().toUpperCase();
  const direction: NormalizedA2uiFlowDiagram['direction'] =
    rawDir === 'TD' || rawDir === 'TB' || rawDir === 'LR' || rawDir === 'RL' ? rawDir : 'TD';
  return {
    ...(typeof obj.title === 'string' && obj.title.trim() ? { title: obj.title.trim() } : {}),
    direction,
    nodes,
    edges,
  };
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
  spokenActionItem?: string;
  bullets: string[];
  diagram?: NormalizedA2uiFlowDiagram;
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
  overviewDiagram?: NormalizedA2uiFlowDiagram;
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
  const highlights = rawHighlights
    .map((h) =>
      String(h || '')
        .trim()
        .replace(/^(?:[-*+•]\s+|\d+[.)]\s+)/, '')
        .trim()
    )
    .filter(Boolean);

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
    const spokenActionItem = String(
      rawMod.spokenActionItem || rawMod.actionItemSpoken || ''
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
    const bullets = bulletsRaw
      .map((b: unknown) =>
        String(b || '')
          .trim()
          .replace(/^(?:[-*+•]\s+|\d+[.)]\s+)/, '')
          .trim()
      )
      .filter(Boolean);
    const modVisualPrompt = String(
      rawMod.visualPrompt ||
        rawMod.imagePrompt ||
        rawMod.illustrationPrompt ||
        rawMod.sceneFocus ||
        ''
    ).trim();
    const modDiagram = normalizeFlowDiagramSpec(
      rawMod.diagram ?? rawMod.flowDiagram ?? rawMod.architectureDiagram ?? rawMod.mermaidDiagram
    );
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
      ...(spokenActionItem ? { spokenActionItem } : {}),
      bullets,
      ...(modDiagram ? { diagram: modDiagram } : {}),
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
        const preChecked =
          Boolean(typeof it === 'object' && it !== null && it.checked) ||
          /^\s*(?:[-*+•]\s*)?\[[xX]\]\s+/.test(rawLabel);
        const strippedBulletLabel = rawLabel.replace(
          /^\s*(?:[-*+•]\s+(?:\[[ xX]\]\s+)?|\[[ xX]\]\s+|\d+[.)]\s+)/,
          ''
        );
        const cleaned = cleanChecklistLabel(strippedBulletLabel);
        if (!cleaned) return;
        chkCounter++;
        items.push({
          id: `chk_s2_${chkCounter}`,
          label: cleaned,
          checked: preChecked,
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
  const overviewDiagram = normalizeFlowDiagramSpec(
    scriptDraft.overviewDiagram ??
      scriptDraft.diagram ??
      scriptDraft.flowDiagram ??
      scriptDraft.architectureDiagram
  );
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
    ...(overviewDiagram ? { overviewDiagram } : {}),
    highlights,
    modules,
    quiz,
    cases,
    checklistGroups,
  };
}
