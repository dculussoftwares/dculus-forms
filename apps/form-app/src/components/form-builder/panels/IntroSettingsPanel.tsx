import React from 'react';
import { Input, Label, ScrollArea } from '@dculus/ui';
import { FormLayout, LayoutCode } from '@dculus/types';
import { useTranslation } from '../../../hooks/useTranslation';
import { LayoutThumbnails } from '../tabs/layout/LayoutThumbnails';
import { BackgroundControls } from '../shared/BackgroundControls';

interface IntroSettingsPanelProps {
  layout: FormLayout;
  formId: string;
  canEditLayout: boolean;
  onLayoutSelect: (layoutCode: LayoutCode) => void;
  onLayoutUpdate: (updates: Partial<FormLayout>) => void;
}

/**
 * IntroSettingsPanel — right-panel contents when the journey rail's Welcome
 * screen is selected. Composes the same layout thumbnails, CTA input, and
 * background controls that used to live in LayoutSidebar (Design tab), now
 * scoped to the intro screen per docs/form-builder-redesign.md §2.2.
 */
export const IntroSettingsPanel: React.FC<IntroSettingsPanelProps> = ({
  layout,
  formId,
  canEditLayout,
  onLayoutSelect,
  onLayoutUpdate,
}) => {
  const { t } = useTranslation('introSettings');
  const currentLayoutCode = layout?.code || 'L1';

  return (
    <ScrollArea className="flex-1" data-testid="intro-settings-panel">
      <div className="p-4">
        <h3 className="text-sm font-semibold text-primary dark:text-white mb-1">
          {t('header.title')}
        </h3>
        <p className="text-xs text-muted-foreground dark:text-gray-400 mb-4">
          {canEditLayout ? t('header.editableDescription') : t('header.viewOnlyDescription')}
        </p>

        {/* Layout Thumbnails */}
        <div className="pb-4 border-b border-[var(--tf-border-medium)] dark:border-gray-700">
          <LayoutThumbnails
            currentLayoutCode={currentLayoutCode}
            onLayoutSelect={onLayoutSelect}
            disabled={!canEditLayout}
          />
        </div>

        {/* Custom CTA Button Input */}
        <div className="py-4 border-b border-[var(--tf-border-medium)] dark:border-gray-700">
          <div className="space-y-2">
            <Label className="block text-sm font-medium text-foreground dark:text-gray-300">
              {t('customCTA.label')}
            </Label>
            <Input
              type="text"
              value={layout.customCTAButtonName || ''}
              onChange={(e) => canEditLayout && onLayoutUpdate({ customCTAButtonName: e.target.value })}
              placeholder={t('customCTA.placeholder')}
              disabled={!canEditLayout}
              data-testid="intro-cta-button-input"
            />
            <p className="text-xs text-muted-foreground dark:text-gray-400">
              {t('customCTA.helpText')}
            </p>
          </div>
        </div>

        {/* Background Color + Image controls — shared with the global Design drawer */}
        <div className="py-4 space-y-6">
          <BackgroundControls
            layout={layout}
            formId={formId}
            canEditLayout={canEditLayout}
            onLayoutUpdate={onLayoutUpdate}
            t={t}
          />
        </div>
      </div>
    </ScrollArea>
  );
};

export default IntroSettingsPanel;
