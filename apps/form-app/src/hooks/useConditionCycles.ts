import { useMemo } from 'react';
import { ConditionalRule, FormPage, detectConditionCycles } from '@dculus/types';

/**
 * Shared cycle-detection selector — used by both ConditionsTab (per-rule circular
 * badges) and the builder rail (Logic tab warning badge) so there's a single
 * source of truth for what counts as a circular reference. See issue #167.
 */
export const useConditionCycles = (
  conditions: ConditionalRule[],
  pages: FormPage[]
): Set<string> => {
  return useMemo(() => {
    const cycles = detectConditionCycles(conditions, { pages });
    return new Set(cycles.flatMap((c) => c.ruleIds));
  }, [conditions, pages]);
};
