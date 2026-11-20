import * as fs from 'fs';
import * as path from 'path';

import { DEFAULT_ICM_LOCALE, GEMINI_4_ARGON_MODEL, loadWorkspaceLocale } from '../interactions/index.js';
import { normalizeIsoTimestamp, parseValidIsoTimestamp } from './timestamps.js';
import { type OKFActorEvent, type OKFDocument, type OKFFrontmatter, type OKFSource, RESERVED_OKF_FILENAMES, getOkfTrustTier, isOkfBlank, isOkfConceptDocument, normalizeOkfTags, normalizeVerified, parseOkfDocument, parseOkfTimestampMs, serializeOkfDocument, transliterateNordicAscii, truncateSlugAtWordBoundary, validateOkfDocument } from './document.js';
import { findTrailingRelatedConceptsHeadingIndex, getCanonicalSourceDedupeKeys, healOrphanOkfFootnotes, inferSourceMimeTypeFromUrl, isInternalConceptLinkBullet, isVertexRedirectUrl, normalizeHttpMimeType, normalizeSourceMatchKey } from './provenance.js';

function isCodeFenceDelimiter(line: string): string | null {
  const m = line.match(/^\s*(`{3,}|~{3,})/);
  return m ? m[1][0] : null;
}

function matchTopLevelMarkdownHeading(line: string): string | null {
  // Only match unindented (0-3 spaces) `# Heading` lines outside code blocks
  const m = line.match(/^ {0,3}#\s+(.+)$/);
  return m ? `# ${m[1].trim()}` : null;
}

function extractSchemaFieldNames(body: string): string[] {
  const fields = new Set<string>();
  let inSchema = false;
  let inFenceChar: string | null = null;
  for (const line of body.split(/\r?\n/)) {
    const fenceChar = isCodeFenceDelimiter(line);
    if (fenceChar) {
      if (!inFenceChar) {
        inFenceChar = fenceChar;
      } else if (inFenceChar === fenceChar) {
        inFenceChar = null;
      }
      continue;
    }
    if (inFenceChar) continue;
    const h = matchTopLevelMarkdownHeading(line);
    if (h) {
      inSchema = h.toLowerCase() === '# schema';
      continue;
    }
    const trimmed = line.trim();
    if (inSchema && trimmed) {
      for (const m of trimmed.matchAll(/`([A-Za-z_][A-Za-z0-9_.]*)`/g)) {
        fields.add(m[1]);
      }
    }
  }
  return Array.from(fields);
}

function mergeMarkdownSectionsAndSchema(existingBody: string, incomingBody: string): string {
  if (!existingBody.trim()) return incomingBody;
  if (!incomingBody.trim()) return existingBody;

  const parseSections = (text: string) => {
    const sections = new Map<string, string[]>();
    const order: string[] = [];
    const footnotes = new Map<string, string>();
    let currentHeading = '__preamble__';
    let inFenceChar: string | null = null;
    sections.set(currentHeading, []);
    order.push(currentHeading);

    for (const line of text.split(/\r?\n/)) {
      const fenceChar = isCodeFenceDelimiter(line);
      if (fenceChar) {
        if (!inFenceChar) {
          inFenceChar = fenceChar;
        } else if (inFenceChar === fenceChar) {
          inFenceChar = null;
        }
        sections.get(currentHeading)!.push(line);
        continue;
      }
      if (!inFenceChar) {
        const fnMatch = line.trim().match(/^\[\^([A-Za-z0-9_\-]+)\]:\s*(.+)$/);
        if (fnMatch) {
          footnotes.set(fnMatch[1], line.trim());
          continue;
        }
        const hm = matchTopLevelMarkdownHeading(line);
        if (hm) {
          currentHeading = hm;
          if (!sections.has(currentHeading)) {
            sections.set(currentHeading, []);
            order.push(currentHeading);
          }
          continue;
        }
      }
      sections.get(currentHeading)!.push(line);
    }
    return { sections, order, footnotes };
  };

  const hasIncomingAdjBlock = incomingBody.includes('<!-- okf:adjudications-start -->');
  const cleanedExistingBody = hasIncomingAdjBlock
    ? existingBody.replace(
        /\r?\n*<!-- okf:adjudications-start -->[\s\S]*?<!-- okf:adjudications-end -->\r?\n*/g,
        '\n\n'
      )
    : existingBody;

  const oldParsed = parseSections(cleanedExistingBody);
  const newParsed = parseSections(incomingBody);

  const combinedOrder = [...newParsed.order];
  for (const h of oldParsed.order) {
    if (!combinedOrder.includes(h)) {
      combinedOrder.push(h);
    }
  }

  const outBlocks: string[] = [];
  for (const heading of combinedOrder) {
    const oldLines = oldParsed.sections.get(heading) || [];
    const newLines = newParsed.sections.get(heading) || [];

    let bodyLines: string[];
    if (heading.toLowerCase() === '# schema' && oldLines.length > 0 && newLines.length > 0) {
      // Non-shrinking union of # Schema field lines
      const mergedSchemaLines = [...oldLines.filter((l) => l.trim() !== '')];
      const existingFields = new Set(extractSchemaFieldNames(`# Schema\n${oldLines.join('\n')}`));
      for (const l of newLines) {
        if (!l.trim()) continue;
        const fieldMatches = Array.from(l.matchAll(/`([A-Za-z_][A-Za-z0-9_.]*)`/g)).map((m) => m[1]);
        if (fieldMatches.length === 0 || fieldMatches.some((f) => !existingFields.has(f))) {
          mergedSchemaLines.push(l);
          fieldMatches.forEach((f) => existingFields.add(f));
        }
      }
      bodyLines = mergedSchemaLines;
    } else if (newLines.some((l) => l.trim() !== '')) {
      bodyLines = newLines;
    } else {
      bodyLines = oldLines;
    }

    const content = bodyLines.join('\n').trim();
    if (heading === '__preamble__') {
      if (content) outBlocks.push(content);
    } else {
      outBlocks.push(content ? `${heading}\n\n${content}` : heading);
    }
  }

  const mergedProse = outBlocks.join('\n\n');
  const citedInMerged = Array.from(
    new Set(Array.from(mergedProse.matchAll(/\[\^([A-Za-z0-9_\-]+)\]/g)).map((m) => m[1]))
  );
  const allFootnotes: string[] = [];
  for (const fnId of citedInMerged) {
    const fnLine = newParsed.footnotes.get(fnId) || oldParsed.footnotes.get(fnId);
    if (fnLine) {
      allFootnotes.push(fnLine);
    }
  }
  if (allFootnotes.length > 0) {
    outBlocks.push(allFootnotes.join('\n'));
  }

  return `${outBlocks.join('\n\n').trim()}\n`;
}

/**
 * Merges an existing OKF concept document with an updated document, preserving all prior
 * `sources`, `tags`, `verified` sign-offs, `# Schema` fields, and `# Section` headings when augmenting.
 */
export function mergeConceptDocuments(
  existing: OKFDocument,
  incoming: OKFDocument
): OKFDocument {
  const mergedFm: OKFFrontmatter = {
    ...existing.frontmatter,
    ...incoming.frontmatter,
  };

  // Do not downgrade `stable` status to `draft` during non-shrinking augmentation
  if (existing.frontmatter?.status === 'stable' && incoming.frontmatter?.status === 'draft') {
    mergedFm.status = 'stable';
  }

  const existingGenAt =
    existing.frontmatter?.generated && typeof existing.frontmatter.generated === 'object'
      ? parseValidIsoTimestamp(existing.frontmatter.generated.at)
      : undefined;
  const incomingGenAt =
    incoming.frontmatter?.generated && typeof incoming.frontmatter.generated === 'object'
      ? parseValidIsoTimestamp(incoming.frontmatter.generated.at)
      : undefined;
  const fallbackGenAt = incomingGenAt || existingGenAt;

  // Preserve non-shrinking union of sources (`resource` | `url` | `path` | `id`),
  // while healing existing unresolvable Vertex redirect URLs when a matching source provides a resolved URL
  const existingSources = Array.isArray(existing.frontmatter?.sources)
    ? existing.frontmatter.sources
    : [];
  const incomingSources = Array.isArray(incoming.frontmatter?.sources)
    ? incoming.frontmatter.sources
    : [];
  const mergedSources: OKFSource[] = [];
  const seenKeyMap = new Map<string, OKFSource>();
  const seenIds = new Set<string>();
  const getSourceLocator = (s: any): string =>
    String(s?.resource || s?.url || s?.path || s?.id || '').trim();
  const getMergeKeys = (s: any, loc: string): string[] => {
    if (/^https?:\/\//i.test(loc) && !isVertexRedirectUrl(loc)) {
      const keys = getCanonicalSourceDedupeKeys(loc, s?.id, s?.title);
      if (keys.length > 0) return keys;
    }
    return [loc];
  };

  const updateMergedSourceMetadata = (
    target: OKFSource,
    incomingSrc: OKFSource,
    wasHealed: boolean = false
  ) => {
    const cleanIncomingTitle = typeof incomingSrc.title === 'string' ? incomingSrc.title.trim() : '';
    if (
      cleanIncomingTitle &&
      (!target.title ||
        !target.title.trim() ||
        target.title.trim() === String(target.resource || '').trim())
    ) {
      target.title = cleanIncomingTitle;
    }
    const incRetrievedAt = parseValidIsoTimestamp(incomingSrc.retrieved_at);
    const targetRetrievedAt = parseValidIsoTimestamp(target.retrieved_at);
    if (incRetrievedAt) {
      if (!targetRetrievedAt) {
        target.retrieved_at = incRetrievedAt;
      } else {
        const targetMs = Date.parse(targetRetrievedAt);
        const incMs = Date.parse(incRetrievedAt);
        if (!Number.isNaN(incMs) && (Number.isNaN(targetMs) || incMs >= targetMs)) {
          target.retrieved_at = incRetrievedAt;
        } else {
          target.retrieved_at = targetRetrievedAt;
        }
      }
    } else if (wasHealed && (incomingGenAt || fallbackGenAt)) {
      target.retrieved_at = incomingGenAt || fallbackGenAt;
    } else if (targetRetrievedAt) {
      target.retrieved_at = targetRetrievedAt;
    } else if (existingGenAt || fallbackGenAt) {
      target.retrieved_at = existingGenAt || fallbackGenAt;
    } else if ('retrieved_at' in target) {
      delete target.retrieved_at;
    }

    const incLastModified = parseValidIsoTimestamp(incomingSrc.last_modified);
    const targetLastModified = parseValidIsoTimestamp(target.last_modified);
    if (incLastModified) {
      if (!targetLastModified) {
        target.last_modified = incLastModified;
      } else {
        const targetLmMs = Date.parse(targetLastModified);
        const incLmMs = Date.parse(incLastModified);
        if (!Number.isNaN(incLmMs) && (Number.isNaN(targetLmMs) || incLmMs >= targetLmMs)) {
          target.last_modified = incLastModified;
        } else {
          target.last_modified = targetLastModified;
        }
      }
    } else if (targetLastModified) {
      target.last_modified = targetLastModified;
    } else if ('last_modified' in target) {
      delete target.last_modified;
    }

    const incMime =
      normalizeHttpMimeType(incomingSrc.mime_type) ||
      inferSourceMimeTypeFromUrl(incomingSrc.resource);
    const targetMime =
      normalizeHttpMimeType(target.mime_type) || inferSourceMimeTypeFromUrl(target.resource);
    if (incMime && !targetMime) {
      target.mime_type = incMime;
    } else if (incMime && targetMime === 'text/html' && incMime !== 'text/html') {
      target.mime_type = incMime;
    } else if (targetMime) {
      target.mime_type = targetMime;
    } else if ('mime_type' in target) {
      delete target.mime_type;
    }

    if (incomingSrc.author && !target.author) {
      target.author = incomingSrc.author;
    }
    if (incomingSrc.usage_count !== undefined) {
      target.usage_count = incomingSrc.usage_count;
    }
    if (incomingSrc.usage_window && !target.usage_window) {
      target.usage_window = incomingSrc.usage_window;
    }
  };

  const taggedSources: Array<{ src: OKFSource; isIncoming: boolean }> = [
    ...existingSources.map((src) => ({ src, isIncoming: false })),
    ...incomingSources.map((src) => ({ src, isIncoming: true })),
  ];

  for (const { src, isIncoming } of taggedSources) {
    if (!src || typeof src !== 'object') continue;
    const locator = getSourceLocator(src);
    if (!locator) continue;
    const mergeKeys = getMergeKeys(src, locator);
    const existingByKey = mergeKeys.map((k) => seenKeyMap.get(k)).find(Boolean);
    if (existingByKey) {
      updateMergedSourceMetadata(existingByKey, src, false);
      for (const k of mergeKeys) seenKeyMap.set(k, existingByKey);
      continue;
    }

    const srcId = String(src.id || '').trim();
    const srcNormTitle = normalizeSourceMatchKey(src.title);
    const matchingExisting = mergedSources.find(
      (s) =>
        (srcId && s.id === srcId) ||
        (srcNormTitle &&
          srcNormTitle.length >= 6 &&
          normalizeSourceMatchKey(s.title) === srcNormTitle)
    );
    if (matchingExisting) {
      const existingLocator = String(
        (matchingExisting as any).resource ||
          (matchingExisting as any).url ||
          (matchingExisting as any).path ||
          ''
      ).trim();
      if (isVertexRedirectUrl(existingLocator) && !isVertexRedirectUrl(locator)) {
        seenKeyMap.delete(existingLocator);
        matchingExisting.resource = locator;
        for (const k of getMergeKeys(matchingExisting, locator)) {
          seenKeyMap.set(k, matchingExisting);
        }
        if (
          src.title &&
          (!matchingExisting.title || matchingExisting.title === existingLocator)
        ) {
          matchingExisting.title = src.title.trim();
        }
        updateMergedSourceMetadata(matchingExisting, src, true);
        continue;
      }
      if (!isVertexRedirectUrl(existingLocator) && isVertexRedirectUrl(locator)) {
        updateMergedSourceMetadata(matchingExisting, src, false);
        continue;
      }
    }

    let id = src.id || 'source';
    let counter = 2;
    while (seenIds.has(id)) {
      id = `${src.id || 'source'}-${counter++}`;
    }
    seenIds.add(id);

    const normalizedRetrievedAt =
      parseValidIsoTimestamp(src.retrieved_at) ||
      (isIncoming ? incomingGenAt || fallbackGenAt : existingGenAt || fallbackGenAt);
    const normalizedLastModified = parseValidIsoTimestamp(src.last_modified);
    const normalizedMimeType =
      normalizeHttpMimeType(src.mime_type) || inferSourceMimeTypeFromUrl(locator);

    const mergedEntry: OKFSource = {
      ...src,
      ...(typeof src.resource === 'string' ? { resource: src.resource.trim() } : {}),
      ...(typeof src.title === 'string' ? { title: src.title.trim() } : {}),
      id,
      ...(normalizedMimeType ? { mime_type: normalizedMimeType } : {}),
      ...(normalizedRetrievedAt ? { retrieved_at: normalizedRetrievedAt } : {}),
      ...(normalizedLastModified ? { last_modified: normalizedLastModified } : {}),
    };
    if (!normalizedMimeType && 'mime_type' in mergedEntry) {
      delete mergedEntry.mime_type;
    }
    if (!normalizedRetrievedAt && 'retrieved_at' in mergedEntry) {
      delete mergedEntry.retrieved_at;
    }
    if (!normalizedLastModified && 'last_modified' in mergedEntry) {
      delete mergedEntry.last_modified;
    }
    mergedSources.push(mergedEntry);
    for (const k of [...mergeKeys, ...getMergeKeys(mergedEntry, locator)]) {
      seenKeyMap.set(k, mergedEntry);
    }
  }
  mergedFm.sources = mergedSources;

  if (typeof mergedFm.stale_after === 'string') {
    mergedFm.stale_after = normalizeIsoTimestamp(mergedFm.stale_after);
  }
  if (
    mergedFm.generated &&
    typeof mergedFm.generated === 'object' &&
    typeof mergedFm.generated.at === 'string'
  ) {
    mergedFm.generated = {
      ...mergedFm.generated,
      at: normalizeIsoTimestamp(mergedFm.generated.at),
    };
  }

  // Preserve union of tags
  const existingTags = normalizeOkfTags(existing.frontmatter?.tags);
  const incomingTags = normalizeOkfTags(incoming.frontmatter?.tags);
  if (existingTags.length > 0 || incomingTags.length > 0) {
    mergedFm.tags = Array.from(new Set([...existingTags, ...incomingTags]));
  }

  // Preserve existing human/machine `verified` records alongside any new verification events
  const existingVerified = normalizeVerified(existing.frontmatter || {});
  const incomingVerified = normalizeVerified(incoming.frontmatter || {});
  if (existingVerified.length > 0 || incomingVerified.length > 0) {
    const combinedVerified: OKFActorEvent[] = [];
    for (const v of [...existingVerified, ...incomingVerified]) {
      const existingActorIdx = combinedVerified.findIndex((c) => c.by === v.by);
      if (existingActorIdx >= 0) {
        combinedVerified[existingActorIdx] = v;
      } else {
        combinedVerified.push(v);
      }
    }
    mergedFm.verified = combinedVerified;
  }

  // Merge `x-adjudications` by `id` (preserving prior resolved decisions unless incoming overrides)
  const existingAdj = Array.isArray(existing.frontmatter?.['x-adjudications'])
    ? existing.frontmatter['x-adjudications']
    : [];
  const incomingAdj = Array.isArray(incoming.frontmatter?.['x-adjudications'])
    ? incoming.frontmatter['x-adjudications']
    : [];
  if (existingAdj.length > 0 && incomingAdj.length > 0) {
    const mergedAdjMap = new Map<string, any>();
    for (const item of existingAdj) {
      if (item && typeof item.id === 'string' && item.id) {
        mergedAdjMap.set(item.id, item);
      }
    }
    for (const item of incomingAdj) {
      if (item && typeof item.id === 'string' && item.id) {
        mergedAdjMap.set(item.id, item);
      }
    }
    mergedFm['x-adjudications'] = Array.from(mergedAdjMap.values());
  }

  return {
    frontmatter: mergedFm,
    body: mergeMarkdownSectionsAndSchema(existing.body, incoming.body),
  };
}

/**
 * Writes an OKF v0.3 concept document to `bundleRoot/<conceptId>.md`, merging into any
 * existing concept unless `allowDestructiveOverwrite` is set.
 */
export function writeBundleConcept(
  bundleRoot: string,
  conceptId: string,
  docInput: OKFDocument | string,
  options?: {
    mergeExisting?: boolean;
    allowDestructiveOverwrite?: boolean;
  }
): { path: string; conceptId: string; bytes: number; action: 'Creation' | 'Update' } {
  const cleanCid = conceptId
    .replace(/\\/g, '/')
    .replace(/^\/+/, '')
    .replace(/\.md$/i, '');
  const baseName = path.posix.basename(`${cleanCid}.md`);
  if (RESERVED_OKF_FILENAMES.has(baseName)) {
    throw new Error(
      `Cannot write concept to "${baseName}": index.md and log.md are reserved OKF filenames (SPEC.md §3.1).`
    );
  }

  const doc: OKFDocument =
    typeof docInput === 'string' ? parseOkfDocument(docInput) : docInput;
  validateOkfDocument(doc);

  const resolvedBundleRoot = path.resolve(bundleRoot);
  const targetPath = path.resolve(resolvedBundleRoot, `${cleanCid}.md`);
  const existed = fs.existsSync(targetPath);
  let docToWrite: OKFDocument = {
    frontmatter: { ...doc.frontmatter },
    body: doc.body,
  };
  if ('okf_version' in docToWrite.frontmatter) {
    delete docToWrite.frontmatter.okf_version;
  }

  if (existed) {
    const existingRaw = fs.readFileSync(targetPath, 'utf-8');
    const existingDoc = parseOkfDocument(existingRaw);

    if (!options?.allowDestructiveOverwrite && options?.mergeExisting) {
      docToWrite = mergeConceptDocuments(existingDoc, docToWrite);
    }
  }

  if (!docToWrite.frontmatter.generated || typeof docToWrite.frontmatter.generated !== 'object') {
    docToWrite.frontmatter.generated = {
      by: `icm/${GEMINI_4_ARGON_MODEL}`,
      at: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
    };
  }

  if (Array.isArray(docToWrite.frontmatter.sources)) {
    const genAtFallback =
      parseValidIsoTimestamp(docToWrite.frontmatter.generated?.at) ||
      new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
    docToWrite.frontmatter.sources = docToWrite.frontmatter.sources.map((s) => {
      if (!s || typeof s !== 'object') return s;
      const validRetrieved = parseValidIsoTimestamp(s.retrieved_at) || genAtFallback;
      const validLm = parseValidIsoTimestamp(s.last_modified);
      const nextSrc: OKFSource = {
        ...s,
        retrieved_at: validRetrieved,
        ...(validLm ? { last_modified: validLm } : {}),
      };
      if (!validLm && 'last_modified' in nextSrc) {
        delete nextSrc.last_modified;
      }
      return nextSrc;
    });
  }

  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  const serialized = serializeOkfDocument(docToWrite);
  fs.writeFileSync(targetPath, serialized, 'utf-8');

  return {
    path: path.relative(resolvedBundleRoot, targetPath).replace(/\\/g, '/'),
    conceptId: cleanCid,
    bytes: Buffer.byteLength(serialized, 'utf-8'),
    action: existed ? 'Update' : 'Creation',
  };
}

/**
 * 100% deterministic `index.md` generator for an OKF v0.3 bundle (`SPEC.md` §8 & §8.1).
 * Preserves existing root `index.md` metadata (`title`, `description`, `license`, `x-*`) while
 * stamping `okf_version: "0.3"`, keeps subdirectory `index.md` files free of frontmatter,
 * and skips `.`-prefixed paths and `.md` files without a non-empty `type` (`SPEC.md` §3.2).
 */
export function regenerateBundleIndexes(bundleRoot: string): string[] {
  const resolvedRoot = path.resolve(bundleRoot);
  if (!fs.existsSync(resolvedRoot)) return [];

  const dirsToIndex = new Set<string>([resolvedRoot]);
  function scanDirs(dir: string) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith('.')) continue;
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        scanDirs(fullPath);
      } else if (
        entry.isFile() &&
        entry.name.endsWith('.md') &&
        !RESERVED_OKF_FILENAMES.has(entry.name)
      ) {
        try {
          const doc = parseOkfDocument(fs.readFileSync(fullPath, 'utf-8'));
          if (!isOkfConceptDocument(doc)) continue;
        } catch {
          continue;
        }
        let cur = path.dirname(fullPath);
        while (cur.startsWith(resolvedRoot)) {
          dirsToIndex.add(cur);
          if (cur === resolvedRoot) break;
          cur = path.dirname(cur);
        }
      }
    }
  }
  scanDirs(resolvedRoot);

  // Sort directories deepest first so subdirectory descriptions roll up deterministically
  const sortedDirs = Array.from(dirsToIndex).sort((a, b) => {
    const depthA = path.relative(resolvedRoot, a).split(path.sep).filter(Boolean).length;
    const depthB = path.relative(resolvedRoot, b).split(path.sep).filter(Boolean).length;
    return depthB - depthA || a.localeCompare(b);
  });

  const dirDescriptions = new Map<string, string>();
  const writtenPaths: string[] = [];

  const readPreservedRootFrontmatter = (rootIndexPath: string): OKFFrontmatter => {
    let preserved: Record<string, any> = {};
    if (fs.existsSync(rootIndexPath)) {
      try {
        const existingDoc = parseOkfDocument(fs.readFileSync(rootIndexPath, 'utf-8'));
        if (existingDoc.hasFrontmatter && existingDoc.frontmatter) {
          preserved = { ...existingDoc.frontmatter };
        }
      } catch {
        preserved = {};
      }
    }
    preserved.okf_version = '0.3';
    return preserved as OKFFrontmatter;
  };

  for (const directory of sortedDirs) {
    const entries: Array<{ type: string; title: string; link: string; desc: string }> = [];
    const children = fs
      .readdirSync(directory, { withFileTypes: true })
      .sort((a, b) => a.name.localeCompare(b.name));

    for (const child of children) {
      if (child.name.startsWith('.') || RESERVED_OKF_FILENAMES.has(child.name)) continue;
      const fullChild = path.join(directory, child.name);
      if (child.isFile() && child.name.endsWith('.md')) {
        try {
          const doc = parseOkfDocument(fs.readFileSync(fullChild, 'utf-8'));
          if (!isOkfConceptDocument(doc)) continue;
          const fm = doc.frontmatter || {};
          const title = String(fm.title || path.basename(child.name, '.md'));
          const desc = String(fm.description || '');
          const typ = String(fm.type).trim();
          entries.push({ type: typ, title, link: child.name, desc });
        } catch {
          // Skip malformed files
        }
      } else if (child.isDirectory() && dirsToIndex.has(fullChild)) {
        const subDesc = dirDescriptions.get(fullChild) || `Concepts in ${child.name}`;
        entries.push({
          type: 'Subdirectories',
          title: child.name,
          link: `${child.name}/index.md`,
          desc: subDesc,
        });
      }
    }

    const isRoot = directory === resolvedRoot;
    const indexPath = path.join(directory, 'index.md');

    if (entries.length === 0) {
      if (isRoot) {
        const rootFm = readPreservedRootFrontmatter(indexPath);
        const emptyBody = [
          '# Knowledge Bundle Index',
          '',
          '_No concepts indexed yet. Run Stage 1 (`npm run cli:stage1 -- "<topic>"`) to populate `workspace/bundle/`._',
          '',
        ].join('\n');
        fs.writeFileSync(
          indexPath,
          serializeOkfDocument({ frontmatter: rootFm, body: emptyBody }),
          'utf-8'
        );
        writtenPaths.push(indexPath);
      }
      continue;
    }

    const grouped = new Map<string, Array<{ title: string; link: string; desc: string }>>();
    for (const e of entries) {
      const groupKey = e.type || 'Other';
      if (!grouped.has(groupKey)) grouped.set(groupKey, []);
      grouped.get(groupKey)!.push({ title: e.title, link: e.link, desc: e.desc });
    }

    const sections: string[] = [];
    for (const typ of Array.from(grouped.keys()).sort((a, b) => a.localeCompare(b))) {
      const groupItems = grouped
        .get(typ)!
        .sort((a, b) => a.title.toLowerCase().localeCompare(b.title.toLowerCase()));
      const sectionLines = [`# ${typ}`, ''];
      for (const item of groupItems) {
        const suffix = item.desc ? ` - ${item.desc}` : '';
        sectionLines.push(`* [${item.title}](${item.link})${suffix}`);
      }
      sections.push(sectionLines.join('\n'));
    }

    // SPEC.md §8 & §8.1: Bundle-root index.md carries okf_version: "0.3" (+ optional metadata); subdirectory index.md has NO frontmatter
    const bodyContent = `${sections.join('\n\n')}\n`;
    const indexContent = isRoot
      ? serializeOkfDocument({
          frontmatter: readPreservedRootFrontmatter(indexPath),
          body: bodyContent,
        })
      : bodyContent;

    fs.writeFileSync(indexPath, indexContent, 'utf-8');
    writtenPaths.push(indexPath);

    if (!isRoot) {
      if (entries.length === 1 && entries[0].desc) {
        dirDescriptions.set(directory, entries[0].desc);
      } else {
        const sampleTitles = entries
          .slice(0, 3)
          .map((e) => e.title)
          .join(', ');
        dirDescriptions.set(
          directory,
          `${entries.length} concept(s) including ${sampleTitles}${entries.length > 3 ? '...' : ''}`
        );
      }
    }
  }

  return writtenPaths;
}

/**
 * Appends a date-grouped entry (`## YYYY-MM-DD`, newest first) to `bundleRoot/log.md` (`SPEC.md` §9).
 */
export function appendBundleLog(
  bundleRoot: string,
  action: 'Creation' | 'Update' | 'Verification' | 'Deprecation' | 'Initialization',
  conceptId: string,
  title: string,
  detail?: string
): string {
  const resolvedRoot = path.resolve(bundleRoot);
  fs.mkdirSync(resolvedRoot, { recursive: true });
  const logPath = path.join(resolvedRoot, 'log.md');
  const today = new Date().toISOString().slice(0, 10);
  const cleanCid = conceptId.replace(/\\/g, '/').replace(/^\/+/, '').replace(/\.md$/i, '');
  const suffix = detail ? ` (${detail})` : '';
  const entryBullet = `* **${action}**: [${title}](/${cleanCid}.md)${suffix}`;

  let existing = '';
  if (fs.existsSync(logPath)) {
    existing = fs.readFileSync(logPath, 'utf-8').replace(/^\uFEFF/, '');
    if (/^---\r?\n[\s\S]*?\r?\n---\r?\n?/.test(existing)) {
      existing = existing.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n*/, '');
    }
  }

  if (!existing.trim()) {
    const content = `# Directory Update Log\n\n## ${today}\n${entryBullet}\n`;
    fs.writeFileSync(logPath, content, 'utf-8');
    return logPath;
  }

  const lines = existing.split(/\r?\n/);
  const todayHeadingIdx = lines.findIndex((l) => l.trim() === `## ${today}`);
  if (todayHeadingIdx !== -1) {
    const sameActionPrefix = `* **${action}**: [`;
    const sameConceptLink = `](/${cleanCid}.md)`;
    let nextSectionIdx = lines.findIndex(
      (l, idx) => idx > todayHeadingIdx && /^##\s+\d{4}-\d{2}-\d{2}/.test(l.trim())
    );
    if (nextSectionIdx === -1) nextSectionIdx = lines.length;
    for (let idx = nextSectionIdx - 1; idx > todayHeadingIdx; idx--) {
      const lineTrim = lines[idx].trim();
      if (
        lineTrim === entryBullet ||
        (lineTrim.startsWith(sameActionPrefix) && lineTrim.includes(sameConceptLink))
      ) {
        lines.splice(idx, 1);
      }
    }
    lines.splice(todayHeadingIdx + 1, 0, entryBullet);
    fs.writeFileSync(logPath, lines.join('\n').trimEnd() + '\n', 'utf-8');
    return logPath;
  }

  const firstDateHeadingIdx = lines.findIndex((l) => /^##\s+\d{4}-\d{2}-\d{2}/.test(l.trim()));
  if (firstDateHeadingIdx !== -1) {
    lines.splice(firstDateHeadingIdx, 0, `## ${today}`, entryBullet, '');
    fs.writeFileSync(logPath, lines.join('\n').trimEnd() + '\n', 'utf-8');
    return logPath;
  }

  const appended = `${existing.trimEnd()}\n\n## ${today}\n${entryBullet}\n`;
  fs.writeFileSync(logPath, appended, 'utf-8');
  return logPath;
}

function insertRelatedConceptLinkIntoDoc(
  doc: OKFDocument,
  targetConceptId: string,
  targetTitle: string,
  relatedConceptsHeading: string = DEFAULT_ICM_LOCALE.ui.relatedConceptsHeading
): boolean {
  const cleanTargetId = targetConceptId.replace(/\\/g, '/').replace(/^\/+/, '').replace(/\.md$/i, '');
  const targetSlug = path.posix.basename(cleanTargetId);
  const rawBody = String(doc.body || '');

  // Check if the body already links to this concept via root-relative or relative Markdown link
  const escapedId = cleanTargetId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const escapedSlug = targetSlug.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const existingLinkRe = new RegExp(
    `\\]\\((?:\\/${escapedId}(?:\\.md)?|(?:\\.\\/|\\.\\.\\/[A-Za-z0-9_\\-\\/]+\\/)?${escapedSlug}\\.md)(?:[#?][^)]*)?\\)`,
    'i'
  );
  if (existingLinkRe.test(rawBody)) {
    return false;
  }

  const lines = rawBody.split(/\r?\n/);
  const proseLines: string[] = [];
  const footnoteLines: string[] = [];
  for (const line of lines) {
    if (/^\[\^[A-Za-z0-9_\-]+\]:\s*.+$/.test(line.trim())) {
      footnoteLines.push(line.trim());
    } else {
      proseLines.push(line);
    }
  }

  const bulletLine = `- [${targetTitle || targetSlug}](/${cleanTargetId}.md)`;
  const normalizedHeading = /^#{1,4}\s+/.test(relatedConceptsHeading.trim())
    ? relatedConceptsHeading.trim()
    : `## ${relatedConceptsHeading.trim()}`;
  const structuralHeadingIdx = findTrailingRelatedConceptsHeadingIndex(proseLines);
  const explicitHeadingIdx =
    structuralHeadingIdx >= 0
      ? structuralHeadingIdx
      : proseLines.findIndex((l) => l.trim().toLowerCase() === normalizedHeading.toLowerCase());

  if (explicitHeadingIdx !== -1) {
    let insertIdx = explicitHeadingIdx + 1;
    while (
      insertIdx < proseLines.length &&
      (proseLines[insertIdx].trim() === '' ||
        proseLines[insertIdx].trim() === '<!-- okf:related-concepts -->')
    ) {
      insertIdx++;
    }
    while (
      insertIdx < proseLines.length &&
      (isInternalConceptLinkBullet(proseLines[insertIdx]) || /^\s*[-*]\s+/.test(proseLines[insertIdx]))
    ) {
      insertIdx++;
    }
    proseLines.splice(insertIdx, 0, bulletLine);
  } else {
    while (proseLines.length > 0 && proseLines[proseLines.length - 1].trim() === '') {
      proseLines.pop();
    }
    if (proseLines.length > 0) {
      proseLines.push('', normalizedHeading, '', bulletLine);
    } else {
      proseLines.push(normalizedHeading, '', bulletLine);
    }
  }

  const cleanProse = proseLines.join('\n').trimEnd();
  doc.body =
    footnoteLines.length > 0
      ? `${cleanProse}\n\n${footnoteLines.join('\n')}\n`
      : `${cleanProse}\n`;
  return true;
}

/**
 * Ensures bidirectional Markdown links (using Layer 3 `locale.ui.relatedConceptsHeading`, defaulting to
 * `## Related Bundle Concepts`) across related concepts in `workspace/bundle/` AND synchronizes those links
 * back into each corresponding run's `workspace/runs/<runId>/stages/01_research/output/research_summary.md`.
 */
export function injectBidirectionalBundleLinks(
  workspaceOrBundleRoot: string,
  currentConceptId?: string,
  explicitWorkspaceRoot?: string
): string[] {
  const resolvedInput = path.resolve(workspaceOrBundleRoot);
  const isBundleDir =
    path.basename(resolvedInput).toLowerCase() === 'bundle' ||
    (!fs.existsSync(path.join(resolvedInput, 'bundle')) &&
      fs.existsSync(path.join(resolvedInput, 'research')));
  const bundleRoot = isBundleDir ? resolvedInput : path.join(resolvedInput, 'bundle');
  const workspaceRoot = explicitWorkspaceRoot
    ? path.resolve(explicitWorkspaceRoot)
    : isBundleDir
      ? path.dirname(resolvedInput)
      : resolvedInput;

  if (!fs.existsSync(bundleRoot)) return [];

  interface BundleConceptRecord {
    id: string;
    slug: string;
    dir: string;
    filePath: string;
    doc: OKFDocument;
    title: string;
    modified: boolean;
  }

  const conceptsById = new Map<string, BundleConceptRecord>();
  const scanBundleConcepts = (dir: string) => {
    let entries: fs.Dirent[] = [];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        scanBundleConcepts(fullPath);
      } else if (
        entry.isFile() &&
        entry.name.endsWith('.md') &&
        !RESERVED_OKF_FILENAMES.has(entry.name)
      ) {
        try {
          const doc = parseOkfDocument(fs.readFileSync(fullPath, 'utf-8'));
          if (!isOkfConceptDocument(doc)) continue;
          const relId = path
            .relative(bundleRoot, fullPath)
            .replace(/\\/g, '/')
            .replace(/\.md$/i, '');
          const slug = path.posix.basename(relId);
          const dirName = path.posix.dirname(relId);
          const title = String(doc.frontmatter?.title || slug).trim();
          conceptsById.set(relId, {
            id: relId,
            slug,
            dir: dirName,
            filePath: fullPath,
            doc,
            title,
            modified: false,
          });
        } catch {
          // Ignore unreadable concept file
        }
      }
    }
  };
  scanBundleConcepts(bundleRoot);

  if (conceptsById.size < 2) return [];

  const resolveLinkTargetId = (fromConceptId: string, rawHref: string): string | null => {
    const trimmedHref = String(rawHref || '').trim();
    if (
      !trimmedHref ||
      trimmedHref.startsWith('#') ||
      trimmedHref.startsWith('//') ||
      /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmedHref)
    ) {
      return null;
    }
    const rawClean = trimmedHref.split('#')[0].split('?')[0].trim();
    if (!rawClean) return null;
    let cleanHref = rawClean;
    try {
      cleanHref = decodeURIComponent(rawClean);
    } catch {
      cleanHref = rawClean;
    }
    let candidate = '';
    if (cleanHref.startsWith('/')) {
      candidate = cleanHref.replace(/^\/+/, '').replace(/\.md$/i, '');
    } else if (cleanHref.endsWith('.md')) {
      const baseDir = path.posix.dirname(fromConceptId);
      candidate = path.posix
        .normalize(baseDir === '.' ? cleanHref : `${baseDir}/${cleanHref}`)
        .replace(/\.md$/i, '');
    } else {
      return null;
    }
    if (!candidate || candidate.startsWith('..') || candidate.split('/').some((seg) => seg.startsWith('.'))) {
      return null;
    }
    const baseName = path.posix.basename(candidate);
    if (RESERVED_OKF_FILENAMES.has(`${baseName}.md`)) return null;
    return conceptsById.has(candidate) ? candidate : null;
  };

  const extractLinkedConceptIds = (rec: BundleConceptRecord): Set<string> => {
    const out = new Set<string>();
    const mdLinkRegex = /(?<!\!)\[[^\]]+\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
    for (const m of String(rec.doc.body || '').matchAll(mdLinkRegex)) {
      const targetId = resolveLinkTargetId(rec.id, m[1]);
      if (targetId && targetId !== rec.id) {
        out.add(targetId);
      }
    }
    if (typeof rec.doc.frontmatter?.superseded_by === 'string') {
      const supTarget = resolveLinkTargetId(rec.id, rec.doc.frontmatter.superseded_by);
      if (supTarget && supTarget !== rec.id) {
        out.add(supTarget);
      }
    }
    return out;
  };

  // 1. Collect all directed concept pairs that should be bidirectionally linked
  const normalizedCurrentId = currentConceptId
    ? currentConceptId.replace(/\\/g, '/').replace(/^\/+/, '').replace(/\.md$/i, '')
    : undefined;

  const isImmutableReference = (rec: BundleConceptRecord): boolean =>
    rec.id.startsWith('references/') ||
    (String(rec.doc.frontmatter?.type || '').trim().toLowerCase() === 'reference' &&
      getOkfTrustTier(rec.doc.frontmatter) === 'machine-confirmed');

  const linkPairs = new Set<string>();
  const addBidirectionalPair = (idA: string, idB: string) => {
    if (!idA || !idB || idA === idB) return;
    const recA = conceptsById.get(idA);
    const recB = conceptsById.get(idB);
    if (!recA || !recB) return;
    if (!isImmutableReference(recA)) linkPairs.add(`${idA}:::${idB}`);
    if (!isImmutableReference(recB)) linkPairs.add(`${idB}:::${idA}`);
  };

  for (const rec of conceptsById.values()) {
    for (const targetId of extractLinkedConceptIds(rec)) {
      addBidirectionalPair(rec.id, targetId);
    }
  }

  // If a currentConceptId was promoted (or if sibling concepts in the same directory exist), link siblings bidirectionally
  if (normalizedCurrentId && conceptsById.has(normalizedCurrentId)) {
    const curRec = conceptsById.get(normalizedCurrentId)!;
    for (const other of conceptsById.values()) {
      if (other.id !== curRec.id && other.dir === curRec.dir) {
        addBidirectionalPair(curRec.id, other.id);
      }
    }
  } else if (linkPairs.size === 0) {
    const allRecs = Array.from(conceptsById.values());
    for (let i = 0; i < allRecs.length; i++) {
      for (let j = i + 1; j < allRecs.length; j++) {
        if (allRecs[i].dir === allRecs[j].dir) {
          addBidirectionalPair(allRecs[i].id, allRecs[j].id);
        }
      }
    }
  }

  const locale = loadWorkspaceLocale(workspaceRoot);
  const relatedHeading = locale.ui.relatedConceptsHeading;
  const updatedPaths: string[] = [];

  for (const pair of linkPairs) {
    const [sourceId, targetId] = pair.split(':::');
    const sourceRec = conceptsById.get(sourceId);
    const targetRec = conceptsById.get(targetId);
    if (!sourceRec || !targetRec || isImmutableReference(sourceRec)) continue;
    if (insertRelatedConceptLinkIntoDoc(sourceRec.doc, targetRec.id, targetRec.title, relatedHeading)) {
      sourceRec.modified = true;
    }
  }

  for (const rec of conceptsById.values()) {
    if (rec.modified) {
      fs.writeFileSync(rec.filePath, serializeOkfDocument(rec.doc), 'utf-8');
      updatedPaths.push(rec.filePath);
    }
  }

  // 2. Synchronize every concept's outbound bundle links into any matching run's stages/01_research/output/research_summary.md
  const runsRoot = path.join(workspaceRoot, 'runs');
  if (fs.existsSync(runsRoot)) {
    let runDirs: fs.Dirent[] = [];
    try {
      runDirs = fs.readdirSync(runsRoot, { withFileTypes: true });
    } catch {
      runDirs = [];
    }

    const toCanonicalSlug = (raw: string): string => {
      const s = transliterateNordicAscii(String(raw || ''))
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/-\d{10,}$/, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
      return truncateSlugAtWordBoundary(s, 48, 12, true);
    };

    for (const runEntry of runDirs) {
      if (!runEntry.isDirectory() || runEntry.name === '_dry_run') continue;
      const runDir = path.join(runsRoot, runEntry.name);
      const researchSummaryPath = path.join(
        runDir,
        'stages/01_research/output/research_summary.md'
      );
      if (!fs.existsSync(researchSummaryPath)) continue;

      try {
        const runDoc = parseOkfDocument(fs.readFileSync(researchSummaryPath, 'utf-8'));
        let matchedConcept: BundleConceptRecord | undefined;

        const metaPath = path.join(runDir, 'meta.json');
        if (fs.existsSync(metaPath)) {
          try {
            const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
            const metaCid = String(meta?.okf?.bundleConceptId || '')
              .trim()
              .replace(/\\/g, '/')
              .replace(/^\/+/, '')
              .replace(/\.md$/i, '');
            if (metaCid && conceptsById.has(metaCid)) {
              matchedConcept = conceptsById.get(metaCid);
            }
          } catch {
            // Ignore unreadable meta.json
          }
        }

        if (!matchedConcept) {
          const runTitle = String(runDoc.frontmatter?.title || '').trim();
          const runSlug = toCanonicalSlug(runTitle || runEntry.name);
          for (const rec of conceptsById.values()) {
            if (
              (runTitle && rec.title.toLowerCase() === runTitle.toLowerCase()) ||
              (runSlug && rec.slug === runSlug)
            ) {
              matchedConcept = rec;
              break;
            }
          }
        }

        if (!matchedConcept) continue;

        const outboundTargets = extractLinkedConceptIds(matchedConcept);
        let runModified = false;
        for (const targetId of outboundTargets) {
          const targetRec = conceptsById.get(targetId);
          if (!targetRec) continue;
          if (insertRelatedConceptLinkIntoDoc(runDoc, targetRec.id, targetRec.title, relatedHeading)) {
            runModified = true;
          }
        }

        if (runModified) {
          fs.writeFileSync(researchSummaryPath, serializeOkfDocument(runDoc), 'utf-8');
          updatedPaths.push(researchSummaryPath);
        }
      } catch {
        // Ignore unreadable run research_summary.md
      }
    }
  }

  return updatedPaths;
}

/**
 * Promotes/synchronizes a Stage 1 `research_summary.md` artifact into `workspace/bundle/research/<slug>.md`,
 * injects reciprocal cross-concept links (in both `workspace/bundle/` and `workspace/runs/`),
 * regenerates deterministic `index.md` files, and logs the update in `workspace/bundle/log.md`.
 */
export function syncRunToBundle(
  workspacePath: string,
  runId: string,
  options?: {
    conceptSlug?: string;
    actionOverride?: 'Creation' | 'Update' | 'Verification';
    allowDestructiveOverwrite?: boolean;
  }
): { conceptId: string; bundleFilePath: string } | null {
  const resolvedWorkspace = path.resolve(workspacePath);
  const runDir = path.join(resolvedWorkspace, 'runs', runId);
  const researchPath = path.join(runDir, 'stages/01_research/output/research_summary.md');
  if (!fs.existsSync(researchPath)) return null;

  const bundleRoot = path.join(resolvedWorkspace, 'bundle');
  const doc = parseOkfDocument(fs.readFileSync(researchPath, 'utf-8'));
  if (!doc.frontmatter.type) {
    doc.frontmatter.type = 'Research Concept';
  }

  const docHealed = healOrphanOkfFootnotes(doc);
  if (docHealed) {
    fs.writeFileSync(researchPath, serializeOkfDocument(doc), 'utf-8');
  }

  const rawTitleSlug = transliterateNordicAscii(String(doc.frontmatter.title || runId))
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/-\d{10,}$/, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const canonicalTitleSlug = truncateSlugAtWordBoundary(rawTitleSlug, 48, 12, true) || 'research-concept';

  let slug = options?.conceptSlug || '';
  const metaPath = path.join(runDir, 'meta.json');
  if (!slug && fs.existsSync(metaPath)) {
    try {
      const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
      const existingCid = String(meta?.okf?.bundleConceptId || '').trim();
      if (existingCid.startsWith('research/')) {
        const existingSlug = existingCid.slice('research/'.length);
        if (rawTitleSlug.startsWith(existingSlug) && existingSlug !== canonicalTitleSlug) {
          const oldBundleFile = path.join(bundleRoot, 'research', `${existingSlug}.md`);
          const newBundleFile = path.join(bundleRoot, 'research', `${canonicalTitleSlug}.md`);
          if (fs.existsSync(oldBundleFile)) {
            if (!fs.existsSync(newBundleFile)) {
              fs.renameSync(oldBundleFile, newBundleFile);
            } else {
              fs.unlinkSync(oldBundleFile);
            }
          }
          meta.okf.bundleConceptId = `research/${canonicalTitleSlug}`;
          fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2), 'utf-8');
          const logPath = path.join(bundleRoot, 'log.md');
          if (fs.existsSync(logPath)) {
            const logTxt = fs.readFileSync(logPath, 'utf-8');
            const updatedLog = logTxt.replaceAll(
              `/research/${existingSlug}.md`,
              `/research/${canonicalTitleSlug}.md`
            );
            if (updatedLog !== logTxt) {
              fs.writeFileSync(logPath, updatedLog, 'utf-8');
            }
          }
          slug = canonicalTitleSlug;
        } else {
          slug = existingSlug;
        }
      }
    } catch {
      // Ignore unreadable meta.json
    }
  }
  if (!slug) {
    slug = canonicalTitleSlug;
  }

  const conceptId = `research/${slug}`;
  const bundleFilePath = path.join(bundleRoot, `${conceptId}.md`);
  const writeResult = writeBundleConcept(bundleRoot, conceptId, doc, {
    mergeExisting: !options?.allowDestructiveOverwrite,
    allowDestructiveOverwrite: options?.allowDestructiveOverwrite,
  });
  injectBidirectionalBundleLinks(bundleRoot, conceptId, resolvedWorkspace);
  regenerateBundleIndexes(bundleRoot);

  const writtenDoc = fs.existsSync(bundleFilePath)
    ? parseOkfDocument(fs.readFileSync(bundleFilePath, 'utf-8'))
    : doc;
  const tier = getOkfTrustTier(writtenDoc.frontmatter);
  const status = String(writtenDoc.frontmatter.status || 'draft');
  const action = options?.actionOverride || writeResult.action;
  appendBundleLog(
    bundleRoot,
    action,
    conceptId,
    String(writtenDoc.frontmatter.title || slug),
    `run: ${runId}, status: ${status}, trust_tier: ${tier}`
  );

  return {
    conceptId,
    bundleFilePath,
  };
}

export interface OkfBundleFinding {
  path: string;
  line: number | null;
  level: 'error' | 'warning' | 'info';
  code: string;
  message: string;
}

export interface OkfBundleValidationReport {
  bundle: string;
  okf_version: string | null;
  files_checked: number;
  errors: number;
  warnings: number;
  info: number;
  conformant: boolean;
  passed: boolean;
  findings: OkfBundleFinding[];
}

const OKF_KNOWN_CONCEPT_KEYS = new Set([
  'type',
  'title',
  'description',
  'resource',
  'tags',
  'sources',
  'usage_window',
  'generated',
  'verified',
  'status',
  'superseded_by',
  'stale_after',
  'runtime',
  'parameters',
  'computation',
  'executor',
  'attester',
  'timestamp',
]);

const OKF_ACTOR_RE = /^([^\s/:]+\/\S+|[A-Za-z][A-Za-z0-9+.-]*:\S+)$/;
const OKF_DATE_ONLY_HEADING_RE = /^\d{4}-\d{2}-\d{2}$/;
const OKF_SPDX_RE = /^[A-Za-z0-9.+-]+( (AND|OR|WITH) [A-Za-z0-9.+-]+)*$/;
const OKF_SCHEME_RE = /^[a-zA-Z][a-zA-Z0-9+.-]*:/;

/**
 * Zero-dependency TypeScript OKF v0.3 bundle validator (`SPEC.md` §11 & upstream `validate.py` parity).
 * Checks `E002`, `E004`–`E007`, `W101`–`W108`, `W110`, `W115`–`W118`, `W120`, `W122`–`W123`, `W125`, `I201`, `I203`–`I204`, and `X-OKS-W01`–`X-OKS-W02` with zero Python/PyYAML dependency.
 */
export function validateOkfBundle(
  bundleRoot: string,
  options?: { strict?: boolean; now?: Date }
): OkfBundleValidationReport {
  const resolvedBundle = path.resolve(bundleRoot);
  if (!fs.existsSync(resolvedBundle) || !fs.statSync(resolvedBundle).isDirectory()) {
    throw new Error(`OKF bundle directory not found: ${resolvedBundle}`);
  }
  const nowMs = (options?.now ?? new Date()).getTime();
  const findings: OkfBundleFinding[] = [];
  let filesChecked = 0;

  const relDisplay = (filePath: string): string => {
    const r = path.relative(resolvedBundle, filePath).replace(/\\/g, '/');
    return r || '.';
  };
  const addFinding = (
    filePath: string,
    line: number | null,
    level: 'error' | 'warning' | 'info',
    code: string,
    message: string
  ) => {
    findings.push({ path: relDisplay(filePath), line, level, code, message });
  };

  const isInsideBundle = (candidate: string): boolean => {
    const rel = path.relative(resolvedBundle, path.resolve(candidate));
    return Boolean(rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel)));
  };

  const resolveBundlePath = (
    sourceFile: string,
    target: string
  ): 'external' | 'found' | 'missing' => {
    if (OKF_SCHEME_RE.test(target) || target.startsWith('//')) {
      return 'external';
    }
    const rawClean = target.split('#')[0].split('?')[0];
    let clean = rawClean;
    try {
      clean = decodeURIComponent(rawClean);
    } catch {
      clean = rawClean;
    }
    if (!clean) return 'found';
    const base = clean.startsWith('/') ? resolvedBundle : path.dirname(sourceFile);
    const candidate = path.resolve(base, clean.replace(/^\/+/, ''));
    if (!isInsideBundle(candidate)) return 'external';
    return fs.existsSync(candidate) ? 'found' : 'missing';
  };

  const rootIndexPath = path.join(resolvedBundle, 'index.md');
  let okfVersion: string | null = null;
  if (!fs.existsSync(rootIndexPath) || !fs.statSync(rootIndexPath).isFile()) {
    addFinding(
      resolvedBundle,
      null,
      'warning',
      'W125',
      'add a bundle-root index.md with okf_version: "0.3" (section 8.1)'
    );
  } else {
    try {
      const rootDoc = parseOkfDocument(fs.readFileSync(rootIndexPath, 'utf-8'));
      if (rootDoc.hasFrontmatter && rootDoc.frontmatter?.okf_version !== undefined) {
        okfVersion = String(rootDoc.frontmatter.okf_version);
      }
    } catch {
      okfVersion = null;
    }
  }

  const mdPaths: string[] = [];
  const walkMd = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith('.')) continue;
      const full = path.join(dir, entry.name);
      let resolvedReal = full;
      try {
        resolvedReal = fs.realpathSync(full);
      } catch {
        resolvedReal = full;
      }
      if (!isInsideBundle(resolvedReal)) continue;
      if (entry.isDirectory()) {
        walkMd(full);
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        mdPaths.push(full);
      }
    }
  };
  walkMd(resolvedBundle);
  mdPaths.sort((a, b) => a.localeCompare(b));

  const checkActor = (filePath: string, field: string, val: unknown) => {
    if (typeof val !== 'string' || !OKF_ACTOR_RE.test(val)) {
      addFinding(
        filePath,
        1,
        'warning',
        'W103',
        `${field} is an actor: <producer>/<version> or <scheme>:<id>, such as human:<id> (section 7); found ${JSON.stringify(val)}`
      );
    }
  };

  const checkTimestamp = (filePath: string, field: string, val: unknown): number | undefined => {
    const ms = parseOkfTimestampMs(val);
    if (ms === undefined) {
      addFinding(
        filePath,
        1,
        'warning',
        'W101',
        `${field} is an RFC 3339 date-time with an offset, such as 2026-06-30T14:00:00Z, or a date such as 2026-06-30 (section 5); found ${JSON.stringify(val)}`
      );
    }
    return ms;
  };

  const checkPathField = (filePath: string, field: string, val: unknown) => {
    if (typeof val !== 'string') return;
    if (resolveBundlePath(filePath, val) === 'missing') {
      addFinding(
        filePath,
        1,
        'warning',
        'W116',
        `${field} ${JSON.stringify(val)} does not resolve to a file in the bundle (section 6.2)`
      );
    }
  };

  for (const mdFile of mdPaths) {
    filesChecked++;
    const rawText = fs.readFileSync(mdFile, 'utf-8').replace(/^\uFEFF/, '');
    const baseName = path.basename(mdFile);
    const startsWithFm = /^---\r?$/m.test(rawText.split(/\r?\n/)[0] || '');

    if (baseName === 'index.md') {
      if (path.dirname(mdFile) !== resolvedBundle) {
        if (startsWithFm) {
          addFinding(
            mdFile,
            1,
            'error',
            'E004',
            'an index.md below the bundle root has no frontmatter (section 8)'
          );
        }
        continue;
      }
      if (!startsWithFm) {
        addFinding(
          mdFile,
          1,
          'warning',
          'W125',
          'give the root index.md frontmatter with okf_version: "0.3" (section 8.1)'
        );
        continue;
      }
      let doc: OKFDocument;
      try {
        doc = parseOkfDocument(rawText);
      } catch (err: any) {
        const msg = String(err?.message || err);
        const dupMatch = msg.match(/^Duplicate YAML frontmatter key:\s*(.+)$/);
        if (dupMatch) {
          addFinding(
            mdFile,
            1,
            'error',
            'E007',
            `frontmatter repeats the key ${JSON.stringify(dupMatch[1])}; keys must be unique (section 4)`
          );
        } else {
          addFinding(mdFile, 1, 'error', 'E002', `frontmatter does not parse as a YAML mapping: ${msg} (section 4)`);
        }
        continue;
      }
      const ver = doc.frontmatter.okf_version;
      if (isOkfBlank(ver)) {
        addFinding(mdFile, 1, 'warning', 'W125', 'add okf_version: "0.3" to the root index.md (section 8.1)');
      } else if (typeof ver !== 'string') {
        addFinding(
          mdFile,
          1,
          'warning',
          'W117',
          `quote okf_version as a string, for example "0.3" (section 8.1); found ${JSON.stringify(ver)}`
        );
      }
      const lic = doc.frontmatter.license;
      if (
        typeof lic === 'string' &&
        !OKF_SPDX_RE.test(lic) &&
        resolveBundlePath(mdFile, lic) === 'missing'
      ) {
        addFinding(
          mdFile,
          1,
          'warning',
          'W116',
          `license ${JSON.stringify(lic)} is not an SPDX expression or a file in the bundle (section 8.1)`
        );
      }
      continue;
    }

    if (baseName === 'log.md') {
      if (startsWithFm) {
        addFinding(mdFile, 1, 'error', 'E006', 'log.md has no frontmatter (section 9)');
      }
      const dates: Array<{ line: number; date: string }> = [];
      const lines = rawText.split(/\r?\n/);
      lines.forEach((lineText, idx) => {
        if (lineText.startsWith('## ')) {
          const heading = lineText.slice(3).trim();
          if (OKF_DATE_ONLY_HEADING_RE.test(heading)) {
            dates.push({ line: idx + 1, date: heading });
          } else {
            addFinding(
              mdFile,
              idx + 1,
              'error',
              'E005',
              `a log.md date heading must be YYYY-MM-DD (section 9); found ${JSON.stringify(heading)}`
            );
          }
        }
      });
      for (let i = 0; i + 1 < dates.length; i++) {
        if (dates[i + 1].date > dates[i].date) {
          addFinding(
            mdFile,
            dates[i + 1].line,
            'warning',
            'W118',
            `log.md puts the newest date first (section 9); ${dates[i + 1].date} follows ${dates[i].date}`
          );
        }
      }
      continue;
    }

    // Concept Markdown file check
    if (!startsWithFm) {
      addFinding(mdFile, 1, 'warning', 'W120', 'not a concept: the file has no frontmatter (section 3.2)');
      continue;
    }
    let doc: OKFDocument;
    try {
      doc = parseOkfDocument(rawText);
    } catch (err: any) {
      const msg = String(err?.message || err);
      const dupMatch = msg.match(/^Duplicate YAML frontmatter key:\s*(.+)$/);
      if (dupMatch) {
        addFinding(
          mdFile,
          1,
          'error',
          'E007',
          `frontmatter repeats the key ${JSON.stringify(dupMatch[1])}; keys must be unique (section 4)`
        );
      } else {
        addFinding(mdFile, 1, 'error', 'E002', `frontmatter does not parse as a YAML mapping: ${msg} (section 4)`);
      }
      continue;
    }
    const meta = doc.frontmatter || {};
    if (typeof meta.type !== 'string' || !meta.type.trim()) {
      addFinding(mdFile, 1, 'warning', 'W120', 'not a concept: the frontmatter has no non-empty type (section 3.2)');
      continue;
    }

    for (const k of ['type', 'title', 'description', 'status']) {
      if (meta[k] !== undefined && meta[k] !== null && typeof meta[k] !== 'string') {
        addFinding(mdFile, 1, 'warning', 'W117', `quote ${k}: it does not parse as a string (section 4)`);
      }
    }
    const rawTagsVal: unknown = meta.tags;
    if (typeof rawTagsVal === 'string' && rawTagsVal.trim()) {
      addFinding(mdFile, 1, 'warning', 'W110', 'write tags as a YAML list (sections 4.1 and 11.2)');
    } else if (rawTagsVal !== undefined && rawTagsVal !== null && !Array.isArray(rawTagsVal)) {
      addFinding(mdFile, 1, 'warning', 'W110', 'write tags as a YAML list of strings (section 4.1)');
    }

    if (!isOkfBlank(meta.status) && !['draft', 'stable', 'deprecated'].includes(String(meta.status))) {
      addFinding(
        mdFile,
        1,
        'warning',
        'W105',
        `status is draft, stable, or deprecated; consumers treat ${JSON.stringify(meta.status)} as not current (section 5.4)`
      );
    }
    if (!isOkfBlank(meta.superseded_by)) {
      if (meta.status !== 'deprecated') {
        addFinding(mdFile, 1, 'warning', 'W123', 'superseded_by has a meaning only with status: deprecated (section 5.4)');
      }
      checkPathField(mdFile, 'superseded_by', meta.superseded_by);
    }

    let generatedMs: number | undefined;
    if (!isOkfBlank(meta.generated)) {
      if (typeof meta.generated !== 'object' || Array.isArray(meta.generated) || isOkfBlank(meta.generated.by)) {
        addFinding(mdFile, 1, 'warning', 'W102', 'generated is a mapping with a by field (section 5.2)');
      } else {
        checkActor(mdFile, 'generated.by', meta.generated.by);
        if (!isOkfBlank(meta.generated.at)) {
          generatedMs = checkTimestamp(mdFile, 'generated.at', meta.generated.at);
          if (generatedMs !== undefined && OKF_DATE_ONLY_HEADING_RE.test(String(meta.generated.at))) {
            addFinding(
              mdFile,
              1,
              'warning',
              'W122',
              'write generated.at as a date-time, because consumers compare it with verified[].at (section 5)'
            );
          }
        }
      }
    }

    const verifiedList = isOkfBlank(meta.verified)
      ? []
      : Array.isArray(meta.verified)
        ? meta.verified
        : [meta.verified];
    const verifiedTimes: number[] = [];
    verifiedList.forEach((ev: any, idx: number) => {
      const fld = `verified[${idx}]`;
      if (!ev || typeof ev !== 'object' || Array.isArray(ev) || isOkfBlank(ev.by) || isOkfBlank(ev.at)) {
        addFinding(mdFile, 1, 'warning', 'W104', `${fld} needs by and at; consumers ignore it (section 5.2)`);
        return;
      }
      checkActor(mdFile, `${fld}.by`, ev.by);
      const evMs = checkTimestamp(mdFile, `${fld}.at`, ev.at);
      if (evMs !== undefined) {
        verifiedTimes.push(evMs);
        if (OKF_DATE_ONLY_HEADING_RE.test(String(ev.at))) {
          addFinding(
            mdFile,
            1,
            'warning',
            'W122',
            `write ${fld}.at as a date-time, because consumers compare it with generated.at (section 5)`
          );
        }
      }
    });
    if (
      verifiedTimes.length > 0 &&
      generatedMs !== undefined &&
      verifiedTimes.every((t) => t < generatedMs!)
    ) {
      addFinding(
        mdFile,
        1,
        'info',
        'I204',
        'no verification is current: each verified event is older than generated.at, so consumers read the concept as unverified (section 5.3)'
      );
    }

    const sourceIds = new Set<string>();
    const rawSources = isOkfBlank(meta.sources)
      ? []
      : Array.isArray(meta.sources)
        ? meta.sources
        : [meta.sources];
    rawSources.forEach((entry: any, idx: number) => {
      const fld = `sources[${idx}]`;
      if (!entry || typeof entry !== 'object' || Array.isArray(entry) || isOkfBlank(entry.resource)) {
        addFinding(mdFile, 1, 'warning', 'W106', `${fld} needs a resource; consumers ignore it (section 5.1)`);
        return;
      }
      if (!isOkfBlank(entry.id)) {
        const sid = String(entry.id);
        if (sourceIds.has(sid)) {
          addFinding(mdFile, 1, 'warning', 'W107', `${fld}.id ${JSON.stringify(sid)} is not unique (section 5.1)`);
        }
        sourceIds.add(sid);
      }
      if (!isOkfBlank(entry.author)) {
        checkActor(mdFile, `${fld}.author`, entry.author);
      }
      if (!isOkfBlank(entry.last_modified)) {
        checkTimestamp(mdFile, `${fld}.last_modified`, entry.last_modified);
      }
      if (typeof entry.resource === 'string' && !/\s/.test(entry.resource)) {
        checkPathField(mdFile, `${fld}.resource`, entry.resource);
      }
    });

    if (!isOkfBlank(meta.stale_after)) {
      const staleMs = parseOkfTimestampMs(meta.stale_after);
      if (staleMs === undefined) {
        addFinding(
          mdFile,
          1,
          'warning',
          'W101',
          `stale_after does not parse, so consumers never treat the concept as fresh (section 5.5); found ${JSON.stringify(meta.stale_after)}`
        );
      } else if (nowMs >= staleMs) {
        addFinding(
          mdFile,
          1,
          'info',
          'I201',
          `the concept is stale: stale_after ${meta.stale_after} has passed (section 5.5)`
        );
      }
    }

    if (!isOkfBlank(meta.resource)) {
      checkPathField(mdFile, 'resource', meta.resource);
    }

    // Prose body footnotes & links (outside fenced/indented/inline code)
    let fence: string | null = null;
    const reportedFns = new Set<string>();
    const rawLines = rawText.split(/\r?\n/);
    let closeFmIdx = 1;
    while (closeFmIdx < rawLines.length && rawLines[closeFmIdx].trim() !== '---') {
      closeFmIdx++;
    }
    const bodyStartLine = closeFmIdx + 2;
    const bodyLines = (doc.body || '').split(/\r?\n/);
    bodyLines.forEach((bLine, offset) => {
      const stripped = bLine.trimStart();
      if (fence === null && (stripped.startsWith('```') || stripped.startsWith('~~~'))) {
        fence = stripped.slice(0, 3);
        return;
      }
      if (fence !== null) {
        if (stripped.startsWith(fence)) fence = null;
        return;
      }
      if (bLine.startsWith('    ') || bLine.startsWith('\t')) return;
      if (/^\[\^[^\]\s]+\]:/.test(bLine.trim())) return;
      const proseClean = bLine.replace(/`[^`]*`/g, '');
      const lineNum = bodyStartLine + offset;
      for (const fm of proseClean.matchAll(/\[\^([^\]\s]+)\]/g)) {
        const label = fm[1];
        if (!sourceIds.has(label) && !reportedFns.has(label)) {
          reportedFns.add(label);
          addFinding(
            mdFile,
            lineNum,
            'warning',
            'W108',
            `footnote [^${label}] has no sources entry with that id (section 5.1)`
          );
        }
      }
      for (const lm of proseClean.matchAll(/(?<!!)\[[^\]]*\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)/g)) {
        const target = lm[1];
        if (target.startsWith('#')) continue;
        if (resolveBundlePath(mdFile, target) === 'missing') {
          addFinding(
            mdFile,
            lineNum,
            'warning',
            'W115',
            `link target ${JSON.stringify(target)} is not in the bundle (section 6.1)`
          );
        }
      }
    });

    const refIntegrity = inspectReferenceExtractionIntegrity({
      relPath: path.relative(resolvedBundle, mdFile),
      title: isOkfBlank(meta.title) ? '' : String(meta.title),
      type: isOkfBlank(meta.type) ? '' : String(meta.type),
      body: doc.body,
    });
    if (refIntegrity.truncatedMidSentence) {
      addFinding(
        mdFile,
        Math.max(1, rawLines.length),
        'warning',
        'X-OKS-W01',
        `reference body ends mid-sentence ("…${refIntegrity.tailSnippet || ''}") — extract complete units instead of slicing raw text`
      );
    }
    if (refIntegrity.missingTitleTarget) {
      addFinding(
        mdFile,
        1,
        'warning',
        'X-OKS-W02',
        `reference title scopes "${refIntegrity.missingTitleTarget}", which never appears in the extracted body (verify element selectors rather than dumping preambles or tables of contents)`
      );
    }

    const unknownKeys = Object.keys(meta)
      .filter((k) => !OKF_KNOWN_CONCEPT_KEYS.has(k) && !k.startsWith('x-'))
      .sort();
    if (unknownKeys.length > 0) {
      addFinding(
        mdFile,
        1,
        'info',
        'I203',
        `extension keys without the x- prefix: ${unknownKeys.join(', ')} (section 4.1)`
      );
    }
  }

  const errors = findings.filter((f) => f.level === 'error').length;
  const warnings = findings.filter((f) => f.level === 'warning').length;
  const info = findings.filter((f) => f.level === 'info').length;
  const conformant = errors === 0;
  const passed = errors === 0 && (!options?.strict || warnings === 0);

  return {
    bundle: resolvedBundle,
    okf_version: okfVersion,
    files_checked: filesChecked,
    errors,
    warnings,
    info,
    conformant,
    passed,
    findings,
  };
}

export interface ReferenceExtractionIntegrityResult {
  truncatedMidSentence: boolean;
  tailSnippet?: string;
  missingTitleTarget?: string;
}

/**
 * Audits an extracted `references/*.md` (or `type: Reference`) concept body for silent scraper
 * truncation defects using domain- and language-agnostic structural invariants:
 * - `truncatedMidSentence` (`X-OKS-W01`): body (`>= 500` chars) ends on a non-bullet/non-heading/non-table
 *   prose line without terminal punctuation (`rawText.slice(0, maxChars)` mid-word/mid-sentence cut).
 * - `missingTitleTarget` (`X-OKS-W02`): a delimiter- or parenthetical-scoped qualifier in `title`
 *   names a numbered sub-unit (`<Label> <N>` or `<Symbol><N>`) that never appears in the body or headings.
 */
export function inspectReferenceExtractionIntegrity(input: {
  relPath?: string;
  title?: string;
  type?: string;
  body?: string;
}): ReferenceExtractionIntegrityResult {
  const normRel = String(input.relPath || '').replace(/\\/g, '/').replace(/^\/+/, '');
  const baseName = path.posix.basename(normRel).toLowerCase();
  if (baseName === 'index.md' || baseName === 'log.md') {
    return { truncatedMidSentence: false };
  }
  const isRefFile =
    normRel.startsWith('references/') ||
    String(input.type || '').trim().toLowerCase() === 'reference';
  if (!isRefFile) {
    return { truncatedMidSentence: false };
  }

  let core = String(input.body || '').replace(
    /<!-- okf:adjudications-start -->[\s\S]*?<!-- okf:adjudications-end -->/g,
    ''
  );
  const rawCoreLines = core.split(/\r?\n/);
  const relHeadingIdx = findTrailingRelatedConceptsHeadingIndex(rawCoreLines);
  if (relHeadingIdx !== -1) {
    core = rawCoreLines.slice(0, relHeadingIdx).join('\n');
  }
  core = core
    .replace(/^\s*\[\^[^\]\s]+\]:.*$/gm, '')
    .replace(/^\s*#\s+[^\r\n]+\r?\n*/m, '')
    .replace(/^(?:\s*>\s*[^\r\n]*\r?\n)+/m, '')
    .trim();

  let truncatedMidSentence = false;
  let tailSnippet: string | undefined;

  if (core.length >= 500) {
    const nonEmptyLines = core
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    const lastLine = nonEmptyLines[nonEmptyLines.length - 1] || '';
    const isStructuralLine =
      /^#{1,6}\s/.test(lastLine) ||
      /^(?:[-*+]|\d+[.)])\s+/.test(lastLine) ||
      /^\|/.test(lastLine) ||
      /^(?:```|~~~)/.test(lastLine) ||
      />$/.test(lastLine);
    const hasTerminalPunct = /[.!?…:;)\]»"”'’`>}|。！？）】」』]\s*$/u.test(lastLine);
    if (lastLine.length >= 16 && !isStructuralLine && !hasTerminalPunct) {
      truncatedMidSentence = true;
      tailSnippet = lastLine.slice(-60);
    }
  }

  let missingTitleTarget: string | undefined;
  const rawTitle = String(input.title || '').trim();
  if (rawTitle && core.length >= 120) {
    const dashOrColonScope = rawTitle.match(/(?:\s+[–—-]\s+|:\s+|\|\s+)(.+)$/)?.[1] || '';
    const parenScope = !dashOrColonScope ? rawTitle.match(/\(([^()]+)\)\s*$/)?.[1] || '' : '';
    const scopeSegment = (dashOrColonScope || parenScope).trim();
    if (scopeSegment) {
      let matchedLabel = '';
      let targetPrefix = '';
      let targetNum = '';
      for (const m of scopeSegment.matchAll(
        /(?<![\p{L}\p{N}])([\p{L}.]{1,20})\s+(\d+[A-Za-z]?)(?![\p{L}\p{N}]|[.,]\d)/gu
      )) {
        const word = m[1];
        const num = m[2];
        if (/^[\p{Lu}]{2,}$/u.test(word) || /^(?:18|19|20|21)\d{2}$/.test(num)) continue;
        matchedLabel = `${word} ${num}`;
        targetPrefix = word;
        targetNum = num;
        break;
      }
      if (!targetNum) {
        const symMatch = scopeSegment.match(
          /([^\p{L}\p{N}\s()[\]–—,:;|/"'«»`]{1,3})\s*(\d+(?:-\d+)?)(?![\p{L}\p{N}]|[.,]\d)/u
        );
        if (symMatch) {
          matchedLabel = `${symMatch[1]} ${symMatch[2]}`.replace(/\s+/g, ' ').trim();
          targetPrefix = symMatch[1];
          targetNum = symMatch[2];
        }
      }
      if (targetNum) {
        const escPrefix = targetPrefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const escNum = targetNum.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const exactPhraseRe = new RegExp(`${escPrefix}\\s*${escNum}(?![\\p{L}\\p{N}])`, 'iu');
        const headingDesignatorRe = new RegExp(
          `^\\s*#{1,6}\\s+[^\\r\\n]*?(?<![\\p{L}\\p{N}])${escNum}(?:[-.]\\d+|(?![\\p{L}\\p{N}]))`,
          'imu'
        );
        if (!exactPhraseRe.test(core) && !headingDesignatorRe.test(core)) {
          missingTitleTarget = matchedLabel;
        }
      }
    }
  }

  return {
    truncatedMidSentence,
    ...(tailSnippet ? { tailSnippet } : {}),
    ...(missingTitleTarget ? { missingTitleTarget } : {}),
  };
}
