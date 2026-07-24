import type { ConditionCombinator, ConditionRule } from './types.js';

/**
 * Placeholder pending #193 (condition evaluator + graph validator), which reuses the
 * 22 filter operators from responseFilterService.ts against this same rule shape. Kept
 * as a standalone module so engine.ts's condition-node branching can be wired and tested
 * now (via mocking this function) without depending on #193 landing first.
 */
export function evaluateCondition(
  _rules: ConditionRule[],
  _combinator: ConditionCombinator,
  _responseData: Record<string, any>
): boolean {
  return false;
}
