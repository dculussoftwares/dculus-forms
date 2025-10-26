/// <reference types="jest" />

type EnvKey = 'VITE_API_URL' | 'VITE_GRAPHQL_URL' | 'VITE_FORM_VIEWER_URL';

type Override = Partial<Record<EnvKey, string | undefined>> | undefined;

const globalEnv = globalThis as typeof globalThis & {
  __VITE_ENV_OVERRIDE__?: Override;
};

const originalOverride = globalEnv.__VITE_ENV_OVERRIDE__;
const originalOverrideCopy = originalOverride
  ? { ...originalOverride }
  : undefined;

const setEnv = (overrides: Override) => {
  if (overrides === undefined) {
    delete globalEnv.__VITE_ENV_OVERRIDE__;
    return;
  }

  globalEnv.__VITE_ENV_OVERRIDE__ = overrides;
};

describe('config utilities', () => {
  beforeEach(() => {
    setEnv({});
  });

  afterEach(() => {
    setEnv(
      originalOverrideCopy ? { ...originalOverrideCopy } : undefined
    );
  });

  it('returns the API base URL from Vite env when available', async () => {
    setEnv({ VITE_API_URL: 'https://api.example.com' });
    const { getApiBaseUrl } = await import('../config');
    expect(getApiBaseUrl()).toBe('https://api.example.com');
  });

  it('falls back to localhost API when the env var is missing', async () => {
    setEnv({ VITE_API_URL: undefined });
    const { getApiBaseUrl } = await import('../config');
    expect(getApiBaseUrl()).toBe('http://localhost:4000');
  });

  it('returns the GraphQL URL from env when provided', async () => {
    setEnv({
      VITE_API_URL: 'https://api.example.com',
      VITE_GRAPHQL_URL: 'https://graphql.example.com/graphql',
    });
    const { getGraphQLUrl } = await import('../config');
    expect(getGraphQLUrl()).toBe('https://graphql.example.com/graphql');
  });

  it('derives the GraphQL URL from the API base when env is missing', async () => {
    setEnv({
      VITE_API_URL: 'https://api.example.com',
      VITE_GRAPHQL_URL: undefined,
    });
    const { getGraphQLUrl } = await import('../config');
    expect(getGraphQLUrl()).toBe('https://api.example.com/graphql');
  });

  it('builds the form viewer URL with normalized host and sanitized short code', async () => {
    setEnv({ VITE_FORM_VIEWER_URL: 'https://viewer.example.com/' });
    const { getFormViewerUrl } = await import('../config');
    expect(getFormViewerUrl('/my-form')).toBe(
      'https://viewer.example.com/f/my-form'
    );
  });

  it('defaults the form viewer URL to localhost when env is missing', async () => {
    setEnv({ VITE_FORM_VIEWER_URL: undefined });
    const { getFormViewerUrl } = await import('../config');
    expect(getFormViewerUrl('//nested/path')).toBe(
      'http://localhost:5173/f/nested/path'
    );
  });

  it('reads from import.meta.env when no override is present', async () => {
    setEnv(undefined);
    const originalEval = (globalThis as any).eval;

    (globalThis as any).eval = jest.fn(() => ({
      VITE_API_URL: 'https://meta.example.com',
      VITE_FORM_VIEWER_URL: 'https://viewer.meta/',
    }));

    try {
      const { getApiBaseUrl, getFormViewerUrl } = await import('../config');
      expect(getApiBaseUrl()).toBe('https://meta.example.com');
      expect(getFormViewerUrl('abc')).toBe('https://viewer.meta/f/abc');
    } finally {
      (globalThis as any).eval = originalEval;
    }
  });

  it('falls back to defaults when import.meta.env is unavailable', async () => {
    setEnv(undefined);
    const originalEval = (globalThis as any).eval;

    (globalThis as any).eval = jest.fn(() => {
      throw new ReferenceError('import.meta not supported');
    });

    try {
      const { getApiBaseUrl } = await import('../config');
      expect(getApiBaseUrl()).toBe('http://localhost:4000');
    } finally {
      (globalThis as any).eval = originalEval;
    }
  });
});
