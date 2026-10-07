import { Prisma } from '#prisma-client';
import { isSaveProgressEnabled, type FormSettings } from '@dculus/types';
import { GRAPHQL_ERROR_CODES } from '@dculus/types/graphql.js';
import { createGraphQLError } from '#graphql-errors';
import type { BetterAuthContext } from '../middleware/better-auth-middleware.js';
import { resolveAccessStatus } from '../lib/accessControlEnforcement.js';
import { enforceTimeWindow } from '../lib/timeWindowEnforcement.js';
import { assertResponsePayloadWithinLimits } from '../lib/responsePayloadLimits.js';
import { responseDraftRepository } from '../repositories/index.js';
import { logger } from '../lib/logger.js';

/** Untouched drafts are purged this long after their last save. */
export const DRAFT_TTL_DAYS = 30;
const MAX_PAGE_ID_LENGTH = 200;

export interface ResponseDraftView {
  data: Record<string, unknown>;
  currentPageId: string | null;
  version: number;
  startedAt: string;
  updatedAt: string;
}

export interface SaveResponseDraftResult {
  draft: ResponseDraftView;
  /** True when another tab or device saved first; `draft` is then the stored copy, untouched. */
  conflict: boolean;
}

interface DraftableForm {
  id: string;
  isPublished: boolean;
  settings?: FormSettings | null;
}

type DraftRow = NonNullable<Awaited<ReturnType<typeof responseDraftRepository.findForRespondent>>>;

const toView = (row: DraftRow): ResponseDraftView => ({
  data: (row.data as Record<string, unknown>) ?? {},
  currentPageId: row.currentPageId,
  version: row.version,
  startedAt: row.startedAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});

const draftExpiry = (from: Date) => new Date(from.getTime() + DRAFT_TTL_DAYS * 24 * 60 * 60 * 1000);
const isExpired = (row: DraftRow) => row.expiresAt.getTime() <= Date.now();

const isUniqueViolation = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';

/**
 * Non-throwing check used by the `Form.myDraft` field resolver: drafts are
 * only ever exposed to a signed-in respondent who could submit this form
 * right now, on a form that has save-and-resume turned on.
 */
export function canUseDrafts(form: DraftableForm, auth: BetterAuthContext): boolean {
  const settings = form.settings ?? undefined;
  return (
    form.isPublished &&
    !!auth.user?.id &&
    isSaveProgressEnabled(settings) &&
    resolveAccessStatus(settings?.accessControl, settings?.collectRespondentEmail, auth) === 'OPEN'
  );
}

/**
 * The security boundary for the public draft mutations. Mirrors the gates
 * `submitResponse` applies (published, access control, time window) so a
 * draft can only be written by someone who could submit the form. Returns
 * the caller's user id, the draft's owner key.
 */
export function requireDraftAccess(form: DraftableForm | null, auth: BetterAuthContext): string {
  if (!form) {
    throw createGraphQLError('Form not found', GRAPHQL_ERROR_CODES.FORM_NOT_FOUND);
  }
  if (!form.isPublished) {
    throw createGraphQLError('Form is not published and cannot accept responses', GRAPHQL_ERROR_CODES.FORM_NOT_PUBLISHED);
  }
  if (!auth.isAuthenticated || !auth.user?.id) {
    throw createGraphQLError('Sign-in is required to save progress', GRAPHQL_ERROR_CODES.SIGN_IN_REQUIRED);
  }

  const settings = form.settings ?? undefined;
  if (!isSaveProgressEnabled(settings)) {
    throw createGraphQLError('Saving progress is not enabled for this form', GRAPHQL_ERROR_CODES.NO_ACCESS);
  }

  const status = resolveAccessStatus(settings?.accessControl, settings?.collectRespondentEmail, auth);
  if (status === 'SIGN_IN_REQUIRED') {
    throw createGraphQLError('Sign-in is required to save progress', GRAPHQL_ERROR_CODES.SIGN_IN_REQUIRED);
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

  return auth.user.id;
}

export async function getResponseDraft(formId: string, userId: string): Promise<ResponseDraftView | null> {
  const row = await responseDraftRepository.findForRespondent(formId, userId);
  if (!row) return null;
  // Expired rows are purged on a schedule; never hand one back in between.
  if (isExpired(row)) return null;
  return toView(row);
}

export async function saveResponseDraft(params: {
  formId: string;
  userId: string;
  data: unknown;
  currentPageId?: string | null;
  baseVersion?: number | null;
}): Promise<SaveResponseDraftResult> {
  const { formId, userId, baseVersion } = params;

  if (!params.data || typeof params.data !== 'object' || Array.isArray(params.data)) {
    throw createGraphQLError('Draft data must be an object of field answers', GRAPHQL_ERROR_CODES.BAD_USER_INPUT);
  }
  assertResponsePayloadWithinLimits(params.data);

  const currentPageId = params.currentPageId ?? null;
  if (currentPageId !== null && currentPageId.length > MAX_PAGE_ID_LENGTH) {
    throw createGraphQLError('Invalid page id', GRAPHQL_ERROR_CODES.BAD_USER_INPUT);
  }

  const data = params.data as Prisma.InputJsonObject;
  const expiresAt = draftExpiry(new Date());

  const createOrReportConflict = async (): Promise<SaveResponseDraftResult> => {
    try {
      const created = await responseDraftRepository.create({ formId, userId, data, currentPageId, expiresAt });
      return { draft: toView(created), conflict: false };
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      // Another tab created the draft between our read and insert. An expired
      // row may still occupy the unique key until scheduled cleanup runs.
      const current = await responseDraftRepository.findForRespondent(formId, userId);
      if (!current) throw error;
      if (isExpired(current)) {
        await responseDraftRepository.deleteExpiredForRespondent(formId, userId, new Date());
        return createOrReportConflict();
      }
      return { draft: toView(current), conflict: true };
    }
  };

  // First save from this client: never silently overwrite a draft that
  // another device created after this page loaded.
  if (baseVersion === null || baseVersion === undefined) {
    const existing = await responseDraftRepository.findForRespondent(formId, userId);
    if (existing) {
      if (!isExpired(existing)) return { draft: toView(existing), conflict: true };
      await responseDraftRepository.deleteExpiredForRespondent(formId, userId, new Date());
    }
    return createOrReportConflict();
  }

  const written = await responseDraftRepository.updateIfVersion(formId, userId, baseVersion, {
    data,
    currentPageId,
    expiresAt,
  });
  const current = await responseDraftRepository.findForRespondent(formId, userId);

  if (written === 1 && current && !isExpired(current)) return { draft: toView(current), conflict: false };
  if (current && !isExpired(current)) return { draft: toView(current), conflict: true };

  // The draft was discarded or submitted elsewhere while this tab kept
  // typing. Keep the respondent's work rather than dropping it.
  return createOrReportConflict();
}

export async function discardResponseDraft(formId: string, userId: string): Promise<boolean> {
  const deleted = await responseDraftRepository.deleteForRespondent(formId, userId);
  return deleted > 0;
}

/**
 * Called after a successful submission. Never throws: the response is
 * already stored, and a leftover draft only means stale answers are offered
 * on the next visit until the draft expires.
 */
export async function clearDraftAfterSubmit(formId: string, userId: string): Promise<void> {
  try {
    await responseDraftRepository.deleteForRespondent(formId, userId);
  } catch (error) {
    logger.warn(`Failed to clear response draft for form ${formId} after submit:`, error);
  }
}

export async function deleteExpiredDrafts(now: Date = new Date()): Promise<number> {
  const deleted = await responseDraftRepository.deleteExpired(now);
  if (deleted > 0) logger.info(`Response draft cleanup: deleted ${deleted} expired drafts`);
  return deleted;
}
