import { Then, When } from '@cucumber/cucumber';
import { expect } from '@playwright/test';
import { CustomWorld } from '../support/world';

// Drag and drop step
Then('I drag a date field onto the page', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  const fieldTile = this.page.getByTestId('field-type-date');
  const droppablePage = this.page.getByTestId('droppable-page').first();

  const initialCount = await droppablePage.locator('[data-testid^="field-content-"]').count();

  await fieldTile.dragTo(droppablePage);

  await expect(async () => {
    const newCount = await droppablePage.locator('[data-testid^="field-content-"]').count();
    expect(newCount).toBeGreaterThan(initialCount);
  }).toPass({ timeout: 15000 });
});

// Settings panel steps
When('I open the date field settings', async function (this: CustomWorld) {
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

Then('I fill the date field settings with valid data', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  const settingsPanel = this.page.getByTestId('field-settings-panel');
  await expect(settingsPanel).toBeVisible({ timeout: 15_000 });

  await this.page.waitForSelector('#field-label', { timeout: 10_000 });
  await this.page.fill('#field-label', `Event Date Field ${Date.now()}`);
  await this.page.fill('#field-hint', 'Select the date of the event.');
  await this.page.fill('#field-placeholder', 'MM/DD/YYYY');

  await this.page.fill('#field-minDate', '2024-01-01');
  await this.page.fill('#field-maxDate', '2024-12-31');

  await this.page.fill('#field-defaultValue', '2024-06-15');

  const requiredToggle = this.page.locator('#field-required');
  const isChecked = await requiredToggle.isChecked();
  if (!isChecked) {
    await requiredToggle.click();
  }

  await expect(this.page.locator('#field-label')).toHaveValue(/Event Date/);
  await expect(this.page.locator('#field-placeholder')).toHaveValue('MM/DD/YYYY');
});

Then('I test label and hint validation for date', async function (this: CustomWorld) {
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

  await this.page.fill('#field-minDate', '2024-12-31');
  await this.page.fill('#field-maxDate', '2024-01-01');
  await this.page.locator('#field-label').click();

  const minGreaterThanMaxError = this.page.locator('text=/Minimum date must be before or equal to maximum date/i').first();
  await expect(minGreaterThanMaxError).toBeVisible({ timeout: 5_000 });
});

Then('I test default value date validation for date', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  await this.page.fill('#field-minDate', '2024-01-01');
  await this.page.fill('#field-maxDate', '2024-12-31');

  await this.page.fill('#field-defaultValue', '2023-12-31');
  await this.page.locator('#field-label').click();

  const defaultValueRangeError = this.page.locator('text=/Default date must be after or equal to minimum date/i').first();
  await expect(defaultValueRangeError).toBeVisible({ timeout: 5_000 });

  await this.page.fill('#field-defaultValue', '2025-01-01');
  await this.page.locator('#field-label').click();

  const defaultValueAboveMaxError = this.page.locator('text=/Default date must be before or equal to maximum date/i').first();
  await expect(defaultValueAboveMaxError).toBeVisible({ timeout: 5_000 });
});

Then('I fix all validation errors for date', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  await this.page.fill('#field-label', `Date Field ${Date.now()}`);
  await this.page.fill('#field-hint', 'Select the date of the event.');
  await this.page.fill('#field-placeholder', 'MM/DD/YYYY');
  await this.page.fill('#field-minDate', '2024-01-01');
  await this.page.fill('#field-maxDate', '2024-12-31');
  await this.page.fill('#field-defaultValue', '2024-06-15');

  await this.page.locator('#field-label').click();
  await this.page.waitForTimeout(1000);
});

Then('I save the date field settings', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  const saveButton = this.page.getByRole('button', { name: /save/i });
  await saveButton.click();

  await this.page.waitForTimeout(1000);

  const fieldContent = this.page.getByTestId('field-content-1');
  await expect(fieldContent).toBeVisible({ timeout: 5_000 });
});

// GraphQL form creation
function createFormSchemaWithDateValidations() {
  const today = new Date();
  const minDate = new Date(today);
  minDate.setDate(today.getDate() + 1);
  const maxDate = new Date(today);
  maxDate.setDate(today.getDate() + 30);

  const formatDate = (date: Date) => {
    return date.toISOString().split('T')[0];
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

  const formSchema = createFormSchemaWithDateValidations();
  const timestamp = Date.now();
  const formTitle = `E2E Date Validation Test ${timestamp}`;

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
When('I test required validation for date in viewer', async function (this: CustomWorld) {
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

  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + 15);
  const formattedDate = futureDate.toISOString().split('T')[0];

  await requiredField.fill(formattedDate);
  await requiredField.blur();
  await this.viewerPage.waitForTimeout(500);
});

When('I test min date validation in viewer', async function (this: CustomWorld) {
  if (!this.viewerPage) {
    throw new Error('Viewer page is not initialized');
  }

  const minField = this.viewerPage.locator('input[name="field-min"]');
  await expect(minField).toBeVisible({ timeout: 10_000 });

  const today = new Date();
  const formattedToday = today.toISOString().split('T')[0];

  await minField.fill(formattedToday);
  await minField.blur();
  await this.viewerPage.waitForTimeout(1000);

  const minError = this.viewerPage.locator('text=/after|minimum date|earliest|on or after/i').first();
  await expect(minError).toBeVisible({ timeout: 5_000 });

  const validDate = new Date();
  validDate.setDate(today.getDate() + 10);
  const formattedValidDate = validDate.toISOString().split('T')[0];

  await minField.fill(formattedValidDate);
  await minField.blur();
  await this.viewerPage.waitForTimeout(500);
});

When('I test max date validation in viewer', async function (this: CustomWorld) {
  if (!this.viewerPage) {
    throw new Error('Viewer page is not initialized');
  }

  const maxField = this.viewerPage.locator('input[name="field-max"]');
  await expect(maxField).toBeVisible({ timeout: 10_000 });

  const farFuture = new Date();
  farFuture.setDate(farFuture.getDate() + 60);
  const formattedFarFuture = farFuture.toISOString().split('T')[0];

  await maxField.fill(formattedFarFuture);
  await maxField.blur();
  await this.viewerPage.waitForTimeout(1000);

  const maxError = this.viewerPage.locator('text=/before|maximum date|latest|on or before/i').first();
  await expect(maxError).toBeVisible({ timeout: 5_000 });

  const validDate = new Date();
  validDate.setDate(validDate.getDate() + 15);
  const formattedValidDate = validDate.toISOString().split('T')[0];

  await maxField.fill(formattedValidDate);
  await maxField.blur();
  await this.viewerPage.waitForTimeout(500);
});

When('I fill date field with valid data in viewer', async function (this: CustomWorld) {
  if (!this.viewerPage) {
    throw new Error('Viewer page is not initialized');
  }

  const today = new Date();

  const date1 = new Date();
  date1.setDate(today.getDate() + 5);

  const date2 = new Date();
  date2.setDate(today.getDate() + 7);

  const date3 = new Date();
  date3.setDate(today.getDate() + 10);

  const date4 = new Date();
  date4.setDate(today.getDate() + 12);

  await this.viewerPage.locator('input[name="field-required"]').fill(date1.toISOString().split('T')[0]);
  await this.viewerPage.locator('input[name="field-min"]').fill(date2.toISOString().split('T')[0]);
  await this.viewerPage.locator('input[name="field-max"]').fill(date3.toISOString().split('T')[0]);
  await this.viewerPage.locator('input[name="field-range"]').fill(date4.toISOString().split('T')[0]);

  await this.viewerPage.waitForTimeout(500);
});

// Quick fill helper
When('I fill and save the date field with label {string}', async function (this: CustomWorld, label: string) {
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

  const saveButton = this.page.getByRole('button', { name: /save/i });
  await expect(saveButton).toBeEnabled({ timeout: 5_000 });
  await saveButton.click();

  await this.page.waitForTimeout(1000);
});
