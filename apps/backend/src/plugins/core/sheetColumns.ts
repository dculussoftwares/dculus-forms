import { isLayoutField, type FormField, type FormSchema } from '@dculus/types';

/**
 * Column layout shared by the Google Sheets and Microsoft Excel plugins.
 *
 * The header row is written once, when the spreadsheet is created, while the form schema keeps
 * changing afterwards. Deriving each row from the *current* schema therefore shifts every value
 * out from under its header as soon as a field is added or removed. Instead the layout is
 * persisted in the plugin config and only ever grows: existing columns never move, new fields are
 * appended at the right end, and the header row is rewritten whenever the layout changes.
 */
export interface SheetColumn {
  /** Field id, or one of the fixed column ids below, or `__unknown:<index>` for a legacy column. */
  id: string;
  label: string;
}

export const SUBMITTED_AT_COLUMN_ID = '__submittedAt';
export const RESPONSE_ID_COLUMN_ID = '__responseId';
const UNKNOWN_COLUMN_PREFIX = '__unknown:';
const SUBMITTED_AT_LABEL = 'Submitted At';
const RESPONSE_ID_LABEL = 'Response ID';

export interface SchemaFieldInfo {
  id: string;
  label: string;
  deleted: boolean;
  /** The schema field (undefined in the no-schema fallback), used to resolve option labels. */
  field?: FormField;
}

const columnLabel = (field: SchemaFieldInfo): string =>
  field.deleted ? `${field.label} (deleted)` : field.label;

const hasValue = (value: unknown): boolean =>
  value !== null &&
  value !== undefined &&
  value !== '' &&
  !(Array.isArray(value) && value.length === 0);

export const collectAnsweredIds = (responses: Record<string, unknown>[]): Set<string> => {
  const ids = new Set<string>();
  for (const data of responses) {
    for (const [id, value] of Object.entries(data ?? {})) {
      if (hasValue(value)) ids.add(id);
    }
  }
  return ids;
};

/** Every answerable field in schema order, soft-deleted ones included and flagged. */
export const collectSchemaFields = (
  formSchema: Pick<FormSchema, 'pages'> | null,
  fallbackKeys: string[]
): SchemaFieldInfo[] => {
  if (!formSchema?.pages) {
    return fallbackKeys.map((key) => ({ id: key, label: key, deleted: false }));
  }

  const fields: SchemaFieldInfo[] = [];
  for (const page of formSchema.pages) {
    for (const field of page.fields ?? []) {
      if (!field?.id || isLayoutField(field)) continue;
      fields.push({
        id: field.id,
        label: (field as { label?: string }).label ?? field.id,
        deleted: !!field.deleted,
        field,
      });
    }
  }
  return fields;
};

const fixedColumns = (): [SheetColumn, SheetColumn] => [
  { id: SUBMITTED_AT_COLUMN_ID, label: SUBMITTED_AT_LABEL },
  { id: RESPONSE_ID_COLUMN_ID, label: RESPONSE_ID_LABEL },
];

/**
 * Layout for a brand-new sheet: active fields, the two fixed columns, then soft-deleted fields
 * that actually have answers (same rule as the Excel/CSV export).
 */
export const buildInitialColumns = (
  fields: SchemaFieldInfo[],
  answeredIds: Set<string>
): SheetColumn[] => [
  ...fields.filter((f) => !f.deleted).map((f) => ({ id: f.id, label: columnLabel(f) })),
  ...fixedColumns(),
  ...fields
    .filter((f) => f.deleted && answeredIds.has(f.id))
    .map((f) => ({ id: f.id, label: columnLabel(f) })),
];

/**
 * Recovers a layout for a sheet created before layouts were persisted, from its header row.
 * Cells are matched to schema fields by label; anything unmatched keeps its column but is never
 * filled, so later columns do not shift.
 */
export const bootstrapColumnsFromHeader = (
  header: string[],
  fields: SchemaFieldInfo[]
): SheetColumn[] => {
  const used = new Set<string>();
  let hasSubmittedAt = false;
  let hasResponseId = false;

  return header.map((cell, index) => {
    const label = String(cell ?? '');

    if (!hasSubmittedAt && label === SUBMITTED_AT_LABEL) {
      hasSubmittedAt = true;
      return { id: SUBMITTED_AT_COLUMN_ID, label };
    }
    if (!hasResponseId && label === RESPONSE_ID_LABEL) {
      hasResponseId = true;
      return { id: RESPONSE_ID_COLUMN_ID, label };
    }

    // Active fields win over deleted ones that happen to share a label.
    const match =
      fields.find((f) => !used.has(f.id) && !f.deleted && f.label === label) ??
      fields.find((f) => !used.has(f.id) && f.deleted && (f.label === label || columnLabel(f) === label));
    if (match) {
      used.add(match.id);
      return { id: match.id, label };
    }

    return { id: `${UNKNOWN_COLUMN_PREFIX}${index}`, label };
  });
};

/**
 * Brings a stored layout in line with the current schema without moving any existing column:
 * labels are refreshed in place, and fields that have no column yet are appended at the right
 * end (soft-deleted ones only if a response answered them).
 */
export const reconcileColumns = (
  stored: SheetColumn[],
  fields: SchemaFieldInfo[],
  answeredIds: Set<string>
): { columns: SheetColumn[]; changed: boolean } => {
  const fieldsById = new Map(fields.map((f) => [f.id, f]));
  const known = new Set(stored.map((c) => c.id));
  let changed = false;

  const columns = stored.map((column) => {
    const field = fieldsById.get(column.id);
    if (!field) return column;
    const label = columnLabel(field);
    if (label === column.label) return column;
    changed = true;
    return { ...column, label };
  });

  for (const fixed of fixedColumns()) {
    if (known.has(fixed.id)) continue;
    columns.push(fixed);
    known.add(fixed.id);
    changed = true;
  }

  for (const field of fields) {
    if (known.has(field.id)) continue;
    if (field.deleted && !answeredIds.has(field.id)) continue;
    columns.push({ id: field.id, label: columnLabel(field) });
    known.add(field.id);
    changed = true;
  }

  return { columns, changed };
};

export const columnHeaders = (columns: SheetColumn[]): string[] => columns.map((c) => c.label);

/** Builds one row in `columns` order; `resolveValue` formats a single field's raw answer. */
export const buildRowFromColumns = (
  columns: SheetColumn[],
  responseData: Record<string, unknown>,
  responseId: string,
  submittedAt: string,
  resolveValue: (fieldId: string, rawValue: unknown) => string
): string[] =>
  columns.map((column) => {
    if (column.id === SUBMITTED_AT_COLUMN_ID) return submittedAt;
    if (column.id === RESPONSE_ID_COLUMN_ID) return responseId;
    if (column.id.startsWith(UNKNOWN_COLUMN_PREFIX)) return '';
    return resolveValue(column.id, responseData[column.id]);
  });
