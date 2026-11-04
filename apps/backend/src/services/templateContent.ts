/**
 * Shapes of the long-form public-page fields on FormTemplate (content, imageCredit,
 * keywords, tags). They are stored as JSON / text[] and written by admins and the
 * public-template seed, so everything is normalised here before it is saved or
 * served — unknown keys are dropped and lengths are capped.
 */

export interface TemplateFaqItem {
  question: string;
  answer: string;
}

export interface TemplateContent {
  /** One or two sentences under the page heading. */
  intro?: string;
  /** Who the template is for, one sentence. */
  audience?: string;
  /** Concrete situations the template fits. */
  useCases: string[];
  /** Advice for getting better responses. */
  tips: string[];
  faq: TemplateFaqItem[];
}

export type ImageCreditSource = 'pexels' | 'pixabay' | 'other';

export interface TemplateImageCredit {
  source: ImageCreditSource;
  photographer: string;
  photographerUrl?: string;
  sourceUrl?: string;
}

const MAX_TEXT = 600;
const MAX_ITEM = 240;
const MAX_LIST = 12;
const MAX_TAG = 40;

const text = (value: unknown, limit = MAX_TEXT): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.replace(/\s+/g, ' ').trim();
  return trimmed ? trimmed.slice(0, limit) : undefined;
};

const textList = (value: unknown, itemLimit = MAX_ITEM, listLimit = MAX_LIST): string[] => {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of value) {
    const t = text(item, itemLimit);
    if (!t || seen.has(t.toLowerCase())) continue;
    seen.add(t.toLowerCase());
    out.push(t);
    if (out.length >= listLimit) break;
  }
  return out;
};

const httpsUrl = (value: unknown): string | undefined => {
  const t = text(value, 500);
  if (!t) return undefined;
  try {
    return new URL(t).protocol === 'https:' ? t : undefined;
  } catch {
    return undefined;
  }
};

/** Keywords and tags: trimmed, de-duplicated (case-insensitive), capped. */
export const sanitizeStringList = (value: unknown): string[] => textList(value, MAX_TAG * 2, MAX_LIST);

/** Tags are short labels ("Lead capture"); keep them tight. */
export const sanitizeTags = (value: unknown): string[] => textList(value, MAX_TAG, 8);

/** Returns null when nothing usable is left, so the column stays empty. */
export const sanitizeTemplateContent = (value: unknown): TemplateContent | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  const faq: TemplateFaqItem[] = Array.isArray(raw.faq)
    ? raw.faq
        .map((item) => {
          const q = text((item as TemplateFaqItem)?.question, MAX_ITEM);
          const a = text((item as TemplateFaqItem)?.answer, MAX_TEXT);
          return q && a ? { question: q, answer: a } : null;
        })
        .filter((item): item is TemplateFaqItem => item !== null)
        .slice(0, 8)
    : [];

  const content: TemplateContent = {
    intro: text(raw.intro),
    audience: text(raw.audience, MAX_ITEM),
    useCases: textList(raw.useCases),
    tips: textList(raw.tips),
    faq,
  };
  const empty =
    !content.intro && !content.audience && !content.useCases.length && !content.tips.length && !faq.length;
  return empty ? null : content;
};

const SOURCES: ImageCreditSource[] = ['pexels', 'pixabay', 'other'];

export const sanitizeImageCredit = (value: unknown): TemplateImageCredit | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  const photographer = text(raw.photographer, 120);
  if (!photographer) return null;
  const source = SOURCES.includes(raw.source as ImageCreditSource) ? (raw.source as ImageCreditSource) : 'other';
  return {
    source,
    photographer,
    photographerUrl: httpsUrl(raw.photographerUrl),
    sourceUrl: httpsUrl(raw.sourceUrl),
  };
};
