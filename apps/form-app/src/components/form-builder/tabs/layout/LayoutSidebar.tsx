import React, { useState } from 'react';
import { Palette, Image, Search } from 'lucide-react';
import { FormLayout, LayoutCode } from '@dculus/types';
import { Tabs, TabsList, TabsTrigger, TabsContent, Button, Checkbox } from '@dculus/ui';
import { useQuery } from '@apollo/client';
import { LayoutThumbnails } from './LayoutThumbnails';
import { LayoutOptions } from './LayoutOptions';
import { ComingSoonCard } from './ComingSoonCard';
import { CollaborationStatus } from './CollaborationStatus';
import { BackgroundImageUpload } from './BackgroundImageUpload';
import { BackgroundImageGallery } from './BackgroundImageGallery';
import { PixabayModal } from './PixabayModal';
import { GET_FORM_FILES } from '../../../../graphql/templates';

interface LayoutSidebarProps {
  layout: FormLayout;
  currentLayoutCode: LayoutCode;
  isConnected: boolean;
  formId: string;
  onLayoutSelect: (layoutCode: LayoutCode) => void;
  onLayoutUpdate: (updates: Partial<FormLayout>) => void;
  canEditLayout: boolean;
}

export const LayoutSidebar: React.FC<LayoutSidebarProps> = ({
  layout,
  currentLayoutCode,
  isConnected,
  formId,
  onLayoutSelect,
  onLayoutUpdate,
  canEditLayout
}) => {
  const [selectedImageKey, setSelectedImageKey] = useState<string | null>(layout.backgroundImageKey || null);
  const [isPixabayModalOpen, setIsPixabayModalOpen] = useState(false);
  
  // Fetch form background images
  const { data: formFilesData, refetch: refetchFormFiles } = useQuery(GET_FORM_FILES, {
    variables: {
      formId,
      type: 'FormBackground'
    },
    fetchPolicy: 'cache-and-network'
  });

  const handleImageUploadSuccess = () => {
    refetchFormFiles();
  };

  const handleImageSelect = (imageKey: string) => {
    setSelectedImageKey(imageKey);
  };

  const handleApplyBackgroundImage = () => {
    if (selectedImageKey) {
      onLayoutUpdate({ backgroundImageKey: selectedImageKey });
    }
  };
  return (
    <div className="w-80 border-l border-gray-200 dark:border-gray-700 flex flex-col h-full">
      {/* Sidebar Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
            <Palette className="w-4 h-4 text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <h3 className="font-medium text-gray-900 dark:text-white">
              Layout Templates
            </h3>
            <p className="text-xs text-gray-600 dark:text-gray-400">
              {canEditLayout ? "Choose a layout style" : "View-only mode"}
            </p>
          </div>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Layout Thumbnails */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <LayoutThumbnails 
            currentLayoutCode={currentLayoutCode}
            onLayoutSelect={onLayoutSelect}
            disabled={!canEditLayout}
          />
        </div>

        {/* Custom CTA Button Input */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Custom CTA Button
            </label>
            <input
              type="text"
              value={layout.customCTAButtonName || ''}
              onChange={(e) => canEditLayout && onLayoutUpdate({ customCTAButtonName: e.target.value })}
              placeholder="Get Started"
              disabled={!canEditLayout}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Button text to start filling the form (e.g., "Get Started", "Begin Survey")
            </p>
          </div>
        </div>

        {/* Background Color Controls */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Background Color
            </label>
            
            {/* Toggle for custom background color */}
            <div className="flex items-center space-x-2">
              <Checkbox
                id="isCustomBackgroundColorEnabled"
                checked={layout.isCustomBackgroundColorEnabled || false}
                onCheckedChange={(checked) => canEditLayout && onLayoutUpdate({ isCustomBackgroundColorEnabled: !!checked })}
                disabled={!canEditLayout}
              />
              <label htmlFor="isCustomBackgroundColorEnabled" className="text-sm text-gray-700 dark:text-gray-300">
                Use custom background color
              </label>
            </div>
            
            {/* Color picker - only show when toggle is enabled */}
            {layout.isCustomBackgroundColorEnabled && (
              <div className="space-y-2">
                <label className="block text-xs text-gray-600 dark:text-gray-400">
                  Background Color
                </label>
                <div className="flex items-center space-x-2">
                  <input
                    type="color"
                    value={layout.customBackGroundColor || '#000000'}
                    onChange={(e) => canEditLayout && onLayoutUpdate({ customBackGroundColor: e.target.value })}
                    disabled={!canEditLayout}
                    className="w-8 h-8 border border-gray-300 dark:border-gray-600 rounded cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                  <input
                    type="text"
                    value={layout.customBackGroundColor || '#000000'}
                    onChange={(e) => canEditLayout && onLayoutUpdate({ customBackGroundColor: e.target.value })}
                    placeholder="#000000"
                    disabled={!canEditLayout}
                    className="flex-1 px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                </div>
              </div>
            )}
            
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {layout.isCustomBackgroundColorEnabled 
                ? "Custom color will be used for the background layer" 
                : "Default gradient will be used for the background"}
            </p>
          </div>
        </div>

        {/* Background Image Controls */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <Image className="w-4 h-4 text-gray-600 dark:text-gray-400" />
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Background Images
              </label>
            </div>
            
            <Tabs defaultValue="custom" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="custom" className="text-xs">
                  Custom Images
                </TabsTrigger>
                <TabsTrigger value="pixabay" className="text-xs">
                  Image Browser
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="custom" className="mt-3 space-y-3">
                {canEditLayout ? (
                  <>
                    {/* Upload new background image */}
                    <BackgroundImageUpload
                      formId={formId}
                      onUploadSuccess={handleImageUploadSuccess}
                    />
                    
                    {/* Gallery of uploaded images */}
                    {formFilesData?.getFormFiles && (
                      <div className="space-y-3">
                        <BackgroundImageGallery
                          images={formFilesData.getFormFiles}
                          selectedImageKey={selectedImageKey || undefined}
                          onImageSelect={handleImageSelect}
                        />
                      </div>
                    )}
                    
                    {/* Apply button for custom images */}
                    {selectedImageKey && selectedImageKey !== layout.backgroundImageKey && (
                      <button
                        onClick={handleApplyBackgroundImage}
                        className="w-full px-3 py-2 bg-purple-600 text-white text-sm font-medium rounded-md hover:bg-purple-700 transition-colors"
                      >
                        Apply Background Image
                      </button>
                    )}
                    
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Upload and manage your own background images
                    </p>
                  </>
                ) : (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    <p className="text-sm">View-only mode</p>
                    <p className="text-xs mt-1">Background image upload disabled</p>
                  </div>
                )}
              </TabsContent>
              
              <TabsContent value="pixabay" className="mt-3">
                <div className="space-y-3">
                  <Button
                    onClick={() => canEditLayout && setIsPixabayModalOpen(true)}
                    className="w-full"
                    variant="outline"
                    disabled={!canEditLayout}
                  >
                    <Search className="w-4 h-4 mr-2" />
                    Browse Images from Pixabay
                  </Button>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {canEditLayout 
                      ? "Search and select from thousands of free background images"
                      : "View-only mode - image browsing disabled"
                    }
                  </p>
                </div>
              </TabsContent>
            </Tabs>
            
            {layout.backgroundImageKey && (
              <button
                onClick={() => canEditLayout && onLayoutUpdate({ backgroundImageKey: '' })}
                disabled={!canEditLayout}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-md hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Clear Background
              </button>
            )}
          </div>
        </div>


        {/* Additional Sidebar Content */}
        <div className="p-4">
          <div className="space-y-4">
            <LayoutOptions 
              layout={layout}
              currentLayoutCode={currentLayoutCode}
            />

            <ComingSoonCard
              title="More Options Soon"
              description="Advanced customization features coming soon."
              features={[
                'Color themes',
                'Typography',
                'Custom CSS',
                'Animations'
              ]}
              size="small"
            />

            <CollaborationStatus isConnected={isConnected} />
          </div>
        </div>
      </div>

      {/* Pixabay Modal */}
      <PixabayModal
        isOpen={isPixabayModalOpen}
        onClose={() => setIsPixabayModalOpen(false)}
        formId={formId}
        onImageApplied={(imageKey) => onLayoutUpdate({ backgroundImageKey: imageKey })}
        onUploadSuccess={handleImageUploadSuccess}
      />
    </div>
  );
};