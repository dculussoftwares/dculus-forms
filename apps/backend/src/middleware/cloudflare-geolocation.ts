import { Request, Response, NextFunction } from 'express';
import { logger } from '../lib/logger.js';

/**
 * Cloudflare Geolocation Headers Interface
 * @see https://developers.cloudflare.com/fundamentals/reference/http-request-headers/#cf-ipcountry
 */
export interface CloudflareGeolocation {
  /** ISO 3166-1 Alpha 2 country code (e.g., "US", "GB", "IN") */
  country?: string;
  /** Continent code (e.g., "NA", "EU", "AS") */
  continent?: string;
  /** City name (Enterprise plan only) */
  city?: string;
  /** Original visitor IP address */
  connectingIp?: string;
  /** Cloudflare data center that handled the request */
  colo?: string;
  /** Cloudflare Ray ID for request tracing */
  ray?: string;
  /** Whether request is proxied through Cloudflare */
  isProxied: boolean;
}

/**
 * Extend Express Request to include Cloudflare geolocation data
 */
declare global {
  namespace Express {
    interface Request {
      cloudflare?: CloudflareGeolocation;
    }
  }
}

/**
 * Middleware to extract and attach Cloudflare geolocation headers to the request object.
 * This data is available when IP Geolocation is enabled in Cloudflare and the request
 * is proxied through Cloudflare's network (orange cloud enabled in DNS).
 */
export function cloudflareGeolocationMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const cfRay = req.headers['cf-ray'];
  const cfRayString = Array.isArray(cfRay) ? cfRay[0] : cfRay;

  const cfHeaders: CloudflareGeolocation = {
    country: req.headers['cf-ipcountry'] as string | undefined,
    continent: req.headers['cf-ipcontinent'] as string | undefined,
    city: req.headers['cf-ipcity'] as string | undefined,
    connectingIp: req.headers['cf-connecting-ip'] as string | undefined,
    colo: cfRayString?.split('-')[1],
    ray: cfRayString,
    isProxied: !!cfRayString, // CF-Ray header presence indicates Cloudflare proxy
  };

  // Attach to request object for use in resolvers and route handlers
  req.cloudflare = cfHeaders;

  // Log geolocation info for debugging (only in development)
  if (process.env.NODE_ENV !== 'production' && cfHeaders.isProxied) {
    logger.debug('🌍 Cloudflare Geolocation:', {
      country: cfHeaders.country || 'N/A',
      continent: cfHeaders.continent || 'N/A',
      city: cfHeaders.city || 'N/A (Enterprise only)',
      ip: cfHeaders.connectingIp || 'N/A',
      colo: cfHeaders.colo || 'N/A',
      ray: cfHeaders.ray || 'N/A',
    });
  } else if (!cfHeaders.isProxied && process.env.NODE_ENV !== 'test') {
    logger.debug(
      '⚠️ Request not proxied through Cloudflare. Geolocation headers unavailable.'
    );
  }

  next();
}

/**
 * Helper function to get geolocation from context in GraphQL resolvers
 */
export function getGeolocationFromContext(context: {
  req?: Request;
}): CloudflareGeolocation | null {
  return context.req?.cloudflare || null;
}

/**
 * Helper function to get user's country code (with fallback)
 */
export function getUserCountry(context: { req?: Request }): string | null {
  return context.req?.cloudflare?.country || null;
}

/**
 * Helper function to check if user is from specific country
 */
export function isUserFromCountry(
  context: { req?: Request },
  countryCodes: string[]
): boolean {
  const country = getUserCountry(context);
  return country ? countryCodes.includes(country.toUpperCase()) : false;
}
