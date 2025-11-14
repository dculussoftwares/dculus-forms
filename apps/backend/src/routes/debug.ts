import { Router, Request, Response } from 'express';
import type { Router as ExpressRouter } from 'express';
import { logger } from '../lib/logger.js';

const router: ExpressRouter = Router();

/**
 * Debug endpoint to inspect Cloudflare headers and geolocation data
 * @route GET /debug/cloudflare
 */
router.get('/cloudflare', (req: Request, res: Response) => {
  const cloudflareHeaders = {
    // Geolocation headers (require "Add visitor location headers" Managed Transform)
    'cf-ipcountry': req.headers['cf-ipcountry'],
    'cf-ipcontinent': req.headers['cf-ipcontinent'],
    'cf-ipcity': req.headers['cf-ipcity'],
    'cf-region': req.headers['cf-region'],
    'cf-region-code': req.headers['cf-region-code'],
    'cf-postal-code': req.headers['cf-postal-code'],
    'cf-metro-code': req.headers['cf-metro-code'],
    'cf-iplatitude': req.headers['cf-iplatitude'],
    'cf-iplongitude': req.headers['cf-iplongitude'],
    'cf-timezone': req.headers['cf-timezone'],
    'cf-connecting-ip': req.headers['cf-connecting-ip'],
    
    // Cloudflare proxy headers
    'cf-ray': req.headers['cf-ray'],
    'cf-visitor': req.headers['cf-visitor'],
    
    // Request metadata
    'x-forwarded-for': req.headers['x-forwarded-for'],
    'x-real-ip': req.headers['x-real-ip'],
    'user-agent': req.headers['user-agent'],
  };

  const geolocationData = req.cloudflare;

  logger.info('🔍 Debug endpoint accessed', {
    cloudflareHeaders,
    geolocationData,
    remoteAddress: req.ip,
  });

  res.json({
    success: true,
    timestamp: new Date().toISOString(),
    isProxiedThroughCloudflare: !!req.headers['cf-ray'],
    cloudflareHeaders,
    geolocationData,
    requestMetadata: {
      remoteAddress: req.ip,
      method: req.method,
      path: req.path,
      protocol: req.protocol,
      secure: req.secure,
    },
  });
});

/**
 * Debug endpoint to inspect all request headers
 * @route GET /debug/headers
 */
router.get('/headers', (req: Request, res: Response) => {
  logger.info('🔍 Headers debug endpoint accessed');

  // Explicitly show all geolocation fields (including undefined ones)
  const geolocation = req.cloudflare ? {
    country: req.cloudflare.country,
    continent: req.cloudflare.continent,
    city: req.cloudflare.city,
    region: req.cloudflare.region,
    regionCode: req.cloudflare.regionCode,
    postalCode: req.cloudflare.postalCode,
    metroCode: req.cloudflare.metroCode,
    latitude: req.cloudflare.latitude,
    longitude: req.cloudflare.longitude,
    timezone: req.cloudflare.timezone,
    connectingIp: req.cloudflare.connectingIp,
    colo: req.cloudflare.colo,
    ray: req.cloudflare.ray,
    isProxied: req.cloudflare.isProxied,
  } : null;

  res.json({
    success: true,
    timestamp: new Date().toISOString(),
    headers: req.headers,
    geolocation,
  });
});

export { router as debugRouter };
