import { describe, it, expect } from 'vitest';
import { DEFAULT_QUIZ_SETTINGS, isOneResponsePerRespondent, isRespondentEditEnabled } from '../index.js';

const signIn = { accessControl: { enabled: true, requireSignIn: true } };

describe('isOneResponsePerRespondent', () => {
  it('is off unless the owner turns it on', () => {
    expect(isOneResponsePerRespondent(null)).toBe(false);
    expect(isOneResponsePerRespondent(signIn)).toBe(false);
    expect(isOneResponsePerRespondent({ ...signIn, oneResponsePerRespondent: true })).toBe(true);
    expect(isOneResponsePerRespondent({ collectRespondentEmail: true, oneResponsePerRespondent: true })).toBe(true);
  });

  it('never applies to anonymous forms', () => {
    expect(isOneResponsePerRespondent({ oneResponsePerRespondent: true })).toBe(false);
  });
});

describe('isRespondentEditEnabled', () => {
  it('is off unless the owner turns it on', () => {
    expect(isRespondentEditEnabled(null)).toBe(false);
    expect(isRespondentEditEnabled(signIn)).toBe(false);
    expect(isRespondentEditEnabled({ ...signIn, allowRespondentEdit: true })).toBe(true);
  });

  it('never applies to anonymous or quiz forms', () => {
    expect(isRespondentEditEnabled({ allowRespondentEdit: true })).toBe(false);
    expect(
      isRespondentEditEnabled({
        ...signIn,
        allowRespondentEdit: true,
        quiz: { ...DEFAULT_QUIZ_SETTINGS, enabled: true },
      })
    ).toBe(false);
  });
});
