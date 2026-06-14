import type { PluginManifest } from '../types.js';

export const googleSheetsManifest: PluginManifest = {
  id: 'google-sheets',
  name: 'Google Sheets',
  description:
    'Automatically append form responses to a Google Sheet. Each submission creates a new row with all field values.',
  icon: 'TableProperties',
  iconColor: '#1a7340',
  iconBgColor: '#c8e6c9',
  category: 'Integration',
  available: true,
};
