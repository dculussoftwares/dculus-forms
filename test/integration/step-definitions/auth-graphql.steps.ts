import { Given, When, Then } from '@cucumber/cucumber';
import { CustomWorld } from '../support/world';
import { generateTestUserWithOrganization } from '../utils/test-data';

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
  }
});

Given('I create and authenticate a test user', async function (this: CustomWorld) {
  try {
    console.log('Creating test user...');
    const testUser = generateTestUserWithOrganization();
    
    // Sign up user
    const signUpResult = await this.authUtils.signUpUser(
      testUser.email,
      testUser.password,
      testUser.name,
      testUser.organizationName
    );
    console.log('User created:', signUpResult.user.email);
    
    // Sign in to get session
    const signInResult = await this.authUtils.signInUser(
      testUser.email,
      testUser.password
    );
    console.log('User authenticated with token:', signInResult.token.substring(0, 10) + '...');
    
    // Set auth context
    (this as any).setAuthContext(signInResult.user, signInResult.session, signInResult.token);
    
    // Store for verification
    (this as any).originalTestUser = testUser;
    
  } catch (error: any) {
    console.error('Failed to create and authenticate user:', error.message);
    throw error;
  }
});

When('I send an authenticated GraphQL query to get my user information', async function (this: CustomWorld) {
  const query = `
    query Me {
      me {
        id
        email
        name
        createdAt
        updatedAt
      }
    }
  `;
  
  try {
    console.log('Sending authenticated GraphQL query...');
    this.response = await (this as any).authenticatedGraphQLRequest(query);
    console.log('GraphQL response status:', this.response?.status);
  } catch (error: any) {
    console.error('GraphQL query failed:', error.message);
    (this as any).graphqlError = error.message;
    throw error;
  }
});

Then('I should receive my user data successfully', function (this: CustomWorld) {
  expect(this.response?.status).toBe(200);
  expect(this.response?.data).toHaveProperty('data');
  expect(this.response?.data.data).toHaveProperty('me');
  
  const userData = this.response?.data.data.me;
  expect(userData).toBeDefined();
  expect(userData).toHaveProperty('id');
  expect(userData).toHaveProperty('email');
  expect(userData).toHaveProperty('name');
  
  console.log('✅ Received user data:', userData.email);
});

Then('the user data should match my authenticated user', function (this: CustomWorld) {
  const userData = this.response?.data.data.me;
  const originalTestUser = (this as any).originalTestUser;
  
  expect(userData.email).toBe(originalTestUser.email);
  expect(userData.name).toBe(originalTestUser.name);
  expect(userData.email).toBe(this.currentUser?.email);
  expect(userData.name).toBe(this.currentUser?.name);
  
  console.log('✅ User data matches authenticated user');
});

When('I send a GraphQL query without authentication token', async function (this: CustomWorld) {
  const query = `
    query Me {
      me {
        id
        email
        name
      }
    }
  `;
  
  try {
    console.log('Sending unauthenticated GraphQL query...');
    // Use regular axios without auth token
    this.response = await this.authUtils.axiosInstance.post('/graphql', {
      query
    });
  } catch (error: any) {
    // Store the error response for verification
    console.log('Expected authentication error occurred');
    this.response = error.response;
  }
});

Then('I should receive a GraphQL authentication error', function (this: CustomWorld) {
  // For GraphQL, authentication errors can come in different forms:
  // 1. HTTP 401/403 status code
  // 2. HTTP 200 with GraphQL errors array
  expect(this.response).toBeDefined();

  if (this.response?.status === 200) {
    // Check for GraphQL errors in response
    expect(this.response.data).toHaveProperty('errors');
    const errors = this.response.data.errors;
    expect(errors.length).toBeGreaterThan(0);

    // Verify the error message contains authentication-related keywords
    const errorMessage = errors[0].message.toLowerCase();
    const isAuthError = errorMessage.includes('authentication') ||
                       errorMessage.includes('unauthorized') ||
                       errorMessage.includes('required');

    if (!isAuthError) {
      throw new Error(`Expected authentication error, but got: ${errors[0].message}`);
    }

    console.log('✅ Received expected authentication error:', errors[0].message);
  } else if (this.response?.status === 401 || this.response?.status === 403) {
    // HTTP-level authentication error
    console.log('✅ Received HTTP authentication error:', this.response.status);
  } else {
    throw new Error(`Expected authentication error, but got status: ${this.response?.status}`);
  }
});