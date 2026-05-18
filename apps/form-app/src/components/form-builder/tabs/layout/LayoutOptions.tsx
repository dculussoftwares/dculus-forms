import React from 'react';
import { FormLayout, LayoutCode } from '@dculus/types';
import { useTranslation } from '../../../../hooks/useTranslation';

interface LayoutOptionsProps {
  layout: FormLayout;
  currentLayoutCode: LayoutCode;
}

export const LayoutOptions: React.FC<LayoutOptionsProps> = ({
  layout,
  currentLayoutCode
}) => {
  const { t } = useTranslation('layoutOptions');
  
  return (
    <div>
      <h4 className="text-sm font-medium text-[#3c323e] dark:text-white mb-2">
        {t('title')}
      </h4>
      <div className="space-y-2 text-sm">
        <div className="flex justify-between items-center">
          <span className="text-[#4c414e] dark:text-gray-400">{t('labels.current')}</span>
          <span className="text-[#3c323e] dark:text-white font-mono">
            {currentLayoutCode}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-[#4c414e] dark:text-gray-400">{t('labels.theme')}</span>
          <span className="text-[#3c323e] dark:text-white capitalize">
            {layout?.theme || t('values.light')}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-[#4c414e] dark:text-gray-400">{t('labels.spacing')}</span>
          <span className="text-[#3c323e] dark:text-white capitalize">
            {layout?.spacing || t('values.normal')}
          </span>
        </div>
      </div>
    </div>
  );
};