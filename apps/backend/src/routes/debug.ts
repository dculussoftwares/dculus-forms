import { Router, Request, Response } from 'express';
import { HTTP_STATUS } from '@dculus/utils';
import {
  VISITOR_LOCATION_HEADER_MAP,
  CloudflareVisitorLocation,
} from '../middleware/cloudflare-geolocation.js';

const router: Router = Router();

router.get('/cloudflare-geo', (req: Request, res: Response) => {
  const cloudflareGeo: CloudflareVisitorLocation = req.cloudflareGeo || {};
  const rawVisitorHeaders = Object.values(VISITOR_LOCATION_HEADER_MAP).reduce<
    Record<string, string | null>
  >((acc, headerName) => {
    const value = req.headers[headerName];
    acc[headerName] = Array.isArray(value) ? value[0] : value ?? null;
    return acc;
  }, {});

  return res.status(HTTP_STATUS.OK).json({
    message: 'Cloudflare visitor location headers snapshot',
    hasVisitorLocationData: Object.keys(cloudflareGeo).length > 0,
    cloudflareGeo,
    rawVisitorHeaders,
  });
});

export { router as debugRouter };
