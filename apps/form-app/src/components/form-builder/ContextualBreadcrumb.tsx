import React from 'react';
import { Button } from '@dculus/ui';
import { ChevronRight, Home, FileText, Palette, Eye } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';

export type BuilderMode = 'content' | 'layout';

interface BreadcrumbItem {
  label: string;
  icon?: React.ElementType;
  onClick?: () => void;
  isActive?: boolean;
}

interface ContextualBreadcrumbProps {
  currentMode: BuilderMode;
  onModeChange: (mode: BuilderMode) => void;
  formTitle?: string;
  currentPageTitle?: string;
  onPreview?: () => void;
}

export const ContextualBreadcrumb: React.FC<ContextualBreadcrumbProps> = ({
  currentMode,
  onModeChange,
  formTitle,
  currentPageTitle,
  onPreview
}) => {
  const { t } = useTranslation('contextualBreadcrumb');
  const breadcrumbs: BreadcrumbItem[] = [
    {
      label: formTitle || t('defaultFormTitle'),
      icon: Home,
      onClick: () => {}, // Could navigate to form settings
    },
    {
      label: currentMode === 'content' ? t('modes.contentEditor') : t('modes.designEditor'),
      icon: currentMode === 'content' ? FileText : Palette,
      isActive: true
    }
  ];

  // Add page context for content mode
  if (currentMode === 'content' && currentPageTitle) {
    breadcrumbs.push({
      label: currentPageTitle,
      isActive: true
    });
  }

  return (
    <div className="flex items-center justify-between px-6 py-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
      {/* Breadcrumb */}
      <div className="flex items-center space-x-2 flex-1 min-w-0">
        {breadcrumbs.map((item, index) => {
          const Icon = item.icon;
          const isLast = index === breadcrumbs.length - 1;
          
          return (
            <React.Fragment key={index}>
              <Button
                variant="ghost"
                onClick={item.onClick}
                disabled={!item.onClick}
                className={`
                  flex items-center space-x-2 px-2 py-1 h-auto text-sm
                  ${item.isActive
                    ? 'text-blue-600 dark:text-blue-400 font-medium'
                    : item.onClick
                    ? 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                    : 'text-gray-600 dark:text-gray-400'
                  }
                `}
              >
                {Icon && <Icon className="w-4 h-4 flex-shrink-0" />}
                <span className="truncate max-w-32">{item.label}</span>
              </Button>
              {!isLast && (
                <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Actions */}
      <div className="flex items-center space-x-2">
        {/* Mode Switch */}
        <div className="flex items-center bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
          <Button
            onClick={() => onModeChange('content')}
            variant={currentMode === 'content' ? 'default' : 'ghost'}
            size="sm"
            className="text-xs px-3 py-1.5"
          >
            <FileText className="w-3 h-3 mr-1.5" />
            {t('modes.content')}
          </Button>
          <Button
            onClick={() => onModeChange('layout')}
            variant={currentMode === 'layout' ? 'default' : 'ghost'}
            size="sm"
            className="text-xs px-3 py-1.5"
          >
            <Palette className="w-3 h-3 mr-1.5" />
            {t('modes.design')}
          </Button>
        </div>

        {/* Preview */}
        {onPreview && (
          <Button onClick={onPreview} variant="outline" size="sm">
            <Eye className="w-4 h-4 mr-2" />
            {t('buttons.preview')}
          </Button>
        )}
      </div>
    </div>
  );
};