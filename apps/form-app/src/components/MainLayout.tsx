import React from "react"
import { useNavigate } from "react-router-dom"
import { LogOut, UserCircle } from "lucide-react"
import { useApolloClient } from "@apollo/client"
import { AppSidebar } from "../components/app-sidebar"
import {
  PageWrapper,
  SidebarProvider,
  SidebarInset,
  UserAvatar,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  toastSuccess,
  toastError,
} from "@dculus/ui"
import { useAuth } from "../contexts/AuthContext"
import { signOut } from "../lib/auth-client"
import { useTranslation } from "../hooks/useTranslation"

interface MainLayoutProps {
  children: React.ReactNode
  title?: string
  subtitle?: string
  breadcrumbs?: Array<{ label: string; href?: string; isActive?: boolean }>
}

function TopbarUserMenu() {
  const { user } = useAuth()
  const { t } = useTranslation('navUser')
  const apolloClient = useApolloClient()
  const navigate = useNavigate()

  if (!user) return null

  const name = user.name || t('userInfo.guestUser')
  const email = user.email || t('userInfo.guestEmail')

  const handleLogout = async () => {
    try {
      await apolloClient.clearStore()
      await signOut()
      toastSuccess(t('signOut.success.title'), t('signOut.success.message'))
      window.location.href = '/signin'
    } catch (error) {
      console.error('Logout error:', error)
      toastError(t('signOut.error.title'), t('signOut.error.message'))
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <UserAvatar
            name={user.name}
            email={user.email}
            image={user.image}
            size="md"
            shape="square"
          />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="min-w-56 rounded-lg" side="bottom" align="end" sideOffset={6}>
        <DropdownMenuLabel className="p-0 font-normal">
          <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
            <UserAvatar
              name={user.name}
              email={user.email}
              image={user.image}
              size="md"
              shape="square"
            />
            <div className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-semibold">{name}</span>
              <span className="truncate text-xs text-muted-foreground">{email}</span>
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
  )
}

export const MainLayout: React.FC<MainLayoutProps> = ({
  children,
  title,
  subtitle,
  breadcrumbs,
}) => {
  return (
    <SidebarProvider defaultOpen={false}>
      <AppSidebar data-testid="app-sidebar" />
      <SidebarInset>
        <PageWrapper
          title={title ?? ""}
          subtitle={subtitle}
          breadcrumbs={breadcrumbs}
          userProfile={<TopbarUserMenu />}
        >
          {children}
        </PageWrapper>
      </SidebarInset>
    </SidebarProvider>
  )
}
