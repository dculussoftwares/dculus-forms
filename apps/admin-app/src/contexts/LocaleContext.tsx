import React, { createContext, useState, useCallback, useContext, useMemo } from 'react';
import type { Locale, LocaleMessages } from '../locales';
import { translations, defaultLocale, availableLocales } from '../locales';

interface LocaleContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  messages: LocaleMessages;
  availableLocales: Locale[];
}

const LocaleContext = createContext<LocaleContextValue | undefined>(undefined);

interface LocaleProviderProps {
  children: React.ReactNode;
  initialLocale?: Locale;
}

export const LocaleProvider: React.FC<LocaleProviderProps> = ({
  children,
  initialLocale = defaultLocale,
}) => {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    localStorage.setItem('admin-locale', newLocale);
  }, []);

  const messages = useMemo(() => translations[locale], [locale]);

  const value = useMemo(
    () => ({
      locale,
      setLocale,
      messages,
      availableLocales,
    }),
    [locale, setLocale, messages]
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
};

export const useLocale = (): LocaleContextValue => {
  const context = useContext(LocaleContext);
  if (!context) {
    throw new Error('useLocale must be used within a LocaleProvider');
  }
  return context;
};
