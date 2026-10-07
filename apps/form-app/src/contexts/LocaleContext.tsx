import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { availableLocales, defaultLocale, translations, type Locale } from '../locales';
import { LOCALE_STORAGE_KEY, getStoredLocale, isLocale } from '../locales/storedLocale';
import { LocaleContext, LocaleContextValue } from './locale-context';

export { LOCALE_STORAGE_KEY };

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(getStoredLocale);

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
