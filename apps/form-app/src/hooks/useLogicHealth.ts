import { useMemo } from 'react';
import { ConditionalRule, FormPage, detectConditionCycles } from '@dculus/types';
import {
  checkBackwardReference,
  checkRuleReferences,
} from '../components/form-builder/conditions/conditionFieldConfig';

/**
 * Whole-form logic health, computed from the same primitives the evaluator and
 * the rule cards already use — this hook composes, it does not re-derive.
 *
 * Before this existed, the builder surfaced problems only as per-card badges: you
 * had to scroll every rule to discover there was an issue at all, and the badge
 * named a category ("Broken reference") without naming which field broke it.
 */

export type LogicIssueKind =
  | 'brokenReference'
  | 'circular'
  | 'backwardReference'
  | 'unreachableField';

export interface LogicIssue {
  kind: LogicIssueKind;
  /** Rules implicated — clicking an issue selects the first of these. */
  ruleIds: string[];
  /**
   * Human-readable specifics resolved by the caller into a message: the missing
   * field/page ids, stale option values, or the stranded field id.
   */
  detail: {
    missingFieldIds?: string[];
    missingPageIds?: string[];
    staleOptionValues?: Array<{ fieldId: string; value: string }>;
    fieldId?: string;
  };
}

export interface LogicHealth {
  issues: LogicIssue[];
  /** Rule ids with at least one issue — drives the rail's "Issues" filter. */
  ruleIdsWithIssues: Set<string>;
  circularRuleIds: Set<string>;
  disabledCount: number;
  enabledCount: number;
}

/**
 * A rule can never match when every one of its terms points at a field that no
 * longer exists — `termMatches` in the evaluator returns false for an unknown
 * fieldId, and `all`/`any` over an all-unknown term set is false either way.
 */
const ruleCanNeverMatch = (rule: ConditionalRule, liveFieldIds: Set<string>): boolean =>
  rule.terms.length > 0 && rule.terms.every((term) => !liveFieldIds.has(term.fieldId));

export interface RuleCleanup {
  /** The rule with every dangling term and action target stripped out. */
  rule: ConditionalRule;
  /**
   * True when stripping leaves nothing evaluable (no terms, or no actions), so
   * the only sensible repair is deleting the rule rather than saving a husk.
   */
  wouldBeEmpty: boolean;
}

/**
 * Removes references to fields and pages that no longer exist.
 *
 * Deleting a field deliberately does NOT cascade-delete the rules that point at
 * it (collab-unsafe — see docs/conditional-logic-v1-strategy.md §8), so repair is
 * the author's job. This computes that repair so the health panel can offer it as
 * one action instead of making them hunt for the dead row in the editor.
 */
export const cleanupRuleReferences = (
  rule: ConditionalRule,
  pages: FormPage[]
): RuleCleanup => {
  const liveFieldIds = new Set<string>();
  const livePageIds = new Set<string>();
  pages.forEach((page) => {
    livePageIds.add(page.id);
    page.fields.forEach((field) => liveFieldIds.add(field.id));
  });

  const terms = rule.terms.filter((term) => liveFieldIds.has(term.fieldId));
  const actions = rule.actions
    .map((action) =>
      'fieldIds' in action
        ? { ...action, fieldIds: action.fieldIds.filter((id) => liveFieldIds.has(id)) }
        : action
    )
    .filter((action) =>
      'fieldIds' in action ? action.fieldIds.length > 0 : livePageIds.has(action.pageId)
    );

  return {
    rule: { ...rule, terms, actions },
    wouldBeEmpty: terms.length === 0 || actions.length === 0,
  };
};

export const useLogicHealth = (
  conditions: ConditionalRule[],
  pages: FormPage[]
): LogicHealth => {
  return useMemo(() => {
    const liveFieldIds = new Set<string>();
    pages.forEach((page) => page.fields.forEach((field) => liveFieldIds.add(field.id)));

    const issues: LogicIssue[] = [];

    // 1. Dangling references, per rule.
    for (const rule of conditions) {
      const references = checkRuleReferences(rule, pages);
      if (references.hasBrokenReferences) {
        issues.push({
          kind: 'brokenReference',
          ruleIds: [rule.id],
          detail: {
            missingFieldIds: [
              ...references.missingTermFieldIds,
              ...references.missingActionFieldIds,
            ],
            missingPageIds: references.missingActionPageIds,
            staleOptionValues: references.staleOptionValues,
          },
        });
      }
    }

    // 2. Cycles — reported once per strongly-connected component, not once per
    //    rule, so the panel can say "these 3 rules form a loop".
    const cycles = detectConditionCycles(conditions, { pages });
    const circularRuleIds = new Set(cycles.flatMap((cycle) => cycle.ruleIds));
    for (const cycle of cycles) {
      issues.push({ kind: 'circular', ruleIds: cycle.ruleIds, detail: {} });
    }

    // 3. Action targets an earlier page than the answer it depends on.
    for (const rule of conditions) {
      if (checkBackwardReference(rule, pages).hasBackwardReference) {
        issues.push({ kind: 'backwardReference', ruleIds: [rule.id], detail: {} });
      }
    }

    // 4. Permanently invisible fields. Being the target of ANY enabled `showField`
    //    makes a field hidden by default (evaluator, `defaultHiddenFields`). If the
    //    only enabled rules that would show it can never match — every trigger field
    //    was deleted — the field is hidden to every respondent, forever, with no
    //    badge anywhere in the builder to say so.
    const enabledRules = conditions.filter((rule) => rule.enabled);
    const defaultHidden = new Map<string, string[]>();
    for (const rule of enabledRules) {
      for (const action of rule.actions) {
        if (action.type !== 'showField') continue;
        for (const fieldId of action.fieldIds) {
          defaultHidden.set(fieldId, [...(defaultHidden.get(fieldId) ?? []), rule.id]);
        }
      }
    }
    const satisfiableRuleIds = new Set(
      enabledRules.filter((rule) => !ruleCanNeverMatch(rule, liveFieldIds)).map((rule) => rule.id)
    );
    for (const [fieldId, ruleIds] of defaultHidden) {
      if (!liveFieldIds.has(fieldId)) continue; // already covered by brokenReference
      if (ruleIds.some((ruleId) => satisfiableRuleIds.has(ruleId))) continue;
      issues.push({ kind: 'unreachableField', ruleIds, detail: { fieldId } });
    }

    const ruleIdsWithIssues = new Set(issues.flatMap((issue) => issue.ruleIds));
    const disabledCount = conditions.filter((rule) => !rule.enabled).length;

    return {
      issues,
      ruleIdsWithIssues,
      circularRuleIds,
      disabledCount,
      enabledCount: conditions.length - disabledCount,
    };
  }, [conditions, pages]);
};
