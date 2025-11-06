/**
 * Form Builder Store
 *
 * Central Zustand store combining all form builder slices.
 * Uses the slice pattern for better organization while maintaining a single store.
 */

import { create } from 'zustand';
import { devtools, subscribeWithSelector } from 'zustand/middleware';
import { FormBuilderState } from './types/store.types';
import { createCollaborationSlice } from './slices/collaborationSlice';
import { createPagesSlice } from './slices/pagesSlice';
import { createFieldsSlice } from './slices/fieldsSlice';
import { createLayoutSlice } from './slices/layoutSlice';
import { createSelectionSlice } from './slices/selectionSlice';

/**
 * Combined Form Builder Store
 *
 * Combines all slices into a single store using Zustand's slice pattern.
 * Each slice manages a specific domain:
 *
 * - collaborationSlice: YJS document lifecycle and WebSocket connection
 * - pagesSlice: Page management (CRUD, reorder)
 * - fieldsSlice: Field management (CRUD, reorder, move between pages)
 * - layoutSlice: Layout and theming configuration
 * - selectionSlice: Current page and field selection
 *
 * All slices share the same get/set API, allowing cross-slice communication.
 */
export const useFormBuilderStore = create<FormBuilderState>()(
  devtools(
    subscribeWithSelector((set, get) => ({
      ...createCollaborationSlice(set, get),
      ...createPagesSlice(set, get),
      ...createFieldsSlice(set, get),
      ...createLayoutSlice(set, get),
      ...createSelectionSlice(set, get),
    })),
    {
      name: 'form-builder-store',
    }
  )
);

/**
 * Expose store to window for debugging (development only)
 */
if (typeof window !== 'undefined') {
  (window as any).useFormBuilderStore = useFormBuilderStore;
}
