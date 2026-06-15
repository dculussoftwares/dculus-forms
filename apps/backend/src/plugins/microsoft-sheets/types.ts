import type { PluginConfig } from '../core/types.js';

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
  /** Target worksheet name (defaults to "Sheet1") */
  worksheetName?: string;
}

export interface MicrosoftSheetsResult {
  success: boolean;
  workbookId?: string;
  rowAdded?: boolean;
  syncedAt: string;
  error?: string;
}
