import crypto from 'crypto';
import type { PluginHandler } from '../types.js';
import type {
  WebhookPayload,
  WebhookDeliveryResult,
  ValidatedWebhookConfig,
} from './types.js';

/**
 * Generate HMAC SHA-256 signature for webhook payload
 * Used to verify webhook authenticity at receiving end
 *
 * @param payload - Stringified JSON payload
 * @param secret - Webhook secret key
 * @returns HMAC signature as hex string
 */
const generateSignature = (payload: string, secret: string): string => {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
};

/**
 * Send webhook HTTP request
 *
 * @param url - Webhook destination URL
 * @param payload - Webhook payload object
 * @param headers - Additional HTTP headers
 * @param secret - Optional secret for HMAC signature
 * @returns Delivery result with status and timing
 */
const sendWebhook = async (
  url: string,
  payload: WebhookPayload,
  headers: Record<string, string> = {},
  secret?: string
): Promise<WebhookDeliveryResult> => {
  const startTime = Date.now();

  try {
    // Stringify payload
    const payloadString = JSON.stringify(payload);

    // Prepare headers
    const requestHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'Dculus-Forms-Webhook/1.0',
      ...headers,
    };

    // Add HMAC signature if secret is provided
    if (secret) {
      requestHeaders['X-Webhook-Signature'] = generateSignature(payloadString, secret);
      requestHeaders['X-Webhook-Signature-Algorithm'] = 'sha256';
    }

    // Send HTTP POST request
    const response = await fetch(url, {
      method: 'POST',
      headers: requestHeaders,
      body: payloadString,
    });

    const deliveryTime = Date.now() - startTime;

    // Parse response body (if JSON)
    let responseBody: any;
    try {
      const contentType = response.headers.get('content-type');
      if (contentType?.includes('application/json')) {
        responseBody = await response.json();
      } else {
        responseBody = await response.text();
      }
    } catch {
      responseBody = null;
    }

    // Check if response is successful (2xx status)
    if (response.status >= 200 && response.status < 300) {
      return {
        success: true,
        statusCode: response.status,
        responseBody,
        deliveryTime,
      };
    } else {
      return {
        success: false,
        statusCode: response.status,
        responseBody,
        error: `HTTP ${response.status}: ${response.statusText}`,
        deliveryTime,
      };
    }
  } catch (error: any) {
    const deliveryTime = Date.now() - startTime;
    return {
      success: false,
      error: error.message || 'Unknown error',
      deliveryTime,
    };
  }
};

/**
 * Webhook Plugin Handler
 * Sends HTTP POST requests to configured webhook URLs
 *
 * @param plugin - Plugin configuration with webhook URL and settings
 * @param event - Event that triggered the webhook
 * @param context - Plugin context with helper functions
 * @returns Webhook delivery result
 */
export const webhookHandler: PluginHandler = async (plugin, event, context) => {
  const config = plugin.config as ValidatedWebhookConfig;

  context.logger.info('Webhook plugin triggered', {
    url: config.url,
    eventType: event.type,
  });

  // Build minimal webhook payload (IDs only)
  const payload: WebhookPayload = {
    event: event.type,
    formId: event.formId,
    organizationId: event.organizationId,
    timestamp: event.timestamp.toISOString(),
    data: event.data,
  };

  // Add responseId if available in event data
  if (event.data.responseId) {
    payload.responseId = event.data.responseId;
  }

  // Send webhook
  const result = await sendWebhook(
    config.url,
    payload,
    config.headers,
    config.secret
  );

  if (result.success) {
    context.logger.info('Webhook delivered successfully', {
      url: config.url,
      statusCode: result.statusCode,
      deliveryTime: `${result.deliveryTime}ms`,
    });
  } else {
    context.logger.error('Webhook delivery failed', {
      url: config.url,
      error: result.error,
      statusCode: result.statusCode,
      deliveryTime: `${result.deliveryTime}ms`,
    });
  }

  return result;
};
