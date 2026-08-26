import * as Sentry from '@sentry/node';
import { logger } from '../../lib/logger.js';
import { automationRepository } from '../../repositories/index.js';
import { prisma } from '../../lib/prisma.js';
import { sendAutomationFailureEmail } from '../emailService.js';
import { unscheduleAutomationCron } from './cronSchedule.js';

/**
 * Records how a run ended on its automation, and decides whether anyone needs telling (gap G).
 *
 * Before this, failures went to `AutomationRun` and Sentry and nowhere else: an expired OAuth
 * token meant every run failed silently until somebody happened to open the runs page. The
 * outcome is denormalised onto the automation so the list can badge a broken one without scanning
 * its history, and a failure streak drives two escalations — a mail on the first failure, and an
 * auto-pause once the streak shows the automation is simply broken rather than unlucky.
 */

/**
 * Consecutive failures before an automation pauses itself. Deliberately larger than
 * ACTION_RETRY_LIMIT (3), which counts attempts *within* one run: this counts whole runs, so
 * reaching it means five separate triggers all failed after exhausting their own retries.
 */
export const AUTO_PAUSE_AFTER_FAILURES = 5;

/** Outcomes that count against the failure streak, vs. reset it, vs. leave it alone. */
function classifyForStreak(status: string): 'failure' | 'success' | 'neutral' {
  if (status === 'FAILED') return 'failure';
  if (status === 'COMPLETED') return 'success';
  // PARTIAL delivered something, so it is worth badging but not worth pausing an automation over
  // — pausing would stop the part that still works. CANCELLED and SKIPPED are user-initiated or
  // benign, and must not push an otherwise-healthy automation towards auto-pause.
  return 'neutral';
}

/**
 * Called whenever a run reaches a terminal state. Never throws: an automation's bookkeeping must
 * not be able to fail the run that triggered it, or a notification outage would turn into a
 * delivery outage.
 */
export async function recordRunOutcome(
  automationId: string,
  runId: string,
  status: string
): Promise<void> {
  try {
    const streak = classifyForStreak(status);

    const automation = await automationRepository.updateAutomation(automationId, {
      lastRunStatus: status,
      lastRunAt: new Date(),
      ...(streak === 'failure'
        ? { consecutiveFailureCount: { increment: 1 } }
        : streak === 'success'
          ? { consecutiveFailureCount: 0 }
          : {}),
    });

    if (streak !== 'failure') return;

    const failures = automation.consecutiveFailureCount;

    // Notify exactly twice per streak: once when it starts, once when it forces a pause. The
    // counter is its own debounce — no separate "last notified" timestamp to keep in sync.
    if (failures === 1) {
      await notifyOwner(automation, runId, 'first-failure');
    } else if (failures === AUTO_PAUSE_AFTER_FAILURES && automation.status === 'ACTIVE') {
      await pauseBrokenAutomation(automation);
      await notifyOwner(automation, runId, 'auto-paused');
    }
  } catch (error) {
    // Sentry only: the run itself already settled correctly, and this is bookkeeping on top of it.
    logger.error(`[Automation Health] Failed to record outcome for automation ${automationId}:`, error);
    Sentry.captureException(error);
  }
}

/**
 * Stops an automation that has failed `AUTO_PAUSE_AFTER_FAILURES` times in a row. Every mature
 * workflow product does this: a broken automation left running burns quota and retries against a
 * receiver that is not coming back, and buries the run history under identical failures. Pausing
 * is reversible by the user in one click, which is why it is the safe side to err on.
 */
async function pauseBrokenAutomation(automation: { id: string; triggerType: string }): Promise<void> {
  await automationRepository.updateAutomation(automation.id, { status: 'PAUSED', updatedAt: new Date() });
  if (automation.triggerType === 'schedule') {
    await unscheduleAutomationCron(automation.id);
  }
  logger.warn(
    `[Automation Health] Auto-paused automation ${automation.id} after ${AUTO_PAUSE_AFTER_FAILURES} consecutive failures`
  );
}

async function notifyOwner(
  automation: { id: string; name: string; formId: string; createdBy: string },
  runId: string,
  reason: 'first-failure' | 'auto-paused'
): Promise<void> {
  const owner = await prisma.user.findUnique({
    where: { id: automation.createdBy },
    select: { email: true, name: true },
  });

  if (!owner?.email) {
    logger.warn(
      `[Automation Health] No email on record for automation ${automation.id}'s owner — skipping ${reason} notification`
    );
    return;
  }

  await sendAutomationFailureEmail({
    to: owner.email,
    ownerName: owner.name || owner.email,
    automationName: automation.name,
    automationId: automation.id,
    formId: automation.formId,
    runId,
    reason,
    consecutiveFailures: reason === 'auto-paused' ? AUTO_PAUSE_AFTER_FAILURES : 1,
  });
}
