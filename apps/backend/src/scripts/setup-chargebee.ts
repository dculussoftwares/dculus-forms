#!/usr/bin/env tsx
/**
 * Chargebee Setup Script
 *
 * This script configures Chargebee with all required plans, features, and pricing
 * for the Dculus Forms subscription system.
 *
 * Run with: npx tsx src/scripts/setup-chargebee.ts
 */

import Chargebee from 'chargebee';
import * as dotenv from 'dotenv';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { logger } from '../lib/logger.js';

// ES module __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: resolve(__dirname, '../../.env') });

// Configure Chargebee
const CHARGEBEE_SITE = process.env.CHARGEBEE_SITE;
const CHARGEBEE_API_KEY = process.env.CHARGEBEE_API_KEY;

if (!CHARGEBEE_SITE || !CHARGEBEE_API_KEY) {
  logger.error('❌ Missing Chargebee credentials!');
  logger.error('Please set CHARGEBEE_SITE and CHARGEBEE_API_KEY in apps/backend/.env');
  process.exit(1);
}

// Initialize Chargebee SDK
const chargebee = new Chargebee({
  site: CHARGEBEE_SITE,
  apiKey: CHARGEBEE_API_KEY
});

logger.info('🚀 Chargebee Setup Script Starting...\n');
logger.info(`📍 Site: ${CHARGEBEE_SITE}\n`);

/**
 * Helper function to handle Chargebee API errors
 */
function handleError(error: any, context: string) {
  // Check for "already exists" errors (multiple error codes)
  const alreadyExistsErrors = [
    'resource_already_exists',
    'operation_not_supported' // When resource already exists
  ];

  if (error.type === 'invalid_request' &&
      (alreadyExistsErrors.includes(error.api_error_code) ||
       error.message?.includes('already exists'))) {
    logger.info(`  ⚠️  ${context} already exists (skipping)\n`);
    return { alreadyExists: true };
  }
  logger.error(`  ❌ Error in ${context}:`, error.message || error);
  throw error;
}

/**
 * Step 0: Create Item Family
 */
async function createItemFamily() {
  logger.info('🏢 Step 0: Creating Item Family...\n');

  try {
    await chargebee.itemFamily.create({
      id: 'dculus-forms',
      name: 'Dculus Forms Plans',
      description: 'All subscription plans for Dculus Forms'
    });
    logger.info('  ✅ Created item family: dculus-forms\n');
  } catch (error: any) {
    const result = handleError(error, 'dculus-forms item family');
    if (!result?.alreadyExists) throw error;
  }
}

/**
 * Step 1: Create Features
 */
async function createFeatures() {
  logger.info('📦 Step 1: Creating Features...\n');

  // Feature 1: Form Views
  try {
    await chargebee.feature.create({
      id: 'form_views',
      name: 'Form Views',
      type: 'quantity',
      unit: 'view',
      levels: [
        {
          value: '10000',
          name: '10,000 views',
          level: 0
        },
        {
          is_unlimited: true,
          name: 'Unlimited',
          level: 1
        }
      ]
    });
    logger.info('  ✅ Created feature: form_views');
  } catch (error: any) {
    const result = handleError(error, 'form_views feature');
    if (!result?.alreadyExists) throw error;
  }

  // Feature 2: Form Submissions
  try {
    await chargebee.feature.create({
      id: 'form_submissions',
      name: 'Form Submissions',
      type: 'quantity',
      unit: 'submission',
      levels: [
        {
          value: '1000',
          name: '1,000 submissions',
          level: 0
        },
        {
          value: '10000',
          name: '10,000 submissions',
          level: 1
        },
        {
          value: '100000',
          name: '100,000 submissions',
          level: 2
        },
        {
          is_unlimited: true,
          name: 'Unlimited',
          level: 3
        }
      ]
    });
    logger.info('  ✅ Created feature: form_submissions\n');
  } catch (error: any) {
    const result = handleError(error, 'form_submissions feature');
    if (!result?.alreadyExists) throw error;
  }

  // Feature 3: AI Credits (1 credit = 1,000 tokens of the cheapest model tier;
  // heavier models consume more credits per token — see lib/ai.ts weights)
  try {
    await chargebee.feature.create({
      id: 'ai_credits',
      name: 'AI Credits',
      type: 'quantity',
      unit: 'credit',
      levels: [
        {
          value: '200',
          name: '200 credits',
          level: 0
        },
        {
          value: '2000',
          name: '2,000 credits',
          level: 1
        },
        {
          value: '20000',
          name: '20,000 credits',
          level: 2
        },
        {
          is_unlimited: true,
          name: 'Unlimited',
          level: 3
        }
      ]
    });
    logger.info('  ✅ Created feature: ai_credits\n');
  } catch (error: any) {
    const result = handleError(error, 'ai_credits feature');
    if (!result?.alreadyExists) throw error;
  }
}

/**
 * Step 1b: Activate Features
 * Features are created in draft status; entitlements only surface properly
 * once the feature is active.
 */
async function activateFeatures() {
  logger.info('🟢 Step 1b: Activating Features...\n');

  for (const featureId of ['form_views', 'form_submissions', 'ai_credits']) {
    try {
      await chargebee.feature.activate(featureId);
      logger.info(`  ✅ Activated feature: ${featureId}`);
    } catch (error: any) {
      // Already-active features fail with an invalid state error — that's fine
      if (
        error.api_error_code === 'invalid_state_for_request' ||
        error.message?.includes('already active')
      ) {
        logger.info(`  ⚠️  Feature ${featureId} already active (skipping)`);
      } else {
        logger.error(`  ❌ Error activating feature ${featureId}:`, error.message || error);
        throw error;
      }
    }
  }
  logger.info('');
}

/**
 * Step 2: Create Plan Items
 */
async function createPlanItems() {
  logger.info('📋 Step 2: Creating Plan Items...\n');

  const plans = [
    { id: 'free', name: 'Free Plan' },
    { id: 'starter', name: 'Starter Plan' },
    { id: 'advanced', name: 'Advanced Plan' }
  ];

  for (const plan of plans) {
    try {
      await chargebee.item.create({
        id: plan.id,
        name: plan.name,
        type: 'plan',
        item_family_id: 'dculus-forms',
        item_applicability: 'all'
      });
      logger.info(`  ✅ Created plan item: ${plan.id}`);
    } catch (error: any) {
      const result = handleError(error, `${plan.id} plan item`);
      if (!result?.alreadyExists) throw error;
    }
  }
  logger.info('');
}

/**
 * Step 3: Create Item Prices (Multi-Currency)
 */
async function createItemPrices() {
  logger.info('💰 Step 3: Creating Item Prices...\n');

  const itemPrices = [
    // Free Plan
    {
      id: 'free-usd-monthly',
      item_id: 'free',
      name: 'Free Plan USD Monthly',
      pricing_model: 'per_unit',
      currency_code: 'USD',
      price: 0,
      period_unit: 'month',
      period: 1
    },
    {
      id: 'free-inr-monthly',
      item_id: 'free',
      name: 'Free Plan INR Monthly',
      pricing_model: 'per_unit',
      currency_code: 'INR',
      price: 0,
      period_unit: 'month',
      period: 1
    },
    // Starter Plan - Monthly
    {
      id: 'starter-usd-monthly',
      item_id: 'starter',
      name: 'Starter Plan USD Monthly',
      pricing_model: 'per_unit',
      currency_code: 'USD',
      price: 600, // $6.00 in cents
      period_unit: 'month',
      period: 1
    },
    {
      id: 'starter-inr-monthly',
      item_id: 'starter',
      name: 'Starter Plan INR Monthly',
      pricing_model: 'per_unit',
      currency_code: 'INR',
      price: 48900, // ₹489.00 in paise
      period_unit: 'month',
      period: 1
    },
    // Starter Plan - Yearly
    {
      id: 'starter-usd-yearly',
      item_id: 'starter',
      name: 'Starter Plan USD Yearly',
      pricing_model: 'per_unit',
      currency_code: 'USD',
      price: 6600, // $66.00/year ($5.50/month) in cents
      period_unit: 'year',
      period: 1
    },
    {
      id: 'starter-inr-yearly',
      item_id: 'starter',
      name: 'Starter Plan INR Yearly',
      pricing_model: 'per_unit',
      currency_code: 'INR',
      price: 540000, // ₹5,400/year (₹450/month) in paise
      period_unit: 'year',
      period: 1
    },
    // Advanced Plan - Monthly
    {
      id: 'advanced-usd-monthly',
      item_id: 'advanced',
      name: 'Advanced Plan USD Monthly',
      pricing_model: 'per_unit',
      currency_code: 'USD',
      price: 1500, // $15.00 in cents
      period_unit: 'month',
      period: 1
    },
    {
      id: 'advanced-inr-monthly',
      item_id: 'advanced',
      name: 'Advanced Plan INR Monthly',
      pricing_model: 'per_unit',
      currency_code: 'INR',
      price: 128900, // ₹1,289.00 in paise
      period_unit: 'month',
      period: 1
    },
    // Advanced Plan - Yearly
    {
      id: 'advanced-usd-yearly',
      item_id: 'advanced',
      name: 'Advanced Plan USD Yearly',
      pricing_model: 'per_unit',
      currency_code: 'USD',
      price: 16800, // $168.00/year ($14/month) in cents
      period_unit: 'year',
      period: 1
    },
    {
      id: 'advanced-inr-yearly',
      item_id: 'advanced',
      name: 'Advanced Plan INR Yearly',
      pricing_model: 'per_unit',
      currency_code: 'INR',
      price: 1426800, // ₹14,268/year (₹1,189/month) in paise
      period_unit: 'year',
      period: 1
    }
  ];

  for (const priceData of itemPrices) {
    try {
      await chargebee.itemPrice.create(priceData as any);
      const displayPrice = priceData.currency_code === 'USD'
        ? `$${(priceData.price / 100).toFixed(2)}`
        : `₹${(priceData.price / 100).toFixed(2)}`;
      const period = priceData.period_unit === 'year' ? 'year' : 'month';
      logger.info(`  ✅ Created price: ${priceData.id} (${displayPrice}/${period})`);
    } catch (error: any) {
      const result = handleError(error, `${priceData.id} item price`);
      if (!result?.alreadyExists) throw error;
    }
  }
  logger.info('');
}

/**
 * Step 4: Link Features to Plans via Entitlements
 */
async function createEntitlements() {
  logger.info('🔗 Step 4: Linking Features to Plans (Entitlements)...\n');

  const entitlementConfigs = [
    // Free Plan (USD)
    {
      planPriceId: 'free-usd-monthly',
      planName: 'Free (USD) - Monthly',
      entitlements: [
        { feature_id: 'form_views', value: '10000' },
        { feature_id: 'form_submissions', value: '1000' },
        { feature_id: 'ai_credits', value: '200' }
      ]
    },
    // Free Plan (INR)
    {
      planPriceId: 'free-inr-monthly',
      planName: 'Free (INR) - Monthly',
      entitlements: [
        { feature_id: 'form_views', value: '10000' },
        { feature_id: 'form_submissions', value: '1000' },
        { feature_id: 'ai_credits', value: '200' }
      ]
    },
    // Starter Plan (USD) - Monthly
    {
      planPriceId: 'starter-usd-monthly',
      planName: 'Starter (USD) - Monthly',
      entitlements: [
        { feature_id: 'form_views', value: 'unlimited' },
        { feature_id: 'form_submissions', value: '10000' },
        { feature_id: 'ai_credits', value: '2000' }
      ]
    },
    // Starter Plan (INR) - Monthly
    {
      planPriceId: 'starter-inr-monthly',
      planName: 'Starter (INR) - Monthly',
      entitlements: [
        { feature_id: 'form_views', value: 'unlimited' },
        { feature_id: 'form_submissions', value: '10000' },
        { feature_id: 'ai_credits', value: '2000' }
      ]
    },
    // Starter Plan (USD) - Yearly
    {
      planPriceId: 'starter-usd-yearly',
      planName: 'Starter (USD) - Yearly',
      entitlements: [
        { feature_id: 'form_views', value: 'unlimited' },
        { feature_id: 'form_submissions', value: '10000' },
        { feature_id: 'ai_credits', value: '2000' }
      ]
    },
    // Starter Plan (INR) - Yearly
    {
      planPriceId: 'starter-inr-yearly',
      planName: 'Starter (INR) - Yearly',
      entitlements: [
        { feature_id: 'form_views', value: 'unlimited' },
        { feature_id: 'form_submissions', value: '10000' },
        { feature_id: 'ai_credits', value: '2000' }
      ]
    },
    // Advanced Plan (USD) - Monthly
    {
      planPriceId: 'advanced-usd-monthly',
      planName: 'Advanced (USD) - Monthly',
      entitlements: [
        { feature_id: 'form_views', value: 'unlimited' },
        { feature_id: 'form_submissions', value: '100000' },
        { feature_id: 'ai_credits', value: '20000' }
      ]
    },
    // Advanced Plan (INR) - Monthly
    {
      planPriceId: 'advanced-inr-monthly',
      planName: 'Advanced (INR) - Monthly',
      entitlements: [
        { feature_id: 'form_views', value: 'unlimited' },
        { feature_id: 'form_submissions', value: '100000' },
        { feature_id: 'ai_credits', value: '20000' }
      ]
    },
    // Advanced Plan (USD) - Yearly
    {
      planPriceId: 'advanced-usd-yearly',
      planName: 'Advanced (USD) - Yearly',
      entitlements: [
        { feature_id: 'form_views', value: 'unlimited' },
        { feature_id: 'form_submissions', value: '100000' },
        { feature_id: 'ai_credits', value: '20000' }
      ]
    },
    // Advanced Plan (INR) - Yearly
    {
      planPriceId: 'advanced-inr-yearly',
      planName: 'Advanced (INR) - Yearly',
      entitlements: [
        { feature_id: 'form_views', value: 'unlimited' },
        { feature_id: 'form_submissions', value: '100000' },
        { feature_id: 'ai_credits', value: '20000' }
      ]
    }
  ];

  for (const config of entitlementConfigs) {
    try {
      const entitlementsData = config.entitlements.map(e => ({
        entity_id: config.planPriceId,
        entity_type: 'plan_price' as any,
        feature_id: e.feature_id,
        value: e.value
      }));

      await chargebee.entitlement.create({
        action: 'upsert',
        entitlements: entitlementsData
      } as any);

      logger.info(`  ✅ Configured entitlements for ${config.planName}:`);
      config.entitlements.forEach(e => {
        const displayValue = e.value === 'unlimited' ? 'Unlimited' : parseInt(e.value).toLocaleString();
        logger.info(`     - ${e.feature_id}: ${displayValue}`);
      });
    } catch (error: any) {
      logger.error(`  ❌ Error configuring entitlements for ${config.planName}:`, error.message || error);
      // Continue with other plans even if one fails
    }
  }
  logger.info('');
}

/**
 * Main execution function
 */
async function main() {
  try {
    await createItemFamily();
    await createFeatures();
    await activateFeatures();
    await createPlanItems();
    await createItemPrices();
    await createEntitlements();

    logger.info('✅ Chargebee setup complete!\n');
    logger.info('📊 Summary:');
    logger.info('  • Features created: form_views, form_submissions, ai_credits');
    logger.info('  • Plans created: free, starter, advanced');
    logger.info('  • Item prices created: 10 total');
    logger.info('    - Free: 2 (USD/INR monthly)');
    logger.info('    - Starter: 4 (USD/INR monthly + yearly)');
    logger.info('    - Advanced: 4 (USD/INR monthly + yearly)');
    logger.info('  • Entitlements configured: 10 plan prices (incl. ai_credits: 200/2,000/20,000)\n');
    logger.info('💰 Pricing:');
    logger.info('  • Starter: $6/mo or $66/yr ($5.50/mo)');
    logger.info('  • Advanced: $15/mo or $168/yr ($14/mo)\n');
    logger.info('🎉 You can now view your plans in the Chargebee dashboard!');
    logger.info(`   https://${CHARGEBEE_SITE}.chargebee.com/\n`);
  } catch (error) {
    logger.error('\n❌ Setup failed:', error);
    process.exit(1);
  }
}

// Run the setup
main();
