import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GraphQLError } from '#graphql-errors';
import {
  getAutomationById,
  listAutomationsByForm,
  createAutomation,
  updateAutomation,
  setAutomationStatus,
  deleteAutomation,
  testAutomation,
  listAutomationRuns,
  getAutomationRunWithAutomation,
  cancelAutomationRun,
  retryAutomationRun,
  listStepRuns,
} from '../automationService.js';
import { automationRepository, responseRepository } from '../../repositories/index.js';
import { getAvailablePluginTypes } from '../../plugins/core/registry.js';
import { validateAutomationGraph } from '../automation/graphValidator.js';
import { enqueueFirstStep, enqueueRunStep } from '../automation/engine.js';
import { isAutomationEngineEnabled } from '../automation/boss.js';
import {
  cancelRunsForAutomation,
  cancelSingleAutomationRun,
  scheduleAutomationCron,
  unscheduleAutomationCron,
} from '../automation/triggerService.js';
import { generateId } from '@dculus/utils';

vi.mock('../../repositories/index.js');
vi.mock('../../plugins/core/registry.js');
vi.mock('../automation/graphValidator.js');
vi.mock('../automation/engine.js');
vi.mock('../automation/triggerService.js');
vi.mock('../automation/boss.js', () => ({ isAutomationEngineEnabled: vi.fn(() => true) }));
vi.mock('@dculus/utils', async () => {
  const actual = await vi.importActual<typeof import('@dculus/utils')>('@dculus/utils');
  return { ...actual, generateId: vi.fn() };
});

describe('automationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    let idCounter = 0;
    vi.mocked(generateId).mockImplementation(() => `generated-${++idCounter}`);
    vi.mocked(getAvailablePluginTypes).mockReturnValue(['webhook', 'email']);
  });

  describe('getAutomationById', () => {
    it('returns the automation when found', async () => {
      const automation = { id: 'automation-1', formId: 'form-1' };
      vi.mocked(automationRepository.findById).mockResolvedValue(automation as any);

      const result = await getAutomationById('automation-1');

      expect(automationRepository.findById).toHaveBeenCalledWith('automation-1');
      expect(result).toEqual(automation);
    });

    it('throws AUTOMATION_NOT_FOUND when missing', async () => {
      vi.mocked(automationRepository.findById).mockResolvedValue(null);

      await expect(getAutomationById('missing')).rejects.toThrow(GraphQLError);
      await expect(getAutomationById('missing')).rejects.toThrow('Automation not found');
    });
  });

  describe('listAutomationsByForm', () => {
    it('delegates to the repository', async () => {
      const automations = [{ id: 'automation-1' }];
      vi.mocked(automationRepository.listByFormId).mockResolvedValue(automations as any);

      const result = await listAutomationsByForm('form-1');

      expect(automationRepository.listByFormId).toHaveBeenCalledWith('form-1');
      expect(result).toEqual(automations);
    });
  });

  describe('createAutomation', () => {
    it('rejects an empty/whitespace name', async () => {
      await expect(
        createAutomation({
          formId: 'form-1',
          organizationId: 'org-1',
          name: '   ',
          triggerType: 'form.submitted',
          createdBy: 'user-1',
        })
      ).rejects.toThrow('Automation name is required');
      expect(automationRepository.createAutomation).not.toHaveBeenCalled();
    });

    it('rejects an unsupported trigger type', async () => {
      await expect(
        createAutomation({
          formId: 'form-1',
          organizationId: 'org-1',
          name: 'Test',
          triggerType: 'bogus',
          createdBy: 'user-1',
        })
      ).rejects.toThrow(/Invalid trigger type/);
      expect(automationRepository.createAutomation).not.toHaveBeenCalled();
    });

    it('creates a DRAFT automation with a default trigger->end graph', async () => {
      vi.mocked(automationRepository.createAutomation).mockResolvedValue({ id: 'automation-1' } as any);

      const result = await createAutomation({
        formId: 'form-1',
        organizationId: 'org-1',
        name: 'Welcome flow',
        triggerType: 'form.submitted',
        createdBy: 'user-1',
      });

      expect(automationRepository.createAutomation).toHaveBeenCalledWith(
        expect.objectContaining({
          formId: 'form-1',
          organizationId: 'org-1',
          name: 'Welcome flow',
          status: 'DRAFT',
          triggerType: 'form.submitted',
          version: 1,
          createdBy: 'user-1',
          graph: expect.objectContaining({
            nodes: [
              expect.objectContaining({ type: 'trigger', data: { triggerType: 'form.submitted' } }),
              expect.objectContaining({ type: 'end' }),
            ],
            edges: expect.any(Array),
          }),
        })
      );
      expect(result).toEqual({ id: 'automation-1' });
    });

    it('creates a DRAFT schedule automation with a default trigger->digest->end graph', async () => {
      vi.mocked(automationRepository.createAutomation).mockResolvedValue({ id: 'automation-2' } as any);

      await createAutomation({
        formId: 'form-1',
        organizationId: 'org-1',
        name: 'Weekly digest',
        triggerType: 'schedule',
        createdBy: 'user-1',
      });

      expect(automationRepository.createAutomation).toHaveBeenCalledWith(
        expect.objectContaining({
          triggerType: 'schedule',
          graph: expect.objectContaining({
            nodes: [
              expect.objectContaining({ type: 'trigger', data: { triggerType: 'schedule' } }),
              expect.objectContaining({ type: 'digest', data: {} }),
              expect.objectContaining({ type: 'end' }),
            ],
            edges: expect.any(Array),
          }),
        })
      );
    });
  });

  describe('updateAutomation', () => {
    const baseAutomation = {
      id: 'automation-1',
      status: 'DRAFT',
      triggerType: 'form.submitted',
      graph: { nodes: [], edges: [] },
    };

    it('updates only name, without bumping version', async () => {
      vi.mocked(automationRepository.updateAutomation).mockResolvedValue({
        ...baseAutomation,
        name: 'Renamed',
      } as any);

      await updateAutomation(baseAutomation, { name: 'Renamed' });

      expect(automationRepository.updateAutomation).toHaveBeenCalledWith('automation-1', {
        updatedAt: expect.any(Date),
        name: 'Renamed',
      });
    });

    it('bumps version when the graph actually changes', async () => {
      const newGraph = { nodes: [{ id: 'n1', type: 'end' }], edges: [] };
      vi.mocked(automationRepository.updateAutomation).mockResolvedValue({
        ...baseAutomation,
        graph: newGraph,
      } as any);

      await updateAutomation(baseAutomation, { graph: newGraph });

      expect(automationRepository.updateAutomation).toHaveBeenCalledWith('automation-1', {
        updatedAt: expect.any(Date),
        graph: newGraph,
        version: { increment: 1 },
      });
    });

    it('does not bump version when the resubmitted graph is unchanged', async () => {
      const sameGraph = JSON.parse(JSON.stringify(baseAutomation.graph));
      vi.mocked(automationRepository.updateAutomation).mockResolvedValue(baseAutomation as any);

      await updateAutomation(baseAutomation, { graph: sameGraph });

      expect(automationRepository.updateAutomation).toHaveBeenCalledWith('automation-1', {
        updatedAt: expect.any(Date),
        graph: sameGraph,
      });
    });

    it('validates the graph when the automation is ACTIVE and rejects an invalid one before writing', async () => {
      const activeAutomation = { ...baseAutomation, status: 'ACTIVE' };
      const validationErrors = [{ nodeId: 'n1', code: 'UNKNOWN_ACTION_TYPE', message: 'bad' }];
      vi.mocked(validateAutomationGraph).mockReturnValue({ valid: false, errors: validationErrors });

      await expect(
        updateAutomation(activeAutomation, { graph: { nodes: [], edges: [] } })
      ).rejects.toThrow(GraphQLError);
      expect(automationRepository.updateAutomation).not.toHaveBeenCalled();
    });

    it('allows a valid graph on an ACTIVE automation', async () => {
      const activeAutomation = { ...baseAutomation, status: 'ACTIVE' };
      const newGraph = { nodes: [{ id: 'n1', type: 'end' }], edges: [] };
      vi.mocked(validateAutomationGraph).mockReturnValue({ valid: true, errors: [] });
      vi.mocked(automationRepository.updateAutomation).mockResolvedValue({
        ...activeAutomation,
        graph: newGraph,
      } as any);

      await updateAutomation(activeAutomation, { graph: newGraph });

      expect(automationRepository.updateAutomation).toHaveBeenCalled();
    });

    it('does not validate the graph when the automation is DRAFT', async () => {
      vi.mocked(automationRepository.updateAutomation).mockResolvedValue(baseAutomation as any);

      await updateAutomation(baseAutomation, { graph: { nodes: [], edges: [] } });

      expect(validateAutomationGraph).not.toHaveBeenCalled();
    });

    it('validates triggerConfig for a schedule automation and rejects a bad cron', async () => {
      const scheduleAutomation = { ...baseAutomation, triggerType: 'schedule' };

      await expect(
        updateAutomation(scheduleAutomation, { triggerConfig: { cron: 'nonsense' } })
      ).rejects.toThrow(/Invalid cron expression/);
      expect(automationRepository.updateAutomation).not.toHaveBeenCalled();
    });

    it('rejects an invalid timezone for a schedule automation', async () => {
      const scheduleAutomation = { ...baseAutomation, triggerType: 'schedule' };

      await expect(
        updateAutomation(scheduleAutomation, {
          triggerConfig: { cron: '0 9 * * *', timezone: 'Not/AZone' },
        })
      ).rejects.toThrow(/Invalid timezone/);
    });

    it('does not validate triggerConfig for a non-schedule automation', async () => {
      vi.mocked(automationRepository.updateAutomation).mockResolvedValue(baseAutomation as any);

      await updateAutomation(baseAutomation, { triggerConfig: { anything: 'goes' } });

      expect(automationRepository.updateAutomation).toHaveBeenCalledWith('automation-1', {
        updatedAt: expect.any(Date),
        triggerConfig: { anything: 'goes' },
      });
    });

    it('re-schedules the cron when an ACTIVE schedule automation changes triggerConfig', async () => {
      const activeSchedule = { ...baseAutomation, triggerType: 'schedule' };
      vi.mocked(automationRepository.updateAutomation).mockResolvedValue({
        ...activeSchedule,
        status: 'ACTIVE',
      } as any);

      await updateAutomation(activeSchedule, {
        triggerConfig: { cron: '0 9 * * *', timezone: 'America/Chicago' },
      });

      expect(scheduleAutomationCron).toHaveBeenCalledWith('automation-1', '0 9 * * *', 'America/Chicago');
    });

    it('does not re-schedule when the updated automation is not ACTIVE', async () => {
      const scheduleAutomation = { ...baseAutomation, triggerType: 'schedule' };
      vi.mocked(automationRepository.updateAutomation).mockResolvedValue({
        ...scheduleAutomation,
        status: 'DRAFT',
      } as any);

      await updateAutomation(scheduleAutomation, { triggerConfig: { cron: '0 9 * * *' } });

      expect(scheduleAutomationCron).not.toHaveBeenCalled();
    });

    it('does not re-schedule when triggerConfig is not part of this update', async () => {
      const activeSchedule = { ...baseAutomation, triggerType: 'schedule', status: 'ACTIVE' };
      vi.mocked(automationRepository.updateAutomation).mockResolvedValue(activeSchedule as any);

      await updateAutomation(activeSchedule, { name: 'Renamed' });

      expect(scheduleAutomationCron).not.toHaveBeenCalled();
    });
  });

  describe('createAutomation with a template', () => {
    beforeEach(() => {
      vi.mocked(automationRepository.createAutomation).mockResolvedValue({ id: 'automation-1' } as any);
    });

    // A follow-up email only makes sense on a submission and a digest only on a schedule, so the
    // template's trigger must win over whatever the dialog last had selected.
    it('pins the trigger from the template, overriding the argument', async () => {
      await createAutomation({
        formId: 'form-1',
        organizationId: 'org-1',
        name: 'Weekly summary',
        triggerType: 'form.submitted',
        template: 'weekly-digest',
        createdBy: 'user-1',
      });

      expect(automationRepository.createAutomation).toHaveBeenCalledWith(
        expect.objectContaining({ triggerType: 'schedule' })
      );
    });

    it('builds the template graph rather than the empty default', async () => {
      await createAutomation({
        formId: 'form-1',
        organizationId: 'org-1',
        name: 'Confirmation',
        triggerType: 'form.submitted',
        template: 'confirmation-email',
        createdBy: 'user-1',
      });

      const [data] = vi.mocked(automationRepository.createAutomation).mock.calls[0];
      const nodes = (data as any).graph.nodes;
      expect(nodes.some((n: any) => n.type === 'action' && n.data.actionType === 'email')).toBe(true);
    });

    it('rejects an unknown template id instead of silently falling back to blank', async () => {
      await expect(
        createAutomation({
          formId: 'form-1',
          organizationId: 'org-1',
          name: 'X',
          triggerType: 'form.submitted',
          template: 'not-a-template',
          createdBy: 'user-1',
        })
      ).rejects.toThrow(/Unknown automation template/);
      expect(automationRepository.createAutomation).not.toHaveBeenCalled();
    });

    it('still honours the triggerType argument with no template', async () => {
      await createAutomation({
        formId: 'form-1',
        organizationId: 'org-1',
        name: 'Blank',
        triggerType: 'response.edited',
        createdBy: 'user-1',
      });

      expect(automationRepository.createAutomation).toHaveBeenCalledWith(
        expect.objectContaining({ triggerType: 'response.edited' })
      );
    });
  });

  describe('setAutomationStatus', () => {
    const automation = {
      id: 'automation-1',
      triggerType: 'form.submitted',
      graph: { nodes: [], edges: [] },
      triggerConfig: null,
    };

    it('rejects an unknown status', async () => {
      await expect(setAutomationStatus(automation, 'BOGUS')).rejects.toThrow(/Invalid status/);
      expect(automationRepository.updateAutomation).not.toHaveBeenCalled();
    });

    it('validates the graph before activating and blocks on failure', async () => {
      const validationErrors = [{ nodeId: 'n1', code: 'UNKNOWN_ACTION_TYPE', message: 'bad' }];
      vi.mocked(validateAutomationGraph).mockReturnValue({ valid: false, errors: validationErrors });

      await expect(setAutomationStatus(automation, 'ACTIVE')).rejects.toThrow(GraphQLError);
      expect(automationRepository.updateAutomation).not.toHaveBeenCalled();
    });

    it('activates when the graph is valid (non-schedule automation touches no scheduling calls)', async () => {
      vi.mocked(validateAutomationGraph).mockReturnValue({ valid: true, errors: [] });
      vi.mocked(automationRepository.updateAutomation).mockResolvedValue({
        ...automation,
        status: 'ACTIVE',
      } as any);

      const result = await setAutomationStatus(automation, 'ACTIVE');

      expect(automationRepository.updateAutomation).toHaveBeenCalledWith('automation-1', {
        status: 'ACTIVE',
        updatedAt: expect.any(Date),
      });
      expect(scheduleAutomationCron).not.toHaveBeenCalled();
      expect(unscheduleAutomationCron).not.toHaveBeenCalled();
      expect(result.status).toBe('ACTIVE');
    });

    // Without this the digest node's first tick has no lower bound and matches the form's entire
    // history — switching on a weekly digest against an established form would process, and with a
    // per-response email action email, every response ever submitted.
    describe('digest watermark seeding on activation', () => {
      const scheduleAutomation = {
        id: 'automation-1',
        triggerType: 'schedule',
        graph: { nodes: [{ id: 'd1', type: 'digest', data: {} }], edges: [] },
        triggerConfig: { cron: '0 9 * * 1' },
        lastDigestedAt: null,
      };

      beforeEach(() => {
        vi.mocked(validateAutomationGraph).mockReturnValue({ valid: true, errors: [] });
        vi.mocked(automationRepository.updateAutomation).mockResolvedValue({
          ...scheduleAutomation,
          status: 'ACTIVE',
        } as any);
      });

      it('seeds the watermark to now so the first run covers only responses submitted after activation', async () => {
        await setAutomationStatus(scheduleAutomation, 'ACTIVE');

        expect(automationRepository.updateAutomation).toHaveBeenCalledWith(
          'automation-1',
          expect.objectContaining({ status: 'ACTIVE', lastDigestedAt: expect.any(Date) })
        );
      });

      it('leaves the watermark unset when the node opts into including existing responses', async () => {
        await setAutomationStatus(
          {
            ...scheduleAutomation,
            graph: { nodes: [{ id: 'd1', type: 'digest', data: { includeExistingResponses: true } }], edges: [] },
          },
          'ACTIVE'
        );

        expect(automationRepository.updateAutomation).toHaveBeenCalledWith(
          'automation-1',
          expect.not.objectContaining({ lastDigestedAt: expect.anything() })
        );
      });

      it('never re-seeds an automation that already has a watermark, so pause/reactivate cannot skip a window', async () => {
        await setAutomationStatus(
          { ...scheduleAutomation, lastDigestedAt: new Date('2026-02-01T00:00:00.000Z') },
          'ACTIVE'
        );

        expect(automationRepository.updateAutomation).toHaveBeenCalledWith(
          'automation-1',
          expect.not.objectContaining({ lastDigestedAt: expect.anything() })
        );
      });

      it('does not seed a watermark on a schedule automation with no digest node', async () => {
        await setAutomationStatus({ ...scheduleAutomation, graph: { nodes: [], edges: [] } }, 'ACTIVE');

        expect(automationRepository.updateAutomation).toHaveBeenCalledWith(
          'automation-1',
          expect.not.objectContaining({ lastDigestedAt: expect.anything() })
        );
      });
    });

    it('does not validate the graph when pausing', async () => {
      vi.mocked(automationRepository.updateAutomation).mockResolvedValue({
        ...automation,
        status: 'PAUSED',
      } as any);

      await setAutomationStatus(automation, 'PAUSED');

      expect(validateAutomationGraph).not.toHaveBeenCalled();
    });

    it('validates triggerConfig before activating a schedule automation', async () => {
      const scheduleAutomation = { ...automation, triggerType: 'schedule', triggerConfig: null };
      vi.mocked(validateAutomationGraph).mockReturnValue({ valid: true, errors: [] });

      await expect(setAutomationStatus(scheduleAutomation, 'ACTIVE')).rejects.toThrow(/triggerConfig/);
      expect(automationRepository.updateAutomation).not.toHaveBeenCalled();
      expect(scheduleAutomationCron).not.toHaveBeenCalled();
    });

    it('schedules the cron when activating a valid schedule automation', async () => {
      const scheduleAutomation = {
        ...automation,
        triggerType: 'schedule',
        triggerConfig: { cron: '0 9 * * *', timezone: 'America/Chicago' },
      };
      vi.mocked(validateAutomationGraph).mockReturnValue({ valid: true, errors: [] });
      vi.mocked(automationRepository.updateAutomation).mockResolvedValue({
        ...scheduleAutomation,
        status: 'ACTIVE',
      } as any);

      await setAutomationStatus(scheduleAutomation, 'ACTIVE');

      expect(scheduleAutomationCron).toHaveBeenCalledWith('automation-1', '0 9 * * *', 'America/Chicago');
      expect(unscheduleAutomationCron).not.toHaveBeenCalled();
    });

    it('unschedules the cron when pausing a schedule automation', async () => {
      const scheduleAutomation = { ...automation, triggerType: 'schedule' };
      vi.mocked(automationRepository.updateAutomation).mockResolvedValue({
        ...scheduleAutomation,
        status: 'PAUSED',
      } as any);

      await setAutomationStatus(scheduleAutomation, 'PAUSED');

      expect(unscheduleAutomationCron).toHaveBeenCalledWith('automation-1');
      expect(scheduleAutomationCron).not.toHaveBeenCalled();
    });
  });

  describe('deleteAutomation', () => {
    it('unschedules, cancels runs, then deletes a schedule automation, in that order', async () => {
      vi.mocked(unscheduleAutomationCron).mockResolvedValue(undefined as any);
      vi.mocked(cancelRunsForAutomation).mockResolvedValue(undefined as any);
      vi.mocked(automationRepository.deleteAutomation).mockResolvedValue({} as any);

      const result = await deleteAutomation({ id: 'automation-1', triggerType: 'schedule' });

      expect(unscheduleAutomationCron).toHaveBeenCalledWith('automation-1');
      expect(cancelRunsForAutomation).toHaveBeenCalledWith('automation-1', 'automation deleted');
      expect(automationRepository.deleteAutomation).toHaveBeenCalledWith('automation-1');

      const unscheduleOrder = vi.mocked(unscheduleAutomationCron).mock.invocationCallOrder[0];
      const cancelOrder = vi.mocked(cancelRunsForAutomation).mock.invocationCallOrder[0];
      const deleteOrder = vi.mocked(automationRepository.deleteAutomation).mock.invocationCallOrder[0];
      expect(unscheduleOrder).toBeLessThan(cancelOrder);
      expect(cancelOrder).toBeLessThan(deleteOrder);
      expect(result).toBe(true);
    });

    it('does not unschedule for a non-schedule automation', async () => {
      vi.mocked(cancelRunsForAutomation).mockResolvedValue(undefined as any);
      vi.mocked(automationRepository.deleteAutomation).mockResolvedValue({} as any);

      await deleteAutomation({ id: 'automation-1', triggerType: 'form.submitted' });

      expect(unscheduleAutomationCron).not.toHaveBeenCalled();
      expect(cancelRunsForAutomation).toHaveBeenCalledWith('automation-1', 'automation deleted');
    });
  });

  describe('testAutomation', () => {
    const automation = {
      id: 'automation-1',
      formId: 'form-1',
      version: 2,
      graph: { nodes: [], edges: [] },
      triggerType: 'form.submitted',
    };
    const mockResponse = {
      id: 'response-1',
      formId: 'form-1',
      data: { field1: 'value1' },
      submittedAt: new Date('2026-01-02T00:00:00.000Z'),
    };

    it('uses the given responseId when provided', async () => {
      vi.mocked(responseRepository.findFirst).mockResolvedValue(mockResponse as any);
      const createdRun = { id: 'run-1' };
      vi.mocked(automationRepository.createRun).mockResolvedValue(createdRun as any);
      vi.mocked(enqueueFirstStep).mockResolvedValue(undefined as any);

      const result = await testAutomation(automation, 'response-1');

      expect(responseRepository.findFirst).toHaveBeenCalledWith({
        where: { id: 'response-1', formId: 'form-1', deletedAt: null },
      });
      expect(automationRepository.createRun).toHaveBeenCalledWith(
        expect.objectContaining({
          automationId: 'automation-1',
          responseId: 'response-1',
          automationVersion: 2,
          status: 'RUNNING',
          context: expect.objectContaining({
            test: true,
            triggerData: expect.objectContaining({ field1: 'value1', responseId: 'response-1' }),
          }),
        })
      );
      expect(enqueueFirstStep).toHaveBeenCalledWith(createdRun);
      expect(result).toEqual(createdRun);
    });

    it('falls back to the latest response (by submittedAt desc) when none is given', async () => {
      vi.mocked(responseRepository.findFirst).mockResolvedValue(mockResponse as any);
      vi.mocked(automationRepository.createRun).mockResolvedValue({ id: 'run-1' } as any);
      vi.mocked(enqueueFirstStep).mockResolvedValue(undefined as any);

      await testAutomation(automation);

      expect(responseRepository.findFirst).toHaveBeenCalledWith({
        where: { formId: 'form-1', deletedAt: null },
        orderBy: { submittedAt: 'desc' },
      });
    });

    it('throws RESPONSE_NOT_FOUND-style error when the form has no responses', async () => {
      vi.mocked(responseRepository.findFirst).mockResolvedValue(null);

      await expect(testAutomation(automation)).rejects.toThrow(/No response available/);
      expect(automationRepository.createRun).not.toHaveBeenCalled();
    });

    it('threads the tester\'s address into the run context so email actions can be redirected', async () => {
      vi.mocked(responseRepository.findFirst).mockResolvedValue(mockResponse as any);
      vi.mocked(automationRepository.createRun).mockResolvedValue({ id: 'run-1' } as any);
      vi.mocked(enqueueFirstStep).mockResolvedValue(undefined as any);

      await testAutomation(automation, undefined, 'tester@example.com');

      expect(automationRepository.createRun).toHaveBeenCalledWith(
        expect.objectContaining({
          context: expect.objectContaining({ test: true, testUserEmail: 'tester@example.com' }),
        })
      );
    });

    // A schedule automation's data comes from its digest node, and graphValidator rejects
    // response-dependent steps on it — so requiring a response made schedule automations
    // untestable on a form that had none, and fed data downstream steps are validated to ignore.
    it('tests a schedule automation with no triggering response at all', async () => {
      vi.mocked(automationRepository.createRun).mockResolvedValue({ id: 'run-1' } as any);
      vi.mocked(enqueueFirstStep).mockResolvedValue(undefined as any);

      await testAutomation({ ...automation, triggerType: 'schedule' }, undefined, 'tester@example.com');

      expect(responseRepository.findFirst).not.toHaveBeenCalled();
      expect(automationRepository.createRun).toHaveBeenCalledWith(
        expect.objectContaining({
          responseId: null,
          context: expect.objectContaining({
            test: true,
            testUserEmail: 'tester@example.com',
            triggerData: {},
          }),
        })
      );
    });
  });

  describe('retryAutomationRun', () => {
    const failedRun = (overrides: Record<string, any> = {}) => ({
      id: 'run-1',
      status: 'FAILED',
      context: {},
      graphSnapshot: { nodes: [], edges: [] },
      automation: {
        id: 'automation-1',
        status: 'ACTIVE',
        formId: 'form-1',
        graph: {
          nodes: [{ id: 'action-1', type: 'action', data: { actionType: 'webhook', config: { url: 'https://fixed' } } }],
          edges: [],
        },
      },
      ...overrides,
    });

    beforeEach(() => {
      vi.mocked(enqueueRunStep).mockResolvedValue(undefined as any);
      vi.mocked(automationRepository.findRunById).mockResolvedValue({ id: 'run-1' } as any);
      vi.mocked(automationRepository.findLatestFailedStepRun).mockResolvedValue({
        nodeId: 'action-1',
      } as any);
      vi.mocked(automationRepository.claimFailedRunForRetry).mockResolvedValue({ count: 1 } as any);
      vi.mocked(isAutomationEngineEnabled).mockReturnValue(true);
    });

    // Resuming, not re-running: the steps that already succeeded must not deliver a second time.
    it('resumes from the failed step rather than the start of the graph', async () => {
      vi.mocked(automationRepository.findRunByIdWithAutomation).mockResolvedValue(failedRun() as any);

      await retryAutomationRun('run-1');

      expect(automationRepository.claimFailedRunForRetry).toHaveBeenCalledWith('run-1', 'action-1');
      expect(enqueueRunStep).toHaveBeenCalledWith({ id: 'run-1' }, 'action-1');
      expect(enqueueFirstStep).not.toHaveBeenCalled();
    });

    // Both callers read FAILED before either writes, so the read-then-write check cannot separate
    // them — only the conditional transition can. Losing the claim must not enqueue.
    it('refuses a second concurrent retry that lost the claim, rather than enqueueing twice', async () => {
      vi.mocked(automationRepository.findRunByIdWithAutomation).mockResolvedValue(failedRun() as any);
      vi.mocked(automationRepository.claimFailedRunForRetry).mockResolvedValue({ count: 0 } as any);

      await expect(retryAutomationRun('run-1')).rejects.toThrow(/already being retried/);
      expect(enqueueRunStep).not.toHaveBeenCalled();
    });

    // A retry is usually prompted by a fix, so replaying the frozen config would fail identically.
    it('refreshes the failed action\'s config from the live graph before resuming', async () => {
      vi.mocked(automationRepository.findRunByIdWithAutomation).mockResolvedValue(failedRun() as any);

      await retryAutomationRun('run-1');

      expect(automationRepository.setNodeConfigInRunSnapshot).toHaveBeenCalledWith(
        'run-1',
        'action-1',
        { url: 'https://fixed' }
      );
    });

    it('leaves the snapshot alone when the failed node is no longer in the live graph', async () => {
      vi.mocked(automationRepository.findRunByIdWithAutomation).mockResolvedValue(
        failedRun({
          automation: { id: 'automation-1', status: 'ACTIVE', formId: 'form-1', graph: { nodes: [], edges: [] } },
        }) as any
      );

      await retryAutomationRun('run-1');

      expect(automationRepository.setNodeConfigInRunSnapshot).not.toHaveBeenCalled();
      expect(enqueueRunStep).toHaveBeenCalled();
    });

    it('refuses to retry a run that is not FAILED', async () => {
      vi.mocked(automationRepository.findRunByIdWithAutomation).mockResolvedValue(
        failedRun({ status: 'PARTIAL' }) as any
      );

      await expect(retryAutomationRun('run-1')).rejects.toThrow(/Only failed runs/);
      expect(enqueueRunStep).not.toHaveBeenCalled();
    });

    // Retrying a paused automation would just cancel at the first action node — say so up front.
    it('refuses to retry while the automation is not ACTIVE', async () => {
      vi.mocked(automationRepository.findRunByIdWithAutomation).mockResolvedValue(
        failedRun({
          automation: { id: 'automation-1', status: 'PAUSED', formId: 'form-1', graph: { nodes: [], edges: [] } },
        }) as any
      );

      await expect(retryAutomationRun('run-1')).rejects.toThrow(/Activate this automation/);
      expect(enqueueRunStep).not.toHaveBeenCalled();
    });

    it('allows retrying a test run on a DRAFT automation, matching what test runs are allowed to do', async () => {
      vi.mocked(automationRepository.findRunByIdWithAutomation).mockResolvedValue(
        failedRun({
          context: { test: true },
          automation: { id: 'automation-1', status: 'DRAFT', formId: 'form-1', graph: { nodes: [], edges: [] } },
        }) as any
      );

      await retryAutomationRun('run-1');

      expect(enqueueRunStep).toHaveBeenCalled();
    });

    // enqueueRunStep logs and returns without throwing when the engine is off, so claiming first
    // would flip the run to RUNNING, queue nothing, and report success — leaving it unretryable
    // (retry needs FAILED) and, on a schedule automation, blocking every future tick.
    it('refuses before claiming when the automation engine is not running', async () => {
      vi.mocked(automationRepository.findRunByIdWithAutomation).mockResolvedValue(failedRun() as any);
      vi.mocked(isAutomationEngineEnabled).mockReturnValue(false);

      await expect(retryAutomationRun('run-1')).rejects.toThrow(/engine is not running/);
      expect(automationRepository.claimFailedRunForRetry).not.toHaveBeenCalled();
      expect(enqueueRunStep).not.toHaveBeenCalled();
    });

    it('puts the run back to FAILED when the enqueue fails, so it stays retryable', async () => {
      vi.mocked(automationRepository.findRunByIdWithAutomation).mockResolvedValue(failedRun() as any);
      vi.mocked(enqueueRunStep).mockRejectedValue(new Error('queue unavailable'));

      await expect(retryAutomationRun('run-1')).rejects.toThrow('queue unavailable');
      expect(automationRepository.releaseRetryClaim).toHaveBeenCalledWith('run-1');
    });

    it('throws when the run does not exist', async () => {
      vi.mocked(automationRepository.findRunByIdWithAutomation).mockResolvedValue(null);

      await expect(retryAutomationRun('missing')).rejects.toThrow('Automation run not found');
    });
  });

  describe('listAutomationRuns', () => {
    it('delegates limit/offset to the repository', async () => {
      const runs = [{ id: 'run-1' }];
      vi.mocked(automationRepository.listRunsByAutomation).mockResolvedValue(runs as any);

      const result = await listAutomationRuns('automation-1', 10, 5);

      expect(automationRepository.listRunsByAutomation).toHaveBeenCalledWith('automation-1', {
        limit: 10,
        offset: 5,
      });
      expect(result).toEqual(runs);
    });
  });

  describe('getAutomationRunWithAutomation', () => {
    it('returns the run when found', async () => {
      const run = { id: 'run-1', automation: { formId: 'form-1' } };
      vi.mocked(automationRepository.findRunByIdWithAutomation).mockResolvedValue(run as any);

      const result = await getAutomationRunWithAutomation('run-1');

      expect(result).toEqual(run);
    });

    it('throws a NOT_FOUND-style error when the run does not exist', async () => {
      vi.mocked(automationRepository.findRunByIdWithAutomation).mockResolvedValue(null);

      await expect(getAutomationRunWithAutomation('missing')).rejects.toThrow('Automation run not found');
    });
  });

  describe('cancelAutomationRun', () => {
    it('returns the cancelled run', async () => {
      const cancelled = { id: 'run-1', status: 'CANCELLED' };
      vi.mocked(cancelSingleAutomationRun).mockResolvedValue(cancelled as any);

      const result = await cancelAutomationRun('run-1');

      expect(cancelSingleAutomationRun).toHaveBeenCalledWith('run-1');
      expect(result).toEqual(cancelled);
    });

    it('throws a NOT_FOUND-style error when the run does not exist', async () => {
      vi.mocked(cancelSingleAutomationRun).mockResolvedValue(null as any);

      await expect(cancelAutomationRun('missing')).rejects.toThrow('Automation run not found');
    });
  });

  describe('listStepRuns', () => {
    it('delegates to the repository', async () => {
      const stepRuns = [{ id: 'step-1' }];
      vi.mocked(automationRepository.listStepRunsByRun).mockResolvedValue(stepRuns as any);

      const result = await listStepRuns('run-1');

      expect(automationRepository.listStepRunsByRun).toHaveBeenCalledWith('run-1');
      expect(result).toEqual(stepRuns);
    });
  });
});
