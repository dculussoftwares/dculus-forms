/**
 * Field Library steps: the rail's "+ Add content" mega-panel (search, recent,
 * click/Enter-to-add) and its pin-to-dock mode. See epic #226, ticket #230.
 */

import { When, Then } from '@cucumber/cucumber';
import { expect } from '@playwright/test';
import { CustomWorld } from '../support/world';

// Mirrors FieldTypesPanel.tsx's DraggableFieldType testid slug: the tile's
// label, lowercased, spaces collapsed to single dashes.
const fieldTypeTestId = (label: string) =>
  `field-type-${label.replace(/\s+/g, '-').toLowerCase()}`;

When('I open the field library', async function (this: CustomWorld) {
  if (!this.page) throw new Error('Page is not initialized');
  await this.page.getByTestId('rail-add-content-button').click();
});

Then(
  'I should see the field type {string} in the library',
  async function (this: CustomWorld, label: string) {
    if (!this.page) throw new Error('Page is not initialized');
    await expect(this.page.getByTestId(fieldTypeTestId(label))).toBeVisible({
      timeout: 10_000,
    });
  }
);

Then(
  'I should not see the field type {string} in the library',
  async function (this: CustomWorld, label: string) {
    if (!this.page) throw new Error('Page is not initialized');
    await expect(this.page.getByTestId(fieldTypeTestId(label))).toHaveCount(0);
  }
);

When(
  'I click the field type {string} in the library',
  async function (this: CustomWorld, label: string) {
    if (!this.page) throw new Error('Page is not initialized');
    await this.page.getByTestId(fieldTypeTestId(label)).click();
  }
);

When(
  'I search the field library for {string}',
  async function (this: CustomWorld, query: string) {
    if (!this.page) throw new Error('Page is not initialized');
    await this.page.getByTestId('field-library-search').fill(query);
  }
);

When('I press Enter in the field library search', async function (this: CustomWorld) {
  if (!this.page) throw new Error('Page is not initialized');
  await this.page.getByTestId('field-library-search').press('Enter');
});

When('I pin the field library', async function (this: CustomWorld) {
  if (!this.page) throw new Error('Page is not initialized');
  await this.page.getByTestId('field-library-pin-button').click();
});

When('I unpin the field library', async function (this: CustomWorld) {
  if (!this.page) throw new Error('Page is not initialized');
  await this.page.getByTestId('field-library-unpin-button').click();
});

Then('the field library should be docked', async function (this: CustomWorld) {
  if (!this.page) throw new Error('Page is not initialized');
  await expect(this.page.getByTestId('field-library-docked')).toBeVisible({
    timeout: 10_000,
  });
});

Then('the field library should not be docked', async function (this: CustomWorld) {
  if (!this.page) throw new Error('Page is not initialized');
  await expect(this.page.getByTestId('field-library-docked')).toHaveCount(0);
});

When('I press {string} in the builder', async function (this: CustomWorld, key: string) {
  if (!this.page) throw new Error('Page is not initialized');
  // Blur any focused input first so the shortcut sees "no input focused",
  // matching the real "anywhere in the Content tab" trigger condition — without
  // clicking, which could hit an unrelated element underneath the cursor.
  await this.page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await this.page.keyboard.press(key);
});

Then('I should not see the field library search input', async function (this: CustomWorld) {
  if (!this.page) throw new Error('Page is not initialized');
  await expect(this.page.getByTestId('field-library-search')).toHaveCount(0);
});
