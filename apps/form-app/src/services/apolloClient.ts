import { ApolloClient, InMemoryCache, createHttpLink, CombinedGraphQLErrors } from '@apollo/client';
import { SetContextLink } from '@apollo/client/link/context';
import { ErrorLink } from '@apollo/client/link/error';
import { getGraphQLUrl } from '../lib/config';
import { GRAPHQL_ERROR_CODES } from '@dculus/types/graphql';
import { getBearerToken } from '../lib/auth-client';

const graphqlUrl = getGraphQLUrl();

const httpLink = createHttpLink({
  uri: graphqlUrl,
  credentials: 'include', // Include cookies for authentication
});

// SetContextLink: prevContext is first arg, operation is second (v4 change)
const authLink = new SetContextLink((prevContext) => {
  const token = getBearerToken();
  const headers = (prevContext as Record<string, unknown>).headers as Record<string, string> | undefined;

  // If we have a token, include it in the authorization header
  if (token) {
    return {
      headers: {
        ...headers,
        authorization: `Bearer ${token}`,
      },
    };
  }

  // If no token, just return headers without authorization
  return {
    headers: {
      ...headers,
    },
  };
});

/**
 * Global error link — intercepts session expiry errors and redirects to sign-in.
 * Business logic errors (FORM_NOT_FOUND, FORBIDDEN, etc.) are NOT handled here;
 * individual mutations/queries handle those via onError or AuthorizationErrorBoundary.
 */
const errorLink = new ErrorLink(({ error }) => {
  if (!CombinedGraphQLErrors.is(error)) return;

  for (const { extensions } of error.errors) {
    const code = extensions?.code;
    if (
      code === GRAPHQL_ERROR_CODES.UNAUTHENTICATED ||
      code === GRAPHQL_ERROR_CODES.AUTHENTICATION_REQUIRED
    ) {
      // Session expired — redirect to sign-in so user doesn't silently lose access.
      // Guard: skip public auth pages to prevent redirect loops or clobbering
      // callback pages (magic-link/verify, verify-email, etc.) that don't need a session.
      const PUBLIC_AUTH_PATHS = ['/signin', '/signup', '/forgot-password', '/verify-email', '/magic-link/', '/invite/'];
      const onPublicPage = PUBLIC_AUTH_PATHS.some(p => window.location.pathname.startsWith(p));
      if (!onPublicPage) {
        window.location.href = '/signin';
      }
      return;
    }
  }
});

export const client = new ApolloClient({
  link: errorLink.concat(authLink).concat(httpLink),
  cache: new InMemoryCache(),
  defaultOptions: {
    watchQuery: {
      errorPolicy: 'all',
    },
    query: {
      errorPolicy: 'all',
    },
    mutate: {
      errorPolicy: 'all',
    },
  },
});

