/**
 * Scoped CSS overrides that make a form layout render as if the viewport were
 * narrow (<640px) while it actually sits inside a phone-frame canvas at a wide
 * desktop viewport. Shared by the PreviewTab overlay and the Content canvas's
 * mobile device frame (see CanvasToolbar/PageBuilderTab) so both simulate
 * mobile the same way.
 *
 * The redesigned intro hero (`packages/ui/src/layouts/shared/IntroHero.tsx`)
 * no longer needs a shim — it measures its own container width with a
 * `ResizeObserver` and switches to the mobile sheet composition on its own, so
 * the phone frame (390px) already gets the real mobile layout here.
 *
 * These rules remain for the parts still driven by Tailwind `sm:` utilities:
 * the pages / thank-you screen padding, and the L6 "Steps" stacked column.
 * Apply by wrapping the rendered content in an element with the
 * `mobile-preview` class.
 */
export const MOBILE_CANVAS_CSS = `
  /* Stack any remaining horizontal two-chunk layouts vertically */
  .mobile-preview .sm\\:flex-row { flex-direction: column !important; }

  /* Keep hidden-on-mobile decoration hidden */
  .mobile-preview .sm\\:flex   { display: none !important; }
  .mobile-preview .sm\\:block  { display: none !important; }
  .mobile-preview .sm\\:inline { display: none !important; }

  /* Pages / thank-you screen: compact padding instead of the sm: values,
     which would be enormous at a 1280px browser viewport */
  .mobile-preview .sm\\:px-8  { padding-left: 0.75rem !important; padding-right: 0.75rem !important; }
  .mobile-preview .sm\\:py-6  { padding-top: 0.5rem !important;  padding-bottom: 0.5rem !important; }
  .mobile-preview .sm\\:py-8  { padding-top: 0.75rem !important; padding-bottom: 0.75rem !important; }
  .mobile-preview .sm\\:py-12 { padding-top: 1rem !important;    padding-bottom: 1rem !important; }
  .mobile-preview .sm\\:p-6   { padding: 0.875rem !important; }
  .mobile-preview .sm\\:p-8   { padding: 1rem !important; }
  .mobile-preview .sm\\:p-10  { padding: 1.25rem !important; }

  /* L6 "Steps" stacked column */
  .mobile-preview .sm\\:h-56  { height: 11rem !important; }
  .mobile-preview .sm\\:gap-6 { gap: 1rem !important; }

  /* Legacy proportional hero padding (older layout code paths) */
  .mobile-preview .sm\\:px-\\[10\\%\\] { padding-left:  1rem !important; padding-right:  1rem !important; }
  .mobile-preview .sm\\:py-\\[5\\%\\]  { padding-top:   1rem !important; padding-bottom: 1rem !important; }
`;
