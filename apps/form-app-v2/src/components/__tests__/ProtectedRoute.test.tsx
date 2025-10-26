import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ProtectedRoute } from '../ProtectedRoute';
import { useAuth } from '../../contexts/AuthContext';

// Mock dependencies
jest.mock('../../contexts/AuthContext', () => ({
  useAuth: jest.fn(),
}));

jest.mock('@dculus/ui-v2', () => ({
  Spinner: ({ className }: { className?: string }) => (
    <div data-testid="spinner" className={className}>
      Loading...
    </div>
  ),
}));

// Mock react-router-dom's Navigate component
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  Navigate: ({ to, state, replace }: { to: string; state?: unknown; replace?: boolean }) => (
    <div data-testid="navigate" data-to={to} data-state={JSON.stringify(state)} data-replace={replace}>
      Navigate to {to}
    </div>
  ),
}));

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

// Test component to verify children rendering
const TestChild = () => <div data-testid="test-child">Protected Content</div>;

// Helper to render ProtectedRoute with MemoryRouter
const renderProtectedRoute = (initialEntries: string[] = ['/dashboard']) => {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <ProtectedRoute>
        <TestChild />
      </ProtectedRoute>
    </MemoryRouter>
  );
};

describe('ProtectedRoute', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Loading State', () => {
    it('should render spinner when isLoading is true', () => {
      mockUseAuth.mockReturnValue({
        isAuthenticated: false,
        isLoading: true,
        user: null,
        activeOrganization: null,
        organizationError: null,
      });

      renderProtectedRoute();

      const spinner = screen.getByTestId('spinner');
      expect(spinner).toBeInTheDocument();
      expect(spinner).toHaveClass('h-8', 'w-8');
      expect(screen.queryByTestId('test-child')).not.toBeInTheDocument();
      expect(screen.queryByTestId('navigate')).not.toBeInTheDocument();
    });

    it('should render spinner in a centered container', () => {
      mockUseAuth.mockReturnValue({
        isAuthenticated: false,
        isLoading: true,
        user: null,
        activeOrganization: null,
        organizationError: null,
      });

      renderProtectedRoute();

      const container = screen.getByTestId('spinner').parentElement;
      expect(container).toHaveClass(
        'flex',
        'h-screen',
        'items-center',
        'justify-center'
      );
    });
  });

  describe('Unauthenticated State', () => {
    it('should redirect to signin when user is not authenticated', () => {
      mockUseAuth.mockReturnValue({
        isAuthenticated: false,
        isLoading: false,
        user: null,
        activeOrganization: null,
        organizationError: null,
      });

      renderProtectedRoute(['/dashboard']);

      const navigate = screen.getByTestId('navigate');
      expect(navigate).toBeInTheDocument();
      expect(navigate).toHaveAttribute('data-to', '/signin');
      expect(navigate).toHaveAttribute('data-replace', 'true');
      expect(screen.queryByTestId('test-child')).not.toBeInTheDocument();
      expect(screen.queryByTestId('spinner')).not.toBeInTheDocument();
    });

    it('should pass current location as state to signin redirect', () => {
      mockUseAuth.mockReturnValue({
        isAuthenticated: false,
        isLoading: false,
        user: null,
        activeOrganization: null,
        organizationError: null,
      });

      renderProtectedRoute(['/forms/create']);

      const navigate = screen.getByTestId('navigate');
      const stateData = JSON.parse(navigate.getAttribute('data-state') || '{}');
      expect(stateData.from).toEqual({
        pathname: '/forms/create',
        search: '',
        hash: '',
        state: null,
        key: expect.any(String),
      });
    });

    it('should preserve query parameters in location state', () => {
      mockUseAuth.mockReturnValue({
        isAuthenticated: false,
        isLoading: false,
        user: null,
        activeOrganization: null,
        organizationError: null,
      });

      renderProtectedRoute(['/dashboard?tab=templates&filter=recent']);

      const navigate = screen.getByTestId('navigate');
      const stateData = JSON.parse(navigate.getAttribute('data-state') || '{}');
      expect(stateData.from.pathname).toBe('/dashboard');
      expect(stateData.from.search).toBe('?tab=templates&filter=recent');
    });

    it('should preserve hash in location state', () => {
      mockUseAuth.mockReturnValue({
        isAuthenticated: false,
        isLoading: false,
        user: null,
        activeOrganization: null,
        organizationError: null,
      });

      renderProtectedRoute(['/dashboard#section-forms']);

      const navigate = screen.getByTestId('navigate');
      const stateData = JSON.parse(navigate.getAttribute('data-state') || '{}');
      expect(stateData.from.pathname).toBe('/dashboard');
      expect(stateData.from.hash).toBe('#section-forms');
    });
  });

  describe('Authenticated State', () => {
    it('should render children when user is authenticated and not loading', () => {
      mockUseAuth.mockReturnValue({
        isAuthenticated: true,
        isLoading: false,
        user: {
          id: '1',
          name: 'John Doe',
          email: 'john@example.com',
          emailVerified: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        activeOrganization: {
          id: 'org-1',
          name: 'Test Org',
          slug: 'test-org',
        },
        organizationError: null,
      });

      renderProtectedRoute();

      expect(screen.getByTestId('test-child')).toBeInTheDocument();
      expect(screen.getByText('Protected Content')).toBeInTheDocument();
      expect(screen.queryByTestId('spinner')).not.toBeInTheDocument();
      expect(screen.queryByTestId('navigate')).not.toBeInTheDocument();
    });

    it('should render children when user is authenticated even with organization error', () => {
      mockUseAuth.mockReturnValue({
        isAuthenticated: true,
        isLoading: false,
        user: {
          id: '1',
          name: 'John Doe',
          email: 'john@example.com',
          emailVerified: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        activeOrganization: null,
        organizationError: 'Organization load failed',
      });

      renderProtectedRoute();

      expect(screen.getByTestId('test-child')).toBeInTheDocument();
      expect(screen.queryByTestId('spinner')).not.toBeInTheDocument();
      expect(screen.queryByTestId('navigate')).not.toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('should prioritize loading state over authentication state', () => {
      mockUseAuth.mockReturnValue({
        isAuthenticated: true,
        isLoading: true,
        user: {
          id: '1',
          name: 'John Doe',
          email: 'john@example.com',
          emailVerified: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        activeOrganization: null,
        organizationError: null,
      });

      renderProtectedRoute();

      expect(screen.getByTestId('spinner')).toBeInTheDocument();
      expect(screen.queryByTestId('test-child')).not.toBeInTheDocument();
      expect(screen.queryByTestId('navigate')).not.toBeInTheDocument();
    });

    it('should handle falsy children gracefully', () => {
      mockUseAuth.mockReturnValue({
        isAuthenticated: true,
        isLoading: false,
        user: {
          id: '1',
          name: 'John Doe',
          email: 'john@example.com',
          emailVerified: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        activeOrganization: null,
        organizationError: null,
      });

      render(
        <MemoryRouter>
          <ProtectedRoute>
            {null}
          </ProtectedRoute>
        </MemoryRouter>
      );

      // Should not crash and should not render any content
      expect(screen.queryByTestId('test-child')).not.toBeInTheDocument();
      expect(screen.queryByTestId('spinner')).not.toBeInTheDocument();
      expect(screen.queryByTestId('navigate')).not.toBeInTheDocument();
    });

    it('should handle multiple children', () => {
      mockUseAuth.mockReturnValue({
        isAuthenticated: true,
        isLoading: false,
        user: {
          id: '1',
          name: 'John Doe',
          email: 'john@example.com',
          emailVerified: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        activeOrganization: null,
        organizationError: null,
      });

      render(
        <MemoryRouter>
          <ProtectedRoute>
            <div data-testid="child-1">Child 1</div>
            <div data-testid="child-2">Child 2</div>
          </ProtectedRoute>
        </MemoryRouter>
      );

      expect(screen.getByTestId('child-1')).toBeInTheDocument();
      expect(screen.getByTestId('child-2')).toBeInTheDocument();
    });

    it('should handle root path correctly', () => {
      mockUseAuth.mockReturnValue({
        isAuthenticated: false,
        isLoading: false,
        user: null,
        activeOrganization: null,
        organizationError: null,
      });

      renderProtectedRoute(['/']);

      const navigate = screen.getByTestId('navigate');
      const stateData = JSON.parse(navigate.getAttribute('data-state') || '{}');
      expect(stateData.from.pathname).toBe('/');
    });

    it('should handle state transitions from loading to authenticated', () => {
      const { rerender } = render(
        <MemoryRouter>
          <ProtectedRoute>
            <TestChild />
          </ProtectedRoute>
        </MemoryRouter>
      );

      // Initial loading state
      mockUseAuth.mockReturnValue({
        isAuthenticated: false,
        isLoading: true,
        user: null,
        activeOrganization: null,
        organizationError: null,
      });

      rerender(
        <MemoryRouter>
          <ProtectedRoute>
            <TestChild />  
          </ProtectedRoute>
        </MemoryRouter>
      );

      expect(screen.getByTestId('spinner')).toBeInTheDocument();

      // Transition to authenticated
      mockUseAuth.mockReturnValue({
        isAuthenticated: true,
        isLoading: false,
        user: {
          id: '1',
          name: 'John Doe',
          email: 'john@example.com',
          emailVerified: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        activeOrganization: null,
        organizationError: null,
      });

      rerender(
        <MemoryRouter>
          <ProtectedRoute>
            <TestChild />
          </ProtectedRoute>
        </MemoryRouter>
      );

      expect(screen.getByTestId('test-child')).toBeInTheDocument();
      expect(screen.queryByTestId('spinner')).not.toBeInTheDocument();
    });

    it('should handle state transitions from loading to unauthenticated', () => {
      const { rerender } = render(
        <MemoryRouter>
          <ProtectedRoute>
            <TestChild />
          </ProtectedRoute>
        </MemoryRouter>
      );

      // Initial loading state
      mockUseAuth.mockReturnValue({
        isAuthenticated: false,
        isLoading: true,
        user: null,
        activeOrganization: null,
        organizationError: null,
      });

      rerender(
        <MemoryRouter>
          <ProtectedRoute>
            <TestChild />
          </ProtectedRoute>
        </MemoryRouter>
      );

      expect(screen.getByTestId('spinner')).toBeInTheDocument();

      // Transition to unauthenticated
      mockUseAuth.mockReturnValue({
        isAuthenticated: false,
        isLoading: false,
        user: null,
        activeOrganization: null,
        organizationError: null,
      });

      rerender(
        <MemoryRouter>
          <ProtectedRoute>
            <TestChild />
          </ProtectedRoute>
        </MemoryRouter>
      );

      expect(screen.getByTestId('navigate')).toBeInTheDocument();
      expect(screen.queryByTestId('spinner')).not.toBeInTheDocument();
    });
  });

  describe('Component Interface', () => {
    it('should accept ReactNode children prop', () => {
      mockUseAuth.mockReturnValue({
        isAuthenticated: true,
        isLoading: false,
        user: {
          id: '1',
          name: 'John Doe',
          email: 'john@example.com',
          emailVerified: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        activeOrganization: null,
        organizationError: null,
      });

      render(
        <MemoryRouter>
          <ProtectedRoute>
            <div>Text content</div>
          </ProtectedRoute>
        </MemoryRouter>
      );

      expect(screen.getByText('Text content')).toBeInTheDocument();
    });

    it('should return React.ReactElement', () => {
      mockUseAuth.mockReturnValue({
        isAuthenticated: true,
        isLoading: false,
        user: {
          id: '1',
          name: 'John Doe',
          email: 'john@example.com',
          emailVerified: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        activeOrganization: null,
        organizationError: null,
      });

      const { container } = render(
        <MemoryRouter>
          <ProtectedRoute>
            <TestChild />
          </ProtectedRoute>
        </MemoryRouter>
      );

      // Should render without errors and have valid DOM structure
      expect(container.firstChild).toBeInTheDocument();
    });
  });
});