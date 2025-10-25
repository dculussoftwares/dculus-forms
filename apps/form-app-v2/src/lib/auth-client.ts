import { createAuthClient } from 'better-auth/react';
import { organizationClient } from 'better-auth/client/plugins';
import { getApiBaseUrl } from './config';

const baseUrl = getApiBaseUrl();

export const authClient = createAuthClient({
  plugins: [organizationClient()],
  baseURL: baseUrl,
  fetchOptions: {
    onSuccess: (ctx) => {
      // Get the bearer token from response headers
      const authToken = ctx.response.headers.get('set-auth-token');

      // Store the token securely in localStorage
      if (authToken) {
        localStorage.setItem('bearer_token', authToken);
      }

      // Store active organization ID
      if (ctx.data.session?.activeOrganizationId) {
        localStorage.setItem(
          'organization_id',
          ctx.data.session.activeOrganizationId
        );
      }
    },
    onError: (ctx) => {
      // Clear token on authentication errors
      if (ctx.response?.status === 401) {
        localStorage.removeItem('bearer_token');
        localStorage.removeItem('organization_id');
      }
    },
    auth: {
      type: 'Bearer',
      token: () => localStorage.getItem('bearer_token') || '',
    },
  },
});

// Create a custom signOut function that clears the token
const customSignOut = async (options?: any) => {
  // Clear tokens from localStorage
  localStorage.removeItem('bearer_token');
  localStorage.removeItem('organization_id');

  // Call the original signOut function
  return authClient.signOut(options);
};

// Export auth functions
export const { signIn, signUp, useSession, getSession, organization } = authClient;
export const signOut = customSignOut;
