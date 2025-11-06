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
    // Get base URL from environment or use default
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

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
      redirect_url: `${baseUrl}/subscription/success`,
      cancel_url: `${baseUrl}/subscription/cancel`,
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
 * Cache for plans to avoid hitting Chargebee API on every request
 * Cache expires after 5 minutes
 */
let plansCache: any[] | null = null;
let plansCacheTime: number = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Get available plans with pricing from Chargebee
 * Fetches all item prices with their associated items and entitlements
 * Results are cached for 5 minutes to improve performance
 */
export const getAvailablePlans = async () => {
  // Check cache first
  const now = Date.now();
  if (plansCache && (now - plansCacheTime) < CACHE_DURATION) {
    console.log('[Chargebee Service] Returning cached plans');
    return plansCache;
  }

  try {
    // Fetch all item prices from Chargebee
    let offset: string | undefined = undefined;
    let allItemPrices: any[] = [];

    do {
      const params: any = { limit: 100 };
      if (offset) params.offset = offset;

      const result: any = await chargebee.itemPrice.list(params);
      allItemPrices = allItemPrices.concat(result.list);
      offset = result.next_offset;
    } while (offset);

    // Fetch entitlements (features) for all item prices
    offset = undefined;
    let allEntitlements: any[] = [];

    do {
      const params: any = { limit: 100 };
      if (offset) params.offset = offset;

      const result: any = await chargebee.entitlement.list(params);
      allEntitlements = allEntitlements.concat(result.list);
      offset = result.next_offset;
    } while (offset);

    // Group entitlements by item price ID
    const entitlementsByItemPrice: Record<string, Record<string, any>> = {};
    for (const entry of allEntitlements) {
      const ent = entry.entitlement;
      if (!entitlementsByItemPrice[ent.entity_id]) {
        entitlementsByItemPrice[ent.entity_id] = {};
      }
      // Map feature_id to value (e.g., "form_views" -> 10000)
      entitlementsByItemPrice[ent.entity_id][ent.feature_id] = ent.value;
    }

    // Fetch item details and group prices by item (plan)
    const itemDetailsCache: Record<string, any> = {};
    const plansByItem: Record<string, any> = {};

    for (const entry of allItemPrices) {
      const itemPrice = entry.item_price;

      // Skip non-plan items (addons, charges)
      if (itemPrice.item_type !== 'plan') continue;

      // Fetch item details if not cached
      if (!itemDetailsCache[itemPrice.item_id]) {
        const itemResult: any = await chargebee.item.retrieve(itemPrice.item_id);
        itemDetailsCache[itemPrice.item_id] = itemResult.item;
      }

      const item = itemDetailsCache[itemPrice.item_id];
      // Use external_name as plan ID, or normalize the item name to lowercase without spaces
      let planId = item.external_name || item.name || item.id;
      // Normalize to lowercase and remove spaces for consistency
      planId = planId.toLowerCase().replace(/\s+/g, '-').replace(/-plan$/, '');

      // Initialize plan if not exists
      if (!plansByItem[planId]) {
        plansByItem[planId] = {
          id: planId,
          name: item.name,
          description: item.description || '',
          prices: [],
          features: {},
        };
      }

      // Add price to plan
      plansByItem[planId].prices.push({
        id: itemPrice.id,
        currency: itemPrice.currency_code,
        amount: itemPrice.price || 0, // Already in cents
        period: itemPrice.period_unit, // 'month' or 'year'
      });

      // Add features/entitlements if available
      if (entitlementsByItemPrice[itemPrice.id]) {
        const features = entitlementsByItemPrice[itemPrice.id];

        // Map Chargebee feature IDs to our format
        plansByItem[planId].features = {
          views: features['form_views'] === 'unlimited' ? null : parseInt(features['form_views']) || null,
          submissions: features['form_submissions'] === 'unlimited' ? null : parseInt(features['form_submissions']) || null,
        };
      }
    }

    // Convert to array and sort by a logical order (free, starter, advanced)
    const plans = Object.values(plansByItem);

    // Sort plans: free first, then by price
    plans.sort((a: any, b: any) => {
      // Free plan always first
      if (a.id === 'free') return -1;
      if (b.id === 'free') return 1;

      // Sort by lowest price
      const aPrice = Math.min(...a.prices.map((p: any) => p.amount));
      const bPrice = Math.min(...b.prices.map((p: any) => p.amount));
      return aPrice - bPrice;
    });

    console.log('[Chargebee Service] Fetched plans from Chargebee:', plans.length);

    // Update cache
    plansCache = plans;
    plansCacheTime = Date.now();

    return plans;
  } catch (error: any) {
    console.error('[Chargebee Service] Error fetching plans from Chargebee:', error);

    // Fallback to hardcoded plans if Chargebee API fails
    console.warn('[Chargebee Service] Falling back to hardcoded plans');
    return [
      {
        id: 'free',
        name: 'Free Plan',
        description: 'Perfect for getting started',
        prices: [
          { id: 'free-usd-monthly', currency: 'USD', amount: 0, period: 'month' },
          { id: 'free-inr-monthly', currency: 'INR', amount: 0, period: 'month' },
        ],
        features: { views: 10000, submissions: 1000 },
      },
      {
        id: 'starter',
        name: 'Starter Plan',
        description: 'For growing teams',
        prices: [
          { id: 'starter-usd-monthly', currency: 'USD', amount: 600, period: 'month' },
          { id: 'starter-usd-yearly', currency: 'USD', amount: 6600, period: 'year' },
          { id: 'starter-inr-monthly', currency: 'INR', amount: 48900, period: 'month' },
          { id: 'starter-inr-yearly', currency: 'INR', amount: 540000, period: 'year' },
        ],
        features: { views: null, submissions: 10000 },
      },
      {
        id: 'advanced',
        name: 'Advanced Plan',
        description: 'For enterprises',
        prices: [
          { id: 'advanced-usd-monthly', currency: 'USD', amount: 1500, period: 'month' },
          { id: 'advanced-usd-yearly', currency: 'USD', amount: 16800, period: 'year' },
          { id: 'advanced-inr-monthly', currency: 'INR', amount: 128900, period: 'month' },
          { id: 'advanced-inr-yearly', currency: 'INR', amount: 1426800, period: 'year' },
        ],
        features: { views: null, submissions: 100000 },
      },
    ];
  }
};
