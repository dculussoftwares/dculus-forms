import { Given, Then } from '@cucumber/cucumber';
import { CustomWorld } from '../support/world';

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
  toBeGreaterThan: (expected: number) => {
    if (actual <= expected) {
      throw new Error(`Expected ${actual} to be greater than ${expected}`);
    }
  },
  toMatch: (pattern: RegExp | string) => {
    const regex = typeof pattern === 'string' ? new RegExp(pattern, 'i') : pattern;
    if (!regex.test(String(actual))) {
      throw new Error(`Expected "${actual}" to match ${pattern}`);
    }
  }
});

// Common step definition that can be shared across all feature files
Given('the backend server is running', async function (this: CustomWorld) {
  // The server is already started in hooks.ts
  // Just verify it's accessible
  try {
    await this.authUtils.axiosInstance.get('/health');
  } catch (error) {
    throw new Error('Backend server is not running or not accessible');
  }
});

// Common authentication error step
Then('I should receive an authentication error', function (this: CustomWorld) {
  // Check for shared test data lastError first (for cross-file compatibility)
  const sharedError = this.getSharedTestData('lastError');
  if (sharedError) {
    expect(sharedError).toMatch(/auth|unauthorized|required|authentication/i);
    return;
  }

  // GraphQL typically returns 200 with errors in the response
  // or might return 401/403 for authentication errors
  expect(this.response).toBeDefined();

  if (this.response?.status === 200) {
    // Check for GraphQL errors
    expect(this.response.data).toHaveProperty('errors');
    const errors = this.response.data.errors;
    expect(errors.length).toBeGreaterThan(0);

    const authError = errors.find((error: any) =>
      error.message.toLowerCase().includes('auth') ||
      error.message.toLowerCase().includes('unauthorized') ||
      error.message.toLowerCase().includes('required')
    );
    expect(authError).toBeDefined();
  } else {
    // HTTP-level authentication error
    const validAuthErrorCodes = [401, 403];
    if (!validAuthErrorCodes.includes(this.response?.status || 0)) {
      throw new Error(`Expected 401 or 403, but got ${this.response?.status}`);
    }
  }
});