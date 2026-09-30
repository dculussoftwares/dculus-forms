/**
 * Grid-aware store actions (docs/grid-layout-strategy.md §7.4).
 *
 * Every action runs in one `ydoc.transact`, resolves ids to raw Y.Array indexes inside it (I7) and
 * brackets its mutation with `ensureCanonical` (I5). The existing structural actions only reach this
 * module through `involvesGrid`, so a page without a grid keeps running today's code unchanged.
 */
import * as Y from 'yjs';
import { toastError } from '@dculus/ui';
import {
  FieldType,
  FormField,
  GridField,
  PageNode,
  buildPageTree,
  canonicalizeFields,
  getGridChildren,
  isLayoutField,
  nodeAnchorForVisualIndex,
  pageHasGrid,
  sanitizeGridColumn,
  sanitizeGridColumnWidths,
  sanitizeGridId,
  setColumnCount,
} from '@dculus/types';
import type { GridSnapshot, GridTarget, PlaceTarget } from '../types/store.types';
import {
  createFormField,
  createYJSFieldMap,
  generateUniqueId,
  serializeFieldToYMap,
} from '../helpers/fieldHelpers';
import { extractFieldData, FieldData } from '../collaboration/CollaborationManager';

type FieldsArray = Y.Array<Y.Map<any>>;
type GridNode = Extract<PageNode, { kind: 'grid' }>;
type StoreGetter = () => unknown;

const isDeletedMap = (map: Y.Map<any>) => map.get('deleted') === true;

/** The layout-relevant part of a stored field, in the shape the pure grid helpers read. */
const shadowOf = (map: Y.Map<any>): FormField => {
  const shadow: Record<string, unknown> = { id: map.get('id'), type: map.get('type') };
  if (isDeletedMap(map)) shadow.deleted = true;
  if (map.has('gridId')) shadow.gridId = map.get('gridId');
  if (map.has('gridColumn')) shadow.gridColumn = map.get('gridColumn');
  if (shadow.type === FieldType.GRID_FIELD) shadow.columnWidths = map.get('columnWidths');
  return shadow as unknown as FormField;
};

const shadowsOf = (fields: FieldsArray): FormField[] => fields.toArray().map(shadowOf);

const rawIndexOf = (fields: FieldsArray, id: string): number =>
  fields.toArray().findIndex((map) => map.get('id') === id);

const nodeId = (node: PageNode): string => (node.kind === 'field' ? node.field.id : node.grid.id);

const gridNodeOf = (nodes: PageNode[], gridId: string): GridNode | undefined =>
  nodes.find((node): node is GridNode => node.kind === 'grid' && node.grid.id === gridId);

const ownerGridOf = (nodes: PageNode[], fieldId: string): GridNode | undefined =>
  nodes.find(
    (node): node is GridNode =>
      node.kind === 'grid' && node.columns.some((c) => c.fields.some((f) => f.id === fieldId))
  );

const columnIndexOf = (node: GridNode, fieldId: string): number =>
  node.columns.findIndex((c) => c.fields.some((f) => f.id === fieldId));

const clampColumn = (column: number, count: number): number =>
  Math.min(Math.max(0, Math.trunc(Number(column)) || 0), count - 1);

const clearLayout = (data: FieldData): void => {
  delete data.gridId;
  delete data.gridColumn;
};

const withoutLayout = (data: Partial<FieldData>): Partial<FieldData> => {
  const copy = { ...data };
  delete copy.gridId;
  delete copy.gridColumn;
  return copy;
};

/**
 * Rebuilds a field's Y.Map (Y.Array has no move), the same extractFieldData → createYJSFieldMap path
 * reorderFields uses. A grid is written back in its §7.1 shape only: id, type, columnWidths, deleted.
 */
const recreateFieldMap = (map: Y.Map<any>, edit?: (data: FieldData) => void): Y.Map<any> => {
  const data = extractFieldData(map);
  edit?.(data);
  if (!isLayoutField(data)) return createYJSFieldMap(data);
  const grid: FieldData = { id: data.id, type: FieldType.GRID_FIELD, columnWidths: data.columnWidths };
  if (data.deleted) grid.deleted = true;
  return createYJSFieldMap(grid);
};

const insertAt = (fields: FieldsArray, index: number, maps: Y.Map<any>[]): void => {
  if (index < 0 || index >= fields.length) fields.push(maps);
  else fields.insert(index, maps);
};

const insertBefore = (fields: FieldsArray, anchorId: string | null, maps: Y.Map<any>[]): void =>
  insertAt(fields, anchorId === null ? -1 : rawIndexOf(fields, anchorId), maps);

/** Raw index just past the last child of columns 0..column (storage is canonical here). */
const columnEndIndex = (fields: FieldsArray, gridId: string, column: number): number => {
  const node = gridNodeOf(buildPageTree(shadowsOf(fields)), gridId);
  const before = node ? node.columns.slice(0, column + 1).flatMap((c) => c.fields) : [];
  const last = before.length > 0 ? before[before.length - 1].id : gridId;
  return rawIndexOf(fields, last) + 1;
};

/** A top-level anchor: a node id (a child resolves to its grid), a soft-deleted field's id, or null (end). */
const resolveTopLevelAnchor = (
  shadows: FormField[],
  nodes: PageNode[],
  id: string | null | undefined
): string | null => {
  if (!id || !shadows.some((s) => s.id === id)) return null;
  return ownerGridOf(nodes, id)?.grid.id ?? id;
};

/**
 * Reorders the page's Y.Array into canonical order (I5), recreating only the maps that move.
 * Writes nothing when the page is already canonical.
 */
export const ensureCanonical = (fields: FieldsArray): void => {
  const maps = fields.toArray();
  const shadows = maps.map(shadowOf);
  const ordered = canonicalizeFields(shadows);
  if (ordered === shadows) return;

  const mapOfShadow = new Map(shadows.map((shadow, i) => [shadow, maps[i]]));
  ordered.forEach((shadow, i) => {
    const wanted = mapOfShadow.get(shadow)!;
    if (fields.get(i) === wanted) return;
    const moved = recreateFieldMap(wanted);
    fields.delete(fields.toArray().indexOf(wanted), 1);
    fields.insert(i, [moved]);
  });
};

// Grid-less pages are never canonicalized (§6: a page with no grid is never touched).
const keepCanonical = (fields: FieldsArray): void => {
  if (pageHasGrid(shadowsOf(fields))) ensureCanonical(fields);
};

const canonicalAround = <T>(pages: FieldsArray[], mutate: () => T): T => {
  pages.forEach(keepCanonical);
  const result = mutate();
  pages.forEach(keepCanonical);
  return result;
};

const setLayoutKeys = (map: Y.Map<any>, gridId: string, column: number): void => {
  if (map.get('gridId') !== gridId) map.set('gridId', gridId);
  if ((map.get('gridColumn') ?? 0) !== column) map.set('gridColumn', column);
};

const clearLayoutKeys = (map: Y.Map<any>): void => {
  if (map.has('gridId')) map.delete('gridId');
  if (map.has('gridColumn')) map.delete('gridColumn');
};

const isGridTarget = (target: PlaceTarget): target is GridTarget => target.gridId !== undefined;

const placeInGrid = (fields: FieldsArray, shadows: FormField[], self: FormField, target: GridTarget): boolean => {
  const node = gridNodeOf(buildPageTree(shadows), target.gridId);
  if (!node) return false;
  if (target.beforeFieldId === self.id) return true;

  const column = clampColumn(target.column, node.columns.length);
  const anchor =
    target.beforeFieldId && node.columns[column].fields.some((f) => f.id === target.beforeFieldId)
      ? target.beforeFieldId
      : null;
  const map = fields.get(shadows.indexOf(self));

  // Membership-only change that keeps the flat position: scalar sets, so concurrent edits survive (§6)
  const simulated = shadows.map((s) =>
    s === self ? ({ ...s, gridId: node.grid.id, gridColumn: column } as FormField) : s
  );
  const simulatedColumn = gridNodeOf(buildPageTree(simulated), node.grid.id)!.columns[column].fields;
  const next = simulatedColumn[simulatedColumn.findIndex((f) => f.id === self.id) + 1];
  if ((next?.id ?? null) === anchor && canonicalizeFields(simulated) === simulated) {
    setLayoutKeys(map, node.grid.id, column);
    return true;
  }

  const moved = recreateFieldMap(map, (data) => {
    data.gridId = node.grid.id;
    data.gridColumn = column;
  });
  fields.delete(fields.toArray().indexOf(map), 1);
  insertAt(fields, anchor ? rawIndexOf(fields, anchor) : columnEndIndex(fields, node.grid.id, column), [moved]);
  return true;
};

const placeTopLevel = (
  fields: FieldsArray,
  shadows: FormField[],
  nodes: PageNode[],
  self: FormField,
  beforeNodeId: string | null | undefined
): boolean => {
  const anchor = resolveTopLevelAnchor(shadows, nodes, beforeNodeId);
  if (anchor === self.id) return true;
  const map = fields.get(shadows.indexOf(self));

  const simulated = shadows.map((s) => {
    if (s !== self) return s;
    const copy = { ...s } as FormField;
    delete copy.gridId;
    delete copy.gridColumn;
    return copy;
  });
  const simulatedNodes = buildPageTree(simulated);
  const next = simulatedNodes[simulatedNodes.findIndex((n) => nodeId(n) === self.id) + 1];
  if ((next ? nodeId(next) : null) === anchor && canonicalizeFields(simulated) === simulated) {
    clearLayoutKeys(map);
    return true;
  }

  const moved = recreateFieldMap(map, clearLayout);
  fields.delete(fields.toArray().indexOf(map), 1);
  insertBefore(fields, anchor, [moved]);
  return true;
};

/** Moves a grid and its live children as one block (canonical storage keeps the block contiguous). */
const moveGridBlock = (
  fields: FieldsArray,
  shadows: FormField[],
  nodes: PageNode[],
  gridId: string,
  beforeNodeId: string | null | undefined
): void => {
  const anchor = resolveTopLevelAnchor(shadows, nodes, beforeNodeId);
  const at = nodes.findIndex((n) => nodeId(n) === gridId);
  const node = nodes[at] as GridNode;
  const next = nodes[at + 1];
  if (anchor === gridId || (next ? nodeId(next) : null) === anchor) return;

  const blockMaps = [node.grid, ...node.columns.flatMap((c) => c.fields)].map((s) =>
    fields.get(shadows.indexOf(s))
  );
  const moved = blockMaps.map((map) => recreateFieldMap(map));
  blockMaps.forEach((map) => fields.delete(fields.toArray().indexOf(map), 1));
  insertBefore(fields, anchor, moved);
};

const place = (fields: FieldsArray, fieldId: string, target: PlaceTarget): boolean => {
  const shadows = shadowsOf(fields);
  const self = shadows.find((s) => s.id === fieldId && !s.deleted);
  if (!self) return false;
  const nodes = buildPageTree(shadows);

  if (isLayoutField(self)) {
    if (isGridTarget(target)) return false; // I1: grids never nest
    moveGridBlock(fields, shadows, nodes, self.id, target.beforeNodeId);
    return true;
  }
  return isGridTarget(target)
    ? placeInGrid(fields, shadows, self, target)
    : placeTopLevel(fields, shadows, nodes, self, target.beforeNodeId);
};

/**
 * Translates an index move (Move up/down, Alt+↑/↓, AI REORDER, flat DnD) into a tree placement.
 * One step: a top-level node swaps with its neighbour node (a grid moves as a block); a child swaps
 * with its column neighbour and leaves the grid at a column edge (D10). A longer jump lands next to
 * the target's node, or next to the target inside the same grid; it never pulls a child out of its grid.
 */
const reorderTarget = (
  shadows: FormField[],
  movedId: string,
  targetId: string,
  down: boolean,
  step: boolean
): PlaceTarget | null => {
  const nodes = buildPageTree(shadows);
  const ids = nodes.map(nodeId);
  const owner = ownerGridOf(nodes, movedId);

  if (!owner) {
    const i = ids.indexOf(movedId);
    if (step) {
      if (down) return i + 1 < ids.length ? { beforeNodeId: ids[i + 2] ?? null } : null;
      return i > 0 ? { beforeNodeId: ids[i - 1] } : null;
    }
    const targetNode = ownerGridOf(nodes, targetId)?.grid.id ?? targetId;
    const j = ids.indexOf(targetNode);
    if (targetNode === movedId || j === -1) return null;
    return { beforeNodeId: down ? ids[j + 1] ?? null : targetNode };
  }

  const gridId = owner.grid.id;
  const column = columnIndexOf(owner, movedId);
  const siblings = owner.columns[column].fields.map((f) => f.id);
  const k = siblings.indexOf(movedId);

  if (step) {
    if (down) {
      return k + 1 < siblings.length
        ? { gridId, column, beforeFieldId: siblings[k + 2] ?? null }
        : { beforeNodeId: ids[ids.indexOf(gridId) + 1] ?? null };
    }
    return k > 0 ? { gridId, column, beforeFieldId: siblings[k - 1] } : { beforeNodeId: gridId };
  }

  if (ownerGridOf(nodes, targetId) === owner) {
    const targetColumn = columnIndexOf(owner, targetId);
    const targetSiblings = owner.columns[targetColumn].fields.map((f) => f.id).filter((id) => id !== movedId);
    const t = targetSiblings.indexOf(targetId);
    return { gridId, column: targetColumn, beforeFieldId: down ? targetSiblings[t + 1] ?? null : targetId };
  }
  const others = siblings.filter((id) => id !== movedId);
  return { gridId, column, beforeFieldId: down ? null : others[0] ?? null };
};

/** New ids for a grid and its live children, children re-pointed at the new grid. Labels are kept. */
const cloneGridBlock = (
  fields: FieldsArray,
  shadows: FormField[],
  grid: FormField
): { gridId: string; maps: Y.Map<any>[] } => {
  const gridId = generateUniqueId();
  const gridMap = recreateFieldMap(fields.get(shadows.indexOf(grid)), (data) => {
    data.id = gridId;
    delete data.deleted;
  });
  const childMaps = getGridChildren(shadows, grid.id).map((child) =>
    recreateFieldMap(fields.get(shadows.indexOf(child)), (data) => {
      data.id = generateUniqueId();
      data.gridId = gridId;
    })
  );
  return { gridId, maps: [gridMap, ...childMaps] };
};

// Set while a grid-aware action delegates to an existing action body, so that body's guard stays off.
let defaultPathDepth = 0;
const runDefaultPath = (run: () => void): void => {
  defaultPathDepth++;
  try {
    run();
  } finally {
    defaultPathDepth--;
  }
};

const pagesArrayOf = (ydoc: Y.Doc): Y.Array<Y.Map<any>> | null => {
  const pages = ydoc.getMap('formSchema').get('pages');
  return pages instanceof Y.Array ? (pages as Y.Array<Y.Map<any>>) : null;
};

const fieldsOfPage = (pageMap: Y.Map<any> | undefined): FieldsArray | null => {
  const fields = pageMap?.get('fields');
  return fields instanceof Y.Array ? (fields as FieldsArray) : null;
};

const isLiveGridMap = (map: unknown): boolean =>
  map instanceof Y.Map && map.get('type') === FieldType.GRID_FIELD && !isDeletedMap(map);

/**
 * The single gate for the grid-aware branches: true when a page involved holds a live grid, or the
 * field is a grid or points at one. Read-only; false whenever the document is not ready.
 */
export const involvesGrid = (
  get: StoreGetter,
  pageIds: readonly string[],
  field?: { id?: string; type?: string; gridId?: unknown }
): boolean => {
  if (defaultPathDepth > 0) return false;
  const { _getYDoc, _isYJSReady } = get() as any;
  const ydoc: Y.Doc | null = _getYDoc?.() ?? null;
  if (!ydoc || !_isYJSReady?.()) return false;
  if (field?.type === FieldType.GRID_FIELD || sanitizeGridId(field?.gridId) !== undefined) return true;

  const pages = pagesArrayOf(ydoc);
  if (!pages) return false;
  const pageMaps = pages.toArray();
  const fieldsOf = (pageId: string) => fieldsOfPage(pageMaps.find((p) => p.get('id') === pageId));

  if (pageIds.some((pageId) => fieldsOf(pageId)?.toArray().some(isLiveGridMap))) return true;

  if (field?.id === undefined || pageIds.length === 0) return false;
  const stored = fieldsOf(pageIds[0])?.toArray().find((map) => map.get('id') === field.id);
  return (
    stored !== undefined &&
    (stored.get('type') === FieldType.GRID_FIELD || sanitizeGridId(stored.get('gridId')) !== undefined)
  );
};

export const createGridActions = (get: StoreGetter) => {
  /** One transaction over the given pages. `body` gets the page Y.Maps; nothing runs if one is missing. */
  const onPages = <T>(pageIds: string[], body: (pageMaps: Y.Map<any>[]) => T): T | undefined => {
    const { _getYDoc, _isYJSReady } = get() as any;
    const ydoc: Y.Doc | null = _getYDoc();
    if (!ydoc || !_isYJSReady()) {
      toastError('Connection lost', 'Please wait — reconnecting to the collaboration server.');
      return undefined;
    }
    const pages = pagesArrayOf(ydoc)?.toArray() ?? [];
    const pageMaps = pageIds.map((pageId) => pages.find((p) => p.get('id') === pageId));
    if (pageMaps.some((p) => p === undefined)) {
      console.warn(`Page not found: ${pageIds.join(', ')}`);
      return undefined;
    }
    let result: T | undefined;
    ydoc.transact(() => {
      result = body(pageMaps as Y.Map<any>[]);
    });
    return result;
  };

  const ensureFieldsOf = (pageMap: Y.Map<any>): FieldsArray => {
    const existing = fieldsOfPage(pageMap);
    if (existing) return existing;
    const created: FieldsArray = new Y.Array();
    pageMap.set('fields', created);
    return created;
  };

  /** One page, canonical before and after the mutation. `create` adds a missing fields array. */
  const onGridPage = <T>(pageId: string, mutate: (fields: FieldsArray) => T, create = false): T | undefined =>
    onPages([pageId], ([pageMap]) => {
      const fields = create ? ensureFieldsOf(pageMap) : fieldsOfPage(pageMap);
      return fields ? canonicalAround([fields], () => mutate(fields)) : undefined;
    });

  const insertGrid = (fields: FieldsArray, widths: number[], beforeNodeId: string | null | undefined): string => {
    const shadows = shadowsOf(fields);
    const id = generateUniqueId();
    const anchor = resolveTopLevelAnchor(shadows, buildPageTree(shadows), beforeNodeId);
    insertBefore(fields, anchor, [serializeFieldToYMap(new GridField(id, widths))]);
    return id;
  };

  const removeGridIn = (fields: FieldsArray, gridId: string, deleteChildren: boolean): GridSnapshot | undefined => {
    const shadows = shadowsOf(fields);
    const node = gridNodeOf(buildPageTree(shadows), gridId);
    if (!node) return undefined;
    const removed = [node.grid, ...(deleteChildren ? node.columns.flatMap((c) => c.fields) : [])];
    removed.forEach((s) => fields.get(shadows.indexOf(s)).set('deleted', true));
    return { gridId, fieldIds: removed.map((s) => s.id) };
  };

  const duplicateGridIn = (fields: FieldsArray, gridId: string): string | undefined => {
    const shadows = shadowsOf(fields);
    const grid = shadows.find((s) => s.id === gridId && !s.deleted && isLayoutField(s));
    if (!grid) return undefined;
    const block = [grid, ...getGridChildren(shadows, gridId)];
    const copy = cloneGridBlock(fields, shadows, grid);
    insertAt(fields, shadows.indexOf(block[block.length - 1]) + 1, copy.maps);
    return copy.gridId;
  };

  const actions = {
    addGrid: (pageId: string, columns: 1 | 2 | 3 | 4, at?: { beforeNodeId?: string | null }) =>
      onGridPage(pageId, (fields) => insertGrid(fields, setColumnCount([], columns), at?.beforeNodeId), true),

    addFieldToGrid: (
      pageId: string,
      fieldType: FieldType,
      fieldData: Partial<FieldData>,
      target: GridTarget
    ): string | undefined => {
      if (fieldType === FieldType.GRID_FIELD) {
        console.warn('A grid cannot be placed inside a grid');
        return undefined;
      }
      return onGridPage(pageId, (fields) => {
        const node = gridNodeOf(buildPageTree(shadowsOf(fields)), target.gridId);
        if (!node) return undefined;
        const column = clampColumn(target.column, node.columns.length);
        const field = createFormField(fieldType, { ...fieldData, gridId: node.grid.id, gridColumn: column });
        const before =
          target.beforeFieldId && node.columns[column].fields.some((f) => f.id === target.beforeFieldId)
            ? target.beforeFieldId
            : null;
        insertAt(
          fields,
          before ? rawIndexOf(fields, before) : columnEndIndex(fields, node.grid.id, column),
          [serializeFieldToYMap(field)]
        );
        return field.id;
      });
    },

    placeField: ({ pageId, fieldId, target }: { pageId: string; fieldId: string; target: PlaceTarget }): boolean =>
      onGridPage(pageId, (fields) => place(fields, fieldId, target)) ?? false,

    setGridColumnWidths: (pageId: string, gridId: string, widths: number[]): void => {
      onGridPage(pageId, (fields) => {
        const gridMap = fields.toArray().find((map) => map.get('id') === gridId && isLiveGridMap(map));
        if (!gridMap) return;
        const current = sanitizeGridColumnWidths(gridMap.get('columnWidths'));
        const next = sanitizeGridColumnWidths(widths, Array.isArray(widths) ? widths.length : current.length);
        const stored = gridMap.get('columnWidths');
        if (!Array.isArray(stored) || stored.length !== next.length || stored.some((w, i) => w !== next[i])) {
          gridMap.set('columnWidths', next);
        }
        // Children of removed columns join the last remaining one; flat order keeps their relative order
        fields.toArray().forEach((map) => {
          if (isDeletedMap(map) || map.get('type') === FieldType.GRID_FIELD || map.get('gridId') !== gridId) return;
          const column = Math.min(sanitizeGridColumn(map.get('gridColumn')) ?? 0, current.length - 1, next.length - 1);
          if ((map.get('gridColumn') ?? 0) !== column) map.set('gridColumn', column);
        });
      });
    },

    ungroupGrid: (pageId: string, gridId: string): void => {
      onGridPage(pageId, (fields) => {
        const shadows = shadowsOf(fields);
        const node = gridNodeOf(buildPageTree(shadows), gridId);
        if (!node) return;
        node.columns
          .flatMap((c) => c.fields)
          .forEach((child) => clearLayoutKeys(fields.get(shadows.indexOf(child))));
        fields.get(shadows.indexOf(node.grid)).set('deleted', true);
      });
    },

    removeGrid: (pageId: string, gridId: string, options: { deleteChildren: boolean }) =>
      onGridPage(pageId, (fields) => removeGridIn(fields, gridId, options.deleteChildren)),

    restoreGrid: (pageId: string, snapshot: GridSnapshot): boolean =>
      onGridPage(pageId, (fields) => {
        const ids = new Set(snapshot.fieldIds);
        const maps = fields.toArray().filter((map) => ids.has(map.get('id')));
        maps.filter(isDeletedMap).forEach((map) => map.set('deleted', false));
        return maps.length > 0;
      }) ?? false,

    duplicateGrid: (pageId: string, gridId: string) =>
      onGridPage(pageId, (fields) => duplicateGridIn(fields, gridId)),
  };

  /** §7.4 table: what each existing structural action does when `involvesGrid` is true. */
  const aware = {
    addField: (pageId: string, fieldType: FieldType, fieldData: Partial<FieldData> = {}): void => {
      onGridPage(
        pageId,
        (fields) => {
          if (fieldType === FieldType.GRID_FIELD) {
            insertGrid(fields, sanitizeGridColumnWidths(fieldData.columnWidths), null);
            return;
          }
          fields.push([serializeFieldToYMap(createFormField(fieldType, withoutLayout(fieldData)))]);
        },
        true
      );
    },

    addFieldAtIndex: (
      pageId: string,
      fieldType: FieldType,
      fieldData: Partial<FieldData>,
      insertIndex: number
    ): void => {
      onGridPage(
        pageId,
        (fields) => {
          // An index inside a grid block resolves to after the block (D11)
          const { beforeNodeId } = nodeAnchorForVisualIndex(shadowsOf(fields), Math.max(0, insertIndex));
          if (fieldType === FieldType.GRID_FIELD) {
            insertGrid(fields, sanitizeGridColumnWidths(fieldData.columnWidths), beforeNodeId);
            return;
          }
          insertBefore(fields, beforeNodeId, [
            serializeFieldToYMap(createFormField(fieldType, withoutLayout(fieldData))),
          ]);
        },
        true
      );
    },

    reorderFields: (pageId: string, oldIndex: number, newIndex: number): void => {
      onPages([pageId], ([pageMap]) => {
        const fields = fieldsOfPage(pageMap);
        if (!fields) return;
        // Indexes are the caller's view (storage order, live only): resolve them before canonicalizing
        const live = shadowsOf(fields).filter((s) => !s.deleted);
        const moved = live[oldIndex];
        const target = live[newIndex];
        if (!moved || !target) {
          console.warn(`Invalid field reorder indices: oldIndex=${oldIndex}, newIndex=${newIndex}`);
          return;
        }
        if (moved === target) return;
        canonicalAround([fields], () => {
          const placement = reorderTarget(
            shadowsOf(fields),
            moved.id,
            target.id,
            newIndex > oldIndex,
            Math.abs(newIndex - oldIndex) === 1
          );
          if (placement) place(fields, moved.id, placement);
        });
      });
    },

    moveFieldBetweenPages: (
      sourcePageId: string,
      targetPageId: string,
      fieldId: string,
      insertIndex?: number
    ): void => {
      if (sourcePageId === targetPageId) {
        console.warn('Cannot move field to same page - use reorderFields instead');
        return;
      }
      onPages([sourcePageId, targetPageId], ([sourcePage, targetPage]) => {
        const source = fieldsOfPage(sourcePage);
        const self = source ? shadowsOf(source).find((s) => s.id === fieldId) : undefined;
        if (!source || !self) {
          console.warn(`Field ${fieldId} not found in source page ${sourcePageId}`);
          return;
        }
        const target = ensureFieldsOf(targetPage);
        canonicalAround([source, target], () => {
          const shadows = shadowsOf(source);
          const field = shadows.find((s) => s.id === fieldId)!;
          // A grid takes all its children along, soft-deleted ones included, so none is left orphaned
          const taken = isLayoutField(field)
            ? [
                field,
                ...getGridChildren(shadows, field.id),
                ...shadows.filter((s) => s.deleted && !isLayoutField(s) && s.gridId === field.id),
              ]
            : [field];
          const takenMaps = taken.map((s) => source.get(shadows.indexOf(s)));
          const moved = takenMaps.map((map) =>
            isLayoutField(field) ? recreateFieldMap(map) : recreateFieldMap(map, clearLayout)
          );
          const { beforeNodeId } =
            insertIndex === undefined
              ? { beforeNodeId: null }
              : nodeAnchorForVisualIndex(shadowsOf(target), Math.max(0, insertIndex));
          takenMaps.forEach((map) => source.delete(source.toArray().indexOf(map), 1));
          insertBefore(target, beforeNodeId, moved);
        });
      });

      const { selectedFieldId, setSelection } = get() as any;
      if (selectedFieldId === fieldId) {
        setSelection({ kind: 'field', fieldId, pageId: targetPageId });
      }
    },

    copyFieldToPage: (sourcePageId: string, targetPageId: string, fieldId: string): void => {
      if (sourcePageId === targetPageId) {
        console.warn('Cannot copy field to same page - use duplicateField instead');
        return;
      }
      onPages([sourcePageId, targetPageId], ([sourcePage, targetPage]) => {
        const source = fieldsOfPage(sourcePage);
        if (!source || !shadowsOf(source).some((s) => s.id === fieldId)) {
          console.warn(`Field ${fieldId} not found in source page ${sourcePageId}`);
          return;
        }
        const target = ensureFieldsOf(targetPage);
        canonicalAround([source, target], () => {
          const shadows = shadowsOf(source);
          const field = shadows.find((s) => s.id === fieldId)!;
          if (isLayoutField(field)) {
            target.push(cloneGridBlock(source, shadows, field).maps);
            return;
          }
          target.push([
            recreateFieldMap(source.get(shadows.indexOf(field)), (data) => {
              data.id = generateUniqueId();
              data.label = `${data.label} (Copy)`;
              clearLayout(data);
            }),
          ]);
        });
      });
    },

    duplicateField: (pageId: string, fieldId: string): void => {
      onGridPage(pageId, (fields) => {
        const shadows = shadowsOf(fields);
        const field = shadows.find((s) => s.id === fieldId);
        if (!field) return;
        if (isLayoutField(field)) {
          duplicateGridIn(fields, field.id);
          return;
        }
        // A child's copy keeps its pointers, so it lands right after the original in the same column
        const copy = recreateFieldMap(fields.get(shadows.indexOf(field)), (data) => {
          data.id = generateUniqueId();
          data.label = `${data.label} (Copy)`;
        });
        insertAt(fields, shadows.indexOf(field) + 1, [copy]);
      });
    },

    removeField: (pageId: string, fieldId: string): boolean =>
      onGridPage(pageId, (fields) => {
        const index = rawIndexOf(fields, fieldId);
        if (index === -1) return false;
        if (isLiveGridMap(fields.get(index)) && removeGridIn(fields, fieldId, true)) return true;
        fields.get(index).set('deleted', true);
        return true;
      }) ?? false,

    restoreField: (pageId: string, field: FormField, index: number): boolean =>
      onGridPage(
        pageId,
        (fields) => {
          // A grid comes back alone; the undo toast uses restoreGrid to bring its children back too
          const existing = rawIndexOf(fields, field.id);
          if (existing !== -1) {
            fields.get(existing).set('deleted', false);
            return true;
          }
          const { beforeNodeId } = nodeAnchorForVisualIndex(shadowsOf(fields), Math.max(0, index));
          insertBefore(fields, beforeNodeId, [serializeFieldToYMap(field)]);
          return true;
        },
        true
      ) ?? false,

    convertFieldType: (pageId: string, fieldId: string, newType: FieldType): void => {
      let rejected = false;
      onPages([pageId], ([pageMap]) => {
        const fields = fieldsOfPage(pageMap);
        const map = fields?.toArray().find((m) => m.get('id') === fieldId);
        if (!fields || !map) return;
        if (map.get('type') === FieldType.GRID_FIELD || newType === FieldType.GRID_FIELD) {
          rejected = true;
          return;
        }
        // The existing body already keeps a child's pointers and flat position; run it inside this transaction
        canonicalAround([fields], () =>
          runDefaultPath(() => (get() as any).convertFieldType(pageId, fieldId, newType))
        );
      });
      if (rejected) {
        toastError('Cannot change this field type', 'A grid layout cannot be converted to another field type.');
      }
    },
  };

  return { actions, aware };
};
