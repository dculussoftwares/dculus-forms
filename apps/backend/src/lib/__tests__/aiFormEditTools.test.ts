// apps/backend/src/lib/__tests__/aiFormEditTools.test.ts
import { describe, it, expect } from 'vitest';
import { createFormEditTools } from '../aiFormEditTools.js';

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
    expect(keys).toHaveLength(14);
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
    expect(result.pageId).toMatch(/^page-/);
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
