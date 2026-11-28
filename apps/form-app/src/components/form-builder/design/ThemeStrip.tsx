import React from 'react';
import { MoreHorizontal } from 'lucide-react';
import type { FormDesignTokens, FormLayout } from '@dculus/types';
import { cn, trackEvent } from '@dculus/utils';
import { useTranslation } from '../../../hooks/useTranslation';
import { useBrandPreviewStore } from '../../../store/useBrandPreviewStore';
import { BRAND_PRESETS, FEATURED_BRAND_PRESETS, matchesPreset, type BrandPreset } from './brandPresets';

interface ThemeStripProps {
  layout: FormLayout;
  canEditLayout: boolean;
  onLayoutUpdate: (updates: Partial<FormLayout>) => void;
  onReset: () => void;
  /** Opens the Design drawer at Brand & style, where every theme is available. */
  onMore?: () => void;
  className?: string;
}

/**
 * One-click theme swatches for the canvas toolbar. Hover previews the preset on
 * the canvas (transient, never saved); click applies it. This is the always-visible
 * entry point to the brand/design-token system.
 */
export const ThemeStrip: React.FC<ThemeStripProps> = ({
  layout,
  canEditLayout,
  onLayoutUpdate,
  onReset,
  onMore,
  className,
}) => {
  const { t } = useTranslation('designDrawer');
  const { setPreview, clearPreview } = useBrandPreviewStore();
  const tokens = layout.tokens;
  const hasBrand = Boolean(tokens && Object.keys(tokens).some((k) => k !== 'version'));
  const activePreset = BRAND_PRESETS.find((p) => matchesPreset(tokens, p));
  // A theme picked from the full gallery may not be featured; keep it visible in the strip.
  const swatches =
    activePreset && !activePreset.featured ? [...FEATURED_BRAND_PRESETS, activePreset] : FEATURED_BRAND_PRESETS;

  const preview = (preset: BrandPreset | null) => {
    if (!canEditLayout || !preset) {
      clearPreview();
      return;
    }
    setPreview({ version: 1, ...preset.tokens } as FormDesignTokens);
  };

  const apply = (preset: BrandPreset) => {
    if (!canEditLayout) return;
    clearPreview();
    trackEvent('brand_preset_applied', { preset: preset.id, source: 'theme_strip' });
    onLayoutUpdate({ tokens: { version: 1, ...preset.tokens } as FormDesignTokens });
  };

  const reset = () => {
    if (!canEditLayout) return;
    clearPreview();
    trackEvent('brand_reset', { source: 'theme_strip' });
    onReset();
  };

  return (
    <div
      className={cn('flex items-center gap-1.5', className)}
      role="group"
      aria-label={t('themeStrip.label')}
      data-testid="theme-strip"
    >
      <span className="hidden xl:inline text-[11px] font-medium text-muted-foreground mr-0.5">
        {t('themeStrip.label')}
      </span>
      <button
        type="button"
        disabled={!canEditLayout}
        onClick={reset}
        onPointerEnter={() => canEditLayout && setPreview(undefined)}
        onPointerLeave={clearPreview}
        onFocus={() => canEditLayout && setPreview(undefined)}
        onBlur={clearPreview}
        title={t('themeStrip.default')}
        aria-label={t('themeStrip.default')}
        aria-pressed={!hasBrand}
        data-testid="theme-strip-default"
        className={cn(
          'h-5 w-5 rounded-full border border-dashed border-muted-foreground/50 bg-background transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 disabled:hover:scale-100',
          !hasBrand && 'ring-2 ring-offset-1 ring-foreground/60'
        )}
      />
      {swatches.map((preset) => {
        const label = t(`brandStyle.presets.${preset.id}`);
        const active = activePreset?.id === preset.id;
        return (
          <button
            key={preset.id}
            type="button"
            disabled={!canEditLayout}
            onClick={() => apply(preset)}
            onPointerEnter={() => preview(preset)}
            onPointerLeave={() => preview(null)}
            onFocus={() => preview(preset)}
            onBlur={() => preview(null)}
            title={label}
            aria-label={label}
            aria-pressed={active}
            data-testid={`theme-strip-${preset.id}`}
            className={cn(
              'h-5 w-5 rounded-full transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 disabled:hover:scale-100',
              active && 'ring-2 ring-offset-1 ring-foreground/60'
            )}
            style={{ backgroundColor: preset.tokens.primaryColor }}
          />
        );
      })}
      {onMore && (
        <button
          type="button"
          onClick={onMore}
          title={t('themeStrip.more')}
          aria-label={t('themeStrip.more')}
          data-testid="theme-strip-more"
          className="flex h-5 w-5 items-center justify-center rounded-full border border-muted-foreground/40 text-muted-foreground transition-transform hover:scale-110 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <MoreHorizontal className="h-3 w-3" />
        </button>
      )}
    </div>
  );
};
