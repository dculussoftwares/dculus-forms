import type { ReactNode } from 'react';
import { createContext, useContext, useMemo, useCallback } from 'react';
import { enTranslations, type EnTranslationKey } from './translations/en';

type Locale = 'en';
type TranslationKey = EnTranslationKey;

type TranslationReplacements = Record<string, string | number>;

interface TranslationContextValue {
  locale: Locale;
  t: (key: TranslationKey, replacements?: TranslationReplacements) => string;
}

const translations: Record<Locale, Record<TranslationKey, string>> = {
  en: enTranslations,
};

const renderTemplate = (
  template: string,
  replacements?: TranslationReplacements,
) => {
  if (!replacements) {
    return template;
  }

  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    if (Object.prototype.hasOwnProperty.call(replacements, key)) {
      return String(replacements[key]);
    }
    return match;
  });
};

const defaultLocale: Locale = 'en';

const TranslationContext = createContext<TranslationContextValue>({
  locale: defaultLocale,
  t: (key, replacements) => renderTemplate(enTranslations[key], replacements),
});

interface TranslationProviderProps {
  locale?: Locale;
  children: ReactNode;
}

export const TranslationProvider = ({
  locale = defaultLocale,
  children,
}: TranslationProviderProps) => {
  const activeLocale = translations[locale] ? locale : defaultLocale;

  const value = useMemo<TranslationContextValue>(() => {
    const dictionary = translations[activeLocale];

    const translate = (key: TranslationKey, replacements?: TranslationReplacements) => {
      const template = dictionary[key] ?? enTranslations[key] ?? key;
      return renderTemplate(template, replacements);
    };

    return {
      locale: activeLocale,
      t: translate,
    };
  }, [activeLocale]);

  return (
    <TranslationContext.Provider value={value}>
      {children}
    </TranslationContext.Provider>
  );
};

export const useTranslation = () => useContext(TranslationContext);

export const useTranslate = () => {
  const { t } = useTranslation();
  return useCallback(
    (key: TranslationKey, replacements?: TranslationReplacements) =>
      t(key, replacements),
    [t],
  );
};
