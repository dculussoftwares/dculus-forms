import {
  getFormByShortUrl,
  createForm,
  updateForm,
  deleteForm,
  regenerateShortUrl,
  duplicateForm as duplicateFormService,
} from '../../services/formService.js';
import { getTemplateById } from '../../services/templateService.js';
import { getFormMetadata, constructBackgroundImageUrl, constructBackgroundVideoUrl } from '../../services/formMetadataService.js';
import { BetterAuthContext, requireAuth, requireOrganizationMembership } from '../../middleware/better-auth-middleware.js';
import { checkFormAccess, PermissionLevel } from './formSharing.js';
import { generateId } from '@dculus/utils';
import { copyFileForForm } from '../../services/fileUploadService.js';
import { getFormSchemaFromHocuspocus } from '../../services/hocuspocus.js';
import { createFormFile } from '../../services/formFileService.js';
import { getResponseCount, countAllResponses, getDashboardResponseCounts } from '../../services/responseService.js';
import { analyticsService } from '../../services/analyticsService.js';
import { randomUUID } from 'crypto';
import { createGraphQLError } from '#graphql-errors';
import { GRAPHQL_ERROR_CODES } from '@dculus/types/graphql.js';
import { sanitizeQuizSettings } from '@dculus/types';
import { checkUsageExceeded } from '../../subscriptions/usageService.js';
import { logger } from '../../lib/logger.js';
import { enforceTimeWindow } from '../../lib/timeWindowEnforcement.js';
import { resolveAccessStatus } from '../../lib/accessControlEnforcement.js';

// Sibling field resolvers on `Form` only see the raw `parent` DB row, not
// each other's resolved output, so both `accessStatus` and
// `formSchemaPublic` independently parse `parent.settings` via this helper.
const DOMAIN_RE = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i;

// Order-insensitive on `allowedDomains` so re-saving the same domain list in
// a different order isn't treated as a change requiring OWNER re-approval.
// Never-configured (null/undefined) and explicitly-disabled-with-no-domains
// must normalize to the SAME value — the frontend always sends a populated
// default accessControl object on every settings save (useFormSettings.ts),
// so treating "absent" and "default" as different would require OWNER
// permission for every settings save on every form that predates this field.
function normalizeAccessControlForComparison(accessControl: any) {
  return {
    enabled: !!accessControl?.enabled,
    requireSignIn: !!accessControl?.requireSignIn,
    allowedDomains: [...(accessControl?.allowedDomains ?? [])].map((d: string) => d.toLowerCase()).sort(),
  };
}

function getFormAccessStatus(parent: any, context: { auth: BetterAuthContext }) {
  const settings = parent.settings
    ? JSON.parse(typeof parent.settings === 'string' ? parent.settings : JSON.stringify(parent.settings))
    : null;
  return resolveAccessStatus(settings?.accessControl, settings?.collectRespondentEmail, context.auth);
}

export const formsResolvers = {
  Query: {
    form: async (_: any, { id }: { id: string }, context: { auth: BetterAuthContext }) => {
      requireAuth(context.auth);

      // Check if user has access to this form
      const accessCheck = await checkFormAccess(context.auth.user!.id, id, PermissionLevel.VIEWER);
      if (!accessCheck.hasAccess) {
        throw createGraphQLError('Access denied: You do not have permission to view this form', GRAPHQL_ERROR_CODES.NO_ACCESS);
      }

      return accessCheck.form;
    },
    formByShortUrl: async (_: any, { shortUrl }: { shortUrl: string }) => {
      const form = await getFormByShortUrl(shortUrl);
      if (!form) throw createGraphQLError("Form not found", GRAPHQL_ERROR_CODES.FORM_NOT_FOUND);
      if (!form.isPublished) throw createGraphQLError("Form is not published", GRAPHQL_ERROR_CODES.FORM_NOT_PUBLISHED);

      // Check subscription usage limits
      const usageExceeded = await checkUsageExceeded(form.organizationId);
      if (usageExceeded.viewsExceeded) {
        throw createGraphQLError("Form view limit exceeded for this organization's subscription plan", GRAPHQL_ERROR_CODES.VIEW_LIMIT_EXCEEDED);
      }

      // Check submission limits
      if (form.settings?.submissionLimits) {
        const limits = form.settings.submissionLimits;

        // Check maximum responses limit
        if (limits.maxResponses?.enabled) {
          const currentResponseCount = await countAllResponses(form.id);

          if (currentResponseCount >= limits.maxResponses.limit) {
            throw createGraphQLError("Form has reached its maximum response limit", GRAPHQL_ERROR_CODES.MAX_RESPONSES_REACHED);
          }
        }

        // Check time window limits
        if (limits.timeWindow) {
          enforceTimeWindow(limits.timeWindow);
        }
      }

      return form;
    },
  },
  Form: {
    metadata: async (parent: any) => {
      const formId = parent.id;
      const metadata = await getFormMetadata(formId);

      if (!metadata) {
        return null;
      }

      return {
        pageCount: metadata.pageCount,
        fieldCount: metadata.fieldCount,
        backgroundImageKey: metadata.backgroundImageKey,
        backgroundImageUrl: constructBackgroundImageUrl(metadata.backgroundImageKey),
        backgroundVideoKey: metadata.backgroundVideoKey,
        backgroundVideoUrl: constructBackgroundVideoUrl(metadata.backgroundVideoKey),
        backgroundDominantColor: metadata.backgroundDominantColor,
        lastUpdated: metadata.lastUpdated.toISOString(),
      };
    },
    formSchema: async (parent: any) => {
      const formId = parent.id;
      const schema = await getFormSchemaFromHocuspocus(formId);
      // Fall back to the DB column when Hocuspocus is unavailable (e.g. pool pressure timeout)
      return schema ?? parent.formSchema ?? null;
    },
    // This is the ONLY resolver the public form-viewer renders from
    // (apps/form-viewer/src/pages/FormViewer.tsx) — it is reachable by any
    // respondent, unauthenticated, before they submit anything. Every field's
    // optional `grading` (Native Quiz answer key: acceptedAnswers, pointValue,
    // etc. — see packages/types/src/quiz.ts) is stripped unconditionally
    // below, regardless of whether quiz mode is on, because leaking it here
    // would hand out the answer key to every respondent ahead of submission.
    // `Form.formSchema` (above) is the builder-only counterpart and keeps
    // `grading` intact for authors.
    //
    // The other two surfaces that read form structure are already safe and
    // need no stripping:
    //   - The Hocuspocus Y.doc (services/hocuspocus.ts) is builder-only —
    //     form-viewer never opens a Y.js connection; only the authenticated
    //     builder does, via CollaborationManager, which sends a bearer token
    //     (apps/form-app/src/store/collaboration/CollaborationManager.ts).
    //   - `Form.settings` (below) is a typed GraphQL object (see
    //     `type FormSettings` in schema.ts), so a client only ever receives
    //     the subfields it explicitly selects in its query — there is no
    //     JSON blob to accidentally over-expose a new settings key through.
    formSchemaPublic: async (parent: any, _args: any, context: { auth: BetterAuthContext }) => {
      // Withhold form structure while access control isn't satisfied — this
      // is what lets `formByShortUrl` return a gate-able Form instead of a
      // hard error, so form-viewer can render an appropriate sign-in prompt.
      if (getFormAccessStatus(parent, context) !== 'OPEN') return null;

      const formId = parent.id;
      const schema = await getFormSchemaFromHocuspocus(formId);
      const raw = schema ?? parent.formSchema ?? null;
      if (!raw?.pages) return raw;
      return {
        ...raw,
        pages: raw.pages.map((page: any) => ({
          ...page,
          fields: (page.fields || [])
            .filter((f: any) => !f.deleted)
            .map((f: any) => {
              if (!('grading' in f)) return f;
              const fieldWithoutGrading = { ...f };
              delete fieldWithoutGrading.grading;
              return fieldWithoutGrading;
            }),
        })),
      };
    },
    accessStatus: (parent: any, _args: any, context: { auth: BetterAuthContext }) => {
      return getFormAccessStatus(parent, context);
    },
    settings: (parent: any) => {
      // Parse JSON settings from database or return null if no settings
      if (parent.settings) {
        return JSON.parse(typeof parent.settings === 'string' ? parent.settings : JSON.stringify(parent.settings));
      }
      return null;
    },
    responseCount: async (parent: any) => {
      // P3-02: Return pre-fetched _count when available (avoids N+1 on list queries).
      // Fall back to a direct COUNT query for single-form queries where _count is absent.
      if (parent._count?.responses !== undefined) return parent._count.responses;
      return getResponseCount(parent.id);
    },
    dashboardStats: async (parent: any) => {
      const formId = parent.id;

      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const yesterday = new Date(today.getTime() - 1 * 24 * 60 * 60 * 1000);
      const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
      const twoWeeksAgo = new Date(today.getTime() - 14 * 24 * 60 * 60 * 1000);
      const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

      const [responseCounts, viewCounts, averageCompletionTime] = await Promise.all([
        getDashboardResponseCounts(formId, { today, weekAgo, monthAgo, yesterday, twoWeeksAgo }),
        analyticsService.getDashboardViewCounts(formId, { weekAgo, twoWeeksAgo }),
        analyticsService.getAverageCompletionTime(formId),
      ]);

      const {
        today: responsesToday,
        thisWeek: responsesThisWeek,
        thisMonth: responsesThisMonth,
        total: totalResponses,
        yesterday: responsesYesterday,
        lastWeek: responsesLastWeek,
      } = responseCounts;
      const { total: totalViews, thisWeek: viewsThisWeek, lastWeek: viewsLastWeek } = viewCounts;

      const responseRate = totalViews > 0 ? (totalResponses / totalViews) * 100 : 0;

      const trendResponsesToday =
        responsesYesterday === 0
          ? null
          : ((responsesToday - responsesYesterday) / responsesYesterday) * 100;

      const trendThisWeek =
        responsesLastWeek === 0
          ? null
          : ((responsesThisWeek - responsesLastWeek) / responsesLastWeek) * 100;

      const rateThisWeek = viewsThisWeek > 0 ? (responsesThisWeek / viewsThisWeek) * 100 : 0;
      const rateLastWeek = viewsLastWeek > 0 ? (responsesLastWeek / viewsLastWeek) * 100 : 0;
      const trendResponseRate =
        viewsThisWeek < 10 || viewsLastWeek < 10
          ? null
          : rateThisWeek - rateLastWeek;

      return {
        averageCompletionTime,
        responseRate,
        responsesToday,
        responsesThisWeek,
        responsesThisMonth,
        trendResponsesToday,
        trendThisWeek,
        trendResponseRate,
      };
    },
  },
  Mutation: {
    createForm: async (
      _: any,
      { input }: { input: { templateId?: string; formSchema?: any; title: string; description?: string; organizationId: string; settings?: any } },
      context: { auth: BetterAuthContext }
    ) => {
      // 🔒 SECURITY: Verify user is a member of the target organization
      await requireOrganizationMembership(context.auth, input.organizationId);

      // ✅ VALIDATION: title and description length
      if (!input.title || input.title.trim().length === 0) {
        throw createGraphQLError('Title is required', GRAPHQL_ERROR_CODES.BAD_USER_INPUT);
      }
      if (input.title.length > 500) {
        throw createGraphQLError('Title must be 500 characters or less', GRAPHQL_ERROR_CODES.BAD_USER_INPUT);
      }
      if (input.description && input.description.length > 5000) {
        throw createGraphQLError('Description must be 5000 characters or less', GRAPHQL_ERROR_CODES.BAD_USER_INPUT);
      }

      // Quiz is a free, opt-in feature (no plan gating — see epic #289 D8).
      // `settings` is optional so every pre-existing caller (CreateFormPopover,
      // the template flow, tests) is unaffected; only sanitize when the quiz
      // wizard step actually sends a `settings.quiz` payload.
      let settings: any = undefined;
      const incomingQuiz = input.settings?.quiz;
      if (incomingQuiz !== undefined) {
        const sanitizedQuiz = sanitizeQuizSettings(incomingQuiz);
        if (!sanitizedQuiz) {
          throw createGraphQLError(
            'Invalid quiz settings: check the pass threshold, grade release, and (if scheduled) releaseAt',
            GRAPHQL_ERROR_CODES.BAD_USER_INPUT
          );
        }
        settings = { ...input.settings, quiz: sanitizedQuiz };
      } else if (input.settings) {
        settings = input.settings;
      }

      // ✅ VALIDATION: Ensure exactly one of templateId or formSchema is provided
      const hasTemplateId = !!input.templateId;
      const hasFormSchema = !!input.formSchema;

      if (!hasTemplateId && !hasFormSchema) {
        throw createGraphQLError('Either templateId or formSchema must be provided', GRAPHQL_ERROR_CODES.BAD_USER_INPUT);
      }

      if (hasTemplateId && hasFormSchema) {
        throw createGraphQLError('Cannot provide both templateId and formSchema', GRAPHQL_ERROR_CODES.BAD_USER_INPUT);
      }

      // Generate form ID upfront
      const newFormId = generateId();

      let formSchema: any;

      // 📋 Get schema from template OR use provided schema
      if (hasTemplateId) {
        // Existing flow: Fetch template and clone schema
        const template = await getTemplateById(input.templateId!);
        if (!template) {
          throw createGraphQLError('Template not found', GRAPHQL_ERROR_CODES.TEMPLATE_NOT_FOUND);
        }
        formSchema = JSON.parse(JSON.stringify(template.formSchema));
      } else {
        // New flow: Use provided schema with validation
        formSchema = input.formSchema;

        // Validate schema structure
        if (!formSchema.pages || !Array.isArray(formSchema.pages)) {
          throw createGraphQLError('Invalid formSchema: pages array is required', GRAPHQL_ERROR_CODES.BAD_USER_INPUT);
        }

        if (!formSchema.layout || typeof formSchema.layout !== 'object') {
          throw createGraphQLError('Invalid formSchema: layout object is required', GRAPHQL_ERROR_CODES.BAD_USER_INPUT);
        }

        // Ensure backgroundImageKey is initialized
        if (!formSchema.layout.backgroundImageKey) {
          formSchema.layout.backgroundImageKey = '';
        }
      }

      // Track if we need to create FormFile record after form creation
      let copiedFileInfo: any = null;

      // Always copy background images from templates to ensure unique keys for each form
      // Check for both truthy value AND non-empty string
      if (formSchema.layout && formSchema.layout.backgroundImageKey && formSchema.layout.backgroundImageKey.trim() !== '') {
        try {
          // Always copy the background image to create a unique key with formId
          const copiedFile = await copyFileForForm(formSchema.layout.backgroundImageKey, newFormId);

          // Update the form schema with the new unique key
          formSchema.layout.backgroundImageKey = copiedFile.key;

          // Store file info to create FormFile record AFTER form is created
          copiedFileInfo = copiedFile;
        } catch (copyError) {
          logger.error('Error copying background image:', copyError);
          // Continue with form creation even if image copy fails
          // But remove the backgroundImageKey to avoid broken references
          formSchema.layout.backgroundImageKey = '';
        }
      } else {
        // Ensure backgroundImageKey is set to empty string if not present
        if (formSchema.layout) {
          formSchema.layout.backgroundImageKey = formSchema.layout.backgroundImageKey || '';
        }
      }

      const formData = {
        id: newFormId,
        title: input.title,
        description: input.description,
        shortUrl: '', // Will be generated in createForm service
        isPublished: false,
        organizationId: input.organizationId,
        createdById: context.auth.user!.id,
        settings,
      };

      // Create the form first (this creates the database record)
      const newForm = await createForm(formData, formSchema);

      // NOW create the FormFile record after the form exists in the database
      if (copiedFileInfo) {
        try {
          await createFormFile({
            id: randomUUID(),
            key: copiedFileInfo.key,
            type: 'FormBackground',
            formId: newFormId,
            originalName: copiedFileInfo.originalName,
            url: copiedFileInfo.url,
            size: copiedFileInfo.size,
            mimeType: copiedFileInfo.mimeType,
          });
        } catch (formFileError) {
          logger.error('Error creating FormFile record:', formFileError);
          // Don't fail the entire operation if FormFile creation fails
        }
      }

      return newForm;
    },
    updateForm: async (_: any, { id, input }: { id: string; input: any }, context: { auth: BetterAuthContext }) => {
      requireAuth(context.auth);

      // Analyze input to determine required permission level
      const hasProp = (prop: string) =>
        Object.prototype.hasOwnProperty.call(input, prop);
      const hasLayoutChanges =
        ['title', 'description', 'settings'].some(hasProp);
      const hasCriticalChanges =
        ['isPublished', 'shortUrl', 'organizationId'].some(hasProp);

      // Determine required permission level based on update type
      let requiredPermission: string = PermissionLevel.EDITOR;

      if (hasCriticalChanges) {
        // Critical changes like publishing, URL changes, org changes require OWNER
        requiredPermission = PermissionLevel.OWNER;
      } else if (hasLayoutChanges) {
        // Layout and content changes require EDITOR
        requiredPermission = PermissionLevel.EDITOR;
      }

      // Check if user has required access level
      const accessCheck = await checkFormAccess(context.auth.user!.id, id, requiredPermission as any);
      if (!accessCheck.hasAccess) {
        const permissionName = requiredPermission === 'OWNER' ? 'owner' : 'editor';
        throw createGraphQLError(`Access denied: ${permissionName} permissions required for this type of update`, GRAPHQL_ERROR_CODES.NO_ACCESS);
      }

      // Additional validation for specific fields
      if (hasProp('organizationId') && input.organizationId !== accessCheck.form.organizationId) {
        // Only allow moving forms within same organization for now
        throw createGraphQLError('Access denied: Cannot transfer form to different organization', GRAPHQL_ERROR_CODES.NO_ACCESS);
      }

      if (hasProp('createdById')) {
        throw createGraphQLError('Access denied: Cannot change form ownership through update', GRAPHQL_ERROR_CODES.NO_ACCESS);
      }

      // 🔒 Access control (who can respond) is security-relevant, so changing
      // it specifically requires OWNER — even though `settings` as a whole is
      // an EDITOR-level field. Compared against the PERSISTED value (not mere
      // presence of the key): useFormSettings.ts always resends the full
      // settings object on every save, so `input.settings.accessControl`
      // would otherwise be present on every unrelated settings save too,
      // once a form has ever visited the Access Control tab.
      const incomingAccessControl = input.settings?.accessControl;
      if (incomingAccessControl !== undefined) {
        const currentAccessControl = (accessCheck.form.settings as any)?.accessControl ?? null;
        const accessControlChanged =
          JSON.stringify(normalizeAccessControlForComparison(incomingAccessControl)) !==
          JSON.stringify(normalizeAccessControlForComparison(currentAccessControl));

        if (accessControlChanged && accessCheck.permission !== PermissionLevel.OWNER) {
          throw createGraphQLError(
            'Access denied: owner permissions required to change who can respond to this form',
            GRAPHQL_ERROR_CODES.NO_ACCESS
          );
        }

        if (incomingAccessControl.allowedDomains) {
          for (const domain of incomingAccessControl.allowedDomains) {
            if (typeof domain !== 'string' || !DOMAIN_RE.test(domain)) {
              throw createGraphQLError(
                `"${domain}" is not a valid domain (expected e.g. "example.com")`,
                GRAPHQL_ERROR_CODES.BAD_USER_INPUT
              );
            }
          }
          incomingAccessControl.allowedDomains = incomingAccessControl.allowedDomains.map((d: string) => d.toLowerCase());
        }
      }

      // 🔒 Collecting a verified respondent email is equally privacy-relevant
      // even when it doesn't restrict who may respond, so it's gated the same
      // OWNER-only way, compared against the persisted value for the same
      // reason as accessControl above.
      const incomingCollectEmail = input.settings?.collectRespondentEmail;
      if (incomingCollectEmail !== undefined) {
        const currentCollectEmail = !!(accessCheck.form.settings as any)?.collectRespondentEmail;
        if (!!incomingCollectEmail !== currentCollectEmail && accessCheck.permission !== PermissionLevel.OWNER) {
          throw createGraphQLError(
            'Access denied: owner permissions required to change respondent email collection settings',
            GRAPHQL_ERROR_CODES.NO_ACCESS
          );
        }
      }

      // ✅ VALIDATION: title and description length
      if (hasProp('title')) {
        if (!input.title || input.title.trim().length === 0) {
          throw createGraphQLError('Title cannot be empty', GRAPHQL_ERROR_CODES.BAD_USER_INPUT);
        }
        if (input.title.length > 500) {
          throw createGraphQLError('Title must be 500 characters or less', GRAPHQL_ERROR_CODES.BAD_USER_INPUT);
        }
      }
      if (hasProp('description') && input.description && input.description.length > 5000) {
        throw createGraphQLError('Description must be 5000 characters or less', GRAPHQL_ERROR_CODES.BAD_USER_INPUT);
      }

      // `responseCopy.mode` is a plain GraphQL String (no enum), so reject anything
      // other than the two values the consent-gating logic understands — an
      // unvalidated value would otherwise be treated as 'always' by responseCopyService.
      const responseCopyMode = input.settings?.responseCopy?.mode;
      if (responseCopyMode !== undefined && responseCopyMode !== 'always' && responseCopyMode !== 'respondentChoice') {
        throw createGraphQLError(
          "responseCopy.mode must be 'always' or 'respondentChoice'",
          GRAPHQL_ERROR_CODES.BAD_USER_INPUT
        );
      }

      // Quiz is a free, opt-in feature (no plan gating — see epic #289 D8).
      // Sanitize at the trust boundary: an invalid shape (e.g. gradeRelease
      // 'scheduled' without a releaseAt) is rejected rather than silently
      // persisted, so the panel's save fails loudly instead of corrupting
      // settings.quiz.
      const incomingQuiz = input.settings?.quiz;
      if (incomingQuiz !== undefined) {
        const sanitizedQuiz = sanitizeQuizSettings(incomingQuiz);
        if (!sanitizedQuiz) {
          throw createGraphQLError(
            'Invalid quiz settings: check the pass threshold, grade release, and (if scheduled) releaseAt',
            GRAPHQL_ERROR_CODES.BAD_USER_INPUT
          );
        }
        input.settings.quiz = sanitizedQuiz;
      }

      const updateData = {
        ...input,
        updatedAt: new Date(),
      };
      return await updateForm(id, updateData, context.auth.user!.id);
    },
    deleteForm: async (_: any, { id }: { id: string }, context: { auth: BetterAuthContext }) => {
      requireAuth(context.auth);

      // Check if user has OWNER access to delete this form
      const accessCheck = await checkFormAccess(context.auth.user!.id, id, PermissionLevel.OWNER);
      if (!accessCheck.hasAccess) {
        throw createGraphQLError('Access denied: Only the form owner can delete this form', GRAPHQL_ERROR_CODES.NO_ACCESS);
      }

      return await deleteForm(id, context.auth.user!.id);
    },
    regenerateShortUrl: async (_: any, { id }: { id: string }, context: { auth: BetterAuthContext }) => {
      requireAuth(context.auth);

      // 🔒 SECURITY: Check if user has OWNER access to regenerate URL
      // Regenerating URL breaks all existing shared links - this is a critical operation
      const accessCheck = await checkFormAccess(context.auth.user!.id, id, PermissionLevel.OWNER);
      if (!accessCheck.hasAccess) {
        throw createGraphQLError('Access denied: Only form owners can regenerate the URL (this breaks all existing shared links)', GRAPHQL_ERROR_CODES.NO_ACCESS);
      }

      return await regenerateShortUrl(id);
    },
    duplicateForm: async (_: any, { id }: { id: string }, context: { auth: BetterAuthContext }) => {
      requireAuth(context.auth);

      // Duplicating only reads the source form schema — VIEWER access is sufficient.
      // The duplicate is always a fresh PRIVATE draft owned by the caller; no permissions are inherited.
      const accessCheck = await checkFormAccess(context.auth.user!.id, id, PermissionLevel.VIEWER);
      if (!accessCheck.hasAccess) {
        throw createGraphQLError('Access denied: You do not have permission to duplicate this form', GRAPHQL_ERROR_CODES.NO_ACCESS);
      }

      return await duplicateFormService(id, context.auth.user!.id);
    },
  },
};
