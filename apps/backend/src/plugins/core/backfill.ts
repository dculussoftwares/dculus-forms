import { Prisma } from '#prisma-client';
import { prisma } from '../../lib/prisma.js';
import { generateId } from '@dculus/utils';
import { createGraphQLError } from '#graphql-errors';
import { GRAPHQL_ERROR_CODES } from '@dculus/types/graphql.js';

export interface EligibleResponseRow {
  id: string;
  data: Record<string, any>;
  submittedAt: Date;
}

export const countEligibleResponses = async (
  formId: string,
  pluginId: string
): Promise<number> => {
  const rows = await prisma.$queryRaw<{ count: bigint }[]>(Prisma.sql`
    SELECT COUNT(*)::bigint AS count
    FROM "response" r
    WHERE r."formId" = ${formId}
      AND r."deletedAt" IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM "plugin_delivery" pd
        WHERE pd."pluginId" = ${pluginId}
          AND pd."responseId" = r.id
          AND pd.status = 'success'
      )
  `);

  return Number(rows[0]?.count ?? 0);
};

export const fetchEligibleResponseBatch = async (
  formId: string,
  pluginId: string,
  batchSize: number
): Promise<EligibleResponseRow[]> => {
  return prisma.$queryRaw<EligibleResponseRow[]>(Prisma.sql`
    SELECT r.id, r.data, r."submittedAt"
    FROM "response" r
    WHERE r."formId" = ${formId}
      AND r."deletedAt" IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM "plugin_delivery" pd
        WHERE pd."pluginId" = ${pluginId}
          AND pd."responseId" = r.id
          AND pd.status = 'success'
      )
    ORDER BY r."submittedAt" ASC
    LIMIT ${batchSize}
  `);
};

export type BackfillJobStatus = 'running' | 'cancelling' | 'cancelled' | 'completed' | 'failed';

export interface BackfillJob {
  id: string;
  pluginId: string;
  formId: string;
  status: BackfillJobStatus;
  totalCount: number;
  processedCount: number;
  succeededCount: number;
  failedCount: number;
  errorMessage: string | null;
  startedAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
}

export const startBackfill = async (pluginId: string): Promise<BackfillJob> => {
  const plugin = await prisma.formPlugin.findUnique({ where: { id: pluginId } });
  if (!plugin) {
    throw createGraphQLError('Plugin not found', GRAPHQL_ERROR_CODES.NOT_FOUND);
  }
  if (!plugin.enabled) {
    throw createGraphQLError('Cannot backfill a disabled plugin', GRAPHQL_ERROR_CODES.BAD_USER_INPUT);
  }

  const activeJob = await prisma.pluginBackfillJob.findFirst({
    where: { pluginId, status: { in: ['running', 'cancelling'] } },
  });
  if (activeJob) {
    throw createGraphQLError(
      'A backfill is already running for this plugin',
      GRAPHQL_ERROR_CODES.BAD_USER_INPUT
    );
  }

  const totalCount = await countEligibleResponses(plugin.formId, pluginId);

  const job = await prisma.pluginBackfillJob.create({
    data: {
      id: generateId(),
      pluginId,
      formId: plugin.formId,
      status: 'running',
      totalCount,
    },
  });

  return job as unknown as BackfillJob;
};
