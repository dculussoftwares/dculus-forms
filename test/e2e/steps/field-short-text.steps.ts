import { Then, When } from '@cucumber/cucumber';
import { expect } from '@playwright/test';
import { CustomWorld } from '../support/world';

// Drag and drop step
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

// Settings panel steps
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

// Validation testing steps
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

// Quick fill helper
When('I fill and save the short text field with label {string}', async function (this: CustomWorld, label: string) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  const fieldCard = this.page.locator('[data-testid^="draggable-field-"]').first();
  await fieldCard.hover();

  const settingsButton = this.page.getByTestId('field-settings-button-1');
  await expect(settingsButton).toBeVisible({ timeout: 30_000 });
  await settingsButton.hover();
  await settingsButton.click();

  const settingsPanel = this.page.getByTestId('field-settings-panel');
  await expect(settingsPanel).toBeVisible({ timeout: 15_000 });

  await this.page.waitForSelector('#field-label', { timeout: 10_000 });
  await this.page.fill('#field-label', label);

  const saveButton = this.page.getByRole('button', { name: /save/i });
  await saveButton.click();

  await this.page.waitForTimeout(1000);
});

// GraphQL form creation with short text validations
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

// Viewer validation testing steps
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
  if (errorCount > 0) {
    const firstError = await errorMessages.first().textContent();
    throw new Error(`Form submission failed with errors: ${firstError}`);
  }
});

// Complete settings fill for persistence test
When('I fill all short text field settings with test data', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  // Fill comprehensive test data (settings panel should already be open)
  await this.page.waitForSelector('#field-label', { timeout: 10_000 });
  await this.page.fill('#field-label', `Complete Short Text Field ${Date.now()}`);
  await this.page.fill('#field-hint', 'This is comprehensive help text');
  await this.page.fill('#field-placeholder', 'Full placeholder text');
  await this.page.fill('#field-prefix', 'PREFIX');
  await this.page.fill('#field-defaultValue', 'Default value text');
  await this.page.fill('#field-validation\\.minLength', '5');
  await this.page.fill('#field-validation\\.maxLength', '100');

  const requiredToggle = this.page.locator('#field-required');
  const isChecked = await requiredToggle.isChecked();
  if (!isChecked) {
    await requiredToggle.click();
  }

  // Wait for changes to be applied
  await this.page.waitForTimeout(500);
});
