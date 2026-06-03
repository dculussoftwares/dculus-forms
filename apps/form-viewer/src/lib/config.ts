export function getApiBaseUrl(): string {
  return import.meta.env.VITE_API_URL || 'http://localhost:4000';
}

export function getGraphQLUrl(): string {
  return import.meta.env.VITE_GRAPHQL_URL || `${getApiBaseUrl()}/graphql`;
}

export function getUploadUrl(): string {
  return `${getApiBaseUrl()}/upload`;
}

export function getCdnEndpoint(): string {
  return import.meta.env.VITE_CDN_ENDPOINT || '';
}
