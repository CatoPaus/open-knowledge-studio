import { normalizeIsoTimestamp } from './timestamps.js';

export type TrustTier = 'unverified' | 'machine-confirmed' | 'human-reviewed';

export interface OKFActorEvent {
  by: string;
  at?: string;
}

export interface OKFSource {
  id?: string;
  resource: string;
  url?: string;
  title?: string;
  mime_type?: string;
  retrieved_at?: string;
  last_modified?: string;
  author?: string;
  usage_count?: number;
  usage_window?: { from: string; to: string };
}

export interface OKFFrontmatter {
  okf_version?: string;
  type?: string;
  resource?: string;
  title?: string;
  description?: string;
  license?: string;
  tags?: string[];
  status?: 'draft' | 'stable' | 'deprecated' | string;
  superseded_by?: string;
  runtime?: string;
  parameters?: Array<{ name: string; type: string; required?: boolean }>;
  computation?: string;
  executor?: { resource: string; receipt?: string[] };
  attester?: { resource: string };
  generated?: OKFActorEvent;
  verified?: OKFActorEvent | OKFActorEvent[];
  stale_after?: string | null;
  sources?: OKFSource[];
  usage_window?: { from: string; to: string };
  [key: string]: any;
}

export interface OKFDocument {
  frontmatter: OKFFrontmatter;
  body: string;
  hasFrontmatter?: boolean;
}

export const RESERVED_OKF_FILENAMES = new Set(['index.md', 'log.md']);

const PREFERRED_OKF_KEY_ORDER = [
  'okf_version',
  'type',
  'resource',
  'title',
  'description',
  'license',
  'tags',
  'status',
  'superseded_by',
  'runtime',
  'parameters',
  'computation',
  'executor',
  'attester',
  'generated',
  'verified',
  'stale_after',
  'sources',
  'usage_window',
];

const PREFERRED_OKF_SOURCE_KEY_ORDER = [
  'id',
  'resource',
  'title',
  'mime_type',
  'retrieved_at',
  'last_modified',
  'author',
  'usage_count',
  'usage_window',
];

function stripYamlComment(raw: string): string {
  let inSingle = false;
  let inDouble = false;
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (ch === "'" && !inDouble) {
      inSingle = !inSingle;
    } else if (ch === '"' && !inSingle && raw[i - 1] !== '\\') {
      inDouble = !inDouble;
    } else if (ch === '#' && !inSingle && !inDouble) {
      if (i === 0 || /\s/.test(raw[i - 1])) {
        return raw.slice(0, i).trimEnd();
      }
    }
  }
  return raw.trim();
}

function splitYamlFlowItems(inner: string): string[] {
  const items: string[] = [];
  let current = '';
  let depthBracket = 0;
  let depthBrace = 0;
  let inSingle = false;
  let inDouble = false;

  for (let i = 0; i < inner.length; i++) {
    const ch = inner[i];
    if (ch === "'" && !inDouble) {
      inSingle = !inSingle;
      current += ch;
    } else if (ch === '"' && !inSingle && inner[i - 1] !== '\\') {
      inDouble = !inDouble;
      current += ch;
    } else if (!inSingle && !inDouble) {
      if (ch === '[') {
        depthBracket++;
        current += ch;
      } else if (ch === ']') {
        depthBracket = Math.max(0, depthBracket - 1);
        current += ch;
      } else if (ch === '{') {
        depthBrace++;
        current += ch;
      } else if (ch === '}') {
        depthBrace = Math.max(0, depthBrace - 1);
        current += ch;
      } else if (ch === ',' && depthBracket === 0 && depthBrace === 0) {
        if (current.trim() !== '') items.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    } else {
      current += ch;
    }
  }
  if (current.trim() !== '') items.push(current.trim());
  return items;
}

function parseYamlScalar(rawInput: string): any {
  const s = stripYamlComment(rawInput);
  if (s === '') return '';
  if (s === 'null' || s === '~') return null;
  if (s === 'true') return true;
  if (s === 'false') return false;
  if (s.startsWith('"') && s.endsWith('"') && s.length >= 2) {
    return s
      .slice(1, -1)
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '\r')
      .replace(/\\t/g, '\t')
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, '\\');
  }
  if (s.startsWith("'") && s.endsWith("'") && s.length >= 2) {
    return s.slice(1, -1).replace(/''/g, "'");
  }
  if (/^-?\d+$/.test(s)) {
    return parseInt(s, 10);
  }
  if (/^-?\d+\.\d+$/.test(s)) {
    return parseFloat(s);
  }
  // Keep RFC 3339 / ISO 8601 timestamps and strings as literal strings (OKF v0.3 YAML 1.2 convention)
  return s;
}

function findUnquotedColon(pair: string): number {
  let inSingle = false;
  let inDouble = false;
  for (let i = 0; i < pair.length; i++) {
    const ch = pair[i];
    if (ch === "'" && !inDouble) {
      inSingle = !inSingle;
    } else if (ch === '"' && !inSingle && pair[i - 1] !== '\\') {
      inDouble = !inDouble;
    } else if (ch === ':' && !inSingle && !inDouble) {
      if (i + 1 >= pair.length || /\s/.test(pair[i + 1])) {
        return i;
      }
    }
  }
  return pair.indexOf(':');
}

function parseYamlFlowValue(rawInput: string): any {
  const s = stripYamlComment(rawInput);
  if (s.startsWith('[') && s.endsWith(']')) {
    const inner = s.slice(1, -1).trim();
    if (!inner) return [];
    return splitYamlFlowItems(inner).map((item) => parseYamlFlowValue(item));
  }
  if (s.startsWith('{') && s.endsWith('}')) {
    const inner = s.slice(1, -1).trim();
    const obj: Record<string, any> = {};
    const seenFlowKeys = new Set<string>();
    if (!inner) return obj;
    for (const pair of splitYamlFlowItems(inner)) {
      const colonIdx = findUnquotedColon(pair);
      if (colonIdx === -1) continue;
      const k = parseYamlScalar(pair.slice(0, colonIdx).trim());
      const keyStr = String(k);
      if (seenFlowKeys.has(keyStr)) {
        throw new Error(`Duplicate YAML frontmatter key: ${keyStr}`);
      }
      seenFlowKeys.add(keyStr);
      const v = parseYamlFlowValue(pair.slice(colonIdx + 1).trim());
      obj[keyStr] = v;
    }
    return obj;
  }
  return parseYamlScalar(s);
}

function matchYamlKeyValue(text: string): { key: string; rest: string } | null {
  const m = text.match(/^([A-Za-z0-9_.\-]+|"[^"]+"|'[^']+'):(?:\s+(.*)|\s*)$/);
  if (!m) return null;
  const rawKey = m[1];
  const key = String(parseYamlScalar(rawKey));
  const rest = (m[2] ?? '').trim();
  return { key, rest };
}

/**
 * Zero-dependency OKF v0.3 YAML frontmatter + Markdown body parser.
 * Supports block mappings, block sequences, flow sequences/mappings, YAML 1.2 block scalars (`|` and `>`),
 * plain multi-line scalars, rejects duplicate mapping keys (`SPEC.md` §4), and leaves RFC 3339 timestamps as exact strings per SPEC.md §5.
 */
export function parseOkfDocument(text: string): OKFDocument {
  const cleanText = text.startsWith('\uFEFF') ? text.slice(1) : text;
  const lines = cleanText.split(/\r?\n/);
  if (lines.length === 0 || lines[0].trim() !== '---') {
    return { frontmatter: {}, body: cleanText, hasFrontmatter: false };
  }

  let endIdx = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === '---') {
      endIdx = i;
      break;
    }
  }
  if (endIdx === -1) {
    throw new Error('Unterminated YAML frontmatter block in OKF document');
  }

  const rawFmLines = lines.slice(1, endIdx);
  const parsedLines: Array<{
    indent: number;
    text: string;
    rawLine: string;
    isBlankOrComment: boolean;
  }> = [];

  for (const line of rawFmLines) {
    const rawIndent = line.match(/^\s*/)?.[0].length ?? 0;
    const cleaned = stripYamlComment(line);
    const trimmed = cleaned.trim();
    parsedLines.push({
      indent: rawIndent,
      text: trimmed,
      rawLine: line,
      isBlankOrComment: trimmed === '',
    });
  }

  function nextSignificantIndex(fromIdx: number): number {
    let idx = fromIdx;
    while (idx < parsedLines.length && parsedLines[idx].isBlankOrComment) {
      idx++;
    }
    return idx;
  }

  function parseBlockScalar(
    startIndex: number,
    parentIndent: number,
    style: '|' | '>',
    chomp: '-' | '+' | ''
  ): { value: string; nextIndex: number } {
    const contentLines: Array<{ isBlank: boolean; raw: string; indent: number }> = [];
    let i = startIndex;
    let blockIndent = -1;

    while (i < parsedLines.length) {
      const entry = parsedLines[i];
      const isTrulyEmpty = entry.rawLine.trim() === '';
      if (isTrulyEmpty) {
        contentLines.push({ isBlank: true, raw: '', indent: 0 });
        i++;
        continue;
      }
      if (entry.indent <= parentIndent) {
        break;
      }
      if (blockIndent === -1) {
        blockIndent = entry.indent;
      }
      const sliced =
        entry.rawLine.length >= blockIndent
          ? entry.rawLine.slice(blockIndent)
          : entry.rawLine.trimStart();
      contentLines.push({ isBlank: false, raw: sliced, indent: entry.indent });
      i++;
    }

    // Trim trailing blank lines unless chomp === '+'
    while (
      chomp !== '+' &&
      contentLines.length > 0 &&
      contentLines[contentLines.length - 1].isBlank
    ) {
      contentLines.pop();
    }

    if (contentLines.length === 0) {
      return { value: '', nextIndex: i };
    }

    let result = '';
    if (style === '|') {
      result = contentLines.map((l) => (l.isBlank ? '' : l.raw)).join('\n');
    } else {
      // Folded style (`>`): single newlines between normal lines fold into spaces; blank lines become paragraph breaks
      const paragraphs: string[] = [];
      let currentPara: string[] = [];
      for (const l of contentLines) {
        if (l.isBlank) {
          if (currentPara.length > 0) {
            paragraphs.push(currentPara.join(' '));
            currentPara = [];
          }
          paragraphs.push('');
        } else {
          currentPara.push(l.raw.trimEnd());
        }
      }
      if (currentPara.length > 0) {
        paragraphs.push(currentPara.join(' '));
      }
      result = paragraphs.join('\n').replace(/\n{2,}/g, '\n\n');
    }

    if (chomp === '+') {
      result = `${result}\n`;
    }
    return { value: result, nextIndex: i };
  }

  function parseKeyValueChild(
    kvRest: string,
    currentLineIdx: number,
    parentIndent: number
  ): { value: any; nextIndex: number } {
    const blockScalarMatch = kvRest.match(/^([|>])([+\-])?$/);
    if (blockScalarMatch) {
      return parseBlockScalar(
        currentLineIdx + 1,
        parentIndent,
        blockScalarMatch[1] as '|' | '>',
        (blockScalarMatch[2] || '') as '-' | '+' | ''
      );
    }

    if (kvRest !== '') {
      return { value: parseYamlFlowValue(kvRest), nextIndex: currentLineIdx + 1 };
    }

    const nextIdx = nextSignificantIndex(currentLineIdx + 1);
    if (nextIdx < parsedLines.length && parsedLines[nextIdx].indent > parentIndent) {
      return parseYamlNode(nextIdx, parsedLines[nextIdx].indent);
    }
    return { value: '', nextIndex: nextIdx };
  }

  function parseYamlNode(
    startIndex: number,
    minIndent: number
  ): { value: any; nextIndex: number } {
    const firstIdx = nextSignificantIndex(startIndex);
    if (firstIdx >= parsedLines.length) {
      return { value: {}, nextIndex: firstIdx };
    }
    const first = parsedLines[firstIdx];
    if (first.indent < minIndent) {
      return { value: {}, nextIndex: firstIdx };
    }

    // Sequence block (`- ...`)
    if (first.text === '-' || first.text.startsWith('- ')) {
      const arr: any[] = [];
      const seqIndent = first.indent;
      let i = firstIdx;

      while (i < parsedLines.length) {
        i = nextSignificantIndex(i);
        if (i >= parsedLines.length) break;
        const cur = parsedLines[i];
        if (cur.indent < seqIndent) break;
        if (cur.indent > seqIndent) {
          i++;
          continue;
        }
        if (cur.text !== '-' && !cur.text.startsWith('- ')) break;

        const itemRest = cur.text.slice(1).trim();
        if (!itemRest) {
          const nextIdx = nextSignificantIndex(i + 1);
          if (nextIdx < parsedLines.length && parsedLines[nextIdx].indent > seqIndent) {
            const child = parseYamlNode(nextIdx, parsedLines[nextIdx].indent);
            arr.push(child.value);
            i = child.nextIndex;
          } else {
            arr.push(null);
            i = nextIdx;
          }
          continue;
        }

        const itemBlockMatch = itemRest.match(/^([|>])([+\-])?$/);
        if (itemBlockMatch) {
          const child = parseBlockScalar(
            i + 1,
            seqIndent,
            itemBlockMatch[1] as '|' | '>',
            (itemBlockMatch[2] || '') as '-' | '+' | ''
          );
          arr.push(child.value);
          i = child.nextIndex;
          continue;
        }

        if (itemRest.startsWith('{') || itemRest.startsWith('[')) {
          arr.push(parseYamlFlowValue(itemRest));
          i++;
          continue;
        }

        const kv = matchYamlKeyValue(itemRest);
        if (kv) {
          const itemObj: Record<string, any> = {};
          const seenItemKeys = new Set<string>([kv.key]);
          const itemPropIndent = seqIndent + 2;
          const firstProp = parseKeyValueChild(kv.rest, i, seqIndent);
          itemObj[kv.key] = firstProp.value;
          i = firstProp.nextIndex;

          while (i < parsedLines.length) {
            i = nextSignificantIndex(i);
            if (i >= parsedLines.length) break;
            const propLine = parsedLines[i];
            if (propLine.indent <= seqIndent) break;
            if (
              propLine.indent === seqIndent &&
              (propLine.text === '-' || propLine.text.startsWith('- '))
            ) {
              break;
            }
            const propKv = matchYamlKeyValue(propLine.text);
            if (!propKv) {
              i++;
              continue;
            }
            if (seenItemKeys.has(propKv.key)) {
              throw new Error(`Duplicate YAML frontmatter key: ${propKv.key}`);
            }
            seenItemKeys.add(propKv.key);
            const propRes = parseKeyValueChild(
              propKv.rest,
              i,
              Math.max(propLine.indent, itemPropIndent - 1)
            );
            itemObj[propKv.key] = propRes.value;
            i = propRes.nextIndex;
          }
          arr.push(itemObj);
          continue;
        }

        arr.push(parseYamlFlowValue(itemRest));
        i++;
      }

      return { value: arr, nextIndex: i };
    }

    // Plain multi-line continuation scalar (indented lines that are neither `-` nor `key: value`)
    if (!matchYamlKeyValue(first.text)) {
      const scalarParts: string[] = [];
      const scalarIndent = first.indent;
      let i = firstIdx;
      while (i < parsedLines.length) {
        i = nextSignificantIndex(i);
        if (i >= parsedLines.length) break;
        const cur = parsedLines[i];
        if (cur.indent < scalarIndent) break;
        if (
          cur.text === '-' ||
          cur.text.startsWith('- ') ||
          Boolean(matchYamlKeyValue(cur.text))
        ) {
          break;
        }
        scalarParts.push(cur.text);
        i++;
      }
      return { value: parseYamlScalar(scalarParts.join(' ')), nextIndex: i };
    }

    // Mapping block (`key: ...`)
    const obj: Record<string, any> = {};
    const seenMapKeys = new Set<string>();
    const mapIndent = first.indent;
    let i = firstIdx;

    while (i < parsedLines.length) {
      i = nextSignificantIndex(i);
      if (i >= parsedLines.length) break;
      const cur = parsedLines[i];
      if (cur.indent < mapIndent) break;
      if (cur.text === '-' || cur.text.startsWith('- ')) break;
      const kv = matchYamlKeyValue(cur.text);
      if (!kv) {
        i++;
        continue;
      }
      if (seenMapKeys.has(kv.key)) {
        throw new Error(`Duplicate YAML frontmatter key: ${kv.key}`);
      }
      seenMapKeys.add(kv.key);

      const childRes = parseKeyValueChild(kv.rest, i, cur.indent);
      obj[kv.key] = childRes.value;
      i = childRes.nextIndex;
    }

    return { value: obj, nextIndex: i };
  }

  const firstSigIdx = nextSignificantIndex(0);
  const rootParsed =
    firstSigIdx < parsedLines.length
      ? parseYamlNode(firstSigIdx, parsedLines[firstSigIdx].indent).value
      : {};
  if (!rootParsed || typeof rootParsed !== 'object' || Array.isArray(rootParsed)) {
    throw new Error('OKF frontmatter must be a YAML mapping');
  }

  let body = lines.slice(endIdx + 1).join('\n');
  if (body.startsWith('\n')) {
    body = body.slice(1);
  }

  return {
    frontmatter: rootParsed as OKFFrontmatter,
    body,
    hasFrontmatter: true,
  };
}

function formatYamlScalar(val: any, inFlowContext: boolean = false): string {
  if (val === null || val === undefined) return 'null';
  if (typeof val === 'boolean' || typeof val === 'number') return String(val);
  const s = String(val);
  if (s === '') return '""';
  const needsQuotes =
    /[:#\[\]{}&*!|>'"%@`\-?]/.test(s[0]) ||
    s.endsWith(':') ||
    /:\s/.test(s) ||
    /\s#/.test(s) ||
    /[\r\n\t]/.test(s) ||
    /^\s|\s$/.test(s) ||
    (inFlowContext && /[,[\]{}]/.test(s)) ||
    /^(true|false|null|~|-?\d+(\.\d+)?)$/i.test(s);
  if (needsQuotes) {
    return `"${s
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\r/g, '\\r')
      .replace(/\n/g, '\\n')
      .replace(/\t/g, '\\t')}"`;
  }
  return s;
}

function serializeYamlKeyValue(key: string, val: any, indent: string = ''): string[] {
  if (val === undefined) return [];
  if (val === null || typeof val === 'boolean' || typeof val === 'number' || typeof val === 'string') {
    if (key === 'okf_version') {
      return [`${indent}${key}: "${String(val).replace(/"/g, '')}"`];
    }
    const normalizedScalar =
      typeof val === 'string' &&
      (key === 'retrieved_at' || key === 'last_modified' || key === 'stale_after' || key === 'at')
        ? normalizeIsoTimestamp(val)
        : val;
    return [`${indent}${key}: ${formatYamlScalar(normalizedScalar)}`];
  }

  if (Array.isArray(val)) {
    if (val.length === 0) {
      return [`${indent}${key}: []`];
    }
    const allScalars = val.every(
      (item) => typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean'
    );
    if (allScalars) {
      return [`${indent}${key}: [${val.map((v) => formatYamlScalar(v, true)).join(', ')}]`];
    }
    const lines = [`${indent}${key}:`];
    for (const item of val) {
      if (item && typeof item === 'object' && !Array.isArray(item)) {
        const rawKeys = Object.keys(item).filter((k) => item[k] !== undefined);
        const keys =
          key === 'sources'
            ? [
                ...PREFERRED_OKF_SOURCE_KEY_ORDER.filter((k) => rawKeys.includes(k)),
                ...rawKeys.filter((k) => !PREFERRED_OKF_SOURCE_KEY_ORDER.includes(k)),
              ]
            : rawKeys;
        // Compact inline mapping for { by, at } or { name, type, required }
        if (
          keys.length <= 3 &&
          keys.every(
            (k) =>
              ['by', 'at', 'name', 'type', 'required', 'from', 'to'].includes(k) &&
              (item[k] === null ||
                typeof item[k] === 'string' ||
                typeof item[k] === 'number' ||
                typeof item[k] === 'boolean')
          )
        ) {
          const pairs = keys
            .map((k) => {
              const rawItemVal = item[k];
              const normItemVal =
                typeof rawItemVal === 'string' && (k === 'at' || k === 'from' || k === 'to')
                  ? normalizeIsoTimestamp(rawItemVal)
                  : rawItemVal;
              return `${k}: ${formatYamlScalar(normItemVal, true)}`;
            })
            .join(', ');
          lines.push(`${indent}  - { ${pairs} }`);
        } else {
          keys.forEach((k, idx) => {
            const prefix = idx === 0 ? `${indent}  - ` : `${indent}    `;
            const rawV = item[k];
            const v =
              typeof rawV === 'string' &&
              (k === 'retrieved_at' || k === 'last_modified' || k === 'stale_after' || k === 'at')
                ? normalizeIsoTimestamp(rawV)
                : rawV;
            if (Array.isArray(v)) {
              const vScalars = v.every(
                (sub) =>
                  typeof sub === 'string' || typeof sub === 'number' || typeof sub === 'boolean'
              );
              if (v.length === 0) {
                lines.push(`${prefix}${k}: []`);
              } else if (vScalars) {
                lines.push(
                  `${prefix}${k}: [${v.map((sub) => formatYamlScalar(sub, true)).join(', ')}]`
                );
              } else {
                const subLines = serializeYamlKeyValue(k, v, `${indent}    `);
                if (idx === 0 && subLines.length > 0) {
                  lines.push(`${indent}  - ${subLines[0].trimStart()}`);
                  lines.push(...subLines.slice(1));
                } else {
                  lines.push(...subLines);
                }
              }
            } else if (v && typeof v === 'object') {
              const subEntries = Object.entries(v).filter(([, sv]) => sv !== undefined);
              const allSubScalars = subEntries.every(
                ([, sv]) =>
                  sv === null ||
                  typeof sv === 'string' ||
                  typeof sv === 'number' ||
                  typeof sv === 'boolean'
              );
              if (subEntries.length === 0) {
                lines.push(`${prefix}${k}: {}`);
              } else if (allSubScalars && subEntries.length <= 4) {
                const subPairs = subEntries
                  .map(([sk, sv]) => {
                    const normSv =
                      typeof sv === 'string' && (sk === 'at' || sk === 'from' || sk === 'to')
                        ? normalizeIsoTimestamp(sv)
                        : sv;
                    return `${sk}: ${formatYamlScalar(normSv, true)}`;
                  })
                  .join(', ');
                lines.push(`${prefix}${k}: { ${subPairs} }`);
              } else {
                const subLines = serializeYamlKeyValue(k, v, `${indent}    `);
                if (idx === 0 && subLines.length > 0) {
                  lines.push(`${indent}  - ${subLines[0].trimStart()}`);
                  lines.push(...subLines.slice(1));
                } else {
                  lines.push(...subLines);
                }
              }
            } else {
              lines.push(`${prefix}${k}: ${formatYamlScalar(v)}`);
            }
          });
        }
      } else {
        lines.push(`${indent}  - ${formatYamlScalar(item)}`);
      }
    }
    return lines;
  }

  if (typeof val === 'object') {
    const entries = Object.entries(val).filter(([, v]) => v !== undefined);
    if (entries.length === 0) return [`${indent}${key}: {}`];
    const isCompactActorOrWindow = entries.every(
      ([k, v]) =>
        ['by', 'at', 'from', 'to'].includes(k) &&
        (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean')
    );
    if (isCompactActorOrWindow) {
      const pairs = entries
        .map(([k, v]) => {
          const normV =
            typeof v === 'string' && (k === 'at' || k === 'from' || k === 'to')
              ? normalizeIsoTimestamp(v)
              : v;
          return `${k}: ${formatYamlScalar(normV, true)}`;
        })
        .join(', ');
      return [`${indent}${key}: { ${pairs} }`];
    }
    const lines = [`${indent}${key}:`];
    for (const [subKey, subVal] of entries) {
      lines.push(...serializeYamlKeyValue(subKey, subVal, `${indent}  `));
    }
    return lines;
  }

  return [`${indent}${key}: ${formatYamlScalar(val)}`];
}

/**
 * Serializes an OKFDocument into UTF-8 Markdown with ordered YAML frontmatter (`SPEC.md` §4).
 */
export function serializeOkfDocument(doc: OKFDocument): string {
  const fm = doc.frontmatter || {};
  const orderedKeys: string[] = [];
  for (const key of PREFERRED_OKF_KEY_ORDER) {
    if (key in fm && fm[key] !== undefined) {
      orderedKeys.push(key);
    }
  }
  for (const key of Object.keys(fm)) {
    if (!orderedKeys.includes(key) && fm[key] !== undefined) {
      orderedKeys.push(key);
    }
  }

  const fmLines: string[] = [];
  for (const key of orderedKeys) {
    fmLines.push(...serializeYamlKeyValue(key, fm[key]));
  }

  const trimmedBody = (doc.body || '').replace(/^\r?\n+/, '');
  const finalBody = trimmedBody.endsWith('\n') ? trimmedBody : `${trimmedBody}\n`;
  if (fmLines.length === 0) {
    return finalBody;
  }
  return `---\n${fmLines.join('\n')}\n---\n\n${finalBody}`;
}

/**
 * Returns true when an OKF frontmatter value is absent under `SPEC.md` §11.2
 * (`undefined`, `null`, `""`, or `[]`).
 */
export function isOkfBlank(value: unknown): boolean {
  return (
    value === undefined ||
    value === null ||
    value === '' ||
    (Array.isArray(value) && value.length === 0)
  );
}

const OKF_DATE_ONLY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const OKF_DATETIME_RE =
  /^(\d{4})-(\d{2})-(\d{2})[Tt](\d{2}):(\d{2}):(\d{2})(?:\.\d+)?([Zz]|([+\-])(\d{2}):(\d{2}))$/;

function isValidCalendarDate(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12 || day < 1) return false;
  const isLeap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  const daysInMonth = [31, isLeap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day <= daysInMonth[month - 1];
}

/**
 * Strictly parses an OKF v0.3 RFC 3339 date-time with explicit offset (`Z` or `[+-]HH:MM`)
 * or date-only `YYYY-MM-DD` (`YYYY-MM-DDT00:00:00Z`) per `SPEC.md` §5.
 * Returns `undefined` for any malformed or non-string value.
 */
export function parseOkfTimestampMs(value: unknown): number | undefined {
  if (typeof value !== 'string') return undefined;
  const raw = value.trim();
  if (!raw) return undefined;

  const dateMatch = raw.match(OKF_DATE_ONLY_RE);
  if (dateMatch) {
    const year = Number(dateMatch[1]);
    const month = Number(dateMatch[2]);
    const day = Number(dateMatch[3]);
    if (!isValidCalendarDate(year, month, day)) return undefined;
    const ms = Date.parse(`${raw}T00:00:00Z`);
    return Number.isNaN(ms) ? undefined : ms;
  }

  const dtMatch = raw.match(OKF_DATETIME_RE);
  if (!dtMatch) return undefined;
  const year = Number(dtMatch[1]);
  const month = Number(dtMatch[2]);
  const day = Number(dtMatch[3]);
  const hour = Number(dtMatch[4]);
  const minute = Number(dtMatch[5]);
  const second = Number(dtMatch[6]);
  if (!isValidCalendarDate(year, month, day)) return undefined;
  if (hour > 23 || minute > 59 || second > 60) return undefined;
  if (dtMatch[8]) {
    const offH = Number(dtMatch[9]);
    const offM = Number(dtMatch[10]);
    if (offH > 23 || offM > 59) return undefined;
  }
  const normalized = raw.replace(/^(\d{4}-\d{2}-\d{2})t/, '$1T').replace(/z$/, 'Z');
  const ms = Date.parse(normalized);
  return Number.isNaN(ms) ? undefined : ms;
}

/**
 * Normalizes `tags` frontmatter per `SPEC.md` §4.1 & §11.2:
 * `null` / `""` / `[]` => `[]`; a scalar string is treated as a single tag without splitting at commas.
 */
export function normalizeOkfTags(rawTags: unknown): string[] {
  if (isOkfBlank(rawTags)) return [];
  if (Array.isArray(rawTags)) {
    return rawTags
      .filter((t) => t !== undefined && t !== null && String(t) !== '')
      .map((t) => String(t));
  }
  return [String(rawTags)];
}

/**
 * Normalizes `sources` frontmatter per `SPEC.md` §5.1 & §11.2:
 * A bare source mapping stands for a single-element list; entries missing `resource` are ignored.
 */
export function normalizeOkfSources(frontmatter: Record<string, any>): OKFSource[] {
  const raw = frontmatter?.sources;
  if (isOkfBlank(raw)) return [];
  const items = Array.isArray(raw) ? raw : [raw];
  return items.filter(
    (s): s is OKFSource =>
      Boolean(s) &&
      typeof s === 'object' &&
      !Array.isArray(s) &&
      typeof (s as any).resource === 'string' &&
      (s as any).resource.trim().length > 0
  );
}

/**
 * Normalizes an actor string into OKF v0.3 `<producer>/<version>` or `<scheme>:<id>` form (`SPEC.md` §7)
 * with no internal whitespace (`ACTOR_RE = /^([^\s/:]+\/\S+|[A-Za-z][A-Za-z0-9+.-]*:\S+)$/`).
 */
export function normalizeOkfActor(rawActor?: string, defaultScheme: string = 'human'): string {
  const raw = String(rawActor || '').trim();
  const cleanScheme = defaultScheme.replace(/[^A-Za-z0-9+.-]/g, '') || 'human';
  if (!raw) {
    const fallbackUser = String(process.env.USER || process.env.USERNAME || 'reviewer')
      .trim()
      .replace(/\s+/g, '-');
    return `${cleanScheme}:${fallbackUser || 'reviewer'}`;
  }
  const schemeMatch = raw.match(/^([A-Za-z][A-Za-z0-9+.-]*):(.*)$/);
  if (schemeMatch) {
    const scheme = schemeMatch[1].toLowerCase();
    const id = schemeMatch[2].trim().replace(/\s+/g, '-');
    return `${scheme}:${id || 'reviewer'}`;
  }
  const slashIdx = raw.indexOf('/');
  if (slashIdx > 0) {
    const producer = raw
      .slice(0, slashIdx)
      .trim()
      .replace(/[\s/:]+/g, '-');
    const version = raw
      .slice(slashIdx + 1)
      .trim()
      .replace(/\s+/g, '-');
    return `${producer || 'producer'}/${version || '1.0'}`;
  }
  return `${cleanScheme}:${raw.replace(/\s+/g, '-')}`;
}

/**
 * Returns true if `doc` is a valid OKF v0.3 concept (`SPEC.md` §3.2 rule 2:
 * has YAML frontmatter and a non-empty string `type`).
 */
export function isOkfConceptDocument(doc: OKFDocument): boolean {
  if (doc.hasFrontmatter === false) return false;
  const typeVal = doc.frontmatter?.type;
  return typeof typeVal === 'string' && typeVal.trim().length > 0;
}

/**
 * Validates OKF v0.3 conformance (`SPEC.md` §11.1: `type` is a non-empty string).
 */
export function validateOkfDocument(doc: OKFDocument): void {
  if (!isOkfConceptDocument(doc)) {
    throw new Error('Missing required OKF v0.3 frontmatter key: type');
  }
}

/**
 * Normalizes `verified` frontmatter into an array of `{ by, at }` events (`SPEC.md` §5.2 & §11.2).
 * Both `by` and `at` are required in an event; events missing either are ignored.
 * A bare `{ by, at }` mapping is treated as a single-element list.
 */
export function normalizeVerified(frontmatter: Record<string, any>): OKFActorEvent[] {
  const verified = frontmatter?.verified;
  if (isOkfBlank(verified)) return [];
  const items = Array.isArray(verified) ? verified : [verified];
  return items.filter(
    (v): v is OKFActorEvent =>
      Boolean(v) &&
      typeof v === 'object' &&
      !Array.isArray(v) &&
      typeof v.by === 'string' &&
      v.by.trim().length > 0 &&
      typeof v.at === 'string' &&
      v.at.trim().length > 0
  );
}

/**
 * Derives an OKF v0.3 trust tier from current `verified` events (`SPEC.md` §5.3):
 * - Events require valid `by` and `at`, and are current only when `generated` / `generated.at` is absent
 *   or `event.at >= generated.at`.
 * - No current verification event => `'unverified'`
 * - Current verification by non-`human:` actors only (`<producer>/<ver>`, `team:<id>`, `process:<id>`) => `'machine-confirmed'`
 * - Current verification by any `human:<id>` actor => `'human-reviewed'`
 */
export function getOkfTrustTier(frontmatter: Record<string, any>): TrustTier {
  const events = normalizeVerified(frontmatter);
  if (events.length === 0) return 'unverified';
  const genAtRaw =
    frontmatter?.generated &&
    typeof frontmatter.generated === 'object' &&
    !Array.isArray(frontmatter.generated)
      ? frontmatter.generated.at
      : undefined;
  const generatedMs = !isOkfBlank(genAtRaw) ? parseOkfTimestampMs(genAtRaw) : undefined;

  const currentEvents = events.filter((event) => {
    const eventMs = parseOkfTimestampMs(event.at);
    if (eventMs === undefined) return false;
    if (generatedMs !== undefined && eventMs < generatedMs) return false;
    return true;
  });

  if (currentEvents.length === 0) return 'unverified';
  for (const event of currentEvents) {
    const by = String(event.by || '').trim();
    if (by.startsWith('human:')) {
      return 'human-reviewed';
    }
  }
  return 'machine-confirmed';
}

export const trust_tier = getOkfTrustTier;

/**
 * Evaluates whether an OKF v0.3 concept is stale (`SPEC.md` §5.5 & §11.2):
 * - Absent / `null` / `""` `stale_after` => `false` (no expiry date).
 * - Unparseable non-empty `stale_after` (e.g. missing timezone offset or invalid date) => `true`
 *   ("Consumers MUST NOT treat a concept with an unparseable `stale_after` value as fresh").
 * - Valid RFC 3339 date-time or `YYYY-MM-DD` (`00:00:00Z`) => `now >= stale_after`.
 */
export function isOkfStale(frontmatter: Record<string, any>, now?: Date): boolean {
  const rawVal = frontmatter?.stale_after;
  if (isOkfBlank(rawVal)) return false;
  const staleAfterMs = parseOkfTimestampMs(rawVal);
  if (staleAfterMs === undefined) return true;
  const nowMs = (now ?? new Date()).getTime();
  return nowMs >= staleAfterMs;
}

export const is_stale = isOkfStale;

/**
 * Evaluates whether an OKF v0.3 concept's lifecycle `status` represents current knowledge (`SPEC.md` §5.4):
 * missing/blank `status` defaults to `'stable'` (`true`); `'draft'`, `'deprecated'`, and unknown values return `false`.
 */
export function isOkfStatusCurrent(frontmatter: Record<string, any>): boolean {
  const raw = frontmatter?.status;
  if (isOkfBlank(raw)) return true;
  return typeof raw === 'string' && raw.trim() === 'stable';
}

export function transliterateNordicAscii(str: string): string {
  return String(str || '')
    .replace(/æ/g, 'ae')
    .replace(/Æ/g, 'Ae')
    .replace(/ø/g, 'o')
    .replace(/Ø/g, 'O')
    .replace(/å/g, 'a')
    .replace(/Å/g, 'A')
    .replace(/ä/g, 'a')
    .replace(/Ä/g, 'A')
    .replace(/ö/g, 'o')
    .replace(/Ö/g, 'O')
    .replace(/ü/g, 'u')
    .replace(/Ü/g, 'U')
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export function truncateSlugAtWordBoundary(
  rawSlug: string,
  maxLen: number,
  minSnapPos = 12
): string {
  const clean = String(rawSlug || '').replace(/^-+|-+$/g, '');
  if (clean.length <= maxLen) {
    return clean;
  }
  const sliced = clean.slice(0, maxLen);
  if (clean[maxLen] === '-') {
    return sliced.replace(/-+$/g, '');
  }
  const lastDash = sliced.lastIndexOf('-');
  if (lastDash >= minSnapPos) {
    return sliced.slice(0, lastDash).replace(/-+$/g, '');
  }
  return sliced.replace(/-+$/g, '');
}
