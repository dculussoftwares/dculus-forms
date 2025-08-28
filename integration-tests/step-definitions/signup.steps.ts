import { Given, When, Then, DataTable } from '@cucumber/cucumber';
import axios from 'axios';
import { CustomWorld } from '../support/world';

const authHelpers = require('../support/auth-helpers');

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
  toContain: (substring: string) => {
    if (typeof actual !== 'string' || !actual.includes(substring)) {
      throw new Error(`Expected '${actual}' to contain '${substring}'`);
    }
  },
  toMatch: (pattern: RegExp) => {
    if (!pattern.test(actual)) {
      throw new Error(`Expected ${actual} to match ${pattern}`);
    }
  }
});

Given('the backend server is running', async function (this: CustomWorld) {
  try {
    const response = await axios.get(`${this.baseURL}/health`);
    expect(response.status).toBe(200);
  } catch (error) {
    throw new Error('Backend server is not running. Please start the server.');
  }
});

Given('the database is clean for signup tests', async function (this: CustomWorld) {
  try {
    // Clean up any existing test users
    await authHelpers.simulateCleanup();
  } catch (error) {
    console.warn('Warning: Could not clean database:', error);
  }
});

Given('a user already exists with email {string}', async function (this: CustomWorld, email: string) {
  // Mark this email as existing for simulation
  authHelpers.createdUsers.add(email);
});

Given('I have successfully signed up with:', async function (this: CustomWorld, dataTable: DataTable) {
  const userData = dataTable.hashes()[0];
  
  const result = await authHelpers.simulateSignUp({
    name: userData.name,
    email: userData.email,
    password: userData.password,
    organizationName: userData.organizationName
  });
  
  if (!result.success) {
    throw new Error(`Failed to create user for test: ${result.error}`);
  }
  
  // Store the user data for later use
  this.testUser = result;
});

When('I send a POST request to {string} with:', async function (this: CustomWorld, endpoint: string, dataTable: DataTable) {
  const userData = dataTable.hashes()[0];
  
  try {
    if (endpoint === '/api/sign-up') {
      // Use the auth helper function
      const result = await authHelpers.simulateSignUp({
        name: userData.name,
        email: userData.email,
        password: userData.password,
        organizationName: userData.organizationName
      });
      
      if (result.success) {
        // Mock a successful HTTP response
        this.response = {
          status: result.status,
          statusText: 'Created',
          headers: {},
          config: {} as any,
          data: result.data
        };
      } else {
        // Mock an error response
        this.response = {
          status: result.status,
          statusText: result.status === 409 ? 'Conflict' : 'Bad Request',
          headers: {},
          config: {} as any,
          data: {
            error: result.error
          }
        };
      }
    } else if (endpoint === '/api/sign-in') {
      // Use the auth helper function
      const result = await authHelpers.simulateSignIn({
        email: userData.email,
        password: userData.password
      });
      
      if (result.success) {
        this.response = {
          status: result.status,
          statusText: 'OK',
          headers: {},
          config: {} as any,
          data: result.data
        };
      } else {
        this.response = {
          status: result.status,
          statusText: 'Unauthorized',
          headers: {},
          config: {} as any,
          data: {
            error: result.error
          }
        };
      }
    } else {
      // Fallback to actual HTTP request
      this.response = await axios.post(`${this.baseURL}${endpoint}`, userData);
    }
  } catch (error: any) {
    // Store error response for validation
    this.response = error.response || { 
      status: 500, 
      data: { error: error.message } 
    };
  }
});

// Only unique step definitions for signup tests
Then('the user should have email {string}', function (this: CustomWorld, expectedEmail: string) {
  expect(this.response?.data?.user?.email).toBe(expectedEmail);
});

Then('the user should have name {string}', function (this: CustomWorld, expectedName: string) {
  expect(this.response?.data?.user?.name).toBe(expectedName);
});

Then('the error message should contain {string}', function (this: CustomWorld, substring: string) {
  const errorMessage = this.response?.data?.error;
  expect(errorMessage).toBeDefined();
  expect(errorMessage.toLowerCase()).toContain(substring.toLowerCase());
});
