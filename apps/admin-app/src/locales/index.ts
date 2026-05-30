import enCommon from './en/common.json';
import enDashboard from './en/dashboard.json';
import enOrganizations from './en/organizations.json';
import enUsers from './en/users.json';
import enTemplates from './en/templates.json';
import enLayout from './en/layout.json';
import enLogin from './en/login.json';
import enApp from './en/app.json';
import enAiModelConfig from './en/aiModelConfig.json';

export const translations = {
  en: {
    common: enCommon,
    dashboard: enDashboard,
    organizations: enOrganizations,
    users: enUsers,
    templates: enTemplates,
    layout: enLayout,
    login: enLogin,
    app: enApp,
    aiModelConfig: enAiModelConfig,
  },
} as const;

export type Translations = typeof translations;
export type Locale = keyof Translations;
export type LocaleMessages = Translations[Locale];
export type Namespace = keyof LocaleMessages;

export const defaultLocale: Locale = 'en';

export const availableLocales = Object.keys(translations) as Locale[];
