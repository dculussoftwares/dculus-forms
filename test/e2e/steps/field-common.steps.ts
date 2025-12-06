/**
 * Common field validation steps for E2E tests
 * Shared validation logic for all form field types
 */

import { Then } from '@cucumber/cucumber';
import { expect } from '@playwright/test';
import { CustomWorld } from '../support/world';

/**
 * Test invalid label data (empty and too long)
 */
Then('I test invalid label data', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  // Test 1: Empty label (clear the default)
  await this.page.fill('#field-label', '');
  await this.page.locator('#field-hint').click(); // Blur to trigger validation

  // Check for error message
  const labelError = this.page.locator('text=/Field label is required/i').first();
  await expect(labelError).toBeVisible({ timeout: 5_000 });

  // Test 2: Label too long (201+ characters)
  const longLabel = 'A'.repeat(201);
  await this.page.fill('#field-label', longLabel);
  await this.page.locator('#field-hint').click(); // Blur to trigger validation

  const labelTooLongError = this.page.locator('text=/Label is too long/i').first();
  await expect(labelTooLongError).toBeVisible({ timeout: 5_000 });

  // Fix: Set valid label
  await this.page.fill('#field-label', 'Valid Label');
  await this.page.locator('#field-hint').click();

  // Verify error is gone
  await expect(labelError).not.toBeVisible();
  await expect(labelTooLongError).not.toBeVisible();
});

/**
 * Test invalid hint data (too long)
 */
Then('I test invalid hint data', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  // Test: Hint too long (501+ characters)
  const longHint = 'H'.repeat(501);
  await this.page.fill('#field-hint', longHint);
  await this.page.locator('#field-label').click(); // Blur to trigger validation

  const hintError = this.page.locator('text=/Help text is too long/i').first();
  await expect(hintError).toBeVisible({ timeout: 5_000 });

  // Fix: Set valid hint
  await this.page.fill('#field-hint', 'Valid help text');
  await this.page.locator('#field-label').click();

  // Verify error is gone
  await expect(hintError).not.toBeVisible();
});

/**
 * Test invalid placeholder data (too long)
 */
Then('I test invalid placeholder data', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  // Test: Placeholder too long (101+ characters)
  const longPlaceholder = 'P'.repeat(101);
  await this.page.fill('#field-placeholder', longPlaceholder);
  await this.page.locator('#field-label').click(); // Blur to trigger validation

  const placeholderError = this.page.locator('text=/Placeholder is too long/i').first();
  await expect(placeholderError).toBeVisible({ timeout: 5_000 });

  // Fix: Set valid placeholder
  await this.page.fill('#field-placeholder', 'Valid placeholder');
  await this.page.locator('#field-label').click();

  // Verify error is gone
  await expect(placeholderError).not.toBeVisible();
});

/**
 * Test invalid prefix data (too long)
 */
Then('I test invalid prefix data', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  // Test: Prefix too long (11+ characters)
  const longPrefix = 'PREFIX12345';
  await this.page.fill('#field-prefix', longPrefix);
  await this.page.locator('#field-label').click(); // Blur to trigger validation

  const prefixError = this.page.locator('text=/Prefix is too long/i').first();
  await expect(prefixError).toBeVisible({ timeout: 5_000 });

  // Fix: Set valid prefix
  await this.page.fill('#field-prefix', 'PRE');
  await this.page.locator('#field-label').click();

  // Verify error is gone
  await expect(prefixError).not.toBeVisible();
});

/**
 * Test invalid default value data (too long)
 */
Then('I test invalid default value data', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  // Test: Default value too long (1001+ characters)
  const longDefaultValue = 'D'.repeat(1001);
  await this.page.fill('#field-defaultValue', longDefaultValue);
  await this.page.locator('#field-label').click(); // Blur to trigger validation

  const defaultValueError = this.page.locator('text=/Default value is too long/i').first();
  await expect(defaultValueError).toBeVisible({ timeout: 5_000 });

  // Fix: Set valid default value
  await this.page.fill('#field-defaultValue', 'Valid default');
  await this.page.locator('#field-label').click();

  // Verify error is gone
  await expect(defaultValueError).not.toBeVisible();
});
