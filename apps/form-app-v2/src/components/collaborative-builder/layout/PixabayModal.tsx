import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@dculus/ui-v2';

interface PixabayModalProps {
  isOpen: boolean;
  onClose: () => void;
  formId: string;
  onImageApplied: (imageKey: string) => void;
  onUploadSuccess: () => void;
}

/**
 * PixabayModal component - Browse and select images from Pixabay
 * TODO: Implement Pixabay integration
 */
export const PixabayModal: React.FC<PixabayModalProps> = ({
  isOpen,
  onClose,
  formId,
  onImageApplied,
  onUploadSuccess
}) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Browse Background Images</DialogTitle>
        </DialogHeader>
        <div className="p-8 text-center text-muted-foreground">
          <p>Pixabay image browser coming soon...</p>
          <p className="text-sm mt-2">Search and select from thousands of free background images</p>
        </div>
      </DialogContent>
    </Dialog>
  );
};
