import { Given, When, Then } from '@cucumber/cucumber';
import { CustomWorld } from '../support/world';
import { expect, expectDefined, expectEqual } from '../utils/expect-helper';
import { randomBytes } from 'crypto';

// Generate nanoid-like IDs using crypto (CommonJS compatible)
function generateId(length: number = 21): string {
  const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  const bytes = randomBytes(length);
  let id = '';
  for (let i = 0; i < length; i++) {
    id += alphabet[bytes[i] % alphabet.length];
  }
  return id;
}

// Store test data for the current scenario
let signupEmail: string;
let signupPassword: string;
let signupName: string;
let signupResponse: any;
let signupError: any;

Given('the database is clean',
  async function(this: CustomWorld) {
    console.log('🗑️  Cleaning database before scenario...');
    await this.clearDatabase();
    console.log('✅ Database cleaned');
  }
);

Given('I want to sign up with email {string} and password {string}',
  function(this: CustomWorld, email: string, password: string) {
    signupEmail = email;
    signupPassword = password;
    signupName = 'Test User';
    signupResponse = null;
    signupError = null;
    console.log(`📝 Preparing signup with email: ${email}`);
  }
);

Given('I want to sign up with email {string}, password {string}, and name {string}',
  function(this: CustomWorld, email: string, password: string, name: string) {
    signupEmail = email;
    signupPassword = password;
    signupName = name;
    signupResponse = null;
    signupError = null;
    console.log(`📝 Preparing signup with email: ${email} and name: ${name}`);
  }
);

Given('a user already exists with email {string}',
  async function(this: CustomWorld, email: string) {
    console.log(`👤 Creating existing user: ${email}`);

    // Create a user directly in the database
    const existingUser = await this.prisma.user.create({
      data: {
        id: generateId(),
        email: email,
        name: 'Existing User',
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
    });

    console.log(`✅ Existing user created: ${existingUser.id}`);
  }
);

Given('I prepare a signup request without email',
  function(this: CustomWorld) {
    signupEmail = ''; // Empty email to trigger validation
    signupPassword = 'SecurePass123!';
    signupName = 'Test User';
    signupResponse = null;
    signupError = null;
    console.log('📝 Preparing signup request without email');
  }
);

When('I submit the signup request',
  async function(this: CustomWorld) {
    console.log(`🔐 Submitting signup request for: ${signupEmail}`);

    try {
      const response = await this.authUtils.axiosInstance.post('/api/auth/sign-up/email', {
        email: signupEmail,
        password: signupPassword,
        name: signupName,
        callbackURL: '/',
      });

      signupResponse = response;

      // If signup succeeded, extract token and user data
      if (response.data && response.data.user) {
        const authToken = response.headers['set-auth-token'];
        this.authToken = authToken;
        this.currentUser = response.data.user;
        console.log(`✅ Signup successful: ${response.data.user.email}`);
      }
    } catch (error: any) {
      signupError = error;
      console.log(`❌ Signup failed with status: ${error.response?.status}`);
    }
  }
);

When('I submit the signup request with name',
  async function(this: CustomWorld) {
    console.log(`🔐 Submitting signup request with name: ${signupName}`);

    try {
      const response = await this.authUtils.axiosInstance.post('/api/auth/sign-up/email', {
        email: signupEmail,
        password: signupPassword,
        name: signupName,
        callbackURL: '/',
      });

      signupResponse = response;

      // If signup succeeded, extract token and user data
      if (response.data && response.data.user) {
        const authToken = response.headers['set-auth-token'];
        this.authToken = authToken;
        this.currentUser = response.data.user;
        console.log(`✅ Signup successful: ${response.data.user.email}`);
      }
    } catch (error: any) {
      signupError = error;
      console.log(`❌ Signup failed with status: ${error.response?.status}`);
    }
  }
);

When('I try to sign up with email {string} and password {string}',
  async function(this: CustomWorld, email: string, password: string) {
    signupEmail = email;
    signupPassword = password;
    signupName = 'Test User';

    console.log(`🔐 Attempting signup with email: ${email}`);

    try {
      const response = await this.authUtils.axiosInstance.post('/api/auth/sign-up/email', {
        email: signupEmail,
        password: signupPassword,
        name: signupName,
        callbackURL: '/',
      });

      signupResponse = response;

      if (response.data && response.data.user) {
        const authToken = response.headers['set-auth-token'];
        this.authToken = authToken;
        this.currentUser = response.data.user;
      }
    } catch (error: any) {
      signupError = error;
      console.log(`❌ Signup failed with status: ${error.response?.status}`);
    }
  }
);

When('I submit the incomplete signup request',
  async function(this: CustomWorld) {
    console.log('🔐 Submitting incomplete signup request');

    try {
      const response = await this.authUtils.axiosInstance.post('/api/auth/sign-up/email', {
        // Intentionally omit email or send empty
        email: signupEmail,
        password: signupPassword,
        name: signupName,
        callbackURL: '/',
      });

      signupResponse = response;
    } catch (error: any) {
      signupError = error;
      console.log(`❌ Signup failed with status: ${error.response?.status}`);
    }
  }
);

Then('the signup should be successful',
  function(this: CustomWorld) {
    expect(!signupError, 'Signup should not have an error');
    expectDefined(signupResponse, 'Signup response should be defined');
    expect(signupResponse.status === 200, 'Signup should return 200 status');
    expectDefined(this.currentUser, 'Current user should be set after successful signup');
    console.log(`✅ Signup verified successful for: ${this.currentUser!.email}`);
  }
);

Then('the signup should fail with error code {int}',
  function(this: CustomWorld, expectedStatusCode: number) {
    expectDefined(signupError, 'Signup should have failed with an error');
    const actualStatusCode = signupError.response?.status;
    expectEqual(
      actualStatusCode,
      expectedStatusCode,
      `Signup should fail with status ${expectedStatusCode}`
    );
    console.log(`✅ Signup correctly failed with status: ${actualStatusCode}`);
  }
);

Then('the user should exist in the database with email {string}',
  async function(this: CustomWorld, email: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: email }
    });

    expectDefined(user, `User with email ${email} should exist in database`);
    expectEqual(user!.email, email, 'User email should match');
    console.log(`✅ User verified in database: ${user!.id}`);
  }
);

Then('the user should have role {string}',
  async function(this: CustomWorld, expectedRole: string) {
    expectDefined(this.currentUser, 'Current user should be defined');

    const user = await this.prisma.user.findUnique({
      where: { email: this.currentUser!.email }
    });

    expectDefined(user, 'User should exist in database');
    expectEqual(user!.role, expectedRole, `User should have role ${expectedRole}`);
    console.log(`✅ User role verified: ${user!.role}`);
  }
);

Then('a session token should be returned',
  function(this: CustomWorld) {
    expectDefined(this.authToken, 'Authentication token should be defined');
    expect(this.authToken!.length > 0, 'Authentication token should not be empty');
    console.log(`✅ Session token verified: ${this.authToken!.substring(0, 20)}...`);
  }
);

Then('the error message should mention {string}',
  function(this: CustomWorld, expectedText: string) {
    expectDefined(signupError, 'Signup error should exist');

    const errorMessage = signupError.response?.data?.error?.message ||
                        signupError.response?.data?.message ||
                        JSON.stringify(signupError.response?.data);

    const lowerErrorMessage = errorMessage.toLowerCase();
    const lowerExpectedText = expectedText.toLowerCase();

    expect(
      lowerErrorMessage.includes(lowerExpectedText),
      `Error message should mention "${expectedText}". Got: ${errorMessage}`
    );

    console.log(`✅ Error message correctly mentions "${expectedText}"`);
  }
);

Then('the error should indicate duplicate email',
  function(this: CustomWorld) {
    expectDefined(signupError, 'Signup error should exist');

    const statusCode = signupError.response?.status;
    const errorMessage = signupError.response?.data?.error?.message ||
                        signupError.response?.data?.message ||
                        JSON.stringify(signupError.response?.data);

    // Better-auth typically returns 422 for duplicate email
    expectEqual(statusCode, 422, 'Should return 422 for duplicate email');

    const lowerErrorMessage = errorMessage.toLowerCase();
    const hasDuplicateIndicator = lowerErrorMessage.includes('already') ||
                                  lowerErrorMessage.includes('exists') ||
                                  lowerErrorMessage.includes('duplicate') ||
                                  lowerErrorMessage.includes('taken');

    expect(
      hasDuplicateIndicator,
      `Error should indicate duplicate email. Got: ${errorMessage}`
    );

    console.log(`✅ Error correctly indicates duplicate email`);
  }
);

Then('the error should indicate missing required field',
  function(this: CustomWorld) {
    expectDefined(signupError, 'Signup error should exist');

    const statusCode = signupError.response?.status;
    const errorMessage = signupError.response?.data?.error?.message ||
                        signupError.response?.data?.message ||
                        JSON.stringify(signupError.response?.data);

    expectEqual(statusCode, 400, 'Should return 400 for missing required field');

    const lowerErrorMessage = errorMessage.toLowerCase();
    const hasMissingFieldIndicator = lowerErrorMessage.includes('required') ||
                                     lowerErrorMessage.includes('missing') ||
                                     lowerErrorMessage.includes('must') ||
                                     lowerErrorMessage.includes('email');

    expect(
      hasMissingFieldIndicator,
      `Error should indicate missing required field. Got: ${errorMessage}`
    );

    console.log(`✅ Error correctly indicates missing required field`);
  }
);

Then('the user name should be {string}',
  async function(this: CustomWorld, expectedName: string) {
    expectDefined(this.currentUser, 'Current user should be defined');

    const user = await this.prisma.user.findUnique({
      where: { email: this.currentUser!.email }
    });

    expectDefined(user, 'User should exist in database');
    expectEqual(user!.name, expectedName, `User name should be ${expectedName}`);
    console.log(`✅ User name verified: ${user!.name}`);
  }
);
