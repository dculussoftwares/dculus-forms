import { FieldType, type FormField, type FormSchema } from '@dculus/types';

export type DraftData = Record<string, unknown>;
export type PageResponses = Record<string, Record<string, unknown>>;

/** Field types that hold no answer at all. */
const NON_ANSWER_TYPES = new Set<string>([FieldType.RICH_TEXT_FIELD, FieldType.GRID_FIELD]);

const isPrimitiveAnswer = (value: unknown): value is string | number | boolean =>
  typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';

const isEmptyAnswer = (value: unknown) =>
  value === undefined ||
  value === null ||
  value === '' ||
  (Array.isArray(value) && value.length === 0);

const containsFile = (value: unknown) =>
  typeof File !== 'undefined' &&
  (value instanceof File || (Array.isArray(value) && value.some((item) => item instanceof File)));

/**
 * Reduces the renderer's flat answers to what is worth saving: no empty
 * values (the renderer seeds every field with '' or []) and no File objects.
 * An all-empty form therefore prunes to `{}`, which lets autosave skip the
 * renderer's initial seeding instead of creating an empty draft.
 */
export function pruneDraftData(responses: Record<string, unknown>): DraftData {
  const pruned: DraftData = {};
  for (const [fieldId, value] of Object.entries(responses)) {
    if (isEmptyAnswer(value) || containsFile(value)) continue;
    if (Array.isArray(value)) {
      if (value.every(isPrimitiveAnswer)) pruned[fieldId] = value;
      continue;
    }
    if (isPrimitiveAnswer(value)) pruned[fieldId] = value;
  }
  return pruned;
}

/** Stable key for "did the answers change since the last save". */
export function draftDataKey(data: DraftData): string {
  return JSON.stringify(Object.keys(data).sort().map((key) => [key, data[key]]));
}

const hasOptions = (field: FormField): field is FormField & { options: string[] } =>
  Array.isArray((field as { options?: unknown }).options);

/**
 * A saved answer only survives if it still fits the field as the form looks
 * now: the owner may have deleted the field, changed its type, or removed an
 * option since the draft was saved.
 */
function restoreAnswer(field: FormField, value: unknown, keepFiles: boolean): unknown {
  switch (field.type) {
    case FieldType.FILE_UPLOAD_FIELD: {
      // Stored upload keys. Drafts never hold any: files only upload at submit.
      if (!keepFiles || !Array.isArray(value)) return undefined;
      const keys = value.filter((item): item is string => typeof item === 'string');
      return keys.length > 0 ? keys : undefined;
    }
    case FieldType.CHECKBOX_FIELD: {
      if (!Array.isArray(value) || !hasOptions(field)) return undefined;
      const kept = value.filter((item) => typeof item === 'string' && field.options.includes(item));
      return kept.length > 0 ? kept : undefined;
    }
    case FieldType.RADIO_FIELD:
    case FieldType.SELECT_FIELD:
      return typeof value === 'string' && hasOptions(field) && field.options.includes(value) ? value : undefined;
    case FieldType.NUMBER_FIELD:
      return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
    default:
      // Text, email, phone and date fields all hold strings.
      return typeof value === 'string' ? value : undefined;
  }
}

/**
 * Maps flat saved answers (a draft, or a submitted response being edited)
 * back onto the form's pages in the shape `useFormResponseStore.setPageResponses`
 * takes, dropping anything stale. `keepFiles` restores stored upload keys,
 * which only a submitted response has.
 */
export function buildPageResponses(
  schema: FormSchema,
  data: DraftData,
  { keepFiles = false }: { keepFiles?: boolean } = {}
): PageResponses {
  const pages: PageResponses = {};
  for (const page of schema.pages) {
    for (const field of page.fields) {
      if (field.deleted || NON_ANSWER_TYPES.has(field.type)) continue;
      if (!Object.prototype.hasOwnProperty.call(data, field.id)) continue;
      const value = restoreAnswer(field, data[field.id], keepFiles);
      if (value === undefined) continue;
      (pages[page.id] ??= {})[field.id] = value;
    }
  }
  return pages;
}

/** The saved page, if it still exists; otherwise the form opens normally. */
export function resolveResumePageId(schema: FormSchema, pageId: string | null | undefined): string | undefined {
  if (!pageId) return undefined;
  return schema.pages.some((page) => page.id === pageId) ? pageId : undefined;
}
