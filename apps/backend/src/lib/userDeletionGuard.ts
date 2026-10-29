import { prisma } from './prisma.js';

/**
 * Throws if the user still owns forms. Form.createdBy is ON DELETE RESTRICT, so
 * the database would refuse anyway; this surfaces a clear error up front.
 * Soft-deleted forms are counted too because their rows (and responses) still exist.
 */
export async function assertUserOwnsNoForms(userId: string): Promise<void> {
  const ownedForms = await prisma.form.count({ where: { createdById: userId } });
  if (ownedForms > 0) {
    const { APIError } = await import('better-auth/api');
    throw new APIError('BAD_REQUEST', {
      message: `This user still owns ${ownedForms} form${ownedForms === 1 ? '' : 's'}. Transfer or delete the forms before deleting the user.`,
    });
  }
}
