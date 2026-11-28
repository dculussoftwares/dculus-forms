import React, { useEffect, useId, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { FormDesignTokens } from '@dculus/types';
import { Button, useFormFonts } from '@dculus/ui';
import { FONT_CATALOG, cn, readableOn, trackEvent } from '@dculus/utils';
import {
  BRAND_PRESETS,
  BRAND_PRESET_CATEGORIES,
  FEATURED_BRAND_PRESETS,
  RADIUS_PREVIEW,
  matchesPreset,
  type BrandPreset,
  type BrandPresetCategory,
} from './brandPresets';

interface ThemeCardProps {
  preset: BrandPreset;
  name: string;
  active: boolean;
  disabled: boolean;
  headingText: string;
  inputText: string;
  buttonText: string;
  onApply: (preset: BrandPreset) => void;
  onPreview: (preset: BrandPreset | null) => void;
}

/** A static mock of a form rendered from the preset's tokens, so each card previews its own look. */
const ThemeCard: React.FC<ThemeCardProps> = ({
  preset,
  name,
  active,
  disabled,
  headingText,
  inputText,
  buttonText,
  onApply,
  onPreview,
}) => {
  const { primaryColor = '#2563eb', surfaceColor, headingFont, bodyFont, radius = 'md', inputStyle, buttonStyle } =
    preset.tokens;
  useFormFonts({ version: 1, ...preset.tokens } as FormDesignTokens);
  const corner = RADIUS_PREVIEW[radius];
  const onPrimary = readableOn(primaryColor);
  const bodyStack = bodyFont ? FONT_CATALOG[bodyFont].stack : undefined;

  const inputStyles: React.CSSProperties =
    inputStyle === 'underline'
      ? { borderBottom: '1.5px solid #9ca3af' }
      : inputStyle === 'filled'
        ? { backgroundColor: '#f3f4f6', borderRadius: corner }
        : { border: '1px solid #d1d5db', borderRadius: corner };

  const buttonStyles: React.CSSProperties =
    buttonStyle === 'outline'
      ? { border: `1.5px solid ${primaryColor}`, color: primaryColor }
      : buttonStyle === 'soft'
        ? { backgroundColor: `${primaryColor}22`, color: primaryColor }
        : { backgroundColor: primaryColor, color: onPrimary };

  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={active}
      aria-label={name}
      data-testid={`brand-preset-${preset.id}`}
      onClick={() => onApply(preset)}
      onPointerEnter={() => onPreview(preset)}
      onPointerLeave={() => onPreview(null)}
      onFocus={() => onPreview(preset)}
      onBlur={() => onPreview(null)}
      className={cn(
        'flex flex-col gap-2 rounded-xl border p-2 text-left transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
        active ? 'border-foreground ring-1 ring-foreground' : 'border-[var(--tf-border-strong)]'
      )}
    >
      <div
        aria-hidden="true"
        className="space-y-2 rounded-lg border border-black/5 bg-white p-3 text-gray-900"
        style={{ backgroundColor: surfaceColor, fontFamily: bodyStack }}
      >
        <p
          className="text-sm font-semibold leading-tight"
          style={{ fontFamily: headingFont ? FONT_CATALOG[headingFont].stack : undefined, color: primaryColor }}
        >
          {headingText}
        </p>
        <div className="px-2 py-1.5 text-[11px] text-gray-500" style={inputStyles}>
          {inputText}
        </div>
        <div
          className="inline-block px-3 py-1 text-[11px] font-medium"
          style={{ borderRadius: corner, ...buttonStyles }}
        >
          {buttonText}
        </div>
      </div>
      <span className="px-1 text-xs font-medium text-foreground">{name}</span>
    </button>
  );
};

type Translate = (key: string, options?: { values?: Record<string, string | number> }) => string;

interface ThemeGalleryProps {
  t: Translate;
  tokens: FormDesignTokens | undefined;
  disabled: boolean;
  /** Where the theme was picked from; reported with the apply analytics event. */
  source: string;
  onApply: (preset: BrandPreset) => void;
  /** Transient canvas preview while a theme is hovered or focused; `null` clears it. */
  onPreview: (preset: BrandPreset | null) => void;
  /** Non-zero values expand the list (and scroll it into view) each time they change. */
  expandSignal?: number;
  className?: string;
}

/**
 * The theme picker: the featured themes up front, with "Show all" expanding the same grid in
 * place to every curated theme plus category filters. Applying writes the preset's tokens
 * through `onApply`, which the caller routes to the collaborative layout.
 */
export const ThemeGallery: React.FC<ThemeGalleryProps> = ({
  t,
  tokens,
  disabled,
  source,
  onApply,
  onPreview,
  expandSignal = 0,
  className,
}) => {
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [category, setCategory] = useState<BrandPresetCategory | 'all'>('all');

  useEffect(() => {
    if (!expandSignal) return;
    setExpanded(true);
    // Wait a frame so the drawer has laid out before scrolling.
    const id = requestAnimationFrame(() =>
      rootRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' })
    );
    return () => cancelAnimationFrame(id);
  }, [expandSignal]);

  const activePreset = BRAND_PRESETS.find((p) => matchesPreset(tokens, p));
  // Collapsed, a theme picked from the full list still shows so the active state is never hidden.
  const collapsedList =
    activePreset && !activePreset.featured ? [...FEATURED_BRAND_PRESETS, activePreset] : FEATURED_BRAND_PRESETS;
  const visible = !expanded
    ? collapsedList
    : category === 'all'
      ? BRAND_PRESETS
      : BRAND_PRESETS.filter((p) => p.category === category);

  const handleApply = (preset: BrandPreset) => {
    trackEvent('brand_preset_applied', { preset: preset.id, source });
    onApply(preset);
  };

  const toggle = () => {
    onPreview(null);
    if (expanded) setCategory('all');
    setExpanded((value) => !value);
  };

  return (
    <div ref={rootRef} className={cn('space-y-2 scroll-mt-4', className)} data-testid="theme-gallery">
      {expanded && (
        <div className="flex flex-wrap gap-1.5" role="group" aria-label={t('themeGallery.filterLabel')}>
          {(['all', ...BRAND_PRESET_CATEGORIES] as const).map((id) => (
            <Button
              key={id}
              type="button"
              size="sm"
              variant={category === id ? 'default' : 'outline'}
              className="h-7 rounded-full px-3 text-xs"
              aria-pressed={category === id}
              data-testid={`theme-gallery-filter-${id}`}
              onClick={() => setCategory(id)}
            >
              {id === 'all' ? t('themeGallery.all') : t(`themeGallery.categories.${id}`)}
            </Button>
          ))}
        </div>
      )}

      <div id={panelId} className="grid grid-cols-2 gap-2" data-testid="theme-gallery-grid">
        {visible.map((preset) => {
          const name = t(`brandStyle.presets.${preset.id}`);
          return (
            <ThemeCard
              key={preset.id}
              preset={preset}
              name={name}
              active={matchesPreset(tokens, preset)}
              disabled={disabled}
              headingText={t('themeGallery.sampleHeading')}
              inputText={t('themeGallery.sampleInput')}
              buttonText={t('themeGallery.sampleButton')}
              onApply={handleApply}
              onPreview={onPreview}
            />
          );
        })}
      </div>

      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-8 w-full justify-center gap-1.5 text-xs text-muted-foreground"
        aria-expanded={expanded}
        aria-controls={panelId}
        onClick={toggle}
        data-testid="theme-gallery-toggle"
      >
        {expanded ? t('themeGallery.closeButton') : t('themeGallery.openButton', { values: { count: BRAND_PRESETS.length } })}
        <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', expanded && 'rotate-180')} />
      </Button>
    </div>
  );
};
