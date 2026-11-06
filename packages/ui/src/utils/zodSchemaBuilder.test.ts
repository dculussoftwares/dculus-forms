import { describe, it, expect } from 'vitest';
import {
  FormPage,
  TextInputField,
  EmailField,
  PhoneNumberField,
  NumberField,
  RatingField,
  DateField,
  SelectField,
  CheckboxField,
  FileUploadField,
  TextFieldValidation,
  CheckboxFieldValidation,
  FillableFormFieldValidation,
} from '@dculus/types';
import { createPageDefaultValues, createPageSchema, validatePageData } from './zodSchemaBuilder';

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

describe('conditional required overrides', () => {
  it('makes an optional text field required without mutating the field', () => {
    const target = page.fields[0];
    expect(createPageSchema(page, undefined, new Map([['text', true]])).safeParse({ ...validData, text: '' }).success).toBe(false);
    expect(target.validation.required).toBe(true);
  });

  it('makes a required field optional in both schema gates', () => {
    const overrides = new Map([['text', false]]);
    expect(createPageSchema(page, undefined, overrides).safeParse({ ...validData, text: '' }).success).toBe(true);
    expect(validatePageData(page, { ...validData, text: '' }, undefined, overrides).isValid).toBe(true);
  });

  it('hidden fields win over a required override', () => {
    const overrides = new Map([['text', true]]);
    expect(createPageSchema(page, new Set(['text']), overrides).safeParse({ ...validData, text: '' }).success).toBe(true);
    expect(validatePageData(page, { ...validData, text: '' }, new Set(['text']), overrides).isValid).toBe(true);
  });
});

describe('rating field validation', () => {
  const ratingPage = (field: RatingField): FormPage => ({ id: 'p', title: 'P', order: 0, fields: [field] });
  const stars = (req: boolean) =>
    ratingPage(new RatingField('r', 'Rating', '', '', '', '', new FillableFormFieldValidation(req), 'stars', 1, 5));
  const nps = (req: boolean) =>
    ratingPage(new RatingField('r', 'Score', '', '', '', '', new FillableFormFieldValidation(req), 'scale', 0, 10));
  const ok = (p: FormPage, value: unknown) => validatePageData(p, { r: value }).isValid;

  it('accepts whole numbers inside the range, including 0 on a 0-10 scale', () => {
    expect(ok(stars(true), 1)).toBe(true);
    expect(ok(stars(true), 5)).toBe(true);
    expect(ok(nps(true), 0)).toBe(true);
    expect(ok(nps(true), 10)).toBe(true);
  });

  it('rejects out-of-range, fractional and non-numeric answers', () => {
    expect(ok(stars(false), 0)).toBe(false);
    expect(ok(stars(false), 6)).toBe(false);
    expect(ok(nps(false), 11)).toBe(false);
    expect(ok(nps(false), -1)).toBe(false);
    expect(ok(stars(false), 2.5)).toBe(false);
    expect(ok(stars(false), 'four')).toBe(false);
  });

  it('enforces required, treating 0 as an answer', () => {
    expect(ok(stars(true), '')).toBe(false);
    expect(ok(stars(true), undefined)).toBe(false);
    expect(ok(nps(true), 0)).toBe(true);
  });

  it('lets an optional rating stay blank', () => {
    expect(ok(stars(false), '')).toBe(true);
    expect(ok(stars(false), undefined)).toBe(true);
    expect(createPageSchema(stars(false)).safeParse({ r: '' }).success).toBe(true);
  });

  it('uses the field own range in the error message', () => {
    const result = validatePageData(nps(false), { r: 12 });
    expect(result.errors[0].message).toContain('between 0 and 10');
  });

  it('starts empty', () => {
    expect(createPageDefaultValues(stars(false))).toEqual({ r: '' });
  });
});
