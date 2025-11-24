import React from "react"
import { AppSidebar } from "../components/app-sidebar"
import { UserProfileMenu } from "../components/UserProfileMenu"
import { LocaleSwitcher } from "./LocaleSwitcher"
import { PageWrapper, SidebarProvider, SidebarInset } from "@dculus/ui"

interface MainLayoutProps {
  children: React.ReactNode
  title?: string
  subtitle?: string
  breadcrumbs?: Array<{ label: string; href?: string; isActive?: boolean }>
}

export const MainLayout: React.FC<MainLayoutProps> = ({ children, title, subtitle, breadcrumbs }) => {
  return (
    <SidebarProvider defaultOpen={false}>
      <AppSidebar data-testid="app-sidebar" />
      <SidebarInset>
        <PageWrapper
          title={title ?? ""}
          subtitle={subtitle}
          breadcrumbs={breadcrumbs}
          userProfile={
            <div className="flex items-center gap-2">
              <LocaleSwitcher />
              <UserProfileMenu />
            </div>
          }
        >
          {children}
        </PageWrapper>
      </SidebarInset>
    </SidebarProvider>
  )
}
