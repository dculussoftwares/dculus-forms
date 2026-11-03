import { describe, it, expect, vi, beforeEach } from 'vitest';
import { templatesResolvers } from '../templates.js';
import * as templateService from '../../../services/templateService.js';
import * as formService from '../../../services/formService.js';
import { getFormSchemaFromHocuspocus } from '../../../services/hocuspocus.js';

vi.mock('../../../services/templateService.js', async () => {
  const actual = await vi.importActual<typeof import('../../../services/templateService.js')>(
    '../../../services/templateService.js'
  );
  return {
    TemplateValidationError: actual.TemplateValidationError,
    buildTemplateSchemaFromForm: actual.buildTemplateSchemaFromForm,
    createTemplate: vi.fn(),
    updateTemplate: vi.fn(),
    getPublicTemplateCatalog: vi.fn(),
    getPublicTemplateBySlug: vi.fn(),
  };
});
vi.mock('../../../services/formService.js');
vi.mock('../../../services/fileUploadService.js');
vi.mock('../../../services/formFileService.js');
vi.mock('../../../services/hocuspocus.js', () => ({ getFormSchemaFromHocuspocus: vi.fn() }));
vi.mock('../../../middleware/better-auth-middleware.js');
vi.mock('../../../lib/logger.js', () => ({ logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() } }));
vi.mock('../../../utils/cdn.js', () => ({
  constructCdnUrl: (key: string | null) => (key ? `https://cdn.example.com/${key}` : null),
}));

const admin = { user: { id: 'a', email: 'a@x.com', name: 'A', role: 'admin' as const } } as any;
const member = { user: { id: 'u', email: 'u@x.com', name: 'U', role: 'user' as const } } as any;
const liveSchema = { pages: [], layout: { code: 'L1', backgroundImageKey: '' } };

describe('public template resolvers', () => {
  beforeEach(() => vi.clearAllMocks());

  it('serves the catalog without auth', async () => {
    vi.mocked(templateService.getPublicTemplateCatalog).mockResolvedValue({ cdnEndpoint: 'c', templates: [] });
    await expect(templatesResolvers.Query.publicTemplateCatalog()).resolves.toEqual({ cdnEndpoint: 'c', templates: [] });
  });

  it('hides catalog failures behind a generic error', async () => {
    vi.mocked(templateService.getPublicTemplateCatalog).mockRejectedValue(new Error('db'));
    await expect(templatesResolvers.Query.publicTemplateCatalog()).rejects.toThrow('Failed to fetch templates');
  });

  it('serves one template by slug without auth', async () => {
    vi.mocked(templateService.getPublicTemplateBySlug).mockResolvedValue({ slug: 'contact' } as any);
    await expect(templatesResolvers.Query.publicTemplate(null, { slug: 'contact' })).resolves.toEqual({ slug: 'contact' });
  });

  it('hides slug lookup failures behind a generic error', async () => {
    vi.mocked(templateService.getPublicTemplateBySlug).mockRejectedValue(new Error('db'));
    await expect(templatesResolvers.Query.publicTemplate(null, { slug: 'x' })).rejects.toThrow('Failed to fetch template');
  });

  it('builds thumbnail URLs and ISO dates', () => {
    expect(templatesResolvers.FormTemplate.thumbnailUrl({ thumbnailKey: 'k.webp' })).toBe('https://cdn.example.com/k.webp');
    expect(templatesResolvers.FormTemplate.thumbnailUrl({ thumbnailKey: null })).toBeNull();
    expect(templatesResolvers.PublicTemplate.updatedAt({ updatedAt: new Date('2026-01-02T00:00:00Z') })).toBe(
      '2026-01-02T00:00:00.000Z'
    );
    expect(templatesResolvers.PublicTemplate.updatedAt({ updatedAt: '2026-01-02T00:00:00Z' })).toBe(
      '2026-01-02T00:00:00.000Z'
    );
  });

  describe('createTemplateFromForm', () => {
    const args = { formId: 'form-1', input: { name: 'Onboarding', slug: 'onboarding', isPublic: true } };

    it('is limited to system admins', async () => {
      await expect(templatesResolvers.Mutation.createTemplateFromForm(null, args, member)).rejects.toThrow();
      expect(templateService.createTemplate).not.toHaveBeenCalled();
    });

    it('fails for an unknown form', async () => {
      vi.mocked(formService.getFormById).mockResolvedValue(null);
      await expect(templatesResolvers.Mutation.createTemplateFromForm(null, args, admin)).rejects.toThrow('Form not found');
    });

    it('uses the live collaborative schema and the quiz settings', async () => {
      vi.mocked(formService.getFormById).mockResolvedValue({
        id: 'form-1',
        formSchema: { stale: true },
        settings: { quiz: { enabled: true } },
      } as any);
      vi.mocked(getFormSchemaFromHocuspocus).mockResolvedValue(liveSchema);
      vi.mocked(templateService.createTemplate).mockResolvedValue({ id: 'tpl-1' } as any);

      await templatesResolvers.Mutation.createTemplateFromForm(null, args, admin);

      expect(templateService.createTemplate).toHaveBeenCalledWith({
        ...args.input,
        formSchema: { ...liveSchema, settings: { quiz: { enabled: true } } },
      });
    });

    it('falls back to the stored schema when there is no live document', async () => {
      vi.mocked(formService.getFormById).mockResolvedValue({ id: 'form-1', formSchema: liveSchema } as any);
      vi.mocked(getFormSchemaFromHocuspocus).mockResolvedValue(null);
      vi.mocked(templateService.createTemplate).mockResolvedValue({ id: 'tpl-1' } as any);

      await templatesResolvers.Mutation.createTemplateFromForm(null, args, admin);

      expect(templateService.createTemplate).toHaveBeenCalledWith({ ...args.input, formSchema: liveSchema });
    });

    it('turns validation problems into input errors', async () => {
      vi.mocked(formService.getFormById).mockResolvedValue({ id: 'form-1', formSchema: liveSchema } as any);
      vi.mocked(getFormSchemaFromHocuspocus).mockResolvedValue(null);
      vi.mocked(templateService.createTemplate).mockRejectedValue(
        new templateService.TemplateValidationError('The slug "onboarding" is already used by another template')
      );

      await expect(templatesResolvers.Mutation.createTemplateFromForm(null, args, admin)).rejects.toMatchObject({
        message: 'The slug "onboarding" is already used by another template',
        extensions: expect.objectContaining({ code: 'BAD_USER_INPUT' }),
      });
    });

    it('wraps unexpected failures', async () => {
      vi.mocked(formService.getFormById).mockRejectedValue(new Error('db'));
      await expect(templatesResolvers.Mutation.createTemplateFromForm(null, args, admin)).rejects.toThrow(
        'Failed to save form as template'
      );
    });
  });

  it('turns create/update validation problems into input errors', async () => {
    const err = new templateService.TemplateValidationError('A public template needs a slug');
    vi.mocked(templateService.createTemplate).mockRejectedValue(err);
    await expect(
      templatesResolvers.Mutation.createTemplate(null, { input: { name: 'X', formSchema: {}, isPublic: true } }, admin)
    ).rejects.toMatchObject({ extensions: expect.objectContaining({ code: 'BAD_USER_INPUT' }) });

    vi.mocked(templateService.updateTemplate).mockRejectedValue(err);
    await expect(
      templatesResolvers.Mutation.updateTemplate(null, { id: 't', input: { isPublic: true } }, admin)
    ).rejects.toMatchObject({ extensions: expect.objectContaining({ code: 'BAD_USER_INPUT' }) });
  });
});
