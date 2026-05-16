import React from 'react';
import { SidebarTrigger } from './sidebar';
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from './breadcrumb';

interface BreadcrumbItem {
  label: string;
  href?: string;
  isActive?: boolean;
}

export interface PageWrapperProps {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
  breadcrumbs?: BreadcrumbItem[];
  actions?: React.ReactNode;
  className?: string;
  userProfile?: React.ReactNode;
}

export function PageWrapper({
  children,
  title,
  subtitle,
  breadcrumbs,
  actions,
  className = '',
  userProfile,
}: PageWrapperProps) {
  return (
    <>
      {/* ── Typeform-style top header bar ── */}
      <header className="flex h-14 shrink-0 items-center justify-between bg-white dark:bg-card border-b border-[rgba(81,76,84,0.12)] dark:border-white/10 px-3 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12">

        {/* Left: sidebar toggle + breadcrumb */}
        <div className="flex items-center gap-2.5 min-w-0">
          <SidebarTrigger className="h-8 w-8 shrink-0 rounded-lg text-[#655d67] hover:bg-[rgba(87,84,91,0.06)] hover:text-[#3c323e] dark:text-muted-foreground dark:hover:bg-white/5 dark:hover:text-foreground" />
          <div className="w-px h-5 bg-[rgba(81,76,84,0.12)] dark:bg-white/10 shrink-0" />
          <Breadcrumb>
            <BreadcrumbList className="flex-nowrap">
              <BreadcrumbItem>
                <BreadcrumbLink
                  href="/"
                  className="text-[#655d67] dark:text-muted-foreground text-sm font-medium hover:text-[#3c323e] dark:hover:text-foreground transition-colors"
                >
                  Dculus Forms
                </BreadcrumbLink>
              </BreadcrumbItem>
              {breadcrumbs && breadcrumbs.length > 0
                ? breadcrumbs.map((crumb, idx) => (
                    <React.Fragment key={idx}>
                      <BreadcrumbSeparator className="text-[rgba(81,76,84,0.35)]" />
                      <BreadcrumbItem>
                        {crumb.href ? (
                          <BreadcrumbLink
                            href={crumb.href}
                            className={`text-sm font-medium transition-colors ${
                              crumb.isActive
                                ? 'text-[#3c323e] dark:text-foreground'
                                : 'text-[#655d67] dark:text-muted-foreground hover:text-[#3c323e] dark:hover:text-foreground'
                            }`}
                          >
                            {crumb.label}
                          </BreadcrumbLink>
                        ) : (
                          <BreadcrumbPage
                            className={`text-sm font-medium ${
                              crumb.isActive
                                ? 'text-[#3c323e] dark:text-foreground'
                                : 'text-[#655d67] dark:text-muted-foreground'
                            }`}
                          >
                            {crumb.label}
                          </BreadcrumbPage>
                        )}
                      </BreadcrumbItem>
                    </React.Fragment>
                  ))
                : (
                    <React.Fragment>
                      <BreadcrumbSeparator className="text-[rgba(81,76,84,0.35)]" />
                      <BreadcrumbItem>
                        <BreadcrumbPage className="text-sm font-medium text-[#3c323e] dark:text-foreground">
                          {title}
                        </BreadcrumbPage>
                      </BreadcrumbItem>
                    </React.Fragment>
                  )}
            </BreadcrumbList>
          </Breadcrumb>
        </div>

        {/* Right: actions + user avatar */}
        <div className="flex items-center gap-2 shrink-0">
          {actions && (
            <div className="flex items-center gap-2">{actions}</div>
          )}
          {userProfile && (
            <div className="flex items-center">{userProfile}</div>
          )}
        </div>
      </header>

      {/* ── Page content ── */}
      <div className={`flex flex-1 flex-col gap-4 p-6 overflow-y-auto bg-background dark:bg-background ${className}`}>
        {subtitle && (
          <p className="text-sm text-[#655d67] dark:text-muted-foreground -mt-2">{subtitle}</p>
        )}
        {children}
      </div>
    </>
  );
}
