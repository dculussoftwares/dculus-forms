// @vitest-environment node
import { readFileSync } from 'fs';
import path from 'path';
import { describe, it, expect, beforeEach, vi } from 'vitest';

// public/_worker.js is plain JS shipped verbatim to Cloudflare Pages.
const worker: any = (await import(/* @vite-ignore */ path.resolve(__dirname, '../../public/_worker.js'))).default;
const t = worker._test;

const SHELL = '<!doctype html><html><head><meta charset="UTF-8" /><title>Dculus Forms</title></head><body><div id="root"></div></body></html>';
const META = {
  title: 'Team "lunch" <survey>',
  description: 'Pick a place & time',
  imageUrl: 'https://api.example.com/og/forms/abc123.png?v=1',
  imageAlt: 'Team lunch survey — online form',
};

const env = (config = 'window.__APP_CONFIG__ = {"VITE_API_URL":"https://api.example.com/"};') => ({
  ASSETS: {
    fetch: vi.fn(async (req: Request) => {
      const { pathname } = new URL(req.url);
      if (pathname === '/config.js') return new Response(config, { headers: { 'content-type': 'application/javascript' } });
      return new Response(SHELL, { headers: { 'content-type': 'text/html; charset=utf-8', etag: '"x"' } });
    }),
  },
});

const ok = (body: unknown) => vi.fn(async () => new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } }));

describe('form-viewer share worker', () => {
  beforeEach(() => t.reset());

  it('keeps SECURITY_HEADERS identical to the /* block in _headers', () => {
    const file = readFileSync(path.resolve(__dirname, '../../public/_headers'), 'utf8');
    const block = file.split(/\n(?=\/)/).find((b) => b.startsWith('/*\n'))!;
    const headers = Object.fromEntries(
      block
        .split('\n')
        .slice(1)
        .map((l) => l.trim())
        .filter((l) => l && !l.startsWith('#'))
        .map((l) => [l.slice(0, l.indexOf(':')), l.slice(l.indexOf(':') + 1).trim()])
    );
    expect(headers).toEqual(t.SECURITY_HEADERS);
  });

  it('only handles /f/<shortUrl>', () => {
    expect(t.shortUrlFromPath('/f/abc123')).toBe('abc123');
    expect(t.shortUrlFromPath('/f/abc123/')).toBe('abc123');
    expect(t.shortUrlFromPath('/f/abc123/result')).toBeNull();
    expect(t.shortUrlFromPath('/f/')).toBeNull();
  });

  it('reads the API URL from config.js', () => {
    expect(t.apiUrlFromConfig('window.__APP_CONFIG__ = {"VITE_API_URL":"https://x.dev/"};')).toBe('https://x.dev');
    expect(t.apiUrlFromConfig('window.__APP_CONFIG__ = window.__APP_CONFIG__ || {};')).toBeNull();
    expect(t.apiUrlFromConfig('garbage')).toBeNull();
  });

  it('injects escaped og/twitter tags and the form title', async () => {
    const fetchImpl = ok(META);
    const res = await t.handle(new Request('https://forms.example.com/f/abc123?utm=x'), env(), fetchImpl);
    const html = await res.text();
    expect(fetchImpl).toHaveBeenCalledWith('https://api.example.com/og/forms/abc123.json', expect.anything());
    expect(html).toContain('<title>Team &quot;lunch&quot; &lt;survey&gt;</title>');
    expect(html).toContain('<meta property="og:image" content="https://api.example.com/og/forms/abc123.png?v=1">');
    expect(html).toContain('<meta property="og:url" content="https://forms.example.com/f/abc123">');
    expect(html).toContain('<meta name="twitter:card" content="summary_large_image">');
    expect(html).toContain('content="Pick a place &amp; time"');
    expect(html).not.toContain('<survey>');
    expect(res.headers.get('content-security-policy')).toBe("frame-ancestors 'self'");
    expect(res.headers.get('etag')).toBeNull();
  });

  it('serves the untouched page when the form is missing or the API fails', async () => {
    const missing = vi.fn(async () => new Response('{}', { status: 404 }));
    const a = await t.handle(new Request('https://forms.example.com/f/nope'), env(), missing);
    expect(await a.text()).toBe(SHELL);
    expect(a.headers.get('x-content-type-options')).toBe('nosniff');

    t.reset();
    const broken = vi.fn(async () => {
      throw new Error('timeout');
    });
    const b = await t.handle(new Request('https://forms.example.com/f/abc123'), env(), broken);
    expect(await b.text()).toBe(SHELL);
  });

  it('does not call the API for other paths or without a configured API URL', async () => {
    const fetchImpl = ok(META);
    await t.handle(new Request('https://forms.example.com/f/abc123/result'), env(), fetchImpl);
    await t.handle(new Request('https://forms.example.com/f/abc123'), env('window.__APP_CONFIG__ = {};'), fetchImpl);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
