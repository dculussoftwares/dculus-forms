import { useEffect, useRef } from 'react';

/**
 * The viewport shell's scroll container (`embedShell.ts`) is a single
 * persistent DOM node across screen transitions (intro -> pages ->
 * thank-you) — swapping `screenOverride`/internal screen state only changes
 * what renders inside it, so a scroll position built up on one screen (e.g.
 * scrolled down while answering the last quiz question) otherwise carries
 * straight over to the next screen, landing it already scrolled past its
 * top content (score badge, first review questions).
 *
 * Attach the returned ref to a scroll container and pass the current screen
 * value as `resetKey` — scrollTop resets to 0 whenever it changes.
 */
export function useScrollReset<T extends HTMLElement>(resetKey: unknown) {
  const ref = useRef<T>(null);
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = 0;
  }, [resetKey]);
  return ref;
}
