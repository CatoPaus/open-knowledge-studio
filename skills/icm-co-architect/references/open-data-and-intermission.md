# Phase 1 Step A.5 Open-Data MCP Scaffolding & Phase 2 Intermission Audit Reference

## 1. Pre-Flight Primary-Registry & Open-Data MCP Plugin Scaffolding

Many official statutory, securities, clinical, patent, and standards registries split `robots.txt` rules (allowing partial `googlebot` routes at the top while setting `User-agent: *`, `GPTBot`, `Google-Extended`, or `ChatGPT-User` `Disallow: /` in lower stanzas, or blocking `/eli/`, `/search`, `/api` paths) while publishing official **Open Data archives or OpenAPI endpoints**.

### Pre-Flight Sequence (~3s, Zero LLM Tokens)
1. Check `search_marketplace` (when available) for an existing MCP plugin.
2. Read the **entire** `https://<primary-registry>/robots.txt` top-to-bottom—never stop at the first `User-agent: googlebot` stanza.
3. Run 1 targeted `search_web("<registry> open data API OR OpenAPI")` query (in the target language + English) and inspect any discovered OpenAPI/Swagger/developer docs to distinguish **keyless public Open Data feeds/archives** (`.tar.bz2`, `.tar.gz`, `.zip`, `.xml`, `.json`) from **`API_KEY`-gated `/search` or `/ai/` endpoints** (and check reuse license).

### Reusable Workspace MCP Plugin Layout (`.agents/plugins/<registry>-mcp/`)
Never write disposable Python/shell scripts in `scratch/`. Scaffold a zero-dependency Node.js workspace plugin:
- `.agents/plugins/<registry>-mcp/plugin.json`:
  Include standard Antigravity manifest fields (`name`, `displayName`, `description`, `author`, `homepage`, `repository`, `license`). Keep MCP servers in `mcp_config.json`, never inside `plugin.json`.
- `.agents/plugins/<registry>-mcp/mcp_config.json`:
  Use a globally unique prefixed server key (`"<registry>-open-data"`) and plugin-relative `"args": ["mcp/index.mjs"]`.
- `.agents/plugins/<registry>-mcp/mcp/index.mjs`:
  Resolve `REPO_ROOT = path.resolve(import.meta.dirname, '../../../..')` so both Antigravity (`mcp/index.mjs` from plugin root) and CLI sync (`node .agents/plugins/<registry>-mcp/mcp/index.mjs --sync`) resolve `workspace/bundle/references/` cleanly. Cache downloaded archives in gitignored `.cache/open-data/` using `curl.exe -sLo <file>` or Node `fetch()` to disk first, then extract via `tar -xf <file>` (**never** pipe binary `curl.exe | tar` in Windows PowerShell 5.1, which corrupts binary streams as UTF-16 text).
- **OKF v0.3 `type: Reference` Distillation (`workspace/bundle/references/<slug>.md` — Zero `src/` Reads Needed):**
  Write plain UTF-8 Markdown files directly to `workspace/bundle/references/<slug>.md` without importing `src/`. `loadWorkspaceLayers()` automatically hydrates up to **6 top-ranked** `references/*.md` files into Stage 1 `{{bundleContext}}` at **`<= 12,000` chars (`~12 KB`) per file**—so keep each distilled reference focused on the relevant chapters/sections (`<= 11.5 KB` body) rather than dumping full multi-MB archives:
  - `type: Reference`, `title`, `description`, `tags`, `status: stable`, optional `x-license` (never put `okf_version` or unprefixed `license` on individual concepts—`okf_version: "0.3"` and `license` belong only on bundle-root `workspace/bundle/index.md` per `SPEC.md` §§4.1 & 8.1; use `x-license` on concepts to avoid `I203` info notices).
  - `generated: { by: "<registry>-open-data-sync/1.0", at: "<RFC3339>" }`
  - `verified: [{ by: "<registry>-open-data-sync/1.0", at: "<RFC3339>" }]` (yields `trust_tier: machine-confirmed`)
  - `stale_after: "<RFC3339>"`
  - `sources: [{ id, resource, title, mime_type, retrieved_at, last_modified }]`—append `#<entry-path>` (e.g., `https://.../archive.tar.bz2#path/to/record.xml`) whenever multiple records come from the same bulk archive so cross-source deduplication preserves each record distinctly.
  - Run `npm run cli:viz` (or `oks_compile_studio` / `--viz`) and `npm run cli:validate -- --strict` (or `oks_validate_bundle`) so `workspace/bundle/index.md` reflects `trust_tier: machine-confirmed` with `0` errors, `0` warnings, and `0` info notices.

---

## 2. Stage 1 Pure ICM + OKF v0.3 Audit & Intermission Checklist

After `--stage1` completes:
1. **Verify Filesystem Traces:**
   - `workspace/runs/<runId>/meta.json` (`stage1Telemetry`: `thinkingLevel`, `thoughtSteps`, `searchQueries`, `inputTokens`, `thoughtsTokens`, `outputTokens`, `totalTokens`, `durationMs`).
   - `stages/01_research/input/prompt_assembled.md` & `stages/01_research/output/thinking_trace.md`.
   - `stages/01_research/output/research_summary.md` & `workspace/bundle/` (`index.md`, `log.md`, `research/<slug>.md`).
2. **Source-Domain Provenance, Edition Currency & CSP Audit:**
   - Cross-check each source's `id`, `title`, `mime_type`, unwrapped `resource` URL, and `last_modified` timestamp (HTTP `Last-Modified` + W3C HTML `<meta>`/JSON-LD + ISO 32000 PDF `/ModDate` & XMP).
   - Verify formal alphanumeric IDs appear verbatim in grounded sources rather than echoed from search queries.
   - If any source is an unambiguously superseded archive snapshot on a current-rule claim, or triggered `[Provenance CSP Warning]` (`application/pdf` with `Content-Security-Policy: object-src 'none'`, causing `ERR_BLOCKED_BY_CLIENT` in Chromium inline viewers) when an equivalent canonical `text/html` authority page exists, auto-remediate it **before** presenting the Studio:
     ```bash
     npm run cli:verify -- <runId> --by "icm-co-architect/gemini-4-argon" --replace-source <oldId=activeId_or_canonical_URL> [--reject-source <oldId>] --artifact-dir "<artifactDir>"
     # (or in Plugin Mode: node "<pluginRoot>/bin/oks.mjs" --cwd "<projectDir>" --verify <runId> ...)
     ```
3. **Strict OKF v0.3 Actor Hygiene (`SPEC.md` §7 `W103`):**
   - Actor strings (`generated.by`, `verified[].by`, `sources[].author`) must match `<producer>/<version>` or `<scheme>:<id>` with **no whitespace** (e.g., `icm-co-architect/gemini-4-argon`, `human:ana-lindqvist`, `team:safety-ops`). `verifyOkfConcept()` normalizes spaces to hyphens automatically.
