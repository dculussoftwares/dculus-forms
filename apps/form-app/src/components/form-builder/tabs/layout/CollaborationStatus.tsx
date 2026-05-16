import React from 'react';
import { useTranslation } from '../../../../hooks';

interface CollaborationStatusProps {
  isConnected: boolean;
}

export const CollaborationStatus: React.FC<CollaborationStatusProps> = ({
  isConnected
}) => {
  const { t } = useTranslation('collaborationStatus');
  
  if (!isConnected) return null;

  return (
    <div className="bg-primary/5 dark:bg-primary/10 rounded-lg p-3 border border-primary/20 dark:border-primary/30">
      <div className="flex items-center space-x-2 text-sm text-primary">
        <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
        <span>{t('collaborationActive')}</span>
      </div>
      <p className="text-xs text-primary/80 mt-1">
        {t('layoutChangesSync')}
      </p>
    </div>
  );
};