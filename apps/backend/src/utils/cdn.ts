import { s3Config } from '../lib/env.js';

/**
 * Construct a full CDN URL from an S3 key
 */
export function constructCdnUrl(s3Key: string | null): string | null {
  if (!s3Key) return null;

  // Remove leading slash if present
  const cleanKey = s3Key.startsWith('/') ? s3Key.slice(1) : s3Key;
  
  // Ensure endpoint doesn't end with slash
  const cleanEndpoint = s3Config.publicCdnUrl.endsWith('/')
    ? s3Config.publicCdnUrl.slice(0, -1)
    : s3Config.publicCdnUrl;
  
  return `${cleanEndpoint}/${cleanKey}`;
}