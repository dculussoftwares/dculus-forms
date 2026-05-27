import { describe, it, expect } from 'vitest';
import { formEditTools } from '../aiFormEditTools.js';

describe('formEditTools', () => {
  it('inspectForm returns a note', async () => {
    const result = await formEditTools.inspectForm.execute({}, { messages: [], toolCallId: 'test' });
    expect(result).toHaveProperty('note');
  });

  it('addField returns ADD_FIELD operation with correct shape', async () => {
    const result = await formEditTools.addField.execute(
      { fieldType: 'text', label: 'Name', required: true, placeholder: null, options: null, insertAfterFieldId: null },
      { messages: [], toolCallId: 'test' }
    );
    expect(result.type).toBe('ADD_FIELD');
    expect(result.fieldType).toBe('text');
    expect(result.label).toBe('Name');
  });

  it('updateField returns UPDATE_FIELD operation', async () => {
    const result = await formEditTools.updateField.execute(
      { fieldId: 'fld_123', updates: { required: true } },
      { messages: [], toolCallId: 'test' }
    );
    expect(result.type).toBe('UPDATE_FIELD');
    expect(result.fieldId).toBe('fld_123');
  });

  it('removeField returns REMOVE_FIELD operation', async () => {
    const result = await formEditTools.removeField.execute(
      { fieldId: 'fld_456' },
      { messages: [], toolCallId: 'test' }
    );
    expect(result.type).toBe('REMOVE_FIELD');
    expect(result.fieldId).toBe('fld_456');
  });

  it('reorderFields returns REORDER_FIELDS operation', async () => {
    const result = await formEditTools.reorderFields.execute(
      { pageId: 'pg_1', fieldIds: ['fld_1', 'fld_2'] },
      { messages: [], toolCallId: 'test' }
    );
    expect(result.type).toBe('REORDER_FIELDS');
    expect(result.fieldIds).toEqual(['fld_1', 'fld_2']);
  });

  it('updateLayout returns UPDATE_LAYOUT operation', async () => {
    const result = await formEditTools.updateLayout.execute(
      { content: '<h1>New Title</h1>', customCTAButtonName: 'Submit' },
      { messages: [], toolCallId: 'test' }
    );
    expect(result.type).toBe('UPDATE_LAYOUT');
    expect(result.content).toBe('<h1>New Title</h1>');
  });
});
