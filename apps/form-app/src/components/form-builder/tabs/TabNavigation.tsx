import React, { useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router';
import { FileText, GitBranch, Workflow, AlertTriangle } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, badgeVariants } from '@dculus/ui';
import { cn } from '@dculus/utils';
import { useTranslation } from '../../../hooks/useTranslation';

export type BuilderTab = 'content' | 'logic' | 'automations';

interface TabConfig {
  id: BuilderTab;
  label: string;
  icon: React.ElementType;
  description: string;
}

const getTabsConfig = (t: (key: string) => string): TabConfig[] => [
  {
    id: 'content',
    label: t('tabs.content.label'),
    icon: FileText,
    description: t('tabs.content.description'),
  },
  {
    id: 'logic',
    label: t('tabs.logic.label'),
    icon: GitBranch,
    description: t('tabs.logic.description'),
  },
  {
    id: 'automations',
    label: t('tabs.automations.label'),
    icon: Workflow,
    description: t('tabs.automations.description'),
  },
];

interface TabNavigationProps {
  activeTab: BuilderTab;
  className?: string;
  /** Total placed fields across all pages — rendered as a count badge on Content. See #167. */
  buildFieldCount?: number;
  /** Whether any condition rule has a circular reference — rendered as a warning badge on Logic. See #167. */
  logicHasWarning?: boolean;
}

// ── Journey rail (connected, ordered steps: Content → Logic → Automations). Preview and
// Settings are tools, not tabs — they live in FormBuilderHeader (▶ Preview button, ⚙ gear).
// See epic #226, ticket #227.
export const TabNavigation: React.FC<TabNavigationProps> = ({
  activeTab,
  className = '',
  buildFieldCount,
  logicHasWarning = false,
}) => {
  const navigate = useNavigate();
  const { formId } = useParams<{ formId: string }>();
  const { t } = useTranslation('tabNavigation');
  const TABS = getTabsConfig(t);

  const location = useLocation();
  const handleTabChange = (tabId: BuilderTab) => {
    if (formId) {
      navigate(`/dashboard/form/${formId}/builder/${tabId}${location.search}`);
    }
  };

  return (
    <div className={`flex items-stretch h-full ${className}`}>
      {/* Same Tabs/TabsTrigger look used everywhere else in the app (LayoutSidebar,
          PluginDashboardModal, etc.) — only the short connector segments between
          triggers are new, so the active/hover states never have to fight a custom
          background for visual precedence. */}
      <Tabs value={activeTab} onValueChange={(value) => handleTabChange(value as BuilderTab)}>
        <TabsList className="h-full items-center border-b-0 bg-transparent gap-0 p-0">
          {TABS.map((tab, index) => (
            <React.Fragment key={tab.id}>
              {index > 0 && (
                <span
                  className="w-3 h-px shrink-0 bg-[rgba(81,76,84,0.22)] dark:bg-white/15"
                  aria-hidden="true"
                />
              )}
              <TabsTrigger
                value={tab.id}
                className="gap-1.5"
                aria-label={t('aria.switchToTab', {
                  values: { label: tab.label, description: tab.description },
                })}
                title={tab.description}
                data-testid={`tab-${tab.id}`}
              >
                <tab.icon className="w-3.5 h-3.5 shrink-0" />
                <span>{tab.label}</span>
                {tab.id === 'content' && typeof buildFieldCount === 'number' && (
                  <span
                    className={cn(
                      badgeVariants({ variant: 'outline' }),
                      'px-1.5 py-0 text-[10px] leading-4 min-w-[1.25rem] justify-center'
                    )}
                    title={t(
                      buildFieldCount === 1
                        ? 'badges.build.fieldCount.single'
                        : 'badges.build.fieldCount.multiple',
                      { values: { count: buildFieldCount } }
                    )}
                    data-testid="tab-badge-build-count"
                  >
                    {buildFieldCount}
                  </span>
                )}
                {tab.id === 'logic' && logicHasWarning && (
                  <span
                    className={cn(
                      badgeVariants({ variant: 'outline' }),
                      'gap-0.5 px-1.5 py-0 text-[10px] leading-4 bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800'
                    )}
                    title={t('badges.logic.warning')}
                    data-testid="tab-badge-logic-warning"
                  >
                    <AlertTriangle className="w-2.5 h-2.5 text-amber-600 dark:text-amber-400" />
                    <span className="sr-only">{t('badges.logic.warning')}</span>
                  </span>
                )}
              </TabsTrigger>
            </React.Fragment>
          ))}
        </TabsList>
      </Tabs>
    </div>
  );
};

// Keyboard shortcuts component
export const TabKeyboardShortcuts: React.FC<{
  onTabChange: (tab: BuilderTab) => void;
}> = ({ onTabChange }) => {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey) {
        switch (event.key) {
          case '1':
            event.preventDefault();
            onTabChange('content');
            break;
          case '2':
            event.preventDefault();
            onTabChange('logic');
            break;
          case '3':
            event.preventDefault();
            onTabChange('automations');
            break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onTabChange]);

  return null;
};
