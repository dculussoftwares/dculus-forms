/**
 * Screen-reader announcements for drags on a form that holds a grid (docs/grid-layout-strategy.md §8.4
 * rule 9): a drop target inside a grid is announced as "column N of M". Grid-less forms keep
 * dnd-kit's default announcements.
 */
import type { Active, Announcements, Over } from '@dnd-kit/core';
import { sanitizeGridColumnWidths, type FormPage } from '@dculus/types';
import { GRID_COLUMN_DROPPABLE, GRID_SLOT_DROPPABLE } from './gridCollision';

type Translate = (key: string, options?: { values?: Record<string, string | number> }) => string;

const labelOf = (active: Active, t: Translate): string => {
  const data = active.data.current;
  const label = data?.field?.label ?? data?.fieldType?.label;
  return typeof label === 'string' && label.trim() ? label : t('dnd.item');
};

/** The 1-based column and the column count when `over` is a grid column or a slot in one. */
const columnOf = (over: Over | null, pages: readonly FormPage[]) => {
  const data = over?.data.current;
  if (data?.type !== GRID_SLOT_DROPPABLE && data?.type !== GRID_COLUMN_DROPPABLE) return undefined;
  const grid = pages.flatMap((page) => page.fields).find((field) => field.id === data.gridId);
  if (!grid) return undefined;
  const total = sanitizeGridColumnWidths((grid as { columnWidths?: unknown }).columnWidths).length;
  return { column: (data.column as number) + 1, total };
};

export const createGridAnnouncements = (
  t: Translate,
  getPages: () => readonly FormPage[]
): Announcements => ({
  onDragStart: ({ active }) => t('dnd.picked', { values: { label: labelOf(active, t) } }),
  onDragOver: ({ active, over }) => {
    const label = labelOf(active, t);
    if (!over) return t('dnd.notOver', { values: { label } });
    const place = columnOf(over, getPages());
    return place
      ? t('dnd.overColumn', { values: { label, ...place } })
      : t('dnd.overPage', { values: { label } });
  },
  onDragEnd: ({ active, over }) => {
    const label = labelOf(active, t);
    if (!over) return t('dnd.cancelled', { values: { label } });
    const place = columnOf(over, getPages());
    return place
      ? t('dnd.droppedColumn', { values: { label, ...place } })
      : t('dnd.dropped', { values: { label } });
  },
  onDragCancel: ({ active }) => t('dnd.cancelled', { values: { label: labelOf(active, t) } }),
});
