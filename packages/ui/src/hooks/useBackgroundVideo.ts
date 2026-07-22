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
  // Lazy initializer reads the real preference on the first render — starting from a
  // hardcoded `false` would briefly render the video for reduced-motion users before
  // the effect below has a chance to run.
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(
    () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  );

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  const hasVideoBackground =
    Boolean(layout?.backgroundVideoKey) && Boolean(cdnEndpoint) && !prefersReducedMotion;
  const videoUrl = hasVideoBackground ? getImageUrl(layout!.backgroundVideoKey!, cdnEndpoint!) : '';

  return { hasVideoBackground, videoUrl };
}
