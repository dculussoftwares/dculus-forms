/**
 * Conditions Slice
 *
 * Manages form-level conditional logic rules (show/hide fields, hide pages).
 * Depends on: collaborationSlice (for YJS persistence)
 *
 * Rules live in a top-level 'conditions' Y.Array on the formSchema map as
 * plain JSON entries. The rule editor saves whole rules at a time, so Y.js
 * operations are array-level (push / delete+insert at index) — concurrent
 * edits to different rules merge cleanly; concurrent edits to the same rule
 * resolve last-writer-wins, which matches the whole-rule editing model.
 */

import * as Y from 'yjs';
import { ConditionalRule } from '@dculus/types';
import { ConditionsSlice, SliceCreator } from '../types/store.types';

// Detach from caller/store references before handing to Y.js — rules are
// plain JSON by contract, so a deep clone is always safe
const cloneRule = (rule: ConditionalRule): ConditionalRule =>
  JSON.parse(JSON.stringify(rule));

export const createConditionsSlice: SliceCreator<ConditionsSlice> = (set, get) => {
  /**
   * Run a mutation against the 'conditions' Y.Array (created on first write).
   * Returns false without touching anything when collaboration isn't ready —
   * callers must not update local state then, or the next Y.js sync silently
   * discards the "saved" change.
   */
  const withConditionsArray = (mutate: (arr: Y.Array<unknown>) => void): boolean => {
    const { _getYDoc, _isYJSReady } = get() as any;
    const ydoc: Y.Doc | null = _getYDoc();
    if (!ydoc || !_isYJSReady()) return false;

    const formSchemaMap = ydoc.getMap('formSchema');
    let conditionsArray = formSchemaMap.get('conditions');
    if (!(conditionsArray instanceof Y.Array)) {
      conditionsArray = new Y.Array();
      formSchemaMap.set('conditions', conditionsArray);
    }
    ydoc.transact(() => mutate(conditionsArray as Y.Array<unknown>));
    return true;
  };

  const indexOfRule = (arr: Y.Array<unknown>, ruleId: string): number =>
    arr.toArray().findIndex((entry: any) => entry?.id === ruleId);

  return {
    // Initial state
    conditions: [],

    addCondition: (rule: ConditionalRule): boolean => {
      const written = withConditionsArray((arr) => {
        if (indexOfRule(arr, rule.id) >= 0) return; // already synced from elsewhere
        arr.push([cloneRule(rule)]);
      });
      if (!written) return false;
      const current = get().conditions;
      set({
        conditions: current.some((existing: ConditionalRule) => existing.id === rule.id)
          ? current
          : [...current, rule],
      });
      return true;
    },

    updateCondition: (ruleId: string, rule: ConditionalRule): boolean => {
      let found = false;
      const written = withConditionsArray((arr) => {
        const index = indexOfRule(arr, ruleId);
        if (index < 0) return;
        found = true;
        arr.delete(index, 1);
        arr.insert(index, [cloneRule(rule)]);
      });
      if (!written || !found) return false;
      set({
        conditions: get().conditions.map((existing: ConditionalRule) =>
          existing.id === ruleId ? rule : existing
        ),
      });
      return true;
    },

    removeCondition: (ruleId: string): boolean => {
      const written = withConditionsArray((arr) => {
        const index = indexOfRule(arr, ruleId);
        if (index >= 0) arr.delete(index, 1);
      });
      if (!written) return false;
      set({
        conditions: get().conditions.filter(
          (existing: ConditionalRule) => existing.id !== ruleId
        ),
      });
      return true;
    },

    setConditionEnabled: (ruleId: string, enabled: boolean): boolean => {
      const existing = get().conditions.find(
        (rule: ConditionalRule) => rule.id === ruleId
      );
      if (!existing) return false;
      return get().updateCondition(ruleId, { ...existing, enabled });
    },
  };
};
