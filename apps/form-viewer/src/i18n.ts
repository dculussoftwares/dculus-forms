import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { resources } from './locales/en';

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: resources,
    },
    lng: 'en',
    fallbackLng: 'en',

    // Disable suspense for now
    react: {
      useSuspense: false,
    },

    interpolation: {
      escapeValue: false, // React already escapes values
    },

    // Logging for development
    debug: process.env.NODE_ENV === 'development',
  });

export default i18n;
