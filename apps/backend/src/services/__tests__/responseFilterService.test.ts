import { describe, it, expect } from 'vitest';
import { applyResponseFilters, ResponseFilter } from '../responseFilterService.js';

describe('Response Filter Service', () => {
  const mockResponses = [
    {
      id: 'resp-1',
      responseData: {
        'field-name': 'John Doe',
        'field-email': 'john@example.com',
        'field-age': '25',
        'field-date': '1704067200000',
        'field-tags': ['javascript', 'typescript'],
      },
    },
    {
      id: 'resp-2',
      data: {
        'field-name': 'Jane Smith',
        'field-email': 'jane@example.com',
        'field-age': '30',
        'field-date': '1706745600000',
      },
    },
    {
      id: 'resp-3',
      responseData: {
        'field-name': '',
        'field-email': 'empty@example.com',
        'field-age': '35',
      },
    },
  ];

  describe('applyResponseFilters', () => {
    it('should return all responses when no filters provided', () => {
      const result = applyResponseFilters(mockResponses, undefined);
      expect(result).toHaveLength(3);
    });

    it('should return all responses when empty filters array', () => {
      const result = applyResponseFilters(mockResponses, []);
      expect(result).toHaveLength(3);
    });

    it('should filter with IS_EMPTY operator', () => {
      const filters: ResponseFilter[] = [
        { fieldId: 'field-name', operator: 'IS_EMPTY' },
      ];

      const result = applyResponseFilters(mockResponses, filters);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('resp-3');
    });

    it('should filter with IS_NOT_EMPTY operator', () => {
      const filters: ResponseFilter[] = [
        { fieldId: 'field-name', operator: 'IS_NOT_EMPTY' },
      ];

      const result = applyResponseFilters(mockResponses, filters);

      expect(result).toHaveLength(2);
      expect(result.map((r) => r.id)).toContain('resp-1');
      expect(result.map((r) => r.id)).toContain('resp-2');
    });

    it('should filter with EQUALS operator (case insensitive)', () => {
      const filters: ResponseFilter[] = [
        { fieldId: 'field-name', operator: 'EQUALS', value: 'john doe' },
      ];

      const result = applyResponseFilters(mockResponses, filters);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('resp-1');
    });

    it('should filter with NOT_EQUALS operator', () => {
      const filters: ResponseFilter[] = [
        { fieldId: 'field-name', operator: 'NOT_EQUALS', value: 'John Doe' },
      ];

      const result = applyResponseFilters(mockResponses, filters);

      expect(result).toHaveLength(2);
      expect(result.map((r) => r.id)).not.toContain('resp-1');
    });

    it('should filter with CONTAINS operator', () => {
      const filters: ResponseFilter[] = [
        { fieldId: 'field-email', operator: 'CONTAINS', value: 'john' },
      ];

      const result = applyResponseFilters(mockResponses, filters);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('resp-1');
    });

    it('should filter with NOT_CONTAINS operator', () => {
      const filters: ResponseFilter[] = [
        { fieldId: 'field-email', operator: 'NOT_CONTAINS', value: 'john' },
      ];

      const result = applyResponseFilters(mockResponses, filters);

      expect(result).toHaveLength(2);
      expect(result.map((r) => r.id)).not.toContain('resp-1');
    });

    it('should filter with STARTS_WITH operator', () => {
      const filters: ResponseFilter[] = [
        { fieldId: 'field-name', operator: 'STARTS_WITH', value: 'john' },
      ];

      const result = applyResponseFilters(mockResponses, filters);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('resp-1');
    });

    it('should filter with ENDS_WITH operator', () => {
      const filters: ResponseFilter[] = [
        { fieldId: 'field-name', operator: 'ENDS_WITH', value: 'smith' },
      ];

      const result = applyResponseFilters(mockResponses, filters);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('resp-2');
    });

    it('should filter with GREATER_THAN operator', () => {
      const filters: ResponseFilter[] = [
        { fieldId: 'field-age', operator: 'GREATER_THAN', value: '28' },
      ];

      const result = applyResponseFilters(mockResponses, filters);

      expect(result).toHaveLength(2);
      expect(result.map((r) => r.id)).toContain('resp-2');
      expect(result.map((r) => r.id)).toContain('resp-3');
    });

    it('should filter with LESS_THAN operator', () => {
      const filters: ResponseFilter[] = [
        { fieldId: 'field-age', operator: 'LESS_THAN', value: '28' },
      ];

      const result = applyResponseFilters(mockResponses, filters);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('resp-1');
    });

    it('should filter with BETWEEN operator (min and max)', () => {
      const filters: ResponseFilter[] = [
        {
          fieldId: 'field-age',
          operator: 'BETWEEN',
          numberRange: { min: 26, max: 32 },
        },
      ];

      const result = applyResponseFilters(mockResponses, filters);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('resp-2');
    });

    it('should filter with BETWEEN operator (only min)', () => {
      const filters: ResponseFilter[] = [
        {
          fieldId: 'field-age',
          operator: 'BETWEEN',
          numberRange: { min: 30 },
        },
      ];

      const result = applyResponseFilters(mockResponses, filters);

      expect(result).toHaveLength(2);
      expect(result.map((r) => r.id)).toContain('resp-2');
      expect(result.map((r) => r.id)).toContain('resp-3');
    });

    it('should filter with BETWEEN operator (only max)', () => {
      const filters: ResponseFilter[] = [
        {
          fieldId: 'field-age',
          operator: 'BETWEEN',
          numberRange: { max: 30 },
        },
      ];

      const result = applyResponseFilters(mockResponses, filters);

      expect(result).toHaveLength(2);
      expect(result.map((r) => r.id)).toContain('resp-1');
      expect(result.map((r) => r.id)).toContain('resp-2');
    });

    it('should filter with DATE_EQUALS operator', () => {
      const filters: ResponseFilter[] = [
        {
          fieldId: 'field-date',
          operator: 'DATE_EQUALS',
          value: new Date(1704067200000).toISOString(),
        },
      ];

      const result = applyResponseFilters(mockResponses, filters);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('resp-1');
    });

    it('should filter with DATE_BEFORE operator', () => {
      const filters: ResponseFilter[] = [
        {
          fieldId: 'field-date',
          operator: 'DATE_BEFORE',
          value: new Date(1706745600000).toISOString(),
        },
      ];

      const result = applyResponseFilters(mockResponses, filters);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('resp-1');
    });

    it('should filter with DATE_AFTER operator', () => {
      const filters: ResponseFilter[] = [
        {
          fieldId: 'field-date',
          operator: 'DATE_AFTER',
          value: new Date(1704067200000).toISOString(),
        },
      ];

      const result = applyResponseFilters(mockResponses, filters);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('resp-2');
    });

    it('should filter with DATE_BETWEEN operator', () => {
      const filters: ResponseFilter[] = [
        {
          fieldId: 'field-date',
          operator: 'DATE_BETWEEN',
          dateRange: {
            from: new Date(1704000000000).toISOString(),
            to: new Date(1705000000000).toISOString(),
          },
        },
      ];

      const result = applyResponseFilters(mockResponses, filters);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('resp-1');
    });

    it('should filter with DATE_BETWEEN operator (only from)', () => {
      const filters: ResponseFilter[] = [
        {
          fieldId: 'field-date',
          operator: 'DATE_BETWEEN',
          dateRange: {
            from: new Date(1705000000000).toISOString(),
          },
        },
      ];

      const result = applyResponseFilters(mockResponses, filters);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('resp-2');
    });

    it('should filter with DATE_BETWEEN operator (only to)', () => {
      const filters: ResponseFilter[] = [
        {
          fieldId: 'field-date',
          operator: 'DATE_BETWEEN',
          dateRange: {
            to: new Date(1705000000000).toISOString(),
          },
        },
      ];

      const result = applyResponseFilters(mockResponses, filters);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('resp-1');
    });

    it('should filter with IN operator', () => {
      const filters: ResponseFilter[] = [
        {
          fieldId: 'field-name',
          operator: 'IN',
          values: ['John Doe', 'Jane Smith'],
        },
      ];

      const result = applyResponseFilters(mockResponses, filters);

      expect(result).toHaveLength(2);
      expect(result.map((r) => r.id)).toContain('resp-1');
      expect(result.map((r) => r.id)).toContain('resp-2');
    });

    it('should filter with NOT_IN operator', () => {
      const filters: ResponseFilter[] = [
        {
          fieldId: 'field-name',
          operator: 'NOT_IN',
          values: ['John Doe', 'Jane Smith'],
        },
      ];

      const result = applyResponseFilters(mockResponses, filters);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('resp-3');
    });

    it('should apply multiple filters with AND logic', () => {
      const filters: ResponseFilter[] = [
        { fieldId: 'field-age', operator: 'GREATER_THAN', value: '20' },
        { fieldId: 'field-email', operator: 'CONTAINS', value: 'john' },
      ];

      const result = applyResponseFilters(mockResponses, filters);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('resp-1');
    });

    it('should handle both responseData and data properties', () => {
      const filters: ResponseFilter[] = [
        { fieldId: 'field-email', operator: 'CONTAINS', value: 'example.com' },
      ];

      const result = applyResponseFilters(mockResponses, filters);

      expect(result).toHaveLength(3);
    });

    it('should handle invalid number values gracefully', () => {
      const filters: ResponseFilter[] = [
        { fieldId: 'field-name', operator: 'GREATER_THAN', value: '10' },
      ];

      const result = applyResponseFilters(mockResponses, filters);

      expect(result).toHaveLength(0);
    });

    it('should handle invalid date values gracefully', () => {
      const filters: ResponseFilter[] = [
        { fieldId: 'field-date', operator: 'DATE_EQUALS', value: 'invalid-date' },
      ];

      const result = applyResponseFilters(mockResponses, filters);

      // Invalid dates should return false, so no results should match
      expect(result).toHaveLength(0);
    });

    it('should return true for unknown operators', () => {
      const filters: ResponseFilter[] = [
        { fieldId: 'field-name', operator: 'UNKNOWN_OPERATOR' as any },
      ];

      const result = applyResponseFilters(mockResponses, filters);

      expect(result).toHaveLength(3);
    });

    it('should handle null field values', () => {
      const responsesWithNull = [
        {
          id: 'resp-4',
          responseData: {
            'field-name': null,
          },
        },
      ];

      const filters: ResponseFilter[] = [
        { fieldId: 'field-name', operator: 'IS_EMPTY' },
      ];

      const result = applyResponseFilters(responsesWithNull, filters);

      expect(result).toHaveLength(1);
    });

    it('should handle undefined field values', () => {
      const responsesWithUndefined = [
        {
          id: 'resp-5',
          responseData: {},
        },
      ];

      const filters: ResponseFilter[] = [
        { fieldId: 'field-name', operator: 'IS_EMPTY' },
      ];

      const result = applyResponseFilters(responsesWithUndefined, filters);

      expect(result).toHaveLength(1);
    });

    it('should filter with BETWEEN but no range specified', () => {
      const filters: ResponseFilter[] = [
        { fieldId: 'field-age', operator: 'BETWEEN' },
      ];

      const result = applyResponseFilters(mockResponses, filters);

      expect(result).toHaveLength(0);
    });

    it('should filter with DATE_BETWEEN but no range specified', () => {
      const filters: ResponseFilter[] = [
        { fieldId: 'field-date', operator: 'DATE_BETWEEN' },
      ];

      const result = applyResponseFilters(mockResponses, filters);

      expect(result).toHaveLength(0);
    });
  });
});
