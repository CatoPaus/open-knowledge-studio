# Layer 1: Workspace Route Context (`CONTEXT.md`)

This workspace executes a four-stage sequential **100% Pure Interpretable Context Methodology (ICM)** pipeline integrated with the **Open Knowledge Format (`OKF v0.3` — `SPEC.md`)** and **A2UI v1.0**, where each stage communicates strictly through explicit filesystem artifacts on disk and compounds domain knowledge in `workspace/bundle/`:

1. **Stage 1 — Grounded Web Research & OKF v0.3 Concept Authoring (`stages/01_research`)**
   - **Model & Thinking**: `gemini-4-argon` (`thinkingLevel: HIGH` by default, `maxOutputTokens: 65536`) with Google Search grounding enabled via the Google AI Interactions API.
   - **Progressive Disclosure Input**: Reads `workspace/bundle/index.md`, fresh domain concepts (`now < stale_after`), and hydrated primary-registry reference records (`workspace/bundle/references/*.md`) so research builds upon verified knowledge.
   - **Output Artifact**: `stages/01_research/output/research_summary.md` (an OKF v0.3 Concept Document with YAML frontmatter `type`, `title`, `description`, `tags`, `status: draft`, `generated`, `stale_after`, and `sources`, plus `[^id]` footnotes in the body) and automatic augmentation-guarded sync to `workspace/bundle/research/`.
   - **Role**: Synthesize comprehensive, source-backed findings on the requested topic so downstream stages need zero external web access.

2. **Intermission — Human-in-the-Loop Inspection, Source Curation & OKF Verification (`--verify` / `--ping-pong`)**
   - **Role**: Between Stage 1 and Stage 2, a human reviewer curates citations and stamps human sign-off (`npm run cli:verify -- <runId> [--by human:<id>]` or via `a2ui.html` Ping-Pong to transition `status: stable` and `trust_tier: human-reviewed`), allowing Stage 2+ to re-run standalone at any time at zero Stage 1 token cost.

3. **Stage 2 — Structured Synthesis & Scriptwriting (`stages/02_script`)**
   - **Model & Thinking**: `gemini-4-argon` (`thinkingLevel: MEDIUM` by default, `maxOutputTokens: 32768`).
   - **Inputs**: `stages/01_research/output/research_summary.md` (Layer 4 prior-stage OKF artifact, checked for `trust_tier` and `is_stale` and recorded in `meta.json`) + `_config/voice_guide.md` (Layer 3 voice constraints).
   - **Output Artifact**: `stages/02_script/output/script_draft.json` (`{ title, scriptBody, totalEstimatedMinutes }` or expanded course/briefing schema — structured 1:1 read-along prose with verified `[^id]` inline citations resolved to clickable URLs in Studio and stripped silently for TTS, with zero raw URL leakage).

4. **Stages 3 & 4 (Optional Multimodal) + A2UI v1.0 Studio & OKF Graph (`stages/03_visuals`, `stages/04_audio`, `a2ui.html`, `viz.html`)**
   - **Role**: Generates optional 16:9 editorial illustrations (`gemini-nano-banana-2.1` via `cli:stage3`) and studio WAV voiceover (`gemini-3.8-flash-tts` or HTTP Open-TTS via `cli:stage4`), compiling verified artifacts into self-contained interactive **A2UI v1.0** surfaces (`a2ui.html`) and the Cytoscape.js knowledge graph explorer (`workspace/bundle/viz.html` via `cli:viz`).
