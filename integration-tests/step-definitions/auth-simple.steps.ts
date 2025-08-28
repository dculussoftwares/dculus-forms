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
  toBeDefined: () => {
    if (actual === undefined) {
      throw new Error('Expected value to be defined');
    }
  },
  toContain: (expected: any) => {
    if (!actual || !actual.includes(expected)) {
      throw new Error(`Expected ${actual} to contain ${expected}`);
    }
  }
});

When('I test the auth utilities directly', async function (this: CustomWorld) {
  try {
    console.log('Testing auth utilities...');
    const testUser = generateTestUserWithOrganization();
    console.log('Generated test user:', testUser.email);

    // Test sign up
    console.log('Testing sign up...');
    const signUpResult = await this.authUtils.signUpUser(
      testUser.email,
      testUser.password,
      testUser.name,
      testUser.organizationName
    );
    console.log('Sign up successful:', signUpResult.user.email);

    // Test sign in
    console.log('Testing sign in...');
    const signInResult = await this.authUtils.signInUser(
      testUser.email,
      testUser.password
    );
    console.log('Sign in successful, got token:', signInResult.token.substring(0, 10) + '...');

    // Store results for verification
    (this as any).testUser = testUser;
    (this as any).signUpResult = signUpResult;
    (this as any).signInResult = signInResult;

  } catch (error: any) {
    console.error('Auth test failed:', error.message);
    (this as any).testError = error.message;
    throw error;
  }
});

Then('I should be able to create and authenticate a user', function (this: CustomWorld) {
  // Check that we have test results
  expect((this as any).testUser).toBeDefined();
  expect((this as any).signUpResult).toBeDefined();
  expect((this as any).signInResult).toBeDefined();

  // Check sign up result
  const signUpResult = (this as any).signUpResult;
  expect(signUpResult.user).toBeDefined();
  expect(signUpResult.user.email).toBe((this as any).testUser.email);
  expect(signUpResult.token).toBeDefined();

  // Check sign in result
  const signInResult = (this as any).signInResult;
  expect(signInResult.user).toBeDefined();
  expect(signInResult.user.email).toBe((this as any).testUser.email);
  expect(signInResult.token).toBeDefined();

  console.log('✅ Auth utilities test passed!');
});