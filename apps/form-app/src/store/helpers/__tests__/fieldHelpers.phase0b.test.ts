/**
 * Regression tests for the Phase 0b prerequisite fixes (docs/grid-layout-strategy.md
 * §16, §21): visual->raw index conversion helpers, and the previously-unreachable
 * non-fillable branch in serializeFieldToYMap that dropped rich-text content.
 *
 * setupTests.ts globally mocks '@dculus/types' for component tests — opt back into
 * the real implementation (same pattern as fieldHelpers.grading.test.ts).
 */
jest.unmock('@dculus/types');
jest.mock('../../../lib/config', () => ({ getWebSocketUrl: () => '' }));
jest.mock('../../../lib/auth-client', () => ({ getBearerToken: () => '' }));

import * as Y from 'yjs';
import { createFormField, visualToRawIndex, visualSlotToRawIndex } from '../fieldHelpers';
import { FieldType, RichTextFormField } from '@dculus/types';
import { serializeFieldToYMap } from '../fieldHelpers';

const buildFieldsArray = (deletedFlags: boolean[]): Y.Array<Y.Map<any>> => {
  const doc = new Y.Doc();
  const fieldsArray = new Y.Array<Y.Map<any>>();
  doc.getMap('root').set('fields', fieldsArray);
  deletedFlags.forEach((deleted, i) => {
    const fieldMap = new Y.Map();
    fieldMap.set('id', `f${i}`);
    if (deleted) fieldMap.set('deleted', true);
    fieldsArray.push([fieldMap]);
  });
  return fieldsArray;
};

// Y.Map/Y.Array values are only readable once integrated into a Y.Doc (Yjs
// throws "Invalid access" otherwise) — mirrors the attachToDoc pattern in
// fieldHelpers.grading.test.ts.
const attachToDoc = <T extends Y.AbstractType<any>>(type: T): T => {
  const doc = new Y.Doc();
  doc.getMap('root').set('value', type);
  return type;
};

describe('serializeFieldToYMap - rich text content', () => {
  test('writes content for a rich text field (non-fillable branch was unreachable)', () => {
    const field = createFormField(FieldType.RICH_TEXT_FIELD, {
      content: '<p>Welcome!</p>',
    } as any);
    const map = attachToDoc(serializeFieldToYMap(field));

    expect(map.get('type')).toBe(FieldType.RICH_TEXT_FIELD);
    expect(map.get('content')).toBe('<p>Welcome!</p>');
    // Rich text has no validation map — confirms it took the non-fillable branch.
    expect(map.get('validation')).toBeUndefined();
  });

  test('defaults content to empty string when none provided', () => {
    const field = new RichTextFormField('f1');
    const map = attachToDoc(serializeFieldToYMap(field));
    expect(map.get('content')).toBe('');
  });
});

describe('visualToRawIndex', () => {
  test('maps visual positions to raw indexes when no fields are deleted', () => {
    const fieldsArray = buildFieldsArray([false, false, false]);
    expect(visualToRawIndex(fieldsArray, 0)).toBe(0);
    expect(visualToRawIndex(fieldsArray, 2)).toBe(2);
  });

  test('skips soft-deleted fields when converting', () => {
    // raw: [visible, DELETED, visible, visible] -> visual: [0, _, 1, 2]
    const fieldsArray = buildFieldsArray([false, true, false, false]);
    expect(visualToRawIndex(fieldsArray, 0)).toBe(0);
    expect(visualToRawIndex(fieldsArray, 1)).toBe(2);
    expect(visualToRawIndex(fieldsArray, 2)).toBe(3);
  });

  test('returns -1 for an out-of-range visual index', () => {
    const fieldsArray = buildFieldsArray([false, true]);
    expect(visualToRawIndex(fieldsArray, 5)).toBe(-1);
  });
});

describe('visualSlotToRawIndex', () => {
  test('resolves an insert slot after a soft-deleted field to the correct raw index', () => {
    // raw: [visible, DELETED, visible] -> visible slots: before-0 / between / after-1
    const fieldsArray = buildFieldsArray([false, true, false]);
    // Slot 1 = "insert after the first visible field" -> must land after the
    // deleted field too (raw index 2), not right after raw index 0.
    expect(visualSlotToRawIndex(fieldsArray, 1)).toBe(2);
  });

  test('resolves the end slot to fieldsArray.length even with trailing deleted fields', () => {
    const fieldsArray = buildFieldsArray([false, true, true]);
    expect(visualSlotToRawIndex(fieldsArray, 1)).toBe(3);
  });

  test('matches visualToRawIndex when nothing is deleted', () => {
    const fieldsArray = buildFieldsArray([false, false, false]);
    expect(visualSlotToRawIndex(fieldsArray, 0)).toBe(0);
    expect(visualSlotToRawIndex(fieldsArray, 3)).toBe(3);
  });
});
