const request = require('supertest');

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  session: any;
}

interface SignUpData {
  email: string;
  password: string;
  name: string;
  organizationName?: string;
}

interface SignInData {
  email: string;
  password: string;
}

class TestClient {
  private baseUrl: string;
  private authTokens: AuthTokens | null = null;

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
   * Make an authenticated POST request to the GraphQL endpoint
   */
  async authenticatedGraphQL(query: string, variables?: any, token?: string) {
    const authToken = token || this.authTokens?.accessToken;
    if (!authToken) {
      throw new Error('No authentication token available. Please sign in first.');
    }

    return this.request()
      .post('/graphql')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        query,
        variables
      });
  }

  /**
   * Sign up a new user with better-auth
   */
  async signUp(userData: SignUpData) {
    console.log(`📝 Signing up user with email: ${userData.email}`);
    
    const response = await this.request()
      .post('/api/auth/sign-up')
      .send({
        email: userData.email,
        password: userData.password,
        name: userData.name,
        ...(userData.organizationName && { organizationName: userData.organizationName })
      });

    // Extract tokens from response headers and body
    if (response.status === 200 || response.status === 201) {
      const authToken = response.headers['set-auth-token'] || 
                       response.body?.accessToken ||
                       this.extractTokenFromSetCookie(response.headers['set-cookie']);
      
      if (authToken) {
        this.authTokens = {
          accessToken: authToken,
          refreshToken: response.body?.refreshToken || '',
          session: response.body?.session || response.body?.user
        };
        console.log(`✅ User signed up successfully, token stored`);
      } else {
        console.log('⚠️ Sign up successful but no token found in response');
      }
    }

    return response;
  }

  /**
   * Sign in an existing user with better-auth
   */
  async signIn(credentials: SignInData) {
    console.log(`🔐 Signing in user with email: ${credentials.email}`);
    
    const response = await this.request()
      .post('/api/auth/sign-in')
      .send({
        email: credentials.email,
        password: credentials.password
      });

    // Extract tokens from response
    if (response.status === 200) {
      const authToken = response.headers['set-auth-token'] || 
                       response.body?.accessToken ||
                       this.extractTokenFromSetCookie(response.headers['set-cookie']);
      
      if (authToken) {
        this.authTokens = {
          accessToken: authToken,
          refreshToken: response.body?.refreshToken || '',
          session: response.body?.session || response.body?.user
        };
        console.log(`✅ User signed in successfully, token stored`);
      } else {
        console.log('⚠️ Sign in successful but no token found in response');
      }
    }

    return response;
  }

  /**
   * Sign out the current user
   */
  async signOut() {
    console.log('🚪 Signing out user');
    
    const response = await this.request()
      .post('/api/auth/sign-out')
      .set('Authorization', this.authTokens?.accessToken ? `Bearer ${this.authTokens.accessToken}` : '');

    // Clear stored tokens
    this.authTokens = null;
    console.log('✅ User signed out, tokens cleared');

    return response;
  }

  /**
   * Get current authentication status
   */
  isAuthenticated(): boolean {
    return this.authTokens !== null && !!this.authTokens.accessToken;
  }

  /**
   * Get stored authentication tokens
   */
  getAuthTokens(): AuthTokens | null {
    return this.authTokens;
  }

  /**
   * Set authentication tokens manually (useful for testing)
   */
  setAuthTokens(tokens: AuthTokens) {
    this.authTokens = tokens;
  }

  /**
   * Clear stored authentication tokens
   */
  clearAuthTokens() {
    this.authTokens = null;
  }

  /**
   * Extract token from Set-Cookie header (fallback method)
   */
  private extractTokenFromSetCookie(setCookieHeaders: string[] | string | undefined): string | null {
    if (!setCookieHeaders) return null;
    
    const cookies = Array.isArray(setCookieHeaders) ? setCookieHeaders : [setCookieHeaders];
    
    for (const cookie of cookies) {
      // Look for better-auth session cookie or token
      if (cookie.includes('better-auth.session-token=') || cookie.includes('auth-token=')) {
        const tokenMatch = cookie.match(/(?:better-auth\.session-token|auth-token)=([^;]+)/);
        if (tokenMatch) {
          return tokenMatch[1];
        }
      }
    }
    
    return null;
  }

  /**
   * Helper method to create a test user with organization
   */
  async createTestUser(email?: string, organizationName?: string) {
    const testEmail = email || `test-${Date.now()}@example.com`;
    const testOrgName = organizationName || `Test Org ${Date.now()}`;
    
    return await this.signUp({
      email: testEmail,
      password: 'testpass123',
      name: 'Test User',
      organizationName: testOrgName
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
const testClient = new TestClient();

module.exports = { TestClient, testClient };