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