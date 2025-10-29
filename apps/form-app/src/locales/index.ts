import enCommon from './en/common.json';
import enSignIn from './en/signIn.json';
import enSignUp from './en/signUp.json';
import enForgotPassword from './en/forgotPassword.json';
import enSignInOtp from './en/signInOtp.json';
import enInviteAcceptance from './en/inviteAcceptance.json';
import enSettings from './en/settings.json';

export const translations = {
  en: {
    common: enCommon,
    signIn: enSignIn,
    signUp: enSignUp,
    forgotPassword: enForgotPassword,
    signInOtp: enSignInOtp,
    inviteAcceptance: enInviteAcceptance,
    settings: enSettings,
  },
} as const;

export type Translations = typeof translations;
export type Locale = keyof Translations;
export type LocaleMessages = Translations[Locale];
export type Namespace = keyof LocaleMessages;

export const defaultLocale: Locale = 'en';

export const availableLocales = Object.keys(translations) as Locale[];
