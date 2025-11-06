import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FieldType } from '@dculus/types';
import { processNumberFieldAnalytics } from '../numberFieldAnalytics.js';
import type { FieldResponse } from '../types.js';

describe('fieldAnalytics/numberFieldAnalytics', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-05-01T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const toDate = (value: string) => new Date(value);

  describe('processNumberFieldAnalytics', () => {
    it('should calculate basic statistics', () => {
      const fieldResponses: FieldResponse[] = [
        { value: 10, submittedAt: toDate('2024-01-01T10:00:00Z'), responseId: 'r1' },
        { value: 20, submittedAt: toDate('2024-01-02T10:00:00Z'), responseId: 'r2' },
        { value: 30, submittedAt: toDate('2024-01-03T10:00:00Z'), responseId: 'r3' },
        { value: 40, submittedAt: toDate('2024-01-04T10:00:00Z'), responseId: 'r4' },
        { value: 50, submittedAt: toDate('2024-01-05T10:00:00Z'), responseId: 'r5' },
      ];

      const result = processNumberFieldAnalytics(fieldResponses, 'field-1', 'Score', 10);

      expect(result.fieldId).toBe('field-1');
      expect(result.fieldLabel).toBe('Score');
      expect(result.fieldType).toBe(FieldType.NUMBER_FIELD);
      expect(result.totalResponses).toBe(5);
      expect(result.responseRate).toBe(50);
      expect(result.min).toBe(10);
      expect(result.max).toBe(50);
      expect(result.average).toBe(30);
      expect(result.median).toBe(30);
    });

    it('should calculate standard deviation correctly', () => {
      const fieldResponses: FieldResponse[] = [
        { value: 2, submittedAt: toDate('2024-01-01T10:00:00Z'), responseId: 'r1' },
        { value: 4, submittedAt: toDate('2024-01-02T10:00:00Z'), responseId: 'r2' },
        { value: 4, submittedAt: toDate('2024-01-03T10:00:00Z'), responseId: 'r3' },
        { value: 4, submittedAt: toDate('2024-01-04T10:00:00Z'), responseId: 'r4' },
        { value: 5, submittedAt: toDate('2024-01-05T10:00:00Z'), responseId: 'r5' },
        { value: 5, submittedAt: toDate('2024-01-06T10:00:00Z'), responseId: 'r6' },
        { value: 7, submittedAt: toDate('2024-01-07T10:00:00Z'), responseId: 'r7' },
        { value: 9, submittedAt: toDate('2024-01-08T10:00:00Z'), responseId: 'r8' },
      ];

      const result = processNumberFieldAnalytics(fieldResponses, 'field-1', 'Score', 10);

      // Average = (2+4+4+4+5+5+7+9)/8 = 40/8 = 5
      expect(result.average).toBe(5);
      // Standard deviation should be approximately 2
      expect(result.standardDeviation).toBeCloseTo(2, 0);
    });

    it('should calculate percentiles correctly', () => {
      const fieldResponses: FieldResponse[] = Array.from({ length: 100 }, (_, i) => ({
        value: i + 1,
        submittedAt: toDate('2024-01-01T10:00:00Z'),
        responseId: `r${i}`,
      }));

      const result = processNumberFieldAnalytics(fieldResponses, 'field-1', 'Score', 150);

      expect(result.percentiles.p25).toBeCloseTo(25, 0);
      expect(result.percentiles.p50).toBeCloseTo(50, 0);
      expect(result.percentiles.p75).toBeCloseTo(75, 0);
      expect(result.percentiles.p90).toBeCloseTo(90, 0);
      expect(result.percentiles.p95).toBeCloseTo(95, 0);
    });

    it('should parse string numbers', () => {
      const fieldResponses: FieldResponse[] = [
        { value: '10', submittedAt: toDate('2024-01-01T10:00:00Z'), responseId: 'r1' },
        { value: '20.5', submittedAt: toDate('2024-01-02T10:00:00Z'), responseId: 'r2' },
        { value: '30', submittedAt: toDate('2024-01-03T10:00:00Z'), responseId: 'r3' },
      ];

      const result = processNumberFieldAnalytics(fieldResponses, 'field-1', 'Score', 5);

      expect(result.totalResponses).toBe(3);
      expect(result.min).toBe(10);
      expect(result.max).toBe(30);
      expect(result.average).toBe(20.17);
    });

    it('should filter out non-numeric values', () => {
      const fieldResponses: FieldResponse[] = [
        { value: 10, submittedAt: toDate('2024-01-01T10:00:00Z'), responseId: 'r1' },
        { value: 'invalid', submittedAt: toDate('2024-01-02T10:00:00Z'), responseId: 'r2' },
        { value: 20, submittedAt: toDate('2024-01-03T10:00:00Z'), responseId: 'r3' },
        { value: null, submittedAt: toDate('2024-01-04T10:00:00Z'), responseId: 'r4' },
        { value: 30, submittedAt: toDate('2024-01-05T10:00:00Z'), responseId: 'r5' },
      ];

      const result = processNumberFieldAnalytics(fieldResponses, 'field-1', 'Score', 10);

      expect(result.totalResponses).toBe(3);
      expect(result.average).toBe(20);
    });

    it('should create distribution buckets', () => {
      const fieldResponses: FieldResponse[] = [
        { value: 10, submittedAt: toDate('2024-01-01T10:00:00Z'), responseId: 'r1' },
        { value: 20, submittedAt: toDate('2024-01-02T10:00:00Z'), responseId: 'r2' },
        { value: 30, submittedAt: toDate('2024-01-03T10:00:00Z'), responseId: 'r3' },
        { value: 40, submittedAt: toDate('2024-01-04T10:00:00Z'), responseId: 'r4' },
        { value: 50, submittedAt: toDate('2024-01-05T10:00:00Z'), responseId: 'r5' },
      ];

      const result = processNumberFieldAnalytics(fieldResponses, 'field-1', 'Score', 10);

      expect(result.distribution).toBeDefined();
      expect(result.distribution.length).toBe(5);
      expect(result.distribution.every(d => d.count === 1)).toBe(true);
      expect(result.distribution.every(d => d.percentage === 20)).toBe(true);
    });

    it('should generate trend data grouped by date', () => {
      const fieldResponses: FieldResponse[] = [
        { value: 10, submittedAt: toDate('2024-01-01T10:00:00Z'), responseId: 'r1' },
        { value: 20, submittedAt: toDate('2024-01-01T14:00:00Z'), responseId: 'r2' },
        { value: 30, submittedAt: toDate('2024-01-02T10:00:00Z'), responseId: 'r3' },
        { value: 40, submittedAt: toDate('2024-01-03T10:00:00Z'), responseId: 'r4' },
      ];

      const result = processNumberFieldAnalytics(fieldResponses, 'field-1', 'Score', 10);

      expect(result.trend).toBeDefined();
      expect(result.trend).toHaveLength(3);
      expect(result.trend[0]).toEqual({ date: '2024-01-01', average: 15, count: 2 });
      expect(result.trend[1]).toEqual({ date: '2024-01-02', average: 30, count: 1 });
      expect(result.trend[2]).toEqual({ date: '2024-01-03', average: 40, count: 1 });
    });

    it('should sort trend data by date', () => {
      const fieldResponses: FieldResponse[] = [
        { value: 10, submittedAt: toDate('2024-01-03T10:00:00Z'), responseId: 'r1' },
        { value: 20, submittedAt: toDate('2024-01-01T10:00:00Z'), responseId: 'r2' },
        { value: 30, submittedAt: toDate('2024-01-02T10:00:00Z'), responseId: 'r3' },
      ];

      const result = processNumberFieldAnalytics(fieldResponses, 'field-1', 'Score', 10);

      expect(result.trend[0].date).toBe('2024-01-01');
      expect(result.trend[1].date).toBe('2024-01-02');
      expect(result.trend[2].date).toBe('2024-01-03');
    });

    it('should return zeroed analytics for empty responses', () => {
      const result = processNumberFieldAnalytics([], 'field-1', 'Score', 5);

      expect(result.totalResponses).toBe(0);
      expect(result.responseRate).toBe(0);
      expect(result.min).toBe(0);
      expect(result.max).toBe(0);
      expect(result.average).toBe(0);
      expect(result.median).toBe(0);
      expect(result.standardDeviation).toBe(0);
      expect(result.distribution).toEqual([]);
      expect(result.trend).toEqual([]);
      expect(result.percentiles).toEqual({
        p25: 0,
        p50: 0,
        p75: 0,
        p90: 0,
        p95: 0,
      });
    });

    it('should return zeroed analytics for all non-numeric values', () => {
      const fieldResponses: FieldResponse[] = [
        { value: 'invalid', submittedAt: toDate('2024-01-01T10:00:00Z'), responseId: 'r1' },
        { value: 'N/A', submittedAt: toDate('2024-01-02T10:00:00Z'), responseId: 'r2' },
      ];

      const result = processNumberFieldAnalytics(fieldResponses, 'field-1', 'Score', 5);

      expect(result.totalResponses).toBe(0);
      expect(result.responseRate).toBe(0);
    });

    it('should handle negative numbers', () => {
      const fieldResponses: FieldResponse[] = [
        { value: -10, submittedAt: toDate('2024-01-01T10:00:00Z'), responseId: 'r1' },
        { value: -5, submittedAt: toDate('2024-01-02T10:00:00Z'), responseId: 'r2' },
        { value: 0, submittedAt: toDate('2024-01-03T10:00:00Z'), responseId: 'r3' },
        { value: 5, submittedAt: toDate('2024-01-04T10:00:00Z'), responseId: 'r4' },
        { value: 10, submittedAt: toDate('2024-01-05T10:00:00Z'), responseId: 'r5' },
      ];

      const result = processNumberFieldAnalytics(fieldResponses, 'field-1', 'Score', 10);

      expect(result.min).toBe(-10);
      expect(result.max).toBe(10);
      expect(result.average).toBe(0);
    });

    it('should handle decimal numbers', () => {
      const fieldResponses: FieldResponse[] = [
        { value: 1.5, submittedAt: toDate('2024-01-01T10:00:00Z'), responseId: 'r1' },
        { value: 2.7, submittedAt: toDate('2024-01-02T10:00:00Z'), responseId: 'r2' },
        { value: 3.3, submittedAt: toDate('2024-01-03T10:00:00Z'), responseId: 'r3' },
      ];

      const result = processNumberFieldAnalytics(fieldResponses, 'field-1', 'Score', 5);

      expect(result.min).toBe(1.5);
      expect(result.max).toBe(3.3);
      expect(result.average).toBeCloseTo(2.5, 2);
    });

    it('should round statistics to 2 decimal places', () => {
      const fieldResponses: FieldResponse[] = [
        { value: 1, submittedAt: toDate('2024-01-01T10:00:00Z'), responseId: 'r1' },
        { value: 2, submittedAt: toDate('2024-01-02T10:00:00Z'), responseId: 'r2' },
        { value: 3, submittedAt: toDate('2024-01-03T10:00:00Z'), responseId: 'r3' },
      ];

      const result = processNumberFieldAnalytics(fieldResponses, 'field-1', 'Score', 5);

      expect(result.average).toBe(2);
      expect(result.median).toBe(2);
      expect(Number.isInteger(result.min)).toBe(true);
      expect(Number.isInteger(result.max)).toBe(true);
    });

    it('should handle single response', () => {
      const fieldResponses: FieldResponse[] = [
        { value: 42, submittedAt: toDate('2024-01-01T10:00:00Z'), responseId: 'r1' },
      ];

      const result = processNumberFieldAnalytics(fieldResponses, 'field-1', 'Score', 5);

      expect(result.totalResponses).toBe(1);
      expect(result.min).toBe(42);
      expect(result.max).toBe(42);
      expect(result.average).toBe(42);
      expect(result.median).toBe(42);
      expect(result.standardDeviation).toBe(0);
    });

    it('should handle very large numbers', () => {
      const fieldResponses: FieldResponse[] = [
        { value: 1000000, submittedAt: toDate('2024-01-01T10:00:00Z'), responseId: 'r1' },
        { value: 2000000, submittedAt: toDate('2024-01-02T10:00:00Z'), responseId: 'r2' },
        { value: 3000000, submittedAt: toDate('2024-01-03T10:00:00Z'), responseId: 'r3' },
      ];

      const result = processNumberFieldAnalytics(fieldResponses, 'field-1', 'Score', 5);

      expect(result.min).toBe(1000000);
      expect(result.max).toBe(3000000);
      expect(result.average).toBe(2000000);
    });

    it('should handle zero value correctly', () => {
      const fieldResponses: FieldResponse[] = [
        { value: 0, submittedAt: toDate('2024-01-01T10:00:00Z'), responseId: 'r1' },
        { value: 0, submittedAt: toDate('2024-01-02T10:00:00Z'), responseId: 'r2' },
      ];

      const result = processNumberFieldAnalytics(fieldResponses, 'field-1', 'Score', 5);

      expect(result.totalResponses).toBe(2);
      expect(result.min).toBe(0);
      expect(result.max).toBe(0);
      expect(result.average).toBe(0);
    });

    it('should set lastUpdated to current time', () => {
      const fieldResponses: FieldResponse[] = [
        { value: 10, submittedAt: toDate('2024-01-01T10:00:00Z'), responseId: 'r1' },
      ];

      const result = processNumberFieldAnalytics(fieldResponses, 'field-1', 'Score', 5);

      expect(result.lastUpdated).toEqual(new Date('2024-05-01T12:00:00Z'));
    });

    it('should limit distribution to 10 buckets', () => {
      const fieldResponses: FieldResponse[] = Array.from({ length: 100 }, (_, i) => ({
        value: i + 1,
        submittedAt: toDate('2024-01-01T10:00:00Z'),
        responseId: `r${i}`,
      }));

      const result = processNumberFieldAnalytics(fieldResponses, 'field-1', 'Score', 150);

      expect(result.distribution.length).toBeLessThanOrEqual(10);
    });

    it('should include edge values in distribution buckets', () => {
      const fieldResponses: FieldResponse[] = [
        { value: 0, submittedAt: toDate('2024-01-01T10:00:00Z'), responseId: 'r1' },
        { value: 100, submittedAt: toDate('2024-01-02T10:00:00Z'), responseId: 'r2' },
      ];

      const result = processNumberFieldAnalytics(fieldResponses, 'field-1', 'Score', 5);

      const totalCounted = result.distribution.reduce((sum, bucket) => sum + bucket.count, 0);
      expect(totalCounted).toBe(2);
    });

    it('should filter NaN values from trend calculation', () => {
      const fieldResponses: FieldResponse[] = [
        { value: 10, submittedAt: toDate('2024-01-01T10:00:00Z'), responseId: 'r1' },
        { value: 'invalid', submittedAt: toDate('2024-01-01T11:00:00Z'), responseId: 'r2' },
        { value: 20, submittedAt: toDate('2024-01-01T12:00:00Z'), responseId: 'r3' },
      ];

      const result = processNumberFieldAnalytics(fieldResponses, 'field-1', 'Score', 5);

      expect(result.trend[0]).toEqual({ date: '2024-01-01', average: 15, count: 2 });
    });

    it('should calculate median for even number of values', () => {
      const fieldResponses: FieldResponse[] = [
        { value: 10, submittedAt: toDate('2024-01-01T10:00:00Z'), responseId: 'r1' },
        { value: 20, submittedAt: toDate('2024-01-02T10:00:00Z'), responseId: 'r2' },
        { value: 30, submittedAt: toDate('2024-01-03T10:00:00Z'), responseId: 'r3' },
        { value: 40, submittedAt: toDate('2024-01-04T10:00:00Z'), responseId: 'r4' },
      ];

      const result = processNumberFieldAnalytics(fieldResponses, 'field-1', 'Score', 5);

      expect(result.median).toBe(30);
    });

    it('should calculate median for odd number of values', () => {
      const fieldResponses: FieldResponse[] = [
        { value: 10, submittedAt: toDate('2024-01-01T10:00:00Z'), responseId: 'r1' },
        { value: 20, submittedAt: toDate('2024-01-02T10:00:00Z'), responseId: 'r2' },
        { value: 30, submittedAt: toDate('2024-01-03T10:00:00Z'), responseId: 'r3' },
      ];

      const result = processNumberFieldAnalytics(fieldResponses, 'field-1', 'Score', 5);

      expect(result.median).toBe(20);
    });
  });
});
