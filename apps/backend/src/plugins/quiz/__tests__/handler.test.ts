import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { quizGradingHandler } from '../handler.js';
import type { PluginEvent, PluginContext } from '../../types.js';
import type { QuizGradingPluginConfig } from '../types.js';
import { QUIZ_GRADING_METADATA_KEY } from '../types.js';

describe('Quiz Grading Handler', () => {
  let mockContext: PluginContext;
  let mockLogger: any;
  let mockEvent: PluginEvent;
  let mockPrisma: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock logger
    mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    };

    // Mock Prisma
    mockPrisma = {
      response: {
        update: vi.fn(),
      },
    };

    // Mock plugin context
    mockContext = {
      logger: mockLogger,
      getFormById: vi.fn(),
      getResponseById: vi.fn(),
      sendEmail: vi.fn(),
      prisma: mockPrisma,
    };

    // Mock event
    mockEvent = {
      type: 'form.submitted',
      formId: 'form-123',
      organizationId: 'org-123',
      timestamp: new Date('2024-01-01T12:00:00Z'),
      data: {
        responseId: 'response-123',
      },
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Successful quiz grading', () => {
    it('should grade quiz with all correct answers', async () => {
      const config: QuizGradingPluginConfig = {
        type: 'quiz-grading',
        passThreshold: 60,
        quizFields: [
          {
            fieldId: 'q1',
            fieldLabel: 'What is 2+2?',
            correctAnswer: '4',
            marks: 10,
          },
          {
            fieldId: 'q2',
            fieldLabel: 'Capital of France?',
            correctAnswer: 'Paris',
            marks: 10,
          },
        ],
      };

      const mockResponse = {
        id: 'response-123',
        data: {
          q1: '4',
          q2: 'Paris',
        },
        metadata: null,
      };

      vi.mocked(mockContext.getResponseById).mockResolvedValue(mockResponse as any);
      mockPrisma.response.update.mockResolvedValue({
        ...mockResponse,
        metadata: {
          [QUIZ_GRADING_METADATA_KEY]: {
            quizScore: 20,
            totalMarks: 20,
            percentage: 100,
          },
        },
      });

      const result = await quizGradingHandler({ config }, mockEvent, mockContext);

      expect(result.success).toBe(true);
      expect(result.quizScore).toBe(20);
      expect(result.totalMarks).toBe(20);
      expect(result.percentage).toBe(100);
      expect(result.passed).toBe(true);
      expect(result.responseId).toBe('response-123');

      expect(mockPrisma.response.update).toHaveBeenCalledWith({
        where: { id: 'response-123' },
        data: {
          metadata: {
            [QUIZ_GRADING_METADATA_KEY]: expect.objectContaining({
              quizScore: 20,
              totalMarks: 20,
              percentage: 100,
              passThreshold: 60,
              gradedBy: 'plugin',
            }),
          },
        },
      });

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Quiz graded successfully',
        expect.objectContaining({
          responseId: 'response-123',
          score: '20/20',
          percentage: '100.0%',
          passed: true,
        })
      );
    });

    it('should grade quiz with partial correct answers', async () => {
      const config: QuizGradingPluginConfig = {
        type: 'quiz-grading',
        passThreshold: 60,
        quizFields: [
          {
            fieldId: 'q1',
            fieldLabel: 'Question 1',
            correctAnswer: 'A',
            marks: 5,
          },
          {
            fieldId: 'q2',
            fieldLabel: 'Question 2',
            correctAnswer: 'B',
            marks: 5,
          },
          {
            fieldId: 'q3',
            fieldLabel: 'Question 3',
            correctAnswer: 'C',
            marks: 5,
          },
        ],
      };

      const mockResponse = {
        id: 'response-123',
        data: {
          q1: 'A', // Correct
          q2: 'Wrong', // Incorrect
          q3: 'C', // Correct
        },
        metadata: null,
      };

      vi.mocked(mockContext.getResponseById).mockResolvedValue(mockResponse as any);
      mockPrisma.response.update.mockResolvedValue(mockResponse);

      const result = await quizGradingHandler({ config }, mockEvent, mockContext);

      expect(result.success).toBe(true);
      expect(result.quizScore).toBe(10); // 2 out of 3 correct
      expect(result.totalMarks).toBe(15);
      expect(result.percentage).toBeCloseTo(66.67, 2);
      expect(result.passed).toBe(true); // Above 60% threshold
    });

    it('should grade quiz with all incorrect answers', async () => {
      const config: QuizGradingPluginConfig = {
        type: 'quiz-grading',
        passThreshold: 60,
        quizFields: [
          {
            fieldId: 'q1',
            fieldLabel: 'Question 1',
            correctAnswer: 'A',
            marks: 10,
          },
          {
            fieldId: 'q2',
            fieldLabel: 'Question 2',
            correctAnswer: 'B',
            marks: 10,
          },
        ],
      };

      const mockResponse = {
        id: 'response-123',
        data: {
          q1: 'Wrong1',
          q2: 'Wrong2',
        },
        metadata: null,
      };

      vi.mocked(mockContext.getResponseById).mockResolvedValue(mockResponse as any);
      mockPrisma.response.update.mockResolvedValue(mockResponse);

      const result = await quizGradingHandler({ config }, mockEvent, mockContext);

      expect(result.success).toBe(true);
      expect(result.quizScore).toBe(0);
      expect(result.totalMarks).toBe(20);
      expect(result.percentage).toBe(0);
      expect(result.passed).toBe(false); // Below 60% threshold
    });

    it('should handle missing answers as incorrect', async () => {
      const config: QuizGradingPluginConfig = {
        type: 'quiz-grading',
        passThreshold: 60,
        quizFields: [
          {
            fieldId: 'q1',
            fieldLabel: 'Question 1',
            correctAnswer: 'A',
            marks: 10,
          },
          {
            fieldId: 'q2',
            fieldLabel: 'Question 2',
            correctAnswer: 'B',
            marks: 10,
          },
        ],
      };

      const mockResponse = {
        id: 'response-123',
        data: {
          q1: 'A', // Correct
          // q2 is missing
        },
        metadata: null,
      };

      vi.mocked(mockContext.getResponseById).mockResolvedValue(mockResponse as any);
      mockPrisma.response.update.mockResolvedValue(mockResponse);

      const result = await quizGradingHandler({ config }, mockEvent, mockContext);

      expect(result.success).toBe(true);
      expect(result.quizScore).toBe(10); // Only q1 correct
      expect(result.totalMarks).toBe(20);
      expect(result.percentage).toBe(50);
      expect(result.passed).toBe(false);

      // Verify metadata includes field results
      const metadata = mockPrisma.response.update.mock.calls[0][0].data.metadata;
      expect(metadata[QUIZ_GRADING_METADATA_KEY].fieldResults).toEqual([
        {
          fieldId: 'q1',
          fieldLabel: 'Question 1',
          userAnswer: 'A',
          correctAnswer: 'A',
          isCorrect: true,
          marksAwarded: 10,
          maxMarks: 10,
        },
        {
          fieldId: 'q2',
          fieldLabel: 'Question 2',
          userAnswer: '(No answer)',
          correctAnswer: 'B',
          isCorrect: false,
          marksAwarded: 0,
          maxMarks: 10,
        },
      ]);
    });

    it('should handle decimal marks', async () => {
      const config: QuizGradingPluginConfig = {
        type: 'quiz-grading',
        passThreshold: 60,
        quizFields: [
          {
            fieldId: 'q1',
            fieldLabel: 'Easy Question',
            correctAnswer: 'A',
            marks: 2.5,
          },
          {
            fieldId: 'q2',
            fieldLabel: 'Medium Question',
            correctAnswer: 'B',
            marks: 5.5,
          },
          {
            fieldId: 'q3',
            fieldLabel: 'Hard Question',
            correctAnswer: 'C',
            marks: 7.0,
          },
        ],
      };

      const mockResponse = {
        id: 'response-123',
        data: {
          q1: 'A', // Correct
          q2: 'B', // Correct
          q3: 'Wrong', // Incorrect
        },
        metadata: null,
      };

      vi.mocked(mockContext.getResponseById).mockResolvedValue(mockResponse as any);
      mockPrisma.response.update.mockResolvedValue(mockResponse);

      const result = await quizGradingHandler({ config }, mockEvent, mockContext);

      expect(result.success).toBe(true);
      expect(result.quizScore).toBe(8); // 2.5 + 5.5
      expect(result.totalMarks).toBe(15); // 2.5 + 5.5 + 7.0
      expect(result.percentage).toBeCloseTo(53.33, 2);
      expect(result.passed).toBe(false);
    });

    it('should preserve existing metadata when updating', async () => {
      const config: QuizGradingPluginConfig = {
        type: 'quiz-grading',
        passThreshold: 60,
        quizFields: [
          {
            fieldId: 'q1',
            fieldLabel: 'Question 1',
            correctAnswer: 'A',
            marks: 10,
          },
        ],
      };

      const mockResponse = {
        id: 'response-123',
        data: { q1: 'A' },
        metadata: {
          email: { deliveryStatus: 'sent' },
          webhook: { statusCode: 200 },
        },
      };

      vi.mocked(mockContext.getResponseById).mockResolvedValue(mockResponse as any);
      mockPrisma.response.update.mockResolvedValue(mockResponse);

      await quizGradingHandler({ config }, mockEvent, mockContext);

      expect(mockPrisma.response.update).toHaveBeenCalledWith({
        where: { id: 'response-123' },
        data: {
          metadata: {
            email: { deliveryStatus: 'sent' },
            webhook: { statusCode: 200 },
            [QUIZ_GRADING_METADATA_KEY]: expect.objectContaining({
              quizScore: 10,
              totalMarks: 10,
            }),
          },
        },
      });
    });

    it('should include gradedAt timestamp and gradedBy field', async () => {
      const config: QuizGradingPluginConfig = {
        type: 'quiz-grading',
        passThreshold: 60,
        quizFields: [
          {
            fieldId: 'q1',
            fieldLabel: 'Question 1',
            correctAnswer: 'A',
            marks: 10,
          },
        ],
      };

      const mockResponse = {
        id: 'response-123',
        data: { q1: 'A' },
        metadata: null,
      };

      vi.mocked(mockContext.getResponseById).mockResolvedValue(mockResponse as any);
      mockPrisma.response.update.mockResolvedValue(mockResponse);

      await quizGradingHandler({ config }, mockEvent, mockContext);

      const metadata = mockPrisma.response.update.mock.calls[0][0].data.metadata;
      expect(metadata[QUIZ_GRADING_METADATA_KEY].gradedAt).toBeDefined();
      expect(metadata[QUIZ_GRADING_METADATA_KEY].gradedBy).toBe('plugin');
      expect(typeof metadata[QUIZ_GRADING_METADATA_KEY].gradedAt).toBe('string');
    });
  });

  describe('Pass/Fail threshold', () => {
    it('should pass when percentage equals threshold', async () => {
      const config: QuizGradingPluginConfig = {
        type: 'quiz-grading',
        passThreshold: 60,
        quizFields: [
          {
            fieldId: 'q1',
            fieldLabel: 'Question 1',
            correctAnswer: 'A',
            marks: 6,
          },
          {
            fieldId: 'q2',
            fieldLabel: 'Question 2',
            correctAnswer: 'B',
            marks: 4,
          },
        ],
      };

      const mockResponse = {
        id: 'response-123',
        data: {
          q1: 'A', // Correct (6 marks)
          q2: 'Wrong', // Incorrect
        },
        metadata: null,
      };

      vi.mocked(mockContext.getResponseById).mockResolvedValue(mockResponse as any);
      mockPrisma.response.update.mockResolvedValue(mockResponse);

      const result = await quizGradingHandler({ config }, mockEvent, mockContext);

      expect(result.percentage).toBe(60);
      expect(result.passed).toBe(true); // Exactly at threshold
    });

    it('should handle custom pass threshold (80%)', async () => {
      const config: QuizGradingPluginConfig = {
        type: 'quiz-grading',
        passThreshold: 80,
        quizFields: [
          {
            fieldId: 'q1',
            fieldLabel: 'Question 1',
            correctAnswer: 'A',
            marks: 10,
          },
          {
            fieldId: 'q2',
            fieldLabel: 'Question 2',
            correctAnswer: 'B',
            marks: 10,
          },
        ],
      };

      const mockResponse = {
        id: 'response-123',
        data: {
          q1: 'A',
          q2: 'Wrong',
        },
        metadata: null,
      };

      vi.mocked(mockContext.getResponseById).mockResolvedValue(mockResponse as any);
      mockPrisma.response.update.mockResolvedValue(mockResponse);

      const result = await quizGradingHandler({ config }, mockEvent, mockContext);

      expect(result.percentage).toBe(50);
      expect(result.passed).toBe(false); // Below 80% threshold
    });

    it('should handle 100% pass threshold', async () => {
      const config: QuizGradingPluginConfig = {
        type: 'quiz-grading',
        passThreshold: 100,
        quizFields: [
          {
            fieldId: 'q1',
            fieldLabel: 'Question 1',
            correctAnswer: 'A',
            marks: 10,
          },
        ],
      };

      const mockResponse = {
        id: 'response-123',
        data: { q1: 'A' },
        metadata: null,
      };

      vi.mocked(mockContext.getResponseById).mockResolvedValue(mockResponse as any);
      mockPrisma.response.update.mockResolvedValue(mockResponse);

      const result = await quizGradingHandler({ config }, mockEvent, mockContext);

      expect(result.percentage).toBe(100);
      expect(result.passed).toBe(true);
    });
  });

  describe('Error handling', () => {
    it('should throw error when responseId is missing', async () => {
      const config: QuizGradingPluginConfig = {
        type: 'quiz-grading',
        passThreshold: 60,
        quizFields: [],
      };

      const eventWithoutResponseId: PluginEvent = {
        ...mockEvent,
        data: {},
      };

      await expect(
        quizGradingHandler({ config }, eventWithoutResponseId, mockContext)
      ).rejects.toThrow('Quiz grading failed: No response ID in event data');

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Quiz grading failed',
        expect.objectContaining({
          error: 'No response ID in event data',
        })
      );
    });

    it('should throw error when response not found', async () => {
      const config: QuizGradingPluginConfig = {
        type: 'quiz-grading',
        passThreshold: 60,
        quizFields: [],
      };

      vi.mocked(mockContext.getResponseById).mockResolvedValue(null);

      await expect(
        quizGradingHandler({ config }, mockEvent, mockContext)
      ).rejects.toThrow('Quiz grading failed: Response not found: response-123');

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Quiz grading failed',
        expect.objectContaining({
          error: 'Response not found: response-123',
          responseId: 'response-123',
        })
      );
    });

    it('should throw error when database update fails', async () => {
      const config: QuizGradingPluginConfig = {
        type: 'quiz-grading',
        passThreshold: 60,
        quizFields: [
          {
            fieldId: 'q1',
            fieldLabel: 'Question 1',
            correctAnswer: 'A',
            marks: 10,
          },
        ],
      };

      const mockResponse = {
        id: 'response-123',
        data: { q1: 'A' },
        metadata: null,
      };

      vi.mocked(mockContext.getResponseById).mockResolvedValue(mockResponse as any);
      mockPrisma.response.update.mockRejectedValue(new Error('Database connection lost'));

      await expect(
        quizGradingHandler({ config }, mockEvent, mockContext)
      ).rejects.toThrow('Quiz grading failed: Database connection lost');

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Quiz grading failed',
        expect.objectContaining({
          error: 'Database connection lost',
        })
      );
    });
  });

  describe('Field results tracking', () => {
    it('should track individual field results', async () => {
      const config: QuizGradingPluginConfig = {
        type: 'quiz-grading',
        passThreshold: 60,
        quizFields: [
          {
            fieldId: 'q1',
            fieldLabel: 'First Question',
            correctAnswer: 'Option A',
            marks: 10,
          },
          {
            fieldId: 'q2',
            fieldLabel: 'Second Question',
            correctAnswer: 'Option B',
            marks: 15,
          },
        ],
      };

      const mockResponse = {
        id: 'response-123',
        data: {
          q1: 'Option A', // Correct
          q2: 'Option C', // Incorrect
        },
        metadata: null,
      };

      vi.mocked(mockContext.getResponseById).mockResolvedValue(mockResponse as any);
      mockPrisma.response.update.mockResolvedValue(mockResponse);

      await quizGradingHandler({ config }, mockEvent, mockContext);

      const metadata = mockPrisma.response.update.mock.calls[0][0].data.metadata;
      const fieldResults = metadata[QUIZ_GRADING_METADATA_KEY].fieldResults;

      expect(fieldResults).toHaveLength(2);
      expect(fieldResults[0]).toEqual({
        fieldId: 'q1',
        fieldLabel: 'First Question',
        userAnswer: 'Option A',
        correctAnswer: 'Option A',
        isCorrect: true,
        marksAwarded: 10,
        maxMarks: 10,
      });
      expect(fieldResults[1]).toEqual({
        fieldId: 'q2',
        fieldLabel: 'Second Question',
        userAnswer: 'Option C',
        correctAnswer: 'Option B',
        isCorrect: false,
        marksAwarded: 0,
        maxMarks: 15,
      });
    });

    it('should handle empty answer as "(No answer)"', async () => {
      const config: QuizGradingPluginConfig = {
        type: 'quiz-grading',
        passThreshold: 60,
        quizFields: [
          {
            fieldId: 'q1',
            fieldLabel: 'Question',
            correctAnswer: 'A',
            marks: 10,
          },
        ],
      };

      const mockResponse = {
        id: 'response-123',
        data: { q1: '' }, // Empty string
        metadata: null,
      };

      vi.mocked(mockContext.getResponseById).mockResolvedValue(mockResponse as any);
      mockPrisma.response.update.mockResolvedValue(mockResponse);

      await quizGradingHandler({ config }, mockEvent, mockContext);

      const metadata = mockPrisma.response.update.mock.calls[0][0].data.metadata;
      const fieldResults = metadata[QUIZ_GRADING_METADATA_KEY].fieldResults;

      expect(fieldResults[0].userAnswer).toBe('(No answer)');
      expect(fieldResults[0].isCorrect).toBe(false);
    });

    it('should use "Unknown Field" when field label is missing', async () => {
      const config: QuizGradingPluginConfig = {
        type: 'quiz-grading',
        passThreshold: 60,
        quizFields: [
          {
            fieldId: 'q1',
            correctAnswer: 'A',
            marks: 10,
          } as any, // Missing fieldLabel
        ],
      };

      const mockResponse = {
        id: 'response-123',
        data: { q1: 'A' },
        metadata: null,
      };

      vi.mocked(mockContext.getResponseById).mockResolvedValue(mockResponse as any);
      mockPrisma.response.update.mockResolvedValue(mockResponse);

      await quizGradingHandler({ config }, mockEvent, mockContext);

      const metadata = mockPrisma.response.update.mock.calls[0][0].data.metadata;
      const fieldResults = metadata[QUIZ_GRADING_METADATA_KEY].fieldResults;

      expect(fieldResults[0].fieldLabel).toBe('Unknown Field');
    });
  });

  describe('Logging', () => {
    it('should log plugin trigger with correct details', async () => {
      const config: QuizGradingPluginConfig = {
        type: 'quiz-grading',
        passThreshold: 60,
        quizFields: [
          { fieldId: 'q1', fieldLabel: 'Q1', correctAnswer: 'A', marks: 10 },
          { fieldId: 'q2', fieldLabel: 'Q2', correctAnswer: 'B', marks: 10 },
        ],
      };

      const mockResponse = {
        id: 'response-123',
        data: { q1: 'A', q2: 'B' },
        metadata: null,
      };

      vi.mocked(mockContext.getResponseById).mockResolvedValue(mockResponse as any);
      mockPrisma.response.update.mockResolvedValue(mockResponse);

      await quizGradingHandler({ config }, mockEvent, mockContext);

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Quiz grading plugin triggered',
        {
          eventType: 'form.submitted',
          formId: 'form-123',
          quizFieldCount: 2,
        }
      );
    });

    it('should log grading success with score details', async () => {
      const config: QuizGradingPluginConfig = {
        type: 'quiz-grading',
        passThreshold: 60,
        quizFields: [
          { fieldId: 'q1', fieldLabel: 'Q1', correctAnswer: 'A', marks: 10 },
        ],
      };

      const mockResponse = {
        id: 'response-123',
        data: { q1: 'A' },
        metadata: null,
      };

      vi.mocked(mockContext.getResponseById).mockResolvedValue(mockResponse as any);
      mockPrisma.response.update.mockResolvedValue(mockResponse);

      await quizGradingHandler({ config }, mockEvent, mockContext);

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Quiz graded successfully',
        expect.objectContaining({
          responseId: 'response-123',
          score: '10/10',
          percentage: '100.0%',
          passed: true,
        })
      );
    });
  });
});
