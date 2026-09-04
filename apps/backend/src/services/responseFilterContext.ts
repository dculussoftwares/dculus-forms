/**
 * Attaches response-meta-filter context (quiz grade, submission analytics, edit history,
 * duplicate-email, completeness, PDF generation status) onto plain in-memory response
 * objects so `applyResponseFilters`' in-memory fallback in responseFilterService.ts can
 * actually evaluate the __* meta fieldIds defined there.
 *
 * Needed because two call sites filter responses entirely in memory rather than via the
 * SQL path in responseQueryBuilder.ts: pdfGeneratorService.ts (generator match count /
 * matching-responses list) and unifiedExport.ts (filtered export). Both start from
 * getAllResponsesByFormId, which — like responseRepository.listByForm — returns bare
 * Response rows with none of these relations joined in.
 *
 * Skips every query for a category no filter actually references (mirrors the SQL path's
 * "only join what's needed" guarantee), so a form/export that never filters on these
 * fields pays zero extra cost.
 */
import { prisma } from '../lib/prisma.js';
import type { ResponseFilter } from './responseFilterService.js';
import {
  GRADE_FIELD_IDS,
  SUBMISSION_ANALYTICS_FIELD_IDS,
  LAST_EDIT_FIELD_IDS,
  COMPLETENESS_FIELD_ID,
  isPdfGeneratedFieldId,
  pdfGeneratorIdFromFieldId,
} from './responseQueryBuilder.js';

/**
 * Structural type both callers' response shapes satisfy: FormResponse (from
 * getAllResponsesByFormId) and the raw Prisma Response rows returned by
 * responseRepository.listByForm. `data` is deliberately untyped (`unknown`) since the two
 * shapes disagree on it (Record<string, any> vs. Prisma.JsonValue) — this function only
 * ever reads it via Object.values for the completeness count.
 */
export interface FilterableResponse {
  id: string;
  data?: unknown;
  respondentEmail?: string | null;
  respondentUserId?: string | null;
  grade?: { percentage: number; passed: boolean; status: string; attemptNumber: number };
  submissionAnalytics?: {
    completionTimeSeconds?: number | null;
    browser?: string | null;
    operatingSystem?: string | null;
    countryAlpha2?: string | null;
  };
  lastEditedAt?: Date | string;
  lastEditedByEmail?: string;
  completenessPercent?: number;
  isDuplicateEmail?: boolean;
  pdfGeneratedByGenerator?: Record<string, boolean>;
}

const need = (filters: ResponseFilter[] | undefined, ids: Set<string>): boolean =>
  !!filters?.some((f) => ids.has(f.fieldId));

/**
 * Enriches `responses` in place with whichever of `.grade`, `.submissionAnalytics`,
 * `.lastEditedAt`/`.lastEditedByEmail`, `.isDuplicateEmail`, `.completenessPercent`,
 * `.pdfGeneratedByGenerator` the given `filters` actually reference — the exact shape
 * responseFilterService.ts's meta-field fallback branches read.
 */
export async function attachFilterContext(
  responses: FilterableResponse[],
  formId: string,
  filters?: ResponseFilter[]
): Promise<void> {
  if (!filters || filters.length === 0 || responses.length === 0) return;

  const ids = responses.map((r) => r.id);

  const needsGrade = need(filters, GRADE_FIELD_IDS);
  const needsAnalytics = need(filters, SUBMISSION_ANALYTICS_FIELD_IDS);
  const needsLastEdit = need(filters, LAST_EDIT_FIELD_IDS);
  const needsCompleteness = filters.some((f) => f.fieldId === COMPLETENESS_FIELD_ID);
  const needsDuplicate = filters.some((f) => f.fieldId === '__duplicateEmail');
  const pdfGeneratorIds = filters
    .filter((f) => isPdfGeneratedFieldId(f.fieldId))
    .map((f) => pdfGeneratorIdFromFieldId(f.fieldId));

  const [grades, analytics, lastEdits, formMetadata, pdfResults] = await Promise.all([
    needsGrade
      ? prisma.responseGrade.findMany({ where: { responseId: { in: ids } } })
      : Promise.resolve([]),
    needsAnalytics
      ? prisma.formSubmissionAnalytics.findMany({ where: { responseId: { in: ids } } })
      : Promise.resolve([]),
    // DISTINCT ON — one row per response (the most recent edit) — rather than fetching
    // every edit-history row and reducing in JS: a heavily-edited response otherwise
    // transfers and retains every discarded edit just to find its latest one.
    needsLastEdit
      ? prisma.$queryRaw<{ responseId: string; editedAt: Date; editedByEmail: string | null }[]>`
          SELECT DISTINCT ON (reh."responseId")
            reh."responseId" AS "responseId",
            reh."editedAt" AS "editedAt",
            u.email AS "editedByEmail"
          FROM "response_edit_history" reh
          LEFT JOIN "user" u ON u.id = reh."editedById"
          WHERE reh."responseId" = ANY(${ids})
          ORDER BY reh."responseId", reh."editedAt" DESC
        `
      : Promise.resolve([]),
    needsCompleteness
      ? prisma.formMetadata.findUnique({ where: { formId } })
      : Promise.resolve(null),
    pdfGeneratorIds.length > 0
      ? prisma.pdfGenerationResult.findMany({
          where: { generatorId: { in: pdfGeneratorIds }, responseId: { in: ids }, status: 'success' },
        })
      : Promise.resolve([]),
  ]);

  const gradeByResponseId = new Map(grades.map((g) => [g.responseId, g]));
  const analyticsByResponseId = new Map(analytics.map((a) => [a.responseId, a]));

  // Already exactly one (the most recent) row per response — DISTINCT ON did the reduction in SQL.
  const lastEditByResponseId = new Map(
    lastEdits.map((edit) => [edit.responseId, { editedAt: edit.editedAt, editedByEmail: edit.editedByEmail ?? undefined }])
  );

  let emailCounts: Map<string, number> | undefined;
  if (needsDuplicate) {
    emailCounts = new Map();
    const allEmails = await prisma.response.findMany({
      where: { formId, deletedAt: null, respondentEmail: { not: null } },
      select: { respondentEmail: true },
    });
    for (const { respondentEmail } of allEmails) {
      if (!respondentEmail) continue;
      emailCounts.set(respondentEmail, (emailCounts.get(respondentEmail) ?? 0) + 1);
    }
  }

  const pdfGeneratedByResponseId = new Map<string, Set<string>>();
  for (const result of pdfResults) {
    if (!pdfGeneratedByResponseId.has(result.responseId)) {
      pdfGeneratedByResponseId.set(result.responseId, new Set());
    }
    pdfGeneratedByResponseId.get(result.responseId)!.add(result.generatorId);
  }

  for (const response of responses) {
    if (needsGrade) response.grade = gradeByResponseId.get(response.id);
    if (needsAnalytics) response.submissionAnalytics = analyticsByResponseId.get(response.id);
    if (needsLastEdit) {
      const lastEdit = lastEditByResponseId.get(response.id);
      response.lastEditedAt = lastEdit?.editedAt;
      response.lastEditedByEmail = lastEdit?.editedByEmail;
    }
    if (needsCompleteness) {
      const data = (response.data as Record<string, unknown> | null) ?? {};
      const nonEmptyKeys = Object.values(data).filter(
        (v) => v !== null && v !== undefined && v !== ''
      ).length;
      const fieldCount = formMetadata?.fieldCount ?? 0;
      response.completenessPercent = fieldCount > 0 ? (nonEmptyKeys / fieldCount) * 100 : undefined;
    }
    if (needsDuplicate) {
      response.isDuplicateEmail =
        !!response.respondentEmail && (emailCounts?.get(response.respondentEmail) ?? 0) > 1;
    }
    if (pdfGeneratorIds.length > 0) {
      const generated = pdfGeneratedByResponseId.get(response.id) ?? new Set();
      response.pdfGeneratedByGenerator = Object.fromEntries(
        pdfGeneratorIds.map((id) => [id, generated.has(id)])
      );
    }
  }
}
