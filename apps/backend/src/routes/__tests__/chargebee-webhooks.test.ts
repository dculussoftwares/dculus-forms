import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import express, { Express } from 'express';
import { chargebeeWebhookRouter } from '../chargebee-webhooks.js';
import {
  syncSubscriptionFromWebhook,
  handleSubscriptionRenewal,
} from '../../services/chargebeeService.js';
import { logger } from '../../lib/logger.js';

// Mock dependencies
vi.mock('../../services/chargebeeService.js');
vi.mock('../../lib/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

describe('Chargebee Webhook Routes', () => {
  let app: Express;

  beforeEach(() => {
    vi.clearAllMocks();
    app = express();
    app.use(express.json());
    app.use('/', chargebeeWebhookRouter);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const createWebhookEvent = (eventType: string, subscription?: any) => ({
    event_type: eventType,
    content: subscription ? { subscription } : undefined,
  });

  describe('POST /webhooks/chargebee', () => {
    it('should handle subscription_created event', async () => {
      const subscription = {
        id: 'sub_123',
        plan_id: 'plan_456',
        status: 'active',
      };

      vi.mocked(syncSubscriptionFromWebhook).mockResolvedValue(undefined);

      const response = await request(app)
        .post('/webhooks/chargebee')
        .send(createWebhookEvent('subscription_created', subscription));

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ received: true });
      expect(logger.info).toHaveBeenCalledWith(
        '[Chargebee Webhook] Received event:',
        'subscription_created'
      );
      expect(syncSubscriptionFromWebhook).toHaveBeenCalledWith(subscription);
      expect(handleSubscriptionRenewal).not.toHaveBeenCalled();
    });

    it('should handle subscription_started event', async () => {
      const subscription = {
        id: 'sub_789',
        plan_id: 'plan_abc',
        status: 'active',
      };

      vi.mocked(syncSubscriptionFromWebhook).mockResolvedValue(undefined);

      const response = await request(app)
        .post('/webhooks/chargebee')
        .send(createWebhookEvent('subscription_started', subscription));

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ received: true });
      expect(syncSubscriptionFromWebhook).toHaveBeenCalledWith(subscription);
    });

    it('should handle subscription_changed event', async () => {
      const subscription = {
        id: 'sub_123',
        plan_id: 'plan_new',
        status: 'active',
      };

      vi.mocked(syncSubscriptionFromWebhook).mockResolvedValue(undefined);

      const response = await request(app)
        .post('/webhooks/chargebee')
        .send(createWebhookEvent('subscription_changed', subscription));

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ received: true });
      expect(syncSubscriptionFromWebhook).toHaveBeenCalledWith(subscription);
    });

    it('should handle subscription_activated event', async () => {
      const subscription = {
        id: 'sub_123',
        plan_id: 'plan_456',
        status: 'active',
      };

      vi.mocked(syncSubscriptionFromWebhook).mockResolvedValue(undefined);

      const response = await request(app)
        .post('/webhooks/chargebee')
        .send(createWebhookEvent('subscription_activated', subscription));

      expect(response.status).toBe(200);
      expect(syncSubscriptionFromWebhook).toHaveBeenCalledWith(subscription);
    });

    it('should handle subscription_renewed event with renewal handler', async () => {
      const subscription = {
        id: 'sub_123',
        plan_id: 'plan_456',
        status: 'active',
      };

      vi.mocked(syncSubscriptionFromWebhook).mockResolvedValue(undefined);
      vi.mocked(handleSubscriptionRenewal).mockResolvedValue(undefined);

      const response = await request(app)
        .post('/webhooks/chargebee')
        .send(createWebhookEvent('subscription_renewed', subscription));

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ received: true });
      expect(syncSubscriptionFromWebhook).toHaveBeenCalledWith(subscription);
      expect(handleSubscriptionRenewal).toHaveBeenCalledWith(subscription);
    });

    it('should handle subscription_cancelled event', async () => {
      const subscription = {
        id: 'sub_123',
        plan_id: 'plan_456',
        status: 'cancelled',
      };

      vi.mocked(syncSubscriptionFromWebhook).mockResolvedValue(undefined);

      const response = await request(app)
        .post('/webhooks/chargebee')
        .send(createWebhookEvent('subscription_cancelled', subscription));

      expect(response.status).toBe(200);
      expect(syncSubscriptionFromWebhook).toHaveBeenCalledWith(subscription);
    });

    it('should handle subscription_cancelled_scheduled event', async () => {
      const subscription = {
        id: 'sub_123',
        plan_id: 'plan_456',
        status: 'non_renewing',
      };

      vi.mocked(syncSubscriptionFromWebhook).mockResolvedValue(undefined);

      const response = await request(app)
        .post('/webhooks/chargebee')
        .send(createWebhookEvent('subscription_cancelled_scheduled', subscription));

      expect(response.status).toBe(200);
      expect(syncSubscriptionFromWebhook).toHaveBeenCalledWith(subscription);
    });

    it('should handle subscription_paused event', async () => {
      const subscription = {
        id: 'sub_123',
        plan_id: 'plan_456',
        status: 'paused',
      };

      vi.mocked(syncSubscriptionFromWebhook).mockResolvedValue(undefined);

      const response = await request(app)
        .post('/webhooks/chargebee')
        .send(createWebhookEvent('subscription_paused', subscription));

      expect(response.status).toBe(200);
      expect(syncSubscriptionFromWebhook).toHaveBeenCalledWith(subscription);
    });

    it('should handle subscription_reactivated event', async () => {
      const subscription = {
        id: 'sub_123',
        plan_id: 'plan_456',
        status: 'active',
      };

      vi.mocked(syncSubscriptionFromWebhook).mockResolvedValue(undefined);

      const response = await request(app)
        .post('/webhooks/chargebee')
        .send(createWebhookEvent('subscription_reactivated', subscription));

      expect(response.status).toBe(200);
      expect(syncSubscriptionFromWebhook).toHaveBeenCalledWith(subscription);
    });

    it('should handle payment_succeeded event without calling sync', async () => {
      const response = await request(app)
        .post('/webhooks/chargebee')
        .send(createWebhookEvent('payment_succeeded'));

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ received: true });
      expect(logger.info).toHaveBeenCalledWith(
        '[Chargebee Webhook] Payment succeeded for subscription'
      );
      expect(syncSubscriptionFromWebhook).not.toHaveBeenCalled();
    });

    it('should handle payment_failed event without calling sync', async () => {
      const response = await request(app)
        .post('/webhooks/chargebee')
        .send(createWebhookEvent('payment_failed'));

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ received: true });
      expect(logger.info).toHaveBeenCalledWith(
        '[Chargebee Webhook] Payment failed for subscription'
      );
      expect(syncSubscriptionFromWebhook).not.toHaveBeenCalled();
    });

    it('should handle unhandled event types', async () => {
      const response = await request(app)
        .post('/webhooks/chargebee')
        .send(createWebhookEvent('unknown_event_type'));

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ received: true });
      expect(logger.info).toHaveBeenCalledWith(
        '[Chargebee Webhook] Unhandled event type:',
        'unknown_event_type'
      );
      expect(syncSubscriptionFromWebhook).not.toHaveBeenCalled();
    });

    it('should not call sync if subscription content is missing', async () => {
      const response = await request(app)
        .post('/webhooks/chargebee')
        .send({ event_type: 'subscription_created' });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ received: true });
      expect(syncSubscriptionFromWebhook).not.toHaveBeenCalled();
    });

    it('should handle errors and still return 200', async () => {
      const subscription = {
        id: 'sub_123',
        plan_id: 'plan_456',
        status: 'active',
      };

      vi.mocked(syncSubscriptionFromWebhook).mockRejectedValue(
        new Error('Database connection failed')
      );

      const response = await request(app)
        .post('/webhooks/chargebee')
        .send(createWebhookEvent('subscription_created', subscription));

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        received: true,
        error: 'Database connection failed',
      });
      expect(logger.error).toHaveBeenCalledWith(
        '[Chargebee Webhook] Error processing webhook:',
        expect.any(Error)
      );
    });

    it('should handle renewal errors and still return 200', async () => {
      const subscription = {
        id: 'sub_123',
        plan_id: 'plan_456',
        status: 'active',
      };

      vi.mocked(syncSubscriptionFromWebhook).mockResolvedValue(undefined);
      vi.mocked(handleSubscriptionRenewal).mockRejectedValue(
        new Error('Renewal processing failed')
      );

      const response = await request(app)
        .post('/webhooks/chargebee')
        .send(createWebhookEvent('subscription_renewed', subscription));

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        received: true,
        error: 'Renewal processing failed',
      });
      expect(logger.error).toHaveBeenCalled();
    });

    it('should handle errors without error message', async () => {
      const subscription = {
        id: 'sub_123',
        plan_id: 'plan_456',
        status: 'active',
      };

      vi.mocked(syncSubscriptionFromWebhook).mockRejectedValue('String error');

      const response = await request(app)
        .post('/webhooks/chargebee')
        .send(createWebhookEvent('subscription_created', subscription));

      expect(response.status).toBe(200);
      expect(response.body.received).toBe(true);
    });

    it('should process multiple events in sequence', async () => {
      vi.mocked(syncSubscriptionFromWebhook).mockResolvedValue(undefined);

      const events = [
        'subscription_created',
        'subscription_changed',
        'subscription_cancelled',
      ];

      for (const eventType of events) {
        const subscription = { id: `sub_${eventType}`, status: 'active' };
        const response = await request(app)
          .post('/webhooks/chargebee')
          .send(createWebhookEvent(eventType, subscription));

        expect(response.status).toBe(200);
      }

      expect(syncSubscriptionFromWebhook).toHaveBeenCalledTimes(3);
    });

    it('should handle malformed webhook payload gracefully', async () => {
      const response = await request(app)
        .post('/webhooks/chargebee')
        .send({ invalid: 'payload' });

      expect(response.status).toBe(200);
      expect(response.body.received).toBe(true);
    });

    it('should handle empty webhook payload', async () => {
      const response = await request(app).post('/webhooks/chargebee').send({});

      expect(response.status).toBe(200);
      expect(response.body.received).toBe(true);
    });

    it('should log correct event type for each webhook', async () => {
      const eventTypes = [
        'subscription_created',
        'subscription_changed',
        'subscription_cancelled',
      ];

      for (const eventType of eventTypes) {
        vi.clearAllMocks();
        await request(app)
          .post('/webhooks/chargebee')
          .send(createWebhookEvent(eventType));

        expect(logger.info).toHaveBeenCalledWith(
          '[Chargebee Webhook] Received event:',
          eventType
        );
      }
    });
  });
});
