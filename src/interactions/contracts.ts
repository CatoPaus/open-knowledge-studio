import * as fs from 'fs';
import * as path from 'path';

import { GEMINI_4_ARGON_MODEL, GEMINI_FLASH_TTS_MODEL, GEMINI_NANO_BANANA_MODEL, type ThinkingLevel, normalizeThinkingLevel } from './env.js';

export interface StagePromptContract {
  name: string;
  model: string;
  maxOutputTokens: number;
  thinkingLevel: ThinkingLevel;
  includeThoughts: boolean;
  useGoogleSearch: boolean;
  outputFormat: 'text' | 'json' | 'image' | 'audio';
  outputJsonSchema?: Record<string, any>;
  aspectRatio?: string;
  imageSize?: string;
  voice?: string;
  languageCode?: string;
  voiceLock?: boolean;
  voiceDesignPrompt?: string;
  dialogueMode?: 'semantic' | 'alternating';
  primarySpeaker?: string;
  primaryVoice?: string;
  primaryStyle?: string;
  primaryRole?: string;
  primaryVoiceDesignPrompt?: string;
  secondarySpeaker?: string;
  secondaryVoice?: string;
  secondaryStyle?: string;
  secondaryRole?: string;
  secondaryVoiceDesignPrompt?: string;
  audioMimeType?: string;
  sampleRate?: number;
  template: string;
}

/**
 * Parses `output.schema` or `output.jsonSchema` from stage contract YAML frontmatter.
 * Supports flat scalars (`title: string`), scalar arrays (`bullets: string[]`),
 * nested object arrays (`slides(array):` / `slides[]:` / `slides: array` with indented child fields),
 * nested objects (`metadata:` with indented child fields), or inline JSON Schema (`jsonSchema: {...}`).
 */
function parseFrontmatterOutputSchema(outputBlock: string): Record<string, any> | undefined {
  const inlineJsonMatch = outputBlock.match(/(?:jsonSchema|schema):\s*(\{[\s\S]*\})\s*$/);
  if (inlineJsonMatch) {
    try {
      return JSON.parse(inlineJsonMatch[1]);
    } catch {
      // Fall through to line-by-line YAML schema parsing
    }
  }

  const schemaSectionMatch = outputBlock.match(/schema:\s*[\r\n]+([\s\S]*)$/);
  if (!schemaSectionMatch) return undefined;

  const rawLines = schemaSectionMatch[1].split(/\r?\n/);
  const schemaLines: Array<{ indent: number; text: string }> = [];
  for (const line of rawLines) {
    if (!line.trim() || /^\s*#/.test(line)) continue;
    if (/^\S/.test(line)) break;
    const indent = line.match(/^\s*/)?.[0].length ?? 0;
    schemaLines.push({ indent, text: line.trim() });
  }

  if (schemaLines.length === 0) return undefined;

  function parseBlock(startIndex: number, minIndent: number): {
    properties: Record<string, any>;
    required: string[];
    nextIndex: number;
  } {
    const properties: Record<string, any> = {};
    const required: string[] = [];
    let i = startIndex;

    while (i < schemaLines.length) {
      const current = schemaLines[i];
      if (!current || current.indent < minIndent) break;

      const lineMatch = current.text.match(
        /^([a-zA-Z0-9_]+)(\[\]|\(array\))?(\?)?:\s*(.*)$/i
      );
      if (!lineMatch) {
        i++;
        continue;
      }

      const [, propName, arraySuffix, optionalFlag, rawType] = lineMatch;
      const typeStr = rawType.trim();
      const isOptional = Boolean(optionalFlag);
      const nextLine = schemaLines[i + 1];
      const hasChildren = Boolean(nextLine && nextLine.indent > current.indent);

      const isArrayHeader =
        Boolean(arraySuffix) ||
        /^array$/i.test(typeStr) ||
        /^array<object>$/i.test(typeStr);

      if (hasChildren && nextLine) {
        const childBlock = parseBlock(i + 1, nextLine.indent);
        const objectSchema = {
          type: 'object',
          properties: childBlock.properties,
          required: childBlock.required,
        };
        properties[propName] = isArrayHeader
          ? { type: 'array', items: objectSchema }
          : objectSchema;
        if (!isOptional) required.push(propName);
        i = childBlock.nextIndex;
        continue;
      }

      const scalarArrayMatch =
        typeStr.match(/^(string|integer|number|boolean)\[\]$/i) ||
        typeStr.match(/^array<\s*(string|integer|number|boolean)\s*>$/i);
      if (scalarArrayMatch) {
        properties[propName] = {
          type: 'array',
          items: { type: scalarArrayMatch[1].toLowerCase() },
        };
        if (!isOptional) required.push(propName);
        i++;
        continue;
      }

      const scalarMatch = typeStr.match(/^(string|integer|number|boolean)$/i);
      if (scalarMatch) {
        const scalarType = scalarMatch[1].toLowerCase();
        properties[propName] = arraySuffix
          ? { type: 'array', items: { type: scalarType } }
          : { type: scalarType };
        if (!isOptional) required.push(propName);
      }

      i++;
    }

    return { properties, required, nextIndex: i };
  }

  const root = parseBlock(0, schemaLines[0]?.indent ?? 2);
  if (Object.keys(root.properties).length === 0) return undefined;

  return {
    type: 'object',
    properties: root.properties,
    required: root.required,
  };
}

/**
 * Parses a stage contract Markdown file from `./prompts/<name>.md` (YAML frontmatter + Handlebars template)
 * without requiring any external framework dependencies.
 */
export function loadStagePromptContract(
  promptName: string,
  promptDir: string = './prompts'
): StagePromptContract {
  const filePath = path.resolve(promptDir, `${promptName}.md`);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Stage contract not found at: ${filePath}`);
  }

  const raw = fs.readFileSync(filePath, 'utf-8');
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) {
    return {
      name: promptName,
      model: GEMINI_4_ARGON_MODEL,
      maxOutputTokens: 32768,
      thinkingLevel: 'MEDIUM',
      includeThoughts: true,
      useGoogleSearch: false,
      outputFormat: 'text',
      template: raw.trim(),
    };
  }

  const frontmatter = match[1];
  const template = match[2].trim();

  const modelMatch = frontmatter.match(/^\s*model:\s*([^\r\n#]+)/m);
  const rawModel = modelMatch?.[1]
    ?.trim()
    .replace(/^['"]|['"]$/g, '')
    .replace(/^googleai\//i, '');

  const maxTokensMatch = frontmatter.match(/maxOutputTokens:\s*(\d+)/);
  const maxOutputTokens = maxTokensMatch ? parseInt(maxTokensMatch[1], 10) : 32768;

  const thinkingMatch = frontmatter.match(/thinkingLevel:\s*(LOW|MEDIUM|HIGH)/i);
  const thinkingLevel = normalizeThinkingLevel(thinkingMatch?.[1], 'MEDIUM');

  const includeThoughtsMatch = frontmatter.match(/includeThoughts:\s*(true|false)/i);
  const includeThoughts = includeThoughtsMatch
    ? includeThoughtsMatch[1].toLowerCase() === 'true'
    : true;

  const useGoogleSearch = /googleSearch|google_search/i.test(frontmatter);

  const formatMatch = frontmatter.match(
    /(?:output:\s*[\r\n]+(?:[ \t]+[^\r\n]+\r?\n)*?[ \t]+format:\s*|(?:^|\r?\n)\s*format:\s*)(json|text|image|audio)\b/i
  );
  const rawFormat = formatMatch?.[1]?.toLowerCase();
  const outputFormat: 'text' | 'json' | 'image' | 'audio' =
    rawFormat === 'json' || rawFormat === 'image' || rawFormat === 'audio' ? rawFormat : 'text';

  const resolvedModel =
    rawModel ||
    (outputFormat === 'image'
      ? GEMINI_NANO_BANANA_MODEL
      : outputFormat === 'audio'
        ? GEMINI_FLASH_TTS_MODEL
        : GEMINI_4_ARGON_MODEL);

  const aspectRatioMatch = frontmatter.match(/^\s*(?:aspectRatio|aspect_ratio):\s*([^\r\n#]+)/im);
  const aspectRatio = aspectRatioMatch?.[1]?.trim().replace(/^['"]|['"]$/g, '');

  const imageSizeMatch = frontmatter.match(/^\s*(?:imageSize|image_size):\s*([^\r\n#]+)/im);
  const imageSize = imageSizeMatch?.[1]?.trim().replace(/^['"]|['"]$/g, '');

  const voiceMatch = frontmatter.match(/^\s*(?:voiceName|voice_name|voice):\s*([^\r\n#]+)/im);
  const rawVoice = voiceMatch?.[1]?.trim().replace(/^['"]|['"]$/g, '');

  const extractFmString = (pattern: RegExp): string | undefined => {
    const m = frontmatter.match(pattern);
    const v = m?.[1]?.trim().replace(/^['"]|['"]$/g, '');
    return v || undefined;
  };
  const primarySpeaker = extractFmString(/^\s*(?:primarySpeaker|primary_speaker):\s*([^\r\n#]+)/im);
  const primaryVoice = extractFmString(/^\s*(?:primaryVoice|primary_voice):\s*([^\r\n#]+)/im);
  const primaryStyle = extractFmString(/^\s*(?:primaryStyle|primary_style):\s*([^\r\n#]+)/im);
  const primaryRole = extractFmString(/^\s*(?:primaryRole|primary_role):\s*([^\r\n#]+)/im);
  const primaryVoiceDesignPrompt = extractFmString(
    /^\s*(?:primaryVoiceDesignPrompt|primary_voice_design_prompt):\s*([^\r\n#]+)/im
  );
  const secondarySpeaker = extractFmString(
    /^\s*(?:secondarySpeaker|secondary_speaker):\s*([^\r\n#]+)/im
  );
  const secondaryVoice = extractFmString(/^\s*(?:secondaryVoice|secondary_voice):\s*([^\r\n#]+)/im);
  const secondaryStyle = extractFmString(/^\s*(?:secondaryStyle|secondary_style):\s*([^\r\n#]+)/im);
  const secondaryRole = extractFmString(/^\s*(?:secondaryRole|secondary_role):\s*([^\r\n#]+)/im);
  const secondaryVoiceDesignPrompt = extractFmString(
    /^\s*(?:secondaryVoiceDesignPrompt|secondary_voice_design_prompt):\s*([^\r\n#]+)/im
  );
  const rawDialogueMode = extractFmString(
    /^\s*(?:dialogueMode|dialogue_mode|turnRouting|turn_routing):\s*([^\r\n#]+)/im
  );
  const dialogueMode: 'semantic' | 'alternating' | undefined = rawDialogueMode
    ? /^alternat/i.test(rawDialogueMode)
      ? 'alternating'
      : 'semantic'
    : undefined;
  const voiceDesignPrompt = extractFmString(
    /^\s*(?:voiceDesignPrompt|voice_design_prompt|voiceProfile|voice_profile):\s*([^\r\n#]+)/im
  );
  const languageCode = extractFmString(
    /^\s*(?:languageCode|language_code|speechLanguage|speech_language|language):\s*([^\r\n#]+)/im
  );
  const voiceLockMatch = frontmatter.match(/^\s*(?:voiceLock|voice_lock):\s*(true|false)\b/im);
  const voiceLock = voiceLockMatch
    ? voiceLockMatch[1].toLowerCase() === 'true'
    : undefined;
  const voice = rawVoice || primaryVoice;

  const audioMimeMatch = frontmatter.match(
    /^\s*(?:audioMimeType|audio_mime_type):\s*([^\r\n#]+)/im
  );
  const genericMimeMatch =
    outputFormat === 'audio'
      ? frontmatter.match(/^\s*(?:mimeType|mime_type):\s*([^\r\n#]+)/im)
      : null;
  const audioMimeType = (audioMimeMatch?.[1] || genericMimeMatch?.[1])
    ?.trim()
    .replace(/^['"]|['"]$/g, '');

  const sampleRateMatch = frontmatter.match(/^\s*(?:sampleRate|sample_rate):\s*(\d+)/im);
  const sampleRate = sampleRateMatch ? parseInt(sampleRateMatch[1], 10) : undefined;

  let outputJsonSchema: Record<string, any> | undefined;
  if (outputFormat === 'json') {
    const outputBlockMatch = frontmatter.match(/output:\s*[\r\n]+([\s\S]*)$/);
    if (outputBlockMatch) {
      outputJsonSchema = parseFrontmatterOutputSchema(outputBlockMatch[1]);
    }
  }

  return {
    name: promptName,
    model: resolvedModel,
    maxOutputTokens,
    thinkingLevel,
    includeThoughts,
    useGoogleSearch,
    outputFormat,
    outputJsonSchema,
    ...(aspectRatio ? { aspectRatio } : {}),
    ...(imageSize ? { imageSize } : {}),
    ...(voice ? { voice } : {}),
    ...(languageCode ? { languageCode } : {}),
    ...(voiceLock !== undefined ? { voiceLock } : {}),
    ...(voiceDesignPrompt ? { voiceDesignPrompt } : {}),
    ...(dialogueMode ? { dialogueMode } : {}),
    ...(primarySpeaker ? { primarySpeaker } : {}),
    ...(primaryVoice ? { primaryVoice } : {}),
    ...(primaryStyle ? { primaryStyle } : {}),
    ...(primaryRole ? { primaryRole } : {}),
    ...(primaryVoiceDesignPrompt ? { primaryVoiceDesignPrompt } : {}),
    ...(secondarySpeaker ? { secondarySpeaker } : {}),
    ...(secondaryVoice ? { secondaryVoice } : {}),
    ...(secondaryStyle ? { secondaryStyle } : {}),
    ...(secondaryRole ? { secondaryRole } : {}),
    ...(secondaryVoiceDesignPrompt ? { secondaryVoiceDesignPrompt } : {}),
    ...(audioMimeType ? { audioMimeType } : {}),
    ...(sampleRate ? { sampleRate } : {}),
    template,
  };
}

/**
 * Renders Handlebars-style `{{#if key}}...{{/if}}` and `{{key}}` placeholders in a stage prompt template
 * in a single non-recursive pass so literal `{{...}}` strings inside variable values are never re-expanded.
 */
export function renderPromptTemplate(
  template: string,
  variables: Record<string, string | undefined>
): string {
  const rendered = template.replace(
    /\{\{#if\s+([a-zA-Z0-9_]+)\}\}\r?\n?([\s\S]*?)\{\{\/if\}\}\r?\n?|\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g,
    (_full, ifVar?: string, inner?: string, bareVar?: string) => {
      if (ifVar !== undefined) {
        const val = variables[ifVar];
        if (val && val.trim() !== '') {
          return (inner ?? '').replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_m, k: string) => {
            return variables[k] ?? '';
          });
        }
        return '';
      }
      if (bareVar !== undefined) {
        return variables[bareVar] ?? '';
      }
      return '';
    }
  );

  return rendered.trim();
}
