/**
 * Journey rail steps: Intro / Pages / Thank You selection driving the canvas + URL,
 * plus page reorder via the rail and the VIEWER read-only rail. See epic #226,
 * ticket #228.
 */

import { When, Then } from '@cucumber/cucumber';
import { expect, type Locator, type Page } from '@playwright/test';
import { CustomWorld } from '../support/world';
import { dragOnto } from './helpers/common';

// A prefix-based CSS selector (`[data-testid^="rail-page-"]`) also matches every
// nested testid that happens to share the prefix (rail-page-title-<n>,
// rail-page-header-<n>, rail-page-drag-handle-<n>, ...) — match the group
// container's exact testid shape instead so this can't collide with new ones.
const railPageGroupByTitle = (page: Page, title: string): Locator =>
  page
    .getByTestId(/^rail-page-\d+$/)
    .filter({ has: page.getByText(title, { exact: true }) });

When('I click the rail Intro card', async function (this: CustomWorld) {
  if (!this.page) throw new Error('Page is not initialized');
  await this.page.getByTestId('rail-intro').click();
});

When('I click the rail Thank You card', async function (this: CustomWorld) {
  if (!this.page) throw new Error('Page is not initialized');
  await this.page.getByTestId('rail-thankyou').click();
});

When('I click the rail page {string}', async function (this: CustomWorld, pageTitle: string) {
  if (!this.page) throw new Error('Page is not initialized');
  const group = railPageGroupByTitle(this.page, pageTitle);
  await expect(group).toBeVisible({ timeout: 10_000 });
  // Click the header row, not the title text itself — the title has its own
  // click handler (rename, for editors) that stops propagation.
  await group.locator('[data-testid^="rail-page-header-"]').click();
});

When('I click the rail field chip {string}', async function (this: CustomWorld, fieldLabel: string) {
  if (!this.page) throw new Error('Page is not initialized');
  // hasText does a substring match, which would also match "Show bonus field?"
  // when looking for "Bonus Field" — require an exact label match instead.
  const chip = this.page
    .locator('[data-testid^="rail-field-"]')
    .filter({ has: this.page.getByText(fieldLabel, { exact: true }) });
  await expect(chip).toBeVisible({ timeout: 10_000 });
  await chip.click();
});

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

Then(
  'the builder URL should contain {string}',
  async function (this: CustomWorld, substring: string) {
    if (!this.page) throw new Error('Page is not initialized');
    // page.url() returns the raw (percent-encoded) URL, and URLSearchParams
    // encodes ":" as "%3A" in query values (e.g. screen=page:<id>) — accept either.
    const pattern = escapeRegExp(substring).replace(/:/g, '(:|%3A)');
    await expect(this.page).toHaveURL(new RegExp(pattern), { timeout: 10_000 });
  }
);

Then('the rail Intro card should be selected', async function (this: CustomWorld) {
  if (!this.page) throw new Error('Page is not initialized');
  await expect(this.page.getByTestId('rail-intro')).toHaveAttribute('aria-pressed', 'true', {
    timeout: 10_000,
  });
});

Then('the rail Thank You card should be selected', async function (this: CustomWorld) {
  if (!this.page) throw new Error('Page is not initialized');
  await expect(this.page.getByTestId('rail-thankyou')).toHaveAttribute('aria-pressed', 'true', {
    timeout: 10_000,
  });
});

Then('I should see the intro screen in the canvas', async function (this: CustomWorld) {
  if (!this.page) throw new Error('Page is not initialized');
  await expect(this.page.getByTestId('viewer-cta-button')).toBeVisible({ timeout: 10_000 });
});

Then('I should see the thank you screen in the canvas', async function (this: CustomWorld) {
  if (!this.page) throw new Error('Page is not initialized');
  await expect(this.page.getByTestId('thank-you-display')).toBeVisible({ timeout: 10_000 });
});

Then(
  'I should see the field {string} in the canvas',
  async function (this: CustomWorld, fieldLabel: string) {
    if (!this.page) throw new Error('Page is not initialized');
    const canvas = this.page.getByTestId('droppable-page');
    // The field card shows the label both as its own truncated title and inside its
    // live input preview (e.g. a <label> for the rendered control) — both are valid
    // evidence the field is here, so just check the first match is visible.
    await expect(canvas.getByText(fieldLabel, { exact: true }).first()).toBeVisible({
      timeout: 10_000,
    });
  }
);

Then('the field settings panel should be visible', async function (this: CustomWorld) {
  if (!this.page) throw new Error('Page is not initialized');
  await expect(this.page.getByTestId('field-settings-panel')).toBeVisible({ timeout: 10_000 });
});

Then(
  'the rail pages should be in order {string}',
  async function (this: CustomWorld, expectedCsv: string) {
    if (!this.page) throw new Error('Page is not initialized');
    const expected = expectedCsv.split(',').map((s) => s.trim());
    // Precise testid match: "rail-page-title-" is also a prefix of
    // rail-page-title-input-<n> (the rename input, rendered only while editing).
    const titles = this.page.getByTestId(/^rail-page-title-\d+$/);
    await expect(titles).toHaveCount(expected.length, { timeout: 10_000 });
    await expect(titles).toHaveText(expected, { timeout: 10_000 });
  }
);

When(
  'I drag rail page {string} onto rail page {string}',
  async function (this: CustomWorld, sourceTitle: string, targetTitle: string) {
    if (!this.page) throw new Error('Page is not initialized');
    const source = railPageGroupByTitle(this.page, sourceTitle).locator(
      '[data-testid^="rail-page-drag-handle-"]'
    );
    const target = railPageGroupByTitle(this.page, targetTitle);
    await dragOnto(source, target);
  }
);

Then('I should not see the rail add content button', async function (this: CustomWorld) {
  if (!this.page) throw new Error('Page is not initialized');
  await expect(this.page.getByTestId('rail-add-content-button')).toHaveCount(0);
});

Then('I should not see the rail add page button', async function (this: CustomWorld) {
  if (!this.page) throw new Error('Page is not initialized');
  await expect(this.page.getByTestId('add-page-button')).toHaveCount(0);
});

Then('I should not see any rail page drag handles', async function (this: CustomWorld) {
  if (!this.page) throw new Error('Page is not initialized');
  await expect(this.page.locator('[data-testid^="rail-page-drag-handle-"]')).toHaveCount(0);
});
