import * as fs from 'fs';
import * as path from 'path';

import { formatLocaleTemplate, inferBcp47LanguageCode, loadWorkspaceLocale } from '../interactions/index.js';
import { type OKFActorEvent, type OKFDocument, type OKFFrontmatter, type OKFSource, RESERVED_OKF_FILENAMES, type TrustTier, decodeHtmlEntities, enrichBareDomainSourceTitle, getOkfTrustTier, healOrphanOkfFootnotes, inferSourceMimeTypeFromUrl, isOkfBlank, isOkfConceptDocument, isOkfStale, normalizeCanonicalSourceUrl, normalizeHttpMimeType, normalizeOkfTags, normalizeVerified, parseOkfDocument, parseValidIsoTimestamp, serializeOkfDocument, shouldUpgradeSourceTitle } from '../okf/index.js';
import { OKF_VIZ_CSS, OKF_VIZ_JS } from './client-assets.js';

const OKF_TYPE_PALETTE: Record<string, string> = {
  'Research Concept': '#2563eb',
  'BigQuery Dataset': '#8b5cf6',
  'BigQuery Table': '#3b82f6',
  Reference: '#10b981',
  Metric: '#0d9488',
  Playbook: '#d97706',
  'Attested Computation': '#7c3aed',
};
const OKF_FALLBACK_TYPE_COLORS: readonly string[] = [
  '#0284c7',
  '#e11d48',
  '#059669',
  '#ea580c',
  '#4f46e5',
  '#0891b2',
  '#c026d3',
  '#65a30d',
  '#dc2626',
  '#9333ea',
  '#ca8a04',
  '#0f766e',
];
const DEFAULT_OKF_NODE_COLOR = '#64748b';

export function getOkfTypeColor(type?: string): string {
  const cleanType = String(type || '').trim();
  if (!cleanType || cleanType.toLowerCase() === 'unknown') {
    return DEFAULT_OKF_NODE_COLOR;
  }
  if (OKF_TYPE_PALETTE[cleanType]) {
    return OKF_TYPE_PALETTE[cleanType];
  }
  let hash = 2166136261;
  for (let i = 0; i < cleanType.length; i++) {
    hash ^= cleanType.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return OKF_FALLBACK_TYPE_COLORS[(hash >>> 0) % OKF_FALLBACK_TYPE_COLORS.length];
}

export interface OKFConceptNode {
  id: string;
  type: string;
  title: string;
  description: string;
  resource: string;
  tags: string[];
  body: string;
  status: string;
  superseded_by?: string;
  generated: OKFActorEvent | Record<string, any>;
  verified: OKFActorEvent[];
  stale_after: string;
  sources: OKFSource[];
  trust_tier: TrustTier;
  stale: boolean;
  links_to: string[];
}

function resolveBundleLinkTarget(
  rawTarget: string,
  docDir: string,
  bundleRootResolved: string
): string | null {
  const trimmed = String(rawTarget || '').trim();
  if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('//') || /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)) {
    return null;
  }
  const withoutFragQuery = trimmed.split('#')[0].split('?')[0].trim();
  if (!withoutFragQuery) {
    return null;
  }
  let cleaned = withoutFragQuery;
  try {
    cleaned = decodeURIComponent(withoutFragQuery);
  } catch {
    cleaned = withoutFragQuery;
  }

  // Pure OKF v0.3 §6 path resolution: leading `/` resolves from bundleRoot; all other relative paths resolve strictly from docDir.
  const resolvedAbs = cleaned.startsWith('/')
    ? path.resolve(bundleRootResolved, cleaned.replace(/^\/+/, ''))
    : path.resolve(docDir, cleaned);

  const relToBundle = path.relative(bundleRootResolved, resolvedAbs).replace(/\\/g, '/');
  if (!relToBundle || relToBundle.startsWith('..') || path.isAbsolute(relToBundle)) {
    return null;
  }
  if (relToBundle.split('/').some((seg) => seg.startsWith('.'))) {
    return null;
  }

  const withoutExt = relToBundle.replace(/\.md$/i, '');
  const baseName = path.posix.basename(`${withoutExt}.md`);
  if (RESERVED_OKF_FILENAMES.has(baseName)) {
    return null;
  }
  return withoutExt;
}

function extractProseMarkdownLinkTargets(body: string): string[] {
  const targets: string[] = [];
  let fencePrefix: string | null = null;
  const linkRe = /(?<!!)\[[^\]]*\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)/g;
  for (const rawLine of String(body || '').split(/\r?\n/)) {
    const stripped = rawLine.trimStart();
    if (fencePrefix === null && (stripped.startsWith('```') || stripped.startsWith('~~~'))) {
      fencePrefix = stripped.slice(0, 3);
      continue;
    }
    if (fencePrefix !== null) {
      if (stripped.startsWith(fencePrefix)) {
        fencePrefix = null;
      }
      continue;
    }
    if (rawLine.startsWith('    ') || rawLine.startsWith('\t')) {
      continue;
    }
    const proseWithoutInlineCode = rawLine.replace(/`[^`]*`/g, '');
    for (const m of proseWithoutInlineCode.matchAll(linkRe)) {
      if (m[1]) targets.push(m[1]);
    }
  }
  return targets;
}

/**
 * Extracts all internal concept links from prose Markdown links (`SPEC.md` §6.1)
 * and path-valued frontmatter fields (`resource`, `superseded_by`, `sources[].resource`,
 * `computation`, `executor.resource`, `attester.resource` per `SPEC.md` §6.2 & §6.4).
 */
export function extractConceptLinks(
  body: string,
  frontmatter: OKFFrontmatter,
  docDir: string,
  bundleRoot: string
): string[] {
  const bundleRootResolved = path.resolve(bundleRoot);
  const out: string[] = [];
  const seen = new Set<string>();

  const addCandidate = (raw: string) => {
    const resolved = resolveBundleLinkTarget(raw, docDir, bundleRootResolved);
    if (resolved && !seen.has(resolved)) {
      seen.add(resolved);
      out.push(resolved);
    }
  };

  for (const linkTarget of extractProseMarkdownLinkTargets(body)) {
    addCandidate(linkTarget);
  }

  const pathCandidates: string[] = [];
  if (typeof frontmatter?.resource === 'string') pathCandidates.push(frontmatter.resource);
  if (typeof frontmatter?.superseded_by === 'string') pathCandidates.push(frontmatter.superseded_by);
  if (typeof frontmatter?.computation === 'string') pathCandidates.push(frontmatter.computation);
  if (typeof frontmatter?.executor?.resource === 'string') {
    pathCandidates.push(frontmatter.executor.resource);
  }
  if (typeof frontmatter?.attester?.resource === 'string') {
    pathCandidates.push(frontmatter.attester.resource);
  }
  const rawSources = frontmatter?.sources;
  const sourceEntries = Array.isArray(rawSources)
    ? rawSources
    : rawSources && typeof rawSources === 'object'
      ? [rawSources]
      : [];
  for (const s of sourceEntries) {
    if (s && typeof s.resource === 'string') {
      pathCandidates.push(s.resource);
    }
  }

  for (const candidate of pathCandidates) {
    if (candidate && !/\s/.test(candidate.trim())) {
      addCandidate(candidate);
    }
  }

  return out;
}

/**
 * Walks an OKF v0.3 bundle directory and returns all parsed Concept nodes
 * (excluding `index.md`, `log.md`, `.`-prefixed paths, and `.md` files without a non-empty `type` per `SPEC.md` §3.2).
 */
export function walkBundleConcepts(bundleRoot: string): OKFConceptNode[] {
  const resolvedRoot = path.resolve(bundleRoot);
  if (!fs.existsSync(resolvedRoot)) return [];

  const mdFiles: string[] = [];
  const collectMd = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith('.')) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        collectMd(full);
      } else if (
        entry.isFile() &&
        entry.name.endsWith('.md') &&
        !RESERVED_OKF_FILENAMES.has(entry.name)
      ) {
        mdFiles.push(full);
      }
    }
  };
  collectMd(resolvedRoot);
  mdFiles.sort((a, b) => a.localeCompare(b));

  const concepts: OKFConceptNode[] = [];
  for (const mdPath of mdFiles) {
    const conceptId = path
      .relative(resolvedRoot, mdPath)
      .replace(/\\/g, '/')
      .replace(/\.md$/i, '');
    let doc: OKFDocument;
    try {
      doc = parseOkfDocument(fs.readFileSync(mdPath, 'utf-8'));
    } catch {
      continue;
    }
    if (!isOkfConceptDocument(doc)) {
      continue;
    }

    const isImmutableReference =
      conceptId.startsWith('references/') ||
      (String(doc.frontmatter?.type || '').trim().toLowerCase() === 'reference' &&
        getOkfTrustTier(doc.frontmatter) === 'machine-confirmed');
    if (!isImmutableReference && healOrphanOkfFootnotes(doc)) {
      try {
        fs.writeFileSync(mdPath, serializeOkfDocument(doc), 'utf-8');
      } catch {
        // Ignore read-only bundle paths
      }
    }

    const fm = doc.frontmatter || {};
    const tags = normalizeOkfTags(fm.tags);
    const generated = fm.generated && typeof fm.generated === 'object' ? fm.generated : {};
    const genAtFallback = parseValidIsoTimestamp((generated as any)?.at);
    const rawSources = fm.sources;
    const rawSourcesList: OKFSource[] = Array.isArray(rawSources)
      ? rawSources.filter((s) => s && typeof s === 'object')
      : rawSources && typeof rawSources === 'object'
        ? [rawSources as OKFSource]
        : [];
    if (
      rawSourcesList.length === 0 &&
      typeof fm.resource === 'string' &&
      /^https?:\/\//i.test(fm.resource.trim())
    ) {
      rawSourcesList.push({
        id: path.posix.basename(conceptId),
        resource: fm.resource.trim(),
        title: String(fm.title || conceptId),
        ...(typeof fm.mime_type === 'string' ? { mime_type: fm.mime_type } : {}),
        ...(typeof fm.retrieved_at === 'string' ? { retrieved_at: fm.retrieved_at } : {}),
        ...(typeof fm.last_modified === 'string' ? { last_modified: fm.last_modified } : {}),
      });
    }
    const normalizedBody = doc.body || '';
    const sources: OKFSource[] = rawSourcesList.map((s) => {
      const validRetrieved = parseValidIsoTimestamp(s.retrieved_at) || genAtFallback;
      const validLm = parseValidIsoTimestamp(s.last_modified);
      const validMime =
        normalizeHttpMimeType(s.mime_type) ||
        (s.resource ? inferSourceMimeTypeFromUrl(String(s.resource)) : undefined);
      const enrichedTitle = s.resource
        ? enrichBareDomainSourceTitle(s.title, String(s.resource))
        : s.title;
      const nextSrc: OKFSource = {
        ...s,
        ...(enrichedTitle ? { title: enrichedTitle } : {}),
        ...(validMime ? { mime_type: validMime } : {}),
        ...(validRetrieved ? { retrieved_at: validRetrieved } : {}),
        ...(validLm ? { last_modified: validLm } : {}),
      };
      if (!validMime && 'mime_type' in nextSrc) {
        delete nextSrc.mime_type;
      }
      if (!validRetrieved && 'retrieved_at' in nextSrc) {
        delete nextSrc.retrieved_at;
      }
      if (!validLm && 'last_modified' in nextSrc) {
        delete nextSrc.last_modified;
      }
      return nextSrc;
    });

    concepts.push({
      id: conceptId,
      type: String(fm.type).trim(),
      title: String(fm.title || conceptId),
      description: String(fm.description || ''),
      resource: String(fm.resource || ''),
      tags,
      body: normalizedBody,
      status: isOkfBlank(fm.status) ? 'stable' : String(fm.status).trim(),
      ...(typeof fm.superseded_by === 'string' && fm.superseded_by.trim()
        ? { superseded_by: fm.superseded_by.trim() }
        : {}),
      generated,
      verified: normalizeVerified(fm),
      stale_after: isOkfBlank(fm.stale_after) ? '' : String(fm.stale_after),
      sources,
      trust_tier: getOkfTrustTier(fm),
      stale: isOkfStale(fm),
      links_to: extractConceptLinks(doc.body || '', fm, path.dirname(mdPath), resolvedRoot),
    });
  }

  return concepts;
}

/**
 * Infers the primary ISO 639-1 language code (`en`, `de`, `fr`, `es`, `sv`, `da`, `no`, `ja`, etc.)
 * across 20+ world scripts and languages using `inferBcp47LanguageCode()`.
 */
export function detectIcmLanguage(text: string): string {
  const bcp = inferBcp47LanguageCode(text);
  const base = bcp.split('-')[0].toLowerCase();
  if (base === 'nb' || base === 'nn') return 'no';
  return base || 'en';
}

/**
 * Auto-detects whether Stage 2 represents a training/course pipeline ('course')
 * or an analytical/investment/decision/memo pipeline ('analysis').
 */
export function detectIcmDomainMode(
  rawStage2: Record<string, unknown> | null | undefined,
  quizCount: number,
  textSample?: string
): 'course' | 'analysis' {
  if (rawStage2 && typeof rawStage2 === 'object') {
    if (
      Array.isArray(rawStage2.pillars) ||
      Array.isArray(rawStage2.analysisPillars) ||
      Array.isArray(rawStage2.stressTests) ||
      typeof rawStage2.investmentThesis === 'string' ||
      typeof rawStage2.memoBody === 'string' ||
      typeof rawStage2.reportTitle === 'string' ||
      typeof rawStage2.memoTitle === 'string' ||
      typeof rawStage2.verdict === 'string'
    ) {
      return 'analysis';
    }
    if (
      Array.isArray(rawStage2.trainingModules) ||
      Array.isArray(rawStage2.lessons) ||
      typeof rawStage2.courseTitle === 'string' ||
      Array.isArray(rawStage2.learningObjectives)
    ) {
      return 'course';
    }
  }
  const combinedSample = `${JSON.stringify(rawStage2 || {})} ${textSample || ''}`;
  const hasAnalysisSignals =
    /\b(investment\s+committee|equity\s+research|valuation\s+pillar|sum-of-the-parts|sotp|dcf\b|ev\/ebitda|buy\/hold\/sell|due\s+diligence|pre-ipo|institutional\s+equity|capital\s+allocation)\b/i.test(
      combinedSample
    );
  const hasCourseSignals =
    /\b(training\s+course|certification\s+course|curriculum|syllabus|lesson\s+plan)\b/i.test(
      combinedSample
    );
  if (hasAnalysisSignals && !hasCourseSignals) {
    return 'analysis';
  }
  if (quizCount === 0 && !hasCourseSignals) {
    return 'analysis';
  }
  return 'course';
}

export function extractLastUrlPathSlug(rawUrl: string): string {
  try {
    const u = new URL(String(rawUrl || '').trim());
    const segs = u.pathname
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
          s.length > 1 &&
          !/^(?:index|default)\.(?:html?|aspx?|php)$/i.test(s) &&
          !/^(?:id\d+|\d+|_f|p\d+|no|nb|nn|en|globalassets|contentassets)$/i.test(s)
      );
    if (segs.length === 0) return '';
    return segs[segs.length - 1].replace(/\.(?:pdf|html?|aspx?|php|md|docx?)$/i, '');
  } catch {
    return '';
  }
}

/**
 * Generates a single-file interactive OKF v0.3 knowledge graph explorer (`viz.html`)
 * powered by Cytoscape.js and Marked, with unified `/` and file-relative link resolution and trust badges.
 */
export function generateBundleVisualization(
  bundleRoot: string = './workspace/bundle',
  outPath?: string,
  options?: { bundleName?: string }
): {
  concepts: number;
  nodes: number;
  edges: number;
  bytes: number;
  outputPath: string;
} {
  const resolvedRoot = path.resolve(bundleRoot);
  if (!fs.existsSync(resolvedRoot) || !fs.statSync(resolvedRoot).isDirectory()) {
    throw new Error(`OKF Bundle directory not found: ${resolvedRoot}`);
  }

  const resolvedOutPath = path.resolve(outPath || path.join(resolvedRoot, 'viz.html'));
  const concepts = walkBundleConcepts(resolvedRoot);
  const conceptIds = new Set(concepts.map((c) => c.id));
  const locale = loadWorkspaceLocale(resolvedRoot);
  const detectedLang = detectIcmLanguage(
    concepts.map((c) => `${c.title || ''} ${c.description || ''} ${c.body || ''}`).join('\n')
  );
  const bundleLang = locale.hasCustomFile
    ? locale.bcp47.split('-')[0].toLowerCase().replace(/^(?:nb|nn)$/, 'no')
    : detectedLang;

  const nodes: Array<{ data: Record<string, unknown> }> = concepts.map((c) => {
    const color = getOkfTypeColor(c.type);
    return {
      data: {
        id: c.id,
        group: 'concept',
        label: c.title || c.id,
        type: c.type,
        description: c.description,
        resource: c.resource,
        tags: c.tags,
        status: c.status,
        ...(c.superseded_by ? { superseded_by: c.superseded_by } : {}),
        generated: c.generated,
        verified: c.verified,
        stale_after: c.stale_after,
        sources: c.sources,
        trust_tier: c.trust_tier,
        stale: c.stale,
        color,
        size: 30 + Math.min(60, Math.floor(c.body.length / 200)),
      },
    };
  });

  const bodies: Record<string, string> = {};
  for (const c of concepts) {
    bodies[c.id] = c.body;
  }

  const edges: Array<{ data: { id: string; source: string; target: string; label?: string } }> = [];
  const seenEdges = new Set<string>();
  const seenNodeIds = new Set<string>(conceptIds);
  const sourceNodeByUrl = new Map<string, string>();
  const sourceNodeDataById = new Map<string, Record<string, unknown>>();
  const sourceNodeByFnId: Record<string, Record<string, string>> = {};
  const sourceNodeByAnyFnId: Record<string, string> = {};

  for (const c of concepts) {
    sourceNodeByFnId[c.id] = sourceNodeByFnId[c.id] || {};
    for (const target of c.links_to) {
      if (target === c.id || !conceptIds.has(target)) continue;
      const key = `${c.id}__${target}`;
      if (seenEdges.has(key)) continue;
      seenEdges.add(key);
      edges.push({
        data: {
          id: key,
          source: c.id,
          target,
        },
      });
    }
    for (const src of c.sources || []) {
      const srcId = src.id || src.title || 'ref';
      const srcUrl = String((src as any).url || (src as any).resource || '').trim();
      const canonicalUrl = normalizeCanonicalSourceUrl(srcUrl);
      const decodedTitle = decodeHtmlEntities(String(src.title || srcUrl || srcId)).trim();
      const fullTitleText = enrichBareDomainSourceTitle(decodedTitle, srcUrl) || decodedTitle;
      const shortTitleText =
        fullTitleText.length > 42 ? `${fullTitleText.slice(0, 42).trimEnd()}…` : fullTitleText;
      const refLine = formatLocaleTemplate(locale.ui.referencedInConcept, {
        id: c.id,
        title: c.title || c.id,
      });

      let srcNodeId = '';
      if (canonicalUrl && sourceNodeByUrl.has(canonicalUrl)) {
        srcNodeId = sourceNodeByUrl.get(canonicalUrl)!;
        const existingNodeData = sourceNodeDataById.get(srcNodeId);
        if (existingNodeData) {
          const curDesc = String(existingNodeData.description || '');
          if (shouldUpgradeSourceTitle(curDesc, fullTitleText, srcUrl)) {
            const primaryFnId = String(existingNodeData.primaryFnId || srcId);
            existingNodeData.description = fullTitleText;
            existingNodeData.fullTitle = `[^${primaryFnId}] ${fullTitleText}`;
            existingNodeData.label = `[^${primaryFnId}] ${shortTitleText}`;
          }
          const citedBy = Array.isArray(existingNodeData.citedByConcepts)
            ? (existingNodeData.citedByConcepts as string[])
            : [];
          if (!citedBy.includes(c.id)) {
            citedBy.push(c.id);
            existingNodeData.citedByConcepts = citedBy;
          }
        }
        if (bodies[srcNodeId] && !bodies[srcNodeId].includes(refLine)) {
          bodies[srcNodeId] = `${bodies[srcNodeId]}\n${refLine}`;
        }
      } else {
        let candidateNodeId = `source:${srcId}`;
        let suffix = 2;
        while (seenNodeIds.has(candidateNodeId)) {
          candidateNodeId = `source:${srcId}--${suffix}`;
          suffix++;
        }
        srcNodeId = candidateNodeId;
        seenNodeIds.add(srcNodeId);
        if (canonicalUrl) {
          sourceNodeByUrl.set(canonicalUrl, srcNodeId);
        }
        const displayFnId = srcNodeId.replace(/^source:/, '');
        let effectiveFullTitle = fullTitleText;
        let effectiveShortTitle = shortTitleText;
        if (displayFnId !== srcId) {
          const firstNodeData = sourceNodeDataById.get(`source:${srcId}`);
          const firstBaseTitle = String(
            firstNodeData?.baseTitle || firstNodeData?.description || ''
          ).trim();
          if (firstBaseTitle && firstBaseTitle.toLowerCase() === fullTitleText.toLowerCase()) {
            const pathSlug = extractLastUrlPathSlug(srcUrl);
            if (pathSlug) {
              effectiveFullTitle = `${fullTitleText} (${pathSlug})`;
              effectiveShortTitle = `${shortTitleText} (${pathSlug})`;
            }
          }
        }
        const nodeData: Record<string, unknown> = {
          id: srcNodeId,
          group: 'source',
          primaryFnId: displayFnId,
          baseTitle: fullTitleText,
          label: `[^${displayFnId}] ${effectiveShortTitle}`,
          fullTitle: `[^${displayFnId}] ${effectiveFullTitle}`,
          parentConceptId: c.id,
          citedByConcepts: [c.id],
          type: 'Verified Source',
          description: effectiveFullTitle,
          resource: srcUrl,
          tags: ['verified-source'],
          status: 'stable',
          generated: c.generated,
          verified: c.verified,
          sources: [{ ...src, id: displayFnId, title: effectiveFullTitle }],
          trust_tier: c.trust_tier,
          stale: false,
          color: '#10b981',
          size: 24,
        };
        sourceNodeDataById.set(srcNodeId, nodeData);
        nodes.push({ data: nodeData });
        bodies[srcNodeId] = [
          src.mime_type
            ? formatLocaleTemplate(locale.ui.sourceMimeBullet, { value: src.mime_type })
            : '',
          src.retrieved_at
            ? formatLocaleTemplate(locale.ui.sourceRetrievedBullet, { value: src.retrieved_at })
            : '',
          src.last_modified
            ? formatLocaleTemplate(locale.ui.sourceModifiedBullet, { value: src.last_modified })
            : '',
          refLine,
        ]
          .filter(Boolean)
          .join('\n');
      }

      sourceNodeByFnId[c.id][srcId] = srcNodeId;
      if (!sourceNodeByAnyFnId[srcId]) {
        sourceNodeByAnyFnId[srcId] = srcNodeId;
      }

      const edgeKey = `${c.id}__${srcNodeId}`;
      if (!seenEdges.has(edgeKey)) {
        seenEdges.add(edgeKey);
        edges.push({
          data: {
            id: edgeKey,
            source: c.id,
            target: srcNodeId,
            label: 'cites',
          },
        });
      }
    }
  }

  const types = Array.from(new Set(nodes.map((n) => String(n.data.type || '')))).sort((a, b) =>
    a.localeCompare(b)
  );
  const resolvedPalette: Record<string, string> = {
    ...OKF_TYPE_PALETTE,
    'Verified Source': '#10b981',
  };
  for (const t of types) {
    if (!resolvedPalette[t]) {
      resolvedPalette[t] = getOkfTypeColor(t);
    }
  }

  const graphData = {
    lang: bundleLang,
    locale: locale.ui,
    nodes,
    edges,
    bodies,
    types,
    palette: resolvedPalette,
    sourceNodeByFnId,
    sourceNodeByAnyFnId,
  };

  const bundleName = options?.bundleName || path.basename(resolvedRoot);
  const escapeVizHtml = (raw: string): string =>
    String(raw ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  const vizThemeLightLabel = locale.ui.themeLightLabel || '☀️ Light';
  const vizThemeDarkLabel = locale.ui.themeDarkLabel || '🌙 Dark';
  const vizThemeToggleTitle = locale.ui.themeToggleTitle || 'Switch between Light and Dark theme';

  const html = `<!DOCTYPE html>
<html lang="${bundleLang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>OKF Bundle Viewer</title>
<script>
(function(){try{var t=localStorage.getItem("icm_a2ui_theme");if(t==="dark"||t==="light")document.documentElement.setAttribute("data-theme",t);}catch(_e){}})();
</script>
<script src="https://cdn.jsdelivr.net/npm/cytoscape@3.28.1/dist/cytoscape.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/marked@12.0.0/marked.min.js"></script>
<style>
${OKF_VIZ_CSS}
</style>
</head>
<body>
<header>
  <div class="title">
    <strong id="bundle-name"></strong>
    <span class="muted">OKF v0.3 bundle</span>
  </div>
  <div class="controls">
    <input id="search" type="search" placeholder="Search title / id / tag">
    <select id="filter-type">
      <option value="">All types</option>
    </select>
    <select id="layout">
      <option value="cose">cose (force)</option>
      <option value="concentric">concentric</option>
      <option value="breadthfirst">breadth-first</option>
      <option value="circle">circle</option>
      <option value="grid">grid</option>
    </select>
    <button id="reset" type="button">Reset view</button>
    <button id="theme-toggle" type="button" class="theme-toggle-btn" aria-label="${escapeVizHtml(vizThemeToggleTitle)}" title="${escapeVizHtml(vizThemeToggleTitle)}" data-label-light="${escapeVizHtml(vizThemeLightLabel)}" data-label-dark="${escapeVizHtml(vizThemeDarkLabel)}">${escapeVizHtml(vizThemeDarkLabel)}</button>
  </div>
</header>

<main>
  <section id="graph"></section>
  <section id="detail">
    <div id="detail-empty" class="muted">Click a node to see its details.</div>
    <article id="detail-content" hidden>
      <header class="detail-header">
        <span class="type-chip" id="detail-type"></span>
        <h1 id="detail-title"></h1>
        <div class="muted" id="detail-id"></div>
      </header>
      <div class="badges" id="detail-badges"></div>
      <dl class="frontmatter">
        <dt>Description</dt><dd id="detail-description"></dd>
        <dt>Resource</dt><dd id="detail-resource"></dd>
        <dt>Tags</dt><dd id="detail-tags"></dd>
        <dt>Generated</dt><dd id="detail-generated"></dd>
        <dt>Verified</dt><dd id="detail-verified"></dd>
        <dt>Sources</dt><dd id="detail-sources"></dd>
      </dl>
      <hr>
      <div id="detail-body"></div>
      <section id="detail-backlinks" hidden>
        <h2>Cited by</h2>
        <ul id="backlinks-list"></ul>
      </section>
    </article>
  </section>
</main>

<script>
window.BUNDLE_NAME = ${JSON.stringify(bundleName).replace(/<\//g, '<\\/')};
window.BUNDLE = ${JSON.stringify(graphData).replace(/<\//g, '<\\/')};
</script>
<script>
${OKF_VIZ_JS}
</script>
</body>
</html>
`;

  fs.mkdirSync(path.dirname(resolvedOutPath), { recursive: true });
  fs.writeFileSync(resolvedOutPath, html, 'utf-8');

  return {
    concepts: concepts.length,
    nodes: nodes.length,
    edges: edges.length,
    bytes: Buffer.byteLength(html, 'utf-8'),
    outputPath: resolvedOutPath,
  };
}
