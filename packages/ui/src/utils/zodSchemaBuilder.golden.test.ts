/**
 * Phase 0c golden baseline (docs/grid-layout-strategy.md §15.3): what the form
 * validators produce today, per field type, for valid / empty / invalid /
 * boundary input, with and without hidden ids and required overrides. Later
 * grid phases must leave these snapshots byte-identical (R2/R4); do not update
 * them in a grid PR.
 */
import { describe, it, expect } from 'vitest';
import {
  FormPage,
  FormField,
  TextInputField,
  TextAreaField,
  EmailField,
  PhoneNumberField,
  NumberField,
  DateField,
  SelectField,
  RadioField,
  CheckboxField,
  FileUploadField,
  RichTextFormField,
  TextFieldValidation,
  CheckboxFieldValidation,
  FillableFormFieldValidation,
} from '@dculus/types';
import {
  createPageSchema,
  createPageDefaultValues,
  validatePageData,
} from './zodSchemaBuilder';

const req = (required: boolean) => new FillableFormFieldValidation(required);
const pageOf = (...fields: FormField[]): FormPage => ({ id: 'p', title: 'P', order: 0, fields });

// [field, inputs to try]
const matrix: Record<string, [FormField, unknown[]]> = {
  'text required min3 max5': [
    new TextInputField('f', 'Q', '', '', '', '', new TextFieldValidation(true, 3, 5)),
    ['', 'ab', 'abc', 'abcde', 'abcdef', undefined, 42],
  ],
  'text optional': [
    new TextInputField('f', 'Q', '', '', '', '', new TextFieldValidation(false)),
    ['', 'anything', undefined],
  ],
  'textarea required max10': [
    new TextAreaField('f', 'Q', '', '', '', '', new TextFieldValidation(true, undefined, 10)),
    ['', 'hello', 'hello world!'],
  ],
  'email required': [
    new EmailField('f', 'Q', '', '', '', '', req(true)),
    ['', 'nope', 'a@b', 'a@b.co', ' a@b.co '],
  ],
  'email optional': [new EmailField('f', 'Q', '', '', '', '', req(false)), ['', 'nope', 'a@b.co']],
  'phone required': [
    new PhoneNumberField('f', 'Q', '', '', '', '', req(true)),
    ['', '12', '+14155552671', '4155552671'],
  ],
  'number required 18-99': [
    new NumberField('f', 'Q', '', '', '', '', req(true), 18, 99),
    ['', 17, 18, 99, 100, '30', 'abc', 0],
  ],
  'number optional': [new NumberField('f', 'Q', '', '', '', '', req(false)), ['', 0, -5, 1.5]],
  'date required bounded': [
    new DateField('f', 'Q', '', '', '', '', req(true), '2026-01-01', '2026-12-31'),
    ['', '2025-12-31', '2026-01-01', '2026-06-15', '2026-12-31', '2027-01-01', 'not-a-date'],
  ],
  'select required': [
    new SelectField('f', 'Q', '', '', '', req(true), ['A', 'B']),
    ['', 'A', 'Z'],
  ],
  'radio required': [new RadioField('f', 'Q', '', '', '', req(true), ['A', 'B']), ['', 'A', 'Z']],
  'checkbox optional min2 max3': [
    new CheckboxField('f', 'Q', [], '', '', '', new CheckboxFieldValidation(false, 2, 3), ['X', 'Y', 'Z', 'W']),
    [[], ['X'], ['X', 'Y'], ['X', 'Y', 'Z'], ['X', 'Y', 'Z', 'W'], undefined],
  ],
  'checkbox required': [
    new CheckboxField('f', 'Q', [], '', '', '', new CheckboxFieldValidation(true), ['X', 'Y']),
    [[], ['X'], undefined],
  ],
  'file required max2': [
    new FileUploadField('f', 'Q', '', '', req(true), undefined, undefined, 2),
    [[], [{ name: 'a.pdf' }], [{ name: 'a' }, { name: 'b' }, { name: 'c' }], undefined],
  ],
  'file optional': [new FileUploadField('f', 'Q', '', '', req(false)), [[], undefined]],
  'rich text (non-fillable)': [new RichTextFormField('f', '<p>hi</p>'), ['', undefined, 'x']],
};

const outcome = (page: FormPage, data: Record<string, unknown>) => {
  const result = validatePageData(page, data);
  return result.isValid ? 'valid' : result.errors.map((e) => `${e.field}: ${e.message}`);
};

describe('validators per field type (golden)', () => {
  Object.entries(matrix).forEach(([name, [field, inputs]]) => {
    it(name, () => {
      const rows = inputs.map((input) => ({
        input: input === undefined ? '<undefined>' : input,
        result: outcome(pageOf(field), { f: input }),
      }));
      expect(rows).toMatchSnapshot();
    });
  });
});

describe('page-level validator behaviour (golden)', () => {
  const mixed = pageOf(
    new TextInputField('t', 'T', '', '', '', '', new TextFieldValidation(true, 2)),
    new EmailField('e', 'E', '', '', '', '', req(true)),
    new RichTextFormField('r', '<p>note</p>'),
    new NumberField('n', 'N', '5', '', '', '', req(false), 1, 10)
  );

  it('createPageSchema key set includes every field id, rich text included', () => {
    expect(Object.keys(createPageSchema(mixed).shape)).toMatchSnapshot();
  });

  it('createPageDefaultValues per type', () => {
    const all = pageOf(...Object.values(matrix).map(([field], i) => ({ ...field, id: `f${i}` }) as FormField));
    expect(createPageDefaultValues(all)).toMatchSnapshot();
  });

  it('a page with several invalid fields reports errors in field order', () => {
    expect(outcome(mixed, { t: '', e: 'bad', r: '', n: 50 })).toMatchSnapshot();
  });

  it('hidden ids drop their keys; required overrides flip required both ways', () => {
    const hidden = validatePageData(mixed, { t: '', e: 'bad', r: '', n: 5 }, new Set(['t', 'e']));
    const overrides = validatePageData(
      mixed,
      { t: '', e: '', r: '', n: '' },
      undefined,
      new Map([
        ['t', false],
        ['n', true],
      ])
    );
    expect({ hidden, overrides }).toMatchSnapshot();
  });
});
