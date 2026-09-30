import { describe, it, expect } from 'vitest';
import * as Y from 'yjs';
import {
  FieldType,
  FillableFormField,
  GridField,
  RichTextFormField,
  TextFieldValidation,
  TextInputField,
  deserializeFormField,
  deserializeFormSchema,
  serializeFormField,
  gridFieldValidationSchema,
  buildPageTree,
  canonicalizeFields,
  countQuestionFields,
  flattenPageTree,
  getGridChildren,
  isLayoutField,
  nodeAnchorForVisualIndex,
  pageHasGrid,
  resizeAdjacentColumns,
  sanitizeGridColumnWidths,
  setColumnCount,
  visibleColumns,
  type FormField,
  type PageNode,
} from '../index';

const text = (id: string, extra: Partial<FormField> = {}): FormField =>
  Object.assign(new TextInputField(id, id, '', '', '', '', new TextFieldValidation(false)), extra);
const grid = (id: string, widths = [50, 50], extra: Partial<FormField> = {}): GridField =>
  Object.assign(new GridField(id, widths), extra);
const ids = (fields: readonly FormField[]) => fields.map((f) => f.id);
const gridNode = (nodes: PageNode[], index = 0) => {
  const node = nodes[index];
  if (node.kind !== 'grid') throw new Error('expected a grid node');
  return node;
};

describe('GridField', () => {
  it('is a label-less, non-fillable layout field', () => {
    const g = new GridField('g1');
    expect(g.type).toBe(FieldType.GRID_FIELD);
    expect(g.columnWidths).toEqual([50, 50]);
    expect('label' in g).toBe(false);
    expect(g instanceof FillableFormField).toBe(false);
  });

  it('sanitizes its widths', () => {
    expect(new GridField('g', [60, 60]).columnWidths).toEqual([50, 50]);
    expect(new GridField('g', [30, 30, 40]).columnWidths).toEqual([30, 30, 40]);
  });
});

describe('isLayoutField / pageHasGrid', () => {
  it('recognises instances and plain JSON, and rejects everything else', () => {
    expect(isLayoutField(new GridField('g'))).toBe(true);
    expect(isLayoutField({ id: 'g', type: 'grid_field' })).toBe(true);
    expect(isLayoutField(text('a'))).toBe(false);
    expect(isLayoutField(new RichTextFormField('r'))).toBe(false);
    expect(isLayoutField(null)).toBe(false);
    expect(isLayoutField(undefined)).toBe(false);
    expect(isLayoutField('grid_field')).toBe(false);
  });

  it('pageHasGrid ignores deleted grids', () => {
    expect(pageHasGrid([text('a')])).toBe(false);
    expect(pageHasGrid([text('a'), grid('g')])).toBe(true);
    expect(pageHasGrid([text('a'), grid('g', [50, 50], { deleted: true })])).toBe(false);
  });
});

describe('sanitizeGridColumnWidths (I4)', () => {
  it('keeps valid widths', () => {
    expect(sanitizeGridColumnWidths([36, 30, 34])).toEqual([36, 30, 34]);
    expect(sanitizeGridColumnWidths([100])).toEqual([100]);
  });

  it('accepts a Y.Array', () => {
    const doc = new Y.Doc();
    const arr = doc.getArray<number>('w');
    arr.push([40, 60]);
    expect(sanitizeGridColumnWidths(arr)).toEqual([40, 60]);
  });

  it.each([
    ['sum is not 100', [50, 40], [50, 50]],
    ['a column is under the minimum', [95, 5], [50, 50]],
    ['non-integer', [33.3, 66.7], [50, 50]],
    ['non-numbers', ['50', '50'], [50, 50]],
    ['three bad columns keep their count', [40, 40, 40], [34, 33, 33]],
  ])('falls back to an equal split when %s', (_name, input, expected) => {
    expect(sanitizeGridColumnWidths(input)).toEqual(expected);
  });

  it.each([undefined, null, 'x', 42, {}, [], [10, 10, 10, 10, 10, 50]])(
    'falls back to the default column count for %j',
    (input) => {
      expect(sanitizeGridColumnWidths(input)).toEqual([50, 50]);
    }
  );

  it('honours fallbackCount, clamped to 1..4', () => {
    expect(sanitizeGridColumnWidths(undefined, 3)).toEqual([34, 33, 33]);
    expect(sanitizeGridColumnWidths(undefined, 4)).toEqual([25, 25, 25, 25]);
    expect(sanitizeGridColumnWidths(undefined, 9)).toEqual([25, 25, 25, 25]);
    expect(sanitizeGridColumnWidths(undefined, 0)).toEqual([100]);
  });
});

describe('deserializeFormField layout pointers', () => {
  const samples: Record<string, Record<string, unknown>> = {
    text_input_field: {},
    text_area_field: {},
    email_field: {},
    number_field: {},
    date_field: {},
    select_field: { options: ['a'] },
    radio_field: { options: ['a'] },
    checkbox_field: { options: ['a'] },
    file_upload_field: {},
    phone_number_field: {},
    rich_text_field: { content: '<p>x</p>' },
  };

  it.each(Object.keys(samples))('keeps gridId/gridColumn on %s', (type) => {
    const field = deserializeFormField({
      id: 'f',
      type,
      label: 'L',
      ...samples[type],
      gridId: 'g1',
      gridColumn: 1,
    })!;
    expect(field.gridId).toBe('g1');
    expect(field.gridColumn).toBe(1);
  });

  it.each(Object.keys(samples))('adds no own layout keys to %s without a grid (R2)', (type) => {
    const field = deserializeFormField({ id: 'f', type, label: 'L', ...samples[type] })!;
    expect(Object.keys(field)).not.toContain('gridId');
    expect(Object.keys(field)).not.toContain('gridColumn');
    expect(Object.keys(serializeFormField(field))).not.toContain('gridId');
  });

  it('drops invalid pointers', () => {
    const base = { id: 'f', type: 'text_input_field', label: 'L' };
    expect(deserializeFormField({ ...base, gridId: '' })!.gridId).toBeUndefined();
    expect(deserializeFormField({ ...base, gridId: 'x'.repeat(65) })!.gridId).toBeUndefined();
    expect(deserializeFormField({ ...base, gridId: 7 })!.gridId).toBeUndefined();
    // a stray column without a grid is not kept
    expect(deserializeFormField({ ...base, gridColumn: 1 })!.gridColumn).toBeUndefined();

    for (const gridColumn of [-1, 1.5, '1', null]) {
      const field = deserializeFormField({ ...base, gridId: 'g1', gridColumn })!;
      expect(field.gridId).toBe('g1');
      expect(field.gridColumn).toBeUndefined();
    }
  });

  it('accepts a 64 character gridId', () => {
    const gridId = 'g'.repeat(64);
    expect(deserializeFormField({ id: 'f', type: 'text_input_field', gridId })!.gridId).toBe(gridId);
  });

  it('round-trips through serializeFormField', () => {
    const field = deserializeFormField({ id: 'f', type: 'text_input_field', gridId: 'g1', gridColumn: 2 })!;
    const again = deserializeFormField(serializeFormField(field))!;
    expect([again.gridId, again.gridColumn]).toEqual(['g1', 2]);
  });

  it('builds a GridField, ignores gridId on it (I1) and repairs bad widths', () => {
    const g = deserializeFormField({
      id: 'g',
      type: 'grid_field',
      columnWidths: [30, 30, 40],
      gridId: 'other',
    }) as GridField;
    expect(g).toBeInstanceOf(GridField);
    expect(g.columnWidths).toEqual([30, 30, 40]);
    expect(g.gridId).toBeUndefined();

    expect((deserializeFormField({ id: 'g', type: 'grid_field' }) as GridField).columnWidths).toEqual([50, 50]);
    expect(
      (deserializeFormField({ id: 'g', type: 'grid_field', columnWidths: [1, 2, 3] }) as GridField).columnWidths
    ).toEqual([34, 33, 33]);
  });

  it('round-trips a grid', () => {
    const again = deserializeFormField(serializeFormField(grid('g', [25, 75]))) as GridField;
    expect(again.columnWidths).toEqual([25, 75]);
  });
});

describe('buildPageTree (I1-I3)', () => {
  it('returns one field node per live field on a page without a grid', () => {
    const nodes = buildPageTree([text('a'), text('b', { deleted: true }), text('c')]);
    expect(nodes.map((n) => n.kind)).toEqual(['field', 'field']);
    expect(nodes.map((n) => (n.kind === 'field' ? n.field.id : ''))).toEqual(['a', 'c']);
  });

  it('groups children into columns in relative order', () => {
    const nodes = buildPageTree([
      text('top'),
      grid('g', [30, 70]),
      text('a', { gridId: 'g', gridColumn: 0 }),
      text('c', { gridId: 'g', gridColumn: 1 }),
      text('b', { gridId: 'g', gridColumn: 0 }),
      text('after'),
    ]);
    expect(nodes).toHaveLength(3);
    const g = gridNode(nodes, 1);
    expect(g.columns.map((c) => [c.widthPercent, ids(c.fields)])).toEqual([
      [30, ['a', 'b']],
      [70, ['c']],
    ]);
  });

  it('groups by pointer even when a child is stored before its grid', () => {
    const nodes = buildPageTree([text('a', { gridId: 'g' }), grid('g'), text('b')]);
    expect(nodes).toHaveLength(2);
    expect(ids(gridNode(nodes, 0).columns[0].fields)).toEqual(['a']);
  });

  it('treats a missing column as column 0 and clamps an out-of-range one (I3)', () => {
    const g = gridNode(
      buildPageTree([
        grid('g', [50, 50]),
        text('a', { gridId: 'g' }),
        text('b', { gridId: 'g', gridColumn: 9 }),
      ])
    );
    expect(g.columns.map((c) => ids(c.fields))).toEqual([['a'], ['b']]);
  });

  it('lifts children of a deleted grid to the top level (I2)', () => {
    const nodes = buildPageTree([grid('g', [50, 50], { deleted: true }), text('a', { gridId: 'g' })]);
    expect(nodes.map((n) => n.kind)).toEqual(['field']);
  });

  it.each([
    ['unknown grid id', 'missing'],
    ['a non-grid id', 'plain'],
  ])('treats a child pointing at %s as top level (I2)', (_n, gridId) => {
    const nodes = buildPageTree([text('plain'), text('a', { gridId })]);
    expect(nodes.every((n) => n.kind === 'field')).toBe(true);
  });

  it('drops deleted children', () => {
    const g = gridNode(buildPageTree([grid('g'), text('a', { gridId: 'g', deleted: true })]));
    expect(g.columns.every((c) => c.fields.length === 0)).toBe(true);
  });

  it('never nests a grid (I1)', () => {
    const nodes = buildPageTree([grid('outer'), grid('inner', [50, 50], { gridId: 'outer' })]);
    expect(nodes.map((n) => n.kind)).toEqual(['grid', 'grid']);
    expect(gridNode(nodes, 0).columns.every((c) => c.fields.length === 0)).toBe(true);
  });

  it('does not mutate its input', () => {
    const fields = [text('a', { gridId: 'g' }), grid('g')];
    const before = JSON.stringify(fields);
    buildPageTree(fields);
    expect(JSON.stringify(fields)).toBe(before);
  });
});

describe('canonicalizeFields (I5)', () => {
  it('returns the same array for a page without a grid', () => {
    const fields = [text('a'), text('b')];
    expect(canonicalizeFields(fields)).toBe(fields);
  });

  it('returns the same array when already canonical', () => {
    const fields = [text('top'), grid('g'), text('a', { gridId: 'g', gridColumn: 0 }), text('b', { gridId: 'g', gridColumn: 1 })];
    expect(canonicalizeFields(fields)).toBe(fields);
  });

  it('moves children behind their grid, ordered by column then previous order', () => {
    const fields = [
      text('c1', { gridId: 'g', gridColumn: 1 }),
      text('top'),
      grid('g'),
      text('a1', { gridId: 'g', gridColumn: 0 }),
      text('mid'),
      text('c2', { gridId: 'g', gridColumn: 1 }),
      text('a2', { gridId: 'g', gridColumn: 0 }),
    ];
    const result = canonicalizeFields(fields);
    expect(ids(result)).toEqual(['top', 'g', 'a1', 'a2', 'c1', 'c2', 'mid']);
    expect(ids(canonicalizeFields(result))).toEqual(ids(result));
    expect(canonicalizeFields(result)).toBe(result);
  });

  it('keeps deleted fields at their relative spot and does not attach them', () => {
    const fields = [
      text('gone', { deleted: true, gridId: 'g' }),
      grid('g'),
      text('a', { gridId: 'g' }),
      text('after'),
    ];
    expect(ids(canonicalizeFields(fields))).toEqual(['gone', 'g', 'a', 'after']);
  });

  it('leaves children of a deleted grid where they are', () => {
    const fields = [text('a', { gridId: 'g' }), grid('g', [50, 50], { deleted: true }), text('b')];
    expect(canonicalizeFields(fields)).toBe(fields);
  });

  it('keeps every field exactly once', () => {
    const fields = [text('b', { gridId: 'g' }), grid('g'), text('a'), text('gone', { deleted: true })];
    expect(ids(canonicalizeFields(fields)).sort()).toEqual(ids(fields).sort());
  });
});

describe('flattenPageTree', () => {
  it('emits a grid followed by its children in column order', () => {
    const tree = buildPageTree([
      text('top'),
      grid('g'),
      text('b', { gridId: 'g', gridColumn: 1 }),
      text('a', { gridId: 'g', gridColumn: 0 }),
    ]);
    expect(ids(flattenPageTree(tree))).toEqual(['top', 'g', 'a', 'b']);
  });
});

describe('getGridChildren / countQuestionFields', () => {
  const fields = [
    grid('g'),
    text('a', { gridId: 'g' }),
    text('gone', { gridId: 'g', deleted: true }),
    new RichTextFormField('r'),
    text('x'),
  ];

  it('lists live children of a live grid', () => {
    expect(ids(getGridChildren(fields, 'g'))).toEqual(['a']);
    expect(getGridChildren(fields, 'x')).toEqual([]);
    expect(getGridChildren([grid('g', [50, 50], { deleted: true }), text('a', { gridId: 'g' })], 'g')).toEqual([]);
  });

  it('counts questions only: no grids, no deleted, rich text still counted', () => {
    expect(countQuestionFields(fields)).toBe(3);
  });
});

describe('nodeAnchorForVisualIndex', () => {
  const fields = [
    text('a'),
    grid('g'),
    text('c1', { gridId: 'g', gridColumn: 0 }),
    text('c2', { gridId: 'g', gridColumn: 1 }),
    text('z'),
  ];

  it('anchors before the node at the index', () => {
    expect(nodeAnchorForVisualIndex(fields, 0)).toEqual({ beforeNodeId: 'a' });
    expect(nodeAnchorForVisualIndex(fields, 1)).toEqual({ beforeNodeId: 'g' });
  });

  it('puts an index inside a grid block after the block (D11)', () => {
    expect(nodeAnchorForVisualIndex(fields, 2)).toEqual({ beforeNodeId: 'z' });
    expect(nodeAnchorForVisualIndex(fields, 3)).toEqual({ beforeNodeId: 'z' });
  });

  it('anchors to the end when past the last node or inside a trailing grid', () => {
    expect(nodeAnchorForVisualIndex(fields, 4)).toEqual({ beforeNodeId: 'z' });
    expect(nodeAnchorForVisualIndex(fields, 5)).toEqual({ beforeNodeId: null });
    expect(nodeAnchorForVisualIndex([grid('g'), text('c', { gridId: 'g' })], 1)).toEqual({ beforeNodeId: null });
    expect(nodeAnchorForVisualIndex([], 0)).toEqual({ beforeNodeId: null });
  });
});

describe('resizeAdjacentColumns', () => {
  it('trades width between neighbours', () => {
    expect(resizeAdjacentColumns([50, 50], 0, 10)).toEqual([60, 40]);
    expect(resizeAdjacentColumns([30, 30, 40], 1, -10)).toEqual([30, 20, 50]);
  });

  it('clamps at the minimum and keeps the sum at 100', () => {
    expect(resizeAdjacentColumns([50, 50], 0, 80)).toEqual([90, 10]);
    expect(resizeAdjacentColumns([50, 50], 0, -80)).toEqual([10, 90]);
  });

  it('rounds the delta to a whole percent', () => {
    expect(resizeAdjacentColumns([50, 50], 0, 2.6)).toEqual([53, 47]);
  });

  it('ignores an invalid divider and repairs bad input', () => {
    expect(resizeAdjacentColumns([50, 50], 1, 10)).toEqual([50, 50]);
    expect(resizeAdjacentColumns([50, 50], -1, 10)).toEqual([50, 50]);
    expect(resizeAdjacentColumns([70, 70], 0, 10)).toEqual([60, 40]);
  });

  it('does not mutate its input', () => {
    const widths = [50, 50];
    resizeAdjacentColumns(widths, 0, 10);
    expect(widths).toEqual([50, 50]);
  });
});

describe('setColumnCount', () => {
  it('keeps widths when the count is unchanged', () => {
    expect(setColumnCount([30, 70], 2)).toEqual([30, 70]);
  });

  it('equalizes on a change and clamps to 1..4', () => {
    expect(setColumnCount([30, 70], 3)).toEqual([34, 33, 33]);
    expect(setColumnCount([30, 70], 1)).toEqual([100]);
    expect(setColumnCount([30, 70], 12)).toEqual([25, 25, 25, 25]);
    expect(setColumnCount([30, 70], 0)).toEqual([100]);
  });
});

describe('visibleColumns (D4)', () => {
  const g = gridNode(
    buildPageTree([
      grid('g', [40, 30, 30]),
      text('a', { gridId: 'g', gridColumn: 0 }),
      text('b', { gridId: 'g', gridColumn: 1 }),
      text('c', { gridId: 'g', gridColumn: 2 }),
    ])
  );

  it('returns every column when nothing is hidden', () => {
    expect(visibleColumns(g).map((c) => c.widthPercent)).toEqual([40, 30, 30]);
  });

  it('drops empty columns and renormalizes to 100', () => {
    const cols = visibleColumns(g, new Set(['b']));
    expect(cols.map((c) => ids(c.fields))).toEqual([['a'], ['c']]);
    expect(cols.map((c) => c.widthPercent)).toEqual([57, 43]);
    expect(cols.reduce((s, c) => s + c.widthPercent, 0)).toBe(100);
  });

  it('gives a lone column the full width and an empty grid nothing', () => {
    expect(visibleColumns(g, new Set(['a', 'b'])).map((c) => c.widthPercent)).toEqual([100]);
    expect(visibleColumns(g, new Set(['a', 'b', 'c']))).toEqual([]);
  });
});

describe('deserializeFormSchema', () => {
  const raw = (fields: unknown[]) => ({ pages: [{ id: 'p', title: 'P', order: 0, fields }], layout: {} });

  it('canonicalizes a page with a grid', () => {
    const schema = deserializeFormSchema(
      raw([
        { id: 'c', type: 'text_input_field', label: 'C', gridId: 'g', gridColumn: 1 },
        { id: 'g', type: 'grid_field', columnWidths: [50, 50] },
        { id: 'a', type: 'text_input_field', label: 'A', gridId: 'g', gridColumn: 0 },
      ])
    );
    expect(ids(schema.pages[0].fields)).toEqual(['g', 'a', 'c']);
  });

  it('keeps the order of a page without a grid', () => {
    const schema = deserializeFormSchema(
      raw([
        { id: 'b', type: 'text_input_field', label: 'B' },
        { id: 'a', type: 'text_input_field', label: 'A' },
      ])
    );
    expect(ids(schema.pages[0].fields)).toEqual(['b', 'a']);
  });

  it('keeps the deleted flag on grid children', () => {
    const schema = deserializeFormSchema(
      raw([
        { id: 'g', type: 'grid_field' },
        { id: 'a', type: 'text_input_field', label: 'A', gridId: 'g', deleted: true },
      ])
    );
    expect(schema.pages[0].fields[1].deleted).toBe(true);
  });
});

describe('gridFieldValidationSchema', () => {
  const parse = (columnWidths: unknown) => gridFieldValidationSchema.safeParse({ columnWidths });

  it('accepts what sanitizeGridColumnWidths keeps', () => {
    for (const widths of [[100], [50, 50], [36, 30, 34], [25, 25, 25, 25], [10, 90]]) {
      expect(parse(widths).success).toBe(true);
      expect(sanitizeGridColumnWidths(widths)).toEqual(widths);
    }
  });

  it('rejects what sanitizeGridColumnWidths would silently replace', () => {
    for (const widths of [[5, 95], [50, 40], [], [20, 20, 20, 20, 20], [33.3, 66.7], [60, 60]]) {
      expect(parse(widths).success).toBe(false);
      expect(sanitizeGridColumnWidths(widths)).not.toEqual(widths);
    }
  });

  it('defaults to two equal columns', () => {
    expect(gridFieldValidationSchema.parse({}).columnWidths).toEqual([50, 50]);
  });
});
