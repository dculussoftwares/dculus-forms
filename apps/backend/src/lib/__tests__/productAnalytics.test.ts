import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { track, setGlobalProperties, ctor } = vi.hoisted(() => ({
  track: vi.fn(),
  setGlobalProperties: vi.fn(),
  ctor: vi.fn(),
}));

vi.mock('@openpanel/sdk', () => ({
  OpenPanel: class {
    constructor(options: unknown) {
      ctor(options);
    }
    track = track;
    setGlobalProperties = setGlobalProperties;
  },
}));

vi.mock('../logger.js', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import {
  DEFAULT_OPENPANEL_API_URL,
  isProductAnalyticsEnabled,
  resetProductAnalyticsForTests,
  sanitizeProperties,
  serverEnvironment,
  trackServerEvent,
} from '../productAnalytics.js';
import { logger } from '../logger.js';

const ENV_KEYS = ['OPENPANEL_CLIENT_ID', 'OPENPANEL_CLIENT_SECRET', 'OPENPANEL_API_URL'] as const;

describe('productAnalytics', () => {
  const saved: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const key of ENV_KEYS) {
      saved[key] = process.env[key];
      delete process.env[key];
    }
    track.mockReset();
    track.mockResolvedValue(undefined);
    setGlobalProperties.mockReset();
    ctor.mockReset();
    vi.mocked(logger.debug).mockReset();
    resetProductAnalyticsForTests();
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
    resetProductAnalyticsForTests();
  });

  it('is a no-op without env configuration', () => {
    expect(isProductAnalyticsEnabled()).toBe(false);
    expect(() => trackServerEvent('form_created', { profileId: 'u1' })).not.toThrow();
    expect(ctor).not.toHaveBeenCalled();
    expect(track).not.toHaveBeenCalled();
  });

  it('stays disabled when only the client id is set', () => {
    process.env.OPENPANEL_CLIENT_ID = 'client';
    expect(isProductAnalyticsEnabled()).toBe(false);
    trackServerEvent('form_created');
    expect(track).not.toHaveBeenCalled();
  });

  it('sends events with the internal profile id and the default API url', () => {
    process.env.OPENPANEL_CLIENT_ID = 'client';
    process.env.OPENPANEL_CLIENT_SECRET = 'secret';

    trackServerEvent('form_published', {
      profileId: 'user-1',
      properties: { form_id: 'f1', organization_id: 'o1' },
    });

    expect(ctor).toHaveBeenCalledWith({
      clientId: 'client',
      clientSecret: 'secret',
      apiUrl: DEFAULT_OPENPANEL_API_URL,
    });
    expect(track).toHaveBeenCalledWith('form_published', {
      form_id: 'f1',
      organization_id: 'o1',
      profileId: 'user-1',
    });
  });

  it('honours OPENPANEL_API_URL', () => {
    process.env.OPENPANEL_CLIENT_ID = 'client';
    process.env.OPENPANEL_CLIENT_SECRET = 'secret';
    process.env.OPENPANEL_API_URL = 'https://op.example.com/api';
    trackServerEvent('user_signed_up', { profileId: 'u1' });
    expect(ctor).toHaveBeenCalledWith(expect.objectContaining({ apiUrl: 'https://op.example.com/api' }));
  });

  it('never throws when the SDK throws synchronously', () => {
    process.env.OPENPANEL_CLIENT_ID = 'client';
    process.env.OPENPANEL_CLIENT_SECRET = 'secret';
    track.mockImplementation(() => {
      throw new Error('boom');
    });
    expect(() => trackServerEvent('form_created')).not.toThrow();
    expect(logger.debug).toHaveBeenCalled();
  });

  it('swallows async SDK failures and logs at debug', async () => {
    process.env.OPENPANEL_CLIENT_ID = 'client';
    process.env.OPENPANEL_CLIENT_SECRET = 'secret';
    track.mockRejectedValue(new Error('network down'));
    expect(() => trackServerEvent('response_submitted')).not.toThrow();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(logger.debug).toHaveBeenCalled();
  });

  it('drops personal-data keys and non-primitive values', () => {
    expect(
      sanitizeProperties({
        form_id: 'f1',
        email: 'a@b.c',
        userEmail: 'a@b.c',
        name: 'Jane',
        first_name: 'Jane',
        answers: 'x',
        data: 'x',
        count: 2,
        ok: true,
        nothing: null,
        skipped: undefined,
        nested: { a: 1 } as unknown as string,
      })
    ).toEqual({ form_id: 'f1', count: 2, ok: true, nothing: null });
  });

  it('derives the environment from the backend base url', () => {
    expect(serverEnvironment('https://form-services-dev.dculus.com')).toBe('dev');
    expect(serverEnvironment('https://form-services.dculus.com')).toBe('prod');
    expect(serverEnvironment('http://localhost:4000')).toBe('local');
    // Empty string, not undefined: undefined would fall back to the ambient BETTER_AUTH_URL.
    expect(serverEnvironment('')).toBe('local');
    expect(serverEnvironment('not a url')).toBe('local');
  });
});
