import { Prisma } from '#prisma-client';
import { prisma } from './prisma.js';

/**
 * S24-01: detach a deleted user's personal data from records owned by other people.
 *
 * Must run before the user row is deleted: `response_edit_history.editedById` is ON DELETE SET NULL,
 * so once the user is gone the edits can no longer be found by user id. Responses keep their answers
 * (the form owner's data) but lose the respondent's email snapshot and user id.
 */
export async function anonymizeUserData(userId: string): Promise<void> {
  await prisma.$transaction([
    prisma.response.updateMany({
      where: { respondentUserId: userId },
      data: { respondentUserId: null, respondentEmail: null },
    }),
    prisma.responseFieldChange.updateMany({
      where: { editHistory: { editedById: userId, editType: 'RESPONDENT' } },
      data: { previousValue: Prisma.DbNull, newValue: Prisma.DbNull },
    }),
    prisma.responseEditHistory.updateMany({
      where: { editedById: userId },
      data: { ipAddress: null, userAgent: null },
    }),
  ]);
}
