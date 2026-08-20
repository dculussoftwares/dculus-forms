export type PluginCategory = 'Integration' | 'Notification' | 'Workflow';

export interface PluginManifest {
  id: string;
  name: string;
  description: string;
  icon: string;
  iconColor: string;
  iconBgColor: string;
  category: PluginCategory;
  available: boolean;
  comingSoon?: boolean;
  /** True once this plugin type is retired in favor of a native feature. New instances are blocked; existing ones keep working. */
  deprecated?: boolean;
  /** User-facing explanation shown wherever `deprecated` is rendered — what replaces this plugin and where to find it. */
  deprecationMessage?: string;
}
