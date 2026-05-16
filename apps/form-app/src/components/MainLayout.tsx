import React from "react"
import { AppSidebar } from "../components/app-sidebar"
import { PageWrapper, SidebarProvider, SidebarInset } from "@dculus/ui"
import { useAuth } from "../contexts/AuthContext"

interface MainLayoutProps {
  children: React.ReactNode
  title?: string
  subtitle?: string
  breadcrumbs?: Array<{ label: string; href?: string; isActive?: boolean }>
}

function HeaderAvatar() {
  const { user } = useAuth()
  if (!user) return null

  const initials = (user.name || user.email || "U")
    .split(" ")
    .map((n: string) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)

  return (
    <div
      title={user.name || user.email}
      className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-semibold text-white shrink-0 select-none"
      style={{ backgroundColor: "#3c323e" }}
    >
      {user.image ? (
        <img
          src={user.image}
          alt={user.name || ""}
          className="h-8 w-8 rounded-full object-cover"
        />
      ) : (
        initials
      )}
    </div>
  )
}

export const MainLayout: React.FC<MainLayoutProps> = ({
  children,
  title,
  subtitle,
  breadcrumbs,
}) => {
  return (
    <SidebarProvider defaultOpen={true}>
      <AppSidebar data-testid="app-sidebar" />
      <SidebarInset>
        <PageWrapper
          title={title ?? ""}
          subtitle={subtitle}
          breadcrumbs={breadcrumbs}
          userProfile={<HeaderAvatar />}
        >
          {children}
        </PageWrapper>
      </SidebarInset>
    </SidebarProvider>
  )
}
