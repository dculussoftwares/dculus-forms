/**
 * Renders a rule as one plain-English (or Tamil) sentence.
 *
 * Two consumers, one source of truth:
 *  - the inspector's live preview, so the author can read back what they just
 *    assembled from dropdowns without having to mentally execute it;
 *  - the rule card's `aria-label`, so a screen reader gets a sentence instead of
 *    the run-on produced by reading the card's chips in DOM order.
 *
 * Pure and translation-injected (takes `t`) so it is unit-testable and never
 * hardcodes a user-facing string.
 */

import { ConditionAction, ConditionalRule, ConditionTerm } from '@dculus/types';
import { LogicIndex, resolveFieldRef, resolvePageRef } from './logicVisuals';

export type TranslateFn = (
  key: string,
  options?: { values?: Record<string, string | number> }
) => string;

const termSentence = (term: ConditionTerm, index: LogicIndex, t: TranslateFn): string => {
  const reference = resolveFieldRef(index, term.fieldId, t('card.deletedField'));
  const operator = t(`operators.${term.operator}`);
  // isEmpty/isFilled carry no value; everything else reads "<field> <operator> "<value>"".
  if (term.value === undefined || term.value === null || term.value === '') {
    return `${reference.label} ${operator}`;
  }
  const value = Array.isArray(term.value) ? term.value.join(', ') : String(term.value);
  return t('sentence.termWithValue', {
    values: { field: reference.label, operator, value },
  });
};

const actionSentence = (action: ConditionAction, index: LogicIndex, t: TranslateFn): string => {
  // Sentence-grade verbs, not the UI's button labels: "show" reads correctly mid
  // sentence where "Show field(s)" does not.
  const verb = t(`sentence.verbs.${action.type}`);
  // Verb/object order is language-specific (English puts the verb first, Tamil
  // last), so the clause is assembled from a locale template rather than by
  // concatenation here.
  if ('fieldIds' in action) {
    const labels = action.fieldIds.map(
      (fieldId) => resolveFieldRef(index, fieldId, t('card.deletedField')).label
    );
    return t('sentence.actionClause', { values: { verb, targets: labels.join(', ') } });
  }
  const page = resolvePageRef(index, action.pageId, t('card.deletedPage'), (n) =>
    t('editor.page', { values: { number: n } })
  );
  return t('sentence.actionClause', { values: { verb, targets: page.label } });
};

/**
 * A term/action that has not been filled in yet contributes nothing readable —
 * describing an unset field as "deleted field" would be actively misleading in
 * the inspector's live preview, so half-built rows are omitted instead.
 */
const termIsAuthored = (term: ConditionTerm): boolean => Boolean(term.fieldId);

const actionIsAuthored = (action: ConditionAction): boolean =>
  'fieldIds' in action ? action.fieldIds.length > 0 : Boolean(action.pageId);

export const buildRuleSentence = (
  rule: ConditionalRule,
  index: LogicIndex,
  t: TranslateFn
): string => {
  const joiner = rule.combinator === 'any' ? t('sentence.or') : t('sentence.and');
  const condition = rule.terms
    .filter(termIsAuthored)
    .map((term) => termSentence(term, index, t))
    .join(` ${joiner} `);
  const effect = rule.actions
    .filter(actionIsAuthored)
    .map((action) => actionSentence(action, index, t))
    .join(t('sentence.actionJoin'));

  if (!condition) return effect;
  if (!effect) return condition;
  return t('sentence.full', { values: { condition, effect } });
};
