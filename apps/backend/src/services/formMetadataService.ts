import * as Y from 'yjs';
import { constructCdnUrl } from '../utils/cdn.js';
import { logger } from '../lib/logger.js';
import {
  formMetadataRepository,
  collaborativeDocumentRepository,
  formRepository,
} from '../repositories/index.js';

export interface FormMetadataStats {
  pageCount: number;
  fieldCount: number;
  backgroundImageKey: string | null;
  backgroundVideoKey: string | null;
  backgroundDominantColor: string | null;
}

/**
 * Read a layout field as a non-empty string, discarding malformed/non-string
 * Y.js values before they reach Prisma or CDN URL construction.
 */
const getLayoutString = (layoutMap: Y.Map<any> | undefined, key: string): string | null => {
  const value = layoutMap?.get(key);
  return typeof value === 'string' && value.length > 0 ? value : null;
};

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
        const fieldsArray = pageMap.get('fields') as Y.Array<Y.Map<any>>;
        if (fieldsArray) {
          fieldsArray.forEach((fieldMap) => {
            if (fieldMap.get('deleted') !== true) fieldCount++;
          });
        }
      });
    }

    // Extract background image/video keys from layout
    const layoutMap = formSchemaMap.get('layout') as Y.Map<any>;

    return {
      pageCount,
      fieldCount,
      backgroundImageKey: getLayoutString(layoutMap, 'backgroundImageKey'),
      backgroundVideoKey: getLayoutString(layoutMap, 'backgroundVideoKey'),
      backgroundDominantColor: getLayoutString(layoutMap, 'backgroundDominantColor'),
    };
  } catch (error) {
    logger.error('Error extracting form stats from YDoc:', error);
    return {
      pageCount: 0,
      fieldCount: 0,
      backgroundImageKey: null,
      backgroundVideoKey: null,
      backgroundDominantColor: null,
    };
  }
};

/**
 * Extract form statistics from raw YJS document state (Uint8Array)
 */
export const extractFormStatsFromState = (
  state: Uint8Array
): FormMetadataStats => {
  try {
    const ydoc = new Y.Doc();
    Y.applyUpdate(ydoc, state);
    return extractFormStatsFromYDoc(ydoc);
  } catch (error) {
    logger.error('Error extracting form stats from state:', error);
    return {
      pageCount: 0,
      fieldCount: 0,
      backgroundImageKey: null,
      backgroundVideoKey: null,
      backgroundDominantColor: null,
    };
  }
};

/**
 * Update form metadata in the database
 */
export const updateFormMetadata = async (
  formId: string,
  stats: FormMetadataStats
): Promise<void> => {
  try {
    await formMetadataRepository.upsertMetadata(formId, {
      id: `metadata-${formId}`,
      formId,
      pageCount: stats.pageCount,
      fieldCount: stats.fieldCount,
      backgroundImageKey: stats.backgroundImageKey,
      backgroundVideoKey: stats.backgroundVideoKey,
      backgroundDominantColor: stats.backgroundDominantColor,
      lastUpdated: new Date(),
    });

    logger.info(`✅ Updated metadata for form ${formId}:`, stats);
  } catch (error) {
    logger.error(`❌ Failed to update metadata for form ${formId}:`, error);
    throw error;
  }
};

/**
 * Compute and update metadata for a form by reading its Hocuspocus document
 */
export const computeFormMetadata = async (
  formId: string
): Promise<FormMetadataStats | null> => {
  try {
    // Fetch the collaborative document
    const collaborativeDoc = await collaborativeDocumentRepository.fetchDocumentWithState(
      formId
    );

    if (!collaborativeDoc || !collaborativeDoc.state) {
      logger.warn(`No collaborative document found for form: ${formId}`);
      return null;
    }

    // Extract stats from YJS state (convert Buffer to Uint8Array)
    const stats = extractFormStatsFromState(
      new Uint8Array(collaborativeDoc.state)
    );

    // Update metadata cache
    await updateFormMetadata(formId, stats);

    return stats;
  } catch (error) {
    logger.error(`Failed to compute metadata for form ${formId}:`, error);
    return null;
  }
};

export const formMetadataInternals = {
  computeFormMetadata,
};

/**
 * Batch update metadata for multiple forms
 */
export const batchUpdateFormMetadata = async (
  formIds: string[]
): Promise<void> => {
  logger.info(`🔄 Starting batch metadata update for ${formIds.length} forms`);

  let successCount = 0;
  let errorCount = 0;

  for (const formId of formIds) {
    try {
      await formMetadataInternals.computeFormMetadata(formId);
      successCount++;
    } catch (error) {
      logger.error(`Failed to update metadata for form ${formId}:`, error);
      errorCount++;
    }
  }

  logger.info(
    `✅ Batch update completed: ${successCount} successful, ${errorCount} errors`
  );
};

export interface FormMetadataWithTimestamp extends FormMetadataStats {
  lastUpdated: Date;
}

/**
 * Get form metadata from cache, with fallback to computation
 */
export const getFormMetadata = async (
  formId: string
): Promise<FormMetadataWithTimestamp | null> => {
  try {
    // Try to get from cache first
    const cachedMetadata = await formMetadataRepository.findByFormId(formId);

    if (cachedMetadata) {
      return cachedMetadata;
    }

    // If not cached, compute and cache it
    logger.info(`Computing metadata for form ${formId} (not cached)`);
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
    logger.error(`Failed to get metadata for form ${formId}:`, error);
    return null;
  }
};

/**
 * Construct CDN URL from background image key
 */
export const constructBackgroundImageUrl = (
  backgroundImageKey: string | null
): string | null => {
  if (!backgroundImageKey) return null;

  return constructCdnUrl(backgroundImageKey);
};

/**
 * Construct CDN URL from background video key
 */
export const constructBackgroundVideoUrl = (
  backgroundVideoKey: string | null
): string | null => {
  if (!backgroundVideoKey) return null;

  return constructCdnUrl(backgroundVideoKey);
};

/**
 * Get all forms that need metadata updates (forms without cached metadata)
 */
export const getFormsNeedingMetadataUpdate = async (): Promise<string[]> => {
  try {
    const cachedIds = await formMetadataRepository.listCachedFormIds();

    const formsWithoutMetadata = await formRepository.findMany({
      where: {
        id: {
          notIn: cachedIds.map((m) => m.formId),
        },
      },
      select: { id: true },
    });

    return formsWithoutMetadata.map((form: { id: string }) => form.id);
  } catch (error) {
    logger.error('Failed to get forms needing metadata update:', error);
    return [];
  }
};
