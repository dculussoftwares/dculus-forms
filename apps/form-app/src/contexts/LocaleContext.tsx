import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { availableLocales, defaultLocale, translations, type Locale } from '../locales';
import { LocaleContext, LocaleContextValue } from './locale-context';

export const LOCALE_STORAGE_KEY = 'dculus.forms.locale';

const isLocale = (value: string | null): value is Locale => {
  return !!value && availableLocales.includes(value as Locale);
};

const getInitialLocale = (): Locale => {
  if (typeof window === 'undefined') {
    return defaultLocale;
  }

  const storedLocale = window.localStorage.getItem(LOCALE_STORAGE_KEY);

  if (isLocale(storedLocale)) {
    return storedLocale;
  }

  return defaultLocale;
};

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(getInitialLocale);

  const setLocale = useCallback((nextLocale: Locale) => {
    setLocaleState(nextLocale);

    if (typeof window !== 'undefined') {
      window.localStorage.setItem(LOCALE_STORAGE_KEY, nextLocale);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== LOCALE_STORAGE_KEY) {
        return;
      }

      if (isLocale(event.newValue)) {
        setLocaleState(event.newValue);
        return;
      }

      setLocaleState(defaultLocale);
    };

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const value = useMemo<LocaleContextValue>(
    () => ({
      locale,
      setLocale,
      availableLocales,
      messages: translations[locale],
    }),
    [locale],
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}
