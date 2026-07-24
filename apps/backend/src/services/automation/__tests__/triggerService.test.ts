import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as Sentry from '@sentry/node';
import { generateId } from '@dculus/utils';
import { initializeAutomationTriggers, cancelRunsForAutomation } from '../triggerService.js';
import { enqueueFirstStep } from '../engine.js';
import { getBoss, AUTOMATION_QUEUE } from '../boss.js';
import { getEventEmitter } from '../../../plugins/core/events.js';
import { prisma } from '../../../lib/prisma.js';
import { logger } from '../../../lib/logger.js';
import type { PluginEvent } from '../../../plugins/core/types.js';

vi.mock('../../../lib/prisma.js', () => ({
  prisma: {
    automation: {
      findMany: vi.fn(),
    },
    automationRun: {
      create: vi.fn(),
      findMany: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}));

vi.mock('../../../lib/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('@sentry/node', () => ({
  captureException: vi.fn(),
}));

vi.mock('@dculus/utils', () => ({
  generateId: vi.fn(),
}));

vi.mock('../engine.js', () => ({
  enqueueFirstStep: vi.fn(),
}));

vi.mock('../boss.js', () => ({
  AUTOMATION_QUEUE: 'automation-step',
  getBoss: vi.fn(),
}));

function makeEvent(overrides: Partial<PluginEvent> = {}): PluginEvent {
  return {
    type: 'form.submitted',
    formId: 'form-1',
    organizationId: 'org-1',
    data: { responseId: 'resp-1', email: 'a@b.com' },
    timestamp: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

function makeAutomation(overrides: Record<string, any> = {}) {
  return {
    id: 'automation-1',
    formId: 'form-1',
    organizationId: 'org-1',
    status: 'ACTIVE',
    triggerType: 'form.submitted',
    graph: { nodes: [], edges: [] },
    version: 3,
    ...overrides,
  };
}

async function emitAndFlush(event: PluginEvent) {
  getEventEmitter().emit('plugin:event', event);
  // Let the async listener's microtasks/promise chain settle.
  await vi.waitFor(() => {});
  await new Promise((resolve) => setImmediate(resolve));
}

describe('triggerService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getEventEmitter().removeAllListeners('plugin:event');
    vi.mocked(generateId).mockReturnValue('generated-run-id');
    vi.mocked(prisma.automationRun.create).mockResolvedValue({ id: 'generated-run-id' } as any);
  });

  afterEach(() => {
    getEventEmitter().removeAllListeners('plugin:event');
  });

  describe('initializeAutomationTriggers', () => {
    it('registers a listener without touching existing plugin:event listeners', () => {
      const existingListener = vi.fn();
      getEventEmitter().on('plugin:event', existingListener);

      initializeAutomationTriggers();

      expect(getEventEmitter().listeners('plugin:event')).toContain(existingListener);
      expect(getEventEmitter().listenerCount('plugin:event')).toBe(2);
    });

    it('creates one AutomationRun and enqueues the first step for a single matching automation', async () => {
      initializeAutomationTriggers();
      const automation = makeAutomation();
      vi.mocked(prisma.automation.findMany).mockResolvedValue([automation] as any);

      await emitAndFlush(makeEvent());

      expect(prisma.automation.findMany).toHaveBeenCalledWith({
        where: { formId: 'form-1', status: 'ACTIVE', triggerType: 'form.submitted' },
      });

      expect(prisma.automationRun.create).toHaveBeenCalledWith({
        data: {
          id: 'generated-run-id',
          automationId: 'automation-1',
          responseId: 'resp-1',
          automationVersion: 3,
          graphSnapshot: automation.graph,
          status: 'RUNNING',
          context: {
            triggerData: { responseId: 'resp-1', email: 'a@b.com' },
            formId: 'form-1',
            organizationId: 'org-1',
          },
        },
      });

      expect(enqueueFirstStep).toHaveBeenCalledWith({ id: 'generated-run-id' });
    });

    it('creates N runs for N matching automations', async () => {
      initializeAutomationTriggers();
      vi.mocked(prisma.automation.findMany).mockResolvedValue([
        makeAutomation({ id: 'automation-1' }),
        makeAutomation({ id: 'automation-2' }),
        makeAutomation({ id: 'automation-3' }),
      ] as any);

      await emitAndFlush(makeEvent());

      expect(prisma.automationRun.create).toHaveBeenCalledTimes(3);
      expect(enqueueFirstStep).toHaveBeenCalledTimes(3);
    });

    it('does nothing when there are 0 matching automations', async () => {
      initializeAutomationTriggers();
      vi.mocked(prisma.automation.findMany).mockResolvedValue([]);

      await emitAndFlush(makeEvent());

      expect(prisma.automationRun.create).not.toHaveBeenCalled();
      expect(enqueueFirstStep).not.toHaveBeenCalled();
    });

    it('only queries ACTIVE automations with triggerType form.submitted (inactive/draft excluded by the query)', async () => {
      initializeAutomationTriggers();
      vi.mocked(prisma.automation.findMany).mockResolvedValue([]);

      await emitAndFlush(makeEvent());

      expect(prisma.automation.findMany).toHaveBeenCalledWith({
        where: { formId: 'form-1', status: 'ACTIVE', triggerType: 'form.submitted' },
      });
    });

    it('ignores non form.submitted events', async () => {
      initializeAutomationTriggers();

      await emitAndFlush(makeEvent({ type: 'plugin.test' }));

      expect(prisma.automation.findMany).not.toHaveBeenCalled();
    });

    it('ignores preview submissions', async () => {
      initializeAutomationTriggers();

      await emitAndFlush(makeEvent({ data: { responseId: 'resp-1', isPreview: true } }));

      expect(prisma.automation.findMany).not.toHaveBeenCalled();
    });

    it('never throws or propagates when the automation lookup fails', async () => {
      initializeAutomationTriggers();
      vi.mocked(prisma.automation.findMany).mockRejectedValue(new Error('db down'));

      expect(() => getEventEmitter().emit('plugin:event', makeEvent())).not.toThrow();
      await emitAndFlush(makeEvent());

      expect(logger.error).toHaveBeenCalled();
      expect(Sentry.captureException).toHaveBeenCalled();
    });

    it('logs and reports to Sentry but still processes other automations when one run fails to create', async () => {
      initializeAutomationTriggers();
      vi.mocked(prisma.automation.findMany).mockResolvedValue([
        makeAutomation({ id: 'automation-1' }),
        makeAutomation({ id: 'automation-2' }),
      ] as any);
      vi.mocked(prisma.automationRun.create)
        .mockRejectedValueOnce(new Error('create failed'))
        .mockResolvedValueOnce({ id: 'generated-run-id' } as any);

      await emitAndFlush(makeEvent());

      expect(prisma.automationRun.create).toHaveBeenCalledTimes(2);
      expect(enqueueFirstStep).toHaveBeenCalledTimes(1);
      expect(logger.error).toHaveBeenCalled();
      expect(Sentry.captureException).toHaveBeenCalled();
    });

    it('falls back to null responseId when the event data has none', async () => {
      initializeAutomationTriggers();
      vi.mocked(prisma.automation.findMany).mockResolvedValue([makeAutomation()] as any);

      await emitAndFlush(makeEvent({ data: { email: 'a@b.com' } }));

      expect(prisma.automationRun.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ responseId: null }) })
      );
    });
  });

  describe('cancelRunsForAutomation', () => {
    it('does nothing when there are no RUNNING/WAITING runs', async () => {
      vi.mocked(prisma.automationRun.findMany).mockResolvedValue([]);

      await cancelRunsForAutomation('automation-1', 'automation deleted');

      expect(prisma.automationRun.updateMany).not.toHaveBeenCalled();
    });

    it('cancels outstanding pg-boss jobs and marks matching runs CANCELLED', async () => {
      vi.mocked(prisma.automationRun.findMany).mockResolvedValue([
        { id: 'run-1' },
        { id: 'run-2' },
      ] as any);

      const findJobs = vi
        .fn()
        .mockResolvedValueOnce([{ id: 'job-1' }])
        .mockResolvedValueOnce([]);
      const cancel = vi.fn().mockResolvedValue(undefined);
      vi.mocked(getBoss).mockReturnValue({ findJobs, cancel } as any);

      await cancelRunsForAutomation('automation-1', 'automation deleted');

      expect(findJobs).toHaveBeenCalledWith(AUTOMATION_QUEUE, { data: { runId: 'run-1' }, queued: true });
      expect(findJobs).toHaveBeenCalledWith(AUTOMATION_QUEUE, { data: { runId: 'run-2' }, queued: true });
      expect(cancel).toHaveBeenCalledWith(AUTOMATION_QUEUE, ['job-1']);
      expect(cancel).toHaveBeenCalledTimes(1);

      expect(prisma.automationRun.updateMany).toHaveBeenCalledWith({
        where: { automationId: 'automation-1', status: { in: ['RUNNING', 'WAITING'] } },
        data: { status: 'CANCELLED', completedAt: expect.any(Date) },
      });
    });

    it('still marks runs CANCELLED when pg-boss is disabled (getBoss returns null)', async () => {
      vi.mocked(prisma.automationRun.findMany).mockResolvedValue([{ id: 'run-1' }] as any);
      vi.mocked(getBoss).mockReturnValue(null);

      await cancelRunsForAutomation('automation-1', 'automation paused');

      expect(prisma.automationRun.updateMany).toHaveBeenCalledWith({
        where: { automationId: 'automation-1', status: { in: ['RUNNING', 'WAITING'] } },
        data: { status: 'CANCELLED', completedAt: expect.any(Date) },
      });
    });

    it('never throws when the run lookup fails', async () => {
      vi.mocked(prisma.automationRun.findMany).mockRejectedValue(new Error('db down'));

      await expect(cancelRunsForAutomation('automation-1', 'reason')).resolves.toBeUndefined();
      expect(logger.error).toHaveBeenCalled();
      expect(Sentry.captureException).toHaveBeenCalled();
    });

    it('continues cancelling remaining runs and still updates DB state when one pg-boss cancel call fails', async () => {
      vi.mocked(prisma.automationRun.findMany).mockResolvedValue([
        { id: 'run-1' },
        { id: 'run-2' },
      ] as any);

      const findJobs = vi.fn().mockResolvedValue([{ id: 'job-1' }]);
      const cancel = vi.fn().mockRejectedValueOnce(new Error('cancel failed')).mockResolvedValueOnce(undefined);
      vi.mocked(getBoss).mockReturnValue({ findJobs, cancel } as any);

      await cancelRunsForAutomation('automation-1', 'reason');

      expect(cancel).toHaveBeenCalledTimes(2);
      expect(prisma.automationRun.updateMany).toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalled();
      expect(Sentry.captureException).toHaveBeenCalled();
    });
  });
});
