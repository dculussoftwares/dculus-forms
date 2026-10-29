import { promises as dns } from 'node:dns';
import { isIP } from 'node:net';

/**
 * SSRF guard for every outbound request whose destination a user controls (webhook plugin,
 * automation webhook action). Pure classification lives here; the connection itself is pinned to
 * the validated address in `safeFetch.ts`.
 */

export class UnsafeUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnsafeUrlError';
  }
}

export interface UrlGuardOptions {
  /**
   * Permit `http:` and loopback destinations (local mock receivers). Defaults to true only when
   * NODE_ENV is explicitly `test` or `development`; an unset NODE_ENV is treated as production.
   */
  allowLocal?: boolean;
  /** Escape hatch for self-hosted installs whose receivers live on a private network. */
  allowPrivateNetwork?: boolean;
}

export interface SafeTarget {
  url: URL;
  address: string;
  family: 4 | 6;
}

const resolveOptions = (options: UrlGuardOptions = {}): Required<UrlGuardOptions> => ({
  allowLocal:
    options.allowLocal ?? (process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'development'),
  allowPrivateNetwork:
    options.allowPrivateNetwork ?? process.env.OUTBOUND_ALLOW_PRIVATE_NETWORK === 'true',
});

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'metadata',
  'metadata.google.internal',
  'instance-data',
  'kubernetes.default.svc',
]);
const BLOCKED_HOST_SUFFIXES = ['.localhost', '.local', '.internal', '.localdomain', '.home.arpa', '.svc', '.cluster.local'];

const parseIPv4 = (ip: string): number[] | null => {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  const octets = parts.map((p) => (/^\d{1,3}$/.test(p) ? Number(p) : NaN));
  return octets.every((o) => o >= 0 && o <= 255) ? octets : null;
};

/** [network, prefixLength] pairs, each network as a 32-bit unsigned integer. */
const toInt = (o: number[]) => ((o[0] << 24) | (o[1] << 16) | (o[2] << 8) | o[3]) >>> 0;
const v4 = (cidr: string): [number, number] => {
  const [net, prefix] = cidr.split('/');
  return [toInt(parseIPv4(net)!), Number(prefix)];
};

const BLOCKED_V4: Array<[number, number]> = [
  '0.0.0.0/8',
  '10.0.0.0/8',
  '100.64.0.0/10',
  '127.0.0.0/8',
  '169.254.0.0/16',
  '172.16.0.0/12',
  '192.0.0.0/24',
  '192.0.2.0/24',
  '192.88.99.0/24',
  '192.168.0.0/16',
  '198.18.0.0/15',
  '198.51.100.0/24',
  '203.0.113.0/24',
  '224.0.0.0/4',
  '240.0.0.0/4',
].map(v4);

const inV4Cidr = (ip: number, [net, prefix]: [number, number]): boolean => {
  if (prefix === 0) return true;
  const mask = (0xffffffff << (32 - prefix)) >>> 0;
  return (ip & mask) >>> 0 === (net & mask) >>> 0;
};

const isLoopbackV4 = (octets: number[]) => octets[0] === 127;

const isBlockedV4 = (octets: number[], allowLoopback: boolean): boolean => {
  if (allowLoopback && isLoopbackV4(octets)) return false;
  const value = toInt(octets);
  return BLOCKED_V4.some((cidr) => inV4Cidr(value, cidr));
};

/** Expands any textual IPv6 (including `::` and an embedded dotted quad) to 8 16-bit groups. */
const parseIPv6 = (input: string): number[] | null => {
  let ip = input;
  const zone = ip.indexOf('%');
  if (zone !== -1) ip = ip.slice(0, zone);

  const lastColon = ip.lastIndexOf(':');
  if (ip.includes('.')) {
    const quad = parseIPv4(ip.slice(lastColon + 1));
    if (!quad) return null;
    ip = `${ip.slice(0, lastColon + 1)}${((quad[0] << 8) | quad[1]).toString(16)}:${((quad[2] << 8) | quad[3]).toString(16)}`;
  }

  const halves = ip.split('::');
  if (halves.length > 2) return null;
  const parse = (s: string) => (s === '' ? [] : s.split(':'));
  const head = parse(halves[0]);
  const tail = halves.length === 2 ? parse(halves[1]) : [];
  if (halves.length === 1 && head.length !== 8) return null;
  const missing = 8 - head.length - tail.length;
  if (missing < (halves.length === 2 ? 1 : 0)) return null;

  const groups = [...head, ...Array(halves.length === 2 ? missing : 0).fill('0'), ...tail];
  if (groups.length !== 8) return null;
  const numbers = groups.map((g) => (/^[0-9a-fA-F]{1,4}$/.test(g) ? parseInt(g, 16) : NaN));
  return numbers.every((n) => !Number.isNaN(n)) ? numbers : null;
};

const embeddedV4 = (hi: number, lo: number): number[] => [hi >> 8, hi & 0xff, lo >> 8, lo & 0xff];

const isBlockedV6 = (groups: number[], allowLoopback: boolean): boolean => {
  const [g0, g1, g2, g3, g4, g5, g6, g7] = groups;
  const firstFiveZero = g0 === 0 && g1 === 0 && g2 === 0 && g3 === 0 && g4 === 0;

  if (firstFiveZero && g5 === 0 && g6 === 0 && g7 === 1) return !allowLoopback; // ::1
  if (firstFiveZero && g5 === 0 && g6 === 0 && g7 === 0) return true; // ::
  // IPv4-mapped (::ffff:a.b.c.d) and deprecated IPv4-compatible (::a.b.c.d)
  if (firstFiveZero && (g5 === 0xffff || g5 === 0)) return isBlockedV4(embeddedV4(g6, g7), allowLoopback);
  // IPv4-translated (::ffff:0:a.b.c.d)
  if (g0 === 0 && g1 === 0 && g2 === 0 && g3 === 0 && g4 === 0xffff && g5 === 0) {
    return isBlockedV4(embeddedV4(g6, g7), allowLoopback);
  }
  // NAT64 well-known prefix 64:ff9b::/96 maps onto an IPv4 address
  if (g0 === 0x64 && g1 === 0xff9b && g2 === 0 && g3 === 0 && g4 === 0 && g5 === 0) {
    return isBlockedV4(embeddedV4(g6, g7), allowLoopback);
  }
  if (g0 === 0x64 && g1 === 0xff9b && g2 === 1) return true; // local-use NAT64 64:ff9b:1::/48
  if (g0 === 0x2002) return isBlockedV4(embeddedV4(g1, g2), allowLoopback); // 6to4
  if (g0 === 0x2001 && g1 === 0) return true; // Teredo
  if (g0 === 0x2001 && g1 === 0xdb8) return true; // documentation
  if (g0 === 0x2001 && (g1 & 0xfff0) === 0x10) return true; // ORCHID
  if (g0 === 0x100 && g1 === 0 && g2 === 0 && g3 === 0) return true; // discard-only
  if ((g0 & 0xfe00) === 0xfc00) return true; // fc00::/7 unique local
  if ((g0 & 0xffc0) === 0xfe80) return true; // fe80::/10 link-local
  if ((g0 & 0xffc0) === 0xfec0) return true; // fec0::/10 site-local
  if ((g0 & 0xff00) === 0xff00) return true; // multicast
  return false;
};

/** True when `ip` is not a publicly routable unicast address (or is not a valid IP at all). */
export const isBlockedIp = (ip: string, options?: UrlGuardOptions): boolean => {
  const { allowLocal, allowPrivateNetwork } = resolveOptions(options);
  if (allowPrivateNetwork) return false;

  const bare = ip.startsWith('[') && ip.endsWith(']') ? ip.slice(1, -1) : ip;
  const family = isIP(bare);
  if (family === 4) {
    const octets = parseIPv4(bare);
    return octets ? isBlockedV4(octets, allowLocal) : true;
  }
  if (family === 6) {
    const groups = parseIPv6(bare);
    return groups ? isBlockedV6(groups, allowLocal) : true;
  }
  return true;
};

const normaliseHostname = (hostname: string): string => {
  const bare = hostname.startsWith('[') && hostname.endsWith(']') ? hostname.slice(1, -1) : hostname;
  return bare.toLowerCase().replace(/\.+$/, '');
};

/**
 * Synchronous checks: scheme, credentials, and hostnames that are blocked by name or are literal
 * IPs in a blocked range. `new URL` already canonicalises decimal/octal/hex IPv4 forms
 * (`http://2130706433`, `0x7f.1`) to dotted decimal, so they are caught here as literals.
 */
export const parseOutboundUrl = (raw: unknown, options?: UrlGuardOptions): URL => {
  const { allowLocal, allowPrivateNetwork } = resolveOptions(options);

  if (typeof raw !== 'string' || raw.trim() === '' || raw.length > 2048) {
    throw new UnsafeUrlError('URL is missing or too long');
  }

  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new UnsafeUrlError('URL is not valid');
  }

  if (url.protocol !== 'https:' && !(allowLocal && url.protocol === 'http:')) {
    throw new UnsafeUrlError('Only https URLs are allowed');
  }
  if (url.username || url.password) {
    throw new UnsafeUrlError('URLs with embedded credentials are not allowed');
  }

  const hostname = normaliseHostname(url.hostname);
  if (!hostname) throw new UnsafeUrlError('URL has no host');

  if (isIP(hostname)) {
    if (isBlockedIp(hostname, { allowLocal, allowPrivateNetwork })) {
      throw new UnsafeUrlError('URL points to a private or reserved address');
    }
    return url;
  }

  if (!allowPrivateNetwork) {
    const isLocalName = hostname === 'localhost' || hostname.endsWith('.localhost');
    const nameBlocked =
      BLOCKED_HOSTNAMES.has(hostname) || BLOCKED_HOST_SUFFIXES.some((suffix) => hostname.endsWith(suffix));
    if (nameBlocked && !(allowLocal && isLocalName)) {
      throw new UnsafeUrlError('URL points to an internal hostname');
    }
  }

  return url;
};

/**
 * Resolves the host and verifies every address it maps to. Returns one validated address to
 * connect to; connecting to that address (not re-resolving the name) is what defeats DNS rebinding.
 */
export const resolveSafeTarget = async (raw: unknown, options?: UrlGuardOptions): Promise<SafeTarget> => {
  const resolved = resolveOptions(options);
  const url = parseOutboundUrl(raw, resolved);
  const hostname = normaliseHostname(url.hostname);

  const literalFamily = isIP(hostname);
  if (literalFamily) {
    return { url, address: hostname, family: literalFamily as 4 | 6 };
  }

  let addresses: Array<{ address: string; family: number }>;
  try {
    addresses = await dns.lookup(hostname, { all: true, verbatim: true });
  } catch {
    throw new UnsafeUrlError('Host could not be resolved');
  }
  if (addresses.length === 0) throw new UnsafeUrlError('Host could not be resolved');

  // A name with even one blocked record is rejected outright, so an attacker cannot mix a public
  // and an internal record and rely on which one the connection happens to pick.
  if (addresses.some(({ address }) => isBlockedIp(address, resolved))) {
    throw new UnsafeUrlError('URL resolves to a private or reserved address');
  }

  // IPv4 first: a single pinned address gets no happy-eyeballs fallback, and v4 is the safer bet.
  const first = addresses.find(({ family }) => family === 4) ?? addresses[0];
  return { url, address: first.address, family: first.family === 6 ? 6 : 4 };
};

/**
 * Save-time validation. A hostname that does not resolve yet is accepted (it may be provisioned
 * later and is fully re-checked at send time); anything that resolves into a blocked range is not.
 */
export const assertOutboundUrlAllowed = async (raw: unknown, options?: UrlGuardOptions): Promise<void> => {
  try {
    await resolveSafeTarget(raw, options);
  } catch (error) {
    if (error instanceof UnsafeUrlError && error.message === 'Host could not be resolved') return;
    throw error;
  }
};

/** Synchronous message-or-null form of {@link parseOutboundUrl}, for zod refinements. */
export const outboundUrlProblem = (raw: unknown, options?: UrlGuardOptions): string | null => {
  try {
    parseOutboundUrl(raw, options);
    return null;
  } catch (error) {
    return error instanceof UnsafeUrlError ? error.message : 'URL is not valid';
  }
};
