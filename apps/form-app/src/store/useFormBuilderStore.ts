import { create } from 'zustand';
import { devtools, subscribeWithSelector } from 'zustand/middleware';
import * as Y from 'yjs';
import { HocuspocusProvider } from '@hocuspocus/provider';
import {
  FieldType,
  FormField,
  FormPage,
  FormLayout,
  TextInputField,
  TextAreaField,
  EmailField,
  NumberField,
  SelectField,
  RadioField,
  CheckboxField,
  DateField,
  RichTextFormField,
  FillableFormField,
  FillableFormFieldValidation,
  TextFieldValidation,
  CheckboxFieldValidation,
  ThemeType,
  SpacingType,
  LayoutCode,
  PageModeType
} from '@dculus/types';
import {
  CollaborationManager,
  extractFieldData,
  FieldData,
} from './collaboration/CollaborationManager';

interface FormBuilderState {
  isConnected: boolean;
  isLoading: boolean;
  formId: string | null;
  
  ydoc: Y.Doc | null;
  provider: HocuspocusProvider | null;
  observerCleanups: Array<() => void>;
  
  pages: FormPage[];
  layout: FormLayout;
  isShuffleEnabled: boolean;
  
  selectedPageId: string | null;
  selectedFieldId: string | null;
  
  initializeCollaboration: (formId: string) => Promise<void>;
  disconnectCollaboration: () => void;
  setConnectionState: (isConnected: boolean) => void;
  setLoadingState: (isLoading: boolean) => void;
  setPages: (pages: FormPage[]) => void;
  setSelectedPage: (pageId: string | null) => void;
  setSelectedField: (fieldId: string | null) => void;
  
  addEmptyPage: () => string | undefined;
  removePage: (pageId: string) => void;
  duplicatePage: (pageId: string) => void;
  updatePageTitle: (pageId: string, title: string) => void;
  addField: (pageId: string, fieldType: FieldType, fieldData?: Partial<FieldData>) => void;
  addFieldAtIndex: (pageId: string, fieldType: FieldType, fieldData: Partial<FieldData>, insertIndex: number) => void;
  updateField: (pageId: string, fieldId: string, updates: Partial<FieldData>) => void;
  removeField: (pageId: string, fieldId: string) => void;
  reorderFields: (pageId: string, oldIndex: number, newIndex: number) => void;
  reorderPages: (oldIndex: number, newIndex: number) => void;
  duplicateField: (pageId: string, fieldId: string) => void;
  moveFieldBetweenPages: (sourcePageId: string, targetPageId: string, fieldId: string, insertIndex?: number) => void;
  copyFieldToPage: (sourcePageId: string, targetPageId: string, fieldId: string) => void;
  updateLayout: (layoutUpdates: Partial<FormLayout>) => void;
  
  getSelectedField: () => FormField | null;
}

const isFillableFormField = (field: FormField): field is FillableFormField => {
  return field instanceof FillableFormField || 
         (field as any).label !== undefined ||
         field.type !== FieldType.FORM_FIELD;
};

const createYJSFieldMap = (fieldData: FieldData): Y.Map<any> => {
  const fieldMap = new Y.Map();
  
  Object.entries(fieldData).forEach(([key, value]) => {
    if (key === 'options' && Array.isArray(value)) {
      const optionsArray = new Y.Array();
      value.filter(option => option && option.trim() !== '').forEach(option => 
        optionsArray.push([option])
      );
      fieldMap.set('options', optionsArray);
    } else if (value !== undefined) {
      fieldMap.set(key, value);
    }
  });
  
  // Store validation object for fields that have specialized validation
  if (fieldData.type === FieldType.TEXT_INPUT_FIELD || fieldData.type === FieldType.TEXT_AREA_FIELD) {
    const validationMap = new Y.Map();
    validationMap.set('required', fieldData.required || false);
    validationMap.set('type', FieldType.TEXT_FIELD_VALIDATION);
    if (fieldData.min !== undefined) {
      validationMap.set('minLength', fieldData.min);
    }
    if (fieldData.max !== undefined) {
      validationMap.set('maxLength', fieldData.max);
    }
    fieldMap.set('validation', validationMap);
  } else if (fieldData.type === FieldType.CHECKBOX_FIELD) {
    const validationMap = new Y.Map();
    validationMap.set('required', fieldData.required || false);
    validationMap.set('type', FieldType.CHECKBOX_FIELD_VALIDATION);
    if (fieldData.validation?.minSelections !== undefined) {
      validationMap.set('minSelections', fieldData.validation.minSelections);
    }
    if (fieldData.validation?.maxSelections !== undefined) {
      validationMap.set('maxSelections', fieldData.validation.maxSelections);
    }
    fieldMap.set('validation', validationMap);
  } else if (fieldData.type === FieldType.RICH_TEXT_FIELD) {
    // Rich Text fields don't have validation - skip validation setup
    // Content is already handled in the Object.entries loop above
  } else {
    // For other field types, store basic validation
    const validationMap = new Y.Map();
    validationMap.set('required', fieldData.required || false);
    validationMap.set('type', FieldType.FILLABLE_FORM_FIELD);
    fieldMap.set('validation', validationMap);
  }
  
  return fieldMap;
};

const FIELD_CONFIGS: Partial<Record<FieldType, { label: string; placeholder?: string }>> = {
  [FieldType.TEXT_INPUT_FIELD]: { label: 'Text Input' },
  [FieldType.TEXT_AREA_FIELD]: { label: 'Text Area' },
  [FieldType.EMAIL_FIELD]: { label: 'Email' },
  [FieldType.NUMBER_FIELD]: { label: 'Number' },
  [FieldType.SELECT_FIELD]: { label: 'Select' },
  [FieldType.RADIO_FIELD]: { label: 'Radio' },
  [FieldType.CHECKBOX_FIELD]: { label: 'Checkbox' },
  [FieldType.DATE_FIELD]: { label: 'Date' },
  // NOTE: RICH_TEXT_FIELD omitted intentionally - it's non-fillable and shouldn't have a label
};

const generateUniqueId = (): string => {
  return `field-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
};

const createFormField = (fieldType: FieldType, fieldData: Partial<FieldData> = {}): FormField => {
  const fieldId = generateUniqueId();
  const config = FIELD_CONFIGS[fieldType] || { label: 'Field' };
  
  const label = fieldData.label || config.label;
  const defaultValue = fieldData.defaultValue || '';
  const prefix = fieldData.prefix || '';
  const hint = fieldData.hint || '';
  const placeholder = fieldData.placeholder || '';
  
  switch (fieldType) {
    case FieldType.TEXT_INPUT_FIELD: {
      const textValidation = new TextFieldValidation(fieldData.required || false, fieldData.min, fieldData.max);
      return new TextInputField(fieldId, label, defaultValue, prefix, hint, placeholder, textValidation);
    }
    case FieldType.TEXT_AREA_FIELD: {
      const textValidation = new TextFieldValidation(fieldData.required || false, fieldData.min, fieldData.max);
      return new TextAreaField(fieldId, label, defaultValue, prefix, hint, placeholder, textValidation);
    }
    case FieldType.EMAIL_FIELD: {
      const validation = new FillableFormFieldValidation(fieldData.required || false);
      return new EmailField(fieldId, label, defaultValue, prefix, hint, placeholder, validation);
    }
    case FieldType.NUMBER_FIELD: {
      const validation = new FillableFormFieldValidation(fieldData.required || false);
      return new NumberField(fieldId, label, defaultValue, prefix, hint, placeholder, validation, fieldData.min, fieldData.max);
    }
    case FieldType.SELECT_FIELD: {
      const validation = new FillableFormFieldValidation(fieldData.required || false);
      return new SelectField(fieldId, label, defaultValue, prefix, hint, validation, fieldData.options || []);
    }
    case FieldType.RADIO_FIELD: {
      const validation = new FillableFormFieldValidation(fieldData.required || false);
      return new RadioField(fieldId, label, defaultValue, prefix, hint, validation, fieldData.options || []);
    }
    case FieldType.CHECKBOX_FIELD: {
      const validation = new CheckboxFieldValidation(
        fieldData.required || false,
        fieldData.validation?.minSelections,
        fieldData.validation?.maxSelections
      );
      // For checkbox fields, use defaultValue as array (it could be string or array from fieldData)
      const checkboxDefaults = fieldData.defaultValue || [];
      return new CheckboxField(fieldId, label, checkboxDefaults, prefix, hint, placeholder, validation, fieldData.options || []);
    }
    case FieldType.DATE_FIELD: {
      const validation = new FillableFormFieldValidation(fieldData.required || false);
      return new DateField(fieldId, label, defaultValue, prefix, hint, placeholder, validation, fieldData.minDate, fieldData.maxDate);
    }
    case FieldType.RICH_TEXT_FIELD: {
      const content = (fieldData as any).content || '<p>Enter your rich text content here...</p>';
      console.log('🏗️ createFormField - Creating Rich Text Field:', {
        fieldId,
        contentLength: content.length,
        content: content.substring(0, 100) + '...'
      });
      return new RichTextFormField(fieldId, content);
    }
    default:
      return new FormField(fieldId);
  }
};

const serializeFieldToYMap = (field: FormField): Y.Map<any> => {
  if (!(field instanceof FillableFormField) && !isFillableFormField(field)) {
    const fieldMap = new Y.Map();
    fieldMap.set('id', field.id);
    fieldMap.set('type', field.type);
    
    // Handle rich text fields
    if (field.type === FieldType.RICH_TEXT_FIELD) {
      fieldMap.set('content', (field as any).content || '');
    }
    
    return fieldMap;
  }
  
  const fillableField = field as any;
  const fieldData: FieldData = {
    id: field.id,
    type: field.type,
    label: fillableField.label || '',
    defaultValue: fillableField.defaultValue || '',
    prefix: fillableField.prefix || '',
    hint: fillableField.hint || '',
    required: fillableField.validation?.required || false,
    placeholder: fillableField.placeholder || '',
    options: fillableField.options,
    min: fillableField.validation?.minLength || fillableField.min,
    max: fillableField.validation?.maxLength || fillableField.max,
    minDate: fillableField.minDate,
    maxDate: fillableField.maxDate,
  };
  
  return createYJSFieldMap(fieldData);
};

const getOrCreatePagesArray = (formSchemaMap: Y.Map<any>): Y.Array<Y.Map<any>> => {
  let pagesArray = formSchemaMap.get('pages') as Y.Array<Y.Map<any>>;
  
  if (!pagesArray) {
    console.log('🔧 Creating new pages array in YJS document');
    pagesArray = new Y.Array();
    formSchemaMap.set('pages', pagesArray);
  }
  
  return pagesArray;
};

export const useFormBuilderStore = create<FormBuilderState>()(
  devtools(
    subscribeWithSelector((set, get) => {
      let collaborationManager: CollaborationManager | null = null;

      const updateCallback = (pages: FormPage[], layout?: FormLayout, isShuffleEnabled?: boolean) => {
        const updates: Partial<FormBuilderState> = { pages };
        
        if (layout) {
          updates.layout = layout;
        }
        
        if (isShuffleEnabled !== undefined) {
          updates.isShuffleEnabled = Boolean(isShuffleEnabled);
        }

        set(updates);
      };

      const connectionCallback = (isConnected: boolean) => {
        set({ isConnected });
      };

      const loadingCallback = (isLoading: boolean) => {
        set({ isLoading });
      };

      return {
        isConnected: false,
        isLoading: true,
        formId: null,
        ydoc: null,
        provider: null,
        observerCleanups: [],
        pages: [],
        layout: {
          theme: ThemeType.LIGHT,
          textColor: '#1f2937',
          spacing: SpacingType.NORMAL,
          code: 'L1' as LayoutCode,
          content: '',
          customBackGroundColor: '#ffffff',
          customCTAButtonName: 'Submit',
          backgroundImageKey: '',
          pageMode: PageModeType.MULTIPAGE
        },
        isShuffleEnabled: false,
        selectedPageId: null,
        selectedFieldId: null,

        initializeCollaboration: async (formId: string) => {
          console.log('🔧 Initializing collaboration for form:', formId);
          
          if (!collaborationManager) {
            collaborationManager = new CollaborationManager(
              updateCallback,
              connectionCallback,
              loadingCallback
            );
          }

          await collaborationManager.initialize(formId);
          
          set({ 
            formId,
            ydoc: collaborationManager.getYDoc(),
            provider: null
          });
        },

        disconnectCollaboration: () => {
          if (collaborationManager) {
            collaborationManager.disconnect();
            collaborationManager = null;
          }
          
          set({
            isConnected: false,
            isLoading: false,
            formId: null,
            ydoc: null,
            provider: null,
            observerCleanups: [],
            pages: [],
            selectedPageId: null,
            selectedFieldId: null
          });
        },

        setConnectionState: (isConnected: boolean) => set({ isConnected }),
        setLoadingState: (isLoading: boolean) => set({ isLoading }),
        setPages: (pages: FormPage[]) => set({ pages }),
        setSelectedPage: (selectedPageId: string | null) => set({ selectedPageId }),
        setSelectedField: (selectedFieldId: string | null) => set({ selectedFieldId }),

        addEmptyPage: () => {
          const { ydoc, isConnected } = get();
          if (!ydoc || !isConnected) {
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
          set({ selectedPageId: newPageId });
          
          return newPageId;
        },

        addField: (pageId: string, fieldType: FieldType, fieldData: Partial<FieldData> = {}) => {
          const { ydoc, isConnected } = get();
          if (!ydoc || !isConnected) {
            console.warn('Cannot add field: YJS document not available or not connected');
            return;
          }

          const field = createFormField(fieldType, fieldData);
          const formSchemaMap = ydoc.getMap('formSchema');
          const pagesArray = getOrCreatePagesArray(formSchemaMap);
          
          const pageIndex = pagesArray.toArray().findIndex(pageMap => pageMap.get('id') === pageId);
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

        addFieldAtIndex: (pageId: string, fieldType: FieldType, fieldData: Partial<FieldData>, insertIndex: number) => {
          const { ydoc, isConnected } = get();
          if (!ydoc || !isConnected) {
            console.warn('Cannot add field at index: YJS document not available or not connected');
            return;
          }

          const field = createFormField(fieldType, fieldData);
          const formSchemaMap = ydoc.getMap('formSchema');
          const pagesArray = getOrCreatePagesArray(formSchemaMap);
          
          const pageIndex = pagesArray.toArray().findIndex(pageMap => pageMap.get('id') === pageId);
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

        updateField: (pageId: string, fieldId: string, updates: Partial<FieldData>) => {
          const { ydoc, isConnected } = get();
          if (!ydoc || !isConnected) return;

          console.log(`🔄 FormBuilderStore - Updating field ${fieldId} in page ${pageId}:`, {
            updates,
            isRichTextUpdate: updates.content !== undefined,
            richTextContent: updates.content ? updates.content.substring(0, 100) + '...' : 'N/A'
          });

          const formSchemaMap = ydoc.getMap('formSchema');
          const pagesArray = getOrCreatePagesArray(formSchemaMap);
          
          const pageIndex = pagesArray.toArray().findIndex(pageMap => pageMap.get('id') === pageId);
          
          if (pageIndex === -1) return;

          const pageMap = pagesArray.get(pageIndex);
          const fieldsArray = pageMap.get('fields') as Y.Array<Y.Map<any>>;
          const fieldIndex = fieldsArray.toArray().findIndex(fieldMap => fieldMap.get('id') === fieldId);
          
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
            console.log(`📝 FormBuilderStore - Processing update key '${key}':`, {
              fieldId,
              key,
              value: key === 'content' ? (typeof value === 'string' ? value.substring(0, 100) + '...' : value) : value,
              valueType: typeof value,
              fieldType
            });
            
            if (key === 'options' && Array.isArray(value)) {
              const optionsArray = new Y.Array();
              value.filter(option => option && option.trim() !== '').forEach((option: string) => optionsArray.push([option]));
              fieldMap.set('options', optionsArray);
            } else if (key === 'defaultValue' && Array.isArray(value) && fieldType === FieldType.CHECKBOX_FIELD) {
              // Handle checkbox defaultValue arrays
              const defaultValueArray = new Y.Array();
              value.filter(val => val && val.trim() !== '').forEach((val: string) => defaultValueArray.push([val]));
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
            } else if (key === 'min' && (fieldType === FieldType.TEXT_INPUT_FIELD || fieldType === FieldType.TEXT_AREA_FIELD)) {
              // For text fields, min maps to minLength in validation (fallback for old format)
              validationMap.set('minLength', value);
            } else if (key === 'max' && (fieldType === FieldType.TEXT_INPUT_FIELD || fieldType === FieldType.TEXT_AREA_FIELD)) {
              // For text fields, max maps to maxLength in validation (fallback for old format)
              validationMap.set('maxLength', value);
            } else if (value !== undefined) {
              console.log(`✅ FormBuilderStore - Setting field property:`, { fieldId, key, value: key === 'content' ? `[${value.length} chars]` : value });
              fieldMap.set(key, value);
            }
          });
        },

        removeField: (pageId: string, fieldId: string) => {
          const { ydoc, isConnected } = get();
          if (!ydoc || !isConnected) return;

          const formSchemaMap = ydoc.getMap('formSchema');
          const pagesArray = formSchemaMap.get('pages') as Y.Array<Y.Map<any>>;
          
          if (!pagesArray) {
            console.warn('YJS formSchema pages array not found');
            return;
          }
          const pageIndex = pagesArray.toArray().findIndex(pageMap => pageMap.get('id') === pageId);
          
          if (pageIndex === -1) return;

          const pageMap = pagesArray.get(pageIndex);
          const fieldsArray = pageMap.get('fields') as Y.Array<Y.Map<any>>;
          const fieldIndex = fieldsArray.toArray().findIndex(fieldMap => fieldMap.get('id') === fieldId);
          
          if (fieldIndex !== -1) {
            fieldsArray.delete(fieldIndex, 1);
          }
        },

        reorderFields: (pageId: string, oldIndex: number, newIndex: number) => {
          const { ydoc, isConnected } = get();
          if (!ydoc || !isConnected) {
            console.warn('Cannot reorder fields: YJS document not available or not connected');
            return;
          }

          const formSchemaMap = ydoc.getMap('formSchema');
          const pagesArray = formSchemaMap.get('pages') as Y.Array<Y.Map<any>>;
          
          if (!pagesArray) {
            console.warn('Cannot reorder fields: pages array not found');
            return;
          }
          
          const pageIndex = pagesArray.toArray().findIndex(pageMap => pageMap.get('id') === pageId);
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
          
          if (oldIndex < 0 || oldIndex >= fieldsArray.length || newIndex < 0 || newIndex >= fieldsArray.length) {
            console.warn(`Invalid field reorder indices: oldIndex=${oldIndex}, newIndex=${newIndex}, fieldsLength=${fieldsArray.length}`);
            return;
          }
          
          if (oldIndex === newIndex) return;
          
          console.log(`Reordering field from index ${oldIndex} to ${newIndex} in page ${pageId}`);
          
          const allFields = fieldsArray.toArray().map(fieldMap => extractFieldData(fieldMap));
          
          const fieldToMove = allFields[oldIndex];
          allFields.splice(oldIndex, 1);
          allFields.splice(newIndex, 0, fieldToMove);
          
          fieldsArray.delete(0, fieldsArray.length);
          
          allFields.forEach(fieldData => {
            const fieldMap = createYJSFieldMap(fieldData);
            fieldsArray.push([fieldMap]);
          });
        },

        reorderPages: (oldIndex: number, newIndex: number) => {
          const { ydoc, isConnected } = get();
          if (!ydoc || !isConnected) {
            console.warn('Cannot reorder pages: YJS document not available or not connected');
            return;
          }

          const formSchemaMap = ydoc.getMap('formSchema');
          const pagesArray = formSchemaMap.get('pages') as Y.Array<Y.Map<any>>;
          
          if (!pagesArray) {
            console.warn('Cannot reorder pages: pages array not found');
            return;
          }
          
          if (oldIndex < 0 || oldIndex >= pagesArray.length || newIndex < 0 || newIndex >= pagesArray.length) {
            console.warn(`Invalid page reorder indices: oldIndex=${oldIndex}, newIndex=${newIndex}, pagesLength=${pagesArray.length}`);
            return;
          }
          
          if (oldIndex === newIndex) return;
          
          console.log(`Reordering page from index ${oldIndex} to ${newIndex}`);
          
          const allPages = pagesArray.toArray().map(pageMap => {
            const pageData: {
              id: string;
              title: string;
              description: string;
              fields: FieldData[];
            } = {
              id: pageMap.get('id'),
              title: pageMap.get('title'),
              description: pageMap.get('description') || '',
              fields: []
            };
            
            const fieldsArray = pageMap.get('fields') as Y.Array<Y.Map<any>>;
            if (fieldsArray) {
              pageData.fields = fieldsArray.toArray().map(fieldMap => extractFieldData(fieldMap));
            }
            
            return pageData;
          });
          
          const pageToMove = allPages[oldIndex];
          allPages.splice(oldIndex, 1);
          allPages.splice(newIndex, 0, pageToMove);
          
          pagesArray.delete(0, pagesArray.length);
          
          allPages.forEach((pageData, index) => {
            const pageMap = new Y.Map();
            pageMap.set('id', pageData.id);
            pageMap.set('title', pageData.title);
            pageMap.set('description', pageData.description);
            pageMap.set('order', index);
            
            const fieldsArray = new Y.Array();
            pageData.fields.forEach(fieldData => {
              const fieldMap = createYJSFieldMap(fieldData);
              fieldsArray.push([fieldMap]);
            });
            pageMap.set('fields', fieldsArray);
            
            pagesArray.push([pageMap]);
          });
        },

        duplicateField: (pageId: string, fieldId: string) => {
          const { ydoc, isConnected } = get();
          if (!ydoc || !isConnected) return;

          const formSchemaMap = ydoc.getMap('formSchema');
          const pagesArray = formSchemaMap.get('pages') as Y.Array<Y.Map<any>>;
          
          if (!pagesArray) return;
          
          const pageIndex = pagesArray.toArray().findIndex(pageMap => pageMap.get('id') === pageId);
          if (pageIndex === -1) return;

          const pageMap = pagesArray.get(pageIndex);
          const fieldsArray = pageMap.get('fields') as Y.Array<Y.Map<any>>;
          const fieldIndex = fieldsArray.toArray().findIndex(fieldMap => fieldMap.get('id') === fieldId);
          
          if (fieldIndex === -1) return;

          const originalFieldMap = fieldsArray.get(fieldIndex);
          const fieldData = extractFieldData(originalFieldMap);
          
          fieldData.id = `field-${Date.now()}-copy`;
          fieldData.label = `${fieldData.label} (Copy)`;
          
          const duplicateFieldMap = createYJSFieldMap(fieldData);
          fieldsArray.insert(fieldIndex + 1, [duplicateFieldMap]);
        },

        removePage: (pageId: string) => {
          const { ydoc, isConnected, pages, selectedPageId } = get();
          if (!ydoc || !isConnected || pages.length <= 1) return;

          const formSchemaMap = ydoc.getMap('formSchema');
          const pagesArray = formSchemaMap.get('pages') as Y.Array<Y.Map<any>>;
          
          if (!pagesArray) return;
          
          const pageIndex = pagesArray.toArray().findIndex(pageMap => pageMap.get('id') === pageId);
          if (pageIndex === -1) return;

          pagesArray.delete(pageIndex, 1);

          pagesArray.toArray().forEach((pageMap, index) => {
            pageMap.set('order', index);
          });

          if (selectedPageId === pageId) {
            const remainingPages = pagesArray.toArray();
            if (remainingPages.length > 0) {
              const newSelectedPageIndex = Math.max(0, pageIndex - 1);
              const newSelectedPageId = remainingPages[newSelectedPageIndex]?.get('id');
              if (newSelectedPageId) {
                set({ selectedPageId: newSelectedPageId, selectedFieldId: null });
              }
            }
          }
        },

        duplicatePage: (pageId: string) => {
          const { ydoc, isConnected } = get();
          if (!ydoc || !isConnected) return;

          const formSchemaMap = ydoc.getMap('formSchema');
          const pagesArray = formSchemaMap.get('pages') as Y.Array<Y.Map<any>>;

          if (!pagesArray) return;

          const pageIndex = pagesArray.toArray().findIndex(pageMap => pageMap.get('id') === pageId);
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
            fieldData.id = generateUniqueId();
            const duplicateFieldMap = createYJSFieldMap(fieldData);
            duplicateFieldsArray.push([duplicateFieldMap]);
          });

          duplicatePageMap.set('fields', duplicateFieldsArray);
          pagesArray.insert(pageIndex + 1, [duplicatePageMap]);

          pagesArray.toArray().forEach((pageMap, index) => {
            pageMap.set('order', index);
          });
        },

        updatePageTitle: (pageId: string, title: string) => {
          const { ydoc, isConnected } = get();
          if (!ydoc || !isConnected) {
            console.warn('Cannot update page title: YJS document not available or not connected');
            return;
          }

          const formSchemaMap = ydoc.getMap('formSchema');
          const pagesArray = getOrCreatePagesArray(formSchemaMap);

          const pageIndex = pagesArray.toArray().findIndex(pageMap => pageMap.get('id') === pageId);
          if (pageIndex === -1) {
            console.warn(`Page with id ${pageId} not found`);
            return;
          }

          const pageMap = pagesArray.get(pageIndex);
          pageMap.set('title', title);
        },

        moveFieldBetweenPages: (sourcePageId: string, targetPageId: string, fieldId: string, insertIndex?: number) => {
          const { ydoc, isConnected } = get();
          if (!ydoc || !isConnected) {
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
          const sourcePageIndex = pagesArray.toArray().findIndex(pageMap => pageMap.get('id') === sourcePageId);
          const targetPageIndex = pagesArray.toArray().findIndex(pageMap => pageMap.get('id') === targetPageId);

          if (sourcePageIndex === -1 || targetPageIndex === -1) {
            console.warn(`Page not found - source: ${sourcePageId}, target: ${targetPageId}`);
            return;
          }

          const sourcePageMap = pagesArray.get(sourcePageIndex);
          const targetPageMap = pagesArray.get(targetPageIndex);
          const sourceFieldsArray = sourcePageMap.get('fields') as Y.Array<Y.Map<any>>;
          const targetFieldsArray = targetPageMap.get('fields') as Y.Array<Y.Map<any>>;

          // Find the field to move
          const fieldIndex = sourceFieldsArray.toArray().findIndex(fieldMap => fieldMap.get('id') === fieldId);
          if (fieldIndex === -1) {
            console.warn(`Field ${fieldId} not found in source page ${sourcePageId}`);
            return;
          }

          // Extract the field data
          const fieldMap = sourceFieldsArray.get(fieldIndex);
          const fieldData = extractFieldData(fieldMap);

          console.log(`Moving field ${fieldId} from page ${sourcePageId} to page ${targetPageId} at index ${insertIndex || targetFieldsArray.length}`);

          // Remove field from source page
          sourceFieldsArray.delete(fieldIndex, 1);

          // Add field to target page at specified index
          const newFieldMap = createYJSFieldMap(fieldData);
          const safeInsertIndex = insertIndex !== undefined ? Math.max(0, Math.min(insertIndex, targetFieldsArray.length)) : targetFieldsArray.length;
          
          if (safeInsertIndex === targetFieldsArray.length) {
            targetFieldsArray.push([newFieldMap]);
          } else {
            targetFieldsArray.insert(safeInsertIndex, [newFieldMap]);
          }

          // Update selected field if it was the moved field
          const { selectedFieldId } = get();
          if (selectedFieldId === fieldId) {
            set({ selectedPageId: targetPageId });
          }
        },

        copyFieldToPage: (sourcePageId: string, targetPageId: string, fieldId: string) => {
          const { ydoc, isConnected } = get();
          if (!ydoc || !isConnected) {
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
          const sourcePageIndex = pagesArray.toArray().findIndex(pageMap => pageMap.get('id') === sourcePageId);
          const targetPageIndex = pagesArray.toArray().findIndex(pageMap => pageMap.get('id') === targetPageId);

          if (sourcePageIndex === -1 || targetPageIndex === -1) {
            console.warn(`Page not found - source: ${sourcePageId}, target: ${targetPageId}`);
            return;
          }

          const sourcePageMap = pagesArray.get(sourcePageIndex);
          const targetPageMap = pagesArray.get(targetPageIndex);
          const sourceFieldsArray = sourcePageMap.get('fields') as Y.Array<Y.Map<any>>;
          const targetFieldsArray = targetPageMap.get('fields') as Y.Array<Y.Map<any>>;

          // Find the field to copy
          const fieldIndex = sourceFieldsArray.toArray().findIndex(fieldMap => fieldMap.get('id') === fieldId);
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

        updateLayout: (layoutUpdates: Partial<FormLayout>) => {
          const { ydoc, isConnected, layout } = get();
          
          const updatedLayout: FormLayout = {
            ...layout,
            ...layoutUpdates
          };
          set({ layout: updatedLayout });
          
          if (ydoc && isConnected) {
            const formSchemaMap = ydoc.getMap('formSchema');
            let layoutMap = formSchemaMap.get('layout') as Y.Map<any>;
            
            if (!layoutMap) {
              layoutMap = new Y.Map();
              formSchemaMap.set('layout', layoutMap);
            }

            Object.entries(layoutUpdates).forEach(([key, value]) => {
              if (value !== undefined) {
                layoutMap.set(key, value);
              }
            });
          }
        },
        
        getSelectedField: (): FormField | null => {
          const { pages, selectedFieldId } = get();
          if (!selectedFieldId) return null;
          
          for (const page of pages) {
            const field = page.fields.find(f => f.id === selectedFieldId);
            if (field) return field;
          }
          return null;
        },
      };
    }),
    {
      name: 'form-builder-store',
    }
  )
);

if (typeof window !== 'undefined') {
  (window as any).useFormBuilderStore = useFormBuilderStore;
}
