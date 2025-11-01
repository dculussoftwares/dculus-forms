import { useMemo } from 'react';
import { LayoutDashboard, Settings, Layers } from 'lucide-react';

import { NavMain } from './nav-main';
import { NavUser } from './nav-user';
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
      <SidebarHeader>
        <TeamSwitcher />
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={navMainItems} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
