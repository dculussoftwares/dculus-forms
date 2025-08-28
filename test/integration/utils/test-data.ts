// Use crypto.randomUUID for Node 14.17+ instead of nanoid to avoid ES module issues
const generateId = (): string => {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
};

export interface TestUser {
  email: string;
  password: string;
  name: string;
}

export interface TestOrganization {
  name: string;
  slug: string;
}

export interface TestUserWithOrganization extends TestUser {
  organizationName: string;
}

export interface SuperAdminTestUser extends TestUser {
  role: 'superAdmin';
}

/**
 * Generate a random test user with unique email
 */
export function generateTestUser(prefix: string = 'testuser'): TestUser {
  const uniqueId = generateId().toLowerCase();
  return {
    email: `${prefix}-${uniqueId}@example.com`,
    password: 'TestPassword123!',
    name: `Test User ${uniqueId}`,
  };
}

/**
 * Generate a random test organization
 */
export function generateTestOrganization(prefix: string = 'testorg'): TestOrganization {
  const uniqueId = generateId().toLowerCase();
  const name = `Test Organization ${uniqueId}`;
  return {
    name,
    slug: name
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, ''),
  };
}

/**
 * Generate a complete test user with organization
 */
export function generateTestUserWithOrganization(
  userPrefix: string = 'testuser',
  orgPrefix: string = 'testorg'
): TestUserWithOrganization {
  const user = generateTestUser(userPrefix);
  const org = generateTestOrganization(orgPrefix);
  
  return {
    ...user,
    organizationName: org.name,
  };
}

/**
 * Generate multiple test users
 */
export function generateTestUsers(count: number, prefix: string = 'testuser'): TestUser[] {
  return Array.from({ length: count }, (_, index) => 
    generateTestUser(`${prefix}-${index + 1}`)
  );
}

/**
 * Generate a test user for specific test scenarios
 */
export function generateTestUserForScenario(scenario: string): TestUserWithOrganization {
  const cleanScenario = scenario.toLowerCase().replace(/\s+/g, '-');
  return generateTestUserWithOrganization(
    `test-${cleanScenario}`,
    `org-${cleanScenario}`
  );
}

/**
 * Generate a super admin test user
 */
export function generateSuperAdminTestUser(prefix: string = 'superadmin'): SuperAdminTestUser {
  const user = generateTestUser(prefix);
  return {
    ...user,
    role: 'superAdmin' as const,
  };
}

/**
 * Generate default super admin credentials (for testing setup script)
 */
export function getDefaultSuperAdminCredentials(): SuperAdminTestUser {
  return {
    email: 'admin@dculus.com',
    password: 'admin123!@#',
    name: 'Super Administrator',
    role: 'superAdmin' as const,
  };
}

/**
 * Generate test super admin credentials with unique values
 */
export function generateTestSuperAdminCredentials(): SuperAdminTestUser {
  const uniqueId = generateId().toLowerCase();
  return {
    email: `test-admin-${uniqueId}@dculus.com`,
    password: 'TestAdminPassword123!',
    name: `Test Super Admin ${uniqueId}`,
    role: 'superAdmin' as const,
  };
}

// Common test data constants
export const TEST_CONFIG = {
  // Default test environment configuration
  BASE_URL: process.env.TEST_BASE_URL || 'http://localhost:4000',
  
  // Common test passwords
  DEFAULT_PASSWORD: 'TestPassword123!',
  WEAK_PASSWORD: 'weak',
  STRONG_PASSWORD: 'StrongP@ssw0rd123!',
  
  // Test timeouts
  AUTH_TIMEOUT: 5000,
  API_TIMEOUT: 10000,
  
  // Test data cleanup
  CLEANUP_ENABLED: process.env.TEST_CLEANUP !== 'false',
  
  // Common test organization names
  DEFAULT_ORG_NAME: 'Test Organization',
  PREMIUM_ORG_NAME: 'Premium Test Organization',
  ENTERPRISE_ORG_NAME: 'Enterprise Test Organization',
  
  // Admin test configuration
  ADMIN_ROLES: ['admin', 'superAdmin'] as const,
  DEFAULT_ADMIN_EMAIL: 'admin@dculus.com',
  DEFAULT_ADMIN_PASSWORD: 'admin123!@#',
  TEST_ADMIN_EMAIL: 'test-admin@dculus.com',
  TEST_ADMIN_PASSWORD: 'TestAdminPassword123!',
} as const;

/**
 * Validate email format for tests
 */
export function isValidTestEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate password strength for tests
 */
export function isValidTestPassword(password: string): boolean {
  // At least 8 characters, includes uppercase, lowercase, number, and special char
  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
  return passwordRegex.test(password);
}

/**
 * Generate test data for GraphQL mutations
 */
export function generateFormTestData() {
  const uniqueId = generateId().toLowerCase();
  return {
    title: `Test Form ${uniqueId}`,
    description: `This is a test form created for integration testing - ${uniqueId}`,
    isPublic: false,
    settings: {
      allowMultipleResponses: true,
      requireAuth: false,
      collectEmail: true,
    },
  };
}

/**
 * Generate test response data
 */
export function generateResponseTestData() {
  const uniqueId = generateId().toLowerCase();
  return {
    data: {
      name: `Test Responder ${uniqueId}`,
      email: `responder-${uniqueId}@example.com`,
      message: `This is a test response - ${uniqueId}`,
    },
    metadata: {
      userAgent: 'Integration Test Agent',
      ip: '127.0.0.1',
      timestamp: new Date().toISOString(),
    },
  };
}

// Export commonly used test data
export const COMMON_TEST_DATA = {
  users: {
    admin: generateTestUser('admin'),
    member: generateTestUser('member'),
    viewer: generateTestUser('viewer'),
  },
  organizations: {
    primary: generateTestOrganization('primary'),
    secondary: generateTestOrganization('secondary'),
  },
} as const;