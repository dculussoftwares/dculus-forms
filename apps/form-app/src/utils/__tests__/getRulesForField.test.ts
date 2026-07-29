import { ConditionalRule } from '@dculus/types';
import { getRulesForField, ruleReferencesField } from '../getRulesForField';

const makeRule = (overrides: Partial<ConditionalRule>): ConditionalRule => ({
  id: 'rule-1',
  enabled: true,
  combinator: 'all',
  terms: [],
  actions: [],
  ...overrides,
});

describe('getRulesForField', () => {
  it('matches a rule via a term trigger', () => {
    const rule = makeRule({ terms: [{ fieldId: 'field-a', operator: 'equals', value: 'x' }] });
    expect(ruleReferencesField(rule, 'field-a')).toBe(true);
    expect(ruleReferencesField(rule, 'field-b')).toBe(false);
  });

  it('matches a rule via a fieldIds action target', () => {
    const rule = makeRule({ actions: [{ type: 'showField', fieldIds: ['field-a', 'field-c'] }] });
    expect(ruleReferencesField(rule, 'field-c')).toBe(true);
    expect(ruleReferencesField(rule, 'field-z')).toBe(false);
  });

  it('does not match a page-jump action (no fieldIds)', () => {
    const rule = makeRule({ actions: [{ type: 'skipToPage', pageId: 'page-1' }] });
    expect(ruleReferencesField(rule, 'page-1')).toBe(false);
  });

  it('returns only the rules referencing the given field, preserving order', () => {
    const ruleA = makeRule({ id: 'a', terms: [{ fieldId: 'field-a', operator: 'equals', value: 1 }] });
    const ruleB = makeRule({ id: 'b', terms: [{ fieldId: 'field-b', operator: 'equals', value: 1 }] });
    const ruleC = makeRule({ id: 'c', actions: [{ type: 'showField', fieldIds: ['field-a'] }] });

    expect(getRulesForField([ruleA, ruleB, ruleC], 'field-a')).toEqual([ruleA, ruleC]);
    expect(getRulesForField([ruleA, ruleB, ruleC], 'field-b')).toEqual([ruleB]);
    expect(getRulesForField([ruleA, ruleB, ruleC], 'field-z')).toEqual([]);
  });
});
