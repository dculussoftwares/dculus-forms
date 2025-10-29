import { useMemo, useCallback } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@dculus/ui';
import { useLocale } from '../contexts/LocaleContext';
import type { Locale } from '../locales';
import { useTranslation } from '../hooks/useTranslation';

export function LocaleSwitcher() {
  const { locale, setLocale, availableLocales } = useLocale();
  const { t } = useTranslation('common');

  const options = useMemo(
    () =>
      availableLocales.map((code) => ({
        value: code,
        label: t(`language.options.${code}`, { defaultValue: code }),
      })),
    [availableLocales, t],
  );

  const handleChange = useCallback(
    (next: string) => {
      if (next === locale) {
        return;
      }

      setLocale(next as Locale);
    },
    [locale, setLocale],
  );

  return (
    <div className="flex items-center gap-2">
      <span className="hidden text-sm text-muted-foreground sm:inline">
        {t('language.label', { defaultValue: 'Language' })}
      </span>
      <Select value={locale} onValueChange={handleChange}>
        <SelectTrigger className="h-9 w-[140px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
