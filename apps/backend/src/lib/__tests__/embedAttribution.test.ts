import { describe, it, expect } from 'vitest';
import {
  sanitizeEmbedAttribution,
  sanitizeEmbedContext,
  sanitizeEmbedHost,
} from '../embedAttribution.js';

describe('sanitizeEmbedContext', () => {
  it('accepts the four known contexts, case-insensitively', () => {
    expect(sanitizeEmbedContext('direct')).toBe('direct');
    expect(sanitizeEmbedContext('inline')).toBe('inline');
    expect(sanitizeEmbedContext('LIGHTBOX')).toBe('lightbox');
    expect(sanitizeEmbedContext(' iframe ')).toBe('iframe');
  });

  it('rejects anything else rather than storing it', () => {
    expect(sanitizeEmbedContext('popup')).toBeNull();
    expect(sanitizeEmbedContext('')).toBeNull();
    expect(sanitizeEmbedContext(null)).toBeNull();
    expect(sanitizeEmbedContext(42)).toBeNull();
    expect(sanitizeEmbedContext({ toString: () => 'inline' })).toBeNull();
  });
});

describe('sanitizeEmbedHost', () => {
  it('accepts real hostnames, lowercased', () => {
    expect(sanitizeEmbedHost('Example.com')).toBe('example.com');
    expect(sanitizeEmbedHost('blog.example.co.uk')).toBe('blog.example.co.uk');
    expect(sanitizeEmbedHost('my-site.dev')).toBe('my-site.dev');
  });

  it('accepts local/dev hosts, dropping the port', () => {
    expect(sanitizeEmbedHost('localhost')).toBe('localhost');
    expect(sanitizeEmbedHost('localhost:3000')).toBe('localhost');
    expect(sanitizeEmbedHost('127.0.0.1:8080')).toBe('127.0.0.1');
  });

  it('rejects anything carrying more than a hostname', () => {
    // The whole point: a path or query string can carry PII, a hostname cannot.
    expect(sanitizeEmbedHost('https://example.com')).toBeNull();
    expect(sanitizeEmbedHost('example.com/checkout?email=a@b.com')).toBeNull();
    expect(sanitizeEmbedHost('user:pass@example.com')).toBeNull();
    expect(sanitizeEmbedHost('exa mple.com')).toBeNull();
    expect(sanitizeEmbedHost('-example.com')).toBeNull();
    expect(sanitizeEmbedHost('<script>alert(1)</script>')).toBeNull();
  });

  it('rejects a value longer than any real hostname', () => {
    expect(sanitizeEmbedHost('a'.repeat(300) + '.com')).toBeNull();
  });

  it('rejects non-strings', () => {
    expect(sanitizeEmbedHost(null)).toBeNull();
    expect(sanitizeEmbedHost(undefined)).toBeNull();
    expect(sanitizeEmbedHost(123)).toBeNull();
  });
});

describe('sanitizeEmbedAttribution', () => {
  it('keeps the host only for a framed context', () => {
    expect(sanitizeEmbedAttribution({ embedContext: 'inline', embedHost: 'example.com' })).toEqual({
      embedContext: 'inline',
      embedHost: 'example.com',
    });
  });

  it('drops the host for a direct view, where it means nothing', () => {
    expect(sanitizeEmbedAttribution({ embedContext: 'direct', embedHost: 'example.com' })).toEqual({
      embedContext: 'direct',
      embedHost: null,
    });
  });

  it('leaves both null when nothing was supplied, matching pre-feature rows', () => {
    expect(sanitizeEmbedAttribution({})).toEqual({ embedContext: null, embedHost: null });
  });

  it('keeps a valid context even when the host is rubbish', () => {
    expect(
      sanitizeEmbedAttribution({ embedContext: 'lightbox', embedHost: 'https://evil.com/steal' })
    ).toEqual({ embedContext: 'lightbox', embedHost: null });
  });

  it('drops the host when the context itself is not recognised', () => {
    expect(
      sanitizeEmbedAttribution({ embedContext: 'whatever', embedHost: 'example.com' })
    ).toEqual({ embedContext: null, embedHost: null });
  });
});
