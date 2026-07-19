/**
 * Store Type Definitions
 *
 * Centralized type definitions for all Zustand store slices.
 */

import * as Y from 'yjs';
import { HocuspocusProvider } from '@hocuspocus/provider';
import { FormField, FormPage, FormLayout, FieldType, ConditionalRule } from '@dculus/types';
import { FieldData } from '../collaboration/CollaborationManager';

/**
 * Collaboration Slice
 *
 * Manages YJS document lifecycle and WebSocket connection state
 */
export interface CollaborationSlice {
  // Connection state
  isConnected: boolean;
  isLoading: boolean;
  isCollaborationFailed: boolean;
  formId: string | null;

  // YJS internals
  ydoc: Y.Doc | null;
  provider: HocuspocusProvider | null;
  observerCleanups: Array<() => void>;

  // Actions
  initializeCollaboration: (formId: string) => Promise<void>;
  disconnectCollaboration: () => void;
  setConnectionState: (isConnected: boolean) => void;
  setLoadingState: (isLoading: boolean) => void;

  // Internal helpers (exposed for other slices)
  _getYDoc: () => Y.Doc | null;
  _isYJSReady: () => boolean;
}

/**
 * Pages Slice
 *
 * Manages form pages (add, remove, reorder, duplicate, update)
 */
export interface PagesSlice {
  // State
  pages: FormPage[];

  // Actions
  setPages: (pages: FormPage[]) => void;
  addEmptyPage: () => string | undefined;
  addPageAtPosition: (title: string, insertAfterPageId: string | null, pageId?: string) => string | undefined;
  removePage: (pageId: string) => void;
  duplicatePage: (pageId: string) => void;
  updatePageTitle: (pageId: string, title: string) => void;
  reorderPages: (oldIndex: number, newIndex: number) => void;

  // Internal helpers
  _findPageById: (pageId: string) => FormPage | null;
  _getPageIndex: (pageId: string) => number;
}

/**
 * Fields Slice
 *
 * Manages form fields within pages (CRUD, reorder, move between pages)
 */
export interface FieldsSlice {
  // No direct state (fields are nested in pages)

  // Actions
  addField: (pageId: string, fieldType: FieldType, fieldData?: Partial<FieldData>) => void;
  addFieldAtIndex: (
    pageId: string,
    fieldType: FieldType,
    fieldData: Partial<FieldData>,
    insertIndex: number
  ) => void;
  updateField: (pageId: string, fieldId: string, updates: Partial<FieldData>) => void;
  removeField: (pageId: string, fieldId: string) => void;
  reorderFields: (pageId: string, oldIndex: number, newIndex: number) => void;
  duplicateField: (pageId: string, fieldId: string) => void;
  moveFieldBetweenPages: (
    sourcePageId: string,
    targetPageId: string,
    fieldId: string,
    insertIndex?: number
  ) => void;
  copyFieldToPage: (sourcePageId: string, targetPageId: string, fieldId: string) => void;
  /**
   * Convert a field to a different type by deleting it and creating a new field of the new type
   * at the same position with a NEW id. Label/required/placeholder/hint carry over where
   * compatible. The new id keeps response analytics/exports consistent (old responses for the
   * old id remain as immutable history and do not carry over).
   */
  convertFieldType: (pageId: string, fieldId: string, newType: FieldType) => void;

  // Internal helpers
  _findFieldInPages: (fieldId: string) => { page: FormPage; field: FormField } | null;
}

/**
 * Layout Slice
 *
 * Manages form layout and theming configuration
 */
export interface LayoutSlice {
  // State
  layout: FormLayout;
  isShuffleEnabled: boolean;

  // Actions
  updateLayout: (layoutUpdates: Partial<FormLayout>) => void;

  // Internal helpers
  _getDefaultLayout: () => FormLayout;
}

/**
 * Conditions Slice
 *
 * Manages the form-level conditional logic rules (show/hide fields, hide
 * pages). Rules are plain JSON entries in a top-level 'conditions' Y.Array,
 * edited whole-rule-at-a-time (JotForm-style editor semantics).
 */
export interface ConditionsSlice {
  // State
  conditions: ConditionalRule[];

  // Actions
  addCondition: (rule: ConditionalRule) => void;
  updateCondition: (ruleId: string, rule: ConditionalRule) => void;
  removeCondition: (ruleId: string) => void;
  setConditionEnabled: (ruleId: string, enabled: boolean) => void;
}

/**
 * Selection Slice
 *
 * Manages current page and field selection state
 */
export interface SelectionSlice {
  // State
  selectedPageId: string | null;
  selectedFieldId: string | null;

  // Actions
  setSelectedPage: (pageId: string | null) => void;
  setSelectedField: (fieldId: string | null) => void;

  // Computed selectors
  getSelectedField: () => FormField | null;
  getSelectedPage: () => FormPage | null;
}

/**
 * AI Slice
 *
 * Manages AI-driven field highlighting and pending validation suggestions
 */
export interface ValidationSuggestion {
  fieldId: string;
  fieldLabel: string;
  fieldType: string;
  validation?: {
    minLength?: number | null;
    maxLength?: number | null;
    minSelections?: number | null;
    maxSelections?: number | null;
  };
  min?: number | null;
  max?: number | null;
  required?: boolean;
}

/**
 * A destructive AI action awaiting explicit user confirmation. Mirrors the validation-suggestion
 * pattern: the AI proposes; the store holds it pending; the UI shows a warning + Accept/Dismiss;
 * only Accept applies the real mutation. Each carries a stable `id` so Accept/Dismiss target one.
 */
export type DestructiveAction =
  | {
      id: string;
      kind: 'delete-fields';
      fields: Array<{ fieldId: string; label: string; responseCount: number }>;
    }
  | {
      id: string;
      kind: 'delete-page';
      pageId: string;
      pageTitle: string;
      fieldCount: number;
      responseCount: number;
    }
  | {
      id: string;
      kind: 'convert';
      fieldId: string;
      label: string;
      currentType: string;
      newFieldType: string;
      responseCount: number;
    };

export interface ConditionSuggestion {
  id: string;
  rule: ConditionalRule;
  rationale: string;
}

export interface AISlice {
  aiHighlightedFieldId: string | null;
  setAIHighlightedFieldId: (id: string | null) => void;
  pendingValidationSuggestions: ValidationSuggestion[];
  setPendingValidationSuggestions: (suggestions: ValidationSuggestion[]) => void;
  acceptValidationSuggestion: (fieldId: string) => ValidationSuggestion | null;
  dismissValidationSuggestion: (fieldId: string) => void;

  pendingConditionSuggestions: ConditionSuggestion[];
  addPendingConditionSuggestion: (suggestion: ConditionSuggestion) => void;
  acceptConditionSuggestion: (id: string) => ConditionSuggestion | null;
  dismissConditionSuggestion: (id: string) => void;

  // Destructive-action confirmations (deletes + field-type conversion)
  pendingDestructiveActions: DestructiveAction[];
  addPendingDestructiveAction: (action: DestructiveAction) => void;
  acceptDestructiveAction: (id: string) => DestructiveAction | null;
  dismissDestructiveAction: (id: string) => void;
}

/**
 * Reset Slice
 *
 * Provides a cross-slice reset action for cleaning up transient builder state
 * when the user navigates away from the form builder.
 */
export interface ResetSlice {
  resetBuilder: () => void;
}

/**
 * Combined Store State
 *
 * All slices combined into a single store
 */
export type FormBuilderState = CollaborationSlice &
  PagesSlice &
  FieldsSlice &
  LayoutSlice &
  ConditionsSlice &
  SelectionSlice &
  AISlice &
  ResetSlice;

/**
 * Slice Creator Function Type
 *
 * Type for functions that create store slices.
 * Uses `any` for set/get to avoid TypeScript conflicts with Zustand's internal types.
 * This is the recommended pattern for Zustand slice creators.
 */
export type SliceCreator<T> = (
  set: any,
  get: any
) => T;
