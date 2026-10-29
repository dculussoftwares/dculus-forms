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
});
