import { Router } from 'express';
import { auth } from '../lib/better-auth.js';
import { fromNodeHeaders } from 'better-auth/node';
import { logger } from '../lib/logger.js';

export const pixabayRouter: import('express').Router = Router();

// Bounds how long we wait on Pixabay before giving up — without this, a stalled
// upstream connection would keep the Express request (and its worker) open indefinitely.
const UPSTREAM_TIMEOUT_MS = 10_000;

function isAbortError(err: unknown): boolean {
  return err instanceof Error && err.name === 'AbortError';
}

pixabayRouter.get('/pixabay', async (req, res) => {
  // Require authentication so only signed-in users can use this proxy
  try {
    const sessionData = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });
    if (!sessionData?.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  } catch {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const apiKey = process.env.PIXABAY_API_KEY;
  if (!apiKey) {
    return res.status(503).json({ error: 'Image search not configured' });
  }

  const { q = 'background', page = '1', per_page = '20' } = req.query as Record<string, string>;

  // Validate numeric params to prevent injection
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const perPageNum = Math.min(200, Math.max(3, parseInt(per_page, 10) || 20));

  try {
    const params = new URLSearchParams({
      key: apiKey,
      q: String(q),
      image_type: 'photo',
      orientation: 'all',
      category: 'backgrounds',
      min_width: '1920',
      min_height: '1080',
      safesearch: 'true',
      page: String(pageNum),
      per_page: String(perPageNum),
    });

    const upstream = await fetch(`https://pixabay.com/api/?${params}`, {
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });

    if (!upstream.ok) {
      logger.warn(`Pixabay upstream error: ${upstream.status}`);
      return res.status(502).json({ error: `Upstream error: ${upstream.status}` });
    }

    const data = await upstream.json();
    return res.json(data);
  } catch (err) {
    if (isAbortError(err)) {
      logger.warn('Pixabay proxy timed out');
      return res.status(504).json({ error: 'Upstream request timed out' });
    }
    logger.error('Pixabay proxy error:', err);
    return res.status(502).json({ error: 'Failed to fetch images' });
  }
});

pixabayRouter.get('/pixabay/videos', async (req, res) => {
  // Require authentication so only signed-in users can use this proxy
  try {
    const sessionData = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });
    if (!sessionData?.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  } catch {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const apiKey = process.env.PIXABAY_API_KEY;
  if (!apiKey) {
    return res.status(503).json({ error: 'Video search not configured' });
  }

  const { q = 'background', page = '1', per_page = '20' } = req.query as Record<string, string>;

  // Validate numeric params to prevent injection
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const perPageNum = Math.min(200, Math.max(3, parseInt(per_page, 10) || 20));

  try {
    const params = new URLSearchParams({
      key: apiKey,
      q: String(q),
      category: 'backgrounds',
      safesearch: 'true',
      page: String(pageNum),
      per_page: String(perPageNum),
    });

    const upstream = await fetch(`https://pixabay.com/api/videos/?${params}`, {
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });

    if (!upstream.ok) {
      logger.warn(`Pixabay video upstream error: ${upstream.status}`);
      return res.status(502).json({ error: `Upstream error: ${upstream.status}` });
    }

    const data = await upstream.json();
    return res.json(data);
  } catch (err) {
    if (isAbortError(err)) {
      logger.warn('Pixabay video proxy timed out');
      return res.status(504).json({ error: 'Upstream request timed out' });
    }
    logger.error('Pixabay video proxy error:', err);
    return res.status(502).json({ error: 'Failed to fetch videos' });
  }
});
