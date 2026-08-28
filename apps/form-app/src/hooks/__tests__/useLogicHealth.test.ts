import { renderHook } from '@testing-library/react';
import { ConditionalRule, FieldType, FormPage } from '@dculus/types';
import { cleanupRuleReferences, useLogicHealth } from '../useLogicHealth';

const makePage = (
  id: string,
  fields: Array<{ id: string; type: FieldType; deleted?: boolean }>
): FormPage =>
  ({ id, title: id, order: 0, fields } as unknown as FormPage);

const makeRule = (overrides: Partial<ConditionalRule>): ConditionalRule => ({
  id: 'rule-1',
  enabled: true,
  combinator: 'all',
  terms: [],
  actions: [],
  ...overrides,
});

const pages = [
  makePage('page-1', [
    { id: 'trigger', type: FieldType.RADIO_FIELD },
    { id: 'target', type: FieldType.TEXT_INPUT_FIELD },
  ]),
];

describe('useLogicHealth — unreachable fields', () => {
  // Being the target of an enabled `showField` puts a field in the evaluator's
  // `defaultHiddenFields` set (packages/types/src/conditions.ts). If the only
  // rule that would show it can never match, the field is invisible to every
  // respondent, forever — and nothing in the builder said so before this check.
  it('flags a field that only a never-matching rule could show', () => {
    const rules = [
      makeRule({
        // Trigger field was deleted, so `termMatches` returns false for every
        // response: this rule can never fire.
        terms: [{ fieldId: 'deleted-trigger', operator: 'isFilled' }],
        actions: [{ type: 'showField', fieldIds: ['target'] }],
      }),
    ];

    const { result } = renderHook(() => useLogicHealth(rules, pages));

    const unreachable = result.current.issues.filter((issue) => issue.kind === 'unreachableField');
    expect(unreachable).toHaveLength(1);
    expect(unreachable[0].detail.fieldId).toBe('target');
  });

  it('does not flag a field a working rule can show', () => {
    const rules = [
      makeRule({
        terms: [{ fieldId: 'trigger', operator: 'equals', value: 'Yes' }],
        actions: [{ type: 'showField', fieldIds: ['target'] }],
      }),
    ];

    const { result } = renderHook(() => useLogicHealth(rules, pages));

    expect(result.current.issues.filter((issue) => issue.kind === 'unreachableField')).toHaveLength(
      0
    );
  });

  // A disabled `showField` rule never contributes to `defaultHiddenFields`, so
  // the field simply reverts to always-visible — not a problem to report.
  it('does not flag a field whose only show-rule is turned off', () => {
    const rules = [
      makeRule({
        enabled: false,
        terms: [{ fieldId: 'deleted-trigger', operator: 'isFilled' }],
        actions: [{ type: 'showField', fieldIds: ['target'] }],
      }),
    ];

    const { result } = renderHook(() => useLogicHealth(rules, pages));

    expect(result.current.issues.filter((issue) => issue.kind === 'unreachableField')).toHaveLength(
      0
    );
    expect(result.current.disabledCount).toBe(1);
    expect(result.current.enabledCount).toBe(0);
  });
});

describe('useLogicHealth — soft-deleted fields', () => {
  // evaluateConditions skips `field.deleted`, so a rule pointing at one can
  // never match. Health must report it as dangling, exactly like a hard delete.
  const pagesWithDeleted = [
    makePage('page-1', [
      { id: 'trigger', type: FieldType.RADIO_FIELD },
      { id: 'target', type: FieldType.TEXT_INPUT_FIELD },
      { id: 'gone-soft', type: FieldType.TEXT_INPUT_FIELD, deleted: true },
    ]),
  ];

  it('flags a rule whose term references a soft-deleted field', () => {
    const rules = [
      makeRule({
        terms: [{ fieldId: 'gone-soft', operator: 'isFilled' }],
        actions: [{ type: 'showField', fieldIds: ['target'] }],
      }),
    ];

    const { result } = renderHook(() => useLogicHealth(rules, pagesWithDeleted));

    expect(result.current.ruleIdsWithIssues.has('rule-1')).toBe(true);
  });

  it('strips a soft-deleted action target during cleanup', () => {
    const rule = makeRule({
      terms: [{ fieldId: 'trigger', operator: 'isFilled' }],
      actions: [{ type: 'hideField', fieldIds: ['gone-soft', 'target'] }],
    });

    const { rule: cleaned } = cleanupRuleReferences(rule, pagesWithDeleted);

    expect(cleaned.actions).toEqual([{ type: 'hideField', fieldIds: ['target'] }]);
  });
});

describe('cleanupRuleReferences', () => {
  it('drops dangling terms and action targets but keeps the live ones', () => {
    const rule = makeRule({
      terms: [
        { fieldId: 'gone', operator: 'isFilled' },
        { fieldId: 'trigger', operator: 'equals', value: 'Yes' },
      ],
      actions: [{ type: 'showField', fieldIds: ['gone-too', 'target'] }],
    });

    const { rule: cleaned, wouldBeEmpty } = cleanupRuleReferences(rule, pages);

    expect(cleaned.terms).toEqual([{ fieldId: 'trigger', operator: 'equals', value: 'Yes' }]);
    expect(cleaned.actions).toEqual([{ type: 'showField', fieldIds: ['target'] }]);
    expect(wouldBeEmpty).toBe(false);
  });

  // Saving a rule with no terms left would leave an inert husk: the evaluator
  // skips it and the author can't read what it was ever meant to do.
  it('reports wouldBeEmpty when every term is dangling', () => {
    const rule = makeRule({
      terms: [{ fieldId: 'gone', operator: 'isFilled' }],
      actions: [{ type: 'showField', fieldIds: ['target'] }],
    });

    expect(cleanupRuleReferences(rule, pages).wouldBeEmpty).toBe(true);
  });

  it('reports wouldBeEmpty when an action loses all of its targets', () => {
    const rule = makeRule({
      terms: [{ fieldId: 'trigger', operator: 'isFilled' }],
      actions: [{ type: 'hideField', fieldIds: ['gone'] }],
    });

    expect(cleanupRuleReferences(rule, pages).wouldBeEmpty).toBe(true);
  });

  it('drops a page action pointing at a deleted page', () => {
    const rule = makeRule({
      terms: [{ fieldId: 'trigger', operator: 'isFilled' }],
      actions: [
        { type: 'skipToPage', pageId: 'no-such-page' },
        { type: 'hideField', fieldIds: ['target'] },
      ],
    });

    const { rule: cleaned, wouldBeEmpty } = cleanupRuleReferences(rule, pages);

    expect(cleaned.actions).toEqual([{ type: 'hideField', fieldIds: ['target'] }]);
    expect(wouldBeEmpty).toBe(false);
  });
});

describe('useLogicHealth — broken references', () => {
  it('reports the missing field ids on the rule that references them', () => {
    const rules = [
      makeRule({
        terms: [{ fieldId: 'gone', operator: 'isFilled' }],
        actions: [{ type: 'showField', fieldIds: ['target'] }],
      }),
    ];

    const { result } = renderHook(() => useLogicHealth(rules, pages));

    const broken = result.current.issues.find((issue) => issue.kind === 'brokenReference');
    expect(broken?.detail.missingFieldIds).toContain('gone');
    expect(result.current.ruleIdsWithIssues.has('rule-1')).toBe(true);
  });
});
