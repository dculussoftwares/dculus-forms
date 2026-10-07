import { describe, it, expect } from 'vitest';
import { FieldType, type FormSchema } from '@dculus/types';
import { buildDraftPageResponses, draftDataKey, pruneDraftData, resolveResumePageId } from './draftData';

const schema = {
  pages: [
    {
      id: 'p1',
      fields: [
        { id: 'name', type: FieldType.TEXT_INPUT_FIELD },
        { id: 'colour', type: FieldType.RADIO_FIELD, options: ['Red', 'Blue'] },
        { id: 'tags', type: FieldType.CHECKBOX_FIELD, options: ['a', 'b'] },
        { id: 'cv', type: FieldType.FILE_UPLOAD_FIELD },
        { id: 'intro', type: FieldType.RICH_TEXT_FIELD },
      ],
    },
    {
      id: 'p2',
      fields: [
        { id: 'age', type: FieldType.NUMBER_FIELD },
        { id: 'gone', type: FieldType.TEXT_INPUT_FIELD, deleted: true },
      ],
    },
  ],
} as unknown as FormSchema;

describe('pruneDraftData', () => {
  it('drops empty seeds, files and non-primitive values', () => {
    const file = new File(['x'], 'cv.pdf');
    expect(
      pruneDraftData({
        name: 'Ada',
        blank: '',
        none: null,
        empty: [],
        tags: ['a'],
        cv: [file],
        nested: { a: 1 },
        age: 36,
      })
    ).toEqual({ name: 'Ada', tags: ['a'], age: 36 });
  });

  it('prunes an untouched form to nothing', () => {
    expect(pruneDraftData({ name: '', tags: [] })).toEqual({});
  });
});

describe('draftDataKey', () => {
  it('ignores key order', () => {
    expect(draftDataKey({ a: 1, b: 2 })).toBe(draftDataKey({ b: 2, a: 1 }));
    expect(draftDataKey({ a: 1 })).not.toBe(draftDataKey({ a: 2 }));
  });
});

describe('buildDraftPageResponses', () => {
  it('maps saved answers back onto their pages', () => {
    expect(buildDraftPageResponses(schema, { name: 'Ada', colour: 'Blue', tags: ['b'], age: 36 })).toEqual({
      p1: { name: 'Ada', colour: 'Blue', tags: ['b'] },
      p2: { age: 36 },
    });
  });

  it('drops answers that no longer fit the form', () => {
    expect(
      buildDraftPageResponses(schema, {
        colour: 'Green', // option removed
        tags: ['a', 'z'], // one option removed
        gone: 'x', // field deleted
        unknown: 'y', // field never existed
        cv: ['key'], // files are never restored
        name: { not: 'text' }, // type changed
      })
    ).toEqual({ p1: { tags: ['a'] } });
  });

  it('drops scalar answers whose field changed between text and number', () => {
    expect(buildDraftPageResponses(schema, { name: 42, age: '36' })).toEqual({});
  });
});

describe('resolveResumePageId', () => {
  it('returns the saved page only while it still exists', () => {
    expect(resolveResumePageId(schema, 'p2')).toBe('p2');
    expect(resolveResumePageId(schema, 'removed')).toBeUndefined();
    expect(resolveResumePageId(schema, null)).toBeUndefined();
  });
});
