/**
 * Configuration utilities for admin-app
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
 * Get the authentication endpoint URL
 */
export function getAuthUrl(): string {
  return `${getApiBaseUrl()}/api/auth`;
}
/**
 * OpenPanel product analytics client id. Empty (e.g. local dev) disables analytics.
 */
export function getOpenPanelClientId(): string {
  return getRuntimeConfig('VITE_OPENPANEL_CLIENT_ID', import.meta.env.VITE_OPENPANEL_CLIENT_ID) || '';
}

/**
 * First-party OpenPanel path on this site's own domain (forwarded to the OpenPanel API).
 */
export function getOpenPanelApiUrl(): string {
  return getRuntimeConfig('VITE_OPENPANEL_API_URL', import.meta.env.VITE_OPENPANEL_API_URL) || '/_e';
}
