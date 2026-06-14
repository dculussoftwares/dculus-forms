import React from 'react';
import { Badge, Button } from '@dculus/ui';
import { Webhook, Mail, MessageSquare, GraduationCap, Tag, TableProperties, type LucideIcon } from 'lucide-react';
import { allPluginManifests, type PluginManifest } from '@dculus/plugins';

export const PLUGIN_ICON_MAP: Record<string, LucideIcon> = {
  Webhook,
  Mail,
  GraduationCap,
  MessageSquare,
  Tag,
  TableProperties,
};

export type { PluginManifest as PluginType };
export { allPluginManifests as AVAILABLE_PLUGIN_TYPES };

interface PluginGalleryProps {
  onSelectPlugin: (plugin: PluginManifest) => void;
  selectedCategory?: string;
}

export const PluginGallery: React.FC<PluginGalleryProps> = ({
  onSelectPlugin,
  selectedCategory,
}) => {
  const filteredPlugins = selectedCategory
    ? allPluginManifests.filter((p) => p.category === selectedCategory)
    : allPluginManifests;

  return (
    <div
      className="rounded-xl bg-white overflow-hidden"
      style={{ border: '1px solid var(--tf-border-medium)', boxShadow: '0 1px 4px var(--tf-overlay)' }}
    >
      {filteredPlugins.map((plugin, i) => {
        const Icon = PLUGIN_ICON_MAP[plugin.icon] ?? Webhook;
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
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
              style={{ backgroundColor: plugin.iconBgColor }}
            >
              <Icon className="h-5 w-5" style={{ color: plugin.iconColor }} />
            </div>

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
              <p className="text-xs text-[#655d67] leading-relaxed">{plugin.description}</p>
            </div>

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
