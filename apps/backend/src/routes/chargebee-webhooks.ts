import express, { Router } from 'express';
import { logger } from '../lib/logger.js';
import {
  syncSubscriptionFromWebhook,
  handleSubscriptionRenewal,
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
    const event = req.body;

    logger.info('[Chargebee Webhook] Received event:', event.event_type);

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
        logger.info('[Chargebee Webhook] Payment succeeded for subscription');
        break;

      case 'payment_failed':
        logger.info('[Chargebee Webhook] Payment failed for subscription');
        // TODO: Send notification to organization owner
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
