import { Hocuspocus } from '@hocuspocus/server';
import { Database } from '@hocuspocus/extension-database';
import { extractFormStatsFromYDoc, updateFormMetadata } from './formMetadataService.js';
import { checkFormAccess, PermissionLevel } from '../graphql/resolvers/formSharing.js';
import { auth } from '../lib/better-auth.js';
import { collaborativeDocumentRepository } from '../repositories/index.js';
import { logger } from '../lib/logger.js';

// Debounce configuration for metadata updates
const METADATA_UPDATE_DEBOUNCE_MS = 5000; // 5 seconds
const metadataUpdateTimeouts = new Map<string, NodeJS.Timeout>();

// Helper function to validate user session and form access
const validateUserAccess = async (token: string, formId: string, requiredPermission: string = PermissionLevel.VIEWER) => {
  try {
    // Parse bearer token
    const authToken = token?.replace('Bearer ', '');
    if (!authToken) {
      throw new Error('No authentication token provided');
    }

    // Validate session with better-auth
    const headers = new Headers();
    headers.set('authorization', `Bearer ${authToken}`);
    headers.set('content-type', 'application/json');

    const sessionData = await auth.api.getSession({
      headers: headers
    });

    if (!sessionData?.user) {
      throw new Error('Invalid or expired session');
    }

    // Check form access permissions
    const accessCheck = await checkFormAccess(sessionData.user.id, formId, requiredPermission as any);
    if (!accessCheck.hasAccess) {
      throw new Error(`Access denied: Insufficient permissions for form ${formId}`);
    }

    return {
      user: sessionData.user,
      permission: accessCheck.permission,
      form: accessCheck.form
    };
  } catch (error) {
    logger.error(`[validateUserAccess] Error:`, error);
    throw error;
  }
};

export const createHocuspocusServer = () => {
  return new Hocuspocus({
    quiet: true,
    extensions: [
      new Database({
        fetch: async ({ documentName }) => {
          try {
            logger.info(`🔍 [Hocuspocus] Fetching document: ${documentName}`);

            const document =
              await collaborativeDocumentRepository.fetchDocumentWithState(
                documentName
              );

            if (document && document.state) {
              logger.info(`✅ [Hocuspocus] Document found for ${documentName}:`);
              logger.info(`   - ID: ${document.id}`);
              logger.info(`   - State length: ${document.state.length} bytes`);
              logger.info(`   - Updated: ${document.updatedAt}`);
              logger.info(`   - Returning Uint8Array state to YJS`);
              return new Uint8Array(document.state);
            }

            logger.info(`❌ [Hocuspocus] Document not found for: ${documentName}`);

            // List all documents for debugging
            const allDocs = await collaborativeDocumentRepository.listDocumentNames();
            logger.info(`📋 [Hocuspocus] Available documents:`, allDocs.map((d: { documentName: string }) => d.documentName));

            return null;
          } catch (error) {
            logger.error(`💥 [Hocuspocus] Error fetching document ${documentName}:`, error);
            return null;
          }
        },
        store: async ({ documentName, state }) => {
          try {
            logger.info(`[Hocuspocus] Storing document ${documentName} with state length: ${state.length}`);

            // Try to find existing document first
            await collaborativeDocumentRepository.saveDocumentState(
              documentName,
              Buffer.from(state),
              (name) => `collab-${name}`
            );

            logger.info(`[Hocuspocus] Document ${documentName} stored successfully`);
          } catch (error) {
            logger.error(`[Hocuspocus] Error storing document ${documentName}:`, error);
            // Don't throw the error to prevent server crashes
          }
        },
      }),
    ],
    onAuthenticate: async ({ documentName, token, requestHeaders, requestParameters, ...rest }) => {
      logger.info('🔐 [onAuthenticate] Called with:', {
        documentName,
        hasToken: !!token,
        hasHeaders: !!requestHeaders,
        hasParams: !!requestParameters,
        restKeys: Object.keys(rest)
      });

      try {
        if (!documentName || documentName.trim() === '') {
          logger.warn('⚠️ [onAuthenticate] Empty or undefined documentName received');
          throw new Error('Document name is required');
        }

        const formId = documentName;

        // Extract token from multiple sources
        let authToken = token;

        // Try to get token from URL query parameters
        if (!authToken && requestParameters && requestParameters.get) {
          const tokenParam = requestParameters.get('token');
          if (tokenParam) {
            authToken = tokenParam;
            logger.info('🔍 [onAuthenticate] Found token in URL parameters');
          }
        }

        // Try to get token from Authorization header
        if (!authToken && requestHeaders) {
          try {
            // Handle both Map-like and Headers-like objects
            const authHeader = (requestHeaders as any).get?.('authorization') ||
              (requestHeaders as any).get?.('Authorization') ||
              (requestHeaders as any)['authorization'] ||
              (requestHeaders as any)['Authorization'];

            if (authHeader && typeof authHeader === 'string') {
              authToken = authHeader.replace('Bearer ', '');
              logger.info('🔍 [onAuthenticate] Found token in Authorization header');
            }
          } catch (error) {
            logger.info('🔍 [onAuthenticate] Could not extract token from headers:', error);
          }
        }

        logger.info('🔐 [onAuthenticate] Final token status:', { hasToken: !!authToken });

        // Validate user authentication and form access
        const userAccess = await validateUserAccess(authToken, formId, PermissionLevel.VIEWER);

        logger.info(`✅ [onAuthenticate] User ${userAccess.user.email} authenticated for form ${formId} with ${userAccess.permission} permission`);

        return {
          user: {
            id: userAccess.user.id,
            email: userAccess.user.email,
            permission: userAccess.permission,
            formId
          }
        };
      } catch (error) {
        logger.error(`❌ [onAuthenticate] Authentication failed for form ${documentName}:`, error);
        throw error; // This will reject the connection
      }
    },
    onConnect: async ({ documentName, ...rest }) => {
      logger.info('🔌 [onConnect] Called with:', {
        documentName,
        restKeys: Object.keys(rest)
      });
      logger.info(`🔌 User connected to document: "${documentName}"`);
    },
    onDisconnect: async ({ documentName, ...rest }) => {
      logger.info('🔌 [onDisconnect] Called with:', {
        documentName,
        restKeys: Object.keys(rest)
      });
      logger.info(`🔌 User disconnected from document: "${documentName}"`);
    },
    onChange: async ({ documentName, document, context }) => {
      // Check if user has edit permissions before processing changes
      const userContext = context?.user;
      if (userContext?.permission === PermissionLevel.VIEWER) {
        logger.warn(`⚠️ [onChange] VIEWER user ${userContext.email} attempted to modify form ${documentName} - change ignored`);
        return; // Don't process changes for viewers
      }

      logger.info(`📝 [onChange] Processing changes for form ${documentName} by user ${userContext?.email || 'unknown'} (${userContext?.permission || 'unknown'})`);

      // Debounce metadata updates to handle frequent collaborative changes
      if (!metadataUpdateTimeouts.has(documentName)) {
        logger.info(`📊 [onChange] Scheduling metadata update for form: ${documentName}`);

        const timeoutId = setTimeout(async () => {
          try {
            logger.info(`🔄 [Metadata] Updating metadata for form: ${documentName}`);

            // Extract stats from the current YJS document
            const stats = extractFormStatsFromYDoc(document);

            // Update metadata cache
            await updateFormMetadata(documentName, stats);

            logger.info(`✅ [Metadata] Updated for form ${documentName}:`, stats);
          } catch (error) {
            logger.error(`❌ [Metadata] Failed to update for form ${documentName}:`, error);
          } finally {
            // Clean up timeout reference
            metadataUpdateTimeouts.delete(documentName);
          }
        }, METADATA_UPDATE_DEBOUNCE_MS);

        metadataUpdateTimeouts.set(documentName, timeoutId);
      } else {
        // Reset the existing timeout
        const existingTimeout = metadataUpdateTimeouts.get(documentName)!;
        clearTimeout(existingTimeout);

        const timeoutId = setTimeout(async () => {
          try {
            logger.info(`🔄 [Metadata] Updating metadata for form: ${documentName}`);

            // Extract stats from the current YJS document
            const stats = extractFormStatsFromYDoc(document);

            // Update metadata cache
            await updateFormMetadata(documentName, stats);

            logger.info(`✅ [Metadata] Updated for form ${documentName}:`, stats);
          } catch (error) {
            logger.error(`❌ [Metadata] Failed to update for form ${documentName}:`, error);
          } finally {
            // Clean up timeout reference
            metadataUpdateTimeouts.delete(documentName);
          }
        }, METADATA_UPDATE_DEBOUNCE_MS);

        metadataUpdateTimeouts.set(documentName, timeoutId);
      }
    },
  });
};

/**
 * Get form schema from Hocuspocus collaborative document
 */
export const getFormSchemaFromHocuspocus = async (formId: string): Promise<any | null> => {
  try {
    logger.info(`🔍 Getting form schema from Hocuspocus for form: ${formId}`);

    // Get the collaborative document from database
    const collabDoc =
      await collaborativeDocumentRepository.fetchDocumentWithState(formId);

    if (!collabDoc || !collabDoc.state) {
      logger.info(`❌ No collaborative document found for form: ${formId}`);
      return null;
    }

    // Import YJS and reconstruct the document
    const Y = await import('yjs');
    const doc = new Y.Doc();

    // Apply the stored state to the document
    Y.applyUpdate(doc, new Uint8Array(collabDoc.state));

    // Get the formSchema map
    const formSchemaMap = doc.getMap('formSchema');

    if (!formSchemaMap) {
      logger.info(`❌ No formSchema map found in document for form: ${formId}`);
      doc.destroy();
      return null;
    }

    // Convert YJS structures back to plain objects
    const reconstructFormSchema = () => {
      const pages = formSchemaMap.get('pages');
      const layout = formSchemaMap.get('layout');
      const isShuffleEnabled = formSchemaMap.get('isShuffleEnabled');

      // Convert pages array
      const convertedPages = [];
      if (pages && pages instanceof Y.Array) {
        for (let i = 0; i < pages.length; i++) {
          const pageMap = pages.get(i);
          if (pageMap instanceof Y.Map) {
            const page = {
              id: pageMap.get('id'),
              title: pageMap.get('title'),
              order: pageMap.get('order'),
              fields: [] as any[]
            };

            const fieldsArray = pageMap.get('fields');
            if (fieldsArray instanceof Y.Array) {
              for (let j = 0; j < fieldsArray.length; j++) {
                const fieldMap = fieldsArray.get(j);
                if (fieldMap instanceof Y.Map) {
                  const fieldType = fieldMap.get('type');

                  // Handle Rich Text fields differently (they only have id, type, and content)
                  if (fieldType === 'rich_text_field') {
                    const field: any = {
                      id: fieldMap.get('id'),
                      type: fieldType,
                      content: fieldMap.get('content') || ''
                    };
                    page.fields.push(field);
                  } else {
                    // Handle all other field types with fillable properties

                    // Extract validation from validation map if it exists
                    const validationMap = fieldMap.get('validation');
                    let validationData: any;

                    if (validationMap instanceof Y.Map) {
                      // Read from validation map (current structure)
                      validationData = {
                        required: validationMap.get('required') || false,
                        type: validationMap.get('type') || fieldType,
                        minLength: validationMap.get('minLength'),
                        maxLength: validationMap.get('maxLength'),
                        minSelections: validationMap.get('minSelections'),
                        maxSelections: validationMap.get('maxSelections'),
                      };
                    } else {
                      // Fallback to direct field properties (legacy structure)
                      validationData = {
                        required: fieldMap.get('required') || false,
                        type: fieldType
                      };
                    }

                    const field: any = {
                      id: fieldMap.get('id'),
                      type: fieldType,
                      label: fieldMap.get('label'),
                      defaultValue: fieldMap.get('defaultValue'),
                      prefix: fieldMap.get('prefix'),
                      hint: fieldMap.get('hint'),
                      validation: validationData
                    };

                    // Handle field-specific properties
                    if (fieldMap.has('options')) {
                      const optionsArray = fieldMap.get('options');
                      if (optionsArray instanceof Y.Array) {
                        field.options = [];
                        for (let k = 0; k < optionsArray.length; k++) {
                          field.options.push(optionsArray.get(k));
                        }
                      }
                    }

                    if (fieldMap.has('multiple')) field.multiple = fieldMap.get('multiple');
                    if (fieldMap.has('min')) field.min = fieldMap.get('min');
                    if (fieldMap.has('max')) field.max = fieldMap.get('max');
                    if (fieldMap.has('minDate')) field.minDate = fieldMap.get('minDate');
                    if (fieldMap.has('maxDate')) field.maxDate = fieldMap.get('maxDate');

                    page.fields.push(field);
                  }
                }
              }
            }
            convertedPages.push(page);
          }
        }
      }

      // Convert layout
      const convertedLayout: any = {};
      if (layout instanceof Y.Map) {
        convertedLayout.theme = layout.get('theme');
        convertedLayout.textColor = layout.get('textColor');
        convertedLayout.spacing = layout.get('spacing');
        convertedLayout.code = layout.get('code');
        convertedLayout.content = layout.get('content');
        convertedLayout.customBackGroundColor = layout.get('customBackGroundColor');
        convertedLayout.customCTAButtonName = layout.get('customCTAButtonName');
        convertedLayout.backgroundImageKey = layout.get('backgroundImageKey');
        convertedLayout.pageMode = layout.get('pageMode');
      }

      return {
        pages: convertedPages,
        layout: convertedLayout,
        isShuffleEnabled: Boolean(isShuffleEnabled)
      };
    };

    const formSchema = reconstructFormSchema();
    logger.info(`✅ Retrieved form schema for form: ${formId}`);

    // Clean up
    doc.destroy();

    return formSchema;
  } catch (error) {
    logger.error(`❌ Error getting form schema from Hocuspocus for form ${formId}:`, error);
    return null;
  }
};

/**
 * Initialize a Hocuspocus document with form schema
 * This ensures the collaboration service has the correct document structure
 */
export const initializeHocuspocusDocument = async (formId: string, formSchema: any): Promise<void> => {
  try {
    logger.info(`🚀 Initializing Hocuspocus document for form: ${formId}`);
    logger.info(`📥 Form schema input:`, JSON.stringify({
      pages: formSchema.pages?.length || 0,
      fields: formSchema.pages?.[0]?.fields?.length || 0,
      layout: !!formSchema.layout
    }));

    // Create temporary YJS document with form schema
    const Y = await import('yjs');
    const tempDoc = new Y.Doc();
    const formSchemaMap = tempDoc.getMap('formSchema');

    // Initialize the structure similar to the original implementation
    const pagesArray = new Y.Array();

    if (formSchema.pages && formSchema.pages.length > 0) {
      logger.info(`📄 Initializing ${formSchema.pages.length} pages with form data`);
      formSchema.pages.forEach((page: any, pageIndex: number) => {
        const pageMap = new Y.Map();
        pageMap.set('id', page.id);
        pageMap.set('title', page.title);
        pageMap.set('order', page.order);

        const fieldsArray = new Y.Array();
        if (page.fields && page.fields.length > 0) {
          logger.info(`  📝 Page ${pageIndex + 1} (${page.title}): Adding ${page.fields.length} fields`);
          page.fields.forEach((field: any, fieldIndex: number) => {
            const fieldMap = new Y.Map();
            fieldMap.set('id', field.id);
            fieldMap.set('type', field.type);

            // Handle Rich Text fields differently (they only need content property)
            if (field.type === 'rich_text_field') {
              fieldMap.set('content', field.content || '');
            } else {
              // Handle all other field types with fillable properties
              fieldMap.set('label', field.label || '');

              // Handle defaultValue - use defaultValues for CheckboxField
              if (field.type === 'checkbox_field' && field.defaultValues) {
                const defaultValuesArray = new Y.Array();
                field.defaultValues.filter((val: any) => val && val.trim() !== '').forEach((val: string) => defaultValuesArray.push([val]));
                fieldMap.set('defaultValue', defaultValuesArray);
              } else {
                fieldMap.set('defaultValue', field.defaultValue || '');
              }

              fieldMap.set('prefix', field.prefix || '');
              fieldMap.set('hint', field.hint || '');
              fieldMap.set('required', field.validation?.required || false);

              // Handle field-specific properties
              if (field.options && Array.isArray(field.options)) {
                const optionsArray = new Y.Array();
                // Filter out empty or whitespace-only options
                field.options.filter((option: any) => option && option.trim() !== '').forEach((option: string) => optionsArray.push([option]));
                fieldMap.set('options', optionsArray);
              }

              if (field.multiple !== undefined) fieldMap.set('multiple', field.multiple);
              if (field.min !== undefined) fieldMap.set('min', field.min);
              if (field.max !== undefined) fieldMap.set('max', field.max);
              if (field.minDate !== undefined) fieldMap.set('minDate', field.minDate);
              if (field.maxDate !== undefined) fieldMap.set('maxDate', field.maxDate);
            }

            logger.info(`    ⚙️ Field ${fieldIndex + 1}: ${field.type} - "${field.label}"`);
            fieldsArray.push([fieldMap]);
          });
        }

        pageMap.set('fields', fieldsArray);
        pagesArray.push([pageMap]);
      });
    } else {
      // Create an empty page if no pages exist
      logger.info(`📝 Creating default empty page for form: ${formId}`);
      const defaultPageMap = new Y.Map();
      defaultPageMap.set('id', `page-${Date.now()}`);
      defaultPageMap.set('title', 'Page 1');
      defaultPageMap.set('order', 0);
      defaultPageMap.set('fields', new Y.Array());
      pagesArray.push([defaultPageMap]);
    }

    formSchemaMap.set('pages', pagesArray);

    // Initialize layout
    const layoutMap = new Y.Map();
    const layout = formSchema.layout || {};
    layoutMap.set('theme', layout.theme || 'light');
    layoutMap.set('textColor', layout.textColor || '#000000');
    layoutMap.set('spacing', layout.spacing || 'normal');
    layoutMap.set('code', layout.code || '');
    layoutMap.set('content', layout.content || '');
    layoutMap.set('customBackGroundColor', layout.customBackGroundColor || '#ffffff');
    layoutMap.set('customCTAButtonName', layout.customCTAButtonName || 'Submit');
    layoutMap.set('backgroundImageKey', layout.backgroundImageKey || '');
    layoutMap.set('pageMode', layout.pageMode || 'multipage');

    formSchemaMap.set('layout', layoutMap);
    formSchemaMap.set('isShuffleEnabled', Boolean(formSchema.isShuffleEnabled));

    // Store the document state directly in the database
    const fullUpdate = Y.encodeStateAsUpdate(tempDoc);
    logger.info(`💾 Storing document state to PostgreSQL for form: ${formId}, update size: ${fullUpdate.length} bytes`);

    // Create the collaborative document
    await collaborativeDocumentRepository.saveDocumentState(
      formId,
      Buffer.from(fullUpdate),
      (name) => `collab-${name}`
    );

    logger.info(`✅ Hocuspocus document initialized successfully for form: ${formId}`);

    // Clean up temporary document
    tempDoc.destroy();

  } catch (error) {
    logger.error(`❌ Failed to initialize Hocuspocus document for form ${formId}:`, error);
    throw error;
  }
};
