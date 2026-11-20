# Phase 5 Bespoke Domain Web Studio Reference (`src/server.ts` + `public/`)

Only build a custom Web Studio when the user explicitly selects Option 2 in Phase 5 *after* real Stage 1–4 artifacts exist in `workspace/runs/<runId>/`.

## 1. Design Around Real Artifacts (Never a Generic Form)
Inspect the actual JSON, OKF v0.3 Markdown, images, and WAV audio in `workspace/runs/<runId>/` first:
- **Course & Certification Studio:** 16:9 module visual viewer, synchronized HTML5 `<audio>` studio voiceover player, interactive checklist drawer, formative quiz runner, and scenario simulator.
- **Executive / Investment / Legal Intelligence Studio:** KPI thesis header, deep-dive analytical pillars, stress-test decision simulator, and side-by-side OKF v0.3 source provenance inspector.
- **Podcast & Briefing Studio:** Dual-speaker chapter timeline, waveform/audio player, and grounded show-notes editor.

## 2. Zero-Dependency Node HTTP Server (`src/server.ts`)
- Build `src/server.ts` with Node's built-in `node:http`, `node:fs`, and `node:path` modules (`0` external runtime npm dependencies).
- Pre-compile the declarative A2UI surface and Cytoscape graph (`oks_compile_studio` or `--a2ui <runId>`) so `a2ui.html` and `workspace/bundle/viz.html` can be linked or embedded directly.
- When rendering OKF v0.3 Markdown (`research_summary.md`) inside `public/index.html`:
  - Preprocess `[^id]` citations and `[^id]: Title` definitions into clickable superscript chips linked to `frontmatter.sources` (`mime_type`, `retrieved_at`, `last_modified`).
  - Intercept clicks on internal bundle links (`/research/<concept>.md`, `/references/<slug>.md`, or relative `./<slug>.md` resolved per OKF v0.3 §6) so they navigate within the studio rather than hitting a 404 route.
  - Strip `[^id]` footnotes, backticks, and inline LaTeX when rendering `- [ ]` checklists.
- In REST mutation endpoints:
  - `PUT /api/runs/:id/research`: call `syncRunToBundle()`, `generateBundleVisualization()`, and `generateA2uiSurface()`.
  - `POST /api/runs/:id/verify`: call `verifyOkfConcept()` (which syncs the bundle, normalizes OKF v0.3 actors, and refreshes `a2ui.html` + `viz.html`).
- Hydrate initial state from `workspace/runs/` on first paint at `http://localhost:3000`.
