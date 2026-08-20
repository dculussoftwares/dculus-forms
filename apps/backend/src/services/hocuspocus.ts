import { Hocuspocus } from '@hocuspocus/server';
import { Database } from '@hocuspocus/extension-database';
import * as Y from 'yjs';
import { sanitizeConditions, sanitizeFieldGrading, DEFAULT_THANK_YOU_CONTENT, type FieldGrading } from '@dculus/types';
import { generateRandomString } from '@dculus/utils';
import {
  extractFormStatsFromYDoc,
  updateFormMetadata,
} from './formMetadataService.js';
import {
  checkFormAccess,
  PermissionLevel,
} from '../graphql/resolvers/formSharing.js';
import { auth } from '../lib/better-auth.js';
import { collaborativeDocumentRepository } from '../repositories/index.js';
import { logger } from '../lib/logger.js';

// Debounce configuration for metadata updates
const METADATA_UPDATE_DEBOUNCE_MS = 5000; // 5 seconds
const metadataUpdateTimeouts = new Map<string, NodeJS.Timeout>();

// Helper function to validate user session and form access.
// Accepts either a bearer token OR a cookie string (WebSocket upgrade
// requests send session cookies automatically; this is the fallback when
// sessionStorage doesn't have a bearer token, e.g. direct URL navigation).
const validateUserAccess = async (
  token: string | null,
  formId: string,
  requiredPermission: string = PermissionLevel.VIEWER,
  cookieHeader?: string,
) => {
  try {
    const authHeaders = new Headers();
    authHeaders.set('content-type', 'application/json');

    const bearerToken = token?.replace('Bearer ', '');
    if (bearerToken) {
      authHeaders.set('authorization', `Bearer ${bearerToken}`);
    } else if (cookieHeader) {
      // Cookie-based fallback: WebSocket upgrade requests carry session cookies
      authHeaders.set('cookie', cookieHeader);
    } else {
      throw new Error('No authentication token provided');
    }

    const sessionData = await auth.api.getSession({ headers: authHeaders });

    if (!sessionData?.user) {
      throw new Error('Invalid or expired session');
    }

    // Check form access permissions
    const accessCheck = await checkFormAccess(
      sessionData.user.id,
      formId,
      requiredPermission as any
    );
    if (!accessCheck.hasAccess) {
      throw new Error(
        `Access denied: Insufficient permissions for form ${formId}`
      );
    }

    return {
      user: sessionData.user,
      permission: accessCheck.permission,
      form: accessCheck.form,
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
              logger.info(
                `✅ [Hocuspocus] Document found for ${documentName}:`
              );
              logger.info(`   - ID: ${document.id}`);
              logger.info(`   - State length: ${document.state.length} bytes`);
              logger.info(`   - Updated: ${document.updatedAt}`);
              logger.info(`   - Returning Uint8Array state to YJS`);
              return new Uint8Array(document.state);
            }

            // P3-10: Removed listDocumentNames() debug log — enumerating all document
            // names on every not-found fetch is unnecessary and leaks document IDs.
            logger.info(
              `❌ [Hocuspocus] Document not found for: ${documentName}`
            );

            return null;
          } catch (error) {
            logger.error(
              `💥 [Hocuspocus] Error fetching document ${documentName}:`,
              error
            );
            return null;
          }
        },
        store: async ({ documentName, state, document: ydoc }) => {
          try {
            // P4-03: Compact the Y.js document before persisting.
            // Y.encodeStateAsUpdate captures the full current state in a single
            // compact update, discarding the accumulated delta chain. This prevents
            // unbounded growth of the stored binary blob over time.
            let stateToStore: Uint8Array;
            if (ydoc) {
              try {
                stateToStore = Y.encodeStateAsUpdate(ydoc);
                logger.info(
                  `[Hocuspocus] Storing document ${documentName}: original=${state.length}B compacted=${stateToStore.length}B`
                );
              } catch (compactError) {
                // Fall back to raw state if compaction fails for any reason
                logger.warn(
                  `[Hocuspocus] Compaction failed for ${documentName}, falling back to raw state:`,
                  compactError
                );
                stateToStore = state;
                logger.info(
                  `[Hocuspocus] Storing document ${documentName} with state length: ${state.length}`
                );
              }
            } else {
              // No ydoc available (e.g. in tests) — store raw state
              stateToStore = state;
              logger.info(
                `[Hocuspocus] Storing document ${documentName} with state length: ${state.length}`
              );
            }

            await collaborativeDocumentRepository.saveDocumentState(
              documentName,
              Buffer.from(stateToStore),
              (name) => `collab-${name}`
            );

            logger.info(
              `[Hocuspocus] Document ${documentName} stored successfully`
            );
          } catch (error) {
            logger.error(
              `[Hocuspocus] Error storing document ${documentName}:`,
              error
            );
            // Don't throw the error to prevent server crashes
          }
        },
      }),
    ],
    onAuthenticate: async ({
      documentName,
      token,
      requestHeaders,
      requestParameters,
      connectionConfig,
      ...rest
    }) => {
      logger.info('🔐 [onAuthenticate] Called with:', {
        documentName,
        hasToken: !!token,
        hasHeaders: !!requestHeaders,
        hasParams: !!requestParameters,
        restKeys: Object.keys(rest),
      });

      try {
        if (!documentName || documentName.trim() === '') {
          logger.warn(
            '⚠️ [onAuthenticate] Empty or undefined documentName received'
          );
          throw new Error('Document name is required');
        }

        const formId = documentName;

        // Extract token — priority: protocol token → Authorization header
        // URL query param is intentionally NOT supported: tokens in query strings
        // appear in server access logs and proxy logs, leaking credentials.
        let authToken = token;

        if (!authToken && requestHeaders) {
          try {
            const authHeader =
              (requestHeaders as any).get?.('authorization') ||
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

        // Cookie fallback: extract session cookie from the WebSocket upgrade
        // request headers when no bearer token is available.
        let cookieHeader: string | undefined;
        if (!authToken && requestHeaders) {
          try {
            cookieHeader =
              (requestHeaders as any).get?.('cookie') ||
              (requestHeaders as any)['cookie'] ||
              undefined;
          } catch {
            // ignore header extraction errors
          }
        }

        logger.info('🔐 [onAuthenticate] Final token status:', {
          hasToken: !!authToken,
          hasCookie: !!cookieHeader,
        });

        // Validate user authentication and form access
        const userAccess = await validateUserAccess(
          authToken || null,
          formId,
          PermissionLevel.VIEWER,
          cookieHeader,
        );

        if (connectionConfig) {
          connectionConfig.readOnly =
            userAccess.permission === PermissionLevel.VIEWER;
        }

        logger.info(
          `✅ [onAuthenticate] User ${userAccess.user.email} authenticated for form ${formId} with ${userAccess.permission} permission`
        );

        return {
          user: {
            id: userAccess.user.id,
            email: userAccess.user.email,
            permission: userAccess.permission,
            formId,
          },
        };
      } catch (error) {
        logger.error(
          `❌ [onAuthenticate] Authentication failed for form ${documentName}:`,
          error
        );
        throw error; // This will reject the connection
      }
    },
    onConnect: async ({ documentName, ...rest }) => {
      logger.info('🔌 [onConnect] Called with:', {
        documentName,
        restKeys: Object.keys(rest),
      });
      logger.info(`🔌 User connected to document: "${documentName}"`);
    },
    onDisconnect: async ({ documentName, ...rest }) => {
      logger.info('🔌 [onDisconnect] Called with:', {
        documentName,
        restKeys: Object.keys(rest),
      });
      logger.info(`🔌 User disconnected from document: "${documentName}"`);
    },
    onChange: async ({ documentName, document, context }) => {
      // Check if user has edit permissions before processing changes
      const userContext = context?.user;
      if (userContext?.permission === PermissionLevel.VIEWER) {
        logger.warn(
          `⚠️ [onChange] VIEWER user ${userContext.email} attempted to modify form ${documentName} - change ignored`
        );
        return; // Don't process changes for viewers
      }

      logger.info(
        `📝 [onChange] Processing changes for form ${documentName} by user ${userContext?.email || 'unknown'} (${userContext?.permission || 'unknown'})`
      );

      // Debounce metadata updates to handle frequent collaborative changes
      if (!metadataUpdateTimeouts.has(documentName)) {
        logger.info(
          `📊 [onChange] Scheduling metadata update for form: ${documentName}`
        );

        const timeoutId = setTimeout(async () => {
          try {
            logger.info(
              `🔄 [Metadata] Updating metadata for form: ${documentName}`
            );

            // Extract stats from the current YJS document
            const stats = extractFormStatsFromYDoc(document);

            // Update metadata cache
            await updateFormMetadata(documentName, stats);

            logger.info(
              `✅ [Metadata] Updated for form ${documentName}:`,
              stats
            );
          } catch (error) {
            logger.error(
              `❌ [Metadata] Failed to update for form ${documentName}:`,
              error
            );
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
            logger.info(
              `🔄 [Metadata] Updating metadata for form: ${documentName}`
            );

            // Extract stats from the current YJS document
            const stats = extractFormStatsFromYDoc(document);

            // Update metadata cache
            await updateFormMetadata(documentName, stats);

            logger.info(
              `✅ [Metadata] Updated for form ${documentName}:`,
              stats
            );
          } catch (error) {
            logger.error(
              `❌ [Metadata] Failed to update for form ${documentName}:`,
              error
            );
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
// Converts a nested Y.Map (grading's `text`/`numeric`/`set` sub-options) into a
// plain object — mirrors the frontend's identically-named helper in
// apps/form-app/src/store/collaboration/CollaborationManager.ts.
const yMapToPlainObject = (value: any): any => {
  if (!(value instanceof Y.Map)) return value;
  const plain: Record<string, any> = {};
  value.forEach((v, k) => {
    plain[k] = v;
  });
  return plain;
};

// Reads a field's `grading` Y.Map (built by createGradingYMap in
// apps/form-app/src/store/helpers/fieldHelpers.ts) back into a plain
// FieldGrading object. Native Quiz (epic #289, Story 06/13): without this,
// submitResponse's grading pass reads the live Hocuspocus schema and finds
// every field's `grading` silently undefined the moment a Y.doc exists for
// the form (any form opened in the builder, or — since
// getFormSchemaFromHocuspocus lazily materializes a doc from the DB row on
// first read — any quiz form at all), so nothing is ever gradable in
// practice despite the answer key being saved correctly. Mirrors the
// frontend's extractGrading exactly, including the sanitizeFieldGrading
// trust-boundary pass.
const extractGrading = (fieldMap: Y.Map<any>): FieldGrading | undefined => {
  const gradingYMap = fieldMap.get('grading');
  if (!(gradingYMap instanceof Y.Map)) return undefined;

  const plain: Record<string, any> = {};
  gradingYMap.forEach((value, key) => {
    if (key === 'acceptedAnswers') {
      plain[key] = value instanceof Y.Array ? value.toArray() : value;
    } else if (key === 'optionFeedback') {
      const arr = value instanceof Y.Array ? value.toArray() : value;
      plain[key] = Array.isArray(arr)
        ? arr.map((entry) => yMapToPlainObject(entry))
        : arr;
    } else if (key === 'text' || key === 'numeric' || key === 'set') {
      plain[key] = yMapToPlainObject(value);
    } else {
      plain[key] = value;
    }
  });

  return sanitizeFieldGrading(plain);
};

export const getFormSchemaFromHocuspocus = async (
  formId: string
): Promise<any | null> => {
  try {
    logger.info(`🔍 Getting form schema from Hocuspocus for form: ${formId}`);

    // Get the collaborative document from database (with 30s timeout to prevent
    // indefinite hangs under PgBouncer pool pressure during CI test runs)
    const collabDoc = await Promise.race([
      collaborativeDocumentRepository.fetchDocumentWithState(formId),
      new Promise<null>((_, reject) =>
        setTimeout(() => reject(new Error('getFormSchemaFromHocuspocus: DB query timeout after 30s')), 30000)
      ),
    ]);

    if (!collabDoc || !collabDoc.state) {
      logger.info(`❌ No collaborative document found for form: ${formId}`);
      return null;
    }

    // Reconstruct the document from stored state
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
              showPageName: pageMap.get('showPageName') ?? true,
              fields: [] as any[],
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
                      content: fieldMap.get('content') || '',
                    };
                    if (fieldMap.get('deleted') === true) {
                      field.deleted = true;
                    }
                    page.fields.push(field);
                  } else if (fieldType === 'file_upload_field') {
                    // File upload fields: extract base fillable props + upload constraints
                    const validationMap = fieldMap.get('validation');
                    const validationData: any =
                      validationMap instanceof Y.Map
                        ? {
                            required: validationMap.get('required') || false,
                            type: validationMap.get('type') || fieldType,
                          }
                        : {
                            required: fieldMap.get('required') || false,
                            type: fieldType,
                          };

                    const allowedMimeTypesData =
                      fieldMap.get('allowedMimeTypes');
                    const allowedMimeTypes =
                      allowedMimeTypesData instanceof Y.Array
                        ? allowedMimeTypesData.toArray()
                        : Array.isArray(allowedMimeTypesData)
                          ? allowedMimeTypesData
                          : [];

                    const field: any = {
                      id: fieldMap.get('id'),
                      type: fieldType,
                      label: fieldMap.get('label'),
                      prefix: fieldMap.get('prefix'),
                      hint: fieldMap.get('hint'),
                      validation: validationData,
                      allowedMimeTypes,
                      maxFileSizeMb: fieldMap.get('maxFileSizeMb'),
                      maxFiles: fieldMap.get('maxFiles'),
                    };
                    if (fieldMap.get('deleted') === true) {
                      field.deleted = true;
                    }
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
                        type: fieldType,
                      };
                    }

                    // Checkbox fields store `defaultValue` as a Y.Array (see
                    // fieldsSlice.ts's dedicated CHECKBOX_FIELD branch) — every
                    // other field type stores it as a plain scalar. Unwrap it here
                    // the same way the frontend's extractFieldData does, otherwise
                    // a raw Y.Array instance reaches CheckboxField's constructor,
                    // which isn't Array.isArray-true and has no `.split`, throwing
                    // `defaultValues.split is not a function` the moment any
                    // checkbox field round-trips through Hocuspocus (e.g. during
                    // Native Quiz grading, epic #289 Story 06/13).
                    const rawDefaultValue = fieldMap.get('defaultValue');
                    const defaultValue =
                      rawDefaultValue instanceof Y.Array
                        ? rawDefaultValue.toArray()
                        : rawDefaultValue;

                    const field: any = {
                      id: fieldMap.get('id'),
                      type: fieldType,
                      label: fieldMap.get('label'),
                      defaultValue,
                      prefix: fieldMap.get('prefix'),
                      hint: fieldMap.get('hint'),
                      validation: validationData,
                    };

                    // Native Quiz (epic #289, Story 06/13): sibling to
                    // `validation` — absent for every non-quiz field, so this is
                    // zero extra work/shape change when grading was never set.
                    const grading = extractGrading(fieldMap);
                    if (grading) field.grading = grading;

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

                    if (fieldMap.has('multiple'))
                      field.multiple = fieldMap.get('multiple');
                    if (fieldMap.has('min')) field.min = fieldMap.get('min');
                    if (fieldMap.has('max')) field.max = fieldMap.get('max');
                    if (fieldMap.has('minDate'))
                      field.minDate = fieldMap.get('minDate');
                    if (fieldMap.has('maxDate'))
                      field.maxDate = fieldMap.get('maxDate');
                    if (fieldMap.has('defaultCountry'))
                      field.defaultCountry = fieldMap.get('defaultCountry');

                    if (fieldMap.get('deleted') === true) {
                      field.deleted = true;
                    }
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
        convertedLayout.thankYouContent =
          layout.get('thankYouContent') || DEFAULT_THANK_YOU_CONTENT;
        convertedLayout.customBackGroundColor = layout.get(
          'customBackGroundColor'
        );
        convertedLayout.customCTAButtonName = layout.get('customCTAButtonName');
        convertedLayout.backgroundImageKey = layout.get('backgroundImageKey');
        convertedLayout.backgroundVideoKey = layout.get('backgroundVideoKey');
        convertedLayout.backgroundDominantColor = layout.get('backgroundDominantColor');
        convertedLayout.pageMode = layout.get('pageMode');
        convertedLayout.isCustomBackgroundColorEnabled =
          layout.get('isCustomBackgroundColorEnabled') || false;
      }

      // Conditional logic rules are stored as a Y.Array of plain JSON rules;
      // sanitizeConditions validates this trust boundary (drops malformed
      // rules, returns undefined when there are none)
      const conditionsArray = formSchemaMap.get('conditions');
      const conditions = sanitizeConditions(
        conditionsArray instanceof Y.Array ? conditionsArray.toJSON() : undefined
      );

      return {
        pages: convertedPages,
        layout: convertedLayout,
        isShuffleEnabled: Boolean(isShuffleEnabled),
        ...(conditions ? { conditions } : {}),
      };
    };

    const formSchema = reconstructFormSchema();
    logger.info(`✅ Retrieved form schema for form: ${formId}`);

    // Clean up
    doc.destroy();

    return formSchema;
  } catch (error) {
    logger.error(
      `❌ Error getting form schema from Hocuspocus for form ${formId}:`,
      error
    );
    return null;
  }
};

/**
 * Initialize a Hocuspocus document with form schema
 * This ensures the collaboration service has the correct document structure
 */
// Builds a field's `grading` Y.Map from a plain FieldGrading object — the
// write-side counterpart of `extractGrading` above, mirroring the frontend's
// createGradingYMap (apps/form-app/src/store/helpers/fieldHelpers.ts), minus
// its "update an existing map in place" mode: this only ever runs once, when
// a brand-new Y.doc is first seeded from a form's stored formSchema.
export const buildGradingYMap = (grading: FieldGrading): Y.Map<any> => {
  const gradingMap = new Y.Map();

  gradingMap.set('mode', grading.mode);
  gradingMap.set('pointValue', grading.pointValue);

  const acceptedAnswersArray = new Y.Array();
  (grading.acceptedAnswers || []).forEach((answer: string) =>
    acceptedAnswersArray.push([answer])
  );
  gradingMap.set('acceptedAnswers', acceptedAnswersArray);

  if (grading.text) {
    const textMap = new Y.Map();
    Object.entries(grading.text).forEach(([key, value]) => {
      if (value !== undefined) textMap.set(key, value);
    });
    gradingMap.set('text', textMap);
  }
  if (grading.numeric) {
    const numericMap = new Y.Map();
    Object.entries(grading.numeric).forEach(([key, value]) => {
      if (value !== undefined) numericMap.set(key, value);
    });
    gradingMap.set('numeric', numericMap);
  }
  if (grading.set) {
    const setMap = new Y.Map();
    Object.entries(grading.set).forEach(([key, value]) => {
      if (value !== undefined) setMap.set(key, value);
    });
    gradingMap.set('set', setMap);
  }

  if (grading.whenCorrect !== undefined) gradingMap.set('whenCorrect', grading.whenCorrect);
  if (grading.whenIncorrect !== undefined) gradingMap.set('whenIncorrect', grading.whenIncorrect);
  if (grading.general !== undefined) gradingMap.set('general', grading.general);

  if (grading.optionFeedback) {
    const optionFeedbackArray = new Y.Array();
    grading.optionFeedback.forEach((entry: any) => {
      const entryMap = new Y.Map();
      entryMap.set('option', entry.option);
      entryMap.set('feedback', entry.feedback);
      optionFeedbackArray.push([entryMap]);
    });
    gradingMap.set('optionFeedback', optionFeedbackArray);
  }

  if (grading.shuffleOptions !== undefined) {
    gradingMap.set('shuffleOptions', grading.shuffleOptions);
  }

  return gradingMap;
};

export const initializeHocuspocusDocument = async (
  formId: string,
  formSchema: any
): Promise<void> => {
  try {
    logger.info(`🚀 Initializing Hocuspocus document for form: ${formId}`);
    logger.info(
      `📥 Form schema input:`,
      JSON.stringify({
        pages: formSchema.pages?.length || 0,
        fields: formSchema.pages?.[0]?.fields?.length || 0,
        layout: !!formSchema.layout,
      })
    );

    // Create temporary YJS document with form schema
    const tempDoc = new Y.Doc();
    const formSchemaMap = tempDoc.getMap('formSchema');

    // Initialize the structure similar to the original implementation
    const pagesArray = new Y.Array();

    if (formSchema.pages && formSchema.pages.length > 0) {
      logger.info(
        `📄 Initializing ${formSchema.pages.length} pages with form data`
      );
      formSchema.pages.forEach((page: any, pageIndex: number) => {
        const pageMap = new Y.Map();
        pageMap.set('id', page.id);
        pageMap.set('title', page.title);
        pageMap.set('order', page.order);
        pageMap.set('showPageName', page.showPageName ?? true);

        const fieldsArray = new Y.Array();
        if (page.fields && page.fields.length > 0) {
          logger.info(
            `  📝 Page ${pageIndex + 1} (${page.title}): Adding ${page.fields.length} fields`
          );
          page.fields.forEach((field: any, fieldIndex: number) => {
            const fieldMap = new Y.Map();
            fieldMap.set('id', field.id);
            fieldMap.set('type', field.type);

            // Handle Rich Text fields differently (they only need content property)
            if (field.type === 'rich_text_field') {
              fieldMap.set('content', field.content || '');
            } else if (field.type === 'file_upload_field') {
              fieldMap.set('label', field.label || '');
              fieldMap.set('prefix', field.prefix || '');
              fieldMap.set('hint', field.hint || '');

              const validationMap = new Y.Map();
              validationMap.set(
                'required',
                field.validation?.required || false
              );
              validationMap.set('type', field.validation?.type || field.type);
              fieldMap.set('validation', validationMap);

              if (
                field.allowedMimeTypes &&
                Array.isArray(field.allowedMimeTypes)
              ) {
                const mimeArray = new Y.Array();
                field.allowedMimeTypes.forEach((mime: string) =>
                  mimeArray.push([mime])
                );
                fieldMap.set('allowedMimeTypes', mimeArray);
              }
              if (field.maxFileSizeMb !== undefined)
                fieldMap.set('maxFileSizeMb', field.maxFileSizeMb);
              if (field.maxFiles !== undefined)
                fieldMap.set('maxFiles', field.maxFiles);
            } else {
              // Handle all other field types with fillable properties
              fieldMap.set('label', field.label || '');

              // Handle defaultValue - use defaultValues for CheckboxField
              if (field.type === 'checkbox_field' && field.defaultValues) {
                const defaultValuesArray = new Y.Array();
                field.defaultValues
                  .filter((val: any) => val && val.trim() !== '')
                  .forEach((val: string) => defaultValuesArray.push([val]));
                fieldMap.set('defaultValue', defaultValuesArray);
              } else {
                fieldMap.set('defaultValue', field.defaultValue || '');
              }

              fieldMap.set('prefix', field.prefix || '');
              fieldMap.set('hint', field.hint || '');

              // Create validation map with all validation properties
              const validationMap = new Y.Map();
              validationMap.set(
                'required',
                field.validation?.required || false
              );
              validationMap.set('type', field.validation?.type || field.type);

              // Add field-specific validation properties
              if (field.validation?.minLength !== undefined) {
                validationMap.set('minLength', field.validation.minLength);
              }
              if (field.validation?.maxLength !== undefined) {
                validationMap.set('maxLength', field.validation.maxLength);
              }
              if (field.validation?.minSelections !== undefined) {
                validationMap.set(
                  'minSelections',
                  field.validation.minSelections
                );
              }
              if (field.validation?.maxSelections !== undefined) {
                validationMap.set(
                  'maxSelections',
                  field.validation.maxSelections
                );
              }

              fieldMap.set('validation', validationMap);

              // Native Quiz (epic #289, Story 06/13): sanitize the same way
              // deserializeFormField does — sibling to `validation`, absent
              // for every non-quiz field. Without this, grading saved on a
              // form at creation time (e.g. the wizard's blank-quiz flow, or
              // any quiz form created directly via the createForm mutation)
              // is silently missing the moment this seeded Y.doc becomes the
              // "live schema" submitResponse grades against.
              const sanitizedGrading = sanitizeFieldGrading(field.grading);
              if (sanitizedGrading) {
                fieldMap.set('grading', buildGradingYMap(sanitizedGrading));
              }

              // Handle field-specific properties
              if (field.options && Array.isArray(field.options)) {
                const optionsArray = new Y.Array();
                // Filter out empty or whitespace-only options
                field.options
                  .filter((option: any) => option && option.trim() !== '')
                  .forEach((option: string) => optionsArray.push([option]));
                fieldMap.set('options', optionsArray);
              }

              if (field.multiple !== undefined)
                fieldMap.set('multiple', field.multiple);
              if (field.min !== undefined) fieldMap.set('min', field.min);
              if (field.max !== undefined) fieldMap.set('max', field.max);
              if (field.minDate !== undefined)
                fieldMap.set('minDate', field.minDate);
              if (field.maxDate !== undefined)
                fieldMap.set('maxDate', field.maxDate);
              if (field.defaultCountry !== undefined)
                fieldMap.set('defaultCountry', field.defaultCountry);
            }

            logger.info(
              `    ⚙️ Field ${fieldIndex + 1}: ${field.type} - "${field.label}"`
            );
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
      defaultPageMap.set('id', `p${generateRandomString(9)}`);
      defaultPageMap.set('title', 'Page 1');
      defaultPageMap.set('order', 0);
      defaultPageMap.set('showPageName', true);
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
    layoutMap.set('thankYouContent', layout.thankYouContent || DEFAULT_THANK_YOU_CONTENT);
    layoutMap.set(
      'customBackGroundColor',
      layout.customBackGroundColor || '#ffffff'
    );
    layoutMap.set(
      'customCTAButtonName',
      layout.customCTAButtonName || 'Get Started'
    );
    layoutMap.set('backgroundImageKey', layout.backgroundImageKey || '');
    layoutMap.set('backgroundVideoKey', layout.backgroundVideoKey || '');
    layoutMap.set('backgroundDominantColor', layout.backgroundDominantColor || '');
    layoutMap.set('pageMode', layout.pageMode || 'multipage');
    layoutMap.set(
      'isCustomBackgroundColorEnabled',
      layout.isCustomBackgroundColorEnabled || false
    );

    formSchemaMap.set('layout', layoutMap);
    formSchemaMap.set('isShuffleEnabled', Boolean(formSchema.isShuffleEnabled));

    // Conditional logic rules — plain JSON entries in a Y.Array, validated
    // on the way in so the document never starts with malformed rules
    const conditions = sanitizeConditions(formSchema.conditions);
    if (conditions) {
      const conditionsArray = new Y.Array();
      conditionsArray.push(conditions.map((rule) => JSON.parse(JSON.stringify(rule))));
      formSchemaMap.set('conditions', conditionsArray);
    }

    // Store the document state directly in the database
    const fullUpdate = Y.encodeStateAsUpdate(tempDoc);
    logger.info(
      `💾 Storing document state to PostgreSQL for form: ${formId}, update size: ${fullUpdate.length} bytes`
    );

    // Create the collaborative document
    await collaborativeDocumentRepository.saveDocumentState(
      formId,
      Buffer.from(fullUpdate),
      (name) => `collab-${name}`
    );

    logger.info(
      `✅ Hocuspocus document initialized successfully for form: ${formId}`
    );

    // Clean up temporary document
    tempDoc.destroy();
  } catch (error) {
    logger.error(
      `❌ Failed to initialize Hocuspocus document for form ${formId}:`,
      error
    );
    throw error;
  }
};
