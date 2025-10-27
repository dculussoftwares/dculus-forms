/**
 * Configuration utilities for form-app-v2
 * Reads from Vite environment variables with fallback defaults
 */

type EnvSource = Record<string, string | undefined>;

interface GlobalWithOverride {
  __VITE_ENV_OVERRIDE__?: EnvSource;
}

const resolveEnv = (): EnvSource => {
  const readImportMetaEnv = (): EnvSource => {
    try {
      return (0, eval)('import.meta.env') as EnvSource;
    } catch {
      return {};
    }
  };

  if (
    typeof globalThis !== 'undefined' &&
    '__VITE_ENV_OVERRIDE__' in globalThis
  ) {
    return (globalThis as GlobalWithOverride).__VITE_ENV_OVERRIDE__ ?? {};
  }

  return readImportMetaEnv();
};

/**
 * Get the base API URL from Vite environment variables
 */
export function getApiBaseUrl(): string {
  const env = resolveEnv();
  return env.VITE_API_URL || 'http://localhost:4000';
}

/**
 * Get the GraphQL endpoint URL
 */
export function getGraphQLUrl(): string {
  const env = resolveEnv();
  return env.VITE_GRAPHQL_URL || `${getApiBaseUrl()}/graphql`;
}

/**
 * Get the public form viewer URL for a given short code.
 * Falls back to the local viewer server when not configured.
 */
export function getFormViewerUrl(shortUrl: string): string {
  const env = resolveEnv();
  const base = env.VITE_FORM_VIEWER_URL || 'http://localhost:5173';
  const normalizedBase = base.endsWith('/') ? base.slice(0, -1) : base;
  const sanitizedShortUrl = shortUrl.replace(/^\/+/, '');
  return `${normalizedBase}/f/${sanitizedShortUrl}`;
}
