import {
  capturePendingTemplateFromUrl,
  clearPendingTemplate,
  getPendingTemplate,
  setPendingTemplate,
} from '../pendingTemplate';

describe('pendingTemplate', () => {
  beforeEach(() => {
    localStorage.clear();
    window.history.replaceState(null, '', '/');
  });

  it('remembers a valid slug', () => {
    expect(setPendingTemplate('Employee-Onboarding')).toBe(true);
    expect(getPendingTemplate()).toBe('employee-onboarding');
  });

  it('rejects anything that is not a slug', () => {
    expect(setPendingTemplate('../../etc')).toBe(false);
    expect(setPendingTemplate('a b')).toBe(false);
    expect(setPendingTemplate('a'.repeat(81))).toBe(false);
    expect(getPendingTemplate()).toBeNull();
  });

  it('expires after a day', () => {
    setPendingTemplate('contact-form', 1_000);
    expect(getPendingTemplate(1_000 + 23 * 60 * 60 * 1000)).toBe('contact-form');
    expect(getPendingTemplate(1_000 + 25 * 60 * 60 * 1000)).toBeNull();
    expect(localStorage.getItem('dculus:pendingTemplate')).toBeNull();
  });

  it('ignores and clears corrupt storage', () => {
    localStorage.setItem('dculus:pendingTemplate', JSON.stringify({ slug: 3 }));
    expect(getPendingTemplate()).toBeNull();
    expect(localStorage.getItem('dculus:pendingTemplate')).toBeNull();
  });

  it('clears on request', () => {
    setPendingTemplate('contact-form');
    clearPendingTemplate();
    expect(getPendingTemplate()).toBeNull();
  });

  it('captures ?template= from the URL and removes it from the address bar', () => {
    window.history.replaceState(null, '', '/signup?template=contact-form&ref=site#top');
    expect(capturePendingTemplateFromUrl()).toBe('contact-form');
    expect(getPendingTemplate()).toBe('contact-form');
    expect(window.location.pathname + window.location.search + window.location.hash).toBe('/signup?ref=site#top');
  });

  it('does nothing without the parameter', () => {
    window.history.replaceState(null, '', '/signup');
    expect(capturePendingTemplateFromUrl()).toBeNull();
    expect(getPendingTemplate()).toBeNull();
  });
});
