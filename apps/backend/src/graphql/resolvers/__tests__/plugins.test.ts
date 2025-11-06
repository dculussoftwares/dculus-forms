import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { pluginsResolvers } from '../plugins.js';
import { GraphQLError } from 'graphql';
import * as betterAuthMiddleware from '../../../middleware/better-auth-middleware.js';
import * as formSharingResolvers from '../formSharing.js';
import * as pluginEvents from '../../../plugins/events.js';
import { prisma } from '../../../lib/prisma.js';

// Mock all dependencies
vi.mock('../../../middleware/better-auth-middleware.js');
vi.mock('../formSharing.js');
vi.mock('../../../plugins/events.js');
vi.mock('../../../lib/prisma.js', () => ({
  prisma: {
    formPlugin: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    pluginDelivery: {
      findMany: vi.fn(),
    },
  },
}));
vi.mock('../../../lib/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));
vi.mock('@dculus/utils', async () => {
  const actual = await vi.importActual<typeof import('@dculus/utils')>('@dculus/utils');
  return {
    ...actual,
    generateId: vi.fn(() => 'generated-plugin-id'),
  };
});

describe('Plugins Resolvers', () => {
  const mockContext = {
    auth: {
      user: {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
      },
      session: { id: 'session-123' },
    },
  };

  const mockForm = {
    id: 'form-123',
    title: 'Test Form',
    organizationId: 'org-123',
    createdById: 'user-123',
  };

  const mockWebhookPlugin = {
    id: 'plugin-123',
    formId: 'form-123',
    type: 'webhook',
    name: 'Test Webhook',
    config: {
      url: 'https://example.com/webhook',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    },
    events: ['form.submitted'],
    enabled: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  };

  const mockEmailPlugin = {
    id: 'plugin-456',
    formId: 'form-123',
    type: 'email',
    name: 'Email Notification',
    config: {
      recipients: ['admin@example.com'],
      subject: 'New Form Submission',
      body: 'You have a new submission from {{respondent_email}}',
    },
    events: ['form.submitted'],
    enabled: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  };

  const mockQuizPlugin = {
    id: 'plugin-789',
    formId: 'form-123',
    type: 'quiz-grading',
    name: 'Quiz Auto-Grading',
    config: {
      fields: [
        {
          fieldId: 'field-1',
          correctAnswer: 'Option A',
          marks: 10,
        },
        {
          fieldId: 'field-2',
          correctAnswer: 'Option B',
          marks: 15,
        },
      ],
      passingPercentage: 60,
    },
    events: ['form.submitted'],
    enabled: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Query: formPlugins', () => {
    it('should return all plugins for a form when user has viewer access', async () => {
      vi.mocked(betterAuthMiddleware.requireAuth).mockReturnValue(undefined);
      vi.mocked(formSharingResolvers.checkFormAccess).mockResolvedValue({
        hasAccess: true,
        form: mockForm as any,
      });
      vi.mocked(prisma.formPlugin.findMany).mockResolvedValue([
        mockWebhookPlugin,
        mockEmailPlugin,
        mockQuizPlugin,
      ] as any);

      const result = await pluginsResolvers.Query.formPlugins(
        {},
        { formId: 'form-123' },
        mockContext
      );

      expect(betterAuthMiddleware.requireAuth).toHaveBeenCalledWith(mockContext.auth);
      expect(formSharingResolvers.checkFormAccess).toHaveBeenCalledWith(
        'user-123',
        'form-123',
        formSharingResolvers.PermissionLevel.VIEWER
      );
      expect(prisma.formPlugin.findMany).toHaveBeenCalledWith({
        where: { formId: 'form-123' },
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toHaveLength(3);
      expect(result).toEqual([mockWebhookPlugin, mockEmailPlugin, mockQuizPlugin]);
    });

    it('should return empty array when no plugins exist', async () => {
      vi.mocked(betterAuthMiddleware.requireAuth).mockReturnValue(undefined);
      vi.mocked(formSharingResolvers.checkFormAccess).mockResolvedValue({
        hasAccess: true,
        form: mockForm as any,
      });
      vi.mocked(prisma.formPlugin.findMany).mockResolvedValue([]);

      const result = await pluginsResolvers.Query.formPlugins(
        {},
        { formId: 'form-123' },
        mockContext
      );

      expect(result).toEqual([]);
    });

    it('should throw error when user lacks access to form', async () => {
      vi.mocked(betterAuthMiddleware.requireAuth).mockReturnValue(undefined);
      vi.mocked(formSharingResolvers.checkFormAccess).mockResolvedValue({
        hasAccess: false,
        form: null,
      });

      await expect(
        pluginsResolvers.Query.formPlugins({}, { formId: 'form-123' }, mockContext)
      ).rejects.toThrow(GraphQLError);
      await expect(
        pluginsResolvers.Query.formPlugins({}, { formId: 'form-123' }, mockContext)
      ).rejects.toThrow('Access denied: You do not have permission to view plugins for this form');
    });

    it('should throw error when user is not authenticated', async () => {
      vi.mocked(betterAuthMiddleware.requireAuth).mockImplementation(() => {
        throw new GraphQLError('Authentication required');
      });

      await expect(
        pluginsResolvers.Query.formPlugins({}, { formId: 'form-123' }, mockContext)
      ).rejects.toThrow('Authentication required');
    });
  });

  describe('Query: formPlugin', () => {
    it('should return plugin by ID when user has access', async () => {
      vi.mocked(betterAuthMiddleware.requireAuth).mockReturnValue(undefined);
      vi.mocked(prisma.formPlugin.findUnique).mockResolvedValue({
        ...mockWebhookPlugin,
        form: mockForm,
      } as any);
      vi.mocked(formSharingResolvers.checkFormAccess).mockResolvedValue({
        hasAccess: true,
        form: mockForm as any,
      });

      const result = await pluginsResolvers.Query.formPlugin(
        {},
        { id: 'plugin-123' },
        mockContext
      );

      expect(betterAuthMiddleware.requireAuth).toHaveBeenCalledWith(mockContext.auth);
      expect(prisma.formPlugin.findUnique).toHaveBeenCalledWith({
        where: { id: 'plugin-123' },
        include: { form: true },
      });
      expect(formSharingResolvers.checkFormAccess).toHaveBeenCalledWith(
        'user-123',
        'form-123',
        formSharingResolvers.PermissionLevel.VIEWER
      );
      expect(result).toEqual({
        ...mockWebhookPlugin,
        form: mockForm,
      });
    });

    it('should throw error when plugin not found', async () => {
      vi.mocked(betterAuthMiddleware.requireAuth).mockReturnValue(undefined);
      vi.mocked(prisma.formPlugin.findUnique).mockResolvedValue(null);

      await expect(
        pluginsResolvers.Query.formPlugin({}, { id: 'invalid-plugin' }, mockContext)
      ).rejects.toThrow('Plugin not found');
    });

    it('should throw error when user lacks access to form', async () => {
      vi.mocked(betterAuthMiddleware.requireAuth).mockReturnValue(undefined);
      vi.mocked(prisma.formPlugin.findUnique).mockResolvedValue({
        ...mockWebhookPlugin,
        form: mockForm,
      } as any);
      vi.mocked(formSharingResolvers.checkFormAccess).mockResolvedValue({
        hasAccess: false,
        form: null,
      });

      await expect(
        pluginsResolvers.Query.formPlugin({}, { id: 'plugin-123' }, mockContext)
      ).rejects.toThrow('Access denied: You do not have permission to view this plugin');
    });
  });

  describe('Query: pluginDeliveries', () => {
    const mockDeliveries = [
      {
        id: 'delivery-1',
        pluginId: 'plugin-123',
        status: 'success',
        payload: { test: 'data' },
        response: { status: 200 },
        deliveredAt: new Date('2024-01-01'),
      },
      {
        id: 'delivery-2',
        pluginId: 'plugin-123',
        status: 'failure',
        payload: { test: 'data' },
        response: { status: 500, error: 'Server error' },
        deliveredAt: new Date('2024-01-02'),
      },
    ];

    it('should return plugin deliveries when user has access', async () => {
      vi.mocked(betterAuthMiddleware.requireAuth).mockReturnValue(undefined);
      vi.mocked(prisma.formPlugin.findUnique).mockResolvedValue(mockWebhookPlugin as any);
      vi.mocked(formSharingResolvers.checkFormAccess).mockResolvedValue({
        hasAccess: true,
        form: mockForm as any,
      });
      vi.mocked(prisma.pluginDelivery.findMany).mockResolvedValue(mockDeliveries as any);

      const result = await pluginsResolvers.Query.pluginDeliveries(
        {},
        { pluginId: 'plugin-123', limit: 50 },
        mockContext
      );

      expect(prisma.formPlugin.findUnique).toHaveBeenCalledWith({
        where: { id: 'plugin-123' },
      });
      expect(formSharingResolvers.checkFormAccess).toHaveBeenCalledWith(
        'user-123',
        'form-123',
        formSharingResolvers.PermissionLevel.VIEWER
      );
      expect(prisma.pluginDelivery.findMany).toHaveBeenCalledWith({
        where: { pluginId: 'plugin-123' },
        orderBy: { deliveredAt: 'desc' },
        take: 50,
      });
      expect(result).toEqual(mockDeliveries);
    });

    it('should use custom limit when provided', async () => {
      vi.mocked(betterAuthMiddleware.requireAuth).mockReturnValue(undefined);
      vi.mocked(prisma.formPlugin.findUnique).mockResolvedValue(mockWebhookPlugin as any);
      vi.mocked(formSharingResolvers.checkFormAccess).mockResolvedValue({
        hasAccess: true,
        form: mockForm as any,
      });
      vi.mocked(prisma.pluginDelivery.findMany).mockResolvedValue(mockDeliveries as any);

      await pluginsResolvers.Query.pluginDeliveries(
        {},
        { pluginId: 'plugin-123', limit: 10 },
        mockContext
      );

      expect(prisma.pluginDelivery.findMany).toHaveBeenCalledWith({
        where: { pluginId: 'plugin-123' },
        orderBy: { deliveredAt: 'desc' },
        take: 10,
      });
    });

    it('should throw error when plugin not found', async () => {
      vi.mocked(betterAuthMiddleware.requireAuth).mockReturnValue(undefined);
      vi.mocked(prisma.formPlugin.findUnique).mockResolvedValue(null);

      await expect(
        pluginsResolvers.Query.pluginDeliveries(
          {},
          { pluginId: 'invalid-plugin' },
          mockContext
        )
      ).rejects.toThrow('Plugin not found');
    });

    it('should throw error when user lacks access', async () => {
      vi.mocked(betterAuthMiddleware.requireAuth).mockReturnValue(undefined);
      vi.mocked(prisma.formPlugin.findUnique).mockResolvedValue(mockWebhookPlugin as any);
      vi.mocked(formSharingResolvers.checkFormAccess).mockResolvedValue({
        hasAccess: false,
        form: null,
      });

      await expect(
        pluginsResolvers.Query.pluginDeliveries(
          {},
          { pluginId: 'plugin-123' },
          mockContext
        )
      ).rejects.toThrow('Access denied: You do not have permission to view plugin deliveries');
    });
  });

  describe('Mutation: createFormPlugin', () => {
    it('should create webhook plugin with editor access', async () => {
      const input = {
        formId: 'form-123',
        type: 'webhook',
        name: 'Test Webhook',
        config: {
          url: 'https://example.com/webhook',
          method: 'POST',
        },
        events: ['form.submitted'],
        enabled: true,
      };

      vi.mocked(betterAuthMiddleware.requireAuth).mockReturnValue(undefined);
      vi.mocked(formSharingResolvers.checkFormAccess).mockResolvedValue({
        hasAccess: true,
        form: mockForm as any,
      });
      vi.mocked(prisma.formPlugin.create).mockResolvedValue(mockWebhookPlugin as any);

      const result = await pluginsResolvers.Mutation.createFormPlugin(
        {},
        { input },
        mockContext
      );

      expect(betterAuthMiddleware.requireAuth).toHaveBeenCalledWith(mockContext.auth);
      expect(formSharingResolvers.checkFormAccess).toHaveBeenCalledWith(
        'user-123',
        'form-123',
        formSharingResolvers.PermissionLevel.EDITOR
      );
      expect(prisma.formPlugin.create).toHaveBeenCalledWith({
        data: {
          id: 'generated-plugin-id',
          formId: 'form-123',
          type: 'webhook',
          name: 'Test Webhook',
          config: input.config,
          events: ['form.submitted'],
          enabled: true,
        },
      });
      expect(result).toEqual(mockWebhookPlugin);
    });

    it('should create email plugin', async () => {
      const input = {
        formId: 'form-123',
        type: 'email',
        name: 'Email Notification',
        config: {
          recipients: ['admin@example.com'],
          subject: 'New Submission',
          body: 'Form submitted',
        },
        events: ['form.submitted'],
      };

      vi.mocked(betterAuthMiddleware.requireAuth).mockReturnValue(undefined);
      vi.mocked(formSharingResolvers.checkFormAccess).mockResolvedValue({
        hasAccess: true,
        form: mockForm as any,
      });
      vi.mocked(prisma.formPlugin.create).mockResolvedValue(mockEmailPlugin as any);

      const result = await pluginsResolvers.Mutation.createFormPlugin(
        {},
        { input },
        mockContext
      );

      expect(result).toEqual(mockEmailPlugin);
    });

    it('should create quiz grading plugin', async () => {
      const input = {
        formId: 'form-123',
        type: 'quiz-grading',
        name: 'Quiz Auto-Grading',
        config: {
          fields: [
            { fieldId: 'field-1', correctAnswer: 'Option A', marks: 10 },
          ],
          passingPercentage: 60,
        },
        events: ['form.submitted'],
      };

      vi.mocked(betterAuthMiddleware.requireAuth).mockReturnValue(undefined);
      vi.mocked(formSharingResolvers.checkFormAccess).mockResolvedValue({
        hasAccess: true,
        form: mockForm as any,
      });
      vi.mocked(prisma.formPlugin.create).mockResolvedValue(mockQuizPlugin as any);

      const result = await pluginsResolvers.Mutation.createFormPlugin(
        {},
        { input },
        mockContext
      );

      expect(result).toEqual(mockQuizPlugin);
    });

    it('should default enabled to true when not provided', async () => {
      const input = {
        formId: 'form-123',
        type: 'webhook',
        name: 'Test Webhook',
        config: { url: 'https://example.com/webhook' },
        events: ['form.submitted'],
      };

      vi.mocked(betterAuthMiddleware.requireAuth).mockReturnValue(undefined);
      vi.mocked(formSharingResolvers.checkFormAccess).mockResolvedValue({
        hasAccess: true,
        form: mockForm as any,
      });
      vi.mocked(prisma.formPlugin.create).mockResolvedValue(mockWebhookPlugin as any);

      await pluginsResolvers.Mutation.createFormPlugin({}, { input }, mockContext);

      expect(prisma.formPlugin.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            enabled: true,
          }),
        })
      );
    });

    it('should throw error when user lacks editor access', async () => {
      const input = {
        formId: 'form-123',
        type: 'webhook',
        name: 'Test Webhook',
        config: { url: 'https://example.com/webhook' },
        events: ['form.submitted'],
      };

      vi.mocked(betterAuthMiddleware.requireAuth).mockReturnValue(undefined);
      vi.mocked(formSharingResolvers.checkFormAccess).mockResolvedValue({
        hasAccess: false,
        form: null,
      });

      await expect(
        pluginsResolvers.Mutation.createFormPlugin({}, { input }, mockContext)
      ).rejects.toThrow('Access denied: You need EDITOR access to create plugins for this form');
    });

    it('should throw error for invalid event types', async () => {
      const input = {
        formId: 'form-123',
        type: 'webhook',
        name: 'Test Webhook',
        config: { url: 'https://example.com/webhook' },
        events: ['form.submitted', 'invalid.event', 'another.invalid'],
      };

      vi.mocked(betterAuthMiddleware.requireAuth).mockReturnValue(undefined);
      vi.mocked(formSharingResolvers.checkFormAccess).mockResolvedValue({
        hasAccess: true,
        form: mockForm as any,
      });

      await expect(
        pluginsResolvers.Mutation.createFormPlugin({}, { input }, mockContext)
      ).rejects.toThrow('Invalid event types: invalid.event, another.invalid. Supported events: form.submitted, plugin.test');
    });

    it('should accept plugin.test event', async () => {
      const input = {
        formId: 'form-123',
        type: 'webhook',
        name: 'Test Webhook',
        config: { url: 'https://example.com/webhook' },
        events: ['form.submitted', 'plugin.test'],
      };

      vi.mocked(betterAuthMiddleware.requireAuth).mockReturnValue(undefined);
      vi.mocked(formSharingResolvers.checkFormAccess).mockResolvedValue({
        hasAccess: true,
        form: mockForm as any,
      });
      vi.mocked(prisma.formPlugin.create).mockResolvedValue(mockWebhookPlugin as any);

      await pluginsResolvers.Mutation.createFormPlugin({}, { input }, mockContext);

      expect(prisma.formPlugin.create).toHaveBeenCalled();
    });
  });

  describe('Mutation: updateFormPlugin', () => {
    it('should update plugin with editor access', async () => {
      const input = {
        name: 'Updated Webhook',
        config: { url: 'https://example.com/updated' },
        enabled: false,
      };

      vi.mocked(betterAuthMiddleware.requireAuth).mockReturnValue(undefined);
      vi.mocked(prisma.formPlugin.findUnique).mockResolvedValue(mockWebhookPlugin as any);
      vi.mocked(formSharingResolvers.checkFormAccess).mockResolvedValue({
        hasAccess: true,
        form: mockForm as any,
      });
      vi.mocked(prisma.formPlugin.update).mockResolvedValue({
        ...mockWebhookPlugin,
        ...input,
      } as any);

      const result = await pluginsResolvers.Mutation.updateFormPlugin(
        {},
        { id: 'plugin-123', input },
        mockContext
      );

      expect(betterAuthMiddleware.requireAuth).toHaveBeenCalledWith(mockContext.auth);
      expect(prisma.formPlugin.findUnique).toHaveBeenCalledWith({
        where: { id: 'plugin-123' },
      });
      expect(formSharingResolvers.checkFormAccess).toHaveBeenCalledWith(
        'user-123',
        'form-123',
        formSharingResolvers.PermissionLevel.EDITOR
      );
      expect(prisma.formPlugin.update).toHaveBeenCalledWith({
        where: { id: 'plugin-123' },
        data: {
          ...input,
          updatedAt: expect.any(Date),
        },
      });
      expect(result.name).toBe('Updated Webhook');
    });

    it('should update only provided fields', async () => {
      const input = { enabled: false };

      vi.mocked(betterAuthMiddleware.requireAuth).mockReturnValue(undefined);
      vi.mocked(prisma.formPlugin.findUnique).mockResolvedValue(mockWebhookPlugin as any);
      vi.mocked(formSharingResolvers.checkFormAccess).mockResolvedValue({
        hasAccess: true,
        form: mockForm as any,
      });
      vi.mocked(prisma.formPlugin.update).mockResolvedValue({
        ...mockWebhookPlugin,
        enabled: false,
      } as any);

      await pluginsResolvers.Mutation.updateFormPlugin(
        {},
        { id: 'plugin-123', input },
        mockContext
      );

      expect(prisma.formPlugin.update).toHaveBeenCalledWith({
        where: { id: 'plugin-123' },
        data: {
          enabled: false,
          updatedAt: expect.any(Date),
        },
      });
    });

    it('should throw error when plugin not found', async () => {
      vi.mocked(betterAuthMiddleware.requireAuth).mockReturnValue(undefined);
      vi.mocked(prisma.formPlugin.findUnique).mockResolvedValue(null);

      await expect(
        pluginsResolvers.Mutation.updateFormPlugin(
          {},
          { id: 'invalid-plugin', input: { enabled: false } },
          mockContext
        )
      ).rejects.toThrow('Plugin not found');
    });

    it('should throw error when user lacks editor access', async () => {
      vi.mocked(betterAuthMiddleware.requireAuth).mockReturnValue(undefined);
      vi.mocked(prisma.formPlugin.findUnique).mockResolvedValue(mockWebhookPlugin as any);
      vi.mocked(formSharingResolvers.checkFormAccess).mockResolvedValue({
        hasAccess: false,
        form: null,
      });

      await expect(
        pluginsResolvers.Mutation.updateFormPlugin(
          {},
          { id: 'plugin-123', input: { enabled: false } },
          mockContext
        )
      ).rejects.toThrow('Access denied: You need EDITOR access to update this plugin');
    });

    it('should validate events when updating', async () => {
      const input = { events: ['form.submitted', 'invalid.event'] };

      vi.mocked(betterAuthMiddleware.requireAuth).mockReturnValue(undefined);
      vi.mocked(prisma.formPlugin.findUnique).mockResolvedValue(mockWebhookPlugin as any);
      vi.mocked(formSharingResolvers.checkFormAccess).mockResolvedValue({
        hasAccess: true,
        form: mockForm as any,
      });

      await expect(
        pluginsResolvers.Mutation.updateFormPlugin(
          {},
          { id: 'plugin-123', input },
          mockContext
        )
      ).rejects.toThrow('Invalid event types: invalid.event. Supported events: form.submitted, plugin.test');
    });

    it('should allow updating events with valid values', async () => {
      const input = { events: ['form.submitted', 'plugin.test'] };

      vi.mocked(betterAuthMiddleware.requireAuth).mockReturnValue(undefined);
      vi.mocked(prisma.formPlugin.findUnique).mockResolvedValue(mockWebhookPlugin as any);
      vi.mocked(formSharingResolvers.checkFormAccess).mockResolvedValue({
        hasAccess: true,
        form: mockForm as any,
      });
      vi.mocked(prisma.formPlugin.update).mockResolvedValue({
        ...mockWebhookPlugin,
        events: input.events,
      } as any);

      const result = await pluginsResolvers.Mutation.updateFormPlugin(
        {},
        { id: 'plugin-123', input },
        mockContext
      );

      expect(result.events).toEqual(['form.submitted', 'plugin.test']);
    });
  });

  describe('Mutation: deleteFormPlugin', () => {
    it('should delete plugin with editor access', async () => {
      vi.mocked(betterAuthMiddleware.requireAuth).mockReturnValue(undefined);
      vi.mocked(prisma.formPlugin.findUnique).mockResolvedValue(mockWebhookPlugin as any);
      vi.mocked(formSharingResolvers.checkFormAccess).mockResolvedValue({
        hasAccess: true,
        form: mockForm as any,
      });
      vi.mocked(prisma.formPlugin.delete).mockResolvedValue(mockWebhookPlugin as any);

      const result = await pluginsResolvers.Mutation.deleteFormPlugin(
        {},
        { id: 'plugin-123' },
        mockContext
      );

      expect(betterAuthMiddleware.requireAuth).toHaveBeenCalledWith(mockContext.auth);
      expect(prisma.formPlugin.findUnique).toHaveBeenCalledWith({
        where: { id: 'plugin-123' },
      });
      expect(formSharingResolvers.checkFormAccess).toHaveBeenCalledWith(
        'user-123',
        'form-123',
        formSharingResolvers.PermissionLevel.EDITOR
      );
      expect(prisma.formPlugin.delete).toHaveBeenCalledWith({
        where: { id: 'plugin-123' },
      });
      expect(result).toEqual({
        success: true,
        message: 'Plugin deleted successfully',
      });
    });

    it('should throw error when plugin not found', async () => {
      vi.mocked(betterAuthMiddleware.requireAuth).mockReturnValue(undefined);
      vi.mocked(prisma.formPlugin.findUnique).mockResolvedValue(null);

      await expect(
        pluginsResolvers.Mutation.deleteFormPlugin({}, { id: 'invalid-plugin' }, mockContext)
      ).rejects.toThrow('Plugin not found');
    });

    it('should throw error when user lacks editor access', async () => {
      vi.mocked(betterAuthMiddleware.requireAuth).mockReturnValue(undefined);
      vi.mocked(prisma.formPlugin.findUnique).mockResolvedValue(mockWebhookPlugin as any);
      vi.mocked(formSharingResolvers.checkFormAccess).mockResolvedValue({
        hasAccess: false,
        form: null,
      });

      await expect(
        pluginsResolvers.Mutation.deleteFormPlugin({}, { id: 'plugin-123' }, mockContext)
      ).rejects.toThrow('Access denied: You need EDITOR access to delete this plugin');
    });
  });

  describe('Mutation: testFormPlugin', () => {
    it('should trigger test event for plugin', async () => {
      vi.mocked(betterAuthMiddleware.requireAuth).mockReturnValue(undefined);
      vi.mocked(prisma.formPlugin.findUnique).mockResolvedValue({
        ...mockWebhookPlugin,
        form: mockForm,
      } as any);
      vi.mocked(formSharingResolvers.checkFormAccess).mockResolvedValue({
        hasAccess: true,
        form: mockForm as any,
      });
      vi.mocked(pluginEvents.emitPluginTest).mockReturnValue(undefined);

      const result = await pluginsResolvers.Mutation.testFormPlugin(
        {},
        { id: 'plugin-123' },
        mockContext
      );

      expect(betterAuthMiddleware.requireAuth).toHaveBeenCalledWith(mockContext.auth);
      expect(prisma.formPlugin.findUnique).toHaveBeenCalledWith({
        where: { id: 'plugin-123' },
        include: { form: true },
      });
      expect(formSharingResolvers.checkFormAccess).toHaveBeenCalledWith(
        'user-123',
        'form-123',
        formSharingResolvers.PermissionLevel.EDITOR
      );
      expect(pluginEvents.emitPluginTest).toHaveBeenCalledWith(
        'form-123',
        'org-123',
        {
          pluginId: 'plugin-123',
          pluginType: 'webhook',
          pluginName: 'Test Webhook',
        }
      );
      expect(result).toEqual({
        success: true,
        message: 'Test event triggered successfully. Check plugin deliveries for results.',
      });
    });

    it('should throw error when plugin not found', async () => {
      vi.mocked(betterAuthMiddleware.requireAuth).mockReturnValue(undefined);
      vi.mocked(prisma.formPlugin.findUnique).mockResolvedValue(null);

      await expect(
        pluginsResolvers.Mutation.testFormPlugin({}, { id: 'invalid-plugin' }, mockContext)
      ).rejects.toThrow('Plugin not found');
    });

    it('should throw error when user lacks editor access', async () => {
      vi.mocked(betterAuthMiddleware.requireAuth).mockReturnValue(undefined);
      vi.mocked(prisma.formPlugin.findUnique).mockResolvedValue({
        ...mockWebhookPlugin,
        form: mockForm,
      } as any);
      vi.mocked(formSharingResolvers.checkFormAccess).mockResolvedValue({
        hasAccess: false,
        form: null,
      });

      await expect(
        pluginsResolvers.Mutation.testFormPlugin({}, { id: 'plugin-123' }, mockContext)
      ).rejects.toThrow('Access denied: You need EDITOR access to test this plugin');
    });

    it('should test email plugin', async () => {
      vi.mocked(betterAuthMiddleware.requireAuth).mockReturnValue(undefined);
      vi.mocked(prisma.formPlugin.findUnique).mockResolvedValue({
        ...mockEmailPlugin,
        form: mockForm,
      } as any);
      vi.mocked(formSharingResolvers.checkFormAccess).mockResolvedValue({
        hasAccess: true,
        form: mockForm as any,
      });
      vi.mocked(pluginEvents.emitPluginTest).mockReturnValue(undefined);

      await pluginsResolvers.Mutation.testFormPlugin(
        {},
        { id: 'plugin-456' },
        mockContext
      );

      expect(pluginEvents.emitPluginTest).toHaveBeenCalledWith(
        'form-123',
        'org-123',
        {
          pluginId: 'plugin-456',
          pluginType: 'email',
          pluginName: 'Email Notification',
        }
      );
    });

    it('should test quiz grading plugin', async () => {
      vi.mocked(betterAuthMiddleware.requireAuth).mockReturnValue(undefined);
      vi.mocked(prisma.formPlugin.findUnique).mockResolvedValue({
        ...mockQuizPlugin,
        form: mockForm,
      } as any);
      vi.mocked(formSharingResolvers.checkFormAccess).mockResolvedValue({
        hasAccess: true,
        form: mockForm as any,
      });
      vi.mocked(pluginEvents.emitPluginTest).mockReturnValue(undefined);

      await pluginsResolvers.Mutation.testFormPlugin(
        {},
        { id: 'plugin-789' },
        mockContext
      );

      expect(pluginEvents.emitPluginTest).toHaveBeenCalledWith(
        'form-123',
        'org-123',
        {
          pluginId: 'plugin-789',
          pluginType: 'quiz-grading',
          pluginName: 'Quiz Auto-Grading',
        }
      );
    });
  });

  describe('Field Resolvers: FormPlugin', () => {
    it('should parse JSON config string to object', () => {
      const parent = {
        config: JSON.stringify({ url: 'https://example.com', method: 'POST' }),
      };

      const result = pluginsResolvers.FormPlugin.config(parent);

      expect(result).toEqual({ url: 'https://example.com', method: 'POST' });
    });

    it('should return config object as-is when already parsed', () => {
      const parent = {
        config: { url: 'https://example.com', method: 'POST' },
      };

      const result = pluginsResolvers.FormPlugin.config(parent);

      expect(result).toEqual({ url: 'https://example.com', method: 'POST' });
    });

    it('should handle complex nested config objects', () => {
      const complexConfig = {
        recipients: ['admin@example.com', 'support@example.com'],
        subject: 'New Submission',
        body: 'You have received a new form submission',
        options: {
          priority: 'high',
          tags: ['form', 'submission'],
        },
      };
      const parent = {
        config: JSON.stringify(complexConfig),
      };

      const result = pluginsResolvers.FormPlugin.config(parent);

      expect(result).toEqual(complexConfig);
    });
  });

  describe('Field Resolvers: PluginDelivery', () => {
    it('should parse JSON payload string to object', () => {
      const parent = {
        payload: JSON.stringify({ formId: 'form-123', data: { field1: 'value1' } }),
      };

      const result = pluginsResolvers.PluginDelivery.payload(parent);

      expect(result).toEqual({ formId: 'form-123', data: { field1: 'value1' } });
    });

    it('should return payload object as-is when already parsed', () => {
      const parent = {
        payload: { formId: 'form-123', data: { field1: 'value1' } },
      };

      const result = pluginsResolvers.PluginDelivery.payload(parent);

      expect(result).toEqual({ formId: 'form-123', data: { field1: 'value1' } });
    });

    it('should parse JSON response string to object', () => {
      const parent = {
        response: JSON.stringify({ status: 200, message: 'Success' }),
      };

      const result = pluginsResolvers.PluginDelivery.response(parent);

      expect(result).toEqual({ status: 200, message: 'Success' });
    });

    it('should return response object as-is when already parsed', () => {
      const parent = {
        response: { status: 200, message: 'Success' },
      };

      const result = pluginsResolvers.PluginDelivery.response(parent);

      expect(result).toEqual({ status: 200, message: 'Success' });
    });

    it('should return null when response is null', () => {
      const parent = {
        response: null,
      };

      const result = pluginsResolvers.PluginDelivery.response(parent);

      expect(result).toBeNull();
    });

    it('should return undefined when response is undefined', () => {
      const parent = {
        response: undefined,
      };

      const result = pluginsResolvers.PluginDelivery.response(parent);

      expect(result).toBeUndefined();
    });

    it('should handle complex response objects', () => {
      const complexResponse = {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'X-Request-Id': '123',
        },
        body: {
          success: true,
          data: { id: 'webhook-response-123' },
        },
      };
      const parent = {
        response: JSON.stringify(complexResponse),
      };

      const result = pluginsResolvers.PluginDelivery.response(parent);

      expect(result).toEqual(complexResponse);
    });
  });

  describe('Authentication Edge Cases', () => {
    it('should handle missing auth context in formPlugins query', async () => {
      const contextWithoutAuth = {
        auth: { user: null },
      };

      vi.mocked(betterAuthMiddleware.requireAuth).mockImplementation(() => {
        throw new GraphQLError('Authentication required');
      });

      await expect(
        pluginsResolvers.Query.formPlugins({}, { formId: 'form-123' }, contextWithoutAuth)
      ).rejects.toThrow('Authentication required');
    });

    it('should handle missing session in context', async () => {
      const contextWithoutSession = {
        auth: {
          user: mockContext.auth.user,
          session: null,
        },
      };

      vi.mocked(betterAuthMiddleware.requireAuth).mockReturnValue(undefined);
      vi.mocked(formSharingResolvers.checkFormAccess).mockResolvedValue({
        hasAccess: true,
        form: mockForm as any,
      });
      vi.mocked(prisma.formPlugin.findMany).mockResolvedValue([mockWebhookPlugin] as any);

      const result = await pluginsResolvers.Query.formPlugins(
        {},
        { formId: 'form-123' },
        contextWithoutSession
      );

      expect(result).toEqual([mockWebhookPlugin]);
    });
  });

  describe('Plugin Configuration Validation', () => {
    it('should create plugin with empty config object', async () => {
      const input = {
        formId: 'form-123',
        type: 'webhook',
        name: 'Minimal Webhook',
        config: {},
        events: ['form.submitted'],
      };

      vi.mocked(betterAuthMiddleware.requireAuth).mockReturnValue(undefined);
      vi.mocked(formSharingResolvers.checkFormAccess).mockResolvedValue({
        hasAccess: true,
        form: mockForm as any,
      });
      vi.mocked(prisma.formPlugin.create).mockResolvedValue({
        ...mockWebhookPlugin,
        config: {},
      } as any);

      const result = await pluginsResolvers.Mutation.createFormPlugin(
        {},
        { input },
        mockContext
      );

      expect(result.config).toEqual({});
    });

    it('should update plugin with null config values', async () => {
      const input = {
        config: { url: 'https://example.com', headers: null },
      };

      vi.mocked(betterAuthMiddleware.requireAuth).mockReturnValue(undefined);
      vi.mocked(prisma.formPlugin.findUnique).mockResolvedValue(mockWebhookPlugin as any);
      vi.mocked(formSharingResolvers.checkFormAccess).mockResolvedValue({
        hasAccess: true,
        form: mockForm as any,
      });
      vi.mocked(prisma.formPlugin.update).mockResolvedValue({
        ...mockWebhookPlugin,
        config: input.config,
      } as any);

      const result = await pluginsResolvers.Mutation.updateFormPlugin(
        {},
        { id: 'plugin-123', input },
        mockContext
      );

      expect(result.config).toEqual({ url: 'https://example.com', headers: null });
    });
  });

  describe('Multiple Events Handling', () => {
    it('should create plugin with multiple valid events', async () => {
      const input = {
        formId: 'form-123',
        type: 'webhook',
        name: 'Multi-Event Webhook',
        config: { url: 'https://example.com/webhook' },
        events: ['form.submitted', 'plugin.test'],
      };

      vi.mocked(betterAuthMiddleware.requireAuth).mockReturnValue(undefined);
      vi.mocked(formSharingResolvers.checkFormAccess).mockResolvedValue({
        hasAccess: true,
        form: mockForm as any,
      });
      vi.mocked(prisma.formPlugin.create).mockResolvedValue({
        ...mockWebhookPlugin,
        events: input.events,
      } as any);

      const result = await pluginsResolvers.Mutation.createFormPlugin(
        {},
        { input },
        mockContext
      );

      expect(result.events).toEqual(['form.submitted', 'plugin.test']);
    });

    it('should update plugin to add new events', async () => {
      const input = {
        events: ['form.submitted', 'plugin.test'],
      };

      vi.mocked(betterAuthMiddleware.requireAuth).mockReturnValue(undefined);
      vi.mocked(prisma.formPlugin.findUnique).mockResolvedValue(mockWebhookPlugin as any);
      vi.mocked(formSharingResolvers.checkFormAccess).mockResolvedValue({
        hasAccess: true,
        form: mockForm as any,
      });
      vi.mocked(prisma.formPlugin.update).mockResolvedValue({
        ...mockWebhookPlugin,
        events: input.events,
      } as any);

      const result = await pluginsResolvers.Mutation.updateFormPlugin(
        {},
        { id: 'plugin-123', input },
        mockContext
      );

      expect(result.events).toHaveLength(2);
    });
  });

  describe('Organization-Level Access', () => {
    it('should allow access to plugins within organization', async () => {
      vi.mocked(betterAuthMiddleware.requireAuth).mockReturnValue(undefined);
      vi.mocked(formSharingResolvers.checkFormAccess).mockResolvedValue({
        hasAccess: true,
        form: mockForm as any,
      });
      vi.mocked(prisma.formPlugin.findMany).mockResolvedValue([mockWebhookPlugin] as any);

      const result = await pluginsResolvers.Query.formPlugins(
        {},
        { formId: 'form-123' },
        mockContext
      );

      expect(result).toHaveLength(1);
      expect(formSharingResolvers.checkFormAccess).toHaveBeenCalledWith(
        'user-123',
        'form-123',
        formSharingResolvers.PermissionLevel.VIEWER
      );
    });

    it('should deny access to plugins from different organization', async () => {
      vi.mocked(betterAuthMiddleware.requireAuth).mockReturnValue(undefined);
      vi.mocked(formSharingResolvers.checkFormAccess).mockResolvedValue({
        hasAccess: false,
        form: null,
      });

      await expect(
        pluginsResolvers.Query.formPlugins(
          {},
          { formId: 'other-org-form' },
          mockContext
        )
      ).rejects.toThrow('Access denied: You do not have permission to view plugins for this form');
    });
  });

  describe('Plugin Delivery History Edge Cases', () => {
    it('should return empty array when no deliveries exist', async () => {
      vi.mocked(betterAuthMiddleware.requireAuth).mockReturnValue(undefined);
      vi.mocked(prisma.formPlugin.findUnique).mockResolvedValue(mockWebhookPlugin as any);
      vi.mocked(formSharingResolvers.checkFormAccess).mockResolvedValue({
        hasAccess: true,
        form: mockForm as any,
      });
      vi.mocked(prisma.pluginDelivery.findMany).mockResolvedValue([]);

      const result = await pluginsResolvers.Query.pluginDeliveries(
        {},
        { pluginId: 'plugin-123' },
        mockContext
      );

      expect(result).toEqual([]);
    });

    it('should respect limit parameter for deliveries', async () => {
      const manyDeliveries = Array.from({ length: 100 }, (_, i) => ({
        id: `delivery-${i}`,
        pluginId: 'plugin-123',
        status: 'success',
        payload: {},
        response: {},
        deliveredAt: new Date(),
      }));

      vi.mocked(betterAuthMiddleware.requireAuth).mockReturnValue(undefined);
      vi.mocked(prisma.formPlugin.findUnique).mockResolvedValue(mockWebhookPlugin as any);
      vi.mocked(formSharingResolvers.checkFormAccess).mockResolvedValue({
        hasAccess: true,
        form: mockForm as any,
      });
      vi.mocked(prisma.pluginDelivery.findMany).mockResolvedValue(
        manyDeliveries.slice(0, 10) as any
      );

      const result = await pluginsResolvers.Query.pluginDeliveries(
        {},
        { pluginId: 'plugin-123', limit: 10 },
        mockContext
      );

      expect(result).toHaveLength(10);
      expect(prisma.pluginDelivery.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 10 })
      );
    });
  });
});
