import React from 'react';
import { Card, Badge } from '@dculus/ui';
import { Webhook, Mail, MessageSquare, LucideIcon } from 'lucide-react';

export interface PluginType {
  id: string;
  name: string;
  description: string;
  icon: LucideIcon;
  iconColor: string;
  iconBgColor: string;
  category: string;
  available: boolean;
  comingSoon?: boolean;
}

export const AVAILABLE_PLUGIN_TYPES: PluginType[] = [
  {
    id: 'webhook',
    name: 'Webhook',
    description: 'Send HTTP POST requests to external URLs when events occur. Perfect for custom integrations and automation.',
    icon: Webhook,
    iconColor: 'text-orange-600',
    iconBgColor: 'bg-orange-100',
    category: 'Integration',
    available: true,
  },
  {
    id: 'email',
    name: 'Email Notification',
    description: 'Send email notifications to team members or submitters when form events occur.',
    icon: Mail,
    iconColor: 'text-blue-600',
    iconBgColor: 'bg-blue-100',
    category: 'Notification',
    available: false,
    comingSoon: true,
  },
  {
    id: 'slack',
    name: 'Slack',
    description: 'Post messages to Slack channels when form submissions or other events occur.',
    icon: MessageSquare,
    iconColor: 'text-purple-600',
    iconBgColor: 'bg-purple-100',
    category: 'Notification',
    available: false,
    comingSoon: true,
  },
];

interface PluginGalleryProps {
  onSelectPlugin: (pluginType: PluginType) => void;
  selectedCategory?: string;
}

export const PluginGallery: React.FC<PluginGalleryProps> = ({
  onSelectPlugin,
  selectedCategory,
}) => {
  const filteredPlugins = selectedCategory
    ? AVAILABLE_PLUGIN_TYPES.filter((p) => p.category === selectedCategory)
    : AVAILABLE_PLUGIN_TYPES;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {filteredPlugins.map((plugin) => {
        const Icon = plugin.icon;
        const isDisabled = !plugin.available;

        return (
          <Card
            key={plugin.id}
            className={`p-6 transition-all ${
              isDisabled
                ? 'opacity-60 cursor-not-allowed'
                : 'hover:border-orange-300 hover:shadow-md cursor-pointer'
            }`}
            onClick={() => !isDisabled && onSelectPlugin(plugin)}
          >
            <div className="flex flex-col h-full">
              {/* Icon and Badge */}
              <div className="flex items-start justify-between mb-4">
                <div className={`p-3 rounded-lg ${plugin.iconBgColor}`}>
                  <Icon className={`h-6 w-6 ${plugin.iconColor}`} />
                </div>
                {plugin.comingSoon && (
                  <Badge variant="secondary" className="text-xs">
                    Coming Soon
                  </Badge>
                )}
              </div>

              {/* Content */}
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900 mb-2">{plugin.name}</h3>
                <p className="text-sm text-gray-600 leading-relaxed">
                  {plugin.description}
                </p>
              </div>

              {/* Category Badge */}
              <div className="mt-4 pt-4 border-t">
                <Badge variant="outline" className="text-xs">
                  {plugin.category}
                </Badge>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
};
