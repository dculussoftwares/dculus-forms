import { resolvePrisma, type RepositoryContext } from './baseRepository.js';

/**
 * Hard-deletes rows in side tables that duplicate respondent data (plugin payloads,
 * automation run context, edit history, AI chat) and are not soft-deleted with the
 * response they came from.
 */
export const createDataRetentionRepository = (context?: RepositoryContext) => {
  const prisma = resolvePrisma(context);

  const deletePluginDeliveriesForResponses = async (responseIds: string[]) =>
    (await prisma.pluginDelivery.deleteMany({ where: { responseId: { in: responseIds } } })).count;

  // A run that is still active keeps its context until it finishes; the TTL pass removes it later.
  const deleteFinishedAutomationRunsForResponses = async (responseIds: string[]) =>
    (
      await prisma.automationRun.deleteMany({
        where: { responseId: { in: responseIds }, status: { notIn: ['RUNNING', 'WAITING'] } },
      })
    ).count;

  // ResponseFieldChange rows cascade from the edit history.
  const deleteEditHistoryForResponses = async (responseIds: string[]) =>
    (await prisma.responseEditHistory.deleteMany({ where: { responseId: { in: responseIds } } })).count;

  const deletePluginDeliveriesBefore = async (cutoff: Date) =>
    (await prisma.pluginDelivery.deleteMany({ where: { deliveredAt: { lt: cutoff } } })).count;

  const deleteFinishedAutomationRunsBefore = async (cutoff: Date) =>
    (
      await prisma.automationRun.deleteMany({
        where: { startedAt: { lt: cutoff }, status: { notIn: ['RUNNING', 'WAITING'] } },
      })
    ).count;

  const deleteAIChatMessagesBefore = async (cutoff: Date) =>
    (await prisma.aIChatMessage.deleteMany({ where: { createdAt: { lt: cutoff } } })).count;

  const findSoftDeletedResponseIds = async (take: number, afterId?: string) =>
    (
      await prisma.response.findMany({
        where: { deletedAt: { not: null } },
        select: { id: true },
        orderBy: { id: 'asc' },
        take,
        ...(afterId ? { cursor: { id: afterId }, skip: 1 } : {}),
      })
    ).map(row => row.id);

  return {
    deletePluginDeliveriesForResponses,
    deleteFinishedAutomationRunsForResponses,
    deleteEditHistoryForResponses,
    deletePluginDeliveriesBefore,
    deleteFinishedAutomationRunsBefore,
    deleteAIChatMessagesBefore,
    findSoftDeletedResponseIds,
  };
};

export const dataRetentionRepository = createDataRetentionRepository();
