import React, { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useQuery } from '@apollo/client';
import { useSession } from '../lib/auth-client';
import { ACTIVE_ORGANIZATION } from '../graphql/queries';
import { toast } from '@dculus/ui-v2';
import { useTranslate } from '../i18n';

// Better-Auth user type
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
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({
  children
}: { children: ReactNode }): React.ReactElement => {
  const t = useTranslate();
  const { data: session, isPending } = useSession();
  const [isLoading, setIsLoading] = useState(true);
  const [organizationError, setOrganizationError] = useState<string | null>(null);

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
      const fallbackMessage = t('auth.organization.loadError');
      const errorMessage = orgError.graphQLErrors?.[0]?.message || orgError.message || fallbackMessage;
      setOrganizationError(errorMessage);

      // Show user-friendly error messages for specific authorization errors
      if (errorMessage.includes('Access denied') || errorMessage.includes('not a member')) {
        toast(t('auth.organization.accessDenied.title'), {
          description: t('auth.organization.accessDenied.description'),
        });
      } else if (errorMessage.includes('Authentication required')) {
        toast(t('auth.organization.authRequired.title'), {
          description: t('auth.organization.authRequired.description'),
        });
      }
    } else {
      setOrganizationError(null);
    }
  }, [orgError, t]);

  const value: AuthContextType = {
    user: session?.user || null,
    isLoading,
    isAuthenticated: !!session?.user,
    activeOrganization: orgData?.activeOrganization || null,
    organizationError,
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
