import { createContext } from 'react';
import type { Locale, LocaleMessages } from '../locales';

export interface LocaleContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  availableLocales: Locale[];
  messages: LocaleMessages;
}

export const LocaleContext = createContext<LocaleContextValue | undefined>(undefined);
