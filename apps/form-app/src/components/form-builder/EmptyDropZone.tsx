import React from 'react';
import { Plus } from 'lucide-react';

export const EmptyDropZone: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50/50 dark:bg-gray-800/50">
      <div className="w-12 h-12 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
        <Plus className="w-6 h-6 text-gray-400 dark:text-gray-500" />
      </div>
      <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
        No fields yet
      </h3>
      <p className="text-xs text-gray-500 dark:text-gray-400 text-center max-w-sm">
        Drag field types from the left panel to add them to this page, or use the quick add buttons above.
      </p>
    </div>
  );
};

export default EmptyDropZone;
