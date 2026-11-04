/**
 * Turns a stored form schema (plain JSON) into the few facts a share image or
 * gallery card shows: the respondent-facing headline, the first questions, counts.
 * Pure — no I/O — so it is unit-tested directly.
 */

export type MockFieldKind = 'text' | 'long' | 'choice' | 'multi' | 'select' | 'file' | 'date' | 'phone';

export interface MockField {
  kind: MockFieldKind;
  label: string;
  options: string[];
  required: boolean;
  /** Fields sharing a gridId render side by side. */
  gridId?: string;
}

export interface SchemaSummary {
  layoutCode: string;
  headline?: string;
  intro?: string;
  ctaLabel?: string;
  fields: MockField[];
  questionCount: number;
  pageCount: number;
  minutes: number;
  backgroundImageKey?: string;
  /** Hex sampled from the background photo, if the builder stored one. */
  tint?: string;
  dark: boolean;
}

const KIND: Record<string, MockFieldKind> = {
  text_input_field: 'text',
  email_field: 'text',
  number_field: 'text',
  text_area_field: 'long',
  radio_field: 'choice',
  checkbox_field: 'multi',
  select_field: 'select',
  file_upload_field: 'file',
  date_field: 'date',
  phone_number_field: 'phone',
};

/** Rough seconds per answer, for "about N min". */
const SECONDS: Record<MockFieldKind, number> = {
  text: 12,
  phone: 12,
  date: 10,
  select: 8,
  choice: 8,
  multi: 12,
  long: 45,
  file: 30,
};

const decode = (s: string): string =>
  s
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'");

const stripTags = (html: string): string => decode(html.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();

/** First heading and first paragraph of the intro rich text. */
export const introFromHtml = (html: unknown): { headline?: string; intro?: string } => {
  if (typeof html !== 'string' || !html.trim()) return {};
  const heading = html.match(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/i);
  const paragraph = html.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
  const headline = heading ? stripTags(heading[1]) : undefined;
  const intro = paragraph ? stripTags(paragraph[1]) : undefined;
  return { headline: headline || undefined, intro: intro || undefined };
};

const HEX = /^#[0-9a-f]{6}$/i;

export const describeSchema = (schema: any): SchemaSummary => {
  const pages: any[] = Array.isArray(schema?.pages) ? schema.pages : [];
  const layout = schema?.layout ?? {};
  const fields: MockField[] = [];
  let seconds = 0;

  for (const page of pages) {
    for (const f of Array.isArray(page?.fields) ? page.fields : []) {
      if (!f || f.deleted) continue;
      const kind = KIND[f.type];
      if (!kind || typeof f.label !== 'string' || !f.label.trim()) continue;
      seconds += SECONDS[kind];
      fields.push({
        kind,
        label: f.label.trim(),
        options: Array.isArray(f.options) ? f.options.filter((o: unknown) => typeof o === 'string' && o.trim()) : [],
        required: Boolean(f.validation?.required),
        gridId: typeof f.gridId === 'string' ? f.gridId : undefined,
      });
    }
  }

  const { headline, intro } = introFromHtml(layout.content);
  const theme = String(layout.theme ?? '').toLowerCase();
  const tint = [layout.backgroundDominantColor, layout.customBackGroundColor].find(
    (c) => typeof c === 'string' && HEX.test(c) && c.toLowerCase() !== '#ffffff'
  );

  return {
    layoutCode: typeof layout.code === 'string' ? layout.code : 'L1',
    headline,
    intro,
    ctaLabel: typeof layout.customCTAButtonName === 'string' ? layout.customCTAButtonName.trim() || undefined : undefined,
    fields,
    questionCount: fields.length,
    pageCount: pages.length,
    minutes: Math.max(1, Math.round(seconds / 60)),
    backgroundImageKey:
      typeof layout.backgroundImageKey === 'string' && layout.backgroundImageKey.trim()
        ? layout.backgroundImageKey.trim()
        : undefined,
    tint,
    dark: theme === 'dark',
  };
};
