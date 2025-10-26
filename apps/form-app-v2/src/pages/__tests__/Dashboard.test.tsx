import { render, screen, fireEvent, within } from '@testing-library/react';
import { TranslationProvider } from '../../i18n';
import { Dashboard } from '../Dashboard';
import { toast } from '@dculus/ui-v2';

jest.mock('@/components/app-sidebar', () => ({
  AppSidebar: () => <div data-testid="app-sidebar" />,
}));

jest.mock('../../components/dashboard', () => ({
  FormCard: ({
    form,
    onOpenDashboard,
    onOpenBuilder,
    onOpenPreview,
  }: any) => (
    <div data-testid={`form-card-${form.id}`}>
      <span>{form.title}</span>
      <button onClick={() => onOpenDashboard(form.id)}>open-dashboard</button>
      <button onClick={() => onOpenBuilder(form.id)}>open-builder</button>
      <button onClick={() => onOpenPreview(form)}>open-preview</button>
    </div>
  ),
}));

const mockUseFormsDashboard = jest.fn();
jest.mock('../../hooks/useFormsDashboard', () => ({
  useFormsDashboard: () => mockUseFormsDashboard(),
}));

const mockUseAuth = jest.fn();
jest.mock('../../contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => {
  const actual = jest.requireActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const renderDashboard = () =>
  render(
    <TranslationProvider>
      <Dashboard />
    </TranslationProvider>
  );

const createAuthState = (overrides: Record<string, unknown> = {}) => ({
  user: null,
  isLoading: false,
  isAuthenticated: false,
  activeOrganization: null,
  organizationError: null,
  ...overrides,
});

const createDashboardState = (overrides: Record<string, any> = {}) => {
  const base = {
    searchTerm: '',
    setSearchTerm: jest.fn(),
    activeFilter: 'my-forms',
    handleFilterChange: jest.fn(),
    currentPage: 1,
    handlePageChange: jest.fn(),
    isPageChanging: false,
    isTyping: false,
    formsLoading: false,
    formsError: null,
    displayForms: {
      forms: [],
      pagination: undefined,
      showPermissionBadge: false,
      totalCounts: {
        myForms: 0,
        sharedForms: 0,
        all: 0,
      },
    },
    contentRef: { current: null },
    clearSearch: jest.fn(),
  };

  const mergedDisplayForms = {
    ...base.displayForms,
    ...(overrides.displayForms ?? {}),
    totalCounts: {
      ...base.displayForms.totalCounts,
      ...(overrides.displayForms?.totalCounts ?? {}),
    },
  };

  return {
    ...base,
    ...overrides,
    displayForms: mergedDisplayForms,
  };
};

describe('Dashboard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseFormsDashboard.mockReset();
    mockUseAuth.mockReset();
    mockNavigate.mockReset();
    window.open = jest.fn();
  });

  it('renders loading skeleton while forms are loading', () => {
    mockUseAuth.mockReturnValue(
      createAuthState({
        activeOrganization: { id: 'org-1', name: 'Org', slug: 'org' },
      })
    );

    mockUseFormsDashboard.mockReturnValue(
      createDashboardState({
        formsLoading: true,
      })
    );

    renderDashboard();

    expect(screen.getAllByTestId('skeleton')).toHaveLength(6);
  });

  it('shows organization notice when no active organization exists', () => {
    mockUseAuth.mockReturnValue(createAuthState());
    mockUseFormsDashboard.mockReturnValue(createDashboardState());

    renderDashboard();

    expect(
      screen.getByText('No organization selected')
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /All Forms/ })
    ).toBeDisabled();
    fireEvent.click(
      screen.getByRole('button', { name: 'Explore templates' })
    );
    expect(mockNavigate).toHaveBeenCalledWith('/dashboard/templates');
  });

  it('renders empty state when organization has no forms', () => {
    mockUseAuth.mockReturnValue(
      createAuthState({
        activeOrganization: { id: 'org-1', name: 'Org', slug: 'org' },
      })
    );

    mockUseFormsDashboard.mockReturnValue(
      createDashboardState({
        formsLoading: false,
        displayForms: {
          forms: [],
          showPermissionBadge: false,
          totalCounts: { myForms: 0, sharedForms: 0, all: 0 },
        },
      })
    );

    renderDashboard();

    expect(screen.getByText('No forms yet')).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole('button', { name: 'Create your first form' })
    );
    expect(mockNavigate).toHaveBeenCalledWith('/dashboard/templates');
  });

  it('renders forms, supports interactions, and handles pagination', () => {
    const handleFilterChange = jest.fn();
    const handlePageChange = jest.fn();
    const clearSearch = jest.fn();
    const setSearchTerm = jest.fn();

    const forms = [
      {
        id: 'form-1',
        title: 'Form One',
        shortUrl: 'abc',
        isPublished: true,
        responseCount: 10,
        createdAt: '2024-01-01',
        updatedAt: '2024-01-02',
      },
      {
        id: 'form-2',
        title: 'Form Two',
        shortUrl: '',
        isPublished: false,
        responseCount: 0,
        createdAt: '2024-01-03',
        updatedAt: '2024-01-04',
      },
    ];

    mockUseAuth.mockReturnValue(
      createAuthState({
        user: { id: 'u1', name: 'Alex', email: 'alex@example.com' },
        isAuthenticated: true,
        activeOrganization: { id: 'org-1', name: 'Org', slug: 'org' },
      })
    );

    mockUseFormsDashboard.mockReturnValue(
      createDashboardState({
        searchTerm: 'test',
        setSearchTerm,
        activeFilter: 'all',
        handleFilterChange,
        currentPage: 4,
        handlePageChange,
        isPageChanging: true,
        isTyping: true,
        formsLoading: false,
        displayForms: {
          forms,
          showPermissionBadge: true,
          totalCounts: { myForms: 2, sharedForms: 1, all: 3 },
          pagination: {
            forms,
            totalCount: 20,
            page: 4,
            limit: 4,
            totalPages: 7,
            hasNextPage: true,
            hasPreviousPage: true,
          },
        },
        clearSearch,
      })
    );

    renderDashboard();

    expect(
      screen.getByText('Welcome back, Alex!')
    ).toBeInTheDocument();
    expect(screen.getByDisplayValue('test')).toBeInTheDocument();
    expect(screen.getByText('Searching...')).toBeInTheDocument();

    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'updated' },
    });
    expect(setSearchTerm).toHaveBeenCalledWith('updated');

    fireEvent.click(screen.getByRole('button', { name: /All Forms/ }));
    expect(handleFilterChange).toHaveBeenCalledWith('all');

    fireEvent.click(screen.getByRole('button', { name: /Shared with Me/ }));
    expect(handleFilterChange).toHaveBeenCalledWith('shared-with-me');

    fireEvent.click(screen.getByRole('button', { name: 'Clear search' }));
    expect(clearSearch).toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Create Form' }));
    expect(mockNavigate).toHaveBeenLastCalledWith('/dashboard/templates');

    const firstCard = screen.getByTestId('form-card-form-1');
    const secondCard = screen.getByTestId('form-card-form-2');

    fireEvent.click(within(firstCard).getByText('open-dashboard'));
    expect(mockNavigate).toHaveBeenCalledWith('/dashboard/form/form-1');

    fireEvent.click(within(firstCard).getByText('open-builder'));
    expect(mockNavigate).toHaveBeenCalledWith('/dashboard/form/form-1');

    fireEvent.click(within(firstCard).getByText('open-preview'));
    expect(window.open).toHaveBeenCalledWith(
      'http://localhost:5173/f/abc',
      '_blank',
      'noopener,noreferrer'
    );

    fireEvent.click(within(secondCard).getByText('open-preview'));
    expect(toast).toHaveBeenCalledWith('Preview unavailable', {
      description:
        'This form does not have a published short link yet.',
    });

    expect(screen.getAllByText('…')).toHaveLength(2);

    fireEvent.click(screen.getByText('Next'));
    expect(handlePageChange).toHaveBeenCalledWith(5);

    fireEvent.click(screen.getByText('Prev'));
    expect(handlePageChange).toHaveBeenCalledWith(3);

    fireEvent.click(screen.getByRole('link', { name: '5' }));
    expect(handlePageChange).toHaveBeenCalledWith(5);

    expect(
      screen.getByText('Page 4 of 7')
    ).toBeInTheDocument();
  });

  it('renders pagination without ellipsis when total pages are small', () => {
    const handlePageChange = jest.fn();
    const forms = [
      {
        id: 's-form',
        title: 'Small Form',
        shortUrl: 'small',
        isPublished: true,
        responseCount: 1,
        createdAt: '2024-01-01',
        updatedAt: '2024-01-02',
      },
    ];

    mockUseAuth.mockReturnValue(
      createAuthState({
        activeOrganization: { id: 'org-2', name: 'Org', slug: 'org' },
      })
    );

    mockUseFormsDashboard.mockReturnValue(
      createDashboardState({
        currentPage: 1,
        handlePageChange,
        displayForms: {
          forms,
          showPermissionBadge: false,
          totalCounts: { myForms: 1, sharedForms: 0, all: 1 },
          pagination: {
            forms,
            totalCount: 3,
            page: 1,
            limit: 1,
            totalPages: 3,
            hasNextPage: true,
            hasPreviousPage: false,
          },
        },
      })
    );

    renderDashboard();

    expect(screen.queryByText('…')).not.toBeInTheDocument();

    const previous = screen.getByText('Prev');
    expect(previous.getAttribute('class')).toContain('pointer-events-none opacity-50');
    fireEvent.click(previous);
    expect(handlePageChange).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('link', { name: '3' }));
    expect(handlePageChange).toHaveBeenCalledWith(3);
  });

  it('deduplicates consecutive ellipsis values when pagination data is inconsistent', () => {
    const originalMin = Math.min;
    const mathMinSpy = jest
      .spyOn(Math, 'min')
      .mockImplementation((...args: number[]) => {
        if (args[0] === 9 && args[1] === 5) {
          return 2;
        }
        return originalMin(...args);
      });
    const handlePageChange = jest.fn();
    const forms = [
      {
        id: 'weird',
        title: 'Weird Form',
        shortUrl: '',
        isPublished: false,
        responseCount: 0,
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01',
      },
    ];

    mockUseAuth.mockReturnValue(
      createAuthState({
        activeOrganization: { id: 'org-3', name: 'Org', slug: 'org' },
      })
    );

    mockUseFormsDashboard.mockReturnValue(
      createDashboardState({
        currentPage: 4,
        handlePageChange,
        displayForms: {
          forms,
          showPermissionBadge: false,
          totalCounts: { myForms: 1, sharedForms: 0, all: 1 },
          pagination: {
            forms,
            totalCount: 20,
            page: 4,
            limit: 2,
            totalPages: 10,
            hasNextPage: false,
            hasPreviousPage: true,
          },
        },
      })
    );

    try {
      renderDashboard();

      expect(screen.getAllByText('…')).toHaveLength(1);

      fireEvent.click(screen.getByText('Prev'));
      expect(handlePageChange).toHaveBeenCalledWith(3);

      const next = screen.getByText('Next');
      expect(next.getAttribute('class')).toContain('pointer-events-none opacity-50');
      fireEvent.click(next);
      expect(handlePageChange).toHaveBeenCalledTimes(1);
    } finally {
      mathMinSpy.mockRestore();
    }
  });
});
