import { describe, it, expect } from 'vitest';
import {
  detectConditionCycles,
  type ConditionalRule,
  type FormPage,
  TextInputField,
  TextFieldValidation,
} from './index.js';

const tv = new TextFieldValidation(false);

const pages: FormPage[] = [
  {
    id: 'p1',
    title: 'Page 1',
    order: 0,
    fields: [
      new TextInputField('f1', 'Field 1', '', '', '', '', tv),
      new TextInputField('f2', 'Field 2', '', '', '', '', tv),
    ],
  },
  {
    id: 'p2',
    title: 'Page 2',
    order: 1,
    fields: [
      new TextInputField('f3', 'Field 3', '', '', '', '', tv),
      new TextInputField('f4', 'Field 4', '', '', '', '', tv),
    ],
  },
];

const schema = { pages };

describe('detectConditionCycles', () => {
  it('returns empty array for empty, null, or undefined rules', () => {
    expect(detectConditionCycles(undefined, schema)).toEqual([]);
    expect(detectConditionCycles(null, schema)).toEqual([]);
    expect(detectConditionCycles([], schema)).toEqual([]);
  });

  it('detects a self-hiding rule (self-loop cycle)', () => {
    const rules: ConditionalRule[] = [
      {
        id: 'r1',
        enabled: true,
        combinator: 'all',
        terms: [{ fieldId: 'f1', operator: 'isFilled' }],
        actions: [{ type: 'hideField', fieldIds: ['f1'] }],
      },
    ];

    const cycles = detectConditionCycles(rules, schema);
    expect(cycles).toEqual([{ ruleIds: ['r1'] }]);
  });

  it('detects a mutual A <-> B rule cycle', () => {
    const rules: ConditionalRule[] = [
      {
        id: 'r1',
        enabled: true,
        combinator: 'all',
        terms: [{ fieldId: 'f1', operator: 'isFilled' }],
        actions: [{ type: 'hideField', fieldIds: ['f2'] }],
      },
      {
        id: 'r2',
        enabled: true,
        combinator: 'all',
        terms: [{ fieldId: 'f2', operator: 'isFilled' }],
        actions: [{ type: 'hideField', fieldIds: ['f1'] }],
      },
    ];

    const cycles = detectConditionCycles(rules, schema);
    expect(cycles).toEqual([{ ruleIds: ['r1', 'r2'] }]);
  });

  it('does NOT flag a linear chain without cycle (A -> B -> C)', () => {
    const rules: ConditionalRule[] = [
      {
        id: 'r1',
        enabled: true,
        combinator: 'all',
        terms: [{ fieldId: 'f1', operator: 'isFilled' }],
        actions: [{ type: 'hideField', fieldIds: ['f2'] }],
      },
      {
        id: 'r2',
        enabled: true,
        combinator: 'all',
        terms: [{ fieldId: 'f2', operator: 'isFilled' }],
        actions: [{ type: 'hideField', fieldIds: ['f3'] }],
      },
    ];

    const cycles = detectConditionCycles(rules, schema);
    expect(cycles).toEqual([]);
  });

  it('detects page-mediated cycles via hidePage', () => {
    const rules: ConditionalRule[] = [
      {
        id: 'r1',
        enabled: true,
        combinator: 'all',
        terms: [{ fieldId: 'f1', operator: 'isFilled' }],
        actions: [{ type: 'hidePage', pageId: 'p2' }],
      },
      {
        id: 'r2',
        enabled: true,
        combinator: 'all',
        terms: [{ fieldId: 'f3', operator: 'isFilled' }], // f3 is on p2
        actions: [{ type: 'hidePage', pageId: 'p1' }], // p1 has f1
      },
    ];

    const cycles = detectConditionCycles(rules, schema);
    expect(cycles).toEqual([{ ruleIds: ['r1', 'r2'] }]);
  });

  it('excludes disabled rules from cycle detection', () => {
    const rules: ConditionalRule[] = [
      {
        id: 'r1',
        enabled: false,
        combinator: 'all',
        terms: [{ fieldId: 'f1', operator: 'isFilled' }],
        actions: [{ type: 'hideField', fieldIds: ['f2'] }],
      },
      {
        id: 'r2',
        enabled: true,
        combinator: 'all',
        terms: [{ fieldId: 'f2', operator: 'isFilled' }],
        actions: [{ type: 'hideField', fieldIds: ['f1'] }],
      },
    ];

    const cycles = detectConditionCycles(rules, schema);
    expect(cycles).toEqual([]);
  });

  it('detects a 3-rule cycle (A -> B -> C -> A)', () => {
    const rules: ConditionalRule[] = [
      {
        id: 'r1',
        enabled: true,
        combinator: 'all',
        terms: [{ fieldId: 'f1', operator: 'isFilled' }],
        actions: [{ type: 'hideField', fieldIds: ['f2'] }],
      },
      {
        id: 'r2',
        enabled: true,
        combinator: 'all',
        terms: [{ fieldId: 'f2', operator: 'isFilled' }],
        actions: [{ type: 'hideField', fieldIds: ['f3'] }],
      },
      {
        id: 'r3',
        enabled: true,
        combinator: 'all',
        terms: [{ fieldId: 'f3', operator: 'isFilled' }],
        actions: [{ type: 'hideField', fieldIds: ['f1'] }],
      },
    ];

    const cycles = detectConditionCycles(rules, schema);
    expect(cycles).toEqual([{ ruleIds: ['r1', 'r2', 'r3'] }]);
  });

  it('detects multiple independent cycles', () => {
    const rules: ConditionalRule[] = [
      {
        id: 'r1',
        enabled: true,
        combinator: 'all',
        terms: [{ fieldId: 'f1', operator: 'isFilled' }],
        actions: [{ type: 'hideField', fieldIds: ['f1'] }],
      },
      {
        id: 'r2',
        enabled: true,
        combinator: 'all',
        terms: [{ fieldId: 'f3', operator: 'isFilled' }],
        actions: [{ type: 'hideField', fieldIds: ['f4'] }],
      },
      {
        id: 'r3',
        enabled: true,
        combinator: 'all',
        terms: [{ fieldId: 'f4', operator: 'isFilled' }],
        actions: [{ type: 'hideField', fieldIds: ['f3'] }],
      },
    ];

    const cycles = detectConditionCycles(rules, schema);
    expect(cycles).toEqual([{ ruleIds: ['r1'] }, { ruleIds: ['r2', 'r3'] }]);
  });
});
