import { LayoutGrid, Eye, Palette, Settings } from 'lucide-react';
import { Button } from '@dculus/ui-v2';

type BuilderTab = 'page-builder' | 'preview' | 'layout' | 'settings';

interface TabNavigationProps {
  activeTab: BuilderTab;
  onTabChange: (tab: BuilderTab) => void;
}

const TABS = [
  {
    id: 'page-builder' as const,
    label: 'Page Builder',
    icon: LayoutGrid,
    shortcut: '1',
  },
  { id: 'preview' as const, label: 'Preview', icon: Eye, shortcut: '2' },
  { id: 'layout' as const, label: 'Layout', icon: Palette, shortcut: '3' },
  {
    id: 'settings' as const,
    label: 'Settings',
    icon: Settings,
    shortcut: '4',
  },
];

/**
 * Bottom tab navigation for the collaborative form builder
 * Allows switching between different builder views
 */
export function TabNavigation({ activeTab, onTabChange }: TabNavigationProps) {
  return (
    <nav className="h-14 border-t flex items-center justify-center gap-2 px-4 bg-background">
      {TABS.map((tab) => {
        const isActive = activeTab === tab.id;
        const Icon = tab.icon;

        return (
          <Button
            key={tab.id}
            variant={isActive ? 'default' : 'ghost'}
            onClick={() => onTabChange(tab.id)}
            className="flex items-center gap-2"
          >
            <Icon className="h-4 w-4" />
            <span className="hidden sm:inline">{tab.label}</span>
            <kbd className="hidden md:inline ml-2 text-xs opacity-60">
              ⌘{tab.shortcut}
            </kbd>
          </Button>
        );
      })}
    </nav>
  );
}
