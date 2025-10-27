import React from 'react';
import { Check } from 'lucide-react';
import { ScrollArea } from '@dculus/ui-v2';

interface FormFile {
  id: string;
  key: string;
  url: string;
  originalName: string;
}

interface BackgroundImageGalleryProps {
  images: FormFile[];
  selectedImageKey?: string;
  onImageSelect: (imageKey: string) => void;
}

/**
 * BackgroundImageGallery component - Grid of uploaded background images
 */
export const BackgroundImageGallery: React.FC<BackgroundImageGalleryProps> = ({
  images,
  selectedImageKey,
  onImageSelect
}) => {
  if (images.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p className="text-sm">No images uploaded yet</p>
        <p className="text-xs mt-1">Upload your first background image</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-48">
      <div className="grid grid-cols-2 gap-2 pr-2">
        {images.map((image) => (
          <button
            key={image.id}
            onClick={() => onImageSelect(image.key)}
            className={`relative aspect-video rounded-lg border-2 overflow-hidden transition-all ${
              selectedImageKey === image.key
                ? 'border-purple-500 ring-2 ring-purple-200'
                : 'border-border hover:border-purple-300'
            }`}
          >
            <img
              src={image.url}
              alt={image.originalName}
              className="w-full h-full object-cover"
            />
            {selectedImageKey === image.key && (
              <div className="absolute inset-0 bg-purple-500/20 flex items-center justify-center">
                <div className="w-6 h-6 bg-purple-500 rounded-full flex items-center justify-center">
                  <Check className="w-4 h-4 text-white" />
                </div>
              </div>
            )}
          </button>
        ))}
      </div>
    </ScrollArea>
  );
};
