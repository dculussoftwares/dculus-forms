import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { webhookHandler } from '../handler.js';
import type { PluginEvent, PluginContext } from '../../types.js';
import type { ValidatedWebhookConfig } from '../types.js';

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch as any;

describe('Webhook Handler', () => {
  let mockContext: PluginContext;
  let mockLogger: any;
  let mockEvent: PluginEvent;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock logger
    mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    };

    // Mock plugin context
    mockContext = {
      logger: mockLogger,
      getFormById: vi.fn(),
      getResponseById: vi.fn(),
      getResponsesByFormId: vi.fn(),
      getOrganization: vi.fn(),
      getUserById: vi.fn(),
      sendEmail: vi.fn(),
      prisma: {} as any,
    };

    // Mock event
    mockEvent = {
      type: 'form.submitted',
      formId: 'form-123',
      organizationId: 'org-123',
      timestamp: new Date('2024-01-01T12:00:00Z'),
      data: {
        responseId: 'response-123',
        submitterEmail: 'test@example.com',
      },
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Successful webhook delivery', () => {
    it('should send webhook with correct payload and headers', async () => {
      const config: ValidatedWebhookConfig = {
        type: 'webhook',
        url: 'https://example.com/webhook',
        headers: {
          'X-Custom-Header': 'custom-value',
        },
      };

      mockFetch.mockResolvedValue({
        status: 200,
        statusText: 'OK',
        headers: new Map([['content-type', 'application/json']]),
        json: async () => ({ success: true }),
      });

      const result = await webhookHandler(
        { config },
        mockEvent,
        mockContext
      );

      expect(mockFetch).toHaveBeenCalledWith(
        'https://example.com/webhook',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'User-Agent': 'Dculus-Forms-Webhook/1.0',
            'X-Custom-Header': 'custom-value',
          }),
          body: expect.any(String),
        })
      );

      const payload = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(payload).toMatchObject({
        event: 'form.submitted',
        formId: 'form-123',
        organizationId: 'org-123',
        responseId: 'response-123',
        timestamp: '2024-01-01T12:00:00.000Z',
      });

      expect(result.success).toBe(true);
      expect(result.statusCode).toBe(200);
      expect(result.deliveryTime).toBeGreaterThanOrEqual(0);

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Webhook plugin triggered',
        expect.objectContaining({
          url: 'https://example.com/webhook',
          eventType: 'form.submitted',
        })
      );

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Webhook delivered successfully',
        expect.objectContaining({
          url: 'https://example.com/webhook',
          statusCode: 200,
        })
      );
    });

    it('should include HMAC signature when secret is provided', async () => {
      const config: ValidatedWebhookConfig = {
        type: 'webhook',
        url: 'https://example.com/webhook',
        secret: 'my-secret-key',
      };

      mockFetch.mockResolvedValue({
        status: 200,
        statusText: 'OK',
        headers: new Map(),
        text: async () => 'Success',
      });

      await webhookHandler({ config }, mockEvent, mockContext);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://example.com/webhook',
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-Webhook-Signature': expect.any(String),
            'X-Webhook-Signature-Algorithm': 'sha256',
          }),
        })
      );

      // Verify signature is a valid hex string
      const headers = mockFetch.mock.calls[0][1].headers;
      expect(headers['X-Webhook-Signature']).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should handle 2xx status codes as success', async () => {
      const config: ValidatedWebhookConfig = {
        type: 'webhook',
        url: 'https://example.com/webhook',
      };

      mockFetch.mockResolvedValue({
        status: 201,
        statusText: 'Created',
        headers: new Map(),
        text: async () => 'Created',
      });

      const result = await webhookHandler(
        { config },
        mockEvent,
        mockContext
      );

      expect(result.success).toBe(true);
      expect(result.statusCode).toBe(201);
    });

    it('should parse JSON response body when content-type is application/json', async () => {
      const config: ValidatedWebhookConfig = {
        type: 'webhook',
        url: 'https://example.com/webhook',
      };

      const responseBody = { message: 'Webhook received', id: 'webhook-123' };
      mockFetch.mockResolvedValue({
        status: 200,
        statusText: 'OK',
        headers: new Map([['content-type', 'application/json']]),
        json: async () => responseBody,
      });

      const result = await webhookHandler(
        { config },
        mockEvent,
        mockContext
      );

      expect(result.success).toBe(true);
      expect(result.responseBody).toEqual(responseBody);
    });

    it('should handle text response body when not JSON', async () => {
      const config: ValidatedWebhookConfig = {
        type: 'webhook',
        url: 'https://example.com/webhook',
      };

      mockFetch.mockResolvedValue({
        status: 200,
        statusText: 'OK',
        headers: new Map([['content-type', 'text/plain']]),
        text: async () => 'Success',
      });

      const result = await webhookHandler(
        { config },
        mockEvent,
        mockContext
      );

      expect(result.success).toBe(true);
      expect(result.responseBody).toBe('Success');
    });

    it('should include responseId in payload when available', async () => {
      const config: ValidatedWebhookConfig = {
        type: 'webhook',
        url: 'https://example.com/webhook',
      };

      mockFetch.mockResolvedValue({
        status: 200,
        statusText: 'OK',
        headers: new Map(),
        text: async () => 'OK',
      });

      await webhookHandler({ config }, mockEvent, mockContext);

      const payload = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(payload.responseId).toBe('response-123');
    });

    it('should omit responseId when not available in event data', async () => {
      const config: ValidatedWebhookConfig = {
        type: 'webhook',
        url: 'https://example.com/webhook',
      };

      const eventWithoutResponseId: PluginEvent = {
        ...mockEvent,
        data: {},
      };

      mockFetch.mockResolvedValue({
        status: 200,
        statusText: 'OK',
        headers: new Map(),
        text: async () => 'OK',
      });

      await webhookHandler({ config }, eventWithoutResponseId, mockContext);

      const payload = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(payload.responseId).toBeUndefined();
    });
  });

  describe('Failed webhook delivery', () => {
    it('should handle HTTP error status codes (4xx)', async () => {
      const config: ValidatedWebhookConfig = {
        type: 'webhook',
        url: 'https://example.com/webhook',
      };

      mockFetch.mockResolvedValue({
        status: 400,
        statusText: 'Bad Request',
        headers: new Map(),
        text: async () => 'Invalid payload',
      });

      const result = await webhookHandler(
        { config },
        mockEvent,
        mockContext
      );

      expect(result.success).toBe(false);
      expect(result.statusCode).toBe(400);
      expect(result.error).toBe('HTTP 400: Bad Request');
      expect(result.responseBody).toBe('Invalid payload');

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Webhook delivery failed',
        expect.objectContaining({
          url: 'https://example.com/webhook',
          error: 'HTTP 400: Bad Request',
          statusCode: 400,
        })
      );
    });

    it('should handle HTTP error status codes (5xx)', async () => {
      const config: ValidatedWebhookConfig = {
        type: 'webhook',
        url: 'https://example.com/webhook',
      };

      mockFetch.mockResolvedValue({
        status: 503,
        statusText: 'Service Unavailable',
        headers: new Map(),
        text: async () => 'Server error',
      });

      const result = await webhookHandler(
        { config },
        mockEvent,
        mockContext
      );

      expect(result.success).toBe(false);
      expect(result.statusCode).toBe(503);
      expect(result.error).toBe('HTTP 503: Service Unavailable');
    });

    it('should handle network errors', async () => {
      const config: ValidatedWebhookConfig = {
        type: 'webhook',
        url: 'https://example.com/webhook',
      };

      mockFetch.mockRejectedValue(new Error('Network error: ECONNREFUSED'));

      const result = await webhookHandler(
        { config },
        mockEvent,
        mockContext
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network error: ECONNREFUSED');
      expect(result.statusCode).toBeUndefined();

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Webhook delivery failed',
        expect.objectContaining({
          error: 'Network error: ECONNREFUSED',
        })
      );
    });

    it('should handle timeout errors', async () => {
      const config: ValidatedWebhookConfig = {
        type: 'webhook',
        url: 'https://example.com/webhook',
      };

      mockFetch.mockRejectedValue(new Error('Request timeout'));

      const result = await webhookHandler(
        { config },
        mockEvent,
        mockContext
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Request timeout');
    });

    it('should handle response body parse errors gracefully', async () => {
      const config: ValidatedWebhookConfig = {
        type: 'webhook',
        url: 'https://example.com/webhook',
      };

      mockFetch.mockResolvedValue({
        status: 200,
        statusText: 'OK',
        headers: new Map([['content-type', 'application/json']]),
        json: async () => {
          throw new Error('Invalid JSON');
        },
      });

      const result = await webhookHandler(
        { config },
        mockEvent,
        mockContext
      );

      // Should still succeed even if body parsing fails
      expect(result.success).toBe(true);
      expect(result.responseBody).toBeNull();
    });
  });

  describe('Delivery timing', () => {
    it('should track delivery time for successful requests', async () => {
      const config: ValidatedWebhookConfig = {
        type: 'webhook',
        url: 'https://example.com/webhook',
      };

      mockFetch.mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(() => {
              resolve({
                status: 200,
                statusText: 'OK',
                headers: new Map(),
                text: async () => 'OK',
              });
            }, 50);
          })
      );

      const result = await webhookHandler(
        { config },
        mockEvent,
        mockContext
      );

      expect(result.deliveryTime).toBeGreaterThanOrEqual(50);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Webhook delivered successfully',
        expect.objectContaining({
          deliveryTime: expect.stringContaining('ms'),
        })
      );
    });

    it('should track delivery time for failed requests', async () => {
      const config: ValidatedWebhookConfig = {
        type: 'webhook',
        url: 'https://example.com/webhook',
      };

      mockFetch.mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(() => {
              resolve({
                status: 500,
                statusText: 'Internal Server Error',
                headers: new Map(),
                text: async () => 'Error',
              });
            }, 30);
          })
      );

      const result = await webhookHandler(
        { config },
        mockEvent,
        mockContext
      );

      expect(result.deliveryTime).toBeGreaterThanOrEqual(30);
    });
  });

  describe('Custom headers', () => {
    it('should merge custom headers with default headers', async () => {
      const config: ValidatedWebhookConfig = {
        type: 'webhook',
        url: 'https://example.com/webhook',
        headers: {
          'X-Custom-Header': 'value1',
          'Authorization': 'Bearer token123',
        },
      };

      mockFetch.mockResolvedValue({
        status: 200,
        statusText: 'OK',
        headers: new Map(),
        text: async () => 'OK',
      });

      await webhookHandler({ config }, mockEvent, mockContext);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://example.com/webhook',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'User-Agent': 'Dculus-Forms-Webhook/1.0',
            'X-Custom-Header': 'value1',
            'Authorization': 'Bearer token123',
          }),
        })
      );
    });

    it('should allow custom headers to override default headers', async () => {
      const config: ValidatedWebhookConfig = {
        type: 'webhook',
        url: 'https://example.com/webhook',
        headers: {
          'User-Agent': 'Custom-Agent/2.0',
        },
      };

      mockFetch.mockResolvedValue({
        status: 200,
        statusText: 'OK',
        headers: new Map(),
        text: async () => 'OK',
      });

      await webhookHandler({ config }, mockEvent, mockContext);

      const headers = mockFetch.mock.calls[0][1].headers;
      expect(headers['User-Agent']).toBe('Custom-Agent/2.0');
    });

    it('should handle empty headers object', async () => {
      const config: ValidatedWebhookConfig = {
        type: 'webhook',
        url: 'https://example.com/webhook',
        headers: {},
      };

      mockFetch.mockResolvedValue({
        status: 200,
        statusText: 'OK',
        headers: new Map(),
        text: async () => 'OK',
      });

      await webhookHandler({ config }, mockEvent, mockContext);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://example.com/webhook',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'User-Agent': 'Dculus-Forms-Webhook/1.0',
          }),
        })
      );
    });
  });

  describe('Event types', () => {
    it('should handle plugin.test event type', async () => {
      const config: ValidatedWebhookConfig = {
        type: 'webhook',
        url: 'https://example.com/webhook',
      };

      const testEvent: PluginEvent = {
        type: 'plugin.test',
        formId: 'form-123',
        organizationId: 'org-123',
        timestamp: new Date('2024-01-01T12:00:00Z'),
        data: {},
      };

      mockFetch.mockResolvedValue({
        status: 200,
        statusText: 'OK',
        headers: new Map(),
        text: async () => 'OK',
      });

      const result = await webhookHandler(
        { config },
        testEvent,
        mockContext
      );

      expect(result.success).toBe(true);

      const payload = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(payload.event).toBe('plugin.test');
    });

    it('should handle form.submitted event type', async () => {
      const config: ValidatedWebhookConfig = {
        type: 'webhook',
        url: 'https://example.com/webhook',
      };

      mockFetch.mockResolvedValue({
        status: 200,
        statusText: 'OK',
        headers: new Map(),
        text: async () => 'OK',
      });

      await webhookHandler({ config }, mockEvent, mockContext);

      const payload = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(payload.event).toBe('form.submitted');
    });
  });

  describe('HMAC signature generation', () => {
    it('should generate consistent signatures for same payload and secret', async () => {
      const config: ValidatedWebhookConfig = {
        type: 'webhook',
        url: 'https://example.com/webhook',
        secret: 'test-secret',
      };

      mockFetch.mockResolvedValue({
        status: 200,
        statusText: 'OK',
        headers: new Map(),
        text: async () => 'OK',
      });

      // Call twice with same config and event
      await webhookHandler({ config }, mockEvent, mockContext);
      const signature1 = mockFetch.mock.calls[0][1].headers['X-Webhook-Signature'];

      mockFetch.mockClear();
      await webhookHandler({ config }, mockEvent, mockContext);
      const signature2 = mockFetch.mock.calls[0][1].headers['X-Webhook-Signature'];

      expect(signature1).toBe(signature2);
    });

    it('should generate different signatures for different secrets', async () => {
      const config1: ValidatedWebhookConfig = {
        type: 'webhook',
        url: 'https://example.com/webhook',
        secret: 'secret1',
      };

      const config2: ValidatedWebhookConfig = {
        type: 'webhook',
        url: 'https://example.com/webhook',
        secret: 'secret2',
      };

      mockFetch.mockResolvedValue({
        status: 200,
        statusText: 'OK',
        headers: new Map(),
        text: async () => 'OK',
      });

      await webhookHandler({ config: config1 }, mockEvent, mockContext);
      const signature1 = mockFetch.mock.calls[0][1].headers['X-Webhook-Signature'];

      mockFetch.mockClear();
      await webhookHandler({ config: config2 }, mockEvent, mockContext);
      const signature2 = mockFetch.mock.calls[0][1].headers['X-Webhook-Signature'];

      expect(signature1).not.toBe(signature2);
    });
  });
});
