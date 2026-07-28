/**
 * Builder shell steps: 3-tab navigation (Content/Logic/Automations), old-URL
 * redirects, and the Preview/Settings overlays. See epic #226, ticket #227.
 */

import { When, Then } from '@cucumber/cucumber';
import { expect } from '@playwright/test';
import { CustomWorld } from '../support/world';

Then('I should see the {string} tab active', async function (this: CustomWorld, tabId: string) {
  if (!this.page) throw new Error('Page is not initialized');
  const tab = this.page.getByTestId(`tab-${tabId}`);
  await expect(tab).toBeVisible({ timeout: 10_000 });
  await expect(tab).toHaveAttribute('data-state', 'active');
});

Then('I should see the {string} tab', async function (this: CustomWorld, tabId: string) {
  if (!this.page) throw new Error('Page is not initialized');
  await expect(this.page.getByTestId(`tab-${tabId}`)).toBeVisible({ timeout: 10_000 });
});

Then('I should not see a {string} tab', async function (this: CustomWorld, tabId: string) {
  if (!this.page) throw new Error('Page is not initialized');
  await expect(this.page.getByTestId(`tab-${tabId}`)).toHaveCount(0);
});

When(
  'I navigate directly to the old builder URL {string}',
  async function (this: CustomWorld, oldPath: string) {
    if (!this.page) throw new Error('Page is not initialized');
    if (!this.currentFormId) throw new Error('No current form id');
    await this.page.goto(`${this.baseUrl}/dashboard/form/${this.currentFormId}/builder/${oldPath}`);
    const builderRoot = this.page.getByTestId('collaborative-form-builder');
    await expect(builderRoot).toBeVisible({ timeout: 45_000 });
  }
);

Then(
  'the builder URL should become {string}',
  async function (this: CustomWorld, expectedSuffix: string) {
    if (!this.page) throw new Error('Page is not initialized');
    if (!this.currentFormId) throw new Error('No current form id');
    const expectedUrl = `${this.baseUrl}/dashboard/form/${this.currentFormId}/builder/${expectedSuffix}`;
    // The Content tab's journey rail (#228) auto-selects the first page once it loads
    // and reflects that in the URL as a trailing `screen=page:<id>` param — appended
    // with `&` if the redirect target already has a `?`, otherwise with `?`. Allow
    // that (or nothing, for redirects that already land on `?screen=intro`) after the
    // expected redirect target rather than requiring an exact match.
    const separator = expectedSuffix.includes('?') ? '&' : '\\?';
    const pattern = new RegExp(`^${escapeRegExp(expectedUrl)}(${separator}.*)?$`);
    await expect(this.page).toHaveURL(pattern, { timeout: 10_000 });
  }
);

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

When('I click the header Preview button', async function (this: CustomWorld) {
  if (!this.page) throw new Error('Page is not initialized');
  await this.page.getByTestId('header-preview-button').click();
});

Then('the preview overlay should be open', async function (this: CustomWorld) {
  if (!this.page) throw new Error('Page is not initialized');
  await expect(this.page.getByTestId('preview-overlay')).toBeVisible({ timeout: 10_000 });
});

Then('the preview overlay should be closed', async function (this: CustomWorld) {
  if (!this.page) throw new Error('Page is not initialized');
  await expect(this.page.getByTestId('preview-overlay')).toBeHidden({ timeout: 10_000 });
});

When('I click the header settings gear', async function (this: CustomWorld) {
  if (!this.page) throw new Error('Page is not initialized');
  await this.page.getByTestId('header-settings-gear').click();
});

Then('the settings overlay should be open', async function (this: CustomWorld) {
  if (!this.page) throw new Error('Page is not initialized');
  await expect(this.page.getByTestId('settings-overlay')).toBeVisible({ timeout: 10_000 });
});

Then('the settings overlay should be closed', async function (this: CustomWorld) {
  if (!this.page) throw new Error('Page is not initialized');
  await expect(this.page.getByTestId('settings-overlay')).toBeHidden({ timeout: 10_000 });
});

Then('I should not see the header settings gear', async function (this: CustomWorld) {
  if (!this.page) throw new Error('Page is not initialized');
  await expect(this.page.getByTestId('header-settings-gear')).toHaveCount(0);
});

When('I press Escape', async function (this: CustomWorld) {
  if (!this.page) throw new Error('Page is not initialized');
  await this.page.keyboard.press('Escape');
});
