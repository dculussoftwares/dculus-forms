/**
 * Browser product analytics through self-hosted OpenPanel.
 *
 * Events go through a first-party path on each site's own domain (default `/_e`): the SDK
 * script is `<apiUrl>/op1.js` and events are posted to `<apiUrl>/track`. A Cloudflare Worker
 * forwards that path to the OpenPanel API.
 *
 * Every function is a silent no-op until `initOpenPanel` runs with a client id, so local dev
 * (no `VITE_OPENPANEL_CLIENT_ID`) and tests never load the script or send anything.
 *
 * Privacy: identify with the internal user id only, and never pass emails, names or form
 * answers as event properties. The SDK attaches full page URLs on its own, so every outgoing
 * payload is passed through `sanitizeAnalyticsUrl` first.
 */

export type AnalyticsProperties = Record<string, string | number | boolean | null | undefined>;

export interface OpenPanelBrowserConfig {
  /** OpenPanel client id. When empty, analytics stays disabled. */
  clientId?: string;
  /** First-party API path or URL. Defaults to `/_e`. */
  apiUrl?: string;
  /** Which app is sending, added to every event as the `app` property. */
  app: string;
}

type OpenPanelQueue = ((...args: unknown[]) => void) & { q?: unknown[][] };

interface OutgoingEvent {
  payload?: { properties?: Record<string, unknown> };
}

interface BrowserGlobals {
  op?: OpenPanelQueue;
  location?: { hostname?: string };
  document?: {
    createElement(tag: 'script'): { src: string; async: boolean; defer: boolean };
    head?: { appendChild(node: unknown): unknown };
  };
}

export const DEFAULT_OPENPANEL_API_URL = '/_e';

let enabled = false;

function browser(): BrowserGlobals {
  return globalThis as unknown as BrowserGlobals;
}

/** `dev` on the `*-dev.` hosts, `local` on localhost, otherwise `prod`. */
export function analyticsEnvironment(hostname: string | undefined): 'dev' | 'local' | 'prod' {
  const host = (hostname ?? '').toLowerCase();
  if (!host || host === 'localhost' || host === '127.0.0.1') return 'local';
  return host.includes('-dev.') ? 'dev' : 'prod';
}

const URL_PROPERTIES = ['__path', '__referrer'] as const;

/** Standard campaign keys with a plain value: no `@` or percent-encoding, so no emails. */
const SAFE_CAMPAIGN_PARAM = /^utm_(?:source|medium|campaign|term|content)=[\w.+~-]{1,100}$/;

/**
 * Removes everything from a URL that can carry secrets or personal data: the query string
 * (magic-link, reset and one-time sign-in tokens, emails, AI chat text, search terms), the
 * fragment (OAuth values) and invitation ids in the path. Standard `utm_*` parameters with
 * plain values are kept for campaign attribution.
 */
export function sanitizeAnalyticsUrl(url: string): string {
  const [withoutHash = ''] = url.split('#');
  const queryStart = withoutHash.indexOf('?');
  const base = queryStart === -1 ? withoutHash : withoutHash.slice(0, queryStart);
  const query = queryStart === -1 ? '' : withoutHash.slice(queryStart + 1);
  const campaign = query
    .split('&')
    .filter((pair) => SAFE_CAMPAIGN_PARAM.test(pair))
    .join('&');
  const path = base.replace(/\/invite\/[^/]+/, '/invite/redacted');
  return campaign ? `${path}?${campaign}` : path;
}

/**
 * SDK `filter` hook. The SDK sends the same object it passes here, so cleaning it in place
 * is what keeps raw URLs off the wire. Always returns true: no event is dropped.
 */
function sanitizeOutgoingEvent(event: OutgoingEvent): boolean {
  const properties = event?.payload?.properties;
  if (properties) {
    for (const key of URL_PROPERTIES) {
      const value = properties[key];
      if (typeof value === 'string') properties[key] = sanitizeAnalyticsUrl(value);
    }
  }
  return true;
}

function trimTrailingSlashes(value: string): string {
  let end = value.length;
  while (end > 0 && value[end - 1] === '/') end -= 1;
  return value.slice(0, end);
}

function call(method: string, ...args: unknown[]): void {
  if (!enabled) return;
  try {
    browser().op?.(method, ...args);
  } catch {
    // Analytics must never break the app.
  }
}

/**
 * Loads the OpenPanel script and initialises tracking. Page views (including SPA route
 * changes, via history patching in the SDK) are tracked automatically. Returns whether
 * analytics is enabled.
 */
export function initOpenPanel(config: OpenPanelBrowserConfig): boolean {
  const g = browser();
  if (enabled) return true;
  if (!config.clientId || !g.document) return false;

  try {
    const apiUrl = trimTrailingSlashes(config.apiUrl || DEFAULT_OPENPANEL_API_URL);

    // Queue stub: calls made before the script loads are replayed by it.
    if (!g.op) {
      const queue: OpenPanelQueue = (...args: unknown[]) => {
        (queue.q = queue.q || []).push(args);
      };
      g.op = queue;
    }

    g.op('init', {
      apiUrl,
      clientId: config.clientId,
      trackScreenViews: true,
      // Off on purpose: both send link targets, link text or element attributes, which in
      // these apps can contain respondents' answers.
      trackOutgoingLinks: false,
      trackAttributes: false,
      filter: sanitizeOutgoingEvent,
    });
    g.op('setGlobalProperties', {
      app: config.app,
      environment: analyticsEnvironment(g.location?.hostname),
    });

    const script = g.document.createElement('script');
    script.src = `${apiUrl}/op1.js`;
    script.async = true;
    script.defer = true;
    g.document.head?.appendChild(script);

    enabled = true;
  } catch {
    enabled = false;
  }
  return enabled;
}

/** Tracks a product event (snake_case name). No-op when analytics is disabled. */
export function trackEvent(name: string, properties?: AnalyticsProperties): void {
  call('track', name, properties ?? {});
}

/** Associates later events with an internal user id. Never pass email or name. */
export function identifyUser(userId: string | null | undefined): void {
  if (!userId) return;
  call('identify', { profileId: userId });
}

/** Forgets the identified user (on sign-out). */
export function clearAnalyticsUser(): void {
  call('clear');
}

/** Test helper: resets module state. */
export function __resetOpenPanelForTests(): void {
  enabled = false;
}
