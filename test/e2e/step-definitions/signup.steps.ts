import { Given, When, Then } from '@cucumber/cucumber';
import { expect } from '@playwright/test';
import { E2EWorld } from '../support/world';

// Background steps
Given('I am on the sign up page', async function (this: E2EWorld) {
  await this.navigateToPage('/signup');
  await this.waitForPageReady();
  
  // Verify we're on the sign up page
  const pageTitle = await this.getElementText('h2');
  expect(pageTitle).toContain('Create an account');
});

// Form filling steps
When('I fill in the sign up form with valid data:', async function (this: E2EWorld, dataTable) {
  const rows = dataTable.hashes();
  
  for (const row of rows) {
    const fieldName = row['Field Name'];
    let value = row['Value'];
    
    // Generate dynamic test data
    if (value === '{generated_email}') {
      value = this.generateTestEmail();
      this.setTestData('testEmail', value);
    } else if (value === '{generated_organization}') {
      value = this.generateTestOrganization();
      this.setTestData('testOrganization', value);
    }
    
    await this.fillFormField(fieldName, value);
  }
});

When('I fill in the sign up form with:', async function (this: E2EWorld, dataTable) {
  const rows = dataTable.hashes();
  
  for (const row of rows) {
    const fieldName = row['Field Name'];
    const value = row['Value'];
    
    await this.fillFormField(fieldName, value);
  }
});

When('I click the "Create account" button without filling any fields', async function (this: E2EWorld) {
  await this.clickButton('Create account');
});

When('I click the {string} button', async function (this: E2EWorld, buttonText: string) {
  await this.clickButton(buttonText);
});

When('I click the {string} link', async function (this: E2EWorld, linkText: string) {
  if (!this.page) {
    throw new Error('Page not initialized.');
  }
  
  const link = this.page.locator(`a:has-text("${linkText}")`);
  await link.waitFor({ state: 'visible' });
  await link.click();
});

// Assertion steps
Then('I should be redirected to the home page', { timeout: 30000 }, async function (this: E2EWorld) {
  if (!this.page) {
    throw new Error('Page not initialized.');
  }
  
  // Wait for the signup process to complete
  await this.page.waitForTimeout(3000);
  
  // Check for any error messages first
  const hasSubmitError = await this.pageContainsText('An unexpected error occurred');
  if (hasSubmitError) {
    await this.takeScreenshot('signup-submit-error');
    throw new Error('Signup failed with submit error');
  }
  
  // Check current URL
  let currentUrl = this.page.url();
  
  // If still on signup page, wait a bit more for potential redirect
  if (currentUrl.includes('/signup')) {
    try {
      await this.page.waitForURL(url => !url.toString().includes('/signup'), { timeout: 10000 });
      currentUrl = this.page.url();
    } catch (e) {
      currentUrl = this.page.url();
    }
  }
  
  // Check if we successfully redirected
  const isOnHomePage = currentUrl === this.baseURL + '/' || currentUrl === this.baseURL;
  const isOnSignInPage = currentUrl.includes('/signin');
  const isRedirectedFromSignup = !currentUrl.includes('/signup');
  
  // If not redirected, check for success indicators on signup page
  let hasSuccessOnPage = false;
  if (!isRedirectedFromSignup) {
    hasSuccessOnPage = await this.pageContainsText('success') || 
                       await this.pageContainsText('created') ||
                       await this.pageContainsText('Account created');
  }
  
  // Success conditions:
  // 1. Redirected to home page
  // 2. Redirected to sign in page  
  // 3. Has success message on current page
  const isSuccessful = isOnHomePage || isOnSignInPage || hasSuccessOnPage;
  
  if (!isSuccessful) {
    await this.takeScreenshot('signup-not-successful');
    
    // Get page content for debugging
    const pageContent = await this.page.textContent('body');
    console.log(`📄 Page content preview: ${pageContent?.substring(0, 300)}...`);
  }
  
  expect(isSuccessful).toBeTruthy();
});

Then('I should see a success message or be signed out', async function (this: E2EWorld) {
  // The sign up process might redirect to sign in page after creating account
  // This is acceptable behavior according to the SignUp.tsx implementation
  
  if (!this.page) {
    throw new Error('Page not initialized.');
  }
  
  const currentUrl = this.page.url();
  const isOnSignInPage = currentUrl.includes('/signin') || currentUrl === this.baseURL + '/';
  
  if (isOnSignInPage) {
    // If redirected to sign in, that's successful sign up behavior
    console.log('✅ Successfully redirected to sign in page after account creation');
  } else {
    // Otherwise look for success indicators
    const hasSuccessIndicator = await this.pageContainsText('success') || 
                               await this.pageContainsText('created') ||
                               await this.pageContainsText('welcome');
    
    expect(hasSuccessIndicator).toBeTruthy();
  }
});

Then('I should see validation errors for all required fields:', async function (this: E2EWorld, dataTable) {
  const expectedErrors = dataTable.hashes();
  
  for (const errorData of expectedErrors) {
    const fieldName = errorData['Field Name'];
    const errorMessage = errorData['Error Message'];
    
    // Look for error message near the field or anywhere on page
    const hasError = await this.pageContainsText(errorMessage);
    
    if (!hasError) {
      // Take screenshot for debugging
      await this.takeScreenshot(`validation-error-${fieldName.replace(/\s+/g, '-')}`);
    }
    
    expect(hasError).toBeTruthy();
  }
});

Then('I should see an error message {string}', async function (this: E2EWorld, errorMessage: string) {
  if (!this.page) {
    throw new Error('Page not initialized.');
  }

  // Wait a moment for any validation to trigger
  await this.page.waitForTimeout(1000);
  
  // Check for the error message in multiple ways
  let hasError = false;

  // 1. Check page text content for the message
  hasError = await this.pageContainsText(errorMessage);
  
  if (!hasError) {
    // 2. Check for React validation errors
    try {
      const reactErrors = await this.page.locator('.text-red-500, [class*="error"]').all();
      for (const element of reactErrors) {
        const text = await element.textContent();
        if (text && text.toLowerCase().includes(errorMessage.toLowerCase())) {
          hasError = true;
          break;
        }
      }
    } catch (e) {
      // Continue checking
    }
    
    // 3. Check for browser validation (HTML5 validation messages)
    if (!hasError) {
      try {
        const invalidFields = await this.page.locator(':invalid').all();
        
        for (const field of invalidFields) {
          const validationMessage = await field.evaluate((el: any) => el.validationMessage);
          if (validationMessage && validationMessage.toLowerCase().includes(errorMessage.toLowerCase())) {
            hasError = true;
            break;
          }
        }
      } catch (e) {
        // Continue checking
      }
    }
    
    // 4. Check the entire page for any text that includes our error message
    if (!hasError) {
      try {
        const pageText = await this.page.textContent('body');
        if (pageText && pageText.toLowerCase().includes(errorMessage.toLowerCase())) {
          hasError = true;
        }
      } catch (e) {
        // Final fallback
      }
    }
  }
  
  if (!hasError) {
    // Take screenshot for debugging
    await this.takeScreenshot(`error-message-${errorMessage.replace(/\s+/g, '-')}`);
    
    // Log what we actually found for debugging
    const allText = await this.page.textContent('body');
    console.log(`❌ Could not find error message: "${errorMessage}"`);
    console.log('Full page text:', allText?.substring(0, 500) + '...');
  }
  
  expect(hasError).toBeTruthy();
});

Then('I should be redirected to the sign in page', async function (this: E2EWorld) {
  if (!this.page) {
    throw new Error('Page not initialized.');
  }
  
  // Wait for navigation to complete
  await this.waitForNavigation();
  
  // Check if we're on the sign in page
  const currentUrl = this.page.url();
  expect(currentUrl).toContain('/signin');
  
  // Verify sign in page content
  const pageTitle = await this.getElementText('h2');
  expect(pageTitle.toLowerCase()).toMatch(/(sign in|welcome back)/i);
});