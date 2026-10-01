import {
  pointerWithin,
  rectIntersection,
  type ClientRect,
  type CollisionDetection,
} from '@dnd-kit/core';
import { createGridAwareCollision, defaultBuilderCollision } from '../gridCollision';

type Args = Parameters<CollisionDetection>[0];

const rect = (left: number, top: number, width: number, height: number): ClientRect => ({
  left,
  top,
  width,
  height,
  right: left + width,
  bottom: top + height,
});

const container = (id: string, data: Record<string, unknown>, r: ClientRect) => ({
  id,
  key: id,
  data: { current: data },
  disabled: false,
  node: { current: null },
  rect: { current: r },
});

const argsFor = (
  droppables: Array<{ id: string; data: Record<string, unknown>; rect: ClientRect }>,
  pointer: { x: number; y: number } | null,
  collisionRect: ClientRect = rect(pointer?.x ?? 0, pointer?.y ?? 0, 40, 20)
): Args =>
  ({
    active: { id: 'active', data: { current: {} }, rect: { current: { initial: null, translated: null } } },
    collisionRect,
    droppableRects: new Map(droppables.map((d) => [d.id, d.rect])),
    droppableContainers: droppables.map((d) => container(d.id, d.data, d.rect)),
    pointerCoordinates: pointer,
  }) as unknown as Args;

/** The builder's collision function before grids, verbatim. */
const previousStrategy: CollisionDetection = (args) => {
  const pointerCollisions = pointerWithin(args);
  if (pointerCollisions.length > 0) return pointerCollisions;
  return rectIntersection(args);
};

const gridLessDroppables = [
  { id: 'form-area', data: { type: 'form-area', pageId: 'p1' }, rect: rect(0, 0, 600, 800) },
  { id: 'drop-indicator-p1-0', data: { type: 'field-insert', pageId: 'p1', insertIndex: 0 }, rect: rect(0, 0, 600, 8) },
  { id: 'drop-indicator-p1-1', data: { type: 'field-insert', pageId: 'p1', insertIndex: 1 }, rect: rect(0, 100, 600, 8) },
  { id: 'rail-drop-p1-0', data: { type: 'field-insert', pageId: 'p1', insertIndex: 0 }, rect: rect(-200, 0, 180, 6) },
];

describe('createGridAwareCollision', () => {
  const gridAware = createGridAwareCollision();

  it.each([
    ['pointer on an insert gap', { x: 10, y: 103 }],
    ['pointer on a card (only the form area)', { x: 10, y: 50 }],
    ['pointer outside every droppable (rect fallback)', { x: 700, y: 900 }],
    ['no pointer coordinates (keyboard drag)', null],
  ])('equals the previous strategy without grid droppables: %s', (_label, pointer) => {
    const args = argsFor(gridLessDroppables, pointer);
    expect(gridAware(args)).toEqual(previousStrategy(args));
    expect(defaultBuilderCollision(args)).toEqual(previousStrategy(args));
  });

  const gridDroppables = [
    ...gridLessDroppables,
    {
      id: 'grid-column-g1-0',
      data: { type: 'grid-column', pageId: 'p1', gridId: 'g1', column: 0, priority: 1 },
      rect: rect(0, 200, 290, 200),
    },
    {
      id: 'grid-slot-g1-0-0',
      data: { type: 'grid-slot', pageId: 'p1', gridId: 'g1', column: 0, beforeFieldId: null, priority: 2 },
      rect: rect(0, 200, 290, 24),
    },
  ];

  it('prefers a column slot over the column and the form area', () => {
    const hits = gridAware(argsFor(gridDroppables, { x: 20, y: 210 }));
    expect(hits.map((h) => h.id)).toEqual(['grid-slot-g1-0-0', 'grid-column-g1-0', 'form-area']);
  });

  it('ranks by priority even when a lower-priority target is closer to the pointer', () => {
    const pointer = { x: 20, y: 350 };
    const droppables = [
      // A small form-area-like target hugging the pointer: closest by corner distance
      { id: 'near-insert', data: { type: 'field-insert', pageId: 'p1', insertIndex: 3 }, rect: rect(10, 345, 20, 10) },
      gridDroppables.find((d) => d.id === 'grid-column-g1-0')!,
      { id: 'grid-slot-g1-0-1', data: { type: 'grid-slot', pageId: 'p1', gridId: 'g1', column: 0, beforeFieldId: null, priority: 2 }, rect: rect(0, 300, 290, 120) },
    ];
    const args = argsFor(droppables, pointer);
    expect(pointerWithin(args)[0].id).toBe('near-insert');
    expect(gridAware(args).map((h) => h.id)).toEqual(['grid-slot-g1-0-1', 'grid-column-g1-0', 'near-insert']);
  });

  it('prefers the column body over the form area when no slot is under the pointer', () => {
    const hits = gridAware(argsFor(gridDroppables, { x: 20, y: 350 }));
    expect(hits[0].id).toBe('grid-column-g1-0');
  });

  it('leaves pointer hits untouched when none of them is a grid droppable', () => {
    const args = argsFor(gridDroppables, { x: 10, y: 103 });
    expect(gridAware(args)).toEqual(pointerWithin(args));
  });

  it('never returns a grid droppable from the rect fallback', () => {
    // Pointer outside everything, but the drag rect overlaps the column
    const args = argsFor(gridDroppables, { x: 900, y: 900 }, rect(250, 220, 100, 50));
    const hits = gridAware(args);
    expect(hits.some((h) => String(h.id).startsWith('grid-'))).toBe(false);
    expect(rectIntersection(args).some((h) => String(h.id).startsWith('grid-'))).toBe(true);
  });
});
