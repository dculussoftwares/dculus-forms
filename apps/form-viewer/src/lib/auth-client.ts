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

/**
 * Full respondent sign-out. Order matters: `authClient.signOut()` runs while
 * the bearer token is still present so the server can actually invalidate the
 * session + clear its cookie (in a cross-site embed frame the cookie isn't
 * sent, so the bearer is the only credential that reaches better-auth). The
 * local token is cleared in `finally` regardless, so a failed network call
 * never leaves the client holding a usable credential — but the error still
 * propagates so callers can tell the respondent it didn't complete.
 */
export const signOut = async () => {
  try {
    await authClient.signOut();
  } finally {
    clearRespondentToken();
  }
};
