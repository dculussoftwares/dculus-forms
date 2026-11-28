import type { Prisma } from '#prisma-client';
import { resolvePrisma, type RepositoryContext } from './baseRepository.js';

/**
 * Factory for OrganizationBrandKit data access.
 */
export const createBrandKitRepository = (context?: RepositoryContext) => {
  const prisma = resolvePrisma(context);

  const findByOrganization = (organizationId: string) =>
    prisma.organizationBrandKit.findUnique({ where: { organizationId } });

  const upsertForOrganization = (
    organizationId: string,
    tokens: Prisma.InputJsonValue,
    updatedById: string | null
  ) =>
    prisma.organizationBrandKit.upsert({
      where: { organizationId },
      create: { organizationId, tokens, updatedById },
      update: { tokens, updatedById },
    });

  const deleteByOrganization = (organizationId: string) =>
    prisma.organizationBrandKit.deleteMany({ where: { organizationId } });

  return {
    findByOrganization,
    upsertForOrganization,
    deleteByOrganization,
  };
};

export type BrandKitRepository = ReturnType<typeof createBrandKitRepository>;

export const brandKitRepository = createBrandKitRepository();
