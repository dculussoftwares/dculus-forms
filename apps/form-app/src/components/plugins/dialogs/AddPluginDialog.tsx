import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  Input,
} from '@dculus/ui';
import { Search, X } from 'lucide-react';
import { AVAILABLE_PLUGIN_TYPES, PLUGIN_ICON_MAP, PluginType } from '../shared/PluginGallery';
import { useTranslation } from '../../../hooks/useTranslation';

interface AddPluginDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPluginSelected: (pluginType: PluginType) => void;
}

export const AddPluginDialog: React.FC<AddPluginDialogProps> = ({
  open,
  onOpenChange,
  onPluginSelected,
}) => {
  const { t } = useTranslation('integrations');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const allCategoryIds = Array.from(new Set(AVAILABLE_PLUGIN_TYPES.map((p) => p.category)));
  const categories = [
    { id: 'all', name: t('categories.all'), count: AVAILABLE_PLUGIN_TYPES.length },
    ...allCategoryIds.map((cat) => ({
      id: cat,
      name: cat,
      count: AVAILABLE_PLUGIN_TYPES.filter((p) => p.category === cat).length,
    })),
  ];

  const filteredPlugins = AVAILABLE_PLUGIN_TYPES.filter((plugin) => {
    const matchesSearch =
      !searchQuery ||
      plugin.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      plugin.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || plugin.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col p-0">
        <div className="flex h-full overflow-hidden">

          {/* Left sidebar */}
          <aside
            className="w-56 shrink-0 p-5 space-y-4 border-r"
            style={{ borderColor: 'var(--tf-border-medium)' }}
          >
            <div>
              <DialogTitle className="text-sm font-semibold text-[#3c323e] leading-snug">
                {t('addPluginDialog.title')}
              </DialogTitle>
              <DialogDescription className="text-xs mt-1 text-[#655d67]">
                {t('addPluginDialog.description')}
              </DialogDescription>
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#655d67] pointer-events-none" />
              <Input
                placeholder={t('addPluginDialog.searchPlaceholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 pl-8 pr-7 text-xs"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#655d67] hover:text-[#3c323e] transition-colors"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>

            {/* Categories */}
            <div>
              <p className="text-[10px] font-semibold text-[#655d67] uppercase tracking-wider mb-2 px-1">
                {t('sidebar.categoriesHeading')}
              </p>
              <div className="space-y-0.5">
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`flex items-center justify-between w-full px-3 py-2 rounded-lg text-xs transition-colors ${
                      selectedCategory === cat.id
                        ? 'bg-[rgba(87,84,91,0.06)] text-[#3c323e] font-semibold'
                        : 'text-[#655d67] hover:bg-[rgba(87,84,91,0.04)] hover:text-[#4c414e]'
                    }`}
                  >
                    <span>{cat.name}</span>
                    <span
                      className="text-[10px]"
                      style={{ color: selectedCategory === cat.id ? '#3c323e' : '#a09aa2' }}
                    >
                      {cat.count}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </aside>

          {/* Right: plugin list */}
          <div className="flex-1 overflow-y-auto">
            {filteredPlugins.length === 0 ? (
              <div className="flex items-center justify-center h-full py-12">
                <p className="text-sm text-[#655d67]">
                  {t('addPluginDialog.noResults.message', { values: { searchQuery } })}
                </p>
              </div>
            ) : (
              filteredPlugins.map((plugin, i) => {
                const Icon = PLUGIN_ICON_MAP[plugin.icon];
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
                    onClick={() => !isDisabled && onPluginSelected(plugin)}
                  >
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
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
                          <span
                            className="px-2 py-0.5 rounded-full text-[10px] font-medium"
                            style={{
                              backgroundColor: 'var(--tf-faint)',
                              color: 'var(--tf-muted)',
                              border: '1px solid var(--tf-border)',
                            }}
                          >
                            Coming Soon
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[#655d67] leading-relaxed">{plugin.description}</p>
                    </div>

                    {!isDisabled && (
                      <div className="shrink-0">
                        <button
                          className="h-8 px-4 text-xs font-medium rounded-lg text-white transition-colors"
                          style={{ backgroundColor: '#3c323e' }}
                          onClick={(e) => { e.stopPropagation(); onPluginSelected(plugin); }}
                        >
                          {t('catalogSection.connectButton')}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
