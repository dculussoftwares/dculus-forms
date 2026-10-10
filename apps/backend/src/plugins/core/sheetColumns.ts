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

/**
 * `sheetColumns` is owned by the sheet handlers, not by the config forms: a form saves whatever
 * layout it loaded, which may predate columns a later run added. When a saved config carries no
 * layout, keep the persisted one — but only for the same document and worksheet, since a layout
 * describes one header row.
 */
export const carrySheetColumns = (existing: unknown, next: unknown): unknown => {
  if (!existing || typeof existing !== 'object' || !next || typeof next !== 'object') return next;
  const previous = existing as ConfigRecord;
  const incoming = next as ConfigRecord;

  if (!Array.isArray(previous.sheetColumns) || incoming.sheetColumns) return next;
  if (!previous.spreadsheetId && !previous.workbookId) return next;
  if (documentKey(previous) !== documentKey(incoming)) return next;

  return { ...incoming, sheetColumns: previous.sheetColumns };
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
