import { describe, it, expect, vi, beforeEach } from 'vitest';
import { countEligibleResponses, fetchEligibleResponseBatch } from '../backfill.js';
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
    });

    it('returns 0 when the query returns no rows', async () => {
      vi.mocked(prisma.$queryRaw).mockResolvedValue([]);

      const result = await countEligibleResponses('form-123', 'plugin-456');

      expect(result).toBe(0);
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
    });
  });
});
