import { FormResponse } from '@dculus/types';
import { ResponseFilter, applyResponseFilters } from './responseFilterService.js';
import {
  buildRawSQLCondition,
  canFilterAtDatabase
} from './responseQueryBuilder.js';
import { batchLoadTagsForResponses } from './tagService.js';
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

/**
 * Count, per fieldId, how many non-deleted responses hold a non-empty value for that field.
 *
 * Used by the AI delete/convert confirmation cards to warn "used in N responses". A field's
 * answer is stored at `data[fieldId]`; we count rows where that key exists and is not null and
 * (for scalar string values) not the empty string. Array/object answers (e.g. checkbox/select)
 * count as present as long as the key exists and is non-null.
 *
 * Returns a map of fieldId → count. Field ids with no responses are included with 0.
 */
export const countResponsesPerField = async (
  formId: string,
  fieldIds: string[]
): Promise<Record<string, number>> => {
  const result: Record<string, number> = {};
  for (const id of fieldIds) result[id] = 0;
  if (fieldIds.length === 0) return result;

  try {
    // One indexed scan over the form's live responses; count per requested key.
    const rows = await prisma.$queryRaw<Array<{ field_id: string; count: bigint }>>`
      SELECT key AS field_id, COUNT(*)::bigint AS count
      FROM "response", LATERAL jsonb_each("data") AS entry(key, value)
      WHERE "formId" = ${formId}
        AND "deletedAt" IS NULL
        AND key = ANY(${fieldIds})
        AND value IS NOT NULL
        AND value <> 'null'::jsonb
        AND value <> '""'::jsonb
      GROUP BY key
    `;
    for (const row of rows) {
      result[row.field_id] = Number(row.count);
    }
  } catch (error) {
    logger.error('Error counting responses per field:', error);
  }
  return result;
};

/**
 * Count distinct non-deleted responses that hold a non-empty value for ANY of the given fields.
 * Used by the page-delete confirmation card (a page delete removes all its fields at once).
 */
export const countResponsesReferencingAnyField = async (
  formId: string,
  fieldIds: string[]
): Promise<number> => {
  if (fieldIds.length === 0) return 0;
  try {
    const rows = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*)::bigint AS count
      FROM "response" r
      WHERE r."formId" = ${formId}
        AND r."deletedAt" IS NULL
        AND EXISTS (
          SELECT 1 FROM jsonb_each(r."data") AS entry(key, value)
          WHERE key = ANY(${fieldIds})
            AND value IS NOT NULL
            AND value <> 'null'::jsonb
            AND value <> '""'::jsonb
        )
    `;
    return rows.length > 0 ? Number(rows[0].count) : 0;
  } catch (error) {
    logger.error('Error counting responses referencing fields:', error);
    return 0;
  }
};

export const getResponseById = async (id: string): Promise<FormResponse | null> => {
  try {
    const response = await responseRepository.findFirst({
      where: { id, deletedAt: null } as any,
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
      // Separate __submittedAt (scope/toolbar filter) from user field filters so the
      // date range always acts as an AND gate regardless of the user's filterLogic.
      const SCOPE_FIELD_IDS = new Set(['__submittedAt', '__tags']);
      const scopeFilters  = (filters ?? []).filter(f => SCOPE_FIELD_IDS.has(f.fieldId));
      const userFiltersDb = (filters ?? []).filter(f => !SCOPE_FIELD_IDS.has(f.fieldId));

      const params: any[] = [formId]; // $1 = formId
      let paramIndex = 2;

      // Build scope conditions (always AND)
      const scopeConditions: string[] = [];
      for (const f of scopeFilters) {
        const { sql, values } = buildRawSQLCondition(f, paramIndex);
        if (sql) { scopeConditions.push(sql); params.push(...values); paramIndex += values.length; }
      }

      // Build user field conditions (respect filterLogic)
      const fieldConditions: string[] = [];
      for (const f of userFiltersDb) {
        const { sql, values } = buildRawSQLCondition(f, paramIndex);
        if (sql) { fieldConditions.push(sql); params.push(...values); paramIndex += values.length; }
      }

      const logicOperator = filterLogic === 'OR' ? ' OR ' : ' AND ';
      let whereClause = `WHERE "formId" = $1`;
      if (fieldConditions.length > 0) {
        whereClause += ` AND (${fieldConditions.join(logicOperator)})`;
      }
      if (scopeConditions.length > 0) {
        whereClause += ` AND (${scopeConditions.join(' AND ')})`;
      }


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
      where: { formId, deletedAt: null },
    });

    responses = await responseRepository.findMany({
      where: { formId, deletedAt: null },
      orderBy: { [validSortBy]: validSortOrder },
      skip,
      take: validLimit,
    });
  }

  const baseData = responses.map((response) => ({
    id: response.id,
    formId: response.formId,
    data: (response.data as Prisma.JsonObject) || {},
    metadata: response.metadata as FormResponse['metadata'],
    submittedAt: response.submittedAt,
    tags: [] as { id: string; formId: string; name: string; color: string; createdAt: Date }[],
  }));

  // Batch-load tags to avoid N+1 queries
  const tagMap = await batchLoadTagsForResponses(baseData.map((r) => r.id));
  const data = baseData.map((r) => ({ ...r, tags: tagMap[r.id] ?? [] }));

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

    const baseData = responses.map((response) => ({
      id: response.id,
      formId: response.formId,
      data: (response.data as Prisma.JsonObject) || {},
      metadata: response.metadata as FormResponse['metadata'],
      submittedAt: response.submittedAt,
    }));

    const tagMap = await batchLoadTagsForResponses(baseData.map((r) => r.id));
    return baseData.map((r) => ({ ...r, tags: tagMap[r.id] ?? [] }));
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
    await responseRepository.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    return true;
  } catch (error) {
    logger.error('Error deleting response:', error);
    return false;
  }
};

export const deleteResponses = async (formId: string, ids: string[]): Promise<boolean> => {
  try {
    await prisma.response.updateMany({
      where: { id: { in: ids }, formId, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    return true;
  } catch (error) {
    logger.error('Error bulk-deleting responses:', error);
    return false;
  }
};
