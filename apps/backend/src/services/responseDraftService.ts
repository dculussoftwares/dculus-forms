import { Prisma } from '#prisma-client';
import { isSaveProgressEnabled } from '@dculus/types';
import { GRAPHQL_ERROR_CODES } from '@dculus/types/graphql.js';
import { createGraphQLError } from '#graphql-errors';
import type { BetterAuthContext } from '../middleware/better-auth-middleware.js';
import {
  isIdentifiedRespondent,
  requireIdentifiedRespondent,
  type RespondentForm,
} from '../lib/respondentAccess.js';
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
  /** The stored draft; null only on a conflict where the draft was submitted or discarded elsewhere. */
  draft: ResponseDraftView | null;
  /** True when another tab or device saved, submitted or discarded first; nothing was written. */
  conflict: boolean;
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

/**
 * The caller's draft, treating an expired row as gone. Expired rows are
 * purged on a schedule; until then one is deleted here so it can neither be
 * handed back nor block a fresh first save.
 */
async function findLiveDraft(formId: string, userId: string): Promise<DraftRow | null> {
  const row = await responseDraftRepository.findForRespondent(formId, userId);
  if (!row || !isExpired(row)) return row;
  await responseDraftRepository.deleteForRespondent(formId, userId);
  return null;
}

const isUniqueViolation = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';

/**
 * Non-throwing check used by the `Form.myDraft` field resolver: drafts are
 * only ever exposed to a signed-in respondent who could submit this form
 * right now, on a form that has save-and-resume turned on.
 */
export function canUseDrafts(form: RespondentForm, auth: BetterAuthContext): boolean {
  return isSaveProgressEnabled(form.settings) && isIdentifiedRespondent(form, auth);
}

/**
 * The security boundary for the public draft mutations: the respondent
 * gates `submitResponse` applies, plus the form's save-progress setting.
 * Returns the caller's user id, the draft's owner key.
 */
export function requireDraftAccess(form: RespondentForm | null, auth: BetterAuthContext): string {
  const { form: draftable, userId } = requireIdentifiedRespondent(form, auth);
  if (!isSaveProgressEnabled(draftable.settings)) {
    throw createGraphQLError('Saving progress is not enabled for this form', GRAPHQL_ERROR_CODES.NO_ACCESS);
  }
  return userId;
}

export async function getResponseDraft(formId: string, userId: string): Promise<ResponseDraftView | null> {
  const row = await findLiveDraft(formId, userId);
  return row ? toView(row) : null;
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

  // First save from this client: never silently overwrite a draft that
  // another device created after this page loaded.
  if (baseVersion === null || baseVersion === undefined) {
    const existing = await findLiveDraft(formId, userId);
    if (existing) return { draft: toView(existing), conflict: true };
    try {
      const created = await responseDraftRepository.create({ formId, userId, data, currentPageId, expiresAt });
      return { draft: toView(created), conflict: false };
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      // Another tab created the draft between our read and insert.
      const current = await responseDraftRepository.findForRespondent(formId, userId);
      if (!current) throw error;
      return { draft: toView(current), conflict: true };
    }
  }

  // Expired rows are deleted first, so a stale version can't revive one.
  const live = await findLiveDraft(formId, userId);
  const written = live
    ? await responseDraftRepository.updateIfVersion(formId, userId, baseVersion, { data, currentPageId, expiresAt })
    : 0;
  const current = await responseDraftRepository.findForRespondent(formId, userId);

  if (written === 1 && current) return { draft: toView(current), conflict: false };
  // A null draft means it was submitted or discarded elsewhere (or expired)
  // while this tab kept typing. Never recreate it implicitly: the respondent
  // decides whether to keep saving these answers.
  return { draft: current ? toView(current) : null, conflict: true };
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
