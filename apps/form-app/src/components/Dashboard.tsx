import {
  Card,
  CardContent,
  TypographySmall,
  TypographyMuted,
  TypographyH3,
  Button,
  Input,
  Pagination,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@dculus/ui';
import { MainLayout } from './MainLayout';
import { useTranslation } from 'react-i18next';
import {
  FileText,
  Eye,
  Plus,
  Users2,
  Edit3,
  Search,
  X,
  Loader2,
  ChevronsUpDown,
} from 'lucide-react';
import { useNavigate, Routes, Route, useSearchParams } from 'react-router-dom';
import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useQuery } from '@apollo/client';
import {
  GET_ACTIVE_ORGANIZATION,
  GET_MY_FORMS_WITH_CATEGORY,
  GET_SHARED_FORMS_WITH_CATEGORY,
} from '../graphql/queries';
import Templates from '../pages/Templates';
import FormDashboard from '../pages/FormDashboard';
import { FilterChip } from './ui/FilterChip';

export function Dashboard() {
  return (
    <Routes>
      <Route
        path="templates"
        element={
          <MainLayout
            title="Templates"
            subtitle="Browse and select a template to start a new form"
            breadcrumbs={[
              { label: 'Dashboard', href: '/dashboard' },
              { label: 'Templates', isActive: true },
            ]}
          >
            <Templates />
          </MainLayout>
        }
      />
      <Route path="form/:formId" element={<FormDashboard />} />
      <Route path="*" element={<FormsListDashboard />} />
    </Routes>
  );
}

type FilterCategory = 'all' | 'my-forms' | 'shared-with-me';

const PAGE_SIZE_OPTIONS = [12, 24, 50, 100] as const;

function FormsListDashboard() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const contentRef = useRef<HTMLDivElement>(null);
  const { t } = useTranslation('dashboard');

  // P0: Persist state in URL params
  const urlPage = parseInt(searchParams.get('page') || '1', 10);
  const urlSearch = searchParams.get('search') || '';
  const urlFilter = (searchParams.get('filter') ||
    'my-forms') as FilterCategory;
  const urlPageSize = parseInt(searchParams.get('pageSize') || '12', 10);

  const [searchTerm, setSearchTerm] = useState(urlSearch);
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState(urlSearch);
  const [activeFilter, setActiveFilter] = useState<FilterCategory>(urlFilter);
  const [currentPage, setCurrentPage] = useState(urlPage);
  const [pageSize, setPageSize] = useState(urlPageSize);
  const [isPageChanging, setIsPageChanging] = useState(false);
  const [jumpToPageInput, setJumpToPageInput] = useState('');

  const { data: orgData } = useQuery(GET_ACTIVE_ORGANIZATION);

  // Debounce search term to avoid excessive queries
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 500); // Wait 500ms after user stops typing

    return () => clearTimeout(timer);
  }, [searchTerm]);

  // P0: Update URL params when state changes
  useEffect(() => {
    const params = new URLSearchParams();
    if (currentPage > 1) params.set('page', currentPage.toString());
    if (debouncedSearchTerm) params.set('search', debouncedSearchTerm);
    if (activeFilter !== 'my-forms') params.set('filter', activeFilter);
    if (pageSize !== 12) params.set('pageSize', pageSize.toString());

    setSearchParams(params, { replace: true });
  }, [
    currentPage,
    debouncedSearchTerm,
    activeFilter,
    pageSize,
    setSearchParams,
  ]);

  // Reset to page 1 when search or pageSize changes
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchTerm, pageSize]);

  // Reset to page 1 when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [activeFilter]);

  // P0 FIX: Properly fetch both queries for "all" filter
  const shouldFetchMyForms =
    activeFilter === 'my-forms' || activeFilter === 'all';
  const shouldFetchSharedForms =
    activeFilter === 'shared-with-me' || activeFilter === 'all';

  // For "all" filter, we need to fetch ALL results up to current page * pageSize
  // This ensures we have enough data to display the correct page after merging
  const getQueryVariables = useCallback(() => {
    if (activeFilter !== 'all') {
      // Single query mode - fetch normally
      return {
        page: currentPage,
        limit: pageSize,
      };
    }

    // Combined mode - fetch ALL results up to current page * pageSize
    // This ensures we have enough data to display the correct page
    return {
      page: 1,
      limit: currentPage * pageSize,
    };
  }, [activeFilter, currentPage, pageSize]);

  // Separate queries for each category with pagination
  const {
    data: myFormsData,
    loading: myFormsLoading,
    error: myFormsError,
  } = useQuery(GET_MY_FORMS_WITH_CATEGORY, {
    variables: {
      organizationId: orgData?.activeOrganization?.id,
      ...getQueryVariables(),
      filters: debouncedSearchTerm.trim()
        ? { search: debouncedSearchTerm.trim() }
        : undefined,
    },
    skip: !orgData?.activeOrganization?.id || !shouldFetchMyForms,
    notifyOnNetworkStatusChange: true, // Important for loading states
  });

  const {
    data: sharedFormsData,
    loading: sharedFormsLoading,
    error: sharedFormsError,
  } = useQuery(GET_SHARED_FORMS_WITH_CATEGORY, {
    variables: {
      organizationId: orgData?.activeOrganization?.id,
      ...getQueryVariables(),
      filters: debouncedSearchTerm.trim()
        ? { search: debouncedSearchTerm.trim() }
        : undefined,
    },
    skip: !orgData?.activeOrganization?.id || !shouldFetchSharedForms,
    notifyOnNetworkStatusChange: true,
  });

  // Extract forms and pagination info from responses
  const myForms = myFormsData?.formsWithCategory?.forms || [];
  const myFormsPagination = myFormsData?.formsWithCategory;

  const sharedForms = sharedFormsData?.formsWithCategory?.forms || [];
  const sharedFormsPagination = sharedFormsData?.formsWithCategory;

  // Total counts for filter chips
  const myFormsTotalCount = myFormsPagination?.totalCount || 0;
  const sharedFormsTotalCount = sharedFormsPagination?.totalCount || 0;
  const allFormsTotalCount = myFormsTotalCount + sharedFormsTotalCount;

  // Loading and error states
  const formsLoading = myFormsLoading || sharedFormsLoading;
  const formsError = myFormsError || sharedFormsError;

  // Show typing indicator when user is typing but query hasn't fired yet
  const isTyping = searchTerm !== debouncedSearchTerm && searchTerm.length > 0;

  // Determine which forms to display based on filter
  const displayForms = useMemo(() => {
    if (activeFilter === 'my-forms') {
      return {
        forms: myForms,
        pagination: myFormsPagination,
        showPermissionBadge: false,
      };
    } else if (activeFilter === 'shared-with-me') {
      return {
        forms: sharedForms,
        pagination: sharedFormsPagination,
        showPermissionBadge: true,
      };
    } else {
      // P0 FIX: Properly merge and paginate "all" results
      const allForms = [...myForms, ...sharedForms];

      // Sort by creation date (newest first)
      allForms.sort((a, b) => {
        const dateA = new Date(a.createdAt).getTime();
        const dateB = new Date(b.createdAt).getTime();
        return dateB - dateA;
      });

      // Client-side pagination for merged results
      const startIndex = (currentPage - 1) * pageSize;
      const endIndex = startIndex + pageSize;
      const paginatedForms = allForms.slice(startIndex, endIndex);

      const totalCount = myFormsTotalCount + sharedFormsTotalCount;
      const totalPages = Math.ceil(totalCount / pageSize);

      // Create combined pagination info
      const combinedPagination = {
        forms: paginatedForms,
        totalCount,
        page: currentPage,
        limit: pageSize,
        totalPages,
        hasNextPage: currentPage < totalPages,
        hasPreviousPage: currentPage > 1,
      };

      return {
        forms: paginatedForms,
        pagination: combinedPagination,
        showPermissionBadge: true, // Show badges to distinguish form ownership
      };
    }
  }, [
    activeFilter,
    myForms,
    sharedForms,
    myFormsPagination,
    sharedFormsPagination,
    myFormsTotalCount,
    sharedFormsTotalCount,
    currentPage,
    pageSize,
  ]);

  // P0 & P1: Smooth page change with loading overlay
  const handlePageChange = useCallback((page: number) => {
    setIsPageChanging(true);
    setCurrentPage(page);
    setJumpToPageInput('');

    // P1: Smooth scroll to top
    if (contentRef.current) {
      contentRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    setTimeout(() => setIsPageChanging(false), 400);
  }, []);

  // P1: Jump to page functionality
  const handleJumpToPage = useCallback(() => {
    const pageNum = parseInt(jumpToPageInput, 10);
    const maxPages = displayForms.pagination?.totalPages || 1;

    if (pageNum >= 1 && pageNum <= maxPages) {
      handlePageChange(pageNum);
    }
  }, [jumpToPageInput, displayForms.pagination, handlePageChange]);

  // P1: Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle if not typing in an input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      const pagination = displayForms.pagination;
      if (!pagination) return;

      if (e.key === 'ArrowLeft' && pagination.hasPreviousPage) {
        e.preventDefault();
        handlePageChange(currentPage - 1);
      } else if (e.key === 'ArrowRight' && pagination.hasNextPage) {
        e.preventDefault();
        handlePageChange(currentPage + 1);
      } else if (e.key === 'Home' && currentPage !== 1) {
        e.preventDefault();
        handlePageChange(1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentPage, displayForms.pagination, handlePageChange]);

  const clearSearch = useCallback(() => {
    setSearchTerm('');
  }, []);

  const handleFilterChange = useCallback((filter: FilterCategory) => {
    setActiveFilter(filter);
  }, []);

  const handlePageSizeChange = useCallback((newPageSize: string) => {
    setPageSize(parseInt(newPageSize, 10));
  }, []);

  return (
    <MainLayout
      title={t('navigation.breadcrumb')}
      subtitle="Create, manage, and analyze your forms"
      breadcrumbs={[{ label: t('navigation.breadcrumb'), isActive: true }]}
    >
      <div className="space-y-8" ref={contentRef}>
        {/* Header with Create Form Button */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <TypographyH3 className="text-2xl font-bold tracking-tight">
              {t('forms.myForms')}
            </TypographyH3>
          </div>
          <Button
            onClick={() => navigate('/dashboard/templates')}
            className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg"
            size="lg"
          >
            <Plus className="mr-2 h-5 w-5" />
            {t('forms.actions.createForm')}
          </Button>
        </div>

        {/* Search Bar - Show during loading or when forms exist */}
        {(formsLoading || allFormsTotalCount > 0) && (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder={t('forms.searchPlaceholder')}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-10"
                />
                {isTyping && (
                  <div className="absolute right-10 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                    {t('forms.searching')}
                  </div>
                )}
                {searchTerm && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearSearch}
                    className="absolute right-1 top-1/2 h-7 w-7 p-0 -translate-y-1/2 hover:bg-muted"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>

            {/* Filter Chips */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex flex-wrap gap-2">
                <FilterChip
                  selected={activeFilter === 'all'}
                  onClick={() => handleFilterChange('all')}
                  variant="default"
                >
                  All Forms ({allFormsTotalCount})
                </FilterChip>
                <FilterChip
                  selected={activeFilter === 'my-forms'}
                  onClick={() => handleFilterChange('my-forms')}
                  variant="default"
                >
                  My Forms ({myFormsTotalCount})
                </FilterChip>
                <FilterChip
                  selected={activeFilter === 'shared-with-me'}
                  onClick={() => handleFilterChange('shared-with-me')}
                  variant="default"
                >
                  Shared With Me ({sharedFormsTotalCount})
                </FilterChip>
              </div>

              {/* Page Size Selector - P1 */}
              <div className="flex items-center gap-2 ml-auto">
                <TypographySmall className="text-muted-foreground">
                  {t('forms.filters.show')}:
                </TypographySmall>
                <Select
                  value={pageSize.toString()}
                  onValueChange={handlePageSizeChange}
                  disabled={formsLoading}
                >
                  <SelectTrigger className="w-20 h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAGE_SIZE_OPTIONS.map((size) => (
                      <SelectItem key={size} value={size.toString()}>
                        {size}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <TypographySmall className="text-muted-foreground">
                  {t('forms.filters.perPage')}
                </TypographySmall>
              </div>
            </div>
          </div>
        )}

        {/* Forms Grid */}
        {formsLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <Card key={i} className="overflow-hidden animate-pulse">
                <div className="h-48 bg-muted"></div>
                <CardContent className="p-6 space-y-3">
                  <div className="h-4 bg-muted rounded w-3/4"></div>
                  <div className="h-3 bg-muted rounded w-1/2"></div>
                  <div className="flex gap-2 pt-2">
                    <div className="h-6 bg-muted rounded w-16"></div>
                    <div className="h-6 bg-muted rounded w-20"></div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : formsError ? (
          <div className="text-center py-12">
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-8 max-w-md mx-auto">
              <div className="text-destructive font-medium mb-2">
                {t('errors.loadingError')}
              </div>
              <div className="text-muted-foreground text-sm">
                {t('errors.loadingErrorDescription')}
              </div>
            </div>
          </div>
        ) : allFormsTotalCount === 0 ? (
          <div className="text-center py-20">
            <div className="bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-200 rounded-xl p-12 max-w-lg mx-auto">
              <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-primary/10 flex items-center justify-center">
                <FileText className="w-8 h-8 text-primary" />
              </div>
              <TypographyH3 className="text-xl font-semibold mb-3">
                No forms yet
              </TypographyH3>
              <TypographyMuted className="text-muted-foreground mb-6 max-w-sm mx-auto">
                Get started by creating your first form from one of our
                beautiful templates
              </TypographyMuted>
              <Button
                onClick={() => navigate('/dashboard/templates')}
                size="lg"
                className="bg-primary hover:bg-primary/90"
              >
                <Plus className="mr-2 h-5 w-5" />
                Create Your First Form
              </Button>
            </div>
          </div>
        ) : displayForms.forms.length === 0 && searchTerm ? (
          <div className="text-center py-20">
            <div className="bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-200 rounded-xl p-12 max-w-lg mx-auto">
              <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-primary/10 flex items-center justify-center">
                <Search className="w-8 h-8 text-primary" />
              </div>
              <TypographyH3 className="text-xl font-semibold mb-3">
                No forms found
              </TypographyH3>
              <TypographyMuted className="text-muted-foreground mb-6 max-w-sm mx-auto">
                No forms match your search for "{searchTerm}". Try a different
                search term.
              </TypographyMuted>
              <Button onClick={clearSearch} variant="outline" size="lg">
                <X className="mr-2 h-4 w-4" />
                Clear Search
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* P0: Page-change loading overlay */}
            <div className="relative">
              {isPageChanging && (
                <div className="absolute inset-0 bg-white/60 backdrop-blur-sm z-10 flex items-center justify-center rounded-lg">
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <TypographySmall className="text-muted-foreground">
                      {t('forms.pagination.loadingPage', { page: currentPage })}
                    </TypographySmall>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {displayForms.forms.map((form: any) => (
                  <FormCard
                    key={form.id}
                    form={form}
                    onNavigate={navigate}
                    showPermissionBadge={
                      displayForms.showPermissionBadge ||
                      (activeFilter === 'all' && form.userPermission)
                    }
                  />
                ))}
              </div>
            </div>

            {/* Pagination with Jump to Page */}
            {displayForms.pagination &&
              displayForms.pagination.totalPages > 1 && (
                <div className="flex flex-row flex-wrap items-center justify-center gap-4 mt-8">
                  <div className="flex items-center gap-4">
                    <Pagination
                      showInfo={false}
                      currentPage={displayForms.pagination.page}
                      totalPages={displayForms.pagination.totalPages}
                      onPageChange={handlePageChange}
                      hasNextPage={displayForms.pagination.hasNextPage}
                      hasPreviousPage={displayForms.pagination.hasPreviousPage}
                      totalCount={displayForms.pagination.totalCount}
                      pageSize={displayForms.pagination.limit}
                    />

                    {/* P1: Jump to Page Input */}
                    {displayForms.pagination.totalPages > 3 && (
                      <>
                        <div className="w-px h-6 bg-border" />
                        <div className="flex items-center gap-2">
                          <TypographySmall className="text-muted-foreground">
                            {t('forms.pagination.goTo')}:
                          </TypographySmall>
                          <Input
                            type="number"
                            min="1"
                            max={displayForms.pagination.totalPages}
                            value={jumpToPageInput}
                            onChange={(e) => setJumpToPageInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                handleJumpToPage();
                              }
                            }}
                            placeholder={currentPage.toString()}
                            className="w-16 h-8 text-center"
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={handleJumpToPage}
                            disabled={
                              !jumpToPageInput ||
                              parseInt(jumpToPageInput) < 1 ||
                              parseInt(jumpToPageInput) >
                                displayForms.pagination.totalPages
                            }
                            className="h-8"
                          >
                            <ChevronsUpDown className="h-4 w-4" />
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}
          </div>
        )}
      </div>
    </MainLayout>
  );
}

interface FormCardProps {
  form: any;
  onNavigate: (path: string) => void;
  showPermissionBadge?: boolean;
}

function FormCard({
  form,
  onNavigate,
  showPermissionBadge = false,
}: FormCardProps) {
  const { t } = useTranslation('forms');

  // Use metadata if available, otherwise fallback to defaults
  const metadata = form.metadata;
  const primaryColor = '#3b82f6';
  const backgroundColor = '#ffffff';

  // Use background image from metadata if available
  const backgroundImageUrl = metadata?.backgroundImageUrl || null;

  // Get real counts from metadata or show placeholders
  const pageCount = metadata?.pageCount ?? 0;
  const fieldCount = metadata?.fieldCount ?? 0;

  const handleCardClick = () => {
    onNavigate(`/dashboard/form/${form.id}`);
  };

  const handlePreview = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Navigate to form preview/viewer
    const formViewerUrl = `http://localhost:5173/f/${form.shortUrl}`;
    window.open(formViewerUrl, '_blank');
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    onNavigate(`/dashboard/form/${form.id}/collaborate/page-builder`);
  };

  return (
    <Card
      className="group relative overflow-hidden border-0 shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-y-1 bg-white cursor-pointer"
      onClick={handleCardClick}
    >
      {/* Form Preview Background */}
      <div className="relative h-48 overflow-hidden">
        {backgroundImageUrl ? (
          <div
            className="w-full h-full bg-cover bg-center transition-transform duration-300 group-hover:scale-105"
            style={{ backgroundImage: `url(${backgroundImageUrl})` }}
          >
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
          </div>
        ) : (
          <div
            className="w-full h-full bg-gradient-to-br from-slate-100 via-slate-50 to-white relative"
            style={{
              background: `linear-gradient(135deg, ${backgroundColor}dd 0%, ${primaryColor}22 100%)`,
            }}
          >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.1)_0%,transparent_50%)]" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg"
                style={{ backgroundColor: primaryColor }}
              >
                <FileText className="w-8 h-8 text-white" />
              </div>
            </div>
          </div>
        )}

        {/* Status & Permission Badges */}
        <div className="absolute top-4 right-4 flex flex-col gap-2">
          <div
            className={`px-3 py-1 rounded-full text-xs font-medium shadow-lg ${
              form.isPublished
                ? 'bg-green-100 text-green-700 border border-green-200'
                : 'bg-yellow-100 text-yellow-700 border border-yellow-200'
            }`}
          >
            {form.isPublished ? t('status.published') : t('status.draft')}
          </div>
          {showPermissionBadge && form.userPermission && (
            <div
              className={`px-3 py-1 rounded-full text-xs font-medium shadow-lg ${
                form.userPermission === 'OWNER'
                  ? 'bg-purple-100 text-purple-700 border border-purple-200'
                  : form.userPermission === 'EDITOR'
                  ? 'bg-blue-100 text-blue-700 border border-blue-200'
                  : form.userPermission === 'VIEWER'
                  ? 'bg-gray-100 text-gray-700 border border-gray-200'
                  : 'bg-red-100 text-red-700 border border-red-200'
              }`}
            >
              {form.userPermission === 'OWNER'
                ? t('permissions.owner')
                : form.userPermission === 'EDITOR'
                ? t('permissions.editor')
                : form.userPermission === 'VIEWER'
                ? t('permissions.viewer')
                : t('permissions.noAccess')}
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="secondary"
              className="bg-white/90 hover:bg-white shadow-lg"
              onClick={handlePreview}
            >
              <Eye className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              className="shadow-lg"
              style={{ backgroundColor: primaryColor }}
              onClick={handleEdit}
            >
              <Edit3 className="h-4 w-4 text-white" />
            </Button>
          </div>
        </div>
      </div>

      {/* Form Details */}
      <CardContent className="p-6">
        <div className="space-y-3">
          <div>
            <TypographyH3 className="font-semibold text-lg leading-tight line-clamp-1">
              {form.title}
            </TypographyH3>
            {form.description && (
              <TypographyMuted className="text-sm text-muted-foreground line-clamp-2 mt-1">
                {form.description}
              </TypographyMuted>
            )}
          </div>

          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1">
                <FileText className="h-3 w-3" />
                {pageCount > 0
                  ? `${pageCount} page${pageCount !== 1 ? 's' : ''}`
                  : 'No pages'}
              </span>
              <span className="flex items-center gap-1">
                <Users2 className="h-3 w-3" />
                {fieldCount > 0
                  ? `${fieldCount} field${fieldCount !== 1 ? 's' : ''}`
                  : 'No fields'}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <TypographySmall className="text-muted-foreground">
              Created{' '}
              {form.createdAt
                ? (() => {
                    // Handle timestamp strings (milliseconds as string) and ISO date strings
                    const timestamp =
                      typeof form.createdAt === 'string' &&
                      /^\d+$/.test(form.createdAt)
                        ? parseInt(form.createdAt, 10)
                        : form.createdAt;
                    const date = new Date(timestamp);
                    return !isNaN(date.getTime())
                      ? date.toLocaleDateString(undefined, {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })
                      : 'Date unavailable';
                  })()
                : 'Date unavailable'}
            </TypographySmall>
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: primaryColor }}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
