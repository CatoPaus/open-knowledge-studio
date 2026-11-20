# A2UI v1.0 Compiler, Bi-Directional Studio & Ping-Pong Bridge (`src/a2ui/CONTEXT.md`)

Compiles Stage 1 OKF v0.3 artifacts, Stage 2 structured JSON, Stage 3 visuals, Stage 4 studio narration, and the persistent OKF bundle into declarative **A2UI v1.0** surfaces (`a2ui_surface.json` / `.jsonl`) and self-contained **A2UI Studio** apps (`a2ui.html` / `a2ui_studio.html`).

---

## Chunk Map

| File | Responsibility | Key Exports |
| :--- | :--- | :--- |
| [`types.ts`](./types.ts) | A2UI v1.0 protocol constants (`version: "1.0"`), message envelope types (`createSurface`, `updateComponents`, `updateDataModel`), and `A2uiSurfaceGenerationOptions` / `Result`. | `A2UI_PROTOCOL_VERSION`, `A2UI_BASIC_CATALOG_ID`, `A2UI_ICM_CATALOG_ID`, `A2uiComponent`, `A2uiEnvelopeMessage` |
| [`browser-bridge.ts`](./browser-bridge.ts) | Cross-platform browser launcher (`--open`), Antigravity 2.0 `/browser` capability detector, artifact-pane HTML copier, and one-shot `127.0.0.1:44820` Ping-Pong Reactive Wakeup HTTP listener + auto-close helper. | `openFileInSystemBrowser`, `syncA2uiToArtifactDir`, `hasAntigravityBrowserCapability`, `startA2uiPingPongListener`, `closeActiveA2uiPingPongListener` |
| [`catalog-schema.ts`](./catalog-schema.ts) | Runtime descriptor for Tier 1 Basic Catalog + Tier 2 ICM/OKF Domain Catalog (`Badge`, `SpeechPlayer`, `OkfMarkdown`, `OkfKnowledgeGraph`, `InteractiveChecklist`, `ModuleCarousel`, `QuizRunner`, `CaseSimulator`). | `A2UI_ICM_CATALOG_SCHEMA`, `escapeA2uiHtml` |
| [`normalize.ts`](./normalize.ts) | Inline LaTeX math detection (`$...$`), Markdown checklist extraction/cleaning, and flexible Stage 2 JSON normalization (`course` modules/quizzes/cases and `analysis` pillars/stress-tests). | `isInlineLatexMathSpan`, `replaceInlineLatexSpansTs`, `cleanChecklistLabel`, `extractChecklistGroupsFromMarkdown`, `normalizeStage2ForA2ui` |
| [`schema.ts`](./schema.ts) | RFC 6901 JSON Pointer resolver/mutator (`resolveJsonPointer`, `setJsonPointer`), media URL allowlist, and strict validator against `specification/v1_0/catalogs/*/catalog.json`. | `resolveJsonPointer`, `setJsonPointer`, `isAllowedA2uiMediaUrl`, `loadA2uiCatalogComponentRequirements`, `validateA2uiSurfaceMessages` |
| [`client-assets.ts`](./client-assets.ts) | Loads standalone Studio CSS & JS from [`client/studio.css`](./client/studio.css) and [`client/studio.js`](./client/studio.js) via `import.meta.url`. | `A2UI_STUDIO_CSS`, `A2UI_STUDIO_JS` |
| [`surface.ts`](./surface.ts) | Builds the A2UI v1.0 component tree & data model (hydrating Layer 3 `workspace/_config/locale.json` onto pure English `DEFAULT_ICM_LOCALE`), inlines lossless `24 kHz` PCM16 WAV studio audio for HTML playback, deduplicates base64 URIs in `mediaUrisByRun`, and writes `a2ui_surface.json`, `.jsonl`, `a2ui.html`, and sibling run surfaces. | `generateA2uiSurface` |
| [`client/studio.css`](./client/studio.css) | Standalone stylesheet for Tier 1 primitives, Tier 2 ICM/OKF components, Intermission curation cards, MIME/archive badges, 1-click source filter bar, and inspector modals. | *(Client CSS)* |
| [`client/studio.js`](./client/studio.js) | Standalone client renderer implementing A2UI v1.0 `@path` bindings, `@call` functions, `resolveClientMediaUri`, `SpeechPlayer` studio `<audio>` + universal BCP-47 Web Speech fallback (driven by `payload.locale` + pure English defaults), middle-ellipsis URLs, MIME/archive badges, 1-click source filtering, Intermission source curation, and Cytoscape graph tabs. | *(Client JS)* |
| [`index.ts`](./index.ts) | Public barrel re-exporting all `a2ui` modules. | `*` |

---

## Invariants
- **Allowed Imports:** Node.js built-ins + `../interactions/index.js`, `../okf/index.js`, and `../viz/index.js`. Never import from `ops` or `pipeline`.
- **1x Media Deduplication & Lightweight Data Model:** Keep `a2ui_surface.json` and `surface.dataModel` lightweight with relative `./stages/...` URLs; store inline lossless `24 kHz` WAV `data:` URIs exclusively in `window.A2UI_SURFACE_PAYLOAD.mediaUrisByRun` (`128 MB` per-track / `512 MB` total workstation ceiling).
- **Client JS Syntax Hygiene:** [`client/studio.js`](./client/studio.js) is plain browser JavaScript (no backtick-template double-escaping); always keep `node --check src/a2ui/client/studio.js` green.
