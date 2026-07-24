import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as Sentry from '@sentry/node';
import { generateId, substituteMentions } from '@dculus/utils';
import {
  executeAutomationStep,
  enqueueFirstStep,
  registerAutomationWorker,
  ACTION_RETRY_LIMIT,
} from '../engine.js';
import { prisma } from '../../../lib/prisma.js';
import { getPluginHandler } from '../../../plugins/core/registry.js';
import { createPluginContext } from '../../../plugins/core/context.js';
import { evaluateCondition } from '../conditionEvaluator.js';
import { getBoss, AUTOMATION_QUEUE } from '../boss.js';
import type { AutomationGraph } from '../types.js';

vi.mock('../../../lib/prisma.js', () => ({
  prisma: {
    automationStepRun: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    automationRun: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    // Array-form $transaction: operations are already-invoked PrismaPromises by the time
    // $transaction receives them, so resolving them as-is mirrors the real API.
    $transaction: vi.fn((ops: unknown[]) => Promise.all(ops)),
  },
}));

vi.mock('../../../lib/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('../../../plugins/core/registry.js', () => ({
  getPluginHandler: vi.fn(),
}));

vi.mock('../../../plugins/core/context.js', () => ({
  createPluginContext: vi.fn(() => ({
    prisma: {},
    logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
  })),
}));

vi.mock('../conditionEvaluator.js', () => ({
  evaluateCondition: vi.fn(),
}));

vi.mock('../boss.js', () => ({
  AUTOMATION_QUEUE: 'automation-step',
  getBoss: vi.fn(),
}));

vi.mock('@sentry/node', () => ({
  captureException: vi.fn(),
}));

vi.mock('@dculus/utils', () => ({
  generateId: vi.fn(),
  substituteMentions: vi.fn((value: string) => value),
}));

type MockBoss = { send: ReturnType<typeof vi.fn> };

function makeRun(overrides: Record<string, any> = {}) {
  return {
    id: 'run-1',
    status: 'RUNNING',
    context: {},
    startedAt: new Date('2026-01-01T00:00:00.000Z'),
    automation: {
      status: 'ACTIVE',
      formId: 'form-1',
      organizationId: 'org-1',
      triggerType: 'form.submitted',
    },
    ...overrides,
  };
}

function makeJob(data: { runId: string; nodeId: string }, retryCount = 0, retryLimit = 0) {
  return { data, retryCount, retryLimit } as any;
}

describe('automation engine', () => {
  let mockBoss: MockBoss;

  beforeEach(() => {
    vi.clearAllMocks();
    mockBoss = { send: vi.fn().mockResolvedValue('job-id') };
    vi.mocked(getBoss).mockReturnValue(mockBoss as any);
    vi.mocked(generateId).mockReturnValue('generated-id');
    vi.mocked(substituteMentions).mockImplementation((value: string) => value);
    vi.mocked(createPluginContext).mockReturnValue({
      prisma: {} as any,
      logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
    } as any);
  });

  describe('redelivery reconciliation (existing SUCCESS step found)', () => {
    it('re-enqueues a delay node successor that a crash left un-enqueued', async () => {
      const graph: AutomationGraph = {
        nodes: [
          { id: 'delay-1', type: 'delay', data: { amount: 1, unit: 'hours' } },
          { id: 'action-1', type: 'action', data: { actionType: 'webhook', config: {} } },
        ],
        edges: [{ id: 'e1', source: 'delay-1', target: 'action-1' }],
      };
      const delayUntil = new Date('2026-01-01T02:00:00.000Z');

      vi.mocked(prisma.automationStepRun.findFirst).mockImplementation((({ where }: any) => {
        if (where.status === 'SUCCESS') {
          // The step already succeeded and recorded its decision...
          return { output: { delayUntil: delayUntil.toISOString(), capped: false } } as any;
        }
        // ...but the crash happened before the successor was ever enqueued or run.
        return null;
      }) as any);
      vi.mocked(prisma.automationRun.findUnique).mockResolvedValue(
        makeRun({ status: 'WAITING', graphSnapshot: graph }) as any
      );

      await executeAutomationStep(makeJob({ runId: 'run-1', nodeId: 'delay-1' }));

      expect(prisma.automationStepRun.create).not.toHaveBeenCalled();
      expect(mockBoss.send).toHaveBeenCalledWith(
        AUTOMATION_QUEUE,
        { runId: 'run-1', nodeId: 'action-1' },
        expect.objectContaining({ singletonKey: 'run-1:action-1', startAfter: delayUntil })
      );
    });

    it('re-enqueues a condition node successor using the persisted branch decision, without re-evaluating the condition', async () => {
      const graph: AutomationGraph = {
        nodes: [
          { id: 'cond-1', type: 'condition', data: { rules: [], combinator: 'AND' } },
          { id: 'true-1', type: 'end' },
          { id: 'false-1', type: 'end' },
        ],
        edges: [
          { id: 'e1', source: 'cond-1', target: 'true-1', sourceHandle: 'true' },
          { id: 'e2', source: 'cond-1', target: 'false-1', sourceHandle: 'false' },
        ],
      };

      vi.mocked(prisma.automationStepRun.findFirst).mockImplementation((({ where }: any) => {
        if (where.status === 'SUCCESS') {
          return { output: { result: true, branch: 'true' } } as any;
        }
        return null;
      }) as any);
      vi.mocked(prisma.automationRun.findUnique).mockResolvedValue(
        makeRun({ status: 'RUNNING', graphSnapshot: graph }) as any
      );

      await executeAutomationStep(makeJob({ runId: 'run-1', nodeId: 'cond-1' }));

      expect(evaluateCondition).not.toHaveBeenCalled();
      expect(mockBoss.send).toHaveBeenCalledWith(
        AUTOMATION_QUEUE,
        { runId: 'run-1', nodeId: 'true-1' },
        expect.objectContaining({ singletonKey: 'run-1:true-1' })
      );
    });

    it('completes the run when the succeeded node had no successor and the run was never marked COMPLETED', async () => {
      const graph: AutomationGraph = {
        nodes: [{ id: 'delay-1', type: 'delay', data: { amount: 1, unit: 'minutes' } }],
        edges: [],
      };

      vi.mocked(prisma.automationStepRun.findFirst).mockResolvedValue({
        output: { delayUntil: new Date().toISOString(), capped: false },
      } as any);
      vi.mocked(prisma.automationRun.findUnique).mockResolvedValue(
        makeRun({ status: 'WAITING', graphSnapshot: graph }) as any
      );

      await executeAutomationStep(makeJob({ runId: 'run-1', nodeId: 'delay-1' }));

      expect(prisma.automationRun.update).toHaveBeenCalledWith({
        where: { id: 'run-1' },
        data: { status: 'COMPLETED', completedAt: expect.any(Date) },
      });
      expect(mockBoss.send).not.toHaveBeenCalled();
    });

    it('replays the stepOutputs merge for an action node when it was lost before the successor was enqueued', async () => {
      const graph: AutomationGraph = {
        nodes: [
          { id: 'action-1', type: 'action', data: { actionType: 'webhook', config: {} } },
          { id: 'end-1', type: 'end' },
        ],
        edges: [{ id: 'e1', source: 'action-1', target: 'end-1' }],
      };

      vi.mocked(prisma.automationStepRun.findFirst).mockImplementation((({ where }: any) => {
        if (where.status === 'SUCCESS') {
          return { output: { delivered: true } } as any;
        }
        return null;
      }) as any);
      vi.mocked(prisma.automationRun.findUnique).mockResolvedValue(
        makeRun({ status: 'RUNNING', graphSnapshot: graph, context: { triggerData: {} } }) as any
      );

      await executeAutomationStep(makeJob({ runId: 'run-1', nodeId: 'action-1' }));

      expect(getPluginHandler).not.toHaveBeenCalled();
      expect(prisma.automationRun.update).toHaveBeenCalledWith({
        where: { id: 'run-1' },
        data: { context: { triggerData: {}, stepOutputs: { 'action-1': { delivered: true } } } },
      });
      expect(mockBoss.send).toHaveBeenCalledWith(
        AUTOMATION_QUEUE,
        { runId: 'run-1', nodeId: 'end-1' },
        expect.objectContaining({ singletonKey: 'run-1:end-1' })
      );
    });

    it('does nothing when the successor already has its own step run (already reconciled or genuinely done)', async () => {
      const graph: AutomationGraph = {
        nodes: [
          { id: 'delay-1', type: 'delay', data: { amount: 1, unit: 'minutes' } },
          { id: 'action-1', type: 'action', data: { actionType: 'webhook', config: {} } },
        ],
        edges: [{ id: 'e1', source: 'delay-1', target: 'action-1' }],
      };

      vi.mocked(prisma.automationStepRun.findFirst).mockImplementation((({ where }: any) => {
        if (where.status === 'SUCCESS') {
          return { output: { delayUntil: new Date().toISOString(), capped: false } } as any;
        }
        // The successor already ran (or is itself further along).
        return { id: 'already-ran' } as any;
      }) as any);
      vi.mocked(prisma.automationRun.findUnique).mockResolvedValue(
        makeRun({ status: 'WAITING', graphSnapshot: graph }) as any
      );

      await executeAutomationStep(makeJob({ runId: 'run-1', nodeId: 'delay-1' }));

      expect(mockBoss.send).not.toHaveBeenCalled();
      expect(prisma.automationRun.update).not.toHaveBeenCalled();
    });

    it('does not merge stepOutputs again for an action node whose context already recorded the output', async () => {
      const graph: AutomationGraph = {
        nodes: [{ id: 'action-1', type: 'action', data: { actionType: 'webhook', config: {} } }],
        edges: [],
      };

      vi.mocked(prisma.automationStepRun.findFirst).mockImplementation((({ where }: any) => {
        if (where.status === 'SUCCESS') {
          return { output: { delivered: true } } as any;
        }
        return null;
      }) as any);
      vi.mocked(prisma.automationRun.findUnique).mockResolvedValue(
        makeRun({
          status: 'RUNNING',
          graphSnapshot: graph,
          context: { triggerData: {}, stepOutputs: { 'action-1': { delivered: true } } },
        }) as any
      );

      await executeAutomationStep(makeJob({ runId: 'run-1', nodeId: 'action-1' }));

      // Only the completion update should fire — no redundant context merge, since stepOutputs
      // already has this node's output on record.
      expect(prisma.automationRun.update).toHaveBeenCalledTimes(1);
      expect(prisma.automationRun.update).toHaveBeenCalledWith({
        where: { id: 'run-1' },
        data: { status: 'COMPLETED', completedAt: expect.any(Date) },
      });
      expect(mockBoss.send).not.toHaveBeenCalled();
    });
  });

  describe('run lookup guards', () => {
    it('drops the job when the run no longer exists', async () => {
      vi.mocked(prisma.automationStepRun.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.automationRun.findUnique).mockResolvedValue(null);

      await executeAutomationStep(makeJob({ runId: 'run-1', nodeId: 'node-1' }));

      expect(prisma.automationRun.update).not.toHaveBeenCalled();
      expect(mockBoss.send).not.toHaveBeenCalled();
    });

    it('skips execution when the run is already in a terminal state', async () => {
      vi.mocked(prisma.automationStepRun.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.automationRun.findUnique).mockResolvedValue(
        makeRun({ status: 'COMPLETED', graphSnapshot: { nodes: [], edges: [] } }) as any
      );

      await executeAutomationStep(makeJob({ runId: 'run-1', nodeId: 'node-1' }));

      expect(prisma.automationRun.update).not.toHaveBeenCalled();
      expect(mockBoss.send).not.toHaveBeenCalled();
    });
  });

  describe('unhandleable node failures', () => {
    it('records a FAILED step run and reports to Sentry when the node is missing from the graph snapshot', async () => {
      vi.mocked(prisma.automationStepRun.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.automationRun.findUnique).mockResolvedValue(
        makeRun({ graphSnapshot: { nodes: [], edges: [] } }) as any
      );

      await executeAutomationStep(makeJob({ runId: 'run-1', nodeId: 'missing-node' }));

      expect(Sentry.captureException).toHaveBeenCalledWith(
        expect.objectContaining({ message: expect.stringContaining('missing-node') })
      );
      expect(prisma.automationStepRun.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          runId: 'run-1',
          nodeId: 'missing-node',
          nodeType: 'unknown',
          status: 'FAILED',
        }),
      });
      expect(prisma.automationRun.update).toHaveBeenCalledWith({
        where: { id: 'run-1' },
        data: { status: 'FAILED', completedAt: expect.any(Date) },
      });
    });

    it('records a FAILED step run and reports to Sentry for a node type the engine does not handle', async () => {
      const graph: AutomationGraph = {
        nodes: [{ id: 'trigger-1', type: 'trigger', data: { triggerType: 'form.submitted' } }],
        edges: [],
      };

      vi.mocked(prisma.automationStepRun.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.automationRun.findUnique).mockResolvedValue(
        makeRun({ graphSnapshot: graph }) as any
      );

      await executeAutomationStep(makeJob({ runId: 'run-1', nodeId: 'trigger-1' }));

      expect(Sentry.captureException).toHaveBeenCalledWith(
        expect.objectContaining({ message: expect.stringContaining('trigger-1') })
      );
      expect(prisma.automationStepRun.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          runId: 'run-1',
          nodeId: 'trigger-1',
          nodeType: 'trigger',
          status: 'FAILED',
        }),
      });
      expect(prisma.automationRun.update).toHaveBeenCalledWith({
        where: { id: 'run-1' },
        data: { status: 'FAILED', completedAt: expect.any(Date) },
      });
    });
  });

  describe('delay node', () => {
    it('schedules the successor with startAfter = now + delay and marks the run WAITING', async () => {
      vi.useFakeTimers();
      const now = new Date('2026-01-01T00:00:00.000Z');
      vi.setSystemTime(now);

      const graph: AutomationGraph = {
        nodes: [
          { id: 'delay-1', type: 'delay', data: { amount: 2, unit: 'hours' } },
          { id: 'action-1', type: 'action', data: { actionType: 'webhook', config: {} } },
        ],
        edges: [{ id: 'e1', source: 'delay-1', target: 'action-1' }],
      };

      vi.mocked(prisma.automationStepRun.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.automationRun.findUnique).mockResolvedValue(
        makeRun({ graphSnapshot: graph }) as any
      );

      await executeAutomationStep(makeJob({ runId: 'run-1', nodeId: 'delay-1' }));

      const delayUntil = new Date(now.getTime() + 2 * 60 * 60 * 1000);

      expect(prisma.automationStepRun.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          runId: 'run-1',
          nodeId: 'delay-1',
          nodeType: 'delay',
          status: 'SUCCESS',
          output: { delayUntil: delayUntil.toISOString(), capped: false },
        }),
      });

      expect(prisma.automationRun.update).toHaveBeenCalledWith({
        where: { id: 'run-1' },
        data: { status: 'WAITING', currentNodeId: 'action-1' },
      });

      expect(mockBoss.send).toHaveBeenCalledWith(
        AUTOMATION_QUEUE,
        { runId: 'run-1', nodeId: 'action-1' },
        expect.objectContaining({
          singletonKey: 'run-1:action-1',
          startAfter: delayUntil,
          retryLimit: ACTION_RETRY_LIMIT,
          retryBackoff: true,
        })
      );

      vi.useRealTimers();
    });

    it('caps total delay at 30 days', async () => {
      vi.useFakeTimers();
      const now = new Date('2026-01-01T00:00:00.000Z');
      vi.setSystemTime(now);

      const graph: AutomationGraph = {
        nodes: [
          { id: 'delay-1', type: 'delay', data: { amount: 999, unit: 'days' } },
          { id: 'end-1', type: 'end' },
        ],
        edges: [{ id: 'e1', source: 'delay-1', target: 'end-1' }],
      };

      vi.mocked(prisma.automationStepRun.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.automationRun.findUnique).mockResolvedValue(
        makeRun({ graphSnapshot: graph }) as any
      );

      await executeAutomationStep(makeJob({ runId: 'run-1', nodeId: 'delay-1' }));

      const cappedUntil = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

      expect(prisma.automationStepRun.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          output: { delayUntil: cappedUntil.toISOString(), capped: true },
        }),
      });

      vi.useRealTimers();
    });

    it('completes the run when the delay node has no successor', async () => {
      const graph: AutomationGraph = {
        nodes: [{ id: 'delay-1', type: 'delay', data: { amount: 1, unit: 'minutes' } }],
        edges: [],
      };

      vi.mocked(prisma.automationStepRun.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.automationRun.findUnique).mockResolvedValue(
        makeRun({ graphSnapshot: graph }) as any
      );

      await executeAutomationStep(makeJob({ runId: 'run-1', nodeId: 'delay-1' }));

      expect(prisma.automationRun.update).toHaveBeenCalledWith({
        where: { id: 'run-1' },
        data: { status: 'COMPLETED', completedAt: expect.any(Date) },
      });
      expect(mockBoss.send).not.toHaveBeenCalled();
    });
  });

  describe('action node', () => {
    it('executes the plugin handler and enqueues the next node on success', async () => {
      const graph: AutomationGraph = {
        nodes: [
          { id: 'action-1', type: 'action', data: { actionType: 'webhook', config: { url: 'https://x' } } },
          { id: 'end-1', type: 'end' },
        ],
        edges: [{ id: 'e1', source: 'action-1', target: 'end-1' }],
      };

      vi.mocked(prisma.automationStepRun.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.automationRun.findUnique).mockResolvedValue(
        makeRun({ graphSnapshot: graph, context: { triggerData: { email: 'a@b.com' } } }) as any
      );

      const handler = vi.fn().mockResolvedValue({ delivered: true });
      vi.mocked(getPluginHandler).mockReturnValue(handler);

      await executeAutomationStep(makeJob({ runId: 'run-1', nodeId: 'action-1' }, 0, ACTION_RETRY_LIMIT));

      expect(getPluginHandler).toHaveBeenCalledWith('webhook');
      expect(handler).toHaveBeenCalledWith(
        { id: 'run-1:action-1', config: { url: 'https://x' } },
        expect.objectContaining({
          type: 'form.submitted',
          formId: 'form-1',
          organizationId: 'org-1',
          data: { email: 'a@b.com' },
        }),
        expect.any(Object)
      );

      expect(prisma.automationRun.update).toHaveBeenCalledWith({
        where: { id: 'run-1' },
        data: { status: 'RUNNING', currentNodeId: 'action-1' },
      });

      expect(prisma.automationStepRun.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          nodeType: 'action:webhook',
          status: 'SUCCESS',
          output: { delivered: true },
          attempt: 1,
        }),
      });

      expect(prisma.automationRun.update).toHaveBeenCalledWith({
        where: { id: 'run-1' },
        data: { context: { triggerData: { email: 'a@b.com' }, stepOutputs: { 'action-1': { delivered: true } } } },
      });

      expect(mockBoss.send).toHaveBeenCalledWith(
        AUTOMATION_QUEUE,
        { runId: 'run-1', nodeId: 'end-1' },
        expect.objectContaining({ singletonKey: 'run-1:end-1' })
      );
    });

    it('substitutes @mentions in string config values against the trigger data before invoking the handler', async () => {
      const graph: AutomationGraph = {
        nodes: [{ id: 'action-1', type: 'action', data: { actionType: 'email', config: { subject: 'Hello {{name}}' } } }],
        edges: [],
      };

      vi.mocked(prisma.automationStepRun.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.automationRun.findUnique).mockResolvedValue(
        makeRun({ graphSnapshot: graph, context: { triggerData: { name: 'Ada' } } }) as any
      );

      const handler = vi.fn().mockResolvedValue({});
      vi.mocked(getPluginHandler).mockReturnValue(handler);
      vi.mocked(substituteMentions).mockImplementation((value: string) => value.replace('{{name}}', 'Ada'));

      await executeAutomationStep(makeJob({ runId: 'run-1', nodeId: 'action-1' }, 0, ACTION_RETRY_LIMIT));

      expect(substituteMentions).toHaveBeenCalledWith('Hello {{name}}', { name: 'Ada' });
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ config: { subject: 'Hello Ada' } }),
        expect.anything(),
        expect.anything()
      );
    });

    it('skips execution and cancels the run when the automation is no longer ACTIVE', async () => {
      const graph: AutomationGraph = {
        nodes: [{ id: 'action-1', type: 'action', data: { actionType: 'webhook', config: {} } }],
        edges: [],
      };

      vi.mocked(prisma.automationStepRun.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.automationRun.findUnique).mockResolvedValue(
        makeRun({ graphSnapshot: graph, automation: { status: 'PAUSED', formId: 'f', organizationId: 'o', triggerType: 'form.submitted' } }) as any
      );

      await executeAutomationStep(makeJob({ runId: 'run-1', nodeId: 'action-1' }));

      expect(getPluginHandler).not.toHaveBeenCalled();
      expect(prisma.automationStepRun.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ status: 'SKIPPED', errorMessage: expect.stringContaining('PAUSED') }),
      });
      expect(prisma.automationRun.update).toHaveBeenCalledWith({
        where: { id: 'run-1' },
        data: { status: 'CANCELLED', completedAt: expect.any(Date) },
      });
      expect(mockBoss.send).not.toHaveBeenCalled();
    });

    it('rethrows on failure while retries remain, recording a FAILED step but leaving the run RUNNING', async () => {
      const graph: AutomationGraph = {
        nodes: [{ id: 'action-1', type: 'action', data: { actionType: 'webhook', config: {} } }],
        edges: [],
      };

      vi.mocked(prisma.automationStepRun.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.automationRun.findUnique).mockResolvedValue(
        makeRun({ graphSnapshot: graph }) as any
      );

      const handler = vi.fn().mockRejectedValue(new Error('boom'));
      vi.mocked(getPluginHandler).mockReturnValue(handler);

      await expect(
        executeAutomationStep(makeJob({ runId: 'run-1', nodeId: 'action-1' }, 0, ACTION_RETRY_LIMIT))
      ).rejects.toThrow('boom');

      expect(Sentry.captureException).toHaveBeenCalled();
      expect(prisma.automationStepRun.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ status: 'FAILED', errorMessage: 'boom', attempt: 1 }),
      });
      expect(prisma.automationRun.update).not.toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'FAILED' }) })
      );
    });

    it('marks the run FAILED without rethrowing once retries are exhausted', async () => {
      const graph: AutomationGraph = {
        nodes: [{ id: 'action-1', type: 'action', data: { actionType: 'webhook', config: {} } }],
        edges: [],
      };

      vi.mocked(prisma.automationStepRun.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.automationRun.findUnique).mockResolvedValue(
        makeRun({ graphSnapshot: graph }) as any
      );

      const handler = vi.fn().mockRejectedValue(new Error('boom'));
      vi.mocked(getPluginHandler).mockReturnValue(handler);

      await expect(
        executeAutomationStep(makeJob({ runId: 'run-1', nodeId: 'action-1' }, ACTION_RETRY_LIMIT, ACTION_RETRY_LIMIT))
      ).resolves.toBeUndefined();

      expect(prisma.automationStepRun.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ status: 'FAILED', attempt: ACTION_RETRY_LIMIT + 1 }),
      });
      expect(prisma.automationRun.update).toHaveBeenCalledWith({
        where: { id: 'run-1' },
        data: { status: 'FAILED', completedAt: expect.any(Date) },
      });
    });

    it('fails (and is retryable) when no handler is registered for the action type', async () => {
      const graph: AutomationGraph = {
        nodes: [{ id: 'action-1', type: 'action', data: { actionType: 'unregistered-type', config: {} } }],
        edges: [],
      };

      vi.mocked(prisma.automationStepRun.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.automationRun.findUnique).mockResolvedValue(
        makeRun({ graphSnapshot: graph }) as any
      );
      vi.mocked(getPluginHandler).mockReturnValue(undefined);

      await expect(
        executeAutomationStep(makeJob({ runId: 'run-1', nodeId: 'action-1' }, 0, ACTION_RETRY_LIMIT))
      ).rejects.toThrow('No handler registered for action type: unregistered-type');
    });
  });

  describe('condition node', () => {
    const graph: AutomationGraph = {
      nodes: [
        { id: 'cond-1', type: 'condition', data: { rules: [], combinator: 'AND' } },
        { id: 'true-1', type: 'end' },
      ],
      edges: [{ id: 'e1', source: 'cond-1', target: 'true-1', sourceHandle: 'true' }],
    };

    it('follows the true edge when evaluateCondition returns true', async () => {
      vi.mocked(prisma.automationStepRun.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.automationRun.findUnique).mockResolvedValue(
        makeRun({ graphSnapshot: graph, context: { triggerData: {} } }) as any
      );
      vi.mocked(evaluateCondition).mockReturnValue(true);

      await executeAutomationStep(makeJob({ runId: 'run-1', nodeId: 'cond-1' }));

      expect(prisma.automationRun.update).toHaveBeenCalledWith({
        where: { id: 'run-1' },
        data: { currentNodeId: 'true-1' },
      });
      expect(mockBoss.send).toHaveBeenCalledWith(
        AUTOMATION_QUEUE,
        { runId: 'run-1', nodeId: 'true-1' },
        expect.objectContaining({ singletonKey: 'run-1:true-1' })
      );
    });

    it('jumps to end (completes the run) when the matching branch has no outgoing edge', async () => {
      vi.mocked(prisma.automationStepRun.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.automationRun.findUnique).mockResolvedValue(
        makeRun({ graphSnapshot: graph, context: { triggerData: {} } }) as any
      );
      vi.mocked(evaluateCondition).mockReturnValue(false);

      await executeAutomationStep(makeJob({ runId: 'run-1', nodeId: 'cond-1' }));

      expect(prisma.automationRun.update).toHaveBeenCalledWith({
        where: { id: 'run-1' },
        data: { status: 'COMPLETED', completedAt: expect.any(Date) },
      });
      expect(mockBoss.send).not.toHaveBeenCalled();
    });
  });

  describe('end node', () => {
    it('logs a SUCCESS step and marks the run COMPLETED', async () => {
      const graph: AutomationGraph = { nodes: [{ id: 'end-1', type: 'end' }], edges: [] };

      vi.mocked(prisma.automationStepRun.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.automationRun.findUnique).mockResolvedValue(
        makeRun({ graphSnapshot: graph }) as any
      );

      await executeAutomationStep(makeJob({ runId: 'run-1', nodeId: 'end-1' }));

      expect(prisma.automationStepRun.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ nodeType: 'end', status: 'SUCCESS' }),
      });
      expect(prisma.automationRun.update).toHaveBeenCalledWith({
        where: { id: 'run-1' },
        data: { status: 'COMPLETED', completedAt: expect.any(Date) },
      });
    });
  });

  describe('enqueueFirstStep', () => {
    it('enqueues the node reachable from the trigger node', async () => {
      const graph: AutomationGraph = {
        nodes: [
          { id: 'trigger-1', type: 'trigger', data: { triggerType: 'form.submitted' } },
          { id: 'action-1', type: 'action', data: { actionType: 'webhook', config: {} } },
        ],
        edges: [{ id: 'e1', source: 'trigger-1', target: 'action-1' }],
      };

      await enqueueFirstStep({ id: 'run-1', graphSnapshot: graph });

      expect(mockBoss.send).toHaveBeenCalledWith(
        AUTOMATION_QUEUE,
        { runId: 'run-1', nodeId: 'action-1' },
        expect.objectContaining({
          singletonKey: 'run-1:action-1',
          retryLimit: ACTION_RETRY_LIMIT,
          retryBackoff: true,
        })
      );
    });

    it('does nothing when there is no node reachable from the trigger', async () => {
      const graph: AutomationGraph = {
        nodes: [{ id: 'trigger-1', type: 'trigger', data: { triggerType: 'form.submitted' } }],
        edges: [],
      };

      await enqueueFirstStep({ id: 'run-1', graphSnapshot: graph });

      expect(mockBoss.send).not.toHaveBeenCalled();
    });
  });

  describe('registerAutomationWorker', () => {
    it('registers a worker on the automation-step queue with metadata included', async () => {
      const boss = { work: vi.fn().mockResolvedValue('worker-id') };

      await registerAutomationWorker(boss as any);

      expect(boss.work).toHaveBeenCalledWith(
        AUTOMATION_QUEUE,
        { includeMetadata: true },
        expect.any(Function)
      );
    });

    it('processes every job in a delivered batch', async () => {
      let handler: (jobs: any[]) => Promise<void> = async () => {};
      const boss = {
        work: vi.fn().mockImplementation((_name: string, _opts: unknown, h: any) => {
          handler = h;
          return Promise.resolve('worker-id');
        }),
      };
      await registerAutomationWorker(boss as any);

      vi.mocked(prisma.automationStepRun.findFirst).mockResolvedValue({ status: 'SUCCESS' } as any);

      await handler([
        makeJob({ runId: 'r1', nodeId: 'n1' }),
        makeJob({ runId: 'r2', nodeId: 'n2' }),
      ]);

      expect(prisma.automationStepRun.findFirst).toHaveBeenCalledTimes(2);
    });
  });
});
