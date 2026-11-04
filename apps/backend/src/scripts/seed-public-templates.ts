/**
 * Publishes the public templates in seed-data/public-templates/*.json to the database
 * this checkout points at (run it once per environment with that environment's env), so
 * dculus.com/forms/templates can sync them. The JSON is seed data only: it is not
 * compiled into the app or shipped in the image.
 *
 *   pnpm db:seed-public-templates                     # dry run: validate + show the plan
 *   pnpm db:seed-public-templates --confirm           # write (create or update by slug)
 *   pnpm db:seed-public-templates --confirm --only=contact-form,wedding-rsvp-form
 *   pnpm db:seed-public-templates --confirm --draft   # write but leave them unlisted
 *
 * Idempotent: templates are matched by slug (never duplicated); page/field ids come from the JSON;
 * the photo is stored once at files/form-template/<templateId>/<source>-<id>.jpg and
 * only downloaded again when the pinned photo changes. Needs PEXELS_API_KEY /
 * PIXABAY_API_KEY plus the usual DATABASE_URL and public R2 bucket settings.
 */
import './load-env.js';
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';
import { loadCatalog } from '../publicTemplates/loadCatalog.js';
import { buildTemplateSchema, validateCatalog } from '../publicTemplates/validate.js';
import { photoFileName, resolvePhoto } from '../publicTemplates/photos.js';
import type { PublicTemplateDefinition } from '../publicTemplates/types.js';
import { createTemplate, updateTemplate } from '../services/templateService.js';
import { publicObjectExists, putPublicObject, templateAssetPrefix } from '../services/fileUploadService.js';
import {
  sanitizeImageCredit,
  sanitizeStringList,
  sanitizeTags,
  sanitizeTemplateContent,
} from '../services/templateContent.js';
import { serializeFormSchema } from '@dculus/types';
import { changedFields } from '../publicTemplates/diff.js';
import { constructCdnUrl } from '../utils/cdn.js';
import { authConfig } from '../lib/env.js';

const args = process.argv.slice(2);
const confirm = args.includes('--confirm');
const draft = args.includes('--draft');
const dir = args.find((a) => a.startsWith('--dir='))?.slice('--dir='.length);
const only = args
  .find((a) => a.startsWith('--only='))
  ?.slice('--only='.length)
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const databaseHost = (): string => {
  try {
    return new URL(process.env.DATABASE_URL ?? '').host || 'unknown';
  } catch {
    return 'unknown';
  }
};

interface ExistingPhoto {
  key: string;
  dominantColor?: string;
  credit: ReturnType<typeof sanitizeImageCredit>;
}

/** Reuse the stored photo when the template already has the pinned file in its folder. */
const existingPhoto = (row: any, def: PublicTemplateDefinition): ExistingPhoto | null => {
  const key: string | undefined = row?.formSchema?.layout?.backgroundImageKey;
  if (!key || !row?.id) return null;
  const wanted = new Set(def.photo.map((ref) => `${templateAssetPrefix(row.id)}${photoFileName(ref)}`));
  if (!wanted.has(key)) return null;
  return { key, dominantColor: row.formSchema.layout.backgroundDominantColor, credit: sanitizeImageCredit(row.imageCredit) };
};

const seedOne = async (def: PublicTemplateDefinition) => {
  if (!confirm) {
    // Only columns every schema version has, so a dry run works before the migration.
    const existing = await prisma.formTemplate.findFirst({ where: { slug: def.slug }, select: { id: true } });
    const action = existing ? 'update' : 'create';
    logger.info(
      `  • ${action.padEnd(6)} ${def.slug} — "${def.name}" (${def.category}, ${def.formSchema.layout.code}, ${def.formSchema.pages.length} page(s))`
    );
    return;
  }

  const row = await prisma.formTemplate.findFirst({ where: { slug: def.slug } });
  const action = row ? 'update' : 'create';

  // 1. Make sure the row exists so the photo can live in its folder.
  const schema: any = buildTemplateSchema(def);
  const id =
    row?.id ??
    (
      await createTemplate({
        name: def.name,
        description: def.description,
        category: def.category,
        formSchema: schema,
        slug: def.slug,
        isPublic: false,
      })
    ).id;

  // 2. Photo: reuse, or download + upload once.
  let photo = existingPhoto(row, def);
  if (!photo) {
    const resolved = await resolvePhoto(def.photo);
    const key = `${templateAssetPrefix(id)}${resolved.fileName}`;
    if (!(await publicObjectExists(key))) await putPublicObject(key, resolved.jpeg, 'image/jpeg');
    photo = { key, dominantColor: resolved.dominantColor, credit: resolved.credit };
    logger.info(`    photo ${resolved.ref.source} ${resolved.ref.id} by ${resolved.credit.photographer}`);
  }
  schema.layout.backgroundImageKey = photo.key;
  if (photo.dominantColor) schema.layout.backgroundDominantColor = photo.dominantColor;

  // 3. Everything else — skipped when nothing changed, so updatedAt (and with it every
  //    generated image URL) only moves when the template really did.
  const desired = {
    name: def.name,
    description: def.description,
    category: def.category,
    formSchema: serializeFormSchema(schema),
    isActive: true,
    slug: def.slug,
    isPublic: !draft,
    seoTitle: def.seoTitle ?? null,
    seoDescription: def.seoDescription,
    keywords: sanitizeStringList(def.keywords),
    tags: sanitizeTags(def.tags),
    content: sanitizeTemplateContent(def.content),
    imageCredit: photo.credit,
    featured: Boolean(def.featured),
    sortOrder: def.sortOrder ?? 0,
    thumbnailAlt: def.thumbnailAlt,
  };
  const changes = row ? changedFields(row as any, desired) : Object.keys(desired);
  if (changes.length === 0) {
    logger.info(`  = unchanged ${def.slug}`);
    return;
  }
  // updateTemplate returns null (after logging) on any non-validation failure.
  const saved = await updateTemplate(id, { ...desired, formSchema: schema });
  if (!saved) throw new Error(`Could not save ${def.slug} — see the error above`);
  logger.info(`  ✔ ${action}d ${def.slug}${row ? ` (${changes.join(', ')})` : ''} → ${constructCdnUrl(photo.key)}`);
};

async function main() {
  const loaded = loadCatalog(dir);
  const catalog = loaded.map((l) => l.def);
  const selected = only ? catalog.filter((d) => only.includes(d.slug)) : catalog;
  if (only && selected.length !== only.length) {
    const missing = only.filter((slug) => !catalog.some((d) => d.slug === slug));
    throw new Error(`Unknown slug(s): ${missing.join(', ')}`);
  }

  const problems = validateCatalog(loaded);
  if (problems.length) throw new Error(`Template catalog is invalid:\n- ${problems.join('\n- ')}`);

  logger.info(
    `${confirm ? '🌱 Seeding' : '🔎 Dry run —'} ${selected.length} public template(s) into ${databaseHost()}${draft ? ' as drafts' : ''}`
  );
  const failed: string[] = [];
  for (const def of selected) {
    try {
      await seedOne(def);
    } catch (error) {
      failed.push(def.slug);
      logger.error(`  ✖ ${def.slug}: ${error instanceof Error ? error.message : error}`);
    }
  }
  if (failed.length) throw new Error(`${failed.length} template(s) failed: ${failed.join(', ')}`);

  if (!confirm) {
    logger.info('Nothing written. Re-run with --confirm to apply.');
  } else {
    const base = authConfig.baseUrl.replace(/\/+$/, '');
    logger.info(`Done. Preview images: ${base}/og/templates/<slug>.png and ${base}/og/templates/<slug>/card.png`);
  }
}

main()
  .catch((error) => {
    logger.error(`❌ ${error instanceof Error ? error.message : error}`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
