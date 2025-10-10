/**
 * Plugin Worker Wrapper (JavaScript)
 *
 * This wrapper loads the TypeScript worker using dynamic import.
 * Bree can execute this .js file in a worker thread, and it will
 * dynamically import the TypeScript worker with tsx support.
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Dynamic import of the TypeScript worker
const workerPath = join(__dirname, 'plugin-worker.ts');

// Use tsx to execute TypeScript
import(`file://${workerPath}`).catch(error => {
  console.error('Failed to load worker:', error);
  process.exit(1);
});
