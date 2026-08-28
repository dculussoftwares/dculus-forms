import { describe, it, expect } from 'vitest';
import { readEmbedParams, __testing } from './embedBridge';

const { parseHostOrigin } = __testing;

describe('parseHostOrigin', () => {
  it('accepts a bare http/https origin', () => {
    expect(parseHostOrigin('https://example.com')).toBe('https://example.com');
    expect(parseHostOrigin('http://localhost:3000')).toBe('http://localhost:3000');
  });

  it('rejects anything carrying more than an origin', () => {
    // A postMessage target origin must be exactly scheme://host[:port]; a value
    // with a path is a sign the caller is confused about what this field is.
    expect(parseHostOrigin('https://example.com/')).toBeNull();
    expect(parseHostOrigin('https://example.com/page')).toBeNull();
    expect(parseHostOrigin('https://example.com?a=1')).toBeNull();
  });

  it('rejects non-http schemes', () => {
    expect(parseHostOrigin('javascript:alert(1)')).toBeNull();
    expect(parseHostOrigin('file:///etc/passwd')).toBeNull();
    expect(parseHostOrigin('data:text/html,x')).toBeNull();
  });

  it('rejects absent or unparseable values', () => {
    expect(parseHostOrigin(null)).toBeNull();
    expect(parseHostOrigin('')).toBeNull();
    expect(parseHostOrigin('example.com')).toBeNull();
    expect(parseHostOrigin('not a url')).toBeNull();
  });
});

describe('readEmbedParams', () => {
  it('defaults to an auto-height inline embed with no messaging', () => {
    // No `origin` means no host script — the no-JS snippet — so messaging
    // stays off rather than falling back to a wildcard target.
    expect(readEmbedParams('')).toEqual({
      mode: 'inline',
      background: 'transparent',
      autoHeight: true,
      hostOrigin: null,
      instanceId: 'default',
      closeAfterSubmit: false,
      isPreview: false,
    });
  });

  it('reads a full inline embed', () => {
    const params = readEmbedParams(
      '?mode=inline&bg=white&h=auto&i=abc-1&origin=https%3A%2F%2Fexample.com'
    );
    expect(params.mode).toBe('inline');
    expect(params.background).toBe('white');
    expect(params.autoHeight).toBe(true);
    expect(params.hostOrigin).toBe('https://example.com');
    expect(params.instanceId).toBe('abc-1');
  });

  it('treats an explicit pixel height as "the host has already decided"', () => {
    expect(readEmbedParams('?mode=iframe&h=600').autoHeight).toBe(false);
  });

  it('falls back to inline for an unknown mode', () => {
    expect(readEmbedParams('?mode=chatbubble').mode).toBe('inline');
  });

  it('only opts into the lightbox self-dismiss when explicitly asked', () => {
    expect(readEmbedParams('?mode=lightbox').closeAfterSubmit).toBe(false);
    expect(readEmbedParams('?mode=lightbox&close=1').closeAfterSubmit).toBe(true);
    expect(readEmbedParams('?mode=lightbox&close=true').closeAfterSubmit).toBe(false);
  });

  it('recognises the owner preview, which must not be tracked', () => {
    expect(readEmbedParams('?preview=1').isPreview).toBe(true);
    expect(readEmbedParams('?preview=0').isPreview).toBe(false);
    expect(readEmbedParams('').isPreview).toBe(false);
  });

  it('ignores a host origin that is not a clean origin', () => {
    expect(readEmbedParams('?origin=https%3A%2F%2Fevil.com%2Fpath').hostOrigin).toBeNull();
  });
});
