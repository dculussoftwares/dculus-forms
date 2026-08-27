import * as Sentry from '@sentry/node';
import type { Prisma } from '#prisma-client';
import { generateId } from '@dculus/utils';
import { automationRepository, createAutomationRepository } from '../../repositories/index.js';
import { withPrisma } from '../../repositories/baseRepository.js';
import { prisma } from '../../lib/prisma.js';
import { logger } from '../../lib/logger.js';
import { getEventEmitter } from '../../plugins/core/events.js';
import type { PluginEvent } from '../../plugins/core/types.js';
import { enqueueFirstStep } from './engine.js';
import { recordRunOutcome } from './runOutcome.js';
import { AUTOMATION_QUEUE, AUTOMATION_CRON_QUEUE, getBoss } from './boss.js';
// Re-exported so existing importers keep their path; the implementations moved to
// cronSchedule.ts, which the engine's settle path can import without a cycle.
export { scheduleAutomationCron, unscheduleAutomationCron } from './cronSchedule.js';
import type { AutomationRunContext } from './types.js';

type ScheduledJobData = { automationId: string };

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
  if (event.type !== 'form.submitted' && event.type !== 'response.edited') return;
  if (event.data?.isPreview) return;

  // Loop guard (#201): an edit performed by an automation action (none exist today, but
  // future actions that edit a response must set this) carries the run that caused it.
  // Suppress creating new runs from that edit so an automation can never re-trigger itself
  // via its own writes.
  if (event.type === 'response.edited' && event.data?.sourceRunId) return;

  const automations = await automationRepository.listActiveByFormAndTrigger(event.formId, event.type);

  for (const automation of automations) {
    try {
      const context: AutomationRunContext = {
        triggerData: event.data,
        formId: event.formId,
        organizationId: event.organizationId,
      };

      const run = await automationRepository.createRun({
        id: generateId(),
        automationId: automation.id,
        responseId: event.data?.responseId ?? null,
        automationVersion: automation.version,
        graphSnapshot: automation.graph as Prisma.InputJsonValue,
        status: 'RUNNING',
        context: context as Prisma.InputJsonValue,
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
    const runs = await automationRepository.listActiveRunsByAutomation(automationId);

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
    await automationRepository.cancelRunsByIds(runs.map((run) => run.id));

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
  const run = await automationRepository.findRunById(runId);
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

  // Guard the write with the same status check rather than an unconditional update by
  // id: the run may have reached a terminal state concurrently (e.g. the engine completed
  // it) while the pg-boss cancel above was in flight, and this must not overwrite that
  // outcome with a stale CANCELLED.
  const { count } = await automationRepository.cancelRunIfActive(runId);
  if (count === 0) {
    logger.info(
      `[Automation Triggers] Run ${runId} reached a terminal state concurrently — skipping cancellation write`
    );
  }
  return automationRepository.findRunById(runId);
}

/**
 * Handles a single scheduled tick: re-checks the automation is still ACTIVE (a schedule can
 * fire in the narrow window between a pause/delete and its unschedule call landing) and, if so,
 * creates a run with responseId: null and no trigger response data — graphValidator (#201)
 * rejects response-dependent actions/conditions on schedule automations at activate time, so
 * every reachable action here is expected to tolerate an empty triggerData.
 */
async function handleScheduledTick(automationId: string): Promise<void> {
  try {
    const automation = await automationRepository.findById(automationId);
    if (!automation || automation.status !== 'ACTIVE' || automation.triggerType !== 'schedule') {
      logger.info(
        `[Automation Triggers] Skipping scheduled tick for ${automationId} — automation is not an ACTIVE schedule automation`
      );
      return;
    }

    const scheduledAt = new Date();
    const context: AutomationRunContext = {
      triggerData: {},
      formId: automation.formId,
      organizationId: automation.organizationId,
      trigger: { scheduledAt: scheduledAt.toISOString() },
    };

    // Never let two ticks of the same automation overlap. A digest node's window is
    // `(lastDigestedAt, startedAt]`, and the watermark only moves when a run finishes — so a tick
    // firing while the previous one is still working resolves the same lower bound and processes
    // the same responses a second time. A 3,000-email batch easily outlives a 15-minute cron.
    //
    // The check and the run creation share one transaction, under an advisory lock naming this
    // automation's tick: checking and then writing without one lets two workers both see an empty
    // result and both start. The lock is what makes the claim atomic; the check is what decides
    // whether there is anything to claim.
    const run = await prisma.$transaction(async (tx) => {
      const txRepo = createAutomationRepository(withPrisma(tx as any));

      // Another worker is mid-claim for this same tick — it will decide whether to run or skip,
      // and recording our own SKIPPED row alongside its decision would just be noise.
      if (!(await txRepo.tryLockScheduledTick(automation.id))) {
        logger.warn(
          `[Automation Triggers] Skipping scheduled tick for ${automationId} — another worker is already claiming this tick`
        );
        return null;
      }

      const activeRuns = await txRepo.listActiveRunsByAutomation(automation.id);
      if (activeRuns.length > 0) {
        logger.warn(
          `[Automation Triggers] Skipping scheduled tick for ${automationId} — ${activeRuns.length} run(s) still in flight`
        );
        // Recorded as a SKIPPED run rather than dropped silently: a tick that produced nothing is
        // exactly the kind of gap someone goes looking for in the run history, and "the previous
        // run was still going" is the answer they need.
        await txRepo.createRun({
          id: generateId(),
          automationId: automation.id,
          responseId: null,
          automationVersion: automation.version,
          graphSnapshot: automation.graph as Prisma.InputJsonValue,
          status: 'SKIPPED',
          completedAt: scheduledAt,
          context: {
            ...context,
            skipReason: 'A previous run of this automation was still in progress.',
            blockedByRunIds: activeRuns.map((activeRun) => activeRun.id),
          } as Prisma.InputJsonValue,
        });
        return null;
      }

      return txRepo.createRun({
        id: generateId(),
        automationId: automation.id,
        responseId: null,
        automationVersion: automation.version,
        graphSnapshot: automation.graph as Prisma.InputJsonValue,
        status: 'RUNNING',
        context: context as Prisma.InputJsonValue,
      });
    });

    if (!run) return;

    // Enqueued outside the transaction: the run row must be committed and visible before a worker
    // can pick the job up, or the step handler would look up a run that does not exist yet.
    try {
      await enqueueFirstStep(run);
    } catch (error) {
      // A run left RUNNING with nothing queued is worse than a failed one: the overlap guard above
      // reads RUNNING as in-flight, so this automation's every future tick would be skipped
      // indefinitely. Settling it as FAILED keeps the automation ticking, and surfaces the problem
      // through the same failure path as any other broken run.
      logger.error(
        `[Automation Triggers] Failed to enqueue the first step for run ${run.id} — marking it FAILED so it cannot block future ticks:`,
        error
      );
      Sentry.captureException(error);
      await automationRepository.updateRun(run.id, { status: 'FAILED', completedAt: new Date() });
      await recordRunOutcome(automation.id, run.id, 'FAILED');
    }
  } catch (error) {
    logger.error(`[Automation Triggers] Failed to handle scheduled tick for automation ${automationId}:`, error);
    Sentry.captureException(error);
  }
}

/** Registers the pg-boss worker that fires scheduled automation runs. No-op if disabled. */
export async function initializeAutomationScheduleTrigger(): Promise<void> {
  const boss = getBoss();
  if (!boss) return;

  await boss.work(AUTOMATION_CRON_QUEUE, async (jobs: Array<{ data: ScheduledJobData }>) => {
    for (const job of jobs) {
      await handleScheduledTick(job.data.automationId);
    }
  });

  logger.info(`[Automation Triggers] Schedule trigger worker registered on queue: ${AUTOMATION_CRON_QUEUE}`);
}
