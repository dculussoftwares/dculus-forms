import type { PluginConfig } from '../core/types.js';
import type { SheetColumn } from '../core/sheetColumns.js';

export interface GoogleToken {
  accessToken: string;
  refreshToken: string;
  expiresAt: string; // ISO timestamp
  email: string;
}

export interface GoogleSheetsPluginConfig extends PluginConfig {
  type: 'google-sheets';
  googleToken?: GoogleToken;
  spreadsheetId?: string;
  spreadsheetUrl?: string;
  /** Persisted column layout of the spreadsheet; only ever grows (see core/sheetColumns.ts). */
  sheetColumns?: SheetColumn[];
}

export interface GoogleSheetsResult {
  success: boolean;
  spreadsheetId?: string;
  rowNumber?: number;
  /** Set instead of rowNumber for a digest batch write (schedule automation, #automations-digest) — one row per response in event.data.__digestResponses. */
  rowsAppended?: number;
  syncedAt: string;
  error?: string;
}
