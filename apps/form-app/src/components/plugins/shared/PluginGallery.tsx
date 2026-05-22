import React from 'react';
import { Badge, Button } from '@dculus/ui';
import { Webhook, Mail, MessageSquare, GraduationCap, LucideIcon } from 'lucide-react';

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
    iconColor: '#8b6a18',
    iconBgColor: '#fbe19d',
    category: 'Integration',
    available: true,
  },
  {
    id: 'email',
    name: 'Email Notification',
    description: 'Send custom email notifications with rich text and @ mentions when form events occur.',
    icon: Mail,
    iconColor: '#3c323e',
    iconBgColor: '#f8cdd8',
    category: 'Notification',
    available: true,
  },
  {
    id: 'quiz-grading',
    name: 'Quiz Auto-Grading',
    description: 'Automatically grade quiz responses with correct answers and scoring',
    icon: GraduationCap,
    iconColor: '#5c2e6b',
    iconBgColor: '#ddd6fa',
    category: 'Workflow',
    available: true,
  },
  {
    id: 'slack',
    name: 'Slack',
    description: 'Post messages to Slack channels when form submissions or other events occur.',
    icon: MessageSquare,
    iconColor: '#2d6236',
    iconBgColor: '#c4e3ba',
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
    <div
      className="rounded-xl bg-white overflow-hidden"
      style={{ border: '1px solid var(--tf-border-medium)', boxShadow: '0 1px 4px var(--tf-overlay)' }}
    >
      {filteredPlugins.map((plugin, i) => {
        const Icon = plugin.icon;
        const isDisabled = !plugin.available;

        return (
          <div
            key={plugin.id}
            className={`flex items-center gap-4 px-5 py-4 transition-colors ${
              isDisabled
                ? 'opacity-60 cursor-not-allowed'
                : 'hover:bg-[rgba(87,84,91,0.03)] cursor-pointer'
            }`}
            style={{ borderTop: i > 0 ? '1px solid var(--tf-border-light)' : undefined }}
            onClick={() => !isDisabled && onSelectPlugin(plugin)}
          >
            {/* Icon */}
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
              style={{ backgroundColor: plugin.iconBgColor }}
            >
              <Icon className="h-5 w-5" style={{ color: plugin.iconColor }} />
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-sm font-semibold text-[#3c323e]">{plugin.name}</span>
                <span
                  className="px-2 py-0.5 rounded-full text-[10px] font-medium"
                  style={{
                    backgroundColor: 'var(--tf-faint)',
                    color: 'var(--tf-muted)',
                    border: '1px solid var(--tf-border-medium)',
                  }}
                >
                  {plugin.category}
                </span>
                {plugin.comingSoon && (
                  <Badge variant="secondary" className="text-xs">
                    Coming Soon
                  </Badge>
                )}
              </div>
              <p className="text-xs text-[#655d67] leading-relaxed">
                {plugin.description}
              </p>
            </div>

            {/* Action */}
            {!isDisabled && (
              <div className="shrink-0">
                <Button
                  size="sm"
                  className="h-8 px-4 text-xs font-medium"
                  onClick={(e) => { e.stopPropagation(); onSelectPlugin(plugin); }}
                >
                  Connect
                </Button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
