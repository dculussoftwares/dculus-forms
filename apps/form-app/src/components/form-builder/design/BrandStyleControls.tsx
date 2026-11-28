import React, { useEffect, useId, useRef, useState } from 'react';
import type {
  FormButtonStyle,
  FormDesignTokens,
  FormFontId,
  FormInputStyle,
  FormLayout,
  FormRadius,
} from '@dculus/types';
import {
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@dculus/ui';
import {
  FONT_CATALOG,
  FONT_IDS,
  contrastRatio,
  getGoogleFontsHref,
  readableOn,
  trackEvent,
} from '@dculus/utils';
import { BrandPreviewCard } from './BrandPreviewCard';
import { useBrandPreviewStore, useEffectiveTokens } from '../../../store/useBrandPreviewStore';
import { BRAND_PRESETS, matchesPreset, type BrandPreset } from './brandPresets';

type Translate = (key: string, options?: { values?: Record<string, string | number> }) => string;

interface BrandStyleControlsProps {
  layout: FormLayout;
  canEditLayout: boolean;
  onLayoutUpdate: (updates: Partial<FormLayout>) => void;
  /** Removes `layout.tokens` entirely (undefined writes are ignored by updateLayout). */
  onReset: () => void;
  t: Translate;
  /** Render only these sections (canvas popovers); omitted renders everything. */
  sections?: BrandSection[];
}

export type BrandSection =
  | 'preview'
  | 'compare'
  | 'presets'
  | 'brandColor'
  | 'surfaceColor'
  | 'headingFont'
  | 'bodyFont'
  | 'corners'
  | 'inputStyle'
  | 'buttonStyle'
  | 'contrast'
  | 'reset';

const HEX_RE = /^#[0-9A-Fa-f]{6}$/;
const MIN_CONTRAST = 4.5;
const QUICK_SWATCHES = [
  '#2563eb',
  '#7c3aed',
  '#db2777',
  '#dc2626',
  '#ea580c',
  '#16a34a',
  '#0d9488',
  '#111827',
];
const RADII: FormRadius[] = ['none', 'sm', 'md', 'lg', 'pill'];
const RADIUS_PREVIEW: Record<FormRadius, string> = {
  none: '0px',
  sm: '3px',
  md: '6px',
  lg: '10px',
  pill: '999px',
};
const INPUT_STYLES: FormInputStyle[] = ['outlined', 'filled', 'underline'];
const BUTTON_STYLES: FormButtonStyle[] = ['solid', 'outline', 'soft'];
const PREVIEW_FALLBACK_COLOR = '#374151';

/** Mixes a #RRGGBB color toward black until it reaches `min` contrast against `against`. */
export function darkenToContrast(hex: string, against: string, min = MIN_CONTRAST): string {
  if (!HEX_RE.test(hex)) return hex;
  const channels = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  for (let step = 0; step <= 100; step += 2) {
    const factor = 1 - step / 100;
    const candidate =
      '#' + channels.map((c) => Math.round(c * factor).toString(16).padStart(2, '0')).join('');
    if (contrastRatio(candidate, against) >= min) return candidate;
  }
  return '#000000';
}

const optionButtonClass = (active: boolean) =>
  `flex flex-col items-center gap-1.5 rounded-lg border px-2 py-2 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
    active
      ? 'border-foreground bg-muted font-medium text-foreground'
      : 'border-[var(--tf-border-strong)] text-muted-foreground hover:bg-muted/60'
  }`;

const PresetButton: React.FC<{
  preset: BrandPreset;
  label: string;
  active: boolean;
  disabled: boolean;
  onApply: (preset: BrandPreset) => void;
  onPreview: (preset: BrandPreset | null) => void;
}> = ({ preset, label, active, disabled, onApply, onPreview }) => {
  const { primaryColor, headingFont, radius } = preset.tokens;
  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={active}
      aria-label={label}
      data-testid={`brand-preset-${preset.id}`}
      onClick={() => onApply(preset)}
      onPointerEnter={() => onPreview(preset)}
      onPointerLeave={() => onPreview(null)}
      onFocus={() => onPreview(preset)}
      onBlur={() => onPreview(null)}
      className={`flex items-center gap-2 rounded-lg border px-2 py-1.5 text-left text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
        active
          ? 'border-foreground bg-muted font-medium text-foreground'
          : 'border-[var(--tf-border-strong)] text-muted-foreground hover:bg-muted/60'
      }`}
    >
      <span
        className="flex h-6 w-6 shrink-0 items-center justify-center text-[11px] font-semibold"
        style={{
          backgroundColor: primaryColor,
          color: primaryColor ? readableOn(primaryColor) : undefined,
          borderRadius: radius ? RADIUS_PREVIEW[radius] : '6px',
          fontFamily: headingFont ? FONT_CATALOG[headingFont].stack : undefined,
        }}
      >
        Aa
      </span>
      <span className="truncate">{label}</span>
    </button>
  );
};

const ColorField: React.FC<{
  label: string;
  value: string | undefined;
  placeholder: string;
  clearLabel: string;
  helper?: string;
  swatches?: string[];
  disabled: boolean;
  onChange: (hex: string | undefined) => void;
  /** Called while the native picker is being dragged; nothing is saved until the picker is released. */
  onPreview: (hex: string | undefined) => void;
}> = ({ label, value, placeholder, clearLabel, helper, swatches, disabled, onChange, onPreview }) => {
  const [draft, setDraft] = useState(value ?? '');
  useEffect(() => setDraft(value ?? ''), [value]);
  const pickerRef = useRef<HTMLInputElement>(null);
  const pending = useRef<string | undefined>(undefined);

  const commitPending = () => {
    const hex = pending.current;
    pending.current = undefined;
    if (hex) onChange(hex);
    else onPreview(undefined);
  };

  // React maps onChange to the continuous `input` event; the native `change` event fires on release.
  useEffect(() => {
    const el = pickerRef.current;
    if (!el) return;
    el.addEventListener('change', commitPending);
    return () => el.removeEventListener('change', commitPending);
  });

  const drag = (hex: string) => {
    setDraft(hex);
    pending.current = hex.toLowerCase();
    onPreview(hex.toLowerCase());
  };

  const commit = (next: string) => {
    setDraft(next);
    if (HEX_RE.test(next)) onChange(next.toLowerCase());
  };

  return (
    <div className="space-y-2">
      <Label className="block text-xs text-foreground dark:text-gray-400">{label}</Label>
      <div className="flex items-center gap-2">
        <input
          ref={pickerRef}
          type="color"
          aria-label={label}
          value={value ?? '#000000'}
          onChange={(e) => drag(e.target.value)}
          onBlur={commitPending}
          disabled={disabled}
          className="h-8 w-8 cursor-pointer rounded border border-[var(--tf-border-strong)] disabled:cursor-not-allowed disabled:opacity-50"
        />
        <Input
          type="text"
          value={draft}
          onChange={(e) => commit(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className="h-8 flex-1 px-2 text-xs"
        />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 px-2 text-xs"
          disabled={disabled || !value}
          onClick={() => onChange(undefined)}
        >
          {clearLabel}
        </Button>
      </div>
      {swatches && (
        <div className="flex flex-wrap gap-1.5">
          {swatches.map((hex) => (
            <button
              key={hex}
              type="button"
              aria-label={hex}
              disabled={disabled}
              onClick={() => commit(hex)}
              className={`h-6 w-6 rounded-full border disabled:cursor-not-allowed disabled:opacity-50 ${
                value?.toLowerCase() === hex ? 'ring-2 ring-offset-1 ring-foreground' : ''
              }`}
              style={{ backgroundColor: hex }}
            />
          ))}
        </div>
      )}
      {helper && <p className="text-xs text-muted-foreground dark:text-gray-400">{helper}</p>}
    </div>
  );
};

const FontField: React.FC<{
  label: string;
  value: FormFontId | undefined;
  defaultLabel: string;
  tamilBadge: string;
  disabled: boolean;
  onChange: (id: FormFontId | undefined) => void;
}> = ({ label, value, defaultLabel, tamilBadge, disabled, onChange }) => {
  const labelId = useId();
  return (
    <div className="space-y-2">
      <Label id={labelId} className="block text-xs text-foreground dark:text-gray-400">
        {label}
      </Label>
      <Select
        value={value ?? 'default'}
        onValueChange={(next) => onChange(next === 'default' ? undefined : (next as FormFontId))}
        disabled={disabled}
      >
        <SelectTrigger aria-labelledby={labelId} className="h-8 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="default">{defaultLabel}</SelectItem>
          {FONT_IDS.map((id) => (
            <SelectItem key={id} value={id}>
              <span style={{ fontFamily: FONT_CATALOG[id].stack }}>{FONT_CATALOG[id].label}</span>
              {FONT_CATALOG[id].supportsTamil && (
                <span className="ml-2 text-[10px] text-muted-foreground">🌐 {tamilBadge}</span>
              )}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};

/**
 * BrandStyleControls — per-form design tokens (brand color, surface, fonts,
 * corners, input/button style). Every change merges into `layout.tokens`;
 * reset removes the key so the form returns to its legacy look.
 * See docs/design-tokens-plan.md Phase 5.
 */
export const BrandStyleControls: React.FC<BrandStyleControlsProps> = ({
  layout,
  canEditLayout,
  onLayoutUpdate,
  onReset,
  t,
  sections,
}) => {
  const show = (section: BrandSection) => !sections || sections.includes(section);
  const tokens = layout.tokens;
  const disabled = !canEditLayout;
  const brand = tokens?.primaryColor;
  const previewColor = brand ?? PREVIEW_FALLBACK_COLOR;

  // Preview the font choices in their own typeface; loaded only while the drawer is open.
  useEffect(() => {
    const href = getGoogleFontsHref(FONT_IDS);
    if (!href || document.querySelector('link[data-df-fonts-preview]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.setAttribute('data-df-fonts-preview', '');
    document.head.appendChild(link);
  }, []);

  const { setPreview, clearPreview } = useBrandPreviewStore();
  const previewTokens = useEffectiveTokens(tokens);
  const comparing = useBrandPreviewStore((s) => s.active && s.tokens === undefined);

  // Leaving the drawer must never leave a transient preview on the canvas.
  useEffect(() => clearPreview, [clearPreview]);

  const previewToken = (key: 'primaryColor' | 'surfaceColor', hex: string | undefined) => {
    if (disabled || !hex) {
      clearPreview();
      return;
    }
    setPreview({ ...tokens, version: 1, [key]: hex } as FormDesignTokens);
  };

  const previewPreset = (preset: BrandPreset | null) => {
    if (disabled || !preset) {
      clearPreview();
      return;
    }
    setPreview({ version: 1, ...preset.tokens } as FormDesignTokens);
  };

  const setToken = <K extends keyof Omit<FormDesignTokens, 'version'>>(
    key: K,
    value: FormDesignTokens[K] | undefined
  ) => {
    if (disabled) return;
    clearPreview();
    trackEvent('brand_token_changed', { token: String(key) });
    const next: Record<string, unknown> = { ...tokens, version: 1 };
    if (value === undefined) delete next[key];
    else next[key] = value;
    if (Object.keys(next).length === 1) {
      onReset();
      return;
    }
    onLayoutUpdate({ tokens: next as unknown as FormDesignTokens });
  };

  const applyPreset = (preset: BrandPreset) => {
    if (disabled) return;
    clearPreview();
    trackEvent('brand_preset_applied', { preset: preset.id, source: 'drawer' });
    onLayoutUpdate({ tokens: { version: 1, ...preset.tokens } as FormDesignTokens });
  };

  const primaryOn = brand ? readableOn(brand) : undefined;
  const primaryRatio = brand && primaryOn ? contrastRatio(brand, primaryOn) : undefined;
  const surface = tokens?.surfaceColor;
  const textColor = layout.textColor;
  const surfaceRatio =
    surface && HEX_RE.test(textColor) ? contrastRatio(textColor, surface) : undefined;
  const lowPrimary = primaryRatio !== undefined && primaryRatio < MIN_CONTRAST;
  const lowSurface = surfaceRatio !== undefined && surfaceRatio < MIN_CONTRAST;

  return (
    <div className="space-y-5" data-testid="brand-style-controls">
      {show('preview') && (
        <BrandPreviewCard
          tokens={previewTokens}
          title={t('brandStyle.preview.title')}
          nameLabel={t('brandStyle.preview.nameLabel')}
          namePlaceholder={t('brandStyle.preview.namePlaceholder')}
          optionLabel={t('brandStyle.preview.option')}
          primaryLabel={t('brandStyle.preview.primary')}
          secondaryLabel={t('brandStyle.preview.secondary')}
        />
      )}
      {show('compare') && tokens && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 w-full text-xs"
          aria-pressed={comparing}
          data-testid="brand-compare-toggle"
          onClick={() => (comparing ? clearPreview() : setPreview(undefined))}
        >
          {comparing ? t('brandStyle.compare.showing') : t('brandStyle.compare.hold')}
        </Button>
      )}

      {show('presets') && (
        <div className="space-y-2">
          <Label className="block text-xs text-foreground dark:text-gray-400">
            {t('brandStyle.presets.label')}
          </Label>
          <div className="grid grid-cols-2 gap-1.5" role="group" aria-label={t('brandStyle.presets.label')}>
            {BRAND_PRESETS.map((preset) => (
              <PresetButton
                key={preset.id}
                preset={preset}
                label={t(`brandStyle.presets.${preset.id}`)}
                active={matchesPreset(tokens, preset)}
                disabled={disabled}
                onApply={applyPreset}
                onPreview={previewPreset}
              />
            ))}
          </div>
        </div>
      )}
      {show('brandColor') && (
        <ColorField
          label={t('brandStyle.brandColor.label')}
          value={brand}
          placeholder={t('brandStyle.brandColor.placeholder')}
          clearLabel={t('brandStyle.clear')}
          swatches={QUICK_SWATCHES}
          disabled={disabled}
          onChange={(hex) => setToken('primaryColor', hex)}
          onPreview={(hex) => previewToken('primaryColor', hex)}
        />
      )}
      {show('surfaceColor') && (
        <ColorField
          label={t('brandStyle.surfaceColor.label')}
          value={surface}
          placeholder={t('brandStyle.surfaceColor.placeholder')}
          clearLabel={t('brandStyle.clear')}
          helper={t('brandStyle.surfaceColor.helper')}
          disabled={disabled}
          onChange={(hex) => setToken('surfaceColor', hex)}
          onPreview={(hex) => previewToken('surfaceColor', hex)}
        />
      )}
      {show('headingFont') && (
        <FontField
          label={t('brandStyle.headingFont.label')}
          value={tokens?.headingFont}
          defaultLabel={t('brandStyle.fontDefault')}
          tamilBadge={t('brandStyle.tamil')}
          disabled={disabled}
          onChange={(id) => setToken('headingFont', id)}
        />
      )}
      {show('bodyFont') && (
        <FontField
          label={t('brandStyle.bodyFont.label')}
          value={tokens?.bodyFont}
          defaultLabel={t('brandStyle.fontDefault')}
          tamilBadge={t('brandStyle.tamil')}
          disabled={disabled}
          onChange={(id) => setToken('bodyFont', id)}
        />
      )}
      {show('corners') && (
        <div className="space-y-2">
          <Label className="block text-xs text-foreground dark:text-gray-400">
            {t('brandStyle.corners.label')}
          </Label>
          <div className="grid grid-cols-5 gap-1.5" role="group" aria-label={t('brandStyle.corners.label')}>
            {RADII.map((radius) => (
              <button
                key={radius}
                type="button"
                disabled={disabled}
                aria-pressed={tokens?.radius === radius}
                onClick={() => setToken('radius', radius)}
                className={optionButtonClass(tokens?.radius === radius)}
              >
                <span
                  className="h-5 w-5 border-2 border-current"
                  style={{ borderRadius: RADIUS_PREVIEW[radius] }}
                />
                {t(`brandStyle.corners.${radius}`)}
              </button>
            ))}
          </div>
        </div>
      )}
      {show('inputStyle') && (
        <div className="space-y-2">
          <Label className="block text-xs text-foreground dark:text-gray-400">
            {t('brandStyle.inputStyle.label')}
          </Label>
          <div className="grid grid-cols-3 gap-1.5" role="group" aria-label={t('brandStyle.inputStyle.label')}>
            {INPUT_STYLES.map((style) => (
              <button
                key={style}
                type="button"
                disabled={disabled}
                aria-pressed={tokens?.inputStyle === style}
                onClick={() => setToken('inputStyle', style)}
                className={optionButtonClass(tokens?.inputStyle === style)}
              >
                <span
                  className="block h-5 w-full"
                  style={{
                    borderStyle: style === 'outlined' || style === 'underline' ? 'solid' : 'none',
                    borderColor: previewColor,
                    borderTopWidth: style === 'outlined' ? 1.5 : 0,
                    borderLeftWidth: style === 'outlined' ? 1.5 : 0,
                    borderRightWidth: style === 'outlined' ? 1.5 : 0,
                    borderBottomWidth: style === 'underline' ? 2 : style === 'outlined' ? 1.5 : 0,
                    backgroundColor: style === 'filled' ? 'rgba(0,0,0,0.08)' : undefined,
                    borderRadius: style === 'underline' ? 0 : 4,
                  }}
                />
                {t(`brandStyle.inputStyle.${style}`)}
              </button>
            ))}
          </div>
        </div>
      )}
      {show('buttonStyle') && (
        <div className="space-y-2">
          <Label className="block text-xs text-foreground dark:text-gray-400">
            {t('brandStyle.buttonStyle.label')}
          </Label>
          <div className="grid grid-cols-3 gap-1.5" role="group" aria-label={t('brandStyle.buttonStyle.label')}>
            {BUTTON_STYLES.map((style) => (
              <button
                key={style}
                type="button"
                disabled={disabled}
                aria-pressed={tokens?.buttonStyle === style}
                onClick={() => setToken('buttonStyle', style)}
                className={optionButtonClass(tokens?.buttonStyle === style)}
              >
                <span
                  className="block h-5 w-full rounded"
                  style={{
                    backgroundColor:
                      style === 'solid'
                        ? previewColor
                        : style === 'soft'
                          ? `${previewColor}33`
                          : 'transparent',
                    border: style === 'outline' ? `1.5px solid ${previewColor}` : undefined,
                  }}
                />
                {t(`brandStyle.buttonStyle.${style}`)}
              </button>
            ))}
          </div>
        </div>
      )}
      {show('contrast') && (lowPrimary || lowSurface) && (
        <div
          role="alert"
          className="space-y-1.5 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900"
        >
          {lowPrimary && brand && primaryRatio !== undefined && (
            <div className="flex items-center justify-between gap-2">
              <span>
                {t('brandStyle.contrast.primary', { values: { ratio: primaryRatio.toFixed(1) } })}
              </span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 px-2 text-xs"
                disabled={disabled}
                onClick={() => setToken('primaryColor', darkenToContrast(brand, '#ffffff'))}
              >
                {t('brandStyle.contrast.darken')}
              </Button>
            </div>
          )}
          {lowSurface && surfaceRatio !== undefined && (
            <p>{t('brandStyle.contrast.surface', { values: { ratio: surfaceRatio.toFixed(1) } })}</p>
          )}
        </div>
      )}

      {show('reset') && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full"
          disabled={disabled || !tokens}
          onClick={() => !disabled && onReset()}
        >
          {t('brandStyle.reset')}
        </Button>
      )}
    </div>
  );
};

export default BrandStyleControls;
