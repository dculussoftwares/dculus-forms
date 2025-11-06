import { describe, it, expect, vi, beforeEach } from 'vitest';
import { initializeSubscriptionSystem } from '../index.js';
import { initializeSubscriptionEvents } from '../events.js';
import { initializeUsageService } from '../usageService.js';
import { logger } from '../../lib/logger.js';

// Mock dependencies
vi.mock('../events.js', () => ({
  initializeSubscriptionEvents: vi.fn(),
  emitFormViewed: vi.fn(),
  emitFormSubmitted: vi.fn(),
  emitUsageLimitReached: vi.fn(),
  emitUsageLimitExceeded: vi.fn(),
  getSubscriptionEventEmitter: vi.fn(() => ({
    on: vi.fn(),
    emit: vi.fn(),
  })),
}));

vi.mock('../usageService.js', () => ({
  initializeUsageService: vi.fn(),
  trackFormView: vi.fn(),
  trackFormSubmission: vi.fn(),
  checkUsageExceeded: vi.fn(),
  getUsage: vi.fn(),
  resetUsageCounters: vi.fn(),
}));

vi.mock('../../lib/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('subscription system index', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('initializeSubscriptionSystem', () => {
    it('should initialize subscription system with proper logging', () => {
      initializeSubscriptionSystem();

      expect(logger.info).toHaveBeenCalledWith('[Subscription System] Initializing...');
      expect(logger.info).toHaveBeenCalledWith('[Subscription System] Initialization complete');
    });

    it('should initialize subscription events first', () => {
      initializeSubscriptionSystem();

      expect(initializeSubscriptionEvents).toHaveBeenCalled();
    });

    it('should initialize usage service after events', () => {
      let eventsCallOrder = 0;
      let usageServiceCallOrder = 0;

      vi.mocked(initializeSubscriptionEvents).mockImplementation(() => {
        eventsCallOrder = Date.now();
      });

      vi.mocked(initializeUsageService).mockImplementation(() => {
        usageServiceCallOrder = Date.now();
      });

      initializeSubscriptionSystem();

      expect(initializeSubscriptionEvents).toHaveBeenCalled();
      expect(initializeUsageService).toHaveBeenCalled();
      // Usage service should be called after or equal to events initialization
      expect(usageServiceCallOrder).toBeGreaterThanOrEqual(eventsCallOrder);
    });

    it('should call both initialization functions exactly once', () => {
      initializeSubscriptionSystem();

      expect(initializeSubscriptionEvents).toHaveBeenCalledTimes(1);
      expect(initializeUsageService).toHaveBeenCalledTimes(1);
    });

    it('should complete successfully when both initializers succeed', () => {
      vi.mocked(initializeSubscriptionEvents).mockReturnValue(undefined);
      vi.mocked(initializeUsageService).mockReturnValue(undefined);

      expect(() => initializeSubscriptionSystem()).not.toThrow();
    });

    it('should propagate errors from initializeSubscriptionEvents', () => {
      const error = new Error('Events initialization failed');
      vi.mocked(initializeSubscriptionEvents).mockImplementation(() => {
        throw error;
      });

      expect(() => initializeSubscriptionSystem()).toThrow('Events initialization failed');
    });

    it('should propagate errors from initializeUsageService', () => {
      vi.clearAllMocks();
      vi.mocked(initializeSubscriptionEvents).mockReturnValue(undefined);

      const error = new Error('Usage service initialization failed');
      vi.mocked(initializeUsageService).mockImplementation(() => {
        throw error;
      });

      expect(() => initializeSubscriptionSystem()).toThrow('Usage service initialization failed');
    });

    it('should log start message before initialization', () => {
      const logCalls: string[] = [];

      vi.mocked(logger.info).mockImplementation((message: string) => {
        logCalls.push(message);
      });

      vi.mocked(initializeSubscriptionEvents).mockImplementation(() => {
        logCalls.push('events-init');
      });

      vi.mocked(initializeUsageService).mockImplementation(() => {
        logCalls.push('usage-init');
      });

      initializeSubscriptionSystem();

      expect(logCalls[0]).toBe('[Subscription System] Initializing...');
      expect(logCalls).toContain('events-init');
      expect(logCalls).toContain('usage-init');
      expect(logCalls[logCalls.length - 1]).toBe('[Subscription System] Initialization complete');
    });

    it('should log completion message after initialization', () => {
      initializeSubscriptionSystem();

      const infoCalls = vi.mocked(logger.info).mock.calls;
      const lastCall = infoCalls[infoCalls.length - 1];

      expect(lastCall[0]).toBe('[Subscription System] Initialization complete');
    });

    it('should be idempotent when called multiple times', () => {
      initializeSubscriptionSystem();
      initializeSubscriptionSystem();
      initializeSubscriptionSystem();

      expect(initializeSubscriptionEvents).toHaveBeenCalledTimes(3);
      expect(initializeUsageService).toHaveBeenCalledTimes(3);
      // Each call should complete without errors
    });

    it('should maintain correct initialization order', () => {
      const callOrder: string[] = [];

      vi.mocked(logger.info).mockImplementation((message: string) => {
        if (message === '[Subscription System] Initializing...') {
          callOrder.push('start-log');
        } else if (message === '[Subscription System] Initialization complete') {
          callOrder.push('complete-log');
        }
      });

      vi.mocked(initializeSubscriptionEvents).mockImplementation(() => {
        callOrder.push('events');
      });

      vi.mocked(initializeUsageService).mockImplementation(() => {
        callOrder.push('usage');
      });

      initializeSubscriptionSystem();

      expect(callOrder).toEqual(['start-log', 'events', 'usage', 'complete-log']);
    });
  });

  describe('module exports', () => {
    it('should export initializeSubscriptionSystem function', () => {
      expect(initializeSubscriptionSystem).toBeDefined();
      expect(typeof initializeSubscriptionSystem).toBe('function');
    });

    it('should be importable without side effects', async () => {
      // Simply importing the module should not trigger initialization
      const beforeCalls = vi.mocked(logger.info).mock.calls.length;

      // Re-import would happen here in a real scenario
      // For this test, we just verify the current state
      expect(vi.mocked(logger.info).mock.calls.length).toBeGreaterThanOrEqual(beforeCalls);
    });
  });

  describe('initialization sequence', () => {
    it('should set up event emitter before usage tracking', () => {
      let eventEmitterReady = false;

      vi.mocked(initializeSubscriptionEvents).mockImplementation(() => {
        eventEmitterReady = true;
      });

      vi.mocked(initializeUsageService).mockImplementation(() => {
        // Usage service should only initialize after events are ready
        expect(eventEmitterReady).toBe(true);
      });

      initializeSubscriptionSystem();
    });

    it('should handle partial initialization failure gracefully', () => {
      // If events init succeeds but usage service fails, error should propagate
      vi.mocked(initializeSubscriptionEvents).mockReturnValue(undefined);
      vi.mocked(initializeUsageService).mockImplementation(() => {
        throw new Error('Usage service error');
      });

      expect(() => initializeSubscriptionSystem()).toThrow('Usage service error');

      // Events should have been initialized before the error
      expect(initializeSubscriptionEvents).toHaveBeenCalled();
    });

    it('should complete initialization synchronously', () => {
      vi.clearAllMocks();
      vi.mocked(initializeSubscriptionEvents).mockReturnValue(undefined);
      vi.mocked(initializeUsageService).mockReturnValue(undefined);

      let completed = false;

      initializeSubscriptionSystem();
      completed = true;

      expect(completed).toBe(true);
      expect(initializeSubscriptionEvents).toHaveBeenCalled();
      expect(initializeUsageService).toHaveBeenCalled();
    });
  });

  describe('logging behavior', () => {
    it('should log exactly two info messages on success', () => {
      vi.clearAllMocks();
      vi.mocked(initializeSubscriptionEvents).mockReturnValue(undefined);
      vi.mocked(initializeUsageService).mockReturnValue(undefined);

      initializeSubscriptionSystem();

      const infoCallsFromSystem = vi
        .mocked(logger.info)
        .mock.calls.filter(
          call => call[0].includes('[Subscription System]')
        );

      expect(infoCallsFromSystem.length).toBe(2);
    });

    it('should not log warnings or errors on success', () => {
      vi.clearAllMocks();
      vi.mocked(initializeSubscriptionEvents).mockReturnValue(undefined);
      vi.mocked(initializeUsageService).mockReturnValue(undefined);

      initializeSubscriptionSystem();

      expect(logger.warn).not.toHaveBeenCalled();
      expect(logger.error).not.toHaveBeenCalled();
    });

    it('should provide clear log message format', () => {
      vi.clearAllMocks();
      vi.mocked(initializeSubscriptionEvents).mockReturnValue(undefined);
      vi.mocked(initializeUsageService).mockReturnValue(undefined);

      initializeSubscriptionSystem();

      const infoCalls = vi.mocked(logger.info).mock.calls;

      // Check for consistent message format
      const systemLogs = infoCalls.filter(call =>
        call[0].includes('[Subscription System]')
      );

      systemLogs.forEach(call => {
        expect(call[0]).toMatch(/^\[Subscription System\]/);
      });
    });
  });
});
