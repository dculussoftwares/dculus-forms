import { PgBoss } from 'pg-boss';
import { logger } from '../../lib/logger.js';

// Queue on which every automation node execution job is enqueued: { runId, nodeId }.
export const AUTOMATION_QUEUE = 'automation-step';

let bossInstance: PgBoss | null = null;

/**
 * pg-boss needs a session-pinned connection (LISTEN/NOTIFY, advisory locks) and is
 * incompatible with PgBouncer transaction pooling — same constraint as Prisma
 * migrations, which is why this reads DIRECT_URL instead of the pooled DATABASE_URL.
 */
export function isAutomationEngineEnabled(): boolean {
  return Boolean(process.env.DIRECT_URL);
}

/**
 * Lazily constructs the pg-boss singleton. Does not start it — call startAutomationBoss()
 * once at boot. Returns null when DIRECT_URL is not configured so callers can degrade
 * gracefully instead of throwing.
 */
export function getBoss(): PgBoss | null {
  if (!isAutomationEngineEnabled()) {
    return null;
  }

  if (!bossInstance) {
    bossInstance = new PgBoss({
      connectionString: process.env.DIRECT_URL,
      schema: 'pgboss',
    });
    bossInstance.on('error', (error: Error) => {
      logger.error('[Automation Engine] pg-boss error:', error);
    });
  }

  return bossInstance;
}

/** Starts pg-boss and ensures the automation-step queue exists. No-op if disabled. */
export async function startAutomationBoss(): Promise<PgBoss | null> {
  const boss = getBoss();
  if (!boss) {
    logger.warn('[Automation Engine] DIRECT_URL is not set — automation engine disabled');
    return null;
  }

  await boss.start();
  await boss.createQueue(AUTOMATION_QUEUE);
  logger.info(`[Automation Engine] pg-boss started (queue: ${AUTOMATION_QUEUE})`);
  return boss;
}

/** Stops pg-boss gracefully and clears the singleton. No-op if never started. */
export async function stopAutomationBoss(): Promise<void> {
  if (!bossInstance) return;
  await bossInstance.stop();
  bossInstance = null;
}

// Test-only: reset the singleton between test cases.
export function __resetBossForTests(): void {
  bossInstance = null;
}
