# Upstream Spec Lock & Pipeline Status Inspector (`src/ops/CONTEXT.md`)

Operational diagnostics for upstream 3-pillar specification parity (`npm run spec:check`) and zero-token workspace/bundle inspection (`npm run cli:status`).

---

## Chunk Map

| File | Responsibility | Key Exports |
| :--- | :--- | :--- |
| [`spec-check.ts`](./spec-check.ts) | Compares [`specification/UPSTREAM_LOCK.json`](../../specification/UPSTREAM_LOCK.json) against live GitHub commits and protocol versions across `RinDig/Interpretable-Context-Methodology` (`icm`), `open-knowledge-format/open-knowledge-format` (`okf`), and `google/A2UI` (`a2ui`). | `UpstreamPillarCheckResult`, `checkUpstreamSpecs`, `checkUpstreamA2uiSpec` |
| [`status.ts`](./status.ts) | Walks `workspace/bundle/` and `workspace/runs/` at zero token cost, aggregating Stage 1–4 status, trust tiers, staleness, source counts, downstream token telemetry, and ASCII/JSON pipeline dashboards. | `IcmPipelineStatusReport`, `getIcmPipelineStatus`, `formatIcmPipelineStatus` |
| [`init-workspace.ts`](./init-workspace.ts) | Scaffolds clean `prompts/` + `workspace/` starter files into any target directory when running Open Knowledge Studio as an installed Antigravity plugin (`--init` / `oks_init_workspace`). | `InitOksWorkspaceOptions`, `InitOksWorkspaceResult`, `initOksWorkspace` |
| [`index.ts`](./index.ts) | Public barrel re-exporting all `ops` modules. | `*` |

---

## Invariants
- **Allowed Imports:** Node.js built-ins + `../okf/index.js`, `../viz/index.js`, and `../a2ui/index.js`. Never import from `pipeline`.
- **Path Resolution:** [`spec-check.ts`](./spec-check.ts) resolves `specification/UPSTREAM_LOCK.json` via `process.cwd()` first and `new URL('../../specification/UPSTREAM_LOCK.json', import.meta.url)` second so it works regardless of working directory.
