import React from 'react';
import { Button } from '@dculus/ui';
import { Plus } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';

interface EmptyFormStateProps {
  onCreatePage: () => void;
  isConnected: boolean;
}

export const EmptyFormState: React.FC<EmptyFormStateProps> = ({ onCreatePage, isConnected }) => {
  const { t } = useTranslation('emptyFormState');
  
  return (
    <div className="flex flex-col items-center justify-center h-full">
      <div className="text-center max-w-md">
        <div className="w-20 h-20 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center mx-auto mb-6">
          <Plus className="w-10 h-10 text-blue-600 dark:text-blue-400" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
          {t('heading')}
        </h2>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          {t('description')}
        </p>
        <Button 
          onClick={onCreatePage}
          disabled={!isConnected}
          size="lg"
        >
          <Plus className="w-5 h-5 mr-2" />
          {t('createButton')}
        </Button>
      </div>
    </div>
  );
};