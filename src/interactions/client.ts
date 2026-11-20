import { GEMINI_4_ARGON_MODEL, INTERACTIONS_API_REVISION, INTERACTIONS_API_URL, type ThinkingLevel, loadDotEnvIfExists } from './env.js';

export interface InteractionUsageTelemetry {
  inputTokens: number;
  thoughtsTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export interface Gemini4ArgonInteractionResult {
  id?: string;
  status?: string;
  text: string;
  thoughts: string[];
  searchQueries: string[];
  steps: any[];
  usage: InteractionUsageTelemetry;
}

export interface Gemini4ArgonRequestOptions {
  promptText?: string;
  steps?: any[];
  thinkingLevel: ThinkingLevel;
  maxOutputTokens: number;
  includeThoughts?: boolean;
  useGoogleSearch?: boolean;
  tools?: any[];
  outputFormat?: 'text' | 'json';
  outputJsonSchema?: Record<string, any>;
  store?: boolean;
  previousInteractionId?: string;
  onThought?: (thoughtStep: string, allThoughts: string[]) => void;
  onSearchQuery?: (queries: string[], allQueries: string[]) => void;
  onTextDelta?: (deltaText: string, accumulatedText: string) => void;
}

export function getApiKey(): string {
  if (!process.env.GEMINI_API_KEY && !process.env.GOOGLE_API_KEY && !process.env.GOOGLE_GENAI_API_KEY) {
    loadDotEnvIfExists();
  }
  const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.GOOGLE_GENAI_API_KEY;
  if (!key) {
    throw new Error(
      'Missing GEMINI_API_KEY environment variable. Add GEMINI_API_KEY="your-key" to .env.local.'
    );
  }
  return key;
}

export function isRetryableError(err: any): boolean {
  const status = err?.statusCode || err?.status;
  if (status === 429 || status === 500 || status === 502 || status === 503 || status === 504) {
    return true;
  }
  const msg = String(err?.message || err || '').toLowerCase();
  return (
    msg.includes('fetch failed') ||
    msg.includes('unavailable') ||
    msg.includes('overloaded') ||
    msg.includes('rate limit') ||
    msg.includes('resource_exhausted') ||
    msg.includes('deadline_exceeded') ||
    msg.includes('aborted') ||
    msg.includes('error reading from the stream')
  );
}

/**
 * Direct SSE streaming client for Gemini 4 Argon (`gemini-4-argon`) via the Google AI Interactions API
 * (`/v1beta/interactions`). Zero external framework bloat.
 */
export async function streamGemini4ArgonInteraction(
  options: Gemini4ArgonRequestOptions
): Promise<Gemini4ArgonInteractionResult> {
  const apiKey = getApiKey();
  const tools: any[] = [];
  if (options.useGoogleSearch) {
    tools.push({ type: 'google_search' });
  }
  if (Array.isArray(options.tools)) {
    tools.push(...options.tools);
  }

  const inputSteps =
    options.steps && options.steps.length > 0
      ? options.steps
      : [
          {
            type: 'user_input',
            content: [{ type: 'text', text: options.promptText || '' }],
          },
        ];

  const requestBody: Record<string, any> = {
    model: GEMINI_4_ARGON_MODEL,
    tools: tools.length > 0 ? tools : undefined,
    generation_config: {
      max_output_tokens: options.maxOutputTokens,
      thinking_level: options.thinkingLevel.toLowerCase(),
      thinking_summaries: options.includeThoughts === false ? 'none' : 'auto',
    },
    stream: true,
    store: Boolean(options.store),
    input: inputSteps,
  };

  if (options.previousInteractionId) {
    requestBody.previous_interaction_id = options.previousInteractionId;
  }

  if (options.outputFormat === 'json') {
    requestBody.response_format = {
      type: 'text',
      mime_type: 'application/json',
      ...(options.outputJsonSchema ? { schema: options.outputJsonSchema } : {}),
    };
  }

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
      `Gemini 4 Argon Interactions API Error [${response.status} ${response.statusText}]: ${errText}`
    );
    error.statusCode = response.status;
    throw error;
  }

  if (!response.body) {
    throw new Error('Gemini 4 Argon Interactions API returned an empty response body.');
  }

  const interaction: Record<string, any> = { steps: [] };
  const thoughts: string[] = [];
  const searchQueries: string[] = [];
  let accumulatedText = '';
  const partialArgumentsMap = new Map<number, string>();

  const decoderStream = response.body.pipeThrough(new TextDecoderStream('utf-8'));
  const reader = decoderStream.getReader();
  let buffer = '';

  const processEvent = (event: any) => {
    if (!event || typeof event !== 'object') return;

    if (event.event_type === 'error') {
      const err: any = new Error(
        `Interactions API stream error [${event.error?.code || 'UNKNOWN'}]: ${event.error?.message || JSON.stringify(event)}`
      );
      err.status = event.error?.code;
      throw err;
    }

    if (
      event.event_type === 'interaction.created' ||
      event.event_type === 'interaction.completed' ||
      event.event_type === 'interaction.complete'
    ) {
      const { steps, ...rest } = event.interaction || {};
      Object.assign(interaction, rest);
      if (Array.isArray(steps) && steps.length > 0) {
        if (!Array.isArray(interaction.steps)) {
          interaction.steps = [];
        }
        const mergedExisting = new Set<any>();
        for (let i = 0; i < steps.length; i++) {
          const completedStep = steps[i];
          if (!completedStep || typeof completedStep !== 'object') continue;

          let targetStep: any = null;
          const atIdx = interaction.steps[i];
          if (
            atIdx &&
            typeof atIdx === 'object' &&
            !mergedExisting.has(atIdx) &&
            (!atIdx.type || !completedStep.type || atIdx.type === completedStep.type) &&
            (!completedStep.id || !atIdx.id || atIdx.id === completedStep.id) &&
            (!completedStep.call_id || !atIdx.call_id || atIdx.call_id === completedStep.call_id)
          ) {
            targetStep = atIdx;
          } else {
            targetStep = interaction.steps.find(
              (s: any) =>
                s &&
                typeof s === 'object' &&
                !mergedExisting.has(s) &&
                s.type === completedStep.type &&
                (!completedStep.id || !s.id || s.id === completedStep.id) &&
                (!completedStep.call_id || !s.call_id || s.call_id === completedStep.call_id)
            );
          }

          if (!targetStep) {
            if (!interaction.steps[i]) {
              interaction.steps[i] = completedStep;
            } else {
              interaction.steps.push(completedStep);
            }
            mergedExisting.add(completedStep);
            targetStep = completedStep;
          } else {
            mergedExisting.add(targetStep);
            for (const [k, v] of Object.entries(completedStep)) {
              if (v === undefined || v === null) continue;
              if (
                k === 'content' &&
                Array.isArray(v) &&
                Array.isArray(targetStep.content) &&
                targetStep.content.length > 0
              ) {
                for (const cPart of v) {
                  if (!cPart || typeof cPart !== 'object') continue;
                  if (cPart.type === 'text') {
                    let existingTextPart = [...targetStep.content]
                      .reverse()
                      .find((p: any) => p && p.type === 'text');
                    if (!existingTextPart) {
                      existingTextPart = { type: 'text', text: cPart.text || '' };
                      targetStep.content.push(existingTextPart);
                    } else if (
                      typeof cPart.text === 'string' &&
                      cPart.text.length > (existingTextPart.text || '').length
                    ) {
                      existingTextPart.text = cPart.text;
                    }
                    if (Array.isArray(cPart.annotations) && cPart.annotations.length > 0) {
                      const existingAnns: any[] = Array.isArray(existingTextPart.annotations)
                        ? existingTextPart.annotations
                        : [];
                      const seenAnnKeys = new Set(
                        existingAnns.map(
                          (a: any) =>
                            `${a?.start_index ?? ''}:${a?.end_index ?? ''}:${a?.url ?? ''}`
                        )
                      );
                      for (const ann of cPart.annotations) {
                        const key = `${ann?.start_index ?? ''}:${ann?.end_index ?? ''}:${ann?.url ?? ''}`;
                        if (!seenAnnKeys.has(key)) {
                          seenAnnKeys.add(key);
                          existingAnns.push(ann);
                        }
                      }
                      existingTextPart.annotations = existingAnns;
                    }
                  } else {
                    const alreadyPresent = targetStep.content.some(
                      (p: any) =>
                        p &&
                        p.type === cPart.type &&
                        ((cPart.id && p.id === cPart.id) ||
                          (cPart.name && p.name === cPart.name) ||
                          JSON.stringify(p) === JSON.stringify(cPart))
                    );
                    if (!alreadyPresent) {
                      targetStep.content.push(cPart);
                    }
                  }
                }
              } else if (Array.isArray(v)) {
                if (v.length > 0 || !Array.isArray(targetStep[k])) {
                  targetStep[k] = v;
                }
              } else {
                targetStep[k] = v;
              }
            }
          }

          if (
            completedStep.type === 'google_search_call' &&
            Array.isArray(completedStep.arguments?.queries)
          ) {
            const newQueries = completedStep.arguments.queries.filter(
              (q: any) => typeof q === 'string' && q.trim() && !searchQueries.includes(q)
            );
            if (newQueries.length > 0) {
              searchQueries.push(...newQueries);
              options.onSearchQuery?.(newQueries, searchQueries);
            }
          }

          if (completedStep.type === 'thought' && Array.isArray(completedStep.summary)) {
            for (const sPart of completedStep.summary) {
              const thoughtText = String(
                typeof sPart === 'string' ? sPart : sPart?.text || ''
              ).trim();
              if (thoughtText && !thoughts.includes(thoughtText)) {
                thoughts.push(thoughtText);
                options.onThought?.(thoughtText, thoughts);
              }
            }
          }
        }
      }
      return;
    }

    if (event.event_type === 'interaction.status_update') {
      interaction.status = event.status;
      return;
    }

    if (event.event_type === 'step.start') {
      if (!interaction.steps) interaction.steps = [];
      interaction.steps[event.index] = event.step;
      return;
    }

    if (event.event_type === 'step.delta') {
      if (!interaction.steps) interaction.steps = [];
      const step = interaction.steps[event.index];
      const delta = event.delta;
      if (!delta) return;

      if (delta.type === 'thought_summary' && delta.content?.text) {
        const thoughtText = String(delta.content.text).trim();
        if (thoughtText) {
          thoughts.push(thoughtText);
          options.onThought?.(thoughtText, thoughts);
        }
      }

      if (delta.type === 'google_search_call' && Array.isArray(delta.arguments?.queries)) {
        const queries = delta.arguments.queries.filter((q: any) => typeof q === 'string' && q.trim());
        if (queries.length > 0) {
          searchQueries.push(...queries);
          options.onSearchQuery?.(queries, searchQueries);
        }
      }

      if (step) {
        if (step.type === 'model_output' || step.type === 'user_input' || step.type === 'thought') {
          if (step.type === 'thought' && !step.summary) step.summary = [];
          if (step.type !== 'thought' && !step.content) step.content = [];
          const arr = step.type === 'thought' ? step.summary : step.content;

          if (delta.type === 'text' && typeof delta.text === 'string') {
            const last = arr[arr.length - 1];
            if (last?.type === 'text') {
              last.text = (last.text ?? '') + delta.text;
            } else {
              arr.push({ type: 'text', text: delta.text });
            }
            if (step.type === 'model_output') {
              accumulatedText += delta.text;
              options.onTextDelta?.(delta.text, accumulatedText);
            }
          } else if (delta.type === 'text_annotation_delta' && Array.isArray(delta.annotations)) {
            let target = [...arr].reverse().find((c: any) => c.type === 'text');
            if (!target) {
              target = { type: 'text', text: '' };
              arr.push(target);
            }
            target.annotations = [...(target.annotations ?? []), ...delta.annotations];
          } else if (delta.type === 'thought_summary' && delta.content) {
            arr.push(delta.content);
          } else if (delta.type === 'thought_signature' && step.type === 'thought') {
            step.signature = delta.signature;
          } else if (delta.type === 'function_call') {
            arr.push({
              type: 'function_call',
              name: delta.name,
              id: delta.id,
              arguments: delta.arguments,
            });
          }
        } else if (step.type === 'function_call' && delta.type === 'arguments_delta') {
          const existing = partialArgumentsMap.get(event.index) || '';
          partialArgumentsMap.set(event.index, existing + (delta.arguments || ''));
        } else if (delta.type === step.type) {
          const { type: _type, ...fields } = delta;
          for (const [k, v] of Object.entries(fields)) {
            if (v !== undefined) {
              step[k] = v;
            }
          }
        }
      }
      return;
    }

    if (event.event_type === 'step.stop') {
      if (partialArgumentsMap.has(event.index)) {
        const step = interaction.steps?.[event.index];
        if (step && step.type === 'function_call') {
          try {
            const argStr = partialArgumentsMap.get(event.index);
            if (argStr) {
              step.arguments = JSON.parse(argStr);
            }
          } catch {
            // Ignore malformed partial JSON
          }
        }
        partialArgumentsMap.delete(event.index);
      }
    }
  };

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += value;

      while (true) {
        const match = buffer.match(/\r\n\r\n|\n\n|\r\r/);
        if (!match || match.index === undefined) break;
        const block = buffer.slice(0, match.index);
        buffer = buffer.slice(match.index + match[0].length);

        const lines = block.split(/\r\n|\r|\n/);
        let dataText = '';
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            dataText += line.slice(6);
          } else if (line.startsWith('data:')) {
            dataText += line.slice(5);
          }
        }
        if (!dataText || dataText === '[DONE]') continue;
        const parsed = JSON.parse(dataText);
        processEvent(parsed);
      }
    }
  } finally {
    reader.releaseLock();
  }

  if (interaction.status === 'failed') {
    const details = (interaction.errors ?? [])
      .map((e: any) => `${e.code ? `[${e.code}] ` : ''}${e.message || ''}`.trim())
      .filter(Boolean)
      .join('; ');
    const err: any = new Error(`Gemini 4 Argon interaction failed: ${details || 'Unknown error'}`);
    err.status = interaction.errors?.[0]?.code;
    throw err;
  }

  if (interaction.status === 'in_progress') {
    const err: any = new Error(
      `Gemini 4 Argon SSE stream closed prematurely while status was still 'in_progress' (${accumulatedText.length} chars received before stream drop)`
    );
    err.status = 503;
    throw err;
  }

  // Fallback text extraction from completed steps if not already accumulated via deltas
  if (!accumulatedText && Array.isArray(interaction.steps)) {
    for (const step of interaction.steps) {
      if (step?.type === 'model_output' && Array.isArray(step.content)) {
        for (const part of step.content) {
          if (part?.type === 'text' && typeof part.text === 'string') {
            accumulatedText += part.text;
          }
        }
      }
    }
  }

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
    text: accumulatedText,
    thoughts,
    searchQueries,
    steps: interaction.steps || [],
    usage,
  };
}

/**
 * Executes a Gemini 4 Argon interaction with automatic retry and optional thinking-level fallback
 * (e.g., Stage 1 retries `HIGH` once and falls back to `MEDIUM` if overloaded).
 */
export async function executeWithRetryAndFallback(
  options: Gemini4ArgonRequestOptions,
  maxRetries: number = 1,
  fallbackThinkingLevel?: ThinkingLevel
): Promise<{ result: Gemini4ArgonInteractionResult; usedThinkingLevel: ThinkingLevel }> {
  let attempt = 0;
  while (true) {
    try {
      const result = await streamGemini4ArgonInteraction(options);
      return { result, usedThinkingLevel: options.thinkingLevel };
    } catch (err: any) {
      if (attempt < maxRetries && isRetryableError(err)) {
        attempt++;
        console.warn(
          `[Retry ${attempt}/${maxRetries}] Transient error on ${GEMINI_4_ARGON_MODEL} (thinkingLevel: ${options.thinkingLevel}): ${err.message}. Retrying...`
        );
        await new Promise((r) => setTimeout(r, 1500 * attempt));
        continue;
      }
      if (
        fallbackThinkingLevel &&
        fallbackThinkingLevel !== options.thinkingLevel &&
        isRetryableError(err)
      ) {
        console.warn(
          `[Fallback] Switching ${GEMINI_4_ARGON_MODEL} from thinkingLevel ${options.thinkingLevel} -> ${fallbackThinkingLevel} after error: ${err.message}`
        );
        const fallbackResult = await streamGemini4ArgonInteraction({
          ...options,
          thinkingLevel: fallbackThinkingLevel,
        });
        return { result: fallbackResult, usedThinkingLevel: fallbackThinkingLevel };
      }
      throw err;
    }
  }
}
