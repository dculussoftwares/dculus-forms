import React, { useRef, useState } from 'react';
import { ImageUp } from 'lucide-react';
import type { FormDesignTokens } from '@dculus/types';
import { Button } from '@dculus/ui';
import { cn, trackEvent } from '@dculus/utils';
import { useTranslation } from '../../../hooks/useTranslation';
import { computePaletteFromImageBlob } from '../../../utils/dominantColor';
import { BRAND_PRESETS, matchesPreset } from './brandPresets';

interface LookPickerProps {
  value: FormDesignTokens | undefined;
  onChange: (tokens: FormDesignTokens | undefined) => void;
  source: string;
}

/** "Pick a look" for form creation: preset cards plus brand-colour suggestions from a logo. */
export const LookPicker: React.FC<LookPickerProps> = ({ value, onChange, source }) => {
  const { t } = useTranslation('designDrawer');
  const fileRef = useRef<HTMLInputElement>(null);
  const [palette, setPalette] = useState<string[]>([]);
  const [noColors, setNoColors] = useState(false);

  const handleLogo = async (file: File | undefined) => {
    if (!file) return;
    const colors = await computePaletteFromImageBlob(file);
    setPalette(colors);
    setNoColors(colors.length === 0);
  };

  const applyColor = (hex: string) => {
    trackEvent('brand_logo_color_applied', { source });
    onChange({ ...(value ?? {}), version: 1, primaryColor: hex } as FormDesignTokens);
  };

  return (
    <div className="space-y-3" data-testid="look-picker">
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
        <button
          type="button"
          onClick={() => onChange(undefined)}
          aria-pressed={!value}
          data-testid="look-picker-default"
          className={cn(
            'rounded-lg border px-3 py-2 text-xs font-medium text-left transition-colors hover:bg-muted',
            !value && 'border-foreground ring-1 ring-foreground'
          )}
        >
          {t('lookPicker.default')}
        </button>
        {BRAND_PRESETS.map((preset) => {
          const active = matchesPreset(value, preset);
          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => {
                trackEvent('brand_preset_applied', { preset: preset.id, source });
                onChange({ version: 1, ...preset.tokens } as FormDesignTokens);
              }}
              aria-pressed={active}
              data-testid={`look-picker-${preset.id}`}
              className={cn(
                'flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium text-left transition-colors hover:bg-muted',
                active && 'border-foreground ring-1 ring-foreground'
              )}
            >
              <span className="h-3.5 w-3.5 rounded-full shrink-0" style={{ backgroundColor: preset.tokens.primaryColor }} />
              {t(`brandStyle.presets.${preset.id}`)}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          data-testid="look-picker-logo-input"
          onChange={(e) => {
            void handleLogo(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
        <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
          <ImageUp className="w-3.5 h-3.5 mr-1.5" />
          {t('lookPicker.fromLogo')}
        </Button>
        {palette.map((hex) => (
          <button
            key={hex}
            type="button"
            onClick={() => applyColor(hex)}
            title={hex}
            aria-label={t('lookPicker.useColor', { values: { color: hex } })}
            className={cn(
              'h-7 w-7 rounded-full border-2 border-white shadow ring-1 ring-border transition-transform hover:scale-110',
              value?.primaryColor?.toLowerCase() === hex && 'ring-2 ring-foreground'
            )}
            style={{ backgroundColor: hex }}
          />
        ))}
        {noColors && <span className="text-xs text-muted-foreground">{t('lookPicker.noColors')}</span>}
      </div>
    </div>
  );
};
