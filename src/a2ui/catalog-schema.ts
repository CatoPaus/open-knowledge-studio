import { A2UI_BASIC_CATALOG_ID, A2UI_ICM_CATALOG_ID, A2UI_PROTOCOL_VERSION } from './types.js';

/**
 * Two-Tier A2UI v1.0 Catalog Descriptor combining Tier 1 (A2UI v1.0 Basic Catalog Primitives)
 * and Tier 2 (ICM + OKF v0.3 Domain Custom Components mixed via `@catalogId`).
 */
export const A2UI_ICM_CATALOG_SCHEMA = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: A2UI_ICM_CATALOG_ID,
  catalogId: A2UI_ICM_CATALOG_ID,
  basicCatalogId: A2UI_BASIC_CATALOG_ID,
  protocolVersion: A2UI_PROTOCOL_VERSION,
  title: 'ICM + OKF v0.3 Two-Tier A2UI v1.0 Component Catalog',
  tier1BasicComponents: [
    'Text',
    'Image',
    'Icon',
    'Video',
    'AudioPlayer',
    'Row',
    'Column',
    'List',
    'Card',
    'Tabs',
    'Divider',
    'Modal',
    'Button',
    'CheckBox',
    'TextField',
    'DateTimeInput',
    'ChoicePicker',
    'Slider',
  ],
  tier2DomainComponents: {
    Badge: {
      description:
        'Renders a semantic status pill badge (e.g. status: stable, trust: human-reviewed, fresh).',
      properties: ['text', 'tone'],
    },
    SpeechPlayer: {
      description:
        'Synthesizes spoken narration via Web Speech API with automatic BCP-47 voice binding (nb-NO/no-NO/en-US) or plays an optional pre-rendered Stage 4 audio URL.',
      properties: ['ttsText', 'description', 'audioUrl', 'voicesLabel'],
    },
    OkfMarkdown: {
      description:
        'Renders OKF v0.3 Markdown with clickable [^id] footnotes, MIME-type (mime_type), retrieved_at & last_modified source badges, middle-ellipsis source URLs, 1-click MIME/review source filtering, trust-tier & staleness headers, Layer 4 raw Markdown editor, and internal /research/*.md concept navigation.',
      properties: [
        'title',
        'body',
        'frontmatter',
        'sources',
        'trustTier',
        'isStale',
        'editablePath',
        'rejectedSourcesPath',
        'replacedSourcesPath',
        'addedSourcesPath',
        'verifierActorPath',
      ],
    },
    OkfKnowledgeGraph: {
      description:
        'Embeds the interactive Cytoscape.js OKF Knowledge Graph (viz.html engine) directly inside an A2UI tab.',
      properties: ['title', 'bundlePath'],
    },
    InteractiveChecklist: {
      description:
        'Renders extracted Markdown checklists (- [ ] ...) with nested category headers, [^id]/LaTeX stripping, and reactive CheckBox completion progress bound two-way to the A2UI data model.',
      properties: ['title', 'subtitle', 'groupsPath'],
    },
    ModuleCarousel: {
      description:
        'Renders Stage 2 trainingModules, lessons, modules, pillars, or slides with step-by-step navigation, optional Stage 3 16:9 illustrations (imageUrl), regulatory/concept metadata, slide cues, action items, and SpeechPlayer narration (Stage 4 studio audioUrl or Web Speech API fallback).',
      properties: ['title', 'modulesPath', 'activeIndexPath'],
    },
    QuizRunner: {
      description:
        'Interactive assessment runner bound to Stage 2 quiz items or lesson quiz questions with ChoicePicker selection, explanation feedback, and live score calculation.',
      properties: ['title', 'questionsPath', 'answersPath'],
    },
    CaseSimulator: {
      description:
        'Interactive scenario & board action simulator bound to Stage 2 cases or trainingModule action items with editable response notes and model resolution reveal.',
      properties: ['title', 'casesPath', 'responsesPath'],
    },
    FlowDiagram: {
      description:
        'Renders a zero-CDN responsive A2UI card-and-SVG flowchart or hierarchy diagram from structured { nodes, edges } data or Mermaid flowchart syntax.',
      properties: ['title', 'direction', 'nodes', 'edges', 'mermaid', 'diagram'],
    },
  },
} as const;

export function escapeA2uiHtml(str: string): string {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
