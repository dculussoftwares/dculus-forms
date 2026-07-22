import { useEffect, useState } from 'react';
import { getImageUrl } from '@dculus/utils';
import { FormLayout } from '@dculus/types';

export interface BackgroundVideo {
  hasVideoBackground: boolean;
  videoUrl: string;
}

/**
 * Resolves whether a layout's video background should render, respecting the
 * user's OS-level motion preference (falls back to the existing image/gradient
 * treatment when prefers-reduced-motion is set, since there's no static poster
 * frame to show instead).
 */
export function useBackgroundVideo(
  layout: FormLayout | undefined,
  cdnEndpoint: string | undefined
): BackgroundVideo {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  const hasVideoBackground =
    Boolean(layout?.backgroundVideoKey) && Boolean(cdnEndpoint) && !prefersReducedMotion;
  const videoUrl = hasVideoBackground ? getImageUrl(layout!.backgroundVideoKey!, cdnEndpoint!) : '';

  return { hasVideoBackground, videoUrl };
}
