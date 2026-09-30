/**
 * Grid Layout Phase 3a: grid-aware store actions (docs/grid-layout-strategy.md §7.4 and the
 * store rows of the §16 action matrix). Runs against a real Y.Doc.
 */
jest.unmock('@dculus/types');
jest.unmock('zustand');
jest.mock('../../../lib/config', () => ({ getWebSocketUrl: () => '' }));
jest.mock('../../../lib/auth-client', () => ({ getBearerToken: () => '' }));
jest.mock('@dculus/ui', () => ({ toastError: jest.fn() }));

import * as Y from 'yjs';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { create } = require('zustand') as typeof import('zustand');
import { toastError } from '@dculus/ui';
import {
  FieldType,
  TextFieldValidation,
  TextInputField,
  buildPageTree,
  canonicalizeFields,
  deserializeFormField,
  type FormField,
} from '@dculus/types';
import { createYJSFieldMap } from '../../helpers/fieldHelpers';
import { extractFieldData, type FieldData } from '../../collaboration/CollaborationManager';
import { createFieldsSlice } from '../fieldsSlice';
import { createPagesSlice } from '../pagesSlice';
import { involvesGrid } from '../gridActions';

const q = (id: string, extra: Partial<FieldData> = {}): FieldData => ({
  id,
  type: FieldType.TEXT_INPUT_FIELD,
  label: id,
  required: false,
  placeholder: '',
  defaultValue: '',
  prefix: '',
  hint: '',
  ...extra,
});
const gridData = (id: string, widths = [50, 50]): FieldData => ({ id, type: FieldType.GRID_FIELD, columnWidths: widths });

function seed(pages: Record<string, FieldData[]>) {
  const ydoc = new Y.Doc();
  const pagesArray = new Y.Array<Y.Map<any>>();
  ydoc.getMap('formSchema').set('pages', pagesArray);
  Object.entries(pages).forEach(([id, fields], order) => {
    const pageMap = new Y.Map();
    pageMap.set('id', id);
    pageMap.set('title', id);
    pageMap.set('order', order);
    const fieldsArray = new Y.Array<Y.Map<any>>();
    fields.forEach((f) => fieldsArray.push([createYJSFieldMap(f)]));
    pageMap.set('fields', fieldsArray);
    pagesArray.push([pageMap]);
  });

  const store = create<any>()((set, get) => ({
    _getYDoc: () => ydoc,
    _isYJSReady: () => true,
    selectedFieldId: null,
    setSelection: jest.fn(),
    setSelectedPage: () => undefined,
    ...createFieldsSlice(set, get),
    ...createPagesSlice(set, get),
    pages: Object.keys(pages).map((id) => ({ id })),
  }));

  const fieldsOf = (pageId: string): Y.Array<Y.Map<any>> =>
    pagesArray.toArray().find((p) => p.get('id') === pageId)!.get('fields');
  const data = (pageId: string) => fieldsOf(pageId).toArray().map((m) => extractFieldData(m));
  const live = (pageId: string) => data(pageId).filter((f) => !f.deleted);
  const ids = (pageId: string) => live(pageId).map((f) => f.id);
  const byId = (pageId: string, id: string) => data(pageId).find((f) => f.id === id);
  const fields = (pageId: string): FormField[] =>
    data(pageId).map((d) => {
      const field = deserializeFormField(d)!;
      if (d.deleted) field.deleted = true;
      return field;
    });
  /** Column contents per grid, as the renderer would see them. */
  const layout = (pageId: string) =>
    buildPageTree(fields(pageId)).map((node) =>
      node.kind === 'field' ? node.field.id : { [node.grid.id]: node.columns.map((c) => c.fields.map((f) => f.id)) }
    );
  const isCanonical = (pageId: string) => canonicalizeFields(fields(pageId)) === undefined || ids(pageId).join() === canonicalizeFields(fields(pageId)).filter((f) => !f.deleted).map((f) => f.id).join();

  return { ydoc, store, act: () => store.getState(), data, live, ids, byId, layout, isCanonical };
}

// page p1: top, [g1: col0 a,b | col1 c], bottom ; page p2: x ; page p3: empty-ish, no grid
const standard = () =>
  seed({
    p1: [
      q('top'),
      gridData('g1'),
      q('a', { gridId: 'g1', gridColumn: 0 }),
      q('b', { gridId: 'g1', gridColumn: 0 }),
      q('c', { gridId: 'g1', gridColumn: 1 }),
      q('bottom'),
    ],
    p2: [q('x')],
  });

beforeAll(() => {
  jest.spyOn(console, 'log').mockImplementation(() => undefined);
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
});
beforeEach(() => jest.clearAllMocks());

describe('involvesGrid', () => {
  it('is false on grid-less pages for every structural action input', () => {
    const { store } = seed({ p1: [q('a'), q('b')], p2: [q('c')] });
    const get = () => store.getState();
    expect(involvesGrid(get, ['p1'])).toBe(false);
    expect(involvesGrid(get, ['p1', 'p2'])).toBe(false);
    expect(involvesGrid(get, ['p1'], { id: 'a' })).toBe(false);
    expect(involvesGrid(get, ['p1'], { type: FieldType.TEXT_INPUT_FIELD })).toBe(false);
  });

  it('is true when a page has a live grid, or the field is a grid or a grid child', () => {
    const { store } = standard();
    const get = () => store.getState();
    expect(involvesGrid(get, ['p1'])).toBe(true);
    expect(involvesGrid(get, ['p2', 'p1'])).toBe(true);
    expect(involvesGrid(get, ['p2'], { type: FieldType.GRID_FIELD })).toBe(true);
    expect(involvesGrid(get, ['p2'], { gridId: 'g1' })).toBe(true);
  });

  it('ignores a soft-deleted grid', () => {
    const { store, ydoc } = seed({ p1: [gridData('g1'), q('a')] });
    ydoc.transact(() => {
      const f = (ydoc.getMap('formSchema').get('pages') as Y.Array<Y.Map<any>>).get(0).get('fields') as Y.Array<Y.Map<any>>;
      f.get(0).set('deleted', true);
    });
    expect(involvesGrid(() => store.getState(), ['p1'])).toBe(false);
  });
});

describe('new grid actions', () => {
  it('addGrid appends an empty grid with equal widths, or inserts before a node', () => {
    const { act, layout, byId } = seed({ p1: [q('a'), q('b')] });
    const g = act().addGrid('p1', 3);
    expect(byId('p1', g)!.columnWidths).toEqual([34, 33, 33]);
    expect(layout('p1')).toEqual(['a', 'b', { [g]: [[], [], []] }]);

    const g2 = act().addGrid('p1', 2, { beforeNodeId: 'b' });
    expect(layout('p1')).toEqual(['a', { [g2]: [[], []] }, 'b', { [g]: [[], [], []] }]);
  });

  it('addFieldToGrid creates a child at the anchor or at the column end', () => {
    const { act, layout, byId } = standard();
    const end = act().addFieldToGrid('p1', FieldType.EMAIL_FIELD, { label: 'E' }, { gridId: 'g1', column: 1 });
    const before = act().addFieldToGrid('p1', FieldType.TEXT_INPUT_FIELD, { label: 'N' }, { gridId: 'g1', column: 0, beforeFieldId: 'b' });
    expect(layout('p1')).toEqual(['top', { g1: [['a', before, 'b'], ['c', end]] }, 'bottom']);
    expect([byId('p1', end)!.gridId, byId('p1', end)!.gridColumn]).toEqual(['g1', 1]);
  });

  it('addFieldToGrid rejects a grid (no nesting) and an unknown grid', () => {
    const { act, ids } = standard();
    const before = ids('p1');
    expect(act().addFieldToGrid('p1', FieldType.GRID_FIELD, {}, { gridId: 'g1', column: 0 })).toBeUndefined();
    expect(act().addFieldToGrid('p1', FieldType.TEXT_INPUT_FIELD, {}, { gridId: 'nope', column: 0 })).toBeUndefined();
    expect(ids('p1')).toEqual(before);
  });

  it('placeField moves top→column, column→column and column→top, keeping order canonical', () => {
    const { act, layout, isCanonical, byId } = standard();
    expect(act().placeField({ pageId: 'p1', fieldId: 'top', target: { gridId: 'g1', column: 1, beforeFieldId: 'c' } })).toBe(true);
    expect(layout('p1')).toEqual([{ g1: [['a', 'b'], ['top', 'c']] }, 'bottom']);

    act().placeField({ pageId: 'p1', fieldId: 'a', target: { gridId: 'g1', column: 1 } });
    expect(layout('p1')).toEqual([{ g1: [['b'], ['top', 'c', 'a']] }, 'bottom']);

    act().placeField({ pageId: 'p1', fieldId: 'c', target: { beforeNodeId: null } });
    expect(layout('p1')).toEqual([{ g1: [['b'], ['top', 'a']] }, 'bottom', 'c']);
    expect(byId('p1', 'c')!.gridId).toBeUndefined();
    expect(isCanonical('p1')).toBe(true);
  });

  it('placeField rejects a grid dropped into a grid', () => {
    const { act, layout } = seed({ p1: [gridData('g1'), gridData('g2')] });
    const before = layout('p1');
    expect(act().placeField({ pageId: 'p1', fieldId: 'g2', target: { gridId: 'g1', column: 0 } })).toBe(false);
    expect(layout('p1')).toEqual(before);
  });

  it('moving a grid among top-level nodes takes its children along', () => {
    const { act, layout, isCanonical } = standard();
    act().placeField({ pageId: 'p1', fieldId: 'g1', target: { beforeNodeId: null } });
    expect(layout('p1')).toEqual(['top', 'bottom', { g1: [['a', 'b'], ['c']] }]);
    expect(isCanonical('p1')).toBe(true);
  });

  it('setGridColumnWidths keeps the sum at 100 and merges removed columns into the last one', () => {
    const { act, byId, layout } = seed({
      p1: [gridData('g', [34, 33, 33]), q('a', { gridId: 'g', gridColumn: 0 }), q('b', { gridId: 'g', gridColumn: 1 }), q('c', { gridId: 'g', gridColumn: 2 })],
    });
    act().setGridColumnWidths('p1', 'g', [20, 30, 50]);
    expect(byId('p1', 'g')!.columnWidths).toEqual([20, 30, 50]);

    act().setGridColumnWidths('p1', 'g', [90, 90]);
    expect(byId('p1', 'g')!.columnWidths).toEqual([50, 50]);
    expect(layout('p1')).toEqual([{ g: [['a'], ['b', 'c']] }]);
  });

  it('ungroupGrid lifts children to the top level in place and removes the grid', () => {
    const { act, layout, byId } = standard();
    act().ungroupGrid('p1', 'g1');
    expect(layout('p1')).toEqual(['top', 'a', 'b', 'c', 'bottom']);
    expect(byId('p1', 'a')!.gridId).toBeUndefined();
    expect(byId('p1', 'g1')!.deleted).toBe(true);
  });

  it('removeGrid soft-deletes the grid and its children; restoreGrid brings exactly those back', () => {
    const { act, ids, ydoc } = standard();
    // an already-deleted child must stay deleted after the undo
    ydoc.transact(() => {
      const f = (ydoc.getMap('formSchema').get('pages') as Y.Array<Y.Map<any>>).get(0).get('fields') as Y.Array<Y.Map<any>>;
      f.toArray().find((m) => m.get('id') === 'b')!.set('deleted', true);
    });
    const snapshot = act().removeGrid('p1', 'g1', { deleteChildren: true });
    expect(snapshot).toEqual({ gridId: 'g1', fieldIds: ['g1', 'a', 'c'] });
    expect(ids('p1')).toEqual(['top', 'bottom']);

    expect(act().restoreGrid('p1', snapshot)).toBe(true);
    expect(ids('p1')).toEqual(['top', 'g1', 'a', 'c', 'bottom']);
  });

  it('duplicateGrid copies the block with new ids and remapped pointers, right after the original', () => {
    const { act, layout } = standard();
    const copy = act().duplicateGrid('p1', 'g1');
    const tree = layout('p1');
    expect(tree[0]).toBe('top');
    expect(tree[1]).toEqual({ g1: [['a', 'b'], ['c']] });
    const copied = tree[2] as Record<string, string[][]>;
    expect(Object.keys(copied)).toEqual([copy]);
    expect(copied[copy!].map((col) => col.length)).toEqual([2, 1]);
    expect(copied[copy!].flat()).not.toContain('a');
    expect(tree[3]).toBe('bottom');
  });
});

describe('existing actions on a page with a grid (§7.4)', () => {
  it('addField appends top-level, never joining the grid', () => {
    const { act, layout } = standard();
    act().addField('p1', FieldType.TEXT_INPUT_FIELD, { label: 'new', gridId: 'g1', gridColumn: 0 });
    const tree = layout('p1');
    expect(tree.slice(0, 3)).toEqual(['top', { g1: [['a', 'b'], ['c']] }, 'bottom']);
    expect(typeof tree[3]).toBe('string');
  });

  it('addField of a grid type appends a grid', () => {
    const { act, live } = standard();
    act().addField('p1', FieldType.GRID_FIELD, { columnWidths: [30, 70] });
    const grids = live('p1').filter((f) => f.type === FieldType.GRID_FIELD);
    expect(grids.map((g) => g.columnWidths)).toEqual([[50, 50], [30, 70]]);
  });

  it('addFieldAtIndex inside a grid block lands after the block (D11)', () => {
    const { act, layout } = standard();
    // canonical visible order: top(0) g1(1) a(2) b(3) c(4) bottom(5)
    act().addFieldAtIndex('p1', FieldType.TEXT_INPUT_FIELD, { label: 'n' }, 3);
    const tree = layout('p1');
    expect(tree[0]).toBe('top');
    expect(tree[1]).toEqual({ g1: [['a', 'b'], ['c']] });
    expect(typeof tree[2]).toBe('string');
    expect(tree[3]).toBe('bottom');
  });

  it('Move up on the first child of a column leaves the grid, before the block (D10)', () => {
    const { act, layout, ids } = standard();
    const order = ids('p1');
    act().reorderFields('p1', order.indexOf('a'), order.indexOf('a') - 1);
    expect(layout('p1')).toEqual(['top', 'a', { g1: [['b'], ['c']] }, 'bottom']);
  });

  it('Move down on a top-level field above a grid jumps past the whole block', () => {
    const { act, layout, ids } = standard();
    const order = ids('p1');
    act().reorderFields('p1', order.indexOf('top'), order.indexOf('top') + 1);
    expect(layout('p1')).toEqual([{ g1: [['a', 'b'], ['c']] }, 'top', 'bottom']);
  });

  it('moving a grid to another page takes its children along', () => {
    const { act, layout, ids } = standard();
    act().moveFieldBetweenPages('p1', 'p2', 'g1');
    expect(ids('p1')).toEqual(['top', 'bottom']);
    expect(layout('p2')).toEqual(['x', { g1: [['a', 'b'], ['c']] }]);
  });

  it('moving a child to another page clears its layout keys and lands top-level', () => {
    const { act, layout, byId } = standard();
    act().moveFieldBetweenPages('p1', 'p2', 'a', 0);
    expect(layout('p2')).toEqual(['a', 'x']);
    expect(byId('p2', 'a')!.gridId).toBeUndefined();
    expect(layout('p1')).toEqual(['top', { g1: [['b'], ['c']] }, 'bottom']);
  });

  it('copying a grid to another page gives new ids and remapped pointers', () => {
    const { act, live } = standard();
    act().copyFieldToPage('p1', 'p2', 'g1');
    const copied = live('p2');
    const grid = copied.find((f) => f.type === FieldType.GRID_FIELD)!;
    expect(grid.id).not.toBe('g1');
    const children = copied.filter((f) => f.gridId !== undefined);
    expect(children).toHaveLength(3);
    children.forEach((c) => expect(c.gridId).toBe(grid.id));
    expect(children.map((c) => c.id)).not.toContain('a');
  });

  it('copying a child to another page lands it top-level', () => {
    const { act, live } = standard();
    act().copyFieldToPage('p1', 'p2', 'c');
    const copy = live('p2').find((f) => f.label === 'c (Copy)')!;
    expect(copy.gridId).toBeUndefined();
  });

  it('duplicateField on a child puts the copy right after it in the same column', () => {
    const { act, layout, live } = standard();
    act().duplicateField('p1', 'a');
    const copy = live('p1').find((f) => f.label === 'a (Copy)')!;
    expect(layout('p1')).toEqual(['top', { g1: [['a', copy.id, 'b'], ['c']] }, 'bottom']);
  });

  it('duplicateField on a grid duplicates the whole block', () => {
    const { act, live } = standard();
    act().duplicateField('p1', 'g1');
    expect(live('p1').filter((f) => f.type === FieldType.GRID_FIELD)).toHaveLength(2);
    expect(live('p1').filter((f) => f.gridId !== undefined)).toHaveLength(6);
  });

  it('removeField on a grid removes the grid and its children', () => {
    const { act, ids } = standard();
    expect(act().removeField('p1', 'g1')).toBe(true);
    expect(ids('p1')).toEqual(['top', 'bottom']);
  });

  it('removeField + restoreField on a child keeps it in its column', () => {
    const { act, layout } = standard();
    act().removeField('p1', 'b');
    const field = Object.assign(new TextInputField('b', 'b', '', '', '', '', new TextFieldValidation(false)), { gridId: 'g1', gridColumn: 0 });
    act().restoreField('p1', field, 2);
    expect(layout('p1')).toEqual(['top', { g1: [['a', 'b'], ['c']] }, 'bottom']);
  });

  it('convertFieldType on a child keeps its column and position', () => {
    const { act, layout, live } = standard();
    act().convertFieldType('p1', 'b', FieldType.TEXT_AREA_FIELD);
    // Converting recreates the field with a new id (unchanged behaviour); only its slot matters here
    const converted = live('p1').find((f) => f.type === FieldType.TEXT_AREA_FIELD)!;
    expect(layout('p1')).toEqual(['top', { g1: [['a', converted.id], ['c']] }, 'bottom']);
    expect([converted.gridId, converted.gridColumn]).toEqual(['g1', 0]);
  });

  it('convertFieldType on a grid is rejected with a toast', () => {
    const { act, byId } = standard();
    act().convertFieldType('p1', 'g1', FieldType.TEXT_INPUT_FIELD);
    expect(byId('p1', 'g1')!.type).toBe(FieldType.GRID_FIELD);
    expect(toastError).toHaveBeenCalled();
  });

  it('duplicatePage remaps children to the new grid', () => {
    const { act, ydoc } = standard();
    act().duplicatePage('p1');
    const pages = ydoc.getMap('formSchema').get('pages') as Y.Array<Y.Map<any>>;
    const copy = (pages.get(1).get('fields') as Y.Array<Y.Map<any>>).toArray().map((m) => extractFieldData(m));
    const grid = copy.find((f) => f.type === FieldType.GRID_FIELD)!;
    expect(copy.filter((f) => f.gridId !== undefined).every((f) => f.gridId === grid.id)).toBe(true);
  });

  it('a drop on a soft-deleted-heavy grid page lands in the intended slot', () => {
    const { act, layout, ydoc } = seed({
      p1: [q('d1'), q('top'), q('d2'), gridData('g1'), q('a', { gridId: 'g1' }), q('bottom')],
    });
    ydoc.transact(() => {
      const f = (ydoc.getMap('formSchema').get('pages') as Y.Array<Y.Map<any>>).get(0).get('fields') as Y.Array<Y.Map<any>>;
      f.toArray().filter((m) => ['d1', 'd2'].includes(m.get('id'))).forEach((m) => m.set('deleted', true));
    });
    // visible: top(0) g1(1) a(2) bottom(3); index 1 = before the grid
    act().addFieldAtIndex('p1', FieldType.TEXT_INPUT_FIELD, { label: 'n' }, 1);
    const tree = layout('p1');
    expect(tree[0]).toBe('top');
    expect(typeof tree[1]).toBe('string');
    expect(tree[2]).toEqual({ g1: [['a'], []] });
    expect(tree[3]).toBe('bottom');
  });
});
