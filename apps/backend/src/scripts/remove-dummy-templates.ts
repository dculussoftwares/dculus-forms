/**
 * Removes the dummy starter templates that seed-templates.ts used to create.
 *
 * Dry run by default — it lists the candidates with their ids. Deleting needs
 * the ids you reviewed, so nothing is removed on a name match alone:
 *   pnpm db:remove-dummy-templates                               # preview
 *   pnpm db:remove-dummy-templates --confirm --ids=<id>,<id>,...  # delete those
 *
 * Only deletes templates matching an exact seeded (name, category) pair that
 * were never published (no slug, not public). A name match can't prove a row
 * came from the seed, so --confirm only deletes ids you pass explicitly, and
 * only if they are still in that candidate list. Forms already created from these templates
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
  const idsArg = process.argv.find((a) => a.startsWith('--ids='));
  const reviewedIds = new Set(
    (idsArg?.slice('--ids='.length) ?? '').split(',').map((id) => id.trim()).filter(Boolean)
  );
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
    logger.info('Dry run — nothing deleted. Check each one is a seeded dummy, then re-run with');
    logger.info(`  --confirm --ids=${matches.map((t) => t.id).join(',')}`);
    return;
  }

  if (reviewedIds.size === 0) {
    logger.error('--confirm needs --ids=<id>,... copied from the dry run. Nothing deleted.');
    process.exitCode = 1;
    return;
  }
  const candidateIds = new Set(matches.map((t) => t.id));
  const unknown = [...reviewedIds].filter((id) => !candidateIds.has(id));
  if (unknown.length) {
    logger.error(`Not dummy-template candidates, refusing to delete: ${unknown.join(', ')}. Nothing deleted.`);
    process.exitCode = 1;
    return;
  }

  const { count } = await prisma.formTemplate.deleteMany({
    where: { id: { in: [...reviewedIds] } },
  });
  logger.info(`Deleted ${count} dummy template(s).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
