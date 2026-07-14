import { createAuthClient } from 'better-auth/react';
import { emailOTPClient, oneTimeTokenClient } from 'better-auth/client/plugins';
import { getApiBaseUrl } from './config';
import { getRespondentToken, setRespondentToken, clearRespondentToken } from './respondentAuth';

const baseUrl = getApiBaseUrl();

export const authClient = createAuthClient({
  plugins: [emailOTPClient(), oneTimeTokenClient()],
  baseURL: baseUrl,
  fetchOptions: {
    onSuccess: (ctx) => {
      const authToken = ctx.response.headers.get('set-auth-token');
      if (authToken) {
        setRespondentToken(authToken);
      }
    },
    onError: (ctx) => {
      if (ctx.response?.status === 401) {
        clearRespondentToken();
      }
    },
    auth: {
      type: 'Bearer',
      token: () => getRespondentToken(),
    },
  },
});

export const { signIn, emailOtp, oneTimeToken, getSession } = authClient;

export const signOut = async () => {
  clearRespondentToken();
  return authClient.signOut();
};
