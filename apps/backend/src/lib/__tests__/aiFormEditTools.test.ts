// apps/backend/src/lib/__tests__/aiFormEditTools.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
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

vi.mock('../../lib/prisma.js', () => ({
  prisma: {
    form: {
      findUnique: vi.fn(),
    },
    collaborativeDocument: {
      findFirst: vi.fn().mockResolvedValue(null), // No collab doc → falls back to form.formSchema
    },
  },
}));

import { prisma } from '../../lib/prisma.js';

beforeEach(() => {
  vi.clearAllMocks();
  (prisma.form.findUnique as any).mockResolvedValue({ formSchema: mockSchema });
});

describe('createFormEditTools', () => {
  it('returns all 11 tools', () => {
    const tools = createFormEditTools('form-1');
    expect(Object.keys(tools)).toEqual([
      'listFields', 'getField', 'addField', 'updateField',
      'removeField', 'reorderFields', 'updateLayout',
      'renamePage', 'reorderPages', 'addPage', 'removePage',
    ]);
  });
});

describe('listFields', () => {
  it('returns all pages with field summaries when no pageId given', async () => {
    const tools = createFormEditTools('form-1');
    const result = await tools.listFields.execute!({ pageId: undefined }, { messages: [], toolCallId: 'test' }) as any;
    expect(result.pages).toHaveLength(2);
    expect(result.pages[0].fields).toHaveLength(2);
    expect(result.pages[0].fields[0]).toEqual({
      id: 'f-1', type: 'TEXT_INPUT_FIELD', label: 'Name', required: true,
    });
  });

  it('filters to a specific page when pageId given', async () => {
    const tools = createFormEditTools('form-1');
    const result = await tools.listFields.execute!({ pageId: 'page-2' }, { messages: [], toolCallId: 'test' }) as any;
    expect(result.pages).toHaveLength(1);
    expect(result.pages[0].id).toBe('page-2');
    expect(result.pages[0].fields).toHaveLength(1);
  });

  it('returns error when form not found', async () => {
    (prisma.form.findUnique as any).mockResolvedValue(null);
    const tools = createFormEditTools('bad-id');
    const result = await tools.listFields.execute!({ pageId: undefined }, { messages: [], toolCallId: 'test' });
    expect(result).toHaveProperty('error');
  });
});

describe('getField', () => {
  it('returns full field details including pageId', async () => {
    const tools = createFormEditTools('form-1');
    const result = await tools.getField.execute!({ fieldId: 'f-2' }, { messages: [], toolCallId: 'test' });
    expect(result).toMatchObject({
      id: 'f-2',
      type: 'SELECT_FIELD',
      label: 'Country',
      required: false,
      hint: 'Pick one',
      options: ['USA', 'UK'],
      pageId: 'page-1',
    });
  });

  it('returns error for unknown fieldId', async () => {
    const tools = createFormEditTools('form-1');
    const result = await tools.getField.execute!({ fieldId: 'unknown' }, { messages: [], toolCallId: 'test' });
    expect(result).toHaveProperty('error');
  });
});

describe('addField', () => {
  it('returns ADD_FIELD op with all inputs', async () => {
    const tools = createFormEditTools('form-1');
    const result = await tools.addField.execute!({
      pageId: 'page-1',
      insertAfterFieldId: 'f-1',
      fieldType: 'text',
      label: 'Last Name',
      required: false,
      placeholder: null,
      options: null,
    }, { messages: [], toolCallId: 'test' });
    expect(result).toEqual({
      type: 'ADD_FIELD',
      pageId: 'page-1',
      insertAfterFieldId: 'f-1',
      fieldType: 'text',
      label: 'Last Name',
      required: false,
      placeholder: null,
      options: null,
    });
  });
});

describe('updateField', () => {
  it('returns UPDATE_FIELD op', async () => {
    const tools = createFormEditTools('form-1');
    const result = await tools.updateField.execute!({
      fieldId: 'f-1',
      updates: { label: 'Full Name', required: true },
    }, { messages: [], toolCallId: 'test' });
    expect(result).toEqual({
      type: 'UPDATE_FIELD',
      fieldId: 'f-1',
      updates: { label: 'Full Name', required: true },
    });
  });

  it('returns UPDATE_FIELD op with validation object', async () => {
    const tools = createFormEditTools('form-1');
    const result = await tools.updateField.execute!(
      {
        fieldId: 'f-1',
        updates: { validation: { minLength: 2, maxLength: 50 } },
      },
      { messages: [], toolCallId: 'test' }
    );
    expect(result).toEqual({
      type: 'UPDATE_FIELD',
      fieldId: 'f-1',
      updates: { validation: { minLength: 2, maxLength: 50 } },
    });
  });

  it('returns UPDATE_FIELD op with min/max for number field', async () => {
    const tools = createFormEditTools('form-1');
    const result = await tools.updateField.execute!(
      {
        fieldId: 'f-1',
        updates: { min: 0, max: 100 },
      },
      { messages: [], toolCallId: 'test' }
    );
    expect(result).toEqual({
      type: 'UPDATE_FIELD',
      fieldId: 'f-1',
      updates: { min: 0, max: 100 },
    });
  });

  it('returns UPDATE_FIELD op with minDate/maxDate for date field', async () => {
    const tools = createFormEditTools('form-1');
    const result = await tools.updateField.execute!(
      {
        fieldId: 'f-1',
        updates: { minDate: '2024-01-01', maxDate: '2025-12-31' },
      },
      { messages: [], toolCallId: 'test' }
    );
    expect(result).toEqual({
      type: 'UPDATE_FIELD',
      fieldId: 'f-1',
      updates: { minDate: '2024-01-01', maxDate: '2025-12-31' },
    });
  });
});

describe('removeField', () => {
  it('returns REMOVE_FIELD op', async () => {
    const tools = createFormEditTools('form-1');
    const result = await tools.removeField.execute!({ fieldId: 'f-2' }, { messages: [], toolCallId: 'test' });
    expect(result).toEqual({ type: 'REMOVE_FIELD', fieldId: 'f-2' });
  });
});

describe('reorderFields', () => {
  it('returns REORDER_FIELDS op', async () => {
    const tools = createFormEditTools('form-1');
    const result = await tools.reorderFields.execute!({
      pageId: 'page-1',
      fieldIds: ['f-2', 'f-1'],
    }, { messages: [], toolCallId: 'test' });
    expect(result).toEqual({
      type: 'REORDER_FIELDS',
      pageId: 'page-1',
      fieldIds: ['f-2', 'f-1'],
    });
  });
});

describe('updateLayout', () => {
  it('returns UPDATE_LAYOUT op', async () => {
    const tools = createFormEditTools('form-1');
    const result = await tools.updateLayout.execute!({
      content: '<h1>Hello</h1>',
      customCTAButtonName: 'Submit',
    }, { messages: [], toolCallId: 'test' });
    expect(result).toEqual({
      type: 'UPDATE_LAYOUT',
      content: '<h1>Hello</h1>',
      customCTAButtonName: 'Submit',
    });
  });
});

describe('renamePage', () => {
  it('returns RENAME_PAGE op', async () => {
    const tools = createFormEditTools('form-1');
    const result = await tools.renamePage.execute!(
      { pageId: 'page-1', newTitle: 'Contact Details' },
      { messages: [], toolCallId: 'test' }
    );
    expect(result).toEqual({ type: 'RENAME_PAGE', pageId: 'page-1', newTitle: 'Contact Details' });
  });
});

describe('reorderPages', () => {
  it('returns REORDER_PAGES op with page IDs in desired order', async () => {
    const tools = createFormEditTools('form-1');
    const result = await tools.reorderPages.execute!(
      { pageIds: ['page-2', 'page-1'] },
      { messages: [], toolCallId: 'test' }
    );
    expect(result).toEqual({ type: 'REORDER_PAGES', pageIds: ['page-2', 'page-1'] });
  });
});

describe('addPage', () => {
  it('returns ADD_PAGE op with title and null insertAfterPageId', async () => {
    const tools = createFormEditTools('form-1');
    const result = await (tools as any).addPage.execute!(
      { title: 'Step 2', insertAfterPageId: null },
      { messages: [], toolCallId: 'test' }
    );
    expect(result).toEqual({ type: 'ADD_PAGE', title: 'Step 2', insertAfterPageId: null });
  });

  it('returns ADD_PAGE op with a specific insertAfterPageId', async () => {
    const tools = createFormEditTools('form-1');
    const result = await (tools as any).addPage.execute!(
      { title: 'Middle Page', insertAfterPageId: 'page-1' },
      { messages: [], toolCallId: 'test' }
    );
    expect(result).toEqual({ type: 'ADD_PAGE', title: 'Middle Page', insertAfterPageId: 'page-1' });
  });
});

describe('removePage', () => {
  it('returns REMOVE_PAGE op when multiple pages exist', async () => {
    const tools = createFormEditTools('form-1');
    const result = await (tools as any).removePage.execute!(
      { pageId: 'page-2' },
      { messages: [], toolCallId: 'test' }
    );
    expect(result).toEqual({ type: 'REMOVE_PAGE', pageId: 'page-2' });
  });

  it('returns error when only one page exists', async () => {
    (prisma.form.findUnique as any).mockResolvedValue({
      formSchema: { pages: [mockSchema.pages[0]] },
    });
    const tools = createFormEditTools('form-1');
    const result = await (tools as any).removePage.execute!(
      { pageId: 'page-1' },
      { messages: [], toolCallId: 'test' }
    );
    expect(result).toHaveProperty('error');
    expect((result as any).error).toMatch(/last page/i);
  });

  it('returns error when form not found', async () => {
    (prisma.form.findUnique as any).mockResolvedValue(null);
    const tools = createFormEditTools('bad-id');
    const result = await (tools as any).removePage.execute!(
      { pageId: 'page-1' },
      { messages: [], toolCallId: 'test' }
    );
    expect(result).toHaveProperty('error');
  });
});
