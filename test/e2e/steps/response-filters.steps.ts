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

// Submit response helper function
async function submitResponse(world: CustomWorld, textValue: string | null, numberValue: number | null) {
    if (!world.page || !currentFormId) {
        throw new Error('Page or form ID is not initialized');
    }

    // Submit via GraphQL API directly for speed
    const responseData: Record<string, any> = {};
    if (textValue !== null) {
        responseData['field-text-filter'] = textValue;
    }
    if (numberValue !== null) {
        responseData['field-number-filter'] = numberValue;
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
    await this.page.locator(`[role="option"]:has-text("${fieldName}")`).click();
    await this.page.waitForTimeout(300);

    // Select operator
    const operatorSelect = this.page.getByTestId('filter-operator-select').last();
    await operatorSelect.click();
    await this.page.waitForTimeout(300);

    // Map operator text to the actual option text
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
    await this.page.locator(`[role="option"]:has-text("${operatorText}")`).click();
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
    await this.page.locator(`[role="option"]:has-text("${fieldName}")`).click();
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
    await this.page.locator(`[role="option"]:has-text("${operatorText}")`).click();
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
    await this.page.locator(`[role="option"]:has-text("${fieldName}")`).click();
    await this.page.waitForTimeout(300);

    // Select operator
    const operatorSelect = this.page.getByTestId('filter-operator-select').last();
    await operatorSelect.click();
    await this.page.waitForTimeout(300);
    await this.page.locator(`[role="option"]:has-text("Between")`).click();
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

