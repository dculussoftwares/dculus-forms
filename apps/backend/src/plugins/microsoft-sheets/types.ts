import type { PluginConfig } from '../core/types.js';
import type { SheetColumn } from '../core/sheetColumns.js';

export interface MicrosoftToken {
  accessToken: string;
  refreshToken: string;
  expiresAt: string; // ISO timestamp
  email: string;
  displayName: string;
}

export interface MicrosoftSheetsPluginConfig extends PluginConfig {
  type: 'microsoft-sheets';
  microsoftToken?: MicrosoftToken;
  /** Drive item ID of the workbook, set after first submission */
  workbookId?: string;
  /** Permanent web URL of the workbook, set after first submission */
  workbookUrl?: string;
  /** File name for the workbook (without .xlsx); when blank the form title is used. Renamed in OneDrive when changed. */
  workbookName?: string;
  /** Web URL of the folder the workbook was created in, so it can be opened without a live token. */
  workbookFolderUrl?: string;
  /** OneDrive folder the workbook is created in; fixed once the workbook exists. */
  destinationFolder?: { id: string; name: string };
  /** Target worksheet name (defaults to "Sheet1") */
  worksheetName?: string;
  /** Persisted column layout of the worksheet; only ever grows (see core/sheetColumns.ts). */
  sheetColumns?: SheetColumn[];
}

export interface MicrosoftSheetsResult {
  success: boolean;
  workbookId?: string;
  rowAdded?: boolean;
  /** Set instead of rowAdded for a digest batch write (schedule automation, #automations-digest) — one row per response in event.data.__digestResponses. */
  rowsAppended?: number;
  syncedAt: string;
  error?: string;
}
