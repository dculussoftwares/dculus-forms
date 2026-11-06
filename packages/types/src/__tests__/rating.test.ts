import { describe, it, expect } from 'vitest';
import {
  FieldType,
  FillableFormFieldValidation,
  RatingField,
  deserializeFormField,
  deserializeFormSchema,
  getFieldValidationSchema,
  isNpsRatingConfig,
  normalizeRatingConfig,
  serializeFormField,
  serializeFormSchema,
  evaluateConditions,
  type ConditionalRule,
} from '../index';

describe('normalizeRatingConfig', () => {
  it('defaults to five stars', () => {
    expect(normalizeRatingConfig({})).toEqual({ ratingStyle: 'stars', minValue: 1, maxValue: 5 });
    expect(normalizeRatingConfig(null)).toEqual({ ratingStyle: 'stars', minValue: 1, maxValue: 5 });
  });

  it('pins stars to start at 1 even when minValue is 0', () => {
    expect(normalizeRatingConfig({ ratingStyle: 'stars', minValue: 0, maxValue: 7 })).toEqual({
      ratingStyle: 'stars',
      minValue: 1,
      maxValue: 7,
    });
  });

  it('lets a scale start at 0 or 1', () => {
    expect(normalizeRatingConfig({ ratingStyle: 'scale', minValue: 0, maxValue: 10 }).minValue).toBe(0);
    expect(normalizeRatingConfig({ ratingStyle: 'scale', minValue: 1, maxValue: 10 }).minValue).toBe(1);
    expect(normalizeRatingConfig({ ratingStyle: 'scale', minValue: 5, maxValue: 10 }).minValue).toBe(1);
  });

  it('clamps max to 3..10 and falls back to 5 for non-integers and unset values', () => {
    expect(normalizeRatingConfig({ maxValue: 2 }).maxValue).toBe(3);
    expect(normalizeRatingConfig({ maxValue: 50 }).maxValue).toBe(10);
    expect(normalizeRatingConfig({ maxValue: 6.5 }).maxValue).toBe(5);
    expect(normalizeRatingConfig({ maxValue: 'abc' }).maxValue).toBe(5);
    // Number(null) and Number('') are 0: they must read as "unset", not clamp to 3
    expect(normalizeRatingConfig({ maxValue: null }).maxValue).toBe(5);
    expect(normalizeRatingConfig({ maxValue: '' }).maxValue).toBe(5);
    expect(normalizeRatingConfig({ maxValue: '8' }).maxValue).toBe(8);
  });

  it('treats only a 0-10 number scale as NPS', () => {
    expect(isNpsRatingConfig(normalizeRatingConfig({ ratingStyle: 'scale', minValue: 0, maxValue: 10 }))).toBe(true);
    expect(isNpsRatingConfig(normalizeRatingConfig({ ratingStyle: 'scale', minValue: 1, maxValue: 10 }))).toBe(false);
    expect(isNpsRatingConfig(normalizeRatingConfig({ ratingStyle: 'scale', minValue: 0, maxValue: 5 }))).toBe(false);
    expect(isNpsRatingConfig(normalizeRatingConfig({ ratingStyle: 'stars', minValue: 0, maxValue: 10 }))).toBe(false);
  });
});

describe('RatingField', () => {
  const make = (...args: ConstructorParameters<typeof RatingField> extends [any, any, any, any, any, any, any, ...infer R] ? R : never) =>
    new RatingField('r1', 'Rate us', '', '', '', '', new FillableFormFieldValidation(true), ...args);

  it('is a rating_field with defaults', () => {
    const field = make();
    expect(field.type).toBe(FieldType.RATING_FIELD);
    expect(field).toMatchObject({ ratingStyle: 'stars', minValue: 1, maxValue: 5 });
    expect(field.lowLabel).toBeUndefined();
  });

  it('normalizes in the constructor', () => {
    expect(make('stars', 0, 99)).toMatchObject({ ratingStyle: 'stars', minValue: 1, maxValue: 10 });
  });

  it('round-trips through serialize / deserialize', () => {
    const field = make('scale', 0, 10, 'Not likely', 'Very likely');
    const restored = deserializeFormField(JSON.parse(JSON.stringify(serializeFormField(field))));
    expect(restored).toBeInstanceOf(RatingField);
    expect(restored).toMatchObject({
      id: 'r1',
      label: 'Rate us',
      ratingStyle: 'scale',
      minValue: 0,
      maxValue: 10,
      lowLabel: 'Not likely',
      highLabel: 'Very likely',
    });
    expect((restored as RatingField).validation.required).toBe(true);
  });

  it('repairs an invalid stored config instead of dropping the field', () => {
    const restored = deserializeFormField({
      id: 'r2',
      type: 'rating_field',
      label: 'Bad config',
      ratingStyle: 'hearts',
      minValue: 7,
      maxValue: 100,
      validation: { required: false },
    }) as RatingField;
    expect(restored).toBeInstanceOf(RatingField);
    expect(restored).toMatchObject({ ratingStyle: 'stars', minValue: 1, maxValue: 10 });
  });

  it('survives a whole-schema round trip', () => {
    const schema = deserializeFormSchema({
      pages: [{ id: 'p1', title: 'P', order: 0, fields: [serializeFormField(make('scale', 1, 7))] }],
      layout: {},
      isShuffleEnabled: false,
    });
    const again = deserializeFormSchema(JSON.parse(JSON.stringify(serializeFormSchema(schema))));
    expect(again.pages[0].fields[0]).toMatchObject({ type: 'rating_field', ratingStyle: 'scale', minValue: 1, maxValue: 7 });
  });
});

describe('rating field settings schema', () => {
  const schema = getFieldValidationSchema(FieldType.RATING_FIELD);

  it('accepts a valid config', () => {
    expect(schema.safeParse({ label: 'Rate', ratingStyle: 'scale', minValue: 0, maxValue: 10 }).success).toBe(true);
  });

  it('rejects a max outside 3..10 and an invalid start', () => {
    expect(schema.safeParse({ label: 'Rate', maxValue: 2 }).success).toBe(false);
    expect(schema.safeParse({ label: 'Rate', maxValue: 11 }).success).toBe(false);
    expect(schema.safeParse({ label: 'Rate', minValue: 2 }).success).toBe(false);
  });
});

describe('rating as a condition source', () => {
  const score = new RatingField('score', 'Score', '', '', '', '', new FillableFormFieldValidation(false), 'scale', 0, 10);
  const why = deserializeFormField({ id: 'why', type: 'text_input_field', label: 'Why', validation: { required: false } })!;
  const schema = { pages: [{ id: 'p1', title: 'P', order: 0, fields: [score, why] }] };
  // Show "why" only for a low score
  const rules: ConditionalRule[] = [
    {
      id: 'c1',
      enabled: true,
      combinator: 'all',
      terms: [{ fieldId: 'score', operator: 'lessThan', value: 7 }],
      actions: [{ type: 'showField', fieldIds: ['why'] }],
    },
  ];
  const hidden = (answer: unknown) =>
    evaluateConditions(rules, { p1: { score: answer } }, schema).hiddenFieldIds.has('why');

  it('compares numerically, including a 0 answer', () => {
    expect(hidden(3)).toBe(false);
    expect(hidden(0)).toBe(false);
    expect(hidden(9)).toBe(true);
    expect(hidden(undefined)).toBe(true);
  });
});
