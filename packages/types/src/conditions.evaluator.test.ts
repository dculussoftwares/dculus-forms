import { describe, it, expect } from 'vitest';
import {
  evaluateConditions,
  type ConditionalRule,
  type ConditionOperator,
  type ConditionTerm,
  type FormResponsesByPage,
} from './conditions.js';
import {
  FormPage,
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
} from './index.js';

// ---------------------------------------------------------------------------
// Fixture: two pages covering every field type
// ---------------------------------------------------------------------------

const v = new FillableFormFieldValidation(false);
const tv = new TextFieldValidation(false);
const cv = new CheckboxFieldValidation(false);

const pages: FormPage[] = [
  {
    id: 'p1',
    title: 'Page 1',
    order: 0,
    fields: [
      new TextInputField('text', 'Text', '', '', '', '', tv),
      new TextAreaField('textarea', 'TextArea', '', '', '', '', tv),
      new EmailField('email', 'Email', '', '', '', '', v),
      new PhoneNumberField('phone', 'Phone', '', '', '', '', v),
      new NumberField('number', 'Number', '', '', '', '', v),
    ],
  },
  {
    id: 'p2',
    title: 'Page 2',
    order: 1,
    fields: [
      new DateField('date', 'Date', '', '', '', '', v),
      new SelectField('select', 'Select', '', '', '', v, ['Yes', 'No']),
      new RadioField('radio', 'Radio', '', '', '', v, ['A', 'B']),
      new CheckboxField('checkbox', 'Checkbox', [], '', '', '', cv, ['X', 'Y', 'Z']),
      new FileUploadField('file', 'File', '', '', v),
      new RichTextFormField('richtext', '<p>Info</p>'),
    ],
  },
];

const schema = { pages };

const fieldPage: Record<string, string> = {
  text: 'p1',
  textarea: 'p1',
  email: 'p1',
  phone: 'p1',
  number: 'p1',
  date: 'p2',
  select: 'p2',
  radio: 'p2',
  checkbox: 'p2',
  file: 'p2',
  richtext: 'p2',
};

const responsesWith = (values: Record<string, unknown>): FormResponsesByPage => {
  const responses: FormResponsesByPage = { p1: {}, p2: {} };
  for (const [fieldId, value] of Object.entries(values)) {
    responses[fieldPage[fieldId]][fieldId] = value;
  }
  return responses;
};

// A single-rule harness: does `term` match, observed via a hideField action?
const termMatches = (
  term: ConditionTerm,
  values: Record<string, unknown>
): boolean => {
  const rules: ConditionalRule[] = [
    {
      id: 'r1',
      enabled: true,
      combinator: 'all',
      terms: [term],
      actions: [{ type: 'hideField', fieldIds: ['richtext'] }],
    },
  ];
  const result = evaluateConditions(rules, responsesWith(values), schema);
  return result.hiddenFieldIds.has('richtext');
};

const expectMatch = (
  fieldId: string,
  operator: ConditionOperator,
  value: ConditionTerm['value'],
  storeValue: unknown,
  expected: boolean
) => {
  expect(
    termMatches({ fieldId, operator, value }, { [fieldId]: storeValue }),
    `${fieldId} ${operator} ${JSON.stringify(value)} vs ${JSON.stringify(storeValue)}`
  ).toBe(expected);
};

// ---------------------------------------------------------------------------
// Operator semantics per field type
// ---------------------------------------------------------------------------

describe('text-like triggers (TextInput / TextArea / Email)', () => {
  it('equals is trimmed and case-insensitive', () => {
    expectMatch('text', 'equals', 'Hello', 'hello', true);
    expectMatch('text', 'equals', ' hello ', 'HELLO  ', true);
    expectMatch('textarea', 'equals', 'hello', 'world', false);
  });

  it('notEquals is the complement, including on empty values', () => {
    expectMatch('text', 'notEquals', 'hello', 'world', true);
    expectMatch('text', 'notEquals', 'hello', 'HELLO', false);
    expectMatch('text', 'notEquals', 'hello', '', true);
    expectMatch('text', 'notEquals', 'hello', undefined, true);
  });

  it('contains / notContains', () => {
    expectMatch('text', 'contains', 'ell', 'Hello', true);
    expectMatch('text', 'contains', 'xyz', 'Hello', false);
    expectMatch('text', 'notContains', 'xyz', 'Hello', true);
    expectMatch('text', 'notContains', 'ell', 'Hello', false);
    expectMatch('text', 'notContains', 'x', '', true);
  });

  it('startsWith / endsWith', () => {
    expectMatch('text', 'startsWith', 'he', 'Hello', true);
    expectMatch('text', 'startsWith', 'lo', 'Hello', false);
    expectMatch('text', 'endsWith', 'lo', 'Hello', true);
    expectMatch('text', 'endsWith', 'he', 'Hello', false);
  });

  it('email endsWith enables domain rules', () => {
    expectMatch('email', 'endsWith', '@acme.com', 'jane@ACME.com', true);
    expectMatch('email', 'endsWith', '@acme.com', 'jane@other.com', false);
  });

  it('isEmpty / isFilled treat whitespace-only as empty', () => {
    expectMatch('text', 'isEmpty', undefined, '', true);
    expectMatch('text', 'isEmpty', undefined, '   ', true);
    expectMatch('text', 'isEmpty', undefined, undefined, true);
    expectMatch('text', 'isEmpty', undefined, 'x', false);
    expectMatch('text', 'isFilled', undefined, 'x', true);
    expectMatch('text', 'isFilled', undefined, '  ', false);
  });

  it('numeric rule values are coerced to strings', () => {
    expectMatch('text', 'equals', 42, '42', true);
  });

  it('missing/blank/array rule values never match, even for negated operators', () => {
    expectMatch('text', 'equals', undefined, 'x', false);
    expectMatch('text', 'notEquals', undefined, 'x', false);
    expectMatch('text', 'equals', '   ', 'x', false);
    expectMatch('text', 'contains', ['a'], 'a', false);
  });

  it('unsupported operators for the type are false', () => {
    expectMatch('text', 'lessThan', 5, 'hello', false);
    expectMatch('text', 'before', '2026-01-01', 'hello', false);
  });
});

describe('phone triggers', () => {
  it('compares raw E.164 exactly', () => {
    expectMatch('phone', 'equals', '+919876543210', '+919876543210', true);
    expectMatch('phone', 'equals', '+919876543210', '+919876543211', false);
    expectMatch('phone', 'notEquals', '+91', '+14155552671', true);
  });

  it('startsWith enables country-code rules', () => {
    expectMatch('phone', 'startsWith', '+91', '+919876543210', true);
    expectMatch('phone', 'startsWith', '+91', '+14155552671', false);
    expectMatch('phone', 'startsWith', '+91', '', false);
  });

  it('isEmpty / isFilled', () => {
    expectMatch('phone', 'isEmpty', undefined, '', true);
    expectMatch('phone', 'isEmpty', undefined, undefined, true);
    expectMatch('phone', 'isFilled', undefined, '+919876543210', true);
  });

  it('text-only operators are not supported for phone', () => {
    expectMatch('phone', 'contains', '98', '+919876543210', false);
    expectMatch('phone', 'endsWith', '10', '+919876543210', false);
  });

  it('numeric rule values are rejected (string-only), even for notEquals', () => {
    expectMatch('phone', 'equals', 919876543210, '+919876543210', false);
    expectMatch('phone', 'notEquals', 42, '+919876543210', false);
    expectMatch('phone', 'startsWith', 91, '+919876543210', false);
  });
});

describe('number triggers', () => {
  it('equals / notEquals', () => {
    expectMatch('number', 'equals', 5, 5, true);
    expectMatch('number', 'equals', 5, 6, false);
    expectMatch('number', 'notEquals', 5, 6, true);
    expectMatch('number', 'notEquals', 5, 5, false);
    expectMatch('number', 'notEquals', 5, '', true);
  });

  it('lessThan / greaterThan; empty never compares', () => {
    expectMatch('number', 'lessThan', 10, 5, true);
    expectMatch('number', 'lessThan', 10, 10, false);
    expectMatch('number', 'greaterThan', 10, 11, true);
    expectMatch('number', 'greaterThan', 10, 10, false);
    expectMatch('number', 'lessThan', 10, '', false);
    expectMatch('number', 'lessThan', 10, undefined, false);
  });

  it('0 is a filled value', () => {
    expectMatch('number', 'isFilled', undefined, 0, true);
    expectMatch('number', 'isEmpty', undefined, 0, false);
    expectMatch('number', 'equals', 0, 0, true);
    expectMatch('number', 'lessThan', 1, 0, true);
  });

  it('empty shapes: "", undefined, null, NaN', () => {
    expectMatch('number', 'isEmpty', undefined, '', true);
    expectMatch('number', 'isEmpty', undefined, undefined, true);
    expectMatch('number', 'isEmpty', undefined, null, true);
    expectMatch('number', 'isEmpty', undefined, NaN, true);
  });

  it('numeric-string rule values are coerced; junk never matches', () => {
    expectMatch('number', 'equals', '5', 5, true);
    expectMatch('number', 'lessThan', 'abc', 5, false);
    expectMatch('number', 'equals', undefined, 5, false);
  });

  it('text operators are not supported for number', () => {
    expectMatch('number', 'contains', '5', 55, false);
    expectMatch('number', 'startsWith', '5', 55, false);
  });
});

describe('date triggers', () => {
  it('equals / notEquals as ISO string compare', () => {
    expectMatch('date', 'equals', '2026-07-16', '2026-07-16', true);
    expectMatch('date', 'equals', '2026-07-16', '2026-07-17', false);
    expectMatch('date', 'equals', '2026-07-16', '', false);
    expectMatch('date', 'notEquals', '2026-07-16', '2026-07-17', true);
    expectMatch('date', 'notEquals', '2026-07-16', '', true);
  });

  it('before / after; empty never compares', () => {
    expectMatch('date', 'before', '2026-07-16', '2026-07-15', true);
    expectMatch('date', 'before', '2026-07-16', '2026-07-16', false);
    expectMatch('date', 'after', '2026-07-16', '2026-07-17', true);
    expectMatch('date', 'after', '2026-07-16', '2026-12-31', true);
    expectMatch('date', 'before', '2026-07-16', '', false);
    expectMatch('date', 'after', '2026-07-16', undefined, false);
  });

  it('isEmpty / isFilled', () => {
    expectMatch('date', 'isEmpty', undefined, '', true);
    expectMatch('date', 'isFilled', undefined, '2026-07-16', true);
  });

  it('unsupported operators are false', () => {
    expectMatch('date', 'lessThan', '2026-07-16', '2026-07-15', false);
    expectMatch('date', 'contains', '07', '2026-07-16', false);
  });

  it('numeric rule values are rejected (string-only), even for notEquals', () => {
    expectMatch('date', 'equals', 20260716, '2026-07-16', false);
    expectMatch('date', 'notEquals', 20260716, '2026-07-16', false);
    expectMatch('date', 'before', 20260716, '2026-07-15', false);
  });
});

describe('select / radio triggers', () => {
  it('equals is an exact, case-sensitive option match', () => {
    expectMatch('select', 'equals', 'Yes', 'Yes', true);
    expectMatch('select', 'equals', 'Yes', 'yes', false);
    expectMatch('radio', 'equals', 'A', 'A', true);
    expectMatch('radio', 'equals', 'A', 'B', false);
  });

  it('notEquals is the complement, including nothing selected', () => {
    expectMatch('select', 'notEquals', 'Yes', 'No', true);
    expectMatch('select', 'notEquals', 'Yes', 'Yes', false);
    expectMatch('select', 'notEquals', 'Yes', '', true);
    expectMatch('radio', 'notEquals', 'A', undefined, true);
  });

  it('isEmpty / isFilled', () => {
    expectMatch('select', 'isEmpty', undefined, '', true);
    expectMatch('select', 'isFilled', undefined, 'Yes', true);
    expectMatch('radio', 'isEmpty', undefined, undefined, true);
  });

  it('unsupported operators are false', () => {
    expectMatch('select', 'contains', 'Ye', 'Yes', false);
    expectMatch('select', 'startsWith', 'Y', 'Yes', false);
  });
});

describe('checkbox triggers', () => {
  it('contains / notContains as array membership', () => {
    expectMatch('checkbox', 'contains', 'X', ['X', 'Y'], true);
    expectMatch('checkbox', 'contains', 'Z', ['X', 'Y'], false);
    expectMatch('checkbox', 'notContains', 'Z', ['X', 'Y'], true);
    expectMatch('checkbox', 'notContains', 'X', ['X'], false);
  });

  it('notContains matches the empty array', () => {
    expectMatch('checkbox', 'notContains', 'X', [], true);
    expectMatch('checkbox', 'notContains', 'X', undefined, true);
  });

  it('isEmpty / isFilled', () => {
    expectMatch('checkbox', 'isEmpty', undefined, [], true);
    expectMatch('checkbox', 'isEmpty', undefined, undefined, true);
    expectMatch('checkbox', 'isFilled', undefined, ['X'], true);
  });

  it('array or missing rule values never match', () => {
    expectMatch('checkbox', 'contains', ['X'], ['X'], false);
    expectMatch('checkbox', 'notContains', undefined, [], false);
  });

  it('unsupported operators are false', () => {
    expectMatch('checkbox', 'equals', 'X', ['X'], false);
  });
});

describe('file upload triggers', () => {
  it('isFilled / isEmpty on array length (File[] or uploaded keys)', () => {
    expectMatch('file', 'isFilled', undefined, [{ name: 'a.pdf' }], true);
    expectMatch('file', 'isFilled', undefined, ['uploads/key-1'], true);
    expectMatch('file', 'isFilled', undefined, [], false);
    expectMatch('file', 'isEmpty', undefined, [], true);
    expectMatch('file', 'isEmpty', undefined, undefined, true);
  });

  it('every other operator is false', () => {
    expectMatch('file', 'equals', 'a.pdf', [{ name: 'a.pdf' }], false);
    expectMatch('file', 'contains', 'a', ['a'], false);
  });
});

describe('trigger robustness', () => {
  it('RichText is never a valid trigger', () => {
    expectMatch('richtext', 'isEmpty', undefined, undefined, false);
    expectMatch('richtext', 'isFilled', undefined, undefined, false);
    expectMatch('richtext', 'equals', 'x', 'x', false);
  });

  it('terms referencing unknown fields are false', () => {
    expect(
      termMatches({ fieldId: 'ghost', operator: 'isEmpty' }, {})
    ).toBe(false);
  });

  it('terms referencing soft-deleted fields are false', () => {
    const deletedField = new TextInputField('gone', 'Gone', '', '', '', '', tv);
    deletedField.deleted = true;
    const localSchema = {
      pages: [
        {
          id: 'p1',
          title: 'P',
          order: 0,
          fields: [deletedField, new TextInputField('live', 'Live', '', '', '', '', tv)],
        },
      ],
    };
    const rules: ConditionalRule[] = [
      {
        id: 'r',
        enabled: true,
        combinator: 'all',
        terms: [{ fieldId: 'gone', operator: 'isFilled' }],
        actions: [{ type: 'hideField', fieldIds: ['live'] }],
      },
    ];
    const result = evaluateConditions(
      rules,
      { p1: { gone: 'value present but field deleted' } },
      localSchema
    );
    expect(result.hiddenFieldIds.has('live')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Rule mechanics
// ---------------------------------------------------------------------------

describe('rule mechanics', () => {
  const hideRichtext: ConditionalRule['actions'] = [
    { type: 'hideField', fieldIds: ['richtext'] },
  ];

  it('returns empty sets for no/undefined/empty rules', () => {
    const cases: Array<ConditionalRule[] | null | undefined> = [undefined, null, []];
    for (const rules of cases) {
      const result = evaluateConditions(rules, responsesWith({}), schema);
      expect(result.hiddenFieldIds.size).toBe(0);
      expect(result.hiddenPageIds.size).toBe(0);
    }
  });

  it('never throws on malformed persisted rules (null entries, junk shapes)', () => {
    const malformed = [
      null,
      42,
      'rule',
      { id: 'no-arrays', enabled: true, combinator: 'all', terms: 'x', actions: 'y' },
      {
        id: 'null-members',
        enabled: true,
        combinator: 'any',
        terms: [null, { fieldId: 'text', operator: 'isFilled' }],
        actions: [null, { type: 'hideField', fieldIds: ['email'] }],
      },
      {
        id: 'all-null-actions',
        enabled: true,
        combinator: 'all',
        terms: [{ fieldId: 'text', operator: 'isFilled' }],
        actions: [null],
      },
      {
        id: 'term-without-fieldId',
        enabled: true,
        combinator: 'any',
        terms: [{ operator: 'isFilled' }],
        actions: [{ type: 'hideField', fieldIds: ['file'] }],
      },
      {
        id: 'non-iterable-fieldIds',
        enabled: true,
        combinator: 'all',
        terms: [{ fieldId: 'text', operator: 'isFilled' }],
        actions: [
          { type: 'showField', fieldIds: 42 },
          { type: 'hideField', fieldIds: [7, 'date'] },
          { type: 'hidePage' },
        ],
      },
    ] as unknown as ConditionalRule[];

    const result = evaluateConditions(malformed, responsesWith({ text: 'x' }), schema);
    // the one well-formed term+action pair still works ('any' combinator
    // ignores the null term; the null action is skipped)
    expect(result.hiddenFieldIds.has('email')).toBe(true);
    // term without fieldId is false → its action never fires
    expect(result.hiddenFieldIds.has('file')).toBe(false);
    // actions with non-array/non-string payloads are dropped, not iterated
    expect(result.hiddenFieldIds.has('date')).toBe(false);
    expect(result.hiddenPageIds.size).toBe(0);
  });

  it('skips disabled rules entirely — including their showField defaults', () => {
    const rules: ConditionalRule[] = [
      {
        id: 'r',
        enabled: false,
        combinator: 'all',
        terms: [{ fieldId: 'text', operator: 'isFilled' }],
        actions: [{ type: 'showField', fieldIds: ['email'] }],
      },
    ];
    const result = evaluateConditions(rules, responsesWith({ text: 'x' }), schema);
    expect(result.hiddenFieldIds.has('email')).toBe(false);
  });

  it('treats rules with zero terms or zero actions as inactive', () => {
    const rules: ConditionalRule[] = [
      { id: 'r1', enabled: true, combinator: 'all', terms: [], actions: [{ type: 'showField', fieldIds: ['email'] }] },
      { id: 'r2', enabled: true, combinator: 'all', terms: [{ fieldId: 'text', operator: 'isFilled' }], actions: [] },
    ];
    const result = evaluateConditions(rules, responsesWith({ text: 'x' }), schema);
    expect(result.hiddenFieldIds.size).toBe(0);
    expect(result.hiddenPageIds.size).toBe(0);
  });

  it('combinator all requires every term; any requires one', () => {
    const terms: ConditionTerm[] = [
      { fieldId: 'text', operator: 'equals', value: 'yes' },
      { fieldId: 'number', operator: 'greaterThan', value: 10 },
    ];
    const make = (combinator: 'any' | 'all'): ConditionalRule[] => [
      { id: 'r', enabled: true, combinator, terms, actions: hideRichtext },
    ];
    const oneTrue = responsesWith({ text: 'yes', number: 5 });
    const bothTrue = responsesWith({ text: 'yes', number: 11 });
    const noneTrue = responsesWith({ text: 'no', number: 5 });

    expect(evaluateConditions(make('all'), oneTrue, schema).hiddenFieldIds.has('richtext')).toBe(false);
    expect(evaluateConditions(make('all'), bothTrue, schema).hiddenFieldIds.has('richtext')).toBe(true);
    expect(evaluateConditions(make('any'), oneTrue, schema).hiddenFieldIds.has('richtext')).toBe(true);
    expect(evaluateConditions(make('any'), noneTrue, schema).hiddenFieldIds.has('richtext')).toBe(false);
  });

  it('showField targets start hidden and appear only when the rule matches', () => {
    const rules: ConditionalRule[] = [
      {
        id: 'r',
        enabled: true,
        combinator: 'all',
        terms: [{ fieldId: 'select', operator: 'equals', value: 'Yes' }],
        actions: [{ type: 'showField', fieldIds: ['text', 'email'] }],
      },
    ];
    const unmatched = evaluateConditions(rules, responsesWith({ select: 'No' }), schema);
    expect(unmatched.hiddenFieldIds.has('text')).toBe(true);
    expect(unmatched.hiddenFieldIds.has('email')).toBe(true);

    const matched = evaluateConditions(rules, responsesWith({ select: 'Yes' }), schema);
    expect(matched.hiddenFieldIds.has('text')).toBe(false);
    expect(matched.hiddenFieldIds.has('email')).toBe(false);
  });

  it('hideField targets start visible and hide when the rule matches', () => {
    const rules: ConditionalRule[] = [
      {
        id: 'r',
        enabled: true,
        combinator: 'all',
        terms: [{ fieldId: 'checkbox', operator: 'contains', value: 'X' }],
        actions: [{ type: 'hideField', fieldIds: ['file'] }],
      },
    ];
    expect(
      evaluateConditions(rules, responsesWith({}), schema).hiddenFieldIds.has('file')
    ).toBe(false);
    expect(
      evaluateConditions(rules, responsesWith({ checkbox: ['X'] }), schema).hiddenFieldIds.has('file')
    ).toBe(true);
  });

  it('later matched rules win on conflicting actions', () => {
    const rules: ConditionalRule[] = [
      {
        id: 'hide-first',
        enabled: true,
        combinator: 'all',
        terms: [{ fieldId: 'text', operator: 'isFilled' }],
        actions: [{ type: 'hideField', fieldIds: ['email'] }],
      },
      {
        id: 'show-second',
        enabled: true,
        combinator: 'all',
        terms: [{ fieldId: 'text', operator: 'isFilled' }],
        actions: [{ type: 'showField', fieldIds: ['email'] }],
      },
    ];
    const result = evaluateConditions(rules, responsesWith({ text: 'x' }), schema);
    expect(result.hiddenFieldIds.has('email')).toBe(false);
  });

  it('skipToPage is a no-op in v1', () => {
    const rules: ConditionalRule[] = [
      {
        id: 'r',
        enabled: true,
        combinator: 'all',
        terms: [{ fieldId: 'text', operator: 'isFilled' }],
        actions: [{ type: 'skipToPage', pageId: 'p2' }],
      },
    ];
    const result = evaluateConditions(rules, responsesWith({ text: 'x' }), schema);
    expect(result.hiddenFieldIds.size).toBe(0);
    expect(result.hiddenPageIds.size).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Page rules and cascades
// ---------------------------------------------------------------------------

describe('page rules', () => {
  it('hidePage hides the page when matched', () => {
    const rules: ConditionalRule[] = [
      {
        id: 'r',
        enabled: true,
        combinator: 'all',
        terms: [{ fieldId: 'select', operator: 'equals', value: 'No' }],
        actions: [{ type: 'hidePage', pageId: 'p1' }],
      },
    ];
    expect(
      evaluateConditions(rules, responsesWith({ select: 'Yes' }), schema).hiddenPageIds.has('p1')
    ).toBe(false);
    expect(
      evaluateConditions(rules, responsesWith({ select: 'No' }), schema).hiddenPageIds.has('p1')
    ).toBe(true);
  });

  it('showPage targets start hidden until shown', () => {
    const rules: ConditionalRule[] = [
      {
        id: 'r',
        enabled: true,
        combinator: 'all',
        terms: [{ fieldId: 'text', operator: 'isFilled' }],
        actions: [{ type: 'showPage', pageId: 'p2' }],
      },
    ];
    expect(
      evaluateConditions(rules, responsesWith({}), schema).hiddenPageIds.has('p2')
    ).toBe(true);
    expect(
      evaluateConditions(rules, responsesWith({ text: 'x' }), schema).hiddenPageIds.has('p2')
    ).toBe(false);
  });

  it('auto-skips a page when all its fields are hidden (RichText counts)', () => {
    const rules: ConditionalRule[] = [
      {
        id: 'r',
        enabled: true,
        combinator: 'all',
        terms: [{ fieldId: 'text', operator: 'equals', value: 'hide p2' }],
        actions: [
          {
            type: 'hideField',
            fieldIds: ['date', 'select', 'radio', 'checkbox', 'file', 'richtext'],
          },
        ],
      },
    ];
    const result = evaluateConditions(rules, responsesWith({ text: 'hide p2' }), schema);
    expect(result.hiddenPageIds.has('p2')).toBe(true);

    const partial = evaluateConditions(
      [
        {
          ...rules[0],
          actions: [
            { type: 'hideField', fieldIds: ['date', 'select', 'radio', 'checkbox', 'file'] },
          ],
        },
      ],
      responsesWith({ text: 'hide p2' }),
      schema
    );
    // RichText block still visible → page stays visible
    expect(partial.hiddenPageIds.has('p2')).toBe(false);
  });

  it('never auto-skips a page with zero fields', () => {
    const localSchema = {
      pages: [
        ...pages,
        { id: 'p-empty', title: 'Empty', order: 2, fields: [] },
      ],
    };
    const result = evaluateConditions([], responsesWith({}), localSchema);
    expect(result.hiddenPageIds.has('p-empty')).toBe(false);
  });

  it('fields on a hidden page evaluate as empty for other rules', () => {
    const rules: ConditionalRule[] = [
      {
        id: 'hide-p2',
        enabled: true,
        combinator: 'all',
        terms: [{ fieldId: 'text', operator: 'isFilled' }],
        actions: [{ type: 'hidePage', pageId: 'p2' }],
      },
      {
        id: 'depends-on-p2-field',
        enabled: true,
        combinator: 'all',
        terms: [{ fieldId: 'select', operator: 'equals', value: 'Yes' }],
        actions: [{ type: 'hideField', fieldIds: ['email'] }],
      },
    ];
    // select answered 'Yes', but p2 gets hidden → select reads empty → email stays visible
    const result = evaluateConditions(
      rules,
      responsesWith({ text: 'x', select: 'Yes' }),
      schema
    );
    expect(result.hiddenPageIds.has('p2')).toBe(true);
    expect(result.hiddenFieldIds.has('email')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Cascades, hidden-as-empty, and cycle safety
// ---------------------------------------------------------------------------

describe('cascading evaluation', () => {
  it('hidden trigger fields read as empty (single-source cascade)', () => {
    const rules: ConditionalRule[] = [
      {
        id: 'hide-select',
        enabled: true,
        combinator: 'all',
        terms: [{ fieldId: 'text', operator: 'equals', value: 'go' }],
        actions: [{ type: 'hideField', fieldIds: ['select'] }],
      },
      {
        id: 'select-dependent',
        enabled: true,
        combinator: 'all',
        terms: [{ fieldId: 'select', operator: 'isFilled' }],
        actions: [{ type: 'hideField', fieldIds: ['email'] }],
      },
    ];
    // select is answered but hidden by rule 1 → rule 2 must deactivate
    const result = evaluateConditions(
      rules,
      responsesWith({ text: 'go', select: 'Yes' }),
      schema
    );
    expect(result.hiddenFieldIds.has('select')).toBe(true);
    expect(result.hiddenFieldIds.has('email')).toBe(false);

    // without the hide, rule 2 fires
    const without = evaluateConditions(
      rules,
      responsesWith({ text: 'stop', select: 'Yes' }),
      schema
    );
    expect(without.hiddenFieldIds.has('select')).toBe(false);
    expect(without.hiddenFieldIds.has('email')).toBe(true);
  });

  it('converges through multi-step chains (A hides B, B-empty re-shows C)', () => {
    const rules: ConditionalRule[] = [
      {
        id: 'a-hides-b',
        enabled: true,
        combinator: 'all',
        terms: [{ fieldId: 'text', operator: 'equals', value: 'go' }],
        actions: [{ type: 'hideField', fieldIds: ['number'] }],
      },
      {
        id: 'b-hides-c',
        enabled: true,
        combinator: 'all',
        terms: [{ fieldId: 'number', operator: 'greaterThan', value: 5 }],
        actions: [{ type: 'hideField', fieldIds: ['email'] }],
      },
    ];
    // number = 10 would hide email, but number itself is hidden → email visible
    const result = evaluateConditions(
      rules,
      responsesWith({ text: 'go', number: 10 }),
      schema
    );
    expect(result.hiddenFieldIds.has('number')).toBe(true);
    expect(result.hiddenFieldIds.has('email')).toBe(false);
  });

  it('resolves oscillating cycles deterministically (self-hiding field ends visible)', () => {
    const selfHide: ConditionalRule = {
      id: 'self-hide',
      enabled: true,
      combinator: 'all',
      terms: [{ fieldId: 'text', operator: 'isFilled' }],
      actions: [{ type: 'hideField', fieldIds: ['text'] }],
    };
    // filled → hidden → reads empty → rule deactivates → visible: the state
    // sequence is {} → {text} → {} — the repeat closes the cycle at {} (visible)
    const result = evaluateConditions([selfHide], responsesWith({ text: 'x' }), schema);
    expect(result.hiddenFieldIds.size).toBe(0);
    expect(result.hiddenPageIds.size).toBe(0);
  });

  it('cycle outcome is unaffected by unrelated active rules', () => {
    const selfHide: ConditionalRule = {
      id: 'self-hide',
      enabled: true,
      combinator: 'all',
      terms: [{ fieldId: 'text', operator: 'isFilled' }],
      actions: [{ type: 'hideField', fieldIds: ['text'] }],
    };
    const unrelated: ConditionalRule = {
      id: 'unrelated',
      enabled: true,
      combinator: 'all',
      terms: [{ fieldId: 'select', operator: 'equals', value: 'Yes' }],
      actions: [{ type: 'hideField', fieldIds: ['file'] }],
    };
    const responses = responsesWith({ text: 'x', select: 'Yes' });
    const alone = evaluateConditions([selfHide], responses, schema);
    const together = evaluateConditions([selfHide, unrelated], responses, schema);
    // with a rule-count-based iteration cap the extra rule would flip the
    // oscillation parity; repeated-state detection must not
    expect(together.hiddenFieldIds.has('text')).toBe(alone.hiddenFieldIds.has('text'));
    expect(together.hiddenFieldIds.has('text')).toBe(false);
    expect(together.hiddenFieldIds.has('file')).toBe(true);
  });

  it('resolves mutual show/hide cycles deterministically (both end visible)', () => {
    const rules: ConditionalRule[] = [
      {
        id: 'a-hides-b',
        enabled: true,
        combinator: 'all',
        terms: [{ fieldId: 'text', operator: 'isFilled' }],
        actions: [{ type: 'hideField', fieldIds: ['textarea'] }],
      },
      {
        id: 'b-hides-a',
        enabled: true,
        combinator: 'all',
        terms: [{ fieldId: 'textarea', operator: 'isFilled' }],
        actions: [{ type: 'hideField', fieldIds: ['text'] }],
      },
    ];
    // {} → {textarea, text} → {} (both hidden read empty) — cycle closes at {}
    const result = evaluateConditions(
      rules,
      responsesWith({ text: 'x', textarea: 'y' }),
      schema
    );
    expect(result.hiddenFieldIds.size).toBe(0);
  });

  it('resolves independent simultaneous cycles per item (both end visible)', () => {
    const selfHide = (id: string, field: string): ConditionalRule => ({
      id,
      enabled: true,
      combinator: 'all',
      terms: [{ fieldId: field, operator: 'isFilled' }],
      actions: [{ type: 'hideField', fieldIds: [field] }],
    });
    const result = evaluateConditions(
      [selfHide('c1', 'text'), selfHide('c2', 'textarea')],
      responsesWith({ text: 'x', textarea: 'y' }),
      schema
    );
    // each oscillating item resolves to visible independently of the other
    expect(result.hiddenFieldIds.size).toBe(0);
  });

  it('converges through long directional cascade chains', () => {
    // all filled: r1 hides textarea → textarea reads empty → r2 hides email
    // → email reads empty → r3 hides phone; needs one pass per chained rule
    const rules: ConditionalRule[] = [
      {
        id: 'r1',
        enabled: true,
        combinator: 'all',
        terms: [{ fieldId: 'text', operator: 'isFilled' }],
        actions: [{ type: 'hideField', fieldIds: ['textarea'] }],
      },
      {
        id: 'r2',
        enabled: true,
        combinator: 'all',
        terms: [{ fieldId: 'textarea', operator: 'isEmpty' }],
        actions: [{ type: 'hideField', fieldIds: ['email'] }],
      },
      {
        id: 'r3',
        enabled: true,
        combinator: 'all',
        terms: [{ fieldId: 'email', operator: 'isEmpty' }],
        actions: [{ type: 'hideField', fieldIds: ['phone'] }],
      },
    ];
    const result = evaluateConditions(
      rules,
      responsesWith({ text: 'go', textarea: 'filled', email: 'a@b.co', phone: '+14155552671' }),
      schema
    );
    expect(result.hiddenFieldIds.has('textarea')).toBe(true);
    expect(result.hiddenFieldIds.has('email')).toBe(true);
    expect(result.hiddenFieldIds.has('phone')).toBe(true);
  });

  it('cross-page triggers work (p1 answer controls p2 field)', () => {
    const rules: ConditionalRule[] = [
      {
        id: 'r',
        enabled: true,
        combinator: 'all',
        terms: [{ fieldId: 'number', operator: 'greaterThan', value: 18 }],
        actions: [{ type: 'showField', fieldIds: ['date'] }],
      },
    ];
    expect(
      evaluateConditions(rules, responsesWith({ number: 17 }), schema).hiddenFieldIds.has('date')
    ).toBe(true);
    expect(
      evaluateConditions(rules, responsesWith({ number: 21 }), schema).hiddenFieldIds.has('date')
    ).toBe(false);
  });
});
