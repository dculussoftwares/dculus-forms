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

/**
 * Font every bound field uses (must match TAMIL_FONT_NAME in the backend's
 * pdfTemplateService). Noto Sans Tamil covers Tamil AND basic Latin, so
 * answers render correctly whichever script the respondent used — pdfme's
 * default Roboto has no Tamil glyphs.
 */
export const PDF_FIELD_FONT_NAME = 'NotoSansTamil';

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Matches a standalone `{token}` only — never the inner braces of a legacy
 * `{{fieldId}}` placeholder when a token name collides with a field id.
 * Must stay in sync with the backend's substitution in pdfTemplateService.
 */
function tokenPattern(token: string): RegExp {
  return new RegExp(`(?<!\\{)\\{${escapeRegExp(token)}\\}(?!\\})`, 'g');
}

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
    fontName: PDF_FIELD_FONT_NAME,
  };
}

/**
 * Rebuild an inline-text element's display string from its {token} template:
 * tokens of existing fields render as the field's current label; tokens of
 * deleted fields stay literal so the user can see them.
 */
export function renderTextTemplateDisplay(
  template: string,
  fieldVars: Record<string, string>,
  fieldsById: Map<string, FormFieldEntry>,
  untitledLabel: string
): { display: string; missingFieldIds: string[] } {
  const missing = new Set<string>();
  let display = template;
  for (const [token, fieldId] of Object.entries(fieldVars)) {
    if (typeof fieldId !== 'string') continue;
    const field = fieldsById.get(fieldId);
    if (!field) {
      missing.add(fieldId);
      continue;
    }
    const label = field.label.trim() || untitledLabel;
    display = display.replace(tokenPattern(token), () => label);
  }
  return { display, missingFieldIds: [...missing] };
}

/**
 * Prepare a stored template for the designer:
 * 1. Re-sync bound elements' display content to the field's current label,
 *    and inline-text elements' display to their {token} template (labels
 *    drift when the form is edited after placement).
 * 2. Report elements referencing fields that no longer exist on the form.
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
      } else if (schema.dculusFieldVars && typeof schema.dculusFieldVars === 'object') {
        // Elements saved before the display/template split carry the {token}
        // string in content — adopt it as the template (one-time shim)
        const textTemplate =
          typeof schema.dculusTextTemplate === 'string'
            ? schema.dculusTextTemplate
            : typeof schema.content === 'string'
              ? schema.content
              : '';
        const rendered = renderTextTemplateDisplay(
          textTemplate,
          schema.dculusFieldVars,
          fieldsById,
          untitledLabel
        );
        rendered.missingFieldIds.forEach((id) => missingFieldIds.add(id));
        if (
          schema.content !== rendered.display ||
          schema.dculusTextTemplate !== textTemplate
        ) {
          changed = true;
          next = { ...schema, content: rendered.display, dculusTextTemplate: textTemplate };
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
 * Clean up references to fields that no longer exist on the form: bound
 * elements are dropped entirely; inline-text elements keep their text but
 * lose the dead tokens (removed from the template, vars and display).
 */
export function removeMissingBoundFields(
  template: any,
  missingFieldIds: string[]
): any {
  const missing = new Set(missingFieldIds);
  const schemas = (template?.schemas ?? []).map((page: any[]) =>
    (page ?? [])
      .filter((schema: any) => !missing.has(schema?.[DCULUS_FIELD_ID_KEY]))
      .map((schema: any) => {
        const fieldVars = schema?.dculusFieldVars;
        if (
          typeof schema?.dculusTextTemplate !== 'string' ||
          !fieldVars ||
          typeof fieldVars !== 'object'
        ) {
          return schema;
        }
        const deadTokens = Object.entries(fieldVars)
          .filter(([, fieldId]) => missing.has(fieldId as string))
          .map(([token]) => token);
        if (deadTokens.length === 0) return schema;

        let newTemplate = schema.dculusTextTemplate;
        let newContent = typeof schema.content === 'string' ? schema.content : '';
        const newVars = { ...fieldVars };
        for (const token of deadTokens) {
          newTemplate = newTemplate.replace(tokenPattern(token), '');
          newContent = newContent.replace(tokenPattern(token), '');
          delete newVars[token];
        }
        const next = { ...schema, content: newContent };
        if (Object.keys(newVars).length > 0) {
          next.dculusTextTemplate = newTemplate;
          next.dculusFieldVars = newVars;
        } else {
          next.content = newTemplate;
          delete next.dculusTextTemplate;
          delete next.dculusFieldVars;
        }
        return next;
      })
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
