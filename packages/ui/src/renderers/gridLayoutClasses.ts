/**
 * Responsive grid classes shared by the viewer's GridRenderer and the builder's grid block
 * (docs/grid-layout-strategy.md §9.2), so both stack and un-stack at exactly the same width.
 *
 * Columns sit side by side only once the nearest `@container` ancestor is wide enough; below that
 * they stack. Container queries (not viewport media queries) are what make the builder's phone
 * frame, the preview phone frame and embeds re-flow live when their width changes — no measuring,
 * no state to go stale between a desktop/mobile toggle and a reload.
 *
 * Literal strings so Tailwind's scanner sees every class (interpolated classes are not generated).
 * The side-by-side track sizes come from the `--gc` custom property (see `gridTemplateColumns`).
 */

/** Grid track classes per visible column count; gap-4 also spaces columns once they stack. */
export const GRID_COLUMNS_CLASS_BY_COUNT: Readonly<Record<number, string>> = {
  1: 'grid grid-cols-1',
  2: 'grid grid-cols-1 gap-4 @md:[grid-template-columns:var(--gc)]',
  3: 'grid grid-cols-1 gap-4 @lg:[grid-template-columns:var(--gc)]',
  4: 'grid grid-cols-1 gap-4 @xl:[grid-template-columns:var(--gc)]',
};

/** Shows an element only while the columns sit side by side (e.g. the builder's resize dividers). */
export const GRID_SIDE_BY_SIDE_ONLY_CLASS_BY_COUNT: Readonly<Record<number, string>> = {
  1: 'hidden',
  2: 'hidden @md:flex',
  3: 'hidden @lg:flex',
  4: 'hidden @xl:flex',
};

/** The `--gc` value: one proportional, shrinkable track per column width. */
export const gridTemplateColumns = (widthPercents: readonly number[]): string =>
  widthPercents.map((width) => `minmax(0, ${width}fr)`).join(' ');
