import { describe, it, expect, vi, beforeEach } from 'vitest';
import { quizExportColumns } from '../export.js';
import type { QuizGradingMetadata } from '@dculus/types';

// Mock the logger
vi.mock('../../../lib/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock the export registry
vi.mock('../../exportRegistry.js', () => ({
  registerPluginExport: vi.fn(),
}));

describe('Quiz Export Columns', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Plugin configuration', () => {
    it('should have correct plugin type', () => {
      expect(quizExportColumns.pluginType).toBe('quiz-grading');
    });

    it('should have getColumns method', () => {
      expect(typeof quizExportColumns.getColumns).toBe('function');
    });

    it('should have getValues method', () => {
      expect(typeof quizExportColumns.getValues).toBe('function');
    });
  });

  describe('getColumns', () => {
    it('should return correct column headers', () => {
      const columns = quizExportColumns.getColumns();

      expect(columns).toEqual([
        'Quiz Score',
        'Quiz Percentage',
        'Quiz Status',
        'Quiz Pass Threshold',
      ]);
    });

    it('should return array with 4 columns', () => {
      const columns = quizExportColumns.getColumns();
      expect(columns).toHaveLength(4);
    });

    it('should return consistent columns across multiple calls', () => {
      const columns1 = quizExportColumns.getColumns();
      const columns2 = quizExportColumns.getColumns();

      expect(columns1).toEqual(columns2);
    });
  });

  describe('getValues', () => {
    describe('Valid metadata', () => {
      it('should extract values from passing quiz metadata', () => {
        const metadata: QuizGradingMetadata = {
          quizScore: 8,
          totalMarks: 10,
          percentage: 80.0,
          passThreshold: 60,
          fieldResults: [],
          gradedAt: '2024-01-01T12:00:00Z',
          gradedBy: 'plugin',
        };

        const values = quizExportColumns.getValues(metadata);

        expect(values).toEqual([
          '8/10', // Quiz Score
          '80.0', // Quiz Percentage (1 decimal)
          'Pass', // Quiz Status
          '60%', // Quiz Pass Threshold
        ]);
      });

      it('should extract values from failing quiz metadata', () => {
        const metadata: QuizGradingMetadata = {
          quizScore: 4,
          totalMarks: 10,
          percentage: 40.0,
          passThreshold: 60,
          fieldResults: [],
          gradedAt: '2024-01-01T12:00:00Z',
          gradedBy: 'plugin',
        };

        const values = quizExportColumns.getValues(metadata);

        expect(values).toEqual([
          '4/10',
          '40.0',
          'Fail',
          '60%',
        ]);
      });

      it('should handle perfect score (100%)', () => {
        const metadata: QuizGradingMetadata = {
          quizScore: 10,
          totalMarks: 10,
          percentage: 100.0,
          passThreshold: 60,
          fieldResults: [],
          gradedAt: '2024-01-01T12:00:00Z',
          gradedBy: 'plugin',
        };

        const values = quizExportColumns.getValues(metadata);

        expect(values).toEqual(['10/10', '100.0', 'Pass', '60%']);
      });

      it('should handle zero score (0%)', () => {
        const metadata: QuizGradingMetadata = {
          quizScore: 0,
          totalMarks: 10,
          percentage: 0.0,
          passThreshold: 60,
          fieldResults: [],
          gradedAt: '2024-01-01T12:00:00Z',
          gradedBy: 'plugin',
        };

        const values = quizExportColumns.getValues(metadata);

        expect(values).toEqual(['0/10', '0.0', 'Fail', '60%']);
      });

      it('should handle decimal scores', () => {
        const metadata: QuizGradingMetadata = {
          quizScore: 7.5,
          totalMarks: 12.5,
          percentage: 60.0,
          passThreshold: 60,
          fieldResults: [],
          gradedAt: '2024-01-01T12:00:00Z',
          gradedBy: 'plugin',
        };

        const values = quizExportColumns.getValues(metadata);

        expect(values).toEqual(['7.5/12.5', '60.0', 'Pass', '60%']);
      });

      it('should format percentage with 1 decimal place', () => {
        const metadata: QuizGradingMetadata = {
          quizScore: 7,
          totalMarks: 9,
          percentage: 77.77777,
          passThreshold: 60,
          fieldResults: [],
          gradedAt: '2024-01-01T12:00:00Z',
          gradedBy: 'plugin',
        };

        const values = quizExportColumns.getValues(metadata);

        expect(values[1]).toBe('77.8'); // Rounded to 1 decimal
      });

      it('should handle percentage with .5 rounding', () => {
        const metadata: QuizGradingMetadata = {
          quizScore: 5,
          totalMarks: 9,
          percentage: 55.55555,
          passThreshold: 60,
          fieldResults: [],
          gradedAt: '2024-01-01T12:00:00Z',
          gradedBy: 'plugin',
        };

        const values = quizExportColumns.getValues(metadata);

        expect(values[1]).toBe('55.6'); // Rounded to 1 decimal
      });
    });

    describe('Pass/Fail threshold', () => {
      it('should mark as Pass when percentage equals threshold', () => {
        const metadata: QuizGradingMetadata = {
          quizScore: 6,
          totalMarks: 10,
          percentage: 60.0,
          passThreshold: 60,
          fieldResults: [],
          gradedAt: '2024-01-01T12:00:00Z',
          gradedBy: 'plugin',
        };

        const values = quizExportColumns.getValues(metadata);

        expect(values[2]).toBe('Pass');
      });

      it('should mark as Fail when percentage is below threshold', () => {
        const metadata: QuizGradingMetadata = {
          quizScore: 5.9,
          totalMarks: 10,
          percentage: 59.0,
          passThreshold: 60,
          fieldResults: [],
          gradedAt: '2024-01-01T12:00:00Z',
          gradedBy: 'plugin',
        };

        const values = quizExportColumns.getValues(metadata);

        expect(values[2]).toBe('Fail');
      });

      it('should handle custom pass threshold (80%)', () => {
        const metadata: QuizGradingMetadata = {
          quizScore: 7,
          totalMarks: 10,
          percentage: 70.0,
          passThreshold: 80,
          fieldResults: [],
          gradedAt: '2024-01-01T12:00:00Z',
          gradedBy: 'plugin',
        };

        const values = quizExportColumns.getValues(metadata);

        expect(values[2]).toBe('Fail');
        expect(values[3]).toBe('80%');
      });

      it('should handle high pass threshold (90%)', () => {
        const metadata: QuizGradingMetadata = {
          quizScore: 9,
          totalMarks: 10,
          percentage: 90.0,
          passThreshold: 90,
          fieldResults: [],
          gradedAt: '2024-01-01T12:00:00Z',
          gradedBy: 'plugin',
        };

        const values = quizExportColumns.getValues(metadata);

        expect(values[2]).toBe('Pass');
        expect(values[3]).toBe('90%');
      });

      it('should use default threshold (60%) when passThreshold is undefined', () => {
        const metadata: QuizGradingMetadata = {
          quizScore: 7,
          totalMarks: 10,
          percentage: 70.0,
          passThreshold: undefined as any,
          fieldResults: [],
          gradedAt: '2024-01-01T12:00:00Z',
          gradedBy: 'plugin',
        };

        const values = quizExportColumns.getValues(metadata);

        expect(values[2]).toBe('Pass'); // 70% >= 60%
        expect(values[3]).toBe('60%');
      });
    });

    describe('Null and undefined metadata', () => {
      it('should return null values when metadata is null', () => {
        const values = quizExportColumns.getValues(null);

        expect(values).toEqual([null, null, null, null]);
      });

      it('should return null values when metadata is undefined', () => {
        const values = quizExportColumns.getValues(undefined);

        expect(values).toEqual([null, null, null, null]);
      });

      it('should return array with 4 null values', () => {
        const values = quizExportColumns.getValues(null);

        expect(values).toHaveLength(4);
        expect(values.every((v) => v === null)).toBe(true);
      });
    });

    describe('Edge cases', () => {
      it('should handle very large scores', () => {
        const metadata: QuizGradingMetadata = {
          quizScore: 9999,
          totalMarks: 10000,
          percentage: 99.99,
          passThreshold: 60,
          fieldResults: [],
          gradedAt: '2024-01-01T12:00:00Z',
          gradedBy: 'plugin',
        };

        const values = quizExportColumns.getValues(metadata);

        expect(values[0]).toBe('9999/10000');
        expect(values[1]).toBe('100.0'); // Rounded
      });

      it('should handle zero total marks', () => {
        const metadata: QuizGradingMetadata = {
          quizScore: 0,
          totalMarks: 0,
          percentage: 0,
          passThreshold: 60,
          fieldResults: [],
          gradedAt: '2024-01-01T12:00:00Z',
          gradedBy: 'plugin',
        };

        const values = quizExportColumns.getValues(metadata);

        expect(values[0]).toBe('0/0');
        expect(values[1]).toBe('0.0');
        expect(values[2]).toBe('Fail');
      });

      it('should handle very low percentage', () => {
        const metadata: QuizGradingMetadata = {
          quizScore: 0.1,
          totalMarks: 100,
          percentage: 0.1,
          passThreshold: 60,
          fieldResults: [],
          gradedAt: '2024-01-01T12:00:00Z',
          gradedBy: 'plugin',
        };

        const values = quizExportColumns.getValues(metadata);

        expect(values[1]).toBe('0.1');
        expect(values[2]).toBe('Fail');
      });

      it('should handle very high percentage (99.99%)', () => {
        const metadata: QuizGradingMetadata = {
          quizScore: 99.99,
          totalMarks: 100,
          percentage: 99.99,
          passThreshold: 60,
          fieldResults: [],
          gradedAt: '2024-01-01T12:00:00Z',
          gradedBy: 'plugin',
        };

        const values = quizExportColumns.getValues(metadata);

        expect(values[1]).toBe('100.0'); // Rounded
        expect(values[2]).toBe('Pass');
      });

      it('should handle pass threshold at 0%', () => {
        const metadata: QuizGradingMetadata = {
          quizScore: 0,
          totalMarks: 10,
          percentage: 0,
          passThreshold: 0,
          fieldResults: [],
          gradedAt: '2024-01-01T12:00:00Z',
          gradedBy: 'plugin',
        };

        const values = quizExportColumns.getValues(metadata);

        expect(values[2]).toBe('Pass'); // 0% >= 0%
        expect(values[3]).toBe('0%');
      });

      it('should handle pass threshold at 100%', () => {
        const metadata: QuizGradingMetadata = {
          quizScore: 10,
          totalMarks: 10,
          percentage: 100,
          passThreshold: 100,
          fieldResults: [],
          gradedAt: '2024-01-01T12:00:00Z',
          gradedBy: 'plugin',
        };

        const values = quizExportColumns.getValues(metadata);

        expect(values[2]).toBe('Pass');
        expect(values[3]).toBe('100%');
      });

      it('should handle fractional percentages near threshold', () => {
        const metadata: QuizGradingMetadata = {
          quizScore: 6.01,
          totalMarks: 10,
          percentage: 60.1,
          passThreshold: 60,
          fieldResults: [],
          gradedAt: '2024-01-01T12:00:00Z',
          gradedBy: 'plugin',
        };

        const values = quizExportColumns.getValues(metadata);

        expect(values[2]).toBe('Pass'); // 60.1 >= 60
      });
    });

    describe('Data types', () => {
      it('should return string values for score and threshold', () => {
        const metadata: QuizGradingMetadata = {
          quizScore: 8,
          totalMarks: 10,
          percentage: 80,
          passThreshold: 60,
          fieldResults: [],
          gradedAt: '2024-01-01T12:00:00Z',
          gradedBy: 'plugin',
        };

        const values = quizExportColumns.getValues(metadata);

        expect(typeof values[0]).toBe('string'); // Quiz Score
        expect(typeof values[1]).toBe('string'); // Quiz Percentage
        expect(typeof values[2]).toBe('string'); // Quiz Status
        expect(typeof values[3]).toBe('string'); // Quiz Pass Threshold
      });

      it('should return null values with correct type', () => {
        const values = quizExportColumns.getValues(null);

        values.forEach((value) => {
          expect(value).toBeNull();
        });
      });
    });

    describe('Multiple exports', () => {
      it('should handle multiple different quiz results', () => {
        const metadataList: QuizGradingMetadata[] = [
          {
            quizScore: 10,
            totalMarks: 10,
            percentage: 100,
            passThreshold: 60,
            fieldResults: [],
            gradedAt: '2024-01-01T12:00:00Z',
            gradedBy: 'plugin',
          },
          {
            quizScore: 5,
            totalMarks: 10,
            percentage: 50,
            passThreshold: 60,
            fieldResults: [],
            gradedAt: '2024-01-01T12:00:00Z',
            gradedBy: 'plugin',
          },
          {
            quizScore: 0,
            totalMarks: 10,
            percentage: 0,
            passThreshold: 60,
            fieldResults: [],
            gradedAt: '2024-01-01T12:00:00Z',
            gradedBy: 'plugin',
          },
        ];

        const results = metadataList.map((m) => quizExportColumns.getValues(m));

        expect(results).toEqual([
          ['10/10', '100.0', 'Pass', '60%'],
          ['5/10', '50.0', 'Fail', '60%'],
          ['0/10', '0.0', 'Fail', '60%'],
        ]);
      });

      it('should handle mix of null and valid metadata', () => {
        const metadataList = [
          {
            quizScore: 8,
            totalMarks: 10,
            percentage: 80,
            passThreshold: 60,
            fieldResults: [],
            gradedAt: '2024-01-01T12:00:00Z',
            gradedBy: 'plugin',
          } as QuizGradingMetadata,
          null,
          undefined,
        ];

        const results = metadataList.map((m) => quizExportColumns.getValues(m as any));

        expect(results[0]).toEqual(['8/10', '80.0', 'Pass', '60%']);
        expect(results[1]).toEqual([null, null, null, null]);
        expect(results[2]).toEqual([null, null, null, null]);
      });
    });

    describe('Boundary conditions', () => {
      it('should handle boundary at pass threshold (59.9% vs 60%)', () => {
        const failing: QuizGradingMetadata = {
          quizScore: 5.99,
          totalMarks: 10,
          percentage: 59.9,
          passThreshold: 60,
          fieldResults: [],
          gradedAt: '2024-01-01T12:00:00Z',
          gradedBy: 'plugin',
        };

        const passing: QuizGradingMetadata = {
          quizScore: 6.0,
          totalMarks: 10,
          percentage: 60.0,
          passThreshold: 60,
          fieldResults: [],
          gradedAt: '2024-01-01T12:00:00Z',
          gradedBy: 'plugin',
        };

        const failingValues = quizExportColumns.getValues(failing);
        const passingValues = quizExportColumns.getValues(passing);

        expect(failingValues[2]).toBe('Fail');
        expect(passingValues[2]).toBe('Pass');
      });
    });
  });

  describe('Export column consistency', () => {
    it('should maintain consistent structure across calls', () => {
      const columns1 = quizExportColumns.getColumns();
      const columns2 = quizExportColumns.getColumns();

      expect(columns1).toEqual(columns2);
      expect(columns1.length).toBe(4);
    });

    it('should have matching column and value array lengths', () => {
      const columns = quizExportColumns.getColumns();
      const values = quizExportColumns.getValues({
        quizScore: 8,
        totalMarks: 10,
        percentage: 80,
        passThreshold: 60,
        fieldResults: [],
        gradedAt: '2024-01-01T12:00:00Z',
        gradedBy: 'plugin',
      });

      expect(columns.length).toBe(values.length);
    });

    it('should have matching column and null value array lengths', () => {
      const columns = quizExportColumns.getColumns();
      const values = quizExportColumns.getValues(null);

      expect(columns.length).toBe(values.length);
    });
  });
});
