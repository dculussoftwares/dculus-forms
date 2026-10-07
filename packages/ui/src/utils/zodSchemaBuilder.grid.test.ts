/**
 * Grid Layout §15.3 equivalence: putting fields inside a grid must not change how a page validates.
 * Every field type is checked twice, top level and inside a 2-column grid; results must be identical
 * and the grid id must never become a schema key or a default value.
 */
import { describe, it, expect } from 'vitest';
import {
  type FormField,
  type FormPage,
  CheckboxField,
  CheckboxFieldValidation,
  DateField,
  EmailField,
  FileUploadField,
  FillableFormFieldValidation,
  GridField,
  NumberField,
  PhoneNumberField,
  RadioField,
  RichTextFormField,
  SelectField,
  TextAreaField,
  TextFieldValidation,
  TextInputField,
} from '@dculus/types';
import {
  createFieldSchema,
  createPageDefaultValues,
  createPageSchema,
  validatePageData,
} from './zodSchemaBuilder';

const req = (required: boolean) => new FillableFormFieldValidation(required);

// Built fresh per call so the grid variant can set pointers without touching the top-level one
const buildFields = (): FormField[] => [
  new TextInputField('text', 'Name', '', '', '', '', new TextFieldValidation(true, 2, 5)),
  new TextAreaField('area', 'Bio', '', '', '', '', new TextFieldValidation(false, undefined, 10)),
  new EmailField('email', 'Email', '', '', '', '', req(true)),
  new PhoneNumberField('phone', 'Phone', '', '', '', '', req(false)),
  new NumberField('number', 'Age', '', '', '', '', req(true), 18, 99),
  new DateField('date', 'Date', '', '', '', '', req(false), '2026-01-01', '2026-12-31'),
  new SelectField('select', 'Pick', '', '', '', req(true), ['A', 'B']),
  new RadioField('radio', 'Size', '', '', '', req(false), ['S', 'M']),
  new CheckboxField('check', 'Colours', [], '', '', '', new CheckboxFieldValidation(false, 1, 2), ['X', 'Y', 'Z']),
  new FileUploadField('file', 'Upload', '', '', req(true), undefined, undefined, 2),
  new RichTextFormField('rich', '<p>Read me</p>'),
];

const topLevelPage = (): FormPage => ({ id: 'p', title: 'P', order: 0, fields: buildFields() });

const gridPage = (): FormPage => {
  const children = buildFields().map((field, i) =>
    Object.assign(field, { gridId: 'g1', gridColumn: i % 2 })
  );
  return { id: 'p', title: 'P', order: 0, fields: [new GridField('g1', [40, 60]), ...children] };
};

const inputs: Record<string, Record<string, unknown>> = {
  valid: {
    text: 'Jane',
    area: 'short',
    email: 'jane@example.com',
    phone: '',
    number: 30,
    date: '2026-06-15',
    select: 'A',
    radio: 'S',
    check: ['X'],
    file: [{ name: 'a.pdf' }],
    rich: '',
  },
  empty: {},
  invalid: {
    text: 'x',
    area: 'this is far too long',
    email: 'nope',
    phone: '12',
    number: 5,
    date: '2027-01-01',
    select: 'Z',
    radio: 'Q',
    check: ['X', 'Y', 'Z'],
    file: [{ name: 'a' }, { name: 'b' }, { name: 'c' }],
  },
};

const outcome = (page: FormPage, data: Record<string, unknown>, hidden?: Set<string>, overrides?: Map<string, boolean>) =>
  validatePageData(page, data, hidden, overrides);

describe('grid equivalence (§15.3)', () => {
  it('builds the same schema keys, with no key for the grid', () => {
    const keys = Object.keys(createPageSchema(gridPage()).shape);
    expect(keys.sort()).toEqual(Object.keys(createPageSchema(topLevelPage()).shape).sort());
    expect(keys).not.toContain('g1');
  });

  it('produces the same default values, with none for the grid', () => {
    const defaults = createPageDefaultValues(gridPage());
    expect(defaults).toEqual(createPageDefaultValues(topLevelPage()));
    expect(defaults).not.toHaveProperty('g1');
  });

  it.each(Object.keys(inputs))('validates %s input identically, errors in the same order', (name) => {
    expect(outcome(gridPage(), inputs[name])).toEqual(outcome(topLevelPage(), inputs[name]));
  });

  it('ignores a stray value submitted under the grid id', () => {
    const withStray = { ...inputs.valid, g1: 'unexpected' };
    const result = outcome(gridPage(), withStray);
    expect(result.isValid).toBe(true);
    expect(result).toEqual(outcome(topLevelPage(), inputs.valid));
  });

  it('applies hidden fields identically', () => {
    const hidden = new Set(['text', 'email', 'file']);
    expect(outcome(gridPage(), inputs.empty, hidden)).toEqual(outcome(topLevelPage(), inputs.empty, hidden));
  });

  it('applies required overrides identically in both directions', () => {
    const overrides = new Map([
      ['text', false],
      ['area', true],
    ]);
    expect(outcome(gridPage(), inputs.empty, undefined, overrides)).toEqual(
      outcome(topLevelPage(), inputs.empty, undefined, overrides)
    );
  });

  it('a page holding only a grid has an empty schema and validates anything', () => {
    const page: FormPage = { id: 'p', title: 'P', order: 0, fields: [new GridField('g1')] };
    expect(Object.keys(createPageSchema(page).shape)).toEqual([]);
    expect(outcome(page, { g1: 'x' }).isValid).toBe(true);
  });

  it('createFieldSchema accepts anything for a layout field', () => {
    const schema = createFieldSchema(new GridField('g1'));
    for (const value of [undefined, '', 'x', 1, [], {}]) {
      expect(schema.safeParse(value).success).toBe(true);
    }
  });
});
