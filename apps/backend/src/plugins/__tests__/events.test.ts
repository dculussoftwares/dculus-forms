import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  initializePluginEvents,
  emitFormSubmitted,
  emitPluginTest,
  getEventEmitter,
} from '../events.js';
import { executePluginsForForm } from '../executor.js';
import { logger } from '../../lib/logger.js';

vi.mock('../executor.js', () => ({
  executePluginsForForm: vi.fn(),
}));

vi.mock('../../lib/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

describe('events', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset event emitter by removing all listeners
    const emitter = getEventEmitter();
    emitter.removeAllListeners();
  });

  afterEach(() => {
    // Clean up listeners after each test
    const emitter = getEventEmitter();
    emitter.removeAllListeners();
  });

  describe('getEventEmitter', () => {
    it('returns an EventEmitter instance', () => {
      const emitter = getEventEmitter();

      expect(emitter).toBeDefined();
      expect(typeof emitter.on).toBe('function');
      expect(typeof emitter.emit).toBe('function');
      expect(typeof emitter.removeAllListeners).toBe('function');
    });

    it('returns same emitter instance on multiple calls', () => {
      const emitter1 = getEventEmitter();
      const emitter2 = getEventEmitter();

      expect(emitter1).toBe(emitter2);
    });

    it('has max listeners set to 100', () => {
      const emitter = getEventEmitter();

      expect(emitter.getMaxListeners()).toBe(100);
    });
  });

  describe('initializePluginEvents', () => {
    it('logs initialization message', () => {
      initializePluginEvents();

      expect(logger.info).toHaveBeenCalledWith('[Plugin Events] Initializing plugin event system...');
      expect(logger.info).toHaveBeenCalledWith('[Plugin Events] Plugin event system initialized successfully');
    });

    it('sets up plugin:event listener', () => {
      const emitter = getEventEmitter();
      const initialListenerCount = emitter.listenerCount('plugin:event');

      initializePluginEvents();

      const finalListenerCount = emitter.listenerCount('plugin:event');
      expect(finalListenerCount).toBeGreaterThan(initialListenerCount);
    });

    it('can be called multiple times', () => {
      initializePluginEvents();
      initializePluginEvents();
      initializePluginEvents();

      // Should not throw error and should log each time
      expect(logger.info).toHaveBeenCalledTimes(6); // 3 * 2 log calls
    });
  });

  describe('emitFormSubmitted', () => {
    beforeEach(() => {
      initializePluginEvents();
      vi.mocked(executePluginsForForm).mockResolvedValue({
        total: 1,
        succeeded: 1,
        failed: 0,
      });
    });

    it('emits form.submitted event with correct data', async () => {
      const responseData = {
        field1: 'value1',
        field2: 'value2',
      };

      emitFormSubmitted('form-123', 'org-456', responseData);

      // Wait for async event handler to complete
      await vi.waitFor(() => {
        expect(executePluginsForForm).toHaveBeenCalled();
      });

      expect(executePluginsForForm).toHaveBeenCalledWith('form-123', {
        type: 'form.submitted',
        formId: 'form-123',
        organizationId: 'org-456',
        data: responseData,
        timestamp: expect.any(Date),
      });
    });

    it('logs event trigger', async () => {
      emitFormSubmitted('form-123', 'org-456', {});

      await vi.waitFor(() => {
        expect(logger.info).toHaveBeenCalledWith(
          '[Plugin Events] Event triggered: form.submitted',
          {
            formId: 'form-123',
            organizationId: 'org-456',
          }
        );
      });
    });

    it('includes timestamp in event', async () => {
      const beforeEmit = new Date();

      emitFormSubmitted('form-123', 'org-456', {});

      await vi.waitFor(() => {
        expect(executePluginsForForm).toHaveBeenCalled();
      });

      const afterEmit = new Date();
      const eventArg = vi.mocked(executePluginsForForm).mock.calls[0][1];

      expect(eventArg.timestamp).toBeInstanceOf(Date);
      expect(eventArg.timestamp.getTime()).toBeGreaterThanOrEqual(beforeEmit.getTime());
      expect(eventArg.timestamp.getTime()).toBeLessThanOrEqual(afterEmit.getTime());
    });

    it('passes complex response data correctly', async () => {
      const complexData = {
        textField: 'Hello World',
        numberField: 42,
        selectField: 'option1',
        checkboxField: ['option1', 'option2'],
        nestedData: {
          subfield: 'value',
        },
      };

      emitFormSubmitted('form-123', 'org-456', complexData);

      await vi.waitFor(() => {
        expect(executePluginsForForm).toHaveBeenCalled();
      });

      const eventArg = vi.mocked(executePluginsForForm).mock.calls[0][1];
      expect(eventArg.data).toEqual(complexData);
    });

    it('handles errors from executePluginsForForm gracefully', async () => {
      vi.mocked(executePluginsForForm).mockRejectedValue(new Error('Execution failed'));

      emitFormSubmitted('form-123', 'org-456', {});

      await vi.waitFor(() => {
        expect(logger.error).toHaveBeenCalledWith(
          '[Plugin Events] Error executing plugins:',
          expect.any(Error)
        );
      });
    });

    it('does not throw error when executePluginsForForm fails', async () => {
      vi.mocked(executePluginsForForm).mockRejectedValue(new Error('Execution failed'));

      expect(() => {
        emitFormSubmitted('form-123', 'org-456', {});
      }).not.toThrow();
    });

    it('emits event synchronously but executes plugins asynchronously', async () => {
      // Use a fresh mock that tracks when it's called
      let executionStarted = false;
      vi.mocked(executePluginsForForm).mockImplementation(async () => {
        executionStarted = true;
        return { total: 1, succeeded: 1, failed: 0 };
      });

      emitFormSubmitted('form-123', 'org-456', {});

      // Give minimal time for the event to propagate
      await new Promise(resolve => setTimeout(resolve, 0));

      // Now it should be called
      expect(executionStarted).toBe(true);
      expect(executePluginsForForm).toHaveBeenCalled();
    });
  });

  describe('emitPluginTest', () => {
    beforeEach(() => {
      initializePluginEvents();
      vi.mocked(executePluginsForForm).mockResolvedValue({
        total: 1,
        succeeded: 1,
        failed: 0,
      });
    });

    it('emits plugin.test event with default test data', async () => {
      emitPluginTest('form-123', 'org-456');

      await vi.waitFor(() => {
        expect(executePluginsForForm).toHaveBeenCalled();
      });

      expect(executePluginsForForm).toHaveBeenCalledWith('form-123', {
        type: 'plugin.test',
        formId: 'form-123',
        organizationId: 'org-456',
        data: {
          test: true,
          message: 'This is a test event',
        },
        timestamp: expect.any(Date),
      });
    });

    it('merges custom test data with default test data', async () => {
      const customTestData = {
        customField: 'customValue',
        anotherField: 123,
      };

      emitPluginTest('form-123', 'org-456', customTestData);

      await vi.waitFor(() => {
        expect(executePluginsForForm).toHaveBeenCalled();
      });

      const eventArg = vi.mocked(executePluginsForForm).mock.calls[0][1];
      expect(eventArg.data).toEqual({
        test: true,
        message: 'This is a test event',
        customField: 'customValue',
        anotherField: 123,
      });
    });

    it('logs event trigger', async () => {
      emitPluginTest('form-123', 'org-456');

      await vi.waitFor(() => {
        expect(logger.info).toHaveBeenCalledWith(
          '[Plugin Events] Event triggered: plugin.test',
          {
            formId: 'form-123',
            organizationId: 'org-456',
          }
        );
      });
    });

    it('includes timestamp in event', async () => {
      const beforeEmit = new Date();

      emitPluginTest('form-123', 'org-456');

      await vi.waitFor(() => {
        expect(executePluginsForForm).toHaveBeenCalled();
      });

      const afterEmit = new Date();
      const eventArg = vi.mocked(executePluginsForForm).mock.calls[0][1];

      expect(eventArg.timestamp).toBeInstanceOf(Date);
      expect(eventArg.timestamp.getTime()).toBeGreaterThanOrEqual(beforeEmit.getTime());
      expect(eventArg.timestamp.getTime()).toBeLessThanOrEqual(afterEmit.getTime());
    });

    it('allows overriding default test data fields', async () => {
      const customTestData = {
        test: false,
        message: 'Custom message',
      };

      emitPluginTest('form-123', 'org-456', customTestData);

      await vi.waitFor(() => {
        expect(executePluginsForForm).toHaveBeenCalled();
      });

      const eventArg = vi.mocked(executePluginsForForm).mock.calls[0][1];
      expect(eventArg.data).toEqual({
        test: false,
        message: 'Custom message',
      });
    });

    it('handles empty test data object', async () => {
      emitPluginTest('form-123', 'org-456', {});

      await vi.waitFor(() => {
        expect(executePluginsForForm).toHaveBeenCalled();
      });

      const eventArg = vi.mocked(executePluginsForForm).mock.calls[0][1];
      expect(eventArg.data).toEqual({
        test: true,
        message: 'This is a test event',
      });
    });

    it('handles errors from executePluginsForForm gracefully', async () => {
      vi.mocked(executePluginsForForm).mockRejectedValue(new Error('Test failed'));

      emitPluginTest('form-123', 'org-456');

      await vi.waitFor(() => {
        expect(logger.error).toHaveBeenCalledWith(
          '[Plugin Events] Error executing plugins:',
          expect.any(Error)
        );
      });
    });
  });

  describe('event system integration', () => {
    beforeEach(() => {
      initializePluginEvents();
      vi.mocked(executePluginsForForm).mockResolvedValue({
        total: 1,
        succeeded: 1,
        failed: 0,
      });
    });

    it('handles multiple sequential event emissions', async () => {
      emitFormSubmitted('form-1', 'org-1', { field: 'value1' });
      emitFormSubmitted('form-2', 'org-1', { field: 'value2' });
      emitPluginTest('form-3', 'org-1');

      await vi.waitFor(() => {
        expect(executePluginsForForm).toHaveBeenCalledTimes(3);
      });

      expect(vi.mocked(executePluginsForForm).mock.calls[0][0]).toBe('form-1');
      expect(vi.mocked(executePluginsForForm).mock.calls[1][0]).toBe('form-2');
      expect(vi.mocked(executePluginsForForm).mock.calls[2][0]).toBe('form-3');
    });

    it('handles concurrent event emissions', async () => {
      const promises = [
        emitFormSubmitted('form-1', 'org-1', {}),
        emitFormSubmitted('form-2', 'org-1', {}),
        emitFormSubmitted('form-3', 'org-1', {}),
      ];

      await vi.waitFor(() => {
        expect(executePluginsForForm).toHaveBeenCalledTimes(3);
      });
    });

    it('maintains event data integrity across multiple emissions', async () => {
      const data1 = { field1: 'value1' };
      const data2 = { field2: 'value2' };

      emitFormSubmitted('form-1', 'org-1', data1);
      emitFormSubmitted('form-2', 'org-2', data2);

      await vi.waitFor(() => {
        expect(executePluginsForForm).toHaveBeenCalledTimes(2);
      });

      const call1 = vi.mocked(executePluginsForForm).mock.calls[0][1];
      const call2 = vi.mocked(executePluginsForForm).mock.calls[1][1];

      expect(call1.data).toEqual(data1);
      expect(call1.organizationId).toBe('org-1');
      expect(call2.data).toEqual(data2);
      expect(call2.organizationId).toBe('org-2');
    });

    it('continues processing events after error in one event handler', async () => {
      vi.mocked(executePluginsForForm)
        .mockRejectedValueOnce(new Error('First failed'))
        .mockResolvedValueOnce({ total: 1, succeeded: 1, failed: 0 });

      emitFormSubmitted('form-1', 'org-1', {});
      emitFormSubmitted('form-2', 'org-1', {});

      await vi.waitFor(() => {
        expect(executePluginsForForm).toHaveBeenCalledTimes(2);
      });

      expect(logger.error).toHaveBeenCalledTimes(1);
    });

    it('distinguishes between form.submitted and plugin.test events', async () => {
      emitFormSubmitted('form-123', 'org-456', { real: 'data' });
      emitPluginTest('form-123', 'org-456', { test: 'data' });

      await vi.waitFor(() => {
        expect(executePluginsForForm).toHaveBeenCalledTimes(2);
      });

      const formSubmittedCall = vi.mocked(executePluginsForForm).mock.calls[0][1];
      const pluginTestCall = vi.mocked(executePluginsForForm).mock.calls[1][1];

      expect(formSubmittedCall.type).toBe('form.submitted');
      expect(pluginTestCall.type).toBe('plugin.test');
    });
  });

  describe('event emitter behavior', () => {
    it('does not execute plugins when events not initialized', () => {
      // Don't call initializePluginEvents
      emitFormSubmitted('form-123', 'org-456', {});

      // Give time for async operations
      return new Promise((resolve) => {
        setTimeout(() => {
          expect(executePluginsForForm).not.toHaveBeenCalled();
          resolve(undefined);
        }, 100);
      });
    });

    it('supports multiple initializations without breaking', async () => {
      initializePluginEvents();
      initializePluginEvents();
      initializePluginEvents();

      vi.mocked(executePluginsForForm).mockResolvedValue({
        total: 1,
        succeeded: 1,
        failed: 0,
      });

      emitFormSubmitted('form-123', 'org-456', {});

      await vi.waitFor(() => {
        expect(executePluginsForForm).toHaveBeenCalled();
      });

      // Should be called multiple times due to multiple listeners
      expect(executePluginsForForm.mock.calls.length).toBeGreaterThanOrEqual(1);
    });

    it('handles very large event data payloads', async () => {
      initializePluginEvents();
      vi.mocked(executePluginsForForm).mockResolvedValue({
        total: 1,
        succeeded: 1,
        failed: 0,
      });

      const largeData: Record<string, any> = {};
      for (let i = 0; i < 1000; i++) {
        largeData[`field${i}`] = `value${i}`;
      }

      emitFormSubmitted('form-123', 'org-456', largeData);

      await vi.waitFor(() => {
        expect(executePluginsForForm).toHaveBeenCalled();
      });

      const eventArg = vi.mocked(executePluginsForForm).mock.calls[0][1];
      expect(Object.keys(eventArg.data).length).toBe(1000);
    });

    it('preserves event data types correctly', async () => {
      initializePluginEvents();
      vi.mocked(executePluginsForForm).mockResolvedValue({
        total: 1,
        succeeded: 1,
        failed: 0,
      });

      const complexData = {
        string: 'text',
        number: 123,
        boolean: true,
        null: null,
        undefined: undefined,
        array: [1, 2, 3],
        object: { nested: 'value' },
        date: new Date('2024-01-01'),
      };

      emitFormSubmitted('form-123', 'org-456', complexData);

      await vi.waitFor(() => {
        expect(executePluginsForForm).toHaveBeenCalled();
      });

      const eventArg = vi.mocked(executePluginsForForm).mock.calls[0][1];
      expect(eventArg.data.string).toBe('text');
      expect(eventArg.data.number).toBe(123);
      expect(eventArg.data.boolean).toBe(true);
      expect(eventArg.data.null).toBeNull();
      expect(eventArg.data.array).toEqual([1, 2, 3]);
      expect(eventArg.data.object).toEqual({ nested: 'value' });
      expect(eventArg.data.date).toBeInstanceOf(Date);
    });
  });
});
