import { ConditionalRule, FieldType, FormPage } from '@dculus/types';
import { cleanupRuleReferences } from '../useLogicHealth';

const page = (id: string, fieldIds: string[]): FormPage =>
  ({
    id,
    title: id,
    order: 0,
    fields: fieldIds.map((fieldId) => ({ id: fieldId, type: FieldType.TEXT_INPUT_FIELD })),
  }) as unknown as FormPage;

const rule = (actions: ConditionalRule['actions']): ConditionalRule => ({
  id: 'r1',
  enabled: true,
  combinator: 'all',
  terms: [{ fieldId: 'f1', operator: 'equals', value: 'x' }],
  actions,
});

describe('cleanupRuleReferences', () => {
  const pages = [page('p1', ['f1', 'f2'])];

  it('keeps action shapes from newer clients that carry no pageId or fieldIds', () => {
    const unknown = { type: 'someFutureAction', payload: 1 } as unknown as ConditionalRule['actions'][number];
    const { rule: cleaned } = cleanupRuleReferences(
      rule([{ type: 'showField', fieldIds: ['f2'] }, unknown]),
      pages
    );
    expect(cleaned.actions).toContainEqual(unknown);
  });

  it('removes a page action whose page was deleted', () => {
    const { rule: cleaned, wouldBeEmpty } = cleanupRuleReferences(
      rule([{ type: 'hidePage', pageId: 'gone' }]),
      pages
    );
    expect(cleaned.actions).toEqual([]);
    expect(wouldBeEmpty).toBe(true);
  });

  it('strips deleted field ids but keeps the live ones', () => {
    const { rule: cleaned } = cleanupRuleReferences(
      rule([{ type: 'showField', fieldIds: ['f2', 'gone'] }]),
      pages
    );
    expect(cleaned.actions).toEqual([{ type: 'showField', fieldIds: ['f2'] }]);
  });
});
