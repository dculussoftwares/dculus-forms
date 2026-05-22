import type { PluginManifest } from '../types.js';

export const webhookManifest: PluginManifest = {
  id: 'webhook',
  name: 'Webhook',
  description:
    'Send HTTP POST requests to external URLs when events occur. Perfect for custom integrations and automation.',
  icon: 'Webhook',
  iconColor: '#8b6a18',
  iconBgColor: '#fbe19d',
  category: 'Integration',
  available: true,
};
