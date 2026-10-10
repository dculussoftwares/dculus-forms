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
