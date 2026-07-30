import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { automationsResolvers } from '../automations.js';
import { GraphQLError } from '#graphql-errors';
import * as betterAuthMiddleware from '../../../middleware/better-auth-middleware.js';
import * as formSharingResolvers from '../formSharing.js';
import * as automationService from '../../../services/automationService.js';

vi.mock('../../../middleware/better-auth-middleware.js');
vi.mock('../formSharing.js');
vi.mock('../../../services/automationService.js');

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
      vi.mocked(automationService.listAutomationsByForm).mockResolvedValue([mockAutomation] as any);

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
      expect(automationService.listAutomationsByForm).toHaveBeenCalledWith('form-123');
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
      expect(automationService.createAutomation).not.toHaveBeenCalled();
    });

    it('createAutomation: allows EDITOR access to write', async () => {
      grantAccess('EDITOR');
      vi.mocked(automationService.createAutomation).mockResolvedValue(mockAutomation as any);

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
      expect(automationService.createAutomation).toHaveBeenCalledWith({
        formId: 'form-123',
        organizationId: 'org-123',
        name: 'Test',
        triggerType: 'form.submitted',
        createdBy: 'user-123',
      });
      expect(result).toEqual(mockAutomation);
    });

    it('automation: allows OWNER access to read', async () => {
      grantAccess('OWNER');
      vi.mocked(automationService.getAutomationById).mockResolvedValue(mockAutomation as any);

      const result = await automationsResolvers.Query.automation(
        {},
        { id: 'automation-123' },
        mockContext
      );

      expect(result).toEqual(mockAutomation);
    });

    it('automation: throws AUTOMATION_NOT_FOUND when the automation does not exist', async () => {
      vi.mocked(automationService.getAutomationById).mockRejectedValue(
        new GraphQLError('Automation not found')
      );

      await expect(
        automationsResolvers.Query.automation({}, { id: 'missing' }, mockContext)
      ).rejects.toThrow('Automation not found');
    });

    it('automation: checks auth before looking up the automation', async () => {
      vi.mocked(betterAuthMiddleware.requireAuth).mockImplementation(() => {
        throw new GraphQLError('Authentication required');
      });

      await expect(
        automationsResolvers.Query.automation({}, { id: 'automation-123' }, mockContext)
      ).rejects.toThrow('Authentication required');
      expect(automationService.getAutomationById).not.toHaveBeenCalled();
    });
  });

  describe('updateAutomation / setAutomationStatus / deleteAutomation / testAutomation orchestration', () => {
    it('updateAutomation: fetches the automation, checks EDITOR access, then delegates to the service', async () => {
      grantAccess('EDITOR');
      vi.mocked(automationService.getAutomationById).mockResolvedValue(mockAutomation as any);
      const updated = { ...mockAutomation, name: 'Renamed' };
      vi.mocked(automationService.updateAutomation).mockResolvedValue(updated as any);

      const result = await automationsResolvers.Mutation.updateAutomation(
        {},
        { id: 'automation-123', name: 'Renamed' },
        mockContext
      );

      expect(automationService.getAutomationById).toHaveBeenCalledWith('automation-123');
      expect(automationService.updateAutomation).toHaveBeenCalledWith(mockAutomation, {
        name: 'Renamed',
        graph: undefined,
        triggerConfig: undefined,
      });
      expect(result).toEqual(updated);
    });

    it('updateAutomation: denies without EDITOR+ access', async () => {
      denyAccess();
      vi.mocked(automationService.getAutomationById).mockResolvedValue(mockAutomation as any);

      await expect(
        automationsResolvers.Mutation.updateAutomation(
          {},
          { id: 'automation-123', name: 'x' },
          mockContext
        )
      ).rejects.toThrow(/Access denied/);
      expect(automationService.updateAutomation).not.toHaveBeenCalled();
    });

    it('setAutomationStatus: fetches the automation, checks EDITOR access, then delegates to the service', async () => {
      grantAccess('EDITOR');
      vi.mocked(automationService.getAutomationById).mockResolvedValue(mockAutomation as any);
      const updated = { ...mockAutomation, status: 'ACTIVE' };
      vi.mocked(automationService.setAutomationStatus).mockResolvedValue(updated as any);

      const result = await automationsResolvers.Mutation.setAutomationStatus(
        {},
        { id: 'automation-123', status: 'ACTIVE' },
        mockContext
      );

      expect(automationService.setAutomationStatus).toHaveBeenCalledWith(mockAutomation, 'ACTIVE');
      expect(result).toEqual(updated);
    });

    it('setAutomationStatus: denies without EDITOR+ access', async () => {
      denyAccess();
      vi.mocked(automationService.getAutomationById).mockResolvedValue(mockAutomation as any);

      await expect(
        automationsResolvers.Mutation.setAutomationStatus(
          {},
          { id: 'automation-123', status: 'ACTIVE' },
          mockContext
        )
      ).rejects.toThrow(/Access denied/);
      expect(automationService.setAutomationStatus).not.toHaveBeenCalled();
    });

    it('deleteAutomation: fetches the automation, checks EDITOR access, then delegates to the service', async () => {
      grantAccess('EDITOR');
      vi.mocked(automationService.getAutomationById).mockResolvedValue(mockAutomation as any);
      vi.mocked(automationService.deleteAutomation).mockResolvedValue(true);

      const result = await automationsResolvers.Mutation.deleteAutomation(
        {},
        { id: 'automation-123' },
        mockContext
      );

      expect(automationService.deleteAutomation).toHaveBeenCalledWith(mockAutomation);
      expect(result).toBe(true);
    });

    it('deleteAutomation: denies without EDITOR+ access', async () => {
      denyAccess();
      vi.mocked(automationService.getAutomationById).mockResolvedValue(mockAutomation as any);

      await expect(
        automationsResolvers.Mutation.deleteAutomation({}, { id: 'automation-123' }, mockContext)
      ).rejects.toThrow(/Access denied/);
      expect(automationService.deleteAutomation).not.toHaveBeenCalled();
    });

    it('testAutomation: fetches the automation, checks EDITOR access, then delegates to the service', async () => {
      grantAccess('EDITOR');
      vi.mocked(automationService.getAutomationById).mockResolvedValue(mockAutomation as any);
      const createdRun = { id: 'run-1', automationId: 'automation-123', status: 'RUNNING' };
      vi.mocked(automationService.testAutomation).mockResolvedValue(createdRun as any);

      const result = await automationsResolvers.Mutation.testAutomation(
        {},
        { id: 'automation-123', responseId: 'response-1' },
        mockContext
      );

      expect(automationService.testAutomation).toHaveBeenCalledWith(mockAutomation, 'response-1');
      expect(result).toEqual(createdRun);
    });

    it('testAutomation: denies without EDITOR+ access', async () => {
      denyAccess();
      vi.mocked(automationService.getAutomationById).mockResolvedValue(mockAutomation as any);

      await expect(
        automationsResolvers.Mutation.testAutomation({}, { id: 'automation-123' }, mockContext)
      ).rejects.toThrow(/Access denied/);
      expect(automationService.testAutomation).not.toHaveBeenCalled();
    });

    it('testAutomation: surfaces a RESPONSE_NOT_FOUND-style error from the service', async () => {
      grantAccess('EDITOR');
      vi.mocked(automationService.getAutomationById).mockResolvedValue(mockAutomation as any);
      vi.mocked(automationService.testAutomation).mockRejectedValue(
        new GraphQLError('No response available to test this automation with')
      );

      await expect(
        automationsResolvers.Mutation.testAutomation({}, { id: 'automation-123' }, mockContext)
      ).rejects.toThrow(/No response available/);
    });
  });

  describe('automationRuns / automationRun queries', () => {
    it('automationRuns: fetches the automation for access, then lists runs via the service', async () => {
      grantAccess('VIEWER');
      vi.mocked(automationService.getAutomationById).mockResolvedValue(mockAutomation as any);
      const runs = [{ id: 'run-1' }];
      vi.mocked(automationService.listAutomationRuns).mockResolvedValue(runs as any);

      const result = await automationsResolvers.Query.automationRuns(
        {},
        { automationId: 'automation-123', limit: 10, offset: 5 },
        mockContext
      );

      expect(automationService.listAutomationRuns).toHaveBeenCalledWith('automation-123', 10, 5);
      expect(result).toEqual(runs);
    });

    it('automationRun: fetches the run with its automation, checks access, and returns it', async () => {
      grantAccess('VIEWER');
      const run = { id: 'run-1', automation: mockAutomation };
      vi.mocked(automationService.getAutomationRunWithAutomation).mockResolvedValue(run as any);

      const result = await automationsResolvers.Query.automationRun(
        {},
        { id: 'run-1' },
        mockContext
      );

      expect(automationService.getAutomationRunWithAutomation).toHaveBeenCalledWith('run-1');
      expect(result).toEqual(run);
    });

    it('automationRun: propagates a NOT_FOUND-style error from the service', async () => {
      vi.mocked(automationService.getAutomationRunWithAutomation).mockRejectedValue(
        new GraphQLError('Automation run not found')
      );

      await expect(
        automationsResolvers.Query.automationRun({}, { id: 'missing' }, mockContext)
      ).rejects.toThrow('Automation run not found');
    });
  });

  describe('cancelAutomationRun', () => {
    it('cancels a running run', async () => {
      grantAccess('EDITOR');
      const run = { id: 'run-1', automation: mockAutomation };
      vi.mocked(automationService.getAutomationRunWithAutomation).mockResolvedValue(run as any);
      const cancelled = { id: 'run-1', status: 'CANCELLED' };
      vi.mocked(automationService.cancelAutomationRun).mockResolvedValue(cancelled as any);

      const result = await automationsResolvers.Mutation.cancelAutomationRun(
        {},
        { runId: 'run-1' },
        mockContext
      );

      expect(automationService.cancelAutomationRun).toHaveBeenCalledWith('run-1');
      expect(result).toEqual(cancelled);
    });

    it('throws when the run does not exist', async () => {
      vi.mocked(automationService.getAutomationRunWithAutomation).mockRejectedValue(
        new GraphQLError('Automation run not found')
      );

      await expect(
        automationsResolvers.Mutation.cancelAutomationRun({}, { runId: 'missing' }, mockContext)
      ).rejects.toThrow('Automation run not found');
    });

    it('denies without EDITOR+ access', async () => {
      denyAccess();
      const run = { id: 'run-1', automation: mockAutomation };
      vi.mocked(automationService.getAutomationRunWithAutomation).mockResolvedValue(run as any);

      await expect(
        automationsResolvers.Mutation.cancelAutomationRun({}, { runId: 'run-1' }, mockContext)
      ).rejects.toThrow(/Access denied/);
      expect(automationService.cancelAutomationRun).not.toHaveBeenCalled();
    });
  });

  describe('Field resolvers', () => {
    it('AutomationRun.stepRuns fetches step runs for the parent run via the service', async () => {
      const stepRuns = [{ id: 'step-1', nodeId: 'trigger-1' }];
      vi.mocked(automationService.listStepRuns).mockResolvedValue(stepRuns as any);

      const result = await automationsResolvers.AutomationRun.stepRuns({ id: 'run-1' } as any);

      expect(automationService.listStepRuns).toHaveBeenCalledWith('run-1');
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
