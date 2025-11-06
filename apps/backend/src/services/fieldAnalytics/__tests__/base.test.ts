import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getFormResponses, extractFieldValues } from '../base.js';
import { responseRepository } from '../../../repositories/index.js';

vi.mock('../../../repositories/index.js');

describe('fieldAnalytics/base', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getFormResponses', () => {
    it('should fetch and normalize responses from repository', async () => {
      const mockResponses = [
        {
          id: 'response-1',
          data: { field1: 'value1', field2: 'value2' },
          submittedAt: new Date('2024-01-01T10:00:00Z'),
        },
        {
          id: 'response-2',
          data: { field1: 'valueA', field2: 'valueB' },
          submittedAt: new Date('2024-01-02T11:30:00Z'),
        },
      ];

      vi.mocked(responseRepository.listByForm).mockResolvedValue(mockResponses as any);

      const result = await getFormResponses('form-123');

      expect(responseRepository.listByForm).toHaveBeenCalledWith('form-123');
      expect(result).toEqual([
        {
          responseId: 'response-1',
          data: { field1: 'value1', field2: 'value2' },
          submittedAt: new Date('2024-01-01T10:00:00Z'),
        },
        {
          responseId: 'response-2',
          data: { field1: 'valueA', field2: 'valueB' },
          submittedAt: new Date('2024-01-02T11:30:00Z'),
        },
      ]);
    });

    it('should handle empty response list', async () => {
      vi.mocked(responseRepository.listByForm).mockResolvedValue([]);

      const result = await getFormResponses('form-empty');

      expect(responseRepository.listByForm).toHaveBeenCalledWith('form-empty');
      expect(result).toEqual([]);
    });

    it('should preserve exact timestamp when mapping responses', async () => {
      const exactDate = new Date('2024-03-15T14:22:33.456Z');
      vi.mocked(responseRepository.listByForm).mockResolvedValue([
        {
          id: 'resp-1',
          data: { field: 'test' },
          submittedAt: exactDate,
        },
      ] as any);

      const result = await getFormResponses('form-123');

      expect(result[0].submittedAt).toBe(exactDate);
      expect(result[0].submittedAt.getTime()).toBe(exactDate.getTime());
    });
  });

  describe('extractFieldValues', () => {
    const submittedAt = new Date('2024-01-15T12:00:00Z');

    it('should extract values for the specified field', () => {
      const responses = [
        { responseId: 'r1', data: { targetField: 'value1', otherField: 'ignored' }, submittedAt },
        { responseId: 'r2', data: { targetField: 'value2', otherField: 'also ignored' }, submittedAt },
      ];

      const result = extractFieldValues(responses, 'targetField');

      expect(result).toEqual([
        { value: 'value1', submittedAt, responseId: 'r1' },
        { value: 'value2', submittedAt, responseId: 'r2' },
      ]);
    });

    it('should filter out undefined values', () => {
      const responses = [
        { responseId: 'r1', data: { targetField: 'value1' }, submittedAt },
        { responseId: 'r2', data: { otherField: 'value2' }, submittedAt },
        { responseId: 'r3', data: { targetField: 'value3' }, submittedAt },
      ];

      const result = extractFieldValues(responses, 'targetField');

      expect(result).toHaveLength(2);
      expect(result).toEqual([
        { value: 'value1', submittedAt, responseId: 'r1' },
        { value: 'value3', submittedAt, responseId: 'r3' },
      ]);
    });

    it('should filter out null values', () => {
      const responses = [
        { responseId: 'r1', data: { targetField: 'value1' }, submittedAt },
        { responseId: 'r2', data: { targetField: null }, submittedAt },
        { responseId: 'r3', data: { targetField: 'value3' }, submittedAt },
      ];

      const result = extractFieldValues(responses, 'targetField');

      expect(result).toHaveLength(2);
      expect(result.map(r => r.value)).toEqual(['value1', 'value3']);
    });

    it('should filter out empty string values', () => {
      const responses = [
        { responseId: 'r1', data: { targetField: 'value1' }, submittedAt },
        { responseId: 'r2', data: { targetField: '' }, submittedAt },
        { responseId: 'r3', data: { targetField: 'value3' }, submittedAt },
      ];

      const result = extractFieldValues(responses, 'targetField');

      expect(result).toHaveLength(2);
      expect(result.map(r => r.value)).toEqual(['value1', 'value3']);
    });

    it('should handle responses with no matching field', () => {
      const responses = [
        { responseId: 'r1', data: { otherField: 'value1' }, submittedAt },
        { responseId: 'r2', data: { anotherField: 'value2' }, submittedAt },
      ];

      const result = extractFieldValues(responses, 'nonexistent');

      expect(result).toEqual([]);
    });

    it('should preserve numeric zero values', () => {
      const responses = [
        { responseId: 'r1', data: { targetField: 0 }, submittedAt },
        { responseId: 'r2', data: { targetField: 10 }, submittedAt },
      ];

      const result = extractFieldValues(responses, 'targetField');

      expect(result).toHaveLength(2);
      expect(result[0].value).toBe(0);
      expect(result[1].value).toBe(10);
    });

    it('should preserve boolean false values', () => {
      const responses = [
        { responseId: 'r1', data: { targetField: false }, submittedAt },
        { responseId: 'r2', data: { targetField: true }, submittedAt },
      ];

      const result = extractFieldValues(responses, 'targetField');

      expect(result).toHaveLength(2);
      expect(result[0].value).toBe(false);
      expect(result[1].value).toBe(true);
    });

    it('should preserve array values', () => {
      const responses = [
        { responseId: 'r1', data: { targetField: ['option1', 'option2'] }, submittedAt },
        { responseId: 'r2', data: { targetField: [] }, submittedAt },
      ];

      const result = extractFieldValues(responses, 'targetField');

      // Empty arrays are not filtered out by extractFieldValues - that's the processor's job
      expect(result).toHaveLength(2);
      expect(result[0].value).toEqual(['option1', 'option2']);
      expect(result[1].value).toEqual([]);
    });

    it('should preserve object values', () => {
      const responses = [
        { responseId: 'r1', data: { targetField: { nested: 'value' } }, submittedAt },
      ];

      const result = extractFieldValues(responses, 'targetField');

      expect(result).toHaveLength(1);
      expect(result[0].value).toEqual({ nested: 'value' });
    });

    it('should handle mixed data types correctly', () => {
      const responses = [
        { responseId: 'r1', data: { targetField: 'string' }, submittedAt },
        { responseId: 'r2', data: { targetField: 123 }, submittedAt },
        { responseId: 'r3', data: { targetField: null }, submittedAt },
        { responseId: 'r4', data: { targetField: false }, submittedAt },
        { responseId: 'r5', data: { targetField: '' }, submittedAt },
      ];

      const result = extractFieldValues(responses, 'targetField');

      expect(result).toHaveLength(3);
      expect(result.map(r => r.value)).toEqual(['string', 123, false]);
    });
  });
});
