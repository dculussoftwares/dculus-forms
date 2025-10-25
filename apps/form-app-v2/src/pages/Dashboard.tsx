import { useMemo, type MouseEvent } from 'react';
import { AppSidebar } from '@/components/app-sidebar';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  Separator,
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
  Skeleton,
  cn,
  toast,
} from '@dculus/ui-v2';
import { FileText, Filter, Plus, Search, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { FormCard } from '../components/dashboard';
import { useAuth } from '../contexts/AuthContext';
import {
  useFormsDashboard,
  type FilterCategory,
  type FormsListItem,
} from '../hooks/useFormsDashboard';
import { getFormViewerUrl } from '../lib/config';

const FILTER_OPTIONS: Array<{ label: string; value: FilterCategory }> = [
  { label: 'All Forms', value: 'all' },
  { label: 'My Forms', value: 'my-forms' },
  { label: 'Shared with Me', value: 'shared-with-me' },
];

export const Dashboard = () => {
  const navigate = useNavigate();
  const { user, activeOrganization } = useAuth();
  const {
    searchTerm,
    setSearchTerm,
    activeFilter,
    handleFilterChange,
    currentPage,
    handlePageChange,
    isPageChanging,
    isTyping,
    formsLoading,
    displayForms,
    contentRef,
    clearSearch,
  } = useFormsDashboard({
    organizationId: activeOrganization?.id,
  });

  const isOrgReady = Boolean(activeOrganization);
  const hasForms = displayForms.forms.length > 0;
  const showEmptyState = !formsLoading && !hasForms && !!activeOrganization;
  const showOrganizationNotice = !activeOrganization && !formsLoading;

  const paginationItems = useMemo<(number | 'ellipsis')[]>(() => {
    const pagination = displayForms.pagination;
    if (!pagination) return [];

    const totalPages = pagination.totalPages;
    const current = pagination.page;

    if (totalPages <= 5) {
      return Array.from({ length: totalPages }, (_, index) => index + 1);
    }

    const items: Array<number | 'ellipsis'> = [1];
    const showLeftEllipsis = current > 3;
    const showRightEllipsis = current < totalPages - 2;

    const start = Math.max(2, current - 1);
    const end = Math.min(totalPages - 1, current + 1);

    if (showLeftEllipsis) {
      items.push('ellipsis');
    }

    for (let page = start; page <= end; page += 1) {
      items.push(page);
    }

    if (showRightEllipsis) {
      items.push('ellipsis');
    }

    if (totalPages > 1) {
      items.push(totalPages);
    }

    return items.filter((value, index, array) => {
      if (
        value === 'ellipsis' &&
        index > 0 &&
        array[index - 1] === 'ellipsis'
      ) {
        return false;
      }
      return true;
    });
  }, [displayForms.pagination, currentPage]);

  const handleOpenDashboard = (formId: string) => {
    navigate(`/dashboard/form/${formId}`);
  };

  const handleOpenBuilder = (formId: string) => {
    // TODO: route to dedicated builder workspace when available
    navigate(`/dashboard/form/${formId}`);
  };

  const handleOpenPreview = (form: FormsListItem) => {
    if (!form.shortUrl) {
      toast('Preview unavailable', {
        description: 'This form does not have a published short link yet.',
      });
      return;
    }

    const viewerUrl = getFormViewerUrl(form.shortUrl);
    window.open(viewerUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <SidebarProvider defaultOpen>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 border-b bg-background/80 backdrop-blur transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12">
          <div className="flex flex-1 items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 h-6" />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem className="hidden md:block">
                  <BreadcrumbLink href="/">Dashboard</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden md:block" />
                <BreadcrumbItem>
                  <BreadcrumbPage>Forms</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
        </header>

        <div
          ref={contentRef}
          className="flex flex-1 flex-col gap-6 overflow-y-auto px-4 py-6 sm:px-6 lg:px-8"
        >
          <Card className="bg-gradient-to-r from-primary/10 via-primary/5 to-primary/10">
            <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <CardTitle className="text-xl font-semibold">
                  {user?.name
                    ? `Welcome back, ${user.name}!`
                    : 'Welcome to Dculus Forms'}
                </CardTitle>
                <CardDescription>
                  {activeOrganization
                    ? `You are working inside ${activeOrganization.name}. Pick up where you left off or create something new.`
                    : 'Join or create an organization to start building forms.'}
                </CardDescription>
              </div>
              <Button
                size="lg"
                className="gap-2"
                onClick={() => navigate('/dashboard/templates')}
              >
                <Plus className="h-4 w-4" />
                Create Form
              </Button>
            </CardHeader>
          </Card>

          <Card className="border border-border/70 shadow-sm">
            <CardHeader className="space-y-4 border-b bg-muted/30">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-2 whitespace-nowrap">
                    {FILTER_OPTIONS.map((option) => (
                      <Button
                        key={option.value}
                        size="sm"
                        variant={
                          activeFilter === option.value ? 'default' : 'outline'
                        }
                        className={cn(
                          'h-8 gap-2 rounded-full px-3',
                          activeFilter === option.value
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-background'
                        )}
                        onClick={() => handleFilterChange(option.value)}
                        disabled={!isOrgReady}
                      >
                        {option.label}
                        <span className="rounded-full bg-muted/80 px-1.5 text-[0.65rem] font-semibold text-muted-foreground">
                          {option.value === 'all'
                            ? displayForms.totalCounts.all
                            : option.value === 'my-forms'
                              ? displayForms.totalCounts.myForms
                              : displayForms.totalCounts.sharedForms}
                        </span>
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
                  <div className="relative w-full sm:w-64">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={searchTerm}
                      onChange={(event) => setSearchTerm(event.target.value)}
                      placeholder="Search forms by title or description"
                      className="pl-9"
                      disabled={!isOrgReady}
                    />
                    {isTyping && (
                      <div className="absolute right-10 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                        Searching…
                      </div>
                    )}
                    {searchTerm && isOrgReady && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2"
                        onClick={clearSearch}
                      >
                        <span className="sr-only">Clear search</span>
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-6 p-6">
              {formsLoading && (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {Array.from({ length: 6 }).map((_, index) => (
                    <Skeleton key={index} className="h-64 rounded-xl" />
                  ))}
                </div>
              )}

              {showOrganizationNotice && (
                <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-border/70 bg-muted/20 p-12 text-center">
                  <Filter className="h-10 w-10 text-muted-foreground" />
                  <div className="space-y-2">
                    <h3 className="text-lg font-semibold">
                      No organization selected
                    </h3>
                    <p className="max-w-md text-sm text-muted-foreground">
                      Join an existing organization or create a new one to start
                      managing forms. Organization access controls collaboration
                      and permissions.
                    </p>
                  </div>
                  <Button onClick={() => navigate('/dashboard/templates')}>
                    Explore templates
                  </Button>
                </div>
              )}

              {showEmptyState && (
                <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-border/70 bg-muted/20 p-12 text-center">
                  <FileText className="h-10 w-10 text-primary" />
                  <div className="space-y-2">
                    <h3 className="text-lg font-semibold">No forms yet</h3>
                    <p className="max-w-md text-sm text-muted-foreground">
                      Create your first form or import an existing workflow to
                      begin collecting responses. You can always revisit
                      templates for inspiration.
                    </p>
                  </div>
                  <Button onClick={() => navigate('/dashboard/templates')}>
                    Create your first form
                  </Button>
                </div>
              )}

              {!formsLoading && hasForms && (
                <div>
                  <div
                    className={cn(
                      'grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4',
                      isPageChanging && 'opacity-50 transition-opacity'
                    )}
                  >
                    {displayForms.forms.map((form) => (
                      <FormCard
                        key={form.id}
                        form={form}
                        showPermissionBadge={displayForms.showPermissionBadge}
                        onOpenDashboard={handleOpenDashboard}
                        onOpenBuilder={handleOpenBuilder}
                        onOpenPreview={handleOpenPreview}
                      />
                    ))}
                  </div>
                </div>
              )}

              {displayForms.pagination &&
                displayForms.pagination.totalPages > 1 &&
                !formsLoading && (
                  <div className="flex flex-col items-center justify-center gap-3 border-t pt-4">
                    <Pagination>
                      <PaginationContent>
                        <PaginationItem>
                          <PaginationPrevious
                            href="#"
                            className={cn(
                              !displayForms.pagination.hasPreviousPage &&
                                'pointer-events-none opacity-50'
                            )}
                            onClick={(event: MouseEvent<HTMLAnchorElement>) => {
                              event.preventDefault();
                              if (displayForms.pagination?.hasPreviousPage) {
                                handlePageChange(currentPage - 1);
                              }
                            }}
                          />
                        </PaginationItem>
                        {paginationItems.map((item, index) => (
                          <PaginationItem key={`${item}-${index}`}>
                            {item === 'ellipsis' ? (
                              <PaginationEllipsis />
                            ) : (
                              <PaginationLink
                                href="#"
                                isActive={item === currentPage}
                                onClick={(
                                  event: MouseEvent<HTMLAnchorElement>
                                ) => {
                                  event.preventDefault();
                                  if (item !== currentPage) {
                                    handlePageChange(item);
                                  }
                                }}
                              >
                                {item}
                              </PaginationLink>
                            )}
                          </PaginationItem>
                        ))}
                        <PaginationItem>
                          <PaginationNext
                            href="#"
                            className={cn(
                              !displayForms.pagination.hasNextPage &&
                                'pointer-events-none opacity-50'
                            )}
                            onClick={(event: MouseEvent<HTMLAnchorElement>) => {
                              event.preventDefault();
                              if (displayForms.pagination?.hasNextPage) {
                                handlePageChange(currentPage + 1);
                              }
                            }}
                          />
                        </PaginationItem>
                      </PaginationContent>
                    </Pagination>
                    <span className="text-xs text-muted-foreground">
                      Page {displayForms.pagination.page} of{' '}
                      {displayForms.pagination.totalPages}
                    </span>
                  </div>
                )}
            </CardContent>
          </Card>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
};
