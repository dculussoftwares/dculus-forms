import { useMemo } from 'react';
import { LayoutDashboard, Settings, Layers, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { NavMain } from './nav-main';
import { NavUser } from './nav-user';
import { NavLocale } from './nav-locale';
import { TeamSwitcher } from './team-switcher';
import {
  Button,
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from '@dculus/ui';
import { useTranslation } from '../hooks/useTranslation';

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { t } = useTranslation('appSidebar');
  const navigate = useNavigate();

  const navMainItems = useMemo(
    () => [
      {
        title: t('navigation.dashboard'),
        url: '/dashboard',
        icon: LayoutDashboard,
      },
      {
        title: t('navigation.templates'),
        url: '/dashboard/templates',
        icon: Layers,
      },
      {
        title: t('navigation.settings'),
        url: '/settings',
        icon: Settings,
      },
    ],
    [t],
  );

  return (
    <Sidebar collapsible="icon" {...props}>
      {/* ── Org switcher (top) ── */}
      <SidebarHeader className="border-b border-[var(--tf-border-medium)] dark:border-white/10 pb-3">
        <TeamSwitcher />
      </SidebarHeader>

      <SidebarContent className="pt-3">
        {/* ── "+ New Form" CTA — mirrors Typeform's "+ Create form" ── */}
        <div className="px-2 pb-3 group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:justify-center">
          <Button
            onClick={() => navigate('/forms/create')}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium group-data-[collapsible=icon]:w-8 group-data-[collapsible=icon]:h-8 group-data-[collapsible=icon]:p-0"
            title={t('navigation.createForm', { defaultValue: 'New form' })}
          >
            <Plus className="h-4 w-4 shrink-0" />
            <span className="group-data-[collapsible=icon]:hidden">{t('navigation.createForm', { defaultValue: 'New form' })}</span>
          </Button>
        </div>

        {/* ── Navigation items ── */}
        <NavMain items={navMainItems} />
      </SidebarContent>

      <SidebarFooter className="border-t border-[var(--tf-border-medium)] dark:border-white/10">
        <NavLocale />
        <NavUser />
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
