import type { PluginConfig } from '../core/types.js';

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
}

export interface GoogleSheetsResult {
  success: boolean;
  spreadsheetId?: string;
  rowNumber?: number;
  syncedAt: string;
  error?: string;
}
