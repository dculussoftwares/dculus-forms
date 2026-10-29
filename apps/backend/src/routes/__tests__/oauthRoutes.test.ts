import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';

vi.mock('../../plugins/google-sheets/oauth.js', () => ({
  buildAuthUrl: vi.fn((state: string) => `https://accounts.google.test/auth?state=${state}`),
  exchangeCode: vi.fn(async () => ({ accessToken: 'at', email: 'a@b.c' })),
}));
vi.mock('../../plugins/microsoft-sheets/oauth.js', () => ({
  buildMicrosoftAuthUrl: vi.fn((state: string) => `https://login.microsoft.test/auth?state=${state}`),
  exchangeMicrosoftCode: vi.fn(async () => ({ accessToken: 'at', email: 'a@b.c' })),
}));
vi.mock('../../lib/logger.js', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

import { googleOAuthRouter } from '../google-oauth.js';
import { microsoftOAuthRouter } from '../microsoft-oauth.js';

const app = express();
app.use('/api', googleOAuthRouter);
app.use('/api', microsoftOAuthRouter);

async function startFlow(provider: 'google' | 'microsoft', returnTo: string) {
  const res = await request(app).get(`/api/integrations/${provider}/auth`).query({ return_to: returnTo });
  const state = new URL(res.headers.location).searchParams.get('state')!;
  const cookie = (res.headers['set-cookie'] as unknown as string[])[0].split(';')[0];
  return { res, state, cookie };
}

describe.each(['google', 'microsoft'] as const)('%s OAuth state handling', (provider) => {
  beforeEach(() => {
    process.env.FORM_APP_URL = 'http://app.test';
  });

  it('sets an HttpOnly nonce cookie and redirects with a state bound to it', async () => {
    const { res } = await startFlow(provider, '/forms/1/plugins');
    expect(res.status).toBe(302);
    expect((res.headers['set-cookie'] as unknown as string[])[0]).toMatch(/HttpOnly/i);
  });

  it('completes the callback when the state matches the browser cookie', async () => {
    const { state, cookie } = await startFlow(provider, '/forms/1/plugins');
    const res = await request(app)
      .get(`/api/integrations/${provider}/callback`)
      .set('Cookie', cookie)
      .query({ code: 'abc', state });
    expect(res.headers.location).toMatch(new RegExp(`^http://app.test/forms/1/plugins#${provider}_oauth_token=`));
  });

  it('rejects a callback with no cookie (login CSRF) and never exchanges the code', async () => {
    const { state } = await startFlow(provider, '/forms/1/plugins');
    const res = await request(app).get(`/api/integrations/${provider}/callback`).query({ code: 'abc', state });
    expect(res.headers.location).toBe(`http://app.test/#${provider}_oauth_error=invalid_state`);
  });

  it('rejects a callback whose state is not the one in the cookie', async () => {
    const { cookie } = await startFlow(provider, '/a');
    const other = await startFlow(provider, '/b');
    const res = await request(app)
      .get(`/api/integrations/${provider}/callback`)
      .set('Cookie', cookie)
      .query({ code: 'abc', state: other.state });
    expect(res.headers.location).toContain('invalid_state');
  });

  it('cannot smuggle extra fragment parameters through the error query param', async () => {
    const { state, cookie } = await startFlow(provider, '/forms/1/plugins');
    const res = await request(app)
      .get(`/api/integrations/${provider}/callback`)
      .set('Cookie', cookie)
      .query({ error: `x&${provider}_oauth_token=evil`, state });
    expect(res.headers.location).toBe(`http://app.test/forms/1/plugins#${provider}_oauth_error=oauth_error`);
  });

  it('falls back to the root path for an off-site return_to', async () => {
    const { state, cookie } = await startFlow(provider, '//evil.test/x');
    const res = await request(app)
      .get(`/api/integrations/${provider}/callback`)
      .set('Cookie', cookie)
      .query({ error: 'access_denied', state });
    expect(res.headers.location).toBe(`http://app.test/#${provider}_oauth_error=access_denied`);
  });
});
