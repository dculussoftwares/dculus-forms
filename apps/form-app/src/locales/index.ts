import enCommon from './en/common.json';
import enSignIn from './en/signIn.json';
import enSignUp from './en/signUp.json';
import enForgotPassword from './en/forgotPassword.json';
import enSignInOtp from './en/signInOtp.json';
import enInviteAcceptance from './en/inviteAcceptance.json';
import enSettings from './en/settings.json';
import enFormsList from './en/formsList.json';
import enTemplates from './en/templates.json';
import enDashboard from './en/dashboard.json';
import enFormDashboard from './en/formDashboard.json';
import enSharing from './en/sharing.json';
import enResponses from './en/responses.json';

export const translations = {
  en: {
    common: enCommon,
    signIn: enSignIn,
    signUp: enSignUp,
    forgotPassword: enForgotPassword,
    signInOtp: enSignInOtp,
    inviteAcceptance: enInviteAcceptance,
    settings: enSettings,
    formsList: enFormsList,
    templates: enTemplates,
    dashboard: enDashboard,
    formDashboard: enFormDashboard,
    sharing: enSharing,
    responses: enResponses,
  },
} as const;

export type Translations = typeof translations;
export type Locale = keyof Translations;
export type LocaleMessages = Translations[Locale];
export type Namespace = keyof LocaleMessages;

export const defaultLocale: Locale = 'en';

export const availableLocales = Object.keys(translations) as Locale[];
