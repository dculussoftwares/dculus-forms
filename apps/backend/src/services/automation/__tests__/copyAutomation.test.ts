import { describe, it, expect, vi, beforeEach } from 'vitest';
import { copyAutomationGraph, copyAutomation, copyAutomationsToForm } from '../copyAutomation.js';
import { automationRepository } from '../../../repositories/index.js';
import { generateId } from '@dculus/utils';

vi.mock('../../../repositories/index.js', () => ({
  automationRepository: {
    createAutomation: vi.fn().mockResolvedValue({}),
    listByFormId: vi.fn().mockResolvedValue([]),
  },
}));
vi.mock('../../../lib/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock('@dculus/utils', async () => {
  const actual = await vi.importActual<typeof import('@dculus/utils')>('@dculus/utils');
  return { ...actual, generateId: vi.fn() };
});

describe('copyAutomationGraph', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    let n = 0;
    vi.mocked(generateId).mockImplementation(() => `new-${++n}`);
  });

  it('gives every node and edge a fresh id while preserving the wiring', () => {
    const copy = copyAutomationGraph({
      nodes: [
        { id: 'a', type: 'trigger', data: { triggerType: 'form.submitted' } },
        { id: 'b', type: 'end' },
      ],
      edges: [{ id: 'e1', source: 'a', target: 'b' }],
    });

    expect(copy.nodes.map((n) => n.id)).toEqual(['new-1', 'new-2']);
    // The edge must follow the remapped ids, or the copy is a pile of disconnected nodes.
    expect(copy.edges[0]).toMatchObject({ source: 'new-1', target: 'new-2' });
    expect(copy.edges[0].id).not.toBe('e1');
  });

  it('preserves a condition branch handle', () => {
    const copy = copyAutomationGraph({
      nodes: [
        { id: 'c', type: 'condition', data: { rules: [], combinator: 'AND' } },
        { id: 'x', type: 'end' },
      ],
      edges: [{ id: 'e1', source: 'c', target: 'x', sourceHandle: 'false' }],
    });

    expect(copy.edges[0].sourceHandle).toBe('false');
  });

  // A copy that kept the spreadsheet id would append the new form's responses into the ORIGINAL
  // form's sheet — two forms writing into one document with nothing in the UI to suggest it.
  it('strips integration bindings that point outside the new form', () => {
    const copy = copyAutomationGraph({
      nodes: [
        {
          id: 'a',
          type: 'action',
          data: {
            actionType: 'google-sheets',
            config: {
              type: 'google-sheets',
              spreadsheetId: 'sheet-of-the-original',
              spreadsheetUrl: 'https://docs.google.com/x',
              accessToken: 'tok',
              refreshToken: 'refresh',
              sheetName: 'Responses',
            },
          },
        },
      ],
      edges: [],
    });

    const config = (copy.nodes[0] as any).data.config;
    expect(config).not.toHaveProperty('spreadsheetId');
    expect(config).not.toHaveProperty('spreadsheetUrl');
    expect(config).not.toHaveProperty('accessToken');
    expect(config).not.toHaveProperty('refreshToken');
    // Everything that is genuinely about *this* automation survives — otherwise the copy is
    // useless rather than merely incomplete.
    expect(config.sheetName).toBe('Responses');
  });

  it('leaves non-action node data untouched', () => {
    const copy = copyAutomationGraph({
      nodes: [{ id: 'd', type: 'delay', data: { amount: 3, unit: 'days' } }],
      edges: [],
    });

    expect((copy.nodes[0] as any).data).toEqual({ amount: 3, unit: 'days' });
  });

  // The sheets plugins nest their OAuth tokens rather than storing them flat, so a shallow strip
  // of accessToken/refreshToken keeps the source connection alive in the copy.
  it('strips nested OAuth token objects, not just top-level token keys', () => {
    const copy = copyAutomationGraph({
      nodes: [
        {
          id: 'g',
          type: 'action',
          data: {
            actionType: 'google-sheets',
            config: {
              type: 'google-sheets',
              googleToken: { accessToken: 'a', refreshToken: 'r', expiresAt: 'x', email: 'e' },
              sheetName: 'Responses',
            },
          },
        },
        {
          id: 'm',
          type: 'action',
          data: {
            actionType: 'microsoft-sheets',
            config: {
              type: 'microsoft-sheets',
              microsoftToken: { accessToken: 'a', refreshToken: 'r' },
              workbookUrl: 'https://onedrive/x',
              worksheetName: 'Sheet1',
            },
          },
        },
      ],
      edges: [],
    });

    const google = (copy.nodes[0] as any).data.config;
    expect(google).not.toHaveProperty('googleToken');
    expect(google.sheetName).toBe('Responses');

    const microsoft = (copy.nodes[1] as any).data.config;
    expect(microsoft).not.toHaveProperty('microsoftToken');
    expect(microsoft).not.toHaveProperty('workbookUrl');
    expect(microsoft.worksheetName).toBe('Sheet1');
  });

  // graph is a JSON column: a malformed one must not take out an unrelated form duplication.
  it('tolerates a missing or malformed graph', () => {
    expect(copyAutomationGraph(undefined)).toEqual({ nodes: [], edges: [] });
    expect(copyAutomationGraph({})).toEqual({ nodes: [], edges: [] });
    expect(copyAutomationGraph({ nodes: {}, edges: [] })).toEqual({ nodes: [], edges: [] });
    expect(copyAutomationGraph({ nodes: [], edges: 'nope' })).toEqual({ nodes: [], edges: [] });
    expect(copyAutomationGraph(null)).toEqual({ nodes: [], edges: [] });
  });
});

describe('copyAutomation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(generateId).mockReturnValue('new-automation');
  });

  const source = {
    id: 'automation-1',
    name: 'Welcome flow',
    organizationId: 'org-1',
    triggerType: 'form.submitted',
    triggerConfig: null,
    graph: { nodes: [], edges: [] },
  };

  // Activating a copy silently would double every delivery the original makes.
  it('always lands as a DRAFT on the target form, with a reset version', async () => {
    await copyAutomation(source, 'form-2', 'user-1');

    expect(automationRepository.createAutomation).toHaveBeenCalledWith(
      expect.objectContaining({
        formId: 'form-2',
        status: 'DRAFT',
        version: 1,
        createdBy: 'user-1',
        name: 'Welcome flow',
      })
    );
  });

  it('uses an explicit name when given one', async () => {
    await copyAutomation(source, 'form-1', 'user-1', 'Welcome flow (Copy)');

    expect(automationRepository.createAutomation).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Welcome flow (Copy)' })
    );
  });

  // Run health and the digest watermark describe the ORIGINAL's history. A copy inheriting a
  // watermark would skip responses it never processed.
  it('does not carry over run health or the digest watermark', async () => {
    await copyAutomation(source, 'form-2', 'user-1');

    const [data] = vi.mocked(automationRepository.createAutomation).mock.calls[0];
    expect(data).not.toHaveProperty('lastDigestedAt');
    expect(data).not.toHaveProperty('lastRunStatus');
    expect(data).not.toHaveProperty('consecutiveFailureCount');
  });
});

describe('copyAutomationsToForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(generateId).mockReturnValue('new-automation');
  });

  it('copies every automation on the source form', async () => {
    vi.mocked(automationRepository.listByFormId).mockResolvedValue([
      { id: 'a1', name: 'One', organizationId: 'org-1', triggerType: 'form.submitted', triggerConfig: null, graph: { nodes: [], edges: [] } },
      { id: 'a2', name: 'Two', organizationId: 'org-1', triggerType: 'schedule', triggerConfig: { cron: '0 9 * * 1' }, graph: { nodes: [], edges: [] } },
    ] as any);

    const copied = await copyAutomationsToForm('form-1', 'form-2', 'user-1');

    expect(copied).toBe(2);
    expect(automationRepository.createAutomation).toHaveBeenCalledTimes(2);
  });

  // Losing the automations is bad; failing the whole form duplication over it is worse.
  it('never throws when copying fails — form duplication must still succeed', async () => {
    vi.mocked(automationRepository.listByFormId).mockRejectedValue(new Error('db down'));

    await expect(copyAutomationsToForm('form-1', 'form-2', 'user-1')).resolves.toBe(0);
  });

  it('is a no-op for a form with no automations', async () => {
    vi.mocked(automationRepository.listByFormId).mockResolvedValue([] as any);

    expect(await copyAutomationsToForm('form-1', 'form-2', 'user-1')).toBe(0);
    expect(automationRepository.createAutomation).not.toHaveBeenCalled();
  });
});
