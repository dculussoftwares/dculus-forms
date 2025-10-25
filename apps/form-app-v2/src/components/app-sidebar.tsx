import { useMemo } from 'react';
import {
  AudioWaveform,
  BookOpen,
  Bot,
  Command,
  Frame,
  GalleryVerticalEnd,
  Map,
  PieChart,
  Settings2,
  SquareTerminal,
} from 'lucide-react';

import { NavMain } from '@/components/nav-main';
import { NavProjects } from '@/components/nav-projects';
import { NavUser } from '@/components/nav-user';
import { TeamSwitcher } from '@/components/team-switcher';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from '@dculus/ui-v2';
import { useAuth } from '../contexts/AuthContext';
import { useTranslate } from '../i18n';

export function AppSidebar({
  ...props
}: React.ComponentProps<typeof Sidebar>) {
  const t = useTranslate();
  const { user, activeOrganization } = useAuth();

  const navMainItems = useMemo(
    () => [
      {
        title: t('sidebar.nav.playground'),
        url: '#',
        icon: SquareTerminal,
        isActive: true,
        items: [
          {
            title: t('sidebar.nav.history'),
            url: '#',
          },
          {
            title: t('sidebar.nav.starred'),
            url: '#',
          },
          {
            title: t('sidebar.nav.settings'),
            url: '#',
          },
        ],
      },
      {
        title: t('sidebar.nav.models'),
        url: '#',
        icon: Bot,
        items: [
          {
            title: t('sidebar.nav.genesis'),
            url: '#',
          },
          {
            title: t('sidebar.nav.explorer'),
            url: '#',
          },
          {
            title: t('sidebar.nav.quantum'),
            url: '#',
          },
        ],
      },
      {
        title: t('sidebar.nav.documentation'),
        url: '#',
        icon: BookOpen,
        items: [
          {
            title: t('sidebar.nav.introduction'),
            url: '#',
          },
          {
            title: t('sidebar.nav.getStarted'),
            url: '#',
          },
          {
            title: t('sidebar.nav.tutorials'),
            url: '#',
          },
          {
            title: t('sidebar.nav.changelog'),
            url: '#',
          },
        ],
      },
      {
        title: t('sidebar.nav.settings'),
        url: '#',
        icon: Settings2,
        items: [
          {
            title: t('sidebar.nav.general'),
            url: '#',
          },
          {
            title: t('sidebar.nav.team'),
            url: '#',
          },
          {
            title: t('sidebar.nav.billing'),
            url: '#',
          },
          {
            title: t('sidebar.nav.limits'),
            url: '#',
          },
        ],
      },
    ],
    [t],
  );

  const projectItems = useMemo(
    () => [
      {
        name: t('sidebar.projects.designEngineering'),
        url: '#',
        icon: Frame,
      },
      {
        name: t('sidebar.projects.salesMarketing'),
        url: '#',
        icon: PieChart,
      },
      {
        name: t('sidebar.projects.travel'),
        url: '#',
        icon: Map,
      },
    ],
    [t],
  );

  const fallbackTeams = useMemo(
    () => [
      {
        name: t('sidebar.team.sample.acmeInc'),
        logo: GalleryVerticalEnd,
        plan: t('sidebar.team.plan.enterprise'),
      },
      {
        name: t('sidebar.team.sample.acmeCorp'),
        logo: AudioWaveform,
        plan: t('sidebar.team.plan.startup'),
      },
      {
        name: t('sidebar.team.sample.evilCorp'),
        logo: Command,
        plan: t('sidebar.team.plan.free'),
      },
    ],
    [t],
  );

  const userData = useMemo(
    () => ({
      name: user?.name || t('sidebar.team.fallbackName'),
      email: user?.email || t('sidebar.team.fallbackEmail'),
      avatar: user?.image || '',
    }),
    [t, user?.email, user?.image, user?.name],
  );

  const teams = useMemo(() => {
    if (activeOrganization) {
      return [
        {
          name: activeOrganization.name,
          logo: GalleryVerticalEnd,
          plan: t('sidebar.team.plan.free'),
        },
      ];
    }

    return fallbackTeams;
  }, [activeOrganization, fallbackTeams, t]);

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <TeamSwitcher teams={teams} />
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={navMainItems} />
        <NavProjects projects={projectItems} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={userData} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
