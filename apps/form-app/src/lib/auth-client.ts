import { createAuthClient } from 'better-auth/react';
import { organizationClient, emailOTPClient } from 'better-auth/client/plugins';
import { getApiBaseUrl } from './config';

const baseUrl = getApiBaseUrl();

// Store the bearer token in sessionStorage — cleared on tab close, not shared across tabs.
// More secure than localStorage while surviving intra-tab page navigations.
const TOKEN_KEY = 'bearer_token';

// Clear any stale bearer token when arriving at the sign-in page so that Apollo
// does not send an expired token loaded from a saved E2E storage state.
if (typeof window !== 'undefined' && window.location.pathname.startsWith('/signin')) {
  sessionStorage.removeItem(TOKEN_KEY);
}

export const getBearerToken = () => sessionStorage.getItem(TOKEN_KEY) ?? '';

export const authClient = createAuthClient({
  plugins: [organizationClient(), emailOTPClient()],
  baseURL: baseUrl, // Your backend URL
  fetchOptions: {
    onSuccess: (ctx) => {
      console.log("ctx.data.session?.activeOrganizationId", ctx.data.session?.activeOrganizationId);
      const authToken = ctx.response.headers.get('set-auth-token');
      if (authToken) {
        sessionStorage.setItem(TOKEN_KEY, authToken);
      }
      localStorage.setItem(
        'organization_id',
        ctx.data.session?.activeOrganizationId || ''
      );
    },
    onError: (ctx) => {
      if (ctx.response?.status === 401) {
        sessionStorage.removeItem(TOKEN_KEY);
      }
    },
    auth: {
      type: 'Bearer',
      token: () => getBearerToken(),
    },
  },
});

// Create a custom signOut function that clears the token
const customSignOut = async (options?: any) => {
  sessionStorage.removeItem(TOKEN_KEY);
  return authClient.signOut(options);
};

export const { signIn, signUp, useSession, getSession, emailOtp, organization } = authClient;

// For better-auth 1.4.x, forgetPassword is now requestPasswordReset
export const forgetPassword = authClient.forgetPassword;
// Helper to access requestPasswordReset if available
export const requestPasswordReset = (authClient as any).requestPasswordReset || authClient.forgetPassword;

export const signOut = customSignOut;
