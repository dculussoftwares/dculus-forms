import React, { useEffect, useRef } from 'react';
import { FormLayout, LayoutCode } from '@dculus/types';
import { Sheet, SheetContent, SheetHeader, SheetTitle, Label, ScrollArea } from '@dculus/ui';
import { useTranslation } from '../../../hooks/useTranslation';
import { LayoutThumbnails } from '../tabs/layout/LayoutThumbnails';
import { BackgroundControls } from '../shared/BackgroundControls';
import { BrandStyleControls } from './BrandStyleControls';
import { OrgBrandKitCard } from './OrgBrandKitCard';

interface DesignDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  layout: FormLayout;
  formId: string;
  canEditLayout: boolean;
  onLayoutSelect: (layoutCode: LayoutCode) => void;
  onLayoutUpdate: (updates: Partial<FormLayout>) => void;
  onTokensReset: () => void;
  /** When set, the drawer scrolls that section into view on open. */
  focusSection?: 'brand' | null;
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
  onTokensReset,
  focusSection = null,
}) => {
  const { t } = useTranslation('designDrawer');
  const currentLayoutCode = layout?.code || 'L1';
  const brandSectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen || focusSection !== 'brand') return;
    // Wait a frame so the Sheet content has mounted before scrolling.
    const id = requestAnimationFrame(() =>
      brandSectionRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' })
    );
    return () => cancelAnimationFrame(id);
  }, [isOpen, focusSection]);

  return (
    // Non-modal with no dimming overlay: the canvas stays visible and live-themed
    // while tokens change. Escape and the close button still dismiss it.
    <Sheet modal={false} open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="right"
        hideOverlay
        className="w-full sm:max-w-sm p-0 flex flex-col gap-0 shadow-2xl"
        data-testid="design-drawer"
        onInteractOutside={(event) => event.preventDefault()}
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

            {/* Brand & style (design tokens) */}
            <div
              ref={brandSectionRef}
              data-testid="design-drawer-brand-section"
              className="pb-6 border-b border-[var(--tf-border-medium)] dark:border-gray-700 scroll-mt-4"
            >
              <Label className="block text-sm font-medium text-foreground dark:text-gray-300 mb-3">
                {t('brandStyle.label')}
              </Label>
              <BrandStyleControls
                layout={layout}
                canEditLayout={canEditLayout}
                onLayoutUpdate={onLayoutUpdate}
                onReset={onTokensReset}
                t={t}
              />
              <OrgBrandKitCard
                tokens={layout.tokens}
                canEditLayout={canEditLayout}
                onApply={(tokens) => onLayoutUpdate({ tokens })}
                t={t}
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
