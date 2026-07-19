import { FieldType } from '@dculus/types';

// Mock config so the test never evaluates import.meta.env (Jest can't parse it).
jest.mock('../config', () => ({ getApiBaseUrl: () => 'http://localhost:4000' }));
// fetch is called fire-and-forget on real mutations; stub it.
(global as any).fetch = jest.fn(() => Promise.resolve({ ok: true }));

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
    addPageAtPosition: jest.fn(),
    removePage: jest.fn(),
    moveFieldBetweenPages: jest.fn(),
    convertFieldType: jest.fn(),
    setAIHighlightedFieldId: jest.fn(),
    setPendingValidationSuggestions: jest.fn(),
    addPendingConditionSuggestion: jest.fn(),
    addPendingDestructiveAction: jest.fn(),
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

  it('skips (does not add) when pageId is not found', () => {
    const store = makeStore();
    applyAIOp({ type: 'ADD_FIELD', pageId: 'nonexistent', insertAfterFieldId: null, fieldType: 'text', label: 'X', required: false, placeholder: null, options: null }, store as any);
    expect(store.addField).not.toHaveBeenCalled();
    expect(store.addFieldAtIndex).not.toHaveBeenCalled();
  });

  it('passes options for choice fields', () => {
    const store = makeStore();
    applyAIOp({ type: 'ADD_FIELD', pageId: 'page-1', insertAfterFieldId: null, fieldType: 'select', label: 'Size', required: false, placeholder: null, options: ['S', 'M', 'L'] }, store as any);
    expect(store.addField).toHaveBeenCalledWith('page-1', FieldType.SELECT_FIELD, expect.objectContaining({ options: ['S', 'M', 'L'] }));
  });
});

describe('applyAIOp — UPDATE_FIELDS', () => {
  it('finds the page by fieldId and calls updateField (single)', () => {
    const store = makeStore();
    applyAIOp({ type: 'UPDATE_FIELDS', fieldIds: ['f-3'], updates: { label: 'Work Email' } }, store as any);
    expect(store.updateField).toHaveBeenCalledWith('page-2', 'f-3', { label: 'Work Email' });
  });

  it('loops over all fieldIds (bulk)', () => {
    const store = makeStore();
    applyAIOp({ type: 'UPDATE_FIELDS', fieldIds: ['f-1', 'f-3'], updates: { required: true } }, store as any);
    expect(store.updateField).toHaveBeenCalledWith('page-1', 'f-1', { required: true });
    expect(store.updateField).toHaveBeenCalledWith('page-2', 'f-3', { required: true });
  });

  it('skips fieldIds that are not found', () => {
    const store = makeStore();
    applyAIOp({ type: 'UPDATE_FIELDS', fieldIds: ['unknown'], updates: { label: 'X' } }, store as any);
    expect(store.updateField).not.toHaveBeenCalled();
  });
});

describe('applyAIOp — PROPOSE_DELETE_FIELDS (no immediate delete)', () => {
  it('enqueues a delete-fields confirmation and does NOT remove anything', () => {
    const store = makeStore();
    applyAIOp(
      { type: 'PROPOSE_DELETE_FIELDS', fields: [{ fieldId: 'f-2', label: 'Country', responseCount: 3 }] },
      store as any,
      undefined,
      'call-1'
    );
    expect(store.removeField).not.toHaveBeenCalled();
    expect(store.addPendingDestructiveAction).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'call-1', kind: 'delete-fields' })
    );
  });

  it('drops fields that no longer exist before enqueuing', () => {
    const store = makeStore();
    applyAIOp(
      { type: 'PROPOSE_DELETE_FIELDS', fields: [
        { fieldId: 'f-1', label: 'Name', responseCount: 0 },
        { fieldId: 'gone', label: 'Gone', responseCount: 0 },
      ] },
      store as any,
      undefined,
      'call-2'
    );
    const action = (store.addPendingDestructiveAction as jest.Mock).mock.calls[0][0];
    expect(action.fields.map((f: any) => f.fieldId)).toEqual(['f-1']);
  });

  it('does not enqueue when no proposed field exists', () => {
    const store = makeStore();
    applyAIOp(
      { type: 'PROPOSE_DELETE_FIELDS', fields: [{ fieldId: 'gone', label: 'Gone', responseCount: 0 }] },
      store as any,
      undefined,
      'call-3'
    );
    expect(store.addPendingDestructiveAction).not.toHaveBeenCalled();
  });
});

describe('applyAIOp — PROPOSE_FIELD_TYPE_CHANGE (no immediate change)', () => {
  it('enqueues a convert confirmation and does NOT convert', () => {
    const store = makeStore();
    applyAIOp(
      { type: 'PROPOSE_FIELD_TYPE_CHANGE', fieldId: 'f-1', label: 'Name', currentType: 'text', newFieldType: 'select', responseCount: 2 },
      store as any,
      undefined,
      'call-4'
    );
    expect(store.convertFieldType).not.toHaveBeenCalled();
    expect(store.addPendingDestructiveAction).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'call-4', kind: 'convert', fieldId: 'f-1', newFieldType: 'select' })
    );
  });

  it('does nothing when the field does not exist', () => {
    const store = makeStore();
    applyAIOp(
      { type: 'PROPOSE_FIELD_TYPE_CHANGE', fieldId: 'gone', label: 'X', currentType: 'text', newFieldType: 'email', responseCount: 0 },
      store as any,
      undefined,
      'call-5'
    );
    expect(store.addPendingDestructiveAction).not.toHaveBeenCalled();
  });
});

describe('applyAIOp — PROPOSE_CONDITION_RULE (no immediate add)', () => {
  const rule = {
    id: 'condition-1', enabled: true, combinator: 'all',
    terms: [{ fieldId: 'f-2', operator: 'equals', value: 'India' }],
    actions: [{ type: 'showField', fieldIds: ['f-1'] }],
  };

  it('queues a sanitized suggestion and never adds a rule directly', () => {
    const store = makeStore();
    applyAIOp({ type: 'PROPOSE_CONDITION_RULE', rule, rationale: 'Only show this in India.' }, store as any, undefined, 'call-condition');
    expect(store.addPendingConditionSuggestion).toHaveBeenCalledWith({
      id: 'call-condition', rule, rationale: 'Only show this in India.',
    });
  });

  it('drops malformed rules before they reach pending suggestions', () => {
    const store = makeStore();
    applyAIOp({ type: 'PROPOSE_CONDITION_RULE', rule: { ...rule, combinator: 'invalid' }, rationale: 'Bad rule' }, store as any);
    expect(store.addPendingConditionSuggestion).not.toHaveBeenCalled();
  });
});

describe('applyAIOp — REORDER (fields)', () => {
  it('calls reorderFields to move each field to its target index', () => {
    const store = makeStore();
    // Desired: f-2 first, then f-1
    applyAIOp({ type: 'REORDER', scope: 'fields', pageId: 'page-1', ids: ['f-2', 'f-1'] }, store as any);
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

describe('applyAIOp — REORDER (pages)', () => {
  it('calls reorderPages to move page to target index', () => {
    const store = makeStore();
    // Desired: page-2 first, then page-1
    applyAIOp({ type: 'REORDER', scope: 'pages', ids: ['page-2', 'page-1'] }, store as any);
    expect(store.reorderPages).toHaveBeenCalledWith(1, 0);
  });

  it('does nothing when order is already correct', () => {
    const store = makeStore();
    applyAIOp({ type: 'REORDER', scope: 'pages', ids: ['page-1', 'page-2'] }, store as any);
    expect(store.reorderPages).not.toHaveBeenCalled();
  });
});

describe('applyAIOp — ADD_PAGE', () => {
  it('calls addPageAtPosition with title, null insertAfterPageId and pre-generated pageId', () => {
    const store = makeStore();
    applyAIOp({ type: 'ADD_PAGE', pageId: 'page-new', title: 'Step 2', insertAfterPageId: null }, store as any);
    expect(store.addPageAtPosition).toHaveBeenCalledWith('Step 2', null, 'page-new');
  });

  it('calls addPageAtPosition with insertAfterPageId when provided', () => {
    const store = makeStore();
    applyAIOp({ type: 'ADD_PAGE', pageId: 'page-new', title: 'Middle', insertAfterPageId: 'page-1' }, store as any);
    expect(store.addPageAtPosition).toHaveBeenCalledWith('Middle', 'page-1', 'page-new');
  });

  it('falls back to "New Page" when title is undefined', () => {
    const store = makeStore();
    applyAIOp({ type: 'ADD_PAGE', pageId: 'page-new', title: undefined, insertAfterPageId: null }, store as any);
    expect(store.addPageAtPosition).toHaveBeenCalledWith('New Page', null, 'page-new');
  });
});

describe('applyAIOp — PROPOSE_DELETE_PAGE (no immediate delete)', () => {
  it('enqueues a delete-page confirmation and does NOT remove the page', () => {
    const store = makeStore();
    applyAIOp(
      { type: 'PROPOSE_DELETE_PAGE', pageId: 'page-2', pageTitle: 'Contact', fieldCount: 1, responseCount: 4 },
      store as any,
      undefined,
      'call-6'
    );
    expect(store.removePage).not.toHaveBeenCalled();
    expect(store.addPendingDestructiveAction).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'call-6', kind: 'delete-page', pageId: 'page-2', fieldCount: 1, responseCount: 4 })
    );
  });

  it('does nothing when the page does not exist', () => {
    const store = makeStore();
    applyAIOp(
      { type: 'PROPOSE_DELETE_PAGE', pageId: 'nonexistent', pageTitle: 'X', fieldCount: 0, responseCount: 0 },
      store as any,
      undefined,
      'call-7'
    );
    expect(store.addPendingDestructiveAction).not.toHaveBeenCalled();
  });
});
