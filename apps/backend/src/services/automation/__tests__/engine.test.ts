import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as Sentry from '@sentry/node';
import { generateId, substituteMentions } from '@dculus/utils';
import {
  executeAutomationStep,
  enqueueFirstStep,
  registerAutomationWorker,
  classifyHandlerResult,
  ACTION_RETRY_LIMIT,
} from '../engine.js';
import { automationRepository } from '../../../repositories/index.js';
import { getPluginHandler } from '../../../plugins/core/registry.js';
import { createPluginContext } from '../../../plugins/core/context.js';
import { evaluateCondition } from '../conditionEvaluator.js';
import { getBoss, AUTOMATION_QUEUE } from '../boss.js';
import { getResponsesByFormId } from '../../responseService.js';
import type { AutomationGraph } from '../types.js';

// The tx-scoped repository created inside `prisma.$transaction(async (tx) => ...)` calls
// (updateAutomationNodeConfig, recordUnhandleableStepFailure) is a *second* repository
// instance built via `createAutomationRepository(withPrisma(tx))` — it is NOT the same
// object as the singleton `automationRepository` mocked below. We mock the factory to
// always return the same spy-bearing object so assertions can inspect calls made through
// either the singleton or a tx-scoped instance uniformly.
const txRepoMock = vi.hoisted(() => ({
  setNodeConfigInGraph: vi.fn().mockResolvedValue(1),
  setNodeConfigInRunSnapshot: vi.fn().mockResolvedValue(1),
  createStepRun: vi.fn().mockResolvedValue({}),
  updateRun: vi.fn().mockResolvedValue({}),
}));

vi.mock('../../../repositories/index.js', () => ({
  automationRepository: {
    findExecutedStepRun: vi.fn(),
    findRunByIdWithAutomation: vi.fn(),
    createStepRun: vi.fn().mockResolvedValue({}),
    updateRun: vi.fn().mockResolvedValue({}),
    findStepRunByNode: vi.fn(),
    listStepOutcomes: vi.fn().mockResolvedValue([]),
    advanceDigestWatermark: vi.fn().mockResolvedValue({ count: 1 }),
  },
  createAutomationRepository: vi.fn(() => txRepoMock),
}));

vi.mock('../../responseService.js', () => ({
  getResponsesByFormId: vi.fn(),
}));

vi.mock('../../../repositories/baseRepository.js', () => ({
  withPrisma: (client: unknown) => ({ prisma: client }),
}));

vi.mock('../../../lib/prisma.js', () => ({
  // Callback-style $transaction: invoke the callback with a stub tx client — the repo
  // methods called inside are routed to txRepoMock via the createAutomationRepository mock
  // above, so this stub client itself never needs real query methods.
  prisma: { $transaction: vi.fn((cb: (tx: unknown) => Promise<unknown>) => cb({})) },
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
      id: 'automation-1',
      status: 'ACTIVE',
      formId: 'form-1',
      organizationId: 'org-1',
      triggerType: 'form.submitted',
      createdAt: new Date('2025-12-01T00:00:00.000Z'),
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
    txRepoMock.setNodeConfigInGraph.mockResolvedValue(1);
    txRepoMock.setNodeConfigInRunSnapshot.mockResolvedValue(1);
    txRepoMock.createStepRun.mockResolvedValue({});
    txRepoMock.updateRun.mockResolvedValue({});
    vi.mocked(automationRepository.listStepOutcomes).mockResolvedValue([] as any);
    vi.mocked(automationRepository.advanceDigestWatermark).mockResolvedValue({ count: 1 } as any);
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

      vi.mocked(automationRepository.findExecutedStepRun).mockResolvedValue({
        output: { delayUntil: delayUntil.toISOString(), capped: false },
      } as any);
      vi.mocked(automationRepository.findStepRunByNode).mockResolvedValue(null);
      vi.mocked(automationRepository.findRunByIdWithAutomation).mockResolvedValue(
        makeRun({ status: 'WAITING', graphSnapshot: graph }) as any
      );

      await executeAutomationStep(makeJob({ runId: 'run-1', nodeId: 'delay-1' }));

      expect(automationRepository.createStepRun).not.toHaveBeenCalled();
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

      vi.mocked(automationRepository.findExecutedStepRun).mockResolvedValue({
        output: { result: true, branch: 'true' },
      } as any);
      vi.mocked(automationRepository.findStepRunByNode).mockResolvedValue(null);
      vi.mocked(automationRepository.findRunByIdWithAutomation).mockResolvedValue(
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

      vi.mocked(automationRepository.findExecutedStepRun).mockResolvedValue({
        output: { delayUntil: new Date().toISOString(), capped: false },
      } as any);
      vi.mocked(automationRepository.findRunByIdWithAutomation).mockResolvedValue(
        makeRun({ status: 'WAITING', graphSnapshot: graph }) as any
      );

      await executeAutomationStep(makeJob({ runId: 'run-1', nodeId: 'delay-1' }));

      expect(automationRepository.updateRun).toHaveBeenCalledWith('run-1', {
        status: 'COMPLETED',
        completedAt: expect.any(Date),
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

      vi.mocked(automationRepository.findExecutedStepRun).mockResolvedValue({
        output: { delivered: true },
      } as any);
      vi.mocked(automationRepository.findStepRunByNode).mockResolvedValue(null);
      vi.mocked(automationRepository.findRunByIdWithAutomation).mockResolvedValue(
        makeRun({ status: 'RUNNING', graphSnapshot: graph, context: { triggerData: {} } }) as any
      );

      await executeAutomationStep(makeJob({ runId: 'run-1', nodeId: 'action-1' }));

      expect(getPluginHandler).not.toHaveBeenCalled();
      expect(automationRepository.updateRun).toHaveBeenCalledWith('run-1', {
        context: { triggerData: {}, stepOutputs: { 'action-1': { delivered: true } } },
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

      vi.mocked(automationRepository.findExecutedStepRun).mockResolvedValue({
        output: { delayUntil: new Date().toISOString(), capped: false },
      } as any);
      // The successor already ran (or is itself further along).
      vi.mocked(automationRepository.findStepRunByNode).mockResolvedValue({ id: 'already-ran' } as any);
      vi.mocked(automationRepository.findRunByIdWithAutomation).mockResolvedValue(
        makeRun({ status: 'WAITING', graphSnapshot: graph }) as any
      );

      await executeAutomationStep(makeJob({ runId: 'run-1', nodeId: 'delay-1' }));

      expect(mockBoss.send).not.toHaveBeenCalled();
      expect(automationRepository.updateRun).not.toHaveBeenCalled();
    });

    it('does not merge stepOutputs again for an action node whose context already recorded the output', async () => {
      const graph: AutomationGraph = {
        nodes: [{ id: 'action-1', type: 'action', data: { actionType: 'webhook', config: {} } }],
        edges: [],
      };

      vi.mocked(automationRepository.findExecutedStepRun).mockResolvedValue({
        output: { delivered: true },
      } as any);
      vi.mocked(automationRepository.findStepRunByNode).mockResolvedValue(null);
      vi.mocked(automationRepository.findRunByIdWithAutomation).mockResolvedValue(
        makeRun({
          status: 'RUNNING',
          graphSnapshot: graph,
          context: { triggerData: {}, stepOutputs: { 'action-1': { delivered: true } } },
        }) as any
      );

      await executeAutomationStep(makeJob({ runId: 'run-1', nodeId: 'action-1' }));

      // Only the completion update should fire — no redundant context merge, since stepOutputs
      // already has this node's output on record.
      expect(automationRepository.updateRun).toHaveBeenCalledTimes(1);
      expect(automationRepository.updateRun).toHaveBeenCalledWith('run-1', {
        status: 'COMPLETED',
        completedAt: expect.any(Date),
      });
      expect(mockBoss.send).not.toHaveBeenCalled();
    });
  });

  describe('run lookup guards', () => {
    it('drops the job when the run no longer exists', async () => {
      vi.mocked(automationRepository.findExecutedStepRun).mockResolvedValue(null);
      vi.mocked(automationRepository.findRunByIdWithAutomation).mockResolvedValue(null);

      await executeAutomationStep(makeJob({ runId: 'run-1', nodeId: 'node-1' }));

      expect(automationRepository.updateRun).not.toHaveBeenCalled();
      expect(mockBoss.send).not.toHaveBeenCalled();
    });

    it('skips execution when the run is already in a terminal state', async () => {
      vi.mocked(automationRepository.findExecutedStepRun).mockResolvedValue(null);
      vi.mocked(automationRepository.findRunByIdWithAutomation).mockResolvedValue(
        makeRun({ status: 'COMPLETED', graphSnapshot: { nodes: [], edges: [] } }) as any
      );

      await executeAutomationStep(makeJob({ runId: 'run-1', nodeId: 'node-1' }));

      expect(automationRepository.updateRun).not.toHaveBeenCalled();
      expect(mockBoss.send).not.toHaveBeenCalled();
    });
  });

  describe('unhandleable node failures', () => {
    it('records a FAILED step run and reports to Sentry when the node is missing from the graph snapshot', async () => {
      vi.mocked(automationRepository.findExecutedStepRun).mockResolvedValue(null);
      vi.mocked(automationRepository.findRunByIdWithAutomation).mockResolvedValue(
        makeRun({ graphSnapshot: { nodes: [], edges: [] } }) as any
      );

      await executeAutomationStep(makeJob({ runId: 'run-1', nodeId: 'missing-node' }));

      expect(Sentry.captureException).toHaveBeenCalledWith(
        expect.objectContaining({ message: expect.stringContaining('missing-node') })
      );
      // recordUnhandleableStepFailure runs inside prisma.$transaction, using a tx-scoped
      // repository (txRepoMock) rather than the singleton automationRepository mock.
      expect(txRepoMock.createStepRun).toHaveBeenCalledWith(
        expect.objectContaining({
          runId: 'run-1',
          nodeId: 'missing-node',
          nodeType: 'unknown',
          status: 'FAILED',
        })
      );
      expect(txRepoMock.updateRun).toHaveBeenCalledWith('run-1', {
        status: 'FAILED',
        completedAt: expect.any(Date),
      });
    });

    it('records a FAILED step run and reports to Sentry for a node type the engine does not handle', async () => {
      const graph: AutomationGraph = {
        nodes: [{ id: 'trigger-1', type: 'trigger', data: { triggerType: 'form.submitted' } }],
        edges: [],
      };

      vi.mocked(automationRepository.findExecutedStepRun).mockResolvedValue(null);
      vi.mocked(automationRepository.findRunByIdWithAutomation).mockResolvedValue(
        makeRun({ graphSnapshot: graph }) as any
      );

      await executeAutomationStep(makeJob({ runId: 'run-1', nodeId: 'trigger-1' }));

      expect(Sentry.captureException).toHaveBeenCalledWith(
        expect.objectContaining({ message: expect.stringContaining('trigger-1') })
      );
      expect(txRepoMock.createStepRun).toHaveBeenCalledWith(
        expect.objectContaining({
          runId: 'run-1',
          nodeId: 'trigger-1',
          nodeType: 'trigger',
          status: 'FAILED',
        })
      );
      expect(txRepoMock.updateRun).toHaveBeenCalledWith('run-1', {
        status: 'FAILED',
        completedAt: expect.any(Date),
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

      vi.mocked(automationRepository.findExecutedStepRun).mockResolvedValue(null);
      vi.mocked(automationRepository.findRunByIdWithAutomation).mockResolvedValue(
        makeRun({ graphSnapshot: graph }) as any
      );

      await executeAutomationStep(makeJob({ runId: 'run-1', nodeId: 'delay-1' }));

      const delayUntil = new Date(now.getTime() + 2 * 60 * 60 * 1000);

      expect(automationRepository.createStepRun).toHaveBeenCalledWith(
        expect.objectContaining({
          runId: 'run-1',
          nodeId: 'delay-1',
          nodeType: 'delay',
          status: 'SUCCESS',
          output: { delayUntil: delayUntil.toISOString(), capped: false },
        })
      );

      expect(automationRepository.updateRun).toHaveBeenCalledWith('run-1', {
        status: 'WAITING',
        currentNodeId: 'action-1',
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

      vi.mocked(automationRepository.findExecutedStepRun).mockResolvedValue(null);
      vi.mocked(automationRepository.findRunByIdWithAutomation).mockResolvedValue(
        makeRun({ graphSnapshot: graph }) as any
      );

      await executeAutomationStep(makeJob({ runId: 'run-1', nodeId: 'delay-1' }));

      const cappedUntil = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

      expect(automationRepository.createStepRun).toHaveBeenCalledWith(
        expect.objectContaining({
          output: { delayUntil: cappedUntil.toISOString(), capped: true },
        })
      );

      vi.useRealTimers();
    });

    it('completes the run when the delay node has no successor', async () => {
      const graph: AutomationGraph = {
        nodes: [{ id: 'delay-1', type: 'delay', data: { amount: 1, unit: 'minutes' } }],
        edges: [],
      };

      vi.mocked(automationRepository.findExecutedStepRun).mockResolvedValue(null);
      vi.mocked(automationRepository.findRunByIdWithAutomation).mockResolvedValue(
        makeRun({ graphSnapshot: graph }) as any
      );

      await executeAutomationStep(makeJob({ runId: 'run-1', nodeId: 'delay-1' }));

      expect(automationRepository.updateRun).toHaveBeenCalledWith('run-1', {
        status: 'COMPLETED',
        completedAt: expect.any(Date),
      });
      expect(mockBoss.send).not.toHaveBeenCalled();
    });
  });

  describe('classifyHandlerResult', () => {
    it('treats a plain result with no failure signals as a success', () => {
      expect(classifyHandlerResult({ delivered: true })).toBe('SUCCESS');
      expect(classifyHandlerResult({ success: true, statusCode: 200 })).toBe('SUCCESS');
      expect(classifyHandlerResult(undefined)).toBe('SUCCESS');
      expect(classifyHandlerResult(null)).toBe('SUCCESS');
    });

    it('reads a batch result by its counts, not its coarse success boolean', () => {
      // A batch sets success: false if ANY item failed, so the counts are what distinguish
      // "mostly delivered" from "delivered nothing".
      expect(classifyHandlerResult({ success: false, sentCount: 100, failedCount: 400 })).toBe('PARTIAL');
      expect(classifyHandlerResult({ success: false, sentCount: 0, failedCount: 500 })).toBe('FAILED');
      expect(classifyHandlerResult({ success: false, sentCount: 0, skippedCount: 500 })).toBe('SKIPPED');
      expect(classifyHandlerResult({ success: false, sentCount: 10, skippedCount: 5 })).toBe('PARTIAL');
      expect(classifyHandlerResult({ success: true, sentCount: 500, failedCount: 0, skippedCount: 0 })).toBe('SUCCESS');
    });

    it('distinguishes a deliberate skip from a failure', () => {
      expect(classifyHandlerResult({ success: false, skipped: true, skipReason: 'no recipient' })).toBe('SKIPPED');
      expect(classifyHandlerResult({ success: false, statusCode: 500 })).toBe('FAILED');
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

      vi.mocked(automationRepository.findExecutedStepRun).mockResolvedValue(null);
      vi.mocked(automationRepository.findRunByIdWithAutomation).mockResolvedValue(
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

      expect(automationRepository.updateRun).toHaveBeenCalledWith('run-1', {
        status: 'RUNNING',
        currentNodeId: 'action-1',
      });

      expect(automationRepository.createStepRun).toHaveBeenCalledWith(
        expect.objectContaining({
          nodeType: 'action:webhook',
          status: 'SUCCESS',
          output: { delivered: true },
          attempt: 1,
        })
      );

      expect(automationRepository.updateRun).toHaveBeenCalledWith('run-1', {
        context: { triggerData: { email: 'a@b.com' }, stepOutputs: { 'action-1': { delivered: true } } },
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

      vi.mocked(automationRepository.findExecutedStepRun).mockResolvedValue(null);
      vi.mocked(automationRepository.findRunByIdWithAutomation).mockResolvedValue(
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

    it('skips pre-substitution for a per-response digest email action (recipientFieldId + __digestResponses present), passing the RAW config through so the handler can substitute per response (#automations-digest-per-response)', async () => {
      const graph: AutomationGraph = {
        nodes: [
          {
            id: 'action-1',
            type: 'action',
            data: { actionType: 'email', config: { recipientFieldId: 'email-field', subject: 'Hi', message: 'Hello {{name}}' } },
          },
        ],
        edges: [],
      };

      vi.mocked(automationRepository.findExecutedStepRun).mockResolvedValue(null);
      vi.mocked(automationRepository.findRunByIdWithAutomation).mockResolvedValue(
        makeRun({
          graphSnapshot: graph,
          context: { triggerData: { __digestResponses: [{ id: 'r1', submittedAt: '2026-01-01T00:00:00.000Z', data: { name: 'Ada' } }] } },
          automation: { id: 'automation-1', status: 'ACTIVE', formId: 'form-1', organizationId: 'org-1', triggerType: 'schedule' },
        }) as any
      );

      const handler = vi.fn().mockResolvedValue({});
      vi.mocked(getPluginHandler).mockReturnValue(handler);

      await executeAutomationStep(makeJob({ runId: 'run-1', nodeId: 'action-1' }, 0, ACTION_RETRY_LIMIT));

      // The pre-substitution pass must NOT run for this action — it would replace {{name}}
      // with a "[label]" fallback (packages/utils/src/mentionSubstitution.ts's behavior for an
      // unmatched key) against the aggregate triggerData, destroying the placeholder before the
      // handler's own per-response loop ever gets a chance to fill it in with each response's
      // real name.
      expect(substituteMentions).not.toHaveBeenCalled();
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          config: { recipientFieldId: 'email-field', subject: 'Hi', message: 'Hello {{name}}' },
        }),
        expect.anything(),
        expect.anything()
      );
    });

    it('does NOT skip pre-substitution for a webhook action downstream of a digest node — only the specific email+recipientFieldId case is exempted', async () => {
      const graph: AutomationGraph = {
        nodes: [
          {
            id: 'action-1',
            type: 'action',
            data: { actionType: 'webhook', config: { url: 'https://example.com', headers: { 'X-Count': '{{__digestCount}}' } } },
          },
        ],
        edges: [],
      };

      vi.mocked(automationRepository.findExecutedStepRun).mockResolvedValue(null);
      vi.mocked(automationRepository.findRunByIdWithAutomation).mockResolvedValue(
        makeRun({
          graphSnapshot: graph,
          context: { triggerData: { __digestCount: 5, __digestResponses: [] } },
          automation: { id: 'automation-1', status: 'ACTIVE', formId: 'form-1', organizationId: 'org-1', triggerType: 'schedule' },
        }) as any
      );

      const handler = vi.fn().mockResolvedValue({});
      vi.mocked(getPluginHandler).mockReturnValue(handler);
      vi.mocked(substituteMentions).mockImplementation((value: string) => value.replace('{{__digestCount}}', '5'));

      await executeAutomationStep(makeJob({ runId: 'run-1', nodeId: 'action-1' }, 0, ACTION_RETRY_LIMIT));

      expect(substituteMentions).toHaveBeenCalledWith('{{__digestCount}}', { __digestCount: 5, __digestResponses: [] });
    });

    it('skips execution and cancels the run when the automation is no longer ACTIVE', async () => {
      const graph: AutomationGraph = {
        nodes: [{ id: 'action-1', type: 'action', data: { actionType: 'webhook', config: {} } }],
        edges: [],
      };

      vi.mocked(automationRepository.findExecutedStepRun).mockResolvedValue(null);
      vi.mocked(automationRepository.findRunByIdWithAutomation).mockResolvedValue(
        makeRun({ graphSnapshot: graph, automation: { status: 'PAUSED', formId: 'f', organizationId: 'o', triggerType: 'form.submitted' } }) as any
      );

      await executeAutomationStep(makeJob({ runId: 'run-1', nodeId: 'action-1' }));

      expect(getPluginHandler).not.toHaveBeenCalled();
      expect(automationRepository.createStepRun).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'SKIPPED', errorMessage: expect.stringContaining('PAUSED') })
      );
      expect(automationRepository.updateRun).toHaveBeenCalledWith('run-1', {
        status: 'CANCELLED',
        completedAt: expect.any(Date),
      });
      expect(mockBoss.send).not.toHaveBeenCalled();
    });

    // Every automation starts as DRAFT, so gating test runs on ACTIVE meant "build it, test it,
    // then switch it on" died at the first action — the only way to see an automation work was to
    // point it at real respondents first.
    it('runs actions on a test run even though the automation is still a DRAFT', async () => {
      const graph: AutomationGraph = {
        nodes: [{ id: 'action-1', type: 'action', data: { actionType: 'webhook', config: { url: 'https://x' } } }],
        edges: [],
      };

      vi.mocked(automationRepository.findExecutedStepRun).mockResolvedValue(null);
      vi.mocked(automationRepository.findRunByIdWithAutomation).mockResolvedValue(
        makeRun({
          graphSnapshot: graph,
          context: { test: true, testUserEmail: 'tester@example.com' },
          automation: { id: 'automation-1', status: 'DRAFT', formId: 'f', organizationId: 'o', triggerType: 'form.submitted' },
        }) as any
      );

      const handler = vi.fn().mockResolvedValue({ success: true });
      vi.mocked(getPluginHandler).mockReturnValue(handler);

      await executeAutomationStep(makeJob({ runId: 'run-1', nodeId: 'action-1' }, 0, ACTION_RETRY_LIMIT));

      expect(handler).toHaveBeenCalled();
      expect(automationRepository.createStepRun).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'SUCCESS' })
      );
      expect(automationRepository.updateRun).not.toHaveBeenCalledWith(
        'run-1',
        expect.objectContaining({ status: 'CANCELLED' })
      );
    });

    it('redirects a test run\'s email to the tester and marks the subject, instead of the configured recipient', async () => {
      const graph: AutomationGraph = {
        nodes: [
          {
            id: 'action-1',
            type: 'action',
            data: {
              actionType: 'email',
              config: { recipientEmail: 'respondent@example.com', subject: 'Your receipt', message: 'Hi' },
            },
          },
        ],
        edges: [],
      };

      vi.mocked(automationRepository.findExecutedStepRun).mockResolvedValue(null);
      vi.mocked(automationRepository.findRunByIdWithAutomation).mockResolvedValue(
        makeRun({ graphSnapshot: graph, context: { test: true, testUserEmail: 'tester@example.com' } }) as any
      );

      const handler = vi.fn().mockResolvedValue({ success: true });
      vi.mocked(getPluginHandler).mockReturnValue(handler);

      await executeAutomationStep(makeJob({ runId: 'run-1', nodeId: 'action-1' }, 0, ACTION_RETRY_LIMIT));

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          config: expect.objectContaining({
            recipientEmail: 'tester@example.com',
            subject: '[Test] Your receipt',
          }),
        }),
        expect.objectContaining({ data: expect.objectContaining({ __isTest: true }) }),
        expect.any(Object)
      );
    });

    it('skips a test run\'s email rather than falling back to the real recipient when there is no address to redirect to', async () => {
      const graph: AutomationGraph = {
        nodes: [
          {
            id: 'action-1',
            type: 'action',
            data: { actionType: 'email', config: { recipientEmail: 'respondent@example.com', subject: 'S', message: 'M' } },
          },
        ],
        edges: [],
      };

      vi.mocked(automationRepository.findExecutedStepRun).mockResolvedValue(null);
      vi.mocked(automationRepository.findRunByIdWithAutomation).mockResolvedValue(
        makeRun({ graphSnapshot: graph, context: { test: true } }) as any
      );

      const handler = vi.fn().mockResolvedValue({ success: true });
      vi.mocked(getPluginHandler).mockReturnValue(handler);

      await executeAutomationStep(makeJob({ runId: 'run-1', nodeId: 'action-1' }, 0, ACTION_RETRY_LIMIT));

      expect(handler).not.toHaveBeenCalled();
      expect(automationRepository.createStepRun).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'SKIPPED' })
      );
    });

    // Handlers report failure two ways — by throwing, and by returning a result that says so.
    // The webhook handler returns { success: false } for any non-2xx; recording that as SUCCESS
    // is what made a failed delivery show a green tick and skip its retries entirely.
    it('treats a handler that returns success: false as a failure, with retries, not as a success', async () => {
      const graph: AutomationGraph = {
        nodes: [{ id: 'action-1', type: 'action', data: { actionType: 'webhook', config: { url: 'https://x' } } }],
        edges: [],
      };

      vi.mocked(automationRepository.findExecutedStepRun).mockResolvedValue(null);
      vi.mocked(automationRepository.findRunByIdWithAutomation).mockResolvedValue(
        makeRun({ graphSnapshot: graph }) as any
      );

      const handler = vi.fn().mockResolvedValue({ success: false, statusCode: 500, error: 'HTTP 500' });
      vi.mocked(getPluginHandler).mockReturnValue(handler);

      await expect(
        executeAutomationStep(makeJob({ runId: 'run-1', nodeId: 'action-1' }, 0, ACTION_RETRY_LIMIT))
      ).rejects.toThrow('HTTP 500');

      expect(automationRepository.createStepRun).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'FAILED', errorMessage: 'HTTP 500' })
      );
      expect(mockBoss.send).not.toHaveBeenCalled();
    });

    it('records a partially-delivered batch as PARTIAL and still continues the flow', async () => {
      const graph: AutomationGraph = {
        nodes: [
          { id: 'action-1', type: 'action', data: { actionType: 'email', config: { subject: 'S', message: 'M' } } },
          { id: 'end-1', type: 'end' },
        ],
        edges: [{ id: 'e1', source: 'action-1', target: 'end-1' }],
      };

      vi.mocked(automationRepository.findExecutedStepRun).mockResolvedValue(null);
      vi.mocked(automationRepository.findRunByIdWithAutomation).mockResolvedValue(
        makeRun({ graphSnapshot: graph }) as any
      );

      const handler = vi.fn().mockResolvedValue({
        success: false,
        sentCount: 100,
        failedCount: 400,
        skippedCount: 0,
        error: '400 of 500 emails failed to send. Last error: SMTP timeout',
      });
      vi.mocked(getPluginHandler).mockReturnValue(handler);

      await executeAutomationStep(makeJob({ runId: 'run-1', nodeId: 'action-1' }, 0, ACTION_RETRY_LIMIT));

      expect(automationRepository.createStepRun).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'PARTIAL',
          errorMessage: expect.stringContaining('400 of 500'),
        })
      );
      // Retrying has no per-response idempotency, so a partial batch is not retried — it is
      // reported. The rest of the flow still runs.
      expect(mockBoss.send).toHaveBeenCalledWith(
        AUTOMATION_QUEUE,
        { runId: 'run-1', nodeId: 'end-1' },
        expect.anything()
      );
    });

    it('records an email skipped for quota as SKIPPED rather than SUCCESS', async () => {
      const graph: AutomationGraph = {
        nodes: [{ id: 'action-1', type: 'action', data: { actionType: 'email', config: { subject: 'S', message: 'M' } } }],
        edges: [],
      };

      vi.mocked(automationRepository.findExecutedStepRun).mockResolvedValue(null);
      vi.mocked(automationRepository.findRunByIdWithAutomation).mockResolvedValue(
        makeRun({ graphSnapshot: graph }) as any
      );

      const handler = vi.fn().mockResolvedValue({
        success: false,
        skipped: true,
        skipReason: 'Organization has reached its email sending limit for this billing period',
      });
      vi.mocked(getPluginHandler).mockReturnValue(handler);

      await executeAutomationStep(makeJob({ runId: 'run-1', nodeId: 'action-1' }, 0, ACTION_RETRY_LIMIT));

      expect(automationRepository.createStepRun).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'SKIPPED',
          errorMessage: expect.stringContaining('email sending limit'),
        })
      );
    });

    it('rethrows on failure while retries remain, recording a FAILED step but leaving the run RUNNING', async () => {
      const graph: AutomationGraph = {
        nodes: [{ id: 'action-1', type: 'action', data: { actionType: 'webhook', config: {} } }],
        edges: [],
      };

      vi.mocked(automationRepository.findExecutedStepRun).mockResolvedValue(null);
      vi.mocked(automationRepository.findRunByIdWithAutomation).mockResolvedValue(
        makeRun({ graphSnapshot: graph }) as any
      );

      const handler = vi.fn().mockRejectedValue(new Error('boom'));
      vi.mocked(getPluginHandler).mockReturnValue(handler);

      await expect(
        executeAutomationStep(makeJob({ runId: 'run-1', nodeId: 'action-1' }, 0, ACTION_RETRY_LIMIT))
      ).rejects.toThrow('boom');

      expect(Sentry.captureException).toHaveBeenCalled();
      expect(automationRepository.createStepRun).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'FAILED', errorMessage: 'boom', attempt: 1 })
      );
      expect(automationRepository.updateRun).not.toHaveBeenCalledWith(
        'run-1',
        expect.objectContaining({ status: 'FAILED' })
      );
    });

    it('marks the run FAILED without rethrowing once retries are exhausted', async () => {
      const graph: AutomationGraph = {
        nodes: [{ id: 'action-1', type: 'action', data: { actionType: 'webhook', config: {} } }],
        edges: [],
      };

      vi.mocked(automationRepository.findExecutedStepRun).mockResolvedValue(null);
      vi.mocked(automationRepository.findRunByIdWithAutomation).mockResolvedValue(
        makeRun({ graphSnapshot: graph }) as any
      );

      const handler = vi.fn().mockRejectedValue(new Error('boom'));
      vi.mocked(getPluginHandler).mockReturnValue(handler);

      await expect(
        executeAutomationStep(makeJob({ runId: 'run-1', nodeId: 'action-1' }, ACTION_RETRY_LIMIT, ACTION_RETRY_LIMIT))
      ).resolves.toBeUndefined();

      // The final attempt writes the FAILED step and the terminal run status in ONE transaction,
      // so a crash between them can't leave the run non-terminal — FAILED is deliberately not a
      // redelivery guard, so a redelivered job would call the handler again and deliver twice.
      // Both writes therefore land on the tx-scoped repo, not the singleton.
      expect(txRepoMock.createStepRun).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'FAILED', attempt: ACTION_RETRY_LIMIT + 1 })
      );
      expect(txRepoMock.updateRun).toHaveBeenCalledWith('run-1', {
        status: 'FAILED',
        completedAt: expect.any(Date),
      });
    });

    it('fails (and is retryable) when no handler is registered for the action type', async () => {
      const graph: AutomationGraph = {
        nodes: [{ id: 'action-1', type: 'action', data: { actionType: 'unregistered-type', config: {} } }],
        edges: [],
      };

      vi.mocked(automationRepository.findExecutedStepRun).mockResolvedValue(null);
      vi.mocked(automationRepository.findRunByIdWithAutomation).mockResolvedValue(
        makeRun({ graphSnapshot: graph }) as any
      );
      vi.mocked(getPluginHandler).mockReturnValue(undefined);

      await expect(
        executeAutomationStep(makeJob({ runId: 'run-1', nodeId: 'action-1' }, 0, ACTION_RETRY_LIMIT))
      ).rejects.toThrow('No handler registered for action type: unregistered-type');
    });

    it("wires createPluginContext with a persistence strategy that jsonb_sets the node config into both the live Automation.graph and this run's graphSnapshot (#222 regression: handlers previously wrote to a nonexistent FormPlugin row for automation-triggered actions)", async () => {
      const graph: AutomationGraph = {
        nodes: [{ id: 'action-1', type: 'action', data: { actionType: 'google-sheets', config: { type: 'google-sheets' } } }],
        edges: [],
      };

      vi.mocked(automationRepository.findExecutedStepRun).mockResolvedValue(null);
      vi.mocked(automationRepository.findRunByIdWithAutomation).mockResolvedValue(
        makeRun({ graphSnapshot: graph }) as any
      );

      const handler = vi.fn().mockResolvedValue({ success: true });
      vi.mocked(getPluginHandler).mockReturnValue(handler);

      // createPluginContext is mocked wholesale for the rest of this suite (see the
      // module-level vi.mock above) — override it just for this test so the real closure
      // built by handleActionNode is captured and can be invoked directly, the way the
      // google-sheets/microsoft-sheets handlers call context.updatePluginConfig(...).
      let capturedPersist: ((config: any) => Promise<void>) | undefined;
      vi.mocked(createPluginContext).mockImplementation((persist: any) => {
        capturedPersist = persist;
        return { prisma: {} as any, logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() }, updatePluginConfig: persist } as any;
      });

      await executeAutomationStep(makeJob({ runId: 'run-1', nodeId: 'action-1' }, 0, ACTION_RETRY_LIMIT));

      expect(capturedPersist).toBeInstanceOf(Function);

      const newConfig = { type: 'google-sheets', spreadsheetId: 'sheet-123', spreadsheetUrl: 'https://sheets.google.com/sheet-123' };
      await capturedPersist!(newConfig);

      // Both writes must go through the same interactive `prisma.$transaction(async (tx) => ...)`
      // callback (via a tx-scoped repository), not independently — otherwise one write
      // succeeding while the other fails would leave Automation.graph and this run's
      // graphSnapshot permanently diverged.
      expect(txRepoMock.setNodeConfigInGraph).toHaveBeenCalledWith('automation-1', 'action-1', newConfig);
      expect(txRepoMock.setNodeConfigInRunSnapshot).toHaveBeenCalledWith('run-1', 'action-1', newConfig);
    });
  });

  describe('digest node', () => {
    const graph: AutomationGraph = {
      nodes: [
        { id: 'digest-1', type: 'digest', data: { maxResponses: 50 } },
        { id: 'end-1', type: 'end' },
      ],
      edges: [{ id: 'e1', source: 'digest-1', target: 'end-1' }],
    };

    function scheduleRun(overrides: Record<string, any> = {}) {
      return makeRun({
        graphSnapshot: graph,
        context: {},
        automation: {
          id: 'automation-1',
          status: 'ACTIVE',
          formId: 'form-1',
          organizationId: 'org-1',
          triggerType: 'schedule',
          createdAt: new Date('2025-12-01T00:00:00.000Z'),
        },
        ...overrides,
      });
    }

    it('merges an empty result (count 0) into triggerData and enqueues the next node — a run with nothing new still succeeds', async () => {
      vi.mocked(automationRepository.findExecutedStepRun).mockResolvedValue(null);
      vi.mocked(automationRepository.findRunByIdWithAutomation).mockResolvedValue(scheduleRun() as any);
      vi.mocked(getResponsesByFormId).mockResolvedValue({ data: [], total: 0, page: 1, limit: 100, totalPages: 0 } as any);

      await executeAutomationStep(makeJob({ runId: 'run-1', nodeId: 'digest-1' }, 0, ACTION_RETRY_LIMIT));

      expect(getResponsesByFormId).toHaveBeenCalledWith(
        'form-1',
        1,
        100,
        'submittedAt',
        'asc',
        [
          { fieldId: '__submittedAt', operator: 'DATE_AFTER', value: '1970-01-01T00:00:00.000Z' },
          { fieldId: '__submittedAt', operator: 'DATE_BEFORE', value: '2026-01-01T00:00:00.000Z' },
        ]
      );

      expect(automationRepository.createStepRun).toHaveBeenCalledWith(
        expect.objectContaining({
          nodeType: 'digest',
          status: 'SUCCESS',
          output: expect.objectContaining({ count: 0, truncated: false, responses: [] }),
        })
      );

      expect(automationRepository.updateRun).toHaveBeenCalledWith(
        'run-1',
        expect.objectContaining({
          context: expect.objectContaining({
            triggerData: expect.objectContaining({ __digestCount: 0, __digestTruncated: false, __digestResponses: [] }),
          }),
        })
      );

      expect(mockBoss.send).toHaveBeenCalledWith(
        AUTOMATION_QUEUE,
        { runId: 'run-1', nodeId: 'end-1' },
        expect.anything()
      );
    });

    it('falls back to the epoch only when no watermark was seeded — the opted-in backfill case', async () => {
      vi.mocked(automationRepository.findExecutedStepRun).mockResolvedValue(null);
      vi.mocked(automationRepository.findRunByIdWithAutomation).mockResolvedValue(scheduleRun() as any);
      vi.mocked(getResponsesByFormId).mockResolvedValue({ data: [], total: 0, page: 1, limit: 100, totalPages: 0 } as any);

      await executeAutomationStep(makeJob({ runId: 'run-1', nodeId: 'digest-1' }, 0, ACTION_RETRY_LIMIT));

      // 1970-01-01 (epoch), reached only because this fixture has no lastDigestedAt — i.e. the
      // node opted into includeExistingResponses. Activation normally seeds the watermark, so a
      // default automation's first tick starts at activation time, not at the form's first ever
      // response (see automationService.resolveActivationDigestWatermark).
      expect(getResponsesByFormId).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.arrayContaining([
          expect.objectContaining({ operator: 'DATE_AFTER', value: '1970-01-01T00:00:00.000Z' }),
        ])
      );
    });

    it('ANDs the digest node\'s own configured filters onto the mandatory since-last-run filter', async () => {
      const filteredGraph: AutomationGraph = {
        nodes: [
          {
            id: 'digest-1',
            type: 'digest',
            data: { maxResponses: 50, filters: [{ fieldId: 'score', operator: 'GREATER_THAN', value: '80' }] },
          },
          { id: 'end-1', type: 'end' },
        ],
        edges: [{ id: 'e1', source: 'digest-1', target: 'end-1' }],
      };
      vi.mocked(automationRepository.findExecutedStepRun).mockResolvedValue(null);
      vi.mocked(automationRepository.findRunByIdWithAutomation).mockResolvedValue(
        scheduleRun({ graphSnapshot: filteredGraph }) as any
      );
      vi.mocked(getResponsesByFormId).mockResolvedValue({ data: [], total: 0, page: 1, limit: 100, totalPages: 0 } as any);

      await executeAutomationStep(makeJob({ runId: 'run-1', nodeId: 'digest-1' }, 0, ACTION_RETRY_LIMIT));

      expect(getResponsesByFormId).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything(),
        [
          { fieldId: '__submittedAt', operator: 'DATE_AFTER', value: '1970-01-01T00:00:00.000Z' },
          { fieldId: '__submittedAt', operator: 'DATE_BEFORE', value: '2026-01-01T00:00:00.000Z' },
          { fieldId: 'score', operator: 'GREATER_THAN', value: '80' },
        ]
      );
    });

    it('anchors the window on the automation lastDigestedAt watermark, not the epoch fallback', async () => {
      vi.mocked(automationRepository.findExecutedStepRun).mockResolvedValue(null);
      vi.mocked(automationRepository.findRunByIdWithAutomation).mockResolvedValue(
        // startedAt must be chronologically after the watermark below — this run's own startedAt
        // becomes the DATE_BEFORE upper bound, so it must not precede the DATE_AFTER lower bound
        // or the (mandatory) window would be empty/inverted.
        scheduleRun({
          startedAt: new Date('2026-01-15T00:00:00.000Z'),
          automation: {
            id: 'automation-1',
            status: 'ACTIVE',
            formId: 'form-1',
            organizationId: 'org-1',
            triggerType: 'schedule',
            lastDigestedAt: new Date('2026-01-10T09:00:00.000Z'),
          },
        }) as any
      );
      vi.mocked(getResponsesByFormId).mockResolvedValue({ data: [], total: 0, page: 1, limit: 100, totalPages: 0 } as any);

      await executeAutomationStep(makeJob({ runId: 'run-1', nodeId: 'digest-1' }, 0, ACTION_RETRY_LIMIT));

      expect(getResponsesByFormId).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything(),
        [
          { fieldId: '__submittedAt', operator: 'DATE_AFTER', value: '2026-01-10T09:00:00.000Z' },
          { fieldId: '__submittedAt', operator: 'DATE_BEFORE', value: '2026-01-15T00:00:00.000Z' },
        ]
      );
    });

    it('advances the watermark to the window upper bound once the run completes cleanly', async () => {
      const graph: AutomationGraph = {
        nodes: [{ id: 'digest-1', type: 'digest', data: {} }],
        edges: [],
      };
      vi.mocked(automationRepository.findExecutedStepRun).mockResolvedValue(null);
      vi.mocked(automationRepository.findRunByIdWithAutomation).mockResolvedValue(
        scheduleRun({ graphSnapshot: graph }) as any
      );
      vi.mocked(getResponsesByFormId).mockResolvedValue({ data: [], total: 0, page: 1, limit: 100, totalPages: 0 } as any);

      await executeAutomationStep(makeJob({ runId: 'run-1', nodeId: 'digest-1' }, 0, ACTION_RETRY_LIMIT));

      expect(automationRepository.advanceDigestWatermark).toHaveBeenCalledWith(
        'automation-1',
        new Date('2026-01-01T00:00:00.000Z')
      );
    });

    it('leaves the watermark alone when a step did not fully succeed — the window stays open for a retry', async () => {
      const graph: AutomationGraph = {
        nodes: [{ id: 'digest-1', type: 'digest', data: {} }],
        edges: [],
      };
      vi.mocked(automationRepository.findExecutedStepRun).mockResolvedValue(null);
      vi.mocked(automationRepository.findRunByIdWithAutomation).mockResolvedValue(
        scheduleRun({ graphSnapshot: graph }) as any
      );
      vi.mocked(getResponsesByFormId).mockResolvedValue({ data: [], total: 0, page: 1, limit: 100, totalPages: 0 } as any);
      // An upstream email action that delivered nothing at all (quota reached). Nothing went
      // out, so re-covering the window next tick cannot duplicate anything.
      vi.mocked(automationRepository.listStepOutcomes).mockResolvedValue([
        { nodeId: 'action-1', nodeType: 'action:email', status: 'SKIPPED' },
      ] as any);

      await executeAutomationStep(makeJob({ runId: 'run-1', nodeId: 'digest-1' }, 0, ACTION_RETRY_LIMIT));

      expect(automationRepository.advanceDigestWatermark).not.toHaveBeenCalled();
      expect(automationRepository.updateRun).toHaveBeenCalledWith(
        'run-1',
        expect.objectContaining({ status: 'PARTIAL' })
      );
    });

    // The other half of the rule: a PARTIAL step DID deliver to some of the batch, so holding the
    // window would send that part again on the next tick — there is no per-response idempotency to
    // retry against. The shortfall is reported (run PARTIAL) rather than silently re-blasted.
    it('still advances the watermark when a step partly delivered, to avoid re-sending to everyone it reached', async () => {
      const graph: AutomationGraph = {
        nodes: [{ id: 'digest-1', type: 'digest', data: {} }],
        edges: [],
      };
      vi.mocked(automationRepository.findExecutedStepRun).mockResolvedValue(null);
      vi.mocked(automationRepository.findRunByIdWithAutomation).mockResolvedValue(
        scheduleRun({ graphSnapshot: graph }) as any
      );
      vi.mocked(getResponsesByFormId).mockResolvedValue({ data: [], total: 0, page: 1, limit: 100, totalPages: 0 } as any);
      vi.mocked(automationRepository.listStepOutcomes).mockResolvedValue([
        { nodeId: 'action-1', nodeType: 'action:email', status: 'PARTIAL' },
      ] as any);

      await executeAutomationStep(makeJob({ runId: 'run-1', nodeId: 'digest-1' }, 0, ACTION_RETRY_LIMIT));

      expect(automationRepository.updateRun).toHaveBeenCalledWith(
        'run-1',
        expect.objectContaining({ status: 'PARTIAL' })
      );
      expect(automationRepository.advanceDigestWatermark).toHaveBeenCalled();
    });

    // A retried action leaves a FAILED row from the attempt that failed AND a SUCCESS row from
    // the one that worked. Only the final attempt counts — reading every row would file the run
    // as PARTIAL because of a failure the retry already made good.
    it('ignores a FAILED attempt when the same node later succeeded on retry', async () => {
      const graph: AutomationGraph = {
        nodes: [{ id: 'digest-1', type: 'digest', data: {} }],
        edges: [],
      };
      vi.mocked(automationRepository.findExecutedStepRun).mockResolvedValue(null);
      vi.mocked(automationRepository.findRunByIdWithAutomation).mockResolvedValue(
        scheduleRun({ graphSnapshot: graph }) as any
      );
      vi.mocked(getResponsesByFormId).mockResolvedValue({ data: [], total: 0, page: 1, limit: 100, totalPages: 0 } as any);
      vi.mocked(automationRepository.listStepOutcomes).mockResolvedValue([
        { nodeId: 'action-1', nodeType: 'action:webhook', status: 'FAILED' },
        { nodeId: 'action-1', nodeType: 'action:webhook', status: 'SUCCESS' },
      ] as any);

      await executeAutomationStep(makeJob({ runId: 'run-1', nodeId: 'digest-1' }, 0, ACTION_RETRY_LIMIT));

      expect(automationRepository.updateRun).toHaveBeenCalledWith(
        'run-1',
        expect.objectContaining({ status: 'COMPLETED' })
      );
      expect(automationRepository.advanceDigestWatermark).toHaveBeenCalled();
    });

    // A fast-forwarded delay is recorded SKIPPED, which must not be read as a failed delivery.
    it('treats a fast-forwarded delay as clean, not as a partly-delivered run', async () => {
      const graph: AutomationGraph = {
        nodes: [{ id: 'digest-1', type: 'digest', data: {} }],
        edges: [],
      };
      vi.mocked(automationRepository.findExecutedStepRun).mockResolvedValue(null);
      vi.mocked(automationRepository.findRunByIdWithAutomation).mockResolvedValue(
        scheduleRun({ graphSnapshot: graph }) as any
      );
      vi.mocked(getResponsesByFormId).mockResolvedValue({ data: [], total: 0, page: 1, limit: 100, totalPages: 0 } as any);
      vi.mocked(automationRepository.listStepOutcomes).mockResolvedValue([
        { nodeId: 'delay-1', nodeType: 'delay', status: 'SKIPPED' },
      ] as any);

      await executeAutomationStep(makeJob({ runId: 'run-1', nodeId: 'digest-1' }, 0, ACTION_RETRY_LIMIT));

      expect(automationRepository.updateRun).toHaveBeenCalledWith(
        'run-1',
        expect.objectContaining({ status: 'COMPLETED' })
      );
    });

    it('never advances the watermark for a test run, so a rehearsal cannot skip pending responses', async () => {
      const graph: AutomationGraph = {
        nodes: [{ id: 'digest-1', type: 'digest', data: {} }],
        edges: [],
      };
      vi.mocked(automationRepository.findExecutedStepRun).mockResolvedValue(null);
      vi.mocked(automationRepository.findRunByIdWithAutomation).mockResolvedValue(
        scheduleRun({ graphSnapshot: graph, context: { test: true } }) as any
      );
      vi.mocked(getResponsesByFormId).mockResolvedValue({ data: [], total: 0, page: 1, limit: 100, totalPages: 0 } as any);

      await executeAutomationStep(makeJob({ runId: 'run-1', nodeId: 'digest-1' }, 0, ACTION_RETRY_LIMIT));

      expect(automationRepository.advanceDigestWatermark).not.toHaveBeenCalled();
    });

    it('samples the most recent responses on a test run instead of draining the pending window', async () => {
      vi.mocked(automationRepository.findExecutedStepRun).mockResolvedValue(null);
      vi.mocked(automationRepository.findRunByIdWithAutomation).mockResolvedValue(
        scheduleRun({
          context: { test: true },
          automation: {
            id: 'automation-1',
            status: 'ACTIVE',
            formId: 'form-1',
            organizationId: 'org-1',
            triggerType: 'schedule',
            lastDigestedAt: new Date('2026-01-10T09:00:00.000Z'),
          },
        }) as any
      );
      vi.mocked(getResponsesByFormId).mockResolvedValue({ data: [], total: 0, page: 1, limit: 100, totalPages: 0 } as any);

      await executeAutomationStep(makeJob({ runId: 'run-1', nodeId: 'digest-1' }, 0, ACTION_RETRY_LIMIT));

      // Newest-first and ignoring the watermark: a test should show recent, realistic data rather
      // than whatever happens to be pending (or nothing at all, on an up-to-date automation).
      expect(getResponsesByFormId).toHaveBeenCalledWith(
        'form-1',
        1,
        100,
        'submittedAt',
        'desc',
        expect.arrayContaining([
          expect.objectContaining({ operator: 'DATE_AFTER', value: '1970-01-01T00:00:00.000Z' }),
        ])
      );
      expect(automationRepository.createStepRun).toHaveBeenCalledWith(
        expect.objectContaining({ nodeType: 'digest', output: expect.objectContaining({ sampled: true }) })
      );
    });

    it('bounds embedded responses at maxResponses while reporting the accurate uncapped total (truncated)', async () => {
      const smallGraph: AutomationGraph = {
        nodes: [{ id: 'digest-1', type: 'digest', data: { maxResponses: 2 } }],
        edges: [],
      };
      vi.mocked(automationRepository.findExecutedStepRun).mockResolvedValue(null);
      vi.mocked(automationRepository.findRunByIdWithAutomation).mockResolvedValue(
        scheduleRun({ graphSnapshot: smallGraph }) as any
      );
      vi.mocked(getResponsesByFormId).mockResolvedValue({
        data: [
          { id: 'r1', submittedAt: new Date('2026-01-02T00:00:00.000Z'), data: { a: 1 } },
          { id: 'r2', submittedAt: new Date('2026-01-03T00:00:00.000Z'), data: { a: 2 } },
        ],
        total: 5,
        page: 1,
        limit: 100,
        totalPages: 1,
      } as any);

      await executeAutomationStep(makeJob({ runId: 'run-1', nodeId: 'digest-1' }, 0, ACTION_RETRY_LIMIT));

      expect(getResponsesByFormId).toHaveBeenCalledTimes(1);
      expect(automationRepository.createStepRun).toHaveBeenCalledWith(
        expect.objectContaining({
          output: expect.objectContaining({
            count: 5,
            truncated: true,
            responses: [
              { id: 'r1', submittedAt: '2026-01-02T00:00:00.000Z', data: { a: 1 } },
              { id: 'r2', submittedAt: '2026-01-03T00:00:00.000Z', data: { a: 2 } },
            ],
          }),
        })
      );
    });

    it('replays the persisted output and advances downstream without re-querying when redelivered after an already-recorded SUCCESS (crash recovery)', async () => {
      const existingOutput = {
        count: 3,
        since: '2025-12-01T00:00:00.000Z',
        until: '2026-01-01T00:00:00.000Z',
        truncated: false,
        responses: [{ id: 'r1', submittedAt: '2025-12-15T00:00:00.000Z', data: {} }],
      };

      vi.mocked(automationRepository.findExecutedStepRun).mockResolvedValue({ output: existingOutput } as any);
      vi.mocked(automationRepository.findStepRunByNode).mockResolvedValue(null);
      vi.mocked(automationRepository.findRunByIdWithAutomation).mockResolvedValue(
        scheduleRun({ context: {} }) as any
      );

      await executeAutomationStep(makeJob({ runId: 'run-1', nodeId: 'digest-1' }));

      // Redelivery must reconstruct purely from the persisted step output — never re-query,
      // since a redelivered digest query could return a DIFFERENT response set (new
      // submissions since the crash) than the one that actually ran.
      expect(getResponsesByFormId).not.toHaveBeenCalled();
      expect(automationRepository.updateRun).toHaveBeenCalledWith(
        'run-1',
        expect.objectContaining({
          context: expect.objectContaining({
            triggerData: expect.objectContaining({ __digestCount: 3 }),
          }),
        })
      );
      expect(mockBoss.send).toHaveBeenCalledWith(
        AUTOMATION_QUEUE,
        { runId: 'run-1', nodeId: 'end-1' },
        expect.anything()
      );
    });

    it('a downstream action node sees __digestResponses via buildPluginEvent (single triggerData channel)', async () => {
      const chainGraph: AutomationGraph = {
        nodes: [
          { id: 'digest-1', type: 'digest', data: {} },
          { id: 'action-1', type: 'action', data: { actionType: 'webhook', config: { url: 'https://x' } } },
        ],
        edges: [{ id: 'e1', source: 'digest-1', target: 'action-1' }],
      };

      vi.mocked(automationRepository.findExecutedStepRun).mockResolvedValue(null);
      vi.mocked(automationRepository.findRunByIdWithAutomation).mockResolvedValue(
        scheduleRun({ graphSnapshot: chainGraph }) as any
      );
      vi.mocked(getResponsesByFormId).mockResolvedValue({
        data: [{ id: 'r1', submittedAt: new Date('2026-01-02T00:00:00.000Z'), data: { a: 1 } }],
        total: 1,
        page: 1,
        limit: 100,
        totalPages: 1,
      } as any);

      await executeAutomationStep(makeJob({ runId: 'run-1', nodeId: 'digest-1' }, 0, ACTION_RETRY_LIMIT));

      // The digest step's own updateRun call is the one that must carry __digestResponses —
      // the next executeAutomationStep call (processing action-1) would read it back via
      // findRunByIdWithAutomation, which this test doesn't re-simulate; asserting the merge
      // itself is what proves the single-channel wiring is correct.
      expect(automationRepository.updateRun).toHaveBeenCalledWith(
        'run-1',
        expect.objectContaining({
          context: expect.objectContaining({
            triggerData: expect.objectContaining({
              __digestResponses: [{ id: 'r1', submittedAt: '2026-01-02T00:00:00.000Z', data: { a: 1 } }],
            }),
          }),
        })
      );
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
      vi.mocked(automationRepository.findExecutedStepRun).mockResolvedValue(null);
      vi.mocked(automationRepository.findRunByIdWithAutomation).mockResolvedValue(
        makeRun({ graphSnapshot: graph, context: { triggerData: {} } }) as any
      );
      vi.mocked(evaluateCondition).mockReturnValue(true);

      await executeAutomationStep(makeJob({ runId: 'run-1', nodeId: 'cond-1' }));

      expect(automationRepository.updateRun).toHaveBeenCalledWith('run-1', { currentNodeId: 'true-1' });
      expect(mockBoss.send).toHaveBeenCalledWith(
        AUTOMATION_QUEUE,
        { runId: 'run-1', nodeId: 'true-1' },
        expect.objectContaining({ singletonKey: 'run-1:true-1' })
      );
    });

    it('jumps to end (completes the run) when the matching branch has no outgoing edge', async () => {
      vi.mocked(automationRepository.findExecutedStepRun).mockResolvedValue(null);
      vi.mocked(automationRepository.findRunByIdWithAutomation).mockResolvedValue(
        makeRun({ graphSnapshot: graph, context: { triggerData: {} } }) as any
      );
      vi.mocked(evaluateCondition).mockReturnValue(false);

      await executeAutomationStep(makeJob({ runId: 'run-1', nodeId: 'cond-1' }));

      expect(automationRepository.updateRun).toHaveBeenCalledWith('run-1', {
        status: 'COMPLETED',
        completedAt: expect.any(Date),
      });
      expect(mockBoss.send).not.toHaveBeenCalled();
    });
  });

  describe('end node', () => {
    it('logs a SUCCESS step and marks the run COMPLETED', async () => {
      const graph: AutomationGraph = { nodes: [{ id: 'end-1', type: 'end' }], edges: [] };

      vi.mocked(automationRepository.findExecutedStepRun).mockResolvedValue(null);
      vi.mocked(automationRepository.findRunByIdWithAutomation).mockResolvedValue(
        makeRun({ graphSnapshot: graph }) as any
      );

      await executeAutomationStep(makeJob({ runId: 'run-1', nodeId: 'end-1' }));

      expect(automationRepository.createStepRun).toHaveBeenCalledWith(
        expect.objectContaining({ nodeType: 'end', status: 'SUCCESS' })
      );
      expect(automationRepository.updateRun).toHaveBeenCalledWith('run-1', {
        status: 'COMPLETED',
        completedAt: expect.any(Date),
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

      vi.mocked(automationRepository.findExecutedStepRun).mockResolvedValue({ status: 'SUCCESS' } as any);

      await handler([
        makeJob({ runId: 'r1', nodeId: 'n1' }),
        makeJob({ runId: 'r2', nodeId: 'n2' }),
      ]);

      expect(automationRepository.findExecutedStepRun).toHaveBeenCalledTimes(2);
    });
  });
});
