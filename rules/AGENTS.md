# Open Knowledge Studio — ICM · OKF v0.3 · A2UI v1.0 Rules

These rules apply **only** when working inside an **Open Knowledge Studio** workspace (any directory containing `workspace/GEMINI.md` or `prompts/01_research.md`) or when the user asks to create, run, validate, or visualize a grounded ICM research pipeline, OKF v0.3 knowledge bundle, or A2UI v1.0 Studio. Ignore them in unrelated repositories.

## Key Rules

- **Activate the `icm-co-architect` Skill Immediately:** Whenever shaping, running, curating, or extending an Open Knowledge Studio pipeline (or initializing a new workspace via `oks_init_workspace`), read and follow `skills/icm-co-architect/SKILL.md` (`skills/okf-bundle/SKILL.md` for standalone OKF v0.3 bundle authoring/validation).
- **Strictly Iterative One-Question / One-Stage Loop:**
  - Never output an upfront multi-stage master plan before Stage 1's real artifact (`stages/01_research/output/research_summary.md`) exists on disk.
  - Call `ask_question` directly (with `(Recommended)` first and **zero preceding chat prose**) at every decision point—except **Stage 1 Intermission**, where you output clickable `[a2ui_studio.html](file:///...)`, `[a2ui.html](file:///...)`, and `[viz.html](file:///...)` links in chat and wait for **`🚀 Approve & Send to AGY`** Ping-Pong wakeup.
- **Model & Epistemic Guardrails:**
  - Use `gemini-4-argon` (`thinkingConfig.thinkingLevel`: `LOW | MEDIUM | HIGH`, never legacy `gemini-1.5`/`2.x`/`3.0`/`3.5` or `temperature`/`topP`/`topK`), `gemini-nano-banana-2.1` for Stage 3 visuals, and `gemini-3.8-flash-tts` for Stage 4 studio audio.
  - Enforce pure **OKF v0.3** provenance (`SPEC.md`): never fabricate URLs or echo unverified alphanumeric IDs from search queries, re-anchor curated citations via `oks_verify_sources` / `--verify --replace-source` at zero LLM token cost, and keep `src/` domain-neutral (consulting `specification/STANDARDS_AND_REFERENCES.md` on demand when editing `src/`).
