import React from "react"
import { useLocation } from "react-router-dom"
import {
  LayoutDashboard,
  Settings,
  Plus,
  ChevronsUpDown,
  LogOut,
  User,
  Mail,
  Bell,
  Search,
} from "lucide-react"

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
  Input,
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
  toastSuccess,
  toastError,
} from "@dculus/ui"
import { useAuth } from "../contexts/AuthContext"
import { signOut } from "../lib/auth-client"

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { open } = useSidebar()
  const { user } = useAuth()
  const location = useLocation()
  
  const navigationData = {
    navMain: [
      {
        title: "Dashboard",
        url: "/",
        icon: LayoutDashboard,
        isActive: location.pathname === "/" || location.pathname === "/dashboard",
      },
      {
        title: "Settings",
        url: "/settings",
        icon: Settings,
        isActive: location.pathname === "/settings",
      },
    ],
    recentForms: [],
  }
  
  // Handle sign out
  const handleSignOut = async () => {
    try {
      await signOut()
      toastSuccess('Signed out successfully', 'You have been signed out of your account')
      // Optionally redirect to sign-in page
      window.location.href = '/signin'
    } catch (error) {
      console.error('Error signing out:', error)
      toastError('Sign out failed', 'There was an error signing you out. Please try again.')
    }
  }

  // Use authenticated user data or fallback to default
  const userData = {
    name: user?.name || "Guest User",
    email: user?.email || "guest@example.com",
    avatar: user?.image || "/avatars/default.jpg",
  }
  
  return (
    <Sidebar collapsible="icon" className="flex flex-col" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            {open ? (
              <div className="flex items-center gap-2 px-2">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                  <LayoutDashboard className="size-4" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">Dculus Forms</span>
                  <span className="truncate text-xs">Form Builder</span>
                </div>
              </div>
            ) : (
              <SidebarMenuButton size="lg" className="flex items-center justify-center">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                  <LayoutDashboard className="size-4" />
                </div>
              </SidebarMenuButton>
            )}
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      
      <SidebarContent className="flex-1">
        {open && (
          <div className="px-3 py-2">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search..."
                className="pl-8"
              />
            </div>
          </div>
        )}
        
        <SidebarGroup>
          <SidebarGroupLabel>Main</SidebarGroupLabel>
          <SidebarMenu>
            {navigationData.navMain.map((item: any) => (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton asChild isActive={item.isActive}>
                  <a href={item.url}>
                    {React.createElement(item.icon, { className: open ? undefined : "size-6" })}
                    {open && <span>{item.title}</span>}
                  </a>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>
        
        <SidebarGroup>
          <SidebarGroupLabel>Recent Forms</SidebarGroupLabel>
          <SidebarMenu>
            {navigationData.recentForms.map((item: any) => (
              <SidebarMenuItem key={item.name}>
                <SidebarMenuButton asChild>
                  <a href={item.url}>
                    {React.createElement(item.icon, { className: open ? undefined : "size-6" })}
                    {open && <span>{item.name}</span>}
                  </a>
                </SidebarMenuButton>
                {open && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <SidebarMenuAction showOnHover>
                        <Plus />
                        <span className="sr-only">More</span>
                      </SidebarMenuAction>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      className="w-48 rounded-lg"
                      side="bottom"
                      align="end"
                    >
                      <DropdownMenuItem>
                        <span>Edit Form</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <span>Duplicate Form</span>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem>
                        <span>Archive Form</span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </SidebarMenuItem>
            ))}
            <SidebarMenuItem>
              <SidebarMenuButton className="text-sidebar-foreground/70">
                <Plus className={open ? undefined : "size-6"} />
                {open && <span>Create new form</span>}
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
      
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                >
                  <Avatar className="h-8 w-8 rounded-lg">
                    <AvatarImage src={userData.avatar} alt={userData.name} />
                    <AvatarFallback className="rounded-lg">
                      {userData.name
                        .split(" ")
                        .map((n: string) => n[0])
                        .join("")}
                    </AvatarFallback>
                  </Avatar>
                  {open && (
                    <div className="grid flex-1 text-left text-sm leading-tight">
                      <span className="truncate font-semibold">{userData.name}</span>
                      <span className="truncate text-xs">{userData.email}</span>
                    </div>
                  )}
                  {open && <ChevronsUpDown className="ml-auto size-4" />}
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
                side="bottom"
                align="end"
                sideOffset={4}
              >
                <DropdownMenuLabel className="p-0 font-normal">
                  <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                    <Avatar className="h-8 w-8 rounded-lg">
                      <AvatarImage src={userData.avatar} alt={userData.name} />
                      <AvatarFallback className="rounded-lg">
                        {userData.name
                          .split(" ")
                          .map((n: string) => n[0])
                          .join("")}
                      </AvatarFallback>
                    </Avatar>
                    <div className="grid flex-1 text-left text-sm leading-tight">
                      <span className="truncate font-semibold">{userData.name}</span>
                      <span className="truncate text-xs">{userData.email}</span>
                    </div>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                  <User className="mr-2 h-4 w-4" />
                  <span>Profile</span>
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Mail className="mr-2 h-4 w-4" />
                  <span>Messages</span>
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Bell className="mr-2 h-4 w-4" />
                  <span>Notifications</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut}>
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Log out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
