import React from 'react';
import { Info } from 'lucide-react';
import { FormLayout, LayoutCode } from '@dculus/types';
import { useTranslation } from '../../../../hooks/useTranslation';

interface LayoutInfoCardProps {
  layout: FormLayout;
  currentLayoutCode: LayoutCode;
  isConnected: boolean;
  getLayoutName: (code: LayoutCode) => string;
}

export const LayoutInfoCard: React.FC<LayoutInfoCardProps> = ({
  layout,
  currentLayoutCode,
  isConnected,
  getLayoutName
}) => {
  const { t } = useTranslation('layoutOptions');
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
      <div className="flex items-center space-x-2 mb-4">
        <Info className="w-5 h-5 text-blue-500" />
        <span className="text-lg font-medium text-gray-900 dark:text-white">
          {t('infoCard.title')}
        </span>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-3">
          <div className="flex justify-between items-center py-2 px-3 bg-gray-50 dark:bg-gray-700 rounded">
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">{t('labels.layout')}</span>
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-900 dark:text-white">
                {getLayoutName(currentLayoutCode)}
              </span>
              <span className="text-xs font-mono bg-purple-100 dark:bg-purple-900/30 px-2 py-1 rounded text-purple-600 dark:text-purple-400">
                {currentLayoutCode}
              </span>
            </div>
          </div>
          
          <div className="flex justify-between items-center py-2 px-3 bg-gray-50 dark:bg-gray-700 rounded">
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">{t('labels.theme')}</span>
            <span className="text-sm text-gray-900 dark:text-white capitalize">{layout?.theme || 'light'}</span>
          </div>
          
          <div className="flex justify-between items-center py-2 px-3 bg-gray-50 dark:bg-gray-700 rounded">
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">{t('labels.spacing')}</span>
            <span className="text-sm text-gray-900 dark:text-white capitalize">{layout?.spacing || 'normal'}</span>
          </div>
        </div>
        
        <div className="flex items-center justify-center">
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 w-full">
            <p className="text-xs text-gray-600 dark:text-gray-400 mb-2 text-center">{t('infoCard.preview')}</p>
            <div className="text-xs text-gray-600 dark:text-gray-400 text-center">
              {getLayoutName(currentLayoutCode)} {t('infoCard.layoutSuffix')}
            </div>
          </div>
        </div>
      </div>

      {/* Collaboration Status */}
      {isConnected && (
        <div className="mt-4 flex items-center justify-center space-x-2 text-sm text-green-600 dark:text-green-400">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          <span>{t('infoCard.collaborationActive')}</span>
        </div>
      )}
    </div>
  );
};