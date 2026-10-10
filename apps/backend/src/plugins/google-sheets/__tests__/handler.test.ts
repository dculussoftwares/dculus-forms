import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { googleSheetsHandler } from '../handler.js';
import type { PluginEvent, PluginContext } from '../../core/types.js';
import type { GoogleSheetsPluginConfig } from '../types.js';

vi.mock('@dculus/types', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@dculus/types')>()),
  deserializeFormSchema: vi.fn(),
}));

import { deserializeFormSchema, FieldType } from '@dculus/types';

const originalFetch = global.fetch;

const FIXED_COLUMNS = [
  { id: '__submittedAt', label: 'Submitted At' },
  { id: '__responseId', label: 'Response ID' },
];

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
      sheetColumns: [...FIXED_COLUMNS],
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

    it('returns "Not connected to Google" when no googleToken is configured', async () => {
      config.googleToken = undefined;
      const result = await googleSheetsHandler({ id: 'plugin-1', config }, mockEvent, mockContext);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Not connected to Google');
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('refreshes an expiring token, persists it via updatePluginConfig, and uses it for the append call', async () => {
      config.googleToken!.expiresAt = new Date(Date.now() + 60_000).toISOString(); // <5min left

      global.fetch = vi.fn().mockImplementation((url: string) => {
        // Exact hostname match, not a substring check — a substring match on a URL is an
        // incomplete-sanitization anti-pattern CodeQL flags even in test mocks (a URL like
        // "https://evil.com/oauth2.googleapis.com" would also satisfy .includes()).
        if (new URL(url).hostname === 'oauth2.googleapis.com') {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({ access_token: 'new-token', expires_in: 3600 }),
            text: async () => '',
          });
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ updates: { updatedRange: 'Sheet1!A2:Z2' } }),
          text: async () => '',
        });
      }) as any;

      const result = await googleSheetsHandler({ id: 'plugin-1', config }, mockEvent, mockContext);

      expect(result.success).toBe(true);
      expect(mockContext.updatePluginConfig).toHaveBeenCalledWith(
        expect.objectContaining({ googleToken: expect.objectContaining({ accessToken: 'new-token' }) })
      );
      const appendCall = vi.mocked(global.fetch).mock.calls.find(([url]) => (url as string).includes('append'));
      expect((appendCall?.[1] as RequestInit).headers).toMatchObject({ Authorization: 'Bearer new-token' });
    });

    it('returns "Failed to refresh" when the token refresh request is rejected by Google', async () => {
      config.googleToken!.expiresAt = new Date(Date.now() + 60_000).toISOString();

      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({}),
        text: async () => 'invalid_grant',
      }) as any;

      const result = await googleSheetsHandler({ id: 'plugin-1', config }, mockEvent, mockContext);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to refresh Google access token');
    });

    it('returns "Failed to refresh" when the token refresh request throws', async () => {
      config.googleToken!.expiresAt = new Date(Date.now() + 60_000).toISOString();
      global.fetch = vi.fn().mockRejectedValue(new Error('network down')) as any;

      const result = await googleSheetsHandler({ id: 'plugin-1', config }, mockEvent, mockContext);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to refresh Google access token');
    });
  });

  describe('response lookup / spreadsheet lifecycle', () => {
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
      const result = await googleSheetsHandler({ id: 'plugin-1', config }, mockEvent, mockContext);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Response not found: response-1');
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('auto-creates a spreadsheet and writes the header row when spreadsheetId is not yet configured', async () => {
      config.spreadsheetId = undefined;
      config.sheetColumns = undefined;
      vi.mocked(mockContext.getResponseById).mockResolvedValue({
        id: 'response-1',
        data: { name: 'Ada' },
        submittedAt: new Date('2026-01-01T00:00:00.000Z'),
      } as any);

      global.fetch = vi.fn().mockImplementation((url: string, opts: RequestInit) => {
        if (url.endsWith('/spreadsheets') && opts.method === 'POST') {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({ spreadsheetId: 'new-sheet-1' }),
            text: async () => '',
          });
        }
        if (url.includes('/values/Sheet1!A1?') && opts.method === 'PUT') {
          return Promise.resolve({ ok: true, status: 200, json: async () => ({}), text: async () => '' });
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ updates: { updatedRange: 'Sheet1!A2:Z2' } }),
          text: async () => '',
        });
      }) as any;

      const result = await googleSheetsHandler({ id: 'plugin-1', config }, mockEvent, mockContext);

      expect(result.success).toBe(true);
      expect(result.spreadsheetId).toBe('new-sheet-1');
      expect(mockContext.updatePluginConfig).toHaveBeenCalledWith(
        expect.objectContaining({ spreadsheetId: 'new-sheet-1' })
      );
      const createCall = vi.mocked(global.fetch).mock.calls.find(([url]) => (url as string).endsWith('/spreadsheets'));
      expect(createCall).toBeDefined();
    });

    it('recreates the spreadsheet and retries once when the append call 404s (spreadsheet was deleted)', async () => {
      vi.mocked(mockContext.getResponseById).mockResolvedValue({
        id: 'response-1',
        data: { name: 'Ada' },
        submittedAt: new Date('2026-01-01T00:00:00.000Z'),
      } as any);

      let appendCallCount = 0;
      global.fetch = vi.fn().mockImplementation((url: string, opts: RequestInit) => {
        if (url.includes('append')) {
          appendCallCount += 1;
          if (appendCallCount === 1) {
            return Promise.resolve({ ok: false, status: 404, json: async () => ({}), text: async () => 'not found' });
          }
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({ updates: { updatedRange: 'Sheet1!A2:Z2' } }),
            text: async () => '',
          });
        }
        if (url.endsWith('/spreadsheets') && opts.method === 'POST') {
          return Promise.resolve({ ok: true, status: 200, json: async () => ({ spreadsheetId: 'recreated-sheet' }), text: async () => '' });
        }
        return Promise.resolve({ ok: true, status: 200, json: async () => ({}), text: async () => '' });
      }) as any;

      const result = await googleSheetsHandler({ id: 'plugin-1', config }, mockEvent, mockContext);

      expect(result.success).toBe(true);
      expect(result.spreadsheetId).toBe('recreated-sheet');
      expect(appendCallCount).toBe(2);
    });

    it('returns a failure result (not a throw) when getFormById rejects — the outer catch-all', async () => {
      vi.mocked(mockContext.getResponseById).mockResolvedValue({
        id: 'response-1',
        data: { name: 'Ada' },
        submittedAt: new Date('2026-01-01T00:00:00.000Z'),
      } as any);
      vi.mocked(mockContext.getFormById).mockRejectedValue(new Error('db unavailable'));

      const result = await googleSheetsHandler({ id: 'plugin-1', config }, mockEvent, mockContext);

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
      config.sheetColumns = [
        { id: 'color', label: 'Favorite Color' },
        { id: 'toppings', label: 'Toppings' },
        { id: 'attachment', label: 'Attachment' },
        ...FIXED_COLUMNS,
      ];
      vi.mocked(mockContext.getResponseById).mockResolvedValue({
        id: 'response-1',
        data: {
          color: 'blue',
          toppings: ['cheese', 'olives'],
          attachment: ['file1.png', 'file2.png'],
          submittedAt: '2026-01-01T00:00:00.000Z',
        },
      } as any);

      const result = await googleSheetsHandler({ id: 'plugin-1', config }, mockEvent, mockContext);

      expect(result.success).toBe(true);
      const [, fetchOptions] = vi.mocked(global.fetch).mock.calls[0];
      const body = JSON.parse((fetchOptions as RequestInit).body as string);
      expect(body.values[0]).toEqual([
        'Blue', // select resolved to option label
        'Cheese, Olives', // checkbox resolved + joined
        'file1.png, file2.png', // file array joined
        '2026-01-01T00:00:00.000Z',
        'response-1',
      ]);
    });

    it('skips a grid layout field in both the header row and the data row so columns stay aligned', async () => {
      config.spreadsheetId = undefined;
      config.sheetColumns = undefined;
      const mockEvent: PluginEvent = {
        type: 'form.submitted',
        formId: 'form-1',
        organizationId: 'org-1',
        timestamp: new Date('2026-01-01T00:00:00.000Z'),
        data: { responseId: 'response-1' },
      };
      const fields = [
        { id: 'name', label: 'Name', type: 'text_input_field', gridId: 'g1', gridColumn: 0 },
        { id: 'g1', type: FieldType.GRID_FIELD, columnWidths: [50, 50] },
        { id: 'email', label: 'Email', type: 'email_field', gridId: 'g1', gridColumn: 1 },
      ];
      vi.mocked(deserializeFormSchema).mockReturnValue({ pages: [{ fields }] } as any);
      vi.mocked(mockContext.getResponseById).mockResolvedValue({
        id: 'response-1',
        data: { name: 'Ada', email: 'ada@example.com', g1: 'stray', submittedAt: '2026-01-01T00:00:00.000Z' },
      } as any);

      global.fetch = vi.fn().mockImplementation((url: string, opts: RequestInit) => {
        if (url.endsWith('/spreadsheets') && opts.method === 'POST') {
          return Promise.resolve({ ok: true, status: 200, json: async () => ({ spreadsheetId: 'new-sheet-1' }), text: async () => '' });
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ updates: { updatedRange: 'Sheet1!A2:Z2' } }),
          text: async () => '',
        });
      }) as any;

      const result = await googleSheetsHandler({ id: 'plugin-1', config }, mockEvent, mockContext);

      expect(result.success).toBe(true);
      const calls = vi.mocked(global.fetch).mock.calls;
      const headerCall = calls.find(([url, opts]) => (url as string).includes('/values/Sheet1!A1?') && (opts as RequestInit).method === 'PUT');
      const appendCall = calls.find(([url]) => (url as string).includes('append'));
      const headers = JSON.parse((headerCall?.[1] as RequestInit).body as string).values[0];
      const row = JSON.parse((appendCall?.[1] as RequestInit).body as string).values[0];
      expect(headers).toEqual(['Name', 'Email', 'Submitted At', 'Response ID']);
      expect(row).toEqual(['Ada', 'ada@example.com', '2026-01-01T00:00:00.000Z', 'response-1']);
    });
  });

  describe('column layout when the form changes after the sheet was created', () => {
    const event: PluginEvent = {
      type: 'form.submitted',
      formId: 'form-1',
      organizationId: 'org-1',
      timestamp: new Date('2026-01-01T00:00:00.000Z'),
      data: { responseId: 'response-1' },
    };

    const bodyOf = (match: (url: string, opts: RequestInit) => boolean) => {
      const call = vi.mocked(global.fetch).mock.calls.find(([url, opts]) => match(url as string, opts as RequestInit));
      return call ? JSON.parse((call[1] as RequestInit).body as string).values : undefined;
    };
    const isHeaderWrite = (url: string, opts: RequestInit) =>
      url.includes('/values/Sheet1!A1?') && opts?.method === 'PUT';
    const isAppend = (url: string) => url.includes('append');

    it('appends a new field at the right end, rewrites the header and fills its value', async () => {
      config.sheetColumns = [{ id: 'name', label: 'Name' }, ...FIXED_COLUMNS];
      vi.mocked(deserializeFormSchema).mockReturnValue({
        pages: [{ fields: [
          { id: 'name', label: 'Name', type: 'text_input_field' },
          { id: 'city', label: 'City', type: 'text_input_field' },
        ] }],
      } as any);
      vi.mocked(mockContext.getResponseById).mockResolvedValue({
        id: 'response-1',
        data: { name: 'Ada', city: 'Pune', submittedAt: '2026-01-01T00:00:00.000Z' },
      } as any);

      const result = await googleSheetsHandler({ id: 'plugin-1', config }, event, mockContext);

      expect(result.success).toBe(true);
      expect(bodyOf(isHeaderWrite)[0]).toEqual(['Name', 'Submitted At', 'Response ID', 'City']);
      expect(bodyOf((url) => isAppend(url))[0]).toEqual(['Ada', '2026-01-01T00:00:00.000Z', 'response-1', 'Pune']);
      expect(mockContext.updatePluginConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          sheetColumns: [
            { id: 'name', label: 'Name' },
            ...FIXED_COLUMNS,
            { id: 'city', label: 'City' },
          ],
        })
      );
    });

    it('keeps a soft-deleted field in its column and marks it deleted', async () => {
      config.sheetColumns = [
        { id: 'name', label: 'Name' },
        { id: 'old', label: 'Old' },
        ...FIXED_COLUMNS,
      ];
      vi.mocked(deserializeFormSchema).mockReturnValue({
        pages: [{ fields: [
          { id: 'name', label: 'Name', type: 'text_input_field' },
          { id: 'old', label: 'Old', type: 'text_input_field', deleted: true },
        ] }],
      } as any);
      vi.mocked(mockContext.getResponseById).mockResolvedValue({
        id: 'response-1',
        data: { name: 'Ada', old: 'legacy', submittedAt: '2026-01-01T00:00:00.000Z' },
      } as any);

      await googleSheetsHandler({ id: 'plugin-1', config }, event, mockContext);

      expect(bodyOf(isHeaderWrite)[0]).toEqual(['Name', 'Old (deleted)', 'Submitted At', 'Response ID']);
      expect(bodyOf((url) => isAppend(url))[0]).toEqual(['Ada', 'legacy', '2026-01-01T00:00:00.000Z', 'response-1']);
    });

    it('adds a column for a deleted field only when a response answered it', async () => {
      config.sheetColumns = [{ id: 'name', label: 'Name' }, ...FIXED_COLUMNS];
      vi.mocked(deserializeFormSchema).mockReturnValue({
        pages: [{ fields: [
          { id: 'name', label: 'Name', type: 'text_input_field' },
          { id: 'gone', label: 'Gone', type: 'text_input_field', deleted: true },
          { id: 'never', label: 'Never', type: 'text_input_field', deleted: true },
        ] }],
      } as any);
      vi.mocked(mockContext.getResponseById).mockResolvedValue({
        id: 'response-1',
        data: { name: 'Ada', gone: 'x', submittedAt: '2026-01-01T00:00:00.000Z' },
      } as any);

      await googleSheetsHandler({ id: 'plugin-1', config }, event, mockContext);

      expect(bodyOf(isHeaderWrite)[0]).toEqual(['Name', 'Submitted At', 'Response ID', 'Gone (deleted)']);
    });

    it('does not touch the header when the layout is already current', async () => {
      config.sheetColumns = [{ id: 'name', label: 'Name' }, ...FIXED_COLUMNS];
      vi.mocked(deserializeFormSchema).mockReturnValue({
        pages: [{ fields: [{ id: 'name', label: 'Name', type: 'text_input_field' }] }],
      } as any);
      vi.mocked(mockContext.getResponseById).mockResolvedValue({
        id: 'response-1',
        data: { name: 'Ada', submittedAt: '2026-01-01T00:00:00.000Z' },
      } as any);

      await googleSheetsHandler({ id: 'plugin-1', config }, event, mockContext);

      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(mockContext.updatePluginConfig).not.toHaveBeenCalled();
    });

    it('recovers the layout of a sheet created before layouts were stored, then appends new fields', async () => {
      config.sheetColumns = undefined;
      vi.mocked(deserializeFormSchema).mockReturnValue({
        pages: [{ fields: [
          { id: 'name', label: 'Name', type: 'text_input_field' },
          { id: 'city', label: 'City', type: 'text_input_field' },
        ] }],
      } as any);
      vi.mocked(mockContext.getResponseById).mockResolvedValue({
        id: 'response-1',
        data: { name: 'Ada', city: 'Pune', submittedAt: '2026-01-01T00:00:00.000Z' },
      } as any);
      global.fetch = vi.fn().mockImplementation((url: string, opts?: RequestInit) => {
        if (url.endsWith('/values/Sheet1!1:1') && !opts?.method) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({ values: [['Name', 'Removed', 'Submitted At', 'Response ID']] }),
            text: async () => '',
          });
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ updates: { updatedRange: 'Sheet1!A2:Z2' } }),
          text: async () => '',
        });
      }) as any;

      const result = await googleSheetsHandler({ id: 'plugin-1', config }, event, mockContext);

      expect(result.success).toBe(true);
      expect(bodyOf(isHeaderWrite)[0]).toEqual(['Name', 'Removed', 'Submitted At', 'Response ID', 'City']);
      // The unmatched legacy column stays blank so nothing after it shifts.
      expect(bodyOf((url) => isAppend(url))[0]).toEqual(['Ada', '', '2026-01-01T00:00:00.000Z', 'response-1', 'Pune']);
    });
  });
});
