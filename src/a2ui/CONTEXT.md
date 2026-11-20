# A2UI v1.0 Compiler, Bi-Directional Studio & Ping-Pong Bridge (`src/a2ui/CONTEXT.md`)

Compiles Stage 1 OKF v0.3 artifacts, Stage 2 structured JSON, Stage 3 visuals, Stage 4 studio narration, and the persistent OKF bundle into declarative **A2UI v1.0** surfaces (`a2ui_surface.json` / `.jsonl`) and self-contained **A2UI Studio** apps (`a2ui.html` / `a2ui_studio.html`).

---

## Chunk Map

| File | Responsibility | Key Exports |
| :--- | :--- | :--- |
| [`types.ts`](./types.ts) | A2UI v1.0 protocol constants (`version: "1.0"`), message envelope types (`createSurface`, `updateComponents`, `updateDataModel`), and `A2uiSurfaceGenerationOptions` / `Result`. | `A2UI_PROTOCOL_VERSION`, `A2UI_BASIC_CATALOG_ID`, `A2UI_ICM_CATALOG_ID`, `A2uiComponent`, `A2uiEnvelopeMessage` |
| [`browser-bridge.ts`](./browser-bridge.ts) | Cross-platform browser launcher (`--open`), Antigravity 2.0 `/browser` capability detector, artifact-pane HTML copier, active Ping-Pong state reader, and one-shot `127.0.0.1:44820` Ping-Pong Reactive Wakeup HTTP listener (preserving source curations + `resolvedAdjudications` / `deferredAdjudications` / `adjudicationNotes`) + auto-close helper. | `A2uiPingPongPayload`, `openFileInSystemBrowser`, `syncA2uiToArtifactDir`, `hasAntigravityBrowserCapability`, `readActivePingPongState`, `startA2uiPingPongListener`, `closeActiveA2uiPingPongListener` |
| [`catalog-schema.ts`](./catalog-schema.ts) | Runtime descriptor for Tier 1 Basic Catalog + Tier 2 ICM/OKF Domain Catalog (`Badge`, `SpeechPlayer`, `OkfMarkdown`, `OkfKnowledgeGraph`, `InteractiveChecklist`, `ModuleCarousel`, `QuizRunner`, `CaseSimulator`, `FlowDiagram`). | `A2UI_ICM_CATALOG_SCHEMA`, `escapeA2uiHtml` |
| [`normalize.ts`](./normalize.ts) | Inline LaTeX math detection (`$...$`), Markdown checklist & diagram extraction/cleaning (`mermaid` + ASCII/Unicode box diagrams), and flexible Stage 2 JSON normalization (`course` modules/quizzes/cases/diagrams and `analysis` pillars/stress-tests). | `isInlineLatexMathSpan`, `replaceInlineLatexSpansTs`, `cleanChecklistLabel`, `extractChecklistGroupsFromMarkdown`, `parseMermaidFlowchartSpec`, `parseAsciiBoxDiagramSpec`, `extractDiagramsFromMarkdown`, `normalizeFlowDiagramSpec`, `formatSingleWallParagraphs`, `normalizeStage2ForA2ui`, `NormalizedA2uiDialogueTurn` |
| [`schema.ts`](./schema.ts) | RFC 6901 JSON Pointer mutator (`setJsonPointer`), media URL allowlist, and strict validator against `specification/v1_0/catalogs/*/catalog.json`. | `setJsonPointer`, `isAllowedA2uiMediaUrl`, `loadA2uiCatalogComponentRequirements`, `validateA2uiSurfaceMessages` |
| [`client-assets.ts`](./client-assets.ts) | Loads standalone Studio CSS & JS from [`client/studio.css`](./client/studio.css) and [`client/studio.js`](./client/studio.js) via `import.meta.url`. | `A2UI_STUDIO_CSS`, `A2UI_STUDIO_JS` |
| [`surface.ts`](./surface.ts) | Builds the A2UI v1.0 component tree & data model (hydrating Layer 3 `workspace/_config/locale.json` onto pure English `DEFAULT_ICM_LOCALE`, extracting `/okf/adjudications` & pre-seeded `/okf/adjudicationDecisions`, and preserving live `pingPongUrl`), writes lightweight relative `./stages/...` URLs for `a2ui_surface.json`, `.jsonl`, `a2ui.html`, and sibling run surfaces (`mediaUrisByRun: {}`), and inlines deduplicated base64 image + lossless `24 kHz` PCM16 WAV studio audio `data:` URIs in `mediaUrisByRun` when syncing `a2ui_studio.html` to `artifactDir`. | `DEFAULT_MAX_ARTIFACT_AUDIO_BYTES`, `generateA2uiSurface` |
| [`client/studio.css`](./client/studio.css) | Standalone stylesheet for Tier 1 primitives, Tier 2 ICM/OKF components, Intermission curation cards, interactive adjudication action bars/pills/badges (`.okf-adj-*`), MIME/archive badges, 1-click source filter bar, and inspector modals. | *(Client CSS)* |
| [`client/studio.js`](./client/studio.js) | Standalone client renderer implementing A2UI v1.0 `@path` bindings, `@call` functions, `resolveClientMediaUri`, `SpeechPlayer` studio `<audio>` + universal BCP-47 Web Speech fallback, middle-ellipsis URLs, MIME/archive badges, 1-click source filtering, Intermission source curation + interactive Section 6 conflict/gap adjudication (`adjudicateItemInStudio`), and Cytoscape graph tabs. | *(Client JS)* |
| [`index.ts`](./index.ts) | Public barrel re-exporting all `a2ui` modules. | `*` |

---

## Invariants
- **Allowed Imports:** Node.js built-ins + `../interactions/index.js`, `../okf/index.js`, and `../viz/index.js`. Never import from `ops` or `pipeline`.
- **1x Media Deduplication & Lightweight Data Model:** Keep `a2ui_surface.json`, `surface.dataModel`, and run/bundle `a2ui.html` lightweight with relative `./stages/...` URLs (`mediaUrisByRun: {}`); store inline image and lossless `24 kHz` WAV `data:` URIs exclusively in `a2ui_studio.html` (`window.A2UI_SURFACE_PAYLOAD.mediaUrisByRun`) when `artifactDir` is active (`128 MB` per-track and cumulative total ceiling via `DEFAULT_MAX_ARTIFACT_AUDIO_BYTES`).
- **Client JS Syntax Hygiene:** [`client/studio.js`](./client/studio.js) is plain browser JavaScript (no backtick-template double-escaping); always keep `node --check src/a2ui/client/studio.js` green.
