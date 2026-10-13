import { describe, it, expect, vi, beforeEach } from 'vitest';
import { provisionSheetPlugin } from '../provision.js';
import { prisma } from '../../../lib/prisma.js';
import { getPluginHandler } from '../registry.js';
import { createPluginContext } from '../context.js';

vi.mock('../../../lib/prisma.js', () => ({
  prisma: { formPlugin: { findUnique: vi.fn(), update: vi.fn() } },
}));
vi.mock('../registry.js', () => ({ getPluginHandler: vi.fn() }));
vi.mock('../context.js', () => ({ createPluginContext: vi.fn() }));

const connected = { type: 'google-sheets', googleToken: { accessToken: 't' } };
const row = (config: Record<string, unknown>, extra: Record<string, unknown> = {}) =>
  ({ id: 'p1', type: 'google-sheets', enabled: true, formId: 'f1', form: { organizationId: 'o1' }, config, ...extra }) as any;

describe('provisionSheetPlugin', () => {
  const handler = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getPluginHandler).mockReturnValue(handler);
    vi.mocked(createPluginContext).mockReturnValue({ logger: { warn: vi.fn() } } as any);
    handler.mockResolvedValue({ success: true });
  });

  it('runs the handler with a provision event for a connected plugin with no file yet', async () => {
    vi.mocked(prisma.formPlugin.findUnique).mockResolvedValue(row(connected));

    await expect(provisionSheetPlugin('p1')).resolves.toBe(true);

    expect(handler).toHaveBeenCalledWith(
      { id: 'p1', config: connected },
      expect.objectContaining({ type: 'plugin.provision', formId: 'f1', organizationId: 'o1' }),
      expect.anything()
    );
  });

  it.each([
    ['already has a file', row({ ...connected, spreadsheetId: 's1' })],
    ['is not connected', row({ type: 'google-sheets' })],
    ['is disabled', row(connected, { enabled: false })],
    ['is another plugin type', row(connected, { type: 'webhook' })],
  ])('does nothing when the plugin %s', async (_label, plugin) => {
    vi.mocked(prisma.formPlugin.findUnique).mockResolvedValue(plugin);

    await expect(provisionSheetPlugin('p1')).resolves.toBe(false);
    expect(handler).not.toHaveBeenCalled();
  });

  it('reports failure without throwing when the handler fails or throws', async () => {
    vi.mocked(prisma.formPlugin.findUnique).mockResolvedValue(row(connected));
    handler.mockResolvedValueOnce({ success: false, error: 'boom' });
    await expect(provisionSheetPlugin('p1')).resolves.toBe(false);

    handler.mockRejectedValueOnce(new Error('network'));
    await expect(provisionSheetPlugin('p1')).resolves.toBe(false);
  });
});
