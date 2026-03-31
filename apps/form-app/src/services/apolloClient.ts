import { ApolloClient, InMemoryCache, createHttpLink } from '@apollo/client';
import { setContext } from '@apollo/client/link/context';
import { onError } from '@apollo/client/link/error';
import { getGraphQLUrl } from '../lib/config';
import { GRAPHQL_ERROR_CODES } from '@dculus/types/graphql';

const graphqlUrl = getGraphQLUrl();

const httpLink = createHttpLink({
  uri: graphqlUrl,
});

const authLink = setContext((_, { headers }) => {
  const token = localStorage.getItem('bearer_token');

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
const errorLink = onError(({ graphQLErrors }) => {
  if (!graphQLErrors) return;

  for (const { extensions } of graphQLErrors) {
    const code = extensions?.code;
    if (
      code === GRAPHQL_ERROR_CODES.UNAUTHENTICATED ||
      code === GRAPHQL_ERROR_CODES.AUTHENTICATION_REQUIRED
    ) {
      // Session expired — redirect to sign-in so user doesn't silently lose access
      window.location.href = '/signin';
      return;
    }
  }
});

export const client = new ApolloClient({
  link: errorLink.concat(authLink).concat(httpLink),
  cache: new InMemoryCache(),
  credentials: 'include', // Include cookies for authentication
  defaultOptions: {
    watchQuery: {
      errorPolicy: 'all',
    },
    query: {
      errorPolicy: 'all',
    },
  },
});

