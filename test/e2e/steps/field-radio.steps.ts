import { Then, When } from '@cucumber/cucumber';
import { expect } from '@playwright/test';
import { CustomWorld } from '../support/world';

// Drag and drop step
Then('I drag a radio field onto the page', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  const fieldTile = this.page.getByTestId('field-type-radio');
  const droppablePage = this.page.getByTestId('droppable-page').first();

  const initialCount = await droppablePage.locator('[data-testid^="field-content-"]').count();

  await fieldTile.dragTo(droppablePage);

  await expect(async () => {
    const newCount = await droppablePage.locator('[data-testid^="field-content-"]').count();
    expect(newCount).toBeGreaterThan(initialCount);
  }).toPass({ timeout: 15000 });
});

// Settings panel steps
When('I open the radio field settings', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  const fieldCards = this.page.locator('[data-testid^="draggable-field-"]');
  await expect(fieldCards.last()).toBeVisible({ timeout: 10_000 });
  const lastFieldCard = fieldCards.last();

  await lastFieldCard.hover();

  const settingsButton = lastFieldCard.locator('[data-testid^="field-settings-button-"]');
  await expect(settingsButton).toBeVisible({ timeout: 5_000 });

  await this.page.waitForTimeout(1000);

  await settingsButton.click({ force: true });

  const settingsPanel = this.page.getByTestId('field-settings-panel');
  await expect(settingsPanel).toBeVisible({ timeout: 15_000 });

  await this.page.waitForSelector('#field-label', { timeout: 10_000 });
});

Then('I fill the radio field settings with valid data', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  const settingsPanel = this.page.getByTestId('field-settings-panel');
  await expect(settingsPanel).toBeVisible({ timeout: 15_000 });

  await this.page.waitForSelector('#field-label', { timeout: 10_000 });
  await this.page.fill('#field-label', `Gender Selection Field ${Date.now()}`);
  await this.page.fill('#field-hint', 'Please select your gender.');

  const optionInputs = this.page.locator('input[placeholder="Enter option value"]');
  const optionCount = await optionInputs.count();

  if (optionCount > 0) {
    await optionInputs.nth(0).fill('Male');

    const addOptionButton = this.page.locator('button:has-text("Add Option")');
    if (await addOptionButton.count() > 0) {
      await addOptionButton.click();
      await this.page.waitForTimeout(500);
      await optionInputs.nth(1).fill('Female');

      await addOptionButton.click();
      await this.page.waitForTimeout(500);
      await optionInputs.nth(2).fill('Other');
    }
  }

  const requiredToggle = this.page.locator('#field-required');
  const isChecked = await requiredToggle.isChecked();
  if (!isChecked) {
    await requiredToggle.click();
  }

  await expect(this.page.locator('#field-label')).toHaveValue(/Gender Selection/);
});

Then('I test label and hint validation for radio', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  await this.page.fill('#field-label', '');
  await this.page.locator('#field-hint').click();

  const emptyLabelError = this.page.locator('text=/Field label is required/i').first();
  await expect(emptyLabelError).toBeVisible({ timeout: 5_000 });

  const longLabel = 'A'.repeat(201);
  await this.page.fill('#field-label', longLabel);
  await this.page.locator('#field-hint').click();

  const labelTooLongError = this.page.locator('text=/Label is too long/i').first();
  await expect(labelTooLongError).toBeVisible({ timeout: 5_000 });

  const longHint = 'B'.repeat(501);
  await this.page.fill('#field-hint', longHint);
  await this.page.locator('#field-label').click();

  const hintTooLongError = this.page.locator('text=/Help text is too long/i').first();
  await expect(hintTooLongError).toBeVisible({ timeout: 5_000 });
});

Then('I test options validation for radio', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  const optionInputs = this.page.locator('input[placeholder="Enter option value"]');
  if (await optionInputs.count() > 0) {
    await optionInputs.nth(0).fill('');
    await this.page.locator('#field-label').click();

    const emptyOptionError = this.page.locator('text=/All options must have values/i, text=/Option cannot be empty/i').first();
    await expect(emptyOptionError).toBeVisible({ timeout: 5_000 });
  }

  const longOption = 'C'.repeat(101);
  if (await optionInputs.count() > 0) {
    await optionInputs.nth(0).fill(longOption);
    await this.page.locator('#field-label').click();

    const optionTooLongError = this.page.locator('text=/Option is too long/i').first();
    await expect(optionTooLongError).toBeVisible({ timeout: 5_000 });
  }

  if (await optionInputs.count() >= 2) {
    await optionInputs.nth(0).fill('Male');
    await optionInputs.nth(1).fill('Male');
    await this.page.locator('#field-label').click();

    const duplicateError = this.page.locator('text=/Options must be unique/i').first();
    await expect(duplicateError).toBeVisible({ timeout: 5_000 });
  }
});

Then('I fix all validation errors for radio', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  await this.page.fill('#field-label', `Radio Field ${Date.now()}`);
  await this.page.fill('#field-hint', 'Please select your gender.');

  const optionInputs = this.page.locator('input[placeholder="Enter option value"]');
  if (await optionInputs.count() > 0) {
    await optionInputs.nth(0).fill('Male');
  }
  if (await optionInputs.count() > 1) {
    await optionInputs.nth(1).fill('Female');
  }
  if (await optionInputs.count() > 2) {
    await optionInputs.nth(2).fill('Other');
  }

  await this.page.locator('#field-label').click();
  await this.page.waitForTimeout(1000);
});

Then('I save the radio field settings', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  const saveButton = this.page.getByRole('button', { name: /save/i });
  await saveButton.click();

  await this.page.waitForTimeout(1000);

  const fieldContent = this.page.getByTestId('field-content-1');
  await expect(fieldContent).toBeVisible({ timeout: 5_000 });
});

// Quick fill helper
When('I fill and save the radio field with label {string}', async function (this: CustomWorld, label: string) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  const fieldCard = this.page.locator('[data-testid^="draggable-field-"]').last();
  await fieldCard.hover();

  const settingsButton = fieldCard.locator('[data-testid^="field-settings-button-"]').first();
  await expect(settingsButton).toBeVisible({ timeout: 10_000 });
  await settingsButton.click();

  const settingsPanel = this.page.getByTestId('field-settings-panel');
  await expect(settingsPanel).toBeVisible({ timeout: 15_000 });
  await this.page.waitForSelector('#field-label', { timeout: 10_000 });

  const uniqueLabel = `${label} ${Date.now()}`;
  await this.page.fill('#field-label', uniqueLabel);

  const optionInputs = this.page.locator('input[placeholder^="Option "]');
  const count = await optionInputs.count();

  if (count > 0) {
    for (let i = 0; i < Math.min(3, count); i++) {
      await optionInputs.nth(i).fill(`Option ${i + 1}`);
    }
  }

  const saveButton = this.page.getByRole('button', { name: /save/i });
  await expect(saveButton).toBeEnabled({ timeout: 5_000 });
  await saveButton.click();

  await this.page.waitForTimeout(1000);
});

// Settings persistence step
When('I fill all radio field settings with test data', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  // Define test data
  const testData = {
    label: 'Radio Persistence Test',
    hint: 'This is a test hint for radio persistence',
    defaultValue: '',  // Empty means no default selected
    required: true,
  };

  // Store for later verification
  this.expectedFieldSettings = testData;

  await this.page.waitForSelector('#field-label', { timeout: 10_000 });
  await this.page.fill('#field-label', testData.label);
  await this.page.fill('#field-hint', testData.hint);

  await this.page.waitForTimeout(500);

  const requiredToggle = this.page.locator('#field-required');
  const isChecked = await requiredToggle.isChecked();
  if (!isChecked && testData.required) {
    await requiredToggle.click();
  }

  await expect(this.page.locator('#field-label')).toHaveValue(testData.label);
  await expect(this.page.locator('#field-hint')).toHaveValue(testData.hint);
});
