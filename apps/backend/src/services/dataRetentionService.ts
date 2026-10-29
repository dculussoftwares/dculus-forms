import { dataRetentionRepository } from '../repositories/dataRetentionRepository.js';
import { webhookEventRepository } from '../repositories/webhookEventRepository.js';
import { logger } from '../lib/logger.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const PURGE_PAGE_SIZE = 500;
const WEBHOOK_EVENT_RETENTION_DAYS = 30;

/** Documented retention schedule; each value can be overridden with the env var shown. */
export const RETENTION_DEFAULTS = {
  pluginDeliveryDays: 90, // RETENTION_PLUGIN_DELIVERY_DAYS
  automationRunDays: 90, // RETENTION_AUTOMATION_RUN_DAYS
  aiChatMessageDays: 180, // RETENTION_AI_CHAT_DAYS
} as const;

const daysFromEnv = (name: string, fallback: number): number => {
  const parsed = Number.parseInt(process.env[name] ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const chunk = <T>(items: T[], size: number): T[][] => {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
};

/**
 * Removes the copies of respondent answers that live outside `response`
 * (plugin payloads, automation context, edit history) for the given responses.
 */
export const purgeResponseSideData = async (responseIds: string[]): Promise<void> => {
  for (const ids of chunk(responseIds, PURGE_PAGE_SIZE)) {
    await dataRetentionRepository.deletePluginDeliveriesForResponses(ids);
    await dataRetentionRepository.deleteFinishedAutomationRunsForResponses(ids);
    await dataRetentionRepository.deleteEditHistoryForResponses(ids);
  }
};

/** Best-effort variant for delete paths: a purge failure must not fail the deletion itself. */
export const purgeResponseSideDataSafely = async (responseIds: string[]): Promise<void> => {
  if (responseIds.length === 0) return;
  try {
    await purgeResponseSideData(responseIds);
  } catch (error) {
    logger.warn('Failed to purge side data for deleted responses:', error);
  }
};

/** Daily job: sweeps side data of every soft-deleted response and applies the TTLs. */
export const runDataRetention = async (now: Date = new Date()): Promise<void> => {
  let afterId: string | undefined;
  for (;;) {
    const ids = await dataRetentionRepository.findSoftDeletedResponseIds(PURGE_PAGE_SIZE, afterId);
    if (ids.length === 0) break;
    await purgeResponseSideData(ids);
    afterId = ids[ids.length - 1];
    if (ids.length < PURGE_PAGE_SIZE) break;
  }

  const cutoff = (days: number) => new Date(now.getTime() - days * DAY_MS);
  const deliveries = await dataRetentionRepository.deletePluginDeliveriesBefore(
    cutoff(daysFromEnv('RETENTION_PLUGIN_DELIVERY_DAYS', RETENTION_DEFAULTS.pluginDeliveryDays))
  );
  const runs = await dataRetentionRepository.deleteFinishedAutomationRunsBefore(
    cutoff(daysFromEnv('RETENTION_AUTOMATION_RUN_DAYS', RETENTION_DEFAULTS.automationRunDays))
  );
  const messages = await dataRetentionRepository.deleteAIChatMessagesBefore(
    cutoff(daysFromEnv('RETENTION_AI_CHAT_DAYS', RETENTION_DEFAULTS.aiChatMessageDays))
  );
  // Chargebee retries a failed event for days at most; keep ids well past that for dedupe.
  await webhookEventRepository.purgeOlderThan(cutoff(WEBHOOK_EVENT_RETENTION_DAYS));
  logger.info(
    `Data retention: purged ${deliveries} plugin deliveries, ${runs} automation runs, ${messages} AI chat messages past retention`
  );
};
