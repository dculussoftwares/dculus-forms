import { beforeEach, describe, expect, it, vi } from 'vitest';

const repo = vi.hoisted(() => ({
  deletePluginDeliveriesForResponses: vi.fn().mockResolvedValue(0),
  deleteFinishedAutomationRunsForResponses: vi.fn().mockResolvedValue(0),
  deleteEditHistoryForResponses: vi.fn().mockResolvedValue(0),
  deletePluginDeliveriesBefore: vi.fn().mockResolvedValue(0),
  deleteFinishedAutomationRunsBefore: vi.fn().mockResolvedValue(0),
  deleteAIChatMessagesBefore: vi.fn().mockResolvedValue(0),
  findSoftDeletedResponseIds: vi.fn(),
}));

vi.mock('../../repositories/dataRetentionRepository.js', () => ({ dataRetentionRepository: repo }));
vi.mock('../../repositories/webhookEventRepository.js', () => ({
  webhookEventRepository: { purgeOlderThan: vi.fn().mockResolvedValue({ count: 0 }) },
}));
vi.mock('../../lib/logger.js', () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));

import { purgeResponseSideData, purgeResponseSideDataSafely, runDataRetention } from '../dataRetentionService.js';

describe('dataRetentionService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.RETENTION_PLUGIN_DELIVERY_DAYS;
  });

  it('purges every side table for the given responses', async () => {
    await purgeResponseSideData(['r1', 'r2']);
    expect(repo.deletePluginDeliveriesForResponses).toHaveBeenCalledWith(['r1', 'r2']);
    expect(repo.deleteFinishedAutomationRunsForResponses).toHaveBeenCalledWith(['r1', 'r2']);
    expect(repo.deleteEditHistoryForResponses).toHaveBeenCalledWith(['r1', 'r2']);
  });

  it('swallows purge failures on the delete path', async () => {
    repo.deletePluginDeliveriesForResponses.mockRejectedValueOnce(new Error('boom'));
    await expect(purgeResponseSideDataSafely(['r1'])).resolves.toBeUndefined();
  });

  it('skips the purge for an empty id list', async () => {
    await purgeResponseSideDataSafely([]);
    expect(repo.deletePluginDeliveriesForResponses).not.toHaveBeenCalled();
  });

  it('sweeps soft-deleted responses and applies TTL cutoffs', async () => {
    repo.findSoftDeletedResponseIds.mockResolvedValueOnce(['r1']);
    process.env.RETENTION_PLUGIN_DELIVERY_DAYS = '10';
    const now = new Date('2026-01-31T00:00:00.000Z');

    await runDataRetention(now);

    expect(repo.deletePluginDeliveriesForResponses).toHaveBeenCalledWith(['r1']);
    expect(repo.deletePluginDeliveriesBefore).toHaveBeenCalledWith(new Date('2026-01-21T00:00:00.000Z'));
    expect(repo.deleteFinishedAutomationRunsBefore).toHaveBeenCalledWith(new Date('2025-11-02T00:00:00.000Z'));
    expect(repo.deleteAIChatMessagesBefore).toHaveBeenCalledWith(new Date('2025-08-04T00:00:00.000Z'));
  });
});
