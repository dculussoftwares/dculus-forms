import React from 'react';
import { Palette } from 'lucide-react';
import { Button, ScrollArea } from '@dculus/ui';
import { useFormBuilderStore } from '../../../store/useFormBuilderStore';
import { useTranslation } from '../../../hooks';
import { BrandPreviewCard } from '../design/BrandPreviewCard';
import { BRAND_PRESETS, matchesPreset } from '../design/brandPresets';

interface FormGlancePanelProps {
  /** Opens the Design drawer on Brand & style; omitted when the user cannot edit. */
  onOpenBrand?: () => void;
}

/**
 * Right-panel resting state (nothing selected): a snapshot of the form and,
 * most importantly, a live preview of its brand with a one-click way to change it.
 */
export const FormGlancePanel: React.FC<FormGlancePanelProps> = ({ onOpenBrand }) => {
  const { t } = useTranslation('pageBuilderTab');
  const { t: td } = useTranslation('designDrawer');
  const pages = useFormBuilderStore((s) => s.pages);
  const layout = useFormBuilderStore((s) => s.layout);

  const tokens = layout?.tokens;
  const hasBrand = Boolean(tokens && Object.keys(tokens).some((k) => k !== 'version'));
  const preset = BRAND_PRESETS.find((p) => matchesPreset(tokens, p));
  const questionCount = pages.reduce((n, p) => n + p.fields.length, 0);
  const brandName = !hasBrand
    ? t('glance.brandDefault')
    : preset
      ? td(`brandStyle.presets.${preset.id}`)
      : t('glance.brandCustom');

  return (
    <ScrollArea className="min-h-0 flex-1">
      <div className="p-4 space-y-4" data-testid="form-glance-panel">
        <div>
          <p className="text-sm font-semibold text-[#4c414e] dark:text-gray-300">{t('glance.title')}</p>
          <p className="text-xs text-[#655d67] dark:text-gray-500 mt-0.5">{t('glance.subtitle')}</p>
        </div>

        <dl className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-lg bg-[var(--tf-faint)] py-2">
            <dd className="text-base font-semibold">{pages.length}</dd>
            <dt className="text-[11px] text-muted-foreground">{t('glance.pages')}</dt>
          </div>
          <div className="rounded-lg bg-[var(--tf-faint)] py-2">
            <dd className="text-base font-semibold">{questionCount}</dd>
            <dt className="text-[11px] text-muted-foreground">{t('glance.questions')}</dt>
          </div>
          <div className="rounded-lg bg-[var(--tf-faint)] py-2">
            <dd className="text-base font-semibold">{layout?.code ?? 'L1'}</dd>
            <dt className="text-[11px] text-muted-foreground">{t('glance.layout')}</dt>
          </div>
        </dl>

        <div className="rounded-xl border p-3 space-y-3" data-testid="form-glance-brand">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium">{t('glance.brand')}</span>
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <span
                className="h-3 w-3 rounded-full border"
                style={{ backgroundColor: tokens?.primaryColor ?? 'transparent' }}
              />
              {brandName}
            </span>
          </div>
          <BrandPreviewCard
            tokens={tokens}
            title={td('brandStyle.preview.title')}
            nameLabel={td('brandStyle.preview.nameLabel')}
            namePlaceholder={td('brandStyle.preview.namePlaceholder')}
            optionLabel={td('brandStyle.preview.option')}
            primaryLabel={td('brandStyle.preview.primary')}
            secondaryLabel={td('brandStyle.preview.secondary')}
          />
          {onOpenBrand && (
            <Button
              size="sm"
              variant={hasBrand ? 'outline' : 'default'}
              className="w-full"
              onClick={onOpenBrand}
              data-testid="form-glance-make-it-yours"
            >
              <Palette className="w-3.5 h-3.5 mr-1.5" />
              {hasBrand ? t('glance.editBrand') : t('glance.makeItYours')}
            </Button>
          )}
        </div>

        <p className="text-xs text-[#655d67] dark:text-gray-500 text-center">{t('emptyState.description')}</p>
      </div>
    </ScrollArea>
  );
};
