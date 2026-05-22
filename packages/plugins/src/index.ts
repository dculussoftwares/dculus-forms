export type { PluginManifest, PluginCategory } from './types.js';

export { webhookManifest } from './manifests/webhook.js';
export { emailManifest } from './manifests/email.js';
export { quizManifest } from './manifests/quiz.js';
export { slackManifest } from './manifests/slack.js';

import { webhookManifest } from './manifests/webhook.js';
import { emailManifest } from './manifests/email.js';
import { quizManifest } from './manifests/quiz.js';
import { slackManifest } from './manifests/slack.js';
import type { PluginManifest } from './types.js';

export const allPluginManifests: PluginManifest[] = [
  webhookManifest,
  emailManifest,
  quizManifest,
  slackManifest,
];
