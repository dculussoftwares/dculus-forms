import { beforeEach, describe, expect, it } from 'vitest';
import { resetFormViewDedupeForTests, shouldCountFormView } from '../formViewDedupe.js';

describe('shouldCountFormView', () => {
  beforeEach(() => resetFormViewDedupeForTests());

  it('counts a session once per window and again afterwards', () => {
    expect(shouldCountFormView('f1', 'session-0001', '1.1.1.1', 0)).toBe(true);
    expect(shouldCountFormView('f1', 'session-0001', '1.1.1.1', 1000)).toBe(false);
    expect(shouldCountFormView('f1', 'session-0001', '1.1.1.1', 31 * 60 * 1000)).toBe(true);
  });

  it('caps counted views from one client even with fresh session ids', () => {
    let counted = 0;
    for (let i = 0; i < 200; i += 1) {
      if (shouldCountFormView('f1', `session-${i}-xxxx`, '2.2.2.2', i)) counted += 1;
    }
    expect(counted).toBe(60);
    expect(shouldCountFormView('f1', 'session-other', '3.3.3.3', 500)).toBe(true);
  });
});
