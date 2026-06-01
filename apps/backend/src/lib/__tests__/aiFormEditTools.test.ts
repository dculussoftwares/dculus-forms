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

describe('createFormEditTools', () => {
  it('returns all 14 tools', () => {
    const tools = createFormEditTools(mockSchema);
    expect(Object.keys(tools)).toEqual([
      'listFields', 'getField', 'addField', 'updateField',
      'removeField', 'reorderFields', 'updateLayout',
      'renamePage', 'reorderPages', 'addPage', 'removePage',
      'navigateToPage', 'bulkUpdateFields', 'proposeValidation',
    ]);
  });
});

describe('listFields', () => {
  it('returns summary and compact page strings for all pages', async () => {
    const tools = createFormEditTools(mockSchema);
    const result = await tools.listFields.execute!({ pageId: undefined }, { messages: [], toolCallId: 'test' }) as any;
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
    const tools = createFormEditTools(mockSchema);
    const result = await tools.listFields.execute!({ pageId: 'page-2' }, { messages: [], toolCallId: 'test' }) as any;
    expect(result.pages).toHaveLength(1);
    // still shows p2 (absolute position) even when filtered
    expect(result.pages[0]).toMatch(/^p2 "Page 2" \[id:page-2\]:/);
    expect(result.pages[0]).toContain('f-3|email|"Email"|req');
  });

  it('returns empty summary for empty schema', async () => {
    const tools = createFormEditTools({ pages: [] });
    const result = await tools.listFields.execute!({ pageId: undefined }, { messages: [], toolCallId: 'test' }) as any;
    expect(result.summary).toBe('0 pages total');
    expect(result.pages).toHaveLength(0);
  });

  it('marks page as (empty) when it has no fields', async () => {
    const tools = createFormEditTools({ pages: [{ id: 'p1', title: 'Blank', fields: [] }] });
    const result = await tools.listFields.execute!({ pageId: undefined }, { messages: [], toolCallId: 'test' }) as any;
    expect(result.pages[0]).toContain('(empty)');
  });
});

describe('getField', () => {
  it('returns full field details including pageId', async () => {
    const tools = createFormEditTools(mockSchema);
    const result = await tools.getField.execute!({ fieldId: 'f-2' }, { messages: [], toolCallId: 'test' });
    expect(result).toMatchObject({ id: 'f-2', type: 'SELECT_FIELD', label: 'Country', pageId: 'page-1', options: ['USA', 'UK'] });
  });

  it('returns error for unknown fieldId', async () => {
    const tools = createFormEditTools(mockSchema);
    const result = await tools.getField.execute!({ fieldId: 'unknown' }, { messages: [], toolCallId: 'test' });
    expect(result).toHaveProperty('error');
  });
});

describe('addField', () => {
  it('returns ADD_FIELD op with all inputs', async () => {
    const tools = createFormEditTools(mockSchema);
    const result = await tools.addField.execute!({
      pageId: 'page-1', insertAfterFieldId: 'f-1', fieldType: 'text',
      label: 'Last Name', required: false, placeholder: null, options: null,
    }, { messages: [], toolCallId: 'test' });
    expect(result).toEqual({ type: 'ADD_FIELD', pageId: 'page-1', insertAfterFieldId: 'f-1', fieldType: 'text', label: 'Last Name', required: false, placeholder: null, options: null });
  });
});

describe('updateField', () => {
  it('returns UPDATE_FIELD op', async () => {
    const tools = createFormEditTools(mockSchema);
    const result = await tools.updateField.execute!({ fieldId: 'f-1', updates: { label: 'Full Name', required: true } }, { messages: [], toolCallId: 'test' });
    expect(result).toEqual({ type: 'UPDATE_FIELD', fieldId: 'f-1', updates: { label: 'Full Name', required: true } });
  });

  it('returns UPDATE_FIELD op with validation object', async () => {
    const tools = createFormEditTools(mockSchema);
    const result = await tools.updateField.execute!({ fieldId: 'f-1', updates: { validation: { minLength: 2, maxLength: 50 } } }, { messages: [], toolCallId: 'test' });
    expect(result).toEqual({ type: 'UPDATE_FIELD', fieldId: 'f-1', updates: { validation: { minLength: 2, maxLength: 50 } } });
  });

  it('returns UPDATE_FIELD op with min/max for number field', async () => {
    const tools = createFormEditTools(mockSchema);
    const result = await tools.updateField.execute!({ fieldId: 'f-1', updates: { min: 0, max: 100 } }, { messages: [], toolCallId: 'test' });
    expect(result).toEqual({ type: 'UPDATE_FIELD', fieldId: 'f-1', updates: { min: 0, max: 100 } });
  });
});

describe('removeField', () => {
  it('returns REMOVE_FIELD op', async () => {
    const tools = createFormEditTools(mockSchema);
    const result = await tools.removeField.execute!({ fieldId: 'f-2' }, { messages: [], toolCallId: 'test' });
    expect(result).toEqual({ type: 'REMOVE_FIELD', fieldId: 'f-2' });
  });
});

describe('reorderFields', () => {
  it('returns REORDER_FIELDS op', async () => {
    const tools = createFormEditTools(mockSchema);
    const result = await tools.reorderFields.execute!({ pageId: 'page-1', fieldIds: ['f-2', 'f-1'] }, { messages: [], toolCallId: 'test' });
    expect(result).toEqual({ type: 'REORDER_FIELDS', pageId: 'page-1', fieldIds: ['f-2', 'f-1'] });
  });
});

describe('updateLayout', () => {
  it('returns UPDATE_LAYOUT op', async () => {
    const tools = createFormEditTools(mockSchema);
    const result = await tools.updateLayout.execute!({ content: '<h1>Hello</h1>', customCTAButtonName: 'Submit' }, { messages: [], toolCallId: 'test' });
    expect(result).toEqual({ type: 'UPDATE_LAYOUT', content: '<h1>Hello</h1>', customCTAButtonName: 'Submit' });
  });
});

describe('renamePage', () => {
  it('returns RENAME_PAGE op', async () => {
    const tools = createFormEditTools(mockSchema);
    const result = await tools.renamePage.execute!({ pageId: 'page-1', newTitle: 'Contact Details' }, { messages: [], toolCallId: 'test' });
    expect(result).toEqual({ type: 'RENAME_PAGE', pageId: 'page-1', newTitle: 'Contact Details' });
  });
});

describe('reorderPages', () => {
  it('returns REORDER_PAGES op', async () => {
    const tools = createFormEditTools(mockSchema);
    const result = await tools.reorderPages.execute!({ pageIds: ['page-2', 'page-1'] }, { messages: [], toolCallId: 'test' });
    expect(result).toEqual({ type: 'REORDER_PAGES', pageIds: ['page-2', 'page-1'] });
  });
});

describe('addPage', () => {
  it('returns ADD_PAGE op', async () => {
    const tools = createFormEditTools(mockSchema);
    const result = await (tools as any).addPage.execute!({ title: 'Step 2', insertAfterPageId: null }, { messages: [], toolCallId: 'test' });
    expect(result).toMatchObject({ type: 'ADD_PAGE', title: 'Step 2', insertAfterPageId: null });
    expect(typeof (result as any).pageId).toBe('string');
    expect((result as any).pageId).toMatch(/^page-/);
  });
});

describe('removePage', () => {
  it('returns REMOVE_PAGE op when multiple pages exist', async () => {
    const tools = createFormEditTools(mockSchema);
    const result = await (tools as any).removePage.execute!({ pageId: 'page-2' }, { messages: [], toolCallId: 'test' });
    expect(result).toEqual({ type: 'REMOVE_PAGE', pageId: 'page-2' });
  });

  it('returns error when only one page exists', async () => {
    const tools = createFormEditTools({ pages: [mockSchema.pages[0]] });
    const result = await (tools as any).removePage.execute!({ pageId: 'page-1' }, { messages: [], toolCallId: 'test' });
    expect(result).toHaveProperty('error');
    expect((result as any).error).toMatch(/last page/i);
  });
});

describe('proposeValidation', () => {
  it('returns PROPOSE_VALIDATION op with suggestions', async () => {
    const tools = createFormEditTools({ pages: [] });
    const result = await (tools as any).proposeValidation.execute({
      suggestions: [
        { fieldId: 'f1', fieldLabel: 'Age', fieldType: 'number', min: 0, max: 120 },
      ],
      rationale: 'Age should be between 0 and 120',
    });
    expect((result as any).type).toBe('PROPOSE_VALIDATION');
    expect((result as any).suggestions[0].fieldId).toBe('f1');
  });
});

describe('navigateToPage', () => {
  it('returns NAVIGATE_TO_PAGE with pageId', async () => {
    const tools = createFormEditTools({ pages: [] });
    const result = await (tools as any).navigateToPage.execute({ pageId: 'p1' });
    expect((result as any).type).toBe('NAVIGATE_TO_PAGE');
    expect((result as any).pageId).toBe('p1');
  });
});

describe('bulkUpdateFields', () => {
  it('returns BULK_UPDATE_FIELDS with fieldIds and updates', async () => {
    const tools = createFormEditTools({ pages: [] });
    const result = await (tools as any).bulkUpdateFields.execute({
      fieldIds: ['f1', 'f2'],
      updates: { required: true },
    });
    expect((result as any).type).toBe('BULK_UPDATE_FIELDS');
    expect((result as any).fieldIds).toEqual(['f1', 'f2']);
    expect((result as any).updates.required).toBe(true);
  });
});
