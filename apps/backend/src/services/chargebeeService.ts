import Chargebee from 'chargebee';
import { resetUsageCounters } from '../subscriptions/usageService.js';
import { subscriptionRepository } from '../repositories/index.js';

/**
 * Chargebee Service
 * Wrapper service for Chargebee API operations
 */

// Initialize Chargebee SDK
const chargebee = new Chargebee({
  site: process.env.CHARGEBEE_SITE!,
  apiKey: process.env.CHARGEBEE_API_KEY!,
});

/**
 * Plan configuration mapping
 * Maps plan IDs to their limits
 */
const PLAN_LIMITS = {
  free: {
    views: 10000,
    submissions: 1000,
  },
  starter: {
    views: null, // unlimited
    submissions: 10000,
  },
  advanced: {
    views: null, // unlimited
    submissions: 100000,
  },
} as const;

/**
 * Create a Chargebee customer for an organization
 */
export const createChargebeeCustomer = async (
  organizationId: string,
  organizationName: string,
  email: string
): Promise<string> => {
  try {
    const result = await chargebee.customer.create({
      id: `org_${organizationId}`,
      email,
      first_name: organizationName,
      company: organizationName,
    } as any);

    return result.customer.id;
  } catch (error: any) {
    console.error('[Chargebee Service] Error creating customer:', error);
    throw new Error(`Failed to create Chargebee customer: ${error.message}`);
  }
};

/**
 * Create a free subscription for an organization
 * Called when a new organization is created
 */
export const createFreeSubscription = async (
  organizationId: string,
  chargebeeCustomerId: string
): Promise<void> => {
  try {
    // Free plan doesn't need a Chargebee subscription
    // Just create the local subscription record
    const now = new Date();
    const periodEnd = new Date();
    periodEnd.setMonth(periodEnd.getMonth() + 1); // Free plan is monthly

    await subscriptionRepository.createSubscription({
      id: `sub_${organizationId}`,
      organizationId,
      chargebeeCustomerId,
      chargebeeSubscriptionId: null, // No Chargebee subscription for free plan
      planId: 'free',
      status: 'active',
      viewsUsed: 0,
      submissionsUsed: 0,
      viewsLimit: PLAN_LIMITS.free.views,
      submissionsLimit: PLAN_LIMITS.free.submissions,
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
    });

    console.log('[Chargebee Service] Created free subscription for organization:', organizationId);
  } catch (error: any) {
    console.error('[Chargebee Service] Error creating free subscription:', error);
    throw new Error(`Failed to create free subscription: ${error.message}`);
  }
};

/**
 * Create a Chargebee hosted page for checkout
 * Returns a URL that the user can visit to complete payment
 */
export const createCheckoutHostedPage = async (
  customerId: string,
  itemPriceId: string
): Promise<{ url: string; id: string }> => {
  try {
    // Use checkoutNewForItems for Product Catalog 2.0
    const result = await chargebee.hostedPage.checkoutNewForItems({
      subscription_items: [
        {
          item_price_id: itemPriceId,
          quantity: 1,
        },
      ],
      customer: {
        id: customerId,
      },
    } as any);

    return {
      url: result.hosted_page.url!,
      id: result.hosted_page.id!,
    };
  } catch (error: any) {
    console.error('[Chargebee Service] Error creating checkout hosted page:', error);
    throw new Error(`Failed to create checkout page: ${error.message}`);
  }
};

/**
 * Create a Chargebee portal session
 * Returns a URL for the customer to manage their subscription
 */
export const createPortalSession = async (customerId: string): Promise<string> => {
  try {
    const result = await chargebee.portalSession.create({
      customer: {
        id: customerId,
      },
    } as any);

    return result.portal_session.access_url;
  } catch (error: any) {
    console.error('[Chargebee Service] Error creating portal session:', error);
    throw new Error(`Failed to create portal session: ${error.message}`);
  }
};

/**
 * Retrieve subscription details from Chargebee
 */
export const getChargebeeSubscription = async (subscriptionId: string) => {
  try {
    const result = await chargebee.subscription.retrieve(subscriptionId);
    return result.subscription;
  } catch (error: any) {
    console.error('[Chargebee Service] Error retrieving subscription:', error);
    throw new Error(`Failed to retrieve subscription: ${error.message}`);
  }
};

/**
 * Cancel a Chargebee subscription
 */
export const cancelChargebeeSubscription = async (
  subscriptionId: string,
  endOfTerm: boolean = true
): Promise<void> => {
  try {
    await chargebee.subscription.cancel(subscriptionId, {
      end_of_term: endOfTerm,
    } as any);

    console.log('[Chargebee Service] Cancelled subscription:', subscriptionId);
  } catch (error: any) {
    console.error('[Chargebee Service] Error cancelling subscription:', error);
    throw new Error(`Failed to cancel subscription: ${error.message}`);
  }
};

/**
 * Reactivate a cancelled Chargebee subscription
 */
export const reactivateChargebeeSubscription = async (
  subscriptionId: string
): Promise<void> => {
  try {
    await chargebee.subscription.reactivate(subscriptionId);
    console.log('[Chargebee Service] Reactivated subscription:', subscriptionId);
  } catch (error: any) {
    console.error('[Chargebee Service] Error reactivating subscription:', error);
    throw new Error(`Failed to reactivate subscription: ${error.message}`);
  }
};

/**
 * Sync subscription from Chargebee webhook event
 * Updates local subscription record based on Chargebee event
 */
export const syncSubscriptionFromWebhook = async (
  subscriptionData: any
): Promise<void> => {
  try {
    const customerId = subscriptionData.customer_id;
    const organizationId = customerId.replace('org_', '');

    // Determine plan ID from item price ID
    let planId = 'free';
    if (subscriptionData.subscription_items?.[0]?.item_price_id) {
      const itemPriceId = subscriptionData.subscription_items[0].item_price_id;
      if (itemPriceId.startsWith('starter-')) {
        planId = 'starter';
      } else if (itemPriceId.startsWith('advanced-')) {
        planId = 'advanced';
      }
    }

    // Get plan limits
    const limits = PLAN_LIMITS[planId as keyof typeof PLAN_LIMITS];

    // Map Chargebee status to our status
    let status = 'active';
    if (subscriptionData.status === 'cancelled') status = 'cancelled';
    else if (subscriptionData.status === 'non_renewing') status = 'cancelled';
    else if (subscriptionData.status === 'paused') status = 'expired';

    // Update or create subscription
    await subscriptionRepository.upsertForOrganization(
      organizationId,
      {
        chargebeeSubscriptionId: subscriptionData.id,
        planId,
        status,
        viewsLimit: limits.views,
        submissionsLimit: limits.submissions,
        currentPeriodStart: new Date(
          subscriptionData.current_term_start * 1000
        ),
        currentPeriodEnd: new Date(subscriptionData.current_term_end * 1000),
      },
      {
        id: `sub_${organizationId}`,
        organizationId,
        chargebeeCustomerId: customerId,
        chargebeeSubscriptionId: subscriptionData.id,
        planId,
        status,
        viewsUsed: 0,
        submissionsUsed: 0,
        viewsLimit: limits.views,
        submissionsLimit: limits.submissions,
        currentPeriodStart: new Date(
          subscriptionData.current_term_start * 1000
        ),
        currentPeriodEnd: new Date(subscriptionData.current_term_end * 1000),
      }
    );

    console.log('[Chargebee Service] Synced subscription for organization:', organizationId);
  } catch (error: any) {
    console.error('[Chargebee Service] Error syncing subscription:', error);
    throw error;
  }
};

/**
 * Handle subscription renewal from webhook
 * Resets usage counters for the new billing period
 */
export const handleSubscriptionRenewal = async (
  subscriptionData: any
): Promise<void> => {
  try {
    const customerId = subscriptionData.customer_id;
    const organizationId = customerId.replace('org_', '');

    const periodStart = new Date(subscriptionData.current_term_start * 1000);
    const periodEnd = new Date(subscriptionData.current_term_end * 1000);

    await resetUsageCounters(organizationId, periodStart, periodEnd);

    console.log('[Chargebee Service] Reset usage counters for organization:', organizationId);
  } catch (error: any) {
    console.error('[Chargebee Service] Error handling subscription renewal:', error);
    throw error;
  }
};

/**
 * Get available plans with pricing
 */
export const getAvailablePlans = () => {
  return [
    {
      id: 'free',
      name: 'Free Plan',
      prices: [
        {
          id: 'free-usd-monthly',
          currency: 'USD',
          amount: 0,
          period: 'month',
        },
        {
          id: 'free-inr-monthly',
          currency: 'INR',
          amount: 0,
          period: 'month',
        },
      ],
      features: {
        views: 10000,
        submissions: 1000,
      },
    },
    {
      id: 'starter',
      name: 'Starter Plan',
      prices: [
        {
          id: 'starter-usd-monthly',
          currency: 'USD',
          amount: 600, // $6.00
          period: 'month',
        },
        {
          id: 'starter-usd-yearly',
          currency: 'USD',
          amount: 6600, // $66.00/year
          period: 'year',
        },
        {
          id: 'starter-inr-monthly',
          currency: 'INR',
          amount: 48900, // ₹489.00
          period: 'month',
        },
        {
          id: 'starter-inr-yearly',
          currency: 'INR',
          amount: 540000, // ₹5,400/year
          period: 'year',
        },
      ],
      features: {
        views: null, // unlimited
        submissions: 10000,
      },
    },
    {
      id: 'advanced',
      name: 'Advanced Plan',
      prices: [
        {
          id: 'advanced-usd-monthly',
          currency: 'USD',
          amount: 1500, // $15.00
          period: 'month',
        },
        {
          id: 'advanced-usd-yearly',
          currency: 'USD',
          amount: 16800, // $168.00/year
          period: 'year',
        },
        {
          id: 'advanced-inr-monthly',
          currency: 'INR',
          amount: 128900, // ₹1,289.00
          period: 'month',
        },
        {
          id: 'advanced-inr-yearly',
          currency: 'INR',
          amount: 1426800, // ₹14,268/year
          period: 'year',
        },
      ],
      features: {
        views: null, // unlimited
        submissions: 100000,
      },
    },
  ];
};
