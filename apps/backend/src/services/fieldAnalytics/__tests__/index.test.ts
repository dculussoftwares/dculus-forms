import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FieldType } from '@dculus/types';

vi.mock('../../../repositories/index.js', () => ({
  formRepository: { findUnique: vi.fn() },
}));

vi.mock('../../hocuspocus.js', () => ({
  getFormSchemaFromHocuspocus: vi.fn(),
}));

vi.mock('../base.js', () => ({
  getFormResponses: vi.fn(),
  extractFieldValues: vi.fn(),
}));

vi.mock('../textFieldAnalytics.js', () => ({
  processTextFieldAnalytics: vi.fn(),
}));

vi.mock('../numberFieldAnalytics.js', () => ({
  processNumberFieldAnalytics: vi.fn(),
}));

vi.mock('../selectionFieldAnalytics.js', () => ({
  processSelectionFieldAnalytics: vi.fn(),
}));

vi.mock('../checkboxFieldAnalytics.js', () => ({
  processCheckboxFieldAnalytics: vi.fn(),
}));

vi.mock('../dateFieldAnalytics.js', () => ({
  processDateFieldAnalytics: vi.fn(),
}));

vi.mock('../emailFieldAnalytics.js', () => ({
  processEmailFieldAnalytics: vi.fn(),
}));

import { formRepository } from '../../../repositories/index.js';
import { getFormSchemaFromHocuspocus } from '../../hocuspocus.js';
import { getFormResponses, extractFieldValues } from '../base.js';
import { processTextFieldAnalytics } from '../textFieldAnalytics.js';
import { processNumberFieldAnalytics } from '../numberFieldAnalytics.js';
import { processSelectionFieldAnalytics } from '../selectionFieldAnalytics.js';
import { processCheckboxFieldAnalytics } from '../checkboxFieldAnalytics.js';
import { processDateFieldAnalytics } from '../dateFieldAnalytics.js';
import { processEmailFieldAnalytics } from '../emailFieldAnalytics.js';
import { getFieldAnalytics, getAllFieldsAnalytics } from '../index.js';

const mockResponses = [{ responseId: 'r1', data: {}, submittedAt: new Date() }];
const mockFieldResponses = [{ value: 'hello', submittedAt: new Date(), responseId: 'r1' }];

const baseResult = {
  fieldId: 'f1',
  fieldLabel: 'Field',
  totalResponses: 1,
  responseRate: 100,
  lastUpdated: new Date(),
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getFormResponses).mockResolvedValue(mockResponses as any);
  vi.mocked(extractFieldValues).mockReturnValue(mockFieldResponses as any);
});

describe('getFieldAnalytics', () => {
  it('routes TEXT_INPUT_FIELD to processTextFieldAnalytics', async () => {
    vi.mocked(processTextFieldAnalytics).mockReturnValue({ ...baseResult, fieldType: FieldType.TEXT_INPUT_FIELD } as any);

    const result = await getFieldAnalytics('form-1', 'f1', FieldType.TEXT_INPUT_FIELD, 'Field');

    expect(processTextFieldAnalytics).toHaveBeenCalledWith(mockFieldResponses, 'f1', 'Field', 1);
    expect(result.fieldType).toBe(FieldType.TEXT_INPUT_FIELD);
  });

  it('routes TEXT_AREA_FIELD to processTextFieldAnalytics and overrides fieldType', async () => {
    vi.mocked(processTextFieldAnalytics).mockReturnValue({ ...baseResult, fieldType: FieldType.TEXT_INPUT_FIELD } as any);

    const result = await getFieldAnalytics('form-1', 'f1', FieldType.TEXT_AREA_FIELD, 'Field');

    expect(processTextFieldAnalytics).toHaveBeenCalled();
    expect(result.fieldType).toBe(FieldType.TEXT_AREA_FIELD);
  });

  it('routes NUMBER_FIELD to processNumberFieldAnalytics', async () => {
    vi.mocked(processNumberFieldAnalytics).mockReturnValue({ ...baseResult, fieldType: FieldType.NUMBER_FIELD } as any);

    const result = await getFieldAnalytics('form-1', 'f1', FieldType.NUMBER_FIELD, 'Field');

    expect(processNumberFieldAnalytics).toHaveBeenCalledWith(mockFieldResponses, 'f1', 'Field', 1);
    expect(result.fieldType).toBe(FieldType.NUMBER_FIELD);
  });

  it('routes SELECT_FIELD to processSelectionFieldAnalytics', async () => {
    vi.mocked(processSelectionFieldAnalytics).mockReturnValue({ ...baseResult, fieldType: FieldType.SELECT_FIELD } as any);

    const result = await getFieldAnalytics('form-1', 'f1', FieldType.SELECT_FIELD, 'Field');

    expect(processSelectionFieldAnalytics).toHaveBeenCalledWith(mockFieldResponses, 'f1', 'Field', 1);
    expect(result.fieldType).toBe(FieldType.SELECT_FIELD);
  });

  it('routes RADIO_FIELD to processSelectionFieldAnalytics and overrides fieldType', async () => {
    vi.mocked(processSelectionFieldAnalytics).mockReturnValue({ ...baseResult, fieldType: FieldType.SELECT_FIELD } as any);

    const result = await getFieldAnalytics('form-1', 'f1', FieldType.RADIO_FIELD, 'Field');

    expect(processSelectionFieldAnalytics).toHaveBeenCalled();
    expect(result.fieldType).toBe(FieldType.RADIO_FIELD);
  });

  it('routes CHECKBOX_FIELD to processCheckboxFieldAnalytics', async () => {
    vi.mocked(processCheckboxFieldAnalytics).mockReturnValue({ ...baseResult, fieldType: FieldType.CHECKBOX_FIELD } as any);

    const result = await getFieldAnalytics('form-1', 'f1', FieldType.CHECKBOX_FIELD, 'Field');

    expect(processCheckboxFieldAnalytics).toHaveBeenCalledWith(mockFieldResponses, 'f1', 'Field', 1);
    expect(result.fieldType).toBe(FieldType.CHECKBOX_FIELD);
  });

  it('routes DATE_FIELD to processDateFieldAnalytics', async () => {
    vi.mocked(processDateFieldAnalytics).mockReturnValue({ ...baseResult, fieldType: FieldType.DATE_FIELD } as any);

    const result = await getFieldAnalytics('form-1', 'f1', FieldType.DATE_FIELD, 'Field');

    expect(processDateFieldAnalytics).toHaveBeenCalledWith(mockFieldResponses, 'f1', 'Field', 1);
    expect(result.fieldType).toBe(FieldType.DATE_FIELD);
  });

  it('routes EMAIL_FIELD to processEmailFieldAnalytics', async () => {
    vi.mocked(processEmailFieldAnalytics).mockReturnValue({ ...baseResult, fieldType: FieldType.EMAIL_FIELD } as any);

    const result = await getFieldAnalytics('form-1', 'f1', FieldType.EMAIL_FIELD, 'Field');

    expect(processEmailFieldAnalytics).toHaveBeenCalledWith(mockFieldResponses, 'f1', 'Field', 1);
    expect(result.fieldType).toBe(FieldType.EMAIL_FIELD);
  });

  it('throws for unsupported field type', async () => {
    await expect(
      getFieldAnalytics('form-1', 'f1', 'UNSUPPORTED_TYPE' as FieldType, 'Field')
    ).rejects.toThrow('Unsupported field type: UNSUPPORTED_TYPE');
  });

  describe('FILE_UPLOAD_FIELD', () => {
    it('calculates extension distribution from R2 keys', async () => {
      vi.mocked(extractFieldValues).mockReturnValue([
        { value: ['temp/uuid1/doc.pdf', 'temp/uuid2/photo.png'], submittedAt: new Date(), responseId: 'r1' },
        { value: ['temp/uuid3/report.pdf'], submittedAt: new Date(), responseId: 'r2' },
        { value: [], submittedAt: new Date(), responseId: 'r3' },
      ] as any);

      const result = await getFieldAnalytics('form-1', 'f1', FieldType.FILE_UPLOAD_FIELD, 'Upload');

      expect(result.fieldType).toBe(FieldType.FILE_UPLOAD_FIELD);
      const r = result as any;
      expect(r.totalFilesUploaded).toBe(3);
      expect(r.responsesWithFiles).toBe(2);
      expect(r.responsesWithoutFiles).toBe(1);
      const pdfEntry = r.extensionDistribution.find((e: any) => e.extension === 'pdf');
      expect(pdfEntry?.count).toBe(2);
    });

    it('assigns "unknown" extension for keys without a dot', async () => {
      vi.mocked(extractFieldValues).mockReturnValue([
        { value: ['temp/uuid1/nodot'], submittedAt: new Date(), responseId: 'r1' },
      ] as any);

      const result = await getFieldAnalytics('form-1', 'f1', FieldType.FILE_UPLOAD_FIELD, 'Upload');

      const r = result as any;
      const unknownEntry = r.extensionDistribution.find((e: any) => e.extension === 'unknown');
      expect(unknownEntry?.count).toBe(1);
    });

    it('returns zero counts when there are no file responses', async () => {
      vi.mocked(extractFieldValues).mockReturnValue([]);
      vi.mocked(getFormResponses).mockResolvedValue([]);

      const result = await getFieldAnalytics('form-1', 'f1', FieldType.FILE_UPLOAD_FIELD, 'Upload');

      const r = result as any;
      expect(r.totalFilesUploaded).toBe(0);
      expect(r.averageFilesPerResponse).toBe(0);
      expect(r.extensionDistribution).toHaveLength(0);
    });
  });
});

describe('getAllFieldsAnalytics', () => {
  const formSchema = {
    pages: [
      {
        fields: [
          { id: 'f1', type: FieldType.TEXT_INPUT_FIELD, label: 'Name' },
          { id: 'f2', type: FieldType.EMAIL_FIELD, label: 'Email' },
          { id: 'f3', type: FieldType.RICH_TEXT_FIELD, label: 'Content' }, // excluded
        ],
      },
    ],
  };

  beforeEach(() => {
    vi.mocked(processTextFieldAnalytics).mockReturnValue({ ...baseResult, fieldType: FieldType.TEXT_INPUT_FIELD } as any);
    vi.mocked(processEmailFieldAnalytics).mockReturnValue({ ...baseResult, fieldType: FieldType.EMAIL_FIELD } as any);
  });

  it('throws when the form does not exist', async () => {
    vi.mocked(formRepository.findUnique).mockResolvedValue(null);

    await expect(getAllFieldsAnalytics('missing-form')).rejects.toThrow('Form not found: missing-form');
  });

  it('uses YJS schema when available', async () => {
    vi.mocked(formRepository.findUnique).mockResolvedValue({ formSchema: {} } as any);
    vi.mocked(getFormSchemaFromHocuspocus).mockResolvedValue(formSchema as any);

    const result = await getAllFieldsAnalytics('form-1');

    expect(getFormSchemaFromHocuspocus).toHaveBeenCalledWith('form-1');
    // Only TEXT_INPUT and EMAIL are fillable; RICH_TEXT is excluded
    expect(result.fields).toHaveLength(2);
  });

  it('falls back to DB schema when YJS returns null', async () => {
    vi.mocked(formRepository.findUnique).mockResolvedValue({ formSchema } as any);
    vi.mocked(getFormSchemaFromHocuspocus).mockResolvedValue(null);

    const result = await getAllFieldsAnalytics('form-1');

    expect(result.fields).toHaveLength(2);
  });

  it('returns empty fields when DB schema is empty and YJS is null', async () => {
    vi.mocked(formRepository.findUnique).mockResolvedValue({ formSchema: {} } as any);
    vi.mocked(getFormSchemaFromHocuspocus).mockResolvedValue(null);

    const result = await getAllFieldsAnalytics('form-1');

    expect(result.fields).toHaveLength(0);
    expect(result.totalResponses).toBe(0);
  });

  it('excludes non-fillable field types', async () => {
    const schemaWithNonFillable = {
      pages: [{
        fields: [
          { id: 'f1', type: FieldType.TEXT_INPUT_FIELD, label: 'Text' },
          { id: 'f2', type: FieldType.RICH_TEXT_FIELD, label: 'Rich' },
          { id: 'f3', type: FieldType.FORM_FIELD, label: 'Form' },
          { id: 'f4', type: FieldType.FILLABLE_FORM_FIELD, label: 'Fillable' },
          { id: 'f5', type: FieldType.NON_FILLABLE_FORM_FIELD, label: 'NonFillable' },
        ],
      }],
    };
    vi.mocked(formRepository.findUnique).mockResolvedValue({ formSchema: schemaWithNonFillable } as any);
    vi.mocked(getFormSchemaFromHocuspocus).mockResolvedValue(null);

    const result = await getAllFieldsAnalytics('form-1');

    expect(result.fields).toHaveLength(1);
    expect((result.fields[0] as any).fieldType).toBe(FieldType.TEXT_INPUT_FIELD);
  });

  it('uses field id as label when field.label is missing', async () => {
    const schemaNoLabel = {
      pages: [{ fields: [{ id: 'f-no-label', type: FieldType.TEXT_INPUT_FIELD }] }],
    };
    vi.mocked(formRepository.findUnique).mockResolvedValue({ formSchema: schemaNoLabel } as any);
    vi.mocked(getFormSchemaFromHocuspocus).mockResolvedValue(null);

    await getAllFieldsAnalytics('form-1');

    expect(processTextFieldAnalytics).toHaveBeenCalledWith(
      expect.anything(),
      'f-no-label',
      'Field f-no-label',
      expect.any(Number)
    );
  });

  it('returns the total response count', async () => {
    vi.mocked(formRepository.findUnique).mockResolvedValue({ formSchema } as any);
    vi.mocked(getFormSchemaFromHocuspocus).mockResolvedValue(null);
    vi.mocked(getFormResponses).mockResolvedValue([mockResponses[0], mockResponses[0]] as any);

    const result = await getAllFieldsAnalytics('form-1');

    expect(result.totalResponses).toBe(2);
    expect(result.formId).toBe('form-1');
  });
});
