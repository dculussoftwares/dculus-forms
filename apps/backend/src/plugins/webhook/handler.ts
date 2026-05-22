import crypto from 'crypto';
import type { PluginHandler } from '../core/types.js';
import type { WebhookPayload, WebhookDeliveryResult, ValidatedWebhookConfig } from './types.js';

const generateSignature = (payload: string, secret: string): string =>
  crypto.createHmac('sha256', secret).update(payload).digest('hex');

const sendWebhook = async (
  url: string,
  payload: WebhookPayload,
  headers: Record<string, string> = {},
  secret?: string
): Promise<WebhookDeliveryResult> => {
  const startTime = Date.now();

  try {
    const payloadString = JSON.stringify(payload);
    const requestHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'Dculus-Forms-Webhook/1.0',
      ...headers,
    };

    if (secret) {
      requestHeaders['X-Webhook-Signature'] = generateSignature(payloadString, secret);
      requestHeaders['X-Webhook-Signature-Algorithm'] = 'sha256';
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: requestHeaders,
      body: payloadString,
    });

    const deliveryTime = Date.now() - startTime;

    let responseBody: any;
    try {
      const contentType = response.headers.get('content-type');
      responseBody = contentType?.includes('application/json')
        ? await response.json()
        : await response.text();
    } catch {
      responseBody = null;
    }

    if (response.status >= 200 && response.status < 300) {
      return { success: true, statusCode: response.status, responseBody, deliveryTime };
    }

    return {
      success: false,
      statusCode: response.status,
      responseBody,
      error: `HTTP ${response.status}: ${response.statusText}`,
      deliveryTime,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Unknown error',
      deliveryTime: Date.now() - startTime,
    };
  }
};

export const webhookHandler: PluginHandler = async (plugin, event, context) => {
  const config = plugin.config as ValidatedWebhookConfig;

  context.logger.info('Webhook plugin triggered', { url: config.url, eventType: event.type });

  const payload: WebhookPayload = {
    event: event.type,
    formId: event.formId,
    organizationId: event.organizationId,
    timestamp: event.timestamp.toISOString(),
    data: event.data,
  };

  if (event.data.responseId) payload.responseId = event.data.responseId;

  const result = await sendWebhook(config.url, payload, config.headers, config.secret);

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
