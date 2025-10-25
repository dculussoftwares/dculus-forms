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
