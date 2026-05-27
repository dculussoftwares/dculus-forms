import {
  CardContent,
  Button,
  Input,
  Pagination,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  EmptyState,
} from '@dculus/ui';
import { MainLayout } from './MainLayout';
import {
  FileText,
  Eye,
  Plus,
  Edit3,
  Search,
  X,
  Loader2,
  ChevronsUpDown,
  Layers,
  ArrowRight,
  ChevronRight,
} from 'lucide-react';
import { useNavigate, Routes, Route, useSearchParams } from 'react-router-dom';
import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useQuery } from '@apollo/client';
import { GET_ACTIVE_ORGANIZATION, GET_FORMS } from '../graphql/queries';
import { GET_TEMPLATES } from '../graphql/templates';
import Templates from '../pages/Templates';
import FormDashboard from '../pages/FormDashboard';
import { UseTemplatePopover } from './UseTemplatePopover';
import { useTranslation } from '../hooks/useTranslation';
import { getFormViewerUrl, getCdnEndpoint } from '@/lib/config';

export function Dashboard() {
  const { t: tTemplates } = useTranslation('templates');
  const { t: tDashboard } = useTranslation('dashboard');

  return (
    <Routes>
      <Route
        path="templates"
        element={
          <MainLayout
            title={tTemplates('hero.title')}
            subtitle={tTemplates('hero.subtitle')}
            breadcrumbs={[
              { label: tDashboard('layout.breadcrumb'), href: '/dashboard' },
              { label: tTemplates('layout.breadcrumb'), isActive: true },
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

  const urlPage = parseInt(searchParams.get('page') || '1', 10);
  const urlSearch = searchParams.get('search') || '';
  const urlFilter = (searchParams.get('filter') || 'my-forms') as FilterCategory;
  const urlPageSize = parseInt(searchParams.get('pageSize') || '12', 10);

  const [searchTerm, setSearchTerm] = useState(urlSearch);
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState(urlSearch);
  const [activeFilter, setActiveFilter] = useState<FilterCategory>(urlFilter);
  const [currentPage, setCurrentPage] = useState(urlPage);
  const [pageSize, setPageSize] = useState(urlPageSize);
  const [isPageChanging, setIsPageChanging] = useState(false);
  const [jumpToPageInput, setJumpToPageInput] = useState('');

  const { data: orgData } = useQuery(GET_ACTIVE_ORGANIZATION);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearchTerm(searchTerm), 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (currentPage > 1) params.set('page', currentPage.toString());
    if (debouncedSearchTerm) params.set('search', debouncedSearchTerm);
    if (activeFilter !== 'my-forms') params.set('filter', activeFilter);
    if (pageSize !== 12) params.set('pageSize', pageSize.toString());
    setSearchParams(params, { replace: true });
  }, [currentPage, debouncedSearchTerm, activeFilter, pageSize, setSearchParams]);

  useEffect(() => { setCurrentPage(1); }, [debouncedSearchTerm, pageSize]);
  useEffect(() => { setCurrentPage(1); }, [activeFilter]);

  const organizationId = orgData?.activeOrganization?.id;
  const filtersInput = debouncedSearchTerm.trim() ? { search: debouncedSearchTerm.trim() } : undefined;

  const { data: ownerFormsData, loading: ownerFormsLoading, error: ownerFormsError } = useQuery(GET_FORMS, {
    variables: { organizationId, category: 'OWNER', page: currentPage, limit: pageSize, filters: filtersInput },
    skip: !organizationId || activeFilter !== 'my-forms',
    notifyOnNetworkStatusChange: true,
  });

  const { data: sharedFormsData, loading: sharedFormsLoading, error: sharedFormsError } = useQuery(GET_FORMS, {
    variables: { organizationId, category: 'SHARED', page: currentPage, limit: pageSize, filters: filtersInput },
    skip: !organizationId || activeFilter !== 'shared-with-me',
    notifyOnNetworkStatusChange: true,
  });

  const { data: allFormsData, loading: allFormsLoading, error: allFormsError } = useQuery(GET_FORMS, {
    variables: { organizationId, category: 'ALL', page: currentPage, limit: pageSize, filters: filtersInput },
    skip: !organizationId || activeFilter !== 'all',
    notifyOnNetworkStatusChange: true,
  });

  const ownerForms = ownerFormsData?.forms?.forms || [];
  const ownerFormsPagination = ownerFormsData?.forms;
  const sharedForms = sharedFormsData?.forms?.forms || [];
  const sharedFormsPagination = sharedFormsData?.forms;
  const allForms = allFormsData?.forms?.forms || [];
  const allFormsPagination = allFormsData?.forms;

  const formsLoading =
    activeFilter === 'my-forms' ? ownerFormsLoading :
    activeFilter === 'shared-with-me' ? sharedFormsLoading : allFormsLoading;

  const formsError =
    activeFilter === 'my-forms' ? ownerFormsError :
    activeFilter === 'shared-with-me' ? sharedFormsError : allFormsError;

  const isTyping = searchTerm !== debouncedSearchTerm && searchTerm.length > 0;

  const displayForms = useMemo(() => {
    if (activeFilter === 'my-forms') return { forms: ownerForms, pagination: ownerFormsPagination, showPermissionBadge: false };
    if (activeFilter === 'shared-with-me') return { forms: sharedForms, pagination: sharedFormsPagination, showPermissionBadge: true };
    return { forms: allForms, pagination: allFormsPagination, showPermissionBadge: true };
  }, [activeFilter, ownerForms, ownerFormsPagination, sharedForms, sharedFormsPagination, allForms, allFormsPagination]);

  const currentTotalCount = displayForms.pagination?.totalCount ?? 0;

  const handlePageChange = useCallback((page: number) => {
    setIsPageChanging(true);
    setCurrentPage(page);
    setJumpToPageInput('');
    if (contentRef.current) {
      contentRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    setTimeout(() => setIsPageChanging(false), 400);
  }, []);

  const handleJumpToPage = useCallback(() => {
    const pageNum = parseInt(jumpToPageInput, 10);
    const maxPages = displayForms.pagination?.totalPages || 1;
    if (pageNum >= 1 && pageNum <= maxPages) handlePageChange(pageNum);
  }, [jumpToPageInput, displayForms.pagination, handlePageChange]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const pagination = displayForms.pagination;
      if (!pagination) return;
      if (e.key === 'ArrowLeft' && pagination.hasPreviousPage) { e.preventDefault(); handlePageChange(currentPage - 1); }
      else if (e.key === 'ArrowRight' && pagination.hasNextPage) { e.preventDefault(); handlePageChange(currentPage + 1); }
      else if (e.key === 'Home' && currentPage !== 1) { e.preventDefault(); handlePageChange(1); }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentPage, displayForms.pagination, handlePageChange]);

  const clearSearch = useCallback(() => setSearchTerm(''), []);
  const handleFilterChange = useCallback((filter: FilterCategory) => setActiveFilter(filter), []);
  const handlePageSizeChange = useCallback((newPageSize: string) => setPageSize(parseInt(newPageSize, 10)), []);

  const FILTERS: { key: FilterCategory; label: string }[] = [
    { key: 'my-forms',        label: t('filters.mine') },
    { key: 'all',             label: t('filters.all') },
    { key: 'shared-with-me', label: t('filters.shared') },
  ];

  return (
    <MainLayout
      title={t('layout.title')}
      breadcrumbs={[{ label: t('layout.breadcrumb'), isActive: true }]}
    >
      <div className="space-y-6" ref={contentRef}>

        {/* ── Templates strip ── */}
        <TemplatesStrip />

        {/* ── Toolbar: search + create + filters ── */}
        <div className="flex flex-col gap-0">

          {/* Row 1: Search + Create button */}
          <div className="flex items-center gap-2 mb-4">
            {/* Search — ghost input matching Typeform */}
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 pointer-events-none text-muted-foreground" />
              <Input
                type="text"
                placeholder={t('search.placeholder')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-9 pl-9 pr-9 text-sm"
              />
              {isTyping && (
                <div className="absolute right-9 top-1/2 -translate-y-1/2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                </div>
              )}
              {searchTerm && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={clearSearch}
                  aria-label={t('search.clear')}
                  className="absolute right-0 top-0 h-9 w-9 rounded-l-none"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>

            <Button
              onClick={() => navigate('/forms/create')}
              className="shrink-0 gap-1.5 h-9 px-3 text-sm"
            >
              <Plus className="h-3.5 w-3.5" />
              {t('actions.create')}
            </Button>
          </div>

          {/* Row 2: Typeform-style underline filter tabs + page-size */}
          <div className="flex items-center justify-between border-b border-[var(--tf-border)] dark:border-white/10 -mx-6 px-6">
            <div className="flex items-center gap-0.5">
              {FILTERS.map(({ key, label }) => (
                <Button
                  key={key}
                  variant="ghost"
                  onClick={() => handleFilterChange(key)}
                  className="relative px-3 h-9 text-sm font-medium rounded-lg transition-all duration-150"
                  style={{
                    color: activeFilter === key ? 'var(--tf-dark)' : 'var(--tf-muted)',
                    backgroundColor: activeFilter === key ? 'var(--tf-tab-bg)' : 'transparent',
                  }}
                >
                  {label}
                  {activeFilter === key && (
                    <span
                      className="absolute bottom-[-1px] left-0 right-0 h-[2px] rounded-t-full"
                      style={{ backgroundColor: 'var(--tf-dark)' }}
                    />
                  )}
                </Button>
              ))}
            </div>

            <div className="flex items-center gap-2 pb-1">
              <span className="text-xs text-muted-foreground">{t('pageSize.label')}</span>
              <Select value={pageSize.toString()} onValueChange={handlePageSizeChange} disabled={formsLoading}>
                <SelectTrigger className="w-16 h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAGE_SIZE_OPTIONS.map((size) => (
                    <SelectItem key={size} value={size.toString()}>{size}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* ── Content area ── */}
        {formsLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-[var(--tf-border-medium)] overflow-hidden animate-pulse bg-white dark:bg-card">
                <div className="h-40 bg-background dark:bg-muted" />
                <div className="p-4 space-y-3">
                  <div className="h-3.5 bg-background dark:bg-muted rounded-lg w-3/4" />
                  <div className="h-3 bg-background dark:bg-muted rounded-lg w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : formsError ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4" style={{ backgroundColor: 'var(--tf-error-bg)' }}>
              <X className="w-5 h-5 text-destructive" />
            </div>
            <p className="font-medium text-sm text-primary">{t('error.title')}</p>
            <p className="text-xs mt-1 text-muted-foreground">{t('error.description')}</p>
          </div>
        ) : currentTotalCount === 0 ? (
          <EmptyState
            icon={<FileText className="w-6 h-6 text-muted-foreground" />}
            title={t('empty.title')}
            description={t('empty.description')}
            action={
              <Button onClick={() => navigate('/forms/create')} className="gap-1.5">
                <Plus className="h-3.5 w-3.5" />
                {t('actions.createPrimary')}
              </Button>
            }
          />
        ) : displayForms.forms.length === 0 && searchTerm ? (
          <EmptyState
            icon={<Search className="w-6 h-6 text-muted-foreground" />}
            title={t('searchEmpty.title')}
            description={t('searchEmpty.description', { values: { term: searchTerm } })}
            action={
              <Button onClick={clearSearch} variant="outline" className="gap-1.5">
                <X className="h-3.5 w-3.5" />
                {t('search.clear')}
              </Button>
            }
          />
        ) : (
          <div className="space-y-6">
            <div className="relative">
              {isPageChanging && (
                <div className="absolute inset-0 bg-white/60 dark:bg-card/60 backdrop-blur-sm z-10 flex items-center justify-center rounded-xl">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {displayForms.forms.map((form: any) => (
                  <FormCard
                    key={form.id}
                    form={form}
                    onNavigate={navigate}
                    showPermissionBadge={
                      displayForms.showPermissionBadge || (activeFilter === 'all' && form.userPermission)
                    }
                  />
                ))}
              </div>
            </div>

            {displayForms.pagination && displayForms.pagination.totalPages > 1 && (
              <div className="flex flex-row flex-wrap items-center justify-center gap-4">
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

                  {displayForms.pagination.totalPages > 3 && (
                    <>
                      <div className="w-px h-5 bg-[var(--tf-border)]" />
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">{t('pagination.goto')}</span>
                        <Input
                          type="number"
                          min="1"
                          max={displayForms.pagination.totalPages}
                          value={jumpToPageInput}
                          onChange={(e) => setJumpToPageInput(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') handleJumpToPage(); }}
                          placeholder={currentPage.toString()}
                          className="w-14 h-8 text-center text-xs"
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={handleJumpToPage}
                          disabled={!jumpToPageInput || parseInt(jumpToPageInput) < 1 || parseInt(jumpToPageInput) > displayForms.pagination.totalPages}
                          className="h-8 px-2"
                        >
                          <ChevronsUpDown className="h-3.5 w-3.5" />
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

/* ── Templates strip ── */
function TemplatesStrip() {
  const navigate = useNavigate();
  const cdnEndpoint = getCdnEndpoint();
  const { data, loading } = useQuery(GET_TEMPLATES);
  const templates: any[] = data?.templates?.slice(0, 8) ?? [];

  if (loading) {
    return (
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-primary">Start from a template</h2>
        </div>
        <div className="flex gap-3 overflow-hidden">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="shrink-0 w-44 rounded-xl border border-[var(--tf-border-medium)] bg-white overflow-hidden animate-pulse">
              <div className="h-24 bg-background" />
              <div className="p-3 space-y-2">
                <div className="h-3 bg-background rounded-lg w-3/4" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!templates.length) return null;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-primary">Start from a template</h2>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/dashboard/templates')}
          className="flex items-center gap-0.5 text-xs font-medium h-7 px-2 text-muted-foreground hover:text-primary"
        >
          Browse all
          <ChevronRight className="h-3 w-3" />
        </Button>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1" style={{ scrollbarWidth: 'none' }}>
        {templates.map((template: any) => {
          const bgKey = template.formSchema?.layout?.backgroundImageKey;
          const bgUrl = bgKey && cdnEndpoint ? `${cdnEndpoint}/${bgKey}` : null;

          return (
            <div
              key={template.id}
              className="group shrink-0 w-44 rounded-xl border border-[var(--tf-border-medium)] bg-white dark:bg-card overflow-hidden cursor-pointer transition-all duration-200 hover:-translate-y-0.5 shadow-[0_1px_4px_var(--tf-overlay)] hover:shadow-[0_4px_16px_rgba(60,50,62,0.12)]"
            >
              <div className="relative h-24 overflow-hidden">
                {bgUrl ? (
                  <div
                    className="w-full h-full bg-cover bg-center transition-transform duration-300 group-hover:scale-105"
                    style={{ backgroundImage: `url(${bgUrl})` }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center" style={{ backgroundColor: 'var(--tf-faint)' }}>
                    <FileText className="w-5 h-5 text-muted-foreground" />
                  </div>
                )}
                <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center">
                  <UseTemplatePopover templateId={template.id} templateName={template.name}>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs font-semibold shadow-md bg-white text-primary hover:bg-white/90"
                    >
                      Use template
                    </Button>
                  </UseTemplatePopover>
                </div>
              </div>

              <div className="p-3">
                <p className="text-xs font-medium line-clamp-1 text-primary">{template.name}</p>
                {template.category && (
                  <p className="text-xs mt-0.5 line-clamp-1 text-muted-foreground">{template.category}</p>
                )}
              </div>
            </div>
          );
        })}

        <Button
          variant="ghost"
          onClick={() => navigate('/dashboard/templates')}
          className="shrink-0 w-44 rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-1.5 transition-all duration-200 h-[calc(6rem+3.25rem)] text-muted-foreground hover:text-primary hover:border-primary hover:bg-transparent"
          style={{ borderColor: 'rgba(81,76,84,0.18)' }}
        >
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'var(--tf-border-light)' }}>
            <Plus className="w-4 h-4" />
          </div>
          <span className="text-xs font-medium">See all</span>
        </Button>
      </div>
    </div>
  );
}

/* ── Form Card ── */
interface FormCardProps {
  form: any;
  onNavigate: (path: string) => void;
  showPermissionBadge?: boolean;
}

function FormCard({ form, onNavigate, showPermissionBadge = false }: FormCardProps) {
  const { t, locale } = useTranslation('dashboard');
  const metadata   = form.metadata;
  const bgImageUrl  = metadata?.backgroundImageUrl ?? null;
  const pageCount   = metadata?.pageCount ?? 0;
  const fieldCount  = metadata?.fieldCount ?? 0;

  const pageCountLabel =
    pageCount === 0 ? t('counts.pages.zero') :
    pageCount === 1 ? t('counts.pages.one') :
    t('counts.pages.other', { values: { count: pageCount } });

  const fieldCountLabel =
    fieldCount === 0 ? t('counts.fields.zero') :
    fieldCount === 1 ? t('counts.fields.one') :
    t('counts.fields.other', { values: { count: fieldCount } });

  const permissionLabel = (() => {
    switch (form.userPermission) {
      case 'OWNER':  return t('permissions.owner');
      case 'EDITOR': return t('permissions.editor');
      case 'VIEWER': return t('permissions.viewer');
      default:       return t('permissions.none');
    }
  })();

  const formattedCreatedAt = (() => {
    if (!form.createdAt) return t('created.unknown');
    const timestamp = typeof form.createdAt === 'string' && /^\d+$/.test(form.createdAt)
      ? parseInt(form.createdAt, 10) : form.createdAt;
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return t('created.unknown');
    return date.toLocaleDateString(locale, { year: 'numeric', month: 'short', day: 'numeric' });
  })();

  const handleCardClick = () => onNavigate(`/dashboard/form/${form.id}`);
  const handlePreview   = (e: React.MouseEvent) => { e.stopPropagation(); window.open(getFormViewerUrl(form.shortUrl), '_blank'); };
  const handleEdit      = (e: React.MouseEvent) => { e.stopPropagation(); onNavigate(`/dashboard/form/${form.id}/builder/page-builder`); };

  return (
    <div
      onClick={handleCardClick}
      className="group relative rounded-xl bg-white dark:bg-card overflow-hidden cursor-pointer transition-all duration-200 hover:-translate-y-0.5 border border-[var(--tf-border-medium)] shadow-[0_1px_4px_var(--tf-overlay)] hover:shadow-[0_6px_20px_rgba(60,50,62,0.12)]"
    >
      {/* Thumbnail */}
      <div className="relative h-40 overflow-hidden">
        {bgImageUrl ? (
          <div
            className="w-full h-full bg-cover bg-center transition-transform duration-300 group-hover:scale-105"
            style={{ backgroundImage: `url(${bgImageUrl})` }}
          >
            <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
          </div>
        ) : (
          <div
            className="w-full h-full flex items-center justify-center"
            style={{ backgroundColor: 'var(--tf-faint)' }}
          >
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: 'var(--tf-border-light)' }}
            >
              <FileText className="w-6 h-6 text-muted-foreground" />
            </div>
          </div>
        )}

        {/* Hover quick-actions */}
        <div className="absolute inset-0 flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-black/10">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePreview}
            className="gap-1.5 text-xs shadow-sm bg-white text-primary hover:bg-white/90 border-transparent"
          >
            <Eye className="h-3.5 w-3.5" />
            Preview
          </Button>
          <Button
            size="sm"
            onClick={handleEdit}
            className="gap-1.5 text-xs shadow-sm"
          >
            <Edit3 className="h-3.5 w-3.5" />
            Edit
          </Button>
        </div>
      </div>

      {/* Card body */}
      <CardContent className="p-4 space-y-2.5">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-medium text-sm leading-snug line-clamp-2 flex-1 text-primary">
            {form.title}
          </h3>
          <span
            className="shrink-0 px-2 py-0.5 rounded-full text-xs font-medium"
            style={form.isPublished
              ? { backgroundColor: 'var(--tf-green-bg)', color: 'var(--tf-green)', border: '1px solid var(--tf-green-bg-md)' }
              : { backgroundColor: 'rgba(190,153,58,0.08)', color: '#9c7818', border: '1px solid rgba(190,153,58,0.16)' }
            }
          >
            {form.isPublished ? t('status.published') : t('status.draft')}
          </span>
        </div>

        {form.description && (
          <p className="text-xs line-clamp-2 text-muted-foreground">{form.description}</p>
        )}

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Layers className="h-3 w-3" />
              {pageCountLabel}
            </span>
            <span className="flex items-center gap-1">
              <FileText className="h-3 w-3" />
              {fieldCountLabel}
            </span>
          </div>
          {showPermissionBadge && form.userPermission && (
            <span
              className="text-xs font-medium px-2 py-0.5 rounded-full"
              style={{ color: 'var(--tf-muted)', backgroundColor: 'var(--tf-border-light)' }}
            >
              {permissionLabel}
            </span>
          )}
        </div>

        {/* Footer */}
        <div
          className="pt-2 flex items-center justify-between"
          style={{ borderTop: '1px solid var(--tf-border-light)' }}
        >
          <span className="text-xs text-muted-foreground">{formattedCreatedAt}</span>
          <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform duration-150 text-[rgba(81,76,84,0.35)]" />
        </div>
      </CardContent>
    </div>
  );
}
