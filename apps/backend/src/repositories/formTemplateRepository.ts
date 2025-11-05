import type { Prisma } from '@prisma/client';
import { resolvePrisma, type RepositoryContext } from './baseRepository.js';

/**
 * Repository for form templates with intent-revealing helpers used by
 * the template service. Raw delegate access is still exposed when
 * bespoke projections are necessary.
 */
export const createFormTemplateRepository = (context?: RepositoryContext) => {
  const prisma = resolvePrisma(context);

  const findMany = <T extends Prisma.FormTemplateFindManyArgs>(
    args?: Prisma.SelectSubset<T, Prisma.FormTemplateFindManyArgs>
  ) => prisma.formTemplate.findMany(args);

  const findUnique = <T extends Prisma.FormTemplateFindUniqueArgs>(
    args: Prisma.SelectSubset<T, Prisma.FormTemplateFindUniqueArgs>
  ) => prisma.formTemplate.findUnique(args);

  const create = <T extends Prisma.FormTemplateCreateArgs>(
    args: Prisma.SelectSubset<T, Prisma.FormTemplateCreateArgs>
  ) => prisma.formTemplate.create(args);

  const update = <T extends Prisma.FormTemplateUpdateArgs>(
    args: Prisma.SelectSubset<T, Prisma.FormTemplateUpdateArgs>
  ) => prisma.formTemplate.update(args);

  const remove = <T extends Prisma.FormTemplateDeleteArgs>(
    args: Prisma.SelectSubset<T, Prisma.FormTemplateDeleteArgs>
  ) => prisma.formTemplate.delete(args);

  const listActive = async (category?: string) =>
    prisma.formTemplate.findMany({
      where: {
        isActive: true,
        ...(category ? { category } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });

  const fetchById = async (id: string) =>
    prisma.formTemplate.findUnique({
      where: { id },
    });

  const createTemplate = async (data: Prisma.FormTemplateCreateInput) =>
    prisma.formTemplate.create({
      data,
    });

  const updateTemplate = async (
    id: string,
    data: Prisma.FormTemplateUpdateInput
  ) =>
    prisma.formTemplate.update({
      where: { id },
      data,
    });

  const softDeleteTemplate = async (id: string) =>
    prisma.formTemplate.update({
      where: { id },
      data: { isActive: false },
    });

  const hardDeleteTemplate = async (id: string) =>
    prisma.formTemplate.delete({
      where: { id },
    });

  const listCategories = async () =>
    prisma.formTemplate.findMany({
      where: { isActive: true },
      select: { category: true },
      distinct: ['category'],
    });

  return {
    findMany,
    findUnique,
    create,
    update,
    delete: remove,
    listActive,
    fetchById,
    createTemplate,
    updateTemplate,
    softDeleteTemplate,
    hardDeleteTemplate,
    listCategories,
  };
};

export type FormTemplateRepository = ReturnType<
  typeof createFormTemplateRepository
>;

export const formTemplateRepository = createFormTemplateRepository();

