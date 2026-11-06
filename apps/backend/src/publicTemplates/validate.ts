/**
 * Checks a template definition against the authoring rules in
 * docs/templates/TEMPLATE_AUTHORING.md and builds the stored schema. Pure.
 */
import { deserializeFormSchema, serializeFormSchema, type FormSchema } from '@dculus/types';
import { slugify } from '@dculus/utils';
import type { PublicTemplateDefinition } from './types.js';
import type { LoadedDefinition } from './loadCatalog.js';
import { sanitizeStringList, sanitizeTags, sanitizeTemplateContent } from '../services/templateContent.js';

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
  'rating_field',
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
const str = (v: unknown): string => (typeof v === 'string' ? v : '');

export const validateDefinition = (def: PublicTemplateDefinition): string[] => {
  const p: string[] = [];
  const raw = (def ?? {}) as unknown as Record<string, unknown>;
  const slug = str(raw.slug);
  const at = (msg: string) => p.push(`${slug || str(raw.name) || '(unnamed)'}: ${msg}`);

  // Shapes first: the file is plain JSON, so nothing below may assume a type.
  for (const key of ['slug', 'name', 'description', 'category', 'seoDescription', 'thumbnailAlt'] as const) {
    if (typeof raw[key] !== 'string' || !str(raw[key]).trim()) at(`${key} must be a non-empty string`);
  }
  for (const key of ['keywords', 'tags', 'photo'] as const) {
    if (!Array.isArray(raw[key])) at(`${key} must be a list`);
  }
  if (raw.seoTitle !== undefined && typeof raw.seoTitle !== 'string') at('seoTitle must be a string');

  if (slug && !SLUG.test(slug)) at('slug must be lowercase-hyphenated');
  if (RESERVED.has(slug)) at(`slug "${slug}" is reserved`);
  const seoTitle = str(raw.seoTitle);
  if (seoTitle.length > 65) at(`seoTitle is ${seoTitle.length} chars (max 65)`);
  const seoDescription = str(raw.seoDescription);
  if (seoDescription && (seoDescription.length < 110 || seoDescription.length > 165)) {
    at(`seoDescription is ${seoDescription.length} chars (aim for 140–160)`);
  }
  // Count what the seed will actually store (trimmed, de-duplicated).
  const keywords = sanitizeStringList(raw.keywords);
  const tags = sanitizeTags(raw.tags);
  if (Array.isArray(raw.keywords) && (keywords.length < 3 || keywords.length > 8)) {
    at(`keywords: list 3–8 distinct search phrases (${keywords.length} after removing blanks/duplicates)`);
  }
  if (Array.isArray(raw.tags) && (tags.length < 1 || tags.length > 4)) {
    at(`tags: list 1–4 distinct short labels (${tags.length} after removing blanks/duplicates)`);
  }
  if (Array.isArray(raw.photo) && raw.photo.length === 0) at('photo: pin at least one stock photo');

  const content = sanitizeTemplateContent(raw.content);
  if (!content?.intro) at('content.intro is required');
  if ((content?.faq.length ?? 0) < 2) at('content.faq: add at least two template-specific questions');

  const schema = raw.formSchema as { layout?: any; pages?: unknown } | undefined;
  const layout = schema?.layout;
  if (!layout || typeof layout !== 'object') {
    at('formSchema.layout is missing');
  } else {
    if (!LAYOUTS.has(layout.code)) at(`unknown layout ${layout.code}`);
    if (!/<h1[\s>]/i.test(str(layout.content))) at('layout intro should start with an <h1> headline');
  }
  if (!Array.isArray(schema?.pages)) {
    at('formSchema.pages must be a list');
    return p;
  }
  const pages = schema.pages as any[];
  if (!pages.length) at('needs at least one page');

  const ids = new Set<string>();
  let fillable = 0;
  for (const page of pages) {
    if (!page || typeof page !== 'object') {
      at('every page must be an object');
      continue;
    }
    if (!page.id || ids.has(page.id)) at(`page "${page.title}" needs a unique id`);
    ids.add(page.id);
    // Report, never repair: the seed must store exactly what the file says.
    if (!Array.isArray(page.fields)) {
      at(`page "${page.title}": fields must be a list`);
      continue;
    }
    const gridIds = new Set(page.fields.filter((f: any) => f?.type === 'grid_field').map((f: any) => f.id));
    for (const f of page.fields as any[]) {
      if (!f || typeof f !== 'object') {
        at(`page "${page.title}" has a field that is not an object`);
        continue;
      }
      if (!f.id) at(`a field on "${page.title}" has no id`);
      if (ids.has(f.id)) at(`duplicate field id ${f.id}`);
      ids.add(f.id);
      if (f.gridId && !gridIds.has(f.gridId)) at(`"${f.label}" points at a grid on another page`);
      if (!FILLABLE.has(f.type)) continue;
      fillable++;
      if (!str(f.label).trim()) at(`a ${f.type} on "${page.title}" has no label`);
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
  // Page and field ids must be unique across templates too, so copies never collide.
  const owner = new Map<string, string>();
  const claim = (id: unknown, kind: string, slug: string) => {
    if (typeof id !== 'string' || !id) return;
    const prev = owner.get(id);
    if (prev && prev !== slug) problems.push(`${kind} id ${id} is used by both ${prev} and ${slug}`);
    owner.set(id, slug);
  };
  for (const def of defs) {
    const pages = Array.isArray(def?.formSchema?.pages) ? def.formSchema.pages : [];
    for (const page of pages as any[]) {
      claim(page?.id, 'page', def.slug);
      for (const f of (Array.isArray(page?.fields) ? page.fields : []) as any[]) claim(f?.id, 'field', def.slug);
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
