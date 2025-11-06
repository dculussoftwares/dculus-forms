import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createFormViewAnalyticsRepository } from '../formViewAnalyticsRepository.js';
import { createFormSubmissionAnalyticsRepository } from '../formSubmissionAnalyticsRepository.js';

const mockPrisma = {
  formViewAnalytics: {
    create: vi.fn(),
    updateMany: vi.fn(),
    count: vi.fn(),
    groupBy: vi.fn(),
    findMany: vi.fn(),
  },
  formSubmissionAnalytics: {
    create: vi.fn(),
    count: vi.fn(),
    groupBy: vi.fn(),
    findMany: vi.fn(),
  },
};

describe('Form View Analytics Repository', () => {
  const mockContext = { prisma: mockPrisma as any };
  let repository: ReturnType<typeof createFormViewAnalyticsRepository>;

  beforeEach(() => {
    vi.clearAllMocks();
    repository = createFormViewAnalyticsRepository(mockContext);
  });

  describe('createViewEvent', () => {
    it('should create view event', async () => {
      const eventData = {
        id: 'view-123',
        formId: 'form-123',
        sessionId: 'session-123',
        userAgent: 'Mozilla/5.0',
        viewedAt: new Date(),
      };

      mockPrisma.formViewAnalytics.create.mockResolvedValue(eventData as any);

      const result = await repository.createViewEvent(eventData);

      expect(result).toEqual(eventData);
      expect(mockPrisma.formViewAnalytics.create).toHaveBeenCalledWith({
        data: eventData,
      });
    });
  });

  describe('updateSessionMetrics', () => {
    it('should update session metrics', async () => {
      const whereClause = { formId: 'form-123', sessionId: 'session-123' };
      const updates = { startedAt: new Date() };

      mockPrisma.formViewAnalytics.updateMany.mockResolvedValue({ count: 1 } as any);

      await repository.updateSessionMetrics(whereClause, updates);

      expect(mockPrisma.formViewAnalytics.updateMany).toHaveBeenCalledWith({
        where: whereClause,
        data: updates,
      });
    });
  });

  describe('count', () => {
    it('should count view analytics', async () => {
      mockPrisma.formViewAnalytics.count.mockResolvedValue(42);

      const result = await repository.count({ where: { formId: 'form-123' } });

      expect(result).toBe(42);
    });
  });

  describe('groupBy', () => {
    it('should group by field', async () => {
      const mockGroups = [
        { sessionId: 'session-1', _count: { sessionId: 5 } },
        { sessionId: 'session-2', _count: { sessionId: 3 } },
      ];

      mockPrisma.formViewAnalytics.groupBy.mockResolvedValue(mockGroups as any);

      const result = await repository.groupBy({
        by: ['sessionId'],
        where: { formId: 'form-123' },
      } as any);

      expect(result).toEqual(mockGroups);
    });
  });

  describe('findMany', () => {
    it('should find many view analytics', async () => {
      const mockAnalytics = [
        { id: 'view-1', formId: 'form-123' },
        { id: 'view-2', formId: 'form-123' },
      ];

      mockPrisma.formViewAnalytics.findMany.mockResolvedValue(mockAnalytics as any);

      const result = await repository.findMany({
        where: { formId: 'form-123' },
      });

      expect(result).toEqual(mockAnalytics);
    });
  });
});

describe('Form Submission Analytics Repository', () => {
  const mockContext = { prisma: mockPrisma as any };
  let repository: ReturnType<typeof createFormSubmissionAnalyticsRepository>;

  beforeEach(() => {
    vi.clearAllMocks();
    repository = createFormSubmissionAnalyticsRepository(mockContext);
  });

  describe('createSubmissionEvent', () => {
    it('should create submission event', async () => {
      const eventData = {
        id: 'submission-123',
        formId: 'form-123',
        responseId: 'response-123',
        sessionId: 'session-123',
        userAgent: 'Mozilla/5.0',
        submittedAt: new Date(),
      };

      mockPrisma.formSubmissionAnalytics.create.mockResolvedValue(eventData as any);

      const result = await repository.createSubmissionEvent(eventData);

      expect(result).toEqual(eventData);
      expect(mockPrisma.formSubmissionAnalytics.create).toHaveBeenCalledWith({
        data: eventData,
      });
    });
  });

  describe('count', () => {
    it('should count submission analytics', async () => {
      mockPrisma.formSubmissionAnalytics.count.mockResolvedValue(100);

      const result = await repository.count({ where: { formId: 'form-123' } });

      expect(result).toBe(100);
    });
  });

  describe('groupBy', () => {
    it('should group by field', async () => {
      const mockGroups = [
        { countryCode: 'USA', _count: { countryCode: 50 } },
        { countryCode: 'CAN', _count: { countryCode: 30 } },
      ];

      mockPrisma.formSubmissionAnalytics.groupBy.mockResolvedValue(mockGroups as any);

      const result = await repository.groupBy({
        by: ['countryCode'],
        where: { formId: 'form-123' },
      } as any);

      expect(result).toEqual(mockGroups);
    });
  });

  describe('findMany', () => {
    it('should find many submission analytics', async () => {
      const mockAnalytics = [
        { id: 'sub-1', formId: 'form-123' },
        { id: 'sub-2', formId: 'form-123' },
      ];

      mockPrisma.formSubmissionAnalytics.findMany.mockResolvedValue(mockAnalytics as any);

      const result = await repository.findMany({
        where: { formId: 'form-123' },
      });

      expect(result).toEqual(mockAnalytics);
    });
  });

  describe('create', () => {
    it('should create submission analytics', async () => {
      const analyticsData = {
        id: 'sub-123',
        formId: 'form-123',
        responseId: 'response-123',
        sessionId: 'session-123',
        userAgent: 'Mozilla/5.0',
      };

      mockPrisma.formSubmissionAnalytics.create.mockResolvedValue(analyticsData as any);

      const result = await repository.create({
        data: analyticsData,
      });

      expect(result).toEqual(analyticsData);
    });
  });
});
