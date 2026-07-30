import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createAiUsageRepository } from '../aiUsageRepository.js';

const prismaMock = vi.hoisted(() => ({
  aIUsage: {
    findFirst: vi.fn().mockResolvedValue(null),
    upsert: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue({}),
    aggregate: vi.fn().mockResolvedValue({ _sum: { tokensUsed: 0 } }),
    updateMany: vi.fn().mockResolvedValue({ count: 0 }),
  },
}));

vi.mock('../baseRepository.js', () => ({
  resolvePrisma: () => prismaMock,
}));

describe('aiUsageRepository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.aIUsage.findFirst.mockResolvedValue(null);
    prismaMock.aIUsage.upsert.mockResolvedValue({});
    prismaMock.aIUsage.delete.mockResolvedValue({});
    prismaMock.aIUsage.aggregate.mockResolvedValue({ _sum: { tokensUsed: 0 } });
    prismaMock.aIUsage.updateMany.mockResolvedValue({ count: 0 });
  });

  it('should proxy basic prisma delegate methods', async () => {
    const repo = createAiUsageRepository();
    const findArgs = { where: { organizationId: 'org-1' } };
    const upsertArgs = {
      where: { organizationId_periodStart: { organizationId: 'org-1', periodStart: new Date() } },
      update: {},
      create: { organizationId: 'org-1', periodStart: new Date(), periodEnd: new Date() },
    };
    const deleteArgs = { where: { id: 'usage-1' } };
    const aggregateArgs = { where: { organizationId: 'org-1' }, _sum: { tokensUsed: true } };
    const updateManyArgs = { where: { organizationId: 'org-1' }, data: { tokensUsed: 0 } };

    await repo.findFirst(findArgs as any);
    await repo.upsert(upsertArgs as any);
    await repo.delete(deleteArgs as any);
    await repo.aggregate(aggregateArgs as any);
    await repo.updateMany(updateManyArgs as any);

    expect(prismaMock.aIUsage.findFirst).toHaveBeenCalledWith(findArgs);
    expect(prismaMock.aIUsage.upsert).toHaveBeenCalledWith(upsertArgs);
    expect(prismaMock.aIUsage.delete).toHaveBeenCalledWith(deleteArgs);
    expect(prismaMock.aIUsage.aggregate).toHaveBeenCalledWith(aggregateArgs);
    expect(prismaMock.aIUsage.updateMany).toHaveBeenCalledWith(updateManyArgs);
  });

  it('should find usage for an organization and period', async () => {
    const repo = createAiUsageRepository();
    const periodStart = new Date('2026-07-01');
    prismaMock.aIUsage.findFirst.mockResolvedValueOnce({ id: 'usage-1', tokensUsed: 10 } as any);

    const result = await repo.findByOrganizationAndPeriod('org-1', periodStart);

    expect(prismaMock.aIUsage.findFirst).toHaveBeenCalledWith({
      where: { organizationId: 'org-1', periodStart },
    });
    expect(result).toEqual({ id: 'usage-1', tokensUsed: 10 });
  });

  it('should upsert period usage with increments', async () => {
    const repo = createAiUsageRepository();
    const periodStart = new Date('2026-07-01');
    const periodEnd = new Date('2026-07-31');

    await repo.upsertPeriodUsage('org-1', periodStart, periodEnd, 100, 50);

    expect(prismaMock.aIUsage.upsert).toHaveBeenCalledWith({
      where: { organizationId_periodStart: { organizationId: 'org-1', periodStart } },
      update: {
        tokensUsed: { increment: 100 },
        creditsUsedMilli: { increment: 50 },
      },
      create: {
        organizationId: 'org-1',
        periodStart,
        periodEnd,
        tokensUsed: 100,
        creditsUsedMilli: 50,
      },
    });
  });

  it('should migrate legacy period usage and delete the legacy row', async () => {
    const repo = createAiUsageRepository();
    const fromPeriodStart = new Date('2026-06-01');
    const toPeriodStart = new Date('2026-06-15');
    const toPeriodEnd = new Date('2026-07-14');

    await repo.migratePeriodUsage(
      'org-1',
      fromPeriodStart,
      toPeriodStart,
      toPeriodEnd,
      'legacy-usage-1',
      20,
      10
    );

    expect(prismaMock.aIUsage.upsert).toHaveBeenCalledWith({
      where: { organizationId_periodStart: { organizationId: 'org-1', periodStart: toPeriodStart } },
      update: {
        tokensUsed: { increment: 20 },
        creditsUsedMilli: { increment: 10 },
      },
      create: {
        organizationId: 'org-1',
        periodStart: toPeriodStart,
        periodEnd: toPeriodEnd,
        tokensUsed: 20,
        creditsUsedMilli: 10,
      },
    });
    expect(prismaMock.aIUsage.delete).toHaveBeenCalledWith({ where: { id: 'legacy-usage-1' } });
  });

  it('should sum tokensUsed across all periods for an organization', async () => {
    const repo = createAiUsageRepository();
    prismaMock.aIUsage.aggregate.mockResolvedValueOnce({ _sum: { tokensUsed: 250 } } as any);

    const result = await repo.sumTokensUsedByOrganization('org-1');

    expect(prismaMock.aIUsage.aggregate).toHaveBeenCalledWith({
      where: { organizationId: 'org-1' },
      _sum: { tokensUsed: true },
    });
    expect(result).toEqual({ _sum: { tokensUsed: 250 } });
  });

  it('should reset usage for an organization', async () => {
    const repo = createAiUsageRepository();

    await repo.resetUsageByOrganization('org-1');

    expect(prismaMock.aIUsage.updateMany).toHaveBeenCalledWith({
      where: { organizationId: 'org-1' },
      data: { tokensUsed: 0, creditsUsedMilli: 0 },
    });
  });
});
