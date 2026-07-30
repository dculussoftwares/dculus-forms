import type { Prisma } from '#prisma-client';
import { resolvePrisma, type RepositoryContext } from './baseRepository.js';

/**
 * Factory for all member (organization membership) related data access.
 * Minimal bootstrap for the subscriptions domain — Story #14 (Org / Member /
 * User / Audit Log) extends this with the fuller CRUD surface admin.ts and
 * better-auth.ts need.
 */
export const createMemberRepository = (context?: RepositoryContext) => {
  const prisma = resolvePrisma(context);

  /** --- Generic delegate passthroughs (keep API flexibility) --- */
  const findMany = <T extends Prisma.MemberFindManyArgs>(
    args?: Prisma.SelectSubset<T, Prisma.MemberFindManyArgs>
  ) => prisma.member.findMany(args);

  const findFirst = <T extends Prisma.MemberFindFirstArgs>(
    args?: Prisma.SelectSubset<T, Prisma.MemberFindFirstArgs>
  ) => prisma.member.findFirst(args);

  const findUnique = <T extends Prisma.MemberFindUniqueArgs>(
    args: Prisma.SelectSubset<T, Prisma.MemberFindUniqueArgs>
  ) => prisma.member.findUnique(args);

  const create = <T extends Prisma.MemberCreateArgs>(
    args: Prisma.SelectSubset<T, Prisma.MemberCreateArgs>
  ) => prisma.member.create(args);

  const update = <T extends Prisma.MemberUpdateArgs>(
    args: Prisma.SelectSubset<T, Prisma.MemberUpdateArgs>
  ) => prisma.member.update(args);

  const remove = <T extends Prisma.MemberDeleteArgs>(
    args: Prisma.SelectSubset<T, Prisma.MemberDeleteArgs>
  ) => prisma.member.delete(args);

  const count = <T extends Prisma.MemberCountArgs>(
    args?: Prisma.SelectSubset<T, Prisma.MemberCountArgs>
  ) => prisma.member.count(args);

  /** --- Domain-oriented helpers for common access patterns --- */

  /**
   * Find the owner member of an organization, with the user relation loaded —
   * used by billing flows that need the owner's email/name (Chargebee customer
   * creation, enterprise payment emails).
   */
  const findOwnerByOrganization = async (organizationId: string) =>
    prisma.member.findFirst({
      where: { organizationId, role: 'owner' },
      include: { user: true },
    });

  return {
    // Generic operations (used when custom queries are needed)
    findMany,
    findFirst,
    findUnique,
    create,
    update,
    delete: remove,
    count,

    // Domain helpers (preferred for service layer)
    findOwnerByOrganization,
  };
};

export type MemberRepository = ReturnType<typeof createMemberRepository>;

export const memberRepository = createMemberRepository();
