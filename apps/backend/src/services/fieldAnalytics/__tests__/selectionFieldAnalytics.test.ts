import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FieldType } from '@dculus/types';
import { processSelectionFieldAnalytics } from '../selectionFieldAnalytics.js';
import type { FieldResponse } from '../types.js';

describe('fieldAnalytics/selectionFieldAnalytics', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-05-01T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const toDate = (value: string) => new Date(value);

  describe('processSelectionFieldAnalytics', () => {
    it('should calculate basic selection statistics', () => {
      const fieldResponses: FieldResponse[] = [
        { value: 'Option A', submittedAt: toDate('2024-01-01T10:00:00Z'), responseId: 'r1' },
        { value: 'Option B', submittedAt: toDate('2024-01-02T10:00:00Z'), responseId: 'r2' },
        { value: 'Option A', submittedAt: toDate('2024-01-03T10:00:00Z'), responseId: 'r3' },
      ];

      const result = processSelectionFieldAnalytics(fieldResponses, 'field-1', 'Selection', 10);

      expect(result.fieldId).toBe('field-1');
      expect(result.fieldLabel).toBe('Selection');
      expect(result.fieldType).toBe(FieldType.SELECT_FIELD);
      expect(result.totalResponses).toBe(3);
      expect(result.responseRate).toBe(30);
    });

    it('should count option frequencies correctly', () => {
      const fieldResponses: FieldResponse[] = [
        { value: 'Option A', submittedAt: toDate('2024-01-01T10:00:00Z'), responseId: 'r1' },
        { value: 'Option A', submittedAt: toDate('2024-01-02T10:00:00Z'), responseId: 'r2' },
        { value: 'Option B', submittedAt: toDate('2024-01-03T10:00:00Z'), responseId: 'r3' },
        { value: 'Option C', submittedAt: toDate('2024-01-04T10:00:00Z'), responseId: 'r4' },
      ];

      const result = processSelectionFieldAnalytics(fieldResponses, 'field-1', 'Selection', 10);

      expect(result.options).toBeDefined();
      expect(result.options[0]).toEqual({ option: 'Option A', count: 2, percentage: 50 });
      expect(result.options[1]).toEqual({ option: 'Option B', count: 1, percentage: 25 });
      expect(result.options[2]).toEqual({ option: 'Option C', count: 1, percentage: 25 });
    });

    it('should sort options by count descending', () => {
      const fieldResponses: FieldResponse[] = [
        { value: 'Option C', submittedAt: toDate('2024-01-01T10:00:00Z'), responseId: 'r1' },
        { value: 'Option A', submittedAt: toDate('2024-01-02T10:00:00Z'), responseId: 'r2' },
        { value: 'Option B', submittedAt: toDate('2024-01-03T10:00:00Z'), responseId: 'r3' },
        { value: 'Option B', submittedAt: toDate('2024-01-04T10:00:00Z'), responseId: 'r4' },
        { value: 'Option B', submittedAt: toDate('2024-01-05T10:00:00Z'), responseId: 'r5' },
        { value: 'Option A', submittedAt: toDate('2024-01-06T10:00:00Z'), responseId: 'r6' },
      ];

      const result = processSelectionFieldAnalytics(fieldResponses, 'field-1', 'Selection', 10);

      expect(result.options[0].option).toBe('Option B');
      expect(result.options[0].count).toBe(3);
      expect(result.options[1].option).toBe('Option A');
      expect(result.options[1].count).toBe(2);
      expect(result.options[2].option).toBe('Option C');
      expect(result.options[2].count).toBe(1);
    });

    it('should identify top option', () => {
      const fieldResponses: FieldResponse[] = [
        { value: 'Option A', submittedAt: toDate('2024-01-01T10:00:00Z'), responseId: 'r1' },
        { value: 'Option A', submittedAt: toDate('2024-01-02T10:00:00Z'), responseId: 'r2' },
        { value: 'Option A', submittedAt: toDate('2024-01-03T10:00:00Z'), responseId: 'r3' },
        { value: 'Option B', submittedAt: toDate('2024-01-04T10:00:00Z'), responseId: 'r4' },
      ];

      const result = processSelectionFieldAnalytics(fieldResponses, 'field-1', 'Selection', 10);

      expect(result.topOption).toBe('Option A');
    });

    it('should detect concentrated distribution (>70% for one option)', () => {
      const fieldResponses: FieldResponse[] = [
        { value: 'Option A', submittedAt: toDate('2024-01-01T10:00:00Z'), responseId: 'r1' },
        { value: 'Option A', submittedAt: toDate('2024-01-02T10:00:00Z'), responseId: 'r2' },
        { value: 'Option A', submittedAt: toDate('2024-01-03T10:00:00Z'), responseId: 'r3' },
        { value: 'Option A', submittedAt: toDate('2024-01-04T10:00:00Z'), responseId: 'r4' },
        { value: 'Option A', submittedAt: toDate('2024-01-05T10:00:00Z'), responseId: 'r5' },
        { value: 'Option A', submittedAt: toDate('2024-01-06T10:00:00Z'), responseId: 'r6' },
        { value: 'Option A', submittedAt: toDate('2024-01-07T10:00:00Z'), responseId: 'r7' },
        { value: 'Option A', submittedAt: toDate('2024-01-08T10:00:00Z'), responseId: 'r8' },
        { value: 'Option B', submittedAt: toDate('2024-01-09T10:00:00Z'), responseId: 'r9' },
        { value: 'Option C', submittedAt: toDate('2024-01-10T10:00:00Z'), responseId: 'r10' },
      ];

      const result = processSelectionFieldAnalytics(fieldResponses, 'field-1', 'Selection', 15);

      expect(result.responseDistribution).toBe('concentrated');
    });

    it('should detect even distribution', () => {
      const fieldResponses: FieldResponse[] = [
        { value: 'Option A', submittedAt: toDate('2024-01-01T10:00:00Z'), responseId: 'r1' },
        { value: 'Option A', submittedAt: toDate('2024-01-02T10:00:00Z'), responseId: 'r2' },
        { value: 'Option B', submittedAt: toDate('2024-01-03T10:00:00Z'), responseId: 'r3' },
        { value: 'Option B', submittedAt: toDate('2024-01-04T10:00:00Z'), responseId: 'r4' },
        { value: 'Option C', submittedAt: toDate('2024-01-05T10:00:00Z'), responseId: 'r5' },
        { value: 'Option C', submittedAt: toDate('2024-01-06T10:00:00Z'), responseId: 'r6' },
      ];

      const result = processSelectionFieldAnalytics(fieldResponses, 'field-1', 'Selection', 10);

      expect(result.responseDistribution).toBe('even');
    });

    it('should detect polarized distribution', () => {
      const fieldResponses: FieldResponse[] = [
        { value: 'Option A', submittedAt: toDate('2024-01-01T10:00:00Z'), responseId: 'r1' },
        { value: 'Option A', submittedAt: toDate('2024-01-02T10:00:00Z'), responseId: 'r2' },
        { value: 'Option A', submittedAt: toDate('2024-01-03T10:00:00Z'), responseId: 'r3' },
        { value: 'Option A', submittedAt: toDate('2024-01-04T10:00:00Z'), responseId: 'r4' },
        { value: 'Option B', submittedAt: toDate('2024-01-05T10:00:00Z'), responseId: 'r5' },
        { value: 'Option B', submittedAt: toDate('2024-01-06T10:00:00Z'), responseId: 'r6' },
        { value: 'Option C', submittedAt: toDate('2024-01-07T10:00:00Z'), responseId: 'r7' },
        { value: 'Option D', submittedAt: toDate('2024-01-08T10:00:00Z'), responseId: 'r8' },
      ];

      const result = processSelectionFieldAnalytics(fieldResponses, 'field-1', 'Selection', 10);

      expect(result.responseDistribution).toBe('polarized');
    });

    it('should generate trend data grouped by date', () => {
      const fieldResponses: FieldResponse[] = [
        { value: 'Option A', submittedAt: toDate('2024-01-01T10:00:00Z'), responseId: 'r1' },
        { value: 'Option B', submittedAt: toDate('2024-01-01T11:00:00Z'), responseId: 'r2' },
        { value: 'Option A', submittedAt: toDate('2024-01-02T10:00:00Z'), responseId: 'r3' },
        { value: 'Option C', submittedAt: toDate('2024-01-03T10:00:00Z'), responseId: 'r4' },
      ];

      const result = processSelectionFieldAnalytics(fieldResponses, 'field-1', 'Selection', 10);

      expect(result.trend).toBeDefined();
      expect(result.trend).toHaveLength(3);
      expect(result.trend[0].date).toBe('2024-01-01');
      expect(result.trend[0].options).toHaveLength(2);
      expect(result.trend[0].options).toContainEqual({ option: 'Option A', count: 1 });
      expect(result.trend[0].options).toContainEqual({ option: 'Option B', count: 1 });
    });

    it('should sort trend data by date', () => {
      const fieldResponses: FieldResponse[] = [
        { value: 'Option A', submittedAt: toDate('2024-01-03T10:00:00Z'), responseId: 'r1' },
        { value: 'Option B', submittedAt: toDate('2024-01-01T10:00:00Z'), responseId: 'r2' },
        { value: 'Option C', submittedAt: toDate('2024-01-02T10:00:00Z'), responseId: 'r3' },
      ];

      const result = processSelectionFieldAnalytics(fieldResponses, 'field-1', 'Selection', 10);

      expect(result.trend[0].date).toBe('2024-01-01');
      expect(result.trend[1].date).toBe('2024-01-02');
      expect(result.trend[2].date).toBe('2024-01-03');
    });

    it('should trim whitespace from values', () => {
      const fieldResponses: FieldResponse[] = [
        { value: '  Option A  ', submittedAt: toDate('2024-01-01T10:00:00Z'), responseId: 'r1' },
        { value: 'Option A', submittedAt: toDate('2024-01-02T10:00:00Z'), responseId: 'r2' },
        { value: '\tOption A\n', submittedAt: toDate('2024-01-03T10:00:00Z'), responseId: 'r3' },
      ];

      const result = processSelectionFieldAnalytics(fieldResponses, 'field-1', 'Selection', 10);

      expect(result.options[0].option).toBe('Option A');
      expect(result.options[0].count).toBe(3);
    });

    it('should filter out empty values', () => {
      const fieldResponses: FieldResponse[] = [
        { value: 'Option A', submittedAt: toDate('2024-01-01T10:00:00Z'), responseId: 'r1' },
        { value: '', submittedAt: toDate('2024-01-02T10:00:00Z'), responseId: 'r2' },
        { value: '   ', submittedAt: toDate('2024-01-03T10:00:00Z'), responseId: 'r3' },
        { value: 'Option B', submittedAt: toDate('2024-01-04T10:00:00Z'), responseId: 'r4' },
      ];

      const result = processSelectionFieldAnalytics(fieldResponses, 'field-1', 'Selection', 10);

      expect(result.totalResponses).toBe(2);
      expect(result.options).toHaveLength(2);
    });

    it('should handle empty responses', () => {
      const result = processSelectionFieldAnalytics([], 'field-1', 'Selection', 5);

      expect(result.totalResponses).toBe(0);
      expect(result.responseRate).toBe(0);
      expect(result.options).toEqual([]);
      expect(result.topOption).toBe('');
      expect(result.trend).toEqual([]);
    });

    it('should handle single option', () => {
      const fieldResponses: FieldResponse[] = [
        { value: 'Option A', submittedAt: toDate('2024-01-01T10:00:00Z'), responseId: 'r1' },
        { value: 'Option A', submittedAt: toDate('2024-01-02T10:00:00Z'), responseId: 'r2' },
      ];

      const result = processSelectionFieldAnalytics(fieldResponses, 'field-1', 'Selection', 5);

      expect(result.options).toHaveLength(1);
      expect(result.options[0].percentage).toBe(100);
      expect(result.responseDistribution).toBe('concentrated');
    });

    it('should calculate percentages correctly', () => {
      const fieldResponses: FieldResponse[] = [
        { value: 'Option A', submittedAt: toDate('2024-01-01T10:00:00Z'), responseId: 'r1' },
        { value: 'Option A', submittedAt: toDate('2024-01-02T10:00:00Z'), responseId: 'r2' },
        { value: 'Option A', submittedAt: toDate('2024-01-03T10:00:00Z'), responseId: 'r3' },
        { value: 'Option B', submittedAt: toDate('2024-01-04T10:00:00Z'), responseId: 'r4' },
      ];

      const result = processSelectionFieldAnalytics(fieldResponses, 'field-1', 'Selection', 10);

      expect(result.options[0].percentage).toBe(75);
      expect(result.options[1].percentage).toBe(25);

      const totalPercentage = result.options.reduce((sum, opt) => sum + opt.percentage, 0);
      expect(totalPercentage).toBe(100);
    });

    it('should set lastUpdated to current time', () => {
      const fieldResponses: FieldResponse[] = [
        { value: 'Option A', submittedAt: toDate('2024-01-01T10:00:00Z'), responseId: 'r1' },
      ];

      const result = processSelectionFieldAnalytics(fieldResponses, 'field-1', 'Selection', 5);

      expect(result.lastUpdated).toEqual(new Date('2024-05-01T12:00:00Z'));
    });

    it('should handle numeric values', () => {
      const fieldResponses: FieldResponse[] = [
        { value: 1, submittedAt: toDate('2024-01-01T10:00:00Z'), responseId: 'r1' },
        { value: 2, submittedAt: toDate('2024-01-02T10:00:00Z'), responseId: 'r2' },
        { value: 1, submittedAt: toDate('2024-01-03T10:00:00Z'), responseId: 'r3' },
      ];

      const result = processSelectionFieldAnalytics(fieldResponses, 'field-1', 'Selection', 10);

      expect(result.options[0].option).toBe('1');
      expect(result.options[0].count).toBe(2);
      expect(result.options[1].option).toBe('2');
      expect(result.options[1].count).toBe(1);
    });

    it('should handle boolean values', () => {
      const fieldResponses: FieldResponse[] = [
        { value: true, submittedAt: toDate('2024-01-01T10:00:00Z'), responseId: 'r1' },
        { value: false, submittedAt: toDate('2024-01-02T10:00:00Z'), responseId: 'r2' },
        { value: true, submittedAt: toDate('2024-01-03T10:00:00Z'), responseId: 'r3' },
      ];

      const result = processSelectionFieldAnalytics(fieldResponses, 'field-1', 'Selection', 10);

      // Note: false is falsy so (false || '') becomes '', and gets filtered out
      expect(result.totalResponses).toBe(2);
      expect(result.options[0].option).toBe('true');
      expect(result.options[0].count).toBe(2);
      expect(result.options).toHaveLength(1);
    });

    it('should handle null values by converting to string', () => {
      const fieldResponses: FieldResponse[] = [
        { value: null, submittedAt: toDate('2024-01-01T10:00:00Z'), responseId: 'r1' },
        { value: 'Option A', submittedAt: toDate('2024-01-02T10:00:00Z'), responseId: 'r2' },
      ];

      const result = processSelectionFieldAnalytics(fieldResponses, 'field-1', 'Selection', 10);

      // null gets converted to '' and filtered out
      expect(result.totalResponses).toBe(1);
      expect(result.options).toHaveLength(1);
    });

    it('should handle single response', () => {
      const fieldResponses: FieldResponse[] = [
        { value: 'Option A', submittedAt: toDate('2024-01-01T10:00:00Z'), responseId: 'r1' },
      ];

      const result = processSelectionFieldAnalytics(fieldResponses, 'field-1', 'Selection', 5);

      expect(result.totalResponses).toBe(1);
      expect(result.options[0].percentage).toBe(100);
      expect(result.topOption).toBe('Option A');
      expect(result.responseDistribution).toBe('concentrated');
    });

    it('should count option frequencies in trend correctly', () => {
      const fieldResponses: FieldResponse[] = [
        { value: 'Option A', submittedAt: toDate('2024-01-01T10:00:00Z'), responseId: 'r1' },
        { value: 'Option A', submittedAt: toDate('2024-01-01T11:00:00Z'), responseId: 'r2' },
        { value: 'Option B', submittedAt: toDate('2024-01-01T12:00:00Z'), responseId: 'r3' },
      ];

      const result = processSelectionFieldAnalytics(fieldResponses, 'field-1', 'Selection', 10);

      expect(result.trend[0].options).toContainEqual({ option: 'Option A', count: 2 });
      expect(result.trend[0].options).toContainEqual({ option: 'Option B', count: 1 });
    });

    it('should handle responses with special characters', () => {
      const fieldResponses: FieldResponse[] = [
        { value: 'Option A & B', submittedAt: toDate('2024-01-01T10:00:00Z'), responseId: 'r1' },
        { value: 'Option A & B', submittedAt: toDate('2024-01-02T10:00:00Z'), responseId: 'r2' },
        { value: 'Option C/D', submittedAt: toDate('2024-01-03T10:00:00Z'), responseId: 'r3' },
      ];

      const result = processSelectionFieldAnalytics(fieldResponses, 'field-1', 'Selection', 10);

      expect(result.options[0].option).toBe('Option A & B');
      expect(result.options[0].count).toBe(2);
      expect(result.options[1].option).toBe('Option C/D');
    });

    it('should handle responses with unicode characters', () => {
      const fieldResponses: FieldResponse[] = [
        { value: 'Opción A', submittedAt: toDate('2024-01-01T10:00:00Z'), responseId: 'r1' },
        { value: 'Opción A', submittedAt: toDate('2024-01-02T10:00:00Z'), responseId: 'r2' },
        { value: '选项 B', submittedAt: toDate('2024-01-03T10:00:00Z'), responseId: 'r3' },
      ];

      const result = processSelectionFieldAnalytics(fieldResponses, 'field-1', 'Selection', 10);

      expect(result.options[0].option).toBe('Opción A');
      expect(result.options[0].count).toBe(2);
      expect(result.options[1].option).toBe('选项 B');
    });

    it('should handle very long option names', () => {
      const longOption = 'A'.repeat(1000);
      const fieldResponses: FieldResponse[] = [
        { value: longOption, submittedAt: toDate('2024-01-01T10:00:00Z'), responseId: 'r1' },
        { value: longOption, submittedAt: toDate('2024-01-02T10:00:00Z'), responseId: 'r2' },
      ];

      const result = processSelectionFieldAnalytics(fieldResponses, 'field-1', 'Selection', 10);

      expect(result.options[0].option).toBe(longOption);
      expect(result.options[0].count).toBe(2);
    });

    it('should return empty string as topOption when no responses', () => {
      const result = processSelectionFieldAnalytics([], 'field-1', 'Selection', 5);

      expect(result.topOption).toBe('');
    });

    it('should classify single option as concentrated', () => {
      const fieldResponses: FieldResponse[] = [
        { value: 'Option A', submittedAt: toDate('2024-01-01T10:00:00Z'), responseId: 'r1' },
      ];

      const result = processSelectionFieldAnalytics(fieldResponses, 'field-1', 'Selection', 5);

      expect(result.responseDistribution).toBe('concentrated');
    });
  });
});
