import React from 'react';
import { SidebarTrigger } from './sidebar';
import { TypographyH3 } from './typography';
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from './breadcrumb';

interface PageWrapperProps {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
  breadcrumbs?: Array<{
    label: string;
    href?: string;
    isActive?: boolean;
  }>;
  actions?: React.ReactNode;
  className?: string;
}

export function PageWrapper({
  children,
  title,
  subtitle,
  breadcrumbs,
  actions,
  className = '',
}: PageWrapperProps) {
  return (
    <>
      {/* Header */}
      <header className="sticky top-0 z-50 flex h-16 shrink-0 items-center gap-2 px-4 bg-background border-b border-border">
        <div className="flex items-center gap-2 w-full">
          <SidebarTrigger className="-ml-1" />
          <div className="h-4 w-px bg-border mx-2" />
          {/* Breadcrumb */}
          <div className="flex-1">
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink href="/">Dculus Forms</BreadcrumbLink>
                </BreadcrumbItem>
                {breadcrumbs && breadcrumbs.length > 0
                  ? breadcrumbs.map((breadcrumb, idx) => (
                      <React.Fragment key={idx}>
                        <BreadcrumbSeparator />
                        <BreadcrumbItem>
                          {breadcrumb.href ? (
                            <BreadcrumbLink href={breadcrumb.href} className={breadcrumb.isActive ? 'text-foreground' : ''}>
                              {breadcrumb.label}
                            </BreadcrumbLink>
                          ) : (
                            <BreadcrumbPage className={breadcrumb.isActive ? 'text-foreground' : ''}>
                              {breadcrumb.label}
                            </BreadcrumbPage>
                          )}
                        </BreadcrumbItem>
                      </React.Fragment>
                    ))
                  : (
                      <React.Fragment>
                        <BreadcrumbSeparator />
                        <BreadcrumbItem>
                          <BreadcrumbPage className="text-foreground">{title}</BreadcrumbPage>
                        </BreadcrumbItem>
                      </React.Fragment>
                    )}
              </BreadcrumbList>
            </Breadcrumb>
          </div>
          {actions && (
            <div className="ml-auto flex items-center gap-2">{actions}</div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <div className={`flex flex-1 flex-col gap-4 p-4 pt-4 overflow-y-auto ${className}`}>
        {/* Page Title Section */}
        <div className="flex items-center justify-between">
          <div>
            <TypographyH3>{title}</TypographyH3>
            {subtitle && (
              <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
            )}
          </div>
        </div>

        {/* Page Content */}
        {children}
      </div>
    </>
  );
}
