# Phase 1 Step A.5 Open-Data MCP Scaffolding & Phase 2 Intermission Audit Reference

## 1. Dual-Axis Pre-Flight Primary-Registry & Open-Data MCP Plugin Scaffolding

Many official statutory, corporate/establishment, cadastre, securities, clinical, patent, and standards registries either split `robots.txt` rules (allowing partial `googlebot` routes at the top while setting `User-agent: *`, `GPTBot`, `Google-Extended`, or `ChatGPT-User` `Disallow: /` in lower stanzas, or blocking `/eli/`, `/search`, `/api` paths) **or** serve entity portals as unindexed JS SPAs while publishing official **keyless Open Data archives or REST/JSON OpenAPI endpoints**.

### Dual-Axis Pre-Flight Sequence (~3s, Zero LLM Tokens)
1. **Axis 1 — Normative & Domain Registries (Always Active):**
   - Check `search_marketplace` (when available) for an existing MCP plugin.
   - Read the **entire** `https://<primary-registry>/robots.txt` top-to-bottom—never stop at the first `User-agent: googlebot` stanza.
   - Run 1 targeted `search_web("<registry> open data API OR OpenAPI")` query (in the target language + English) and inspect discovered OpenAPI/Swagger/developer docs to distinguish **keyless public Open Data feeds/archives** (`.tar.bz2`, `.tar.gz`, `.zip`, `.xml`, `.json`) from **`API_KEY`-gated `/search` or `/ai/` endpoints** (and check reuse license).
2. **Axis 2 — Named-Entity, Establishment & Physical-Site Registries (When Anchored to an Organization, Facility, or Street Address):**
   - Triggered automatically whenever the project folder name, user prompt, or Layer 0/1 (`workspace/GEMINI.md` / `CONTEXT.md`) identifies a **specific organization, institution, company, facility, or physical street address / locality** (skip silently on generic non-entity topics).
   - Run 1 targeted `search_web("<jurisdiction> official business entity register OR address cadastre open data REST API")` query (and/or inspect the jurisdiction's national entity/establishment and geocoding/cadastre/sectoral-facility OpenAPIs).
   - **Establishment-to-Owner Hierarchy Walk:** Operating sites (schools, clinics, plants, branches) are typically registered as **sub-entities / establishments** under a **parent operating unit** and an **ultimate legal entity** (municipality, trust, parent company). Probe 1 live JSON record first to verify exact field names (e.g., physical site address vs legal postal address), then follow parent-entity links recursively up to the ultimate legal owner so organization IDs, legal forms, industry/activity codes, headcount, start/ownership dates, street address, and administrative/municipality codes come 100% from first-party registry JSON rather than third-party business-directory scrapers.
   - **Public Cadastral Building & Terrain/Elevation Enrichment (When Physical Address/Coordinates Present):** Once geocoding resolves the parcel ID and coordinates, also check keyless **open-licensed** cadastral building (`OGC WFS` / `OGC API - Features` / INSPIRE Buildings) and airborne LiDAR terrain/surface elevation (`DTM` ground elevation + `DSM`/`DOM` surface elevation) endpoints to append macro-exterior site facts into the **same** `references/<entity-slug>.md` file (`+~10` lines, `0` extra files):
     - Parcel structure count, building IDs, official building-use classification codes, and heritage flags.
     - Ground elevation above sea level (`DTM`), terrain/land-cover class (e.g., inland plateau vs. coastal shoreline), and **`DSM − DTM` approximate roof height above ground** (e.g., `~4 m` single-story pavilion vs. multi-story block) so Stage 2/3 ground exterior building scale and site topography accurately.
     - **Strict Licensing, Privacy & ToS Red Lines:** **Only** query keyless public open-data feeds (`NLOD` / `CC BY` / `CC0` / `ODbL` / statutory open-government terms, attributed in `x-license` + `sources[]`). **Never** scrape or ingest proprietary street-view, 3D-tile, or aerial imagery (Google Street View / Maps / Earth, Apple Look Around, Bing, restricted orthophotos), **never** probe login-gated cadastral APIs or municipal building-permit blueprints, and **never** extract private residential interiors or facility security/evacuation floor plans.
   - **Unified or Per-Registry Plugin Choice:** When both Axis 1 and Axis 2 match, you may expose both normative-record and entity/site sync tools inside a single unified workspace plugin (`.agents/plugins/<workspace>-open-data-mcp/`) or separate per-registry plugins (`.agents/plugins/<registry>-mcp/`), writing `workspace/bundle/references/<entity-slug>.md` (`~2–4 KB`) alongside normative references within the 6-file / `36,000`-char Layer 2 hydration budget.

### Reusable Workspace MCP Plugin Layout (`.agents/plugins/<registry>-mcp/`)
Never write disposable Python/shell scripts in `scratch/`. Scaffold a zero-dependency Node.js workspace plugin:
- `.agents/plugins/<registry>-mcp/plugin.json`:
  Include standard Antigravity manifest fields (`name`, `displayName`, `description`, `author`, `homepage`, `repository`). Keep MCP servers in `mcp_config.json`, never inside `plugin.json` (and omit unsupported keys like `license`).
- `.agents/plugins/<registry>-mcp/mcp_config.json`:
  Use a globally unique prefixed server key (`"<registry>-open-data"`) and plugin-relative `"args": ["mcp/index.mjs"]`.
- `.agents/plugins/<registry>-mcp/mcp/index.mjs`:
  Resolve `REPO_ROOT = path.resolve(import.meta.dirname, '../../../..')` so both Antigravity (`mcp/index.mjs` from plugin root) and CLI sync (`node .agents/plugins/<registry>-mcp/mcp/index.mjs --sync`) resolve `workspace/bundle/references/` cleanly. Cache downloaded archives in gitignored `.cache/open-data/` using `curl.exe -sLo <file>` or Node `fetch()` to disk first, then extract via `tar -xf <file>` (**never** pipe binary `curl.exe | tar` in Windows PowerShell 5.1, which corrupts binary streams as UTF-16 text).
  Guard CLI sync behind `if (process.argv.includes('--sync')) { ... process.exit(0); }` and run a zero-dependency dual-framing JSON-RPC 2.0 stdio MCP fallback otherwise (never write diagnostics to `stdout` in MCP mode—use `console.error`):
  ```js
  if (process.argv.includes('--sync')) { await syncAll(); process.exit(0); }

  let useContentLengthFraming = false, rawBuffer = Buffer.alloc(0);
  const sendRpc = (obj) => {
    const json = JSON.stringify(obj);
    process.stdout.write(useContentLengthFraming ? `Content-Length: ${Buffer.byteLength(json, 'utf8')}\r\n\r\n${json}` : `${json}\n`);
  };
  const dispatchRpc = async (msg) => {
    if (!msg || typeof msg !== 'object' || msg.id == null) return;
    const { id, method, params } = msg;
    try {
      if (method === 'initialize') return sendRpc({ jsonrpc: '2.0', id, result: { protocolVersion: String(params?.protocolVersion || '2024-11-05'), capabilities: { tools: {} }, serverInfo: SERVER_INFO } });
      if (method === 'ping') return sendRpc({ jsonrpc: '2.0', id, result: {} });
      if (method === 'tools/list') return sendRpc({ jsonrpc: '2.0', id, result: { tools: TOOLS } });
      if (method === 'tools/call') return sendRpc({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: await handleToolCall(String(params?.name || ''), params?.arguments || {}) }] } });
      sendRpc({ jsonrpc: '2.0', id, error: { code: -32601, message: `Method not found: ${method}` } });
    } catch (err) {
      sendRpc({ jsonrpc: '2.0', id, error: { code: -32603, message: err?.message || String(err) } });
    }
  };
  process.stdin.on('data', (chunk) => {
    rawBuffer = Buffer.concat([rawBuffer, Buffer.from(chunk)]);
    while (rawBuffer.length > 0) {
      if (/^Content-Length:/i.test(rawBuffer.subarray(0, 64).toString('utf8'))) {
        useContentLengthFraming = true;
        const hdrEnd = rawBuffer.indexOf('\r\n\r\n');
        if (hdrEnd === -1) break;
        const lenMatch = rawBuffer.subarray(0, hdrEnd).toString('utf8').match(/Content-Length:\s*(\d+)/i);
        if (!lenMatch) { rawBuffer = rawBuffer.subarray(hdrEnd + 4); continue; }
        const total = hdrEnd + 4 + parseInt(lenMatch[1], 10);
        if (rawBuffer.length < total) break;
        const body = rawBuffer.subarray(hdrEnd + 4, total).toString('utf8');
        rawBuffer = rawBuffer.subarray(total);
        try { void dispatchRpc(JSON.parse(body)); } catch {}
      } else {
        const nl = rawBuffer.indexOf('\n');
        if (nl === -1) break;
        const line = rawBuffer.subarray(0, nl).toString('utf8').trim();
        rawBuffer = rawBuffer.subarray(nl + 1);
        if (line) { try { void dispatchRpc(JSON.parse(line)); } catch {} }
      }
    }
  });
  ```
- **OKF v0.3 `type: Reference` Distillation (`workspace/bundle/references/<slug>.md` — Zero `src/` Reads Needed):**
  Write plain UTF-8 Markdown files directly to `workspace/bundle/references/<slug>.md` without importing `src/`. `loadWorkspaceLayers()` automatically hydrates up to **6 top-ranked** `references/*.md` files into Stage 1 `{{bundleContext}}` within a **`<= 12,000`-char (`~12 KB`) per-file cap AND a `36,000`-char (`~36 KB`) combined total budget** across all hydrated references—so when distilling 5–6 reference files, average **`<= 5.5–6 KB` per file** (focused on complete target chapters/sections rather than full multi-MB statutes):
  - **MANDATORY EXTRACTION INTEGRITY RULES (Enforced by `X-OKS-W01` / `X-OKS-W02` in `--validate-bundle --strict`):**
    1. **Inspect DOM/Schema First:** Always inspect 1 extracted XML/JSON record's actual element tags (e.g., `<article>` vs `<section>` vs `<entry>`) before writing element selectors.
    2. **Match Multi-Record Archive Entries by `<title>` Metadata (Never Guess Filename Date Prefixes):** When selecting records from multi-record bulk archives (`.tar.bz2`, `.tar.gz`, `.zip`, etc.), **never** guess filename date prefixes—always locate target records by searching `<title>` metadata inside the archive and populate the `Reference` frontmatter `title` directly from the extracted record's own `<title>` element rather than a hardcoded string.
    3. **Preserve Table Row Boundaries:** Convert HTML/XML `<tr>`/`<th>`/`<td>` tables into Markdown pipe rows (`| col1 | col2 |`) before stripping remaining tags—never flatten tables into whitespace where adjacent row values merge.
    4. **Fail Fast on `0` Matches (Never Slice Raw Preambles/ToCs):** If an element filter matches `0` nodes, `throw new Error(...)` immediately—**never** fall back to `rawText.slice(0, maxChars)` (which dumps preambles/tables of contents mid-word and triggers strict `X-OKS-W01`/`X-OKS-W02` failures). Always truncate only at complete unit/paragraph boundaries.
    5. **Zero Parametric Claims in `Reference` Frontmatter:** Keep `title` and `description` strictly neutral descriptions of the document/unit scope—**never** hardcode unverified classifications, categories, or numeric thresholds from parametric memory inside `title` or `description`.
  - `type: Reference`, `title`, `description`, `tags`, `status: stable`, optional `x-license` (never put `okf_version` or unprefixed `license` on individual concepts—`okf_version: "0.3"` and `license` belong only on bundle-root `workspace/bundle/index.md` per `SPEC.md` §§4.1 & 8.1; use `x-license` on concepts to avoid `I203` info notices).
  - `generated: { by: "<registry>-open-data-sync/1.0", at: "<RFC3339>" }`
  - `verified: [{ by: "<registry>-open-data-sync/1.0", at: "<RFC3339>" }]` (yields `trust_tier: machine-confirmed`)
  - `stale_after: "<RFC3339>"`
  - `sources: [{ id, resource, title, mime_type, retrieved_at, last_modified }]`—use `mime_type: "application/xml"` for XML/XHTML-namespaced records (appending `#<entry-path>`, e.g., `https://.../archive.tar.bz2#path/to/record.xml`, whenever multiple records come from the same bulk archive so cross-source deduplication preserves each record distinctly) and `mime_type: "application/json"` with each record's **canonical per-ID REST self-URI** (e.g., `https://data.<registry>/.../entities/<id>` rather than transient `?name=...` search URLs) for Axis 2 entity/establishment/site OpenAPI records.
  - Run `npm run cli:viz` (or `oks_compile_studio` / `--viz`) and `npm run cli:validate -- --strict` (or `oks_validate_bundle` — checks OKF v0.3 `E002, E004–E007`, `W101–W108, W110, W115–W118, W120, W122–W123, W125`, `I201, I203–I204`, plus `X-OKS-W01` mid-sentence truncation and `X-OKS-W02` missing scoped title targets) AND spot-check the generated `references/*.md` files to verify complete extracted units before running Stage 1.

---

## 2. Stage 1 Pure ICM + OKF v0.3 Audit & Intermission Checklist

After `--stage1` completes:
1. **Verify Filesystem Traces & Read Full `research_summary.md` End-to-End:**
   - `workspace/runs/<runId>/meta.json` (`stage1Telemetry`: `thinkingLevel`, `thoughtSteps`, `searchQueries`, `inputTokens`, `thoughtsTokens`, `outputTokens`, `totalTokens`, `durationMs`).
   - `stages/01_research/input/prompt_assembled.md` & `stages/01_research/output/thinking_trace.md`.
   - Read the **entire** `stages/01_research/output/research_summary.md` through the bottom Discrepancies / Source Conflicts / Intermission section right after Stage 1 finishes—**before** the turn that launches `cli:ping-pong` (never batch a partial top-of-file read in the same turn as `cli:ping-pong`)—alongside `workspace/bundle/` (`index.md`, `log.md`, `research/<slug>.md`).
2. **Source-Domain Provenance, Broken-Archive Mismatch & CSP Auto-Remediation (`machine-confirmed` — Before `cli:ping-pong`):**
   - Cross-check each source's `id`, `title`, `mime_type`, unwrapped `resource` URL, and `last_modified` timestamp (HTTP `Last-Modified` + W3C HTML `<meta>`/JSON-LD + ISO 32000 PDF `/ModDate` & XMP).
   - Verify formal alphanumeric IDs appear verbatim in grounded sources rather than echoed from search queries.
   - If Stage 1's body or bottom Discrepancies/Intermission section flags a broken archive/source mismatch (e.g., an archive `#<entry-path>` or hydrated `references/*.md` pointing to the wrong record), or if any source is an unambiguously superseded archive snapshot on a current-rule claim, triggered `[Provenance CSP Warning]` (`application/pdf` with `Content-Security-Policy: object-src 'none'`, causing `ERR_BLOCKED_BY_CLIENT` in Chromium inline viewers) when an equivalent canonical `text/html` authority page exists, or is a secondary business/directory aggregator when an official per-entity REST OpenAPI or registry page exists, complete `machine-confirmed` auto-remediation **before** launching `cli:ping-pong` and presenting Intermission Studio (re-syncing any mis-targeted `references/<slug>.md` by `<title>` metadata if applicable; `verifyOkfConcept` also automatically marks any `workspace/bundle/references/<slug>.md` whose `sources[]` are all rejected as `status: deprecated` so `loadWorkspaceLayers()` omits it on future runs):
     ```bash
     npm run cli:verify -- <runId> --by "icm-co-architect/gemini-4-argon" --replace-source <oldId=activeId_or_canonical_URL> [--reject-source <oldId>] --artifact-dir "<artifactDir>"
     # (or in Plugin Mode: node "<pluginRoot>/bin/oks.mjs" --cwd "<projectDir>" --verify <runId> ...)
     ```
3. **Post-Intermission Source Curation & Conflict Adjudication (`human-reviewed`):**
   - In Intermission Studio (`a2ui_studio.html`), interactive Section 6 conflict/discrepancy cards allow the human reviewer to approve source switches (`source-switch`), select the authoritative value between conflicting sources (`select-value`), or mark open gaps to check later (`open-gap` -> `check-later`) with optional reviewer notes.
   - When Ping-Pong wakes up from **`🚀 Approve & Send to AGY`**, apply all curated source and adjudication flags in `<50ms` at zero LLM token cost:
     ```bash
     npm run cli:verify -- <runId> --by "human:<reviewer>" [--replace-source <oldId=newIdOrUrl>] [--reject-source <id1,id2>] [--add-source "<url>[|<title>]"] [--resolve "<id=val>"] [--defer <id1,id2>] [--note "<id=text>"] --artifact-dir "<artifactDir>"
     # (or in Plugin Mode via `oks_verify_sources` with `replaceSourceMap`, `rejectSourceIds`, `addSources`, `resolveMap`, `deferIds`, `noteMap`, or `node "<pluginRoot>/bin/oks.mjs" --cwd "<projectDir>" --verify <runId> ...`)
     ```
   - Persists `x-adjudications` in `research_summary.md` and `workspace/bundle/research/<slug>.md` (`status: stable`, `trust_tier: human-reviewed`), automatically feeding `VERIFIED INTERMISSION ADJUDICATIONS` (`[RESOLVED]` authoritative values and `[CHECK LATER]` local verification items) into Stage 2.
4. **Strict OKF v0.3 Actor Hygiene (`SPEC.md` §7 `W103`):**
   - Actor strings (`generated.by`, `verified[].by`, `sources[].author`) must match `<producer>/<version>` or `<scheme>:<id>` with **no whitespace** (e.g., `icm-co-architect/gemini-4-argon`, `human:ana-lindqvist`, `team:safety-ops`). `verifyOkfConcept()` normalizes spaces to hyphens automatically.
