# OKF v0.3 Interactive Bundle Graph Visualizer (`src/viz/CONTEXT.md`)

Walks `workspace/bundle/` concepts, resolves cross-concept Markdown links and shared canonical sources, loads Layer 3 `workspace/_config/locale.json` UI localization (with pure English defaults), detects primary corpus language and domain mode (`course` / `analysis`), and compiles the standalone Cytoscape.js explorer (`workspace/bundle/viz.html`).

---

## Chunk Map

| File | Responsibility | Key Exports |
| :--- | :--- | :--- |
| [`bundle-graph.ts`](./bundle-graph.ts) | Walks `workspace/bundle/**/*.md` into typed `OKFConceptNode[]` records, applies Layer 3 `locale.json` labels, detects corpus language and domain mode, and compiles self-contained `viz.html`. | `OKFConceptNode`, `getOkfTypeColor`, `extractConceptLinks`, `walkBundleConcepts`, `detectIcmLanguage`, `detectIcmDomainMode`, `extractLastUrlPathSlug`, `generateBundleVisualization` |
| [`client-assets.ts`](./client-assets.ts) | Loads standalone client stylesheet and script from [`client/viz.css`](./client/viz.css) and [`client/viz.js`](./client/viz.js) via `import.meta.url`. | `OKF_VIZ_CSS`, `OKF_VIZ_JS` |
| [`client/viz.css`](./client/viz.css) | Pure CSS layout, MIME/trust-tier/staleness badge palette, and split-pane inspector styling for `viz.html`. | *(Client CSS)* |
| [`client/viz.js`](./client/viz.js) | Standalone browser JS driving Cytoscape.js force-directed layout (with zero-CDN offline SVG graph fallback), search and node-`type` filtering, `mime_type` source badges, Markdown + `FlowDiagram` detail rendering (with built-in Markdown fallback), and bidirectional backlink navigation. | *(Client JS)* |
| [`index.ts`](./index.ts) | Public barrel re-exporting all `viz` modules. | `*` |

---

## Invariants
- **Allowed Imports:** Node.js built-ins + `../interactions/index.js` and `../okf/index.js` only.
- **Client Asset Syntax Hygiene:** [`client/viz.js`](./client/viz.js) is plain browser JavaScript (no TypeScript syntax and no template-literal double-escaping); always keep `node --check src/viz/client/viz.js` green.
