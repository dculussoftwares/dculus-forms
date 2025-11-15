import { useContext } from 'react';
import { LocaleContext, LocaleContextValue } from '../contexts/locale-context';

export function useLocale(): LocaleContextValue {
  const context = useContext(LocaleContext);

  if (!context) {
    throw new Error('useLocale must be used within a LocaleProvider');
  }

  return context;
}
