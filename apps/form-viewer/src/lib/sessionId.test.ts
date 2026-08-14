import { describe, it, expect, beforeEach } from 'vitest';
import { getOrCreateSessionId } from './sessionId';

describe('getOrCreateSessionId', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns a consistent id within the same session TTL', () => {
    const id1 = getOrCreateSessionId();
    const id2 = getOrCreateSessionId();
    expect(id1).toBe(id2);
    expect(typeof id1).toBe('string');
    expect(id1.length).toBeGreaterThan(0);
  });

  it('generates a new id after the TTL expires', () => {
    const id1 = getOrCreateSessionId();
    localStorage.setItem('dculus_form_session_expiry', String(Date.now() - 1));
    const id2 = getOrCreateSessionId();
    expect(id1).not.toBe(id2);
  });

  it('falls back to crypto.getRandomValues when randomUUID is unavailable', () => {
    // Simulate a non-secure context where randomUUID is absent
    const original = globalThis.crypto.randomUUID;
    Object.defineProperty(globalThis.crypto, 'randomUUID', {
      value: undefined,
      configurable: true,
      writable: true,
    });

    try {
      let result: string | undefined;
      expect(() => {
        result = getOrCreateSessionId();
      }).not.toThrow();
      expect(result).toMatch(/^[0-9a-f]{32}$/);
    } finally {
      Object.defineProperty(globalThis.crypto, 'randomUUID', {
        value: original,
        configurable: true,
        writable: true,
      });
    }
  });

  it('does not throw when the Web Crypto API is entirely unavailable', () => {
    // Simulate an environment with no `crypto` global at all (not even declared)
    const originalCrypto = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
    // @ts-expect-error simulating a runtime with no crypto global
    delete globalThis.crypto;

    try {
      let result: string | undefined;
      expect(() => {
        result = getOrCreateSessionId();
      }).not.toThrow();
      expect(typeof result).toBe('string');
      expect(result!.length).toBeGreaterThan(0);
    } finally {
      if (originalCrypto) {
        Object.defineProperty(globalThis, 'crypto', originalCrypto);
      }
    }
  });
});
