import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  registerPlugin,
  getPluginHandler,
  hasPlugin,
  getAvailablePluginTypes,
  unregisterPlugin,
  clearRegistry,
} from '../registry.js';
import { logger } from '../../lib/logger.js';
import type { PluginHandler } from '../types.js';

vi.mock('../../lib/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('registry', () => {
  // Mock plugin handlers
  const mockWebhookHandler: PluginHandler = vi.fn().mockResolvedValue({ success: true });
  const mockEmailHandler: PluginHandler = vi.fn().mockResolvedValue({ sent: true });
  const mockQuizHandler: PluginHandler = vi.fn().mockResolvedValue({ graded: true });

  beforeEach(() => {
    vi.clearAllMocks();
    clearRegistry();
  });

  afterEach(() => {
    clearRegistry();
  });

  describe('registerPlugin', () => {
    it('registers a plugin handler successfully', () => {
      registerPlugin('webhook', mockWebhookHandler);

      expect(logger.info).toHaveBeenCalledWith('[Plugin Registry] Registered plugin type: webhook');
      expect(hasPlugin('webhook')).toBe(true);
      expect(getPluginHandler('webhook')).toBe(mockWebhookHandler);
    });

    it('registers multiple different plugin types', () => {
      registerPlugin('webhook', mockWebhookHandler);
      registerPlugin('email', mockEmailHandler);
      registerPlugin('quiz-grading', mockQuizHandler);

      expect(hasPlugin('webhook')).toBe(true);
      expect(hasPlugin('email')).toBe(true);
      expect(hasPlugin('quiz-grading')).toBe(true);
      expect(getAvailablePluginTypes()).toEqual(['webhook', 'email', 'quiz-grading']);
    });

    it('warns and overwrites when registering duplicate plugin type', () => {
      const firstHandler: PluginHandler = vi.fn().mockResolvedValue({ first: true });
      const secondHandler: PluginHandler = vi.fn().mockResolvedValue({ second: true });

      registerPlugin('webhook', firstHandler);
      registerPlugin('webhook', secondHandler);

      expect(logger.warn).toHaveBeenCalledWith(
        '[Plugin Registry] Plugin type "webhook" is already registered. Overwriting...'
      );
      expect(getPluginHandler('webhook')).toBe(secondHandler);
      expect(getPluginHandler('webhook')).not.toBe(firstHandler);
    });

    it('handles plugin types with special characters', () => {
      const handler: PluginHandler = vi.fn().mockResolvedValue({});

      registerPlugin('custom-plugin-v2', handler);
      registerPlugin('plugin_with_underscore', handler);
      registerPlugin('plugin.with.dots', handler);

      expect(hasPlugin('custom-plugin-v2')).toBe(true);
      expect(hasPlugin('plugin_with_underscore')).toBe(true);
      expect(hasPlugin('plugin.with.dots')).toBe(true);
    });

    it('logs each registration with correct plugin type', () => {
      registerPlugin('webhook', mockWebhookHandler);
      registerPlugin('email', mockEmailHandler);

      expect(logger.info).toHaveBeenCalledTimes(2);
      expect(logger.info).toHaveBeenNthCalledWith(1, '[Plugin Registry] Registered plugin type: webhook');
      expect(logger.info).toHaveBeenNthCalledWith(2, '[Plugin Registry] Registered plugin type: email');
    });
  });

  describe('getPluginHandler', () => {
    beforeEach(() => {
      registerPlugin('webhook', mockWebhookHandler);
      registerPlugin('email', mockEmailHandler);
    });

    it('returns handler for registered plugin type', () => {
      const handler = getPluginHandler('webhook');

      expect(handler).toBe(mockWebhookHandler);
    });

    it('returns undefined for unregistered plugin type', () => {
      const handler = getPluginHandler('nonexistent');

      expect(handler).toBeUndefined();
    });

    it('returns correct handler after multiple registrations', () => {
      const webhookHandler = getPluginHandler('webhook');
      const emailHandler = getPluginHandler('email');

      expect(webhookHandler).toBe(mockWebhookHandler);
      expect(emailHandler).toBe(mockEmailHandler);
      expect(webhookHandler).not.toBe(emailHandler);
    });

    it('returns updated handler after overwriting', () => {
      const newHandler: PluginHandler = vi.fn().mockResolvedValue({ updated: true });

      registerPlugin('webhook', newHandler);
      const handler = getPluginHandler('webhook');

      expect(handler).toBe(newHandler);
      expect(handler).not.toBe(mockWebhookHandler);
    });

    it('is case-sensitive for plugin type names', () => {
      const handler1 = getPluginHandler('webhook');
      const handler2 = getPluginHandler('Webhook');
      const handler3 = getPluginHandler('WEBHOOK');

      expect(handler1).toBe(mockWebhookHandler);
      expect(handler2).toBeUndefined();
      expect(handler3).toBeUndefined();
    });
  });

  describe('hasPlugin', () => {
    beforeEach(() => {
      registerPlugin('webhook', mockWebhookHandler);
      registerPlugin('email', mockEmailHandler);
    });

    it('returns true for registered plugin types', () => {
      expect(hasPlugin('webhook')).toBe(true);
      expect(hasPlugin('email')).toBe(true);
    });

    it('returns false for unregistered plugin types', () => {
      expect(hasPlugin('nonexistent')).toBe(false);
      expect(hasPlugin('unknown')).toBe(false);
    });

    it('returns false after plugin is unregistered', () => {
      expect(hasPlugin('webhook')).toBe(true);

      unregisterPlugin('webhook');

      expect(hasPlugin('webhook')).toBe(false);
    });

    it('returns false for empty string', () => {
      expect(hasPlugin('')).toBe(false);
    });

    it('is case-sensitive', () => {
      expect(hasPlugin('webhook')).toBe(true);
      expect(hasPlugin('Webhook')).toBe(false);
      expect(hasPlugin('WEBHOOK')).toBe(false);
    });
  });

  describe('getAvailablePluginTypes', () => {
    it('returns empty array when no plugins registered', () => {
      const types = getAvailablePluginTypes();

      expect(types).toEqual([]);
    });

    it('returns array of all registered plugin types', () => {
      registerPlugin('webhook', mockWebhookHandler);
      registerPlugin('email', mockEmailHandler);
      registerPlugin('quiz-grading', mockQuizHandler);

      const types = getAvailablePluginTypes();

      expect(types).toHaveLength(3);
      expect(types).toContain('webhook');
      expect(types).toContain('email');
      expect(types).toContain('quiz-grading');
    });

    it('updates returned array after new registration', () => {
      registerPlugin('webhook', mockWebhookHandler);

      let types = getAvailablePluginTypes();
      expect(types).toEqual(['webhook']);

      registerPlugin('email', mockEmailHandler);

      types = getAvailablePluginTypes();
      expect(types).toEqual(['webhook', 'email']);
    });

    it('updates returned array after unregistration', () => {
      registerPlugin('webhook', mockWebhookHandler);
      registerPlugin('email', mockEmailHandler);

      let types = getAvailablePluginTypes();
      expect(types).toHaveLength(2);

      unregisterPlugin('webhook');

      types = getAvailablePluginTypes();
      expect(types).toEqual(['email']);
    });

    it('does not include duplicates after overwriting', () => {
      const newHandler: PluginHandler = vi.fn().mockResolvedValue({});

      registerPlugin('webhook', mockWebhookHandler);
      registerPlugin('webhook', newHandler);

      const types = getAvailablePluginTypes();

      expect(types).toEqual(['webhook']);
      expect(types.length).toBe(1);
    });

    it('returns new array on each call', () => {
      registerPlugin('webhook', mockWebhookHandler);

      const types1 = getAvailablePluginTypes();
      const types2 = getAvailablePluginTypes();

      expect(types1).toEqual(types2);
      expect(types1).not.toBe(types2); // Different array instances
    });
  });

  describe('unregisterPlugin', () => {
    beforeEach(() => {
      registerPlugin('webhook', mockWebhookHandler);
      registerPlugin('email', mockEmailHandler);
      registerPlugin('quiz-grading', mockQuizHandler);
    });

    it('removes registered plugin and returns true', () => {
      const result = unregisterPlugin('webhook');

      expect(result).toBe(true);
      expect(hasPlugin('webhook')).toBe(false);
      expect(getPluginHandler('webhook')).toBeUndefined();
    });

    it('returns false when attempting to unregister nonexistent plugin', () => {
      const result = unregisterPlugin('nonexistent');

      expect(result).toBe(false);
    });

    it('does not affect other registered plugins', () => {
      unregisterPlugin('webhook');

      expect(hasPlugin('email')).toBe(true);
      expect(hasPlugin('quiz-grading')).toBe(true);
      expect(getPluginHandler('email')).toBe(mockEmailHandler);
      expect(getPluginHandler('quiz-grading')).toBe(mockQuizHandler);
    });

    it('allows re-registration after unregistering', () => {
      unregisterPlugin('webhook');
      expect(hasPlugin('webhook')).toBe(false);

      registerPlugin('webhook', mockWebhookHandler);
      expect(hasPlugin('webhook')).toBe(true);
    });

    it('returns false for empty string', () => {
      const result = unregisterPlugin('');

      expect(result).toBe(false);
    });

    it('is case-sensitive', () => {
      const result1 = unregisterPlugin('Webhook');
      const result2 = unregisterPlugin('WEBHOOK');

      expect(result1).toBe(false);
      expect(result2).toBe(false);
      expect(hasPlugin('webhook')).toBe(true); // Original still exists
    });
  });

  describe('clearRegistry', () => {
    it('removes all registered plugins', () => {
      registerPlugin('webhook', mockWebhookHandler);
      registerPlugin('email', mockEmailHandler);
      registerPlugin('quiz-grading', mockQuizHandler);

      expect(getAvailablePluginTypes()).toHaveLength(3);

      clearRegistry();

      expect(getAvailablePluginTypes()).toHaveLength(0);
      expect(hasPlugin('webhook')).toBe(false);
      expect(hasPlugin('email')).toBe(false);
      expect(hasPlugin('quiz-grading')).toBe(false);
    });

    it('allows registration after clearing', () => {
      registerPlugin('webhook', mockWebhookHandler);
      clearRegistry();

      registerPlugin('email', mockEmailHandler);

      expect(getAvailablePluginTypes()).toEqual(['email']);
      expect(hasPlugin('email')).toBe(true);
      expect(hasPlugin('webhook')).toBe(false);
    });

    it('is safe to call multiple times', () => {
      registerPlugin('webhook', mockWebhookHandler);

      clearRegistry();
      clearRegistry();
      clearRegistry();

      expect(getAvailablePluginTypes()).toHaveLength(0);
    });

    it('is safe to call on empty registry', () => {
      clearRegistry();

      expect(getAvailablePluginTypes()).toHaveLength(0);
    });
  });

  describe('integration scenarios', () => {
    it('handles complete lifecycle of plugin registration', () => {
      // Register
      registerPlugin('webhook', mockWebhookHandler);
      expect(hasPlugin('webhook')).toBe(true);

      // Get handler
      const handler1 = getPluginHandler('webhook');
      expect(handler1).toBe(mockWebhookHandler);

      // Overwrite
      const newHandler: PluginHandler = vi.fn().mockResolvedValue({ new: true });
      registerPlugin('webhook', newHandler);
      expect(logger.warn).toHaveBeenCalled();

      // Verify new handler
      const handler2 = getPluginHandler('webhook');
      expect(handler2).toBe(newHandler);
      expect(handler2).not.toBe(handler1);

      // Unregister
      const unregisterResult = unregisterPlugin('webhook');
      expect(unregisterResult).toBe(true);
      expect(hasPlugin('webhook')).toBe(false);
    });

    it('manages multiple plugins independently', () => {
      // Register all
      registerPlugin('webhook', mockWebhookHandler);
      registerPlugin('email', mockEmailHandler);
      registerPlugin('quiz-grading', mockQuizHandler);

      expect(getAvailablePluginTypes()).toHaveLength(3);

      // Unregister one
      unregisterPlugin('email');
      expect(getAvailablePluginTypes()).toHaveLength(2);
      expect(hasPlugin('webhook')).toBe(true);
      expect(hasPlugin('email')).toBe(false);
      expect(hasPlugin('quiz-grading')).toBe(true);

      // Re-register
      registerPlugin('email', mockEmailHandler);
      expect(getAvailablePluginTypes()).toHaveLength(3);

      // Clear all
      clearRegistry();
      expect(getAvailablePluginTypes()).toHaveLength(0);
    });

    it('maintains handler references correctly', async () => {
      const webhookResult = { webhook: true };
      const emailResult = { email: true };

      const webhookHandler: PluginHandler = vi.fn().mockResolvedValue(webhookResult);
      const emailHandler: PluginHandler = vi.fn().mockResolvedValue(emailResult);

      registerPlugin('webhook', webhookHandler);
      registerPlugin('email', emailHandler);

      const retrievedWebhook = getPluginHandler('webhook');
      const retrievedEmail = getPluginHandler('email');

      expect(retrievedWebhook).toBe(webhookHandler);
      expect(retrievedEmail).toBe(emailHandler);

      // Test execution
      const mockEvent = {
        type: 'form.submitted' as const,
        formId: 'form-1',
        organizationId: 'org-1',
        data: {},
        timestamp: new Date(),
      };
      const mockContext = {} as any;

      const result1 = await retrievedWebhook!({ config: { type: 'webhook' } }, mockEvent, mockContext);
      const result2 = await retrievedEmail!({ config: { type: 'email' } }, mockEvent, mockContext);

      expect(result1).toEqual(webhookResult);
      expect(result2).toEqual(emailResult);
    });
  });
});
