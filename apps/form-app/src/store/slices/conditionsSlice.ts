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
   * No-ops when collaboration isn't ready — mirroring how the other slices
   * guard their Y.js writes; local state still updates so the UI stays
   * responsive and re-syncs from Y.js on reconnect.
   */
  const withConditionsArray = (mutate: (arr: Y.Array<unknown>) => void) => {
    const { _getYDoc, _isYJSReady } = get() as any;
    const ydoc: Y.Doc | null = _getYDoc();
    if (!ydoc || !_isYJSReady()) return;

    const formSchemaMap = ydoc.getMap('formSchema');
    let conditionsArray = formSchemaMap.get('conditions');
    if (!(conditionsArray instanceof Y.Array)) {
      conditionsArray = new Y.Array();
      formSchemaMap.set('conditions', conditionsArray);
    }
    ydoc.transact(() => mutate(conditionsArray as Y.Array<unknown>));
  };

  const indexOfRule = (arr: Y.Array<unknown>, ruleId: string): number =>
    arr.toArray().findIndex((entry: any) => entry?.id === ruleId);

  return {
    // Initial state
    conditions: [],

    addCondition: (rule: ConditionalRule) => {
      set({ conditions: [...get().conditions, rule] });
      withConditionsArray((arr) => {
        if (indexOfRule(arr, rule.id) >= 0) return; // already synced from elsewhere
        arr.push([cloneRule(rule)]);
      });
    },

    updateCondition: (ruleId: string, rule: ConditionalRule) => {
      set({
        conditions: get().conditions.map((existing: ConditionalRule) =>
          existing.id === ruleId ? rule : existing
        ),
      });
      withConditionsArray((arr) => {
        const index = indexOfRule(arr, ruleId);
        if (index < 0) return;
        arr.delete(index, 1);
        arr.insert(index, [cloneRule(rule)]);
      });
    },

    removeCondition: (ruleId: string) => {
      set({
        conditions: get().conditions.filter(
          (existing: ConditionalRule) => existing.id !== ruleId
        ),
      });
      withConditionsArray((arr) => {
        const index = indexOfRule(arr, ruleId);
        if (index >= 0) arr.delete(index, 1);
      });
    },

    setConditionEnabled: (ruleId: string, enabled: boolean) => {
      const existing = get().conditions.find(
        (rule: ConditionalRule) => rule.id === ruleId
      );
      if (!existing) return;
      get().updateCondition(ruleId, { ...existing, enabled });
    },
  };
};
