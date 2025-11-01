import React from 'react';
import { Settings, Cog, Info } from 'lucide-react';
import { useFormBuilderStore } from '../../../store/useFormBuilderStore';
import { useTranslation } from '../../../hooks';

export const SettingsTab: React.FC = () => {
  const { t } = useTranslation('settingsTab');
  const { pages, isShuffleEnabled, isConnected } = useFormBuilderStore();

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center space-x-3 p-6 border-b border-gray-200 dark:border-gray-700">
        <div className="p-2 bg-gray-100 dark:bg-gray-800 rounded-lg">
          <Settings className="w-5 h-5 text-gray-600 dark:text-gray-400" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {t('header.title')}
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {t('header.description')}
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-6">
        <div className="max-w-2xl mx-auto">
          {/* Coming Soon Card */}
          <div className="bg-gradient-to-br from-gray-50 to-blue-50 dark:from-gray-900/50 dark:to-blue-900/20 rounded-xl p-8 border border-gray-200 dark:border-gray-700">
            <div className="text-center">
              <div className="mx-auto w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
                <Cog className="w-8 h-8 text-gray-600 dark:text-gray-400" />
              </div>
              
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                {t('comingSoon.title')}
              </h3>
              
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                {t('comingSoon.description')}
              </p>

              {/* Current Settings Info */}
              <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                <div className="flex items-center space-x-2 mb-3">
                  <Info className="w-4 h-4 text-blue-500" />
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {t('currentState.title')}
                  </span>
                </div>
                <div className="space-y-2 text-sm text-left">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">{t('currentState.totalPages')}:</span>
                    <span className="text-gray-900 dark:text-white">{pages.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">{t('currentState.shuffleEnabled')}:</span>
                    <span className="text-gray-900 dark:text-white">
                      {isShuffleEnabled ? t('currentState.yes') : t('currentState.no')}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">{t('currentState.totalFields')}:</span>
                    <span className="text-gray-900 dark:text-white">
                      {pages.reduce((total: number, page: any) => total + page.fields.length, 0)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Collaboration Status */}
              {isConnected && (
                <div className="mt-4 flex items-center justify-center space-x-2 text-sm text-green-600 dark:text-green-400">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  <span>Real-time collaboration ready</span>
                </div>
              )}
            </div>
          </div>

          {/* Feature Preview */}
          <div className="mt-8">
            <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-4">
              Upcoming Settings:
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                'Form submission settings',
                'Email notifications',
                'Access permissions',
                'Response validation',
                'Export options',
                'Integration settings'
              ].map((feature, index) => (
                <div key={index} className="flex items-center space-x-2">
                  <div className="w-1.5 h-1.5 bg-gray-400 rounded-full" />
                  <span className="text-sm text-gray-600 dark:text-gray-400">{feature}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};