/**
 * Subscription Event Types
 * Type definitions for subscription-related events
 */

/**
 * Subscription event type enum
 */
export enum SubscriptionEventType {
  FORM_VIEWED = 'subscription.form_viewed',
  FORM_SUBMITTED = 'subscription.form_submitted',
  USAGE_LIMIT_REACHED = 'subscription.usage_limit_reached',
  USAGE_LIMIT_EXCEEDED = 'subscription.usage_limit_exceeded',
}

/**
 * Base subscription event interface
 */
export interface SubscriptionEvent {
  type: SubscriptionEventType;
  organizationId: string;
  formId: string;
  timestamp: Date;
  data?: Record<string, any>;
}

/**
 * Form viewed event
 * Emitted when a form is viewed by a user
 */
export interface FormViewedEvent extends SubscriptionEvent {
  type: SubscriptionEventType.FORM_VIEWED;
  data: {
    sessionId: string;
    userAgent?: string;
  };
}

/**
 * Form submitted event
 * Emitted when a form response is submitted
 */
export interface FormSubmittedEvent extends SubscriptionEvent {
  type: SubscriptionEventType.FORM_SUBMITTED;
  data: {
    responseId: string;
  };
}

/**
 * Usage limit reached event
 * Emitted when usage reaches a warning threshold (e.g., 80% of limit)
 */
export interface UsageLimitReachedEvent extends SubscriptionEvent {
  type: SubscriptionEventType.USAGE_LIMIT_REACHED;
  data: {
    usageType: 'views' | 'submissions';
    current: number;
    limit: number;
    percentage: number;
  };
}

/**
 * Usage limit exceeded event
 * Emitted when usage exceeds the plan limit
 */
export interface UsageLimitExceededEvent extends SubscriptionEvent {
  type: SubscriptionEventType.USAGE_LIMIT_EXCEEDED;
  data: {
    usageType: 'views' | 'submissions';
    current: number;
    limit: number;
  };
}
