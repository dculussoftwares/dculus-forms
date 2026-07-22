import React, { useState } from 'react';
import { Check, Trash2, Play } from 'lucide-react';
import { Button } from '@dculus/ui';
import { useTranslation } from '../../../../hooks';

interface FormFile {
  id: string;
  key: string;
  url: string;
  originalName: string;
  createdAt: string;
  mimeType?: string;
}

interface BackgroundImageGalleryProps {
  images: FormFile[];
  selectedImageKey?: string;
  onImageSelect: (imageKey: string) => void;
  onImageDelete?: (imageKey: string) => void;
}

export const BackgroundImageGallery: React.FC<BackgroundImageGalleryProps> = ({
  images,
  selectedImageKey,
  onImageSelect,
  onImageDelete
}) => {
  const { t } = useTranslation('backgroundImage');
  const [hoveredImage, setHoveredImage] = useState<string | null>(null);

  if (images.length === 0) {
    return (
      <div className="text-center py-6">
        <p className="text-sm text-muted-foreground dark:text-gray-400">
          {t('gallery.noImages')}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        {images.map((image) => (
          <div
            key={image.id}
            className="relative group cursor-pointer"
            onMouseEnter={() => setHoveredImage(image.id)}
            onMouseLeave={() => setHoveredImage(null)}
            onClick={() => onImageSelect(image.key)}
          >
            <div className={`relative overflow-hidden rounded-lg border-2 transition-all ${
              selectedImageKey === image.key
                ? 'border-purple-500 shadow-md'
                : 'border-[var(--tf-border-medium)] dark:border-gray-600 hover:border-purple-300'
            }`}>
              {image.mimeType?.startsWith('video/') ? (
                <>
                  <video
                    src={image.url}
                    muted
                    playsInline
                    preload="metadata"
                    className="w-full h-20 object-cover"
                  />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/20 pointer-events-none">
                    <Play className="w-5 h-5 text-white/90" />
                  </div>
                </>
              ) : (
                <img
                  src={image.url}
                  alt={image.originalName}
                  className="w-full h-20 object-cover"
                />
              )}

              {/* Selection indicator */}
              {selectedImageKey === image.key && (
                <div className="absolute top-1 right-1 bg-purple-500 text-white rounded-full p-1">
                  <Check className="w-3 h-3" />
                </div>
              )}
              
              {/* Delete button */}
              {onImageDelete && hoveredImage === image.id && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={(e) => {
                    e.stopPropagation();
                    onImageDelete(image.key);
                  }}
                  className="absolute top-1 left-1 bg-red-500 text-white rounded-full p-1 h-6 w-6 hover:bg-red-600"
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              )}
              
              {/* Overlay */}
              <div className={`absolute inset-0 bg-black transition-opacity ${
                hoveredImage === image.id ? 'opacity-20' : 'opacity-0'
              }`} />
            </div>
            
            <p className="text-xs text-foreground dark:text-gray-400 mt-1 truncate">
              {image.originalName}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};