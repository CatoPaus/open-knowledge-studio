---
name: okf-bundle
description: >-
  Author, validate, consume, curate, and visualize Open Knowledge Format (OKF v0.3)
  knowledge bundles with zero Python or npm dependencies. Use when creating or migrating
  OKF v0.3 concept documents, running strict conformance checks (E002-E007, W101-W126),
  answering questions from a bundle with trust_tier and staleness reporting, or generating viz.html.
---

# Open Knowledge Format (`OKF v0.3`) Bundle Skill

Work with **OKF v0.3** knowledge bundles (`index.md`, `log.md`, and Markdown concept files with YAML 1.2 frontmatter) using Open Knowledge Studio's zero-dependency Node.js engine and MCP tools.

## 1. Zero-Dependency Tools (`oks_*` MCP & `bin/oks.mjs`)

Resolve `<pluginRoot>` as two levels above this `SKILL.md`:
- **Validate Bundle Conformance (`SPEC.md` §11):**
  - MCP: call `oks_validate_bundle` with `{ "bundleRoot": "<path/to/bundle>", "strict": true }`
  - CLI: `node "<pluginRoot>/bin/oks.mjs" --validate-bundle --strict "<path/to/bundle>"`
- **Generate Interactive Cytoscape Knowledge Graph (`viz.html`):**
  - CLI: `node "<pluginRoot>/bin/oks.mjs" --cwd "<projectDir>" --viz` (or call `oks_compile_studio`)
- **Curate & Verify Concept Provenance (`<50ms`, 0 LLM Tokens):**
  - MCP: call `oks_verify_sources` with `runIdOrPath`, `by` (`"human:<id>"` or `"<producer>/<version>"`), and optional `rejectSourceIds`, `replaceSourceMap`, `addSources`.

---

## 2. OKF v0.3 Authoring & Migration Rules (`SPEC.md`)

1. **Bundle-Root `index.md` vs. Concept Files (`SPEC.md` §§3.2, 8, 8.1, 9):**
   - Root `<bundle>/index.md` carries frontmatter with quoted `okf_version: "0.3"` (plus optional `title`, `description`, `license`, `x-*`).
   - Subdirectory `index.md` files and `<bundle>/log.md` (`## YYYY-MM-DD`, newest date first) **never** have frontmatter (`E004`, `E006`).
   - Every concept `.md` file **must** have unique YAML mapping keys (`E007`) and a non-empty string `type` (`Research Concept`, `Regulatory Guide`, `Reference`, `Metric`, `Playbook`, `Attested Computation`, etc.). Never put `okf_version` on a concept file (`I203`); prefix custom top-level extension keys with `x-`.
   - Dot-prefixed files/directories (`.cache/`, `.git/`) and `.md` files without `type` are skipped (`SPEC.md` §3.2).
2. **Timestamps, Actors & Lifecycle (`SPEC.md` §§5, 7):**
   - Write `generated.at`, `verified[].at`, `retrieved_at`, `last_modified`, and `stale_after` as RFC 3339 date-times with explicit offset (`2026-11-20T10:00:00Z`) so `verified[].at >= generated.at` comparisons are exact (`W122`).
   - Actor strings (`generated.by`, `verified[].by`, `sources[].author`) must match `<producer>/<version>` (`okf-sync/1.0`) or `<scheme>:<id>` (`human:ana-lindqvist`, `team:data-platform`) with **no spaces** (`W103`).
   - Lifecycle `status` is `draft`, `stable` (default when omitted), or `deprecated` (with optional `superseded_by: ./new-concept.md`).
3. **Strict Path Resolution (`SPEC.md` §6 — No `v0.2` Root Fallback):**
   - Paths starting with `/` resolve from the bundle root (`/references/std.md`).
   - Paths without leading `/` (`./sibling.md`, `../tables/orders.md`, `sibling.md`) resolve **strictly from the concept file's own directory**.
4. **3-Way Citation Parity (`SPEC.md` §5.1):**
   - Every inline `[^source-id]` citation in prose must have a matching entry in `frontmatter.sources[]` (`{ id, resource, title }`) and a trailing `[^source-id]: Title` definition.

---

## 3. Consuming an OKF v0.3 Bundle (Trust & Freshness Reporting)

When answering questions from an OKF v0.3 bundle:
1. Start at `<bundle>/index.md` (progressive disclosure) and read only relevant concepts.
2. Evaluate and surface the 3 normative epistemic signals for every cited concept:
   - **Current Status (`SPEC.md` §5.4):** Treat `draft`, `deprecated` (follow `superseded_by`), and unknown `status` values as non-current.
   - **Current-Only `trust_tier` (`SPEC.md` §5.3):** Count only `verified` events having both `by` and `at` where `at >= generated.at` (`human:<id>` -> `human-reviewed`; non-`human:` -> `machine-confirmed`; none or older than `generated.at` -> `unverified`).
   - **Staleness (`SPEC.md` §5.5):** Missing/null `stale_after` is fresh; `now >= stale_after` is stale; **any unparseable `stale_after` is never fresh** (`is_stale = true`).
