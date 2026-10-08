import { describe, it, expect } from 'vitest';
import { isSaveProgressEnabled } from '../index.js';

describe('isSaveProgressEnabled', () => {
  it('defaults to on, for open and identity-gated forms alike', () => {
    expect(isSaveProgressEnabled(null)).toBe(true);
    expect(isSaveProgressEnabled({})).toBe(true);
    expect(isSaveProgressEnabled({ saveProgress: { enabled: true } })).toBe(true);
  });

  it('respects an explicit opt-out', () => {
    expect(isSaveProgressEnabled({ saveProgress: { enabled: false } })).toBe(false);
  });
});
