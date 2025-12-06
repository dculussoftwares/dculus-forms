import { Then, When } from '@cucumber/cucumber';
import { expect } from '@playwright/test';
import { CustomWorld } from '../support/world';

// Drag and drop step
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

// Settings panel steps
When('I open the number field settings', async function (this: CustomWorld) {
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

Then('I fill the number field settings with valid data', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  const settingsPanel = this.page.getByTestId('field-settings-panel');
  await expect(settingsPanel).toBeVisible({ timeout: 15_000 });

  await this.page.waitForSelector('#field-label', { timeout: 10_000 });
  await this.page.fill('#field-label', `Quantity Field ${Date.now()}`);
  await this.page.fill('#field-hint', 'Enter the amount.');
  await this.page.fill('#field-placeholder', '0');
  await this.page.fill('#field-defaultValue', '10');

  await this.page.fill('#field-min', '0');
  await this.page.fill('#field-max', '100');

  const requiredToggle = this.page.locator('#field-required');
  const isChecked = await requiredToggle.isChecked();
  if (!isChecked) {
    await requiredToggle.click();
  }

  await expect(this.page.locator('#field-label')).toHaveValue(/Quantity/);
  await expect(this.page.locator('#field-placeholder')).toHaveValue('0');
});

Then('I test label validation for number', async function (this: CustomWorld) {
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
});

Then('I test min max value validation for number', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  await this.page.fill('#field-min', '100');
  await this.page.fill('#field-max', '50');
  await this.page.locator('#field-label').click();

  const minGreaterThanMaxError = this.page.locator('text=/Minimum value must be less than or equal to maximum value/i').first();
  await expect(minGreaterThanMaxError).toBeVisible({ timeout: 5_000 });
});

Then('I test default value range validation for number', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  await this.page.fill('#field-min', '10');
  await this.page.fill('#field-max', '100');

  await this.page.fill('#field-defaultValue', '5');
  await this.page.locator('#field-label').click();

  const defaultValueRangeError = this.page.locator('text=/Default value must be greater than or equal to minimum value/i').first();
  await expect(defaultValueRangeError).toBeVisible({ timeout: 5_000 });

  await this.page.fill('#field-defaultValue', '150');
  await this.page.locator('#field-label').click();

  const defaultValueAboveMaxError = this.page.locator('text=/Default value must be less than or equal to maximum value/i').first();
  await expect(defaultValueAboveMaxError).toBeVisible({ timeout: 5_000 });
});

Then('I fix all validation errors for number', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  await this.page.fill('#field-label', `Number Field ${Date.now()}`);
  await this.page.fill('#field-min', '0');
  await this.page.fill('#field-max', '100');
  await this.page.fill('#field-defaultValue', '50');

  await this.page.locator('#field-label').click();
  await this.page.waitForTimeout(1000);
});

Then('I save the number field settings', async function (this: CustomWorld) {
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
When('I fill and save the number field with label {string}', async function (this: CustomWorld, label: string) {
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

  const formSchema = createFormSchemaWithNumberValidations();
  const timestamp = Date.now();
  const formTitle = `E2E Number Validation Test ${timestamp}`;

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
When('I test required validation for number in viewer', async function (this: CustomWorld) {
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

  await requiredField.fill('42');
  await requiredField.blur();
  await this.viewerPage.waitForTimeout(500);
});

When('I test min value validation in viewer', async function (this: CustomWorld) {
  if (!this.viewerPage) {
    throw new Error('Viewer page is not initialized');
  }

  const minField = this.viewerPage.locator('input[name="field-min"]');
  await expect(minField).toBeVisible({ timeout: 10_000 });

  await minField.fill('5');
  await minField.blur();
  await this.viewerPage.waitForTimeout(1000);

  const minError = this.viewerPage.locator('text=/10|minimum.*10|at least 10|greater.*10/i').first();
  await expect(minError).toBeVisible({ timeout: 5_000 });

  await minField.fill('15');
  await minField.blur();
  await this.viewerPage.waitForTimeout(500);
});

When('I test max value validation in viewer', async function (this: CustomWorld) {
  if (!this.viewerPage) {
    throw new Error('Viewer page is not initialized');
  }

  const maxField = this.viewerPage.locator('input[name="field-max"]');
  await expect(maxField).toBeVisible({ timeout: 10_000 });

  await maxField.fill('150');
  await maxField.blur();
  await this.viewerPage.waitForTimeout(1000);

  const maxError = this.viewerPage.locator('text=/100|maximum.*100|at most 100|less.*100/i').first();
  await expect(maxError).toBeVisible({ timeout: 5_000 });

  await maxField.fill('75');
  await maxField.blur();
  await this.viewerPage.waitForTimeout(500);
});

When('I fill number field with valid data in viewer', async function (this: CustomWorld) {
  if (!this.viewerPage) {
    throw new Error('Viewer page is not initialized');
  }

  await this.viewerPage.locator('input[name="field-required"]').fill('42');
  await this.viewerPage.locator('input[name="field-min"]').fill('20');
  await this.viewerPage.locator('input[name="field-max"]').fill('50');
  await this.viewerPage.locator('input[name="field-range"]').fill('25');

  await this.viewerPage.waitForTimeout(500);
});
