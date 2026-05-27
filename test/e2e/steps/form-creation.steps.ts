/**
 * Form creation and builder navigation steps for E2E tests
 * Handles template selection, form dashboard, and builder operations
 */

import { Then, When } from '@cucumber/cucumber';
import { expect } from '@playwright/test';
import { CustomWorld } from '../support/world';
import { expectPoll } from '../support/expectPoll';

/**
 * Create a form from the first template in the gallery
 */
When('I create a form from the first template', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  // Ensure we're on the dashboard
  await this.page.goto('/dashboard');

  // Navigate to the create wizard via dashboard CTA
  const createButton = this.page.getByRole('button', { name: /create form/i });
  await createButton.click();

  // The wizard shows a choice screen — pick "Start from Template"
  const templateChoice = this.page.getByRole('button', { name: /start from template/i });
  await templateChoice.waitFor({ timeout: 10_000 });
  await templateChoice.click();

  // Wait for templates to load and click the first card to select it
  const firstTemplateCard = this.page.getByTestId('template-card').first();
  await firstTemplateCard.waitFor({ timeout: 30_000 });
  await firstTemplateCard.scrollIntoViewIfNeeded();
  await firstTemplateCard.click();

  // A confirm bar appears at the bottom with a title input
  const titleInput = this.page.getByPlaceholder(/enter a title for your form/i);
  await titleInput.waitFor({ timeout: 10_000 });
  const formTitle = `E2E Template Test ${Date.now()}`;
  this.newFormTitle = formTitle;
  await titleInput.fill(formTitle);

  const submitButton = this.page.getByRole('button', { name: /create from template/i });
  await submitButton.click();
});

/**
 * Verify user is on the form dashboard after creation
 */
Then('I should be on the new form dashboard', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  await expect(this.page).toHaveURL(/\/dashboard\/form\/[^/]+$/, {
    timeout: 45_000,
  });

  const sidebar = this.page.getByTestId('app-sidebar');
  await expect(sidebar).toBeVisible({ timeout: 30_000 });
});

/**
 * Open the collaborative builder for the form
 */
When('I open the collaborative builder', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  const editFormButton = this.page.getByTestId('edit-form-button');
  await editFormButton.click();

  const builderRoot = this.page.getByTestId('collaborative-form-builder');
  await expect(builderRoot).toBeVisible({ timeout: 45_000 });
});

/**
 * Add a new page in the builder
 */
When('I add a new page in the builder', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  const addPageButton = this.page.getByTestId('add-page-button');

  // Scroll to button and wait for it to be visible
  await addPageButton.scrollIntoViewIfNeeded();
  await expect(addPageButton).toBeVisible({ timeout: 10_000 });
  await addPageButton.click();

  // Wait until a new page item appears (at least 2 pages)
  const pagesList = this.page.getByTestId('pages-list');
  await expectPoll(async () => {
    const count = await pagesList.locator('[data-testid^="page-item-"]').count();
    return count >= 2;
  }, { message: 'Expected at least 2 pages after adding', timeout: 15_000, interval: 500 });
});

/**
 * Navigate back to form dashboard from builder
 */
When('I navigate back to the form dashboard', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  // Click back button or navigate to dashboard
  await this.page.goBack();

  // Wait for form dashboard to load
  const sidebar = this.page.getByTestId('app-sidebar');
  await expect(sidebar).toBeVisible({ timeout: 30_000 });
});
