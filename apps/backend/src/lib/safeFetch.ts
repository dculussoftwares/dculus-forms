import http from 'node:http';
import https from 'node:https';
import { isIP } from 'node:net';
import { resolveSafeTarget, UnsafeUrlError, type UrlGuardOptions } from './urlGuard.js';

export { UnsafeUrlError } from './urlGuard.js';

export const DEFAULT_TIMEOUT_MS = 10_000;
export const DEFAULT_MAX_RESPONSE_BYTES = 16 * 1024;

export interface SafeFetchOptions extends UrlGuardOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  timeoutMs?: number;
  /** Bytes of the response body to read before the connection is dropped. */
  maxResponseBytes?: number;
}

export interface SafeFetchResponse {
  status: number;
  statusText: string;
  headers: http.IncomingHttpHeaders;
  /** At most `maxResponseBytes` of the body, decoded as UTF-8. */
  body: string;
  truncated: boolean;
}

// Controlled by this module, never by the caller's configured headers.
const MANAGED_HEADERS = new Set(['host', 'content-length', 'transfer-encoding', 'connection']);

/**
 * Outbound HTTP(S) request that is safe to point at a user-supplied URL:
 *  - the URL is validated and DNS is resolved up front, every record must be public;
 *  - the connection goes to that validated address, so a second (rebound) DNS answer is never used;
 *  - redirects are never followed — a 3xx is returned to the caller as an ordinary result;
 *  - the whole exchange is bounded by a timeout and the response body by a byte cap.
 */
export const safeFetch = async (rawUrl: string, options: SafeFetchOptions = {}): Promise<SafeFetchResponse> => {
  const { allowLocal, allowPrivateNetwork } = options;
  const target = await resolveSafeTarget(rawUrl, { allowLocal, allowPrivateNetwork });
  const { url, address, family } = target;

  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxBytes = options.maxResponseBytes ?? DEFAULT_MAX_RESPONSE_BYTES;
  const isHttps = url.protocol === 'https:';

  const headers: Record<string, string> = {};
  for (const [name, value] of Object.entries(options.headers ?? {})) {
    if (!MANAGED_HEADERS.has(name.toLowerCase())) headers[name] = value;
  }
  headers.Host = url.host;
  if (options.body !== undefined) headers['Content-Length'] = String(Buffer.byteLength(options.body));

  const hostname = url.hostname.startsWith('[') ? url.hostname.slice(1, -1) : url.hostname;

  return new Promise<SafeFetchResponse>((resolve, reject) => {
    const requestOptions: https.RequestOptions = {
      host: address,
      family,
      port: url.port ? Number(url.port) : isHttps ? 443 : 80,
      path: `${url.pathname}${url.search}`,
      method: options.method ?? 'GET',
      headers,
      signal: AbortSignal.timeout(timeoutMs),
      agent: false,
    };
    // TLS must validate the certificate against the name the user wrote, not the pinned IP.
    if (isHttps && !isIP(hostname)) requestOptions.servername = hostname;

    const req = (isHttps ? https : http).request(requestOptions, (res) => {
      const chunks: Buffer[] = [];
      let received = 0;
      let truncated = false;

      const finish = () =>
        resolve({
          status: res.statusCode ?? 0,
          statusText: res.statusMessage ?? '',
          headers: res.headers,
          body: Buffer.concat(chunks).toString('utf8'),
          truncated,
        });

      // A 3xx is a result, not an instruction: its body is never needed.
      if ((res.statusCode ?? 0) >= 300 && (res.statusCode ?? 0) < 400) {
        res.destroy();
        finish();
        return;
      }

      res.on('data', (chunk: Buffer) => {
        const room = maxBytes - received;
        if (room <= 0) return;
        if (chunk.length > room) {
          chunks.push(chunk.subarray(0, room));
          received += room;
          truncated = true;
          res.destroy();
          finish();
          return;
        }
        chunks.push(chunk);
        received += chunk.length;
      });
      res.on('end', finish);
      res.on('error', (error) => {
        if (received > 0) finish();
        else reject(error);
      });
      res.on('close', finish);
    });

    req.on('error', reject);
    if (options.body !== undefined) req.write(options.body);
    req.end();
  });
};

/** Short, receiver-controlled text safe to keep in delivery history: collapsed and truncated. */
export const toExcerpt = (body: string | null | undefined, maxChars = 200): string | undefined => {
  if (!body) return undefined;
  const collapsed = body.replace(/\s+/g, ' ').trim();
  if (!collapsed) return undefined;
  return collapsed.length > maxChars ? `${collapsed.slice(0, maxChars)}…` : collapsed;
};

export const describeFetchFailure = (error: unknown): string => {
  if (error instanceof UnsafeUrlError) return `Webhook URL is not allowed: ${error.message}`;
  const name = (error as { name?: string })?.name;
  if (name === 'TimeoutError' || name === 'AbortError') return 'Webhook request timed out';
  // The underlying socket error (refused vs unreachable vs reset) would let a caller map internal
  // hosts and ports, so it is logged by the caller and not surfaced.
  return 'Webhook request failed';
};
