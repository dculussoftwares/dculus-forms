/**
 * Configuration utilities for form-app
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
 * Get the WebSocket collaboration URL
 */
export function getWebSocketUrl(): string {
  const baseUrl = getApiBaseUrl();
  // Convert http to ws protocol
  const wsUrl = baseUrl.replace(/^https?:/, baseUrl.startsWith('https:') ? 'wss:' : 'ws:');
  return `${wsUrl}/collaboration`;
}

/**
 * Get the file upload endpoint URL
 */
export function getUploadUrl(): string {
  return `${getApiBaseUrl()}/upload`;
}

/**
 * Get the CDN endpoint for images
 */
export function getCdnEndpoint(): string {
  return import.meta.env.VITE_CDN_ENDPOINT || '';
}

/**
 * Get the Pixabay API key
 */
export function getPixabayApiKey(): string {
  return import.meta.env.VITE_PIXABAY_API_KEY || '';
}