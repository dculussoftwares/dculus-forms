import { createContext } from 'react';
import type { Locale, LocaleMessages } from '../locales';

export interface LocaleContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  messages: LocaleMessages;
  availableLocales: Locale[];
}

export const LocaleContext = createContext<LocaleContextValue | undefined>(undefined);
