import axios from 'axios';

export class HealthCheckUtils {
  private readonly frontendURL: string;
  private readonly backendURL: string;
  private readonly maxRetries: number = 30;
  private readonly retryDelay: number = 2000; // 2 seconds

  constructor() {
    this.frontendURL = process.env.E2E_BASE_URL || 'http://localhost:3000';
    this.backendURL = process.env.E2E_BACKEND_URL || 'http://localhost:4000';
  }

  /**
   * Check if frontend (form app) is running
   */
  async checkFrontendHealth(): Promise<boolean> {
    try {
      const response = await axios.get(this.frontendURL, {
        timeout: 5000,
        validateStatus: () => true // Accept any status code
      });
      
      // For a React app, we expect HTML content
      return response.status < 500 && response.data.toLowerCase().includes('<!doctype html');
    } catch (error) {
      console.log(`Frontend health check failed: ${(error as Error).message}`);
      return false;
    }
  }

  /**
   * Check if backend is running and healthy
   */
  async checkBackendHealth(): Promise<boolean> {
    try {
      // Check the health endpoint
      const healthResponse = await axios.get(`${this.backendURL}/health`, {
        timeout: 5000
      });
      
      if (healthResponse.status === 200) {
        return true;
      }

      // If health endpoint doesn't exist, check GraphQL endpoint
      const graphqlResponse = await axios.post(`${this.backendURL}/graphql`, {
        query: `
          query {
            __schema {
              queryType {
                name
              }
            }
          }
        `
      }, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 5000
      });

      return graphqlResponse.status === 200;
    } catch (error) {
      console.log(`Backend health check failed: ${(error as Error).message}`);
      return false;
    }
  }

  /**
   * Wait for a service to be ready with retries
   */
  async waitForService(
    serviceName: string, 
    healthCheck: () => Promise<boolean>
  ): Promise<boolean> {
    console.log(`⏳ Waiting for ${serviceName} to be ready...`);
    
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      const isHealthy = await healthCheck();
      
      if (isHealthy) {
        console.log(`✅ ${serviceName} is ready (attempt ${attempt}/${this.maxRetries})`);
        return true;
      }
      
      if (attempt < this.maxRetries) {
        console.log(`⏳ ${serviceName} not ready, retrying in ${this.retryDelay}ms (attempt ${attempt}/${this.maxRetries})`);
        await this.sleep(this.retryDelay);
      }
    }
    
    console.log(`❌ ${serviceName} failed to become ready after ${this.maxRetries} attempts`);
    return false;
  }

  /**
   * Wait for all required services to be ready
   */
  async waitForAllServices(): Promise<boolean> {
    console.log('🔍 Checking service health...');
    
    const frontendReady = await this.waitForService('Frontend (Form App)', () => this.checkFrontendHealth());
    const backendReady = await this.waitForService('Backend (GraphQL API)', () => this.checkBackendHealth());
    
    if (frontendReady && backendReady) {
      console.log('✅ All services are healthy and ready for testing');
      return true;
    }
    
    console.log('❌ One or more services failed health checks');
    
    if (!frontendReady) {
      console.log(`❌ Frontend not available at: ${this.frontendURL}`);
      console.log('   Please start with: pnpm form-app:dev');
    }
    
    if (!backendReady) {
      console.log(`❌ Backend not available at: ${this.backendURL}`);
      console.log('   Please start with: pnpm backend:dev');
    }
    
    return false;
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Check if a URL is accessible
   */
  async isUrlAccessible(url: string): Promise<boolean> {
    try {
      const response = await axios.get(url, {
        timeout: 5000,
        validateStatus: () => true
      });
      return response.status < 500;
    } catch {
      return false;
    }
  }
}