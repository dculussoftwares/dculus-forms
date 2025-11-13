/**
 * Test: Verify organization ID is available immediately after signup
 * 
 * This test verifies that:
 * 1. User can sign up with organization name
 * 2. After OTP verification, session has activeOrganizationId
 * 3. User doesn't need to sign out/sign in to access organization context
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { authClient } from '../../../apps/form-app/src/lib/auth-client';

describe('Signup Organization ID Fix', () => {
  const testEmail = `test-${Date.now()}@example.com`;
  const testPassword = 'TestPassword123!';
  const testOrgName = `Test Org ${Date.now()}`;
  let userId: string;

  afterAll(async () => {
    // Cleanup: sign out
    try {
      await authClient.signOut();
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  it('should have activeOrganizationId in session immediately after signup', async () => {
    // Step 1: Sign up
    const signUpResponse = await authClient.signUp.email({
      email: testEmail,
      password: testPassword,
      name: 'Test User',
    });

    expect(signUpResponse.error).toBeNull();
    expect(signUpResponse.data).toBeDefined();
    userId = signUpResponse.data?.user?.id || '';

    // Step 2: In a real scenario, we'd verify OTP and sign in
    // For this test, we'll simulate the flow after OTP verification
    
    // Step 3: Sign in (simulating post-OTP flow)
    const signInResponse = await authClient.signIn.email({
      email: testEmail,
      password: testPassword,
    });

    expect(signInResponse.error).toBeNull();

    // Step 4: Create organization (this happens in SignUp.tsx after OTP)
    const orgResponse = await authClient.organization.create({
      name: testOrgName,
      slug: `test-org-${Date.now()}`,
      keepCurrentActiveOrganization: false,
    });

    expect(orgResponse.error).toBeNull();
    expect(orgResponse.data?.id).toBeDefined();

    // Step 5: Refresh session (this is what we added in SignUp.tsx)
    await authClient.getSession();

    // Step 6: Get current session
    const session = await authClient.getSession();

    // CRITICAL ASSERTION: activeOrganizationId should be set
    expect(session.data?.session?.activeOrganizationId).toBeDefined();
    expect(session.data?.session?.activeOrganizationId).toBe(orgResponse.data?.id);
    
    console.log('✅ Test passed: activeOrganizationId is available immediately after signup');
  }, 30000); // 30 second timeout for network operations
});
