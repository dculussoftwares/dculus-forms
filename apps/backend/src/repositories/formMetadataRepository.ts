import type { Prisma } from '@prisma/client';
import { resolvePrisma, type RepositoryContext } from './baseRepository.js';

export const createFormMetadataRepository = (context?: RepositoryContext) => {
  const prisma = resolvePrisma(context);

  const findUnique = <T extends Prisma.FormMetadataFindUniqueArgs>(
    args: Prisma.SelectSubset<T, Prisma.FormMetadataFindUniqueArgs>
  ) => prisma.formMetadata.findUnique(args);

  const findMany = <T extends Prisma.FormMetadataFindManyArgs>(
    args?: Prisma.SelectSubset<T, Prisma.FormMetadataFindManyArgs>
  ) => prisma.formMetadata.findMany(args);

  const upsert = <T extends Prisma.FormMetadataUpsertArgs>(
    args: Prisma.SelectSubset<T, Prisma.FormMetadataUpsertArgs>
  ) => prisma.formMetadata.upsert(args);

  const update = <T extends Prisma.FormMetadataUpdateArgs>(
    args: Prisma.SelectSubset<T, Prisma.FormMetadataUpdateArgs>
  ) => prisma.formMetadata.update(args);

  const upsertMetadata = async (
    formId: string,
    data: Prisma.FormMetadataUpsertArgs['create']
  ) =>
    prisma.formMetadata.upsert({
      where: { formId },
      create: data,
      update: data,
    });

  const findByFormId = async (formId: string) =>
    prisma.formMetadata.findUnique({
      where: { formId },
    });

  const listCachedFormIds = async () =>
    prisma.formMetadata.findMany({
      select: { formId: true },
    });

  return {
    findUnique,
    findMany,
    upsert,
    update,
    upsertMetadata,
    findByFormId,
    listCachedFormIds,
  };
};

export type FormMetadataRepository = ReturnType<
  typeof createFormMetadataRepository
>;

export const formMetadataRepository = createFormMetadataRepository();
