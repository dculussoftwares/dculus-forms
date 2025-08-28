import { Given, When, Then } from '@cucumber/cucumber';
import { expect } from '@playwright/test';
import { E2EWorld } from '../support/world';

// Background steps
Given('I have test credentials ready', async function (this: E2EWorld) {
  // Initialize test data storage for credentials
  this.setTestData('signInCredentials', {
    email: '',
    password: 'TestPassword123!'
  });
});

Given('I am on the sign in page', async function (this: E2EWorld) {
  await this.navigateToPage('/signin');
  await this.waitForPageReady();
  
  // Verify we're on the sign in page
  const pageTitle = await this.getElementText('h2');
  expect(pageTitle).toContain('Welcome back');
});

// Navigation steps
When('I navigate to the sign in page', async function (this: E2EWorld) {
  await this.navigateToPage('/signin');
  await this.waitForPageReady();
  
  // Verify we're on the sign in page
  const pageTitle = await this.getElementText('h2');
  expect(pageTitle).toContain('Welcome back');
});

// Form filling steps
When('I fill in the sign in form with the stored credentials', async function (this: E2EWorld) {
  // Get the email that was generated during sign up
  const testEmail = this.getTestData('testEmail');
  const credentials = this.getTestData('signInCredentials');
  
  if (!testEmail) {
    throw new Error('No test email found from sign up process');
  }
  
  // Update credentials with the email from sign up
  credentials.email = testEmail;
  this.setTestData('signInCredentials', credentials);
  
  // Fill the form
  await this.fillFormField('Email', testEmail);
  await this.fillFormField('Password', credentials.password);
});

When('I fill in the sign in form with:', async function (this: E2EWorld, dataTable) {
  const rows = dataTable.hashes();
  
  for (const row of rows) {
    const fieldName = row['Field Name'];
    const value = row['Value'];
    
    await this.fillFormField(fieldName, value);
  }
});

When('I click the "Sign in" button without filling any fields', async function (this: E2EWorld) {
  await this.clickButton('Sign in');
});

// Assertion steps
Then('I should be successfully signed in', async function (this: E2EWorld) {
  if (!this.page) {
    throw new Error('Page not initialized.');
  }
  
  // Wait for any post-signin processing
  await this.page.waitForTimeout(2000);
  
  // Check that we're no longer on the signin page
  const currentUrl = this.page.url();
  const isOnSignInPage = currentUrl.includes('/signin');
  
  // Should not be on sign in page after successful sign in
  expect(isOnSignInPage).toBeFalsy();
  
  // Check for successful sign in indicators - dashboard content
  const hasDashboardContent = await this.pageContainsText('My Forms') || 
                             await this.pageContainsText('Dashboard') ||
                             await this.pageContainsText('Create Form');
  
  if (!hasDashboardContent) {
    await this.takeScreenshot('signin-verification-failed');
    const pageText = await this.page.textContent('body');
    console.log('Current page content:', pageText?.substring(0, 300));
  }
  
  expect(hasDashboardContent).toBeTruthy();
  
  console.log('✅ Successfully signed in and redirected to dashboard');
});

Then('I should see validation errors for required fields:', async function (this: E2EWorld, dataTable) {
  const expectedErrors = dataTable.hashes();
  
  for (const errorData of expectedErrors) {
    const fieldName = errorData['Field Name'];
    const errorMessage = errorData['Error Message'];
    
    // Look for error message on page
    const hasError = await this.pageContainsText(errorMessage);
    
    if (!hasError) {
      // Take screenshot for debugging
      await this.takeScreenshot(`signin-validation-error-${fieldName.replace(/\s+/g, '-')}`);
    }
    
    expect(hasError).toBeTruthy();
  }
});


Then('I should be redirected to the sign up page', async function (this: E2EWorld) {
  if (!this.page) {
    throw new Error('Page not initialized.');
  }
  
  // Wait for navigation to complete
  await this.waitForNavigation();
  
  // Check if we're on the sign up page
  const currentUrl = this.page.url();
  expect(currentUrl).toContain('/signup');
  
  // Verify sign up page content
  const pageTitle = await this.getElementText('h2');
  expect(pageTitle.toLowerCase()).toMatch(/(create an account|sign up)/i);
});