import type { Prisma } from '#prisma-client';
import { resolvePrisma, type RepositoryContext } from './baseRepository.js';

const ACTIVE_RUN_STATUSES = ['running', 'cancelling'] as const;

/**
 * Factory for PdfGenerator / PdfGenerationRun / PdfGenerationResult data
 * access — the three models are always used together across
 * pdfGenerationJobService, pdfGeneratorService and pdfGeneratorZipService.
 */
export const createPdfGeneratorRepository = (context?: RepositoryContext) => {
  const prisma = resolvePrisma(context);

  /** --- Generic delegate passthroughs (PdfGenerator) --- */
  const findMany = <T extends Prisma.PdfGeneratorFindManyArgs>(
    args?: Prisma.SelectSubset<T, Prisma.PdfGeneratorFindManyArgs>
  ) => prisma.pdfGenerator.findMany(args);

  const findUnique = <T extends Prisma.PdfGeneratorFindUniqueArgs>(
    args: Prisma.SelectSubset<T, Prisma.PdfGeneratorFindUniqueArgs>
  ) => prisma.pdfGenerator.findUnique(args);

  const create = <T extends Prisma.PdfGeneratorCreateArgs>(
    args: Prisma.SelectSubset<T, Prisma.PdfGeneratorCreateArgs>
  ) => prisma.pdfGenerator.create(args);

  const update = <T extends Prisma.PdfGeneratorUpdateArgs>(
    args: Prisma.SelectSubset<T, Prisma.PdfGeneratorUpdateArgs>
  ) => prisma.pdfGenerator.update(args);

  const remove = <T extends Prisma.PdfGeneratorDeleteArgs>(
    args: Prisma.SelectSubset<T, Prisma.PdfGeneratorDeleteArgs>
  ) => prisma.pdfGenerator.delete(args);

  const count = <T extends Prisma.PdfGeneratorCountArgs>(
    args?: Prisma.SelectSubset<T, Prisma.PdfGeneratorCountArgs>
  ) => prisma.pdfGenerator.count(args);

  /** --- Domain helpers: PdfGenerator --- */
  const findById = async (id: string) => prisma.pdfGenerator.findUnique({ where: { id } });

  const findByIdWithTemplate = async (id: string) =>
    prisma.pdfGenerator.findUnique({ where: { id }, include: { template: true } });

  const listByForm = async (formId: string) =>
    prisma.pdfGenerator.findMany({ where: { formId }, orderBy: { createdAt: 'desc' } });

  const countByForm = async (formId: string) => prisma.pdfGenerator.count({ where: { formId } });

  const createGenerator = async (data: Prisma.PdfGeneratorCreateArgs['data']) =>
    prisma.pdfGenerator.create({ data });

  const updateGenerator = async (id: string, data: Prisma.PdfGeneratorUpdateArgs['data']) =>
    prisma.pdfGenerator.update({ where: { id }, data });

  const deleteGenerator = async (id: string) => prisma.pdfGenerator.delete({ where: { id } });

  /** --- Domain helpers: PdfGenerationRun --- */
  const findRunById = async (id: string) => prisma.pdfGenerationRun.findUnique({ where: { id } });

  const findActiveRun = async (generatorId: string) =>
    prisma.pdfGenerationRun.findFirst({
      where: { generatorId, status: { in: [...ACTIVE_RUN_STATUSES] } },
    });

  const findLatestRun = async (generatorId: string) =>
    prisma.pdfGenerationRun.findFirst({
      where: { generatorId },
      orderBy: { startedAt: 'desc' },
    });

  const createRun = async (data: Prisma.PdfGenerationRunCreateArgs['data']) =>
    prisma.pdfGenerationRun.create({ data });

  /**
   * Every run mutation past creation is a status transition (running ->
   * cancelling -> cancelled/completed/failed, plus per-response progress
   * counters) — one helper for all of pdfGenerationJobService's
   * `pdfGenerationRun.update` call sites.
   */
  const updateRunStatus = async (
    runId: string,
    data: Prisma.PdfGenerationRunUpdateArgs['data']
  ) => prisma.pdfGenerationRun.update({ where: { id: runId }, data });

  /** --- Domain helpers: PdfGenerationResult --- */
  const upsertResult = async (
    generatorId: string,
    responseId: string,
    data: {
      create: Prisma.PdfGenerationResultCreateArgs['data'];
      update: Prisma.PdfGenerationResultUpdateArgs['data'];
    }
  ) =>
    prisma.pdfGenerationResult.upsert({
      where: { generatorId_responseId: { generatorId, responseId } },
      create: data.create,
      update: data.update,
    });

  const findResult = async (generatorId: string, responseId: string) =>
    prisma.pdfGenerationResult.findUnique({
      where: { generatorId_responseId: { generatorId, responseId } },
    });

  const listResultsByGenerator = async (generatorId: string) =>
    prisma.pdfGenerationResult.findMany({
      where: { generatorId },
      orderBy: { generatedAt: 'desc' },
    });

  /** Response ids only, for counting successful results without pulling full rows. */
  const listSuccessfulResultResponseIdsByGenerator = async (generatorId: string) =>
    prisma.pdfGenerationResult.findMany({
      where: { generatorId, status: 'success' },
      select: { responseId: true },
    });

  const listDownloadableResultsByGenerator = async (generatorId: string) =>
    prisma.pdfGenerationResult.findMany({
      where: { generatorId, status: 'success', fileKey: { not: null } },
    });

  const listSuccessfulResultsByResponse = async (responseId: string) =>
    prisma.pdfGenerationResult.findMany({
      where: { responseId, status: 'success' },
    });

  return {
    // Generic operations (PdfGenerator)
    findMany,
    findUnique,
    create,
    update,
    delete: remove,
    count,

    // Domain helpers (PdfGenerator)
    findById,
    findByIdWithTemplate,
    listByForm,
    countByForm,
    createGenerator,
    updateGenerator,
    deleteGenerator,

    // Domain helpers (PdfGenerationRun)
    findRunById,
    findActiveRun,
    findLatestRun,
    createRun,
    updateRunStatus,

    // Domain helpers (PdfGenerationResult)
    upsertResult,
    findResult,
    listResultsByGenerator,
    listSuccessfulResultResponseIdsByGenerator,
    listDownloadableResultsByGenerator,
    listSuccessfulResultsByResponse,
  };
};

export type PdfGeneratorRepository = ReturnType<typeof createPdfGeneratorRepository>;

export const pdfGeneratorRepository = createPdfGeneratorRepository();
