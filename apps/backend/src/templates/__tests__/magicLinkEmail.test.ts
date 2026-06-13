import { describe, it, expect } from 'vitest';
import {
  generateMagicLinkEmailHtml,
  generateMagicLinkEmailText,
} from '../magicLinkEmail.js';

describe('generateMagicLinkEmailHtml', () => {
  it('includes the sign-in URL in the href', () => {
    const html = generateMagicLinkEmailHtml({ url: 'https://example.com/magic?token=abc' });
    expect(html).toContain('href="https://example.com/magic?token=abc"');
  });

  it('includes the URL as plain text fallback', () => {
    const url = 'https://example.com/magic?token=abc';
    const html = generateMagicLinkEmailHtml({ url });
    // URL appears both in href and as visible text
    const occurrences = html.split(url).length - 1;
    expect(occurrences).toBeGreaterThanOrEqual(2);
  });

  it('defaults to 5 minutes expiry when expiresInMinutes is omitted', () => {
    const html = generateMagicLinkEmailHtml({ url: 'https://example.com' });
    expect(html).toContain('5 minutes');
  });

  it('uses the provided expiresInMinutes value', () => {
    const html = generateMagicLinkEmailHtml({ url: 'https://example.com', expiresInMinutes: 15 });
    expect(html).toContain('15 minutes');
  });

  it('returns valid HTML starting with DOCTYPE', () => {
    const html = generateMagicLinkEmailHtml({ url: 'https://example.com' });
    expect(html.trim()).toMatch(/^<!DOCTYPE html>/i);
  });

  it('contains the sign-in button text', () => {
    const html = generateMagicLinkEmailHtml({ url: 'https://example.com' });
    expect(html).toContain('Sign In to Dculus Forms');
  });
});

describe('generateMagicLinkEmailText', () => {
  it('includes the sign-in URL', () => {
    const url = 'https://example.com/magic?token=abc';
    const text = generateMagicLinkEmailText({ url });
    expect(text).toContain(url);
  });

  it('defaults to 5 minutes expiry when expiresInMinutes is omitted', () => {
    const text = generateMagicLinkEmailText({ url: 'https://example.com' });
    expect(text).toContain('5 minutes');
  });

  it('uses the provided expiresInMinutes value', () => {
    const text = generateMagicLinkEmailText({ url: 'https://example.com', expiresInMinutes: 30 });
    expect(text).toContain('30 minutes');
  });

  it('trims leading and trailing whitespace', () => {
    const text = generateMagicLinkEmailText({ url: 'https://example.com' });
    expect(text).toBe(text.trim());
  });

  it('contains a sign-in header', () => {
    const text = generateMagicLinkEmailText({ url: 'https://example.com' });
    expect(text).toContain('Sign In to Dculus Forms');
  });
});
