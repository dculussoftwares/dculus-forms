import { Page, expect } from '@playwright/test';

export interface SignUpData {
  name: string;
  email: string;
  password: string;
  confirmPassword?: string;
  organizationName: string;
}

export interface SignInData {
  email: string;
  password: string;
}

/**
 * Navigate to the signup page and fill out the registration form
 */
export async function signUpNewUser(page: Page, userData: SignUpData) {
  // Navigate to signup page
  await page.goto('http://localhost:3000/signup');
  
  // Verify we're on the signup page
  await expect(page).toHaveURL('http://localhost:3000/signup');
  await expect(page.getByText('Create an account')).toBeVisible();
  
  // Fill out the signup form
  await page.getByLabel('Full Name').fill(userData.name);
  await page.getByLabel('Email').fill(userData.email);
  await page.getByLabel('Organization Name').fill(userData.organizationName);
  await page.getByLabel('Password', { exact: true }).fill(userData.password);
  await page.getByLabel('Confirm Password').fill(userData.confirmPassword || userData.password);
  
  // Submit the form
  await page.getByRole('button', { name: 'Create account' }).click();
  
  // Wait for either successful redirect to dashboard or error message
  try {
    // Wait for redirect to dashboard (successful signup)
    await expect(page).toHaveURL('http://localhost:3000/', { timeout: 10000 });
    await expect(page.getByRole('heading', { name: 'Your Forms' })).toBeVisible({ timeout: 5000 });
  } catch (error) {
    // If redirect didn't happen, check for error messages
    const errorElements = page.locator('.text-red-500');
    const hasErrors = await errorElements.count() > 0;
    if (hasErrors) {
      const errorText = await errorElements.first().textContent();
      throw new Error(`Sign-up failed with error: ${errorText}`);
    } else {
      // No error displayed but no redirect - might be loading issue
      await page.waitForTimeout(5000); // Give it more time
      // Check current URL to understand what happened
      const currentUrl = page.url();
      if (currentUrl.includes('/signup')) {
        throw new Error(`Sign-up appears to have failed - still on signup page: ${currentUrl}`);
      }
    }
  }
}

/**
 * Navigate to signin page and authenticate user
 */
export async function signInUser(page: Page, credentials: SignInData) {
  // Navigate to signin page
  await page.goto('http://localhost:3000/signin');
  
  // Verify we're on the signin page
  await expect(page).toHaveURL('http://localhost:3000/signin');
  await expect(page.getByText('Welcome back')).toBeVisible();
  
  // Fill out signin form
  await page.getByLabel('Email').fill(credentials.email);
  await page.getByLabel('Password').fill(credentials.password);
  
  // Submit form
  await page.getByRole('button', { name: 'Sign in' }).click();
  
  // Wait for either successful redirect to dashboard or error message
  try {
    // Wait for redirect to dashboard (successful signin)
    await expect(page).toHaveURL('http://localhost:3000/', { timeout: 10000 });
  } catch (error) {
    // If redirect didn't happen, check for error messages or wait a bit more
    await page.waitForTimeout(3000); // Give more time for async operations
    
    const errorElements = page.locator('.text-red-500');
    const hasErrors = await errorElements.count() > 0;
    if (hasErrors) {
      const errorText = await errorElements.first().textContent();
      throw new Error(`Sign-in failed with error: ${errorText}`);
    }
    
    // Check current URL to understand what happened
    const currentUrl = page.url();
    if (currentUrl.includes('/signin')) {
      throw new Error(`Sign-in appears to have failed - still on signin page: ${currentUrl}`);
    }
  }
}

/**
 * Quick authentication helper - assumes user already exists
 */
export async function authenticateUser(page: Page, email: string, password: string) {
  await signInUser(page, { email, password });
  
  // Verify successful authentication by checking we're on dashboard
  await expect(page).toHaveURL('http://localhost:3000/');
  await expect(page.getByRole('heading', { name: 'Your Forms' })).toBeVisible();
}

/**
 * Sign out the current user
 */
export async function signOutUser(page: Page) {
  // Look for user menu or sign out button
  // Note: This may need to be updated based on your actual UI
  const userMenuButton = page.getByTestId('user-menu-button');
  if (await userMenuButton.isVisible()) {
    await userMenuButton.click();
    await page.getByRole('menuitem', { name: 'Sign out' }).click();
  }
  
  // Verify sign out was successful
  await expect(page).toHaveURL('http://localhost:3000/signin');
}

/**
 * Check if user is currently authenticated
 */
export async function isUserAuthenticated(page: Page): Promise<boolean> {
  try {
    await page.goto('http://localhost:3000/');
    await page.waitForTimeout(1000);
    
    // If we're redirected to signin, user is not authenticated
    if (page.url().includes('/signin')) {
      return false;
    }
    
    // If we can see dashboard elements, user is authenticated
    const dashboardElements = await page.getByRole('heading', { name: 'Your Forms' }).isVisible();
    return dashboardElements;
  } catch {
    return false;
  }
}

/**
 * Generate unique test user data to avoid conflicts
 */
export function generateTestUser(suffix?: string): SignUpData {
  const uniqueId = suffix || Math.random().toString(36).substring(7);
  
  return {
    name: `Test User ${uniqueId}`,
    email: `testuser${uniqueId}@example.com`,
    password: 'password123',
    organizationName: `Test Org ${uniqueId}`
  };
}

/**
 * Validate form error messages during signup
 */
export async function validateSignUpError(page: Page, expectedError: string) {
  // Wait a moment for any async error handling
  await page.waitForTimeout(1000);
  
  // Look for error elements with red text styling that contain the expected text
  const errorElement = page.locator('.text-red-500').filter({ hasText: expectedError }).first();
  await expect(errorElement).toBeVisible();
}

/**
 * Validate form error messages during signin
 */
export async function validateSignInError(page: Page, expectedError: string) {
  // Wait a moment for any async error handling
  await page.waitForTimeout(1000);
  
  // First check if any error elements exist
  const allErrorElements = page.locator('.text-red-500');
  const errorCount = await allErrorElements.count();
  
  if (errorCount > 0) {
    // If errors exist, check if our expected text is there
    const errorElement = allErrorElements.filter({ hasText: expectedError }).first();
    await expect(errorElement).toBeVisible();
  } else {
    // If no styled errors, look for any error-like text
    const generalErrorElement = page.getByText(expectedError).first();
    await expect(generalErrorElement).toBeVisible();
  }
}