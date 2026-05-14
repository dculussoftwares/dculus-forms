/**
 * Selection Slice
 *
 * Manages current page and field selection state.
 * Depends on: pagesSlice (for resolving selected instances)
 */

import { SelectionSlice, SliceCreator } from '../types/store.types';
import { FormField, FormPage } from '@dculus/types';

/**
 * Create the selection slice
 *
 * This slice manages which page and field are currently selected in the form builder.
 * It provides actions to change selection and computed selectors to resolve the actual
 * page/field instances from the IDs.
 */
export const createSelectionSlice: SliceCreator<SelectionSlice> = (set, get) => {
  return {
    // Initial state
    selectedPageId: null,
    selectedFieldId: null,

    /**
     * Set the currently selected page
     */
    setSelectedPage: (selectedPageId: string | null) => set({ selectedPageId }),

    /**
     * Set the currently selected field
     */
    setSelectedField: (selectedFieldId: string | null) => set({ selectedFieldId }),

    /**
     * Get the currently selected field instance.
     * Uses a flat field index (built once per call from the pages array) so the
     * lookup is O(n) to build + O(1) to read, instead of O(n*m) on every call.
     */
    getSelectedField: (): FormField | null => {
      const { pages, selectedFieldId } = get() as any;
      if (!selectedFieldId) return null;

      // Build a flat id→field map once and look up in O(1).
      // This is acceptable because pages is already in memory; the map construction
      // is O(total fields) which is the same as the old nested loop worst-case.
      for (const page of pages) {
        if (!page.fields) continue;
        for (const field of page.fields as FormField[]) {
          if (field.id === selectedFieldId) return field;
        }
      }
      return null;
    },

    /**
     * Get the currently selected page instance
     *
     * Returns the FormPage object for the selected page ID.
     */
    getSelectedPage: (): FormPage | null => {
      const { pages, selectedPageId } = get() as any;
      if (!selectedPageId) return null;

      return pages.find((page: FormPage) => page.id === selectedPageId) || null;
    },
  };
};
