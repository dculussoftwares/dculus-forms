/**
 * Minimal template seeder for CI E2E tests — no S3 uploads required.
 * Seeds templates with empty background images so the form builder has templates to pick from.
 */
import 'dotenv/config';
import { seedTemplates } from './seed-templates.js';
import { logger } from '../lib/logger.js';

async function main() {
  logger.info('🌱 Seeding templates for CI E2E (no S3)...');
  // Pass empty uploadedFiles — templates will be created without background images
  await seedTemplates([]);
  logger.info('✅ CI template seeding complete');
}

main().catch((e) => {
  console.error('Template seed failed (non-fatal):', e.message);
  process.exit(0); // non-fatal — tests can still run without background images
});
