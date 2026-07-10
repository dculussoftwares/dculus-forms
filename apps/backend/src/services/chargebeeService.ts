import Chargebee from 'chargebee';
import { resetUsageCounters } from '../subscriptions/usageService.js';
import { subscriptionRepository } from '../repositories/index.js';
import { logger } from '../lib/logger.js';
import { prisma } from '../lib/prisma.js';
import { sendEmail } from './emailService.js';
import * as Sentry from '@sentry/node';
import { AI_CREDIT_LIMITS_FALLBACK } from '../lib/ai.js';
import { PLAN_LIMITS_FALLBACK } from '../lib/planLimits.js';
import { invalidateAIBudgetCache } from './aiUsageService.js';

/**
 * Chargebee Service
 * Wrapper service for Chargebee API operations
 */

// Initialize Chargebee SDK
const chargebee = new Chargebee({
  site: process.env.CHARGEBEE_SITE!,
  apiKey: process.env.CHARGEBEE_API_KEY!,
});

// Chargebee returns unlimited entitlement values as the string "Unlimited"
// (capital U) in live responses; some fixtures/tests use lowercase. Compare
// case-insensitively so both are treated as "no limit".
const isUnlimited = (v: unknown): boolean => String(v).toLowerCase() === 'unlimited';

const entitlementToLimit = (v: unknown): number | null =>
  v == null || isUnlimited(v) ? null : parseInt(String(v), 10) || null;

/**
 * Returns plan limits sourced from Chargebee entitlements (via the plans cache).
 * Falls back to PLAN_LIMITS_FALLBACK / AI_CREDIT_LIMITS_FALLBACK when the cache
 * is cold or the API is down.
 */
const getPlanLimits = async (
  planId: string
): Promise<{ views: number | null; submissions: number | null; aiCredits: number | null }> => {
  try {
    const plans = await getAvailablePlans();
    const plan = plans.find((p: any) => p.id === planId);
    if (plan?.features) {
      return {
        views: plan.features.views ?? null,
        submissions: plan.features.submissions ?? null,
        aiCredits: plan.features.aiCredits ?? null,
      };
    }
    // Not on the public list — the plan may be hidden from the pricing page
    // (enabled_for_checkout: false) or archived but still assigned to orgs.
    // Look it up in the full admin catalog before giving up.
    const catalogEntry = (await getAdminPlanCatalog()).find((p) => p.id === planId);
    if (catalogEntry) return catalogEntry.limits;
  } catch {
    // fall through to fallback
  }
  return {
    views: PLAN_LIMITS_FALLBACK[planId]?.views ?? null,
    submissions: PLAN_LIMITS_FALLBACK[planId]?.submissions ?? null,
    aiCredits: AI_CREDIT_LIMITS_FALLBACK[planId] ?? null,
  };
};

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
    logger.error('[Chargebee Service] Error creating customer:', error);
    throw new Error(`Failed to create Chargebee customer: ${error.message}`);
  }
};

/**
 * Create a free subscription for an organization
 * Called when a new organization is created
 *
 * The free plan now HAS a real, $0 Chargebee subscription (created with
 * auto_collection: 'off' since there is no payment method on file) so that
 * monthly renewal webhooks fire and reset usage counters, the same as paid
 * plans. If Chargebee is unreachable, we still create the local subscription
 * record with chargebeeSubscriptionId: null — billing being down must never
 * block organization creation.
 */
export const createFreeSubscription = async (
  organizationId: string,
  chargebeeCustomerId: string
): Promise<void> => {
  try {
    const now = new Date();
    const periodEnd = new Date();
    periodEnd.setMonth(periodEnd.getMonth() + 1); // Free plan is monthly

    let chargebeeSubscriptionId: string | null = null;
    let currentPeriodStart = now;
    let currentPeriodEnd = periodEnd;

    try {
      const result: any = await chargebee.subscription.createWithItems(chargebeeCustomerId, {
        subscription_items: [{ item_price_id: 'free-usd-monthly', quantity: 1 }],
        auto_collection: 'off',
      } as any);

      chargebeeSubscriptionId = result.subscription.id;
      if (result.subscription.current_term_start && result.subscription.current_term_end) {
        currentPeriodStart = new Date(result.subscription.current_term_start * 1000);
        currentPeriodEnd = new Date(result.subscription.current_term_end * 1000);
      }
    } catch (chargebeeError: any) {
      // Fail open: do not let a Chargebee outage block organization creation.
      Sentry.captureException(chargebeeError);
      logger.error(
        '[Chargebee Service] Error creating $0 Chargebee subscription for free plan:',
        chargebeeError
      );
    }

    const freeLimits = await getPlanLimits('free');

    await subscriptionRepository.createSubscription({
      id: `sub_${organizationId}`,
      organizationId,
      chargebeeCustomerId,
      chargebeeSubscriptionId,
      planId: 'free',
      status: 'active',
      viewsUsed: 0,
      submissionsUsed: 0,
      viewsLimit: freeLimits.views,
      submissionsLimit: freeLimits.submissions,
      aiCreditsLimit: freeLimits.aiCredits,
      currentPeriodStart,
      currentPeriodEnd,
    });

    logger.info('[Chargebee Service] Created free subscription for organization:', organizationId);
  } catch (error: any) {
    logger.error('[Chargebee Service] Error creating free subscription:', error);
    throw new Error(`Failed to create free subscription: ${error.message}`);
  }
};

/**
 * Set a negotiated Enterprise deal for an organization — pay-to-activate.
 *
 * Paid deals (price > 0): a Chargebee hosted checkout page is generated for
 * the negotiated price (unit_price override on the shared enterprise item).
 * The local Subscription row is immediately switched to planId 'enterprise'
 * with the admin-set limits and status 'past_due' — the blocked state enforced
 * by usage checks — so the org is DISABLED until the customer completes
 * checkout. Completing checkout charges their card, saves it, and turns
 * auto_collection on; the resulting webhook flips the org to active, and every
 * renewal auto-charges (failures go back to past_due via handlePaymentFailed).
 * The checkout link is emailed to the org owner and returned for the admin to
 * share.
 *
 * $0 deals need no payment: the subscription is switched directly via
 * updateForItems (auto_collection off) and activated immediately.
 *
 * Unlike catalog plans, enterprise limits are never re-derived from Chargebee
 * entitlements (see syncSubscriptionFromWebhook) — they are authoritative in
 * Postgres from the moment an admin sets them. `null` for any limit means
 * unlimited; `0` is a valid explicit cap.
 *
 * If the Chargebee call fails, Postgres is left untouched — never leave an org
 * with a mismatched local/remote plan.
 */
export const setEnterpriseSubscription = async (
  organizationId: string,
  params: {
    currency: 'USD' | 'INR';
    period: 'monthly' | 'yearly';
    priceInSmallestUnit: number;
    viewsLimit: number | null;
    submissionsLimit: number | null;
    aiCreditsLimit: number | null;
  }
): Promise<{ checkoutUrl: string | null }> => {
  const { currency, period, priceInSmallestUnit, viewsLimit, submissionsLimit, aiCreditsLimit } = params;

  const subscription = await subscriptionRepository.findUnique({ where: { organizationId } });
  if (!subscription) {
    throw new Error(`No subscription found for organization ${organizationId}`);
  }
  if (!subscription.chargebeeSubscriptionId) {
    throw new Error('Organization has no Chargebee subscription to convert to enterprise');
  }

  const itemPriceId = `enterprise-${currency.toLowerCase()}-${period}`;

  // $0 deals: nothing to collect — switch the subscription directly and activate.
  if (priceInSmallestUnit === 0) {
    let currentPeriodStart = subscription.currentPeriodStart;
    let currentPeriodEnd = subscription.currentPeriodEnd;

    try {
      const result: any = await chargebee.subscription.updateForItems(
        subscription.chargebeeSubscriptionId,
        {
          subscription_items: [{ item_price_id: itemPriceId, unit_price: 0, quantity: 1 }],
          replace_items_list: true,
          auto_collection: 'off',
        } as any
      );

      if (result.subscription?.current_term_start && result.subscription?.current_term_end) {
        currentPeriodStart = new Date(result.subscription.current_term_start * 1000);
        currentPeriodEnd = new Date(result.subscription.current_term_end * 1000);
      }
    } catch (error: any) {
      logger.error('[Chargebee Service] Error updating subscription to enterprise plan:', error);
      throw new Error(`Failed to update Chargebee subscription: ${error.message}`);
    }

    await subscriptionRepository.update({
      where: { organizationId },
      data: {
        planId: 'enterprise',
        status: 'active',
        viewsLimit,
        submissionsLimit,
        aiCreditsLimit,
        currentPeriodStart,
        currentPeriodEnd,
      },
    });

    logger.info('[Chargebee Service] Set $0 enterprise subscription for organization:', organizationId);
    return { checkoutUrl: null };
  }

  // Paid deals: generate a hosted checkout for the negotiated price. The
  // Chargebee subscription is only switched when the customer pays.
  let checkoutUrl: string;
  try {
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const result: any = await chargebee.hostedPage.checkoutExistingForItems({
      subscription: { id: subscription.chargebeeSubscriptionId, auto_collection: 'on' },
      subscription_items: [{ item_price_id: itemPriceId, unit_price: priceInSmallestUnit, quantity: 1 }],
      replace_items_list: true,
      redirect_url: `${baseUrl}/subscription/success`,
      cancel_url: `${baseUrl}/subscription/cancel`,
    } as any);
    checkoutUrl = result.hosted_page.url;
  } catch (error: any) {
    logger.error('[Chargebee Service] Error creating enterprise checkout page:', error);
    throw new Error(`Failed to create enterprise checkout page: ${error.message}`);
  }

  // Block the org until payment: past_due is the status usage checks enforce
  // (views, submissions, and AI credits are all rejected). The webhook fired
  // by a completed checkout flips this to active while preserving these limits.
  await subscriptionRepository.update({
    where: { organizationId },
    data: {
      planId: 'enterprise',
      status: 'past_due',
      viewsLimit,
      submissionsLimit,
      aiCreditsLimit,
    },
  });

  // Best-effort: email the payment link to the org owner. A failure here must
  // not fail the assignment — the admin still gets the URL to share manually.
  try {
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      include: {
        members: {
          where: { role: 'owner' },
          include: { user: { select: { email: true, name: true } } },
          take: 1,
        },
      },
    });
    const owner = org?.members[0]?.user;
    if (owner?.email) {
      const amount = (priceInSmallestUnit / 100).toFixed(2);
      await sendEmail({
        to: owner.email,
        subject: 'Action required: complete payment for your Dculus Forms Enterprise plan',
        html: `<p>Hi ${owner.name || 'there'},</p>
<p>Your <strong>${org?.name}</strong> organization has been set up on a Dculus Forms Enterprise plan at <strong>${currency} ${amount}</strong> per ${period === 'yearly' ? 'year' : 'month'}.</p>
<p>Your account will be activated as soon as payment is completed. Future renewals will be charged automatically to the card you provide.</p>
<p><a href="${checkoutUrl}">Complete payment →</a></p>
<p>If you have any questions, please contact support.</p>`,
        text: `Hi ${owner.name || 'there'},\n\nYour ${org?.name} organization has been set up on a Dculus Forms Enterprise plan at ${currency} ${amount} per ${period === 'yearly' ? 'year' : 'month'}.\n\nYour account will be activated as soon as payment is completed: ${checkoutUrl}\n\nIf you have any questions, please contact support.`,
      });
    }
  } catch (emailError: any) {
    logger.warn('[Chargebee Service] Could not email enterprise checkout link:', emailError);
  }

  logger.info(
    '[Chargebee Service] Enterprise checkout created for organization (disabled until paid):',
    organizationId
  );
  return { checkoutUrl };
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
    logger.error('[Chargebee Service] Error creating checkout hosted page:', error);
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
    logger.error('[Chargebee Service] Error creating portal session:', error);
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
    logger.error('[Chargebee Service] Error retrieving subscription:', error);
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

    logger.info('[Chargebee Service] Cancelled subscription:', subscriptionId);
  } catch (error: any) {
    logger.error('[Chargebee Service] Error cancelling subscription:', error);
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
    logger.info('[Chargebee Service] Reactivated subscription:', subscriptionId);
  } catch (error: any) {
    logger.error('[Chargebee Service] Error reactivating subscription:', error);
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

    // Determine plan ID from item_id (stable plan identifier, no currency/period
    // suffix). Plans are created dynamically from the admin app, so any item_id is
    // a valid planId — no hardcoded whitelist. Falls back to item_price_id with the
    // trailing -{currency}-{period} stripped (handles multi-word ids like "pro-plus")
    // only when item_id is absent.
    let planId = 'free';
    const firstItem = subscriptionData.subscription_items?.[0];
    if (firstItem) {
      const itemId = String(firstItem.item_id ?? '').toLowerCase();
      if (itemId) {
        planId = itemId;
      } else {
        const itemPriceId = String(firstItem.item_price_id ?? '').toLowerCase();
        const stripped = itemPriceId.replace(/-(usd|inr)-(monthly|yearly)$/, '');
        if (stripped) planId = stripped;
      }
    }

    // A pending enterprise deal (planId 'enterprise' + status 'past_due', set by
    // setEnterpriseSubscription while awaiting checkout payment) must not be
    // clobbered by webhooks still referencing the org's PREVIOUS plan — e.g. a
    // renewal of the old free subscription would otherwise flip the org back to
    // active with catalog limits, un-blocking it before payment. The pending
    // state only resolves via an enterprise webhook (checkout completed) or an
    // admin re-assigning a plan.
    if (planId !== 'enterprise') {
      const existing = await subscriptionRepository.findUnique({ where: { organizationId } });
      if (existing?.planId === 'enterprise' && existing.status === 'past_due') {
        logger.info(
          '[Chargebee Service] Skipping webhook sync — enterprise checkout pending for organization:',
          organizationId
        );
        return;
      }
    }

    // Enterprise limits are negotiated per-org and set directly on the Subscription
    // row by an admin (see setEnterpriseSubscription) — they are never derived from
    // the shared Chargebee catalog, so skip the catalog-driven overwrite here and
    // leave viewsLimit/submissionsLimit/aiCreditsLimit untouched on every webhook event.
    const isEnterprise = planId === 'enterprise';
    const limits = isEnterprise
      ? null
      : await getPlanLimits(planId); // falls back to hardcoded values if Chargebee API fails

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
        ...(limits
          ? {
              viewsLimit: limits.views,
              submissionsLimit: limits.submissions,
              aiCreditsLimit: limits.aiCredits,
            }
          : {}),
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
        // No existing row to preserve limits from (shouldn't normally happen for an
        // enterprise org, since every org already has a subscription from signup) —
        // default to unlimited rather than guessing at a catalog value.
        viewsLimit: limits ? limits.views : null,
        submissionsLimit: limits ? limits.submissions : null,
        aiCreditsLimit: limits ? limits.aiCredits : null,
        currentPeriodStart: new Date(
          subscriptionData.current_term_start * 1000
        ),
        currentPeriodEnd: new Date(subscriptionData.current_term_end * 1000),
      }
    );

    logger.info('[Chargebee Service] Synced subscription for organization:', organizationId);
  } catch (error: any) {
    logger.error('[Chargebee Service] Error syncing subscription:', error);
    throw error;
  }
};

/**
 * Handle subscription renewal from webhook
 * Resets views/submissions usage counters for the new billing period.
 *
 * AI credit usage does NOT need an explicit reset here: `aiUsageService`'s
 * `currentPeriod()` reads `Subscription.currentPeriodStart`/`currentPeriodEnd`
 * directly, and `resetUsageCounters` below just updated those to the new
 * period, so the next `recordAITokenUsage` call upserts an `AIUsage` row
 * keyed to the new `periodStart` — starting that period's usage at zero.
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
    invalidateAIBudgetCache(organizationId);

    logger.info('[Chargebee Service] Reset usage counters for organization:', organizationId);
  } catch (error: any) {
    logger.error('[Chargebee Service] Error handling subscription renewal:', error);
    throw error;
  }
};

/**
 * Handle a payment_failed Chargebee webhook event.
 * Marks the subscription as past_due and emails the org owner.
 */
export const handlePaymentFailed = async (event: any): Promise<void> => {
  const subscription = event.content?.subscription;
  if (!subscription) return;

  const customerId = String(subscription.customer_id ?? '');
  const organizationId = customerId.replace('org_', '');
  if (!organizationId) return;

  try {
    await prisma.subscription.update({
      where: { organizationId },
      data: { status: 'past_due' },
    });

    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      include: {
        members: {
          where: { role: 'owner' },
          include: { user: { select: { email: true, name: true } } },
          take: 1,
        },
      },
    });

    const owner = org?.members[0]?.user;
    if (owner?.email) {
      const portalUrl = process.env.BETTER_AUTH_URL?.replace(':4000', ':3000') || 'https://app.dculus.com';
      await sendEmail({
        to: owner.email,
        subject: 'Action required: payment failed for your Dculus Forms subscription',
        html: `<p>Hi ${owner.name || 'there'},</p>
<p>We were unable to process the latest payment for your <strong>${org?.name}</strong> subscription on Dculus Forms.</p>
<p>Please update your payment details as soon as possible to avoid service interruption. Your subscription will be cancelled after the dunning period if payment is not recovered.</p>
<p><a href="${portalUrl}/pricing">Update payment details →</a></p>
<p>If you believe this is an error, please contact support.</p>`,
        text: `Hi ${owner.name || 'there'},\n\nWe were unable to process payment for your ${org?.name} subscription on Dculus Forms. Please update your payment details at ${portalUrl}/pricing to avoid service interruption.\n\nIf you believe this is an error, please contact support.`,
      });
    }

    logger.warn('[Chargebee Service] Payment failed — subscription marked past_due for org:', organizationId);
  } catch (error: any) {
    Sentry.captureException(error);
    logger.error('[Chargebee Service] Error handling payment failure:', error);
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
 * Drop the cached public plan list. Must be called after any catalog mutation
 * (create/update/archive plan) so the pricing page reflects changes immediately
 * instead of after the 5-minute TTL.
 */
export const invalidatePlansCache = (): void => {
  plansCache = null;
  plansCacheTime = 0;
};

/**
 * Get available plans with pricing from Chargebee
 * Fetches all item prices with their associated items and entitlements
 * Results are cached for 5 minutes to improve performance
 */
export const getAvailablePlans = async () => {
  // Check cache first
  const now = Date.now();
  if (plansCache && (now - plansCacheTime) < CACHE_DURATION) {
    logger.info('[Chargebee Service] Returning cached plans');
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

      // Enterprise is admin-assisted only (negotiated per-org, no self-serve checkout) —
      // never surface it on the public availablePlans list / Pricing page.
      if ((itemPrice.item_id ?? '').toLowerCase() === 'enterprise') continue;

      // Archived prices keep renewing existing subscriptions but can't be purchased.
      if (itemPrice.status === 'archived') continue;

      // Fetch item details if not cached
      if (!itemDetailsCache[itemPrice.item_id]) {
        const itemResult: any = await chargebee.item.retrieve(itemPrice.item_id);
        itemDetailsCache[itemPrice.item_id] = itemResult.item;
      }

      const item = itemDetailsCache[itemPrice.item_id];

      // Plans hidden from the pricing page (admin "Visible on pricing page" toggle
      // → enabled_for_checkout) and retired plans never appear on the public list.
      if (item.enabled_for_checkout === false || item.status === 'archived') continue;
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
      // Convert from smallest unit (cents/paise) to actual currency (dollars/rupees)
      const amountInCurrency = (itemPrice.price || 0) / 100;

      plansByItem[planId].prices.push({
        id: itemPrice.id,
        currency: itemPrice.currency_code,
        amount: amountInCurrency, // Converted to dollars/rupees
        period: itemPrice.period_unit, // 'month' or 'year'
      });

      // Add features/entitlements if available
      if (entitlementsByItemPrice[itemPrice.id]) {
        const features = entitlementsByItemPrice[itemPrice.id];

        // Map Chargebee feature IDs to our format
        plansByItem[planId].features = {
          views: entitlementToLimit(features['form_views']),
          submissions: entitlementToLimit(features['form_submissions']),
          aiCredits: entitlementToLimit(features['ai_credits']),
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

    logger.info('[Chargebee Service] Fetched plans from Chargebee:', plans.length);

    // Update cache
    plansCache = plans;
    plansCacheTime = Date.now();

    return plans;
  } catch (error: any) {
    logger.error('[Chargebee Service] Error fetching plans from Chargebee:', error);

    // Fallback to hardcoded plans if Chargebee API fails
    logger.warn('[Chargebee Service] Falling back to hardcoded plans');
    return [
      {
        id: 'free',
        name: 'Free Plan',
        description: 'Perfect for getting started',
        prices: [
          { id: 'free-usd-monthly', currency: 'USD', amount: 0, period: 'month' },
          { id: 'free-inr-monthly', currency: 'INR', amount: 0, period: 'month' },
        ],
        features: { views: 10000, submissions: 1000, aiCredits: AI_CREDIT_LIMITS_FALLBACK.free ?? null },
      },
      {
        id: 'starter',
        name: 'Starter Plan',
        description: 'For growing teams',
        prices: [
          { id: 'starter-usd-monthly', currency: 'USD', amount: 6, period: 'month' },
          { id: 'starter-usd-yearly', currency: 'USD', amount: 66, period: 'year' },
          { id: 'starter-inr-monthly', currency: 'INR', amount: 489, period: 'month' },
          { id: 'starter-inr-yearly', currency: 'INR', amount: 5400, period: 'year' },
        ],
        features: { views: null, submissions: 10000, aiCredits: AI_CREDIT_LIMITS_FALLBACK.starter ?? null },
      },
      {
        id: 'advanced',
        name: 'Advanced Plan',
        description: 'For enterprises',
        prices: [
          { id: 'advanced-usd-monthly', currency: 'USD', amount: 15, period: 'month' },
          { id: 'advanced-usd-yearly', currency: 'USD', amount: 168, period: 'year' },
          { id: 'advanced-inr-monthly', currency: 'INR', amount: 1289, period: 'month' },
          { id: 'advanced-inr-yearly', currency: 'INR', amount: 14268, period: 'year' },
        ],
        features: { views: null, submissions: 100000, aiCredits: AI_CREDIT_LIMITS_FALLBACK.advanced ?? null },
      },
    ];
  }
};

// ---------------------------------------------------------------------------
// Plan catalog management — admin-app driven CRUD over Chargebee items/prices.
//
// A "plan" is a Chargebee item (type: plan) plus one item price per
// currency×period combination (id convention: {planId}-{currency}-{period})
// plus feature entitlements attached at item-price level (entity_type:
// plan_price). Limits use null = unlimited (entitlement value "Unlimited").
// ---------------------------------------------------------------------------

export interface PlanLimitsInput {
  views: number | null;
  submissions: number | null;
  aiCredits: number | null;
}

export interface PlanPriceInput {
  currency: 'USD' | 'INR';
  period: 'monthly' | 'yearly';
  priceInSmallestUnit: number;
}

export interface AdminPlanCatalogEntry {
  id: string;
  name: string;
  description: string;
  status: 'active' | 'archived';
  visibleOnPricingPage: boolean;
  prices: {
    id: string;
    currency: string;
    period: 'monthly' | 'yearly';
    priceInSmallestUnit: number;
    status: 'active' | 'archived';
  }[];
  limits: PlanLimitsInput;
}

const PLAN_FEATURE_IDS = {
  views: 'form_views',
  submissions: 'form_submissions',
  aiCredits: 'ai_credits',
} as const;

// Plan ids become Chargebee item ids and item-price id prefixes; keep them
// URL/id-safe and unambiguous when parsing {planId}-{currency}-{period}.
const PLAN_ID_REGEX = /^[a-z0-9][a-z0-9-]{1,48}$/;

const planItemPriceId = (planId: string, currency: string, period: string): string =>
  `${planId}-${currency.toLowerCase()}-${period}`;

const limitToEntitlementValue = (v: number | null): string =>
  v == null ? 'Unlimited' : String(v);

let cachedItemFamilyId: string | null = null;

const resolveItemFamilyId = async (): Promise<string> => {
  if (process.env.CHARGEBEE_ITEM_FAMILY_ID) return process.env.CHARGEBEE_ITEM_FAMILY_ID;
  if (cachedItemFamilyId) return cachedItemFamilyId;
  const result: any = await chargebee.item.retrieve('free');
  if (!result.item?.item_family_id) {
    throw new Error('Could not resolve Chargebee item family id from the free plan');
  }
  cachedItemFamilyId = result.item.item_family_id;
  return cachedItemFamilyId!;
};

const upsertPlanEntitlements = async (
  itemPriceIds: string[],
  limits: PlanLimitsInput
): Promise<void> => {
  if (itemPriceIds.length === 0) return;
  const entitlements = itemPriceIds.flatMap((priceId) => [
    {
      entity_id: priceId,
      entity_type: 'plan_price',
      feature_id: PLAN_FEATURE_IDS.views,
      value: limitToEntitlementValue(limits.views),
    },
    {
      entity_id: priceId,
      entity_type: 'plan_price',
      feature_id: PLAN_FEATURE_IDS.submissions,
      value: limitToEntitlementValue(limits.submissions),
    },
    {
      entity_id: priceId,
      entity_type: 'plan_price',
      feature_id: PLAN_FEATURE_IDS.aiCredits,
      value: limitToEntitlementValue(limits.aiCredits),
    },
  ]);
  await chargebee.entitlement.create({ action: 'upsert', entitlements } as any);
};

/**
 * Full plan catalog for the admin app — unlike getAvailablePlans this includes
 * hidden, archived, and enterprise plans, is never cached (mutation → refetch
 * flows must be consistent), and reports prices in the smallest currency unit.
 */
export const getAdminPlanCatalog = async (): Promise<AdminPlanCatalogEntry[]> => {
  let offset: string | undefined = undefined;
  const items: any[] = [];
  do {
    const params: any = { limit: 100, type: { is: 'plan' }, status: { in: ['active', 'archived'] } };
    if (offset) params.offset = offset;
    const result: any = await chargebee.item.list(params);
    items.push(...result.list.map((entry: any) => entry.item));
    offset = result.next_offset;
  } while (offset);

  offset = undefined;
  const itemPrices: any[] = [];
  do {
    const params: any = { limit: 100 };
    if (offset) params.offset = offset;
    const result: any = await chargebee.itemPrice.list(params);
    itemPrices.push(...result.list.map((entry: any) => entry.item_price));
    offset = result.next_offset;
  } while (offset);

  offset = undefined;
  const entitlements: any[] = [];
  do {
    const params: any = { limit: 100 };
    if (offset) params.offset = offset;
    const result: any = await chargebee.entitlement.list(params);
    entitlements.push(...result.list.map((entry: any) => entry.entitlement));
    offset = result.next_offset;
  } while (offset);

  const entitlementsByPriceId: Record<string, Record<string, any>> = {};
  for (const ent of entitlements) {
    (entitlementsByPriceId[ent.entity_id] ??= {})[ent.feature_id] = ent.value;
  }

  return items.map((item) => {
    const prices = itemPrices
      .filter((p) => p.item_id === item.id && p.status !== 'deleted')
      .map((p) => ({
        id: p.id,
        currency: String(p.currency_code ?? '').toUpperCase(),
        period: (p.period_unit === 'year' ? 'yearly' : 'monthly') as 'monthly' | 'yearly',
        priceInSmallestUnit: p.price ?? 0,
        status: (p.status === 'archived' ? 'archived' : 'active') as 'active' | 'archived',
      }));
    const features = prices.map((p) => entitlementsByPriceId[p.id]).find((f) => f) ?? {};
    return {
      id: item.id,
      name: item.name,
      description: item.description || '',
      status: (item.status === 'archived' ? 'archived' : 'active') as 'active' | 'archived',
      // Enterprise is admin-assisted only and never listed publicly, whatever
      // its Chargebee checkout flag says.
      visibleOnPricingPage: item.enabled_for_checkout !== false && item.id !== 'enterprise',
      prices,
      limits: {
        views: entitlementToLimit(features[PLAN_FEATURE_IDS.views]),
        submissions: entitlementToLimit(features[PLAN_FEATURE_IDS.submissions]),
        aiCredits: entitlementToLimit(features[PLAN_FEATURE_IDS.aiCredits]),
      },
    };
  });
};

// Creates the item price, or updates its price when it already exists — this
// makes plan creation idempotent, so re-saving repairs a partially created plan.
const createOrUpdatePlanPrice = async (
  planId: string,
  planName: string,
  price: PlanPriceInput
): Promise<void> => {
  const priceId = planItemPriceId(planId, price.currency, price.period);
  try {
    await chargebee.itemPrice.create({
      id: priceId,
      item_id: planId,
      name: `${planName} ${price.currency} ${price.period}`,
      external_name: planName,
      currency_code: price.currency,
      price: price.priceInSmallestUnit,
      pricing_model: 'per_unit',
      period: 1,
      period_unit: price.period === 'yearly' ? 'year' : 'month',
    } as any);
  } catch (error: any) {
    const isDuplicate =
      error?.api_error_code === 'duplicate_entry' ||
      /already exists|duplicate/i.test(String(error?.message ?? ''));
    if (!isDuplicate) throw error;
    await chargebee.itemPrice.update(priceId, { price: price.priceInSmallestUnit } as any);
  }
};

export const createPlan = async (params: {
  id: string;
  name: string;
  description?: string;
  prices: PlanPriceInput[];
  limits: PlanLimitsInput;
  visibleOnPricingPage?: boolean;
}): Promise<void> => {
  const { id, name, description, prices, limits, visibleOnPricingPage = false } = params;

  if (!PLAN_ID_REGEX.test(id)) {
    throw new Error(
      'Plan id must be 2-49 characters of lowercase letters, numbers, and hyphens'
    );
  }
  if (id === 'enterprise') {
    throw new Error('The enterprise plan id is reserved for per-organization deals');
  }
  if (prices.length === 0) {
    throw new Error('A plan needs at least one price');
  }

  const itemFamilyId = await resolveItemFamilyId();

  try {
    await chargebee.item.create({
      id,
      name,
      external_name: name,
      description,
      type: 'plan',
      item_family_id: itemFamilyId,
      enabled_for_checkout: visibleOnPricingPage,
    } as any);
  } catch (error: any) {
    logger.error('[Chargebee Service] Error creating plan item:', error);
    throw new Error(`Failed to create Chargebee plan: ${error.message}`);
  }

  try {
    for (const price of prices) {
      await createOrUpdatePlanPrice(id, name, price);
    }
    await upsertPlanEntitlements(
      prices.map((p) => planItemPriceId(id, p.currency, p.period)),
      limits
    );
  } catch (error: any) {
    logger.error('[Chargebee Service] Error creating plan prices/entitlements:', error);
    invalidatePlansCache();
    throw new Error(
      `Plan "${id}" was only partially created (${error.message}). Edit and save it again to finish setting it up.`
    );
  }

  invalidatePlansCache();
  logger.info('[Chargebee Service] Created plan:', id);
};

export const updatePlan = async (params: {
  id: string;
  name?: string;
  description?: string;
  prices?: PlanPriceInput[];
  limits?: PlanLimitsInput;
  visibleOnPricingPage?: boolean;
}): Promise<{ backfilledOrganizations: number }> => {
  const { id, name, description, prices, limits, visibleOnPricingPage } = params;

  if (id === 'enterprise' && visibleOnPricingPage === true) {
    throw new Error('The enterprise plan can never be visible on the pricing page');
  }

  const entry = (await getAdminPlanCatalog()).find((p) => p.id === id);
  if (!entry) {
    throw new Error(`Plan "${id}" does not exist in the Chargebee catalog`);
  }

  try {
    const itemUpdate: any = {};
    if (name !== undefined) {
      itemUpdate.name = name;
      itemUpdate.external_name = name;
    }
    if (description !== undefined) itemUpdate.description = description;
    if (visibleOnPricingPage !== undefined) itemUpdate.enabled_for_checkout = visibleOnPricingPage;
    if (Object.keys(itemUpdate).length > 0) {
      await chargebee.item.update(id, itemUpdate);
    }

    const newPriceIds: string[] = [];
    if (prices?.length) {
      const existingIds = new Set(entry.prices.map((p) => p.id));
      const planName = name ?? entry.name;
      for (const price of prices) {
        const priceId = planItemPriceId(id, price.currency, price.period);
        if (existingIds.has(priceId)) {
          // Only the amount is mutable — Chargebee locks currency/period/pricing
          // model once subscriptions or invoices exist on an item price.
          await chargebee.itemPrice.update(priceId, { price: price.priceInSmallestUnit } as any);
        } else {
          await createOrUpdatePlanPrice(id, planName, price);
          newPriceIds.push(priceId);
        }
      }
    }

    if (limits) {
      const activePriceIds = entry.prices.filter((p) => p.status === 'active').map((p) => p.id);
      await upsertPlanEntitlements([...new Set([...activePriceIds, ...newPriceIds])], limits);
    } else if (newPriceIds.length > 0) {
      // New prices still need the plan's current limits attached.
      await upsertPlanEntitlements(newPriceIds, entry.limits);
    }
  } catch (error: any) {
    logger.error('[Chargebee Service] Error updating plan:', error);
    invalidatePlansCache();
    throw new Error(`Failed to update Chargebee plan: ${error.message}`);
  }

  invalidatePlansCache();

  let backfilledOrganizations = 0;
  if (limits && id !== 'enterprise') {
    backfilledOrganizations = await applyPlanLimitsToOrganizations(id, limits);
  }

  logger.info('[Chargebee Service] Updated plan:', id);
  return { backfilledOrganizations };
};

export const archivePlan = async (planId: string): Promise<void> => {
  if (planId === 'free' || planId === 'enterprise') {
    throw new Error(`The ${planId} plan cannot be archived`);
  }

  try {
    await chargebee.item.update(planId, { status: 'archived', enabled_for_checkout: false } as any);
    const result: any = await chargebee.itemPrice.list({ item_id: { is: planId }, limit: 100 } as any);
    for (const entry of result.list) {
      if (entry.item_price.status === 'active') {
        await chargebee.itemPrice.update(entry.item_price.id, { status: 'archived' } as any);
      }
    }
  } catch (error: any) {
    logger.error('[Chargebee Service] Error archiving plan:', error);
    invalidatePlansCache();
    throw new Error(`Failed to archive plan: ${error.message}`);
  }

  invalidatePlansCache();
  logger.info('[Chargebee Service] Archived plan:', planId);
};

export const unarchivePlan = async (planId: string): Promise<void> => {
  try {
    await chargebee.item.update(planId, { status: 'active' } as any);
    const result: any = await chargebee.itemPrice.list({ item_id: { is: planId }, limit: 100 } as any);
    for (const entry of result.list) {
      if (entry.item_price.status === 'archived') {
        await chargebee.itemPrice.update(entry.item_price.id, { status: 'active' } as any);
      }
    }
  } catch (error: any) {
    logger.error('[Chargebee Service] Error unarchiving plan:', error);
    invalidatePlansCache();
    throw new Error(`Failed to restore plan: ${error.message}`);
  }

  invalidatePlansCache();
  logger.info('[Chargebee Service] Restored plan:', planId);
};

/**
 * Push edited catalog limits to every organization currently on the plan.
 * Enterprise rows are excluded by definition (their planId is 'enterprise'
 * and their limits are admin-set per org, never catalog-derived).
 */
export const applyPlanLimitsToOrganizations = async (
  planId: string,
  limits: PlanLimitsInput
): Promise<number> => {
  if (planId === 'enterprise') {
    throw new Error('Enterprise limits are managed per organization, not via the catalog');
  }
  const result = await subscriptionRepository.updateManyByPlan(planId, {
    viewsLimit: limits.views,
    submissionsLimit: limits.submissions,
    aiCreditsLimit: limits.aiCredits,
  });
  return result.count;
};

/**
 * Assign a catalog plan to an organization with real billing effect: the org's
 * Chargebee subscription is switched to the target plan's item price, so
 * invoicing and renewal webhooks behave like any self-serve plan change.
 *
 * Payment handling: $0 target → auto_collection off (no invoices of
 * consequence). Paid target → auto-charge only when the customer has a payment
 * source on file; otherwise auto_collection is turned off so the change never
 * fails and invoices are generated for offline collection.
 *
 * If the Chargebee call fails, Postgres is left untouched.
 */
export const changeOrganizationPlan = async (
  organizationId: string,
  planId: string
): Promise<void> => {
  if (planId === 'enterprise') {
    throw new Error('Use the enterprise flow to assign the enterprise plan');
  }

  const subscription = await subscriptionRepository.findUnique({ where: { organizationId } });
  if (!subscription) {
    throw new Error(`No subscription found for organization ${organizationId}`);
  }

  const targetPlan = (await getAdminPlanCatalog()).find((p) => p.id === planId);
  if (!targetPlan) {
    throw new Error(`Plan "${planId}" does not exist in the Chargebee catalog`);
  }
  if (targetPlan.status !== 'active') {
    throw new Error(`Plan "${planId}" is archived and cannot be assigned`);
  }
  const activePrices = targetPlan.prices.filter((p) => p.status === 'active');
  if (activePrices.length === 0) {
    throw new Error(`Plan "${planId}" has no active prices`);
  }

  // Carry over the org's current currency/period when the target plan offers it.
  let currency = 'usd';
  let period: 'monthly' | 'yearly' = 'monthly';
  if (subscription.chargebeeSubscriptionId) {
    try {
      const current: any = await chargebee.subscription.retrieve(subscription.chargebeeSubscriptionId);
      const currentPriceId = String(
        current.subscription?.subscription_items?.[0]?.item_price_id ?? ''
      ).toLowerCase();
      const match = currentPriceId.match(/-(usd|inr)-(monthly|yearly)$/);
      if (match) {
        currency = match[1];
        period = match[2] as 'monthly' | 'yearly';
      }
    } catch {
      // fall back to usd/monthly
    }
  }

  const targetPrice =
    activePrices.find((p) => p.currency.toLowerCase() === currency && p.period === period) ??
    activePrices.find((p) => p.currency.toLowerCase() === currency && p.period === 'monthly') ??
    activePrices.find((p) => p.currency.toLowerCase() === 'usd' && p.period === 'monthly') ??
    activePrices[0];

  let autoCollection: 'on' | 'off' = 'off';
  if (targetPrice.priceInSmallestUnit > 0) {
    try {
      const result: any = await chargebee.customer.retrieve(subscription.chargebeeCustomerId);
      if (result.customer?.primary_payment_source_id || result.customer?.payment_method) {
        autoCollection = 'on';
      }
    } catch {
      // Safer to under-collect (offline invoice) than to fail the assignment.
      autoCollection = 'off';
    }
  }

  let chargebeeSubscriptionId = subscription.chargebeeSubscriptionId;
  let currentPeriodStart = subscription.currentPeriodStart;
  let currentPeriodEnd = subscription.currentPeriodEnd;

  try {
    let result: any;
    if (chargebeeSubscriptionId) {
      result = await chargebee.subscription.updateForItems(chargebeeSubscriptionId, {
        // No unit_price override — the catalog price applies, which also clears
        // any previous enterprise price override on this subscription.
        subscription_items: [{ item_price_id: targetPrice.id, quantity: 1 }],
        replace_items_list: true,
        auto_collection: autoCollection,
      } as any);
    } else {
      // Subscription row was created during a Chargebee outage — repair by
      // creating the real subscription now (mirrors createFreeSubscription).
      result = await chargebee.subscription.createWithItems(subscription.chargebeeCustomerId, {
        subscription_items: [{ item_price_id: targetPrice.id, quantity: 1 }],
        auto_collection: autoCollection,
      } as any);
      chargebeeSubscriptionId = result.subscription.id;
    }

    if (result.subscription?.current_term_start && result.subscription?.current_term_end) {
      currentPeriodStart = new Date(result.subscription.current_term_start * 1000);
      currentPeriodEnd = new Date(result.subscription.current_term_end * 1000);
    }
  } catch (error: any) {
    logger.error('[Chargebee Service] Error assigning plan to organization:', error);
    throw new Error(`Failed to update Chargebee subscription: ${error.message}`);
  }

  await subscriptionRepository.update({
    where: { organizationId },
    data: {
      chargebeeSubscriptionId,
      planId,
      status: 'active',
      viewsLimit: targetPlan.limits.views,
      submissionsLimit: targetPlan.limits.submissions,
      aiCreditsLimit: targetPlan.limits.aiCredits,
      currentPeriodStart,
      currentPeriodEnd,
    },
  });
  invalidateAIBudgetCache(organizationId);

  logger.info('[Chargebee Service] Assigned plan to organization:', organizationId, planId);
};
