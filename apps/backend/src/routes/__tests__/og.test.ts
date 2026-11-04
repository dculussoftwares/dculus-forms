import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express, { Express } from 'express';

vi.mock('../../services/og/ogImageService.js', () => ({
  renderTemplateImage: vi.fn(),
  renderFormShareImage: vi.fn(),
  getFormShareMeta: vi.fn(),
}));
vi.mock('../../lib/logger.js', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

const { ogRouter } = await import('../og.js');
const og = await import('../../services/og/ogImageService.js');

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47]);

describe('OG image routes', () => {
  let app: Express;

  beforeEach(() => {
    vi.clearAllMocks();
    app = express();
    app.use('/', ogRouter);
    app.get('/other', (_req, res) => res.send('ok'));
  });

  it('serves the template share image and the gallery card', async () => {
    vi.mocked(og.renderTemplateImage).mockResolvedValue(PNG);

    const share = await request(app).get('/og/templates/contact-form.png?v=abc');
    expect(share.status).toBe(200);
    expect(share.headers['content-type']).toBe('image/png');
    expect(share.headers['cache-control']).toContain('immutable');
    expect(share.headers['cross-origin-resource-policy']).toBe('cross-origin');
    expect(og.renderTemplateImage).toHaveBeenCalledWith('contact-form', 'share');

    const card = await request(app).get('/og/templates/contact-form/card.png');
    expect(card.status).toBe(200);
    expect(card.headers['cache-control']).not.toContain('immutable');
    expect(og.renderTemplateImage).toHaveBeenLastCalledWith('contact-form', 'card');
  });

  it('404s for unknown templates and rejects malformed slugs without rendering', async () => {
    vi.mocked(og.renderTemplateImage).mockResolvedValue(null);
    expect((await request(app).get('/og/templates/missing.png')).status).toBe(404);
    expect((await request(app).get('/og/templates/Bad_Slug.png')).status).toBe(404);
    expect(og.renderTemplateImage).toHaveBeenCalledTimes(1);
  });

  it('serves form share meta and image only for published forms', async () => {
    vi.mocked(og.getFormShareMeta).mockResolvedValue({
      title: 'T',
      description: 'D',
      imageUrl: 'https://api/og/forms/abc123.png?v=1',
      imageAlt: 'T — online form',
      version: '1',
    });
    const meta = await request(app).get('/og/forms/abc123.json');
    expect(meta.status).toBe(200);
    expect(meta.body.title).toBe('T');

    vi.mocked(og.renderFormShareImage).mockResolvedValue(null);
    expect((await request(app).get('/og/forms/abc123.png')).status).toBe(404);
    expect((await request(app).get('/og/forms/a.b.png')).status).toBe(404);
  });

  it('returns 500 without caching when rendering throws', async () => {
    vi.mocked(og.renderTemplateImage).mockRejectedValue(new Error('boom'));
    const res = await request(app).get('/og/templates/contact-form.png');
    expect(res.status).toBe(500);
    expect(res.headers['cache-control']).toBe('no-store');
  });

  it('leaves other routes alone (router is mounted at the root)', async () => {
    const res = await request(app).get('/other');
    expect(res.text).toBe('ok');
    expect(res.headers['ratelimit-policy']).toBeUndefined();
  });
});
