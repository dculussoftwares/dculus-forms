import { logger } from '../../lib/logger.js';
import { AUTOMATION_CRON_QUEUE, getBoss } from './boss.js';

/**
 * pg-boss cron registration for `schedule`-triggerType automations, kept in its own module rather
 * than inside triggerService because three different callers need it — the CRUD service on
 * activate/pause, the trigger service, and the run-outcome recorder when it auto-pauses a
 * repeatedly failing automation. triggerService imports the engine, so anything the engine's own
 * settle path needs cannot live there without a cycle.
 *
 * Depends only on boss.js and the logger, which is what keeps it cycle-free.
 */

type ScheduledJobData = { automationId: string };

/**
 * Registers/updates the cron schedule for an automation. Uses a single shared queue with
 * `key: automationId` rather than a per-automation queue name — `boss.schedule` upserts by
 * (queue, key), which is idempotent across a multi-instance deploy and needs no per-automation
 * worker registration. No-op (with a warning) when the engine is disabled.
 */
export async function scheduleAutomationCron(
  automationId: string,
  cron: string,
  timezone?: string
): Promise<void> {
  const boss = getBoss();
  if (!boss) {
    logger.warn(`[Automation Triggers] Cannot schedule cron for automation ${automationId} — engine disabled`);
    return;
  }

  const options: { key: string; tz?: string } = { key: automationId };
  if (timezone) options.tz = timezone;

  await boss.schedule(AUTOMATION_CRON_QUEUE, cron, { automationId } satisfies ScheduledJobData, options);
  logger.info(`[Automation Triggers] Scheduled cron for automation ${automationId}: ${cron}`);
}

/** Removes the cron schedule for an automation (pause/delete/auto-pause). Idempotent. */
export async function unscheduleAutomationCron(automationId: string): Promise<void> {
  const boss = getBoss();
  if (!boss) return;

  await boss.unschedule(AUTOMATION_CRON_QUEUE, automationId);
  logger.info(`[Automation Triggers] Unscheduled cron for automation ${automationId}`);
}
