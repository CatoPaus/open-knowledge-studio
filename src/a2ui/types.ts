// ============================================================================
// 3.9 A2UI v1.0 Catalog + Surface Compiler & Bi-Directional Studio Renderer
// ============================================================================

export const A2UI_PROTOCOL_VERSION = '1.0';
export const A2UI_MIME_TYPE = 'application/a2ui+json';
export const A2UI_BASIC_CATALOG_ID =
  'https://a2ui.org/specification/v1_0/catalogs/basic/catalog.json';
export const A2UI_ICM_CATALOG_ID =
  'https://a2ui.org/specification/v1_0/catalogs/icm-okf-v0.3/catalog.json';

export interface A2uiDataBinding {
  '@path': string;
}

export interface A2uiFunctionCall {
  '@call': string;
  catalogId?: string;
  args?: Record<string, unknown>;
}

export type A2uiDynamicValue<T = unknown> =
  | T
  | A2uiDataBinding
  | A2uiFunctionCall;

export type A2uiChildList = string[] | { path: string; componentId: string };

export interface A2uiCheckRule {
  condition: A2uiDataBinding | A2uiFunctionCall;
  message?: string;
}

export interface A2uiComponent {
  id: string;
  component: string;
  '@catalogId'?: string;
  weight?: number;
  '@accessibility'?: {
    label?: A2uiDynamicValue<string>;
    description?: A2uiDynamicValue<string>;
    live?: 'off' | 'polite' | 'assertive';
    hidden?: A2uiDynamicValue<boolean>;
  };
  '@checks'?: A2uiCheckRule[];
  '@metadata'?: {
    extensions?: Record<string, unknown>;
  };
  [key: string]: unknown;
}

export interface A2uiCreateSurfaceMessage {
  version: typeof A2UI_PROTOCOL_VERSION;
  createSurface: {
    surfaceId: string;
    catalogId?: string;
    sendDataModel?: boolean;
    components?: A2uiComponent[];
    dataModel?: Record<string, unknown>;
    metadata?: {
      extensions?: Record<string, unknown>;
    };
  };
}

export interface A2uiUpdateComponentsMessage {
  version: typeof A2UI_PROTOCOL_VERSION;
  updateComponents: {
    surfaceId: string;
    components: A2uiComponent[];
  };
}

export interface A2uiUpdateDataModelMessage {
  version: typeof A2UI_PROTOCOL_VERSION;
  updateDataModel: {
    surfaceId: string;
    path?: string;
    value: unknown;
  };
}

export interface A2uiDeleteSurfaceMessage {
  version: typeof A2UI_PROTOCOL_VERSION;
  deleteSurface: {
    surfaceId: string;
  };
}

export interface A2uiCallRendererFunctionMessage {
  version: typeof A2UI_PROTOCOL_VERSION;
  callRendererFunction: {
    surfaceId: string;
    functionCallId: string;
    callFunction: A2uiFunctionCall;
  };
}

export interface A2uiAgentFunctionResponseMessage {
  version: typeof A2UI_PROTOCOL_VERSION;
  agentFunctionResponse: {
    functionCallId: string;
    value?: unknown;
    error?: { code: string; message: string };
  };
}

export type A2uiEnvelopeMessage =
  | A2uiCreateSurfaceMessage
  | A2uiUpdateComponentsMessage
  | A2uiUpdateDataModelMessage
  | A2uiDeleteSurfaceMessage
  | A2uiCallRendererFunctionMessage
  | A2uiAgentFunctionResponseMessage;

export interface A2uiChecklistItem {
  id: string;
  label: string;
  checked: boolean;
  category?: string;
}

export interface A2uiChecklistGroup {
  id: string;
  title: string;
  items: A2uiChecklistItem[];
}

export interface A2uiSurfaceGenerationOptions {
  workspaceRoot?: string;
  bundleRoot?: string;
  runId?: string;
  surfaceId?: string;
  outputHtmlPath?: string;
  mirrorBundleHtml?: boolean;
  outputDir?: string;
  artifactDir?: string;
  openBrowser?: boolean;
  enablePingPong?: boolean;
}

export interface A2uiBundleRunEntry {
  runId: string;
  conceptId: string;
  title: string;
  shortLabel: string;
  isStage1Only?: boolean;
  status: string;
  trustTier: string;
  isStale: boolean;
  sourcesCount: number;
  checklistCount: number;
  checklistItemCount: number;
  moduleCount: number;
  caseCount: number;
  quizCount: number;
  tabTitles: Record<string, string>;
  tabs?: Array<{ title: string; child: string }>;
  dataModel: Record<string, any>;
}

export interface A2uiSurfaceGenerationResult {
  runId: string;
  surfaceId: string;
  catalogId: string;
  isStage1Only?: boolean;
  componentCount: number;
  tabCount: number;
  checklistItemCount: number;
  moduleCount: number;
  quizCount: number;
  caseCount: number;
  conceptCount: number;
  surfaceJsonPath: string;
  surfaceJsonlPath: string;
  htmlOutputPath: string;
  bundleHtmlPath?: string;
  bundleVizPath?: string;
  artifactHtmlPath?: string;
  artifactVizPath?: string;
  browserOpened?: boolean;
  messages: A2uiEnvelopeMessage[];
  bundleRuns?: A2uiBundleRunEntry[];
}
