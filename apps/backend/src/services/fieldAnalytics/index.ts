/**
 * Field Analytics Service - Main Orchestrator
 *
 * Coordinates all field analytics processors and provides the main API
 * for retrieving field analytics.
 */

import { FieldType } from '@dculus/types';
import { formRepository } from '../../repositories/index.js';
import { getFormSchemaFromHocuspocus } from '../hocuspocus.js';

// Import types
import {
  FieldAnalytics,
  FieldAnalyticsBase,
  FileUploadFieldAnalytics,
  FieldResponse,
} from './types.js';

// Import base utilities
import { getFormResponses, extractFieldValues } from './base.js';

// Import field processors
import { processTextFieldAnalytics } from './textFieldAnalytics.js';
import { processNumberFieldAnalytics } from './numberFieldAnalytics.js';
import { processSelectionFieldAnalytics } from './selectionFieldAnalytics.js';
import { processCheckboxFieldAnalytics } from './checkboxFieldAnalytics.js';
import { processDateFieldAnalytics } from './dateFieldAnalytics.js';
import { processEmailFieldAnalytics } from './emailFieldAnalytics.js';

/**
 * Process file upload field analytics
 * Values stored as arrays of R2 file keys (strings)
 */
const processFileUploadFieldAnalytics = (
  fieldResponses: FieldResponse[],
  fieldId: string,
  fieldLabel: string,
  totalFormResponses: number
): FieldAnalyticsBase & FileUploadFieldAnalytics => {
  const totalResponses = fieldResponses.length;
  const responsesWithFiles = fieldResponses.filter(
    (r) => Array.isArray(r.value) && r.value.length > 0
  ).length;
  const responsesWithoutFiles = totalResponses - responsesWithFiles;

  // Collect all file keys
  const allKeys: string[] = fieldResponses.flatMap((r) =>
    Array.isArray(r.value) ? (r.value as string[]) : []
  );
  const totalFilesUploaded = allKeys.length;
  const averageFilesPerResponse =
    totalResponses > 0 ? totalFilesUploaded / totalResponses : 0;

  // Extension distribution derived from R2 key path
  const extCounts = new Map<string, number>();
  allKeys.forEach((key) => {
    const filename = key.split('/').pop() || '';
    const dotIdx = filename.lastIndexOf('.');
    const ext =
      dotIdx >= 0 ? filename.slice(dotIdx + 1).toLowerCase() : 'unknown';
    extCounts.set(ext, (extCounts.get(ext) || 0) + 1);
  });

  const extensionDistribution = Array.from(extCounts.entries())
    .map(([extension, count]) => ({
      extension,
      count,
      percentage:
        totalFilesUploaded > 0 ? (count / totalFilesUploaded) * 100 : 0,
    }))
    .sort((a, b) => b.count - a.count);

  const responseRate =
    totalFormResponses > 0 ? (totalResponses / totalFormResponses) * 100 : 0;

  return {
    fieldId,
    fieldType: FieldType.FILE_UPLOAD_FIELD,
    fieldLabel,
    totalResponses,
    responseRate,
    lastUpdated: new Date(),
    totalFilesUploaded,
    averageFilesPerResponse,
    extensionDistribution,
    responsesWithFiles,
    responsesWithoutFiles,
  };
};

/**
 * Main function to get field analytics for any field type
 */
export const getFieldAnalytics = async (
  formId: string,
  fieldId: string,
  fieldType: FieldType,
  fieldLabel: string
): Promise<FieldAnalytics> => {
  // Get all form responses
  const responses = await getFormResponses(formId);
  const totalFormResponses = responses.length;

  // Extract field values
  const fieldResponses = extractFieldValues(responses, fieldId);

  let result: FieldAnalytics;

  // Process based on field type
  switch (fieldType) {
    case FieldType.TEXT_INPUT_FIELD:
    case FieldType.TEXT_AREA_FIELD:
      result = {
        ...processTextFieldAnalytics(
          fieldResponses,
          fieldId,
          fieldLabel,
          totalFormResponses
        ),
        fieldType,
      } as FieldAnalytics;
      break;

    case FieldType.NUMBER_FIELD:
      result = processNumberFieldAnalytics(
        fieldResponses,
        fieldId,
        fieldLabel,
        totalFormResponses
      ) as FieldAnalytics;
      break;

    case FieldType.SELECT_FIELD:
    case FieldType.RADIO_FIELD:
      result = {
        ...processSelectionFieldAnalytics(
          fieldResponses,
          fieldId,
          fieldLabel,
          totalFormResponses
        ),
        fieldType,
      } as FieldAnalytics;
      break;

    case FieldType.CHECKBOX_FIELD:
      result = processCheckboxFieldAnalytics(
        fieldResponses,
        fieldId,
        fieldLabel,
        totalFormResponses
      ) as FieldAnalytics;
      break;

    case FieldType.DATE_FIELD:
      result = processDateFieldAnalytics(
        fieldResponses,
        fieldId,
        fieldLabel,
        totalFormResponses
      ) as FieldAnalytics;
      break;

    case FieldType.EMAIL_FIELD:
      result = processEmailFieldAnalytics(
        fieldResponses,
        fieldId,
        fieldLabel,
        totalFormResponses
      ) as FieldAnalytics;
      break;

    case FieldType.FILE_UPLOAD_FIELD:
      result = processFileUploadFieldAnalytics(
        fieldResponses,
        fieldId,
        fieldLabel,
        totalFormResponses
      ) as FieldAnalytics;
      break;

    default:
      throw new Error(`Unsupported field type: ${fieldType}`);
  }

  return result;
};

/**
 * Get analytics for all fields in a form
 */
export const getAllFieldsAnalytics = async (
  formId: string
): Promise<{
  formId: string;
  totalResponses: number;
  fields: FieldAnalytics[];
}> => {
  // First, get the form to extract field information
  const form = await formRepository.findUnique({
    where: { id: formId },
    select: { formSchema: true },
  });

  if (!form) {
    throw new Error(`Form not found: ${formId}`);
  }

  // Always try to get schema from YJS collaborative document first
  let formSchema = await getFormSchemaFromHocuspocus(formId);

  if (!formSchema) {
    // Fallback to database schema if YJS document doesn't exist
    formSchema = form.formSchema as any;

    if (!formSchema || Object.keys(formSchema).length === 0) {
      return {
        formId,
        totalResponses: 0,
        fields: [],
      };
    }
  }

  const responses = await getFormResponses(formId);
  const totalResponses = responses.length;

  // Extract all fields from all pages
  const allFields: Array<{ id: string; type: FieldType; label: string }> = [];

  if (formSchema.pages) {
    formSchema.pages.forEach((page: any) => {
      if (page.fields) {
        page.fields.forEach((field: any) => {
          // Only process fillable fields
          if (
            field.type !== FieldType.RICH_TEXT_FIELD &&
            field.type !== FieldType.FORM_FIELD &&
            field.type !== FieldType.FILLABLE_FORM_FIELD &&
            field.type !== FieldType.NON_FILLABLE_FORM_FIELD
          ) {
            const fieldLabel = field.label || `Field ${field.id}`;
            allFields.push({
              id: field.id,
              type: field.type,
              label: fieldLabel,
            });
          }
        });
      }
    });
  }

  // Process fields in batches to avoid overwhelming the system
  const batchSize = 5;
  const fieldAnalytics: FieldAnalytics[] = [];

  for (let i = 0; i < allFields.length; i += batchSize) {
    const batch = allFields.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map((field) =>
        getFieldAnalytics(formId, field.id, field.type, field.label)
      )
    );
    fieldAnalytics.push(...batchResults);
  }

  return {
    formId,
    totalResponses,
    fields: fieldAnalytics,
  };
};

// Re-export all types for external use
export * from './types.js';
