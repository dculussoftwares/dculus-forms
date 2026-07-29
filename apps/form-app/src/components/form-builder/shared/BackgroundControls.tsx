import React, { useEffect, useState } from 'react';
import { Image, Search } from 'lucide-react';
import { FormLayout } from '@dculus/types';
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Button,
  Checkbox,
  Input,
  Label,
} from '@dculus/ui';
import { useQuery } from '@apollo/client/react';
import { BackgroundImageUpload } from '../tabs/layout/BackgroundImageUpload';
import { BackgroundImageGallery } from '../tabs/layout/BackgroundImageGallery';
import { PixabayModal } from '../tabs/layout/PixabayModal';
import { PexelsModal } from '../tabs/layout/PexelsModal';
import { GET_FORM_FILES } from '../../../graphql/templates';

type Translate = (key: string, options?: { values?: Record<string, string | number> }) => string;

interface BackgroundControlsProps {
  layout: FormLayout;
  formId: string;
  canEditLayout: boolean;
  onLayoutUpdate: (updates: Partial<FormLayout>) => void;
  /** Translate fn already scoped to the caller's own i18n namespace — the
   * `backgroundColor.*` / `backgroundImages.*` keys are duplicated (with the
   * same shape) across `layoutSidebar`, `introSettings`, and `designDrawer`
   * so each surface keeps its own copy. */
  t: Translate;
}

/**
 * BackgroundControls — the background color + background image/video block
 * shared by IntroSettingsPanel (screen-scoped) and DesignDrawer (global).
 * Moved out of the old Design tab's LayoutSidebar verbatim: custom color
 * toggle + picker, upload, gallery, Pexels/Pixabay browse modals, and clear.
 * See docs/form-builder-redesign.md §2.2 / §2.4 and epic #226 ticket #231.
 */
export const BackgroundControls: React.FC<BackgroundControlsProps> = ({
  layout,
  formId,
  canEditLayout,
  onLayoutUpdate,
  t,
}) => {
  const [selectedImageKey, setSelectedImageKey] = useState<string | null>(
    layout.backgroundImageKey || null
  );
  const [isPixabayModalOpen, setIsPixabayModalOpen] = useState(false);
  const [isPexelsModalOpen, setIsPexelsModalOpen] = useState(false);

  // Resync the gallery's highlighted key when the applied background changes —
  // from a collaborator, or from this panel's own Apply/Pexels/Pixabay actions —
  // but only when there's no pending local gallery pick still awaiting Apply
  // (i.e. selectedImageKey already matches one of the applied keys, or is unset).
  useEffect(() => {
    setSelectedImageKey((current) => {
      if (!current || current === layout.backgroundImageKey || current === layout.backgroundVideoKey) {
        return layout.backgroundImageKey || layout.backgroundVideoKey || null;
      }
      return current;
    });
  }, [layout.backgroundImageKey, layout.backgroundVideoKey]);

  const { data: formFilesData, refetch: refetchFormFiles } = useQuery(GET_FORM_FILES, {
    variables: {
      formId,
      type: 'FormBackground',
    },
    fetchPolicy: 'cache-and-network',
  });

  const handleImageUploadSuccess = () => {
    refetchFormFiles();
  };

  const handleImageSelect = (imageKey: string) => {
    setSelectedImageKey(imageKey);
  };

  const handleApplyBackgroundImage = () => {
    if (!selectedImageKey) return;
    const selectedFile = formFilesData?.getFormFiles?.find(
      (file: { key: string }) => file.key === selectedImageKey
    );
    const isVideo = selectedFile?.mimeType?.startsWith('video/');
    // No fresh blob available for re-applying an already-uploaded gallery asset, so we
    // can't sample a new dominant color here — clear the old one rather than showing a
    // stale/mismatched wash; rendering falls back to the flat tint when this is empty.
    onLayoutUpdate(
      isVideo
        ? { backgroundVideoKey: selectedImageKey, backgroundImageKey: '', backgroundDominantColor: '' }
        : { backgroundImageKey: selectedImageKey, backgroundVideoKey: '', backgroundDominantColor: '' }
    );
  };

  return (
    <>
      {/* Background Color Controls */}
      <div className="space-y-3">
        <Label className="block text-sm font-medium text-foreground dark:text-gray-300">
          {t('backgroundColor.label')}
        </Label>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="bgctl-isCustomBackgroundColorEnabled"
            checked={layout.isCustomBackgroundColorEnabled || false}
            onCheckedChange={(checked) =>
              canEditLayout && onLayoutUpdate({ isCustomBackgroundColorEnabled: !!checked })
            }
            disabled={!canEditLayout}
          />
          <Label
            htmlFor="bgctl-isCustomBackgroundColorEnabled"
            className="text-sm text-foreground dark:text-gray-300 font-normal cursor-pointer"
          >
            {t('backgroundColor.toggleLabel')}
          </Label>
        </div>

        {layout.isCustomBackgroundColorEnabled && (
          <div className="space-y-2">
            <Label className="block text-xs text-foreground dark:text-gray-400">
              {t('backgroundColor.colorLabel')}
            </Label>
            <div className="flex items-center space-x-2">
              <input
                type="color"
                value={layout.customBackGroundColor || '#000000'}
                onChange={(e) => canEditLayout && onLayoutUpdate({ customBackGroundColor: e.target.value })}
                disabled={!canEditLayout}
                className="w-8 h-8 border border-[var(--tf-border-strong)] rounded cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <Input
                type="text"
                value={layout.customBackGroundColor || '#000000'}
                onChange={(e) => canEditLayout && onLayoutUpdate({ customBackGroundColor: e.target.value })}
                placeholder={t('backgroundColor.placeholder')}
                disabled={!canEditLayout}
                className="flex-1 h-8 px-2 text-xs"
              />
            </div>
          </div>
        )}

        <p className="text-xs text-muted-foreground dark:text-gray-400">
          {layout.isCustomBackgroundColorEnabled
            ? t('backgroundColor.helpTextEnabled')
            : t('backgroundColor.helpTextDisabled')}
        </p>
      </div>

      {/* Background Image Controls */}
      <div className="space-y-3">
        <div className="flex items-center space-x-2">
          <Image className="w-4 h-4 text-foreground dark:text-gray-400" />
          <Label className="block text-sm font-medium text-foreground dark:text-gray-300">
            {t('backgroundImages.label')}
          </Label>
        </div>

        <Tabs defaultValue="custom" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="custom" className="text-xs">
              {t('backgroundImages.tabs.custom')}
            </TabsTrigger>
            <TabsTrigger value="pexels" className="text-xs">
              {t('backgroundImages.tabs.pexels')}
            </TabsTrigger>
            <TabsTrigger value="pixabay" className="text-xs">
              {t('backgroundImages.tabs.pixabay')}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="custom" className="mt-3 space-y-3">
            {canEditLayout ? (
              <>
                <BackgroundImageUpload formId={formId} onUploadSuccess={handleImageUploadSuccess} />

                {formFilesData?.getFormFiles && (
                  <div className="space-y-3">
                    <BackgroundImageGallery
                      images={formFilesData.getFormFiles}
                      selectedImageKey={selectedImageKey || undefined}
                      onImageSelect={handleImageSelect}
                    />
                  </div>
                )}

                {selectedImageKey &&
                  selectedImageKey !== layout.backgroundImageKey &&
                  selectedImageKey !== layout.backgroundVideoKey && (
                    <Button
                      onClick={handleApplyBackgroundImage}
                      className="w-full bg-purple-600 hover:bg-purple-700"
                    >
                      {t('backgroundImages.customTab.applyButton')}
                    </Button>
                  )}

                <p className="text-xs text-muted-foreground dark:text-gray-400">
                  {t('backgroundImages.customTab.helpText')}
                </p>
              </>
            ) : (
              <div className="text-center py-8 text-muted-foreground dark:text-gray-400">
                <p className="text-sm">{t('backgroundImages.customTab.viewOnlyTitle')}</p>
                <p className="text-xs mt-1">{t('backgroundImages.customTab.viewOnlyDescription')}</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="pexels" className="mt-3">
            <div className="space-y-3">
              <Button
                onClick={() => canEditLayout && setIsPexelsModalOpen(true)}
                className="w-full"
                variant="outline"
                disabled={!canEditLayout}
              >
                <Search className="w-4 h-4 mr-2" />
                {t('backgroundImages.pexelsTab.browseButton')}
              </Button>
              <p className="text-xs text-muted-foreground dark:text-gray-400">
                {canEditLayout
                  ? t('backgroundImages.pexelsTab.helpTextEnabled')
                  : t('backgroundImages.pexelsTab.helpTextDisabled')}
              </p>
            </div>
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
                {t('backgroundImages.pixabayTab.browseButton')}
              </Button>
              <p className="text-xs text-muted-foreground dark:text-gray-400">
                {canEditLayout
                  ? t('backgroundImages.pixabayTab.helpTextEnabled')
                  : t('backgroundImages.pixabayTab.helpTextDisabled')}
              </p>
            </div>
          </TabsContent>
        </Tabs>

        {(layout.backgroundImageKey || layout.backgroundVideoKey) && (
          <Button
            variant="outline"
            onClick={() =>
              canEditLayout &&
              onLayoutUpdate({ backgroundImageKey: '', backgroundVideoKey: '', backgroundDominantColor: '' })
            }
            disabled={!canEditLayout}
            className="w-full"
          >
            {t('backgroundImages.clearButton')}
          </Button>
        )}
      </div>

      <PexelsModal
        isOpen={isPexelsModalOpen}
        onClose={() => setIsPexelsModalOpen(false)}
        formId={formId}
        onImageApplied={(imageKey, dominantColor) =>
          onLayoutUpdate({ backgroundImageKey: imageKey, backgroundVideoKey: '', backgroundDominantColor: dominantColor })
        }
        onVideoApplied={(videoKey, dominantColor) =>
          onLayoutUpdate({ backgroundVideoKey: videoKey, backgroundImageKey: '', backgroundDominantColor: dominantColor })
        }
        onUploadSuccess={handleImageUploadSuccess}
      />

      <PixabayModal
        isOpen={isPixabayModalOpen}
        onClose={() => setIsPixabayModalOpen(false)}
        formId={formId}
        onImageApplied={(imageKey, dominantColor) =>
          onLayoutUpdate({ backgroundImageKey: imageKey, backgroundVideoKey: '', backgroundDominantColor: dominantColor })
        }
        onVideoApplied={(videoKey, dominantColor) =>
          onLayoutUpdate({ backgroundVideoKey: videoKey, backgroundImageKey: '', backgroundDominantColor: dominantColor })
        }
        onUploadSuccess={handleImageUploadSuccess}
      />
    </>
  );
};

export default BackgroundControls;
