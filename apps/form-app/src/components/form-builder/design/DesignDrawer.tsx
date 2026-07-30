import React from 'react';
import { FormLayout, LayoutCode } from '@dculus/types';
import { Sheet, SheetContent, SheetHeader, SheetTitle, Label, ScrollArea } from '@dculus/ui';
import { useTranslation } from '../../../hooks/useTranslation';
import { LayoutThumbnails } from '../tabs/layout/LayoutThumbnails';
import { BackgroundControls } from '../shared/BackgroundControls';

interface DesignDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  layout: FormLayout;
  formId: string;
  canEditLayout: boolean;
  onLayoutSelect: (layoutCode: LayoutCode) => void;
  onLayoutUpdate: (updates: Partial<FormLayout>) => void;
}

/**
 * DesignDrawer — the 🎨 Design tool: a Sheet sliding over the right panel
 * with the *global* look controls that used to live in the Design tab's
 * LayoutSidebar (layout family, background). Screen-specific controls
 * (CTA text, per-screen background) stay in the Intro/Ending panels.
 * See docs/form-builder-redesign.md §2.4, epic #226 ticket #231.
 */
export const DesignDrawer: React.FC<DesignDrawerProps> = ({
  isOpen,
  onClose,
  layout,
  formId,
  canEditLayout,
  onLayoutSelect,
  onLayoutUpdate,
}) => {
  const { t } = useTranslation('designDrawer');
  const currentLayoutCode = layout?.code || 'L1';

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-md p-0 flex flex-col gap-0"
        data-testid="design-drawer"
      >
        <SheetHeader className="p-4 space-y-1" style={{ borderBottom: '1px solid var(--tf-border-medium)' }}>
          <SheetTitle>{t('header.title')}</SheetTitle>
          <p className="text-xs text-muted-foreground dark:text-gray-400">
            {canEditLayout ? t('header.editableDescription') : t('header.viewOnlyDescription')}
          </p>
        </SheetHeader>

        <ScrollArea className="min-h-0 flex-1">
          <div className="p-4 space-y-6">
            {/* Layout family */}
            <div className="pb-6 border-b border-[var(--tf-border-medium)] dark:border-gray-700">
              <Label className="block text-sm font-medium text-foreground dark:text-gray-300 mb-2">
                {t('layoutFamily.label')}
              </Label>
              <LayoutThumbnails
                currentLayoutCode={currentLayoutCode}
                onLayoutSelect={onLayoutSelect}
                disabled={!canEditLayout}
                scrollAreaClassName="h-auto"
              />
            </div>

            {/* Global background */}
            <div>
              <Label className="block text-sm font-medium text-foreground dark:text-gray-300 mb-2">
                {t('globalBackground.label')}
              </Label>
              <div className="space-y-6">
                <BackgroundControls
                  layout={layout}
                  formId={formId}
                  canEditLayout={canEditLayout}
                  onLayoutUpdate={onLayoutUpdate}
                  t={t}
                />
              </div>
            </div>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
};

export default DesignDrawer;
