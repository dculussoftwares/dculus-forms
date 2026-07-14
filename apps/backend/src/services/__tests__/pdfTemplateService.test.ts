import { describe, it, expect } from 'vitest';
import { FieldType } from '@dculus/types';
import { substitutePlaceholdersPlainText } from '@dculus/utils';
import {
  buildAiFieldEntries,
  buildPdfFilename,
  buildSampleResponseData,
  buildSubstitutionValues,
  buildTemplateInputs,
  coerceAiSampleData,
  formatResponseValueForPdf,
  generatePdfForResponse,
  resolveResponsePdfAttachment,
  stripBasePdf,
  validatePdfTemplate,
} from '../pdfTemplateService.js';

const BLANK_A4 = { width: 210, height: 297, padding: [10, 10, 10, 10] as [number, number, number, number] };

const textSchema = (name: string, content: string, extra: Record<string, any> = {}) => ({
  name,
  type: 'text',
  content,
  position: { x: 20, y: 20 },
  width: 100,
  height: 10,
  fontSize: 12,
  ...extra,
});

describe('substitutePlaceholdersPlainText', () => {
  it('substitutes placeholders with response values without HTML escaping', () => {
    const result = substitutePlaceholdersPlainText(
      'Dear {{name}}, score: {{score}} & more',
      { name: "O'Brien & <Co>", score: 95 }
    );
    expect(result).toBe("Dear O'Brien & <Co>, score: 95 & more");
  });

  it('joins array values with commas', () => {
    const result = substitutePlaceholdersPlainText('Options: {{opts}}', {
      opts: ['A', 'B', 'C'],
    });
    expect(result).toBe('Options: A, B, C');
  });

  it('falls back to field label in brackets for missing values', () => {
    const result = substitutePlaceholdersPlainText(
      'Hello {{field-1}}',
      {},
      { 'field-1': 'Full Name' }
    );
    expect(result).toBe('Hello [Full Name]');
  });

  it('falls back to field ID in brackets when no label exists', () => {
    expect(substitutePlaceholdersPlainText('Hello {{xyz}}', {})).toBe('Hello [xyz]');
  });

  it('keeps static text without placeholders untouched', () => {
    expect(substitutePlaceholdersPlainText('No placeholders here', {})).toBe(
      'No placeholders here'
    );
  });
});

describe('formatResponseValueForPdf', () => {
  it('returns empty string for null/undefined/empty', () => {
    expect(formatResponseValueForPdf(null)).toBe('');
    expect(formatResponseValueForPdf(undefined)).toBe('');
    expect(formatResponseValueForPdf('')).toBe('');
  });

  it('joins checkbox arrays with commas', () => {
    expect(formatResponseValueForPdf(['a', 'b'], FieldType.CHECKBOX_FIELD)).toBe('a, b');
  });

  it('formats YYYY-MM-DD dates without UTC day shift', () => {
    expect(formatResponseValueForPdf('2026-07-10', FieldType.DATE_FIELD)).toBe('Jul 10, 2026');
  });

  it('shows filenames only for file upload keys', () => {
    expect(
      formatResponseValueForPdf(
        ['files/form-response/abc/171-uuid-certificate.png'],
        FieldType.FILE_UPLOAD_FIELD
      )
    ).toBe('171-uuid-certificate.png');
  });

  it('passes plain strings through', () => {
    expect(formatResponseValueForPdf('hello', FieldType.TEXT_INPUT_FIELD)).toBe('hello');
  });
});

describe('buildSubstitutionValues', () => {
  it('maps field IDs to formatted values using schema field types', () => {
    const schema = {
      pages: [
        {
          fields: [
            { id: 'f1', type: FieldType.TEXT_INPUT_FIELD },
            { id: 'f2', type: FieldType.DATE_FIELD },
            { id: 'f3', type: FieldType.CHECKBOX_FIELD },
          ],
        },
      ],
    };
    const values = buildSubstitutionValues(schema, {
      f1: 'Alice',
      f2: '2026-01-05',
      f3: ['x', 'y'],
    });
    expect(values).toEqual({ f1: 'Alice', f2: 'Jan 5, 2026', f3: 'x, y' });
  });
});

describe('buildSampleResponseData', () => {
  it('produces a value for every fillable field, honoring field options', () => {
    const schema = {
      pages: [
        {
          fields: [
            { id: 'f-text', type: FieldType.TEXT_INPUT_FIELD },
            { id: 'f-email', type: FieldType.EMAIL_FIELD },
            { id: 'f-num', type: FieldType.NUMBER_FIELD },
            { id: 'f-date', type: FieldType.DATE_FIELD },
            { id: 'f-select', type: FieldType.SELECT_FIELD, options: ['Red', 'Blue'] },
            { id: 'f-check', type: FieldType.CHECKBOX_FIELD, options: ['A', 'B', 'C'] },
            { id: 'f-rich', type: FieldType.RICH_TEXT_FIELD },
          ],
        },
      ],
    };
    const data = buildSampleResponseData(schema);
    expect(data['f-text']).toBe('Sample answer');
    expect(data['f-email']).toBe('sample@example.com');
    expect(data['f-num']).toBe(42);
    expect(data['f-date']).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(data['f-select']).toBe('Red');
    expect(data['f-check']).toEqual(['A', 'B']);
    expect(data).not.toHaveProperty('f-rich');
  });

  it('formats cleanly through the substitution pipeline', () => {
    const schema = {
      pages: [
        {
          fields: [
            { id: 'f-date', type: FieldType.DATE_FIELD },
            { id: 'f-check', type: FieldType.CHECKBOX_FIELD, options: ['A', 'B'] },
            { id: 'f-file', type: FieldType.FILE_UPLOAD_FIELD },
          ],
        },
      ],
    };
    const values = buildSubstitutionValues(schema, buildSampleResponseData(schema));
    expect(values['f-date']).toMatch(/\w{3} \d{1,2}, \d{4}/);
    expect(values['f-check']).toBe('A, B');
    expect(values['f-file']).toBe('sample-document.pdf');
  });
});

describe('coerceAiSampleData', () => {
  const schema = {
    pages: [
      {
        fields: [
          { id: 'f-text', type: FieldType.TEXT_INPUT_FIELD },
          { id: 'f-num', type: FieldType.NUMBER_FIELD },
          { id: 'f-date', type: FieldType.DATE_FIELD },
          { id: 'f-radio', type: FieldType.RADIO_FIELD, options: ['Red', 'Blue'] },
          { id: 'f-check', type: FieldType.CHECKBOX_FIELD, options: ['A', 'B', 'C'] },
          { id: 'f-file', type: FieldType.FILE_UPLOAD_FIELD },
        ],
      },
    ],
  };

  it('accepts valid AI answers, coercing types', () => {
    const data = coerceAiSampleData(schema, {
      'f-text': 'Priya Raman',
      'f-num': '29',
      'f-date': '2026-03-15',
      'f-radio': 'Blue',
      'f-check': 'A, C',
    });
    expect(data['f-text']).toBe('Priya Raman');
    expect(data['f-num']).toBe(29);
    expect(data['f-date']).toBe('2026-03-15');
    expect(data['f-radio']).toBe('Blue');
    expect(data['f-check']).toEqual(['A', 'C']);
  });

  it('falls back to deterministic values for invalid or missing answers', () => {
    const data = coerceAiSampleData(schema, {
      'f-num': 'twenty nine',
      'f-date': 'next Tuesday',
      'f-radio': 'Green', // not an option
      'f-check': 'X, Y', // no valid options
      'f-file': 'invented-file.pdf', // never trusted from the model
    });
    expect(data['f-num']).toBe(42);
    expect(data['f-date']).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(data['f-radio']).toBe('Red');
    expect(data['f-check']).toEqual(['A', 'B']);
    expect(data['f-file']).toEqual(['sample/sample-document.pdf']);
    expect(data['f-text']).toBe('Sample answer');
  });
});

describe('buildAiFieldEntries', () => {
  it('describes fillable fields with friendly type names and options', () => {
    const entries = buildAiFieldEntries({
      pages: [
        {
          fields: [
            { id: 'f1', type: FieldType.TEXT_INPUT_FIELD, label: 'Name' },
            { id: 'f2', type: FieldType.RADIO_FIELD, label: 'Color', options: ['Red'] },
            { id: 'f3', type: FieldType.RICH_TEXT_FIELD, label: 'Intro' },
          ],
        },
      ],
    });
    expect(entries).toEqual([
      { id: 'f1', type: 'text input', label: 'Name' },
      { id: 'f2', type: 'radio', label: 'Color', options: ['Red'] },
    ]);
  });
});

describe('buildTemplateInputs', () => {
  const values = { 'f-name': 'Alice Smith', 'f-date': 'Jul 10, 2026' };
  const labels = { 'f-name': 'Full Name', 'f-date': 'Date' };

  it('resolves bound fields from dculusFieldId, ignoring the display content', () => {
    const template: any = {
      basePdf: BLANK_A4,
      schemas: [[textSchema('full_name', 'Full Name', { dculusFieldId: 'f-name' })]],
    };
    expect(buildTemplateInputs(template, values, labels)).toEqual({
      full_name: 'Alice Smith',
    });
  });

  it('outputs an empty string for bound fields that were deleted or unanswered', () => {
    const template: any = {
      basePdf: BLANK_A4,
      schemas: [[textSchema('gone', 'Old Label', { dculusFieldId: 'deleted-field' })]],
    };
    expect(buildTemplateInputs(template, values, labels)).toEqual({ gone: '' });
  });

  it('still substitutes legacy {{fieldId}} placeholders in unbound text', () => {
    const template: any = {
      basePdf: BLANK_A4,
      schemas: [
        [
          textSchema('legacy', '{{f-name}}'),
          textSchema('mixed', 'Submitted by {{f-name}} on {{f-date}}'),
        ],
      ],
    };
    expect(buildTemplateInputs(template, values, labels)).toEqual({
      legacy: 'Alice Smith',
      mixed: 'Submitted by Alice Smith on Jul 10, 2026',
    });
  });

  it('substitutes {token}s from dculusTextTemplate, ignoring the display content', () => {
    const template: any = {
      basePdf: BLANK_A4,
      schemas: [
        [
          textSchema('intro', 'Dear Full Name, submitted on Date. Literal {braces} stay.', {
            dculusTextTemplate:
              'Dear {full_name}, submitted on {date}. Literal {braces} stay.',
            dculusFieldVars: { full_name: 'f-name', date: 'f-date' },
          }),
        ],
      ],
    };
    expect(buildTemplateInputs(template, values, labels)).toEqual({
      intro: 'Dear Alice Smith, submitted on Jul 10, 2026. Literal {braces} stay.',
    });
  });

  it('renders empty for tokens whose field was deleted or unanswered', () => {
    const template: any = {
      basePdf: BLANK_A4,
      schemas: [
        [
          textSchema('intro', 'Hello Gone Field!', {
            dculusTextTemplate: 'Hello {gone}!',
            dculusFieldVars: { gone: 'deleted-field' },
          }),
        ],
      ],
    };
    expect(buildTemplateInputs(template, values, labels)).toEqual({
      intro: 'Hello !',
    });
  });

  it('never rewrites the inner braces of legacy {{id}} placeholders on token collision', () => {
    // token name deliberately equals a legacy field id: {f-name} must
    // substitute as a token while {{f-name}} stays intact for the legacy pass
    const template: any = {
      basePdf: BLANK_A4,
      schemas: [
        [
          textSchema('mixed', 'Date + legacy name', {
            dculusTextTemplate: 'Token: {f-name} | Legacy: {{f-name}}',
            dculusFieldVars: { 'f-name': 'f-date' },
          }),
        ],
      ],
    };
    expect(buildTemplateInputs(template, values, labels)).toEqual({
      mixed: 'Token: Jul 10, 2026 | Legacy: Alice Smith',
    });
  });

  it('falls back to plain content when dculusTextTemplate is absent', () => {
    const template: any = {
      basePdf: BLANK_A4,
      schemas: [
        [
          textSchema('orphan-vars', 'Plain text with {stray}', {
            dculusFieldVars: { stray: 'f-name' },
          }),
        ],
      ],
    };
    expect(buildTemplateInputs(template, values, labels)).toEqual({
      'orphan-vars': 'Plain text with {stray}',
    });
  });

  it('lets bound and legacy elements coexist in one template', () => {
    const template: any = {
      basePdf: BLANK_A4,
      schemas: [
        [
          textSchema('bound', 'Full Name', { dculusFieldId: 'f-name' }),
          textSchema('legacy', '{{f-date}}'),
        ],
      ],
    };
    expect(buildTemplateInputs(template, values, labels)).toEqual({
      bound: 'Alice Smith',
      legacy: 'Jul 10, 2026',
    });
  });

  it('excludes readOnly elements even when bound', () => {
    const template: any = {
      basePdf: BLANK_A4,
      schemas: [
        [
          textSchema('static', 'Certificate', { readOnly: true }),
          textSchema('bound_ro', 'Full Name', { dculusFieldId: 'f-name', readOnly: true }),
        ],
      ],
    };
    expect(buildTemplateInputs(template, values, labels)).toEqual({});
  });

  it('passes non-text schema content through untouched', () => {
    const template: any = {
      basePdf: BLANK_A4,
      schemas: [
        [
          {
            name: 'qr',
            type: 'qrcode',
            content: 'https://example.com',
            position: { x: 0, y: 0 },
            width: 30,
            height: 30,
          },
        ],
      ],
    };
    expect(buildTemplateInputs(template, values, labels)).toEqual({
      qr: 'https://example.com',
    });
  });
});

describe('stripBasePdf', () => {
  it('nulls basePdf for uploaded-PDF templates', () => {
    const template = { basePdf: 'data:application/pdf;base64,AAAA', schemas: [[]] };
    expect(stripBasePdf(template, true)).toEqual({ basePdf: null, schemas: [[]] });
  });

  it('keeps blank-page basePdf objects inline', () => {
    const template = { basePdf: BLANK_A4, schemas: [[]] };
    expect(stripBasePdf(template, false)).toEqual(template);
  });
});

describe('validatePdfTemplate', () => {
  it('accepts a valid blank template', () => {
    const template = { basePdf: BLANK_A4, schemas: [[textSchema('a', 'hello')]] };
    expect(() => validatePdfTemplate(template, false)).not.toThrow();
  });

  it('accepts an uploaded-PDF template with basePdf stripped', () => {
    const template = { basePdf: null, schemas: [[textSchema('a', 'hello')]] };
    expect(() => validatePdfTemplate(template, true)).not.toThrow();
  });

  it('rejects invalid template JSON', () => {
    expect(() => validatePdfTemplate({ schemas: 'not-an-array' }, false)).toThrow();
  });

  it('accepts elements carrying the dculusFieldId custom prop (zod passthrough)', () => {
    const template = {
      basePdf: BLANK_A4,
      schemas: [[textSchema('full_name', 'Full Name', { dculusFieldId: 'f1' })]],
    };
    expect(() => validatePdfTemplate(template, false)).not.toThrow();
  });

  it('rejects a blank-page template missing its own basePdf instead of silently repairing it', () => {
    // hasUploadedPdf=false means the caller must supply { width, height, padding } —
    // masking a missing basePdf here would let an invalid template pass validation
    // and only fail later, at generation time.
    const template = { basePdf: null, schemas: [[textSchema('a', 'hello')]] };
    expect(() => validatePdfTemplate(template, false)).toThrow();
  });
});

describe('buildPdfFilename', () => {
  it('sanitizes the template name and appends the response id', () => {
    expect(buildPdfFilename('Course Certificate #1!', 'resp123')).toBe(
      'course-certificate-1-resp123.pdf'
    );
  });

  it('falls back to "document" for fully unsafe names', () => {
    expect(buildPdfFilename('###', 'r1')).toBe('document-r1.pdf');
  });
});

describe('generatePdfForResponse', () => {
  it('generates a PDF for a blank template with substituted placeholders', async () => {
    const storedTemplate = {
      basePdf: BLANK_A4,
      schemas: [
        [
          textSchema('title', 'Certificate of Completion', { readOnly: true }),
          textSchema('recipient', 'Awarded to {{f-name}} on {{f-date}}'),
        ],
      ],
    };
    const deserializedSchema = {
      pages: [
        {
          fields: [
            { id: 'f-name', type: FieldType.TEXT_INPUT_FIELD, label: 'Full Name' },
            { id: 'f-date', type: FieldType.DATE_FIELD, label: 'Date' },
          ],
        },
      ],
    };

    const pdf = await generatePdfForResponse({
      storedTemplate,
      fileKey: null,
      deserializedSchema,
      responseData: { 'f-name': 'Alice Smith', 'f-date': '2026-07-10' },
    });

    expect(Buffer.isBuffer(pdf)).toBe(true);
    expect(pdf.length).toBeGreaterThan(500);
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
  }, 30000);

  it('generates a PDF with bound (dculusFieldId) elements end-to-end', async () => {
    const storedTemplate = {
      basePdf: BLANK_A4,
      schemas: [
        [
          textSchema('full_name', 'Full Name', { dculusFieldId: 'f-name' }),
          textSchema('gone', 'Deleted Field', { dculusFieldId: 'f-deleted' }),
        ],
      ],
    };
    const deserializedSchema = {
      pages: [{ fields: [{ id: 'f-name', type: FieldType.TEXT_INPUT_FIELD, label: 'Full Name' }] }],
    };

    const pdf = await generatePdfForResponse({
      storedTemplate,
      fileKey: null,
      deserializedSchema,
      responseData: { 'f-name': 'Alice Smith' },
    });

    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
  }, 30000);

  it('renders Tamil labels and answers via the bundled Noto Sans Tamil font', async () => {
    const storedTemplate = {
      basePdf: BLANK_A4,
      schemas: [
        [
          textSchema('பெயர்', 'முழுப் பெயர்', {
            dculusFieldId: 'f-name',
            fontName: 'NotoSansTamil',
          }),
          textSchema('mixed_latin', 'Full Name', {
            dculusFieldId: 'f-city',
            fontName: 'NotoSansTamil',
          }),
        ],
      ],
    };
    const deserializedSchema = {
      pages: [
        {
          fields: [
            { id: 'f-name', type: FieldType.TEXT_INPUT_FIELD, label: 'முழுப் பெயர்' },
            { id: 'f-city', type: FieldType.TEXT_INPUT_FIELD, label: 'Full Name' },
          ],
        },
      ],
    };

    const pdf = await generatePdfForResponse({
      storedTemplate,
      fileKey: null,
      deserializedSchema,
      responseData: { 'f-name': 'நதீஷ்குமார்', 'f-city': 'Chennai 600001' },
    });

    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    expect(pdf.length).toBeGreaterThan(500);
  }, 30000);

  it('substitutes a label-bracket fallback for unanswered fields', async () => {
    const storedTemplate = {
      basePdf: BLANK_A4,
      schemas: [[textSchema('recipient', 'Awarded to {{f-name}}')]],
    };
    const deserializedSchema = {
      pages: [{ fields: [{ id: 'f-name', type: FieldType.TEXT_INPUT_FIELD, label: 'Full Name' }] }],
    };

    const pdf = await generatePdfForResponse({
      storedTemplate,
      fileKey: null,
      deserializedSchema,
      responseData: {},
    });

    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
  }, 30000);
});

describe('resolveResponsePdfAttachment', () => {
  const deserializedSchema = {
    pages: [{ fields: [{ id: 'f-name', type: FieldType.TEXT_INPUT_FIELD, label: 'Full Name' }] }],
  };

  const makePrisma = (pdfTemplate: any) => ({
    pdfTemplate: { findUnique: async () => pdfTemplate },
  });

  it('looks up the template, generates the PDF, and returns an email-ready attachment', async () => {
    const storedTemplate = {
      basePdf: BLANK_A4,
      schemas: [[textSchema('recipient', 'Awarded to {{f-name}}')]],
    };
    const prisma = makePrisma({
      id: 'template-123',
      formId: 'form-123',
      name: 'Confirmation Letter #1!',
      template: storedTemplate,
      fileKey: null,
    });

    const result = await resolveResponsePdfAttachment(prisma, {
      pdfTemplateId: 'template-123',
      formId: 'form-123',
      responseId: 'resp-1',
      deserializedSchema,
      responseData: { 'f-name': 'Alice Smith' },
    });

    expect(result.error).toBeUndefined();
    expect(result.attachment?.filename).toBe('confirmation-letter-1-resp-1.pdf');
    expect(result.attachment?.contentType).toBe('application/pdf');
    expect(Buffer.isBuffer(result.attachment?.content)).toBe(true);
    expect(result.attachment?.content.subarray(0, 5).toString()).toBe('%PDF-');
  }, 30000);

  it('returns an error when the template no longer exists', async () => {
    const prisma = makePrisma(null);

    const result = await resolveResponsePdfAttachment(prisma, {
      pdfTemplateId: 'template-123',
      formId: 'form-123',
      responseId: 'resp-1',
      deserializedSchema,
      responseData: {},
    });

    expect(result.attachment).toBeUndefined();
    expect(result.error).toContain('template-123');
  });

  it('returns an error when the template belongs to a different form', async () => {
    const prisma = makePrisma({
      id: 'template-123',
      formId: 'some-other-form-456',
      name: 'Confirmation Letter',
      template: { basePdf: BLANK_A4, schemas: [] },
      fileKey: null,
    });

    const result = await resolveResponsePdfAttachment(prisma, {
      pdfTemplateId: 'template-123',
      formId: 'form-123',
      responseId: 'resp-1',
      deserializedSchema,
      responseData: {},
    });

    expect(result.attachment).toBeUndefined();
    expect(result.error).toContain('template-123');
  });

  it('returns an error instead of throwing when PDF generation fails', async () => {
    const prisma = makePrisma({
      id: 'template-123',
      formId: 'form-123',
      name: 'Broken Template',
      template: null, // malformed — has no basePdf/schemas, causes generation to throw
      fileKey: null,
    });

    const result = await resolveResponsePdfAttachment(prisma, {
      pdfTemplateId: 'template-123',
      formId: 'form-123',
      responseId: 'resp-1',
      deserializedSchema,
      responseData: {},
    });

    expect(result.attachment).toBeUndefined();
    expect(result.error).toBeTruthy();
  });
});
