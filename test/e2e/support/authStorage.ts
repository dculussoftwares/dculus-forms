import fs from 'fs';
import path from 'path';
import type { BrowserContext } from 'playwright';

const AUTH_DIR = path.join(process.cwd(), 'test', 'e2e', '.auth');
export const STORAGE_STATE_PATH = path.join(AUTH_DIR, 'storage-state.json');

export function hasStoredAuthState(): boolean {
  return fs.existsSync(STORAGE_STATE_PATH);
}

export async function ensureAuthDir(): Promise<void> {
  await fs.promises.mkdir(AUTH_DIR, { recursive: true });
}

export async function saveAuthState(context: BrowserContext): Promise<void> {
  await ensureAuthDir();
  await context.storageState({ path: STORAGE_STATE_PATH });
}
