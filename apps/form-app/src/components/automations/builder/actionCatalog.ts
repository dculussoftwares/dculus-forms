import { allPluginManifests, type PluginManifest } from '@dculus/plugins';
import { Webhook, Mail, MessageSquare, TableProperties, type LucideIcon } from 'lucide-react';

export const ACTION_ICON_MAP: Record<string, LucideIcon> = {
  Webhook,
  Mail,
  MessageSquare,
  TableProperties,
};

/**
 * Automation action nodes only support a fixed subset of the plugin catalog (#197):
 * email, webhook, slack, google-sheets, microsoft-sheets. Quiz grading and the AI tagger
 * are per-response plugins, not something that fits a step in a workflow, so they're
 * excluded here even though they're registered plugin types.
 *
 * Quiz grading is also deprecated as of #303 — native quiz mode (Form Settings → Quiz)
 * replaces it — so it would be excluded from new automations either way.
 *
 * Slack stays in the list (matching the Plugins gallery) but its manifest is still
 * `available: false` — no backend handler is registered for it yet — so it renders
 * disabled with a "coming soon" badge, same as everywhere else in the app.
 */
const AUTOMATION_ACTION_TYPES = ['email', 'webhook', 'slack', 'google-sheets', 'microsoft-sheets'] as const;

export const automationActionManifests: PluginManifest[] = AUTOMATION_ACTION_TYPES.map((id) =>
  allPluginManifests.find((m) => m.id === id)
).filter((m): m is PluginManifest => Boolean(m));

export const getActionManifest = (actionType: string): PluginManifest | undefined =>
  allPluginManifests.find((m) => m.id === actionType);
