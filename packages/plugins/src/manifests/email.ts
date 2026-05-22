import type { PluginManifest } from '../types.js';

export const emailManifest: PluginManifest = {
  id: 'email',
  name: 'Email Notification',
  description:
    'Send custom email notifications with rich text and @ mentions when form events occur.',
  icon: 'Mail',
  iconColor: '#3c323e',
  iconBgColor: '#f8cdd8',
  category: 'Notification',
  available: true,
};
