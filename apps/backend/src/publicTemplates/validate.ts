/**
 * Checks a template definition against the authoring rules in
 * docs/templates/TEMPLATE_AUTHORING.md and builds the stored schema. Pure.
 */
import { deserializeFormSchema, serializeFormSchema, type FormSchema } from '@dculus/types';
import { slugify } from '@dculus/utils';
import type { PublicTemplateDefinition } from './types.js';
import type { LoadedDefinition } from './loadCatalog.js';

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const LAYOUTS = new Set(['L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'L7', 'L8', 'L9']);
/** Mirrors the landing site's sync: these paths under /forms/templates/ are not template pages. */
const RESERVED = new Set(['og', 'category', 'index', 'page', 'search']);
const FILLABLE = new Set([
  'text_input_field',
  'text_area_field',
  'email_field',
  'number_field',
  'phone_number_field',
  'date_field',
  'select_field',
  'radio_field',
  'checkbox_field',
  'file_upload_field',
]);

/**
 * The stored schema for a definition: the file's formSchema normalised through the
 * @dculus/types field classes (unknown keys dropped, defaults applied). Ids are kept as
 * written, so seeding the same file twice produces the same schema.
 */
export const buildTemplateSchema = (def: PublicTemplateDefinition): FormSchema =>
  serializeFormSchema(deserializeFormSchema(JSON.parse(JSON.stringify(def.formSchema)))) as FormSchema;

/** Problems for one definition ([] = valid). */
export const validateDefinition = (def: PublicTemplateDefinition): string[] => {
  const p: string[] = [];
  const at = (msg: string) => p.push(`${def.slug || def.name}: ${msg}`);

  if (!SLUG.test(def.slug)) at('slug must be lowercase-hyphenated');
  if (RESERVED.has(def.slug)) at(`slug "${def.slug}" is reserved`);
  if (!def.name.trim()) at('name is required');
  if (def.seoTitle && def.seoTitle.length > 65) at(`seoTitle is ${def.seoTitle.length} chars (max 65)`);
  if (def.seoDescription.length < 110 || def.seoDescription.length > 165) {
    at(`seoDescription is ${def.seoDescription.length} chars (aim for 140–160)`);
  }
  if (def.keywords.length < 3 || def.keywords.length > 8) at('keywords: list 3–8 search phrases');
  if (def.tags.length < 1 || def.tags.length > 4) at('tags: list 1–4 short labels');
  if (!def.photo?.length) at('photo: pin at least one stock photo');
  if (!def.thumbnailAlt?.trim()) at('thumbnailAlt is required');
  const layout: any = def.formSchema?.layout;
  const pages: any[] = Array.isArray(def.formSchema?.pages) ? def.formSchema.pages : [];
  if (!layout) {
    at('formSchema.layout is missing');
  } else {
    if (!LAYOUTS.has(layout.code)) at(`unknown layout ${layout.code}`);
    if (!/<h1[\s>]/i.test(layout.content ?? '')) at('layout intro should start with an <h1> headline');
  }
  if (!def.content?.intro) at('content.intro is required');
  if ((def.content?.faq?.length ?? 0) < 2) at('content.faq: add at least two template-specific questions');
  if (!pages.length) at('needs at least one page');

  const ids = new Set<string>();
  let fillable = 0;
  for (const page of pages) {
    if (!page.id || ids.has(page.id)) at(`page "${page.title}" needs a unique id`);
    ids.add(page.id);
    page.fields = Array.isArray(page.fields) ? page.fields : [];
    const gridIds = new Set(page.fields.filter((f: any) => f.type === 'grid_field').map((f: any) => f.id));
    for (const f of page.fields as any[]) {
      if (!f.id) at(`a field on "${page.title}" has no id`);
      if (ids.has(f.id)) at(`duplicate field id ${f.id}`);
      ids.add(f.id);
      if (f.gridId && !gridIds.has(f.gridId)) at(`"${f.label}" points at a grid on another page`);
      if (!FILLABLE.has(f.type)) continue;
      fillable++;
      if (!f.label?.trim()) at(`a ${f.type} on "${page.title}" has no label`);
      if ((f.type === 'radio_field' || f.type === 'select_field' || f.type === 'checkbox_field') && !f.options?.length) {
        at(`"${f.label}" has no options`);
      }
    }
  }
  if (fillable === 0) at('has no questions');
  if (fillable > 40) at(`has ${fillable} questions — split it or trim it`);
  return p;
};

/** Validate the whole catalog (as loaded from files), including cross-template rules. */
export const validateCatalog = (loaded: LoadedDefinition[]): string[] => {
  const defs = loaded.map((l) => l.def);
  const problems = defs.flatMap(validateDefinition);
  for (const { file, def } of loaded) {
    if (file !== `${def.slug}.json`) problems.push(`${file}: file name must be "${def.slug}.json"`);
  }
  // Field ids must be unique across templates too, so copies never collide.
  const owner = new Map<string, string>();
  for (const def of defs) {
    for (const page of def.formSchema?.pages ?? []) {
      for (const f of (page.fields ?? []) as any[]) {
        const prev = owner.get(f.id);
        if (prev && prev !== def.slug) problems.push(`field id ${f.id} is used by both ${prev} and ${def.slug}`);
        owner.set(f.id, def.slug);
      }
    }
  }
  const slugs = new Map<string, number>();
  defs.forEach((d) => slugs.set(d.slug, (slugs.get(d.slug) ?? 0) + 1));
  for (const [slug, n] of slugs) if (n > 1) problems.push(`slug "${slug}" is used ${n} times`);
  const categories = new Set(defs.map((d) => slugify(d.category)));
  for (const c of categories) {
    if (slugs.has(c)) problems.push(`category slug "${c}" clashes with a template slug`);
    if (RESERVED.has(c)) problems.push(`category slug "${c}" is reserved`);
  }
  return problems;
};
