import { test, expect } from '@playwright/test';
import { SignInPage, SignUpPage, DashboardPage } from '../utils/page-objects';
import { generateTestUser, signUpNewUser, validateSignInError } from '../utils/auth-helpers';

test.describe('User Authentication Journey', () => {
  test('should successfully sign in with valid credentials', async ({ page }) => {
    const signInPage = new SignInPage(page);
    const signUpPage = new SignUpPage(page);
    const dashboardPage = new DashboardPage(page);
    
    // First create a user account to sign in with
    const userData = generateTestUser('signin');
    await signUpNewUser(page, userData);
    
    // Now sign in with those credentials
    await signInPage.goto();
    
    // Verify signin page elements
    await expect(page.getByText('Welcome back')).toBeVisible();
    await expect(page.getByText('Enter your credentials to access your account')).toBeVisible();
    
    // Fill and submit signin form
    await signInPage.fillForm(userData.email, userData.password);
    await signInPage.submit();
    
    // Verify successful authentication - should redirect to dashboard
    await expect(page).toHaveURL('http://localhost:3000/');
    await expect(page.getByRole('heading', { name: 'Your Forms' })).toBeVisible();
  });

  test('should show error for invalid credentials', async ({ page }) => {
    const signInPage = new SignInPage(page);
    
    await signInPage.goto();
    
    // Try to sign in with invalid credentials
    await signInPage.fillForm('nonexistent@example.com', 'wrongpassword');
    await signInPage.submit();
    
    // Should show error message
    await validateSignInError(page, 'Invalid email or password');
  });

  test('should validate required fields', async ({ page }) => {
    const signInPage = new SignInPage(page);
    
    await signInPage.goto();
    
    // Submit empty form
    await signInPage.signInButton.click();
    
    // Should show validation errors
    await validateSignInError(page, 'Email is required');
    await validateSignInError(page, 'Password is required');
  });

  test.skip('should validate email format', async ({ page }) => {
    // This test is skipped because HTML5 validation on email input type
    // prevents form submission with invalid emails in browser
    const signInPage = new SignInPage(page);
    
    await signInPage.goto();
    
    // Enter invalid email format  
    await signInPage.emailInput.fill('invalid-email');
    await signInPage.passwordInput.fill('password123');
    
    // Click submit button to trigger validation
    await signInPage.signInButton.click();
    
    // Wait for form validation
    await page.waitForTimeout(1000);
    
    // Should show email validation error
    await validateSignInError(page, 'Please enter a valid email');
  });

  test('should show loading state during authentication', async ({ page }) => {
    const signInPage = new SignInPage(page);
    
    // First create a user to sign in with
    const userData = generateTestUser('loading');
    await signUpNewUser(page, userData);
    
    await signInPage.goto();
    
    // Fill form
    await signInPage.fillForm(userData.email, userData.password);
    
    // Click signin and immediately check for loading state
    const signinPromise = signInPage.submit();
    
    // Verify loading state (button text should change)
    await expect(page.getByText('Signing in...')).toBeVisible();
    
    // Wait for signin to complete
    await signinPromise;
  });

  test('should navigate to signup page when clicking signup link', async ({ page }) => {
    const signInPage = new SignInPage(page);
    
    await signInPage.goto();
    
    // Click signup link
    await signInPage.signUpLink.click();
    
    // Verify navigation to signup page
    await expect(page).toHaveURL('http://localhost:3000/signup');
    await expect(page.getByText('Create an account')).toBeVisible();
  });

  test('should clear validation errors when user starts typing', async ({ page }) => {
    const signInPage = new SignInPage(page);
    
    await signInPage.goto();
    
    // Submit empty form to generate errors
    await signInPage.signInButton.click();
    
    // Verify error appears
    await validateSignInError(page, 'Email is required');
    
    // Start typing in email field
    await signInPage.emailInput.fill('t');
    
    // Error should be cleared
    await expect(page.getByText('Email is required')).not.toBeVisible();
  });

  test('should handle network errors gracefully', async ({ page }) => {
    const signInPage = new SignInPage(page);
    
    // Navigate to signin page first
    await signInPage.goto();
    
    // Fill the form
    await signInPage.fillForm('test@example.com', 'password123');
    
    // Simulate network failure by intercepting and failing requests
    await page.route('**/graphql', route => route.abort('failed'));
    
    // Try to sign in while network requests are blocked
    await signInPage.submit();
    
    // Wait longer for error to appear and check for any red error text
    await page.waitForTimeout(3000);
    const hasRedError = await page.locator('.text-red-500').first().isVisible().catch(() => false);
    const hasGeneralError = await page.getByText(/error|failed|network|connection|unexpected/i).first().isVisible().catch(() => false);
    
    // Should show some kind of error indication
    expect(hasRedError || hasGeneralError).toBe(true);
    
    // Restore network
    await page.unroute('**/graphql');
  });

  test('should persist authentication across page reloads', async ({ page }) => {
    // First, sign in a user
    const userData = generateTestUser('persist');
    await signUpNewUser(page, userData);
    
    const signInPage = new SignInPage(page);
    await signInPage.goto();
    await signInPage.fillForm(userData.email, userData.password);
    await signInPage.submit();
    
    // Verify we're authenticated
    await expect(page).toHaveURL('http://localhost:3000/');
    await expect(page.getByRole('heading', { name: 'Your Forms' })).toBeVisible();
    
    // Reload the page
    await page.reload();
    
    // Should still be authenticated and on dashboard
    await expect(page).toHaveURL('http://localhost:3000/');
    await expect(page.getByRole('heading', { name: 'Your Forms' })).toBeVisible();
  });

  test('should redirect unauthenticated users to signin', async ({ page }) => {
    // Try to access protected route without authentication
    await page.goto('http://localhost:3000/dashboard/templates');
    
    // Should be redirected to signin page
    await expect(page).toHaveURL('http://localhost:3000/signin');
    await expect(page.getByText('Welcome back')).toBeVisible();
  });
});