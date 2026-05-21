import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import express, { Express } from 'express';
import { HTTP_STATUS } from '@dculus/utils';

// Mock prisma before importing the router
vi.mock('../../lib/prisma.js', () => ({
  prisma: {
    $queryRaw: vi.fn().mockResolvedValue([{ '?column?': 1 }]),
  },
}));

// Import after mock setup
const { healthRouter } = await import('../health.js');
const { prisma } = await import('../../lib/prisma.js');

describe('Health Routes', () => {
  let app: Express;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.$queryRaw).mockResolvedValue([{ '?column?': 1 }]);
    app = express();
    app.use(express.json());
    app.use('/health', healthRouter);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('GET / — database reachable', () => {
    it('should return status ok with 200', async () => {
      const response = await request(app).get('/health');

      expect(response.status).toBe(HTTP_STATUS.OK);
      expect(response.body).toEqual({ status: 'ok' });
    });

    it('should return JSON content type', async () => {
      const response = await request(app).get('/health');

      expect(response.status).toBe(HTTP_STATUS.OK);
      expect(response.headers['content-type']).toMatch(/application\/json/);
    });

    it('should handle multiple consecutive requests', async () => {
      const [r1, r2, r3] = await Promise.all([
        request(app).get('/health'),
        request(app).get('/health'),
        request(app).get('/health'),
      ]);

      expect(r1.status).toBe(HTTP_STATUS.OK);
      expect(r2.status).toBe(HTTP_STATUS.OK);
      expect(r3.status).toBe(HTTP_STATUS.OK);
    });

    it('should handle query parameters gracefully', async () => {
      const response = await request(app).get('/health?foo=bar');

      expect(response.status).toBe(HTTP_STATUS.OK);
      expect(response.body.status).toBe('ok');
    });

    it('should not accept POST requests', async () => {
      const response = await request(app).post('/health').send({});
      expect(response.status).toBe(404);
    });

    it('should not accept PUT requests', async () => {
      const response = await request(app).put('/health').send({});
      expect(response.status).toBe(404);
    });

    it('should not accept DELETE requests', async () => {
      const response = await request(app).delete('/health');
      expect(response.status).toBe(404);
    });

    it('should work as a load-balancer health check (2xx)', async () => {
      const response = await request(app).get('/health');
      expect(response.status).toBeGreaterThanOrEqual(200);
      expect(response.status).toBeLessThan(300);
    });

    it('should be fast to respond', async () => {
      const start = Date.now();
      await request(app).get('/health');
      expect(Date.now() - start).toBeLessThan(1000);
    });
  });

  describe('GET / — database unreachable', () => {
    it('should return 503 with error status', async () => {
      vi.mocked(prisma.$queryRaw).mockRejectedValueOnce(new Error('ECONNREFUSED'));

      const response = await request(app).get('/health');

      expect(response.status).toBe(503);
      expect(response.body.status).toBe('error');
      expect(response.body.message).toBe('Database unavailable');
    });

    it('should not expose internal error details to caller', async () => {
      vi.mocked(prisma.$queryRaw).mockRejectedValueOnce(new Error('secret connection string info'));

      const response = await request(app).get('/health');

      expect(response.status).toBe(503);
      expect(JSON.stringify(response.body)).not.toContain('secret');
    });
  });
});
