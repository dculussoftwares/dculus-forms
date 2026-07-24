import { describe, it, expect } from 'vitest';
import { evaluateCondition } from '../conditionEvaluator.js';
import type { ConditionRule } from '../types.js';

describe('evaluateCondition', () => {
  describe('empty / combinator basics', () => {
    it('returns true for an empty rules array regardless of combinator', () => {
      expect(evaluateCondition([], 'AND', { a: '1' })).toBe(true);
      expect(evaluateCondition([], 'OR', { a: '1' })).toBe(true);
    });

    it('AND requires every rule to pass', () => {
      const rules: ConditionRule[] = [
        { fieldId: 'age', operator: 'GREATER_THAN', value: '18' },
        { fieldId: 'name', operator: 'EQUALS', value: 'Jane' },
      ];
      expect(evaluateCondition(rules, 'AND', { age: '25', name: 'Jane' })).toBe(true);
      expect(evaluateCondition(rules, 'AND', { age: '10', name: 'Jane' })).toBe(false);
    });

    it('OR requires at least one rule to pass', () => {
      const rules: ConditionRule[] = [
        { fieldId: 'age', operator: 'GREATER_THAN', value: '18' },
        { fieldId: 'name', operator: 'EQUALS', value: 'Jane' },
      ];
      expect(evaluateCondition(rules, 'OR', { age: '10', name: 'Jane' })).toBe(true);
      expect(evaluateCondition(rules, 'OR', { age: '10', name: 'John' })).toBe(false);
    });
  });

  describe('IS_EMPTY / IS_NOT_EMPTY', () => {
    it('IS_EMPTY matches null, undefined, empty string, empty array', () => {
      const rule: ConditionRule = { fieldId: 'f', operator: 'IS_EMPTY' };
      expect(evaluateCondition([rule], 'AND', { f: null })).toBe(true);
      expect(evaluateCondition([rule], 'AND', {})).toBe(true);
      expect(evaluateCondition([rule], 'AND', { f: '' })).toBe(true);
      expect(evaluateCondition([rule], 'AND', { f: [] })).toBe(true);
      expect(evaluateCondition([rule], 'AND', { f: 'x' })).toBe(false);
    });

    it('IS_NOT_EMPTY is the inverse', () => {
      const rule: ConditionRule = { fieldId: 'f', operator: 'IS_NOT_EMPTY' };
      expect(evaluateCondition([rule], 'AND', { f: 'x' })).toBe(true);
      expect(evaluateCondition([rule], 'AND', { f: null })).toBe(false);
    });
  });

  describe('EQUALS / NOT_EQUALS', () => {
    it('EQUALS is case-insensitive string equality', () => {
      const rule: ConditionRule = { fieldId: 'f', operator: 'EQUALS', value: 'Hello' };
      expect(evaluateCondition([rule], 'AND', { f: 'hello' })).toBe(true);
      expect(evaluateCondition([rule], 'AND', { f: 'world' })).toBe(false);
    });

    it('EQUALS with array field + values does an order-independent exact match', () => {
      const rule: ConditionRule = { fieldId: 'f', operator: 'EQUALS', values: ['b', 'a'] };
      expect(evaluateCondition([rule], 'AND', { f: ['a', 'b'] })).toBe(true);
      expect(evaluateCondition([rule], 'AND', { f: ['a', 'b', 'c'] })).toBe(false);
    });

    it('EQUALS returns false when no value/values provided', () => {
      const rule: ConditionRule = { fieldId: 'f', operator: 'EQUALS' };
      expect(evaluateCondition([rule], 'AND', { f: 'anything' })).toBe(false);
    });

    it('NOT_EQUALS treats missing/empty field values as "not equal" (true)', () => {
      const rule: ConditionRule = { fieldId: 'f', operator: 'NOT_EQUALS', value: 'x' };
      expect(evaluateCondition([rule], 'AND', {})).toBe(true);
      expect(evaluateCondition([rule], 'AND', { f: 'x' })).toBe(false);
      expect(evaluateCondition([rule], 'AND', { f: 'y' })).toBe(true);
    });
  });

  describe('CONTAINS / NOT_CONTAINS', () => {
    it('CONTAINS matches substrings case-insensitively', () => {
      const rule: ConditionRule = { fieldId: 'f', operator: 'CONTAINS', value: 'lo w' };
      expect(evaluateCondition([rule], 'AND', { f: 'Hello World' })).toBe(true);
      expect(evaluateCondition([rule], 'AND', { f: 'nope' })).toBe(false);
    });

    it('CONTAINS on array fields requires an exact element match', () => {
      const rule: ConditionRule = { fieldId: 'f', operator: 'CONTAINS', value: 'js' };
      expect(evaluateCondition([rule], 'AND', { f: ['js', 'ts'] })).toBe(true);
      expect(evaluateCondition([rule], 'AND', { f: ['java'] })).toBe(false);
    });

    it('CONTAINS with empty search value never matches', () => {
      const rule: ConditionRule = { fieldId: 'f', operator: 'CONTAINS', value: '' };
      expect(evaluateCondition([rule], 'AND', { f: 'anything' })).toBe(false);
    });

    it('NOT_CONTAINS is the inverse, and empty search value always passes', () => {
      const rule: ConditionRule = { fieldId: 'f', operator: 'NOT_CONTAINS', value: 'x' };
      expect(evaluateCondition([rule], 'AND', { f: 'yz' })).toBe(true);
      expect(evaluateCondition([rule], 'AND', { f: 'ax' })).toBe(false);
      expect(evaluateCondition([{ fieldId: 'f', operator: 'NOT_CONTAINS', value: '' }], 'AND', { f: 'anything' })).toBe(true);
    });
  });

  describe('STARTS_WITH / ENDS_WITH', () => {
    it('STARTS_WITH / ENDS_WITH are case-insensitive', () => {
      expect(
        evaluateCondition([{ fieldId: 'f', operator: 'STARTS_WITH', value: 'HEL' }], 'AND', { f: 'hello' })
      ).toBe(true);
      expect(
        evaluateCondition([{ fieldId: 'f', operator: 'ENDS_WITH', value: 'LO' }], 'AND', { f: 'hello' })
      ).toBe(true);
      expect(
        evaluateCondition([{ fieldId: 'f', operator: 'STARTS_WITH', value: 'x' }], 'AND', { f: 'hello' })
      ).toBe(false);
    });

    it('STARTS_WITH / ENDS_WITH are false when the field value is empty', () => {
      expect(
        evaluateCondition([{ fieldId: 'f', operator: 'STARTS_WITH', value: '' }], 'AND', {})
      ).toBe(false);
    });
  });

  describe('numeric comparisons', () => {
    const rules = (operator: string, value: string): ConditionRule[] => [
      { fieldId: 'age', operator, value },
    ];

    it('GREATER_THAN / GREATER_THAN_OR_EQUAL', () => {
      expect(evaluateCondition(rules('GREATER_THAN', '18'), 'AND', { age: '19' })).toBe(true);
      expect(evaluateCondition(rules('GREATER_THAN', '18'), 'AND', { age: '18' })).toBe(false);
      expect(evaluateCondition(rules('GREATER_THAN_OR_EQUAL', '18'), 'AND', { age: '18' })).toBe(true);
    });

    it('LESS_THAN / LESS_THAN_OR_EQUAL', () => {
      expect(evaluateCondition(rules('LESS_THAN', '18'), 'AND', { age: '10' })).toBe(true);
      expect(evaluateCondition(rules('LESS_THAN', '18'), 'AND', { age: '18' })).toBe(false);
      expect(evaluateCondition(rules('LESS_THAN_OR_EQUAL', '18'), 'AND', { age: '18' })).toBe(true);
    });

    it('numeric operators return false for non-numeric field values', () => {
      expect(evaluateCondition(rules('GREATER_THAN', '18'), 'AND', { age: 'not-a-number' })).toBe(false);
    });

    it('BETWEEN uses numberRange with optional min/max', () => {
      const rule: ConditionRule = { fieldId: 'age', operator: 'BETWEEN', numberRange: { min: 18, max: 30 } };
      expect(evaluateCondition([rule], 'AND', { age: 25 })).toBe(true);
      expect(evaluateCondition([rule], 'AND', { age: 35 })).toBe(false);
      expect(evaluateCondition([{ fieldId: 'age', operator: 'BETWEEN' }], 'AND', { age: 25 })).toBe(false);
    });
  });

  describe('IN / NOT_IN / CONTAINS_ALL', () => {
    it('IN matches select/radio string fields', () => {
      const rule: ConditionRule = { fieldId: 'f', operator: 'IN', values: ['a', 'b'] };
      expect(evaluateCondition([rule], 'AND', { f: 'b' })).toBe(true);
      expect(evaluateCondition([rule], 'AND', { f: 'c' })).toBe(false);
    });

    it('IN matches checkbox array fields (any overlap)', () => {
      const rule: ConditionRule = { fieldId: 'f', operator: 'IN', values: ['a', 'b'] };
      expect(evaluateCondition([rule], 'AND', { f: ['x', 'b'] })).toBe(true);
    });

    it('NOT_IN is the inverse', () => {
      const rule: ConditionRule = { fieldId: 'f', operator: 'NOT_IN', values: ['a', 'b'] };
      expect(evaluateCondition([rule], 'AND', { f: 'c' })).toBe(true);
      expect(evaluateCondition([rule], 'AND', { f: 'a' })).toBe(false);
    });

    it('CONTAINS_ALL requires every value present in an array field', () => {
      const rule: ConditionRule = { fieldId: 'f', operator: 'CONTAINS_ALL', values: ['js', 'ts'] };
      expect(evaluateCondition([rule], 'AND', { f: ['js', 'ts', 'react'] })).toBe(true);
      expect(evaluateCondition([rule], 'AND', { f: ['js'] })).toBe(false);
      expect(evaluateCondition([rule], 'AND', { f: 'js' })).toBe(false);
    });
  });

  describe('date operators', () => {
    it('DATE_EQUALS / DATE_BEFORE / DATE_AFTER', () => {
      const iso = new Date('2024-06-01T00:00:00Z').toISOString();
      expect(
        evaluateCondition([{ fieldId: 'd', operator: 'DATE_EQUALS', value: iso }], 'AND', { d: iso })
      ).toBe(true);
      expect(
        evaluateCondition(
          [{ fieldId: 'd', operator: 'DATE_BEFORE', value: new Date('2024-06-02').toISOString() }],
          'AND',
          { d: iso }
        )
      ).toBe(true);
      expect(
        evaluateCondition(
          [{ fieldId: 'd', operator: 'DATE_AFTER', value: new Date('2024-05-01').toISOString() }],
          'AND',
          { d: iso }
        )
      ).toBe(true);
    });

    it('DATE_EQUALS returns false for an unparseable field value', () => {
      const rule: ConditionRule = { fieldId: 'd', operator: 'DATE_EQUALS', value: new Date().toISOString() };
      expect(evaluateCondition([rule], 'AND', { d: 'not-a-date' })).toBe(false);
    });

    it('DATE_BETWEEN uses dateRange with optional from/to', () => {
      const rule: ConditionRule = {
        fieldId: 'd',
        operator: 'DATE_BETWEEN',
        dateRange: { from: '2024-01-01', to: '2024-12-31' },
      };
      expect(evaluateCondition([rule], 'AND', { d: '2024-06-01' })).toBe(true);
      expect(evaluateCondition([rule], 'AND', { d: '2025-01-01' })).toBe(false);
      expect(evaluateCondition([{ fieldId: 'd', operator: 'DATE_BETWEEN' }], 'AND', { d: '2024-06-01' })).toBe(false);
    });

    it('DATE_TODAY matches only the current day', () => {
      const rule: ConditionRule = { fieldId: 'd', operator: 'DATE_TODAY' };
      expect(evaluateCondition([rule], 'AND', { d: new Date().toISOString() })).toBe(true);
      expect(evaluateCondition([rule], 'AND', { d: '2020-01-01' })).toBe(false);
    });

    it('DATE_LAST_N_DAYS matches recent dates and rejects negative N', () => {
      const recent = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
      expect(
        evaluateCondition([{ fieldId: 'd', operator: 'DATE_LAST_N_DAYS', value: '7' }], 'AND', { d: recent })
      ).toBe(true);
      expect(
        evaluateCondition([{ fieldId: 'd', operator: 'DATE_LAST_N_DAYS', value: '-5' }], 'AND', { d: recent })
      ).toBe(false);
    });
  });

  describe('null / undefined field access', () => {
    it('handles a rule whose fieldId is absent from responseData', () => {
      const rule: ConditionRule = { fieldId: 'missing', operator: 'EQUALS', value: 'x' };
      expect(evaluateCondition([rule], 'AND', { other: 'y' })).toBe(false);
    });

    it('unknown operator names fail closed (false)', () => {
      const rule = { fieldId: 'f', operator: 'NOT_A_REAL_OPERATOR' } as unknown as ConditionRule;
      expect(evaluateCondition([rule], 'AND', { f: 'x' })).toBe(false);
    });
  });
});
