import { Given, When, Then } from '@cucumber/cucumber';
import { expect } from '@playwright/test';
import { CustomWorld } from '../support/world';
import { createFilterTestFormSchema } from './helpers';

// Store form ID for the current test
let currentFormId: string | null = null;
let formShortUrl: string | null = null;

When('I create a form via GraphQL for filter testing', async function (this: CustomWorld) {
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

    const formSchema = createFilterTestFormSchema();
    const timestamp = Date.now();
    const formTitle = `E2E Filter Test ${timestamp}`;

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

    currentFormId = response.data.createForm.id;
    this.newFormTitle = formTitle;

    // Navigate to the form dashboard
    await this.page.goto(`${this.baseUrl}/dashboard/form/${currentFormId}`);

    // Wait for dashboard to load
    const sidebar = this.page.getByTestId('app-sidebar');
    await expect(sidebar).toBeVisible({ timeout: 30_000 });
});

// Submit response helper function - supports text, number, and date fields
async function submitResponseWithDate(
    world: CustomWorld,
    textValue: string | null,
    numberValue: number | null,
    dateValue: string | null
) {
    if (!world.page || !currentFormId) {
        throw new Error('Page or form ID is not initialized');
    }

    // Submit via GraphQL API directly for speed
    const responseData: Record<string, any> = {};
    if (textValue !== null && textValue !== '') {
        responseData['field-text-filter'] = textValue;
    }
    if (numberValue !== null) {
        responseData['field-number-filter'] = numberValue;
    }
    if (dateValue !== null && dateValue !== '') {
        // Convert date string to timestamp for storage
        responseData['field-date-filter'] = new Date(dateValue).getTime();
    }

    const response = await world.page.evaluate(async ({ formId, data, backendUrl }) => {
        const query = `
      mutation SubmitResponse($input: SubmitResponseInput!) {
        submitResponse(input: $input) {
          id
        }
      }
    `;

        const variables = {
            input: {
                formId,
                data
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
    }, { formId: currentFormId, data: responseData, backendUrl: world.backendUrl });

    if (response.errors) {
        throw new Error(`GraphQL error submitting response: ${JSON.stringify(response.errors)}`);
    }
}

// Legacy submit response function (text + number only)
async function submitResponse(world: CustomWorld, textValue: string | null, numberValue: number | null) {
    await submitResponseWithDate(world, textValue, numberValue, null);
}

When('I submit response {int} with text {string} and number {int}', async function (
    this: CustomWorld,
    _responseNum: number,
    textValue: string,
    numberValue: number
) {
    // Sync formShortUrl from world object if available
    if (this.formShortUrl && !formShortUrl) {
        formShortUrl = this.formShortUrl;
    }
    await submitResponse(this, textValue, numberValue);
});

When('I submit response {int} with empty text and empty number', async function (
    this: CustomWorld,
    _responseNum: number
) {
    await submitResponse(this, '', null);
});

// Date response submission steps
When('I submit response with text {string} number {int} and date {string}', async function (
    this: CustomWorld,
    textValue: string,
    numberValue: number,
    dateValue: string
) {
    await submitResponseWithDate(this, textValue, numberValue, dateValue);
});

When('I submit response with text {string} number {int} and empty date', async function (
    this: CustomWorld,
    textValue: string,
    numberValue: number
) {
    await submitResponseWithDate(this, textValue, numberValue, null);
});

// Dropdown response submission steps
When('I submit response with text {string} number {int} and dropdown {string}', async function (
    this: CustomWorld,
    textValue: string,
    numberValue: number,
    dropdownValue: string
) {
    await submitResponseWithDropdown(this, textValue, numberValue, dropdownValue);
});

When('I submit response with text {string} number {int} and empty dropdown', async function (
    this: CustomWorld,
    textValue: string,
    numberValue: number
) {
    await submitResponseWithDropdown(this, textValue, numberValue, null);
});

// Helper function to submit response with dropdown value
async function submitResponseWithDropdown(
    world: CustomWorld,
    textValue: string | null,
    numberValue: number | null,
    dropdownValue: string | null
) {
    if (!world.page || !currentFormId) {
        throw new Error('Page or form ID is not initialized');
    }

    const responseData: Record<string, any> = {};
    if (textValue !== null && textValue !== '') {
        responseData['field-text-filter'] = textValue;
    }
    if (numberValue !== null) {
        responseData['field-number-filter'] = numberValue;
    }
    if (dropdownValue !== null && dropdownValue !== '') {
        responseData['field-dropdown-filter'] = dropdownValue;
    }

    const response = await world.page.evaluate(async ({ formId, data, backendUrl }) => {
        const query = `
      mutation SubmitResponse($input: SubmitResponseInput!) {
        submitResponse(input: $input) {
          id
        }
      }
    `;

        const variables = {
            input: {
                formId,
                data
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
    }, { formId: currentFormId, data: responseData, backendUrl: world.backendUrl });

    if (response.errors) {
        throw new Error(`GraphQL error submitting response: ${JSON.stringify(response.errors)}`);
    }
}

// Checkbox response submission steps
When('I submit response with checkbox {string}', async function (
    this: CustomWorld,
    checkboxValues: string
) {
    // checkboxValues is a comma-separated string like "Apple,Cherry"
    const values = checkboxValues.split(',').map(v => v.trim());
    await submitResponseWithCheckbox(this, values);
});

When('I submit response with empty checkbox', async function (
    this: CustomWorld
) {
    await submitResponseWithCheckbox(this, []);
});

// Helper function to submit response with checkbox values (array)
async function submitResponseWithCheckbox(
    world: CustomWorld,
    checkboxValues: string[]
) {
    if (!world.page || !currentFormId) {
        throw new Error('Page or form ID is not initialized');
    }

    const responseData: Record<string, any> = {};
    // Checkbox responses are stored as arrays
    responseData['field-checkbox-filter'] = checkboxValues;

    const response = await world.page.evaluate(async ({ formId, data, backendUrl }) => {
        const query = `
      mutation SubmitResponse($input: SubmitResponseInput!) {
        submitResponse(input: $input) {
          id
        }
      }
    `;

        const variables = {
            input: {
                formId,
                data
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
    }, { formId: currentFormId, data: responseData, backendUrl: world.backendUrl });

    if (response.errors) {
        throw new Error(`GraphQL error submitting checkbox response: ${JSON.stringify(response.errors)}`);
    }
}

// Radio response submission steps
When('I submit response with radio {string}', async function (
    this: CustomWorld,
    radioValue: string
) {
    await submitResponseWithRadio(this, radioValue);
});

When('I submit response with empty radio', async function (
    this: CustomWorld
) {
    await submitResponseWithRadio(this, null);
});

// Helper function to submit response with radio value (single string)
async function submitResponseWithRadio(
    world: CustomWorld,
    radioValue: string | null
) {
    if (!world.page || !currentFormId) {
        throw new Error('Page or form ID is not initialized');
    }

    const responseData: Record<string, any> = {};
    // Radio responses are stored as single strings
    if (radioValue !== null && radioValue !== '') {
        responseData['field-radio-filter'] = radioValue;
    }

    const response = await world.page.evaluate(async ({ formId, data, backendUrl }) => {
        const query = `
      mutation SubmitResponse($input: SubmitResponseInput!) {
        submitResponse(input: $input) {
          id
        }
      }
    `;

        const variables = {
            input: {
                formId,
                data
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
    }, { formId: currentFormId, data: responseData, backendUrl: world.backendUrl });

    if (response.errors) {
        throw new Error(`GraphQL error submitting radio response: ${JSON.stringify(response.errors)}`);
    }
}

// Email response submission steps
When('I submit response with email {string}', async function (
    this: CustomWorld,
    emailValue: string
) {
    await submitResponseWithEmail(this, emailValue);
});

When('I submit response with empty email', async function (
    this: CustomWorld
) {
    await submitResponseWithEmail(this, null);
});

// Helper function to submit response with email value
async function submitResponseWithEmail(
    world: CustomWorld,
    emailValue: string | null
) {
    if (!world.page || !currentFormId) {
        throw new Error('Page or form ID is not initialized');
    }

    const responseData: Record<string, any> = {};
    if (emailValue !== null && emailValue !== '') {
        responseData['field-email-filter'] = emailValue;
    }

    const response = await world.page.evaluate(async ({ formId, data, backendUrl }) => {
        const query = `
      mutation SubmitResponse($input: SubmitResponseInput!) {
        submitResponse(input: $input) {
          id
        }
      }
    `;

        const variables = {
            input: {
                formId,
                data
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
    }, { formId: currentFormId, data: responseData, backendUrl: world.backendUrl });

    if (response.errors) {
        throw new Error(`GraphQL error submitting email response: ${JSON.stringify(response.errors)}`);
    }
}

// Long Text response submission steps
When('I submit response with longtext {string}', async function (
    this: CustomWorld,
    longtextValue: string
) {
    await submitResponseWithLongtext(this, longtextValue);
});

When('I submit response with empty longtext', async function (
    this: CustomWorld
) {
    await submitResponseWithLongtext(this, null);
});

// Helper function to submit response with long text value
async function submitResponseWithLongtext(
    world: CustomWorld,
    longtextValue: string | null
) {
    if (!world.page || !currentFormId) {
        throw new Error('Page or form ID is not initialized');
    }

    const responseData: Record<string, any> = {};
    if (longtextValue !== null && longtextValue !== '') {
        responseData['field-longtext-filter'] = longtextValue;
    }

    const response = await world.page.evaluate(async ({ formId, data, backendUrl }) => {
        const query = `
      mutation SubmitResponse($input: SubmitResponseInput!) {
        submitResponse(input: $input) {
          id
        }
      }
    `;

        const variables = {
            input: {
                formId,
                data
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
    }, { formId: currentFormId, data: responseData, backendUrl: world.backendUrl });

    if (response.errors) {
        throw new Error(`GraphQL error submitting longtext response: ${JSON.stringify(response.errors)}`);
    }
}

When('I navigate to the responses page', async function (this: CustomWorld) {
    if (!this.page || !currentFormId) {
        throw new Error('Page or form ID is not initialized');
    }

    await this.page.goto(`${this.baseUrl}/dashboard/form/${currentFormId}/responses`);
    await this.page.waitForTimeout(2000);

    // Wait for the responses table to load
    const responsesTable = this.page.getByTestId('responses-table');
    await expect(responsesTable).toBeVisible({ timeout: 30_000 });
});

Then('I should see {int} responses in the table', async function (this: CustomWorld, expectedCount: number) {
    if (!this.page) {
        throw new Error('Page is not initialized');
    }

    // Wait for table to stabilize
    await this.page.waitForTimeout(1000);

    // Check the response count in the header or table
    const responseCountText = await this.page.locator('span:has-text("response")').first().textContent();

    if (responseCountText) {
        const match = responseCountText.match(/(\d+)/);
        if (match) {
            const actualCount = parseInt(match[1], 10);
            expect(actualCount).toBe(expectedCount);
            return;
        }
    }

    // Fallback: count table rows
    const tableRows = this.page.locator('[data-testid="responses-table"] tbody tr');
    const count = await tableRows.count();
    expect(count).toBe(expectedCount);
});

When('I open the filter modal', async function (this: CustomWorld) {
    if (!this.page) {
        throw new Error('Page is not initialized');
    }

    const filterButton = this.page.getByTestId('filter-button');
    await expect(filterButton).toBeVisible({ timeout: 10_000 });
    await filterButton.click();

    // Wait for modal to open
    const filterModal = this.page.getByTestId('filter-modal');
    await expect(filterModal).toBeVisible({ timeout: 10_000 });
});

When('I add a filter for field {string} with operator {string} and value {string}', async function (
    this: CustomWorld,
    fieldName: string,
    operator: string,
    value: string
) {
    if (!this.page) {
        throw new Error('Page is not initialized');
    }

    // Click add filter button
    const addFilterButton = this.page.getByTestId('add-filter-button');
    await addFilterButton.click();
    await this.page.waitForTimeout(500);

    // Select field
    const fieldSelect = this.page.getByTestId('filter-field-select').last();
    await fieldSelect.click();
    await this.page.waitForTimeout(300);
    await this.page.getByRole('option', { name: fieldName, exact: true }).click();
    await this.page.waitForTimeout(300);

    // Select operator
    const operatorSelect = this.page.getByTestId('filter-operator-select').last();
    await operatorSelect.click();
    await this.page.waitForTimeout(300);

    // Map operator text to the actual option text
    const operatorMap: Record<string, string> = {
        'contains': 'Contains',
        'does not contain': 'Does not contain',
        'equals': 'Equals',
        'does not equal': 'Does not equal',
        'not equals': 'Not equals',
        'starts with': 'Starts with',
        'ends with': 'Ends with',
        'is empty': 'Is empty',
        'is not empty': 'Is not empty',
        'greater than': 'Greater than',
        'less than': 'Less than',
        'between': 'Between'
    };

    const operatorText = operatorMap[operator.toLowerCase()] || operator;
    await this.page.getByRole('option', { name: operatorText, exact: true }).click();
    await this.page.waitForTimeout(300);

    // Enter value if not empty operator
    if (!operator.toLowerCase().includes('empty')) {
        const valueContainer = this.page.getByTestId('filter-value-container').last();
        const valueInput = valueContainer.locator('input');
        await valueInput.fill(value);
        await this.page.waitForTimeout(300);
    }
});

When('I add a filter for field {string} with operator {string}', async function (
    this: CustomWorld,
    fieldName: string,
    operator: string
) {
    if (!this.page) {
        throw new Error('Page is not initialized');
    }

    // Click add filter button
    const addFilterButton = this.page.getByTestId('add-filter-button');
    await addFilterButton.click();
    await this.page.waitForTimeout(500);

    // Select field
    const fieldSelect = this.page.getByTestId('filter-field-select').last();
    await fieldSelect.click();
    await this.page.waitForTimeout(300);
    await this.page.getByRole('option', { name: fieldName, exact: true }).click();
    await this.page.waitForTimeout(300);

    // Select operator
    const operatorSelect = this.page.getByTestId('filter-operator-select').last();
    await operatorSelect.click();
    await this.page.waitForTimeout(300);

    const operatorMap: Record<string, string> = {
        'contains': 'Contains',
        'equals': 'Equals',
        'not equals': 'Not equals',
        'starts with': 'Starts with',
        'ends with': 'Ends with',
        'is empty': 'Is empty',
        'is not empty': 'Is not empty',
        'greater than': 'Greater than',
        'less than': 'Less than',
        'between': 'Between'
    };

    const operatorText = operatorMap[operator.toLowerCase()] || operator;
    await this.page.getByRole('option', { name: operatorText, exact: true }).click();
    await this.page.waitForTimeout(300);
});

When('I add a filter for field {string} with operator {string} and range {int} to {int}', async function (
    this: CustomWorld,
    fieldName: string,
    operator: string,
    minValue: number,
    maxValue: number
) {
    if (!this.page) {
        throw new Error('Page is not initialized');
    }

    // Click add filter button
    const addFilterButton = this.page.getByTestId('add-filter-button');
    await addFilterButton.click();
    await this.page.waitForTimeout(500);

    // Select field
    const fieldSelect = this.page.getByTestId('filter-field-select').last();
    await fieldSelect.click();
    await this.page.waitForTimeout(300);
    await this.page.getByRole('option', { name: fieldName, exact: true }).click();
    await this.page.waitForTimeout(300);

    // Select operator
    const operatorSelect = this.page.getByTestId('filter-operator-select').last();
    await operatorSelect.click();
    await this.page.waitForTimeout(300);
    await this.page.getByRole('option', { name: 'Between', exact: true }).click();
    await this.page.waitForTimeout(300);

    // Enter min and max values
    const valueContainer = this.page.getByTestId('filter-value-container').last();
    const minInput = valueContainer.locator('input').first();
    const maxInput = valueContainer.locator('input').last();

    await minInput.fill(minValue.toString());
    await this.page.waitForTimeout(200);
    await maxInput.fill(maxValue.toString());
    await this.page.waitForTimeout(300);
});

When('I apply the filters', async function (this: CustomWorld) {
    if (!this.page) {
        throw new Error('Page is not initialized');
    }

    const applyButton = this.page.getByTestId('apply-filters-button');
    await expect(applyButton).toBeEnabled({ timeout: 5_000 });
    await applyButton.click();

    // Wait for modal to close and filters to apply
    await this.page.waitForTimeout(2000);
});

// Date filter step definitions
When('I add a filter for field {string} with operator {string} and date {string}', async function (
    this: CustomWorld,
    fieldName: string,
    operator: string,
    dateValue: string
) {
    if (!this.page) {
        throw new Error('Page is not initialized');
    }

    // Click add filter button
    const addFilterButton = this.page.getByTestId('add-filter-button');
    await addFilterButton.click();
    await this.page.waitForTimeout(500);

    // Select field
    const fieldSelect = this.page.getByTestId('filter-field-select').last();
    await fieldSelect.click();
    await this.page.waitForTimeout(300);
    await this.page.getByRole('option', { name: fieldName, exact: true }).click();
    await this.page.waitForTimeout(300);

    // Select operator
    const operatorSelect = this.page.getByTestId('filter-operator-select').last();
    await operatorSelect.click();
    await this.page.waitForTimeout(300);

    // Map operator text to the actual option text for date fields
    const operatorMap: Record<string, string> = {
        'equals': 'Equals',
        'before': 'Before',
        'after': 'After',
        'between': 'Between',
        'is empty': 'Is empty',
        'is not empty': 'Is not empty'
    };

    const operatorText = operatorMap[operator.toLowerCase()] || operator;
    await this.page.getByRole('option', { name: operatorText, exact: true }).click();
    await this.page.waitForTimeout(300);

    // For date fields, we need to interact with the date picker
    // Find the date input within the value container
    const valueContainer = this.page.getByTestId('filter-value-container').last();

    // Click on the date picker button to open calendar
    const dateButton = valueContainer.locator('button').first();
    await dateButton.click();
    await this.page.waitForTimeout(300);

    // The date picker uses a hidden input - find it and set value directly
    // or use the calendar interface
    const hiddenInput = valueContainer.locator('input[type="hidden"]');
    if (await hiddenInput.count() > 0) {
        await hiddenInput.fill(dateValue);
    } else {
        // Try direct input if available
        const dateInput = valueContainer.locator('input');
        if (await dateInput.count() > 0) {
            await dateInput.fill(dateValue);
        }
    }

    // Close calendar by clicking elsewhere
    await this.page.keyboard.press('Escape');
    await this.page.waitForTimeout(300);
});

When('I add a filter for field {string} with operator {string} and date range {string} to {string}', async function (
    this: CustomWorld,
    fieldName: string,
    operator: string,
    fromDate: string,
    toDate: string
) {
    if (!this.page) {
        throw new Error('Page is not initialized');
    }

    // Click add filter button
    const addFilterButton = this.page.getByTestId('add-filter-button');
    await addFilterButton.click();
    await this.page.waitForTimeout(500);

    // Select field
    const fieldSelect = this.page.getByTestId('filter-field-select').last();
    await fieldSelect.click();
    await this.page.waitForTimeout(300);
    await this.page.getByRole('option', { name: fieldName, exact: true }).click();
    await this.page.waitForTimeout(300);

    // Select operator
    const operatorSelect = this.page.getByTestId('filter-operator-select').last();
    await operatorSelect.click();
    await this.page.waitForTimeout(300);
    await this.page.getByRole('option', { name: 'Between', exact: true }).click();
    await this.page.waitForTimeout(500);

    // For date range, we have two date pickers (from and to)
    // DatePicker component has a hidden input[type=date] for E2E testing
    const valueContainer = this.page.getByTestId('filter-value-container').last();
    const dateInputs = valueContainer.locator('input[type="date"]');

    // Wait for date inputs to be available
    await this.page.waitForTimeout(300);

    // Set "from" date using the first date input
    const fromInput = dateInputs.first();
    await fromInput.fill(fromDate);
    await this.page.waitForTimeout(300);

    // Set "to" date using the second date input
    const toInput = dateInputs.nth(1);
    await toInput.fill(toDate);
    await this.page.waitForTimeout(500);
});

// Step definition for dropdown/select field filter with multi-select options
When('I add a filter for field {string} with operator {string} and options {string}', async function (
    this: CustomWorld,
    fieldName: string,
    operator: string,
    optionsString: string
) {
    if (!this.page) {
        throw new Error('Page is not initialized');
    }

    // Click add filter button
    const addFilterButton = this.page.getByTestId('add-filter-button');
    await addFilterButton.click();
    await this.page.waitForTimeout(500);

    // Select field
    const fieldSelect = this.page.getByTestId('filter-field-select').last();
    await fieldSelect.click();
    await this.page.waitForTimeout(300);
    await this.page.getByRole('option', { name: fieldName, exact: true }).click();
    await this.page.waitForTimeout(300);

    // Select operator
    const operatorSelect = this.page.getByTestId('filter-operator-select').last();
    await operatorSelect.click();
    await this.page.waitForTimeout(300);

    // Map operator text to actual i18n labels (for dropdown, checkbox, radio filters)
    const operatorMap: Record<string, string> = {
        'includes': 'Includes',
        'includes any': 'Includes any',
        'not includes': 'Does not include',
        'does not include any': 'Does not include any',
        'contains': 'Contains',
        'does not contain': 'Does not contain',
        'contains all': 'Contains all',
        'equals': 'Equals',
        'is empty': 'Is empty',
        'is not empty': 'Is not empty'
    };

    const operatorText = operatorMap[operator.toLowerCase()] || operator;
    await this.page.getByRole('option', { name: operatorText, exact: true }).click();
    await this.page.waitForTimeout(500);

    // For dropdown/select IN/NOT_IN filters, we need to check option checkboxes
    // For CONTAINS/NOT_CONTAINS on checkbox fields, we use simple dropdown selection
    const options = optionsString.split(',').map(o => o.trim());

    // Find the value container and click the select trigger to open the dropdown
    const valueContainer = this.page.getByTestId('filter-value-container').last();
    const selectTrigger = valueContainer.locator('button').first();
    await selectTrigger.click();
    await this.page.waitForTimeout(500);

    // Check if this is CONTAINS or NOT_CONTAINS operator (uses simple dropdown, not checkboxes)
    if (operator.toLowerCase() === 'contains' || operator.toLowerCase() === 'does not contain') {
        // For CONTAINS/NOT_CONTAINS, use simple SelectItem selection
        // We only select the first option since it's a single value dropdown
        const optionToSelect = options[0];
        await this.page.getByRole('option', { name: optionToSelect, exact: true }).click();
        await this.page.waitForTimeout(300);
    } else {
        // The SelectContent is rendered as a portal, so labels are NOT inside valueContainer
        // We need to find them globally on the page
        for (const option of options) {
            // Find the label with this option text (rendered in the portal)
            const labelLocator = this.page.locator(`label:has-text("${option}")`);
            if (await labelLocator.count() > 0) {
                await labelLocator.first().click();
                await this.page.waitForTimeout(200);
            }
        }

        // Close the dropdown by pressing Escape
        await this.page.keyboard.press('Escape');
        await this.page.waitForTimeout(300);
    }
});
