/**
 * Configuration utilities for form-app
 * Reads deploy-time values from /config.js (window.__APP_CONFIG__), falling back to
 * Vite environment variables and defaults for local development
 */

import { getRuntimeConfig } from '@dculus/utils';

/**
 * Get the base API URL
 */
export function getApiBaseUrl(): string {
  return getRuntimeConfig('VITE_API_URL', import.meta.env.VITE_API_URL) || 'http://localhost:4000';
}

/**
 * Get the GraphQL endpoint URL
 */
export function getGraphQLUrl(): string {
  return getRuntimeConfig('VITE_GRAPHQL_URL', import.meta.env.VITE_GRAPHQL_URL) || `${getApiBaseUrl()}/graphql`;
}

/**
 * Get the GraphQL WebSocket endpoint URL
 */
export function getGraphQLWsUrl(): string {
  const url = getRuntimeConfig('VITE_GRAPHQL_WS_URL', import.meta.env.VITE_GRAPHQL_WS_URL);
  if (!url) {
    // Derive WS URL from the HTTP GraphQL URL as fallback
    const httpUrl = getGraphQLUrl();
    return httpUrl.replace(/^http/, 'ws');
  }
  return url;
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
  return getRuntimeConfig('VITE_CDN_ENDPOINT', import.meta.env.VITE_CDN_ENDPOINT) || '';
}

/**
 * Get the Pixabay API key
 */
export function getPixabayApiKey(): string {
  return getRuntimeConfig('VITE_PIXABAY_API_KEY', import.meta.env.VITE_PIXABAY_API_KEY) || '';
}

/**
 * Whether grid (multi-column) layout authoring is enabled in the builder
 */
export function isGridLayoutEnabled(): boolean {
  return getRuntimeConfig('VITE_ENABLE_GRID_LAYOUT', import.meta.env.VITE_ENABLE_GRID_LAYOUT) === 'true';
}

/**
 * Get the base Form Viewer URL (without trailing slash)
 */
export function getFormViewerBaseUrl(): string {
  const baseUrl = getRuntimeConfig('VITE_FORM_VIEWER_URL', import.meta.env.VITE_FORM_VIEWER_URL) || 'http://localhost:5173';
  return baseUrl.replace(/\/$/, '');
}

/**
 * Build the full Form Viewer URL for a given short URL
 */
export function getFormViewerUrl(shortUrl?: string): string {
  const baseUrl = getFormViewerBaseUrl();
  if (!shortUrl) {
    return baseUrl;
  }
  return `${baseUrl}/f/${shortUrl}`;
}
