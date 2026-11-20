# 5-Layer ICM Context Loader & Stage 1–4 Pipeline Flows (`src/pipeline/CONTEXT.md`)

Orchestrates the sequential **Interpretable Context Methodology (ICM)** filesystem pipeline (`01_research` -> Intermission OKF Gate -> `02_script` -> opt-in `03_visuals` & `04_audio`) with full `input/prompt_assembled.md`, `output/thinking_trace.md`, and `meta.json` trace transparency.

---

## Chunk Map

| File | Responsibility | Key Exports |
| :--- | :--- | :--- |
| [`layers.ts`](./layers.ts) | Hydrates ICM Layer 0 (`workspace/GEMINI.md`), Layer 1 (`workspace/CONTEXT.md`), and Layer 3 (`_config/voice_guide.md`, `bundle/index.md`, `bundle/references/*.md`), writes `prompt_assembled.md` & `thinking_trace.md`, prints `--dry-run` payloads, and resolves `<runId>` targets. | `loadWorkspaceLayers`, `writeStageAssembledInput`, `printDryRunPreview`, `writeStageThinkingTrace`, `resolveDownstreamRunId` |
| [`stages-text.ts`](./stages-text.ts) | Runs Stage 1 grounded research (`gemini-4-argon` + Google Search + `cleanGroundingLinks` + on-the-fly Layer 3 `ensureWorkspaceLocaleConfig` + bundle sync + Intermission Studio), Intermission `verifyOkfConcept` curation/approval, and Stage 2 structured synthesis (`gemini-4-argon` JSON schema). | `ensureWorkspaceLocaleConfig`, `runStage1Flow`, `verifyOkfConcept`, `runStage2Flow` |
| [`prosody.ts`](./prosody.ts) | Strips URLs/footnotes from spoken JSON fields and normalizes multilingual studio TTS prosody (preserving `\n\n` pauses, converting `**Heading:**` to `Heading. `, expanding symbols & units via English defaults or Layer 3 `workspace/_config/locale.json`, and preserving native symbols intact across unlocalized non-English languages). | `sanitizeSpokenScript`, `sanitizeSpokenJson`, `prepareTextForStudioTts` |
| [`stages-multimodal.ts`](./stages-multimodal.ts) | Runs opt-in Stage 3 visual synthesis (`prompts/03_visuals.md` -> `gemini-nano-banana-2.1`), Stage 4 single- & multi-speaker studio narration (`prompts/04_audio.md` -> `inferBcp47LanguageCode` + `/v1beta/voices` Layer 3 `voice_locks.json` native target-language dialect locking via `resolveStage4VoiceDesignPrompt` + `directSemanticDualVoiceAssignment` role-matched register routing + `<= 950`-char `mergeConsecutiveSpeakerTurns` + `gemini-3.8-flash-tts`), and `icmOrchestratorFlow`. | `Stage3VisualManifestItem`, `runStage3Flow`, `Stage4AudioManifestItem`, `resolveStage4LanguageCode`, `buildDefaultVoiceLockPrompt`, `resolveStage4VoiceDesignPrompt`, `sanitizeTtsStyleInstruction`, `extractStage4SpeechBlocks`, `classifyBlockRegisterHeuristic`, `mergeConsecutiveSpeakerTurns`, `directSemanticDualVoiceAssignment`, `segmentStage4DialogueTurns`, `runStage4Flow`, `icmOrchestratorFlow` |
| [`index.ts`](./index.ts) | Public barrel re-exporting all `pipeline` modules. | `*` |

---

## Invariants
- **Allowed Imports:** Node.js built-ins + `../interactions/index.js`, `../okf/index.js`, `../viz/index.js`, and `../a2ui/index.js`.
- **Lossless `24 kHz` Studio Audio Fidelity:** [`stages-multimodal.ts`](./stages-multimodal.ts) always writes lossless `24 kHz` PCM16 `.wav` files to `stages/04_audio/output/` and records `durationSeconds` / `voicesUsed` in `audio_manifest.json`, and `src/a2ui/surface.ts` inlines those native `24 kHz` `.wav` tracks directly into `mediaUrisByRun` without downsampling.
