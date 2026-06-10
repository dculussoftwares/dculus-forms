import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { useQuery } from '@apollo/client/react';
import { useSession } from '../lib/auth-client';
import { gql } from '@apollo/client';
import type { TypedDocumentNode } from '@apollo/client';
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
    createdAt: string;
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
  refetchOrganization: () => void;
}

const ACTIVE_ORGANIZATION : TypedDocumentNode<any, any> = gql`
  query ActiveOrganization {
    activeOrganization {
      id
      name
      slug
      logo
      members {
        id
        role
        createdAt
        user {
          id
          name
          email
          image
        }
      }
    }
  }
`;


const AuthContext = createContext<AuthContextType | undefined>(undefined);

const PUBLIC_AUTH_PATHS = ['/signin', '/signup', '/forgot-password', '/verify-email', '/magic-link/', '/invite/'];

export const AuthProvider = ({
  children
}: { children: ReactNode }): React.ReactElement => {
  const { t } = useTranslation('authContext');
  const location = useLocation();
  const isPublicAuthPage = PUBLIC_AUTH_PATHS.some(p => location.pathname.startsWith(p));
  const { data: session, isPending } = useSession();
  const [organizationError, setOrganizationError] = useState<string | null>(null);
  const [organizationErrorCode, setOrganizationErrorCode] = useState<GraphQLErrorCode | null>(null);

  const { data: orgData, error: orgError, refetch: refetchOrg } = useQuery(ACTIVE_ORGANIZATION, {
    skip: !session?.user,
    errorPolicy: 'all',
  });

  // Handle organization query errors
  useEffect(() => {
    if (orgError) {
      const errorMessage =
        (orgError as any).graphQLErrors?.[0]?.message ||
        orgError.message ||
        'Failed to load organization';
      const errorCode = extractGraphQLErrorCode(orgError);
      setOrganizationError(errorMessage);
      setOrganizationErrorCode(errorCode ?? null);

      if (!isPublicAuthPage) {
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
      }
    } else {
      setOrganizationError(null);
      setOrganizationErrorCode(null);
    }
  }, [orgError, t]);


  const value: AuthContextType = {
    user: session?.user || null,
    isLoading: isPending,
    isAuthenticated: !!session?.user,
    activeOrganization: orgData?.activeOrganization || null,
    organizationError,
    organizationErrorCode,
    refetchOrganization: refetchOrg,
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
