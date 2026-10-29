import { describe, it, expect, beforeEach } from 'vitest';
import { consumeOAuthNonce, startOAuthNonce } from './oauthNonce';

describe('oauthNonce', () => {
  beforeEach(() => sessionStorage.clear());

  it('accepts the nonce this tab started, exactly once', () => {
    const nonce = startOAuthNonce();
    expect(nonce).toMatch(/^[A-Za-z0-9_-]{22,128}$/);
    expect(consumeOAuthNonce(nonce)).toBe(true);
    expect(consumeOAuthNonce(nonce)).toBe(false);
  });

  it('rejects a callback when no sign-in was started in this tab', () => {
    expect(consumeOAuthNonce('A'.repeat(32))).toBe(false);
  });

  it('rejects a missing or mismatching nonce and still clears the stored one', () => {
    const nonce = startOAuthNonce();
    expect(consumeOAuthNonce(null)).toBe(false);
    expect(consumeOAuthNonce(nonce)).toBe(false);
    startOAuthNonce();
    expect(consumeOAuthNonce('B'.repeat(32))).toBe(false);
  });
});
