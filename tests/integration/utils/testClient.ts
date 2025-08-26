import request from 'supertest';

export class TestClient {
  private baseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || process.env.BACKEND_URL || 'http://localhost:4000';
  }

  /**
   * Create a supertest request instance
   */
  request() {
    return request(this.baseUrl);
  }

  /**
   * Make a GET request to the health endpoint
   */
  async healthCheck() {
    return this.request().get('/health');
  }

  /**
   * Make a POST request to the GraphQL endpoint
   */
  async graphql(query: string, variables?: any) {
    return this.request()
      .post('/graphql')
      .send({
        query,
        variables
      });
  }

  /**
   * Wait for the backend to be ready
   */
  async waitForReady(maxAttempts: number = 30, delayMs: number = 1000): Promise<void> {
    console.log(`⏳ Waiting for backend at ${this.baseUrl} to be ready...`);
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const response = await this.healthCheck();
        if (response.status === 200) {
          console.log(`✅ Backend is ready after ${attempt} attempt(s)`);
          return;
        }
      } catch (error) {
        console.log(`🔄 Attempt ${attempt}/${maxAttempts} failed, retrying...`);
      }
      
      if (attempt < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
    
    throw new Error(`❌ Backend at ${this.baseUrl} failed to become ready after ${maxAttempts} attempts`);
  }
}

// Export a default instance
export const testClient = new TestClient();