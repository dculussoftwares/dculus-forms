import { ReactNode, useState } from 'react';
import { Link, useLocation } from 'react-router';
import { useAuth } from '../hooks/useAuth';
import { useTranslation } from '../hooks/useTranslation';
import { Button } from '@dculus/ui';
import {
  LayoutDashboard,
  Building2,
  Users,
  FileText,
  LogOut,
  Shield,
  Mail,
} from 'lucide-react';

interface AdminLayoutProps {
  children: ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const { user, signOut, isSuperAdmin } = useAuth();
  const location = useLocation();
  const { t } = useTranslation('layout');
  const [hoveredNav, setHoveredNav] = useState<string | null>(null);

  const navigation = [
    { name: t('navigation.dashboard'),     href: '/dashboard',     icon: LayoutDashboard },
    { name: t('navigation.organizations'), href: '/organizations', icon: Building2 },
    { name: t('navigation.users'),         href: '/users',         icon: Users },
    { name: t('navigation.templates'),     href: '/templates',     icon: FileText },
    { name: t('navigation.emailPreviews'), href: '/email-previews', icon: Mail },
  ];

  const initials = (user?.name || user?.email || 'A').split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);

  const getNavStyle = (isActive: boolean, name: string) => ({
    backgroundColor: isActive
      ? 'var(--tf-tab-bg)'
      : hoveredNav === name ? 'var(--tf-tab-bg-faint)' : 'transparent',
    color: isActive ? 'var(--tf-dark)' : hoveredNav === name ? 'var(--tf-text)' : 'var(--tf-muted)',
  });

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--tf-faint)' }}>
      {/* Sidebar */}
      <div
        className="fixed inset-y-0 left-0 z-50 w-60 bg-white flex flex-col"
        style={{ borderRight: '1px solid var(--tf-border-medium)' }}
      >
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-5 h-14 shrink-0" style={{ borderBottom: '1px solid var(--tf-border-medium)' }}>
          <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: 'var(--tf-dark)' }}>
            <Shield className="h-3.5 w-3.5 text-white" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate text-primary">{t('sidebar.title')}</p>
            <p className="text-[11px] truncate text-muted-foreground">{t('sidebar.subtitle')}</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {navigation.map((item) => {
            const isActive = location.pathname === item.href;
            return (
              <Link
                key={item.name}
                to={item.href}
                className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                style={getNavStyle(isActive, item.name)}
                onMouseEnter={() => !isActive && setHoveredNav(item.name)}
                onMouseLeave={() => setHoveredNav(null)}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                {item.name}
              </Link>
            );
          })}
        </nav>

        {/* User footer */}
        <div className="shrink-0 px-3 pb-4" style={{ borderTop: '1px solid var(--tf-border-medium)', paddingTop: '12px' }}>
          <div className="flex items-center gap-2.5 px-2 mb-3">
            <div className="h-7 w-7 rounded-full flex items-center justify-center shrink-0 text-xs font-semibold text-white" style={{ backgroundColor: 'var(--tf-dark)' }}>
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate text-primary">{user?.name}</p>
              <div className="flex items-center gap-1.5">
                <p className="text-[11px] truncate text-muted-foreground">{user?.email}</p>
                {isSuperAdmin && (
                  <span className="px-1.5 py-0.5 rounded text-[11px] font-medium shrink-0" style={{ backgroundColor: '#fbe19d', color: '#8b6a18' }}>
                    {t('userMenu.superAdmin')}
                  </span>
                )}
              </div>
            </div>
          </div>
          <Button
            onClick={signOut}
            variant="ghost"
            className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-xs font-medium justify-start"
          >
            <LogOut className="h-3.5 w-3.5" />
            {t('userMenu.signOut')}
          </Button>
        </div>
      </div>

      {/* Main content */}
      <div className="pl-60">
        <main className="min-h-screen">
          <div className="px-6 py-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
