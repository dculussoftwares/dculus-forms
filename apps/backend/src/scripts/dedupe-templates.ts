import 'dotenv/config';
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';

async function dedupeTemplates() {
  logger.info('Deduplicating FormTemplate records...');

  const all = await prisma.formTemplate.findMany({
    orderBy: { createdAt: 'asc' },
  });

  const seen = new Map<string, string>(); // key -> earliest id
  const toDelete: string[] = [];

  for (const t of all) {
    const key = `${t.name}__${t.category ?? ''}`;
    if (seen.has(key)) {
      toDelete.push(t.id);
    } else {
      seen.set(key, t.id);
    }
  }

  if (toDelete.length === 0) {
    logger.info('No duplicates found.');
  } else {
    await prisma.formTemplate.deleteMany({ where: { id: { in: toDelete } } });
    logger.info(`Deleted ${toDelete.length} duplicate templates.`);
  }

  await prisma.$disconnect();
}

dedupeTemplates().catch(e => { console.error(e); process.exit(1); });
