import { ApolloClient, InMemoryCache, createHttpLink, split } from '@apollo/client';
import { setContext } from '@apollo/client/link/context';
import { onError } from '@apollo/client/link/error';
import { GraphQLWsLink } from '@apollo/client/link/subscriptions';
import { getMainDefinition } from '@apollo/client/utilities';
import { createClient } from 'graphql-ws';
import { getGraphQLUrl, getGraphQLWsUrl } from '../lib/config';
import { GRAPHQL_ERROR_CODES } from '@dculus/types/graphql';
import { getBearerToken } from '../lib/auth-client';

const graphqlUrl = getGraphQLUrl();

const httpLink = createHttpLink({
  uri: graphqlUrl,
});

const authLink = setContext((_, { headers }) => {
  const token = getBearerToken();

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

const wsLink = new GraphQLWsLink(
  createClient({
    url: getGraphQLWsUrl(),
    connectionParams: () => ({
      token: getBearerToken(),
    }),
    retryAttempts: 3,
  })
);

const splitLink = split(
  ({ query }) => {
    const definition = getMainDefinition(query);
    return definition.kind === 'OperationDefinition' && definition.operation === 'subscription';
  },
  wsLink,
  errorLink.concat(authLink).concat(httpLink),
);

export const client = new ApolloClient({
  link: splitLink,
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

