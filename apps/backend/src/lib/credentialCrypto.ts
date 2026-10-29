import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { mapConfigCredentials, mapGraphCredentials } from './secretRedaction.js';

/**
 * Encryption at rest for the credentials stored inside plugin configs and automation graphs
 * (webhook secrets, header values, OAuth tokens). Which values count as credentials is decided by
 * lib/secretRedaction.ts, so the API masking and the database encryption always agree.
 *
 * Values are sealed one by one as `enc:v1:<iv>:<tag>:<ciphertext>` (AES-256-GCM, base64url), so the
 * surrounding JSON stays queryable and a value that is already sealed is never sealed twice.
 *
 * - `CREDENTIAL_ENCRYPTION_KEY` unset → nothing is encrypted and the app behaves as before.
 * - A value without the prefix is plaintext written before encryption was enabled; it is read
 *   as is and sealed the next time its row is written. No backfill is needed.
 * - A sealed value that cannot be opened (key missing or wrong) throws instead of returning
 *   ciphertext, so a misconfigured key can neither send ciphertext to a receiver nor overwrite
 *   the stored value with garbage.
 */

const PREFIX = 'enc:v1:';
const ENV_KEY = 'CREDENTIAL_ENCRYPTION_KEY';

export class CredentialCryptoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CredentialCryptoError';
  }
}

let cachedSource: string | undefined;
let cachedKey: Buffer | null = null;

/** Any secret string works as the key material; it is stretched to 32 bytes with SHA-256. */
const getKey = (): Buffer | null => {
  const source = process.env[ENV_KEY];
  if (!source) return null;
  if (source !== cachedSource) {
    cachedSource = source;
    cachedKey = createHash('sha256').update(source).digest();
  }
  return cachedKey;
};

export const isCredentialEncryptionEnabled = (): boolean => getKey() !== null;

export const isSealed = (value: string): boolean => value.startsWith(PREFIX);

export const sealCredential = (value: string): string => {
  const key = getKey();
  if (!key || isSealed(value)) return value;

  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return `${PREFIX}${[iv, cipher.getAuthTag(), ciphertext].map((part) => part.toString('base64url')).join(':')}`;
};

export const openCredential = (value: string): string => {
  if (!isSealed(value)) return value;

  const key = getKey();
  if (!key) {
    throw new CredentialCryptoError(`A stored credential is encrypted but ${ENV_KEY} is not set`);
  }

  const [iv, tag, ciphertext] = value.slice(PREFIX.length).split(':').map((part) => Buffer.from(part, 'base64url'));
  try {
    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
  } catch {
    throw new CredentialCryptoError(`A stored credential could not be decrypted; check ${ENV_KEY}`);
  }
};

export const sealPluginConfig = <T>(config: T): T => mapConfigCredentials(config, sealCredential);
export const openPluginConfig = <T>(config: T): T => mapConfigCredentials(config, openCredential);
export const sealAutomationGraph = <T>(graph: T): T => mapGraphCredentials(graph, sealCredential);
export const openAutomationGraph = <T>(graph: T): T => mapGraphCredentials(graph, openCredential);
