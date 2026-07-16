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
import { createConditionsSlice } from './slices/conditionsSlice';
import { createSelectionSlice } from './slices/selectionSlice';
import { createAISlice } from './slices/aiSlice';
import { DEFAULT_LAYOUT } from './helpers/defaultLayout';

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
      ...createConditionsSlice(set, get),
      ...createSelectionSlice(set, get),
      ...createAISlice(set, get),

      /**
       * P2-16: Reset layout and selection state when leaving the form builder.
       * Called from CollaborativeFormBuilder's cleanup useEffect.
       */
      resetBuilder: () => {
        set({
          layout: DEFAULT_LAYOUT,
          isShuffleEnabled: false,
          conditions: [],
          selectedPageId: null,
          selectedFieldId: null,
        });
      },
    })),
    {
      name: 'form-builder-store',
    }
  )
);

/**
 * Expose store to window for debugging (development only)
 */
if (typeof window !== 'undefined' && import.meta.env.DEV) {
  (window as any).useFormBuilderStore = useFormBuilderStore;
}
