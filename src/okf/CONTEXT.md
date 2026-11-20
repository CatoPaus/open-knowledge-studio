# Open Knowledge Format v0.3 & Persistent Bundle Engine (`src/okf/CONTEXT.md`)

Implements the upstream **OKF v0.3** specification (`SPEC.md`), source-domain provenance auditing, UTF-8 byte-offset grounding cleanup, zero-token human source curation, and compounding `workspace/bundle/` knowledge graph synchronization.

---

## Chunk Map

| File | Responsibility | Key Exports |
| :--- | :--- | :--- |
| [`timestamps.ts`](./timestamps.ts) | Validates ISO 8601 dates, HTTP `Last-Modified` headers, HTML entity decoding, W3C HTML `<meta>` / JSON-LD dates, and ISO 32000 PDF `/ModDate` + XMP timestamps. | `parseValidIsoTimestamp`, `parseHttpLastModified`, `decodeHtmlEntities`, `extractHtmlModifiedFromSnippet`, `parsePdfDateToIso`, `extractPdfModifiedFromLatin1` |
| [`document.ts`](./document.ts) | Zero-dependency OKF v0.3 YAML frontmatter parser (with duplicate-key rejection) & deterministic serializer, current-only `trust_tier` (`unverified` \| `machine-confirmed` \| `human-reviewed`), strict `is_stale`, actor normalizer (`normalizeOkfActor`), and Nordic-safe ASCII slug helpers. | `OKFDocument`, `OKFFrontmatter`, `OKFSource`, `parseOkfDocument`, `serializeOkfDocument`, `validateOkfDocument`, `isOkfConceptDocument`, `normalizeOkfActor`, `normalizeOkfTags`, `normalizeOkfSources`, `getOkfTrustTier`, `isOkfStale`, `transliterateNordicAscii`, `truncateSlugAtWordBoundary` |
| [`provenance.ts`](./provenance.ts) | Unwraps Vertex AI Search `302` grounding redirects (capturing destination `Content-Type` / `%PDF-` `mime_type`, `CSP: object-src 'none'` inline-PDF block warnings, `Last-Modified` + `<title>`), strips portal UI view-mode suffixes (`stripTrailingPortalViewChrome`), normalizes canonical URLs & multi-record archive dedupe keys, formats RFC 3986 leaf-parent middle-ellipsis URL display, upgrades bare-domain source titles, heals orphan footnotes, structurally detects internal `/*.md` backlink sections (`findTrailingRelatedConceptsHeadingIndex`), and flags publisher-vs-domain mismatches. | `resolveRedirect`, `isPdfBlockedByBrowserCsp`, `normalizeHttpMimeType`, `inferSourceMimeTypeFromUrl`, `formatSourceUrlMiddleEllipsis`, `isMultiRecordArchiveUrl`, `normalizeCanonicalSourceUrl`, `getCanonicalSourceDedupeKeys`, `stripTrailingPortalViewChrome`, `isInternalConceptLinkBullet`, `findTrailingRelatedConceptsHeadingIndex`, `isLowSignalGroundingUrl`, `enrichBareDomainSourceTitle`, `healOrphanOkfFootnotes`, `inspectSourceDomainProvenance` |
| [`grounding.ts`](./grounding.ts) | Snaps Gemini UTF-8 byte-offset `groundingSupports` onto clean Markdown prose boundaries (safe across multi-byte UTF-8 glyphs such as `é`/`ü`/`§`/`—`, headings, tables, emphasis, brackets, and structural internal concept backlinks) and executes `<50ms` zero-token source curation (`--reject-source`, `--add-source`, `--replace-source`). | `cleanGroundingLinks`, `curateOkfSources`, `CurateOkfSourcesOptions` |
| [`bundle.ts`](./bundle.ts) | Merges verified/draft concepts into `workspace/bundle/research/`, regenerates `index.md`, appends `log.md`, validates OKF v0.3 bundle conformance (`validateOkfBundle`), and injects bidirectional cross-concept links localized via Layer 3 `workspace/_config/locale.json` (English default). | `mergeConceptDocuments`, `writeBundleConcept`, `regenerateBundleIndexes`, `appendBundleLog`, `injectBidirectionalBundleLinks`, `syncRunToBundle`, `validateOkfBundle` |
| [`index.ts`](./index.ts) | Public barrel re-exporting all `okf` modules. | `*` |

---

## Invariants
- **Allowed Imports:** Node.js built-ins + `../interactions/index.js` only.
- **3-Way OKF v0.3 Citation Parity:** Every cited `[^id]` in prose must exist in both `frontmatter.sources[]` and the trailing Markdown footnote definitions (`[^id]: Title — URL`), with zero orphan definitions.
