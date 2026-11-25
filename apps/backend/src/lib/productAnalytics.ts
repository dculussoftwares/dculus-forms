import { OpenPanel } from '@openpanel/sdk';
import { logger } from './logger.js';

/**
 * Server-side product analytics through self-hosted OpenPanel.
 *
 * - No-op unless OPENPANEL_CLIENT_ID and OPENPANEL_CLIENT_SECRET are set.
 * - Fire-and-forget: `trackServerEvent` returns void, never throws, and never
 *   blocks the request path. Failures are logged at debug level only.
 * - Privacy: profileId is the internal user id; properties are limited to
 *   primitive values and keys that look like personal data (emails, names,
 *   answers) are dropped defensively.
 *
 * This runs alongside the existing form view/submission analytics
 * (analyticsService), which it does not replace.
 */

export const DEFAULT_OPENPANEL_API_URL = 'https://analytics.dculus.com/api';

export type ProductEventName =
  | 'user_signed_up'
  | 'organization_created'
  | 'form_created'
  | 'form_published'
  | 'response_submitted'
  | 'subscription_changed'
  | 'ai_credits_used';

export type ProductEventProperties = Record<string, string | number | boolean | null | undefined>;

export interface TrackServerEventOptions {
  /** Internal user id (never an email). */
  profileId?: string | null;
  properties?: ProductEventProperties;
}

const PII_KEY_PATTERN = /e-?mail|(^|_)name$|first_?name|last_?name|full_?name|phone|answers?|response_?data|^data$/i;

let client: OpenPanel | null | undefined;

/** `dev` for *-dev.* hosts, `local` for localhost, otherwise `prod`. */
export function serverEnvironment(baseUrl = process.env.BETTER_AUTH_URL): 'dev' | 'local' | 'prod' {
  let host = '';
  try {
    host = baseUrl ? new URL(baseUrl).hostname.toLowerCase() : '';
  } catch {
    host = '';
  }
  if (!host || host === 'localhost' || host === '127.0.0.1') return 'local';
  return host.includes('-dev.') ? 'dev' : 'prod';
}

function getClient(): OpenPanel | null {
  if (client !== undefined) return client;

  const clientId = process.env.OPENPANEL_CLIENT_ID;
  const clientSecret = process.env.OPENPANEL_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    client = null;
    return client;
  }

  client = new OpenPanel({
    clientId,
    clientSecret,
    apiUrl: process.env.OPENPANEL_API_URL || DEFAULT_OPENPANEL_API_URL,
  });
  client.setGlobalProperties({ app: 'backend', environment: serverEnvironment() });
  return client;
}

/** Keeps primitive values with non-personal keys. */
export function sanitizeProperties(properties: ProductEventProperties = {}): ProductEventProperties {
  const clean: ProductEventProperties = {};
  for (const [key, value] of Object.entries(properties)) {
    if (PII_KEY_PATTERN.test(key)) continue;
    if (value === undefined) continue;
    if (value === null || ['string', 'number', 'boolean'].includes(typeof value)) {
      clean[key] = value;
    }
  }
  return clean;
}

export function isProductAnalyticsEnabled(): boolean {
  return getClient() !== null;
}

/** Fire-and-forget product event. Never throws, never awaited by callers. */
export function trackServerEvent(name: ProductEventName, options: TrackServerEventOptions = {}): void {
  try {
    const openpanel = getClient();
    if (!openpanel) return;

    const properties: Record<string, unknown> = sanitizeProperties(options.properties);
    // Per-event profileId: the client is shared across requests, so never call identify() on it.
    if (options.profileId) properties.profileId = options.profileId;

    void Promise.resolve(openpanel.track(name, properties)).catch((error: unknown) => {
      logger.debug(`[ProductAnalytics] Failed to send ${name}:`, error);
    });
  } catch (error) {
    logger.debug(`[ProductAnalytics] Failed to track ${name}:`, error);
  }
}

/** Test helper: forget the cached client so env changes take effect. */
export function resetProductAnalyticsForTests(): void {
  client = undefined;
}
