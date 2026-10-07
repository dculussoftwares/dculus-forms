/**
 * The user's chosen locale, readable outside React. `LocaleProvider` owns the state; this module
 * lets store actions (which raise toasts but have no hooks) translate with the same choice.
 */
import { availableLocales, defaultLocale, translations, type Locale, type Namespace } from './index';

export const LOCALE_STORAGE_KEY = 'dculus.forms.locale';

export const isLocale = (value: string | null): value is Locale =>
  !!value && availableLocales.includes(value as Locale);

export const getStoredLocale = (): Locale => {
  if (typeof window === 'undefined') return defaultLocale;
  try {
    const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    return isLocale(stored) ? stored : defaultLocale;
  } catch {
    return defaultLocale;
  }
};

const lookup = (locale: Locale, namespace: Namespace, key: string): unknown =>
  key
    .split('.')
    .reduce<unknown>(
      (node, segment) =>
        node && typeof node === 'object' ? (node as Record<string, unknown>)[segment] : undefined,
      translations[locale][namespace]
    );

/** Translates `key` in `namespace` for code outside React, falling back to English, then the key. */
export const translateOutsideReact = (namespace: Namespace, key: string): string => {
  const message = lookup(getStoredLocale(), namespace, key) ?? lookup(defaultLocale, namespace, key);
  return typeof message === 'string' ? message : key;
};
