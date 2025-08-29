import { Given, When, Then } from '@cucumber/cucumber';
import { expect } from '@playwright/test';
import { E2EWorld } from '../support/world';

// Form creation specific steps
// Note: This file extends existing signup.steps.ts and signin.steps.ts

// Dashboard verification for forms
Then('I should see the dashboard with forms content', async function (this: E2EWorld) {
  if (!this.page) {
    throw new Error('Page not initialized.');
  }
  
  // Wait for dashboard to load
  await this.page.waitForTimeout(3000);
  
  // Check for forms dashboard specific content
  const hasDashboardContent = await this.pageContainsText('My Forms') ||
                             await this.pageContainsText('Your Forms') ||
                             await this.pageContainsText('Create Form');
  
  if (!hasDashboardContent) {
    await this.takeScreenshot('dashboard-forms-content-verification-failed');
    const pageText = await this.page.textContent('body');
    console.log('Current page content:', pageText?.substring(0, 500));
    console.log('Current URL:', this.page.url());
  }
  
  expect(hasDashboardContent).toBeTruthy();
  console.log('✅ Successfully verified dashboard with forms content');
});

// Template navigation and interaction steps
When('I click the "Create Form" button on dashboard', async function (this: E2EWorld) {
  if (!this.page) {
    throw new Error('Page not initialized.');
  }

  try {
    // Look for the Create Form button
    const createFormButton = this.page.locator('button:has-text("Create Form")');
    
    await createFormButton.waitFor({ state: 'visible', timeout: 10000 });
    await createFormButton.click();
    
    // Wait for navigation
    await this.page.waitForTimeout(2000);
    
    console.log('✅ Clicked Create Form button');
  } catch (error) {
    await this.takeScreenshot('create-form-button-click-failed');
    throw new Error(`Could not click Create Form button: ${error}`);
  }
});

Then('I should be redirected to templates page', async function (this: E2EWorld) {
  if (!this.page) {
    throw new Error('Page not initialized.');
  }
  
  // Wait for navigation to complete
  await this.page.waitForTimeout(2000);
  
  const currentUrl = this.page.url();
  expect(currentUrl).toContain('/templates');
  
  console.log('✅ Successfully redirected to templates page');
});

Then('I should see available templates', async function (this: E2EWorld) {
  if (!this.page) {
    throw new Error('Page not initialized.');
  }
  
  // Wait for templates to load
  await this.page.waitForTimeout(3000);
  
  // Check for template page content
  const hasTemplateContent = await this.pageContainsText('Form Templates') ||
                            await this.pageContainsText('Templates') ||
                            await this.isElementVisible('[data-testid="template-card"]');
  
  if (!hasTemplateContent) {
    await this.takeScreenshot('templates-page-verification-failed');
    const pageText = await this.page.textContent('body');
    console.log('Templates page content:', pageText?.substring(0, 500));
  }
  
  expect(hasTemplateContent).toBeTruthy();
  console.log('✅ Successfully verified templates are visible');
});

When('I select the first available template', async function (this: E2EWorld) {
  if (!this.page) {
    throw new Error('Page not initialized.');
  }

  try {
    // Wait for template cards to load
    await this.page.waitForTimeout(2000);
    
    // Find the first template card and its "Use Template" button
    const firstTemplateCard = this.page.locator('[data-testid="template-card"]').first();
    await firstTemplateCard.waitFor({ state: 'visible', timeout: 10000 });
    
    // Look for the "Use Template" button within the card
    const useTemplateButton = firstTemplateCard.locator('button:has-text("Use Template")');
    await useTemplateButton.waitFor({ state: 'visible', timeout: 5000 });
    await useTemplateButton.click();
    
    // Wait for the popover to appear
    await this.page.waitForTimeout(1000);
    
    console.log('✅ Selected first available template');
  } catch (error) {
    await this.takeScreenshot('template-selection-failed');
    throw new Error(`Could not select template: ${error}`);
  }
});

When('I fill in the form creation details:', async function (this: E2EWorld, dataTable) {
  if (!this.page) {
    throw new Error('Page not initialized.');
  }

  const rows = dataTable.hashes();
  
  for (const row of rows) {
    const fieldName = row['Field Name'];
    const value = row['Value'];
    
    try {
      if (fieldName === 'Form Title') {
        // Find the form title input in the popover
        const titleInput = this.page.locator('#form-title');
        await titleInput.waitFor({ state: 'visible', timeout: 5000 });
        await titleInput.clear();
        await titleInput.fill(value);
      } else if (fieldName === 'Description') {
        // Find the description textarea in the popover
        const descriptionInput = this.page.locator('#form-description');
        await descriptionInput.waitFor({ state: 'visible', timeout: 5000 });
        await descriptionInput.clear();
        await descriptionInput.fill(value);
      }
      
      // Store the form data for later verification
      this.setTestData(fieldName.toLowerCase().replace(' ', ''), value);
      
    } catch (error) {
      await this.takeScreenshot(`form-creation-field-${fieldName.replace(' ', '-')}-failed`);
      throw new Error(`Could not fill ${fieldName}: ${error}`);
    }
  }
  
  // Wait for any validation
  await this.page.waitForTimeout(500);
  console.log('✅ Filled form creation details');
});

When('I click the "Create Form" button in the template popover', async function (this: E2EWorld) {
  if (!this.page) {
    throw new Error('Page not initialized.');
  }

  try {
    // Find the Create Form button in the popover
    const createButton = this.page.locator('button:has-text("Create Form")').last();
    
    await createButton.waitFor({ state: 'visible', timeout: 5000 });
    await createButton.click();
    
    // Wait for form creation and navigation
    await this.page.waitForTimeout(3000);
    
    console.log('✅ Clicked Create Form button in popover');
  } catch (error) {
    await this.takeScreenshot('create-form-popover-button-failed');
    throw new Error(`Could not click Create Form button in popover: ${error}`);
  }
});

Then('I should be redirected to the form builder page', async function (this: E2EWorld) {
  if (!this.page) {
    throw new Error('Page not initialized.');
  }
  
  // Wait for navigation to complete
  await this.page.waitForTimeout(3000);
  
  const currentUrl = this.page.url();
  
  // Check if we're on a form dashboard/builder page (contains form ID)
  const isOnFormPage = currentUrl?.includes('/dashboard/form/') || 
                      currentUrl?.includes('/form/') ||
                      currentUrl?.includes('/builder/');
  
  if (!isOnFormPage) {
    await this.takeScreenshot('form-builder-redirect-failed');
    console.log('Expected form builder page, but current URL is:', currentUrl);
  }
  
  expect(isOnFormPage).toBeTruthy();
  console.log('✅ Successfully redirected to form builder page');
});

Then('I should see the form builder interface', async function (this: E2EWorld) {
  if (!this.page) {
    throw new Error('Page not initialized.');
  }
  
  // Wait for form builder interface to load
  await this.page.waitForTimeout(3000);
  
  // Check for form builder specific content
  const hasBuilderContent = await this.pageContainsText('Form Builder') ||
                           await this.pageContainsText('Edit Form') ||
                           await this.pageContainsText('Form Dashboard') ||
                           await this.isElementVisible('[data-testid="form-builder"]');
  
  if (!hasBuilderContent) {
    await this.takeScreenshot('form-builder-interface-verification-failed');
    const pageText = await this.page.textContent('body');
    console.log('Form builder page content:', pageText?.substring(0, 500));
    console.log('Current URL:', this.page.url());
  }
  
  expect(hasBuilderContent).toBeTruthy();
  console.log('✅ Successfully verified form builder interface is visible');
});