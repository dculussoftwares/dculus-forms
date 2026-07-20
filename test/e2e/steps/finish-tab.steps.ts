/**
 * Finish tab (builder journey rail) steps for E2E tests.
 * Covers navigating to the Thank You editor via the builder's Finish tab —
 * the replacement surface for the old Settings > Thank You section (see #166).
 */

import { When } from '@cucumber/cucumber';
import { expect } from '@playwright/test';
import { CustomWorld } from '../support/world';

/**
 * Navigate from the form dashboard into the collaborative builder
 */
When('I navigate to the form builder', async function (this: CustomWorld) {
    if (!this.page) {
        throw new Error('Page is not initialized');
    }

    const builderButton = this.page.getByTestId('quick-action-builder');
    await expect(builderButton).toBeVisible({ timeout: 10_000 });
    await builderButton.click();

    // Wait for the builder shell to load
    const collaborativeBuilder = this.page.getByTestId('collaborative-form-builder');
    await expect(collaborativeBuilder).toBeVisible({ timeout: 30_000 });
});

/**
 * Click the Finish step on the journey rail
 */
When('I click on the finish tab', async function (this: CustomWorld) {
    if (!this.page) {
        throw new Error('Page is not initialized');
    }

    const finishTab = this.page.getByTestId('tab-finish');
    await expect(finishTab).toBeVisible({ timeout: 10_000 });
    await finishTab.click();

    // Wait for the Thank You editor to load
    const messageEditor = this.page.getByTestId('thank-you-enabled-checkbox');
    await expect(messageEditor).toBeVisible({ timeout: 10_000 });
});

/**
 * Navigate from the builder back to the form dashboard
 */
When('I navigate from the builder to the form dashboard', async function (this: CustomWorld) {
    if (!this.page) {
        throw new Error('Page is not initialized');
    }

    // Extract form ID from current URL (format: /dashboard/form/{formId}/builder/finish)
    const currentUrl = this.page.url();
    const formIdMatch = currentUrl.match(/\/dashboard\/form\/([^/]+)/);

    if (!formIdMatch) {
        throw new Error(`Could not extract form ID from URL: ${currentUrl}`);
    }

    const formId = formIdMatch[1];

    await this.page.goto(`${this.baseUrl}/dashboard/form/${formId}`);

    const sidebar = this.page.getByTestId('app-sidebar');
    await expect(sidebar).toBeVisible({ timeout: 30_000 });

    await this.page.waitForTimeout(2000);
});
