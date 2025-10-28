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

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const navMainItems = useMemo(
    () => [
      {
        title: 'Dashboard',
        url: '/dashboard',
        icon: LayoutDashboard,
      },
      {
        title: 'Templates',
        url: '/dashboard/templates',
        icon: Layers,
      },
      {
        title: 'Settings',
        url: '/settings',
        icon: Settings,
      },
    ],
    [],
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
