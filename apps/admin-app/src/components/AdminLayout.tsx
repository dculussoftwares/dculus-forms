import { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useTranslation } from '../hooks/useTranslation';
import { Button } from '@dculus/ui';
import { 
  LayoutDashboard, 
  Building2, 
  Users, 
  FileText, 
  Settings, 
  LogOut,
  Crown
} from 'lucide-react';
import { cn } from '@dculus/utils';

interface AdminLayoutProps {
  children: ReactNode;
}

interface NavItem {
  name: string;
  href: string;
  icon: React.ElementType;
  current?: boolean;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const { user, signOut, isSuperAdmin } = useAuth();
  const location = useLocation();
  const { t } = useTranslation('layout');

  const navigation: NavItem[] = [
    {
      name: t('navigation.dashboard'),
      href: '/dashboard',
      icon: LayoutDashboard,
      current: location.pathname === '/dashboard',
    },
    {
      name: t('navigation.organizations'),
      href: '/organizations',
      icon: Building2,
      current: location.pathname === '/organizations',
    },
    {
      name: t('navigation.users'),
      href: '/users',
      icon: Users,
      current: location.pathname === '/users',
    },
    {
      name: t('navigation.templates'),
      href: '/templates',
      icon: FileText,
      current: location.pathname === '/templates',
    },
    {
      name: t('navigation.settings'),
      href: '/settings',
      icon: Settings,
      current: location.pathname === '/settings',
    },
  ];

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Sidebar */}
      <div className="fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-lg">
        <div className="flex h-16 shrink-0 items-center px-6 border-b">
          <div className="flex items-center">
            <Crown className="h-8 w-8 text-blue-600 mr-3" />
            <div>
              <h1 className="text-xl font-bold text-gray-900">{t('sidebar.title')}</h1>
              <p className="text-xs text-gray-500">{t('sidebar.subtitle')}</p>
            </div>
          </div>
        </div>
        
        <nav className="flex flex-1 flex-col px-4 py-4">
          <ul role="list" className="flex flex-1 flex-col gap-y-2">
            {navigation.map((item) => (
              <li key={item.name}>
                <Link
                  to={item.href}
                  className={cn(
                    item.current
                      ? 'bg-blue-50 text-blue-700 border-blue-200'
                      : 'text-gray-700 hover:text-blue-700 hover:bg-blue-50',
                    'group flex gap-x-3 rounded-md p-3 text-sm leading-6 font-medium border border-transparent hover:border-blue-200 transition-colors'
                  )}
                >
                  <item.icon
                    className={cn(
                      item.current ? 'text-blue-700' : 'text-gray-400 group-hover:text-blue-700',
                      'h-5 w-5 shrink-0'
                    )}
                    aria-hidden="true"
                  />
                  {item.name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {/* User info and sign out */}
        <div className="border-t border-gray-200 p-4">
          <div className="flex items-center mb-3">
            <div className="flex-shrink-0">
              <div className="h-8 w-8 rounded-full bg-blue-600 flex items-center justify-center">
                <span className="text-sm font-medium text-white">
                  {user?.name?.charAt(0).toUpperCase() || 'A'}
                </span>
              </div>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-700">{user?.name}</p>
              <div className="flex items-center">
                <p className="text-xs text-gray-500">{user?.email}</p>
                {isSuperAdmin && (
                  <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                    {t('userMenu.superAdmin')}
                  </span>
                )}
              </div>
            </div>
          </div>
          <Button
            onClick={handleSignOut}
            variant="outline"
            size="sm"
            className="w-full justify-start"
          >
            <LogOut className="h-4 w-4 mr-2" />
            {t('userMenu.signOut')}
          </Button>
        </div>
      </div>

      {/* Main content */}
      <div className="pl-64">
        <main className="py-8">
          <div className="px-4 sm:px-6 lg:px-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}