/**
 * Field logic-summary row steps: the "N logic rules use this field →" row
 * shown beneath the field settings panel (FieldLogicSummaryRow) when the
 * selected field has referencing condition rules. Deep links into the Logic
 * tab pre-filtered via `?field=<id>`, which ConditionsTab surfaces as a
 * dismissible chip (`condition-field-filter-chip`). See epic #226, issue #229.
 *
 * Distinct from the older per-field-card "rule-count chip"
 * (`field-rule-count-<fieldId>`, see conditional-logic.steps.ts) — both are
 * separate UI elements that can coexist.
 */

import { When, Then } from '@cucumber/cucumber';
import { expect } from '@playwright/test';
import { CustomWorld } from '../support/world';

Then('I should not see the field logic-summary row', async function (this: CustomWorld) {
  if (!this.page) throw new Error('Page is not initialized');
  await expect(this.page.getByTestId('field-logic-summary')).toHaveCount(0, { timeout: 5_000 });
});

Then(
  'I should see the field logic-summary row with count {string}',
  async function (this: CustomWorld, count: string) {
    if (!this.page) throw new Error('Page is not initialized');
    const row = this.page.getByTestId('field-logic-summary');
    await expect(row).toBeVisible({ timeout: 10_000 });
    await expect(row).toContainText(count);
  }
);

When('I click the field logic-summary row', async function (this: CustomWorld) {
  if (!this.page) throw new Error('Page is not initialized');
  const row = this.page.getByTestId('field-logic-summary');
  await expect(row).toBeVisible({ timeout: 10_000 });
  await row.click();
});

Then(
  'I should see the condition field filter chip for {string}',
  async function (this: CustomWorld, fieldLabel: string) {
    if (!this.page) throw new Error('Page is not initialized');
    const chip = this.page.getByTestId('condition-field-filter-chip');
    await expect(chip).toBeVisible({ timeout: 10_000 });
    await expect(chip).toContainText(fieldLabel);
  }
);

When('I dismiss the condition field filter chip', async function (this: CustomWorld) {
  if (!this.page) throw new Error('Page is not initialized');
  await this.page.getByTestId('condition-field-filter-clear').click();
});

Then('I should not see the condition field filter chip', async function (this: CustomWorld) {
  if (!this.page) throw new Error('Page is not initialized');
  await expect(this.page.getByTestId('condition-field-filter-chip')).toHaveCount(0, {
    timeout: 5_000,
  });
});

Then(
  'the builder URL should not contain {string}',
  async function (this: CustomWorld, substring: string) {
    if (!this.page) throw new Error('Page is not initialized');
    expect(this.page.url()).not.toContain(substring);
  }
);
