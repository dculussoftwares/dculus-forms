import React from "react"
import { AppSidebar } from "../components/app-sidebar"
import { PageWrapper, SidebarProvider, SidebarInset, UserAvatar } from "@dculus/ui"
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

  return (
    <UserAvatar
      name={user.name}
      email={user.email}
      image={user.image}
      size="md"
      shape="square"
    />
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
          userProfile={<HeaderAvatar />}
        >
          {children}
        </PageWrapper>
      </SidebarInset>
    </SidebarProvider>
  )
}
