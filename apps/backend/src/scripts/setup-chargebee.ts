#!/usr/bin/env tsx
/**
 * Chargebee Setup Script (first-time catalog bootstrap for ANY Chargebee site)
 *
 * Creates the item family, features, plans, add-ons, item prices and entitlements
 * described by docs/pricing-plan-catalog.json — the single source of truth for the
 * catalog. Everything is idempotent: existing resources are skipped (never modified),
 * so it is safe to re-run. Changing limits/prices of an existing catalog is done
 * from the admin app (plan catalog), not here.
 *
 * Safety model (this talks to a live billing account):
 *   - DRY RUN by default: prints what would be created, touches nothing.
 *   - To apply, pass BOTH `--execute` and `--confirm-site=<CHARGEBEE_SITE>` whose value
 *     must equal the configured site. This prevents running prod seeding against the
 *     wrong account (or vice versa) because of a stale .env.
 *
 * Usage (credentials come from the environment — never commit them):
 *   CHARGEBEE_SITE=... CHARGEBEE_API_KEY=... npx tsx src/scripts/setup-chargebee.ts
 *   CHARGEBEE_SITE=... CHARGEBEE_API_KEY=... npx tsx src/scripts/setup-chargebee.ts \
 *       --execute --confirm-site=<same site>
 */

import Chargebee from 'chargebee';
import * as dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { logger } from '../lib/logger.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Existing env wins (CI / prod runs); .env only fills gaps for local use.
dotenv.config({ path: resolve(__dirname, '../../.env') });

const CATALOG_PATH = resolve(__dirname, '../../../../docs/pricing-plan-catalog.json');
const ITEM_FAMILY_ID = 'dculus-forms';

const args = process.argv.slice(2);
const EXECUTE = args.includes('--execute');
const confirmSite = args.find((a) => a.startsWith('--confirm-site='))?.split('=')[1];

const { CHARGEBEE_SITE, CHARGEBEE_API_KEY } = process.env;
if (!CHARGEBEE_SITE || !CHARGEBEE_API_KEY) {
  logger.error('Missing CHARGEBEE_SITE / CHARGEBEE_API_KEY in the environment');
  process.exit(1);
}
if (EXECUTE && confirmSite !== CHARGEBEE_SITE) {
  logger.error(
    `Refusing to execute: pass --confirm-site=${CHARGEBEE_SITE} to confirm you intend to modify this Chargebee site`
  );
  process.exit(1);
}

type Currency = 'USD' | 'INR';
type Period = 'monthly' | 'yearly';
type Entitlements = Record<string, number | null>; // null = Unlimited

interface CatalogPlan {
  id: string;
  name: string;
  prices: Record<Currency, Record<Period, number>>;
  entitlements: Entitlements;
}
interface CatalogAddon {
  id: string;
  name?: string;
  unit_entitlements: Record<string, number>;
  price: Record<Currency, number>;
}
interface Catalog {
  plans: CatalogPlan[];
  addons: CatalogAddon[];
}

const catalog: Catalog = JSON.parse(readFileSync(CATALOG_PATH, 'utf8'));

const FEATURES: { id: string; name: string; unit: string }[] = [
  { id: 'form_views', name: 'Form Views', unit: 'view' },
  { id: 'form_submissions', name: 'Form Submissions', unit: 'submission' },
  { id: 'emails_sent', name: 'Emails Sent', unit: 'email' },
  // 1 credit = 1,000 tokens of the cheapest model tier (see lib/ai.ts weights)
  { id: 'ai_credits', name: 'AI Credits', unit: 'credit' },
];

const CURRENCIES: Currency[] = ['USD', 'INR'];
const PERIODS: Period[] = ['monthly', 'yearly'];
const toSmallestUnit = (amount: number) => Math.round(amount * 100);
const valueOf = (v: number | null) => (v === null ? 'Unlimited' : String(v));
const priceId = (planId: string, currency: Currency, period: Period) =>
  `${planId}-${currency.toLowerCase()}-${period}`;

const chargebee = new Chargebee({ site: CHARGEBEE_SITE, apiKey: CHARGEBEE_API_KEY });

logger.info(`Chargebee setup — site: ${CHARGEBEE_SITE} — mode: ${EXECUTE ? 'EXECUTE' : 'DRY RUN'}`);

/** Every distinct finite value the catalog uses for a feature (plans and add-ons). */
function catalogValues(featureId: string): number[] {
  const values = new Set<number>();
  for (const plan of catalog.plans) {
    const v = plan.entitlements[featureId];
    if (typeof v === 'number') values.add(v);
  }
  for (const addon of catalog.addons) {
    const v = addon.unit_entitlements[featureId];
    if (typeof v === 'number') values.add(v);
  }
  return [...values];
}

const levelsFor = (feature: { unit: string }, values: number[]) => {
  const levels: any[] = [...new Set(values)]
    .sort((a, b) => a - b)
    .map((value, level) => ({
      value: String(value),
      name: `${value.toLocaleString('en-US')} ${feature.unit}s`,
      level,
    }));
  levels.push({ is_unlimited: true, name: 'Unlimited', level: levels.length });
  return levels;
};

/**
 * Chargebee only accepts entitlement values that are defined levels of the feature, so when
 * the catalog gains a new value the feature needs that level first. Existing levels are kept
 * (nothing in use is ever removed); only missing ones are added.
 */
async function ensureFeatureLevels(feature: { id: string; name: string; unit: string }) {
  let existing: any[];
  try {
    const result: any = await chargebee.feature.retrieve(feature.id);
    existing = result.feature.levels ?? [];
  } catch {
    return; // feature doesn't exist yet — createFeatures() builds it with all levels
  }
  const have = existing.filter((l) => !l.is_unlimited).map((l) => Number(l.value));
  const missing = catalogValues(feature.id).filter((v) => !have.includes(v));
  if (missing.length === 0) return;
  if (!EXECUTE) {
    logger.info(`  [dry-run] would add levels ${missing.join(', ')} to feature ${feature.id}`);
    return;
  }
  await chargebee.feature.update(feature.id, {
    name: feature.name,
    levels: levelsFor(feature, [...have, ...missing]),
  } as any);
  logger.info(`  added levels ${missing.join(', ')} to feature ${feature.id}`);
}

/** Run a create call, treating "already exists" as a skip. */
async function create(label: string, fn: () => Promise<unknown>) {
  if (!EXECUTE) {
    logger.info(`  [dry-run] would create ${label}`);
    return;
  }
  try {
    await fn();
    logger.info(`  created ${label}`);
  } catch (error: any) {
    const exists =
      error?.api_error_code === 'resource_already_exists' ||
      /already exists|already present/i.test(error?.message ?? '');
    if (exists) {
      logger.info(`  skipped ${label} (already exists)`);
      return;
    }
    logger.error(`  FAILED ${label}: ${error?.message ?? error}`);
    throw error;
  }
}

async function createItemFamily() {
  logger.info('Step 0: item family');
  await create(`item family ${ITEM_FAMILY_ID}`, () =>
    chargebee.itemFamily.create({
      id: ITEM_FAMILY_ID,
      name: 'Dculus Forms Plans',
      description: 'All subscription plans for Dculus Forms',
    })
  );
}

async function createFeatures() {
  logger.info('Step 1: features (levels = every distinct value used by plans/add-ons)');
  for (const feature of FEATURES) {
    // Chargebee requires >= 2 levels on a quantity feature; if every plan is unlimited
    // (e.g. form_views) keep one finite level so the unlimited level is valid.
    const values = catalogValues(feature.id);
    if (values.length === 0) values.push(10000);

    await create(`feature ${feature.id}`, () =>
      chargebee.feature.create({
        id: feature.id,
        name: feature.name,
        type: 'quantity',
        unit: feature.unit,
        levels: levelsFor(feature, values),
      } as any)
    );
    await ensureFeatureLevels(feature);
  }
}

async function activateFeatures() {
  logger.info('Step 1b: activate features (entitlements only apply to active features)');
  for (const feature of FEATURES) {
    if (!EXECUTE) {
      logger.info(`  [dry-run] would activate ${feature.id}`);
      continue;
    }
    try {
      await chargebee.feature.activate(feature.id);
      logger.info(`  activated ${feature.id}`);
    } catch (error: any) {
      if (
        error?.api_error_code === 'invalid_state_for_request' ||
        /already active/i.test(error?.message ?? '')
      ) {
        logger.info(`  skipped ${feature.id} (already active)`);
      } else {
        throw error;
      }
    }
  }
}

async function createPlansAndPrices() {
  logger.info('Step 2: plan items + item prices');
  for (const plan of catalog.plans) {
    await create(`plan item ${plan.id}`, () =>
      chargebee.item.create({
        id: plan.id,
        name: plan.name,
        external_name: plan.name,
        type: 'plan',
        item_family_id: ITEM_FAMILY_ID,
        item_applicability: 'all',
        enabled_for_checkout: true,
      } as any)
    );
    for (const currency of CURRENCIES) {
      for (const period of PERIODS) {
        const amount = plan.prices[currency][period];
        // The free plan is monthly-only (renewals reset usage counters monthly).
        if (plan.id === 'free' && period === 'yearly') continue;
        await create(`item price ${priceId(plan.id, currency, period)}`, () =>
          chargebee.itemPrice.create({
            id: priceId(plan.id, currency, period),
            item_id: plan.id,
            name: `${plan.name} ${currency} ${period === 'monthly' ? 'Monthly' : 'Yearly'}`,
            pricing_model: 'per_unit',
            currency_code: currency,
            price: toSmallestUnit(amount),
            period_unit: period === 'monthly' ? 'month' : 'year',
            period: 1,
          } as any)
        );
      }
    }
  }
}

/**
 * Enterprise is negotiated per organization (see setEnterpriseSubscription): the item
 * and its four item prices must exist, but amounts are overridden per deal via
 * unit_price, limits are admin-set, and it is never shown on the pricing page.
 */
async function createEnterprise() {
  logger.info('Step 3: enterprise plan item (hidden, per-org pricing)');
  await create('plan item enterprise', () =>
    chargebee.item.create({
      id: 'enterprise',
      name: 'Enterprise',
      external_name: 'Enterprise',
      type: 'plan',
      item_family_id: ITEM_FAMILY_ID,
      item_applicability: 'all',
      enabled_for_checkout: false,
    } as any)
  );
  for (const currency of CURRENCIES) {
    for (const period of PERIODS) {
      await create(`item price ${priceId('enterprise', currency, period)}`, () =>
        chargebee.itemPrice.create({
          id: priceId('enterprise', currency, period),
          item_id: 'enterprise',
          name: `Enterprise ${currency} ${period === 'monthly' ? 'Monthly' : 'Yearly'}`,
          pricing_model: 'per_unit',
          currency_code: currency,
          price: 0,
          period_unit: period === 'monthly' ? 'month' : 'year',
          period: 1,
        } as any)
      );
    }
  }
}

async function createAddons() {
  logger.info('Step 4: add-on items + item prices');
  for (const addon of catalog.addons) {
    await create(`addon item ${addon.id}`, () =>
      chargebee.item.create({
        id: addon.id,
        name: addon.name ?? addon.id,
        external_name: addon.name ?? addon.id,
        type: 'addon',
        item_family_id: ITEM_FAMILY_ID,
        enabled_for_checkout: true,
      } as any)
    );
    for (const currency of CURRENCIES) {
      await create(`item price ${priceId(addon.id, currency, 'monthly')}`, () =>
        chargebee.itemPrice.create({
          id: priceId(addon.id, currency, 'monthly'),
          item_id: addon.id,
          name: `${addon.name ?? addon.id} ${currency} Monthly`,
          pricing_model: 'per_unit',
          currency_code: currency,
          price: toSmallestUnit(addon.price[currency]),
          period_unit: 'month',
          period: 1,
        } as any)
      );
    }
  }
}

async function createEntitlements() {
  logger.info('Step 5: entitlements (plan prices + add-on prices)');
  const rows: { entity_id: string; entity_type: string; feature_id: string; value: string }[] = [];

  for (const plan of catalog.plans) {
    for (const currency of CURRENCIES) {
      for (const period of PERIODS) {
        if (plan.id === 'free' && period === 'yearly') continue;
        for (const feature of FEATURES) {
          rows.push({
            entity_id: priceId(plan.id, currency, period),
            entity_type: 'plan_price',
            feature_id: feature.id,
            value: valueOf(plan.entitlements[feature.id] ?? null),
          });
        }
      }
    }
  }
  // Add-on entitlements are PER UNIT; the subscription item quantity multiplies them
  // (see applyAddonsToLimits). Only features an add-on actually grants are linked.
  for (const addon of catalog.addons) {
    for (const currency of CURRENCIES) {
      for (const [featureId, unit] of Object.entries(addon.unit_entitlements)) {
        rows.push({
          entity_id: priceId(addon.id, currency, 'monthly'),
          entity_type: 'addon_price',
          feature_id: featureId,
          value: String(unit),
        });
      }
    }
  }

  if (!EXECUTE) {
    logger.info(`  [dry-run] would upsert ${rows.length} entitlements`);
    return;
  }
  // Upsert is idempotent; chunk to stay well inside request-size limits.
  for (let i = 0; i < rows.length; i += 50) {
    await chargebee.entitlement.create({ action: 'upsert', entitlements: rows.slice(i, i + 50) } as any);
  }
  logger.info(`  upserted ${rows.length} entitlements`);
}

async function main() {
  try {
    await createItemFamily();
    await createFeatures();
    await activateFeatures();
    await createPlansAndPrices();
    await createEnterprise();
    await createAddons();
    await createEntitlements();
    logger.info(EXECUTE ? 'Chargebee setup complete.' : 'Dry run complete — nothing was changed.');
    logger.info(
      'Dashboard-only steps remain (webhook, checkout quantity toggle, portal): see docs/deployment/CHARGEBEE_PRODUCTION_SETUP.md'
    );
  } catch (error: any) {
    logger.error('Chargebee setup failed:', error?.message ?? error);
    process.exit(1);
  }
}

main();
