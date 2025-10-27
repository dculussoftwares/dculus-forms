import React from 'react';
import { Upload } from 'lucide-react';
import { Button } from '@dculus/ui-v2';

interface BackgroundImageUploadProps {
  formId: string;
  onUploadSuccess: () => void;
}

/**
 * BackgroundImageUpload component - Upload custom background images
 * TODO: Implement file upload functionality
 */
export const BackgroundImageUpload: React.FC<BackgroundImageUploadProps> = ({
  formId,
  onUploadSuccess
}) => {
  const handleFileSelect = () => {
    // TODO: Implement file upload
    console.log('Upload clicked for form:', formId);
  };

  return (
    <div className="space-y-2">
      <Button
        onClick={handleFileSelect}
        variant="outline"
        className="w-full"
      >
        <Upload className="w-4 h-4 mr-2" />
        Upload Background Image
      </Button>
      <p className="text-xs text-muted-foreground">
        Supported: JPG, PNG, WebP (max 5MB)
      </p>
    </div>
  );
};
