/**
 * Fields Slice
 *
 * Manages form fields within pages (CRUD, reorder, move between pages).
 * Depends on: collaborationSlice (for YJS operations), pagesSlice (for page lookups)
 */

import * as Y from 'yjs';
import { FieldsSlice, SliceCreator } from '../types/store.types';
import { FieldType, FormField, FormPage } from '@dculus/types';
import { getOrCreatePagesArray } from '../helpers/yjsHelpers';
import {
  createFormField,
  createYJSFieldMap,
  serializeFieldToYMap,
} from '../helpers/fieldHelpers';
import { extractFieldData, FieldData } from '../collaboration/CollaborationManager';

/**
 * Create the fields slice
 *
 * This slice manages all field operations including:
 * - Adding fields (at end or at specific index)
 * - Updating field properties
 * - Removing fields
 * - Reordering fields within a page
 * - Duplicating fields
 * - Moving fields between pages
 * - Copying fields to other pages
 */
export const createFieldsSlice: SliceCreator<FieldsSlice> = (_set, get) => {
  return {
    /**
     * Add a field to a page
     *
     * Adds a new field at the end of the page's fields array.
     */
    addField: (pageId: string, fieldType: FieldType, fieldData: Partial<FieldData> = {}) => {
      const { _getYDoc, _isYJSReady } = get() as any;
      const ydoc = _getYDoc();
      const isReady = _isYJSReady();

      if (!ydoc || !isReady) {
        console.warn('Cannot add field: YJS document not available or not connected');
        return;
      }

      const field = createFormField(fieldType, fieldData);
      const formSchemaMap = ydoc.getMap('formSchema');
      const pagesArray = getOrCreatePagesArray(formSchemaMap);

      const pageIndex = pagesArray.toArray().findIndex((pageMap) => pageMap.get('id') === pageId);
      if (pageIndex === -1) {
        console.warn(`Page with id ${pageId} not found`);
        return;
      }

      const pageMap = pagesArray.get(pageIndex);
      let fieldsArray = pageMap.get('fields') as Y.Array<Y.Map<any>>;

      if (!fieldsArray) {
        fieldsArray = new Y.Array();
        pageMap.set('fields', fieldsArray);
      }

      const fieldMap = serializeFieldToYMap(field);
      fieldsArray.push([fieldMap]);
    },

    /**
     * Add a field at a specific index
     *
     * Inserts a new field at the specified position in the page's fields array.
     */
    addFieldAtIndex: (
      pageId: string,
      fieldType: FieldType,
      fieldData: Partial<FieldData>,
      insertIndex: number
    ) => {
      const { _getYDoc, _isYJSReady } = get() as any;
      const ydoc = _getYDoc();
      const isReady = _isYJSReady();

      if (!ydoc || !isReady) {
        console.warn('Cannot add field at index: YJS document not available or not connected');
        return;
      }

      const field = createFormField(fieldType, fieldData);
      const formSchemaMap = ydoc.getMap('formSchema');
      const pagesArray = getOrCreatePagesArray(formSchemaMap);

      const pageIndex = pagesArray.toArray().findIndex((pageMap) => pageMap.get('id') === pageId);
      if (pageIndex === -1) {
        console.warn(`Page with id ${pageId} not found`);
        return;
      }

      const pageMap = pagesArray.get(pageIndex);
      let fieldsArray = pageMap.get('fields') as Y.Array<Y.Map<any>>;

      if (!fieldsArray) {
        fieldsArray = new Y.Array();
        pageMap.set('fields', fieldsArray);
      }

      const fieldMap = serializeFieldToYMap(field);
      const safeIndex = Math.max(0, Math.min(insertIndex, fieldsArray.length));

      if (safeIndex === fieldsArray.length) {
        fieldsArray.push([fieldMap]);
      } else {
        fieldsArray.insert(safeIndex, [fieldMap]);
      }
    },

    /**
     * Update a field's properties
     *
     * Updates specific properties of a field while preserving others.
     */
    updateField: (pageId: string, fieldId: string, updates: Partial<FieldData>) => {
      const { _getYDoc, _isYJSReady } = get() as any;
      const ydoc = _getYDoc();
      const isReady = _isYJSReady();

      if (!ydoc || !isReady) return;

      console.log(`🔄 FieldsSlice - Updating field ${fieldId} in page ${pageId}:`, {
        updates,
        isRichTextUpdate: updates.content !== undefined,
        richTextContent: updates.content ? updates.content.substring(0, 100) + '...' : 'N/A',
      });

      const formSchemaMap = ydoc.getMap('formSchema');
      const pagesArray = getOrCreatePagesArray(formSchemaMap);

      const pageIndex = pagesArray.toArray().findIndex((pageMap) => pageMap.get('id') === pageId);

      if (pageIndex === -1) return;

      const pageMap = pagesArray.get(pageIndex);
      const fieldsArray = pageMap.get('fields') as Y.Array<Y.Map<any>>;
      const fieldIndex = fieldsArray.toArray().findIndex((fieldMap) => fieldMap.get('id') === fieldId);

      if (fieldIndex === -1) return;

      const fieldMap = fieldsArray.get(fieldIndex);
      const fieldType = fieldMap.get('type');

      // Get or create validation map
      let validationMap = fieldMap.get('validation');
      if (!validationMap || !(validationMap instanceof Y.Map)) {
        validationMap = new Y.Map();
        validationMap.set('required', false);
        if (fieldType === FieldType.TEXT_INPUT_FIELD || fieldType === FieldType.TEXT_AREA_FIELD) {
          validationMap.set('type', FieldType.TEXT_FIELD_VALIDATION);
        } else if (fieldType === FieldType.CHECKBOX_FIELD) {
          validationMap.set('type', FieldType.CHECKBOX_FIELD_VALIDATION);
        } else {
          validationMap.set('type', FieldType.FILLABLE_FORM_FIELD);
        }
        fieldMap.set('validation', validationMap);
      }

      Object.entries(updates).forEach(([key, value]) => {
        console.log(`📝 FieldsSlice - Processing update key '${key}':`, {
          fieldId,
          key,
          value: key === 'content' ? (typeof value === 'string' ? value.substring(0, 100) + '...' : value) : value,
          valueType: typeof value,
          fieldType,
        });

        if (key === 'options' && Array.isArray(value)) {
          const optionsArray = new Y.Array();
          value
            .filter((option) => option && option.trim() !== '')
            .forEach((option: string) => optionsArray.push([option]));
          fieldMap.set('options', optionsArray);
        } else if (key === 'defaultValue' && Array.isArray(value) && fieldType === FieldType.CHECKBOX_FIELD) {
          // Handle checkbox defaultValue arrays
          const defaultValueArray = new Y.Array();
          value
            .filter((val) => val && val.trim() !== '')
            .forEach((val: string) => defaultValueArray.push([val]));
          fieldMap.set('defaultValue', defaultValueArray);
        } else if (key === 'validation' && value && typeof value === 'object' && !Array.isArray(value)) {
          // Handle validation object from field editor
          const validationData = value as any;
          console.log(`🔄 Setting validation.required to: ${validationData.required} for field ${fieldId}`);
          if (validationData.required !== undefined) {
            validationMap.set('required', validationData.required);
          }
          if (fieldType === FieldType.TEXT_INPUT_FIELD || fieldType === FieldType.TEXT_AREA_FIELD) {
            if (validationData.minLength !== undefined) {
              validationMap.set('minLength', validationData.minLength);
            }
            if (validationData.maxLength !== undefined) {
              validationMap.set('maxLength', validationData.maxLength);
            }
          } else if (fieldType === FieldType.CHECKBOX_FIELD) {
            if (validationData.minSelections !== undefined) {
              validationMap.set('minSelections', validationData.minSelections);
            }
            if (validationData.maxSelections !== undefined) {
              validationMap.set('maxSelections', validationData.maxSelections);
            }
          }
        } else if (key === 'required') {
          // Update validation required field (fallback for direct required updates)
          validationMap.set('required', value);
        } else if (
          key === 'min' &&
          (fieldType === FieldType.TEXT_INPUT_FIELD || fieldType === FieldType.TEXT_AREA_FIELD)
        ) {
          // For text fields, min maps to minLength in validation (fallback for old format)
          validationMap.set('minLength', value);
        } else if (
          key === 'max' &&
          (fieldType === FieldType.TEXT_INPUT_FIELD || fieldType === FieldType.TEXT_AREA_FIELD)
        ) {
          // For text fields, max maps to maxLength in validation (fallback for old format)
          validationMap.set('maxLength', value);
        } else if (value !== undefined) {
          console.log(`✅ FieldsSlice - Setting field property:`, {
            fieldId,
            key,
            value: key === 'content' ? `[${value.length} chars]` : value,
          });
          fieldMap.set(key, value);
        }
      });
    },

    /**
     * Remove a field from a page
     */
    removeField: (pageId: string, fieldId: string) => {
      const { _getYDoc, _isYJSReady } = get() as any;
      const ydoc = _getYDoc();
      const isReady = _isYJSReady();

      if (!ydoc || !isReady) return;

      const formSchemaMap = ydoc.getMap('formSchema');
      const pagesArray = formSchemaMap.get('pages') as Y.Array<Y.Map<any>>;

      if (!pagesArray) {
        console.warn('YJS formSchema pages array not found');
        return;
      }
      const pageIndex = pagesArray.toArray().findIndex((pageMap) => pageMap.get('id') === pageId);

      if (pageIndex === -1) return;

      const pageMap = pagesArray.get(pageIndex);
      const fieldsArray = pageMap.get('fields') as Y.Array<Y.Map<any>>;
      const fieldIndex = fieldsArray.toArray().findIndex((fieldMap) => fieldMap.get('id') === fieldId);

      if (fieldIndex !== -1) {
        fieldsArray.delete(fieldIndex, 1);
      }
    },

    /**
     * Reorder fields within a page
     *
     * Moves a field from one position to another within the same page.
     */
    reorderFields: (pageId: string, oldIndex: number, newIndex: number) => {
      const { _getYDoc, _isYJSReady } = get() as any;
      const ydoc = _getYDoc();
      const isReady = _isYJSReady();

      if (!ydoc || !isReady) {
        console.warn('Cannot reorder fields: YJS document not available or not connected');
        return;
      }

      const formSchemaMap = ydoc.getMap('formSchema');
      const pagesArray = formSchemaMap.get('pages') as Y.Array<Y.Map<any>>;

      if (!pagesArray) {
        console.warn('Cannot reorder fields: pages array not found');
        return;
      }

      const pageIndex = pagesArray.toArray().findIndex((pageMap) => pageMap.get('id') === pageId);
      if (pageIndex === -1) {
        console.warn(`Page with id ${pageId} not found`);
        return;
      }

      const pageMap = pagesArray.get(pageIndex);
      const fieldsArray = pageMap.get('fields') as Y.Array<Y.Map<any>>;

      if (!fieldsArray) {
        console.warn('Fields array not found for page');
        return;
      }

      if (
        oldIndex < 0 ||
        oldIndex >= fieldsArray.length ||
        newIndex < 0 ||
        newIndex >= fieldsArray.length
      ) {
        console.warn(
          `Invalid field reorder indices: oldIndex=${oldIndex}, newIndex=${newIndex}, fieldsLength=${fieldsArray.length}`
        );
        return;
      }

      if (oldIndex === newIndex) return;

      console.log(`Reordering field from index ${oldIndex} to ${newIndex} in page ${pageId}`);

      const allFields = fieldsArray.toArray().map((fieldMap) => extractFieldData(fieldMap));

      const fieldToMove = allFields[oldIndex];
      allFields.splice(oldIndex, 1);
      allFields.splice(newIndex, 0, fieldToMove);

      fieldsArray.delete(0, fieldsArray.length);

      allFields.forEach((fieldData) => {
        const fieldMap = createYJSFieldMap(fieldData);
        fieldsArray.push([fieldMap]);
      });
    },

    /**
     * Duplicate a field within the same page
     *
     * Creates a copy of the field with a new ID and "(Copy)" suffix.
     */
    duplicateField: (pageId: string, fieldId: string) => {
      const { _getYDoc, _isYJSReady } = get() as any;
      const ydoc = _getYDoc();
      const isReady = _isYJSReady();

      if (!ydoc || !isReady) return;

      const formSchemaMap = ydoc.getMap('formSchema');
      const pagesArray = formSchemaMap.get('pages') as Y.Array<Y.Map<any>>;

      if (!pagesArray) return;

      const pageIndex = pagesArray.toArray().findIndex((pageMap) => pageMap.get('id') === pageId);
      if (pageIndex === -1) return;

      const pageMap = pagesArray.get(pageIndex);
      const fieldsArray = pageMap.get('fields') as Y.Array<Y.Map<any>>;
      const fieldIndex = fieldsArray.toArray().findIndex((fieldMap) => fieldMap.get('id') === fieldId);

      if (fieldIndex === -1) return;

      const originalFieldMap = fieldsArray.get(fieldIndex);
      const fieldData = extractFieldData(originalFieldMap);

      fieldData.id = `field-${Date.now()}-copy`;
      fieldData.label = `${fieldData.label} (Copy)`;

      const duplicateFieldMap = createYJSFieldMap(fieldData);
      fieldsArray.insert(fieldIndex + 1, [duplicateFieldMap]);
    },

    /**
     * Move a field from one page to another
     *
     * Removes the field from source page and adds it to target page.
     */
    moveFieldBetweenPages: (
      sourcePageId: string,
      targetPageId: string,
      fieldId: string,
      insertIndex?: number
    ) => {
      const { _getYDoc, _isYJSReady } = get() as any;
      const ydoc = _getYDoc();
      const isReady = _isYJSReady();

      if (!ydoc || !isReady) {
        console.warn('Cannot move field between pages: YJS document not available or not connected');
        return;
      }

      if (sourcePageId === targetPageId) {
        console.warn('Cannot move field to same page - use reorderFields instead');
        return;
      }

      const formSchemaMap = ydoc.getMap('formSchema');
      const pagesArray = getOrCreatePagesArray(formSchemaMap);

      // Find source and target pages
      const sourcePageIndex = pagesArray.toArray().findIndex((pageMap) => pageMap.get('id') === sourcePageId);
      const targetPageIndex = pagesArray.toArray().findIndex((pageMap) => pageMap.get('id') === targetPageId);

      if (sourcePageIndex === -1 || targetPageIndex === -1) {
        console.warn(`Page not found - source: ${sourcePageId}, target: ${targetPageId}`);
        return;
      }

      const sourcePageMap = pagesArray.get(sourcePageIndex);
      const targetPageMap = pagesArray.get(targetPageIndex);
      const sourceFieldsArray = sourcePageMap.get('fields') as Y.Array<Y.Map<any>>;
      const targetFieldsArray = targetPageMap.get('fields') as Y.Array<Y.Map<any>>;

      // Find the field to move
      const fieldIndex = sourceFieldsArray.toArray().findIndex((fieldMap) => fieldMap.get('id') === fieldId);
      if (fieldIndex === -1) {
        console.warn(`Field ${fieldId} not found in source page ${sourcePageId}`);
        return;
      }

      // Extract the field data
      const fieldMap = sourceFieldsArray.get(fieldIndex);
      const fieldData = extractFieldData(fieldMap);

      console.log(
        `Moving field ${fieldId} from page ${sourcePageId} to page ${targetPageId} at index ${insertIndex || targetFieldsArray.length}`
      );

      // Remove field from source page
      sourceFieldsArray.delete(fieldIndex, 1);

      // Add field to target page at specified index
      const newFieldMap = createYJSFieldMap(fieldData);
      const safeInsertIndex =
        insertIndex !== undefined ? Math.max(0, Math.min(insertIndex, targetFieldsArray.length)) : targetFieldsArray.length;

      if (safeInsertIndex === targetFieldsArray.length) {
        targetFieldsArray.push([newFieldMap]);
      } else {
        targetFieldsArray.insert(safeInsertIndex, [newFieldMap]);
      }

      // Update selected field if it was the moved field
      const { selectedFieldId, setSelectedPage } = get() as any;
      if (selectedFieldId === fieldId) {
        setSelectedPage(targetPageId);
      }
    },

    /**
     * Copy a field to another page
     *
     * Creates a duplicate of the field on the target page.
     */
    copyFieldToPage: (sourcePageId: string, targetPageId: string, fieldId: string) => {
      const { _getYDoc, _isYJSReady } = get() as any;
      const ydoc = _getYDoc();
      const isReady = _isYJSReady();

      if (!ydoc || !isReady) {
        console.warn('Cannot copy field to page: YJS document not available or not connected');
        return;
      }

      if (sourcePageId === targetPageId) {
        console.warn('Cannot copy field to same page - use duplicateField instead');
        return;
      }

      const formSchemaMap = ydoc.getMap('formSchema');
      const pagesArray = getOrCreatePagesArray(formSchemaMap);

      // Find source and target pages
      const sourcePageIndex = pagesArray.toArray().findIndex((pageMap) => pageMap.get('id') === sourcePageId);
      const targetPageIndex = pagesArray.toArray().findIndex((pageMap) => pageMap.get('id') === targetPageId);

      if (sourcePageIndex === -1 || targetPageIndex === -1) {
        console.warn(`Page not found - source: ${sourcePageId}, target: ${targetPageId}`);
        return;
      }

      const sourcePageMap = pagesArray.get(sourcePageIndex);
      const targetPageMap = pagesArray.get(targetPageIndex);
      const sourceFieldsArray = sourcePageMap.get('fields') as Y.Array<Y.Map<any>>;
      const targetFieldsArray = targetPageMap.get('fields') as Y.Array<Y.Map<any>>;

      // Find the field to copy
      const fieldIndex = sourceFieldsArray.toArray().findIndex((fieldMap) => fieldMap.get('id') === fieldId);
      if (fieldIndex === -1) {
        console.warn(`Field ${fieldId} not found in source page ${sourcePageId}`);
        return;
      }

      // Extract the field data
      const originalFieldMap = sourceFieldsArray.get(fieldIndex);
      const fieldData = extractFieldData(originalFieldMap);

      // Create a copy with new ID and modified label
      fieldData.id = `field-${Date.now()}-copy`;
      fieldData.label = `${fieldData.label} (Copy)`;

      console.log(`Copying field ${fieldId} from page ${sourcePageId} to page ${targetPageId}`);

      // Add the copied field to target page at the end
      const copiedFieldMap = createYJSFieldMap(fieldData);
      targetFieldsArray.push([copiedFieldMap]);
    },

    /**
     * Internal helper: Find field in all pages
     *
     * Returns both the page and field if found.
     */
    _findFieldInPages: (fieldId: string): { page: FormPage; field: FormField } | null => {
      const { pages } = get() as any;

      for (const page of pages) {
        const field = page.fields.find((f: FormField) => f.id === fieldId);
        if (field) {
          return { page, field };
        }
      }
      return null;
    },
  };
};
