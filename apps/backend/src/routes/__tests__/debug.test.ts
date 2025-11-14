import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import express, { Express } from 'express';
import { debugRouter } from '../debug.js';
import { edgeGeolocationMiddleware } from '../../middleware/edge-geolocation.js';

describe('Debug Routes - Cloudflare Geolocation', () => {
  let app: Express;

  beforeEach(() => {
    app = express();
    app.use(edgeGeolocationMiddleware);
    app.use('/api/debug', debugRouter);
  });

  it('should return normalized Cloudflare visitor location data when headers are present', async () => {
    const response = await request(app)
      .get('/api/debug/cloudflare-geo')
      .set('cf-ipcity', 'Austin')
      .set('cf-ipcountry', 'US')
      .set('cf-ipcontinent', 'NA')
      .set('cf-iplongitude', '-97.7431')
      .set('cf-iplatitude', '30.2672')
      .set('cf-region', 'Texas')
      .set('cf-region-code', 'TX')
      .set('cf-metro-code', '635')
      .set('cf-postal-code', '73301')
      .set('cf-timezone', 'America/Chicago');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      hasVisitorLocationData: true,
      visitorGeo: {
        city: 'Austin',
        country: 'US',
        continent: 'NA',
        longitude: '-97.7431',
        latitude: '30.2672',
        region: 'Texas',
        regionCode: 'TX',
        metroCode: '635',
        postalCode: '73301',
        timezone: 'America/Chicago',
      },
    });

    expect(response.body.rawVisitorHeaders).toMatchObject({
      'cf-ipcity': 'Austin',
      'cf-ipcountry': 'US',
      'cf-timezone': 'America/Chicago',
    });
  });

  it('should respond with empty geo data when Cloudflare headers are missing', async () => {
    const response = await request(app).get('/api/debug/cloudflare-geo');

    expect(response.status).toBe(200);
    expect(response.body.hasVisitorLocationData).toBe(false);
    expect(response.body.visitorGeo).toEqual({});
  });
});
