/**
 * Store Type Definitions
 *
 * Centralized type definitions for all Zustand store slices.
 */

import * as Y from 'yjs';
import { HocuspocusProvider } from '@hocuspocus/provider';
import { FormField, FormPage, FormLayout, FieldType } from '@dculus/types';
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
 * Combined Store State
 *
 * All slices combined into a single store
 */
export type FormBuilderState = CollaborationSlice &
  PagesSlice &
  FieldsSlice &
  LayoutSlice &
  SelectionSlice;

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
