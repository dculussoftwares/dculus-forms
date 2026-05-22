import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@apollo/client';
import { useTranslation } from '../hooks/useTranslation';
import { Button, LoadingSpinner, EmptyState, Input } from '@dculus/ui';
import { MainLayout } from '../components/MainLayout';
import { GET_FORM_BY_ID } from '../graphql/queries';
import { GET_FORM_PLUGINS } from '../graphql/plugins';
import { AlertCircle, Search, X } from 'lucide-react';
import { PluginCard } from '../components/plugins/shared/PluginCard';
import { PluginDeliveryLog } from '../components/plugins/shared/PluginDeliveryLog';
import { AVAILABLE_PLUGIN_TYPES, PLUGIN_ICON_MAP } from '../components/plugins/shared/PluginGallery';

const Plugins: React.FC = () => {
  const { formId } = useParams<{ formId: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation('plugins');

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [deliveryLogPlugin, setDeliveryLogPlugin] = useState<{ id: string; name: string } | null>(null);

  const { data: formData, loading: formLoading, error: formError } = useQuery(GET_FORM_BY_ID, {
    variables: { id: formId },
    skip: !formId,
  });

  const { data: pluginsData, loading: pluginsLoading, refetch: refetchPlugins } = useQuery(GET_FORM_PLUGINS, {
    variables: { formId },
    skip: !formId,
  });

  const handleEditPlugin = (plugin: any) =>
    navigate(`/dashboard/form/${formId}/plugins/${plugin.id}/edit`);
  const handleViewDeliveries = (plugin: any) =>
    setDeliveryLogPlugin({ id: plugin.id, name: plugin.name });
  const handleCloseDeliveryLog = () => setDeliveryLogPlugin(null);
  const handleConnect = (pluginTypeId: string) =>
    navigate(`/dashboard/form/${formId}/plugins/configure/${pluginTypeId}`);

  // Build category list
  const allCategoryIds = Array.from(new Set(AVAILABLE_PLUGIN_TYPES.map((p) => p.category)));
  const categories = [
    { id: 'all', name: t('categories.all'), count: AVAILABLE_PLUGIN_TYPES.length },
    ...allCategoryIds.map((cat) => ({
      id: cat,
      name: cat,
      count: AVAILABLE_PLUGIN_TYPES.filter((p) => p.category === cat).length,
    })),
  ];

  // Filter catalog by search + category
  const filteredCatalog = AVAILABLE_PLUGIN_TYPES.filter((plugin) => {
    const matchesSearch =
      !searchQuery ||
      plugin.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      plugin.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || plugin.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  if (formLoading) {
    return (
      <MainLayout
        title={t('layout.title')}
        breadcrumbs={[
          { label: t('layout.breadcrumbs.dashboard'), href: '/dashboard' },
          { label: t('layout.breadcrumbs.formDashboard'), href: `/dashboard/form/${formId}` },
          { label: t('layout.breadcrumbs.plugins') },
        ]}
      >
        <div className="flex justify-center items-center min-h-96">
          <LoadingSpinner />
        </div>
      </MainLayout>
    );
  }

  if (formError || !formData?.form) {
    return (
      <MainLayout
        title={t('layout.title')}
        breadcrumbs={[
          { label: t('layout.breadcrumbs.dashboard'), href: '/dashboard' },
          { label: t('layout.breadcrumbs.formDashboard'), href: `/dashboard/form/${formId}` },
          { label: t('layout.breadcrumbs.plugins') },
        ]}
      >
        <EmptyState
          variant="error"
          icon={<AlertCircle className="h-6 w-6 text-destructive" />}
          title={t('errors.formNotFound.title')}
          description={t('errors.formNotFound.description')}
        />
      </MainLayout>
    );
  }

  const form = formData.form;
  const plugins = pluginsData?.formPlugins || [];

  // Count active instances per plugin type
  const activeByType: Record<string, any[]> = plugins.reduce(
    (acc: Record<string, any[]>, p: any) => {
      if (!acc[p.type]) acc[p.type] = [];
      acc[p.type].push(p);
      return acc;
    },
    {}
  );

  return (
    <MainLayout
      title={t('layout.dynamicTitle', { values: { formTitle: form.title } })}
      breadcrumbs={[
        { label: t('layout.breadcrumbs.dashboard'), href: '/dashboard' },
        { label: form.title, href: `/dashboard/form/${formId}` },
        { label: t('layout.breadcrumbs.plugins') },
      ]}
    >
      {/* ── Two-column layout: sticky sidebar + integration content ── */}
      <div className="flex gap-6 items-start -mt-1">

        {/* ── LEFT SIDEBAR ── */}
        <aside className="w-64 shrink-0 self-start sticky top-0">
          <div
            className="rounded-xl bg-white p-5 space-y-5"
            style={{
              border: '1px solid var(--tf-border-medium)',
              boxShadow: '0 1px 4px var(--tf-overlay)',
            }}
          >
            {/* Title & subtitle */}
            <div>
              <h2 className="text-sm font-semibold leading-snug text-[#3c323e]">
                {t('sidebar.title', { values: { formTitle: form.title } })}
              </h2>
              <p className="text-xs mt-1.5 leading-relaxed text-[#655d67]">
                {t('sidebar.subtitle')}
              </p>
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#655d67] pointer-events-none" />
              <Input
                placeholder={t('sidebar.searchPlaceholder')}
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
          </div>
        </aside>

        {/* ── RIGHT CONTENT ── */}
        <div className="flex-1 space-y-5 min-w-0">
          {pluginsLoading ? (
            <div className="flex justify-center items-center py-16">
              <LoadingSpinner />
            </div>
          ) : (
            <>
              {/* Active integrations section */}
              {plugins.length > 0 && (
                <section>
                  <h3 className="text-[11px] font-semibold text-[#655d67] uppercase tracking-wider mb-2.5 px-0.5">
                    {t('activeSection.heading', { values: { count: plugins.length } })}
                  </h3>
                  <div
                    className="rounded-xl bg-white overflow-hidden"
                    style={{
                      border: '1px solid var(--tf-border-medium)',
                      boxShadow: '0 1px 4px var(--tf-overlay)',
                    }}
                  >
                    {plugins.map((plugin: any, i: number) => (
                      <div
                        key={plugin.id}
                        style={{
                          borderTop: i > 0 ? '1px solid var(--tf-border-light)' : undefined,
                        }}
                      >
                        <PluginCard
                          plugin={plugin}
                          onEdit={() => handleEditPlugin(plugin)}
                          onViewDeliveries={() => handleViewDeliveries(plugin)}
                          onDeleted={refetchPlugins}
                        />
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Integration catalog */}
              <section>
                {plugins.length > 0 && (
                  <h3 className="text-[11px] font-semibold text-[#655d67] uppercase tracking-wider mb-2.5 px-0.5">
                    {t('catalogSection.heading')}
                  </h3>
                )}

                {filteredCatalog.length === 0 ? (
                  <div
                    className="rounded-xl bg-white py-14 text-center"
                    style={{
                      border: '1px solid var(--tf-border-medium)',
                      boxShadow: '0 1px 4px var(--tf-overlay)',
                    }}
                  >
                    <p className="text-sm text-[#655d67]">
                      {t('catalogSection.noResults', { values: { searchQuery } })}
                    </p>
                  </div>
                ) : (
                  <div
                    className="rounded-xl bg-white overflow-hidden"
                    style={{
                      border: '1px solid var(--tf-border-medium)',
                      boxShadow: '0 1px 4px var(--tf-overlay)',
                    }}
                  >
                    {filteredCatalog.map((pluginType, i) => {
                      const Icon = PLUGIN_ICON_MAP[pluginType.icon];
                      const activeCount = activeByType[pluginType.id]?.length || 0;

                      return (
                        <div
                          key={pluginType.id}
                          className="flex items-center gap-4 px-5 py-4"
                          style={{
                            borderTop: i > 0 ? '1px solid var(--tf-border-light)' : undefined,
                          }}
                        >
                          {/* Integration icon */}
                          <div
                            className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                            style={{
                              backgroundColor: pluginType.iconBgColor,
                              opacity: pluginType.comingSoon ? 0.5 : 1,
                            }}
                          >
                            <Icon className="h-5 w-5" style={{ color: pluginType.iconColor }} />
                          </div>

                          {/* Name + description + badges */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="text-sm font-semibold text-[#3c323e]">
                                {pluginType.name}
                              </span>
                              {pluginType.comingSoon && (
                                <span
                                  className="px-2 py-0.5 rounded-full text-[10px] font-medium"
                                  style={{
                                    backgroundColor: 'var(--tf-faint)',
                                    color: 'var(--tf-muted)',
                                    border: '1px solid var(--tf-border)',
                                  }}
                                >
                                  {t('catalogSection.comingSoonLabel')}
                                </span>
                              )}
                              {activeCount > 0 && (
                                <span
                                  className="px-2 py-0.5 rounded-full text-[10px] font-medium"
                                  style={{
                                    backgroundColor: 'var(--tf-green-bg)',
                                    color: 'var(--tf-green)',
                                    border: '1px solid var(--tf-green-bg-md)',
                                  }}
                                >
                                  {t('catalogSection.activeCount', { values: { count: activeCount } })}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-[#655d67] leading-relaxed">
                              {pluginType.description}
                            </p>
                          </div>

                          {/* Connect / Add another button */}
                          <div className="shrink-0">
                            {!pluginType.comingSoon && (
                              <Button
                                size="sm"
                                variant={activeCount > 0 ? 'outline' : 'default'}
                                className="h-8 px-4 text-xs font-medium"
                                onClick={() => handleConnect(pluginType.id)}
                              >
                                {activeCount > 0
                                  ? t('catalogSection.addAnotherButton')
                                  : t('catalogSection.connectButton')}
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </div>

      {deliveryLogPlugin && (
        <PluginDeliveryLog
          open={true}
          onOpenChange={(open) => {
            if (!open) handleCloseDeliveryLog();
          }}
          pluginId={deliveryLogPlugin.id}
          pluginName={deliveryLogPlugin.name}
        />
      )}
    </MainLayout>
  );
};

export default Plugins;
