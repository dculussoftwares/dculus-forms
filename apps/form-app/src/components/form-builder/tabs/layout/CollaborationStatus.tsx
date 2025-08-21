import React from 'react';

interface CollaborationStatusProps {
  isConnected: boolean;
}

export const CollaborationStatus: React.FC<CollaborationStatusProps> = ({
  isConnected
}) => {
  if (!isConnected) return null;

  return (
    <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 border border-green-200 dark:border-green-800">
      <div className="flex items-center space-x-2 text-sm text-green-600 dark:text-green-400">
        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
        <span>Collaboration Active</span>
      </div>
      <p className="text-xs text-green-600/80 dark:text-green-400/80 mt-1">
        Layout changes sync in real-time
      </p>
    </div>
  );
};