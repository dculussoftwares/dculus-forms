import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { executePlugin, executePluginsForForm } from '../executor.js';
import { prisma } from '../../lib/prisma.js';
import { getPluginHandler } from '../registry.js';
import { createPluginContext } from '../context.js';
import type { PluginEvent, PluginHandler } from '../types.js';
import { generateId } from '@dculus/utils';

vi.mock('../../lib/prisma.js', () => ({
  prisma: {
    formPlugin: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    pluginDelivery: {
      create: vi.fn(),
    },
  },
}));

vi.mock('../registry.js', () => ({
  getPluginHandler: vi.fn(),
}));

vi.mock('../context.js', () => ({
  createPluginContext: vi.fn(),
}));

vi.mock('@dculus/utils', () => ({
  generateId: vi.fn(),
}));

describe('executor', () => {
  const mockLogger = {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  };

  const mockContext = {
    logger: mockLogger,
    prisma,
    getFormById: vi.fn(),
    getResponseById: vi.fn(),
    getResponsesByFormId: vi.fn(),
    getOrganization: vi.fn(),
    getUserById: vi.fn(),
    sendEmail: vi.fn(),
  };

  const mockEvent: PluginEvent = {
    type: 'form.submitted',
    formId: 'form-123',
    organizationId: 'org-456',
    data: { field1: 'value1', field2: 'value2' },
    timestamp: new Date('2024-05-01T12:00:00Z'),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createPluginContext).mockReturnValue(mockContext as any);
    vi.mocked(generateId).mockReturnValue('delivery-123');
  });

  describe('executePlugin', () => {
    it('successfully executes a plugin and records delivery', async () => {
      const mockPlugin = {
        id: 'plugin-1',
        name: 'Test Plugin',
        type: 'webhook',
        enabled: true,
        config: { url: 'https://example.com/webhook' },
      };

      const mockHandler: PluginHandler = vi.fn().mockResolvedValue({ success: true });

      vi.mocked(prisma.formPlugin.findUnique).mockResolvedValue(mockPlugin as any);
      vi.mocked(getPluginHandler).mockReturnValue(mockHandler);
      vi.mocked(prisma.pluginDelivery.create).mockResolvedValue({} as any);

      const result = await executePlugin('plugin-1', mockEvent);

      expect(prisma.formPlugin.findUnique).toHaveBeenCalledWith({
        where: { id: 'plugin-1' },
      });
      expect(getPluginHandler).toHaveBeenCalledWith('webhook');
      expect(mockHandler).toHaveBeenCalledWith(
        { config: mockPlugin.config },
        mockEvent,
        mockContext
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Executing plugin: Test Plugin (webhook)',
        { pluginId: 'plugin-1', eventType: 'form.submitted' }
      );
      expect(prisma.pluginDelivery.create).toHaveBeenCalledWith({
        data: {
          id: 'delivery-123',
          pluginId: 'plugin-1',
          eventType: 'form.submitted',
          status: 'success',
          payload: mockEvent.data,
          response: { success: true },
          deliveredAt: expect.any(Date),
        },
      });
      expect(result).toEqual({ success: true });
    });

    it('returns error when plugin is not found', async () => {
      vi.mocked(prisma.formPlugin.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.pluginDelivery.create).mockResolvedValue({} as any);

      const result = await executePlugin('nonexistent-plugin', mockEvent);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Plugin execution failed: nonexistent-plugin',
        expect.any(Error)
      );
      expect(prisma.pluginDelivery.create).toHaveBeenCalledWith({
        data: {
          id: 'delivery-123',
          pluginId: 'nonexistent-plugin',
          eventType: 'form.submitted',
          status: 'failed',
          payload: mockEvent.data,
          errorMessage: 'Plugin nonexistent-plugin not found',
          deliveredAt: expect.any(Date),
        },
      });
      expect(result).toEqual({ success: false, error: 'Plugin nonexistent-plugin not found' });
    });

    it('returns error when plugin is disabled', async () => {
      const mockPlugin = {
        id: 'plugin-1',
        name: 'Disabled Plugin',
        type: 'webhook',
        enabled: false,
        config: {},
      };

      vi.mocked(prisma.formPlugin.findUnique).mockResolvedValue(mockPlugin as any);

      const result = await executePlugin('plugin-1', mockEvent);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Plugin plugin-1 is disabled, skipping execution'
      );
      expect(getPluginHandler).not.toHaveBeenCalled();
      expect(prisma.pluginDelivery.create).not.toHaveBeenCalled();
      expect(result).toEqual({ success: false, error: 'Plugin is disabled' });
    });

    it('returns error when no handler is registered for plugin type', async () => {
      const mockPlugin = {
        id: 'plugin-1',
        name: 'Unknown Plugin',
        type: 'unknown-type',
        enabled: true,
        config: {},
      };

      vi.mocked(prisma.formPlugin.findUnique).mockResolvedValue(mockPlugin as any);
      vi.mocked(getPluginHandler).mockReturnValue(undefined);
      vi.mocked(prisma.pluginDelivery.create).mockResolvedValue({} as any);

      const result = await executePlugin('plugin-1', mockEvent);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Plugin execution failed: plugin-1',
        expect.any(Error)
      );
      expect(prisma.pluginDelivery.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          status: 'failed',
          errorMessage: 'No handler registered for plugin type: unknown-type',
        }),
      });
      expect(result).toEqual({
        success: false,
        error: 'No handler registered for plugin type: unknown-type',
      });
    });

    it('handles plugin handler execution errors and records failed delivery', async () => {
      const mockPlugin = {
        id: 'plugin-1',
        name: 'Failing Plugin',
        type: 'webhook',
        enabled: true,
        config: { url: 'https://example.com/webhook' },
      };

      const mockHandler: PluginHandler = vi.fn().mockRejectedValue(
        new Error('Network error')
      );

      vi.mocked(prisma.formPlugin.findUnique).mockResolvedValue(mockPlugin as any);
      vi.mocked(getPluginHandler).mockReturnValue(mockHandler);
      vi.mocked(prisma.pluginDelivery.create).mockResolvedValue({} as any);

      const result = await executePlugin('plugin-1', mockEvent);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Plugin execution failed: plugin-1',
        expect.any(Error)
      );
      expect(prisma.pluginDelivery.create).toHaveBeenCalledWith({
        data: {
          id: 'delivery-123',
          pluginId: 'plugin-1',
          eventType: 'form.submitted',
          status: 'failed',
          payload: mockEvent.data,
          errorMessage: 'Network error',
          deliveredAt: expect.any(Date),
        },
      });
      expect(result).toEqual({ success: false, error: 'Network error' });
    });

    it('logs execution duration for successful plugin execution', async () => {
      const mockPlugin = {
        id: 'plugin-1',
        name: 'Test Plugin',
        type: 'webhook',
        enabled: true,
        config: {},
      };

      const mockHandler: PluginHandler = vi.fn().mockResolvedValue({ data: 'response' });

      vi.mocked(prisma.formPlugin.findUnique).mockResolvedValue(mockPlugin as any);
      vi.mocked(getPluginHandler).mockReturnValue(mockHandler);
      vi.mocked(prisma.pluginDelivery.create).mockResolvedValue({} as any);

      await executePlugin('plugin-1', mockEvent);

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Plugin executed successfully: Test Plugin',
        {
          pluginId: 'plugin-1',
          duration: expect.stringMatching(/^\d+ms$/),
        }
      );
    });

    it('handles handler returning null result', async () => {
      const mockPlugin = {
        id: 'plugin-1',
        name: 'Test Plugin',
        type: 'webhook',
        enabled: true,
        config: {},
      };

      const mockHandler: PluginHandler = vi.fn().mockResolvedValue(null);

      vi.mocked(prisma.formPlugin.findUnique).mockResolvedValue(mockPlugin as any);
      vi.mocked(getPluginHandler).mockReturnValue(mockHandler);
      vi.mocked(prisma.pluginDelivery.create).mockResolvedValue({} as any);

      const result = await executePlugin('plugin-1', mockEvent);

      expect(prisma.pluginDelivery.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          status: 'success',
          response: {},
        }),
      });
      expect(result).toEqual({ success: true });
    });

    it('handles errors without error message gracefully', async () => {
      const mockPlugin = {
        id: 'plugin-1',
        name: 'Test Plugin',
        type: 'webhook',
        enabled: true,
        config: {},
      };

      const mockHandler: PluginHandler = vi.fn().mockRejectedValue({});

      vi.mocked(prisma.formPlugin.findUnique).mockResolvedValue(mockPlugin as any);
      vi.mocked(getPluginHandler).mockReturnValue(mockHandler);
      vi.mocked(prisma.pluginDelivery.create).mockResolvedValue({} as any);

      const result = await executePlugin('plugin-1', mockEvent);

      expect(prisma.pluginDelivery.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          status: 'failed',
          errorMessage: 'Unknown error',
        }),
      });
      expect(result).toEqual({ success: false, error: 'Unknown error' });
    });
  });

  describe('executePluginsForForm', () => {
    it('executes all enabled plugins for form that match event type', async () => {
      const mockPlugins = [
        { id: 'plugin-1', name: 'Plugin 1', type: 'webhook', enabled: true, events: ['form.submitted'], config: {} },
        { id: 'plugin-2', name: 'Plugin 2', type: 'email', enabled: true, events: ['form.submitted'], config: {} },
      ];

      const mockHandler1: PluginHandler = vi.fn().mockResolvedValue({ success: true });
      const mockHandler2: PluginHandler = vi.fn().mockResolvedValue({ success: true });

      vi.mocked(prisma.formPlugin.findMany).mockResolvedValue(mockPlugins as any);
      vi.mocked(getPluginHandler)
        .mockReturnValueOnce(mockHandler1)
        .mockReturnValueOnce(mockHandler2);
      vi.mocked(prisma.formPlugin.findUnique)
        .mockResolvedValueOnce(mockPlugins[0] as any)
        .mockResolvedValueOnce(mockPlugins[1] as any);
      vi.mocked(prisma.pluginDelivery.create)
        .mockResolvedValueOnce({} as any)
        .mockResolvedValueOnce({} as any);

      const result = await executePluginsForForm('form-123', mockEvent);

      expect(prisma.formPlugin.findMany).toHaveBeenCalledWith({
        where: {
          formId: 'form-123',
          enabled: true,
          events: {
            has: 'form.submitted',
          },
        },
      });
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Found 2 plugin(s) for form form-123',
        { eventType: 'form.submitted' }
      );
      expect(result).toEqual({ total: 2, succeeded: 2, failed: 0 });
    });

    it('returns zero counts when no plugins are found', async () => {
      vi.mocked(prisma.formPlugin.findMany).mockResolvedValue([]);

      const result = await executePluginsForForm('form-123', mockEvent);

      expect(mockLogger.info).toHaveBeenCalledWith(
        'No plugins found for form form-123 and event form.submitted'
      );
      expect(result).toEqual({ total: 0, succeeded: 0, failed: 0 });
    });

    it('handles mix of successful and failed plugin executions', async () => {
      const mockPlugins = [
        { id: 'plugin-1', name: 'Plugin 1', type: 'webhook', enabled: true, events: ['form.submitted'], config: {} },
        { id: 'plugin-2', name: 'Plugin 2', type: 'email', enabled: true, events: ['form.submitted'], config: {} },
        { id: 'plugin-3', name: 'Plugin 3', type: 'webhook', enabled: true, events: ['form.submitted'], config: {} },
      ];

      const mockHandler1: PluginHandler = vi.fn().mockResolvedValue({ success: true });
      const mockHandler2: PluginHandler = vi.fn().mockRejectedValue(new Error('Handler error'));
      const mockHandler3: PluginHandler = vi.fn().mockResolvedValue({ success: true });

      vi.mocked(prisma.formPlugin.findMany).mockResolvedValue(mockPlugins as any);
      vi.mocked(getPluginHandler)
        .mockReturnValueOnce(mockHandler1)
        .mockReturnValueOnce(mockHandler2)
        .mockReturnValueOnce(mockHandler3);
      vi.mocked(prisma.formPlugin.findUnique)
        .mockResolvedValueOnce(mockPlugins[0] as any)
        .mockResolvedValueOnce(mockPlugins[1] as any)
        .mockResolvedValueOnce(mockPlugins[2] as any);
      vi.mocked(prisma.pluginDelivery.create)
        .mockResolvedValueOnce({} as any)
        .mockResolvedValueOnce({} as any)
        .mockResolvedValueOnce({} as any);

      const result = await executePluginsForForm('form-123', mockEvent);

      expect(result).toEqual({ total: 3, succeeded: 2, failed: 1 });
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Plugin Plugin 2 failed',
        expect.objectContaining({
          pluginId: 'plugin-2',
        })
      );
    });

    it('executes plugins in parallel using Promise.allSettled', async () => {
      const mockPlugins = [
        { id: 'plugin-1', name: 'Plugin 1', type: 'webhook', enabled: true, events: ['form.submitted'], config: {} },
        { id: 'plugin-2', name: 'Plugin 2', type: 'email', enabled: true, events: ['form.submitted'], config: {} },
      ];

      let callOrder: number[] = [];
      const mockHandler1: PluginHandler = vi.fn().mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
        callOrder.push(1);
        return { success: true };
      });
      const mockHandler2: PluginHandler = vi.fn().mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        callOrder.push(2);
        return { success: true };
      });

      vi.mocked(prisma.formPlugin.findMany).mockResolvedValue(mockPlugins as any);
      vi.mocked(getPluginHandler)
        .mockReturnValueOnce(mockHandler1)
        .mockReturnValueOnce(mockHandler2);
      vi.mocked(prisma.formPlugin.findUnique)
        .mockResolvedValueOnce(mockPlugins[0] as any)
        .mockResolvedValueOnce(mockPlugins[1] as any);
      vi.mocked(prisma.pluginDelivery.create)
        .mockResolvedValue({} as any);

      const result = await executePluginsForForm('form-123', mockEvent);

      // Plugin 2 should finish before plugin 1 due to parallel execution
      expect(callOrder).toEqual([2, 1]);
      expect(result).toEqual({ total: 2, succeeded: 2, failed: 0 });
    });

    it('handles errors from findMany gracefully', async () => {
      vi.mocked(prisma.formPlugin.findMany).mockRejectedValue(
        new Error('Database error')
      );

      await expect(executePluginsForForm('form-123', mockEvent)).rejects.toThrow('Database error');
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error executing plugins for form',
        expect.any(Error)
      );
    });

    it('logs completion summary with correct counts', async () => {
      const mockPlugins = [
        { id: 'plugin-1', name: 'Plugin 1', type: 'webhook', enabled: true, events: ['form.submitted'], config: {} },
      ];

      const mockHandler: PluginHandler = vi.fn().mockResolvedValue({ success: true });

      vi.mocked(prisma.formPlugin.findMany).mockResolvedValue(mockPlugins as any);
      vi.mocked(getPluginHandler).mockReturnValue(mockHandler);
      vi.mocked(prisma.formPlugin.findUnique).mockResolvedValue(mockPlugins[0] as any);
      vi.mocked(prisma.pluginDelivery.create).mockResolvedValue({} as any);

      await executePluginsForForm('form-123', mockEvent);

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Plugin execution completed for form form-123',
        {
          total: 1,
          succeeded: 1,
          failed: 0,
        }
      );
    });

    it('counts plugins that return success: false as failed', async () => {
      const mockPlugins = [
        { id: 'plugin-1', name: 'Plugin 1', type: 'webhook', enabled: true, events: ['form.submitted'], config: {} },
      ];

      const mockHandler: PluginHandler = vi.fn().mockResolvedValue({ success: true });

      vi.mocked(prisma.formPlugin.findMany).mockResolvedValue(mockPlugins as any);
      vi.mocked(getPluginHandler).mockReturnValue(mockHandler);
      vi.mocked(prisma.formPlugin.findUnique).mockResolvedValue({
        ...mockPlugins[0],
        enabled: false,
      } as any);

      const result = await executePluginsForForm('form-123', mockEvent);

      expect(result).toEqual({ total: 1, succeeded: 0, failed: 1 });
    });

    it('handles rejected promises in allSettled', async () => {
      const mockPlugins = [
        { id: 'plugin-1', name: 'Plugin 1', type: 'webhook', enabled: true, events: ['form.submitted'], config: {} },
      ];

      vi.mocked(prisma.formPlugin.findMany).mockResolvedValue(mockPlugins as any);
      vi.mocked(prisma.formPlugin.findUnique).mockRejectedValue(
        new Error('Unexpected error')
      );

      const result = await executePluginsForForm('form-123', mockEvent);

      expect(result).toEqual({ total: 1, succeeded: 0, failed: 1 });
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Plugin Plugin 1 failed',
        expect.objectContaining({
          pluginId: 'plugin-1',
        })
      );
    });
  });
});
