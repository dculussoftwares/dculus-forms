import type { Prisma } from '#prisma-client';
import { resolvePrisma, type RepositoryContext } from './baseRepository.js';

/**
 * Data access for ResponseFileExport — background "download respondent files
 * as a ZIP" jobs (see services/responseFiles/responseFileExportService.ts).
 */
export const createResponseFileExportRepository = (context?: RepositoryContext) => {
  const prisma = resolvePrisma(context);

  const create = (data: Prisma.ResponseFileExportUncheckedCreateInput) =>
    prisma.responseFileExport.create({ data });

  const findById = (id: string) => prisma.responseFileExport.findUnique({ where: { id } });

  const update = (id: string, data: Prisma.ResponseFileExportUpdateInput) =>
    prisma.responseFileExport.update({ where: { id }, data });

  /**
   * Update only while the job is still `running`. Returns whether it applied,
   * so a worker never overwrites a state the stall check already settled.
   */
  const updateIfRunning = async (id: string, data: Prisma.ResponseFileExportUpdateManyMutationInput) =>
    (await prisma.responseFileExport.updateMany({ where: { id, status: 'running' }, data })).count > 0;

  /** Exports a user started since `since` — backs the per-user rate limit. */
  const countByRequesterSince = (requestedById: string, since: Date) =>
    prisma.responseFileExport.count({ where: { requestedById, createdAt: { gte: since } } });

  /** The requester's in-flight export for a form, if any. */
  const findRunning = (formId: string, requestedById: string) =>
    prisma.responseFileExport.findFirst({
      where: { formId, requestedById, status: 'running' },
      orderBy: { createdAt: 'desc' },
    });

  return { create, findById, update, updateIfRunning, countByRequesterSince, findRunning };
};

export type ResponseFileExportRepository = ReturnType<typeof createResponseFileExportRepository>;

export const responseFileExportRepository = createResponseFileExportRepository();
