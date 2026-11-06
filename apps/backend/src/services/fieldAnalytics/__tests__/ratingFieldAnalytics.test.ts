import { describe, it, expect } from 'vitest';
import { FieldType } from '@dculus/types';
import { processRatingFieldAnalytics } from '../ratingFieldAnalytics.js';
import type { FieldResponse } from '../types.js';

const responses = (...values: unknown[]): FieldResponse[] =>
  values.map((value, i) => ({
    value,
    submittedAt: new Date('2024-01-01T10:00:00Z'),
    responseId: `r${i}`,
  }));

const NPS = { ratingStyle: 'scale', minValue: 0, maxValue: 10 };

describe('fieldAnalytics/ratingFieldAnalytics', () => {
  describe('stars', () => {
    const config = { ratingStyle: 'stars', minValue: 1, maxValue: 5 };

    it('reports count, average and one distribution entry per value', () => {
      const result = processRatingFieldAnalytics(responses(5, 4, 4, 1), 'f1', 'Quality', 8, config);

      expect(result.fieldId).toBe('f1');
      expect(result.fieldLabel).toBe('Quality');
      expect(result.fieldType).toBe(FieldType.RATING_FIELD);
      expect(result.totalResponses).toBe(4);
      expect(result.responseRate).toBe(50);
      expect(result.average).toBe(3.5);
      expect(result.ratingStyle).toBe('stars');
      expect(result.minValue).toBe(1);
      expect(result.maxValue).toBe(5);
      expect(result.distribution).toEqual([
        { value: 1, count: 1, percentage: 25 },
        { value: 2, count: 0, percentage: 0 },
        { value: 3, count: 0, percentage: 0 },
        { value: 4, count: 2, percentage: 50 },
        { value: 5, count: 1, percentage: 25 },
      ]);
    });

    it('is not NPS and has no NPS breakdown', () => {
      const result = processRatingFieldAnalytics(responses(3), 'f1', 'Quality', 1, config);
      expect(result.isNps).toBe(false);
      expect(result.nps).toBeNull();
    });

    it('returns a zeroed distribution when nothing was answered', () => {
      const result = processRatingFieldAnalytics([], 'f1', 'Quality', 0, config);
      expect(result.totalResponses).toBe(0);
      expect(result.responseRate).toBe(0);
      expect(result.average).toBe(0);
      expect(result.distribution).toHaveLength(5);
      expect(result.distribution.every((entry) => entry.count === 0 && entry.percentage === 0)).toBe(true);
    });

    it('ignores blanks, out-of-range, fractional and non-numeric values', () => {
      const result = processRatingFieldAnalytics(
        responses(5, '', null, undefined, 0, 6, 2.5, 'abc', '4'),
        'f1',
        'Quality',
        9,
        config
      );
      // 5 and "4" count; everything else is skipped
      expect(result.totalResponses).toBe(2);
      expect(result.average).toBe(4.5);
    });

    it('falls back to five stars for a missing config', () => {
      const result = processRatingFieldAnalytics(responses(2), 'f1', 'Quality', 1);
      expect(result.distribution.map((entry) => entry.value)).toEqual([1, 2, 3, 4, 5]);
    });
  });

  describe('number scale', () => {
    it('covers 1..max for a scale starting at 1', () => {
      const result = processRatingFieldAnalytics(
        responses(7, 7),
        'f1',
        'Rate',
        2,
        { ratingStyle: 'scale', minValue: 1, maxValue: 7 }
      );
      expect(result.distribution.map((entry) => entry.value)).toEqual([1, 2, 3, 4, 5, 6, 7]);
      expect(result.isNps).toBe(false);
    });
  });

  describe('NPS (0-10 scale)', () => {
    it('includes 0 in the distribution and flags NPS', () => {
      const result = processRatingFieldAnalytics(responses(0, 10), 'f1', 'NPS', 2, NPS);
      expect(result.isNps).toBe(true);
      expect(result.distribution).toHaveLength(11);
      expect(result.distribution[0]).toEqual({ value: 0, count: 1, percentage: 50 });
      expect(result.distribution[10]).toEqual({ value: 10, count: 1, percentage: 50 });
    });

    it('splits promoters 9-10, passives 7-8 and detractors 0-6', () => {
      const result = processRatingFieldAnalytics(
        responses(10, 9, 9, 8, 7, 6, 5, 0, 10, 3),
        'f1',
        'NPS',
        10,
        NPS
      );
      expect(result.nps).toMatchObject({
        promoters: 4, // 10, 9, 9, 10
        passives: 2, // 8, 7
        detractors: 4, // 6, 5, 0, 3
        promoterPercentage: 40,
        passivePercentage: 20,
        detractorPercentage: 40,
        score: 0,
      });
    });

    it('scores %promoters - %detractors', () => {
      // 5 promoters, 3 passives, 2 detractors out of 10
      const result = processRatingFieldAnalytics(
        responses(9, 9, 10, 10, 10, 7, 8, 8, 6, 0),
        'f1',
        'NPS',
        10,
        NPS
      );
      expect(result.nps?.score).toBe(30);
      expect(result.nps?.promoterPercentage).toBe(50);
      expect(result.nps?.detractorPercentage).toBe(20);
    });

    it('reaches both extremes', () => {
      expect(processRatingFieldAnalytics(responses(10, 10, 9), 'f', 'N', 3, NPS).nps?.score).toBe(100);
      expect(processRatingFieldAnalytics(responses(0, 6, 5), 'f', 'N', 3, NPS).nps?.score).toBe(-100);
    });

    it('does not let rounding of the shares skew the score', () => {
      // 1 promoter, 2 passives, 0 detractors of 3: 33.3% promoters
      const result = processRatingFieldAnalytics(responses(10, 8, 7), 'f', 'N', 3, NPS);
      expect(result.nps?.promoterPercentage).toBe(33.3);
      expect(result.nps?.score).toBe(33.3);
    });

    it('has an all-zero breakdown with no responses', () => {
      const result = processRatingFieldAnalytics([], 'f', 'N', 0, NPS);
      expect(result.isNps).toBe(true);
      expect(result.nps).toEqual({
        promoters: 0,
        passives: 0,
        detractors: 0,
        promoterPercentage: 0,
        passivePercentage: 0,
        detractorPercentage: 0,
        score: 0,
      });
    });

    it('is not NPS for a 0-10 star field or a 0-5 scale', () => {
      expect(
        processRatingFieldAnalytics(responses(3), 'f', 'N', 1, { ratingStyle: 'stars', minValue: 0, maxValue: 10 }).isNps
      ).toBe(false);
      expect(
        processRatingFieldAnalytics(responses(3), 'f', 'N', 1, { ratingStyle: 'scale', minValue: 0, maxValue: 5 }).isNps
      ).toBe(false);
    });
  });
});
