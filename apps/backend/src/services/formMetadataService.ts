import * as Y from 'yjs';
import { prisma } from '../lib/prisma.js';
import { deserializeFormSchema, FormSchema } from '@dculus/types';

export interface FormMetadataStats {
  pageCount: number;
  fieldCount: number;
  backgroundImageKey: string | null;
}

/**
 * Extract form statistics from a YJS document
 */
export const extractFormStatsFromYDoc = (ydoc: Y.Doc): FormMetadataStats => {
  try {
    const formSchemaMap = ydoc.getMap('formSchema');
    
    // Extract pages
    const pagesArray = formSchemaMap.get('pages') as Y.Array<Y.Map<any>>;
    const pageCount = pagesArray?.length || 0;
    
    // Count total fields across all pages
    let fieldCount = 0;
    if (pagesArray) {
      pagesArray.forEach((pageMap) => {
        const fieldsArray = pageMap.get('fields') as Y.Array<any>;
        fieldCount += fieldsArray?.length || 0;
      });
    }
    
    // Extract background image key from layout
    const layoutMap = formSchemaMap.get('layout') as Y.Map<any>;
    const backgroundImageKey = layoutMap?.get('backgroundImageKey') as string | null;
    
    return {
      pageCount,
      fieldCount,
      backgroundImageKey: backgroundImageKey || null,
    };
  } catch (error) {
    console.error('Error extracting form stats from YDoc:', error);
    return {
      pageCount: 0,
      fieldCount: 0,
      backgroundImageKey: null,
    };
  }
};

/**
 * Extract form statistics from raw YJS document state (Uint8Array)
 */
export const extractFormStatsFromState = (state: Uint8Array): FormMetadataStats => {
  try {
    const ydoc = new Y.Doc();
    Y.applyUpdate(ydoc, state);
    return extractFormStatsFromYDoc(ydoc);
  } catch (error) {
    console.error('Error extracting form stats from state:', error);
    return {
      pageCount: 0,
      fieldCount: 0,
      backgroundImageKey: null,
    };
  }
};

/**
 * Update form metadata in the database
 */
export const updateFormMetadata = async (formId: string, stats: FormMetadataStats): Promise<void> => {
  try {
    await prisma.formMetadata.upsert({
      where: { formId },
      update: {
        pageCount: stats.pageCount,
        fieldCount: stats.fieldCount,
        backgroundImageKey: stats.backgroundImageKey,
        lastUpdated: new Date(),
      },
      create: {
        id: `metadata-${formId}`,
        formId,
        pageCount: stats.pageCount,
        fieldCount: stats.fieldCount,
        backgroundImageKey: stats.backgroundImageKey,
        lastUpdated: new Date(),
      },
    });
    
    console.log(`✅ Updated metadata for form ${formId}:`, stats);
  } catch (error) {
    console.error(`❌ Failed to update metadata for form ${formId}:`, error);
    throw error;
  }
};

/**
 * Compute and update metadata for a form by reading its Hocuspocus document
 */
export const computeFormMetadata = async (formId: string): Promise<FormMetadataStats | null> => {
  try {
    // Fetch the collaborative document
    const collaborativeDoc = await prisma.collaborativeDocument.findUnique({
      where: { documentName: formId },
      select: { state: true },
    });
    
    if (!collaborativeDoc || !collaborativeDoc.state) {
      console.warn(`No collaborative document found for form: ${formId}`);
      return null;
    }
    
    // Extract stats from YJS state (convert Buffer to Uint8Array)
    const stats = extractFormStatsFromState(new Uint8Array(collaborativeDoc.state));
    
    // Update metadata cache
    await updateFormMetadata(formId, stats);
    
    return stats;
  } catch (error) {
    console.error(`Failed to compute metadata for form ${formId}:`, error);
    return null;
  }
};

/**
 * Batch update metadata for multiple forms
 */
export const batchUpdateFormMetadata = async (formIds: string[]): Promise<void> => {
  console.log(`🔄 Starting batch metadata update for ${formIds.length} forms`);
  
  let successCount = 0;
  let errorCount = 0;
  
  for (const formId of formIds) {
    try {
      await computeFormMetadata(formId);
      successCount++;
    } catch (error) {
      console.error(`Failed to update metadata for form ${formId}:`, error);
      errorCount++;
    }
  }
  
  console.log(`✅ Batch update completed: ${successCount} successful, ${errorCount} errors`);
};

export interface FormMetadataWithTimestamp extends FormMetadataStats {
  lastUpdated: Date;
}

/**
 * Get form metadata from cache, with fallback to computation
 */
export const getFormMetadata = async (formId: string): Promise<FormMetadataWithTimestamp | null> => {
  try {
    // Try to get from cache first
    const cachedMetadata = await prisma.formMetadata.findUnique({
      where: { formId },
      select: {
        pageCount: true,
        fieldCount: true,
        backgroundImageKey: true,
        lastUpdated: true,
      },
    });
    
    if (cachedMetadata) {
      return cachedMetadata;
    }
    
    // If not cached, compute and cache it
    console.log(`Computing metadata for form ${formId} (not cached)`);
    const computedStats = await computeFormMetadata(formId);
    
    if (!computedStats) {
      return null;
    }
    
    // Return with timestamp
    return {
      ...computedStats,
      lastUpdated: new Date(),
    };
  } catch (error) {
    console.error(`Failed to get metadata for form ${formId}:`, error);
    return null;
  }
};

/**
 * Construct CDN URL from background image key
 */
export const constructBackgroundImageUrl = (backgroundImageKey: string | null): string | null => {
  if (!backgroundImageKey) return null;
  
  const cdnBaseUrl = process.env.CLOUDFLARE_R2_CDN_URL;
  if (!cdnBaseUrl) {
    console.warn('CLOUDFLARE_R2_CDN_URL not configured');
    return null;
  }
  
  return `${cdnBaseUrl}/${backgroundImageKey}`;
};

/**
 * Get all forms that need metadata updates (forms without cached metadata)
 */
export const getFormsNeedingMetadataUpdate = async (): Promise<string[]> => {
  try {
    const formsWithoutMetadata = await prisma.form.findMany({
      where: {
        id: {
          notIn: await prisma.formMetadata.findMany({
            select: { formId: true },
          }).then((metadata: {formId: string}[]) => metadata.map((m: {formId: string}) => m.formId)),
        },
      },
      select: { id: true },
    });
    
    return formsWithoutMetadata.map((form: {id: string}) => form.id);
  } catch (error) {
    console.error('Failed to get forms needing metadata update:', error);
    return [];
  }
};