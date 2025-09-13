import { Hocuspocus } from '@hocuspocus/server';
import { Database } from '@hocuspocus/extension-database';
import { prisma } from '../lib/prisma.js';
import { extractFormStatsFromYDoc, updateFormMetadata } from './formMetadataService.js';

// Debounce configuration for metadata updates
const METADATA_UPDATE_DEBOUNCE_MS = 5000; // 5 seconds
const metadataUpdateTimeouts = new Map<string, NodeJS.Timeout>();

export const createHocuspocusServer = () => {
  return new Hocuspocus({
    quiet: true,
    extensions: [
      new Database({
        fetch: async ({ documentName }) => {
          try {
            console.log(`🔍 [Hocuspocus] Fetching document: ${documentName}`);
            
            const document = await prisma.collaborativeDocument.findUnique({
              where: { documentName },
              select: { state: true, id: true, updatedAt: true }
            });

            if (document && document.state) {
              console.log(`✅ [Hocuspocus] Document found for ${documentName}:`);
              console.log(`   - ID: ${document.id}`);
              console.log(`   - State length: ${document.state.length} bytes`);
              console.log(`   - Updated: ${document.updatedAt}`);
              console.log(`   - Returning Uint8Array state to YJS`);
              return new Uint8Array(document.state);
            }

            console.log(`❌ [Hocuspocus] Document not found for: ${documentName}`);
            
            // List all documents for debugging
            const allDocs = await prisma.collaborativeDocument.findMany({
              select: { documentName: true, id: true }
            });
            console.log(`📋 [Hocuspocus] Available documents:`, allDocs.map((d: {documentName: string}) => d.documentName));
            
            return null;
          } catch (error) {
            console.error(`💥 [Hocuspocus] Error fetching document ${documentName}:`, error);
            return null;
          }
        },
        store: async ({ documentName, state }) => {
          try {
            console.log(`[Hocuspocus] Storing document ${documentName} with state length: ${state.length}`);
            
            // Try to find existing document first
            const existingDoc = await prisma.collaborativeDocument.findUnique({
              where: { documentName }
            });

            if (existingDoc) {
              // Update existing document
              await prisma.collaborativeDocument.update({
                where: { documentName },
                data: {
                  state: Buffer.from(state),
                  updatedAt: new Date()
                }
              });
            } else {
              // Create new document
              await prisma.collaborativeDocument.create({
                data: {
                  id: `collab-${documentName}`,
                  documentName,
                  state: Buffer.from(state),
                  updatedAt: new Date()
                }
              });
            }

            console.log(`[Hocuspocus] Document ${documentName} stored successfully`);
          } catch (error) {
            console.error(`[Hocuspocus] Error storing document ${documentName}:`, error);
            // Don't throw the error to prevent server crashes
          }
        },
      }),
    ],
    onAuthenticate: async ({ documentName, ...rest }) => {
      console.log('🔐 [onAuthenticate] Called with:', { 
        documentName, 
        restKeys: Object.keys(rest)
      });
      
      try {
        if (!documentName || documentName.trim() === '') {
          console.warn('⚠️ [onAuthenticate] Empty or undefined documentName received');
        }
        
        // For development - allow access without token
        // TODO: Implement proper JWT verification and organization membership check
        
        // Verify user has access to the form document
        const formId = documentName;
        const form = await prisma.form.findUnique({
          where: { id: formId },
          include: {
            organization: {
              include: {
                members: true,
              },
            },
          },
        });

        if (!form) {
          console.warn(`[onAuthenticate] Form not found: ${formId}`);
          // For development, allow creating new documents
          return { user: { id: 'demo-user' } };
        }

        // For now, allow access if form exists
        return { user: { id: 'demo-user', formId } };
      } catch (error) {
        console.error('[onAuthenticate]', error);
        // For development, allow access even on errors
        return { user: { id: 'demo-user' } };
      }
    },
    onConnect: async ({ documentName, ...rest }) => {
      console.log('🔌 [onConnect] Called with:', { 
        documentName, 
        restKeys: Object.keys(rest)
      });
      console.log(`🔌 User connected to document: "${documentName}"`);
    },
    onDisconnect: async ({ documentName, ...rest }) => {
      console.log('🔌 [onDisconnect] Called with:', { 
        documentName, 
        restKeys: Object.keys(rest)
      });
      console.log(`🔌 User disconnected from document: "${documentName}"`);
    },
    onChange: async ({ documentName, document, context }) => {
      // Debounce metadata updates to handle frequent collaborative changes
      if (!metadataUpdateTimeouts.has(documentName)) {
        console.log(`📊 [onChange] Scheduling metadata update for form: ${documentName}`);
        
        const timeoutId = setTimeout(async () => {
          try {
            console.log(`🔄 [Metadata] Updating metadata for form: ${documentName}`);
            
            // Extract stats from the current YJS document
            const stats = extractFormStatsFromYDoc(document);
            
            // Update metadata cache
            await updateFormMetadata(documentName, stats);
            
            console.log(`✅ [Metadata] Updated for form ${documentName}:`, stats);
          } catch (error) {
            console.error(`❌ [Metadata] Failed to update for form ${documentName}:`, error);
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
            console.log(`🔄 [Metadata] Updating metadata for form: ${documentName}`);
            
            // Extract stats from the current YJS document
            const stats = extractFormStatsFromYDoc(document);
            
            // Update metadata cache
            await updateFormMetadata(documentName, stats);
            
            console.log(`✅ [Metadata] Updated for form ${documentName}:`, stats);
          } catch (error) {
            console.error(`❌ [Metadata] Failed to update for form ${documentName}:`, error);
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
    console.log(`🔍 Getting form schema from Hocuspocus for form: ${formId}`);
    
    // Get the collaborative document from database
    const collabDoc = await prisma.collaborativeDocument.findUnique({
      where: { documentName: formId },
      select: { state: true }
    });
    
    if (!collabDoc || !collabDoc.state) {
      console.log(`❌ No collaborative document found for form: ${formId}`);
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
      console.log(`❌ No formSchema map found in document for form: ${formId}`);
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
                    const field: any = {
                      id: fieldMap.get('id'),
                      type: fieldType,
                      label: fieldMap.get('label'),
                      defaultValue: fieldMap.get('defaultValue'),
                      prefix: fieldMap.get('prefix'),
                      hint: fieldMap.get('hint'),
                      validation: {
                        required: fieldMap.get('required'),
                        type: fieldType
                      }
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
    console.log(`✅ Retrieved form schema for form: ${formId}`);
    
    // Clean up
    doc.destroy();
    
    return formSchema;
  } catch (error) {
    console.error(`❌ Error getting form schema from Hocuspocus for form ${formId}:`, error);
    return null;
  }
};

/**
 * Initialize a Hocuspocus document with form schema
 * This ensures the collaboration service has the correct document structure
 */
export const initializeHocuspocusDocument = async (formId: string, formSchema: any): Promise<void> => {
  try {
    console.log(`🚀 Initializing Hocuspocus document for form: ${formId}`);
    console.log(`📥 Form schema input:`, JSON.stringify({
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
      console.log(`📄 Initializing ${formSchema.pages.length} pages with form data`);
      formSchema.pages.forEach((page: any, pageIndex: number) => {
        const pageMap = new Y.Map();
        pageMap.set('id', page.id);
        pageMap.set('title', page.title);
        pageMap.set('order', page.order);
        
        const fieldsArray = new Y.Array();
        if (page.fields && page.fields.length > 0) {
          console.log(`  📝 Page ${pageIndex + 1} (${page.title}): Adding ${page.fields.length} fields`);
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
            
            console.log(`    ⚙️ Field ${fieldIndex + 1}: ${field.type} - "${field.label}"`);
            fieldsArray.push([fieldMap]);
          });
        }
        
        pageMap.set('fields', fieldsArray);
        pagesArray.push([pageMap]);
      });
    } else {
      // Create an empty page if no pages exist
      console.log(`📝 Creating default empty page for form: ${formId}`);
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
    console.log(`💾 Storing document state to MongoDB for form: ${formId}, update size: ${fullUpdate.length} bytes`);
    
    // Create the collaborative document
    await prisma.collaborativeDocument.create({
      data: {
        id: `collab-${formId}`,
        documentName: formId,
        state: Buffer.from(fullUpdate),
        updatedAt: new Date()
      }
    });
    
    console.log(`✅ Hocuspocus document initialized successfully for form: ${formId}`);
    
    // Clean up temporary document
    tempDoc.destroy();
    
  } catch (error) {
    console.error(`❌ Failed to initialize Hocuspocus document for form ${formId}:`, error);
    throw error;
  }
};