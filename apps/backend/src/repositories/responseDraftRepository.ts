import type { Prisma } from '#prisma-client';
import { resolvePrisma, type RepositoryContext } from './baseRepository.js';

/**
 * Repository for save-and-resume drafts (`ResponseDraft`), keyed on the
 * unique (formId, userId) pair — a respondent has at most one draft per form.
 */
export const createResponseDraftRepository = (context?: RepositoryContext) => {
  const prisma = resolvePrisma(context);

  const findForRespondent = (formId: string, userId: string) =>
    prisma.responseDraft.findUnique({ where: { formId_userId: { formId, userId } } });

  const create = (data: Prisma.ResponseDraftUncheckedCreateInput) =>
    prisma.responseDraft.create({ data });

  /**
   * Compare-and-swap update: only writes when the stored version still equals
   * `expectedVersion`, bumping it by one. Returns the number of rows written
   * (0 means another tab or device saved first, or the draft is gone).
   */
  const updateIfVersion = async (
    formId: string,
    userId: string,
    expectedVersion: number,
    data: Pick<Prisma.ResponseDraftUpdateManyMutationInput, 'data' | 'currentPageId' | 'expiresAt'>
  ) => {
    const result = await prisma.responseDraft.updateMany({
      where: { formId, userId, version: expectedVersion },
      data: { ...data, version: { increment: 1 } },
    });
    return result.count;
  };

  const deleteForRespondent = async (formId: string, userId: string) => {
    const result = await prisma.responseDraft.deleteMany({ where: { formId, userId } });
    return result.count;
  };

  const deleteExpired = async (now: Date) => {
    const result = await prisma.responseDraft.deleteMany({ where: { expiresAt: { lt: now } } });
    return result.count;
  };

  return {
    findForRespondent,
    create,
    updateIfVersion,
    deleteForRespondent,
    deleteExpired,
  };
};

export const responseDraftRepository = createResponseDraftRepository();
