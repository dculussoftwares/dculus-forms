import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useSession } from '../lib/auth-client';

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

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ 
  children 
}: { children: ReactNode }): React.ReactElement => {
  const { data: session, isPending } = useSession();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(isPending);
  }, [isPending]);

  const value: AuthContextType = {
    user: session?.user || null,
    isLoading,
    isAuthenticated: !!session?.user,
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
