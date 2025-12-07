import { Then, When } from '@cucumber/cucumber';
import { expect } from '@playwright/test';
import { CustomWorld } from '../support/world';

// Drag and drop step
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

// Settings panel steps
When('I open the email field settings', async function (this: CustomWorld) {
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

Then('I fill the email field settings with valid data', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  const settingsPanel = this.page.getByTestId('field-settings-panel');
  await expect(settingsPanel).toBeVisible({ timeout: 15_000 });

  await this.page.waitForSelector('#field-label', { timeout: 10_000 });
  await this.page.fill('#field-label', `Email Address Field ${Date.now()}`);
  await this.page.fill('#field-hint', 'We will never share your email with anyone.');
  await this.page.fill('#field-placeholder', 'you@example.com');
  await this.page.fill('#field-defaultValue', 'test@example.com');

  const requiredToggle = this.page.locator('#field-required');
  const isChecked = await requiredToggle.isChecked();
  if (!isChecked) {
    await requiredToggle.click();
  }

  await expect(this.page.locator('#field-label')).toHaveValue(/Email Address/);
  await expect(this.page.locator('#field-placeholder')).toHaveValue('you@example.com');
});

Then('I test label and hint validation for email', async function (this: CustomWorld) {
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

  await expect(labelTooLongError).toBeVisible();
  await expect(hintTooLongError).toBeVisible();
});

Then('I test placeholder validation for email', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  const longPlaceholder = 'C'.repeat(101);
  await this.page.fill('#field-placeholder', longPlaceholder);
  await this.page.locator('#field-label').click();

  const placeholderTooLongError = this.page.locator('text=/Placeholder is too long/i').first();
  await expect(placeholderTooLongError).toBeVisible({ timeout: 5_000 });
});

Then('I test default value validation for email', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  const longDefaultValue = 'D'.repeat(1001);
  await this.page.fill('#field-defaultValue', longDefaultValue);
  await this.page.locator('#field-label').click();

  const defaultValueTooLongError = this.page.locator('text=/Default value is too long/i').first();
  await expect(defaultValueTooLongError).toBeVisible({ timeout: 5_000 });
});

Then('I fix all validation errors for email', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  await this.page.fill('#field-label', `Email Field ${Date.now()}`);
  await this.page.fill('#field-hint', 'We will never share your email.');
  await this.page.fill('#field-placeholder', 'you@example.com');
  await this.page.fill('#field-defaultValue', 'test@example.com');

  await this.page.locator('#field-label').click();
  await this.page.waitForTimeout(1000);
});

Then('I save the email field settings', async function (this: CustomWorld) {
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
When('I fill and save the email field with label {string}', async function (this: CustomWorld, label: string) {
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

    return null;
  });

  if (!organizationId) {
    throw new Error('Organization ID not found');
  }

  const formSchema = createFormSchemaWithEmailValidations();
  const timestamp = Date.now();
  const formTitle = `E2E Email Validation Test ${timestamp}`;

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
When('I test required validation for email in viewer', async function (this: CustomWorld) {
  if (!this.viewerPage) {
    throw new Error('Viewer page is not initialized');
  }

  const requiredField = this.viewerPage.locator('input[name="field-required"]');
  await expect(requiredField).toBeVisible({ timeout: 10_000 });

  const nextButton = this.viewerPage.getByTestId('viewer-next-button');
  if (await nextButton.isVisible()) {
    await nextButton.click();
    await this.viewerPage.waitForTimeout(500);
  }

  const requiredError = this.viewerPage.locator('text=/required/i').first();
  await expect(requiredError).toBeVisible({ timeout: 5_000 });

  await requiredField.fill('test@example.com');
  await requiredField.blur();
  await this.viewerPage.waitForTimeout(500);
});

When('I test email format validation in viewer', async function (this: CustomWorld) {
  if (!this.viewerPage) {
    throw new Error('Viewer page is not initialized');
  }

  const formatField = this.viewerPage.locator('input[name="field-format"]');
  await expect(formatField).toBeVisible({ timeout: 10_000 });

  await formatField.fill('invalid-email');
  await formatField.blur();
  await this.viewerPage.waitForTimeout(1000);

  const formatError = this.viewerPage.locator('text=/valid email|email.*valid|invalid.*email/i').first();
  await expect(formatError).toBeVisible({ timeout: 5_000 });

  await formatField.fill('valid@example.com');
  await formatField.blur();
  await this.viewerPage.waitForTimeout(500);
});

When('I fill email field with valid data in viewer', async function (this: CustomWorld) {
  if (!this.viewerPage) {
    throw new Error('Viewer page is not initialized');
  }

  await this.viewerPage.locator('input[name="field-required"]').fill('user@example.com');
  await this.viewerPage.locator('input[name="field-format"]').fill('test@domain.com');

  await this.viewerPage.waitForTimeout(500);
});

// Settings persistence step
When('I fill all email field settings with test data', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  // Define test data
  const timestamp = Date.now();
  const testData = {
    label: `Complete Email Field ${timestamp}`,
    hint: 'This is comprehensive help text for email',
    placeholder: 'Enter your email address',
    prefix: 'EM',
    defaultValue: 'test@example.com',
    required: true,
  };

  // Store for later verification
  this.expectedFieldSettings = testData;

  await this.page.waitForSelector('#field-label', { timeout: 10_000 });
  await this.page.fill('#field-label', testData.label);
  await this.page.fill('#field-hint', testData.hint);
  await this.page.fill('#field-placeholder', testData.placeholder);
  await this.page.fill('#field-prefix', testData.prefix);
  await this.page.fill('#field-defaultValue', testData.defaultValue);

  const requiredToggle = this.page.locator('#field-required');
  const isChecked = await requiredToggle.isChecked();
  if (!isChecked && testData.required) {
    await requiredToggle.click();
  }

  await this.page.waitForTimeout(500);
});
