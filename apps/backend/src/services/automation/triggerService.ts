import * as Sentry from '@sentry/node';
import type { Prisma } from '#prisma-client';
import { generateId } from '@dculus/utils';
import { prisma } from '../../lib/prisma.js';
import { logger } from '../../lib/logger.js';
import { getEventEmitter } from '../../plugins/core/events.js';
import type { PluginEvent } from '../../plugins/core/types.js';
import { enqueueFirstStep } from './engine.js';
import { AUTOMATION_QUEUE, getBoss } from './boss.js';
import type { AutomationRunContext } from './types.js';

/**
 * Additional listener on the shared plugin EventEmitter (apps/backend/src/plugins/core/events.ts).
 * This is deliberately a *second* `plugin:event` listener alongside the one registered by
 * initializePluginEvents() — it must never touch that listener or its behavior, so form
 * submission latency and the existing Plugins feature stay unchanged.
 */
export function initializeAutomationTriggers(): void {
  logger.info('[Automation Triggers] Initializing automation trigger listener...');

  getEventEmitter().on('plugin:event', async (event: PluginEvent) => {
    try {
      await handlePluginEvent(event);
    } catch (error) {
      logger.error('[Automation Triggers] Error handling event:', error);
      Sentry.captureException(error);
    }
  });

  logger.info('[Automation Triggers] Automation trigger listener initialized');
}

async function handlePluginEvent(event: PluginEvent): Promise<void> {
  if (event.type !== 'form.submitted') return;
  if (event.data?.isPreview) return;

  const automations = await prisma.automation.findMany({
    where: { formId: event.formId, status: 'ACTIVE', triggerType: 'form.submitted' },
  });

  for (const automation of automations) {
    try {
      const context: AutomationRunContext = {
        triggerData: event.data,
        formId: event.formId,
        organizationId: event.organizationId,
      };

      const run = await prisma.automationRun.create({
        data: {
          id: generateId(),
          automationId: automation.id,
          responseId: event.data?.responseId ?? null,
          automationVersion: automation.version,
          graphSnapshot: automation.graph as Prisma.InputJsonValue,
          status: 'RUNNING',
          context: context as Prisma.InputJsonValue,
        },
      });

      await enqueueFirstStep(run);
    } catch (error) {
      logger.error(
        `[Automation Triggers] Failed to create/enqueue run for automation ${automation.id}:`,
        error
      );
      Sentry.captureException(error);
    }
  }
}

/**
 * Marks all RUNNING/WAITING runs for an automation CANCELLED and cancels their outstanding
 * pg-boss jobs. Used by delete/pause (#195) so in-flight runs stop instead of executing
 * against a deleted or deactivated automation.
 */
export async function cancelRunsForAutomation(automationId: string, reason: string): Promise<void> {
  try {
    const runs = await prisma.automationRun.findMany({
      where: { automationId, status: { in: ['RUNNING', 'WAITING'] } },
      select: { id: true },
    });

    if (runs.length === 0) return;

    const boss = getBoss();
    if (boss) {
      for (const run of runs) {
        try {
          // No `queued` filter: an in-flight (active) step's job should be marked
          // cancelled too, not just ones that haven't started yet — pg-boss's
          // cancel() is a no-op on jobs already in a terminal state, so including
          // those here is harmless.
          const jobs = await boss.findJobs(AUTOMATION_QUEUE, { data: { runId: run.id } });
          const jobIds = jobs.map((job) => job.id);
          if (jobIds.length > 0) {
            await boss.cancel(AUTOMATION_QUEUE, jobIds);
          }
        } catch (error) {
          logger.error(
            `[Automation Triggers] Failed to cancel pg-boss jobs for run ${run.id}:`,
            error
          );
          Sentry.captureException(error);
        }
      }
    }

    // Scoped to the exact run ids captured above (not re-queried by status) so a run
    // created for this automation after the findMany snapshot — e.g. a new submission
    // arriving mid-cancellation — is never swept into this update.
    await prisma.automationRun.updateMany({
      where: { id: { in: runs.map((run) => run.id) } },
      data: { status: 'CANCELLED', completedAt: new Date() },
    });

    logger.info(
      `[Automation Triggers] Cancelled ${runs.length} run(s) for automation ${automationId}: ${reason}`
    );
  } catch (error) {
    logger.error(`[Automation Triggers] Error cancelling runs for automation ${automationId}:`, error);
    Sentry.captureException(error);
  }
}

/**
 * Cancels a single in-flight run and its outstanding pg-boss job(s). Used by the
 * cancelAutomationRun mutation (#195). Idempotent: a run that's already terminal is
 * returned unchanged rather than re-cancelled. Returns null if the run doesn't exist.
 */
export async function cancelSingleAutomationRun(runId: string) {
  const run = await prisma.automationRun.findUnique({ where: { id: runId } });
  if (!run) return null;
  if (run.status !== 'RUNNING' && run.status !== 'WAITING') {
    return run;
  }

  const boss = getBoss();
  if (boss) {
    try {
      const jobs = await boss.findJobs(AUTOMATION_QUEUE, { data: { runId } });
      const jobIds = jobs.map((job) => job.id);
      if (jobIds.length > 0) {
        await boss.cancel(AUTOMATION_QUEUE, jobIds);
      }
    } catch (error) {
      logger.error(`[Automation Triggers] Failed to cancel pg-boss jobs for run ${runId}:`, error);
      Sentry.captureException(error);
    }
  }

  return prisma.automationRun.update({
    where: { id: runId },
    data: { status: 'CANCELLED', completedAt: new Date() },
  });
}
