import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  initializeSubscriptionEvents,
  emitFormViewed,
  emitFormSubmitted,
  emitUsageLimitReached,
  emitUsageLimitExceeded,
  getSubscriptionEventEmitter,
} from '../events.js';
import { SubscriptionEventType } from '../types.js';
import { logger } from '../../lib/logger.js';

// Mock logger
vi.mock('../../lib/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('subscription events', () => {
  let eventEmitter: any;

  beforeEach(() => {
    vi.clearAllMocks();
    eventEmitter = getSubscriptionEventEmitter();
    // Clear all listeners before each test
    eventEmitter.removeAllListeners();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('getSubscriptionEventEmitter', () => {
    it('should return singleton event emitter', () => {
      const emitter1 = getSubscriptionEventEmitter();
      const emitter2 = getSubscriptionEventEmitter();

      expect(emitter1).toBe(emitter2);
    });

    it('should have increased max listeners', () => {
      const emitter = getSubscriptionEventEmitter();

      expect(emitter.getMaxListeners()).toBe(100);
    });
  });

  describe('initializeSubscriptionEvents', () => {
    it('should initialize event system and set up listeners', () => {
      initializeSubscriptionEvents();

      expect(logger.info).toHaveBeenCalledWith(
        '[Subscription Events] Initializing subscription event system...'
      );
      expect(logger.info).toHaveBeenCalledWith(
        '[Subscription Events] Subscription event system initialized successfully'
      );
    });

    it('should set up form viewed event listener', () => {
      initializeSubscriptionEvents();

      const listenerCount = eventEmitter.listenerCount(SubscriptionEventType.FORM_VIEWED);
      expect(listenerCount).toBeGreaterThan(0);
    });

    it('should set up form submitted event listener', () => {
      initializeSubscriptionEvents();

      const listenerCount = eventEmitter.listenerCount(SubscriptionEventType.FORM_SUBMITTED);
      expect(listenerCount).toBeGreaterThan(0);
    });

    it('should set up usage limit reached event listener', () => {
      initializeSubscriptionEvents();

      const listenerCount = eventEmitter.listenerCount(SubscriptionEventType.USAGE_LIMIT_REACHED);
      expect(listenerCount).toBeGreaterThan(0);
    });

    it('should set up usage limit exceeded event listener', () => {
      initializeSubscriptionEvents();

      const listenerCount = eventEmitter.listenerCount(SubscriptionEventType.USAGE_LIMIT_EXCEEDED);
      expect(listenerCount).toBeGreaterThan(0);
    });

    it('should log form viewed events', async () => {
      initializeSubscriptionEvents();

      const event = {
        type: SubscriptionEventType.FORM_VIEWED,
        organizationId: 'org-1',
        formId: 'form-1',
        timestamp: new Date(),
        data: {
          sessionId: 'session-123',
          userAgent: 'Mozilla/5.0',
        },
      };

      eventEmitter.emit(SubscriptionEventType.FORM_VIEWED, event);

      // Wait for async handler
      await new Promise(resolve => setImmediate(resolve));

      expect(logger.info).toHaveBeenCalledWith('[Subscription Events] Form viewed:', {
        organizationId: 'org-1',
        formId: 'form-1',
      });
    });

    it('should log form submitted events', async () => {
      initializeSubscriptionEvents();

      const event = {
        type: SubscriptionEventType.FORM_SUBMITTED,
        organizationId: 'org-1',
        formId: 'form-1',
        timestamp: new Date(),
        data: {
          responseId: 'response-123',
        },
      };

      eventEmitter.emit(SubscriptionEventType.FORM_SUBMITTED, event);

      // Wait for async handler
      await new Promise(resolve => setImmediate(resolve));

      expect(logger.info).toHaveBeenCalledWith('[Subscription Events] Form submitted:', {
        organizationId: 'org-1',
        formId: 'form-1',
        responseId: 'response-123',
      });
    });

    it('should log usage limit reached events', async () => {
      initializeSubscriptionEvents();

      const event = {
        type: SubscriptionEventType.USAGE_LIMIT_REACHED,
        organizationId: 'org-1',
        formId: 'form-1',
        timestamp: new Date(),
        data: {
          usageType: 'views' as const,
          current: 80,
          limit: 100,
          percentage: 80,
        },
      };

      eventEmitter.emit(SubscriptionEventType.USAGE_LIMIT_REACHED, event);

      // Wait for async handler
      await new Promise(resolve => setImmediate(resolve));

      expect(logger.warn).toHaveBeenCalledWith('[Subscription Events] Usage limit warning:', {
        organizationId: 'org-1',
        usageType: 'views',
        current: 80,
        limit: 100,
        percentage: 80,
      });
    });

    it('should log usage limit exceeded events', async () => {
      initializeSubscriptionEvents();

      const event = {
        type: SubscriptionEventType.USAGE_LIMIT_EXCEEDED,
        organizationId: 'org-1',
        formId: 'form-1',
        timestamp: new Date(),
        data: {
          usageType: 'submissions' as const,
          current: 101,
          limit: 100,
        },
      };

      eventEmitter.emit(SubscriptionEventType.USAGE_LIMIT_EXCEEDED, event);

      // Wait for async handler
      await new Promise(resolve => setImmediate(resolve));

      expect(logger.error).toHaveBeenCalledWith('[Subscription Events] Usage limit exceeded:', {
        organizationId: 'org-1',
        usageType: 'submissions',
        current: 101,
        limit: 100,
      });
    });
  });

  describe('emitFormViewed', () => {
    it('should emit form viewed event with full data', () => {
      const mockHandler = vi.fn();
      eventEmitter.on(SubscriptionEventType.FORM_VIEWED, mockHandler);

      emitFormViewed('org-1', 'form-1', 'session-123', 'Mozilla/5.0');

      expect(mockHandler).toHaveBeenCalledWith({
        type: SubscriptionEventType.FORM_VIEWED,
        organizationId: 'org-1',
        formId: 'form-1',
        timestamp: expect.any(Date),
        data: {
          sessionId: 'session-123',
          userAgent: 'Mozilla/5.0',
        },
      });
    });

    it('should emit form viewed event without user agent', () => {
      const mockHandler = vi.fn();
      eventEmitter.on(SubscriptionEventType.FORM_VIEWED, mockHandler);

      emitFormViewed('org-1', 'form-1', 'session-123');

      expect(mockHandler).toHaveBeenCalledWith({
        type: SubscriptionEventType.FORM_VIEWED,
        organizationId: 'org-1',
        formId: 'form-1',
        timestamp: expect.any(Date),
        data: {
          sessionId: 'session-123',
          userAgent: undefined,
        },
      });
    });

    it('should emit multiple form viewed events', () => {
      const mockHandler = vi.fn();
      eventEmitter.on(SubscriptionEventType.FORM_VIEWED, mockHandler);

      emitFormViewed('org-1', 'form-1', 'session-1');
      emitFormViewed('org-1', 'form-2', 'session-2');
      emitFormViewed('org-2', 'form-3', 'session-3');

      expect(mockHandler).toHaveBeenCalledTimes(3);
    });

    it('should include timestamp in event', () => {
      const mockHandler = vi.fn();
      eventEmitter.on(SubscriptionEventType.FORM_VIEWED, mockHandler);

      const beforeEmit = new Date();
      emitFormViewed('org-1', 'form-1', 'session-123');
      const afterEmit = new Date();

      const call = mockHandler.mock.calls[0][0];
      expect(call.timestamp).toBeInstanceOf(Date);
      expect(call.timestamp.getTime()).toBeGreaterThanOrEqual(beforeEmit.getTime());
      expect(call.timestamp.getTime()).toBeLessThanOrEqual(afterEmit.getTime());
    });
  });

  describe('emitFormSubmitted', () => {
    it('should emit form submitted event with all required data', () => {
      const mockHandler = vi.fn();
      eventEmitter.on(SubscriptionEventType.FORM_SUBMITTED, mockHandler);

      emitFormSubmitted('org-1', 'form-1', 'response-123');

      expect(mockHandler).toHaveBeenCalledWith({
        type: SubscriptionEventType.FORM_SUBMITTED,
        organizationId: 'org-1',
        formId: 'form-1',
        timestamp: expect.any(Date),
        data: {
          responseId: 'response-123',
        },
      });
    });

    it('should emit multiple form submitted events', () => {
      const mockHandler = vi.fn();
      eventEmitter.on(SubscriptionEventType.FORM_SUBMITTED, mockHandler);

      emitFormSubmitted('org-1', 'form-1', 'response-1');
      emitFormSubmitted('org-1', 'form-1', 'response-2');
      emitFormSubmitted('org-2', 'form-2', 'response-3');

      expect(mockHandler).toHaveBeenCalledTimes(3);
    });

    it('should include timestamp in event', () => {
      const mockHandler = vi.fn();
      eventEmitter.on(SubscriptionEventType.FORM_SUBMITTED, mockHandler);

      const beforeEmit = new Date();
      emitFormSubmitted('org-1', 'form-1', 'response-123');
      const afterEmit = new Date();

      const call = mockHandler.mock.calls[0][0];
      expect(call.timestamp).toBeInstanceOf(Date);
      expect(call.timestamp.getTime()).toBeGreaterThanOrEqual(beforeEmit.getTime());
      expect(call.timestamp.getTime()).toBeLessThanOrEqual(afterEmit.getTime());
    });
  });

  describe('emitUsageLimitReached', () => {
    it('should emit usage limit reached event for views', () => {
      const mockHandler = vi.fn();
      eventEmitter.on(SubscriptionEventType.USAGE_LIMIT_REACHED, mockHandler);

      emitUsageLimitReached('org-1', 'form-1', 'views', 80, 100, 80);

      expect(mockHandler).toHaveBeenCalledWith({
        type: SubscriptionEventType.USAGE_LIMIT_REACHED,
        organizationId: 'org-1',
        formId: 'form-1',
        timestamp: expect.any(Date),
        data: {
          usageType: 'views',
          current: 80,
          limit: 100,
          percentage: 80,
        },
      });
    });

    it('should emit usage limit reached event for submissions', () => {
      const mockHandler = vi.fn();
      eventEmitter.on(SubscriptionEventType.USAGE_LIMIT_REACHED, mockHandler);

      emitUsageLimitReached('org-1', 'form-1', 'submissions', 40, 50, 80);

      expect(mockHandler).toHaveBeenCalledWith({
        type: SubscriptionEventType.USAGE_LIMIT_REACHED,
        organizationId: 'org-1',
        formId: 'form-1',
        timestamp: expect.any(Date),
        data: {
          usageType: 'submissions',
          current: 40,
          limit: 50,
          percentage: 80,
        },
      });
    });

    it('should handle different percentage values', () => {
      const mockHandler = vi.fn();
      eventEmitter.on(SubscriptionEventType.USAGE_LIMIT_REACHED, mockHandler);

      emitUsageLimitReached('org-1', 'form-1', 'views', 85, 100, 85);
      emitUsageLimitReached('org-1', 'form-2', 'views', 90, 100, 90);
      emitUsageLimitReached('org-1', 'form-3', 'views', 95, 100, 95);

      expect(mockHandler).toHaveBeenCalledTimes(3);
      expect(mockHandler.mock.calls[0][0].data.percentage).toBe(85);
      expect(mockHandler.mock.calls[1][0].data.percentage).toBe(90);
      expect(mockHandler.mock.calls[2][0].data.percentage).toBe(95);
    });

    it('should include timestamp in event', () => {
      const mockHandler = vi.fn();
      eventEmitter.on(SubscriptionEventType.USAGE_LIMIT_REACHED, mockHandler);

      const beforeEmit = new Date();
      emitUsageLimitReached('org-1', 'form-1', 'views', 80, 100, 80);
      const afterEmit = new Date();

      const call = mockHandler.mock.calls[0][0];
      expect(call.timestamp).toBeInstanceOf(Date);
      expect(call.timestamp.getTime()).toBeGreaterThanOrEqual(beforeEmit.getTime());
      expect(call.timestamp.getTime()).toBeLessThanOrEqual(afterEmit.getTime());
    });
  });

  describe('emitUsageLimitExceeded', () => {
    it('should emit usage limit exceeded event for views', () => {
      const mockHandler = vi.fn();
      eventEmitter.on(SubscriptionEventType.USAGE_LIMIT_EXCEEDED, mockHandler);

      emitUsageLimitExceeded('org-1', 'form-1', 'views', 101, 100);

      expect(mockHandler).toHaveBeenCalledWith({
        type: SubscriptionEventType.USAGE_LIMIT_EXCEEDED,
        organizationId: 'org-1',
        formId: 'form-1',
        timestamp: expect.any(Date),
        data: {
          usageType: 'views',
          current: 101,
          limit: 100,
        },
      });
    });

    it('should emit usage limit exceeded event for submissions', () => {
      const mockHandler = vi.fn();
      eventEmitter.on(SubscriptionEventType.USAGE_LIMIT_EXCEEDED, mockHandler);

      emitUsageLimitExceeded('org-1', 'form-1', 'submissions', 51, 50);

      expect(mockHandler).toHaveBeenCalledWith({
        type: SubscriptionEventType.USAGE_LIMIT_EXCEEDED,
        organizationId: 'org-1',
        formId: 'form-1',
        timestamp: expect.any(Date),
        data: {
          usageType: 'submissions',
          current: 51,
          limit: 50,
        },
      });
    });

    it('should handle significantly exceeded limits', () => {
      const mockHandler = vi.fn();
      eventEmitter.on(SubscriptionEventType.USAGE_LIMIT_EXCEEDED, mockHandler);

      emitUsageLimitExceeded('org-1', 'form-1', 'views', 200, 100);

      expect(mockHandler).toHaveBeenCalledWith({
        type: SubscriptionEventType.USAGE_LIMIT_EXCEEDED,
        organizationId: 'org-1',
        formId: 'form-1',
        timestamp: expect.any(Date),
        data: {
          usageType: 'views',
          current: 200,
          limit: 100,
        },
      });
    });

    it('should emit multiple exceeded events', () => {
      const mockHandler = vi.fn();
      eventEmitter.on(SubscriptionEventType.USAGE_LIMIT_EXCEEDED, mockHandler);

      emitUsageLimitExceeded('org-1', 'form-1', 'views', 101, 100);
      emitUsageLimitExceeded('org-1', 'form-2', 'submissions', 51, 50);
      emitUsageLimitExceeded('org-2', 'form-3', 'views', 201, 200);

      expect(mockHandler).toHaveBeenCalledTimes(3);
    });

    it('should include timestamp in event', () => {
      const mockHandler = vi.fn();
      eventEmitter.on(SubscriptionEventType.USAGE_LIMIT_EXCEEDED, mockHandler);

      const beforeEmit = new Date();
      emitUsageLimitExceeded('org-1', 'form-1', 'views', 101, 100);
      const afterEmit = new Date();

      const call = mockHandler.mock.calls[0][0];
      expect(call.timestamp).toBeInstanceOf(Date);
      expect(call.timestamp.getTime()).toBeGreaterThanOrEqual(beforeEmit.getTime());
      expect(call.timestamp.getTime()).toBeLessThanOrEqual(afterEmit.getTime());
    });
  });

  describe('event integration', () => {
    it('should allow multiple handlers for same event', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      const handler3 = vi.fn();

      eventEmitter.on(SubscriptionEventType.FORM_VIEWED, handler1);
      eventEmitter.on(SubscriptionEventType.FORM_VIEWED, handler2);
      eventEmitter.on(SubscriptionEventType.FORM_VIEWED, handler3);

      emitFormViewed('org-1', 'form-1', 'session-123');

      expect(handler1).toHaveBeenCalled();
      expect(handler2).toHaveBeenCalled();
      expect(handler3).toHaveBeenCalled();
    });

    it('should not affect other event types', () => {
      const viewedHandler = vi.fn();
      const submittedHandler = vi.fn();

      eventEmitter.on(SubscriptionEventType.FORM_VIEWED, viewedHandler);
      eventEmitter.on(SubscriptionEventType.FORM_SUBMITTED, submittedHandler);

      emitFormViewed('org-1', 'form-1', 'session-123');

      expect(viewedHandler).toHaveBeenCalled();
      expect(submittedHandler).not.toHaveBeenCalled();
    });

    it('should handle events emitted in quick succession', () => {
      const mockHandler = vi.fn();
      eventEmitter.on(SubscriptionEventType.FORM_VIEWED, mockHandler);

      for (let i = 0; i < 100; i++) {
        emitFormViewed(`org-${i}`, `form-${i}`, `session-${i}`);
      }

      expect(mockHandler).toHaveBeenCalledTimes(100);
    });

    it('should preserve event data integrity', () => {
      const mockHandler = vi.fn();
      eventEmitter.on(SubscriptionEventType.USAGE_LIMIT_EXCEEDED, mockHandler);

      const testData = {
        organizationId: 'org-test',
        formId: 'form-test',
        usageType: 'views' as const,
        current: 150,
        limit: 100,
      };

      emitUsageLimitExceeded(
        testData.organizationId,
        testData.formId,
        testData.usageType,
        testData.current,
        testData.limit
      );

      const emittedEvent = mockHandler.mock.calls[0][0];
      expect(emittedEvent.organizationId).toBe(testData.organizationId);
      expect(emittedEvent.formId).toBe(testData.formId);
      expect(emittedEvent.data.usageType).toBe(testData.usageType);
      expect(emittedEvent.data.current).toBe(testData.current);
      expect(emittedEvent.data.limit).toBe(testData.limit);
    });
  });
});
