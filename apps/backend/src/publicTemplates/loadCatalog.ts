/**
 * Reads the public template seed data (JSON, outside src/ so it is never compiled into
 * the app or shipped in the image — see /.dockerignore). The running backend never reads
 * these files: templates are served from the database.
 */
import { readdirSync, readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type { PublicTemplateDefinition } from './types.js';

export const DEFAULT_SEED_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../seed-data/public-templates'
);

export interface LoadedDefinition {
  file: string;
  def: PublicTemplateDefinition;
}

/** Every *.json in the folder, sorted by file name. Throws on unreadable JSON. */
export const loadCatalog = (dir: string = DEFAULT_SEED_DIR): LoadedDefinition[] =>
  readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((file) => {
      try {
        return { file, def: JSON.parse(readFileSync(path.join(dir, file), 'utf8')) as PublicTemplateDefinition };
      } catch (error) {
        throw new Error(`${file}: invalid JSON (${(error as Error).message})`);
      }
    });
