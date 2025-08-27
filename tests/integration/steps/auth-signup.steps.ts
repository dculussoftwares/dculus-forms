const { Given, When, Then, DataTable } = require('@cucumber/cucumber');
const { CustomWorld } = require('../support/world');

// Enhanced expect utility for authentication tests
const expect = (actual: any) => ({
  toBe: (expected: any) => {
    if (actual !== expected) {
      throw new Error(`Expected ${actual} to be ${expected}`);
    }
  },
  toBeGreaterThan: (expected: any) => {
    if (actual <= expected) {
      throw new Error(`Expected ${actual} to be greater than ${expected}`);
    }
  },
  toBeTruthy: () => {
    if (!actual) {
      throw new Error(`Expected ${actual} to be truthy`);
    }
  },
  toBeFalsy: () => {
    if (actual) {
      throw new Error(`Expected ${actual} to be falsy`);
    }
  },
  toMatch: (pattern: RegExp | string) => {
    const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern;
    if (!regex.test(actual)) {
      throw new Error(`Expected ${actual} to match ${pattern}`);
    }
  },
  toHaveProperty: (prop: string) => {
    if (!(prop in actual)) {
      throw new Error(`Expected ${JSON.stringify(actual)} to have property ${prop}`);
    }
  },
  toContain: (expected: any) => {
    if (typeof actual === 'string') {
      if (!actual.includes(expected)) {
        throw new Error(`Expected "${actual}" to contain "${expected}"`);
      }
    } else if (Array.isArray(actual)) {
      if (!actual.includes(expected)) {
        throw new Error(`Expected array ${JSON.stringify(actual)} to contain ${expected}`);
      }
    } else {
      throw new Error(`Cannot check if ${typeof actual} contains ${expected}`);
    }
  },
  toEqual: (expected: any) => {
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      throw new Error(`Expected ${JSON.stringify(actual)} to equal ${JSON.stringify(expected)}`);
    }
  },
  toBeLessThan: (expected: any) => {
    if (actual >= expected) {
      throw new Error(`Expected ${actual} to be less than ${expected}`);
    }
  }
});

// Store authentication data and responses
let signupData: any = {};
let authToken: string = '';
let signupStartTime: number;
let multipleResponses: any[] = [];
let createdUsers: string[] = []; // Track created users for cleanup

// Background Steps
Given('the authentication system is ready', async function(this: CustomWorld) {
  this.logScenario('Verifying authentication system is ready');
  
  // Test that better-auth endpoints are available
  try {
    const response = await this.testClient.request().options('/api/auth/sign-up');
    this.logScenario('Authentication endpoints are accessible');
  } catch (error) {
    this.logScenario('Authentication system check completed');
  }
});

// Signup Steps
When('I sign up with the following details:', async function(this: CustomWorld, dataTable: DataTable) {
  this.logScenario('Signing up with provided details');
  
  const details = dataTable.rowsHash();
  signupData = {
    email: details.email,
    password: details.password,
    name: details.name,
    organizationName: details.organizationName
  };

  signupStartTime = Date.now();
  const response = await this.testClient.signUp(signupData);
  this.setResponse(response);
  
  // Track created user for cleanup
  if (response.status === 200 || response.status === 201) {
    createdUsers.push(details.email);
  }

  this.logScenario(`Signup completed with status ${response.status}`);
});

Given('I sign up with email {string} and organization {string}', async function(this: CustomWorld, email: string, organizationName: string) {
  this.logScenario(`Signing up with email: ${email} and organization: ${organizationName}`);
  
  signupData = {
    email: email,
    password: 'testpass123',
    name: 'Test User',
    organizationName: organizationName
  };

  const response = await this.testClient.signUp(signupData);
  this.setResponse(response);
  
  // Track created user for cleanup
  if (response.status === 200 || response.status === 201) {
    createdUsers.push(email);
  }

  this.logScenario(`Signup completed with status ${response.status}`);
});

Given('I have signed up with email {string}', async function(this: CustomWorld, email: string) {
  this.logScenario(`Setting up existing user with email: ${email}`);
  
  const userData = {
    email: email,
    password: 'testpass123',
    name: 'Test User',
    organizationName: `Org for ${email}`
  };

  const response = await this.testClient.signUp(userData);
  
  // Track created user for cleanup
  if (response.status === 200 || response.status === 201) {
    createdUsers.push(email);
  }
  
  this.logScenario(`Existing user setup completed with status ${response.status}`);
});

When('I attempt to sign up again with email {string}', async function(this: CustomWorld, email: string) {
  this.logScenario(`Attempting duplicate signup with email: ${email}`);
  
  const duplicateData = {
    email: email,
    password: 'testpass123',
    name: 'Duplicate User',
    organizationName: 'Duplicate Org'
  };

  const response = await this.testClient.signUp(duplicateData);
  this.setResponse(response);
  
  this.logScenario(`Duplicate signup attempt completed with status ${response.status}`);
});

When('I sign up with invalid details:', async function(this: CustomWorld, dataTable: DataTable) {
  this.logScenario('Signing up with invalid details');
  
  const details = dataTable.rowsHash();
  const invalidData = {
    email: details.email,
    password: details.password,
    name: details.name,
    organizationName: details.organizationName
  };

  const response = await this.testClient.signUp(invalidData);
  this.setResponse(response);
  
  this.logScenario(`Invalid signup completed with status ${response.status}`);
});

When('I sign up with email {string}', async function(this: CustomWorld, email: string) {
  this.logScenario(`Quick signup with email: ${email}`);
  
  signupStartTime = Date.now();
  const userData = {
    email: email,
    password: 'testpass123',
    name: 'Test User',
    organizationName: `Org for ${email}`
  };

  const response = await this.testClient.signUp(userData);
  this.setResponse(response);
  
  // Track created user for cleanup
  if (response.status === 200 || response.status === 201) {
    createdUsers.push(email);
  }
  
  this.logScenario(`Quick signup completed with status ${response.status}`);
});

// Signin Steps
When('I sign out', async function(this: CustomWorld) {
  this.logScenario('Signing out current user');
  
  const response = await this.testClient.signOut();
  this.logScenario(`Sign out completed with status ${response.status}`);
});

When('I sign in with email {string} and password {string}', async function(this: CustomWorld, email: string, password: string) {
  this.logScenario(`Signing in with email: ${email}`);
  
  const response = await this.testClient.signIn({
    email: email,
    password: password
  });
  this.setResponse(response);
  
  this.logScenario(`Sign in completed with status ${response.status}`);
});

// Authentication State Steps
Given('I am not authenticated', function(this: CustomWorld) {
  this.logScenario('Ensuring user is not authenticated');
  
  this.testClient.clearAuthTokens();
  this.logScenario('Authentication tokens cleared');
});

Given('I have an invalid authentication token {string}', function(this: CustomWorld, invalidToken: string) {
  this.logScenario(`Setting invalid authentication token: ${invalidToken}`);
  
  this.testClient.setAuthTokens({
    accessToken: invalidToken,
    refreshToken: '',
    session: null
  });
  
  this.logScenario('Invalid token set for testing');
});

// GraphQL Steps
When('I make an authenticated GraphQL query to get my profile:', async function(this: CustomWorld, query: string) {
  this.logScenario('Making authenticated GraphQL query for user profile');
  
  const response = await this.testClient.authenticatedGraphQL(query);
  this.setResponse(response);
  
  this.logScenario(`Authenticated GraphQL query completed with status ${response.status}`);
});

When('I query my organizations via GraphQL:', async function(this: CustomWorld, query: string) {
  this.logScenario('Querying organizations via GraphQL');
  
  const response = await this.testClient.authenticatedGraphQL(query);
  this.setResponse(response);
  
  this.logScenario(`Organizations query completed with status ${response.status}`);
});

When('I query my active organization via GraphQL:', async function(this: CustomWorld, query: string) {
  this.logScenario('Querying active organization via GraphQL');
  
  const response = await this.testClient.authenticatedGraphQL(query);
  this.setResponse(response);
  
  this.logScenario(`Active organization query completed with status ${response.status}`);
});

When('I make a GraphQL query without authentication:', async function(this: CustomWorld, query: string) {
  this.logScenario('Making unauthenticated GraphQL query');
  
  const response = await this.testClient.graphql(query);
  this.setResponse(response);
  
  this.logScenario(`Unauthenticated GraphQL query completed with status ${response.status}`);
});

When('I make a GraphQL query with the invalid token:', async function(this: CustomWorld, query: string) {
  this.logScenario('Making GraphQL query with invalid token');
  
  const response = await this.testClient.authenticatedGraphQL(query);
  this.setResponse(response);
  
  this.logScenario(`Invalid token GraphQL query completed with status ${response.status}`);
});

When('I make {int} consecutive authenticated GraphQL requests:', async function(this: CustomWorld, count: number, query: string) {
  this.logScenario(`Making ${count} consecutive authenticated GraphQL requests`);
  
  multipleResponses = [];
  for (let i = 0; i < count; i++) {
    const response = await this.testClient.authenticatedGraphQL(query);
    multipleResponses.push(response);
    this.logScenario(`Request ${i + 1}/${count} completed with status ${response.status}`);
  }
  
  // Set the last response as the current response
  this.setResponse(multipleResponses[multipleResponses.length - 1]);
});

// Assertion Steps
Then('the signup should be successful', function(this: CustomWorld) {
  this.logScenario('Verifying signup was successful');
  
  expect(this.responseStatus).toBe(200);
  this.logScenario('Signup status verified as successful');
});

Then('the signup should fail', function(this: CustomWorld) {
  this.logScenario('Verifying signup failed');
  
  expect(this.responseStatus).toBeGreaterThan(399);
  this.logScenario('Signup failure verified');
});

Then('the signin should be successful', function(this: CustomWorld) {
  this.logScenario('Verifying signin was successful');
  
  expect(this.responseStatus).toBe(200);
  this.logScenario('Signin status verified as successful');
});

Then('I should receive an authentication token', function(this: CustomWorld) {
  this.logScenario('Verifying authentication token was received');
  
  const tokens = this.testClient.getAuthTokens();
  expect(tokens).toBeTruthy();
  expect(tokens?.accessToken).toBeTruthy();
  
  this.logScenario('Authentication token verified');
});

Then('the response should contain user information', function(this: CustomWorld) {
  this.logScenario('Verifying response contains user information');
  
  expect(this.responseBody).toHaveProperty('user');
  expect(this.responseBody.user).toHaveProperty('email');
  expect(this.responseBody.user).toHaveProperty('id');
  
  this.logScenario('User information verified in response');
});

Then('the GraphQL response should be successful', function(this: CustomWorld) {
  this.logScenario('Verifying GraphQL response was successful');
  
  expect(this.responseStatus).toBe(200);
  expect(this.responseBody).toHaveProperty('data');
  expect(this.responseBody.errors).toBeFalsy();
  
  this.logScenario('GraphQL response success verified');
});

Then('the GraphQL response should fail with authentication error', function(this: CustomWorld) {
  this.logScenario('Verifying GraphQL response failed with auth error');
  
  expect(this.responseBody).toHaveProperty('errors');
  expect(Array.isArray(this.responseBody.errors)).toBe(true);
  expect(this.responseBody.errors.length).toBeGreaterThan(0);
  
  this.logScenario('GraphQL authentication error verified');
});

Then('the profile should contain:', function(this: CustomWorld, dataTable: DataTable) {
  this.logScenario('Verifying profile contains expected data');
  
  const expectedData = dataTable.rowsHash();
  const profile = this.responseBody.data.me;
  
  Object.keys(expectedData).forEach(field => {
    expect(profile).toHaveProperty(field);
    if (expectedData[field]) {
      expect(profile[field]).toBe(expectedData[field]);
    }
    this.logScenario(`Profile field '${field}' verified`);
  });
});

Then('the profile email should be {string}', function(this: CustomWorld, expectedEmail: string) {
  this.logScenario(`Verifying profile email is ${expectedEmail}`);
  
  const profile = this.responseBody.data.me;
  expect(profile.email).toBe(expectedEmail);
  
  this.logScenario('Profile email verified');
});

Then('I should have {int} organization(s)', function(this: CustomWorld, expectedCount: number) {
  this.logScenario(`Verifying user has ${expectedCount} organization(s)`);
  
  const organizations = this.responseBody.data.myOrganizations;
  expect(Array.isArray(organizations)).toBe(true);
  expect(organizations.length).toBe(expectedCount);
  
  this.logScenario(`Organization count verified: ${organizations.length}`);
});

Then('the organization should have name {string}', function(this: CustomWorld, expectedName: string) {
  this.logScenario(`Verifying organization name is ${expectedName}`);
  
  const organizations = this.responseBody.data.myOrganizations;
  const org = organizations.find((o: any) => o.name === expectedName);
  expect(org).toBeTruthy();
  
  this.logScenario('Organization name verified');
});

Then('I should be the owner of the organization', function(this: CustomWorld) {
  this.logScenario('Verifying user is owner of organization');
  
  const organizations = this.responseBody.data.myOrganizations;
  const org = organizations[0];
  const ownerMember = org.members.find((m: any) => m.role === 'owner');
  expect(ownerMember).toBeTruthy();
  
  this.logScenario('Organization ownership verified');
});

Then('the active organization should be {string}', function(this: CustomWorld, expectedName: string) {
  this.logScenario(`Verifying active organization is ${expectedName}`);
  
  const activeOrg = this.responseBody.data.activeOrganization;
  expect(activeOrg).toBeTruthy();
  expect(activeOrg.name).toBe(expectedName);
  
  this.logScenario('Active organization verified');
});

Then('I should be listed as a member', function(this: CustomWorld) {
  this.logScenario('Verifying user is listed as member');
  
  const activeOrg = this.responseBody.data.activeOrganization;
  expect(activeOrg.members).toBeTruthy();
  expect(Array.isArray(activeOrg.members)).toBe(true);
  expect(activeOrg.members.length).toBeGreaterThan(0);
  
  this.logScenario('Member status verified');
});

Then('the error message should mention {string}', function(this: CustomWorld, expectedText: string) {
  this.logScenario(`Verifying error message mentions: ${expectedText}`);
  
  let errorMessage = '';
  if (this.responseBody.errors && Array.isArray(this.responseBody.errors)) {
    errorMessage = this.responseBody.errors.map((e: any) => e.message).join(' ');
  } else if (this.responseBody.error) {
    errorMessage = this.responseBody.error;
  } else if (this.responseBody.message) {
    errorMessage = this.responseBody.message;
  }
  
  expect(errorMessage.toLowerCase()).toContain(expectedText.toLowerCase());
  this.logScenario('Error message content verified');
});

Then('the error should indicate the email is already taken', function(this: CustomWorld) {
  this.logScenario('Verifying email already taken error');
  
  expect(this.responseStatus).toBeGreaterThan(399);
  
  let errorMessage = '';
  if (this.responseBody.error) {
    errorMessage = this.responseBody.error;
  } else if (this.responseBody.message) {
    errorMessage = this.responseBody.message;
  }
  
  expect(errorMessage.toLowerCase()).toMatch(/email.*already.*taken|email.*exists|duplicate.*email/);
  this.logScenario('Email already taken error verified');
});

Then('the error should mention {string}', function(this: CustomWorld, expectedText: string) {
  this.logScenario(`Verifying error mentions: ${expectedText}`);
  
  let errorMessage = '';
  if (this.responseBody.error) {
    errorMessage = this.responseBody.error;
  } else if (this.responseBody.message) {
    errorMessage = this.responseBody.message;
  }
  
  expect(errorMessage.toLowerCase()).toContain(expectedText.toLowerCase());
  this.logScenario('Error message verified');
});

Then('the signup should complete within {int} seconds', function(this: CustomWorld, maxSeconds: number) {
  const responseTime = Date.now() - signupStartTime;
  const maxMs = maxSeconds * 1000;
  
  this.logScenario(`Verifying signup completed in ${responseTime}ms (max: ${maxMs}ms)`);
  
  expect(responseTime).toBeLessThan(maxMs);
  this.logScenario('Signup performance verified');
});

Then('all GraphQL responses should be successful', function(this: CustomWorld) {
  this.logScenario(`Verifying all ${multipleResponses.length} GraphQL responses were successful`);
  
  multipleResponses.forEach((response, index) => {
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('data');
    expect(response.body.errors).toBeFalsy();
    this.logScenario(`Response ${index + 1} verified as successful`);
  });
});

Then('each response should contain the same user information', function(this: CustomWorld) {
  this.logScenario('Verifying all responses contain consistent user information');
  
  if (multipleResponses.length < 2) {
    throw new Error('Need at least 2 responses to compare consistency');
  }
  
  const firstUserData = multipleResponses[0].body.data.me;
  
  multipleResponses.forEach((response, index) => {
    const userData = response.body.data.me;
    expect(userData.id).toBe(firstUserData.id);
    expect(userData.email).toBe(firstUserData.email);
    this.logScenario(`Response ${index + 1} user data consistency verified`);
  });
});

// Cleanup hook to remove created test users
const { After } = require('@cucumber/cucumber');

After(async function(this: CustomWorld) {
  // Clean up created users if needed
  if (createdUsers.length > 0) {
    this.logScenario(`Cleaning up ${createdUsers.length} created test users`);
    // Note: In a real implementation, you might want to add a cleanup method
    // to delete test users from the database to prevent test pollution
    createdUsers.length = 0; // Clear the array
  }
});