import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router';
import { Palette, FileText, Eye, GitBranch, Settings, CheckCircle, Users } from 'lucide-react';
import { Button, Tabs, TabsList, TabsTrigger } from '@dculus/ui';
import { cn } from '@dculus/utils';
import { useTranslation } from '../../../hooks/useTranslation';

export type BuilderTab =
  | 'layout'
  | 'page-builder'
  | 'preview'
  | 'conditions'
  | 'finish'
  | 'settings';

interface TabConfig {
  id: BuilderTab;
  label: string;
  icon: React.ElementType;
  description: string;
}

// Journey rail (connected, ordered steps) vs. tools cluster (Preview/Settings — reachable
// from any step, not part of the journey order). See epic #170.
const RAIL_TAB_IDS: BuilderTab[] = ['layout', 'page-builder', 'conditions', 'finish'];
const TOOL_TAB_IDS: BuilderTab[] = ['preview', 'settings'];

const getTabsConfig = (t: (key: string) => string): TabConfig[] => [
  {
    id: 'layout',
    label: t('tabs.design.label'),
    icon: Palette,
    description: t('tabs.design.description'),
  },
  {
    id: 'page-builder',
    label: t('tabs.pageBuilder.label'),
    icon: FileText,
    description: t('tabs.pageBuilder.description'),
  },

  {
    id: 'preview',
    label: t('tabs.preview.label'),
    icon: Eye,
    description: t('tabs.preview.description'),
  },
  {
    id: 'conditions',
    label: t('tabs.conditions.label'),
    icon: GitBranch,
    description: t('tabs.conditions.description'),
  },
  {
    id: 'finish',
    label: t('tabs.finish.label'),
    icon: CheckCircle,
    description: t('tabs.finish.description'),
  },
  {
    id: 'settings',
    label: t('tabs.settings.label'),
    icon: Settings,
    description: t('tabs.settings.description'),
  },
];

interface TabNavigationProps {
  activeTab: BuilderTab;
  isConnected: boolean;
  collaboratorCount?: number;
  className?: string;
  position?: 'top' | 'bottom' | 'inline';
}

export const TabNavigation: React.FC<TabNavigationProps> = ({
  activeTab,
  isConnected,
  collaboratorCount = 0,
  className = '',
  position = 'bottom',
}) => {
  const navigate = useNavigate();
  const { formId } = useParams<{ formId: string }>();
  const [hoveredTab, setHoveredTab] = useState<BuilderTab | null>(null);
  const [isVisible, setIsVisible] = useState(true);
  const { t } = useTranslation('tabNavigation');
  const TABS = getTabsConfig(t);

  const location = useLocation();
  const handleTabChange = (tabId: BuilderTab) => {
    if (formId) {
      navigate(`/dashboard/form/${formId}/builder/${tabId}${location.search}`);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent, tabId: BuilderTab) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleTabChange(tabId);
    }
  };

  // Auto-hide on scroll (for bottom position)
  useEffect(() => {
    if (position !== 'bottom') return;

    let timeoutId: NodeJS.Timeout;
    const handleScroll = () => {
      setIsVisible(false);
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => setIsVisible(true), 150);
    };

    window.addEventListener('scroll', handleScroll);
    return () => {
      window.removeEventListener('scroll', handleScroll);
      clearTimeout(timeoutId);
    };
  }, [position]);

  // ── Inline mode: journey rail (Design → Build → Logic) + a separate tools cluster ──
  if (position === 'inline') {
    const findTab = (id: BuilderTab) => TABS.find((tab) => tab.id === id)!;
    const railTabs = RAIL_TAB_IDS.map(findTab);
    const toolTabs = TOOL_TAB_IDS.map(findTab);

    return (
      <div className={`flex items-stretch h-full ${className}`}>
        {/* ── Journey rail: connected steps, in order. Same Tabs/TabsTrigger look used
            everywhere else in the app (LayoutSidebar, PluginDashboardModal, etc.) — only
            the short connector segments between triggers are new, so the active/hover
            states never have to fight a custom background for visual precedence. ── */}
        <Tabs value={activeTab} onValueChange={(value) => handleTabChange(value as BuilderTab)}>
          <TabsList className="h-full items-center border-b-0 bg-transparent gap-0 p-0">
            {railTabs.map((tab, index) => (
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
                </TabsTrigger>
              </React.Fragment>
            ))}
          </TabsList>
        </Tabs>

        {/* ── Divider between the journey rail and the tools cluster ── */}
        <div className="flex items-center px-2" aria-hidden="true">
          <div className="w-px h-5 border-l border-dashed border-[var(--tf-border-medium)] dark:border-white/10" />
        </div>

        {/* ── Tools cluster: Preview + Settings — off the rail, reachable from any step ── */}
        <div className="flex items-stretch">
          {toolTabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <Button
                key={tab.id}
                variant="ghost"
                onClick={() => handleTabChange(tab.id)}
                onKeyDown={(e) => handleKeyDown(e, tab.id)}
                className="relative flex items-center gap-1.5 px-3 text-sm font-medium transition-colors focus:outline-none h-full rounded-none"
                style={{ color: isActive ? 'var(--tf-dark)' : 'var(--tf-muted)' }}
                aria-current={isActive ? 'page' : undefined}
                title={tab.description}
                data-testid={`tab-${tab.id}`}
              >
                <tab.icon className="w-3.5 h-3.5 shrink-0" />
                <span>{tab.label}</span>
                {/* Typeform underline indicator */}
                {isActive && (
                  <span
                    className="absolute bottom-[-1px] left-0 right-0 h-[2px] rounded-t-full"
                    style={{ backgroundColor: 'var(--tf-dark)' }}
                  />
                )}
              </Button>
            );
          })}
        </div>
      </div>
    );
  }

  // `bottom` and default/`top` modes below aren't used by the current header (the only call
  // site, CollaborativeFormBuilder.tsx, always passes position="inline") — left as-is, out of scope for this ticket.
  const positionClasses =
    position === 'bottom'
      ? 'fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50'
      : 'border-b border-[var(--tf-border-medium)] dark:border-gray-700';

  const containerClasses =
    position === 'bottom'
      ? `transition-all duration-300 ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-75'}`
      : '';

  return (
    <div className={`${positionClasses} ${className}`}>
      <div className={`${containerClasses}`}>
        {position === 'bottom' ? (
          // Floating tab design for bottom position
          <div className="bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-[var(--tf-border-medium)]/50 dark:border-gray-700/50 px-2 py-2">
            <div className="flex items-center space-x-1">
              {TABS.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                const isHovered = hoveredTab === tab.id;

                return (
                  <div key={tab.id} className="relative group">
                     <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleTabChange(tab.id)}
                      onKeyDown={(e) => handleKeyDown(e, tab.id)}
                      onMouseEnter={() => setHoveredTab(tab.id)}
                      onMouseLeave={() => setHoveredTab(null)}
                      className={cn(
                        'relative w-12 h-12 rounded-xl transition-all duration-300 ease-out transform',
                        isActive
                          ? 'bg-primary text-primary-foreground hover:text-primary-foreground shadow-lg scale-110 hover:bg-primary/90'
                          : isHovered
                            ? 'bg-background dark:bg-gray-800 text-foreground dark:text-gray-300 scale-105'
                            : 'text-muted-foreground dark:text-gray-400 hover:text-foreground dark:hover:text-gray-300'
                      )}
                      aria-label={t('aria.switchToTab', {
                        values: {
                          label: tab.label,
                          description: tab.description,
                        },
                      })}
                      role="tab"
                      aria-selected={isActive}
                      data-testid={`tab-${tab.id}`}
                    >
                      <Icon
                        className={cn(
                          'w-5 h-5 transition-all duration-300',
                          isActive && 'drop-shadow-sm'
                        )}
                      />
                    </Button>

                    {/* Tooltip */}
                    <div
                      className={`
                      absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2
                      bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900
                      px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap
                      transition-all duration-200
                      ${isHovered ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-1 pointer-events-none'}
                    `}
                    >
                      {tab.label}
                      <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900 dark:border-t-gray-100" />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          // Traditional top navigation
          <div className="bg-white dark:bg-gray-900">
            <div className="flex items-center justify-between px-6 py-3">
              {/* Tab Navigation */}
              <div className="flex items-center space-x-1">
                {TABS.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;

                  return (
                    <Button
                      key={tab.id}
                      variant={isActive ? 'default' : 'ghost'}
                      onClick={() => handleTabChange(tab.id)}
                      onKeyDown={(e) => handleKeyDown(e, tab.id)}
                      className={cn(
                        'flex items-center space-x-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200',
                        isActive
                          ? 'bg-primary/10 text-primary border-2 border-primary/30 hover:bg-primary/20 dark:bg-primary/20 dark:text-primary dark:border-primary/40'
                          : 'text-muted-foreground hover:text-foreground hover:bg-muted/40 border-2 border-transparent dark:hover:bg-muted/60'
                      )}
                      aria-label={t('aria.switchToTab', {
                        values: {
                          label: tab.label,
                          description: tab.description,
                        },
                      })}
                      role="tab"
                      aria-selected={isActive}
                    >
                      <Icon
                        className={cn('w-4 h-4', isActive && 'text-primary')}
                      />
                      <span>{tab.label}</span>
                    </Button>
                  );
                })}
              </div>

              {/* Collaboration Status */}
              <div className="flex items-center space-x-3">
                {isConnected && (
                  <div className="flex items-center space-x-2 text-sm text-foreground dark:text-gray-400">
                    <div className="flex items-center space-x-1">
                      <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
                      <span>{t('collaboration.live')}</span>
                    </div>
                    {collaboratorCount > 0 && (
                      <div className="flex items-center space-x-1">
                        <Users className="w-4 h-4" />
                        <span>
                          {collaboratorCount === 1
                            ? t('collaboration.collaborators.single', {
                                values: { count: collaboratorCount },
                              })
                            : t('collaboration.collaborators.multiple', {
                                values: { count: collaboratorCount },
                              })}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {!isConnected && (
                  <div className="flex items-center space-x-2 text-sm text-yellow-600 dark:text-yellow-400">
                    <div className="w-2 h-2 bg-yellow-500 rounded-full" />
                    <span>{t('collaboration.connecting')}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
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
            onTabChange('layout');
            break;
          case '2':
            event.preventDefault();
            onTabChange('page-builder');
            break;
          case '3':
            event.preventDefault();
            onTabChange('conditions');
            break;
          case '4':
            event.preventDefault();
            onTabChange('finish');
            break;
          case '5':
            event.preventDefault();
            onTabChange('preview');
            break;
          case '6':
            event.preventDefault();
            onTabChange('settings');
            break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onTabChange]);

  return null;
};
