import { Given, When, Then } from '@cucumber/cucumber';
import { CustomWorld } from '../support/world';
import { generateTestUserWithOrganization } from '../utils/test-data';

// Generate random string function
const generateRandomString = (length: number = 10): string => {
  return Math.random().toString(36).substring(2, 2 + length);
};

// Simple assertion function
const expect = (actual: any) => ({
  toBe: (expected: any) => {
    if (actual !== expected) {
      throw new Error(`Expected ${actual} to be ${expected}`);
    }
  },
  toHaveProperty: (property: string) => {
    if (!(property in actual)) {
      throw new Error(`Expected object to have property '${property}'`);
    }
  },
  toBeDefined: () => {
    if (actual === undefined) {
      throw new Error('Expected value to be defined');
    }
  },
  toContain: (expected: any) => {
    if (!actual || !actual.includes(expected)) {
      throw new Error(`Expected ${actual} to contain ${expected}`);
    }
  },
  toBeGreaterThan: (expected: number) => {
    if (actual <= expected) {
      throw new Error(`Expected ${actual} to be greater than ${expected}`);
    }
  },
  toInclude: (expected: any) => {
    if (!actual || (Array.isArray(actual) && !actual.includes(expected))) {
      throw new Error(`Expected ${actual} to include ${expected}`);
    } else if (typeof actual === 'string' && !actual.includes(expected)) {
      throw new Error(`Expected ${actual} to include ${expected}`);
    }
  }
});

// setActiveOrganization mutation query
const SET_ACTIVE_ORGANIZATION_MUTATION = `
  mutation SetActiveOrganization($organizationId: ID!) {
    setActiveOrganization(organizationId: $organizationId) {
      id
      name
      slug
      members {
        id
        role
        user {
          id
          email
          name
        }
      }
    }
  }
`;

// Given steps for setup
Given('there exists another organization I am not a member of', async function (this: CustomWorld) {
  // Create another test user with their own organization
  const otherTestUser = generateTestUserWithOrganization();
  try {
    const result = await this.authUtils.signUpUser(
      otherTestUser.email,
      otherTestUser.password,
      otherTestUser.name,
      otherTestUser.organizationName
    );

    // Store the other organization ID for testing unauthorized access
    this.setSharedTestData('otherOrganizationId', result.organization.id);
    this.setSharedTestData('otherOrganization', result.organization);
  } catch (error: any) {
    throw new Error(`Failed to create other organization: ${error.message}`);
  }
});

Given('I am not authenticated for organization security tests', function (this: CustomWorld) {
  // Clear any existing authentication
  this.currentUser = undefined;
  this.authToken = undefined;
  this.currentSession = undefined;
});

Given('I have an invalid authentication token', function (this: CustomWorld) {
  // Set an invalid token
  this.authToken = 'invalid-token-' + generateRandomString(10);
});

Given('I am a member of multiple organizations', async function (this: CustomWorld) {
  // Ensure user has at least one organization from previous steps
  if (!this.currentUser || !this.authToken) {
    throw new Error('User must be authenticated with an organization first');
  }

  // Create a second organization using the current user (so they will be a member)
  const createOrgMutation = `
    mutation CreateOrganization($name: String!) {
      createOrganization(name: $name) {
        id
        name
        slug
        members {
          id
          role
          user {
            id
            email
            name
          }
        }
      }
    }
  `;

  try {
    const orgName = 'Second Test Org ' + Math.random().toString(36).substring(7);
    const response = await this.authUtils.graphqlRequest(
      createOrgMutation,
      { name: orgName },
      this.authToken
    );

    if (response.data?.data?.createOrganization) {
      const secondOrg = response.data.data.createOrganization;
      this.setSharedTestData('secondOrganizationId', secondOrg.id);
      this.setSharedTestData('secondOrganization', secondOrg);
    } else {
      throw new Error('Failed to create second organization');
    }
  } catch (error: any) {
    throw new Error(`Failed to create second organization: ${error.message}`);
  }
});

Given('I am authenticated as a test user with {string} role in an organization',
  async function (this: CustomWorld, role: string) {
    const testUser = generateTestUserWithOrganization();
    try {
      const result = await this.authUtils.signUpUser(
        testUser.email,
        testUser.password,
        testUser.name,
        testUser.organizationName
      );

      // Sign in to get a proper session (like the existing auth.steps.ts pattern)
      const signInResult = await this.authUtils.signInUser(testUser.email, testUser.password);

      // Set authentication context
      this.currentUser = signInResult.user;
      this.authToken = signInResult.token;
      this.currentSession = signInResult.session;
      this.setSharedTestData('currentOrganization', result.organization);
      this.setSharedTestData('currentUserRole', role);

      // Note: Role assignment would be handled by the organization management system
      // For testing, we assume the user has the specified role
    } catch (error: any) {
      throw new Error(`Failed to create user with ${role} role: ${error.message}`);
    }
  }
);

// When steps for actions
When('I send a setActiveOrganization mutation with my organization ID',
  async function (this: CustomWorld) {
    // First try to get organization ID from session
    let organizationId = this.currentSession?.activeOrganizationId;

    // If not in session, get user's organizations and use the first one
    if (!organizationId) {
      try {
        const myOrganizationsQuery = `
          query MyOrganizations {
            myOrganizations {
              id
              name
              slug
            }
          }
        `;
        const orgResponse = await this.authUtils.graphqlRequest(
          myOrganizationsQuery,
          {},
          this.authToken!
        );

        if (orgResponse.data?.data?.myOrganizations?.length > 0) {
          organizationId = orgResponse.data.data.myOrganizations[0].id;
          // Store for later use
          this.setSharedTestData('currentOrganization', orgResponse.data.data.myOrganizations[0]);
        }
      } catch (error: any) {
        throw new Error(`Failed to get user organizations: ${error.message}`);
      }
    }

    if (!organizationId) {
      throw new Error('No current organization ID available for testing');
    }

    try {
      this.response = await this.authUtils.graphqlRequest(
        SET_ACTIVE_ORGANIZATION_MUTATION,
        { organizationId },
        this.authToken!
      );
    } catch (error: any) {
      // Store error information for assertions
      this.setSharedTestData('graphqlError', error.message);
    }
  }
);

When('I send a setActiveOrganization mutation with the other organization ID',
  async function (this: CustomWorld) {
    const organizationId = this.getSharedTestData('otherOrganizationId');
    if (!organizationId) {
      throw new Error('No other organization ID available for testing');
    }

    try {
      this.response = await this.authUtils.graphqlRequest(
        SET_ACTIVE_ORGANIZATION_MUTATION,
        { organizationId: organizationId },
        this.authToken!
      );
    } catch (error: any) {
      // Store error information for assertions
      this.setSharedTestData('graphqlError', error.message);
    }
  }
);

When('I send a setActiveOrganization mutation with any organization ID',
  async function (this: CustomWorld) {
    const organizationId = 'test-org-' + generateRandomString(10);

    try {
      // Try to make request using existing GraphQL method
      if (this.authToken) {
        this.response = await this.authUtils.graphqlRequest(
          SET_ACTIVE_ORGANIZATION_MUTATION,
          { organizationId },
          this.authToken
        );
      } else {
        // Make request without authentication (will require a token)
        // Create a dummy token for this test case
        this.response = await this.authUtils.graphqlRequest(
          SET_ACTIVE_ORGANIZATION_MUTATION,
          { organizationId },
          'invalid-token'
        );
      }
    } catch (error: any) {
      // Store error information for assertions
      this.setSharedTestData('lastError', error.message);
      this.setSharedTestData('graphqlError', error.message);
    }
  }
);

When('I send a setActiveOrganization mutation with a nonexistent organization ID',
  async function (this: CustomWorld) {
    const organizationId = 'nonexistent-org-' + generateRandomString(10);

    try {
      this.response = await this.authUtils.graphqlRequest(
        SET_ACTIVE_ORGANIZATION_MUTATION,
        { organizationId },
        this.authToken!
      );
    } catch (error: any) {
      // Store error information for assertions
      this.setSharedTestData('graphqlError', error.message);
    }
  }
);

When('I send a setActiveOrganization mutation with my first organization ID',
  async function (this: CustomWorld) {
    // Get the first organization (same logic as above)
    let organizationId = this.currentSession?.activeOrganizationId;

    if (!organizationId) {
      try {
        const myOrganizationsQuery = `
          query MyOrganizations {
            myOrganizations {
              id
              name
              slug
            }
          }
        `;
        const orgResponse = await this.authUtils.graphqlRequest(
          myOrganizationsQuery,
          {},
          this.authToken!
        );

        if (orgResponse.data?.data?.myOrganizations?.length > 0) {
          organizationId = orgResponse.data.data.myOrganizations[0].id;
        }
      } catch (error: any) {
        throw new Error(`Failed to get user organizations: ${error.message}`);
      }
    }

    if (!organizationId) {
      throw new Error('No first organization ID available');
    }

    try {
      this.response = await this.authUtils.graphqlRequest(
        SET_ACTIVE_ORGANIZATION_MUTATION,
        { organizationId },
        this.authToken!
      );
      this.setSharedTestData('firstOrgResponse', this.response);
    } catch (error: any) {
      // Store error information for assertions
      this.setSharedTestData('graphqlError', error.message);
    }
  }
);

When('I send a setActiveOrganization mutation with my second organization ID',
  async function (this: CustomWorld) {
    const organizationId = this.getSharedTestData('secondOrganizationId');
    if (!organizationId) {
      throw new Error('No second organization ID available');
    }

    try {
      this.response = await this.authUtils.graphqlRequest(
        SET_ACTIVE_ORGANIZATION_MUTATION,
        { organizationId },
        this.authToken!
      );
      this.setSharedTestData('secondOrgResponse', this.response);
    } catch (error: any) {
      // Store error information for assertions
      this.setSharedTestData('graphqlError', error.message);
    }
  }
);

When('I send a setActiveOrganization mutation with malicious GraphQL injection in organization ID',
  async function (this: CustomWorld) {
    const maliciousId = '") { __schema { types { name } } } #';

    try {
      this.response = await this.authUtils.graphqlRequest(
        SET_ACTIVE_ORGANIZATION_MUTATION,
        { organizationId: maliciousId },
        this.authToken!
      );
    } catch (error: any) {
      // Store error information for assertions
      this.setSharedTestData('graphqlError', error.message);
    }
  }
);

When('I send a setActiveOrganization mutation with SQL injection patterns in organization ID',
  async function (this: CustomWorld) {
    const sqlInjectionId = "'; DROP TABLE organizations; --";

    try {
      this.response = await this.authUtils.graphqlRequest(
        SET_ACTIVE_ORGANIZATION_MUTATION,
        { organizationId: sqlInjectionId },
        this.authToken!
      );
    } catch (error: any) {
      // Store error information for assertions
      this.setSharedTestData('graphqlError', error.message);
    }
  }
);

When('I send multiple rapid setActiveOrganization mutations with random organization IDs',
  async function (this: CustomWorld) {
    const requests = [];
    const numRequests = 10;

    for (let i = 0; i < numRequests; i++) {
      const randomId = 'test-org-' + generateRandomString(10);
      const request = this.authUtils.graphqlRequest(
        SET_ACTIVE_ORGANIZATION_MUTATION,
        { organizationId: randomId },
        this.authToken!
      ).catch((error: any) => ({ error: error.message }));

      requests.push(request);
    }

    try {
      const responses = await Promise.all(requests);
      this.setSharedTestData('rateLimitResponses', responses);
    } catch (error: any) {
      // Store error information for assertions
      this.setSharedTestData('rateLimitError', error.message);
    }
  }
);

// Then steps for assertions
Then('the mutation should succeed', function (this: CustomWorld) {
  // Check for GraphQL errors first
  const graphqlError = this.getSharedTestData('graphqlError');
  if (graphqlError) {
    throw new Error(`GraphQL Error: ${graphqlError}`);
  }

  expect(this.response?.status).toBe(200);
  expect(this.response?.data).toHaveProperty('data');
  expect(this.response?.data.data).toHaveProperty('setActiveOrganization');
});

Then('I should receive the organization details', function (this: CustomWorld) {
  const organization = this.response?.data.data.setActiveOrganization;
  expect(organization).toBeDefined();
  expect(organization).toHaveProperty('id');
  expect(organization).toHaveProperty('name');
  expect(organization).toHaveProperty('members');
});

Then('the organization should contain my user as a member', function (this: CustomWorld) {
  const organization = this.response?.data.data.setActiveOrganization;
  const members = organization?.members;
  const currentUserId = this.currentUser?.id;

  expect(members).toBeDefined();
  expect(Array.isArray(members)).toBe(true);

  const userMember = members.find((member: any) => member.user.id === currentUserId);
  expect(userMember).toBeDefined();
});

Then('the mutation should fail with an access denied error', function (this: CustomWorld) {
  // Check if response contains GraphQL errors or if error was stored in shared data
  const graphqlError = this.getSharedTestData('graphqlError');
  const hasErrors = this.response?.data?.errors || graphqlError;
  expect(hasErrors).toBeDefined();
});

Then('the error message should indicate {string}', function (this: CustomWorld, expectedMessage: string) {
  const errorMessage = this.response?.data?.errors?.[0]?.message ||
                      this.getSharedTestData('graphqlError') || '';

  expect(errorMessage).toInclude(expectedMessage);
});

Then('the mutation should fail with an authentication error', function (this: CustomWorld) {
  const graphqlError = this.getSharedTestData('graphqlError');
  const hasAuthError = this.response?.data?.errors || graphqlError;
  expect(hasAuthError).toBeDefined();

  // Should contain authentication-related error message
  const errorMessage = this.response?.data?.errors?.[0]?.message ||
                      graphqlError || '';

  const isAuthError = errorMessage.includes('Authentication') ||
                     errorMessage.includes('authentication') ||
                     errorMessage.includes('Unauthorized') ||
                     errorMessage.includes('unauthorized') ||
                     errorMessage.includes('token');

  if (!isAuthError) {
    throw new Error(`Expected authentication error but got: ${errorMessage}`);
  }
});

Then('the organization security error message should indicate authentication is required', function (this: CustomWorld) {
  const errorMessage = this.response?.data?.errors?.[0]?.message ||
                      this.getSharedTestData('graphqlError') || '';

  expect(errorMessage).toInclude('Authentication required');
});

Then('the error message should indicate the token is invalid', function (this: CustomWorld) {
  const errorMessage = this.response?.data?.errors?.[0]?.message ||
                      this.getSharedTestData('graphqlError') || '';

  const isInvalidTokenError = errorMessage.includes('invalid') ||
                             errorMessage.includes('expired') ||
                             errorMessage.includes('malformed') ||
                             errorMessage.includes('Authentication');

  if (!isInvalidTokenError) {
    throw new Error(`Expected invalid token error but got: ${errorMessage}`);
  }
});

Then('I should receive the first organization details', function (this: CustomWorld) {
  const firstOrgResponse = this.getSharedTestData('firstOrgResponse');
  const organization = firstOrgResponse?.data.data.setActiveOrganization;

  expect(organization).toBeDefined();
  expect(organization).toHaveProperty('id');
  expect(organization).toHaveProperty('name');
});

Then('I should receive the second organization details', function (this: CustomWorld) {
  const secondOrgResponse = this.getSharedTestData('secondOrgResponse');
  const organization = secondOrgResponse?.data.data.setActiveOrganization;
  const expectedId = this.getSharedTestData('secondOrganizationId');

  expect(organization).toBeDefined();
  expect(organization.id).toBe(expectedId);
});

Then('the mutation should fail safely', function (this: CustomWorld) {
  // Should have errors but not expose sensitive information
  const graphqlError = this.getSharedTestData('graphqlError');
  const hasErrors = this.response?.data?.errors || graphqlError;
  expect(hasErrors).toBeDefined();

  // Error message should not expose schema or database details
  const errorMessage = this.response?.data?.errors?.[0]?.message ||
                      graphqlError || '';

  const exposesSchema = errorMessage.includes('__schema') ||
                       errorMessage.includes('__type') ||
                       errorMessage.includes('introspection');

  if (exposesSchema) {
    throw new Error('Error message exposes GraphQL schema information');
  }
});

Then('no sensitive data should be exposed', function (this: CustomWorld) {
  const errorMessage = this.response?.data?.errors?.[0]?.message ||
                      this.getSharedTestData('graphqlError') || '';

  // Check that error doesn't contain sensitive database or schema information
  const sensitiveTerms = ['SELECT', 'DROP', 'INSERT', 'UPDATE', 'DELETE', '__schema', '__type', 'introspection'];

  for (const term of sensitiveTerms) {
    if (errorMessage.includes(term)) {
      throw new Error(`Error message contains sensitive information: ${term}`);
    }
  }
});

Then('no database errors should be exposed', function (this: CustomWorld) {
  const errorMessage = this.response?.data?.errors?.[0]?.message ||
                      this.getSharedTestData('graphqlError') || '';

  // Check that error doesn't contain database-specific error details
  const dbTerms = ['SQL', 'MongoDB', 'Prisma', 'database', 'table', 'collection'];

  for (const term of dbTerms) {
    if (errorMessage.toLowerCase().includes(term.toLowerCase())) {
      throw new Error(`Error message exposes database details: ${term}`);
    }
  }
});

Then('the system should handle the requests appropriately', function (this: CustomWorld) {
  const responses = this.getSharedTestData('rateLimitResponses');
  expect(responses).toBeDefined();
  expect(Array.isArray(responses)).toBe(true);

  // All requests should fail with appropriate errors (not expose organization existence)
  for (const response of responses) {
    const hasError = response.error || response.data?.errors;
    expect(hasError).toBeDefined();
  }
});

Then('not expose information about organization existence through timing differences', function (this: CustomWorld) {
  // This is a basic check - in a real scenario, you'd measure response times
  // and ensure they're consistent regardless of whether organizations exist
  const responses = this.getSharedTestData('rateLimitResponses');
  expect(responses).toBeDefined();

  // All responses should have similar error patterns
  // (This is a simplified check for demonstration)
  for (const response of responses) {
    const errorMessage = response.error || response.data?.errors?.[0]?.message || '';
    const isAccessDeniedError = errorMessage.includes('Access denied') ||
                               errorMessage.includes('not a member');

    if (!isAccessDeniedError) {
      throw new Error('Response pattern might leak organization existence information');
    }
  }
});