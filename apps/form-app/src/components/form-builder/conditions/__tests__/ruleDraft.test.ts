import { ConditionalRule, FieldType } from '@dculus/types';
import {
  cleanupDraftReferences,
  deriveSaveStatus,
  draftSignature,
  emptyAction,
  emptyTerm,
  getDraftIssues,
  initialDraftFor,
  planCommit,
  reconcileWithLive,
  ruleSignature,
  type DraftIssueContext,
  type RuleDraft,
} from '../ruleDraft';

const makeRule = (overrides: Partial<ConditionalRule> = {}): ConditionalRule => ({
  id: 'rule-1',
  enabled: true,
  combinator: 'all',
  terms: [{ fieldId: 'f-text', operator: 'equals', value: 'yes' }],
  actions: [{ type: 'showField', fieldIds: ['f-target'] }],
  ...overrides,
});

const ctx = (overrides: Partial<DraftIssueContext> = {}): DraftIssueContext => ({
  triggerFieldById: new Map([
    ['f-text', { type: FieldType.TEXT_INPUT_FIELD }],
    ['f-num', { type: FieldType.NUMBER_FIELD }],
  ]),
  existingFieldIds: new Set(['f-text', 'f-num', 'f-target']),
  existingPageIds: new Set(['p1', 'p2']),
  preservedCount: 0,
  ...overrides,
});

describe('draftSignature / dirty detection', () => {
  it('ignores key order and an explicit undefined value', () => {
    const a: RuleDraft = {
      terms: [{ fieldId: 'f', operator: 'equals', value: undefined }],
      actions: [emptyAction()],
      combinator: 'all',
    };
    const b: RuleDraft = {
      terms: [{ operator: 'equals', fieldId: 'f' }],
      actions: [{ pageId: '', fieldIds: [], type: 'showField' }],
      combinator: 'all',
    };
    expect(draftSignature(a)).toBe(draftSignature(b));
  });

  it('changes with combinator, values and action target order', () => {
    const base = initialDraftFor(makeRule({ actions: [{ type: 'showField', fieldIds: ['a', 'b'] }] }));
    const sig = draftSignature(base);
    expect(draftSignature({ ...base, combinator: 'any' })).not.toBe(sig);
    expect(
      draftSignature({ ...base, terms: [{ ...base.terms[0], value: 'no' }] })
    ).not.toBe(sig);
    expect(
      draftSignature({
        ...base,
        actions: [{ ...base.actions[0], fieldIds: ['b', 'a'] }],
      })
    ).not.toBe(sig);
  });

  it('ruleSignature matches the signature of the draft opened from that rule', () => {
    const rule = makeRule();
    expect(ruleSignature(rule)).toBe(draftSignature(initialDraftFor(rule)));
  });

  it('treats a blank new draft and an unedited seed as clean against their own base', () => {
    const blank = initialDraftFor(null);
    expect(draftSignature(initialDraftFor(null))).toBe(draftSignature(blank));

    const seed = {
      terms: [{ fieldId: 'f-text', operator: 'equals' as const, value: 'x' }],
      actions: [{ type: 'hideField' as const, fieldIds: ['f-target'] }],
    };
    expect(draftSignature(initialDraftFor(null, seed))).toBe(
      draftSignature(initialDraftFor(null, seed))
    );
    expect(draftSignature(initialDraftFor(null, seed))).not.toBe(draftSignature(blank));
  });

  it('returns to clean when an edit is undone', () => {
    const rule = makeRule();
    const original = draftSignature(initialDraftFor(rule));
    const edited = initialDraftFor(rule);
    edited.terms[0] = { ...edited.terms[0], value: 'changed' };
    expect(draftSignature(edited)).not.toBe(original);
    edited.terms[0] = { ...edited.terms[0], value: 'yes' };
    expect(draftSignature(edited)).toBe(original);
  });
});

describe('getDraftIssues (validity gate)', () => {
  it('flags a blank draft', () => {
    const issues = getDraftIssues(initialDraftFor(null), ctx());
    expect(issues.terms).toEqual(['selectField']);
    expect(issues.actions).toEqual(['selectTarget']);
    expect(issues.count).toBe(2);
  });

  it('accepts a complete rule', () => {
    expect(getDraftIssues(initialDraftFor(makeRule()), ctx()).count).toBe(0);
  });

  it('requires a value unless the operator takes none', () => {
    const draft = initialDraftFor(makeRule());
    draft.terms[0] = { fieldId: 'f-text', operator: 'equals', value: '  ' };
    expect(getDraftIssues(draft, ctx()).terms[0]).toBe('enterValue');
    draft.terms[0] = { fieldId: 'f-text', operator: 'isFilled' };
    expect(getDraftIssues(draft, ctx()).terms[0]).toBeNull();
  });

  it('accepts numeric strings for number fields and rejects junk', () => {
    const draft = initialDraftFor(makeRule());
    draft.terms[0] = { fieldId: 'f-num', operator: 'greaterThan', value: '5' as unknown as number };
    expect(getDraftIssues(draft, ctx()).terms[0]).toBeNull();
    draft.terms[0] = { fieldId: 'f-num', operator: 'greaterThan', value: 'abc' as unknown as number };
    expect(getDraftIssues(draft, ctx()).terms[0]).toBe('enterNumber');
    draft.terms[0] = { fieldId: 'f-num', operator: 'greaterThan' };
    expect(getDraftIssues(draft, ctx()).terms[0]).toBe('enterNumber');
  });

  it('rejects an operator the field type does not support', () => {
    const draft = initialDraftFor(makeRule());
    draft.terms[0] = { fieldId: 'f-text', operator: 'lessThan', value: '1' as unknown as number };
    expect(getDraftIssues(draft, ctx()).terms[0]).toBe('selectOperator');
  });

  it('treats a trigger field that no longer exists as unselected', () => {
    const draft = initialDraftFor(makeRule());
    draft.terms[0] = { fieldId: 'deleted', operator: 'equals', value: 'x' };
    expect(getDraftIssues(draft, ctx()).terms[0]).toBe('selectField');
  });

  it('validates page and field actions, including deleted targets', () => {
    const draft: RuleDraft = {
      terms: initialDraftFor(makeRule()).terms,
      combinator: 'all',
      actions: [
        { type: 'hidePage', fieldIds: [], pageId: '' },
        { type: 'hidePage', fieldIds: [], pageId: 'gone' },
        { type: 'skipToPage', fieldIds: [], pageId: 'p2' },
        { type: 'showField', fieldIds: [], pageId: '' },
        { type: 'showField', fieldIds: ['f-target', 'gone'], pageId: '' },
      ],
    };
    expect(getDraftIssues(draft, ctx()).actions).toEqual([
      'selectPage',
      'missingPage',
      null,
      'selectTarget',
      'missingTarget',
    ]);
  });

  it('lets a rule with only preserved actions pass with no editor rows', () => {
    const draft: RuleDraft = { ...initialDraftFor(makeRule()), actions: [] };
    expect(getDraftIssues(draft, ctx({ preservedCount: 0 })).noActions).toBe(true);
    const withPreserved = getDraftIssues(draft, ctx({ preservedCount: 1 }));
    expect(withPreserved.noActions).toBe(false);
    expect(withPreserved.count).toBe(0);
  });

  it('flags a draft with no terms', () => {
    const draft: RuleDraft = { ...initialDraftFor(makeRule()), terms: [] };
    expect(getDraftIssues(draft, ctx()).noTerms).toBe(true);
  });
});

describe('reconcileWithLive', () => {
  const rule = makeRule();
  const baseSignature = ruleSignature(rule);
  const changed = makeRule({ combinator: 'any' });
  const changedSignature = ruleSignature(changed);
  const mine = draftSignature({ ...initialDraftFor(rule), combinator: 'any', terms: [] });

  it('never reconciles a new draft', () => {
    expect(
      reconcileWithLive({ mode: 'create', baseSignature, draftSignature: baseSignature, liveRule: undefined })
    ).toBe('in-sync');
  });

  it('reports a deleted rule', () => {
    expect(
      reconcileWithLive({ mode: 'edit', baseSignature, draftSignature: baseSignature, liveRule: undefined })
    ).toBe('deleted');
  });

  it('is in sync when the live rule still matches the base', () => {
    expect(
      reconcileWithLive({ mode: 'edit', baseSignature, draftSignature: mine, liveRule: rule })
    ).toBe('in-sync');
  });

  it('rebases a clean draft onto a collaborator edit', () => {
    expect(
      reconcileWithLive({ mode: 'edit', baseSignature, draftSignature: baseSignature, liveRule: changed })
    ).toBe('rebase');
  });

  it('rebases when both sides made the same change', () => {
    expect(
      reconcileWithLive({ mode: 'edit', baseSignature, draftSignature: changedSignature, liveRule: changed })
    ).toBe('rebase');
  });

  it('flags a conflict when both sides diverged', () => {
    expect(
      reconcileWithLive({ mode: 'edit', baseSignature, draftSignature: mine, liveRule: changed })
    ).toBe('conflict');
  });

  it('ignores the card enable toggle', () => {
    expect(
      reconcileWithLive({
        mode: 'edit',
        baseSignature,
        draftSignature: mine,
        liveRule: { ...rule, enabled: false },
      })
    ).toBe('in-sync');
  });
});

describe('planCommit', () => {
  const draft = initialDraftFor(makeRule());
  const args = (overrides: Partial<Parameters<typeof planCommit>[0]> = {}) => ({
    intent: 'update' as const,
    ruleId: 'rule-1',
    draft,
    baseEnabled: true,
    basePreserved: [],
    liveRules: [makeRule()],
    ...overrides,
  });

  it('keeps the live enabled flag when updating (the card toggle wins)', () => {
    const plan = planCommit(args({ baseEnabled: true, liveRules: [makeRule({ enabled: false })] }));
    expect(plan.kind).toBe('update');
    if (plan.kind === 'update') expect(plan.rule.enabled).toBe(false);
  });

  it('re-appends unknown actions from the live rule so they are never dropped', () => {
    const unknown = { type: 'showPage', pageId: 'p9' } as ConditionalRule['actions'][number];
    const plan = planCommit(
      args({ liveRules: [makeRule({ actions: [{ type: 'showField', fieldIds: ['f-target'] }, unknown] })] })
    );
    expect(plan.kind).toBe('update');
    if (plan.kind === 'update') {
      expect(plan.rule.actions).toContainEqual(unknown);
      expect(plan.rule.actions).toHaveLength(2);
    }
  });

  it('blocks an update when the rule was deleted (no resurrection)', () => {
    expect(planCommit(args({ liveRules: [] }))).toEqual({ kind: 'blocked', reason: 'deleted' });
  });

  it('adds a new rule enabled, with the base preserved actions', () => {
    const preserved = [{ type: 'showPage', pageId: 'p9' } as ConditionalRule['actions'][number]];
    const plan = planCommit(
      args({ intent: 'create', liveRules: [], basePreserved: preserved })
    );
    expect(plan.kind).toBe('add');
    if (plan.kind === 'add') {
      expect(plan.rule.enabled).toBe(true);
      expect(plan.rule.actions).toContainEqual(preserved[0]);
    }
  });

  it('turns a repeated create into an update instead of a duplicate', () => {
    const plan = planCommit(args({ intent: 'create' }));
    expect(plan.kind).toBe('update');
  });

  it('re-creates a deleted rule', () => {
    const plan = planCommit(args({ intent: 'recreate', liveRules: [], baseEnabled: false }));
    expect(plan.kind).toBe('add');
    if (plan.kind === 'add') expect(plan.rule.enabled).toBe(false);
  });

  it('deep-clones the draft so later edits do not change the plan', () => {
    const mutable = initialDraftFor(makeRule());
    const plan = planCommit(args({ draft: mutable }));
    mutable.terms[0].value = 'mutated';
    mutable.actions[0].fieldIds.push('extra');
    if (plan.kind !== 'update') throw new Error('expected update');
    expect(plan.rule.terms[0].value).toBe('yes');
    expect(plan.rule.actions[0]).toEqual({ type: 'showField', fieldIds: ['f-target'] });
  });
});

describe('cleanupDraftReferences', () => {
  const live = { existingFieldIds: new Set(['f-text', 'f-target']), existingPageIds: new Set(['p1']) };

  it('removes deleted fields and pages and counts them', () => {
    const draft: RuleDraft = {
      combinator: 'all',
      terms: [
        { fieldId: 'f-text', operator: 'equals', value: 'a' },
        { fieldId: 'gone', operator: 'equals', value: 'b' },
      ],
      actions: [
        { type: 'showField', fieldIds: ['f-target', 'gone'], pageId: '' },
        { type: 'hidePage', fieldIds: [], pageId: 'gone' },
      ],
    };
    const result = cleanupDraftReferences(draft, { ...live, preservedCount: 0 });
    expect(result.removed).toBe(3);
    expect(result.draft.terms).toHaveLength(1);
    expect(result.draft.actions).toEqual([{ type: 'showField', fieldIds: ['f-target'], pageId: '' }]);
  });

  it('keeps blank in-progress rows and falls back to placeholders', () => {
    const draft: RuleDraft = {
      combinator: 'all',
      terms: [emptyTerm(), { fieldId: 'gone', operator: 'equals', value: 'b' }],
      actions: [{ type: 'showField', fieldIds: ['gone'], pageId: '' }],
    };
    const result = cleanupDraftReferences(draft, { ...live, preservedCount: 0 });
    expect(result.draft.terms).toEqual([emptyTerm()]);
    expect(result.draft.actions).toEqual([emptyAction()]);
  });

  it('leaves no placeholder action when preserved actions remain', () => {
    const draft: RuleDraft = {
      combinator: 'all',
      terms: [{ fieldId: 'f-text', operator: 'equals', value: 'a' }],
      actions: [{ type: 'showField', fieldIds: ['gone'], pageId: '' }],
    };
    const result = cleanupDraftReferences(draft, { ...live, preservedCount: 1 });
    expect(result.draft.actions).toEqual([]);
  });

  it('reports nothing removed for a healthy draft', () => {
    const draft = initialDraftFor(makeRule());
    expect(cleanupDraftReferences(draft, { ...live, preservedCount: 0 }).removed).toBe(0);
  });
});

describe('deriveSaveStatus', () => {
  const base = {
    canEdit: true,
    isConnected: true,
    mode: 'edit' as const,
    isDirty: true,
    isComplete: true,
    showErrors: false,
    remote: 'in-sync' as const,
    writeFailed: false,
  };

  it.each([
    [{ canEdit: false, isConnected: false }, 'readOnly'],
    [{ isConnected: false, writeFailed: true, remote: 'deleted' as const }, 'offline'],
    [{ writeFailed: true, remote: 'deleted' as const }, 'error'],
    [{ remote: 'deleted' as const }, 'deleted'],
    [{ remote: 'conflict' as const }, 'conflict'],
    [{ isDirty: false, mode: 'create' as const }, 'createIdle'],
    [{ isDirty: false }, 'clean'],
    [{ isComplete: false, showErrors: true }, 'invalid'],
    [{ isComplete: false }, 'incomplete'],
    [{}, 'dirty'],
  ])('%j -> %s', (overrides, expected) => {
    expect(deriveSaveStatus({ ...base, ...overrides })).toBe(expected);
  });

  it('puts offline above an invalid draft', () => {
    expect(
      deriveSaveStatus({ ...base, isConnected: false, isComplete: false, showErrors: true })
    ).toBe('offline');
  });
});
