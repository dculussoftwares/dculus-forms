import React from 'react';
import { Button } from '@dculus/ui';
import { FONT_CATALOG } from '@dculus/utils';
import { useFormBuilderStore } from '../../store/useFormBuilderStore';
import { useTranslation } from '../../hooks/useTranslation';
import { BRAND_PRESETS, matchesPreset } from './design/brandPresets';

interface BrandChipProps {
  onClick: () => void;
}

/**
 * Always-visible header summary of the form's brand (swatch · "Aa" in the heading
 * font · preset name). Unbranded forms show a "Make it yours" call to action.
 */
export const BrandChip: React.FC<BrandChipProps> = ({ onClick }) => {
  const { t } = useTranslation('formBuilderHeader');
  const { t: td } = useTranslation('designDrawer');
  const tokens = useFormBuilderStore((s) => s.layout?.tokens);
  const hasBrand = Boolean(tokens && Object.keys(tokens).some((k) => k !== 'version'));
  const preset = BRAND_PRESETS.find((p) => matchesPreset(tokens, p));
  const label = !hasBrand
    ? t('brandChip.empty')
    : preset
      ? td(`brandStyle.presets.${preset.id}`)
      : t('brandChip.custom');
  const fontStack = tokens?.headingFont ? FONT_CATALOG[tokens.headingFont]?.stack : undefined;

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onClick}
      className="h-8 px-2.5 text-xs gap-1.5 max-w-40"
      title={t('brandChip.tooltip')}
      data-testid="header-brand-chip"
    >
      <span
        className="h-3.5 w-3.5 rounded-full shrink-0 border border-dashed"
        style={hasBrand ? { backgroundColor: tokens?.primaryColor ?? '#9ca3af', borderStyle: 'solid' } : undefined}
      />
      {hasBrand && (
        <span className="font-semibold" style={fontStack ? { fontFamily: fontStack } : undefined}>
          Aa
        </span>
      )}
      <span className="truncate">{label}</span>
    </Button>
  );
};
