import { createAuthClient } from 'better-auth/react';
import { organizationClient, emailOTPClient } from 'better-auth/client/plugins';
import { getApiBaseUrl } from './config';

const baseUrl = getApiBaseUrl();

export const authClient = createAuthClient({
  plugins: [organizationClient(), emailOTPClient()],
  baseURL: baseUrl, // Your backend URL
  fetchOptions: {
    onSuccess: (ctx) => {
      // console.log('Authentication successful', ctx);
      console.log("ctx.data.session?.activeOrganizationId",ctx.data.session?.activeOrganizationId);
      const authToken = ctx.response.headers.get('set-auth-token'); // get the token from the response headers
      // Store the token securely (e.g., in localStorage)
      if (authToken) {
        localStorage.setItem('bearer_token', authToken);
        // if (ctx.data?.session?.activeOrganizationId) {
         
        // }
      }
       localStorage.setItem(
            'organization_id',
            ctx.data.session?.activeOrganizationId || ''
          );
    },
    onError: (ctx) => {
      // Clear token on authentication errors
      if (ctx.response?.status === 401) {
        localStorage.removeItem('bearer_token');
      }
    },
    auth: {
      type: 'Bearer',
      token: () => localStorage.getItem('bearer_token') || '', // get the token from localStorage
    },
  },
});

// Create a custom signOut function that clears the token
const customSignOut = async (options?: any) => {
  // Clear the token from localStorage
  localStorage.removeItem('bearer_token');

  // Call the original signOut function
  return authClient.signOut(options);
};

export const { signIn, signUp, useSession, getSession, emailOtp, forgetPassword } = authClient;

export const signOut = customSignOut;
