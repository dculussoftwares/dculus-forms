import { Router, type Response } from 'express';
import rateLimit from 'express-rate-limit';
import {
  getFormShareMeta,
  renderFormShareImage,
  renderTemplateImage,
} from '../services/og/ogImageService.js';
import { logger } from '../lib/logger.js';
import { proxyConfig } from '../lib/env.js';

/**
 * Public, unauthenticated image endpoints for link previews and the template gallery.
 * Everything served here is already public (published forms, public templates).
 */
export const ogRouter: import('express').Router = Router();

// Rendering costs CPU; Cloudflare absorbs repeats, this stops a cache-busting flood.
// Without TRUST_PROXY_HOPS every client shares the proxy's IP, so the ceiling is
// per-instance rather than per-client (same trade-off as the limiters in index.ts).
const ogLimiter = rateLimit({
  windowMs: 60_000,
  max: process.env.NODE_ENV === 'test' ? 10_000 : proxyConfig.trustProxyHops !== undefined ? 120 : 3000,
  standardHeaders: true,
  legacyHeaders: false,
});
// Scoped to /og: this router is mounted at the app root.
ogRouter.use('/og', ogLimiter);

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SHORT_URL = /^[A-Za-z0-9_-]{1,64}$/;

/** ?v= is a content version, so a versioned URL can be cached for good. */
const cacheHeaders = (res: Response, versioned: boolean) => {
  res.setHeader(
    'Cache-Control',
    versioned ? 'public, max-age=31536000, immutable' : 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400'
  );
  // helmet defaults to same-origin; these images are embedded by dculus.com and crawlers.
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  res.setHeader('Access-Control-Allow-Origin', '*');
};

const sendPng = (res: Response, png: Buffer, versioned: boolean) => {
  cacheHeaders(res, versioned);
  res.type('image/png').send(png);
};

const notFound = (res: Response) => {
  res.setHeader('Cache-Control', 'public, max-age=60');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  res.status(404).json({ error: 'Not found' });
};

const fail = (res: Response, what: string, error: unknown) => {
  logger.error(`OG: failed to render ${what}:`, error);
  res.setHeader('Cache-Control', 'no-store');
  res.status(500).json({ error: 'Could not render image' });
};

ogRouter.get('/og/templates/:slug.png', async (req, res) => {
  const { slug } = req.params;
  if (!SLUG.test(slug)) return notFound(res);
  try {
    const png = await renderTemplateImage(slug, 'share');
    return png ? sendPng(res, png, Boolean(req.query.v)) : notFound(res);
  } catch (error) {
    return fail(res, `template share ${slug}`, error);
  }
});

ogRouter.get('/og/templates/:slug/card.png', async (req, res) => {
  const { slug } = req.params;
  if (!SLUG.test(slug)) return notFound(res);
  try {
    const png = await renderTemplateImage(slug, 'card');
    return png ? sendPng(res, png, Boolean(req.query.v)) : notFound(res);
  } catch (error) {
    return fail(res, `template card ${slug}`, error);
  }
});

ogRouter.get('/og/forms/:shortUrl.png', async (req, res) => {
  const { shortUrl } = req.params;
  if (!SHORT_URL.test(shortUrl)) return notFound(res);
  try {
    const png = await renderFormShareImage(shortUrl);
    return png ? sendPng(res, png, Boolean(req.query.v)) : notFound(res);
  } catch (error) {
    return fail(res, `form share ${shortUrl}`, error);
  }
});

/** Read by the form viewer's edge worker to fill og:/twitter: tags on /f/<shortUrl>. */
ogRouter.get('/og/forms/:shortUrl.json', async (req, res) => {
  const { shortUrl } = req.params;
  if (!SHORT_URL.test(shortUrl)) return notFound(res);
  try {
    const meta = await getFormShareMeta(shortUrl);
    if (!meta) return notFound(res);
    // Short: a renamed form should show its new title in new unfurls quickly.
    res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=300');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    return res.json(meta);
  } catch (error) {
    logger.error(`OG: failed to load share meta for ${shortUrl}:`, error);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(500).json({ error: 'Could not load form' });
  }
});
