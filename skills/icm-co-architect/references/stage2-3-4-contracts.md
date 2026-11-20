# Stage 2, Stage 3 & Stage 4 Prompt Contract Reference

## 1. Stage 2 (`prompts/02_script.md`) — Canonical `output.schema` Keys

Because `/v1beta/interactions` strictly enforces `response_format.schema`, every deliverable field you want rendered as an interactive **A2UI v1.0** tab **must** be declared in `prompts/02_script.md` YAML frontmatter `output.schema`. `normalizeStage2ForA2ui()` recognizes these keys automatically (zero edits in `src/`):

```yaml
---
model: gemini-4-argon
config:
  maxOutputTokens: 32768
  thinkingConfig:
    thinkingLevel: MEDIUM
    includeThoughts: true
input:
  schema:
    researchFile: string
    toneRules: string
    globalIdentity?: string
    workspaceContext?: string
output:
  format: json
  schema:
    title: string
    subtitle?: string
    targetAudience?: string
    totalEstimatedMinutes?: integer
    scriptBody: string
    overviewVisualPrompt?: string
    overviewDiagram?: string
    learningObjectives?: string[]
    checklistGroups[]:
      category: string
      items: string[]
    trainingModules[]:
      moduleNumber: integer
      title: string
      durationMinutes: integer
      legalBasis?: string
      narration: string
      visualPrompt?: string
      diagram?: string
      slideCues: string[]
      actionItem: string
    quiz[]:
      question: string
      options: string[]
      correctIndex: integer
      explanation: string
    scenarios[]:
      title: string
      legalBasis?: string
      scenario: string
      recommendedAction: string
---
```

### Course vs. Analytical / Decision Mode
- **Courses & Training:** Include `trainingModules[]` (or `modules[]` / `lessons[]`), `learningObjectives`, `checklistGroups[]`, `quiz[]`, and `scenarios[]` (or `cases[]`).
- **Analytical / Investment / Legal / Architecture Memos:** **Omit `quiz[]`** (and per-module `quiz*` keys) so `generateA2uiSurface()` omits the Quiz tab and switches automatically into analytical UI mode (`pillars[]`, `thesisPoints` / `keyTakeaways`, `stressTests[]` / `scenarios[]`).

### 1:1 Read-Along Prose (Default) vs. Separate `spoken*` Fields
- **Default — Single-Source 1:1 Read-Along (`scriptBody`, `narration`, `actionItem`):** **Omit** `spokenScript`, `spokenNarration`, and `spokenActionItem` from `02_script.md` `output.schema` for prose courses, regulatory guides, and narrative briefings. Because the Studio audio player renders directly above `scriptBody` and `modules[*].narration`, learners naturally read along while listening—generating separate `spoken*` fields causes the model to paraphrase sentences so audio and on-screen text drift out of sync (and wastes ~35–40% extra Stage 2 output tokens).
- **Automatic Symbol & Prosody Verbalization (`prepareTextForStudioTts`):** Write `scriptBody`, `narration`, and `actionItem` in clean, natural prose with normal visual notation (`§§ 4–10`, `§ 5`, `-$12.5M`, `$2.5B`, `15 %`, `2.5 ± 0.1 g/cm³`, `1–3`, and canonical titles optionally followed by parenthetical registry codes like `<Title> (REG-2020-05-01-42)`). Stage 4 `prepareTextForStudioTts()` + Layer 3 `locale.json` `prosody` (`cardinals`, sections, units, abbreviations, parenthetical registry-code stripping) verbalize symbols automatically while keeping **100% sentence-for-sentence read-along alignment**.
- **When to Add `spokenScript?` / `spokenNarration?` / `dialogueTurns[]?`:** Include separate `spoken*` fields **only** when on-screen `scriptBody` / `narration` contains Markdown tables, display equations (`$$...$$`), or dense matrix layouts unsuitable for verbatim read-along, or when producing an explicit multi-host podcast show (`dialogueTurns[]`).
- **Verified Inline OKF Citations (`[^id]` -> Clickable Source URLs + Card Source Chips):** Cite the **exact verified `[^<source-id>]` keys** from Stage 1 `sources[]` inline on statutory rules, empirical figures, thresholds, and recommendations across `scriptBody`, `modules[*].narration`, `modules[*].slideCues`, `modules[*].actionItem`, `scenarios[*].recommendedAction`, and `quiz[*].explanation` (e.g., `...<factual claim>[^<source-id>].`).
  - `runStage2Flow` validates every `[^id]` against Stage 1 `sources[]` (automatically stripping any unknown ID), `studio.js` renders clean superscript numerals + expandable Gemini Deep Research `⌄`/`⌃` horizontal source-card drawers beneath each cited paragraph/item, and `prepareTextForStudioTts()` strips `[^id]` silently before speaking so 1:1 read-along audio stays completely clean.
  - **Never** invent unverified `[^id]` slugs, **never** paste raw `https://...` URLs in JSON fields, and **never** put `[^id]` inside `title`, `subtitle`, `visualPrompt`, or `quiz[*].options`.
- **Hygiene:** Separate `scriptBody` and `modules[*].narration` into **2–3 readable paragraphs** (`\n\n` breaks, ~80–120 chars/sentence), and write `checklistGroups[*].items`, `learningObjectives`, and `slideCues` as plain strings without leading `- ` or `* ` Markdown list markers.
- **Everyday Regional, Topographic & Building-Massing Grounding (`overviewVisualPrompt` & `modules[*].visualPrompt`):** Because `visualPrompt` scene directions are authored in **Stage 2 (`02_script.md`)**, instruct `02_script.md` to ground every visual scene in the target speech community's authentic everyday geography, seasonal light/climate, vernacular indoor/outdoor structures, and practical contemporary everyday/working attire (with subtle everyday regional textile/craft accents where culturally natural)—never defaulting to generic metropolitan tropes when specializing for a regional or Indigenous community, and never placing people in festive, ceremonial, or folkloric dress during ordinary operational work or safety drills.
  - **Verified Site Topography & Building Scale (When Axis 2 Geospatial Facts Exist):** When Stage 1 includes open cadastral building and LiDAR `DTM`/`DSM` elevation facts (`DSM − DTM` roof height / story scale, parcel outbuilding count, ground elevation above sea level, and inland plateau vs. coastal shoreline terrain), instruct `02_script.md` to reflect those verified exterior proportions and terrain placement in `overviewVisualPrompt` and exterior `visualPrompt`s (e.g., a single-story `~4 m` pavilion with a detached auxiliary outbuilding on a `35 m` wooded plateau rather than placing a multi-story building or a sea-level shoreline directly outside the fence)—while keeping scenes **clean editorial illustrations** (never claiming photorealistic surveillance imagery or inventing unverified façade paint colors or interior floor plans).
  - **Text-Free Depicted Surfaces:** Whenever a scene depicts documents, clipboards, checklists, binders, forms, posters, or whiteboards, instruct `02_script.md` to specify **abstract text-free horizontal line strokes or clean geometric blocks** rather than readable text or pseudo-text scribbles.

---

## 2. Stage 3 Visuals (`prompts/03_visuals.md` -> `gemini-nano-banana-2.1`)

Rendered automatically per slot (`overview` + `module_01..module_NN`). Available template variables: `{{slotId}}`, `{{slotKind}}`, `{{moduleNumber}}`, `{{slotTitle}}`, `{{courseTitle}}`, `{{subtitle}}`, `{{subtitleOrBasis}}`, `{{targetAudience}}`, `{{visualPrompt}}`, `{{visualContext}}`, `{{narration}}`, `{{slideCues}}`, `{{actionItem}}`, `{{voiceGuide}}`, `{{globalIdentity}}`, `{{workspaceContext}}`.

```yaml
---
model: gemini-nano-banana-2.1
aspectRatio: "16:9"
imageSize: "1K"
output:
  format: image
---
Create a clean 16:9 editorial illustration for "{{slotTitle}}" ({{courseTitle}}).
Scene direction: {{visualPrompt}}
{{#if visualContext}}Regional & cultural context: {{visualContext}}{{/if}}
Strictly zero embedded text, letters, numbers, signs, labels, pseudo-text scribbles, or watermarks inside the image; depict any documents, clipboards, checklists, binders, forms, or whiteboards using only abstract text-free horizontal line strokes and clean geometric blocks.
```
> Omit `{{slideCues}}` and `{{narration}}` from `03_visuals.md` whenever you want strictly text-free illustrations—relying on purely visual `{{visualPrompt}}` scene descriptions prevents localized bullet text from leaking onto signs or labels inside generated images. Explicitly specifying abstract text-free horizontal line strokes and clean geometric blocks for any depicted documents, clipboards, checklists, binders, forms, or whiteboards prevents `gemini-nano-banana-2.1` from generating illegible pseudo-text. When `workspace/_config/locale.json` defines `visualContext`, `runStage3Flow` automatically injects it even if `{{visualContext}}` is omitted from `03_visuals.md`.

---

## 3. Stage 4 Studio Narration (`prompts/04_audio.md` -> `gemini-3.8-flash-tts` or Open-TTS HTTP)

### Option A & B — Native `gemini-3.8-flash-tts` (250-Subtag Native Language Catalog)
```yaml
---
model: gemini-3.8-flash-tts
languageCode: "en-US"
# Option A — Single locked studio voice:
voice: "Kore"
# Option B — Role-matched dual-voice (omit `voice` when using primary/secondary):
# dialogueMode: "semantic"
# primarySpeaker: "Guide"
# primaryVoice: "Sulafat"
# primaryRole: "Warm pedagogical guide for everyday context, practical explanation, and actionable takeaways."
# secondarySpeaker: "Specialist"
# secondaryVoice: "Charon"
# secondaryRole: "Calm, serious regulatory and safety specialist who steps in specifically for binding legal duties, critical hazards, and mandatory procedures."
audioMimeType: "audio/wav"
sampleRate: 24000
output:
  format: audio
---
```

### Option C — External / Institutional Open-TTS HTTP Provider (`!isGeminiTtsNativelySupported(bcp47)`)
When the workspace BCP-47 tag is outside `gemini-3.8-flash-tts`'s native 250-subtag language catalog (regional, minority, or Indigenous languages), run 1 pre-flight `search_web("<language> neural text-to-speech REST API")` + 1-sentence WAV probe before Stage 4. Any verified HTTP Open-TTS endpoint (public university/parliament neural TTS, OpenAI-compatible `/v1/audio/speech`, Piper/Coqui/VITS REST) plugs into `04_audio.md` with **zero `src/` edits** while keeping `gemini-4-argon` (`LOW`) semantic dual-voice routing and `prepareTextForStudioTts()` prosody cleanup:

```yaml
---
ttsProvider: "http"
# Placeholders: {lang} (ISO 639 subtag), {bcp47}, {voice}, {speaker}, {text}
ttsEndpoint: "https://<open-tts-host>/tts/{lang}/{voice}"
# Optional request customization (defaults to POST JSON {"text": "..."}):
# ttsMethod: "POST"          # or "GET"
# ttsTextField: "text"       # e.g. "input" for /v1/audio/speech endpoints
# ttsVoiceField: "voice"     # include when {voice} is in JSON body rather than URL
# ttsLangField: "lang"       # optional JSON language key
# ttsAuthEnv: "OPEN_TTS_KEY" # optional Bearer / header token from .env
languageCode: "<bcp47>"
dialogueMode: "semantic"
primarySpeaker: "Guide"
primaryVoice: "<female_or_guide_voice_id>"
primaryRole: "Warm pedagogical guide for everyday context, practical explanation, and actionable takeaways."
secondarySpeaker: "Specialist"
secondaryVoice: "<male_or_specialist_voice_id>"
secondaryRole: "Calm, serious domain and safety specialist for binding duties, critical hazards, and mandatory procedures."
audioMimeType: "audio/wav"
output:
  format: audio
---
```
*(Omit `sampleRate` on `ttsProvider: "http"` to preserve the neural vocoder's exact native WAV sample rate, e.g. `22050 Hz` or `24000 Hz`, with zero interpolation; optionally pair with a zero-dependency `.agents/plugins/<provider>-tts/mcp/index.mjs` workspace plugin if interactive voice listing/auditioning is desired.)*

### Critical Stage 4 Dialect & Anti-Drift Rules (Zero `src/` Reads Needed)
1. **Non-English Voice Design (`nb-NO`, `de-DE`, `fr-FR`, `ja-JP`, etc.):** Prebuilt voices (`Sulafat`, `Charon`, `Kore`, `Puck`, `Orus`) carry `en-US` acoustic references. For languages natively supported by `gemini-3.8-flash-tts`, omit `*VoiceDesignPrompt` in `04_audio.md` to automatically select the gender- and role-matched native persona from `workspace/_config/locale.json` `prosody.voicePersonas` and cache locked `voice_...` IDs in `workspace/_config/voice_locks.json`. For unlisted languages run in zero-shot `gemini-3.8-flash-tts` mode, `runStage4Flow` automatically skips `/v1beta/voices` `CreateVoice` conditioning so `sample_audio` never introduces non-lexical babble.
2. **Keep `04_audio.md` Body Empty (`0` Chars) or `<= 80` Chars:** Never inject `{{voiceGuide}}`, `{{slotTitle}}`, or accent/nationality words into the `04_audio.md` body—`runStage4Flow` routes semantic blocks via `gemini-4-argon` (`LOW`), chunks long paragraphs safely, normalizes numbers/units/statutes via `prepareTextForStudioTts()`, and lets the locked `voice_...` clip or native Open-TTS voice carry 100% of timbre and dialect.
