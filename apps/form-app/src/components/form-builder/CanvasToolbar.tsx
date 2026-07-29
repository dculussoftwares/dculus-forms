import React from 'react';
import { Palette, Monitor, Smartphone, Play } from 'lucide-react';
import { Button } from '@dculus/ui';
import { cn } from '@dculus/utils';
import { useTranslation } from '../../hooks/useTranslation';
import { CoachMark } from './coachmarks/CoachMark';

export type CanvasDevice = 'desktop' | 'mobile';

interface CanvasToolbarProps {
  /** Opens the global Design drawer. Stays visible for VIEWER — the drawer's
   * own controls are what get disabled, per docs/form-builder-redesign.md §2.4. */
  onOpenDesign: () => void;
  device: CanvasDevice;
  onDeviceChange: (device: CanvasDevice) => void;
  /** ▶ Preview — relocated here from FormBuilderHeader per the prototype (ticket #231). */
  onOpenPreview: () => void;
}

/**
 * CanvasToolbar — slim bar atop the Content canvas: 🎨 Design · device toggle
 * · ▶ Preview. See docs/form-builder-redesign.md §2.4 and the prototype's
 * `.canvas .toolbar` markup.
 */
export const CanvasToolbar: React.FC<CanvasToolbarProps> = ({
  onOpenDesign,
  device,
  onDeviceChange,
  onOpenPreview,
}) => {
  const { t } = useTranslation('canvasToolbar');

  return (
    <div
      className="flex items-center gap-2 px-3 h-11 shrink-0"
      style={{ borderBottom: '1px solid var(--tf-border-medium)' }}
      data-testid="canvas-toolbar"
    >
      <CoachMark id="design" side="bottom" align="start">
        <Button
          variant="ghost"
          size="sm"
          onClick={onOpenDesign}
          className="h-8 px-3 text-xs"
          data-testid="canvas-toolbar-design-button"
        >
          <Palette className="w-3.5 h-3.5 mr-1.5" />
          {t('buttons.design')}
        </Button>
      </CoachMark>

      <span className="flex-1" />

      <div
        className="flex items-center rounded-lg overflow-hidden"
        style={{ border: '1px solid var(--tf-border-strong)' }}
        role="group"
        aria-label={t('deviceToggle.ariaLabel')}
      >
        <button
          onClick={() => onDeviceChange('desktop')}
          title={t('deviceToggle.desktopTooltip')}
          data-testid="canvas-toolbar-device-desktop"
          aria-pressed={device === 'desktop'}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors',
          )}
          style={{
            background: device === 'desktop' ? 'var(--tf-faint)' : 'transparent',
            color: device === 'desktop' ? 'var(--tf-dark)' : 'var(--tf-muted)',
            borderRight: '1px solid var(--tf-border-strong)',
          }}
        >
          <Monitor className="h-3.5 w-3.5" />
          {t('deviceToggle.desktop')}
        </button>
        <button
          onClick={() => onDeviceChange('mobile')}
          title={t('deviceToggle.mobileTooltip')}
          data-testid="canvas-toolbar-device-mobile"
          aria-pressed={device === 'mobile'}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors"
          style={{
            background: device === 'mobile' ? 'var(--tf-faint)' : 'transparent',
            color: device === 'mobile' ? 'var(--tf-dark)' : 'var(--tf-muted)',
          }}
        >
          <Smartphone className="h-3.5 w-3.5" />
          {t('deviceToggle.mobile')}
        </button>
      </div>

      <span className="flex-1" />

      <Button
        variant="ghost"
        size="sm"
        onClick={onOpenPreview}
        className="h-8 px-3 text-xs"
        data-testid="canvas-toolbar-preview-button"
      >
        <Play className="w-3.5 h-3.5 mr-1.5" />
        {t('buttons.preview')}
      </Button>
    </div>
  );
};

export default CanvasToolbar;
