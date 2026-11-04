/**
 * The three generated images, as satori element trees (pure — rendering lives in
 * ogImageService.ts):
 *
 * - templateCard  1200×800  gallery thumbnail; mirrors the template's layout (L1–L9)
 * - templateShare 1200×630  og:image for dculus.com/forms/templates/<slug>
 * - formShare     1200×630  og:image for a published form's /f/<shortUrl> link
 *
 * Colours are the product palette (CTA = --primary, hsl(290 11% 22%)).
 */
import { mixWithWhite } from '@dculus/utils';
import { box, img, text, truncate, type OgChild, type OgNode } from './element.js';
import type { MockField, SchemaSummary } from './describe.js';

/**
 * Bump whenever a drawing changes. It is part of every image URL (?v=…), so a new
 * design reaches browsers, Cloudflare and the landing build instead of hiding behind
 * year-long immutable caches.
 */
export const OG_DESIGN_VERSION = 2;

export const CARD_SIZE = { width: 1200, height: 800 } as const;
export const SHARE_SIZE = { width: 1200, height: 630 } as const;

const C = {
  ink: '#3c323e',
  text: '#4c414e',
  muted: '#655d67',
  light: '#a09aa2',
  faint: '#f7f7f8',
  line: 'rgba(81,76,84,0.18)',
  white: '#ffffff',
  green: '#177767',
  greenBg: 'rgba(23,119,103,0.12)',
};

const FONT = 'Inter, "Noto Sans Tamil"';

// ---------------------------------------------------------------------------
// Form mock: the fields drawn inside every composition
// ---------------------------------------------------------------------------

interface MockOptions {
  /** Scale factor for all sizes; 1 = gallery-card size. */
  s?: number;
  underline?: boolean;
  dark?: boolean;
}

const fieldHeight = (f: MockField, s: number): number => {
  const label = 40 * s;
  switch (f.kind) {
    case 'long':
      return label + 104 * s;
    case 'choice':
    case 'multi':
      return label + Math.min(3, Math.max(1, f.options.length)) * 44 * s;
    default:
      return label + 62 * s;
  }
};

const chevron = (s: number, color: string): OgNode =>
  box({
    width: 14 * s,
    height: 14 * s,
    borderRight: `${3 * s}px solid ${color}`,
    borderBottom: `${3 * s}px solid ${color}`,
    transform: 'rotate(45deg)',
    marginTop: -6 * s,
  });

const inputBox = (f: MockField, o: Required<MockOptions>): OgNode => {
  const { s, underline, dark } = o;
  const border = dark ? 'rgba(255,255,255,0.22)' : C.line;
  const height = (f.kind === 'long' ? 96 : 54) * s;
  const base = {
    height,
    width: '100%',
    alignItems: f.kind === 'long' ? 'flex-start' : 'center',
    justifyContent: 'space-between',
    padding: `0 ${18 * s}px`,
    backgroundColor: underline ? 'transparent' : dark ? 'rgba(255,255,255,0.06)' : C.white,
    ...(underline
      ? { borderBottom: `${3 * s}px solid ${border}` }
      : { border: `${2 * s}px solid ${border}`, borderRadius: 12 * s }),
  };
  if (f.kind === 'select') return box(base, box({}), chevron(s, dark ? C.light : C.muted));
  if (f.kind === 'file') {
    return box(
      { ...base, justifyContent: 'center', backgroundColor: dark ? 'rgba(255,255,255,0.06)' : C.faint },
      text('+ Upload file', { fontSize: 22 * s, fontWeight: 600, color: dark ? C.light : C.muted })
    );
  }
  if (f.kind === 'date') {
    return box(
      base,
      box({}),
      box({
        width: 26 * s,
        height: 24 * s,
        border: `${3 * s}px solid ${C.light}`,
        borderTop: `${8 * s}px solid ${C.light}`,
        borderRadius: 4 * s,
      })
    );
  }
  return box(base);
};

const optionRows = (f: MockField, o: Required<MockOptions>): OgNode => {
  const { s, dark } = o;
  const opts = (f.options.length ? f.options : ['Option']).slice(0, 3);
  return box(
    { flexDirection: 'column', gap: 12 * s },
    ...opts.map((opt) =>
      box(
        { alignItems: 'center', gap: 14 * s, height: 32 * s },
        box({
          width: 26 * s,
          height: 26 * s,
          borderRadius: f.kind === 'choice' ? 13 * s : 6 * s,
          border: `${3 * s}px solid ${dark ? C.light : 'rgba(81,76,84,0.35)'}`,
          backgroundColor: dark ? 'transparent' : C.white,
        }),
        text(truncate(opt, 26), { fontSize: 24 * s, color: dark ? '#e8e4e9' : C.text })
      )
    )
  );
};

const mockField = (f: MockField, o: Required<MockOptions>): OgNode =>
  box(
    { flexDirection: 'column', gap: 10 * o.s, flex: 1, minWidth: 0 },
    box(
      { gap: 4 * o.s },
      text(truncate(f.label, 34), { fontSize: 24 * o.s, fontWeight: 600, color: o.dark ? '#f1eef2' : C.text }),
      f.required ? text('*', { fontSize: 24 * o.s, fontWeight: 700, color: '#c2410c' }) : null
    ),
    f.kind === 'choice' || f.kind === 'multi' ? optionRows(f, o) : inputBox(f, o)
  );

/** Fields that fit in `budget` px, with grid siblings grouped into rows. */
const fieldRows = (fields: MockField[], budget: number, o: Required<MockOptions>): OgNode[] => {
  const rows: MockField[][] = [];
  for (const f of fields) {
    const last = rows[rows.length - 1];
    if (f.gridId && last && last[0].gridId === f.gridId && last.length < 2) last.push(f);
    else rows.push([f]);
  }
  const out: OgNode[] = [];
  let used = 0;
  for (const row of rows) {
    const h = Math.max(...row.map((f) => fieldHeight(f, o.s))) + 18 * o.s;
    if (used + h > budget && out.length > 0) break;
    used += h;
    out.push(box({ gap: 20 * o.s, width: '100%' }, ...row.map((f) => mockField(f, o))));
  }
  return out;
};

const cta = (label: string, s: number, light = false): OgNode =>
  box(
    {
      alignSelf: 'flex-start',
      padding: `${16 * s}px ${30 * s}px`,
      borderRadius: 12 * s,
      backgroundColor: light ? C.white : C.ink,
    },
    text(truncate(label, 22), { fontSize: 24 * s, fontWeight: 700, color: light ? C.ink : C.white })
  );

interface PanelInput {
  summary: SchemaSummary;
  title: string;
  /** Vertical space for fields, in px. */
  budget: number;
  s?: number;
  align?: 'left' | 'center';
  underline?: boolean;
  dark?: boolean;
  showIntro?: boolean;
  /** L9 has no intro screen, so its card starts straight at the questions. */
  showTitle?: boolean;
  /** Override the button (L9 shows the form's own Submit, not the intro CTA). */
  ctaLabel?: string;
}

const formPanel = (p: PanelInput): OgNode => {
  const s = p.s ?? 1;
  const o: Required<MockOptions> = { s, underline: Boolean(p.underline), dark: Boolean(p.dark) };
  const center = p.align === 'center';
  return box(
    { flexDirection: 'column', gap: 22 * s, width: '100%', alignItems: center ? 'center' : 'flex-start' },
    p.showTitle === false
      ? null
      : text(truncate(p.title, 44), {
      fontSize: 46 * s,
      fontWeight: 800,
      color: p.dark ? C.white : C.ink,
      letterSpacing: -1,
      lineHeight: 1.1,
      textAlign: center ? 'center' : 'left',
    }),
    p.showIntro && p.summary.intro
      ? text(truncate(p.summary.intro, 90), {
          fontSize: 24 * s,
          color: p.dark ? '#d9d3da' : C.muted,
          lineHeight: 1.4,
          textAlign: center ? 'center' : 'left',
        })
      : null,
    box(
      { flexDirection: 'column', gap: 18 * s, width: '100%', marginTop: 6 * s },
      ...fieldRows(p.summary.fields, p.budget, o)
    ),
    cta(p.ctaLabel ?? p.summary.ctaLabel ?? 'Submit', s)
  );
};

// ---------------------------------------------------------------------------
// Photo + surfaces
// ---------------------------------------------------------------------------

const photo = (src: string | undefined, style: Record<string, string | number>, tint?: string): OgNode =>
  src
    ? img(src, { width: '100%', height: '100%', objectPosition: 'center 35%', ...style })
    : box({
        width: '100%',
        height: '100%',
        backgroundImage: `linear-gradient(135deg, ${tint ?? '#7c6f7e'} 0%, ${C.ink} 100%)`,
        ...style,
      });

/**
 * Background "wash" used by L7 / L9 — the same rule as the product
 * (packages/ui/src/layouts/shared/surface.tsx): the photo's dominant colour mixed
 * with white when one was sampled, otherwise the photo under a white veil.
 */
const wash = (src: string | undefined, tint: string | undefined): OgNode =>
  tint
    ? box({ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: mixWithWhite(tint, 0.6) })
    : box(
    { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' },
    photo(src, {}, tint),
    box({ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(247,247,248,0.82)' })
  );

const card = (style: Record<string, string | number>, ...children: OgChild[]): OgNode =>
  box(
    {
      flexDirection: 'column',
      backgroundColor: C.white,
      borderRadius: 24,
      boxShadow: '0 24px 60px rgba(30,20,32,0.22)',
      ...style,
    },
    ...children
  );

// ---------------------------------------------------------------------------
// Gallery card (1200×800), one composition per layout
// ---------------------------------------------------------------------------

export interface CardInput {
  summary: SchemaSummary;
  title: string;
  /** data: URI of the background photo (already resized). */
  photo?: string;
}

export const templateCard = ({ summary, title, photo: src }: CardInput): OgNode => {
  const { width, height } = CARD_SIZE;
  const root = (bg: string, ...children: OgChild[]) =>
    box({ width, height, position: 'relative', backgroundColor: bg, fontFamily: FONT, overflow: 'hidden' }, ...children);
  const tint = summary.tint;

  switch (summary.layoutCode) {
    case 'L2': // photo right 55%, flat content panel left
      return root(
        C.white,
        box({ width: 560, height, padding: '64px 56px', alignItems: 'center' }, formPanel({ summary, title, budget: 430 })),
        box({ width: 640, height }, photo(src, {}, tint))
      );
    case 'L3': // full-bleed photo, centred card
      return root(
        C.ink,
        box({ position: 'absolute', top: 0, left: 0, width, height }, photo(src, {}, tint)),
        box(
          { position: 'absolute', top: 0, left: 0, width, height, alignItems: 'center', justifyContent: 'center' },
          card({ width: 600, padding: '48px 52px' }, formPanel({ summary, title, budget: 380, align: 'left' }))
        )
      );
    case 'L4': // narrow photo rail, airy centred column, underlined inputs
      return root(
        C.white,
        box({ width: 340, height }, photo(src, {}, tint)),
        box(
          { width: 860, height, padding: '70px 150px', alignItems: 'center' },
          formPanel({ summary, title, budget: 420, align: 'center', underline: true })
        )
      );
    case 'L5': // literal 50/50: content left on grey, photo right
      return root(
        C.faint,
        box({ width: 600, height, padding: '64px 60px', alignItems: 'center' }, formPanel({ summary, title, budget: 430 })),
        box({ width: 600, height, borderLeft: '4px solid rgba(0,0,0,0.08)' }, photo(src, {}, tint))
      );
    case 'L6': // wide banner, headline and fields stacked below
      return root(
        C.white,
        box(
          { flexDirection: 'column', width, height },
          box({ width, height: 250 }, photo(src, { objectPosition: 'center 25%' }, tint)),
          box({ width, padding: '44px 180px 0' }, formPanel({ summary, title, budget: 360 }))
        )
      );
    case 'L7': // no image column; one centred panel over a soft wash
      return root(
        C.faint,
        wash(src, tint),
        box(
          { position: 'absolute', top: 0, left: 0, width, height, alignItems: 'center', justifyContent: 'center' },
          card(
            { width: 820, padding: '56px 80px', alignItems: 'center' },
            formPanel({ summary, title, budget: 360, align: 'center', showIntro: true })
          )
        )
      );
    case 'L8': // hero: full-bleed photo, headline + CTA over a bottom scrim
      return root(
        C.ink,
        box({ position: 'absolute', top: 0, left: 0, width, height }, photo(src, {}, tint)),
        box(
          {
            position: 'absolute',
            left: 0,
            bottom: 0,
            width,
            height: 520,
            flexDirection: 'column',
            justifyContent: 'flex-end',
            gap: 26,
            padding: '0 72px 72px',
            backgroundImage: 'linear-gradient(to top, rgba(0,0,0,0.85), rgba(0,0,0,0.5) 55%, rgba(0,0,0,0))',
          },
          text(truncate(summary.headline ?? title, 48), {
            fontSize: 72,
            fontWeight: 800,
            color: C.white,
            letterSpacing: -2,
            lineHeight: 1.05,
          }),
          summary.intro
            ? text(truncate(summary.intro, 110), { fontSize: 30, color: 'rgba(255,255,255,0.86)', lineHeight: 1.35 })
            : null,
          cta(summary.ctaLabel ?? 'Continue', 1.15, true)
        )
      );
    case 'L9': // no intro: the form card straight over a wash
      return root(
        C.faint,
        wash(src, tint),
        box(
          { position: 'absolute', top: 0, left: 0, width, height, alignItems: 'center', justifyContent: 'center' },
          card({ width: 760, padding: '52px 64px' }, formPanel({ summary, title, budget: 520, showTitle: false, ctaLabel: 'Submit' }))
        )
      );
    case 'L1':
    default: // classic: photo left 46%, content card overlapping it
      return root(
        C.faint,
        box({ width: 560, height }, photo(src, {}, tint)),
        box(
          { position: 'absolute', top: 56, bottom: 56, left: 470, right: 56, alignItems: 'center' },
          card({ width: '100%', height: '100%', padding: '52px 56px', justifyContent: 'center' }, formPanel({ summary, title, budget: 400 }))
        )
      );
  }
};

// ---------------------------------------------------------------------------
// Share images (1200×630)
// ---------------------------------------------------------------------------

const brand = (light: boolean): OgNode =>
  box(
    { alignItems: 'center', gap: 16 },
    box(
      {
        width: 52,
        height: 52,
        borderRadius: 14,
        backgroundColor: light ? C.white : C.ink,
        alignItems: 'center',
        justifyContent: 'center',
      },
      text('D', { fontSize: 30, fontWeight: 800, color: light ? C.ink : C.white })
    ),
    text('Dculus Forms', { fontSize: 28, fontWeight: 700, color: light ? C.white : C.ink })
  );

const pill = (label: string, light: boolean): OgNode =>
  box(
    {
      alignSelf: 'flex-start',
      padding: '8px 18px',
      borderRadius: 999,
      backgroundColor: light ? 'rgba(255,255,255,0.16)' : C.greenBg,
    },
    text(truncate(label, 32), { fontSize: 22, fontWeight: 700, color: light ? C.white : C.green })
  );

const facts = (summary: SchemaSummary): string =>
  [
    `${summary.questionCount} ${summary.questionCount === 1 ? 'question' : 'questions'}`,
    `${summary.minutes} min`,
    summary.pageCount > 1 ? `${summary.pageCount} pages` : null,
  ]
    .filter(Boolean)
    .join(' · ');

/** Title lines sized so long names still fit in three lines. */
const titleStyle = (value: string, light: boolean) => ({
  fontSize: value.length > 44 ? 54 : value.length > 26 ? 62 : 72,
  fontWeight: 800,
  color: light ? C.white : C.ink,
  letterSpacing: -2,
  lineHeight: 1.06,
});

export interface TemplateShareInput extends CardInput {
  heading: string;
  category?: string;
}

export const templateShare = ({ summary, heading, category, photo: src, title }: TemplateShareInput): OgNode => {
  const { width, height } = SHARE_SIZE;
  const headingText = truncate(heading, 70);
  return box(
    { width, height, backgroundColor: C.faint, fontFamily: FONT, position: 'relative', overflow: 'hidden' },
    box(
      { flexDirection: 'column', width: 680, height, padding: '64px 0 56px 72px', justifyContent: 'space-between' },
      brand(false),
      box(
        { flexDirection: 'column', gap: 22 },
        category ? pill(category, false) : null,
        text(headingText, titleStyle(headingText, false)),
        text(`Free · ${facts(summary)}`, { fontSize: 27, fontWeight: 500, color: C.muted })
      ),
      text('dculus.com/forms/templates', { fontSize: 22, fontWeight: 600, color: C.light })
    ),
    box(
      { position: 'absolute', top: 48, right: 48, width: 420, height: 534, borderRadius: 28, overflow: 'hidden' },
      photo(src, {}, summary.tint)
    ),
    box(
      { position: 'absolute', top: 120, right: 210, width: 380 },
      card({ width: 380, padding: '30px 32px' }, formPanel({ summary, title, budget: 250, s: 0.7 }))
    )
  );
};

export interface FormShareInput {
  summary: SchemaSummary;
  title: string;
  description?: string;
  photo?: string;
}

export const formShare = ({ summary, title, description, photo: src }: FormShareInput): OgNode => {
  const { width, height } = SHARE_SIZE;
  const headingText = truncate(title, 80);
  const sub = description ?? summary.intro;
  return box(
    { width, height, position: 'relative', backgroundColor: C.ink, fontFamily: FONT, overflow: 'hidden' },
    box({ position: 'absolute', top: 0, left: 0, width, height }, photo(src, {}, summary.tint)),
    box({
      position: 'absolute',
      top: 0,
      left: 0,
      width,
      height,
      backgroundImage: 'linear-gradient(90deg, rgba(24,18,26,0.92) 0%, rgba(24,18,26,0.78) 48%, rgba(24,18,26,0.25) 100%)',
    }),
    box(
      {
        position: 'absolute',
        top: 0,
        left: 0,
        width: summary.fields.length ? 700 : 1000,
        height,
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '60px 0 56px 72px',
      },
      pill('Form', true),
      box(
        { flexDirection: 'column', gap: 22 },
        text(headingText, titleStyle(headingText, true)),
        sub ? text(truncate(sub, 130), { fontSize: 28, color: 'rgba(255,255,255,0.82)', lineHeight: 1.35 }) : null,
        summary.questionCount > 0
          ? text(facts(summary), { fontSize: 24, fontWeight: 600, color: 'rgba(255,255,255,0.7)' })
          : null
      ),
      box(
        { alignItems: 'center', gap: 12 },
        text('Made with', { fontSize: 22, color: 'rgba(255,255,255,0.65)' }),
        text('Dculus Forms', { fontSize: 22, fontWeight: 700, color: C.white })
      )
    ),
    summary.fields.length
      ? box(
          { position: 'absolute', top: 92, right: 64, width: 350 },
          card({ width: 350, padding: '28px 30px' }, formPanel({ summary, title: summary.headline ?? title, budget: 270, s: 0.66 }))
        )
      : null
  );
};
