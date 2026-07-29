import { ConditionalRule } from '@dculus/types';

/**
 * True when `rule` references `fieldId` — either as a term trigger or as an
 * action target (fieldIds actions only; page-jump actions don't reference fields).
 * Single source of truth for "does this rule touch this field", shared by the
 * Logic tab's `?ruleField=` filter, the field panel's logic-summary row, and
 * the rail's per-chip logic badge.
 */
export const ruleReferencesField = (rule: ConditionalRule, fieldId: string): boolean =>
  rule.terms.some((term) => term.fieldId === fieldId) ||
  rule.actions.some((action) => 'fieldIds' in action && action.fieldIds.includes(fieldId));

/**
 * All rules in `conditions` that reference `fieldId`, preserving rule order.
 */
export const getRulesForField = (
  conditions: ConditionalRule[],
  fieldId: string
): ConditionalRule[] => conditions.filter((rule) => ruleReferencesField(rule, fieldId));
