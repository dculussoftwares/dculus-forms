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

/**
 * Breadcrumb item configuration
 * Following Dculus functional programming principles with complete TypeScript safety
 */
interface BreadcrumbItem {
  /** Display label for the breadcrumb */
  label: string;
  /** Optional href for navigation */
  href?: string;
  /** Whether this breadcrumb item is the active page */
  isActive?: boolean;
}

/**
 * PageWrapper component props
 * Following Dculus functional programming principles with complete TypeScript safety
 */
export interface PageWrapperProps {
  /** Main content to be rendered in the page */
  children: React.ReactNode;
  /** Page title displayed in header and breadcrumb */
  title: string;
  /** Optional subtitle displayed below the title */
  subtitle?: string;
  /** Array of breadcrumb items for navigation */
  breadcrumbs?: BreadcrumbItem[];
  /** Optional action buttons or components for the header */
  actions?: React.ReactNode;
  /** Additional CSS classes for the content area */
  className?: string;
}

/**
 * Functional PageWrapper component for consistent page layout
 * Provides header with breadcrumbs, title section, and content area
 * Following Dculus design principles: functional programming first, full type safety
 */
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
