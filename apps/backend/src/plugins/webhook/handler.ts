import crypto from 'crypto';
import type { PluginHandler } from '../core/types.js';
import { safeFetch, toExcerpt, describeFetchFailure } from '../../lib/safeFetch.js';
import { logger } from '../../lib/logger.js';
import type { WebhookPayload, WebhookDeliveryResult, ValidatedWebhookConfig } from './types.js';

/** Header carrying the per-delivery idempotency key. Receivers dedupe retries on this. */
const IDEMPOTENCY_HEADER = 'X-Dculus-Idempotency-Key';

const generateSignature = (payload: string, secret: string): string =>
  crypto.createHmac('sha256', secret).update(payload).digest('hex');

const sendWebhook = async (
  url: string,
  payload: WebhookPayload,
  headers: Record<string, string> = {},
  secret?: string,
  idempotencyKey?: string
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

    // Set last, after the user's own `headers`, so a configured header can never shadow it —
    // this is the receiver's only way to tell a retry of one delivery from a genuinely new one.
    // An automation action retries up to 3× on any error, and a timeout is not proof the receiver
    // did nothing: it may have committed its work and lost the response on the way back.
    //
    // Assigning over the key is not enough: HTTP clients may lowercase header names and *combine*
    // duplicates, so a configured `x-dculus-idempotency-key` would arrive appended to ours
    // ("configured, generated") rather than replaced — leaving the receiver with a value that is
    // not the stable key at all. Every case-variant has to go first.
    if (idempotencyKey) {
      for (const name of Object.keys(requestHeaders)) {
        if (name.toLowerCase() === IDEMPOTENCY_HEADER.toLowerCase()) delete requestHeaders[name];
      }
      requestHeaders[IDEMPOTENCY_HEADER] = idempotencyKey;
    }

    const response = await safeFetch(url, {
      method: 'POST',
      headers: requestHeaders,
      body: payloadString,
    });

    const deliveryTime = Date.now() - startTime;
    // The receiver's body is never returned to the caller or kept whole: it is attacker-chosen
    // text from whatever the URL reached. Only the status and a short excerpt are recorded.
    const isRedirect = response.status >= 300 && response.status < 400;
    const responseExcerpt = isRedirect ? undefined : toExcerpt(response.body);

    if (response.status >= 200 && response.status < 300) {
      return { success: true, statusCode: response.status, responseExcerpt, deliveryTime };
    }

    return {
      success: false,
      statusCode: response.status,
      responseExcerpt,
      error: isRedirect
        ? `HTTP ${response.status}: redirects are not followed`
        : `HTTP ${response.status}${response.statusText ? `: ${response.statusText}` : ''}`,
      deliveryTime,
    };
  } catch (error: any) {
    logger.warn('Webhook request failed', { reason: error?.message });
    return {
      success: false,
      error: describeFetchFailure(error),
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

  const result = await sendWebhook(
    config.url,
    payload,
    config.headers,
    config.secret,
    context.idempotencyKey
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
