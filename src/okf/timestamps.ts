export function parseValidIsoTimestamp(val: any): string | undefined {
  if (val === undefined || val === null || typeof val === 'boolean') return undefined;
  const s = String(val).trim();
  if (!s) return undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const ms = Date.parse(`${s}T00:00:00Z`);
    if (Number.isNaN(ms)) return undefined;
    return new Date(ms).toISOString().replace(/\.\d{3}Z$/, 'Z');
  }
  const isoCandidate = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(s)
    ? `${s.replace(' ', 'T')}Z`
    : s;
  const ms = Date.parse(isoCandidate);
  if (Number.isNaN(ms)) return undefined;
  return new Date(ms).toISOString().replace(/\.\d{3}Z$/, 'Z');
}

export function parseHttpLastModified(headerVal?: string | null): string | undefined {
  if (!headerVal || typeof headerVal !== 'string') return undefined;
  return parseValidIsoTimestamp(headerVal);
}

export function normalizeIsoTimestamp(val: any): string {
  const s = String(val ?? '').trim();
  if (!s) return '';
  return parseValidIsoTimestamp(s) || s;
}

/**
 * Decodes HTML named entities (including Nordic/Latin-1 entities such as &oslash;, &aelig;, &aring;,
 * &Oslash;, &AElig;, &Aring;, &ouml;, &auml;, &uuml;, &eacute;, &sect;, &laquo;, &raquo;, &ndash;, &mdash;, &nbsp;)
 * as well as decimal (`&#248;`) and hexadecimal (`&#x00F8;`) numeric character references.
 */
export function decodeHtmlEntities(text: string): string {
  if (!text || typeof text !== 'string') return '';
  return text
    .replace(/&oslash;/g, 'ø')
    .replace(/&Oslash;|&OSLASH;/g, 'Ø')
    .replace(/&aelig;/g, 'æ')
    .replace(/&AElig;|&AELIG;/g, 'Æ')
    .replace(/&aring;/g, 'å')
    .replace(/&Aring;|&ARING;/g, 'Å')
    .replace(/&ouml;/g, 'ö')
    .replace(/&Ouml;|&OUML;/g, 'Ö')
    .replace(/&auml;/g, 'ä')
    .replace(/&Auml;|&AUML;/g, 'Ä')
    .replace(/&uuml;/g, 'ü')
    .replace(/&Uuml;|&UUML;/g, 'Ü')
    .replace(/&eacute;/g, 'é')
    .replace(/&Eacute;|&EACUTE;/g, 'É')
    .replace(/&egrave;/g, 'è')
    .replace(/&Egrave;|&EGRAVE;/g, 'È')
    .replace(/&szlig;/g, 'ß')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&sect;/gi, '§')
    .replace(/&laquo;/gi, '«')
    .replace(/&raquo;/gi, '»')
    .replace(/&ndash;|&#8211;/gi, '–')
    .replace(/&mdash;|&#8212;/gi, '—')
    .replace(/&lsquo;|&rsquo;/gi, "'")
    .replace(/&ldquo;|&rdquo;/gi, '"')
    .replace(/&bull;/gi, '•')
    .replace(/&hellip;/gi, '…')
    .replace(/&deg;/gi, '°')
    .replace(/&plusmn;/gi, '±')
    .replace(/&times;/gi, '×')
    .replace(/&divide;/gi, '÷')
    .replace(/&#0*39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#x([0-9a-f]+);/gi, (m, hex) => {
      try {
        return String.fromCodePoint(parseInt(hex, 16));
      } catch {
        return m;
      }
    })
    .replace(/&#(\d+);/g, (m, code) => {
      try {
        return String.fromCodePoint(Number(code));
      } catch {
        return m;
      }
    })
    .replace(/&amp;/gi, '&');
}

function parseSaneDocTimestamp(val: any): string | undefined {
  const iso = parseValidIsoTimestamp(val);
  if (!iso) return undefined;
  const yr = Number(iso.slice(0, 4));
  const maxYr = new Date().getUTCFullYear() + 2;
  if (!Number.isFinite(yr) || yr < 1970 || yr > maxYr) return undefined;
  return iso;
}

/**
 * Extracts standard W3C / OpenGraph / Dublin Core / Schema.org document modification
 * (or fallback publication) timestamps from an HTML `<head>` / JSON-LD snippet.
 * Zero domain/keyword heuristics — purely protocol-level metadata (`OKF v0.3` §5.1 `last_modified`).
 */
export function extractHtmlModifiedFromSnippet(htmlSnippet: string): string | undefined {
  if (!htmlSnippet || typeof htmlSnippet !== 'string') return undefined;

  const findMetaContent = (keys: Set<string>): string | undefined => {
    const metaTagRe = /<meta\b[^>]*>/gi;
    let m: RegExpExecArray | null;
    while ((m = metaTagRe.exec(htmlSnippet)) !== null) {
      const tag = m[0];
      const attrMatch = tag.match(/\b(?:property|name|http-equiv|itemprop)\s*=\s*["']([^"']+)["']/i);
      const contentMatch = tag.match(/\bcontent\s*=\s*["']([^"']+)["']/i);
      if (attrMatch && contentMatch) {
        const key = attrMatch[1].trim().toLowerCase();
        if (keys.has(key)) {
          const parsed = parseSaneDocTimestamp(decodeHtmlEntities(contentMatch[1]));
          if (parsed) return parsed;
        }
      }
    }
    return undefined;
  };

  const findTimeItemprop = (propLower: string): string | undefined => {
    const timeTagRe = /<time\b[^>]*>/gi;
    let m: RegExpExecArray | null;
    while ((m = timeTagRe.exec(htmlSnippet)) !== null) {
      const tag = m[0];
      const propMatch = tag.match(/\bitemprop\s*=\s*["']([^"']+)["']/i);
      const dtMatch = tag.match(/\bdatetime\s*=\s*["']([^"']+)["']/i);
      if (propMatch && dtMatch && propMatch[1].trim().toLowerCase() === propLower) {
        const parsed = parseSaneDocTimestamp(decodeHtmlEntities(dtMatch[1]));
        if (parsed) return parsed;
      }
    }
    return undefined;
  };

  const findJsonLdDate = (field: 'dateModified' | 'datePublished'): string | undefined => {
    const re = new RegExp(`"${field}"\\s*:\\s*"([^"]{8,64})"`, 'i');
    const m = htmlSnippet.match(re);
    return m && m[1] ? parseSaneDocTimestamp(decodeHtmlEntities(m[1])) : undefined;
  };

  const modKeys = new Set([
    'article:modified_time',
    'og:updated_time',
    'dcterms.modified',
    'dc.date.modified',
    'last-modified',
    'datemodified',
  ]);
  const explicitMod =
    findMetaContent(modKeys) || findTimeItemprop('datemodified') || findJsonLdDate('dateModified');
  if (explicitMod) return explicitMod;

  const pubKeys = new Set([
    'article:published_time',
    'dcterms.issued',
    'dcterms.created',
    'dc.date',
    'datepublished',
  ]);
  return (
    findMetaContent(pubKeys) || findTimeItemprop('datepublished') || findJsonLdDate('datePublished')
  );
}

/**
 * Parses an ISO 32000-1 §7.9.4 PDF date string (`D:YYYYMMDDHHmmSSOHH'mm'`, including Quartz `Z00'00'`
 * and octal `\\047` escapes) or ISO 8601 timestamp into canonical UTC ISO 8601 (`YYYY-MM-DDTHH:MM:SSZ`).
 */
export function parsePdfDateToIso(raw: string): string | undefined {
  if (!raw || typeof raw !== 'string') return undefined;
  const cleaned = raw.replace(/\\047/g, "'").trim();
  if (!cleaned) return undefined;
  const body = cleaned.replace(/^D:\s*/i, '');
  const m = body.match(
    /^(\d{4})(\d{2})?(\d{2})?(\d{2})?(\d{2})?(\d{2})?(?:\.\d+)?\s*(Z(?:00'?00'?)?|[+-]\d{2}(?:'\d{2}'?|:\d{2}|\d{2})?)?$/i
  );
  if (m) {
    const yyyy = m[1];
    const mm = m[2] || '01';
    const dd = m[3] || '01';
    const hh = m[4] || '00';
    const min = m[5] || '00';
    const ss = m[6] || '00';
    const mmNum = Number(mm);
    const ddNum = Number(dd);
    const hhNum = Number(hh);
    const minNum = Number(min);
    const ssNum = Number(ss);
    if (
      mmNum >= 1 &&
      mmNum <= 12 &&
      ddNum >= 1 &&
      ddNum <= 31 &&
      hhNum >= 0 &&
      hhNum <= 23 &&
      minNum >= 0 &&
      minNum <= 59 &&
      ssNum >= 0 &&
      ssNum <= 60
    ) {
      const tzRaw = (m[7] || 'Z').trim();
      let tz = 'Z';
      if (tzRaw && !/^Z/i.test(tzRaw)) {
        const tzMatch = tzRaw.match(/^([+-])(\d{2})(?:[':]?(\d{2})'?)?$/);
        if (!tzMatch) return undefined;
        tz = `${tzMatch[1]}${tzMatch[2]}:${tzMatch[3] || '00'}`;
      }
      return parseSaneDocTimestamp(`${yyyy}-${mm}-${dd}T${hh}:${min}:${ss}${tz}`);
    }
  }
  return parseSaneDocTimestamp(cleaned);
}

/**
 * Extracts ISO 32000 `/Info` (`/ModDate`, fallback `/CreationDate`, both inline `(D:...)` and
 * indirect `<obj> <gen> R` objects) or Adobe XMP (`xmp:ModifyDate`, fallback `xmp:CreateDate`)
 * timestamps from a `'latin1'`-decoded PDF byte slice.
 */
export function extractPdfModifiedFromLatin1(pdfLatin1: string): string | undefined {
  if (!pdfLatin1 || typeof pdfLatin1 !== 'string') return undefined;

  const extractByPdfInfoKey = (key: 'ModDate' | 'CreationDate'): string | undefined => {
    let lastValid: string | undefined;
    const directRe = new RegExp(`\\/${key}\\s*\\(\\s*([^)\\r\\n]{4,64})\\)`, 'g');
    let dm: RegExpExecArray | null;
    while ((dm = directRe.exec(pdfLatin1)) !== null) {
      const parsed = parsePdfDateToIso(dm[1]);
      if (parsed) lastValid = parsed;
    }
    if (lastValid) return lastValid;

    const refRe = new RegExp(`\\/${key}\\s+(\\d+)\\s+(\\d+)\\s+R\\b`, 'g');
    let rm: RegExpExecArray | null;
    const refs: Array<[string, string]> = [];
    while ((rm = refRe.exec(pdfLatin1)) !== null) {
      refs.push([rm[1], rm[2]]);
    }
    for (let i = refs.length - 1; i >= 0; i--) {
      const [objNum, genNum] = refs[i];
      const objRe = new RegExp(
        `(?:^|[^0-9])${objNum}\\s+${genNum}\\s+obj\\s*\\(\\s*([^)\\r\\n]{4,64})\\)`,
        'g'
      );
      let om: RegExpExecArray | null;
      let objParsed: string | undefined;
      while ((om = objRe.exec(pdfLatin1)) !== null) {
        const p = parsePdfDateToIso(om[1]);
        if (p) objParsed = p;
      }
      if (objParsed) return objParsed;
    }
    return undefined;
  };

  const extractByXmpKey = (tag: 'ModifyDate' | 'CreateDate'): string | undefined => {
    let lastValid: string | undefined;
    const elRe = new RegExp(`<(?:xmp|xap):${tag}[^>]*>\\s*([^<]{8,64}?)\\s*<\\/(?:xmp|xap):${tag}>`, 'gi');
    let em: RegExpExecArray | null;
    while ((em = elRe.exec(pdfLatin1)) !== null) {
      const p = parsePdfDateToIso(em[1]);
      if (p) lastValid = p;
    }
    if (lastValid) return lastValid;

    const attrRe = new RegExp(`\\b(?:xmp|xap):${tag}\\s*=\\s*["']([^"']{8,64})["']`, 'gi');
    let am: RegExpExecArray | null;
    while ((am = attrRe.exec(pdfLatin1)) !== null) {
      const p = parsePdfDateToIso(am[1]);
      if (p) lastValid = p;
    }
    return lastValid;
  };

  return (
    extractByPdfInfoKey('ModDate') ||
    extractByXmpKey('ModifyDate') ||
    extractByPdfInfoKey('CreationDate') ||
    extractByXmpKey('CreateDate')
  );
}
