import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FieldType } from '@dculus/types';
import { processTextFieldAnalytics } from '../textFieldAnalytics.js';
import type { FieldResponse } from '../types.js';

describe('fieldAnalytics/textFieldAnalytics', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-05-01T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const toDate = (value: string) => new Date(value);

  describe('processTextFieldAnalytics', () => {
    it('should calculate basic text statistics', () => {
      const fieldResponses: FieldResponse[] = [
        { value: 'Hello', submittedAt: toDate('2024-01-01T10:00:00Z'), responseId: 'r1' },
        { value: 'Hello world', submittedAt: toDate('2024-01-02T10:00:00Z'), responseId: 'r2' },
        { value: 'Test message', submittedAt: toDate('2024-01-03T10:00:00Z'), responseId: 'r3' },
      ];

      const result = processTextFieldAnalytics(fieldResponses, 'field-1', 'Text Field', 10);

      expect(result.fieldId).toBe('field-1');
      expect(result.fieldLabel).toBe('Text Field');
      expect(result.fieldType).toBe(FieldType.TEXT_INPUT_FIELD);
      expect(result.totalResponses).toBe(3);
      expect(result.responseRate).toBe(30);
      // (5 + 11 + 12) / 3 = 28 / 3 = 9.33
      expect(result.averageLength).toBe(9.33);
      expect(result.minLength).toBe(5);
      expect(result.maxLength).toBe(12);
    });

    it('should generate word cloud with frequencies and weights', () => {
      const fieldResponses: FieldResponse[] = [
        { value: 'great product amazing', submittedAt: toDate('2024-01-01T10:00:00Z'), responseId: 'r1' },
        { value: 'great service great', submittedAt: toDate('2024-01-02T10:00:00Z'), responseId: 'r2' },
        { value: 'amazing experience', submittedAt: toDate('2024-01-03T10:00:00Z'), responseId: 'r3' },
      ];

      const result = processTextFieldAnalytics(fieldResponses, 'field-1', 'Feedback', 5);

      expect(result.wordCloud).toBeDefined();
      expect(result.wordCloud.length).toBeGreaterThan(0);

      // "great" appears 3 times (most frequent)
      const greatWord = result.wordCloud.find(w => w.word === 'great');
      expect(greatWord).toBeDefined();
      expect(greatWord?.count).toBe(3);
      expect(greatWord?.weight).toBe(1); // Highest frequency gets weight 1

      // "amazing" appears 2 times
      const amazingWord = result.wordCloud.find(w => w.word === 'amazing');
      expect(amazingWord).toBeDefined();
      expect(amazingWord?.count).toBe(2);
      expect(amazingWord?.weight).toBeCloseTo(0.67, 2);
    });

    it('should filter out short words (length <= 2)', () => {
      const fieldResponses: FieldResponse[] = [
        { value: 'I am a good developer', submittedAt: toDate('2024-01-01T10:00:00Z'), responseId: 'r1' },
      ];

      const result = processTextFieldAnalytics(fieldResponses, 'field-1', 'Text', 2);

      // Words like "I", "am", "a" should be filtered out
      expect(result.wordCloud.every(w => w.word.length > 2)).toBe(true);
      expect(result.wordCloud.some(w => w.word === 'good')).toBe(true);
      expect(result.wordCloud.some(w => w.word === 'developer')).toBe(true);
    });

    it('should handle punctuation correctly', () => {
      const fieldResponses: FieldResponse[] = [
        { value: 'Hello, world! Great product.', submittedAt: toDate('2024-01-01T10:00:00Z'), responseId: 'r1' },
        { value: 'Great! Really great...', submittedAt: toDate('2024-01-02T10:00:00Z'), responseId: 'r2' },
      ];

      const result = processTextFieldAnalytics(fieldResponses, 'field-1', 'Feedback', 5);

      const greatWord = result.wordCloud.find(w => w.word === 'great');
      expect(greatWord?.count).toBe(3);
    });

    it('should extract common phrases (2-word combinations)', () => {
      const fieldResponses: FieldResponse[] = [
        { value: 'great product and great service', submittedAt: toDate('2024-01-01T10:00:00Z'), responseId: 'r1' },
        { value: 'great product experience', submittedAt: toDate('2024-01-02T10:00:00Z'), responseId: 'r2' },
        { value: 'amazing product', submittedAt: toDate('2024-01-03T10:00:00Z'), responseId: 'r3' },
      ];

      const result = processTextFieldAnalytics(fieldResponses, 'field-1', 'Feedback', 5);

      expect(result.commonPhrases).toBeDefined();
      const greatProduct = result.commonPhrases.find(p => p.phrase === 'great product');
      expect(greatProduct).toBeDefined();
      expect(greatProduct?.count).toBe(2);
    });

    it('should filter out short phrases (length <= 5)', () => {
      const fieldResponses: FieldResponse[] = [
        { value: 'hi ok bye yes', submittedAt: toDate('2024-01-01T10:00:00Z'), responseId: 'r1' },
        { value: 'great amazing product', submittedAt: toDate('2024-01-02T10:00:00Z'), responseId: 'r2' },
      ];

      const result = processTextFieldAnalytics(fieldResponses, 'field-1', 'Text', 5);

      expect(result.commonPhrases.every(p => p.phrase.length > 5)).toBe(true);
    });

    it('should calculate length distribution', () => {
      const fieldResponses: FieldResponse[] = [
        { value: 'short', submittedAt: toDate('2024-01-01T10:00:00Z'), responseId: 'r1' }, // 5 chars (0-10)
        { value: 'medium length', submittedAt: toDate('2024-01-02T10:00:00Z'), responseId: 'r2' }, // 13 chars (11-25)
        { value: 'this is a very long text message', submittedAt: toDate('2024-01-03T10:00:00Z'), responseId: 'r3' }, // 33 chars (26-50)
      ];

      const result = processTextFieldAnalytics(fieldResponses, 'field-1', 'Text', 5);

      expect(result.lengthDistribution).toBeDefined();

      const range0_10 = result.lengthDistribution.find(d => d.range === '0-10');
      expect(range0_10?.count).toBe(1);

      const range11_25 = result.lengthDistribution.find(d => d.range === '11-25');
      expect(range11_25?.count).toBe(1);

      const range26_50 = result.lengthDistribution.find(d => d.range === '26-50');
      expect(range26_50?.count).toBe(1);
    });

    it('should include recent responses (up to 10)', () => {
      const fieldResponses: FieldResponse[] = Array.from({ length: 15 }, (_, i) => ({
        value: `Response ${i + 1}`,
        submittedAt: toDate(`2024-01-${String(i + 1).padStart(2, '0')}T10:00:00Z`),
        responseId: `r${i + 1}`,
      }));

      const result = processTextFieldAnalytics(fieldResponses, 'field-1', 'Text', 20);

      expect(result.recentResponses).toBeDefined();
      expect(result.recentResponses).toHaveLength(10);
      expect(result.recentResponses[0].value).toBe('Response 1');
      expect(result.recentResponses[9].value).toBe('Response 10');
    });

    it('should handle empty responses array', () => {
      const result = processTextFieldAnalytics([], 'field-1', 'Text', 5);

      expect(result.totalResponses).toBe(0);
      expect(result.responseRate).toBe(0);
      expect(result.averageLength).toBe(0);
      expect(result.minLength).toBe(0);
      expect(result.maxLength).toBe(0);
      expect(result.wordCloud).toEqual([]);
      expect(result.commonPhrases).toEqual([]);
      expect(result.recentResponses).toEqual([]);
    });

    it('should handle responses with only whitespace', () => {
      const fieldResponses: FieldResponse[] = [
        { value: '   ', submittedAt: toDate('2024-01-01T10:00:00Z'), responseId: 'r1' },
        { value: '\t\n', submittedAt: toDate('2024-01-02T10:00:00Z'), responseId: 'r2' },
      ];

      const result = processTextFieldAnalytics(fieldResponses, 'field-1', 'Text', 5);

      expect(result.totalResponses).toBe(2);
      expect(result.wordCloud).toEqual([]);
    });

    it('should convert values to strings', () => {
      const fieldResponses: FieldResponse[] = [
        { value: 123, submittedAt: toDate('2024-01-01T10:00:00Z'), responseId: 'r1' },
        { value: true, submittedAt: toDate('2024-01-02T10:00:00Z'), responseId: 'r2' },
        { value: null, submittedAt: toDate('2024-01-03T10:00:00Z'), responseId: 'r3' },
      ];

      const result = processTextFieldAnalytics(fieldResponses, 'field-1', 'Text', 5);

      expect(result.totalResponses).toBe(3);
      expect(result.averageLength).toBeGreaterThan(0);
    });

    it('should limit word cloud to 50 words', () => {
      const words = Array.from({ length: 100 }, (_, i) => `word${i}`).join(' ');
      const fieldResponses: FieldResponse[] = [
        { value: words, submittedAt: toDate('2024-01-01T10:00:00Z'), responseId: 'r1' },
      ];

      const result = processTextFieldAnalytics(fieldResponses, 'field-1', 'Text', 5);

      expect(result.wordCloud.length).toBeLessThanOrEqual(50);
    });

    it('should limit common phrases to 20', () => {
      const words = Array.from({ length: 100 }, (_, i) => `unique${i}`).join(' ');
      const fieldResponses: FieldResponse[] = [
        { value: words, submittedAt: toDate('2024-01-01T10:00:00Z'), responseId: 'r1' },
      ];

      const result = processTextFieldAnalytics(fieldResponses, 'field-1', 'Text', 5);

      expect(result.commonPhrases.length).toBeLessThanOrEqual(20);
    });

    it('should sort word cloud by count descending', () => {
      const fieldResponses: FieldResponse[] = [
        { value: 'alpha beta gamma', submittedAt: toDate('2024-01-01T10:00:00Z'), responseId: 'r1' },
        { value: 'beta gamma', submittedAt: toDate('2024-01-02T10:00:00Z'), responseId: 'r2' },
        { value: 'gamma', submittedAt: toDate('2024-01-03T10:00:00Z'), responseId: 'r3' },
      ];

      const result = processTextFieldAnalytics(fieldResponses, 'field-1', 'Text', 5);

      expect(result.wordCloud[0].word).toBe('gamma');
      expect(result.wordCloud[0].count).toBe(3);
      expect(result.wordCloud[1].word).toBe('beta');
      expect(result.wordCloud[1].count).toBe(2);
      expect(result.wordCloud[2].word).toBe('alpha');
      expect(result.wordCloud[2].count).toBe(1);
    });

    it('should calculate response rate correctly', () => {
      const fieldResponses: FieldResponse[] = [
        { value: 'test', submittedAt: toDate('2024-01-01T10:00:00Z'), responseId: 'r1' },
      ];

      const result = processTextFieldAnalytics(fieldResponses, 'field-1', 'Text', 4);

      expect(result.responseRate).toBe(25);
    });

    it('should handle zero total form responses', () => {
      const fieldResponses: FieldResponse[] = [
        { value: 'test', submittedAt: toDate('2024-01-01T10:00:00Z'), responseId: 'r1' },
      ];

      const result = processTextFieldAnalytics(fieldResponses, 'field-1', 'Text', 0);

      expect(result.responseRate).toBe(0);
    });

    it('should set lastUpdated to current time', () => {
      const fieldResponses: FieldResponse[] = [
        { value: 'test', submittedAt: toDate('2024-01-01T10:00:00Z'), responseId: 'r1' },
      ];

      const result = processTextFieldAnalytics(fieldResponses, 'field-1', 'Text', 5);

      expect(result.lastUpdated).toEqual(new Date('2024-05-01T12:00:00Z'));
    });

    it('should handle case insensitivity in word analysis', () => {
      const fieldResponses: FieldResponse[] = [
        { value: 'Great GREAT great', submittedAt: toDate('2024-01-01T10:00:00Z'), responseId: 'r1' },
      ];

      const result = processTextFieldAnalytics(fieldResponses, 'field-1', 'Text', 5);

      const greatWord = result.wordCloud.find(w => w.word === 'great');
      expect(greatWord?.count).toBe(3);
    });

    it('should handle texts with numbers mixed in', () => {
      const fieldResponses: FieldResponse[] = [
        { value: 'Product123 is great456', submittedAt: toDate('2024-01-01T10:00:00Z'), responseId: 'r1' },
      ];

      const result = processTextFieldAnalytics(fieldResponses, 'field-1', 'Text', 5);

      expect(result.wordCloud.some(w => w.word === 'product123')).toBe(true);
      expect(result.wordCloud.some(w => w.word === 'great456')).toBe(true);
    });

    it('should handle responses with special characters', () => {
      const fieldResponses: FieldResponse[] = [
        { value: 'Hello@#$%world', submittedAt: toDate('2024-01-01T10:00:00Z'), responseId: 'r1' },
      ];

      const result = processTextFieldAnalytics(fieldResponses, 'field-1', 'Text', 5);

      expect(result.totalResponses).toBe(1);
      expect(result.averageLength).toBe(14);
    });

    it('should handle all length distribution ranges', () => {
      const fieldResponses: FieldResponse[] = [
        { value: 'a'.repeat(5), submittedAt: toDate('2024-01-01T10:00:00Z'), responseId: 'r1' }, // 0-10
        { value: 'b'.repeat(15), submittedAt: toDate('2024-01-02T10:00:00Z'), responseId: 'r2' }, // 11-25
        { value: 'c'.repeat(35), submittedAt: toDate('2024-01-03T10:00:00Z'), responseId: 'r3' }, // 26-50
        { value: 'd'.repeat(75), submittedAt: toDate('2024-01-04T10:00:00Z'), responseId: 'r4' }, // 51-100
        { value: 'e'.repeat(150), submittedAt: toDate('2024-01-05T10:00:00Z'), responseId: 'r5' }, // 101-200
        { value: 'f'.repeat(250), submittedAt: toDate('2024-01-06T10:00:00Z'), responseId: 'r6' }, // 200+
      ];

      const result = processTextFieldAnalytics(fieldResponses, 'field-1', 'Text', 10);

      expect(result.lengthDistribution).toHaveLength(6);
      expect(result.lengthDistribution.every(d => d.count === 1)).toBe(true);
    });
  });
});
