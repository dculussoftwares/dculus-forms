import enCommon from './en/common.json';
import enDashboard from './en/dashboard.json';
import enOrganizations from './en/organizations.json';
import enUsers from './en/users.json';
import enTemplates from './en/templates.json';
import enLayout from './en/layout.json';
import enLogin from './en/login.json';
import enApp from './en/app.json';
import enEmailPreviews from './en/emailPreviews.json';
import enPlans from './en/plans.json';

import taCommon from './ta/common.json';
import taDashboard from './ta/dashboard.json';
import taOrganizations from './ta/organizations.json';
import taUsers from './ta/users.json';
import taTemplates from './ta/templates.json';
import taLayout from './ta/layout.json';
import taLogin from './ta/login.json';
import taApp from './ta/app.json';
import taEmailPreviews from './ta/emailPreviews.json';
import taPlans from './ta/plans.json';

const enTranslations = {
  common: enCommon,
  dashboard: enDashboard,
  organizations: enOrganizations,
  users: enUsers,
  templates: enTemplates,
  layout: enLayout,
  login: enLogin,
  app: enApp,
  emailPreviews: enEmailPreviews,
  plans: enPlans,
};

const taTranslations = {
  common: taCommon,
  dashboard: taDashboard,
  organizations: taOrganizations,
  users: taUsers,
  templates: taTemplates,
  layout: taLayout,
  login: taLogin,
  app: taApp,
  emailPreviews: taEmailPreviews,
  plans: taPlans,
};

export const translations = {
  en: enTranslations,
  ta: taTranslations,
} as const;

export type Translations = typeof translations;
export type Locale = keyof Translations;
export type LocaleMessages = Translations[Locale];
export type Namespace = keyof LocaleMessages;

export const defaultLocale: Locale = 'en';

export const availableLocales = Object.keys(translations) as Locale[];
