import React, { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { authService, User, Session } from '../services/auth';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  signIn: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<void>;
  refetch: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchSession = async () => {
    try {
      const sessionData = await authService.getSession();
      if (sessionData) {
        setUser(sessionData.user);
        setSession(sessionData);
      } else {
        setUser(null);
        setSession(null);
      }
    } catch (error) {
      console.error('Failed to fetch session:', error);
      setUser(null);
      setSession(null);
    } finally {
      setIsLoading(false);
    }
  };

  const signIn = async (email: string, password: string) => {
    const result = await authService.signIn(email, password);
    if (result.success) {
      await fetchSession();
    }
    return result;
  };

  const signOut = async () => {
    await authService.signOut();
    setUser(null);
    setSession(null);
  };

  const refetch = async () => {
    setIsLoading(true);
    await fetchSession();
  };

  useEffect(() => {
    fetchSession();
  }, []);

  const value: AuthContextType = {
    user,
    session,
    isLoading,
    isAuthenticated: !!user,
    isAdmin: user ? authService.isAdmin(user) : false,
    isSuperAdmin: user ? authService.isSuperAdmin(user) : false,
    signIn,
    signOut,
    refetch,
  };

  return React.createElement(AuthContext.Provider, { value }, children);
}