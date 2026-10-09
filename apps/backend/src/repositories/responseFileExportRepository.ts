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

  /** Exports a user started since `since` — backs the per-user rate limit. */
  const countByRequesterSince = (requestedById: string, since: Date) =>
    prisma.responseFileExport.count({ where: { requestedById, createdAt: { gte: since } } });

  /** The requester's in-flight export for a form, if any. */
  const findRunning = (formId: string, requestedById: string) =>
    prisma.responseFileExport.findFirst({
      where: { formId, requestedById, status: 'running' },
      orderBy: { createdAt: 'desc' },
    });

  return { create, findById, update, countByRequesterSince, findRunning };
};

export type ResponseFileExportRepository = ReturnType<typeof createResponseFileExportRepository>;

export const responseFileExportRepository = createResponseFileExportRepository();
