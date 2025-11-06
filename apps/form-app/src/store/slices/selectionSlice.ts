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
     * Get the currently selected field instance
     *
     * Returns the FormField object for the selected field ID by searching through pages.
     */
    getSelectedField: (): FormField | null => {
      const { pages, selectedFieldId } = get() as any;
      if (!selectedFieldId) return null;

      for (const page of pages) {
        const field = page.fields.find((f: FormField) => f.id === selectedFieldId);
        if (field) return field;
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
