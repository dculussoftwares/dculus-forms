import React from 'react';
import { Plus } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';

export const EmptyDropZone: React.FC = () => {
  const { t } = useTranslation('emptyDropZone');
  
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 border-2 border-dashed border-[rgba(81,76,84,0.15)] dark:border-gray-600 rounded-lg bg-[#f7f7f8]/50 dark:bg-gray-800/50">
      <div className="w-12 h-12 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
        <Plus className="w-6 h-6 text-[#655d67] dark:text-gray-500" />
      </div>
      <h3 className="text-sm font-medium text-[#3c323e] dark:text-white mb-2">
        {t('heading')}
      </h3>
      <p className="text-xs text-[#655d67] dark:text-gray-400 text-center max-w-sm">
        {t('description')}
      </p>
    </div>
  );
};

export default EmptyDropZone;
