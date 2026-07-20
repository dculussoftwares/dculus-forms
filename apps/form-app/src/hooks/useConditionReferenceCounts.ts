import { useMemo } from 'react';
import { ConditionalRule } from '@dculus/types';

export interface ConditionReferenceCounts {
  fieldRuleCounts: Map<string, number>;
  pageRuleCounts: Map<string, number>;
}

/**
 * Reverse-index selector — for each field/page, how many distinct rules
 * reference it (as a term trigger or an action target). Powers the Build tab's
 * "N rules apply here" chips that link through to Logic. See issue #168.
 */
export const useConditionReferenceCounts = (
  conditions: ConditionalRule[]
): ConditionReferenceCounts => {
  return useMemo(() => {
    const fieldRuleIds = new Map<string, Set<string>>();
    const pageRuleIds = new Map<string, Set<string>>();

    const addFieldRef = (fieldId: string, ruleId: string) => {
      const set = fieldRuleIds.get(fieldId) ?? new Set<string>();
      set.add(ruleId);
      fieldRuleIds.set(fieldId, set);
    };
    const addPageRef = (pageId: string, ruleId: string) => {
      const set = pageRuleIds.get(pageId) ?? new Set<string>();
      set.add(ruleId);
      pageRuleIds.set(pageId, set);
    };

    for (const rule of conditions) {
      for (const term of rule.terms) {
        addFieldRef(term.fieldId, rule.id);
      }
      for (const action of rule.actions) {
        if ('fieldIds' in action) {
          for (const fieldId of action.fieldIds) addFieldRef(fieldId, rule.id);
        } else {
          addPageRef(action.pageId, rule.id);
        }
      }
    }

    const fieldRuleCounts = new Map<string, number>();
    fieldRuleIds.forEach((set, fieldId) => fieldRuleCounts.set(fieldId, set.size));
    const pageRuleCounts = new Map<string, number>();
    pageRuleIds.forEach((set, pageId) => pageRuleCounts.set(pageId, set.size));

    return { fieldRuleCounts, pageRuleCounts };
  }, [conditions]);
};
