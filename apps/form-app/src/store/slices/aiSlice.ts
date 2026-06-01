/**
 * AI Slice
 *
 * Manages AI-driven field highlighting and pending validation suggestions.
 */

import type { AISlice, SliceCreator, ValidationSuggestion } from '../types/store.types';

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
});
