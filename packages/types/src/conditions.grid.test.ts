import { describe, it, expect } from 'vitest';
import { evaluateConditions, type ConditionalRule, type FormResponsesByPage } from './conditions.js';
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
