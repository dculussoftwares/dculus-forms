/**
 * Removes the dummy starter templates that seed-templates.ts used to create.
 *
 * Dry run by default — it only lists what it would delete.
 *   pnpm db:remove-dummy-templates            # preview
 *   pnpm db:remove-dummy-templates --confirm  # delete
 *
 * Only deletes templates matching an exact seeded (name, category) pair that
 * were never published (no slug, not public) — a real template that reuses a
 * name, or a seeded one an admin has since published, is left alone. Review the
 * dry-run list before confirming. Forms already created from these templates
 * are unaffected (they hold their own copy of the schema).
 */
import 'dotenv/config';
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';

// Exactly what seed-templates.ts created.
const DUMMY_TEMPLATES: Array<{ name: string; category: string }> = [
  { name: 'Contact Form', category: 'Business' },
  { name: 'Customer Feedback Survey', category: 'Survey' },
  { name: 'Event Registration', category: 'Events' },
  { name: 'Job Application Form', category: 'HR' },
  { name: 'Product Feedback Survey', category: 'Survey' },
  { name: 'Newsletter Signup', category: 'Marketing' },
  { name: 'All Fields Showcase', category: 'Reference' },
  { name: 'General Knowledge Quiz', category: 'Quiz' },
];

function databaseHost(): string {
  try {
    return new URL(process.env.DATABASE_URL ?? '').host || 'unknown';
  } catch {
    return 'unknown';
  }
}

async function main() {
  const confirm = process.argv.includes('--confirm');
  logger.info(`Database: ${databaseHost()}`);

  const matches = await prisma.formTemplate.findMany({
    where: {
      OR: DUMMY_TEMPLATES.map(({ name, category }) => ({ name, category })),
      slug: null,
      isPublic: false,
    },
    select: { id: true, name: true, category: true },
    orderBy: { name: 'asc' },
  });
  const total = await prisma.formTemplate.count();

  if (matches.length === 0) {
    logger.info(`No dummy templates found (${total} templates in total).`);
    return;
  }

  logger.info(`Found ${matches.length} dummy template(s) out of ${total}:`);
  for (const t of matches) logger.info(`  - ${t.name} [${t.category ?? 'no category'}] (${t.id})`);

  if (!confirm) {
    logger.info('Dry run — nothing deleted. Re-run with --confirm to delete these.');
    return;
  }

  const { count } = await prisma.formTemplate.deleteMany({
    where: { id: { in: matches.map((t) => t.id) } },
  });
  logger.info(`Deleted ${count} dummy template(s).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
