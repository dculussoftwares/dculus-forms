/**
 * Configuration utilities for form-app-v2
 * Reads from Vite environment variables with fallback defaults
 */

/**
 * Get the base API URL from Vite environment variables
 */
export function getApiBaseUrl(): string {
  return import.meta.env.VITE_API_URL || 'http://localhost:4000';
}

/**
 * Get the GraphQL endpoint URL
 */
export function getGraphQLUrl(): string {
  return import.meta.env.VITE_GRAPHQL_URL || `${getApiBaseUrl()}/graphql`;
}

/**
 * Get the public form viewer URL for a given short code.
 * Falls back to the local viewer server when not configured.
 */
export function getFormViewerUrl(shortUrl: string): string {
  const base =
    import.meta.env.VITE_FORM_VIEWER_URL || 'http://localhost:5173';
  const normalizedBase = base.endsWith('/') ? base.slice(0, -1) : base;
  const sanitizedShortUrl = shortUrl.replace(/^\/+/, '');
  return `${normalizedBase}/f/${sanitizedShortUrl}`;
}
