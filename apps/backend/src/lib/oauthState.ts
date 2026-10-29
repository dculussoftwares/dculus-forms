import { randomBytes, timingSafeEqual } from 'crypto';
import type { Request, Response } from 'express';

/**
 * OAuth `state` for the plugin integration flows (Google / Microsoft Sheets).
 *
 * The state carries a random nonce plus the return path, and the same nonce is set
 * in a short-lived HttpOnly cookie on the browser that started the flow. The
 * callback only trusts the return path and the authorization code when both match,
 * so a callback URL crafted by an attacker (login CSRF) is rejected.
 */

const STATE_TTL_MS = 10 * 60 * 1000;
const cookieName = (provider: string) => `dculus_oauth_state_${provider}`;

const readCookie = (req: Request, name: string): string | undefined => {
  const header = req.headers.cookie;
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index > 0 && part.slice(0, index).trim() === name) return part.slice(index + 1).trim();
  }
  return undefined;
};

const safeEqual = (a: string, b: string): boolean => {
  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);
  return bufferA.length === bufferB.length && timingSafeEqual(bufferA, bufferB);
};

const cookieOptions = () => ({
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
});

/** Only same-app absolute paths may be used as the post-callback redirect. */
export const sanitizeReturnPath = (value: unknown): string =>
  typeof value === 'string' && value.startsWith('/') && !value.startsWith('//') && !value.includes('\\')
    ? value
    : '/';

export function createOAuthState(provider: string, returnTo: unknown, res: Response): string {
  const nonce = randomBytes(24).toString('base64url');
  res.cookie(cookieName(provider), nonce, { ...cookieOptions(), maxAge: STATE_TTL_MS });
  return Buffer.from(JSON.stringify({ n: nonce, r: sanitizeReturnPath(returnTo) })).toString('base64url');
}

/** Returns the verified return path, or null when the state is missing, malformed or not bound to this browser. */
export function consumeOAuthState(provider: string, state: unknown, req: Request, res: Response): string | null {
  const expected = readCookie(req, cookieName(provider));
  res.clearCookie(cookieName(provider), cookieOptions());
  if (!expected || typeof state !== 'string') return null;
  try {
    const parsed = JSON.parse(Buffer.from(state, 'base64url').toString('utf-8')) as { n?: unknown; r?: unknown };
    if (typeof parsed.n !== 'string' || !safeEqual(parsed.n, expected)) return null;
    return sanitizeReturnPath(parsed.r);
  } catch {
    return null;
  }
}
