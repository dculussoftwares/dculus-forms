import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { googleSheetsHandler } from '../handler.js';
import type { PluginEvent, PluginContext } from '../../core/types.js';
import type { GoogleSheetsPluginConfig } from '../types.js';

vi.mock('@dculus/types', () => ({
  deserializeFormSchema: vi.fn(),
}));

import { deserializeFormSchema } from '@dculus/types';

const originalFetch = global.fetch;

describe('Google Sheets Handler', () => {
  let mockContext: PluginContext;
  let mockEvent: PluginEvent;
  let config: GoogleSheetsPluginConfig;

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
      type: 'google-sheets',
      googleToken: {
        accessToken: 'token-abc',
        refreshToken: 'refresh-abc',
        expiresAt: new Date(Date.now() + 3600_000).toISOString(),
        email: 'user@example.com',
      },
      spreadsheetId: 'sheet-1',
      spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/sheet-1',
    };

    vi.mocked(deserializeFormSchema).mockReturnValue({ pages: [] } as any);
    vi.mocked(mockContext.getFormById).mockResolvedValue({
      id: 'form-1',
      title: 'My Form',
      formSchema: { pages: [] },
    } as any);

    // Every appendDataRow call hits fetch — return a generic success response with an
    // updatedRange the handler can parse a row number out of.
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ updates: { updatedRange: 'Sheet1!A2:Z2' } }),
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

    it('appends exactly one row and returns rowNumber (not rowsAppended)', async () => {
      const result = await googleSheetsHandler({ id: 'plugin-1', config }, mockEvent, mockContext);

      expect(result.success).toBe(true);
      expect(result.rowNumber).toBe(2);
      expect(result.rowsAppended).toBeUndefined();
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('errors when responseId is absent and there is no digest batch', async () => {
      mockEvent.data = {};
      const result = await googleSheetsHandler({ id: 'plugin-1', config }, mockEvent, mockContext);
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
            { id: 'r3', submittedAt: '2025-12-28T12:00:00.000Z', data: { name: 'Margaret' } },
          ],
        },
      };
    });

    it('appends all digest rows in a SINGLE batched API call and returns rowsAppended (not rowNumber)', async () => {
      const result = await googleSheetsHandler({ id: 'plugin-1', config }, mockEvent, mockContext);

      expect(result.success).toBe(true);
      expect(result.rowsAppended).toBe(3);
      expect(result.rowNumber).toBeUndefined();
      // 3 responses -> ONE appendDataRows call carrying all 3 rows, not 3 separate calls —
      // avoids exhausting the Sheets API's per-minute write quota on a large digest.
      expect(global.fetch).toHaveBeenCalledTimes(1);
      const [, fetchOptions] = vi.mocked(global.fetch).mock.calls[0];
      const body = JSON.parse((fetchOptions as RequestInit).body as string);
      expect(body.values).toHaveLength(3);
      expect(mockContext.getResponseById).not.toHaveBeenCalled();
    });

    it('succeeds with rowsAppended: 0 when the digest batch is empty (nothing new to sync)', async () => {
      mockEvent.data = { __digestResponses: [] };
      const result = await googleSheetsHandler({ id: 'plugin-1', config }, mockEvent, mockContext);

      expect(result.success).toBe(true);
      expect(result.rowsAppended).toBe(0);
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });
});
