import React from 'react';
import {
  FormLayout,
  LayoutCode,
  ThemeType,
  SpacingType,
  PageModeType,
} from '@dculus/types';
import { Sheet, SheetContent, SheetHeader, SheetTitle, Label, Button, ScrollArea } from '@dculus/ui';
import { cn } from '@dculus/utils';
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

const THEME_OPTIONS = [ThemeType.LIGHT, ThemeType.DARK, ThemeType.AUTO] as const;
const SPACING_OPTIONS = [SpacingType.COMPACT, SpacingType.NORMAL, SpacingType.SPACIOUS] as const;

/**
 * DesignDrawer — the 🎨 Design tool: a Sheet sliding over the right panel
 * with the *global* look controls that used to live in the Design tab's
 * LayoutSidebar (layout family, theme, spacing, page mode, background).
 * Screen-specific controls (CTA text, per-screen background) stay in the
 * Intro/Ending panels. See docs/form-builder-redesign.md §2.4, epic #226
 * ticket #231.
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
  const currentTheme = layout?.theme || ThemeType.LIGHT;
  const currentSpacing = layout?.spacing || SpacingType.NORMAL;
  const currentPageMode = layout?.pageMode || PageModeType.MULTIPAGE;

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

        <ScrollArea className="flex-1">
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

            {/* Theme */}
            <div className="pb-6 border-b border-[var(--tf-border-medium)] dark:border-gray-700">
              <Label className="block text-sm font-medium text-foreground dark:text-gray-300 mb-2">
                {t('theme.label')}
              </Label>
              <div className="flex gap-2">
                {THEME_OPTIONS.map((option) => (
                  <Button
                    key={option}
                    type="button"
                    variant={currentTheme === option ? 'default' : 'outline'}
                    disabled={!canEditLayout}
                    onClick={() => onLayoutUpdate({ theme: option })}
                    className="flex-1 text-xs h-8"
                    data-testid={`design-drawer-theme-${option}`}
                  >
                    {t(`theme.options.${option}`)}
                  </Button>
                ))}
              </div>
            </div>

            {/* Spacing */}
            <div className="pb-6 border-b border-[var(--tf-border-medium)] dark:border-gray-700">
              <Label className="block text-sm font-medium text-foreground dark:text-gray-300 mb-2">
                {t('spacing.label')}
              </Label>
              <div className="flex gap-2">
                {SPACING_OPTIONS.map((option) => (
                  <Button
                    key={option}
                    type="button"
                    variant={currentSpacing === option ? 'default' : 'outline'}
                    disabled={!canEditLayout}
                    onClick={() => onLayoutUpdate({ spacing: option })}
                    className="flex-1 text-xs h-8"
                    data-testid={`design-drawer-spacing-${option}`}
                  >
                    {t(`spacing.options.${option}`)}
                  </Button>
                ))}
              </div>
            </div>

            {/* Page mode — informational only: PageModeType currently supports a
                single value, so there's nothing to toggle to yet. Kept as its
                own field group (rather than dropped) so this is a natural
                extension point once a second mode ships. */}
            <div className="pb-6 border-b border-[var(--tf-border-medium)] dark:border-gray-700">
              <Label className="block text-sm font-medium text-foreground dark:text-gray-300 mb-2">
                {t('pageMode.label')}
              </Label>
              <p className={cn('text-xs text-muted-foreground dark:text-gray-400')}>
                {t('pageMode.currentValue', {
                  values: {
                    value: t(`pageMode.values.${currentPageMode}`, { defaultValue: currentPageMode }),
                  },
                })}
              </p>
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
