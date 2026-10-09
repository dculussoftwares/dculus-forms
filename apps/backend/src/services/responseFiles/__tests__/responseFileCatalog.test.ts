import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FieldType } from '@dculus/types';

vi.mock('../../../repositories/index.js', () => ({
  formFileRepository: { findMany: vi.fn(), createManySkippingDuplicates: vi.fn() },
  formRepository: { findUnique: vi.fn() },
  responseRepository: { findMany: vi.fn() },
}));
vi.mock('../../fileUploadService.js', () => ({ getFileMetadata: vi.fn() }));
vi.mock('../../hocuspocus.js', () => ({ getFormSchemaFromHocuspocus: vi.fn() }));
vi.mock('../../responseService.js', () => ({ iterateResponsesByFormId: vi.fn() }));
vi.mock('../../../lib/logger.js', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

import { formFileRepository, formRepository, responseRepository } from '../../../repositories/index.js';
import { getFileMetadata } from '../../fileUploadService.js';
import { getFormSchemaFromHocuspocus } from '../../hocuspocus.js';
import { iterateResponsesByFormId } from '../../responseService.js';
import {
  collectResponseFiles,
  fileNameFromKey,
  isResponseFileKeyForForm,
  listFileUploadFields,
} from '../responseFileCatalog.js';

const FORM_ID = 'form-1';
const key = (name: string, formId = FORM_ID) =>
  `files/form-response/${formId}/1700000000000-11111111-2222-3333-4444-555555555555-${name}`;

const schema = {
  pages: [
    {
      fields: [
        { id: 'name', type: FieldType.TEXT_INPUT_FIELD, label: 'Name' },
        { id: 'resume', type: FieldType.FILE_UPLOAD_FIELD, label: 'Resume' },
      ],
    },
    { fields: [{ id: 'photo', type: FieldType.FILE_UPLOAD_FIELD, label: '', deleted: true }] },
  ],
};

async function* batches(...rows: unknown[][]) {
  for (const batch of rows) yield batch as any;
}

describe('responseFileCatalog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getFormSchemaFromHocuspocus).mockResolvedValue(schema);
    vi.mocked(formFileRepository.findMany).mockResolvedValue([]);
    vi.mocked(getFileMetadata).mockResolvedValue(null);
    vi.mocked(formFileRepository.createManySkippingDuplicates).mockResolvedValue({ count: 0 });
  });

  it('only accepts keys directly under the form’s own prefix', () => {
    expect(isResponseFileKeyForForm(key('a.pdf'), FORM_ID)).toBe(true);
    expect(isResponseFileKeyForForm(key('a.pdf', 'form-2'), FORM_ID)).toBe(false);
    expect(isResponseFileKeyForForm(`files/form-response/${FORM_ID}/nested/a.pdf`, FORM_ID)).toBe(false);
    expect(isResponseFileKeyForForm(42, FORM_ID)).toBe(false);
  });

  it('recovers a display name from the storage key', () => {
    expect(fileNameFromKey(key('cv.pdf'))).toBe('cv.pdf');
    expect(fileNameFromKey('files/form-response/form-1/placeholder.txt')).toBe('placeholder.txt');
  });

  it('lists file upload fields in form order, including deleted ones', () => {
    expect(listFileUploadFields(schema)).toEqual([
      { id: 'resume', label: 'Resume', order: 0 },
      { id: 'photo', label: 'Untitled question', order: 1 },
    ]);
    expect(listFileUploadFields(null)).toEqual([]);
  });

  it('collects files from live responses, skips foreign keys and joins file metadata', async () => {
    vi.mocked(iterateResponsesByFormId).mockReturnValue(
      batches([
        {
          id: 'r1',
          submittedAt: '2026-10-08T10:00:00.000Z',
          respondentEmail: 'a@b.co',
          data: { name: 'Ann', resume: [key('cv.pdf'), key('evil.pdf', 'form-2')], photo: key('me.png') },
        },
        { id: 'r2', submittedAt: new Date('2026-10-07T10:00:00Z'), data: { resume: [] } },
      ])
    );
    vi.mocked(formFileRepository.findMany).mockResolvedValue([
      { key: key('cv.pdf'), originalName: 'My CV.pdf', size: 2048, mimeType: 'application/pdf' },
    ] as any);

    const { fields, files } = await collectResponseFiles(FORM_ID, {
      filters: [{ fieldId: 'name', operator: 'EQUALS', value: 'Ann' }],
      filterLogic: 'AND',
    });

    expect(fields).toHaveLength(2);
    expect(iterateResponsesByFormId).toHaveBeenCalledWith(FORM_ID, {
      filters: [{ fieldId: 'name', operator: 'EQUALS', value: 'Ann' }],
      filterLogic: 'AND',
    });
    expect(files).toEqual([
      expect.objectContaining({
        key: key('cv.pdf'),
        responseId: 'r1',
        respondentEmail: 'a@b.co',
        fieldLabel: 'Resume',
        originalName: 'My CV.pdf',
        size: 2048,
        mimeType: 'application/pdf',
      }),
      expect.objectContaining({
        key: key('me.png'),
        fieldId: 'photo',
        fieldOrder: 1,
        originalName: 'me.png',
        size: null,
        mimeType: null,
      }),
    ]);
    expect(files[0].submittedAt).toEqual(new Date('2026-10-08T10:00:00.000Z'));
    expect(formFileRepository.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { formId: FORM_ID, key: { in: [key('cv.pdf'), key('me.png')] } } })
    );
  });

  it('recovers size and type from storage for uploads without a FormFile row, and saves them', async () => {
    vi.mocked(iterateResponsesByFormId).mockReturnValue(
      batches([{ id: 'r1', submittedAt: '2026-10-08T10:00:00.000Z', data: { resume: [key('old.pdf'), key('gone.pdf')] } }])
    );
    vi.mocked(getFileMetadata).mockImplementation(async (k: string) =>
      k.endsWith('old.pdf') ? { size: 4096, contentType: 'application/pdf' } : null
    );

    const { files } = await collectResponseFiles(FORM_ID);

    expect(files).toEqual([
      expect.objectContaining({ key: key('old.pdf'), originalName: 'old.pdf', size: 4096, mimeType: 'application/pdf' }),
      expect.objectContaining({ key: key('gone.pdf'), originalName: 'gone.pdf', size: null, mimeType: null }),
    ]);
    expect(formFileRepository.createManySkippingDuplicates).toHaveBeenCalledWith([
      { key: key('old.pdf'), type: 'FormResponse', formId: FORM_ID, url: key('old.pdf'), originalName: 'old.pdf', size: 4096, mimeType: 'application/pdf' },
    ]);
  });

  it('still lists files when the recovered metadata cannot be saved', async () => {
    vi.mocked(iterateResponsesByFormId).mockReturnValue(
      batches([{ id: 'r1', submittedAt: '2026-10-08T10:00:00.000Z', data: { resume: [key('old.pdf')] } }])
    );
    vi.mocked(getFileMetadata).mockResolvedValue({ size: 10, contentType: null });
    vi.mocked(formFileRepository.createManySkippingDuplicates).mockRejectedValue(new Error('db'));

    const { files } = await collectResponseFiles(FORM_ID);
    expect(files[0]).toMatchObject({ size: 10, mimeType: 'application/octet-stream' });
  });

  it('loads selected responses directly, excluding deleted ones', async () => {
    vi.mocked(responseRepository.findMany).mockResolvedValue([
      { id: 'r1', submittedAt: new Date(), data: { resume: [key('cv.pdf')] } },
    ] as any);

    const { files } = await collectResponseFiles(FORM_ID, { responseIds: ['r1', 'r9'] });

    expect(responseRepository.findMany).toHaveBeenCalledWith({
      where: { id: { in: ['r1', 'r9'] }, formId: FORM_ID, deletedAt: null },
      orderBy: { submittedAt: 'desc' },
    });
    expect(iterateResponsesByFormId).not.toHaveBeenCalled();
    expect(files).toHaveLength(1);
  });

  it('narrows to selected files, ignoring keys no live response holds', async () => {
    vi.mocked(responseRepository.findMany).mockResolvedValue([
      { id: 'r1', submittedAt: new Date(), data: { resume: [key('cv.pdf'), key('cover.pdf')] } },
    ] as any);

    const { files } = await collectResponseFiles(FORM_ID, {
      responseIds: ['r1'],
      fileKeys: [key('cover.pdf'), key('stranger.pdf', 'form-2')],
    });

    expect(files.map((f) => f.key)).toEqual([key('cover.pdf')]);
  });

  it('falls back to the stored schema and returns nothing for forms without file fields', async () => {
    vi.mocked(getFormSchemaFromHocuspocus).mockRejectedValue(new Error('timeout'));
    vi.mocked(formRepository.findUnique).mockResolvedValue({ formSchema: { pages: [{ fields: [] }] } } as any);

    const result = await collectResponseFiles(FORM_ID);

    expect(result).toEqual({ fields: [], files: [] });
    expect(iterateResponsesByFormId).not.toHaveBeenCalled();
  });
});
