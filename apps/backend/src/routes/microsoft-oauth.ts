import express, { Router } from 'express';
import { buildMicrosoftAuthUrl, exchangeMicrosoftCode } from '../plugins/microsoft-sheets/oauth.js';
import { logger } from '../lib/logger.js';

const router: Router = express.Router();

router.get('/integrations/microsoft/auth', (req, res) => {
  const returnTo = (req.query.return_to as string) ?? '/';
  const state = Buffer.from(returnTo).toString('base64url');
  const url = buildMicrosoftAuthUrl(state);
  res.redirect(url);
});

router.get('/integrations/microsoft/callback', async (req, res) => {
  const code = req.query.code as string;
  const error = req.query.error as string;
  const state = req.query.state as string;
  const frontendUrl = (process.env.FORM_APP_URL ?? 'http://localhost:3000').replace(/\/$/, '');

  let returnPath = '/';
  try {
    returnPath = Buffer.from(state ?? '', 'base64url').toString('utf-8');
    if (!returnPath.startsWith('/')) returnPath = '/';
  } catch {
    returnPath = '/';
  }

  if (error || !code) {
    logger.warn('[Microsoft OAuth] Callback received error or missing code', { error });
    res.redirect(
      `${frontendUrl}${returnPath}#microsoft_oauth_error=${error ?? 'missing_code'}`
    );
    return;
  }

  try {
    const token = await exchangeMicrosoftCode(code);
    const payload = Buffer.from(JSON.stringify(token)).toString('base64url');
    logger.info('[Microsoft OAuth] Code exchange success, redirecting to config page', {
      email: token.email,
      returnPath,
      payloadLength: payload.length,
    });
    res.redirect(`${frontendUrl}${returnPath}#microsoft_oauth_token=${payload}`);
  } catch (err: any) {
    logger.error('[Microsoft OAuth] Code exchange failed', { error: err.message });
    res.redirect(`${frontendUrl}${returnPath}#microsoft_oauth_error=exchange_failed`);
  }
});

export { router as microsoftOAuthRouter };
