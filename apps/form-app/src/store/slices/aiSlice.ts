/**
 * AI Slice
 *
 * Manages AI-driven field highlighting and pending validation suggestions.
 */

import type { AISlice, DestructiveAction, SliceCreator, ValidationSuggestion } from '../types/store.types';

export const createAISlice: SliceCreator<AISlice> = (set, get) => ({
  aiHighlightedFieldId: null,
  setAIHighlightedFieldId: (id) => set({ aiHighlightedFieldId: id }),

  pendingValidationSuggestions: [],
  setPendingValidationSuggestions: (suggestions) =>
    set({ pendingValidationSuggestions: suggestions }),

  acceptValidationSuggestion: (fieldId): ValidationSuggestion | null => {
    const pendingValidationSuggestions: ValidationSuggestion[] = get().pendingValidationSuggestions;
    const suggestion = pendingValidationSuggestions.find((s) => s.fieldId === fieldId) ?? null;
    set({
      pendingValidationSuggestions: pendingValidationSuggestions.filter(
        (s: ValidationSuggestion) => s.fieldId !== fieldId
      ),
    });
    return suggestion;
  },

  dismissValidationSuggestion: (fieldId) => {
    const pendingValidationSuggestions: ValidationSuggestion[] = get().pendingValidationSuggestions;
    set({
      pendingValidationSuggestions: pendingValidationSuggestions.filter(
        (s: ValidationSuggestion) => s.fieldId !== fieldId
      ),
    });
  },

  // ── Destructive-action confirmations ──────────────────────────────────────
  pendingDestructiveActions: [],

  addPendingDestructiveAction: (action: DestructiveAction) => {
    const existing: DestructiveAction[] = get().pendingDestructiveActions;
    // De-dupe by id so a re-streamed tool part can't enqueue the same action twice.
    if (existing.some((a: DestructiveAction) => a.id === action.id)) return;
    set({ pendingDestructiveActions: [...existing, action] });
  },

  acceptDestructiveAction: (id: string): DestructiveAction | null => {
    const pending: DestructiveAction[] = get().pendingDestructiveActions;
    const action = pending.find((a: DestructiveAction) => a.id === id) ?? null;
    set({ pendingDestructiveActions: pending.filter((a: DestructiveAction) => a.id !== id) });
    return action;
  },

  dismissDestructiveAction: (id: string) => {
    const pending: DestructiveAction[] = get().pendingDestructiveActions;
    set({ pendingDestructiveActions: pending.filter((a: DestructiveAction) => a.id !== id) });
  },
});
