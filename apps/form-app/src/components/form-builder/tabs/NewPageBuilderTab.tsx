import React from 'react';
// import { useTranslation } from '../../../hooks';
// import { useFormBuilderStore } from '../../../store/useFormBuilderStore';
import { Card } from '@dculus/ui';

interface NewPageBuilderTabProps {
  sidebarWidth: number;
  onSidebarWidthChange: (width: number) => void;
  selectedFieldId: string | null;
  onFieldEdit: (fieldId: string) => void;
  onFieldUpdate: (updates: Record<string, any>) => void;
  onFieldDeselect: () => void;
}

// export const NewPageBuilderTab: React.FC<NewPageBuilderTabProps> = ({
//   sidebarWidth,
//   onSidebarWidthChange,
//   selectedFieldId,
//   onFieldEdit,
//   onFieldUpdate,
//   onFieldDeselect,
// }) => {
export const NewPageBuilderTab: React.FC<NewPageBuilderTabProps> = () => {
  // const { t } = useTranslation('pageBuilderTab');
  // const { pages } = useFormBuilderStore();

  return (
    <div className="flex h-full w-full bg-gray-50 dark:bg-gray-900">
      {/* Pending Implementation: Sidebar */}
      <div className="w-80 border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
        <h2 className="font-semibold text-lg mb-4">Builder Beta</h2>
        <p className="text-sm text-gray-500">
          Clean slate implementation of drag and drop using Handle-Only
          Architecture.
        </p>
      </div>

      {/* Pending Implementation: Canvas */}
      <div className="flex-1 p-8">
        <Card className="p-8 text-center text-gray-500 border-dashed">
          Drag and Drop Canvas (Coming Soon)
        </Card>
      </div>
    </div>
  );
};
