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
  EMAIL_SENT = 'subscription.email_sent',
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
 * Email sent event
 * Emitted when an email is sent as a result of form-submission activity —
 * the Email plugin (including Automations' email action, which reuses the
 * same handler), or the Response-copy "send a PDF copy to the respondent"
 * feature. System emails (OTP, password reset, invitations, billing) are
 * never counted and never emit this event.
 */
export interface EmailSentEvent extends SubscriptionEvent {
  type: SubscriptionEventType.EMAIL_SENT;
  data: {
    source: 'plugin' | 'response_copy';
  };
}

/**
 * Usage limit reached event
 * Emitted when usage reaches a warning threshold (e.g., 80% of limit)
 */
export interface UsageLimitReachedEvent extends Omit<SubscriptionEvent, 'formId'> {
  type: SubscriptionEventType.USAGE_LIMIT_REACHED;
  // AI credit usage is tracked per-organization, not per-form, so 'ai_credits' events have
  // no associated form. Views/submissions events always populate this.
  formId?: string;
  data: {
    usageType: 'views' | 'submissions' | 'emails' | 'ai_credits';
    current: number;
    limit: number;
    percentage: number;
  };
}

/**
 * Usage limit exceeded event
 * Emitted when usage exceeds the plan limit
 */
export interface UsageLimitExceededEvent extends Omit<SubscriptionEvent, 'formId'> {
  type: SubscriptionEventType.USAGE_LIMIT_EXCEEDED;
  // AI credit usage is tracked per-organization, not per-form, so 'ai_credits' events have
  // no associated form. Views/submissions events always populate this.
  formId?: string;
  data: {
    usageType: 'views' | 'submissions' | 'emails' | 'ai_credits';
    current: number;
    limit: number;
  };
}
