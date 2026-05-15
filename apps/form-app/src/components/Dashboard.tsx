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
      <div className="space-y-8" ref={contentRef}>

        {/* ── Templates strip ── */}
        <TemplatesStrip />

        {/* ── Search + Filters bar ── */}
        <div className="flex flex-col gap-3">
          {/* Row 1: Search + Create */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <Input
                placeholder={t('search.placeholder')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-11 pr-10"
              />
              {isTyping && (
                <div className="absolute right-10 top-1/2 -translate-y-1/2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-gray-400" />
                </div>
              )}
              {searchTerm && (
                <button
                  onClick={clearSearch}
                  aria-label={t('search.clear')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <Button onClick={() => navigate('/dashboard/templates')} className="gap-2 shrink-0">
              <Plus className="h-4 w-4" />
              {t('actions.create')}
            </Button>
          </div>

          {/* Row 2: Filters + page-size */}
          <div className="flex items-center justify-between gap-3">
            <div className="inline-flex items-center gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-xl">
              {FILTERS.map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => handleFilterChange(key)}
                  className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                    activeFilter === key
                      ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm'
                      : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-400 whitespace-nowrap">{t('pageSize.label')}</span>
              <Select value={pageSize.toString()} onValueChange={handlePageSizeChange} disabled={formsLoading}>
                <SelectTrigger className="w-20 h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAGE_SIZE_OPTIONS.map((size) => (
                    <SelectItem key={size} value={size.toString()}>{size}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="text-sm text-gray-400">{t('pageSize.suffix')}</span>
            </div>
          </div>
        </div>

        {/* ── Content area ── */}
        {formsLoading ? (
          /* Skeleton grid */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="rounded-2xl border border-gray-100 overflow-hidden animate-pulse">
                <div className="h-44 bg-gray-100" />
                <div className="p-5 space-y-3">
                  <div className="h-4 bg-gray-100 rounded-lg w-3/4" />
                  <div className="h-3 bg-gray-100 rounded-lg w-1/2" />
                  <div className="flex gap-2 pt-1">
                    <div className="h-5 bg-gray-100 rounded-full w-16" />
                    <div className="h-5 bg-gray-100 rounded-full w-12" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : formsError ? (
          /* Error state */
          <div className="text-center py-16">
            <div className="inline-flex flex-col items-center gap-4 bg-red-50 border border-red-100 rounded-2xl p-10 max-w-sm">
              <div className="w-12 h-12 rounded-2xl bg-red-100 flex items-center justify-center">
                <X className="w-6 h-6 text-red-500" />
              </div>
              <div>
                <p className="font-semibold text-red-800">{t('error.title')}</p>
                <p className="text-sm text-red-500 mt-1">{t('error.description')}</p>
              </div>
            </div>
          </div>
        ) : currentTotalCount === 0 ? (
          /* Empty state — no forms yet */
          <EmptyState
            icon={<FileText className="w-7 h-7 text-primary" />}
            title={t('empty.title')}
            description={t('empty.description')}
            action={
              <Button onClick={() => navigate('/dashboard/templates')} size="lg" className="gap-2">
                <Plus className="h-4 w-4" />
                {t('actions.createPrimary')}
              </Button>
            }
          />
        ) : displayForms.forms.length === 0 && searchTerm ? (
          /* Empty search results */
          <EmptyState
            icon={<Search className="w-7 h-7 text-primary" />}
            title={t('searchEmpty.title')}
            description={t('searchEmpty.description', { values: { term: searchTerm } })}
            action={
              <Button onClick={clearSearch} variant="outline" size="lg" className="gap-2">
                <X className="h-4 w-4" />
                {t('search.clear')}
              </Button>
            }
          />
        ) : (
          <div className="space-y-8">
            {/* Page-change overlay */}
            <div className="relative">
              {isPageChanging && (
                <div className="absolute inset-0 bg-white/70 backdrop-blur-sm z-10 flex items-center justify-center rounded-2xl">
                  <Loader2 className="h-7 w-7 animate-spin text-primary" />
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
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

            {/* Pagination */}
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
                      <div className="w-px h-5 bg-gray-200" />
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-400">{t('pagination.goto')}</span>
                        <Input
                          type="number"
                          min="1"
                          max={displayForms.pagination.totalPages}
                          value={jumpToPageInput}
                          onChange={(e) => setJumpToPageInput(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') handleJumpToPage(); }}
                          placeholder={currentPage.toString()}
                          className="w-16 h-9 text-center text-sm"
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={handleJumpToPage}
                          disabled={!jumpToPageInput || parseInt(jumpToPageInput) < 1 || parseInt(jumpToPageInput) > displayForms.pagination.totalPages}
                          className="h-9 px-3"
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

/* ── Templates strip ── */
function TemplatesStrip() {
  const navigate = useNavigate();
  const cdnEndpoint = getCdnEndpoint();
  const { data, loading } = useQuery(GET_TEMPLATES);
  const templates: any[] = data?.templates?.slice(0, 8) ?? [];

  if (loading) {
    return (
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">Start from a template</h2>
        </div>
        <div className="flex gap-4 overflow-hidden">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="shrink-0 w-48 rounded-2xl border border-gray-100 overflow-hidden animate-pulse">
              <div className="h-28 bg-gray-100" />
              <div className="p-3 space-y-2">
                <div className="h-3 bg-gray-100 rounded-lg w-3/4" />
                <div className="h-3 bg-gray-100 rounded-lg w-1/2" />
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
      {/* Section header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-gray-900 dark:text-white">Start from a template</h2>
        <button
          onClick={() => navigate('/dashboard/templates')}
          className="flex items-center gap-1 text-sm text-primary hover:text-primary/80 font-medium transition-colors"
        >
          Browse all
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Horizontal scroll row */}
      <div className="flex gap-4 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-none" style={{ scrollbarWidth: 'none' }}>
        {templates.map((template: any) => {
          const bgKey = template.formSchema?.layout?.backgroundImageKey;
          const bgUrl = bgKey && cdnEndpoint ? `${cdnEndpoint}/${bgKey}` : null;

          return (
            <div
              key={template.id}
              className="group shrink-0 w-48 rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
            >
              {/* Thumbnail */}
              <div className="relative h-28 overflow-hidden">
                {bgUrl ? (
                  <div
                    className="w-full h-full bg-cover bg-center transition-transform duration-300 group-hover:scale-105"
                    style={{ backgroundImage: `url(${bgUrl})` }}
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-700 flex items-center justify-center">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                      <FileText className="w-5 h-5 text-primary" />
                    </div>
                  </div>
                )}
                {/* Hover overlay with "Use" button */}
                <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center">
                  <UseTemplatePopover templateId={template.id} templateName={template.name}>
                    <button className="px-3 py-1.5 rounded-lg bg-white text-gray-900 text-xs font-semibold shadow-md hover:bg-gray-50 transition-colors">
                      Use template
                    </button>
                  </UseTemplatePopover>
                </div>
              </div>

              {/* Name + category */}
              <div className="p-3">
                <p className="text-sm font-medium text-gray-900 dark:text-white line-clamp-1">{template.name}</p>
                {template.category && (
                  <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{template.category}</p>
                )}
              </div>
            </div>
          );
        })}

        {/* "See all" card at end */}
        <button
          onClick={() => navigate('/dashboard/templates')}
          className="shrink-0 w-48 rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-700 flex flex-col items-center justify-center gap-2 text-gray-400 hover:text-primary hover:border-primary/40 transition-all duration-200 h-[calc(7rem+3.25rem)]"
        >
          <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center group-hover:bg-primary/10">
            <Plus className="w-5 h-5" />
          </div>
          <span className="text-xs font-medium">See all templates</span>
        </button>
      </div>
    </div>
  );
}

/* ── Empty state helper ── */
function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-5">
        {icon}
      </div>
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">{title}</h3>
      <p className="text-sm text-gray-400 max-w-xs mb-7">{description}</p>
      {action}
    </div>
  );
}

/* ── Form Card ── */
interface FormCardProps {
  form: any;
  onNavigate: (path: string) => void;
  showPermissionBadge?: boolean;
}

const CARD_ACCENT_COLORS: Record<string, string> = {
  OWNER:  '#14b8a6', // teal  — primary
  EDITOR: '#6366f1', // indigo
  VIEWER: '#94a3b8', // slate
};

function FormCard({ form, onNavigate, showPermissionBadge = false }: FormCardProps) {
  const { t, locale } = useTranslation('dashboard');
  const metadata   = form.metadata;
  const accentColor = CARD_ACCENT_COLORS[form.userPermission] ?? '#14b8a6';
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
  const handleEdit      = (e: React.MouseEvent) => { e.stopPropagation(); onNavigate(`/dashboard/form/${form.id}/collaborate/page-builder`); };

  return (
    <div
      onClick={handleCardClick}
      className="group relative rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden cursor-pointer transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5"
    >
      {/* Preview thumbnail */}
      <div className="relative h-44 overflow-hidden">
        {bgImageUrl ? (
          <div
            className="w-full h-full bg-cover bg-center transition-transform duration-300 group-hover:scale-105"
            style={{ backgroundImage: `url(${bgImageUrl})` }}
          >
            <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
          </div>
        ) : (
          <div
            className="w-full h-full flex items-center justify-center"
            style={{ background: `linear-gradient(135deg, ${accentColor}18 0%, ${accentColor}08 100%)` }}
          >
            {/* Subtle grid pattern */}
            <div
              className="absolute inset-0 opacity-30"
              style={{
                backgroundImage: `radial-gradient(circle, ${accentColor}30 1px, transparent 1px)`,
                backgroundSize: '20px 20px',
              }}
            />
            <div
              className="relative w-14 h-14 rounded-2xl flex items-center justify-center shadow-sm"
              style={{ backgroundColor: `${accentColor}20`, border: `1.5px solid ${accentColor}30` }}
            >
              <FileText className="w-7 h-7" style={{ color: accentColor }} />
            </div>
          </div>
        )}

        {/* Hover quick-actions — centered */}
        <div className="absolute inset-0 flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-black/10">
          <button
            onClick={handlePreview}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/95 text-gray-700 text-xs font-semibold shadow-md hover:bg-white transition-colors"
          >
            <Eye className="h-3.5 w-3.5" />
            Preview
          </button>
          <button
            onClick={handleEdit}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-white text-xs font-semibold shadow-md transition-colors"
            style={{ backgroundColor: accentColor }}
          >
            <Edit3 className="h-3.5 w-3.5" />
            Edit
          </button>
        </div>
      </div>

      {/* Card body */}
      <CardContent className="p-5 space-y-3">
        {/* Title + status */}
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold text-gray-900 dark:text-white text-sm leading-snug line-clamp-2 flex-1">
            {form.title}
          </h3>
          <span
            className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-medium ${
              form.isPublished
                ? 'bg-green-50 text-green-700 border border-green-100'
                : 'bg-amber-50 text-amber-700 border border-amber-100'
            }`}
          >
            {form.isPublished ? t('status.published') : t('status.draft')}
          </span>
        </div>

        {form.description && (
          <p className="text-xs text-gray-400 line-clamp-2">{form.description}</p>
        )}

        {/* Meta row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 text-xs text-gray-400">
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
              style={{ color: accentColor, backgroundColor: `${accentColor}15` }}
            >
              {permissionLabel}
            </span>
          )}
        </div>

        {/* Footer */}
        <div className="pt-1 flex items-center justify-between border-t border-gray-50 dark:border-gray-800">
          <span className="text-xs text-gray-400">{formattedCreatedAt}</span>
          <ArrowRight className="h-3.5 w-3.5 text-gray-300 group-hover:text-gray-500 group-hover:translate-x-0.5 transition-all duration-150" />
        </div>
      </CardContent>
    </div>
  );
}
