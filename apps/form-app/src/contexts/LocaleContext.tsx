import { createContext, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  availableLocales,
  defaultLocale,
  translations,
  type Locale,
  type LocaleMessages,
} from '../locales';

interface LocaleContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  availableLocales: Locale[];
  messages: LocaleMessages;
}

const LocaleContext = createContext<LocaleContextValue | undefined>(undefined);

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<Locale>(defaultLocale);

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
