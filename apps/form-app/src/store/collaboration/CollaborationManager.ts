import { HocuspocusProvider } from '@hocuspocus/provider';
import { getWebSocketUrl } from '../../lib/config';
import { getBearerToken } from '../../lib/auth-client';
import {
  ConditionalRule,
  deserializeFormField,
  FieldType,
  FormField,
  FormLayout,
  FormPage,
  sanitizeConditions,
} from '@dculus/types';
import * as Y from 'yjs';
import { DEFAULT_LAYOUT } from '../helpers/defaultLayout';

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
  allowedMimeTypes?: string[];
  maxFileSizeMb?: number;
  maxFiles?: number;
  defaultCountry?: string;
  deleted?: boolean;
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
      defaultValue = defaultValueData
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
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
    options: fieldMap.get('options')
      ? fieldMap.get('options').toArray()
      : undefined,
    min: validation?.minLength || fieldMap.get('min'),
    max: validation?.maxLength || fieldMap.get('max'),
    minDate: fieldMap.get('minDate'),
    maxDate: fieldMap.get('maxDate'),
    validation,
    allowedMimeTypes: fieldMap.get('allowedMimeTypes')
      ? fieldMap.get('allowedMimeTypes').toArray()
      : undefined,
    maxFileSizeMb: fieldMap.get('maxFileSizeMb'),
    maxFiles: fieldMap.get('maxFiles'),
    defaultCountry: fieldMap.get('defaultCountry') || undefined,
    deleted: fieldMap.get('deleted') || undefined,
  };

  if (fieldType === FieldType.RICH_TEXT_FIELD) {
    result.content = fieldMap.get('content') || '';
  }

  if (fieldType === FieldType.FILE_UPLOAD_FIELD) {
    const allowedMimeTypesData = fieldMap.get('allowedMimeTypes');
    if (
      allowedMimeTypesData &&
      typeof allowedMimeTypesData.toArray === 'function'
    ) {
      result.allowedMimeTypes = allowedMimeTypesData.toArray();
    } else if (Array.isArray(allowedMimeTypesData)) {
      result.allowedMimeTypes = allowedMimeTypesData;
    }
    result.maxFileSizeMb = fieldMap.get('maxFileSizeMb');
    result.maxFiles = fieldMap.get('maxFiles');
  }

  return result;
};

const deserializePagesFromYJS = (
  pagesArray: Y.Array<Y.Map<any>>
): FormPage[] => {
  return pagesArray.toArray().map((pageMap, index) => {
    const fieldsArray = pageMap.get('fields') as Y.Array<Y.Map<any>>;
    const pageId = pageMap.get('id') || `page-${index}`;

    const fields: FormField[] = fieldsArray
      ? fieldsArray.toArray().map((fieldMap) => {
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
                fieldData.type === FieldType.TEXT_INPUT_FIELD ||
                fieldData.type === FieldType.TEXT_AREA_FIELD
                  ? FieldType.TEXT_FIELD_VALIDATION
                  : fieldData.type === FieldType.CHECKBOX_FIELD
                    ? FieldType.CHECKBOX_FIELD_VALIDATION
                    : FieldType.FILLABLE_FORM_FIELD,
              minLength: fieldData.min,
              maxLength: fieldData.max,
            };
          }

          const field = deserializeFormField({
            ...fieldData,
            validation: validationObj,
          });
          if (field && fieldData.deleted) field.deleted = true;
          return field;
        })
        .filter((f): f is FormField => f !== null && !f.deleted)
      : [];

    return {
      id: pageId,
      title: pageMap.get('title') || `Page ${index + 1}`,
      order: pageMap.get('order') ?? index,
      fields,
    };
  });
};

type UpdateCallback = (
  pages: FormPage[],
  layout?: FormLayout,
  isShuffleEnabled?: boolean,
  conditions?: ConditionalRule[]
) => void;
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
  ) {}

  async initialize(formId: string): Promise<void> {
    if (!formId || formId.trim() === '') {
      throw new Error('Invalid formId provided');
    }

    this.disconnect();

    this.loadingCallback(true);
    this.connectionCallback(false);

    try {
      if (!formId || formId.trim() === '') {
        throw new Error('CollaborationManager: formId must be a non-empty string');
      }
      // Sanitize to alphanumeric + hyphen/underscore — prevents malformed WebSocket paths
      const safeDocumentName = formId.replace(/[^a-zA-Z0-9_-]/g, '');
      if (!safeDocumentName) {
        throw new Error(`CollaborationManager: formId "${formId}" contains no valid characters`);
      }

      this.ydoc = new Y.Doc();
      const wsUrl = getWebSocketUrl();

      const authToken = getBearerToken();

      this.provider = new HocuspocusProvider({
        url: wsUrl,
        name: safeDocumentName,
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
    this.observerCleanups.forEach((cleanup) => cleanup());
    this.observerCleanups = [];
    this.clearPageObservers();
    this.clearFieldObservers();

    // Clean up all individual field observers
    this.fieldObserverMap.forEach((cleanups) => {
      cleanups.forEach((cleanup) => cleanup());
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
      this.connectionCallback(true);
      this.scheduleUpdateFromYJS();
    };

    const onDisconnect = () => {
      this.connectionCallback(false);
    };

    const onSynced = () => {
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
      this.scheduleUpdateFromYJS();

      if (event.keysChanged.has('pages')) {
        this.setupPageObservers();
      }
      if (event.keysChanged.has('conditions')) {
        this.setupConditionsObserver();
      }
    };

    formSchemaMap.observe(formSchemaObserver);
    this.observerCleanups.push(() =>
      formSchemaMap.unobserve(formSchemaObserver)
    );

    this.setupPageObservers();
    this.setupConditionsObserver();
  }

  private conditionsObserverCleanup: (() => void) | null = null;

  // Rules are plain JSON entries, so a single array observer covers every
  // change (rule edits are whole-entry delete+insert operations)
  private setupConditionsObserver(): void {
    if (!this.ydoc) return;

    this.conditionsObserverCleanup?.();
    this.conditionsObserverCleanup = null;

    const conditionsArray = this.ydoc.getMap('formSchema').get('conditions');
    if (!(conditionsArray instanceof Y.Array)) return;

    const conditionsObserver = () => {
      this.scheduleUpdateFromYJS();
    };
    conditionsArray.observe(conditionsObserver);
    this.conditionsObserverCleanup = () =>
      conditionsArray.unobserve(conditionsObserver);
    this.observerCleanups.push(() => {
      this.conditionsObserverCleanup?.();
      this.conditionsObserverCleanup = null;
    });
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
    pagesArray.toArray().forEach((pageMap) => {
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

    pagesArray.toArray().forEach((pageMap) => {
      const fieldsArray = pageMap.get('fields') as Y.Array<Y.Map<any>>;
      if (!fieldsArray) return;

      const fieldsObserver = () => {
        this.scheduleUpdateFromYJS();
        this.setupIndividualFieldObservers(fieldsArray);
      };

      fieldsArray.observe(fieldsObserver);
      this.fieldObserverCleanups.push(() =>
        fieldsArray.unobserve(fieldsObserver)
      );

      this.setupIndividualFieldObservers(fieldsArray);
    });
  }

  private setupIndividualFieldObservers(
    fieldsArray: Y.Array<Y.Map<any>>
  ): void {
    fieldsArray.toArray().forEach((fieldMap) => {
      const fieldId = fieldMap.get('id');
      if (!fieldId) return;

      // Clean up existing observers for this field
      const existingCleanups = this.fieldObserverMap.get(fieldId);
      if (existingCleanups) {
        existingCleanups.forEach((cleanup) => cleanup());
      }

      const cleanups: Array<() => void> = [];

      // Observer for field properties
      const fieldObserver = () => {
        this.scheduleUpdateFromYJS();
      };
      fieldMap.observe(fieldObserver);
      cleanups.push(() => fieldMap.unobserve(fieldObserver));

      // Observer for validation sub-map
      const validationMap = fieldMap.get('validation');
      if (validationMap && validationMap instanceof Y.Map) {
        const validationObserver = () => {
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
    this.pageObserverCleanups.forEach((cleanup) => cleanup());
    this.pageObserverCleanups = [];
  }

  private clearFieldObservers(): void {
    this.fieldObserverCleanups.forEach((cleanup) => cleanup());
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
      // Fall back to DEFAULT_LAYOUT values so this stays in sync with layoutSlice
      layout = {
        theme: layoutMap.get('theme') || DEFAULT_LAYOUT.theme,
        textColor: layoutMap.get('textColor') || DEFAULT_LAYOUT.textColor,
        spacing: layoutMap.get('spacing') || DEFAULT_LAYOUT.spacing,
        code: layoutMap.get('code') || DEFAULT_LAYOUT.code,
        content: layoutMap.get('content') || DEFAULT_LAYOUT.content,
        customBackGroundColor:
          layoutMap.get('customBackGroundColor') || DEFAULT_LAYOUT.customBackGroundColor,
        customCTAButtonName:
          layoutMap.get('customCTAButtonName') || DEFAULT_LAYOUT.customCTAButtonName,
        backgroundImageKey: layoutMap.get('backgroundImageKey') || DEFAULT_LAYOUT.backgroundImageKey,
        backgroundVideoKey: layoutMap.get('backgroundVideoKey') || DEFAULT_LAYOUT.backgroundVideoKey,
        backgroundDominantColor:
          layoutMap.get('backgroundDominantColor') || DEFAULT_LAYOUT.backgroundDominantColor,
        pageMode: layoutMap.get('pageMode') || DEFAULT_LAYOUT.pageMode,
        isCustomBackgroundColorEnabled:
          layoutMap.get('isCustomBackgroundColorEnabled') ?? DEFAULT_LAYOUT.isCustomBackgroundColorEnabled,
      };
    }

    const isShuffleEnabled = formSchemaMap.get('isShuffleEnabled') as
      | boolean
      | undefined;

    const conditionsArray = formSchemaMap.get('conditions');
    const conditions =
      sanitizeConditions(
        conditionsArray instanceof Y.Array ? conditionsArray.toJSON() : undefined
      ) ?? [];

    this.updateCallback(pages, layout, isShuffleEnabled, conditions);
  }
}
