import React from 'react';
import { FormPage, FormSchema, FormLayout, serializeFormSchema } from '@dculus/types';
import { Button } from '@dculus/ui';

interface JSONPreviewProps {
  pages: FormPage[];
  layout: FormLayout;
  isShuffleEnabled: boolean;
}

export const JSONPreview: React.FC<JSONPreviewProps> = ({ pages, layout, isShuffleEnabled }) => {
  console.log('🔍 JSONPreview received props:', {
    pages: pages?.length || 0,
    layout: !!layout,
    isShuffleEnabled,
    layoutTheme: layout?.theme,
    layoutContent: layout?.content?.substring(0, 50) + '...'
  });
  
  const formSchema: FormSchema = {
    pages,
    layout,
    isShuffleEnabled
  };
  
  const serializedSchema = serializeFormSchema(formSchema);
  const jsonString = JSON.stringify(serializedSchema, null, 2);
  
  const handleCopyToClipboard = () => {
    navigator.clipboard.writeText(jsonString);
  };
  
  return (
    <div className="p-4 h-full flex flex-col w-full">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-medium text-gray-900 dark:text-white">
          FormSchema JSON
        </h4>
        <Button
          size="sm"
          variant="outline"
          onClick={handleCopyToClipboard}
          className="h-7 px-2 text-xs"
        >
          Copy
        </Button>
      </div>
      
      <div className="flex-1 relative w-full min-w-0">
        <pre className="bg-gray-50 dark:bg-gray-800 rounded-md p-3 text-xs font-mono overflow-x-auto overflow-y-auto h-full border border-gray-200 dark:border-gray-700 whitespace-pre w-full max-w-full">
          <code className="text-gray-700 dark:text-gray-300 block min-w-max">
            {jsonString}
          </code>
        </pre>
      </div>
      
      <div className="mt-3 text-xs text-gray-500 dark:text-gray-400">
        Total fields: {pages.reduce((sum, page) => sum + page.fields.length, 0)}
      </div>
    </div>
  );
};