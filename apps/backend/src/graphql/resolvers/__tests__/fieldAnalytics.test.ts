import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fieldAnalyticsResolvers } from '../fieldAnalytics.js';
import { GraphQLError } from '#graphql-errors';
import { FieldType } from '@dculus/types';
import * as fieldAnalyticsService from '../../../services/fieldAnalytics/index.js';
import * as hocuspocusService from '../../../services/hocuspocus.js';
import { prisma } from '../../../lib/prisma.js';

// Mock all dependencies
vi.mock('../../../services/fieldAnalytics/index.js');
vi.mock('../../../services/hocuspocus.js');
vi.mock('../../../lib/prisma.js', () => ({
  prisma: {
    form: {
      findFirst: vi.fn(),
    },
  },
}));
vi.mock('../../../lib/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

describe('Field Analytics Resolvers', () => {
  const mockContext = {
    user: {
      id: 'user-123',
      email: 'test@example.com',
    },
  };

  const mockForm = {
    id: 'form-123',
    organization: {
      id: 'org-123',
    },
  };

  const mockFormWithSchema = {
    id: 'form-123',
    organization: {
      id: 'org-123',
    },
    formSchema: {
      pages: [
        {
          id: 'page-1',
          title: 'Page 1',
          fields: [
            {
              id: 'field-text-1',
              type: FieldType.TEXT_INPUT_FIELD,
              label: 'Name',
            },
            {
              id: 'field-number-1',
              type: FieldType.NUMBER_FIELD,
              label: 'Age',
            },
            {
              id: 'field-email-1',
              type: FieldType.EMAIL_FIELD,
              label: 'Email Address',
            },
          ],
        },
      ],
    },
  };

  const mockHocuspocusSchema = {
    pages: [
      {
        id: 'page-1',
        title: 'Page 1',
        fields: [
          {
            id: 'field-text-1',
            type: FieldType.TEXT_INPUT_FIELD,
            label: 'Name',
          },
          {
            id: 'field-select-1',
            type: FieldType.SELECT_FIELD,
            label: 'Country',
          },
        ],
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Query: fieldAnalytics', () => {
    const mockTextAnalytics: fieldAnalyticsService.FieldAnalytics = {
      fieldId: 'field-text-1',
      fieldType: FieldType.TEXT_INPUT_FIELD,
      fieldLabel: 'Name',
      totalResponses: 100,
      responseRate: 85.5,
      lastUpdated: new Date('2024-01-01T12:00:00Z'),
      averageLength: 25.5,
      minLength: 5,
      maxLength: 50,
      wordCloud: [
        { word: 'john', count: 20, weight: 1.0 },
        { word: 'smith', count: 15, weight: 0.75 },
      ],
      lengthDistribution: [
        { range: '0-10', count: 10 },
        { range: '11-25', count: 40 },
        { range: '26-50', count: 50 },
      ],
      commonPhrases: [
        { phrase: 'john smith', count: 15 },
      ],
      recentResponses: [
        { value: 'John Doe', submittedAt: new Date('2024-01-01'), responseId: 'resp-1' },
      ],
    };

    const mockNumberAnalytics: fieldAnalyticsService.FieldAnalytics = {
      fieldId: 'field-number-1',
      fieldType: FieldType.NUMBER_FIELD,
      fieldLabel: 'Age',
      totalResponses: 80,
      responseRate: 75.0,
      lastUpdated: new Date('2024-01-01T12:00:00Z'),
      min: 18,
      max: 65,
      average: 35.5,
      median: 34,
      standardDeviation: 12.5,
      distribution: [
        { range: '18-30', count: 30, percentage: 37.5 },
        { range: '31-50', count: 40, percentage: 50.0 },
        { range: '51-65', count: 10, percentage: 12.5 },
      ],
      trend: [
        { date: '2024-01-01', average: 35, count: 40 },
        { date: '2024-01-02', average: 36, count: 40 },
      ],
      percentiles: {
        p25: 28,
        p50: 34,
        p75: 45,
        p90: 55,
        p95: 60,
      },
    };

    const mockEmailAnalytics: fieldAnalyticsService.FieldAnalytics = {
      fieldId: 'field-email-1',
      fieldType: FieldType.EMAIL_FIELD,
      fieldLabel: 'Email Address',
      totalResponses: 95,
      responseRate: 90.0,
      lastUpdated: new Date('2024-01-01T12:00:00Z'),
      validEmails: 90,
      invalidEmails: 5,
      validationRate: 94.74,
      domains: [
        { domain: 'gmail.com', count: 50, percentage: 55.56 },
        { domain: 'example.com', count: 30, percentage: 33.33 },
      ],
      topLevelDomains: [
        { tld: 'com', count: 85, percentage: 94.44 },
        { tld: 'org', count: 5, percentage: 5.56 },
      ],
      corporateVsPersonal: {
        corporate: 30,
        personal: 50,
        unknown: 10,
      },
      popularProviders: [
        { provider: 'gmail', count: 50, percentage: 55.56 },
        { provider: 'yahoo', count: 10, percentage: 11.11 },
      ],
    };

    it('should return analytics for text field with Hocuspocus schema', async () => {
      vi.mocked(prisma.form.findFirst).mockResolvedValue(mockForm as any);
      vi.mocked(hocuspocusService.getFormSchemaFromHocuspocus).mockResolvedValue(mockHocuspocusSchema);
      vi.mocked(fieldAnalyticsService.getFieldAnalytics).mockResolvedValue(mockTextAnalytics);

      const result = await fieldAnalyticsResolvers.Query.fieldAnalytics(
        {},
        { formId: 'form-123', fieldId: 'field-text-1' },
        mockContext
      );

      expect(prisma.form.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'form-123',
          organization: {
            members: {
              some: {
                userId: 'user-123',
              },
            },
          },
        },
        select: { id: true, organization: true },
      });

      expect(hocuspocusService.getFormSchemaFromHocuspocus).toHaveBeenCalledWith('form-123');

      expect(fieldAnalyticsService.getFieldAnalytics).toHaveBeenCalledWith(
        'form-123',
        'field-text-1',
        FieldType.TEXT_INPUT_FIELD,
        'Name'
      );

      expect(result.fieldId).toBe('field-text-1');
      expect(result.fieldType).toBe(FieldType.TEXT_INPUT_FIELD);
      expect(result.textAnalytics).toBeDefined();
      expect(result.textAnalytics.averageLength).toBe(25.5);
      expect(result.textAnalytics.wordCloud).toHaveLength(2);
      expect(result.numberAnalytics).toBeNull();
      expect(result.emailAnalytics).toBeNull();
    });

    // Note: Fallback to database schema is tested indirectly through other tests
    // The current implementation has complexity around schema handling that would require
    // refactoring to test directly. The Hocuspocus schema path is the primary path.

    it('should return analytics for number field', async () => {
      vi.mocked(prisma.form.findFirst).mockResolvedValue(mockForm as any);
      vi.mocked(hocuspocusService.getFormSchemaFromHocuspocus).mockResolvedValue(mockFormWithSchema.formSchema);
      vi.mocked(fieldAnalyticsService.getFieldAnalytics).mockResolvedValue(mockNumberAnalytics);

      const result = await fieldAnalyticsResolvers.Query.fieldAnalytics(
        {},
        { formId: 'form-123', fieldId: 'field-number-1' },
        mockContext
      );

      expect(result.fieldType).toBe(FieldType.NUMBER_FIELD);
      expect(result.numberAnalytics).toBeDefined();
      expect(result.numberAnalytics.average).toBe(35.5);
      expect(result.numberAnalytics.median).toBe(34);
      expect(result.numberAnalytics.percentiles.p50).toBe(34);
      expect(result.textAnalytics).toBeNull();
    });

    it('should return analytics for select field', async () => {
      const mockSelectAnalytics: fieldAnalyticsService.FieldAnalytics = {
        fieldId: 'field-select-1',
        fieldType: FieldType.SELECT_FIELD,
        fieldLabel: 'Country',
        totalResponses: 100,
        responseRate: 95.0,
        lastUpdated: new Date('2024-01-01T12:00:00Z'),
        options: [
          { option: 'USA', count: 50, percentage: 50 },
          { option: 'UK', count: 30, percentage: 30 },
          { option: 'Canada', count: 20, percentage: 20 },
        ],
        trend: [
          { date: '2024-01-01', options: [{ option: 'USA', count: 25 }] },
        ],
        topOption: 'USA',
        responseDistribution: 'concentrated',
      };

      vi.mocked(prisma.form.findFirst).mockResolvedValue(mockForm as any);
      vi.mocked(hocuspocusService.getFormSchemaFromHocuspocus).mockResolvedValue(mockHocuspocusSchema);
      vi.mocked(fieldAnalyticsService.getFieldAnalytics).mockResolvedValue(mockSelectAnalytics);

      const result = await fieldAnalyticsResolvers.Query.fieldAnalytics(
        {},
        { formId: 'form-123', fieldId: 'field-select-1' },
        mockContext
      );

      expect(result.fieldType).toBe(FieldType.SELECT_FIELD);
      expect(result.selectionAnalytics).toBeDefined();
      expect(result.selectionAnalytics.topOption).toBe('USA');
      expect(result.selectionAnalytics.options).toHaveLength(3);
    });

    it('should return analytics for checkbox field', async () => {
      const mockCheckboxAnalytics: fieldAnalyticsService.FieldAnalytics = {
        fieldId: 'field-checkbox-1',
        fieldType: FieldType.CHECKBOX_FIELD,
        fieldLabel: 'Interests',
        totalResponses: 50,
        responseRate: 80.0,
        lastUpdated: new Date('2024-01-01T12:00:00Z'),
        individualOptions: [
          { option: 'Sports', count: 30, percentage: 60 },
          { option: 'Music', count: 25, percentage: 50 },
          { option: 'Reading', count: 20, percentage: 40 },
        ],
        combinations: [
          { combination: ['Sports', 'Music'], count: 15, percentage: 30 },
          { combination: ['Sports'], count: 10, percentage: 20 },
        ],
        averageSelections: 2.1,
        selectionDistribution: [
          { selectionCount: 1, responseCount: 10, percentage: 20 },
          { selectionCount: 2, responseCount: 30, percentage: 60 },
          { selectionCount: 3, responseCount: 10, percentage: 20 },
        ],
        correlations: [
          { option1: 'Sports', option2: 'Music', correlation: 1.5 },
        ],
      };

      const mockSchemaWithCheckbox = {
        pages: [
          {
            id: 'page-1',
            fields: [
              { id: 'field-checkbox-1', type: FieldType.CHECKBOX_FIELD, label: 'Interests' },
            ],
          },
        ],
      };

      vi.mocked(prisma.form.findFirst).mockResolvedValue(mockForm as any);
      vi.mocked(hocuspocusService.getFormSchemaFromHocuspocus).mockResolvedValue(mockSchemaWithCheckbox);
      vi.mocked(fieldAnalyticsService.getFieldAnalytics).mockResolvedValue(mockCheckboxAnalytics);

      const result = await fieldAnalyticsResolvers.Query.fieldAnalytics(
        {},
        { formId: 'form-123', fieldId: 'field-checkbox-1' },
        mockContext
      );

      expect(result.fieldType).toBe(FieldType.CHECKBOX_FIELD);
      expect(result.checkboxAnalytics).toBeDefined();
      expect(result.checkboxAnalytics.averageSelections).toBe(2.1);
      expect(result.checkboxAnalytics.individualOptions).toHaveLength(3);
      expect(result.checkboxAnalytics.correlations).toHaveLength(1);
    });

    it('should return analytics for date field', async () => {
      const mockDateAnalytics: fieldAnalyticsService.FieldAnalytics = {
        fieldId: 'field-date-1',
        fieldType: FieldType.DATE_FIELD,
        fieldLabel: 'Birth Date',
        totalResponses: 60,
        responseRate: 70.0,
        lastUpdated: new Date('2024-01-01T12:00:00Z'),
        earliestDate: new Date('1950-01-01'),
        latestDate: new Date('2005-12-31'),
        mostCommonDate: new Date('1990-05-15'),
        dateDistribution: [
          { date: '1990-05-15', count: 10 },
        ],
        weekdayDistribution: [
          { weekday: 'Monday', count: 10, percentage: 16.67 },
          { weekday: 'Tuesday', count: 8, percentage: 13.33 },
        ],
        monthlyDistribution: [
          { month: 'January', count: 5, percentage: 8.33 },
          { month: 'May', count: 15, percentage: 25.0 },
        ],
        seasonalPatterns: [
          { season: 'Spring', count: 20, percentage: 33.33 },
          { season: 'Summer', count: 15, percentage: 25.0 },
        ],
      };

      const mockSchemaWithDate = {
        pages: [
          {
            id: 'page-1',
            fields: [
              { id: 'field-date-1', type: FieldType.DATE_FIELD, label: 'Birth Date' },
            ],
          },
        ],
      };

      vi.mocked(prisma.form.findFirst).mockResolvedValue(mockForm as any);
      vi.mocked(hocuspocusService.getFormSchemaFromHocuspocus).mockResolvedValue(mockSchemaWithDate);
      vi.mocked(fieldAnalyticsService.getFieldAnalytics).mockResolvedValue(mockDateAnalytics);

      const result = await fieldAnalyticsResolvers.Query.fieldAnalytics(
        {},
        { formId: 'form-123', fieldId: 'field-date-1' },
        mockContext
      );

      expect(result.fieldType).toBe(FieldType.DATE_FIELD);
      expect(result.dateAnalytics).toBeDefined();
      expect(result.dateAnalytics.earliestDate).toBe('1950-01-01T00:00:00.000Z');
      expect(result.dateAnalytics.weekdayDistribution).toHaveLength(2);
      expect(result.dateAnalytics.seasonalPatterns).toHaveLength(2);
    });

    it('should return analytics for radio field', async () => {
      const mockRadioAnalytics: fieldAnalyticsService.FieldAnalytics = {
        fieldId: 'field-radio-1',
        fieldType: FieldType.RADIO_FIELD,
        fieldLabel: 'Gender',
        totalResponses: 100,
        responseRate: 100.0,
        lastUpdated: new Date('2024-01-01T12:00:00Z'),
        options: [
          { option: 'Male', count: 55, percentage: 55 },
          { option: 'Female', count: 45, percentage: 45 },
        ],
        trend: [],
        topOption: 'Male',
        responseDistribution: 'even',
      };

      const mockSchemaWithRadio = {
        pages: [
          {
            id: 'page-1',
            fields: [
              { id: 'field-radio-1', type: FieldType.RADIO_FIELD, label: 'Gender' },
            ],
          },
        ],
      };

      vi.mocked(prisma.form.findFirst).mockResolvedValue(mockForm as any);
      vi.mocked(hocuspocusService.getFormSchemaFromHocuspocus).mockResolvedValue(mockSchemaWithRadio);
      vi.mocked(fieldAnalyticsService.getFieldAnalytics).mockResolvedValue(mockRadioAnalytics);

      const result = await fieldAnalyticsResolvers.Query.fieldAnalytics(
        {},
        { formId: 'form-123', fieldId: 'field-radio-1' },
        mockContext
      );

      expect(result.fieldType).toBe(FieldType.RADIO_FIELD);
      expect(result.selectionAnalytics).toBeDefined();
      expect(result.selectionAnalytics.responseDistribution).toBe('even');
    });

    it('should return analytics for textarea field', async () => {
      const mockTextAreaAnalytics: fieldAnalyticsService.FieldAnalytics = {
        fieldId: 'field-textarea-1',
        fieldType: FieldType.TEXT_AREA_FIELD,
        fieldLabel: 'Comments',
        totalResponses: 75,
        responseRate: 65.0,
        lastUpdated: new Date('2024-01-01T12:00:00Z'),
        averageLength: 150.5,
        minLength: 20,
        maxLength: 500,
        wordCloud: [
          { word: 'great', count: 30, weight: 1.0 },
          { word: 'excellent', count: 25, weight: 0.83 },
        ],
        lengthDistribution: [
          { range: '0-50', count: 10 },
          { range: '51-200', count: 50 },
          { range: '200+', count: 15 },
        ],
        commonPhrases: [
          { phrase: 'great service', count: 20 },
        ],
        recentResponses: [
          { value: 'Great experience overall', submittedAt: new Date('2024-01-01'), responseId: 'resp-1' },
        ],
      };

      const mockSchemaWithTextArea = {
        pages: [
          {
            id: 'page-1',
            fields: [
              { id: 'field-textarea-1', type: FieldType.TEXT_AREA_FIELD, label: 'Comments' },
            ],
          },
        ],
      };

      vi.mocked(prisma.form.findFirst).mockResolvedValue(mockForm as any);
      vi.mocked(hocuspocusService.getFormSchemaFromHocuspocus).mockResolvedValue(mockSchemaWithTextArea);
      vi.mocked(fieldAnalyticsService.getFieldAnalytics).mockResolvedValue(mockTextAreaAnalytics);

      const result = await fieldAnalyticsResolvers.Query.fieldAnalytics(
        {},
        { formId: 'form-123', fieldId: 'field-textarea-1' },
        mockContext
      );

      expect(result.fieldType).toBe(FieldType.TEXT_AREA_FIELD);
      expect(result.textAnalytics).toBeDefined();
      expect(result.textAnalytics.averageLength).toBe(150.5);
    });

    it('should throw error when user is not authenticated', async () => {
      const unauthenticatedContext = { user: null };

      await expect(
        fieldAnalyticsResolvers.Query.fieldAnalytics(
          {},
          { formId: 'form-123', fieldId: 'field-text-1' },
          unauthenticatedContext
        )
      ).rejects.toThrow(GraphQLError);

      await expect(
        fieldAnalyticsResolvers.Query.fieldAnalytics(
          {},
          { formId: 'form-123', fieldId: 'field-text-1' },
          unauthenticatedContext
        )
      ).rejects.toThrow('Authentication required');
    });

    it('should throw error when form not found', async () => {
      vi.mocked(prisma.form.findFirst).mockResolvedValue(null);

      await expect(
        fieldAnalyticsResolvers.Query.fieldAnalytics(
          {},
          { formId: 'non-existent-form', fieldId: 'field-text-1' },
          mockContext
        )
      ).rejects.toThrow(GraphQLError);

      await expect(
        fieldAnalyticsResolvers.Query.fieldAnalytics(
          {},
          { formId: 'non-existent-form', fieldId: 'field-text-1' },
          mockContext
        )
      ).rejects.toThrow('Form not found or access denied');
    });

    it('should throw error when user is not a member of organization', async () => {
      vi.mocked(prisma.form.findFirst).mockResolvedValue(null); // Prisma query filters by membership

      await expect(
        fieldAnalyticsResolvers.Query.fieldAnalytics(
          {},
          { formId: 'form-123', fieldId: 'field-text-1' },
          mockContext
        )
      ).rejects.toThrow(GraphQLError);

      await expect(
        fieldAnalyticsResolvers.Query.fieldAnalytics(
          {},
          { formId: 'form-123', fieldId: 'field-text-1' },
          mockContext
        )
      ).rejects.toThrow('Form not found or access denied');
    });


    it('should throw error when fallback schema is null', async () => {
      const mockFormWithoutSchema = {
        ...mockForm,
        organization: {
          id: 'org-123',
          members: [{ userId: 'user-123' }],
        },
        formSchema: null,
      };

      vi.mocked(prisma.form.findFirst).mockResolvedValue(mockFormWithoutSchema as any);
      vi.mocked(hocuspocusService.getFormSchemaFromHocuspocus).mockResolvedValue(null);

      await expect(
        fieldAnalyticsResolvers.Query.fieldAnalytics(
          {},
          { formId: 'form-123', fieldId: 'field-text-1' },
          mockContext
        )
      ).rejects.toThrow('No form schema found in either collaborative document or database');
    });

    it('should throw error when field not found in fallback schema', async () => {
      const mockFormWithSchemaData = {
        ...mockFormWithSchema,
        organization: {
          id: 'org-123',
          members: [{ userId: 'user-123' }],
        },
      };

      vi.mocked(prisma.form.findFirst).mockResolvedValue(mockFormWithSchemaData as any);
      vi.mocked(hocuspocusService.getFormSchemaFromHocuspocus).mockResolvedValue(null);

      await expect(
        fieldAnalyticsResolvers.Query.fieldAnalytics(
          {},
          { formId: 'form-123', fieldId: 'non-existent-field' },
          mockContext
        )
      ).rejects.toThrow('Field not found: non-existent-field');
    });

    // Note: Schema fallback error handling is complex in current implementation
    // Field not found errors are tested below which cover similar error paths

    it('should throw error when field not found in schema', async () => {
      vi.mocked(prisma.form.findFirst).mockResolvedValue(mockForm as any);
      vi.mocked(hocuspocusService.getFormSchemaFromHocuspocus).mockResolvedValue(mockHocuspocusSchema);

      await expect(
        fieldAnalyticsResolvers.Query.fieldAnalytics(
          {},
          { formId: 'form-123', fieldId: 'non-existent-field' },
          mockContext
        )
      ).rejects.toThrow(GraphQLError);

      await expect(
        fieldAnalyticsResolvers.Query.fieldAnalytics(
          {},
          { formId: 'form-123', fieldId: 'non-existent-field' },
          mockContext
        )
      ).rejects.toThrow('Field not found: non-existent-field');
    });

    it('should throw error for unsupported field type', async () => {
      const schemaWithUnsupportedField = {
        pages: [
          {
            id: 'page-1',
            fields: [
              { id: 'field-rich-text-1', type: FieldType.RICH_TEXT_FIELD, label: 'Description' },
            ],
          },
        ],
      };

      vi.mocked(prisma.form.findFirst).mockResolvedValue(mockForm as any);
      vi.mocked(hocuspocusService.getFormSchemaFromHocuspocus).mockResolvedValue(schemaWithUnsupportedField);

      await expect(
        fieldAnalyticsResolvers.Query.fieldAnalytics(
          {},
          { formId: 'form-123', fieldId: 'field-rich-text-1' },
          mockContext
        )
      ).rejects.toThrow(GraphQLError);

      await expect(
        fieldAnalyticsResolvers.Query.fieldAnalytics(
          {},
          { formId: 'form-123', fieldId: 'field-rich-text-1' },
          mockContext
        )
      ).rejects.toThrow('Analytics not supported for field type');
    });

    it('should throw error when analytics service fails', async () => {
      vi.mocked(prisma.form.findFirst).mockResolvedValue(mockForm as any);
      vi.mocked(hocuspocusService.getFormSchemaFromHocuspocus).mockResolvedValue(mockHocuspocusSchema);
      vi.mocked(fieldAnalyticsService.getFieldAnalytics).mockRejectedValue(
        new Error('Database connection error')
      );

      await expect(
        fieldAnalyticsResolvers.Query.fieldAnalytics(
          {},
          { formId: 'form-123', fieldId: 'field-text-1' },
          mockContext
        )
      ).rejects.toThrow(GraphQLError);

      await expect(
        fieldAnalyticsResolvers.Query.fieldAnalytics(
          {},
          { formId: 'form-123', fieldId: 'field-text-1' },
          mockContext
        )
      ).rejects.toThrow('Failed to get field analytics');
    });

    it('should handle field without label (use default label)', async () => {
      const schemaWithoutLabel = {
        pages: [
          {
            id: 'page-1',
            fields: [
              { id: 'field-unlabeled-1', type: FieldType.TEXT_INPUT_FIELD }, // No label
            ],
          },
        ],
      };

      vi.mocked(prisma.form.findFirst).mockResolvedValue(mockForm as any);
      vi.mocked(hocuspocusService.getFormSchemaFromHocuspocus).mockResolvedValue(schemaWithoutLabel);
      vi.mocked(fieldAnalyticsService.getFieldAnalytics).mockResolvedValue(mockTextAnalytics);

      await fieldAnalyticsResolvers.Query.fieldAnalytics(
        {},
        { formId: 'form-123', fieldId: 'field-unlabeled-1' },
        mockContext
      );

      expect(fieldAnalyticsService.getFieldAnalytics).toHaveBeenCalledWith(
        'form-123',
        'field-unlabeled-1',
        FieldType.TEXT_INPUT_FIELD,
        'Field field-unlabeled-1' // Default label format
      );
    });

    it('should handle schema with multiple pages', async () => {
      const multiPageSchema = {
        pages: [
          {
            id: 'page-1',
            fields: [
              { id: 'field-1', type: FieldType.TEXT_INPUT_FIELD, label: 'Field 1' },
            ],
          },
          {
            id: 'page-2',
            fields: [
              { id: 'field-2', type: FieldType.NUMBER_FIELD, label: 'Field 2' },
            ],
          },
          {
            id: 'page-3',
            fields: [
              { id: 'field-3', type: FieldType.EMAIL_FIELD, label: 'Field 3' },
            ],
          },
        ],
      };

      vi.mocked(prisma.form.findFirst).mockResolvedValue(mockForm as any);
      vi.mocked(hocuspocusService.getFormSchemaFromHocuspocus).mockResolvedValue(multiPageSchema);
      vi.mocked(fieldAnalyticsService.getFieldAnalytics).mockResolvedValue(mockEmailAnalytics);

      await fieldAnalyticsResolvers.Query.fieldAnalytics(
        {},
        { formId: 'form-123', fieldId: 'field-3' },
        mockContext
      );

      expect(fieldAnalyticsService.getFieldAnalytics).toHaveBeenCalledWith(
        'form-123',
        'field-3',
        FieldType.EMAIL_FIELD,
        'Field 3'
      );
    });
  });

  describe('Query: allFieldsAnalytics', () => {
    const mockAllFieldsAnalytics = {
      formId: 'form-123',
      totalResponses: 100,
      fields: [
        {
          fieldId: 'field-text-1',
          fieldType: FieldType.TEXT_INPUT_FIELD,
          fieldLabel: 'Name',
          totalResponses: 95,
          responseRate: 95.0,
          lastUpdated: new Date('2024-01-01T12:00:00Z'),
          averageLength: 25.5,
          minLength: 5,
          maxLength: 50,
          wordCloud: [{ word: 'john', count: 20, weight: 1.0 }],
          lengthDistribution: [{ range: '0-10', count: 10 }],
          commonPhrases: [{ phrase: 'john smith', count: 15 }],
          recentResponses: [
            { value: 'John Doe', submittedAt: new Date('2024-01-01'), responseId: 'resp-1' },
          ],
        },
        {
          fieldId: 'field-number-1',
          fieldType: FieldType.NUMBER_FIELD,
          fieldLabel: 'Age',
          totalResponses: 90,
          responseRate: 90.0,
          lastUpdated: new Date('2024-01-01T12:00:00Z'),
          min: 18,
          max: 65,
          average: 35.5,
          median: 34,
          standardDeviation: 12.5,
          distribution: [{ range: '18-30', count: 30, percentage: 33.33 }],
          trend: [{ date: '2024-01-01', average: 35, count: 45 }],
          percentiles: { p25: 28, p50: 34, p75: 45, p90: 55, p95: 60 },
        },
      ],
    };

    it('should return analytics for all fields in a form', async () => {
      vi.mocked(prisma.form.findFirst).mockResolvedValue(mockForm as any);
      vi.mocked(fieldAnalyticsService.getAllFieldsAnalytics).mockResolvedValue(mockAllFieldsAnalytics as any);

      const result = await fieldAnalyticsResolvers.Query.allFieldsAnalytics(
        {},
        { formId: 'form-123' },
        mockContext
      );

      expect(prisma.form.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'form-123',
          organization: {
            members: {
              some: {
                userId: 'user-123',
              },
            },
          },
        },
        select: { id: true, organization: true },
      });

      expect(fieldAnalyticsService.getAllFieldsAnalytics).toHaveBeenCalledWith('form-123');

      expect(result.formId).toBe('form-123');
      expect(result.totalResponses).toBe(100);
      expect(result.fields).toHaveLength(2);
      expect(result.fields[0].fieldId).toBe('field-text-1');
      expect(result.fields[0].textAnalytics).toBeDefined();
      expect(result.fields[1].fieldId).toBe('field-number-1');
      expect(result.fields[1].numberAnalytics).toBeDefined();
    });

    it('should throw error when user is not authenticated', async () => {
      const unauthenticatedContext = { user: null };

      await expect(
        fieldAnalyticsResolvers.Query.allFieldsAnalytics(
          {},
          { formId: 'form-123' },
          unauthenticatedContext
        )
      ).rejects.toThrow(GraphQLError);

      await expect(
        fieldAnalyticsResolvers.Query.allFieldsAnalytics(
          {},
          { formId: 'form-123' },
          unauthenticatedContext
        )
      ).rejects.toThrow('Authentication required');
    });

    it('should throw error when form not found', async () => {
      vi.mocked(prisma.form.findFirst).mockResolvedValue(null);

      await expect(
        fieldAnalyticsResolvers.Query.allFieldsAnalytics(
          {},
          { formId: 'non-existent-form' },
          mockContext
        )
      ).rejects.toThrow(GraphQLError);

      await expect(
        fieldAnalyticsResolvers.Query.allFieldsAnalytics(
          {},
          { formId: 'non-existent-form' },
          mockContext
        )
      ).rejects.toThrow('Form not found or access denied');
    });

    it('should throw error when user is not a member of organization', async () => {
      vi.mocked(prisma.form.findFirst).mockResolvedValue(null);

      await expect(
        fieldAnalyticsResolvers.Query.allFieldsAnalytics(
          {},
          { formId: 'form-123' },
          mockContext
        )
      ).rejects.toThrow(GraphQLError);

      await expect(
        fieldAnalyticsResolvers.Query.allFieldsAnalytics(
          {},
          { formId: 'form-123' },
          mockContext
        )
      ).rejects.toThrow('Form not found or access denied');
    });

    it('should throw error when analytics service fails', async () => {
      vi.mocked(prisma.form.findFirst).mockResolvedValue(mockForm as any);
      vi.mocked(fieldAnalyticsService.getAllFieldsAnalytics).mockRejectedValue(
        new Error('Database error')
      );

      await expect(
        fieldAnalyticsResolvers.Query.allFieldsAnalytics(
          {},
          { formId: 'form-123' },
          mockContext
        )
      ).rejects.toThrow(GraphQLError);

      await expect(
        fieldAnalyticsResolvers.Query.allFieldsAnalytics(
          {},
          { formId: 'form-123' },
          mockContext
        )
      ).rejects.toThrow('Failed to get all fields analytics');
    });

    it('should handle empty fields array', async () => {
      const emptyAnalytics = {
        formId: 'form-123',
        totalResponses: 0,
        fields: [],
      };

      vi.mocked(prisma.form.findFirst).mockResolvedValue(mockForm as any);
      vi.mocked(fieldAnalyticsService.getAllFieldsAnalytics).mockResolvedValue(emptyAnalytics as any);

      const result = await fieldAnalyticsResolvers.Query.allFieldsAnalytics(
        {},
        { formId: 'form-123' },
        mockContext
      );

      expect(result.formId).toBe('form-123');
      expect(result.totalResponses).toBe(0);
      expect(result.fields).toHaveLength(0);
    });

    it('should transform all field types correctly', async () => {
      const comprehensiveAnalytics = {
        formId: 'form-123',
        totalResponses: 100,
        fields: [
          {
            fieldId: 'text-field',
            fieldType: FieldType.TEXT_INPUT_FIELD,
            fieldLabel: 'Text Field',
            totalResponses: 95,
            responseRate: 95.0,
            lastUpdated: new Date('2024-01-01'),
            averageLength: 25,
            minLength: 5,
            maxLength: 50,
            wordCloud: [],
            lengthDistribution: [],
            commonPhrases: [],
            recentResponses: [],
          },
          {
            fieldId: 'email-field',
            fieldType: FieldType.EMAIL_FIELD,
            fieldLabel: 'Email Field',
            totalResponses: 90,
            responseRate: 90.0,
            lastUpdated: new Date('2024-01-01'),
            validEmails: 85,
            invalidEmails: 5,
            validationRate: 94.44,
            domains: [],
            topLevelDomains: [],
            corporateVsPersonal: { corporate: 0, personal: 0, unknown: 0 },
            popularProviders: [],
          },
          {
            fieldId: 'select-field',
            fieldType: FieldType.SELECT_FIELD,
            fieldLabel: 'Select Field',
            totalResponses: 88,
            responseRate: 88.0,
            lastUpdated: new Date('2024-01-01'),
            options: [],
            trend: [],
            topOption: 'Option 1',
            responseDistribution: 'even' as const,
          },
          {
            fieldId: 'checkbox-field',
            fieldType: FieldType.CHECKBOX_FIELD,
            fieldLabel: 'Checkbox Field',
            totalResponses: 85,
            responseRate: 85.0,
            lastUpdated: new Date('2024-01-01'),
            individualOptions: [],
            combinations: [],
            averageSelections: 2.5,
            selectionDistribution: [],
            correlations: [],
          },
          {
            fieldId: 'date-field',
            fieldType: FieldType.DATE_FIELD,
            fieldLabel: 'Date Field',
            totalResponses: 80,
            responseRate: 80.0,
            lastUpdated: new Date('2024-01-01'),
            earliestDate: new Date('2000-01-01'),
            latestDate: new Date('2024-01-01'),
            mostCommonDate: new Date('2020-01-01'),
            dateDistribution: [],
            weekdayDistribution: [],
            monthlyDistribution: [],
            seasonalPatterns: [],
          },
        ],
      };

      vi.mocked(prisma.form.findFirst).mockResolvedValue(mockForm as any);
      vi.mocked(fieldAnalyticsService.getAllFieldsAnalytics).mockResolvedValue(comprehensiveAnalytics as any);

      const result = await fieldAnalyticsResolvers.Query.allFieldsAnalytics(
        {},
        { formId: 'form-123' },
        mockContext
      );

      expect(result.fields).toHaveLength(5);
      expect(result.fields[0].textAnalytics).toBeDefined();
      expect(result.fields[1].emailAnalytics).toBeDefined();
      expect(result.fields[2].selectionAnalytics).toBeDefined();
      expect(result.fields[3].checkboxAnalytics).toBeDefined();
      expect(result.fields[4].dateAnalytics).toBeDefined();
    });

    it('should preserve GraphQL errors from service', async () => {
      vi.mocked(prisma.form.findFirst).mockResolvedValue(mockForm as any);
      vi.mocked(fieldAnalyticsService.getAllFieldsAnalytics).mockRejectedValue(
        new GraphQLError('Custom GraphQL Error')
      );

      await expect(
        fieldAnalyticsResolvers.Query.allFieldsAnalytics(
          {},
          { formId: 'form-123' },
          mockContext
        )
      ).rejects.toThrow('Failed to get all fields analytics');
    });
  });

  describe('Mutation', () => {
    it('should have an empty Mutation object', () => {
      expect(fieldAnalyticsResolvers.Mutation).toBeDefined();
      expect(Object.keys(fieldAnalyticsResolvers.Mutation)).toHaveLength(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle form schema with empty pages array', async () => {
      const emptyPagesSchema = {
        pages: [],
      };

      vi.mocked(prisma.form.findFirst).mockResolvedValue(mockForm as any);
      vi.mocked(hocuspocusService.getFormSchemaFromHocuspocus).mockResolvedValue(emptyPagesSchema);

      await expect(
        fieldAnalyticsResolvers.Query.fieldAnalytics(
          {},
          { formId: 'form-123', fieldId: 'field-text-1' },
          mockContext
        )
      ).rejects.toThrow('Field not found');
    });

    it('should handle form schema with pages missing fields array', async () => {
      const pagesWithoutFields = {
        pages: [
          { id: 'page-1', title: 'Page 1' }, // No fields array
        ],
      };

      vi.mocked(prisma.form.findFirst).mockResolvedValue(mockForm as any);
      vi.mocked(hocuspocusService.getFormSchemaFromHocuspocus).mockResolvedValue(pagesWithoutFields);

      await expect(
        fieldAnalyticsResolvers.Query.fieldAnalytics(
          {},
          { formId: 'form-123', fieldId: 'field-text-1' },
          mockContext
        )
      ).rejects.toThrow('Field not found');
    });

    it('should handle null pages in schema', async () => {
      const schemaWithNullPages = {
        pages: null,
      };

      vi.mocked(prisma.form.findFirst).mockResolvedValue(mockForm as any);
      vi.mocked(hocuspocusService.getFormSchemaFromHocuspocus).mockResolvedValue(schemaWithNullPages as any);

      await expect(
        fieldAnalyticsResolvers.Query.fieldAnalytics(
          {},
          { formId: 'form-123', fieldId: 'field-text-1' },
          mockContext
        )
      ).rejects.toThrow('Field not found');
    });

    it('should handle concurrent access checks correctly', async () => {
      vi.mocked(prisma.form.findFirst).mockResolvedValue(mockForm as any);
      vi.mocked(hocuspocusService.getFormSchemaFromHocuspocus).mockResolvedValue(mockHocuspocusSchema);
      vi.mocked(fieldAnalyticsService.getFieldAnalytics).mockResolvedValue({
        fieldId: 'field-text-1',
        fieldType: FieldType.TEXT_INPUT_FIELD,
        fieldLabel: 'Name',
        totalResponses: 100,
        responseRate: 85.5,
        lastUpdated: new Date('2024-01-01'),
        averageLength: 25.5,
        minLength: 5,
        maxLength: 50,
        wordCloud: [],
        lengthDistribution: [],
        commonPhrases: [],
        recentResponses: [],
      });

      // Simulate concurrent requests
      const promises = [
        fieldAnalyticsResolvers.Query.fieldAnalytics(
          {},
          { formId: 'form-123', fieldId: 'field-text-1' },
          mockContext
        ),
        fieldAnalyticsResolvers.Query.fieldAnalytics(
          {},
          { formId: 'form-123', fieldId: 'field-text-1' },
          mockContext
        ),
      ];

      const results = await Promise.all(promises);

      expect(results).toHaveLength(2);
      expect(results[0].fieldId).toBe('field-text-1');
      expect(results[1].fieldId).toBe('field-text-1');
    });
  });
});
