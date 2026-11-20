---
name: icm-co-architect
description: >-
  Interactive one-step-at-a-time playbook for specializing, tuning, and debugging
  an Open Knowledge Studio (ICM + OKF v0.3 + A2UI v1.0) pipeline. Activate this skill whenever
  the user wants to build a grounded research course, briefing, memo, or audio/visual studio,
  customize stage contracts (01_research.md..04_audio.md), curate OKF v0.3 sources at Intermission,
  or scaffold a bespoke domain Web Studio.
---

# ICM Co-Architect Playbook (`ICM` · `OKF v0.3` · `A2UI v1.0`)

Guide the user through customizing, testing, and evolving their **Open Knowledge Studio** pipeline **one question and one stage at a time**.

## Core Discipline: Strictly One Question & One Stage at a Time

In ICM, Stage 2 (`prompts/02_script.md`) consumes the physical artifact written by Stage 1 (`stages/01_research/output/research_summary.md`), Stage 3/4 consume Stage 2, and any UI renders the real `workspace/runs/<runId>/` artifacts on disk. **Never** output a multi-step upfront master plan that rewrites Stage 1, Stage 2, and a UI before running Stage 1.

1. **Direct `ask_question` at Every Decision Point (Empty Chat Text):**
   - Call `ask_question` with `(Recommended)` first at **Question 1**, **Question 2**, **before Stage 2**, **after Stage 2**, **after Stage 3**, and **Phase 5 after Stage 4** (Stage 1 Intermission is the *only* step that pauses in chat with clickable links instead of `ask_question`, so the user can review sources and click **`🚀 Approve & Send to AGY`**).
   - **Never emit chat prose before `ask_question`** (prose ending in `:` can end the turn before `ask_question` fires). Fold any concise 1–3 sentence status/telemetry summary directly into `question`.
2. **Edit One Layer/Stage -> `--dry-run` -> Standalone Run -> Filesystem Audit:**
   - Preview at zero token cost (`npm run cli:stage1 -- --dry-run "<topic>"`), then run **only** that stage standalone (`cli:stage1`..`cli:stage4`, `cli:status`, `cli:validate`). Whenever a live stage moves to a background task, end your turn immediately with zero `read_file` calls on pending outputs and wait for Reactive Wakeup.
   - Inspect `workspace/runs/<runId>/meta.json`, `input/prompt_assembled.md`, `output/thinking_trace.md`, and `output/<artifact>`.
3. **Engine Hygiene & Cross-Platform Shell:**
   - Never chain shell commands with `&&` (fails in Windows PowerShell 5.1); run separate commands.
   - Standard domain customization requires **zero edits in `src/`**. If extending [`src/`](../../../src/CONTEXT.md), consult [`specification/STANDARDS_AND_REFERENCES.md`](../../../specification/STANDARDS_AND_REFERENCES.md) on demand and run `npm test` (`tsc --noEmit` + full self-test suite).

---

## Phase 1: Domain Setup (Layers 0 & 1) + Silent Pre-Flight Registry Probe

1. **Question 1 (`ask_question`):** Use the workspace folder name (e.g., `icm-course-studio`, `icm-legal-review`) as a domain signal to pre-populate `(Recommended)` options for domain, target deliverable, and language/tone.
2. **Update Layer 0 (`workspace/GEMINI.md`) & Layer 1 (`workspace/CONTEXT.md`):**
   - Preserve the **Source-Authority Hierarchy** and **Verbatim Formal Identifiers (No Search-Query Self-Echo)** rules: never hardcode unverified alphanumeric statute/standard IDs from parametric memory into prompts, search by canonical document titles, and write formal IDs only when verbatim in a retrieved source.
   - For non-English pipelines, `runStage1Flow()` automatically synthesizes and caches `workspace/_config/locale.json` (`bcp47`, `languageName`, `ui`, `prosody`).
3. **Silent Pre-Flight Primary-Registry & Open-Data Check (~3s, 0 LLM Tokens — Before Question 2):**
   - Read [references/open-data-and-intermission.md](./references/open-data-and-intermission.md) for full details.
   - Check `search_marketplace`, read the **entire** `https://<primary-registry>/robots.txt` top-to-bottom (checking `User-agent: *`, `GPTBot`, `Google-Extended`, `ChatGPT-User`, and `/eli/`, `/search`, `/api` blocks), and run 1 `search_web("<registry> open data API OR OpenAPI")` query.
   - If `robots.txt` restricts crawlers in any stanza **or** an official Open Data / OpenAPI feed exists, make connecting Open Data into `workspace/bundle/references/<slug>.md` (via `.agents/plugins/<registry>-mcp/mcp/index.mjs`) the `(Recommended)` choice in Question 2.

---

## Phase 2: Stage 1 (`prompts/01_research.md`), Intermission Audit & Source Verification

1. **Question 2 (`ask_question`):** Confirm Stage 1 research scope, OKF v0.3 `type` (`Research Concept`, `Regulatory Guide`, `Reference`, `Specification`, `Playbook`, `Metric`), and Open-Data connection if discovered.
2. **Update `prompts/01_research.md` (Pure Ground-Truth Research Only):**
   - Keep `model: gemini-4-argon`, `thinkingLevel: HIGH`, `maxOutputTokens: 65536`, and `{{#if globalIdentity}}` / `{{#if workspaceContext}}` / `{{#if bundleContext}}`.
   - **Do NOT** ask Stage 1 for derived `- [ ]` checklists, quizzes, case exercises, or spoken scripts—defer those to Stage 2 after human source verification.
   - Require OKF v0.3 frontmatter (`type`, `title`, `description`, `tags`, `stale_after` in RFC 3339 UTC, and `sources: [{ id, resource, title }]`—never `okf_version` on concepts), `[^id]` inline footnotes + bottom definitions, explicit surfacing of source conflicts (`[^a]` vs `[^b]`), and preference for canonical `text/html` authority pages over static archive PDFs.
3. **Dry-Run, Standalone Stage 1 Run & Intermission Handoff:**
   - Preview with `npm run cli:stage1 -- --dry-run "<topic>"`, then run `npm run cli:stage1 -- --artifact-dir "<appDataDir>\brain\<conversation-id>" "<topic>"`.
   - Follow [references/open-data-and-intermission.md](./references/open-data-and-intermission.md):
     1. **Pre-Intermission `machine-confirmed` Auto-Remediation (`<50ms`, 0 LLM Tokens):** Inspect `research_summary.md` `sources[]` and stdout (`[Provenance CSP Warning]`). Proactively swap any superseded archive snapshot or `CSP: object-src 'none'` browser-blocked PDF covered by an active official HTML page via `npm run cli:verify -- <runId> --by "icm-co-architect/gemini-4-argon" --replace-source <oldId=newId_or_URL>` (preserves `status: draft` with `trust_tier: machine-confirmed` per OKF v0.3 `SPEC.md` §§5.2–5.4).
     2. **Zero-Hit Registry Safety Net:** If a canonical primary registry not in `workspace/bundle/references/` has `0` entries in `sources[]`, include `🔌 Primary Registry & Open-Data / MCP Opportunity` in the Audit Report.
     3. **HTML Auxiliary Pane + Ping-Pong Listener:** When `hasAntigravityBrowserCapability()` is true, register `<artifactDir>/a2ui_studio.html` via 1-byte `write_file(Append: true, Content: "\n", ArtifactMetadata: ...)` and start `npm run cli:ping-pong -- <runId>` in the background (`WaitMsBeforeAsync: 500`, `IsDaemon: false`).
     4. **Output Clickable Studio Links & End Turn:** Output the Stage 1 Audit Report with clickable `[a2ui_studio.html](file:///...)`, `[a2ui.html](file:///...)`, and `[viz.html](file:///...)` links and end your turn (**never** call `ask_question` here).
4. **Human Sign-Off (`npm run cli:verify`):**
   - When Ping-Pong wakes you up (or the user approves/curates sources), run `npm run cli:verify -- <runId> --by "human:<reviewer-id>"` with any `--reject-source`, `--replace-source`, or `--add-source` flags (`<50ms`, 0 tokens -> `status: stable`, `trust_tier: human-reviewed`, refreshes `a2ui.html`, `viz.html`, `a2ui_studio.html`). Never hand-edit `research_summary.md` just to swap footnote IDs.

---

## Phase 3: Layer 3 (`voice_guide.md`) & Stage 2 (`prompts/02_script.md`)

1. **Question 3 (`ask_question`, empty chat text):** Ask what deliverable Stage 2 should produce (interactive course with modules/checklists/quiz/cases, executive/investment memo with pillars/stress-tests, podcast dialogue, etc.) and desired tone.
2. **Read [references/stage2-3-4-contracts.md](./references/stage2-3-4-contracts.md) & Edit `workspace/_config/voice_guide.md` + `prompts/02_script.md`:**
   - **CRITICAL:** Expand `prompts/02_script.md` YAML `output.schema` to include all chosen deliverable arrays (`checklistGroups[]`, `trainingModules[]` / `pillars[]`, `quiz[]` for courses only, `scenarios[]` / `stressTests[]`)—`/v1beta/interactions` strictly strips any key omitted from `output.schema`.
   - Enforce multi-paragraph `\n\n` prose, clean visual notation (`$2.5B`, `2.5 ± 0.1 g/cm³`, canonical statute titles), and zero URLs or `[^id]` tags in spoken fields.
3. **Dry-Run & Standalone Stage 2 Run:**
   - Run `npm run cli:stage2 -- --dry-run <runId>`, then `npm run cli:stage2 -- --artifact-dir "<artifactDir>" <runId>`.
   - Refresh `a2ui_studio.html` via 1-byte `write_file(Append: true)` and immediately call `ask_question` (empty chat text) with Stage 2 telemetry and `(Recommended)` next-stage options (`Stage 3 Visuals`, `Stage 4 Studio Audio`, `Phase 5`).

---

## Phase 4: Multimodal Stages (`03_visuals.md` & `04_audio.md`)

Read [references/stage2-3-4-contracts.md](./references/stage2-3-4-contracts.md) for exact frontmatter templates—`runStage3Flow` and `runStage4Flow` are pre-wired in `src/` (zero engine edits needed):
- **Stage 3 (`prompts/03_visuals.md` -> `gemini-nano-banana-2.1`):** `output.format: image`, `aspectRatio: "16:9"`, `imageSize: "1K"`, strictly zero embedded text/watermarks. Run `npm run cli:stage3 -- --dry-run <runId>` then `npm run cli:stage3 -- --artifact-dir "<artifactDir>" <runId>`, refresh `a2ui_studio.html`, and call `ask_question` offering both **Single Locked Studio Voice** and **Role-Matched Dual-Voice Narration** (`dialogueMode: "semantic"`).
- **Stage 4 (`prompts/04_audio.md` -> `gemini-3.8-flash-tts`):** `output.format: audio`, explicit BCP-47 `languageCode`, `sampleRate: 24000`. Keep the `04_audio.md` body empty or `<= 80` chars (never inject `{{voiceGuide}}`, `{{slotTitle}}`, or English `"Preserve <Voice>'s..."` prompts on non-English locales—let Layer 3 `locale.json` native `voicePersonas` + `voice_locks.json` + `<= 950`-char chunking lock dialect and timbre). Run `npm run cli:stage4 -- --dry-run <runId>` then `npm run cli:stage4 -- --artifact-dir "<artifactDir>" <runId>`, refresh `a2ui_studio.html`, and call `ask_question` for Phase 5.

---

## Phase 5: A2UI v1.0 Studio Wrap-Up or Bespoke Domain Web Studio

Call `ask_question` directly (empty chat text) with `(Recommended)` first:
1. **`(Recommended) Complete Pipeline & Keep Self-Contained A2UI v1.0 Studio`** (`a2ui.html` / `a2ui_studio.html` + `viz.html`, validated via `npm run cli:validate -- --strict`),
2. **`Build a Bespoke Domain Web Studio (src/server.ts + public/)`** — read [references/phase5-web-studio.md](./references/phase5-web-studio.md) first, or
3. **`Keep as Pure Headless CLI Pipeline`**.

Once chosen, output the final summary with clickable `[a2ui_studio.html](file:///...)`, `[a2ui.html](file:///...)`, and `[viz.html](file:///...)` links.
