import ExcelJS from 'exceljs';
import { deserializeFormSchema } from '@dculus/types';
import type { PluginHandler } from '../core/types.js';
import type {
  MicrosoftSheetsPluginConfig,
  MicrosoftSheetsResult,
  MicrosoftToken,
} from './types.js';

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

    await context.prisma.formPlugin.update({
      where: { id: pluginId },
      data: {
        config: { ...config, microsoftToken: newToken } as any,
      },
    });

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
 * Appends a data row by finding the next empty row after the used range and
 * writing to it. Returns true on success.
 */
const appendDataRow = async (
  workbookId: string,
  worksheetName: string,
  rowValues: string[],
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

  // 2. Write the new row at nextRow
  const columnCount = rowValues.length;
  const lastCol = columnIndexToLetter(columnCount - 1);
  const range = `A${nextRow}:${lastCol}${nextRow}`;
  const url = `${GRAPH_BASE}/me/drive/items/${workbookId}/workbook/worksheets('${encodeURIComponent(worksheetName)}')/range(address='${range}')`;

  const response = await fetch(url, {
    method: 'PATCH',
    headers: authHeaders(accessToken),
    body: JSON.stringify({
      values: [rowValues],
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

    // 3. Fetch the response record
    if (!event.data.responseId) {
      return {
        success: false,
        error: 'No responseId in event data',
        syncedAt,
      } satisfies MicrosoftSheetsResult;
    }

    const response = await context.getResponseById(event.data.responseId);
    if (!response) {
      return {
        success: false,
        error: `Response not found: ${event.data.responseId}`,
        syncedAt,
      } satisfies MicrosoftSheetsResult;
    }

    const responseData = (response.data as Record<string, any>) ?? {};

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
        const skipKeys = new Set(['responseId', 'submittedAt']);
        for (const key of Object.keys(responseData)) {
          if (!skipKeys.has(key)) fieldHeaders.push(key);
        }
      }
      return [...fieldHeaders, 'Submitted At', 'Response ID'];
    };

    const initWorkbook = async (): Promise<{ workbookId: string; workbookUrl: string }> => {
      const formTitle = form?.title?.trim() || 'Form Responses';
      // Append short plugin ID suffix to prevent collisions when two forms share the same title
      const workbookTitle = `${formTitle} — Responses (${plugin.id.slice(0, 8)})`;

      context.logger.info('Microsoft Sheets: creating new workbook', {
        pluginId: plugin.id,
        title: workbookTitle,
      });

      const created = await createWorkbook(workbookTitle, worksheetName, accessToken);
      await writeHeaderRow(created.workbookId, worksheetName, buildHeaders(), accessToken);

      await context.prisma.formPlugin.update({
        where: { id: plugin.id },
        data: {
          config: {
            ...config,
            microsoftToken: freshToken,
            workbookId: created.workbookId,
            workbookUrl: created.workbookUrl,
          } as any,
        },
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

    // 5. Build and append the data row
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
      const skipKeys = new Set(['responseId', 'submittedAt']);
      for (const [key, value] of Object.entries(responseData)) {
        if (skipKeys.has(key)) continue;
        rowValues.push(String(value ?? ''));
      }
    }

    const submittedAt =
      responseData.submittedAt ??
      (response as any).createdAt?.toISOString?.() ??
      new Date().toISOString();
    rowValues.push(String(submittedAt));
    rowValues.push(event.data.responseId);

    try {
      await appendDataRow(workbookId, worksheetName, rowValues, accessToken);
    } catch (err) {
      if (err instanceof WorkbookNotFoundError) {
        context.logger.warn('Microsoft Sheets: workbook was deleted — recreating', { pluginId: plugin.id });
        const recreated = await initWorkbook();
        workbookId = recreated.workbookId;
        await appendDataRow(workbookId, worksheetName, rowValues, accessToken);
      } else {
        throw err;
      }
    }

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
