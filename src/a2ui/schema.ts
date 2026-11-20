import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

import { A2UI_BASIC_CATALOG_ID, A2UI_ICM_CATALOG_ID, A2UI_PROTOCOL_VERSION, type A2uiComponent, type A2uiEnvelopeMessage } from './types.js';
import { A2UI_ICM_CATALOG_SCHEMA } from './catalog-schema.js';

function cloneJsonValue<T>(val: T): T {
  if (val === null || val === undefined || typeof val !== 'object') {
    return val;
  }
  if (typeof globalThis.structuredClone === 'function') {
    try {
      return globalThis.structuredClone(val);
    } catch {
      // Fallback to JSON deep clone
    }
  }
  return JSON.parse(JSON.stringify(val));
}

/**
 * Updates an RFC 6901 JSON Pointer path (`/a/b/0`) on a root data model object in-place.
 * Deep-clones assigned object/array values so mutating the live surface data model never
 * mutates historical `updateDataModel` message envelopes by reference aliasing.
 * Follows A2UI v1.0 upsert & delete semantics:
 * - If pointer is omitted or `'/'`, replaces the entire root data model in-place.
 * - If `value === null` or `value === undefined`, deletes the key on objects (or sets index to `undefined` on arrays, preserving length).
 */
export function setJsonPointer(rootModel: Record<string, any>, pointer: string, value: unknown): void {
  if (!pointer || pointer === '/') {
    for (const k of Object.keys(rootModel)) {
      delete rootModel[k];
    }
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(rootModel, cloneJsonValue(value));
    }
    return;
  }
  const cleanPointer = pointer.startsWith('/') ? pointer.slice(1) : pointer;
  const segments = cleanPointer.split('/').map((s) => s.replace(/~1/g, '/').replace(/~0/g, '~'));
  let current: any = rootModel;
  for (let i = 0; i < segments.length - 1; i++) {
    const seg = segments[i];
    const nextSeg = segments[i + 1];
    if (current[seg] === undefined || current[seg] === null || typeof current[seg] !== 'object') {
      current[seg] = /^\d+$/.test(nextSeg) ? [] : {};
    }
    current = current[seg];
  }
  const lastSeg = segments[segments.length - 1];
  if (value === undefined || value === null) {
    if (Array.isArray(current) && /^\d+$/.test(lastSeg)) {
      current[Number(lastSeg)] = undefined;
    } else if (current && typeof current === 'object') {
      delete current[lastSeg];
    }
  } else {
    current[lastSeg] = cloneJsonValue(value);
  }
}

/**
 * Enforces the A2UI v1.0 Basic Catalog media URL scheme allowlist:
 * permits `http:`, `https:`, `data:`, and relative URLs, while rejecting
 * arbitrary/unsafe schemes such as `tts:`, `javascript:`, `vbscript:`, or `file:`.
 */
export function isAllowedA2uiMediaUrl(rawUrl: string): boolean {
  const trimmed = String(rawUrl || '').trim();
  if (!trimmed) return false;
  if (/^(?:https?:|data:)/i.test(trimmed)) return true;
  if (trimmed.startsWith('//')) return false;
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)) return false;
  return true;
}

let cachedCatalogReqs: Map<
  string,
  { catalogId: string; required: string[] }
> | null = null;

/**
 * Loads and indexes Tier 1 (`specification/v1_0/catalogs/basic/catalog.json`) and
 * Tier 2 (`specification/v1_0/catalogs/icm-okf-v0.3/catalog.json`) A2UI v1.0 component schemas.
 */
export function loadA2uiCatalogComponentRequirements(): Map<
  string,
  { catalogId: string; required: string[] }
> {
  if (cachedCatalogReqs) return cachedCatalogReqs;
  const map = new Map<string, { catalogId: string; required: string[] }>();
  const specRootCandidates = [
    path.resolve(process.cwd(), 'specification', 'v1_0', 'catalogs'),
    fileURLToPath(new URL('../../specification/v1_0/catalogs', import.meta.url)),
  ];
  const specCatalogDir = specRootCandidates.find((d) => fs.existsSync(d));

  const parseCatalogFile = (filePath: string, fallbackCatalogId: string) => {
    if (!fs.existsSync(filePath)) return;
    try {
      const parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      const catalogId = String(parsed?.catalogId || fallbackCatalogId);
      const comps = parsed?.components;
      if (!comps || typeof comps !== 'object') return;
      for (const [compName, compDef] of Object.entries<any>(comps)) {
        const reqSet = new Set<string>(['id', 'component']);
        const branches = Array.isArray(compDef?.allOf) ? compDef.allOf : [compDef];
        for (const b of branches) {
          if (Array.isArray(b?.required)) {
            for (const r of b.required) reqSet.add(String(r));
          }
        }
        map.set(compName, {
          catalogId,
          required: Array.from(reqSet),
        });
      }
    } catch {
      // Fallback handled below
    }
  };

  if (specCatalogDir) {
    parseCatalogFile(path.join(specCatalogDir, 'basic', 'catalog.json'), A2UI_BASIC_CATALOG_ID);
    parseCatalogFile(
      path.join(specCatalogDir, 'icm-okf-v0.3', 'catalog.json'),
      A2UI_ICM_CATALOG_ID
    );
  }

  // Ensure fallback entries if run outside repo root
  for (const t1 of A2UI_ICM_CATALOG_SCHEMA.tier1BasicComponents) {
    if (!map.has(t1)) {
      map.set(t1, {
        catalogId: A2UI_BASIC_CATALOG_ID,
        required: ['id', 'component'],
      });
    }
  }
  for (const t2Name of Object.keys(A2UI_ICM_CATALOG_SCHEMA.tier2DomainComponents)) {
    if (!map.has(t2Name)) {
      map.set(t2Name, {
        catalogId: A2UI_ICM_CATALOG_ID,
        required: ['id', 'component'],
      });
    }
  }

  cachedCatalogReqs = map;
  return map;
}

/**
 * Validates an array of A2UI v1.0 agent-to-renderer messages for protocol structural integrity:
 * - Envelope `version === "1.0"`
 * - Exactly one of `createSurface`, `updateComponents`, `updateDataModel`, `deleteSurface`,
 *   `callRendererFunction`, or `agentFunctionResponse` per message
 * - `createSurface` allows only v1.0 properties (`surfaceId`, `catalogId`, `sendDataModel`,
 *   `components`, `dataModel`, `metadata` — rejects removed v0.9 `theme`)
 * - `updateDataModel` requires `value` (`null` deletes)
 * - Multi-catalog `@catalogId` resolution: components belonging to a catalog other than the surface's
 *   default `catalogId` must explicitly declare `@catalogId`
 * - `@`-prefixed directives (`@path`, `@call`, `@accessibility`, `@checks`) enforced over legacy v0.9 keys
 * - Basic `Text` enforces `variant: "body" | "caption"` (headings use Markdown `# `..`##### `),
 *   and literal media URLs pass `isAllowedA2uiMediaUrl()`.
 */
export function validateA2uiSurfaceMessages(messages: A2uiEnvelopeMessage[]): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  const createdSurfaces = new Map<string, { defaultCatalogId: string }>();
  const catalogReqs = loadA2uiCatalogComponentRequirements();
  const allowedCreateSurfaceKeys = new Set([
    'surfaceId',
    'catalogId',
    'sendDataModel',
    'components',
    'dataModel',
    'metadata',
  ]);
  const envelopeActionKeys = [
    'createSurface',
    'updateComponents',
    'updateDataModel',
    'deleteSurface',
    'callRendererFunction',
    'agentFunctionResponse',
  ];

  const inspectLegacyDynamicObject = (
    compId: string,
    propPath: string,
    val: unknown
  ): void => {
    if (!val || typeof val !== 'object') return;
    if (Array.isArray(val)) {
      val.forEach((item, idx) => inspectLegacyDynamicObject(compId, `${propPath}[${idx}]`, item));
      return;
    }
    const obj = val as Record<string, unknown>;
    const keys = Object.keys(obj);
    if (keys.length === 1 && typeof obj.path === 'string') {
      errors.push(
        `Component "${compId}" property "${propPath}" uses legacy "{ path }" binding; use "{ \\"@path\\": ... }" in A2UI v1.0`
      );
      return;
    }
    if ('call' in obj && typeof obj.call === 'string' && !('@call' in obj)) {
      errors.push(
        `Component "${compId}" property "${propPath}" uses legacy "{ call }" function invocation; use "{ \\"@call\\": ... }" in A2UI v1.0`
      );
      return;
    }
    for (const [k, v] of Object.entries(obj)) {
      inspectLegacyDynamicObject(compId, `${propPath}.${k}`, v);
    }
  };

  const validateComponentArray = (
    msgIdx: number,
    surfaceId: string,
    defaultCatalogId: string,
    components: A2uiComponent[]
  ): void => {
    if (!Array.isArray(components) || components.length === 0) {
      errors.push(`Message[${msgIdx}] components for surface "${surfaceId}" must be a non-empty array`);
      return;
    }

    const byId = new Map<string, A2uiComponent>();
    for (const comp of components) {
      if (!comp.id || typeof comp.id !== 'string') {
        errors.push(`Component missing string id`);
        continue;
      }
      if ('accessibility' in comp) {
        errors.push(
          `Component "${comp.id}" uses legacy "accessibility" property; use "@accessibility" in A2UI v1.0`
        );
      }
      if ('checks' in comp) {
        errors.push(
          `Component "${comp.id}" uses legacy "checks" property; use "@checks" in A2UI v1.0`
        );
      }

      const effectiveCatalogId =
        typeof comp['@catalogId'] === 'string' && comp['@catalogId'].trim()
          ? comp['@catalogId'].trim()
          : defaultCatalogId;

      if (!comp.component || typeof comp.component !== 'string') {
        errors.push(`Component "${comp.id}" missing component type name`);
      } else {
        const schemaEntry = catalogReqs.get(comp.component);
        if (!schemaEntry) {
          errors.push(
            `Component "${comp.id}" uses unknown component type "${comp.component}" not present in Basic or ICM/OKF catalog`
          );
        } else {
          if (effectiveCatalogId !== schemaEntry.catalogId) {
            errors.push(
              `Component "${comp.id}" (${comp.component}) belongs to catalog "${schemaEntry.catalogId}", but resolved catalog is "${effectiveCatalogId}" (set "@catalogId": "${schemaEntry.catalogId}")`
            );
          }
          for (const reqProp of schemaEntry.required) {
            if (!(reqProp in comp) || comp[reqProp] === undefined) {
              errors.push(
                `Component "${comp.id}" (${comp.component}) missing required catalog property "${reqProp}"`
              );
            }
          }
        }
      }

      if (effectiveCatalogId === A2UI_BASIC_CATALOG_ID && comp.component === 'Text') {
        if ('markdown' in comp) {
          errors.push(
            `Component "${comp.id}" (Basic Text) must not specify non-standard "markdown" property in A2UI v1.0`
          );
        }
        if (
          typeof comp.variant === 'string' &&
          comp.variant !== 'body' &&
          comp.variant !== 'caption'
        ) {
          errors.push(
            `Component "${comp.id}" (Basic Text) has invalid variant "${comp.variant}"; A2UI v1.0 Basic Text allows only "body" | "caption" (use Markdown "# ".."##### " inside text for headings)`
          );
        }
      }

      if (
        comp.component === 'Image' ||
        comp.component === 'Video' ||
        comp.component === 'AudioPlayer'
      ) {
        if (typeof comp.url === 'string' && !isAllowedA2uiMediaUrl(comp.url)) {
          errors.push(
            `Component "${comp.id}" (${comp.component}) has disallowed media URL scheme "${comp.url}"`
          );
        }
        if (typeof comp.posterUrl === 'string' && !isAllowedA2uiMediaUrl(comp.posterUrl)) {
          errors.push(
            `Component "${comp.id}" (${comp.component}) has disallowed posterUrl scheme "${comp.posterUrl}"`
          );
        }
      } else if (comp.component === 'SpeechPlayer') {
        if (
          typeof comp.audioUrl === 'string' &&
          comp.audioUrl.trim().length > 0 &&
          !isAllowedA2uiMediaUrl(comp.audioUrl)
        ) {
          errors.push(
            `Component "${comp.id}" (SpeechPlayer) has disallowed audioUrl scheme "${comp.audioUrl}"`
          );
        }
      }

      for (const [propKey, propVal] of Object.entries(comp)) {
        if (
          propKey === 'id' ||
          propKey === 'component' ||
          propKey === '@catalogId' ||
          propKey === 'children'
        ) {
          continue;
        }
        inspectLegacyDynamicObject(comp.id, propKey, propVal);
      }

      if (byId.has(comp.id)) {
        errors.push(`Duplicate component id "${comp.id}" in surface "${surfaceId}"`);
      }
      byId.set(comp.id, comp);
    }

    if (!byId.has('root')) {
      errors.push(`Surface "${surfaceId}" is missing required component with id="root"`);
    }

    // Check child references & cycle detection
    const getChildIds = (comp: A2uiComponent): string[] => {
      const refs: string[] = [];
      if (typeof comp.child === 'string') refs.push(comp.child);
      if (typeof comp.trigger === 'string') refs.push(comp.trigger);
      if (typeof comp.content === 'string') refs.push(comp.content);
      if (Array.isArray(comp.children)) {
        for (const c of comp.children) {
          if (typeof c === 'string') refs.push(c);
        }
      } else if (
        comp.children &&
        typeof comp.children === 'object' &&
        typeof (comp.children as any).componentId === 'string'
      ) {
        refs.push((comp.children as any).componentId);
      }
      if (Array.isArray(comp.tabs)) {
        for (const tab of comp.tabs as any[]) {
          if (tab && typeof tab.child === 'string') refs.push(tab.child);
        }
      }
      return refs;
    };

    for (const [id, comp] of byId.entries()) {
      for (const childId of getChildIds(comp)) {
        if (!byId.has(childId)) {
          errors.push(`Component "${id}" references non-existent child component "${childId}"`);
        }
      }
    }

    const visiting = new Set<string>();
    const visited = new Set<string>();
    const dfs = (nodeId: string) => {
      if (visiting.has(nodeId)) {
        errors.push(`Circular component reference detected involving "${nodeId}"`);
        return;
      }
      if (visited.has(nodeId)) return;
      visiting.add(nodeId);
      const comp = byId.get(nodeId);
      if (comp) {
        for (const childId of getChildIds(comp)) {
          if (byId.has(childId)) dfs(childId);
        }
      }
      visiting.delete(nodeId);
      visited.add(nodeId);
    };
    if (byId.has('root')) {
      dfs('root');
    }
  };

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    if (!msg || typeof msg !== 'object') {
      errors.push(`Message[${i}] is not an object`);
      continue;
    }
    if (msg.version !== A2UI_PROTOCOL_VERSION) {
      errors.push(
        `Message[${i}] has invalid version "${(msg as any).version}", expected "${A2UI_PROTOCOL_VERSION}"`
      );
    }

    const msgKeys = envelopeActionKeys.filter((k) => k in msg);
    if (msgKeys.length !== 1) {
      errors.push(
        `Message[${i}] must contain exactly one envelope action (${envelopeActionKeys.join(' | ')}), found ${msgKeys.length}`
      );
      continue;
    }

    if ('createSurface' in msg) {
      const cs = msg.createSurface as Record<string, unknown>;
      const surfaceId = typeof cs?.surfaceId === 'string' ? cs.surfaceId : '';
      const defaultCatalogId =
        typeof cs?.catalogId === 'string' && cs.catalogId.trim()
          ? cs.catalogId.trim()
          : A2UI_BASIC_CATALOG_ID;
      if (!surfaceId) errors.push(`Message[${i}] createSurface missing surfaceId`);
      for (const key of Object.keys(cs || {})) {
        if (!allowedCreateSurfaceKeys.has(key)) {
          errors.push(
            `Message[${i}] createSurface contains unsupported A2UI v1.0 property "${key}"`
          );
        }
      }
      if (surfaceId && createdSurfaces.has(surfaceId)) {
        errors.push(
          `Message[${i}] duplicate createSurface for active surface "${surfaceId}" without prior deleteSurface`
        );
      }
      if (surfaceId) {
        createdSurfaces.set(surfaceId, { defaultCatalogId });
      }
      if (cs?.components !== undefined) {
        validateComponentArray(
          i,
          surfaceId || 'unknown',
          defaultCatalogId,
          cs.components as A2uiComponent[]
        );
      }
    } else if ('updateDataModel' in msg) {
      const udm = msg.updateDataModel as Record<string, unknown>;
      const surfaceId = typeof udm?.surfaceId === 'string' ? udm.surfaceId : '';
      if (!surfaceId) {
        errors.push(`Message[${i}] updateDataModel missing surfaceId`);
      } else if (!createdSurfaces.has(surfaceId)) {
        errors.push(`Message[${i}] updateDataModel references uncreated surface "${surfaceId}"`);
      }
      if (!udm || !('value' in udm) || udm.value === undefined) {
        errors.push(
          `Message[${i}] updateDataModel missing required "value" property (pass null to delete in A2UI v1.0)`
        );
      }
    } else if ('deleteSurface' in msg) {
      const { surfaceId } = msg.deleteSurface;
      if (!surfaceId) {
        errors.push(`Message[${i}] deleteSurface missing surfaceId`);
      } else if (!createdSurfaces.has(surfaceId)) {
        errors.push(`Message[${i}] deleteSurface references uncreated surface "${surfaceId}"`);
      } else {
        createdSurfaces.delete(surfaceId);
      }
    } else if ('callRendererFunction' in msg) {
      const crf = msg.callRendererFunction;
      if (!crf?.surfaceId) {
        errors.push(`Message[${i}] callRendererFunction missing surfaceId`);
      } else if (!createdSurfaces.has(crf.surfaceId)) {
        errors.push(
          `Message[${i}] callRendererFunction references uncreated surface "${crf.surfaceId}"`
        );
      }
      if (!crf?.functionCallId) {
        errors.push(`Message[${i}] callRendererFunction missing functionCallId`);
      }
      if (!crf?.callFunction || typeof crf.callFunction['@call'] !== 'string') {
        errors.push(`Message[${i}] callRendererFunction missing callFunction["@call"]`);
      }
    } else if ('agentFunctionResponse' in msg) {
      const afr = msg.agentFunctionResponse;
      if (!afr?.functionCallId) {
        errors.push(`Message[${i}] agentFunctionResponse missing functionCallId`);
      }
      if (afr && !('value' in afr) && !('error' in afr)) {
        errors.push(`Message[${i}] agentFunctionResponse must include "value" or "error"`);
      }
    } else if ('updateComponents' in msg) {
      const { surfaceId, components } = msg.updateComponents;
      const surfaceState = createdSurfaces.get(surfaceId);
      if (!surfaceState) {
        errors.push(`Message[${i}] updateComponents references uncreated surface "${surfaceId}"`);
      }
      validateComponentArray(
        i,
        surfaceId,
        surfaceState?.defaultCatalogId || A2UI_BASIC_CATALOG_ID,
        components
      );
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
