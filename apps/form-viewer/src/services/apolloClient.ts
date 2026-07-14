import { ApolloClient, InMemoryCache, createHttpLink } from '@apollo/client';
import { SetContextLink } from '@apollo/client/link/context';
import { getGraphQLUrl } from '../lib/config';
import { getRespondentToken } from '../lib/respondentAuth';

const graphqlUrl = getGraphQLUrl();

const httpLink = createHttpLink({
  uri: graphqlUrl,
  credentials: 'include', // send cookies for authenticated endpoints (e.g. analytics)
});

// Attaches a respondent's bearer token (set after Google/OTP sign-in) so
// gated forms resolve to OPEN/DOMAIN_REJECTED instead of SIGN_IN_REQUIRED.
// No-op for anonymous forms since no token is ever set for them.
const authLink = new SetContextLink((prevContext) => {
  const token = getRespondentToken();
  const headers = (prevContext as Record<string, unknown>).headers as Record<string, string> | undefined;

  if (token) {
    return { headers: { ...headers, authorization: `Bearer ${token}` } };
  }
  return { headers: { ...headers } };
});

export const client = new ApolloClient({
  link: authLink.concat(httpLink),
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