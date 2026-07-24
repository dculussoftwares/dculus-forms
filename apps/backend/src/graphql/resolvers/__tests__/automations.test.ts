import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { automationsResolvers } from '../automations.js';
import { GraphQLError } from '#graphql-errors';
import * as betterAuthMiddleware from '../../../middleware/better-auth-middleware.js';
import * as formSharingResolvers from '../formSharing.js';
import * as pluginRegistry from '../../../plugins/core/registry.js';
import * as graphValidator from '../../../services/automation/graphValidator.js';
import * as engine from '../../../services/automation/engine.js';
import * as triggerService from '../../../services/automation/triggerService.js';
import { prisma } from '../../../lib/prisma.js';

vi.mock('../../../middleware/better-auth-middleware.js');
vi.mock('../formSharing.js');
vi.mock('../../../plugins/core/registry.js');
vi.mock('../../../services/automation/graphValidator.js');
vi.mock('../../../services/automation/engine.js');
vi.mock('../../../services/automation/triggerService.js');
vi.mock('../../../lib/prisma.js', () => ({
  prisma: {
    automation: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    automationRun: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    automationStepRun: {
      findMany: vi.fn(),
    },
    response: {
      findFirst: vi.fn(),
    },
  },
}));
vi.mock('../../../lib/logger.js', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));
vi.mock('@dculus/utils', async () => {
  const actual = await vi.importActual<typeof import('@dculus/utils')>('@dculus/utils');
  return {
    ...actual,
    generateId: vi.fn(() => 'generated-id'),
  };
});

describe('Automations Resolvers', () => {
  const mockContext = {
    auth: {
      user: { id: 'user-123', email: 'test@example.com', name: 'Test User' },
      session: { id: 'session-123' },
      isAuthenticated: true,
    },
  };

  const mockForm = {
    id: 'form-123',
    title: 'Test Form',
    organizationId: 'org-123',
    createdById: 'user-123',
  };

  const mockGraph = {
    nodes: [
      { id: 'trigger-1', type: 'trigger', data: { triggerType: 'form.submitted' } },
      { id: 'end-1', type: 'end' },
    ],
    edges: [{ id: 'e1', source: 'trigger-1', target: 'end-1' }],
  };

  const mockAutomation = {
    id: 'automation-123',
    formId: 'form-123',
    organizationId: 'org-123',
    name: 'Welcome flow',
    status: 'DRAFT',
    triggerType: 'form.submitted',
    triggerConfig: null,
    graph: mockGraph,
    version: 1,
    createdBy: 'user-123',
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(betterAuthMiddleware.requireAuth).mockReturnValue(mockContext.auth as any);
    vi.mocked(betterAuthMiddleware.requireOrganizationMembership).mockResolvedValue({
      role: 'member',
    } as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function grantAccess(permission: string = 'EDITOR') {
    vi.mocked(formSharingResolvers.checkFormAccess).mockResolvedValue({
      hasAccess: true,
      permission: permission as any,
      form: mockForm as any,
    });
  }

  function denyAccess() {
    vi.mocked(formSharingResolvers.checkFormAccess).mockResolvedValue({
      hasAccess: false,
      permission: 'NO_ACCESS' as any,
      form: mockForm as any,
    });
  }

  describe('Permission matrix', () => {
    it('formAutomations: allows VIEWER access to read', async () => {
      grantAccess('VIEWER');
      vi.mocked(prisma.automation.findMany).mockResolvedValue([mockAutomation] as any);

      const result = await automationsResolvers.Query.formAutomations(
        {},
        { formId: 'form-123' },
        mockContext
      );

      expect(formSharingResolvers.checkFormAccess).toHaveBeenCalledWith(
        'user-123',
        'form-123',
        formSharingResolvers.PermissionLevel.VIEWER
      );
      expect(result).toEqual([mockAutomation]);
    });

    it('formAutomations: throws 403-style error when user lacks any access', async () => {
      denyAccess();

      await expect(
        automationsResolvers.Query.formAutomations({}, { formId: 'form-123' }, mockContext)
      ).rejects.toThrow(GraphQLError);
      await expect(
        automationsResolvers.Query.formAutomations({}, { formId: 'form-123' }, mockContext)
      ).rejects.toThrow(/Access denied/);
    });

    it('formAutomations: throws when user is not authenticated', async () => {
      vi.mocked(betterAuthMiddleware.requireAuth).mockImplementation(() => {
        throw new GraphQLError('Authentication required');
      });

      await expect(
        automationsResolvers.Query.formAutomations({}, { formId: 'form-123' }, mockContext)
      ).rejects.toThrow('Authentication required');
    });

    it('formAutomations: throws when user is not an organization member', async () => {
      grantAccess('VIEWER');
      vi.mocked(betterAuthMiddleware.requireOrganizationMembership).mockImplementation(() => {
        throw new GraphQLError('Access denied: You are not a member of this organization');
      });

      await expect(
        automationsResolvers.Query.formAutomations({}, { formId: 'form-123' }, mockContext)
      ).rejects.toThrow('Access denied: You are not a member of this organization');
    });

    it('createAutomation: denies VIEWER-only access (mutation needs EDITOR+)', async () => {
      denyAccess();

      await expect(
        automationsResolvers.Mutation.createAutomation(
          {},
          { formId: 'form-123', name: 'Test', triggerType: 'form.submitted' },
          mockContext
        )
      ).rejects.toThrow(/Access denied/);
      expect(prisma.automation.create).not.toHaveBeenCalled();
    });

    it('createAutomation: allows EDITOR access to write', async () => {
      grantAccess('EDITOR');
      vi.mocked(prisma.automation.create).mockResolvedValue(mockAutomation as any);

      const result = await automationsResolvers.Mutation.createAutomation(
        {},
        { formId: 'form-123', name: 'Test', triggerType: 'form.submitted' },
        mockContext
      );

      expect(formSharingResolvers.checkFormAccess).toHaveBeenCalledWith(
        'user-123',
        'form-123',
        formSharingResolvers.PermissionLevel.EDITOR
      );
      expect(result).toEqual(mockAutomation);
    });

    it('automation: allows OWNER access to read', async () => {
      grantAccess('OWNER');
      vi.mocked(prisma.automation.findUnique).mockResolvedValue(mockAutomation as any);

      const result = await automationsResolvers.Query.automation(
        {},
        { id: 'automation-123' },
        mockContext
      );

      expect(result).toEqual(mockAutomation);
    });

    it('automation: throws AUTOMATION_NOT_FOUND when the automation does not exist', async () => {
      vi.mocked(prisma.automation.findUnique).mockResolvedValue(null);

      await expect(
        automationsResolvers.Query.automation({}, { id: 'missing' }, mockContext)
      ).rejects.toThrow('Automation not found');
    });
  });

  describe('Activation gate (setAutomationStatus)', () => {
    it('blocks activation and surfaces structured validation errors', async () => {
      grantAccess('EDITOR');
      vi.mocked(prisma.automation.findUnique).mockResolvedValue(mockAutomation as any);
      vi.mocked(pluginRegistry.getAvailablePluginTypes).mockReturnValue(['webhook', 'email']);
      const validationErrors = [
        { nodeId: 'action-1', code: 'UNKNOWN_ACTION_TYPE', message: 'unregistered action type' },
      ];
      vi.mocked(graphValidator.validateAutomationGraph).mockReturnValue({
        valid: false,
        errors: validationErrors,
      });

      await expect(
        automationsResolvers.Mutation.setAutomationStatus(
          {},
          { id: 'automation-123', status: 'ACTIVE' },
          mockContext
        )
      ).rejects.toThrow(GraphQLError);

      try {
        await automationsResolvers.Mutation.setAutomationStatus(
          {},
          { id: 'automation-123', status: 'ACTIVE' },
          mockContext
        );
        expect.unreachable('should have thrown');
      } catch (error: any) {
        expect(error.extensions.code).toBe('AUTOMATION_INVALID_GRAPH');
        expect(error.extensions.validationErrors).toEqual(validationErrors);
      }

      expect(prisma.automation.update).not.toHaveBeenCalled();
    });

    it('activates when the graph is valid', async () => {
      grantAccess('EDITOR');
      vi.mocked(prisma.automation.findUnique).mockResolvedValue(mockAutomation as any);
      vi.mocked(pluginRegistry.getAvailablePluginTypes).mockReturnValue(['webhook', 'email']);
      vi.mocked(graphValidator.validateAutomationGraph).mockReturnValue({ valid: true, errors: [] });
      vi.mocked(prisma.automation.update).mockResolvedValue({
        ...mockAutomation,
        status: 'ACTIVE',
      } as any);

      const result = await automationsResolvers.Mutation.setAutomationStatus(
        {},
        { id: 'automation-123', status: 'ACTIVE' },
        mockContext
      );

      expect(prisma.automation.update).toHaveBeenCalledWith({
        where: { id: 'automation-123' },
        data: { status: 'ACTIVE', updatedAt: expect.any(Date) },
      });
      expect(result.status).toBe('ACTIVE');
    });

    it('does not run graph validation when pausing', async () => {
      grantAccess('EDITOR');
      vi.mocked(prisma.automation.findUnique).mockResolvedValue({
        ...mockAutomation,
        status: 'ACTIVE',
      } as any);
      vi.mocked(prisma.automation.update).mockResolvedValue({
        ...mockAutomation,
        status: 'PAUSED',
      } as any);

      await automationsResolvers.Mutation.setAutomationStatus(
        {},
        { id: 'automation-123', status: 'PAUSED' },
        mockContext
      );

      expect(graphValidator.validateAutomationGraph).not.toHaveBeenCalled();
    });

    it('rejects unknown status values', async () => {
      grantAccess('EDITOR');
      vi.mocked(prisma.automation.findUnique).mockResolvedValue(mockAutomation as any);

      await expect(
        automationsResolvers.Mutation.setAutomationStatus(
          {},
          { id: 'automation-123', status: 'BOGUS' },
          mockContext
        )
      ).rejects.toThrow(/Invalid status/);
    });
  });

  describe('updateAutomation version bump', () => {
    it('bumps version when graph is provided', async () => {
      grantAccess('EDITOR');
      vi.mocked(prisma.automation.findUnique).mockResolvedValue(mockAutomation as any);
      const newGraph = { ...mockGraph, nodes: [...mockGraph.nodes] };
      vi.mocked(prisma.automation.update).mockResolvedValue({
        ...mockAutomation,
        graph: newGraph,
        version: 2,
      } as any);

      const result = await automationsResolvers.Mutation.updateAutomation(
        {},
        { id: 'automation-123', graph: newGraph },
        mockContext
      );

      expect(prisma.automation.update).toHaveBeenCalledWith({
        where: { id: 'automation-123' },
        data: {
          updatedAt: expect.any(Date),
          graph: newGraph,
          version: { increment: 1 },
        },
      });
      expect(result.version).toBe(2);
    });

    it('does not bump version when only name changes', async () => {
      grantAccess('EDITOR');
      vi.mocked(prisma.automation.findUnique).mockResolvedValue(mockAutomation as any);
      vi.mocked(prisma.automation.update).mockResolvedValue({
        ...mockAutomation,
        name: 'Renamed',
      } as any);

      await automationsResolvers.Mutation.updateAutomation(
        {},
        { id: 'automation-123', name: 'Renamed' },
        mockContext
      );

      expect(prisma.automation.update).toHaveBeenCalledWith({
        where: { id: 'automation-123' },
        data: { updatedAt: expect.any(Date), name: 'Renamed' },
      });
    });

    it('throws AUTOMATION_NOT_FOUND for a missing automation', async () => {
      vi.mocked(prisma.automation.findUnique).mockResolvedValue(null);

      await expect(
        automationsResolvers.Mutation.updateAutomation(
          {},
          { id: 'missing', name: 'x' },
          mockContext
        )
      ).rejects.toThrow('Automation not found');
    });
  });

  describe('deleteAutomation cancels runs', () => {
    it('cancels in-flight runs before deleting the automation', async () => {
      grantAccess('EDITOR');
      vi.mocked(prisma.automation.findUnique).mockResolvedValue(mockAutomation as any);
      vi.mocked(triggerService.cancelRunsForAutomation).mockResolvedValue(undefined as any);
      vi.mocked(prisma.automation.delete).mockResolvedValue(mockAutomation as any);

      const result = await automationsResolvers.Mutation.deleteAutomation(
        {},
        { id: 'automation-123' },
        mockContext
      );

      expect(triggerService.cancelRunsForAutomation).toHaveBeenCalledWith(
        'automation-123',
        expect.any(String)
      );
      const cancelOrder = vi.mocked(triggerService.cancelRunsForAutomation).mock
        .invocationCallOrder[0];
      const deleteOrder = vi.mocked(prisma.automation.delete).mock.invocationCallOrder[0];
      expect(cancelOrder).toBeLessThan(deleteOrder);
      expect(prisma.automation.delete).toHaveBeenCalledWith({ where: { id: 'automation-123' } });
      expect(result).toBe(true);
    });

    it('denies deletion without EDITOR+ access', async () => {
      denyAccess();
      vi.mocked(prisma.automation.findUnique).mockResolvedValue(mockAutomation as any);

      await expect(
        automationsResolvers.Mutation.deleteAutomation({}, { id: 'automation-123' }, mockContext)
      ).rejects.toThrow(/Access denied/);
      expect(triggerService.cancelRunsForAutomation).not.toHaveBeenCalled();
      expect(prisma.automation.delete).not.toHaveBeenCalled();
    });
  });

  describe('testAutomation', () => {
    const mockResponse = {
      id: 'response-1',
      formId: 'form-123',
      data: { field1: 'value1' },
      submittedAt: new Date('2026-01-02T00:00:00.000Z'),
    };

    it('uses the given responseId when provided', async () => {
      grantAccess('EDITOR');
      vi.mocked(prisma.automation.findUnique).mockResolvedValue(mockAutomation as any);
      vi.mocked(prisma.response.findFirst).mockResolvedValue(mockResponse as any);
      const createdRun = { id: 'run-1', automationId: 'automation-123', status: 'RUNNING' };
      vi.mocked(prisma.automationRun.create).mockResolvedValue(createdRun as any);
      vi.mocked(engine.enqueueFirstStep).mockResolvedValue(undefined as any);

      const result = await automationsResolvers.Mutation.testAutomation(
        {},
        { id: 'automation-123', responseId: 'response-1' },
        mockContext
      );

      expect(prisma.response.findFirst).toHaveBeenCalledWith({
        where: { id: 'response-1', formId: 'form-123', deletedAt: null },
      });
      expect(prisma.automationRun.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          automationId: 'automation-123',
          responseId: 'response-1',
          status: 'RUNNING',
          context: expect.objectContaining({
            test: true,
            triggerData: expect.objectContaining({ field1: 'value1', responseId: 'response-1' }),
          }),
        }),
      });
      expect(engine.enqueueFirstStep).toHaveBeenCalledWith(createdRun);
      expect(result).toEqual(createdRun);
    });

    it('falls back to the latest response when none is given', async () => {
      grantAccess('EDITOR');
      vi.mocked(prisma.automation.findUnique).mockResolvedValue(mockAutomation as any);
      vi.mocked(prisma.response.findFirst).mockResolvedValue(mockResponse as any);
      vi.mocked(prisma.automationRun.create).mockResolvedValue({ id: 'run-1' } as any);
      vi.mocked(engine.enqueueFirstStep).mockResolvedValue(undefined as any);

      await automationsResolvers.Mutation.testAutomation(
        {},
        { id: 'automation-123' },
        mockContext
      );

      expect(prisma.response.findFirst).toHaveBeenCalledWith({
        where: { formId: 'form-123', deletedAt: null },
        orderBy: { submittedAt: 'desc' },
      });
    });

    it('errors when the form has no responses', async () => {
      grantAccess('EDITOR');
      vi.mocked(prisma.automation.findUnique).mockResolvedValue(mockAutomation as any);
      vi.mocked(prisma.response.findFirst).mockResolvedValue(null);

      await expect(
        automationsResolvers.Mutation.testAutomation({}, { id: 'automation-123' }, mockContext)
      ).rejects.toThrow(/No response available/);
      expect(prisma.automationRun.create).not.toHaveBeenCalled();
    });
  });

  describe('cancelAutomationRun', () => {
    it('cancels a running run', async () => {
      grantAccess('EDITOR');
      const run = { id: 'run-1', automation: mockAutomation };
      vi.mocked(prisma.automationRun.findUnique).mockResolvedValue(run as any);
      const cancelled = { id: 'run-1', status: 'CANCELLED' };
      vi.mocked(triggerService.cancelSingleAutomationRun).mockResolvedValue(cancelled as any);

      const result = await automationsResolvers.Mutation.cancelAutomationRun(
        {},
        { runId: 'run-1' },
        mockContext
      );

      expect(triggerService.cancelSingleAutomationRun).toHaveBeenCalledWith('run-1');
      expect(result).toEqual(cancelled);
    });

    it('throws when the run does not exist', async () => {
      vi.mocked(prisma.automationRun.findUnique).mockResolvedValue(null);

      await expect(
        automationsResolvers.Mutation.cancelAutomationRun({}, { runId: 'missing' }, mockContext)
      ).rejects.toThrow('Automation run not found');
    });
  });

  describe('Field resolvers', () => {
    it('AutomationRun.stepRuns fetches step runs for the parent run', async () => {
      const stepRuns = [{ id: 'step-1', nodeId: 'trigger-1' }];
      vi.mocked(prisma.automationStepRun.findMany).mockResolvedValue(stepRuns as any);

      const result = await automationsResolvers.AutomationRun.stepRuns({ id: 'run-1' } as any);

      expect(prisma.automationStepRun.findMany).toHaveBeenCalledWith({
        where: { runId: 'run-1' },
        orderBy: { startedAt: 'asc' },
      });
      expect(result).toEqual(stepRuns);
    });

    it('Automation.createdAt formats a Date to ISO string', () => {
      const result = automationsResolvers.Automation.createdAt({
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
      } as any);
      expect(result).toBe('2026-01-01T00:00:00.000Z');
    });
  });
});
