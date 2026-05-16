import { useMemo } from 'react';
import { LayoutDashboard, Settings, Layers, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { NavMain } from './nav-main';
import { NavUser } from './nav-user';
import { NavLocale } from './nav-locale';
import { TeamSwitcher } from './team-switcher';
import {
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
      <SidebarHeader className="border-b border-[rgba(81,76,84,0.10)] dark:border-white/10 pb-3">
        <TeamSwitcher />
      </SidebarHeader>

      <SidebarContent className="pt-3">
        {/* ── "+ New Form" CTA — mirrors Typeform's "+ Create form" ── */}
        <div className="px-2 pb-3 group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:justify-center">
          <button
            onClick={() => navigate('/dashboard/templates')}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-white transition-all duration-150 hover:opacity-90 active:scale-[0.98] group-data-[collapsible=icon]:w-8 group-data-[collapsible=icon]:h-8 group-data-[collapsible=icon]:p-0"
            style={{ backgroundColor: '#3c323e' }}
            title={t('navigation.createForm', { defaultValue: 'New form' })}
          >
            <Plus className="h-4 w-4 shrink-0" />
            <span className="group-data-[collapsible=icon]:hidden">{t('navigation.createForm', { defaultValue: 'New form' })}</span>
          </button>
        </div>

        {/* ── Navigation items ── */}
        <NavMain items={navMainItems} />
      </SidebarContent>

      <SidebarFooter className="border-t border-[rgba(81,76,84,0.10)] dark:border-white/10">
        <NavLocale />
        <NavUser />
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
