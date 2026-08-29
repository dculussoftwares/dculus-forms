import React from 'react';

/**
 * Tracks whether a container is narrower than `breakpoint` px, measuring the
 * element itself rather than the viewport.
 *
 * The form layouts need this because the builder's mobile preview renders them
 * inside a 390px phone frame that sits in a full-width desktop viewport — a
 * `@media (min-width: 640px)` query (and therefore every Tailwind `sm:`
 * utility) still reports "desktop" in that box. A `ResizeObserver` on the
 * layout's own root sees the real 390px and lets the layout switch to its
 * mobile composition, so the preview matches an actual phone and there's no
 * CSS shim to keep in sync.
 *
 * Measured synchronously in `useLayoutEffect` before paint to avoid a
 * desktop→mobile flash on first render.
 */
export function useContainerBreakpoint(
  ref: React.RefObject<HTMLElement>,
  // 560, not 640: below this the desktop split/framed hero compositions get
  // genuinely cramped and the mobile sheet is the better rendering — and it
  // keeps a slightly-narrowed builder canvas on the desktop composition.
  breakpoint = 560
): boolean {
  const [narrow, setNarrow] = React.useState(false);

  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    const measure = (width: number) => setNarrow(width > 0 && width < breakpoint);
    measure(el.getBoundingClientRect().width);

    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) measure(entry.contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref, breakpoint]);

  return narrow;
}
