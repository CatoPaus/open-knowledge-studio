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
    spokenScript?: string
    overviewVisualPrompt?: string
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
      spokenNarration?: string
      visualPrompt?: string
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

### Dual-Register Prose Rules (`voice_guide.md` & `02_script.md`)
- Separate `scriptBody` and `modules[*].narration` into **2–3 readable paragraphs** (`\n\n` breaks).
- Never include raw URLs (`https://...`), Markdown links, `[^id]` footnotes, or raw LaTeX backslashes (`\frac`, `\text`) in spoken fields.
- Write currencies, numbers, and scientific units in clean visual form (`-$12.5M`, `$2.5B`, `2.5 ± 0.1 g/cm³`, `Δv = 3.2 km/s`); `prepareTextForStudioTts()` and client `normalizeTextForTts()` expand them automatically for speech.
- Refer to statutes/standards by canonical title (optionally followed by parenthetical code, e.g., `Fire Prevention Regulation (REG-2020-05-01-42)`).

---

## 2. Stage 3 Visuals (`prompts/03_visuals.md` -> `gemini-nano-banana-2.1`)

Rendered automatically per slot (`overview` + `module_01..module_NN`). Available template variables: `{{slotId}}`, `{{slotKind}}`, `{{moduleNumber}}`, `{{slotTitle}}`, `{{courseTitle}}`, `{{subtitle}}`, `{{subtitleOrBasis}}`, `{{targetAudience}}`, `{{visualPrompt}}`, `{{narration}}`, `{{slideCues}}`, `{{actionItem}}`, `{{voiceGuide}}`, `{{globalIdentity}}`, `{{workspaceContext}}`.

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
Key visual elements: {{slideCues}}
Strictly zero embedded text, letters, numbers, labels, or watermarks inside the image.
```

---

## 3. Stage 4 Studio Narration (`prompts/04_audio.md` -> `gemini-3.8-flash-tts`)

### Single-Speaker vs. Role-Matched Dual-Voice (`dialogueMode: "semantic"`)
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

### Critical Stage 4 Dialect & Anti-Drift Rules (Zero `src/` Reads Needed)
1. **Non-English Voice Design (`nb-NO`, `de-DE`, `fr-FR`, `ja-JP`, etc.):** Prebuilt voices (`Sulafat`, `Charon`, `Kore`, `Puck`, `Orus`) carry `en-US` acoustic references. Omit `voiceDesignPrompt`, `primaryVoiceDesignPrompt`, and `secondaryVoiceDesignPrompt` in `04_audio.md` to automatically select the gender- and role-matched native persona (`warmGuideFemale` / `warmGuideMale` for `primaryVoice`; `calmSpecialistMale` / `calmSpecialistFemale` for `secondaryVoice`) from `workspace/_config/locale.json` `prosody.voicePersonas` (which omits `en-US` `base_voice` and caches both locked `voice_...` IDs via `POST /v1beta/voices` in `workspace/_config/voice_locks.json`), or write explicit `*VoiceDesignPrompt` strings **directly in the target language** without referencing an English base voice.
2. **Keep `04_audio.md` Body Empty (`0` Chars) or `<= 80` Chars:** Never inject `{{voiceGuide}}`, `{{slotTitle}}`, or accent/nationality words into the `04_audio.md` body—`runStage4Flow` routes semantic blocks via `gemini-4-argon` (`LOW`), splits turns `<= 950` chars below server context rollover, normalizes numbers/units/statutes via `prepareTextForStudioTts()`, and lets the locked `voice_...` clip carry 100% of timbre and dialect.
