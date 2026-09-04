import { FormResponse } from '@dculus/types';
import { GRAPHQL_ERROR_CODES } from '@dculus/types/graphql.js';
import { createGraphQLError } from '#graphql-errors';
import { ResponseFilter, applyResponseFilters } from './responseFilterService.js';
import { attachFilterContext } from './responseFilterContext.js';
import {
  buildRawSQLCondition,
  canFilterAtDatabase,
  buildJoinClause,
} from './responseQueryBuilder.js';
import { batchLoadTagsForResponses } from './tagService.js';
import { responseRepository, createResponseRepository } from '../repositories/index.js';
import { withPrisma } from '../repositories/baseRepository.js';
import { logger } from '../lib/logger.js';
import { prisma } from '../lib/prisma.js';
import { emitResponseEdited } from '../plugins/core/events.js';
import { Prisma } from '#prisma-client';


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
    respondentEmail: (response as any).respondentEmail ?? undefined,
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
    const rows = await responseRepository.countPerFieldRaw(formId, fieldIds);
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
    const rows = await responseRepository.countReferencingAnyFieldRaw(formId, fieldIds);
    return rows.length > 0 ? Number(rows[0].count) : 0;
  } catch (error) {
    logger.error('Error counting responses referencing fields:', error);
    return 0;
  }
};

/** Non-deleted response count for a form. Used by the `Form.responseCount` field resolver. */
export const getResponseCount = async (formId: string): Promise<number> =>
  responseRepository.count({ where: { formId, deletedAt: null } });

/**
 * Total response count for a form, including soft-deleted rows. Used for the
 * maximum-responses submission-limit check, which is intentionally based on
 * every response ever recorded (not just currently-visible ones).
 */
export const countAllResponses = async (formId: string): Promise<number> =>
  responseRepository.count({ where: { formId } });

/**
 * Bucketed non-deleted response counts for the `Form.dashboardStats` field
 * resolver. All six counts are independent and safe to run concurrently.
 */
export const getDashboardResponseCounts = async (
  formId: string,
  ranges: { today: Date; weekAgo: Date; monthAgo: Date; yesterday: Date; twoWeeksAgo: Date }
): Promise<{
  today: number;
  thisWeek: number;
  thisMonth: number;
  total: number;
  yesterday: number;
  lastWeek: number;
}> => {
  const [today, thisWeek, thisMonth, total, yesterday, lastWeek] = await Promise.all([
    responseRepository.count({ where: { formId, deletedAt: null, submittedAt: { gte: ranges.today } } }),
    responseRepository.count({ where: { formId, deletedAt: null, submittedAt: { gte: ranges.weekAgo } } }),
    responseRepository.count({ where: { formId, deletedAt: null, submittedAt: { gte: ranges.monthAgo } } }),
    responseRepository.count({ where: { formId, deletedAt: null } }),
    responseRepository.count({ where: { formId, deletedAt: null, submittedAt: { gte: ranges.yesterday, lt: ranges.today } } }),
    responseRepository.count({ where: { formId, deletedAt: null, submittedAt: { gte: ranges.twoWeeksAgo, lt: ranges.weekAgo } } }),
  ]);
  return { today, thisWeek, thisMonth, total, yesterday, lastWeek };
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
      respondentEmail: (response as any).respondentEmail ?? undefined,
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
  // Native Quiz (epic #289, Story 11): sort by the joined ResponseGrade row,
  // done in SQL (Prisma relation orderBy / a raw-SQL JOIN below) — never in memory.
  const isGradeSort = sortBy === 'grade.percentage';
  let validSortBy = sortBy;

  if (!isFormFieldSort && !isGradeSort && !allowedSortFields.includes(sortBy)) {
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

      // Native Quiz (epic #289, Story 11): a LEFT JOIN against response_grade
      // is only added when a filter or the sort actually targets a grade
      // field — a non-quiz form's query never references it, so its SQL
      // (and query count) stays identical to before this feature existed.
      const joinClause = buildJoinClause(filters, isGradeSort);

      const logicOperator = filterLogic === 'OR' ? ' OR ' : ' AND ';
      let whereClause = `WHERE "response"."formId" = $1`;
      if (fieldConditions.length > 0) {
        whereClause += ` AND (${fieldConditions.join(logicOperator)})`;
      }
      if (scopeConditions.length > 0) {
        whereClause += ` AND (${scopeConditions.join(' AND ')})`;
      }


      // Count total matching documents
      total = await responseRepository.countFilteredRaw(whereClause, params, joinClause);

      // Build ORDER BY clause
      const orderClause = isGradeSort
        ? `ORDER BY rg.percentage ${validSortOrder.toUpperCase()} NULLS LAST`
        : validSortBy === 'submittedAt'
        ? `ORDER BY "response"."submittedAt" ${validSortOrder.toUpperCase()}`
        : `ORDER BY "response".id ${validSortOrder.toUpperCase()}`; // Fallback to id sorting

      // Query with pagination and sorting — LIMIT/OFFSET passed as positional params
      const dbResponses = await responseRepository.findFilteredRaw(
        whereClause,
        orderClause,
        params,
        validLimit,
        skip,
        joinClause
      );

      // Convert to FormResponse format
      responses = dbResponses.map((doc) => ({
        id: doc.id,
        formId: doc.formId,
        data: (doc.data as Prisma.JsonObject) || {},
        metadata: doc.metadata as FormResponse['metadata'],
        respondentEmail: doc.respondentEmail ?? undefined,
        submittedAt: doc.submittedAt,
      }));

    } catch (error) {
      logger.error('Database filtering failed, falling back to memory filtering:', error);
      // Fallback to memory processing
      const allResponses = await responseRepository.listByForm(formId);
      await attachFilterContext(allResponses, formId, filters);
      const filteredResponses = applyResponseFilters(allResponses, filters, filterLogic);
      total = filteredResponses.length;
      responses = filteredResponses.slice(skip, skip + validLimit);
    }

  } else if (isFormFieldSort || hasFilters) {
    // MEMORY PATH: Form field sorting or with filters
    // Note: Form field sorting requires memory processing to access nested data fields
    logger.info(`Using memory filtering for ${filters?.length || 0} filters (form field sort: ${isFormFieldSort})`);

    const allResponses = await responseRepository.listByForm(formId);
    if (hasFilters) await attachFilterContext(allResponses, formId, filters);
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

    // Native Quiz (epic #289, Story 11): ordering by the joined ResponseGrade
    // row via Prisma's relation orderBy — a genuine SQL ORDER BY over a JOIN,
    // never done in memory. Only reached when the caller actually asks to
    // sort by grade.percentage; every other sort keeps the prior orderBy shape.
    const orderBy = isGradeSort
      ? { grade: { percentage: validSortOrder as Prisma.SortOrder } }
      : { [validSortBy]: validSortOrder };

    responses = await responseRepository.findMany({
      where: { formId, deletedAt: null },
      orderBy,
      skip,
      take: validLimit,
    });
  }

  const baseData = responses.map((response) => ({
    id: response.id,
    formId: response.formId,
    data: (response.data as Prisma.JsonObject) || {},
    metadata: response.metadata as FormResponse['metadata'],
    respondentEmail: (response as any).respondentEmail ?? undefined,
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
      respondentEmail: (response as any).respondentEmail ?? undefined,
      respondentUserId: (response as any).respondentUserId ?? null,
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
      respondentUserId: (responseData as any).respondentUserId ?? null,
      respondentEmail: (responseData as any).respondentEmail ?? null,
    },
  });

  return {
    id: newResponse.id,
    formId: newResponse.formId,
    data: (newResponse.data as Prisma.JsonObject) || {},
    metadata: newResponse.metadata as FormResponse['metadata'],
    respondentEmail: (newResponse as any).respondentEmail ?? undefined,
    submittedAt: newResponse.submittedAt,
  };
};

/**
 * Atomic check-then-insert for a form's maximum-responses submission limit.
 * Uses a Serializable transaction so two concurrent submissions cannot both
 * pass the count check and both insert, exceeding the limit by one — do not
 * weaken the isolation level or split the count/insert across transactions.
 */
export const submitResponseWithMaxLimitCheck = async (
  responseData: {
    id: string;
    formId: string;
    data: Prisma.InputJsonValue;
    respondentUserId: string | null;
    respondentEmail: string | null;
  },
  maxAllowed: number
): Promise<FormResponse> => {
  const inserted = await prisma.$transaction(
    async (tx) => {
      const txRepo = createResponseRepository(withPrisma(tx as any));

      const currentCount = await txRepo.count({
        where: { formId: responseData.formId },
      });

      if (currentCount >= maxAllowed) {
        throw createGraphQLError('Form has reached its maximum response limit', GRAPHQL_ERROR_CODES.MAX_RESPONSES_REACHED);
      }

      // Insert atomically within the same transaction
      return txRepo.create({
        data: {
          id: responseData.id,
          formId: responseData.formId,
          data: responseData.data,
          respondentUserId: responseData.respondentUserId,
          respondentEmail: responseData.respondentEmail,
        },
      });
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
  );

  return {
    id: inserted.id,
    formId: inserted.formId,
    data: (inserted.data as Prisma.JsonObject) || {},
    metadata: inserted.metadata as FormResponse['metadata'],
    respondentEmail: inserted.respondentEmail ?? undefined,
    submittedAt: inserted.submittedAt,
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
    /** Required to emit response.edited (#201) — the resolver already has form.organizationId. */
    organizationId?: string;
    editType?: 'MANUAL' | 'SYSTEM' | 'BULK';
    /**
     * Set by automation action handlers (none exist yet) when an action edits a response —
     * propagated onto the emitted response.edited event so the automation trigger service
     * can suppress creating a new run from an edit its own engine caused (loop guard, #201).
     */
    sourceRunId?: string;
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
        // Transaction-scoped repository so the response update and edit
        // history recording share the same Prisma transaction client.
        const txRepo = createResponseRepository(withPrisma(tx as any));

        // 1. Update the response row inside the transaction
        const updated = await txRepo.update({
          where: { id: responseId },
          data: { data: data as Prisma.InputJsonValue },
        });

        // 2. Record the edit history inside the same transaction
        const editHistory = await ResponseEditTrackingService.recordEdit(
          responseId,
          oldData,
          data,
          formSchema,
          {
            userId: editContext.userId,
            ipAddress: editContext.ipAddress,
            userAgent: editContext.userAgent,
            editType: editContext.editType || 'MANUAL',
            editReason: editContext.editReason
          },
          tx
        );

        return { updated, editHistory };
      });

      // Fire-and-forget outside the transaction (I/O-heavy — must not hold it
      // open), and only when field values actually changed: regenerate any
      // PdfGenerationResult rows tied to this response so a persisted PDF
      // never silently goes stale after an edit.
      if (updatedResponse.editHistory) {
        import('./pdfGenerationJobService.js')
          .then(({ regeneratePdfsForResponse }) => regeneratePdfsForResponse(responseId))
          .catch((error) => logger.error('Error regenerating PDFs after response edit:', error));

        // Emit plugin event for the automation trigger service (#201) — mirrors
        // emitFormSubmitted's fire-and-forget pattern; must never fail the edit itself.
        // Only fired when recordEdit detected real field changes (editHistory is non-null),
        // so a no-op save never spuriously triggers response.edited automations.
        if (!editContext.organizationId) {
          logger.error(
            'Skipping response.edited emission: editContext.organizationId was not provided',
            { responseId }
          );
        } else {
          try {
            emitResponseEdited(updatedResponse.updated.formId, editContext.organizationId, {
              ...(data as Record<string, any>),
              responseId,
              editType: editContext.editType || 'MANUAL',
              sourceRunId: editContext.sourceRunId,
            });
          } catch (error) {
            logger.error('Error emitting response.edited event:', error);
          }
        }
      }

      return {
        id: updatedResponse.updated.id,
        formId: updatedResponse.updated.formId,
        data: (updatedResponse.updated.data as Prisma.JsonObject) || {},
        metadata: updatedResponse.updated.metadata as FormResponse['metadata'],
        submittedAt: updatedResponse.updated.submittedAt,
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
    await responseRepository.softDeleteMany(formId, ids);
    return true;
  } catch (error) {
    logger.error('Error bulk-deleting responses:', error);
    return false;
  }
};
