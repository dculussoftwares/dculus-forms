import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import express, { Express } from 'express';
import { chargebeeWebhookRouter } from '../chargebee-webhooks.js';
import {
  syncSubscriptionFromWebhook,
  handleSubscriptionRenewal,
  handlePaymentFailed,
  handleCustomerDeleted,
} from '../../services/chargebeeService.js';
import { logger } from '../../lib/logger.js';
import { webhookEventRepository } from '../../repositories/webhookEventRepository.js';

// Mock dependencies
vi.mock('../../services/chargebeeService.js');
vi.mock('../../repositories/webhookEventRepository.js', () => ({
  webhookEventRepository: { claim: vi.fn(), release: vi.fn() },
}));
vi.mock('../../lib/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));
vi.mock('../../lib/env.js', () => ({
  chargebeeConfig: { webhookPassword: 'test-webhook-password' },
  appConfig: { port: 4000, corsOrigins: [], isTestEnv: true, nodeEnv: 'test' },
  s3Config: {},
  authConfig: {},
  emailConfig: {},
}));

describe('Chargebee Webhook Routes', () => {
  let app: Express;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(webhookEventRepository.claim).mockResolvedValue(true);
    vi.mocked(webhookEventRepository.release).mockResolvedValue({ count: 1 } as any);
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

  // Valid Basic Auth header for the mocked test password
  const VALID_AUTH = `Basic ${Buffer.from(':test-webhook-password').toString('base64')}`;

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
        .set('Authorization', VALID_AUTH)
        .send(createWebhookEvent('subscription_created', subscription));

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ received: true });
      expect(logger.info).toHaveBeenCalledWith(
        '[Chargebee Webhook] Received event:',
        'subscription_created',
        expect.objectContaining({ subscriptionId: 'sub_123', subscriptionStatus: 'active' })
      );
      expect(syncSubscriptionFromWebhook).toHaveBeenCalledWith(subscription, { allowTakeover: true, occurredAt: undefined });
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
        .set('Authorization', VALID_AUTH)
        .send(createWebhookEvent('subscription_started', subscription));

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ received: true });
      expect(syncSubscriptionFromWebhook).toHaveBeenCalledWith(subscription, { allowTakeover: true, occurredAt: undefined });
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
        .set('Authorization', VALID_AUTH)
        .send(createWebhookEvent('subscription_changed', subscription));

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ received: true });
      expect(syncSubscriptionFromWebhook).toHaveBeenCalledWith(subscription, expect.any(Object));
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
        .set('Authorization', VALID_AUTH)
        .send(createWebhookEvent('subscription_activated', subscription));

      expect(response.status).toBe(200);
      expect(syncSubscriptionFromWebhook).toHaveBeenCalledWith(subscription, expect.any(Object));
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
        .set('Authorization', VALID_AUTH)
        .send(createWebhookEvent('subscription_renewed', subscription));

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ received: true });
      expect(syncSubscriptionFromWebhook).toHaveBeenCalledWith(subscription, expect.any(Object));
      expect(handleSubscriptionRenewal).toHaveBeenCalledWith(subscription, expect.any(Object));
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
        .set('Authorization', VALID_AUTH)
        .send(createWebhookEvent('subscription_cancelled', subscription));

      expect(response.status).toBe(200);
      expect(syncSubscriptionFromWebhook).toHaveBeenCalledWith(subscription, expect.any(Object));
    });

    it('should handle subscription_cancellation_scheduled event', async () => {
      const subscription = {
        id: 'sub_123',
        plan_id: 'plan_456',
        status: 'non_renewing',
      };

      vi.mocked(syncSubscriptionFromWebhook).mockResolvedValue(undefined);

      const response = await request(app)
        .post('/webhooks/chargebee')
        .set('Authorization', VALID_AUTH)
        .send(createWebhookEvent('subscription_cancellation_scheduled', subscription));

      expect(response.status).toBe(200);
      expect(syncSubscriptionFromWebhook).toHaveBeenCalledWith(subscription, expect.any(Object));
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
        .set('Authorization', VALID_AUTH)
        .send(createWebhookEvent('subscription_paused', subscription));

      expect(response.status).toBe(200);
      expect(syncSubscriptionFromWebhook).toHaveBeenCalledWith(subscription, expect.any(Object));
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
        .set('Authorization', VALID_AUTH)
        .send(createWebhookEvent('subscription_reactivated', subscription));

      expect(response.status).toBe(200);
      expect(syncSubscriptionFromWebhook).toHaveBeenCalledWith(subscription, expect.any(Object));
    });

    it('should handle payment_succeeded event without calling sync', async () => {
      const response = await request(app)
        .post('/webhooks/chargebee')
        .set('Authorization', VALID_AUTH)
        .send(createWebhookEvent('payment_succeeded'));

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ received: true });
      expect(logger.info).toHaveBeenCalledWith(
        '[Chargebee Webhook] Received event:',
        'payment_succeeded',
        expect.any(Object)
      );
      expect(syncSubscriptionFromWebhook).not.toHaveBeenCalled();
    });

    it('should handle payment_failed event by calling handlePaymentFailed', async () => {
      vi.mocked(handlePaymentFailed).mockResolvedValueOnce(undefined);

      const response = await request(app)
        .post('/webhooks/chargebee')
        .set('Authorization', VALID_AUTH)
        .send(createWebhookEvent('payment_failed'));

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ received: true });
      expect(handlePaymentFailed).toHaveBeenCalledTimes(1);
      expect(syncSubscriptionFromWebhook).not.toHaveBeenCalled();
    });

    it('should handle unhandled event types', async () => {
      const response = await request(app)
        .post('/webhooks/chargebee')
        .set('Authorization', VALID_AUTH)
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
        .set('Authorization', VALID_AUTH)
        .send({ event_type: 'subscription_created' });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ received: true });
      expect(syncSubscriptionFromWebhook).not.toHaveBeenCalled();
    });

    it('should return 500 so Chargebee retries when processing fails', async () => {
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
        .set('Authorization', VALID_AUTH)
        .send(createWebhookEvent('subscription_created', subscription));

      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        received: false,
        error: 'Database connection failed',
      });
      expect(logger.error).toHaveBeenCalledWith(
        '[Chargebee Webhook] Error processing webhook:',
        expect.any(Error)
      );
    });

    it('should return 500 on renewal errors', async () => {
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
        .set('Authorization', VALID_AUTH)
        .send(createWebhookEvent('subscription_renewed', subscription));

      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        received: false,
        error: 'Renewal processing failed',
      });
      expect(logger.error).toHaveBeenCalled();
    });

    it('should return 500 for non-Error rejections', async () => {
      const subscription = {
        id: 'sub_123',
        plan_id: 'plan_456',
        status: 'active',
      };

      vi.mocked(syncSubscriptionFromWebhook).mockRejectedValue('String error');

      const response = await request(app)
        .post('/webhooks/chargebee')
        .set('Authorization', VALID_AUTH)
        .send(createWebhookEvent('subscription_created', subscription));

      expect(response.status).toBe(500);
      expect(response.body.received).toBe(false);
    });

    it('skips a duplicate event id without reprocessing it', async () => {
      vi.mocked(webhookEventRepository.claim).mockResolvedValue(false);

      const response = await request(app)
        .post('/webhooks/chargebee')
        .set('Authorization', VALID_AUTH)
        .send({ id: 'ev_1', ...createWebhookEvent('subscription_renewed', { id: 'sub_1' }) });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ received: true, duplicate: true });
      expect(handleSubscriptionRenewal).not.toHaveBeenCalled();
      expect(syncSubscriptionFromWebhook).not.toHaveBeenCalled();
    });

    it('releases the event claim when processing fails so the retry is handled', async () => {
      vi.mocked(syncSubscriptionFromWebhook).mockRejectedValue(new Error('db down'));

      const response = await request(app)
        .post('/webhooks/chargebee')
        .set('Authorization', VALID_AUTH)
        .send({ id: 'ev_2', ...createWebhookEvent('subscription_changed', { id: 'sub_1' }) });

      expect(response.status).toBe(500);
      expect(webhookEventRepository.release).toHaveBeenCalledWith('ev_2');
    });

    it('passes occurred_at to the sync as a Date', async () => {
      vi.mocked(syncSubscriptionFromWebhook).mockResolvedValue(undefined);
      const subscription = { id: 'sub_1' };

      await request(app)
        .post('/webhooks/chargebee')
        .set('Authorization', VALID_AUTH)
        .send({ occurred_at: 1704067200, ...createWebhookEvent('subscription_changed', subscription) });

      expect(syncSubscriptionFromWebhook).toHaveBeenCalledWith(subscription, {
        occurredAt: new Date(1704067200 * 1000),
      });
    });

    it('renews (period check) before the sync overwrites the stored period', async () => {
      const order: string[] = [];
      vi.mocked(handleSubscriptionRenewal).mockImplementation(async () => {
        order.push('renewal');
      });
      vi.mocked(syncSubscriptionFromWebhook).mockImplementation(async () => {
        order.push('sync');
      });

      await request(app)
        .post('/webhooks/chargebee')
        .set('Authorization', VALID_AUTH)
        .send(createWebhookEvent('subscription_renewed', { id: 'sub_1' }));

      expect(order).toEqual(['renewal', 'sync']);
    });

    it('lets only payment_succeeded clear past_due', async () => {
      vi.mocked(syncSubscriptionFromWebhook).mockResolvedValue(undefined);
      const subscription = { id: 'sub_1' };

      await request(app)
        .post('/webhooks/chargebee')
        .set('Authorization', VALID_AUTH)
        .send(createWebhookEvent('payment_succeeded', subscription));

      expect(syncSubscriptionFromWebhook).toHaveBeenCalledWith(subscription, {
        occurredAt: undefined,
        clearPastDue: true,
      });
    });

    it.each([
      'subscription_resumed',
      'subscription_scheduled_cancellation_removed',
      'subscription_cancellation_scheduled',
    ])('syncs %s', async (eventType) => {
      vi.mocked(syncSubscriptionFromWebhook).mockResolvedValue(undefined);
      const subscription = { id: 'sub_1' };

      const response = await request(app)
        .post('/webhooks/chargebee')
        .set('Authorization', VALID_AUTH)
        .send(createWebhookEvent(eventType, subscription));

      expect(response.status).toBe(200);
      expect(syncSubscriptionFromWebhook).toHaveBeenCalledWith(subscription, expect.any(Object));
    });

    it('marks the subscription cancelled on subscription_deleted', async () => {
      vi.mocked(syncSubscriptionFromWebhook).mockResolvedValue(undefined);
      const subscription = { id: 'sub_1' };

      await request(app)
        .post('/webhooks/chargebee')
        .set('Authorization', VALID_AUTH)
        .send(createWebhookEvent('subscription_deleted', subscription));

      expect(syncSubscriptionFromWebhook).toHaveBeenCalledWith(subscription, {
        occurredAt: undefined,
        forceStatus: 'cancelled',
      });
    });

    it('handles customer_deleted', async () => {
      vi.mocked(handleCustomerDeleted).mockResolvedValue(undefined);

      const response = await request(app)
        .post('/webhooks/chargebee')
        .set('Authorization', VALID_AUTH)
        .send({ event_type: 'customer_deleted', content: { customer: { id: 'org_1' } } });

      expect(response.status).toBe(200);
      expect(handleCustomerDeleted).toHaveBeenCalledTimes(1);
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
          .set('Authorization', VALID_AUTH)
          .send(createWebhookEvent(eventType, subscription));

        expect(response.status).toBe(200);
      }

      expect(syncSubscriptionFromWebhook).toHaveBeenCalledTimes(3);
    });

    it('should handle malformed webhook payload gracefully', async () => {
      const response = await request(app)
        .post('/webhooks/chargebee')
        .set('Authorization', VALID_AUTH)
        .send({ invalid: 'payload' });

      expect(response.status).toBe(200);
      expect(response.body.received).toBe(true);
    });

    it('should handle empty webhook payload', async () => {
      const response = await request(app).post('/webhooks/chargebee').set('Authorization', VALID_AUTH).send({});

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
          .set('Authorization', VALID_AUTH)
          .send(createWebhookEvent(eventType));

        expect(logger.info).toHaveBeenCalledWith(
          '[Chargebee Webhook] Received event:',
          eventType,
          expect.any(Object)
        );
      }
    });
  });
});
