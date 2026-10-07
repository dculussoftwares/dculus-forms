import { describe, it, expect } from 'vitest';
import { isSaveProgressEnabled } from '../index.js';

describe('isSaveProgressEnabled', () => {
  it('is off for anonymous forms and missing settings', () => {
    expect(isSaveProgressEnabled(null)).toBe(false);
    expect(isSaveProgressEnabled({})).toBe(false);
    expect(isSaveProgressEnabled({ saveProgress: { enabled: true } })).toBe(false);
  });

  it('defaults to on for identity-gated forms', () => {
    expect(isSaveProgressEnabled({ accessControl: { enabled: true, requireSignIn: true } })).toBe(true);
    expect(isSaveProgressEnabled({ collectRespondentEmail: true })).toBe(true);
  });

  it('respects an explicit opt-out', () => {
    expect(isSaveProgressEnabled({ collectRespondentEmail: true, saveProgress: { enabled: false } })).toBe(false);
  });
});
