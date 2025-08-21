import { Page, expect } from '@playwright/test';

export interface FormCreationData {
  templateName?: string;
  formTitle: string;
  description?: string;
}

/**
 * Navigate to dashboard and verify it loads correctly
 */
export async function navigateToDashboard(page: Page) {
  await page.goto('http://localhost:3000/');
  
  // Verify dashboard loads
  await expect(page).toHaveURL('http://localhost:3000/');
  await expect(page.getByRole('heading', { name: 'Your Forms' })).toBeVisible();
}

/**
 * Navigate from dashboard to templates page
 */
export async function navigateToTemplates(page: Page) {
  // Click the "Create Form" button on dashboard
  await page.getByRole('button', { name: 'Create Form' }).click();
  
  // Verify navigation to templates page
  await expect(page).toHaveURL('http://localhost:3000/dashboard/templates');
  await expect(page.getByText('Form Templates')).toBeVisible();
}

/**
 * Select a template and create a form from it
 */
export async function useTemplate(page: Page, formData: FormCreationData) {
  // Wait for templates to load
  await page.waitForSelector('[data-testid="template-card"]', { timeout: 10000 }).catch(() => {
    // If no test-id exists, try generic template card selector
    return page.waitForSelector('.group.relative.overflow-hidden', { timeout: 10000 });
  });
  
  // Find the first template card and hover to reveal the "Use Template" button
  const templateCard = page.locator('.group.relative.overflow-hidden').first();
  await templateCard.hover();
  
  // Click the "Use Template" button
  await page.getByRole('button', { name: 'Use Template' }).click();
  
  // Verify popover opens
  await expect(page.getByText('Create Form from Template')).toBeVisible();
  
  // Fill out the form creation form
  await page.getByLabel('Form Title').fill(formData.formTitle);
  
  if (formData.description) {
    await page.getByLabel('Description').fill(formData.description);
  }
  
  // Submit the form creation
  await page.getByRole('button', { name: 'Create Form' }).click();
  
  // Wait for form creation to complete
  await page.waitForTimeout(3000); // Allow time for GraphQL mutation and navigation
}

/**
 * Verify a form was created successfully by checking the form dashboard
 */
export async function verifyFormCreated(page: Page, formTitle: string) {
  // Should be on form dashboard page with pattern /dashboard/form/{formId}
  await expect(page).toHaveURL(/\/dashboard\/form\/[\w-]+$/);
  
  // Verify form title is visible somewhere on the page
  await expect(page.getByText(formTitle)).toBeVisible();
}

/**
 * Check if dashboard shows the newly created form in the forms list
 */
export async function verifyFormInDashboard(page: Page, formTitle: string) {
  // Navigate back to main dashboard
  await page.goto('http://localhost:3000/');
  
  // Wait for forms to load
  await page.waitForTimeout(2000);
  
  // Check if the form appears in the forms list
  const formCard = page.getByText(formTitle);
  await expect(formCard).toBeVisible();
}

/**
 * Navigate to form builder for a specific form
 */
export async function openFormBuilder(page: Page, formId: string) {
  await page.goto(`http://localhost:3000/dashboard/form/${formId}/builder`);
  
  // Verify form builder loaded
  await expect(page).toHaveURL(`http://localhost:3000/dashboard/form/${formId}/builder`);
  
  // Wait for collaborative form builder to initialize
  await page.waitForTimeout(2000);
}

/**
 * Check if templates page loads correctly with templates
 */
export async function verifyTemplatesPageLoaded(page: Page) {
  await expect(page).toHaveURL('http://localhost:3000/dashboard/templates');
  await expect(page.getByText('Form Templates')).toBeVisible();
  
  // Check if at least one template is visible
  await page.waitForSelector('.group.relative.overflow-hidden', { timeout: 10000 });
  
  const templateCount = await page.locator('.group.relative.overflow-hidden').count();
  expect(templateCount).toBeGreaterThan(0);
}

/**
 * Get form ID from URL when on form dashboard page
 */
export async function getFormIdFromUrl(page: Page): Promise<string> {
  const url = page.url();
  const match = url.match(/\/dashboard\/form\/([\w-]+)/);
  
  if (!match || !match[1]) {
    throw new Error('Could not extract form ID from URL: ' + url);
  }
  
  return match[1];
}

/**
 * Generate unique form data for testing
 */
export function generateTestFormData(suffix?: string): FormCreationData {
  const uniqueId = suffix || Math.random().toString(36).substring(7);
  
  return {
    formTitle: `Test Form ${uniqueId}`,
    description: `Test form description ${uniqueId}`,
  };
}

/**
 * Wait for form creation to complete and verify success
 */
export async function waitForFormCreation(page: Page, expectedTitle: string) {
  // Wait for navigation away from templates page
  await page.waitForFunction(() => !window.location.pathname.includes('/templates'), {
    timeout: 10000
  });
  
  // Verify we're on a form dashboard page
  await expect(page).toHaveURL(/\/dashboard\/form\/[\w-]+$/);
  
  // Verify form title appears as the main heading (h1) on the page
  await expect(page.locator('h1').filter({ hasText: expectedTitle })).toBeVisible({ timeout: 10000 });
}