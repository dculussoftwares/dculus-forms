import React from 'react';
import { FormLayout, LayoutCode } from '@dculus/types';

interface LayoutOptionsProps {
  layout: FormLayout;
  currentLayoutCode: LayoutCode;
}

export const LayoutOptions: React.FC<LayoutOptionsProps> = ({
  layout,
  currentLayoutCode
}) => {
  return (
    <div>
      <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
        Layout Options
      </h4>
      <div className="space-y-2 text-sm">
        <div className="flex justify-between items-center">
          <span className="text-gray-600 dark:text-gray-400">Current:</span>
          <span className="text-gray-900 dark:text-white font-mono">
            {currentLayoutCode}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-gray-600 dark:text-gray-400">Theme:</span>
          <span className="text-gray-900 dark:text-white capitalize">
            {layout?.theme || 'light'}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-gray-600 dark:text-gray-400">Spacing:</span>
          <span className="text-gray-900 dark:text-white capitalize">
            {layout?.spacing || 'normal'}
          </span>
        </div>
      </div>
    </div>
  );
};