import { requiresRespondentIdentity, type FormSettings } from '@dculus/types';
import { GRAPHQL_ERROR_CODES } from '@dculus/types/graphql.js';
import { createGraphQLError } from '#graphql-errors';
import type { BetterAuthContext } from '../middleware/better-auth-middleware.js';
import { resolveAccessStatus } from './accessControlEnforcement.js';
import { enforceTimeWindow } from './timeWindowEnforcement.js';

/** The form fields every respondent-scoped feature (drafts, my response) gates on. */
export interface RespondentForm {
  id: string;
  isPublished: boolean;
  settings?: FormSettings | null;
}

/**
 * Reads the respondent gate fields off a `Form` GraphQL parent, whose
 * settings may still be the raw JSON string from the database.
 */
export function toRespondentForm(parent: { id: string; isPublished: boolean; settings?: unknown }): RespondentForm {
  const settings =
    typeof parent.settings === 'string' ? (JSON.parse(parent.settings) as FormSettings) : (parent.settings as FormSettings | null);
  return { id: parent.id, isPublished: parent.isPublished, settings: settings ?? null };
}

/**
 * Non-throwing check for the public `Form` field resolvers: the caller is a
 * signed-in respondent who passes this identity-gated form's access rules
 * (sign-in and email-domain allowlist) right now.
 */
export function isIdentifiedRespondent(form: RespondentForm, auth: BetterAuthContext): boolean {
  const settings = form.settings ?? undefined;
  return (
    form.isPublished &&
    !!auth.user?.id &&
    requiresRespondentIdentity(settings?.accessControl, settings?.collectRespondentEmail) &&
    resolveAccessStatus(settings?.accessControl, settings?.collectRespondentEmail, auth) === 'OPEN'
  );
}

/**
 * The security boundary for respondent-scoped mutations. Mirrors the gates
 * `submitResponse` applies (published, access control, time window) so only
 * someone who could submit the form right now gets through. Returns the
 * form and the caller's user id, the key every respondent-owned record is
 * scoped by. Callers still check their own feature setting.
 */
export function requireIdentifiedRespondent<F extends RespondentForm>(
  form: F | null,
  auth: BetterAuthContext
): { form: F; userId: string } {
  if (!form) {
    throw createGraphQLError('Form not found', GRAPHQL_ERROR_CODES.FORM_NOT_FOUND);
  }
  if (!form.isPublished) {
    throw createGraphQLError('Form is not published and cannot accept responses', GRAPHQL_ERROR_CODES.FORM_NOT_PUBLISHED);
  }
  if (!auth.isAuthenticated || !auth.user?.id) {
    throw createGraphQLError('Sign-in is required to respond to this form', GRAPHQL_ERROR_CODES.SIGN_IN_REQUIRED);
  }

  const settings = form.settings ?? undefined;
  const status = resolveAccessStatus(settings?.accessControl, settings?.collectRespondentEmail, auth);
  if (status === 'SIGN_IN_REQUIRED') {
    throw createGraphQLError('Sign-in is required to respond to this form', GRAPHQL_ERROR_CODES.SIGN_IN_REQUIRED);
  }
  if (status === 'DOMAIN_REJECTED') {
    throw createGraphQLError(
      'Your email domain is not allowed to respond to this form',
      GRAPHQL_ERROR_CODES.EMAIL_DOMAIN_NOT_ALLOWED
    );
  }

  if (settings?.submissionLimits?.timeWindow) {
    enforceTimeWindow(settings.submissionLimits.timeWindow);
  }

  return { form, userId: auth.user.id };
}
