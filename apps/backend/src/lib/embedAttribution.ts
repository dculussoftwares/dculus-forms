/**
 * Server-side sanitisation of the two embed-attribution fields that ride along
 * with `trackFormView` / `trackFormSubmission`.
 *
 * Both arrive from the form-viewer running inside someone else's page, so both
 * are attacker-controlled: the host page can post any `hostname` it likes over
 * `postMessage`, and the query string of `/embed/:shortUrl` is equally open.
 * Neither value is ever a trust decision — they exist only to answer "where is
 * this form being filled in?" in the analytics view — but they are stored and
 * later rendered, so they get normalised down to a small, boring shape here.
 *
 * @see docs/form-embed-v1-spec.md §8, §10.2
 */

export type EmbedContext = 'direct' | 'inline' | 'lightbox' | 'iframe';

const EMBED_CONTEXTS: readonly string[] = ['direct', 'inline', 'lightbox', 'iframe'];

/**
 * Generous cap: the longest real hostnames are ~253 chars (DNS limit), and
 * anything longer is not a hostname.
 */
const MAX_HOST_LENGTH = 253;

/**
 * Hostnames only — labels of alphanumerics and hyphens joined by dots, plus
 * bare `localhost` and IPv4 for local/dev host pages. Deliberately rejects
 * schemes, paths, query strings, credentials, ports and IPv6 brackets: storing
 * a full parent URL would store whatever PII its query string carried, which
 * is exactly what this feature must not do.
 */
const HOSTNAME_PATTERN = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*$/;

export function sanitizeEmbedContext(value: unknown): EmbedContext | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  return EMBED_CONTEXTS.includes(normalized) ? (normalized as EmbedContext) : null;
}

export function sanitizeEmbedHost(value: unknown): string | null {
  if (typeof value !== 'string') return null;

  let host = value.trim().toLowerCase();
  if (!host || host.length > MAX_HOST_LENGTH) return null;

  // Reject anything that is more than a host before touching it. Without this,
  // stripping at the last colon turns "https://example.com" into "https",
  // which then passes the hostname test and gets stored as a real answer.
  if (/[/\\@?#]/.test(host)) return null;

  // Tolerate a port suffix ("example.com:3000") by dropping it, since a host
  // page on a dev port is a legitimate embed and the port tells us nothing.
  // Only a genuinely numeric suffix counts, so "https:" is not mistaken for one.
  const portMatch = host.match(/^(.*):(\d+)$/);
  if (portMatch) host = portMatch[1];

  return HOSTNAME_PATTERN.test(host) ? host : null;
}

export interface EmbedAttribution {
  embedContext: EmbedContext | null;
  embedHost: string | null;
}

/**
 * Normalises a client-supplied pair into what gets written to the analytics
 * tables. A view with no embed information at all stays `null`/`null` rather
 * than being written as `'direct'` — existing rows predate this feature and
 * are also null, so the query layer has one case to read, not two.
 *
 * A host is only meaningful alongside a framed context, so `direct` never
 * carries one.
 */
export function sanitizeEmbedAttribution(input: {
  embedContext?: unknown;
  embedHost?: unknown;
}): EmbedAttribution {
  const embedContext = sanitizeEmbedContext(input.embedContext);
  if (embedContext === null || embedContext === 'direct') {
    return { embedContext, embedHost: null };
  }
  return { embedContext, embedHost: sanitizeEmbedHost(input.embedHost) };
}
