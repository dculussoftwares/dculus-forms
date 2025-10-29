import React from 'react';
import { TypographyH1, TypographyP, Button } from '@dculus/ui';
import { FileText, Plus } from 'lucide-react';

interface MissingFormIdProps {}

export const MissingFormId: React.FC<MissingFormIdProps> = () => (
  <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
    <div className="text-center space-y-6 max-w-md mx-auto px-6">
      <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900 rounded-2xl flex items-center justify-center mx-auto">
        <FileText className="w-8 h-8 text-blue-600 dark:text-blue-400" />
      </div>
      <div className="space-y-2">
        <TypographyH1 className="text-2xl font-semibold text-gray-900 dark:text-white">
          Form ID Required
        </TypographyH1>
        <TypographyP className="text-gray-600 dark:text-gray-400">
          Please provide a valid form ID to start building your form.
        </TypographyP>
      </div>
    </div>
  </div>
);

interface EmptyFormStateProps {
  onAddPage: () => void;
  isConnected: boolean;
}

export const EmptyFormState: React.FC<EmptyFormStateProps> = ({
  onAddPage,
  isConnected,
}) => (
  <div className="text-center py-16">
    <div className="w-20 h-20 bg-gradient-to-r from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
      <Plus className="w-10 h-10 text-white" />
    </div>
    <TypographyH1 className="text-3xl font-semibold text-gray-900 dark:text-white mb-3">
      Create your first page
    </TypographyH1>
    <TypographyP className="text-lg text-gray-600 dark:text-gray-400 mb-8 max-w-md mx-auto">
      Start building your form by adding your first page. You can add questions,
      collect responses, and collaborate in real-time.
    </TypographyP>
    <Button
      onClick={onAddPage}
      disabled={!isConnected}
      size="lg"
      className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white px-8 py-3 text-lg font-medium"
    >
      <Plus className="mr-2 h-5 w-5" />
      Add your first page
    </Button>
    {!isConnected && (
      <TypographyP className="text-sm text-amber-600 dark:text-amber-400 mt-4">
        Waiting for connection to enable editing...
      </TypographyP>
    )}
  </div>
);
