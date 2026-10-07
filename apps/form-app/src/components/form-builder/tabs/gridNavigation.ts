/**
 * Keyboard navigation over a page that holds grids (docs/grid-layout-strategy.md §8.7).
 *
 * Pure helpers over `page.fields`: they derive the layout tree with `buildPageTree`, so they never
 * depend on storage order. Callers only use them on pages where `pageHasGrid` is true.
 */
import { buildPageTree, flattenPageTree, type FormField, type PageNode } from '@dculus/types';
import type { GridTarget } from '../../../store/types/store.types';

export type Step = -1 | 1;

type GridNode = Extract<PageNode, { kind: 'grid' }>;

interface GridLocation {
  node: GridNode;
  column: number;
  row: number;
}

const locateInGrid = (nodes: readonly PageNode[], fieldId: string): GridLocation | undefined => {
  for (const node of nodes) {
    if (node.kind !== 'grid') continue;
    for (const column of node.columns) {
      const row = column.fields.findIndex((f) => f.id === fieldId);
      if (row !== -1) return { node, column: column.index, row };
    }
  }
  return undefined;
};

/** Next id in reading order: grid header, then column 0 top to bottom, then column 1, then the next node. */
export const verticalNeighbour = (
  fields: readonly FormField[],
  fieldId: string,
  step: Step
): string | undefined => {
  const order = flattenPageTree(buildPageTree(fields));
  const index = order.findIndex((f) => f.id === fieldId);
  return index === -1 ? undefined : order[index + step]?.id;
};

/** Same row in the adjacent column (clamped to its last field); undefined outside a grid or at an edge. */
export const horizontalNeighbour = (
  fields: readonly FormField[],
  fieldId: string,
  step: Step
): string | undefined => {
  const location = locateInGrid(buildPageTree(fields), fieldId);
  const target = location?.node.columns[location.column + step];
  if (!location || !target || target.fields.length === 0) return undefined;
  return target.fields[Math.min(location.row, target.fields.length - 1)].id;
};

/** Where Alt+←/→ moves a grid child: the same row of the adjacent column, or its end. */
export const adjacentColumnTarget = (
  fields: readonly FormField[],
  fieldId: string,
  step: Step
): GridTarget | undefined => {
  const location = locateInGrid(buildPageTree(fields), fieldId);
  const target = location?.node.columns[location.column + step];
  if (!location || !target) return undefined;
  return {
    gridId: location.node.grid.id,
    column: target.index,
    beforeFieldId: target.fields[location.row]?.id ?? null,
  };
};
