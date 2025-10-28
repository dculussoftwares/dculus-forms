import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Palette, FileText, Settings, Eye } from 'lucide-react';
import { cn } from '@dculus/ui-v2';
import { useTranslate } from '@/i18n';

export type BuilderTab = 'layout' | 'page-builder' | 'preview' | 'settings';
type TabLabelKey =
  | 'collaborate.tabs.layout'
  | 'collaborate.tabs.pageBuilder'
  | 'collaborate.tabs.preview'
  | 'collaborate.tabs.settings';

interface TabConfig {
  id: BuilderTab;
  labelKey: TabLabelKey;
  icon: React.ElementType;
}

const TAB_CONFIG: TabConfig[] = [
  { id: 'layout', labelKey: 'collaborate.tabs.layout', icon: Palette },
  { id: 'page-builder', labelKey: 'collaborate.tabs.pageBuilder', icon: FileText },
  { id: 'preview', labelKey: 'collaborate.tabs.preview', icon: Eye },
  { id: 'settings', labelKey: 'collaborate.tabs.settings', icon: Settings },
];

export interface TabNavigationProps {
  activeTab: BuilderTab;
  isConnected: boolean;
  collaboratorCount?: number;
  className?: string;
}

export const TabNavigation = ({
  activeTab,
  isConnected,
  collaboratorCount = 0,
  className,
}: TabNavigationProps) => {
  const t = useTranslate();
  const navigate = useNavigate();
  const { formId } = useParams<{ formId: string }>();
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    let timeoutId: number | undefined;
    const handleScroll = () => {
      setIsVisible(false);
      if (timeoutId !== undefined) {
        window.clearTimeout(timeoutId);
      }
      timeoutId = window.setTimeout(() => setIsVisible(true), 150);
    };

    window.addEventListener('scroll', handleScroll);
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (timeoutId !== undefined) {
        window.clearTimeout(timeoutId);
      }
    };
  }, []);

  const handleTabChange = (tabId: BuilderTab) => {
    if (!formId || tabId === activeTab) return;
    navigate(`/dashboard/form/${formId}/collaborate/${tabId}`);
  };

  const collaboratorLabel =
    collaboratorCount === 1
      ? t('collaborate.footer.collaborator', { count: collaboratorCount })
      : t('collaborate.footer.collaborators', { count: collaboratorCount });

  return (
    <div
      className={cn(
        'pointer-events-none fixed bottom-6 left-1/2 z-40 w-full max-w-3xl -translate-x-1/2 px-4 transition-all duration-300',
        isVisible ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-80',
        className,
      )}
    >
      <div className="pointer-events-auto rounded-3xl border border-border/60 bg-background/95 shadow-2xl backdrop-blur">
        <div className="flex flex-col gap-3 px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-1 items-stretch justify-between gap-2 sm:justify-start">
            {TAB_CONFIG.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;

              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => handleTabChange(tab.id)}
                  className={cn(
                    'flex flex-1 items-center justify-center gap-2 rounded-2xl px-3 py-2 text-sm font-medium transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
                    isActive
                      ? 'bg-gradient-to-r from-primary to-primary/70 text-primary-foreground shadow-lg'
                      : 'bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground',
                  )}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <Icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{t(tab.labelKey)}</span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-center gap-3 text-xs font-medium text-muted-foreground sm:justify-end">
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  'h-2.5 w-2.5 rounded-full',
                  isConnected ? 'bg-emerald-500' : 'bg-amber-500',
                )}
                aria-hidden="true"
              />
              <span>
                {isConnected
                  ? t('collaborate.status.connected')
                  : t('collaborate.status.connecting')}
              </span>
            </div>
            {collaboratorCount > 0 ? (
              <div className="hidden items-center gap-1 sm:flex">
                <span className="text-muted-foreground/80">{collaboratorLabel}</span>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
};

export const TabKeyboardShortcuts = ({
  onTabChange,
}: {
  onTabChange: (tab: BuilderTab) => void;
}) => {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!event.metaKey && !event.ctrlKey) return;

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
          onTabChange('preview');
          break;
        case '4':
          event.preventDefault();
          onTabChange('settings');
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onTabChange]);

  return null;
};
