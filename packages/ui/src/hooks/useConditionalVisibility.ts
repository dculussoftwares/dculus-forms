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
  /** Conditional required/unrequired overrides (v2). true = required, false = unrequired. */
  requiredOverrides: ReadonlyMap<string, boolean>;
  /** Stable getter returning the latest required-overrides map. */
  getRequiredOverrides: () => ReadonlyMap<string, boolean>;
}

const EMPTY_SET: ReadonlySet<string> = new Set();
const EMPTY_MAP: ReadonlyMap<string, boolean> = new Map();

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

  const { hiddenFieldIds, hiddenPageIds, requiredOverrides } = useMemo(() => {
    if (!formSchema || !hasConditions) {
      return { hiddenFieldIds: EMPTY_SET, hiddenPageIds: EMPTY_SET, requiredOverrides: EMPTY_MAP };
    }
    return evaluateConditions(formSchema.conditions, responses, formSchema);
  }, [formSchema, hasConditions, responses]);

  const latestHiddenFieldIds = useRef(hiddenFieldIds);
  latestHiddenFieldIds.current = hiddenFieldIds;
  const getHiddenFieldIds = useCallback(() => latestHiddenFieldIds.current, []);

  const latestRequiredOverrides = useRef(requiredOverrides);
  latestRequiredOverrides.current = requiredOverrides;
  const getRequiredOverrides = useCallback(() => latestRequiredOverrides.current, []);

  return { hiddenFieldIds, hiddenPageIds, getHiddenFieldIds, requiredOverrides, getRequiredOverrides };
};
