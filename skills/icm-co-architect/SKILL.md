---
name: icm-co-architect
description: >-
  Interactive one-step-at-a-time playbook for initializing, specializing, tuning, and debugging
  an Open Knowledge Studio (ICM + OKF v0.3 + A2UI v1.0) pipeline. Activate this skill whenever
  the user wants to build a grounded research course, briefing, memo, or audio/visual studio,
  customize stage contracts (01_research.md..04_audio.md), curate OKF v0.3 sources at Intermission,
  or scaffold a bespoke domain Web Studio.
---

# ICM Co-Architect Playbook (`ICM` · `OKF v0.3` · `A2UI v1.0`)

Guide the user through initializing, customizing, testing, and evolving their **Open Knowledge Studio** pipeline **one question and one stage at a time**.

## Step 0: Dual-Mode Execution (Cloned Template vs. Installed Plugin)

Determine how Open Knowledge Studio is active in the user's current workspace:
1. **Cloned Template Repo (`bin/oks.mjs` exists in workspace root):**
   - Run commands via `npm run cli:stage1`, `npm run cli:verify`, `npm run cli:stage2`, `npm run cli:stage3`, `npm run cli:stage4`, `npm run cli:a2ui`, `npm run cli:viz`, `npm run cli:status`, `npm run cli:validate`, or `node bin/oks.mjs ...`.
2. **Installed Plugin Mode (`workspace/GEMINI.md` or `prompts/01_research.md` absent, or `bin/oks.mjs` lives inside this plugin directory):**
   - Resolve `<pluginRoot>` as two levels above this `SKILL.md` (`<pluginRoot>/bin/oks.mjs`).
   - If the user's folder is not initialized yet, call the `oks_init_workspace` MCP tool (or run `node "<pluginRoot>/bin/oks.mjs" --init "<projectDir>"`) to scaffold clean `prompts/` + `workspace/` starter files **without** copying `src/` or `node_modules/`.
   - Execute pipeline stages with zero `npm install` via `node --env-file-if-exists=.env.local "<pluginRoot>/bin/oks.mjs" --cwd "<projectDir>" <flags>`, and use the zero-token MCP tools (`oks_status`, `oks_validate_bundle`, `oks_verify_sources`, `oks_compile_studio`, `oks_spec_check`) whenever convenient.

*(Throughout the phases below, `<OKS>` stands for `npm run` in a cloned repo or `node --env-file-if-exists=.env.local "<pluginRoot>/bin/oks.mjs" --cwd "<projectDir>"` in plugin mode.)*

---

## Core Discipline: Strictly One Question & One Stage at a Time

In ICM, Stage 2 (`prompts/02_script.md`) consumes the physical artifact written by Stage 1 (`stages/01_research/output/research_summary.md`), Stage 3/4 consume Stage 2, and any UI renders the real `workspace/runs/<runId>/` artifacts on disk. **Never** output a multi-step upfront master plan that rewrites Stage 1, Stage 2, and a UI before running Stage 1.

1. **Direct `ask_question` at Every Decision Point (Empty Chat Text):**
   - Call `ask_question` with `(Recommended)` first at **Question 1**, **Question 2**, **before Stage 2**, **after Stage 2**, **after Stage 3**, and **Phase 5 after Stage 4** (Stage 1 Intermission is the *only* step that pauses in chat with clickable links instead of `ask_question`, so the user can review sources and click **`🚀 Approve & Send to AGY`**).
   - **Mandatory Stage 1 Intermission Pause:** Upfront approval of `(Recommended)` choices (e.g., *"I approve all recommendations in advance"*) only auto-selects `ask_question` menus—you **MUST ALWAYS PAUSE** at Stage 1 Intermission (`a2ui_studio.html` + `cli:ping-pong`) and wait for post-Stage-1 human source sign-off. **Never** self-sign `--by "human:..."` before Intermission unless the user **explicitly** instructs to skip Intermission / skip source review.
   - **Never emit chat prose before `ask_question`** (prose ending in `:` can end the turn before `ask_question` fires). Fold any concise 1–3 sentence status/telemetry summary directly into `question`.
2. **Edit One Layer/Stage -> `--dry-run` -> Standalone Run -> Filesystem Audit:**
   - Preview at zero token cost (`--dry-run`), then run **only** that stage standalone. Whenever a live stage moves to a background task, end your turn immediately with zero `read_file` calls on pending outputs and wait for Reactive Wakeup.
   - Inspect `workspace/runs/<runId>/meta.json`, `input/prompt_assembled.md`, `output/thinking_trace.md`, and `output/<artifact>`.
3. **Engine Hygiene & Cross-Platform Shell:**
   - Never chain shell commands with `&&` (fails in Windows PowerShell 5.1); run separate commands.
   - Standard domain customization requires **zero edits in `src/`**. If extending [`src/`](../../src/CONTEXT.md), consult [`specification/STANDARDS_AND_REFERENCES.md`](../../specification/STANDARDS_AND_REFERENCES.md) on demand and run `node "<pluginRoot>/bin/oks.mjs" --test` (`tsc --noEmit` + full self-test suite).

---

## Phase 1: Domain Setup (Layers 0 & 1) + Silent Pre-Flight Registry Probe

1. **Question 1 (`ask_question`):** Use the workspace folder name (e.g., `icm-course-studio`, `icm-legal-review`) as a domain signal to pre-populate `(Recommended)` options for domain, target deliverable, and language/tone.
2. **Update Layer 0 (`workspace/GEMINI.md`) & Layer 1 (`workspace/CONTEXT.md`):**
   - Preserve the **Source-Authority Hierarchy** and **Verbatim Formal Identifiers (No Search-Query Self-Echo)** rules: never hardcode unverified alphanumeric statute/standard IDs from parametric memory into prompts, search by canonical document titles, and write formal IDs only when verbatim in a retrieved source.
   - For non-English pipelines, `runStage1Flow()` automatically synthesizes and caches `workspace/_config/locale.json` (`bcp47`, `languageName`, `ui`, `prosody`).
3. **Silent Dual-Axis Pre-Flight Open-Data Check (~3s, 0 LLM Tokens — Before Question 2):**
   - Read [references/open-data-and-intermission.md](./references/open-data-and-intermission.md) for full details.
   - **Axis 1 — Normative & Domain Registries (always active):** Check `search_marketplace`, read the **entire** `https://<primary-registry>/robots.txt` top-to-bottom (checking `User-agent: *`, `GPTBot`, `Google-Extended`, `ChatGPT-User`, and `/eli/`, `/search`, `/api` blocks), and run 1 `search_web("<registry> open data API OR OpenAPI")` query.
   - **Axis 2 — Entity, Establishment & Physical-Site Registries (when anchored to a named organization, facility, or street address):** Also check official keyless national legal-entity/establishment OpenAPIs (walking `sub-unit -> parent unit -> legal owner`) plus open-licensed address/cadastre, `OGC WFS` / `OGC API` building-point/footprint, and airborne LiDAR `DTM`/`DSM` terrain & roof-height (`DSM - DTM`) OpenAPIs (strictly keyless open-licensed public vector/elevation data—never scrape Street View/proprietary 3D/aerial imagery, login-gated cadastres, or interior floor plans).
   - Whenever `robots.txt` restricts crawlers in any stanza **or** an official Open Data / OpenAPI feed exists on either axis, make connecting Open Data into `workspace/bundle/references/<slug>.md` (via a unified or per-registry `.agents/plugins/<registry>-mcp/mcp/index.mjs`) the `(Recommended)` choice in Question 2.

---

## Phase 2: Stage 1 (`prompts/01_research.md`), Intermission Audit & Source Verification

1. **Question 2 (`ask_question`):** Confirm Stage 1 research scope, OKF v0.3 `type` (`Research Concept`, `Regulatory Guide`, `Reference`, `Specification`, `Playbook`, `Metric`), and Open-Data connection if discovered.
2. **Update `prompts/01_research.md` (Pure Ground-Truth Research Only):**
   - Keep `model: gemini-4-argon`, `thinkingLevel: HIGH`, `maxOutputTokens: 65536`, and `{{#if globalIdentity}}` / `{{#if workspaceContext}}` / `{{#if bundleContext}}`.
   - **Do NOT** ask Stage 1 for derived `- [ ]` checklists, quizzes, case exercises, or spoken scripts—defer those to Stage 2 after human source verification.
   - Require OKF v0.3 frontmatter (`type`, `title`, `description`, `tags`, `stale_after` in RFC 3339 UTC, and `sources: [{ id, resource, title }]`—never `okf_version` on concepts), `[^id]` inline footnotes + bottom definitions, explicit surfacing of source conflicts (`[^a]` vs `[^b]`), and preference for canonical `text/html` authority pages over static archive PDFs.
3. **Dry-Run, Standalone Stage 1 Run & Intermission Handoff:**
   - Preview with `--stage1 --dry-run "<topic>"`, then run `--stage1 --artifact-dir "<appDataDir>\brain\<conversation-id>" "<topic>"`.
   - Follow [references/open-data-and-intermission.md](./references/open-data-and-intermission.md):
     1. **Pre-Intermission Full-Document Read & `machine-confirmed` Auto-Remediation (`<50ms`, 0 LLM Tokens — Before `--ping-pong`):** Right after Stage 1 finishes, read the **entire** `research_summary.md` through its bottom Discrepancies/Intermission section and check stdout (`[Provenance CSP Warning]`) **before** launching `--ping-pong` (never batch a partial top-of-file read in the same turn as `--ping-pong`). Proactively auto-remediate any broken archive/source mismatch flagged by Stage 1 (and re-sync any mis-selected `references/<slug>.md` record by `<title>` metadata if applicable; `oks_verify_sources` / `--verify` also auto-deprecates `references/<slug>.md` files whose `sources[]` are all rejected), superseded archive snapshot, `CSP: object-src 'none'` browser-blocked PDF covered by an active official HTML page, or secondary business/directory aggregator covered by an official primary entity/statutory registry URL/OpenAPI via `oks_verify_sources` / `--verify <runId> --by "icm-co-architect/gemini-4-argon" --replace-source <oldId=newId_or_URL> [--reject-source <oldId>] --artifact-dir "<artifactDir>"` **before** starting `--ping-pong` (preserves `status: draft` with `trust_tier: machine-confirmed` per OKF v0.3 `SPEC.md` §§5.2–5.4).
     2. **Zero-Hit Registry Safety Net:** If a canonical primary registry not in `workspace/bundle/references/` has `0` entries in `sources[]`, include `🔌 Primary Registry & Open-Data / MCP Opportunity` in the Audit Report.
     3. **HTML Auxiliary Pane + Ping-Pong Listener:** When `hasAntigravityBrowserCapability()` is true, register `<artifactDir>/a2ui_studio.html` via 1-byte `write_file(Append: true, Content: "\n", ArtifactMetadata: ...)` and start `--ping-pong <runId>` in the background (`WaitMsBeforeAsync: 500`, `IsDaemon: false`).
     4. **Output Clickable Studio Links & End Turn (Mandatory Pause):** Output the Stage 1 Audit Report with clickable `[a2ui_studio.html](file:///...)`, `[a2ui.html](file:///...)`, and `[viz.html](file:///...)` links and **end your turn** (**never** call `ask_question` here, and **never** self-sign `--by "human:..."` without pausing here unless the user explicitly asked to skip Intermission).
4. **Human Sign-Off & Intermission Adjudication (`oks_verify_sources` / `--verify`):**
   - In Intermission Studio, interactive Section 6 conflict/discrepancy cards let the human reviewer approve source switches, pick the authoritative value between conflicting sources, or mark open gaps to check later. When Ping-Pong wakes you up (or the user curates/adjudicates in chat), run `oks_verify_sources` or `--verify <runId> --by "human:<reviewer-id>"` with any `--replace-source`, `--reject-source`, `--add-source`, `--resolve <id=val>`, `--defer <id>`, and `--note <id=text>` flags (`<50ms`, 0 tokens -> persists `x-adjudications` for Stage 2, sets `status: stable`, `trust_tier: human-reviewed`, refreshes `a2ui.html`, `viz.html`, `a2ui_studio.html`). Never hand-edit `research_summary.md` just to swap footnote IDs or record conflict decisions.

---

## Phase 3: Layer 3 (`voice_guide.md`) & Stage 2 (`prompts/02_script.md`)

1. **Question 3 (`ask_question`, empty chat text):** Ask what deliverable Stage 2 should produce (interactive course with modules/checklists/quiz/cases, executive/investment memo with pillars/stress-tests, podcast dialogue, etc.) and desired tone.
2. **Read [references/stage2-3-4-contracts.md](./references/stage2-3-4-contracts.md) & Edit `workspace/_config/voice_guide.md` + `prompts/02_script.md`:**
   - **CRITICAL:** Expand `prompts/02_script.md` YAML `output.schema` to include all chosen deliverable arrays (`checklistGroups[]`, `trainingModules[]` / `pillars[]`, `quiz[]` for courses only, `scenarios[]` / `stressTests[]`)—`/v1beta/interactions` strictly strips any key omitted from `output.schema`.
   - Default to **1:1 read-along single-field prose** (`scriptBody`, `narration`, `actionItem`—**omit** `spokenScript` / `spokenNarration` / `spokenActionItem` on prose courses & briefings so on-screen text and TTS audio match word-for-word; `prepareTextForStudioTts()` verbalizes `§`/`§§`, units, currencies, and ranges and strips `[^id]` silently for speech; reserve separate `spoken*` fields strictly for dense visual tables/equations or podcast shows). Cite verified Stage 1 `[^<source-id>]` keys inline on claims across `scriptBody`, `narration`, `actionItem`, `scenarios[*].recommendedAction`, and `quiz[*].explanation` (never raw `https://...` URLs, and never `[^id]` in `title`, `visualPrompt`, or `quiz[*].options`), and enforce multi-paragraph `\n\n` prose.
   - **Everyday Regional, Topographic & Building-Massing Visual Grounding (`overviewVisualPrompt` & `visualPrompt`):** Instruct `02_script.md` so English `visualPrompt` scene directions anchor settings in the target language/community's authentic everyday landscape, seasonal light, vernacular indoor/outdoor structures, and practical contemporary working attire (with subtle everyday regional textile/craft details where natural)—avoiding both generic metropolitan defaults and ceremonial/folkloric costume stereotypes during routine work. When Stage 1 includes verified site/cadastral/elevation facts (`DSM - DTM` roof height / story count, parcel outbuildings, ground elevation & inland plateau vs. shoreline terrain), ground exterior massing and topography in those verified measurements while keeping scenes **editorial illustrations** (never claiming photorealistic surveillance accuracy or inventing unverified façade paint colors / interior security layouts). For depicted documents, clipboards, checklists, binders, forms, or whiteboards, specify abstract text-free horizontal line strokes or clean geometric blocks rather than readable text or pseudo-text.
3. **Dry-Run & Standalone Stage 2 Run:**
   - Run `--stage2 --dry-run <runId>`, then `--stage2 --artifact-dir "<artifactDir>" <runId>`.
   - Refresh `a2ui_studio.html` via 1-byte `write_file(Append: true)` and immediately call `ask_question` (empty chat text) with Stage 2 telemetry and `(Recommended)` next-stage options (`Stage 3 Visuals`, `Stage 4 Studio Audio`, `Phase 5`).

---

## Phase 4: Multimodal Stages (`03_visuals.md` & `04_audio.md`)

Read [references/stage2-3-4-contracts.md](./references/stage2-3-4-contracts.md) for exact frontmatter templates—`runStage3Flow` and `runStage4Flow` are pre-wired in `src/` (zero engine edits needed):
- **Stage 3 (`prompts/03_visuals.md` -> `gemini-nano-banana-2.1`):** `output.format: image`, `aspectRatio: "16:9"`, `imageSize: "1K"`, strictly zero embedded text/pseudo-text/watermarks (depict documents, clipboards, checklists, binders, forms, or whiteboards with abstract text-free horizontal line strokes and clean geometric blocks), and ground `visualPrompt` scenes in authentic everyday regional architecture, landscape, and practical working attire (never folkloric/ceremonial stereotypes during routine work). Run `--stage3 --dry-run <runId>` then `--stage3 --artifact-dir "<artifactDir>" <runId>` and refresh `a2ui_studio.html`.
- **Pre-Stage-4 Native Catalog & Open-TTS Check (~3s, 0 Pipeline Tokens):** Before calling the Stage 4 `ask_question`:
  - If the workspace BCP-47 tag is natively supported by `gemini-3.8-flash-tts` (`isGeminiTtsNativelySupported(bcp47)`), offer **Single Locked Studio Voice** and **Role-Matched Dual-Voice Narration** (`dialogueMode: "semantic"`).
  - If the BCP-47 tag is **outside** `gemini-3.8-flash-tts`'s native catalog, mirror Step A.5 Open Data: check `search_marketplace`, run 1 `search_web("<language> neural text-to-speech REST API OR open TTS")` query, and verify any candidate public/university endpoint with a 1-sentence WAV probe (`parseWavMetadata`). Offer in `ask_question`: **(1) `(Recommended when public Open-TTS exists)` Connect Official Regional/Institutional Open-TTS** (`ttsProvider: "http"`, `ttsEndpoint` — single or semantic dual-voice + optional `.agents/plugins/<provider>-tts/`), **(2) Experimental Zero-Shot `gemini-3.8-flash-tts`** (`CreateVoice` auto-skipped), **(3) `/v1beta/voices` Voice Replication** (from user 10–30s WAV + consent WAV), or **(4) Skip Stage 4 Audio**.
- **Stage 4 (`prompts/04_audio.md` -> `gemini-3.8-flash-tts` or `ttsProvider: "http"`):** `output.format: audio`, explicit BCP-47 `languageCode`. Keep the `04_audio.md` body empty or `<= 80` chars (never inject `{{voiceGuide}}`, `{{slotTitle}}`, or English `"Preserve <Voice>'s..."` prompts on non-English locales). Run `--stage4 --dry-run <runId>` then `--stage4 --artifact-dir "<artifactDir>" <runId>`, refresh `a2ui_studio.html`, and call `ask_question` for Phase 5.

---

## Phase 5: A2UI v1.0 Studio Wrap-Up or Bespoke Domain Web Studio

Call `ask_question` directly (empty chat text) with `(Recommended)` first:
1. **`(Recommended) Complete Pipeline & Keep Self-Contained A2UI v1.0 Studio`** (`a2ui.html` / `a2ui_studio.html` + `viz.html`, validated via `oks_validate_bundle`),
2. **`Build a Bespoke Domain Web Studio (src/server.ts + public/)`** — read [references/phase5-web-studio.md](./references/phase5-web-studio.md) first, or
3. **`Keep as Pure Headless CLI Pipeline`**.

Once chosen, output the final summary with clickable `[a2ui_studio.html](file:///...)`, `[a2ui.html](file:///...)`, and `[viz.html](file:///...)` links. In a multi-course session, whenever recommending follow-up modules or next topics, call `ask_question` with `(Recommended)` next topics plus `"Finish Session"` (never a plain-text numbered list).
