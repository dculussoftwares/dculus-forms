import {
  FormSchema,
  serializeFormSchema,
  deserializeFormSchema,
} from '@dculus/types';
import { randomUUID } from 'crypto';
import { Prisma } from '#prisma-client';
import { slugify } from '@dculus/utils';
import { formTemplateRepository } from '../repositories/index.js';
import { logger } from '../lib/logger.js';
import { copyFileForTemplate, templateAssetPrefix } from './fileUploadService.js';
import { constructCdnUrl } from '../utils/cdn.js';
import { authConfig, s3Config } from '../lib/env.js';
import { OG_DESIGN_VERSION } from './og/designs.js';
import {
  sanitizeImageCredit,
  sanitizeStringList,
  sanitizeTags,
  sanitizeTemplateContent,
  type TemplateContent,
  type TemplateImageCredit,
} from './templateContent.js';

export interface FormTemplate {
  id: string;
  name: string;
  description?: string;
  category?: string;
  formSchema: FormSchema;
  isActive: boolean;
  slug?: string;
  isPublic: boolean;
  seoDescription?: string;
  thumbnailKey?: string;
  thumbnailAlt?: string;
  seoTitle?: string;
  keywords: string[];
  tags: string[];
  content?: TemplateContent;
  imageCredit?: TemplateImageCredit;
  featured: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

/** Public-gallery fields shared by create/update. */
export interface TemplatePublishingInput {
  slug?: string | null;
  isPublic?: boolean;
  seoDescription?: string | null;
  thumbnailKey?: string | null;
  thumbnailAlt?: string | null;
  seoTitle?: string | null;
  keywords?: string[] | null;
  tags?: string[] | null;
  content?: unknown;
  imageCredit?: unknown;
  featured?: boolean;
  sortOrder?: number;
}

export interface CreateTemplateInput extends TemplatePublishingInput {
  name: string;
  description?: string;
  category?: string;
  formSchema: FormSchema;
}

export interface UpdateTemplateInput extends TemplatePublishingInput {
  name?: string;
  description?: string;
  category?: string;
  formSchema?: FormSchema;
  isActive?: boolean;
}

/** Thrown for bad publishing input (bad/duplicate slug, public without slug). */
export class TemplateValidationError extends Error {}

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_SLUG_LENGTH = 80;

/** Normalise a slug ("Employee Onboarding" → "employee-onboarding"); null clears it. */
export const normalizeTemplateSlug = (raw: string | null | undefined): string | null => {
  if (raw === null || raw === undefined) return null;
  const slug = slugify(raw).slice(0, MAX_SLUG_LENGTH).replace(/-+$/, '');
  if (!slug) return null;
  if (!SLUG_PATTERN.test(slug)) {
    throw new TemplateValidationError(`Invalid template slug "${raw}"`);
  }
  return slug;
};

const blankToNull = (value: string | null | undefined): string | null | undefined =>
  value === undefined ? undefined : value?.trim() ? value.trim() : null;

const toTemplate = (template: any): FormTemplate => ({
  ...template,
  description: template.description || undefined,
  category: template.category || undefined,
  slug: template.slug || undefined,
  isPublic: Boolean(template.isPublic),
  seoDescription: template.seoDescription || undefined,
  thumbnailKey: template.thumbnailKey || undefined,
  thumbnailAlt: template.thumbnailAlt || undefined,
  seoTitle: template.seoTitle || undefined,
  keywords: template.keywords ?? [],
  tags: template.tags ?? [],
  content: sanitizeTemplateContent(template.content) ?? undefined,
  imageCredit: sanitizeImageCredit(template.imageCredit) ?? undefined,
  featured: Boolean(template.featured),
  sortOrder: template.sortOrder ?? 0,
  formSchema: deserializeFormSchema(template.formSchema),
});

/**
 * Make sure a template's background image/video live in the template's own
 * folder. A key pointing anywhere else (e.g. the source form's background) is
 * copied in; if the copy fails the background is dropped rather than left
 * pointing at a file the template does not own.
 */
export const adoptTemplateAssets = async (
  schema: FormSchema,
  templateId: string
): Promise<FormSchema> => {
  const layout: any = schema.layout;
  if (!layout) return schema;

  const prefix = templateAssetPrefix(templateId);
  const nextLayout = { ...layout };

  for (const keyName of ['backgroundImageKey', 'backgroundVideoKey'] as const) {
    const key: string | undefined = layout[keyName];
    if (!key || !key.trim() || key.startsWith(prefix)) continue;
    try {
      nextLayout[keyName] = (await copyFileForTemplate(key, templateId)).key;
    } catch (error) {
      logger.error(`Could not copy ${keyName} into template ${templateId}; dropping it`, error);
      nextLayout[keyName] = '';
    }
  }

  return { ...schema, layout: nextLayout };
};

const publishingData = (input: TemplatePublishingInput) => {
  const data: Record<string, unknown> = {};
  if (input.slug !== undefined) data.slug = normalizeTemplateSlug(input.slug);
  if (input.isPublic !== undefined) data.isPublic = input.isPublic;
  if (input.seoDescription !== undefined) data.seoDescription = blankToNull(input.seoDescription);
  if (input.thumbnailKey !== undefined) data.thumbnailKey = blankToNull(input.thumbnailKey);
  if (input.thumbnailAlt !== undefined) data.thumbnailAlt = blankToNull(input.thumbnailAlt);
  if (input.seoTitle !== undefined) data.seoTitle = blankToNull(input.seoTitle);
  if (input.keywords !== undefined) data.keywords = sanitizeStringList(input.keywords);
  if (input.tags !== undefined) data.tags = sanitizeTags(input.tags);
  // Prisma needs DbNull (not JS null) to clear a Json column; an empty object
  // never reaches here because the sanitisers return null for "nothing usable".
  if (input.content !== undefined) data.content = sanitizeTemplateContent(input.content) ?? Prisma.DbNull;
  if (input.imageCredit !== undefined) data.imageCredit = sanitizeImageCredit(input.imageCredit) ?? Prisma.DbNull;
  if (input.featured !== undefined) data.featured = Boolean(input.featured);
  if (input.sortOrder !== undefined) data.sortOrder = Math.trunc(Number(input.sortOrder) || 0);
  return data;
};

const isUniqueSlugViolation = (error: unknown): boolean => {
  const e = error as { code?: string; meta?: { target?: unknown } };
  return e?.code === 'P2002' && JSON.stringify(e.meta?.target ?? '').includes('slug');
};

/**
 * Strip soft-deleted fields from a form schema before saving to template
 */
const stripDeletedFields = (schema: FormSchema): FormSchema => ({
  ...schema,
  pages: schema.pages.map((page) => ({
    ...page,
    fields: page.fields.filter((f) => !f.deleted),
  })),
});

/**
 * Get all active templates, optionally filtered by category
 */
export const getAllTemplates = async (
  category?: string
): Promise<FormTemplate[]> => {
  const templates = await formTemplateRepository.listActive(category);

  return templates.map(toTemplate);
};

/**
 * Get template by ID
 */
export const getTemplateById = async (id: string): Promise<FormTemplate | null> => {
  try {
    const template = await formTemplateRepository.fetchById(id);

    if (!template) return null;

    return toTemplate(template);
  } catch (error) {
    logger.error('Error fetching template by ID:', error);
    return null;
  }
};

/**
 * Create a new form template
 */
export const createTemplate = async (templateData: CreateTemplateInput): Promise<FormTemplate> => {
  const id = randomUUID();
  const publishing = publishingData(templateData);
  if (publishing.isPublic && !publishing.slug) {
    throw new TemplateValidationError('A public template needs a slug');
  }

  const formSchema = await adoptTemplateAssets(stripDeletedFields(templateData.formSchema), id);

  try {
    const newTemplate = await formTemplateRepository.createTemplate({
      id,
      name: templateData.name,
      description: templateData.description,
      category: templateData.category,
      formSchema: serializeFormSchema(formSchema) as any,
      isActive: true,
      ...publishing,
    });
    return toTemplate(newTemplate);
  } catch (error) {
    if (isUniqueSlugViolation(error)) {
      throw new TemplateValidationError(`The slug "${publishing.slug}" is already used by another template`);
    }
    throw error;
  }
};

/**
 * Update an existing template
 */
export const updateTemplate = async (
  id: string,
  templateData: UpdateTemplateInput
): Promise<FormTemplate | null> => {
  const updateData: any = {};

  if (templateData.name) updateData.name = templateData.name;
  if (templateData.description !== undefined) updateData.description = templateData.description;
  if (templateData.category !== undefined) updateData.category = templateData.category;
  if (templateData.formSchema) {
    const schema = await adoptTemplateAssets(stripDeletedFields(templateData.formSchema), id);
    updateData.formSchema = serializeFormSchema(schema);
  }
  if (templateData.isActive !== undefined) updateData.isActive = templateData.isActive;
  Object.assign(updateData, publishingData(templateData));

  if (updateData.isPublic === true || updateData.slug === null) {
    const current = await formTemplateRepository.fetchById(id);
    const slug = updateData.slug !== undefined ? updateData.slug : current?.slug;
    const isPublic = updateData.isPublic ?? current?.isPublic;
    if (isPublic && !slug) {
      throw new TemplateValidationError('A public template needs a slug');
    }
  }

  try {
    const updatedTemplate = await formTemplateRepository.updateTemplate(id, updateData);
    return toTemplate(updatedTemplate);
  } catch (error) {
    if (isUniqueSlugViolation(error)) {
      throw new TemplateValidationError(`The slug "${updateData.slug}" is already used by another template`);
    }
    logger.error('Error updating template:', error);
    return null;
  }
};

/**
 * Delete a template (soft delete by setting isActive to false)
 */
export const deleteTemplate = async (id: string): Promise<boolean> => {
  try {
    await formTemplateRepository.softDeleteTemplate(id);
    return true;
  } catch (error) {
    logger.error('Error deleting template:', error);
    return false;
  }
};

/**
 * Hard delete a template
 */
export const hardDeleteTemplate = async (id: string): Promise<boolean> => {
  try {
    await formTemplateRepository.hardDeleteTemplate(id);
    return true;
  } catch (error) {
    logger.error('Error hard deleting template:', error);
    return false;
  }
};

/**
 * Get templates by category
 */
export const getTemplatesByCategory = async (): Promise<Record<string, FormTemplate[]>> => {
  const templates = await getAllTemplates();
  
  const templatesByCategory: Record<string, FormTemplate[]> = {};
  
  templates.forEach((template) => {
    const category = template.category || 'Uncategorized';
    if (!templatesByCategory[category]) {
      templatesByCategory[category] = [];
    }
    templatesByCategory[category].push(template);
  });

  return templatesByCategory;
};

/**
 * Get template categories
 */
export const getTemplateCategories = async (): Promise<string[]> => {
  const templates = await formTemplateRepository.listCategories();

  const categories = templates
    .map((t: {category: string | null}) => t.category)
    .filter((category): category is string => Boolean(category));

  // Remove duplicates using Set and sort
  return Array.from(new Set(categories)).sort();
};

// ---------------------------------------------------------------------------
// Public gallery (dculus.com/forms/templates) — no auth, safe fields only.
// ---------------------------------------------------------------------------

export interface PublicTemplate {
  id: string;
  slug: string;
  name: string;
  description?: string;
  seoDescription?: string;
  seoTitle?: string;
  category?: string;
  formSchema: FormSchema;
  /** Gallery card image: the uploaded thumbnail, else the generated card. */
  thumbnailUrl: string;
  thumbnailAlt?: string;
  /** 1200×630 share image (always generated). */
  ogImageUrl: string;
  keywords: string[];
  tags: string[];
  content?: TemplateContent;
  imageCredit?: TemplateImageCredit;
  featured: boolean;
  sortOrder: number;
  updatedAt: Date;
}

export interface PublicTemplateCatalog {
  /** Base URL of the public CDN; the form renderer resolves background keys against it. */
  cdnEndpoint: string;
  templates: PublicTemplate[];
}

const apiBaseUrl = (): string => authConfig.baseUrl.replace(/\/+$/, '');

/** Version suffix so CDNs and social crawlers refetch after an edit. */
const imageVersion = (updatedAt: Date | string): string =>
  `${OG_DESIGN_VERSION}.${new Date(updatedAt).getTime().toString(36)}`;

/** Generated images, served by routes/og.ts. */
export const templateOgImageUrl = (slug: string, updatedAt: Date | string): string =>
  `${apiBaseUrl()}/og/templates/${encodeURIComponent(slug)}.png?v=${imageVersion(updatedAt)}`;

export const templateCardImageUrl = (slug: string, updatedAt: Date | string): string =>
  `${apiBaseUrl()}/og/templates/${encodeURIComponent(slug)}/card.png?v=${imageVersion(updatedAt)}`;

const toPublicTemplate = (template: any): PublicTemplate => {
  const schema: any = deserializeFormSchema(template.formSchema);
  // Quiz templates carry their quiz policy in formSchema.settings — that is
  // product config, not something the public page needs to expose.
  const formSchema = { ...schema };
  delete formSchema.settings;
  return {
    id: template.id,
    slug: template.slug,
    name: template.name,
    description: template.description || undefined,
    seoDescription: template.seoDescription || undefined,
    seoTitle: template.seoTitle || undefined,
    category: template.category || undefined,
    formSchema: formSchema as FormSchema,
    thumbnailUrl:
      constructCdnUrl(template.thumbnailKey) || templateCardImageUrl(template.slug, template.updatedAt),
    thumbnailAlt: template.thumbnailAlt || undefined,
    ogImageUrl: templateOgImageUrl(template.slug, template.updatedAt),
    keywords: template.keywords ?? [],
    tags: template.tags ?? [],
    content: sanitizeTemplateContent(template.content) ?? undefined,
    imageCredit: sanitizeImageCredit(template.imageCredit) ?? undefined,
    featured: Boolean(template.featured),
    sortOrder: template.sortOrder ?? 0,
    updatedAt: template.updatedAt,
  };
};

export const getPublicTemplateCatalog = async (): Promise<PublicTemplateCatalog> => {
  const templates = await formTemplateRepository.listPublic();
  return {
    cdnEndpoint: s3Config.publicCdnUrl.replace(/\/+$/, ''),
    templates: templates.map(toPublicTemplate),
  };
};

export const getPublicTemplateBySlug = async (slug: string): Promise<PublicTemplate | null> => {
  const template = await formTemplateRepository.fetchPublicBySlug(slug);
  return template ? toPublicTemplate(template) : null;
};

// ---------------------------------------------------------------------------
// Save an existing form as a template (system admins, from the builder).
// ---------------------------------------------------------------------------

export interface CreateTemplateFromFormInput extends TemplatePublishingInput {
  name: string;
  description?: string;
  category?: string;
}

/**
 * Build a template from a form's live schema. Quiz settings ride along in
 * formSchema.settings (the same carrier createForm reads back when a form is
 * made from a quiz template).
 */
export const buildTemplateSchemaFromForm = (
  liveSchema: FormSchema,
  formSettings: any
): FormSchema => {
  const schema: any = JSON.parse(JSON.stringify(liveSchema));
  delete schema.settings;
  if (formSettings?.quiz?.enabled) {
    schema.settings = { quiz: formSettings.quiz };
  }
  return schema as FormSchema;
};
