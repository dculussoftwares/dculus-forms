import { Then, When } from '@cucumber/cucumber';
import { expect } from '@playwright/test';
import { CustomWorld } from '../support/world';
import { createFormSchemaWithAllFields } from './helpers';

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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
    throw new Error('Expected field settings not found. Did you run the field settings test data step?');
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
  // because we "add a new page" and then "drag a field onto the page"
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
