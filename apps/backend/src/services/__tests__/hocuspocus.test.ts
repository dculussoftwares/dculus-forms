import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createHocuspocusServer, getFormSchemaFromHocuspocus, initializeHocuspocusDocument } from '../hocuspocus.js';
import { extractFormStatsFromYDoc, updateFormMetadata } from '../formMetadataService.js';
import { checkFormAccess, PermissionLevel } from '../../graphql/resolvers/formSharing.js';
import { auth } from '../../lib/better-auth.js';
import { collaborativeDocumentRepository } from '../../repositories/index.js';
import { logger } from '../../lib/logger.js';
import * as Y from 'yjs';

// Mock all dependencies
vi.mock('../formMetadataService.js');
vi.mock('../../graphql/resolvers/formSharing.js');
vi.mock('../../lib/better-auth.js');
vi.mock('../../repositories/index.js');
vi.mock('../../lib/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

describe('Hocuspocus Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('createHocuspocusServer', () => {
    it('should create a Hocuspocus server instance', () => {
      const server = createHocuspocusServer();
      expect(server).toBeDefined();
      expect(server.configuration).toBeDefined();
    });

    it('should configure the server with quiet mode', () => {
      const server = createHocuspocusServer();
      expect(server.configuration.quiet).toBe(true);
    });

    it('should include Database extension', () => {
      const server = createHocuspocusServer();
      expect(server.configuration.extensions).toBeDefined();
      expect(server.configuration.extensions.length).toBeGreaterThan(0);
    });
  });

  describe('Database Extension - fetch', () => {
    it('should fetch existing document from repository', async () => {
      const mockState = Buffer.from([1, 2, 3, 4, 5]);
      const mockDocument = {
        id: 'collab-form-123',
        documentName: 'form-123',
        state: mockState,
        updatedAt: new Date('2024-01-01'),
      };

      vi.mocked(collaborativeDocumentRepository.fetchDocumentWithState).mockResolvedValue(mockDocument as any);

      const server = createHocuspocusServer();
      const databaseExtension = server.configuration.extensions[0];
      const result = await (databaseExtension as any).configuration.fetch({ documentName: 'form-123' });

      expect(collaborativeDocumentRepository.fetchDocumentWithState).toHaveBeenCalledWith('form-123');
      expect(result).toBeInstanceOf(Uint8Array);
      expect(Array.from(result as Uint8Array)).toEqual([1, 2, 3, 4, 5]);
      expect(logger.info).toHaveBeenCalledWith('🔍 [Hocuspocus] Fetching document: form-123');
    });

    it('should return null when document not found', async () => {
      vi.mocked(collaborativeDocumentRepository.fetchDocumentWithState).mockResolvedValue(null);
      vi.mocked(collaborativeDocumentRepository.listDocumentNames).mockResolvedValue([]);

      const server = createHocuspocusServer();
      const databaseExtension = server.configuration.extensions[0];
      const result = await (databaseExtension as any).configuration.fetch({ documentName: 'nonexistent' });

      expect(result).toBeNull();
      expect(logger.info).toHaveBeenCalledWith('❌ [Hocuspocus] Document not found for: nonexistent');
    });

    it('should handle fetch errors gracefully', async () => {
      const error = new Error('Database connection failed');
      vi.mocked(collaborativeDocumentRepository.fetchDocumentWithState).mockRejectedValue(error);

      const server = createHocuspocusServer();
      const databaseExtension = server.configuration.extensions[0];
      const result = await (databaseExtension as any).configuration.fetch({ documentName: 'form-123' });

      expect(result).toBeNull();
      expect(logger.error).toHaveBeenCalledWith('💥 [Hocuspocus] Error fetching document form-123:', error);
    });
  });

  describe('Database Extension - store', () => {
    it('should store document state to repository', async () => {
      const mockState = new Uint8Array([1, 2, 3, 4, 5]);
      vi.mocked(collaborativeDocumentRepository.saveDocumentState).mockResolvedValue(undefined as any);

      const server = createHocuspocusServer();
      const databaseExtension = server.configuration.extensions[0];
      await (databaseExtension as any).configuration.store({ documentName: 'form-123', state: mockState });

      expect(collaborativeDocumentRepository.saveDocumentState).toHaveBeenCalledWith(
        'form-123',
        expect.any(Buffer),
        expect.any(Function)
      );
      expect(logger.info).toHaveBeenCalledWith('[Hocuspocus] Storing document form-123 with state length: 5');
    });

    it('should handle store errors without throwing', async () => {
      const error = new Error('Storage failed');
      const mockState = new Uint8Array([1, 2, 3]);
      vi.mocked(collaborativeDocumentRepository.saveDocumentState).mockRejectedValue(error);

      const server = createHocuspocusServer();
      const databaseExtension = server.configuration.extensions[0];

      // Should not throw
      await expect(
        (databaseExtension as any).configuration.store({ documentName: 'form-123', state: mockState })
      ).resolves.not.toThrow();

      expect(logger.error).toHaveBeenCalledWith('[Hocuspocus] Error storing document form-123:', error);
    });
  });

  describe('onAuthenticate hook', () => {
    const mockUser = {
      id: 'user-123',
      email: 'test@example.com',
      name: 'Test User',
    };

    const mockAccessCheck = {
      hasAccess: true,
      permission: PermissionLevel.EDITOR,
      form: { id: 'form-123', title: 'Test Form' },
    };

    beforeEach(() => {
      vi.mocked(auth.api.getSession).mockResolvedValue({
        session: { id: 'session-123' } as any,
        user: mockUser,
      } as any);
      vi.mocked(checkFormAccess).mockResolvedValue(mockAccessCheck as any);
    });

    it('should authenticate user with valid Bearer token', async () => {
      const server = createHocuspocusServer();
      const result = await server.configuration.onAuthenticate!({
        documentName: 'form-123',
        token: 'Bearer valid-token-123',
        requestHeaders: new Headers(),
        requestParameters: new URLSearchParams(),
      } as any);

      expect(auth.api.getSession).toHaveBeenCalled();
      expect(checkFormAccess).toHaveBeenCalledWith('user-123', 'form-123', PermissionLevel.VIEWER);
      expect(result).toEqual({
        user: {
          id: 'user-123',
          email: 'test@example.com',
          permission: PermissionLevel.EDITOR,
          formId: 'form-123',
        },
      });
    });

    it('should extract token from URL parameters', async () => {
      const requestParameters = new URLSearchParams();
      requestParameters.set('token', 'url-token-123');

      const server = createHocuspocusServer();
      await server.configuration.onAuthenticate!({
        documentName: 'form-123',
        token: undefined,
        requestHeaders: new Headers(),
        requestParameters,
      } as any);

      expect(auth.api.getSession).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith('🔍 [onAuthenticate] Found token in URL parameters');
    });

    it('should extract token from Authorization header', async () => {
      const requestHeaders = new Headers();
      requestHeaders.set('authorization', 'Bearer header-token-123');

      const server = createHocuspocusServer();
      await server.configuration.onAuthenticate!({
        documentName: 'form-123',
        token: undefined,
        requestHeaders,
        requestParameters: new URLSearchParams(),
      } as any);

      expect(auth.api.getSession).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith('🔍 [onAuthenticate] Found token in Authorization header');
    });

    it('should throw error when no token provided', async () => {
      vi.mocked(auth.api.getSession).mockResolvedValue(null as any);

      const server = createHocuspocusServer();

      await expect(
        server.configuration.onAuthenticate!({
          documentName: 'form-123',
          token: undefined,
          requestHeaders: new Headers(),
          requestParameters: new URLSearchParams(),
        } as any)
      ).rejects.toThrow();
    });

    it('should throw error when session is invalid', async () => {
      vi.mocked(auth.api.getSession).mockResolvedValue({ user: null } as any);

      const server = createHocuspocusServer();

      await expect(
        server.configuration.onAuthenticate!({
          documentName: 'form-123',
          token: 'Bearer invalid-token',
          requestHeaders: new Headers(),
          requestParameters: new URLSearchParams(),
        } as any)
      ).rejects.toThrow('Invalid or expired session');
    });

    it('should throw error when user lacks form access', async () => {
      vi.mocked(checkFormAccess).mockResolvedValue({
        hasAccess: false,
        permission: PermissionLevel.NO_ACCESS,
        form: null,
      } as any);

      const server = createHocuspocusServer();

      await expect(
        server.configuration.onAuthenticate!({
          documentName: 'form-123',
          token: 'Bearer valid-token',
          requestHeaders: new Headers(),
          requestParameters: new URLSearchParams(),
        } as any)
      ).rejects.toThrow('Access denied: Insufficient permissions for form form-123');
    });

    it('should throw error when documentName is empty', async () => {
      const server = createHocuspocusServer();

      await expect(
        server.configuration.onAuthenticate!({
          documentName: '',
          token: 'Bearer valid-token',
          requestHeaders: new Headers(),
          requestParameters: new URLSearchParams(),
        } as any)
      ).rejects.toThrow('Document name is required');
    });
  });

  describe('onConnect hook', () => {
    it('should log connection event', async () => {
      const server = createHocuspocusServer();
      await server.configuration.onConnect!({ documentName: 'form-123' } as any);

      expect(logger.info).toHaveBeenCalledWith('🔌 [onConnect] Called with:', {
        documentName: 'form-123',
        restKeys: expect.any(Array),
      });
      expect(logger.info).toHaveBeenCalledWith('🔌 User connected to document: "form-123"');
    });
  });

  describe('onDisconnect hook', () => {
    it('should log disconnection event', async () => {
      const server = createHocuspocusServer();
      await server.configuration.onDisconnect!({ documentName: 'form-123' } as any);

      expect(logger.info).toHaveBeenCalledWith('🔌 [onDisconnect] Called with:', {
        documentName: 'form-123',
        restKeys: expect.any(Array),
      });
      expect(logger.info).toHaveBeenCalledWith('🔌 User disconnected from document: "form-123"');
    });
  });

  describe('onChange hook', () => {
    const mockDoc = new Y.Doc();
    const mockStats = { pageCount: 1, fieldCount: 5, backgroundImageKey: null };

    beforeEach(() => {
      vi.mocked(extractFormStatsFromYDoc).mockReturnValue(mockStats);
      vi.mocked(updateFormMetadata).mockResolvedValue(undefined);
    });

    it('should ignore changes from VIEWER users', async () => {
      const server = createHocuspocusServer();
      await server.configuration.onChange!({
        documentName: 'form-123',
        document: mockDoc,
        context: {
          user: {
            email: 'viewer@example.com',
            permission: PermissionLevel.VIEWER,
          },
        },
      } as any);

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('VIEWER user viewer@example.com attempted to modify form')
      );
      expect(extractFormStatsFromYDoc).not.toHaveBeenCalled();
    });

    it('should process changes from EDITOR users with debouncing', async () => {
      const server = createHocuspocusServer();
      await server.configuration.onChange!({
        documentName: 'form-123',
        document: mockDoc,
        context: {
          user: {
            email: 'editor@example.com',
            permission: PermissionLevel.EDITOR,
          },
        },
      } as any);

      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Processing changes for form form-123 by user editor@example.com')
      );

      // Fast-forward timers to trigger debounced update
      await vi.runAllTimersAsync();

      expect(extractFormStatsFromYDoc).toHaveBeenCalledWith(mockDoc);
      expect(updateFormMetadata).toHaveBeenCalledWith('form-123', mockStats);
      expect(logger.info).toHaveBeenCalledWith('✅ [Metadata] Updated for form form-123:', mockStats);
    });

    it('should process changes from OWNER users', async () => {
      const server = createHocuspocusServer();
      await server.configuration.onChange!({
        documentName: 'form-123',
        document: mockDoc,
        context: {
          user: {
            email: 'owner@example.com',
            permission: PermissionLevel.OWNER,
          },
        },
      } as any);

      await vi.runAllTimersAsync();

      expect(extractFormStatsFromYDoc).toHaveBeenCalledWith(mockDoc);
      expect(updateFormMetadata).toHaveBeenCalledWith('form-123', mockStats);
    });

    it('should debounce multiple rapid changes', async () => {
      const server = createHocuspocusServer();

      // Trigger multiple changes rapidly
      await server.configuration.onChange!({
        documentName: 'form-123',
        document: mockDoc,
        context: { user: { email: 'editor@example.com', permission: PermissionLevel.EDITOR } },
      } as any);

      await server.configuration.onChange!({
        documentName: 'form-123',
        document: mockDoc,
        context: { user: { email: 'editor@example.com', permission: PermissionLevel.EDITOR } },
      } as any);

      await server.configuration.onChange!({
        documentName: 'form-123',
        document: mockDoc,
        context: { user: { email: 'editor@example.com', permission: PermissionLevel.EDITOR } },
      } as any);

      // Should only schedule one update
      await vi.runAllTimersAsync();

      // Should only call once due to debouncing
      expect(updateFormMetadata).toHaveBeenCalledTimes(1);
    });

    it('should handle metadata update errors gracefully', async () => {
      const error = new Error('Metadata update failed');
      vi.mocked(updateFormMetadata).mockRejectedValue(error);

      const server = createHocuspocusServer();
      await server.configuration.onChange!({
        documentName: 'form-123',
        document: mockDoc,
        context: { user: { email: 'editor@example.com', permission: PermissionLevel.EDITOR } },
      } as any);

      await vi.runAllTimersAsync();

      expect(logger.error).toHaveBeenCalledWith('❌ [Metadata] Failed to update for form form-123:', error);
    });
  });

  describe('getFormSchemaFromHocuspocus', () => {
    it('should retrieve and reconstruct form schema from collaborative document', async () => {
      // Create a YJS document with form schema
      const doc = new Y.Doc();
      const formSchemaMap = doc.getMap('formSchema');

      const pagesArray = new Y.Array();
      const pageMap = new Y.Map();
      pageMap.set('id', 'page-1');
      pageMap.set('title', 'Page 1');
      pageMap.set('order', 0);

      const fieldsArray = new Y.Array();
      const fieldMap = new Y.Map();
      fieldMap.set('id', 'field-1');
      fieldMap.set('type', 'text_input_field');
      fieldMap.set('label', 'Name');
      fieldMap.set('defaultValue', '');
      fieldMap.set('required', true);
      fieldsArray.push([fieldMap]);

      pageMap.set('fields', fieldsArray);
      pagesArray.push([pageMap]);
      formSchemaMap.set('pages', pagesArray);

      const layoutMap = new Y.Map();
      layoutMap.set('theme', 'dark');
      layoutMap.set('textColor', '#ffffff');
      layoutMap.set('spacing', 'spacious');
      formSchemaMap.set('layout', layoutMap);
      formSchemaMap.set('isShuffleEnabled', false);

      const state = Y.encodeStateAsUpdate(doc);

      vi.mocked(collaborativeDocumentRepository.fetchDocumentWithState).mockResolvedValue({
        id: 'collab-form-123',
        documentName: 'form-123',
        state: Buffer.from(state),
        updatedAt: new Date(),
      } as any);

      const result = await getFormSchemaFromHocuspocus('form-123');

      expect(result).toBeDefined();
      expect(result.pages).toHaveLength(1);
      expect(result.pages[0].title).toBe('Page 1');
      expect(result.pages[0].fields).toHaveLength(1);
      expect(result.pages[0].fields[0].label).toBe('Name');
      expect(result.layout.theme).toBe('dark');
      expect(result.isShuffleEnabled).toBe(false);
    });

    it('should handle rich text fields correctly', async () => {
      const doc = new Y.Doc();
      const formSchemaMap = doc.getMap('formSchema');

      const pagesArray = new Y.Array();
      const pageMap = new Y.Map();
      pageMap.set('id', 'page-1');
      pageMap.set('title', 'Page 1');
      pageMap.set('order', 0);

      const fieldsArray = new Y.Array();
      const richTextField = new Y.Map();
      richTextField.set('id', 'field-1');
      richTextField.set('type', 'rich_text_field');
      richTextField.set('content', '<p>Rich text content</p>');
      fieldsArray.push([richTextField]);

      pageMap.set('fields', fieldsArray);
      pagesArray.push([pageMap]);
      formSchemaMap.set('pages', pagesArray);
      formSchemaMap.set('layout', new Y.Map());
      formSchemaMap.set('isShuffleEnabled', false);

      const state = Y.encodeStateAsUpdate(doc);

      vi.mocked(collaborativeDocumentRepository.fetchDocumentWithState).mockResolvedValue({
        state: Buffer.from(state),
      } as any);

      const result = await getFormSchemaFromHocuspocus('form-123');

      expect(result.pages[0].fields[0].type).toBe('rich_text_field');
      expect(result.pages[0].fields[0].content).toBe('<p>Rich text content</p>');
      expect(result.pages[0].fields[0].label).toBeUndefined();
    });

    it('should handle select fields with options', async () => {
      const doc = new Y.Doc();
      const formSchemaMap = doc.getMap('formSchema');

      const pagesArray = new Y.Array();
      const pageMap = new Y.Map();
      pageMap.set('id', 'page-1');
      pageMap.set('title', 'Page 1');
      pageMap.set('order', 0);

      const fieldsArray = new Y.Array();
      const selectField = new Y.Map();
      selectField.set('id', 'field-1');
      selectField.set('type', 'select_field');
      selectField.set('label', 'Choose option');
      selectField.set('required', true);

      const optionsArray = new Y.Array();
      optionsArray.push(['Option 1', 'Option 2', 'Option 3']);
      selectField.set('options', optionsArray);
      selectField.set('multiple', false);

      fieldsArray.push([selectField]);
      pageMap.set('fields', fieldsArray);
      pagesArray.push([pageMap]);
      formSchemaMap.set('pages', pagesArray);
      formSchemaMap.set('layout', new Y.Map());
      formSchemaMap.set('isShuffleEnabled', false);

      const state = Y.encodeStateAsUpdate(doc);

      vi.mocked(collaborativeDocumentRepository.fetchDocumentWithState).mockResolvedValue({
        state: Buffer.from(state),
      } as any);

      const result = await getFormSchemaFromHocuspocus('form-123');

      expect(result.pages[0].fields[0].options).toEqual(['Option 1', 'Option 2', 'Option 3']);
      expect(result.pages[0].fields[0].multiple).toBe(false);
    });

    it('should return null when collaborative document not found', async () => {
      vi.mocked(collaborativeDocumentRepository.fetchDocumentWithState).mockResolvedValue(null);

      const result = await getFormSchemaFromHocuspocus('nonexistent-form');

      expect(result).toBeNull();
      expect(logger.info).toHaveBeenCalledWith('❌ No collaborative document found for form: nonexistent-form');
    });

    it('should handle errors gracefully', async () => {
      const error = new Error('Database error');
      vi.mocked(collaborativeDocumentRepository.fetchDocumentWithState).mockRejectedValue(error);

      const result = await getFormSchemaFromHocuspocus('form-123');

      expect(result).toBeNull();
      expect(logger.error).toHaveBeenCalledWith(
        '❌ Error getting form schema from Hocuspocus for form form-123:',
        error
      );
    });
  });

  describe('initializeHocuspocusDocument', () => {
    const mockFormSchema = {
      pages: [
        {
          id: 'page-1',
          title: 'Test Page',
          order: 0,
          fields: [
            {
              id: 'field-1',
              type: 'text_input_field',
              label: 'Name',
              defaultValue: '',
              prefix: '',
              hint: 'Enter your name',
              validation: { required: true, type: 'text_input_field' },
            },
            {
              id: 'field-2',
              type: 'email_field',
              label: 'Email',
              defaultValue: '',
              prefix: '',
              hint: '',
              validation: { required: true, type: 'email_field' },
            },
          ],
        },
      ],
      layout: {
        theme: 'light',
        textColor: '#000000',
        spacing: 'normal',
        code: '',
        content: '',
        customBackGroundColor: '#ffffff',
        customCTAButtonName: 'Submit',
        backgroundImageKey: '',
        pageMode: 'multipage',
      },
      isShuffleEnabled: false,
    };

    beforeEach(() => {
      vi.mocked(collaborativeDocumentRepository.saveDocumentState).mockResolvedValue(undefined as any);
    });

    it('should initialize Hocuspocus document with form schema', async () => {
      await initializeHocuspocusDocument('form-123', mockFormSchema);

      expect(collaborativeDocumentRepository.saveDocumentState).toHaveBeenCalledWith(
        'form-123',
        expect.any(Buffer),
        expect.any(Function)
      );
      expect(logger.info).toHaveBeenCalledWith('🚀 Initializing Hocuspocus document for form: form-123');
      expect(logger.info).toHaveBeenCalledWith('✅ Hocuspocus document initialized successfully for form: form-123');
    });

    it('should handle rich text fields correctly', async () => {
      const schemaWithRichText = {
        pages: [
          {
            id: 'page-1',
            title: 'Page 1',
            order: 0,
            fields: [
              {
                id: 'field-1',
                type: 'rich_text_field',
                content: '<p>Welcome!</p>',
              },
            ],
          },
        ],
        layout: mockFormSchema.layout,
        isShuffleEnabled: false,
      };

      await initializeHocuspocusDocument('form-123', schemaWithRichText);

      expect(collaborativeDocumentRepository.saveDocumentState).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('rich_text_field'));
    });

    it('should handle checkbox fields with defaultValues', async () => {
      const schemaWithCheckbox = {
        pages: [
          {
            id: 'page-1',
            title: 'Page 1',
            order: 0,
            fields: [
              {
                id: 'field-1',
                type: 'checkbox_field',
                label: 'Select options',
                defaultValues: ['Option 1', 'Option 2'],
                options: ['Option 1', 'Option 2', 'Option 3'],
                validation: { required: false, type: 'checkbox_field' },
              },
            ],
          },
        ],
        layout: mockFormSchema.layout,
        isShuffleEnabled: false,
      };

      await initializeHocuspocusDocument('form-123', schemaWithCheckbox);

      expect(collaborativeDocumentRepository.saveDocumentState).toHaveBeenCalled();
    });

    it('should create default page when no pages provided', async () => {
      const emptySchema = {
        pages: [],
        layout: mockFormSchema.layout,
        isShuffleEnabled: false,
      };

      await initializeHocuspocusDocument('form-123', emptySchema);

      expect(collaborativeDocumentRepository.saveDocumentState).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith('📝 Creating default empty page for form: form-123');
    });

    it('should filter out empty options', async () => {
      const schemaWithEmptyOptions = {
        pages: [
          {
            id: 'page-1',
            title: 'Page 1',
            order: 0,
            fields: [
              {
                id: 'field-1',
                type: 'select_field',
                label: 'Choose',
                options: ['Option 1', '', '  ', 'Option 2'],
                validation: { required: false, type: 'select_field' },
              },
            ],
          },
        ],
        layout: mockFormSchema.layout,
        isShuffleEnabled: false,
      };

      await initializeHocuspocusDocument('form-123', schemaWithEmptyOptions);

      expect(collaborativeDocumentRepository.saveDocumentState).toHaveBeenCalled();
    });

    it('should handle number fields with min/max constraints', async () => {
      const schemaWithNumber = {
        pages: [
          {
            id: 'page-1',
            title: 'Page 1',
            order: 0,
            fields: [
              {
                id: 'field-1',
                type: 'number_field',
                label: 'Age',
                min: 18,
                max: 100,
                validation: { required: true, type: 'number_field' },
              },
            ],
          },
        ],
        layout: mockFormSchema.layout,
        isShuffleEnabled: false,
      };

      await initializeHocuspocusDocument('form-123', schemaWithNumber);

      expect(collaborativeDocumentRepository.saveDocumentState).toHaveBeenCalled();
    });

    it('should handle date fields with min/max dates', async () => {
      const schemaWithDate = {
        pages: [
          {
            id: 'page-1',
            title: 'Page 1',
            order: 0,
            fields: [
              {
                id: 'field-1',
                type: 'date_field',
                label: 'Birthday',
                minDate: '1900-01-01',
                maxDate: '2024-12-31',
                validation: { required: true, type: 'date_field' },
              },
            ],
          },
        ],
        layout: mockFormSchema.layout,
        isShuffleEnabled: false,
      };

      await initializeHocuspocusDocument('form-123', schemaWithDate);

      expect(collaborativeDocumentRepository.saveDocumentState).toHaveBeenCalled();
    });

    it('should use default layout values when not provided', async () => {
      const schemaWithPartialLayout = {
        pages: mockFormSchema.pages,
        layout: {
          theme: 'dark',
        },
        isShuffleEnabled: true,
      };

      await initializeHocuspocusDocument('form-123', schemaWithPartialLayout as any);

      expect(collaborativeDocumentRepository.saveDocumentState).toHaveBeenCalled();
    });

    it('should throw error when initialization fails', async () => {
      const error = new Error('Save failed');
      vi.mocked(collaborativeDocumentRepository.saveDocumentState).mockRejectedValue(error);

      await expect(initializeHocuspocusDocument('form-123', mockFormSchema)).rejects.toThrow('Save failed');

      expect(logger.error).toHaveBeenCalledWith(
        '❌ Failed to initialize Hocuspocus document for form form-123:',
        error
      );
    });
  });

  describe('initializeHocuspocusDocument callback', () => {
    it('should use callback to generate collection name during initialization', async () => {
      vi.mocked(collaborativeDocumentRepository.saveDocumentState).mockResolvedValue({
        id: 'collab-id',
        documentName: 'new-form-456',
        state: new Uint8Array(),
        updatedAt: new Date(),
      } as any);

      await initializeHocuspocusDocument('new-form-456', { pages: [], layout: {} } as any);

      expect(collaborativeDocumentRepository.saveDocumentState).toHaveBeenCalledWith(
        'new-form-456',
        expect.any(Buffer),
        expect.any(Function)
      );

      // Test the callback function
      const callArgs = vi.mocked(collaborativeDocumentRepository.saveDocumentState).mock.calls[0];
      const callback = callArgs[2] as (name: string) => string;
      expect(callback('new-form-456')).toBe('collab-new-form-456');
    });
  });
});
