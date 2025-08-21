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
  FillableFormField,
  FillableFormFieldValidation,
  deserializeFormField,
  ThemeType,
  SpacingType,
  LayoutCode,
  PageModeType
} from '@dculus/types';

type FieldData = {
  id: string;
  type: FieldType;
  label?: string;
  required?: boolean;
  placeholder?: string;
  defaultValue?: string;
  prefix?: string;
  hint?: string;
  options?: string[];
  multiple?: boolean;
  min?: number;
  max?: number;
  minDate?: string;
  maxDate?: string;
};

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
  addField: (pageId: string, fieldType: FieldType, fieldData?: Partial<FieldData>) => void;
  addFieldAtIndex: (pageId: string, fieldType: FieldType, fieldData: Partial<FieldData>, insertIndex: number) => void;
  updateField: (pageId: string, fieldId: string, updates: Partial<FieldData>) => void;
  removeField: (pageId: string, fieldId: string) => void;
  reorderFields: (pageId: string, oldIndex: number, newIndex: number) => void;
  reorderPages: (oldIndex: number, newIndex: number) => void;
  duplicateField: (pageId: string, fieldId: string) => void;
  updateLayout: (layoutUpdates: Partial<FormLayout>) => void;
  
  getSelectedField: () => FormField | null;
}

const isFillableFormField = (field: FormField): field is FillableFormField => {
  return field instanceof FillableFormField || 
         (field as any).label !== undefined ||
         field.type !== FieldType.FORM_FIELD;
};

const extractFieldData = (fieldMap: Y.Map<any>): FieldData => {
  return {
    id: fieldMap.get('id') || '',
    type: fieldMap.get('type') || FieldType.TEXT_INPUT_FIELD,
    label: fieldMap.get('label') || '',
    required: fieldMap.get('required') || false,
    placeholder: fieldMap.get('placeholder') || '',
    defaultValue: fieldMap.get('defaultValue') || '',
    prefix: fieldMap.get('prefix') || '',
    hint: fieldMap.get('hint') || '',
    options: fieldMap.get('options') ? fieldMap.get('options').toArray() : undefined,
    multiple: fieldMap.get('multiple'),
    min: fieldMap.get('min'),
    max: fieldMap.get('max'),
    minDate: fieldMap.get('minDate'),
    maxDate: fieldMap.get('maxDate'),
  };
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
};

const generateUniqueId = (): string => {
  return `field-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
};

const createFormField = (fieldType: FieldType, fieldData: Partial<FieldData> = {}): FormField => {
  const fieldId = generateUniqueId();
  const validation = new FillableFormFieldValidation(fieldData.required || false);
  const config = FIELD_CONFIGS[fieldType] || { label: 'Field' };
  
  const label = fieldData.label || config.label;
  const defaultValue = fieldData.defaultValue || '';
  const prefix = fieldData.prefix || '';
  const hint = fieldData.hint || '';
  const placeholder = fieldData.placeholder || '';
  
  switch (fieldType) {
    case FieldType.TEXT_INPUT_FIELD:
      return new TextInputField(fieldId, label, defaultValue, prefix, hint, placeholder, validation);
    case FieldType.TEXT_AREA_FIELD:
      return new TextAreaField(fieldId, label, defaultValue, prefix, hint, placeholder, validation);
    case FieldType.EMAIL_FIELD:
      return new EmailField(fieldId, label, defaultValue, prefix, hint, placeholder, validation);
    case FieldType.NUMBER_FIELD:
      return new NumberField(fieldId, label, defaultValue, prefix, hint, placeholder, validation, fieldData.min, fieldData.max);
    case FieldType.SELECT_FIELD:
      return new SelectField(fieldId, label, defaultValue, prefix, hint, placeholder, validation, fieldData.options || [], fieldData.multiple || false);
    case FieldType.RADIO_FIELD:
      return new RadioField(fieldId, label, defaultValue, prefix, hint, placeholder, validation, fieldData.options || []);
    case FieldType.CHECKBOX_FIELD:
      return new CheckboxField(fieldId, label, defaultValue, prefix, hint, placeholder, validation, fieldData.options || []);
    case FieldType.DATE_FIELD:
      return new DateField(fieldId, label, defaultValue, prefix, hint, placeholder, validation, fieldData.minDate, fieldData.maxDate);
    default:
      return new FormField(fieldId);
  }
};

const serializeFieldToYMap = (field: FormField): Y.Map<any> => {
  if (!(field instanceof FillableFormField) && !isFillableFormField(field)) {
    const fieldMap = new Y.Map();
    fieldMap.set('id', field.id);
    fieldMap.set('type', field.type);
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
    multiple: fillableField.multiple,
    min: fillableField.min,
    max: fillableField.max,
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

const deserializePagesFromYJS = (pagesArray: Y.Array<Y.Map<any>>): FormPage[] => {
  return pagesArray.toArray().map((pageMap, index) => {
    const fieldsArray = pageMap.get('fields') as Y.Array<Y.Map<any>>;
    const pageId = pageMap.get('id') || `page-${index}`;

    const fields: FormField[] = fieldsArray 
      ? fieldsArray.toArray().map((fieldMap) => {
          const fieldData = extractFieldData(fieldMap);
          const validationObj = fieldMap.get('validation') || {
            required: fieldData.required,
            type: fieldData.type
          };
          return deserializeFormField({ ...fieldData, validation: validationObj });
        })
      : [];

    return {
      id: pageId,
      title: pageMap.get('title') || `Page ${index + 1}`,
      order: pageMap.get('order') ?? index,
      fields,
    };
  });
};

class CollaborationManager {
  private ydoc: Y.Doc | null = null;
  private provider: HocuspocusProvider | null = null;
  private observerCleanups: Array<() => void> = [];
  private updateCallback: (pages: FormPage[], layout?: FormLayout, isShuffleEnabled?: boolean) => void;
  private connectionCallback: (isConnected: boolean) => void;
  private loadingCallback: (isLoading: boolean) => void;

  constructor(
    updateCallback: (pages: FormPage[], layout?: FormLayout, isShuffleEnabled?: boolean) => void,
    connectionCallback: (isConnected: boolean) => void,
    loadingCallback: (isLoading: boolean) => void
  ) {
    this.updateCallback = updateCallback;
    this.connectionCallback = connectionCallback;
    this.loadingCallback = loadingCallback;
  }

  async initialize(formId: string): Promise<void> {
    if (!formId || formId.trim() === '') {
      throw new Error('Invalid formId provided');
    }

    this.disconnect();

    this.loadingCallback(true);
    this.connectionCallback(false);

    try {
      this.ydoc = new Y.Doc();
      this.provider = new HocuspocusProvider({
        url: 'ws://localhost:4000/collaboration',
        name: formId,
        document: this.ydoc,
      });

      this.setupConnectionHandlers();
      this.setupObservers();

    } catch (error) {
      console.error('Failed to initialize collaboration:', error);
      this.loadingCallback(false);
      this.connectionCallback(false);
      throw error;
    }
  }

  private setupConnectionHandlers(): void {
    if (!this.provider) return;

    const onConnect = () => {
      console.log('🔗 Collaboration connected');
      this.connectionCallback(true);
      this.updateFromYJS();
    };

    const onDisconnect = () => {
      console.log('🔗 Collaboration disconnected');
      this.connectionCallback(false);
    };

    const onSynced = () => {
      console.log('🔄 Document synced');
      this.updateFromYJS();
      this.loadingCallback(false);
    };

    this.provider.on('connect', onConnect);
    this.provider.on('disconnect', onDisconnect);
    this.provider.on('synced', onSynced);

    this.observerCleanups.push(() => {
      this.provider?.off('connect', onConnect);
      this.provider?.off('disconnect', onDisconnect);
      this.provider?.off('synced', onSynced);
    });
  }

  private setupObservers(): void {
    if (!this.ydoc) return;

    const formSchemaMap = this.ydoc.getMap('formSchema');

    const formSchemaObserver = (event: Y.YMapEvent<any>) => {
      console.log('📡 FormSchema changed:', event.keysChanged);
      this.updateFromYJS();

      if (event.keysChanged.has('pages')) {
        this.setupPageObservers();
      }
    };

    formSchemaMap.observe(formSchemaObserver);
    this.observerCleanups.push(() => formSchemaMap.unobserve(formSchemaObserver));

    this.setupPageObservers();
  }

  private setupPageObservers(): void {
    if (!this.ydoc) return;

    const formSchemaMap = this.ydoc.getMap('formSchema');
    const pagesArray = formSchemaMap.get('pages') as Y.Array<Y.Map<any>>;

    if (!pagesArray) return;

    const pagesObserver = (_event: Y.YArrayEvent<Y.Map<any>>) => {
      console.log('📡 Pages array changed');
      this.updateFromYJS();
      this.setupFieldObservers();
    };

    pagesArray.observe(pagesObserver);
    this.observerCleanups.push(() => pagesArray.unobserve(pagesObserver));

    this.setupFieldObservers();
  }

  private setupFieldObservers(): void {
    if (!this.ydoc) return;

    const formSchemaMap = this.ydoc.getMap('formSchema');
    const pagesArray = formSchemaMap.get('pages') as Y.Array<Y.Map<any>>;

    if (!pagesArray) return;

    pagesArray.toArray().forEach(pageMap => {
      const fieldsArray = pageMap.get('fields') as Y.Array<Y.Map<any>>;
      if (!fieldsArray) return;

      const fieldsObserver = () => {
        console.log('📡 Fields changed');
        this.updateFromYJS();
      };

      fieldsArray.observe(fieldsObserver);
      this.observerCleanups.push(() => fieldsArray.unobserve(fieldsObserver));

      fieldsArray.toArray().forEach(fieldMap => {
        const fieldObserver = () => {
          console.log('📡 Field properties changed');
          this.updateFromYJS();
        };

        fieldMap.observe(fieldObserver);
        this.observerCleanups.push(() => fieldMap.unobserve(fieldObserver));
      });
    });
  }

  private updateFromYJS(): void {
    if (!this.ydoc) return;

    const formSchemaMap = this.ydoc.getMap('formSchema');
    
    const pagesArray = formSchemaMap.get('pages') as Y.Array<Y.Map<any>>;
    const pages = pagesArray ? deserializePagesFromYJS(pagesArray) : [];

    const layoutMap = formSchemaMap.get('layout') as Y.Map<any>;
    let layout: FormLayout | undefined;
    
    if (layoutMap) {
      layout = {
        theme: layoutMap.get('theme') || ThemeType.LIGHT,
        textColor: layoutMap.get('textColor') || '#1f2937',
        spacing: layoutMap.get('spacing') || SpacingType.NORMAL,
        code: layoutMap.get('code') || '',
        content: layoutMap.get('content') || '',
        customBackGroundColor: layoutMap.get('customBackGroundColor') || '#ffffff',
        customCTAButtonName: layoutMap.get('customCTAButtonName') || 'Submit',
        backgroundImageKey: layoutMap.get('backgroundImageKey') || '',
        pageMode: layoutMap.get('pageMode') || PageModeType.SINGLE_PAGE
      };
    }

    const isShuffleEnabled = formSchemaMap.get('isShuffleEnabled') as boolean | undefined;

    this.updateCallback(pages, layout, isShuffleEnabled);
  }

  getYDoc(): Y.Doc | null {
    return this.ydoc;
  }

  isConnected(): boolean {
    return (this.provider as any)?.status === 'connected' || false;
  }

  disconnect(): void {
    this.observerCleanups.forEach(cleanup => cleanup());
    this.observerCleanups = [];

    if (this.provider) {
      this.provider.disconnect();
      this.provider = null;
    }

    if (this.ydoc) {
      this.ydoc.destroy();
      this.ydoc = null;
    }
  }
}

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
          pageMode: PageModeType.SINGLE_PAGE
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

          console.log(`🔄 Updating field ${fieldId} in page ${pageId}:`, updates);

          const formSchemaMap = ydoc.getMap('formSchema');
          const pagesArray = getOrCreatePagesArray(formSchemaMap);
          
          const pageIndex = pagesArray.toArray().findIndex(pageMap => pageMap.get('id') === pageId);
          
          if (pageIndex === -1) return;

          const pageMap = pagesArray.get(pageIndex);
          const fieldsArray = pageMap.get('fields') as Y.Array<Y.Map<any>>;
          const fieldIndex = fieldsArray.toArray().findIndex(fieldMap => fieldMap.get('id') === fieldId);
          
          if (fieldIndex === -1) return;

          const fieldMap = fieldsArray.get(fieldIndex);
          
          Object.entries(updates).forEach(([key, value]) => {
            if (key === 'options' && Array.isArray(value)) {
              const optionsArray = new Y.Array();
              value.filter(option => option && option.trim() !== '').forEach((option: string) => optionsArray.push([option]));
              fieldMap.set('options', optionsArray);
            } else if (value !== undefined) {
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