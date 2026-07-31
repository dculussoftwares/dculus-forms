import type { Prisma } from '#prisma-client';
import { organizationRepository } from '../repositories/organizationRepository.js';
import { memberRepository } from '../repositories/memberRepository.js';
import { formRepository } from '../repositories/formRepository.js';
import { responseRepository } from '../repositories/responseRepository.js';
import { systemRepository } from '../repositories/systemRepository.js';

/**
 * Organization Service
 * Thin service layer over organizationRepository (plus a few cross-domain
 * repositories for dashboard aggregate stats) for the admin org-management
 * flows in `admin.ts` and the org-membership flows in `better-auth.ts`.
 */

export const listOrganizations = <T extends Prisma.OrganizationFindManyArgs>(
  args: Prisma.SelectSubset<T, Prisma.OrganizationFindManyArgs>
) => organizationRepository.findMany(args);

export const countOrganizations = <T extends Prisma.OrganizationCountArgs>(
  args?: Prisma.SelectSubset<T, Prisma.OrganizationCountArgs>
) => organizationRepository.count(args);

export const getOrganizationDetail = <
  T extends Prisma.OrganizationFindUniqueArgs,
>(
  args: Prisma.SelectSubset<T, Prisma.OrganizationFindUniqueArgs>
) => organizationRepository.findUnique(args);

/** Organization with members (+ user) eagerly loaded — better-auth.ts's shape. */
export const getOrganizationWithMembers = (id: string) =>
  organizationRepository.findByIdWithMembers(id);

export const createOrganizationRecord = <
  T extends Prisma.OrganizationCreateArgs,
>(
  args: Prisma.SelectSubset<T, Prisma.OrganizationCreateArgs>
) => organizationRepository.create(args);

/** Org owning a given logo S3 key, with the caller's own membership row (if any). */
export const findOrganizationByLogoKey = <
  T extends Prisma.OrganizationFindFirstArgs,
>(
  args: Prisma.SelectSubset<T, Prisma.OrganizationFindFirstArgs>
) => organizationRepository.findFirst(args);

export const listUserMemberships = <T extends Prisma.MemberFindManyArgs>(
  args: Prisma.SelectSubset<T, Prisma.MemberFindManyArgs>
) => memberRepository.findMany(args);

export const findExistingMembership = <T extends Prisma.MemberFindFirstArgs>(
  args: Prisma.SelectSubset<T, Prisma.MemberFindFirstArgs>
) => memberRepository.findFirst(args);

export const createMembership = <T extends Prisma.MemberCreateArgs>(
  args: Prisma.SelectSubset<T, Prisma.MemberCreateArgs>
) => memberRepository.create(args);

/**
 * Platform-wide counts for the admin dashboard's top-line stats
 * (organizations/users/forms/responses). Deliberately reaches into
 * formRepository/responseRepository directly rather than formService/
 * responseService — these are plain counts with no business logic.
 */
export const getPlatformCounts = async () => {
  const [organizationCount, formCount, responseCount] = await Promise.all([
    organizationRepository.count(),
    formRepository.count(),
    responseRepository.count(),
  ]);
  return { organizationCount, formCount, responseCount };
};

export const countResponsesForOrganization = (organizationId: string) =>
  responseRepository.count({ where: { form: { organizationId } } });

export const getDatabaseSizePretty = () =>
  systemRepository.getDatabaseSizePretty();

export const getPublicTableCount = () => systemRepository.getPublicTableCount();

export const pingDatabase = () => systemRepository.ping();
