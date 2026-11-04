/**
 * Minimal element builder for @vercel/og (satori). Satori takes React-element-shaped
 * objects, so the backend can describe images without React or JSX.
 *
 * Satori rules worth remembering:
 * - every element with more than one child needs `display: 'flex'` (h() sets it);
 * - only a subset of CSS works (flexbox, borders, radius, gradients, opacity, shadows);
 * - text is not measured for you — truncate long strings before rendering.
 */
export type OgStyle = Record<string, string | number>;
export type OgChild = OgNode | string | null | undefined | false;

export interface OgNode {
  type: string;
  props: {
    style?: OgStyle;
    children?: OgChild | OgChild[];
    [key: string]: unknown;
  };
}

const clean = (children: OgChild[]): (OgNode | string)[] =>
  children.filter((c): c is OgNode | string => c !== null && c !== undefined && c !== false && c !== '');

/** A flex box. Pass `display: 'none'`-free styles; layout defaults to a column. */
export const box = (style: OgStyle, ...children: OgChild[]): OgNode => ({
  type: 'div',
  props: { style: { display: 'flex', ...style }, children: clean(children) },
});

/** A single run of text. */
export const text = (value: string, style: OgStyle = {}): OgNode => ({
  type: 'div',
  props: { style: { display: 'flex', ...style }, children: value },
});

export const img = (src: string, style: OgStyle): OgNode => ({
  type: 'img',
  props: { src, style: { objectFit: 'cover', ...style } },
});

/** Cut to `max` characters on a word boundary, with an ellipsis. */
export const truncate = (value: string, max: number): string => {
  const t = value.replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  const space = cut.lastIndexOf(' ');
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[,;:.\s-]+$/, '')}…`;
};
