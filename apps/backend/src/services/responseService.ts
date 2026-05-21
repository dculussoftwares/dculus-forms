import { FormResponse } from '@dculus/types';
import { ResponseFilter, applyResponseFilters } from './responseFilterService.js';
import {
  buildPostgreSQLFilter,
  canFilterAtDatabase
} from './responseQueryBuilder.js';
import { responseRepository } from '../repositories/index.js';
import { logger } from '../lib/logger.js';
import { prisma } from '../lib/prisma.js';
import type { Prisma } from '@prisma/client';


/**
 * Fetch recent responses across an organization (or all orgs when omitted).
 *
 * P1-13: Hard-capped at 10,000 rows to prevent full-table scans at high volume.
 * The cap is intentional — this endpoint is used for org-wide response listing
 * in the UI, which is inherently paginated. For full exports use
 * getAllResponsesByFormId; for paginated access use getResponsesByFormId.
 */
export const getAllResponses = async (organizationId?: string): Promise<FormResponse[]> => {
  const HARD_CAP = 10_000;

  const responses = await responseRepository.findMany({
    where: organizationId ? {
      form: {
        organizationId
      }
    } : {},
    orderBy: { submittedAt: 'desc' },
    take: HARD_CAP,
    include: {
      form: true,
    },
  });

  return responses.map((response) => ({
    id: response.id,
    formId: response.formId,
    data: (response.data as Prisma.JsonObject) || {},
    metadata: (response.metadata as FormResponse['metadata']) || undefined,
    submittedAt: response.submittedAt,
  }));
};

export const getResponseById = async (id: string): Promise<FormResponse | null> => {
  try {
    const response = await responseRepository.findUnique({
      where: { id },
      include: {
        form: true,
      },
    });

    if (!response) return null;

    return {
      id: response.id,
      formId: response.formId,
      data: (response.data as Prisma.JsonObject) || {},
      metadata: response.metadata as FormResponse['metadata'],
      submittedAt: response.submittedAt,
    };
  } catch (error) {
    logger.error('Error fetching response by ID:', error);
    return null;
  }
};


export async function getResponsesByFormId(
  formId: string,
  page: number = 1,
  limit: number = 10,
  sortBy: string = 'submittedAt',
  sortOrder: 'asc' | 'desc' = 'desc',
  filters?: ResponseFilter[],
  filterLogic: 'AND' | 'OR' = 'AND'
): Promise<{
  data: FormResponse[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}> {
  // Ensure pagination values are valid
  const validPage = Math.max(1, page);
  const validLimit = Math.min(Math.max(1, limit), 100); // Cap at 100 items per page
  const skip = (validPage - 1) * validLimit;

  // Validate and prepare sorting
  const allowedSortFields = ['id', 'submittedAt'];
  const validSortOrder = ['asc', 'desc'].includes(sortOrder.toLowerCase()) ? sortOrder.toLowerCase() : 'desc';

  // Check if sorting by a form field (starts with 'data.')
  const isFormFieldSort = sortBy.startsWith('data.');
  let validSortBy = sortBy;

  if (!isFormFieldSort && !allowedSortFields.includes(sortBy)) {
    validSortBy = 'submittedAt';
  }

  // Determine filtering strategy
  const hasFilters = filters && filters.length > 0;

  let responses;
  let total;

  if (hasFilters && !isFormFieldSort && canFilterAtDatabase(filters)) {
    // OPTIMIZED PATH: Use database-level filtering with PostgreSQL raw SQL
    // PostgreSQL supports all operators including date comparisons with JSONB
    logger.info(`Using database-level filtering for ${filters?.length || 0} filters`);

    try {
      // Build PostgreSQL filter using raw SQL
      const { conditions, params } = buildPostgreSQLFilter(formId, filters, filterLogic);

      // Build WHERE clause with dynamic logic (AND/OR)
      const logicOperator = filterLogic === 'OR' ? ' OR ' : ' AND ';
      const whereClause = conditions.length > 0
        ? `WHERE "formId" = $1 AND (${conditions.join(logicOperator)})`
        : `WHERE "formId" = $1`;


      // Count total matching documents
      const countQuery = `SELECT COUNT(*) as count FROM "response" ${whereClause}`;
      const countResult = await prisma.$queryRawUnsafe<[{ count: bigint }]>(countQuery, ...params);
      total = Number(countResult[0].count);

      // Build ORDER BY clause
      const orderClause = validSortBy === 'submittedAt'
        ? `ORDER BY "submittedAt" ${validSortOrder.toUpperCase()}`
        : `ORDER BY "id" ${validSortOrder.toUpperCase()}`; // Fallback to id sorting

      // Query with pagination and sorting — LIMIT/OFFSET passed as positional params
      const paginationStart = params.length + 1;
      const selectQuery = `
        SELECT id, "formId", data, metadata, "submittedAt"
        FROM "response"
        ${whereClause}
        ${orderClause}
        LIMIT $${paginationStart} OFFSET $${paginationStart + 1}
      `;

      const dbResponses = await prisma.$queryRawUnsafe<Array<{
        id: string;
        formId: string;
        data: Prisma.JsonValue;
        metadata: Prisma.JsonValue;
        submittedAt: Date;
      }>>(selectQuery, ...params, validLimit, skip);

      // Convert to FormResponse format
      responses = dbResponses.map((doc) => ({
        id: doc.id,
        formId: doc.formId,
        data: (doc.data as Prisma.JsonObject) || {},
        metadata: doc.metadata as FormResponse['metadata'],
        submittedAt: doc.submittedAt,
      }));

    } catch (error) {
      logger.error('Database filtering failed, falling back to memory filtering:', error);
      // Fallback to memory processing
      const allResponses = await responseRepository.listByForm(formId);
      const filteredResponses = applyResponseFilters(allResponses, filters, filterLogic);
      total = filteredResponses.length;
      responses = filteredResponses.slice(skip, skip + validLimit);
    }

  } else if (isFormFieldSort || hasFilters) {
    // MEMORY PATH: Form field sorting or with filters
    // Note: Form field sorting requires memory processing to access nested data fields
    logger.info(`Using memory filtering for ${filters?.length || 0} filters (form field sort: ${isFormFieldSort})`);

    const allResponses = await responseRepository.listByForm(formId);
    const filteredResponses = hasFilters ? applyResponseFilters(allResponses, filters, filterLogic) : allResponses;
    total = filteredResponses.length;

    // Apply sorting
    if (isFormFieldSort) {
      const fieldId = validSortBy.replace('data.', '');

      filteredResponses.sort((a, b) => {
        const aValue = (a.data as Record<string, unknown>)[fieldId];
        const bValue = (b.data as Record<string, unknown>)[fieldId];

        // Handle null/undefined values
        if (aValue == null && bValue == null) return 0;
        if (aValue == null) return validSortOrder === 'asc' ? -1 : 1;
        if (bValue == null) return validSortOrder === 'asc' ? 1 : -1;

        // Convert to strings for comparison
        const aStr = String(aValue).toLowerCase();
        const bStr = String(bValue).toLowerCase();

        let comparison = 0;
        if (aStr < bStr) comparison = -1;
        if (aStr > bStr) comparison = 1;

        return validSortOrder === 'asc' ? comparison : -comparison;
      });
    } else {
      // Sort by regular fields
      filteredResponses.sort((a, b) => {
        let aValue, bValue;

        if (validSortBy === 'submittedAt') {
          aValue = new Date(a.submittedAt).getTime();
          bValue = new Date(b.submittedAt).getTime();
        } else {
          aValue = a[validSortBy];
          bValue = b[validSortBy];
        }

        if (aValue < bValue) return validSortOrder === 'asc' ? -1 : 1;
        if (aValue > bValue) return validSortOrder === 'asc' ? 1 : -1;
        return 0;
      });
    }

    // Apply pagination
    responses = filteredResponses.slice(skip, skip + validLimit);

  } else {
    // No filters and regular sorting - use database query for better performance
    total = await responseRepository.count({
      where: { formId },
    });

    responses = await responseRepository.findMany({
      where: { formId },
      orderBy: { [validSortBy]: validSortOrder },
      skip,
      take: validLimit,
    });
  }

  const data = responses.map((response) => ({
    id: response.id,
    formId: response.formId,
    data: (response.data as Prisma.JsonObject) || {},
    metadata: response.metadata as FormResponse['metadata'],
    submittedAt: response.submittedAt,
  }));

  const totalPages = Math.ceil(total / validLimit);

  return {
    data,
    total,
    page: validPage,
    limit: validLimit,
    totalPages,
  };
}

/**
 * Fetch every response for a specific form.
 * Used by the export pipeline (unifiedExportService) and field analytics.
 *
 * P1-11 / P1-13: The export resolver enforces a 50,000-row cap before calling
 * this function. The function itself imposes no additional DB-level limit so
 * that the resolver's post-filter check (applied after optional filter
 * narrowing) can still work correctly. If you add a new call site, make sure
 * to guard against loading unbounded data into memory.
 */
export const getAllResponsesByFormId = async (formId: string): Promise<FormResponse[]> => {
  try {
    logger.info(`Fetching ALL responses for form: ${formId}`);

    const responses = await responseRepository.listByForm(formId);

    logger.info(`Found ${responses.length} total responses for form: ${formId}`);

    return responses.map((response) => ({
      id: response.id,
      formId: response.formId,
      data: (response.data as Prisma.JsonObject) || {},
      metadata: response.metadata as FormResponse['metadata'],
      submittedAt: response.submittedAt,
    }));
  } catch (error) {
    logger.error('Error fetching all responses by form ID:', error);
    throw new Error(`Failed to fetch responses: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

export const submitResponse = async (responseData: Partial<FormResponse>): Promise<FormResponse> => {
  const { generateId } = await import('@dculus/utils');

  // Calendar date values (YYYY-MM-DD) are stored as-is — never convert to Date objects.
  // JSON has no Date type; converting creates a UTC timestamp that shifts the day
  // for users in non-UTC timezones when the value is read back.
  const responseDataForStorage = (responseData.data || {}) as Prisma.InputJsonValue;

  const newResponse = await responseRepository.create({
    data: {
      id: generateId(),
      formId: responseData.formId!,
      data: responseDataForStorage,
    },
  });

  return {
    id: newResponse.id,
    formId: newResponse.formId,
    data: (newResponse.data as Prisma.JsonObject) || {},
    metadata: newResponse.metadata as FormResponse['metadata'],
    submittedAt: newResponse.submittedAt,
  };
};

export const updateResponse = async (
  responseId: string,
  data: Prisma.JsonObject,
  editContext?: {
    userId: string;
    ipAddress?: string;
    userAgent?: string;
    editReason?: string;
  }
): Promise<FormResponse> => {
  logger.info('updateResponse called with:', { responseId, hasEditContext: !!editContext, editContext });
  // Debug logging

  try {
    // If edit tracking context is provided, we need to track the edit
    if (editContext) {
      logger.info('Edit tracking mode - creating snapshot and recording edit');
      const { ResponseEditTrackingService } = await import('./responseEditTrackingService.js');

      // Get the current response and form schema for change detection
      const { response: currentResponse, formSchema } = await ResponseEditTrackingService.getResponseWithFormSchema(responseId);
      const oldData = currentResponse.data as Prisma.JsonObject;

      // P2-02: Wrap the response update and edit history recording in a single
      // transaction so a failure in recordEdit never leaves an untracked edit,
      // and a failure in the response update never creates an orphaned audit record.
      const updatedResponse = await prisma.$transaction(async (tx) => {
        // 1. Update the response row inside the transaction
        const updated = await tx.response.update({
          where: { id: responseId },
          data: { data: data as Prisma.InputJsonValue },
        });

        // 2. Record the edit history inside the same transaction
        await ResponseEditTrackingService.recordEdit(
          responseId,
          oldData,
          data,
          formSchema,
          {
            userId: editContext.userId,
            ipAddress: editContext.ipAddress,
            userAgent: editContext.userAgent,
            editType: 'MANUAL',
            editReason: editContext.editReason
          },
          tx
        );

        return updated;
      });

      return {
        id: updatedResponse.id,
        formId: updatedResponse.formId,
        data: (updatedResponse.data as Prisma.JsonObject) || {},
        metadata: updatedResponse.metadata as FormResponse['metadata'],
        submittedAt: updatedResponse.submittedAt,
      };
    } else {
      // Legacy mode - just update without tracking
      const updatedResponse = await responseRepository.update({
        where: { id: responseId },
        data: { data: data as Prisma.InputJsonValue },
      });

      return {
        id: updatedResponse.id,
        formId: updatedResponse.formId,
        data: (updatedResponse.data as Prisma.JsonObject) || {},
        metadata: updatedResponse.metadata as FormResponse['metadata'],
        submittedAt: updatedResponse.submittedAt,
      };
    }
  } catch (error) {
    logger.error('Error updating response:', error);
    throw new Error(`Failed to update response: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

export const deleteResponse = async (id: string): Promise<boolean> => {
  try {
    await responseRepository.delete({
      where: { id },
    });
    return true;
  } catch (error) {
    logger.error('Error deleting response:', error);
    return false;
  }
}; 
