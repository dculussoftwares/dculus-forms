import axios, { AxiosResponse } from 'axios';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuthSession {
  id: string;
  userId: string;
  token: string;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
  activeOrganizationId?: string;
}

export interface SignUpResponse {
  user: AuthUser;
  session: AuthSession;
  token?: string;
  error?: { message: string };
}

export interface SignInResponse {
  user: AuthUser;
  session: AuthSession;
  token?: string;
  error?: { message: string };
}

export interface OrganizationCreateResponse {
  id: string;
  name: string;
  slug: string;
  logo?: string;
  error?: { message: string };
}

export class AuthUtils {
  private baseURL: string;
  public axiosInstance;

  constructor(baseURL: string = 'http://localhost:4000') {
    this.baseURL = baseURL;
    this.axiosInstance = axios.create({
      baseURL: this.baseURL,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Sign up a new user and create an organization
   */
  async signUpUser(
    email: string,
    password: string,
    name: string,
    organizationName: string
  ): Promise<{ user: AuthUser; organization: any; token: string }> {
    try {
      // Step 1: Create user account using better-auth API
      const signUpResponse = await this.axiosInstance.post('/api/auth/sign-up/email', {
        email,
        password,
        name,
        callbackURL: '/',
      });

      if (signUpResponse.data.error) {
        throw new Error(`Sign up failed: ${signUpResponse.data.error.message}`);
      }

      // Extract the bearer token from response headers
      const authToken = signUpResponse.headers['set-auth-token'];
      if (!authToken) {
        throw new Error('No auth token received after sign up');
      }

      // Step 2: Create organization using better-auth organization plugin
      const organizationResponse = await this.axiosInstance.post(
        '/api/auth/organization/create',
        {
          name: organizationName,
          slug: organizationName
            .toLowerCase()
            .replace(/\s+/g, '-')
            .replace(/[^a-z0-9-]/g, ''),
          keepCurrentActiveOrganization: false,
        },
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        }
      );

      if (organizationResponse.data.error) {
        throw new Error(`Organization creation failed: ${organizationResponse.data.error.message}`);
      }

      // Step 3: Sign out the user (mimicking frontend flow)
      await this.axiosInstance.post(
        '/api/auth/sign-out',
        {},
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        }
      );

      return {
        user: signUpResponse.data.user,
        organization: organizationResponse.data,
        token: authToken,
      };
    } catch (error: any) {
      if (error.response?.data?.error) {
        throw new Error(`Auth error: ${error.response.data.error.message}`);
      }
      throw new Error(`Sign up failed: ${error.message}`);
    }
  }

  /**
   * Sign in an existing user
   */
  async signInUser(email: string, password: string): Promise<{ user: AuthUser; session: AuthSession; token: string }> {
    try {
      const signInResponse = await this.axiosInstance.post('/api/auth/sign-in/email', {
        email,
        password,
        callbackURL: '/',
      });

      if (signInResponse.data.error) {
        throw new Error(`Sign in failed: ${signInResponse.data.error.message}`);
      }

      // Extract the bearer token from response headers
      const authToken = signInResponse.headers['set-auth-token'];
      if (!authToken) {
        throw new Error('No auth token received after sign in');
      }

      return {
        user: signInResponse.data.user,
        session: signInResponse.data.session,
        token: authToken,
      };
    } catch (error: any) {
      if (error.response?.data?.error) {
        throw new Error(`Auth error: ${error.response.data.error.message}`);
      }
      throw new Error(`Sign in failed: ${error.message}`);
    }
  }

  /**
   * Get auth token for an existing user (convenience method)
   */
  async getAuthToken(email: string, password: string): Promise<string> {
    const signInResult = await this.signInUser(email, password);
    return signInResult.token;
  }

  /**
   * Verify if a token is valid by checking session
   */
  async verifyToken(token: string): Promise<{ user: AuthUser; session: AuthSession } | null> {
    try {
      const sessionResponse = await this.axiosInstance.get('/api/auth/session', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (sessionResponse.data && sessionResponse.data.user) {
        return {
          user: sessionResponse.data.user,
          session: sessionResponse.data.session,
        };
      }

      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Make an authenticated GraphQL request
   */
  async graphqlRequest(query: string, variables: any = {}, token: string): Promise<AxiosResponse> {
    return await this.axiosInstance.post(
      '/graphql',
      {
        query,
        variables,
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );
  }

  /**
   * Sign out a user
   */
  async signOut(token: string): Promise<void> {
    try {
      await this.axiosInstance.post(
        '/api/auth/sign-out',
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
    } catch (error: any) {
      // Sign out errors are often not critical for tests
      console.warn('Sign out error:', error.message);
    }
  }

  /**
   * Clean up: delete test user (useful for test teardown)
   */
  async deleteUser(token: string): Promise<void> {
    try {
      // Note: better-auth might not have a direct delete user endpoint
      // This would need to be implemented on the backend if needed for tests
      console.warn('User deletion not implemented - manual cleanup may be required');
    } catch (error: any) {
      console.warn('User deletion error:', error.message);
    }
  }
}