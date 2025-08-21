import React from 'react';
import { Button, Card } from '@dculus/ui';
import { X } from 'lucide-react';

interface ConfirmationDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  variant?: 'destructive' | 'default';
}

export const ConfirmationDialog: React.FC<ConfirmationDialogProps> = ({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
  variant = 'default',
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50"
        onClick={onCancel}
      />
      
      {/* Dialog */}
      <Card className="relative w-full max-w-md mx-4 p-6 bg-white dark:bg-gray-800">
        {/* Close button */}
        <Button
          size="sm"
          variant="ghost"
          onClick={onCancel}
          className="absolute top-4 right-4 h-6 w-6 p-0"
        >
          <X className="w-4 h-4" />
        </Button>

        {/* Content */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {title}
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            {message}
          </p>
        </div>

        {/* Actions */}
        <div className="flex justify-end space-x-2 mt-6">
          <Button
            size="sm"
            variant="ghost"
            onClick={onCancel}
          >
            {cancelLabel}
          </Button>
          <Button
            size="sm"
            variant={variant === 'destructive' ? 'destructive' : 'default'}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </div>
      </Card>
    </div>
  );
};