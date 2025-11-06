import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FieldType } from '@dculus/types';
import { processDateFieldAnalytics } from '../dateFieldAnalytics.js';
import type { FieldResponse } from '../types.js';

describe('fieldAnalytics/dateFieldAnalytics', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-05-01T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const toDate = (value: string) => new Date(value);

  describe('processDateFieldAnalytics', () => {
    it('should calculate basic date statistics', () => {
      const fieldResponses: FieldResponse[] = [
        { value: '2024-01-15', submittedAt: toDate('2024-01-16T10:00:00Z'), responseId: 'r1' },
        { value: '2024-02-20', submittedAt: toDate('2024-02-21T10:00:00Z'), responseId: 'r2' },
        { value: '2024-03-10', submittedAt: toDate('2024-03-11T10:00:00Z'), responseId: 'r3' },
      ];

      const result = processDateFieldAnalytics(fieldResponses, 'field-1', 'Event Date', 10);

      expect(result.fieldId).toBe('field-1');
      expect(result.fieldLabel).toBe('Event Date');
      expect(result.fieldType).toBe(FieldType.DATE_FIELD);
      expect(result.totalResponses).toBe(3);
      expect(result.responseRate).toBe(30);
      expect(result.earliestDate.toISOString()).toBe('2024-01-15T00:00:00.000Z');
      expect(result.latestDate.toISOString()).toBe('2024-03-10T00:00:00.000Z');
    });

    it('should find most common date', () => {
      const fieldResponses: FieldResponse[] = [
        { value: '2024-01-15', submittedAt: toDate('2024-01-16T10:00:00Z'), responseId: 'r1' },
        { value: '2024-01-15', submittedAt: toDate('2024-01-17T10:00:00Z'), responseId: 'r2' },
        { value: '2024-01-15', submittedAt: toDate('2024-01-18T10:00:00Z'), responseId: 'r3' },
        { value: '2024-02-20', submittedAt: toDate('2024-02-21T10:00:00Z'), responseId: 'r4' },
      ];

      const result = processDateFieldAnalytics(fieldResponses, 'field-1', 'Event Date', 10);

      expect(result.mostCommonDate.toISOString()).toBe('2024-01-15T00:00:00.000Z');
    });

    it('should filter out invalid dates', () => {
      const fieldResponses: FieldResponse[] = [
        { value: '2024-01-15', submittedAt: toDate('2024-01-16T10:00:00Z'), responseId: 'r1' },
        { value: 'invalid-date', submittedAt: toDate('2024-01-17T10:00:00Z'), responseId: 'r2' },
        { value: 'not-a-date', submittedAt: toDate('2024-01-18T10:00:00Z'), responseId: 'r3' },
        { value: '2024-02-20', submittedAt: toDate('2024-02-21T10:00:00Z'), responseId: 'r4' },
      ];

      const result = processDateFieldAnalytics(fieldResponses, 'field-1', 'Event Date', 10);

      expect(result.totalResponses).toBe(2);
      expect(result.responseRate).toBe(20);
    });

    it('should calculate date distribution', () => {
      const fieldResponses: FieldResponse[] = [
        { value: '2024-01-15', submittedAt: toDate('2024-01-16T10:00:00Z'), responseId: 'r1' },
        { value: '2024-01-15', submittedAt: toDate('2024-01-17T10:00:00Z'), responseId: 'r2' },
        { value: '2024-01-20', submittedAt: toDate('2024-01-21T10:00:00Z'), responseId: 'r3' },
      ];

      const result = processDateFieldAnalytics(fieldResponses, 'field-1', 'Event Date', 10);

      expect(result.dateDistribution).toBeDefined();
      expect(result.dateDistribution).toHaveLength(2);
      expect(result.dateDistribution[0]).toEqual({ date: '2024-01-15', count: 2 });
      expect(result.dateDistribution[1]).toEqual({ date: '2024-01-20', count: 1 });
    });

    it('should calculate weekday distribution', () => {
      const fieldResponses: FieldResponse[] = [
        { value: '2024-01-01', submittedAt: toDate('2024-01-02T10:00:00Z'), responseId: 'r1' }, // Monday
        { value: '2024-01-02', submittedAt: toDate('2024-01-03T10:00:00Z'), responseId: 'r2' }, // Tuesday
        { value: '2024-01-08', submittedAt: toDate('2024-01-09T10:00:00Z'), responseId: 'r3' }, // Monday
      ];

      const result = processDateFieldAnalytics(fieldResponses, 'field-1', 'Event Date', 10);

      expect(result.weekdayDistribution).toBeDefined();
      expect(result.weekdayDistribution).toHaveLength(7);

      const monday = result.weekdayDistribution.find(d => d.weekday === 'Monday');
      expect(monday?.count).toBe(2);
      expect(monday?.percentage).toBeCloseTo(66.67, 2);

      const tuesday = result.weekdayDistribution.find(d => d.weekday === 'Tuesday');
      expect(tuesday?.count).toBe(1);
      expect(tuesday?.percentage).toBeCloseTo(33.33, 2);
    });

    it('should calculate monthly distribution', () => {
      const fieldResponses: FieldResponse[] = [
        { value: '2024-01-15', submittedAt: toDate('2024-01-16T10:00:00Z'), responseId: 'r1' },
        { value: '2024-01-20', submittedAt: toDate('2024-01-21T10:00:00Z'), responseId: 'r2' },
        { value: '2024-02-10', submittedAt: toDate('2024-02-11T10:00:00Z'), responseId: 'r3' },
        { value: '2024-02-15', submittedAt: toDate('2024-02-16T10:00:00Z'), responseId: 'r4' },
        { value: '2024-02-20', submittedAt: toDate('2024-02-21T10:00:00Z'), responseId: 'r5' },
      ];

      const result = processDateFieldAnalytics(fieldResponses, 'field-1', 'Event Date', 10);

      expect(result.monthlyDistribution).toBeDefined();
      expect(result.monthlyDistribution).toHaveLength(12);

      const january = result.monthlyDistribution.find(d => d.month === 'January');
      expect(january?.count).toBe(2);
      expect(january?.percentage).toBe(40);

      const february = result.monthlyDistribution.find(d => d.month === 'February');
      expect(february?.count).toBe(3);
      expect(february?.percentage).toBe(60);
    });

    it('should calculate seasonal patterns', () => {
      const fieldResponses: FieldResponse[] = [
        { value: '2024-03-15', submittedAt: toDate('2024-03-16T10:00:00Z'), responseId: 'r1' }, // Spring
        { value: '2024-04-10', submittedAt: toDate('2024-04-11T10:00:00Z'), responseId: 'r2' }, // Spring
        { value: '2024-06-15', submittedAt: toDate('2024-06-16T10:00:00Z'), responseId: 'r3' }, // Summer
        { value: '2024-09-20', submittedAt: toDate('2024-09-21T10:00:00Z'), responseId: 'r4' }, // Fall
        { value: '2024-12-25', submittedAt: toDate('2024-12-26T10:00:00Z'), responseId: 'r5' }, // Winter
      ];

      const result = processDateFieldAnalytics(fieldResponses, 'field-1', 'Event Date', 10);

      expect(result.seasonalPatterns).toBeDefined();
      expect(result.seasonalPatterns).toHaveLength(4);

      const spring = result.seasonalPatterns.find(s => s.season === 'Spring');
      expect(spring?.count).toBe(2);
      expect(spring?.percentage).toBe(40);

      const summer = result.seasonalPatterns.find(s => s.season === 'Summer');
      expect(summer?.count).toBe(1);
      expect(summer?.percentage).toBe(20);
    });

    it('should classify seasons correctly', () => {
      const fieldResponses: FieldResponse[] = [
        { value: '2024-01-15', submittedAt: toDate('2024-01-16T10:00:00Z'), responseId: 'r1' }, // Winter (month 0)
        { value: '2024-03-15', submittedAt: toDate('2024-03-16T10:00:00Z'), responseId: 'r2' }, // Spring (month 2)
        { value: '2024-06-15', submittedAt: toDate('2024-06-16T10:00:00Z'), responseId: 'r3' }, // Summer (month 5)
        { value: '2024-09-15', submittedAt: toDate('2024-09-16T10:00:00Z'), responseId: 'r4' }, // Fall (month 8)
      ];

      const result = processDateFieldAnalytics(fieldResponses, 'field-1', 'Event Date', 10);

      expect(result.seasonalPatterns.find(s => s.season === 'Winter')?.count).toBe(1);
      expect(result.seasonalPatterns.find(s => s.season === 'Spring')?.count).toBe(1);
      expect(result.seasonalPatterns.find(s => s.season === 'Summer')?.count).toBe(1);
      expect(result.seasonalPatterns.find(s => s.season === 'Fall')?.count).toBe(1);
    });

    it('should handle empty responses', () => {
      const result = processDateFieldAnalytics([], 'field-1', 'Event Date', 5);

      expect(result.totalResponses).toBe(0);
      expect(result.responseRate).toBe(0);
      expect(result.dateDistribution).toEqual([]);
      // When no valid dates, the function returns empty arrays for distributions
      expect(result.weekdayDistribution).toEqual([]);
      expect(result.monthlyDistribution).toEqual([]);
      expect(result.seasonalPatterns).toEqual([]);
    });

    it('should handle all invalid dates', () => {
      const fieldResponses: FieldResponse[] = [
        { value: 'invalid1', submittedAt: toDate('2024-01-16T10:00:00Z'), responseId: 'r1' },
        { value: 'invalid2', submittedAt: toDate('2024-01-17T10:00:00Z'), responseId: 'r2' },
      ];

      const result = processDateFieldAnalytics(fieldResponses, 'field-1', 'Event Date', 5);

      expect(result.totalResponses).toBe(0);
      expect(result.responseRate).toBe(0);
    });

    it('should sort dates chronologically', () => {
      const fieldResponses: FieldResponse[] = [
        { value: '2024-03-15', submittedAt: toDate('2024-03-16T10:00:00Z'), responseId: 'r1' },
        { value: '2024-01-10', submittedAt: toDate('2024-01-11T10:00:00Z'), responseId: 'r2' },
        { value: '2024-02-20', submittedAt: toDate('2024-02-21T10:00:00Z'), responseId: 'r3' },
      ];

      const result = processDateFieldAnalytics(fieldResponses, 'field-1', 'Event Date', 10);

      expect(result.earliestDate.toISOString()).toBe('2024-01-10T00:00:00.000Z');
      expect(result.latestDate.toISOString()).toBe('2024-03-15T00:00:00.000Z');
    });

    it('should handle dates from different years', () => {
      const fieldResponses: FieldResponse[] = [
        { value: '2022-01-15', submittedAt: toDate('2024-01-16T10:00:00Z'), responseId: 'r1' },
        { value: '2023-06-20', submittedAt: toDate('2024-01-17T10:00:00Z'), responseId: 'r2' },
        { value: '2024-12-10', submittedAt: toDate('2024-01-18T10:00:00Z'), responseId: 'r3' },
      ];

      const result = processDateFieldAnalytics(fieldResponses, 'field-1', 'Event Date', 10);

      expect(result.totalResponses).toBe(3);
      expect(result.earliestDate.toISOString()).toBe('2022-01-15T00:00:00.000Z');
      expect(result.latestDate.toISOString()).toBe('2024-12-10T00:00:00.000Z');
    });

    it('should handle timestamp strings', () => {
      const fieldResponses: FieldResponse[] = [
        { value: '2024-01-15T10:30:00Z', submittedAt: toDate('2024-01-16T10:00:00Z'), responseId: 'r1' },
        { value: '2024-02-20T14:45:00Z', submittedAt: toDate('2024-02-21T10:00:00Z'), responseId: 'r2' },
      ];

      const result = processDateFieldAnalytics(fieldResponses, 'field-1', 'Event Date', 10);

      expect(result.totalResponses).toBe(2);
      expect(result.earliestDate.toISOString()).toBe('2024-01-15T10:30:00.000Z');
    });

    it('should handle Date objects', () => {
      const fieldResponses: FieldResponse[] = [
        { value: new Date('2024-01-15'), submittedAt: toDate('2024-01-16T10:00:00Z'), responseId: 'r1' },
        { value: new Date('2024-02-20'), submittedAt: toDate('2024-02-21T10:00:00Z'), responseId: 'r2' },
      ];

      const result = processDateFieldAnalytics(fieldResponses, 'field-1', 'Event Date', 10);

      expect(result.totalResponses).toBe(2);
    });

    it('should set lastUpdated to current time', () => {
      const fieldResponses: FieldResponse[] = [
        { value: '2024-01-15', submittedAt: toDate('2024-01-16T10:00:00Z'), responseId: 'r1' },
      ];

      const result = processDateFieldAnalytics(fieldResponses, 'field-1', 'Event Date', 5);

      expect(result.lastUpdated).toEqual(new Date('2024-05-01T12:00:00Z'));
    });

    it('should sort date distribution chronologically', () => {
      const fieldResponses: FieldResponse[] = [
        { value: '2024-03-15', submittedAt: toDate('2024-03-16T10:00:00Z'), responseId: 'r1' },
        { value: '2024-01-10', submittedAt: toDate('2024-01-11T10:00:00Z'), responseId: 'r2' },
        { value: '2024-02-20', submittedAt: toDate('2024-02-21T10:00:00Z'), responseId: 'r3' },
      ];

      const result = processDateFieldAnalytics(fieldResponses, 'field-1', 'Event Date', 10);

      expect(result.dateDistribution[0].date).toBe('2024-01-10');
      expect(result.dateDistribution[1].date).toBe('2024-02-20');
      expect(result.dateDistribution[2].date).toBe('2024-03-15');
    });

    it('should include all weekdays in distribution even if count is zero', () => {
      const fieldResponses: FieldResponse[] = [
        { value: '2024-01-01', submittedAt: toDate('2024-01-02T10:00:00Z'), responseId: 'r1' }, // Monday
      ];

      const result = processDateFieldAnalytics(fieldResponses, 'field-1', 'Event Date', 10);

      expect(result.weekdayDistribution).toHaveLength(7);
      expect(result.weekdayDistribution.map(d => d.weekday)).toEqual([
        'Sunday',
        'Monday',
        'Tuesday',
        'Wednesday',
        'Thursday',
        'Friday',
        'Saturday',
      ]);
    });

    it('should include all months in distribution even if count is zero', () => {
      const fieldResponses: FieldResponse[] = [
        { value: '2024-01-15', submittedAt: toDate('2024-01-16T10:00:00Z'), responseId: 'r1' },
      ];

      const result = processDateFieldAnalytics(fieldResponses, 'field-1', 'Event Date', 10);

      expect(result.monthlyDistribution).toHaveLength(12);
      expect(result.monthlyDistribution[0].month).toBe('January');
      expect(result.monthlyDistribution[11].month).toBe('December');
    });

    it('should include all seasons in patterns even if count is zero', () => {
      const fieldResponses: FieldResponse[] = [
        { value: '2024-01-15', submittedAt: toDate('2024-01-16T10:00:00Z'), responseId: 'r1' },
      ];

      const result = processDateFieldAnalytics(fieldResponses, 'field-1', 'Event Date', 10);

      expect(result.seasonalPatterns).toHaveLength(4);
      expect(result.seasonalPatterns.map(s => s.season)).toEqual(['Spring', 'Summer', 'Fall', 'Winter']);
    });

    it('should handle single response', () => {
      const fieldResponses: FieldResponse[] = [
        { value: '2024-01-15', submittedAt: toDate('2024-01-16T10:00:00Z'), responseId: 'r1' },
      ];

      const result = processDateFieldAnalytics(fieldResponses, 'field-1', 'Event Date', 5);

      expect(result.totalResponses).toBe(1);
      expect(result.earliestDate).toEqual(result.latestDate);
      expect(result.mostCommonDate).toEqual(result.earliestDate);
    });

    it('should calculate percentages correctly', () => {
      const fieldResponses: FieldResponse[] = [
        { value: '2024-01-01', submittedAt: toDate('2024-01-02T10:00:00Z'), responseId: 'r1' }, // Monday
        { value: '2024-01-02', submittedAt: toDate('2024-01-03T10:00:00Z'), responseId: 'r2' }, // Tuesday
        { value: '2024-01-03', submittedAt: toDate('2024-01-04T10:00:00Z'), responseId: 'r3' }, // Wednesday
        { value: '2024-01-04', submittedAt: toDate('2024-01-05T10:00:00Z'), responseId: 'r4' }, // Thursday
      ];

      const result = processDateFieldAnalytics(fieldResponses, 'field-1', 'Event Date', 10);

      const totalPercentage = result.weekdayDistribution.reduce((sum, d) => sum + d.percentage, 0);
      expect(totalPercentage).toBeCloseTo(100, 0);
    });

    it('should handle dates with time zones', () => {
      const fieldResponses: FieldResponse[] = [
        { value: '2024-01-15T00:00:00+00:00', submittedAt: toDate('2024-01-16T10:00:00Z'), responseId: 'r1' },
        { value: '2024-01-15T00:00:00-05:00', submittedAt: toDate('2024-01-16T11:00:00Z'), responseId: 'r2' },
      ];

      const result = processDateFieldAnalytics(fieldResponses, 'field-1', 'Event Date', 10);

      expect(result.totalResponses).toBe(2);
    });

    it('should handle future dates', () => {
      const fieldResponses: FieldResponse[] = [
        { value: '2025-01-15', submittedAt: toDate('2024-01-16T10:00:00Z'), responseId: 'r1' },
        { value: '2026-06-20', submittedAt: toDate('2024-01-17T10:00:00Z'), responseId: 'r2' },
      ];

      const result = processDateFieldAnalytics(fieldResponses, 'field-1', 'Event Date', 10);

      expect(result.totalResponses).toBe(2);
      expect(result.earliestDate.toISOString()).toBe('2025-01-15T00:00:00.000Z');
    });

    it('should handle very old dates', () => {
      const fieldResponses: FieldResponse[] = [
        { value: '1900-01-01', submittedAt: toDate('2024-01-16T10:00:00Z'), responseId: 'r1' },
        { value: '1950-06-15', submittedAt: toDate('2024-01-17T10:00:00Z'), responseId: 'r2' },
      ];

      const result = processDateFieldAnalytics(fieldResponses, 'field-1', 'Event Date', 10);

      expect(result.totalResponses).toBe(2);
      expect(result.earliestDate.toISOString()).toBe('1900-01-01T00:00:00.000Z');
    });
  });
});
