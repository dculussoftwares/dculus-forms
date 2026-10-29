import express, { Router } from 'express';
import { buildAuthUrl, exchangeCode } from '../plugins/google-sheets/oauth.js';
import { logger } from '../lib/logger.js';
import { createOAuthState, consumeOAuthState } from '../lib/oauthState.js';

const router: Router = express.Router();

// `error` is attacker-controllable in the callback URL; only a plain error code may reach the URL fragment.
const safeOAuthError = (error: unknown): string =>
  typeof error === 'string' && /^[a-z_]{1,64}$/.test(error) ? error : error ? 'oauth_error' : 'missing_code';

router.get('/integrations/google/auth', (req, res) => {
  // state binds this flow to the browser that started it and carries the return path
  const state = createOAuthState('google', req.query.return_to, res);
  res.redirect(buildAuthUrl(state));
});

router.get('/integrations/google/callback', async (req, res) => {
  const code = req.query.code as string;
  const error = req.query.error as string;
  const frontendUrl = (process.env.FORM_APP_URL ?? 'http://localhost:3000').replace(/\/$/, '');

  const returnPath = consumeOAuthState('google', req.query.state, req, res);
  if (returnPath === null) {
    logger.warn('[Google OAuth] Callback rejected: state missing or not bound to this browser');
    res.redirect(`${frontendUrl}/#google_oauth_error=invalid_state`);
    return;
  }

  if (error || !code) {
    logger.warn('[Google OAuth] Callback received error or missing code', { error });
    res.redirect(`${frontendUrl}${returnPath}#google_oauth_error=${safeOAuthError(error)}`);
    return;
  }

  try {
    const token = await exchangeCode(code);
    const payload = Buffer.from(JSON.stringify(token)).toString('base64url');
    logger.info('[Google OAuth] Code exchange success, redirecting to config page', {
      email: token.email,
      returnPath,
      payloadLength: payload.length,
    });
    res.redirect(`${frontendUrl}${returnPath}#google_oauth_token=${payload}`);
  } catch (err: any) {
    logger.error('[Google OAuth] Code exchange failed', { error: err.message });
    res.redirect(`${frontendUrl}${returnPath}#google_oauth_error=exchange_failed`);
  }
});

export { router as googleOAuthRouter };
