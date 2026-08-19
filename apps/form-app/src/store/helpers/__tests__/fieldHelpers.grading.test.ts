/**
 * Y.js round-trip coverage for field `grading` (#294 — Story 05 of the Native
 * Quiz epic, #289). `grading` is a nested object containing arrays
 * (`acceptedAnswers`, `optionFeedback`) and mode-specific sub-objects
 * (`text`/`numeric`/`set`), so it needs the same explicit Y.Array/Y.Map
 * treatment `createYJSFieldMap` already gives `options`/`allowedMimeTypes`/
 * `validation`. This suite exercises the two ends of that plumbing directly:
 * createYJSFieldMap (plain FieldData -> Y.Map) and extractFieldData
 * (Y.Map -> plain FieldData).
 *
 * setupTests.ts globally mocks '@dculus/types' with a small subset of field
 * classes for component tests — opt back into the real implementation here
 * (same pattern as selectionSlice.test.ts's `jest.unmock('zustand')`) since
 * these tests need the full type system, including the grading sanitizers
 * and every field class createFormField can construct. CollaborationManager
 * also pulls in lib/config (import.meta.env, Vite-only) and lib/auth-client
 * transitively — stub both since this suite never opens a real connection.
 */
jest.unmock('@dculus/types');
jest.mock('../../../lib/config', () => ({ getWebSocketUrl: () => '' }));
jest.mock('../../../lib/auth-client', () => ({ getBearerToken: () => '' }));

import * as Y from 'yjs';
import { FieldGrading, FieldType, FillableFormField } from '@dculus/types';
import {
  createFormField,
  createYJSFieldMap,
  serializeFieldToYMap,
} from '../fieldHelpers';
import { extractFieldData, FieldData } from '../../collaboration/CollaborationManager';

const baseFieldData = (
  overrides: Partial<FieldData> = {}
): FieldData => ({
  id: 'f1',
  type: FieldType.RADIO_FIELD,
  label: 'Question',
  required: false,
  placeholder: '',
  defaultValue: '',
  prefix: '',
  hint: '',
  options: ['Option A', 'Option B', 'Option C'],
  ...overrides,
});

// Yjs types must be integrated into a Y.Doc before they can be read back
// (AbstractType throws "Invalid access" otherwise) — mirror how production
// code always inserts a freshly-built fieldMap into a Y.Array that already
// belongs to a doc (fieldsArray.push([fieldMap])) before reading from it.
const attachToDoc = <T extends Y.AbstractType<any>>(type: T): T => {
  const doc = new Y.Doc();
  doc.getMap('root').set('field', type);
  return type;
};

const roundTrip = (fieldData: FieldData): FieldData => {
  const map = attachToDoc(createYJSFieldMap(fieldData));
  return extractFieldData(map);
};

describe('grading round-trip through createYJSFieldMap / extractFieldData', () => {
  test('exact mode with optionFeedback, messages and shuffleOptions round-trips deeply-equal', () => {
    const grading: FieldGrading = {
      mode: 'exact',
      pointValue: 5,
      acceptedAnswers: ['Option A'],
      whenCorrect: 'Nice work!',
      whenIncorrect: 'Not quite.',
      general: 'This tests basic recall.',
      optionFeedback: [
        { option: 'Option A', feedback: 'Correct — well done.' },
        { option: 'Option B', feedback: 'Close, but not it.' },
      ],
      shuffleOptions: true,
    };

    const result = roundTrip(baseFieldData({ grading }));
    expect(result.grading).toEqual(grading);
  });

  test('set mode with wrongSelectionPenalty round-trips deeply-equal', () => {
    const grading: FieldGrading = {
      mode: 'set',
      pointValue: 10,
      acceptedAnswers: ['Option A', 'Option C'],
      set: { scoring: 'partial', wrongSelectionPenalty: 0.5 },
    };

    const result = roundTrip(
      baseFieldData({ type: FieldType.CHECKBOX_FIELD, grading })
    );
    expect(result.grading).toEqual(grading);
  });

  test('text mode with match options round-trips deeply-equal', () => {
    const grading: FieldGrading = {
      mode: 'text',
      pointValue: 3,
      acceptedAnswers: ['Paris', 'paris, france'],
      text: {
        caseSensitive: false,
        trimWhitespace: true,
        collapseWhitespace: true,
        ignorePunctuation: true,
        regex: false,
      },
    };

    const result = roundTrip(
      baseFieldData({ type: FieldType.TEXT_INPUT_FIELD, options: undefined, grading })
    );
    expect(result.grading).toEqual(grading);
  });

  test('numeric mode with tolerance/min/max round-trips deeply-equal', () => {
    const grading: FieldGrading = {
      mode: 'numeric',
      pointValue: 2,
      acceptedAnswers: ['42'],
      numeric: { tolerance: 0.5, tolerancePercent: 5, min: 0, max: 100 },
    };

    const result = roundTrip(
      baseFieldData({ type: FieldType.NUMBER_FIELD, options: undefined, grading })
    );
    expect(result.grading).toEqual(grading);
  });

  test('manual mode with an empty answer key round-trips deeply-equal', () => {
    const grading: FieldGrading = {
      mode: 'manual',
      pointValue: 5,
      acceptedAnswers: [],
    };

    const result = roundTrip(
      baseFieldData({ type: FieldType.TEXT_AREA_FIELD, options: undefined, grading })
    );
    expect(result.grading).toEqual(grading);
  });

  test('a field with no grading round-trips to grading === undefined', () => {
    const result = roundTrip(baseFieldData());
    expect(result.grading).toBeUndefined();
  });

  test('a field with no grading produces a Y.Map with NO grading key at all', () => {
    const map = attachToDoc(createYJSFieldMap(baseFieldData()));
    expect(map.has('grading')).toBe(false);
  });

  test('a field with grading produces a Y.Map whose grading key is a Y.Map (not a plain object)', () => {
    const grading: FieldGrading = { mode: 'exact', pointValue: 1, acceptedAnswers: ['A'] };
    const map = attachToDoc(createYJSFieldMap(baseFieldData({ grading })));
    expect(map.get('grading')).toBeInstanceOf(Y.Map);
    expect(map.get('grading').get('acceptedAnswers')).toBeInstanceOf(Y.Array);
  });
});

describe('createFormField assigns grading after construction', () => {
  test('grading is attached to the constructed instance when provided', () => {
    const grading: FieldGrading = { mode: 'exact', pointValue: 1, acceptedAnswers: ['A'] };
    const field = createFormField(FieldType.RADIO_FIELD, {
      label: 'Q1',
      options: ['A', 'B'],
      grading,
    }) as FillableFormField;

    expect(field.grading).toEqual(grading);
  });

  test('grading is left undefined when not provided', () => {
    const field = createFormField(FieldType.RADIO_FIELD, {
      label: 'Q1',
      options: ['A', 'B'],
    }) as FillableFormField;

    expect(field.grading).toBeUndefined();
  });

  test('grading is never assigned to non-fillable fields (rich text)', () => {
    const field = createFormField(FieldType.RICH_TEXT_FIELD, {
      content: '<p>hi</p>',
    } as any);

    expect((field as any).grading).toBeUndefined();
  });
});

describe('serializeFieldToYMap carries grading from a FillableFormField instance', () => {
  test('an instance with grading serializes to a Y.Map with a populated grading key', () => {
    const grading: FieldGrading = {
      mode: 'set',
      pointValue: 8,
      acceptedAnswers: ['A', 'B'],
      set: { scoring: 'all' },
    };
    const field = createFormField(FieldType.CHECKBOX_FIELD, {
      label: 'Pick two',
      options: ['A', 'B', 'C'],
      grading,
    }) as FillableFormField;

    const map = attachToDoc(serializeFieldToYMap(field));
    const extracted = extractFieldData(map);
    expect(extracted.grading).toEqual(grading);
  });

  test('an instance without grading serializes to a Y.Map with no grading key', () => {
    const field = createFormField(FieldType.CHECKBOX_FIELD, {
      label: 'Pick two',
      options: ['A', 'B', 'C'],
    }) as FillableFormField;

    const map = attachToDoc(serializeFieldToYMap(field));
    expect(map.has('grading')).toBe(false);
  });
});
