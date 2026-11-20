# Standards, Specifications & Normative References (`STANDARDS_AND_REFERENCES.md`)

Canonical registry of every **upstream methodology/protocol**, **ISO / IETF / W3C / IANA / Unicode / binary media standard**, **recognized standards-body / vulnerability / government-portal identifier**, and **external API or progressive-enhancement script** implemented or relied upon by **Open Knowledge Studio**.

---

## How Agents & Maintainers Should Use This Registry (Progressive Disclosure)

1. **Read on Demand — Never Inline into Stage Prompts:**
   - Do **not** paste this document into `workspace/GEMINI.md`, `workspace/CONTEXT.md`, or `prompts/*.md`.
   - Read this file **on demand** whenever you are:
     - Extending or debugging protocol parsers, codecs, or validators in [`../src/`](../src/CONTEXT.md) (e.g., ISO 8601 / ISO 32000 PDF / XMP dates, RFC 6901 JSON Pointers, RFC 3986 URL normalization, BCP-47 speech locales, IANA MIME sniffing, RIFF/WAV PCM16 codecs).
     - Checking which **standards-body prefixes** (`ISO`, `IEC`, `IEEE`, `RFC`, `CVE`, etc.) or **shared government / intergovernmental umbrella portals** (`.gov`, `europa.eu`, `bund.de`, `regjeringen.no`, etc.) are already recognized natively by `inspectSourceDomainProvenance()` before writing Stage 1 provenance rules or curating sources at Intermission.
     - Auditing upstream specification compliance, licensing, or zero-dependency boundaries.
2. **Server + Client Mirror Rule (`provenance.ts` <-> `studio.js`):**
   - Domain-provenance rules (`inspectSourceDomainProvenance` / `inspectClientSourceDomainProvenance`) exist in **both** [`../src/okf/provenance.ts`](../src/okf/provenance.ts) (Node.js build/CLI time) and [`../src/a2ui/client/studio.js`](../src/a2ui/client/studio.js) (live browser curation inside `a2ui.html` when pasting replacement URLs). Whenever you add or modify a recognized standards prefix or government umbrella portal, update **both** files and add a zero-token assertion in [`../src/tests/self-tests.ts`](../src/tests/self-tests.ts).
3. **Keep This Registry Synchronized:**
   - Whenever you add, upgrade, or remove an implemented RFC/ISO/W3C standard, recognized registry/portal pattern, or external API/CDN script in [`../src/`](../src/CONTEXT.md), update the corresponding row in this file in the same commit.

---

## 1. Core 3-Pillar Open Methodologies & Protocols

Pinned and machine-verified via `npm run spec:check` against [`./UPSTREAM_LOCK.json`](./UPSTREAM_LOCK.json):

| Pillar | Upstream Specification & Canonical URL | Vendored Spec in Repo | Engine Implementation |
| :--- | :--- | :--- | :--- |
| **ICM** | [Interpretable Context Methodology (`RinDig/Interpretable-Context-Methodology`)](https://github.com/RinDig/Interpretable-Context-Methodology) · Paper: [arXiv:2603.16021](https://arxiv.org/abs/2603.16021) | Tracked in [`./UPSTREAM_LOCK.json`](./UPSTREAM_LOCK.json) (`_core/CONVENTIONS.md`) | [`../src/pipeline/layers.ts`](../src/pipeline/layers.ts), [`../src/pipeline/stages-text.ts`](../src/pipeline/stages-text.ts), [`../src/pipeline/stages-multimodal.ts`](../src/pipeline/stages-multimodal.ts), [`../src/ops/spec-check.ts`](../src/ops/spec-check.ts) |
| **OKF v0.3** | [Open Knowledge Format v0.3 (`open-knowledge-format/open-knowledge-format`)](https://github.com/open-knowledge-format/open-knowledge-format/blob/main/SPEC.md) | [`../SPEC.md`](../SPEC.md) | [`../src/okf/document.ts`](../src/okf/document.ts), [`../src/okf/timestamps.ts`](../src/okf/timestamps.ts), [`../src/okf/provenance.ts`](../src/okf/provenance.ts), [`../src/okf/grounding.ts`](../src/okf/grounding.ts), [`../src/okf/bundle.ts`](../src/okf/bundle.ts) |
| **A2UI v1.0** | [Agent-to-UI Protocol v1.0 (`google/A2UI`)](https://github.com/google/A2UI) · Catalog URI namespace `https://a2ui.org/specification/v1_0/...` | [`./versions.json`](./versions.json), [`./v1_0/docs/a2ui_protocol.md`](./v1_0/docs/a2ui_protocol.md), [`./v1_0/catalogs/basic/catalog.json`](./v1_0/catalogs/basic/catalog.json), [`./v1_0/catalogs/icm-okf-v0.3/catalog.json`](./v1_0/catalogs/icm-okf-v0.3/catalog.json) | [`../src/a2ui/types.ts`](../src/a2ui/types.ts), [`../src/a2ui/catalog-schema.ts`](../src/a2ui/catalog-schema.ts), [`../src/a2ui/schema.ts`](../src/a2ui/schema.ts), [`../src/a2ui/normalize.ts`](../src/a2ui/normalize.ts), [`../src/a2ui/surface.ts`](../src/a2ui/surface.ts), [`../src/a2ui/client/studio.js`](../src/a2ui/client/studio.js) |

---

## 2. Formal ISO, IETF RFC, W3C, IANA, Unicode & Media Standards Implemented in `src/`

| Standard / Specification | Normative Reference | How Open Knowledge Studio Uses It | Implementation Files |
| :--- | :--- | :--- | :--- |
| **ISO 8601** & **IETF RFC 3339** | [ISO 8601](https://www.iso.org/iso-8601-date-and-time-format.html) · [RFC 3339](https://www.rfc-editor.org/rfc/rfc3339) | Canonical UTC timestamps (`YYYY-MM-DDTHH:MM:SSZ` or `YYYY-MM-DD`) for `generated.at`, `stale_after`, `retrieved_at`, `last_modified`, `verified[].at`, and A2UI `DateTimeInput` | [`../src/okf/timestamps.ts`](../src/okf/timestamps.ts), [`../src/okf/document.ts`](../src/okf/document.ts), [`./v1_0/catalogs/basic/catalog.json`](./v1_0/catalogs/basic/catalog.json) |
| **ISO 32000-1 §7.9.4** (PDF 1.7) | [ISO 32000-1](https://www.iso.org/standard/51502.html) | Parses PDF `/Info` dictionary `/ModDate` & `/CreationDate` (`D:YYYYMMDDHHmmSSOHH'mm'`, inline & indirect `<obj> <gen> R` objects) via HTTP `Range` head/tail probes | [`../src/okf/timestamps.ts`](../src/okf/timestamps.ts), [`../src/okf/provenance.ts`](../src/okf/provenance.ts) |
| **ISO 16684-1** (Adobe XMP) | [ISO 16684-1](https://www.iso.org/standard/75163.html) | Extracts embedded `xmp:ModifyDate` / `xmp:CreateDate` metadata packets from PDFs when `/Info` is absent | [`../src/okf/timestamps.ts`](../src/okf/timestamps.ts) |
| **ISO 15836** (Dublin Core Metadata) | [DCMI Metadata Terms](https://www.dublincore.org/specifications/dublin-core/dcmi-terms/) · [ISO 15836](https://www.iso.org/standard/71339.html) | Extracts `dcterms.modified`, `dc.date.modified`, `dcterms.issued`, `dcterms.created`, and `dc.date` from HTML `<meta>` tags | [`../src/okf/timestamps.ts`](../src/okf/timestamps.ts) |
| **ISO 4217** (Currency Codes) | [ISO 4217](https://www.iso.org/iso-4217-currency-codes.html) | 3-letter currency code schema (`USD`, `EUR`, etc.) in the vendored A2UI v1.0 Basic Catalog `formatCurrency` definition + localized currency prosody verbalization | [`./v1_0/catalogs/basic/catalog.json`](./v1_0/catalogs/basic/catalog.json), [`../src/pipeline/prosody.ts`](../src/pipeline/prosody.ts), [`../src/interactions/locale.ts`](../src/interactions/locale.ts) |
| **IETF RFC 6901** (JSON Pointer) | [RFC 6901](https://www.rfc-editor.org/rfc/rfc6901) | Declarative `@path` data-model bindings (`/okf/body`, `/stage2/modules`, `/checklist/groups`) and live state mutation (`~0` / `~1` unescaping) | [`../src/a2ui/schema.ts`](../src/a2ui/schema.ts), [`../src/a2ui/client/studio.js`](../src/a2ui/client/studio.js) |
| **IETF RFC 3986** (URI Generic Syntax) | [RFC 3986](https://www.rfc-editor.org/rfc/rfc3986) | Canonical source URL normalization, percent-decoding, `#<entry-path>` multi-record archive sub-document locators, and leaf-parent middle-ellipsis formatting | [`../src/okf/provenance.ts`](../src/okf/provenance.ts) |
| **IETF RFC 9110** (HTTP Semantics) | [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110) | Fast manual `302` `Location` redirect resolution, `Range` byte probes, `Content-Type` media-type parsing, and HTTP-date `Last-Modified` extraction | [`../src/okf/provenance.ts`](../src/okf/provenance.ts), [`../src/okf/timestamps.ts`](../src/okf/timestamps.ts) |
| **IETF BCP 47 / RFC 5646** (Language Tags) | [BCP 47](https://www.rfc-editor.org/info/bcp47) · [RFC 5646](https://www.rfc-editor.org/rfc/rfc5646) | Universal script/language inference and normalization (`en-US`, `nb-NO`, `de-DE`, `ja-JP`, etc.) across Layer 3 `workspace/_config/locale.json`, Stage 4 studio TTS, Voice Lock, and Web Speech API | [`../src/interactions/locale.ts`](../src/interactions/locale.ts), [`../src/pipeline/stages-multimodal.ts`](../src/pipeline/stages-multimodal.ts), [`../src/a2ui/catalog-schema.ts`](../src/a2ui/catalog-schema.ts) |
| **IANA Media Types, RFC 6838 & RFC 6839** | [IANA Media Types](https://www.iana.org/assignments/media-types/media-types.xhtml) · [RFC 6838](https://www.rfc-editor.org/rfc/rfc6838) · [RFC 6839](https://www.rfc-editor.org/rfc/rfc6839) | Per-source `mime_type` badges (`application/pdf`, `text/html`, `application/json`, `application/vnd.apache.parquet`, and RFC 6839 `+json` / `+xml` structured syntax suffixes for vendor/HAL/JSON-LD/GeoJSON/GML/Atom OpenAPI feeds), `application/a2ui+json` transport media type, and binary media validation | [`../src/okf/provenance.ts`](../src/okf/provenance.ts), [`../src/a2ui/client/studio.js`](../src/a2ui/client/studio.js), [`../src/interactions/media.ts`](../src/interactions/media.ts), [`./v1_0/docs/evolution_guide.md`](./v1_0/docs/evolution_guide.md) |
| **OGC Web Feature Service (WFS 2.0 / ISO 19142) & OGC API - Features (ISO 19168-1)** | [ISO 19142 / OGC 09-025r2](https://www.ogc.org/standard/wfs/) · [ISO 19168-1 / OGC 17-069r4](https://www.ogc.org/standard/ogcapi-features/) | Open geospatial query & media-type inference (`service=WFS`, `outputFormat`, `f=json`, `application/gml+xml`, `application/geo+json`) and `ws.*`/`wfs.*`/`wms.*`/`ogc.*`/`geo.*` provenance host normalization | [`../src/okf/provenance.ts`](../src/okf/provenance.ts), [`../src/a2ui/client/studio.js`](../src/a2ui/client/studio.js) |
| **IETF RFC 3629 (UTF-8)** & **Unicode UAX #15 (NFD)** | [RFC 3629](https://www.rfc-editor.org/rfc/rfc3629) · [UAX #15](https://unicode.org/reports/tr15/) | Multi-byte UTF-8 continuation-byte (`10xxxxxx`) boundary snapping for `groundingSupports`, UTF-8/UTF-16LE BOM `.env` loading, Unicode `\p{L}`/`\p{N}` tokenization, and NFD diacritic stripping | [`../src/okf/grounding.ts`](../src/okf/grounding.ts), [`../src/interactions/env.ts`](../src/interactions/env.ts), [`../src/okf/provenance.ts`](../src/okf/provenance.ts) |
| **YAML 1.2** | [YAML 1.2.2](https://yaml.org/spec/1.2.2/) | Zero-dependency OKF v0.3 YAML frontmatter parser/serializer (rejecting duplicate keys and preserving literal RFC 3339 strings) and `prompts/*.md` stage contract frontmatter | [`../src/okf/document.ts`](../src/okf/document.ts), [`../src/interactions/contracts.ts`](../src/interactions/contracts.ts) |
| **JSON Schema (Draft 2020-12)** | [JSON Schema 2020-12](https://json-schema.org/draft/2020-12/schema) | Stage 2 `response_format.schema` compilation and strict A2UI v1.0 Tier 1 / Tier 2 component validation | [`../src/a2ui/catalog-schema.ts`](../src/a2ui/catalog-schema.ts), [`../src/a2ui/schema.ts`](../src/a2ui/schema.ts), [`../src/interactions/contracts.ts`](../src/interactions/contracts.ts) |
| **JSON Lines (JSONL)** & **JSON-RPC 2.0** | [JSON Lines](https://jsonlines.org/) · [JSON-RPC 2.0](https://www.jsonrpc.org/specification) | Streaming `a2ui_surface.jsonl` envelope output, A2UI `callAgentFunction` / `agentFunctionResponse` Ping-Pong wakeup, and workspace `stdio` MCP servers | [`../src/a2ui/surface.ts`](../src/a2ui/surface.ts), [`../src/a2ui/browser-bridge.ts`](../src/a2ui/browser-bridge.ts) |
| **WHATWG HTML & Server-Sent Events (SSE)** | [WHATWG SSE](https://html.spec.whatwg.org/multipage/server-sent-events.html) · [Named Character References](https://html.spec.whatwg.org/multipage/named-characters.html) | Native `fetch` `text/event-stream` SSE client for `gemini-4-argon` and HTML named/numeric entity decoding (`&sect;`, `&#x00F8;`, etc.) | [`../src/interactions/client.ts`](../src/interactions/client.ts), [`../src/okf/timestamps.ts`](../src/okf/timestamps.ts) |
| **W3C Content Security Policy (CSP Level 3)** | [W3C CSP3](https://www.w3.org/TR/CSP3/) | Detects `Content-Security-Policy: object-src 'none'` / `default-src 'none'` on `application/pdf` responses that cause inline browser viewer `ERR_BLOCKED_BY_CLIENT` blocks | [`../src/okf/provenance.ts`](../src/okf/provenance.ts) |
| **W3C JSON-LD 1.1**, **Schema.org**, & **OpenGraph** | [W3C JSON-LD 1.1](https://www.w3.org/TR/json-ld11/) · [Schema.org Article](https://schema.org/Article) · [OpenGraph](https://ogp.me/) | Extracts `dateModified`, `datePublished`, `article:modified_time`, `og:updated_time`, and `og:title` from HTML `<head>` | [`../src/okf/timestamps.ts`](../src/okf/timestamps.ts), [`../src/okf/provenance.ts`](../src/okf/provenance.ts) |
| **W3C WAI-ARIA 1.2**, **SVG 1.1**, & **Web Speech API** | [WAI-ARIA 1.2](https://www.w3.org/TR/wai-aria-1.2/) · [SVG 1.1](https://www.w3.org/TR/SVG11/) · [Web Speech API](https://wicg.github.io/speech-api/) | A2UI `@accessibility` attributes (`aria-label`, `aria-live`, `aria-hidden`), zero-CDN offline SVG knowledge-graph fallback (`http://www.w3.org/2000/svg`), and browser `speechSynthesis` fallback | [`./v1_0/json/common_types.json`](./v1_0/json/common_types.json), [`../src/a2ui/client/studio.js`](../src/a2ui/client/studio.js), [`../src/viz/client/viz.js`](../src/viz/client/viz.js) |
| **RIFF / WAVE (LPCM)** & Binary File Magic Signatures | [WAVE PCM Format](https://www.mmsp.ece.mcgill.ca/Documents/AudioFormats/WAVE/WAVE.html) | 44-byte `RIFF`/`WAVE` PCM16 header wrapper (`audio/l16`), chunk parser (`fmt ` / `data`, skipping `LIST`/`INFO`), lossless `24 kHz` PCM16 WAV HTML inlining, optional 5-tap binomial FIR (`[1, 4, 6, 4, 1] / 16`) WAV resampler utility, and magic-byte sniffing (`JPEG`, `PNG`, `WebP`, `GIF89a`, `WAV`, `Ogg`, `ID3/MP3`) | [`../src/interactions/media.ts`](../src/interactions/media.ts), [`../src/a2ui/surface.ts`](../src/a2ui/surface.ts) |

---

## 3. Standards Bodies, Registries & Portals Recognized in Provenance & Formatting Rules

### 3.1 Formal Standards & Vulnerability Identifier Prefixes
In [`../src/okf/provenance.ts`](../src/okf/provenance.ts) (`inspectSourceDomainProvenance`) and its client mirror [`../src/a2ui/client/studio.js`](../src/a2ui/client/studio.js) (`inspectClientSourceDomainProvenance`), a trailing `– <Code>` or `| <Code>` suffix on a source title is recognized as a **formal document/standard identifier** (rather than a mismatched publisher claim) when prefixed by:

| Prefix | Organization / Registry | Canonical Link |
| :--- | :--- | :--- |
| **`ISO`** | International Organization for Standardization | https://www.iso.org/ |
| **`IEC`** | International Electrotechnical Commission | https://www.iec.ch/ |
| **`IEEE`** | Institute of Electrical and Electronics Engineers | https://www.ieee.org/ |
| **`ANSI`** | American National Standards Institute | https://www.ansi.org/ |
| **`ASTM`** | ASTM International | https://www.astm.org/ |
| **`NIST`** | National Institute of Standards and Technology | https://www.nist.gov/ |
| **`EN`** | European Standards (CEN / CENELEC) | https://www.cencenelec.eu/ |
| **`BS`** | British Standards Institution (BSI) | https://www.bsigroup.com/ |
| **`DIN`** | Deutsches Institut für Normung | https://www.din.de/ |
| **`NS`** | Standards Norway (*Norsk Standard*) | https://standard.no/ |
| **`RFC`** | IETF Request for Comments | https://www.rfc-editor.org/ |
| **`CVE`** | Common Vulnerabilities and Exposures | https://www.cve.org/ |

Parenthetical codes and agency acronyms at the end of titles (e.g., `(ISO 27001)`, `(SEC)`) are also preserved untouched by `stripTrailingPortalViewChrome()` in [`../src/okf/provenance.ts`](../src/okf/provenance.ts).

### 3.2 Algorithmic Agency Initialism Matching (`inspectSourceDomainProvenance`)
Agency acronyms mentioned in JSDoc comments (such as `SEC` <-> [sec.gov](https://www.sec.gov/), `NIST` <-> [nist.gov](https://www.nist.gov/), and `FDA` <-> [fda.gov](https://www.fda.gov/)) are **illustrative examples only**—the provenance matcher in [`../src/okf/provenance.ts`](../src/okf/provenance.ts) and [`../src/a2ui/client/studio.js`](../src/a2ui/client/studio.js) is **100% algorithmic**, matching direct DNS tokens, parenthetical/uppercase initialisms, compound-word stems, and multi-token syllabic abbreviations across any authority domain.

### 3.3 Shared Government & Intergovernmental Umbrella Portals
Multiple national ministries, directorates, and agencies legitimately publish under a single shared executive, parliamentary, or intergovernmental domain whose hostname will not match an individual agency's acronym. Both [`../src/okf/provenance.ts`](../src/okf/provenance.ts) and [`../src/a2ui/client/studio.js`](../src/a2ui/client/studio.js) exempt:
- **Public-Sector TLDs & 2nd-Level Umbrella Registries:** `.gov`, `.gov.<cc>`, `.gob.<cc>`, `.gouv.<cc>`, `.gv.<cc>`, `.go.<cc>`, `.mil`, `.mil.<cc>`, `.int` *(note: `.nhs.uk` is handled via `sldRegistries` 2nd-level suffix stripping so `<trust>.nhs.uk` extracts institutional tokens without blanket-exempting mismatched publishers)*
- **Named National & Intergovernmental Portals:**
  - Supranational / Multilateral: [europa.eu](https://europa.eu/), [un.org](https://www.un.org/), [who.int](https://www.who.int/), [oecd.org](https://www.oecd.org/), [worldbank.org](https://www.worldbank.org/)
  - National Executive & Parliamentary Portals (non-`.gov.<cc>` ccTLDs): [usa.gov](https://www.usa.gov/), [canada.ca](https://www.canada.ca/), [bund.de](https://www.bund.de/), [bundesregierung.de](https://www.bundesregierung.de/), [admin.ch](https://www.admin.ch/), [rijksoverheid.nl](https://www.rijksoverheid.nl/), [overheid.nl](https://www.overheid.nl/), [gouvernement.fr](https://www.gouvernement.fr/), [regeringen.se](https://www.regeringen.se/), [riksdagen.se](https://www.riksdagen.se/), [regeringen.dk](https://www.regeringen.dk/), [regjeringen.no](https://www.regjeringen.no/), [stortinget.no](https://www.stortinget.no/)

### 3.4 Academic Preprint & Engineering Readiness Identifiers
- **[arXiv (`arxiv.org`)](https://arxiv.org/):** Canonical `YYMM.NNNNNvN` preprint identifier enrichment (`arxiv.org — arXiv:<id>`) in [`../src/okf/provenance.ts`](../src/okf/provenance.ts).
- **Financial & Readiness Subscript Identifiers (`NPV`, `IRR`, `TRL`, `Tier`):** Normalized in client Web Speech playback (`NPV₈` -> `"NPV 8"`, where **TRL** follows NASA / [ISO 16290](https://www.iso.org/standard/56064.html) Technology Readiness Levels) in [`../src/a2ui/client/studio.js`](../src/a2ui/client/studio.js).

---

## 4. External Runtime APIs, Progressive-Enhancement CDN Scripts & Dev Tooling

Open Knowledge Studio maintains **`0` runtime `npm` dependencies** in [`../package.json`](../package.json):

| External Resource | Canonical URL | Role & Offline Fallback | Referenced In |
| :--- | :--- | :--- | :--- |
| **Google AI Interactions & Voices API** | `https://generativelanguage.googleapis.com/v1beta/interactions` · `/v1beta/voices` | Stage 1–4 execution (`gemini-4-argon`, `gemini-nano-banana-2.1`, `gemini-3.8-flash-tts`) + Google Search Grounding (`vertexaisearch.cloud.google.com`) | [`../src/interactions/env.ts`](../src/interactions/env.ts), [`../src/interactions/client.ts`](../src/interactions/client.ts), [`../src/interactions/multimodal.ts`](../src/interactions/multimodal.ts) |
| **GitHub REST API** | https://docs.github.com/en/rest/commits/commits | Used exclusively by `npm run spec:check` to compare [`./UPSTREAM_LOCK.json`](./UPSTREAM_LOCK.json) against upstream `HEAD` commits | [`../src/ops/spec-check.ts`](../src/ops/spec-check.ts) |
| **Marked v12.0.0** (jsDelivr CDN) | [markedjs/marked](https://github.com/markedjs/marked) · `https://cdn.jsdelivr.net/npm/marked@12.0.0/marked.min.js` | Browser-only progressive enhancement in `a2ui.html` & `viz.html`; both ship built-in zero-CDN Markdown fallback renderers for 100% offline operation | [`../src/a2ui/surface.ts`](../src/a2ui/surface.ts), [`../src/viz/bundle-graph.ts`](../src/viz/bundle-graph.ts) |
| **Cytoscape.js v3.28.1** (jsDelivr CDN) | [Cytoscape.js](https://js.cytoscape.org/) · `https://cdn.jsdelivr.net/npm/cytoscape@3.28.1/dist/cytoscape.min.js` | Browser-only progressive enhancement in `a2ui.html` & `viz.html`; both ship built-in zero-CDN pure-SVG radial graph fallbacks for 100% offline operation | [`../src/a2ui/surface.ts`](../src/a2ui/surface.ts), [`../src/viz/bundle-graph.ts`](../src/viz/bundle-graph.ts) |
| **Node.js v22.15+ / v24+** & **TypeScript** | [Node.js](https://nodejs.org/) · [TypeScript](https://www.typescriptlang.org/) | Zero-`node_modules` native TypeScript type-stripping + `node:module` `registerHooks` runtime (`fs`, `path`, `http`, `crypto`, `fetch`) via [`../bin/oks.mjs`](../bin/oks.mjs) + dev-only `tsc --noEmit` (`devDependencies` only) | [`../bin/oks.mjs`](../bin/oks.mjs), [`../package.json`](../package.json), [`../tsconfig.json`](../tsconfig.json) |
