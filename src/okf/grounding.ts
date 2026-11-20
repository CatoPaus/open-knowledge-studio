import * as path from 'path';

import { GEMINI_4_ARGON_MODEL } from '../interactions/index.js';
import { decodeHtmlEntities, normalizeIsoTimestamp, parseValidIsoTimestamp } from './timestamps.js';
import { type OKFActorEvent, type OKFDocument, type OKFFrontmatter, type OKFSource, normalizeOkfActor, normalizeOkfTags, parseOkfDocument, serializeOkfDocument, transliterateNordicAscii } from './document.js';
import { type CleanGroundingOptions, collectExistingBundleSources, enrichBareDomainSourceTitle, extractSourceMatchTokens, findTrailingRelatedConceptsHeadingIndex, generateSourceSlugId, getCanonicalSourceDedupeKeys, healOrphanOkfFootnotes, inferSourceMimeTypeFromUrl, inspectSourceDomainProvenance, isAutoDomainSlugTitle, isBareDomainTitle, isInternalConceptLinkBullet, isLowSignalGroundingUrl, isMultiRecordArchiveUrl, isVertexRedirectUrl, matchOrphanFootnoteToSource, normalizeCanonicalSourceUrl, normalizeHttpMimeType, normalizeSourceMatchKey, removeSpecificFootnotePreservingBoundary, resolveRedirect, shouldUpgradeSourceTitle, stripTrailingEmptyCitationSection, stripTrailingPortalViewChrome } from './provenance.js';

export interface CurateOkfSourcesOptions {
  rejectSourceIds?: string[];
  replaceSourceMap?: Record<string, string>;
  addSources?: Array<{
    url: string;
    title?: string;
    id?: string;
    mimeType?: string;
    mime_type?: string;
    retrievedAt?: string;
    retrieved_at?: string;
    lastModified?: string;
    last_modified?: string;
  }>;
}

/**
 * Deterministically curates an OKF v0.3 Markdown document by:
 * 1. Re-anchoring inline citations from rejected sources to existing or newly added sources (`replaceSourceMap`),
 *    so `[^old-id]` becomes `[^new-id]` across the entire document at zero LLM token cost.
 * 2. Rejecting specified source IDs (`rejectSourceIds`), detecting any prose lines or sentences/table cells
 *    whose only remaining citation was an un-replaced rejected source (`orphanClaimLines`), removing the rejected
 *    sources from `frontmatter.sources`, and stripping `[^rejected-id]` inline tags and bottom definitions
 *    while preserving word boundaries and sentence punctuation.
 * 3. Adding human-supplied sources (`addSources`), deduplicating by canonical URL, generating
 *    clean Nordic-transliterated slug IDs, enriching titles, and weaving `[^id]` inline + bottom
 *    definitions so 3-way OKF v0.3 footnote parity (`frontmatter.sources == inline [^id] == bottom definitions`)
 *    is guaranteed.
 */
export function curateOkfSources(
  rawMarkdown: string,
  options: CurateOkfSourcesOptions
): {
  markdown: string;
  rejectedIds: string[];
  replacedMap: Record<string, string>;
  addedSources: OKFSource[];
  orphanClaimLines: string[];
} {
  const doc = parseOkfDocument(rawMarkdown);
  if (!doc.frontmatter) {
    doc.frontmatter = { type: 'Research Concept', status: 'draft' };
  }
  const initialSources: OKFSource[] = Array.isArray(doc.frontmatter.sources)
    ? doc.frontmatter.sources.map((s) => ({ ...s }))
    : [];

  const cleanFnId = (val: string) =>
    String(val || '')
      .trim()
      .replace(/^\[\^/, '')
      .replace(/\]$/, '')
      .trim();

  const rawReplaceEntries: Array<[string, string]> = [];
  if (options?.replaceSourceMap && typeof options.replaceSourceMap === 'object') {
    for (const [rawOld, rawTarget] of Object.entries(options.replaceSourceMap)) {
      const oldId = cleanFnId(rawOld);
      const targetSpec = String(rawTarget || '')
        .trim()
        .replace(/^\[\^/, '')
        .replace(/\]$/, '')
        .trim();
      if (oldId && targetSpec && oldId !== targetSpec) {
        rawReplaceEntries.push([oldId, targetSpec]);
      }
    }
  }

  const normalizedRejectIds = Array.from(
    new Set([
      ...(options?.rejectSourceIds || []).map(cleanFnId).filter(Boolean),
      ...rawReplaceEntries.map(([oldId]) => oldId),
    ])
  );
  const rejectSet = new Set(normalizedRejectIds);

  const rawBody = String(doc.body || '');
  const existingDefs = new Map<string, string>();
  const proseLines: string[] = [];
  for (const rawLine of rawBody.split(/\r?\n/)) {
    const defMatch = rawLine.trim().match(/^\[\^([A-Za-z0-9_\-]+)\]:\s*(.+)$/);
    if (defMatch) {
      if (!rejectSet.has(defMatch[1])) {
        existingDefs.set(defMatch[1], decodeHtmlEntities(defMatch[2].trim()));
      }
    } else {
      // Pre-normalize malformed `^[^id]` or `.^id` so rejected inline markers are caught cleanly
      const cleanedLine = rawLine
        .replace(/\^\[\^([A-Za-z0-9_\-]+)\]/g, '[^$1]')
        .replace(/([\p{L}\p{N}.)”"»])\^([a-z][a-z0-9_\-]{2,})(?=[\s.,;!?)\]]|$)/gu, '$1[^$2]');
      proseLines.push(cleanedLine);
    }
  }

  // Track actually rejected IDs (present in initial frontmatter.sources or initial inline body)
  const existingSourceIds = new Set(
    initialSources.map((s) => String(s?.id || '').trim()).filter(Boolean)
  );
  const initialInlineBodyIds = new Set(
    Array.from(proseLines.join('\n').matchAll(/\[\^([A-Za-z0-9_\-]+)\]/g)).map((m) => m[1])
  );
  const rejectedIds = normalizedRejectIds.filter(
    (id) => existingSourceIds.has(id) || initialInlineBodyIds.has(id)
  );

  // Filter out rejected sources from frontmatter.sources
  const remainingSources: OKFSource[] = initialSources.filter(
    (s) => s && !rejectSet.has(String(s.id || '').trim())
  );

  const parseInlineReplaceUrlSpec = (
    specRaw: string
  ): { url: string; title?: string; id?: string } | undefined => {
    let rest = String(specRaw || '').trim();
    let customId: string | undefined;
    const idPrefix = rest.match(/^id=([A-Za-z0-9_\-]+)\|([\s\S]+)$/i);
    if (idPrefix) {
      customId = idPrefix[1].trim();
      rest = idPrefix[2].trim();
    }
    if (!/^https?:\/\//i.test(rest)) return undefined;
    const pipeIdx = rest.indexOf('|');
    const url = (pipeIdx !== -1 ? rest.slice(0, pipeIdx) : rest).trim();
    const title = pipeIdx !== -1 ? rest.slice(pipeIdx + 1).trim() : '';
    if (!url) return undefined;
    return {
      url,
      ...(title ? { title } : {}),
      ...(customId ? { id: customId } : {}),
    };
  };

  // Register human-added sources (plus any standalone `https://...` targets in `replaceSourceMap`)
  // BEFORE resolving `replaceSourceMap` so `--replace-source oldId=https://...` works standalone without `--add-source`
  const addedSources: OKFSource[] = [];
  const existingMatchIdsToWeave: string[] = [];
  const baseAddList = Array.isArray(options?.addSources) ? options.addSources : [];
  const existingByCanonKey = new Map<string, OKFSource>();
  for (const s of remainingSources) {
    for (const k of getCanonicalSourceDedupeKeys(String(s.resource || s.url || ''), s.id, s.title)) {
      existingByCanonKey.set(k, s);
    }
  }

  const effectiveAddList = [...baseAddList];
  const queuedCanonKeys = new Set<string>();
  for (const item of effectiveAddList) {
    const u = String(item?.url || '').trim();
    if (!u) continue;
    for (const k of getCanonicalSourceDedupeKeys(u, item?.id, item?.title)) {
      queuedCanonKeys.add(k);
    }
  }
  for (const [, targetSpec] of rawReplaceEntries) {
    const parsedUrlTarget = parseInlineReplaceUrlSpec(targetSpec);
    if (!parsedUrlTarget) continue;
    const targetKeys = getCanonicalSourceDedupeKeys(
      parsedUrlTarget.url,
      parsedUrlTarget.id,
      parsedUrlTarget.title
    );
    if (
      targetKeys.length > 0 &&
      !targetKeys.some((k) => existingByCanonKey.has(k) || queuedCanonKeys.has(k))
    ) {
      effectiveAddList.push(parsedUrlTarget);
      for (const k of targetKeys) queuedCanonKeys.add(k);
    }
  }

  if (effectiveAddList.length > 0) {
    const nowIso = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
    const usedIds = new Set<string>([
      ...remainingSources.map((s) => String(s?.id || '').trim()).filter(Boolean),
      ...normalizedRejectIds,
    ]);
    for (const m of proseLines.join('\n').matchAll(/\[\^([A-Za-z0-9_\-]+)\]/g)) {
      usedIds.add(m[1]);
    }

    for (const item of effectiveAddList) {
      const rawUrl = String(item?.url || '').trim();
      if (!rawUrl) continue;
      const rawLastMod = item.lastModified || item.last_modified;
      const rawRetAt = item.retrievedAt || item.retrieved_at;
      const rawMime = normalizeHttpMimeType(item.mimeType || item.mime_type) || inferSourceMimeTypeFromUrl(rawUrl);
      const itemKeys = getCanonicalSourceDedupeKeys(rawUrl, item.id, item.title);
      const existingMatch = itemKeys.map((k) => existingByCanonKey.get(k)).find(Boolean);
      if (existingMatch && existingMatch.id) {
        if (item.title && shouldUpgradeSourceTitle(existingMatch.title, item.title, rawUrl)) {
          existingMatch.title = enrichBareDomainSourceTitle(item.title, rawUrl);
          existingDefs.set(existingMatch.id, existingMatch.title);
        }
        if (rawLastMod && !existingMatch.last_modified) {
          const validLm = parseValidIsoTimestamp(rawLastMod);
          if (validLm) existingMatch.last_modified = validLm;
        }
        if (rawMime && !existingMatch.mime_type) {
          existingMatch.mime_type = rawMime;
        }
        for (const k of itemKeys) existingByCanonKey.set(k, existingMatch);
        existingMatchIdsToWeave.push(existingMatch.id);
        continue;
      }

      const rawCustomId = item.id
        ? transliterateNordicAscii(String(item.id))
            .toLowerCase()
            .replace(/[^a-z0-9_-]+/g, '-')
            .replace(/^-+|-+$/g, '')
        : '';
      let slugId = '';
      if (rawCustomId && !usedIds.has(rawCustomId)) {
        slugId = rawCustomId;
        usedIds.add(slugId);
      } else {
        slugId = generateSourceSlugId(item.title || rawUrl, rawUrl, usedIds);
      }

      const enrichedTitle = enrichBareDomainSourceTitle(item.title || rawUrl, rawUrl);
      const retrievedAt = parseValidIsoTimestamp(rawRetAt) || nowIso;
      const lastModified = parseValidIsoTimestamp(rawLastMod);
      const newSrc: OKFSource = {
        id: slugId,
        resource: rawUrl,
        title: enrichedTitle,
        ...(rawMime ? { mime_type: rawMime } : {}),
        retrieved_at: retrievedAt,
        ...(lastModified ? { last_modified: lastModified } : {}),
      };
      remainingSources.push(newSrc);
      addedSources.push(newSrc);
      for (const k of [
        ...itemKeys,
        ...getCanonicalSourceDedupeKeys(rawUrl, slugId, enrichedTitle),
      ]) {
        existingByCanonKey.set(k, newSrc);
      }
      existingDefs.set(slugId, enrichedTitle);
    }
  }

  // Apply `replaceSourceMap` re-anchoring (`[^oldId]` -> `[^newId]`) before orphan-claim detection
  const replacedMap: Record<string, string> = {};
  if (rawReplaceEntries.length > 0) {
    const activeById = new Map<string, OKFSource>();
    for (const s of remainingSources) {
      if (s && s.id) activeById.set(String(s.id).trim(), s);
    }
    for (const [oldId, targetSpec] of rawReplaceEntries) {
      let resolvedTarget: OKFSource | undefined = activeById.get(targetSpec);
      if (!resolvedTarget) {
        const parsedUrlTarget = parseInlineReplaceUrlSpec(targetSpec);
        if (parsedUrlTarget) {
          const targetKeys = getCanonicalSourceDedupeKeys(
            parsedUrlTarget.url,
            parsedUrlTarget.id,
            parsedUrlTarget.title
          );
          resolvedTarget =
            targetKeys.map((k) => existingByCanonKey.get(k)).find(Boolean) ||
            (parsedUrlTarget.id ? activeById.get(parsedUrlTarget.id) : undefined);
        }
      }
      if (resolvedTarget && resolvedTarget.id && resolvedTarget.id !== oldId) {
        const newId = resolvedTarget.id;
        replacedMap[oldId] = newId;
        const escapedOld = oldId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const escapedNew = newId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const oldFnRe = new RegExp(`\\[\\^${escapedOld}\\]`, 'g');
        const dupNewRe = new RegExp(`(\\[\\^${escapedNew}\\])(?:\\s*\\[\\^${escapedNew}\\])+`, 'g');
        for (let idx = 0; idx < proseLines.length; idx++) {
          if (proseLines[idx].includes(`[^${oldId}]`)) {
            proseLines[idx] = proseLines[idx]
              .replace(oldFnRe, `[^${newId}]`)
              .replace(dupNewRe, '$1');
          }
        }
      }
    }
  }

  // Detect prose lines (or individual sentences / table cells on multi-citation lines) that cite an un-replaced
  // rejected source and have no other non-rejected citation backing that claim.
  const orphanClaimLines: string[] = [];
  if (rejectSet.size > 0) {
    for (const line of proseLines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const citedOnLine = Array.from(trimmed.matchAll(/\[\^([A-Za-z0-9_\-]+)\]/g)).map((m) => m[1]);
      if (citedOnLine.length === 0) continue;
      const citesRejected = citedOnLine.some((id) => rejectSet.has(id));
      const citesNonRejected = citedOnLine.some((id) => !rejectSet.has(id));
      if (citesRejected && !citesNonRejected) {
        orphanClaimLines.push(trimmed);
      } else if (citesRejected && citesNonRejected) {
        const subSegments =
          trimmed.startsWith('|') && trimmed.endsWith('|')
            ? trimmed
                .split('|')
                .map((s) => s.trim())
                .filter(Boolean)
            : trimmed
                .split(/(?<=[.?!](?:\s*\[\^[A-Za-z0-9_\-]+\])*)\s+/)
                .map((s) => s.trim())
                .filter(Boolean);
        if (subSegments.length > 1) {
          for (const seg of subSegments) {
            const segCited = Array.from(seg.matchAll(/\[\^([A-Za-z0-9_\-]+)\]/g)).map((m) => m[1]);
            if (segCited.length === 0) continue;
            const segRej = segCited.some((id) => rejectSet.has(id));
            const segKeep = segCited.some((id) => !rejectSet.has(id));
            if (segRej && !segKeep) {
              orphanClaimLines.push(seg);
            }
          }
        }
      }
    }
  }

  // Strip any remaining rejected [^id] citations from prose while preserving word boundaries, table cells, and punctuation
  let proseText = proseLines.join('\n');
  for (const rejId of normalizedRejectIds) {
    proseText = removeSpecificFootnotePreservingBoundary(proseText, rejId);
    proseText = proseText.replace(
      /(?<=[\p{L}\p{N})*_`”"»'])[ \t]+(\[\^[A-Za-z0-9_\-]+\])/gu,
      '$1'
    );
    proseText = proseText.replace(
      /(?<=[\p{L}\p{N})*_`\]”"»'])[ \t]+([.,;!?]|:(?!-))/gu,
      '$1'
    );
    proseText = proseText.replace(/(?<=\S)[ \t]{2,}/g, ' ');
    proseText = proseText.replace(/[ \t]+$/gm, '');
  }

  // Ensure any newly added sources that weren't already cited inline (e.g. via `replaceSourceMap`) are weaved for 3-way parity
  if (addedSources.length > 0 || existingMatchIdsToWeave.length > 0) {
    const ensureInlineCitationWeaved = (fnId: string) => {
      const escaped = fnId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      if (new RegExp(`\\[\\^${escaped}\\]`).test(proseText)) {
        return;
      }
      const lines = proseText.split(/\r?\n/);
      const trailingRelatedHeadingIdx = findTrailingRelatedConceptsHeadingIndex(lines);
      let firstProseIdx = -1;
      let firstListIdx = -1;
      const candidateIndices: number[] = [];
      let inFence = false;
      for (let i = 0; i < lines.length; i++) {
        if (trailingRelatedHeadingIdx >= 0 && i >= trailingRelatedHeadingIdx) {
          break;
        }
        const t = lines[i].trim();
        if (t.startsWith('```')) {
          inFence = !inFence;
          continue;
        }
        if (inFence || !t || t === '<!-- okf:related-concepts -->') continue;
        if (
          t.startsWith('#') ||
          /^---+\s*$/.test(t) ||
          t.startsWith('|') ||
          t.startsWith('>') ||
          /^\[\^[A-Za-z0-9_\-]+\]:/.test(t) ||
          /^(?:[-*+]|\d+[.)])\s+\[[ xX]\]\s+/.test(t) ||
          isInternalConceptLinkBullet(t)
        ) {
          continue;
        }
        candidateIndices.push(i);
        if (/^(?:[-*+]|\d+[.)])\s+/.test(t)) {
          if (firstListIdx < 0) firstListIdx = i;
        } else if (firstProseIdx < 0) {
          firstProseIdx = i;
        }
      }

      let targetIdx = -1;
      const srcMeta = remainingSources.find((s) => s && s.id === fnId);
      if (srcMeta && candidateIndices.length > 1) {
        const cleanQueryBasis = `${String(srcMeta.title || '').replace(/\s*\(via\s+[^)]+\)\s*$/i, '')} ${fnId.replace(/-/g, ' ')}`;
        const rawWords = cleanQueryBasis.toLowerCase().match(/[\p{L}\p{N}]{4,}/gu) || [];
        const rawSections = (cleanQueryBasis.match(/§+\s*\d+(?:-\d+)?/g) || []).map((sec) =>
          sec.replace(/\s+/g, '').toLowerCase()
        );
        const uniqueWords = Array.from(new Set(rawWords));
        const uniqueSections = Array.from(new Set(rawSections));
        if (uniqueWords.length > 0 || uniqueSections.length > 0) {
          const lineEntries = candidateIndices.map((lineIdx) => {
            const stripped = lines[lineIdx]
              .replace(/\[\^[A-Za-z0-9_\-]+\]/g, ' ')
              .toLowerCase();
            const wordSet = new Set(stripped.match(/[\p{L}\p{N}]{4,}/gu) || []);
            const compactSec = stripped.replace(/\s+/g, '');
            return { lineIdx, stripped, wordSet, compactSec };
          });
          const nCand = lineEntries.length;
          const scores = new Array<number>(nCand).fill(0);
          for (const qt of uniqueWords) {
            let df = 0;
            for (const entry of lineEntries) {
              if (entry.wordSet.has(qt) || (qt.length >= 6 && entry.stripped.includes(qt))) {
                df++;
              }
            }
            if (df === 0 || (nCand >= 4 && df > nCand * 0.6)) continue;
            const idf = Math.log((nCand + 1) / (df + 0.5));
            for (let k = 0; k < nCand; k++) {
              if (lineEntries[k].wordSet.has(qt)) {
                scores[k] += 1.5 * idf;
              } else if (qt.length >= 6 && lineEntries[k].stripped.includes(qt)) {
                scores[k] += 0.75 * idf;
              }
            }
          }
          for (const sec of uniqueSections) {
            let df = 0;
            for (const entry of lineEntries) {
              if (entry.compactSec.includes(sec)) df++;
            }
            if (df === 0) continue;
            const idf = Math.log((nCand + 1) / (df + 0.5));
            for (let k = 0; k < nCand; k++) {
              if (lineEntries[k].compactSec.includes(sec)) {
                scores[k] += 3.0 * idf;
              }
            }
          }
          let bestScore = 0;
          let bestLineIdx = -1;
          for (let k = 0; k < nCand; k++) {
            if (scores[k] > bestScore) {
              bestScore = scores[k];
              bestLineIdx = lineEntries[k].lineIdx;
            }
          }
          if (bestScore >= 1.0 && bestLineIdx >= 0) {
            targetIdx = bestLineIdx;
          }
        }
      }

      if (targetIdx < 0) {
        targetIdx = firstProseIdx >= 0 ? firstProseIdx : firstListIdx;
      }
      if (targetIdx >= 0) {
        lines[targetIdx] = lines[targetIdx].replace(
          /([.?!])?(\s*)$/,
          (_m, punct: string | undefined, ws: string) => `[^${fnId}]${punct || ''}${ws || ''}`
        );
        proseText = lines.join('\n');
      } else {
        proseText = proseText.trim()
          ? `${proseText.trim()}\n\nSource[^${fnId}].`
          : `Source[^${fnId}].`;
      }
    };

    for (const idToWeave of existingMatchIdsToWeave) {
      ensureInlineCitationWeaved(idToWeave);
    }
    for (const addedSrc of addedSources) {
      if (addedSrc.id) ensureInlineCitationWeaved(addedSrc.id);
    }
  }

  // Rebuild body with bottom definitions and run healOrphanOkfFootnotes for 100% 3-way parity
  const defLines: string[] = [];
  for (const s of remainingSources) {
    if (!s || !s.id) continue;
    const normalizedMime =
      normalizeHttpMimeType(s.mime_type) ||
      inferSourceMimeTypeFromUrl(String(s.resource || s.url || ''));
    if (normalizedMime) {
      s.mime_type = normalizedMime;
    } else if ('mime_type' in s) {
      delete s.mime_type;
    }
    const label = decodeHtmlEntities(s.title || existingDefs.get(s.id) || s.resource || s.id);
    defLines.push(`[^${s.id}]: ${label}`);
  }
  doc.frontmatter.sources = remainingSources;
  doc.body =
    defLines.length > 0 ? `${proseText.trimEnd()}\n\n${defLines.join('\n')}\n` : `${proseText.trimEnd()}\n`;

  healOrphanOkfFootnotes(doc);

  return {
    markdown: serializeOkfDocument(doc),
    rejectedIds,
    replacedMap,
    addedSources,
    orphanClaimLines,
  };
}



/**
 * Parses markdown text and Interactions API grounding steps, resolves Vertex redirect URLs,
 * weaves inline `url_citation` annotations at their UTF-8 byte offsets as OKF v0.3 `[^id]` footnotes,
 * lifts all external sources into YAML frontmatter (`sources: [{ id, resource, title, retrieved_at }]`),
 * and formats a complete OKF v0.3 Concept Document (`SPEC.md` §4 & §5).
 */
export async function cleanGroundingLinks(
  text: string,
  steps?: any[],
  options?: CleanGroundingOptions
): Promise<string> {
  const nowIso =
    parseValidIsoTimestamp(options?.generatedAt) ||
    new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');

  const redirectRegex =
    /https:\/\/vertexaisearch\.cloud\.google\.com\/grounding-api-redirect\/[a-zA-Z0-9_\-\+=%]+/g;
  const textMatches = text.match(redirectRegex) || [];

  const groundedSources: Array<{ title?: string; url: string }> = [];
  const inlineAnnotations: Array<{
    start_index?: number;
    end_index: number;
    title?: string;
    url: string;
  }> = [];

  if (Array.isArray(steps)) {
    const isModelTextStep = (s: any): boolean => {
      if (s?.type === 'model_output' && Array.isArray(s.content)) {
        return s.content.some((cp: any) => typeof cp?.text === 'string' && cp.text.trim().length > 0);
      }
      if (s?.type === 'text' && typeof s.text === 'string' && s.text.trim().length > 0) {
        return true;
      }
      return false;
    };

    let finalModelOutputIdx = -1;
    for (let i = steps.length - 1; i >= 0; i--) {
      if (isModelTextStep(steps[i])) {
        finalModelOutputIdx = i;
        break;
      }
    }
    if (finalModelOutputIdx === -1) {
      for (let i = steps.length - 1; i >= 0; i--) {
        if (
          (steps[i]?.type === 'model_output' && Array.isArray(steps[i].content)) ||
          (steps[i]?.type === 'text' && Array.isArray(steps[i].annotations))
        ) {
          finalModelOutputIdx = i;
          break;
        }
      }
    }

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      if (step?.type === 'google_search_result' && Array.isArray(step.result)) {
        for (const resItem of step.result) {
          if (resItem?.url && typeof resItem.url === 'string') {
            groundedSources.push({ title: resItem.title, url: resItem.url });
          }
        }
      }

      const contentParts =
        step?.type === 'model_output' && Array.isArray(step.content)
          ? step.content
          : step?.type === 'text' && Array.isArray(step.annotations)
            ? [step]
            : null;

      if (contentParts) {
        const isFinalStep =
          finalModelOutputIdx !== -1 ? i === finalModelOutputIdx : i === steps.length - 1;
        for (const contentPart of contentParts) {
          if (Array.isArray(contentPart?.annotations)) {
            for (const ann of contentPart.annotations) {
              if (ann?.url && typeof ann.url === 'string') {
                if (isFinalStep) {
                  groundedSources.push({ title: ann.title, url: ann.url });
                  if (typeof ann.end_index === 'number' && ann.end_index > 0) {
                    inlineAnnotations.push({
                      start_index: ann.start_index,
                      end_index: ann.end_index,
                      title: ann.title,
                      url: ann.url,
                    });
                  }
                }
              }
            }
          }
        }
      }
    }
  }

  const allRedirectUrls = Array.from(
    new Set([
      ...textMatches,
      ...groundedSources
        .map((s) => s.url)
        .filter((u) => isVertexRedirectUrl(u)),
    ])
  );

  const urlMap = new Map<string, string>();
  const lastModifiedMap = new Map<string, string>();
  const pageTitleMap = new Map<string, string>();
  const mimeTypeMap = new Map<string, string>();
  const freshlyGroundedUrls = new Set<string>();
  for (const gs of groundedSources) {
    if (gs.url) freshlyGroundedUrls.add(gs.url.trim());
  }
  for (const ann of inlineAnnotations) {
    if (ann.url) freshlyGroundedUrls.add(ann.url.trim());
  }
  for (const rUrl of allRedirectUrls) {
    if (rUrl) freshlyGroundedUrls.add(rUrl.trim());
  }

  if (allRedirectUrls.length > 0) {
    console.log(
      `Found ${allRedirectUrls.length} Vertex grounding redirects. Resolving to raw URLs...`
    );
    const resolutions = await Promise.all(
      allRedirectUrls.map(async (url) => {
        const resolved = await resolveRedirect(url);
        return { original: url, resolved };
      })
    );
    for (const { original, resolved } of resolutions) {
      const finalUrl = (resolved?.url || original).trim();
      urlMap.set(original, finalUrl);
      if (!isVertexRedirectUrl(finalUrl)) {
        freshlyGroundedUrls.add(finalUrl);
      }
      if (resolved?.lastModified) {
        lastModifiedMap.set(original, resolved.lastModified);
        lastModifiedMap.set(finalUrl, resolved.lastModified);
      }
      if (resolved?.pageTitle) {
        pageTitleMap.set(original, resolved.pageTitle);
        pageTitleMap.set(finalUrl, resolved.pageTitle);
      }
      if (resolved?.mimeType) {
        mimeTypeMap.set(original, resolved.mimeType);
        mimeTypeMap.set(finalUrl, resolved.mimeType);
      }
      if (resolved?.browserBlockedPdf) {
        console.log(
          `[Provenance CSP Warning]: PDF blocked in Chromium inline viewer (CSP object-src 'none'): ${finalUrl}`
        );
      }
    }
  }

  // Build candidate pool from groundedSources + existing workspace/bundle/ concepts to heal any
  // frontmatter/body redirect URLs whose base64 token was corrupted or truncated by the LLM
  const extractRedirectToken = (url?: string): string => {
    if (!url) return '';
    const marker = 'vertexaisearch.cloud.google.com/grounding-api-redirect/';
    const idx = url.indexOf(marker);
    return idx !== -1 ? url.slice(idx + marker.length).trim() : '';
  };

  interface HealingCandidate {
    id: string;
    slug: string;
    title: string;
    normTitle: string;
    resource: string;
    tokens: Set<string>;
    searchableText: string;
    originalRedirect?: string;
    redirectToken: string;
  }
  const healingCandidates: HealingCandidate[] = [];
  const seenCandidateKeys = new Set<string>();

  const addHealingCandidate = (
    resourceUrl: string,
    rawTitle?: string,
    rawId?: string,
    originalRedirect?: string
  ) => {
    const cleanUrl = (resourceUrl || '').trim();
    if (!/^https?:\/\//i.test(cleanUrl) || isVertexRedirectUrl(cleanUrl)) return;
    const key = `${(rawId || '').toLowerCase()}::${(rawTitle || '').toLowerCase()}::${cleanUrl}`;
    if (seenCandidateKeys.has(key)) return;
    seenCandidateKeys.add(key);

    let urlTokensText = '';
    try {
      const parsed = new URL(cleanUrl);
      urlTokensText = `${parsed.hostname.replace(/^www\./, '')} ${parsed.pathname}`;
    } catch {
      urlTokensText = cleanUrl;
    }
    const slug = generateSourceSlugId(rawTitle || rawId || '', cleanUrl, new Set());
    const normTitle = normalizeSourceMatchKey(rawTitle);
    const allTokens = extractSourceMatchTokens(`${rawId || ''} ${rawTitle || ''} ${urlTokensText}`);
    healingCandidates.push({
      id: (rawId || '').trim().toLowerCase(),
      slug: slug.toLowerCase(),
      title: (rawTitle || '').trim(),
      normTitle,
      resource: cleanUrl,
      tokens: new Set(allTokens),
      searchableText: `${normalizeSourceMatchKey(rawId)} ${normTitle} ${normalizeSourceMatchKey(urlTokensText)}`.trim(),
      originalRedirect,
      redirectToken: extractRedirectToken(originalRedirect),
    });
  };

  for (const gs of groundedSources) {
    const resolved = (urlMap.get(gs.url) || gs.url).trim();
    if (!isVertexRedirectUrl(resolved)) {
      addHealingCandidate(
        resolved,
        gs.title,
        undefined,
        isVertexRedirectUrl(gs.url) ? gs.url : undefined
      );
    }
  }

  for (const [origRedirect, resolvedUrl] of urlMap.entries()) {
    if (resolvedUrl && resolvedUrl !== origRedirect && !isVertexRedirectUrl(resolvedUrl)) {
      addHealingCandidate(resolvedUrl, undefined, undefined, origRedirect);
    }
  }

  const bundleRootDir =
    options?.bundleRoot || path.join(options?.workspaceRoot || './workspace', 'bundle');
  const existingBundleSourceByDedupeKey = new Map<string, OKFSource>();
  for (const bs of collectExistingBundleSources(bundleRootDir)) {
    addHealingCandidate(bs.resource, bs.title, bs.id);
    const bsKeys = getCanonicalSourceDedupeKeys(bs.resource, bs.id, bs.title);
    if (bsKeys.length > 0) {
      const prev = bsKeys.map((k) => existingBundleSourceByDedupeKey.get(k)).find(Boolean);
      if (!prev) {
        const cloned = { ...bs };
        for (const k of bsKeys) existingBundleSourceByDedupeKey.set(k, cloned);
      } else {
        if (!prev.id && bs.id) prev.id = bs.id;
        if (shouldUpgradeSourceTitle(prev.title, bs.title, bs.resource)) {
          prev.title = bs.title;
        }
        for (const k of bsKeys) existingBundleSourceByDedupeKey.set(k, prev);
      }
    }
    const isSharedBareArchive = isMultiRecordArchiveUrl(bs.resource) && !bs.resource.includes('#');
    if (!isSharedBareArchive) {
      if (bs.last_modified && !lastModifiedMap.has(bs.resource)) {
        lastModifiedMap.set(bs.resource, bs.last_modified);
      }
      if (bs.mime_type && !mimeTypeMap.has(bs.resource)) {
        mimeTypeMap.set(bs.resource, bs.mime_type);
      }
    }
  }

  const healRedirectUrl = (rawUrl: string, rawTitle?: string, preferredId?: string): string => {
    const mapped = (urlMap.get(rawUrl) || rawUrl).trim();
    if (!isVertexRedirectUrl(mapped)) return mapped;
    if (healingCandidates.length === 0) return mapped;

    const slugId = String(preferredId || '').trim().toLowerCase();
    const normId = normalizeSourceMatchKey(preferredId);
    const normTitle = normalizeSourceMatchKey(rawTitle);
    const titleSlug = rawTitle
      ? generateSourceSlugId(rawTitle, 'https://example.com', new Set()).toLowerCase()
      : '';
    const queryTokens = extractSourceMatchTokens(`${preferredId || ''} ${rawTitle || ''}`);
    const rawRedirectToken = extractRedirectToken(mapped);

    let bestCandidate: HealingCandidate | null = null;
    let bestScore = 0;

    for (const c of healingCandidates) {
      let score = 0;

      // 1. Exact or substring ID / slug match
      if (slugId && (c.id === slugId || c.slug === slugId)) {
        score += 100;
      } else if (
        titleSlug &&
        titleSlug !== 'source' &&
        (c.slug === titleSlug || c.id === titleSlug)
      ) {
        score += 90;
      } else if (slugId.length >= 5) {
        if (
          (c.id.length >= 5 && (c.id.includes(slugId) || slugId.includes(c.id))) ||
          (c.slug.length >= 5 && (c.slug.includes(slugId) || slugId.includes(c.slug)))
        ) {
          score += 45;
        }
      }

      // 2. Normalized title match (weighted by title specificity so generic 1-word portal titles don't trump specific compound matches)
      if (normTitle && c.normTitle) {
        if (c.normTitle === normTitle) {
          const wordCount = normTitle.split(/\s+/).length;
          score += wordCount >= 2 || normTitle.length >= 12 ? 85 : 25;
        } else if (
          normTitle.length >= 5 &&
          c.normTitle.length >= 5 &&
          (c.normTitle.includes(normTitle) || normTitle.includes(c.normTitle))
        ) {
          const overlapLen = Math.min(normTitle.length, c.normTitle.length);
          const overlapWords = Math.min(
            normTitle.split(/\s+/).length,
            c.normTitle.split(/\s+/).length
          );
          score += overlapWords >= 2 || overlapLen >= 12 ? Math.min(55, overlapLen * 2) : 6;
        }
      }

      if (
        normId.length >= 5 &&
        c.normTitle.length >= 5 &&
        (c.normTitle.includes(normId) || normId.includes(c.normTitle))
      ) {
        const overlapLen = Math.min(normId.length, c.normTitle.length);
        score += overlapLen >= 8 ? Math.min(40, overlapLen * 2) : 8;
      }

      // 3. Token overlap scoring across id, title, and URL domain/path (supporting compound words)
      for (const qt of queryTokens) {
        if (c.tokens.has(qt)) {
          score += qt.length >= 10 ? 18 : qt.length >= 6 ? 10 : 5;
        } else if (qt.length >= 5) {
          let matchedCompound = false;
          for (const ct of c.tokens) {
            if (ct.length >= 4 && (qt.includes(ct) || ct.includes(qt))) {
              score += Math.min(qt.length, ct.length) >= 8 ? 14 : 8;
              matchedCompound = true;
              break;
            }
          }
          if (!matchedCompound && c.searchableText.includes(qt)) {
            score += 4;
          }
        } else if (qt.length >= 4 && c.searchableText.includes(qt)) {
          score += 3;
        }
      }

      // 4. Base64 redirect token prefix similarity (when LLM truncated or slightly corrupted the redirect token)
      if (rawRedirectToken.length >= 16 && c.redirectToken.length >= 16) {
        let prefixLen = 0;
        const maxLen = Math.min(rawRedirectToken.length, c.redirectToken.length);
        while (prefixLen < maxLen && rawRedirectToken[prefixLen] === c.redirectToken[prefixLen]) {
          prefixLen++;
        }
        if (prefixLen >= 18) {
          score += Math.min(60, prefixLen);
        }
      }

      if (score > bestScore) {
        bestScore = score;
        bestCandidate = c;
      }
    }

    if (bestCandidate && bestScore >= 6) {
      return bestCandidate.resource;
    }

    // 5. Fallback if there is only a single unique resolved grounded URL
    const uniqueUrls = Array.from(new Set(healingCandidates.map((c) => c.resource)));
    if (uniqueUrls.length === 1) {
      return uniqueUrls[0];
    }

    return mapped;
  };

  // Pre-register any existing frontmatter sources so their IDs are preserved during byte-offset weaving
  const usedIds = new Set<string>();
  const sourcesByUrl = new Map<string, OKFSource>();
  const sourcesById = new Map<string, OKFSource>();
  const sourceIdAliases = new Map<string, string>();
  const orderedSources: OKFSource[] = [];
  const authorExplicitUrls = new Set<string>();

  const getSourceUrlKeys = (urlStr: string, idStr?: string, titleStr?: string): string[] => {
    const trimmed = String(urlStr || '').trim();
    if (!trimmed) return [];
    if (isVertexRedirectUrl(trimmed)) return [trimmed];
    const dedupeKeys = getCanonicalSourceDedupeKeys(trimmed, idStr, titleStr);
    if (isMultiRecordArchiveUrl(trimmed) && !trimmed.includes('#')) {
      return dedupeKeys;
    }
    return Array.from(new Set([trimmed, ...dedupeKeys]));
  };

  const registerSource = (
    rawUrl: string,
    rawTitle?: string,
    preferredId?: string,
    extra?: Partial<OKFSource>,
    freshlyGrounded: boolean = false
  ): OKFSource => {
    const initialResolved = (urlMap.get(rawUrl) || rawUrl).trim();
    const resolvedUrl = isVertexRedirectUrl(initialResolved)
      ? healRedirectUrl(initialResolved, rawTitle, preferredId)
      : initialResolved;
    if (!isVertexRedirectUrl(resolvedUrl)) {
      if (resolvedUrl !== rawUrl) {
        urlMap.set(rawUrl, resolvedUrl);
      }
      addHealingCandidate(
        resolvedUrl,
        rawTitle,
        preferredId,
        isVertexRedirectUrl(rawUrl) ? rawUrl : undefined
      );
    }

    const effectiveRawTitle =
      rawTitle && !isBareDomainTitle(rawTitle, resolvedUrl)
        ? rawTitle
        : pageTitleMap.get(resolvedUrl) || pageTitleMap.get(rawUrl) || rawTitle;

    let cleanTitle = stripTrailingPortalViewChrome(decodeHtmlEntities(effectiveRawTitle || ''))
      .replace(/^\*\*|\*\*$/g, '')
      .trim();

    const bundleLookupKeys = getCanonicalSourceDedupeKeys(resolvedUrl, preferredId, cleanTitle);
    const matchingBundleSrc = bundleLookupKeys
      .map((k) => existingBundleSourceByDedupeKey.get(k))
      .find(Boolean);

    if (
      matchingBundleSrc?.title &&
      (!cleanTitle ||
        isBareDomainTitle(cleanTitle, resolvedUrl) ||
        isAutoDomainSlugTitle(cleanTitle) ||
        shouldUpgradeSourceTitle(cleanTitle, matchingBundleSrc.title, resolvedUrl))
    ) {
      cleanTitle = decodeHtmlEntities(matchingBundleSrc.title).trim();
    }

    const detectedLastModified =
      lastModifiedMap.get(resolvedUrl) ||
      lastModifiedMap.get(rawUrl) ||
      parseValidIsoTimestamp(extra?.last_modified) ||
      parseValidIsoTimestamp(matchingBundleSrc?.last_modified);
    const detectedMimeType =
      mimeTypeMap.get(resolvedUrl) ||
      mimeTypeMap.get(rawUrl) ||
      normalizeHttpMimeType(extra?.mime_type) ||
      normalizeHttpMimeType(matchingBundleSrc?.mime_type) ||
      inferSourceMimeTypeFromUrl(resolvedUrl);
    const extraRetrievedAt = parseValidIsoTimestamp(extra?.retrieved_at);
    const wasHealedFromRedirect = isVertexRedirectUrl(rawUrl) && !isVertexRedirectUrl(resolvedUrl);
    const isFresh =
      freshlyGrounded ||
      wasHealedFromRedirect ||
      freshlyGroundedUrls.has(rawUrl.trim()) ||
      freshlyGroundedUrls.has(resolvedUrl);

    if (preferredId && sourcesById.has(preferredId)) {
      const existingById = sourcesById.get(preferredId)!;
      if (
        isVertexRedirectUrl(existingById.resource) &&
        resolvedUrl &&
        !isVertexRedirectUrl(resolvedUrl)
      ) {
        sourcesByUrl.delete(existingById.resource);
        existingById.resource = resolvedUrl;
        for (const k of getSourceUrlKeys(
          resolvedUrl,
          existingById.id,
          cleanTitle || existingById.title
        )) {
          sourcesByUrl.set(k, existingById);
        }
        existingById.retrieved_at = nowIso;
      }
      if (shouldUpgradeSourceTitle(existingById.title, cleanTitle, existingById.resource)) {
        existingById.title = enrichBareDomainSourceTitle(cleanTitle, existingById.resource);
      } else if (isBareDomainTitle(existingById.title, existingById.resource)) {
        existingById.title = enrichBareDomainSourceTitle(existingById.title, existingById.resource);
      }
      if (isFresh) {
        existingById.retrieved_at = nowIso;
      } else if (extraRetrievedAt && !existingById.retrieved_at) {
        existingById.retrieved_at = extraRetrievedAt;
      } else if (!existingById.retrieved_at) {
        existingById.retrieved_at = nowIso;
      }
      if (detectedLastModified && !existingById.last_modified) {
        existingById.last_modified = detectedLastModified;
      }
      if (detectedMimeType && !existingById.mime_type) {
        existingById.mime_type = detectedMimeType;
      }
      return existingById;
    }

    const candidateUrlKeys = getSourceUrlKeys(resolvedUrl, preferredId, cleanTitle);
    const existingUrlMatch = candidateUrlKeys.map((k) => sourcesByUrl.get(k)).find(Boolean);
    if (existingUrlMatch) {
      const existing = existingUrlMatch;
      const prefId = preferredId?.trim();
      if (prefId && existing.id && prefId !== existing.id) {
        sourceIdAliases.set(prefId, existing.id);
        sourcesById.set(prefId, existing);
        usedIds.add(prefId);
      }
      if (shouldUpgradeSourceTitle(existing.title, cleanTitle, existing.resource)) {
        existing.title = enrichBareDomainSourceTitle(cleanTitle, existing.resource);
      } else if (isBareDomainTitle(existing.title, existing.resource)) {
        existing.title = enrichBareDomainSourceTitle(existing.title, existing.resource);
      }
      for (const k of candidateUrlKeys) {
        sourcesByUrl.set(k, existing);
      }
      if (isFresh) {
        existing.retrieved_at = nowIso;
      } else if (extraRetrievedAt && !existing.retrieved_at) {
        existing.retrieved_at = extraRetrievedAt;
      } else if (!existing.retrieved_at) {
        existing.retrieved_at = nowIso;
      }
      if (detectedLastModified && !existing.last_modified) {
        existing.last_modified = detectedLastModified;
      }
      if (detectedMimeType && !existing.mime_type) {
        existing.mime_type = detectedMimeType;
      }
      return existing;
    }

    // If this newly resolved URL heals an already-registered unhealed frontmatter source, update it in place
    if (!preferredId && !isVertexRedirectUrl(resolvedUrl)) {
      for (const existing of orderedSources) {
        if (isVertexRedirectUrl(existing.resource)) {
          const healed = healRedirectUrl(existing.resource, existing.title, existing.id);
          if (healed === resolvedUrl) {
            sourcesByUrl.delete(existing.resource);
            existing.resource = resolvedUrl;
            for (const k of getSourceUrlKeys(
              resolvedUrl,
              existing.id,
              cleanTitle || existing.title
            )) {
              sourcesByUrl.set(k, existing);
            }
            if (shouldUpgradeSourceTitle(existing.title, cleanTitle, resolvedUrl)) {
              existing.title = enrichBareDomainSourceTitle(cleanTitle, resolvedUrl);
            } else if (isBareDomainTitle(existing.title, resolvedUrl)) {
              existing.title = enrichBareDomainSourceTitle(existing.title, resolvedUrl);
            }
            existing.retrieved_at = nowIso;
            if (detectedLastModified && !existing.last_modified) {
              existing.last_modified = detectedLastModified;
            }
            if (detectedMimeType && !existing.mime_type) {
              existing.mime_type = detectedMimeType;
            }
            return existing;
          }
        }
      }
    }

    let fallbackLabel = cleanTitle;
    if (!fallbackLabel) {
      try {
        fallbackLabel = new URL(resolvedUrl).hostname.replace(/^www\./, '');
      } catch {
        fallbackLabel = 'source';
      }
    }

    const prefId = preferredId?.trim() || '';
    const bundleCanonicalId = matchingBundleSrc?.id?.trim() || '';
    let id = '';
    if (bundleCanonicalId && !usedIds.has(bundleCanonicalId)) {
      id = bundleCanonicalId;
      usedIds.add(id);
      if (prefId && prefId !== id) {
        sourceIdAliases.set(prefId, id);
        usedIds.add(prefId);
      }
    } else if (prefId) {
      id = prefId;
      usedIds.add(id);
    } else {
      id = generateSourceSlugId(fallbackLabel, resolvedUrl, usedIds);
    }

    const validExtraLm = parseValidIsoTimestamp(extra?.last_modified);
    const finalLm = detectedLastModified || validExtraLm;
    const enrichedTitle = enrichBareDomainSourceTitle(cleanTitle || fallbackLabel, resolvedUrl);
    const entry: OKFSource = {
      id,
      resource: resolvedUrl,
      title: enrichedTitle,
      ...extra,
      ...(detectedMimeType ? { mime_type: detectedMimeType } : {}),
      retrieved_at: isFresh ? nowIso : extraRetrievedAt || nowIso,
      ...(finalLm ? { last_modified: finalLm } : {}),
    };
    if (!detectedMimeType && 'mime_type' in entry) {
      delete entry.mime_type;
    }
    if (!finalLm && 'last_modified' in entry) {
      delete entry.last_modified;
    }
    for (const k of getSourceUrlKeys(resolvedUrl, id, enrichedTitle)) {
      sourcesByUrl.set(k, entry);
    }
    sourcesById.set(id, entry);
    if (prefId && prefId !== id) {
      sourcesById.set(prefId, entry);
    }
    orderedSources.push(entry);
    return entry;
  };

  // Check if raw text already begins with YAML frontmatter so we don't weave inline footnotes inside frontmatter
  let frontmatterEndByteOffset = 0;
  const fmMatch = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
  if (fmMatch) {
    frontmatterEndByteOffset = Buffer.byteLength(fmMatch[0], 'utf8');
    try {
      const initialDoc = parseOkfDocument(text);
      const initialSources = initialDoc.frontmatter?.sources;
      if (Array.isArray(initialSources)) {
        for (const s of initialSources) {
          const rawRes = s && typeof s === 'object' ? String(s.resource || (s as any).url || '').trim() : '';
          if (rawRes) {
            const { id, resource, url, title, ...rest } = s as any;
            authorExplicitUrls.add(rawRes);
            const entry = registerSource(rawRes, title ? String(title) : undefined, id ? String(id) : undefined, rest);
            if (entry?.resource) authorExplicitUrls.add(entry.resource);
          }
        }
      }
    } catch {
      // Ignore partial frontmatter errors before full cleanup
    }
  }

  // 1. Weave inline url_citation annotations into the UTF-8 buffer as OKF v0.3 [^id] footnotes before byte offsets change
  let workingText = text;
  if (inlineAnnotations.length > 0) {
    const buf = Buffer.from(workingText, 'utf8');
    const snapSafeEndIndex = (rawIdx: number): number | null => {
      let idx = rawIdx;
      // Never split a multi-byte UTF-8 character sequence (continuation bytes 10xxxxxx)
      while (idx < buf.length && (buf[idx] & 0b11000000) === 0b10000000) {
        idx++;
      }
      if (idx > buf.length || idx <= frontmatterEndByteOffset) return null;

      // Inspect surrounding text on the current line
      let lineStart = idx;
      while (lineStart > frontmatterEndByteOffset && buf[lineStart - 1] !== 0x0a) {
        lineStart--;
      }
      let lineEnd = idx;
      while (lineEnd < buf.length && buf[lineEnd] !== 0x0a && buf[lineEnd] !== 0x0d) {
        lineEnd++;
      }
      const lineStr = buf.subarray(lineStart, lineEnd).toString('utf8');
      // Never weave byte-offset footnotes inside Markdown headings (`## ...`), table rows (`| ... |`),
      // or standalone bold list-group headers (`1. **Section Title**:` with no prose after `:`)
      if (
        /^\s*#{1,6}\s/.test(lineStr) ||
        /^\s*\|/.test(lineStr) ||
        /^\s*(?:[-*+]|\d+\.)\s+\*\*[^*\r\n]+\*\*\s*:?\s*$/.test(lineStr)
      ) {
        return null;
      }

      let beforeStr = buf.subarray(lineStart, idx).toString('utf8');
      let afterStr = buf.subarray(idx, lineEnd).toString('utf8');

      // Advance to the end of the current word/token (including slash-joined word pairs like `input/output` or `audit/review`)
      const wordMatch = afterStr.match(/^[\p{L}\p{N}_\-]+(?:\/[\p{L}\p{N}_\-]+)*/u);
      if (wordMatch) {
        idx += Buffer.byteLength(wordMatch[0], 'utf8');
        beforeStr = buf.subarray(lineStart, idx).toString('utf8');
        afterStr = buf.subarray(idx, lineEnd).toString('utf8');
      }
      if (/[\p{L}\p{N}_\-]$/u.test(beforeStr)) {
        const slashTailMatch = afterStr.match(/^(?:\/[\p{L}\p{N}_\-]+)+/u);
        if (slashTailMatch) {
          idx += Buffer.byteLength(slashTailMatch[0], 'utf8');
          beforeStr = buf.subarray(lineStart, idx).toString('utf8');
          afterStr = buf.subarray(idx, lineEnd).toString('utf8');
        }
      }

      // If immediately after `§` or inside a short section/parenthetical token like `§ 11-2` / `(Tier 1)` / `(*Art. § 4*)`,
      // advance past any trailing section number (`§ 4`, `11-2`, `1`) without consuming subsequent prose words
      if (/(?:§|\([*_`]*[\p{L}\p{N}_\-]{1,15})\s*$/u.test(beforeStr)) {
        const secNumMatch = afterStr.match(/^(?:\s*(?:§\s*)?\d[\p{L}\p{N}_\-]*)+/u);
        if (secNumMatch) {
          idx += Buffer.byteLength(secNumMatch[0], 'utf8');
          afterStr = buf.subarray(idx, lineEnd).toString('utf8');
        }
      }

      // Advance past any immediately following closing emphasis or bracket characters (`*`, `_`, `` ` ``, `)`, `]`)
      const closingMatch = afterStr.match(/^[*_`)\]]+/);
      if (closingMatch) {
        idx += Buffer.byteLength(closingMatch[0], 'utf8');
        beforeStr = buf.subarray(lineStart, idx).toString('utf8');
        afterStr = buf.subarray(idx, lineEnd).toString('utf8');
      }

      // If `idx` landed inside an unclosed footnote bracket (`[^id1, ^id2]`), advance to its closing `]`
      if (/\[\^[^\]]*$/.test(beforeStr)) {
        const bracketRest = afterStr.match(/^[^\]]*\]/);
        if (bracketRest) {
          idx += Buffer.byteLength(bracketRest[0], 'utf8');
        }
      }

      // Never split an inline code span (`` `code` ``), Markdown link (`[label](url)`), or `**bold**` span:
      // snap in order `code` -> `[label](url)` -> `**bold**` so nested forms (`**[\`ID\`](/ref.md)**`) exit cleanly.
      let charOffsetInLine = buf.subarray(lineStart, idx).toString('utf8').length;
      const inlineCodeRe = /`[^`\r\n]+`/g;
      let codeMatch: RegExpExecArray | null;
      while ((codeMatch = inlineCodeRe.exec(lineStr)) !== null) {
        const cStart = codeMatch.index;
        const cEnd = codeMatch.index + codeMatch[0].length;
        if (charOffsetInLine > cStart && charOffsetInLine < cEnd) {
          idx = lineStart + Buffer.byteLength(lineStr.slice(0, cEnd), 'utf8');
          charOffsetInLine = cEnd;
          break;
        }
      }

      const mdLinkRe = /\[(?![\^])[^\]]+\]\([^)\r\n]+\)/g;
      let mdMatch: RegExpExecArray | null;
      while ((mdMatch = mdLinkRe.exec(lineStr)) !== null) {
        const linkStart = mdMatch.index;
        const linkEnd = mdMatch.index + mdMatch[0].length;
        if (charOffsetInLine > linkStart && charOffsetInLine < linkEnd) {
          idx = lineStart + Buffer.byteLength(lineStr.slice(0, linkEnd), 'utf8');
          charOffsetInLine = linkEnd;
          break;
        }
      }

      const boldSpanRe = /\*\*[^*\r\n]+\*\*/g;
      let boldMatch: RegExpExecArray | null;
      while ((boldMatch = boldSpanRe.exec(lineStr)) !== null) {
        const bStart = boldMatch.index;
        const bEnd = boldMatch.index + boldMatch[0].length;
        if (charOffsetInLine > bStart && charOffsetInLine < bEnd) {
          idx = lineStart + Buffer.byteLength(lineStr.slice(0, bEnd), 'utf8');
          charOffsetInLine = bEnd;
          break;
        }
      }

      return idx;
    };

    const byEndIndex = new Map<number, OKFSource[]>();
    for (const ann of inlineAnnotations) {
      if (ann.end_index > buf.length || ann.end_index <= frontmatterEndByteOffset) continue;
      const resolvedAnnUrl = (urlMap.get(ann.url) || ann.url).trim();
      if (
        isLowSignalGroundingUrl(resolvedAnnUrl) &&
        !authorExplicitUrls.has(resolvedAnnUrl) &&
        !authorExplicitUrls.has(ann.url.trim())
      ) {
        continue;
      }
      const safeIdx = snapSafeEndIndex(ann.end_index);
      if (safeIdx === null) continue;
      const srcEntry = registerSource(ann.url, ann.title, undefined, undefined, true);
      if (!byEndIndex.has(safeIdx)) {
        byEndIndex.set(safeIdx, []);
      }
      const group = byEndIndex.get(safeIdx)!;
      if (!group.some((item) => item.id === srcEntry.id)) {
        group.push(srcEntry);
      }
    }

    const sortedEnds = Array.from(byEndIndex.keys()).sort((a, b) => b - a);
    const chunks: Buffer[] = [];
    let cursor = buf.length;

    for (const endIdx of sortedEnds) {
      const sourcesAtSpan = byEndIndex.get(endIdx)!;
      const precedingSlice = buf.subarray(Math.max(0, endIdx - 64), endIdx).toString('utf8');
      const followingSlice = buf
        .subarray(endIdx, Math.min(buf.length, endIdx + 64))
        .toString('utf8');
      const neededFootnotes = sourcesAtSpan
        .filter((s) => {
          const escapedId = String(s.id || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const alreadyFollowsWithCaretOrPunct = new RegExp(
            `^[\\s.?!:;]*\\^*\\[\\^${escapedId}\\]`
          ).test(followingSlice);
          return (
            !precedingSlice.endsWith(`[^${s.id}]`) &&
            !followingSlice.startsWith(`[^${s.id}]`) &&
            !followingSlice.startsWith(`.^${s.id}`) &&
            !followingSlice.startsWith(`?^${s.id}`) &&
            !alreadyFollowsWithCaretOrPunct
          );
        })
        .map((s) => `[^${s.id}]`)
        .join('');
      chunks.unshift(buf.subarray(endIdx, cursor));
      if (neededFootnotes) {
        chunks.unshift(Buffer.from(neededFootnotes, 'utf8'));
      }
      cursor = endIdx;
    }
    chunks.unshift(buf.subarray(0, cursor));
    workingText = Buffer.concat(chunks).toString('utf8');
  }

  // 2. Replace any remaining raw redirect URLs in the text
  for (const [original, resolved] of urlMap.entries()) {
    if (resolved && resolved !== original) {
      console.log(`Resolved: ${original.substring(0, 60)}... -> ${resolved}`);
      workingText = workingText.replaceAll(original, resolved);
    }
  }

  // Strip outer ```markdown or ```yaml wrapper if the model accidentally fenced the entire document
  workingText = workingText
    .replace(/^```(?:markdown|md|yaml)\r?\n([\s\S]*?)\r?\n```\s*$/i, '$1')
    .trim();

  // 3. Parse existing frontmatter + body (if present)
  let parsedDoc: OKFDocument;
  try {
    parsedDoc = parseOkfDocument(workingText);
  } catch {
    parsedDoc = { frontmatter: {}, body: workingText };
  }

  if (Array.isArray(parsedDoc.frontmatter.sources)) {
    for (const s of parsedDoc.frontmatter.sources) {
      const rawRes = s && typeof s === 'object' ? String(s.resource || (s as any).url || '').trim() : '';
      if (rawRes) {
        const { id, resource, url, title, ...rest } = s as any;
        registerSource(rawRes, title ? String(title) : undefined, id ? String(id) : undefined, rest);
      }
    }
  }

  let bodyText = parsedDoc.body;

  // 4. Extract legacy "* **Title**: https://..." or "- [Title](https://...)" citation lines and convert to OKF sources
  const bareSourceLineRegex = /^(\s*[\*\-]\s+)\*\*(.+?)\*\*:\s+(https?:\/\/\S+)\s*$/;
  const bulletLinkSourceLineRegex = /^(\s*[\*\-]\s+)\[\*\*?(.+?)\*\*?\]\((https?:\/\/[^\s)]+)\)\s*$/;
  const footnoteDefLineRegex = /^\[\^([A-Za-z0-9_\-]+)\]:\s*(.+)$/;
  const existingFootnoteDefs = new Map<string, string>();

  const rawBodyLines = bodyText.split(/\r?\n/);
  const cleanedBodyLines: string[] = [];
  let inLegacyCitationsSection = false;

  for (const line of rawBodyLines) {
    if (/^#{1,3}\s+(Sources\s*&\s*Citations|Citations|Grounded\s+Search\s+References)\s*$/i.test(line.trim())) {
      inLegacyCitationsSection = true;
      continue;
    }
    if (inLegacyCitationsSection && /^#{1,3}\s+/.test(line.trim())) {
      inLegacyCitationsSection = false;
    }

    const fnMatch = line.trim().match(footnoteDefLineRegex);
    if (fnMatch) {
      const [, fnId, fnRest] = fnMatch;
      const urlInFn = fnRest.match(/(https?:\/\/[^\s)]+)/);
      if (urlInFn) {
        const titlePart = fnRest
          .replace(/\[([^\]]+)\]\(https?:\/\/[^\s)]+\)/, '$1')
          .replace(urlInFn[1], '')
          .replace(/^[\s:\-–—]+|[\s:\-–—]+$/g, '')
          .trim();
        const src = registerSource(urlInFn[1], titlePart || fnId, fnId);
        existingFootnoteDefs.set(src.id!, src.title || src.resource);
      } else {
        existingFootnoteDefs.set(fnId, decodeHtmlEntities(fnRest.trim()));
      }
      continue;
    }

    const bareMatch = line.match(bareSourceLineRegex);
    if (bareMatch) {
      const [, , rawTitle, url] = bareMatch;
      const src = registerSource(url, rawTitle);
      existingFootnoteDefs.set(src.id!, src.title || src.resource);
      continue;
    }

    if (inLegacyCitationsSection) {
      const bulletMatch = line.match(bulletLinkSourceLineRegex);
      if (bulletMatch) {
        const src = registerSource(bulletMatch[3], bulletMatch[2]);
        existingFootnoteDefs.set(src.id!, src.title || src.resource);
        continue;
      }
      const plainUrlBullet = line.match(/^\s*[\*\-]\s+(https?:\/\/\S+)\s*$/);
      if (plainUrlBullet) {
        const src = registerSource(plainUrlBullet[1]);
        existingFootnoteDefs.set(src.id!, src.title || src.resource);
        continue;
      }
      if (!line.trim()) continue;
    }

    cleanedBodyLines.push(line);
  }

  bodyText = cleanedBodyLines.join('\n');

  // 5. Convert inline external markdown links in prose (`([Title](https://...))` or `[Title](https://...)`)
  // into OKF v0.3 `[^id]` footnote references while leaving Markdown images (`![Alt](https://...)`)
  // and internal bundle links (`/foo.md`, `./bar.md`) intact.
  bodyText = bodyText.replace(
    /\s*\(\s*(?<!\!)\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)\s*\)/g,
    (_full, label: string, url: string) => {
      const src = registerSource(url, label);
      return `[^${src.id}]`;
    }
  );

  bodyText = bodyText.replace(
    /(?<!\!)\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
    (_full, label: string, url: string) => {
      const cleanLabel = label.replace(/^\*\*|\*\*$/g, '').trim();
      const src = registerSource(url, cleanLabel);
      // If the link text was just a domain/URL citation marker, emit footnote directly; otherwise keep anchor text + footnote
      if (/^https?:\/\//i.test(cleanLabel) || cleanLabel.toLowerCase() === 'source' || cleanLabel.toLowerCase() === 'link') {
        return `[^${src.id}]`;
      }
      return `${label}[^${src.id}]`;
    }
  );

  // Deduplicate adjacent identical footnote markers like `[^id][^id]`
  bodyText = bodyText.replace(/(\[\^[A-Za-z0-9_\-]+\])\1+/g, '$1');

  // Normalize stray BPE space immediately after list-item opening bold marker (e.g. `2. ** label**:` -> `2. **label**:`) outside code fences
  bodyText = bodyText
    .split(/(^```[\s\S]*?^```)/gm)
    .map((segment, idx) =>
      idx % 2 === 1
        ? segment
        : segment.replace(
            /^(\s*(?:[-*+]|\d+[.)])\s+(?:\[[ xX]\]\s+)?)\*\*[ \t]+([^\s*\r\n][^*\r\n]*?\*\*)/gm,
            '$1**$2'
          )
    )
    .join('');

  // 6. Register any remaining groundedSources from the Interactions API steps
  for (const src of groundedSources) {
    const candidateResolved = (urlMap.get(src.url) || src.url).trim();
    if (
      isLowSignalGroundingUrl(candidateResolved) &&
      !authorExplicitUrls.has(candidateResolved) &&
      !authorExplicitUrls.has(src.url.trim())
    ) {
      continue;
    }
    if (!isVertexRedirectUrl(candidateResolved) || orderedSources.length === 0) {
      registerSource(src.url, src.title, undefined, undefined, true);
    }
  }

  // Final healing and deduplication pass on orderedSources in case body links introduced new candidate URLs
  for (let i = 0; i < orderedSources.length; i++) {
    const entry = orderedSources[i];
    if (isVertexRedirectUrl(entry.resource)) {
      const healed = healRedirectUrl(entry.resource, entry.title, entry.id);
      if (healed && !isVertexRedirectUrl(healed)) {
        sourcesByUrl.delete(entry.resource);
        entry.resource = healed;
        entry.retrieved_at = nowIso;
        const healedLm = lastModifiedMap.get(healed);
        if (healedLm && !entry.last_modified) {
          entry.last_modified = healedLm;
        }
        const healedMime = mimeTypeMap.get(healed) || inferSourceMimeTypeFromUrl(healed);
        if (healedMime && !entry.mime_type) {
          entry.mime_type = healedMime;
        }
      }
    }
  }

  const dedupedSources: OKFSource[] = [];
  const canonicalByResource = new Map<string, OKFSource>();
  for (const entry of orderedSources) {
    const entryBundleKeys = getCanonicalSourceDedupeKeys(entry.resource, entry.id, entry.title);
    const matchingBundleSrc = entryBundleKeys
      .map((k) => existingBundleSourceByDedupeKey.get(k))
      .find(Boolean);
    if (
      matchingBundleSrc?.title &&
      (!entry.title ||
        isBareDomainTitle(entry.title, entry.resource) ||
        isAutoDomainSlugTitle(entry.title) ||
        shouldUpgradeSourceTitle(entry.title, matchingBundleSrc.title, entry.resource))
    ) {
      entry.title = decodeHtmlEntities(matchingBundleSrc.title).trim();
    }
    if (
      matchingBundleSrc?.id &&
      entry.id &&
      entry.id !== matchingBundleSrc.id &&
      !usedIds.has(matchingBundleSrc.id)
    ) {
      const oldId = entry.id;
      entry.id = matchingBundleSrc.id;
      usedIds.add(entry.id);
      sourceIdAliases.set(oldId, entry.id);
      sourcesById.set(entry.id, entry);
      sourcesById.set(oldId, entry);
    }
    const rawEntryTitle = entry.title;
    entry.title = enrichBareDomainSourceTitle(entry.title, entry.resource);
    const resourceKeys = getCanonicalSourceDedupeKeys(entry.resource, entry.id, entry.title);
    const existingCanonical = resourceKeys
      .map((k) => canonicalByResource.get(k))
      .find(Boolean);
    if (existingCanonical && existingCanonical !== entry) {
      const candidateForUpgrade =
        rawEntryTitle && !isBareDomainTitle(rawEntryTitle, entry.resource)
          ? rawEntryTitle
          : entry.title;
      if (shouldUpgradeSourceTitle(existingCanonical.title, candidateForUpgrade, entry.resource)) {
        existingCanonical.title = enrichBareDomainSourceTitle(candidateForUpgrade, entry.resource);
      }
      if (entry.retrieved_at === nowIso || !existingCanonical.retrieved_at) {
        existingCanonical.retrieved_at = entry.retrieved_at || nowIso;
      }
      if (entry.last_modified && !existingCanonical.last_modified) {
        existingCanonical.last_modified = entry.last_modified;
      }
      if (entry.mime_type && !existingCanonical.mime_type) {
        existingCanonical.mime_type = entry.mime_type;
      }
      if (entry.id && existingCanonical.id && entry.id !== existingCanonical.id) {
        sourceIdAliases.set(entry.id, existingCanonical.id);
        bodyText = bodyText.replaceAll(`[^${entry.id}]`, `[^${existingCanonical.id}]`);
        sourcesById.set(entry.id, existingCanonical);
      }
      for (const k of resourceKeys) {
        canonicalByResource.set(k, existingCanonical);
      }
    } else {
      for (const k of resourceKeys) {
        canonicalByResource.set(k, entry);
      }
      for (const k of getSourceUrlKeys(entry.resource, entry.id, entry.title)) {
        sourcesByUrl.set(k, entry);
      }
      dedupedSources.push(entry);
    }
  }
  orderedSources.length = 0;
  orderedSources.push(...dedupedSources);

  // Domain-neutral provenance check: annotate masquerading publisher titles on third-party mirrors (`(via <hostname>)`)
  for (const entry of orderedSources) {
    const prov = inspectSourceDomainProvenance(entry);
    if (prov.domainMismatch && prov.hostname && prov.claimedPublisher) {
      const viaSuffix = `(via ${prov.hostname})`;
      if (entry.title && !entry.title.toLowerCase().includes(prov.hostname.toLowerCase())) {
        entry.title = `${entry.title} ${viaSuffix}`;
        if (entry.id) {
          existingFootnoteDefs.set(entry.id, entry.title);
        }
      }
      console.log(
        `[OKF Source Provenance Notice] Source [^${entry.id}] claims "${prov.claimedPublisher}" in title, but resolved to "${prov.hostname}" (${entry.resource}).`
      );
    }
  }

  // Expand comma/semicolon-separated multi-footnote brackets (`[^id1, ^id2]` or `[^id1,[^id1] 4]`) into separate `[^id1] [^id2]` tags before bare-caret and alias rewriting
  bodyText = bodyText.replace(
    /\[\^([A-Za-z0-9_\-]+)\s*,\s*\[\^([A-Za-z0-9_\-]+)\]\s*([0-9A-Za-z_\-]+)\]/g,
    (_m, id1: string, id2: string, tail: string) => {
      const reconstructed = /^\d+$/.test(tail) ? `${id2.replace(/\d+$/, '')}${tail}` : `${id2}${tail}`;
      return `[^${id1}] [^${reconstructed}]`;
    }
  );
  bodyText = bodyText.replace(
    /\[\^([A-Za-z0-9_\-]+(?:\s*[,;]\s*(?:\[\^|\^)?[A-Za-z0-9_\-]+\]?)+)\]/g,
    (_m, inner: string) =>
      inner
        .split(/\s*[,;]\s*/)
        .map((part) => part.replace(/^\[?\^?/, '').replace(/\]$/, '').trim())
        .filter(Boolean)
        .map((id) => `[^${id}]`)
        .join(' ')
  );

  // Strip redundant carets before `[^id]` (`^[^id]` -> `[^id]`) and convert bare `.^id` typos (`/\.\^([a-z0-9]+(?:-[a-z0-9]+)+)/g`) to `.[^$1]` before alias rewriting
  bodyText = bodyText.replace(/\^+(\[\^[A-Za-z0-9_\-]+\])/g, '$1');
  bodyText = bodyText.replace(/\.\^([a-z0-9]+(?:-[a-z0-9]+)+)/gi, '.[^$1]');
  bodyText = bodyText.replace(
    /([.?!:;]?)(?<!\[)\^([A-Za-z0-9_\-]+)(?!\])/g,
    (fullMatch, punct: string, rawId: string) => {
      const mapped = sourcesById.get(rawId);
      if (!mapped) return fullMatch;
      const canonicalId = mapped.id || rawId;
      return `[^${canonicalId}]${punct || ''}`;
    }
  );

  // Rewrite all duplicate-URL source aliases recorded in registerSource() or deduplication
  for (const [aliasId, rawCanonicalId] of sourceIdAliases.entries()) {
    let canonicalId = rawCanonicalId;
    const seen = new Set<string>([aliasId]);
    while (sourceIdAliases.has(canonicalId) && !seen.has(canonicalId)) {
      seen.add(canonicalId);
      canonicalId = sourceIdAliases.get(canonicalId)!;
    }
    bodyText = bodyText.replaceAll(`[^${aliasId}]`, `[^${canonicalId}]`);
    existingFootnoteDefs.delete(aliasId);
    const canonicalEntry = sourcesById.get(canonicalId);
    if (canonicalEntry) {
      sourcesById.set(aliasId, canonicalEntry);
    }
  }

  // Resolve or strip any orphan `[^id]` citations in bodyText that do not exist in orderedSources
  const canonicalSourceById = new Map<string, OKFSource>();
  for (const s of orderedSources) {
    if (s.id) canonicalSourceById.set(s.id, s);
  }
  const rawCitedFnIds = Array.from(
    new Set(Array.from(bodyText.matchAll(/\[\^([A-Za-z0-9_\-]+)\]/g)).map((m) => m[1]))
  );
  for (const fnId of rawCitedFnIds) {
    if (!canonicalSourceById.has(fnId)) {
      const matched = matchOrphanFootnoteToSource(
        fnId,
        existingFootnoteDefs.get(fnId),
        orderedSources
      );
      if (matched && matched.id) {
        bodyText = bodyText.replaceAll(`[^${fnId}]`, `[^${matched.id}]`);
      } else {
        bodyText = removeSpecificFootnotePreservingBoundary(bodyText, fnId);
      }
      existingFootnoteDefs.delete(fnId);
    }
  }

  // Normalize trailing sentence & clause punctuation (`word.[^id]` -> `word[^id].`, `word:[^id]` -> `word[^id]:`, and `[^a].[^b]` -> `[^a] [^b].`)
  let prevBodyText = '';
  while (prevBodyText !== bodyText) {
    prevBodyText = bodyText;
    bodyText = bodyText.replace(
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
  bodyText = bodyText.replace(
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
  bodyText = bodyText.replace(
    /([\p{L}\p{N}_\-]+)(\[\^[A-Za-z0-9_\-]+\](?:[ \t]*\[\^[A-Za-z0-9_\-]+\])*)((?:\/[\p{L}\p{N}_\-]+)+)/gu,
    '$1$3$2'
  );
  bodyText = bodyText.replace(/(?:\[\^[A-Za-z0-9_\-]+\][ \t]*){2,}/g, (cluster) => {
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
  bodyText = bodyText.replace(
    /[ \t]+(\[\^[A-Za-z0-9_\-]+\])/g,
    (_m, fn: string, offset: number, str: string) =>
      /\][ \t]*$/.test(str.slice(0, offset)) ? ` ${fn}` : fn
  );
  bodyText = bodyText.replace(/[ \t]+([.,;!?])/g, '$1');
  bodyText = bodyText.replace(/(\[\^[A-Za-z0-9_\-]+\])(?=[\p{L}\p{N}])/gu, '$1 ');

  // 7. Append OKF v0.3 footnote definitions (`[^id]: Title`) at the bottom of the body (SPEC.md §5.1)
  // Only emit definitions for footnote IDs actually cited (`[^id]`) in the body (`citedFootnoteIds`).
  const citedFootnoteIds = Array.from(
    new Set(Array.from(bodyText.matchAll(/\[\^([A-Za-z0-9_\-]+)\]/g)).map((m) => m[1]))
  );
  const citedFootnoteIdSet = new Set(citedFootnoteIds);

  const footnoteLines: string[] = [];
  for (const fnId of citedFootnoteIds) {
    const src = canonicalSourceById.get(fnId) || sourcesById.get(fnId);
    const label = src?.title || existingFootnoteDefs.get(fnId) || src?.resource || fnId;
    footnoteLines.push(`[^${fnId}]: ${label}`);
  }

  bodyText = stripTrailingEmptyCitationSection(bodyText);
  if (footnoteLines.length > 0) {
    bodyText = `${bodyText}\n\n${footnoteLines.join('\n')}\n`;
  } else {
    bodyText = `${bodyText}\n`;
  }

  // 8. Build complete OKF v0.3 Frontmatter (SPEC.md §4.1 & §5)
  const fm: OKFFrontmatter = { ...parsedDoc.frontmatter };
  if ('okf_version' in fm) {
    delete fm.okf_version;
  }
  if (!fm.type || !String(fm.type).trim()) {
    fm.type = options?.type || 'Research Concept';
  }

  if (!fm.title || !String(fm.title).trim()) {
    const headingMatch = bodyText.match(/^#\s+(.+)$/m);
    fm.title =
      headingMatch?.[1]?.replace(/[*_`]/g, '').trim() ||
      options?.topic ||
      'Grounded Research Concept';
  }

  if (!fm.description || !String(fm.description).trim()) {
    const firstPara = bodyText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .find(
        (l) =>
          l.length > 25 &&
          !l.startsWith('#') &&
          !l.startsWith('[^') &&
          !l.startsWith('|') &&
          !l.startsWith('```')
      );
    const cleanSummary = firstPara
      ? firstPara
          .replace(/\[\^[A-Za-z0-9_\-]+\]/g, '')
          .replace(/^[\*\-\d.]+\s+/, '')
          .replace(/\*\*/g, '')
          .split(/(?<=[.!?])\s+/)[0]
          .slice(0, 200)
          .trim()
      : `Grounded research synthesis on ${fm.title}.`;
    fm.description = cleanSummary || `Grounded research synthesis on ${fm.title}.`;
  }

  const normalizedExistingTags = normalizeOkfTags(fm.tags);
  if (normalizedExistingTags.length > 0) {
    fm.tags = normalizedExistingTags;
  } else if (options?.tags && options.tags.length > 0) {
    fm.tags = options.tags;
  } else {
    const topicWords = transliterateNordicAscii(
      String(options?.topic || fm.title || 'research')
    )
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length >= 3 && !['the', 'and', 'for', 'with', 'from', 'that', 'this'].includes(w))
      .slice(0, 5);
    fm.tags = topicWords.length > 0 ? Array.from(new Set(topicWords)) : ['research', 'icm'];
  }

  if (!fm.status) {
    fm.status = options?.status || 'draft';
  }

  const existingGen =
    fm.generated && typeof fm.generated === 'object' ? fm.generated : ({} as OKFActorEvent);
  const rawGenAt = String(existingGen.at || nowIso).trim();
  const finalGenAt = parseValidIsoTimestamp(rawGenAt) || nowIso;
  const rawGenBy = String(
    existingGen.by ||
      options?.generatedBy ||
      `icm-stage1/${options?.model || GEMINI_4_ARGON_MODEL}`
  ).trim();
  fm.generated = {
    by: /[/:]/.test(rawGenBy)
      ? normalizeOkfActor(rawGenBy, 'icm-stage1')
      : `icm-stage1/${rawGenBy.replace(/\s+/g, '-') || GEMINI_4_ARGON_MODEL}`,
    at: finalGenAt,
  };

  if (!fm.stale_after) {
    if (options?.staleAfter) {
      fm.stale_after = options.staleAfter;
    } else {
      const days = options?.staleAfterDays ?? 30;
      const baseMs = Date.parse(fm.generated.at || nowIso) || Date.now();
      const staleDate = new Date(baseMs + days * 24 * 60 * 60 * 1000);
      fm.stale_after = staleDate.toISOString().replace(/\.\d{3}Z$/, 'Z');
    }
  }
  if (typeof fm.stale_after === 'string') {
    fm.stale_after = normalizeIsoTimestamp(fm.stale_after);
  }

  const finalSources =
    citedFootnoteIdSet.size > 0
      ? orderedSources.filter((s) => s.id && citedFootnoteIdSet.has(s.id))
      : orderedSources;

  for (const s of finalSources) {
    s.retrieved_at = parseValidIsoTimestamp(s.retrieved_at) || finalGenAt;
    const validLm = parseValidIsoTimestamp(s.last_modified);
    if (validLm) {
      s.last_modified = validLm;
    } else {
      delete s.last_modified;
    }
    const validMime =
      normalizeHttpMimeType(s.mime_type) || inferSourceMimeTypeFromUrl(s.resource);
    if (validMime) {
      s.mime_type = validMime;
    } else if ('mime_type' in s) {
      delete s.mime_type;
    }
  }
  fm.sources = finalSources;

  return serializeOkfDocument({
    frontmatter: fm,
    body: bodyText,
  });
}
