jest.mock('@apollo/client', () => ({
  useQuery: jest.fn(),
}));

jest.mock('react-router-dom', () => ({
  useSearchParams: jest.fn(),
}));

jest.mock('../../i18n', () => ({
  useTranslate: jest.fn(),
}));

jest.mock('../../graphql/queries', () => ({
  GET_MY_FORMS_WITH_CATEGORY: 'GET_MY_FORMS_WITH_CATEGORY',
  GET_SHARED_FORMS_WITH_CATEGORY: 'GET_SHARED_FORMS_WITH_CATEGORY',
}));

import { act, renderHook } from '@testing-library/react';
import { toast } from '@dculus/ui-v2';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@apollo/client';

import type { MutableRefObject } from 'react';

import { useFormsDashboard } from '../useFormsDashboard';
import { useTranslate } from '../../i18n';

type FormsListItem = {
  id: string;
  title: string;
  shortUrl: string;
  isPublished: boolean;
  responseCount: number;
  createdAt: string;
  updatedAt: string;
  description?: string | null;
  metadata?: {
    pageCount?: number | null;
    fieldCount?: number | null;
  };
};

type FormsPagination = {
  forms: FormsListItem[];
  totalCount: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
};

type FormsQueryResult = {
  data?: { formsWithCategory?: FormsPagination };
  loading: boolean;
  error: Error | null;
};

const mockUseQuery = useQuery as jest.MockedFunction<typeof useQuery>;
const mockUseSearchParams = useSearchParams as jest.MockedFunction<
  typeof useSearchParams
>;
const mockUseTranslate = useTranslate as unknown as jest.MockedFunction<
  typeof useTranslate
>;

const mockSetSearchParams = jest.fn();

const createForm = (id: string, createdAt: string): FormsListItem => ({
  id,
  title: `Form ${id}`,
  shortUrl: id,
  isPublished: true,
  responseCount: 0,
  createdAt,
  updatedAt: createdAt,
  description: null,
  metadata: {},
});

const createPagination = (overrides: Partial<FormsPagination> = {}): FormsPagination => ({
  forms: [],
  totalCount: 0,
  page: 1,
  limit: 12,
  totalPages: 1,
  hasNextPage: false,
  hasPreviousPage: false,
  ...overrides,
});

const createQueryResult = (overrides: Partial<FormsQueryResult> = {}): FormsQueryResult => ({
  data: undefined,
  loading: false,
  error: null,
  ...overrides,
});

const queryResults: {
  my: FormsQueryResult;
  shared: FormsQueryResult;
} = {
  my: createQueryResult(),
  shared: createQueryResult(),
};

const setQueryResults = (partial: Partial<typeof queryResults>) => {
  if (partial.my) {
    queryResults.my = { ...createQueryResult(), ...partial.my };
  }
  if (partial.shared) {
    queryResults.shared = { ...createQueryResult(), ...partial.shared };
  }
};

describe('useFormsDashboard', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    window.scrollTo = jest.fn();
    mockUseSearchParams.mockReturnValue([
      new URLSearchParams(),
      mockSetSearchParams,
    ]);
    mockUseTranslate.mockReturnValue((key: string) => key);
    setQueryResults({
      my: createQueryResult({
        data: { formsWithCategory: createPagination() },
      }),
      shared: createQueryResult({
        data: { formsWithCategory: createPagination() },
      }),
    });
    mockUseQuery.mockImplementation(((query: unknown) => {
      if (query === 'GET_MY_FORMS_WITH_CATEGORY') {
        return queryResults.my;
      }
      if (query === 'GET_SHARED_FORMS_WITH_CATEGORY') {
        return queryResults.shared;
      }
      throw new Error(`Unexpected query: ${query}`);
    }) as any);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('manages my forms pagination, search, and filter transitions', () => {
    const now = Date.now();
    setQueryResults({
      my: createQueryResult({
        data: {
          formsWithCategory: createPagination({
            forms: [
              createForm('my-1', new Date(now - 1).toISOString()),
              createForm('my-2', new Date(now - 2).toISOString()),
            ],
            totalCount: 25,
            page: 2,
            totalPages: 3,
            hasNextPage: true,
            hasPreviousPage: true,
          }),
        },
      }),
      shared: createQueryResult({
        data: {
          formsWithCategory: createPagination({
            forms: [createForm('shared-1', new Date(now).toISOString())],
            totalCount: 1,
          }),
        },
      }),
    });
    mockUseSearchParams.mockReturnValue([
      new URLSearchParams('page=2&search=initial'),
      mockSetSearchParams,
    ]);

    const { result } = renderHook(() =>
      useFormsDashboard({ organizationId: 'org-1' }),
    );

    expect(result.current.activeFilter).toBe('my-forms');
    expect(result.current.currentPage).toBe(1);
    expect(result.current.displayForms.forms).toHaveLength(2);
    expect(result.current.displayForms.showPermissionBadge).toBe(false);

    const scrollIntoView = jest.fn();
    const contentRef =
      result.current.contentRef as unknown as MutableRefObject<HTMLDivElement | null>;
    act(() => {
      contentRef.current = {
        scrollIntoView,
      } as unknown as HTMLDivElement;
      result.current.handlePageChange(2);
    });

    expect(scrollIntoView).toHaveBeenCalledWith({
      behavior: 'smooth',
      block: 'start',
    });
    expect(result.current.isPageChanging).toBe(true);
    expect(result.current.currentPage).toBe(2);

    act(() => {
      jest.advanceTimersByTime(400);
    });
    expect(result.current.isPageChanging).toBe(false);

    act(() => result.current.setSearchTerm('updated search'));
    expect(result.current.searchTerm).toBe('updated search');
    expect(result.current.isTyping).toBe(true);

    act(() => jest.advanceTimersByTime(500));

    expect(result.current.isTyping).toBe(false);
    expect(result.current.currentPage).toBe(1);

    const params = mockSetSearchParams.mock.calls.at(-1)?.[0] as URLSearchParams;
    expect(params.get('search')).toBe('updated search');
    expect(params.get('page')).toBeNull();

    act(() => result.current.clearSearch());
    expect(result.current.searchTerm).toBe('');

    act(() => result.current.handleFilterChange('shared-with-me'));
    expect(result.current.activeFilter).toBe('shared-with-me');
    expect(result.current.displayForms.showPermissionBadge).toBe(true);
    expect(result.current.displayForms.forms).toHaveLength(1);

    const newParams = mockSetSearchParams.mock.calls.at(-1)?.[0] as URLSearchParams;
    expect(newParams.get('filter')).toBe('shared-with-me');
  });

  it('combines forms for all filter and supports keyboard pagination shortcuts', () => {
    const start = Date.now();
    const myForms = Array.from({ length: 13 }, (_, index) =>
      createForm(`my-${index}`, new Date(start - index * 1000).toISOString()),
    );
    const sharedForms = Array.from({ length: 12 }, (_, index) =>
      createForm(
        `shared-${index}`,
        new Date(start - (index + 100) * 1000).toISOString(),
      ),
    );
    setQueryResults({
      my: createQueryResult({
        data: {
          formsWithCategory: createPagination({
            forms: myForms,
            totalCount: myForms.length,
            totalPages: 3,
            hasNextPage: true,
          }),
        },
      }),
      shared: createQueryResult({
        data: {
          formsWithCategory: createPagination({
            forms: sharedForms,
            totalCount: sharedForms.length,
            totalPages: 3,
            hasNextPage: true,
          }),
        },
      }),
    });
    mockUseSearchParams.mockReturnValue([
      new URLSearchParams('filter=all'),
      mockSetSearchParams,
    ]);

    const { result } = renderHook(() =>
      useFormsDashboard({ organizationId: 'org-1' }),
    );

    expect(result.current.activeFilter).toBe('all');
    expect(result.current.displayForms.forms).toHaveLength(12);
    const createdAtValues = result.current.displayForms.forms.map(
      (form) => form.createdAt,
    );
    const sortedValues = [...createdAtValues].sort((a, b) =>
      a > b ? -1 : a < b ? 1 : 0,
    );
    expect(createdAtValues).toEqual(sortedValues);

    const firstCall = mockSetSearchParams.mock.calls.at(-1)?.[0] as URLSearchParams;
    expect(firstCall.get('filter')).toBe('all');
    expect(firstCall.get('page')).toBeNull();

    const inputEvent = new KeyboardEvent('keydown', { key: 'ArrowRight' });
    Object.defineProperty(inputEvent, 'target', {
      value: document.createElement('input'),
    });
    act(() => {
      window.dispatchEvent(inputEvent);
    });
    expect(result.current.currentPage).toBe(1);

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    });
    expect(window.scrollTo).toHaveBeenCalledWith({
      behavior: 'smooth',
      top: 0,
    });
    expect(result.current.currentPage).toBe(2);
    act(() => jest.advanceTimersByTime(400));
    expect(result.current.displayForms.forms).toHaveLength(12);

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    });
    expect(result.current.currentPage).toBe(3);
    act(() => jest.advanceTimersByTime(400));
    expect(result.current.displayForms.forms).toHaveLength(1);

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
    });
    expect(result.current.currentPage).toBe(2);

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home' }));
    });
    expect(result.current.currentPage).toBe(1);

    const lastCall = mockSetSearchParams.mock.calls.at(-1)?.[0] as URLSearchParams;
    expect(lastCall.get('page')).toBeNull();
  });

  it('handles missing pagination data without errors', () => {
    setQueryResults({
      my: createQueryResult({ data: undefined }),
      shared: createQueryResult({ data: undefined }),
    });
    mockUseSearchParams.mockReturnValue([
      new URLSearchParams('filter=shared-with-me'),
      mockSetSearchParams,
    ]);

    const { result } = renderHook(() =>
      useFormsDashboard({ organizationId: 'org-1' }),
    );

    expect(result.current.displayForms.forms).toEqual([]);
    expect(result.current.displayForms.pagination).toBeUndefined();
    expect(result.current.displayForms.totalCounts).toEqual({
      myForms: 0,
      sharedForms: 0,
      all: 0,
    });

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    });
    expect(result.current.currentPage).toBe(1);
  });

  it('shows toast errors once per message and resets after resolution', () => {
    const firstError = new Error('primary failure');
    setQueryResults({
      my: createQueryResult({ error: firstError }),
    });

    const { rerender } = renderHook(
      (props: { organizationId: string }) =>
        useFormsDashboard(props),
      {
        initialProps: { organizationId: 'org-1' },
      },
    );

    expect(toast).toHaveBeenCalledTimes(1);
    expect(toast).toHaveBeenLastCalledWith(
      'dashboard.toast.loadError.title',
      expect.objectContaining({ description: 'primary failure' }),
    );

    rerender({ organizationId: 'org-1' });
    expect(toast).toHaveBeenCalledTimes(1);

    setQueryResults({
      my: createQueryResult({ error: null }),
    });
    rerender({ organizationId: 'org-1' });
    expect(toast).toHaveBeenCalledTimes(1);

    setQueryResults({
      my: createQueryResult({ error: new Error('primary failure') }),
    });
    rerender({ organizationId: 'org-1' });
    expect(toast).toHaveBeenCalledTimes(2);

    const emptyMessageError = new Error('');
    emptyMessageError.message = '';
    setQueryResults({
      my: createQueryResult({ error: emptyMessageError }),
    });
    rerender({ organizationId: 'org-1' });
    expect(toast).toHaveBeenCalledTimes(3);
    expect(toast).toHaveBeenLastCalledWith(
      'dashboard.toast.loadError.title',
      expect.objectContaining({
        description: 'dashboard.toast.loadError.descriptionFallback',
      }),
    );
  });
});
