import { describe, it, expect, vi, beforeEach } from 'vitest';
import { countEligibleResponses, fetchEligibleResponseBatch, startBackfill } from '../backfill.js';
import { prisma } from '../../../lib/prisma.js';

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

      const sqlCall = vi.mocked(prisma.$queryRaw).mock.calls[0][0] as {
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

      const sqlCall = vi.mocked(prisma.$queryRaw).mock.calls[0][0] as {
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

      const sqlCall = vi.mocked(prisma.$queryRaw).mock.calls[0][0] as {
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
