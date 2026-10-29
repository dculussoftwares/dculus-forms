import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Prisma } from '#prisma-client';
import { GraphQLError } from '#graphql-errors';
import {
  saveAutomationDraft,
  publishAutomation,
  discardAutomationDraft,
  duplicateAutomation,
  setAutomationStatus,
} from '../automationService.js';
import { automationRepository } from '../../repositories/index.js';
import { getAvailablePluginTypes } from '../../plugins/core/registry.js';
import { validateAutomationGraph, validateWebhookDestinations } from '../automation/graphValidator.js';
import { scheduleAutomationCron } from '../automation/triggerService.js';
import { copyAutomation } from '../automation/copyAutomation.js';
import { audit } from '../../lib/audit.js';

vi.mock('../../repositories/index.js');
vi.mock('../../plugins/core/registry.js');
vi.mock('../automation/graphValidator.js');
vi.mock('../automation/engine.js');
vi.mock('../automation/triggerService.js');
vi.mock('../automation/copyAutomation.js');
vi.mock('../automation/boss.js', () => ({ isAutomationEngineEnabled: vi.fn(() => true) }));
vi.mock('../../lib/audit.js', () => ({ audit: vi.fn() }));

const liveGraph = {
  nodes: [
    { id: 't', type: 'trigger', data: { triggerType: 'form.submitted' } },
    { id: 'e', type: 'end' },
  ],
  edges: [{ id: 'ed', source: 't', target: 'e' }],
};
const editedGraph = {
  nodes: [
    { id: 't', type: 'trigger', data: { triggerType: 'form.submitted' } },
    { id: 'a', type: 'action', data: { actionType: 'email', config: {} } },
    { id: 'e', type: 'end' },
  ],
  edges: [
    { id: 'ed', source: 't', target: 'a' },
    { id: 'ed2', source: 'a', target: 'e' },
  ],
};

const automation = (overrides: Record<string, unknown> = {}) => ({
  id: 'automation-1',
  status: 'ACTIVE',
  triggerType: 'form.submitted',
  graph: liveGraph,
  triggerConfig: null,
  version: 3,
  draftGraph: null,
  draftTriggerConfig: null,
  draftRevision: 5,
  ...overrides,
});

const expectGraphQLCode = async (promise: Promise<unknown>, code: string) => {
  const error = await promise.then(
    () => null,
    (e) => e
  );
  expect(error).toBeInstanceOf(GraphQLError);
  expect(error.extensions.code).toBe(code);
  return error as GraphQLError;
};

describe('automation draft / publish', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getAvailablePluginTypes).mockReturnValue(['email', 'webhook']);
    vi.mocked(validateAutomationGraph).mockReturnValue({ valid: true, errors: [] });
    vi.mocked(validateWebhookDestinations).mockResolvedValue([]);
    vi.mocked(automationRepository.updateIfDraftRevision).mockImplementation(
      async (id: string, _base: number | null, data: any) => ({ id, status: 'ACTIVE', version: 4, ...data }) as any
    );
  });

  describe('saveAutomationDraft', () => {
    it('writes only the draft columns and never the live graph or version', async () => {
      await saveAutomationDraft(automation() as any, { graph: editedGraph, baseRevision: 5 }, 'user-1');

      const [id, base, data] = vi.mocked(automationRepository.updateIfDraftRevision).mock.calls[0];
      expect(id).toBe('automation-1');
      expect(base).toBe(5);
      expect(data).toMatchObject({
        draftGraph: editedGraph,
        draftRevision: { increment: 1 },
        draftUpdatedById: 'user-1',
        draftIssueCount: 0,
      });
      expect(data).not.toHaveProperty('graph');
      expect(data).not.toHaveProperty('version');
    });

    it('saves an unpublishable graph and returns the issues instead of throwing', async () => {
      vi.mocked(validateAutomationGraph).mockReturnValue({
        valid: false,
        errors: [{ nodeId: 'a', code: 'INVALID_ACTION_CONFIG', message: 'Recipient required' }],
      });

      const result = await saveAutomationDraft(automation() as any, { graph: editedGraph, baseRevision: 5 }, 'user-1');

      expect(result.validationErrors).toHaveLength(1);
      expect(vi.mocked(automationRepository.updateIfDraftRevision).mock.calls[0][2]).toMatchObject({
        draftIssueCount: 1,
      });
    });

    it('stores null when the draft equals the live graph regardless of key order', async () => {
      const reordered = {
        edges: [{ target: 'e', source: 't', id: 'ed' }],
        nodes: [
          { data: { triggerType: 'form.submitted' }, type: 'trigger', id: 't' },
          { type: 'end', id: 'e' },
        ],
      };

      await saveAutomationDraft(automation({ draftGraph: editedGraph }) as any, { graph: reordered, baseRevision: 5 }, 'u');

      expect(vi.mocked(automationRepository.updateIfDraftRevision).mock.calls[0][2]).toMatchObject({
        draftGraph: Prisma.DbNull,
        draftTriggerConfig: Prisma.DbNull,
      });
    });

    it('builds on the existing draft when only the trigger config changes', async () => {
      const cfg = { cron: '0 9 * * *', timezone: 'Asia/Kolkata' };

      await saveAutomationDraft(
        automation({ triggerType: 'schedule', draftGraph: editedGraph }) as any,
        { triggerConfig: cfg, baseRevision: 5 },
        'u'
      );

      expect(vi.mocked(automationRepository.updateIfDraftRevision).mock.calls[0][2]).toMatchObject({
        draftGraph: editedGraph,
        draftTriggerConfig: cfg,
      });
    });

    it('flags an invalid schedule as an issue without rejecting the save', async () => {
      const result = await saveAutomationDraft(
        automation({ triggerType: 'schedule' }) as any,
        { triggerConfig: { cron: 'not a cron' }, baseRevision: 5 },
        'u'
      );

      expect(result.validationErrors).toEqual([expect.objectContaining({ code: 'INVALID_TRIGGER_CONFIG' })]);
    });

    it('rejects a stale revision with AUTOMATION_DRAFT_CONFLICT carrying the latest revision', async () => {
      vi.mocked(automationRepository.updateIfDraftRevision).mockResolvedValue(null);
      vi.mocked(automationRepository.findById).mockResolvedValue(
        automation({ draftRevision: 9, draftUpdatedById: 'someone' }) as any
      );

      const error = await expectGraphQLCode(
        saveAutomationDraft(automation() as any, { graph: editedGraph, baseRevision: 5 }, 'u'),
        'AUTOMATION_DRAFT_CONFLICT'
      );
      expect(error.extensions).toMatchObject({ draftRevision: 9, draftUpdatedById: 'someone' });
    });

    it('skips the revision check when forced', async () => {
      await saveAutomationDraft(automation() as any, { graph: editedGraph, baseRevision: 1, force: true }, 'u');

      expect(vi.mocked(automationRepository.updateIfDraftRevision).mock.calls[0][1]).toBeNull();
    });

    it('rejects a malformed graph, an empty save and an oversized payload', async () => {
      await expectGraphQLCode(
        saveAutomationDraft(automation() as any, { graph: { nodes: 'x' }, baseRevision: 5 }, 'u'),
        'BAD_USER_INPUT'
      );
      await expectGraphQLCode(saveAutomationDraft(automation() as any, { baseRevision: 5 }, 'u'), 'BAD_USER_INPUT');

      const huge = { nodes: [{ id: 'x', type: 'end', data: { blob: 'a'.repeat(600 * 1024) } }], edges: [] };
      await expectGraphQLCode(
        saveAutomationDraft(automation() as any, { graph: huge, baseRevision: 5 }, 'u'),
        'AUTOMATION_DRAFT_TOO_LARGE'
      );
      expect(automationRepository.updateIfDraftRevision).not.toHaveBeenCalled();
    });
  });

  describe('publishAutomation', () => {
    it('promotes the draft to live, bumps the version and clears the draft', async () => {
      await publishAutomation(automation({ draftGraph: editedGraph }) as any, { baseRevision: 5 }, 'user-1');

      const [, base, data] = vi.mocked(automationRepository.updateIfDraftRevision).mock.calls[0];
      expect(base).toBe(5);
      expect(data).toMatchObject({
        graph: editedGraph,
        version: { increment: 1 },
        draftGraph: Prisma.DbNull,
        draftTriggerConfig: Prisma.DbNull,
        draftRevision: { increment: 1 },
        draftIssueCount: 0,
        publishedById: 'user-1',
      });
      expect(data).not.toHaveProperty('status');
      expect(audit).toHaveBeenCalledWith(
        'automation.published',
        'Automation',
        'automation-1',
        'user-1',
        expect.objectContaining({ fromVersion: 3, activated: false })
      );
    });

    it('does not bump the version when nothing differs from live', async () => {
      await publishAutomation(automation() as any, { baseRevision: 5 }, 'u');

      expect(vi.mocked(automationRepository.updateIfDraftRevision).mock.calls[0][2]).not.toHaveProperty('version');
    });

    it('leaves live untouched when the draft is invalid', async () => {
      vi.mocked(validateAutomationGraph).mockReturnValue({
        valid: false,
        errors: [{ nodeId: 'a', code: 'X', message: 'bad' }],
      });

      const error = await expectGraphQLCode(
        publishAutomation(automation({ draftGraph: editedGraph }) as any, { baseRevision: 5 }, 'u'),
        'AUTOMATION_INVALID_GRAPH'
      );
      expect(error.extensions.validationErrors).toHaveLength(1);
      expect(automationRepository.updateIfDraftRevision).not.toHaveBeenCalled();
    });

    it('rejects a stale revision before validating or writing', async () => {
      await expectGraphQLCode(
        publishAutomation(automation({ draftRevision: 7 }) as any, { baseRevision: 5 }, 'u'),
        'AUTOMATION_DRAFT_CONFLICT'
      );
      expect(automationRepository.updateIfDraftRevision).not.toHaveBeenCalled();
    });

    it('rejects when the compare-and-swap loses a race', async () => {
      vi.mocked(automationRepository.updateIfDraftRevision).mockResolvedValue(null);
      vi.mocked(automationRepository.findById).mockResolvedValue(automation({ draftRevision: 6 }) as any);

      await expectGraphQLCode(
        publishAutomation(automation({ draftGraph: editedGraph }) as any, { baseRevision: 5 }, 'u'),
        'AUTOMATION_DRAFT_CONFLICT'
      );
    });

    it('activates in the same write when asked', async () => {
      await publishAutomation(
        automation({ status: 'DRAFT', draftGraph: editedGraph }) as any,
        { baseRevision: 5, activate: true },
        'u'
      );

      expect(vi.mocked(automationRepository.updateIfDraftRevision).mock.calls[0][2]).toMatchObject({
        status: 'ACTIVE',
      });
    });

    it('seeds the digest watermark when a schedule automation with a digest node is first activated', async () => {
      const digestGraph = {
        nodes: [
          { id: 't', type: 'trigger', data: { triggerType: 'schedule' } },
          { id: 'd', type: 'digest', data: {} },
          { id: 'e', type: 'end' },
        ],
        edges: [],
      };
      const cfg = { cron: '0 9 * * *' };

      await publishAutomation(
        automation({ status: 'DRAFT', triggerType: 'schedule', draftGraph: digestGraph, draftTriggerConfig: cfg }) as any,
        { baseRevision: 5, activate: true },
        'u'
      );

      expect(vi.mocked(automationRepository.updateIfDraftRevision).mock.calls[0][2]).toMatchObject({
        lastDigestedAt: expect.any(Date),
      });
      expect(scheduleAutomationCron).toHaveBeenCalledWith('automation-1', '0 9 * * *', undefined);
    });

    it('reschedules the cron of an already-active schedule automation when the schedule changes', async () => {
      await publishAutomation(
        automation({ triggerType: 'schedule', triggerConfig: { cron: '0 9 * * *' }, draftTriggerConfig: { cron: '0 10 * * *' } }) as any,
        { baseRevision: 5 },
        'u'
      );

      expect(scheduleAutomationCron).toHaveBeenCalledWith('automation-1', '0 10 * * *', undefined);
    });

    it('does not schedule a paused schedule automation that is published without resuming', async () => {
      vi.mocked(automationRepository.updateIfDraftRevision).mockImplementation(
        async (id: string, _b: number | null, data: any) => ({ id, status: 'PAUSED', version: 4, ...data }) as any
      );

      await publishAutomation(
        automation({ status: 'PAUSED', triggerType: 'schedule', triggerConfig: { cron: '0 9 * * *' } }) as any,
        { baseRevision: 5 },
        'u'
      );

      expect(scheduleAutomationCron).not.toHaveBeenCalled();
    });

    it('blocks publishing a schedule automation with no valid schedule', async () => {
      await expectGraphQLCode(
        publishAutomation(automation({ triggerType: 'schedule' }) as any, { baseRevision: 5 }, 'u'),
        'AUTOMATION_INVALID_GRAPH'
      );
    });
  });

  describe('conflict vs deleted', () => {
    it('reports AUTOMATION_NOT_FOUND, not a conflict, when the row vanished', async () => {
      vi.mocked(automationRepository.updateIfDraftRevision).mockResolvedValue(null);
      vi.mocked(automationRepository.findById).mockResolvedValue(null);

      await expectGraphQLCode(
        saveAutomationDraft(automation() as any, { graph: editedGraph, baseRevision: 5 }, 'u'),
        'AUTOMATION_NOT_FOUND'
      );
    });
  });

  describe('graph comparison', () => {
    it('treats a node with no data and one with empty data as equal (draft normalises to null)', async () => {
      const serverShaped = { nodes: [{ id: 't', type: 'trigger', data: {} }, { id: 'e', type: 'end' }], edges: [] };
      const clientShaped = { nodes: [{ id: 't', type: 'trigger', data: {} }, { id: 'e', type: 'end', data: {} }], edges: [] };

      await saveAutomationDraft(automation({ graph: serverShaped, draftGraph: editedGraph }) as any, { graph: clientShaped, baseRevision: 5 }, 'u');

      expect(vi.mocked(automationRepository.updateIfDraftRevision).mock.calls[0][2]).toMatchObject({
        draftGraph: Prisma.DbNull,
      });
    });

    it('does not bump the version on first publish when only that serialization differs', async () => {
      const serverShaped = { nodes: [{ id: 't', type: 'trigger', data: {} }, { id: 'e', type: 'end' }], edges: [] };
      const clientShaped = { nodes: [{ id: 't', type: 'trigger', data: {} }, { id: 'e', type: 'end', data: {} }], edges: [] };

      await publishAutomation(automation({ graph: serverShaped, draftGraph: clientShaped }) as any, { baseRevision: 5 }, 'u');

      expect(vi.mocked(automationRepository.updateIfDraftRevision).mock.calls[0][2]).not.toHaveProperty('version');
    });
  });

  describe('setAutomationStatus guard', () => {
    it('refuses to activate a never-published automation that has an unpublished draft', async () => {
      await expectGraphQLCode(
        setAutomationStatus({ ...(automation({ status: 'DRAFT', draftGraph: editedGraph }) as any) }, 'ACTIVE'),
        'BAD_USER_INPUT'
      );
      expect(automationRepository.updateAutomation).not.toHaveBeenCalled();
    });

    it('still allows resuming a paused automation that has a draft (resumes the live version)', async () => {
      vi.mocked(automationRepository.updateAutomation).mockResolvedValue({ id: 'automation-1', status: 'ACTIVE' } as any);

      await setAutomationStatus({ ...(automation({ status: 'PAUSED', draftGraph: editedGraph }) as any) }, 'ACTIVE');

      expect(automationRepository.updateAutomation).toHaveBeenCalled();
    });
  });

  describe('discardAutomationDraft', () => {
    it('clears the draft and bumps the revision so other tabs conflict', async () => {
      await discardAutomationDraft({ id: 'automation-1' });

      expect(automationRepository.updateIfDraftRevision).toHaveBeenCalledWith('automation-1', null, {
        draftGraph: Prisma.DbNull,
        draftTriggerConfig: Prisma.DbNull,
        draftRevision: { increment: 1 },
        draftUpdatedAt: null,
        draftUpdatedById: null,
        draftIssueCount: 0,
      });
    });

    it('throws AUTOMATION_NOT_FOUND when the automation vanished', async () => {
      vi.mocked(automationRepository.updateIfDraftRevision).mockResolvedValue(null);

      await expectGraphQLCode(discardAutomationDraft({ id: 'gone' }), 'AUTOMATION_NOT_FOUND');
    });
  });

  describe('duplicateAutomation', () => {
    it('copies the draft the author sees rather than the published graph', async () => {
      await duplicateAutomation(
        {
          id: 'automation-1',
          name: 'Welcome',
          formId: 'form-1',
          organizationId: 'org-1',
          triggerType: 'schedule',
          triggerConfig: { cron: '0 9 * * *' },
          graph: liveGraph,
          draftGraph: editedGraph,
          draftTriggerConfig: { cron: '0 10 * * *' },
        },
        'user-1'
      );

      expect(copyAutomation).toHaveBeenCalledWith(
        expect.objectContaining({ graph: editedGraph, triggerConfig: { cron: '0 10 * * *' } }),
        'form-1',
        'user-1',
        'Welcome (Copy)'
      );
    });
  });
});
