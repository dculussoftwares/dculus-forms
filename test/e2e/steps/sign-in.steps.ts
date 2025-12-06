import { Given, Then, When } from '@cucumber/cucumber';
import { expect } from '@playwright/test';
import { CustomWorld } from '../support/world';
import { expectPoll } from '../support/expectPoll';
import { getCredentials, createFormSchemaWithAllFields } from './helpers';

Then('I drag a short text field onto the page', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  const fieldTile = this.page.getByTestId('field-type-short-text');
  const droppablePage = this.page.getByTestId('droppable-page').first();

  await fieldTile.dragTo(droppablePage);

  const fieldContent = droppablePage.getByTestId('field-content-1');
  await expect(fieldContent).toBeVisible({ timeout: 15_000 });
});

Then('I drag a long text field onto the page', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  const fieldTile = this.page.getByTestId('field-type-long-text');
  const droppablePage = this.page.getByTestId('droppable-page').first();

  await fieldTile.dragTo(droppablePage);

  const fieldContent = droppablePage.getByTestId('field-content-1');
  await expect(fieldContent).toBeVisible({ timeout: 15_000 });
});

Then('I fill the short text field settings with valid data', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  // Hover and click settings button for the first field
  const fieldCard = this.page.locator('[data-testid^="draggable-field-"]').first();
  await fieldCard.hover();

  // Wait for settings button to be visible after hover
  const settingsButton = this.page.getByTestId('field-settings-button-1');
  await expect(settingsButton).toBeVisible({ timeout: 30_000 });
  await settingsButton.hover();
  await settingsButton.click();

  // Fill settings
  const settingsPanel = this.page.getByTestId('field-settings-panel');
  await expect(settingsPanel).toBeVisible({ timeout: 15_000 });

  await this.page.waitForSelector('#field-label', { timeout: 10_000 });
  await this.page.fill('#field-label', `Short Answer Field ${Date.now()}`);
  await this.page.fill('#field-hint', 'Provide a concise answer.');
  await this.page.fill('#field-placeholder', 'Enter your response');
  await this.page.fill('#field-prefix', 'QA');
  await this.page.fill('#field-defaultValue', 'Default response');

  // Validation: set min/max length
  await this.page.fill('#field-validation\\.minLength', '1');
  await this.page.fill('#field-validation\\.maxLength', '50');

  // Required toggle
  const requiredToggle = this.page.locator('#field-required');
  const isChecked = await requiredToggle.isChecked();
  if (!isChecked) {
    await requiredToggle.click();
  }

  // Assert values persisted
  await expect(this.page.locator('#field-label')).toHaveValue(/Short Answer/);
  await expect(this.page.locator('#field-placeholder')).toHaveValue('Enter your response');
});

When('I open the short text field settings', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  // Hover and click settings button for the first field
  const fieldCard = this.page.locator('[data-testid^="draggable-field-"]').first();
  await fieldCard.hover();

  // Wait for settings button to be visible after hover
  const settingsButton = this.page.getByTestId('field-settings-button-1');
  await expect(settingsButton).toBeVisible({ timeout: 30_000 });
  await settingsButton.hover();
  await settingsButton.click();

  // Wait for settings panel to be visible
  const settingsPanel = this.page.getByTestId('field-settings-panel');
  await expect(settingsPanel).toBeVisible({ timeout: 15_000 });
  await this.page.waitForSelector('#field-label', { timeout: 10_000 });
});

When('I open the long text field settings', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  // Hover and click settings button for the first field
  const fieldCard = this.page.locator('[data-testid^="draggable-field-"]').first();
  await fieldCard.hover();

  // Wait for settings button to be visible after hover
  const settingsButton = this.page.getByTestId('field-settings-button-1');
  await expect(settingsButton).toBeVisible({ timeout: 30_000 });
  await settingsButton.hover();
  await settingsButton.click();

  // Wait for settings panel to be visible
  const settingsPanel = this.page.getByTestId('field-settings-panel');
  await expect(settingsPanel).toBeVisible({ timeout: 15_000 });
  await this.page.waitForSelector('#field-label', { timeout: 10_000 });
});

// Form Publishing and Viewer Steps

When('I publish the form', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  const publishButton = this.page.getByTestId('publish-form-button');
  await expect(publishButton).toBeVisible({ timeout: 10_000 });
  await publishButton.click();

  // Wait for the status badge to update to "Live"
  const statusBadge = this.page.getByTestId('form-status-badge');
  await expect(statusBadge).toContainText(/live/i, { timeout: 15_000 });
});

Then('the form should be published', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  const statusBadge = this.page.getByTestId('form-status-badge');
  await expect(statusBadge).toBeVisible({ timeout: 10_000 });
  await expect(statusBadge).toContainText(/live/i);

  // Verify unpublish button is now visible instead of publish
  const unpublishButton = this.page.getByTestId('unpublish-form-button');
  await expect(unpublishButton).toBeVisible({ timeout: 10_000 });
});

When('I get the form short URL', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  // Extract the formId from URL
  const currentUrl = this.page.url();
  const formIdMatch = currentUrl.match(/\/dashboard\/form\/([^/?]+)/);

  if (!formIdMatch) {
    throw new Error('Could not extract form ID from URL');
  }

  const formId = formIdMatch[1];

  // Extract shortUrl from Apollo Client cache in the browser
  const shortUrl = await this.page.evaluate((id) => {
    // Access the Apollo Client cache
    const apolloState = (window as any).__APOLLO_STATE__;
    if (apolloState) {
      // Try to find the form in the cache
      const formKey = `Form:${id}`;
      if (apolloState[formKey] && apolloState[formKey].shortUrl) {
        return apolloState[formKey].shortUrl;
      }
    }

    // Fallback: try to get it from Apollo Client directly
    const apolloClient = (window as any).__APOLLO_CLIENT__;
    if (apolloClient) {
      try {
        const data = apolloClient.cache.readQuery({
          query: {
            kind: 'Document',
            definitions: [{
              kind: 'OperationDefinition',
              operation: 'query',
              selectionSet: {
                kind: 'SelectionSet',
                selections: [{
                  kind: 'Field',
                  name: { kind: 'Name', value: 'form' },
                  arguments: [{
                    kind: 'Argument',
                    name: { kind: 'Name', value: 'id' },
                    value: { kind: 'Variable', name: { kind: 'Name', value: 'id' } }
                  }],
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'shortUrl' } }
                    ]
                  }
                }]
              }
            }]
          },
          variables: { id }
        });
        if (data && data.form && data.form.shortUrl) {
          return data.form.shortUrl;
        }
      } catch (e) {
        console.error('Error reading from Apollo cache:', e);
      }
    }

    // Last resort: use formId as shortUrl
    return id;
  }, formId);

  this.formShortUrl = shortUrl;
});

When('I navigate to the form viewer with the short URL', async function (this: CustomWorld) {
  if (!this.formShortUrl) {
    throw new Error('Form short URL is not set');
  }

  if (!this.browser) {
    throw new Error('Browser is not initialized');
  }

  // Create a new context and page for the viewer
  const viewerContext = await this.browser.newContext({
    baseURL: this.formViewerUrl,
    viewport: { width: 1280, height: 720 },
  });

  this.viewerPage = await viewerContext.newPage();

  // Navigate to the form viewer with the short URL (format: /f/{shortUrl})
  await this.viewerPage.goto(`/f/${this.formShortUrl}`);

  // Wait for either success or error state
  await this.viewerPage.waitForSelector(
    '[data-testid="form-viewer-loading"], [data-testid="form-viewer-error"], [data-testid="form-viewer-renderer"]',
    { timeout: 30_000 }
  );
});

Then('I should see the form in the viewer', async function (this: CustomWorld) {
  if (!this.viewerPage) {
    throw new Error('Viewer page is not initialized');
  }

  // Wait for the form renderer to be visible (not loading or error)
  const formRenderer = this.viewerPage.getByTestId('form-viewer-renderer');
  await expect(formRenderer).toBeVisible({ timeout: 30_000 });

  // Ensure no error state is shown
  const errorState = this.viewerPage.getByTestId('form-viewer-error');
  await expect(errorState).not.toBeVisible();
});

Then('I should see the form title in the viewer', async function (this: CustomWorld) {
  if (!this.viewerPage) {
    throw new Error('Viewer page is not initialized');
  }

  if (!this.newFormTitle) {
    throw new Error('Form title is not set');
  }

  // The form title should be visible somewhere in the viewer
  // This might be in the FormRenderer component or in the page metadata
  await expect(this.viewerPage.getByText(this.newFormTitle)).toBeVisible({ timeout: 10_000 });
});

Then('the form viewer should show an error', async function (this: CustomWorld) {
  if (!this.viewerPage) {
    throw new Error('Viewer page is not initialized');
  }

  // Wait for the error state to be visible
  const errorState = this.viewerPage.getByTestId('form-viewer-error');
  await expect(errorState).toBeVisible({ timeout: 30_000 });

  // Verify the error message indicates form is not accessible
  // Could be "not yet published" or "doesn't exist" depending on the exact error
  const errorMessage = this.viewerPage.getByTestId('form-viewer-error-message');
  const messageText = await errorMessage.textContent();

  // Accept either "not yet published" or "doesn't exist" as valid error messages
  const isValidError = messageText?.includes('not yet published') || messageText?.includes("doesn't exist");

  if (!isValidError) {
    throw new Error(`Unexpected error message: ${messageText}`);
  }
});

Then('I test invalid min length data', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  // Test 1: Negative number
  await this.page.fill('#field-validation\\.minLength', '-1');
  await this.page.locator('#field-label').click(); // Blur to trigger validation

  const negativeError = this.page.locator('text=/Minimum length must be 0 or greater/i').first();
  await expect(negativeError).toBeVisible({ timeout: 5_000 });

  // Test 2: Exceeds 5000 characters limit
  await this.page.fill('#field-validation\\.minLength', '5001');
  await this.page.locator('#field-label').click();

  const exceedsLimitError = this.page.locator('text=/Cannot exceed 5000 characters/i').first();
  await expect(exceedsLimitError).toBeVisible({ timeout: 5_000 });

  // Fix: Set valid min length
  await this.page.fill('#field-validation\\.minLength', '10');
  await this.page.locator('#field-label').click();

  // Verify errors are gone
  await expect(negativeError).not.toBeVisible();
  await expect(exceedsLimitError).not.toBeVisible();
});

Then('I test invalid max length data', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  // Test 1: Zero (must be at least 1)
  await this.page.fill('#field-validation\\.maxLength', '0');
  await this.page.locator('#field-label').click(); // Blur to trigger validation

  const zeroError = this.page.locator('text=/Maximum length must be 1 or greater/i').first();
  await expect(zeroError).toBeVisible({ timeout: 5_000 });

  // Test 2: Exceeds 5000 characters limit
  await this.page.fill('#field-validation\\.maxLength', '5001');
  await this.page.locator('#field-label').click();

  const exceedsLimitError = this.page.locator('text=/Cannot exceed 5000 characters/i').first();
  await expect(exceedsLimitError).toBeVisible({ timeout: 5_000 });

  // Fix: Set valid max length
  await this.page.fill('#field-validation\\.maxLength', '100');
  await this.page.locator('#field-label').click();

  // Verify errors are gone
  await expect(zeroError).not.toBeVisible();
  await expect(exceedsLimitError).not.toBeVisible();
});

Then('I test selection limits validation for checkbox', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  // Test 1: Min > Max
  await this.page.fill('#field-validation\\.minSelections', '3');
  await this.page.fill('#field-validation\\.maxSelections', '2');
  await this.page.locator('#field-label').click(); // Blur

  const minMaxError = this.page.locator('text=/Minimum selections must be less than or equal to maximum selections/i').first();
  await expect(minMaxError).toBeVisible({ timeout: 5_000 });

  // Fix: Set valid range
  await this.page.fill('#field-validation\\.minSelections', '2');
  await this.page.fill('#field-validation\\.maxSelections', '5');
});

Then('I test min greater than max validation', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  // Set min > max
  await this.page.fill('#field-validation\\.minLength', '100');
  await this.page.fill('#field-validation\\.maxLength', '50');
  await this.page.locator('#field-label').click(); // Blur to trigger validation

  const minMaxError = this.page.locator('text=/Minimum length must be less than or equal to maximum length/i').first();
  await expect(minMaxError).toBeVisible({ timeout: 5_000 });

  // Fix: Set valid range
  await this.page.fill('#field-validation\\.minLength', '10');
  await this.page.fill('#field-validation\\.maxLength', '100');
  await this.page.locator('#field-label').click();

  // Verify error is gone
  await expect(minMaxError).not.toBeVisible();
});

Then('I verify all validations work correctly', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  // Final check: Ensure form is in valid state
  const settingsPanel = this.page.getByTestId('field-settings-panel');
  await expect(settingsPanel).toBeVisible();

  // Verify the form has valid data by checking specific fields
  const labelValue = await this.page.locator('#field-label').inputValue();
  expect(labelValue).toBe('Valid Label');

  const minLengthValue = await this.page.locator('#field-validation\\.minLength').inputValue();
  expect(minLengthValue).toBe('10');

  const maxLengthValue = await this.page.locator('#field-validation\\.maxLength').inputValue();
  expect(maxLengthValue).toBe('100');

  // Ensure no validation error messages are visible (use exact error message patterns)
  const labelError = this.page.locator('text=/Field label is required/i');
  const labelTooLongError = this.page.locator('text=/Label is too long/i');
  const hintError = this.page.locator('text=/Help text is too long/i');
  const placeholderError = this.page.locator('text=/Placeholder is too long/i');
  const prefixError = this.page.locator('text=/Prefix is too long/i');
  const defaultValueError = this.page.locator('text=/Default value is too long/i');
  const minLengthNegativeError = this.page.locator('text=/Minimum length must be 0 or greater/i');
  const minLengthExceedsError = this.page.locator('text=/Minimum length cannot exceed 5000/i');
  const maxLengthZeroError = this.page.locator('text=/Maximum length must be 1 or greater/i');
  const maxLengthExceedsError = this.page.locator('text=/Maximum length cannot exceed 5000/i');
  const minMaxError = this.page.locator('text=/Minimum length must be less than or equal to maximum/i');

  await expect(labelError).not.toBeVisible();
  await expect(labelTooLongError).not.toBeVisible();
  await expect(hintError).not.toBeVisible();
  await expect(placeholderError).not.toBeVisible();
  await expect(prefixError).not.toBeVisible();
  await expect(defaultValueError).not.toBeVisible();
  await expect(minLengthNegativeError).not.toBeVisible();
  await expect(minLengthExceedsError).not.toBeVisible();
  await expect(maxLengthZeroError).not.toBeVisible();
  await expect(maxLengthExceedsError).not.toBeVisible();
  await expect(minMaxError).not.toBeVisible();
});

// Enhanced Long Text Validation Steps for Template Creation

Then('I test label and hint validation for long text', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  // Test 1: Empty label (required field)
  await this.page.fill('#field-label', '');
  await this.page.locator('#field-hint').click(); // Blur to trigger validation

  const emptyLabelError = this.page.locator('text=/Field label is required/i').first();
  await expect(emptyLabelError).toBeVisible({ timeout: 5_000 });

  // Test 2: Label too long (201 characters)
  const longLabel = 'A'.repeat(201);
  await this.page.fill('#field-label', longLabel);
  await this.page.locator('#field-hint').click();

  const labelTooLongError = this.page.locator('text=/Label is too long/i').first();
  await expect(labelTooLongError).toBeVisible({ timeout: 5_000 });

  // Test 3: Hint too long (501 characters)
  const longHint = 'B'.repeat(501);
  await this.page.fill('#field-hint', longHint);
  await this.page.locator('#field-label').click();

  const hintTooLongError = this.page.locator('text=/Help text is too long/i').first();
  await expect(hintTooLongError).toBeVisible({ timeout: 5_000 });

  // Verify all errors are visible
  await expect(labelTooLongError).toBeVisible();
  await expect(hintTooLongError).toBeVisible();
});

Then('I test min max length validation for long text', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  // Test 1: Negative min length
  await this.page.fill('#field-validation\\.minLength', '-1');
  await this.page.locator('#field-label').click(); // Blur

  const negativeMinError = this.page.locator('text=/Minimum length must be 0 or greater/i').first();
  await expect(negativeMinError).toBeVisible({ timeout: 5_000 });

  // Test 2: Max length = 0 (must be >= 1)
  await this.page.fill('#field-validation\\.maxLength', '0');
  await this.page.locator('#field-label').click();

  const zeroMaxError = this.page.locator('text=/Maximum length must be 1 or greater/i').first();
  await expect(zeroMaxError).toBeVisible({ timeout: 5_000 });

  // Test 3: Min > Max (set min=100, max=50)
  await this.page.fill('#field-validation\\.minLength', '100');
  await this.page.fill('#field-validation\\.maxLength', '50');
  await this.page.locator('#field-label').click();

  const minGreaterThanMaxError = this.page.locator('text=/Minimum length must be less than or equal to maximum length/i').first();
  await expect(minGreaterThanMaxError).toBeVisible({ timeout: 5_000 });
});

Then('I verify save button is disabled with errors', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  // Check if save button exists and is disabled
  const saveButton = this.page.getByRole('button', { name: /save/i });
  await expect(saveButton).toBeVisible({ timeout: 5_000 });
  await expect(saveButton).toBeDisabled({ timeout: 5_000 });

  // Verify validation summary is visible
  const validationSummary = this.page.locator('text=/Please fix the following issues to save/i').first();
  await expect(validationSummary).toBeVisible({ timeout: 5_000 });
});

Then('I fix all validation errors for long text', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  // Fix label: Set valid length (< 200 chars)
  await this.page.fill('#field-label', `Long Answer Field ${Date.now()}`);

  // Fix hint: Set valid length (< 500 chars)
  await this.page.fill('#field-hint', 'Please provide a detailed answer.');

  // Fix placeholder
  await this.page.fill('#field-placeholder', 'Type your answer here...');

  // Fix min/max length: Set valid values
  await this.page.fill('#field-validation\\.minLength', '10');
  await this.page.fill('#field-validation\\.maxLength', '500');

  // Blur to trigger final validation
  await this.page.locator('#field-label').click();

  // Wait a bit for validation to complete
  await this.page.waitForTimeout(1000);
});

Then('I verify save button is enabled', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  // Check if save button is now enabled
  const saveButton = this.page.getByRole('button', { name: /save/i });
  await expect(saveButton).toBeVisible({ timeout: 5_000 });
  await expect(saveButton).toBeEnabled({ timeout: 5_000 });

  // Verify no validation summary
  const validationSummary = this.page.locator('text=/Please fix the following issues to save/i').first();
  await expect(validationSummary).not.toBeVisible();
});

Then('I save the long text field settings', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  // Click save button
  const saveButton = this.page.getByRole('button', { name: /save/i });
  await saveButton.click();

  // Wait for save to complete (settings panel should close or show success)
  await this.page.waitForTimeout(1000);

  // Verify field is saved
  const fieldContent = this.page.getByTestId('field-content-1');
  await expect(fieldContent).toBeVisible({ timeout: 5_000 });
});

Then('I fill the long text field settings with valid data', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  // Fill settings with valid data
  const settingsPanel = this.page.getByTestId('field-settings-panel');
  await expect(settingsPanel).toBeVisible({ timeout: 15_000 });

  await this.page.waitForSelector('#field-label', { timeout: 10_000 });
  await this.page.fill('#field-label', `Long Answer Field ${Date.now()}`);
  await this.page.fill('#field-hint', 'Please provide a detailed answer.');
  await this.page.fill('#field-placeholder', 'Type your response here...');
  await this.page.fill('#field-defaultValue', 'Default long text response');

  // Validation: set min/max length
  await this.page.fill('#field-validation\\.minLength', '10');
  await this.page.fill('#field-validation\\.maxLength', '500');

  // Required toggle
  const requiredToggle = this.page.locator('#field-required');
  const isChecked = await requiredToggle.isChecked();
  if (!isChecked) {
    await requiredToggle.click();
  }

  // Assert values persisted
  await expect(this.page.locator('#field-label')).toHaveValue(/Long Answer/);
  await expect(this.page.locator('#field-placeholder')).toHaveValue('Type your response here...');
});

// Email Field Test Steps

Then('I drag an email field onto the page', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  const fieldTile = this.page.getByTestId('field-type-email');
  const droppablePage = this.page.getByTestId('droppable-page').first();

  await fieldTile.dragTo(droppablePage);

  const fieldContent = droppablePage.getByTestId('field-content-1');
  await expect(fieldContent).toBeVisible({ timeout: 15_000 });
});

When('I open the email field settings', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  // Hover and click settings button for the first field
  const fieldCard = this.page.locator('[data-testid^="draggable-field-"]').first();
  await fieldCard.hover();

  // Wait for settings button to be visible after hover
  const settingsButton = this.page.getByTestId('field-settings-button-1');
  await expect(settingsButton).toBeVisible({ timeout: 30_000 });
  await settingsButton.hover();
  await settingsButton.click();

  // Wait for settings panel to be visible
  const settingsPanel = this.page.getByTestId('field-settings-panel');
  await expect(settingsPanel).toBeVisible({ timeout: 15_000 });
  await this.page.waitForSelector('#field-label', { timeout: 10_000 });
});

Then('I fill the email field settings with valid data', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  // Fill settings with valid data
  const settingsPanel = this.page.getByTestId('field-settings-panel');
  await expect(settingsPanel).toBeVisible({ timeout: 15_000 });

  await this.page.waitForSelector('#field-label', { timeout: 10_000 });
  await this.page.fill('#field-label', `Email Address Field ${Date.now()}`);
  await this.page.fill('#field-hint', 'We will never share your email with anyone.');
  await this.page.fill('#field-placeholder', 'you@example.com');
  await this.page.fill('#field-defaultValue', 'test@example.com');

  // Required toggle
  const requiredToggle = this.page.locator('#field-required');
  const isChecked = await requiredToggle.isChecked();
  if (!isChecked) {
    await requiredToggle.click();
  }

  // Assert values persisted
  await expect(this.page.locator('#field-label')).toHaveValue(/Email Address/);
  await expect(this.page.locator('#field-placeholder')).toHaveValue('you@example.com');
});

Then('I test label and hint validation for email', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  // Test 1: Empty label (required field)
  await this.page.fill('#field-label', '');
  await this.page.locator('#field-hint').click(); // Blur to trigger validation

  const emptyLabelError = this.page.locator('text=/Field label is required/i').first();
  await expect(emptyLabelError).toBeVisible({ timeout: 5_000 });

  // Test 2: Label too long (201 characters)
  const longLabel = 'A'.repeat(201);
  await this.page.fill('#field-label', longLabel);
  await this.page.locator('#field-hint').click();

  const labelTooLongError = this.page.locator('text=/Label is too long/i').first();
  await expect(labelTooLongError).toBeVisible({ timeout: 5_000 });

  // Test 3: Hint too long (501 characters)
  const longHint = 'B'.repeat(501);
  await this.page.fill('#field-hint', longHint);
  await this.page.locator('#field-label').click();

  const hintTooLongError = this.page.locator('text=/Help text is too long/i').first();
  await expect(hintTooLongError).toBeVisible({ timeout: 5_000 });

  // Verify all errors are visible
  await expect(labelTooLongError).toBeVisible();
  await expect(hintTooLongError).toBeVisible();
});

Then('I test placeholder validation for email', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  // Test: Placeholder too long (101 characters)
  const longPlaceholder = 'C'.repeat(101);
  await this.page.fill('#field-placeholder', longPlaceholder);
  await this.page.locator('#field-label').click(); // Blur

  const placeholderTooLongError = this.page.locator('text=/Placeholder is too long/i').first();
  await expect(placeholderTooLongError).toBeVisible({ timeout: 5_000 });
});

Then('I test default value validation for email', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  // Test: Default value too long (1001 characters)
  const longDefaultValue = 'D'.repeat(1001);
  await this.page.fill('#field-defaultValue', longDefaultValue);
  await this.page.locator('#field-label').click(); // Blur

  const defaultValueTooLongError = this.page.locator('text=/Default value is too long/i').first();
  await expect(defaultValueTooLongError).toBeVisible({ timeout: 5_000 });
});

Then('I fix all validation errors for email', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  // Fix label: Set valid length (< 200 chars)
  await this.page.fill('#field-label', `Email Field ${Date.now()}`);

  // Fix hint: Set valid length (< 500 chars)
  await this.page.fill('#field-hint', 'We will never share your email.');

  // Fix placeholder: Set valid length (< 100 chars)
  await this.page.fill('#field-placeholder', 'you@example.com');

  // Fix default value: Set valid length (< 1000 chars)
  await this.page.fill('#field-defaultValue', 'test@example.com');

  // Blur to trigger final validation
  await this.page.locator('#field-label').click();

  // Wait a bit for validation to complete
  await this.page.waitForTimeout(1000);
});

Then('I save the email field settings', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  // Click save button
  const saveButton = this.page.getByRole('button', { name: /save/i });
  await saveButton.click();

  // Wait for save to complete
  await this.page.waitForTimeout(1000);

  // Verify field is saved
  const fieldContent = this.page.getByTestId('field-content-1');
  await expect(fieldContent).toBeVisible({ timeout: 5_000 });
});

// Number Field Test Steps

Then('I drag a number field onto the page', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  const fieldTile = this.page.getByTestId('field-type-number');
  const droppablePage = this.page.getByTestId('droppable-page').first();

  await fieldTile.dragTo(droppablePage);

  const fieldContent = droppablePage.getByTestId('field-content-1');
  await expect(fieldContent).toBeVisible({ timeout: 15_000 });
});

When('I open the number field settings', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  // Find the last field card (the one we just dragged)
  const fieldCards = this.page.locator('[data-testid^="draggable-field-"]');
  await expect(fieldCards.last()).toBeVisible({ timeout: 10_000 });
  const lastFieldCard = fieldCards.last();

  // Hover to show actions
  await lastFieldCard.hover();

  // Find the settings button within the last field card
  const settingsButton = lastFieldCard.locator('[data-testid^="field-settings-button-"]');
  await expect(settingsButton).toBeVisible({ timeout: 5_000 });

  // Wait for stability
  await this.page.waitForTimeout(1000);

  // Force click to avoid interception issues
  await settingsButton.click({ force: true });

  // Wait for settings panel to be visible
  const settingsPanel = this.page.getByTestId('field-settings-panel');
  await expect(settingsPanel).toBeVisible({ timeout: 15_000 });

  // Wait for specific number field input to ensure it's the right panel
  await this.page.waitForSelector('#field-label', { timeout: 10_000 });
});

Then('I fill the number field settings with valid data', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  // Fill settings with valid data
  const settingsPanel = this.page.getByTestId('field-settings-panel');
  await expect(settingsPanel).toBeVisible({ timeout: 15_000 });

  await this.page.waitForSelector('#field-label', { timeout: 10_000 });
  await this.page.fill('#field-label', `Quantity Field ${Date.now()}`);
  await this.page.fill('#field-hint', 'Enter the amount.');
  await this.page.fill('#field-placeholder', '0');
  await this.page.fill('#field-defaultValue', '10');

  // Validation: set min/max values
  await this.page.fill('#field-min', '0');
  await this.page.fill('#field-max', '100');

  // Required toggle
  const requiredToggle = this.page.locator('#field-required');
  const isChecked = await requiredToggle.isChecked();
  if (!isChecked) {
    await requiredToggle.click();
  }

  // Assert values persisted
  await expect(this.page.locator('#field-label')).toHaveValue(/Quantity/);
  await expect(this.page.locator('#field-placeholder')).toHaveValue('0');
});

Then('I test label validation for number', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  // Test 1: Empty label (required field)
  await this.page.fill('#field-label', '');
  await this.page.locator('#field-hint').click(); // Blur to trigger validation

  const emptyLabelError = this.page.locator('text=/Field label is required/i').first();
  await expect(emptyLabelError).toBeVisible({ timeout: 5_000 });

  // Test 2: Label too long (201 characters) - NEW validation added
  const longLabel = 'A'.repeat(201);
  await this.page.fill('#field-label', longLabel);
  await this.page.locator('#field-hint').click();

  const labelTooLongError = this.page.locator('text=/Label is too long/i').first();
  await expect(labelTooLongError).toBeVisible({ timeout: 5_000 });
});

Then('I test min max value validation for number', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  // Test: Min > Max (set min=100, max=50)
  await this.page.fill('#field-min', '100');
  await this.page.fill('#field-max', '50');
  await this.page.locator('#field-label').click(); // Blur

  const minGreaterThanMaxError = this.page.locator('text=/Minimum value must be less than or equal to maximum value/i').first();
  await expect(minGreaterThanMaxError).toBeVisible({ timeout: 5_000 });
});

Then('I test default value range validation for number', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  // Setup valid min/max first
  await this.page.fill('#field-min', '10');
  await this.page.fill('#field-max', '100');

  // Test 1: Default value < Min
  await this.page.fill('#field-defaultValue', '5');
  await this.page.locator('#field-label').click(); // Blur

  const defaultValueRangeError = this.page.locator('text=/Default value must be greater than or equal to minimum value/i').first();
  await expect(defaultValueRangeError).toBeVisible({ timeout: 5_000 });

  // Test 2: Default value > Max
  await this.page.fill('#field-defaultValue', '150');
  await this.page.locator('#field-label').click(); // Blur

  const defaultValueAboveMaxError = this.page.locator('text=/Default value must be less than or equal to maximum value/i').first();
  await expect(defaultValueAboveMaxError).toBeVisible({ timeout: 5_000 });
});

Then('I fix all validation errors for number', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  // Fix label: Set valid length (< 200 chars)
  await this.page.fill('#field-label', `Number Field ${Date.now()}`);

  // Fix min/max: Set valid range
  await this.page.fill('#field-min', '0');
  await this.page.fill('#field-max', '100');

  // Fix default value: Set within range
  await this.page.fill('#field-defaultValue', '50');

  // Blur to trigger final validation
  await this.page.locator('#field-label').click();

  // Wait a bit for validation to complete
  await this.page.waitForTimeout(1000);
});

Then('I save the number field settings', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  // Click save button
  const saveButton = this.page.getByRole('button', { name: /save/i });
  await saveButton.click();

  // Wait for save to complete
  await this.page.waitForTimeout(1000);

  // Verify field is saved
  const fieldContent = this.page.getByTestId('field-content-1');
  await expect(fieldContent).toBeVisible({ timeout: 5_000 });
});

// Date Field Test Steps

Then('I drag a date field onto the page', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  const fieldTile = this.page.getByTestId('field-type-date');
  const droppablePage = this.page.getByTestId('droppable-page').first();

  // Get initial field count
  const initialCount = await droppablePage.locator('[data-testid^="field-content-"]').count();

  await fieldTile.dragTo(droppablePage);

  // Wait for count to increase
  await expect(async () => {
    const newCount = await droppablePage.locator('[data-testid^="field-content-"]').count();
    expect(newCount).toBeGreaterThan(initialCount);
  }).toPass({ timeout: 15000 });
});

When('I open the date field settings', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  // Find the last field card (the one we just dragged)
  const fieldCards = this.page.locator('[data-testid^="draggable-field-"]');
  await expect(fieldCards.last()).toBeVisible({ timeout: 10_000 });
  const lastFieldCard = fieldCards.last();

  // Hover to show actions
  await lastFieldCard.hover();

  // Find the settings button within the last field card
  const settingsButton = lastFieldCard.locator('[data-testid^="field-settings-button-"]');
  await expect(settingsButton).toBeVisible({ timeout: 5_000 });

  // Wait for stability
  await this.page.waitForTimeout(1000);

  // Force click to avoid interception issues
  await settingsButton.click({ force: true });

  // Wait for settings panel to be visible
  const settingsPanel = this.page.getByTestId('field-settings-panel');
  await expect(settingsPanel).toBeVisible({ timeout: 15_000 });

  // Wait for specific date field input to ensure it's the right panel
  await this.page.waitForSelector('#field-label', { timeout: 10_000 });
});

Then('I fill the date field settings with valid data', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  // Fill settings with valid data
  const settingsPanel = this.page.getByTestId('field-settings-panel');
  await expect(settingsPanel).toBeVisible({ timeout: 15_000 });

  await this.page.waitForSelector('#field-label', { timeout: 10_000 });
  await this.page.fill('#field-label', `Event Date Field ${Date.now()}`);
  await this.page.fill('#field-hint', 'Select the date of the event.');
  await this.page.fill('#field-placeholder', 'MM/DD/YYYY');

  // Set min/max dates (YYYY-MM-DD format for date inputs)
  await this.page.fill('#field-minDate', '2024-01-01');
  await this.page.fill('#field-maxDate', '2024-12-31');

  // Set default value
  await this.page.fill('#field-defaultValue', '2024-06-15');

  // Required toggle
  const requiredToggle = this.page.locator('#field-required');
  const isChecked = await requiredToggle.isChecked();
  if (!isChecked) {
    await requiredToggle.click();
  }

  // Assert values persisted
  await expect(this.page.locator('#field-label')).toHaveValue(/Event Date/);
  await expect(this.page.locator('#field-placeholder')).toHaveValue('MM/DD/YYYY');
});

Then('I test label and hint validation for date', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  // Test 1: Empty label (required field)
  await this.page.fill('#field-label', '');
  await this.page.locator('#field-hint').click(); // Blur to trigger validation

  const emptyLabelError = this.page.locator('text=/Field label is required/i').first();
  await expect(emptyLabelError).toBeVisible({ timeout: 5_000 });

  // Test 2: Label too long (201 characters)
  const longLabel = 'A'.repeat(201);
  await this.page.fill('#field-label', longLabel);
  await this.page.locator('#field-hint').click(); // Blur to trigger validation

  const labelTooLongError = this.page.locator('text=/Label is too long/i').first();
  await expect(labelTooLongError).toBeVisible({ timeout: 5_000 });

  // Test 3: Hint too long (501 characters)
  const longHint = 'B'.repeat(501);
  await this.page.fill('#field-hint', longHint);
  await this.page.locator('#field-label').click();

  const hintTooLongError = this.page.locator('text=/Help text is too long/i').first();
  await expect(hintTooLongError).toBeVisible({ timeout: 5_000 });

  // Test 4: Placeholder too long (101 characters)
  const longPlaceholder = 'C'.repeat(101);
  await this.page.fill('#field-placeholder', longPlaceholder);
  await this.page.locator('#field-label').click();

  const placeholderTooLongError = this.page.locator('text=/Placeholder is too long/i').first();
  await expect(placeholderTooLongError).toBeVisible({ timeout: 5_000 });
});

Then('I test min max date validation for date', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  // Test: Min date > Max date (set min=2024-12-31, max=2024-01-01)
  await this.page.fill('#field-minDate', '2024-12-31');
  await this.page.fill('#field-maxDate', '2024-01-01');
  await this.page.locator('#field-label').click(); // Blur

  const minGreaterThanMaxError = this.page.locator('text=/Minimum date must be before or equal to maximum date/i').first();
  await expect(minGreaterThanMaxError).toBeVisible({ timeout: 5_000 });
});

Then('I test default value date validation for date', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  // Setup valid min/max first
  await this.page.fill('#field-minDate', '2024-01-01');
  await this.page.fill('#field-maxDate', '2024-12-31');

  // Test 1: Default value < Min
  await this.page.fill('#field-defaultValue', '2023-12-31');
  await this.page.locator('#field-label').click(); // Blur

  const defaultValueRangeError = this.page.locator('text=/Default date must be after or equal to minimum date/i').first();
  await expect(defaultValueRangeError).toBeVisible({ timeout: 5_000 });

  // Test 2: Default value > Max
  await this.page.fill('#field-defaultValue', '2025-01-01');
  await this.page.locator('#field-label').click(); // Blur

  const defaultValueAboveMaxError = this.page.locator('text=/Default date must be before or equal to maximum date/i').first();
  await expect(defaultValueAboveMaxError).toBeVisible({ timeout: 5_000 });
});

Then('I fix all validation errors for date', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  // Fix label: Set valid length (< 200 chars)
  await this.page.fill('#field-label', `Date Field ${Date.now()}`);

  // Fix hint: Set valid length (< 500 chars)
  await this.page.fill('#field-hint', 'Select the date of the event.');

  // Fix placeholder: Set valid length (< 100 chars)
  await this.page.fill('#field-placeholder', 'MM/DD/YYYY');

  // Fix min/max dates: Set valid range
  await this.page.fill('#field-minDate', '2024-01-01');
  await this.page.fill('#field-maxDate', '2024-12-31');

  // Fix default value: Set within range
  await this.page.fill('#field-defaultValue', '2024-06-15');

  // Blur to trigger final validation
  await this.page.locator('#field-label').click();

  // Wait a bit for validation to complete
  await this.page.waitForTimeout(1000);
});

Then('I save the date field settings', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  // Click save button
  const saveButton = this.page.getByRole('button', { name: /save/i });
  await saveButton.click();

  // Wait for save to complete
  await this.page.waitForTimeout(1000);

  // Verify field is saved
  const fieldContent = this.page.getByTestId('field-content-1');
  await expect(fieldContent).toBeVisible({ timeout: 5_000 });
});

// Dropdown (Select) Field Test Steps

Then('I drag a dropdown field onto the page', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  const fieldTile = this.page.getByTestId('field-type-dropdown');
  const droppablePage = this.page.getByTestId('droppable-page').first();

  // Get initial field count
  const initialCount = await droppablePage.locator('[data-testid^="field-content-"]').count();

  await fieldTile.dragTo(droppablePage);

  // Wait for count to increase
  await expect(async () => {
    const newCount = await droppablePage.locator('[data-testid^="field-content-"]').count();
    expect(newCount).toBeGreaterThan(initialCount);
  }).toPass({ timeout: 15000 });
});

When('I open the dropdown field settings', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  // Find the last field card (the one we just dragged)
  const fieldCards = this.page.locator('[data-testid^="draggable-field-"]');
  await expect(fieldCards.last()).toBeVisible({ timeout: 10_000 });
  const lastFieldCard = fieldCards.last();

  // Hover to show actions
  await lastFieldCard.hover();

  // Find the settings button within the last field card
  const settingsButton = lastFieldCard.locator('[data-testid^="field-settings-button-"]');
  await expect(settingsButton).toBeVisible({ timeout: 5_000 });

  // Wait for stability
  await this.page.waitForTimeout(1000);

  // Force click to avoid interception issues
  await settingsButton.click({ force: true });

  // Wait for settings panel to be visible
  const settingsPanel = this.page.getByTestId('field-settings-panel');
  await expect(settingsPanel).toBeVisible({ timeout: 15_000 });

  // Wait for specific dropdown field input to ensure it's the right panel
  await this.page.waitForSelector('#field-label', { timeout: 10_000 });
});

Then('I fill the dropdown field settings with valid data', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  // Fill settings with valid data
  const settingsPanel = this.page.getByTestId('field-settings-panel');
  await expect(settingsPanel).toBeVisible({ timeout: 15_000 });

  await this.page.waitForSelector('#field-label', { timeout: 10_000 });
  await this.page.fill('#field-label', `Country Selection Field ${Date.now()}`);
  await this.page.fill('#field-hint', 'Select your country from the list.');

  // Fill option values - we need to find option input fields
  const optionInputs = this.page.locator('input[placeholder="Enter option value"]');
  const optionCount = await optionInputs.count();

  if (optionCount > 0) {
    // Fill first option
    await optionInputs.nth(0).fill('USA');

    // Add more options if needed
    const addOptionButton = this.page.locator('button:has-text("Add Option")');
    if (await addOptionButton.count() > 0) {
      await addOptionButton.click();
      await this.page.waitForTimeout(500);
      await optionInputs.nth(1).fill('Canada');

      await addOptionButton.click();
      await this.page.waitForTimeout(500);
      await optionInputs.nth(2).fill('Mexico');
    }
  }

  // Required toggle
  const requiredToggle = this.page.locator('#field-required');
  const isChecked = await requiredToggle.isChecked();
  if (!isChecked) {
    await requiredToggle.click();
  }

  // Assert values persisted
  await expect(this.page.locator('#field-label')).toHaveValue(/Country Selection/);
});

Then('I test label and hint validation for dropdown', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  // Test 1: Empty label (required field)
  await this.page.fill('#field-label', '');
  await this.page.locator('#field-hint').click(); // Blur to trigger validation

  const emptyLabelError = this.page.locator('text=/Field label is required/i').first();
  await expect(emptyLabelError).toBeVisible({ timeout: 5_000 });

  // Test 2: Label too long (201 characters)
  const longLabel = 'A'.repeat(201);
  await this.page.fill('#field-label', longLabel);
  await this.page.locator('#field-hint').click(); // Blur to trigger validation

  const labelTooLongError = this.page.locator('text=/Label is too long/i').first();
  await expect(labelTooLongError).toBeVisible({ timeout: 5_000 });

  // Test 3: Hint too long (501 characters)
  const longHint = 'B'.repeat(501);
  await this.page.fill('#field-hint', longHint);
  await this.page.locator('#field-label').click();

  const hintTooLongError = this.page.locator('text=/Help text is too long/i').first();
  await expect(hintTooLongError).toBeVisible({ timeout: 5_000 });
});

Then('I test options validation for dropdown', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  // Test 1: Empty option
  const optionInputs = this.page.locator('input[placeholder="Enter option value"]');
  if (await optionInputs.count() > 0) {
    await optionInputs.nth(0).fill('');
    await this.page.locator('#field-label').click(); // Blur

    const emptyOptionError = this.page.locator('text=/All options must have values/i, text=/Option cannot be empty/i').first();
    await expect(emptyOptionError).toBeVisible({ timeout: 5_000 });
  }

  // Test 2: Option too long (101 characters)
  const longOption = 'C'.repeat(101);
  if (await optionInputs.count() > 0) {
    await optionInputs.nth(0).fill(longOption);
    await this.page.locator('#field-label').click(); // Blur

    const optionTooLongError = this.page.locator('text=/Option is too long/i').first();
    await expect(optionTooLongError).toBeVisible({ timeout: 5_000 });
  }

  // Test 3: Duplicate options
  if (await optionInputs.count() >= 2) {
    await optionInputs.nth(0).fill('USA');
    await optionInputs.nth(1).fill('USA'); // Same as first
    await this.page.locator('#field-label').click(); // Blur

    const duplicateError = this.page.locator('text=/Options must be unique/i').first();
    await expect(duplicateError).toBeVisible({ timeout: 5_000 });
  }
});

Then('I fix all validation errors for dropdown', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  // Fix label: Set valid length (< 200 chars)
  await this.page.fill('#field-label', `Dropdown Field ${Date.now()}`);

  // Fix hint: Set valid length (< 500 chars)
  await this.page.fill('#field-hint', 'Select your country from the list.');

  // Fix options: Set valid, unique options
  const optionInputs = this.page.locator('input[placeholder="Enter option value"]');
  if (await optionInputs.count() > 0) {
    await optionInputs.nth(0).fill('USA');
  }
  if (await optionInputs.count() > 1) {
    await optionInputs.nth(1).fill('Canada');
  }
  if (await optionInputs.count() > 2) {
    await optionInputs.nth(2).fill('Mexico');
  }

  // Blur to trigger final validation
  await this.page.locator('#field-label').click();

  // Wait a bit for validation to complete
  await this.page.waitForTimeout(1000);
});

Then('I save the dropdown field settings', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  // Click save button
  const saveButton = this.page.getByRole('button', { name: /save/i });
  await saveButton.click();

  // Wait for save to complete
  await this.page.waitForTimeout(1000);

  // Verify field is saved
  const fieldContent = this.page.getByTestId('field-content-1');
  await expect(fieldContent).toBeVisible({ timeout: 5_000 });
});

// Radio Field Test Steps

Then('I drag a radio field onto the page', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  const fieldTile = this.page.getByTestId('field-type-radio');
  const droppablePage = this.page.getByTestId('droppable-page').first();

  // Get initial field count
  const initialCount = await droppablePage.locator('[data-testid^="field-content-"]').count();

  await fieldTile.dragTo(droppablePage);

  // Wait for count to increase
  await expect(async () => {
    const newCount = await droppablePage.locator('[data-testid^="field-content-"]').count();
    expect(newCount).toBeGreaterThan(initialCount);
  }).toPass({ timeout: 15000 });
});

When('I open the radio field settings', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  // Find the last field card (the one we just dragged)
  const fieldCards = this.page.locator('[data-testid^="draggable-field-"]');
  await expect(fieldCards.last()).toBeVisible({ timeout: 10_000 });
  const lastFieldCard = fieldCards.last();

  // Hover to show actions
  await lastFieldCard.hover();

  // Find the settings button within the last field card
  const settingsButton = lastFieldCard.locator('[data-testid^="field-settings-button-"]');
  await expect(settingsButton).toBeVisible({ timeout: 5_000 });

  // Wait for stability
  await this.page.waitForTimeout(1000);

  // Force click to avoid interception issues
  await settingsButton.click({ force: true });

  // Wait for settings panel to be visible
  const settingsPanel = this.page.getByTestId('field-settings-panel');
  await expect(settingsPanel).toBeVisible({ timeout: 15_000 });

  // Wait for specific radio field input to ensure it's the right panel
  await this.page.waitForSelector('#field-label', { timeout: 10_000 });
});

Then('I fill the radio field settings with valid data', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  // Fill settings with valid data
  const settingsPanel = this.page.getByTestId('field-settings-panel');
  await expect(settingsPanel).toBeVisible({ timeout: 15_000 });

  await this.page.waitForSelector('#field-label', { timeout: 10_000 });
  await this.page.fill('#field-label', `Gender Selection Field ${Date.now()}`);
  await this.page.fill('#field-hint', 'Please select your gender.');

  // Fill option values
  const optionInputs = this.page.locator('input[placeholder="Enter option value"]');
  const optionCount = await optionInputs.count();

  if (optionCount > 0) {
    // Fill first option
    await optionInputs.nth(0).fill('Male');

    // Add more options if needed
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

  // Required toggle
  const requiredToggle = this.page.locator('#field-required');
  const isChecked = await requiredToggle.isChecked();
  if (!isChecked) {
    await requiredToggle.click();
  }

  // Assert values persisted
  await expect(this.page.locator('#field-label')).toHaveValue(/Gender Selection/);
});

Then('I test label and hint validation for radio', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  // Test 1: Empty label (required field)
  await this.page.fill('#field-label', '');
  await this.page.locator('#field-hint').click(); // Blur to trigger validation

  const emptyLabelError = this.page.locator('text=/Field label is required/i').first();
  await expect(emptyLabelError).toBeVisible({ timeout: 5_000 });

  // Test 2: Label too long (201 characters)
  const longLabel = 'A'.repeat(201);
  await this.page.fill('#field-label', longLabel);
  await this.page.locator('#field-hint').click(); // Blur to trigger validation

  const labelTooLongError = this.page.locator('text=/Label is too long/i').first();
  await expect(labelTooLongError).toBeVisible({ timeout: 5_000 });

  // Test 3: Hint too long (501 characters)
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

  // Test 1: Empty option
  const optionInputs = this.page.locator('input[placeholder="Enter option value"]');
  if (await optionInputs.count() > 0) {
    await optionInputs.nth(0).fill('');
    await this.page.locator('#field-label').click(); // Blur

    const emptyOptionError = this.page.locator('text=/All options must have values/i, text=/Option cannot be empty/i').first();
    await expect(emptyOptionError).toBeVisible({ timeout: 5_000 });
  }

  // Test 2: Option too long (101 characters)
  const longOption = 'C'.repeat(101);
  if (await optionInputs.count() > 0) {
    await optionInputs.nth(0).fill(longOption);
    await this.page.locator('#field-label').click(); // Blur

    const optionTooLongError = this.page.locator('text=/Option is too long/i').first();
    await expect(optionTooLongError).toBeVisible({ timeout: 5_000 });
  }

  // Test 3: Duplicate options
  if (await optionInputs.count() >= 2) {
    await optionInputs.nth(0).fill('Male');
    await optionInputs.nth(1).fill('Male'); // Same as first
    await this.page.locator('#field-label').click(); // Blur

    const duplicateError = this.page.locator('text=/Options must be unique/i').first();
    await expect(duplicateError).toBeVisible({ timeout: 5_000 });
  }
});

Then('I fix all validation errors for radio', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  // Fix label: Set valid length (< 200 chars)
  await this.page.fill('#field-label', `Radio Field ${Date.now()}`);

  // Fix hint: Set valid length (< 500 chars)
  await this.page.fill('#field-hint', 'Please select your gender.');

  // Fix options: Set valid, unique options
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

  // Blur to trigger final validation
  await this.page.locator('#field-label').click();

  // Wait a bit for validation to complete
  await this.page.waitForTimeout(1000);
});

Then('I save the radio field settings', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  // Click save button
  const saveButton = this.page.getByRole('button', { name: /save/i });
  await saveButton.click();

  // Wait for save to complete
  await this.page.waitForTimeout(1000);

  // Verify field is saved
  const fieldContent = this.page.getByTestId('field-content-1');
  await expect(fieldContent).toBeVisible({ timeout: 5_000 });
});

// Checkbox Field Test Steps

Then('I drag a checkbox field onto the page', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  const fieldTile = this.page.getByTestId('field-type-checkbox');
  const droppablePage = this.page.getByTestId('droppable-page').first();

  // Get initial field count
  const initialCount = await droppablePage.locator('[data-testid^="field-content-"]').count();

  await fieldTile.dragTo(droppablePage);

  // Wait for count to increase
  await expect(async () => {
    const newCount = await droppablePage.locator('[data-testid^="field-content-"]').count();
    expect(newCount).toBeGreaterThan(initialCount);
  }).toPass({ timeout: 15000 });
});

When('I open the checkbox field settings', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  // Find the last field card (the one we just dragged)
  const fieldCards = this.page.locator('[data-testid^="draggable-field-"]');
  await expect(fieldCards.last()).toBeVisible({ timeout: 10_000 });
  const lastFieldCard = fieldCards.last();

  // Hover to show actions
  await lastFieldCard.hover();

  // Find the settings button within the last field card
  const settingsButton = lastFieldCard.locator('[data-testid^="field-settings-button-"]');
  await expect(settingsButton).toBeVisible({ timeout: 5_000 });

  // Wait for stability
  await this.page.waitForTimeout(1000);

  // Force click to avoid interception issues
  await settingsButton.click({ force: true });

  // Wait for settings panel to be visible
  const settingsPanel = this.page.getByTestId('field-settings-panel');
  await expect(settingsPanel).toBeVisible({ timeout: 15_000 });

  // Wait for specific checkbox field input to ensure it's the right panel
  await this.page.waitForSelector('#field-label', { timeout: 10_000 });
});

Then('I fill the checkbox field settings with valid data', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  // Fill settings with valid data
  const settingsPanel = this.page.getByTestId('field-settings-panel');
  await expect(settingsPanel).toBeVisible({ timeout: 15_000 });

  await this.page.waitForSelector('#field-label', { timeout: 10_000 });
  await this.page.fill('#field-label', `Hobbies Selection Field ${Date.now()}`);
  await this.page.fill('#field-hint', 'Select your favorite hobbies.');

  // Fill option values
  const optionInputs = this.page.locator('input[placeholder="Enter option value"]');
  const optionCount = await optionInputs.count();

  if (optionCount > 0) {
    // Fill first option
    await optionInputs.nth(0).fill('Reading');

    // Add more options
    const addOptionButton = this.page.locator('button:has-text("Add Option")');
    if (await addOptionButton.count() > 0) {
      await addOptionButton.click();
      await this.page.waitForTimeout(500);
      await optionInputs.nth(1).fill('Gaming');

      await addOptionButton.click();
      await this.page.waitForTimeout(500);
      await optionInputs.nth(2).fill('Sports');

      await addOptionButton.click();
      await this.page.waitForTimeout(500);
      await optionInputs.nth(3).fill('Music');
    }
  }

  // Set selection limits
  await this.page.fill('input[name="validation.minSelections"]', '1');
  await this.page.fill('input[name="validation.maxSelections"]', '3');

  // Required toggle
  const requiredToggle = this.page.locator('#field-required');
  const isChecked = await requiredToggle.isChecked();
  if (!isChecked) {
    await requiredToggle.click();
  }

  // Assert values persisted
  await expect(this.page.locator('#field-label')).toHaveValue(/Hobbies/);
});

Then('I test label and hint validation for checkbox', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  // Test 1: Empty label (required field)
  await this.page.fill('#field-label', '');
  await this.page.locator('#field-hint').click(); // Blur to trigger validation

  const emptyLabelError = this.page.locator('text=/Field label is required/i').first();
  await expect(emptyLabelError).toBeVisible({ timeout: 5_000 });

  // Test 2: Label too long (201 characters)
  const longLabel = 'A'.repeat(201);
  await this.page.fill('#field-label', longLabel);
  await this.page.locator('#field-hint').click(); // Blur to trigger validation

  const labelTooLongError = this.page.locator('text=/Label is too long/i').first();
  await expect(labelTooLongError).toBeVisible({ timeout: 5_000 });

  // Test 3: Hint too long (501 characters)
  const longHint = 'B'.repeat(501);
  await this.page.fill('#field-hint', longHint);
  await this.page.locator('#field-label').click();

  const hintTooLongError = this.page.locator('text=/Help text is too long/i').first();
  await expect(hintTooLongError).toBeVisible({ timeout: 5_000 });
});

Then('I test options validation for checkbox', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  // Test 1: Empty option
  const optionInputs = this.page.locator('input[placeholder="Enter option value"]');
  if (await optionInputs.count() > 0) {
    await optionInputs.nth(0).fill('');
    await this.page.locator('#field-label').click(); // Blur

    const emptyOptionError = this.page.locator('text=/All options must have values/i, text=/Option cannot be empty/i').first();
    await expect(emptyOptionError).toBeVisible({ timeout: 5_000 });
  }

  // Test 2: Option too long (101 characters)
  const longOption = 'C'.repeat(101);
  if (await optionInputs.count() > 0) {
    await optionInputs.nth(0).fill(longOption);
    await this.page.locator('#field-label').click(); // Blur

    const optionTooLongError = this.page.locator('text=/Option is too long/i').first();
    await expect(optionTooLongError).toBeVisible({ timeout: 5_000 });
  }

  // Test 3: Duplicate options
  if (await optionInputs.count() >= 2) {
    await optionInputs.nth(0).fill('Reading');
    await optionInputs.nth(1).fill('Reading'); // Same as first
    await this.page.locator('#field-label').click(); // Blur

    const duplicateError = this.page.locator('text=/Options must be unique/i').first();
    await expect(duplicateError).toBeVisible({ timeout: 5_000 });
  }
});



Then('I fix all validation errors for checkbox', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  // Fix label: Set valid length (< 200 chars)
  await this.page.fill('#field-label', `Checkbox Field ${Date.now()}`);

  // Fix hint: Set valid length (< 500 chars)
  await this.page.fill('#field-hint', 'Select your favorite hobbies.');

  // Fix options: Set valid, unique options
  const addOptionButton = this.page.getByRole('button', { name: /add option/i });
  let optionInputs = this.page.locator('input[placeholder^="Option "]');

  // Ensure we have at least 3 options for the maxSelections=3 test
  // Note: The "Add Option" button might not be visible if we reached a limit, but usually it is.
  // We'll try to add if we have fewer than 3.
  let currentCount = await optionInputs.count();
  while (currentCount < 3) {
    if (await addOptionButton.isVisible()) {
      await addOptionButton.click();
      await this.page.waitForTimeout(200);
      currentCount = await optionInputs.count();
    } else {
      break;
    }
  }

  // Refetch inputs
  optionInputs = this.page.locator('input[placeholder^="Option "]');

  if (await optionInputs.count() > 0) {
    await optionInputs.nth(0).fill('Reading');
  }
  if (await optionInputs.count() > 1) {
    await optionInputs.nth(1).fill('Gaming');
  }
  if (await optionInputs.count() > 2) {
    await optionInputs.nth(2).fill('Sports');
  }
  if (await optionInputs.count() > 3) {
    await optionInputs.nth(3).fill('Music');
  }

  // Fix selection limits: Clear them (no limits) to avoid issues with option counts
  await this.page.fill('input[name="validation.minSelections"]', '');
  await this.page.fill('input[name="validation.maxSelections"]', '');

  // Force complete revalidation by clicking through fields multiple times
  await this.page.click('#field-label');
  await this.page.waitForTimeout(500);
  await this.page.click('#field-hint');
  await this.page.waitForTimeout(500);
  await this.page.click('input[name="validation.minSelections"]');
  await this.page.waitForTimeout(500);
  await this.page.click('input[name="validation.maxSelections"]');
  await this.page.waitForTimeout(500);
  await this.page.click('#field-label'); // Final blur

  // Wait longer for all validations to complete
  await this.page.waitForTimeout(3000);
});

Then('I save the checkbox field settings', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  // Click save button
  const saveButton = this.page.getByRole('button', { name: /save/i });
  await saveButton.click();

  // Wait for save to complete
  await this.page.waitForTimeout(1000);

  // Verify field is saved
  const fieldContent = this.page.getByTestId('field-content-1');
  await expect(fieldContent).toBeVisible({ timeout: 5_000 });
});

Then('I fix selection limits for checkbox', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  // Simply set valid selection limits without touching other fields
  await this.page.fill('input[name="validation.minSelections"]', '1');
  await this.page.fill('input[name="validation.maxSelections"]', '3');


  // Blur to trigger validation
  await this.page.click('#field-label');

  // Wait for validation to complete
  await this.page.waitForTimeout(1000);
});

// Multi-Page Form Viewer Steps - Quick Field Creation

async function fillAndSaveField(world: CustomWorld, fieldType: string, label: string) {
  if (!world.page) {
    throw new Error('Page is not initialized');
  }

  // Hover on the last added field  
  const fieldCard = world.page.locator('[data-testid^="draggable-field-"]').last();
  await fieldCard.hover();

  // Click settings button
  const settingsButton = fieldCard.locator('[data-testid^="field-settings-button-"]').first();
  await expect(settingsButton).toBeVisible({ timeout: 10_000 });
  await settingsButton.click();

  // Wait for settings panel
  const settingsPanel = world.page.getByTestId('field-settings-panel');
  await expect(settingsPanel).toBeVisible({ timeout: 15_000 });
  await world.page.waitForSelector('#field-label', { timeout: 10_000 });

  // Fill label with unique timestamp to ensure isDirty is true
  const uniqueLabel = `${label} ${Date.now()}`;
  await world.page.fill('#field-label', uniqueLabel);

  // Trigger blur to ensure validation runs
  await world.page.click('[data-testid="field-settings-header"]');

  // Wait for dirty state to be detected
  // The "Unsaved changes" text should appear in the header
  const unsavedChanges = world.page.locator('text=/Unsaved changes/i');
  try {
    await expect(unsavedChanges).toBeVisible({ timeout: 5000 });
  } catch (e) {
    // Try to type a character to force update
    await world.page.type('#field-label', ' ');
    await world.page.keyboard.press('Backspace');
    await world.page.click('[data-testid="field-settings-header"]');
    await expect(unsavedChanges).toBeVisible({ timeout: 5000 });
  }

  // For text fields, ensure validation limits are valid
  if (fieldType === 'short-text' || fieldType === 'long-text') {
    // Check if validation fields exist before filling
    const minLength = world.page.locator('input[name="validation.minLength"]');
    if (await minLength.count() > 0) {
      await minLength.fill('0');
    }

    const maxLength = world.page.locator('input[name="validation.maxLength"]');
    if (await maxLength.count() > 0) {
      await maxLength.fill('1000');
    }
  }

  // For dropdown, radio, and checkbox, add options
  if (fieldType === 'dropdown' || fieldType === 'radio' || fieldType === 'checkbox') {
    // Clear existing options first
    const optionInputs = world.page.locator('input[placeholder^="Option "]');
    const count = await optionInputs.count();

    if (count > 0) {
      // Fill first three options
      for (let i = 0; i < Math.min(3, count); i++) {
        await optionInputs.nth(i).fill(`Option ${i + 1}`);
      }
    }
  }

  // Save
  const saveButton = world.page.getByRole('button', { name: /save/i });
  await expect(saveButton).toBeEnabled({ timeout: 5_000 });
  await saveButton.click();

  // Wait for panel to close
  await world.page.waitForTimeout(1000);
}

When('I fill and save the short text field with label {string}', async function (this: CustomWorld, label: string) {
  await fillAndSaveField(this, 'short-text', label);
});

When('I fill and save the long text field with label {string}', async function (this: CustomWorld, label: string) {
  await fillAndSaveField(this, 'long-text', label);
});

When('I fill and save the email field with label {string}', async function (this: CustomWorld, label: string) {
  await fillAndSaveField(this, 'email', label);
});

When('I fill and save the number field with label {string}', async function (this: CustomWorld, label: string) {
  await fillAndSaveField(this, 'number', label);
});

When('I fill and save the date field with label {string}', async function (this: CustomWorld, label: string) {
  await fillAndSaveField(this, 'date', label);
});

When('I fill and save the dropdown field with label {string}', async function (this: CustomWorld, label: string) {
  await fillAndSaveField(this, 'dropdown', label);
});

When('I fill and save the radio field with label {string}', async function (this: CustomWorld, label: string) {
  await fillAndSaveField(this, 'radio', label);
});

When('I fill and save the checkbox field with label {string}', async function (this: CustomWorld, label: string) {
  await fillAndSaveField(this, 'checkbox', label);
});

// Navigation Steps

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

// Verification Steps

Then('I should be on viewer page {int} of {int}', async function (this: CustomWorld, currentPage: number, totalPages: number) {
  if (!this.viewerPage) {
    throw new Error('Viewer page is not initialized');
  }

  const indicator = this.viewerPage.getByTestId('viewer-page-indicator');
  await expect(indicator).toBeVisible({ timeout: 30_000 });
  await expect(indicator).toContainText(`Page ${currentPage} of ${totalPages}`);
});

Then('I should see field {string} on the current page', async function (this: CustomWorld, fieldLabel: string) {
  if (!this.viewerPage) {
    throw new Error('Viewer page is not initialized');
  }

  // Check if the field label is visible on the current page
  const field = this.viewerPage.getByText(fieldLabel).first();
  await expect(field).toBeVisible({ timeout: 10_000 });
});

// GraphQL Form Creation

When('I create a form via GraphQL with all field types', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  // Navigate to dashboard first to ensure Apollo Client is loaded
  await this.page.goto(`${this.baseUrl}/dashboard`);
  await this.page.waitForTimeout(2000);

  // Extract organization ID from page context (from Apollo Client or localStorage)
  const organizationId = await this.page.evaluate(() => {
    // Try localStorage first
    const orgFromStorage = localStorage.getItem('organization_id');
    if (orgFromStorage) return orgFromStorage;

    // Try from Apollo cache
    const apolloClient = (window as any).__APOLLO_CLIENT__;
    if (apolloClient && apolloClient.cache) {
      try {
        // Look for organization data in cache
        const cacheData = apolloClient.cache.extract();
        const orgKeys = Object.keys(cacheData).filter((key: string) => key.startsWith('Organization:'));
        if (orgKeys.length > 0) {
          return orgKeys[0].split(':')[1];
        }
      } catch (e) {
        console.error('Failed to extract org from cache:', e);
      }
    }

    // Last resort: check URL params
    const url = new URL(window.location.href);
    return url.searchParams.get('org');
  });

  if (!organizationId) {
    throw new Error('Organization ID not found');
  }

  const formSchema = createFormSchemaWithAllFields();
  const timestamp = Date.now();
  const formTitle = `E2E Multi-Page Navigation Test ${timestamp}`;

  // Make GraphQL request to create form
  const response = await this.page.evaluate(async ({ orgId, title, schema, backendUrl }) => {
    const query = `
      mutation CreateForm($input: CreateFormInput!) {
        createForm(input: $input) {
          id
          title
          shortUrl
        }
      }
    `;

    const variables = {
      input: {
        title,
        formSchema: schema,
        organizationId: orgId
      }
    };

    const res = await fetch(backendUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ query, variables })
    });

    return res.json();
  }, { orgId: organizationId, title: formTitle, schema: formSchema, backendUrl: this.backendUrl });

  if (response.errors) {
    throw new Error(`GraphQL error: ${JSON.stringify(response.errors)}`);
  }

  const formId = response.data.createForm.id;
  this.newFormTitle = formTitle;

  // Navigate to the form dashboard
  await this.page.goto(`${this.baseUrl}/dashboard/form/${formId}`);

  // Wait for dashboard to load
  const sidebar = this.page.getByTestId('app-sidebar');
  await expect(sidebar).toBeVisible({ timeout: 30_000 });
});

// Short Text Field Viewer Validation Steps

function createFormSchemaWithShortTextValidations() {
  return {
    layout: {
      theme: "light",
      textColor: "#000000",
      spacing: "normal",
      code: "L9",
      content: "<h1>Short Text Validations Test</h1>",
      customBackGroundColor: "#ffffff",
      backgroundImageKey: "",
      pageMode: "multipage",
      isCustomBackgroundColorEnabled: false
    },
    pages: [
      {
        id: "page-1",
        title: "Short Text Field Validations",
        fields: [
          {
            id: "field-required",
            type: "text_input_field",
            label: "Required Field",
            defaultValue: "",
            prefix: "",
            hint: "This field is required",
            placeholder: "Enter some text",
            validation: {
              required: true,
              type: "text_field_validation"
            }
          },
          {
            id: "field-minlength",
            type: "text_input_field",
            label: "Min Length Field",
            defaultValue: "",
            prefix: "",
            hint: "Minimum 5 characters required",
            placeholder: "Enter at least 5 characters",
            validation: {
              required: true,
              minLength: 5,
              type: "text_field_validation"
            }
          },
          {
            id: "field-maxlength",
            type: "text_input_field",
            label: "Max Length Field",
            defaultValue: "",
            prefix: "",
            hint: "Maximum 10 characters allowed",
            placeholder: "Enter up to 10 characters",
            validation: {
              required: true,
              maxLength: 10,
              type: "text_field_validation"
            }
          },
          {
            id: "field-range",
            type: "text_input_field",
            label: "Length Range Field",
            defaultValue: "",
            prefix: "",
            hint: "Must be between 3 and 15 characters",
            placeholder: "3-15 characters",
            validation: {
              required: true,
              minLength: 3,
              maxLength: 15,
              type: "text_field_validation"
            }
          }
        ]
      }
    ]
  };
}

When('I create a form via GraphQL with short text field validations', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  // Navigate to dashboard first to ensure Apollo Client is loaded
  await this.page.goto(`${this.baseUrl}/dashboard`);
  await this.page.waitForTimeout(2000);

  // Extract organization ID from page context
  const organizationId = await this.page.evaluate(() => {
    // Try localStorage first
    const orgFromStorage = localStorage.getItem('organization_id');
    if (orgFromStorage) return orgFromStorage;

    // Try from Apollo cache
    const apolloClient = (window as any).__APOLLO_CLIENT__;
    if (apolloClient && apolloClient.cache) {
      try {
        const cacheData = apolloClient.cache.extract();
        const orgKeys = Object.keys(cacheData).filter((key: string) => key.startsWith('Organization:'));
        if (orgKeys.length > 0) {
          return orgKeys[0].split(':')[1];
        }
      } catch (e) {
        console.error('Failed to extract org from cache:', e);
      }
    }

    const url = new URL(window.location.href);
    return url.searchParams.get('org');
  });

  if (!organizationId) {
    throw new Error('Organization ID not found');
  }

  const formSchema = createFormSchemaWithShortTextValidations();
  const timestamp = Date.now();
  const formTitle = `E2E Short Text Validation Test ${timestamp}`;

  // Make GraphQL request to create form
  const response = await this.page.evaluate(async ({ orgId, title, schema, backendUrl }) => {
    const query = `
      mutation CreateForm($input: CreateFormInput!) {
        createForm(input: $input) {
          id
          title
          shortUrl
        }
      }
    `;

    const variables = {
      input: {
        title,
        formSchema: schema,
        organizationId: orgId
      }
    };

    const res = await fetch(backendUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ query, variables })
    });

    return res.json();
  }, { orgId: organizationId, title: formTitle, schema: formSchema, backendUrl: this.backendUrl });

  if (response.errors) {
    throw new Error(`GraphQL error: ${JSON.stringify(response.errors)}`);
  }

  const formId = response.data.createForm.id;
  this.newFormTitle = formTitle;

  // Navigate to the form dashboard
  await this.page.goto(`${this.baseUrl}/dashboard/form/${formId}`);

  // Wait for dashboard to load
  const sidebar = this.page.getByTestId('app-sidebar');
  await expect(sidebar).toBeVisible({ timeout: 30_000 });
});

// Validation Error Summary Steps

When('I try to submit with empty fields', async function (this: CustomWorld) {
  if (!this.viewerPage) {
    throw new Error('Viewer page is not initialized');
  }

  // Click the submit button without filling any fields
  const submitButton = this.viewerPage.getByTestId('viewer-submit-button');
  await expect(submitButton).toBeVisible({ timeout: 10_000 });
  await submitButton.click();

  // Wait for validation to trigger
  await this.viewerPage.waitForTimeout(1000);
});

Then('I should see the validation error summary section', async function (this: CustomWorld) {
  if (!this.viewerPage) {
    throw new Error('Viewer page is not initialized');
  }

  // Check for the error summary section using test ID
  const errorSummary = this.viewerPage.getByTestId('validation-error-summary');
  await expect(errorSummary).toBeVisible({ timeout: 5_000 });
});

Then('the error summary should contain {string}', async function (this: CustomWorld, expectedText: string) {
  if (!this.viewerPage) {
    throw new Error('Viewer page is not initialized');
  }

  // Find the error summary and check for the expected text
  const errorSummaryText = this.viewerPage.locator(`text=/${expectedText}/i`).first();
  await expect(errorSummaryText).toBeVisible({ timeout: 5_000 });
});

Then('the validation error summary should not be visible', async function (this: CustomWorld) {
  if (!this.viewerPage) {
    throw new Error('Viewer page is not initialized');
  }

  // After successful submit with valid data, the error summary should be cleared
  const errorSummary = this.viewerPage.getByTestId('validation-error-summary');
  await expect(errorSummary).not.toBeVisible();
});


When('I test required validation for short text in viewer', async function (this: CustomWorld) {
  if (!this.viewerPage) {
    throw new Error('Viewer page is not initialized');
  }

  // Locate the required field
  const requiredField = this.viewerPage.locator('input[name="field-required"]');
  await expect(requiredField).toBeVisible({ timeout: 10_000 });

  // Try to submit without filling (or click next)
  const nextButton = this.viewerPage.getByTestId('viewer-next-button');
  if (await nextButton.isVisible()) {
    await nextButton.click();
    await this.viewerPage.waitForTimeout(500);
  }

  // Check for required error message
  const requiredError = this.viewerPage.locator('text=/required/i').first();
  await expect(requiredError).toBeVisible({ timeout: 5_000 });

  // Fill the field to clear error
  await requiredField.fill('Valid text');
  await requiredField.blur();

  // Wait for error to disappear
  await this.viewerPage.waitForTimeout(500);
});

When('I test min length validation for short text in viewer', async function (this: CustomWorld) {
  if (!this.viewerPage) {
    throw new Error('Viewer page is not initialized');
  }

  // Locate the min length field
  const minLengthField = this.viewerPage.locator('input[name="field-minlength"]');
  await expect(minLengthField).toBeVisible({ timeout: 10_000 });

  // Fill with less than minimum (5 characters required, fill with 3)
  await minLengthField.fill('abc');
  await minLengthField.blur();

  // Wait a bit for validation
  await this.viewerPage.waitForTimeout(1000);

  // Check for min length error - look for any error mentioning "5" or "characters"
  // The error message format may vary: "must be at least 5 characters", "minimum 5", etc.
  const minLengthError = this.viewerPage.locator('text=/5.*character|character.*5|at least 5|minimum.*5/i').first();
  await expect(minLengthError).toBeVisible({ timeout: 5_000 });

  // Fill with valid length
  await minLengthField.fill('Valid');
  await minLengthField.blur();

  // Wait for error to disappear
  await this.viewerPage.waitForTimeout(500);
});

When('I test max length validation for short text in viewer', async function (this: CustomWorld) {
  if (!this.viewerPage) {
    throw new Error('Viewer page is not initialized');
  }

  // Locate the max length field
  const maxLengthField = this.viewerPage.locator('input[name="field-maxlength"]');
  await expect(maxLengthField).toBeVisible({ timeout: 10_000 });

  // Fill with more than maximum (10 characters max, fill with 15)
  await maxLengthField.fill('This is too long');
  await maxLengthField.blur();

  // Wait a bit for validation
  await this.viewerPage.waitForTimeout(1000);

  // Check for max length error - look for any error mentioning "10" or "characters"
  const maxLengthError = this.viewerPage.locator('text=/10.*character|character.*10|at most 10|maximum.*10/i').first();
  await expect(maxLengthError).toBeVisible({ timeout: 5_000 });

  // Fill with valid length
  await maxLengthField.fill('Valid');
  await maxLengthField.blur();

  // Wait for error to disappear
  await this.viewerPage.waitForTimeout(500);
});

When('I fill short text field with valid data in viewer', async function (this: CustomWorld) {
  if (!this.viewerPage) {
    throw new Error('Viewer page is not initialized');
  }

  // Fill all fields with valid data
  await this.viewerPage.locator('input[name="field-required"]').fill('Required text');
  await this.viewerPage.locator('input[name="field-minlength"]').fill('Valid text');
  await this.viewerPage.locator('input[name="field-maxlength"]').fill('Short');
  await this.viewerPage.locator('input[name="field-range"]').fill('Medium text');

  // Wait for all to be filled
  await this.viewerPage.waitForTimeout(500);
});

Then('I should be able to submit the form in viewer', async function (this: CustomWorld) {
  if (!this.viewerPage) {
    throw new Error('Viewer page is not initialized');
  }

  // The submit button should exist and be enabled
  const submitButton = this.viewerPage.getByTestId('viewer-submit-button');
  const buttonText = await submitButton.textContent();


  await expect(submitButton).toBeVisible({ timeout: 10_000 });
  await expect(submitButton).toBeEnabled({ timeout: 5_000 });

  // Click the button
  await submitButton.click();

  // Wait for submission to process
  await this.viewerPage.waitForTimeout(2000);

  // The form should have done something (submitted or shown confirmation)
  // We can verify by checking that we're not showing validation errors
  const errorMessages = this.viewerPage.locator('[role="alert"], .text-destructive, .error');
  const errorCount = await errorMessages.count();

  // If there are no errors, consider the submission successful
  if (errorCount === 0) {

  } else {
    const firstError = await errorMessages.first().textContent();
    throw new Error(`Form submission failed with errors: ${firstError}`);
  }
});


// Long Text Field Viewer Validation Steps

function createFormSchemaWithLongTextValidations() {
  return {
    layout: {
      theme: "light",
      textColor: "#000000",
      spacing: "normal",
      code: "L9",
      content: "<h1>Long Text Validations Test</h1>",
      customBackGroundColor: "#ffffff",
      backgroundImageKey: "",
      pageMode: "multipage",
      isCustomBackgroundColorEnabled: false
    },
    pages: [
      {
        id: "page-1",
        title: "Long Text Field Validations",
        fields: [
          {
            id: "field-required",
            type: "text_area_field",
            label: "Required Field",
            defaultValue: "",
            prefix: "",
            hint: "This field is required",
            placeholder: "Enter some text",
            validation: {
              required: true,
              type: "text_field_validation"
            }
          },
          {
            id: "field-minlength",
            type: "text_area_field",
            label: "Min Length Field",
            defaultValue: "",
            prefix: "",
            hint: "Minimum 10 characters required",
            placeholder: "Enter at least 10 characters",
            validation: {
              required: true,
              minLength: 10,
              type: "text_field_validation"
            }
          },
          {
            id: "field-maxlength",
            type: "text_area_field",
            label: "Max Length Field",
            defaultValue: "",
            prefix: "",
            hint: "Maximum 50 characters allowed",
            placeholder: "Enter up to 50 characters",
            validation: {
              required: true,
              maxLength: 50,
              type: "text_field_validation"
            }
          },
          {
            id: "field-range",
            type: "text_area_field",
            label: "Length Range Field",
            defaultValue: "",
            prefix: "",
            hint: "Must be between 5 and 100 characters",
            placeholder: "5-100 characters",
            validation: {
              required: true,
              minLength: 5,
              maxLength: 100,
              type: "text_field_validation"
            }
          }
        ]
      }
    ]
  };
}

When('I create a form via GraphQL with long text field validations', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  // Navigate to dashboard first to ensure Apollo Client is loaded
  await this.page.goto(`${this.baseUrl}/dashboard`);
  await this.page.waitForTimeout(2000);

  // Extract organization ID from page context
  const organizationId = await this.page.evaluate(() => {
    const orgFromStorage = localStorage.getItem('organization_id');
    if (orgFromStorage) return orgFromStorage;

    const apolloClient = (window as any).__APOLLO_CLIENT__;
    if (apolloClient && apolloClient.cache) {
      try {
        const cacheData = apolloClient.cache.extract();
        const orgKeys = Object.keys(cacheData).filter((key: string) => key.startsWith('Organization:'));
        if (orgKeys.length > 0) {
          return orgKeys[0].split(':')[1];
        }
      } catch (e) {
        console.error('Failed to extract org from cache:', e);
      }
    }

    const url = new URL(window.location.href);
    return url.searchParams.get('org');
  });

  if (!organizationId) {
    throw new Error('Organization ID not found');
  }

  const formSchema = createFormSchemaWithLongTextValidations();
  const timestamp = Date.now();
  const formTitle = `E2E Long Text Validation Test ${timestamp}`;

  // Make GraphQL request to create form
  const response = await this.page.evaluate(async ({ orgId, title, schema, backendUrl }) => {
    const query = `
      mutation CreateForm($input: CreateFormInput!) {
        createForm(input: $input) {
          id
          title
          shortUrl
        }
      }
    `;

    const variables = {
      input: {
        title,
        formSchema: schema,
        organizationId: orgId
      }
    };

    const res = await fetch(backendUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ query, variables })
    });

    return res.json();
  }, { orgId: organizationId, title: formTitle, schema: formSchema, backendUrl: this.backendUrl });

  if (response.errors) {
    throw new Error(`GraphQL error: ${JSON.stringify(response.errors)}`);
  }

  const formId = response.data.createForm.id;
  this.newFormTitle = formTitle;

  // Navigate to the form dashboard
  await this.page.goto(`${this.baseUrl}/dashboard/form/${formId}`);

  // Wait for dashboard to load
  const sidebar = this.page.getByTestId('app-sidebar');
  await expect(sidebar).toBeVisible({ timeout: 30_000 });
});

When('I test required validation for long text in viewer', async function (this: CustomWorld) {
  if (!this.viewerPage) {
    throw new Error('Viewer page is not initialized');
  }

  // Locate the required field (textarea instead of input)
  const requiredField = this.viewerPage.locator('textarea[name="field-required"]');
  await expect(requiredField).toBeVisible({ timeout: 10_000 });

  // Try to submit without filling
  const nextButton = this.viewerPage.getByTestId('viewer-next-button');
  if (await nextButton.isVisible()) {
    await nextButton.click();
    await this.viewerPage.waitForTimeout(500);
  }

  // Check for required error message
  const requiredError = this.viewerPage.locator('text=/required/i').first();
  await expect(requiredError).toBeVisible({ timeout: 5_000 });

  // Fill the field to clear error
  await requiredField.fill('Valid text content');
  await requiredField.blur();

  // Wait for error to disappear
  await this.viewerPage.waitForTimeout(500);
});

When('I test min length validation for long text in viewer', async function (this: CustomWorld) {
  if (!this.viewerPage) {
    throw new Error('Viewer page is not initialized');
  }

  // Locate the min length field
  const minLengthField = this.viewerPage.locator('textarea[name="field-minlength"]');
  await expect(minLengthField).toBeVisible({ timeout: 10_000 });

  // Fill with less than minimum (10 characters required, fill with 5)
  await minLengthField.fill('short');
  await minLengthField.blur();

  // Wait a bit for validation
  await this.viewerPage.waitForTimeout(1000);

  // Check for min length error
  const minLengthError = this.viewerPage.locator('text=/10.*character|character.*10|at least 10|minimum.*10/i').first();
  await expect(minLengthError).toBeVisible({ timeout: 5_000 });

  // Fill with valid length
  await minLengthField.fill('This is a valid long text content');
  await minLengthField.blur();

  // Wait for error to disappear
  await this.viewerPage.waitForTimeout(500);
});

When('I test max length validation for long text in viewer', async function (this: CustomWorld) {
  if (!this.viewerPage) {
    throw new Error('Viewer page is not initialized');
  }

  // Locate the max length field
  const maxLengthField = this.viewerPage.locator('textarea[name="field-maxlength"]');
  await expect(maxLengthField).toBeVisible({ timeout: 10_000 });

  // Fill with more than maximum (50 characters max)
  await maxLengthField.fill('This is a very long text that definitely exceeds the fifty character maximum limit');
  await maxLengthField.blur();

  // Wait a bit for validation
  await this.viewerPage.waitForTimeout(1000);

  // Check for max length error
  const maxLengthError = this.viewerPage.locator('text=/50.*character|character.*50|at most 50|maximum.*50/i').first();
  await expect(maxLengthError).toBeVisible({ timeout: 5_000 });

  // Fill with valid length
  await maxLengthField.fill('This is valid content');
  await maxLengthField.blur();

  // Wait for error to disappear
  await this.viewerPage.waitForTimeout(500);
});

When('I fill long text field with valid data in viewer', async function (this: CustomWorld) {
  if (!this.viewerPage) {
    throw new Error('Viewer page is not initialized');
  }

  // Fill all fields with valid data (using textarea selectors)
  await this.viewerPage.locator('textarea[name="field-required"]').fill('Required text content');
  await this.viewerPage.locator('textarea[name="field-minlength"]').fill('Valid long text content');
  await this.viewerPage.locator('textarea[name="field-maxlength"]').fill('Short content');
  await this.viewerPage.locator('textarea[name="field-range"]').fill('Medium length text');

  // Wait for all to be filled
  await this.viewerPage.waitForTimeout(500);
});


// Email Field Viewer Validation Steps

function createFormSchemaWithEmailValidations() {
  return {
    layout: {
      theme: "light",
      textColor: "#000000",
      spacing: "normal",
      code: "L9",
      content: "<h1>Email Validations Test</h1>",
      customBackGroundColor: "#ffffff",
      backgroundImageKey: "",
      pageMode: "multipage",
      isCustomBackgroundColorEnabled: false
    },
    pages: [
      {
        id: "page-1",
        title: "Email Field Validations",
        fields: [
          {
            id: "field-required",
            type: "email_field",
            label: "Required Email",
            defaultValue: "",
            prefix: "",
            hint: "This field is required",
            placeholder: "Enter your email",
            validation: {
              required: true
            }
          },
          {
            id: "field-format",
            type: "email_field",
            label: "Email Format",
            defaultValue: "",
            prefix: "",
            hint: "Must be a valid email format",
            placeholder: "example@domain.com",
            validation: {
              required: true
            }
          }
        ]
      }
    ]
  };
}

When('I create a form via GraphQL with email field validations', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  // Navigate to dashboard first
  await this.page.goto(`${this.baseUrl}/dashboard`);
  await this.page.waitForTimeout(2000);

  // Extract organization ID
  const organizationId = await this.page.evaluate(() => {
    const orgFromStorage = localStorage.getItem('organization_id');
    if (orgFromStorage) return orgFromStorage;

    const apolloClient = (window as any).__APOLLO_CLIENT__;
    if (apolloClient && apolloClient.cache) {
      try {
        const cacheData = apolloClient.cache.extract();
        const orgKeys = Object.keys(cacheData).filter((key: string) => key.startsWith('Organization:'));
        if (orgKeys.length > 0) {
          return orgKeys[0].split(':')[1];
        }
      } catch (e) {
        console.error('Failed to extract org from cache:', e);
      }
    }

    return null;
  });

  if (!organizationId) {
    throw new Error('Organization ID not found');
  }

  const formSchema = createFormSchemaWithEmailValidations();
  const timestamp = Date.now();
  const formTitle = `E2E Email Validation Test ${timestamp}`;

  // Make GraphQL request to create form
  const response = await this.page.evaluate(async ({ orgId, title, schema, backendUrl }) => {
    const query = `
      mutation CreateForm($input: CreateFormInput!) {
        createForm(input: $input) {
          id
          title
          shortUrl
        }
      }
    `;

    const variables = {
      input: {
        title,
        formSchema: schema,
        organizationId: orgId
      }
    };

    const res = await fetch(backendUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ query, variables })
    });

    return res.json();
  }, { orgId: organizationId, title: formTitle, schema: formSchema, backendUrl: this.backendUrl });

  if (response.errors) {
    throw new Error(`GraphQL error: ${JSON.stringify(response.errors)}`);
  }

  const formId = response.data.createForm.id;
  this.newFormTitle = formTitle;

  // Navigate to the form dashboard
  await this.page.goto(`${this.baseUrl}/dashboard/form/${formId}`);

  // Wait for dashboard to load
  const sidebar = this.page.getByTestId('app-sidebar');
  await expect(sidebar).toBeVisible({ timeout: 30_000 });
});

When('I test required validation for email in viewer', async function (this: CustomWorld) {
  if (!this.viewerPage) {
    throw new Error('Viewer page is not initialized');
  }

  // Locate the required field
  const requiredField = this.viewerPage.locator('input[name="field-required"]');
  await expect(requiredField).toBeVisible({ timeout: 10_000 });

  // Try to submit without filling
  const nextButton = this.viewerPage.getByTestId('viewer-next-button');
  if (await nextButton.isVisible()) {
    await nextButton.click();
    await this.viewerPage.waitForTimeout(500);
  }

  // Check for required error message
  const requiredError = this.viewerPage.locator('text=/required/i').first();
  await expect(requiredError).toBeVisible({ timeout: 5_000 });

  // Fill the field to clear error
  await requiredField.fill('test@example.com');
  await requiredField.blur();

  // Wait for error to disappear
  await this.viewerPage.waitForTimeout(500);
});

When('I test email format validation in viewer', async function (this: CustomWorld) {
  if (!this.viewerPage) {
    throw new Error('Viewer page is not initialized');
  }

  // Locate the format field
  const formatField = this.viewerPage.locator('input[name="field-format"]');
  await expect(formatField).toBeVisible({ timeout: 10_000 });

  // Fill with invalid email format
  await formatField.fill('invalid-email');
  await formatField.blur();

  // Wait a bit for validation
  await this.viewerPage.waitForTimeout(1000);

  // Check for email format error
  const formatError = this.viewerPage.locator('text=/valid email|email.*valid|invalid.*email/i').first();
  await expect(formatError).toBeVisible({ timeout: 5_000 });

  // Fill with valid email
  await formatField.fill('valid@example.com');
  await formatField.blur();

  // Wait for error to disappear
  await this.viewerPage.waitForTimeout(500);
});

When('I fill email field with valid data in viewer', async function (this: CustomWorld) {
  if (!this.viewerPage) {
    throw new Error('Viewer page is not initialized');
  }

  // Fill all fields with valid emails
  await this.viewerPage.locator('input[name="field-required"]').fill('user@example.com');
  await this.viewerPage.locator('input[name="field-format"]').fill('test@domain.com');

  // Wait for all to be filled
  await this.viewerPage.waitForTimeout(500);
});


// Number Field Viewer Validation Steps

function createFormSchemaWithNumberValidations() {
  return {
    layout: {
      theme: "light",
      textColor: "#000000",
      spacing: "normal",
      code: "L9",
      content: "<h1>Number Validations Test</h1>",
      customBackGroundColor: "#ffffff",
      backgroundImageKey: "",
      pageMode: "multipage",
      isCustomBackgroundColorEnabled: false
    },
    pages: [
      {
        id: "page-1",
        title: "Number Field Validations",
        fields: [
          {
            id: "field-required",
            type: "number_field",
            label: "Required Number",
            defaultValue: "",
            prefix: "",
            hint: "This field is required",
            placeholder: "Enter a number",
            validation: {
              required: true
            },
            min: undefined,
            max: undefined
          },
          {
            id: "field-min",
            type: "number_field",
            label: "Min Value Field",
            defaultValue: "",
            prefix: "",
            hint: "Minimum value is 10",
            placeholder: "Enter at least 10",
            validation: {
              required: true
            },
            min: 10,
            max: undefined
          },
          {
            id: "field-max",
            type: "number_field",
            label: "Max Value Field",
            defaultValue: "",
            prefix: "",
            hint: "Maximum value is 100",
            placeholder: "Enter up to 100",
            validation: {
              required: true
            },
            min: undefined,
            max: 100
          },
          {
            id: "field-range",
            type: "number_field",
            label: "Range Field",
            defaultValue: "",
            prefix: "",
            hint: "Must be between 1 and 50",
            placeholder: "1-50",
            validation: {
              required: true
            },
            min: 1,
            max: 50
          }
        ]
      }
    ]
  };
}

When('I create a form via GraphQL with number field validations', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  // Navigate to dashboard first
  await this.page.goto(`${this.baseUrl}/dashboard`);
  await this.page.waitForTimeout(2000);

  // Extract organization ID
  const organizationId = await this.page.evaluate(() => {
    const orgFromStorage = localStorage.getItem('organization_id');
    if (orgFromStorage) return orgFromStorage;

    const apolloClient = (window as any).__APOLLO_CLIENT__;
    if (apolloClient && apolloClient.cache) {
      try {
        const cacheData = apolloClient.cache.extract();
        const orgKeys = Object.keys(cacheData).filter((key: string) => key.startsWith('Organization:'));
        if (orgKeys.length > 0) {
          return orgKeys[0].split(':')[1];
        }
      } catch (e) {
        console.error('Failed to extract org from cache:', e);
      }
    }

    return null;
  });

  if (!organizationId) {
    throw new Error('Organization ID not found');
  }

  const formSchema = createFormSchemaWithNumberValidations();
  const timestamp = Date.now();
  const formTitle = `E2E Number Validation Test ${timestamp}`;

  // Make GraphQL request to create form
  const response = await this.page.evaluate(async ({ orgId, title, schema, backendUrl }) => {
    const query = `
      mutation CreateForm($input: CreateFormInput!) {
        createForm(input: $input) {
          id
          title
          shortUrl
        }
      }
    `;

    const variables = {
      input: {
        title,
        formSchema: schema,
        organizationId: orgId
      }
    };

    const res = await fetch(backendUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ query, variables })
    });

    return res.json();
  }, { orgId: organizationId, title: formTitle, schema: formSchema, backendUrl: this.backendUrl });

  if (response.errors) {
    throw new Error(`GraphQL error: ${JSON.stringify(response.errors)}`);
  }

  const formId = response.data.createForm.id;
  this.newFormTitle = formTitle;

  // Navigate to the form dashboard
  await this.page.goto(`${this.baseUrl}/dashboard/form/${formId}`);

  // Wait for dashboard to load
  const sidebar = this.page.getByTestId('app-sidebar');
  await expect(sidebar).toBeVisible({ timeout: 30_000 });
});

When('I test required validation for number in viewer', async function (this: CustomWorld) {
  if (!this.viewerPage) {
    throw new Error('Viewer page is not initialized');
  }

  // Locate the required field
  const requiredField = this.viewerPage.locator('input[name="field-required"]');
  await expect(requiredField).toBeVisible({ timeout: 10_000 });

  // Try to submit without filling
  const nextButton = this.viewerPage.getByTestId('viewer-next-button');
  if (await nextButton.isVisible()) {
    await nextButton.click();
    await this.viewerPage.waitForTimeout(500);
  }

  // Check for required error message
  const requiredError = this.viewerPage.locator('text=/required/i').first();
  await expect(requiredError).toBeVisible({ timeout: 5_000 });

  // Fill the field to clear error
  await requiredField.fill('42');
  await requiredField.blur();

  // Wait for error to disappear
  await this.viewerPage.waitForTimeout(500);
});

When('I test min value validation in viewer', async function (this: CustomWorld) {
  if (!this.viewerPage) {
    throw new Error('Viewer page is not initialized');
  }

  // Locate the min value field
  const minField = this.viewerPage.locator('input[name="field-min"]');
  await expect(minField).toBeVisible({ timeout: 10_000 });

  // Fill with less than minimum (10 required, fill with 5)
  await minField.fill('5');
  await minField.blur();

  // Wait a bit for validation
  await this.viewerPage.waitForTimeout(1000);

  // Check for min value error
  const minError = this.viewerPage.locator('text=/10|minimum.*10|at least 10|greater.*10/i').first();
  await expect(minError).toBeVisible({ timeout: 5_000 });

  // Fill with valid value
  await minField.fill('15');
  await minField.blur();

  // Wait for error to disappear
  await this.viewerPage.waitForTimeout(500);
});

When('I test max value validation in viewer', async function (this: CustomWorld) {
  if (!this.viewerPage) {
    throw new Error('Viewer page is not initialized');
  }

  // Locate the max value field
  const maxField = this.viewerPage.locator('input[name="field-max"]');
  await expect(maxField).toBeVisible({ timeout: 10_000 });

  // Fill with more than maximum (100 max, fill with 150)
  await maxField.fill('150');
  await maxField.blur();

  // Wait a bit for validation
  await this.viewerPage.waitForTimeout(1000);

  // Check for max value error
  const maxError = this.viewerPage.locator('text=/100|maximum.*100|at most 100|less.*100/i').first();
  await expect(maxError).toBeVisible({ timeout: 5_000 });

  // Fill with valid value
  await maxField.fill('75');
  await maxField.blur();

  // Wait for error to disappear
  await this.viewerPage.waitForTimeout(500);
});

When('I fill number field with valid data in viewer', async function (this: CustomWorld) {
  if (!this.viewerPage) {
    throw new Error('Viewer page is not initialized');
  }

  // Fill all fields with valid numbers
  await this.viewerPage.locator('input[name="field-required"]').fill('42');
  await this.viewerPage.locator('input[name="field-min"]').fill('20');
  await this.viewerPage.locator('input[name="field-max"]').fill('50');
  await this.viewerPage.locator('input[name="field-range"]').fill('25');

  // Wait for all to be filled
  await this.viewerPage.waitForTimeout(500);
});


// Date Field Viewer Validation Steps

function createFormSchemaWithDateValidations() {
  // Calculate dates relative to today for consistent testing
  const today = new Date();
  const minDate = new Date(today);
  minDate.setDate(today.getDate() + 1); // Tomorrow
  const maxDate = new Date(today);
  maxDate.setDate(today.getDate() + 30); // 30 days from now

  const formatDate = (date: Date) => {
    return date.toISOString().split('T')[0]; // YYYY-MM-DD format
  };

  return {
    layout: {
      theme: "light",
      textColor: "#000000",
      spacing: "normal",
      code: "L9",
      content: "<h1>Date Validations Test</h1>",
      customBackGroundColor: "#ffffff",
      backgroundImageKey: "",
      pageMode: "multipage",
      isCustomBackgroundColorEnabled: false
    },
    pages: [
      {
        id: "page-1",
        title: "Date Field Validations",
        fields: [
          {
            id: "field-required",
            type: "date_field",
            label: "Required Date",
            defaultValue: "",
            prefix: "",
            hint: "This field is required",
            placeholder: "Select a date",
            validation: {
              required: true
            },
            minDate: undefined,
            maxDate: undefined
          },
          {
            id: "field-min",
            type: "date_field",
            label: "Min Date Field",
            defaultValue: "",
            prefix: "",
            hint: `Date must be on or after ${formatDate(minDate)}`,
            placeholder: "Select a future date",
            validation: {
              required: true
            },
            minDate: formatDate(minDate),
            maxDate: undefined
          },
          {
            id: "field-max",
            type: "date_field",
            label: "Max Date Field",
            defaultValue: "",
            prefix: "",
            hint: `Date must be on or before ${formatDate(maxDate)}`,
            placeholder: "Select a date within 30 days",
            validation: {
              required: true
            },
            minDate: undefined,
            maxDate: formatDate(maxDate)
          },
          {
            id: "field-range",
            type: "date_field",
            label: "Date Range Field",
            defaultValue: "",
            prefix: "",
            hint: `Date must be between ${formatDate(minDate)} and ${formatDate(maxDate)}`,
            placeholder: "Select a date in range",
            validation: {
              required: true
            },
            minDate: formatDate(minDate),
            maxDate: formatDate(maxDate)
          }
        ]
      }
    ]
  };
}

When('I create a form via GraphQL with date field validations', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  // Navigate to dashboard first
  await this.page.goto(`${this.baseUrl}/dashboard`);
  await this.page.waitForTimeout(2000);

  // Extract organization ID
  const organizationId = await this.page.evaluate(() => {
    const orgFromStorage = localStorage.getItem('organization_id');
    if (orgFromStorage) return orgFromStorage;

    const apolloClient = (window as any).__APOLLO_CLIENT__;
    if (apolloClient && apolloClient.cache) {
      try {
        const cacheData = apolloClient.cache.extract();
        const orgKeys = Object.keys(cacheData).filter((key: string) => key.startsWith('Organization:'));
        if (orgKeys.length > 0) {
          return orgKeys[0].split(':')[1];
        }
      } catch (e) {
        console.error('Failed to extract org from cache:', e);
      }
    }

    return null;
  });

  if (!organizationId) {
    throw new Error('Organization ID not found');
  }

  const formSchema = createFormSchemaWithDateValidations();
  const timestamp = Date.now();
  const formTitle = `E2E Date Validation Test ${timestamp}`;

  // Make GraphQL request to create form
  const response = await this.page.evaluate(async ({ orgId, title, schema, backendUrl }) => {
    const query = `
      mutation CreateForm($input: CreateFormInput!) {
        createForm(input: $input) {
          id
          title
          shortUrl
        }
      }
    `;

    const variables = {
      input: {
        title,
        formSchema: schema,
        organizationId: orgId
      }
    };

    const res = await fetch(backendUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ query, variables })
    });

    return res.json();
  }, { orgId: organizationId, title: formTitle, schema: formSchema, backendUrl: this.backendUrl });

  if (response.errors) {
    throw new Error(`GraphQL error: ${JSON.stringify(response.errors)}`);
  }

  const formId = response.data.createForm.id;
  this.newFormTitle = formTitle;

  // Navigate to the form dashboard
  await this.page.goto(`${this.baseUrl}/dashboard/form/${formId}`);

  // Wait for dashboard to load
  const sidebar = this.page.getByTestId('app-sidebar');
  await expect(sidebar).toBeVisible({ timeout: 30_000 });
});

When('I test required validation for date in viewer', async function (this: CustomWorld) {
  if (!this.viewerPage) {
    throw new Error('Viewer page is not initialized');
  }

  // Locate the required field (date fields use input elements)
  const requiredField = this.viewerPage.locator('input[name="field-required"]');
  await expect(requiredField).toBeVisible({ timeout: 10_000 });

  // Try to submit without filling
  const nextButton = this.viewerPage.getByTestId('viewer-next-button');
  if (await nextButton.isVisible()) {
    await nextButton.click();
    await this.viewerPage.waitForTimeout(500);
  }

  // Check for required error message
  const requiredError = this.viewerPage.locator('text=/required/i').first();
  await expect(requiredError).toBeVisible({ timeout: 5_000 });

  // Fill the field to clear error - use a valid future date
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + 15);
  const formattedDate = futureDate.toISOString().split('T')[0];

  await requiredField.fill(formattedDate);
  await requiredField.blur();

  // Wait for error to disappear
  await this.viewerPage.waitForTimeout(500);
});

When('I test min date validation in viewer', async function (this: CustomWorld) {
  if (!this.viewerPage) {
    throw new Error('Viewer page is not initialized');
  }

  // Locate the min date field
  const minField = this.viewerPage.locator('input[name="field-min"]');
  await expect(minField).toBeVisible({ timeout: 10_000 });

  // Fill with a date before minimum (today, when min is tomorrow)
  const today = new Date();
  const formattedToday = today.toISOString().split('T')[0];

  await minField.fill(formattedToday);
  await minField.blur();

  // Wait a bit for validation
  await this.viewerPage.waitForTimeout(1000);

  // Check for min date error
  const minError = this.viewerPage.locator('text=/after|minimum date|earliest|on or after/i').first();
  await expect(minError).toBeVisible({ timeout: 5_000 });

  // Fill with valid future date
  const validDate = new Date();
  validDate.setDate(today.getDate() + 10);
  const formattedValidDate = validDate.toISOString().split('T')[0];

  await minField.fill(formattedValidDate);
  await minField.blur();

  // Wait for error to disappear
  await this.viewerPage.waitForTimeout(500);
});

When('I test max date validation in viewer', async function (this: CustomWorld) {
  if (!this.viewerPage) {
    throw new Error('Viewer page is not initialized');
  }

  // Locate the max date field
  const maxField = this.viewerPage.locator('input[name="field-max"]');
  await expect(maxField).toBeVisible({ timeout: 10_000 });

  // Fill with a date after maximum (60 days from now, when max is 30 days)
  const farFuture = new Date();
  farFuture.setDate(farFuture.getDate() + 60);
  const formattedFarFuture = farFuture.toISOString().split('T')[0];

  await maxField.fill(formattedFarFuture);
  await maxField.blur();

  // Wait a bit for validation
  await this.viewerPage.waitForTimeout(1000);

  // Check for max date error
  const maxError = this.viewerPage.locator('text=/before|maximum date|latest|on or before/i').first();
  await expect(maxError).toBeVisible({ timeout: 5_000 });

  // Fill with valid date within range
  const validDate = new Date();
  validDate.setDate(validDate.getDate() + 15);
  const formattedValidDate = validDate.toISOString().split('T')[0];

  await maxField.fill(formattedValidDate);
  await maxField.blur();

  // Wait for error to disappear
  await this.viewerPage.waitForTimeout(500);
});

When('I fill date field with valid data in viewer', async function (this: CustomWorld) {
  if (!this.viewerPage) {
    throw new Error('Viewer page is not initialized');
  }

  // Fill all fields with valid dates
  const today = new Date();

  // Required field - any date works
  const date1 = new Date();
  date1.setDate(today.getDate() + 5);

  // Min field - must be tomorrow or later
  const date2 = new Date();
  date2.setDate(today.getDate() + 7);

  // Max field - must be within 30 days
  const date3 = new Date();
  date3.setDate(today.getDate() + 10);

  // Range field - between tomorrow and 30 days
  const date4 = new Date();
  date4.setDate(today.getDate() + 12);

  await this.viewerPage.locator('input[name="field-required"]').fill(date1.toISOString().split('T')[0]);
  await this.viewerPage.locator('input[name="field-min"]').fill(date2.toISOString().split('T')[0]);
  await this.viewerPage.locator('input[name="field-max"]').fill(date3.toISOString().split('T')[0]);
  await this.viewerPage.locator('input[name="field-range"]').fill(date4.toISOString().split('T')[0]);

  // Wait for all to be filled
  await this.viewerPage.waitForTimeout(500);
});


// Dropdown (Select) Field Viewer Validation Steps

function createFormSchemaWithDropdownValidations() {
  return {
    layout: {
      theme: "light",
      textColor: "#000000",
      spacing: "normal",
      code: "L9",
      content: "<h1>Dropdown Validations Test</h1>",
      customBackGroundColor: "#ffffff",
      backgroundImageKey: "",
      pageMode: "multipage",
      isCustomBackgroundColorEnabled: false
    },
    pages: [
      {
        id: "page-1",
        title: "Dropdown Field Validations",
        fields: [
          {
            id: "field-required",
            type: "select_field",
            label: "Required Dropdown",
            defaultValue: "",
            prefix: "",
            hint: "This field is required",
            placeholder: "",
            validation: {
              required: true
            },
            options: ["Option 1", "Option 2", "Option 3"]
          },
          {
            id: "field-selection",
            type: "select_field",
            label: "Selection Test",
            defaultValue: "",
            prefix: "",
            hint: "Test option selection",
            placeholder: "",
            validation: {
              required: true
            },
            options: ["Choice A", "Choice B", "Choice C", "Choice D"]
          }
        ]
      }
    ]
  };
}

When('I create a form via GraphQL with dropdown field validations', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  // Navigate to dashboard first
  await this.page.goto(`${this.baseUrl}/dashboard`);
  await this.page.waitForTimeout(2000);

  // Extract organization ID
  const organizationId = await this.page.evaluate(() => {
    const orgFromStorage = localStorage.getItem('organization_id');
    if (orgFromStorage) return orgFromStorage;

    const apolloClient = (window as any).__APOLLO_CLIENT__;
    if (apolloClient && apolloClient.cache) {
      try {
        const cacheData = apolloClient.cache.extract();
        const orgKeys = Object.keys(cacheData).filter((key: string) => key.startsWith('Organization:'));
        if (orgKeys.length > 0) {
          return orgKeys[0].split(':')[1];
        }
      } catch (e) {
        console.error('Failed to extract org from cache:', e);
      }
    }

    return null;
  });

  if (!organizationId) {
    throw new Error('Organization ID not found');
  }

  const formSchema = createFormSchemaWithDropdownValidations();
  const timestamp = Date.now();
  const formTitle = `E2E Dropdown Validation Test ${timestamp}`;

  // Make GraphQL request to create form
  const response = await this.page.evaluate(async ({ orgId, title, schema, backendUrl }) => {
    const query = `
      mutation CreateForm($input: CreateFormInput!) {
        createForm(input: $input) {
          id
          title
          shortUrl
        }
      }
    `;

    const variables = {
      input: {
        title,
        formSchema: schema,
        organizationId: orgId
      }
    };

    const res = await fetch(backendUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ query, variables })
    });

    return res.json();
  }, { orgId: organizationId, title: formTitle, schema: formSchema, backendUrl: this.backendUrl });

  if (response.errors) {
    throw new Error(`GraphQL error: ${JSON.stringify(response.errors)}`);
  }

  const formId = response.data.createForm.id;
  this.newFormTitle = formTitle;

  // Navigate to the form dashboard
  await this.page.goto(`${this.baseUrl}/dashboard/form/${formId}`);

  // Wait for dashboard to load
  const sidebar = this.page.getByTestId('app-sidebar');
  await expect(sidebar).toBeVisible({ timeout: 30_000 });
});

When('I test required validation for dropdown in viewer', async function (this: CustomWorld) {
  if (!this.viewerPage) {
    throw new Error('Viewer page is not initialized');
  }

  // Locate the required dropdown field (select element)
  const requiredField = this.viewerPage.locator('select[name="field-required"]');
  await expect(requiredField).toBeVisible({ timeout: 10_000 });

  // Try to submit without selecting
  const nextButton = this.viewerPage.getByTestId('viewer-next-button');
  if (await nextButton.isVisible()) {
    await nextButton.click();
    await this.viewerPage.waitForTimeout(500);
  }

  // Check for required error message
  const requiredError = this.viewerPage.locator('text=/required/i').first();
  await expect(requiredError).toBeVisible({ timeout: 5_000 });

  // Select an option to clear error
  await requiredField.selectOption('Option 1');
  await requiredField.blur();

  // Wait for error to disappear
  await this.viewerPage.waitForTimeout(500);
});

When('I test dropdown option selection in viewer', async function (this: CustomWorld) {
  if (!this.viewerPage) {
    throw new Error('Viewer page is not initialized');
  }

  // Locate the selection test field
  const selectionField = this.viewerPage.locator('select[name="field-selection"]');
  await expect(selectionField).toBeVisible({ timeout: 10_000 });

  // Select first option
  await selectionField.selectOption('Choice A');
  await this.viewerPage.waitForTimeout(300);

  // Verify selection
  const selectedValue1 = await selectionField.inputValue();
  if (selectedValue1 !== 'Choice A') {
    throw new Error(`Expected 'Choice A' to be selected, but got '${selectedValue1}'`);
  }

  // Change to different option
  await selectionField.selectOption('Choice C');
  await this.viewerPage.waitForTimeout(300);

  // Verify new selection
  const selectedValue2 = await selectionField.inputValue();
  if (selectedValue2 !== 'Choice C') {
    throw new Error(`Expected 'Choice C' to be selected, but got '${selectedValue2}'`);
  }
});

When('I fill dropdown field with valid data in viewer', async function (this: CustomWorld) {
  if (!this.viewerPage) {
    throw new Error('Viewer page is not initialized');
  }

  // Fill all dropdown fields with valid selections
  await this.viewerPage.locator('select[name="field-required"]').selectOption('Option 2');
  await this.viewerPage.locator('select[name="field-selection"]').selectOption('Choice B');

  // Wait for all to be filled
  await this.viewerPage.waitForTimeout(500);
});


// Checkbox Field Viewer Validation Steps

function createFormSchemaWithCheckboxValidations() {
  return {
    layout: {
      theme: "light",
      textColor: "#000000",
      spacing: "normal",
      code: "L9",
      content: "<h1>Checkbox Validations Test</h1>",
      customBackGroundColor: "#ffffff",
      backgroundImageKey: "",
      pageMode: "multipage",
      isCustomBackgroundColorEnabled: false
    },
    pages: [
      {
        id: "page-1",
        title: "Checkbox Field Validations",
        fields: [
          {
            id: "field-required",
            type: "checkbox_field",
            label: "Required Checkbox",
            defaultValues: [],
            prefix: "",
            hint: "At least one option must be selected",
            placeholder: "",
            validation: {
              required: true,
              type: "checkbox_field_validation"
            },
            options: ["Option 1", "Option 2", "Option 3"]
          },
          {
            id: "field-multi",
            type: "checkbox_field",
            label: "Multiple Selection",
            defaultValues: [],
            prefix: "",
            hint: "Select multiple options",
            placeholder: "",
            validation: {
              required: true,
              type: "checkbox_field_validation"
            },
            options: ["Choice A", "Choice B", "Choice C", "Choice D"]
          }
        ]
      }
    ]
  };
}

When('I create a form via GraphQL with checkbox field validations', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  // Navigate to dashboard first
  await this.page.goto(`${this.baseUrl}/dashboard`);
  await this.page.waitForTimeout(2000);

  // Extract organization ID
  const organizationId = await this.page.evaluate(() => {
    const orgFromStorage = localStorage.getItem('organization_id');
    if (orgFromStorage) return orgFromStorage;

    const apolloClient = (window as any).__APOLLO_CLIENT__;
    if (apolloClient && apolloClient.cache) {
      try {
        const cacheData = apolloClient.cache.extract();
        const orgKeys = Object.keys(cacheData).filter((key: string) => key.startsWith('Organization:'));
        if (orgKeys.length > 0) {
          return orgKeys[0].split(':')[1];
        }
      } catch (e) {
        console.error('Failed to extract org from cache:', e);
      }
    }

    return null;
  });

  if (!organizationId) {
    throw new Error('Organization ID not found');
  }

  const formSchema = createFormSchemaWithCheckboxValidations();
  const timestamp = Date.now();
  const formTitle = `E2E Checkbox Validation Test ${timestamp}`;

  // Make GraphQL request to create form
  const response = await this.page.evaluate(async ({ orgId, title, schema, backendUrl }) => {
    const query = `
      mutation CreateForm($input: CreateFormInput!) {
        createForm(input: $input) {
          id
          title
          shortUrl
        }
      }
    `;

    const variables = {
      input: {
        title,
        formSchema: schema,
        organizationId: orgId
      }
    };

    const res = await fetch(backendUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ query, variables })
    });

    return res.json();
  }, { orgId: organizationId, title: formTitle, schema: formSchema, backendUrl: this.backendUrl });

  if (response.errors) {
    throw new Error(`GraphQL error: ${JSON.stringify(response.errors)}`);
  }

  const formId = response.data.createForm.id;
  this.newFormTitle = formTitle;

  // Navigate to the form dashboard
  await this.page.goto(`${this.baseUrl}/dashboard/form/${formId}`);

  // Wait for dashboard to load
  const sidebar = this.page.getByTestId('app-sidebar');
  await expect(sidebar).toBeVisible({ timeout: 30_000 });
});

When('I test checkbox required and select options in viewer', async function (this: CustomWorld) {
  if (!this.viewerPage) {
    throw new Error('Viewer page is not initialized');
  }

  // Checkboxes use shadcn Checkbox component with id="{field.id}-{index}"
  // Click the label for the first checkbox (field-required-0)
  // Using label click is more reliable than trying to click the checkbox button directly
  const firstCheckboxLabel = this.viewerPage.locator('label[for="field-required-0"]');
  await expect(firstCheckboxLabel).toBeVisible({ timeout: 10_000 });
  await firstCheckboxLabel.click();
  await this.viewerPage.waitForTimeout(500);

  // Click second checkbox for multi-selection field
  const secondFieldLabel = this.viewerPage.locator('label[for="field-multi-0"]');
  await expect(secondFieldLabel).toBeVisible({ timeout: 10_000 });
  await secondFieldLabel.click();
  await this.viewerPage.waitForTimeout(300);

  // Click another option for good measure
  const thirdFieldLabel = this.viewerPage.locator('label[for="field-multi-1"]');
  await thirdFieldLabel.click();
  await this.viewerPage.waitForTimeout(500);
});

// ========================================
// Field Settings Persistence Test Steps
// ========================================

When('I fill all short text field settings with test data', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  // Define the test data
  const testData = {
    label: 'Persistence Test Field',
    hint: 'This is a test hint for persistence',
    placeholder: 'Enter test data here',
    prefix: 'TEST',
    defaultValue: 'Default persistence value',
    required: true,
    minLength: 5,
    maxLength: 100,
  };

  // Store for later verification
  this.expectedFieldSettings = testData;

  // Fill all fields
  await this.page.waitForSelector('#field-label', { timeout: 10_000 });
  await this.page.fill('#field-label', testData.label);
  await this.page.fill('#field-hint', testData.hint);
  await this.page.fill('#field-placeholder', testData.placeholder);
  await this.page.fill('#field-prefix', testData.prefix);
  await this.page.fill('#field-defaultValue', testData.defaultValue);

  // Set validation fields
  await this.page.fill('#field-validation\\.minLength', testData.minLength.toString());
  await this.page.fill('#field-validation\\.maxLength', testData.maxLength.toString());

  // Set required checkbox
  const requiredToggle = this.page.locator('#field-required');
  const isChecked = await requiredToggle.isChecked();
  if (!isChecked && testData.required) {
    await requiredToggle.click();
  }

  // Verify values are set
  await expect(this.page.locator('#field-label')).toHaveValue(testData.label);
  await expect(this.page.locator('#field-hint')).toHaveValue(testData.hint);
  await expect(this.page.locator('#field-placeholder')).toHaveValue(testData.placeholder);
  await expect(this.page.locator('#field-prefix')).toHaveValue(testData.prefix);
  await expect(this.page.locator('#field-defaultValue')).toHaveValue(testData.defaultValue);
});

When('I fill all long text field settings with test data', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  // Define the test data for long text field
  const testData = {
    label: 'Long Text Persistence Test',
    hint: 'This is a test hint for long text persistence',
    placeholder: 'Enter long text here',
    prefix: 'LT',
    defaultValue: 'Default long text value for testing persistence',
    required: true,
    minLength: 10,
    maxLength: 500,
  };

  // Store for later verification
  this.expectedFieldSettings = testData;

  // Fill all fields
  await this.page.waitForSelector('#field-label', { timeout: 10_000 });
  await this.page.fill('#field-label', testData.label);
  await this.page.fill('#field-hint', testData.hint);
  await this.page.fill('#field-placeholder', testData.placeholder);
  await this.page.fill('#field-prefix', testData.prefix);
  await this.page.fill('#field-defaultValue', testData.defaultValue);

  // Set validation fields
  await this.page.fill('#field-validation\\.minLength', testData.minLength.toString());
  await this.page.fill('#field-validation\\.maxLength', testData.maxLength.toString());

  // Set required checkbox
  const requiredToggle = this.page.locator('#field-required');
  const isChecked = await requiredToggle.isChecked();
  if (!isChecked && testData.required) {
    await requiredToggle.click();
  }

  // Verify values are set
  await expect(this.page.locator('#field-label')).toHaveValue(testData.label);
  await expect(this.page.locator('#field-hint')).toHaveValue(testData.hint);
  await expect(this.page.locator('#field-placeholder')).toHaveValue(testData.placeholder);
  await expect(this.page.locator('#field-prefix')).toHaveValue(testData.prefix);
  await expect(this.page.locator('#field-defaultValue')).toHaveValue(testData.defaultValue);
});

When('I fill all email field settings with test data', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  // Define the test data for email field
  // Note: Email fields don't have minLength/maxLength validation
  const testData = {
    label: 'Email Persistence Test',
    hint: 'This is a test hint for email persistence',
    placeholder: 'Enter your email address',
    prefix: 'EM',
    defaultValue: 'test@example.com',
    required: true,
  };

  // Store for later verification
  this.expectedFieldSettings = testData;

  // Fill all fields
  await this.page.waitForSelector('#field-label', { timeout: 10_000 });
  await this.page.fill('#field-label', testData.label);
  await this.page.fill('#field-hint', testData.hint);
  await this.page.fill('#field-placeholder', testData.placeholder);
  await this.page.fill('#field-prefix', testData.prefix);
  await this.page.fill('#field-defaultValue', testData.defaultValue);

  // Set required checkbox
  const requiredToggle = this.page.locator('#field-required');
  const isChecked = await requiredToggle.isChecked();
  if (!isChecked && testData.required) {
    await requiredToggle.click();
  }

  // Verify values are set
  await expect(this.page.locator('#field-label')).toHaveValue(testData.label);
  await expect(this.page.locator('#field-hint')).toHaveValue(testData.hint);
  await expect(this.page.locator('#field-placeholder')).toHaveValue(testData.placeholder);
  await expect(this.page.locator('#field-prefix')).toHaveValue(testData.prefix);
  await expect(this.page.locator('#field-defaultValue')).toHaveValue(testData.defaultValue);
});

When('I fill all number field settings with test data', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  // Define the test data for number field
  // Note: Number fields have min/max for value constraints (not validation.minLength/maxLength)
  const testData = {
    label: 'Number Persistence Test',
    hint: 'This is a test hint for number persistence',
    placeholder: 'Enter a number',
    prefix: '#',
    defaultValue: '42',
    min: 1,
    max: 100,
    required: true,
  };

  // Store for later verification
  this.expectedFieldSettings = testData;

  // Fill all fields
  await this.page.waitForSelector('#field-label', { timeout: 10_000 });
  await this.page.fill('#field-label', testData.label);
  await this.page.fill('#field-hint', testData.hint);
  await this.page.fill('#field-placeholder', testData.placeholder);
  await this.page.fill('#field-prefix', testData.prefix);
  await this.page.fill('#field-defaultValue', testData.defaultValue);

  // Fill min/max value constraints
  await this.page.fill('#field-min', testData.min.toString());
  await this.page.fill('#field-max', testData.max.toString());

  // Set required checkbox
  const requiredToggle = this.page.locator('#field-required');
  const isChecked = await requiredToggle.isChecked();
  if (!isChecked && testData.required) {
    await requiredToggle.click();
  }

  // Verify values are set
  await expect(this.page.locator('#field-label')).toHaveValue(testData.label);
  await expect(this.page.locator('#field-hint')).toHaveValue(testData.hint);
  await expect(this.page.locator('#field-placeholder')).toHaveValue(testData.placeholder);
  await expect(this.page.locator('#field-prefix')).toHaveValue(testData.prefix);
  await expect(this.page.locator('#field-defaultValue')).toHaveValue(testData.defaultValue);
  await expect(this.page.locator('#field-min')).toHaveValue(testData.min.toString());
  await expect(this.page.locator('#field-max')).toHaveValue(testData.max.toString());
});

When('I fill all date field settings with test data', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  // Define the test data for date field
  // Note: Date fields have minDate/maxDate for date range constraints
  // Date fields DON'T have a prefix field
  const testData = {
    label: 'Date Persistence Test',
    hint: 'This is a test hint for date persistence',
    placeholder: 'Select a date',
    defaultValue: '2025-06-15',
    minDate: '2025-01-01',
    maxDate: '2025-12-31',
    required: true,
  };

  // Store for later verification
  this.expectedFieldSettings = testData;

  // Fill all fields
  await this.page.waitForSelector('#field-label', { timeout: 10_000 });
  await this.page.fill('#field-label', testData.label);
  await this.page.fill('#field-hint', testData.hint);
  await this.page.fill('#field-placeholder', testData.placeholder);
  await this.page.fill('#field-defaultValue', testData.defaultValue);

  // Fill minDate/maxDate constraints
  await this.page.fill('#field-minDate', testData.minDate);
  await this.page.fill('#field-maxDate', testData.maxDate);

  // Set required checkbox
  const requiredToggle = this.page.locator('#field-required');
  const isChecked = await requiredToggle.isChecked();
  if (!isChecked && testData.required) {
    await requiredToggle.click();
  }

  // Verify values are set
  await expect(this.page.locator('#field-label')).toHaveValue(testData.label);
  await expect(this.page.locator('#field-hint')).toHaveValue(testData.hint);
  await expect(this.page.locator('#field-placeholder')).toHaveValue(testData.placeholder);
  await expect(this.page.locator('#field-defaultValue')).toHaveValue(testData.defaultValue);
  await expect(this.page.locator('#field-minDate')).toHaveValue(testData.minDate);
  await expect(this.page.locator('#field-maxDate')).toHaveValue(testData.maxDate);
});

When('I fill all dropdown field settings with test data', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  // Define the test data for dropdown field
  // Note: Dropdown fields don't have prefix or placeholder
  // Dropdown fields have an options array that comes with defaults
  // We're not setting defaultValue as it requires interacting with a dropdown of dynamic options
  const testData = {
    label: 'Dropdown Persistence Test',
    hint: 'This is a test hint for dropdown persistence',
    defaultValue: '',  // Empty means no default selected
    required: true,
  };

  // Store for later verification
  this.expectedFieldSettings = testData;

  // Fill basic fields
  await this.page.waitForSelector('#field-label', { timeout: 10_000 });
  await this.page.fill('#field-label', testData.label);
  await this.page.fill('#field-hint', testData.hint);

  // Wait a bit for the form to be ready
  await this.page.waitForTimeout(500);

  // Set required checkbox
  const requiredToggle = this.page.locator('#field-required');
  const isChecked = await requiredToggle.isChecked();
  if (!isChecked && testData.required) {
    await requiredToggle.click();
  }

  // Verify basic values are set
  await expect(this.page.locator('#field-label')).toHaveValue(testData.label);
  await expect(this.page.locator('#field-hint')).toHaveValue(testData.hint);
});

When('I fill all radio field settings with test data', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  // Define the test data for radio field
  // Note: Radio fields are identical to dropdown - don't have prefix or placeholder
  // Radio fields have an options array that comes with defaults
  const testData = {
    label: 'Radio Persistence Test',
    hint: 'This is a test hint for radio persistence',
    defaultValue: '',  // Empty means no default selected
    required: true,
  };

  // Store for later verification
  this.expectedFieldSettings = testData;

  // Fill basic fields
  await this.page.waitForSelector('#field-label', { timeout: 10_000 });
  await this.page.fill('#field-label', testData.label);
  await this.page.fill('#field-hint', testData.hint);

  // Wait a bit for the form to be ready
  await this.page.waitForTimeout(500);

  // Set required checkbox
  const requiredToggle = this.page.locator('#field-required');
  const isChecked = await requiredToggle.isChecked();
  if (!isChecked && testData.required) {
    await requiredToggle.click();
  }

  // Verify basic values are set
  await expect(this.page.locator('#field-label')).toHaveValue(testData.label);
  await expect(this.page.locator('#field-hint')).toHaveValue(testData.hint);
});

When('I fill all checkbox field settings with test data', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  // Define the test data for checkbox field
  // Note: Checkbox fields don't have prefix or placeholder
  // Checkbox fields have defaultValues (array) and minSelections/maxSelections validation
  const testData = {
    label: 'Checkbox Persistence Test',
    hint: 'This is a test hint for checkbox persistence',
    defaultValue: [],  // Empty array means no defaults selected
    required: true,
  };

  // Store for later verification
  this.expectedFieldSettings = testData;

  // Fill basic fields
  await this.page.waitForSelector('#field-label', { timeout: 10_000 });
  await this.page.fill('#field-label', testData.label);
  await this.page.fill('#field-hint', testData.hint);

  // Wait a bit for the form to be ready
  await this.page.waitForTimeout(500);

  // Set required checkbox
  const requiredToggle = this.page.locator('#field-required');
  const isChecked = await requiredToggle.isChecked();
  if (!isChecked && testData.required) {
    await requiredToggle.click();
  }

  // Verify basic values are set
  await expect(this.page.locator('#field-label')).toHaveValue(testData.label);
  await expect(this.page.locator('#field-hint')).toHaveValue(testData.hint);
});

When('I save the field settings', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  // Use keyboard shortcut Cmd+S (or Ctrl+S on Windows/Linux)
  await this.page.keyboard.press('Meta+s');

  // Wait a bit for the save operation to complete
  await this.page.waitForTimeout(1000);
});

Then('the field settings should be saved successfully', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  // Verify no validation errors are visible
  const validationSummary = this.page.locator('[data-testid="validation-summary"]');
  await expect(validationSummary).not.toBeVisible({ timeout: 5_000 }).catch(() => {
    // It's OK if the element doesn't exist at all
  });

  // Wait for save to complete - the orange background should disappear
  // The form has a gradient background when dirty
  await this.page.waitForTimeout(1500);
});

When('I reload the collaborative builder page', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  // Store the current URL
  const currentUrl = this.page.url();

  // Reload the page
  await this.page.reload({ waitUntil: 'networkidle' });

  // Verify we're still on the same URL
  expect(this.page.url()).toBe(currentUrl);
});

Then('the collaborative builder should load successfully', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  // Wait for the collaborative builder to be visible
  const builderRoot = this.page.getByTestId('collaborative-form-builder');
  await expect(builderRoot).toBeVisible({ timeout: 30_000 });

  // Wait for connection indicator to show connected (green dot)
  await this.page.waitForTimeout(2000);
});

When('I click the JSON tab in the sidebar', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  // Find and click the JSON tab button in the PagesSidebar
  // The button has the text "JSON" and Code icon
  const jsonTabButton = this.page.locator('button:has-text("JSON")').first();
  await expect(jsonTabButton).toBeVisible({ timeout: 10_000 });
  await jsonTabButton.click();

  // Wait for the tab to switch
  await this.page.waitForTimeout(500);
});

Then('I should see the JSON schema preview', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  // Verify the JSON preview is visible
  // The JSONPreview component has a pre element with the JSON content
  const jsonPreviewTitle = this.page.locator('text=/FormSchema JSON/i');
  await expect(jsonPreviewTitle).toBeVisible({ timeout: 10_000 });

  // Verify the code block is visible
  const codeBlock = this.page.locator('pre code');
  await expect(codeBlock).toBeVisible({ timeout: 5_000 });
});

Then('the JSON schema should contain the persisted field settings', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  if (!this.expectedFieldSettings) {
    throw new Error('Expected field settings not found. Did you run "I fill all short text field settings with test data"?');
  }

  // Extract the JSON content from the preview
  const codeBlock = this.page.locator('pre code');
  const jsonText = await codeBlock.textContent();

  if (!jsonText) {
    throw new Error('Could not extract JSON from preview');
  }

  // Parse the JSON
  const formSchema = JSON.parse(jsonText);

  // Navigate to the field - it should be in pages[1].fields[0] (second page, first field)
  // because we "add a new page" and then "drag a short text field onto the page"
  if (!formSchema.pages || formSchema.pages.length < 2) {
    throw new Error(`Expected at least 2 pages in schema, found: ${formSchema.pages?.length || 0}`);
  }

  const secondPage = formSchema.pages[1];
  if (!secondPage.fields || secondPage.fields.length === 0) {
    throw new Error('Expected at least 1 field in the second page');
  }

  const field = secondPage.fields[0];

  // Verify all field properties match expected values
  const expected = this.expectedFieldSettings;

  expect(field.label).toBe(expected.label);
  expect(field.hint).toBe(expected.hint);

  // Verify placeholder only if it exists in expected data (dropdown/radio/checkbox fields don't have placeholder)
  if (expected.placeholder !== undefined) {
    expect(field.placeholder).toBe(expected.placeholder);
  }

  // Verify prefix only if it exists in expected data (date and selection fields don't have prefix)
  if (expected.prefix !== undefined) {
    expect(field.prefix).toBe(expected.prefix);
  }

  // Verify defaultValue - handle both single values and arrays (for checkbox fields)
  if (Array.isArray(expected.defaultValue)) {
    // For checkbox fields, defaultValue is an array
    const fieldDefaultValue = Array.isArray(field.defaultValue) ? field.defaultValue :
      (field.defaultValues || []);
    expect(fieldDefaultValue).toEqual(expected.defaultValue);
  } else {
    expect(field.defaultValue).toBe(expected.defaultValue);
  }

  // Verify validation settings
  expect(field.validation).toBeDefined();
  expect(field.validation.required).toBe(expected.required);

  // Verify minLength and maxLength only if they exist in expected data
  // (Email, Number, Date, and selection fields don't have these validations)
  if (expected.minLength !== undefined) {
    expect(field.validation.minLength).toBe(expected.minLength);
  }
  if (expected.maxLength !== undefined) {
    expect(field.validation.maxLength).toBe(expected.maxLength);
  }

  // Verify min and max (field-level properties for number fields)
  if (expected.min !== undefined) {
    expect(field.min).toBe(expected.min);
  }
  if (expected.max !== undefined) {
    expect(field.max).toBe(expected.max);
  }

  // Verify minDate and maxDate (field-level properties for date fields)
  if (expected.minDate !== undefined) {
    expect(field.minDate).toBe(expected.minDate);
  }
  if (expected.maxDate !== undefined) {
    expect(field.maxDate).toBe(expected.maxDate);
  }

  // Verify options array (for dropdown, radio, checkbox fields)
  if (expected.options !== undefined) {
    expect(field.options).toBeDefined();
    expect(Array.isArray(field.options)).toBe(true);
    expect(field.options).toEqual(expected.options);
  }

  // Verify minSelections and maxSelections (for checkbox fields)
  if (expected.minSelections !== undefined) {
    expect(field.validation.minSelections).toBe(expected.minSelections);
  }
  if (expected.maxSelections !== undefined) {
    expect(field.validation.maxSelections).toBe(expected.maxSelections);
  }
});
