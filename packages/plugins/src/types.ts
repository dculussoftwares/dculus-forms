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
}
