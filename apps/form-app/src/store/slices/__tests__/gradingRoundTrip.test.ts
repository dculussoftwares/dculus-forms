/**
 * Verifies `grading` survives the five field/page operations that round-trip
 * through createYJSFieldMap / extractFieldData (#294 — Story 05 of the
 * Native Quiz epic, #289): duplicate field, copy field to another page,
 * reorder, duplicate page, and change field type. A silent drop here means a
 * user loses their answer key by doing any of these, so each test asserts
 * the grading data survives byte-for-byte (or is deliberately dropped, for
 * the type-change-to-an-incompatible-type case).
 *
 * setupTests.ts globally mocks '@dculus/types' and 'zustand' for component
 * tests — opt back into both real implementations here (same pattern as
 * automationBuilderSlice.test.ts / selectionSlice.test.ts) since these slices
 * need the real field classes, grading sanitizers, and a working zustand
 * `create`. CollaborationManager also pulls in lib/config (import.meta.env,
 * Vite-only) and lib/auth-client transitively — stub both, this suite never
 * opens a real connection.
 */
jest.unmock('@dculus/types');
jest.unmock('zustand');
jest.mock('../../../lib/config', () => ({ getWebSocketUrl: () => '' }));
jest.mock('../../../lib/auth-client', () => ({ getBearerToken: () => '' }));

import * as Y from 'yjs';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { create } = require('zustand') as typeof import('zustand');
import { FieldGrading, FieldType } from '@dculus/types';
import { createYJSFieldMap } from '../../helpers/fieldHelpers';
import { extractFieldData, FieldData } from '../../collaboration/CollaborationManager';
import { createFieldsSlice } from '../fieldsSlice';
import { createPagesSlice } from '../pagesSlice';

const EXACT_GRADING: FieldGrading = {
  mode: 'exact',
  pointValue: 5,
  acceptedAnswers: ['Option A'],
  optionFeedback: [{ option: 'Option A', feedback: 'Correct!' }],
};

type Harness = {
  ydoc: Y.Doc;
  store: ReturnType<typeof buildStore>;
  getPageFields: (pageId: string) => FieldData[];
};

const buildStore = (ydoc: Y.Doc) =>
  create<any>()((set, get) => ({
    _getYDoc: () => ydoc,
    _isYJSReady: () => true,
    ...createFieldsSlice(set, get),
    ...createPagesSlice(set, get),
  }));

// Seeds a Y.Doc with `formSchema.pages[pageIndex].fields` built the same way
// production code builds them (createYJSFieldMap pushed into a real Y.Array
// inside a real Y.Doc), so extractFieldData's "must be attached to a doc"
// requirement is satisfied exactly like at runtime.
const seedDoc = (
  pages: Array<{ id: string; fields: FieldData[] }>
): Harness => {
  const ydoc = new Y.Doc();
  const formSchemaMap = ydoc.getMap('formSchema');
  const pagesArray = new Y.Array<Y.Map<any>>();
  formSchemaMap.set('pages', pagesArray);

  pages.forEach((page, index) => {
    const pageMap = new Y.Map();
    pageMap.set('id', page.id);
    pageMap.set('title', `Page ${index + 1}`);
    pageMap.set('order', index);
    const fieldsArray = new Y.Array<Y.Map<any>>();
    page.fields.forEach((fieldData) => {
      fieldsArray.push([createYJSFieldMap(fieldData)]);
    });
    pageMap.set('fields', fieldsArray);
    pagesArray.push([pageMap]);
  });

  const store = buildStore(ydoc);

  const getPageFields = (pageId: string): FieldData[] => {
    const pageMap = pagesArray
      .toArray()
      .find((p) => p.get('id') === pageId);
    if (!pageMap) return [];
    const fieldsArray = pageMap.get('fields') as Y.Array<Y.Map<any>>;
    return fieldsArray
      .toArray()
      .filter((fieldMap) => !fieldMap.get('deleted'))
      .map((fieldMap) => extractFieldData(fieldMap));
  };

  return { ydoc, store, getPageFields };
};

const radioField = (id: string, grading?: FieldGrading): FieldData => ({
  id,
  type: FieldType.RADIO_FIELD,
  label: 'Q1',
  required: false,
  placeholder: '',
  defaultValue: '',
  prefix: '',
  hint: '',
  options: ['Option A', 'Option B'],
  grading,
});

describe('duplicateField carries grading', () => {
  test('the duplicate has deeply-equal grading under a new id', () => {
    const { store, getPageFields } = seedDoc([
      { id: 'page-1', fields: [radioField('f1', EXACT_GRADING)] },
    ]);

    store.getState().duplicateField('page-1', 'f1');

    const fields = getPageFields('page-1');
    expect(fields).toHaveLength(2);
    const [original, duplicate] = fields;
    expect(original.grading).toEqual(EXACT_GRADING);
    expect(duplicate.id).not.toBe('f1');
    expect(duplicate.label).toBe('Q1 (Copy)');
    expect(duplicate.grading).toEqual(EXACT_GRADING);
  });

  test('a field without grading duplicates with grading still undefined', () => {
    const { store, getPageFields } = seedDoc([
      { id: 'page-1', fields: [radioField('f1')] },
    ]);

    store.getState().duplicateField('page-1', 'f1');

    const fields = getPageFields('page-1');
    expect(fields.every((f) => f.grading === undefined)).toBe(true);
  });
});

describe('copyFieldToPage carries grading', () => {
  test('the copy on the target page has deeply-equal grading', () => {
    const { store, getPageFields } = seedDoc([
      { id: 'page-1', fields: [radioField('f1', EXACT_GRADING)] },
      { id: 'page-2', fields: [] },
    ]);

    store.getState().copyFieldToPage('page-1', 'page-2', 'f1');

    const sourceFields = getPageFields('page-1');
    const targetFields = getPageFields('page-2');
    expect(sourceFields[0].grading).toEqual(EXACT_GRADING);
    expect(targetFields).toHaveLength(1);
    expect(targetFields[0].id).not.toBe('f1');
    expect(targetFields[0].grading).toEqual(EXACT_GRADING);
  });
});

describe('reorderFields preserves each field\'s own grading', () => {
  test('grading stays attached to the field that owns it, not the slot', () => {
    const { store, getPageFields } = seedDoc([
      {
        id: 'page-1',
        fields: [radioField('f1', EXACT_GRADING), radioField('f2')],
      },
    ]);

    store.getState().reorderFields('page-1', 0, 1);

    const fields = getPageFields('page-1');
    expect(fields.map((f) => f.id)).toEqual(['f2', 'f1']);
    const graded = fields.find((f) => f.id === 'f1');
    const ungraded = fields.find((f) => f.id === 'f2');
    expect(graded?.grading).toEqual(EXACT_GRADING);
    expect(ungraded?.grading).toBeUndefined();
  });
});

describe('duplicatePage carries grading on every duplicated field', () => {
  test('the duplicated page\'s field has deeply-equal grading under new page/field ids', () => {
    const { store, ydoc } = seedDoc([
      { id: 'page-1', fields: [radioField('f1', EXACT_GRADING)] },
    ]);

    store.getState().duplicatePage('page-1');

    const pagesArray = ydoc.getMap('formSchema').get('pages') as Y.Array<Y.Map<any>>;
    expect(pagesArray.length).toBe(2);
    const duplicatedPageMap = pagesArray.get(1);
    expect(duplicatedPageMap.get('id')).not.toBe('page-1');

    const duplicatedFieldsArray = duplicatedPageMap.get('fields') as Y.Array<Y.Map<any>>;
    const duplicatedField = extractFieldData(duplicatedFieldsArray.get(0));
    expect(duplicatedField.id).not.toBe('f1');
    expect(duplicatedField.grading).toEqual(EXACT_GRADING);
  });
});

describe('convertFieldType and grading compatibility', () => {
  test('keeps grading between compatible types (radio_field -> select_field, both "exact")', () => {
    const { store, getPageFields } = seedDoc([
      { id: 'page-1', fields: [radioField('f1', EXACT_GRADING)] },
    ]);

    store.getState().convertFieldType('page-1', 'f1', FieldType.SELECT_FIELD);

    const fields = getPageFields('page-1');
    expect(fields).toHaveLength(1);
    expect(fields[0].type).toBe(FieldType.SELECT_FIELD);
    expect(fields[0].id).not.toBe('f1'); // convertFieldType always mints a new id
    expect(fields[0].grading).toEqual(EXACT_GRADING);
  });

  test('drops grading when converting to an incompatible type (select_field "exact" -> file_upload_field "manual")', () => {
    const selectField: FieldData = {
      id: 'f1',
      type: FieldType.SELECT_FIELD,
      label: 'Q1',
      options: ['Option A', 'Option B'],
      grading: EXACT_GRADING,
    };
    const { store, getPageFields } = seedDoc([
      { id: 'page-1', fields: [selectField] },
    ]);

    expect(getPageFields('page-1')[0].grading).toEqual(EXACT_GRADING);

    store.getState().convertFieldType('page-1', 'f1', FieldType.FILE_UPLOAD_FIELD);

    const fields = getPageFields('page-1');
    expect(fields).toHaveLength(1);
    expect(fields[0].type).toBe(FieldType.FILE_UPLOAD_FIELD);
    expect(fields[0].grading).toBeUndefined();
  });

  test('a field with no grading converts cleanly with grading still undefined', () => {
    const { store, getPageFields } = seedDoc([
      { id: 'page-1', fields: [radioField('f1')] },
    ]);

    store.getState().convertFieldType('page-1', 'f1', FieldType.SELECT_FIELD);

    expect(getPageFields('page-1')[0].grading).toBeUndefined();
  });
});
