import { deserializeFormSchema } from '@dculus/types';
import type { PluginHandler } from '../core/types.js';
import type { GoogleSheetsPluginConfig, GoogleSheetsResult, GoogleToken } from './types.js';

/** One response embedded in a digest node's output (see services/automation/types.ts DigestResponseSummary). */
interface DigestResponseEntry {
  id: string;
  submittedAt: string;
  data: Record<string, any>;
}

/**
 * `event.data` is a plain `Record<string, any>` — `__digestResponses` reaches this handler via
 * that generic channel with no compile-time guarantee of its shape, so a bare `as
 * DigestResponseEntry[]` cast could let a malformed entry (e.g. a bug upstream in engine.ts's
 * triggerData merge) crash deep inside row-building logic with a cryptic error instead of failing
 * predictably here.
 */
function isValidDigestResponseEntry(entry: unknown): entry is DigestResponseEntry {
  return (
    typeof entry === 'object' &&
    entry !== null &&
    typeof (entry as Record<string, unknown>).id === 'string' &&
    typeof (entry as Record<string, unknown>).submittedAt === 'string' &&
    typeof (entry as Record<string, unknown>).data === 'object' &&
    (entry as Record<string, unknown>).data !== null
  );
}

const SHEETS_API_BASE = 'https://sheets.googleapis.com/v4';
const TOKEN_REFRESH_URL = 'https://oauth2.googleapis.com/token';

class SpreadsheetNotFoundError extends Error {
  constructor() { super('Spreadsheet not found (404)'); }
}

/**
 * Refreshes the Google OAuth access token when it is within 5 minutes of expiry.
 * Updates the plugin config in the database with the new token.
 * Returns the refreshed token on success, or null on failure.
 */
const refreshTokenIfNeeded = async (
  pluginId: string,
  config: GoogleSheetsPluginConfig,
  context: Parameters<PluginHandler>[2]
): Promise<GoogleToken | null> => {
  const token = config.googleToken!;
  const expiresAt = new Date(token.expiresAt).getTime();
  const now = Date.now();

  if (expiresAt - now > 300_000) {
    // Token is still valid for more than 5 minutes — no refresh needed
    return token;
  }

  context.logger.info('Google Sheets: refreshing access token', { pluginId });

  try {
    const response = await fetch(TOKEN_REFRESH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: process.env.GOOGLE_CLIENT_ID ?? '',
        client_secret: process.env.GOOGLE_CLIENT_SECRET ?? '',
        refresh_token: token.refreshToken,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      context.logger.error('Google Sheets: token refresh failed', {
        status: response.status,
        body,
      });
      return null;
    }

    const refreshData = await response.json() as any;

    const newToken: GoogleToken = {
      accessToken: refreshData.access_token,
      refreshToken: refreshData.refresh_token ?? token.refreshToken,
      expiresAt: new Date(
        Date.now() + (refreshData.expires_in ?? 3600) * 1000
      ).toISOString(),
      email: token.email,
    };

    // Persist the refreshed token back to the plugin config
    await context.updatePluginConfig({ ...config, googleToken: newToken });

    context.logger.info('Google Sheets: token refreshed successfully', { pluginId });
    return newToken;
  } catch (error: any) {
    context.logger.error('Google Sheets: token refresh threw an error', {
      error: error.message,
    });
    return null;
  }
};

/**
 * Builds a headers map with the Bearer token for Google API calls.
 */
const authHeaders = (accessToken: string): Record<string, string> => ({
  Authorization: `Bearer ${accessToken}`,
  'Content-Type': 'application/json',
});

/**
 * Creates a new Google Spreadsheet and returns the spreadsheet ID and URL.
 */
const createSpreadsheet = async (
  title: string,
  accessToken: string
): Promise<{ spreadsheetId: string; spreadsheetUrl: string }> => {
  const response = await fetch(`${SHEETS_API_BASE}/spreadsheets`, {
    method: 'POST',
    headers: authHeaders(accessToken),
    body: JSON.stringify({ properties: { title } }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Failed to create spreadsheet: ${response.status} ${body}`);
  }

  const data = await response.json() as any;
  const spreadsheetId: string = data.spreadsheetId;
  const spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}`;
  return { spreadsheetId, spreadsheetUrl };
};

/**
 * Writes the header row to Sheet1!A1 using the Sheets values.update endpoint.
 */
const writeHeaderRow = async (
  spreadsheetId: string,
  headers: string[],
  accessToken: string
): Promise<void> => {
  const url = `${SHEETS_API_BASE}/spreadsheets/${spreadsheetId}/values/Sheet1!A1?valueInputOption=RAW`;

  const response = await fetch(url, {
    method: 'PUT',
    headers: authHeaders(accessToken),
    body: JSON.stringify({ values: [headers] }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Failed to write header row: ${response.status} ${body}`);
  }
};

/**
 * Appends one or more data rows to the spreadsheet in a SINGLE API call (the Sheets
 * `values.append` endpoint natively accepts multiple rows in one `values` array — a digest
 * batch of up to 1000 responses (#automations-digest) writes as one request here, not one
 * request per response, avoiding both per-minute write-quota exhaustion and a slow, serially
 * awaited loop). Returns the first written row's number, parsed from the updatedRange in the
 * API response (e.g. "Sheet1!A5:Z20" for a 16-row batch starting at row 5 → 5).
 */
// Keeps a single values.append request comfortably under Google's ~2MB request-body limit for a
// digest batch of up to 5000 rows with wide forms (many fields per row).
const MAX_ROWS_PER_APPEND_REQUEST = 500;

const appendDataRows = async (
  spreadsheetId: string,
  rows: string[][],
  accessToken: string
): Promise<number | undefined> => {
  const url =
    `${SHEETS_API_BASE}/spreadsheets/${spreadsheetId}/values/Sheet1!A1:append` +
    `?valueInputOption=RAW&insertDataOption=INSERT_ROWS`;

  const response = await fetch(url, {
    method: 'POST',
    headers: authHeaders(accessToken),
    body: JSON.stringify({ values: rows }),
  });

  if (response.status === 404) throw new SpreadsheetNotFoundError();

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Failed to append data row(s): ${response.status} ${body}`);
  }

  const data = await response.json() as any;

  // Parse the first row number from updatedRange, e.g. "Sheet1!A5:Z20" → 5
  const updatedRange: string | undefined = data.updates?.updatedRange;
  if (updatedRange) {
    const match = updatedRange.match(/![A-Z]+(\d+):/);
    if (match) return parseInt(match[1], 10);
  }

  return undefined;
};

/**
 * Resolves a field value from the response data into a human-readable string.
 * Handles select, radio, checkbox, file, and plain scalar values.
 */
const resolveFieldValue = (field: any, rawValue: any): string => {
  if (rawValue === null || rawValue === undefined) return '';

  const fieldType: string =
    (field?.type ?? field?.constructor?.name ?? '').toLowerCase();

  if (fieldType.includes('select') || fieldType.includes('radio')) {
    // options may be an array of { label, value } objects or plain strings
    if (Array.isArray(field?.options) && field.options.length > 0) {
      const found = field.options.find(
        (o: any) => (typeof o === 'object' ? o.value : o) === rawValue
      );
      if (found) return typeof found === 'object' ? found.label : String(found);
    }
    return String(rawValue);
  }

  if (fieldType.includes('checkbox')) {
    if (!Array.isArray(rawValue)) return String(rawValue);
    // Map each selected value to its label when possible
    if (Array.isArray(field?.options) && field.options.length > 0) {
      return rawValue
        .map((val: any) => {
          const opt = field.options.find(
            (o: any) => (typeof o === 'object' ? o.value : o) === val
          );
          return opt ? (typeof opt === 'object' ? opt.label : String(opt)) : String(val);
        })
        .join(', ');
    }
    return rawValue.join(', ');
  }

  if (fieldType.includes('file')) {
    if (Array.isArray(rawValue)) return rawValue.join(', ');
    return String(rawValue);
  }

  return String(rawValue);
};

/**
 * Builds one spreadsheet row's values for a single response, in the same field order as
 * `buildHeaders()`'s column headers. Shared by both the single-response path (form.submitted /
 * response.edited) and the digest batch path (schedule automation, #automations-digest) so a
 * row always lines up with its headers regardless of which path produced it.
 */
const buildRowValues = (
  responseData: Record<string, any>,
  formSchema: ReturnType<typeof deserializeFormSchema> | null,
  responseId: string,
  submittedAt: string,
  fallbackKeys: string[] = []
): string[] => {
  const rowValues: string[] = [];

  if (formSchema?.pages) {
    for (const page of formSchema.pages) {
      for (const field of page.fields ?? []) {
        if (!field?.id) continue;
        const raw = responseData[field.id];
        rowValues.push(resolveFieldValue(field, raw));
      }
    }
  } else {
    // `fallbackKeys` is derived ONCE (from a sample response) and reused for every row, matching
    // buildHeaders()'s no-schema column order. Iterating `Object.entries(responseData)` per row
    // instead would misalign columns whenever a digest batch's responses have differing key sets
    // or insertion order (e.g. an optional field present on some submissions but not others).
    for (const key of fallbackKeys) {
      rowValues.push(String(responseData[key] ?? ''));
    }
  }

  rowValues.push(submittedAt);
  rowValues.push(responseId);
  return rowValues;
};

export const googleSheetsHandler: PluginHandler = async (plugin, event, context) => {
  const syncedAt = new Date().toISOString();
  const config = plugin.config as GoogleSheetsPluginConfig;

  // 1. Validate connection
  if (!config.googleToken) {
    context.logger.warn('Google Sheets: plugin not connected to Google', {
      pluginId: plugin.id,
    });
    return {
      success: false,
      error: 'Not connected to Google',
      syncedAt,
    } satisfies GoogleSheetsResult;
  }

  try {
    // 2. Refresh token if within 5 minutes of expiry
    const freshToken = await refreshTokenIfNeeded(plugin.id, config, context);
    if (!freshToken) {
      return {
        success: false,
        error: 'Failed to refresh Google access token',
        syncedAt,
      } satisfies GoogleSheetsResult;
    }

    const accessToken = freshToken.accessToken;

    // Fetch the response(s) to build row values. A digest batch (schedule automation with an
    // upstream digest node, #automations-digest) carries zero-to-many responses in
    // event.data.__digestResponses instead of exactly one event.data.responseId.
    const digestResponses = Array.isArray((event.data as Record<string, any>).__digestResponses)
      ? ((event.data as Record<string, any>).__digestResponses as unknown[]).filter(isValidDigestResponseEntry)
      : null;

    let singleResponse: Awaited<ReturnType<typeof context.getResponseById>> | null = null;
    if (!digestResponses) {
      if (!event.data.responseId) {
        return {
          success: false,
          error: 'No responseId in event data',
          syncedAt,
        } satisfies GoogleSheetsResult;
      }

      singleResponse = await context.getResponseById(event.data.responseId);
      if (!singleResponse) {
        return {
          success: false,
          error: `Response not found: ${event.data.responseId}`,
          syncedAt,
        } satisfies GoogleSheetsResult;
      }
    }

    // Fixed key order for buildHeaders()'s no-schema fallback, derived ONCE as the union of keys
    // across EVERY response in this batch (not just the first) and reused by every row
    // (buildRowValues) — see buildRowValues's no-schema comment. Deriving from only the first
    // response would silently drop a column for any optional field a later digest response has
    // but the first one lacks.
    const fallbackKeys: string[] = (() => {
      const skipKeys = new Set(['responseId', 'submittedAt']);
      const allResponseData: Record<string, any>[] = digestResponses
        ? digestResponses.map((r) => r.data ?? {})
        : [(singleResponse?.data as Record<string, any>) ?? {}];
      const seen = new Set<string>();
      const keys: string[] = [];
      for (const data of allResponseData) {
        for (const key of Object.keys(data)) {
          if (skipKeys.has(key) || seen.has(key)) continue;
          seen.add(key);
          keys.push(key);
        }
      }
      return keys;
    })();

    // 3. Auto-create spreadsheet on first ever submission (or recreate if deleted)
    let spreadsheetId = config.spreadsheetId;

    const form = await context.getFormById(event.formId);
    const formSchema = form?.formSchema ? deserializeFormSchema(form.formSchema) : null;

    const buildHeaders = (): string[] => {
      const fieldHeaders: string[] = [];
      if (formSchema?.pages) {
        for (const page of formSchema.pages) {
          for (const field of page.fields ?? []) {
            if (field?.id) fieldHeaders.push((field as any).label ?? field.id);
          }
        }
      } else {
        fieldHeaders.push(...fallbackKeys);
      }
      return [...fieldHeaders, 'Submitted At', 'Response ID'];
    };

    const initSpreadsheet = async (): Promise<{ spreadsheetId: string; spreadsheetUrl: string }> => {
      const formTitle = form?.title?.trim() || 'Form Responses';
      // Append a distinguishing suffix so two Google Sheets actions on the same form (e.g. a
      // condition's "Yes" and "No" branches) don't create identically-titled files that are
      // hard to tell apart in Drive. Automation action nodes use a composite
      // `${runId}:${nodeId}` plugin id (see services/automation/engine.ts) — prefer the
      // trailing node-id segment, which stays stable across re-runs, over the whole composite
      // (which would otherwise change every run). Legacy standalone plugins use a plain
      // FormPlugin id with no colon, so this is a no-op there.
      const idParts = plugin.id.split(':');
      const idSuffix = (idParts[idParts.length - 1] || plugin.id).slice(0, 8);
      const sheetTitle = `${formTitle} — Responses (${idSuffix})`;

      context.logger.info('Google Sheets: creating new spreadsheet', {
        pluginId: plugin.id,
        title: sheetTitle,
      });

      const created = await createSpreadsheet(sheetTitle, accessToken);
      await writeHeaderRow(created.spreadsheetId, buildHeaders(), accessToken);

      await context.updatePluginConfig({
        ...config,
        googleToken: freshToken,
        spreadsheetId: created.spreadsheetId,
        spreadsheetUrl: created.spreadsheetUrl,
      });

      context.logger.info('Google Sheets: spreadsheet created and header row written', {
        pluginId: plugin.id,
        spreadsheetId: created.spreadsheetId,
      });

      return created;
    };

    if (!spreadsheetId) {
      const created = await initSpreadsheet();
      spreadsheetId = created.spreadsheetId;
    }

    // Appends row(s), recreating the spreadsheet once (and retrying) if it was deleted out from
    // under this plugin — same recovery the single-response path always had.
    const appendRowsWithRecovery = async (rows: string[][]): Promise<number | undefined> => {
      try {
        return await appendDataRows(spreadsheetId!, rows, accessToken);
      } catch (err) {
        if (err instanceof SpreadsheetNotFoundError) {
          context.logger.warn('Google Sheets: spreadsheet was deleted — recreating', { pluginId: plugin.id });
          const recreated = await initSpreadsheet();
          spreadsheetId = recreated.spreadsheetId;
          return appendDataRows(spreadsheetId, rows, accessToken);
        }
        throw err;
      }
    };

    // A digest batch can carry up to DIGEST_RESPONSE_SAFETY_CEILING (5000) rows — a single
    // values.append request that large risks exceeding Google's ~2MB request-body limit, so
    // large batches are chunked into sequential requests. The digest path only reports a total
    // rowsAppended count, so the per-chunk row numbers aren't needed there; only the first
    // chunk's result is surfaced, matching the single-row path's existing rowNumber semantics.
    //
    // Recreation-on-delete must restart the WHOLE batch, not just the chunk that hit the 404: if
    // the spreadsheet is deleted mid-batch (e.g. after chunk 2 of 5 has already been written) and
    // only the failed chunk were retried against the freshly recreated spreadsheet, chunks 1-2
    // would be silently lost — they were written to the now-gone spreadsheet, and the new one
    // would start from chunk 3 onward. So the per-chunk loop runs OUTSIDE any recovery: a 404
    // anywhere in it aborts the whole loop, the spreadsheet is recreated once, and every chunk is
    // re-appended from the start against the new (empty) spreadsheet.
    const appendAllRowsChunked = async (rows: string[][]): Promise<number | undefined> => {
      if (rows.length === 0) return undefined;

      const writeAllChunks = async (): Promise<number | undefined> => {
        let firstRowNumber: number | undefined;
        for (let i = 0; i < rows.length; i += MAX_ROWS_PER_APPEND_REQUEST) {
          const chunk = rows.slice(i, i + MAX_ROWS_PER_APPEND_REQUEST);
          const result = await appendDataRows(spreadsheetId!, chunk, accessToken);
          if (i === 0) firstRowNumber = result;
        }
        return firstRowNumber;
      };

      try {
        return await writeAllChunks();
      } catch (err) {
        if (err instanceof SpreadsheetNotFoundError) {
          context.logger.warn(
            'Google Sheets: spreadsheet was deleted mid-digest-write — recreating and restarting the full batch',
            { pluginId: plugin.id }
          );
          const recreated = await initSpreadsheet();
          spreadsheetId = recreated.spreadsheetId;
          return writeAllChunks();
        }
        throw err;
      }
    };

    if (digestResponses) {
      const rows = digestResponses.map((digestResponse) =>
        buildRowValues(digestResponse.data ?? {}, formSchema, digestResponse.id, digestResponse.submittedAt, fallbackKeys)
      );
      // Chunked into MAX_ROWS_PER_APPEND_REQUEST-row requests (not one call per response) — a
      // 1000-response digest would otherwise be 1000 sequential HTTP calls, risking the Sheets
      // API's per-minute write quota and a step that never finishes within a reasonable time.
      if (rows.length > 0) await appendAllRowsChunked(rows);
      const rowsAppended = rows.length;

      context.logger.info('Google Sheets: digest rows appended', {
        pluginId: plugin.id,
        spreadsheetId,
        rowsAppended,
      });

      return {
        success: true,
        spreadsheetId,
        rowsAppended,
        syncedAt,
      } satisfies GoogleSheetsResult;
    }

    const responseData = (singleResponse!.data as Record<string, any>) ?? {};
    const submittedAt = String(
      responseData.submittedAt ?? (singleResponse as any).createdAt?.toISOString?.() ?? new Date().toISOString()
    );
    const rowValues = buildRowValues(responseData, formSchema, event.data.responseId, submittedAt, fallbackKeys);
    const rowNumber = await appendRowsWithRecovery([rowValues]);

    context.logger.info('Google Sheets: row appended', {
      pluginId: plugin.id,
      spreadsheetId,
      rowNumber,
    });

    return {
      success: true,
      spreadsheetId,
      rowNumber,
      syncedAt,
    } satisfies GoogleSheetsResult;
  } catch (error: any) {
    context.logger.error('Google Sheets: unhandled error', {
      pluginId: plugin.id,
      error: error.message,
    });

    return {
      success: false,
      error: error.message,
      syncedAt,
    } satisfies GoogleSheetsResult;
  }
};
