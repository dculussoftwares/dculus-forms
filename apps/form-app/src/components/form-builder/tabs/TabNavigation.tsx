import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Palette, FileText, Settings, Eye, Users } from 'lucide-react';
import { Button } from '@dculus/ui';
import { cn } from '@dculus/utils';

export type BuilderTab = 'layout' | 'page-builder' | 'settings' | 'preview';

interface TabConfig {
  id: BuilderTab;
  label: string;
  icon: React.ElementType;
  description: string;
}

const TABS: TabConfig[] = [
  {
    id: 'layout',
    label: 'Layout',
    icon: Palette,
    description: 'Design and customize form layout'
  },
  {
    id: 'page-builder',
    label: 'Builder',
    icon: FileText,
    description: 'Build form pages with drag & drop'
  },
  {
    id: 'preview',
    label: 'Preview',
    icon: Eye,
    description: 'Preview form before publishing'
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: Settings,
    description: 'Configure form settings and options'
  }
];

interface TabNavigationProps {
  activeTab: BuilderTab;
  isConnected: boolean;
  collaboratorCount?: number;
  className?: string;
  position?: 'top' | 'bottom';
}

export const TabNavigation: React.FC<TabNavigationProps> = ({
  activeTab,
  isConnected,
  collaboratorCount = 0,
  className = '',
  position = 'bottom'
}) => {
  const navigate = useNavigate();
  const { formId } = useParams<{ formId: string }>();
  const [hoveredTab, setHoveredTab] = useState<BuilderTab | null>(null);
  const [isVisible, setIsVisible] = useState(true);

  const handleTabChange = (tabId: BuilderTab) => {
    if (formId) {
      navigate(`/dashboard/form/${formId}/collaborate/${tabId}`);
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

  const positionClasses = position === 'bottom' 
    ? 'fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50'
    : 'border-b border-gray-200 dark:border-gray-700';

  const containerClasses = position === 'bottom'
    ? `transition-all duration-300 ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-75'}`
    : '';

  return (
    <div className={`${positionClasses} ${className}`}>
      <div className={`${containerClasses}`}>
        {position === 'bottom' ? (
          // Floating tab design for bottom position
          <div className="bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-gray-200/50 dark:border-gray-700/50 px-2 py-2">
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
                        "relative w-12 h-12 rounded-xl transition-all duration-300 ease-out transform",
                        isActive
                          ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg scale-110 hover:from-blue-600 hover:to-purple-700'
                          : isHovered
                          ? 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 scale-105'
                          : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                      )}
                      aria-label={`Switch to ${tab.label} tab - ${tab.description}`}
                      role="tab"
                      aria-selected={isActive}
                    >
                      <Icon className={cn(
                        "w-5 h-5 transition-all duration-300",
                        isActive && 'drop-shadow-sm'
                      )} />

                    </Button>
                    
                    {/* Tooltip */}
                    <div className={`
                      absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2
                      bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900
                      px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap
                      transition-all duration-200
                      ${isHovered ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-1 pointer-events-none'}
                    `}>
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
                      variant={isActive ? "default" : "ghost"}
                      onClick={() => handleTabChange(tab.id)}
                      onKeyDown={(e) => handleKeyDown(e, tab.id)}
                      className={cn(
                        "flex items-center space-x-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                        isActive
                          ? 'bg-blue-50 text-blue-700 border-2 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800 hover:bg-blue-100'
                          : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50 border-2 border-transparent dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-800'
                      )}
                      aria-label={`Switch to ${tab.label} tab - ${tab.description}`}
                      role="tab"
                      aria-selected={isActive}
                    >
                      <Icon className={cn("w-4 h-4", isActive && 'text-blue-600 dark:text-blue-400')} />
                      <span>{tab.label}</span>
                    </Button>
                  );
                })}
              </div>

              {/* Collaboration Status */}
              <div className="flex items-center space-x-3">
                {isConnected && (
                  <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
                    <div className="flex items-center space-x-1">
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                      <span>Live</span>
                    </div>
                    {collaboratorCount > 0 && (
                      <div className="flex items-center space-x-1">
                        <Users className="w-4 h-4" />
                        <span>{collaboratorCount} collaborator{collaboratorCount !== 1 ? 's' : ''}</span>
                      </div>
                    )}
                  </div>
                )}
                
                {!isConnected && (
                  <div className="flex items-center space-x-2 text-sm text-yellow-600 dark:text-yellow-400">
                    <div className="w-2 h-2 bg-yellow-500 rounded-full" />
                    <span>Connecting...</span>
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
export const TabKeyboardShortcuts: React.FC<{ onTabChange: (tab: BuilderTab) => void }> = ({ onTabChange }) => {
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
            onTabChange('preview');
            break;
          case '4':
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