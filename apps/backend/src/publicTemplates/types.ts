import type { FormSchema } from '@dculus/types';
import type { TemplateContent } from '../services/templateContent.js';

/**
 * A stock photo, pinned by id so every seed run uses the same image.
 * List several in `photo` to fall back when one source is unavailable
 * (Pixabay's CDN, for example, rejects some server-side downloads).
 */
export type PhotoRef =
  | { source: 'pexels'; id: number }
  | { source: 'pixabay'; id: number };

/**
 * One public template, as stored in apps/backend/seed-data/public-templates/<slug>.json.
 * `pnpm db:seed-public-templates` upserts it by slug into the database DATABASE_URL points
 * at (so every environment is seeded from the same files, without duplicates), uploads its
 * photo and publishes it to dculus.com/forms/templates.
 *
 * Field guide: docs/templates/TEMPLATE_AUTHORING.md
 */
export interface PublicTemplateDefinition {
  /** URL: dculus.com/forms/templates/<slug>. Must equal the file name. */
  slug: string;
  name: string;
  description: string;
  category: string;
  seoTitle?: string;
  seoDescription: string;
  keywords: string[];
  tags: string[];
  content: TemplateContent;
  featured?: boolean;
  sortOrder?: number;
  /** Preferred photo first; the first one that downloads wins. */
  photo: PhotoRef[];
  thumbnailAlt: string;
  /**
   * The form exactly as stored (serialized FormSchema). Field and page ids are part of the
   * file and must stay stable; `layout.backgroundImageKey` is filled in by the seed.
   */
  formSchema: FormSchema;
}
