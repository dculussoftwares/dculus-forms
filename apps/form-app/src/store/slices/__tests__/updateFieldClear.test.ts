/**
 * Clearing a field setting from the settings panel sends `null` to updateField,
 * which must remove the stored value (while `undefined` keeps meaning "unchanged").
 * Runs against a real Y.Doc, the same way gradingRoundTrip.test.ts does.
 */
jest.unmock('@dculus/types');
jest.unmock('zustand');
jest.mock('../../../lib/config', () => ({ getWebSocketUrl: () => '' }));
jest.mock('../../../lib/auth-client', () => ({ getBearerToken: () => '' }));

import * as Y from 'yjs';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { create } = require('zustand') as typeof import('zustand');
import { FieldType } from '@dculus/types';
import { createYJSFieldMap } from '../../helpers/fieldHelpers';
import { extractFieldData, FieldData } from '../../collaboration/CollaborationManager';
import { createFieldsSlice } from '../fieldsSlice';

const baseField = (overrides: Partial<FieldData>): FieldData => ({
  id: 'f1',
  type: FieldType.NUMBER_FIELD,
  label: 'Q1',
  required: false,
  placeholder: '',
  defaultValue: '',
  prefix: '',
  hint: '',
  ...overrides,
});

function seed(field: FieldData) {
  const ydoc = new Y.Doc();
  const pagesArray = new Y.Array<Y.Map<any>>();
  ydoc.getMap('formSchema').set('pages', pagesArray);
  const pageMap = new Y.Map();
  pageMap.set('id', 'page-1');
  const fieldsArray = new Y.Array<Y.Map<any>>();
  fieldsArray.push([createYJSFieldMap(field)]);
  pageMap.set('fields', fieldsArray);
  pagesArray.push([pageMap]);

  const store = create<any>()((set, get) => ({
    _getYDoc: () => ydoc,
    _isYJSReady: () => true,
    ...createFieldsSlice(set, get),
  }));
  const fieldMap = () => fieldsArray.get(0);
  const update = (updates: Record<string, unknown>) =>
    store.getState().updateField('page-1', field.id, updates);
  return {
    store,
    fieldMap,
    update,
    read: () => extractFieldData(fieldMap()),
    readAt: (index: number) => extractFieldData(fieldsArray.get(index)),
  };
}

describe('updateField clearing settings', () => {
  test('null removes a number bound; undefined leaves it untouched', () => {
    const { update, read, fieldMap } = seed(baseField({ min: 5, max: 10 }));

    update({ min: undefined });
    expect(read().min).toBe(5);

    update({ min: null });
    expect(fieldMap().has('min')).toBe(false);
    expect(read().min).toBeUndefined();
    expect(read().max).toBe(10);
  });

  test('a number bound of 0 is stored, not treated as cleared', () => {
    const { update, read } = seed(baseField({}));

    update({ min: 0 });
    expect(read().min).toBe(0);
  });

  test('clears text length limits, including the legacy top-level copies', () => {
    const { update, read, fieldMap } = seed(
      baseField({ type: FieldType.TEXT_INPUT_FIELD, min: 2, max: 50 })
    );
    expect(read().validation?.minLength).toBe(2);

    update({ validation: { required: false, minLength: null, maxLength: null } });

    expect(fieldMap().has('min')).toBe(false);
    expect(fieldMap().has('max')).toBe(false);
    expect(read().validation?.minLength).toBeUndefined();
    expect(read().validation?.maxLength).toBeUndefined();
    expect(read().min).toBeUndefined();
    expect(read().max).toBeUndefined();
  });

  test('clears text length limits sent through the direct min/max keys', () => {
    const { update, read, fieldMap } = seed(
      baseField({ type: FieldType.TEXT_INPUT_FIELD, min: 2, max: 50 })
    );

    update({ min: null, max: null });

    expect(fieldMap().has('min')).toBe(false);
    expect(fieldMap().has('max')).toBe(false);
    expect(read().min).toBeUndefined();
    expect(read().max).toBeUndefined();
  });

  test('a text minLength of 0 survives duplicating the field', () => {
    const { store, update, readAt } = seed(
      baseField({ type: FieldType.TEXT_INPUT_FIELD, min: 2, max: 50 })
    );

    update({ validation: { required: false, minLength: 0, maxLength: 50 } });
    store.getState().duplicateField('page-1', 'f1');

    expect(readAt(0).validation?.minLength).toBe(0);
    expect(readAt(1).validation?.minLength).toBe(0);
  });

  test('clears checkbox selection limits', () => {
    const { update, read } = seed(
      baseField({
        type: FieldType.CHECKBOX_FIELD,
        options: ['A', 'B', 'C'],
        validation: { required: false, minSelections: 1, maxSelections: 2 },
      } as Partial<FieldData>)
    );
    expect(read().validation?.maxSelections).toBe(2);

    update({ validation: { required: false, minSelections: null, maxSelections: null } });

    expect(read().validation?.minSelections).toBeUndefined();
    expect(read().validation?.maxSelections).toBeUndefined();
  });

  test('clears file upload limits', () => {
    const { update, read } = seed(
      baseField({ type: FieldType.FILE_UPLOAD_FIELD, maxFileSizeMb: 5, maxFiles: 3 })
    );

    update({ maxFileSizeMb: null, maxFiles: null });

    expect(read().maxFileSizeMb).toBeUndefined();
    expect(read().maxFiles).toBeUndefined();
  });

  test('never deletes the field id or type', () => {
    const { update, fieldMap } = seed(baseField({}));

    update({ id: null, type: null });

    expect(fieldMap().get('id')).toBe('f1');
    expect(fieldMap().get('type')).toBe(FieldType.NUMBER_FIELD);
  });
});
