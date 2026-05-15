/**
 * Creates a verified E2E test user with an organization for CI pipeline.
 * Uses environment variables E2E_EMAIL and E2E_PASSWORD.
 */
import 'dotenv/config';
import { prisma } from '../lib/prisma.js';
import { auth } from '../lib/better-auth.js';
import { logger } from '../lib/logger.js';

async function main() {
  const email = process.env.E2E_EMAIL;
  const password = process.env.E2E_PASSWORD;

  if (!email || !password) {
    throw new Error('E2E_EMAIL and E2E_PASSWORD must be set');
  }

  logger.info(`🤖 Creating E2E test user: ${email}`);

  // Check if user already exists
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    logger.info('✅ E2E user already exists, ensuring emailVerified=true');
    await prisma.user.update({ where: { email }, data: { emailVerified: true } });
    return;
  }

  // Sign up via Better Auth
  const result = await auth.api.signUpEmail({
    body: { email, password, name: 'E2E Test User' },
  });

  if (!result?.user?.id) {
    throw new Error('Sign-up did not return a user');
  }

  // Verify email (skip email delivery in test env)
  await prisma.user.update({
    where: { id: result.user.id },
    data: { emailVerified: true },
  });

  // Create an organization directly via Prisma
  const org = await prisma.organization.create({
    data: {
      id: `org-e2e-${Date.now()}`,
      name: 'E2E Test Org',
      slug: 'e2e-test-org',
      createdAt: new Date(),
    },
  });

  // Make the user a member/owner of the org
  await prisma.member.create({
    data: {
      id: `member-e2e-${Date.now()}`,
      organizationId: org.id,
      userId: result.user.id,
      role: 'owner',
      createdAt: new Date(),
    },
  });

  // Set as active organization in the session
  await prisma.session.updateMany({
    where: { userId: result.user.id },
    data: { activeOrganizationId: org.id },
  });

  logger.info(`✅ E2E user created. Org: ${org.id}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error('❌ E2E user creation failed:', e.message);
    prisma.$disconnect();
    process.exit(1);
  });
