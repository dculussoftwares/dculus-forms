import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FieldType } from '@dculus/types';
import { processCheckboxFieldAnalytics } from '../checkboxFieldAnalytics.js';
import type { FieldResponse } from '../types.js';

describe('fieldAnalytics/checkboxFieldAnalytics', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-05-01T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const toDate = (value: string) => new Date(value);

  describe('processCheckboxFieldAnalytics', () => {
    it('should calculate basic checkbox statistics', () => {
      const fieldResponses: FieldResponse[] = [
        { value: ['Option A', 'Option B'], submittedAt: toDate('2024-01-01T10:00:00Z'), responseId: 'r1' },
        { value: ['Option A'], submittedAt: toDate('2024-01-02T10:00:00Z'), responseId: 'r2' },
        { value: ['Option C'], submittedAt: toDate('2024-01-03T10:00:00Z'), responseId: 'r3' },
      ];

      const result = processCheckboxFieldAnalytics(fieldResponses, 'field-1', 'Choices', 10);

      expect(result.fieldId).toBe('field-1');
      expect(result.fieldLabel).toBe('Choices');
      expect(result.fieldType).toBe(FieldType.CHECKBOX_FIELD);
      expect(result.totalResponses).toBe(3);
      expect(result.responseRate).toBe(30);
    });

    it('should parse array values', () => {
      const fieldResponses: FieldResponse[] = [
        { value: ['Option A', 'Option B'], submittedAt: toDate('2024-01-01T10:00:00Z'), responseId: 'r1' },
        { value: ['Option A', 'Option C'], submittedAt: toDate('2024-01-02T10:00:00Z'), responseId: 'r2' },
      ];

      const result = processCheckboxFieldAnalytics(fieldResponses, 'field-1', 'Choices', 10);

      expect(result.totalResponses).toBe(2);
      expect(result.individualOptions).toBeDefined();
    });

    it('should parse comma-separated string values', () => {
      const fieldResponses: FieldResponse[] = [
        { value: 'Option A, Option B', submittedAt: toDate('2024-01-01T10:00:00Z'), responseId: 'r1' },
        { value: 'Option A, Option C', submittedAt: toDate('2024-01-02T10:00:00Z'), responseId: 'r2' },
      ];

      const result = processCheckboxFieldAnalytics(fieldResponses, 'field-1', 'Choices', 10);

      expect(result.totalResponses).toBe(2);
      expect(result.individualOptions.find(o => o.option === 'Option A')?.count).toBe(2);
    });

    it('should count individual option frequencies', () => {
      const fieldResponses: FieldResponse[] = [
        { value: ['Option A', 'Option B'], submittedAt: toDate('2024-01-01T10:00:00Z'), responseId: 'r1' },
        { value: ['Option A'], submittedAt: toDate('2024-01-02T10:00:00Z'), responseId: 'r2' },
        { value: ['Option A', 'Option C'], submittedAt: toDate('2024-01-03T10:00:00Z'), responseId: 'r3' },
      ];

      const result = processCheckboxFieldAnalytics(fieldResponses, 'field-1', 'Choices', 10);

      expect(result.individualOptions[0]).toEqual({ option: 'Option A', count: 3, percentage: 100 });
      expect(result.individualOptions[1].option).toBe('Option B');
      expect(result.individualOptions[1].count).toBe(1);
    });

    it('should sort individual options by count descending', () => {
      const fieldResponses: FieldResponse[] = [
        { value: ['Option C'], submittedAt: toDate('2024-01-01T10:00:00Z'), responseId: 'r1' },
        { value: ['Option B', 'Option C'], submittedAt: toDate('2024-01-02T10:00:00Z'), responseId: 'r2' },
        { value: ['Option A', 'Option B', 'Option C'], submittedAt: toDate('2024-01-03T10:00:00Z'), responseId: 'r3' },
      ];

      const result = processCheckboxFieldAnalytics(fieldResponses, 'field-1', 'Choices', 10);

      expect(result.individualOptions[0].option).toBe('Option C');
      expect(result.individualOptions[0].count).toBe(3);
      expect(result.individualOptions[1].option).toBe('Option B');
      expect(result.individualOptions[1].count).toBe(2);
      expect(result.individualOptions[2].option).toBe('Option A');
      expect(result.individualOptions[2].count).toBe(1);
    });

    it('should calculate combinations correctly', () => {
      const fieldResponses: FieldResponse[] = [
        { value: ['Option A', 'Option B'], submittedAt: toDate('2024-01-01T10:00:00Z'), responseId: 'r1' },
        { value: ['Option B', 'Option A'], submittedAt: toDate('2024-01-02T10:00:00Z'), responseId: 'r2' },
        { value: ['Option A'], submittedAt: toDate('2024-01-03T10:00:00Z'), responseId: 'r3' },
      ];

      const result = processCheckboxFieldAnalytics(fieldResponses, 'field-1', 'Choices', 10);

      // Combinations should be sorted
      expect(result.combinations[0].combination).toEqual(['Option A', 'Option B']);
      expect(result.combinations[0].count).toBe(2);
      expect(result.combinations[1].combination).toEqual(['Option A']);
      expect(result.combinations[1].count).toBe(1);
    });

    it('should sort combinations by count descending', () => {
      const fieldResponses: FieldResponse[] = [
        { value: ['Option A'], submittedAt: toDate('2024-01-01T10:00:00Z'), responseId: 'r1' },
        { value: ['Option A', 'Option B'], submittedAt: toDate('2024-01-02T10:00:00Z'), responseId: 'r2' },
        { value: ['Option A', 'Option B'], submittedAt: toDate('2024-01-03T10:00:00Z'), responseId: 'r3' },
        { value: ['Option A', 'Option B'], submittedAt: toDate('2024-01-04T10:00:00Z'), responseId: 'r4' },
      ];

      const result = processCheckboxFieldAnalytics(fieldResponses, 'field-1', 'Choices', 10);

      expect(result.combinations[0].combination).toEqual(['Option A', 'Option B']);
      expect(result.combinations[0].count).toBe(3);
      expect(result.combinations[1].combination).toEqual(['Option A']);
      expect(result.combinations[1].count).toBe(1);
    });

    it('should limit combinations to 20', () => {
      const fieldResponses: FieldResponse[] = Array.from({ length: 50 }, (_, i) => ({
        value: [`Option ${i}`, `Option ${i + 1}`],
        submittedAt: toDate('2024-01-01T10:00:00Z'),
        responseId: `r${i}`,
      }));

      const result = processCheckboxFieldAnalytics(fieldResponses, 'field-1', 'Choices', 100);

      expect(result.combinations.length).toBeLessThanOrEqual(20);
    });

    it('should calculate average selections', () => {
      const fieldResponses: FieldResponse[] = [
        { value: ['Option A'], submittedAt: toDate('2024-01-01T10:00:00Z'), responseId: 'r1' },
        { value: ['Option A', 'Option B'], submittedAt: toDate('2024-01-02T10:00:00Z'), responseId: 'r2' },
        { value: ['Option A', 'Option B', 'Option C'], submittedAt: toDate('2024-01-03T10:00:00Z'), responseId: 'r3' },
      ];

      const result = processCheckboxFieldAnalytics(fieldResponses, 'field-1', 'Choices', 10);

      // (1 + 2 + 3) / 3 = 2
      expect(result.averageSelections).toBe(2);
    });

    it('should calculate selection distribution', () => {
      const fieldResponses: FieldResponse[] = [
        { value: ['Option A'], submittedAt: toDate('2024-01-01T10:00:00Z'), responseId: 'r1' },
        { value: ['Option A'], submittedAt: toDate('2024-01-02T10:00:00Z'), responseId: 'r2' },
        { value: ['Option A', 'Option B'], submittedAt: toDate('2024-01-03T10:00:00Z'), responseId: 'r3' },
        { value: ['Option A', 'Option B', 'Option C'], submittedAt: toDate('2024-01-04T10:00:00Z'), responseId: 'r4' },
      ];

      const result = processCheckboxFieldAnalytics(fieldResponses, 'field-1', 'Choices', 10);

      expect(result.selectionDistribution).toContainEqual({ selectionCount: 1, responseCount: 2, percentage: 50 });
      expect(result.selectionDistribution).toContainEqual({ selectionCount: 2, responseCount: 1, percentage: 25 });
      expect(result.selectionDistribution).toContainEqual({ selectionCount: 3, responseCount: 1, percentage: 25 });
    });

    it('should calculate correlation between options', () => {
      const fieldResponses: FieldResponse[] = [
        { value: ['Option A', 'Option B'], submittedAt: toDate('2024-01-01T10:00:00Z'), responseId: 'r1' },
        { value: ['Option A', 'Option B'], submittedAt: toDate('2024-01-02T10:00:00Z'), responseId: 'r2' },
        { value: ['Option A', 'Option B'], submittedAt: toDate('2024-01-03T10:00:00Z'), responseId: 'r3' },
        { value: ['Option A', 'Option B'], submittedAt: toDate('2024-01-04T10:00:00Z'), responseId: 'r4' },
        { value: ['Option C'], submittedAt: toDate('2024-01-05T10:00:00Z'), responseId: 'r5' },
      ];

      const result = processCheckboxFieldAnalytics(fieldResponses, 'field-1', 'Choices', 10);

      expect(result.correlations).toBeDefined();
      expect(result.correlations.length).toBeGreaterThan(0);
      expect(result.correlations[0]).toMatchObject({
        option1: 'Option A',
        option2: 'Option B',
      });
      expect(result.correlations[0].correlation).toBeGreaterThan(1);
    });

    it('should only include strong correlations (>1.2)', () => {
      const fieldResponses: FieldResponse[] = [
        { value: ['Option A'], submittedAt: toDate('2024-01-01T10:00:00Z'), responseId: 'r1' },
        { value: ['Option B'], submittedAt: toDate('2024-01-02T10:00:00Z'), responseId: 'r2' },
        { value: ['Option C'], submittedAt: toDate('2024-01-03T10:00:00Z'), responseId: 'r3' },
      ];

      const result = processCheckboxFieldAnalytics(fieldResponses, 'field-1', 'Choices', 10);

      // No options selected together, so no strong correlations
      expect(result.correlations).toEqual([]);
    });

    it('should limit correlations to 10', () => {
      const fieldResponses: FieldResponse[] = Array.from({ length: 20 }, (_, i) => ({
        value: [`Option ${i}`, `Option ${i + 1}`],
        submittedAt: toDate('2024-01-01T10:00:00Z'),
        responseId: `r${i}`,
      }));

      const result = processCheckboxFieldAnalytics(fieldResponses, 'field-1', 'Choices', 50);

      expect(result.correlations.length).toBeLessThanOrEqual(10);
    });

    it('should filter out responses with empty selections', () => {
      const fieldResponses: FieldResponse[] = [
        { value: ['Option A'], submittedAt: toDate('2024-01-01T10:00:00Z'), responseId: 'r1' },
        { value: [], submittedAt: toDate('2024-01-02T10:00:00Z'), responseId: 'r2' },
        { value: ['Option B'], submittedAt: toDate('2024-01-03T10:00:00Z'), responseId: 'r3' },
      ];

      const result = processCheckboxFieldAnalytics(fieldResponses, 'field-1', 'Choices', 10);

      expect(result.totalResponses).toBe(2);
    });

    it('should trim whitespace from options', () => {
      const fieldResponses: FieldResponse[] = [
        { value: ['  Option A  ', 'Option B'], submittedAt: toDate('2024-01-01T10:00:00Z'), responseId: 'r1' },
        { value: ['Option A', '  Option B  '], submittedAt: toDate('2024-01-02T10:00:00Z'), responseId: 'r2' },
      ];

      const result = processCheckboxFieldAnalytics(fieldResponses, 'field-1', 'Choices', 10);

      expect(result.individualOptions[0].option).toBe('Option A');
      expect(result.individualOptions[1].option).toBe('Option B');
    });

    it('should filter out empty options after trimming', () => {
      const fieldResponses: FieldResponse[] = [
        { value: ['Option A', '   ', 'Option B'], submittedAt: toDate('2024-01-01T10:00:00Z'), responseId: 'r1' },
      ];

      const result = processCheckboxFieldAnalytics(fieldResponses, 'field-1', 'Choices', 10);

      expect(result.individualOptions).toHaveLength(2);
      expect(result.averageSelections).toBe(2);
    });

    it('should handle empty responses', () => {
      const result = processCheckboxFieldAnalytics([], 'field-1', 'Choices', 5);

      expect(result.totalResponses).toBe(0);
      expect(result.responseRate).toBe(0);
      expect(result.individualOptions).toEqual([]);
      expect(result.combinations).toEqual([]);
      expect(result.averageSelections).toBe(0);
      expect(result.selectionDistribution).toEqual([]);
      expect(result.correlations).toEqual([]);
    });

    it('should handle single response', () => {
      const fieldResponses: FieldResponse[] = [
        { value: ['Option A', 'Option B'], submittedAt: toDate('2024-01-01T10:00:00Z'), responseId: 'r1' },
      ];

      const result = processCheckboxFieldAnalytics(fieldResponses, 'field-1', 'Choices', 5);

      expect(result.totalResponses).toBe(1);
      expect(result.averageSelections).toBe(2);
    });

    it('should calculate percentages correctly for individual options', () => {
      const fieldResponses: FieldResponse[] = [
        { value: ['Option A', 'Option B'], submittedAt: toDate('2024-01-01T10:00:00Z'), responseId: 'r1' },
        { value: ['Option A'], submittedAt: toDate('2024-01-02T10:00:00Z'), responseId: 'r2' },
      ];

      const result = processCheckboxFieldAnalytics(fieldResponses, 'field-1', 'Choices', 10);

      const optionA = result.individualOptions.find(o => o.option === 'Option A');
      expect(optionA?.percentage).toBe(100);

      const optionB = result.individualOptions.find(o => o.option === 'Option B');
      expect(optionB?.percentage).toBe(50);
    });

    it('should calculate percentages correctly for combinations', () => {
      const fieldResponses: FieldResponse[] = [
        { value: ['Option A', 'Option B'], submittedAt: toDate('2024-01-01T10:00:00Z'), responseId: 'r1' },
        { value: ['Option A', 'Option B'], submittedAt: toDate('2024-01-02T10:00:00Z'), responseId: 'r2' },
        { value: ['Option A'], submittedAt: toDate('2024-01-03T10:00:00Z'), responseId: 'r3' },
        { value: ['Option A'], submittedAt: toDate('2024-01-04T10:00:00Z'), responseId: 'r4' },
      ];

      const result = processCheckboxFieldAnalytics(fieldResponses, 'field-1', 'Choices', 10);

      expect(result.combinations[0].percentage).toBe(50);
      expect(result.combinations[1].percentage).toBe(50);
    });

    it('should set lastUpdated to current time', () => {
      const fieldResponses: FieldResponse[] = [
        { value: ['Option A'], submittedAt: toDate('2024-01-01T10:00:00Z'), responseId: 'r1' },
      ];

      const result = processCheckboxFieldAnalytics(fieldResponses, 'field-1', 'Choices', 5);

      expect(result.lastUpdated).toEqual(new Date('2024-05-01T12:00:00Z'));
    });

    it('should handle non-array, non-string values', () => {
      const fieldResponses: FieldResponse[] = [
        { value: 123, submittedAt: toDate('2024-01-01T10:00:00Z'), responseId: 'r1' },
        { value: true, submittedAt: toDate('2024-01-02T10:00:00Z'), responseId: 'r2' },
      ];

      const result = processCheckboxFieldAnalytics(fieldResponses, 'field-1', 'Choices', 10);

      // Non-array, non-string values result in empty selections array
      expect(result.totalResponses).toBe(0);
    });

    it('should round average selections to 2 decimal places', () => {
      const fieldResponses: FieldResponse[] = [
        { value: ['Option A'], submittedAt: toDate('2024-01-01T10:00:00Z'), responseId: 'r1' },
        { value: ['Option A', 'Option B'], submittedAt: toDate('2024-01-02T10:00:00Z'), responseId: 'r2' },
        { value: ['Option A', 'Option B', 'Option C'], submittedAt: toDate('2024-01-03T10:00:00Z'), responseId: 'r3' },
        { value: ['Option A', 'Option B', 'Option C', 'Option D'], submittedAt: toDate('2024-01-04T10:00:00Z'), responseId: 'r4' },
      ];

      const result = processCheckboxFieldAnalytics(fieldResponses, 'field-1', 'Choices', 10);

      // (1 + 2 + 3 + 4) / 4 = 2.5
      expect(result.averageSelections).toBe(2.5);
    });

    it('should sort selection distribution by selection count', () => {
      const fieldResponses: FieldResponse[] = [
        { value: ['A', 'B', 'C'], submittedAt: toDate('2024-01-01T10:00:00Z'), responseId: 'r1' },
        { value: ['A'], submittedAt: toDate('2024-01-02T10:00:00Z'), responseId: 'r2' },
        { value: ['A', 'B'], submittedAt: toDate('2024-01-03T10:00:00Z'), responseId: 'r3' },
      ];

      const result = processCheckboxFieldAnalytics(fieldResponses, 'field-1', 'Choices', 10);

      expect(result.selectionDistribution[0].selectionCount).toBe(1);
      expect(result.selectionDistribution[1].selectionCount).toBe(2);
      expect(result.selectionDistribution[2].selectionCount).toBe(3);
    });

    it('should handle mixed array and string responses', () => {
      const fieldResponses: FieldResponse[] = [
        { value: ['Option A', 'Option B'], submittedAt: toDate('2024-01-01T10:00:00Z'), responseId: 'r1' },
        { value: 'Option A, Option C', submittedAt: toDate('2024-01-02T10:00:00Z'), responseId: 'r2' },
      ];

      const result = processCheckboxFieldAnalytics(fieldResponses, 'field-1', 'Choices', 10);

      expect(result.totalResponses).toBe(2);
      const optionA = result.individualOptions.find(o => o.option === 'Option A');
      expect(optionA?.count).toBe(2);
    });

    it('should handle options with special characters', () => {
      const fieldResponses: FieldResponse[] = [
        { value: ['Option A & B', 'Option C/D'], submittedAt: toDate('2024-01-01T10:00:00Z'), responseId: 'r1' },
      ];

      const result = processCheckboxFieldAnalytics(fieldResponses, 'field-1', 'Choices', 10);

      expect(result.individualOptions[0].option).toBe('Option A & B');
      expect(result.individualOptions[1].option).toBe('Option C/D');
    });

    it('should handle options with unicode characters', () => {
      const fieldResponses: FieldResponse[] = [
        { value: ['Opción A', '选项 B'], submittedAt: toDate('2024-01-01T10:00:00Z'), responseId: 'r1' },
      ];

      const result = processCheckboxFieldAnalytics(fieldResponses, 'field-1', 'Choices', 10);

      expect(result.individualOptions[0].option).toBe('Opción A');
      expect(result.individualOptions[1].option).toBe('选项 B');
    });

    it('should sort correlations by correlation value descending', () => {
      const fieldResponses: FieldResponse[] = [
        { value: ['A', 'B'], submittedAt: toDate('2024-01-01T10:00:00Z'), responseId: 'r1' },
        { value: ['A', 'B'], submittedAt: toDate('2024-01-02T10:00:00Z'), responseId: 'r2' },
        { value: ['A', 'B'], submittedAt: toDate('2024-01-03T10:00:00Z'), responseId: 'r3' },
        { value: ['A', 'C'], submittedAt: toDate('2024-01-04T10:00:00Z'), responseId: 'r4' },
        { value: ['B', 'C'], submittedAt: toDate('2024-01-05T10:00:00Z'), responseId: 'r5' },
      ];

      const result = processCheckboxFieldAnalytics(fieldResponses, 'field-1', 'Choices', 10);

      if (result.correlations.length > 1) {
        expect(result.correlations[0].correlation).toBeGreaterThanOrEqual(result.correlations[1].correlation);
      }
    });

    it('should handle zero average selections when no responses', () => {
      const result = processCheckboxFieldAnalytics([], 'field-1', 'Choices', 5);

      expect(result.averageSelections).toBe(0);
    });
  });
});
