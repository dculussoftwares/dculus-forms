import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { microsoftSheetsHandler } from '../handler.js';
import type { PluginEvent, PluginContext } from '../../core/types.js';
import type { MicrosoftSheetsPluginConfig } from '../types.js';

vi.mock('@dculus/types', () => ({
  deserializeFormSchema: vi.fn(),
}));

import { deserializeFormSchema } from '@dculus/types';

const originalFetch = global.fetch;

describe('Microsoft Sheets Handler', () => {
  let mockContext: PluginContext;
  let mockEvent: PluginEvent;
  let config: MicrosoftSheetsPluginConfig;

  beforeEach(() => {
    vi.clearAllMocks();

    mockContext = {
      logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
      getFormById: vi.fn(),
      getResponseById: vi.fn(),
      getResponsesByFormId: vi.fn(),
      getOrganization: vi.fn(),
      getUserById: vi.fn(),
      sendEmail: vi.fn(),
      updatePluginConfig: vi.fn().mockResolvedValue(undefined),
      prisma: {} as any,
    };

    config = {
      type: 'microsoft-sheets',
      microsoftToken: {
        accessToken: 'token-abc',
        refreshToken: 'refresh-abc',
        expiresAt: new Date(Date.now() + 3600_000).toISOString(),
        email: 'user@example.com',
        displayName: 'User',
      },
      workbookId: 'workbook-1',
      workbookUrl: 'https://onedrive.example.com/workbook-1',
    };

    vi.mocked(deserializeFormSchema).mockReturnValue({ pages: [] } as any);
    vi.mocked(mockContext.getFormById).mockResolvedValue({
      id: 'form-1',
      title: 'My Form',
      formSchema: { pages: [] },
    } as any);

    // Every appendDataRow call does a usedRange GET then a PATCH — both succeed generically.
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ rowCount: 1 }),
      text: async () => '',
    }) as any;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe('single response (form.submitted)', () => {
    beforeEach(() => {
      mockEvent = {
        type: 'form.submitted',
        formId: 'form-1',
        organizationId: 'org-1',
        timestamp: new Date('2026-01-01T00:00:00.000Z'),
        data: { responseId: 'response-1' },
      };
      vi.mocked(mockContext.getResponseById).mockResolvedValue({
        id: 'response-1',
        data: { name: 'Ada' },
        submittedAt: new Date('2026-01-01T00:00:00.000Z'),
      } as any);
    });

    it('appends exactly one row and returns rowAdded (not rowsAppended)', async () => {
      const result = await microsoftSheetsHandler({ id: 'plugin-1', config }, mockEvent, mockContext);

      expect(result.success).toBe(true);
      expect(result.rowAdded).toBe(true);
      expect(result.rowsAppended).toBeUndefined();
      // usedRange GET + PATCH = 2 fetch calls for one row
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it('errors when responseId is absent and there is no digest batch', async () => {
      mockEvent.data = {};
      const result = await microsoftSheetsHandler({ id: 'plugin-1', config }, mockEvent, mockContext);
      expect(result.success).toBe(false);
      expect(result.error).toBe('No responseId in event data');
    });
  });

  describe('digest batch (schedule automation, #automations-digest)', () => {
    beforeEach(() => {
      mockEvent = {
        type: 'schedule',
        formId: 'form-1',
        organizationId: 'org-1',
        timestamp: new Date('2026-01-01T09:00:00.000Z'),
        data: {
          __digestResponses: [
            { id: 'r1', submittedAt: '2025-12-26T10:00:00.000Z', data: { name: 'Ada' } },
            { id: 'r2', submittedAt: '2025-12-27T11:00:00.000Z', data: { name: 'Grace' } },
          ],
        },
      };
    });

    it('appends all digest rows in a SINGLE batched range write and returns rowsAppended (not rowAdded)', async () => {
      const result = await microsoftSheetsHandler({ id: 'plugin-1', config }, mockEvent, mockContext);

      expect(result.success).toBe(true);
      expect(result.rowsAppended).toBe(2);
      expect(result.rowAdded).toBeUndefined();
      // ONE usedRange GET + ONE PATCH for the whole batch, not one pair per response — avoids
      // Graph API throttling on a large digest.
      expect(global.fetch).toHaveBeenCalledTimes(2);
      const patchCall = vi.mocked(global.fetch).mock.calls.find(([, opts]) => (opts as RequestInit)?.method === 'PATCH');
      const body = JSON.parse((patchCall?.[1] as RequestInit).body as string);
      expect(body.values).toHaveLength(2);
      expect(mockContext.getResponseById).not.toHaveBeenCalled();
    });

    it('succeeds with rowsAppended: 0 when the digest batch is empty (nothing new to sync)', async () => {
      mockEvent.data = { __digestResponses: [] };
      const result = await microsoftSheetsHandler({ id: 'plugin-1', config }, mockEvent, mockContext);

      expect(result.success).toBe(true);
      expect(result.rowsAppended).toBe(0);
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });

  describe('connection / token handling', () => {
    beforeEach(() => {
      mockEvent = {
        type: 'form.submitted',
        formId: 'form-1',
        organizationId: 'org-1',
        timestamp: new Date('2026-01-01T00:00:00.000Z'),
        data: { responseId: 'response-1' },
      };
      vi.mocked(mockContext.getResponseById).mockResolvedValue({
        id: 'response-1',
        data: { name: 'Ada' },
        submittedAt: new Date('2026-01-01T00:00:00.000Z'),
      } as any);
    });

    it('returns "Not connected to Microsoft 365" when no microsoftToken is configured', async () => {
      config.microsoftToken = undefined;
      const result = await microsoftSheetsHandler({ id: 'plugin-1', config }, mockEvent, mockContext);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Not connected to Microsoft 365');
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('refreshes an expiring token, persists it via updatePluginConfig, and uses it for the append call', async () => {
      config.microsoftToken!.expiresAt = new Date(Date.now() + 60_000).toISOString(); // <5min left

      global.fetch = vi.fn().mockImplementation((url: string) => {
        // Exact hostname match, not a substring check — a substring match on a URL is an
        // incomplete-sanitization anti-pattern CodeQL flags even in test mocks (a URL like
        // "https://evil.com/login.microsoftonline.com" would also satisfy .includes()).
        if (new URL(url).hostname === 'login.microsoftonline.com') {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({ access_token: 'new-token', expires_in: 3600 }),
            text: async () => '',
          });
        }
        return Promise.resolve({ ok: true, status: 200, json: async () => ({ rowCount: 1 }), text: async () => '' });
      }) as any;

      const result = await microsoftSheetsHandler({ id: 'plugin-1', config }, mockEvent, mockContext);

      expect(result.success).toBe(true);
      expect(mockContext.updatePluginConfig).toHaveBeenCalledWith(
        expect.objectContaining({ microsoftToken: expect.objectContaining({ accessToken: 'new-token' }) })
      );
      const patchCall = vi.mocked(global.fetch).mock.calls.find(([, opts]) => (opts as RequestInit)?.method === 'PATCH');
      expect((patchCall?.[1] as RequestInit).headers).toMatchObject({ Authorization: 'Bearer new-token' });
    });

    it('returns "Failed to refresh" when the token refresh request is rejected by Microsoft', async () => {
      config.microsoftToken!.expiresAt = new Date(Date.now() + 60_000).toISOString();

      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({}),
        text: async () => 'invalid_grant',
      }) as any;

      const result = await microsoftSheetsHandler({ id: 'plugin-1', config }, mockEvent, mockContext);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to refresh Microsoft access token');
    });

    it('returns "Failed to refresh" when the token refresh request throws', async () => {
      config.microsoftToken!.expiresAt = new Date(Date.now() + 60_000).toISOString();
      global.fetch = vi.fn().mockRejectedValue(new Error('network down')) as any;

      const result = await microsoftSheetsHandler({ id: 'plugin-1', config }, mockEvent, mockContext);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to refresh Microsoft access token');
    });
  });

  describe('response lookup / workbook lifecycle', () => {
    beforeEach(() => {
      mockEvent = {
        type: 'form.submitted',
        formId: 'form-1',
        organizationId: 'org-1',
        timestamp: new Date('2026-01-01T00:00:00.000Z'),
        data: { responseId: 'response-1' },
      };
    });

    it('returns "Response not found" when getResponseById resolves null', async () => {
      vi.mocked(mockContext.getResponseById).mockResolvedValue(null);
      const result = await microsoftSheetsHandler({ id: 'plugin-1', config }, mockEvent, mockContext);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Response not found: response-1');
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('auto-creates a workbook and writes the header row when workbookId is not yet configured', async () => {
      config.workbookId = undefined;
      vi.mocked(mockContext.getResponseById).mockResolvedValue({
        id: 'response-1',
        data: { name: 'Ada' },
        submittedAt: new Date('2026-01-01T00:00:00.000Z'),
      } as any);

      global.fetch = vi.fn().mockImplementation((url: string, opts: RequestInit) => {
        if (url.includes(':/content') && opts.method === 'PUT') {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({ id: 'new-workbook-1', webUrl: 'https://onedrive.example.com/new-workbook-1' }),
            text: async () => '',
          });
        }
        if (url.includes('usedRange')) {
          return Promise.resolve({ ok: true, status: 200, json: async () => ({ rowCount: 1 }), text: async () => '' });
        }
        return Promise.resolve({ ok: true, status: 200, json: async () => ({}), text: async () => '' });
      }) as any;

      const result = await microsoftSheetsHandler({ id: 'plugin-1', config }, mockEvent, mockContext);

      expect(result.success).toBe(true);
      expect(result.workbookId).toBe('new-workbook-1');
      expect(mockContext.updatePluginConfig).toHaveBeenCalledWith(
        expect.objectContaining({ workbookId: 'new-workbook-1' })
      );
      const createCall = vi.mocked(global.fetch).mock.calls.find(([url]) => (url as string).includes(':/content'));
      expect(createCall).toBeDefined();
    });

    it('recreates the workbook and retries once when the append PATCH 404s (workbook was deleted)', async () => {
      vi.mocked(mockContext.getResponseById).mockResolvedValue({
        id: 'response-1',
        data: { name: 'Ada' },
        submittedAt: new Date('2026-01-01T00:00:00.000Z'),
      } as any);

      // Counts only append PATCHes — writeHeaderRow ALSO PATCHes a range(address=...) URL during
      // the recreate flow (both wrap a single row in `values`, so body shape can't distinguish
      // them), but always at row 1 ("address='A1:...'"); appendDataRows always starts at the row
      // after the used range (row 2 in this mock's usedRange response), so the range start
      // reliably tells the two calls apart.
      let appendPatchCallCount = 0;
      global.fetch = vi.fn().mockImplementation((url: string, opts: RequestInit) => {
        const isHeaderPatch = opts?.method === 'PATCH' && url.includes("address='A1:");
        const isAppendPatch = opts?.method === 'PATCH' && url.includes('range(address') && !isHeaderPatch;
        if (isAppendPatch) {
          appendPatchCallCount += 1;
          if (appendPatchCallCount === 1) {
            return Promise.resolve({ ok: false, status: 404, json: async () => ({}), text: async () => 'not found' });
          }
          return Promise.resolve({ ok: true, status: 200, json: async () => ({}), text: async () => '' });
        }
        if (isHeaderPatch) {
          return Promise.resolve({ ok: true, status: 200, json: async () => ({}), text: async () => '' });
        }
        if (url.includes(':/content') && opts?.method === 'PUT') {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({ id: 'recreated-workbook', webUrl: 'https://onedrive.example.com/recreated-workbook' }),
            text: async () => '',
          });
        }
        if (url.includes('usedRange')) {
          return Promise.resolve({ ok: true, status: 200, json: async () => ({ rowCount: 1 }), text: async () => '' });
        }
        return Promise.resolve({ ok: true, status: 200, json: async () => ({}), text: async () => '' });
      }) as any;

      const result = await microsoftSheetsHandler({ id: 'plugin-1', config }, mockEvent, mockContext);

      expect(result.success).toBe(true);
      expect(result.workbookId).toBe('recreated-workbook');
      expect(appendPatchCallCount).toBe(2);
    });

    it('returns a failure result (not a throw) when getFormById rejects — the outer catch-all', async () => {
      vi.mocked(mockContext.getResponseById).mockResolvedValue({
        id: 'response-1',
        data: { name: 'Ada' },
        submittedAt: new Date('2026-01-01T00:00:00.000Z'),
      } as any);
      vi.mocked(mockContext.getFormById).mockRejectedValue(new Error('db unavailable'));

      const result = await microsoftSheetsHandler({ id: 'plugin-1', config }, mockEvent, mockContext);

      expect(result.success).toBe(false);
      expect(result.error).toBe('db unavailable');
    });
  });

  describe('resolveFieldValue via a real form schema', () => {
    it('resolves select/radio option labels, joins checkbox selections, and joins file arrays', async () => {
      const mockEvent: PluginEvent = {
        type: 'form.submitted',
        formId: 'form-1',
        organizationId: 'org-1',
        timestamp: new Date('2026-01-01T00:00:00.000Z'),
        data: { responseId: 'response-1' },
      };

      const fields = [
        { id: 'color', label: 'Favorite Color', type: 'select_field', options: [{ value: 'red', label: 'Red' }, { value: 'blue', label: 'Blue' }] },
        { id: 'toppings', label: 'Toppings', type: 'checkbox_field', options: [{ value: 'cheese', label: 'Cheese' }, { value: 'olives', label: 'Olives' }] },
        { id: 'attachment', label: 'Attachment', type: 'file_upload_field' },
      ];
      vi.mocked(deserializeFormSchema).mockReturnValue({ pages: [{ fields }] } as any);
      vi.mocked(mockContext.getResponseById).mockResolvedValue({
        id: 'response-1',
        data: {
          color: 'blue',
          toppings: ['cheese', 'olives'],
          attachment: ['file1.png', 'file2.png'],
          submittedAt: '2026-01-01T00:00:00.000Z',
        },
      } as any);

      const result = await microsoftSheetsHandler({ id: 'plugin-1', config }, mockEvent, mockContext);

      expect(result.success).toBe(true);
      const patchCall = vi.mocked(global.fetch).mock.calls.find(([, opts]) => (opts as RequestInit)?.method === 'PATCH');
      const body = JSON.parse((patchCall?.[1] as RequestInit).body as string);
      expect(body.values[0]).toEqual([
        'Blue',
        'Cheese, Olives',
        'file1.png, file2.png',
        '2026-01-01T00:00:00.000Z',
        'response-1',
      ]);
    });
  });
});
