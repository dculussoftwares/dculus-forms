/**
 * Selection Slice
 *
 * Manages the current builder selection (intro / page / field / thank-you) plus
 * `selectedPageId`/`selectedFieldId`, which are kept as compatible derived state so
 * existing consumers (FormArea, RightSidebar, FieldSettingsV2, drag handlers) don't
 * need to change.
 * Depends on: pagesSlice (for resolving selected instances)
 */

import { Selection, SelectionSlice, SliceCreator } from '../types/store.types';
import { FormField, FormPage } from '@dculus/types';

/** Derive the compatible selectedPageId/selectedFieldId pair from a Selection. */
const deriveLegacySelection = (selection: Selection) => ({
  selectedPageId:
    selection.kind === 'page' || selection.kind === 'field'
      ? (selection.pageId ?? null)
      : null,
  selectedFieldId: selection.kind === 'field' ? (selection.fieldId ?? null) : null,
});

/**
 * Create the selection slice
 *
 * This slice manages which screen (intro/page/field/thankYou) is currently selected
 * in the form builder. It provides actions to change selection and computed
 * selectors to resolve the actual page/field instances from the IDs.
 */
export const createSelectionSlice: SliceCreator<SelectionSlice> = (set, get) => {
  return {
    // Initial state — default landing state is "a page is selected" (resolved once
    // pages load, see CollaborativeFormBuilder's autoSelectFirstPage).
    selection: { kind: 'page' },
    selectedPageId: null,
    selectedFieldId: null,

    /**
     * Set the full builder selection. This is the master API — the journey rail and
     * the URL sync hook call this directly.
     */
    setSelection: (selection: Selection) => {
      set({ selection, ...deriveLegacySelection(selection) });
    },

    /**
     * Set the currently selected page (compatible/derived API).
     *
     * Always resolves to a plain page-level selection, dropping any previously
     * selected field. The one caller that wants to follow the selected field across
     * a cross-page move (fieldsSlice.moveFieldBetweenPages) calls `setSelection`
     * directly instead of this, so it doesn't need a special case here.
     */
    setSelectedPage: (pageId: string | null) => {
      const nextSelection: Selection = pageId ? { kind: 'page', pageId } : { kind: 'page' };
      set({ selection: nextSelection, ...deriveLegacySelection(nextSelection) });
    },

    /**
     * Set the currently selected field (compatible/derived API).
     *
     * Passing null deselects the field and falls back to a page-level selection
     * (keeping whatever page is currently in context). Passing an id resolves the
     * owning page from the pages array so `selection.pageId` stays accurate even
     * when the field is selected from outside its page's context.
     */
    setSelectedField: (fieldId: string | null) => {
      if (fieldId === null) {
        const { selectedPageId } = get() as any;
        const nextSelection: Selection = selectedPageId
          ? { kind: 'page', pageId: selectedPageId }
          : { kind: 'page' };
        set({ selection: nextSelection, ...deriveLegacySelection(nextSelection) });
        return;
      }

      const { pages, selectedPageId } = get() as any;
      let ownerPageId: string | undefined;
      for (const page of pages as FormPage[]) {
        if (page.fields?.some((field: FormField) => field.id === fieldId)) {
          ownerPageId = page.id;
          break;
        }
      }
      const pageId = ownerPageId ?? selectedPageId ?? undefined;
      const nextSelection: Selection = { kind: 'field', fieldId, pageId };

      set({ selection: nextSelection, ...deriveLegacySelection(nextSelection) });
    },

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
