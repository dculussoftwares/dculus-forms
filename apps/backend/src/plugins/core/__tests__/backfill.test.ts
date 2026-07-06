import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { countEligibleResponses, fetchEligibleResponseBatch, startBackfill, runBackfillLoop } from '../backfill.js';
import { cancelBackfill, getLatestBackfillJob } from '../backfill.js';
import { prisma } from '../../../lib/prisma.js';
import { executePlugin } from '../executor.js';

vi.mock('../../../lib/prisma.js', () => ({
  prisma: {
    $queryRaw: vi.fn(),
    formPlugin: { findUnique: vi.fn() },
    pluginBackfillJob: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock('#prisma-client', () => ({
  Prisma: {
    sql: (strings: TemplateStringsArray, ...values: any[]) => ({ strings, values }),
  },
}));

vi.mock('../../../lib/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock('../executor.js', () => ({
  executePlugin: vi.fn(),
}));

describe('backfill eligibility queries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('countEligibleResponses', () => {
    it('returns the count from the raw query result', async () => {
      vi.mocked(prisma.$queryRaw).mockResolvedValue([{ count: 42n }]);

      const result = await countEligibleResponses('form-123', 'plugin-456');

      expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
      expect(result).toBe(42);

      const sqlCall = vi.mocked(prisma.$queryRaw).mock.calls[0][0] as unknown as {
        strings: TemplateStringsArray;
        values: any[];
      };
      const sqlText = sqlCall.strings.join('');
      expect(sqlText).toContain('NOT EXISTS');
      expect(sqlText).toContain("status = 'success'");
      expect(sqlText).toContain('"deletedAt" IS NULL');
    });

    it('returns 0 when the query returns no rows', async () => {
      vi.mocked(prisma.$queryRaw).mockResolvedValue([]);

      const result = await countEligibleResponses('form-123', 'plugin-456');

      expect(result).toBe(0);

      const sqlCall = vi.mocked(prisma.$queryRaw).mock.calls[0][0] as unknown as {
        strings: TemplateStringsArray;
        values: any[];
      };
      const sqlText = sqlCall.strings.join('');
      expect(sqlText).toContain('NOT EXISTS');
      expect(sqlText).toContain("status = 'success'");
      expect(sqlText).toContain('"deletedAt" IS NULL');
    });
  });

  describe('fetchEligibleResponseBatch', () => {
    it('returns the rows from the raw query', async () => {
      const rows = [
        { id: 'response-1', data: { q1: 'a' }, submittedAt: new Date('2024-01-01') },
        { id: 'response-2', data: { q1: 'b' }, submittedAt: new Date('2024-01-02') },
      ];
      vi.mocked(prisma.$queryRaw).mockResolvedValue(rows);

      const result = await fetchEligibleResponseBatch('form-123', 'plugin-456', 20);

      expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
      expect(result).toEqual(rows);

      const sqlCall = vi.mocked(prisma.$queryRaw).mock.calls[0][0] as unknown as {
        strings: TemplateStringsArray;
        values: any[];
      };
      const sqlText = sqlCall.strings.join('');
      expect(sqlText).toContain('NOT EXISTS');
      expect(sqlText).toContain("status = 'success'");
      expect(sqlText).toContain('"deletedAt" IS NULL');
      expect(sqlCall.values).toContain(20);
      expect(sqlText).not.toContain("'20'");
    });
  });
});

describe('startBackfill', () => {
  const mockPlugin = {
    id: 'plugin-456',
    formId: 'form-123',
    type: 'webhook',
    enabled: true,
    form: { organizationId: 'org-789' },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws when the plugin does not exist', async () => {
    vi.mocked(prisma.formPlugin.findUnique).mockResolvedValue(null);

    await expect(startBackfill('missing-plugin')).rejects.toThrow('Plugin not found');
  });

  it('throws when the plugin is disabled', async () => {
    vi.mocked(prisma.formPlugin.findUnique).mockResolvedValue({ ...mockPlugin, enabled: false } as any);

    await expect(startBackfill('plugin-456')).rejects.toThrow('Cannot backfill a disabled plugin');
  });

  it('throws when a job is already running for this plugin', async () => {
    vi.mocked(prisma.formPlugin.findUnique).mockResolvedValue(mockPlugin as any);
    vi.mocked(prisma.pluginBackfillJob.findFirst).mockResolvedValue({ id: 'job-1', status: 'running' } as any);

    await expect(startBackfill('plugin-456')).rejects.toThrow('A backfill is already running for this plugin');
  });

  it('creates a job with the eligible response count', async () => {
    vi.mocked(prisma.formPlugin.findUnique).mockResolvedValue(mockPlugin as any);
    vi.mocked(prisma.pluginBackfillJob.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.$queryRaw).mockResolvedValue([{ count: 7n }]);
    const createdJob = {
      id: 'job-new',
      pluginId: 'plugin-456',
      formId: 'form-123',
      status: 'running',
      totalCount: 7,
      processedCount: 0,
      succeededCount: 0,
      failedCount: 0,
      errorMessage: null,
      startedAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
      completedAt: null,
    };
    vi.mocked(prisma.pluginBackfillJob.create).mockResolvedValue(createdJob as any);

    const result = await startBackfill('plugin-456');

    expect(prisma.pluginBackfillJob.findFirst).toHaveBeenCalledWith({
      where: { pluginId: 'plugin-456', status: { in: ['running', 'cancelling'] } },
    });
    expect(prisma.pluginBackfillJob.create).toHaveBeenCalledWith({
      data: {
        id: expect.any(String),
        pluginId: 'plugin-456',
        formId: 'form-123',
        status: 'running',
        totalCount: 7,
      },
    });
    expect(result).toEqual(createdJob);
  });
});

describe('runBackfillLoop', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('marks the job completed when there are no eligible responses', async () => {
    vi.mocked(prisma.$queryRaw).mockResolvedValue([]);
    vi.mocked(prisma.pluginBackfillJob.findUnique).mockResolvedValue({ id: 'job-1', status: 'running' } as any);
    vi.mocked(prisma.pluginBackfillJob.update).mockResolvedValue({} as any);

    await runBackfillLoop('job-1', 'plugin-456', 'form-123', 'org-789');

    expect(executePlugin).not.toHaveBeenCalled();
    expect(prisma.pluginBackfillJob.update).toHaveBeenCalledWith({
      where: { id: 'job-1' },
      data: { status: 'completed', completedAt: expect.any(Date) },
    });
  });

  it('processes a batch, updates counts, then completes on the next empty batch', async () => {
    const batch = [
      { id: 'response-1', data: { q1: 'a' }, submittedAt: new Date('2024-01-01T00:00:00Z') },
      { id: 'response-2', data: { q1: 'b' }, submittedAt: new Date('2024-01-02T00:00:00Z') },
    ];
    vi.mocked(prisma.$queryRaw)
      .mockResolvedValueOnce(batch)
      .mockResolvedValueOnce([]);
    vi.mocked(prisma.pluginBackfillJob.findUnique).mockResolvedValue({ id: 'job-1', status: 'running' } as any);
    vi.mocked(prisma.pluginBackfillJob.update).mockResolvedValue({} as any);
    vi.mocked(executePlugin)
      .mockResolvedValueOnce({ success: true })
      .mockResolvedValueOnce({ success: false, error: 'boom' });

    const runPromise = runBackfillLoop('job-1', 'plugin-456', 'form-123', 'org-789');
    await vi.runAllTimersAsync();
    await runPromise;

    expect(executePlugin).toHaveBeenCalledTimes(2);
    expect(executePlugin).toHaveBeenNthCalledWith(1, 'plugin-456', {
      type: 'form.submitted',
      formId: 'form-123',
      organizationId: 'org-789',
      data: { responseId: 'response-1', submittedAt: '2024-01-01T00:00:00.000Z', q1: 'a' },
      timestamp: expect.any(Date),
    });
    expect(prisma.pluginBackfillJob.update).toHaveBeenCalledWith({
      where: { id: 'job-1' },
      data: { processedCount: 2, succeededCount: 1, failedCount: 1 },
    });
    expect(prisma.pluginBackfillJob.update).toHaveBeenLastCalledWith({
      where: { id: 'job-1' },
      data: { status: 'completed', completedAt: expect.any(Date) },
    });
  });

  it('stops and marks the job cancelled when status flips to cancelling', async () => {
    const batch = [{ id: 'response-1', data: {}, submittedAt: new Date('2024-01-01T00:00:00Z') }];
    vi.mocked(prisma.$queryRaw).mockResolvedValue(batch);
    vi.mocked(prisma.pluginBackfillJob.findUnique)
      .mockResolvedValueOnce({ id: 'job-1', status: 'running' } as any)
      .mockResolvedValueOnce({ id: 'job-1', status: 'cancelling' } as any);
    vi.mocked(prisma.pluginBackfillJob.update).mockResolvedValue({} as any);
    vi.mocked(executePlugin).mockResolvedValue({ success: true });

    const runPromise = runBackfillLoop('job-1', 'plugin-456', 'form-123', 'org-789');
    await vi.runAllTimersAsync();
    await runPromise;

    expect(prisma.pluginBackfillJob.update).toHaveBeenLastCalledWith({
      where: { id: 'job-1' },
      data: { status: 'cancelled', completedAt: expect.any(Date) },
    });
  });

  it('stops after one attempt per response instead of looping forever when every delivery fails', async () => {
    const batch = [
      { id: 'response-1', data: {}, submittedAt: new Date('2024-01-01T00:00:00Z') },
      { id: 'response-2', data: {}, submittedAt: new Date('2024-01-02T00:00:00Z') },
    ];
    // The eligibility query always returns the same batch, since neither response
    // ever gets a successful delivery — this is what a perpetually-failing plugin
    // (e.g. misconfigured SMTP/webhook) looks like in production.
    vi.mocked(prisma.$queryRaw).mockResolvedValue(batch);
    vi.mocked(prisma.pluginBackfillJob.findUnique).mockResolvedValue({ id: 'job-1', status: 'running' } as any);
    vi.mocked(prisma.pluginBackfillJob.update).mockResolvedValue({} as any);
    vi.mocked(executePlugin).mockResolvedValue({ success: false, error: 'smtp unreachable' });

    const runPromise = runBackfillLoop('job-1', 'plugin-456', 'form-123', 'org-789');
    await vi.runAllTimersAsync();
    await runPromise;

    // Each response attempted exactly once, not indefinitely.
    expect(executePlugin).toHaveBeenCalledTimes(2);
    expect(prisma.pluginBackfillJob.update).toHaveBeenLastCalledWith({
      where: { id: 'job-1' },
      data: { status: 'completed', completedAt: expect.any(Date) },
    });
    expect(prisma.pluginBackfillJob.update).toHaveBeenCalledWith({
      where: { id: 'job-1' },
      data: { processedCount: 2, succeededCount: 0, failedCount: 2 },
    });
  });

  it('writes progress after each response, not just once per batch', async () => {
    const batch = [
      { id: 'response-1', data: {}, submittedAt: new Date('2024-01-01T00:00:00Z') },
      { id: 'response-2', data: {}, submittedAt: new Date('2024-01-02T00:00:00Z') },
    ];
    vi.mocked(prisma.$queryRaw)
      .mockResolvedValueOnce(batch)
      .mockResolvedValueOnce([]);
    vi.mocked(prisma.pluginBackfillJob.findUnique).mockResolvedValue({ id: 'job-1', status: 'running' } as any);
    vi.mocked(prisma.pluginBackfillJob.update).mockResolvedValue({} as any);
    vi.mocked(executePlugin).mockResolvedValue({ success: true });

    const runPromise = runBackfillLoop('job-1', 'plugin-456', 'form-123', 'org-789');
    await vi.runAllTimersAsync();
    await runPromise;

    // An intermediate write after the FIRST response (before the second has been
    // processed) proves progress is persisted per-response, not batched up and
    // written once at the end — this keeps `updatedAt` fresh enough that a slow
    // batch can't be mistaken for a stalled job by getLatestBackfillJob.
    expect(prisma.pluginBackfillJob.update).toHaveBeenCalledWith({
      where: { id: 'job-1' },
      data: { processedCount: 1, succeededCount: 1, failedCount: 0 },
    });
    expect(prisma.pluginBackfillJob.update).toHaveBeenCalledWith({
      where: { id: 'job-1' },
      data: { processedCount: 2, succeededCount: 2, failedCount: 0 },
    });
  });

  it('marks the job failed when an unexpected error is thrown', async () => {
    vi.mocked(prisma.$queryRaw).mockRejectedValue(new Error('db down'));
    vi.mocked(prisma.pluginBackfillJob.findUnique).mockResolvedValue({ id: 'job-1', status: 'running' } as any);
    vi.mocked(prisma.pluginBackfillJob.update).mockResolvedValue({} as any);

    await runBackfillLoop('job-1', 'plugin-456', 'form-123', 'org-789');

    expect(prisma.pluginBackfillJob.update).toHaveBeenCalledWith({
      where: { id: 'job-1' },
      data: { status: 'failed', errorMessage: 'db down', completedAt: expect.any(Date) },
    });
  });
});

describe('cancelBackfill', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws when the job does not exist', async () => {
    vi.mocked(prisma.pluginBackfillJob.findUnique).mockResolvedValue(null);

    await expect(cancelBackfill('missing-job')).rejects.toThrow('Backfill job not found');
  });

  it('returns the job unchanged if it is not running', async () => {
    const job = { id: 'job-1', status: 'completed' };
    vi.mocked(prisma.pluginBackfillJob.findUnique).mockResolvedValue(job as any);

    const result = await cancelBackfill('job-1');

    expect(prisma.pluginBackfillJob.update).not.toHaveBeenCalled();
    expect(result).toEqual(job);
  });

  it('flips a running job to cancelling', async () => {
    vi.mocked(prisma.pluginBackfillJob.findUnique).mockResolvedValue({ id: 'job-1', status: 'running' } as any);
    const updated = { id: 'job-1', status: 'cancelling' };
    vi.mocked(prisma.pluginBackfillJob.update).mockResolvedValue(updated as any);

    const result = await cancelBackfill('job-1');

    expect(prisma.pluginBackfillJob.update).toHaveBeenCalledWith({
      where: { id: 'job-1' },
      data: { status: 'cancelling' },
    });
    expect(result).toEqual(updated);
  });
});

describe('getLatestBackfillJob', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null when no job has ever run', async () => {
    vi.mocked(prisma.pluginBackfillJob.findFirst).mockResolvedValue(null);

    const result = await getLatestBackfillJob('plugin-456');

    expect(result).toBeNull();
  });

  it('returns a non-stale running job unchanged', async () => {
    const job = { id: 'job-1', status: 'running', updatedAt: new Date() };
    vi.mocked(prisma.pluginBackfillJob.findFirst).mockResolvedValue(job as any);

    const result = await getLatestBackfillJob('plugin-456');

    expect(prisma.pluginBackfillJob.update).not.toHaveBeenCalled();
    expect(result).toEqual(job);
  });

  it('marks a stale running job as failed', async () => {
    const staleDate = new Date(Date.now() - 10 * 60 * 1000); // 10 minutes ago
    const job = { id: 'job-1', status: 'running', updatedAt: staleDate };
    vi.mocked(prisma.pluginBackfillJob.findFirst).mockResolvedValue(job as any);
    const updated = { ...job, status: 'failed' };
    vi.mocked(prisma.pluginBackfillJob.update).mockResolvedValue(updated as any);

    const result = await getLatestBackfillJob('plugin-456');

    expect(prisma.pluginBackfillJob.update).toHaveBeenCalledWith({
      where: { id: 'job-1' },
      data: {
        status: 'failed',
        errorMessage: 'Job appears stalled, possibly due to a server restart. Click Backfill again to retry.',
        completedAt: expect.any(Date),
      },
    });
    expect(result).toEqual(updated);
  });

  it('returns a completed job unchanged regardless of updatedAt age', async () => {
    const staleDate = new Date(Date.now() - 10 * 60 * 1000);
    const job = { id: 'job-1', status: 'completed', updatedAt: staleDate };
    vi.mocked(prisma.pluginBackfillJob.findFirst).mockResolvedValue(job as any);

    const result = await getLatestBackfillJob('plugin-456');

    expect(prisma.pluginBackfillJob.update).not.toHaveBeenCalled();
    expect(result).toEqual(job);
  });
});
