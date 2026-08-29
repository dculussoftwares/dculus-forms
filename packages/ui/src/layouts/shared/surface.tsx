import React from 'react';
import { getImageUrl, mixWithWhite } from '@dculus/utils';
import type { FormLayout } from '@dculus/types';

/**
 * Shared surface tokens + background machinery for the 9 form layouts.
 *
 * Before this module each layout carried its own hand-rolled copy of the
 * outer-background style ladder and the blur/video overlay JSX — nine
 * near-identical blocks that had already drifted (blur(250px) vs blur(50px),
 * `rgba(0,0,0,0.1)` vs `rgba(255,255,255,0.05)` tints, `rounded-sm` vs
 * `rounded-lg` frames). They now all call the same helpers so the whole family
 * reads as one system.
 *
 * ## Mobile vs desktop background
 *
 * On desktop the hero keeps its "framed showcase over a soft wash" look, but
 * the wash is a *cheap* one: a dominant-colour fill (already sampled into
 * `layout.backgroundDominantColor` at upload time) or a mild `blur(40px)` —
 * never the old `blur(250px)`, which on mobile Safari janks and often paints a
 * flat grey anyway.
 *
 * On mobile (`max-sm`) there is no blur overlay at all — the layouts render a
 * crisp image band with the content sheet below it (Microsoft-Forms style), so
 * a blurred full-bleed copy would just be wasted pixels behind an opaque sheet.
 */

/** One set of radius / shadow tokens for every layout's frame + card. */
export const SURFACE = {
  /** The padded hero frame that holds the image + content composition. */
  frame: 'rounded-none sm:rounded-2xl sm:shadow-xl sm:ring-1 sm:ring-black/5',
  /** The white content card that floats inside the frame / slides up on mobile. */
  card: 'rounded-t-3xl sm:rounded-2xl',
  /** The pages / thank-you content card. */
  panel: 'rounded-2xl shadow-lg ring-1 ring-black/5',
} as const;

/** Fixed, predictable gutters for the hero frame (replaces proportional `px-[10%]`). */
export const HERO_FRAME_PADDING =
  'px-0 py-0 sm:px-8 sm:py-8 lg:px-12 lg:py-10';

/** Inner max width so the frame doesn't sprawl on ultrawide monitors. */
export const HERO_FRAME_MAXW = 'w-full max-w-6xl mx-auto h-full';

/**
 * Muted per-layout default gradient, shown only when the form has no
 * background image / video / custom colour. Toned down from the original
 * saturated presets (coral, electric purple, a 5-stop rainbow) so an
 * un-styled form still looks considered — while keeping a faint per-layout
 * tint so the picker previews aren't all identical.
 */
export const LAYOUT_GRADIENT: Record<string, string> = {
  L1: 'linear-gradient(160deg, #f6f1ea 0%, #efe7dc 55%, #e7dccd 100%)',
  L2: 'linear-gradient(160deg, #f2f4f8 0%, #e9edf4 55%, #dfe6f0 100%)',
  L3: 'linear-gradient(160deg, #f1f2fb 0%, #e8eaf7 55%, #dee1f3 100%)',
  L4: 'linear-gradient(160deg, #f8fafc 0%, #eef1f5 55%, #e6ebf1 100%)',
  L5: 'linear-gradient(160deg, #f2f6f9 0%, #e8eff4 55%, #dde8ef 100%)',
  L6: 'linear-gradient(160deg, #f6f3f0 0%, #edeae6 55%, #e4e0da 100%)',
  L7: 'linear-gradient(160deg, #f7f7f6 0%, #eeeeec 55%, #e5e5e2 100%)',
  L8: 'linear-gradient(160deg, #f5f5f4 0%, #ededeb 55%, #e4e4e1 100%)',
  L9: 'linear-gradient(160deg, #f7f7f6 0%, #eeeeec 55%, #e5e5e2 100%)',
};

export interface OuterBackgroundOptions {
  layout?: FormLayout;
  cdnEndpoint?: string;
  hasVideoBackground: boolean;
  /** Layout code, selects the muted fallback gradient. */
  layoutCode: string;
}

/**
 * The outer-area background style. Order of precedence, unchanged from the
 * per-layout originals except that *every* layout now honours
 * `backgroundDominantColor` (L7/L9 previously skipped it for no real reason):
 *
 *   custom colour  →  sampled dominant colour wash  →  video (transparent, the
 *   <video> element paints it)  →  background image (cover; blurred by
 *   `BackgroundLayers` on desktop)  →  muted per-layout gradient
 */
export function buildOuterBackgroundStyle({
  layout,
  cdnEndpoint,
  hasVideoBackground,
  layoutCode,
}: OuterBackgroundOptions): React.CSSProperties {
  if (layout?.isCustomBackgroundColorEnabled && layout?.customBackGroundColor) {
    return {
      backgroundColor: layout.customBackGroundColor,
      transition: 'background-color 0.5s ease-in-out',
    };
  }
  if (layout?.backgroundDominantColor) {
    return {
      backgroundColor: mixWithWhite(layout.backgroundDominantColor, 0.6),
      transition: 'background-color 0.5s ease-in-out',
    };
  }
  if (hasVideoBackground) {
    return { transition: 'all 0.5s ease-in-out' };
  }
  if (layout?.backgroundImageKey && cdnEndpoint) {
    return {
      backgroundImage: `url(${getImageUrl(layout.backgroundImageKey, cdnEndpoint)})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat',
      transition: 'all 0.5s ease-in-out',
    };
  }
  return {
    background: LAYOUT_GRADIENT[layoutCode] ?? LAYOUT_GRADIENT.L4,
    transition: 'background 0.5s ease-in-out',
  };
}

export interface BackgroundLayersProps {
  layout?: FormLayout;
  cdnEndpoint?: string;
  hasVideoBackground: boolean;
  videoUrl: string;
}

/**
 * Full-bleed video element + (desktop-only) soft blur overlay for the outer
 * area. Renders nothing on mobile: the layouts show a crisp image band there,
 * with the content sheet on top, so an overlay would be invisible anyway.
 */
export const BackgroundLayers: React.FC<BackgroundLayersProps> = ({
  layout,
  cdnEndpoint,
  hasVideoBackground,
  videoUrl,
}) => {
  const usingCustomColor = layout?.isCustomBackgroundColorEnabled && !!layout?.customBackGroundColor;
  const usingDominantColor = !!layout?.backgroundDominantColor;
  const hasImage = !!layout?.backgroundImageKey && !!cdnEndpoint;
  const showVideo = hasVideoBackground && !usingCustomColor && !usingDominantColor;
  const showBlur = !usingCustomColor && !usingDominantColor && (hasVideoBackground || hasImage);

  return (
    <>
      {showVideo && (
        <video
          key={videoUrl}
          autoPlay
          muted
          loop
          playsInline
          aria-hidden="true"
          className="absolute inset-0 w-full h-full object-cover"
          src={videoUrl}
        />
      )}
      {showBlur && (
        <div
          className="absolute inset-0 hidden sm:block"
          style={{
            backdropFilter: hasVideoBackground ? undefined : 'blur(40px)',
            WebkitBackdropFilter: hasVideoBackground ? undefined : 'blur(40px)',
            backgroundColor: 'rgba(15, 23, 42, 0.08)',
            transition: 'background-color 0.5s ease-in-out',
          }}
        />
      )}
    </>
  );
};

/**
 * The crisp media that fills the hero's "image" region — a real showcase now,
 * on mobile (a band above the sheet) as well as desktop (a column beside the
 * card). Falls back to a per-layout gradient wash when the form has no media.
 */
export const HeroMedia: React.FC<{
  layout?: FormLayout;
  cdnEndpoint?: string;
  hasVideoBackground: boolean;
  videoUrl: string;
  layoutCode: string;
}> = ({ layout, cdnEndpoint, hasVideoBackground, videoUrl, layoutCode }) => {
  if (hasVideoBackground) {
    return (
      <video
        key={videoUrl}
        autoPlay
        muted
        loop
        playsInline
        aria-hidden="true"
        className="absolute inset-0 w-full h-full object-cover"
        src={videoUrl}
      />
    );
  }
  if (layout?.backgroundImageKey && cdnEndpoint) {
    return (
      <div
        className="absolute inset-0 bg-center bg-no-repeat bg-cover"
        style={{ backgroundImage: `url(${getImageUrl(layout.backgroundImageKey, cdnEndpoint)})` }}
      />
    );
  }
  return (
    <div
      className="absolute inset-0"
      style={{ background: LAYOUT_GRADIENT[layoutCode] ?? LAYOUT_GRADIENT.L4 }}
    />
  );
};
