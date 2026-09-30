/**
 * Grid Layout Phase 1b: layout keys (gridId / gridColumn / columnWidths) survive the client Y.js
 * plumbing. Actions run WITHOUT their grid-aware branch (that lands in Phase 3), so this pins only
 * behaviour that stays true afterwards: recreating a field must not lose its layout pointers.
 */
jest.unmock('@dculus/types');
jest.unmock('zustand');
jest.mock('../../../lib/config', () => ({ getWebSocketUrl: () => '' }));
jest.mock('../../../lib/auth-client', () => ({ getBearerToken: () => '' }));

import * as Y from 'yjs';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { create } = require('zustand') as typeof import('zustand');
import {
  FieldType,
  GridField,
  RichTextFormField,
  TextFieldValidation,
  TextInputField,
  deserializeFormField,
  isLayoutField,
} from '@dculus/types';
import {
  copyLayoutKeys,
  createFormField,
  createYJSFieldMap,
  isFillableFormField,
  serializeFieldToYMap,
} from '../../helpers/fieldHelpers';
import { extractFieldData, type FieldData } from '../../collaboration/CollaborationManager';
import { createFieldsSlice } from '../fieldsSlice';
import { createPagesSlice } from '../pagesSlice';

const data = (overrides: Partial<FieldData>): FieldData => ({
  id: 'f',
  type: FieldType.TEXT_INPUT_FIELD,
  label: 'Q',
  required: false,
  placeholder: '',
  defaultValue: '',
  prefix: '',
  hint: '',
  ...overrides,
});

// Y types are only readable once attached to a document
const attach = <T extends Y.AbstractType<any>>(type: T): T => {
  new Y.Doc().getMap('root').set('value', type);
  return type;
};

describe('Y.Map helpers', () => {
  it('writes a grid as id, type and a plain columnWidths array, with no validation map', () => {
    const map = attach(createYJSFieldMap({ id: 'g', type: FieldType.GRID_FIELD, columnWidths: [30, 70] }));
    expect(map.get('columnWidths')).toEqual([30, 70]);
    expect(Array.isArray(map.get('columnWidths'))).toBe(true);
    expect(map.has('validation')).toBe(false);
  });

  it('serializes a GridField the same way', () => {
    const map = attach(serializeFieldToYMap(new GridField('g', [25, 25, 50])));
    expect([...map.keys()].sort()).toEqual(['columnWidths', 'id', 'type']);
    expect(map.get('columnWidths')).toEqual([25, 25, 50]);
  });

  it('repairs invalid widths when writing', () => {
    const map = attach(createYJSFieldMap({ id: 'g', type: FieldType.GRID_FIELD, columnWidths: [80, 80] }));
    expect(map.get('columnWidths')).toEqual([50, 50]);
  });

  it('writes layout keys for every path that recreates a field', () => {
    const fromData = attach(createYJSFieldMap(data({ gridId: 'g', gridColumn: 1 })));
    expect([fromData.get('gridId'), fromData.get('gridColumn')]).toEqual(['g', 1]);

    const text = createFormField(FieldType.TEXT_INPUT_FIELD, { gridId: 'g', gridColumn: 2 });
    const fromText = attach(serializeFieldToYMap(text));
    expect([fromText.get('gridId'), fromText.get('gridColumn')]).toEqual(['g', 2]);

    const rich = Object.assign(new RichTextFormField('r', '<p>x</p>'), { gridId: 'g', gridColumn: 0 });
    const fromRich = attach(serializeFieldToYMap(rich));
    expect([fromRich.get('gridId'), fromRich.get('gridColumn'), fromRich.get('content')]).toEqual([
      'g',
      0,
      '<p>x</p>',
    ]);
  });

  it('adds no layout keys to a field without a grid (R2)', () => {
    const maps = [
      createYJSFieldMap(data({})),
      serializeFieldToYMap(createFormField(FieldType.TEXT_INPUT_FIELD)),
      serializeFieldToYMap(new RichTextFormField('r', 'x')),
    ].map(attach);
    for (const map of maps) {
      expect([...map.keys()]).not.toContain('gridId');
      expect([...map.keys()]).not.toContain('gridColumn');
    }
  });

  it('copyLayoutKeys writes only what is defined', () => {
    const map = attach(new Y.Map());
    copyLayoutKeys({}, map);
    expect([...map.keys()]).toEqual([]);
    copyLayoutKeys({ gridId: 'g' }, map);
    expect([...map.keys()]).toEqual(['gridId']);
  });

  it('createFormField keeps a valid pointer, drops an invalid one, and never nests a grid', () => {
    expect(createFormField(FieldType.TEXT_INPUT_FIELD, { gridId: 'g', gridColumn: 1 }).gridColumn).toBe(1);
    expect(createFormField(FieldType.TEXT_INPUT_FIELD, { gridId: '' }).gridId).toBeUndefined();
    expect(createFormField(FieldType.GRID_FIELD, { gridId: 'other' }).gridId).toBeUndefined();
    expect((createFormField(FieldType.GRID_FIELD, { columnWidths: [40, 60] }) as GridField).columnWidths).toEqual([40, 60]);
  });

  it('isFillableFormField rejects layout fields', () => {
    expect(isFillableFormField(new GridField('g'))).toBe(false);
    expect(isFillableFormField(new TextInputField('t', 'T', '', '', '', '', new TextFieldValidation(false)))).toBe(true);
  });
});

describe('extractFieldData', () => {
  it('reads layout keys back, and only when stored', () => {
    const child = attach(createYJSFieldMap(data({ gridId: 'g', gridColumn: 1 })));
    const extracted = extractFieldData(child);
    expect([extracted.gridId, extracted.gridColumn]).toEqual(['g', 1]);

    const plain = extractFieldData(attach(createYJSFieldMap(data({}))));
    expect(Object.keys(plain)).not.toContain('gridId');
    expect(Object.keys(plain)).not.toContain('gridColumn');
    expect(Object.keys(plain)).not.toContain('columnWidths');
  });

  it('reads a grid, including widths stored as a Y.Array', () => {
    const asArray = attach(createYJSFieldMap({ id: 'g', type: FieldType.GRID_FIELD, columnWidths: [40, 60] }));
    expect(extractFieldData(asArray).columnWidths).toEqual([40, 60]);

    const legacy = attach(new Y.Map());
    legacy.set('id', 'g');
    legacy.set('type', FieldType.GRID_FIELD);
    const widths = new Y.Array<number>();
    legacy.set('columnWidths', widths);
    widths.push([30, 70]);
    expect(extractFieldData(legacy).columnWidths).toEqual([30, 70]);
  });

  it('round-trips a grid child through deserializeFormField for every field type', () => {
    const types: Partial<FieldData>[] = [
      { type: FieldType.TEXT_INPUT_FIELD },
      { type: FieldType.TEXT_AREA_FIELD },
      { type: FieldType.EMAIL_FIELD },
      { type: FieldType.NUMBER_FIELD },
      { type: FieldType.DATE_FIELD },
      { type: FieldType.SELECT_FIELD, options: ['a'] },
      { type: FieldType.RADIO_FIELD, options: ['a'] },
      { type: FieldType.CHECKBOX_FIELD, options: ['a'] },
      { type: FieldType.FILE_UPLOAD_FIELD },
      { type: FieldType.PHONE_NUMBER_FIELD },
      { type: FieldType.RICH_TEXT_FIELD, content: '<p>x</p>' },
    ];
    for (const overrides of types) {
      const map = attach(serializeFieldToYMap(createFormField(overrides.type!, { ...overrides, gridId: 'g', gridColumn: 1 })));
      const field = deserializeFormField(extractFieldData(map))!;
      expect([overrides.type, field.gridId, field.gridColumn]).toEqual([overrides.type, 'g', 1]);
    }
  });
});

// A page with a grid, its children and a top-level field, plus an empty second page.
function seed() {
  const ydoc = new Y.Doc();
  const pagesArray = new Y.Array<Y.Map<any>>();
  ydoc.getMap('formSchema').set('pages', pagesArray);
  const page = (id: string, fields: FieldData[]) => {
    const pageMap = new Y.Map();
    pageMap.set('id', id);
    pageMap.set('title', id);
    pageMap.set('order', pagesArray.length);
    const fieldsArray = new Y.Array<Y.Map<any>>();
    fields.forEach((f) => fieldsArray.push([createYJSFieldMap(f)]));
    pageMap.set('fields', fieldsArray);
    pagesArray.push([pageMap]);
    return fieldsArray;
  };
  const p1 = page('p1', [
    { id: 'g', type: FieldType.GRID_FIELD, columnWidths: [50, 50] },
    data({ id: 'cA', label: 'A', gridId: 'g', gridColumn: 0 }),
    data({ id: 'cB', type: FieldType.EMAIL_FIELD, label: 'B', gridId: 'g', gridColumn: 1 }),
    data({ id: 'tX', label: 'X' }),
  ]);
  page('p2', []);

  const store = create<any>()((set, get) => ({
    _getYDoc: () => ydoc,
    _isYJSReady: () => true,
    selectedPageId: null,
    setSelectedPage: () => undefined,
    ...createFieldsSlice(set, get),
    ...createPagesSlice(set, get),
    pages: [{ id: 'p1' }, { id: 'p2' }],
  }));
  const fields = (arr: Y.Array<Y.Map<any>> = p1) => arr.toArray().map((m) => extractFieldData(m));
  const byId = (id: string, arr: Y.Array<Y.Map<any>> = p1) => fields(arr).find((f) => f.id === id);
  return { ydoc, pagesArray, store, p1, fields, byId, act: () => store.getState() };
}

describe('store actions keep a child in its grid (no grid branch yet)', () => {
  beforeAll(() => {
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  it('reorderFields recreates the field but keeps its pointers', () => {
    const { act, byId } = seed();
    act().reorderFields('p1', 1, 3);
    expect([byId('cA')?.gridId, byId('cA')?.gridColumn]).toEqual(['g', 0]);
    expect(byId('g')?.columnWidths).toEqual([50, 50]);
  });

  it('duplicateField puts the copy in the same column, right after the original', () => {
    const { act, fields } = seed();
    act().duplicateField('p1', 'cB');
    const copy = fields().find((f) => f.label === 'B (Copy)')!;
    expect([copy.gridId, copy.gridColumn]).toEqual(['g', 1]);
    expect(fields().map((f) => f.label)).toEqual(['', 'A', 'B', 'B (Copy)', 'X']);
  });

  it('convertFieldType keeps the pointers and the position', () => {
    const { act, fields } = seed();
    act().convertFieldType('p1', 'cA', FieldType.TEXT_AREA_FIELD);
    const converted = fields()[1];
    expect(converted.type).toBe(FieldType.TEXT_AREA_FIELD);
    expect([converted.gridId, converted.gridColumn]).toEqual(['g', 0]);
  });

  it('addFieldAtIndex and addField stay top level', () => {
    const { act, fields } = seed();
    act().addFieldAtIndex('p1', FieldType.TEXT_INPUT_FIELD, { label: 'New' }, 1);
    act().addField('p1', FieldType.TEXT_INPUT_FIELD, { label: 'End' });
    for (const f of fields().filter((f) => f.label === 'New' || f.label === 'End')) {
      expect(f.gridId).toBeUndefined();
    }
  });

  it('duplicatePage remaps children to the copied grid', () => {
    const { act, pagesArray } = seed();
    act().duplicatePage('p1');
    const copy = pagesArray.get(1).get('fields') as Y.Array<Y.Map<any>>;
    const copied = copy.toArray().map((m) => extractFieldData(m));
    const grid = copied.find((f) => f.type === FieldType.GRID_FIELD)!;
    expect(grid.id).not.toBe('g');
    const children = copied.filter((f) => f.gridId !== undefined);
    expect(children).toHaveLength(2);
    children.forEach((c) => expect(c.gridId).toBe(grid.id));
    expect(children.map((c) => c.gridColumn)).toEqual([0, 1]);
    // the original page is untouched
    const original = (pagesArray.get(0).get('fields') as Y.Array<Y.Map<any>>).toArray().map((m) => extractFieldData(m));
    expect(original.filter((f) => f.gridId !== undefined).map((f) => f.gridId)).toEqual(['g', 'g']);
  });

  it('duplicatePage drops a pointer that leaves the page instead of aiming at the original', () => {
    const { act, pagesArray, ydoc } = seed();
    ydoc.transact(() => {
      const fieldsArray = pagesArray.get(0).get('fields') as Y.Array<Y.Map<any>>;
      fieldsArray.push([createYJSFieldMap(data({ id: 'stray', gridId: 'elsewhere', gridColumn: 1 }))]);
    });
    act().duplicatePage('p1');
    const copied = (pagesArray.get(1).get('fields') as Y.Array<Y.Map<any>>).toArray().map((m) => extractFieldData(m));
    const stray = copied.find((f) => f.label === 'Q')!;
    expect(stray.gridId).toBeUndefined();
    expect(stray.gridColumn).toBeUndefined();
  });

  it('duplicatePage on a page without a grid is unchanged', () => {
    const { act, pagesArray } = seed();
    act().duplicatePage('p2');
    expect((pagesArray.get(2).get('fields') as Y.Array<Y.Map<any>>).length).toBe(0);
  });
});

describe('updateField on a grid', () => {
  beforeAll(() => {
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  it('replaces columnWidths as one plain array and creates no validation map', () => {
    const { act, p1 } = seed();
    act().updateField('p1', 'g', { columnWidths: [20, 30, 50] });
    const gridMap = p1.get(0);
    expect(gridMap.get('columnWidths')).toEqual([20, 30, 50]);
    expect(Array.isArray(gridMap.get('columnWidths'))).toBe(true);
    expect(gridMap.has('validation')).toBe(false);
  });

  it('repairs bad widths and ignores validation-style keys', () => {
    const { act, p1 } = seed();
    act().updateField('p1', 'g', { columnWidths: [90, 90], required: true, min: 1, max: 2, validation: { required: true } });
    const gridMap = p1.get(0);
    expect(gridMap.get('columnWidths')).toEqual([50, 50]);
    expect(gridMap.has('validation')).toBe(false);
    expect(gridMap.has('min')).toBe(false);
  });

  it('null clears a child pointer (leaving the grid) and a value sets it', () => {
    const { act, byId } = seed();
    act().updateField('p1', 'cA', { gridId: null as unknown as undefined, gridColumn: null as unknown as undefined });
    expect(byId('cA')?.gridId).toBeUndefined();
    act().updateField('p1', 'tX', { gridId: 'g', gridColumn: 1 });
    expect([byId('tX')?.gridId, byId('tX')?.gridColumn]).toEqual(['g', 1]);
  });

  it('a grid is recognised after a round trip through the doc', () => {
    const { p1 } = seed();
    const field = deserializeFormField(extractFieldData(p1.get(0)))!;
    expect(isLayoutField(field)).toBe(true);
  });
});
