import type { PluginManifest } from '../types.js';

export const slackManifest: PluginManifest = {
  id: 'slack',
  name: 'Slack',
  description:
    'Post messages to Slack channels when form submissions or other events occur.',
  icon: 'MessageSquare',
  iconColor: '#2d6236',
  iconBgColor: '#c4e3ba',
  category: 'Notification',
  available: false,
  comingSoon: true,
};
