import crypto, { createHash } from 'crypto';
import express, { Router } from 'express';
import { logger } from '../lib/logger.js';
import { chargebeeConfig } from '../lib/env.js';
import {
  syncSubscriptionFromWebhook,
  handleSubscriptionRenewal,
  handlePaymentFailed,
} from '../services/chargebeeService.js';

const router: Router = express.Router();

/**
 * Chargebee Webhook Handler
 *
 * Handles webhook events from Chargebee
 * Events: subscription_created, subscription_changed, subscription_cancelled, subscription_renewed
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

    // P3-09: Hash both sides to a fixed length before comparing so that differing
    // buffer lengths don't throw and reveal the correct password length via timing.
    const hash = (s: string) => createHash('sha256').update(s).digest();
    let valid = false;
    try {
      valid = crypto.timingSafeEqual(hash(incomingPassword), hash(chargebeeConfig.webhookPassword));
    } catch {
      valid = false;
    }

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

    // Handle different event types
    switch (event.event_type) {
      case 'subscription_created':
      case 'subscription_started':
        // New subscription created
        if (event.content?.subscription) {
          await syncSubscriptionFromWebhook(event.content.subscription);
        }
        break;

      case 'subscription_changed':
      case 'subscription_activated':
        // Subscription plan changed or reactivated
        if (event.content?.subscription) {
          await syncSubscriptionFromWebhook(event.content.subscription);
        }
        break;

      case 'subscription_renewed':
        // Subscription renewed (new billing period)
        if (event.content?.subscription) {
          await syncSubscriptionFromWebhook(event.content.subscription);
          await handleSubscriptionRenewal(event.content.subscription);
        }
        break;

      case 'subscription_cancelled':
      case 'subscription_cancelled_scheduled':
        // Subscription cancelled
        if (event.content?.subscription) {
          await syncSubscriptionFromWebhook(event.content.subscription);
        }
        break;

      case 'subscription_paused':
        // Subscription paused
        if (event.content?.subscription) {
          await syncSubscriptionFromWebhook(event.content.subscription);
        }
        break;

      case 'subscription_reactivated':
        // Subscription reactivated after cancellation
        if (event.content?.subscription) {
          await syncSubscriptionFromWebhook(event.content.subscription);
        }
        break;

      case 'payment_succeeded':
        // Sync subscription to clear any past_due status set by a prior payment_failed event
        if (event.content?.subscription) {
          await syncSubscriptionFromWebhook(event.content.subscription);
        }
        break;

      case 'payment_failed':
        logger.warn('[Chargebee Webhook] Payment failed for subscription');
        await handlePaymentFailed(event);
        break;

      default:
        logger.info('[Chargebee Webhook] Unhandled event type:', event.event_type);
    }

    // Always respond with 200 to acknowledge receipt
    res.status(200).json({ received: true });
  } catch (error: any) {
    logger.error('[Chargebee Webhook] Error processing webhook:', error);
    // Still return 200 to prevent retries for errors we can't fix
    res.status(200).json({ received: true, error: error.message });
  }
});

export { router as chargebeeWebhookRouter };
