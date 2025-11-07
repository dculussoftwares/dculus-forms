import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FieldType } from '@dculus/types';
import {
  getFormResponses,
  extractFieldValues,
  processTextFieldAnalytics,
  processNumberFieldAnalytics,
  processSelectionFieldAnalytics,
  processCheckboxFieldAnalytics,
  processDateFieldAnalytics,
  processEmailFieldAnalytics,
  getFieldAnalytics,
  getAllFieldsAnalytics,
} from '../fieldAnalyticsService.js';
import { responseRepository, formRepository } from '../../repositories/index.js';
import { getFormSchemaFromHocuspocus } from '../hocuspocus.js';

vi.mock('../../repositories/index.js');
vi.mock('../hocuspocus.js');

const toDate = (value: string) => new Date(value);

describe('fieldAnalyticsService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-05-01T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('getFormResponses', () => {
    it('normalizes repository responses with data payload and submitted timestamp', async () => {
      const submittedAt = new Date('2024-03-01T10:00:00Z');
      vi.mocked(responseRepository.listByForm).mockResolvedValue([
        { id: 'resp-1', data: { fieldA: 'value' }, submittedAt },
        { id: 'resp-2', data: { fieldA: 'other' }, submittedAt: new Date('2024-03-02T15:30:00Z') },
      ] as any);

      const result = await getFormResponses('form-123');

      expect(responseRepository.listByForm).toHaveBeenCalledWith('form-123');
      expect(result).toEqual([
        {
          responseId: 'resp-1',
          data: { fieldA: 'value' },
          submittedAt,
        },
        {
          responseId: 'resp-2',
          data: { fieldA: 'other' },
          submittedAt: new Date('2024-03-02T15:30:00Z'),
        },
      ]);
    });
  });

  describe('extractFieldValues', () => {
    it('returns only defined, non-empty values for the requested field', () => {
      const submittedAt = new Date('2024-04-01T00:00:00Z');
      const responses = [
        { responseId: 'r1', submittedAt, data: { target: 'hello', other: 1 } },
        { responseId: 'r2', submittedAt, data: { target: '' } },
        { responseId: 'r3', submittedAt, data: { other: 'ignored' } },
        { responseId: 'r4', submittedAt, data: { target: 'world' } },
      ];

      const result = extractFieldValues(responses as any, 'target');

      expect(result).toEqual([
        { responseId: 'r1', submittedAt, value: 'hello' },
        { responseId: 'r4', submittedAt, value: 'world' },
      ]);
    });
  });

  describe('processTextFieldAnalytics', () => {
    it('builds statistics, word cloud, and recent responses', () => {
      const fieldResponses = [
        { value: 'Great product experience', submittedAt: toDate('2024-03-01T10:00:00Z'), responseId: 'r1' },
        { value: 'Great support and great UX', submittedAt: toDate('2024-03-02T11:00:00Z'), responseId: 'r2' },
        { value: 'Average features', submittedAt: toDate('2024-03-03T12:00:00Z'), responseId: 'r3' },
      ];

      const analytics = processTextFieldAnalytics(fieldResponses, 'field-text', 'Feedback', 5);

      expect(analytics.fieldId).toBe('field-text');
      expect(analytics.fieldLabel).toBe('Feedback');
      expect(analytics.totalResponses).toBe(3);
      expect(analytics.responseRate).toBeCloseTo(60);
      expect(analytics.averageLength).toBe(22);
      expect(analytics.minLength).toBe(16);
      expect(analytics.maxLength).toBe(26);
      expect(analytics.wordCloud[0]).toEqual({
        word: 'great',
        count: 3,
        weight: 1,
      });
      expect(analytics.commonPhrases[0]).toEqual({ phrase: 'great product', count: 1 });
      expect(analytics.lengthDistribution.find(bucket => bucket.range === '11-25')?.count).toBe(2);
      expect(analytics.lengthDistribution.find(bucket => bucket.range === '26-50')?.count).toBe(1);
      expect(analytics.recentResponses).toHaveLength(3);
      expect(analytics.recentResponses[0]).toEqual({
        value: 'Great product experience',
        submittedAt: toDate('2024-03-01T10:00:00Z'),
        responseId: 'r1',
      });
      expect(analytics.lastUpdated).toEqual(new Date('2024-05-01T12:00:00Z'));
    });
  });

  describe('processNumberFieldAnalytics', () => {
    it('calculates statistics, distribution, and trend for numeric responses', () => {
      const fieldResponses = [
        { value: 10, submittedAt: toDate('2024-03-01T10:00:00Z'), responseId: 'r1' },
        { value: '20', submittedAt: toDate('2024-03-02T10:00:00Z'), responseId: 'r2' },
        { value: 30, submittedAt: toDate('2024-03-02T11:00:00Z'), responseId: 'r3' },
        { value: '40', submittedAt: toDate('2024-03-03T10:00:00Z'), responseId: 'r4' },
        { value: 50, submittedAt: toDate('2024-03-04T10:00:00Z'), responseId: 'r5' },
      ];

      const analytics = processNumberFieldAnalytics(fieldResponses, 'field-number', 'Score', 10);

      expect(analytics.totalResponses).toBe(5);
      expect(analytics.responseRate).toBe(50);
      expect(analytics.min).toBe(10);
      expect(analytics.max).toBe(50);
      expect(analytics.average).toBe(30);
      expect(analytics.median).toBe(30);
      expect(analytics.standardDeviation).toBeCloseTo(14.14, 2);
      expect(analytics.percentiles).toEqual({
        p25: 20,
        p50: 30,
        p75: 40,
        p90: 50,
        p95: 50,
      });
      expect(analytics.distribution).toHaveLength(5);
      expect(analytics.distribution[0]).toMatchObject({ range: '10.0-18.0', count: 1 });
      expect(analytics.distribution[4]).toMatchObject({ range: '42.0-50.0', count: 1 });
      expect(analytics.trend).toEqual([
        { date: '2024-03-01', average: 10, count: 1 },
        { date: '2024-03-02', average: 25, count: 2 },
        { date: '2024-03-03', average: 40, count: 1 },
        { date: '2024-03-04', average: 50, count: 1 },
      ]);
      expect(analytics.lastUpdated).toEqual(new Date('2024-05-01T12:00:00Z'));
    });

    it('returns zeroed analytics when no numeric responses are present', () => {
      const fieldResponses = [
        { value: 'N/A', submittedAt: toDate('2024-03-01T00:00:00Z'), responseId: 'r1' },
        { value: null, submittedAt: toDate('2024-03-02T00:00:00Z'), responseId: 'r2' },
      ];

      const analytics = processNumberFieldAnalytics(fieldResponses, 'field-number', 'Score', 4);

      expect(analytics).toMatchObject({
        totalResponses: 0,
        responseRate: 0,
        min: 0,
        max: 0,
        average: 0,
        median: 0,
        standardDeviation: 0,
        distribution: [],
        trend: [],
      });
    });
  });

  describe('processSelectionFieldAnalytics', () => {
    it('flags distributions as concentrated when one option dominates', () => {
      const responses = [
        { value: 'Option A', submittedAt: toDate('2024-03-01T10:00:00Z'), responseId: '1' },
        { value: 'Option A', submittedAt: toDate('2024-03-02T10:00:00Z'), responseId: '2' },
        { value: 'Option A', submittedAt: toDate('2024-03-03T10:00:00Z'), responseId: '3' },
        { value: 'Option A', submittedAt: toDate('2024-03-04T10:00:00Z'), responseId: '4' },
        { value: 'Option A', submittedAt: toDate('2024-03-05T10:00:00Z'), responseId: '5' },
        { value: 'Option B', submittedAt: toDate('2024-03-06T10:00:00Z'), responseId: '6' },
        { value: 'Option C', submittedAt: toDate('2024-03-07T10:00:00Z'), responseId: '7' },
      ];

      const analytics = processSelectionFieldAnalytics(responses, 'field-select', 'Selection', 10);

      expect(analytics.totalResponses).toBe(7);
      expect(analytics.responseRate).toBeCloseTo(70);
      expect(analytics.topOption).toBe('Option A');
      expect(analytics.responseDistribution).toBe('concentrated');
    });

    it('flags distributions as even when options share similar counts', () => {
      const responses = [
        { value: 'Option A', submittedAt: toDate('2024-03-01T10:00:00Z'), responseId: '1' },
        { value: 'Option B', submittedAt: toDate('2024-03-02T10:00:00Z'), responseId: '2' },
        { value: 'Option C', submittedAt: toDate('2024-03-03T10:00:00Z'), responseId: '3' },
        { value: 'Option A', submittedAt: toDate('2024-03-04T10:00:00Z'), responseId: '4' },
        { value: 'Option B', submittedAt: toDate('2024-03-05T10:00:00Z'), responseId: '5' },
        { value: 'Option C', submittedAt: toDate('2024-03-06T10:00:00Z'), responseId: '6' },
      ];

      const analytics = processSelectionFieldAnalytics(responses, 'field-select', 'Selection', 8);

      expect(analytics.responseDistribution).toBe('even');
      expect(analytics.options).toHaveLength(3);
    });

    it('flags distributions as polarized when preferences are split', () => {
      const responses = [
        { value: 'Option A', submittedAt: toDate('2024-03-01T10:00:00Z'), responseId: '1' },
        { value: 'Option A', submittedAt: toDate('2024-03-02T10:00:00Z'), responseId: '2' },
        { value: 'Option A', submittedAt: toDate('2024-03-03T10:00:00Z'), responseId: '3' },
        { value: 'Option A', submittedAt: toDate('2024-03-04T10:00:00Z'), responseId: '4' },
        { value: 'Option A', submittedAt: toDate('2024-03-05T10:00:00Z'), responseId: '5' },
        { value: 'Option B', submittedAt: toDate('2024-03-06T10:00:00Z'), responseId: '6' },
        { value: 'Option B', submittedAt: toDate('2024-03-07T10:00:00Z'), responseId: '7' },
        { value: 'Option C', submittedAt: toDate('2024-03-08T10:00:00Z'), responseId: '8' },
        { value: 'Option D', submittedAt: toDate('2024-03-09T10:00:00Z'), responseId: '9' },
      ];

      const analytics = processSelectionFieldAnalytics(responses, 'field-select', 'Selection', 9);

      expect(analytics.responseDistribution).toBe('polarized');
      expect(analytics.trend).toHaveLength(9);
    });
  });

  describe('processCheckboxFieldAnalytics', () => {
    it('extracts combinations, selection patterns, and correlations', () => {
      const responses = [
        { value: ['Option A', 'Option B'], submittedAt: toDate('2024-03-01T10:00:00Z'), responseId: '1' },
        { value: 'Option A, Option B', submittedAt: toDate('2024-03-02T10:00:00Z'), responseId: '2' },
        { value: ['Option A'], submittedAt: toDate('2024-03-03T10:00:00Z'), responseId: '3' },
        { value: ['Option A'], submittedAt: toDate('2024-03-04T10:00:00Z'), responseId: '4' },
        { value: ['Option C'], submittedAt: toDate('2024-03-05T10:00:00Z'), responseId: '5' },
      ];

      const analytics = processCheckboxFieldAnalytics(responses, 'field-checkbox', 'Choices', 8);

      expect(analytics.totalResponses).toBe(5);
      expect(analytics.responseRate).toBeCloseTo(62.5);
      expect(analytics.averageSelections).toBe(1.4);
      expect(analytics.individualOptions[0]).toMatchObject({ option: 'Option A', count: 4 });
      expect(analytics.combinations[0]).toMatchObject({
        combination: ['Option A', 'Option B'],
        count: 2,
      });
      expect(analytics.selectionDistribution).toEqual([
        { selectionCount: 1, responseCount: 3, percentage: 60 },
        { selectionCount: 2, responseCount: 2, percentage: 40 },
      ]);
      expect(analytics.correlations[0]).toMatchObject({
        option1: 'Option A',
        option2: 'Option B',
      });
      expect(analytics.lastUpdated).toEqual(new Date('2024-05-01T12:00:00Z'));
    });
  });

  describe('processDateFieldAnalytics', () => {
    it('summarises temporal distributions for valid dates', () => {
      const responses = [
        { value: '2024-03-01', submittedAt: toDate('2024-03-02T10:00:00Z'), responseId: '1' },
        { value: '2024-03-02', submittedAt: toDate('2024-03-03T10:00:00Z'), responseId: '2' },
        { value: 'invalid', submittedAt: toDate('2024-03-04T10:00:00Z'), responseId: '3' },
        { value: '2024-04-15', submittedAt: toDate('2024-04-16T10:00:00Z'), responseId: '4' },
        { value: '2024-03-02', submittedAt: toDate('2024-03-05T10:00:00Z'), responseId: '5' },
      ];

      const analytics = processDateFieldAnalytics(responses, 'field-date', 'Event Date', 5);

      expect(analytics.totalResponses).toBe(4);
      expect(analytics.responseRate).toBe(80);
      expect(analytics.earliestDate.toISOString()).toBe('2024-03-01T00:00:00.000Z');
      expect(analytics.latestDate.toISOString()).toBe('2024-04-15T00:00:00.000Z');
      expect(analytics.mostCommonDate.toISOString()).toBe('2024-03-02T00:00:00.000Z');
      expect(analytics.weekdayDistribution.find(day => day.weekday === 'Friday')?.count).toBe(1);
      expect(analytics.weekdayDistribution.find(day => day.weekday === 'Saturday')?.count).toBe(2);
      expect(analytics.monthlyDistribution.find(month => month.month === 'March')?.count).toBe(3);
      expect(analytics.seasonalPatterns.find(season => season.season === 'Spring')?.count).toBe(4);
      expect(analytics.lastUpdated).toEqual(new Date('2024-05-01T12:00:00Z'));
    });

    it('returns defaults when no valid dates are provided', () => {
      const responses = [
        { value: 'invalid', submittedAt: toDate('2024-03-01T00:00:00Z'), responseId: '1' },
      ];

      const analytics = processDateFieldAnalytics(responses, 'field-date', 'Event Date', 2);

      expect(analytics.totalResponses).toBe(0);
      expect(analytics.responseRate).toBe(0);
      expect(analytics.dateDistribution).toEqual([]);
    });

    it('correctly categorizes dates into all four seasons', () => {
      const responses = [
        { value: '2024-06-15', submittedAt: toDate('2024-06-16T10:00:00Z'), responseId: '1' }, // Summer
        { value: '2024-09-15', submittedAt: toDate('2024-09-16T10:00:00Z'), responseId: '2' }, // Fall
        { value: '2024-12-15', submittedAt: toDate('2024-12-16T10:00:00Z'), responseId: '3' }, // Winter
        { value: '2024-01-15', submittedAt: toDate('2024-01-16T10:00:00Z'), responseId: '4' }, // Winter
      ];

      const analytics = processDateFieldAnalytics(responses, 'field-date', 'Event Date', 4);

      expect(analytics.seasonalPatterns.find(s => s.season === 'Summer')?.count).toBe(1);
      expect(analytics.seasonalPatterns.find(s => s.season === 'Fall')?.count).toBe(1);
      expect(analytics.seasonalPatterns.find(s => s.season === 'Winter')?.count).toBe(2);
    });
  });

  describe('processEmailFieldAnalytics', () => {
    it('evaluates validation, domain breakdown, and provider popularity', () => {
      const responses = [
        { value: 'first@gmail.com', submittedAt: toDate('2024-03-01T00:00:00Z'), responseId: '1' },
        { value: 'employee1@company.com', submittedAt: toDate('2024-03-02T00:00:00Z'), responseId: '2' },
        { value: 'employee2@company.com', submittedAt: toDate('2024-03-03T00:00:00Z'), responseId: '3' },
        { value: 'employee3@company.com', submittedAt: toDate('2024-03-04T00:00:00Z'), responseId: '4' },
        { value: 'invalid-email', submittedAt: toDate('2024-03-05T00:00:00Z'), responseId: '5' },
        { value: 'second@yahoo.com', submittedAt: toDate('2024-03-06T00:00:00Z'), responseId: '6' },
        { value: 'author@unknown.org', submittedAt: toDate('2024-03-07T00:00:00Z'), responseId: '7' },
      ];

      const analytics = processEmailFieldAnalytics(responses, 'field-email', 'Email', 14);

      expect(analytics.totalResponses).toBe(7);
      expect(analytics.responseRate).toBe(50);
      expect(analytics.validEmails).toBe(6);
      expect(analytics.invalidEmails).toBe(1);
      expect(analytics.validationRate).toBe(85.71);
      expect(analytics.domains.find(domain => domain.domain === 'company.com')?.count).toBe(3);
      expect(analytics.topLevelDomains.find(tld => tld.tld === 'com')?.count).toBe(5);
      expect(analytics.popularProviders.map(provider => provider.provider)).toEqual(['gmail', 'yahoo']);
      expect(analytics.corporateVsPersonal).toEqual({ corporate: 3, personal: 2, unknown: 1 });
      expect(analytics.lastUpdated).toEqual(new Date('2024-05-01T12:00:00Z'));
    });
  });

  describe('getFieldAnalytics', () => {
    it('routes to text analytics for text fields', async () => {
      const submittedAt = new Date('2024-04-01T10:00:00Z');
      vi.mocked(responseRepository.listByForm).mockResolvedValue([
        { id: 'resp-1', data: { fieldA: 'Hello world' }, submittedAt },
        { id: 'resp-2', data: { fieldA: '' }, submittedAt },
      ] as any);

      const result = await getFieldAnalytics('form-123', 'fieldA', FieldType.TEXT_AREA_FIELD, 'Comments');

      expect(responseRepository.listByForm).toHaveBeenCalledWith('form-123');
      expect(result.fieldType).toBe(FieldType.TEXT_AREA_FIELD);
      expect(result.totalResponses).toBe(1);
      expect(result.responseRate).toBe(50);
    });

    it('routes to number analytics for numeric fields', async () => {
      vi.mocked(responseRepository.listByForm).mockResolvedValue([
        { id: 'resp-1', data: { fieldA: 10 }, submittedAt: new Date('2024-04-01T00:00:00Z') },
        { id: 'resp-2', data: { fieldA: 20 }, submittedAt: new Date('2024-04-02T00:00:00Z') },
      ] as any);

      const result = await getFieldAnalytics('form-123', 'fieldA', FieldType.NUMBER_FIELD, 'Score');

      expect(result.fieldType).toBe(FieldType.NUMBER_FIELD);
      if (result.fieldType !== FieldType.NUMBER_FIELD) {
        throw new Error('Expected numeric field analytics');
      }
      expect(result.totalResponses).toBe(2);
      expect(result.average).toBe(15);
    });

    it('routes to checkbox analytics for checkbox fields', async () => {
      vi.mocked(responseRepository.listByForm).mockResolvedValue([
        { id: 'resp-1', data: { fieldA: ['Option A'] }, submittedAt: new Date('2024-04-01T00:00:00Z') },
        { id: 'resp-2', data: { fieldA: ['Option A', 'Option B'] }, submittedAt: new Date('2024-04-02T00:00:00Z') },
      ] as any);

      const result = await getFieldAnalytics('form-123', 'fieldA', FieldType.CHECKBOX_FIELD, 'Choices');

      expect(result.fieldType).toBe(FieldType.CHECKBOX_FIELD);
      if (result.fieldType !== FieldType.CHECKBOX_FIELD) {
        throw new Error('Expected checkbox field analytics');
      }
      expect(result.totalResponses).toBe(2);
    });

    it('routes to selection analytics for select fields', async () => {
      vi.mocked(responseRepository.listByForm).mockResolvedValue([
        { id: 'resp-1', data: { fieldA: 'Option A' }, submittedAt: new Date('2024-04-01T00:00:00Z') },
        { id: 'resp-2', data: { fieldA: 'Option B' }, submittedAt: new Date('2024-04-02T00:00:00Z') },
      ] as any);

      const result = await getFieldAnalytics('form-123', 'fieldA', FieldType.SELECT_FIELD, 'Select');

      expect(result.fieldType).toBe(FieldType.SELECT_FIELD);
      expect(result.totalResponses).toBe(2);
    });

    it('routes to selection analytics for radio fields', async () => {
      vi.mocked(responseRepository.listByForm).mockResolvedValue([
        { id: 'resp-1', data: { fieldA: 'Option A' }, submittedAt: new Date('2024-04-01T00:00:00Z') },
        { id: 'resp-2', data: { fieldA: 'Option B' }, submittedAt: new Date('2024-04-02T00:00:00Z') },
      ] as any);

      const result = await getFieldAnalytics('form-123', 'fieldA', FieldType.RADIO_FIELD, 'Radio');

      expect(result.fieldType).toBe(FieldType.RADIO_FIELD);
      expect(result.totalResponses).toBe(2);
    });

    it('routes to date analytics for date fields', async () => {
      vi.mocked(responseRepository.listByForm).mockResolvedValue([
        { id: 'resp-1', data: { fieldA: '2024-04-01' }, submittedAt: new Date('2024-04-01T00:00:00Z') },
        { id: 'resp-2', data: { fieldA: '2024-04-02' }, submittedAt: new Date('2024-04-02T00:00:00Z') },
      ] as any);

      const result = await getFieldAnalytics('form-123', 'fieldA', FieldType.DATE_FIELD, 'Date');

      expect(result.fieldType).toBe(FieldType.DATE_FIELD);
      expect(result.totalResponses).toBe(2);
    });

    it('throws for unsupported field types', async () => {
      vi.mocked(responseRepository.listByForm).mockResolvedValue([] as any);

      await expect(
        getFieldAnalytics('form-123', 'fieldA', FieldType.RICH_TEXT_FIELD, 'Unsupported')
      ).rejects.toThrow('Unsupported field type: rich_text_field');
    });
  });

  describe('getAllFieldsAnalytics', () => {
    const sampleResponses = [
      {
        id: 'resp-1',
        data: { textField: 'Hello', numberField: 10 },
        submittedAt: new Date('2024-04-01T10:00:00Z'),
      },
      {
        id: 'resp-2',
        data: { textField: 'World', numberField: 20 },
        submittedAt: new Date('2024-04-02T11:00:00Z'),
      },
    ];

    it('derives analytics for all fillable fields using YJS schema', async () => {
      vi.mocked(formRepository.findUnique).mockResolvedValue({
        formSchema: {},
      } as any);
      vi.mocked(getFormSchemaFromHocuspocus).mockResolvedValue({
        pages: [
          {
            fields: [
              { id: 'textField', type: FieldType.TEXT_INPUT_FIELD, label: 'Text field' },
              { id: 'numberField', type: FieldType.NUMBER_FIELD, label: 'Number field' },
              { id: 'staticField', type: FieldType.RICH_TEXT_FIELD, label: 'Ignored' },
            ],
          },
        ],
      });
      vi.mocked(responseRepository.listByForm).mockResolvedValue(sampleResponses as any);

      const result = await getAllFieldsAnalytics('form-123');

      expect(formRepository.findUnique).toHaveBeenCalledWith({
        where: { id: 'form-123' },
        select: { formSchema: true },
      });
      expect(getFormSchemaFromHocuspocus).toHaveBeenCalledWith('form-123');
      expect(result.formId).toBe('form-123');
      expect(result.totalResponses).toBe(2);
      expect(result.fields).toHaveLength(2);
      expect(result.fields[0]).toMatchObject({
        fieldId: 'textField',
        fieldType: FieldType.TEXT_INPUT_FIELD,
        totalResponses: 2,
      });
      expect(result.fields[1]).toMatchObject({
        fieldId: 'numberField',
        fieldType: FieldType.NUMBER_FIELD,
        totalResponses: 2,
      });
    });

    it('falls back to stored schema when collaborative document is unavailable', async () => {
      vi.mocked(formRepository.findUnique).mockResolvedValue({
        formSchema: {
          pages: [
            {
              fields: [
                { id: 'emailField', type: FieldType.EMAIL_FIELD, label: 'Email' },
              ],
            },
          ],
        },
      } as any);
      vi.mocked(getFormSchemaFromHocuspocus).mockResolvedValue(null);
      vi.mocked(responseRepository.listByForm).mockResolvedValue([
        {
          id: 'resp-1',
          data: { emailField: 'first@example.com' },
          submittedAt: new Date('2024-04-01T10:00:00Z'),
        },
      ] as any);

      const result = await getAllFieldsAnalytics('form-456');

      expect(result.fields[0].fieldType).toBe(FieldType.EMAIL_FIELD);
      expect(result.totalResponses).toBe(1);
    });

    it('returns empty analytics when schema is missing', async () => {
      vi.mocked(formRepository.findUnique).mockResolvedValue({
        formSchema: {},
      } as any);
      vi.mocked(getFormSchemaFromHocuspocus).mockResolvedValue(null);
      vi.mocked(responseRepository.listByForm).mockResolvedValue([] as any);

      const result = await getAllFieldsAnalytics('form-empty');

      expect(result).toEqual({
        formId: 'form-empty',
        totalResponses: 0,
        fields: [],
      });
    });

    it('throws when form cannot be located', async () => {
      vi.mocked(formRepository.findUnique).mockResolvedValue(null);

      await expect(getAllFieldsAnalytics('missing-form')).rejects.toThrow('Form not found: missing-form');
    });
  });
});
