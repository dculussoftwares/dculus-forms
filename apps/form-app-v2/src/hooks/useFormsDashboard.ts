import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@apollo/client';
import { toast } from '@dculus/ui-v2';
import {
  GET_MY_FORMS_WITH_CATEGORY,
  GET_SHARED_FORMS_WITH_CATEGORY,
} from '../graphql/queries';

export type FilterCategory = 'all' | 'my-forms' | 'shared-with-me';

const DEFAULT_PAGE_SIZE = 12;
const DEBOUNCE_DELAY_MS = 500;

export interface FormsListItem {
  id: string;
  title: string;
  description?: string | null;
  shortUrl: string;
  isPublished: boolean;
  responseCount: number;
  createdAt: string;
  updatedAt: string;
  organization?: {
    id: string;
    name: string;
    slug: string;
  };
  createdBy?: {
    id: string;
    name: string;
    email: string;
  };
  metadata?: {
    pageCount?: number | null;
    fieldCount?: number | null;
    lastUpdated?: string | null;
  };
  userPermission?: string | null;
}

interface FormsPagination {
  forms: FormsListItem[];
  totalCount: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

interface UseFormsDashboardOptions {
  organizationId?: string | null;
}

interface UseFormsDashboardResult {
  searchTerm: string;
  setSearchTerm: (value: string) => void;
  activeFilter: FilterCategory;
  handleFilterChange: (filter: FilterCategory) => void;
  currentPage: number;
  handlePageChange: (page: number) => void;
  isPageChanging: boolean;
  isTyping: boolean;
  formsLoading: boolean;
  formsError?: Error | null;
  displayForms: {
    forms: FormsListItem[];
    pagination?: FormsPagination;
    showPermissionBadge: boolean;
    totalCounts: {
      myForms: number;
      sharedForms: number;
      all: number;
    };
  };
  contentRef: React.RefObject<HTMLDivElement>;
  clearSearch: () => void;
}

type FormsWithCategoryData = {
  formsWithCategory?: FormsPagination;
};

export const useFormsDashboard = ({
  organizationId,
}: UseFormsDashboardOptions): UseFormsDashboardResult => {
  const [searchParams, setSearchParams] = useSearchParams();
  const contentRef = useRef<HTMLDivElement>(null);

  const initialPage = parseInt(searchParams.get('page') || '1', 10);
  const initialSearch = searchParams.get('search') || '';
  const initialFilter = (searchParams.get('filter') ||
    'my-forms') as FilterCategory;

  const [searchTerm, setSearchTerm] = useState(initialSearch);
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState(initialSearch);
  const [activeFilter, setActiveFilter] =
    useState<FilterCategory>(initialFilter);
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [isPageChanging, setIsPageChanging] = useState(false);
  const pageSize = DEFAULT_PAGE_SIZE;

  // Debounce search term before triggering queries
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm.trim());
    }, DEBOUNCE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Sync URL params with state
  useEffect(() => {
    const params = new URLSearchParams();
    if (currentPage > 1) params.set('page', currentPage.toString());
    if (debouncedSearchTerm) params.set('search', debouncedSearchTerm);
    if (activeFilter !== 'my-forms') params.set('filter', activeFilter);
    setSearchParams(params, { replace: true });
  }, [
    currentPage,
    debouncedSearchTerm,
    activeFilter,
    setSearchParams,
  ]);

  // Reset pagination when search/filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchTerm, activeFilter]);

  const shouldFetchMyForms =
    activeFilter === 'my-forms' || activeFilter === 'all';
  const shouldFetchSharedForms =
    activeFilter === 'shared-with-me' || activeFilter === 'all';

  const getQueryVariables = useCallback(() => {
    if (activeFilter !== 'all') {
      return { page: currentPage, limit: pageSize };
    }
    return { page: 1, limit: currentPage * pageSize };
  }, [activeFilter, currentPage, pageSize]);

  const {
    data: myFormsData,
    loading: myFormsLoading,
    error: myFormsError,
  } = useQuery<FormsWithCategoryData>(GET_MY_FORMS_WITH_CATEGORY, {
    variables: {
      organizationId,
      ...getQueryVariables(),
      filters: debouncedSearchTerm
        ? { search: debouncedSearchTerm }
        : undefined,
    },
    skip: !organizationId || !shouldFetchMyForms,
    fetchPolicy: 'cache-and-network',
    notifyOnNetworkStatusChange: true,
  });

  const {
    data: sharedFormsData,
    loading: sharedFormsLoading,
    error: sharedFormsError,
  } = useQuery<FormsWithCategoryData>(GET_SHARED_FORMS_WITH_CATEGORY, {
    variables: {
      organizationId,
      ...getQueryVariables(),
      filters: debouncedSearchTerm
        ? { search: debouncedSearchTerm }
        : undefined,
    },
    skip: !organizationId || !shouldFetchSharedForms,
    fetchPolicy: 'cache-and-network',
    notifyOnNetworkStatusChange: true,
  });

  const myFormsPagination = myFormsData?.formsWithCategory;
  const sharedFormsPagination = sharedFormsData?.formsWithCategory;

  const myForms = myFormsPagination?.forms ?? [];
  const sharedForms = sharedFormsPagination?.forms ?? [];

  const myFormsTotalCount = myFormsPagination?.totalCount ?? 0;
  const sharedFormsTotalCount = sharedFormsPagination?.totalCount ?? 0;

  const formsLoading = myFormsLoading || sharedFormsLoading;
  const formsError = myFormsError || sharedFormsError;

  const lastErrorMessageRef = useRef<string | null>(null);

  useEffect(() => {
    if (formsError) {
      const message =
        formsError.message || 'Something went wrong while loading forms.';
      if (lastErrorMessageRef.current !== message) {
        toast('Unable to load forms', {
          description: message,
        });
        lastErrorMessageRef.current = message;
      }
    } else {
      lastErrorMessageRef.current = null;
    }
  }, [formsError]);

  const isTyping =
    searchTerm !== debouncedSearchTerm && searchTerm.trim().length > 0;

  const displayForms = useMemo(() => {
    if (activeFilter === 'my-forms') {
      return {
        forms: myForms,
        pagination: myFormsPagination,
        showPermissionBadge: false,
        totalCounts: {
          myForms: myFormsTotalCount,
          sharedForms: sharedFormsTotalCount,
          all: myFormsTotalCount + sharedFormsTotalCount,
        },
      };
    }

    if (activeFilter === 'shared-with-me') {
      return {
        forms: sharedForms,
        pagination: sharedFormsPagination,
        showPermissionBadge: true,
        totalCounts: {
          myForms: myFormsTotalCount,
          sharedForms: sharedFormsTotalCount,
          all: myFormsTotalCount + sharedFormsTotalCount,
        },
      };
    }

    const allForms = [...myForms, ...sharedForms].sort((a, b) => {
      const dateA = new Date(a.createdAt).getTime();
      const dateB = new Date(b.createdAt).getTime();
      return dateB - dateA;
    });

    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const paginatedForms = allForms.slice(startIndex, endIndex);

    const totalCount = myFormsTotalCount + sharedFormsTotalCount;
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

    return {
      forms: paginatedForms,
      pagination: {
        forms: paginatedForms,
        totalCount,
        page: currentPage,
        limit: pageSize,
        totalPages,
        hasNextPage: currentPage < totalPages,
        hasPreviousPage: currentPage > 1,
      },
      showPermissionBadge: true,
      totalCounts: {
        myForms: myFormsTotalCount,
        sharedForms: sharedFormsTotalCount,
        all: totalCount,
      },
    };
  }, [
    activeFilter,
    currentPage,
    myForms,
    myFormsPagination,
    myFormsTotalCount,
    pageSize,
    sharedForms,
    sharedFormsPagination,
    sharedFormsTotalCount,
  ]);

  const handlePageChange = useCallback(
    (page: number) => {
      setIsPageChanging(true);
      setCurrentPage(page);

      if (contentRef.current) {
        contentRef.current.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        });
      } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }

      setTimeout(() => setIsPageChanging(false), 400);
    },
    [contentRef],
  );

  const handleFilterChange = useCallback((filter: FilterCategory) => {
    setActiveFilter(filter);
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      const pagination = displayForms.pagination;
      if (!pagination) return;

      if (event.key === 'ArrowLeft' && pagination.hasPreviousPage) {
        event.preventDefault();
        handlePageChange(currentPage - 1);
      } else if (event.key === 'ArrowRight' && pagination.hasNextPage) {
        event.preventDefault();
        handlePageChange(currentPage + 1);
      } else if (event.key === 'Home' && currentPage !== 1) {
        event.preventDefault();
        handlePageChange(1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentPage, displayForms.pagination, handlePageChange]);

  const clearSearch = useCallback(() => setSearchTerm(''), []);

  return {
    searchTerm,
    setSearchTerm,
    activeFilter,
    handleFilterChange,
    currentPage,
    handlePageChange,
    isPageChanging,
    isTyping,
    formsLoading,
    formsError,
    displayForms,
    contentRef,
    clearSearch,
  };
};
