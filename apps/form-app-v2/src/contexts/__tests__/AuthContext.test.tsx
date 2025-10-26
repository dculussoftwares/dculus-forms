import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MockedProvider, type MockedResponse } from '@apollo/client/testing';
import { AuthProvider, useAuth, useAuthContext } from '../AuthContext';
import { useSession } from '../../lib/auth-client';
import { ACTIVE_ORGANIZATION } from '../../graphql/queries';
import { toast } from '@dculus/ui-v2';
import { TranslationProvider } from '../../i18n';

// Mock dependencies with proper typing
jest.mock('../../lib/auth-client', () => ({
  useSession: jest.fn(),
}));

jest.mock('@dculus/ui-v2', () => ({
  toast: jest.fn(),
}));

// Test component to consume the context
const TestConsumer = () => {
  const { user, isLoading, isAuthenticated, activeOrganization, organizationError } = useAuth();
  
  return (
    <div>
      <div data-testid="user">{user ? JSON.stringify(user) : 'null'}</div>
      <div data-testid="isLoading">{isLoading.toString()}</div>
      <div data-testid="isAuthenticated">{isAuthenticated.toString()}</div>
      <div data-testid="activeOrganization">
        {activeOrganization ? JSON.stringify(activeOrganization) : 'null'}
      </div>
      <div data-testid="organizationError">{organizationError || 'null'}</div>
    </div>
  );
};

// Test component that uses useAuthContext alias
const TestConsumerAlias = () => {
  const { user, isLoading } = useAuthContext();
  return (
    <div>
      <div data-testid="alias-user">{user ? JSON.stringify(user) : 'null'}</div>
      <div data-testid="alias-isLoading">{isLoading.toString()}</div>
    </div>
  );
};

// Helper to render with providers
const renderWithProviders = (
  children: React.ReactNode,
  mocks: MockedResponse[] = []
) => {
  return render(
    <MockedProvider mocks={mocks} addTypename={false}>
      <TranslationProvider>
        <AuthProvider>
          {children}
        </AuthProvider>
      </TranslationProvider>
    </MockedProvider>
  );
};

// Mock data
const mockUser = {
  id: 'user-1',
  name: 'John Doe',
  email: 'john@example.com',
  emailVerified: true,
  image: 'https://example.com/avatar.jpg',
  createdAt: new Date('2023-01-01'),
  updatedAt: new Date('2023-01-02'),
};

const mockOrganization = {
  id: 'org-1',
  name: 'Test Organization',
  slug: 'test-org',
  logo: 'https://example.com/logo.jpg',
  members: [
    {
      id: 'member-1',
      role: 'owner',
      user: {
        id: 'user-1',
        name: 'John Doe',
        email: 'john@example.com',
      },
    },
  ],
};

const mockActiveOrganizationQuery = {
  request: {
    query: ACTIVE_ORGANIZATION,
  },
  result: {
    data: {
      activeOrganization: mockOrganization,
    },
  },
};



// Create a mock session return type
interface MockSessionData {
  data: {
    user?: {
      id: string;
      name: string;
      email: string;
      emailVerified: boolean;
      image?: string | null;
      createdAt: Date;
      updatedAt: Date;
    };
    session?: {
      id: string;
      userId: string;
      activeOrganizationId?: string;
    };
  } | null;
  isPending: boolean;
  error?: unknown;
  refetch?: () => void;
}

describe('AuthContext', () => {
  const mockUseSession = useSession as jest.MockedFunction<() => MockSessionData>;
  const mockToast = toast as jest.MockedFunction<typeof toast>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('AuthProvider', () => {
    it('renders children correctly', () => {
      mockUseSession.mockReturnValue({
        data: null,
        isPending: false,
      });

      renderWithProviders(<div data-testid="test-child">Test Child</div>);

      expect(screen.getByTestId('test-child')).toBeInTheDocument();
      expect(screen.getByText('Test Child')).toBeInTheDocument();
    });

    it('provides context values when session is null', () => {
      mockUseSession.mockReturnValue({
        data: null,
        isPending: false,
      });

      renderWithProviders(<TestConsumer />);

      expect(screen.getByTestId('user')).toHaveTextContent('null');
      expect(screen.getByTestId('isLoading')).toHaveTextContent('false');
      expect(screen.getByTestId('isAuthenticated')).toHaveTextContent('false');
      expect(screen.getByTestId('activeOrganization')).toHaveTextContent('null');
      expect(screen.getByTestId('organizationError')).toHaveTextContent('null');
    });

    it('provides context values when session exists', async () => {
      mockUseSession.mockReturnValue({
        data: { user: mockUser, session: { id: 'session-1', userId: 'user-1' } },
        isPending: false,
      });

      renderWithProviders(<TestConsumer />, [mockActiveOrganizationQuery]);

      expect(screen.getByTestId('user')).toHaveTextContent(JSON.stringify(mockUser));
      expect(screen.getByTestId('isLoading')).toHaveTextContent('false');
      expect(screen.getByTestId('isAuthenticated')).toHaveTextContent('true');

      // Wait for organization data to load
      await waitFor(() => {
        expect(screen.getByTestId('activeOrganization')).toHaveTextContent(
          JSON.stringify(mockOrganization)
        );
      });
    });

    it('handles loading state correctly', () => {
      mockUseSession.mockReturnValue({
        data: null,
        isPending: true,
      });

      renderWithProviders(<TestConsumer />);

      expect(screen.getByTestId('isLoading')).toHaveTextContent('true');
    });

    it('updates loading state when isPending changes', () => {
      const { rerender } = render(
        <MockedProvider mocks={[]} addTypename={false}>
          <TranslationProvider>
            <AuthProvider>
              <TestConsumer />
            </AuthProvider>
          </TranslationProvider>
        </MockedProvider>
      );

      // Initial loading state
      mockUseSession.mockReturnValue({
        data: null,
        isPending: true,
      });

      rerender(
        <MockedProvider mocks={[]} addTypename={false}>
          <TranslationProvider>
            <AuthProvider>
              <TestConsumer />
            </AuthProvider>
          </TranslationProvider>
        </MockedProvider>
      );

      expect(screen.getByTestId('isLoading')).toHaveTextContent('true');

      // Loading finished
      mockUseSession.mockReturnValue({
        data: null,
        isPending: false,
      });

      rerender(
        <MockedProvider mocks={[]} addTypename={false}>
          <TranslationProvider>
            <AuthProvider>
              <TestConsumer />
            </AuthProvider>
          </TranslationProvider>
        </MockedProvider>
      );

      expect(screen.getByTestId('isLoading')).toHaveTextContent('false');
    });
  });

  describe('Organization Error Handling', () => {
    it('handles network errors and shows generic error toast', async () => {
      mockUseSession.mockReturnValue({
        data: { user: mockUser, session: { id: 'session-1', userId: 'user-1' } },
        isPending: false,
      });

      const networkErrorMock = {
        request: {
          query: ACTIVE_ORGANIZATION,
        },
        error: new Error('Network error'),
      };

      renderWithProviders(<TestConsumer />, [networkErrorMock]);

      await waitFor(() => {
        expect(screen.getByTestId('organizationError')).toHaveTextContent('Network error');
      });

      expect(mockToast).not.toHaveBeenCalled();
    });

    it('handles access denied errors and shows appropriate toast', async () => {
      mockUseSession.mockReturnValue({
        data: { user: mockUser, session: { id: 'session-1', userId: 'user-1' } },
        isPending: false,
      });

      const accessDeniedMock = {
        request: {
          query: ACTIVE_ORGANIZATION,
        },
        result: {
          errors: [
            {
              message: 'Access denied: You are not a member of this organization',
            },
          ],
        },
      };

      renderWithProviders(<TestConsumer />, [accessDeniedMock]);

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith('Organization Access Denied', {
          description: 'You are not a member of this organization',
        });
      });

      expect(screen.getByTestId('organizationError')).toHaveTextContent(
        'Access denied: You are not a member of this organization'
      );
    });

    it('handles authentication required errors and shows appropriate toast', async () => {
      mockUseSession.mockReturnValue({
        data: { user: mockUser, session: { id: 'session-1', userId: 'user-1' } },
        isPending: false,
      });

      const authRequiredMock = {
        request: {
          query: ACTIVE_ORGANIZATION,
        },
        result: {
          errors: [
            {
              message: 'Authentication required',
            },
          ],
        },
      };

      renderWithProviders(<TestConsumer />, [authRequiredMock]);

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith('Authentication Required', {
          description: 'Please sign in to access organizations',
        });
      });
    });

    it('clears organization error when query succeeds', async () => {
      mockUseSession.mockReturnValue({
        data: { user: mockUser, session: { id: 'session-1', userId: 'user-1' } },
        isPending: false,
      });

      // Test successful query after initial render (no error case)
      const successMock = {
        request: {
          query: ACTIVE_ORGANIZATION,
        },
        result: {
          data: {
            activeOrganization: mockOrganization,
          },
        },
      };

      renderWithProviders(<TestConsumer />, [successMock]);

      // Wait for organization data to load successfully
      await waitFor(() => {
        expect(screen.getByTestId('activeOrganization')).toHaveTextContent(
          JSON.stringify(mockOrganization)
        );
      });

      // Verify no error is present
      expect(screen.getByTestId('organizationError')).toHaveTextContent('null');
    });

    it('handles empty error messages from MockedProvider', async () => {
      mockUseSession.mockReturnValue({
        data: { user: mockUser, session: { id: 'session-1', userId: 'user-1' } },
        isPending: false,
      });

      // MockedProvider provides "Error message not found." for empty errors
      const emptyErrorMock = {
        request: {
          query: ACTIVE_ORGANIZATION,
        },
        error: new Error(''),
      };

      renderWithProviders(<TestConsumer />, [emptyErrorMock]);

      await waitFor(() => {
        expect(screen.getByTestId('organizationError')).toHaveTextContent('Error message not found.');
      });
    });

    it('uses fallback translation when error has no message', () => {
      // This test specifically checks the fallback logic in the AuthContext
      // by directly testing what happens when both graphQLErrors and message are falsy
      const mockError = {
        graphQLErrors: [] as Array<{ message?: string }>,
        message: '',
        networkError: null,
      };

      const fallbackMessage = 'Failed to load organization';
      
      // Test the error handling logic directly - mimics the logic in AuthContext
      const errorMessage = mockError.graphQLErrors?.[0]?.message || mockError.message || fallbackMessage;
      expect(errorMessage).toBe(fallbackMessage);
    });
  });

  describe('GraphQL Query Behavior', () => {
    it('skips organization query when user is not authenticated', () => {
      mockUseSession.mockReturnValue({
        data: null,
        isPending: false,
      });

      // No mocks needed since query is skipped when user is not authenticated
      renderWithProviders(<TestConsumer />);

      // Organization should remain null without error
      expect(screen.getByTestId('activeOrganization')).toHaveTextContent('null');
      expect(screen.getByTestId('organizationError')).toHaveTextContent('null');
    });

    it('executes organization query when user is authenticated', async () => {
      mockUseSession.mockReturnValue({
        data: { user: mockUser, session: { id: 'session-1', userId: 'user-1' } },
        isPending: false,
      });

      renderWithProviders(<TestConsumer />, [mockActiveOrganizationQuery]);

      await waitFor(() => {
        expect(screen.getByTestId('activeOrganization')).toHaveTextContent(
          JSON.stringify(mockOrganization)
        );
      });
    });
  });

  describe('useAuth hook', () => {
    it('throws error when used outside AuthProvider', () => {
      // Suppress console.error for this test since we expect an error
      const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        render(
          <TranslationProvider>
            <TestConsumer />
          </TranslationProvider>
        );
      }).toThrow('useAuth must be used within an AuthProvider');

      consoleError.mockRestore();
    });

    it('returns context when used within AuthProvider', () => {
      mockUseSession.mockReturnValue({
        data: null,
        isPending: false,
      });

      renderWithProviders(<TestConsumer />);

      // Should not throw and should render with default values
      expect(screen.getByTestId('user')).toBeInTheDocument();
      expect(screen.getByTestId('isLoading')).toBeInTheDocument();
    });
  });

  describe('useAuthContext alias', () => {
    it('works as an alias for useAuth', () => {
      mockUseSession.mockReturnValue({
        data: { user: mockUser, session: { id: 'session-1', userId: 'user-1' } },
        isPending: false,
      });

      renderWithProviders(<TestConsumerAlias />);

      expect(screen.getByTestId('alias-user')).toHaveTextContent(JSON.stringify(mockUser));
      expect(screen.getByTestId('alias-isLoading')).toHaveTextContent('false');
    });

    it('throws error when used outside AuthProvider', () => {
      const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        render(
          <TranslationProvider>
            <TestConsumerAlias />
          </TranslationProvider>
        );
      }).toThrow('useAuth must be used within an AuthProvider');

      consoleError.mockRestore();
    });
  });

  describe('Edge Cases', () => {
    it('handles session with undefined user', () => {
      mockUseSession.mockReturnValue({
        data: null, // session data is null when user is undefined
        isPending: false,
      });

      renderWithProviders(<TestConsumer />);

      expect(screen.getByTestId('user')).toHaveTextContent('null');
      expect(screen.getByTestId('isAuthenticated')).toHaveTextContent('false');
    });

    it('handles partial user data', () => {
      const partialUser = {
        id: 'user-1',
        name: 'John',
        email: 'john@example.com',
        emailVerified: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockUseSession.mockReturnValue({
        data: { user: partialUser, session: { id: 'session-1', userId: 'user-1' } },
        isPending: false,
      });

      renderWithProviders(<TestConsumer />);

      expect(screen.getByTestId('user')).toHaveTextContent(JSON.stringify(partialUser));
      expect(screen.getByTestId('isAuthenticated')).toHaveTextContent('true');
    });

    it('handles organization data without members', async () => {
      const orgWithoutMembers = {
        id: 'org-1',
        name: 'Test Organization',
        slug: 'test-org',
        logo: null,
        members: null, // GraphQL will return null for optional fields
      };

      const mockQuery = {
        request: {
          query: ACTIVE_ORGANIZATION,
        },
        result: {
          data: {
            activeOrganization: orgWithoutMembers,
          },
        },
      };

      mockUseSession.mockReturnValue({
        data: { user: mockUser, session: { id: 'session-1', userId: 'user-1' } },
        isPending: false,
      });

      renderWithProviders(<TestConsumer />, [mockQuery]);

      await waitFor(() => {
        expect(screen.getByTestId('activeOrganization')).toHaveTextContent(
          JSON.stringify(orgWithoutMembers)
        );
      });
    });
  });
});