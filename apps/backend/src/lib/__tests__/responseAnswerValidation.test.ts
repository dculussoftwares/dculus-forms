import { describe, it, expect } from 'vitest';
import { validateResponseAnswers } from '../responseAnswerValidation.js';

const schema = {
  pages: [
    {
      id: 'p1',
      title: 'Page',
      order: 0,
      fields: [
        { id: 'name', type: 'text_input_field', label: 'Name', validation: { required: true, maxLength: 5 } },
        { id: 'mail', type: 'email_field', label: 'Mail', validation: { required: false } },
        { id: 'age', type: 'number_field', label: 'Age', min: 18, max: 99, validation: { required: false } },
        { id: 'color', type: 'select_field', label: 'Color', options: ['red', 'blue'], validation: { required: false } },
        {
          id: 'tags',
          type: 'checkbox_field',
          label: 'Tags',
          options: ['a', 'b'],
          validation: { required: false, maxSelections: 1 },
        },
      ],
    },
  ],
  layout: { theme: 'light', textColor: '#000', spacing: 'normal', code: 'L1', content: '', customBackGroundColor: '', backgroundImageKey: '' },
  isShuffleEnabled: false,
};

const opts = { formId: 'form-1' };

describe('validateResponseAnswers', () => {
  it('accepts valid answers and drops unknown keys', () => {
    const result = validateResponseAnswers(schema, { name: 'Bob', ghost: 'x' }, opts);
    expect(result).toEqual({ name: 'Bob' });
  });

  it('rejects missing required field', () => {
    expect(() => validateResponseAnswers(schema, {}, opts)).toThrow(/Name/);
  });

  it('allows missing required field in partial mode', () => {
    expect(validateResponseAnswers(schema, {}, { ...opts, partial: true })).toEqual({});
  });

  it('rejects over-long text, bad email, out-of-range number, unknown option', () => {
    expect(() => validateResponseAnswers(schema, { name: 'Roberto' }, opts)).toThrow(/exceed/);
    expect(() => validateResponseAnswers(schema, { name: 'Bob', mail: 'nope' }, opts)).toThrow(/email/);
    expect(() => validateResponseAnswers(schema, { name: 'Bob', age: 5 }, opts)).toThrow(/at least 18/);
    expect(() => validateResponseAnswers(schema, { name: 'Bob', color: 'green' }, opts)).toThrow(/options/);
  });

  it('enforces checkbox max selections', () => {
    expect(() => validateResponseAnswers(schema, { name: 'Bob', tags: ['a', 'b'] }, opts)).toThrow(/at most 1/);
  });

  it('fails closed when the schema is missing', () => {
    expect(() => validateResponseAnswers(null, { name: 'Bob' }, opts)).toThrow(/unavailable/);
  });

  it('accepts a JSON-encoded string schema', () => {
    expect(validateResponseAnswers(JSON.stringify(schema), { name: 'Bob', extra: 1 }, opts)).toEqual({ name: 'Bob' });
  });

  it('fails closed when the string schema is not valid JSON', () => {
    expect(() => validateResponseAnswers('{not json', { name: 'Bob' }, opts)).toThrow(/unavailable/);
  });
});

describe('validateResponseAnswers: rating field', () => {
  const ratingSchema = (extra: Record<string, unknown>, required = false) => ({
    ...schema,
    pages: [
      {
        id: 'p1',
        title: 'Page',
        order: 0,
        fields: [
          { id: 'r', type: 'rating_field', label: 'Score', validation: { required }, ...extra },
        ],
      },
    ],
  });
  const stars = ratingSchema({ ratingStyle: 'stars', minValue: 1, maxValue: 5 });
  const nps = ratingSchema({ ratingStyle: 'scale', minValue: 0, maxValue: 10 });

  it('keeps a whole number within the range, including 0 on a 0-10 scale', () => {
    expect(validateResponseAnswers(stars, { r: 4 }, opts)).toEqual({ r: 4 });
    expect(validateResponseAnswers(nps, { r: 0 }, opts)).toEqual({ r: 0 });
    expect(validateResponseAnswers(nps, { r: 10 }, opts)).toEqual({ r: 10 });
  });

  it('rejects out-of-range, fractional, string and boolean answers', () => {
    expect(() => validateResponseAnswers(stars, { r: 0 }, opts)).toThrow(/between 1 and 5/);
    expect(() => validateResponseAnswers(stars, { r: 6 }, opts)).toThrow(/between 1 and 5/);
    expect(() => validateResponseAnswers(nps, { r: 11 }, opts)).toThrow(/between 0 and 10/);
    expect(() => validateResponseAnswers(stars, { r: 2.5 }, opts)).toThrow(/whole number/);
    expect(() => validateResponseAnswers(stars, { r: '4' }, opts)).toThrow(/whole number/);
    expect(() => validateResponseAnswers(stars, { r: true }, opts)).toThrow(/whole number/);
  });

  it('enforces required but accepts a blank optional rating', () => {
    const required = ratingSchema({ ratingStyle: 'stars', minValue: 1, maxValue: 5 }, true);
    expect(() => validateResponseAnswers(required, {}, opts)).toThrow(/Score/);
    expect(() => validateResponseAnswers(required, { r: '' }, opts)).toThrow(/required/);
    expect(validateResponseAnswers(required, {}, { ...opts, partial: true })).toEqual({});
    expect(validateResponseAnswers(stars, {}, opts)).toEqual({});
    expect(validateResponseAnswers(stars, { r: '' }, opts)).toEqual({ r: '' });
  });

  it('repairs a corrupt stored range instead of trusting it', () => {
    const corrupt = ratingSchema({ ratingStyle: 'stars', minValue: 0, maxValue: 99 });
    // Stars start at 1 and max is capped at 10
    expect(() => validateResponseAnswers(corrupt, { r: 0 }, opts)).toThrow(/between 1 and 10/);
    expect(validateResponseAnswers(corrupt, { r: 10 }, opts)).toEqual({ r: 10 });
  });
});
