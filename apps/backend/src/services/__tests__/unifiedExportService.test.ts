import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  generateExportFile,
  generateExcelFilename,
  generateCsvFilename,
  type QuizGradeExportRow,
} from '../unifiedExportService.js';
import {
  FormSchema,
  FieldType,
  ThemeType,
  SpacingType,
  PageModeType,
  DEFAULT_THANK_YOU_CONTENT,
  type QuestionGradeResult,
} from '@dculus/types';
// Exposed by the exceljs mock above so tests can inspect exactly what was
// written to the workbook (see `__mockWorkbooks`).
import * as ExcelJSMock from 'exceljs';
const getLastWorkbook = () => (ExcelJSMock as any).__mockWorkbooks.at(-1);

// Mock dependencies
// `__mockWorkbooks` records every constructed workbook so tests can inspect
// the exact header/row arrays passed to `worksheet.addRow` — needed for the
// "byte-identical" acceptance test, which must assert on the generated
// workbook rather than a buffer-size summary.
vi.mock('exceljs', () => {
  const mockWorkbooks: any[] = [];

  // Create a mock class for Workbook
  class MockWorkbook {
    worksheets: any[] = [];

    constructor() {
      mockWorkbooks.push(this);
    }

    addWorksheet(name: string) {
      const mockWorksheet = {
        name,
        columns: [] as any[],
        addRow: vi.fn().mockReturnValue({
          font: {},
          eachCell: vi.fn((callback: (cell: any) => void) => {
            callback({ fill: {} });
          }),
        }),
      };
      this.worksheets.push(mockWorksheet);
      return mockWorksheet;
    }

    xlsx = {
      writeBuffer: vi.fn().mockResolvedValue(Buffer.from('excel data')),
    };
  }

  return {
    default: {
      Workbook: MockWorkbook,
    },
    __mockWorkbooks: mockWorkbooks,
  };
});
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
      thankYouContent: DEFAULT_THANK_YOU_CONTENT,
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
    (ExcelJSMock as any).__mockWorkbooks.length = 0;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('generateExportFile - Excel', () => {
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

    it('should generate buffer from ExcelJS workbook', async () => {
      const result = await generateExportFile({
        formTitle: 'Test Form',
        responses: mockResponses as any,
        formSchema: mockFormSchema,
        format: 'excel',
      });

      expect(result.buffer).toBeInstanceOf(Buffer);
      expect(result.buffer.length).toBeGreaterThan(0);
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

      const result = await generateExportFile({
        formTitle: 'Test Form',
        responses: responsesWithArray as any,
        formSchema: mockFormSchema,
        format: 'excel',
      });

      expect(result.buffer).toBeInstanceOf(Buffer);
    });

    it('should handle empty form schema by extracting field info from responses', async () => {
      const emptySchema: FormSchema = {
        pages: [],
        layout: mockFormSchema.layout,
        isShuffleEnabled: false,
      };

      const result = await generateExportFile({
        formTitle: 'Test Form',
        responses: mockResponses as any,
        formSchema: emptySchema,
        format: 'excel',
      });

      expect(result.buffer).toBeInstanceOf(Buffer);
    });

    it('should handle empty responses', async () => {
      const result = await generateExportFile({
        formTitle: 'Empty Form',
        responses: [],
        formSchema: mockFormSchema,
        format: 'excel',
      });

      expect(result.buffer).toBeInstanceOf(Buffer);
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

    it('should export legacy quiz-grading metadata through the native quiz columns', async () => {
      // Story 12/#301: legacy plugin metadata (no ResponseGrade row) must
      // populate the SAME six native columns, not the old plugin's own set.
      const result = await generateExportFile({
        formTitle: 'Quiz Form',
        responses: mockResponses as any,
        formSchema: mockFormSchema,
        format: 'csv',
      });

      const csvContent = result.buffer.toString('utf-8');
      expect(csvContent).toContain('Score,Max Score,Percentage,Result,Grading Status,Graded At');
      expect(csvContent).not.toContain('Quiz Score');
      expect(csvContent).not.toContain('Quiz Pass Threshold');
      expect(csvContent).toContain('8/10,10,80.0%,Pass,AUTO_GRADED,,John Doe');
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

    it('should derive friendly column names when schema is empty', async () => {
      const responsesWithUnknownFields = [
        {
          id: 'resp-1',
          data: {
            'field-section-789': 'alpha',
            'extremelylongfieldidentifier1234567890': 'beta',
          },
          submittedAt: 1704067200000,
          metadata: {},
        },
      ];

      const emptySchema: FormSchema = {
        pages: [],
        layout: mockFormSchema.layout,
        isShuffleEnabled: false,
      };

      const result = await generateExportFile({
        formTitle: 'Unknown Fields',
        responses: responsesWithUnknownFields as any,
        formSchema: emptySchema,
        format: 'csv',
      });

      const header = result.buffer.toString('utf-8').split('\n')[0];
      expect(header).toContain('Field 789');
      expect(header).toContain('Field extremel');
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

  describe('Native Quiz gradebook columns (epic #289, Story 12/#301)', () => {
    const plainResponses = [
      {
        id: 'resp-1',
        data: { 'field-1': 'John Doe', 'field-2': 'john@example.com' },
        submittedAt: 1704067200000,
        metadata: {},
      },
      {
        id: 'resp-2',
        data: { 'field-1': 'Jane Smith', 'field-2': 'jane@example.com' },
        submittedAt: '1706745600000',
        metadata: {},
      },
    ];

    it('CRITICAL: a non-quiz form export is byte-identical to before (CSV)', async () => {
      const result = await generateExportFile({
        formTitle: 'Plain Form',
        responses: plainResponses as any,
        formSchema: mockFormSchema,
        format: 'csv',
      });

      const lines = result.buffer.toString('utf-8').split('\n');
      expect(lines[0]).toBe('Response ID,Submitted At,Tags,Name,Email');
      expect(lines).toHaveLength(3);
    });

    it('CRITICAL: a non-quiz form export is byte-identical to before (Excel workbook)', async () => {
      await generateExportFile({
        formTitle: 'Plain Form',
        responses: plainResponses as any,
        formSchema: mockFormSchema,
        format: 'excel',
      });

      const worksheet = getLastWorkbook().worksheets[0];
      const [headerRow] = worksheet.addRow.mock.calls[0];
      expect(headerRow).toEqual(['Response ID', 'Submitted At', 'Tags', 'Name', 'Email']);
      expect(worksheet.addRow.mock.calls).toHaveLength(3); // header + 2 responses
    });

    it('emits the six native columns for a quiz-enabled form using ResponseGrade data', async () => {
      const quizGrades: Record<string, QuizGradeExportRow> = {
        'resp-1': {
          score: 7.5,
          maxScore: 10,
          percentage: 75,
          passed: true,
          status: 'AUTO_GRADED',
          gradedAt: new Date('2024-01-01T12:34:56Z'),
          detail: [],
        },
      };

      await generateExportFile({
        formTitle: 'Quiz Form',
        responses: [plainResponses[0]] as any,
        formSchema: mockFormSchema,
        format: 'excel',
        quizEnabled: true,
        quizGrades,
      });

      const worksheet = getLastWorkbook().worksheets[0];
      const [headerRow] = worksheet.addRow.mock.calls[0];
      const [dataRow] = worksheet.addRow.mock.calls[1];

      expect(headerRow.slice(0, 9)).toEqual([
        'Response ID', 'Submitted At', 'Tags',
        'Score', 'Max Score', 'Percentage', 'Result', 'Grading Status', 'Graded At',
      ]);
      expect(dataRow.slice(3, 8)).toEqual(['7.5/10', '10', '75.0%', 'Pass', 'AUTO_GRADED']);
      expect(dataRow[8]).toContain('2024');
    });

    it('emits blank quiz cells for a quiz-enabled form when a response has no grade yet', async () => {
      await generateExportFile({
        formTitle: 'Quiz Form',
        responses: plainResponses as any,
        formSchema: mockFormSchema,
        format: 'excel',
        quizEnabled: true,
      });

      const worksheet = getLastWorkbook().worksheets[0];
      const [dataRow1] = worksheet.addRow.mock.calls[1];
      expect(dataRow1.slice(3, 9)).toEqual(['', '', '', '', '', '']);
    });

    it('never emits two parallel sets of quiz columns when both a ResponseGrade row and legacy metadata exist', async () => {
      const responseWithBoth = [
        {
          ...plainResponses[0],
          metadata: {
            'quiz-grading': {
              quizScore: 2,
              totalMarks: 10,
              percentage: 20,
              gradedAt: '2023-01-01T00:00:00Z',
              gradedBy: 'plugin',
            },
          },
        },
      ];
      const quizGrades: Record<string, QuizGradeExportRow> = {
        'resp-1': {
          score: 9,
          maxScore: 10,
          percentage: 90,
          passed: true,
          status: 'RELEASED',
          gradedAt: new Date('2024-06-01T00:00:00Z'),
          detail: [],
        },
      };

      const result = await generateExportFile({
        formTitle: 'Quiz Form',
        responses: responseWithBoth as any,
        formSchema: mockFormSchema,
        format: 'csv',
        quizEnabled: true,
        quizGrades,
      });

      const csvContent = result.buffer.toString('utf-8');
      // The native ResponseGrade row wins outright — the legacy plugin
      // metadata's 2/10 must never show up, and the old plugin's own
      // 'Quiz Score' header must never appear alongside the native one.
      const headerOccurrences = csvContent.split(
        'Score,Max Score,Percentage,Result,Grading Status,Graded At'
      ).length - 1;
      expect(headerOccurrences).toBe(1);
      expect(csvContent).toContain('9/10,10,90.0%,Pass,RELEASED');
      expect(csvContent).not.toContain('2/10');
      expect(csvContent).not.toContain('Quiz Score');
      expect(csvContent).not.toContain('Quiz Pass Threshold');
    });

    describe('per-question columns', () => {
      const quizSchema: FormSchema = {
        ...mockFormSchema,
        pages: [
          {
            id: 'page-1',
            title: 'Page 1',
            order: 0,
            fields: [
              {
                id: 'q1',
                type: FieldType.RADIO_FIELD,
                label: 'Capital of France?',
                grading: { mode: 'exact', pointValue: 5, acceptedAnswers: ['Paris'] },
              } as any,
              {
                id: 'q2',
                type: FieldType.RADIO_FIELD,
                label: 'Question 1',
                grading: { mode: 'exact', pointValue: 5, acceptedAnswers: ['A'] },
              } as any,
              {
                id: 'q3',
                type: FieldType.RADIO_FIELD,
                label: 'Question 1', // duplicate label — must not collide with q2's column
                grading: { mode: 'exact', pointValue: 5, acceptedAnswers: ['B'] },
              } as any,
            ],
          },
        ],
      };

      // Keyed to q1/q2/q3 (not field-1/field-2) so extractFieldInfo doesn't
      // treat plainResponses' fields as orphan "Unknown field (deleted)"
      // columns, which would throw off the column-count assertions below.
      const quizResponse = {
        id: 'resp-1',
        data: { q1: 'Paris', q2: 'A', q3: 'B' },
        submittedAt: 1704067200000,
        metadata: {},
      };

      const buildDetail = (
        fieldId: string,
        fieldLabel: string,
        pointsAwarded: number,
        pointValue: number
      ): QuestionGradeResult => ({
        fieldId,
        fieldLabel,
        fieldType: FieldType.RADIO_FIELD,
        mode: 'exact',
        submittedValue: 'x',
        acceptedAnswers: ['x'],
        correct: pointsAwarded === pointValue,
        pointsAwarded,
        pointValue,
        autoPointsAwarded: pointsAwarded,
      });

      it('emits one column per graded question headed by the question label, deduping collisions', async () => {
        const quizGrades: Record<string, QuizGradeExportRow> = {
          'resp-1': {
            score: 10,
            maxScore: 15,
            percentage: 66.7,
            passed: true,
            status: 'AUTO_GRADED',
            gradedAt: new Date('2024-01-01T00:00:00Z'),
            detail: [
              buildDetail('q1', 'Capital of France?', 5, 5),
              buildDetail('q2', 'Question 1', 5, 5),
              buildDetail('q3', 'Question 1', 0, 5),
            ],
          },
        };

        await generateExportFile({
          formTitle: 'Quiz Form',
          responses: [quizResponse] as any,
          formSchema: quizSchema,
          format: 'excel',
          quizEnabled: true,
          quizGrades,
          includeQuizQuestionColumns: true,
        });

        const worksheet = getLastWorkbook().worksheets[0];
        const [headerRow] = worksheet.addRow.mock.calls[0];
        const [dataRow] = worksheet.addRow.mock.calls[1];

        // 3 base + 6 quiz + 3 per-question columns before the plain form-field columns
        expect(headerRow).toHaveLength(15);
        expect(headerRow.slice(9, 12)).toEqual([
          'Capital of France?',
          'Question 1',
          'Question 1 (2)',
        ]);
        expect(dataRow.slice(9, 12)).toEqual(['5/5', '5/5', '0/5']);
      });

      it('omits per-question columns when the toggle is off', async () => {
        const quizGrades: Record<string, QuizGradeExportRow> = {
          'resp-1': {
            score: 5,
            maxScore: 5,
            percentage: 100,
            passed: true,
            status: 'AUTO_GRADED',
            gradedAt: null,
            detail: [buildDetail('q1', 'Capital of France?', 5, 5)],
          },
        };

        await generateExportFile({
          formTitle: 'Quiz Form',
          responses: [quizResponse] as any,
          formSchema: quizSchema,
          format: 'excel',
          quizEnabled: true,
          quizGrades,
        });

        const worksheet = getLastWorkbook().worksheets[0];
        const [headerRow] = worksheet.addRow.mock.calls[0];

        // 3 base + 6 quiz + 3 plain form-field columns — no per-question block
        expect(headerRow).toHaveLength(12);
        expect(headerRow.slice(0, 9)).toEqual([
          'Response ID', 'Submitted At', 'Tags',
          'Score', 'Max Score', 'Percentage', 'Result', 'Grading Status', 'Graded At',
        ]);
      });
    });
  });
});
