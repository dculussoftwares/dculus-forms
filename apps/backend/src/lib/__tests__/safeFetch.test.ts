import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { UnsafeUrlError, describeFetchFailure, safeFetch, toExcerpt } from '../safeFetch.js';

const LOCAL = { allowLocal: true, allowPrivateNetwork: false };

describe('safeFetch', () => {
  let server: http.Server;
  let baseUrl: string;
  const seen: Array<{ method?: string; headers: http.IncomingHttpHeaders; body: string }> = [];

  beforeAll(async () => {
    server = http.createServer((req, res) => {
      let body = '';
      req.on('data', (chunk) => (body += chunk));
      req.on('end', () => {
        seen.push({ method: req.method, headers: req.headers, body });
        if (req.url === '/redirect') {
          res.writeHead(302, { Location: 'http://169.254.169.254/latest/meta-data/' });
          res.end('redirecting');
        } else if (req.url === '/big') {
          res.writeHead(200);
          res.end('a'.repeat(100_000));
        } else if (req.url === '/slow') {
          setTimeout(() => res.end('late'), 2000);
        } else {
          res.writeHead(200, { 'Content-Type': 'text/plain' });
          res.end('ok');
        }
      });
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    server.closeAllConnections?.();
    await new Promise((resolve) => server.close(resolve));
  });

  it('sends the request and returns status and body', async () => {
    const response = await safeFetch(`${baseUrl}/hook`, {
      ...LOCAL,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Custom': 'yes' },
      body: '{"a":1}',
    });

    expect(response).toMatchObject({ status: 200, body: 'ok', truncated: false });
    const last = seen[seen.length - 1];
    expect(last.method).toBe('POST');
    expect(last.body).toBe('{"a":1}');
    expect(last.headers['x-custom']).toBe('yes');
    expect(last.headers.host).toBe(new URL(baseUrl).host);
  });

  it('does not let a configured header override Host or Content-Length', async () => {
    await safeFetch(`${baseUrl}/hook`, {
      ...LOCAL,
      method: 'POST',
      headers: { Host: 'internal.service', 'Content-Length': '1' },
      body: 'abcdef',
    });
    const last = seen[seen.length - 1];
    expect(last.headers.host).toBe(new URL(baseUrl).host);
    expect(last.body).toBe('abcdef');
  });

  it('does not follow redirects', async () => {
    const before = seen.length;
    const response = await safeFetch(`${baseUrl}/redirect`, LOCAL);
    expect(response.status).toBe(302);
    expect(response.headers.location).toContain('169.254.169.254');
    expect(response.body).toBe('');
    expect(seen.length).toBe(before + 1);
  });

  it('caps how much of the response body is read', async () => {
    const response = await safeFetch(`${baseUrl}/big`, { ...LOCAL, maxResponseBytes: 1024 });
    expect(response.body.length).toBe(1024);
    expect(response.truncated).toBe(true);
  });

  it('aborts when the receiver is too slow', async () => {
    await expect(safeFetch(`${baseUrl}/slow`, { ...LOCAL, timeoutMs: 200 })).rejects.toMatchObject({
      name: expect.stringMatching(/TimeoutError|AbortError/),
    });
  });

  it('refuses loopback and plain http outside local mode', async () => {
    await expect(safeFetch(baseUrl, { allowLocal: false, allowPrivateNetwork: false })).rejects.toThrow(UnsafeUrlError);
  });

  it('refuses a destination the guard blocks before connecting', async () => {
    const before = seen.length;
    await expect(safeFetch('http://169.254.169.254/latest/meta-data/', LOCAL)).rejects.toThrow(UnsafeUrlError);
    expect(seen.length).toBe(before);
  });

  describe('helpers', () => {
    it('toExcerpt collapses whitespace and truncates', () => {
      expect(toExcerpt('  a \n\n b  ')).toBe('a b');
      expect(toExcerpt('x'.repeat(500), 200)).toHaveLength(201);
      expect(toExcerpt('')).toBeUndefined();
      expect(toExcerpt(undefined)).toBeUndefined();
    });

    it('describeFetchFailure never exposes socket details', () => {
      expect(describeFetchFailure(new Error('connect ECONNREFUSED 10.0.0.5:6379'))).toBe('Webhook request failed');
      expect(describeFetchFailure(Object.assign(new Error('x'), { name: 'TimeoutError' }))).toBe(
        'Webhook request timed out'
      );
      expect(describeFetchFailure(new UnsafeUrlError('Private address'))).toBe(
        'Webhook URL is not allowed: Private address'
      );
    });
  });
});
