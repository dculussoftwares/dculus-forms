import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  generateExportFile,
  generateExcelFilename,
  generateCsvFilename,
} from '../unifiedExportService.js';
import { FormSchema, FieldType, ThemeType, SpacingType, PageModeType } from '@dculus/types';
import * as XLSX from 'xlsx';

// Mock dependencies
vi.mock('xlsx');
vi.mock('../plugins/exportRegistry.js', () => ({
  getPluginTypesWithData: vi.fn(() => ['quiz-grading']),
  getPluginExport: vi.fn((type) => {
    if (type === 'quiz-grading') {
      return {
        getColumns: () => ['Quiz Score', 'Quiz Percentage', 'Quiz Status', 'Quiz Pass Threshold'],
        getValues: (metadata: any) => {
          if (!metadata) return ['', '', '', ''];
          const scoreText = `${metadata.quizScore}/${metadata.totalMarks}`;
          const percentage = metadata.percentage.toFixed(1);
          const passThreshold = metadata.passThreshold ?? 60;
          const status = metadata.percentage >= passThreshold ? 'Pass' : 'Fail';
          const thresholdText = `${passThreshold}%`;
          return [scoreText, percentage, status, thresholdText];
        },
      };
    }
    return null;
  }),
}));

describe('Unified Export Service', () => {
  const mockFormSchema: FormSchema = {
    pages: [
      {
        id: 'page-1',
        title: 'Page 1',
        order: 0,
        fields: [
          {
            id: 'field-1',
            type: FieldType.TEXT_INPUT_FIELD,
            label: 'Name',
            defaultValue: '',
            prefix: '',
            hint: '',
            validation: { required: true, type: FieldType.TEXT_INPUT_FIELD },
          } as any,
          {
            id: 'field-2',
            type: FieldType.EMAIL_FIELD,
            label: 'Email',
            defaultValue: '',
            prefix: '',
            hint: '',
            validation: { required: true, type: FieldType.EMAIL_FIELD },
          } as any,
        ],
      },
    ],
    layout: {
      theme: ThemeType.LIGHT,
      textColor: '#000000',
      spacing: SpacingType.NORMAL,
      code: 'L1' as const,
      content: '',
      customBackGroundColor: '#ffffff',
      backgroundImageKey: '',
      pageMode: PageModeType.MULTIPAGE,
    },
    isShuffleEnabled: false,
  };

  const mockResponses = [
    {
      id: 'resp-1',
      data: {
        'field-1': 'John Doe',
        'field-2': 'john@example.com',
      },
      submittedAt: 1704067200000,
      metadata: {
        'quiz-grading': {
          quizScore: 8,
          totalMarks: 10,
          percentage: 80,
          result: 'PASS',
        },
      },
    },
    {
      id: 'resp-2',
      data: {
        'field-1': 'Jane Smith',
        'field-2': 'jane@example.com',
      },
      submittedAt: '1706745600000',
      metadata: {},
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('generateExportFile - Excel', () => {
    beforeEach(() => {
      const mockWorksheet = {};
      const mockWorkbook = { Sheets: {}, SheetNames: [] };

      vi.mocked(XLSX.utils.json_to_sheet).mockReturnValue(mockWorksheet as any);
      vi.mocked(XLSX.utils.book_new).mockReturnValue(mockWorkbook as any);
      vi.mocked(XLSX.utils.book_append_sheet).mockImplementation(() => {});
      vi.mocked(XLSX.utils.decode_range).mockReturnValue({
        s: { r: 0, c: 0 },
        e: { r: 2, c: 5 },
      } as any);
      vi.mocked(XLSX.utils.encode_cell).mockReturnValue('A1');
      vi.mocked(XLSX.write).mockReturnValue(Buffer.from('excel data') as any);
    });

    it('should generate Excel file with correct format', async () => {
      const result = await generateExportFile({
        formTitle: 'Contact Form',
        responses: mockResponses as any,
        formSchema: mockFormSchema,
        format: 'excel',
      });

      expect(result.contentType).toBe(
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      expect(result.filename).toContain('Contact_Form_responses_');
      expect(result.filename).toMatch(/\.xlsx$/);
      expect(result.buffer).toBeInstanceOf(Buffer);
    });

    it('should include Response ID and Submitted At columns', async () => {
      await generateExportFile({
        formTitle: 'Test Form',
        responses: mockResponses as any,
        formSchema: mockFormSchema,
        format: 'excel',
      });

      expect(XLSX.utils.json_to_sheet).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            'Response ID': 'resp-1',
            'Submitted At': expect.any(String),
          }),
        ])
      );
    });

    it('should include plugin columns when plugin data exists', async () => {
      await generateExportFile({
        formTitle: 'Quiz Form',
        responses: mockResponses as any,
        formSchema: mockFormSchema,
        format: 'excel',
      });

      expect(XLSX.utils.json_to_sheet).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            'Quiz Score': '8/10',
            'Quiz Percentage': '80.0',
            'Quiz Status': 'Pass',
            'Quiz Pass Threshold': '60%',
          }),
        ])
      );
    });

    it('should include form field columns', async () => {
      await generateExportFile({
        formTitle: 'Test Form',
        responses: mockResponses as any,
        formSchema: mockFormSchema,
        format: 'excel',
      });

      expect(XLSX.utils.json_to_sheet).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            Name: 'John Doe',
            Email: 'john@example.com',
          }),
        ])
      );
    });

    it('should handle array values in fields', async () => {
      const responsesWithArray = [
        {
          id: 'resp-1',
          data: {
            'field-1': ['option1', 'option2'],
          },
          submittedAt: 1704067200000,
          metadata: {},
        },
      ];

      await generateExportFile({
        formTitle: 'Test Form',
        responses: responsesWithArray as any,
        formSchema: mockFormSchema,
        format: 'excel',
      });

      expect(XLSX.utils.json_to_sheet).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            Name: 'option1, option2',
          }),
        ])
      );
    });

    it('should format date fields correctly', async () => {
      const schemaWithDateField: FormSchema = {
        ...mockFormSchema,
        pages: [
          {
            id: 'page-1',
            title: 'Page 1',
            order: 0,
            fields: [
              {
                id: 'field-date',
                type: FieldType.DATE_FIELD,
                label: 'Date',
                defaultValue: '',
                prefix: '',
                hint: '',
                validation: { required: false, type: FieldType.DATE_FIELD },
              } as any,
            ],
          },
        ],
      };

      const responsesWithDate = [
        {
          id: 'resp-1',
          data: {
            'field-date': '1704067200000',
          },
          submittedAt: 1704067200000,
          metadata: {},
        },
      ];

      await generateExportFile({
        formTitle: 'Test Form',
        responses: responsesWithDate as any,
        formSchema: schemaWithDateField,
        format: 'excel',
      });

      expect(XLSX.utils.json_to_sheet).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            Date: expect.stringMatching(/\d{1,2}\/\d{1,2}\/\d{4}/),
          }),
        ])
      );
    });

    it('should handle empty form schema by extracting field info from responses', async () => {
      const emptySchema: FormSchema = {
        pages: [],
        layout: mockFormSchema.layout,
        isShuffleEnabled: false,
      };

      await generateExportFile({
        formTitle: 'Test Form',
        responses: mockResponses as any,
        formSchema: emptySchema,
        format: 'excel',
      });

      expect(XLSX.utils.json_to_sheet).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            'Response ID': expect.any(String),
          }),
        ])
      );
    });

    it('should handle empty responses', async () => {
      await generateExportFile({
        formTitle: 'Empty Form',
        responses: [],
        formSchema: mockFormSchema,
        format: 'excel',
      });

      expect(XLSX.utils.json_to_sheet).toHaveBeenCalledWith([]);
    });
  });

  describe('generateExportFile - CSV', () => {
    it('should generate CSV file with correct format', async () => {
      const result = await generateExportFile({
        formTitle: 'Contact Form',
        responses: mockResponses as any,
        formSchema: mockFormSchema,
        format: 'csv',
      });

      expect(result.contentType).toBe('text/csv');
      expect(result.filename).toContain('Contact_Form_responses_');
      expect(result.filename).toMatch(/\.csv$/);
      expect(result.buffer).toBeInstanceOf(Buffer);
    });

    it('should include CSV headers', async () => {
      const result = await generateExportFile({
        formTitle: 'Test Form',
        responses: mockResponses as any,
        formSchema: mockFormSchema,
        format: 'csv',
      });

      const csvContent = result.buffer.toString('utf-8');
      expect(csvContent).toContain('Response ID,Submitted At');
      expect(csvContent).toContain('Name,Email');
    });

    it('should escape CSV special characters', async () => {
      const responsesWithSpecialChars = [
        {
          id: 'resp-1',
          data: {
            'field-1': 'Name with, comma',
            'field-2': 'Email "with" quotes',
          },
          submittedAt: 1704067200000,
          metadata: {},
        },
      ];

      const result = await generateExportFile({
        formTitle: 'Test Form',
        responses: responsesWithSpecialChars as any,
        formSchema: mockFormSchema,
        format: 'csv',
      });

      const csvContent = result.buffer.toString('utf-8');
      expect(csvContent).toContain('"Name with, comma"');
      expect(csvContent).toContain('"Email ""with"" quotes"');
    });

    it('should handle array values with semicolon separator', async () => {
      const responsesWithArray = [
        {
          id: 'resp-1',
          data: {
            'field-1': ['option1', 'option2', 'option3'],
          },
          submittedAt: 1704067200000,
          metadata: {},
        },
      ];

      const result = await generateExportFile({
        formTitle: 'Test Form',
        responses: responsesWithArray as any,
        formSchema: mockFormSchema,
        format: 'csv',
      });

      const csvContent = result.buffer.toString('utf-8');
      expect(csvContent).toContain('option1; option2; option3');
    });

    it('should include plugin data in CSV', async () => {
      const result = await generateExportFile({
        formTitle: 'Quiz Form',
        responses: mockResponses as any,
        formSchema: mockFormSchema,
        format: 'csv',
      });

      const csvContent = result.buffer.toString('utf-8');
      expect(csvContent).toContain('Quiz Score,Quiz Percentage,Quiz Status,Quiz Pass Threshold');
      expect(csvContent).toContain('8/10,80.0,Pass,60%');
    });

    it('should handle newlines in field values', async () => {
      const responsesWithNewlines = [
        {
          id: 'resp-1',
          data: {
            'field-1': 'Line 1\nLine 2',
          },
          submittedAt: 1704067200000,
          metadata: {},
        },
      ];

      const result = await generateExportFile({
        formTitle: 'Test Form',
        responses: responsesWithNewlines as any,
        formSchema: mockFormSchema,
        format: 'csv',
      });

      const csvContent = result.buffer.toString('utf-8');
      expect(csvContent).toContain('"Line 1\nLine 2"');
    });
  });

  describe('generateExcelFilename', () => {
    it('should generate filename with form title', () => {
      const filename = generateExcelFilename('Contact Form');
      expect(filename).toContain('Contact_Form_responses_');
      expect(filename).toMatch(/\.xlsx$/);
    });

    it('should sanitize special characters', () => {
      const filename = generateExcelFilename('Form @#$ Name!');
      expect(filename).toBe('Form_____Name__responses_' + new Date().toISOString().split('T')[0] + '.xlsx');
    });

    it('should include current date', () => {
      const filename = generateExcelFilename('Test Form');
      const today = new Date().toISOString().split('T')[0];
      expect(filename).toContain(today);
    });
  });

  describe('generateCsvFilename', () => {
    it('should generate filename with form title', () => {
      const filename = generateCsvFilename('Contact Form');
      expect(filename).toContain('Contact_Form_responses_');
      expect(filename).toMatch(/\.csv$/);
    });

    it('should sanitize special characters', () => {
      const filename = generateCsvFilename('Form @#$ Name!');
      expect(filename).toBe('Form_____Name__responses_' + new Date().toISOString().split('T')[0] + '.csv');
    });

    it('should include current date', () => {
      const filename = generateCsvFilename('Test Form');
      const today = new Date().toISOString().split('T')[0];
      expect(filename).toContain(today);
    });
  });

  describe('edge cases', () => {
    it('should handle responses with null values', async () => {
      const responsesWithNull = [
        {
          id: 'resp-1',
          data: {
            'field-1': null,
            'field-2': undefined,
          },
          submittedAt: 1704067200000,
          metadata: {},
        },
      ];

      const result = await generateExportFile({
        formTitle: 'Test Form',
        responses: responsesWithNull as any,
        formSchema: mockFormSchema,
        format: 'csv',
      });

      expect(result.buffer).toBeInstanceOf(Buffer);
    });

    it('should handle responses with missing plugin metadata', async () => {
      const responsesWithoutMetadata = [
        {
          id: 'resp-1',
          data: {
            'field-1': 'John',
          },
          submittedAt: 1704067200000,
          metadata: {},
        },
      ];

      const result = await generateExportFile({
        formTitle: 'Test Form',
        responses: responsesWithoutMetadata as any,
        formSchema: mockFormSchema,
        format: 'excel',
      });

      expect(result.buffer).toBeInstanceOf(Buffer);
    });

    it('should handle invalid timestamp formats', async () => {
      const responsesWithInvalidDate = [
        {
          id: 'resp-1',
          data: {
            'field-date': 'invalid-timestamp',
          },
          submittedAt: 1704067200000,
          metadata: {},
        },
      ];

      const schemaWithDate: FormSchema = {
        ...mockFormSchema,
        pages: [
          {
            id: 'page-1',
            title: 'Page 1',
            order: 0,
            fields: [
              {
                id: 'field-date',
                type: FieldType.DATE_FIELD,
                label: 'Date',
              } as any,
            ],
          },
        ],
      };

      const result = await generateExportFile({
        formTitle: 'Test Form',
        responses: responsesWithInvalidDate as any,
        formSchema: schemaWithDate,
        format: 'excel',
      });

      expect(result.buffer).toBeInstanceOf(Buffer);
    });
  });
});
