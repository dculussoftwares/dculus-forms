import { createAuthClient } from 'better-auth/react';
import { organizationClient, emailOTPClient } from 'better-auth/client/plugins';
import { getApiBaseUrl } from './config';

const baseUrl = getApiBaseUrl();

// Keep the bearer token in module memory instead of localStorage to reduce XSS exposure.
// The token only needs to survive the current page session; Hocuspocus reconnects on reload.
let _bearerToken = '';

export const getBearerToken = () => _bearerToken;

export const authClient = createAuthClient({
  plugins: [organizationClient(), emailOTPClient()],
  baseURL: baseUrl, // Your backend URL
  fetchOptions: {
    onSuccess: (ctx) => {
      // console.log('Authentication successful', ctx);
      console.log("ctx.data.session?.activeOrganizationId", ctx.data.session?.activeOrganizationId);
      const authToken = ctx.response.headers.get('set-auth-token'); // get the token from the response headers
      // Store the token in module memory (not localStorage) to reduce XSS exposure
      if (authToken) {
        _bearerToken = authToken;
      }
      localStorage.setItem(
        'organization_id',
        ctx.data.session?.activeOrganizationId || ''
      );
    },
    onError: (ctx) => {
      // Clear token on authentication errors
      if (ctx.response?.status === 401) {
        _bearerToken = '';
      }
    },
    auth: {
      type: 'Bearer',
      token: () => _bearerToken,
    },
  },
});

// Create a custom signOut function that clears the token
const customSignOut = async (options?: any) => {
  // Clear the token from module memory
  _bearerToken = '';

  // Call the original signOut function
  return authClient.signOut(options);
};

export const { signIn, signUp, useSession, getSession, emailOtp, organization } = authClient;

// For better-auth 1.4.x, forgetPassword is now requestPasswordReset
export const forgetPassword = authClient.forgetPassword;
// Helper to access requestPasswordReset if available
export const requestPasswordReset = (authClient as any).requestPasswordReset || authClient.forgetPassword;

export const signOut = customSignOut;
