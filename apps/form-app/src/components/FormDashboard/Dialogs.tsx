import React from 'react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
  Button,
} from '@dculus/ui';
import { Copy, ExternalLink } from 'lucide-react';

interface DeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  formTitle: string;
  loading: boolean;
}

interface UnpublishDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  formTitle: string;
  loading: boolean;
}

interface CollectResponsesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  formUrl: string;
  formTitle: string;
  onCopyLink: () => void;
  onOpenForm: () => void;
}

export const DeleteDialog: React.FC<DeleteDialogProps> = ({
  open,
  onOpenChange,
  onConfirm,
  formTitle,
  loading,
}) => {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Form</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete "{formTitle}"? This action cannot be
            undone and will permanently delete the form and all its responses.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => onOpenChange(false)}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            variant="destructive"
            className="bg-red-600 hover:bg-red-700"
          >
            {loading ? 'Deleting...' : 'Delete Form'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export const UnpublishDialog: React.FC<UnpublishDialogProps> = ({
  open,
  onOpenChange,
  onConfirm,
  formTitle,
  loading,
}) => {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Unpublish Form</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to unpublish "{formTitle}"? This will make the
            form unavailable to users and stop accepting new responses.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => onOpenChange(false)}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-orange-600 hover:bg-orange-700"
          >
            {loading ? 'Unpublishing...' : 'Unpublish Form'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export const CollectResponsesDialog: React.FC<CollectResponsesDialogProps> = ({
  open,
  onOpenChange,
  formUrl,
  formTitle,
  onCopyLink,
  onOpenForm,
}) => {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle>Collect Responses</AlertDialogTitle>
          <AlertDialogDescription>
            Share this link to collect responses for "{formTitle}"
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="py-4">
          <div className="flex items-center space-x-2 p-3 bg-gray-50 rounded-lg border">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-mono text-gray-700 truncate">
                {formUrl}
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={onCopyLink}
              className="flex-shrink-0"
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => onOpenChange(false)}>
            Close
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onOpenForm}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <ExternalLink className="mr-2 h-4 w-4" />
            Open Form
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};