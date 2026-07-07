#!/usr/bin/env tsx
/**
 * Backfill: AI-credit accounting for existing rows
 *
 * One-time backfill for two things introduced by the AI-credits feature:
 *
 *   1. AIUsage rows in the CURRENT billing month where `creditsUsedMilli === 0` but
 *      `tokensUsed > 0` — these were recorded before credit weighting existed. Backfilled
 *      at a flat nano weight (1 token = 1 milli-credit) since the historic per-request
 *      model mix isn't recorded anywhere. Rows from earlier months are left untouched.
 *   2. Subscription rows where `aiCreditsLimit IS NULL` — seeded from the plan's fallback
 *      allowance (`AI_CREDIT_LIMITS_FALLBACK`) so orgs don't rely on the runtime fallback
 *      computed on every read. A later Chargebee webhook sync overwrites this with the
 *      live entitlement value.
 *
 * DB-only — no Chargebee calls. See backfill-free-subscriptions.ts for the Chargebee half.
 *
 * Safety model:
 *   - Dry-run by default: prints what WOULD change and exits 0 without writing anything.
 *   - Pass --execute to apply changes.
 *   - Idempotent: rows that no longer match the backfill criteria are simply skipped on
 *     the next run.
 *
 * Usage:
 *   npx tsx src/scripts/backfill-ai-credits.ts             # dry run (default)
 *   npx tsx src/scripts/backfill-ai-credits.ts --execute    # apply changes
 */

import * as dotenv from 'dotenv';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';
import { AI_CREDIT_LIMITS_FALLBACK } from '../lib/ai.js';

// ES module __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: resolve(__dirname, '../../.env') });

const EXECUTE = process.argv.includes('--execute');

// Same computation as aiUsageService.ts's currentPeriod() — month start, local time.
function currentPeriodStart(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

async function backfillAIUsageCredits(periodStart: Date): Promise<{ matched: number; updated: number }> {
  const rows = await prisma.aIUsage.findMany({
    where: { periodStart, creditsUsedMilli: 0, tokensUsed: { gt: 0 } },
    select: { id: true, organizationId: true, tokensUsed: true },
  });

  logger.info(
    `[backfill-ai-credits] AIUsage: found ${rows.length} row(s) in current period (${periodStart.toISOString()}) needing credit backfill`
  );

  if (!EXECUTE) {
    for (const row of rows) {
      logger.info(
        `  [dry-run] AIUsage(${row.id}) org=${row.organizationId} creditsUsedMilli 0 -> ${row.tokensUsed}`
      );
    }
    return { matched: rows.length, updated: 0 };
  }

  let updated = 0;
  for (const row of rows) {
    await prisma.aIUsage.update({
      where: { id: row.id },
      data: { creditsUsedMilli: row.tokensUsed },
    });
    logger.info(
      `  [applied] AIUsage(${row.id}) org=${row.organizationId} creditsUsedMilli 0 -> ${row.tokensUsed}`
    );
    updated++;
  }
  return { matched: rows.length, updated };
}

async function backfillSubscriptionLimits(): Promise<{ matched: number; updated: number }> {
  const rows = await prisma.subscription.findMany({
    where: { aiCreditsLimit: null },
    select: { id: true, organizationId: true, planId: true },
  });

  logger.info(`[backfill-ai-credits] Subscription: found ${rows.length} row(s) with aiCreditsLimit IS NULL`);

  if (!EXECUTE) {
    for (const row of rows) {
      const limit = AI_CREDIT_LIMITS_FALLBACK[row.planId] ?? AI_CREDIT_LIMITS_FALLBACK.free;
      logger.info(
        `  [dry-run] Subscription(${row.id}) org=${row.organizationId} plan=${row.planId} aiCreditsLimit null -> ${limit}`
      );
    }
    return { matched: rows.length, updated: 0 };
  }

  let updated = 0;
  for (const row of rows) {
    const limit = AI_CREDIT_LIMITS_FALLBACK[row.planId] ?? AI_CREDIT_LIMITS_FALLBACK.free;
    await prisma.subscription.update({
      where: { id: row.id },
      data: { aiCreditsLimit: limit },
    });
    logger.info(
      `  [applied] Subscription(${row.id}) org=${row.organizationId} plan=${row.planId} aiCreditsLimit null -> ${limit}`
    );
    updated++;
  }
  return { matched: rows.length, updated };
}

async function main(): Promise<number> {
  logger.info(`[backfill-ai-credits] Starting (${EXECUTE ? 'EXECUTE' : 'DRY RUN'})...`);
  if (!EXECUTE) {
    logger.info('[backfill-ai-credits] Dry run — no changes will be written. Pass --execute to apply.');
  }

  const usageResult = await backfillAIUsageCredits(currentPeriodStart());
  const subscriptionResult = await backfillSubscriptionLimits();

  logger.info('[backfill-ai-credits] Summary:');
  logger.info(`  AIUsage:      matched=${usageResult.matched} updated=${usageResult.updated}`);
  logger.info(`  Subscription: matched=${subscriptionResult.matched} updated=${subscriptionResult.updated}`);

  if (!EXECUTE) {
    logger.info('[backfill-ai-credits] Dry run complete. Re-run with --execute to apply these changes.');
  } else {
    logger.info('[backfill-ai-credits] Done.');
  }

  return 0;
}

main()
  .then(async (exitCode) => {
    await prisma.$disconnect();
    process.exit(exitCode);
  })
  .catch(async (error) => {
    logger.error('[backfill-ai-credits] Fatal error:', error);
    await prisma.$disconnect();
    process.exit(1);
  });
