// apps/backend/src/lib/__tests__/aiFormEditTools.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createFormEditTools } from '../aiFormEditTools.js';
import { prisma } from '../prisma.js';

vi.mock('../prisma.js', () => ({
  prisma: {
    formPlugin: {
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn().mockResolvedValue(null),
    },
  },
}));

const mockSchema = {
  pages: [
    {
      id: 'page-1',
      fields: [
        { id: 'f-1', type: 'TEXT_INPUT_FIELD', label: 'Name', required: true, placeholder: 'Enter name', hint: '', options: null },
        { id: 'f-2', type: 'SELECT_FIELD', label: 'Country', required: false, placeholder: '', hint: 'Pick one', options: ['USA', 'UK'] },
      ],
    },
    {
      id: 'page-2',
      fields: [
        { id: 'f-3', type: 'EMAIL_FIELD', label: 'Email', required: true, placeholder: '', hint: '', options: null },
      ],
    },
  ],
};

// Helper: always returns the full tool set (toolTier: 'full').
// Cast as any to avoid TS union type errors from conditional tool inclusion.
// Accepts any schema shape — test schemas don't need all optional field properties.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const makeFullTools = (schema: any = mockSchema, opts: Record<string, unknown> = {}) =>
  createFormEditTools(schema, { toolTier: 'full', ...opts }) as any;


describe('createFormEditTools', () => {
  it('returns all tools when toolTier is full (read tools included)', () => {
    const tools = createFormEditTools(mockSchema, { toolTier: 'full' });
    const keys = Object.keys(tools);
    // All 14 tools should be present (order doesn't matter for functionality)
    expect(keys).toContain('listFields');
    expect(keys).toContain('getField');
    expect(keys).toContain('addField');
    expect(keys).toContain('updateFields');
    expect(keys).toContain('removeFields');
    expect(keys).toContain('reorder');
    expect(keys).toContain('updateLayout');
    expect(keys).toContain('renamePage');
    expect(keys).toContain('addPage');
    expect(keys).toContain('removePage');
    expect(keys).toContain('navigateToPage');
    expect(keys).toContain('relocateField');
    expect(keys).toContain('proposeValidation');
    expect(keys).toContain('proposeFieldTypeChange');
    expect(keys).toContain('upsertConditionRule');
    expect(keys).toHaveLength(15);
  });

  it('returns full tools when includeReadTools is explicitly true', () => {
    const tools = createFormEditTools(mockSchema, { includeReadTools: true, toolTier: 'full' });
    expect(Object.keys(tools)).toContain('listFields');
    expect(Object.keys(tools)).toContain('getField');
    expect(Object.keys(tools)).toContain('removeFields');
    expect(Object.keys(tools)).toContain('proposeValidation');
  });

  it('omits listFields and getField when includeReadTools is false', () => {
    const tools = createFormEditTools(mockSchema, { includeReadTools: false, toolTier: 'full' });
    const keys = Object.keys(tools);
    expect(keys).not.toContain('listFields');
    expect(keys).not.toContain('getField');
    expect(keys).toContain('addField');
    expect(keys).toContain('removeFields');
    expect(keys).toContain('proposeValidation');
    expect(keys).toContain('proposeFieldTypeChange');
  });

  it('minimal tier includes only core CRUD tools', () => {
    const tools = createFormEditTools(mockSchema, { toolTier: 'minimal' });
    const keys = Object.keys(tools);
    expect(keys).toContain('addField');
    expect(keys).toContain('updateFields');
    expect(keys).toContain('addPage');
    expect(keys).toContain('navigateToPage');
    expect(keys).toContain('updateLayout');
    expect(keys).not.toContain('removeFields');
    expect(keys).not.toContain('relocateField');
    expect(keys).not.toContain('proposeValidation');
  });

  it('core tier excludes proposals and relocation', () => {
    const tools = createFormEditTools(mockSchema, { toolTier: 'core' });
    const keys = Object.keys(tools);
    expect(keys).toContain('removeFields');
    expect(keys).toContain('reorder');
    expect(keys).not.toContain('relocateField');
    expect(keys).not.toContain('proposeValidation');
    expect(keys).not.toContain('proposeFieldTypeChange');
  });
});

describe('listFields', () => {
  it('returns summary and compact page strings for all pages', async () => {
    const tools = makeFullTools();
    const result = await tools.listFields!.execute!({ pageId: undefined }, { messages: [], toolCallId: 'test' }) as any;
    expect(result.summary).toBe('2 pages total');
    expect(result.pages).toHaveLength(2);
    // p1 line includes page number, id, and both fields
    expect(result.pages[0]).toMatch(/^p1 "Page 1" \[id:page-1\]:/);
    expect(result.pages[0]).toContain('f-1|text|"Name"|req');
    expect(result.pages[0]).toContain('f-2|select|"Country"|opt');
    // p2 line
    expect(result.pages[1]).toMatch(/^p2 "Page 2" \[id:page-2\]:/);
    expect(result.pages[1]).toContain('f-3|email|"Email"|req');
  });

  it('filters to a specific page and preserves correct page number', async () => {
    const tools = makeFullTools();
    const result = await tools.listFields!.execute!({ pageId: 'page-2' }, { messages: [], toolCallId: 'test' }) as any;
    expect(result.pages).toHaveLength(1);
    // still shows p2 (absolute position) even when filtered
    expect(result.pages[0]).toMatch(/^p2 "Page 2" \[id:page-2\]:/);
    expect(result.pages[0]).toContain('f-3|email|"Email"|req');
  });

  it('returns empty summary for empty schema', async () => {
    const tools = makeFullTools({ pages: [] });
    const result = await tools.listFields!.execute!({ pageId: undefined }, { messages: [], toolCallId: 'test' }) as any;
    expect(result.summary).toBe('0 pages total');
    expect(result.pages).toHaveLength(0);
  });

  it('marks page as (empty) when it has no fields', async () => {
    const tools = makeFullTools({ pages: [{ id: 'p1', title: 'Blank', fields: [] }] });
    const result = await tools.listFields!.execute!({ pageId: undefined }, { messages: [], toolCallId: 'test' }) as any;
    expect(result.pages[0]).toContain('(empty)');
  });

  it('uses singular "page" when schema has exactly 1 page', async () => {
    const tools = makeFullTools({ pages: [{ id: 'p1', title: 'Only', fields: [] }] });
    const result = await tools.listFields!.execute!({ pageId: undefined }, { messages: [], toolCallId: 'test' }) as any;
    expect(result.summary).toBe('1 page total');
  });

  it('falls back to "Page N" when page title is null', async () => {
    const tools = makeFullTools({ pages: [{ id: 'p1', title: null, fields: [] }] });
    const result = await tools.listFields!.execute!({ pageId: undefined }, { messages: [], toolCallId: 'test' }) as any;
    expect(result.pages[0]).toContain('Page 1');
  });

  it('falls back to raw type when field type is not in TYPE_MAP', async () => {
    const tools = makeFullTools({ pages: [{ id: 'p1', title: 'T', fields: [
      { id: 'fx', type: 'unknown_custom_field', label: 'X', required: false },
    ] }] });
    const result = await tools.listFields!.execute!({ pageId: undefined }, { messages: [], toolCallId: 'test' }) as any;
    expect(result.pages[0]).toContain('unknown_custom_field');
  });
});

describe('getField', () => {
  it('returns full field details including pageId', async () => {
    const tools = makeFullTools();
    const result = await tools.getField!.execute!({ fieldId: 'f-2' }, { messages: [], toolCallId: 'test' });
    expect(result).toMatchObject({ id: 'f-2', type: 'SELECT_FIELD', label: 'Country', pageId: 'page-1', options: ['USA', 'UK'] });
  });

  it('returns null fallbacks for optional field properties', async () => {
    const tools = makeFullTools({ pages: [{
      id: 'px', title: 'X',
      fields: [{ id: 'fy', type: 'text', label: 'Y' }],
    }] });
    const result = await tools.getField!.execute!({ fieldId: 'fy' }, { messages: [], toolCallId: 'test' }) as any;
    expect(result.required).toBe(false);
    expect(result.placeholder).toBeNull();
    expect(result.hint).toBeNull();
    expect(result.options).toBeNull();
    expect(result.validation).toBeNull();
  });

  it('returns error for unknown fieldId', async () => {
    const tools = makeFullTools();
    const result = await tools.getField!.execute!({ fieldId: 'unknown' }, { messages: [], toolCallId: 'test' });
    expect(result).toHaveProperty('error');
  });
});

describe('addField', () => {
  it('returns ADD_FIELD op with all inputs', async () => {
    const tools = makeFullTools();
    const result = await tools.addField.execute!({
      pageId: 'page-1', insertAfterFieldId: 'f-1', fieldType: 'text',
      label: 'Last Name', required: false, placeholder: null, options: null,
    }, { messages: [], toolCallId: 'test' });
    expect(result).toEqual({ type: 'ADD_FIELD', pageId: 'page-1', insertAfterFieldId: 'f-1', fieldType: 'text', label: 'Last Name', required: false, placeholder: null, options: null });
  });

  it('ignores correctAnswers for a non-quiz field (no key, no reshuffle)', async () => {
    const tools = makeFullTools();
    const result: any = await tools.addField.execute!({
      pageId: 'page-1', insertAfterFieldId: null, fieldType: 'radio',
      label: 'Colour', required: false, placeholder: null,
      options: ['Red', 'Green', 'Blue'], correctAnswers: null,
    }, { messages: [], toolCallId: 'test' });
    expect(result.correctAnswers).toBeUndefined();
    expect(result.options).toEqual(['Red', 'Green', 'Blue']);
  });

  it('keys a quiz question and reshuffles its options', async () => {
    const tools = makeFullTools();
    const anyReordered = await Promise.all(
      Array.from({ length: 40 }).map(() =>
        tools.addField.execute!({
          pageId: 'page-1', insertAfterFieldId: null, fieldType: 'radio',
          label: 'Capital of France?', required: true, placeholder: null,
          options: ['Paris', 'Berlin', 'Rome', 'Madrid'], correctAnswers: ['Paris'],
        }, { messages: [], toolCallId: 'test' })
      )
    ).then((rs) => rs.some((r: any) => r.options.join('') !== 'ParisBerlinRomeMadrid'));

    const result: any = await tools.addField.execute!({
      pageId: 'page-1', insertAfterFieldId: null, fieldType: 'radio',
      label: 'Capital of France?', required: true, placeholder: null,
      options: ['Paris', 'Berlin', 'Rome', 'Madrid'], correctAnswers: ['Paris', 'Nope'],
    }, { messages: [], toolCallId: 'test' });

    expect(result.correctAnswers).toEqual(['Paris']); // hallucinated 'Nope' dropped
    expect([...result.options].sort()).toEqual(['Berlin', 'Madrid', 'Paris', 'Rome']);
    expect(anyReordered).toBe(true);
  });
});

describe('upsertConditionRule (proposal only)', () => {
  const schema = {
    pages: [{
      id: 'page-1', title: 'Details', fields: [
        { id: 'country', type: 'SELECT_FIELD', label: 'Country', options: ['India', 'USA'] },
        { id: 'gst', type: 'TEXT_INPUT_FIELD', label: 'GST field' },
        { id: 'heading', type: 'RICH_TEXT_FIELD', label: 'Information' },
      ],
    }],
  };

  it('resolves labels to ids and returns a pending condition proposal', async () => {
    const tools = makeFullTools(schema);
    const result = await tools.upsertConditionRule.execute!({
      combinator: 'all',
      terms: [{ field: 'country', operator: 'equals', value: 'India' }],
      actions: [{ type: 'setFieldVisibility', fields: ['GST field'], defaultState: 'hidden' }],
      rationale: 'GST is only needed in India.',
    }, { messages: [], toolCallId: 'test' });

    expect(result).toMatchObject({
      type: 'PROPOSE_CONDITION_RULE',
      rule: {
        enabled: true,
        combinator: 'all',
        terms: [{ fieldId: 'country', operator: 'equals', value: 'India' }],
        actions: [{ type: 'showField', fieldIds: ['gst'] }],
      },
    });
  });

  it('defaultState "visible" resolves to a hideField action (not shown-verb driven)', async () => {
    const tools = makeFullTools(schema);
    const result = await tools.upsertConditionRule.execute!({
      combinator: 'all',
      terms: [{ field: 'Country', operator: 'equals', value: 'USA' }],
      actions: [{ type: 'setFieldVisibility', fields: ['GST field'], defaultState: 'visible' }],
      rationale: 'GST is normally shown; hide it for USA.',
    }, { messages: [], toolCallId: 'test' });
    expect(result).toMatchObject({
      type: 'PROPOSE_CONDITION_RULE',
      rule: { actions: [{ type: 'hideField', fieldIds: ['gst'] }] },
    });
  });

  // Regression test for the "hide X unless P" inversion bug: a naive translation of
  // "Hide the GST field unless Country equals India" used to produce a hideField action
  // gated on "Country equals India" (backwards — GST would be visible by default and hidden
  // exactly when Country is India). The fix moves the show/hide-verb judgement out of the
  // model's hands entirely: the model states defaultState directly, and defaultState 'hidden'
  // always maps to showField regardless of which English verb ("hide"/"show"/"unless") appeared
  // in the description that produced it.
  it('"hide unless" phrasing maps to defaultState hidden -> showField, not hideField', async () => {
    const tools = makeFullTools(schema);
    // A correct translation of "Hide the GST field unless Country equals India" states the terms
    // exactly as given (Country equals India, unmodified) and defaultState 'hidden' (GST starts
    // hidden; the "unless" clause is what the defaultState choice encodes, not an inverted term).
    const result = await tools.upsertConditionRule.execute!({
      combinator: 'all',
      terms: [{ field: 'Country', operator: 'equals', value: 'India' }],
      actions: [{ type: 'setFieldVisibility', fields: ['GST field'], defaultState: 'hidden' }],
      rationale: 'Hide GST unless Country is India (hidden by default, shown only for India).',
    }, { messages: [], toolCallId: 'test' });
    expect(result).toMatchObject({
      type: 'PROPOSE_CONDITION_RULE',
      rule: {
        terms: [{ fieldId: 'country', operator: 'equals', value: 'India' }],
        actions: [{ type: 'showField', fieldIds: ['gst'] }],
      },
    });
  });

  it('rejects an operator that is invalid for the trigger field', async () => {
    const tools = makeFullTools(schema);
    const result = await tools.upsertConditionRule.execute!({
      combinator: 'all', terms: [{ field: 'Country', operator: 'contains', value: 'India' }],
      actions: [{ type: 'setFieldVisibility', fields: ['GST field'], defaultState: 'visible' }], rationale: 'Invalid',
    }, { messages: [], toolCallId: 'test' });
    expect(result).toEqual(expect.objectContaining({ error: expect.stringContaining('not valid') }));
  });

  it('rejects hidden/display-only fields as triggers with a helpful message', async () => {
    const tools = makeFullTools(schema);
    const result = await tools.upsertConditionRule.execute!({
      combinator: 'all', terms: [{ field: 'Information', operator: 'isFilled' }],
      actions: [{ type: 'setFieldVisibility', fields: ['GST field'], defaultState: 'visible' }], rationale: 'Invalid',
    }, { messages: [], toolCallId: 'test' });
    expect(result).toEqual(expect.objectContaining({ error: expect.stringContaining('display-only') }));
  });

  it('rejects unknown fields with a helpful message', async () => {
    const tools = makeFullTools(schema);
    const result = await tools.upsertConditionRule.execute!({
      combinator: 'all', terms: [{ field: 'Missing field', operator: 'isFilled' }],
      actions: [{ type: 'setFieldVisibility', fields: ['GST field'], defaultState: 'visible' }], rationale: 'Invalid',
    }, { messages: [], toolCallId: 'test' });
    expect(result).toEqual(expect.objectContaining({ error: expect.stringContaining("couldn't find") }));
  });

  it('resolves trigger field by direct id (not label)', async () => {
    const tools = makeFullTools(schema);
    const result = await tools.upsertConditionRule.execute!({
      combinator: 'any',
      terms: [{ field: 'country', operator: 'equals', value: 'USA' }],
      actions: [{ type: 'setFieldVisibility', fields: ['gst'], defaultState: 'visible' }],
      rationale: 'Hide GST for USA.',
    }, { messages: [], toolCallId: 'test' });
    expect(result).toMatchObject({ type: 'PROPOSE_CONDITION_RULE', rule: { combinator: 'any' } });
  });

  it('rejects unknown action target field', async () => {
    const tools = makeFullTools(schema);
    const result = await tools.upsertConditionRule.execute!({
      combinator: 'all',
      terms: [{ field: 'Country', operator: 'equals', value: 'India' }],
      actions: [{ type: 'setFieldVisibility', fields: ['Nonexistent field'], defaultState: 'hidden' }],
      rationale: 'Test',
    }, { messages: [], toolCallId: 'test' });
    expect(result).toEqual(expect.objectContaining({ error: expect.stringContaining("couldn't find") }));
  });

  it('handles page actions (showPage/hidePage via setPageVisibility, and skipToPage) by page title', async () => {
    const multiPageSchema = {
      pages: [
        { id: 'p1', title: 'Page One', fields: [
          { id: 'f1', type: 'SELECT_FIELD', label: 'Choice', options: ['Yes', 'No'] },
        ]},
        { id: 'p2', title: 'Page Two', fields: [] },
      ],
    };
    const tools = makeFullTools(multiPageSchema);
    const result = await tools.upsertConditionRule.execute!({
      combinator: 'all',
      terms: [{ field: 'Choice', operator: 'equals', value: 'Yes' }],
      actions: [{ type: 'skipToPage', page: 'Page Two' }],
      rationale: 'Skip to page two when Yes.',
    }, { messages: [], toolCallId: 'test' });
    expect(result).toMatchObject({
      type: 'PROPOSE_CONDITION_RULE',
      rule: { actions: [{ type: 'skipToPage', pageId: 'p2' }] },
    });
  });

  it('handles setPageVisibility with defaultState hidden/visible', async () => {
    const multiPageSchema = {
      pages: [
        { id: 'p1', title: 'Main', fields: [
          { id: 'f1', type: 'RADIO_FIELD', label: 'Show extra?', options: ['Yes', 'No'] },
        ]},
        { id: 'p2', title: 'Extra', fields: [] },
      ],
    };
    const tools = makeFullTools(multiPageSchema);
    const showResult = await tools.upsertConditionRule.execute!({
      combinator: 'all',
      terms: [{ field: 'Show extra?', operator: 'equals', value: 'Yes' }],
      actions: [{ type: 'setPageVisibility', page: 'Extra', defaultState: 'hidden' }],
      rationale: 'Show extra page.',
    }, { messages: [], toolCallId: 'test' });
    expect(showResult).toMatchObject({ type: 'PROPOSE_CONDITION_RULE', rule: { actions: [{ type: 'showPage', pageId: 'p2' }] } });

    const hideResult = await tools.upsertConditionRule.execute!({
      combinator: 'all',
      terms: [{ field: 'Show extra?', operator: 'equals', value: 'No' }],
      actions: [{ type: 'setPageVisibility', page: 'p2', defaultState: 'visible' }],
      rationale: 'Hide extra page.',
    }, { messages: [], toolCallId: 'test' });
    expect(hideResult).toMatchObject({ type: 'PROPOSE_CONDITION_RULE', rule: { actions: [{ type: 'hidePage', pageId: 'p2' }] } });
  });

  it('rejects unknown page target', async () => {
    const multiPageSchema = {
      pages: [
        { id: 'p1', title: 'Main', fields: [
          { id: 'f1', type: 'SELECT_FIELD', label: 'Choice', options: ['A'] },
        ]},
      ],
    };
    const tools = makeFullTools(multiPageSchema);
    const result = await tools.upsertConditionRule.execute!({
      combinator: 'all',
      terms: [{ field: 'Choice', operator: 'equals', value: 'A' }],
      actions: [{ type: 'skipToPage', page: 'Nonexistent Page' }],
      rationale: 'Test',
    }, { messages: [], toolCallId: 'test' });
    expect(result).toEqual(expect.objectContaining({ error: expect.stringContaining("couldn't find") }));
  });

  it('rejects ambiguous page title matching multiple pages', async () => {
    const dupPageSchema = {
      pages: [
        { id: 'p1', title: 'Details', fields: [
          { id: 'f1', type: 'SELECT_FIELD', label: 'Choice', options: ['A'] },
        ]},
        { id: 'p2', title: 'Details', fields: [] },
      ],
    };
    const tools = makeFullTools(dupPageSchema);
    const result = await tools.upsertConditionRule.execute!({
      combinator: 'all',
      terms: [{ field: 'Choice', operator: 'equals', value: 'A' }],
      actions: [{ type: 'skipToPage', page: 'Details' }],
      rationale: 'Test',
    }, { messages: [], toolCallId: 'test' });
    expect(result).toEqual(expect.objectContaining({ error: expect.stringContaining('matches multiple pages') }));
  });

  it('rejects ambiguous field label matching multiple fields', async () => {
    const ambiguousSchema = {
      pages: [{ id: 'p1', title: 'Page', fields: [
        { id: 'f1', type: 'TEXT_INPUT_FIELD', label: 'Name' },
        { id: 'f2', type: 'TEXT_INPUT_FIELD', label: 'Name' },
      ]}],
    };
    const tools = makeFullTools(ambiguousSchema);
    const result = await tools.upsertConditionRule.execute!({
      combinator: 'all',
      terms: [{ field: 'Name', operator: 'isFilled' }],
      actions: [{ type: 'setFieldVisibility', fields: ['f1'], defaultState: 'hidden' }],
      rationale: 'Test',
    }, { messages: [], toolCallId: 'test' });
    expect(result).toEqual(expect.objectContaining({ error: expect.stringContaining("couldn't find") }));
  });

  it('handles requireField and unrequireField actions', async () => {
    const tools = makeFullTools(schema);
    const reqResult = await tools.upsertConditionRule.execute!({
      combinator: 'all',
      terms: [{ field: 'Country', operator: 'equals', value: 'India' }],
      actions: [{ type: 'requireField', fields: ['GST field'] }],
      rationale: 'Require GST for India.',
    }, { messages: [], toolCallId: 'test' });
    expect(reqResult).toMatchObject({ type: 'PROPOSE_CONDITION_RULE', rule: { actions: [{ type: 'requireField', fieldIds: ['gst'] }] } });

    const unreqResult = await tools.upsertConditionRule.execute!({
      combinator: 'all',
      terms: [{ field: 'Country', operator: 'equals', value: 'USA' }],
      actions: [{ type: 'unrequireField', fields: ['GST field'] }],
      rationale: 'Unrequire GST for USA.',
    }, { messages: [], toolCallId: 'test' });
    expect(unreqResult).toMatchObject({ type: 'PROPOSE_CONDITION_RULE', rule: { actions: [{ type: 'unrequireField', fieldIds: ['gst'] }] } });
  });

  it('rejects a term value that is not one of the select field options', async () => {
    const tools = makeFullTools(schema);
    const result = await tools.upsertConditionRule.execute!({
      combinator: 'all',
      terms: [{ field: 'Country', operator: 'equals', value: 'Germany' }],
      actions: [{ type: 'setFieldVisibility', fields: ['GST field'], defaultState: 'visible' }],
      rationale: 'Test',
    }, { messages: [], toolCallId: 'test' });
    expect(result).toEqual(expect.objectContaining({ error: expect.stringContaining('is not one of the options') }));
  });

  it('normalizes a case/whitespace-mismatched option value to the canonical option text', async () => {
    const tools = makeFullTools(schema);
    const result = await tools.upsertConditionRule.execute!({
      combinator: 'all',
      terms: [{ field: 'Country', operator: 'equals', value: 'india' }],
      actions: [{ type: 'setFieldVisibility', fields: ['GST field'], defaultState: 'visible' }],
      rationale: 'Test',
    }, { messages: [], toolCallId: 'test' });
    expect(result).toMatchObject({
      type: 'PROPOSE_CONDITION_RULE',
      rule: { terms: [{ fieldId: 'country', operator: 'equals', value: 'India' }] },
    });
  });

  it('rejects an array term value (no operator ever evaluates a list)', async () => {
    const tools = makeFullTools(schema);
    const result = await tools.upsertConditionRule.execute!({
      combinator: 'all',
      terms: [{ field: 'Country', operator: 'equals', value: ['India', 'USA'] }],
      actions: [{ type: 'setFieldVisibility', fields: ['GST field'], defaultState: 'visible' }],
      rationale: 'Test',
    }, { messages: [], toolCallId: 'test' });
    expect(result).toEqual(expect.objectContaining({ error: expect.stringContaining('not a list') }));
  });

  const numberDateSchema = {
    pages: [{
      id: 'page-1', title: 'Details', fields: [
        { id: 'age', type: 'NUMBER_FIELD', label: 'Age' },
        { id: 'dob', type: 'DATE_FIELD', label: 'Date of birth' },
        { id: 'gst', type: 'TEXT_INPUT_FIELD', label: 'GST field' },
      ],
    }],
  };

  it('rejects a non-numeric value for a number field', async () => {
    const tools = makeFullTools(numberDateSchema);
    const result = await tools.upsertConditionRule.execute!({
      combinator: 'all',
      terms: [{ field: 'Age', operator: 'greaterThan', value: 'eighteen' }],
      actions: [{ type: 'setFieldVisibility', fields: ['GST field'], defaultState: 'visible' }],
      rationale: 'Test',
    }, { messages: [], toolCallId: 'test' });
    expect(result).toEqual(expect.objectContaining({ error: expect.stringContaining('not a valid number') }));
  });

  it('coerces a numeric string value for a number field to a number', async () => {
    const tools = makeFullTools(numberDateSchema);
    const result = await tools.upsertConditionRule.execute!({
      combinator: 'all',
      terms: [{ field: 'Age', operator: 'greaterThan', value: '18' }],
      actions: [{ type: 'setFieldVisibility', fields: ['GST field'], defaultState: 'visible' }],
      rationale: 'Test',
    }, { messages: [], toolCallId: 'test' });
    expect(result).toMatchObject({
      type: 'PROPOSE_CONDITION_RULE',
      rule: { terms: [{ fieldId: 'age', operator: 'greaterThan', value: 18 }] },
    });
  });

  it('rejects a date value that is not YYYY-MM-DD', async () => {
    const tools = makeFullTools(numberDateSchema);
    const result = await tools.upsertConditionRule.execute!({
      combinator: 'all',
      terms: [{ field: 'Date of birth', operator: 'before', value: 'August 20 2026' }],
      actions: [{ type: 'setFieldVisibility', fields: ['GST field'], defaultState: 'visible' }],
      rationale: 'Test',
    }, { messages: [], toolCallId: 'test' });
    expect(result).toEqual(expect.objectContaining({ error: expect.stringContaining('YYYY-MM-DD') }));
  });

  it('truncates a full ISO datetime value down to the YYYY-MM-DD date portion', async () => {
    const tools = makeFullTools(numberDateSchema);
    const result = await tools.upsertConditionRule.execute!({
      combinator: 'all',
      terms: [{ field: 'Date of birth', operator: 'before', value: '2026-08-20T00:00:00.000Z' }],
      actions: [{ type: 'setFieldVisibility', fields: ['GST field'], defaultState: 'visible' }],
      rationale: 'Test',
    }, { messages: [], toolCallId: 'test' });
    expect(result).toMatchObject({
      type: 'PROPOSE_CONDITION_RULE',
      rule: { terms: [{ fieldId: 'dob', operator: 'before', value: '2026-08-20' }] },
    });
  });
});

describe('updateFields', () => {
  it('returns UPDATE_FIELDS op for a single field (1-elem array)', async () => {
    const tools = makeFullTools();
    const result = await tools.updateFields.execute!({ fieldIds: ['f-1'], updates: { label: 'Full Name', required: true } }, { messages: [], toolCallId: 'test' });
    expect(result).toEqual({ type: 'UPDATE_FIELDS', fieldIds: ['f-1'], updates: { label: 'Full Name', required: true } });
  });

  it('returns UPDATE_FIELDS op for multiple fields', async () => {
    const tools = makeFullTools();
    const result = await tools.updateFields.execute!({ fieldIds: ['f-1', 'f-2', 'f-3'], updates: { required: true } }, { messages: [], toolCallId: 'test' });
    expect(result).toEqual({ type: 'UPDATE_FIELDS', fieldIds: ['f-1', 'f-2', 'f-3'], updates: { required: true } });
  });

  it('returns UPDATE_FIELDS op with validation object', async () => {
    const tools = makeFullTools();
    const result = await tools.updateFields.execute!({ fieldIds: ['f-1'], updates: { validation: { minLength: 2, maxLength: 50 } } }, { messages: [], toolCallId: 'test' });
    expect(result).toEqual({ type: 'UPDATE_FIELDS', fieldIds: ['f-1'], updates: { validation: { minLength: 2, maxLength: 50 } } });
  });

  it('returns UPDATE_FIELDS op with min/max for number field', async () => {
    const tools = makeFullTools();
    const result = await tools.updateFields.execute!({ fieldIds: ['f-1'], updates: { min: 0, max: 100 } }, { messages: [], toolCallId: 'test' });
    expect(result).toEqual({ type: 'UPDATE_FIELDS', fieldIds: ['f-1'], updates: { min: 0, max: 100 } });
  });
});

describe('removeFields (propose, no immediate delete)', () => {
  it('returns PROPOSE_DELETE_FIELDS with label resolved from schema and 0 count when no formId', async () => {
    const tools = makeFullTools();
    const result = await tools.removeFields.execute!({ fieldIds: ['f-2'] }, { messages: [], toolCallId: 'test' }) as any;
    expect(result.type).toBe('PROPOSE_DELETE_FIELDS');
    expect(result.fields).toEqual([{ fieldId: 'f-2', label: 'Country', responseCount: 0 }]);
  });

  it('returns one entry per fieldId, falling back to the id when the field is unknown', async () => {
    const tools = makeFullTools();
    const result = await tools.removeFields.execute!({ fieldIds: ['f-1', 'missing'] }, { messages: [], toolCallId: 'test' }) as any;
    expect(result.type).toBe('PROPOSE_DELETE_FIELDS');
    expect(result.fields).toEqual([
      { fieldId: 'f-1', label: 'Name', responseCount: 0 },
      { fieldId: 'missing', label: 'missing', responseCount: 0 },
    ]);
  });
});

describe('relocateField', () => {
  it('returns RELOCATE_FIELD op with mode="move" and null insertAfterFieldId', async () => {
    const tools = makeFullTools();
    const result = await tools.relocateField.execute!(
      { fieldId: 'f-1', targetPageId: 'page-2', insertAfterFieldId: null, mode: 'move' },
      { messages: [], toolCallId: 'test' }
    ) as any;
    expect(result).toEqual({ type: 'RELOCATE_FIELD', fieldId: 'f-1', targetPageId: 'page-2', insertAfterFieldId: null, mode: 'move' });
  });

  it('returns RELOCATE_FIELD op with mode="copy" and insertAfterFieldId', async () => {
    const tools = makeFullTools();
    const result = await tools.relocateField.execute!(
      { fieldId: 'f-2', targetPageId: 'page-2', insertAfterFieldId: 'f-3', mode: 'copy' },
      { messages: [], toolCallId: 'test' }
    ) as any;
    expect(result).toEqual({ type: 'RELOCATE_FIELD', fieldId: 'f-2', targetPageId: 'page-2', insertAfterFieldId: 'f-3', mode: 'copy' });
  });
});

describe('reorder', () => {
  it('returns REORDER op for scope="fields" with pageId', async () => {
    const tools = makeFullTools();
    const result = await tools.reorder.execute!({ scope: 'fields', ids: ['f-2', 'f-1'], pageId: 'page-1' }, { messages: [], toolCallId: 'test' });
    expect(result).toEqual({ type: 'REORDER', scope: 'fields', ids: ['f-2', 'f-1'], pageId: 'page-1' });
  });

  it('returns REORDER op for scope="pages"', async () => {
    const tools = makeFullTools();
    const result = await tools.reorder.execute!({ scope: 'pages', ids: ['page-2', 'page-1'] }, { messages: [], toolCallId: 'test' });
    expect(result).toEqual({ type: 'REORDER', scope: 'pages', ids: ['page-2', 'page-1'] });
  });

  it('returns error when scope="fields" but pageId is missing', async () => {
    const tools = makeFullTools();
    const result = await tools.reorder.execute!({ scope: 'fields', ids: ['f-2', 'f-1'] }, { messages: [], toolCallId: 'test' }) as any;
    expect(result).toHaveProperty('error');
    expect(result.error).toMatch(/pageId/i);
  });
});

describe('updateLayout', () => {
  it('returns UPDATE_LAYOUT op', async () => {
    const tools = makeFullTools();
    const result = await tools.updateLayout.execute!({ content: '<h1>Hello</h1>', customCTAButtonName: 'Submit' }, { messages: [], toolCallId: 'test' });
    expect(result).toEqual({ type: 'UPDATE_LAYOUT', content: '<h1>Hello</h1>', customCTAButtonName: 'Submit' });
  });
});

describe('renamePage', () => {
  it('returns RENAME_PAGE op', async () => {
    const tools = makeFullTools();
    const result = await tools.renamePage.execute!({ pageId: 'page-1', newTitle: 'Contact Details' }, { messages: [], toolCallId: 'test' });
    expect(result).toEqual({ type: 'RENAME_PAGE', pageId: 'page-1', newTitle: 'Contact Details' });
  });
});

describe('addPage', () => {
  it('returns ADD_PAGE op with a generated non-empty pageId', async () => {
    const tools = makeFullTools();
    const result = await tools.addPage.execute!({ title: 'Step 2', insertAfterPageId: null }, { messages: [], toolCallId: 'test' }) as any;
    expect(result).toMatchObject({ type: 'ADD_PAGE', title: 'Step 2', insertAfterPageId: null });
    expect(typeof result.pageId).toBe('string');
    expect(result.pageId.length).toBeGreaterThan(0);
    expect(result.pageId).toMatch(/^p[a-zA-Z0-9]{9}$/);
  });
});

describe('removePage (propose, no immediate delete)', () => {
  it('returns PROPOSE_DELETE_PAGE with title, field count, and 0 responses when no formId', async () => {
    const tools = makeFullTools();
    const result = await tools.removePage.execute!({ pageId: 'page-2' }, { messages: [], toolCallId: 'test' }) as any;
    expect(result).toMatchObject({
      type: 'PROPOSE_DELETE_PAGE',
      pageId: 'page-2',
      fieldCount: 1,
      responseCount: 0,
    });
    // page-2 has no title in mockSchema → fallback
    expect(typeof result.pageTitle).toBe('string');
  });

  it('returns error when only one page exists (last-page guard)', async () => {
    const tools = makeFullTools({ pages: [mockSchema.pages[0]] });
    const result = await tools.removePage.execute!({ pageId: 'page-1' }, { messages: [], toolCallId: 'test' }) as any;
    expect(result).toHaveProperty('error');
    expect(result.error).toMatch(/last page/i);
  });

  it('returns error when the page does not exist', async () => {
    const tools = makeFullTools();
    const result = await tools.removePage.execute!({ pageId: 'nope' }, { messages: [], toolCallId: 'test' }) as any;
    expect(result).toHaveProperty('error');
    expect(result.error).toMatch(/not found/i);
  });

  it('includes a warning when the page still has fields, to prevent data loss during merge', async () => {
    const tools = makeFullTools();
    // page-2 has 1 field in mockSchema
    const result = await tools.removePage.execute!({ pageId: 'page-2' }, { messages: [], toolCallId: 'test' }) as any;
    expect(result.type).toBe('PROPOSE_DELETE_PAGE');
    expect(result.fieldCount).toBeGreaterThan(0);
    expect(typeof result.warning).toBe('string');
    expect(result.warning).toMatch(/relocateField/i);
  });

  it('does not include a warning when the page is already empty', async () => {
    const emptyPageSchema = {
      pages: [
        { id: 'p1', title: 'Page 1', fields: [{ id: 'f1', type: 'text_input_field', label: 'Name' }] },
        { id: 'p2', title: 'Empty Page', fields: [] },
      ],
    };
    const tools = makeFullTools(emptyPageSchema);
    const result = await tools.removePage.execute!({ pageId: 'p2' }, { messages: [], toolCallId: 'test' }) as any;
    expect(result.type).toBe('PROPOSE_DELETE_PAGE');
    expect(result.fieldCount).toBe(0);
    expect(result.warning).toBeUndefined();
  });
});

describe('proposeFieldTypeChange (propose, no immediate change)', () => {
  it('returns PROPOSE_FIELD_TYPE_CHANGE with normalized current type and label', async () => {
    const tools = makeFullTools();
    const result = await tools.proposeFieldTypeChange.execute!(
      { fieldId: 'f-1', newFieldType: 'select' },
      { messages: [], toolCallId: 'test' }
    ) as any;
    expect(result).toMatchObject({
      type: 'PROPOSE_FIELD_TYPE_CHANGE',
      fieldId: 'f-1',
      label: 'Name',
      currentType: 'text',       // normalized from TEXT_INPUT_FIELD
      newFieldType: 'select',
      responseCount: 0,
    });
  });

  it('errors when the field does not exist', async () => {
    const tools = makeFullTools();
    const result = await tools.proposeFieldTypeChange.execute!(
      { fieldId: 'missing', newFieldType: 'email' },
      { messages: [], toolCallId: 'test' }
    ) as any;
    expect(result).toHaveProperty('error');
    expect(result.error).toMatch(/not found/i);
  });

  it('errors when converting to the same type', async () => {
    const tools = makeFullTools();
    // f-2 is SELECT_FIELD → normalized 'select'
    const result = await tools.proposeFieldTypeChange.execute!(
      { fieldId: 'f-2', newFieldType: 'select' },
      { messages: [], toolCallId: 'test' }
    ) as any;
    expect(result).toHaveProperty('error');
    expect(result.error).toMatch(/already/i);
  });
});

describe('navigateToPage', () => {
  it('returns NAVIGATE_TO_PAGE with pageId', async () => {
    const tools = makeFullTools(); // use mockSchema (has fields) so proposeValidation is included
    const result = await tools.navigateToPage.execute!({ pageId: 'p1' }, { messages: [], toolCallId: 'test' }) as any;
    expect(result.type).toBe('NAVIGATE_TO_PAGE');
    expect(result.pageId).toBe('p1');
  });
});

describe('proposeValidation', () => {
  it('returns PROPOSE_VALIDATION op with suggestions', async () => {
    const tools = makeFullTools(); // use mockSchema (has fields) so proposeValidation is included
    const result = await tools.proposeValidation.execute!({
      suggestions: [
        { fieldId: 'f1', fieldLabel: 'Age', fieldType: 'number', min: 0, max: 120 },
      ],
      rationale: 'Age should be between 0 and 120',
    }, { messages: [], toolCallId: 'test' }) as any;
    expect(result.type).toBe('PROPOSE_VALIDATION');
    expect(result.suggestions[0].fieldId).toBe('f1');
  });
});

describe('tool description lengths', () => {
  // Use mockSchema (with pages+fields) so all tools including conditional ones are included.
  const tools = makeFullTools();

  // Limits updated to reflect Phase 1.4 enhanced descriptions that embed behavioral rules.
  // These descriptions are intentionally longer since they carry rules that were previously
  // in the static system prompt — moving rules to tool descriptions reduces system prompt tokens.
  const LIMITS: Record<string, number> = {
    listFields:             130,
    getField:               120,
    addField:               250,   // enhanced: embeds "use addField, never updateFields" rule
    updateFields:           300,   // enhanced: embeds batching + explicit edit rules
    removeFields:           250,
    relocateField:          250,   // enhanced: embeds merge-pages workflow
    reorder:                125,
    updateLayout:            70,
    renamePage:              55,
    addPage:                200,   // enhanced: embeds pageId usage rule
    removePage:             200,   // enhanced: embeds confirmation card rule
    navigateToPage:         135,
    proposeValidation:      200,   // enhanced: embeds confirmation card rule
    proposeFieldTypeChange: 280,   // enhanced: embeds confirmation card rule
  };

  for (const [name, limit] of Object.entries(LIMITS)) {
    it(`${name} description is under ${limit} chars`, () => {
      const desc = (tools as any)[name]?.description as string | undefined;
      // If tool is undefined it means it's conditionally excluded (shouldn't happen with mockSchema + full tier)
      expect(desc, `Tool '${name}' not found in full tool set — check conditional inclusion logic`).toBeDefined();
      expect(desc!.length).toBeLessThanOrEqual(limit);
    });
  }
});

// ── Plugin (integration) tools ────────────────────────────────────────────────

const PLUGIN_TOOL_NAMES = ['listPlugins', 'proposePlugin', 'updatePlugin', 'removePlugin'];

// Schema with an email field and choice fields for email/quiz config resolution.
const pluginSchema = {
  pages: [{
    id: 'p1', title: 'Quiz', fields: [
      { id: 'contact', type: 'EMAIL_FIELD', label: 'Contact email' },
      { id: 'q1', type: 'SELECT_FIELD', label: 'Capital of France', options: ['Paris', 'Lyon'] },
      { id: 'q2', type: 'RADIO_FIELD', label: 'Two plus two', options: ['3', '4'] },
      { id: 'notes', type: 'TEXT_AREA_FIELD', label: 'Notes' },
    ],
  }],
};

const makePluginTools = (opts: Record<string, unknown> = {}) =>
  createFormEditTools(pluginSchema, { toolTier: 'full', canManagePlugins: true, ...opts }) as any;

describe('plugin tool gating (OWNER + full tier only)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('excludes plugin tools by default (no canManagePlugins)', () => {
    const keys = Object.keys(createFormEditTools(mockSchema, { toolTier: 'full' }));
    for (const name of PLUGIN_TOOL_NAMES) expect(keys).not.toContain(name);
  });

  it('includes plugin tools when canManagePlugins is true and tier is full', () => {
    const keys = Object.keys(createFormEditTools(mockSchema, { toolTier: 'full', canManagePlugins: true }));
    for (const name of PLUGIN_TOOL_NAMES) expect(keys).toContain(name);
  });

  it('never includes plugin tools on core or minimal tiers, even for owners', () => {
    for (const toolTier of ['core', 'minimal'] as const) {
      const keys = Object.keys(createFormEditTools(mockSchema, { toolTier, canManagePlugins: true }));
      for (const name of PLUGIN_TOOL_NAMES) expect(keys).not.toContain(name);
    }
  });
});

describe('listPlugins', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns empty list without querying when formId is missing', async () => {
    const tools = makePluginTools();
    const result = await tools.listPlugins.execute!({}, { messages: [], toolCallId: 'test' }) as any;
    expect(result).toEqual({ summary: '0 integrations', plugins: [] });
    expect(vi.mocked(prisma.formPlugin.findMany)).not.toHaveBeenCalled();
  });

  it('returns compact id|type|"name"|on/off lines', async () => {
    vi.mocked(prisma.formPlugin.findMany).mockResolvedValueOnce([
      { id: 'pl-1', type: 'webhook', name: 'CRM sync', enabled: true },
      { id: 'pl-2', type: 'email', name: 'Notify team', enabled: false },
    ] as any);
    const tools = makePluginTools({ formId: 'form-1' });
    const result = await tools.listPlugins.execute!({}, { messages: [], toolCallId: 'test' }) as any;
    expect(result.summary).toBe('2 integrations');
    expect(result.plugins).toEqual(['pl-1|webhook|"CRM sync"|on', 'pl-2|email|"Notify team"|off']);
  });
});

describe('proposePlugin (proposal only)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('proposes a webhook with an https URL and masked-out secret carried in config', async () => {
    const tools = makePluginTools();
    const result = await tools.proposePlugin.execute!({
      pluginType: 'webhook', name: 'CRM sync',
      webhook: { url: 'https://example.com/hook', secret: 's3cret' },
      rationale: 'Send submissions to the CRM.',
    }, { messages: [], toolCallId: 'test' }) as any;
    expect(result).toEqual({
      type: 'PROPOSE_CREATE_PLUGIN',
      pluginType: 'webhook',
      name: 'CRM sync',
      config: { type: 'webhook', url: 'https://example.com/hook', secret: 's3cret' },
      events: ['form.submitted'],
      rationale: 'Send submissions to the CRM.',
    });
  });

  it('rejects a non-https webhook URL', async () => {
    const tools = makePluginTools();
    const result = await tools.proposePlugin.execute!({
      pluginType: 'webhook', name: 'Bad', webhook: { url: 'http://example.com/hook' }, rationale: 'x',
    }, { messages: [], toolCallId: 'test' }) as any;
    expect(result.error).toMatch(/https/i);
  });

  it('rejects an unparseable webhook URL', async () => {
    const tools = makePluginTools();
    const result = await tools.proposePlugin.execute!({
      pluginType: 'webhook', name: 'Bad', webhook: { url: 'not a url' }, rationale: 'x',
    }, { messages: [], toolCallId: 'test' }) as any;
    expect(result.error).toMatch(/not a valid URL/i);
  });

  it('rejects a webhook proposal missing its config block', async () => {
    const tools = makePluginTools();
    const result = await tools.proposePlugin.execute!({
      pluginType: 'webhook', name: 'Bad', rationale: 'x',
    }, { messages: [], toolCallId: 'test' }) as any;
    expect(result).toHaveProperty('error');
  });

  it('proposes an email plugin resolving recipientField by label to an email field', async () => {
    const tools = makePluginTools();
    const result = await tools.proposePlugin.execute!({
      pluginType: 'email', name: 'Notify',
      email: { recipientField: 'Contact email', subject: 'New response', message: 'You got a response.' },
      rationale: 'Notify the submitter contact.',
    }, { messages: [], toolCallId: 'test' }) as any;
    expect(result.type).toBe('PROPOSE_CREATE_PLUGIN');
    expect(result.config).toMatchObject({
      type: 'email',
      recipientFieldId: 'contact',
      recipientFieldLabel: 'Contact email',
      subject: 'New response',
    });
  });

  it('rejects an email plugin with neither recipientEmail nor recipientField', async () => {
    const tools = makePluginTools();
    const result = await tools.proposePlugin.execute!({
      pluginType: 'email', name: 'Notify',
      email: { subject: 'Hi', message: 'Body' }, rationale: 'x',
    }, { messages: [], toolCallId: 'test' }) as any;
    expect(result.error).toMatch(/recipient/i);
  });

  it('rejects an invalid static recipient address', async () => {
    const tools = makePluginTools();
    const result = await tools.proposePlugin.execute!({
      pluginType: 'email', name: 'Notify',
      email: { recipientEmail: 'not-an-email', subject: 'Hi', message: 'Body' }, rationale: 'x',
    }, { messages: [], toolCallId: 'test' }) as any;
    expect(result.error).toMatch(/not a valid email/i);
  });

  it('rejects a recipientField that is not an email field', async () => {
    const tools = makePluginTools();
    const result = await tools.proposePlugin.execute!({
      pluginType: 'email', name: 'Notify',
      email: { recipientField: 'Notes', subject: 'Hi', message: 'Body' }, rationale: 'x',
    }, { messages: [], toolCallId: 'test' }) as any;
    expect(result.error).toMatch(/not an email field/i);
  });

  it('no longer accepts "quiz-grading" as a pluginType (deprecated — native quiz mode replaces it)', () => {
    const tools = makePluginTools();
    const parsed = tools.proposePlugin.inputSchema.safeParse({
      pluginType: 'quiz-grading', name: 'Auto grade', rationale: 'x',
    });
    expect(parsed.success).toBe(false);
  });
});

describe('updatePlugin / removePlugin (proposals only)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('updatePlugin errors when nothing would change', async () => {
    const tools = makePluginTools({ formId: 'form-1' });
    const result = await tools.updatePlugin.execute!({ pluginId: 'pl-1', rationale: 'x' }, { messages: [], toolCallId: 'test' }) as any;
    expect(result.error).toMatch(/nothing to change/i);
  });

  it('updatePlugin errors for an unknown plugin id', async () => {
    vi.mocked(prisma.formPlugin.findFirst).mockResolvedValueOnce(null);
    const tools = makePluginTools({ formId: 'form-1' });
    const result = await tools.updatePlugin.execute!({ pluginId: 'nope', enabled: false, rationale: 'x' }, { messages: [], toolCallId: 'test' }) as any;
    expect(result.error).toMatch(/not found/i);
  });

  it('updatePlugin proposes an enable/disable change for an existing plugin', async () => {
    vi.mocked(prisma.formPlugin.findFirst).mockResolvedValueOnce({ id: 'pl-1', type: 'webhook', name: 'CRM sync', enabled: true } as any);
    const tools = makePluginTools({ formId: 'form-1' });
    const result = await tools.updatePlugin.execute!({ pluginId: 'pl-1', enabled: false, rationale: 'Turn it off.' }, { messages: [], toolCallId: 'test' }) as any;
    expect(result).toEqual({
      type: 'PROPOSE_UPDATE_PLUGIN',
      pluginId: 'pl-1',
      pluginType: 'webhook',
      name: 'CRM sync',
      updates: { enabled: false },
      rationale: 'Turn it off.',
    });
  });

  it('removePlugin errors for an unknown plugin id', async () => {
    vi.mocked(prisma.formPlugin.findFirst).mockResolvedValueOnce(null);
    const tools = makePluginTools({ formId: 'form-1' });
    const result = await tools.removePlugin.execute!({ pluginId: 'nope', rationale: 'x' }, { messages: [], toolCallId: 'test' }) as any;
    expect(result.error).toMatch(/not found/i);
  });

  it('removePlugin proposes deletion of an existing plugin', async () => {
    vi.mocked(prisma.formPlugin.findFirst).mockResolvedValueOnce({ id: 'pl-2', type: 'email', name: 'Notify team' } as any);
    const tools = makePluginTools({ formId: 'form-1' });
    const result = await tools.removePlugin.execute!({ pluginId: 'pl-2', rationale: 'No longer needed.' }, { messages: [], toolCallId: 'test' }) as any;
    expect(result).toEqual({
      type: 'PROPOSE_DELETE_PLUGIN',
      pluginId: 'pl-2',
      pluginType: 'email',
      name: 'Notify team',
      rationale: 'No longer needed.',
    });
  });
});

describe('plugin tool description lengths', () => {
  const tools = makePluginTools();
  const LIMITS: Record<string, number> = {
    listPlugins: 130,
    proposePlugin: 260, // embeds proposal + config-block + field-reference rules
    updatePlugin: 135,
    removePlugin: 120,
  };
  for (const [name, limit] of Object.entries(LIMITS)) {
    it(`${name} description is under ${limit} chars`, () => {
      const desc = (tools as any)[name]?.description as string | undefined;
      expect(desc).toBeDefined();
      expect(desc!.length).toBeLessThanOrEqual(limit);
    });
  }
});
