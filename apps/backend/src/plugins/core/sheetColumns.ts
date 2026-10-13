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

/** Event keys that are not answers. */
const RESERVED_DATA_KEYS = new Set(['responseId', 'submittedAt']);

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

/**
 * Every answerable field in schema order, soft-deleted ones included and flagged. Answered ids the
 * schema no longer knows at all (fields removed outright, e.g. when a form was rebuilt) are
 * appended as flagged-deleted fields, so their answers still get a column — same rule as the
 * Excel/CSV export. A form with no fields yet falls back to the keys present in the responses.
 */
export const collectSchemaFields = (
  formSchema: Pick<FormSchema, 'pages'> | null,
  fallbackKeys: string[],
  answeredIds: Set<string> = new Set()
): SchemaFieldInfo[] => {
  const fields: SchemaFieldInfo[] = [];
  const knownIds = new Set<string>();

  for (const page of formSchema?.pages ?? []) {
    for (const field of page.fields ?? []) {
      if (!field?.id) continue;
      knownIds.add(field.id);
      if (isLayoutField(field)) continue;
      fields.push({
        id: field.id,
        label: (field as { label?: string }).label ?? field.id,
        deleted: !!field.deleted,
        field,
      });
    }
  }

  if (knownIds.size === 0) {
    return fallbackKeys.map((key) => ({ id: key, label: key, deleted: false }));
  }

  const orphanIds = [...answeredIds]
    .filter((id) => !knownIds.has(id) && !RESERVED_DATA_KEYS.has(id))
    .sort();
  for (const id of orphanIds) {
    fields.push({ id, label: `Field ${id}`, deleted: true });
  }

  return fields;
};

const fixedColumns = (): [SheetColumn, SheetColumn] => [
  { id: SUBMITTED_AT_COLUMN_ID, label: SUBMITTED_AT_LABEL },
  { id: RESPONSE_ID_COLUMN_ID, label: RESPONSE_ID_LABEL },
];

/**
 * Field-only columns for a one-off table (no persisted layout, e.g. an email digest): active
 * fields in schema order, then deleted/unknown fields that have answers.
 */
export const buildFieldColumns = (
  fields: SchemaFieldInfo[],
  answeredIds: Set<string>
): SheetColumn[] =>
  [
    ...fields.filter((f) => !f.deleted),
    ...fields.filter((f) => f.deleted && answeredIds.has(f.id)),
  ].map((f) => ({ id: f.id, label: columnLabel(f) }));

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
 * The fixed columns are the last cells with their labels (a form field may share those labels);
 * the rest are matched to schema fields by label, but only when the label identifies exactly one
 * column and one field. Anything else keeps its column and is never filled, so later columns do
 * not shift and no answer is put under a guessed field.
 */
export const bootstrapColumnsFromHeader = (
  header: string[],
  fields: SchemaFieldInfo[]
): SheetColumn[] => {
  const cells = header.map((cell) => String(cell ?? ''));
  const submittedAtIndex = cells.lastIndexOf(SUBMITTED_AT_LABEL);
  const responseIdIndex = cells.lastIndexOf(RESPONSE_ID_LABEL);

  const labelCounts = new Map<string, number>();
  cells.forEach((label, index) => {
    if (index === submittedAtIndex || index === responseIdIndex) return;
    labelCounts.set(label, (labelCounts.get(label) ?? 0) + 1);
  });

  const used = new Set<string>();

  return cells.map((label, index) => {
    if (index === submittedAtIndex) return { id: SUBMITTED_AT_COLUMN_ID, label };
    if (index === responseIdIndex) return { id: RESPONSE_ID_COLUMN_ID, label };

    const candidates = fields.filter(
      (f) => !used.has(f.id) && (f.label === label || columnLabel(f) === label)
    );
    // Active fields win over deleted ones that happen to share a label.
    const active = candidates.filter((f) => !f.deleted);
    const pool = active.length > 0 ? active : candidates;

    if (labelCounts.get(label) === 1 && pool.length === 1) {
      used.add(pool[0].id);
      return { id: pool[0].id, label };
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

type ConfigRecord = Record<string, unknown>;

const documentKey = (config: ConfigRecord): string =>
  [config.spreadsheetId, config.workbookId, String(config.worksheetName ?? '').trim() || 'Sheet1'].join('|');

const DOCUMENT_IDENTITY_KEYS = ['spreadsheetId', 'spreadsheetUrl', 'workbookId', 'workbookUrl'] as const;

/**
 * The document, its location and `sheetColumns` are owned by the sheet handlers, not by the
 * config forms: a form saves whatever it loaded, which may predate the file a later run (or a
 * backfill) created and the columns it added.
 *
 * - A save that names no document keeps the persisted one, so a stale form can never orphan it.
 * - Once a document exists its destination folder is fixed, whatever the form sends.
 * - A save with no layout keeps the persisted one — but only for the same document and
 *   worksheet, since a layout describes one header row.
 */
export const carrySheetColumns = (existing: unknown, next: unknown): unknown => {
  if (!existing || typeof existing !== 'object' || !next || typeof next !== 'object') return next;
  const previous = existing as ConfigRecord;
  let incoming = next as ConfigRecord;

  const hasDocument = (config: ConfigRecord): boolean => !!(config.spreadsheetId || config.workbookId);
  if (!hasDocument(previous)) return next;

  if (!hasDocument(incoming) && previous.type === incoming.type) {
    const identity = Object.fromEntries(
      DOCUMENT_IDENTITY_KEYS.filter((key) => previous[key] !== undefined).map((key) => [key, previous[key]])
    );
    incoming = { ...incoming, ...identity };
  }

  if (hasDocument(incoming)) {
    const sameDocument =
      incoming.spreadsheetId === previous.spreadsheetId && incoming.workbookId === previous.workbookId;

    if (sameDocument && JSON.stringify(incoming.destinationFolder) !== JSON.stringify(previous.destinationFolder)) {
      incoming = { ...incoming };
      if (previous.destinationFolder === undefined) delete incoming.destinationFolder;
      else incoming.destinationFolder = previous.destinationFolder;
    }

    if (
      Array.isArray(previous.sheetColumns) &&
      !incoming.sheetColumns &&
      documentKey(previous) === documentKey(incoming)
    ) {
      incoming = { ...incoming, sheetColumns: previous.sheetColumns };
    }
  }

  return incoming;
};

interface GraphWithNodes {
  nodes?: Array<{ id?: string; type?: string; data?: { config?: unknown } & ConfigRecord }>;
}

/** {@link carrySheetColumns} for every action node of a graph being saved over an existing one. */
export const carrySheetColumnsInGraph = <T>(existingGraph: unknown, nextGraph: T): T => {
  const existingNodes = (existingGraph as GraphWithNodes | null)?.nodes;
  const nextNodes = (nextGraph as GraphWithNodes | null)?.nodes;
  if (!Array.isArray(existingNodes) || !Array.isArray(nextNodes)) return nextGraph;

  let changed = false;
  const nodes = nextNodes.map((node) => {
    if (node?.type !== 'action' || !node.data?.config) return node;
    const previous = existingNodes.find((n) => n?.id === node.id);
    const config = carrySheetColumns(previous?.data?.config, node.data.config);
    if (config === node.data.config) return node;
    changed = true;
    return { ...node, data: { ...node.data, config } };
  });

  return changed ? ({ ...nextGraph, nodes } as T) : nextGraph;
};
