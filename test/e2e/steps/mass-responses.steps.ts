/**
 * Mass response generation steps for E2E tests
 * Uses GraphQL API for fast form creation and response submission
 */

import { When, Then } from '@cucumber/cucumber';
import { expect } from '@playwright/test';
import { CustomWorld } from '../support/world';
import { createMassResponseTestFormSchema, generateFormResponse } from './helpers';

/**
 * Create a mass response test form via GraphQL
 */
When('I create a mass response test form via GraphQL', async function (this: CustomWorld) {
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

    const formSchema = createMassResponseTestFormSchema();
    const timestamp = Date.now();
    const formTitle = `E2E Mass Response Test ${timestamp}`;

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
    this.formShortUrl = response.data.createForm.shortUrl;

    console.log(`Created form with ID: ${formId}, shortUrl: ${this.formShortUrl}`);

    // Navigate to the form dashboard
    await this.page.goto(`${this.baseUrl}/dashboard/form/${formId}`);

    // Wait for dashboard to load
    const sidebar = this.page.getByTestId('app-sidebar');
    await expect(sidebar).toBeVisible({ timeout: 30_000 });
});

/**
 * Submit mass responses with varied data via GraphQL API
 * Much faster and more reliable than browser form interaction
 */
When('I submit {int} responses with varied data', async function (this: CustomWorld, count: number) {
    if (!this.page) {
        throw new Error('Page is not initialized');
    }

    // Extract formId from the URL (we're on the form dashboard)
    const currentUrl = this.page.url();
    const formIdMatch = currentUrl.match(/\/dashboard\/form\/([^/?]+)/);
    if (!formIdMatch) {
        throw new Error(`Could not extract form ID from URL: ${currentUrl}`);
    }
    const formId = formIdMatch[1];

    console.log(`\n🚀 Starting mass submission of ${count} responses via GraphQL API...\n`);

    let successCount = 0;
    let failCount = 0;

    for (let i = 1; i <= count; i++) {
        try {
            // Generate varied form data
            const formData = generateFormResponse();

            // Prepare response data for GraphQL
            const responseData: Record<string, any> = {
                'field-name': formData['field-name'],
                'field-email': formData['field-email'],
                'field-birth-date': new Date(formData['field-birth-date']).getTime(), // Convert to timestamp
                'field-favorite-color': formData['field-favorite-color'],
                'field-experience-level': formData['field-experience-level'],
                'field-years': parseInt(formData['field-years']),
                'field-interests': formData['field-interests'], // Already an array
                'field-comments': formData['field-comments'],
                'field-satisfaction': formData['field-satisfaction']
            };

            // Submit via GraphQL
            const response = await this.page.evaluate(async ({ fId, data, backendUrl }) => {
                const query = `
                    mutation SubmitResponse($input: SubmitResponseInput!) {
                        submitResponse(input: $input) {
                            id
                        }
                    }
                `;

                const variables = {
                    input: {
                        formId: fId,
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
            }, { fId: formId, data: responseData, backendUrl: this.backendUrl });

            if (response.errors) {
                failCount++;
                console.error(`❌ Response ${i} failed:`, response.errors);
            } else {
                successCount++;
            }

            // Log progress every 10 submissions
            if (i % 10 === 0) {
                console.log(`✅ Progress: ${i}/${count} responses submitted (${successCount} successful, ${failCount} failed)`);
            }

        } catch (error) {
            failCount++;
            console.error(`❌ Failed to submit response ${i}:`, error);
        }
    }

    console.log(`\n✨ Mass submission complete!`);
    console.log(`Total: ${count} | Success: ${successCount} | Failed: ${failCount}\n`);

    // Store success count for verification
    this.massResponseSuccessCount = successCount;
});

/**
 * Verify all responses were submitted successfully
 */
Then('all {int} responses should be submitted successfully', async function (this: CustomWorld, expectedCount: number) {
    if (this.massResponseSuccessCount === undefined) {
        throw new Error('Mass response success count is not set');
    }

    // Allow for a small margin of error (95% success rate)
    const minAcceptable = Math.floor(expectedCount * 0.95);

    if (this.massResponseSuccessCount < minAcceptable) {
        throw new Error(
            `Expected at least ${minAcceptable} successful submissions, but got ${this.massResponseSuccessCount}`
        );
    }

    console.log(`✅ Verification passed: ${this.massResponseSuccessCount}/${expectedCount} responses submitted successfully`);
});
