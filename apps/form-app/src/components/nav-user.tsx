import {
  ChevronsUpDown,
  LogOut,
  UserCircle,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  UserAvatar,
  useSidebar,
  toastSuccess,
  toastError,
} from '@dculus/ui';
import { useApolloClient } from '@apollo/client/react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { signOut } from '../lib/auth-client';
import { useTranslation } from '../hooks/useTranslation';

export function NavUser() {
  const { isMobile } = useSidebar();
  const { user } = useAuth();
  const { t } = useTranslation('navUser');
  const apolloClient = useApolloClient();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await apolloClient.clearStore();
      await signOut();
      toastSuccess(t('signOut.success.title'), t('signOut.success.message'));
      window.location.href = '/signin';
    } catch (error) {
      console.error('Logout error:', error);
      toastError(t('signOut.error.title'), t('signOut.error.message'));
    }
  };

  const name = user?.name || t('userInfo.guestUser');
  const email = user?.email || t('userInfo.guestEmail');

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <UserAvatar
                name={user?.name}
                email={user?.email}
                image={user?.image}
                size="md"
                shape="square"
              />
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">{name}</span>
                <span className="truncate text-xs">{email}</span>
              </div>
              <ChevronsUpDown className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
            side={isMobile ? 'bottom' : 'right'}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                <UserAvatar
                  name={user?.name}
                  email={user?.email}
                  image={user?.image}
                  size="md"
                  shape="square"
                />
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">{name}</span>
                  <span className="truncate text-xs">{email}</span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate('/settings/account')}>
              <UserCircle className="mr-2 h-4 w-4" />
              {t('menu.account')}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout}>
              <LogOut className="mr-2 h-4 w-4" />
              {t('menu.logout')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
