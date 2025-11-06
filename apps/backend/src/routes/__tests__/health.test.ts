import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import express, { Express } from 'express';
import { healthRouter } from '../health.js';
import { HTTP_STATUS } from '@dculus/utils';

describe('Health Routes', () => {
  let app: Express;
  let originalUptime: () => number;

  beforeEach(() => {
    vi.clearAllMocks();
    app = express();
    app.use(express.json());
    app.use('/health', healthRouter);

    // Mock process.uptime
    originalUptime = process.uptime;
    vi.spyOn(process, 'uptime').mockReturnValue(12345.67);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    process.uptime = originalUptime;
  });

  describe('GET /', () => {
    it('should return health status successfully', async () => {
      const response = await request(app).get('/health');

      expect(response.status).toBe(HTTP_STATUS.OK);
      expect(response.body).toEqual({
        success: true,
        message: 'Server is healthy',
        timestamp: expect.any(String),
        uptime: 12345.67,
      });
    });

    it('should include valid ISO timestamp', async () => {
      const response = await request(app).get('/health');

      expect(response.status).toBe(HTTP_STATUS.OK);
      const timestamp = response.body.timestamp;
      expect(() => new Date(timestamp).toISOString()).not.toThrow();
      expect(new Date(timestamp).toISOString()).toBe(timestamp);
    });

    it('should return correct uptime', async () => {
      const response = await request(app).get('/health');

      expect(response.status).toBe(HTTP_STATUS.OK);
      expect(response.body.uptime).toBe(12345.67);
      expect(typeof response.body.uptime).toBe('number');
    });

    it('should always return 200 status', async () => {
      const response = await request(app).get('/health');

      expect(response.status).toBe(HTTP_STATUS.OK);
      expect(response.body.success).toBe(true);
    });

    it('should include all required fields', async () => {
      const response = await request(app).get('/health');

      expect(response.status).toBe(HTTP_STATUS.OK);
      expect(response.body).toHaveProperty('success');
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('uptime');
    });

    it('should return JSON content type', async () => {
      const response = await request(app).get('/health');

      expect(response.status).toBe(HTTP_STATUS.OK);
      expect(response.headers['content-type']).toMatch(/application\/json/);
    });

    it('should handle multiple consecutive requests', async () => {
      const response1 = await request(app).get('/health');
      const response2 = await request(app).get('/health');
      const response3 = await request(app).get('/health');

      expect(response1.status).toBe(HTTP_STATUS.OK);
      expect(response2.status).toBe(HTTP_STATUS.OK);
      expect(response3.status).toBe(HTTP_STATUS.OK);

      expect(response1.body.success).toBe(true);
      expect(response2.body.success).toBe(true);
      expect(response3.body.success).toBe(true);
    });

    it('should return different timestamps for subsequent requests', async () => {
      const response1 = await request(app).get('/health');

      // Wait a small amount of time
      await new Promise(resolve => setTimeout(resolve, 10));

      const response2 = await request(app).get('/health');

      expect(response1.body.timestamp).not.toBe(response2.body.timestamp);
    });

    it('should handle zero uptime', async () => {
      vi.spyOn(process, 'uptime').mockReturnValue(0);

      const response = await request(app).get('/health');

      expect(response.status).toBe(HTTP_STATUS.OK);
      expect(response.body.uptime).toBe(0);
    });

    it('should handle large uptime values', async () => {
      const largeUptime = 999999999.99;
      vi.spyOn(process, 'uptime').mockReturnValue(largeUptime);

      const response = await request(app).get('/health');

      expect(response.status).toBe(HTTP_STATUS.OK);
      expect(response.body.uptime).toBe(largeUptime);
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

    it('should not accept PATCH requests', async () => {
      const response = await request(app).patch('/health').send({});

      expect(response.status).toBe(404);
    });

    it('should handle query parameters gracefully', async () => {
      const response = await request(app).get('/health?foo=bar&baz=qux');

      expect(response.status).toBe(HTTP_STATUS.OK);
      expect(response.body.success).toBe(true);
    });

    it('should handle trailing slash', async () => {
      const response = await request(app).get('/health/');

      // Depending on Express configuration, this might be 200 or 404
      // Testing that it doesn't crash
      expect([200, 404]).toContain(response.status);
    });

    it('should have correct response structure', async () => {
      const response = await request(app).get('/health');

      expect(response.status).toBe(HTTP_STATUS.OK);
      expect(Object.keys(response.body)).toEqual([
        'success',
        'message',
        'timestamp',
        'uptime',
      ]);
    });

    it('should have boolean success field', async () => {
      const response = await request(app).get('/health');

      expect(response.status).toBe(HTTP_STATUS.OK);
      expect(typeof response.body.success).toBe('boolean');
      expect(response.body.success).toBe(true);
    });

    it('should have string message field', async () => {
      const response = await request(app).get('/health');

      expect(response.status).toBe(HTTP_STATUS.OK);
      expect(typeof response.body.message).toBe('string');
      expect(response.body.message).toBe('Server is healthy');
    });

    it('should have string timestamp field', async () => {
      const response = await request(app).get('/health');

      expect(response.status).toBe(HTTP_STATUS.OK);
      expect(typeof response.body.timestamp).toBe('string');
    });

    it('should have number uptime field', async () => {
      const response = await request(app).get('/health');

      expect(response.status).toBe(HTTP_STATUS.OK);
      expect(typeof response.body.uptime).toBe('number');
    });

    it('should work with Accept: application/json header', async () => {
      const response = await request(app)
        .get('/health')
        .set('Accept', 'application/json');

      expect(response.status).toBe(HTTP_STATUS.OK);
      expect(response.body.success).toBe(true);
    });

    it('should work without Accept header', async () => {
      const response = await request(app).get('/health');

      expect(response.status).toBe(HTTP_STATUS.OK);
      expect(response.body.success).toBe(true);
    });

    it('should be fast to respond', async () => {
      const startTime = Date.now();
      await request(app).get('/health');
      const duration = Date.now() - startTime;

      // Health check should respond in less than 1 second
      expect(duration).toBeLessThan(1000);
    });

    it('should handle concurrent requests', async () => {
      const requests = Array.from({ length: 10 }, () =>
        request(app).get('/health')
      );

      const responses = await Promise.all(requests);

      responses.forEach(response => {
        expect(response.status).toBe(HTTP_STATUS.OK);
        expect(response.body.success).toBe(true);
      });
    });

    it('should return timestamp in ISO 8601 format', async () => {
      const response = await request(app).get('/health');

      expect(response.status).toBe(HTTP_STATUS.OK);
      const timestamp = response.body.timestamp;

      // ISO 8601 format check (YYYY-MM-DDTHH:mm:ss.sssZ)
      expect(timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });

    it('should calculate uptime correctly', async () => {
      const mockUptime = 3661.5; // 1 hour, 1 minute, 1.5 seconds
      vi.spyOn(process, 'uptime').mockReturnValue(mockUptime);

      const response = await request(app).get('/health');

      expect(response.status).toBe(HTTP_STATUS.OK);
      expect(response.body.uptime).toBe(mockUptime);
    });
  });

  describe('Integration scenarios', () => {
    it('should work as a health check endpoint for load balancers', async () => {
      // Load balancers typically check for 2xx status codes
      const response = await request(app).get('/health');

      expect(response.status).toBeGreaterThanOrEqual(200);
      expect(response.status).toBeLessThan(300);
    });

    it('should work as a readiness probe', async () => {
      const response = await request(app).get('/health');

      expect(response.status).toBe(HTTP_STATUS.OK);
      expect(response.body.success).toBe(true);
    });

    it('should work as a liveness probe', async () => {
      const response = await request(app).get('/health');

      expect(response.status).toBe(HTTP_STATUS.OK);
      expect(response.body.uptime).toBeGreaterThanOrEqual(0);
    });
  });
});
