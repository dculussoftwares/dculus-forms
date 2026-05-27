import { FieldType } from '@dculus/types';
import { applyAIOp } from '../applyAIOp';

function makeStore(overrides = {}) {
  return {
    pages: [
      {
        id: 'page-1',
        fields: [
          { id: 'f-1', type: FieldType.TEXT_INPUT_FIELD, label: 'Name', required: true },
          { id: 'f-2', type: FieldType.SELECT_FIELD, label: 'Country', required: false },
        ],
      },
      {
        id: 'page-2',
        fields: [
          { id: 'f-3', type: FieldType.EMAIL_FIELD, label: 'Email', required: true },
        ],
      },
    ],
    addField: jest.fn(),
    addFieldAtIndex: jest.fn(),
    updateField: jest.fn(),
    removeField: jest.fn(),
    reorderFields: jest.fn(),
    updateLayout: jest.fn(),
    updatePageTitle: jest.fn(),
    reorderPages: jest.fn(),
    ...overrides,
  };
}

describe('applyAIOp — ADD_FIELD', () => {
  it('appends to page-1 when insertAfterFieldId is null', () => {
    const store = makeStore();
    applyAIOp({ type: 'ADD_FIELD', pageId: 'page-1', insertAfterFieldId: null, fieldType: 'text', label: 'Last Name', required: false, placeholder: null, options: null }, store as any);
    expect(store.addField).toHaveBeenCalledWith('page-1', FieldType.TEXT_INPUT_FIELD, expect.objectContaining({ label: 'Last Name', required: false }));
  });

  it('inserts at correct index when insertAfterFieldId is provided', () => {
    const store = makeStore();
    applyAIOp({ type: 'ADD_FIELD', pageId: 'page-1', insertAfterFieldId: 'f-1', fieldType: 'email', label: 'Email', required: true, placeholder: null, options: null }, store as any);
    // f-1 is at index 0, so insert at index 1
    expect(store.addFieldAtIndex).toHaveBeenCalledWith('page-1', FieldType.EMAIL_FIELD, expect.objectContaining({ label: 'Email' }), 1);
  });

  it('falls back to pages[0] when pageId not found', () => {
    const store = makeStore();
    applyAIOp({ type: 'ADD_FIELD', pageId: 'nonexistent', insertAfterFieldId: null, fieldType: 'text', label: 'X', required: false, placeholder: null, options: null }, store as any);
    expect(store.addField).toHaveBeenCalledWith('page-1', FieldType.TEXT_INPUT_FIELD, expect.anything());
  });

  it('passes options for choice fields', () => {
    const store = makeStore();
    applyAIOp({ type: 'ADD_FIELD', pageId: 'page-1', insertAfterFieldId: null, fieldType: 'select', label: 'Size', required: false, placeholder: null, options: ['S', 'M', 'L'] }, store as any);
    expect(store.addField).toHaveBeenCalledWith('page-1', FieldType.SELECT_FIELD, expect.objectContaining({ options: ['S', 'M', 'L'] }));
  });
});

describe('applyAIOp — UPDATE_FIELD', () => {
  it('finds the page by fieldId and calls updateField', () => {
    const store = makeStore();
    applyAIOp({ type: 'UPDATE_FIELD', fieldId: 'f-3', updates: { label: 'Work Email' } }, store as any);
    expect(store.updateField).toHaveBeenCalledWith('page-2', 'f-3', { label: 'Work Email' });
  });

  it('does nothing when fieldId not found', () => {
    const store = makeStore();
    applyAIOp({ type: 'UPDATE_FIELD', fieldId: 'unknown', updates: { label: 'X' } }, store as any);
    expect(store.updateField).not.toHaveBeenCalled();
  });
});

describe('applyAIOp — REMOVE_FIELD', () => {
  it('finds the page and removes the field', () => {
    const store = makeStore();
    applyAIOp({ type: 'REMOVE_FIELD', fieldId: 'f-2' }, store as any);
    expect(store.removeField).toHaveBeenCalledWith('page-1', 'f-2');
  });
});

describe('applyAIOp — REORDER_FIELDS', () => {
  it('calls reorderFields to move each field to its target index', () => {
    const store = makeStore();
    // Desired: f-2 first, then f-1
    applyAIOp({ type: 'REORDER_FIELDS', pageId: 'page-1', fieldIds: ['f-2', 'f-1'] }, store as any);
    // f-2 is at index 1 and needs to move to index 0
    expect(store.reorderFields).toHaveBeenCalledWith('page-1', 1, 0);
  });
});

describe('applyAIOp — UPDATE_LAYOUT', () => {
  it('passes only content and customCTAButtonName — strips type field', () => {
    const store = makeStore();
    applyAIOp({ type: 'UPDATE_LAYOUT', content: '<h1>Hi</h1>', customCTAButtonName: 'Go' }, store as any);
    expect(store.updateLayout).toHaveBeenCalledWith({ content: '<h1>Hi</h1>', customCTAButtonName: 'Go' });
    // The type field must NOT be passed
    const callArg = (store.updateLayout as jest.Mock).mock.calls[0][0];
    expect(callArg).not.toHaveProperty('type');
  });

  it('omits undefined keys', () => {
    const store = makeStore();
    applyAIOp({ type: 'UPDATE_LAYOUT', customCTAButtonName: 'Submit' }, store as any);
    const callArg = (store.updateLayout as jest.Mock).mock.calls[0][0];
    expect(callArg).toEqual({ customCTAButtonName: 'Submit' });
  });
});

describe('applyAIOp — RENAME_PAGE', () => {
  it('calls updatePageTitle with correct args', () => {
    const store = makeStore();
    applyAIOp({ type: 'RENAME_PAGE', pageId: 'page-1', newTitle: 'Basic Info' }, store as any);
    expect(store.updatePageTitle).toHaveBeenCalledWith('page-1', 'Basic Info');
  });

  it('does nothing when pageId not found', () => {
    const store = makeStore();
    applyAIOp({ type: 'RENAME_PAGE', pageId: 'unknown', newTitle: 'X' }, store as any);
    expect(store.updatePageTitle).not.toHaveBeenCalled();
  });
});

describe('applyAIOp — REORDER_PAGES', () => {
  it('calls reorderPages to move page to target index', () => {
    const store = makeStore();
    // Desired: page-2 first, then page-1
    applyAIOp({ type: 'REORDER_PAGES', pageIds: ['page-2', 'page-1'] }, store as any);
    expect(store.reorderPages).toHaveBeenCalledWith(1, 0);
  });

  it('does nothing when order is already correct', () => {
    const store = makeStore();
    applyAIOp({ type: 'REORDER_PAGES', pageIds: ['page-1', 'page-2'] }, store as any);
    expect(store.reorderPages).not.toHaveBeenCalled();
  });
});
