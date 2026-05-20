/**
 * Form viewer interaction steps for E2E tests
 * Handles viewer navigation, pagination, and field visibility verification
 */

import { When, Then } from '@cucumber/cucumber';
import { expect } from '@playwright/test';
import { CustomWorld } from '../support/world';
import { createFormViaGraphQL } from './helpers';

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

// ─────────────────────────────────────────────────────────────────────────────
// GAP 1: Required field blocks "Next" navigation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a 2-page form with a required short text field on page 1
 */
When('I create a form via GraphQL with required field on first page', async function (this: CustomWorld) {
  await createFormViaGraphQL(this, requiredFieldTwoPagesSchema(), 'E2E Required Field Navigation Test');
});

/**
 * Assert the viewer page indicator still shows page 1 (navigation was blocked).
 * This step is intentionally different from "I should be on viewer page {int} of {int}"
 * because after a failed "Next" click the indicator text may momentarily be absent
 * while validation errors render. We poll for either the error OR confirm page 1.
 */
Then('I should still be on viewer page 1', async function (this: CustomWorld) {
  if (!this.viewerPage) {
    throw new Error('Viewer page is not initialized');
  }
  // Give the validation render cycle a moment to settle
  await this.viewerPage.waitForTimeout(600);
  // The page indicator must still read "Page 1 of 2"
  const indicator = this.viewerPage.getByTestId('viewer-page-indicator');
  await expect(indicator).toContainText('Page 1 of 2', { timeout: 5_000 });
});

/**
 * Assert that at least one required-field error is visible in the viewer
 */
Then('I should see a required field error in the viewer', async function (this: CustomWorld) {
  if (!this.viewerPage) {
    throw new Error('Viewer page is not initialized');
  }
  // The FormRenderer displays required errors as text matching /required/i
  await expect(
    this.viewerPage.locator('text=/required/i').first()
  ).toBeVisible({ timeout: 5_000 });
});

/**
 * Fill the required short text field on page 1 of the two-page form
 */
When('I fill the required short text field in the viewer', async function (this: CustomWorld) {
  if (!this.viewerPage) {
    throw new Error('Viewer page is not initialized');
  }
  const field = this.viewerPage.locator('input[name="page1-required-text"]');
  await expect(field).toBeVisible({ timeout: 10_000 });
  await field.fill('Valid answer');
  await field.blur();
  await this.viewerPage.waitForTimeout(300);
});

// ─────────────────────────────────────────────────────────────────────────────
// GAP 4: Full form submission with all field types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fill page 1 of the all-field-types form (short text + long text)
 */
When('I fill the all-field-types form on page 1', async function (this: CustomWorld) {
  if (!this.viewerPage) {
    throw new Error('Viewer page is not initialized');
  }
  // Short Text Field
  const shortText = this.viewerPage.locator('input[name="field-short-text"]');
  if (await shortText.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await shortText.fill('Hello world');
  }
  // Long Text Field
  const longText = this.viewerPage.locator('textarea[name="field-long-text"]');
  if (await longText.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await longText.fill('This is a longer answer for the text area field.');
  }
  await this.viewerPage.waitForTimeout(300);
});

/**
 * Fill page 2 of the all-field-types form (email, number, date)
 */
When('I fill the all-field-types form on page 2', async function (this: CustomWorld) {
  if (!this.viewerPage) {
    throw new Error('Viewer page is not initialized');
  }
  // Email Field
  const email = this.viewerPage.locator('input[name="field-email"]');
  if (await email.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await email.fill('test@example.com');
    await email.blur();
  }
  // Number Field
  const number = this.viewerPage.locator('input[name="field-number"]');
  if (await number.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await number.fill('42');
    await number.blur();
  }
  // Date Field
  const date = this.viewerPage.locator('input[name="field-date"]');
  if (await date.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await date.fill('2024-06-15');
    await date.blur();
  }
  await this.viewerPage.waitForTimeout(300);
});

/**
 * Fill page 3 of the all-field-types form (dropdown, radio, checkbox)
 */
When('I fill the all-field-types form on page 3', async function (this: CustomWorld) {
  if (!this.viewerPage) {
    throw new Error('Viewer page is not initialized');
  }
  // Dropdown Field — try native select first, then shadcn combobox
  const select = this.viewerPage.locator('select[name="field-dropdown"]');
  if (await select.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await select.selectOption({ index: 1 });
  } else {
    const combobox = this.viewerPage.getByRole('combobox').first();
    if (await combobox.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await combobox.click();
      await this.viewerPage.getByRole('option').first().click();
    }
  }
  // Radio Field
  const radios = this.viewerPage.locator('[role="radio"]');
  const radioCount = await radios.count();
  if (radioCount > 0) {
    await radios.first().click({ force: true });
  }
  // Checkbox Field
  const checkboxes = this.viewerPage.locator('[role="checkbox"]');
  const cbCount = await checkboxes.count();
  if (cbCount > 0) {
    await checkboxes.first().click({ force: true });
  }
  await this.viewerPage.waitForTimeout(300);
});

/**
 * Click the submit button in the viewer
 */
When('I submit the viewer form', async function (this: CustomWorld) {
  if (!this.viewerPage) {
    throw new Error('Viewer page is not initialized');
  }
  const submitButton = this.viewerPage.getByTestId('viewer-submit-button');
  await expect(submitButton).toBeVisible({ timeout: 10_000 });
  await submitButton.click();
  // Wait for either the thank-you display or an error banner
  await this.viewerPage.waitForTimeout(3_000);
});

/**
 * Assert the thank-you screen is shown after successful submission
 */
Then('the viewer should show the thank you screen', async function (this: CustomWorld) {
  if (!this.viewerPage) {
    throw new Error('Viewer page is not initialized');
  }
  const thankYou = this.viewerPage.getByTestId('thank-you-display');
  await expect(thankYou).toBeVisible({ timeout: 15_000 });
});

// ─────────────────────────────────────────────────────────────────────────────
// SCHEMAS for new multipage scenarios
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 2-page form: page 1 has one required short text field, page 2 is a plain page.
 * The field id "page1-required-text" maps to input[name="page1-required-text"]
 * in the FormRenderer.
 */
function requiredFieldTwoPagesSchema() {
  return {
    layout: {
      theme: 'light',
      textColor: '#000000',
      spacing: 'normal',
      code: 'L9',
      content: '<h1>Required Field Navigation Test</h1>',
      customBackGroundColor: '#ffffff',
      backgroundImageKey: '',
      pageMode: 'multipage',
      isCustomBackgroundColorEnabled: false,
    },
    pages: [
      {
        id: 'page-1',
        title: 'Page 1',
        fields: [
          {
            id: 'page1-required-text',
            type: 'text_input_field',
            label: 'Required Text Field',
            defaultValue: '',
            prefix: '',
            hint: 'This field must be filled before continuing.',
            placeholder: 'Enter your answer',
            validation: { required: true, type: 'text_field_validation' },
          },
        ],
      },
      {
        id: 'page-2',
        title: 'Page 2',
        fields: [
          {
            id: 'page2-optional-text',
            type: 'text_input_field',
            label: 'Optional Text Field',
            defaultValue: '',
            prefix: '',
            hint: '',
            placeholder: 'Optional answer',
            validation: { required: false, type: 'text_field_validation' },
          },
        ],
      },
    ],
  };
}
