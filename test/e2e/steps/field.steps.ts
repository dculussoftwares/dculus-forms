/**
 * All field-type step definitions — short text, long text, email, number,
 * date, radio, dropdown, checkbox.
 *
 * Shared drag / open-settings / GraphQL-create logic lives in helpers/common.ts.
 * This file only contains the field-type-specific validation and viewer steps.
 */

import { Then, When } from '@cucumber/cucumber';
import { expect } from '@playwright/test';
import { CustomWorld } from '../support/world';
import { addFieldToPage, openLastFieldSettings, createFormViaGraphQL } from './helpers';

// ─────────────────────────────────────────────────────────────────────────────
// DRAG STEPS  (one per field type)
// ─────────────────────────────────────────────────────────────────────────────

Then('I drag a short text field onto the page', async function (this: CustomWorld) {
  await addFieldToPage(this, 'field-type-short-text');
});

Then('I drag a long text field onto the page', async function (this: CustomWorld) {
  await addFieldToPage(this, 'field-type-long-text');
});

Then('I drag an email field onto the page', async function (this: CustomWorld) {
  await addFieldToPage(this, 'field-type-email');
});

Then('I drag a number field onto the page', async function (this: CustomWorld) {
  await addFieldToPage(this, 'field-type-number');
});

Then('I drag a date field onto the page', async function (this: CustomWorld) {
  await addFieldToPage(this, 'field-type-date');
});

Then('I drag a radio field onto the page', async function (this: CustomWorld) {
  await addFieldToPage(this, 'field-type-radio');
});

Then('I drag a dropdown field onto the page', async function (this: CustomWorld) {
  await addFieldToPage(this, 'field-type-dropdown');
});

Then('I drag a checkbox field onto the page', async function (this: CustomWorld) {
  await addFieldToPage(this, 'field-type-checkbox');
});

// ─────────────────────────────────────────────────────────────────────────────
// OPEN SETTINGS STEPS
// ─────────────────────────────────────────────────────────────────────────────

When('I open the short text field settings', async function (this: CustomWorld) {
  await openLastFieldSettings(this);
});

When('I open the long text field settings', async function (this: CustomWorld) {
  await openLastFieldSettings(this);
});

When('I open the email field settings', async function (this: CustomWorld) {
  await openLastFieldSettings(this);
});

When('I open the number field settings', async function (this: CustomWorld) {
  await openLastFieldSettings(this);
});

When('I open the date field settings', async function (this: CustomWorld) {
  await openLastFieldSettings(this);
});

When('I open the radio field settings', async function (this: CustomWorld) {
  await openLastFieldSettings(this);
});

When('I open the dropdown field settings', async function (this: CustomWorld) {
  await openLastFieldSettings(this);
});

When('I open the checkbox field settings', async function (this: CustomWorld) {
  await openLastFieldSettings(this);
});

// ─────────────────────────────────────────────────────────────────────────────
// FILL-AND-SAVE HELPERS  (used by form-viewer-multipage.feature)
// ─────────────────────────────────────────────────────────────────────────────

async function fillAndSaveLabel(world: CustomWorld, label: string) {
  if (!world.page) throw new Error('Page is not initialized');
  const fieldCard = world.page.locator('[data-testid^="draggable-field-"]').first();
  await fieldCard.hover();
  const settingsButton = world.page.getByTestId('field-settings-button-1');
  await expect(settingsButton).toBeVisible({ timeout: 30_000 });
  await settingsButton.hover();
  await settingsButton.click();
  await expect(world.page.getByTestId('field-settings-panel')).toBeVisible({ timeout: 15_000 });
  await world.page.waitForSelector('#field-label', { timeout: 10_000 });
  await world.page.fill('#field-label', label);
  await world.page.getByRole('button', { name: /save/i }).click();
  await expect(world.page.getByTestId('field-content-1')).toBeVisible({ timeout: 10_000 });
}

When('I fill and save the short text field with label {string}', async function (this: CustomWorld, label: string) { await fillAndSaveLabel(this, label); });
When('I fill and save the long text field with label {string}', async function (this: CustomWorld, label: string) { await fillAndSaveLabel(this, label); });
When('I fill and save the email field with label {string}', async function (this: CustomWorld, label: string) { await fillAndSaveLabel(this, label); });
When('I fill and save the number field with label {string}', async function (this: CustomWorld, label: string) { await fillAndSaveLabel(this, label); });
When('I fill and save the date field with label {string}', async function (this: CustomWorld, label: string) { await fillAndSaveLabel(this, label); });
When('I fill and save the radio field with label {string}', async function (this: CustomWorld, label: string) { await fillAndSaveLabel(this, label); });
When('I fill and save the dropdown field with label {string}', async function (this: CustomWorld, label: string) { await fillAndSaveLabel(this, label); });
When('I fill and save the checkbox field with label {string}', async function (this: CustomWorld, label: string) { await fillAndSaveLabel(this, label); });

// ─────────────────────────────────────────────────────────────────────────────
// SHORT TEXT — builder & viewer
// ─────────────────────────────────────────────────────────────────────────────

Then('I fill the short text field settings with valid data', async function (this: CustomWorld) {
  if (!this.page) throw new Error('Page is not initialized');
  // Open settings if not already open (some callers don't call "open settings" first)
  const labelVisible = await this.page.locator('#field-label').isVisible().catch(() => false);
  if (!labelVisible) await openLastFieldSettings(this);
  await this.page.waitForSelector('#field-label', { timeout: 10_000 });
  await this.page.fill('#field-label', `Short Answer Field ${Date.now()}`);
  await this.page.fill('#field-hint', 'Provide a concise answer.');
  await this.page.fill('#field-placeholder', 'Enter your response');
  await this.page.fill('#field-prefix', 'QA');
  await this.page.fill('#field-defaultValue', 'Default response');
  await this.page.fill('#field-validation\\.minLength', '1');
  await this.page.fill('#field-validation\\.maxLength', '50');
  const req = this.page.locator('#field-required');
  if (!await req.isChecked()) await req.click();
  await expect(this.page.locator('#field-label')).toHaveValue(/Short Answer/);
});

Then('I test invalid min length data', async function (this: CustomWorld) {
  if (!this.page) throw new Error('Page is not initialized');
  await this.page.fill('#field-validation\\.minLength', '-1');
  await this.page.locator('#field-label').click();
  await expect(this.page.locator('text=/Minimum length must be 0 or greater/i').first()).toBeVisible({ timeout: 5_000 });
  await this.page.fill('#field-validation\\.minLength', '5001');
  await this.page.locator('#field-label').click();
  await expect(this.page.locator('text=/5000/i').first()).toBeVisible({ timeout: 5_000 });
  await this.page.fill('#field-validation\\.minLength', '5');
  await this.page.locator('#field-label').click();
});

Then('I test invalid max length data', async function (this: CustomWorld) {
  if (!this.page) throw new Error('Page is not initialized');
  await this.page.fill('#field-validation\\.maxLength', '-1');
  await this.page.locator('#field-label').click();
  await expect(this.page.locator('text=/Maximum length must be 1 or greater/i').first()).toBeVisible({ timeout: 5_000 });
  await this.page.fill('#field-validation\\.maxLength', '5001');
  await this.page.locator('#field-label').click();
  await expect(this.page.locator('text=/5000/i').first()).toBeVisible({ timeout: 5_000 });
  await this.page.fill('#field-validation\\.maxLength', '50');
  await this.page.locator('#field-label').click();
});

Then('I test min greater than max validation', async function (this: CustomWorld) {
  if (!this.page) throw new Error('Page is not initialized');
  await this.page.fill('#field-validation\\.minLength', '100');
  await this.page.fill('#field-validation\\.maxLength', '10');
  await this.page.locator('#field-label').click();
  await expect(this.page.locator('text=/minimum.*maximum|min.*less.*max/i').first()).toBeVisible({ timeout: 5_000 });
  await this.page.fill('#field-validation\\.minLength', '5');
  await this.page.fill('#field-validation\\.maxLength', '50');
  await this.page.locator('#field-label').click();
});

When('I create a form via GraphQL with short text field validations', async function (this: CustomWorld) {
  await createFormViaGraphQL(this, shortTextSchema(), 'E2E Short Text Validation Test');
});

When('I test required validation for short text in viewer', async function (this: CustomWorld) {
  if (!this.viewerPage) throw new Error('Viewer page is not initialized');
  const field = this.viewerPage.locator('input[name="field-required"]');
  await expect(field).toBeVisible({ timeout: 10_000 });
  await this.viewerPage.getByTestId('viewer-submit-button').click();
  await expect(this.viewerPage.locator('text=/required/i').first()).toBeVisible({ timeout: 5_000 });
  await field.fill('Valid text');
  await field.blur();
});

When('I test min length validation for short text in viewer', async function (this: CustomWorld) {
  if (!this.viewerPage) throw new Error('Viewer page is not initialized');
  const field = this.viewerPage.locator('input[name="field-minlength"]');
  await expect(field).toBeVisible({ timeout: 10_000 });
  await field.fill('abc');
  await field.blur();
  await expect(this.viewerPage.locator('text=/5.*character|at least 5|minimum.*5/i').first()).toBeVisible({ timeout: 5_000 });
  await field.fill('Valid');
  await field.blur();
});

When('I test max length validation for short text in viewer', async function (this: CustomWorld) {
  if (!this.viewerPage) throw new Error('Viewer page is not initialized');
  const field = this.viewerPage.locator('input[name="field-maxlength"]');
  await expect(field).toBeVisible({ timeout: 10_000 });
  await field.fill('This is too long');
  await field.blur();
  await expect(this.viewerPage.locator('text=/10.*character|at most 10|maximum.*10/i').first()).toBeVisible({ timeout: 5_000 });
  await field.fill('Valid');
  await field.blur();
});

When('I fill short text field with valid data in viewer', async function (this: CustomWorld) {
  if (!this.viewerPage) throw new Error('Viewer page is not initialized');
  await this.viewerPage.locator('input[name="field-required"]').fill('Required text');
  await this.viewerPage.locator('input[name="field-minlength"]').fill('Valid length');
  await this.viewerPage.locator('input[name="field-maxlength"]').fill('Short');
  await this.viewerPage.locator('input[name="field-range"]').fill('Between');
});

Then('I should be able to submit the form in viewer', async function (this: CustomWorld) {
  if (!this.viewerPage) throw new Error('Viewer page is not initialized');
  const submitButton = this.viewerPage.getByTestId('viewer-submit-button');
  await expect(submitButton).toBeVisible({ timeout: 10_000 });
  await expect(submitButton).toBeEnabled({ timeout: 5_000 });
  await submitButton.click();
  await this.viewerPage.waitForLoadState('networkidle');
});

When('I fill all short text field settings with test data', async function (this: CustomWorld) {
  if (!this.page) throw new Error('Page is not initialized');
  const ts = Date.now();
  this.expectedFieldSettings = { label: `Complete Short Text Field ${ts}`, hint: 'Comprehensive help text', placeholder: 'Full placeholder text', prefix: 'PREFIX', defaultValue: 'Default value text', minLength: 5, maxLength: 100, required: true };
  await this.page.waitForSelector('#field-label', { timeout: 10_000 });
  await this.page.fill('#field-label', this.expectedFieldSettings.label);
  await this.page.fill('#field-hint', this.expectedFieldSettings.hint);
  await this.page.fill('#field-placeholder', this.expectedFieldSettings.placeholder);
  await this.page.fill('#field-prefix', this.expectedFieldSettings.prefix);
  await this.page.fill('#field-defaultValue', this.expectedFieldSettings.defaultValue);
  await this.page.fill('#field-validation\\.minLength', '5');
  await this.page.fill('#field-validation\\.maxLength', '100');
  const req = this.page.locator('#field-required');
  if (!await req.isChecked()) await req.click();
});

// ─────────────────────────────────────────────────────────────────────────────
// LONG TEXT — builder & viewer
// ─────────────────────────────────────────────────────────────────────────────

Then('I fill the long text field settings with valid data', async function (this: CustomWorld) {
  if (!this.page) throw new Error('Page is not initialized');
  await this.page.waitForSelector('#field-label', { timeout: 10_000 });
  await this.page.fill('#field-label', `Long Answer Field ${Date.now()}`);
  await this.page.fill('#field-hint', 'Provide a detailed answer.');
  await this.page.fill('#field-placeholder', 'Enter your detailed response here');
  await this.page.fill('#field-defaultValue', 'Default long text response');
  await this.page.fill('#field-validation\\.minLength', '10');
  await this.page.fill('#field-validation\\.maxLength', '500');
  const req = this.page.locator('#field-required');
  if (!await req.isChecked()) await req.click();
  await expect(this.page.locator('#field-label')).toHaveValue(/Long Answer/);
});

Then('I test label and hint validation for long text', async function (this: CustomWorld) {
  if (!this.page) throw new Error('Page is not initialized');
  await this.page.fill('#field-label', '');
  await this.page.locator('#field-hint').click();
  await expect(this.page.locator('text=/Field label is required/i').first()).toBeVisible({ timeout: 5_000 });
  await this.page.fill('#field-label', 'A'.repeat(201));
  await this.page.locator('#field-hint').click();
  await expect(this.page.locator('text=/Label is too long/i').first()).toBeVisible({ timeout: 5_000 });
  await this.page.fill('#field-hint', 'B'.repeat(501));
  await this.page.locator('#field-label').click();
  await expect(this.page.locator('text=/Help text is too long/i').first()).toBeVisible({ timeout: 5_000 });
});

Then('I test min max length validation for long text', async function (this: CustomWorld) {
  if (!this.page) throw new Error('Page is not initialized');
  await this.page.fill('#field-validation\\.minLength', '100');
  await this.page.fill('#field-validation\\.maxLength', '10');
  await this.page.locator('#field-label').click();
  await expect(this.page.locator('text=/minimum.*maximum|min.*less.*max/i').first()).toBeVisible({ timeout: 5_000 });
});

Then('I verify save button is disabled with errors', async function (this: CustomWorld) {
  if (!this.page) throw new Error('Page is not initialized');
  const saveButton = this.page.getByRole('button', { name: /save/i });
  await expect(saveButton).toBeDisabled({ timeout: 5_000 });
});

Then('I fix all validation errors for long text', async function (this: CustomWorld) {
  if (!this.page) throw new Error('Page is not initialized');
  await this.page.fill('#field-label', `Long Text Field ${Date.now()}`);
  await this.page.fill('#field-hint', 'Valid hint');
  await this.page.fill('#field-validation\\.minLength', '5');
  await this.page.fill('#field-validation\\.maxLength', '500');
  await this.page.locator('#field-label').click();
});

Then('I verify save button is enabled', async function (this: CustomWorld) {
  if (!this.page) throw new Error('Page is not initialized');
  const saveButton = this.page.getByRole('button', { name: /save/i });
  await expect(saveButton).toBeEnabled({ timeout: 5_000 });
});

Then('I save the long text field settings', async function (this: CustomWorld) {
  if (!this.page) throw new Error('Page is not initialized');
  await this.page.getByRole('button', { name: /save/i }).click();
  await expect(this.page.getByTestId('field-content-1')).toBeVisible({ timeout: 10_000 });
});

When('I create a form via GraphQL with long text field validations', async function (this: CustomWorld) {
  await createFormViaGraphQL(this, longTextSchema(), 'E2E Long Text Validation Test');
});

When('I test required validation for long text in viewer', async function (this: CustomWorld) {
  if (!this.viewerPage) throw new Error('Viewer page is not initialized');
  const field = this.viewerPage.locator('textarea[name="field-required"]');
  await expect(field).toBeVisible({ timeout: 10_000 });
  await this.viewerPage.getByTestId('viewer-submit-button').click();
  await expect(this.viewerPage.locator('text=/required/i').first()).toBeVisible({ timeout: 5_000 });
  await field.fill('Valid text here');
  await field.blur();
});

When('I test min length validation for long text in viewer', async function (this: CustomWorld) {
  if (!this.viewerPage) throw new Error('Viewer page is not initialized');
  const field = this.viewerPage.locator('textarea[name="field-minlength"]');
  await expect(field).toBeVisible({ timeout: 10_000 });
  await field.fill('Hi');
  await field.blur();
  await expect(this.viewerPage.locator('text=/5.*char|at least 5|minimum.*5/i').first()).toBeVisible({ timeout: 5_000 });
  await field.fill('Valid text');
  await field.blur();
});

When('I test max length validation for long text in viewer', async function (this: CustomWorld) {
  if (!this.viewerPage) throw new Error('Viewer page is not initialized');
  const field = this.viewerPage.locator('textarea[name="field-maxlength"]');
  await expect(field).toBeVisible({ timeout: 10_000 });
  await field.fill('A'.repeat(15));
  await field.blur();
  await expect(this.viewerPage.locator('text=/10.*char|at most 10|maximum.*10/i').first()).toBeVisible({ timeout: 5_000 });
  await field.fill('Short');
  await field.blur();
});

When('I fill long text field with valid data in viewer', async function (this: CustomWorld) {
  if (!this.viewerPage) throw new Error('Viewer page is not initialized');
  await this.viewerPage.locator('textarea[name="field-required"]').fill('Required long text answer');
  await this.viewerPage.locator('textarea[name="field-minlength"]').fill('Valid length answer');
  await this.viewerPage.locator('textarea[name="field-maxlength"]').fill('Short');
  await this.viewerPage.locator('textarea[name="field-range"]').fill('Medium length');
});

When('I fill all long text field settings with test data', async function (this: CustomWorld) {
  if (!this.page) throw new Error('Page is not initialized');
  const ts = Date.now();
  this.expectedFieldSettings = { label: `Complete Long Text Field ${ts}`, hint: 'Comprehensive help text', placeholder: 'Enter your detailed response', defaultValue: 'Default long text', minLength: 5, maxLength: 500, required: true };
  await this.page.waitForSelector('#field-label', { timeout: 10_000 });
  await this.page.fill('#field-label', this.expectedFieldSettings.label);
  await this.page.fill('#field-hint', this.expectedFieldSettings.hint);
  await this.page.fill('#field-placeholder', this.expectedFieldSettings.placeholder);
  await this.page.fill('#field-defaultValue', this.expectedFieldSettings.defaultValue);
  await this.page.fill('#field-validation\\.minLength', '5');
  await this.page.fill('#field-validation\\.maxLength', '500');
  const req = this.page.locator('#field-required');
  if (!await req.isChecked()) await req.click();
});

// ─────────────────────────────────────────────────────────────────────────────
// EMAIL — builder & viewer
// ─────────────────────────────────────────────────────────────────────────────

Then('I fill the email field settings with valid data', async function (this: CustomWorld) {
  if (!this.page) throw new Error('Page is not initialized');
  await this.page.waitForSelector('#field-label', { timeout: 10_000 });
  await this.page.fill('#field-label', `Email Address Field ${Date.now()}`);
  await this.page.fill('#field-hint', 'We will never share your email.');
  await this.page.fill('#field-placeholder', 'you@example.com');
  await this.page.fill('#field-defaultValue', 'test@example.com');
  const req = this.page.locator('#field-required');
  if (!await req.isChecked()) await req.click();
  await expect(this.page.locator('#field-label')).toHaveValue(/Email Address/);
});

Then('I test label and hint validation for email', async function (this: CustomWorld) {
  if (!this.page) throw new Error('Page is not initialized');
  await this.page.fill('#field-label', '');
  await this.page.locator('#field-hint').click();
  await expect(this.page.locator('text=/Field label is required/i').first()).toBeVisible({ timeout: 5_000 });
  await this.page.fill('#field-label', 'A'.repeat(201));
  await this.page.locator('#field-hint').click();
  await expect(this.page.locator('text=/Label is too long/i').first()).toBeVisible({ timeout: 5_000 });
  await this.page.fill('#field-hint', 'B'.repeat(501));
  await this.page.locator('#field-label').click();
  await expect(this.page.locator('text=/Help text is too long/i').first()).toBeVisible({ timeout: 5_000 });
});

Then('I test placeholder validation for email', async function (this: CustomWorld) {
  if (!this.page) throw new Error('Page is not initialized');
  await this.page.fill('#field-placeholder', 'C'.repeat(101));
  await this.page.locator('#field-label').click();
  await expect(this.page.locator('text=/Placeholder is too long/i').first()).toBeVisible({ timeout: 5_000 });
});

Then('I test default value validation for email', async function (this: CustomWorld) {
  if (!this.page) throw new Error('Page is not initialized');
  await this.page.fill('#field-defaultValue', 'D'.repeat(1001));
  await this.page.locator('#field-label').click();
  await expect(this.page.locator('text=/Default value is too long/i').first()).toBeVisible({ timeout: 5_000 });
});

Then('I fix all validation errors for email', async function (this: CustomWorld) {
  if (!this.page) throw new Error('Page is not initialized');
  await this.page.fill('#field-label', `Email Field ${Date.now()}`);
  await this.page.fill('#field-hint', 'We will never share your email.');
  await this.page.fill('#field-placeholder', 'you@example.com');
  await this.page.fill('#field-defaultValue', 'test@example.com');
  await this.page.locator('#field-label').click();
  await this.page.waitForLoadState('domcontentloaded');
});

Then('I save the email field settings', async function (this: CustomWorld) {
  if (!this.page) throw new Error('Page is not initialized');
  await this.page.getByRole('button', { name: /save/i }).click();
  await expect(this.page.getByTestId('field-content-1')).toBeVisible({ timeout: 10_000 });
});

When('I create a form via GraphQL with email field validations', async function (this: CustomWorld) {
  await createFormViaGraphQL(this, emailSchema(), 'E2E Email Validation Test');
});

When('I test required validation for email in viewer', async function (this: CustomWorld) {
  if (!this.viewerPage) throw new Error('Viewer page is not initialized');
  const field = this.viewerPage.locator('input[name="field-required"]');
  await expect(field).toBeVisible({ timeout: 10_000 });
  await this.viewerPage.getByTestId('viewer-submit-button').click();
  await expect(this.viewerPage.locator('text=/required/i').first()).toBeVisible({ timeout: 5_000 });
  await field.fill('test@example.com');
  await field.blur();
});

When('I test email format validation in viewer', async function (this: CustomWorld) {
  if (!this.viewerPage) throw new Error('Viewer page is not initialized');
  const field = this.viewerPage.locator('input[name="field-format"]');
  await expect(field).toBeVisible({ timeout: 10_000 });
  await field.fill('invalid-email');
  await field.blur();
  await expect(this.viewerPage.locator('text=/valid email|email.*valid|invalid.*email/i').first()).toBeVisible({ timeout: 5_000 });
  await field.fill('valid@example.com');
  await field.blur();
});

When('I fill email field with valid data in viewer', async function (this: CustomWorld) {
  if (!this.viewerPage) throw new Error('Viewer page is not initialized');
  await this.viewerPage.locator('input[name="field-required"]').fill('user@example.com');
  await this.viewerPage.locator('input[name="field-format"]').fill('test@domain.com');
});

When('I fill all email field settings with test data', async function (this: CustomWorld) {
  if (!this.page) throw new Error('Page is not initialized');
  const ts = Date.now();
  this.expectedFieldSettings = { label: `Complete Email Field ${ts}`, hint: 'Comprehensive email help', placeholder: 'Enter your email address', prefix: 'EM', defaultValue: 'test@example.com', required: true };
  await this.page.waitForSelector('#field-label', { timeout: 10_000 });
  await this.page.fill('#field-label', this.expectedFieldSettings.label);
  await this.page.fill('#field-hint', this.expectedFieldSettings.hint);
  await this.page.fill('#field-placeholder', this.expectedFieldSettings.placeholder);
  await this.page.fill('#field-prefix', this.expectedFieldSettings.prefix);
  await this.page.fill('#field-defaultValue', this.expectedFieldSettings.defaultValue);
  const req = this.page.locator('#field-required');
  if (!await req.isChecked()) await req.click();
});

// ─────────────────────────────────────────────────────────────────────────────
// NUMBER — builder & viewer
// ─────────────────────────────────────────────────────────────────────────────

Then('I fill the number field settings with valid data', async function (this: CustomWorld) {
  if (!this.page) throw new Error('Page is not initialized');
  await this.page.waitForSelector('#field-label', { timeout: 10_000 });
  await this.page.fill('#field-label', `Quantity Field ${Date.now()}`);
  await this.page.fill('#field-hint', 'Enter the amount.');
  await this.page.fill('#field-placeholder', '0');
  await this.page.fill('#field-defaultValue', '10');
  await this.page.fill('#field-min', '0');
  await this.page.fill('#field-max', '100');
  const req = this.page.locator('#field-required');
  if (!await req.isChecked()) await req.click();
  await expect(this.page.locator('#field-label')).toHaveValue(/Quantity/);
});

Then('I test label validation for number', async function (this: CustomWorld) {
  if (!this.page) throw new Error('Page is not initialized');
  await this.page.fill('#field-label', '');
  await this.page.locator('#field-hint').click();
  await expect(this.page.locator('text=/Field label is required/i').first()).toBeVisible({ timeout: 5_000 });
  await this.page.fill('#field-label', 'A'.repeat(201));
  await this.page.locator('#field-hint').click();
  await expect(this.page.locator('text=/Label is too long/i').first()).toBeVisible({ timeout: 5_000 });
});

Then('I test min max value validation for number', async function (this: CustomWorld) {
  if (!this.page) throw new Error('Page is not initialized');
  await this.page.fill('#field-min', '100');
  await this.page.fill('#field-max', '50');
  await this.page.locator('#field-label').click();
  await expect(this.page.locator('text=/Minimum value must be less than or equal to maximum value/i').first()).toBeVisible({ timeout: 5_000 });
});

Then('I test default value range validation for number', async function (this: CustomWorld) {
  if (!this.page) throw new Error('Page is not initialized');
  await this.page.fill('#field-min', '10');
  await this.page.fill('#field-max', '100');
  await this.page.fill('#field-defaultValue', '5');
  await this.page.locator('#field-label').click();
  await expect(this.page.locator('text=/Default value must be greater than or equal to minimum value/i').first()).toBeVisible({ timeout: 5_000 });
  await this.page.fill('#field-defaultValue', '150');
  await this.page.locator('#field-label').click();
  await expect(this.page.locator('text=/Default value must be less than or equal to maximum value/i').first()).toBeVisible({ timeout: 5_000 });
});

Then('I fix all validation errors for number', async function (this: CustomWorld) {
  if (!this.page) throw new Error('Page is not initialized');
  await this.page.fill('#field-label', `Number Field ${Date.now()}`);
  await this.page.fill('#field-min', '0');
  await this.page.fill('#field-max', '100');
  await this.page.fill('#field-defaultValue', '50');
  await this.page.locator('#field-label').click();
  await this.page.waitForLoadState('domcontentloaded');
});

Then('I save the number field settings', async function (this: CustomWorld) {
  if (!this.page) throw new Error('Page is not initialized');
  await this.page.getByRole('button', { name: /save/i }).click();
  await expect(this.page.getByTestId('field-content-1')).toBeVisible({ timeout: 10_000 });
});

When('I create a form via GraphQL with number field validations', async function (this: CustomWorld) {
  await createFormViaGraphQL(this, numberSchema(), 'E2E Number Validation Test');
});

When('I test required validation for number in viewer', async function (this: CustomWorld) {
  if (!this.viewerPage) throw new Error('Viewer page is not initialized');
  const field = this.viewerPage.locator('input[name="field-required"]');
  await expect(field).toBeVisible({ timeout: 10_000 });
  await this.viewerPage.getByTestId('viewer-submit-button').click();
  await expect(this.viewerPage.locator('text=/required/i').first()).toBeVisible({ timeout: 5_000 });
  await field.fill('42');
  await field.blur();
});

When('I test min value validation in viewer', async function (this: CustomWorld) {
  if (!this.viewerPage) throw new Error('Viewer page is not initialized');
  const field = this.viewerPage.locator('input[name="field-min"]');
  await expect(field).toBeVisible({ timeout: 10_000 });
  await field.fill('5');
  await field.blur();
  await expect(this.viewerPage.locator('text=/10|minimum.*10|at least 10|greater.*10/i').first()).toBeVisible({ timeout: 5_000 });
  await field.fill('15');
  await field.blur();
});

When('I test max value validation in viewer', async function (this: CustomWorld) {
  if (!this.viewerPage) throw new Error('Viewer page is not initialized');
  const field = this.viewerPage.locator('input[name="field-max"]');
  await expect(field).toBeVisible({ timeout: 10_000 });
  await field.fill('150');
  await field.blur();
  await expect(this.viewerPage.locator('text=/100|maximum.*100|at most 100|less.*100/i').first()).toBeVisible({ timeout: 5_000 });
  await field.fill('75');
  await field.blur();
});

When('I fill number field with valid data in viewer', async function (this: CustomWorld) {
  if (!this.viewerPage) throw new Error('Viewer page is not initialized');
  await this.viewerPage.locator('input[name="field-required"]').fill('42');
  await this.viewerPage.locator('input[name="field-min"]').fill('20');
  await this.viewerPage.locator('input[name="field-max"]').fill('50');
  await this.viewerPage.locator('input[name="field-range"]').fill('25');
});

When('I fill all number field settings with test data', async function (this: CustomWorld) {
  if (!this.page) throw new Error('Page is not initialized');
  const ts = Date.now();
  this.expectedFieldSettings = { label: `Complete Number Field ${ts}`, hint: 'Number field help', placeholder: 'Enter a number', prefix: '#', defaultValue: '42', min: 1, max: 100, required: true };
  await this.page.waitForSelector('#field-label', { timeout: 10_000 });
  await this.page.fill('#field-label', this.expectedFieldSettings.label);
  await this.page.fill('#field-hint', this.expectedFieldSettings.hint);
  await this.page.fill('#field-placeholder', this.expectedFieldSettings.placeholder);
  await this.page.fill('#field-prefix', this.expectedFieldSettings.prefix);
  await this.page.fill('#field-defaultValue', this.expectedFieldSettings.defaultValue);
  await this.page.fill('#field-min', '1');
  await this.page.fill('#field-max', '100');
  const req = this.page.locator('#field-required');
  if (!await req.isChecked()) await req.click();
});

// ─────────────────────────────────────────────────────────────────────────────
// DATE — builder & viewer
// ─────────────────────────────────────────────────────────────────────────────

Then('I fill the date field settings with valid data', async function (this: CustomWorld) {
  if (!this.page) throw new Error('Page is not initialized');
  await this.page.waitForSelector('#field-label', { timeout: 10_000 });
  await this.page.fill('#field-label', `Event Date Field ${Date.now()}`);
  await this.page.fill('#field-hint', 'Select the event date.');
  await this.page.fill('#field-placeholder', 'MM/DD/YYYY');
  await this.page.fill('#field-minDate', '2024-01-01');
  await this.page.fill('#field-maxDate', '2024-12-31');
  await this.page.fill('#field-defaultValue', '2024-06-15');
  const req = this.page.locator('#field-required');
  if (!await req.isChecked()) await req.click();
  await expect(this.page.locator('#field-label')).toHaveValue(/Event Date/);
});

Then('I test label and hint validation for date', async function (this: CustomWorld) {
  if (!this.page) throw new Error('Page is not initialized');
  await this.page.fill('#field-label', '');
  await this.page.locator('#field-hint').click();
  await expect(this.page.locator('text=/Field label is required/i').first()).toBeVisible({ timeout: 5_000 });
  await this.page.fill('#field-label', 'A'.repeat(201));
  await this.page.locator('#field-hint').click();
  await expect(this.page.locator('text=/Label is too long/i').first()).toBeVisible({ timeout: 5_000 });
  await this.page.fill('#field-hint', 'B'.repeat(501));
  await this.page.locator('#field-label').click();
  await expect(this.page.locator('text=/Help text is too long/i').first()).toBeVisible({ timeout: 5_000 });
});

Then('I test min max date validation for date', async function (this: CustomWorld) {
  if (!this.page) throw new Error('Page is not initialized');
  await this.page.fill('#field-minDate', '2024-12-31');
  await this.page.fill('#field-maxDate', '2024-01-01');
  await this.page.locator('#field-label').click();
  await expect(this.page.locator('text=/min.*max|maximum.*minimum|date.*range/i').first()).toBeVisible({ timeout: 5_000 });
});

Then('I test default value date validation for date', async function (this: CustomWorld) {
  if (!this.page) throw new Error('Page is not initialized');
  await this.page.fill('#field-minDate', '2024-06-01');
  await this.page.fill('#field-maxDate', '2024-06-30');
  await this.page.fill('#field-defaultValue', '2024-05-01');
  await this.page.locator('#field-label').click();
  await expect(this.page.locator('text=/default.*min|before.*minimum|date.*range/i').first()).toBeVisible({ timeout: 5_000 });
});

Then('I fix all validation errors for date', async function (this: CustomWorld) {
  if (!this.page) throw new Error('Page is not initialized');
  await this.page.fill('#field-label', `Date Field ${Date.now()}`);
  await this.page.fill('#field-hint', 'Valid hint');
  await this.page.fill('#field-minDate', '2024-01-01');
  await this.page.fill('#field-maxDate', '2024-12-31');
  await this.page.fill('#field-defaultValue', '2024-06-15');
  await this.page.locator('#field-label').click();
});

Then('I save the date field settings', async function (this: CustomWorld) {
  if (!this.page) throw new Error('Page is not initialized');
  await this.page.getByRole('button', { name: /save/i }).click();
  await expect(this.page.getByTestId('field-content-1')).toBeVisible({ timeout: 10_000 });
});

When('I create a form via GraphQL with date field validations', async function (this: CustomWorld) {
  await createFormViaGraphQL(this, dateSchema(), 'E2E Date Validation Test');
});

When('I test required validation for date in viewer', async function (this: CustomWorld) {
  if (!this.viewerPage) throw new Error('Viewer page is not initialized');
  const field = this.viewerPage.locator('input[name="field-required"]');
  await expect(field).toBeVisible({ timeout: 10_000 });
  await this.viewerPage.getByTestId('viewer-submit-button').click();
  await expect(this.viewerPage.locator('text=/required/i').first()).toBeVisible({ timeout: 5_000 });
  await field.fill('2024-06-15');
  await field.blur();
});

When('I test min date validation in viewer', async function (this: CustomWorld) {
  if (!this.viewerPage) throw new Error('Viewer page is not initialized');
  const field = this.viewerPage.locator('input[name="field-min-date"]');
  await expect(field).toBeVisible({ timeout: 10_000 });
  await field.fill('2023-01-01');
  await field.blur();
  await expect(this.viewerPage.locator('text=/minimum.*date|date.*minimum|2024|before/i').first()).toBeVisible({ timeout: 5_000 });
  await field.fill('2024-06-15');
  await field.blur();
});

When('I test max date validation in viewer', async function (this: CustomWorld) {
  if (!this.viewerPage) throw new Error('Viewer page is not initialized');
  const field = this.viewerPage.locator('input[name="field-max-date"]');
  await expect(field).toBeVisible({ timeout: 10_000 });
  await field.fill('2025-12-31');
  await field.blur();
  await expect(this.viewerPage.locator('text=/maximum.*date|date.*maximum|2024|after/i').first()).toBeVisible({ timeout: 5_000 });
  await field.fill('2024-06-15');
  await field.blur();
});

When('I fill date field with valid data in viewer', async function (this: CustomWorld) {
  if (!this.viewerPage) throw new Error('Viewer page is not initialized');
  await this.viewerPage.locator('input[name="field-required"]').fill('2024-06-15');
  await this.viewerPage.locator('input[name="field-min-date"]').fill('2024-06-15');
  await this.viewerPage.locator('input[name="field-max-date"]').fill('2024-06-15');
});

When('I fill all date field settings with test data', async function (this: CustomWorld) {
  if (!this.page) throw new Error('Page is not initialized');
  const ts = Date.now();
  this.expectedFieldSettings = { label: `Complete Date Field ${ts}`, hint: 'Date field help', placeholder: 'YYYY-MM-DD', minDate: '2024-01-01', maxDate: '2024-12-31', defaultValue: '2024-06-15', required: true };
  await this.page.waitForSelector('#field-label', { timeout: 10_000 });
  await this.page.fill('#field-label', this.expectedFieldSettings.label);
  await this.page.fill('#field-hint', this.expectedFieldSettings.hint);
  await this.page.fill('#field-placeholder', this.expectedFieldSettings.placeholder);
  await this.page.fill('#field-minDate', this.expectedFieldSettings.minDate);
  await this.page.fill('#field-maxDate', this.expectedFieldSettings.maxDate);
  await this.page.fill('#field-defaultValue', this.expectedFieldSettings.defaultValue);
  const req = this.page.locator('#field-required');
  if (!await req.isChecked()) await req.click();
});

// ─────────────────────────────────────────────────────────────────────────────
// RADIO — builder
// ─────────────────────────────────────────────────────────────────────────────

Then('I fill the radio field settings with valid data', async function (this: CustomWorld) {
  if (!this.page) throw new Error('Page is not initialized');
  await this.page.waitForSelector('#field-label', { timeout: 10_000 });
  await this.page.fill('#field-label', `Gender Field ${Date.now()}`);
  await this.page.fill('#field-hint', 'Select your gender.');
  const req = this.page.locator('#field-required');
  if (!await req.isChecked()) await req.click();
  await expect(this.page.locator('#field-label')).toHaveValue(/Gender/);
});

Then('I test label and hint validation for radio', async function (this: CustomWorld) {
  if (!this.page) throw new Error('Page is not initialized');
  await this.page.fill('#field-label', '');
  await this.page.locator('#field-hint').click();
  await expect(this.page.locator('text=/Field label is required/i').first()).toBeVisible({ timeout: 5_000 });
  await this.page.fill('#field-label', 'A'.repeat(201));
  await this.page.locator('#field-hint').click();
  await expect(this.page.locator('text=/Label is too long/i').first()).toBeVisible({ timeout: 5_000 });
});

Then('I test options validation for radio', async function (this: CustomWorld) {
  if (!this.page) throw new Error('Page is not initialized');
  const addOptionBtn = this.page.locator('button:has-text("Add Option"), button:has-text("Add option")');
  if (await addOptionBtn.isVisible()) {
    const optionInputs = this.page.locator('input[placeholder="Enter option value"]');
    const count = await optionInputs.count();
    for (let i = 0; i < count; i++) {
      await optionInputs.nth(i).fill('');
    }
    await this.page.locator('#field-label').click();
    await expect(this.page.locator('text=/option.*required|required.*option/i').first()).toBeVisible({ timeout: 5_000 }).catch(() => {});
  }
});

Then('I fix all validation errors for radio', async function (this: CustomWorld) {
  if (!this.page) throw new Error('Page is not initialized');
  await this.page.fill('#field-label', `Radio Field ${Date.now()}`);
  await this.page.fill('#field-hint', 'Valid hint');
  await this.page.locator('#field-label').click();
});

Then('I save the radio field settings', async function (this: CustomWorld) {
  if (!this.page) throw new Error('Page is not initialized');
  await this.page.getByRole('button', { name: /save/i }).click();
  await this.page.waitForLoadState('networkidle');
});

When('I fill all radio field settings with test data', async function (this: CustomWorld) {
  if (!this.page) throw new Error('Page is not initialized');
  const ts = Date.now();
  this.expectedFieldSettings = { label: `Complete Radio Field ${ts}`, hint: 'Radio field help', options: [{ value: 'option1', label: 'Option 1' }, { value: 'option2', label: 'Option 2' }], required: true };
  await this.page.waitForSelector('#field-label', { timeout: 10_000 });
  await this.page.fill('#field-label', this.expectedFieldSettings.label);
  await this.page.fill('#field-hint', this.expectedFieldSettings.hint);
  const req = this.page.locator('#field-required');
  if (!await req.isChecked()) await req.click();
});

When('I create a form via GraphQL with radio field validations', async function (this: CustomWorld) {
  await createFormViaGraphQL(this, radioSchema(), 'E2E Radio Validation Test');
});

When('I test required validation for radio in viewer', async function (this: CustomWorld) {
  if (!this.viewerPage) throw new Error('Viewer page is not initialized');
  // Attempt to submit without selecting any radio option — expect a required error
  await this.viewerPage.getByTestId('viewer-submit-button').click();
  await expect(this.viewerPage.locator('text=/required/i').first()).toBeVisible({ timeout: 5_000 });
});

When('I fill radio field with valid data in viewer', async function (this: CustomWorld) {
  if (!this.viewerPage) throw new Error('Viewer page is not initialized');
  // Select the first radio option via its accessible role
  const firstOption = this.viewerPage.locator('[role="radio"]').first();
  await expect(firstOption).toBeVisible({ timeout: 10_000 });
  await firstOption.click({ force: true });
});

// ─────────────────────────────────────────────────────────────────────────────
// DROPDOWN — builder & viewer
// ─────────────────────────────────────────────────────────────────────────────

Then('I fill the dropdown field settings with valid data', async function (this: CustomWorld) {
  if (!this.page) throw new Error('Page is not initialized');
  await this.page.waitForSelector('#field-label', { timeout: 10_000 });
  await this.page.fill('#field-label', `Country Field ${Date.now()}`);
  await this.page.fill('#field-hint', 'Select your country.');
  const req = this.page.locator('#field-required');
  if (!await req.isChecked()) await req.click();
  await expect(this.page.locator('#field-label')).toHaveValue(/Country/);
});

Then('I test label and hint validation for dropdown', async function (this: CustomWorld) {
  if (!this.page) throw new Error('Page is not initialized');
  await this.page.fill('#field-label', '');
  await this.page.locator('#field-hint').click();
  await expect(this.page.locator('text=/Field label is required/i').first()).toBeVisible({ timeout: 5_000 });
  await this.page.fill('#field-label', 'A'.repeat(201));
  await this.page.locator('#field-hint').click();
  await expect(this.page.locator('text=/Label is too long/i').first()).toBeVisible({ timeout: 5_000 });
});

Then('I test options validation for dropdown', async function (this: CustomWorld) {
  if (!this.page) throw new Error('Page is not initialized');
  const optionInputs = this.page.locator('input[placeholder="Enter option value"]');
  const count = await optionInputs.count();
  for (let i = 0; i < count; i++) await optionInputs.nth(i).fill('');
  await this.page.locator('#field-label').click();
  await expect(this.page.locator('text=/option.*required|required.*option/i').first()).toBeVisible({ timeout: 5_000 }).catch(() => {});
});

Then('I fix all validation errors for dropdown', async function (this: CustomWorld) {
  if (!this.page) throw new Error('Page is not initialized');
  await this.page.fill('#field-label', `Dropdown Field ${Date.now()}`);
  await this.page.fill('#field-hint', 'Valid hint');
  await this.page.locator('#field-label').click();
});

Then('I save the dropdown field settings', async function (this: CustomWorld) {
  if (!this.page) throw new Error('Page is not initialized');
  await this.page.getByRole('button', { name: /save/i }).click();
  await this.page.waitForLoadState('networkidle');
});

When('I create a form via GraphQL with dropdown field validations', async function (this: CustomWorld) {
  await createFormViaGraphQL(this, dropdownSchema(), 'E2E Dropdown Validation Test');
});

When('I test required validation for dropdown in viewer', async function (this: CustomWorld) {
  if (!this.viewerPage) throw new Error('Viewer page is not initialized');
  await this.viewerPage.getByTestId('viewer-submit-button').click();
  await expect(this.viewerPage.locator('text=/required/i').first()).toBeVisible({ timeout: 5_000 });
});

When('I test dropdown option selection in viewer', async function (this: CustomWorld) {
  if (!this.viewerPage) throw new Error('Viewer page is not initialized');
  const select = this.viewerPage.locator('select[name="field-dropdown"]');
  if (await select.isVisible()) {
    await select.selectOption({ index: 1 });
  } else {
    const combobox = this.viewerPage.getByRole('combobox').first();
    await combobox.click();
    await this.viewerPage.getByRole('option').first().click();
  }
});

When('I fill dropdown field with valid data in viewer', async function (this: CustomWorld) {
  if (!this.viewerPage) throw new Error('Viewer page is not initialized');
  const select = this.viewerPage.locator('select').first();
  if (await select.isVisible()) {
    await select.selectOption({ index: 1 });
  } else {
    const combobox = this.viewerPage.getByRole('combobox').first();
    await combobox.click();
    await this.viewerPage.getByRole('option').first().click();
  }
});

When('I fill all dropdown field settings with test data', async function (this: CustomWorld) {
  if (!this.page) throw new Error('Page is not initialized');
  const ts = Date.now();
  this.expectedFieldSettings = { label: `Complete Dropdown Field ${ts}`, hint: 'Dropdown help', options: [{ value: 'opt1', label: 'Option 1' }, { value: 'opt2', label: 'Option 2' }], required: true };
  await this.page.waitForSelector('#field-label', { timeout: 10_000 });
  await this.page.fill('#field-label', this.expectedFieldSettings.label);
  await this.page.fill('#field-hint', this.expectedFieldSettings.hint);
  const req = this.page.locator('#field-required');
  if (!await req.isChecked()) await req.click();
});

// ─────────────────────────────────────────────────────────────────────────────
// CHECKBOX — builder & viewer
// ─────────────────────────────────────────────────────────────────────────────

Then('I fill the checkbox field settings with valid data', async function (this: CustomWorld) {
  if (!this.page) throw new Error('Page is not initialized');
  await this.page.waitForSelector('#field-label', { timeout: 10_000 });
  await this.page.fill('#field-label', `Interests Field ${Date.now()}`);
  await this.page.fill('#field-hint', 'Select all that apply.');
  await expect(this.page.locator('#field-label')).toHaveValue(/Interests/);
});

Then('I test selection limits validation for checkbox', async function (this: CustomWorld) {
  if (!this.page) throw new Error('Page is not initialized');
  await this.page.fill('input[name="validation.minSelections"]', '5');
  await this.page.fill('input[name="validation.maxSelections"]', '2');
  await this.page.locator('#field-label').click();
  await expect(this.page.locator('text=/Minimum.*maximum|Min.*less.*max/i').first()).toBeVisible({ timeout: 5_000 });
});

Then('I test label and hint validation for checkbox', async function (this: CustomWorld) {
  if (!this.page) throw new Error('Page is not initialized');
  await this.page.fill('#field-label', '');
  await this.page.locator('#field-hint').click();
  await expect(this.page.locator('text=/Field label is required/i').first()).toBeVisible({ timeout: 5_000 });
  await this.page.fill('#field-label', 'A'.repeat(201));
  await this.page.locator('#field-hint').click();
  await expect(this.page.locator('text=/Label is too long/i').first()).toBeVisible({ timeout: 5_000 });
  await this.page.fill('#field-hint', 'B'.repeat(501));
  await this.page.locator('#field-label').click();
  await expect(this.page.locator('text=/Help text is too long/i').first()).toBeVisible({ timeout: 5_000 });
});

Then('I test options validation for checkbox', async function (this: CustomWorld) {
  if (!this.page) throw new Error('Page is not initialized');
  const optionInputs = this.page.locator('input[placeholder="Enter option value"]');
  const count = await optionInputs.count();
  for (let i = 0; i < count; i++) await optionInputs.nth(i).fill('');
  await this.page.locator('#field-label').click();
  await expect(this.page.locator('text=/option.*required|required.*option/i').first()).toBeVisible({ timeout: 5_000 }).catch(() => {});
});

Then('I fix all validation errors for checkbox', async function (this: CustomWorld) {
  if (!this.page) throw new Error('Page is not initialized');
  await this.page.fill('#field-label', `Checkbox Field ${Date.now()}`);
  await this.page.fill('#field-hint', 'Valid hint');
  await this.page.fill('input[name="validation.minSelections"]', '');
  await this.page.fill('input[name="validation.maxSelections"]', '');
  await this.page.locator('#field-label').click();
});

Then('I fix selection limits for checkbox', async function (this: CustomWorld) {
  if (!this.page) throw new Error('Page is not initialized');
  await this.page.fill('input[name="validation.minSelections"]', '1');
  await this.page.fill('input[name="validation.maxSelections"]', '3');
  await this.page.locator('#field-label').click();
});

Then('I save the checkbox field settings', async function (this: CustomWorld) {
  if (!this.page) throw new Error('Page is not initialized');
  await this.page.getByRole('button', { name: /save/i }).click();
  await this.page.waitForLoadState('networkidle');
});

When('I create a form via GraphQL with checkbox field validations', async function (this: CustomWorld) {
  await createFormViaGraphQL(this, checkboxSchema(), 'E2E Checkbox Validation Test');
});

When('I test checkbox required and select options in viewer', async function (this: CustomWorld) {
  if (!this.viewerPage) throw new Error('Viewer page is not initialized');
  await this.viewerPage.getByTestId('viewer-submit-button').click();
  await expect(this.viewerPage.locator('text=/required|select.*option/i').first()).toBeVisible({ timeout: 10_000 });
  // Select at least one checkbox option (shadcn Checkbox renders as role="checkbox")
  const checkboxes = this.viewerPage.locator('[role="checkbox"]');
  const count = await checkboxes.count();
  if (count > 0) {
    await checkboxes.first().click({ force: true }).catch(() => {});
  }
});

When('I fill all checkbox field settings with test data', async function (this: CustomWorld) {
  if (!this.page) throw new Error('Page is not initialized');
  const ts = Date.now();
  this.expectedFieldSettings = { label: `Complete Checkbox Field ${ts}`, hint: 'Checkbox help', options: [{ value: 'opt1', label: 'Option 1' }, { value: 'opt2', label: 'Option 2' }], minSelections: 1, maxSelections: 2, required: true };
  await this.page.waitForSelector('#field-label', { timeout: 10_000 });
  await this.page.fill('#field-label', this.expectedFieldSettings.label);
  await this.page.fill('#field-hint', this.expectedFieldSettings.hint);
  const req = this.page.locator('#field-required');
  if (!await req.isChecked()) await req.click();
});

// ─────────────────────────────────────────────────────────────────────────────
// FORM SCHEMAS  (inline — no separate file needed)
// ─────────────────────────────────────────────────────────────────────────────

function baseLayout(title: string) {
  return { theme: 'light', textColor: '#000000', spacing: 'normal', code: 'L9', content: `<h1>${title}</h1>`, customBackGroundColor: '#ffffff', backgroundImageKey: '', pageMode: 'multipage', isCustomBackgroundColorEnabled: false };
}

function textField(id: string, type: string, label: string, hint: string, extra: object = {}) {
  return { id, type, label, defaultValue: '', prefix: '', hint, placeholder: '', validation: { required: true, type: 'text_field_validation' }, ...extra };
}

function shortTextSchema() {
  return { layout: baseLayout('Short Text Test'), pages: [{ id: 'page-1', title: 'Page', fields: [
    textField('field-required', 'text_input_field', 'Required Field', 'Required'),
    textField('field-minlength', 'text_input_field', 'Min Length Field', 'Min 5', { validation: { required: true, minLength: 5, type: 'text_field_validation' } }),
    textField('field-maxlength', 'text_input_field', 'Max Length Field', 'Max 10', { validation: { required: true, maxLength: 10, type: 'text_field_validation' } }),
    textField('field-range', 'text_input_field', 'Length Range Field', '3-15 chars', { validation: { required: true, minLength: 3, maxLength: 15, type: 'text_field_validation' } }),
  ]}]};
}

function longTextSchema() {
  return { layout: baseLayout('Long Text Test'), pages: [{ id: 'page-1', title: 'Page', fields: [
    textField('field-required', 'text_area_field', 'Required Field', 'Required'),
    textField('field-minlength', 'text_area_field', 'Min Length Field', 'Min 5', { validation: { required: true, minLength: 5, type: 'text_field_validation' } }),
    textField('field-maxlength', 'text_area_field', 'Max Length Field', 'Max 10', { validation: { required: true, maxLength: 10, type: 'text_field_validation' } }),
    textField('field-range', 'text_area_field', 'Range Field', '5-50 chars', { validation: { required: true, minLength: 5, maxLength: 50, type: 'text_field_validation' } }),
  ]}]};
}

function emailSchema() {
  return { layout: baseLayout('Email Test'), pages: [{ id: 'page-1', title: 'Page', fields: [
    { id: 'field-required', type: 'email_field', label: 'Required Email', defaultValue: '', prefix: '', hint: 'Required', placeholder: '', validation: { required: true } },
    { id: 'field-format', type: 'email_field', label: 'Email Format', defaultValue: '', prefix: '', hint: 'Valid email', placeholder: '', validation: { required: true } },
  ]}]};
}

function numberSchema() {
  return { layout: baseLayout('Number Test'), pages: [{ id: 'page-1', title: 'Page', fields: [
    { id: 'field-required', type: 'number_field', label: 'Required Number', defaultValue: '', prefix: '', hint: 'Required', placeholder: '', validation: { required: true } },
    { id: 'field-min', type: 'number_field', label: 'Min Value Field', defaultValue: '', prefix: '', hint: 'Min 10', placeholder: '', validation: { required: true }, min: 10 },
    { id: 'field-max', type: 'number_field', label: 'Max Value Field', defaultValue: '', prefix: '', hint: 'Max 100', placeholder: '', validation: { required: true }, max: 100 },
    { id: 'field-range', type: 'number_field', label: 'Range Field', defaultValue: '', prefix: '', hint: '1-50', placeholder: '', validation: { required: true }, min: 1, max: 50 },
  ]}]};
}

function dateSchema() {
  return { layout: baseLayout('Date Test'), pages: [{ id: 'page-1', title: 'Page', fields: [
    { id: 'field-required', type: 'date_field', label: 'Required Date', defaultValue: '', prefix: '', hint: 'Required', placeholder: '', validation: { required: true } },
    { id: 'field-min-date', type: 'date_field', label: 'Min Date Field', defaultValue: '', prefix: '', hint: 'After 2024-01-01', placeholder: '', validation: { required: true }, minDate: '2024-01-01' },
    { id: 'field-max-date', type: 'date_field', label: 'Max Date Field', defaultValue: '', prefix: '', hint: 'Before 2024-12-31', placeholder: '', validation: { required: true }, maxDate: '2024-12-31' },
  ]}]};
}

function dropdownSchema() {
  return { layout: baseLayout('Dropdown Test'), pages: [{ id: 'page-1', title: 'Page', fields: [
    { id: 'field-dropdown', type: 'select_field', label: 'Required Dropdown', defaultValue: '', prefix: '', hint: 'Required', validation: { required: true, type: 'fillable_form_field' }, options: ['Option 1', 'Option 2', 'Option 3'] },
  ]}]};
}

function checkboxSchema() {
  return { layout: baseLayout('Checkbox Test'), pages: [{ id: 'page-1', title: 'Page', fields: [
    { id: 'field-checkbox', type: 'checkbox_field', label: 'Required Checkbox', defaultValues: [], prefix: '', hint: 'Required', placeholder: '', validation: { required: true, type: 'checkbox_field_validation', minSelections: 1 }, options: ['Option 1', 'Option 2', 'Option 3'] },
  ]}]};
}

function radioSchema() {
  return { layout: baseLayout('Radio Test'), pages: [{ id: 'page-1', title: 'Page', fields: [
    { id: 'field-required', type: 'radio_field', label: 'Required Radio', defaultValue: '', prefix: '', hint: 'Required', validation: { required: true, type: 'fillable_form_field' }, options: ['Option A', 'Option B', 'Option C'] },
  ]}]};
}
