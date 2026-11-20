import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

import { GEMINI_FLASH_TTS_MODEL, GEMINI_NANO_BANANA_MODEL, INTERACTIONS_API_REVISION, INTERACTIONS_API_URL, VOICES_API_URL } from './env.js';
import { type InteractionUsageTelemetry, getApiKey, isRetryableError } from './client.js';
import { detectMediaMimeAndExtension, extractNormalizedMono16PcmFromWav, parseWavMetadata, wrapPcm16InWavHeader } from './media.js';

export interface NanoBananaImageRequestOptions {
  promptText: string;
  model?: string;
  aspectRatio?: string;
  imageSize?: string;
  store?: boolean;
  maxRetries?: number;
}

export interface NanoBananaImageResult {
  id?: string;
  status?: string;
  imageBuffer: Buffer;
  mimeType: string;
  ext: string;
  text: string;
  thoughts: string[];
  usage: InteractionUsageTelemetry;
}

/**
 * Direct zero-dependency client for Gemini Nano Banana 2.1 (`gemini-nano-banana-2.1`) via
 * `POST /v1beta/interactions` (`response_format: { type: "image" }`).
 */
export async function generateNanoBananaImageInteraction(
  options: NanoBananaImageRequestOptions
): Promise<NanoBananaImageResult> {
  const apiKey = getApiKey();
  const resolvedModel = (options.model || GEMINI_NANO_BANANA_MODEL).replace(/^googleai\//i, '');
  const maxRetries = options.maxRetries ?? 2;

  const requestBody: Record<string, any> = {
    model: resolvedModel,
    input: [
      {
        type: 'user_input',
        content: [{ type: 'text', text: options.promptText }],
      },
    ],
    response_format: {
      type: 'image',
      ...(options.aspectRatio ? { aspect_ratio: options.aspectRatio } : {}),
      ...(options.imageSize ? { image_size: options.imageSize } : {}),
    },
    store: Boolean(options.store),
  };

  let attempt = 0;
  while (true) {
    try {
      const response = await fetch(INTERACTIONS_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Api-Revision': INTERACTIONS_API_REVISION,
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errText = await response.text();
        const error: any = new Error(
          `Interactions Image API Error [${response.status} ${response.statusText}]: ${errText}`
        );
        error.statusCode = response.status;
        throw error;
      }

      const interaction = (await response.json()) as Record<string, any>;
      if (interaction.status === 'failed') {
        const details = (interaction.errors ?? [])
          .map((e: any) => `${e.code ? `[${e.code}] ` : ''}${e.message || ''}`.trim())
          .filter(Boolean)
          .join('; ');
        const err: any = new Error(
          `Interactions Image generation failed: ${details || 'Unknown error'}`
        );
        err.status = interaction.errors?.[0]?.code;
        throw err;
      }

      let rawBase64 = '';
      let rawMime = '';
      let textOut = '';
      const thoughts: string[] = [];

      if (Array.isArray(interaction.steps)) {
        for (const step of interaction.steps) {
          if (step?.type === 'thought' && Array.isArray(step.summary)) {
            for (const sPart of step.summary) {
              const t = String(typeof sPart === 'string' ? sPart : sPart?.text || '').trim();
              if (t && !thoughts.includes(t)) thoughts.push(t);
            }
          }
          if (step?.type === 'model_output' && Array.isArray(step.content)) {
            for (const part of step.content) {
              if (part?.type === 'image' && typeof part.data === 'string' && part.data.length > 0) {
                rawBase64 = part.data;
                rawMime = String(part.mime_type || part.mimeType || '');
              } else if (part?.type === 'text' && typeof part.text === 'string') {
                textOut += part.text;
              }
            }
          }
        }
      }

      if (!rawBase64 && typeof interaction.output_image?.data === 'string') {
        rawBase64 = interaction.output_image.data;
        rawMime = String(interaction.output_image.mime_type || interaction.output_image.mimeType || '');
      }
      if (!rawBase64 && Array.isArray(interaction.outputs)) {
        const imgOut = interaction.outputs.find(
          (o: any) => o?.type === 'image' && typeof o.data === 'string'
        );
        if (imgOut) {
          rawBase64 = imgOut.data;
          rawMime = String(imgOut.mime_type || imgOut.mimeType || '');
        }
      }

      if (!rawBase64) {
        throw new Error(
          `Interactions Image API (${resolvedModel}) returned no image data part in steps[].content[].`
        );
      }

      const imageBuffer = Buffer.from(rawBase64, 'base64');
      const { mimeType, ext } = detectMediaMimeAndExtension(imageBuffer, rawMime, 'image');
      const rawUsage = interaction.usage || {};
      const usage: InteractionUsageTelemetry = {
        inputTokens: rawUsage.total_input_tokens ?? 0,
        thoughtsTokens: rawUsage.total_thought_tokens ?? 0,
        outputTokens: rawUsage.total_output_tokens ?? 0,
        totalTokens: rawUsage.total_tokens ?? 0,
      };

      return {
        id: interaction.id,
        status: interaction.status,
        imageBuffer,
        mimeType,
        ext,
        text: textOut.trim(),
        thoughts,
        usage,
      };
    } catch (err: any) {
      if (attempt < maxRetries && isRetryableError(err)) {
        attempt++;
        console.warn(
          `[Retry ${attempt}/${maxRetries}] Transient error on ${resolvedModel}: ${err.message}. Retrying...`
        );
        await new Promise((r) => setTimeout(r, 1500 * attempt));
        continue;
      }
      throw err;
    }
  }
}

export interface FlashTtsDialogueTurn {
  speaker: string;
  voice?: string;
  text: string;
  style?: string;
}

export interface FlashTtsAudioRequestOptions {
  transcriptText?: string;
  styleInstruction?: string;
  turns?: FlashTtsDialogueTurn[];
  speakers?: Array<{ speaker: string; voice: string }>;
  model?: string;
  voice?: string;
  languageCode?: string;
  audioMimeType?: string;
  sampleRate?: number;
  store?: boolean;
  maxRetries?: number;
}

export interface FlashTtsAudioResult {
  id?: string;
  status?: string;
  audioBuffer: Buffer;
  mimeType: string;
  ext: string;
  durationSeconds?: number;
  thoughts: string[];
  usage: InteractionUsageTelemetry;
}

export interface PromptedVoiceResult {
  id: string;
  displayName?: string;
  languageCode?: string;
  expireTime?: string;
  sampleAudioBuffer?: Buffer;
  usage: InteractionUsageTelemetry;
}

export interface WorkspaceLockedVoiceEntry {
  fingerprint: string;
  voiceId: string;
  baseVoice: string;
  languageCode: string;
  model: string;
  voiceDesignPrompt: string;
  displayName: string;
  createdAt: string;
  expireTime?: string;
}

/**
 * Returns `true` when `voice` is a custom Voice Design (`voice_...`) or Voice Replication
 * (`voice_...` / `voicekey_...`) identifier rather than a prebuilt catalog name.
 */
export function isCustomVoiceId(voice?: string): boolean {
  return /^voice(?:key)?_[a-z0-9_-]+$/i.test(String(voice || '').trim());
}

export interface PrebuiltStudioVoiceProfile {
  gender: 'female' | 'male' | 'neutral';
  pitch: 'low' | 'medium' | 'high';
  archetype: 'warm' | 'authoritative' | 'clear' | 'energetic';
}

export const PREBUILT_STUDIO_VOICE_PROFILES: Record<string, PrebuiltStudioVoiceProfile> = {
  achernar: { gender: 'female', pitch: 'high', archetype: 'warm' },
  achird: { gender: 'male', pitch: 'low', archetype: 'warm' },
  algenib: { gender: 'male', pitch: 'low', archetype: 'authoritative' },
  algieba: { gender: 'male', pitch: 'low', archetype: 'clear' },
  alnilam: { gender: 'male', pitch: 'low', archetype: 'authoritative' },
  aoede: { gender: 'female', pitch: 'medium', archetype: 'warm' },
  autonoe: { gender: 'female', pitch: 'medium', archetype: 'energetic' },
  callirrhoe: { gender: 'female', pitch: 'medium', archetype: 'warm' },
  charon: { gender: 'male', pitch: 'low', archetype: 'authoritative' },
  despina: { gender: 'female', pitch: 'medium', archetype: 'warm' },
  enceladus: { gender: 'male', pitch: 'low', archetype: 'warm' },
  erinome: { gender: 'female', pitch: 'medium', archetype: 'clear' },
  fenrir: { gender: 'male', pitch: 'low', archetype: 'energetic' },
  gacrux: { gender: 'female', pitch: 'medium', archetype: 'authoritative' },
  iapetus: { gender: 'male', pitch: 'low', archetype: 'clear' },
  kore: { gender: 'female', pitch: 'medium', archetype: 'authoritative' },
  laomedeia: { gender: 'female', pitch: 'high', archetype: 'energetic' },
  leda: { gender: 'female', pitch: 'high', archetype: 'energetic' },
  orus: { gender: 'male', pitch: 'low', archetype: 'authoritative' },
  puck: { gender: 'male', pitch: 'low', archetype: 'energetic' },
  pulcherrima: { gender: 'neutral', pitch: 'medium', archetype: 'clear' },
  rasalgethi: { gender: 'male', pitch: 'medium', archetype: 'authoritative' },
  sadachbia: { gender: 'male', pitch: 'low', archetype: 'energetic' },
  sadaltager: { gender: 'male', pitch: 'medium', archetype: 'authoritative' },
  schedar: { gender: 'male', pitch: 'low', archetype: 'clear' },
  sulafat: { gender: 'female', pitch: 'medium', archetype: 'warm' },
  umbriel: { gender: 'male', pitch: 'low', archetype: 'warm' },
  vindemiatrix: { gender: 'female', pitch: 'medium', archetype: 'warm' },
  zephyr: { gender: 'female', pitch: 'high', archetype: 'energetic' },
  zubenelgenubi: { gender: 'male', pitch: 'low', archetype: 'warm' },
};

/**
 * Looks up gender, pitch, and vocal archetype metadata for any of the 30 Gemini prebuilt studio voices.
 */
export function getPrebuiltStudioVoiceProfile(
  voice?: string
): PrebuiltStudioVoiceProfile | undefined {
  const key = String(voice || '').trim().toLowerCase();
  return key ? PREBUILT_STUDIO_VOICE_PROFILES[key] : undefined;
}

function extractRegionCodeFromBcp47(languageCode?: string): string | undefined {
  const parts = String(languageCode || '')
    .trim()
    .replace(/_/g, '-')
    .split('-');
  for (let i = 1; i < parts.length; i++) {
    if (/^(?:[A-Za-z]{2}|\d{3})$/.test(parts[i])) {
      return parts[i].toUpperCase();
    }
  }
  return undefined;
}

/**
 * Returns `true` when `voice` is a prebuilt system voice name (e.g. `Kore`, `Sulafat`, `Puck`)
 * rather than a regional Extended Voice Library ID (e.g. `en-gb-...`) or custom `voice_...` ID.
 */
export function isPrebuiltStudioVoiceName(voice?: string): boolean {
  const trimmed = String(voice || '').trim();
  if (!trimmed || isCustomVoiceId(trimmed)) return false;
  return /^[A-Za-z]+$/.test(trimmed);
}

/**
 * Checks via `GET /v1beta/voices/{id}` whether a stored custom `voice_...` ID still exists
 * and has not expired or been deleted in the active project.
 */
export async function getStoredVoiceExists(voiceId: string): Promise<boolean> {
  const trimmed = String(voiceId || '').trim();
  if (!/^voice_[a-z0-9_-]+$/i.test(trimmed)) return false;
  try {
    const apiKey = getApiKey();
    const res = await fetch(`${VOICES_API_URL}/${encodeURIComponent(trimmed)}`, {
      method: 'GET',
      headers: { 'x-goog-api-key': apiKey },
    });
    return res.ok;
  } catch {
    return false;
  }
}

const unsupportedVoiceLanguageCodes = new Set<string>();
const unsupportedTtsLanguageCodes = new Set<string>();

/**
 * Creates a persistent vocal persona via `POST /v1beta/voices` (`type: "prompted"`, `store: true`).
 * For English locales (`en*`), remixes `baseVoice` (`prompted.base_voice`) when provided.
 * For non-English locales (`nb-NO`, `de-DE`, `fr-FR`, `ja-JP`, etc.), omits `en-US` prebuilt
 * `prompted.base_voice` (which otherwise causes `CreateVoice` to synthesize an English `sample_audio`
 * conditioning clip with zero target-language dialect anchor) and instead passes matched `gender`
 * and `region_code` so `sample_audio` is synthesized natively in the target language and dialect.
 */
export async function createPromptedVoice(options: {
  promptInput: string;
  baseVoice?: string;
  languageCode?: string;
  regionCode?: string;
  displayName?: string;
  gender?: string;
  omitBaseVoice?: boolean;
  model?: string;
  maxRetries?: number;
}): Promise<PromptedVoiceResult> {
  const apiKey = getApiKey();
  const resolvedModel = (options.model || GEMINI_FLASH_TTS_MODEL).replace(/^googleai\//i, '');
  const maxRetries = options.maxRetries ?? 2;
  const isNonEnglishTarget =
    Boolean(options.languageCode) && !/^en(?:-|$)/i.test(String(options.languageCode).trim());
  const studioProfile = getPrebuiltStudioVoiceProfile(options.baseVoice);
  const shouldOmitEnglishBaseVoice =
    options.omitBaseVoice === true ||
    (isNonEnglishTarget && isPrebuiltStudioVoiceName(options.baseVoice));
  const resolvedGender = options.gender || studioProfile?.gender;
  const resolvedRegion = options.regionCode || extractRegionCodeFromBcp47(options.languageCode);

  const reqLangKey = options.languageCode ? options.languageCode.trim().toLowerCase() : '';
  const voiceSpec: Record<string, any> = {
    model: resolvedModel,
    type: 'prompted',
    ...(options.displayName ? { display_name: options.displayName } : {}),
    ...(options.languageCode && !unsupportedVoiceLanguageCodes.has(reqLangKey)
      ? { language_code: options.languageCode }
      : {}),
    ...(resolvedRegion ? { region_code: resolvedRegion } : {}),
    ...(resolvedGender ? { gender: resolvedGender } : {}),
    prompted: {
      ...(options.baseVoice &&
      !isCustomVoiceId(options.baseVoice) &&
      !shouldOmitEnglishBaseVoice
        ? { base_voice: options.baseVoice }
        : {}),
      input: options.promptInput.trim(),
    },
  };

  let attempt = 0;
  let retriedWithoutLang = false;
  while (true) {
    try {
      const response = await fetch(VOICES_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify({
          store: true,
          voice: voiceSpec,
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        if (
          response.status === 400 &&
          !retriedWithoutLang &&
          voiceSpec.language_code &&
          /language|locale|bcp|unsupported|invalid/i.test(errText)
        ) {
          retriedWithoutLang = true;
          unsupportedVoiceLanguageCodes.add(reqLangKey);
          console.warn(
            `[Voices API Fallback]: language_code "${voiceSpec.language_code}" rejected by CreateVoice — retrying with automatic language detection...`
          );
          delete voiceSpec.language_code;
          continue;
        }
        const error: any = new Error(
          `Voices API CreateVoice Error [${response.status} ${response.statusText}]: ${errText}`
        );
        error.statusCode = response.status;
        throw error;
      }

      const payload = (await response.json()) as Record<string, any>;
      const id = String(payload?.id || '').trim();
      if (!id) {
        throw new Error(`Voices API CreateVoice returned no voice ID.`);
      }

      const sampleB64 = payload?.sample_audio?.data;
      const sampleAudioBuffer =
        typeof sampleB64 === 'string' && sampleB64.length > 0
          ? Buffer.from(sampleB64, 'base64')
          : undefined;
      const rawUsage = payload?.usage || {};
      const usage: InteractionUsageTelemetry = {
        inputTokens: rawUsage.total_input_tokens ?? 0,
        thoughtsTokens: rawUsage.total_thought_tokens ?? 0,
        outputTokens: rawUsage.total_output_tokens ?? 0,
        totalTokens: rawUsage.total_tokens ?? 0,
      };

      return {
        id,
        displayName: payload?.display_name ? String(payload.display_name) : options.displayName,
        languageCode: payload?.language_code ? String(payload.language_code) : options.languageCode,
        expireTime: payload?.expire_time ? String(payload.expire_time) : undefined,
        ...(sampleAudioBuffer ? { sampleAudioBuffer } : {}),
        usage,
      };
    } catch (err: any) {
      if (attempt < maxRetries && isRetryableError(err)) {
        attempt++;
        await new Promise((r) => setTimeout(r, 1500 * attempt));
        continue;
      }
      throw err;
    }
  }
}

/**
 * Computes a deterministic SHA-256 cache fingerprint for a workspace Voice Design lock configuration.
 */
export function computeVoiceLockFingerprint(input: {
  model: string;
  baseVoice: string;
  languageCode: string;
  voiceDesignPrompt: string;
}): string {
  const normLang = input.languageCode.trim().toLowerCase();
  const isNonEnglishPrebuilt =
    Boolean(normLang) && !/^en(?:-|$)/.test(normLang) && isPrebuiltStudioVoiceName(input.baseVoice);
  const canonical = JSON.stringify({
    model: input.model.trim().toLowerCase(),
    baseVoice: input.baseVoice.trim().toLowerCase(),
    languageCode: normLang,
    voiceDesignPrompt: input.voiceDesignPrompt.trim().replace(/\s+/g, ' '),
    ...(isNonEnglishPrebuilt ? { nativeSampleConditioning: true } : {}),
  });
  return crypto.createHash('sha256').update(canonical).digest('hex').slice(0, 16);
}

/**
 * Resolves or creates a persistent `/v1beta/voices` Voice Design persona cached in Layer 3
 * (`workspace/_config/voice_locks.json`), ensuring identical vocal timbre, regional dialect,
 * and room tone across every module in a run and across subsequent runs in the same workspace.
 */
export async function ensureWorkspaceLockedVoice(options: {
  locksFilePath: string;
  baseVoice: string;
  languageCode: string;
  voiceDesignPrompt: string;
  displayName?: string;
  model?: string;
  samplePreviewOutPath?: string;
}): Promise<{
  voiceId: string;
  cached: boolean;
  fingerprint: string;
  usage: InteractionUsageTelemetry;
}> {
  const resolvedModel = (options.model || GEMINI_FLASH_TTS_MODEL).replace(/^googleai\//i, '');
  const fingerprint = computeVoiceLockFingerprint({
    model: resolvedModel,
    baseVoice: options.baseVoice,
    languageCode: options.languageCode,
    voiceDesignPrompt: options.voiceDesignPrompt,
  });

  let existingEntries: WorkspaceLockedVoiceEntry[] = [];
  if (fs.existsSync(options.locksFilePath)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(options.locksFilePath, 'utf-8'));
      if (Array.isArray(parsed?.voices)) {
        existingEntries = parsed.voices;
      }
    } catch {
      existingEntries = [];
    }
  }

  const cachedEntry = existingEntries.find(
    (e) => e && e.fingerprint === fingerprint && isCustomVoiceId(e.voiceId)
  );
  if (cachedEntry && (await getStoredVoiceExists(cachedEntry.voiceId))) {
    return {
      voiceId: cachedEntry.voiceId,
      cached: true,
      fingerprint,
      usage: { inputTokens: 0, thoughtsTokens: 0, outputTokens: 0, totalTokens: 0 },
    };
  }

  const displayName =
    options.displayName || `${options.baseVoice} (${options.languageCode} Studio Lock)`;
  const created = await createPromptedVoice({
    promptInput: options.voiceDesignPrompt,
    baseVoice: options.baseVoice,
    languageCode: options.languageCode,
    displayName,
    model: resolvedModel,
  });

  if (options.samplePreviewOutPath && created.sampleAudioBuffer) {
    try {
      fs.mkdirSync(path.dirname(options.samplePreviewOutPath), { recursive: true });
      fs.writeFileSync(options.samplePreviewOutPath, created.sampleAudioBuffer);
    } catch {
      // Ignore sample preview write errors
    }
  }

  const updatedEntry: WorkspaceLockedVoiceEntry = {
    fingerprint,
    voiceId: created.id,
    baseVoice: options.baseVoice,
    languageCode: options.languageCode,
    model: resolvedModel,
    voiceDesignPrompt: options.voiceDesignPrompt.trim(),
    displayName,
    createdAt: new Date().toISOString(),
    ...(created.expireTime ? { expireTime: created.expireTime } : {}),
  };

  try {
    fs.mkdirSync(path.dirname(options.locksFilePath), { recursive: true });
    const filtered = existingEntries.filter((e) => e && e.fingerprint !== fingerprint);
    fs.writeFileSync(
      options.locksFilePath,
      JSON.stringify({ version: 1, voices: [updatedEntry, ...filtered] }, null, 2),
      'utf-8'
    );
  } catch {
    // Ignore cache persistence errors
  }

  return {
    voiceId: created.id,
    cached: false,
    fingerprint,
    usage: created.usage,
  };
}

/**
 * Safe per-request character ceiling (~55–65s of studio speech) keeping every `/v1beta/interactions`
 * TTS call well below `gemini-3.8-flash-tts`'s ~135–145s (~1,700-char) server-side acoustic context
 * buffer rollover so voices and dialects never reset mid-paragraph.
 */
export const MAX_TTS_CHARS_PER_CALL = 950;

/**
 * Splits long TTS transcripts at natural paragraph (`\n\n`), sentence, or clause boundaries into
 * chunks of at most `maxChars` characters without altering a single word of verified prose.
 */
export function splitTtsTranscriptIntoSafeChunks(
  text: string,
  maxChars: number = MAX_TTS_CHARS_PER_CALL
): string[] {
  const cleaned = String(text || '').trim();
  if (!cleaned) return [];
  if (cleaned.length <= maxChars) return [cleaned];

  const paragraphs = cleaned
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  const splitOversizedUnit = (unit: string): string[] => {
    if (unit.length <= maxChars) return [unit];
    const sentences = unit
      .split(/(?<=[.!?])\s+(?=[\p{Lu}"“«'(\[0-9])/u)
      .map((s) => s.trim())
      .filter(Boolean);
    const out: string[] = [];
    let cur = '';
    const flushOrPush = (piece: string) => {
      if (piece.length <= maxChars) {
        if (!cur) {
          cur = piece;
        } else if (cur.length + 1 + piece.length <= maxChars) {
          cur = `${cur} ${piece}`;
        } else {
          out.push(cur);
          cur = piece;
        }
        return;
      }
      if (cur) {
        out.push(cur);
        cur = '';
      }
      const clauses = piece
        .split(/(?<=[;:,])\s+/)
        .map((c) => c.trim())
        .filter(Boolean);
      let cBuf = '';
      for (const cl of clauses) {
        if (!cBuf) {
          cBuf = cl;
        } else if (cBuf.length + 1 + cl.length <= maxChars) {
          cBuf = `${cBuf} ${cl}`;
        } else {
          out.push(cBuf);
          cBuf = cl;
        }
      }
      if (cBuf) out.push(cBuf);
    };

    if (sentences.length > 1) {
      for (const sent of sentences) flushOrPush(sent);
    } else {
      flushOrPush(unit);
    }
    if (cur) out.push(cur);
    return out;
  };

  const chunks: string[] = [];
  let current = '';
  for (const para of paragraphs) {
    if (para.length > maxChars) {
      if (current) {
        chunks.push(current);
        current = '';
      }
      chunks.push(...splitOversizedUnit(para));
    } else if (!current) {
      current = para;
    } else if (current.length + 2 + para.length <= maxChars) {
      current = `${current}\n\n${para}`;
    } else {
      chunks.push(current);
      current = para;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

/**
 * Strips redundant baseline studio-pacing or accent/language directives when synthesizing with a
 * custom locked `voice_...` / `voicekey_...` persona so `speech_metadata.style` never competes
 * with the voice's `sample_audio` conditioning reference, while preserving genuine situational cues
 * (such as `"whispered urgently"` or `"cheerful and excited"`).
 */
export function sanitizeStyleForLockedVoice(style?: string): string {
  const raw = String(style || '').trim();
  if (!raw) return '';
  if (/\b(?:whisper\w*|urgent\w*|excit\w*|cheerful\w*|laugh\w*|gasps?|somber|dramatic|mutter\w*|breathless\w*)\b/i.test(raw)) {
    return raw
      .replace(/\b[a-z]{2,3}-[A-Z]{2}\b/g, '')
      .replace(/\b(?:accent|dialect)\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
  }
  const strippedBaseline = raw
    .replace(/\b[a-z]{2,3}-[A-Z]{2}\b/g, '')
    .replace(
      /\b(?:calm|clear|warm|steady|natural|approachable|reassuring|authoritative|serious|encouraging|measured|professional|friendly|gentle|studio|broadcast|pacing|delivery|tone|voice|accent|dialect|standard|eastern|western|northern|southern|central|urban|norwegian|bokm[aå]l|nynorsk|swedish|danish|finnish|german|french|spanish|italian|portuguese|dutch|polish|japanese|korean|chinese|mandarin|arabic|hindi|english|american|british|australian|canadian|and|with|in|a|an)\b/giu,
      ''
    )
    .replace(/[,.;:()\-–—\s]+/g, '')
    .trim();
  return strippedBaseline.length === 0 ? '' : raw;
}

/**
 * Direct zero-dependency client for Gemini 3.8 Flash TTS (`gemini-3.8-flash-tts`) via
 * `POST /v1beta/interactions` supporting single-speaker (`speech_config: [{ voice, language }]`),
 * prebuilt multi-speaker dialogue (`speech_config: { speakers: [{ speaker, voice, language }, ...] }`),
 * and automatic sub-window PCM16 chunk stitching (`<= 950` chars per call) so neither custom
 * `voice_...` multi-speaker dialogue nor long multi-paragraph turns ever hit the server-side
 * ~140s acoustic context buffer rollover.
 */
export async function generateFlashTtsAudioInteraction(
  options: FlashTtsAudioRequestOptions
): Promise<FlashTtsAudioResult> {
  const apiKey = getApiKey();
  const resolvedModel = (options.model || GEMINI_FLASH_TTS_MODEL).replace(/^googleai\//i, '');
  const resolvedVoice = (options.voice || 'Kore').trim() || 'Kore';
  const rawResolvedLang = options.languageCode?.trim() || undefined;
  const resolvedLang =
    rawResolvedLang && !unsupportedTtsLanguageCodes.has(rawResolvedLang.toLowerCase())
      ? rawResolvedLang
      : undefined;
  const maxRetries = options.maxRetries ?? 2;

  const validTurns = Array.isArray(options.turns)
    ? options.turns.filter((t) => t && typeof t.text === 'string' && t.text.trim().length > 0)
    : [];

  const speakerMap = new Map<string, string>();
  if (Array.isArray(options.speakers)) {
    for (const sp of options.speakers) {
      const sName = String(sp?.speaker || '').trim();
      const sVoice = String(sp?.voice || '').trim();
      if (sName && sVoice && !speakerMap.has(sName)) {
        speakerMap.set(sName, sVoice);
      }
    }
  }
  for (const t of validTurns) {
    const sName = String(t.speaker || '').trim();
    const sVoice = String(t.voice || '').trim();
    if (sName && sVoice && !speakerMap.has(sName)) {
      speakerMap.set(sName, sVoice);
    }
  }

  const hasMultiSpeakerCustomVoice =
    validTurns.length > 0 &&
    speakerMap.size >= 2 &&
    Array.from(speakerMap.values()).some((v) => isCustomVoiceId(v));
  const hasOversizedMultiTurn =
    validTurns.length > 0 &&
    speakerMap.size >= 2 &&
    (validTurns.some((t) => t.text.trim().length > MAX_TTS_CHARS_PER_CALL) ||
      validTurns.reduce((sum, t) => sum + t.text.trim().length, 0) > MAX_TTS_CHARS_PER_CALL * 1.4);

  if (hasMultiSpeakerCustomVoice || hasOversizedMultiTurn) {
    const targetRate = options.sampleRate || 24000;
    const sameSpeakerPauseBytes = Buffer.alloc(Math.round(targetRate * 0.26) * 2, 0);
    const switchSpeakerPauseBytes = Buffer.alloc(Math.round(targetRate * 0.32) * 2, 0);
    const expandedSegments: Array<{ voice: string; text: string; style?: string }> = [];

    for (const turn of validTurns) {
      const turnVoice =
        (turn.voice && turn.voice.trim()) ||
        speakerMap.get(turn.speaker.trim()) ||
        resolvedVoice;
      const safeChunks = splitTtsTranscriptIntoSafeChunks(turn.text, MAX_TTS_CHARS_PER_CALL);
      for (const ch of safeChunks) {
        expandedSegments.push({
          voice: turnVoice,
          text: ch,
          style: turn.style?.trim() || options.styleInstruction,
        });
      }
    }

    const pcmChunks: Buffer[] = [];
    const combinedThoughts: string[] = [];
    const aggUsage: InteractionUsageTelemetry = {
      inputTokens: 0,
      thoughtsTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
    };

    for (let i = 0; i < expandedSegments.length; i++) {
      const seg = expandedSegments[i];
      const turnRes = await generateFlashTtsAudioInteraction({
        transcriptText: seg.text,
        styleInstruction: seg.style,
        model: resolvedModel,
        voice: seg.voice,
        languageCode: resolvedLang,
        audioMimeType: 'audio/wav',
        sampleRate: targetRate,
        store: options.store,
        maxRetries,
      });
      const wavMeta = parseWavMetadata(turnRes.audioBuffer);
      const pcmSlice = wavMeta.isWav
        ? turnRes.audioBuffer.subarray(wavMeta.dataOffset, wavMeta.dataOffset + wavMeta.dataBytes)
        : turnRes.audioBuffer;
      if (i > 0 && pcmChunks.length > 0) {
        pcmChunks.push(
          expandedSegments[i - 1].voice === seg.voice
            ? sameSpeakerPauseBytes
            : switchSpeakerPauseBytes
        );
      }
      pcmChunks.push(pcmSlice);
      for (const th of turnRes.thoughts) {
        if (!combinedThoughts.includes(th)) combinedThoughts.push(th);
      }
      aggUsage.inputTokens += turnRes.usage.inputTokens;
      aggUsage.thoughtsTokens += turnRes.usage.thoughtsTokens;
      aggUsage.outputTokens += turnRes.usage.outputTokens;
      aggUsage.totalTokens += turnRes.usage.totalTokens;
    }

    const stitchedWav = wrapPcm16InWavHeader(Buffer.concat(pcmChunks), targetRate, 1);
    const stitchedMeta = parseWavMetadata(stitchedWav);
    return {
      status: 'completed',
      audioBuffer: stitchedWav,
      mimeType: 'audio/wav',
      ext: '.wav',
      ...(stitchedMeta.durationSeconds > 0 ? { durationSeconds: stitchedMeta.durationSeconds } : {}),
      thoughts: combinedThoughts,
      usage: aggUsage,
    };
  }

  let contentParts: Array<Record<string, any>>;
  let speechConfig: Record<string, any> | Array<Record<string, any>>;

  if (validTurns.length > 0 && speakerMap.size >= 2) {
    contentParts = validTurns.map((t) => ({
      type: 'text',
      text: t.text.trim(),
      annotations: [
        {
          type: 'speech_metadata',
          speaker: t.speaker.trim(),
          ...(t.style && t.style.trim() ? { style: t.style.trim() } : {}),
        },
      ],
    }));
    speechConfig = {
      speakers: Array.from(speakerMap.entries()).map(([speaker, voice]) => ({
        speaker,
        voice,
        ...(resolvedLang ? { language: resolvedLang } : {}),
      })),
    };
  } else {
    const singleText = (
      validTurns.length > 0
        ? validTurns.map((t) => t.text.trim()).join('\n\n')
        : String(options.transcriptText || '').replace(/^\s*\[[^\]\r\n]{1,60}\]:\s*/gm, '')
    ).trim();
    const singleVoice = Array.from(speakerMap.values())[0] || resolvedVoice;

    if (singleText.length > MAX_TTS_CHARS_PER_CALL) {
      const targetRate = options.sampleRate || 24000;
      const sameSpeakerPauseBytes = Buffer.alloc(Math.round(targetRate * 0.26) * 2, 0);
      const safeChunks = splitTtsTranscriptIntoSafeChunks(singleText, MAX_TTS_CHARS_PER_CALL);
      const pcmChunks: Buffer[] = [];
      const combinedThoughts: string[] = [];
      const aggUsage: InteractionUsageTelemetry = {
        inputTokens: 0,
        thoughtsTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
      };
      for (let i = 0; i < safeChunks.length; i++) {
        const subRes = await generateFlashTtsAudioInteraction({
          transcriptText: safeChunks[i],
          styleInstruction: options.styleInstruction?.trim() || validTurns[0]?.style?.trim(),
          model: resolvedModel,
          voice: singleVoice,
          languageCode: resolvedLang,
          audioMimeType: 'audio/wav',
          sampleRate: targetRate,
          store: options.store,
          maxRetries,
        });
        const wavMeta = parseWavMetadata(subRes.audioBuffer);
        const pcmSlice = wavMeta.isWav
          ? subRes.audioBuffer.subarray(wavMeta.dataOffset, wavMeta.dataOffset + wavMeta.dataBytes)
          : subRes.audioBuffer;
        if (i > 0 && pcmChunks.length > 0) {
          pcmChunks.push(sameSpeakerPauseBytes);
        }
        pcmChunks.push(pcmSlice);
        for (const th of subRes.thoughts) {
          if (!combinedThoughts.includes(th)) combinedThoughts.push(th);
        }
        aggUsage.inputTokens += subRes.usage.inputTokens;
        aggUsage.thoughtsTokens += subRes.usage.thoughtsTokens;
        aggUsage.outputTokens += subRes.usage.outputTokens;
        aggUsage.totalTokens += subRes.usage.totalTokens;
      }
      const stitchedWav = wrapPcm16InWavHeader(Buffer.concat(pcmChunks), targetRate, 1);
      const stitchedMeta = parseWavMetadata(stitchedWav);
      return {
        status: 'completed',
        audioBuffer: stitchedWav,
        mimeType: 'audio/wav',
        ext: '.wav',
        ...(stitchedMeta.durationSeconds > 0
          ? { durationSeconds: stitchedMeta.durationSeconds }
          : {}),
        thoughts: combinedThoughts,
        usage: aggUsage,
      };
    }

    const rawSingleStyle =
      options.styleInstruction?.trim() || validTurns[0]?.style?.trim() || '';
    const singleStyle = isCustomVoiceId(singleVoice)
      ? sanitizeStyleForLockedVoice(rawSingleStyle)
      : rawSingleStyle;
    const textPart: Record<string, any> = {
      type: 'text',
      text: singleText,
    };
    if (singleStyle) {
      textPart.annotations = [
        {
          type: 'speech_metadata',
          style: singleStyle,
        },
      ];
    }
    contentParts = [textPart];
    speechConfig = [
      {
        voice: singleVoice,
        ...(resolvedLang ? { language: resolvedLang } : {}),
      },
    ];
  }

  const requestBody: Record<string, any> = {
    model: resolvedModel,
    input: [
      {
        type: 'user_input',
        content: contentParts,
      },
    ],
    response_format: {
      type: 'audio',
      ...(options.audioMimeType ? { mime_type: options.audioMimeType } : {}),
      ...(options.sampleRate ? { sample_rate: options.sampleRate } : {}),
    },
    generation_config: {
      speech_config: speechConfig,
    },
    store: Boolean(options.store),
  };

  let attempt = 0;
  let retriedTtsWithoutLang = false;
  while (true) {
    try {
      const response = await fetch(INTERACTIONS_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Api-Revision': INTERACTIONS_API_REVISION,
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errText = await response.text();
        if (
          response.status === 400 &&
          !retriedTtsWithoutLang &&
          resolvedLang &&
          /language|locale|bcp|unsupported|invalid/i.test(errText)
        ) {
          retriedTtsWithoutLang = true;
          unsupportedTtsLanguageCodes.add(resolvedLang.toLowerCase());
          console.warn(
            `[TTS Language Fallback]: language "${resolvedLang}" not in explicit TTS catalog — retrying with automatic input-language detection...`
          );
          const sc = requestBody.generation_config?.speech_config;
          if (Array.isArray(sc)) {
            for (const entry of sc) {
              if (entry && typeof entry === 'object') delete entry.language;
            }
          } else if (sc && Array.isArray(sc.speakers)) {
            for (const sp of sc.speakers) {
              if (sp && typeof sp === 'object') delete sp.language;
            }
          }
          continue;
        }
        const error: any = new Error(
          `Interactions TTS API Error [${response.status} ${response.statusText}]: ${errText}`
        );
        error.statusCode = response.status;
        throw error;
      }

      const interaction = (await response.json()) as Record<string, any>;
      if (interaction.status === 'failed') {
        const details = (interaction.errors ?? [])
          .map((e: any) => `${e.code ? `[${e.code}] ` : ''}${e.message || ''}`.trim())
          .filter(Boolean)
          .join('; ');
        const err: any = new Error(
          `Interactions TTS generation failed: ${details || 'Unknown error'}`
        );
        err.status = interaction.errors?.[0]?.code;
        throw err;
      }

      let rawBase64 = '';
      let rawMime = '';
      const thoughts: string[] = [];

      if (Array.isArray(interaction.steps)) {
        for (const step of interaction.steps) {
          if (step?.type === 'thought' && Array.isArray(step.summary)) {
            for (const sPart of step.summary) {
              const t = String(typeof sPart === 'string' ? sPart : sPart?.text || '').trim();
              if (t && !thoughts.includes(t)) thoughts.push(t);
            }
          }
          if (step?.type === 'model_output' && Array.isArray(step.content)) {
            for (const part of step.content) {
              if (part?.type === 'audio' && typeof part.data === 'string' && part.data.length > 0) {
                rawBase64 = part.data;
                rawMime = String(part.mime_type || part.mimeType || '');
              }
            }
          }
        }
      }

      if (!rawBase64 && typeof interaction.output_audio?.data === 'string') {
        rawBase64 = interaction.output_audio.data;
        rawMime = String(interaction.output_audio.mime_type || interaction.output_audio.mimeType || '');
      }
      if (!rawBase64 && Array.isArray(interaction.outputs)) {
        const audOut = interaction.outputs.find(
          (o: any) => o?.type === 'audio' && typeof o.data === 'string'
        );
        if (audOut) {
          rawBase64 = audOut.data;
          rawMime = String(audOut.mime_type || audOut.mimeType || '');
        }
      }

      if (!rawBase64) {
        throw new Error(
          `Interactions TTS API (${resolvedModel}) returned no audio data part in steps[].content[].`
        );
      }

      let audioBuffer: Buffer = Buffer.from(rawBase64, 'base64');
      let detected = detectMediaMimeAndExtension(audioBuffer, rawMime || options.audioMimeType, 'audio');
      if (detected.mimeType === 'audio/l16') {
        audioBuffer = wrapPcm16InWavHeader(audioBuffer, options.sampleRate || 24000, 1);
        detected = { mimeType: 'audio/wav', ext: '.wav' };
      }

      const rawUsage = interaction.usage || {};
      const usage: InteractionUsageTelemetry = {
        inputTokens: rawUsage.total_input_tokens ?? 0,
        thoughtsTokens: rawUsage.total_thought_tokens ?? 0,
        outputTokens: rawUsage.total_output_tokens ?? 0,
        totalTokens: rawUsage.total_tokens ?? 0,
      };

      const wavMeta =
        detected.mimeType === 'audio/wav' ? parseWavMetadata(audioBuffer) : undefined;

      return {
        id: interaction.id,
        status: interaction.status,
        audioBuffer,
        mimeType: detected.mimeType,
        ext: detected.ext,
        ...(wavMeta && wavMeta.durationSeconds > 0
          ? { durationSeconds: wavMeta.durationSeconds }
          : {}),
        thoughts,
        usage,
      };
    } catch (err: any) {
      if (attempt < maxRetries && isRetryableError(err)) {
        attempt++;
        console.warn(
          `[Retry ${attempt}/${maxRetries}] Transient error on ${resolvedModel}: ${err.message}. Retrying...`
        );
        await new Promise((r) => setTimeout(r, 1500 * attempt));
        continue;
      }
      throw err;
    }
  }
}

/**
 * ISO 639-1 and ISO 639-3 primary language subtags officially supported natively by
 * `gemini-3.8-flash-tts` (`speech-generation.md#languages`). Languages outside this catalog
 * (such as regional, minority, or Indigenous languages with institutional Open-TTS endpoints)
 * return `false` from `isGeminiTtsNativelySupported()` so Stage 4 automatically skips `/v1beta/voices`
 * `CreateVoice` conditioning babble and allows seamless Open-TTS HTTP provider routing.
 */
export const GEMINI_FLASH_TTS_NATIVE_LANGUAGE_SUBTAGS: ReadonlySet<string> = new Set([
  'ace',
  'af', 'afr',
  'ak', 'aka', 'tw', 'twi',
  'am', 'amh',
  'ar', 'ara', 'arb', 'arz',
  'as', 'asm',
  'awa',
  'az', 'aze', 'azj', 'azb',
  'ba', 'bak',
  'ban',
  'be', 'bel',
  'bem',
  'bg', 'bul',
  'bho',
  'bjn',
  'bn', 'ben',
  'bs', 'bos',
  'bug',
  'ca', 'cat',
  'ceb',
  'ckb', 'ku', 'kur',
  'cmn', 'zh', 'zho', 'yue',
  'crh',
  'cs', 'ces',
  'da', 'dan',
  'de', 'deu',
  'dyu',
  'dz', 'dzo',
  'el', 'ell',
  'en', 'eng',
  'es', 'spa',
  'et', 'est',
  'eu', 'eus',
  'fa', 'fas', 'pes', 'prs',
  'ff', 'ful', 'fuv',
  'fi', 'fin',
  'fil', 'tl', 'tgl',
  'fr', 'fra',
  'gl', 'glg',
  'gn', 'grn',
  'gu', 'guj',
  'ha', 'hau',
  'he', 'iw', 'heb',
  'hi', 'hin',
  'hne',
  'hr', 'hrv',
  'ht', 'hat',
  'hu', 'hun',
  'hy', 'hye',
  'id', 'in', 'ind',
  'ig', 'ibo',
  'ilo',
  'is', 'isl',
  'it', 'ita',
  'ja', 'jpn',
  'jv', 'jw', 'jav',
  'ka', 'kat',
  'kab',
  'kam',
  'kg', 'kon',
  'ki', 'kik',
  'kk', 'kaz',
  'km', 'khm',
  'kn', 'kan',
  'ko', 'kor',
  'ks', 'kas',
  'ky', 'kir',
  'lb', 'ltz',
  'lg', 'lug',
  'ln', 'lin',
  'lo', 'lao',
  'lt', 'lit',
  'ltg',
  'lus',
  'lv', 'lav', 'lvs',
  'mag',
  'mai',
  'min',
  'mk', 'mkd',
  'ml', 'mal',
  'mn', 'mon', 'khk',
  'mni',
  'mr', 'mar',
  'ms', 'msa', 'zsm',
  'mt', 'mlt',
  'my', 'mya',
  'nb', 'nob', 'nn', 'nno', 'no', 'nor',
  'ne', 'nep', 'npi',
  'nl', 'nld',
  'nso',
  'ny', 'nya',
  'oc', 'oci',
  'or', 'ori', 'ory',
  'pa', 'pan',
  'pag',
  'pl', 'pol',
  'ps', 'pus', 'pbt',
  'pt', 'por',
  'ro', 'ron',
  'ru', 'rus',
  'rw', 'kin',
  'sat',
  'sd', 'snd',
  'si', 'sin',
  'sk', 'slk',
  'sl', 'slv',
  'so', 'som',
  'sq', 'sqi', 'als',
  'sr', 'srp',
  'ss', 'ssw',
  'st', 'sot',
  'sv', 'swe',
  'sw', 'swa', 'swh',
  'ta', 'tam',
  'te', 'tel',
  'tg', 'tgk',
  'th', 'tha',
  'ti', 'tir',
  'tr', 'tur',
  'ug', 'uig',
  'uz', 'uzb', 'uzn',
  'vi', 'vie',
]);

/**
 * Returns `true` when the primary ISO 639 subtag of `languageCode` (e.g. `nb-NO`, `en-US`, `ja-JP`)
 * is in `gemini-3.8-flash-tts`'s native catalog, and `false` for unlisted regional/Indigenous languages.
 */
export function isGeminiTtsNativelySupported(languageCode?: string): boolean {
  const raw = String(languageCode || '').trim();
  if (!raw) return true;
  const primary = raw.replace(/_/g, '-').split('-')[0].toLowerCase();
  if (!primary) return true;
  return GEMINI_FLASH_TTS_NATIVE_LANGUAGE_SUBTAGS.has(primary);
}

export const DEFAULT_EXTERNAL_TTS_MAX_CHARS = 550;

export interface ExternalHttpTtsRequestOptions {
  endpointTemplate: string;
  method?: 'POST' | 'GET';
  transcriptText?: string;
  turns?: FlashTtsDialogueTurn[];
  speakers?: Array<{ speaker: string; voice: string }>;
  voice?: string;
  languageCode?: string;
  textField?: string;
  voiceField?: string;
  langField?: string;
  bodyTemplate?: string;
  authEnv?: string;
  authHeader?: string;
  sampleRate?: number;
  maxChars?: number;
  maxRetries?: number;
}

/**
 * Resolves `{lang}`, `{bcp47}`, `{languageCode}`, `{voice}`, `{speaker}`, and `{text}` placeholders
 * inside an external Open-TTS endpoint URL template using `encodeURIComponent`.
 */
export function buildExternalHttpTtsUrl(
  endpointTemplate: string,
  params: {
    text: string;
    voice: string;
    speaker?: string;
    languageCode?: string;
  }
): string {
  const bcp47 = String(params.languageCode || 'en-US').trim().replace(/_/g, '-');
  const lang = bcp47.split('-')[0].toLowerCase() || 'en';
  const lookup: Record<string, string> = {
    lang,
    bcp47,
    languagecode: bcp47,
    language_code: bcp47,
    voice: params.voice,
    speaker: params.speaker || params.voice,
    text: params.text,
  };
  return endpointTemplate.replace(/\{([a-zA-Z0-9_]+)\}/g, (full, key: string) => {
    const k = key.toLowerCase();
    return k in lookup ? encodeURIComponent(lookup[k]) : full;
  });
}

/**
 * Provider-abstract, zero-dependency HTTP Open-TTS synthesis client supporting institutional,
 * academic, regional, and self-hosted neural speech REST APIs (`POST` JSON or `GET` query endpoints
 * returning `audio/wav`, `audio/mpeg`, `audio/ogg`, `audio/l16`, or JSON base64 audio envelopes).
 * Automatically chunks paragraphs/sentences (`<= 550` chars), synthesizes single- or multi-speaker
 * dialogue turns (`turns[]`), normalizes heterogeneous RIFF/WAVE streams to a common 16-bit mono PCM
 * sample rate, and stitches natural studio breath and speaker-switch pauses.
 */
export async function generateExternalHttpTtsAudio(
  options: ExternalHttpTtsRequestOptions
): Promise<FlashTtsAudioResult> {
  const endpointTemplate = String(options.endpointTemplate || '').trim();
  if (!/^https?:\/\//i.test(endpointTemplate)) {
    throw new Error(
      `External HTTP TTS requires a valid http(s):// ttsEndpoint URL template (got "${endpointTemplate}").`
    );
  }
  const method: 'POST' | 'GET' = options.method === 'GET' ? 'GET' : 'POST';
  const defaultVoice = String(options.voice || 'default').trim() || 'default';
  const bcp47 = String(options.languageCode || 'en-US').trim().replace(/_/g, '-');
  const primarySubtag = bcp47.split('-')[0].toLowerCase() || 'en';
  const maxChars = Math.max(120, Math.min(2000, options.maxChars ?? DEFAULT_EXTERNAL_TTS_MAX_CHARS));
  const maxRetries = options.maxRetries ?? 2;

  const speakerMap = new Map<string, string>();
  if (Array.isArray(options.speakers)) {
    for (const sp of options.speakers) {
      const sName = String(sp?.speaker || '').trim();
      const sVoice = String(sp?.voice || '').trim();
      if (sName && sVoice && !speakerMap.has(sName)) {
        speakerMap.set(sName, sVoice);
      }
    }
  }
  const validTurns = Array.isArray(options.turns)
    ? options.turns.filter((t) => t && typeof t.text === 'string' && t.text.trim().length > 0)
    : [];
  for (const t of validTurns) {
    const sName = String(t.speaker || '').trim();
    const sVoice = String(t.voice || '').trim();
    if (sName && sVoice && !speakerMap.has(sName)) {
      speakerMap.set(sName, sVoice);
    }
  }

  interface SynthesisSegment {
    speaker: string;
    voice: string;
    text: string;
  }

  // Classical FST/HFST/VITS G2P tokenizers drop digits glued directly onto all-caps acronyms (e.g. `STD17` -> `STD`);
  // separating `([\p{Lu}]{2,6})(\d{2,5})` -> `$1 $2` ensures both the acronym and digits are spoken cleanly.
  const normalizeSegmentForExternalG2p = (rawPara: string): string =>
    rawPara
      .replace(/(?<![\p{L}\p{N}_/-])([\p{Lu}]{2,6})(\d{2,5})(?![\p{L}\p{N}_/-])/gu, '$1 $2')
      .replace(/\s+/g, ' ')
      .trim();

  const segments: SynthesisSegment[] = [];
  if (validTurns.length > 0) {
    for (const turn of validTurns) {
      const spk = String(turn.speaker || 'Speaker').trim() || 'Speaker';
      const turnVoice =
        (turn.voice && turn.voice.trim()) || speakerMap.get(spk) || defaultVoice;
      const chunks = splitTtsTranscriptIntoSafeChunks(turn.text, maxChars);
      for (const ch of chunks) {
        for (const para of ch.split(/\n\s*\n/).map(normalizeSegmentForExternalG2p).filter(Boolean)) {
          segments.push({ speaker: spk, voice: turnVoice, text: para });
        }
      }
    }
  } else {
    const cleanSingle = String(options.transcriptText || '')
      .replace(/^\s*\[[^\]\r\n]{1,60}\]:\s*/gm, '')
      .trim();
    const singleVoice = Array.from(speakerMap.values())[0] || defaultVoice;
    const chunks = splitTtsTranscriptIntoSafeChunks(cleanSingle, maxChars);
    for (const ch of chunks) {
      for (const para of ch.split(/\n\s*\n/).map(normalizeSegmentForExternalG2p).filter(Boolean)) {
        segments.push({ speaker: 'Narrator', voice: singleVoice, text: para });
      }
    }
  }

  if (segments.length === 0) {
    throw new Error('External HTTP TTS received empty transcript text after normalization.');
  }

  const headers: Record<string, string> = {
    Accept: 'audio/wav, audio/x-wav, audio/*;q=0.9, application/json;q=0.8',
  };
  if (method === 'POST') {
    headers['Content-Type'] = 'application/json';
  }
  if (options.authEnv) {
    const token = String(process.env[options.authEnv] || '').trim();
    if (token) {
      const hdrName = String(options.authHeader || 'Authorization').trim() || 'Authorization';
      headers[hdrName] =
        /^authorization$/i.test(hdrName) && !/^(?:Bearer|Basic|Token)\s+/i.test(token)
          ? `Bearer ${token}`
          : token;
    }
  }

  const fetchSegmentAudio = async (seg: SynthesisSegment): Promise<{ buffer: Buffer; mimeType: string; ext: string }> => {
    const url = buildExternalHttpTtsUrl(endpointTemplate, {
      text: seg.text,
      voice: seg.voice,
      speaker: seg.speaker,
      languageCode: bcp47,
    });

    let bodyStr: string | undefined;
    if (method === 'POST') {
      if (options.bodyTemplate) {
        const jsonEsc = (v: string) => JSON.stringify(v).slice(1, -1);
        bodyStr = options.bodyTemplate.replace(/\{([a-zA-Z0-9_]+)\}/g, (full, key: string) => {
          const k = key.toLowerCase();
          if (k === 'text') return jsonEsc(seg.text);
          if (k === 'voice') return jsonEsc(seg.voice);
          if (k === 'speaker') return jsonEsc(seg.speaker);
          if (k === 'lang') return jsonEsc(primarySubtag);
          if (k === 'bcp47' || k === 'languagecode' || k === 'language_code') return jsonEsc(bcp47);
          return full;
        });
      } else {
        const payload: Record<string, any> = {
          [options.textField || 'text']: seg.text,
        };
        if (options.voiceField) {
          payload[options.voiceField] = seg.voice;
        }
        if (options.langField) {
          payload[options.langField] = primarySubtag;
        }
        bodyStr = JSON.stringify(payload);
      }
    }

    let attempt = 0;
    while (true) {
      try {
        const res = await fetch(url, {
          method,
          headers,
          ...(bodyStr !== undefined ? { body: bodyStr } : {}),
        });
        if (!res.ok) {
          const errText = await res.text().catch(() => '');
          const error: any = new Error(
            `External HTTP TTS Error [${res.status} ${res.statusText}] (${url}): ${errText.slice(0, 300)}`
          );
          error.statusCode = res.status;
          throw error;
        }

        const contentType = String(res.headers.get('content-type') || '').toLowerCase();
        let rawBuf: Buffer = Buffer.from(await res.arrayBuffer());
        let declaredMime = contentType;

        if (
          contentType.includes('application/json') ||
          (rawBuf.length > 2 &&
            rawBuf[0] === 0x7b &&
            rawBuf.subarray(0, 4).toString('ascii') !== 'RIFF' &&
            rawBuf.subarray(0, 4).toString('ascii') !== 'OggS' &&
            rawBuf.subarray(0, 3).toString('ascii') !== 'ID3')
        ) {
          const jsonPayload = JSON.parse(rawBuf.toString('utf-8')) as Record<string, any>;
          const b64 =
            jsonPayload?.audio ??
            jsonPayload?.audioContent ??
            jsonPayload?.audio_content ??
            jsonPayload?.audio_base64 ??
            jsonPayload?.data;
          if (typeof b64 !== 'string' || !b64.trim()) {
            throw new Error(
              `External HTTP TTS JSON response from ${url} contained no base64 audio field (audio/audioContent/data).`
            );
          }
          const cleanB64 = b64.replace(/^data:[^;]+;base64,/i, '').trim();
          rawBuf = Buffer.from(cleanB64, 'base64');
          declaredMime = String(jsonPayload?.mime_type || jsonPayload?.mimeType || 'audio/wav');
        }

        if (rawBuf.length === 0) {
          throw new Error(`External HTTP TTS returned 0 audio bytes from ${url}.`);
        }

        let detected = detectMediaMimeAndExtension(rawBuf, declaredMime, 'audio');
        if (detected.mimeType === 'audio/l16') {
          rawBuf = wrapPcm16InWavHeader(rawBuf, options.sampleRate || 24000, 1);
          detected = { mimeType: 'audio/wav', ext: '.wav' };
        }
        return { buffer: rawBuf, mimeType: detected.mimeType, ext: detected.ext };
      } catch (err: any) {
        if (attempt < maxRetries && isRetryableError(err)) {
          attempt++;
          console.warn(
            `[External TTS Retry ${attempt}/${maxRetries}] Transient error on ${url}: ${err.message}. Retrying...`
          );
          await new Promise((r) => setTimeout(r, 1500 * attempt));
          continue;
        }
        throw err;
      }
    }
  };

  const segmentOutputs: Array<{
    seg: SynthesisSegment;
    buffer: Buffer;
    mimeType: string;
    ext: string;
  }> = [];
  for (const seg of segments) {
    const out = await fetchSegmentAudio(seg);
    segmentOutputs.push({ seg, ...out });
  }

  if (segmentOutputs.length === 1 && segmentOutputs[0].mimeType !== 'audio/wav') {
    return {
      status: 'completed',
      audioBuffer: segmentOutputs[0].buffer,
      mimeType: segmentOutputs[0].mimeType,
      ext: segmentOutputs[0].ext,
      thoughts: [],
      usage: { inputTokens: 0, thoughtsTokens: 0, outputTokens: 0, totalTokens: 0 },
    };
  }

  // Determine common target WAV sample rate (explicit `sampleRate` override if provided, else first WAV's native rate)
  let targetSampleRate = options.sampleRate && options.sampleRate >= 4000 ? options.sampleRate : 0;
  if (!targetSampleRate) {
    for (const item of segmentOutputs) {
      const m = parseWavMetadata(item.buffer);
      if (m.isWav && m.sampleRate >= 4000) {
        targetSampleRate = m.sampleRate;
        break;
      }
    }
  }
  if (!targetSampleRate) targetSampleRate = 24000;

  const sameSpeakerPauseBytes = Buffer.alloc(Math.round(targetSampleRate * 0.26) * 2, 0);
  const switchSpeakerPauseBytes = Buffer.alloc(Math.round(targetSampleRate * 0.34) * 2, 0);
  const pcmChunks: Buffer[] = [];

  for (let i = 0; i < segmentOutputs.length; i++) {
    const item = segmentOutputs[i];
    const extracted = extractNormalizedMono16PcmFromWav(item.buffer, targetSampleRate);
    if (!extracted) {
      if (segmentOutputs.length === 1) {
        return {
          status: 'completed',
          audioBuffer: item.buffer,
          mimeType: item.mimeType,
          ext: item.ext,
          thoughts: [],
          usage: { inputTokens: 0, thoughtsTokens: 0, outputTokens: 0, totalTokens: 0 },
        };
      }
      throw new Error(
        `Multi-chunk external HTTP TTS stitching requires RIFF/WAVE or PCM16 responses, but received ${item.mimeType}.`
      );
    }
    if (i > 0 && pcmChunks.length > 0) {
      pcmChunks.push(
        segmentOutputs[i - 1].seg.voice === item.seg.voice
          ? sameSpeakerPauseBytes
          : switchSpeakerPauseBytes
      );
    }
    pcmChunks.push(extracted.pcm);
  }

  const stitchedWav = wrapPcm16InWavHeader(Buffer.concat(pcmChunks), targetSampleRate, 1);
  const stitchedMeta = parseWavMetadata(stitchedWav);
  return {
    status: 'completed',
    audioBuffer: stitchedWav,
    mimeType: 'audio/wav',
    ext: '.wav',
    ...(stitchedMeta.durationSeconds > 0 ? { durationSeconds: stitchedMeta.durationSeconds } : {}),
    thoughts: [],
    usage: { inputTokens: 0, thoughtsTokens: 0, outputTokens: 0, totalTokens: 0 },
  };
}
