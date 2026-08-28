/**
 * Height classes that switch a layout between its two shells.
 *
 * **Viewport shell** (the default, everywhere today): the layout fills its
 * container with `h-full`, and one `flex-1 overflow-y-auto` scroller inside it
 * takes the overflow. Every screen is exactly the height of the window.
 *
 * **Embedded shell** (`/embed/:shortUrl`): there is no window to fill — the
 * iframe is sized *from* the content by the host page, via the ResizeObserver
 * in `embedBridge.ts`. So every `h-full` has to go: a `height:100%` chain that
 * bottoms out in an auto-height ancestor collapses to zero, and every
 * `overflow-y-auto` has to go too, or the frame gets an inner scrollbar the
 * host can never size away.
 *
 * ## Why the intro screen keeps a definite height
 *
 * The intro screens are full-bleed heroes: a background image showcase with an
 * *absolutely positioned* white paper card over it (L1/L2/L4/L5/L7 use
 * `inset`/percentage offsets, L8 has no in-flow content at all — just an image
 * and an absolutely positioned CTA). Their height is not a function of their
 * content, so "fit content" has no meaning for them; asking for it collapses
 * the hero to nothing.
 *
 * So embedded intros get a definite-height box, and the whole
 * absolute/percentage arrangement inside works unchanged. The pages and
 * thank-you screens — the parts that actually have content — get true content
 * height. The host frame simply animates from the intro height to the content
 * height when the respondent taps the CTA, which the resize protocol already
 * handles.
 *
 * @see docs/form-embed-v1-spec.md §11 ("content-height variant of the shell")
 */

/**
 * Height of an embedded intro/hero screen: tall enough to read as a hero at a
 * typical embed width, short enough not to dominate a host page above the fold.
 *
 * Held as a literal class rather than a number, because Tailwind's scanner
 * reads source text — an interpolated `h-[${n}px]` never reaches the
 * stylesheet, so a number here would need a second, hand-kept copy of the same
 * value and the two would drift.
 */
const EMBED_INTRO_HEIGHT_CLASS = 'h-[560px]';

export interface LayoutShellClasses {
  /** Layout root. */
  root: string;
  /** The single scroll container directly under the root. */
  scroll: string;
  /** A screen shell whose height follows its content when embedded (pages, thank-you). */
  screen: string;
  /** The padded, scrolling pane inside such a screen. */
  screenPane: string;
  /** The intro/hero screen shell — definite height in both shells (see above). */
  introScreen: string;
  /** `min-h-full` on an inner column (L6) — meaningless without a definite parent. */
  minHFull: string;
}

const VIEWPORT_SHELL: LayoutShellClasses = {
  root: 'h-full',
  scroll: 'flex-1 overflow-y-auto',
  screen: 'h-full',
  screenPane: 'h-full overflow-y-auto',
  introScreen: 'h-full',
  minHFull: 'min-h-full',
};

const EMBEDDED_SHELL: LayoutShellClasses = {
  root: '',
  scroll: '',
  screen: '',
  screenPane: '',
  introScreen: EMBED_INTRO_HEIGHT_CLASS,
  minHFull: '',
};

export function layoutShell(embedded?: boolean): LayoutShellClasses {
  return embedded ? EMBEDDED_SHELL : VIEWPORT_SHELL;
}
