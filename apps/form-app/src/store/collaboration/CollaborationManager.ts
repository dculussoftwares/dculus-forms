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

/**
 * Represents a collaborator's presence information
 */
export interface CollaboratorInfo {
  id: string;
  name: string;
  email?: string;
  color: string;
  pageId?: string;
  fieldId?: string;
}

type AwarenessCallback = (collaborators: CollaboratorInfo[]) => void;

/**
 * Generate a consistent color for a user based on their ID
 */
const generateUserColor = (userId: string): string => {
  const colors = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
    '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9'
  ];
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
};

export class CollaborationManager {
  private ydoc: Y.Doc | null = null;
  private provider: HocuspocusProvider | null = null;
  private observerCleanups: Array<() => void> = [];
  private pageObserverCleanups: Array<() => void> = [];
  private fieldObserverCleanups: Array<() => void> = [];
  private awarenessCallback: AwarenessCallback | null = null;
  private currentUserId: string | null = null;
  private currentUserName: string | null = null;
  private undoManager: Y.UndoManager | null = null;

  constructor(
    private readonly updateCallback: UpdateCallback,
    private readonly connectionCallback: ConnectionCallback,
    private readonly loadingCallback: LoadingCallback,
    awarenessCallback?: AwarenessCallback
  ) {
    this.awarenessCallback = awarenessCallback || null;
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
      const wsUrl = getWebSocketUrl();

      const authToken = localStorage.getItem('bearer_token');

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
    // Clean up all observer types
    this.fieldObserverCleanups.forEach(cleanup => cleanup());
    this.fieldObserverCleanups = [];
    this.pageObserverCleanups.forEach(cleanup => cleanup());
    this.pageObserverCleanups = [];
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
      this.updateFromYJS();
    };

    const onDisconnect = () => {
      this.connectionCallback(false);
    };

    const onSynced = () => {
      this.updateFromYJS();
      this.loadingCallback(false);
      this.setupUndoManager();
      this.setupAwarenessListener();
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


  /**
   * Set up awareness listener for tracking collaborators
   */
  private setupAwarenessListener(): void {
    if (!this.provider?.awareness || !this.awarenessCallback) return;

    const awareness = this.provider.awareness;

    const handleAwarenessChange = () => {
      const collaborators = this.getCollaborators();
      this.awarenessCallback?.(collaborators);
    };

    awareness.on('change', handleAwarenessChange);
    this.observerCleanups.push(() => awareness.off('change', handleAwarenessChange));

    // Trigger initial callback
    handleAwarenessChange();
  }

  /**
   * Get current collaborators from awareness
   */
  getCollaborators(): CollaboratorInfo[] {
    if (!this.provider?.awareness) return [];

    const awareness = this.provider.awareness;
    const states = awareness.getStates();
    const collaborators: CollaboratorInfo[] = [];

    states.forEach((state: any, clientId: number) => {
      if (clientId === awareness.clientID) return; // Skip self
      if (state.user) {
        collaborators.push({
          id: state.user.id || String(clientId),
          name: state.user.name || 'Anonymous',
          email: state.user.email,
          color: state.user.color || generateUserColor(String(clientId)),
          pageId: state.user.pageId,
          fieldId: state.user.fieldId,
        });
      }
    });

    return collaborators;
  }
  private setupObservers(): void {
    if (!this.ydoc) return;

    const formSchemaMap = this.ydoc.getMap('formSchema');

    const formSchemaObserver = (event: Y.YMapEvent<any>) => {
      this.updateFromYJS();

      if (event.keysChanged.has('pages')) {
        this.setupPageObservers();
      }
      if (event.keysChanged.has('layout')) {
        this.setupLayoutObserver();
      }
    };

    formSchemaMap.observe(formSchemaObserver);
    this.observerCleanups.push(() => formSchemaMap.unobserve(formSchemaObserver));

    this.setupPageObservers();
    this.setupLayoutObserver();
  }

  /**
   * Set up observer for layout map changes
   * This enables real-time sync of layout properties (background, colors, etc.)
   */
  private layoutObserverCleanup: (() => void) | null = null;

  private setupLayoutObserver(): void {
    if (!this.ydoc) return;

    // Clean up existing layout observer
    if (this.layoutObserverCleanup) {
      this.layoutObserverCleanup();
      this.layoutObserverCleanup = null;
    }

    const formSchemaMap = this.ydoc.getMap('formSchema');
    const layoutMap = formSchemaMap.get('layout') as Y.Map<any>;

    if (!layoutMap) return;

    const layoutObserver = () => {
      this.updateFromYJS();
    };

    layoutMap.observe(layoutObserver);
    this.layoutObserverCleanup = () => layoutMap.unobserve(layoutObserver);
    this.observerCleanups.push(() => {
      if (this.layoutObserverCleanup) {
        this.layoutObserverCleanup();
        this.layoutObserverCleanup = null;
      }
    });
  }

  private setupPageObservers(): void {
    if (!this.ydoc) return;

    // Clean up existing page observers before setting new ones
    this.pageObserverCleanups.forEach(cleanup => cleanup());
    this.pageObserverCleanups = [];

    const formSchemaMap = this.ydoc.getMap('formSchema');
    const pagesArray = formSchemaMap.get('pages') as Y.Array<Y.Map<any>>;

    if (!pagesArray) return;

    const pagesObserver = (_event: Y.YArrayEvent<Y.Map<any>>) => {
      this.updateFromYJS();
      this.setupFieldObservers();
    };

    pagesArray.observe(pagesObserver);
    this.pageObserverCleanups.push(() => pagesArray.unobserve(pagesObserver));

    // Add observers for each individual page map to detect property changes (e.g., title)
    pagesArray.toArray().forEach(pageMap => {
      const pageMapObserver = () => {
        this.updateFromYJS();
      };

      pageMap.observe(pageMapObserver);
      this.pageObserverCleanups.push(() => pageMap.unobserve(pageMapObserver));
    });

    this.setupFieldObservers();
  }

  private setupFieldObservers(): void {
    if (!this.ydoc) return;

    // Clean up existing field observers before setting new ones
    this.fieldObserverCleanups.forEach(cleanup => cleanup());
    this.fieldObserverCleanups = [];

    const formSchemaMap = this.ydoc.getMap('formSchema');
    const pagesArray = formSchemaMap.get('pages') as Y.Array<Y.Map<any>>;

    if (!pagesArray) return;

    pagesArray.toArray().forEach(pageMap => {
      const fieldsArray = pageMap.get('fields') as Y.Array<Y.Map<any>>;
      if (!fieldsArray) return;

      const fieldsObserver = () => {
        this.updateFromYJS();
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

      const fieldObserver = () => {
        this.updateFromYJS();
      };

      fieldMap.observe(fieldObserver);
      this.fieldObserverCleanups.push(() => fieldMap.unobserve(fieldObserver));

      const validationMap = fieldMap.get('validation');
      if (validationMap && validationMap instanceof Y.Map) {
        const validationObserver = () => {
          this.updateFromYJS();
        };
        validationMap.observe(validationObserver);
        this.fieldObserverCleanups.push(() => validationMap.unobserve(validationObserver));
      }
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

  /**
   * Set up undo manager for the form schema
   */
  private setupUndoManager(): void {
    if (!this.ydoc) return;

    const formSchemaMap = this.ydoc.getMap('formSchema');
    this.undoManager = new Y.UndoManager([formSchemaMap], {
      captureTimeout: 500,
      
    });
  }

  /**
   * Undo the last change
   */
  undo(): boolean {
    if (!this.undoManager) return false;
    if (this.undoManager.canUndo()) {
      this.undoManager.undo();
      return true;
    }
    return false;
  }

  /**
   * Redo the last undone change
   */
  redo(): boolean {
    if (!this.undoManager) return false;
    if (this.undoManager.canRedo()) {
      this.undoManager.redo();
      return true;
    }
    return false;
  }

  /**
   * Check if undo is available
   */
  canUndo(): boolean {
    return this.undoManager?.canUndo() ?? false;
  }

  /**
   * Check if redo is available
   */
  canRedo(): boolean {
    return this.undoManager?.canRedo() ?? false;
  }

  /**
   * Execute a transaction with the current user origin for per-user undo
   */
  transact(fn: () => void): void {
    if (!this.ydoc) return;
    const userId = this.currentUserId || 'local-user';
    this.ydoc.transact(fn, userId);
  }


  /**
   * Get the current user origin
   */
  getUserOrigin(): string {
    return this.currentUserId || 'local-user';
  }

  /**
   * Set the current user's information for awareness
   */
  setCurrentUser(userId: string, userName: string, email?: string): void {
    this.currentUserId = userId;
    this.currentUserName = userName;

    if (this.provider?.awareness) {
      this.provider.awareness.setLocalStateField('user', {
        id: userId,
        name: userName,
        email,
        color: generateUserColor(userId),
      });
    }
  }
}
