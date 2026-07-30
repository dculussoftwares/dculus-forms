import type { Prisma } from '#prisma-client';
import { resolvePrisma, type RepositoryContext } from './baseRepository.js';

const defaultInvitationInclude = {
  organization: { select: { id: true, name: true, slug: true } },
  inviter:      { select: { id: true, name: true, email: true } },
} satisfies Prisma.InvitationInclude;

/**
 * Factory for all invitation related data access.
 * Provides both low-level Prisma passthroughs and higher-level helpers
 * so services can choose the right abstraction for their use-case.
 */
export const createInvitationRepository = (context?: RepositoryContext) => {
  const prisma = resolvePrisma(context);

  /** --- Generic delegate passthroughs (keep API flexibility) --- */
  const findMany = <T extends Prisma.InvitationFindManyArgs>(
    args?: Prisma.SelectSubset<T, Prisma.InvitationFindManyArgs>
  ) => prisma.invitation.findMany(args);

  const findUnique = <T extends Prisma.InvitationFindUniqueArgs>(
    args: Prisma.SelectSubset<T, Prisma.InvitationFindUniqueArgs>
  ) => prisma.invitation.findUnique(args);

  const create = <T extends Prisma.InvitationCreateArgs>(
    args: Prisma.SelectSubset<T, Prisma.InvitationCreateArgs>
  ) => prisma.invitation.create(args);

  const update = <T extends Prisma.InvitationUpdateArgs>(
    args: Prisma.SelectSubset<T, Prisma.InvitationUpdateArgs>
  ) => prisma.invitation.update(args);

  const remove = <T extends Prisma.InvitationDeleteArgs>(
    args: Prisma.SelectSubset<T, Prisma.InvitationDeleteArgs>
  ) => prisma.invitation.delete(args);

  const count = <T extends Prisma.InvitationCountArgs>(
    args?: Prisma.SelectSubset<T, Prisma.InvitationCountArgs>
  ) => prisma.invitation.count(args);

  /** --- Domain-oriented helpers for common access patterns --- */
  type InvitationWithRelations = Prisma.InvitationGetPayload<{
    include: typeof defaultInvitationInclude;
  }>;

  /**
   * Fetch an invitation by ID with organization + inviter metadata eagerly loaded.
   */
  const findById = async (
    id: string
  ): Promise<InvitationWithRelations | null> =>
    prisma.invitation.findUnique({
      where: { id },
      include: defaultInvitationInclude,
    });

  return {
    // Generic operations (used when custom queries are needed)
    findMany,
    findUnique,
    create,
    update,
    delete: remove,
    count,

    // Domain helpers (preferred for service layer)
    findById,
  };
};

export type InvitationRepository = ReturnType<typeof createInvitationRepository>;

export const invitationRepository = createInvitationRepository();
