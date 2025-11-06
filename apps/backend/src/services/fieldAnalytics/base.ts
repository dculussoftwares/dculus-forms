/**
 * Base Field Analytics Functions
 *
 * Common utility functions used across all field analytics processors.
 */

import { responseRepository } from '../../repositories/index.js';
import { FieldResponse } from './types.js';

/**
 * Get all responses for a specific form and extract field values
 */
export const getFormResponses = async (formId: string): Promise<Array<{
  responseId: string;
  data: Record<string, any>;
  submittedAt: Date;
}>> => {
  const responses = await responseRepository.listByForm(formId);

  return responses.map(response => ({
    responseId: response.id,
    data: response.data as Record<string, any>,
    submittedAt: response.submittedAt,
  }));
};

/**
 * Extract field values from form responses
 */
export const extractFieldValues = (
  responses: Array<{ responseId: string; data: Record<string, any>; submittedAt: Date }>,
  fieldId: string
): FieldResponse[] => {
  return responses
    .map(response => ({
      value: response.data[fieldId],
      submittedAt: response.submittedAt,
      responseId: response.responseId,
    }))
    .filter(item => item.value !== undefined && item.value !== null && item.value !== '');
};
