import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  normalizeTemplateSlug,
  adoptTemplateAssets,
  createTemplate,
  updateTemplate,
  getPublicTemplateCatalog,
  getPublicTemplateBySlug,
  buildTemplateSchemaFromForm,
  TemplateValidationError,
} from '../templateService.js';
import { formTemplateRepository } from '../../repositories/index.js';
import { copyFileForTemplate } from '../fileUploadService.js';

vi.mock('../../repositories/index.js');
vi.mock('../fileUploadService.js', () => ({
  copyFileForTemplate: vi.fn(),
  templateAssetPrefix: (id: string) => `files/form-template/${id}/`,
}));
vi.mock('../../utils/cdn.js', () => ({
  constructCdnUrl: (key: string | null) => (key ? `https://cdn.example.com/${key}` : null),
}));
vi.mock('../../lib/env.js', async () => {
  const actual = await vi.importActual<typeof import('../../lib/env.js')>('../../lib/env.js');
  return { ...actual, s3Config: { ...actual.s3Config, publicCdnUrl: 'https://cdn.example.com/' } };
});
vi.mock('../../lib/logger.js', () => ({ logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() } }));

const schema = (layout: Record<string, unknown> = {}): any => ({
  pages: [{ id: 'p1', title: 'Page', order: 0, fields: [] }],
  layout: { code: 'L1', backgroundImageKey: '', ...layout },
  isShuffleEnabled: false,
});

const row = (overrides: Record<string, unknown> = {}) => ({
  id: 'tpl-1',
  name: 'Employee Onboarding',
  description: 'Collect new-hire details',
  category: 'HR',
  formSchema: schema(),
  isActive: true,
  slug: 'employee-onboarding',
  isPublic: true,
  seoDescription: null,
  thumbnailKey: 'files/form-template/tpl-1/thumb.webp',
  thumbnailAlt: null,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-02-01'),
  ...overrides,
});

describe('template publishing', () => {
  beforeEach(() => vi.clearAllMocks());

  describe('normalizeTemplateSlug', () => {
    it('turns a title into a kebab-case slug', () => {
      expect(normalizeTemplateSlug('Employee Onboarding Form')).toBe('employee-onboarding-form');
    });
    it('returns null for empty or missing input', () => {
      expect(normalizeTemplateSlug(null)).toBeNull();
      expect(normalizeTemplateSlug(undefined)).toBeNull();
      expect(normalizeTemplateSlug('   ')).toBeNull();
    });
    it('caps the length without leaving a trailing hyphen', () => {
      const slug = normalizeTemplateSlug(`${'a'.repeat(79)} b`)!;
      expect(slug.length).toBeLessThanOrEqual(80);
      expect(slug.endsWith('-')).toBe(false);
    });
  });

  describe('adoptTemplateAssets', () => {
    it('copies a background owned by another form into the template folder', async () => {
      vi.mocked(copyFileForTemplate).mockResolvedValue({ key: 'files/form-template/tpl-1/bg.jpg' } as any);
      const result: any = await adoptTemplateAssets(
        schema({ backgroundImageKey: 'files/form-background/form-9/bg.jpg' }),
        'tpl-1'
      );
      expect(copyFileForTemplate).toHaveBeenCalledWith('files/form-background/form-9/bg.jpg', 'tpl-1');
      expect(result.layout.backgroundImageKey).toBe('files/form-template/tpl-1/bg.jpg');
    });

    it('leaves files already in the template folder alone', async () => {
      const result: any = await adoptTemplateAssets(
        schema({ backgroundImageKey: 'files/form-template/tpl-1/bg.jpg', backgroundVideoKey: '' }),
        'tpl-1'
      );
      expect(copyFileForTemplate).not.toHaveBeenCalled();
      expect(result.layout.backgroundImageKey).toBe('files/form-template/tpl-1/bg.jpg');
    });

    it('drops a background it cannot copy instead of keeping a borrowed key', async () => {
      vi.mocked(copyFileForTemplate).mockRejectedValue(new Error('missing'));
      const result: any = await adoptTemplateAssets(
        schema({ backgroundVideoKey: 'files/form-background/form-9/bg.mp4' }),
        'tpl-1'
      );
      expect(result.layout.backgroundVideoKey).toBe('');
    });

    it('handles a schema without a layout', async () => {
      const bare: any = { pages: [] };
      expect(await adoptTemplateAssets(bare, 'tpl-1')).toBe(bare);
    });
  });

  describe('createTemplate with publishing fields', () => {
    it('stores a normalised slug and the public flag', async () => {
      vi.mocked(formTemplateRepository.createTemplate).mockResolvedValue(row() as any);
      await createTemplate({
        name: 'Employee Onboarding',
        formSchema: schema(),
        slug: 'Employee Onboarding',
        isPublic: true,
        seoDescription: '  ',
      });
      expect(formTemplateRepository.createTemplate).toHaveBeenCalledWith(
        expect.objectContaining({ slug: 'employee-onboarding', isPublic: true, seoDescription: null })
      );
    });

    it('rejects a public template without a slug', async () => {
      await expect(
        createTemplate({ name: 'X', formSchema: schema(), isPublic: true })
      ).rejects.toBeInstanceOf(TemplateValidationError);
    });

    it('reports a duplicate slug clearly', async () => {
      vi.mocked(formTemplateRepository.createTemplate).mockRejectedValue({
        code: 'P2002',
        meta: { target: ['slug'] },
      });
      await expect(
        createTemplate({ name: 'X', formSchema: schema(), slug: 'contact' })
      ).rejects.toThrow('already used');
    });

    it('rethrows unrelated database errors', async () => {
      vi.mocked(formTemplateRepository.createTemplate).mockRejectedValue(new Error('db down'));
      await expect(createTemplate({ name: 'X', formSchema: schema() })).rejects.toThrow('db down');
    });
  });

  describe('updateTemplate with publishing fields', () => {
    it('refuses to make a slug-less template public', async () => {
      vi.mocked(formTemplateRepository.fetchById).mockResolvedValue(row({ slug: null, isPublic: false }) as any);
      await expect(updateTemplate('tpl-1', { isPublic: true })).rejects.toBeInstanceOf(TemplateValidationError);
    });

    it('refuses to clear the slug of a public template', async () => {
      vi.mocked(formTemplateRepository.fetchById).mockResolvedValue(row() as any);
      await expect(updateTemplate('tpl-1', { slug: '' })).rejects.toBeInstanceOf(TemplateValidationError);
    });

    it('publishes a template that already has a slug', async () => {
      vi.mocked(formTemplateRepository.fetchById).mockResolvedValue(row({ isPublic: false }) as any);
      vi.mocked(formTemplateRepository.updateTemplate).mockResolvedValue(row() as any);
      const result = await updateTemplate('tpl-1', { isPublic: true, thumbnailAlt: 'Preview' });
      expect(formTemplateRepository.updateTemplate).toHaveBeenCalledWith('tpl-1', {
        isPublic: true,
        thumbnailAlt: 'Preview',
      });
      expect(result?.isPublic).toBe(true);
    });

    it('copies a borrowed background when the schema changes', async () => {
      vi.mocked(copyFileForTemplate).mockResolvedValue({ key: 'files/form-template/tpl-1/bg.jpg' } as any);
      vi.mocked(formTemplateRepository.updateTemplate).mockResolvedValue(row() as any);
      await updateTemplate('tpl-1', { formSchema: schema({ backgroundImageKey: 'files/form-background/f/bg.jpg' }) });
      expect(copyFileForTemplate).toHaveBeenCalledWith('files/form-background/f/bg.jpg', 'tpl-1');
    });

    it('reports a duplicate slug clearly', async () => {
      vi.mocked(formTemplateRepository.updateTemplate).mockRejectedValue({ code: 'P2002', meta: { target: 'slug' } });
      await expect(updateTemplate('tpl-1', { slug: 'contact' })).rejects.toThrow('already used');
    });
  });

  describe('public catalog', () => {
    it('returns safe fields, CDN URLs and no quiz settings', async () => {
      vi.mocked(formTemplateRepository.listPublic).mockResolvedValue([
        row({ formSchema: { ...schema(), settings: { quiz: { enabled: true } } } }),
      ] as any);

      const catalog = await getPublicTemplateCatalog();

      expect(catalog.cdnEndpoint).toBe('https://cdn.example.com');
      expect(catalog.templates).toHaveLength(1);
      const [t] = catalog.templates as any[];
      expect(t.slug).toBe('employee-onboarding');
      expect(t.thumbnailUrl).toBe('https://cdn.example.com/files/form-template/tpl-1/thumb.webp');
      expect(t.formSchema.settings).toBeUndefined();
      expect(t).not.toHaveProperty('isActive');
    });

    it('finds one public template by slug', async () => {
      vi.mocked(formTemplateRepository.fetchPublicBySlug).mockResolvedValue(row({ thumbnailKey: null }) as any);
      const t = await getPublicTemplateBySlug('employee-onboarding');
      expect(t?.name).toBe('Employee Onboarding');
      expect(t?.thumbnailUrl).toBeUndefined();
    });

    it('returns null for an unknown slug', async () => {
      vi.mocked(formTemplateRepository.fetchPublicBySlug).mockResolvedValue(null);
      expect(await getPublicTemplateBySlug('nope')).toBeNull();
    });
  });

  describe('buildTemplateSchemaFromForm', () => {
    it('carries an enabled quiz policy in formSchema.settings', () => {
      const result: any = buildTemplateSchemaFromForm(schema(), { quiz: { enabled: true, passThreshold: 60 } });
      expect(result.settings).toEqual({ quiz: { enabled: true, passThreshold: 60 } });
    });

    it('drops stray settings for a non-quiz form', () => {
      const result: any = buildTemplateSchemaFromForm({ ...schema(), settings: { x: 1 } }, null);
      expect(result.settings).toBeUndefined();
    });
  });
});
