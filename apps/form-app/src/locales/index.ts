import enCommon from './en/common.json';
import enSignIn from './en/signIn.json';
import enSignUp from './en/signUp.json';

export const translations = {
  en: {
    common: enCommon,
    signIn: enSignIn,
    signUp: enSignUp,
  },
} as const;

export type Translations = typeof translations;
export type Locale = keyof Translations;
export type LocaleMessages = Translations[Locale];
export type Namespace = keyof LocaleMessages;

export const defaultLocale: Locale = 'en';

export const availableLocales = Object.keys(translations) as Locale[];
