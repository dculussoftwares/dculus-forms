import { describe, it, expect, vi, beforeEach } from 'vitest';
import { copyPdfTemplatesToForm } from '../copyPdfTemplates.js';
import { pdfTemplateRepository, pdfGeneratorRepository } from '../../repositories/index.js';
import { copyPdfTemplateAssetForForm } from '../fileUploadService.js';
import { generateId } from '@dculus/utils';

vi.mock('../../repositories/index.js', () => ({
  pdfTemplateRepository: {
    listByForm: vi.fn().mockResolvedValue([]),
    createTemplate: vi.fn(),
  },
  pdfGeneratorRepository: {
    listByForm: vi.fn().mockResolvedValue([]),
    createGenerator: vi.fn().mockResolvedValue({}),
  },
}));
vi.mock('../fileUploadService.js', () => ({
  copyPdfTemplateAssetForForm: vi.fn(),
}));
vi.mock('../../lib/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock('@dculus/utils', async () => {
  const actual = await vi.importActual<typeof import('@dculus/utils')>('@dculus/utils');
  return { ...actual, generateId: vi.fn() };
});

describe('copyPdfTemplatesToForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    let n = 0;
    vi.mocked(generateId).mockImplementation(() => `new-${++n}`);
    // clearAllMocks wipes call history but not resolved-value implementations, so re-assert
    // the empty defaults each test to avoid one test's list leaking into the next.
    vi.mocked(pdfTemplateRepository.listByForm).mockResolvedValue([]);
    vi.mocked(pdfGeneratorRepository.listByForm).mockResolvedValue([]);
    vi.mocked(pdfTemplateRepository.createTemplate).mockImplementation(
      async (data: any) => ({ ...data })
    );
  });

  it('returns 0 when the form has no templates or generators', async () => {
    const count = await copyPdfTemplatesToForm('src', 'dst', 'user-1');
    expect(count).toBe(0);
    expect(pdfTemplateRepository.createTemplate).not.toHaveBeenCalled();
  });

  it('copies the base PDF into a new private object and re-points generators at the copy', async () => {
    vi.mocked(pdfTemplateRepository.listByForm).mockResolvedValue([
      {
        id: 't1',
        formId: 'src',
        name: 'Certificate',
        template: { schemas: [] },
        fileKey: 'files/pdf-template-asset/src/base.pdf',
        fileName: 'base.pdf',
        pageCount: 2,
      },
    ] as any);
    vi.mocked(pdfGeneratorRepository.listByForm).mockResolvedValue([
      {
        id: 'g1',
        formId: 'src',
        templateId: 't1',
        name: 'All responses',
        columnName: 'Certificate',
        filenameFieldId: 'field-abc',
        filters: [{ field: 'field-abc', operator: 'eq', value: 'x' }],
        filterLogic: 'AND',
        autoRunOnSubmit: true,
        enabled: true,
      },
    ] as any);
    vi.mocked(copyPdfTemplateAssetForForm).mockResolvedValue(
      'files/pdf-template-asset/dst/copied.pdf'
    );

    const count = await copyPdfTemplatesToForm('src', 'dst', 'user-1');

    expect(count).toBe(2);
    expect(copyPdfTemplateAssetForForm).toHaveBeenCalledWith(
      'files/pdf-template-asset/src/base.pdf',
      'dst'
    );
    expect(pdfTemplateRepository.createTemplate).toHaveBeenCalledWith(
      expect.objectContaining({
        formId: 'dst',
        name: 'Certificate',
        fileKey: 'files/pdf-template-asset/dst/copied.pdf',
        pageCount: 2,
        createdById: 'user-1',
      })
    );
    // Generator points at the NEW template id, and never auto-runs on the fresh copy.
    expect(pdfGeneratorRepository.createGenerator).toHaveBeenCalledWith(
      expect.objectContaining({
        formId: 'dst',
        templateId: 'new-1',
        autoRunOnSubmit: false,
        enabled: true,
        filenameFieldId: 'field-abc',
      })
    );
  });

  it('shares the source object key when the R2 copy fails, rather than dropping the template', async () => {
    vi.mocked(pdfTemplateRepository.listByForm).mockResolvedValue([
      {
        id: 't1',
        formId: 'src',
        name: 'Certificate',
        template: {},
        fileKey: 'files/pdf-template-asset/src/base.pdf',
        fileName: 'base.pdf',
        pageCount: 1,
      },
    ] as any);
    vi.mocked(copyPdfTemplateAssetForForm).mockRejectedValue(new Error('R2 down'));

    const count = await copyPdfTemplatesToForm('src', 'dst', 'user-1');

    expect(count).toBe(1);
    expect(pdfTemplateRepository.createTemplate).toHaveBeenCalledWith(
      expect.objectContaining({ fileKey: 'files/pdf-template-asset/src/base.pdf' })
    );
  });

  it('skips a generator whose template was not copied', async () => {
    vi.mocked(pdfTemplateRepository.listByForm).mockResolvedValue([]);
    vi.mocked(pdfGeneratorRepository.listByForm).mockResolvedValue([
      { id: 'g1', formId: 'src', templateId: 't-missing', name: 'x', filters: [], filterLogic: 'AND' },
    ] as any);

    const count = await copyPdfTemplatesToForm('src', 'dst', 'user-1');

    expect(count).toBe(0);
    expect(pdfGeneratorRepository.createGenerator).not.toHaveBeenCalled();
  });

  it('never throws when a write fails', async () => {
    vi.mocked(pdfTemplateRepository.listByForm).mockResolvedValue([
      { id: 't1', name: 'x', template: {}, fileKey: null, fileName: null, pageCount: 1 },
    ] as any);
    vi.mocked(pdfTemplateRepository.createTemplate).mockRejectedValue(new Error('db down'));

    await expect(copyPdfTemplatesToForm('src', 'dst', 'user-1')).resolves.toBe(0);
  });

  it('keeps copying the remaining templates when one create fails', async () => {
    vi.mocked(pdfTemplateRepository.listByForm).mockResolvedValue([
      { id: 't1', name: 'first', template: {}, fileKey: null, fileName: null, pageCount: 1 },
      { id: 't2', name: 'second', template: {}, fileKey: null, fileName: null, pageCount: 1 },
    ] as any);
    vi.mocked(pdfTemplateRepository.createTemplate)
      .mockRejectedValueOnce(new Error('db blip'))
      .mockImplementationOnce(async (data: any) => ({ ...data }));

    const count = await copyPdfTemplatesToForm('src', 'dst', 'user-1');

    expect(count).toBe(1);
    expect(pdfTemplateRepository.createTemplate).toHaveBeenCalledTimes(2);
  });
});
