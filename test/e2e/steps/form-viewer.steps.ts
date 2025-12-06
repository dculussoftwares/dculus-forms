/**
 * Form viewer interaction steps for E2E tests
 * Handles viewer navigation, pagination, and field visibility verification
 */

import { When, Then } from '@cucumber/cucumber';
import { expect } from '@playwright/test';
import { CustomWorld } from '../support/world';

/**
 * Click next button in viewer to go to next page
 */
When('I click next in the viewer', async function (this: CustomWorld) {
  if (!this.viewerPage) {
    throw new Error('Viewer page is not initialized');
  }

  const nextButton = this.viewerPage.getByTestId('viewer-next-button');
  await expect(nextButton).toBeVisible({ timeout: 10_000 });
  await nextButton.click();

  // Wait for page transition
  await this.viewerPage.waitForTimeout(500);
});

/**
 * Click previous button in viewer to go to previous page
 */
When('I click previous in the viewer', async function (this: CustomWorld) {
  if (!this.viewerPage) {
    throw new Error('Viewer page is not initialized');
  }

  const prevButton = this.viewerPage.getByTestId('viewer-prev-button');
  await expect(prevButton).toBeVisible({ timeout: 10_000 });
  await prevButton.click();

  // Wait for page transition
  await this.viewerPage.waitForTimeout(500);
});

/**
 * Verify current page number in viewer
 */
Then('I should be on viewer page {int} of {int}', async function (this: CustomWorld, currentPage: number, totalPages: number) {
  if (!this.viewerPage) {
    throw new Error('Viewer page is not initialized');
  }

  const indicator = this.viewerPage.getByTestId('viewer-page-indicator');
  await expect(indicator).toBeVisible({ timeout: 30_000 });
  await expect(indicator).toContainText(`Page ${currentPage} of ${totalPages}`);
});

/**
 * Verify field is visible on current viewer page
 */
Then('I should see field {string} on the current page', async function (this: CustomWorld, fieldLabel: string) {
  if (!this.viewerPage) {
    throw new Error('Viewer page is not initialized');
  }

  // Check if the field label is visible on the current page
  const field = this.viewerPage.getByText(fieldLabel).first();
  await expect(field).toBeVisible({ timeout: 10_000 });
});
