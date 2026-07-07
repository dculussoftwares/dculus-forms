#!/usr/bin/env tsx
/**
 * Backfill: $0 Chargebee subscriptions for pre-existing free-plan orgs
 *
 * Task 4 wires up `createFreeSubscription` so NEW free-plan orgs get a $0 Chargebee
 * subscription at creation time. Orgs created before that change have a `Subscription`
 * row with `chargebeeSubscriptionId IS NULL`. This script backfills them:
 *
 *   1. Idempotency check FIRST: list the customer's existing Chargebee subscriptions. If
 *      one already exists in an 'active' or 'non_renewing' state, ADOPT it (store its id
 *      locally) instead of creating a duplicate.
 *   2. Otherwise, create a new $0 subscription on the `free-usd-monthly` item price,
 *      mirroring `createFreeSubscription` in chargebeeService.ts.
 *
 * Per-org failures are logged and counted, then the run continues to the next org — one
 * bad row must not block the rest. Rows with no `chargebeeCustomerId` (pre-date customer
 * creation) are skipped and reported separately for manual follow-up.
 *
 * Runs sequentially (no Promise.all fan-out) to stay Chargebee-API-rate-friendly.
 *
 * Safety model:
 *   - Dry-run by default: prints what WOULD change (including which orgs would be
 *     adopted vs. newly created) and exits without writing anything. Note: the
 *     idempotency-check READ against Chargebee always happens, even in dry-run — only
 *     the create/adopt WRITE is gated behind --execute.
 *   - Pass --execute to apply changes.
 *   - Idempotent: rows that already have a chargebeeSubscriptionId are skipped by the
 *     query itself, so re-running is safe.
 *
 * Exit code: 1 if any org failed, 0 otherwise (failed org ids are printed in the summary).
 *
 * Usage:
 *   npx tsx src/scripts/backfill-free-subscriptions.ts             # dry run (default)
 *   npx tsx src/scripts/backfill-free-subscriptions.ts --execute    # apply changes
 */

import Chargebee from 'chargebee';
import * as dotenv from 'dotenv';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';

// ES module __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: resolve(__dirname, '../../.env') });

const CHARGEBEE_SITE = process.env.CHARGEBEE_SITE;
const CHARGEBEE_API_KEY = process.env.CHARGEBEE_API_KEY;

if (!CHARGEBEE_SITE || !CHARGEBEE_API_KEY) {
  logger.error('[backfill-free-subscriptions] Missing Chargebee credentials!');
  logger.error('[backfill-free-subscriptions] Set CHARGEBEE_SITE and CHARGEBEE_API_KEY in apps/backend/.env');
  process.exit(1);
}

const chargebee = new Chargebee({
  site: CHARGEBEE_SITE,
  apiKey: CHARGEBEE_API_KEY,
});

const EXECUTE = process.argv.includes('--execute');

// Statuses that make an existing Chargebee subscription safe to adopt rather than
// create a duplicate for.
const ADOPTABLE_STATUSES = new Set(['active', 'non_renewing']);

interface SubscriptionRow {
  id: string;
  organizationId: string;
  chargebeeCustomerId: string;
}

type OrgAction = 'adopt' | 'create';

async function processOrg(row: SubscriptionRow): Promise<OrgAction> {
  // Idempotency check FIRST — never create a duplicate subscription for a customer
  // that already has an active/non_renewing one.
  const existing: any = await chargebee.subscription.list({
    limit: 100,
    customer_id: { is: row.chargebeeCustomerId },
  } as any);

  const adoptable = (existing.list ?? []).find((entry: any) =>
    ADOPTABLE_STATUSES.has(entry.subscription?.status)
  );

  const verb = EXECUTE ? 'applied' : 'dry-run';

  if (adoptable) {
    const chargebeeSubscriptionId = adoptable.subscription.id;
    logger.info(
      `  [${verb}] org=${row.organizationId} adopt existing Chargebee subscription ${chargebeeSubscriptionId} (status=${adoptable.subscription.status})`
    );
    if (EXECUTE) {
      await prisma.subscription.update({
        where: { id: row.id },
        data: { chargebeeSubscriptionId },
      });
    }
    return 'adopt';
  }

  logger.info(
    `  [${verb}] org=${row.organizationId} create new $0 Chargebee subscription (customer=${row.chargebeeCustomerId})`
  );
  if (EXECUTE) {
    const result: any = await chargebee.subscription.createWithItems(row.chargebeeCustomerId, {
      subscription_items: [{ item_price_id: 'free-usd-monthly', quantity: 1 }],
      auto_collection: 'off',
    } as any);
    await prisma.subscription.update({
      where: { id: row.id },
      data: { chargebeeSubscriptionId: result.subscription.id },
    });
  }
  return 'create';
}

async function main(): Promise<number> {
  logger.info(`[backfill-free-subscriptions] Starting (${EXECUTE ? 'EXECUTE' : 'DRY RUN'})...`);
  if (!EXECUTE) {
    logger.info('[backfill-free-subscriptions] Dry run — no changes will be written. Pass --execute to apply.');
  }

  const rows = await prisma.subscription.findMany({
    where: { chargebeeSubscriptionId: null },
    select: { id: true, organizationId: true, chargebeeCustomerId: true },
  });

  logger.info(`[backfill-free-subscriptions] Found ${rows.length} subscription row(s) with chargebeeSubscriptionId IS NULL`);

  const missingCustomer = rows.filter((row) => !row.chargebeeCustomerId);
  const candidates = rows.filter((row): row is SubscriptionRow => !!row.chargebeeCustomerId);

  for (const row of missingCustomer) {
    logger.warn(`  [skip] org=${row.organizationId} has no chargebeeCustomerId — needs manual attention`);
  }

  let adopted = 0;
  let created = 0;
  const failed: string[] = [];

  // Sequential on purpose — stays Chargebee-API-rate-friendly, no Promise.all fan-out.
  for (const row of candidates) {
    try {
      const action = await processOrg(row);
      if (action === 'adopt') adopted++;
      else created++;
    } catch (error: any) {
      failed.push(row.organizationId);
      logger.error(`  [error] org=${row.organizationId} failed: ${error.message || error}`);
      // Per-org failure — continue to the next org rather than aborting the whole run.
    }
  }

  logger.info('[backfill-free-subscriptions] Summary:');
  logger.info(`  Candidates:            ${candidates.length}`);
  logger.info(`  Adopted existing:      ${adopted}`);
  logger.info(`  Created new:           ${created}`);
  logger.info(
    `  Failed:                ${failed.length}${failed.length ? ` (orgs: ${failed.join(', ')})` : ''}`
  );
  logger.info(
    `  Skipped (no customer): ${missingCustomer.length}${
      missingCustomer.length ? ` (orgs: ${missingCustomer.map((row) => row.organizationId).join(', ')})` : ''
    }`
  );

  if (!EXECUTE) {
    logger.info('[backfill-free-subscriptions] Dry run complete. Re-run with --execute to apply these changes.');
  } else {
    logger.info('[backfill-free-subscriptions] Done.');
  }

  return failed.length > 0 ? 1 : 0;
}

main()
  .then(async (exitCode) => {
    await prisma.$disconnect();
    process.exit(exitCode);
  })
  .catch(async (error) => {
    logger.error('[backfill-free-subscriptions] Fatal error:', error);
    await prisma.$disconnect();
    process.exit(1);
  });
