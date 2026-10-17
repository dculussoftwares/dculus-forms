import {
  clearLogicDraft,
  readLogicDraft,
  writeLogicDraft,
  type LogicDraftStash,
} from '../logicDraftStorage';

const stash = (overrides: Partial<LogicDraftStash> = {}): LogicDraftStash => ({
  v: 1,
  mode: 'edit',
  ruleId: 'rule-1',
  baseSignature: 'sig',
  baseEnabled: true,
  basePreserved: [],
  draft: {
    combinator: 'all',
    terms: [{ fieldId: 'f1', operator: 'equals', value: 'x' }],
    actions: [{ type: 'showField', fieldIds: ['f2'], pageId: '' }],
  },
  savedAt: 1,
  ...overrides,
});

describe('logicDraftStorage', () => {
  beforeEach(() => sessionStorage.clear());
  afterEach(() => jest.restoreAllMocks());

  it('round-trips a stash', () => {
    writeLogicDraft('form-1', stash());
    expect(readLogicDraft('form-1')).toEqual(stash());
  });

  it('scopes drafts per form', () => {
    writeLogicDraft('form-1', stash());
    expect(readLogicDraft('form-2')).toBeNull();
    clearLogicDraft('form-1');
    expect(readLogicDraft('form-1')).toBeNull();
  });

  it('drops invalid JSON and removes the key', () => {
    sessionStorage.setItem('dculus:logic-draft:form-1', '{not json');
    expect(readLogicDraft('form-1')).toBeNull();
    expect(sessionStorage.getItem('dculus:logic-draft:form-1')).toBeNull();
  });

  it('rejects an unknown action type', () => {
    const bad = stash();
    (bad.draft.actions[0] as { type: string }).type = 'launchMissiles';
    sessionStorage.setItem('dculus:logic-draft:form-1', JSON.stringify(bad));
    expect(readLogicDraft('form-1')).toBeNull();
  });

  it('rejects too many terms', () => {
    const bad = stash();
    bad.draft.terms = Array.from({ length: 51 }, () => ({ fieldId: 'f', operator: 'equals' as const }));
    sessionStorage.setItem('dculus:logic-draft:form-1', JSON.stringify(bad));
    expect(readLogicDraft('form-1')).toBeNull();
  });

  it('rejects an oversized payload', () => {
    sessionStorage.setItem('dculus:logic-draft:form-1', 'x'.repeat(200_001));
    expect(readLogicDraft('form-1')).toBeNull();
    expect(sessionStorage.getItem('dculus:logic-draft:form-1')).toBeNull();
  });

  it('never throws when storage is unavailable', () => {
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });
    jest.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('denied');
    });
    expect(() => writeLogicDraft('form-1', stash())).not.toThrow();
    expect(readLogicDraft('form-1')).toBeNull();
    expect(() => clearLogicDraft('form-1')).not.toThrow();
  });
});
