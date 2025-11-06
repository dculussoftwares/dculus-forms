import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createPluginContext } from '../context.js';
import { prisma } from '../../lib/prisma.js';
import { getFormById } from '../../services/formService.js';
import { getResponseById, getAllResponsesByFormId } from '../../services/responseService.js';
import { sendEmail } from '../../services/emailService.js';
import { logger } from '../../lib/logger.js';

vi.mock('../../lib/prisma.js', () => ({
  prisma: {
    organization: {
      findUnique: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock('../../services/formService.js', () => ({
  getFormById: vi.fn(),
}));

vi.mock('../../services/responseService.js', () => ({
  getResponseById: vi.fn(),
  getAllResponsesByFormId: vi.fn(),
}));

vi.mock('../../services/emailService.js', () => ({
  sendEmail: vi.fn(),
}));

vi.mock('../../lib/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

describe('context', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createPluginContext', () => {
    it('creates context with all required properties', () => {
      const context = createPluginContext();

      expect(context).toHaveProperty('prisma');
      expect(context).toHaveProperty('getFormById');
      expect(context).toHaveProperty('getResponseById');
      expect(context).toHaveProperty('getResponsesByFormId');
      expect(context).toHaveProperty('getOrganization');
      expect(context).toHaveProperty('getUserById');
      expect(context).toHaveProperty('sendEmail');
      expect(context).toHaveProperty('logger');
    });

    it('includes prisma client for database access', () => {
      const context = createPluginContext();

      expect(context.prisma).toBe(prisma);
      expect(context.prisma).toHaveProperty('organization');
      expect(context.prisma).toHaveProperty('user');
    });

    it('includes form service function', () => {
      const context = createPluginContext();

      expect(context.getFormById).toBe(getFormById);
      expect(typeof context.getFormById).toBe('function');
    });

    it('includes response service functions', () => {
      const context = createPluginContext();

      expect(context.getResponseById).toBe(getResponseById);
      expect(context.getResponsesByFormId).toBe(getAllResponsesByFormId);
      expect(typeof context.getResponseById).toBe('function');
      expect(typeof context.getResponsesByFormId).toBe('function');
    });

    it('includes email service function', () => {
      const context = createPluginContext();

      expect(context.sendEmail).toBe(sendEmail);
      expect(typeof context.sendEmail).toBe('function');
    });

    it('includes logger with info, error, and warn methods', () => {
      const context = createPluginContext();

      expect(context.logger).toHaveProperty('info');
      expect(context.logger).toHaveProperty('error');
      expect(context.logger).toHaveProperty('warn');
      expect(typeof context.logger.info).toBe('function');
      expect(typeof context.logger.error).toBe('function');
      expect(typeof context.logger.warn).toBe('function');
    });
  });

  describe('context.getOrganization', () => {
    it('fetches organization with members and users', async () => {
      const mockOrganization = {
        id: 'org-123',
        name: 'Test Organization',
        members: [
          {
            id: 'member-1',
            role: 'owner',
            user: {
              id: 'user-1',
              name: 'John Doe',
              email: 'john@example.com',
            },
          },
          {
            id: 'member-2',
            role: 'member',
            user: {
              id: 'user-2',
              name: 'Jane Smith',
              email: 'jane@example.com',
            },
          },
        ],
      };

      vi.mocked(prisma.organization.findUnique).mockResolvedValue(mockOrganization as any);

      const context = createPluginContext();
      const result = await context.getOrganization('org-123');

      expect(prisma.organization.findUnique).toHaveBeenCalledWith({
        where: { id: 'org-123' },
        include: {
          members: {
            include: {
              user: true,
            },
          },
        },
      });
      expect(result).toEqual(mockOrganization);
    });

    it('returns null for nonexistent organization', async () => {
      vi.mocked(prisma.organization.findUnique).mockResolvedValue(null);

      const context = createPluginContext();
      const result = await context.getOrganization('nonexistent');

      expect(result).toBeNull();
    });

    it('includes nested member and user data', async () => {
      const mockOrganization = {
        id: 'org-123',
        name: 'Test Org',
        members: [
          {
            id: 'member-1',
            userId: 'user-1',
            organizationId: 'org-123',
            role: 'owner',
            user: {
              id: 'user-1',
              name: 'Owner User',
              email: 'owner@example.com',
            },
          },
        ],
      };

      vi.mocked(prisma.organization.findUnique).mockResolvedValue(mockOrganization as any);

      const context = createPluginContext();
      const result = await context.getOrganization('org-123');

      expect(result?.members).toHaveLength(1);
      expect(result?.members[0]).toHaveProperty('user');
      expect(result?.members[0].user.email).toBe('owner@example.com');
    });
  });

  describe('context.getUserById', () => {
    it('fetches user by id', async () => {
      const mockUser = {
        id: 'user-123',
        name: 'John Doe',
        email: 'john@example.com',
        createdAt: new Date('2024-01-01'),
      };

      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any);

      const context = createPluginContext();
      const result = await context.getUserById('user-123');

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-123' },
      });
      expect(result).toEqual(mockUser);
    });

    it('returns null for nonexistent user', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

      const context = createPluginContext();
      const result = await context.getUserById('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('context.logger', () => {
    it('prefixes info messages with [Plugin]', () => {
      const context = createPluginContext();

      context.logger.info('Test message', { data: 'test' });

      expect(logger.info).toHaveBeenCalledWith('[Plugin] Test message', { data: 'test' });
    });

    it('prefixes error messages with [Plugin Error]', () => {
      const context = createPluginContext();
      const error = new Error('Test error');

      context.logger.error('Error occurred', error);

      expect(logger.error).toHaveBeenCalledWith('[Plugin Error] Error occurred', error);
    });

    it('prefixes warn messages with [Plugin Warning]', () => {
      const context = createPluginContext();

      context.logger.warn('Warning message', { warning: true });

      expect(logger.warn).toHaveBeenCalledWith('[Plugin Warning] Warning message', { warning: true });
    });

    it('handles info log without metadata', () => {
      const context = createPluginContext();

      context.logger.info('Simple message');

      expect(logger.info).toHaveBeenCalledWith('[Plugin] Simple message', '');
    });

    it('handles error log without error object', () => {
      const context = createPluginContext();

      context.logger.error('Error message');

      expect(logger.error).toHaveBeenCalledWith('[Plugin Error] Error message', '');
    });

    it('handles warn log without metadata', () => {
      const context = createPluginContext();

      context.logger.warn('Warning');

      expect(logger.warn).toHaveBeenCalledWith('[Plugin Warning] Warning', '');
    });

    it('passes through complex metadata objects', () => {
      const context = createPluginContext();
      const complexMetadata = {
        plugin: 'webhook',
        config: { url: 'https://example.com' },
        attempt: 1,
        nested: { data: [1, 2, 3] },
      };

      context.logger.info('Complex log', complexMetadata);

      expect(logger.info).toHaveBeenCalledWith('[Plugin] Complex log', complexMetadata);
    });
  });

  describe('context service functions', () => {
    it('calls getFormById through context', async () => {
      const mockForm = {
        id: 'form-123',
        title: 'Test Form',
        organizationId: 'org-123',
      };

      vi.mocked(getFormById).mockResolvedValue(mockForm as any);

      const context = createPluginContext();
      const result = await context.getFormById('form-123');

      expect(getFormById).toHaveBeenCalledWith('form-123');
      expect(result).toEqual(mockForm);
    });

    it('calls getResponseById through context', async () => {
      const mockResponse = {
        id: 'response-123',
        formId: 'form-123',
        data: { field1: 'value1' },
      };

      vi.mocked(getResponseById).mockResolvedValue(mockResponse as any);

      const context = createPluginContext();
      const result = await context.getResponseById('response-123');

      expect(getResponseById).toHaveBeenCalledWith('response-123');
      expect(result).toEqual(mockResponse);
    });

    it('calls getAllResponsesByFormId through context', async () => {
      const mockResponses = [
        { id: 'response-1', formId: 'form-123', data: {} },
        { id: 'response-2', formId: 'form-123', data: {} },
      ];

      vi.mocked(getAllResponsesByFormId).mockResolvedValue(mockResponses as any);

      const context = createPluginContext();
      const result = await context.getResponsesByFormId('form-123');

      expect(getAllResponsesByFormId).toHaveBeenCalledWith('form-123');
      expect(result).toEqual(mockResponses);
    });

    it('calls sendEmail through context', async () => {
      const emailOptions = {
        to: 'recipient@example.com',
        subject: 'Test Email',
        html: '<p>Test content</p>',
      };

      vi.mocked(sendEmail).mockResolvedValue(undefined);

      const context = createPluginContext();
      await context.sendEmail(emailOptions);

      expect(sendEmail).toHaveBeenCalledWith(emailOptions);
    });
  });

  describe('context isolation', () => {
    it('creates independent context instances', () => {
      const context1 = createPluginContext();
      const context2 = createPluginContext();

      expect(context1).not.toBe(context2);
      expect(context1.logger).not.toBe(context2.logger);
    });

    it('shares same prisma client across contexts', () => {
      const context1 = createPluginContext();
      const context2 = createPluginContext();

      expect(context1.prisma).toBe(context2.prisma);
    });

    it('shares same service functions across contexts', () => {
      const context1 = createPluginContext();
      const context2 = createPluginContext();

      expect(context1.getFormById).toBe(context2.getFormById);
      expect(context1.getResponseById).toBe(context2.getResponseById);
      expect(context1.sendEmail).toBe(context2.sendEmail);
    });

    it('logger instances are independent but call same underlying logger', () => {
      const context1 = createPluginContext();
      const context2 = createPluginContext();

      context1.logger.info('Message from context 1');
      context2.logger.info('Message from context 2');

      expect(logger.info).toHaveBeenCalledTimes(2);
      expect(logger.info).toHaveBeenNthCalledWith(1, '[Plugin] Message from context 1', '');
      expect(logger.info).toHaveBeenNthCalledWith(2, '[Plugin] Message from context 2', '');
    });
  });

  describe('real-world plugin scenarios', () => {
    it('provides all necessary tools for webhook plugin', async () => {
      const context = createPluginContext();

      // Webhook plugin would typically need:
      expect(context.getFormById).toBeDefined();
      expect(context.getResponseById).toBeDefined();
      expect(context.logger).toBeDefined();
      expect(context.prisma).toBeDefined();
    });

    it('provides all necessary tools for email plugin', async () => {
      const context = createPluginContext();

      // Email plugin would typically need:
      expect(context.sendEmail).toBeDefined();
      expect(context.getFormById).toBeDefined();
      expect(context.getResponseById).toBeDefined();
      expect(context.getOrganization).toBeDefined();
      expect(context.getUserById).toBeDefined();
      expect(context.logger).toBeDefined();
    });

    it('provides all necessary tools for quiz grading plugin', async () => {
      const context = createPluginContext();

      // Quiz grading plugin would typically need:
      expect(context.getResponseById).toBeDefined();
      expect(context.getFormById).toBeDefined();
      expect(context.prisma).toBeDefined(); // For updating response metadata
      expect(context.logger).toBeDefined();
    });

    it('supports complex plugin operations', async () => {
      const mockForm = { id: 'form-123', title: 'Test Form' };
      const mockResponse = { id: 'response-123', data: { field1: 'value1' } };
      const mockOrganization = { id: 'org-123', name: 'Test Org', members: [] };

      vi.mocked(getFormById).mockResolvedValue(mockForm as any);
      vi.mocked(getResponseById).mockResolvedValue(mockResponse as any);
      vi.mocked(prisma.organization.findUnique).mockResolvedValue(mockOrganization as any);

      const context = createPluginContext();

      // Simulate a plugin that needs multiple context operations
      const form = await context.getFormById('form-123');
      const response = await context.getResponseById('response-123');
      const org = await context.getOrganization('org-123');

      context.logger.info('Processing plugin', { form, response, org });

      expect(form).toEqual(mockForm);
      expect(response).toEqual(mockResponse);
      expect(org).toEqual(mockOrganization);
      expect(logger.info).toHaveBeenCalledWith(
        '[Plugin] Processing plugin',
        { form, response, org }
      );
    });
  });

  describe('error handling in context functions', () => {
    it('propagates errors from getOrganization', async () => {
      vi.mocked(prisma.organization.findUnique).mockRejectedValue(
        new Error('Database error')
      );

      const context = createPluginContext();

      await expect(context.getOrganization('org-123')).rejects.toThrow('Database error');
    });

    it('propagates errors from getUserById', async () => {
      vi.mocked(prisma.user.findUnique).mockRejectedValue(
        new Error('Database error')
      );

      const context = createPluginContext();

      await expect(context.getUserById('user-123')).rejects.toThrow('Database error');
    });

    it('propagates errors from getFormById', async () => {
      vi.mocked(getFormById).mockRejectedValue(new Error('Form not found'));

      const context = createPluginContext();

      await expect(context.getFormById('form-123')).rejects.toThrow('Form not found');
    });

    it('propagates errors from sendEmail', async () => {
      vi.mocked(sendEmail).mockRejectedValue(new Error('Email send failed'));

      const context = createPluginContext();

      await expect(
        context.sendEmail({
          to: 'test@example.com',
          subject: 'Test',
          html: '<p>Test</p>',
        })
      ).rejects.toThrow('Email send failed');
    });
  });
});
