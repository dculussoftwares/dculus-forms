import { describe, it, expect, vi, beforeEach } from 'vitest';
import { copyPluginsToForm } from '../copyFormPlugins.js';
import { pluginRepository } from '../../repositories/index.js';
import { generateId } from '@dculus/utils';

vi.mock('../../repositories/index.js', () => ({
  pluginRepository: {
    listByForm: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockResolvedValue({}),
  },
}));
vi.mock('../../lib/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock('@dculus/utils', async () => {
  const actual = await vi.importActual<typeof import('@dculus/utils')>('@dculus/utils');
  return { ...actual, generateId: vi.fn() };
});

describe('copyPluginsToForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    let n = 0;
    vi.mocked(generateId).mockImplementation(() => `new-plugin-${++n}`);
  });

  it('returns 0 and writes nothing when the source form has no plugins', async () => {
    vi.mocked(pluginRepository.listByForm).mockResolvedValue([]);

    const count = await copyPluginsToForm('src', 'dst');

    expect(count).toBe(0);
    expect(pluginRepository.create).not.toHaveBeenCalled();
  });

  it('copies each plugin onto the target form, disabled, with a fresh id', async () => {
    vi.mocked(pluginRepository.listByForm).mockResolvedValue([
      {
        id: 'p1',
        formId: 'src',
        type: 'webhook',
        name: 'Notify CRM',
        enabled: true,
        config: { url: 'https://example.com/hook', secret: 's3cr3t' },
        events: ['form.submitted'],
      },
      {
        id: 'p2',
        formId: 'src',
        type: 'email',
        name: 'Team alert',
        enabled: false,
        config: { to: ['ops@example.com'] },
        events: ['form.submitted'],
      },
    ] as any);

    const count = await copyPluginsToForm('src', 'dst');

    expect(count).toBe(2);
    expect(pluginRepository.create).toHaveBeenCalledTimes(2);
    expect(pluginRepository.create).toHaveBeenNthCalledWith(1, {
      data: {
        id: 'new-plugin-1',
        formId: 'dst',
        type: 'webhook',
        name: 'Notify CRM',
        enabled: false,
        config: { url: 'https://example.com/hook', secret: 's3cr3t' },
        events: ['form.submitted'],
      },
    });
    // Even a plugin that was already disabled on the source stays disabled on the copy.
    expect(vi.mocked(pluginRepository.create).mock.calls[1][0].data.enabled).toBe(false);
  });

  it('never throws when a write fails — duplication must not hard-fail over a plugin', async () => {
    vi.mocked(pluginRepository.listByForm).mockResolvedValue([
      { id: 'p1', type: 'webhook', name: 'x', enabled: true, config: {}, events: [] },
    ] as any);
    vi.mocked(pluginRepository.create).mockRejectedValue(new Error('db down'));

    await expect(copyPluginsToForm('src', 'dst')).resolves.toBe(0);
  });

  it('coerces a null config to an empty object', async () => {
    vi.mocked(pluginRepository.listByForm).mockResolvedValue([
      { id: 'p1', type: 'webhook', name: 'x', enabled: true, config: null, events: [] },
    ] as any);

    await copyPluginsToForm('src', 'dst');

    expect(vi.mocked(pluginRepository.create).mock.calls[0][0].data.config).toEqual({});
  });
});
