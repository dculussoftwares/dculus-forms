import { useCallback, useMemo, useRef } from 'react';
import { evaluateConditions, type FormSchema } from '@dculus/types';
import { useFormResponseStore } from '../stores/useFormResponseStore';

export interface ConditionalVisibility {
  hiddenFieldIds: ReadonlySet<string>;
  hiddenPageIds: ReadonlySet<string>;
  /**
   * Stable getter returning the latest hidden-field set. Validation paths
   * (dynamic RHF resolver, validatePageData) call this at validation time so
   * they can never capture a stale set in a closure.
   */
  getHiddenFieldIds: () => ReadonlySet<string>;
}

const EMPTY_SET: ReadonlySet<string> = new Set();

/**
 * Evaluates the form's conditional rules against the live response store and
 * shares one visibility result for the whole renderer tree (strategy doc §3.1).
 * Re-runs on every response change; forms without conditions bail out to
 * stable empty sets so they pay nothing.
 */
export const useConditionalVisibility = (
  formSchema?: FormSchema
): ConditionalVisibility => {
  // Store updates are immutable, so subscribing to the responses object
  // re-renders exactly when any answer on any page changes
  const responses = useFormResponseStore((state) => state.responses);

  const hasConditions = (formSchema?.conditions?.length ?? 0) > 0;

  const { hiddenFieldIds, hiddenPageIds } = useMemo(() => {
    if (!formSchema || !hasConditions) {
      return { hiddenFieldIds: EMPTY_SET, hiddenPageIds: EMPTY_SET };
    }
    return evaluateConditions(formSchema.conditions, responses, formSchema);
  }, [formSchema, hasConditions, responses]);

  const latestHiddenFieldIds = useRef(hiddenFieldIds);
  latestHiddenFieldIds.current = hiddenFieldIds;
  const getHiddenFieldIds = useCallback(() => latestHiddenFieldIds.current, []);

  return { hiddenFieldIds, hiddenPageIds, getHiddenFieldIds };
};
