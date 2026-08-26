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
});
