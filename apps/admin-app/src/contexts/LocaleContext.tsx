import React, { useState, useCallback, useMemo } from 'react';
import type { Locale } from '../locales';
import { translations, defaultLocale, availableLocales } from '../locales';
import { LocaleContext, LocaleContextValue } from './locale-context';

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

  const value = useMemo<LocaleContextValue>(
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
