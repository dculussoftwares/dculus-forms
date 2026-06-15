import type { PluginManifest } from '../types.js';

export const microsoftSheetsManifest: PluginManifest = {
  id: 'microsoft-sheets',
  name: 'Microsoft Excel',
  description:
    'Automatically append form responses to a Microsoft Excel workbook in OneDrive. Each submission creates a new row with all field values.',
  icon: 'TableProperties',
  iconColor: '#217346',
  iconBgColor: '#d6f0e0',
  category: 'Integration',
  available: true,
};
