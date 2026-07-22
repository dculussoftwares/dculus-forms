import { Router } from 'express';
import { auth } from '../lib/better-auth.js';
import { fromNodeHeaders } from 'better-auth/node';
import { logger } from '../lib/logger.js';

export const pexelsRouter: import('express').Router = Router();

pexelsRouter.get('/pexels', async (req, res) => {
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

  const apiKey = process.env.PEXELS_API_KEY;
  if (!apiKey) {
    return res.status(503).json({ error: 'Image search not configured' });
  }

  const { q = 'background', page = '1', per_page = '15' } = req.query as Record<string, string>;

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const perPageNum = Math.min(80, Math.max(1, parseInt(per_page, 10) || 15));

  try {
    const params = new URLSearchParams({
      query: String(q),
      orientation: 'landscape',
      size: 'large',
      page: String(pageNum),
      per_page: String(perPageNum),
    });

    const upstream = await fetch(`https://api.pexels.com/v1/search?${params}`, {
      headers: { Authorization: apiKey },
    });

    if (!upstream.ok) {
      logger.warn(`Pexels upstream error: ${upstream.status}`);
      return res.status(502).json({ error: `Upstream error: ${upstream.status}` });
    }

    const data = await upstream.json();
    return res.json(data);
  } catch (err) {
    logger.error('Pexels proxy error:', err);
    return res.status(502).json({ error: 'Failed to fetch images' });
  }
});

pexelsRouter.get('/pexels/videos', async (req, res) => {
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

  const apiKey = process.env.PEXELS_API_KEY;
  if (!apiKey) {
    return res.status(503).json({ error: 'Video search not configured' });
  }

  const { q = 'background', page = '1', per_page = '15' } = req.query as Record<string, string>;

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const perPageNum = Math.min(80, Math.max(1, parseInt(per_page, 10) || 15));

  try {
    const params = new URLSearchParams({
      query: String(q),
      orientation: 'landscape',
      size: 'medium',
      page: String(pageNum),
      per_page: String(perPageNum),
    });

    const upstream = await fetch(`https://api.pexels.com/videos/search?${params}`, {
      headers: { Authorization: apiKey },
    });

    if (!upstream.ok) {
      logger.warn(`Pexels video upstream error: ${upstream.status}`);
      return res.status(502).json({ error: `Upstream error: ${upstream.status}` });
    }

    const data = await upstream.json();
    return res.json(data);
  } catch (err) {
    logger.error('Pexels video proxy error:', err);
    return res.status(502).json({ error: 'Failed to fetch videos' });
  }
});
