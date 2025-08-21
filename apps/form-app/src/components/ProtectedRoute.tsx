import React, { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { LoadingSpinner } from '@dculus/ui';
import { useAuth } from '../contexts/AuthContext';

interface ProtectedRouteProps {
  children: ReactNode;
}

/**
 * ProtectedRoute - Restricts access to authenticated users. Shows a loading spinner while loading.
 * Uses app's auth context.
 */
export const ProtectedRoute = ({ children }: ProtectedRouteProps): React.ReactElement => {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/signin" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};
