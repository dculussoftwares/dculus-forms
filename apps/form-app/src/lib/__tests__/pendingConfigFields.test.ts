import { beginOAuthConnect, parseOAuthTokenFragment, verifyOAuthReturn } from '../pendingConfigFields';

const encode = (value: unknown) => btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

beforeEach(() => {
  sessionStorage.clear();
  window.history.replaceState(null, '', '/forms/f1/plugins');
});

describe('OAuth connect nonce', () => {
  it('accepts a return that carries the nonce this tab started and strips it from the URL', () => {
    const returnTo = beginOAuthConnect('google-sheets', '/forms/f1/plugins?tab=a');
    expect(returnTo).toMatch(/^\/forms\/f1\/plugins\?tab=a&oauth_nonce=[A-Za-z0-9_-]+$/);

    window.history.replaceState(null, '', `${returnTo}#google_oauth_token=x`);
    expect(verifyOAuthReturn('google-sheets')).toBe(true);
    expect(window.location.search).toBe('?tab=a');
    expect(window.location.hash).toBe('#google_oauth_token=x');
    expect(verifyOAuthReturn('google-sheets')).toBe(false);
  });

  it('rejects a crafted return when no Connect flow was started in this tab', () => {
    window.history.replaceState(null, '', '/forms/f1/plugins?oauth_nonce=abc#google_oauth_token=x');
    expect(verifyOAuthReturn('google-sheets')).toBe(false);
    expect(window.location.search).toBe('');
  });

  it('rejects a return without or with a different nonce', () => {
    beginOAuthConnect('google-sheets', '/forms/f1/plugins');
    window.history.replaceState(null, '', '/forms/f1/plugins?oauth_nonce=other');
    expect(verifyOAuthReturn('google-sheets')).toBe(false);

    beginOAuthConnect('google-sheets', '/forms/f1/plugins');
    window.history.replaceState(null, '', '/forms/f1/plugins');
    expect(verifyOAuthReturn('google-sheets')).toBe(false);
  });
});

describe('parseOAuthTokenFragment', () => {
  const valid = { accessToken: 'at', refreshToken: 'rt', expiresAt: '2030-01-01T00:00:00.000Z', email: 'a@b.c', extra: 'drop' };

  it('keeps only known fields', () => {
    expect(parseOAuthTokenFragment(encode(valid), ['refreshToken', 'email'])).toEqual({
      accessToken: 'at',
      refreshToken: 'rt',
      expiresAt: valid.expiresAt,
      email: 'a@b.c',
    });
  });

  it.each([
    ['not base64 json', '%%%'],
    ['array', encode([1])],
    ['missing accessToken', encode({ expiresAt: valid.expiresAt })],
    ['bad expiresAt', encode({ accessToken: 'at', expiresAt: 'nope' })],
    ['non-string email', encode({ ...valid, email: { x: 1 } })],
  ])('rejects %s', (_name, raw) => {
    expect(parseOAuthTokenFragment(raw, ['refreshToken', 'email'])).toBeNull();
  });
});
