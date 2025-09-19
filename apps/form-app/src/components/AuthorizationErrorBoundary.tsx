import React from 'react';
import { ApolloError } from '@apollo/client';
import { Alert, AlertDescription, Card, CardContent, CardHeader, CardTitle, Button } from '@dculus/ui';
import { AlertTriangle, RefreshCw, LogIn, Home } from 'lucide-react';

interface AuthorizationErrorBoundaryProps {
  children: React.ReactNode;
  error?: ApolloError | Error | null;
  onRetry?: () => void;
  fallbackTitle?: string;
  fallbackDescription?: string;
}

export const AuthorizationErrorBoundary: React.FC<AuthorizationErrorBoundaryProps> = ({
  children,
  error,
  onRetry,
  fallbackTitle = 'Access Error',
  fallbackDescription = 'An error occurred while accessing this resource.'
}) => {
  if (!error) {
    return <>{children}</>;
  }

  const errorMessage = error.message || 'An unknown error occurred';
  const isAuthError = errorMessage.includes('Authentication required');
  const isAccessError = errorMessage.includes('Access denied') || errorMessage.includes('not a member');
  const isForbiddenError = errorMessage.includes('Permission denied');

  const getErrorIcon = () => {
    if (isAuthError) return <LogIn className="h-4 w-4" />;
    if (isAccessError || isForbiddenError) return <AlertTriangle className="h-4 w-4" />;
    return <AlertTriangle className="h-4 w-4" />;
  };

  const getErrorTitle = () => {
    if (isAuthError) return 'Authentication Required';
    if (isAccessError) return 'Access Denied';
    if (isForbiddenError) return 'Permission Denied';
    return fallbackTitle;
  };

  const getErrorDescription = () => {
    if (isAuthError) {
      return 'You need to sign in to access this resource.';
    }
    if (isAccessError) {
      return 'You are not a member of this organization or do not have access to this resource.';
    }
    if (isForbiddenError) {
      return 'You do not have the required permissions to perform this action.';
    }
    return fallbackDescription;
  };

  const getErrorVariant = (): "destructive" | "default" => {
    if (isAuthError || isAccessError || isForbiddenError) return 'destructive';
    return 'destructive';
  };

  const handleSignIn = () => {
    window.location.href = '/signin';
  };

  const handleGoHome = () => {
    window.location.href = '/';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {getErrorIcon()}
          {getErrorTitle()}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert variant={getErrorVariant()}>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            {getErrorDescription()}
          </AlertDescription>
        </Alert>

        {/* Show detailed error message in development or for debugging */}
        {process.env.NODE_ENV === 'development' && (
          <details className="text-sm text-muted-foreground">
            <summary className="cursor-pointer hover:text-foreground">
              Technical Details (Development Only)
            </summary>
            <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-auto">
              {errorMessage}
            </pre>
          </details>
        )}

        <div className="flex gap-2">
          {isAuthError && (
            <Button onClick={handleSignIn} className="flex items-center gap-2">
              <LogIn className="h-4 w-4" />
              Sign In
            </Button>
          )}

          {onRetry && (
            <Button variant="outline" onClick={onRetry} className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4" />
              Try Again
            </Button>
          )}

          <Button variant="outline" onClick={handleGoHome} className="flex items-center gap-2">
            <Home className="h-4 w-4" />
            Go Home
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

// HOC for wrapping components with authorization error handling
export const withAuthorizationErrorBoundary = <P extends object>(
  Component: React.ComponentType<P>,
  options?: {
    fallbackTitle?: string;
    fallbackDescription?: string;
  }
) => {
  return (props: P & { error?: ApolloError | Error; onRetry?: () => void }) => {
    const { error, onRetry, ...componentProps } = props;

    return (
      <AuthorizationErrorBoundary
        error={error}
        onRetry={onRetry}
        fallbackTitle={options?.fallbackTitle}
        fallbackDescription={options?.fallbackDescription}
      >
        <Component {...(componentProps as P)} />
      </AuthorizationErrorBoundary>
    );
  };
};