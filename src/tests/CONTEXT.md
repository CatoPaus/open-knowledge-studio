# Zero-Token Self-Test Suite (`src/tests/CONTEXT.md`)

Contains the standalone zero-token, zero-network verification suite (`npm test` -> `npx tsx src/index.ts --test`), lazy-loaded by [`src/index.ts`](../index.ts) so normal CLI invocations never parse test fixtures.

---

## Chunk Map

| File | Responsibility | Key Exports |
| :--- | :--- | :--- |
| [`self-tests.ts`](./self-tests.ts) | Runs programmatic `tsc --noEmit` first (avoiding PowerShell `&&` chaining), followed by unit and integration assertions covering OKF v0.3 conformance & round-trip serialization, `cleanGroundingLinks` multi-byte UTF-8 snapping, `curateOkfSources` zero-token swaps, Ping-Pong HTTP wakeup, Stage 3/4 `--dry-run` contracts, `parseWavMetadata` + `resampleWav16BitMono`, `prepareTextForStudioTts`, A2UI v1.0 schema validation, `mediaUrisByRun` 1x deduplication, and modular `src/` architecture invariants. | `runIcmSelfTests` |

---

## Invariants
- **Zero Tokens & Zero External Network:** Every test in [`self-tests.ts`](./self-tests.ts) must run deterministically offline (`127.0.0.1` ephemeral loopback sockets and `os.tmpdir()` scratch directories cleaned up in `finally` blocks) with `0` API calls.
