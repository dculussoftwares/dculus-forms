import crypto from 'crypto';
import express, { Router } from 'express';
import { logger } from '../lib/logger.js';
import { chargebeeConfig } from '../lib/env.js';
import { webhookEventRepository } from '../repositories/webhookEventRepository.js';
import {
  syncSubscriptionFromWebhook,
  handleSubscriptionRenewal,
  handlePaymentFailed,
  handleCustomerDeleted,
} from '../services/chargebeeService.js';

const router: Router = express.Router();

// Upper bound on compared secret length — no real webhook password is anywhere
// near this long; it just bounds the padded-buffer allocation below.
const MAX_SECRET_LENGTH = 512;

// Constant-time string comparison without hashing the secret: both inputs are
// copied into fixed-size zero-padded buffers before crypto.timingSafeEqual,
// so differing lengths neither throw nor leak via comparison timing.
function timingSafeStringEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length > MAX_SECRET_LENGTH || bufB.length > MAX_SECRET_LENGTH) {
    return false;
  }
  const paddedA = Buffer.alloc(MAX_SECRET_LENGTH);
  const paddedB = Buffer.alloc(MAX_SECRET_LENGTH);
  bufA.copy(paddedA);
  bufB.copy(paddedB);
  return crypto.timingSafeEqual(paddedA, paddedB) && bufA.length === bufB.length;
}

/**
 * Chargebee Webhook Handler
 *
 * Handles webhook events from Chargebee
 * Events: subscription lifecycle (created/changed/renewed/cancelled/paused/resumed/deleted), customer_deleted, payment_succeeded/failed
 */

router.post('/webhooks/chargebee', async (req, res) => {
  try {
    // Verify webhook authenticity using Basic Auth password set in Chargebee dashboard.
    // Fail closed: if CHARGEBEE_WEBHOOK_PASSWORD is not configured, reject all requests
    // rather than accepting everything unauthenticated.
    if (!chargebeeConfig.webhookPassword) {
      logger.warn('[Chargebee Webhook] Rejected request: CHARGEBEE_WEBHOOK_PASSWORD is not configured');
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const authHeader = req.headers.authorization ?? '';
    const base64 = authHeader.startsWith('Basic ') ? authHeader.slice(6) : '';
    const decoded = Buffer.from(base64, 'base64').toString('utf8');
    const incomingPassword = decoded.includes(':') ? decoded.slice(decoded.indexOf(':') + 1) : decoded;

    // P3-09: Constant-time compare via zero-padded buffers (see timingSafeStringEqual)
    // so that differing lengths don't throw and aren't revealed via timing.
    const valid = timingSafeStringEqual(incomingPassword, chargebeeConfig.webhookPassword);

    if (!valid) {
      logger.warn('[Chargebee Webhook] Rejected request with invalid credentials');
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const event = req.body;

    logger.info('[Chargebee Webhook] Received event:', event.event_type, {
      eventId: event.id,
      subscriptionId: event.content?.subscription?.id,
      subscriptionStatus: event.content?.subscription?.status,
      customerId: event.content?.subscription?.customer_id ?? event.content?.customer?.id,
    });

    // At-least-once delivery: skip an event id we already handled. The claim is
    // released on failure so Chargebee's retry is processed.
    const eventId: string | undefined = typeof event.id === 'string' && event.id ? event.id : undefined;
    if (eventId && !(await webhookEventRepository.claim(eventId, String(event.event_type)))) {
      logger.info('[Chargebee Webhook] Duplicate event ignored:', event.event_type, { eventId });
      return res.status(200).json({ received: true, duplicate: true });
    }

    try {
      await processEvent(event);
    } catch (processingError) {
      if (eventId) {
        await webhookEventRepository.release(eventId).catch((releaseError) => {
          logger.error('[Chargebee Webhook] Failed to release event claim:', releaseError);
        });
      }
      throw processingError;
    }

    res.status(200).json({ received: true });
  } catch (error: any) {
    logger.error('[Chargebee Webhook] Error processing webhook:', error);
    // Non-2xx so Chargebee retries transient failures instead of dropping the event.
    res.status(500).json({ received: false, error: error.message });
  }
});

async function processEvent(event: any): Promise<void> {
  const subscription = event.content?.subscription;
  // Chargebee `occurred_at` is epoch seconds; used to ignore reordered/late events.
  const occurredAt =
    typeof event.occurred_at === 'number' ? new Date(event.occurred_at * 1000) : undefined;

  switch (event.event_type) {
    case 'subscription_created':
    case 'subscription_started':
      // New subscription created — may intentionally replace the stored one
      if (subscription) {
        await syncSubscriptionFromWebhook(subscription, { allowTakeover: true, occurredAt });
      }
      break;

    // A scheduled cancellation keeps the subscription active until term end
    case 'subscription_changed':
    case 'subscription_activated':
    case 'subscription_reactivated':
    case 'subscription_resumed':
    case 'subscription_scheduled_cancellation_removed':
    case 'subscription_cancellation_scheduled':
    case 'subscription_cancelled':
    case 'subscription_paused':
      if (subscription) {
        await syncSubscriptionFromWebhook(subscription, { occurredAt });
      }
      break;

    case 'subscription_renewed':
      // Renewal runs first: it compares the new term against the stored period,
      // which the sync below then overwrites.
      if (subscription) {
        await handleSubscriptionRenewal(subscription, { occurredAt });
        await syncSubscriptionFromWebhook(subscription, { occurredAt });
      }
      break;

    case 'subscription_deleted':
      if (subscription) {
        await syncSubscriptionFromWebhook(subscription, { occurredAt, forceStatus: 'cancelled' });
      }
      break;

    case 'customer_deleted':
      await handleCustomerDeleted(event, { occurredAt });
      break;

    case 'payment_succeeded':
      // The only event that proves dunning ended: may clear a past_due status
      if (subscription) {
        await syncSubscriptionFromWebhook(subscription, { occurredAt, clearPastDue: true });
      }
      break;

    case 'payment_failed':
      logger.warn('[Chargebee Webhook] Payment failed for subscription');
      await handlePaymentFailed(event, { occurredAt });
      break;

    default:
      logger.info('[Chargebee Webhook] Unhandled event type:', event.event_type);
  }
}

export { router as chargebeeWebhookRouter };
