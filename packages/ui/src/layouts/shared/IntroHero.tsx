import React from 'react';
import type { FormLayout } from '@dculus/types';
import { RendererMode } from '@dculus/utils';
import {
  BackgroundLayers,
  HeroMedia,
  HERO_FRAME_PADDING,
  HERO_FRAME_MAXW,
} from './surface';
import {
  IntroContentEditing,
  IntroEditToolbar,
  IntroEditor,
  IntroCta,
} from './introContent';
import { useContainerBreakpoint } from './useContainerBreakpoint';

/**
 * One responsive hero for all seven intro layouts (L1–L5, L7, L8).
 *
 * - **Mobile** (container < 560px, measured — see `useContainerBreakpoint`):
 *   every variant renders the same Microsoft-Forms-style composition — a crisp
 *   image band with the content sheet sliding up over it, one natural page
 *   scroll, no nested scroll region, no blurred wash.
 * - **Desktop**: each `variant` is a genuinely distinct composition so the nine
 *   layout codes stay meaningful (the old L1/L2 and L4/L5 were mirror-image
 *   recolours of each other).
 *
 * `content` / `cta` are supplied by the caller but rendered exactly once —
 * only one of the mobile / desktop branches mounts at a time.
 */

export type IntroDesktopVariant =
  | 'classic' // L1 — framed, image left, floating inset card
  | 'modern' // L2 — flat frame, large image right, edge-to-edge content panel
  | 'card' // L3 — full-bleed image, centered floating card
  | 'minimal' // L4 — narrow image rail, airy centered content
  | 'split' // L5 — literal 50/50 split with a crisp seam
  | 'single' // L7 — no image column, full-width centered content
  | 'hero'; // L8 — full-bleed image, headline + CTA on a scrim

export interface IntroHeroProps {
  /** Ref to the layout's own root element — measured to pick mobile vs desktop. */
  containerRef: React.RefObject<HTMLElement>;
  variant: IntroDesktopVariant;
  layoutCode: string;
  layout?: FormLayout;
  cdnEndpoint?: string;
  mode: RendererMode;
  hasVideoBackground: boolean;
  videoUrl: string;
  outerBackgroundStyle: React.CSSProperties;
  /** From `textColorStyle()` — `{}` unless a light-mode custom colour is set. */
  textStyle: React.CSSProperties;
  editing: IntroContentEditing;
  ctaLabel: string;
  onCta: () => void;
  /**
   * Definite height for the desktop composition (`h-full` / `h-[560px]`) — the
   * framed layout's internal `h-full` chain needs it.
   */
  fixedClass: string;
  /**
   * Growable height for the mobile sheet (`min-h-full` / `min-h-[560px]`) — the
   * sheet is free to run past a screenful and scroll the whole page.
   */
  growClass: string;
}

const mediaProps = (p: IntroHeroProps) => ({
  layout: p.layout,
  cdnEndpoint: p.cdnEndpoint,
  hasVideoBackground: p.hasVideoBackground,
  videoUrl: p.videoUrl,
  layoutCode: p.layoutCode,
});

/* ------------------------------- mobile ---------------------------------- */

const MobileSheet: React.FC<IntroHeroProps> = (p) => (
  <section className={`relative flex flex-col ${p.growClass}`} style={p.outerBackgroundStyle}>
    <div className="relative shrink-0 h-[260px] w-full overflow-hidden">
      <HeroMedia {...mediaProps(p)} />
      <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/15 to-transparent" />
    </div>

    <div className="relative z-[1] -mt-8 flex-1 flex flex-col rounded-t-[28px] bg-white dark:bg-gray-900 px-6 pt-8 pb-10 shadow-[0_-12px_40px_-12px_rgba(0,0,0,0.22)]">
      <IntroEditToolbar editing={p.editing} mode={p.mode} />
      <div className="flex flex-col py-2" style={p.textStyle}>
        <div className="w-full max-w-xl">
          <IntroEditor editing={p.editing} mode={p.mode} />
        </div>
        <div className="pt-8">
          <IntroCta label={p.ctaLabel} onClick={p.onCta} className="w-full" />
        </div>
      </div>
    </div>
  </section>
);

/* ------------------------------ desktop --------------------------------- */

const ContentBody: React.FC<{
  p: IntroHeroProps;
  align?: 'left' | 'center';
  maxW?: string;
  padding?: string;
  scrim?: boolean;
  /** Stretch to the parent's height (needs a definite-height parent). */
  fill?: boolean;
}> = ({ p, align = 'left', maxW = 'max-w-md', padding = 'px-10 py-12', scrim = false, fill = true }) => (
  <div className={`flex flex-col ${fill ? 'h-full overflow-y-auto' : ''} ${padding}`}>
    <IntroEditToolbar editing={p.editing} mode={p.mode} />
    {/* Headline + CTA are one block, vertically centered together — so a short
        intro doesn't leave the button stranded at the bottom of a tall card. */}
    <div
      className={`${fill ? 'flex-1' : ''} flex flex-col justify-center ${
        align === 'center' ? 'items-center text-center' : 'items-start'
      } ${scrim ? 'text-white [&_h1]:text-white [&_h2]:text-white [&_p]:text-white/90' : ''}`}
      style={scrim ? undefined : p.textStyle}
    >
      <div className={`w-full ${maxW}`}>
        <IntroEditor editing={p.editing} mode={p.mode} />
      </div>
      <div className="pt-8">
        <IntroCta label={p.ctaLabel} onClick={p.onCta} />
      </div>
    </div>
  </div>
);

const DesktopHero: React.FC<IntroHeroProps> = (p) => {
  const frameBase = 'relative h-full flex overflow-hidden rounded-2xl ring-1 ring-black/5';
  const surfaceCard = 'bg-white dark:bg-gray-900';

  let frame: React.ReactNode;

  switch (p.variant) {
    case 'classic':
      frame = (
        <div className={`${frameBase} shadow-xl flex-row`}>
          <div className="relative w-[46%] shrink-0">
            <HeroMedia {...mediaProps(p)} />
          </div>
          <div className="relative flex-1">
            {/* Card pulls left over the image edge for an editorial overlap. */}
            <div
              className={`absolute inset-y-8 right-8 -left-14 rounded-xl ${surfaceCard} shadow-2xl ring-1 ring-black/5`}
            >
              <ContentBody p={p} maxW="max-w-md" padding="p-10" />
            </div>
          </div>
        </div>
      );
      break;

    case 'modern':
      frame = (
        <div className={`${frameBase} shadow-lg flex-row-reverse`}>
          <div className="relative w-[55%] shrink-0">
            <HeroMedia {...mediaProps(p)} />
          </div>
          <div className={`relative flex-1 ${surfaceCard}`}>
            <ContentBody p={p} maxW="max-w-lg" padding="px-12 py-14" />
          </div>
        </div>
      );
      break;

    case 'card':
      frame = (
        <div className={`${frameBase} shadow-xl`}>
          <HeroMedia {...mediaProps(p)} />
          <div className="relative z-10 h-full w-full flex items-center justify-center p-10">
            <div className={`w-full max-w-md rounded-2xl ${surfaceCard} shadow-2xl ring-1 ring-black/5 max-h-full overflow-y-auto`}>
              <ContentBody p={p} align="center" maxW="max-w-sm" padding="p-9" fill={false} />
            </div>
          </div>
        </div>
      );
      break;

    case 'minimal':
      frame = (
        <div className={`${frameBase} flex-row`}>
          <div className="relative w-[30%] shrink-0">
            <HeroMedia {...mediaProps(p)} />
          </div>
          <div className={`relative flex-1 ${surfaceCard}`}>
            <ContentBody p={p} align="center" maxW="max-w-md" padding="px-10 py-16" />
          </div>
        </div>
      );
      break;

    case 'split':
      frame = (
        <div className={`${frameBase} flex-row-reverse`}>
          <div className="relative w-1/2 shrink-0 border-l-2 border-black/10 dark:border-white/15">
            <HeroMedia {...mediaProps(p)} />
          </div>
          <div className={`relative w-1/2 bg-gray-50 dark:bg-gray-900`}>
            <ContentBody p={p} maxW="max-w-md" padding="px-11 py-14" />
          </div>
        </div>
      );
      break;

    case 'single':
      frame = (
        <div className={`${frameBase} shadow-xl`}>
          <div className={`relative w-full ${surfaceCard}`}>
            <ContentBody p={p} align="center" maxW="max-w-2xl" padding="px-10 py-16" />
          </div>
        </div>
      );
      break;

    case 'hero':
      frame = (
        <div className={`${frameBase} shadow-xl`}>
          <HeroMedia {...mediaProps(p)} />
          <div className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/85 via-black/55 to-transparent px-12 pt-36 pb-12">
            <ContentBody p={p} maxW="max-w-2xl" padding="p-0" scrim fill={false} />
          </div>
        </div>
      );
      break;
  }

  return (
    <section className={`relative ${p.fixedClass}`} style={p.outerBackgroundStyle}>
      <BackgroundLayers
        layout={p.layout}
        cdnEndpoint={p.cdnEndpoint}
        hasVideoBackground={p.hasVideoBackground}
        videoUrl={p.videoUrl}
      />
      <div className={`relative z-10 h-full ${HERO_FRAME_PADDING}`}>
        <div className={HERO_FRAME_MAXW}>{frame}</div>
      </div>
    </section>
  );
};

export const IntroHero: React.FC<IntroHeroProps> = (props) => {
  const narrow = useContainerBreakpoint(props.containerRef);
  return narrow ? <MobileSheet {...props} /> : <DesktopHero {...props} />;
};
