import * as fs from 'fs';
import * as path from 'path';

import { decodeHtmlEntities, extractHtmlModifiedFromSnippet, extractPdfModifiedFromLatin1, parseHttpLastModified, parseValidIsoTimestamp } from './timestamps.js';
import { type OKFDocument, type OKFSource, RESERVED_OKF_FILENAMES, parseOkfDocument, stripFootnoteFromMarkdownFence, transliterateNordicAscii, truncateSlugAtWordBoundary, withProtectedMarkdownFences } from './document.js';

export function extractHtmlTitleFromSnippet(htmlSnippet: string): string | undefined {
  if (!htmlSnippet || typeof htmlSnippet !== 'string') return undefined;
  const decodeEntities = (raw: string): string =>
    decodeHtmlEntities(raw)
      .replace(/\s+/g, ' ')
      .replace(/\s*(?:\||—|–|-)\s*(?:YouTube|Reddit|Quora|Instagram|Facebook|X|Twitter|LinkedIn|Medium)\s*$/i, '')
      .trim();

  const isInvalidOrBotTitle = (t: string): boolean =>
    t.length < 4 ||
    /^(?:just a moment|access denied|attention required|403 forbidden|404 not found|redirecting|error|page not found|verify you are human|security check)/i.test(
      t
    ) ||
    isBareDomainTitle(t);

  const clampLen = (t: string): string =>
    t.length > 180 ? `${t.slice(0, 177).trimEnd()}…` : t;

  const ogMatch =
    htmlSnippet.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i) ||
    htmlSnippet.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i);
  if (ogMatch && ogMatch[1]) {
    const cleaned = decodeEntities(ogMatch[1]);
    if (!isInvalidOrBotTitle(cleaned)) {
      return clampLen(cleaned);
    }
  }
  const titleMatch = htmlSnippet.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (titleMatch && titleMatch[1]) {
    const cleaned = decodeEntities(titleMatch[1]);
    if (!isInvalidOrBotTitle(cleaned)) {
      return clampLen(cleaned);
    }
  }
  return undefined;
}

export function normalizeHttpMimeType(rawContentType?: string | null): string | undefined {
  if (!rawContentType || typeof rawContentType !== 'string') return undefined;
  const base = rawContentType.split(';')[0].trim().toLowerCase();
  if (!base || base === 'application/octet-stream' || base === 'binary/octet-stream') {
    return undefined;
  }
  if (!/^[a-z0-9][a-z0-9!#$&^_.+-]*\/[a-z0-9][a-z0-9!#$&^_.+-]*$/.test(base)) {
    return undefined;
  }
  return base;
}

export function inferSourceMimeTypeFromUrl(rawUrl?: string): string | undefined {
  const s = String(rawUrl || '').trim();
  if (!s || isVertexRedirectUrl(s)) return undefined;
  try {
    const hashIdx = s.indexOf('#');
    if (hashIdx !== -1) {
      let hashFrag = s.slice(hashIdx + 1);
      try {
        hashFrag = decodeURIComponent(hashFrag);
      } catch {
        // Keep raw fragment if percent-decoding fails
      }
      if (/\.(?:xml|xsd|gml)(?:$|[?&])/i.test(hashFrag.trim())) {
        return 'application/xml';
      }
    }
    const u = /^https?:\/\//i.test(s) ? new URL(s) : null;
    const pathname = (u ? u.pathname : s.split(/[?#]/)[0]).toLowerCase();
    const extMatch = pathname.match(/\.([a-z0-9]{2,8})$/i);
    const ext = extMatch ? extMatch[1].toLowerCase() : '';
    const extMimeMap: Record<string, string> = {
      pdf: 'application/pdf',
      html: 'text/html',
      htm: 'text/html',
      xhtml: 'application/xhtml+xml',
      xml: 'application/xml',
      xsd: 'application/xml',
      rss: 'application/rss+xml',
      atom: 'application/atom+xml',
      json: 'application/json',
      jsonl: 'application/x-ndjson',
      geojson: 'application/geo+json',
      csv: 'text/csv',
      tsv: 'text/tab-separated-values',
      txt: 'text/plain',
      md: 'text/markdown',
      markdown: 'text/markdown',
      rtf: 'application/rtf',
      doc: 'application/msword',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      xls: 'application/vnd.ms-excel',
      xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      ppt: 'application/vnd.ms-powerpoint',
      pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      epub: 'application/epub+zip',
      zip: 'application/zip',
      bz2: 'application/x-bzip2',
      gz: 'application/gzip',
      tgz: 'application/gzip',
      tar: 'application/x-tar',
      xz: 'application/x-xz',
      txz: 'application/x-xz',
      zst: 'application/zstd',
      '7z': 'application/x-7z-compressed',
      parquet: 'application/vnd.apache.parquet',
    };
    if (ext && extMimeMap[ext]) {
      return extMimeMap[ext];
    }
    if (u) {
      let rawFmt = '';
      let isOgcWfs = false;
      for (const [k, v] of u.searchParams.entries()) {
        const keyLower = k.toLowerCase();
        if (
          !rawFmt &&
          (keyLower === 'format' ||
            keyLower === 'output' ||
            keyLower === 'outputformat' ||
            keyLower === 'mime' ||
            keyLower === 'f' ||
            keyLower === 'wt')
        ) {
          rawFmt = v.trim().toLowerCase();
        } else if (keyLower === 'service' && v.trim().toUpperCase() === 'WFS') {
          isOgcWfs = true;
        }
      }
      const normalizedFmt = normalizeHttpMimeType(rawFmt);
      if (normalizedFmt) {
        return normalizedFmt;
      }
      if (rawFmt && extMimeMap[rawFmt]) {
        return extMimeMap[rawFmt];
      }
      if (isOgcWfs) {
        return rawFmt.includes('json') ? 'application/geo+json' : 'application/gml+xml';
      }
    }
  } catch {
    // Ignore malformed URL
  }
  return undefined;
}

export function isPdfBlockedByBrowserCsp(
  rawCspHeader?: string | null,
  mimeType?: string | null
): boolean {
  if (!rawCspHeader || typeof rawCspHeader !== 'string') return false;
  const normMime = normalizeHttpMimeType(mimeType);
  if (normMime && normMime !== 'application/pdf') return false;
  let objectSrcValues: string[] | null = null;
  let defaultSrcValues: string[] | null = null;
  for (const rawDirective of rawCspHeader.split(';')) {
    const tokens = rawDirective.trim().split(/\s+/).filter(Boolean);
    if (tokens.length < 2) continue;
    const name = tokens[0].toLowerCase();
    const values = tokens.slice(1).map((v) => v.toLowerCase());
    if (name === 'object-src') {
      objectSrcValues = values;
    } else if (name === 'default-src') {
      defaultSrcValues = values;
    }
  }
  const effectiveValues = objectSrcValues ?? defaultSrcValues;
  if (!effectiveValues || effectiveValues.length === 0) return false;
  return effectiveValues.length === 1 && effectiveValues[0] === "'none'";
}

export function formatSourceUrlMiddleEllipsis(rawUrl?: string, maxChars: number = 78): string {
  const s = String(rawUrl || '').trim();
  if (!s) return '';
  const stripped = s.replace(/^https?:\/\/(?:www\.)?/i, '');
  if (stripped.length <= maxChars) return stripped;
  const qIdx = stripped.indexOf('?');
  const pathPart = qIdx !== -1 ? stripped.slice(0, qIdx) : stripped;
  const querySuffix = qIdx !== -1 ? stripped.slice(qIdx) : '';
  const segments = pathPart.split('/').filter(Boolean);
  if (segments.length >= 3) {
    const host = segments[0];
    const firstDir = segments[1];
    const parentDir = segments[segments.length - 2];
    const lastSeg = segments[segments.length - 1] + (querySuffix.length <= 16 ? querySuffix : '');
    const tailMax = Math.max(24, Math.min(44, maxChars - host.length - 6));
    const tail =
      lastSeg.length > tailMax
        ? `…${lastSeg.slice(-(tailMax - 1))}`
        : lastSeg;
    const isGenericAssetBucket =
      /^(?:globalassets|contentassets|siteassets|assets|files|media|uploads|documents|static|blob|public)$/i.test(
        firstDir
      );
    if (isGenericAssetBucket && segments.length >= 5) {
      const withSemanticAndParent =
        segments.length === 5
          ? `${host}/…/${segments[2]}/${parentDir}/${tail}`
          : `${host}/…/${segments[2]}/…/${parentDir}/${tail}`;
      if (withSemanticAndParent.length <= maxChars + 4) {
        return withSemanticAndParent;
      }
    }
    if (!isGenericAssetBucket && segments.length >= 4) {
      const withFirstAndParent = `${host}/${firstDir}/…/${parentDir}/${tail}`;
      if (withFirstAndParent.length <= maxChars + 4) {
        return withFirstAndParent;
      }
      const withParentOnly = `${host}/…/${parentDir}/${tail}`;
      if (withParentOnly.length <= maxChars + 4) {
        return withParentOnly;
      }
    }
    if (isGenericAssetBucket && segments.length >= 4) {
      const withTwoDirs = `${host}/${firstDir}/${segments[2]}/…/${tail}`;
      if (withTwoDirs.length <= maxChars + 4) {
        return withTwoDirs;
      }
      const withParentDir = `${host}/…/${parentDir}/${tail}`;
      if (withParentDir.length <= maxChars + 4) {
        return withParentDir;
      }
      const withSemanticDir = `${host}/…/${segments[2]}/…/${tail}`;
      if (withSemanticDir.length <= maxChars + 4) {
        return withSemanticDir;
      }
    }
    const withFirstDir = `${host}/${firstDir}/…/${tail}`;
    if (withFirstDir.length <= maxChars + 4) {
      return withFirstDir;
    }
    const hostOnly = `${host}/…/${tail}`;
    if (hostOnly.length <= maxChars + 4) {
      return hostOnly;
    }
  }
  const tailKeep = Math.max(22, Math.floor((maxChars - 1) * 0.45));
  const headKeep = Math.max(16, maxChars - 1 - tailKeep);
  return `${stripped.slice(0, headKeep)}…${stripped.slice(-tailKeep)}`;
}

// Helper function to extract the destination URL (and opportunistic Last-Modified / document metadata) from Vertex AI Search grounding 302 redirects.
// Uses `redirect: 'manual'` first so we read Google's `Location` header directly in ~100ms without failing or timing out when a third-party destination server is unreachable.
export async function resolveRedirect(
  url: string
): Promise<{
  url: string;
  lastModified?: string;
  pageTitle?: string;
  mimeType?: string;
  browserBlockedPdf?: boolean;
}> {
  const headers = {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  };
  const isNonErrorStatus = (res: any): boolean =>
    res?.status === undefined || (typeof res.status === 'number' && res.status >= 200 && res.status < 400);

  const inspectResponseMetadata = async (
    res: any,
    targetUrl: string,
    alreadyHasHttpLastModified: boolean
  ): Promise<{ pageTitle?: string; docModified?: string; mimeType?: string }> => {
    if (!isNonErrorStatus(res)) return {};
    const rawContentType = String(res?.headers?.get?.('content-type') || '');
    const contentType = rawContentType.toLowerCase();
    const headerMime = normalizeHttpMimeType(rawContentType);
    const isDeclaredHtml = contentType.includes('text/html') || contentType.includes('application/xhtml');
    const isDeclaredPdf = contentType.includes('application/pdf');
    if (contentType && !isDeclaredHtml && !isDeclaredPdf && !contentType.includes('octet-stream')) {
      return headerMime ? { mimeType: headerMime } : {};
    }

    try {
      if (typeof res?.body?.getReader === 'function') {
        const reader = res.body.getReader();
        const headChunks: Uint8Array[] = [];
        let headBytes = 0;
        const headLimit = isDeclaredPdf ? 16384 : 32768;
        while (headBytes < headLimit) {
          const { done, value } = await reader.read();
          if (done || !value) break;
          headChunks.push(value);
          headBytes += value.byteLength;
          if (!isDeclaredPdf) {
            const partialStr = Buffer.concat(headChunks).toString('utf8');
            if (
              /<\/head>/i.test(partialStr) ||
              (alreadyHasHttpLastModified && /<\/title>/i.test(partialStr)) ||
              partialStr.startsWith('%PDF-')
            ) {
              break;
            }
          }
        }
        if (headChunks.length === 0) {
          await reader.cancel().catch(() => {});
          return headerMime ? { mimeType: headerMime } : {};
        }

        const headBuf = Buffer.concat(headChunks);
        const headLatin1 = headBuf.toString('latin1');
        const isPdf = isDeclaredPdf || headLatin1.startsWith('%PDF-');

        if (!isPdf) {
          await reader.cancel().catch(() => {});
          const headUtf8 = headBuf.toString('utf8');
          const pageTitle = extractHtmlTitleFromSnippet(headUtf8);
          const docModified = alreadyHasHttpLastModified
            ? undefined
            : extractHtmlModifiedFromSnippet(headUtf8);
          const detectedHtmlMime =
            headerMime ||
            (/^\s*(?:<!doctype\s+html|<html\b|<head\b)/i.test(headUtf8) ? 'text/html' : undefined);
          return {
            ...(pageTitle ? { pageTitle } : {}),
            ...(docModified ? { docModified } : {}),
            ...(detectedHtmlMime ? { mimeType: detectedHtmlMime } : {}),
          };
        }

        // PDF response (`application/pdf` or `%PDF-` magic header)
        if (alreadyHasHttpLastModified) {
          await reader.cancel().catch(() => {});
          return { mimeType: 'application/pdf' };
        }
        const headPdfMod = extractPdfModifiedFromLatin1(headLatin1);
        if (headPdfMod) {
          await reader.cancel().catch(() => {});
          return { docModified: headPdfMod, mimeType: 'application/pdf' };
        }

        // ISO 32000 `/Info` (`/ModDate`, `/CreationDate`) typically resides near `xref` at the PDF trailer.
        if (res?.status === 206 && /^https?:\/\//i.test(targetUrl)) {
          await reader.cancel().catch(() => {});
          const crHeader = String(res?.headers?.get?.('content-range') || '');
          const totalMatch = crHeader.match(/\/(\d+)\s*$/);
          const totalSize = totalMatch ? Number(totalMatch[1]) : 0;
          if (totalSize > headBytes) {
            try {
              const tailStart = Math.max(0, totalSize - 32768);
              const tailRes = await globalThis.fetch(targetUrl, {
                method: 'GET',
                redirect: 'follow',
                signal: AbortSignal.timeout(1800),
                headers: {
                  ...headers,
                  Range: `bytes=${tailStart}-${totalSize - 1}`,
                },
              });
              if (isNonErrorStatus(tailRes) && typeof tailRes?.arrayBuffer === 'function') {
                const tailAb = await tailRes.arrayBuffer();
                const tailMod = extractPdfModifiedFromLatin1(
                  Buffer.from(tailAb).subarray(-40960).toString('latin1')
                );
                if (tailMod) return { docModified: tailMod, mimeType: 'application/pdf' };
              } else {
                await tailRes?.body?.cancel().catch(() => {});
              }
            } catch {
              // Ignore opportunistic PDF tail range timeout
            }
          }
          return { mimeType: 'application/pdf' };
        }

        // Server ignored `Range` and returned `200 OK` (e.g., Varnish CDN): drain open stream up to 4 MB
        // while retaining only a rolling 40 KB tail window in memory.
        const clRaw = Number(res?.headers?.get?.('content-length') || 0);
        const maxDrainBytes = 4 * 1024 * 1024;
        if (!clRaw || clRaw <= maxDrainBytes) {
          let totalRead = headBytes;
          let tailBuf: Buffer = headBuf.length > 40960 ? headBuf.subarray(headBuf.length - 40960) : headBuf;
          let reachedEof = false;
          while (totalRead <= maxDrainBytes) {
            const { done, value } = await reader.read();
            if (done || !value) {
              reachedEof = true;
              break;
            }
            totalRead += value.byteLength;
            const combined = Buffer.concat([tailBuf, value]);
            tailBuf = combined.length > 40960 ? combined.subarray(combined.length - 40960) : combined;
          }
          await reader.cancel().catch(() => {});
          if (reachedEof || tailBuf.length > 0) {
            const tailMod = extractPdfModifiedFromLatin1(tailBuf.toString('latin1'));
            if (tailMod) return { docModified: tailMod, mimeType: 'application/pdf' };
          }
        } else {
          await reader.cancel().catch(() => {});
        }
        return { mimeType: 'application/pdf' };
      } else if (typeof res?.text === 'function' && !res?.body) {
        const txt = String((await res.text()) || '');
        if (isDeclaredPdf || txt.startsWith('%PDF-')) {
          const docModified = alreadyHasHttpLastModified
            ? undefined
            : extractPdfModifiedFromLatin1(txt.slice(0, 32768)) ||
              extractPdfModifiedFromLatin1(txt.slice(-40960));
          return {
            ...(docModified ? { docModified } : {}),
            mimeType: 'application/pdf',
          };
        }
        const snippet = txt.slice(0, 32768);
        const pageTitle = extractHtmlTitleFromSnippet(snippet);
        const docModified = alreadyHasHttpLastModified
          ? undefined
          : extractHtmlModifiedFromSnippet(snippet);
        const detectedHtmlMime =
          headerMime ||
          (/^\s*(?:<!doctype\s+html|<html\b|<head\b)/i.test(snippet) ? 'text/html' : undefined);
        return {
          ...(pageTitle ? { pageTitle } : {}),
          ...(docModified ? { docModified } : {}),
          ...(detectedHtmlMime ? { mimeType: detectedHtmlMime } : {}),
        };
      }
    } catch {
      // Ignore stream read errors when opportunistically extracting <title> / document timestamps
    }
    return headerMime ? { mimeType: headerMime } : {};
  };

  try {
    const manualRes = await globalThis.fetch(url, {
      method: 'GET',
      redirect: 'manual',
      signal: AbortSignal.timeout(5000),
      headers,
    });
    let lastModified = isNonErrorStatus(manualRes)
      ? parseHttpLastModified(manualRes.headers?.get?.('last-modified'))
      : undefined;
    const location = manualRes.headers?.get?.('location');
    if (location && /^https?:\/\//i.test(location)) {
      await manualRes.body?.cancel().catch(() => {});
      let pageTitle: string | undefined;
      let destMime: string | undefined;
      let destCsp: string | undefined;
      let finalLocation = location;
      if (!isLowSignalGroundingUrl(location)) {
        try {
          const destRes = await globalThis.fetch(location, {
            method: 'GET',
            redirect: 'follow',
            signal: AbortSignal.timeout(2500),
            headers: {
              ...headers,
              Range: 'bytes=0-16383',
            },
          });
          if (destRes?.url && /^https?:\/\//i.test(destRes.url)) {
            finalLocation = destRes.url;
          }
          if (!lastModified && isNonErrorStatus(destRes)) {
            lastModified = parseHttpLastModified(destRes?.headers?.get?.('last-modified'));
          }
          if (isNonErrorStatus(destRes)) {
            destCsp = String(destRes?.headers?.get?.('content-security-policy') || '');
          }
          const destMeta = await inspectResponseMetadata(
            destRes,
            finalLocation,
            Boolean(lastModified)
          );
          pageTitle = destMeta.pageTitle;
          destMime =
            destMeta.mimeType ||
            (isNonErrorStatus(destRes)
              ? normalizeHttpMimeType(destRes?.headers?.get?.('content-type'))
              : undefined);
          if (!lastModified && destMeta.docModified) {
            lastModified = destMeta.docModified;
          }
          await destRes?.body?.cancel().catch(() => {});
        } catch {
          // Ignore unreachable third-party servers or timeout during opportunistic title/header check
        }
      }
      const resolvedMime = destMime || inferSourceMimeTypeFromUrl(finalLocation);
      const browserBlockedPdf =
        resolvedMime === 'application/pdf' && isPdfBlockedByBrowserCsp(destCsp, resolvedMime);
      return {
        url: finalLocation,
        lastModified,
        ...(pageTitle ? { pageTitle } : {}),
        ...(resolvedMime ? { mimeType: resolvedMime } : {}),
        ...(browserBlockedPdf ? { browserBlockedPdf: true } : {}),
      };
    }
    const directMeta = await inspectResponseMetadata(
      manualRes,
      manualRes.url || url,
      Boolean(lastModified)
    );
    if (!lastModified && directMeta.docModified) {
      lastModified = directMeta.docModified;
    }
    const directUrl = manualRes.url || url;
    const directMime =
      directMeta.mimeType ||
      (isNonErrorStatus(manualRes)
        ? normalizeHttpMimeType(manualRes.headers?.get?.('content-type'))
        : undefined) ||
      inferSourceMimeTypeFromUrl(directUrl);
    const directCsp = isNonErrorStatus(manualRes)
      ? String(manualRes.headers?.get?.('content-security-policy') || '')
      : '';
    const directBlockedPdf =
      directMime === 'application/pdf' && isPdfBlockedByBrowserCsp(directCsp, directMime);
    await manualRes.body?.cancel().catch(() => {});
    const isDirect2xx =
      typeof manualRes.status === 'number' && manualRes.status >= 200 && manualRes.status < 300;
    if (isDirect2xx || lastModified || directMeta.pageTitle || directMeta.mimeType) {
      return {
        url: directUrl,
        lastModified,
        ...(directMeta.pageTitle ? { pageTitle: directMeta.pageTitle } : {}),
        ...(directMime ? { mimeType: directMime } : {}),
        ...(directBlockedPdf ? { browserBlockedPdf: true } : {}),
      };
    }
  } catch {
    // Fall through to follow mode if manual hop check fails
  }

  try {
    const followRes = await globalThis.fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: AbortSignal.timeout(6000),
      headers,
    });
    let lastModified = isNonErrorStatus(followRes)
      ? parseHttpLastModified(followRes.headers?.get?.('last-modified'))
      : undefined;
    const followUrl = followRes.url || url;
    const followMeta = await inspectResponseMetadata(
      followRes,
      followUrl,
      Boolean(lastModified)
    );
    if (!lastModified && followMeta.docModified) {
      lastModified = followMeta.docModified;
    }
    const followMime =
      followMeta.mimeType ||
      (isNonErrorStatus(followRes)
        ? normalizeHttpMimeType(followRes.headers?.get?.('content-type'))
        : undefined) ||
      inferSourceMimeTypeFromUrl(followUrl);
    const followCsp = isNonErrorStatus(followRes)
      ? String(followRes.headers?.get?.('content-security-policy') || '')
      : '';
    const followBlockedPdf =
      followMime === 'application/pdf' && isPdfBlockedByBrowserCsp(followCsp, followMime);
    await followRes.body?.cancel().catch(() => {});
    return {
      url: followUrl,
      lastModified,
      ...(followMeta.pageTitle ? { pageTitle: followMeta.pageTitle } : {}),
      ...(followMime ? { mimeType: followMime } : {}),
      ...(followBlockedPdf ? { browserBlockedPdf: true } : {}),
    };
  } catch {
    const fallbackMime = inferSourceMimeTypeFromUrl(url);
    return { url, ...(fallbackMime ? { mimeType: fallbackMime } : {}) };
  }
}

export function generateSourceSlugId(
  titleOrUrl: string,
  resourceUrl: string,
  usedIds: Set<string>
): string {
  let base = transliterateNordicAscii(titleOrUrl)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/^https?:\/\/(www\.)?/, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (!base || base.length < 2) {
    try {
      base = new URL(resourceUrl).hostname
        .replace(/^www\./, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    } catch {
      base = 'source';
    }
  }
  const words = base.split('-').filter(Boolean).slice(0, 4);
  base = truncateSlugAtWordBoundary(words.join('-'), 32) || 'source';

  let candidate = base;
  let counter = 2;
  while (usedIds.has(candidate)) {
    candidate = `${base}-${counter}`;
    counter++;
  }
  usedIds.add(candidate);
  return candidate;
}

export function isVertexRedirectUrl(url?: string): boolean {
  return typeof url === 'string' && url.includes('vertexaisearch.cloud.google.com/grounding-api-redirect/');
}

export function isMultiRecordArchiveUrl(rawUrl?: string): boolean {
  const s = String(rawUrl || '').trim();
  if (!s || isVertexRedirectUrl(s)) return false;
  const withoutHashAndQuery = s.split(/[?#]/)[0];
  return /\.(?:tar\.(?:bz2|gz|xz|zst)|tbz2|tgz|txz|zip|tar|bz2|gz|xz|zst|7z)$/i.test(
    withoutHashAndQuery
  );
}

/**
 * Normalizes a source URL for canonical cross-concept / cross-run deduplication:
 * - Lowercases protocol and hostname
 * - Strips leading `www.`
 * - Preserves normalized `#<entry-path>` sub-document locators on multi-record archive URLs
 *   (`.tar.bz2`, `.tar.gz`, `.zip`, etc.), while stripping `#hash` anchors on single-document pages
 * - Strips trailing `/` on non-root pathnames
 */
export function normalizeCanonicalSourceUrl(rawUrl?: string): string {
  const s = String(rawUrl || '').trim();
  if (!/^https?:\/\//i.test(s) || isVertexRedirectUrl(s)) return '';
  try {
    const u = new URL(s);
    u.protocol = u.protocol.toLowerCase();
    u.hostname = u.hostname.toLowerCase().replace(/^www\./, '');
    if (isMultiRecordArchiveUrl(s) && u.hash && u.hash.length > 1) {
      let decodedHash = u.hash.slice(1);
      try {
        decodedHash = decodeURIComponent(decodedHash);
      } catch {
        // Keep raw fragment if percent-decoding fails
      }
      const cleanHash = decodedHash
        .replace(/\\/g, '/')
        .replace(/^\/+|\/+$/g, '')
        .trim();
      u.hash = cleanHash ? `#${cleanHash}` : '';
    } else {
      u.hash = '';
    }
    for (const k of Array.from(u.searchParams.keys())) {
      if (/^(?:utm_|fbclid$|gclid$)/i.test(k)) {
        u.searchParams.delete(k);
      }
    }
    if (u.pathname.length > 1) {
      u.pathname = u.pathname.replace(/\/+$/, '');
    }
    return u.toString();
  } catch {
    return s;
  }
}

/**
 * Returns canonical lookup/deduplication keys for an OKF source entry:
 * - Standard single-document URLs (and archive URLs that include a `#<entry-path>` fragment)
 *   deduplicate strictly by `[canonUrl]`.
 * - Bare multi-record archive URLs without a `#fragment` (e.g., `.../records-archive.tar.bz2`)
 *   represent multi-file containers, so two entries only collide when they share the same `id`
 *   (`canonUrl::id:<id>`) or the same specific normalized `title` (`canonUrl::title:<normTitle>`),
 *   never collapsing distinct statutes/records that share a bulk Open-Data archive URL.
 */
export function getCanonicalSourceDedupeKeys(
  rawUrl?: string,
  id?: string,
  title?: string
): string[] {
  const canonUrl = normalizeCanonicalSourceUrl(rawUrl) || String(rawUrl || '').trim();
  if (!canonUrl) return [];
  if (!isMultiRecordArchiveUrl(canonUrl) || canonUrl.includes('#')) {
    return [canonUrl];
  }
  const keys: string[] = [];
  const cleanId = String(id || '').trim().toLowerCase();
  if (cleanId) {
    keys.push(`${canonUrl}::id:${cleanId}`);
  }
  const cleanTitle = String(title || '')
    .replace(/\s*\(via\s+[^)]+\)\s*$/i, '')
    .trim();
  const normTitle =
    cleanTitle && !isBareDomainTitle(cleanTitle, canonUrl) && !isAutoDomainSlugTitle(cleanTitle)
      ? normalizeSourceMatchKey(cleanTitle)
      : '';
  if (normTitle && normTitle.length >= 4) {
    keys.push(`${canonUrl}::title:${normTitle}`);
  }
  return keys.length > 0 ? keys : [canonUrl];
}

/**
 * Strips trailing parenthetical or bracketed portal UI view-mode suffixes
 * (e.g., `(Print View)`, `[Printer-friendly version]`, `(Alternative index)`, `(HTML view)`, `(Mobile view)`)
 * while preserving genuine parenthetical acronyms, years, and document codes (`(SEC)`, `(ISO 27001)`, `(Part 2)`).
 */
export function stripTrailingPortalViewChrome(title?: string): string {
  return String(title || '')
    .replace(
      /\s*[([]\s*(?:print(?:er(?:[\s-]friendly)?)?|utskrifts?\w*|druck\w*|mobile?|mobil\w*|desktop|html|xml|plain[\s-]text|text|read[\s-]only|accessible|compact|full(?:[\s-]screen)?|split|tree|flat|alternat(?:e|ive|iv\w*))\s+(?:view|visning|ansicht|version|versjon|index|indeks|mode|modus|format|layout)\s*[)\]]\s*$/gi,
      ''
    )
    .trim();
}

export function normalizeSourceMatchKey(input?: string): string {
  return transliterateNordicAscii(stripTrailingPortalViewChrome(input))
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/^\*\*|\*\*$/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const SOURCE_MATCH_STOPWORDS = new Set([
  'http',
  'https',
  'www',
  'com',
  'org',
  'net',
  'html',
  'htm',
  'pdf',
  'the',
  'and',
  'for',
  'with',
  'from',
  'that',
  'this',
  'med',
  'som',
  'til',
  'fra',
  'over',
  'under',
  'ved',
  'hos',
  'alle',
]);

export function extractSourceMatchTokens(input?: string): string[] {
  return normalizeSourceMatchKey(input)
    .split(/\s+/)
    .filter((t) => t.length >= 3 && !SOURCE_MATCH_STOPWORDS.has(t));
}

export function collectExistingBundleSources(bundleRoot: string): OKFSource[] {
  const resolvedRoot = path.resolve(bundleRoot);
  if (!fs.existsSync(resolvedRoot)) return [];
  const out: OKFSource[] = [];
  const scanDir = (dir: string) => {
    let entries: fs.Dirent[] = [];
    try {
      entries = fs
        .readdirSync(dir, { withFileTypes: true })
        .sort((a, b) => a.name.localeCompare(b.name));
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        scanDir(full);
      } else if (
        entry.isFile() &&
        entry.name.endsWith('.md') &&
        !RESERVED_OKF_FILENAMES.has(entry.name)
      ) {
        try {
          const doc = parseOkfDocument(fs.readFileSync(full, 'utf-8'));
          if (Array.isArray(doc.frontmatter?.sources)) {
            for (const s of doc.frontmatter.sources) {
              const rawRes = s && typeof s === 'object' ? String(s.resource || (s as any).url || '').trim() : '';
              if (
                rawRes &&
                /^https?:\/\//i.test(rawRes) &&
                !isVertexRedirectUrl(rawRes)
              ) {
                const resolvedSrcMime =
                  normalizeHttpMimeType(s.mime_type) || inferSourceMimeTypeFromUrl(rawRes);
                out.push({
                  id: s.id ? String(s.id) : undefined,
                  resource: rawRes,
                  title: s.title ? decodeHtmlEntities(String(s.title)) : undefined,
                  ...(resolvedSrcMime ? { mime_type: resolvedSrcMime } : {}),
                  retrieved_at: parseValidIsoTimestamp(s.retrieved_at),
                  last_modified: parseValidIsoTimestamp(s.last_modified),
                });
              }
            }
          }
        } catch {
          // Ignore unreadable concept files
        }
      }
    }
  };
  scanDir(resolvedRoot);
  return out;
}

export interface CleanGroundingOptions {
  topic?: string;
  model?: string;
  generatedBy?: string;
  generatedAt?: string;
  staleAfter?: string;
  staleAfterDays?: number;
  type?: string;
  status?: 'draft' | 'stable' | 'deprecated';
  tags?: string[];
  workspaceRoot?: string;
  bundleRoot?: string;
}

const LOW_SIGNAL_GROUNDING_DOMAINS = new Set([
  'quora.com',
  'reddit.com',
  'old.reddit.com',
  'instagram.com',
  'facebook.com',
  'tiktok.com',
  'pinterest.com',
  'x.com',
  'twitter.com',
  'threads.net',
  'edubirdie.com',
  'gradesfixer.com',
  'bartleby.com',
  'studymode.com',
  'ukessays.com',
  'studocu.com',
  'coursehero.com',
  'chegg.com',
  'scribd.com',
  'issuu.com',
]);

export function isLowSignalGroundingUrl(url?: string): boolean {
  const clean = String(url || '').trim();
  if (!/^https?:\/\//i.test(clean)) return false;
  try {
    const host = new URL(clean).hostname.toLowerCase().replace(/^www\./, '');
    if (LOW_SIGNAL_GROUNDING_DOMAINS.has(host)) return true;
    for (const domain of LOW_SIGNAL_GROUNDING_DOMAINS) {
      if (host.endsWith(`.${domain}`)) return true;
    }
    return false;
  } catch {
    return false;
  }
}

function isAutoLowSignalSourceEntry(s: OKFSource): boolean {
  const srcUrl = s ? String(s.resource || s.url || '').trim() : '';
  if (!s || !isLowSignalGroundingUrl(srcUrl)) return false;
  const id = String(s.id || '').trim();
  const title = String(s.title || '').trim();
  if (
    /^(?:src|quora|reddit|old-reddit|instagram|facebook|tiktok|pinterest|x|twitter|threads|edubirdie|gradesfixer|bartleby|studymode|ukessays|studocu|coursehero|chegg|scribd|issuu)(?:-(?:com|org|net))?(?:-\d+)?$/i.test(
      id
    )
  ) {
    return true;
  }
  if (!title || isBareDomainTitle(title, srcUrl) || isAutoDomainSlugTitle(title)) {
    return true;
  }
  return false;
}

export function stripFootnotesPreservingWordBoundaries(text: string): string {
  return String(text || '').replace(
    /(?:\[\^[^\r\n\]]+\][ \t]*)+/g,
    (match: string, offset: number, str: string) => {
      const beforeChar = offset > 0 ? str[offset - 1] : '';
      const afterIdx = offset + match.length;
      const afterChar = afterIdx < str.length ? str[afterIdx] : '';
      if (
        beforeChar &&
        afterChar &&
        /[\p{L}\p{N}]/u.test(beforeChar) &&
        /[\p{L}\p{N}]/u.test(afterChar)
      ) {
        return ' ';
      }
      if (/[ \t]$/.test(match) && beforeChar && !/\s/.test(beforeChar) && afterChar && !/\s/.test(afterChar)) {
        return ' ';
      }
      return '';
    }
  );
}

export function removeSpecificFootnotePreservingBoundary(text: string, fnId: string): string {
  const escaped = fnId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`\\[\\^${escaped}\\]`, 'g');
  return text.replace(re, (match: string, offset: number, str: string) => {
    const beforeChar = offset > 0 ? str[offset - 1] : '';
    const afterIdx = offset + match.length;
    const afterChar = afterIdx < str.length ? str[afterIdx] : '';
    if (
      beforeChar &&
      afterChar &&
      /[\p{L}\p{N}]/u.test(beforeChar) &&
      /[\p{L}\p{N}]/u.test(afterChar)
    ) {
      return ' ';
    }
    return '';
  });
}

const GENERIC_ROUTER_TITLE_RE =
  /^(?:id\d+|\w*servlet|downloads?|files?|assets|media|documents?|docs|articles?|pages?|view|viewer|details?|record|pdf|pmc|fulltext|abs|(?:article|paper|doc(?:ument)?|item|pub(?:lication)?|record)[_-]?(?:info(?:rmation)?|details?|view(?:er)?)|index|default)$/i;

function stripGenericAssetSubdomain(host: string): string {
  const clean = String(host || '').replace(/^www\./i, '');
  const parts = clean.split('.');
  if (parts.length >= 3 && /^(?:assets|cdn|static|files|media|uploads|downloads)$/i.test(parts[0])) {
    if (!(parts.length === 3 && /^(?:co|com|org|gov|gob|gouv|ac|edu|net)$/i.test(parts[1]))) {
      return parts.slice(1).join('.');
    }
  }
  return clean;
}

export function isBareDomainTitle(title?: string, resourceUrl?: string): boolean {
  const t = String(title || '').trim();
  if (!t) return true;
  if (/^(?:https?:\/\/)?(?:www\.)?[a-z0-9.-]+\.[a-z]{2,}\/?$/i.test(t)) {
    return true;
  }
  if (GENERIC_ROUTER_TITLE_RE.test(t)) {
    return true;
  }
  const dashSuffixMatch = t.match(/\s+[—–-]\s+(.+)$/);
  if (dashSuffixMatch && GENERIC_ROUTER_TITLE_RE.test(dashSuffixMatch[1].trim())) {
    return true;
  }
  const autoSlugMatch = t.match(/^[a-z0-9.-]+\.[a-z]{2,}\s+[—–-]\s+(.+)$/i);
  if (autoSlugMatch) {
    const slugPart = autoSlugMatch[1].trim();
    if (
      slugPart.length <= 1 ||
      /^(?:i|ii|iii|iv|v|vi|vii|viii|ix|x)\s+\d/i.test(slugPart) ||
      /^[^\p{L}]+[\p{Ll}]/u.test(slugPart) ||
      /^\d{4}\.\d{4,5}(?:v\d+)?$/i.test(slugPart) ||
      /^(?:[0-9a-f]{16,}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})[_-\s]+/i.test(
        slugPart
      ) ||
      GENERIC_ROUTER_TITLE_RE.test(slugPart) ||
      (!/[\s_-]/.test(slugPart) &&
        slugPart.length >= 6 &&
        slugPart.length <= 16 &&
        /[A-Z]/.test(slugPart) &&
        /[a-z]/.test(slugPart) &&
        (/\d/.test(slugPart) || /[a-z][A-Z]/.test(slugPart)))
    ) {
      return true;
    }
    if (resourceUrl && /^https?:\/\//i.test(resourceUrl)) {
      try {
        const parsed = new URL(resourceUrl);
        const isApexOrServletRouter =
          (/\/f$/i.test(parsed.pathname) && parsed.searchParams.has('p')) ||
          /servlet(?:\/|$)/i.test(parsed.pathname);
        if (isApexOrServletRouter) {
          const normSlug = slugPart.toLowerCase().replace(/\s+/g, ' ').trim();
          for (const seg of parsed.pathname.split('/')) {
            const humanizedSeg = seg.replace(/[+_-]+/g, ' ').toLowerCase().replace(/\s+/g, ' ').trim();
            if (humanizedSeg && humanizedSeg === normSlug) {
              return true;
            }
          }
        }
      } catch {
        // Ignore malformed URL
      }
    }
  }
  return false;
}

export function enrichBareDomainSourceTitle(
  rawTitle: string | undefined,
  resourceUrl: string
): string {
  const cleanTitle = decodeHtmlEntities(String(rawTitle || '')).trim();
  const cleanUrl = String(resourceUrl || '').trim();
  if (!isBareDomainTitle(cleanTitle, cleanUrl) && cleanTitle !== cleanUrl) {
    if (
      /^[\p{L}\p{N}]{1,15}$/u.test(cleanTitle) &&
      /\p{L}/u.test(cleanTitle) &&
      /^https?:\/\//i.test(cleanUrl) &&
      !isVertexRedirectUrl(cleanUrl)
    ) {
      try {
        const host = new URL(cleanUrl).hostname.replace(/^www\./i, '');
        const domain = stripGenericAssetSubdomain(host);
        const domainParts = domain.toLowerCase().split('.').slice(0, -1);
        const domainStem =
          domainParts.length >= 2 && /^(?:co|gov|org|ac|edu|net)$/.test(domainParts[domainParts.length - 1])
            ? domainParts[domainParts.length - 2]
            : domainParts.length > 0
              ? domainParts[domainParts.length - 1]
              : '';
        const lowerTitle = cleanTitle.toLowerCase();
        const matchesDomainStem =
          Boolean(domainStem) &&
          (lowerTitle === domainStem || (domainStem.length >= 4 && lowerTitle.includes(domainStem)));
        if (
          domain &&
          !lowerTitle.includes(domain.toLowerCase()) &&
          !matchesDomainStem
        ) {
          return `${domain} — ${cleanTitle}`;
        }
      } catch {
        // Fall through and return cleanTitle
      }
    }
    return cleanTitle;
  }
  if (!/^https?:\/\//i.test(cleanUrl) || isVertexRedirectUrl(cleanUrl)) {
    return cleanTitle || cleanUrl;
  }
  try {
    const parsed = new URL(cleanUrl);
    const domainPrefixMatch = cleanTitle.match(/^(?:https?:\/\/)?(?:www\.)?([a-z0-9.-]+\.[a-z]{2,})/i);
    const rawHost = domainPrefixMatch
      ? domainPrefixMatch[1].replace(/^www\./i, '')
      : parsed.hostname.replace(/^www\./i, '');
    const domain = stripGenericAssetSubdomain(rawHost);

    if (/^(?:export\.)?arxiv\.org$/i.test(domain)) {
      const arxivMatch = parsed.pathname.match(/(\d{4}\.\d{4,5}(?:v\d+)?)/i);
      if (arxivMatch) {
        return `arxiv.org — arXiv:${arxivMatch[1].replace(/V(\d+)$/, 'v$1')}`;
      }
    }

    const rawSegments = parsed.pathname
      .split('/')
      .map((s) => {
        try {
          return decodeURIComponent(s).trim();
        } catch {
          return s.trim();
        }
      })
      .filter(
        (s) =>
          s.length > 0 &&
          s !== '-' &&
          !/^(?:index|default)\.(?:html?|aspx?|php)$/i.test(s)
      );

    const isOracleApexPath =
      /\/f$/i.test(parsed.pathname) && parsed.searchParams.has('p');

    const isOpaqueOrBucket = (seg: string): boolean => {
      if (isOracleApexPath) {
        return true;
      }
      const noExt = seg.replace(/\.(?:pdf|html?|aspx?|php|md|docx?)$/i, '');
      if (
        /^(?:_f|p\d+|no|nb|nn|en|wiki|globalassets|contentassets|wp-content|uploads|dyn|pls|ords|apex|downloads?|files?|assets|media|documents?|docs|articles?|pages?|view|pdf|pmc|fulltext|abs|reel|p|tv)$/i.test(
          noExt
        )
      ) {
        return true;
      }
      if (/^id\d+$/i.test(noExt) || /servlet$/i.test(noExt)) {
        return true;
      }
      if (/^[a-z]$/i.test(noExt) || /^(?:i|ii|iii|iv|v|vi|vii|viii|ix|x)$/i.test(noExt)) {
        return true;
      }
      if (
        (/^i\d{6,}$/i.test(noExt) ||
          (/^[0-9a-f]{8,}(?:-[0-9a-f]{4,})*$/i.test(noExt) && /[a-f]/i.test(noExt))) &&
        /\d/.test(noExt)
      ) {
        return true;
      }
      if (
        !/[\s_-]/.test(noExt) &&
        noExt.length >= 6 &&
        noExt.length <= 16 &&
        /[A-Z]/.test(noExt) &&
        /[a-z]/.test(noExt) &&
        (/\d/.test(noExt) || /[a-z][A-Z]/.test(noExt))
      ) {
        return true;
      }
      return false;
    };

    const stripExt = (seg: string): string =>
      seg.replace(/\.(?:pdf|html?|aspx?|php|md|docx?)$/i, '');

    const filteredSegments = rawSegments.filter((s) => !isOpaqueOrBucket(s));
    const meaningful: string[] = [];
    for (const seg of filteredSegments) {
      if (
        meaningful.length > 0 &&
        stripExt(meaningful[meaningful.length - 1]).toLowerCase() === stripExt(seg).toLowerCase()
      ) {
        continue;
      }
      meaningful.push(seg);
    }

    if (meaningful.length === 0) {
      return domain || cleanTitle;
    }

    if (
      meaningful.length >= 2 &&
      stripExt(meaningful[meaningful.length - 1]) === '1' &&
      /\d/.test(meaningful[meaningful.length - 2])
    ) {
      meaningful.pop();
    }

    const lastSeg = stripExt(meaningful[meaningful.length - 1]);
    const prevSeg = meaningful.length >= 2 ? stripExt(meaningful[meaningful.length - 2]) : '';

    let chosenSlug = lastSeg;
    const recordRouterMatch = lastSeg.match(
      /^(?:(article|paper|doc(?:ument)?|item|pub(?:lication)?|record)[_-]?)?(?:info(?:rmation)?|details?|view(?:er)?)$/i
    );
    if (recordRouterMatch) {
      const entityRaw = (recordRouterMatch[1] || '').toLowerCase();
      const entityLabel =
        entityRaw === 'paper'
          ? 'Paper'
          : entityRaw === 'article'
            ? 'Article'
            : entityRaw.startsWith('doc')
              ? 'Document'
              : entityRaw.startsWith('pub')
                ? 'Publication'
                : 'Record';
      let queryId = '';
      for (const [k, v] of parsed.searchParams.entries()) {
        if (/^(?:paper[_-]?id|article[_-]?id|doc(?:ument)?[_-]?id|pub[_-]?id|record[_-]?id|item[_-]?id|id)$/i.test(k) && v.trim()) {
          queryId = v.trim();
          break;
        }
      }
      chosenSlug = queryId ? `${entityLabel} ${queryId}` : entityLabel;
    } else if (prevSeg && /^[0-9-]+$/.test(lastSeg)) {
      let alphaIdx = -1;
      for (let k = meaningful.length - 2; k >= 0; k--) {
        if (/[\p{L}]/u.test(stripExt(meaningful[k]))) {
          alphaIdx = k;
          break;
        }
      }
      if (alphaIdx >= 0) {
        const alphaPrev = stripExt(meaningful[alphaIdx]);
        const numericTail = meaningful.slice(alphaIdx + 1).map(stripExt);
        if (numericTail.length >= 2 && /^(?:19|20)\d{2}$/.test(numericTail[0])) {
          chosenSlug = `${alphaPrev} ${numericTail.join('-')}`;
        } else {
          chosenSlug = `${alphaPrev} ${lastSeg}`;
        }
      } else {
        chosenSlug = `${prevSeg} ${lastSeg}`;
      }
    }

    // Strip leading CMS/CDN 16+ hex ObjectId or UUID prefixes from filename slugs
    chosenSlug = chosenSlug.replace(
      /^(?:[0-9a-f]{16,}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})[_-\s]+/i,
      ''
    );

    let humanized = chosenSlug
      .replace(/[+_]+/g, ' ')
      .replace(/(?<!\d)-|-(?!\d)|--+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (!humanized || !/[\p{L}]/u.test(humanized)) {
      return domain || cleanTitle;
    }
    humanized = humanized.replace(
      /^(\d+[a-z]\.\s+|[^\p{L}]*)([\p{L}])/u,
      (_m, prefix: string, ch: string) => `${prefix}${ch.toUpperCase()}`
    );
    if (humanized.length > 160) {
      const cut = humanized.slice(0, 158);
      const lastSpace = cut.lastIndexOf(' ');
      humanized = `${(lastSpace > 80 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
    }
    return `${domain} — ${humanized}`;
  } catch {
    return cleanTitle || cleanUrl;
  }
}

const SOURCE_MATCH_STOP_WORDS = new Set([
  'og',
  'i',
  'til',
  'om',
  'for',
  'av',
  'pa',
  'med',
  'ved',
  'som',
  'en',
  'et',
  'de',
  'den',
  'det',
  'the',
  'and',
  'of',
  'to',
  'in',
  'no',
  'org',
  'com',
  'www',
  'https',
  'http',
  'html',
  'pdf',
]);

function normalizeTextForSourceMatch(raw: string): string {
  return transliterateNordicAscii(String(raw || ''))
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function tokenizeForSourceMatch(raw: string): string[] {
  const norm = normalizeTextForSourceMatch(raw);
  const tokens = norm
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 2 && !SOURCE_MATCH_STOP_WORDS.has(t));
  return Array.from(new Set<string>(tokens));
}

export function matchOrphanFootnoteToSource(
  orphanId: string,
  orphanDefLabel: string | undefined,
  sources: OKFSource[]
): OKFSource | null {
  if (!orphanId || !Array.isArray(sources) || sources.length === 0) return null;
  const idTokens = tokenizeForSourceMatch(orphanId);
  const labelTokens =
    orphanDefLabel && orphanDefLabel.trim() !== orphanId.trim()
      ? tokenizeForSourceMatch(orphanDefLabel)
      : [];
  const allOrphanTokens = Array.from(new Set([...idTokens, ...labelTokens]));
  if (allOrphanTokens.length === 0) return null;

  const stripParenthetical = (s?: string): string =>
    normalizeTextForSourceMatch(String(s || '').replace(/\([^)]*\)/g, ''))
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();

  const orphanCleanTitle =
    orphanDefLabel && orphanDefLabel.trim() !== orphanId.trim()
      ? stripParenthetical(orphanDefLabel)
      : '';

  let bestSrc: OKFSource | null = null;
  let bestScore = 0;
  let bestTotalMatch = 0;

  for (const src of sources) {
    if (!src || !src.id) continue;
    const srcIdTokens = new Set(tokenizeForSourceMatch(src.id));
    const srcTitleTokens = new Set(tokenizeForSourceMatch(src.title || ''));
    const srcUrlTokens = new Set(tokenizeForSourceMatch(src.resource || ''));
    const allSrcTokens = new Set([...srcIdTokens, ...srcTitleTokens, ...srcUrlTokens]);

    let score = 0;
    let idMatchCount = 0;
    let totalMatchCount = 0;

    for (const t of idTokens) {
      if (srcIdTokens.has(t)) {
        idMatchCount++;
        totalMatchCount++;
        score += t.length >= 8 ? 30 : 20;
      } else if (srcUrlTokens.has(t) || srcTitleTokens.has(t)) {
        idMatchCount++;
        totalMatchCount++;
        score += t.length >= 8 ? 25 : 15;
      }
    }

    for (const t of labelTokens) {
      if (idTokens.includes(t)) continue;
      if (allSrcTokens.has(t)) {
        totalMatchCount++;
        score += t.length >= 8 ? 12 : 8;
      }
    }

    if (orphanCleanTitle.length >= 15) {
      const srcCleanTitle = stripParenthetical(src.title);
      if (
        srcCleanTitle.length >= 15 &&
        (srcCleanTitle === orphanCleanTitle ||
          srcCleanTitle.includes(orphanCleanTitle) ||
          orphanCleanTitle.includes(srcCleanTitle))
      ) {
        score += 50;
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestSrc = src;
      bestTotalMatch = totalMatchCount;
    }
  }

  if (bestSrc && bestTotalMatch >= 2 && bestScore >= 25) {
    return bestSrc;
  }
  return null;
}

export function isAutoDomainSlugTitle(title?: string): boolean {
  return /^[a-z0-9.-]+\.[a-z]{2,}\s+[—–-]\s+/i.test(String(title || '').trim());
}

export function shouldUpgradeSourceTitle(
  existingTitle: string | undefined,
  candidateTitle: string | undefined,
  resourceUrl?: string
): boolean {
  const cand = String(candidateTitle || '').trim();
  if (!cand || isBareDomainTitle(cand, resourceUrl)) return false;
  if (resourceUrl && cand === resourceUrl.trim()) return false;
  const cur = String(existingTitle || '').trim();
  if (!cur || (resourceUrl && cur === resourceUrl.trim()) || isBareDomainTitle(cur, resourceUrl)) {
    return true;
  }
  const isShortSingleWordCand = /^[\p{L}\p{N}]{1,15}$/u.test(cand);
  if (isAutoDomainSlugTitle(cur) && !isAutoDomainSlugTitle(cand) && !isShortSingleWordCand) {
    return true;
  }
  if (cur.length < 18 && !isAutoDomainSlugTitle(cand) && cand.length >= cur.length + 10) {
    return true;
  }
  const curWordCount = cur.split(/\s+/).filter(Boolean).length;
  if (
    cur.length < 32 &&
    curWordCount < 4 &&
    !isAutoDomainSlugTitle(cand) &&
    cand.length >= cur.length * 2 &&
    cand.length >= 45
  ) {
    return true;
  }
  return false;
}

/**
 * Returns `true` when a Markdown line is a standalone internal `.md` concept-link bullet
 * (e.g. `- [Target Concept](/research/target.md)` or `* [Ref](../references/spec.md)`).
 */
export function isInternalConceptLinkBullet(line: string): boolean {
  return /^\s*(?:[-*+]|\d+[.)])\s+(?:\*\*[^*\r\n]+\*\*:?\s+)?\[[^\]]+\]\((?:\/|\.\.?\/|[A-Za-z0-9_\-]+\/)[^)\s]+\.md(?:[#?][^)\s]*)?\)(?:\s+\([^)\r\n]*\))?\s*$/i.test(
    String(line || '')
  );
}

/**
 * Structurally locates a trailing cross-concept backlink section heading (`#{1,4} ...`) at the end
 * of an OKF Markdown prose body (in *any* language) by checking whether every non-empty line after
 * that heading is an internal `.md` concept-link bullet or `<!-- okf:related-concepts -->`.
 * Returns `-1` when no trailing internal-link section exists.
 */
export function findTrailingRelatedConceptsHeadingIndex(lines: string[]): number {
  let end = lines.length - 1;
  while (
    end >= 0 &&
    (lines[end].trim() === '' || /^\[\^[A-Za-z0-9_\-]+\]:\s*.+$/.test(lines[end].trim()))
  ) {
    end--;
  }
  if (end < 0) return -1;

  let sawInternalBullet = false;
  for (let i = end; i >= 0; i--) {
    const trimmed = lines[i].trim();
    if (!trimmed || trimmed === '<!-- okf:related-concepts -->') continue;
    if (isInternalConceptLinkBullet(trimmed)) {
      sawInternalBullet = true;
      continue;
    }
    if (/^#{1,4}\s+\S/.test(trimmed)) {
      return sawInternalBullet ? i : -1;
    }
    return -1;
  }
  return -1;
}

/**
 * Strips any orphaned trailing empty citation/reference heading (`#{2,4} ...`) left at the very end
 * of `prose` after bottom `[^id]: ...` footnote definitions have been extracted—completely language-agnostic.
 */
export function stripTrailingEmptyCitationSection(prose: string): string {
  return String(prose || '')
    .replace(/\r?\n+---\s*$/g, '')
    .replace(/(?:\r?\n+---)?\r?\n+#{2,4}\s+[^\r\n]+(?:\r?\n+---)?\s*$/, '')
    .replace(/\r?\n+---\s*$/g, '')
    .trim();
}

/**
 * Self-heals an OKF v0.3 document in-place by:
 * 1. Enriching any bare-domain or CMS-polluted (`id<digits>`, `*Servlet`, `Downloads`) source titles in `doc.frontmatter.sources`.
 * 2. Deduplicating `doc.frontmatter.sources` that share an identical `resource` URL and rewriting alias `[^id]` citations.
 * 3. Filtering auto-injected low-signal social/forum/essay-mill grounding sources (`quora.com`, `reddit.com`, `instagram.com`, `scribd.com`) when authoritative sources exist.
 * 4. Resolving any orphan `[^id]` citations in `doc.body` against `doc.frontmatter.sources` (or stripping ungrounded orphans without concatenating adjacent words).
 * 5. Synchronizing the bottom `[^id]: Title` footnote definitions so `citedFootnoteIds.size === doc.frontmatter.sources.length`.
 */
export function healOrphanOkfFootnotes(doc: OKFDocument): boolean {
  if (!doc || !doc.frontmatter) return false;
  const rawSources = Array.isArray(doc.frontmatter.sources) ? doc.frontmatter.sources : [];
  if (rawSources.length === 0 && !doc.body) return false;

  let modified = false;

  // 1. Enrich bare-domain titles & deduplicate frontmatter sources by canonical resource URL
  const aliasMap = new Map<string, string>();
  const canonicalByUrl = new Map<string, OKFSource>();
  const dedupedSources: OKFSource[] = [];

  for (const s of rawSources) {
    if (!s || typeof s !== 'object') continue;
    if (!s.resource && typeof s.url === 'string') {
      s.resource = s.url.trim();
      delete s.url;
      modified = true;
    }
    const rawCandidateTitle = s.title ? decodeHtmlEntities(String(s.title)).trim() : s.title;
    if (rawCandidateTitle && rawCandidateTitle !== s.title) {
      s.title = rawCandidateTitle;
      modified = true;
    }
    const enrichedTitle = s.resource
      ? enrichBareDomainSourceTitle(s.title, String(s.resource))
      : s.title;
    if (enrichedTitle && enrichedTitle !== s.title) {
      s.title = enrichedTitle;
      modified = true;
    }
    const dedupeKeys = getCanonicalSourceDedupeKeys(
      s.resource,
      s.id,
      rawCandidateTitle || s.title
    );
    const existing = dedupeKeys.map((k) => canonicalByUrl.get(k)).find(Boolean);
    if (existing) {
      if (s.id && existing.id && s.id !== existing.id) {
        aliasMap.set(s.id, existing.id);
      }
      const fallbackUrl = String(s.resource || dedupeKeys[0] || '');
      const candidateForUpgrade =
        rawCandidateTitle && !isBareDomainTitle(rawCandidateTitle, fallbackUrl)
          ? rawCandidateTitle
          : s.title;
      if (shouldUpgradeSourceTitle(existing.title, candidateForUpgrade, fallbackUrl)) {
        existing.title = enrichBareDomainSourceTitle(candidateForUpgrade, fallbackUrl);
      }
      for (const k of dedupeKeys) {
        canonicalByUrl.set(k, existing);
      }
      modified = true;
    } else {
      for (const k of dedupeKeys) {
        canonicalByUrl.set(k, s);
      }
      dedupedSources.push(s);
    }
  }

  // Filter auto-generated low-signal grounding sources when authoritative sources are present
  const authoritativeSources = dedupedSources.filter((s) => !isAutoLowSignalSourceEntry(s));
  const filteredLowSignalIds = new Set<string>();
  if (authoritativeSources.length >= 1 && authoritativeSources.length < dedupedSources.length) {
    for (const s of dedupedSources) {
      if (isAutoLowSignalSourceEntry(s) && s.id) {
        filteredLowSignalIds.add(s.id);
      }
    }
    dedupedSources.length = 0;
    dedupedSources.push(...authoritativeSources);
    modified = true;
  }

  // 2. Separate body prose from bottom `[^id]: label` definitions
  const rawBody = String(doc.body || '');
  const existingDefs = new Map<string, string>();
  const proseLines: string[] = [];
  for (const line of rawBody.split(/\r?\n/)) {
    const m = line.trim().match(/^\[\^([A-Za-z0-9_\-]+)\]:\s*(.+)$/);
    if (m) {
      existingDefs.set(m[1], decodeHtmlEntities(m[2].trim()));
    } else {
      proseLines.push(line);
    }
  }

  let proseText = proseLines.join('\n');
  const validSourceById = new Map<string, OKFSource>();
  for (const s of dedupedSources) {
    if (s.id) validSourceById.set(s.id, s);
  }
  const fenceRewrites = new Map<string, string>();
  const fenceRemovals = new Set<string>();

  proseText = withProtectedMarkdownFences(
    proseText,
    (stashedProse) => {
      let p = stashedProse;

      // Expand comma/semicolon-separated multi-footnote brackets (`[^id1, ^id2]` or `[^id1,[^id1] 4]`) into separate `[^id1] [^id2]` tags
      p = p.replace(
        /\[\^([A-Za-z0-9_\-]+)\s*,\s*\[\^([A-Za-z0-9_\-]+)\]\s*([0-9A-Za-z_\-]+)\]/g,
        (_m, id1: string, id2: string, tail: string) => {
          const reconstructed = /^\d+$/.test(tail) ? `${id2.replace(/\d+$/, '')}${tail}` : `${id2}${tail}`;
          return `[^${id1}] [^${reconstructed}]`;
        }
      );
      p = p.replace(
        /\[\^([A-Za-z0-9_\-]+(?:\s*[,;]\s*(?:\[\^|\^)?[A-Za-z0-9_\-]+\]?)+)\]/g,
        (_m, inner: string) =>
          inner
            .split(/\s*[,;]\s*/)
            .map((part) => part.replace(/^\[?\^?/, '').replace(/\]$/, '').trim())
            .filter(Boolean)
            .map((id) => `[^${id}]`)
            .join(' ')
      );

      // Snap footnotes out of slash-joined words (`input[^id]/output` -> `input/output[^id]`)
      p = p.replace(
        /([\p{L}\p{N}_\-]+)(\[\^[A-Za-z0-9_\-]+\](?:[ \t]*\[\^[A-Za-z0-9_\-]+\])*)((?:\/[\p{L}\p{N}_\-]+)+)/gu,
        '$1$3$2'
      );

      // Strip redundant carets before `[^id]` (`^[^id]` -> `[^id]`) and convert bare `.^id` typos to `.[^id]` before rewriting aliases
      p = p.replace(/\^+(\[\^[A-Za-z0-9_\-]+\])/g, '$1');
      p = p.replace(/\.\^([a-z0-9]+(?:-[a-z0-9]+)+)/gi, '.[^$1]');

      // Rewrite duplicate-URL source aliases
      for (const [aliasId, canonicalId] of aliasMap.entries()) {
        fenceRewrites.set(aliasId, canonicalId);
        if (p.includes(`[^${aliasId}]`)) {
          p = p.replaceAll(`[^${aliasId}]`, `[^${canonicalId}]`);
          modified = true;
        }
      }

      // 3. Resolve or strip orphan `[^id]` citations in proseText
      const inlineFnIds = Array.from(
        new Set(Array.from(proseText.matchAll(/\[\^([A-Za-z0-9_\-]+)\]/g)).map((m) => m[1]))
      );
      for (const fnId of inlineFnIds) {
        const effId = aliasMap.get(fnId) || fnId;
        if (!validSourceById.has(effId)) {
          const matched = filteredLowSignalIds.has(effId)
            ? null
            : matchOrphanFootnoteToSource(effId, existingDefs.get(effId), dedupedSources);
          if (matched && matched.id) {
            fenceRewrites.set(effId, matched.id);
            p = p.replaceAll(`[^${effId}]`, `[^${matched.id}]`);
          } else {
            fenceRemovals.add(effId);
            p = removeSpecificFootnotePreservingBoundary(p, effId);
            p = p.replace(
              /(?<=[\p{L}\p{N})*_`”"»'])[ \t]+(\[\^[A-Za-z0-9_\-]+\])/gu,
              '$1'
            );
            p = p.replace(
              /(?<=[\p{L}\p{N})*_`\]”"»'])[ \t]+([.,;!?]|:(?!-))/gu,
              '$1'
            );
            p = p.replace(/(?<=\S)[ \t]{2,}/g, ' ');
            p = p.replace(/[ \t]+$/gm, '');
          }
          modified = true;
        }
      }

      // Snap any stray space between bold/word/quote and inline footnote (`**word** [^id]` -> `**word**[^id]`) or before clause punctuation (`[^id] :` -> `[^id]:`)
      const beforeSpaceSnap = p;
      p = p.replace(
        /(?<=[\p{L}\p{N})*_`”"»'])[ \t]+(\[\^[A-Za-z0-9_\-]+\])/gu,
        '$1'
      );
      p = p.replace(
        /(?<=[\p{L}\p{N})*_`\]”"»'])[ \t]+([.,;!?]|:(?!-))/gu,
        '$1'
      );
      if (p !== beforeSpaceSnap) {
        modified = true;
      }

      // Normalize trailing sentence & clause punctuation (`word.[^id]` -> `word[^id].`, `word:[^id]` -> `word[^id]:`, and `[^a].[^b]` -> `[^a] [^b].`) before collapsing duplicates
      let prevP = '';
      while (prevP !== p) {
        prevP = p;
        p = p.replace(
          /((?:\[\^[A-Za-z0-9_\-]+\][ \t]*)+)([.?!:;]+)((?:[ \t]*\[\^[A-Za-z0-9_\-]+\])+)/g,
          (fullMatch, leftFns: string, punctCluster: string, rightFns: string, offset: number, str: string) => {
            if (
              punctCluster === ':' &&
              /^\[\^[A-Za-z0-9_\-]+\]$/.test(leftFns.trim()) &&
              /(?:^|\r?\n)[\t ]*$/.test(str.slice(0, offset))
            ) {
              return fullMatch;
            }
            const finalPunct = punctCluster[punctCluster.length - 1];
            return `${leftFns.trimEnd()} ${rightFns.trimStart()}${finalPunct}`;
          }
        );
      }
      p = p.replace(
        /([^\s.?!:;])([.?!:;])((?:[ \t]*\[\^[A-Za-z0-9_\-]+\])+)([.?!:;]+)?/g,
        (
          fullMatch,
          before: string,
          punct: string,
          fns: string,
          trailingPunct: string | undefined,
          offset: number,
          str: string
        ) => {
          if (
            punct === ':' &&
            before === ']' &&
            /(?:^|\r?\n)[\t ]*\[\^[A-Za-z0-9_\-]+\]$/.test(str.slice(0, offset + 1))
          ) {
            return fullMatch;
          }
          const finalPunct = trailingPunct ? trailingPunct[trailingPunct.length - 1] : punct;
          return `${before}${fns.trimStart()}${finalPunct}`;
        }
      );

      // Collapse adjacent duplicate footnote citations (`[^a] [^a]` or `[^a][^a]` -> `[^a]`)
      p = p.replace(/(?:\[\^[A-Za-z0-9_\-]+\][ \t]*){2,}/g, (cluster) => {
        const trailingSpace = /[ \t]+$/.exec(cluster)?.[0] || '';
        const seenFn = new Set<string>();
        const uniqueRefs: string[] = [];
        for (const m of cluster.matchAll(/\[\^([A-Za-z0-9_\-]+)\]/g)) {
          if (!seenFn.has(m[1])) {
            seenFn.add(m[1]);
            uniqueRefs.push(`[^${m[1]}]`);
          }
        }
        return uniqueRefs.join(' ') + trailingSpace;
      });

      // Ensure a space follows any inline footnote citation that is immediately followed by a word character (`word[^id]Next` -> `word[^id] Next`)
      p = p.replace(/(\[\^[A-Za-z0-9_\-]+\])(?=[\p{L}\p{N}])/gu, '$1 ');
      return p;
    },
    (fence) => {
      let f = fence;
      for (const [oldId, newId] of fenceRewrites.entries()) {
        if (f.includes(`[^${oldId}]`)) {
          f = f.replaceAll(`[^${oldId}]`, `[^${newId}]`);
          modified = true;
        }
      }
      for (const remId of fenceRemovals) {
        const nextF = stripFootnoteFromMarkdownFence(f, remId);
        if (nextF !== f) {
          f = nextF;
          modified = true;
        }
      }
      return f;
    }
  );

  // 4. Filter uncited frontmatter sources & rebuild synchronized bottom footnote definitions
  const finalCitedIds = Array.from(
    new Set(Array.from(proseText.matchAll(/\[\^([A-Za-z0-9_\-]+)\]/g)).map((m) => m[1]))
  );
  const finalCitedSet = new Set(finalCitedIds);

  const finalSources =
    finalCitedSet.size > 0
      ? dedupedSources.filter((s) => s.id && finalCitedSet.has(s.id))
      : dedupedSources;
  if (finalSources.length !== rawSources.length) {
    modified = true;
  }
  doc.frontmatter.sources = finalSources;

  const footnoteLines: string[] = [];
  for (const fnId of finalCitedIds) {
    const src = validSourceById.get(fnId);
    const label = decodeHtmlEntities(src?.title || existingDefs.get(fnId) || src?.resource || fnId);
    footnoteLines.push(`[^${fnId}]: ${label}`);
  }

  const trimmedProse = stripTrailingEmptyCitationSection(proseText);
  const nextBody =
    footnoteLines.length > 0
      ? `${trimmedProse}\n\n${footnoteLines.join('\n')}\n`
      : trimmedProse
        ? `${trimmedProse}\n`
        : '';

  if (nextBody !== rawBody) {
    doc.body = nextBody;
    modified = true;
  }

  return modified;
}

export interface SourceDomainProvenance {
  hostname: string;
  isDirectFileAsset: boolean;
  claimedPublisher?: string;
  domainMismatch: boolean;
}

/**
 * Domain-neutral provenance check comparing a source's resolved URL hostname against any
 * explicit publisher attribution in its title (`– Publisher` / `| Publisher`).
 * Recognizes direct domain token overlap, parenthetical/initialism acronyms (`SEC` <-> `sec.gov`,
 * `NIST` <-> `nist.gov`), compound-word & syllabic initialisms, and official government /
 * intergovernmental umbrella portals (`.gov`, `gov.uk`, `europa.eu`),
 * while flagging third-party mirrors/uploads (`cdn.thirdparty.com`, `mirror.example.org`, `scribd.com`)
 * whose titles masquerade as another authority.
 */
export function inspectSourceDomainProvenance(source: {
  id?: string;
  title?: string;
  resource?: string;
  url?: string;
}): SourceDomainProvenance {
  const rawUrl = String(source?.resource || source?.url || '').trim();
  if (!rawUrl || isVertexRedirectUrl(rawUrl)) {
    return { hostname: '', isDirectFileAsset: false, domainMismatch: false };
  }
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return { hostname: '', isDirectFileAsset: false, domainMismatch: false };
  }
  const hostname = parsed.hostname.toLowerCase().replace(/^www\./, '');
  if (!hostname) {
    return { hostname: '', isDirectFileAsset: false, domainMismatch: false };
  }

  const isDirectFileAsset =
    /\.(?:pdf|docx?|xlsx?|pptx?)(?:$|[?#])/i.test(parsed.pathname) ||
    /\/(?:s3assets[^/]*|getfile(?:\.aspx)?|wp-content\/uploads|uploads|attachments)\b/i.test(
      parsed.pathname
    ) ||
    /(?:amazonaws\.com|cloudfront\.net|blob\.core\.windows\.net|storage\.googleapis\.com)$/i.test(
      hostname
    );

  const rawTitle = decodeHtmlEntities(String(source?.title || '').trim());
  if (!rawTitle) {
    return { hostname, isDirectFileAsset, domainMismatch: false };
  }

  const viaAnnotMatch = rawTitle.match(/\s*\(via\s+([a-z0-9.-]+\.[a-z]{2,})\)\s*$/i);
  const titleWithoutVia = viaAnnotMatch
    ? rawTitle.slice(0, rawTitle.length - viaAnnotMatch[0].length).trim()
    : rawTitle;

  const sepMatch = titleWithoutVia.match(
    /\s+(?:([|])|[–—]|-\s)\s*([^\s–—|](?:(?!\s+-\s)[^–—|]){1,59})\s*$/
  );
  if (!sepMatch) {
    return { hostname, isDirectFileAsset, domainMismatch: false };
  }
  const prefixHostCandidate = titleWithoutVia
    .slice(0, sepMatch.index ?? 0)
    .trim()
    .toLowerCase()
    .replace(/^www\./, '');
  if (
    prefixHostCandidate &&
    (prefixHostCandidate === hostname || hostname.endsWith(`.${prefixHostCandidate}`))
  ) {
    return { hostname, isDirectFileAsset, domainMismatch: false };
  }
  const isPipeSep = sepMatch[1] === '|';
  const candidatePub = sepMatch[2].trim();
  const pubWords = candidatePub.split(/\s+/).filter(Boolean);
  if (pubWords.length === 0 || pubWords.length > 6) {
    return { hostname, isDirectFileAsset, domainMismatch: false };
  }
  // Ignore lowercase phrases (unless domain-like), section/chapter/date markers, pure formal document IDs, or generic subtitle words
  if (
    (/^\p{Ll}/u.test(candidatePub) && !/\.[a-z]{2,}$/i.test(candidatePub)) ||
    /^(?:§+|(?:ch(?:apter|\.)?|sec(?:tion|\.)?|art(?:icle|\.)?|part|mod(?:ule|\.)?|step|phase|rev(?:ision|\.)?)\s*\d|table\b|figure\b|appendix\b|v\d|\d{4}\b|q[1-4]\b)/i.test(
      candidatePub
    ) ||
    (!candidatePub.includes('(') &&
      (/^(?:[\p{Lu}]{2,8}[-/]\d[\w./:-]*|(?:ISO|IEC|IEEE|ANSI|ASTM|NIST|NS|EN|BS|DIN|RFC|CVE)\s*[-:]?\s*\d[\w./:+:-]*)$/u.test(
        candidatePub
      ) ||
        /^[\p{L}\s.#/-]{1,40}\b\d{6,}\s*$/u.test(candidatePub))) ||
    /\([^()]*\b(?:\d[\s-]?){5,}\d\b[^()]*\)\s*$/.test(candidatePub) ||
    /\b-?\d{1,2}\.\d{3,}\s*,\s*-?\d{1,3}\.\d{3,}\b/.test(candidatePub) ||
    /^(?:[\p{L}][\p{L}\s.'-]*\s+\d+[A-Za-z]?\s*,\s*[A-Z0-9]{2,6}(?:[\s-][A-Z0-9]{2,5})?\s+[\p{L}]|\d+[A-Za-z]?\s+[\p{L}][\p{L}\s.'-]*,\s*[\p{L}])/u.test(
      candidatePub
    ) ||
    /^\d+[\d\s.,:\-–/]*$/.test(candidatePub)
  ) {
    return { hostname, isDirectFileAsset, domainMismatch: false };
  }

  const normAscii = (s: string) =>
    transliterateNordicAscii(s)
      .toLowerCase()
      .replace(/ß/g, 'ss')
      .replace(/œ/g, 'oe')
      .replace(/ł/g, 'l')
      .replace(/[đð]/g, 'd')
      .replace(/þ/g, 'th')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

  const pubSlug = normAscii(candidatePub)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const srcIdLower = String(source?.id || '').toLowerCase();
  const idEncodesPub = Boolean(
    pubSlug &&
      pubSlug.length >= 3 &&
      (srcIdLower.endsWith(`-${pubSlug}`) || srcIdLower.startsWith(`${pubSlug}-`))
  );

  const hasParenAcronym = /\([\p{Lu}0-9]{2,10}\)\s*$/u.test(candidatePub);
  const hasInstitutionalRoot =
    /(?:\b(?:ministr\w*|minister\w*|minist[eè]r\w*|depart\w*|directorat\w*|agenc\w*|authorit\w*|commiss\w*|institut\w*|council|board|office|bureau|court|bank\w*|universit\w*|administrat\w*|federat\w*|associat\w*|organi[sz]at\w*|societ\w*|foundat\w*)|(?:direktorat|departement|forening|förening|forbund|förbund|verein|verband|tilsyn|styrels|myndighet|anstalt|behörde)\w*)\b/i.test(
      candidatePub
    );
  const isSentenceCaseSubtitle =
    pubWords.length >= 2 &&
    !hasInstitutionalRoot &&
    /^\p{Ll}/u.test(pubWords[1]) &&
    !/^(?:for|of|in|on|to|by|at|de|du|des|la|le|les|van|von|zu|fur|für|af|av|og|and|und|och|et|del|della|para|con|por)$/i.test(
      pubWords[1]
    );
  if (
    !isPipeSep &&
    !hasParenAcronym &&
    !idEncodesPub &&
    (pubWords.length > 4 ||
      isSentenceCaseSubtitle ||
      (!hasInstitutionalRoot &&
        /\b(?:overview|introduction|summary|guide|guidance|guidelines|manual|handbook|whitepaper|circular|playbook|brief|standard|directive|checklist|analysis|assessment|requirements|actions|report|edition|key\s+points|veileder|veiledning|temaveiledning|rundskriv|rapport|forskrift|retningslinjer|handbok|håndbok|sjekkliste|oversikt|innledning|sammenstilling|richtlinie|leitfaden|handbuch|merkblatt|bericht|guide\s+pratique|manuel|guía|informe|manuale|relazione)\b/iu.test(
          candidatePub
        )))
  ) {
    return { hostname, isDirectFileAsset, domainMismatch: false };
  }

  // Official shared government / intergovernmental umbrella portals legitimately host ministries & agencies
  if (
    /(?:^|\.)(?:gov|gov\.[a-z]{2}|gob\.[a-z]{2}|gouv\.[a-z]{2}|gv\.[a-z]{2}|go\.[a-z]{2}|mil|mil\.[a-z]{2}|int)$/i.test(
      hostname
    ) ||
    /(?:^|\.)(?:europa\.eu|canada\.ca|usa\.gov|bund\.de|bundesregierung\.de|admin\.ch|rijksoverheid\.nl|overheid\.nl|gouvernement\.fr|regeringen\.se|riksdagen\.se|regeringen\.dk|regjeringen\.no|stortinget\.no|who\.int|un\.org|oecd\.org|worldbank\.org)$/i.test(
      hostname
    )
  ) {
    return { hostname, isDirectFileAsset, claimedPublisher: candidatePub, domainMismatch: false };
  }

  // Universal DNS label extraction: strip rightmost TLD (any gTLD/ccTLD), 2nd-level public-suffix registries, and infra prefixes
  const sldRegistries = new Set([
    'co',
    'com',
    'org',
    'or',
    'net',
    'ne',
    'edu',
    'ed',
    'ac',
    'gov',
    'gob',
    'gouv',
    'gv',
    'go',
    'mil',
    'nic',
    'asn',
    're',
    'lg',
    'nhs',
  ]);
  const infraPrefixes = new Set([
    'www',
    'www2',
    'wwwex',
    'web',
    'ws',
    'wfs',
    'wms',
    'wmts',
    'ogc',
    'geo',
    'gis',
    'services',
    'service',
    'rest',
    'public',
    'secure',
    'portal',
    'app',
    'api',
    'data',
    'opendata',
    'open',
    'developer',
    'developers',
    'docs',
    'cdn',
    'static',
    'files',
    'media',
  ]);
  const rawHostParts = hostname
    .split('.')
    .map((p) => p.replace(/[^a-z0-9]/g, ''))
    .filter(Boolean);
  const withoutTld = rawHostParts.length >= 2 ? rawHostParts.slice(0, -1) : rawHostParts;
  const withoutSld =
    withoutTld.length >= 2 && sldRegistries.has(withoutTld[withoutTld.length - 1])
      ? withoutTld.slice(0, -1)
      : withoutTld;
  const hostTokens = withoutSld.filter((p) => p.length >= 2 && !infraPrefixes.has(p));

  if (hostTokens.length === 0) {
    return { hostname, isDirectFileAsset, claimedPublisher: candidatePub, domainMismatch: false };
  }

  const articleTokens = new Set(['the', 'la', 'le', 'les', 'de', 'het', 'een', 'der', 'die', 'das']);
  const prepTokens = new Set([
    'for',
    'of',
    'in',
    'on',
    'to',
    'by',
    'at',
    'from',
    'with',
    'about',
    'into',
    'over',
    'under',
    'om',
    'i',
    'pa',
    'til',
    'av',
    'ved',
    'fra',
    'hos',
    'mot',
    'fur',
    'von',
    'zu',
    'sur',
    'dans',
    'pour',
    'par',
    'con',
    'sobre',
    'van',
    'bij',
  ]);
  const pubStop = new Set([
    ...articleTokens,
    ...prepTokens,
    'og',
    'and',
    'och',
    'und',
    'et',
    'du',
    'des',
    'us',
    'uk',
  ]);

  const doesPubMatchHostToken = (
    pubStr: string,
    hp: string,
    strictLeading = false,
    allowParenRecursion = true
  ): boolean => {
    if (!strictLeading && allowParenRecursion) {
      for (const parenMatch of pubStr.matchAll(/\(([^()]{2,80})\)/g)) {
        const parenInner = parenMatch[1].trim();
        if (parenInner && doesPubMatchHostToken(parenInner, hp, false, false)) {
          return true;
        }
      }
    }
    const stripped = pubStr.replace(/\([^)]*\)/g, ' ');
    const allTokens = normAscii(stripped)
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length >= 2);
    const trimmedLead = allTokens.slice();
    while (trimmedLead.length > 1 && articleTokens.has(trimmedLead[0])) {
      trimmedLead.shift();
    }
    if (strictLeading && (trimmedLead.length === 0 || prepTokens.has(trimmedLead[0]))) {
      return false;
    }
    const rawPubTokens = allTokens.filter((t) => !pubStop.has(t));
    const pubJoined = rawPubTokens.join('');

    const acronyms = new Set<string>();
    for (const pm of pubStr.matchAll(/\(([\p{L}\p{N}]{2,12})\)/gu)) {
      acronyms.add(normAscii(pm[1]).replace(/[^a-z0-9]/g, ''));
    }
    for (const um of pubStr.matchAll(/(?:^|[^\p{L}\p{N}])([\p{Lu}]{2,10})(?=$|[^\p{L}\p{N}])/gu)) {
      acronyms.add(normAscii(um[1]).replace(/[^a-z0-9]/g, ''));
    }
    if (rawPubTokens.length >= 2) {
      acronyms.add(rawPubTokens.map((t) => t[0]).join(''));
    }
    if (allTokens.length >= 2 && allTokens.length <= 6) {
      acronyms.add(allTokens.map((t) => t[0]).join(''));
    }

    if (acronyms.has(hp)) return true;
    for (const ac of acronyms) {
      if (ac.length >= 3 && (hp.includes(ac) || ac.includes(hp))) return true;
    }
    if (strictLeading) {
      const firstPrepIdx = trimmedLead.findIndex((t) => prepTokens.has(t));
      const prePrep = firstPrepIdx === -1 ? trimmedLead : trimmedLead.slice(0, firstPrepIdx);
      for (let idx = 0; idx < Math.min(2, prePrep.length); idx++) {
        if (idx === 1 && (prePrep.length !== 2 || firstPrepIdx !== -1)) continue;
        const pt = prePrep[idx];
        if (pubStop.has(pt)) continue;
        if (pt === hp) return true;
        if (pt.length >= 4 && hp.includes(pt)) return true;
        if (hp.length >= 4 && pt.includes(hp)) return true;
      }
    } else {
      for (const pt of rawPubTokens) {
        if (pt === hp) return true;
        if (pt.length >= 4 && hp.includes(pt)) return true;
        if (hp.length >= 4 && pt.includes(hp)) return true;
      }
    }
    // Compound-word abbreviation (e.g., "cybercom" <-> "cyber command", "fda" / prefix+stem)
    if (hp.length >= 4 && pubJoined.startsWith(hp[0]) && pubJoined.includes(hp.slice(1))) {
      return true;
    }
    for (let splitAt = 2; splitAt <= Math.min(4, hp.length - 3); splitAt++) {
      if (
        pubJoined.startsWith(hp.slice(0, splitAt)) &&
        pubJoined.indexOf(hp.slice(splitAt), splitAt) !== -1
      ) {
        return true;
      }
    }
    // Multi-token syllabic / compound initialism across official directorates & agencies
    if (rawPubTokens.length >= 2 && hp.length >= 3 && hp.length <= 8) {
      const matchSyllabicTokens = (tokIdx: number, hpIdx: number): boolean => {
        if (tokIdx === rawPubTokens.length) return hpIdx === hp.length;
        if (hpIdx >= hp.length) return false;
        const tok = rawPubTokens[tokIdx];
        if (tok[0] !== hp[hpIdx]) return false;
        const maxPrefix = Math.min(4, tok.length, hp.length - hpIdx);
        for (let len = 1; len <= maxPrefix; len++) {
          if (tok.slice(0, len) === hp.slice(hpIdx, hpIdx + len)) {
            if (matchSyllabicTokens(tokIdx + 1, hpIdx + len)) return true;
          }
        }
        if (tok.length >= 8) {
          const maxStem = Math.min(4, hp.length - hpIdx - 1);
          for (let remLen = 1; remLen <= maxStem; remLen++) {
            const sub = hp.slice(hpIdx + 1, hpIdx + 1 + remLen);
            const minOffset = remLen === 1 ? 3 : 2;
            if (tok.indexOf(sub, minOffset) !== -1) {
              if (matchSyllabicTokens(tokIdx + 1, hpIdx + 1 + remLen)) return true;
            }
          }
        }
        return false;
      };
      if (matchSyllabicTokens(0, 0)) return true;
    }
    return false;
  };

  const matchesHost = hostTokens.some((hp) => doesPubMatchHostToken(candidatePub, hp, false));

  // Hardened Publisher-First title layout (`"<True Host Publisher> – <Article Title>"`)
  if (!matchesHost && !viaAnnotMatch && !idEncodesPub && !hasParenAcronym) {
    const rawPrefix = titleWithoutVia.slice(0, sepMatch.index ?? 0).trim();
    if (rawPrefix && !/\s+(?:[|–—]\s*|-\s+)/.test(rawPrefix)) {
      const leadOrg = rawPrefix.split(/\s*[/:\u2215]\s*/)[0].trim();
      const leadWords = leadOrg.split(/\s+/).filter(Boolean);
      const leadNorm = normAscii(leadOrg);
      const primaryHostToken = hostTokens[hostTokens.length - 1];
      const srcIdStartsWithHost = srcIdLower.startsWith(`${primaryHostToken}-`);
      const leadAcronyms = new Set<string>();
      for (const pm of leadOrg.matchAll(/\(([\p{L}\p{N}]{2,12})\)/gu)) {
        leadAcronyms.add(normAscii(pm[1]).replace(/[^a-z0-9]/g, ''));
      }
      for (const um of leadOrg.matchAll(/(?:^|[^\p{L}\p{N}])([\p{Lu}]{2,10})(?=$|[^\p{L}\p{N}])/gu)) {
        leadAcronyms.add(normAscii(um[1]).replace(/[^a-z0-9]/g, ''));
      }
      const leadHasHostAcronym = leadAcronyms.has(primaryHostToken);
      const isStatuteOrDocTitle =
        !srcIdStartsWithHost &&
        !leadHasHostAcronym &&
        (/^(?:lov|forskrift|veileder|veiledning|retningslinjer|rundskriv|rapport|kapittel|del|act|law|regulation|statute|directive|ordinance|guidance|guide|report|form|gesetz|verordnung|loi|decret|ley|decreto)\b/.test(
          leadNorm
        ) ||
          /(?:loven|forskriften|\s+(?:act|law|statute|regulation|directive|ordinance|gesetz|verordnung))$/.test(
            leadNorm
          ));
      if (leadWords.length >= 1 && leadWords.length <= 7 && !isStatuteOrDocTitle) {
        const allHostTokensAccounted =
          hostTokens.length === 1 ||
          srcIdStartsWithHost ||
          leadHasHostAcronym ||
          hostTokens.every((hp) => doesPubMatchHostToken(rawPrefix, hp, false));
        if (
          allHostTokensAccounted &&
          (pubWords.length >= 2 || srcIdStartsWithHost || leadHasHostAcronym) &&
          doesPubMatchHostToken(leadOrg, primaryHostToken, true)
        ) {
          return { hostname, isDirectFileAsset, domainMismatch: false };
        }
      }
    }
  }

  return {
    hostname,
    isDirectFileAsset,
    claimedPublisher: candidatePub,
    domainMismatch: !matchesHost || Boolean(viaAnnotMatch),
  };
}
