import { Languages } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@dculus/ui';
import { useLocale } from '../hooks/useLocale';
import type { Locale } from '../locales';
import { useTranslation } from '../hooks/useTranslation';
import { useMemo, useCallback } from 'react';

export function NavLocale() {
  const { isMobile } = useSidebar();
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
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground justify-center"
              tooltip={t('language.label', { defaultValue: 'Language' })}
            >
              <Languages className="h-4 w-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
            side={isMobile ? 'bottom' : 'right'}
            align="end"
            sideOffset={4}
          >
            {options.map((option) => (
              <DropdownMenuItem
                key={option.value}
                onClick={() => handleChange(option.value)}
                className={locale === option.value ? 'bg-accent' : ''}
              >
                {option.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
