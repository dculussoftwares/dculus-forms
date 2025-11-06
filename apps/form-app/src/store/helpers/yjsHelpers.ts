/**
 * YJS Helper Functions
 *
 * Utility functions for working with YJS documents and arrays.
 */

import * as Y from 'yjs';

/**
 * Get or create the pages array from the YJS formSchema map
 *
 * This ensures the pages array exists before operations that need it.
 */
export const getOrCreatePagesArray = (formSchemaMap: Y.Map<any>): Y.Array<Y.Map<any>> => {
  let pagesArray = formSchemaMap.get('pages') as Y.Array<Y.Map<any>>;

  if (!pagesArray) {
    console.log('🔧 Creating new pages array in YJS document');
    pagesArray = new Y.Array();
    formSchemaMap.set('pages', pagesArray);
  }

  return pagesArray;
};
