import type { ConditionCombinator, ConditionRule } from './types.js';
import { evaluateFilterOperator } from '../responseFilterService.js';

/**
 * Evaluates a condition node's rules against a flat responseData map, reusing the exact
 * same 22-operator semantics as the Responses filter (services/responseFilterService.ts)
 * via the shared evaluateFilterOperator function — so the two can never drift apart.
 *
 * An empty rules array evaluates to true regardless of combinator, mirroring
 * applyResponseFilters' "no filters means nothing to exclude" behavior. graphValidator
 * rejects empty rules on save/activate, so this is a defensive default, not a relied-upon path.
 */
export function evaluateCondition(
  rules: ConditionRule[],
  combinator: ConditionCombinator,
  responseData: Record<string, any>
): boolean {
  if (!rules || rules.length === 0) return true;

  const evaluateRule = (rule: ConditionRule): boolean =>
    evaluateFilterOperator(rule.operator, responseData?.[rule.fieldId], rule);

  return combinator === 'OR' ? rules.some(evaluateRule) : rules.every(evaluateRule);
}
