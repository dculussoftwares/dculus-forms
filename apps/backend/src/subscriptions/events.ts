import { EventEmitter } from 'events';
import type {
  SubscriptionEvent,
  FormViewedEvent,
  FormSubmittedEvent,
  UsageLimitReachedEvent,
  UsageLimitExceededEvent,
} from './types.js';
import { SubscriptionEventType } from './types.js';
import { logger } from '../lib/logger.js';

/**
 * Subscription Event System
 * Central event emitter for all subscription-related events
 *
 * Supported events:
 * - subscription.form_viewed: Triggered when a form is viewed
 * - subscription.form_submitted: Triggered when a form is submitted
 * - subscription.usage_limit_reached: Warning when approaching usage limits
 * - subscription.usage_limit_exceeded: Alert when usage limits are exceeded
 */

// Create singleton event emitter
const subscriptionEventEmitter = new EventEmitter();

// Increase max listeners to handle multiple subscriptions
subscriptionEventEmitter.setMaxListeners(100);

/**
 * Initialize subscription event system
 * Sets up event listeners for subscription tracking
 */
export const initializeSubscriptionEvents = (): void => {
  logger.info('[Subscription Events] Initializing subscription event system...');

  // Listen for form viewed events
  subscriptionEventEmitter.on(
    SubscriptionEventType.FORM_VIEWED,
    async (event: FormViewedEvent) => {
      logger.info('[Subscription Events] Form viewed:', {
        organizationId: event.organizationId,
        formId: event.formId,
      });

      // Event will be processed by the subscription usage service
      // The service will be attached as a listener in the next step
    }
  );

  // Listen for form submitted events
  subscriptionEventEmitter.on(
    SubscriptionEventType.FORM_SUBMITTED,
    async (event: FormSubmittedEvent) => {
      logger.info('[Subscription Events] Form submitted:', {
        organizationId: event.organizationId,
        formId: event.formId,
        responseId: event.data.responseId,
      });

      // Event will be processed by the subscription usage service
    }
  );

  // Listen for usage limit warnings
  subscriptionEventEmitter.on(
    SubscriptionEventType.USAGE_LIMIT_REACHED,
    async (event: UsageLimitReachedEvent) => {
      logger.warn('[Subscription Events] Usage limit warning:', {
        organizationId: event.organizationId,
        usageType: event.data.usageType,
        current: event.data.current,
        limit: event.data.limit,
        percentage: event.data.percentage,
      });

      // Future: Send email notification to organization owner
    }
  );

  // Listen for usage limit exceeded events
  subscriptionEventEmitter.on(
    SubscriptionEventType.USAGE_LIMIT_EXCEEDED,
    async (event: UsageLimitExceededEvent) => {
      logger.error('[Subscription Events] Usage limit exceeded:', {
        organizationId: event.organizationId,
        usageType: event.data.usageType,
        current: event.data.current,
        limit: event.data.limit,
      });

      // Future: Send urgent email notification to organization owner
    }
  );

  logger.info('[Subscription Events] Subscription event system initialized successfully');
};

/**
 * Emit a form viewed event
 * Triggered when a user views a form
 *
 * @param organizationId - ID of the organization that owns the form
 * @param formId - ID of the form that was viewed
 * @param sessionId - Anonymous session ID
 * @param userAgent - Optional user agent string
 */
export const emitFormViewed = (
  organizationId: string,
  formId: string,
  sessionId: string,
  userAgent?: string
): void => {
  const event: FormViewedEvent = {
    type: SubscriptionEventType.FORM_VIEWED,
    organizationId,
    formId,
    timestamp: new Date(),
    data: {
      sessionId,
      userAgent,
    },
  };

  subscriptionEventEmitter.emit(SubscriptionEventType.FORM_VIEWED, event);
};

/**
 * Emit a form submitted event
 * Triggered when a user submits a form response
 *
 * @param organizationId - ID of the organization that owns the form
 * @param formId - ID of the form that was submitted
 * @param responseId - ID of the created response
 */
export const emitFormSubmitted = (
  organizationId: string,
  formId: string,
  responseId: string
): void => {
  const event: FormSubmittedEvent = {
    type: SubscriptionEventType.FORM_SUBMITTED,
    organizationId,
    formId,
    timestamp: new Date(),
    data: {
      responseId,
    },
  };

  subscriptionEventEmitter.emit(SubscriptionEventType.FORM_SUBMITTED, event);
};

/**
 * Emit a usage limit reached event (warning)
 * Triggered when usage reaches a warning threshold (e.g., 80% of limit)
 *
 * @param organizationId - ID of the organization
 * @param formId - ID of the form
 * @param usageType - Type of usage ('views' or 'submissions')
 * @param current - Current usage count
 * @param limit - Usage limit
 * @param percentage - Current usage as percentage of limit
 */
export const emitUsageLimitReached = (
  organizationId: string,
  formId: string,
  usageType: 'views' | 'submissions',
  current: number,
  limit: number,
  percentage: number
): void => {
  const event: UsageLimitReachedEvent = {
    type: SubscriptionEventType.USAGE_LIMIT_REACHED,
    organizationId,
    formId,
    timestamp: new Date(),
    data: {
      usageType,
      current,
      limit,
      percentage,
    },
  };

  subscriptionEventEmitter.emit(SubscriptionEventType.USAGE_LIMIT_REACHED, event);
};

/**
 * Emit a usage limit exceeded event (critical)
 * Triggered when usage exceeds the plan limit
 *
 * @param organizationId - ID of the organization
 * @param formId - ID of the form
 * @param usageType - Type of usage ('views' or 'submissions')
 * @param current - Current usage count
 * @param limit - Usage limit
 */
export const emitUsageLimitExceeded = (
  organizationId: string,
  formId: string,
  usageType: 'views' | 'submissions',
  current: number,
  limit: number
): void => {
  const event: UsageLimitExceededEvent = {
    type: SubscriptionEventType.USAGE_LIMIT_EXCEEDED,
    organizationId,
    formId,
    timestamp: new Date(),
    data: {
      usageType,
      current,
      limit,
    },
  };

  subscriptionEventEmitter.emit(SubscriptionEventType.USAGE_LIMIT_EXCEEDED, event);
};

/**
 * Get the event emitter instance (for testing purposes)
 */
export const getSubscriptionEventEmitter = (): EventEmitter => {
  return subscriptionEventEmitter;
};
