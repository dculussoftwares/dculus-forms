import React from 'react';
import type { FormLayout } from '@dculus/types';
import { BackgroundLayers } from './surface';

/**
 * Shared wrapper for the `pages` and `thank-you` screens. Previously every
 * layout inlined its own copy of the background/video/blur stack plus the
 * padded pane; they now share this so the whole family gets the same
 * (desktop-only, gentle) background treatment and the same spacing hooks.
 */
export const LayoutScreenShell: React.FC<{
  layout?: FormLayout;
  cdnEndpoint?: string;
  hasVideoBackground: boolean;
  videoUrl: string;
  outerBackgroundStyle: React.CSSProperties;
  /** `shell.screen` */
  screenClass: string;
  /** `shell.screenPane` */
  paneClass: string;
  /** vertical padding from `spacingClasses()` */
  paddingY: string;
  /** center the child (thank-you screen) */
  center?: boolean;
  /** Ref onto the scrolling pane — see `useScrollReset`. */
  paneRef?: React.Ref<HTMLDivElement>;
  children: React.ReactNode;
}> = ({
  layout,
  cdnEndpoint,
  hasVideoBackground,
  videoUrl,
  outerBackgroundStyle,
  screenClass,
  paneClass,
  paddingY,
  center = false,
  paneRef,
  children,
}) => (
  <div className={`${screenClass} relative`} style={outerBackgroundStyle}>
    <BackgroundLayers
      layout={layout}
      cdnEndpoint={cdnEndpoint}
      hasVideoBackground={hasVideoBackground}
      videoUrl={videoUrl}
    />
    {/*
      `center` intentionally does NOT use `items-center`: centering a flex
      cross-axis clips the start when content overflows the container, and
      scrollTop can never go negative to reach it — a tall thank-you/quiz
      result (many review questions) would permanently hide its own top
      (score badge, first questions) with no way to scroll to it. `m-auto`
      on the child centers only while there's free space and degrades to
      top-aligned + fully scrollable once content overflows.
    */}
    <div
      ref={paneRef}
      className={`${paneClass} relative z-10 px-3 sm:px-8 ${paddingY} ${center ? 'flex' : ''}`}
    >
      {center ? <div className="m-auto w-full">{children}</div> : children}
    </div>
  </div>
);

/** Back-to-intro affordance shown at the top of the pages screen. */
export const BackToIntro: React.FC<{ onClick: () => void; label?: string }> = ({
  onClick,
  label = 'Back to Intro',
}) => (
  <button
    onClick={onClick}
    className="flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white mb-5 transition-colors"
  >
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
    </svg>
    {label}
  </button>
);
