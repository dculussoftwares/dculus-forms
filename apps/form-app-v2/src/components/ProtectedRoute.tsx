import React, { type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Spinner } from '@dculus/ui-v2';
import { useAuth } from '../contexts/AuthContext';

interface ProtectedRouteProps {
  children: ReactNode;
}

/**
 * ProtectedRoute - Restricts access to authenticated users.
 * Shows a loading spinner while authentication status is being determined.
 * Redirects to signin page if user is not authenticated.
 */
export const ProtectedRoute = ({ children }: ProtectedRouteProps): React.ReactElement => {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/signin" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};
