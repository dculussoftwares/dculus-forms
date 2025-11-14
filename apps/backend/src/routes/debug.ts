import { Router, Request, Response } from 'express';
import { HTTP_STATUS } from '@dculus/utils';
import {
  EDGE_VISITOR_LOCATION_HEADER_MAP,
  EdgeVisitorLocation,
} from '../middleware/edge-geolocation.js';

const router: Router = Router();

router.get('/cloudflare-geo', (req: Request, res: Response) => {
  const visitorGeo: EdgeVisitorLocation = req.visitorGeo || {};
  const rawVisitorHeaders = Object.values(EDGE_VISITOR_LOCATION_HEADER_MAP).reduce<
    Record<string, string | null>
  >((acc, headerName) => {
    const value = req.headers[headerName];
    acc[headerName] = Array.isArray(value) ? value[0] : value ?? null;
    return acc;
  }, {});

  return res.status(HTTP_STATUS.OK).json({
    message: 'Edge visitor location headers snapshot',
    hasVisitorLocationData: Object.keys(visitorGeo).length > 0,
    visitorGeo,
    rawVisitorHeaders,
  });
});

export { router as debugRouter };
