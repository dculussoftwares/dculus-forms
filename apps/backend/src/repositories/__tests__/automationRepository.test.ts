import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createAutomationRepository } from '../automationRepository.js';

const prismaMock = vi.hoisted(() => ({
  automation: {
    findMany: vi.fn().mockResolvedValue([]),
    findUnique: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockResolvedValue({}),
    update: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue({}),
    count: vi.fn().mockResolvedValue(0),
    updateMany: vi.fn().mockResolvedValue({ count: 0 }),
  },
  automationRun: {
    findMany: vi.fn().mockResolvedValue([]),
    findUnique: vi.fn().mockResolvedValue(null),
    findFirst: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockResolvedValue({}),
    update: vi.fn().mockResolvedValue({}),
    updateMany: vi.fn().mockResolvedValue({ count: 0 }),
  },
  automationStepRun: {
    findMany: vi.fn().mockResolvedValue([]),
    findFirst: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockResolvedValue({}),
    count: vi.fn().mockResolvedValue(0),
  },
  $executeRaw: vi.fn().mockResolvedValue(1),
}));

vi.mock('../baseRepository.js', () => ({
  resolvePrisma: () => prismaMock,
}));

vi.mock('#prisma-client', () => ({
  Prisma: {
    sql: (strings: TemplateStringsArray, ...values: any[]) => ({ strings, values }),
    raw: (value: string) => ({ raw: value }),
  },
}));

describe('automationRepository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.automation.findMany.mockResolvedValue([]);
    prismaMock.automation.findUnique.mockResolvedValue(null);
    prismaMock.automation.create.mockResolvedValue({});
    prismaMock.automation.update.mockResolvedValue({});
    prismaMock.automation.delete.mockResolvedValue({});
    prismaMock.automation.count.mockResolvedValue(0);
    prismaMock.automationRun.findMany.mockResolvedValue([]);
    prismaMock.automationRun.findUnique.mockResolvedValue(null);
    prismaMock.automationRun.findFirst.mockResolvedValue(null);
    prismaMock.automationRun.create.mockResolvedValue({});
    prismaMock.automationRun.update.mockResolvedValue({});
    prismaMock.automationRun.updateMany.mockResolvedValue({ count: 0 });
    prismaMock.automationStepRun.findMany.mockResolvedValue([]);
    prismaMock.automationStepRun.findFirst.mockResolvedValue(null);
    prismaMock.automationStepRun.create.mockResolvedValue({});
    prismaMock.$executeRaw.mockResolvedValue(1);
  });

  it('proxies basic prisma delegate methods for Automation', async () => {
    const repo = createAutomationRepository();
    const args = { where: { id: 'automation-1' } };
    await repo.findMany(args);
    await repo.findUnique(args as any);
    await repo.create({ data: { id: 'automation-1' } } as any);
    await repo.update({ where: { id: 'automation-1' }, data: { name: 'New' } } as any);
    await repo.delete({ where: { id: 'automation-1' } } as any);
    await repo.count(args as any);

    expect(prismaMock.automation.findMany).toHaveBeenCalledWith(args);
    expect(prismaMock.automation.findUnique).toHaveBeenCalledWith(args);
    expect(prismaMock.automation.create).toHaveBeenCalled();
    expect(prismaMock.automation.update).toHaveBeenCalled();
    expect(prismaMock.automation.delete).toHaveBeenCalled();
    expect(prismaMock.automation.count).toHaveBeenCalledWith(args);
  });

  describe('Automation domain helpers', () => {
    it('findById looks up by id only', async () => {
      const repo = createAutomationRepository();
      await repo.findById('automation-1');
      expect(prismaMock.automation.findUnique).toHaveBeenCalledWith({ where: { id: 'automation-1' } });
    });

    it('listByFormId orders by createdAt desc', async () => {
      const repo = createAutomationRepository();
      await repo.listByFormId('form-1');
      expect(prismaMock.automation.findMany).toHaveBeenCalledWith({
        where: { formId: 'form-1' },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('listActiveByFormAndTrigger scopes to ACTIVE + triggerType', async () => {
      const repo = createAutomationRepository();
      await repo.listActiveByFormAndTrigger('form-1', 'form.submitted');
      expect(prismaMock.automation.findMany).toHaveBeenCalledWith({
        where: { formId: 'form-1', status: 'ACTIVE', triggerType: 'form.submitted' },
      });
    });

    it('createAutomation / updateAutomation / deleteAutomation delegate correctly', async () => {
      const repo = createAutomationRepository();
      await repo.createAutomation({ id: 'automation-1' } as any);
      await repo.updateAutomation('automation-1', { name: 'Renamed' } as any);
      await repo.deleteAutomation('automation-1');

      expect(prismaMock.automation.create).toHaveBeenCalledWith({ data: { id: 'automation-1' } });
      expect(prismaMock.automation.update).toHaveBeenCalledWith({
        where: { id: 'automation-1' },
        data: { name: 'Renamed' },
      });
      expect(prismaMock.automation.delete).toHaveBeenCalledWith({ where: { id: 'automation-1' } });
    });
  });

  describe('AutomationRun domain helpers', () => {
    it('findRunById looks up by id only', async () => {
      const repo = createAutomationRepository();
      await repo.findRunById('run-1');
      expect(prismaMock.automationRun.findUnique).toHaveBeenCalledWith({ where: { id: 'run-1' } });
    });

    it('findRunByIdWithAutomation includes the automation relation', async () => {
      const repo = createAutomationRepository();
      await repo.findRunByIdWithAutomation('run-1');
      expect(prismaMock.automationRun.findUnique).toHaveBeenCalledWith({
        where: { id: 'run-1' },
        include: { automation: true },
      });
    });

    it('listRunsByAutomation defaults limit/offset and orders by startedAt desc', async () => {
      const repo = createAutomationRepository();
      await repo.listRunsByAutomation('automation-1');
      expect(prismaMock.automationRun.findMany).toHaveBeenCalledWith({
        where: { automationId: 'automation-1' },
        orderBy: { startedAt: 'desc' },
        take: 50,
        skip: 0,
      });

      await repo.listRunsByAutomation('automation-1', { limit: 10, offset: 5 });
      expect(prismaMock.automationRun.findMany).toHaveBeenCalledWith({
        where: { automationId: 'automation-1' },
        orderBy: { startedAt: 'desc' },
        take: 10,
        skip: 5,
      });
    });

    it('listActiveRunsByAutomation scopes to RUNNING/WAITING and selects only id', async () => {
      const repo = createAutomationRepository();
      await repo.listActiveRunsByAutomation('automation-1');
      expect(prismaMock.automationRun.findMany).toHaveBeenCalledWith({
        where: { automationId: 'automation-1', status: { in: ['RUNNING', 'WAITING'] } },
        select: { id: true },
      });
    });

    it('createRun / updateRun delegate correctly', async () => {
      const repo = createAutomationRepository();
      await repo.createRun({ id: 'run-1' } as any);
      await repo.updateRun('run-1', { status: 'COMPLETED' } as any);

      expect(prismaMock.automationRun.create).toHaveBeenCalledWith({ data: { id: 'run-1' } });
      expect(prismaMock.automationRun.update).toHaveBeenCalledWith({
        where: { id: 'run-1' },
        data: { status: 'COMPLETED' },
      });
    });

    it('cancelRunsByIds marks the given ids CANCELLED unconditionally', async () => {
      const repo = createAutomationRepository();
      await repo.cancelRunsByIds(['run-1', 'run-2']);
      expect(prismaMock.automationRun.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['run-1', 'run-2'] } },
        data: { status: 'CANCELLED', completedAt: expect.any(Date) },
      });
    });

    it('cancelRunIfActive scopes the update to RUNNING/WAITING only', async () => {
      const repo = createAutomationRepository();
      await repo.cancelRunIfActive('run-1');
      expect(prismaMock.automationRun.updateMany).toHaveBeenCalledWith({
        where: { id: 'run-1', status: { in: ['RUNNING', 'WAITING'] } },
        data: { status: 'CANCELLED', completedAt: expect.any(Date) },
      });
    });

    it('advanceDigestWatermark only moves the watermark forward, never backwards', async () => {
      const repo = createAutomationRepository();
      const until = new Date('2026-03-01T00:00:00.000Z');
      await repo.advanceDigestWatermark('automation-1', until);
      expect(prismaMock.automation.updateMany).toHaveBeenCalledWith({
        where: {
          id: 'automation-1',
          OR: [{ lastDigestedAt: null }, { lastDigestedAt: { lt: until } }],
        },
        data: { lastDigestedAt: until },
      });
    });
  });

  describe('AutomationStepRun domain helpers', () => {
    it('listStepRunsByRun orders by startedAt asc', async () => {
      const repo = createAutomationRepository();
      await repo.listStepRunsByRun('run-1');
      expect(prismaMock.automationStepRun.findMany).toHaveBeenCalledWith({
        where: { runId: 'run-1' },
        orderBy: { startedAt: 'asc' },
      });
    });

    it('createStepRun delegates correctly', async () => {
      const repo = createAutomationRepository();
      await repo.createStepRun({ id: 'step-1' } as any);
      expect(prismaMock.automationStepRun.create).toHaveBeenCalledWith({ data: { id: 'step-1' } });
    });

    // PARTIAL/SKIPPED count as executed: the handler already ran, so a redelivered job must
    // reconcile rather than re-send. FAILED is excluded — that is what retries are for.
    it('findExecutedStepRun matches every non-retryable outcome, not just SUCCESS', async () => {
      const repo = createAutomationRepository();
      await repo.findExecutedStepRun('run-1', 'node-1');
      expect(prismaMock.automationStepRun.findFirst).toHaveBeenCalledWith({
        where: { runId: 'run-1', nodeId: 'node-1', status: { in: ['SUCCESS', 'PARTIAL', 'SKIPPED'] } },
      });
    });

    it('listUnsuccessfulStepRuns returns the status and nodeType of every non-SUCCESS step', async () => {
      const repo = createAutomationRepository();
      await repo.listUnsuccessfulStepRuns('run-1');
      expect(prismaMock.automationStepRun.findMany).toHaveBeenCalledWith({
        where: { runId: 'run-1', status: { not: 'SUCCESS' } },
        select: { status: true, nodeType: true },
      });
    });

    it('findStepRunByNode has no status filter', async () => {
      const repo = createAutomationRepository();
      await repo.findStepRunByNode('run-1', 'node-1');
      expect(prismaMock.automationStepRun.findFirst).toHaveBeenCalledWith({
        where: { runId: 'run-1', nodeId: 'node-1' },
      });
    });
  });

  describe('node config raw writes', () => {
    it('setNodeConfigInGraph issues a single $executeRaw scoped to the automation id', async () => {
      const repo = createAutomationRepository();
      await repo.setNodeConfigInGraph('automation-1', 'node-1', { type: 'webhook' });

      expect(prismaMock.$executeRaw).toHaveBeenCalledTimes(1);
      const sqlArg = prismaMock.$executeRaw.mock.calls[0][0] as { strings: TemplateStringsArray; values: any[] };
      expect(sqlArg.strings.join('')).toContain('UPDATE');
      expect(sqlArg.strings.join('')).toContain('jsonb_set');
      expect(sqlArg.values).toContain('node-1');
      expect(sqlArg.values).toContain('automation-1');
      expect(sqlArg.values).toContain(JSON.stringify({ type: 'webhook' }));
    });

    it('setNodeConfigInRunSnapshot issues a single $executeRaw scoped to the run id', async () => {
      const repo = createAutomationRepository();
      await repo.setNodeConfigInRunSnapshot('run-1', 'node-1', { type: 'webhook' });

      expect(prismaMock.$executeRaw).toHaveBeenCalledTimes(1);
      const sqlArg = prismaMock.$executeRaw.mock.calls[0][0] as { strings: TemplateStringsArray; values: any[] };
      expect(sqlArg.values).toContain('node-1');
      expect(sqlArg.values).toContain('run-1');
      expect(sqlArg.values).toContain(JSON.stringify({ type: 'webhook' }));
    });
  });
});
