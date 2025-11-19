import React from 'react';
import { ApolloError } from '@apollo/client';
import { Alert, AlertDescription, Card, CardContent, CardHeader, CardTitle, Button, ScrollArea } from '@dculus/ui';
import { AlertTriangle, RefreshCw, LogIn, Home } from 'lucide-react';
import { useTranslation } from '../hooks/useTranslation';
import {
  GRAPHQL_ERROR_CODES,
  type GraphQLErrorCode,
} from '@dculus/types/graphql';
import { extractGraphQLErrorCode } from '../utils/graphqlErrors';

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
  fallbackTitle,
  fallbackDescription
}) => {
  const { t } = useTranslation('authorizationError');
  
  if (!error) {
    return <>{children}</>;
  }

  const errorMessage = error.message || 'An unknown error occurred';
  const errorCode = extractGraphQLErrorCode(error);
  const matchesCode = (code: GraphQLErrorCode) => errorCode === code;

  const messageIncludes = (snippet: string) =>
    errorMessage.toLowerCase().includes(snippet.toLowerCase());

  const isAuthError =
    matchesCode(GRAPHQL_ERROR_CODES.AUTHENTICATION_REQUIRED) ||
    messageIncludes('authentication required');
  const isAccessError =
    matchesCode(GRAPHQL_ERROR_CODES.NO_ACCESS) ||
    messageIncludes('access denied') ||
    messageIncludes('not a member');
  const isForbiddenError =
    matchesCode(GRAPHQL_ERROR_CODES.FORBIDDEN) ||
    messageIncludes('permission denied');

  const getErrorIcon = () => {
    if (isAuthError) return <LogIn className="h-4 w-4" />;
    if (isAccessError || isForbiddenError) return <AlertTriangle className="h-4 w-4" />;
    return <AlertTriangle className="h-4 w-4" />;
  };

  const getErrorTitle = () => {
    if (isAuthError) return t('titles.authenticationRequired');
    if (isAccessError) return t('titles.accessDenied');
    if (isForbiddenError) return t('titles.permissionDenied');
    return fallbackTitle || t('titles.fallback');
  };

  const getErrorDescription = () => {
    if (isAuthError) {
      return t('descriptions.authenticationRequired');
    }
    if (isAccessError) {
      return t('descriptions.accessDenied');
    }
    if (isForbiddenError) {
      return t('descriptions.permissionDenied');
    }
    return fallbackDescription || t('descriptions.fallback');
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
              {t('labels.technicalError')}
            </summary>
            <ScrollArea className="mt-2 max-h-40">
              <pre className="p-2 bg-muted rounded text-xs">
                {errorMessage}
              </pre>
            </ScrollArea>
          </details>
        )}

        <div className="flex gap-2">
          {isAuthError && (
            <Button onClick={handleSignIn} className="flex items-center gap-2">
              <LogIn className="h-4 w-4" />
              {t('actions.signIn')}
            </Button>
          )}

          {onRetry && (
            <Button variant="outline" onClick={onRetry} className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4" />
              {t('actions.retry')}
            </Button>
          )}

          <Button variant="outline" onClick={handleGoHome} className="flex items-center gap-2">
            <Home className="h-4 w-4" />
            {t('actions.goHome')}
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
