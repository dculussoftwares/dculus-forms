import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  registerPluginExport,
  getPluginExport,
  getAllPluginExports,
  getActivePluginExports,
  hasPluginExport,
  getPluginTypesWithData,
} from '../exportRegistry.js';
import { logger } from '../../lib/logger.js';
import type { PluginExportColumn } from '../exportRegistry.js';

vi.mock('../../lib/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('exportRegistry', () => {
  // Mock plugin export columns
  const mockQuizExport: PluginExportColumn = {
    pluginType: 'quiz-grading',
    getColumns: () => ['Quiz Score', 'Total Marks', 'Percentage', 'Pass/Fail'],
    getValues: (metadata: any) => [
      metadata?.quizScore ?? null,
      metadata?.totalMarks ?? null,
      metadata?.percentage ?? null,
      metadata?.passed ? 'Pass' : 'Fail',
    ],
  };

  const mockEmailExport: PluginExportColumn = {
    pluginType: 'email',
    getColumns: () => ['Email Status', 'Sent At'],
    getValues: (metadata: any) => [
      metadata?.deliveryStatus ?? null,
      metadata?.sentAt ?? null,
    ],
  };

  const mockWebhookExport: PluginExportColumn = {
    pluginType: 'webhook',
    getColumns: () => ['Webhook Status', 'Status Code', 'Delivered At'],
    getValues: (metadata: any) => [
      metadata?.status ?? null,
      metadata?.statusCode ?? null,
      metadata?.deliveredAt ?? null,
    ],
  };

  // Note: Export registry is a singleton and cannot be cleared between tests
  // Tests should account for previously registered plugins from other tests
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('registerPluginExport', () => {
    it('registers a plugin export column definition', () => {
      registerPluginExport(mockQuizExport);

      expect(logger.info).toHaveBeenCalledWith('Registered export columns for plugin: quiz-grading');
      expect(hasPluginExport('quiz-grading')).toBe(true);
    });

    it('registers multiple plugin export definitions', () => {
      registerPluginExport(mockQuizExport);
      registerPluginExport(mockEmailExport);
      registerPluginExport(mockWebhookExport);

      expect(hasPluginExport('quiz-grading')).toBe(true);
      expect(hasPluginExport('email')).toBe(true);
      expect(hasPluginExport('webhook')).toBe(true);
      expect(getAllPluginExports()).toHaveLength(3);
    });

    it('warns when overwriting existing plugin export', () => {
      registerPluginExport(mockQuizExport);
      registerPluginExport(mockQuizExport);

      expect(logger.warn).toHaveBeenCalledWith(
        'Plugin export for "quiz-grading" is already registered. Overwriting...'
      );
    });

    it('allows overwriting with different plugin export definition', () => {
      const updatedQuizExport: PluginExportColumn = {
        pluginType: 'quiz-grading',
        getColumns: () => ['Score', 'Grade'],
        getValues: (metadata: any) => [metadata?.score ?? null, metadata?.grade ?? null],
      };

      registerPluginExport(mockQuizExport);
      registerPluginExport(updatedQuizExport);

      const registered = getPluginExport('quiz-grading');
      expect(registered?.getColumns()).toEqual(['Score', 'Grade']);
    });

    it('logs each registration with correct plugin type', () => {
      registerPluginExport(mockQuizExport);
      registerPluginExport(mockEmailExport);

      expect(logger.info).toHaveBeenCalledTimes(2);
      expect(logger.info).toHaveBeenNthCalledWith(1, 'Registered export columns for plugin: quiz-grading');
      expect(logger.info).toHaveBeenNthCalledWith(2, 'Registered export columns for plugin: email');
    });
  });

  describe('getPluginExport', () => {
    beforeEach(() => {
      registerPluginExport(mockQuizExport);
      registerPluginExport(mockEmailExport);
    });

    it('returns registered plugin export definition', () => {
      const result = getPluginExport('quiz-grading');

      expect(result).toBe(mockQuizExport);
      expect(result?.pluginType).toBe('quiz-grading');
    });

    it('returns undefined for unregistered plugin type', () => {
      const result = getPluginExport('nonexistent');

      expect(result).toBeUndefined();
    });

    it('returns correct definition for each registered plugin', () => {
      const quizExport = getPluginExport('quiz-grading');
      const emailExport = getPluginExport('email');

      expect(quizExport).toBe(mockQuizExport);
      expect(emailExport).toBe(mockEmailExport);
      expect(quizExport).not.toBe(emailExport);
    });

    it('is case-sensitive for plugin type names', () => {
      const result1 = getPluginExport('quiz-grading');
      const result2 = getPluginExport('Quiz-Grading');
      const result3 = getPluginExport('QUIZ-GRADING');

      expect(result1).toBe(mockQuizExport);
      expect(result2).toBeUndefined();
      expect(result3).toBeUndefined();
    });
  });

  describe('getAllPluginExports', () => {
    it('returns array of all registered plugin export definitions', () => {
      // Register fresh exports for this test
      registerPluginExport(mockQuizExport);
      registerPluginExport(mockEmailExport);
      registerPluginExport(mockWebhookExport);

      const exports = getAllPluginExports();

      // Should have at least the 3 we just registered
      expect(exports.length).toBeGreaterThanOrEqual(3);
      expect(exports.some(e => e.pluginType === 'quiz-grading')).toBe(true);
      expect(exports.some(e => e.pluginType === 'email')).toBe(true);
      expect(exports.some(e => e.pluginType === 'webhook')).toBe(true);
    });

    it('updates returned array after new registration', () => {
      // Use a unique plugin type for this test
      const uniqueExport: PluginExportColumn = {
        pluginType: 'test-unique-1',
        getColumns: () => ['Column'],
        getValues: () => [null],
      };

      const beforeCount = getAllPluginExports().length;
      registerPluginExport(uniqueExport);
      const afterCount = getAllPluginExports().length;

      expect(afterCount).toBe(beforeCount + 1);
      expect(getAllPluginExports().some(e => e.pluginType === 'test-unique-1')).toBe(true);
    });

    it('does not include duplicates after overwriting', () => {
      // Use a unique plugin type for this test
      const uniqueExport: PluginExportColumn = {
        pluginType: 'test-unique-2',
        getColumns: () => ['Column'],
        getValues: () => [null],
      };

      registerPluginExport(uniqueExport);
      const countAfterFirst = getAllPluginExports().filter(e => e.pluginType === 'test-unique-2').length;
      expect(countAfterFirst).toBe(1);

      registerPluginExport(uniqueExport);
      const countAfterSecond = getAllPluginExports().filter(e => e.pluginType === 'test-unique-2').length;
      expect(countAfterSecond).toBe(1); // Still only 1, not 2
    });
  });

  describe('hasPluginExport', () => {
    beforeEach(() => {
      registerPluginExport(mockQuizExport);
      registerPluginExport(mockEmailExport);
    });

    it('returns true for registered plugin types', () => {
      expect(hasPluginExport('quiz-grading')).toBe(true);
      expect(hasPluginExport('email')).toBe(true);
    });

    it('returns false for unregistered plugin types', () => {
      expect(hasPluginExport('nonexistent')).toBe(false);
      expect(hasPluginExport('unknown')).toBe(false);
    });

    it('returns false for empty string', () => {
      expect(hasPluginExport('')).toBe(false);
    });

    it('is case-sensitive', () => {
      expect(hasPluginExport('quiz-grading')).toBe(true);
      expect(hasPluginExport('Quiz-Grading')).toBe(false);
      expect(hasPluginExport('QUIZ-GRADING')).toBe(false);
    });
  });

  describe('getActivePluginExports', () => {
    beforeEach(() => {
      registerPluginExport(mockQuizExport);
      registerPluginExport(mockEmailExport);
      registerPluginExport(mockWebhookExport);
    });

    it('returns empty array when metadata is undefined', () => {
      const result = getActivePluginExports(undefined);

      expect(result).toEqual([]);
    });

    it('returns empty array when metadata is empty object', () => {
      const result = getActivePluginExports({});

      expect(result).toEqual([]);
    });

    it('returns plugin exports that have data in metadata', () => {
      const metadata = {
        'quiz-grading': { quizScore: 8, totalMarks: 10 },
        'email': { deliveryStatus: 'sent' },
      };

      const result = getActivePluginExports(metadata);

      expect(result).toHaveLength(2);
      expect(result).toContain(mockQuizExport);
      expect(result).toContain(mockEmailExport);
      expect(result).not.toContain(mockWebhookExport);
    });

    it('ignores plugin types not registered in export registry', () => {
      const metadata = {
        'quiz-grading': { quizScore: 8 },
        'unregistered-plugin': { data: 'value' },
      };

      const result = getActivePluginExports(metadata);

      expect(result).toHaveLength(1);
      expect(result[0].pluginType).toBe('quiz-grading');
    });

    it('ignores plugin types with null metadata', () => {
      const metadata = {
        'quiz-grading': { quizScore: 8 },
        'email': null,
      };

      const result = getActivePluginExports(metadata);

      expect(result).toHaveLength(1);
      expect(result[0].pluginType).toBe('quiz-grading');
    });

    it('ignores plugin types with undefined metadata', () => {
      const metadata = {
        'quiz-grading': { quizScore: 8 },
        'email': undefined,
      };

      const result = getActivePluginExports(metadata);

      expect(result).toHaveLength(1);
      expect(result[0].pluginType).toBe('quiz-grading');
    });

    it('includes plugin types with empty object metadata', () => {
      const metadata = {
        'quiz-grading': {},
      };

      const result = getActivePluginExports(metadata);

      expect(result).toHaveLength(1);
      expect(result[0].pluginType).toBe('quiz-grading');
    });

    it('handles complex metadata structures', () => {
      const metadata = {
        'quiz-grading': {
          quizScore: 8,
          totalMarks: 10,
          percentage: 80,
          passed: true,
          answers: [
            { questionId: 'q1', correct: true },
            { questionId: 'q2', correct: false },
          ],
        },
        'webhook': {
          status: 'success',
          statusCode: 200,
          deliveredAt: '2024-01-01T12:00:00Z',
        },
      };

      const result = getActivePluginExports(metadata);

      expect(result).toHaveLength(2);
      expect(result.map(e => e.pluginType)).toContain('quiz-grading');
      expect(result.map(e => e.pluginType)).toContain('webhook');
    });
  });

  describe('getPluginTypesWithData', () => {
    beforeEach(() => {
      registerPluginExport(mockQuizExport);
      registerPluginExport(mockEmailExport);
      registerPluginExport(mockWebhookExport);
    });

    it('returns empty array when no responses provided', () => {
      const result = getPluginTypesWithData([]);

      expect(result).toEqual([]);
    });

    it('returns empty array when responses have no metadata', () => {
      const responses = [
        { id: 'resp-1', data: {} },
        { id: 'resp-2', data: {} },
      ];

      const result = getPluginTypesWithData(responses);

      expect(result).toEqual([]);
    });

    it('returns plugin types that have data in any response', () => {
      const responses = [
        { metadata: { 'quiz-grading': { score: 8 } } },
        { metadata: { 'email': { status: 'sent' } } },
        { metadata: {} },
      ];

      const result = getPluginTypesWithData(responses);

      expect(result).toContain('email');
      expect(result).toContain('quiz-grading');
      expect(result).toHaveLength(2);
    });

    it('returns unique plugin types across multiple responses', () => {
      const responses = [
        { metadata: { 'quiz-grading': { score: 8 } } },
        { metadata: { 'quiz-grading': { score: 9 } } },
        { metadata: { 'quiz-grading': { score: 7 } } },
      ];

      const result = getPluginTypesWithData(responses);

      expect(result).toEqual(['quiz-grading']);
      expect(result).toHaveLength(1);
    });

    it('returns sorted plugin types for consistent column order', () => {
      const responses = [
        { metadata: { 'webhook': { status: 'success' } } },
        { metadata: { 'email': { status: 'sent' } } },
        { metadata: { 'quiz-grading': { score: 8 } } },
      ];

      const result = getPluginTypesWithData(responses);

      expect(result).toEqual(['email', 'quiz-grading', 'webhook']);
    });

    it('ignores plugin types not registered in export registry', () => {
      const responses = [
        { metadata: { 'quiz-grading': { score: 8 } } },
        { metadata: { 'unregistered-plugin': { data: 'value' } } },
      ];

      const result = getPluginTypesWithData(responses);

      expect(result).toEqual(['quiz-grading']);
    });

    it('handles responses with mixed metadata structures', () => {
      const responses = [
        { metadata: { 'quiz-grading': { score: 8 } } },
        { metadata: {} },
        { metadata: { 'email': { status: 'sent' } } },
        {},
        { metadata: null },
        { metadata: undefined },
      ];

      const result = getPluginTypesWithData(responses);

      expect(result).toEqual(['email', 'quiz-grading']);
    });

    it('handles large number of responses efficiently', () => {
      const responses = Array.from({ length: 1000 }, (_, i) => ({
        metadata: {
          'quiz-grading': { score: i % 10 },
          'email': i % 2 === 0 ? { status: 'sent' } : undefined,
        },
      }));

      const result = getPluginTypesWithData(responses);

      expect(result).toEqual(['email', 'quiz-grading']);
    });
  });

  describe('plugin export column functionality', () => {
    beforeEach(() => {
      registerPluginExport(mockQuizExport);
      registerPluginExport(mockEmailExport);
    });

    it('getColumns returns correct column headers', () => {
      const quizExport = getPluginExport('quiz-grading');

      expect(quizExport?.getColumns()).toEqual([
        'Quiz Score',
        'Total Marks',
        'Percentage',
        'Pass/Fail',
      ]);
    });

    it('getValues extracts values from metadata correctly', () => {
      const quizExport = getPluginExport('quiz-grading');
      const metadata = {
        quizScore: 8,
        totalMarks: 10,
        percentage: 80,
        passed: true,
      };

      const values = quizExport?.getValues(metadata);

      expect(values).toEqual([8, 10, 80, 'Pass']);
    });

    it('getValues returns null for missing metadata fields', () => {
      const quizExport = getPluginExport('quiz-grading');
      const metadata = {
        quizScore: 8,
        // missing totalMarks, percentage, passed
      };

      const values = quizExport?.getValues(metadata);

      expect(values).toEqual([8, null, null, 'Fail']);
    });

    it('getValues handles empty metadata', () => {
      const quizExport = getPluginExport('quiz-grading');
      const values = quizExport?.getValues({});

      expect(values).toEqual([null, null, null, 'Fail']);
    });

    it('getValues handles null metadata', () => {
      const quizExport = getPluginExport('quiz-grading');
      const values = quizExport?.getValues(null);

      expect(values).toEqual([null, null, null, 'Fail']);
    });

    it('getValues handles undefined metadata', () => {
      const quizExport = getPluginExport('quiz-grading');
      const values = quizExport?.getValues(undefined);

      expect(values).toEqual([null, null, null, 'Fail']);
    });
  });

  describe('integration scenarios', () => {
    beforeEach(() => {
      registerPluginExport(mockQuizExport);
      registerPluginExport(mockEmailExport);
      registerPluginExport(mockWebhookExport);
    });

    it('exports data for responses with multiple plugins', () => {
      const responses = [
        {
          id: 'resp-1',
          metadata: {
            'quiz-grading': { quizScore: 8, totalMarks: 10, percentage: 80, passed: true },
            'email': { deliveryStatus: 'sent', sentAt: '2024-01-01T12:00:00Z' },
          },
        },
        {
          id: 'resp-2',
          metadata: {
            'quiz-grading': { quizScore: 6, totalMarks: 10, percentage: 60, passed: true },
            'webhook': { status: 'success', statusCode: 200, deliveredAt: '2024-01-01T12:05:00Z' },
          },
        },
      ];

      const pluginTypes = getPluginTypesWithData(responses);
      expect(pluginTypes).toEqual(['email', 'quiz-grading', 'webhook']);

      // Get columns for all plugin types
      const allColumns: string[] = [];
      pluginTypes.forEach(pluginType => {
        const exportDef = getPluginExport(pluginType);
        if (exportDef) {
          allColumns.push(...exportDef.getColumns());
        }
      });

      expect(allColumns).toEqual([
        'Email Status',
        'Sent At',
        'Quiz Score',
        'Total Marks',
        'Percentage',
        'Pass/Fail',
        'Webhook Status',
        'Status Code',
        'Delivered At',
      ]);

      // Get values for first response
      const response1Values: (string | number | null)[] = [];
      pluginTypes.forEach(pluginType => {
        const exportDef = getPluginExport(pluginType);
        if (exportDef) {
          const metadata = responses[0].metadata?.[pluginType];
          response1Values.push(...exportDef.getValues(metadata));
        }
      });

      expect(response1Values).toEqual([
        'sent',
        '2024-01-01T12:00:00Z',
        8,
        10,
        80,
        'Pass',
        null,
        null,
        null,
      ]);
    });

    it('handles complete export workflow', () => {
      const responses = [
        { metadata: { 'quiz-grading': { quizScore: 8, totalMarks: 10, percentage: 80, passed: true } } },
        { metadata: { 'email': { deliveryStatus: 'sent', sentAt: '2024-01-01' } } },
        { metadata: {} },
      ];

      // Step 1: Get plugin types with data
      const pluginTypes = getPluginTypesWithData(responses);
      expect(pluginTypes).toEqual(['email', 'quiz-grading']);

      // Step 2: Build export data for each response
      const exportData = responses.map(response => {
        const rowData: Record<string, (string | number | null)[]> = {};

        pluginTypes.forEach(pluginType => {
          const exportDef = getPluginExport(pluginType);
          if (exportDef) {
            const metadata = response.metadata?.[pluginType];
            rowData[pluginType] = exportDef.getValues(metadata);
          }
        });

        return rowData;
      });

      expect(exportData).toHaveLength(3);
      expect(exportData[0]['quiz-grading']).toEqual([8, 10, 80, 'Pass']);
      expect(exportData[1]['email']).toEqual(['sent', '2024-01-01']);
      expect(exportData[2]['quiz-grading']).toEqual([null, null, null, 'Fail']);
    });

    it('supports dynamic plugin registration during export preparation', () => {
      const responses = [
        { metadata: { 'new-plugin': { value: 'test' } } },
      ];

      // Initially new-plugin not registered
      let pluginTypes = getPluginTypesWithData(responses);
      expect(pluginTypes).toEqual([]);

      // Register new plugin
      const newPluginExport: PluginExportColumn = {
        pluginType: 'new-plugin',
        getColumns: () => ['New Value'],
        getValues: (metadata: any) => [metadata?.value ?? null],
      };
      registerPluginExport(newPluginExport);

      // Now it should be detected
      pluginTypes = getPluginTypesWithData(responses);
      expect(pluginTypes).toEqual(['new-plugin']);
    });
  });
});
