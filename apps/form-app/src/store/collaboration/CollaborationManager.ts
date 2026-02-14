import { HocuspocusProvider } from '@hocuspocus/provider';
import { getWebSocketUrl } from '../../lib/config';
import {
  deserializeFormField,
  FieldType,
  FormField,
  FormLayout,
  FormPage,
  PageModeType,
  SpacingType,
  ThemeType,
} from '@dculus/types';
import * as Y from 'yjs';

export type FieldData = {
  id: string;
  type: FieldType;
  label?: string;
  required?: boolean;
  placeholder?: string;
  defaultValue?: string;
  prefix?: string;
  hint?: string;
  options?: string[];
  min?: number;
  max?: number;
  minDate?: string;
  maxDate?: string;
  validation?: any;
  content?: string;
};

export const extractFieldData = (fieldMap: Y.Map<any>): FieldData => {
  const validationYMap = fieldMap.get('validation');
  let validation: any = null;

  if (validationYMap && validationYMap instanceof Y.Map) {
    validation = {
      required: validationYMap.get('required'),
      type: validationYMap.get('type'),
      minLength: validationYMap.get('minLength'),
      maxLength: validationYMap.get('maxLength'),
      minSelections: validationYMap.get('minSelections'),
      maxSelections: validationYMap.get('maxSelections'),
    };
  }

  let defaultValue = fieldMap.get('defaultValue') || '';
  const fieldType = fieldMap.get('type');

  if (fieldType === FieldType.CHECKBOX_FIELD) {
    const defaultValueData = fieldMap.get('defaultValue');
    if (defaultValueData && typeof defaultValueData.toArray === 'function') {
      defaultValue = defaultValueData.toArray();
    } else if (Array.isArray(defaultValueData)) {
      defaultValue = defaultValueData;
    } else if (typeof defaultValueData === 'string' && defaultValueData) {
      defaultValue = defaultValueData.split(',').map(s => s.trim()).filter(Boolean);
    } else {
      defaultValue = [];
    }
  }

  const result: FieldData = {
    id: fieldMap.get('id') || '',
    type: fieldType || FieldType.TEXT_INPUT_FIELD,
    label: fieldMap.get('label') || '',
    required: validation?.required || fieldMap.get('required') || false,
    placeholder: fieldMap.get('placeholder') || '',
    defaultValue,
    prefix: fieldMap.get('prefix') || '',
    hint: fieldMap.get('hint') || '',
    options: fieldMap.get('options') ? fieldMap.get('options').toArray() : undefined,
    min: validation?.minLength || fieldMap.get('min'),
    max: validation?.maxLength || fieldMap.get('max'),
    minDate: fieldMap.get('minDate'),
    maxDate: fieldMap.get('maxDate'),
    validation,
  };

  if (fieldType === FieldType.RICH_TEXT_FIELD) {
    const extractedContent = fieldMap.get('content') || '';
    console.log('📥 extractFieldData - Rich Text from YJS:', {
      fieldId: result.id,
      hasContent: !!fieldMap.get('content'),
      contentLength: extractedContent.length,
      content: `${extractedContent.substring(0, 100)}...`,
    });
    result.content = extractedContent;
  }

  return result;
};

const deserializePagesFromYJS = (pagesArray: Y.Array<Y.Map<any>>): FormPage[] => {
  return pagesArray.toArray().map((pageMap, index) => {
    const fieldsArray = pageMap.get('fields') as Y.Array<Y.Map<any>>;
    const pageId = pageMap.get('id') || `page-${index}`;

    const fields: FormField[] = fieldsArray
      ? fieldsArray.toArray().map(fieldMap => {
        const fieldData = extractFieldData(fieldMap);

        const validationYMap = fieldMap.get('validation');
        let validationObj: any;

        if (validationYMap && validationYMap instanceof Y.Map) {
          validationObj = {
            required: validationYMap.get('required') || false,
            type: validationYMap.get('type') || FieldType.FILLABLE_FORM_FIELD,
            minLength: validationYMap.get('minLength'),
            maxLength: validationYMap.get('maxLength'),
            minSelections: validationYMap.get('minSelections'),
            maxSelections: validationYMap.get('maxSelections'),
          };
        } else {
          validationObj = {
            required: fieldData.required,
            type:
              fieldData.type === FieldType.TEXT_INPUT_FIELD || fieldData.type === FieldType.TEXT_AREA_FIELD
                ? FieldType.TEXT_FIELD_VALIDATION
                : fieldData.type === FieldType.CHECKBOX_FIELD
                  ? FieldType.CHECKBOX_FIELD_VALIDATION
                  : FieldType.FILLABLE_FORM_FIELD,
            minLength: fieldData.min,
            maxLength: fieldData.max,
          };
        }

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

type UpdateCallback = (pages: FormPage[], layout?: FormLayout, isShuffleEnabled?: boolean) => void;
type ConnectionCallback = (isConnected: boolean) => void;
type LoadingCallback = (isLoading: boolean) => void;

export class CollaborationManager {
  private ydoc: Y.Doc | null = null;
  private provider: HocuspocusProvider | null = null;
  private observerCleanups: Array<() => void> = [];
  private pageObserverCleanups: Array<() => void> = [];
  private fieldObserverCleanups: Array<() => void> = [];
  private fieldObserverMap: Map<string, Array<() => void>> = new Map();
  private updateQueued = false;

  constructor(
    private readonly updateCallback: UpdateCallback,
    private readonly connectionCallback: ConnectionCallback,
    private readonly loadingCallback: LoadingCallback
  ) { }

  async initialize(formId: string): Promise<void> {
    if (!formId || formId.trim() === '') {
      throw new Error('Invalid formId provided');
    }

    this.disconnect();

    this.loadingCallback(true);
    this.connectionCallback(false);

    try {
      this.ydoc = new Y.Doc();
      const wsUrl = getWebSocketUrl();

      const authToken = localStorage.getItem('bearer_token');
      console.log('🔐 Initializing Hocuspocus with auth token:', !!authToken);

      this.provider = new HocuspocusProvider({
        url: wsUrl,
        name: formId,
        document: this.ydoc,
        token: authToken || undefined,
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

  disconnect(): void {
    this.observerCleanups.forEach(cleanup => cleanup());
    this.observerCleanups = [];
    this.clearPageObservers();
    this.clearFieldObservers();

    // Clean up all individual field observers
    this.fieldObserverMap.forEach(cleanups => {
      cleanups.forEach(cleanup => cleanup());
    });
    this.fieldObserverMap.clear();

    if (this.provider) {
      this.provider.disconnect();
      this.provider = null;
    }

    if (this.ydoc) {
      this.ydoc.destroy();
      this.ydoc = null;
    }
  }

  getYDoc(): Y.Doc | null {
    return this.ydoc;
  }

  isConnected(): boolean {
    return (this.provider as any)?.status === 'connected' || false;
  }

  private setupConnectionHandlers(): void {
    if (!this.provider) return;

    const onConnect = () => {
      console.log('🔗 Collaboration connected');
      this.connectionCallback(true);
      this.scheduleUpdateFromYJS();
    };

    const onDisconnect = () => {
      console.log('🔗 Collaboration disconnected');
      this.connectionCallback(false);
    };

    const onSynced = () => {
      console.log('🔄 Document synced');
      this.scheduleUpdateFromYJS();
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
      this.scheduleUpdateFromYJS();

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

    this.clearPageObservers();
    this.clearFieldObservers();

    const formSchemaMap = this.ydoc.getMap('formSchema');
    const pagesArray = formSchemaMap.get('pages') as Y.Array<Y.Map<any>>;

    if (!pagesArray) return;

    const pagesObserver = (_event: Y.YArrayEvent<Y.Map<any>>) => {
      this.scheduleUpdateFromYJS();
      this.setupFieldObservers();
    };

    pagesArray.observe(pagesObserver);
    this.pageObserverCleanups.push(() => pagesArray.unobserve(pagesObserver));

    // Add observers for each individual page map to detect property changes (e.g., title)
    pagesArray.toArray().forEach(pageMap => {
      const pageMapObserver = () => {
        this.scheduleUpdateFromYJS();
      };

      pageMap.observe(pageMapObserver);
      this.pageObserverCleanups.push(() => pageMap.unobserve(pageMapObserver));
    });

    this.setupFieldObservers();
  }

  private setupFieldObservers(): void {
    if (!this.ydoc) return;

    this.clearFieldObservers();

    const formSchemaMap = this.ydoc.getMap('formSchema');
    const pagesArray = formSchemaMap.get('pages') as Y.Array<Y.Map<any>>;

    if (!pagesArray) return;

    pagesArray.toArray().forEach(pageMap => {
      const fieldsArray = pageMap.get('fields') as Y.Array<Y.Map<any>>;
      if (!fieldsArray) return;

      const fieldsObserver = () => {
        console.log('📡 Fields array changed');
        this.scheduleUpdateFromYJS();
        this.setupIndividualFieldObservers(fieldsArray);
      };

      fieldsArray.observe(fieldsObserver);
      this.fieldObserverCleanups.push(() => fieldsArray.unobserve(fieldsObserver));

      this.setupIndividualFieldObservers(fieldsArray);
    });
  }

  private setupIndividualFieldObservers(fieldsArray: Y.Array<Y.Map<any>>): void {
    fieldsArray.toArray().forEach(fieldMap => {
      const fieldId = fieldMap.get('id');
      if (!fieldId) return;

      // Clean up existing observers for this field
      const existingCleanups = this.fieldObserverMap.get(fieldId);
      if (existingCleanups) {
        existingCleanups.forEach(cleanup => cleanup());
      }

      const cleanups: Array<() => void> = [];

      // Observer for field properties
      const fieldObserver = () => {
        console.log(`📡 Field ${fieldId} properties changed`);
        this.scheduleUpdateFromYJS();
      };
      fieldMap.observe(fieldObserver);
      cleanups.push(() => fieldMap.unobserve(fieldObserver));

      // Observer for validation sub-map
      const validationMap = fieldMap.get('validation');
      if (validationMap && validationMap instanceof Y.Map) {
        const validationObserver = () => {
          console.log(`📡 Field ${fieldId} validation changed`);
          this.scheduleUpdateFromYJS();
        };
        validationMap.observe(validationObserver);
        cleanups.push(() => validationMap.unobserve(validationObserver));
      }

      // Store cleanups by field ID for surgical removal
      this.fieldObserverMap.set(fieldId, cleanups);
    });
  }

  private clearPageObservers(): void {
    this.pageObserverCleanups.forEach(cleanup => cleanup());
    this.pageObserverCleanups = [];
  }

  private clearFieldObservers(): void {
    this.fieldObserverCleanups.forEach(cleanup => cleanup());
    this.fieldObserverCleanups = [];
  }

  private scheduleUpdateFromYJS(): void {
    if (this.updateQueued) return;
    this.updateQueued = true;

    queueMicrotask(() => {
      this.updateQueued = false;
      this.updateFromYJS();
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
        pageMode: layoutMap.get('pageMode') || PageModeType.MULTIPAGE,
        isCustomBackgroundColorEnabled: layoutMap.get('isCustomBackgroundColorEnabled') || false,
      };
    }

    const isShuffleEnabled = formSchemaMap.get('isShuffleEnabled') as boolean | undefined;

    this.updateCallback(pages, layout, isShuffleEnabled);
  }
}
