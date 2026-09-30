/**
 * Grid layout helpers (docs/grid-layout-strategy.md §5).
 *
 * Storage stays a flat `page.fields` list. A grid is a non-fillable `GridField`; its children keep
 * their place in the list and carry two optional scalar pointers, `gridId` and `gridColumn`.
 * Everything here derives layout from those pointers and never mutates its input.
 *
 * Pure on purpose: no React, no Tailwind. The backend imports this module.
 * `index.ts` and this file import each other, so nothing here may touch `FieldType` at module load.
 */
import { FieldType, type FormField, type GridField } from './index.js';

export const MAX_GRID_COLUMNS = 4;
export const MIN_GRID_COLUMN_PERCENT = 10;
export const MAX_GRID_ID_LENGTH = 64;

export interface GridColumnNode {
  index: number;
  widthPercent: number;
  fields: FormField[];
}

export type PageNode =
  | { kind: 'field'; field: FormField }
  | { kind: 'grid'; grid: GridField; columns: GridColumnNode[] };

/** The one predicate consumers use to skip layout fields. Accepts plain JSON as well as instances. */
export const isLayoutField = (field: unknown): field is GridField =>
  typeof field === 'object' &&
  field !== null &&
  (field as { type?: unknown }).type === FieldType.GRID_FIELD;

const isLiveGrid = (field: FormField): field is GridField => !field.deleted && isLayoutField(field);

/** Gate for every grid-aware branch: false means the page must behave exactly as it does today. */
export const pageHasGrid = (fields: readonly FormField[]): boolean => fields.some(isLiveGrid);

export const sanitizeGridId = (value: unknown): string | undefined =>
  typeof value === 'string' && value.length > 0 && value.length <= MAX_GRID_ID_LENGTH
    ? value
    : undefined;

export const sanitizeGridColumn = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : undefined;

const toArray = (input: unknown): unknown[] | null => {
  if (Array.isArray(input)) return input;
  // Y.Array, without importing yjs into a shared package
  const asYArray = input as { toArray?: () => unknown[] } | null | undefined;
  return typeof asYArray?.toArray === 'function' ? asYArray.toArray() : null;
};

const equalSplit = (count: number): number[] => {
  const base = Math.floor(100 / count);
  const extra = 100 - base * count;
  return Array.from({ length: count }, (_, i) => base + (i < extra ? 1 : 0));
};

const clampColumnCount = (count: number): number =>
  Math.min(MAX_GRID_COLUMNS, Math.max(1, Math.trunc(count)));

/**
 * Trust boundary for `columnWidths` (I4): 1..MAX_GRID_COLUMNS integers, each at least
 * MIN_GRID_COLUMN_PERCENT, summing to 100. Anything else becomes an equal split, keeping the
 * incoming column count when that is itself valid.
 */
export const sanitizeGridColumnWidths = (input: unknown, fallbackCount = 2): number[] => {
  const widths = toArray(input);
  const validCount = widths !== null && widths.length >= 1 && widths.length <= MAX_GRID_COLUMNS;

  if (
    widths !== null &&
    validCount &&
    widths.every(
      (w) => typeof w === 'number' && Number.isInteger(w) && w >= MIN_GRID_COLUMN_PERCENT
    ) &&
    (widths as number[]).reduce((sum, w) => sum + w, 0) === 100
  ) {
    return [...(widths as number[])];
  }

  return equalSplit(validCount ? widths!.length : clampColumnCount(fallbackCount));
};

/** Column an item sits in, clamped to the grid's columns (I3). */
const columnOf = (field: FormField, columnCount: number): number => {
  const column = sanitizeGridColumn(field.gridColumn) ?? 0;
  return Math.min(column, columnCount - 1);
};

/**
 * Group a page's fields into a tree (repairs I1-I3). Grouping follows the pointers, so it does not
 * depend on storage order. Deleted fields are dropped.
 */
export const buildPageTree = (fields: readonly FormField[]): PageNode[] => {
  const liveGrids = new Map<string, GridField>();
  for (const field of fields) {
    if (isLiveGrid(field)) liveGrids.set(field.id, field);
  }

  const owningGrid = (field: FormField): GridField | undefined => {
    if (isLayoutField(field)) return undefined; // I1: grids never nest
    const gridId = sanitizeGridId(field.gridId);
    return gridId ? liveGrids.get(gridId) : undefined;
  };

  const columnsByGrid = new Map<string, GridColumnNode[]>();
  for (const grid of liveGrids.values()) {
    const widths = sanitizeGridColumnWidths(grid.columnWidths);
    columnsByGrid.set(
      grid.id,
      widths.map((widthPercent, index) => ({ index, widthPercent, fields: [] }))
    );
  }

  for (const field of fields) {
    if (field.deleted) continue;
    const grid = owningGrid(field);
    if (!grid) continue;
    const columns = columnsByGrid.get(grid.id)!;
    columns[columnOf(field, columns.length)].fields.push(field);
  }

  const nodes: PageNode[] = [];
  for (const field of fields) {
    if (field.deleted) continue;
    if (isLayoutField(field)) {
      nodes.push({ kind: 'grid', grid: field, columns: columnsByGrid.get(field.id)! });
    } else if (!owningGrid(field)) {
      nodes.push({ kind: 'field', field });
    }
  }
  return nodes;
};

/** Canonical (I5) flat order: a grid, then its children by column and previous relative order. */
export const flattenPageTree = (nodes: readonly PageNode[]): FormField[] =>
  nodes.flatMap((node) =>
    node.kind === 'field' ? [node.field] : [node.grid, ...node.columns.flatMap((c) => c.fields)]
  );

/**
 * Reorders a flat list into canonical order (I5). Deleted fields stay at their relative spot. Returns
 * the same array when nothing has to move, which includes every page without a grid.
 */
export const canonicalizeFields = (fields: FormField[]): FormField[] => {
  if (!pageHasGrid(fields)) return fields;

  const tree = buildPageTree(fields);
  const members = new Map<string, FormField[]>();
  const memberIds = new Set<string>();
  for (const node of tree) {
    if (node.kind !== 'grid') continue;
    const children = node.columns.flatMap((c) => c.fields);
    members.set(node.grid.id, children);
    children.forEach((child) => memberIds.add(child.id));
  }

  const ordered: FormField[] = [];
  for (const field of fields) {
    if (memberIds.has(field.id)) continue;
    ordered.push(field);
    if (isLiveGrid(field)) ordered.push(...(members.get(field.id) ?? []));
  }

  return ordered.every((field, i) => field === fields[i]) ? fields : ordered;
};

/** Live children of a live grid, in flat order. */
export const getGridChildren = (fields: readonly FormField[], gridId: string): FormField[] => {
  const grid = fields.find((f) => f.id === gridId);
  if (!grid || !isLiveGrid(grid)) return [];
  return fields.filter((f) => !f.deleted && !isLayoutField(f) && f.gridId === gridId);
};

/** Fields a respondent can answer or read: everything except layout containers. */
export const countQuestionFields = (fields: readonly FormField[]): number =>
  fields.filter((f) => !f.deleted && !isLayoutField(f)).length;

/**
 * Turns a visual index (counted over the canonical visible order) into a top-level insert anchor.
 * An index that falls inside a grid block resolves to the node after the block (D11).
 */
export const nodeAnchorForVisualIndex = (
  fields: readonly FormField[],
  index: number
): { beforeNodeId: string | null } => {
  const nodes = buildPageTree(fields);
  let cursor = 0;
  for (let n = 0; n < nodes.length; n++) {
    const node = nodes[n];
    if (index <= cursor) {
      return { beforeNodeId: node.kind === 'field' ? node.field.id : node.grid.id };
    }
    const size = node.kind === 'field' ? 1 : 1 + node.columns.reduce((s, c) => s + c.fields.length, 0);
    if (index < cursor + size) {
      const next = nodes[n + 1];
      return { beforeNodeId: next ? (next.kind === 'field' ? next.field.id : next.grid.id) : null };
    }
    cursor += size;
  }
  return { beforeNodeId: null };
};

/** Moves `deltaPercent` from the column right of the divider to the one on its left (negative reverses). */
export const resizeAdjacentColumns = (
  widths: readonly number[],
  dividerIndex: number,
  deltaPercent: number
): number[] => {
  const current = sanitizeGridColumnWidths(widths, widths.length);
  if (!Number.isInteger(dividerIndex) || dividerIndex < 0 || dividerIndex >= current.length - 1) {
    return current;
  }
  const left = current[dividerIndex];
  const right = current[dividerIndex + 1];
  const delta = Math.min(
    Math.max(Math.round(deltaPercent), MIN_GRID_COLUMN_PERCENT - left),
    right - MIN_GRID_COLUMN_PERCENT
  );
  const next = [...current];
  next[dividerIndex] = left + delta;
  next[dividerIndex + 1] = right - delta;
  return next;
};

/** Same count keeps the widths; a different count equalizes. */
export const setColumnCount = (widths: readonly number[], count: number): number[] => {
  const target = clampColumnCount(count);
  const current = sanitizeGridColumnWidths(widths, target);
  return current.length === target ? current : equalSplit(target);
};

/**
 * Viewer columns for a grid node: hidden fields removed, empty columns dropped (D4), and the
 * remaining widths renormalized to 100 by largest remainder.
 */
export const visibleColumns = (
  node: Extract<PageNode, { kind: 'grid' }>,
  hiddenFieldIds: ReadonlySet<string> = new Set()
): { fields: FormField[]; widthPercent: number }[] => {
  const kept = node.columns
    .map((c) => ({ fields: c.fields.filter((f) => !hiddenFieldIds.has(f.id)), width: c.widthPercent }))
    .filter((c) => c.fields.length > 0);
  if (kept.length === 0) return [];

  const total = kept.reduce((sum, c) => sum + c.width, 0);
  const exact = kept.map((c) => (c.width * 100) / total);
  const floors = exact.map(Math.floor);
  let remainder = 100 - floors.reduce((s, w) => s + w, 0);
  const byFraction = exact
    .map((value, i) => ({ i, fraction: value - floors[i] }))
    .sort((a, b) => b.fraction - a.fraction || a.i - b.i);
  for (const { i } of byFraction) {
    if (remainder <= 0) break;
    floors[i] += 1;
    remainder -= 1;
  }
  return kept.map((c, i) => ({ fields: c.fields, widthPercent: floors[i] }));
};
