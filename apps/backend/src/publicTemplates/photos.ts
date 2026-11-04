/**
 * Resolve a pinned Pexels/Pixabay photo to a web-ready JPEG plus its attribution.
 * Both licences allow free commercial use without attribution; we credit the
 * photographer on the template page anyway (and Pexels asks for it).
 */
import sharp from 'sharp';
import type { TemplateImageCredit } from '../services/templateContent.js';
import type { PhotoRef } from './types.js';

const TIMEOUT_MS = 20_000;
/** Backgrounds are shown full-bleed on desktop; 2000px wide keeps them sharp without bloat. */
const TARGET_WIDTH = 2000;

export interface ResolvedPhoto {
  ref: PhotoRef;
  jpeg: Buffer;
  /** #rrggbb used for the layout's outer wash and the generated images' fallback tint. */
  dominantColor: string;
  credit: TemplateImageCredit;
  /** Stable file name, e.g. "pexels-7709148.jpg". */
  fileName: string;
}

const hex = (r: number, g: number, b: number) =>
  `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;

const download = async (url: string): Promise<Buffer> => {
  const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) throw new Error(`download HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
};

const toJpeg = async (input: Buffer) => {
  const image = sharp(input).rotate().resize({ width: TARGET_WIDTH, withoutEnlargement: true });
  const jpeg = await image.clone().jpeg({ quality: 80, mozjpeg: true }).toBuffer();
  const { dominant } = await sharp(jpeg).stats();
  return { jpeg, dominantColor: hex(dominant.r, dominant.g, dominant.b) };
};

const fromPexels = async (id: number): Promise<Omit<ResolvedPhoto, 'ref' | 'fileName'>> => {
  const key = process.env.PEXELS_API_KEY;
  if (!key) throw new Error('PEXELS_API_KEY is not set');
  const res = await fetch(`https://api.pexels.com/v1/photos/${id}`, {
    headers: { Authorization: key },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`Pexels API HTTP ${res.status}`);
  const p: any = await res.json();
  // `original` accepts imgix-style resize params; ask for roughly the size we keep.
  const { jpeg, dominantColor } = await toJpeg(await download(`${p.src.original}?auto=compress&cs=tinysrgb&w=${TARGET_WIDTH}`));
  return {
    jpeg,
    dominantColor,
    credit: {
      source: 'pexels',
      photographer: p.photographer,
      photographerUrl: p.photographer_url,
      sourceUrl: p.url,
    },
  };
};

const fromPixabay = async (id: number): Promise<Omit<ResolvedPhoto, 'ref' | 'fileName'>> => {
  const key = process.env.PIXABAY_API_KEY;
  if (!key) throw new Error('PIXABAY_API_KEY is not set');
  const res = await fetch(`https://pixabay.com/api/?${new URLSearchParams({ key, id: String(id) })}`, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`Pixabay API HTTP ${res.status}`);
  const hit = ((await res.json()) as any).hits?.[0];
  if (!hit) throw new Error(`Pixabay photo ${id} not found`);
  const { jpeg, dominantColor } = await toJpeg(await download(hit.largeImageURL));
  return {
    jpeg,
    dominantColor,
    credit: {
      source: 'pixabay',
      photographer: hit.user,
      photographerUrl: `https://pixabay.com/users/${hit.user}-${hit.user_id}/`,
      sourceUrl: hit.pageURL,
    },
  };
};

/** First photo in the list that resolves; throws with every failure if none does. */
export const resolvePhoto = async (refs: PhotoRef[]): Promise<ResolvedPhoto> => {
  const errors: string[] = [];
  for (const ref of refs) {
    try {
      const photo = ref.source === 'pexels' ? await fromPexels(ref.id) : await fromPixabay(ref.id);
      return { ...photo, ref, fileName: `${ref.source}-${ref.id}.jpg` };
    } catch (error) {
      errors.push(`${ref.source} ${ref.id}: ${(error as Error).message}`);
    }
  }
  throw new Error(`No photo could be loaded (${errors.join('; ')})`);
};

export const photoFileName = (ref: PhotoRef): string => `${ref.source}-${ref.id}.jpg`;
