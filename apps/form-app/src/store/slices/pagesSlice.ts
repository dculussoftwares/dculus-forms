/**
 * Pages Slice
 *
 * Manages form pages (add, remove, reorder, duplicate, update).
 * Depends on: collaborationSlice (for YJS operations), selectionSlice (for updating selection)
 */

import * as Y from 'yjs';
import { PagesSlice, SliceCreator } from '../types/store.types';
import { FormPage } from '@dculus/types';
import { getOrCreatePagesArray } from '../helpers/yjsHelpers';
import { extractFieldData, FieldData } from '../collaboration/CollaborationManager';
import { createYJSFieldMap } from '../helpers/fieldHelpers';

/**
 * Create the pages slice
 *
 * This slice manages the pages array and provides actions for:
 * - Adding/removing pages
 * - Duplicating pages
 * - Updating page properties (title, description)
 * - Reordering pages
 */
export const createPagesSlice: SliceCreator<PagesSlice> = (set, get) => {
  return {
    // Initial state
    pages: [],

    /**
     * Set pages array
     * Used primarily by CollaborationManager update callback
     */
    setPages: (pages: FormPage[]) => set({ pages }),

    /**
     * Add an empty page
     *
     * Creates a new page with default title and empty fields array.
     * Returns the new page ID, or undefined if operation failed.
     */
    addEmptyPage: () => {
      const { _getYDoc, _isYJSReady } = get() as any;
      const ydoc = _getYDoc();
      const isReady = _isYJSReady();

      if (!ydoc || !isReady) {
        console.warn('Cannot add page: YJS document not available or not connected');
        return;
      }

      const formSchemaMap = ydoc.getMap('formSchema');
      const pagesArray = getOrCreatePagesArray(formSchemaMap);

      const pageMap = new Y.Map();
      const newPageId = `page-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
      const fieldsArray = new Y.Array();

      pageMap.set('id', newPageId);
      pageMap.set('title', `New Page ${pagesArray.length + 1}`);
      pageMap.set('order', pagesArray.length);
      pageMap.set('fields', fieldsArray);

      pagesArray.push([pageMap]);

      // Always select the newly created page
      const { setSelectedPage } = get() as any;
      setSelectedPage(newPageId);

      return newPageId;
    },

    /**
     * Remove a page
     *
     * Deletes a page and updates remaining page orders.
     * If the deleted page was selected, selects the previous page.
     */
    removePage: (pageId: string) => {
      const { _getYDoc, _isYJSReady, pages, selectedPageId } = get() as any;
      const ydoc = _getYDoc();
      const isReady = _isYJSReady();

      if (!ydoc || !isReady || pages.length <= 1) return;

      const formSchemaMap = ydoc.getMap('formSchema');
      const pagesArray = formSchemaMap.get('pages') as Y.Array<Y.Map<any>>;

      if (!pagesArray) return;

      const pageIndex = pagesArray.toArray().findIndex((pageMap) => pageMap.get('id') === pageId);
      if (pageIndex === -1) return;

      pagesArray.delete(pageIndex, 1);

      // Update order for remaining pages
      pagesArray.toArray().forEach((pageMap, index) => {
        pageMap.set('order', index);
      });

      // Handle selection if deleted page was selected
      if (selectedPageId === pageId) {
        const remainingPages = pagesArray.toArray();
        if (remainingPages.length > 0) {
          const newSelectedPageIndex = Math.max(0, pageIndex - 1);
          const newSelectedPageId = remainingPages[newSelectedPageIndex]?.get('id');
          if (newSelectedPageId) {
            const { setSelectedPage, setSelectedField } = get() as any;
            setSelectedPage(newSelectedPageId);
            setSelectedField(null);
          }
        }
      }
    },

    /**
     * Duplicate a page
     *
     * Creates a copy of a page including all its fields.
     * Fields get new unique IDs.
     */
    duplicatePage: (pageId: string) => {
      const { _getYDoc, _isYJSReady } = get() as any;
      const ydoc = _getYDoc();
      const isReady = _isYJSReady();

      if (!ydoc || !isReady) return;

      const formSchemaMap = ydoc.getMap('formSchema');
      const pagesArray = formSchemaMap.get('pages') as Y.Array<Y.Map<any>>;

      if (!pagesArray) return;

      const pageIndex = pagesArray.toArray().findIndex((pageMap) => pageMap.get('id') === pageId);
      if (pageIndex === -1) return;

      const originalPageMap = pagesArray.get(pageIndex);
      const duplicatePageMap = new Y.Map();
      const newPageId = `page-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;

      duplicatePageMap.set('id', newPageId);
      duplicatePageMap.set('title', `${originalPageMap.get('title')} (Copy)`);
      duplicatePageMap.set('description', originalPageMap.get('description') || '');
      duplicatePageMap.set('order', pageIndex + 1);

      const originalFieldsArray = originalPageMap.get('fields') as Y.Array<Y.Map<any>>;
      const duplicateFieldsArray = new Y.Array();

      originalFieldsArray.toArray().forEach((originalFieldMap) => {
        const fieldData = extractFieldData(originalFieldMap);
        fieldData.id = `field-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
        const duplicateFieldMap = createYJSFieldMap(fieldData);
        duplicateFieldsArray.push([duplicateFieldMap]);
      });

      duplicatePageMap.set('fields', duplicateFieldsArray);
      pagesArray.insert(pageIndex + 1, [duplicatePageMap]);

      // Update order for all pages
      pagesArray.toArray().forEach((pageMap, index) => {
        pageMap.set('order', index);
      });
    },

    /**
     * Update page title
     *
     * Sets a new title for the specified page.
     */
    updatePageTitle: (pageId: string, title: string) => {
      const { _getYDoc, _isYJSReady } = get() as any;
      const ydoc = _getYDoc();
      const isReady = _isYJSReady();

      if (!ydoc || !isReady) {
        console.warn('Cannot update page title: YJS document not available or not connected');
        return;
      }

      const formSchemaMap = ydoc.getMap('formSchema');
      const pagesArray = getOrCreatePagesArray(formSchemaMap);

      const pageIndex = pagesArray.toArray().findIndex((pageMap) => pageMap.get('id') === pageId);
      if (pageIndex === -1) {
        console.warn(`Page with id ${pageId} not found`);
        return;
      }

      const pageMap = pagesArray.get(pageIndex);
      pageMap.set('title', title);
    },

    /**
     * Reorder pages
     *
     * Moves a page from one position to another.
     * Uses atomic move operation wrapped in transaction for CRDT safety.
     */
    reorderPages: (oldIndex: number, newIndex: number) => {
      const { _getYDoc, _isYJSReady } = get() as any;
      const ydoc = _getYDoc();
      const isReady = _isYJSReady();

      if (!ydoc || !isReady) {
        console.warn('Cannot reorder pages: YJS document not available or not connected');
        return;
      }

      const formSchemaMap = ydoc.getMap('formSchema');
      const pagesArray = formSchemaMap.get('pages') as Y.Array<Y.Map<any>>;

      if (!pagesArray) {
        console.warn('Cannot reorder pages: pages array not found');
        return;
      }

      if (
        oldIndex < 0 ||
        oldIndex >= pagesArray.length ||
        newIndex < 0 ||
        newIndex >= pagesArray.length
      ) {
        console.warn(
          `Invalid page reorder indices: oldIndex=${oldIndex}, newIndex=${newIndex}, pagesLength=${pagesArray.length}`
        );
        return;
      }

      if (oldIndex === newIndex) return;

      console.log(`Reordering page from index ${oldIndex} to ${newIndex}`);

      // Atomic move operation wrapped in transaction
      // This is CRDT-safe and preserves the entire page structure including all fields
      ydoc.transact(() => {
        // Extract page data including all fields
        const oldPageMap = pagesArray.get(oldIndex);
        const pageData: {
          id: string;
          title: string;
          description: string;
          fields: FieldData[];
        } = {
          id: oldPageMap.get('id'),
          title: oldPageMap.get('title'),
          description: oldPageMap.get('description') || '',
          fields: [],
        };

        const fieldsArray = oldPageMap.get('fields') as Y.Array<Y.Map<any>>;
        if (fieldsArray) {
          pageData.fields = fieldsArray.toArray().map((fieldMap) => extractFieldData(fieldMap));
        }

        // Remove page from old position
        pagesArray.delete(oldIndex, 1);

        // Recreate page at new position
        const pageMap = new Y.Map();
        pageMap.set('id', pageData.id);
        pageMap.set('title', pageData.title);
        pageMap.set('description', pageData.description);
        pageMap.set('order', newIndex);

        const newFieldsArray = new Y.Array();
        pageData.fields.forEach((fieldData) => {
          const fieldMap = createYJSFieldMap(fieldData);
          newFieldsArray.push([fieldMap]);
        });
        pageMap.set('fields', newFieldsArray);

        // Insert at new position
        pagesArray.insert(newIndex, [pageMap]);

        // Update order indices for affected pages
        const start = Math.min(oldIndex, newIndex);
        const end = Math.max(oldIndex, newIndex);
        for (let i = start; i <= end; i++) {
          if (i !== newIndex && i < pagesArray.length) {
            pagesArray.get(i).set('order', i);
          }
        }
      });
    },

    /**
     * Internal helper: Find page by ID
     */
    _findPageById: (pageId: string): FormPage | null => {
      const { pages } = get();
      return pages.find((page: FormPage) => page.id === pageId) || null;
    },

    /**
     * Internal helper: Get page index
     */
    _getPageIndex: (pageId: string): number => {
      const { pages } = get();
      return pages.findIndex((page: FormPage) => page.id === pageId);
    },
  };
};
