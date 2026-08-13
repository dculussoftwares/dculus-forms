import { ConditionalRule, FieldType, FormPage } from '@dculus/types';
import { checkBackwardReference, checkRuleReferences } from '../conditionFieldConfig';

const makeRule = (overrides: Partial<ConditionalRule>): ConditionalRule => ({
  id: 'rule-1',
  enabled: true,
  combinator: 'all',
  terms: [],
  actions: [],
  ...overrides,
});

const makePage = (id: string, fields: Array<{ id: string; type: FieldType; options?: string[] }>): FormPage =>
  ({ id, title: id, order: 0, fields } as unknown as FormPage);

describe('checkRuleReferences — field type conversion', () => {
  // fieldsSlice.convertFieldType (apps/form-app/src/store/slices/fieldsSlice.ts) never mutates
  // a field in place: it deletes the old field and inserts a brand-new one with a fresh id at
  // the same index (comment there explains why — old-typed response data must not be
  // reinterpreted under the same id). Any rule that referenced the old id is therefore orphaned
  // exactly like a deletion, even though the field conceptually "still exists" at that slot.
  it('flags a term referencing the pre-conversion field id as a missing reference', () => {
    const rule = makeRule({
      terms: [{ fieldId: 'field-a', operator: 'equals', value: 'hello' }],
    });

    // Field was TEXT_INPUT_FIELD('field-a'); user converted it to NUMBER_FIELD, which
    // fieldsSlice implements as delete 'field-a' + insert a new field with id 'field-a-v2'.
    const pagesAfterConversion = [makePage('page-1', [{ id: 'field-a-v2', type: FieldType.NUMBER_FIELD }])];

    const result = checkRuleReferences(rule, pagesAfterConversion);

    expect(result.missingTermFieldIds).toEqual(['field-a']);
    expect(result.hasBrokenReferences).toBe(true);
  });

  it('flags an action targeting the pre-conversion field id as a missing reference', () => {
    const rule = makeRule({
      terms: [{ fieldId: 'field-trigger', operator: 'isFilled' }],
      actions: [{ type: 'showField', fieldIds: ['field-a'] }],
    });

    const pagesAfterConversion = [
      makePage('page-1', [
        { id: 'field-trigger', type: FieldType.TEXT_INPUT_FIELD },
        { id: 'field-a-v2', type: FieldType.CHECKBOX_FIELD },
      ]),
    ];

    const result = checkRuleReferences(rule, pagesAfterConversion);

    expect(result.missingActionFieldIds).toEqual(['field-a']);
    expect(result.hasBrokenReferences).toBe(true);
  });

  it('does not flag anything once the rule is repointed at the new field id', () => {
    const rule = makeRule({
      terms: [{ fieldId: 'field-a-v2', operator: 'isFilled' }],
    });

    const pagesAfterConversion = [makePage('page-1', [{ id: 'field-a-v2', type: FieldType.NUMBER_FIELD }])];

    const result = checkRuleReferences(rule, pagesAfterConversion);

    expect(result.hasBrokenReferences).toBe(false);
  });
});

describe('checkBackwardReference', () => {
  const page1 = makePage('page-1', [{ id: 'field-p1', type: FieldType.TEXT_INPUT_FIELD }]);
  const page2 = makePage('page-2', [{ id: 'field-p2', type: FieldType.TEXT_INPUT_FIELD }]);
  const page3 = makePage('page-3', [{ id: 'field-p3', type: FieldType.TEXT_INPUT_FIELD }]);
  const pages = [page1, page2, page3];

  it('flags a rule whose showField action targets an earlier page than its trigger', () => {
    const rule = makeRule({
      terms: [{ fieldId: 'field-p3', operator: 'isFilled' }],
      actions: [{ type: 'showField', fieldIds: ['field-p1'] }],
    });

    const result = checkBackwardReference(rule, pages);

    expect(result.hasBackwardReference).toBe(true);
    expect(result.triggerPageIndex).toBe(2);
    expect(result.earliestTargetPageIndex).toBe(0);
  });

  it('flags a rule whose hidePage action targets an earlier page than its trigger', () => {
    const rule = makeRule({
      terms: [{ fieldId: 'field-p2', operator: 'isFilled' }],
      actions: [{ type: 'hidePage', pageId: 'page-1' }],
    });

    expect(checkBackwardReference(rule, pages).hasBackwardReference).toBe(true);
  });

  it('does not flag a forward reference (trigger before target)', () => {
    const rule = makeRule({
      terms: [{ fieldId: 'field-p1', operator: 'isFilled' }],
      actions: [{ type: 'showField', fieldIds: ['field-p3'] }],
    });

    expect(checkBackwardReference(rule, pages).hasBackwardReference).toBe(false);
  });

  it('does not flag a same-page reference', () => {
    const rule = makeRule({
      terms: [{ fieldId: 'field-p2', operator: 'isFilled' }],
      actions: [{ type: 'showField', fieldIds: ['field-p2'] }],
    });

    expect(checkBackwardReference(rule, pages).hasBackwardReference).toBe(false);
  });

  it('ignores skipToPage actions (already forward-only enforced by the evaluator)', () => {
    const rule = makeRule({
      terms: [{ fieldId: 'field-p3', operator: 'isFilled' }],
      actions: [{ type: 'skipToPage', pageId: 'page-1' }],
    });

    expect(checkBackwardReference(rule, pages).hasBackwardReference).toBe(false);
  });

  it('uses the latest trigger page when a rule has multiple terms across pages', () => {
    const rule = makeRule({
      combinator: 'all',
      terms: [
        { fieldId: 'field-p1', operator: 'isFilled' },
        { fieldId: 'field-p3', operator: 'isFilled' },
      ],
      actions: [{ type: 'showField', fieldIds: ['field-p2'] }],
    });

    // Trigger effectively can't be evaluated until page 3's answer exists, so
    // targeting page 2 still counts as backward even though field-p1 (an
    // earlier trigger) alone wouldn't have made it so.
    expect(checkBackwardReference(rule, pages).hasBackwardReference).toBe(true);
  });
});
