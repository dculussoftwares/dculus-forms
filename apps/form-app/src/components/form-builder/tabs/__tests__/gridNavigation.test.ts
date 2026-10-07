import { GridField, TextInputField, FillableFormFieldValidation, type FormField } from '@dculus/types';
import { adjacentColumnTarget, horizontalNeighbour, verticalNeighbour } from '../gridNavigation';

jest.unmock('@dculus/types');

const text = (id: string, gridId?: string, gridColumn?: number): FormField =>
  Object.assign(new TextInputField(id, id, '', '', '', '', new FillableFormFieldValidation(false)), {
    gridId,
    gridColumn,
  });

// Storage order is deliberately not canonical: navigation must follow the layout tree
const fields: FormField[] = [
  text('top'),
  new GridField('g', [40, 30, 30]),
  text('b1', 'g', 1),
  text('a1', 'g', 0),
  text('a2', 'g', 0),
  text('a3', 'g', 0),
  text('bottom'),
];

describe('verticalNeighbour', () => {
  it('walks grid header, column 0, column 1, then the next node', () => {
    const order: string[] = ['top'];
    let id: string | undefined = 'top';
    while ((id = verticalNeighbour(fields, id, 1))) order.push(id);
    expect(order).toEqual(['top', 'g', 'a1', 'a2', 'a3', 'b1', 'bottom']);
  });

  it('walks backwards and stops at the ends', () => {
    expect(verticalNeighbour(fields, 'b1', -1)).toBe('a3');
    expect(verticalNeighbour(fields, 'top', -1)).toBeUndefined();
    expect(verticalNeighbour(fields, 'bottom', 1)).toBeUndefined();
    expect(verticalNeighbour(fields, 'missing', 1)).toBeUndefined();
  });
});

describe('horizontalNeighbour', () => {
  it('keeps the row, clamped to the shorter column', () => {
    expect(horizontalNeighbour(fields, 'a1', 1)).toBe('b1');
    expect(horizontalNeighbour(fields, 'a3', 1)).toBe('b1');
    expect(horizontalNeighbour(fields, 'b1', -1)).toBe('a1');
  });

  it('skips empty columns, edges and top-level fields', () => {
    expect(horizontalNeighbour(fields, 'b1', 1)).toBeUndefined(); // column 2 is empty
    expect(horizontalNeighbour(fields, 'a1', -1)).toBeUndefined();
    expect(horizontalNeighbour(fields, 'top', 1)).toBeUndefined();
  });
});

describe('adjacentColumnTarget', () => {
  it('targets the same row of the next column, or its end', () => {
    expect(adjacentColumnTarget(fields, 'a1', 1)).toEqual({ gridId: 'g', column: 1, beforeFieldId: 'b1' });
    expect(adjacentColumnTarget(fields, 'a2', 1)).toEqual({ gridId: 'g', column: 1, beforeFieldId: null });
    expect(adjacentColumnTarget(fields, 'b1', 1)).toEqual({ gridId: 'g', column: 2, beforeFieldId: null });
  });

  it('has no target past the edge or outside a grid', () => {
    expect(adjacentColumnTarget(fields, 'a1', -1)).toBeUndefined();
    expect(adjacentColumnTarget(fields, 'top', 1)).toBeUndefined();
  });
});
