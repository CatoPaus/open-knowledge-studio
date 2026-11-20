# Interactions API & Multimodal Media Codecs (`src/interactions/CONTEXT.md`)

Foundation layer (`0` internal package dependencies) wrapping the **Google AI `/v1beta/interactions` API**, YAML stage prompt contracts, and binary image/audio codecs.

---

## Chunk Map

| File | Responsibility | Key Exports |
| :--- | :--- | :--- |
| [`env.ts`](./env.ts) | UTF-8 / UTF-16LE `.env.local` & `.env` loader, canonical model & `/v1beta/voices` constants, and `ThinkingLevel` (`LOW` \| `MEDIUM` \| `HIGH`) normalizer. | `loadDotEnvIfExists`, `GEMINI_4_ARGON_MODEL`, `GEMINI_NANO_BANANA_MODEL`, `GEMINI_FLASH_TTS_MODEL`, `VOICES_API_URL`, `normalizeThinkingLevel` |
| [`contracts.ts`](./contracts.ts) | Parses `prompts/*.md` YAML frontmatter (scalars, scalar arrays, nested object arrays, image geometry, and single/multi-speaker TTS + `languageCode` / `voiceLock` / `voiceDesignPrompt` keys) + renders `{{var}}` and `{{#if var}}` Handlebars blocks. | `StagePromptContract`, `loadStagePromptContract`, `renderPromptTemplate` |
| [`client.ts`](./client.ts) | Native `fetch` SSE streaming client for `gemini-4-argon` (including Google Search grounding metadata capture and exponential retry/fallback). | `streamGemini4ArgonInteraction`, `executeWithRetryAndFallback`, `InteractionUsageTelemetry` |
| [`media.ts`](./media.ts) | Binary magic-byte MIME/extension detection (JPEG/PNG/WebP/GIF/WAV/MP3/OGG), PCM16 RIFF header wrapper, RIFF/WAVE sub-chunk parser (skipping `LIST`/`INFO`), and 5-tap binomial FIR `24 kHz -> 12 kHz` WAV resampler. | `detectMediaMimeAndExtension`, `wrapPcm16InWavHeader`, `parseWavMetadata`, `resampleWav16BitMono` |
| [`multimodal.ts`](./multimodal.ts) | `/v1beta/interactions` & `/v1beta/voices` clients for `gemini-nano-banana-2.1` (`response_format.type: "image"`), native target-language Voice Design dialect/persona locking (`createPromptedVoice`, `ensureWorkspaceLockedVoice`, `PREBUILT_STUDIO_VOICE_PROFILES`), and `gemini-3.8-flash-tts` (`response_format.type: "audio"`, single-speaker, prebuilt multi-speaker, and `<= 950`-char sub-window PCM16 chunk stitching via `splitTtsTranscriptIntoSafeChunks`). | `generateNanoBananaImageInteraction`, `generateFlashTtsAudioInteraction`, `createPromptedVoice`, `ensureWorkspaceLockedVoice`, `getPrebuiltStudioVoiceProfile`, `splitTtsTranscriptIntoSafeChunks`, `sanitizeStyleForLockedVoice`, `isCustomVoiceId`, `FlashTtsDialogueTurn` |
| [`locale.ts`](./locale.ts) | Layer 3 `workspace/_config/locale.json` dictionary schema (`IcmLocalePack`: `ui` + `prosody` including native `voicePersonas`), pure English built-in defaults (`DEFAULT_ICM_LOCALE`), `{key}` template interpolator, synchronous Layer 3 loader/saver, and universal 20+ script/language BCP-47 detector (`inferBcp47LanguageCode`, `normalizeBcp47Tag`). | `IcmLocalePack`, `IcmUiLocale`, `IcmProsodyLocale`, `IcmVoicePersonaLocale`, `DEFAULT_ICM_LOCALE`, `formatLocaleTemplate`, `mergeIcmLocalePack`, `loadWorkspaceLocale`, `saveWorkspaceLocale`, `normalizeBcp47Tag`, `inferBcp47LanguageCode` |
| [`index.ts`](./index.ts) | Public barrel re-exporting all `interactions` modules. | `*` |

---

## Invariants
- **Allowed Imports:** Node.js built-ins only (`crypto`, `fs`, `path`). Never import from `okf`, `viz`, `a2ui`, `ops`, or `pipeline`.
- **Model & Sampling Discipline:** Exclusive text model `gemini-4-argon`; multimodal models `gemini-nano-banana-2.1`, `gemini-3.8-flash-tts`, and `gemini-omni-1.2-flash`. Never add `temperature`, `topP`, or `topK`.
- **Frontmatter Key Disambiguation:** `voice:` regex in [`contracts.ts`](./contracts.ts) is anchored (`^\s*(?:voiceName|voice_name|voice):/im`) so `primaryVoice:` / `secondaryVoice:` never collide with single-speaker `voice:`.
