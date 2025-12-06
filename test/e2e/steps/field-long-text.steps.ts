import { Then, When } from '@cucumber/cucumber';
import { expect } from '@playwright/test';
import { CustomWorld } from '../support/world';

// Drag and drop step
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

// Settings panel steps
When('I open the long text field settings', async function (this: CustomWorld) {
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
});

Then('I test label and hint validation for long text', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  // Test 1: Empty label (required field)
  await this.page.fill('#field-label', '');
  await this.page.locator('#field-hint').click();

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

  await expect(labelTooLongError).toBeVisible();
  await expect(hintTooLongError).toBeVisible();
});

Then('I test min max length validation for long text', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  // Test 1: Negative min length
  await this.page.fill('#field-validation\\.minLength', '-1');
  await this.page.locator('#field-label').click();

  const negativeMinError = this.page.locator('text=/Minimum length must be 0 or greater/i').first();
  await expect(negativeMinError).toBeVisible({ timeout: 5_000 });

  // Test 2: Max length = 0 (must be >= 1)
  await this.page.fill('#field-validation\\.maxLength', '0');
  await this.page.locator('#field-label').click();

  const zeroMaxError = this.page.locator('text=/Maximum length must be 1 or greater/i').first();
  await expect(zeroMaxError).toBeVisible({ timeout: 5_000 });

  // Test 3: Min > Max
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

  const saveButton = this.page.getByRole('button', { name: /save/i });
  await expect(saveButton).toBeVisible({ timeout: 5_000 });
  await expect(saveButton).toBeDisabled({ timeout: 5_000 });

  const validationSummary = this.page.locator('text=/Please fix the following issues to save/i').first();
  await expect(validationSummary).toBeVisible({ timeout: 5_000 });
});

Then('I fix all validation errors for long text', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  await this.page.fill('#field-label', `Long Answer Field ${Date.now()}`);
  await this.page.fill('#field-hint', 'Please provide a detailed answer.');
  await this.page.fill('#field-placeholder', 'Type your answer here...');
  await this.page.fill('#field-validation\\.minLength', '10');
  await this.page.fill('#field-validation\\.maxLength', '500');

  await this.page.locator('#field-label').click();
  await this.page.waitForTimeout(1000);
});

Then('I verify save button is enabled', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  const saveButton = this.page.getByRole('button', { name: /save/i });
  await expect(saveButton).toBeVisible({ timeout: 5_000 });
  await expect(saveButton).toBeEnabled({ timeout: 5_000 });

  const validationSummary = this.page.locator('text=/Please fix the following issues to save/i').first();
  await expect(validationSummary).not.toBeVisible();
});

Then('I save the long text field settings', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  const saveButton = this.page.getByRole('button', { name: /save/i });
  await saveButton.click();

  await this.page.waitForTimeout(1000);

  const fieldContent = this.page.getByTestId('field-content-1');
  await expect(fieldContent).toBeVisible({ timeout: 5_000 });
});

Then('I fill the long text field settings with valid data', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  const settingsPanel = this.page.getByTestId('field-settings-panel');
  await expect(settingsPanel).toBeVisible({ timeout: 15_000 });

  await this.page.waitForSelector('#field-label', { timeout: 10_000 });
  await this.page.fill('#field-label', `Long Answer Field ${Date.now()}`);
  await this.page.fill('#field-hint', 'Please provide a detailed answer.');
  await this.page.fill('#field-placeholder', 'Type your response here...');
  await this.page.fill('#field-defaultValue', 'Default long text response');

  await this.page.fill('#field-validation\\.minLength', '10');
  await this.page.fill('#field-validation\\.maxLength', '500');

  const requiredToggle = this.page.locator('#field-required');
  const isChecked = await requiredToggle.isChecked();
  if (!isChecked) {
    await requiredToggle.click();
  }

  await expect(this.page.locator('#field-label')).toHaveValue(/Long Answer/);
  await expect(this.page.locator('#field-placeholder')).toHaveValue('Type your response here...');
});

// Quick fill helper
When('I fill and save the long text field with label {string}', async function (this: CustomWorld, label: string) {
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

// GraphQL form creation
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

  await this.page.goto(`${this.baseUrl}/dashboard`);
  await this.page.waitForTimeout(2000);

  const organizationId = await this.page.evaluate(() => {
    const orgFromStorage = localStorage.getItem('organization_id');
    if (orgFromStorage) return orgFromStorage;

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

  const formSchema = createFormSchemaWithLongTextValidations();
  const timestamp = Date.now();
  const formTitle = `E2E Long Text Validation Test ${timestamp}`;

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

  await this.page.goto(`${this.baseUrl}/dashboard/form/${formId}`);

  const sidebar = this.page.getByTestId('app-sidebar');
  await expect(sidebar).toBeVisible({ timeout: 30_000 });
});

// Viewer validation steps
When('I test required validation for long text in viewer', async function (this: CustomWorld) {
  if (!this.viewerPage) {
    throw new Error('Viewer page is not initialized');
  }

  const requiredField = this.viewerPage.locator('textarea[name="field-required"]');
  await expect(requiredField).toBeVisible({ timeout: 10_000 });

  const nextButton = this.viewerPage.getByTestId('viewer-next-button');
  if (await nextButton.isVisible()) {
    await nextButton.click();
    await this.viewerPage.waitForTimeout(500);
  }

  const requiredError = this.viewerPage.locator('text=/required/i').first();
  await expect(requiredError).toBeVisible({ timeout: 5_000 });

  await requiredField.fill('Valid text content');
  await requiredField.blur();
  await this.viewerPage.waitForTimeout(500);
});

When('I test min length validation for long text in viewer', async function (this: CustomWorld) {
  if (!this.viewerPage) {
    throw new Error('Viewer page is not initialized');
  }

  const minLengthField = this.viewerPage.locator('textarea[name="field-minlength"]');
  await expect(minLengthField).toBeVisible({ timeout: 10_000 });

  await minLengthField.fill('short');
  await minLengthField.blur();
  await this.viewerPage.waitForTimeout(1000);

  const minLengthError = this.viewerPage.locator('text=/10.*character|character.*10|at least 10|minimum.*10/i').first();
  await expect(minLengthError).toBeVisible({ timeout: 5_000 });

  await minLengthField.fill('This is a valid long text content');
  await minLengthField.blur();
  await this.viewerPage.waitForTimeout(500);
});

When('I test max length validation for long text in viewer', async function (this: CustomWorld) {
  if (!this.viewerPage) {
    throw new Error('Viewer page is not initialized');
  }

  const maxLengthField = this.viewerPage.locator('textarea[name="field-maxlength"]');
  await expect(maxLengthField).toBeVisible({ timeout: 10_000 });

  await maxLengthField.fill('This is a very long text that definitely exceeds the fifty character maximum limit');
  await maxLengthField.blur();
  await this.viewerPage.waitForTimeout(1000);

  const maxLengthError = this.viewerPage.locator('text=/50.*character|character.*50|at most 50|maximum.*50/i').first();
  await expect(maxLengthError).toBeVisible({ timeout: 5_000 });

  await maxLengthField.fill('This is valid content');
  await maxLengthField.blur();
  await this.viewerPage.waitForTimeout(500);
});

When('I fill long text field with valid data in viewer', async function (this: CustomWorld) {
  if (!this.viewerPage) {
    throw new Error('Viewer page is not initialized');
  }

  await this.viewerPage.locator('textarea[name="field-required"]').fill('Required text content');
  await this.viewerPage.locator('textarea[name="field-minlength"]').fill('Valid long text content');
  await this.viewerPage.locator('textarea[name="field-maxlength"]').fill('Short content');
  await this.viewerPage.locator('textarea[name="field-range"]').fill('Medium length text');

  await this.viewerPage.waitForTimeout(500);
});

// Complete settings fill
When('I fill all long text field settings with test data', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  await this.page.waitForSelector('#field-label', { timeout: 10_000 });
  await this.page.fill('#field-label', `Complete Long Text Field ${Date.now()}`);
  await this.page.fill('#field-hint', 'Comprehensive help text');
  await this.page.fill('#field-placeholder', 'Full placeholder');
  await this.page.fill('#field-defaultValue', 'Default value');
  await this.page.fill('#field-validation\\.minLength', '5');
  await this.page.fill('#field-validation\\.maxLength', '500');

  const requiredToggle = this.page.locator('#field-required');
  const isChecked = await requiredToggle.isChecked();
  if (!isChecked) {
    await requiredToggle.click();
  }

  await this.page.waitForTimeout(500);
});
