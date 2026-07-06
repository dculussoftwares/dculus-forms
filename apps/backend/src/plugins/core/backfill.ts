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
    // Tracks responses already attempted in this run. A response that keeps failing
    // (e.g. a misconfigured plugin) never gets a successful delivery, so it would
    // otherwise stay "eligible" forever and be re-fetched every batch, looping
    // indefinitely. Each response gets exactly one attempt per backfill run.
    const attemptedResponseIds = new Set<string>();

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

      const rawBatch = await fetchEligibleResponseBatch(formId, pluginId, BATCH_SIZE);
      const batch = rawBatch.filter((response) => !attemptedResponseIds.has(response.id));
      if (batch.length === 0) break;

      for (const response of batch) {
        attemptedResponseIds.add(response.id);

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

        // Written after every response (not just every batch) so a slow batch never
        // lets `updatedAt` go stale enough to trip stalled-job detection while the
        // loop is still healthy — see getLatestBackfillJob's STALLED_THRESHOLD_MS check.
        await prisma.pluginBackfillJob.update({
          where: { id: jobId },
          data: { processedCount: processed, succeededCount: succeeded, failedCount: failed },
        });
      }

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

const STALLED_THRESHOLD_MS = 5 * 60 * 1000;

export const cancelBackfill = async (jobId: string): Promise<BackfillJob> => {
  const job = await prisma.pluginBackfillJob.findUnique({ where: { id: jobId } });
  if (!job) {
    throw createGraphQLError('Backfill job not found', GRAPHQL_ERROR_CODES.NOT_FOUND);
  }
  if (job.status !== 'running') {
    return job as unknown as BackfillJob;
  }

  const updated = await prisma.pluginBackfillJob.update({
    where: { id: jobId },
    data: { status: 'cancelling' },
  });
  return updated as unknown as BackfillJob;
};

export const getLatestBackfillJob = async (pluginId: string): Promise<BackfillJob | null> => {
  const job = await prisma.pluginBackfillJob.findFirst({
    where: { pluginId },
    orderBy: { startedAt: 'desc' },
  });
  if (!job) return null;

  if (job.status === 'running') {
    const staleMs = Date.now() - job.updatedAt.getTime();
    if (staleMs > STALLED_THRESHOLD_MS) {
      const updated = await prisma.pluginBackfillJob.update({
        where: { id: job.id },
        data: {
          status: 'failed',
          errorMessage: 'Job appears stalled, possibly due to a server restart. Click Backfill again to retry.',
          completedAt: new Date(),
        },
      });
      return updated as unknown as BackfillJob;
    }
  }

  return job as unknown as BackfillJob;
};
