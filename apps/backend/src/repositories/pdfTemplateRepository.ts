import type { Prisma } from '#prisma-client';
import { resolvePrisma, type RepositoryContext } from './baseRepository.js';

/**
 * Factory for all PdfTemplate data access.
 */
export const createPdfTemplateRepository = (context?: RepositoryContext) => {
  const prisma = resolvePrisma(context);

  /** --- Generic delegate passthroughs (keep API flexibility) --- */
  const findMany = <T extends Prisma.PdfTemplateFindManyArgs>(
    args?: Prisma.SelectSubset<T, Prisma.PdfTemplateFindManyArgs>
  ) => prisma.pdfTemplate.findMany(args);

  const findUnique = <T extends Prisma.PdfTemplateFindUniqueArgs>(
    args: Prisma.SelectSubset<T, Prisma.PdfTemplateFindUniqueArgs>
  ) => prisma.pdfTemplate.findUnique(args);

  const create = <T extends Prisma.PdfTemplateCreateArgs>(
    args: Prisma.SelectSubset<T, Prisma.PdfTemplateCreateArgs>
  ) => prisma.pdfTemplate.create(args);

  const update = <T extends Prisma.PdfTemplateUpdateArgs>(
    args: Prisma.SelectSubset<T, Prisma.PdfTemplateUpdateArgs>
  ) => prisma.pdfTemplate.update(args);

  const remove = <T extends Prisma.PdfTemplateDeleteArgs>(
    args: Prisma.SelectSubset<T, Prisma.PdfTemplateDeleteArgs>
  ) => prisma.pdfTemplate.delete(args);

  const count = <T extends Prisma.PdfTemplateCountArgs>(
    args?: Prisma.SelectSubset<T, Prisma.PdfTemplateCountArgs>
  ) => prisma.pdfTemplate.count(args);

  /** --- Domain-oriented helpers for common access patterns --- */

  /**
   * Fetch a single template by id (no relations — `PdfTemplate` has no soft
   * delete flag, so this is a plain existence/ownership lookup).
   */
  const findById = async (id: string) =>
    prisma.pdfTemplate.findUnique({ where: { id } });

  /**
   * All templates for a form, most recently created first — matches the
   * `pdfTemplates` GraphQL query ordering.
   */
  const listByForm = async (formId: string) =>
    prisma.pdfTemplate.findMany({
      where: { formId },
      orderBy: { createdAt: 'desc' },
    });

  /**
   * Number of templates already saved for a form — used to enforce the
   * per-form template cap.
   */
  const countByForm = async (formId: string) =>
    prisma.pdfTemplate.count({ where: { formId } });

  const createTemplate = async (data: Prisma.PdfTemplateCreateArgs['data']) =>
    prisma.pdfTemplate.create({ data });

  const updateTemplate = async (
    id: string,
    data: Prisma.PdfTemplateUpdateArgs['data']
  ) => prisma.pdfTemplate.update({ where: { id }, data });

  const deleteTemplate = async (id: string) =>
    prisma.pdfTemplate.delete({ where: { id } });

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
    listByForm,
    countByForm,
    createTemplate,
    updateTemplate,
    deleteTemplate,
  };
};

export type PdfTemplateRepository = ReturnType<typeof createPdfTemplateRepository>;

export const pdfTemplateRepository = createPdfTemplateRepository();
