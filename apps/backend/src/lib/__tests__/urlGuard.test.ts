import { describe, it, expect, vi, beforeEach } from 'vitest';

const lookup = vi.fn();
vi.mock('node:dns', () => ({ promises: { lookup: (...args: unknown[]) => lookup(...args) } }));

import {
  UnsafeUrlError,
  assertOutboundUrlAllowed,
  isBlockedIp,
  outboundUrlProblem,
  parseOutboundUrl,
  resolveSafeTarget,
} from '../urlGuard.js';

const STRICT = { allowLocal: false, allowPrivateNetwork: false };

describe('urlGuard', () => {
  beforeEach(() => {
    lookup.mockReset();
  });

  describe('isBlockedIp', () => {
    it.each([
      '0.0.0.0',
      '10.0.0.1',
      '100.64.0.1',
      '100.127.255.254',
      '127.0.0.1',
      '127.255.255.255',
      '169.254.169.254',
      '172.16.0.1',
      '172.31.255.255',
      '192.0.0.1',
      '192.168.1.1',
      '198.18.0.1',
      '224.0.0.1',
      '240.0.0.1',
      '255.255.255.255',
      '::',
      '::1',
      '::ffff:127.0.0.1',
      '::ffff:7f00:1',
      '::ffff:169.254.169.254',
      '::ffff:a9fe:a9fe',
      '::127.0.0.1',
      '64:ff9b::7f00:1',
      '64:ff9b::a9fe:a9fe',
      '2002:7f00:1::',
      '2002:a9fe:a9fe::1',
      'fc00::1',
      'fd00:ec2::254',
      'fe80::1',
      'ff02::1',
      '2001:db8::1',
      '2001::1',
    ])('blocks %s', (ip) => {
      expect(isBlockedIp(ip, STRICT)).toBe(true);
    });

    it.each(['8.8.8.8', '1.1.1.1', '93.184.216.34', '172.32.0.1', '100.63.255.255', '2606:4700:4700::1111', '::ffff:8.8.8.8'])(
      'allows public address %s',
      (ip) => {
        expect(isBlockedIp(ip, STRICT)).toBe(false);
      }
    );

    it('allows loopback only in local mode, never metadata or RFC1918', () => {
      expect(isBlockedIp('127.0.0.1', { allowLocal: true, allowPrivateNetwork: false })).toBe(false);
      expect(isBlockedIp('::1', { allowLocal: true, allowPrivateNetwork: false })).toBe(false);
      expect(isBlockedIp('169.254.169.254', { allowLocal: true, allowPrivateNetwork: false })).toBe(true);
      expect(isBlockedIp('10.0.0.1', { allowLocal: true, allowPrivateNetwork: false })).toBe(true);
    });

    it('allows private ranges with the explicit private-network flag', () => {
      expect(isBlockedIp('10.0.0.1', { allowLocal: false, allowPrivateNetwork: true })).toBe(false);
    });
  });

  describe('parseOutboundUrl', () => {
    it.each([
      ['http scheme', 'http://example.com/hook'],
      ['ftp scheme', 'ftp://example.com/'],
      ['file scheme', 'file:///etc/passwd'],
      ['javascript scheme', 'javascript:alert(1)'],
      ['credentials', 'https://user:pass@example.com/hook'],
      ['username only', 'https://user@example.com/hook'],
      ['loopback literal', 'https://127.0.0.1/hook'],
      ['loopback whole /8', 'https://127.1.2.3/hook'],
      ['decimal IPv4', 'https://2130706433/hook'],
      ['hex IPv4', 'https://0x7f000001/hook'],
      ['octal IPv4', 'https://017700000001/hook'],
      ['dotted octal IPv4', 'https://0177.0.0.1/hook'],
      ['short IPv4', 'https://127.1/hook'],
      ['metadata IPv4', 'https://169.254.169.254/latest/meta-data/'],
      ['metadata decimal', 'https://2852039166/latest/meta-data/'],
      ['metadata hex', 'https://0xa9fea9fe/'],
      ['IPv6 loopback', 'https://[::1]/hook'],
      ['IPv4-mapped IPv6', 'https://[::ffff:127.0.0.1]/hook'],
      ['IPv4-mapped IPv6 hex', 'https://[::ffff:7f00:1]/hook'],
      ['IPv4-mapped metadata', 'https://[::ffff:169.254.169.254]/'],
      ['ULA', 'https://[fd00::1]/hook'],
      ['link-local IPv6', 'https://[fe80::1]/hook'],
      ['RFC1918 10/8', 'https://10.1.2.3/hook'],
      ['RFC1918 172.16/12', 'https://172.20.0.1/hook'],
      ['RFC1918 192.168/16', 'https://192.168.0.10/hook'],
      ['CGNAT', 'https://100.100.100.200/hook'],
      ['unspecified', 'https://0.0.0.0/hook'],
      ['localhost', 'https://localhost/hook'],
      ['localhost trailing dot', 'https://localhost./hook'],
      ['localhost uppercase', 'https://LOCALHOST/hook'],
      ['localhost subdomain', 'https://evil.localhost/hook'],
      ['.local', 'https://printer.local/hook'],
      ['.internal', 'https://db.internal/hook'],
      ['GCP metadata name', 'https://metadata.google.internal/computeMetadata/v1/'],
      ['k8s service', 'https://kubernetes.default.svc/'],
      ['cluster.local', 'https://redis.default.svc.cluster.local/'],
      ['empty', ''],
      ['not a URL', 'not a url'],
      ['oversized', `https://example.com/${'a'.repeat(3000)}`],
    ])('rejects %s', (_label, url) => {
      expect(() => parseOutboundUrl(url, STRICT)).toThrow(UnsafeUrlError);
      expect(outboundUrlProblem(url, STRICT)).toEqual(expect.any(String));
    });

    it('rejects non-string input', () => {
      expect(() => parseOutboundUrl(undefined, STRICT)).toThrow(UnsafeUrlError);
      expect(() => parseOutboundUrl({ href: 'https://example.com' }, STRICT)).toThrow(UnsafeUrlError);
    });

    it.each(['https://example.com/hook', 'https://hooks.example.com:8443/a?b=c', 'https://8.8.8.8/hook'])(
      'accepts %s',
      (url) => {
        expect(parseOutboundUrl(url, STRICT).href).toContain('https://');
        expect(outboundUrlProblem(url, STRICT)).toBeNull();
      }
    );

    it('allows http and loopback only in local mode', () => {
      const local = { allowLocal: true, allowPrivateNetwork: false };
      expect(() => parseOutboundUrl('http://localhost:9825/automation-webhook', local)).not.toThrow();
      expect(() => parseOutboundUrl('http://127.0.0.1:9825/x', local)).not.toThrow();
      expect(() => parseOutboundUrl('http://169.254.169.254/', local)).toThrow(UnsafeUrlError);
      expect(() => parseOutboundUrl('http://user:pw@localhost/', local)).toThrow(UnsafeUrlError);
    });
  });

  describe('resolveSafeTarget', () => {
    it('returns the validated address to pin', async () => {
      lookup.mockResolvedValue([{ address: '93.184.216.34', family: 4 }]);
      const target = await resolveSafeTarget('https://example.com/hook', STRICT);
      expect(target).toMatchObject({ address: '93.184.216.34', family: 4 });
      expect(target.url.hostname).toBe('example.com');
    });

    it('prefers an IPv4 record when both families resolve', async () => {
      lookup.mockResolvedValue([
        { address: '2606:4700:4700::1111', family: 6 },
        { address: '93.184.216.34', family: 4 },
      ]);
      await expect(resolveSafeTarget('https://example.com/', STRICT)).resolves.toMatchObject({
        address: '93.184.216.34',
        family: 4,
      });
    });

    it('rejects a public-looking name that resolves to a private address', async () => {
      lookup.mockResolvedValue([{ address: '10.0.0.7', family: 4 }]);
      await expect(resolveSafeTarget('https://rebind.example.com/', STRICT)).rejects.toThrow(UnsafeUrlError);
    });

    it('rejects a name resolving to the metadata address', async () => {
      lookup.mockResolvedValue([{ address: '169.254.169.254', family: 4 }]);
      await expect(resolveSafeTarget('https://evil.example.com/', STRICT)).rejects.toThrow(UnsafeUrlError);
    });

    it('rejects when any record is private, even if another is public', async () => {
      lookup.mockResolvedValue([
        { address: '93.184.216.34', family: 4 },
        { address: '127.0.0.1', family: 4 },
      ]);
      await expect(resolveSafeTarget('https://mixed.example.com/', STRICT)).rejects.toThrow(UnsafeUrlError);
    });

    it('rejects a name resolving to an IPv4-mapped IPv6 loopback', async () => {
      lookup.mockResolvedValue([{ address: '::ffff:127.0.0.1', family: 6 }]);
      await expect(resolveSafeTarget('https://mapped.example.com/', STRICT)).rejects.toThrow(UnsafeUrlError);
    });

    it('does not resolve or accept literal private IPs', async () => {
      await expect(resolveSafeTarget('https://10.0.0.1/', STRICT)).rejects.toThrow(UnsafeUrlError);
      expect(lookup).not.toHaveBeenCalled();
    });

    it('rejects a name that does not resolve', async () => {
      lookup.mockRejectedValue(Object.assign(new Error('ENOTFOUND'), { code: 'ENOTFOUND' }));
      await expect(resolveSafeTarget('https://nope.example.com/', STRICT)).rejects.toThrow(UnsafeUrlError);
    });
  });

  describe('assertOutboundUrlAllowed (save time)', () => {
    it('accepts a public host', async () => {
      lookup.mockResolvedValue([{ address: '93.184.216.34', family: 4 }]);
      await expect(assertOutboundUrlAllowed('https://example.com/hook', STRICT)).resolves.toBeUndefined();
    });

    it('does not block saving a not-yet-resolvable host (it is re-checked at send time)', async () => {
      lookup.mockRejectedValue(Object.assign(new Error('ENOTFOUND'), { code: 'ENOTFOUND' }));
      await expect(assertOutboundUrlAllowed('https://not-yet.example.com/', STRICT)).resolves.toBeUndefined();
    });

    it('rejects private targets', async () => {
      await expect(assertOutboundUrlAllowed('https://192.168.1.1/', STRICT)).rejects.toThrow(UnsafeUrlError);
      lookup.mockResolvedValue([{ address: '172.16.5.5', family: 4 }]);
      await expect(assertOutboundUrlAllowed('https://internal.example.com/', STRICT)).rejects.toThrow(UnsafeUrlError);
    });
  });
});
