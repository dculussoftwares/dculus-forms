import { slugify } from '@dculus/utils';

/**
 * Bound-field helpers for the PDF template designer.
 *
 * A "bound field" is a pdfme text element that displays the form field's
 * label on the canvas (content) while carrying the actual binding in the
 * custom `dculusFieldId` property — pdfme's schema zod object is
 * `.passthrough()`, so the prop survives checkTemplate() and Designer
 * round-trips. Generation resolves the value from `dculusFieldId`;
 * `content` is purely presentational. Legacy `{{fieldId}}` text elements
 * are still substituted by content on the backend.
 */

export const DCULUS_FIELD_ID_KEY = 'dculusFieldId';

export interface FormFieldEntry {
  id: string;
  label: string;
  type: string;
}

const MAX_LABEL_CHARS = 30;
const MIN_WIDTH_MM = 40;
const MAX_WIDTH_MM = 120;
// Rough average glyph width at fontSize 12 — only used to pick a sensible
// initial box width; users resize freely afterwards
const CHAR_WIDTH_MM = 2.4;
const FIELD_FONT_SIZE = 12;
const FIELD_HEIGHT_MM = 10;

export function displayLabel(label: string, untitledFallback: string): string {
  const trimmed = (label ?? '').trim();
  if (!trimmed) return untitledFallback;
  return trimmed.length > MAX_LABEL_CHARS
    ? `${trimmed.slice(0, MAX_LABEL_CHARS).trimEnd()}…`
    : trimmed;
}

export function collectSchemaNames(schemas: any[][]): Set<string> {
  const names = new Set<string>();
  for (const page of schemas ?? []) {
    for (const schema of page ?? []) {
      if (schema?.name) names.add(schema.name);
    }
  }
  return names;
}

/**
 * Slug from the label (non-Latin labels slugify to '' → `field`), then
 * suffix `_2`, `_3`… until unique across every page. pdfme requires
 * template-wide unique names.
 */
export function uniqueSchemaName(label: string, existingNames: Set<string>): string {
  const base = slugify(displayLabel(label, '')).slice(0, 40) || 'field';
  if (!existingNames.has(base)) return base;
  let n = 2;
  while (existingNames.has(`${base}_${n}`)) n++;
  return `${base}_${n}`;
}

export function boundFieldWidth(label: string): number {
  return Math.min(
    MAX_WIDTH_MM,
    Math.max(MIN_WIDTH_MM, Math.round(label.length * CHAR_WIDTH_MM) + 8)
  );
}

export function buildBoundFieldSchema(params: {
  field: FormFieldEntry;
  position: { x: number; y: number };
  existingNames: Set<string>;
  untitledLabel: string;
}): Record<string, any> {
  const { field, position, existingNames, untitledLabel } = params;
  const label = displayLabel(field.label, untitledLabel);
  return {
    name: uniqueSchemaName(field.label, existingNames),
    type: 'text',
    content: label,
    [DCULUS_FIELD_ID_KEY]: field.id,
    position,
    width: boundFieldWidth(label),
    height: FIELD_HEIGHT_MM,
    fontSize: FIELD_FONT_SIZE,
  };
}

/**
 * Prepare a stored template for the designer:
 * 1. Re-sync bound elements' display content to the field's current label
 *    (labels drift when the form is edited after placement).
 * 2. Report bound elements whose field no longer exists on the form.
 *
 * Pure/in-memory: returns the original template object when nothing changed
 * so callers can skip updateTemplate / avoid marking the template dirty.
 */
export function prepareTemplateSchemas(
  template: any,
  fields: FormFieldEntry[],
  untitledLabel: string
): { template: any; changed: boolean; missingFieldIds: string[] } {
  const fieldsById = new Map(fields.map((f) => [f.id, f]));
  const missingFieldIds = new Set<string>();
  let changed = false;

  const schemas = (template?.schemas ?? []).map((page: any[]) =>
    (page ?? []).map((schema: any) => {
      if (!schema || typeof schema !== 'object') return schema;

      let next = schema;
      const boundId: string | undefined =
        typeof schema[DCULUS_FIELD_ID_KEY] === 'string'
          ? schema[DCULUS_FIELD_ID_KEY]
          : undefined;

      if (boundId) {
        const field = fieldsById.get(boundId);
        if (!field) {
          missingFieldIds.add(boundId);
        } else {
          const label = displayLabel(field.label, untitledLabel);
          if (schema.content !== label) {
            changed = true;
            next = { ...schema, content: label };
          }
        }
      }
      return next;
    })
  );

  return {
    template: changed ? { ...template, schemas } : template,
    changed,
    missingFieldIds: [...missingFieldIds],
  };
}

/**
 * Drop every element bound to a field that no longer exists on the form.
 */
export function removeMissingBoundFields(
  template: any,
  missingFieldIds: string[]
): any {
  const missing = new Set(missingFieldIds);
  const schemas = (template?.schemas ?? []).map((page: any[]) =>
    (page ?? []).filter(
      (schema: any) => !missing.has(schema?.[DCULUS_FIELD_ID_KEY])
    )
  );
  return { ...template, schemas };
}

/**
 * How many times each form field is placed on the template, keyed by
 * field id — drives the ×N badges in the fields panel.
 */
export function countBoundFields(schemas: any[][]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const page of schemas ?? []) {
    for (const schema of page ?? []) {
      const fieldId = schema?.[DCULUS_FIELD_ID_KEY];
      if (typeof fieldId === 'string') {
        counts[fieldId] = (counts[fieldId] ?? 0) + 1;
      }
    }
  }
  return counts;
}

/**
 * Diagonal cascade so consecutive inserts never fully overlap; wraps every
 * 12 placements to stay within even small page sizes.
 */
export function cascadePosition(placedCount: number): { x: number; y: number } {
  const step = placedCount % 12;
  return { x: 20 + step * 6, y: 20 + step * 12 };
}
