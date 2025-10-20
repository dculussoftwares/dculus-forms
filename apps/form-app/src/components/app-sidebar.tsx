import React from "react"
import { useLocation } from "react-router-dom"
import {
  LayoutDashboard,
  Settings,
  Search,
  Layers,
} from "lucide-react"

import {
  Input,
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@dculus/ui"
import { useAuth } from "../contexts/AuthContext"

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { open } = useSidebar()
  const { activeOrganization } = useAuth()
  const location = useLocation()

  const navigationData = {
    navMain: [
      {
        title: "Dashboard",
        url: "/dashboard",
        icon: LayoutDashboard,
        isActive: location.pathname === "/" || location.pathname === "/dashboard" || location.pathname.startsWith("/dashboard"),
      },
      {
        title: "Templates",
        url: "/dashboard/templates",
        icon: Layers,
        isActive: location.pathname === "/dashboard/templates",
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
  
  return (
    <Sidebar collapsible="icon" {...props}>
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
        {/* Organization Display */}
        {open && activeOrganization && (
          <div className="px-3 py-2 border-b border-sidebar-border">
            <div className="flex items-center gap-2 p-2 rounded-lg bg-sidebar-accent">
              <div className="flex aspect-square size-6 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                <span className="text-xs font-medium">
                  {activeOrganization.name.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="flex-1 text-left min-w-0">
                <div className="text-sm font-medium truncate">
                  {activeOrganization.name}
                </div>
                <div className="text-xs text-muted-foreground truncate">
                  Organization
                </div>
              </div>
            </div>
          </div>
        )}

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
        
      </SidebarContent>
    </Sidebar>
  )
}
