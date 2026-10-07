import { LOCALE_STORAGE_KEY, translateOutsideReact } from '../storedLocale';
import en from '../en/gridLayout.json';
import ta from '../ta/gridLayout.json';

describe('translateOutsideReact', () => {
  afterEach(() => localStorage.clear());

  it('uses English by default', () => {
    expect(translateOutsideReact('gridLayout', 'errors.cannotConvert')).toBe(en.errors.cannotConvert);
  });

  it('follows the locale the user picked', () => {
    localStorage.setItem(LOCALE_STORAGE_KEY, 'ta');
    expect(translateOutsideReact('gridLayout', 'errors.cannotConvert')).toBe(ta.errors.cannotConvert);
  });

  it('ignores an unknown stored locale and returns the key for an unknown message', () => {
    localStorage.setItem(LOCALE_STORAGE_KEY, 'xx');
    expect(translateOutsideReact('gridLayout', 'errors.cannotConvert')).toBe(en.errors.cannotConvert);
    expect(translateOutsideReact('gridLayout', 'errors.missing')).toBe('errors.missing');
  });
});
