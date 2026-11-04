import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../formService.js', () => ({ getFormByShortUrl: vi.fn() }));
vi.mock('../../hocuspocus.js', () => ({ getFormSchemaFromHocuspocus: vi.fn() }));
vi.mock('../../templateService.js', () => ({ getPublicTemplateBySlug: vi.fn() }));
vi.mock('../../../lib/logger.js', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

const { getFormShareMeta } = await import('../ogImageService.js');
const { getFormByShortUrl } = await import('../../formService.js');
const { getFormSchemaFromHocuspocus } = await import('../../hocuspocus.js');

const schema = (label: string) => ({
  pages: [{ id: 'p', title: 'P', fields: [{ id: 'f', type: 'text_input_field', label }] }],
  layout: { code: 'L1', content: '<h1>Secret intro</h1><p>Private details</p>' },
});

const form = (overrides: Record<string, unknown> = {}) => ({
  id: 'form-1',
  title: 'Salary review',
  description: 'Internal only',
  isPublished: true,
  deletedAt: null,
  updatedAt: new Date('2026-11-01T00:00:00Z'),
  settings: null,
  formSchema: schema('Current salary'),
  ...overrides,
});

describe('getFormShareMeta', () => {
  beforeEach(() => vi.clearAllMocks());

  it('describes an open published form from its live schema', async () => {
    vi.mocked(getFormByShortUrl).mockResolvedValue(form() as any);
    vi.mocked(getFormSchemaFromHocuspocus).mockResolvedValue(schema('Live question'));
    const meta = await getFormShareMeta('open1');
    expect(meta?.title).toBe('Salary review');
    expect(meta?.description).toBe('Internal only');
    expect(meta?.imageUrl).toMatch(/\/og\/forms\/open1\.png\?v=[0-9a-f]{12}$/);
  });

  it('reveals nothing but the title for sign-in or domain-restricted forms', async () => {
    vi.mocked(getFormByShortUrl).mockResolvedValue(
      form({ settings: { accessControl: { enabled: true, allowedDomains: ['corp.com'] } } }) as any
    );
    const meta = await getFormShareMeta('locked1');
    expect(meta?.title).toBe('Salary review');
    expect(meta?.description).toBe('Sign in to fill out this form.');
    expect(JSON.stringify(meta)).not.toMatch(/Internal only|Secret intro|Private details|Current salary/);
    expect(getFormSchemaFromHocuspocus).not.toHaveBeenCalled();
  });

  it('returns null for drafts and deleted forms', async () => {
    vi.mocked(getFormByShortUrl).mockResolvedValue(form({ isPublished: false }) as any);
    expect(await getFormShareMeta('draft1')).toBeNull();
    vi.mocked(getFormByShortUrl).mockResolvedValue(form({ deletedAt: new Date() }) as any);
    expect(await getFormShareMeta('gone1')).toBeNull();
  });

  it('changes the image version when a question label changes', async () => {
    vi.mocked(getFormByShortUrl).mockResolvedValue(form() as any);
    vi.mocked(getFormSchemaFromHocuspocus).mockResolvedValueOnce(schema('Question A'));
    const a = await getFormShareMeta('v-a');
    vi.mocked(getFormSchemaFromHocuspocus).mockResolvedValueOnce(schema('Question B'));
    const b = await getFormShareMeta('v-b');
    expect(a?.version).not.toBe(b?.version);
  });
});
