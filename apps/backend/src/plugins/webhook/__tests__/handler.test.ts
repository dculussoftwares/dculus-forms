import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { webhookHandler } from '../handler.js';
import type { PluginEvent, PluginContext } from '../../core/types.js';
import type { ValidatedWebhookConfig } from '../types.js';

// The handler sends through safeFetch (SSRF-safe, no redirects); `mockFetch` stands in for it and
// keeps the (url, init) call shape these tests assert on. A mocked `body` string is the receiver reply.
const mockFetch = vi.fn();
vi.mock('../../../lib/safeFetch.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../lib/safeFetch.js')>();
  return {
    ...actual,
    safeFetch: async (url: string, init: unknown) => {
      const reply = await mockFetch(url, init);
      return { statusText: '', headers: {}, body: '', truncated: false, ...reply };
    },
  };
});

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
      updatePluginConfig: vi.fn(),
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
        { id: 'test-plugin', config },
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

      await webhookHandler({ id: 'test-plugin', config }, mockEvent, mockContext);

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
        { id: 'test-plugin', config },
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

      mockFetch.mockResolvedValue({
        status: 200,
        statusText: 'OK',
        body: JSON.stringify({ message: 'Webhook received', id: 'webhook-123' }),
      });

      const result = await webhookHandler(
        { id: 'test-plugin', config },
        mockEvent,
        mockContext
      );

      expect(result.success).toBe(true);
      expect(result.responseExcerpt).toBe('{"message":"Webhook received","id":"webhook-123"}');
      expect(result).not.toHaveProperty('responseBody');
    });

    it('should handle text response body when not JSON', async () => {
      const config: ValidatedWebhookConfig = {
        type: 'webhook',
        url: 'https://example.com/webhook',
      };

      mockFetch.mockResolvedValue({
        status: 200,
        statusText: 'OK',
        body: 'Success',
      });

      const result = await webhookHandler(
        { id: 'test-plugin', config },
        mockEvent,
        mockContext
      );

      expect(result.success).toBe(true);
      expect(result.responseExcerpt).toBe('Success');
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

      await webhookHandler({ id: 'test-plugin', config }, mockEvent, mockContext);

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

      await webhookHandler({ id: 'test-plugin', config }, eventWithoutResponseId, mockContext);

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
        body: 'Invalid payload',
      });

      const result = await webhookHandler(
        { id: 'test-plugin', config },
        mockEvent,
        mockContext
      );

      expect(result.success).toBe(false);
      expect(result.statusCode).toBe(400);
      expect(result.error).toBe('HTTP 400: Bad Request');
      expect(result.responseExcerpt).toBe('Invalid payload');

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
        { id: 'test-plugin', config },
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

      mockFetch.mockRejectedValue(new Error('connect ECONNREFUSED 10.0.0.5:6379'));

      const result = await webhookHandler(
        { id: 'test-plugin', config },
        mockEvent,
        mockContext
      );

      expect(result.success).toBe(false);
      // The socket error would let a caller map internal hosts, so only a generic message is returned
      expect(result.error).toBe('Webhook request failed');
      expect(result.statusCode).toBeUndefined();

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Webhook delivery failed',
        expect.objectContaining({
          error: 'Webhook request failed',
        })
      );
    });

    it('should handle timeout errors', async () => {
      const config: ValidatedWebhookConfig = {
        type: 'webhook',
        url: 'https://example.com/webhook',
      };

      mockFetch.mockRejectedValue(Object.assign(new Error('timed out'), { name: 'TimeoutError' }));

      const result = await webhookHandler(
        { id: 'test-plugin', config },
        mockEvent,
        mockContext
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Webhook request timed out');
    });

    it('should truncate the stored receiver reply to a short excerpt', async () => {
      const config: ValidatedWebhookConfig = {
        type: 'webhook',
        url: 'https://example.com/webhook',
      };

      mockFetch.mockResolvedValue({ status: 200, statusText: 'OK', body: 'x'.repeat(5000) });

      const result = await webhookHandler({ id: 'test-plugin', config }, mockEvent, mockContext);

      expect(result.success).toBe(true);
      expect(result.responseExcerpt!.length).toBeLessThanOrEqual(201);
      expect(result).not.toHaveProperty('responseBody');
    });

    it('should not follow redirects and reports them as a failure', async () => {
      const config: ValidatedWebhookConfig = {
        type: 'webhook',
        url: 'https://example.com/webhook',
      };

      mockFetch.mockResolvedValue({
        status: 302,
        statusText: 'Found',
        headers: { location: 'http://169.254.169.254/latest/meta-data/' },
        body: 'secret-metadata',
      });

      const result = await webhookHandler({ id: 'test-plugin', config }, mockEvent, mockContext);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(result.success).toBe(false);
      expect(result.statusCode).toBe(302);
      expect(result.responseExcerpt).toBeUndefined();
    });

    it('should report a blocked destination without leaking resolution details', async () => {
      const config: ValidatedWebhookConfig = {
        type: 'webhook',
        url: 'https://example.com/webhook',
      };

      const { UnsafeUrlError } = await import('../../../lib/urlGuard.js');
      mockFetch.mockRejectedValue(new UnsafeUrlError('Destination resolves to a private address'));

      const result = await webhookHandler({ id: 'test-plugin', config }, mockEvent, mockContext);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Webhook URL is not allowed: Destination resolves to a private address');
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
        { id: 'test-plugin', config },
        mockEvent,
        mockContext
      );

      // Execution can be slightly faster than the mocked 50ms delay on some runners,
      // so assert a lower bound that still verifies we measured >0 latency.
      expect(result.deliveryTime).toBeGreaterThanOrEqual(45);
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
        { id: 'test-plugin', config },
        mockEvent,
        mockContext
      );

      // Execution can be slightly faster than the mocked 30ms delay on some runners,
      // so assert a lower bound that still verifies we measured >0 latency.
      expect(result.deliveryTime).toBeGreaterThanOrEqual(25);
    });
  });

  describe('Idempotency key', () => {
    const okResponse = () => ({
      status: 200,
      statusText: 'OK',
      headers: new Map(),
      text: async () => 'OK',
    });

    it('forwards the context idempotency key so a receiver can recognise a retried delivery', async () => {
      const config: ValidatedWebhookConfig = { type: 'webhook', url: 'https://example.com/webhook' };
      mockFetch.mockResolvedValue(okResponse());

      await webhookHandler({ id: 'test-plugin', config }, mockEvent, {
        ...mockContext,
        idempotencyKey: 'run-1:action-1',
      });

      const headers = mockFetch.mock.calls[0][1].headers;
      expect(headers['X-Dculus-Idempotency-Key']).toBe('run-1:action-1');
    });

    it('omits the header when the caller has no stable key to offer', async () => {
      const config: ValidatedWebhookConfig = { type: 'webhook', url: 'https://example.com/webhook' };
      mockFetch.mockResolvedValue(okResponse());

      await webhookHandler({ id: 'test-plugin', config }, mockEvent, mockContext);

      const headers = mockFetch.mock.calls[0][1].headers;
      expect(headers).not.toHaveProperty('X-Dculus-Idempotency-Key');
    });

    // The key is the receiver's only way to tell a retry from a new delivery, so a configured
    // header must not be able to shadow it — in ANY casing. fetch lowercases header names and
    // combines duplicates, so a surviving case-variant would arrive appended to ours rather than
    // replaced, and the receiver would see a value that is not the stable key.
    it.each([
      'X-Dculus-Idempotency-Key',
      'x-dculus-idempotency-key',
      'X-DCULUS-IDEMPOTENCY-KEY',
      'x-Dculus-IDEMPOTENCY-key',
    ])('is not overridable by a configured %s header', async (headerName) => {
      const config: ValidatedWebhookConfig = {
        type: 'webhook',
        url: 'https://example.com/webhook',
        headers: { [headerName]: 'attacker-supplied' },
      };
      mockFetch.mockResolvedValue(okResponse());

      await webhookHandler({ id: 'test-plugin', config }, mockEvent, {
        ...mockContext,
        idempotencyKey: 'run-1:action-1',
      });

      const headers = mockFetch.mock.calls[0][1].headers;
      const sent = Object.entries(headers).filter(
        ([name]) => name.toLowerCase() === 'x-dculus-idempotency-key'
      );
      expect(sent).toEqual([['X-Dculus-Idempotency-Key', 'run-1:action-1']]);
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

      await webhookHandler({ id: 'test-plugin', config }, mockEvent, mockContext);

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

      await webhookHandler({ id: 'test-plugin', config }, mockEvent, mockContext);

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

      await webhookHandler({ id: 'test-plugin', config }, mockEvent, mockContext);

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
        { id: 'test-plugin', config },
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

      await webhookHandler({ id: 'test-plugin', config }, mockEvent, mockContext);

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
      await webhookHandler({ id: 'test-plugin', config }, mockEvent, mockContext);
      const signature1 = mockFetch.mock.calls[0][1].headers['X-Webhook-Signature'];

      mockFetch.mockClear();
      await webhookHandler({ id: 'test-plugin', config }, mockEvent, mockContext);
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

      await webhookHandler({ id: 'test-plugin', config: config1 }, mockEvent, mockContext);
      const signature1 = mockFetch.mock.calls[0][1].headers['X-Webhook-Signature'];

      mockFetch.mockClear();
      await webhookHandler({ id: 'test-plugin', config: config2 }, mockEvent, mockContext);
      const signature2 = mockFetch.mock.calls[0][1].headers['X-Webhook-Signature'];

      expect(signature1).not.toBe(signature2);
    });
  });

  describe('error handling', () => {
    it('uses "Unknown error" fallback when thrown error has no message', async () => {
      const config: ValidatedWebhookConfig = {
        type: 'webhook',
        url: 'https://example.com/hook',
        secret: '',
      };
      // Throw a non-Error object with no .message property
      mockFetch.mockRejectedValue({ code: 'NETWORK_FAIL' });

      const result = await webhookHandler({ id: 'test-plugin', config }, mockEvent, mockContext);
      expect((result as any).error).toBe('Webhook request failed');
    });
  });
});
