import {
  deleteResponse,
  deleteResponses,
  getAllResponses,
  getResponseById,
  getResponsesByFormId,
  submitResponse,
  submitResponseWithMaxLimitCheck,
  updateResponse,
} from '../../services/responseService.js';
import { Prisma } from '#prisma-client';
import { ResponseFilter } from '../../services/responseFilterService.js';
import { getFormById, getAccessibleFormIds } from '../../services/formService.js';
import {
  BetterAuthContext,
  requireAuth,
  requireOrganizationMembership,
} from '../../middleware/better-auth-middleware.js';
import {
  createFieldLabelsMap,
  generateId,
  substituteMentions,
} from '@dculus/utils';
import { deserializeFormSchema, DEFAULT_THANK_YOU_CONTENT } from '@dculus/types';
import type { RespondentGradeView, QuizGradingMetadata } from '@dculus/types';
import { pluginTypeFromMetadataKey } from '../../plugins/core/exportRegistry.js';
import { QUIZ_GRADING_PLUGIN_TYPE } from '../../plugins/quiz/types.js';
import { stripConditionallyHiddenValues } from '../../lib/conditionalStrip.js';
import { getFormSchemaFromHocuspocus } from '../../services/hocuspocus.js';
import { gradeResponse } from '../../services/quiz/gradingEngine.js';
import { saveGrade, toRespondentView, getMyQuizResult } from '../../services/quiz/gradingService.js';
import { analyticsService } from '../../services/analyticsService.js';
import { emitFormSubmitted } from '../../plugins/core/events.js';
import { checkUsageExceeded } from '../../subscriptions/usageService.js';
import { emitFormSubmitted as emitSubscriptionFormSubmitted } from '../../subscriptions/events.js';
import { checkFormAccess, PermissionLevel } from './formSharing.js';
import { createGraphQLError } from '#graphql-errors';
import { GRAPHQL_ERROR_CODES } from '@dculus/types/graphql.js';
import { logger } from '../../lib/logger.js';
import { audit } from '../../lib/audit.js';
import { upsertPreviewTag, addTagToResponse } from '../../services/tagService.js';
import { enforceTimeWindow } from '../../lib/timeWindowEnforcement.js';
import { enforceAccessControlForSubmission, requiresRespondentIdentity } from '../../lib/accessControlEnforcement.js';
import {
  generateFakeResponsesForForm,
  MAX_FAKE_RESPONSES_PER_REQUEST,
} from '../../services/fakeResponseService.js';
import { checkAITokenBudget, recordAITokenUsage } from '../../services/aiUsageService.js';
import { sendResponseCopyIfEnabled } from '../../services/responseCopyService.js';
import { responseGradeRepository } from '../../repositories/index.js';

interface ResponseParent {
  id: string;
  formId: string;
  _editHistoryPromise?: Promise<Awaited<ReturnType<typeof import('../../services/responseEditTrackingService.js').ResponseEditTrackingService.getEditHistory>>>;
}

// Stores a Promise on the parent object so all 5 FormResponse field resolvers that
// need edit history share one DB query per response per request, instead of firing 5.
async function getEditHistoryMemoised(parent: ResponseParent) {
  if (!parent._editHistoryPromise) {
    const { ResponseEditTrackingService } = await import(
      '../../services/responseEditTrackingService.js'
    );
    parent._editHistoryPromise = ResponseEditTrackingService.getEditHistory(parent.id);
  }
  return parent._editHistoryPromise;
}

// Native Quiz (epic #289, Story 11): per-request cache of formId -> form-access
// Promise, keyed off the GraphQL context object. A single responsesByForm page
// shares one formId across every row, so this collapses what would otherwise be
// one permission-check query per row into exactly one for the whole request.
const formAccessCache = new WeakMap<object, Map<string, ReturnType<typeof checkFormAccess>>>();

function getCachedFormAccess(context: { auth: BetterAuthContext }, userId: string, formId: string) {
  let cache = formAccessCache.get(context);
  if (!cache) {
    cache = new Map();
    formAccessCache.set(context, cache);
  }
  const key = `${userId}:${formId}`;
  let pending = cache.get(key);
  if (!pending) {
    pending = checkFormAccess(userId, formId, PermissionLevel.VIEWER);
    cache.set(key, pending);
  }
  return pending;
}

/**
 * Native Quiz (epic #289, Story 11) legacy compatibility: a response graded
 * by the old quiz-grading plugin (before ResponseGrade existed, or from an
 * instance never migrated) has its score in Response.metadata under a
 * 'quiz-grading' or 'quiz-grading:<pluginId>' key instead of a ResponseGrade
 * row. Reading this fallback lets a form migrated mid-term show one
 * continuous Score/Status column rather than a half-empty one. Returns the
 * same shape the ResponseGrade-backed path returns, so callers don't need to
 * know which source the data came from.
 */
function legacyQuizGradeFromMetadata(metadata: unknown): {
  score: number;
  maxScore: number;
  percentage: number;
  passed: boolean;
  status: string;
  gradedAt: string;
  detail: Array<{
    fieldId: string;
    fieldLabel: string;
    fieldType: string;
    mode: string;
    submittedValue: unknown;
    acceptedAnswers: string[];
    correct: boolean;
    pointsAwarded: number;
    pointValue: number;
    autoPointsAwarded: number;
  }>;
} | null {
  if (!metadata || typeof metadata !== 'object') return null;

  for (const [key, value] of Object.entries(metadata as Record<string, unknown>)) {
    if (pluginTypeFromMetadataKey(key) !== QUIZ_GRADING_PLUGIN_TYPE) continue;
    if (!value || typeof value !== 'object') continue;

    const legacy = value as Partial<QuizGradingMetadata>;
    if (
      typeof legacy.quizScore !== 'number' ||
      typeof legacy.totalMarks !== 'number' ||
      typeof legacy.percentage !== 'number'
    ) {
      continue;
    }

    const passThreshold = legacy.passThreshold ?? 60;
    const passed = legacy.percentage >= passThreshold;

    return {
      score: legacy.quizScore,
      maxScore: legacy.totalMarks,
      percentage: legacy.percentage,
      passed,
      // The old plugin has no manual-review workflow — every legacy grade is
      // effectively machine-graded, so it never surfaces "Needs review".
      status: 'AUTO_GRADED',
      gradedAt: legacy.gradedAt ?? new Date(0).toISOString(),
      detail: (legacy.fieldResults ?? []).map((r) => ({
        fieldId: r.fieldId,
        fieldLabel: r.fieldLabel,
        // Not recorded by the old plugin — the drawer falls back to raw
        // string display when fieldType is unrecognized.
        fieldType: '',
        mode: 'exact',
        submittedValue: r.userAnswer,
        acceptedAnswers: r.correctAnswer !== undefined ? [r.correctAnswer] : [],
        correct: r.isCorrect,
        pointsAwarded: r.marksAwarded,
        pointValue: r.maxMarks,
        autoPointsAwarded: r.marksAwarded,
      })),
    };
  }

  return null;
}

export const responsesResolvers = {
  Query: {
    responses: async (
      _: any,
      { organizationId }: { organizationId: string },
      context: { auth: BetterAuthContext }
    ) => {
      // 🔒 SECURITY: Verify user is a member of the target organization
      await requireOrganizationMembership(context.auth, organizationId);

      const userId = context.auth.user!.id;

      // 🔒 SECURITY: Scope to forms the user can actually access (VIEWER or above).
      // Org membership alone is not sufficient — a NO_ACCESS permission must be respected.
      const accessibleFormIds = await getAccessibleFormIds(organizationId, userId);
      const allResponses = await getAllResponses(organizationId);
      return allResponses.filter((r) => accessibleFormIds.includes(r.formId));
    },
    response: async (
      _: any,
      { id }: { id: string },
      context: { auth: BetterAuthContext }
    ) => {
      requireAuth(context.auth);
      const response = await getResponseById(id);
      if (!response) throw createGraphQLError('Response not found', GRAPHQL_ERROR_CODES.RESPONSE_NOT_FOUND);

      const accessCheck = await checkFormAccess(context.auth.user!.id, response.formId, PermissionLevel.VIEWER);
      if (!accessCheck.hasAccess) {
        throw createGraphQLError('Access denied: You do not have permission to view this response', GRAPHQL_ERROR_CODES.NO_ACCESS);
      }

      return response;
    },
    responsesByForm: async (
      _: any,
      {
        formId,
        page = 1,
        limit = 10,
        sortBy = 'submittedAt',
        sortOrder = 'desc',
        filters,
        filterLogic = 'AND',
      }: {
        formId: string;
        page?: number;
        limit?: number;
        sortBy?: string;
        sortOrder?: string;
        filters?: ResponseFilter[];
        filterLogic?: 'AND' | 'OR';
      },
      context: { auth: BetterAuthContext; req?: any }
    ) => {
      requireAuth(context.auth);

      // Check if the user has access to this form before allowing response access
      const form = await getFormById(formId);
      if (!form) {
        throw createGraphQLError('Form not found', GRAPHQL_ERROR_CODES.FORM_NOT_FOUND);
      }

      await requireOrganizationMembership(context.auth, form.organizationId);

      const accessCheck = await checkFormAccess(context.auth.user!.id, formId, PermissionLevel.VIEWER);
      if (!accessCheck.hasAccess) {
        throw createGraphQLError('Access denied: You need VIEWER access to view responses for this form', GRAPHQL_ERROR_CODES.NO_ACCESS);
      }

      return await getResponsesByFormId(
        formId,
        page,
        limit,
        sortBy,
        sortOrder as 'asc' | 'desc',
        filters,
        filterLogic
      );
    },
  },
  Mutation: {
    submitResponse: async (_: any, { input }: { input: any }, context: { auth: BetterAuthContext; req?: any }) => {
      // Get form first to check if it exists and is published
      const form = await getFormById(input.formId);
      if (!form) {
        throw createGraphQLError('Form not found', GRAPHQL_ERROR_CODES.FORM_NOT_FOUND);
      }

      // `isPreview` bypasses both the publish check and access-control below —
      // it must only be honored for a caller who actually has builder access
      // to this form, otherwise anyone can pass isPreview: true to submit to
      // an unpublished or access-restricted form with no sign-in/domain check.
      if (input.isPreview) {
        requireAuth(context.auth);
        const previewAccessCheck = await checkFormAccess(context.auth.user!.id, form.id, PermissionLevel.EDITOR);
        if (!previewAccessCheck.hasAccess) {
          throw createGraphQLError('Access denied: editor permissions required to preview this form', GRAPHQL_ERROR_CODES.NO_ACCESS);
        }
      }

      // Check if form is published — preview submissions bypass this so builders can test draft forms
      if (!form.isPublished && !input.isPreview) {
        throw createGraphQLError('Form is not published and cannot accept responses', GRAPHQL_ERROR_CODES.FORM_NOT_PUBLISHED);
      }

      // Check access control (require sign-in / email-domain allowlist) — the
      // actual security boundary, re-validated here regardless of what
      // form-viewer's gate UI showed, since this mutation is public and
      // callable directly. Builders previewing their own form bypass this
      // (now that isPreview itself is verified above) — no reason a
      // preview session's email needs to be in the form's own allowlist.
      // `collectRespondentEmail` also requires sign-in (to capture a
      // verified email) even when accessControl.enabled is false and there's
      // no domain restriction at all.
      const accessControl = form.settings?.accessControl;
      const collectRespondentEmail = form.settings?.collectRespondentEmail;
      const requiresIdentity = requiresRespondentIdentity(accessControl, collectRespondentEmail);
      if (requiresIdentity && !input.isPreview) {
        enforceAccessControlForSubmission(accessControl, collectRespondentEmail, context.auth);
      }

      // Check subscription usage limits
      const usageExceeded = await checkUsageExceeded(form.organizationId);
      if (usageExceeded.submissionsExceeded) {
        throw createGraphQLError('Form submission limit exceeded for this organization subscription plan', GRAPHQL_ERROR_CODES.SUBMISSION_LIMIT_EXCEEDED);
      }

      // P2-04: Validate response payload size to prevent unbounded writes
      if (input.data && typeof input.data === 'object') {
        const keys = Object.keys(input.data as object);
        if (keys.length > 500) {
          throw createGraphQLError('Response data cannot contain more than 500 fields', GRAPHQL_ERROR_CODES.BAD_USER_INPUT);
        }
        for (const [key, value] of Object.entries(input.data as object)) {
          if (typeof value === 'string' && value.length > 10_000) {
            throw createGraphQLError(`Field "${key}" exceeds the 10,000 character limit`, GRAPHQL_ERROR_CODES.BAD_USER_INPUT);
          }
        }
      }

      // Live schema for form.id (Hocuspocus, falling back to the DB column),
      // resolved at most once and shared by conditional stripping below and
      // quiz grading further down — both need the exact same schema, and
      // getFormSchemaFromHocuspocus is a DB read plus a full Y.Doc rebuild,
      // not a cheap call to repeat.
      let liveSchema: unknown;
      let liveSchemaResolved = false;
      const resolveLiveSchema = async () => {
        if (!liveSchemaResolved) {
          liveSchema = (await getFormSchemaFromHocuspocus(form.id)) ?? form.formSchema;
          liveSchemaResolved = true;
        }
        return liveSchema;
      };

      // Server-side conditional-logic enforcement (defense in depth): strip
      // values of fields/pages the form's rules hide, evaluated against the
      // same live schema the viewer was served. The client strips too, but
      // this mutation is public and callable directly. Runs before BOTH
      // insert paths below.
      if (input.data && typeof input.data === 'object') {
        const schema = await resolveLiveSchema();
        if (schema) {
          input.data = stripConditionallyHiddenValues(
            schema,
            input.data as Record<string, unknown>
          );
        }
      }

      // Pre-assign the response ID so it can be used inside the serializable
      // transaction (maxResponses path) and also in the normal path below.
      const responseId = generateId();
      // Only ever captured when the form's own settings ask for it — never
      // record identity on a form that didn't require sign-in, even if a
      // stale respondent token happens to be present on the request.
      const respondentUserId = requiresIdentity ? context.auth?.user?.id ?? null : null;
      const respondentEmail = requiresIdentity ? context.auth?.user?.email ?? null : null;
      const responseData = {
        id: responseId,
        formId: input.formId,
        data: input.data,
        respondentUserId,
        respondentEmail,
        submittedAt: new Date(),
      };

      // Track whether the response row has already been created inside a
      // serializable transaction (maxResponses atomic check-then-insert path).
      let response: import('@dculus/types').FormResponse | null = null;

      // Check submission limits if they exist
      if (form.settings?.submissionLimits) {
        const limits = form.settings.submissionLimits;

        // Check maximum responses limit — atomic check-then-insert via a
        // Serializable transaction (responseService.submitResponseWithMaxLimitCheck)
        // so two concurrent requests cannot both pass the count check and both
        // insert, exceeding the limit by one.
        if (limits.maxResponses?.enabled) {
          response = await submitResponseWithMaxLimitCheck(
            {
              id: responseId,
              formId: input.formId,
              data: (input.data || {}) as Prisma.InputJsonValue,
              respondentUserId,
              respondentEmail,
            },
            limits.maxResponses.limit
          );
        }

        // Check time window limits
        if (limits.timeWindow) {
          enforceTimeWindow(limits.timeWindow);
        }
      }

      // If the response was not already inserted by the atomic maxResponses
      // transaction above, persist it now via the normal path.
      if (!response) {
        response = await submitResponse(responseData);
      }
      // At this point response is guaranteed non-null — both branches above set it.
      const savedResponse = response!;

      // Native Quiz (D3, epic #289): grade synchronously, here, so the score
      // can be included in this mutation's payload — emitFormSubmitted below
      // fires after this resolver returns and structurally cannot do that.
      // Grades against input.data AFTER stripConditionallyHiddenValues ran
      // above (~line 209), so a question hidden by conditional logic is
      // excluded from maxScore rather than scored wrong — two respondents
      // can legitimately face different denominators.
      // Additive guarantee: settings.quiz absent/disabled is zero extra work
      // below — no schema fetch, no grading engine call, no ResponseGrade
      // write, and `grade` stays undefined so it is omitted from the payload.
      let grade: RespondentGradeView | undefined;
      let quizFanout:
        | { quizScore: number; quizMaxScore: number; quizPercentage: number; quizPassed: boolean }
        | undefined;

      const quizSettings = form.settings?.quiz;
      if (quizSettings?.enabled) {
        try {
          const schema = await resolveLiveSchema();
          if (schema) {
            const deserializedSchema = deserializeFormSchema(schema);
            const gradeResult = gradeResponse(
              deserializedSchema,
              quizSettings,
              (input.data || {}) as Record<string, unknown>
            );
            const savedGrade = await saveGrade({
              responseId: savedResponse.id,
              score: gradeResult.score,
              maxScore: gradeResult.maxScore,
              percentage: gradeResult.percentage,
              passed: gradeResult.passed,
              status: gradeResult.status,
              autoScore: gradeResult.score,
              detail: gradeResult.questions,
            });
            grade = toRespondentView(savedGrade, quizSettings);
            quizFanout = {
              quizScore: savedGrade.score,
              quizMaxScore: savedGrade.maxScore,
              quizPercentage: savedGrade.percentage,
              quizPassed: savedGrade.passed,
            };
          }
        } catch (error) {
          // D7: losing a response to a grading bug is far worse than an
          // ungraded one — log, best-effort persist a NEEDS_REVIEW grade, and
          // let the submission succeed either way.
          logger.error('Error grading quiz response:', error);
          try {
            // Persisted for a human reviewer, but deliberately not assigned to
            // `grade`/`quizFanout`: under gradeRelease 'immediate' (and a
            // past-due 'scheduled' release), toRespondentView.isReleased()
            // ignores grade status entirely, so surfacing this placeholder
            // would show the respondent — and automations via quizPassed —
            // a false "you scored 0%" instead of just staying silent.
            await saveGrade({
              responseId: savedResponse.id,
              score: 0,
              maxScore: 0,
              percentage: 0,
              passed: false,
              status: 'NEEDS_REVIEW',
              autoScore: 0,
              detail: [],
            });
          } catch (persistError) {
            logger.error(
              'Error persisting NEEDS_REVIEW grade after grading failure:',
              persistError
            );
          }
        }
      }

      // Auto-assign __preview__ system tag when submitted from the builder preview panel
      if (input.isPreview) {
        try {
          const previewTag = await upsertPreviewTag(input.formId);
          await addTagToResponse(savedResponse.id, previewTag.id, input.formId);
        } catch (error) {
          logger.error('Error auto-tagging preview response:', error);
        }
      }

      // Track submission analytics if analytics data is provided
      if (input.sessionId && input.userAgent) {
        try {
          // Get client IP from request
          const clientIP =
            context.req?.ip ||
            context.req?.connection?.remoteAddress ||
            context.req?.socket?.remoteAddress ||
            (context.req?.headers?.['x-forwarded-for'] as string)?.split(
              ','
            )[0];

          const visitorGeo = context.req?.visitorGeo;

          // Track the submission analytics
          await analyticsService.trackFormSubmission(
            {
              formId: input.formId,
              responseId: savedResponse.id,
              sessionId: input.sessionId,
              userAgent: input.userAgent,
              timezone: input.timezone,
              language: input.language,
              completionTimeSeconds: input.completionTimeSeconds,
              embedContext: input.embedContext,
              embedHost: input.embedHost,
              visitorGeo,
            },
            clientIP
          );

          logger.info(
            `Submission analytics tracked for form ${input.formId}, response ${savedResponse.id}`
          );
        } catch (error) {
          // Log error but don't fail the response submission
          logger.error('Error tracking submission analytics:', error);
        }
      }

      // Get form to resolve the thank-you message from its layout
      const formWithSettings = await getFormById(input.formId);

      // Thank you message always comes from formSchema.layout.thankYouContent
      // (falling back to the default for forms saved before this field existed),
      // with field mentions substituted against the submitted answers. Reads the
      // live Hocuspocus document first (same "Hocuspocus, then DB column" fallback
      // used by the Form.formSchema/formSchemaPublic GraphQL field resolvers in
      // forms.ts) — the Form.formSchema DB column is only a periodic snapshot and
      // can lag behind in-progress collaborative edits.
      let thankYouMessage = DEFAULT_THANK_YOU_CONTENT;

      try {
        let fieldLabels: Record<string, string> = {};
        let template = DEFAULT_THANK_YOU_CONTENT;

        const rawSchema =
          (await getFormSchemaFromHocuspocus(input.formId)) ?? formWithSettings?.formSchema;

        if (rawSchema) {
          const deserializedSchema = deserializeFormSchema(rawSchema);
          fieldLabels = createFieldLabelsMap(deserializedSchema);
          template =
            deserializedSchema.layout?.thankYouContent || DEFAULT_THANK_YOU_CONTENT;
        }

        thankYouMessage = substituteMentions(
          template,
          input.data, // User responses as field_id: value pairs
          fieldLabels // Field labels for fallback display
        );
      } catch (error) {
        // If substitution fails, log error but continue with original message
        logger.error('Failed to apply mention substitution:', error);
      }

      // Emit plugin event for form submission
      try {
        emitFormSubmitted(input.formId, form.organizationId, {
          // input.data is user-submitted field values; spreading it first (and the
          // control fields after) keeps a form field literally named "responseId"/
          // "isPreview"/"quizScore" from spoofing these — isPreview in particular
          // now gates whether automations fire, so it must stay server-authoritative.
          // quizFanout (quizScore/quizMaxScore/quizPercentage/quizPassed) is only
          // present when settings.quiz is enabled and grading actually ran.
          ...input.data,
          responseId: savedResponse.id,
          submittedAt: savedResponse.submittedAt.toISOString(),
          isPreview: Boolean(input.isPreview),
          ...(quizFanout ?? {}),
        });
      } catch (error) {
        // Log error but don't fail the response submission
        logger.error('Error emitting form.submitted event:', error);
      }

      // Emit subscription event for usage tracking
      try {
        emitSubscriptionFormSubmitted(form.organizationId, input.formId, savedResponse.id);
      } catch (error) {
        logger.error('Error emitting subscription event:', error);
      }

      // Email the respondent a copy of their answers, if the form owner enabled it.
      // Fire-and-forget — must not add PDF-generation/email latency to the submit response.
      // Skipped for builder preview submissions so testing a form never sends a real email
      // (mirrors the isPreview check used for tagging/publish-gating above).
      if (formWithSettings && !input.isPreview) {
        sendResponseCopyIfEnabled({
          form: formWithSettings,
          response: savedResponse,
          consent: Boolean(input.sendResponseCopy),
        }).catch((error) => {
          logger.error('Error sending response copy email:', error);
        });
      }

      return {
        ...savedResponse,
        thankYouMessage,
        // Omitted entirely (not `grade: undefined`) when quiz grading did not
        // run — keeps the payload byte-identical to before this change for
        // every non-quiz form (epic #289's additive guarantee).
        ...(grade !== undefined ? { grade } : {}),
      };
    },
    updateResponse: async (
      _: any,
      {
        input,
      }: {
        input: {
          responseId: string;
          data: Record<string, any>;
          editReason?: string;
        };
      },
      context: { auth: BetterAuthContext; req?: any }
    ) => {
      requireAuth(context.auth);

      // 1. Validate response exists
      const existingResponse = await getResponseById(input.responseId);
      if (!existingResponse) {
        throw createGraphQLError('Response not found', GRAPHQL_ERROR_CODES.RESPONSE_NOT_FOUND);
      }

      // 2. Check user permissions (form owner/editor access)
      const form = await getFormById(existingResponse.formId);
      if (!form) {
        throw createGraphQLError('Form not found', GRAPHQL_ERROR_CODES.FORM_NOT_FOUND);
      }

      await requireOrganizationMembership(context.auth, form.organizationId);

      const accessCheck = await checkFormAccess(context.auth.user!.id, existingResponse.formId, PermissionLevel.EDITOR);
      if (!accessCheck.hasAccess) {
        throw createGraphQLError('Access denied: You need EDITOR access to update responses for this form', GRAPHQL_ERROR_CODES.NO_ACCESS);
      }

      // Same conditional-logic enforcement as submitResponse — edits flow
      // through the identical strip gate, so values cleared by rules are
      // recorded as DELETE field changes by the edit tracker below
      if (input.data && typeof input.data === 'object') {
        const liveSchema =
          (await getFormSchemaFromHocuspocus(form.id)) ?? form.formSchema;
        if (liveSchema) {
          input.data = stripConditionallyHiddenValues(
            liveSchema,
            input.data as Record<string, unknown>
          ) as Record<string, any>;
        }
      }

      // 3. Prepare edit tracking context
      const editContext = {
        userId: context.auth.user.id,
        ipAddress:
          context.req?.ip ||
          context.req?.connection?.remoteAddress ||
          context.req?.socket?.remoteAddress ||
          (context.req?.headers?.['x-forwarded-for'] as string)?.split(',')[0],
        userAgent: context.req?.headers?.['user-agent'],
        editReason: input.editReason,
        organizationId: form.organizationId,
      };

      // 4. Update response data with edit tracking
      return await updateResponse(input.responseId, input.data, editContext);
    },
    deleteResponse: async (
      _: any,
      { id }: { id: string },
      context: { auth: BetterAuthContext }
    ) => {
      requireAuth(context.auth);

      // 🔒 SECURITY: Fetch response with form information
      const existingResponse = await getResponseById(id);
      if (!existingResponse) {
        throw createGraphQLError('Response not found', GRAPHQL_ERROR_CODES.RESPONSE_NOT_FOUND);
      }

      // 🔒 SECURITY: Verify user has OWNER access to the form before allowing response deletion
      const accessCheck = await checkFormAccess(
        context.auth.user!.id,
        existingResponse.formId,
        PermissionLevel.OWNER
      );
      if (!accessCheck.hasAccess) {
        throw createGraphQLError('Access denied: You need OWNER access to delete responses for this form', GRAPHQL_ERROR_CODES.NO_ACCESS);
      }

      const result = await deleteResponse(id);
      await audit('response.deleted', 'Response', id, context.auth.user?.id);
      return result;
    },

    deleteResponses: async (
      _: any,
      { formId, ids }: { formId: string; ids: string[] },
      context: { auth: BetterAuthContext }
    ) => {
      requireAuth(context.auth);

      // 🔒 SECURITY: Require OWNER access to bulk-delete responses
      const accessCheck = await checkFormAccess(
        context.auth.user!.id,
        formId,
        PermissionLevel.OWNER
      );
      if (!accessCheck.hasAccess) {
        throw createGraphQLError('Access denied: You need OWNER access to delete responses for this form', GRAPHQL_ERROR_CODES.NO_ACCESS);
      }

      const result = await deleteResponses(formId, ids);
      await audit('response.bulk_deleted', 'Form', formId, context.auth.user?.id);
      return result;
    },

    generateFakeResponses: async (
      _: any,
      { formId, count }: { formId: string; count: number },
      context: { auth: BetterAuthContext }
    ) => {
      requireAuth(context.auth);

      const form = await getFormById(formId);
      if (!form) {
        throw createGraphQLError('Form not found', GRAPHQL_ERROR_CODES.FORM_NOT_FOUND);
      }
      await requireOrganizationMembership(context.auth, form.organizationId);

      // Spends the org's AI credit budget, same rights as saving the form.
      const accessCheck = await checkFormAccess(context.auth.user!.id, formId, PermissionLevel.EDITOR);
      if (!accessCheck.hasAccess) {
        throw createGraphQLError('Access denied: You need EDITOR access to generate fake responses', GRAPHQL_ERROR_CODES.NO_ACCESS);
      }

      if (!Number.isInteger(count) || count < 1 || count > MAX_FAKE_RESPONSES_PER_REQUEST) {
        throw createGraphQLError(
          `count must be between 1 and ${MAX_FAKE_RESPONSES_PER_REQUEST}`,
          GRAPHQL_ERROR_CODES.BAD_USER_INPUT
        );
      }

      const budget = await checkAITokenBudget(form.organizationId);
      if (!budget.allowed) {
        throw createGraphQLError(
          `AI credit limit reached (${budget.used.toLocaleString()} / ${budget.limit.toLocaleString()} credits used this month). Upgrade your plan to continue.`,
          GRAPHQL_ERROR_CODES.AI_TOKEN_LIMIT_EXCEEDED
        );
      }

      try {
        const deserializedSchema = deserializeFormSchema(form.formSchema);
        const result = await generateFakeResponsesForForm(formId, form.title, deserializedSchema, count);
        await recordAITokenUsage(form.organizationId, result.tokensUsed, 'nano');
        return result.created;
      } catch (error) {
        logger.error({ err: error, formId }, 'Fake response generation failed');
        throw createGraphQLError('Fake response generation failed. Please try again.', GRAPHQL_ERROR_CODES.INTERNAL_SERVER_ERROR);
      }
    },
  },
};

// Create extended resolvers with edit tracking functionality
logger.info('Loading extendedResponsesResolvers with FormResponse field resolvers');
export const extendedResponsesResolvers = {
  Query: {
    ...responsesResolvers.Query,

    responseEditHistory: async (
      _: any,
      { responseId }: { responseId: string },
      context: { auth: BetterAuthContext }
    ) => {
      requireAuth(context.auth);

      const { ResponseEditTrackingService } = await import(
        '../../services/responseEditTrackingService.js'
      );

      // Check permissions
      const existingResponse = await getResponseById(responseId);
      if (!existingResponse) {
        throw createGraphQLError('Response not found', GRAPHQL_ERROR_CODES.RESPONSE_NOT_FOUND);
      }

      const form = await getFormById(existingResponse.formId);
      if (!form) {
        throw createGraphQLError('Form not found', GRAPHQL_ERROR_CODES.FORM_NOT_FOUND);
      }

      await requireOrganizationMembership(context.auth, form.organizationId);

      // 🔒 SECURITY: Verify form-level access — org membership alone is not sufficient
      const accessCheck = await checkFormAccess(context.auth.user!.id, existingResponse.formId, PermissionLevel.VIEWER);
      if (!accessCheck.hasAccess) {
        throw createGraphQLError('Access denied: You do not have permission to view this response', GRAPHQL_ERROR_CODES.NO_ACCESS);
      }

      // Get edit history
      const editHistory =
        await ResponseEditTrackingService.getEditHistory(responseId);

      return editHistory.map((edit) => ({
        id: edit.id,
        responseId: edit.responseId,
        editedBy: edit.editedBy,
        editedAt: edit.editedAt.toISOString(),
        editType: edit.editType,
        editReason: edit.editReason,
        ipAddress: edit.ipAddress,
        userAgent: edit.userAgent,
        totalChanges: edit.totalChanges,
        changesSummary: edit.changesSummary,
        fieldChanges: edit.fieldChanges.map((change) => ({
          id: change.id,
          fieldId: change.fieldId,
          fieldLabel: change.fieldLabel,
          fieldType: change.fieldType,
          previousValue: change.previousValue,
          newValue: change.newValue,
          changeType: change.changeType,
          valueChangeSize: change.valueChangeSize,
        })),
      }));
    },

    // Native Quiz (epic #289, Story 16/#320, D9): lets a respondent retrieve
    // their OWN deferred-release grade ('afterReview'/'scheduled') outside
    // submitResponse, the only place `grade` was previously computed.
    // Deliberately `requireAuth` ONLY — no form-permission check. This
    // answers "is this your own submission", not "do you manage this form",
    // so a respondent with zero form access must still be able to call it.
    myQuizResult: async (
      _: any,
      { formId }: { formId: string },
      context: { auth: BetterAuthContext }
    ) => {
      requireAuth(context.auth);
      const userId = context.auth.user!.id;

      const form = await getFormById(formId);
      if (!form || !form.settings?.quiz?.enabled) return null;

      // Defense in depth (out-of-scope guarantee, epic #289 D9): mirrors the
      // exact requiresIdentity expression submitResponse uses. Not required
      // for correctness — respondentUserId is always null on an anonymous
      // form's responses, so it can never match a signed-in caller's id —
      // but makes the "anonymous forms are out of scope" guarantee explicit
      // instead of implicit, and skips a lookup that could only ever be empty.
      const requiresIdentity = requiresRespondentIdentity(
        form.settings?.accessControl,
        form.settings?.collectRespondentEmail
      );
      if (!requiresIdentity) return null;

      // Delegates the respondent-scoped lookup + release/visibility
      // projection to gradingService — resolvers stay thin, and this reuses
      // the exact same toRespondentView submitResponse uses rather than
      // hand-rolling a second projection (D5 precedent).
      return getMyQuizResult(formId, userId, form.settings.quiz);
    },
  },

  Mutation: {
    ...responsesResolvers.Mutation,
  },

  FormResponse: {
    submittedAt: (parent: any) => {
      // Convert Date object to ISO string for GraphQL
      if (parent.submittedAt instanceof Date) {
        return parent.submittedAt.toISOString();
      }
      // If already a string, return as is
      if (typeof parent.submittedAt === 'string') {
        return parent.submittedAt;
      }
      // If it's a number (Unix timestamp), convert to ISO string
      if (typeof parent.submittedAt === 'number') {
        return new Date(parent.submittedAt).toISOString();
      }
      return parent.submittedAt;
    },

    // Memoised per-response-per-request: all 5 field resolvers share one DB round-trip.
    // Storing the Promise on `parent` (the same object for all fields on one response)
    // means the first field to resolve kicks off the query; the rest await the same Promise.
    hasBeenEdited: async (parent: any) => {
      try {
        const history = await getEditHistoryMemoised(parent);
        return history.length > 0;
      } catch (error) {
        logger.error('Error getting hasBeenEdited for response:', parent.id, error);
        return false;
      }
    },

    totalEdits: async (parent: any) => {
      try {
        const history = await getEditHistoryMemoised(parent);
        return history.length;
      } catch (error) {
        logger.error('Error getting totalEdits for response:', parent.id, error);
        return 0;
      }
    },

    lastEditedAt: async (parent: any) => {
      try {
        const history = await getEditHistoryMemoised(parent);
        return history.length > 0 ? history[0].editedAt.toISOString() : null;
      } catch (error) {
        logger.error('Error getting lastEditedAt for response:', parent.id, error);
        return null;
      }
    },

    lastEditedBy: async (parent: any) => {
      try {
        const history = await getEditHistoryMemoised(parent);
        return history.length > 0 ? history[0].editedBy : null;
      } catch (error) {
        logger.error('Error getting lastEditedBy for response:', parent.id, error);
        return null;
      }
    },

    editHistory: async (parent: any) => {
      try {
        return await getEditHistoryMemoised(parent);
      } catch (error) {
        logger.error('Error getting editHistory for response:', parent.id, error);
        return [];
      }
    },

    // Native Quiz (epic #289, Story 11): the full builder-side grade record.
    // SECURITY: never reachable without VIEWER+ form access — checked here
    // explicitly (not just relied on at the parent query), since this field
    // is reachable from any FormResponse-returning resolver, including the
    // public submitResponse mutation where context.auth.user may be absent
    // or may belong to the anonymous respondent, not a form builder.
    // `detail` can contain correct answers, so this must fail closed (return
    // null) rather than leak grade data on any error.
    responseGrade: async (
      parent: any,
      _args: unknown,
      context: { auth: BetterAuthContext }
    ) => {
      if (!context.auth?.user) return null;
      try {
        const accessCheck = await getCachedFormAccess(context, context.auth.user.id, parent.formId);
        if (!accessCheck.hasAccess) return null;

        const gradeRow = await responseGradeRepository.findByResponseId(parent.id);
        if (gradeRow) {
          return {
            score: gradeRow.score,
            maxScore: gradeRow.maxScore,
            percentage: gradeRow.percentage,
            passed: gradeRow.passed,
            status: gradeRow.status,
            gradedAt: gradeRow.gradedAt.toISOString(),
            detail: Array.isArray(gradeRow.detail) ? gradeRow.detail : [],
          };
        }

        // Legacy compatibility: no native ResponseGrade row — fall back to
        // the old quiz-grading plugin's metadata so a form migrated mid-term
        // shows one continuous Score/Status column.
        return legacyQuizGradeFromMetadata(parent.metadata);
      } catch (error) {
        logger.error('Error getting responseGrade for response:', parent.id, error);
        return null;
      }
    },
  },
};
