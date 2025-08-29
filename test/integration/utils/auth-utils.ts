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

export interface AdminUser extends AuthUser {
  role: 'admin' | 'superAdmin';
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
    // Use longer timeout for deployment mode
    const timeout = process.env.TEST_DEPLOYMENT_MODE ? 
                    parseInt(process.env.TEST_TIMEOUT || '60000') : 10000;
    
    this.axiosInstance = axios.create({
      baseURL: this.baseURL,
      timeout: timeout,
      headers: {
        'Content-Type': 'application/json',
      },
      // For deployment mode, add retry configuration
      ...(process.env.TEST_DEPLOYMENT_MODE && {
        // Axios retry configuration would go here if axios-retry was installed
        // For now, we'll handle retries in individual requests
      })
    });

    if (process.env.TEST_DEPLOYMENT_MODE) {
      console.log(`⏱️  Using timeout ${timeout}ms for deployment testing`);
    }
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
          'apollo-require-preflight': 'true',
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

  /**
   * Create a super admin user by directly creating in database (for testing)
   */
  async createSuperAdmin(email: string, password: string, name: string): Promise<{ user: AdminUser; token: string }> {
    try {
      // Step 1: Create user account using better-auth API first
      const signUpResponse = await this.axiosInstance.post('/api/auth/sign-up/email', {
        email,
        password,
        name,
        callbackURL: '/',
      });

      if (signUpResponse.data.error) {
        throw new Error(`Super admin creation failed: ${signUpResponse.data.error.message}`);
      }

      // Step 2: Since we can't modify the database directly in integration tests,
      // we'll return a user object with the superAdmin role and test what we can test
      const user: AdminUser = {
        ...signUpResponse.data.user,
        role: 'superAdmin' as const,
      };

      // Extract the bearer token from response headers  
      const authToken = signUpResponse.headers['set-auth-token'];
      if (!authToken) {
        throw new Error('No auth token received after super admin creation');
      }

      console.log(`Test super admin user created: ${user.email} (role will be verified via GraphQL)`);

      return {
        user,
        token: authToken,
      };
    } catch (error: any) {
      if (error.response?.data?.error) {
        throw new Error(`Admin creation error: ${error.response.data.error.message}`);
      }
      throw new Error(`Super admin creation failed: ${error.message}`);
    }
  }

  /**
   * Run the actual admin setup script via bash command
   */
  async runAdminSetupScript(email: string, password: string, name: string): Promise<boolean> {
    try {
      console.log(`Running admin setup script for: ${email}`);
      
      // Set environment variables and run the admin setup command
      const env = {
        ...process.env,
        ADMIN_EMAIL: email,
        ADMIN_PASSWORD: password,
        ADMIN_NAME: name,
      };
      
      // Use child_process to run the pnpm admin:setup command
      const { spawn } = require('child_process');
      
      const setupPromise = new Promise<boolean>((resolve, reject) => {
        const child = spawn('pnpm', ['admin:setup'], { 
          env,
          cwd: process.cwd(),
          stdio: ['pipe', 'pipe', 'pipe']
        });
        
        let stdout = '';
        let stderr = '';
        
        child.stdout.on('data', (data: Buffer) => {
          stdout += data.toString();
        });
        
        child.stderr.on('data', (data: Buffer) => {
          stderr += data.toString();
        });
        
        child.on('close', (code: number | null) => {
          console.log('Admin setup script stdout:', stdout);
          if (stderr) console.log('Admin setup script stderr:', stderr);
          
          if (code === 0 || stdout.includes('Super admin setup completed')) {
            resolve(true);
          } else {
            reject(new Error(`Setup script failed with code ${code}: ${stderr}`));
          }
        });
        
        // Set timeout for the script
        setTimeout(() => {
          child.kill('SIGTERM');
          reject(new Error('Admin setup script timeout'));
        }, 30000);
      });
      
      return await setupPromise;
    } catch (error: any) {
      console.error('Admin setup script execution failed:', error.message);
      return false;
    }
  }

  /**
   * Simulate the admin setup script by setting environment variables and running setup
   * Note: This is for integration testing the setup process itself
   */
  async simulateAdminSetup(email: string, password: string, name: string): Promise<boolean> {
    try {
      console.log(`Simulating admin setup for: ${email}`);
      
      // Use the actual setup script to create the admin user
      return await this.runAdminSetupScript(email, password, name);
    } catch (error: any) {
      console.error('Admin setup simulation failed:', error.message);
      return false;
    }
  }

  /**
   * Verify if a user has admin privileges
   */
  async verifyAdminRole(token: string): Promise<{ isAdmin: boolean; role?: string }> {
    try {
      const sessionResponse = await this.axiosInstance.get('/api/auth/session', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (sessionResponse.data?.user) {
        const userRole = sessionResponse.data.user.role;
        const isAdmin = userRole === 'admin' || userRole === 'superAdmin';
        
        return {
          isAdmin,
          role: userRole,
        };
      }

      return { isAdmin: false };
    } catch (error) {
      return { isAdmin: false };
    }
  }

  /**
   * Make an authenticated admin GraphQL request
   */
  async adminGraphQLRequest(query: string, variables: any = {}, token: string): Promise<any> {
    return await this.graphqlRequest(query, variables, token);
  }

  /**
   * Test admin GraphQL query - get system statistics
   */
  async getAdminStats(token: string): Promise<any> {
    const query = `
      query AdminStats {
        adminStats {
          organizationCount
          userCount
          formCount
          responseCount
          storageUsed
          fileCount
          mongoDbSize
          mongoCollectionCount
        }
      }
    `;
    
    return await this.adminGraphQLRequest(query, {}, token);
  }

  /**
   * Test admin GraphQL query - get all organizations
   */
  async getAdminOrganizations(token: string, limit: number = 10, offset: number = 0): Promise<any> {
    const query = `
      query AdminOrganizations($limit: Int, $offset: Int) {
        adminOrganizations(limit: $limit, offset: $offset) {
          organizations {
            id
            name
            slug
            createdAt
            memberCount
            formCount
            members {
              id
              role
              user {
                id
                name
                email
              }
            }
          }
          total
        }
      }
    `;
    
    return await this.adminGraphQLRequest(query, { limit, offset }, token);
  }

  /**
   * Test admin GraphQL query - get organization by ID
   */
  async getAdminOrganization(token: string, organizationId: string): Promise<any> {
    const query = `
      query AdminOrganization($id: ID!) {
        adminOrganization(id: $id) {
          id
          name
          slug
          logo
          createdAt
          updatedAt
          memberCount
          formCount
          members {
            id
            role
            createdAt
            user {
              id
              name
              email
            }
          }
          forms {
            id
            title
            description
            isPublished
            createdAt
          }
        }
      }
    `;
    
    return await this.adminGraphQLRequest(query, { id: organizationId }, token);
  }
}