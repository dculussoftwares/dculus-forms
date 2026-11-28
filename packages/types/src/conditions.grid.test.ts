import { describe, it, expect } from 'vitest';
import {
  detectConditionCycles,
  evaluateConditions,
  stripHiddenResponses,
  type ConditionalRule,
  type FormResponsesByPage,
} from './conditions.js';
import { FillableFormFieldValidation, GridField, TextInputField, type FormPage } from './index.js';

const v = new FillableFormFieldValidation(false);
const text = (id: string, extra: object = {}) => Object.assign(new TextInputField(id, id, '', '', '', '', v), extra);

// p1 holds the trigger; p2 holds only a grid and its two children
const pages: FormPage[] = [
  { id: 'p1', title: 'P1', order: 0, fields: [text('trigger')] },
  {
    id: 'p2',
    title: 'P2',
    order: 1,
    fields: [new GridField('g1'), text('a', { gridId: 'g1', gridColumn: 0 }), text('b', { gridId: 'g1', gridColumn: 1 })],
  },
];

const hide = (fieldIds: string[]): ConditionalRule[] => [
  {
    id: 'r1',
    enabled: true,
    combinator: 'all',
    terms: [{ fieldId: 'trigger', operator: 'equals', value: 'hide' }],
    actions: [{ type: 'hideField', fieldIds }],
  },
];

const responses: FormResponsesByPage = { p1: { trigger: 'hide' }, p2: {} };

describe('evaluateConditions with a grid (§11 v1)', () => {
  it('auto-hides a page once every real field inside its grid is hidden', () => {
    const result = evaluateConditions(hide(['a', 'b']), responses, { pages });
    expect(result.hiddenFieldIds).toEqual(new Set(['a', 'b']));
    expect(result.hiddenPageIds.has('p2')).toBe(true);
  });

  it('keeps the page while any child is still visible', () => {
    expect(evaluateConditions(hide(['a']), responses, { pages }).hiddenPageIds.has('p2')).toBe(false);
  });

  it('never auto-hides a page whose only field is an empty grid', () => {
    const gridOnly: FormPage[] = [pages[0], { id: 'p2', title: 'P2', order: 1, fields: [new GridField('g1')] }];
    expect(evaluateConditions(hide(['trigger']), responses, { pages: gridOnly }).hiddenPageIds.has('p2')).toBe(false);
  });
});

describe('evaluateConditions targeting a grid (§11 v1.1)', () => {
  it('hideField on a grid hides every live child, not the grid id, and auto-hides the page', () => {
    const result = evaluateConditions(hide(['g1']), responses, { pages });
    expect(result.hiddenFieldIds).toEqual(new Set(['a', 'b']));
    expect(result.hiddenPageIds.has('p2')).toBe(true);
  });

  it('showField on a grid starts its children hidden until the rule matches', () => {
    const show: ConditionalRule[] = [
      {
        id: 'r1',
        enabled: true,
        combinator: 'all',
        terms: [{ fieldId: 'trigger', operator: 'equals', value: 'show' }],
        actions: [{ type: 'showField', fieldIds: ['g1'] }],
      },
    ];
    expect(evaluateConditions(show, { p1: { trigger: 'no' }, p2: {} }, { pages }).hiddenFieldIds).toEqual(
      new Set(['a', 'b'])
    );
    expect(evaluateConditions(show, { p1: { trigger: 'show' }, p2: {} }, { pages }).hiddenFieldIds.size).toBe(0);
  });

  it('strips answers of children hidden through their grid', () => {
    const result = evaluateConditions(hide(['g1']), { p1: { trigger: 'hide' }, p2: { a: 'x', b: 'y' } }, { pages });
    expect(stripHiddenResponses({ p1: { trigger: 'hide' }, p2: { a: 'x', b: 'y' } }, result).p2).toBeUndefined();
  });

  it('keeps list order so a later child rule still wins over an earlier grid rule', () => {
    const rules: ConditionalRule[] = [
      ...hide(['g1']),
      {
        id: 'r2',
        enabled: true,
        combinator: 'all',
        terms: [{ fieldId: 'trigger', operator: 'equals', value: 'hide' }],
        actions: [{ type: 'showField', fieldIds: ['a'] }],
      },
    ];
    expect(evaluateConditions(rules, responses, { pages }).hiddenFieldIds).toEqual(new Set(['b']));
  });

  it('ignores a deleted grid and an empty grid rather than hiding unrelated fields', () => {
    const deleted = pages.map((page) =>
      page.id === 'p2' ? { ...page, fields: [Object.assign(new GridField('g1'), { deleted: true }), ...page.fields.slice(1)] } : page
    );
    expect(evaluateConditions(hide(['g1']), responses, { pages: deleted }).hiddenFieldIds.has('a')).toBe(false);
    const empty: FormPage[] = [pages[0], { id: 'p2', title: 'P2', order: 1, fields: [new GridField('g1')] }];
    expect(evaluateConditions(hide(['g1']), responses, { pages: empty }).hiddenPageIds.has('p2')).toBe(false);
  });

  it('does not expand requireField on a grid', () => {
    const rules: ConditionalRule[] = [
      {
        id: 'r1',
        enabled: true,
        combinator: 'all',
        terms: [{ fieldId: 'trigger', operator: 'equals', value: 'hide' }],
        actions: [{ type: 'requireField', fieldIds: ['g1'] }],
      },
    ];
    expect(evaluateConditions(rules, responses, { pages }).requiredOverrides.has('a')).toBe(false);
  });
});

describe('detectConditionCycles with a grid target', () => {
  it('sees a rule that hides a grid as affecting the trigger fields inside it', () => {
    const cyclePages: FormPage[] = [
      {
        id: 'p1',
        title: 'P1',
        order: 0,
        fields: [new GridField('g1'), text('a', { gridId: 'g1', gridColumn: 0 }), text('b', { gridId: 'g1', gridColumn: 1 })],
      },
    ];
    const rules: ConditionalRule[] = [
      {
        id: 'self',
        enabled: true,
        combinator: 'all',
        terms: [{ fieldId: 'a', operator: 'isFilled' }],
        actions: [{ type: 'hideField', fieldIds: ['g1'] }],
      },
    ];
    expect(detectConditionCycles(rules, { pages: cyclePages })).toEqual([{ ruleIds: ['self'] }]);
  });
});
