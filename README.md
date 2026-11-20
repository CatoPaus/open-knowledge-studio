# Open Knowledge Studio (`ICM` · `OKF v0.3` · `A2UI v1.0`)

**Open Knowledge Studio** (`open-knowledge-studio`) is a zero-dependency grounded research, compounding knowledge graph, and interactive surface engine built in TypeScript and Node.js. It unites three open architectural pillars on top of the **Google AI Interactions API (`/v1beta/interactions`)** and **Gemini 4 Argon (`gemini-4-argon`)**—with **zero runtime `npm` dependencies** and **zero external AI orchestration framework bloat**:

1. **Interpretable Context Methodology (`ICM` — [`RinDig/Interpretable-Context-Methodology`](https://github.com/RinDig/Interpretable-Context-Methodology), Jake Van Clief, [`arXiv:2603.16021`](https://arxiv.org/abs/2603.16021)):** A declarative, filesystem-first pipeline architecture where every context layer (`Layers 0–4`), assembled input prompt (`prompt_assembled.md`), reasoning/search trace (`thinking_trace.md`), and handoff artifact lives as plain Markdown or JSON on disk, paired with zero-token pipeline status inspection (`npm run cli:status`).
2. **Open Knowledge Format (`OKF v0.3` — [`open-knowledge-format/open-knowledge-format`](https://github.com/open-knowledge-format/open-knowledge-format)):** Grounded primary-source provenance (`retrieved_at`, HTTP/HTML/PDF `last_modified`), structural domain-mismatch detection, explicit source-conflict & evidence-gap surfacing, zero-token human citation curation (`cli:verify`), current-only `trust_tier` gating (`unverified` → `machine-confirmed` → `human-reviewed`), progressive disclosure (`bundle/index.md`), and a compounding multi-concept knowledge graph (`viz.html`).
3. **Agent-to-UI (`A2UI v1.0` — [`google/A2UI`](https://github.com/google/A2UI)) & Interactive Co-Architect Studio:** Compiles verified artifacts into declarative RFC 6901 JSON Pointer surfaces (`a2ui_surface.json` / `.jsonl` using `@path`, `@call`, and multi-catalog `@catalogId` bindings) and a self-contained, zero-CDN offline Studio (`a2ui.html`) featuring Stage-1 Intermission review with reactive loopback wakeup (`cli:ping-pong`), multi-run course/briefing switching, bilingual TTS, interactive checklists, case simulators, quizzes, and live knowledge graphs.

---

## Core Philosophy & Vision

This setup is a **filesystem-first, human-in-the-loop intelligence and production workbench** built on the **Interpretable Context Methodology (ICM)** rather than a black-box multi-agent framework:

### 1. The Filesystem *Is* the State Machine & Trace Log (ICM Layers 0–4)
Instead of trapping intermediate agent state inside in-memory framework closures or external telemetry daemons, every boundary in the pipeline is a **numbered folder and an inspectable file on disk** under `workspace/runs/<runId>/`:
* **Layer 0 & 1 (`workspace/GEMINI.md` + `workspace/CONTEXT.md`):** Global epistemic rules (strict fact-grounding, automatic language matching) and pipeline awareness injected into every stage.
* **Layer 2 (`prompts/01_research.md`, `prompts/02_script.md`):** Strict stage contracts and schemas parsed directly from Markdown files on disk.
* **Layer 3 (`workspace/_config/voice_guide.md`):** Reusable domain/style rules decoupled from the prompt logic.
* **Layer 4 (`research_summary.md`, `script_draft.json`):** Concrete artifacts that act as the *only* handoff between stages, paired with the exact assembled input prompt (`input/prompt_assembled.md`) and reasoning trace (`output/thinking_trace.md`) in every stage folder.

### 2. Asymmetric Cognitive Allocation on a Single Frontier Model (`gemini-4-argon`)
By locking the core reasoning runtime to **Gemini 4 Argon** (`src/`) and tuning `thinkingLevel` + capabilities per stage, you get deep reasoning where needed and strict determinism downstream:
* **Stage 1 (`01_research` — `HIGH` thinking + Google Search + `65,536` output budget):** Does the heavy lifting—multi-query live web research, deep strategic synthesis, and byte-accurate inline citation weaving (`cleanGroundingLinks`).
* **Stage 2 (`02_script` — `MEDIUM` thinking + zero web access):** Operates in a sealed sandbox using *only* the verified Stage 1 artifact and Layer 3 guide—so downstream deliverables can never introduce unverified claims.

### 3. Frictionless Human-in-the-Loop Iteration
Because every run lives in plain Markdown and JSON files on disk (`workspace/runs/<runId>/`), you can:
1. Preview the assembled 5-layer prompt at zero token cost (`--dry-run`) and run deep Stage 1 research once (`npm run cli:stage1`).
2. Curate and verify `research_summary.md` at `<50ms` and zero LLM token cost (`npm run cli:verify`) or refine `voice_guide.md` on disk.
3. Re-run Stage 2 (or downstream stages) standalone in seconds (`npm run cli:stage2 -- <runId>`) without re-running or paying for Stage 1 research again.

### 4. Declarative A2UI v1.0 Studio Out-of-the-Box + Optional Bespoke Domain UI
* **Zero-CDN A2UI Studio & OKF Graph Compiler (`src/a2ui/` & `src/viz/`):** Every Stage 1 and Stage 2 run automatically compiles declarative **A2UI v1.0** surface artifacts (`a2ui_surface.json` / `.jsonl`) and self-contained, offline-capable HTML apps (`a2ui.html` and `workspace/bundle/viz.html`) with built-in GFM Markdown, interactive SVG + Cytoscape knowledge graphs, 1-click source curation, and multi-run switching—at **`0` runtime npm dependencies**.
* **Optional Bespoke UI in Phase 5:** Because the engine (`bin/oks.mjs` + `src/`) ships zero framework bloat, once your pipeline stages (`01_research`, `02_script`, `03_...`, `04_...`) and real verified artifacts exist on disk, you can keep the built-in A2UI Studio / headless CLI pipeline or have the **Co-Architect** (`.agents/rules/icm-co-architect.md` & `skills/icm-co-architect/SKILL.md`) generate a bespoke domain web app tailored to your exact schema.

---

## Using as an Upstream Base / Template Repository

This repository is designed to serve as an **untouched upstream base template** (`CatoPaus/open-knowledge-studio`) for specialized downstream projects (e.g., `oks-course-studio`, `oks-legal-review`, `oks-podcast-studio`, `oks-equity-research`). Runtime outputs (`workspace/runs/`, `.cache/`) are excluded via `.gitignore` so the base repository remains clean.

### Starting a New Specialized Project

> **Important — Name Your Project Folder After Your Target Domain:**
> When you clone this template (`git clone https://github.com/CatoPaus/open-knowledge-studio.git <project-folder-name>`), the **Antigravity 2.0 Co-Architect** automatically reads your project directory name at `SessionStart` (via `.agents/hooks.json`) and uses it as an immediate semantic signal to pre-populate domain-specific recommendations and multiple-choice options during setup.
> * Example: Naming your folder `oks-course-studio` or `course-studio` automatically steers the Co-Architect's first interactive question and `(Recommended)` options toward online course creation.
> * Example: Naming your folder `podcast-studio`, `legal-review`, or `competitor-intel` automatically tailors its Layer 0–3, Stage 1–4, and Phase 5 UI recommendations to those domains.

```bash
# 1. Clone this base template repository into a domain-named project directory
git clone https://github.com/CatoPaus/open-knowledge-studio.git oks-course-studio
cd oks-course-studio

# 2. Rename 'origin' to 'upstream' (so 'upstream' always points to the untouched base template)
git remote rename origin upstream

# 3. Point 'origin' to your new specialized GitHub repository and push
git remote add origin https://github.com/CatoPaus/oks-course-studio.git
git push -u origin main

# 4. Configure your Gemini API key (runs natively on Node.js v22.15+ / v24+ with zero npm install;
#    optionally run `npm install` for local `tsc --noEmit` IDE/typecheck tooling)
echo 'GEMINI_API_KEY="your-gemini-api-key"' > .env.local
```

### Pulling Future Engine Upgrades into Specialized Projects
```bash
git fetch upstream
git checkout upstream/main -- bin/ src/ specification/
```

---

## Model & Thinking Level Architecture (`gemini-4-argon`)

All legacy text models (`gemini-2.5-*`, `gemini-3.5-*`, etc.) and deprecated sampling parameters (`temperature`, `topP`, `topK`) have been purged. **`gemini-4-argon`** is used across all text/reasoning stages, configured with stage-appropriate `thinkingConfig.thinkingLevel` (`LOW`, `MEDIUM`, `HIGH`), and paired with Google AI's Interactions API multimodal models when visual or audio stages are added:

| Pipeline Stage / Runner | Model & Thinking Level | `maxOutputTokens` | Context Window | Rationale |
| :--- | :--- | :--- | :--- | :--- |
| **Stage 1: In-Depth Research** (`prompts/01_research.md`) | `gemini-4-argon` — **`HIGH`** (fallback: `MEDIUM`) | `65536` *(max streaming)* | `1,048,576` | Maximizes reasoning depth for multi-source synthesis and Google Search grounding with verbatim citations. |
| **Stage 2+: Structured Synthesis** (`prompts/02_script.md`, `03_...`) | `gemini-4-argon` — **`MEDIUM`** (default) | `32768` | `1,048,576` | Balanced reasoning effort, latency, and token usage for structured JSON/Markdown generation from verified upstream artifacts. |
| **Optional Multimodal Stages** (`03_visuals`, `04_audio`) | `gemini-nano-banana-2.1` (`.jpg`/`.png` visuals)<br>`gemini-3.8-flash-tts` (`.wav` studio voiceover) | N/A | `131,072` | Pre-wired `/v1beta/interactions` runners (`cli:stage3`, `cli:stage4`) with magic-byte MIME fidelity and automatic A2UI Studio media hydration. |

### Token Limits & 1M Context Window Reference (`gemini-4-argon`)
* **Unified 1M Context Window (`1,048,576` tokens):** Shared across **Input + Thinking + Output**. Any stage can ingest up to ~1M tokens of source documents, transcripts, or prior-stage artifacts without code changes.
* **Standard / Streaming Output Ceiling (`65,536` tokens):** When using standard synchronous or SSE streaming requests (`background: false` on `/v1beta/interactions`), `max_output_tokens` caps combined thinking + output at **`65,536` tokens (64K)** per turn (setting `> 65536` without background mode returns HTTP `400`).
* **Future Option — Long Decode (`> 65,536` up to `1,048,576` output tokens):** If a single turn ever needs to generate more than 64K output tokens in one response, Gemini 4 Argon supports **Long Decode** on the Interactions API by enabling `background: true` and setting `max_output_tokens` between `262,144` and `1,048,576 - inputTokens`.

---

## Key Architectural & Reliability Features

1. **Full 5-Layer ICM Context Injection & Self-Documenting Stage Folders**
   * **Layer 0 (`workspace/GEMINI.md`):** Global identity, epistemic rigor, automatic language alignment, and Markdown citation rules.
   * **Layer 1 (`workspace/CONTEXT.md`):** Workspace pipeline routing and stage boundary awareness.
   * **Layer 2 (`prompts/01_research.md` & `prompts/02_script.md`):** Markdown stage contracts (YAML frontmatter + template) parsed directly by `loadStagePromptContract()` and `parseFrontmatterOutputSchema()` in `src/interactions/contracts.ts` (supporting flat scalars, scalar arrays like `string[]`, nested object arrays like `slides(array):`, and inline JSON Schema).
   * **Layer 3 (`workspace/_config/voice_guide.md`):** Global voice and pacing rules.
   * **Layer 4 (`workspace/runs/<runId>/stages/...`):** Every stage persists its exact assembled input prompt (`input/prompt_assembled.md`), its full reasoning & search trace (`output/thinking_trace.md`), and its final output artifact (`output/research_summary.md`, `output/script_draft.json`), plus token/latency telemetry in `workspace/runs/<runId>/meta.json`.
2. **Direct Interactions API SSE Streaming & Automatic Fallback (`streamGemini4ArgonInteraction`)**
   * Both Stage 1 and Stage 2 execute directly over native Node.js `fetch` SSE streaming (`stream: true` on `https://generativelanguage.googleapis.com/v1beta/interactions`), preventing 300-second `headersTimeout` disconnects during deep `HIGH`-thinking + Google Search turns.
   * Built-in `executeWithRetryAndFallback` automatically retries transient network/503/429 errors and falls back from `HIGH` to `MEDIUM` thinking on `gemini-4-argon` if needed.
3. **Sub-Second Grounding Citation Resolution & Per-Source Temporal Provenance (`resolveRedirect` & `cleanGroundingLinks`)**
   * Resolves `vertexaisearch.cloud.google.com/grounding-api-redirect/...` URLs using `redirect: 'manual'` first to read Google's `302 Location` header directly (~0.5s total for 100+ links) without timing out on unreachable third-party servers, while opportunistically capturing HTTP `Last-Modified` (`last_modified` in ISO 8601 UTC).
   * Stamps every grounded source in `sources[]` with `retrieved_at` (ISO 8601 UTC timestamp), preserves existing bundle `retrieved_at` timestamps across concept merges, weaves Interactions API `url_citation` annotations inline as `[^id]` footnotes at exact UTF-8 byte offsets, and renders `retrieved` / `last_modified` badges in `viz.html`.
4. **Dual-Mode Agent Plugin & Workspace Template (`.antigravity-plugin/plugin.json`, `mcp_config.json`, `skills/`, `.agents/`)**
   * **Installable Plugin Mode (`agy plugin install` / Claude Code / Codex CLI):** Ships `.antigravity-plugin/plugin.json`, `mcp_config.json` (`mcp/oks-mcp.mjs` zero-`node_modules` stdio MCP server exposing `oks_init_workspace`, `oks_status`, `oks_validate_bundle`, `oks_verify_sources`, `oks_compile_studio`, and `oks_spec_check`), `bin/oks.mjs` (native Node.js v22.15+/v24+ TypeScript type-stripping launcher), `rules/AGENTS.md`, `hooks.json` (`scripts/icm-hooks.mjs`), and progressive-disclosure skills (`skills/icm-co-architect/` & `skills/okf-bundle/`).
   * **Cloned Workspace Mode (`.agents/`):** Automatically activates `.agents/rules/icm-co-architect.md`, `.agents/skills.json`, and `.agents/hooks.json` when cloned directly as a standalone project repository.

---

## Directory Architecture

The workspace layout maps abstract context layers directly to disk directories:

```
.
├── .gitattributes               # Enforces clean LF line endings across Windows, macOS, and Linux
├── LICENSE                      # MIT License
├── .antigravity-plugin/
│   └── plugin.json              # Antigravity Plugin Manifest (agy plugin install / validate)
├── .claude-plugin/
│   └── marketplace.json         # Claude Code Plugin Marketplace Manifest
├── assets/
│   └── logo.svg                 # 128x128 Plugin Icon
├── bin/
│   └── oks.mjs                  # Zero-node_modules Node.js v22.15+/v24+ TypeScript CLI Launcher
├── mcp/
│   └── oks-mcp.mjs              # Zero-node_modules stdio JSON-RPC 2.0 MCP Server
├── mcp_config.json              # Plugin MCP Server Declaration (open-knowledge-studio)
├── hooks.json                   # Workspace-Scoped Plugin Lifecycle Hooks
├── rules/
│   └── AGENTS.md                # Workspace-Scoped Plugin Rules
├── skills/                      # Progressive-Disclosure Agent Skills (<24 KB per SKILL.md)
│   ├── icm-co-architect/        # Interactive 5-phase ICM + OKF v0.3 + A2UI v1.0 Co-Architect Playbook
│   └── okf-bundle/              # Standalone OKF v0.3 Authoring, Validation & Consumption Skill
├── SPEC.md                      # Open Knowledge Format (OKF v0.3) Upstream Specification
├── specification/               # Vendored A2UI v1.0 Schemas, Catalogs & 3-Pillar Upstream Lock
│   ├── STANDARDS_AND_REFERENCES.md # Normative ISO/RFC/W3C/IANA standards & provenance registry map
│   ├── UPSTREAM_LOCK.json       # Pinned ICM, OKF v0.3 & A2UI v1.0 upstream commits & versions
│   ├── versions.json            # Official A2UI protocol version registry
│   └── v1_0/                    # A2UI v1.0 Protocol Spec (docs/a2ui_protocol.md), Schemas & Catalogs
├── .agents/                     # Cloned Workspace Customizations (rules, skills.json, hooks.json)
├── package.json                 # Zero runtime dependencies (dev-only typescript & @types/node)
├── tsconfig.json
├── src/                         # Modular Zero-Dependency ICM + OKF v0.3 + A2UI v1.0 Engine
│   ├── CONTEXT.md               # Progressive-disclosure engine routing map & strict topological DAG
│   ├── index.ts                 # Public barrel re-exports + headless CLI flag dispatcher
│   ├── interactions/            # Google AI /v1beta/interactions SSE/REST clients, YAML contracts & WAV/FIR codecs
│   ├── okf/                     # OKF v0.3 YAML parser/serializer, provenance, grounding & bundle sync
│   ├── viz/                     # Cytoscape.js bundle graph compiler + standalone client/viz.{css,js}
│   ├── a2ui/                    # A2UI v1.0 compiler, RFC 6901 pointers, Ping-Pong & client/studio.{css,js}
│   ├── ops/                     # 3-pillar upstream spec:check & zero-token cli:status dashboard
│   ├── pipeline/                # 5-layer context loader, bilingual prosody & Stage 1–4 runners
│   └── tests/                   # Lazy-loaded zero-token self-test suite (--test)
├── prompts/                     # Layer 2: Stage Contracts (Markdown + YAML frontmatter)
│   ├── 01_research.md           # Stage 1 contract (gemini-4-argon, thinkingLevel: HIGH)
│   └── 02_script.md             # Stage 2 contract (gemini-4-argon, thinkingLevel: MEDIUM)
└── workspace/                   # Scoped Workspace Sandbox
    ├── GEMINI.md                # Layer 0: Global Identity Guide (OKF v0.3 Provenance)
    ├── CONTEXT.md               # Layer 1: Workspace Route Context
    ├── _config/                 # Layer 3: Global Reference Materials
    │   └── voice_guide.md       # Global brand voice tone
    ├── bundle/                  # Layer 3: Persistent OKF v0.3 Knowledge Bundle (Git-Tracked)
    │   ├── index.md             # Progressive disclosure directory listing (okf_version: "0.3")
    │   ├── log.md               # Chronological audit log (## YYYY-MM-DD)
    │   ├── viz.html             # Optional interactive Cytoscape.js + Marked graph explorer (--viz)
    │   └── research/            # Promoted OKF v0.3 concept documents (<concept>.md)
    └── runs/                    # Per-run isolated stage execution directories
        └── <runId>/
            ├── meta.json        # Run status + Stage 1 & 2 token/latency/search & OKF trust telemetry
            └── stages/
                ├── 01_research/
                │   ├── input/prompt_assembled.md
                │   └── output/
                │       ├── thinking_trace.md
                │       └── research_summary.md
                └── 02_script/
                    ├── input/prompt_assembled.md
                    └── output/
                        ├── thinking_trace.md
                        └── script_draft.json
```

---

## Setup & Installation (Plugin Mode or Cloned Workspace Mode)

### Option A — Install Globally as an Agent Plugin (Zero `npm install` Needed on Node.js 22.15+ / 24+)

Install the `icm-co-architect` and `okf-bundle` skills, zero-dependency `open-knowledge-studio` MCP server, and `bin/oks.mjs` engine into Antigravity, Claude Code, or Codex CLI:

| Tool | Install |
| :--- | :--- |
| **Antigravity CLI** (`1.3.2+`) | `agy plugin install https://github.com/CatoPaus/open-knowledge-studio` |
| **Claude Code** | `/plugin marketplace add CatoPaus/open-knowledge-studio`, then `/plugin install open-knowledge-studio@open-knowledge-studio` |
| **Codex CLI** | `codex plugin marketplace add CatoPaus/open-knowledge-studio`, then `codex plugin add open-knowledge-studio@open-knowledge-studio` |

Once installed as a plugin, open **any** empty project folder, set `GEMINI_API_KEY` in `.env.local` (or `~/.gemini/.env`), and ask the agent to initialize a studio (`oks_init_workspace` scaffolds only `prompts/` + `workspace/`, keeping your project folder completely free of engine source code).

### Option B — Clone as a Standalone Project Template

1. **Prerequisites:** Ensure you have **Node.js v22.15+ / v24+** installed (runs `bin/oks.mjs` directly with zero `node_modules`; run `npm install` only if you want local TypeScript IDE/typecheck tooling).
2. **API Key Configuration:** Create `.env.local` at the root of the project:
   ```env
   GEMINI_API_KEY="your-gemini-api-key"
   ```

---

## Running the ICM + OKF v0.3 + A2UI v1.0 Pipeline (`cli:status`, `cli:validate`, `cli:stage1`, `cli:ping-pong`, `cli:verify`, `cli:stage2`, `cli:viz`, `cli:a2ui`, `spec:check`, `cli`, `--dry-run`)

Because the ICM state lives in plain Markdown and JSON files on disk (`workspace/runs/<runId>/` and `workspace/bundle/`) and `bin/oks.mjs` + `src/` use pure cross-platform Node.js with zero external dependencies, you can run every stage standalone from any Windows, macOS, or Linux terminal, SSH session, Docker container, or cron job:

1. **Inspect current pipeline & OKF v0.3 bundle status at zero token cost (`cli:status` & `cli:validate`):**
   ```bash
   npm run cli:status
   npm run cli:validate -- --strict
   ```
   *(Scans `workspace/bundle/` and `workspace/runs/`, prints an ASCII pipeline flow dashboard `[01_research] ---> [OKF Gate] ---> [02_script] ---> [A2UI v1.0]`, trust tiers, staleness, source counts, token telemetry, and validates strict OKF v0.3 bundle conformance; pass `-- --json` for machine-readable JSON.)*
2. **Preview the assembled 5-layer prompt and Interactions API request at zero token cost (`--dry-run`):**
   ```bash
   npm run cli:stage1 -- --dry-run "Cloud Native Architecture in 2026"
   ```
   *(Writes `workspace/runs/_dry_run/stages/01_research/input/prompt_assembled.md` and prints the exact HTTP request headers and body with credentials redacted.)*
3. **Run Stage 1 only (recommended when testing/tuning `01_research.md` before Stage 2):**
   ```bash
   npm run cli:stage1 -- "Cloud Native Architecture in 2026"
   ```
   *(Stops at the Human-in-the-Loop Intermission gate after writing `input/prompt_assembled.md`, `output/thinking_trace.md`, `output/research_summary.md` with OKF v0.3 frontmatter + `[^id]` footnotes, syncing to `workspace/bundle/`, and logging token + OKF telemetry to `meta.json`.)*
4. **Curate sources and verify the Stage 1 OKF concept artifact at Intermission (`cli:verify` & `cli:ping-pong`):**
   ```bash
   npm run cli:ping-pong -- <runId>
   npm run cli:verify -- <runId> --by human:reviewer
   # Optional <50ms zero-token citation curation:
   # npm run cli:verify -- <runId> --replace-source old-id=https://example.gov/statute --reject-source weak-id --add-source "https://example.gov/guide|Official Guide" --by human:reviewer
   ```
   *(Listens for interactive Studio **`🚀 Approve & Send to AGY`** Ping-Pong sign-off or curates citations directly on disk, stamping `verified: [{ by: "human:reviewer", at: "..." }]` and `status: stable` to upgrade `trust_tier` to `human-reviewed` in both `research_summary.md` and `workspace/bundle/`.)*
5. **Run or re-run Stage 2 standalone after reviewing/verifying Stage 1 (supports `--dry-run`, `--verify`, and `--a2ui`):**
   ```bash
   npm run cli:stage2 -- --dry-run <runId>
   npm run cli:stage2 -- <runId>
   ```
6. **Generate the zero-dependency interactive OKF Knowledge Graph Explorer (`cli:viz`):**
   ```bash
   npm run cli:viz
   ```
   *(Walks `workspace/bundle/` and writes a self-contained single-file `workspace/bundle/viz.html` with Cytoscape.js force-directed graph, trust-tier & staleness badges, and bidirectional backlinks.)*
7. **Compile the Declarative A2UI v1.0 Surface & Bi-Directional Studio (`cli:a2ui`):**
   ```bash
   npm run cli:a2ui -- <runId>
   ```
   *(Compiles the run's Stage 1 OKF v0.3 Markdown, Stage 2 JSON, and OKF Bundle into declarative **A2UI v1.0** surface artifacts (`workspace/runs/<runId>/stages/02_script/output/a2ui_surface.json` and `a2ui_surface.jsonl` with `version: "1.0"`, `createSurface`, `updateComponents`, and `updateDataModel` bound via `@path` RFC 6901 JSON Pointers and `@call` functions) plus a self-contained **A2UI Studio HTML app** (`workspace/runs/<runId>/a2ui.html` and `workspace/bundle/a2ui.html`) implementing both **Tier 1 Basic Catalog Primitives** (`Tabs`, `Card`, `Row`, `Column`, `List`, `Text`, `CheckBox`, `ChoicePicker`, `TextField`, `DateTimeInput`, `Slider`, `Button`, `AudioPlayer`, `Video`, `Image`, `Icon`, `Divider`, `Modal`) and **`@catalogId`-scoped Tier 2 ICM + OKF Domain Components** (`Badge`, `SpeechPlayer`, `OkfMarkdown`, `OkfKnowledgeGraph`, `FlowDiagram`, `InteractiveChecklist`, `ModuleCarousel`, `QuizRunner`, `CaseSimulator`). See [`specification/v1_0/docs/a2ui_protocol.md`](./specification/v1_0/docs/a2ui_protocol.md) for the upstream A2UI v1.0 protocol specification.)*
8. **Or run the full pipeline (Stage 1 + Stage 2) in one pass:**
   ```bash
   npm run cli -- "Cloud Native Architecture in 2026"
   ```
9. **Read the final Stage 2 output:**
   ```bash
   cat workspace/runs/<runId>/stages/02_script/output/script_draft.json
   ```
10. **Check all three upstream open pillars (`ICM`, `OKF v0.3`, `A2UI v1.0`) against live GitHub commits & versions (`spec:check`):**
   ```bash
   npm run spec:check
   ```
   *(Compares [`specification/UPSTREAM_LOCK.json`](./specification/UPSTREAM_LOCK.json) against `RinDig/Interpretable-Context-Methodology`, `open-knowledge-format/open-knowledge-format`, and `google/A2UI` so new protocol releases or upstream convention updates are detected deterministically.)*

### Multimodal Stage Expansion (`cli:stage3`, `cli:stage4`, `gemini-nano-banana-2.1`, `gemini-3.8-flash-tts`, & `gemini-api` CLI)
`src/pipeline/` and `src/interactions/` ship with pre-wired Phase 4 multimodal runners (`runStage3Flow` / `npm run cli:stage3` and single- or multi-speaker `runStage4Flow` / `npm run cli:stage4`), Layer 3 `workspace/_config/locale.json` prosody normalization (`prepareTextForStudioTts`), magic-byte binary MIME/extension detection (`detectMediaMimeAndExtension`), and automatic A2UI v1.0 media hydration (`overview_hero_image`, `ModuleCarousel` `16:9` figures, and `SpeechPlayer` studio `<audio>` controls — deduplicating lossless `24 kHz` PCM16 WAV `data:` URIs inside `window.A2UI_SURFACE_PAYLOAD.mediaUrisByRun` when syncing `a2ui_studio.html` for full native studio sound quality in single-file HTML playback while keeping `a2ui_surface.json` lightweight). Simply add `prompts/03_visuals.md` (`output.format: image`) or `prompts/04_audio.md` (`output.format: audio`, using `voice` for single-speaker or `primaryVoice`/`secondaryVoice` for multi-speaker dialogue) and run:
```bash
npm run cli:stage3 -- --dry-run <runId>
npm run cli:stage3 -- <runId>

npm run cli:stage4 -- --dry-run <runId>
npm run cli:stage4 -- <runId>
```

For ad-hoc media generation, generative video (`gemini-omni-1.2-flash`), or pre-Stage-1 PDF/video corpus analysis, you can also use Google AI Studio's stateless **`gemini-api` CLI** (`google-gemini/gemini-api-cli`):
* **Install `gemini-api`:**
  * **Linux / macOS:**
    ```bash
    curl -fsSL https://raw.githubusercontent.com/google-gemini/gemini-api-cli/main/scripts/install.sh | bash
    ```
  * **Windows (Direct GitHub Release ZIP — avoids Defender AMSI false-positives on `iwr | iex`):**
    Download `gemini-api_Windows_x86_64.zip` from [github.com/google-gemini/gemini-api-cli/releases/latest](https://github.com/google-gemini/gemini-api-cli/releases/latest) and extract `gemini-api.exe` into your `PATH` (e.g., `%LOCALAPPDATA%\Programs\gemini-api`).
* **Example Multimodal Stage Commands (Writing Directly into ICM Stage Folders):**
  ```bash
  # Stage 3 Visuals: Generate slide or illustration assets (gemini-nano-banana-2.1)
  gemini-api image "Minimalist architectural diagram of a cloud-native mesh" \
    --out workspace/runs/<runId>/stages/03_visuals/output/overview.jpg

  # Stage 4 Audio: Generate spoken voiceover from Stage 2 script (gemini-3.8-flash-tts)
  gemini-api tts "Welcome to Module 1..." \
    --out workspace/runs/<runId>/stages/04_audio/output/overview.wav

  # Pre-Stage 1 Local Corpus Analysis: Analyze local PDFs or videos into Stage 1 input
  gemini-api analyze -i ./workspace/_config/reference.pdf "Extract all regulatory requirements"
  ```

---

## Standards, Specifications & Normative References

Every formal specification, ISO / IETF RFC / W3C / IANA standard, recognized standards-body prefix (`ISO`, `IEC`, `IEEE`, `RFC`, `CVE`, etc.), shared government umbrella portal, and external runtime API or progressive-enhancement script used by Open Knowledge Studio is cataloged and cross-linked to its implementation files in [`specification/STANDARDS_AND_REFERENCES.md`](./specification/STANDARDS_AND_REFERENCES.md) (alongside [`SPEC.md`](./SPEC.md), [`specification/v1_0/docs/a2ui_protocol.md`](./specification/v1_0/docs/a2ui_protocol.md), and [`specification/UPSTREAM_LOCK.json`](./specification/UPSTREAM_LOCK.json)).

---

## Cleaning Up the Workspace

To clean up and reset the workspace (deleting all active stage outputs and cached telemetry files), run:
```bash
npm run clean
```

---

## License

Released under the [MIT License](./LICENSE).

