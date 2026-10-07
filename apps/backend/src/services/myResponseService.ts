import type { Prisma } from '#prisma-client';
import { deserializeFormSchema, isRespondentEditEnabled } from '@dculus/types';
import { GRAPHQL_ERROR_CODES } from '@dculus/types/graphql.js';
import { createGraphQLError } from '#graphql-errors';
import type { BetterAuthContext } from '../middleware/better-auth-middleware.js';
import {
  isIdentifiedRespondent,
  isWithinTimeWindow,
  requireIdentifiedRespondent,
  type RespondentForm,
} from '../lib/respondentAccess.js';
import { assertResponsePayloadWithinLimits } from '../lib/responsePayloadLimits.js';
import { stripConditionallyHiddenValues } from '../lib/conditionalStrip.js';
import { responseRepository } from '../repositories/index.js';
import { getFormSchemaFromHocuspocus } from './hocuspocus.js';
import { respondentResponsesWhere, updateResponse } from './responseService.js';

/** A signed-in respondent's own latest submission, as they may see it. */
export interface MyResponseView {
  id: string;
  data: Record<string, unknown>;
  submittedAt: string;
  /** The form lets the respondent edit it right now: edits are on and its time window is open. */
  canEdit: boolean;
}

interface EditableForm extends RespondentForm {
  organizationId: string;
  formSchema?: unknown;
}

export interface EditMyResponseParams {
  form: EditableForm | null;
  auth: BetterAuthContext;
  data: unknown;
  /** Recorded on the edit history row, like a builder edit. */
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Stored answers to fields the form no longer has. The respondent never sees
 * those fields while editing, so an edit keeps their answers as they were
 * instead of recording them as deletions.
 */
function answersToRemovedFields(rawSchema: unknown, stored: Record<string, unknown>): Record<string, unknown> {
  if (!rawSchema || typeof rawSchema !== 'object') return {};
  const liveFieldIds = new Set(
    deserializeFormSchema(rawSchema).pages.flatMap((page) =>
      page.fields.filter((field) => !field.deleted).map((field) => field.id)
    )
  );
  return Object.fromEntries(Object.entries(stored).filter(([fieldId]) => !liveFieldIds.has(fieldId)));
}

const findLatestResponse = (formId: string, userId: string) =>
  responseRepository.findFirst({
    where: respondentResponsesWhere(formId, userId),
    orderBy: { submittedAt: 'desc' },
  });

const toView = (
  response: { id: string; data: unknown; submittedAt: Date },
  canEdit: boolean
): MyResponseView => ({
  id: response.id,
  data: (response.data as Record<string, unknown>) ?? {},
  submittedAt: response.submittedAt.toISOString(),
  canEdit,
});

/**
 * The caller's own latest response to an identity-gated form, or null.
 * Scoped by the session's user id only, like `myQuizResult` and drafts.
 * Anonymous forms never record who responded, so they always return null.
 */
export async function getMyResponse(form: RespondentForm, auth: BetterAuthContext): Promise<MyResponseView | null> {
  if (!isIdentifiedRespondent(form, auth)) return null;
  const response = await findLatestResponse(form.id, auth.user!.id);
  return response ? toView(response, isRespondentEditEnabled(form.settings) && isWithinTimeWindow(form)) : null;
}

/**
 * Replaces the answers on the caller's latest response. Runs the same
 * respondent gates and payload rules as `submitResponse`, then records the
 * change through edit tracking as a RESPONDENT edit, so the owner's edit
 * history shows exactly what the respondent changed.
 */
export async function editMyResponse(params: EditMyResponseParams): Promise<MyResponseView> {
  const { form: editable, userId } = requireIdentifiedRespondent(params.form, params.auth);
  if (!isRespondentEditEnabled(editable.settings)) {
    throw createGraphQLError('This form does not allow editing responses', GRAPHQL_ERROR_CODES.NO_ACCESS);
  }
  if (!params.data || typeof params.data !== 'object' || Array.isArray(params.data)) {
    throw createGraphQLError('Response data must be an object of field answers', GRAPHQL_ERROR_CODES.BAD_USER_INPUT);
  }
  assertResponsePayloadWithinLimits(params.data);

  const existing = await findLatestResponse(editable.id, userId);
  if (!existing) {
    throw createGraphQLError('You have not responded to this form yet', GRAPHQL_ERROR_CODES.RESPONSE_NOT_FOUND);
  }

  // Same conditional-logic enforcement as submitResponse: values the form's
  // rules hide are dropped (and recorded as deletions by the edit tracker).
  // Answers to fields removed since submission are carried over untouched.
  const schema = (await getFormSchemaFromHocuspocus(editable.id)) ?? editable.formSchema;
  const submitted = params.data as Record<string, unknown>;
  const data = (
    schema
      ? {
          ...answersToRemovedFields(schema, (existing.data as Record<string, unknown>) ?? {}),
          ...stripConditionallyHiddenValues(schema, submitted),
        }
      : submitted
  ) as Prisma.JsonObject;

  const updated = await updateResponse(existing.id, data, {
    userId,
    ipAddress: params.ipAddress,
    userAgent: params.userAgent,
    organizationId: editable.organizationId,
    editType: 'RESPONDENT',
  });
  return toView(updated, true);
}
