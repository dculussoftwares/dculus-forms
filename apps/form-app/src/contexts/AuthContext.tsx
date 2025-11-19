import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useQuery } from '@apollo/client';
import { useSession } from '../lib/auth-client';
import { gql } from '@apollo/client';
import { toastError } from '@dculus/ui';
import { useTranslation } from '../hooks/useTranslation';
import {
  GRAPHQL_ERROR_CODES,
  type GraphQLErrorCode,
} from '@dculus/types/graphql';
import { extractGraphQLErrorCode } from '../utils/graphqlErrors';

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
  organizationErrorCode: GraphQLErrorCode | null;
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


const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({
  children
}: { children: ReactNode }): React.ReactElement => {
  const { t } = useTranslation('authContext');
  const { data: session, isPending } = useSession();
  const [isLoading, setIsLoading] = useState(true);
  const [organizationError, setOrganizationError] = useState<string | null>(null);
  const [organizationErrorCode, setOrganizationErrorCode] = useState<GraphQLErrorCode | null>(null);

  const { data: orgData, error: orgError } = useQuery(ACTIVE_ORGANIZATION, {
    skip: !session?.user,
    errorPolicy: 'all',
  });


  useEffect(() => {
    setIsLoading(isPending);
  }, [isPending]);

  // Handle organization query errors
  useEffect(() => {
    if (orgError) {
      const errorMessage =
        orgError.graphQLErrors?.[0]?.message ||
        orgError.message ||
        'Failed to load organization';
      const errorCode = extractGraphQLErrorCode(orgError);
      setOrganizationError(errorMessage);
      setOrganizationErrorCode(errorCode ?? null);

      if (errorCode === GRAPHQL_ERROR_CODES.NO_ACCESS) {
        toastError(
          t('errors.accessDenied.title'),
          t('errors.accessDenied.message')
        );
      } else if (errorCode === GRAPHQL_ERROR_CODES.AUTHENTICATION_REQUIRED) {
        toastError(
          t('errors.authRequired.title'),
          t('errors.authRequired.message')
        );
      }
    } else {
      setOrganizationError(null);
      setOrganizationErrorCode(null);
    }
  }, [orgError, t]);


  const value: AuthContextType = {
    user: session?.user || null,
    isLoading,
    isAuthenticated: !!session?.user,
    activeOrganization: orgData?.activeOrganization || null,
    organizationError,
    organizationErrorCode,
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
