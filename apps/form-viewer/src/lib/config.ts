/**
 * Configuration utilities for form-viewer
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
 * Get the CDN endpoint for images
 */
export function getCdnEndpoint(): string {
  return import.meta.env.VITE_CDN_ENDPOINT || '';
}