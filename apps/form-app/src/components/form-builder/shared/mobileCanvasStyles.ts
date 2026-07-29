/**
 * Scoped CSS overrides that force sm: breakpoint classes to behave as if the
 * viewport is narrow (<640px) inside a phone-frame canvas. Shared by the
 * PreviewTab overlay and the Content canvas's mobile device frame (see
 * CanvasToolbar/PageBuilderTab) so both simulate mobile the same way.
 *
 * Two rules do the heavy lifting for all 9 form layouts:
 *  1. sm:flex-row → column (stacks two-chunk intro splits vertically)
 *  2. sm:flex     → none   (keeps decorative image chunks hidden)
 *
 * Padding overrides prevent the pages-section card from using sm: padding
 * values (which would be enormous at 1280px browser viewport).
 *
 * Apply by wrapping the rendered content in an element with the
 * `mobile-preview` class.
 */
export const MOBILE_CANVAS_CSS = `
  /* Stack horizontal two-chunk layouts vertically */
  .mobile-preview .sm\\:flex-row { flex-direction: column !important; }

  /* Keep hidden-on-mobile elements hidden (hidden sm:flex / hidden sm:block) */
  .mobile-preview .sm\\:flex   { display: none !important; }
  .mobile-preview .sm\\:block  { display: none !important; }
  .mobile-preview .sm\\:inline { display: none !important; }

  /* Pages-section outer wrapper: use compact padding */
  .mobile-preview .sm\\:p-8  { padding: 0.75rem !important; }

  /* L6 wizard intro padding */
  .mobile-preview .sm\\:px-\\[10\\%\\] { padding-left:  1rem !important; padding-right:  1rem !important; }
  .mobile-preview .sm\\:py-\\[5\\%\\]  { padding-top:   1rem !important; padding-bottom: 1rem !important; }

  /* Page-size selector: stay visible in preview context */
  .mobile-preview .sm\\:flex.hidden { display: none !important; }
`;
