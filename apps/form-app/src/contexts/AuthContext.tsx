import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import { useSession } from '../lib/auth-client';
import { gql } from '@apollo/client';
import { toastError, toastSuccess } from '@dculus/ui';

// Better-Auth user type (based on the auth configuration)
interface AuthUser {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  image?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface Organization {
  id: string;
  name: string;
  slug: string;
  logo?: string | null;
  members?: Array<{
    id: string;
    role: string;
    user: AuthUser;
  }>;
}

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  activeOrganization: Organization | null;
  organizationError: string | null;
  setActiveOrganization: (organizationId: string) => Promise<boolean>;
}

const ACTIVE_ORGANIZATION = gql`
  query ActiveOrganization {
    activeOrganization {
      id
      name
      slug
      logo
      members {
        id
        role
        user {
          id
          name
          email
        }
      }
    }
  }
`;

const SET_ACTIVE_ORGANIZATION = gql`
  mutation SetActiveOrganization($organizationId: ID!) {
    setActiveOrganization(organizationId: $organizationId) {
      id
      name
      slug
      logo
      members {
        id
        role
        user {
          id
          name
          email
        }
      }
    }
  }
`;

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({
  children
}: { children: ReactNode }): React.ReactElement => {
  const { data: session, isPending } = useSession();
  const [isLoading, setIsLoading] = useState(true);
  const [organizationError, setOrganizationError] = useState<string | null>(null);

  const { data: orgData, error: orgError } = useQuery(ACTIVE_ORGANIZATION, {
    skip: !session?.user,
    errorPolicy: 'all',
  });

  const [setActiveOrgMutation] = useMutation(SET_ACTIVE_ORGANIZATION, {
    errorPolicy: 'all',
  });

  useEffect(() => {
    setIsLoading(isPending);
  }, [isPending]);

  // Handle organization query errors
  useEffect(() => {
    if (orgError) {
      const errorMessage = orgError.graphQLErrors?.[0]?.message || orgError.message || 'Failed to load organization';
      setOrganizationError(errorMessage);

      // Show user-friendly error messages for specific authorization errors
      if (errorMessage.includes('Access denied') || errorMessage.includes('not a member')) {
        toastError('Organization Access Denied', 'You are not a member of this organization');
      } else if (errorMessage.includes('Authentication required')) {
        toastError('Authentication Required', 'Please sign in to access organizations');
      }
    } else {
      setOrganizationError(null);
    }
  }, [orgError]);

  const setActiveOrganization = async (organizationId: string): Promise<boolean> => {
    try {
      setOrganizationError(null);

      const result = await setActiveOrgMutation({
        variables: { organizationId },
        refetchQueries: ['ActiveOrganization'],
      });

      if (result.data?.setActiveOrganization) {
        toastSuccess('Organization switched', `Switched to ${result.data.setActiveOrganization.name}`);
        return true;
      }

      return false;
    } catch (error: any) {
      const errorMessage = error.graphQLErrors?.[0]?.message || error.message || 'Failed to switch organization';
      setOrganizationError(errorMessage);

      // Show specific error messages based on the error type
      if (errorMessage.includes('Access denied') || errorMessage.includes('not a member')) {
        toastError('Access Denied', 'You are not a member of this organization');
      } else if (errorMessage.includes('Authentication required')) {
        toastError('Authentication Required', 'Please sign in to switch organizations');
      } else {
        toastError('Failed to Switch Organization', errorMessage);
      }

      return false;
    }
  };

  const value: AuthContextType = {
    user: session?.user || null,
    isLoading,
    isAuthenticated: !!session?.user,
    activeOrganization: orgData?.activeOrganization || null,
    organizationError,
    setActiveOrganization,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const useAuthContext = useAuth;
