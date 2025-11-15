import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  availableLocales,
  defaultLocale,
  translations,
  type Locale,
  type LocaleMessages,
} from '../locales';

export const LOCALE_STORAGE_KEY = 'dculus.forms.locale';

interface LocaleContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  availableLocales: Locale[];
  messages: LocaleMessages;
}

const LocaleContext = createContext<LocaleContextValue | undefined>(undefined);

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

export function useLocale() {
  const context = useContext(LocaleContext);

  if (!context) {
    throw new Error('useLocale must be used within a LocaleProvider');
  }

  return context;
}
