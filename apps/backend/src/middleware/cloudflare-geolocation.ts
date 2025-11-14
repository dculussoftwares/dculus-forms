import { NextFunction, Request, Response } from 'express';

export interface CloudflareVisitorLocation {
  ipCity?: string;
  ipCountry?: string;
  ipContinent?: string;
  ipLongitude?: string;
  ipLatitude?: string;
  region?: string;
  regionCode?: string;
  metroCode?: string;
  postalCode?: string;
  timezone?: string;
}

export const VISITOR_LOCATION_HEADER_MAP = {
  ipCity: 'cf-ipcity',
  ipCountry: 'cf-ipcountry',
  ipContinent: 'cf-ipcontinent',
  ipLongitude: 'cf-iplongitude',
  ipLatitude: 'cf-iplatitude',
  region: 'cf-region',
  regionCode: 'cf-region-code',
  metroCode: 'cf-metro-code',
  postalCode: 'cf-postal-code',
  timezone: 'cf-timezone',
} as const satisfies Record<keyof CloudflareVisitorLocation, string>;

function normalizeHeaderValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0]?.toString().trim() || undefined;
  }
  return value?.toString().trim() || undefined;
}

export function cloudflareGeolocationMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const geoData: CloudflareVisitorLocation = {};

  (Object.entries(VISITOR_LOCATION_HEADER_MAP) as [
    keyof CloudflareVisitorLocation,
    string
  ][]).forEach(([key, headerName]) => {
    const normalizedValue = normalizeHeaderValue(req.headers[headerName]);
    if (normalizedValue) {
      geoData[key] = normalizedValue;
    }
  });

  req.cloudflareGeo = geoData;
  res.locals.cloudflareGeo = geoData;

  next();
}

declare global {
  namespace Express {
    interface Request {
      cloudflareGeo?: CloudflareVisitorLocation;
    }

    interface Locals {
      cloudflareGeo?: CloudflareVisitorLocation;
    }
  }
}
