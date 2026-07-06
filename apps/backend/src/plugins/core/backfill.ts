import { Prisma } from '#prisma-client';
import { prisma } from '../../lib/prisma.js';
import { generateId } from '@dculus/utils';
import { createGraphQLError } from '#graphql-errors';
import { GRAPHQL_ERROR_CODES } from '@dculus/types/graphql.js';
import { executePlugin } from './executor.js';
import type { PluginEvent } from './types.js';
import { logger } from '../../lib/logger.js';

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

  const formForBackfill = await prisma.formPlugin.findUnique({
    where: { id: pluginId },
    include: { form: true },
  });
  void runBackfillLoop(job.id, pluginId, plugin.formId, formForBackfill!.form.organizationId);

  return job as unknown as BackfillJob;
};

const BATCH_SIZE = 20;
const BATCH_DELAY_MS = 500;

export const wait = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

export const runBackfillLoop = async (
  jobId: string,
  pluginId: string,
  formId: string,
  organizationId: string
): Promise<void> => {
  try {
    let processed = 0;
    let succeeded = 0;
    let failed = 0;

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const job = await prisma.pluginBackfillJob.findUnique({ where: { id: jobId } });
      if (!job || job.status === 'cancelling') {
        await prisma.pluginBackfillJob.update({
          where: { id: jobId },
          data: { status: 'cancelled', completedAt: new Date() },
        });
        return;
      }

      const batch = await fetchEligibleResponseBatch(formId, pluginId, BATCH_SIZE);
      if (batch.length === 0) break;

      for (const response of batch) {
        const event: PluginEvent = {
          type: 'form.submitted',
          formId,
          organizationId,
          data: {
            responseId: response.id,
            submittedAt: response.submittedAt.toISOString(),
            ...response.data,
          },
          timestamp: new Date(),
        };
        const result = await executePlugin(pluginId, event);
        processed += 1;
        if (result.success) {
          succeeded += 1;
        } else {
          failed += 1;
        }
      }

      await prisma.pluginBackfillJob.update({
        where: { id: jobId },
        data: { processedCount: processed, succeededCount: succeeded, failedCount: failed },
      });

      await wait(BATCH_DELAY_MS);
    }

    await prisma.pluginBackfillJob.update({
      where: { id: jobId },
      data: { status: 'completed', completedAt: new Date() },
    });
  } catch (error: any) {
    logger.error(`[Plugin Backfill] Job ${jobId} failed`, error);
    await prisma.pluginBackfillJob.update({
      where: { id: jobId },
      data: {
        status: 'failed',
        errorMessage: error.message || 'Unknown error',
        completedAt: new Date(),
      },
    });
  }
};
