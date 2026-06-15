import { deserializeFormSchema } from '@dculus/types';
import type { PluginHandler } from '../core/types.js';
import type { GoogleSheetsPluginConfig, GoogleSheetsResult, GoogleToken } from './types.js';

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
    await context.prisma.formPlugin.update({
      where: { id: pluginId },
      data: {
        config: { ...config, googleToken: newToken } as any,
      },
    });

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
 * Appends a data row to the spreadsheet and returns the row number from the
 * updatedRange in the API response (e.g. "Sheet1!A5:Z5" → 5).
 */
const appendDataRow = async (
  spreadsheetId: string,
  rowValues: string[],
  accessToken: string
): Promise<number | undefined> => {
  const url =
    `${SHEETS_API_BASE}/spreadsheets/${spreadsheetId}/values/Sheet1!A1:append` +
    `?valueInputOption=RAW&insertDataOption=INSERT_ROWS`;

  const response = await fetch(url, {
    method: 'POST',
    headers: authHeaders(accessToken),
    body: JSON.stringify({ values: [rowValues] }),
  });

  if (response.status === 404) throw new SpreadsheetNotFoundError();

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Failed to append data row: ${response.status} ${body}`);
  }

  const data = await response.json() as any;

  // Parse row number from updatedRange, e.g. "Sheet1!A5:Z5" → 5
  const updatedRange: string | undefined = data.updates?.updatedRange;
  if (updatedRange) {
    const match = updatedRange.match(/:(?:[A-Z]+)(\d+)$/);
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

    // Fetch the response to build row values
    if (!event.data.responseId) {
      return {
        success: false,
        error: 'No responseId in event data',
        syncedAt,
      } satisfies GoogleSheetsResult;
    }

    const response = await context.getResponseById(event.data.responseId);
    if (!response) {
      return {
        success: false,
        error: `Response not found: ${event.data.responseId}`,
        syncedAt,
      } satisfies GoogleSheetsResult;
    }

    const responseData = (response.data as Record<string, any>) ?? {};

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
        const skipKeys = new Set(['responseId', 'submittedAt']);
        for (const key of Object.keys(responseData)) {
          if (!skipKeys.has(key)) fieldHeaders.push(key);
        }
      }
      return [...fieldHeaders, 'Submitted At', 'Response ID'];
    };

    const initSpreadsheet = async (): Promise<{ spreadsheetId: string; spreadsheetUrl: string }> => {
      const formTitle = form?.title?.trim() || 'Form Responses';
      const sheetTitle = `${formTitle} — Responses`;

      context.logger.info('Google Sheets: creating new spreadsheet', {
        pluginId: plugin.id,
        title: sheetTitle,
      });

      const created = await createSpreadsheet(sheetTitle, accessToken);
      await writeHeaderRow(created.spreadsheetId, buildHeaders(), accessToken);

      await context.prisma.formPlugin.update({
        where: { id: plugin.id },
        data: {
          config: { ...config, googleToken: freshToken, spreadsheetId: created.spreadsheetId, spreadsheetUrl: created.spreadsheetUrl } as any,
        },
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

    // Append metadata columns (must match header order)
    const submittedAt =
      responseData.submittedAt ??
      (response as any).createdAt?.toISOString?.() ??
      new Date().toISOString();
    rowValues.push(String(submittedAt));
    rowValues.push(event.data.responseId);

    let rowNumber: number | undefined;
    try {
      rowNumber = await appendDataRow(spreadsheetId, rowValues, accessToken);
    } catch (err) {
      if (err instanceof SpreadsheetNotFoundError) {
        context.logger.warn('Google Sheets: spreadsheet was deleted — recreating', { pluginId: plugin.id });
        const recreated = await initSpreadsheet();
        spreadsheetId = recreated.spreadsheetId;
        rowNumber = await appendDataRow(spreadsheetId, rowValues, accessToken);
      } else {
        throw err;
      }
    }

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
