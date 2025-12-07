import { Then, When } from '@cucumber/cucumber';
import { expect } from '@playwright/test';
import { CustomWorld } from '../support/world';

// Drag and drop step
Then('I drag a dropdown field onto the page', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  const fieldTile = this.page.getByTestId('field-type-dropdown');
  const droppablePage = this.page.getByTestId('droppable-page').first();

  const initialCount = await droppablePage.locator('[data-testid^="field-content-"]').count();

  await fieldTile.dragTo(droppablePage);

  await expect(async () => {
    const newCount = await droppablePage.locator('[data-testid^="field-content-"]').count();
    expect(newCount).toBeGreaterThan(initialCount);
  }).toPass({ timeout: 15000 });
});

// Settings panel steps
When('I open the dropdown field settings', async function (this: CustomWorld) {
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

Then('I fill the dropdown field settings with valid data', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  const settingsPanel = this.page.getByTestId('field-settings-panel');
  await expect(settingsPanel).toBeVisible({ timeout: 15_000 });

  await this.page.waitForSelector('#field-label', { timeout: 10_000 });
  await this.page.fill('#field-label', `Country Selection Field ${Date.now()}`);
  await this.page.fill('#field-hint', 'Select your country from the list.');

  const optionInputs = this.page.locator('input[placeholder="Enter option value"]');
  const optionCount = await optionInputs.count();

  if (optionCount > 0) {
    await optionInputs.nth(0).fill('USA');

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

  const requiredToggle = this.page.locator('#field-required');
  const isChecked = await requiredToggle.isChecked();
  if (!isChecked) {
    await requiredToggle.click();
  }

  await expect(this.page.locator('#field-label')).toHaveValue(/Country Selection/);
});

Then('I test label and hint validation for dropdown', async function (this: CustomWorld) {
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

Then('I test options validation for dropdown', async function (this: CustomWorld) {
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
    await optionInputs.nth(0).fill('USA');
    await optionInputs.nth(1).fill('USA');
    await this.page.locator('#field-label').click();

    const duplicateError = this.page.locator('text=/Options must be unique/i').first();
    await expect(duplicateError).toBeVisible({ timeout: 5_000 });
  }
});

Then('I fix all validation errors for dropdown', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  await this.page.fill('#field-label', `Dropdown Field ${Date.now()}`);
  await this.page.fill('#field-hint', 'Select your country from the list.');

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

  await this.page.locator('#field-label').click();
  await this.page.waitForTimeout(1000);
});

Then('I save the dropdown field settings', async function (this: CustomWorld) {
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
When('I fill and save the dropdown field with label {string}', async function (this: CustomWorld, label: string) {
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

// GraphQL form creation
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

  const formSchema = createFormSchemaWithDropdownValidations();
  const timestamp = Date.now();
  const formTitle = `E2E Dropdown Validation Test ${timestamp}`;

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
When('I test required validation for dropdown in viewer', async function (this: CustomWorld) {
  if (!this.viewerPage) {
    throw new Error('Viewer page is not initialized');
  }

  const requiredField = this.viewerPage.locator('select[name="field-required"]');
  await expect(requiredField).toBeVisible({ timeout: 10_000 });

  const nextButton = this.viewerPage.getByTestId('viewer-next-button');
  if (await nextButton.isVisible()) {
    await nextButton.click();
    await this.viewerPage.waitForTimeout(500);
  }

  const requiredError = this.viewerPage.locator('text=/required/i').first();
  await expect(requiredError).toBeVisible({ timeout: 5_000 });

  await requiredField.selectOption('Option 1');
  await requiredField.blur();
  await this.viewerPage.waitForTimeout(500);
});

When('I test dropdown option selection in viewer', async function (this: CustomWorld) {
  if (!this.viewerPage) {
    throw new Error('Viewer page is not initialized');
  }

  const selectionField = this.viewerPage.locator('select[name="field-selection"]');
  await expect(selectionField).toBeVisible({ timeout: 10_000 });

  await selectionField.selectOption('Choice A');
  await this.viewerPage.waitForTimeout(300);

  const selectedValue1 = await selectionField.inputValue();
  if (selectedValue1 !== 'Choice A') {
    throw new Error(`Expected 'Choice A' to be selected, but got '${selectedValue1}'`);
  }

  await selectionField.selectOption('Choice C');
  await this.viewerPage.waitForTimeout(300);

  const selectedValue2 = await selectionField.inputValue();
  if (selectedValue2 !== 'Choice C') {
    throw new Error(`Expected 'Choice C' to be selected, but got '${selectedValue2}'`);
  }
});

When('I fill dropdown field with valid data in viewer', async function (this: CustomWorld) {
  if (!this.viewerPage) {
    throw new Error('Viewer page is not initialized');
  }

  await this.viewerPage.locator('select[name="field-required"]').selectOption('Option 2');
  await this.viewerPage.locator('select[name="field-selection"]').selectOption('Choice B');

  await this.viewerPage.waitForTimeout(500);
});

// Settings persistence test helper
When('I fill all dropdown field settings with test data', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  const testData = {
    label: 'Dropdown Persistence Test',
    hint: 'This is a test hint for dropdown persistence',
    defaultValue: '',
    required: true,
  };

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
