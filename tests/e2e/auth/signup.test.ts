import { test, expect } from '@playwright/test';
import { SignUpPage, DashboardPage } from '../utils/page-objects';
import { generateTestUser, validateSignUpError } from '../utils/auth-helpers';
import testUsersData from '../../fixtures/test-users.json' with { type: 'json' };

test.describe('User Registration Journey', () => {
  test('should successfully create a new user account', async ({ page }) => {
    const signUpPage = new SignUpPage(page);
    const dashboardPage = new DashboardPage(page);
    
    // Generate unique test user to avoid conflicts
    const userData = generateTestUser();
    
    // Navigate to signup page
    await signUpPage.goto();
    
    // Verify signup page elements are visible
    await expect(page.getByText('Create an account')).toBeVisible();
    await expect(page.getByText('Get started')).toBeVisible();
    
    // Fill out registration form
    await signUpPage.fillForm({
      name: userData.name,
      email: userData.email,
      organizationName: userData.organizationName,
      password: userData.password,
      confirmPassword: userData.password
    });
    
    // Submit the form
    await signUpPage.submit();
    
    // Verify successful registration
    // Note: Based on SignUp.tsx, after successful signup the user is signed out
    // and redirected to '/', which should redirect to signin if not authenticated
    await expect(page).toHaveURL('http://localhost:3000/signin');
  });

  test('should show validation errors for invalid form data', async ({ page }) => {
    const signUpPage = new SignUpPage(page);
    
    await signUpPage.goto();
    
    // Test each validation error from our test fixtures, except invalid email format
    // (HTML5 validation prevents form submission with invalid email)
    const testableUsers = testUsersData.invalidUsers.filter(user => 
      user.expectedError !== 'Please enter a valid email'
    );
    
    for (const invalidUser of testableUsers) {
      // Clear the form first
      await page.reload();
      
      // Fill form with invalid data
      await signUpPage.fillForm({
        name: invalidUser.name,
        email: invalidUser.email,
        organizationName: invalidUser.organizationName,
        password: invalidUser.password,
        confirmPassword: invalidUser.password
      });
      
      // Submit form
      await signUpPage.submit();
      
      // Verify expected error message appears
      await validateSignUpError(page, invalidUser.expectedError);
    }
  });

  test('should show error for mismatched passwords', async ({ page }) => {
    const signUpPage = new SignUpPage(page);
    const userData = generateTestUser();
    
    await signUpPage.goto();
    
    // Fill form with mismatched passwords
    await signUpPage.fillForm({
      name: userData.name,
      email: userData.email,
      organizationName: userData.organizationName,
      password: 'password123',
      confirmPassword: 'differentpassword'
    });
    
    // Submit form
    await signUpPage.submit();
    
    // Verify password mismatch error
    await validateSignUpError(page, "Passwords don't match");
  });

  test('should navigate to signin page when clicking signin link', async ({ page }) => {
    const signUpPage = new SignUpPage(page);
    
    await signUpPage.goto();
    
    // Click the signin link
    await signUpPage.signInLink.click();
    
    // Verify navigation to signin page
    await expect(page).toHaveURL('http://localhost:3000/signin');
    await expect(page.getByText('Welcome back')).toBeVisible();
  });

  test('should show loading state during form submission', async ({ page }) => {
    const signUpPage = new SignUpPage(page);
    const userData = generateTestUser();
    
    await signUpPage.goto();
    
    // Fill out form
    await signUpPage.fillForm({
      name: userData.name,
      email: userData.email,
      organizationName: userData.organizationName,
      password: userData.password
    });
    
    // Click submit and immediately check for loading state
    const submitPromise = signUpPage.submit();
    
    // Verify loading state appears
    await expect(page.getByText('Creating account...')).toBeVisible();
    
    // Wait for submission to complete
    await submitPromise;
  });

  test('should validate required fields when submitting empty form', async ({ page }) => {
    const signUpPage = new SignUpPage(page);
    
    await signUpPage.goto();
    
    // Submit empty form
    await signUpPage.createAccountButton.click();
    
    // Verify validation errors for required fields
    await validateSignUpError(page, 'Full name is required');
    await validateSignUpError(page, 'Email is required');
    await validateSignUpError(page, 'Organization name is required');
    await validateSignUpError(page, 'Password is required');
  });

  test('should clear error messages when user starts typing', async ({ page }) => {
    const signUpPage = new SignUpPage(page);
    
    await signUpPage.goto();
    
    // Submit empty form to generate errors
    await signUpPage.createAccountButton.click();
    
    // Verify error appears
    await validateSignUpError(page, 'Full name is required');
    
    // Start typing in the name field
    await signUpPage.nameInput.fill('T');
    
    // Verify error is cleared (this might need adjustment based on actual implementation)
    await expect(page.getByText('Full name is required')).not.toBeVisible();
  });

  test('should handle duplicate email error gracefully', async ({ page }) => {
    const signUpPage = new SignUpPage(page);
    
    // First, create a user account
    const userData = generateTestUser('duplicate');
    
    await signUpPage.goto();
    await signUpPage.fillForm({
      name: userData.name,
      email: userData.email,
      organizationName: userData.organizationName,
      password: userData.password
    });
    await signUpPage.submit();
    
    // Now try to create another account with the same email
    await signUpPage.goto();
    await signUpPage.fillForm({
      name: 'Different Name',
      email: userData.email, // Same email
      organizationName: 'Different Org',
      password: 'password123'
    });
    await signUpPage.submit();
    
    // Should show some kind of error (exact message may vary)
    // This test validates that the app handles the error gracefully
    const hasError = await page.getByText(/error|exists|duplicate/i).first().isVisible().catch(() => false);
    expect(hasError).toBe(true);
  });
});