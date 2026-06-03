import type { PluginManifest } from '../types.js';

export const aiTaggerManifest: PluginManifest = {
  id: 'ai-tagger',
  name: 'AI Auto-Tagger',
  description: 'Automatically tag responses using AI based on definitions you provide for each tag.',
  icon: 'Tag',
  iconColor: '#1d4ed8',
  iconBgColor: '#dbeafe',
  category: 'Workflow',
  available: true,
};
