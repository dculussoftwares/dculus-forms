import {
  pointerWithin,
  rectIntersection,
  type Collision,
  type CollisionDetection,
} from '@dnd-kit/core';

/** Droppable types registered by grid columns (§8.4). */
export const GRID_SLOT_DROPPABLE = 'grid-slot';
export const GRID_COLUMN_DROPPABLE = 'grid-column';

/** Higher wins when the pointer is over several targets: a slot inside a column beats the column body. */
export const GRID_DROP_PRIORITY = {
  [GRID_SLOT_DROPPABLE]: 2,
  [GRID_COLUMN_DROPPABLE]: 1,
} as const;

type DroppableLike = { id: unknown; data: { current?: Record<string, unknown> | null } };

const gridPriorityOf = (container: DroppableLike | undefined): number => {
  const type = container?.data.current?.type;
  if (type === GRID_SLOT_DROPPABLE) return GRID_DROP_PRIORITY[GRID_SLOT_DROPPABLE];
  if (type === GRID_COLUMN_DROPPABLE) return GRID_DROP_PRIORITY[GRID_COLUMN_DROPPABLE];
  return 0;
};

const isGridDroppable = (container: DroppableLike | undefined): boolean => gridPriorityOf(container) > 0;

/** Today's builder strategy: the thin `DropIndicator` gaps win via `pointerWithin`, with `rectIntersection` as a fallback. */
export const defaultBuilderCollision: CollisionDetection = (args) => {
  const pointerCollisions = pointerWithin(args);
  if (pointerCollisions.length > 0) return pointerCollisions;
  return rectIntersection(args);
};

/**
 * Wraps `base` for grid pages. With no enabled grid droppable registered it is `base` itself, so
 * grid-less pages behave exactly as before. Otherwise grid droppables under the pointer come first
 * (slot before column, then by distance) and the rect fallback never returns a grid droppable, which
 * would pick a column the pointer is outside of.
 */
export const createGridAwareCollision =
  (base: CollisionDetection = defaultBuilderCollision): CollisionDetection =>
  (args) => {
    if (!args.droppableContainers.some(isGridDroppable)) return base(args);

    const containerById = new Map(args.droppableContainers.map((c) => [c.id, c]));
    const hits = pointerWithin(args);
    if (hits.length > 0) {
      if (!hits.some((hit) => isGridDroppable(containerById.get(hit.id)))) return hits;
      // Stable sort: equal priorities keep pointerWithin's distance order
      return [...hits].sort(
        (a: Collision, b: Collision) =>
          gridPriorityOf(containerById.get(b.id)) - gridPriorityOf(containerById.get(a.id))
      );
    }
    return rectIntersection({
      ...args,
      droppableContainers: args.droppableContainers.filter((c) => !isGridDroppable(c)),
    });
  };
