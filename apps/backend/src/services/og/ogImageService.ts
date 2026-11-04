/**
 * Dynamic share images and gallery thumbnails, rendered with @vercel/og (satori + resvg).
 *
 *   /og/templates/<slug>.png        1200×630  template share image
 *   /og/templates/<slug>/card.png   1200×800  template gallery thumbnail
 *   /og/forms/<shortUrl>.png        1200×630  published-form share image
 *   /og/forms/<shortUrl>.json       title/description/image for the viewer's link-preview tags
 *
 * Rendering is ~50–150 ms; results are cached in memory and the routes send long
 * Cache-Control so Cloudflare serves repeats. Every URL we hand out carries ?v=<updatedAt>,
 * so an edit produces a new URL instead of waiting for caches to expire.
 */
import sharp from 'sharp';
import { describeSchema, type SchemaSummary } from './describe.js';
import { CARD_SIZE, OG_DESIGN_VERSION, SHARE_SIZE, formShare, templateCard, templateShare } from './designs.js';
import { renderPng } from './render.js';
import { templateHeading } from './heading.js';
import { getPublicTemplateBySlug } from '../templateService.js';
import { getFormByShortUrl } from '../formService.js';
import { getFormSchemaFromHocuspocus } from '../hocuspocus.js';
import { constructCdnUrl } from '../../utils/cdn.js';
import { authConfig } from '../../lib/env.js';
import { logger } from '../../lib/logger.js';

const PHOTO_TIMEOUT_MS = 6_000;
const MAX_CACHE = 300;

/** Insertion-ordered Map as a tiny LRU. */
class Lru<V> {
  private map = new Map<string, V>();
  constructor(private max: number) {}
  get(key: string): V | undefined {
    const v = this.map.get(key);
    if (v !== undefined) {
      this.map.delete(key);
      this.map.set(key, v);
    }
    return v;
  }
  set(key: string, value: V): void {
    this.map.delete(key);
    this.map.set(key, value);
    if (this.map.size > this.max) this.map.delete(this.map.keys().next().value as string);
  }
}

const images = new Lru<Buffer>(MAX_CACHE);
const photos = new Lru<Promise<string | undefined>>(100);

/**
 * Fetch a public-bucket image and shrink it to a JPEG data URI. Satori embeds
 * images inline, so a 4000px original would make every render slow.
 */
const loadPhoto = (key: string | undefined, width: number): Promise<string | undefined> => {
  if (!key) return Promise.resolve(undefined);
  const cacheKey = `${key}@${width}`;
  const hit = photos.get(cacheKey);
  if (hit) return hit;
  const pending = (async () => {
    const url = constructCdnUrl(key);
    if (!url) return undefined;
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(PHOTO_TIMEOUT_MS) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const jpeg = await sharp(Buffer.from(await res.arrayBuffer()))
        .rotate()
        .resize({ width, withoutEnlargement: true })
        .jpeg({ quality: 78, mozjpeg: true })
        .toBuffer();
      return `data:image/jpeg;base64,${jpeg.toString('base64')}`;
    } catch (error) {
      logger.warn(`OG: could not load background ${key}: ${(error as Error).message}`);
      return undefined;
    }
  })();
  photos.set(cacheKey, pending);
  // Don't pin failures: let the next request try again.
  pending.then((v) => v === undefined && photos.set(cacheKey, Promise.resolve(undefined)));
  return pending;
};

const cached = async (key: string, make: () => Promise<Buffer>): Promise<Buffer> => {
  const hit = images.get(key);
  if (hit) return hit;
  const png = await make();
  images.set(key, png);
  return png;
};

export { templateHeading };

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

export type TemplateImageKind = 'share' | 'card';

export const renderTemplateImage = async (slug: string, kind: TemplateImageKind): Promise<Buffer | null> => {
  const template = await getPublicTemplateBySlug(slug);
  if (!template) return null;
  const summary = describeSchema(template.formSchema);
  const version = new Date(template.updatedAt).getTime();
  return cached(`t${OG_DESIGN_VERSION}:${kind}:${slug}:${version}`, async () => {
    if (kind === 'card') {
      const src = await loadPhoto(summary.backgroundImageKey, 1200);
      return renderPng(templateCard({ summary, title: summary.headline ?? template.name, photo: src }), CARD_SIZE);
    }
    const src = await loadPhoto(summary.backgroundImageKey, 640);
    return renderPng(
      templateShare({
        summary,
        title: summary.headline ?? template.name,
        heading: templateHeading(template.name),
        category: template.category,
        photo: src,
      }),
      SHARE_SIZE
    );
  });
};

// ---------------------------------------------------------------------------
// Published forms
// ---------------------------------------------------------------------------

export interface FormShareMeta {
  title: string;
  description: string;
  imageUrl: string;
  imageAlt: string;
  /** Unix seconds; part of imageUrl, exposed for cache keys. */
  version: string;
}

interface LoadedForm {
  title: string;
  description?: string;
  summary: SchemaSummary;
  updatedAt: Date;
}

const FORM_TTL_MS = 60_000;
const recentForms = new Lru<{ at: number; value: Promise<LoadedForm | null> }>(200);

/**
 * Published, not deleted, with its live (Y.js) schema — what the viewer renders.
 * A link unfurl asks for the meta and then the image within seconds, so the
 * lookup is memoised briefly.
 */
const loadPublishedForm = (shortUrl: string): Promise<LoadedForm | null> => {
  const hit = recentForms.get(shortUrl);
  if (hit && Date.now() - hit.at < FORM_TTL_MS) return hit.value;
  const value = fetchPublishedForm(shortUrl).catch((error) => {
    recentForms.set(shortUrl, { at: 0, value: Promise.resolve(null) });
    throw error;
  });
  recentForms.set(shortUrl, { at: Date.now(), value });
  return value;
};

const fetchPublishedForm = async (shortUrl: string): Promise<LoadedForm | null> => {
  const form: any = await getFormByShortUrl(shortUrl);
  if (!form || !form.isPublished || form.deletedAt) return null;
  const schema = (await getFormSchemaFromHocuspocus(form.id)) ?? form.formSchema;
  return {
    title: String(form.title ?? '').trim() || 'Untitled form',
    description: typeof form.description === 'string' && form.description.trim() ? form.description.trim() : undefined,
    summary: describeSchema(schema),
    updatedAt: new Date(form.updatedAt ?? Date.now()),
  };
};

const formDescription = (f: LoadedForm): string => {
  const base = f.description ?? f.summary.intro;
  if (base) return base.length > 200 ? `${base.slice(0, 197).trimEnd()}…` : base;
  const n = f.summary.questionCount;
  return n > 0
    ? `${n} ${n === 1 ? 'question' : 'questions'} · about ${f.summary.minutes} min. Fill it out online.`
    : 'Fill out this form online.';
};

/**
 * The image version folds in the layout's background so swapping a photo (which
 * may not bump Form.updatedAt — layout lives in Y.js) still changes the URL.
 */
const formVersion = (f: LoadedForm): string => {
  const seed = `${OG_DESIGN_VERSION}|${f.updatedAt.getTime()}|${f.title}|${f.summary.backgroundImageKey ?? ''}|${f.summary.questionCount}`;
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  return (hash >>> 0).toString(36);
};

export const getFormShareMeta = async (shortUrl: string): Promise<FormShareMeta | null> => {
  const form = await loadPublishedForm(shortUrl);
  if (!form) return null;
  const version = formVersion(form);
  return {
    title: form.title,
    description: formDescription(form),
    imageUrl: `${authConfig.baseUrl.replace(/\/+$/, '')}/og/forms/${encodeURIComponent(shortUrl)}.png?v=${version}`,
    imageAlt: `${form.title} — online form`,
    version,
  };
};

export const renderFormShareImage = async (shortUrl: string): Promise<Buffer | null> => {
  const form = await loadPublishedForm(shortUrl);
  if (!form) return null;
  return cached(`f:${shortUrl}:${formVersion(form)}`, async () => {
    const src = await loadPhoto(form.summary.backgroundImageKey, 1200);
    return renderPng(
      formShare({ summary: form.summary, title: form.title, description: form.description, photo: src }),
      SHARE_SIZE
    );
  });
};
