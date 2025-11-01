import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Button,
  toastSuccess,
  toastError,
} from "@dculus/ui"
import {
  User,
  Mail,
  Bell,
  LogOut,
} from "lucide-react"
import { useAuth } from "../contexts/AuthContext"
import { signOut } from "../lib/auth-client"
import { useTranslation } from "../hooks/useTranslation"

export function UserProfileMenu() {
  const { user } = useAuth()
  const { t } = useTranslation('userProfileMenu')

  // Handle sign out
  const handleSignOut = async () => {
    try {
      await signOut()
      toastSuccess(t('signOut.success.title'), t('signOut.success.message'))
      window.location.href = '/signin'
    } catch (error) {
      console.error('Error signing out:', error)
      toastError(t('signOut.error.title'), t('signOut.error.message'))
    }
  }

  // Use authenticated user data or fallback to default
  const userData = {
    name: user?.name || t('userInfo.guestUser'),
    email: user?.email || t('userInfo.guestEmail'),
    avatar: user?.image || "https://github.com/shadcn.png",
  }

  // Get first letter of email for fallback avatar
  const emailInitial = userData.email.charAt(0).toUpperCase()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="h-9 w-9 rounded-full p-0"
        >
          <Avatar className="h-8 w-8">
            <AvatarImage src={userData.avatar} alt={userData.name} />
            <AvatarFallback className="bg-primary text-primary-foreground">
              {emailInitial}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="w-56"
        align="end"
        sideOffset={8}
      >
        <DropdownMenuLabel className="p-0 font-normal">
          <div className="flex items-center gap-2 px-2 py-1.5 text-left text-sm">
            <Avatar className="h-8 w-8">
              <AvatarImage src={userData.avatar} alt={userData.name} />
              <AvatarFallback className="bg-primary text-primary-foreground">
                {emailInitial}
              </AvatarFallback>
            </Avatar>
            <div className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-semibold">{userData.name}</span>
              <span className="truncate text-xs text-muted-foreground">{userData.email}</span>
            </div>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem>
          <User className="mr-2 h-4 w-4" />
          <span>{t('menu.profile')}</span>
        </DropdownMenuItem>
        <DropdownMenuItem>
          <Mail className="mr-2 h-4 w-4" />
          <span>{t('menu.messages')}</span>
        </DropdownMenuItem>
        <DropdownMenuItem>
          <Bell className="mr-2 h-4 w-4" />
          <span>{t('menu.notifications')}</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleSignOut}>
          <LogOut className="mr-2 h-4 w-4" />
          <span>{t('menu.logout')}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
