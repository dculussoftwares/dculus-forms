import { AuthUtils, AuthUser, AuthSession } from './auth-utils';
import { FormTestUtils } from './form-test-utils';

export interface CITestConfig {
  baseURL: string;
  testEmail: string;
  testPassword: string;
  orgPrefix: string;
  isCIEnvironment: boolean;
}

export interface CITestUser {
  user: AuthUser;
  token: string;
  organizationId: string;
  organizationName: string;
}

/**
 * CI-specific test utilities that provide production-safe testing capabilities
 * while maintaining isolation from local development tests
 */
export class CITestUtils {
  private config: CITestConfig;
  private authUtils: AuthUtils;
  private formTestUtils: FormTestUtils;
  private createdUsers: CITestUser[] = [];
  private createdOrganizations: string[] = [];
  private createdForms: string[] = [];

  constructor(config: CITestConfig) {
    this.config = config;
    this.authUtils = new AuthUtils(config.baseURL);
    this.formTestUtils = new FormTestUtils(config.baseURL);
  }

  /**
   * Check if we're running in CI environment
   */
  static isCIEnvironment(): boolean {
    return process.env.CI_INTEGRATION_TEST === 'true';
  }

  /**
   * Get CI configuration from environment variables
   */
  static getCIConfig(): CITestConfig {
    const baseURL = process.env.TEST_BASE_URL || 'http://localhost:4000';
    const testEmail = process.env.TEST_EMAIL || 'integrationtestdculus@mailinator.com';
    const testPassword = process.env.TEST_PASSWORD || 'TestPassword123!';
    const orgPrefix = process.env.TEST_ORG_PREFIX || 'ci-test';
    const isCIEnvironment = CITestUtils.isCIEnvironment();

    return {
      baseURL,
      testEmail,
      testPassword,
      orgPrefix,
      isCIEnvironment,
    };
  }

  /**
   * Create a CI-specific test user with organization
   */
  async createTestUser(userSuffix?: string): Promise<CITestUser> {
    const timestamp = Date.now();
    const suffix = userSuffix || timestamp.toString();

    // Use CI-specific email pattern
    const testEmail = this.config.testEmail.replace('@', `+${suffix}@`);
    const organizationName = `${this.config.orgPrefix}-org-${suffix}`;

    console.log(`Creating CI test user: ${testEmail} with org: ${organizationName}`);

    try {
      const result = await this.authUtils.signUpUser(
        testEmail,
        this.config.testPassword,
        `CI Test User ${suffix}`,
        organizationName
      );

      // Sign in to get the token
      const signInResult = await this.authUtils.signInUser(testEmail, this.config.testPassword);

      const testUser: CITestUser = {
        user: result.user,
        token: signInResult.token,
        organizationId: result.organization.id,
        organizationName: organizationName,
      };

      // Track for cleanup
      this.createdUsers.push(testUser);
      this.createdOrganizations.push(result.organization.id);

      console.log(`✅ Created CI test user: ${testEmail}`);
      return testUser;
    } catch (error: any) {
      console.error(`Failed to create CI test user: ${error.message}`);
      throw error;
    }
  }

  /**
   * Create a CI admin user for admin tests
   */
  async createAdminUser(): Promise<CITestUser> {
    const timestamp = Date.now();
    const adminEmail = this.config.testEmail.replace('@', `+admin${timestamp}@`);
    const organizationName = `${this.config.orgPrefix}-admin-org-${timestamp}`;

    try {
      // First create regular user
      const result = await this.authUtils.signUpUser(
        adminEmail,
        this.config.testPassword,
        `CI Admin User ${timestamp}`,
        organizationName
      );

      // Try to create super admin
      const adminResult = await this.authUtils.createSuperAdmin(
        adminEmail,
        this.config.testPassword,
        `CI Admin User ${timestamp}`
      );

      const testUser: CITestUser = {
        user: adminResult.user,
        token: adminResult.token,
        organizationId: result.organization.id,
        organizationName: organizationName,
      };

      // Track for cleanup
      this.createdUsers.push(testUser);
      this.createdOrganizations.push(result.organization.id);

      console.log(`✅ Created CI admin user: ${adminEmail}`);
      return testUser;
    } catch (error: any) {
      console.error(`Failed to create CI admin user: ${error.message}`);
      throw error;
    }
  }

  /**
   * Create a test form for CI testing
   */
  async createTestForm(testUser: CITestUser, title?: string): Promise<string> {
    const timestamp = Date.now();
    const formTitle = title || `CI Test Form ${timestamp}`;

    try {
      const form = await this.formTestUtils.createFormFromTemplate(
        testUser.token,
        'Job Application Form', // Use default template
        formTitle,
        `CI test form created at ${new Date().toISOString()}`
      );

      // Track for cleanup
      this.createdForms.push(form.id);

      console.log(`✅ Created CI test form: ${formTitle} (${form.id})`);
      return form.id;
    } catch (error: any) {
      console.error(`Failed to create CI test form: ${error.message}`);
      throw error;
    }
  }

  /**
   * Verify backend health before running tests
   */
  async verifyBackendHealth(): Promise<boolean> {
    try {
      const response = await this.authUtils.axiosInstance.get('/health');
      const isHealthy = response.status === 200;

      if (isHealthy) {
        console.log('✅ Backend health check passed');
      } else {
        console.log('❌ Backend health check failed');
      }

      return isHealthy;
    } catch (error: any) {
      console.error(`Backend health check failed: ${error.message}`);
      return false;
    }
  }

  /**
   * Verify GraphQL endpoint is working
   */
  async verifyGraphQLEndpoint(): Promise<boolean> {
    try {
      const testUser = await this.createTestUser('health-check');

      const query = `
        query HealthCheck {
          __schema {
            types {
              name
            }
          }
        }
      `;

      const response = await this.authUtils.graphqlRequest(query, {}, testUser.token);
      const isWorking = response.status === 200 && response.data?.data?.__schema;

      if (isWorking) {
        console.log('✅ GraphQL endpoint health check passed');
      } else {
        console.log('❌ GraphQL endpoint health check failed');
      }

      return isWorking;
    } catch (error: any) {
      console.error(`GraphQL endpoint health check failed: ${error.message}`);
      return false;
    }
  }

  /**
   * Clean up all created test data
   */
  async cleanup(): Promise<void> {
    console.log('🧹 Starting CI test cleanup...');

    // Clean up forms
    if (this.createdForms.length > 0) {
      console.log(`Cleaning up ${this.createdForms.length} test forms...`);
      for (const formId of this.createdForms) {
        try {
          // Find a user token that has access to this form
          for (const testUser of this.createdUsers) {
            try {
              await this.formTestUtils.deleteForm(testUser.token, formId);
              console.log(`✅ Deleted form: ${formId}`);
              break;
            } catch (error) {
              // Try next user
              continue;
            }
          }
        } catch (error: any) {
          console.warn(`Failed to delete form ${formId}: ${error.message}`);
        }
      }
    }

    // Sign out all test users
    if (this.createdUsers.length > 0) {
      console.log(`Signing out ${this.createdUsers.length} test users...`);
      for (const testUser of this.createdUsers) {
        try {
          await this.authUtils.signOut(testUser.token);
          console.log(`✅ Signed out user: ${testUser.user.email}`);
        } catch (error: any) {
          console.warn(`Failed to sign out user ${testUser.user.email}: ${error.message}`);
        }
      }
    }

    // Clear tracking arrays
    this.createdUsers = [];
    this.createdOrganizations = [];
    this.createdForms = [];

    console.log('✅ CI test cleanup completed');
  }

  /**
   * Get test configuration info for reporting
   */
  getConfigInfo(): string {
    return `
CI Test Configuration:
- Base URL: ${this.config.baseURL}
- Test Email: ${this.config.testEmail}
- Org Prefix: ${this.config.orgPrefix}
- CI Environment: ${this.config.isCIEnvironment}
- Created Users: ${this.createdUsers.length}
- Created Organizations: ${this.createdOrganizations.length}
- Created Forms: ${this.createdForms.length}
    `.trim();
  }
}

/**
 * Factory function to get the appropriate test utils based on environment
 */
export function getTestUtils(): CITestUtils | null {
  if (CITestUtils.isCIEnvironment()) {
    const config = CITestUtils.getCIConfig();
    return new CITestUtils(config);
  }
  return null;
}

/**
 * Helper function to check if current environment supports CI testing
 */
export function isCITestingEnabled(): boolean {
  return CITestUtils.isCIEnvironment() &&
         !!process.env.TEST_BASE_URL &&
         !!process.env.TEST_EMAIL;
}