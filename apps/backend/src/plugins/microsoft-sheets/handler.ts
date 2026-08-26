import ExcelJS from 'exceljs';
import { deserializeFormSchema } from '@dculus/types';
import type { PluginHandler } from '../core/types.js';
import type {
  MicrosoftSheetsPluginConfig,
  MicrosoftSheetsResult,
  MicrosoftToken,
} from './types.js';

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

const GRAPH_BASE = 'https://graph.microsoft.com/v1.0';
const MS_TOKEN_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';

// ─── Token refresh ────────────────────────────────────────────────────────────

const refreshMicrosoftTokenIfNeeded = async (
  pluginId: string,
  config: MicrosoftSheetsPluginConfig,
  context: Parameters<PluginHandler>[2]
): Promise<MicrosoftToken | null> => {
  const token = config.microsoftToken!;
  const expiresAt = new Date(token.expiresAt).getTime();
  const now = Date.now();

  if (expiresAt - now > 300_000) {
    // Token still valid for more than 5 minutes
    return token;
  }

  context.logger.info('Microsoft Sheets: refreshing access token', { pluginId });

  try {
    const response = await fetch(MS_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: token.refreshToken,
        client_id: process.env.MICROSOFT_CLIENT_ID ?? '',
        client_secret: process.env.MICROSOFT_CLIENT_SECRET ?? '',
        scope: 'Files.ReadWrite User.Read offline_access',
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      context.logger.error('Microsoft Sheets: token refresh failed', {
        status: response.status,
        body,
      });
      return null;
    }

    const data = await response.json() as any;

    const newToken: MicrosoftToken = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? token.refreshToken,
      expiresAt: new Date(Date.now() + (data.expires_in ?? 3600) * 1000).toISOString(),
      email: token.email,
      displayName: token.displayName,
    };

    await context.updatePluginConfig({ ...config, microsoftToken: newToken });

    context.logger.info('Microsoft Sheets: token refreshed successfully', { pluginId });
    return newToken;
  } catch (error: any) {
    context.logger.error('Microsoft Sheets: token refresh threw an error', {
      error: error.message,
    });
    return null;
  }
};

// ─── Graph API helpers ────────────────────────────────────────────────────────

class WorkbookNotFoundError extends Error {
  constructor() { super('Workbook not found (404)'); }
}

const authHeaders = (accessToken: string): Record<string, string> => ({
  Authorization: `Bearer ${accessToken}`,
  'Content-Type': 'application/json',
});

/**
 * Creates a new Excel workbook in the user's OneDrive root and returns
 * the item ID and the permanent web URL.
 * Uses ExcelJS to produce a valid .xlsx buffer so the file opens correctly.
 */
const createWorkbook = async (
  title: string,
  worksheetName: string,
  accessToken: string
): Promise<{ workbookId: string; workbookUrl: string }> => {
  const wb = new ExcelJS.Workbook();
  wb.addWorksheet(worksheetName);
  const buffer = await wb.xlsx.writeBuffer();

  const filename = `${title}.xlsx`;
  const createUrl = `${GRAPH_BASE}/me/drive/root:/${encodeURIComponent(filename)}:/content`;

  const response = await fetch(createUrl, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    },
    body: buffer,
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Failed to create workbook: ${response.status} ${body}`);
  }

  const data = await response.json() as any;
  const workbookId: string = data.id;
  const workbookUrl: string = data.webUrl ?? '';
  return { workbookId, workbookUrl };
};

/**
 * Writes the header row to the worksheet at row 1 via the usedRange update API.
 */
const writeHeaderRow = async (
  workbookId: string,
  worksheetName: string,
  headers: string[],
  accessToken: string
): Promise<void> => {
  const columnCount = headers.length;
  // Convert column count to Excel letter notation (A, B, ..., Z, AA, ...)
  const lastCol = columnIndexToLetter(columnCount - 1);
  const range = `A1:${lastCol}1`;

  const url = `${GRAPH_BASE}/me/drive/items/${workbookId}/workbook/worksheets('${encodeURIComponent(worksheetName)}')/range(address='${range}')`;

  const response = await fetch(url, {
    method: 'PATCH',
    headers: authHeaders(accessToken),
    body: JSON.stringify({
      values: [headers],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Failed to write header row: ${response.status} ${body}`);
  }
};

/**
 * Appends one or more data rows by finding the next empty row after the used range and writing
 * the whole batch there in a SINGLE range PATCH (the Graph API accepts a rectangular block of
 * rows in one `values` array — a digest batch of up to 1000 responses, #automations-digest,
 * writes as one used-range lookup + one PATCH here, not one round-trip pair per response, which
 * would otherwise make a large digest slow and prone to Graph API throttling). Returns true on
 * success.
 */
// Keeps a single range PATCH comfortably under Microsoft Graph's ~4MB request-body limit for a
// digest batch of up to 5000 rows with wide forms (many fields per row).
const MAX_ROWS_PER_APPEND_REQUEST = 500;

const appendDataRows = async (
  workbookId: string,
  worksheetName: string,
  rows: string[][],
  accessToken: string
): Promise<boolean> => {
  // 1. Get the used range to determine the next empty row
  const usedRangeUrl = `${GRAPH_BASE}/me/drive/items/${workbookId}/workbook/worksheets('${encodeURIComponent(worksheetName)}')/usedRange`;

  const usedRangeRes = await fetch(usedRangeUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (usedRangeRes.status === 404) throw new WorkbookNotFoundError();

  let nextRow = 2; // Default: first data row after header
  if (usedRangeRes.ok) {
    const usedData = await usedRangeRes.json() as any;
    const rowCount: number = usedData.rowCount ?? 1;
    nextRow = rowCount + 1;
  }

  // 2. Write the whole batch starting at nextRow, one row per rows[] entry
  const columnCount = rows[0]?.length ?? 0;
  const lastCol = columnIndexToLetter(columnCount - 1);
  const lastRow = nextRow + rows.length - 1;
  const range = `A${nextRow}:${lastCol}${lastRow}`;
  const url = `${GRAPH_BASE}/me/drive/items/${workbookId}/workbook/worksheets('${encodeURIComponent(worksheetName)}')/range(address='${range}')`;

  const response = await fetch(url, {
    method: 'PATCH',
    headers: authHeaders(accessToken),
    body: JSON.stringify({
      values: rows,
    }),
  });

  if (response.status === 404) throw new WorkbookNotFoundError();

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Failed to append data row: ${response.status} ${body}`);
  }

  return true;
};

/**
 * Converts a 0-based column index to Excel letter notation.
 * 0 → A, 25 → Z, 26 → AA, etc.
 */
const columnIndexToLetter = (index: number): string => {
  let result = '';
  let n = index;
  do {
    result = String.fromCharCode(65 + (n % 26)) + result;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return result;
};

/**
 * Resolves a field value from response data into a human-readable string.
 * Handles select, radio, checkbox, file, and scalar values.
 */
const resolveFieldValue = (field: any, rawValue: any): string => {
  if (rawValue === null || rawValue === undefined) return '';

  const fieldType: string =
    (field?.type ?? field?.constructor?.name ?? '').toLowerCase();

  if (fieldType.includes('select') || fieldType.includes('radio')) {
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
 * Builds one worksheet row's values for a single response, in the same field order as
 * `buildHeaders()`'s column headers. Shared by both the single-response path (form.submitted /
 * response.edited) and the digest batch path (schedule automation, #automations-digest).
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

// ─── Main handler ─────────────────────────────────────────────────────────────

export const microsoftSheetsHandler: PluginHandler = async (plugin, event, context) => {
  const syncedAt = new Date().toISOString();
  const config = plugin.config as MicrosoftSheetsPluginConfig;
  const worksheetName = config.worksheetName?.trim() || 'Sheet1';

  // 1. Validate connection
  if (!config.microsoftToken) {
    context.logger.warn('Microsoft Sheets: plugin not connected to Microsoft 365', {
      pluginId: plugin.id,
    });
    return {
      success: false,
      error: 'Not connected to Microsoft 365',
      syncedAt,
    } satisfies MicrosoftSheetsResult;
  }

  try {
    // 2. Refresh token if within 5 minutes of expiry
    const freshToken = await refreshMicrosoftTokenIfNeeded(plugin.id, config, context);
    if (!freshToken) {
      return {
        success: false,
        error: 'Failed to refresh Microsoft access token',
        syncedAt,
      } satisfies MicrosoftSheetsResult;
    }

    const accessToken = freshToken.accessToken;

    // 3. Fetch the response(s) to build row values. A digest batch (schedule automation with an
    // upstream digest node, #automations-digest) carries zero-to-many responses in
    // event.data.__digestResponses instead of exactly one event.data.responseId.
    const rawDigestResponses = (event.data as Record<string, any>).__digestResponses;
    const digestResponses = Array.isArray(rawDigestResponses)
      ? (rawDigestResponses as unknown[]).filter(isValidDigestResponseEntry)
      : null;
    if (Array.isArray(rawDigestResponses) && digestResponses!.length < rawDigestResponses.length) {
      context.logger.warn('Digest batch contained malformed response entries — they were dropped, not appended', {
        totalEntries: rawDigestResponses.length,
        validEntries: digestResponses!.length,
        formId: event.formId,
      });
    }

    let singleResponse: Awaited<ReturnType<typeof context.getResponseById>> | null = null;
    if (!digestResponses) {
      if (!event.data.responseId) {
        return {
          success: false,
          error: 'No responseId in event data',
          syncedAt,
        } satisfies MicrosoftSheetsResult;
      }

      singleResponse = await context.getResponseById(event.data.responseId);
      if (!singleResponse) {
        return {
          success: false,
          error: `Response not found: ${event.data.responseId}`,
          syncedAt,
        } satisfies MicrosoftSheetsResult;
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

    // 4. Auto-create workbook on first ever submission (or recreate if deleted)
    let workbookId = config.workbookId;

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

    const initWorkbook = async (): Promise<{ workbookId: string; workbookUrl: string }> => {
      const formTitle = form?.title?.trim() || 'Form Responses';
      // Append a distinguishing suffix so two Microsoft Excel actions on the same form (e.g. a
      // condition's "Yes" and "No" branches) don't create identically-titled files that are
      // hard to tell apart in OneDrive. Automation action nodes use a composite
      // `${runId}:${nodeId}` plugin id (see services/automation/engine.ts) — prefer the
      // trailing node-id segment, which stays stable across re-runs, over the whole composite
      // (which would otherwise change every run, since it used to take the first 8 chars of
      // the *whole* id — effectively the run id, not the node id). Legacy standalone plugins
      // use a plain FormPlugin id with no colon, so this is a no-op there.
      const idParts = plugin.id.split(':');
      const idSuffix = (idParts[idParts.length - 1] || plugin.id).slice(0, 8);
      const workbookTitle = `${formTitle} — Responses (${idSuffix})`;

      context.logger.info('Microsoft Sheets: creating new workbook', {
        pluginId: plugin.id,
        title: workbookTitle,
      });

      const created = await createWorkbook(workbookTitle, worksheetName, accessToken);
      await writeHeaderRow(created.workbookId, worksheetName, buildHeaders(), accessToken);

      await context.updatePluginConfig({
        ...config,
        microsoftToken: freshToken,
        workbookId: created.workbookId,
        workbookUrl: created.workbookUrl,
      });

      context.logger.info('Microsoft Sheets: workbook created and header row written', {
        pluginId: plugin.id,
        workbookId: created.workbookId,
      });

      return created;
    };

    if (!workbookId) {
      const created = await initWorkbook();
      workbookId = created.workbookId;
    }

    // 5. Build and append the data row(s), recreating the workbook once (and retrying) if it
    // was deleted out from under this plugin.
    const appendRowsWithRecovery = async (rows: string[][]): Promise<void> => {
      try {
        await appendDataRows(workbookId!, worksheetName, rows, accessToken);
      } catch (err) {
        if (err instanceof WorkbookNotFoundError) {
          context.logger.warn('Microsoft Sheets: workbook was deleted — recreating', { pluginId: plugin.id });
          const recreated = await initWorkbook();
          workbookId = recreated.workbookId;
          await appendDataRows(workbookId, worksheetName, rows, accessToken);
        } else {
          throw err;
        }
      }
    };

    // A digest batch can carry up to DIGEST_RESPONSE_SAFETY_CEILING (5000) rows — chunked into
    // sequential requests to stay under Graph's request-body limit. Each chunk re-derives the
    // next empty row from the workbook's used range, so later chunks correctly append after the
    // rows the previous chunk just wrote.
    //
    // Recreation-on-delete must restart the WHOLE batch, not just the chunk that hit the 404: if
    // the workbook is deleted mid-batch (e.g. after chunk 2 of 5 has already been written) and
    // only the failed chunk were retried against the freshly recreated workbook, chunks 1-2 would
    // be silently lost — they were written to the now-gone workbook, and the new one would start
    // from chunk 3 onward. So the per-chunk loop runs OUTSIDE any recovery: a 404 anywhere in it
    // aborts the whole loop, the workbook is recreated once, and every chunk is re-appended from
    // the start against the new (empty) workbook.
    const appendAllRowsChunked = async (rows: string[][]): Promise<void> => {
      const writeAllChunks = async (): Promise<void> => {
        for (let i = 0; i < rows.length; i += MAX_ROWS_PER_APPEND_REQUEST) {
          const chunk = rows.slice(i, i + MAX_ROWS_PER_APPEND_REQUEST);
          await appendDataRows(workbookId!, worksheetName, chunk, accessToken);
        }
      };

      try {
        await writeAllChunks();
      } catch (err) {
        if (err instanceof WorkbookNotFoundError) {
          context.logger.warn(
            'Microsoft Sheets: workbook was deleted mid-digest-write — recreating and restarting the full batch',
            { pluginId: plugin.id }
          );
          const recreated = await initWorkbook();
          workbookId = recreated.workbookId;
          await writeAllChunks();
        } else {
          throw err;
        }
      }
    };

    if (digestResponses) {
      const rows = digestResponses.map((digestResponse) =>
        buildRowValues(digestResponse.data ?? {}, formSchema, digestResponse.id, digestResponse.submittedAt, fallbackKeys)
      );
      // Chunked into MAX_ROWS_PER_APPEND_REQUEST-row used-range-lookup+PATCH pairs, not one
      // pair per response.
      if (rows.length > 0) await appendAllRowsChunked(rows);
      const rowsAppended = rows.length;

      context.logger.info('Microsoft Sheets: digest rows appended', {
        pluginId: plugin.id,
        workbookId,
        rowsAppended,
      });

      return {
        success: true,
        workbookId,
        rowsAppended,
        syncedAt,
      } satisfies MicrosoftSheetsResult;
    }

    const responseData = (singleResponse!.data as Record<string, any>) ?? {};
    const submittedAt = String(
      responseData.submittedAt ?? (singleResponse as any).createdAt?.toISOString?.() ?? new Date().toISOString()
    );
    const rowValues = buildRowValues(responseData, formSchema, event.data.responseId, submittedAt, fallbackKeys);
    await appendRowsWithRecovery([rowValues]);

    context.logger.info('Microsoft Sheets: row appended', {
      pluginId: plugin.id,
      workbookId,
    });

    return {
      success: true,
      workbookId,
      rowAdded: true,
      syncedAt,
    } satisfies MicrosoftSheetsResult;
  } catch (error: any) {
    context.logger.error('Microsoft Sheets: unhandled error', {
      pluginId: plugin.id,
      error: error.message,
    });

    return {
      success: false,
      error: error.message,
      syncedAt,
    } satisfies MicrosoftSheetsResult;
  }
};
