import React, { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@apollo/client/react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  Button,
  Badge,
  LoadingSpinner,
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  toastSuccess,
  toastError,
} from '@dculus/ui';
import {
  Webhook,
  Mail,
  MessageSquare,
  GraduationCap,
  TableProperties,
  Tag,
  CheckCircle2,
  XCircle,
  Clock,
  ChevronDown,
  Power,
  PowerOff,
  PlayCircle,
  Trash2,
  Loader2,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

const safeFormatDistance = (dateVal: string | number | null | undefined): string => {
  if (!dateVal) return '—';
  try {
    // Handle both ISO strings and Unix ms timestamps (number or numeric string)
    const d = new Date(typeof dateVal === 'string' && /^\d+$/.test(dateVal) ? Number(dateVal) : dateVal);
    if (isNaN(d.getTime())) return String(dateVal);
    return formatDistanceToNow(d, { addSuffix: true });
  } catch {
    return String(dateVal);
  }
};
import {
  GET_FORM_PLUGINS,
  GET_PLUGIN_DELIVERIES,
  UPDATE_FORM_PLUGIN,
  DELETE_FORM_PLUGIN,
  TEST_FORM_PLUGIN,
} from '../../graphql/plugins';
import { getFrontendPlugin } from '../../plugins/core/registry';
import { useTranslation } from '../../hooks/useTranslation';
import '../../plugins/index';

type TabId = 'configure' | 'log';

interface Plugin {
  id: string;
  formId: string;
  type: string;
  name: string;
  enabled: boolean;
  config: any;
  events: string[];
  createdAt: string;
  updatedAt: string;
}

interface PluginDashboardModalProps {
  plugin: Plugin;
  form: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted: () => void;
  onUpdated: () => void;
}

const PLUGIN_ICON_MAP: Record<string, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
  webhook: Webhook,
  email: Mail,
  slack: MessageSquare,
  'quiz-grading': GraduationCap,
  'google-sheets': TableProperties,
  'microsoft-sheets': TableProperties,
  'ai-tagger': Tag,
};

const PLUGIN_ICON_STYLE: Record<string, { bg: string; color: string }> = {
  webhook:        { bg: '#fbe19d', color: '#8b6a18' },
  email:          { bg: 'var(--tf-icon-salmon)', color: 'var(--tf-dark)' },
  'quiz-grading': { bg: 'var(--tf-icon-lavender)', color: '#5c2e6b' },
  slack:          { bg: '#c4e3ba', color: '#2d6236' },
  'google-sheets':    { bg: '#c8e6c9', color: '#1a7340' },
  'microsoft-sheets': { bg: '#d6f0e0', color: '#217346' },
  'ai-tagger':        { bg: '#e8eaf6', color: '#3949ab' },
};

export const PluginDashboardModal: React.FC<PluginDashboardModalProps> = ({
  plugin,
  form,
  open,
  onOpenChange,
  onDeleted,
  onUpdated,
}) => {
  const { t } = useTranslation('pluginDashboard');
  const [activeTab, setActiveTab] = useState<TabId>('configure');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (open) setActiveTab('configure');
  }, [open]);
  const [isTogglingEnabled, setIsTogglingEnabled] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const isAnyLoading = isSaving || isTogglingEnabled || isTesting || isDeleting;

  const { data: deliveryData, loading: deliveryLoading, error: deliveryError, refetch: refetchDeliveries } = useQuery(
    GET_PLUGIN_DELIVERIES,
    {
      variables: { pluginId: plugin.id, limit: 50 },
      skip: !open,
      fetchPolicy: 'network-only',
    }
  );

  const [updatePlugin] = useMutation(UPDATE_FORM_PLUGIN);
  const [deletePlugin] = useMutation(DELETE_FORM_PLUGIN);
  const [testPlugin] = useMutation(TEST_FORM_PLUGIN);

  const deliveries: any[] = deliveryData?.pluginDeliveries ?? [];
  const total = deliveries.length;
  const succeeded = deliveries.filter((d) => d.status === 'success').length;
  const failed = deliveries.filter((d) => d.status === 'failed').length;
  const successRate = total > 0 ? Math.round((succeeded / total) * 100) : 0;
  const lastDelivery = deliveries[0]?.deliveredAt;

  const handleToggleEnabled = async () => {
    setIsTogglingEnabled(true);
    try {
      await updatePlugin({
        variables: { id: plugin.id, input: { enabled: !plugin.enabled } },
        refetchQueries: [{ query: GET_FORM_PLUGINS, variables: { formId: plugin.formId } }],
      });
      toastSuccess(
        plugin.enabled ? t('toasts.disabled') : t('toasts.enabled'),
        plugin.enabled
          ? t('toasts.disabledDescription', { values: { name: plugin.name } })
          : t('toasts.enabledDescription', { values: { name: plugin.name } })
      );
      onUpdated();
    } catch (error: any) {
      toastError(t('toasts.toggleError'), error.message);
    } finally {
      setIsTogglingEnabled(false);
    }
  };

  const handleTest = async () => {
    setIsTesting(true);
    try {
      const { data } = await testPlugin({ variables: { id: plugin.id } });
      toastSuccess(t('toasts.testTriggered'), data.testFormPlugin.message);
      // Refetch deliveries after a short delay to allow the async event to be processed
      setTimeout(() => refetchDeliveries(), 2500);
    } catch (error: any) {
      toastError(t('toasts.testFailed'), error.message);
    } finally {
      setIsTesting(false);
    }
  };

  const handleDelete = async () => {
    setShowDeleteDialog(false);
    setIsDeleting(true);
    try {
      await deletePlugin({ variables: { id: plugin.id } });
      toastSuccess(
        t('toasts.deleted'),
        t('toasts.deletedDescription', { values: { name: plugin.name } })
      );
      onOpenChange(false);
      onDeleted();
    } catch (error: any) {
      toastError(t('toasts.deleteError'), error.message);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSaveSettings = async (data: {
    type: string;
    name: string;
    config: any;
    events: string[];
  }) => {
    setIsSaving(true);
    try {
      await updatePlugin({
        variables: {
          id: plugin.id,
          input: { name: data.name, config: data.config, events: data.events },
        },
        refetchQueries: [{ query: GET_FORM_PLUGINS, variables: { formId: plugin.formId } }],
      });
      toastSuccess(
        t('settings.saveSuccess'),
        t('settings.saveSuccessDescription', { values: { name: data.name } })
      );
      onUpdated();
    } catch (error: any) {
      toastError(t('toasts.saveError'), error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const iconStyle = PLUGIN_ICON_STYLE[plugin.type] ?? { bg: 'var(--tf-icon-gray)', color: 'var(--tf-text)' };
  const IconComponent = PLUGIN_ICON_MAP[plugin.type] ?? Webhook;
  const frontendPlugin = getFrontendPlugin(plugin.type);
  const OverviewSummary = frontendPlugin?.OverviewSummary;
  const ConfigForm = frontendPlugin?.ConfigForm;

  const typeLabel = t(`types.${plugin.type}` as any) || plugin.type;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className="max-w-[800px] p-0 gap-0 overflow-hidden"
          onCloseAutoFocus={(e) => {
            e.preventDefault();
            document.body.style.pointerEvents = '';
          }}
        >
          {/* Visually-hidden title required by Radix Dialog for screen readers */}
          <DialogTitle className="sr-only">{plugin.name}</DialogTitle>

          {/* Top loading bar — visible during any async operation */}
          <div className="absolute top-0 left-0 w-full h-0.5 z-10 overflow-hidden">
            {isAnyLoading && (
              <div
                className="h-full animate-pulse"
                style={{
                  background: 'var(--tf-green)',
                  width: '100%',
                  opacity: 0.85,
                }}
              />
            )}
          </div>

          {/* Header */}
          <div
            className="flex items-center gap-3 px-5 py-4 pr-14"
            style={{ borderBottom: '1px solid var(--tf-border)' }}
          >
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{ backgroundColor: iconStyle.bg }}
            >
              <IconComponent className="h-5 w-5" style={{ color: iconStyle.color } as React.CSSProperties} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold truncate" style={{ color: 'var(--tf-dark)' }}>
                  {plugin.name}
                </span>
                <Badge
                  variant={plugin.enabled ? 'outline' : 'secondary'}
                  className={`shrink-0 text-[10px] ${plugin.enabled ? 'border-[var(--tf-green-bg-md)] bg-[var(--tf-green-bg)] text-[var(--tf-green)]' : ''}`}
                >
                  {plugin.enabled ? t('footer.enable').replace('Enable', 'Enabled') : t('footer.disable').replace('Disable', 'Disabled')}
                </Badge>
              </div>
              <p className="text-[11px]" style={{ color: 'var(--tf-muted)' }}>
                {typeLabel}
              </p>
            </div>
          </div>

          {/* Tabs */}
          <Tabs
            value={activeTab}
            onValueChange={(v) => {
              setActiveTab(v as TabId);
              if (v === 'log') refetchDeliveries();
            }}
          >
            <div className="px-5" style={{ borderBottom: '1px solid var(--tf-border)' }}>
              <TabsList className="border-b-0">
                {(['configure', 'log'] as TabId[]).map((tab) => (
                  <TabsTrigger key={tab} value={tab}>
                    {t(`tabs.${tab}` as any)}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>

          {/* Body — fixed height so popup never resizes on tab switch */}
          <div className="h-[420px] overflow-y-auto p-5">

            {/* ── CONFIGURE TAB (merged config + overview) ── */}
            <TabsContent value="configure" className="mt-0">
              <div className="space-y-5">
                {/* Config section */}
                {ConfigForm ? (
                  <ConfigForm
                    form={form}
                    initialData={plugin}
                    mode="edit"
                    isSaving={isSaving}
                    onSave={handleSaveSettings}
                    onCancel={() => {}}
                  />
                ) : (
                  <p className="text-sm text-center py-6" style={{ color: 'var(--tf-muted)' }}>
                    {t('configure.noSettings')}
                  </p>
                )}

                {/* Divider */}
                <hr style={{ borderColor: 'var(--tf-border-light)' }} />

                {/* Stats row */}
                <div className="grid grid-cols-4 gap-2.5">
                  {[
                    { label: t('overview.stats.totalDeliveries'), value: total, valueClass: '' },
                    { label: t('overview.stats.successRate'), value: `${successRate}%`, valueClass: 'text-[var(--tf-green)]' },
                    { label: t('overview.stats.failed'), value: failed, valueClass: failed > 0 ? 'text-[var(--tf-error)]' : '' },
                    {
                      label: t('overview.stats.lastDelivery'),
                      value: lastDelivery
                        ? safeFormatDistance(lastDelivery)
                        : t('overview.stats.never'),
                      valueClass: 'text-xs font-semibold',
                    },
                  ].map(({ label, value, valueClass }) => (
                    <div
                      key={label}
                      className="rounded-lg px-3 py-2.5 text-center"
                      style={{ background: 'var(--tf-faint)', border: '1px solid var(--tf-border-light)' }}
                    >
                      <p className={`text-base font-bold leading-tight ${valueClass}`} style={{ color: valueClass ? undefined : 'var(--tf-dark)' }}>
                        {deliveryLoading ? '—' : String(value)}
                      </p>
                      <p className="text-[10px] mt-0.5" style={{ color: 'var(--tf-muted)' }}>
                        {label}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Plugin-specific summary */}
                {OverviewSummary && (
                  <OverviewSummary config={plugin.config ?? {}} />
                )}

                {/* Recent activity */}
                <div>
                  <p
                    className="text-[10px] font-semibold uppercase tracking-wide mb-2"
                    style={{ color: 'var(--tf-light-muted)' }}
                  >
                    {t('overview.recentActivity')}
                  </p>
                  {deliveryLoading && (
                    <div className="flex justify-center py-6">
                      <LoadingSpinner />
                    </div>
                  )}
                  {deliveryError && (
                    <p className="text-xs text-center py-4" style={{ color: 'var(--tf-error)' }}>
                      {t('overview.errorDeliveries')}
                    </p>
                  )}
                  {!deliveryLoading && !deliveryError && deliveries.length === 0 && (
                    <div
                      className="rounded-lg px-4 py-6 text-center"
                      style={{ background: 'var(--tf-faint)', border: '1px solid var(--tf-border-light)' }}
                    >
                      <p className="text-xs" style={{ color: 'var(--tf-muted)' }}>
                        {t('overview.noActivity')}
                      </p>
                      <p className="text-[10px] mt-1" style={{ color: 'var(--tf-light-muted)' }}>
                        {t('overview.noActivityDescription')}
                      </p>
                    </div>
                  )}
                  {!deliveryLoading && !deliveryError && deliveries.length > 0 && (
                    <div className="space-y-1.5">
                      {deliveries.slice(0, 5).map((delivery) => (
                        <div
                          key={delivery.id}
                          className="flex items-center gap-2.5 px-3 py-2 rounded-lg"
                          style={
                            delivery.status === 'success'
                              ? { background: 'var(--tf-green-bg)', border: '1px solid var(--tf-green-bg-md)' }
                              : { background: 'var(--tf-error-bg)', border: '1px solid var(--tf-error-bg-md)' }
                          }
                        >
                          <div
                            className="w-1.5 h-1.5 rounded-full shrink-0"
                            style={{ background: delivery.status === 'success' ? 'var(--tf-green)' : 'var(--tf-error)' }}
                          />
                          <span className="flex-1 text-xs font-medium" style={{ color: 'var(--tf-text)' }}>
                            {delivery.eventType}
                          </span>
                          {delivery.status === 'failed' && delivery.errorMessage && (
                            <span className="text-[10px] italic truncate max-w-[140px]" style={{ color: 'var(--tf-error)' }}>
                              {delivery.errorMessage}
                            </span>
                          )}
                          <span className="text-[10px] shrink-0" style={{ color: 'var(--tf-light-muted)' }}>
                            {safeFormatDistance(delivery.deliveredAt)}
                          </span>
                        </div>
                      ))}
                      {deliveries.length > 5 && (
                        <button
                          className="w-full text-[10px] py-1.5 transition-colors"
                          style={{ color: 'var(--tf-muted)' }}
                          onClick={() => setActiveTab('log')}
                        >
                          {`View all ${deliveries.length} deliveries →`}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>

            {/* ── DELIVERY LOG TAB ── */}
            <TabsContent value="log" className="mt-0">
              <div>
                {deliveryLoading && (
                  <div className="flex justify-center py-10">
                    <LoadingSpinner />
                  </div>
                )}
                {deliveryError && (
                  <div className="text-center py-10">
                    <XCircle className="mx-auto h-8 w-8 mb-2" style={{ color: 'var(--tf-error)' }} />
                    <p className="text-sm" style={{ color: 'var(--tf-error)' }}>
                      {t('overview.errorDeliveries')}
                    </p>
                  </div>
                )}
                {!deliveryLoading && !deliveryError && deliveries.length === 0 && (
                  <div className="text-center py-10">
                    <Clock className="mx-auto h-8 w-8 mb-2" style={{ color: 'var(--tf-light-muted)' }} />
                    <p className="text-sm font-medium" style={{ color: 'var(--tf-dark)' }}>
                      {t('deliveryLog.empty')}
                    </p>
                    <p className="text-xs mt-1" style={{ color: 'var(--tf-muted)' }}>
                      {t('deliveryLog.emptyDescription')}
                    </p>
                  </div>
                )}
                {!deliveryLoading && !deliveryError && deliveries.length > 0 && (
                  <div className="space-y-2">
                    {deliveries.map((delivery) => (
                      <Collapsible key={delivery.id}>
                        <div
                          className="rounded-lg overflow-hidden"
                          style={{ border: '1px solid var(--tf-border-light)' }}
                        >
                          <CollapsibleTrigger className="w-full text-left">
                            <div className="flex items-center gap-3 px-4 py-3">
                              {delivery.status === 'success' ? (
                                <CheckCircle2 className="h-4 w-4 shrink-0" style={{ color: 'var(--tf-green)' }} />
                              ) : (
                                <XCircle className="h-4 w-4 shrink-0" style={{ color: 'var(--tf-error)' }} />
                              )}
                              <span className="flex-1 text-xs font-semibold" style={{ color: 'var(--tf-dark)' }}>
                                {delivery.eventType}
                              </span>
                              <Badge
                                variant={delivery.status === 'success' ? 'outline' : 'destructive'}
                                className={`text-[10px] ${delivery.status === 'success' ? 'border-[var(--tf-green-bg-md)] bg-[var(--tf-green-bg)] text-[var(--tf-green)]' : ''}`}
                              >
                                {delivery.status}
                              </Badge>
                              <span className="text-[10px]" style={{ color: 'var(--tf-light-muted)' }}>
                                {safeFormatDistance(delivery.deliveredAt)}
                              </span>
                              <ChevronDown className="h-3.5 w-3.5" style={{ color: 'var(--tf-muted)' }} />
                            </div>
                            {delivery.status === 'failed' && delivery.errorMessage && (
                              <div className="px-4 pb-3">
                                <p className="text-[10px] italic" style={{ color: 'var(--tf-error)' }}>
                                  {delivery.errorMessage}
                                </p>
                              </div>
                            )}
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <div
                              className="px-4 pb-4 space-y-3"
                              style={{ borderTop: '1px solid var(--tf-border-light)' }}
                            >
                              {delivery.payload && (
                                <div className="pt-3">
                                  <p className="text-[10px] font-semibold uppercase tracking-wide mb-1.5" style={{ color: 'var(--tf-light-muted)' }}>
                                    {t('deliveryLog.payload')}
                                  </p>
                                  <pre
                                    className="text-[10px] p-2.5 rounded overflow-x-auto"
                                    style={{ background: 'var(--tf-faint)', border: '1px solid var(--tf-border-light)', color: 'var(--tf-text)' }}
                                  >
                                    {JSON.stringify(delivery.payload, null, 2)}
                                  </pre>
                                </div>
                              )}
                              {delivery.response && (
                                <div>
                                  <p className="text-[10px] font-semibold uppercase tracking-wide mb-1.5" style={{ color: 'var(--tf-light-muted)' }}>
                                    {t('deliveryLog.response')}
                                  </p>
                                  <pre
                                    className="text-[10px] p-2.5 rounded overflow-x-auto"
                                    style={{ background: 'var(--tf-faint)', border: '1px solid var(--tf-border-light)', color: 'var(--tf-text)' }}
                                  >
                                    {typeof delivery.response === 'string'
                                      ? delivery.response
                                      : JSON.stringify(delivery.response, null, 2)}
                                  </pre>
                                </div>
                              )}
                              <div>
                                <p className="text-[10px] font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--tf-light-muted)' }}>
                                  {t('deliveryLog.deliveryId')}
                                </p>
                                <code className="text-[10px] px-2 py-0.5 rounded" style={{ background: 'var(--tf-faint)', color: 'var(--tf-text)' }}>
                                  {delivery.id}
                                </code>
                              </div>
                            </div>
                          </CollapsibleContent>
                        </div>
                      </Collapsible>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>
          </div>
          </Tabs>

          {/* Footer */}
          <div
            className="flex items-center gap-2 px-5 py-3"
            style={{ borderTop: '1px solid var(--tf-border)', background: 'var(--tf-faint)' }}
          >
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowDeleteDialog(true)}
              disabled={isDeleting}
              className="text-destructive hover:text-destructive hover:bg-destructive/5 h-8 px-3 text-xs"
            >
              {isDeleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5 mr-1.5" />}
              {t('footer.delete')}
            </Button>

            <div className="flex-1" />

            <Button
              variant="outline"
              size="sm"
              onClick={handleToggleEnabled}
              disabled={isTogglingEnabled}
              className="h-8 px-3 text-xs"
            >
              {isTogglingEnabled ? (
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              ) : plugin.enabled ? (
                <PowerOff className="h-3.5 w-3.5 mr-1.5" />
              ) : (
                <Power className="h-3.5 w-3.5 mr-1.5" />
              )}
              {plugin.enabled ? t('footer.disable') : t('footer.enable')}
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleTest}
              disabled={isTesting}
              className="h-8 px-3 text-xs"
            >
              {isTesting ? (
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              ) : (
                <PlayCircle className="h-3.5 w-3.5 mr-1.5" />
              )}
              {t('footer.test')}
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="h-8 px-3 text-xs"
            >
              {t('footer.close')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('deleteDialog.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('deleteDialog.description', { values: { name: plugin.name } })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowDeleteDialog(false)}>
              {t('deleteDialog.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              variant="destructive"
              className="bg-red-600 hover:bg-red-700"
            >
              {t('deleteDialog.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
