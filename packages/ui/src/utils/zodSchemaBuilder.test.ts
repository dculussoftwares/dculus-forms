import { describe, it, expect } from 'vitest';
import {
  FormPage,
  TextInputField,
  EmailField,
  PhoneNumberField,
  NumberField,
  DateField,
  SelectField,
  CheckboxField,
  FileUploadField,
  TextFieldValidation,
  CheckboxFieldValidation,
  FillableFormFieldValidation,
} from '@dculus/types';
import { createPageSchema, validatePageData } from './zodSchemaBuilder';

const required = new FillableFormFieldValidation(true);
const optional = new FillableFormFieldValidation(false);

const page: FormPage = {
  id: 'p1',
  title: 'Page 1',
  order: 0,
  fields: [
    new TextInputField('text', 'Name', '', '', '', '', new TextFieldValidation(true, 3)),
    new EmailField('email', 'Email', '', '', '', '', required),
    new PhoneNumberField('phone', 'Phone', '', '', '', '', required),
    new NumberField('number', 'Age', '', '', '', '', required, 18, 99),
    new DateField('date', 'Date', '', '', '', '', optional, '2026-01-01', '2026-12-31'),
    new SelectField('select', 'Pick', '', '', '', required, ['A', 'B']),
    new CheckboxField('checkbox', 'Choose', [], '', '', '', new CheckboxFieldValidation(false, 2), ['X', 'Y', 'Z']),
    new FileUploadField('file', 'Upload', '', '', required, undefined, undefined, 3),
  ],
};

// Data that satisfies every visible field on the page
const validData = {
  text: 'Jane',
  email: 'jane@example.com',
  phone: '+14155552671',
  number: 30,
  date: '2026-06-15',
  select: 'A',
  checkbox: ['X', 'Y'],
  file: [{ name: 'a.pdf' }],
};

describe('createPageSchema without hidden fields (back-compat)', () => {
  it('accepts valid data and rejects missing required fields', () => {
    expect(createPageSchema(page).safeParse(validData).success).toBe(true);
    expect(
      createPageSchema(page).safeParse({ ...validData, text: '' }).success
    ).toBe(false);
  });

  it('an explicit empty hidden set behaves like no hidden set', () => {
    const schema = createPageSchema(page, new Set());
    expect(schema.safeParse({ ...validData, email: 'junk' }).success).toBe(false);
  });
});

describe('createPageSchema with hidden fields — schema-key omission (§9.6)', () => {
  it('omits the hidden field key entirely instead of relaxing it', () => {
    const schema = createPageSchema(page, new Set(['text']));
    expect(Object.keys(schema.shape)).not.toContain('text');
    expect(Object.keys(schema.shape)).toContain('email');
  });

  it('hidden required text with minLength never blocks (missing or invalid value)', () => {
    const schema = createPageSchema(page, new Set(['text']));
    const withoutText = Object.fromEntries(
      Object.entries(validData).filter(([key]) => key !== 'text')
    );
    expect(schema.safeParse(withoutText).success).toBe(true);
    // stale too-short value still in the data (kept-while-filling policy)
    expect(schema.safeParse({ ...validData, text: 'ab' }).success).toBe(true);
  });

  it('hidden required email ignores an invalid stale value', () => {
    const schema = createPageSchema(page, new Set(['email']));
    expect(schema.safeParse({ ...validData, email: 'not-an-email' }).success).toBe(true);
  });

  it('hidden required phone never demands a value', () => {
    const schema = createPageSchema(page, new Set(['phone']));
    expect(schema.safeParse({ ...validData, phone: '' }).success).toBe(true);
  });

  it("hidden required number with '' passes and its min/max refine cannot fire", () => {
    const schema = createPageSchema(page, new Set(['number']));
    expect(schema.safeParse({ ...validData, number: '' }).success).toBe(true);
    expect(schema.safeParse({ ...validData, number: 7 }).success).toBe(true); // out of 18–99
  });

  it('hidden date with a value outside minDate/maxDate passes', () => {
    const schema = createPageSchema(page, new Set(['date']));
    expect(schema.safeParse({ ...validData, date: '2020-01-01' }).success).toBe(true);
  });

  it('hidden required select never demands a choice', () => {
    const schema = createPageSchema(page, new Set(['select']));
    expect(schema.safeParse({ ...validData, select: '' }).success).toBe(true);
  });

  it('hidden optional checkbox with minSelections cannot block (§4 nuance)', () => {
    // visible: 1 of minimum 2 selections → blocks
    expect(
      createPageSchema(page).safeParse({ ...validData, checkbox: ['X'] }).success
    ).toBe(false);
    // hidden: same data passes
    expect(
      createPageSchema(page, new Set(['checkbox'])).safeParse({
        ...validData,
        checkbox: ['X'],
      }).success
    ).toBe(true);
  });

  it('hidden required file upload never demands an upload', () => {
    const schema = createPageSchema(page, new Set(['file']));
    expect(schema.safeParse({ ...validData, file: [] }).success).toBe(true);
  });

  it('visible fields keep validating while others are hidden', () => {
    const schema = createPageSchema(page, new Set(['text', 'number']));
    expect(
      schema.safeParse({ ...validData, text: '', number: '', email: 'junk' }).success
    ).toBe(false);
    expect(
      schema.safeParse({ ...validData, text: '', number: '' }).success
    ).toBe(true);
  });

  it('a fully hidden page validates any data', () => {
    const allIds = new Set(page.fields.map((f) => f.id));
    expect(createPageSchema(page, allIds).safeParse({}).success).toBe(true);
  });
});

describe('validatePageData with hidden fields (§4.2 second gate)', () => {
  it('fails on hidden-field errors without the hidden set (the silent data-loss path)', () => {
    const data = { ...validData, text: '' };
    expect(validatePageData(page, data).isValid).toBe(false);
  });

  it('passes the same data once the hidden set is threaded through', () => {
    const data = { ...validData, text: '' };
    const result = validatePageData(page, data, new Set(['text']));
    expect(result.isValid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('still reports visible-field errors with field ids', () => {
    const result = validatePageData(
      page,
      { ...validData, email: 'junk' },
      new Set(['text'])
    );
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.field === 'email')).toBe(true);
    expect(result.errors.some((e) => e.field === 'text')).toBe(false);
  });
});
