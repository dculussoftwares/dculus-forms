/**
 * Seeds the E2E test account with an Advanced plan subscription.
 * Run before Cloudflare E2E tests to prevent SUBMISSION_LIMIT_EXCEEDED errors.
 *
 * Only intended for the dev environment — never run against production.
 * Uses E2E_EMAIL env var to locate the test user's organization.
 */
import 'dotenv/config';
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';

const ADVANCED_LIMITS = {
  views: null,          // unlimited
  submissions: 100000,  // advanced plan
} as const;

async function main() {
  const e2eEmail = process.env.E2E_EMAIL;

  if (!e2eEmail) {
    throw new Error('E2E_EMAIL must be set');
  }

  logger.info(`🔍 Looking up E2E test user: ${e2eEmail}`);

  // Find the user
  const user = await prisma.user.findUnique({
    where: { email: e2eEmail },
    select: { id: true, email: true },
  });

  if (!user) {
    throw new Error(`E2E user not found: ${e2eEmail}`);
  }

  // Find their organization (they should be owner)
  const membership = await prisma.member.findFirst({
    where: { userId: user.id, role: 'owner' },
    select: { organizationId: true },
  });

  if (!membership) {
    throw new Error(`No owner org found for E2E user: ${e2eEmail}`);
  }

  const orgId = membership.organizationId;
  logger.info(`📦 Found org: ${orgId}`);

  // Upsert Advanced subscription — reset usage counters
  const now = new Date();
  const periodEnd = new Date(now);
  periodEnd.setFullYear(periodEnd.getFullYear() + 1); // 1 year validity

  const sub = await prisma.subscription.upsert({
    where: { organizationId: orgId },
    update: {
      planId: 'advanced',
      status: 'active',
      submissionsUsed: 0,
      viewsUsed: 0,
      submissionsLimit: ADVANCED_LIMITS.submissions,
      viewsLimit: ADVANCED_LIMITS.views,
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
    },
    create: {
      organizationId: orgId,
      chargebeeCustomerId: `e2e-ci-${orgId}`,
      chargebeeSubscriptionId: `e2e-ci-sub-${orgId}`,
      planId: 'advanced',
      status: 'active',
      submissionsUsed: 0,
      viewsUsed: 0,
      submissionsLimit: ADVANCED_LIMITS.submissions,
      viewsLimit: ADVANCED_LIMITS.views,
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
    },
  });

  logger.info(`✅ E2E subscription seeded — plan: ${sub.planId}, submissionsUsed: ${sub.submissionsUsed}/${sub.submissionsLimit}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error('❌ seed-e2e-subscription failed:', e.message);
    prisma.$disconnect();
    process.exit(1);
  });
