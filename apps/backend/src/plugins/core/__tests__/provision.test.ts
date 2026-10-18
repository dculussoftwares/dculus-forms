import { describe, it, expect, vi, beforeEach } from 'vitest';
import { provisionSheetPlugin, syncSheetPluginName } from '../provision.js';
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

describe('syncSheetPluginName', () => {
  const handler = vi.fn();
  const withFile = { ...connected, spreadsheetId: 's1', spreadsheetName: 'Leads' };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getPluginHandler).mockReturnValue(handler);
    vi.mocked(createPluginContext).mockReturnValue({ logger: { warn: vi.fn() } } as any);
    handler.mockResolvedValue({ success: true });
  });

  it('renames the existing file when the name changed', async () => {
    vi.mocked(prisma.formPlugin.findUnique).mockResolvedValue(row(withFile));

    await expect(syncSheetPluginName('p1', { type: 'google-sheets', spreadsheetName: 'Old' })).resolves.toBe(true);

    expect(handler).toHaveBeenCalledWith(
      { id: 'p1', config: withFile },
      expect.objectContaining({ type: 'plugin.rename', formId: 'f1' }),
      expect.anything()
    );
  });

  it.each([
    ['the name is unchanged', row(withFile), { type: 'google-sheets', spreadsheetName: ' Leads ' }],
    ['the name is blank', row({ ...withFile, spreadsheetName: '  ' }), { type: 'google-sheets' }],
    ['there is no file yet', row({ ...connected, spreadsheetName: 'Leads' }), undefined],
    ['it is another plugin type', row(withFile, { type: 'webhook' }), undefined],
  ])('does nothing when %s', async (_label, plugin, previous) => {
    vi.mocked(prisma.formPlugin.findUnique).mockResolvedValue(plugin);

    await expect(syncSheetPluginName('p1', previous as any)).resolves.toBe(false);
    expect(handler).not.toHaveBeenCalled();
  });

  it('renames a Microsoft workbook using its own name and id fields', async () => {
    const msConfig = { type: 'microsoft-sheets', microsoftToken: { accessToken: 't' }, workbookId: 'w1', workbookName: 'Leads' };
    vi.mocked(prisma.formPlugin.findUnique).mockResolvedValue(row(msConfig, { type: 'microsoft-sheets' }));

    await expect(syncSheetPluginName('p1', { type: 'microsoft-sheets', workbookName: 'Old' })).resolves.toBe(true);
    expect(handler).toHaveBeenCalledWith(
      { id: 'p1', config: msConfig },
      expect.objectContaining({ type: 'plugin.rename' }),
      expect.anything()
    );
  });

  it('reports failure without throwing when the handler fails or throws', async () => {
    vi.mocked(prisma.formPlugin.findUnique).mockResolvedValue(row(withFile));
    handler.mockResolvedValueOnce({ success: false, error: 'boom' });
    await expect(syncSheetPluginName('p1', undefined)).resolves.toBe(false);

    handler.mockRejectedValueOnce(new Error('network'));
    await expect(syncSheetPluginName('p1', undefined)).resolves.toBe(false);
  });
});
