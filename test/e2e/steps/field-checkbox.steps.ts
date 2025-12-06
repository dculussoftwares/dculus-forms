import { Then, When } from '@cucumber/cucumber';
import { expect } from '@playwright/test';
import { CustomWorld } from '../support/world';

// Drag and drop step
Then('I drag a checkbox field onto the page', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  const fieldTile = this.page.getByTestId('field-type-checkbox');
  const droppablePage = this.page.getByTestId('droppable-page').first();

  const initialCount = await droppablePage.locator('[data-testid^="field-content-"]').count();

  await fieldTile.dragTo(droppablePage);

  await expect(async () => {
    const newCount = await droppablePage.locator('[data-testid^="field-content-"]').count();
    expect(newCount).toBeGreaterThan(initialCount);
  }).toPass({ timeout: 15000 });
});

// Settings panel steps
When('I open the checkbox field settings', async function (this: CustomWorld) {
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

Then('I fill the checkbox field settings with valid data', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  const settingsPanel = this.page.getByTestId('field-settings-panel');
  await expect(settingsPanel).toBeVisible({ timeout: 15_000 });

  await this.page.waitForSelector('#field-label', { timeout: 10_000 });
  await this.page.fill('#field-label', `Hobbies Selection Field ${Date.now()}`);
  await this.page.fill('#field-hint', 'Select your favorite hobbies.');

  const optionInputs = this.page.locator('input[placeholder="Enter option value"]');
  const optionCount = await optionInputs.count();

  if (optionCount > 0) {
    await optionInputs.nth(0).fill('Reading');

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

  await this.page.fill('input[name="validation.minSelections"]', '1');
  await this.page.fill('input[name="validation.maxSelections"]', '3');

  const requiredToggle = this.page.locator('#field-required');
  const isChecked = await requiredToggle.isChecked();
  if (!isChecked) {
    await requiredToggle.click();
  }

  await expect(this.page.locator('#field-label')).toHaveValue(/Hobbies/);
});

Then('I test label and hint validation for checkbox', async function (this: CustomWorld) {
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

Then('I test selection limits validation for checkbox', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  // Test 1: Min greater than max
  await this.page.fill('input[name="validation.minSelections"]', '5');
  await this.page.fill('input[name="validation.maxSelections"]', '2');
  await this.page.locator('#field-label').click();

  const minGreaterThanMaxError = this.page.locator('text=/Minimum.*maximum|Min.*less.*max/i').first();
  await expect(minGreaterThanMaxError).toBeVisible({ timeout: 5_000 });

  // Fix: Set valid range
  await this.page.fill('input[name="validation.minSelections"]', '1');
  await this.page.fill('input[name="validation.maxSelections"]', '3');
  await this.page.locator('#field-label').click();

  // Verify error is gone
  await expect(minGreaterThanMaxError).not.toBeVisible();
});

Then('I test options validation for checkbox', async function (this: CustomWorld) {
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
    await optionInputs.nth(0).fill('Reading');
    await optionInputs.nth(1).fill('Reading');
    await this.page.locator('#field-label').click();

    const duplicateError = this.page.locator('text=/Options must be unique/i').first();
    await expect(duplicateError).toBeVisible({ timeout: 5_000 });
  }
});

Then('I fix all validation errors for checkbox', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  await this.page.fill('#field-label', `Checkbox Field ${Date.now()}`);
  await this.page.fill('#field-hint', 'Select your favorite hobbies.');

  const addOptionButton = this.page.getByRole('button', { name: /add option/i });
  let optionInputs = this.page.locator('input[placeholder^="Option "]');

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

  await this.page.fill('input[name="validation.minSelections"]', '');
  await this.page.fill('input[name="validation.maxSelections"]', '');

  await this.page.click('#field-label');
  await this.page.waitForTimeout(500);
  await this.page.click('#field-hint');
  await this.page.waitForTimeout(500);
  await this.page.click('input[name="validation.minSelections"]');
  await this.page.waitForTimeout(500);
  await this.page.click('input[name="validation.maxSelections"]');
  await this.page.waitForTimeout(500);
  await this.page.click('#field-label');

  await this.page.waitForTimeout(3000);
});

Then('I save the checkbox field settings', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  const saveButton = this.page.getByRole('button', { name: /save/i });
  await saveButton.click();

  await this.page.waitForTimeout(1000);

  const fieldContent = this.page.getByTestId('field-content-1');
  await expect(fieldContent).toBeVisible({ timeout: 5_000 });
});

Then('I fix selection limits for checkbox', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  await this.page.fill('input[name="validation.minSelections"]', '1');
  await this.page.fill('input[name="validation.maxSelections"]', '3');

  await this.page.click('#field-label');
  await this.page.waitForTimeout(1000);
});

// Quick fill helper
When('I fill and save the checkbox field with label {string}', async function (this: CustomWorld, label: string) {
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

  const formSchema = createFormSchemaWithCheckboxValidations();
  const timestamp = Date.now();
  const formTitle = `E2E Checkbox Validation Test ${timestamp}`;

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
When('I test checkbox required and select options in viewer', async function (this: CustomWorld) {
  if (!this.viewerPage) {
    throw new Error('Viewer page is not initialized');
  }

  const firstCheckboxLabel = this.viewerPage.locator('label[for="field-required-0"]');
  await expect(firstCheckboxLabel).toBeVisible({ timeout: 10_000 });
  await firstCheckboxLabel.click();
  await this.viewerPage.waitForTimeout(500);

  const secondFieldLabel = this.viewerPage.locator('label[for="field-multi-0"]');
  await expect(secondFieldLabel).toBeVisible({ timeout: 10_000 });
  await secondFieldLabel.click();
  await this.viewerPage.waitForTimeout(300);

  const thirdFieldLabel = this.viewerPage.locator('label[for="field-multi-1"]');
  await thirdFieldLabel.click();
  await this.viewerPage.waitForTimeout(500);
});

// Settings persistence step
When('I fill all checkbox field settings with test data', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  // Define test data
  const testData = {
    label: 'Checkbox Persistence Test',
    hint: 'This is a test hint for checkbox persistence',
    defaultValue: [],  // Empty array means no defaults selected
    required: true,
  };

  // Store for later verification
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
