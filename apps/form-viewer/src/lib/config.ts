import { getRuntimeConfig } from '@dculus/utils';

export function getApiBaseUrl(): string {
  return getRuntimeConfig('VITE_API_URL', import.meta.env.VITE_API_URL) || 'http://localhost:4000';
}

export function getGraphQLUrl(): string {
  return getRuntimeConfig('VITE_GRAPHQL_URL', import.meta.env.VITE_GRAPHQL_URL) || `${getApiBaseUrl()}/graphql`;
}

export function getUploadUrl(): string {
  return `${getApiBaseUrl()}/upload`;
}

export function getCdnEndpoint(): string {
  return getRuntimeConfig('VITE_CDN_ENDPOINT', import.meta.env.VITE_CDN_ENDPOINT) || '';
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
