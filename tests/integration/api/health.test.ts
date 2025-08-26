import { testClient } from '../utils/testClient';

describe('Health Check Integration Tests', () => {
  beforeAll(async () => {
    // Wait for the backend service to be ready before running tests
    await testClient.waitForReady();
  });

  describe('GET /health', () => {
    it('should return 200 status code', async () => {
      const response = await testClient.healthCheck();
      
      expect(response.status).toBe(200);
    });

    it('should return correct response structure', async () => {
      const response = await testClient.healthCheck();
      
      expect(response.body).toMatchObject({
        success: expect.any(Boolean),
        message: expect.any(String),
        timestamp: expect.any(String),
        uptime: expect.any(Number)
      });
    });

    it('should return success: true', async () => {
      const response = await testClient.healthCheck();
      
      expect(response.body.success).toBe(true);
    });

    it('should return valid timestamp', async () => {
      const response = await testClient.healthCheck();
      
      const timestamp = new Date(response.body.timestamp);
      expect(timestamp.getTime()).not.toBeNaN();
    });

    it('should return positive uptime', async () => {
      const response = await testClient.healthCheck();
      
      expect(response.body.uptime).toBeGreaterThan(0);
    });

    it('should have application/json content type', async () => {
      const response = await testClient.healthCheck();
      
      expect(response.headers['content-type']).toMatch(/application\/json/);
    });

    it('should respond quickly (under 1 second)', async () => {
      const startTime = Date.now();
      await testClient.healthCheck();
      const endTime = Date.now();
      
      const responseTime = endTime - startTime;
      expect(responseTime).toBeLessThan(1000);
    });
  });
});