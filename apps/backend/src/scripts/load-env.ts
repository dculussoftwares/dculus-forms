/**
 * Loads apps/backend/.env before any other module evaluates.
 *
 * Import this FIRST in standalone scripts that (transitively) import
 * `../lib/env.js` — ESM evaluates static imports before the importing module's
 * body runs, so a `dotenv.config()` call in the script body executes too late
 * for env validation that happens at module load.
 */
import * as dotenv from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

dotenv.config({ path: resolve(dirname(fileURLToPath(import.meta.url)), '../../.env') });
