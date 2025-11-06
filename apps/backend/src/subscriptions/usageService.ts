import { PrismaClient } from '@prisma/client';
import {
  emitUsageLimitReached,
  emitUsageLimitExceeded,
  getSubscriptionEventEmitter,
} from './events.js';
import { SubscriptionEventType } from './types.js';
import type { FormViewedEvent, FormSubmittedEvent } from './types.js';
import { logger } from '../lib/logger.js';

const prisma = new PrismaClient();

/**
 * Subscription Usage Service
 * Handles tracking and enforcing subscription usage limits
 */

// Warning threshold percentage (emit warning at 80% usage)
const WARNING_THRESHOLD = 80;

/**
 * Initialize the usage service
 * Sets up event listeners for usage tracking
 */
export const initializeUsageService = (): void => {
  logger.info('[Usage Service] Initializing subscription usage service...');

  const eventEmitter = getSubscriptionEventEmitter();

  // Track form views
  eventEmitter.on(SubscriptionEventType.FORM_VIEWED, async (event: FormViewedEvent) => {
    try {
      await trackFormView(event.organizationId, event.formId);
    } catch (error: any) {
      logger.error('[Usage Service] Error tracking form view:', error);
    }
  });

  // Track form submissions
  eventEmitter.on(
    SubscriptionEventType.FORM_SUBMITTED,
    async (event: FormSubmittedEvent) => {
      try {
        await trackFormSubmission(event.organizationId, event.formId);
      } catch (error: any) {
        logger.error('[Usage Service] Error tracking form submission:', error);
      }
    }
  );

  logger.info('[Usage Service] Subscription usage service initialized successfully');
};

/**
 * Track a form view
 * Increments the viewsUsed counter and checks limits
 *
 * @param organizationId - ID of the organization
 * @param formId - ID of the form
 */
export const trackFormView = async (
  organizationId: string,
  formId: string
): Promise<void> => {
  // Get current subscription
  const subscription = await prisma.subscription.findUnique({
    where: { organizationId },
  });

  if (!subscription) {
    logger.warn('[Usage Service] No subscription found for organization:', organizationId);
    return;
  }

  // Increment views counter
  const updatedSubscription = await prisma.subscription.update({
    where: { organizationId },
    data: {
      viewsUsed: {
        increment: 1,
      },
    },
  });

  // Check if we need to emit warning or exceeded events
  checkUsageLimits(
    organizationId,
    formId,
    'views',
    updatedSubscription.viewsUsed,
    updatedSubscription.viewsLimit
  );
};

/**
 * Track a form submission
 * Increments the submissionsUsed counter and checks limits
 *
 * @param organizationId - ID of the organization
 * @param formId - ID of the form
 */
export const trackFormSubmission = async (
  organizationId: string,
  formId: string
): Promise<void> => {
  // Get current subscription
  const subscription = await prisma.subscription.findUnique({
    where: { organizationId },
  });

  if (!subscription) {
    logger.warn('[Usage Service] No subscription found for organization:', organizationId);
    return;
  }

  // Increment submissions counter
  const updatedSubscription = await prisma.subscription.update({
    where: { organizationId },
    data: {
      submissionsUsed: {
        increment: 1,
      },
    },
  });

  // Check if we need to emit warning or exceeded events
  checkUsageLimits(
    organizationId,
    formId,
    'submissions',
    updatedSubscription.submissionsUsed,
    updatedSubscription.submissionsLimit
  );
};

/**
 * Check usage against limits and emit appropriate events
 *
 * @param organizationId - ID of the organization
 * @param formId - ID of the form
 * @param usageType - Type of usage ('views' or 'submissions')
 * @param current - Current usage count
 * @param limit - Usage limit (null = unlimited)
 */
const checkUsageLimits = (
  organizationId: string,
  formId: string,
  usageType: 'views' | 'submissions',
  current: number,
  limit: number | null
): void => {
  // Unlimited usage - no limits to check
  if (limit === null) {
    return;
  }

  // Calculate usage percentage
  const percentage = (current / limit) * 100;

  // Emit exceeded event if over limit
  if (current > limit) {
    emitUsageLimitExceeded(organizationId, formId, usageType, current, limit);
    return;
  }

  // Emit warning event if approaching limit
  if (percentage >= WARNING_THRESHOLD) {
    emitUsageLimitReached(organizationId, formId, usageType, current, limit, percentage);
  }
};

/**
 * Check if organization has exceeded usage limits
 * Used for enforcement before allowing actions
 *
 * @param organizationId - ID of the organization
 * @returns Object indicating if views or submissions are exceeded
 */
export const checkUsageExceeded = async (
  organizationId: string
): Promise<{
  viewsExceeded: boolean;
  submissionsExceeded: boolean;
}> => {
  const subscription = await prisma.subscription.findUnique({
    where: { organizationId },
  });

  if (!subscription) {
    // No subscription = free plan with limits
    return {
      viewsExceeded: false,
      submissionsExceeded: false,
    };
  }

  return {
    viewsExceeded:
      subscription.viewsLimit !== null && subscription.viewsUsed >= subscription.viewsLimit,
    submissionsExceeded:
      subscription.submissionsLimit !== null &&
      subscription.submissionsUsed >= subscription.submissionsLimit,
  };
};

/**
 * Get current usage for an organization
 *
 * @param organizationId - ID of the organization
 * @returns Current usage and limits
 */
export const getUsage = async (organizationId: string) => {
  const subscription = await prisma.subscription.findUnique({
    where: { organizationId },
  });

  if (!subscription) {
    return null;
  }

  return {
    views: {
      used: subscription.viewsUsed,
      limit: subscription.viewsLimit,
      unlimited: subscription.viewsLimit === null,
    },
    submissions: {
      used: subscription.submissionsUsed,
      limit: subscription.submissionsLimit,
      unlimited: subscription.submissionsLimit === null,
    },
    planId: subscription.planId,
    status: subscription.status,
  };
};

/**
 * Reset usage counters for a new billing period
 * Called by webhook handler when Chargebee sends billing period renewal
 *
 * @param organizationId - ID of the organization
 * @param periodStart - Start of new billing period
 * @param periodEnd - End of new billing period
 */
export const resetUsageCounters = async (
  organizationId: string,
  periodStart: Date,
  periodEnd: Date
): Promise<void> => {
  await prisma.subscription.update({
    where: { organizationId },
    data: {
      viewsUsed: 0,
      submissionsUsed: 0,
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
    },
  });

  logger.info('[Usage Service] Usage counters reset for organization:', organizationId);
};
