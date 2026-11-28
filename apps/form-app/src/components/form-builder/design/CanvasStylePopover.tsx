import React from 'react';
import { Popover, PopoverAnchor, PopoverContent } from '@dculus/ui';
import { useTranslation } from '../../../hooks/useTranslation';
import { useFormPermissions } from '../../../hooks/useFormPermissions';
import { useFormBuilderStore } from '../../../store/useFormBuilderStore';
import { useCanvasStyleStore, type CanvasStyleTarget } from '../../../store/useCanvasStyleStore';
import { BrandStyleControls, type BrandSection } from './BrandStyleControls';

/** Only the controls that affect the clicked element. */
const TARGET_SECTIONS: Record<CanvasStyleTarget, BrandSection[]> = {
  title: ['headingFont', 'brandColor', 'contrast'],
  input: ['inputStyle', 'corners', 'brandColor', 'contrast'],
  surface: ['surfaceColor', 'bodyFont', 'corners', 'contrast'],
};

export const CANVAS_STYLE_ANCHOR_ATTR = 'data-canvas-style-anchor';

interface CanvasStylePopoverProps {
  target: CanvasStyleTarget;
  /** Single element the popover anchors to; its own click handler calls `toggle(target)`. */
  children: React.ReactElement;
}

/**
 * Click-to-style popover: wraps a canvas element and, while open, shows just the
 * design-token controls relevant to it. Edits go through the same layout update path
 * as the Design drawer, so previews, Y.js sync and permissions behave identically.
 */
export const CanvasStylePopover: React.FC<CanvasStylePopoverProps> = ({ target, children }) => {
  const { t } = useTranslation('designDrawer');
  const permissions = useFormPermissions();
  const canEditLayout = permissions.canEditLayout();
  const { layout, updateLayout, clearLayoutKey } = useFormBuilderStore();
  const open = useCanvasStyleStore((s) => s.target === target);
  const close = useCanvasStyleStore((s) => s.close);

  if (!layout || !canEditLayout) return children;

  return (
    <Popover open={open} onOpenChange={(next) => !next && close()}>
      <PopoverAnchor asChild>
        {React.cloneElement(children, { [CANVAS_STYLE_ANCHOR_ATTR]: target } as Record<string, string>)}
      </PopoverAnchor>
      <PopoverContent
        align="start"
        className="w-80 max-h-[70vh] overflow-y-auto"
        data-testid={`canvas-style-popover-${target}`}
        onOpenAutoFocus={(e) => e.preventDefault()}
        // Re-clicking the element toggles it closed instead of closing and instantly reopening.
        onPointerDownOutside={(e) => {
          const el = e.target as Element | null;
          if (el?.closest(`[${CANVAS_STYLE_ANCHOR_ATTR}="${target}"]`)) e.preventDefault();
        }}
      >
        <p className="mb-3 text-sm font-medium text-foreground">{t(`brandStyle.canvasStyle.${target}`)}</p>
        <BrandStyleControls
          layout={layout}
          canEditLayout={canEditLayout}
          onLayoutUpdate={updateLayout}
          onReset={() => clearLayoutKey('tokens')}
          t={t}
          sections={TARGET_SECTIONS[target]}
        />
      </PopoverContent>
    </Popover>
  );
};
