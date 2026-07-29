/**
 * Thank You screen steps for E2E tests.
 *
 * Thank-you content moved from a Settings-page section (and, briefly, a builder
 * "Finish" tab) onto `FormLayout.thankYouContent`. It's rendered by the shared
 * `ThankYouScreen` component (packages/ui/src/layouts/shared), reused by every
 * layout (L1-L9) and by the public form-viewer post-submission. Editing happens
 * via the journey rail's Thank You card + Ending panel (see journey-rail.steps.ts
 * for those steps) — see epic #170 and ticket #229.
 */

import { When, Then } from '@cucumber/cucumber';
import { expect } from '@playwright/test';
import { CustomWorld } from '../support/world';

/**
 * Create form schema for thank you page testing
 */
function createFormSchemaForThankYou() {
    return {
        layout: {
            theme: "light",
            textColor: "#000000",
            spacing: "normal",
            code: "L9",
            content: "<h1>Thank You Test Form</h1>",
            customBackGroundColor: "#ffffff",
            backgroundImageKey: "",
            pageMode: "multipage",
            isCustomBackgroundColorEnabled: false
        },
        pages: [
            {
                id: "page-1",
                title: "Thank You Test Page",
                fields: [
                    {
                        id: "field-feedback",
                        type: "text_input_field",
                        label: "Your Feedback",
                        defaultValue: "",
                        prefix: "",
                        hint: "Enter your feedback",
                        placeholder: "Enter your feedback",
                        validation: {
                            required: true,
                            type: "text_field_validation"
                        }
                    }
                ]
            }
        ]
    };
}

/**
 * Create a form via GraphQL for thank you page testing
 */
When('I create a form via GraphQL for thank you page testing', async function (this: CustomWorld) {
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

    const formSchema = createFormSchemaForThankYou();
    const timestamp = Date.now();
    const formTitle = `E2E Thank You Test ${timestamp}`;

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
    this.currentFormId = formId;

    // Navigate to the form dashboard
    await this.page.goto(`${this.baseUrl}/dashboard/form/${formId}`);

    // Wait for dashboard to load
    const sidebar = this.page.getByTestId('app-sidebar');
    await expect(sidebar).toBeVisible({ timeout: 30_000 });
});

/**
 * Navigate from the form dashboard into the collaborative builder
 */
When('I navigate to the form builder', async function (this: CustomWorld) {
    if (!this.page) {
        throw new Error('Page is not initialized');
    }

    const builderButton = this.page.getByTestId('quick-action-builder');
    await expect(builderButton).toBeVisible({ timeout: 10_000 });
    await builderButton.click();

    // Wait for the builder shell to load
    const collaborativeBuilder = this.page.getByTestId('collaborative-form-builder');
    await expect(collaborativeBuilder).toBeVisible({ timeout: 30_000 });
});

/**
 * Navigate from the builder back to the form dashboard
 */
When('I navigate from the builder to the form dashboard', async function (this: CustomWorld) {
    if (!this.page) {
        throw new Error('Page is not initialized');
    }

    // Extract form ID from current URL (format: /dashboard/form/{formId}/builder/layout)
    const currentUrl = this.page.url();
    const formIdMatch = currentUrl.match(/\/dashboard\/form\/([^/]+)/);

    if (!formIdMatch) {
        throw new Error(`Could not extract form ID from URL: ${currentUrl}`);
    }

    const formId = formIdMatch[1];

    await this.page.goto(`${this.baseUrl}/dashboard/form/${formId}`);

    const sidebar = this.page.getByTestId('app-sidebar');
    await expect(sidebar).toBeVisible({ timeout: 30_000 });

    await this.page.waitForTimeout(2000);
});

/**
 * Reload the current builder page in place (same URL/tab) — used to verify that
 * layout edits (e.g. thankYouContent) persisted through Y.js/Hocuspocus rather
 * than only existing in local/optimistic store state.
 */
When('I reload the builder page', async function (this: CustomWorld) {
    if (!this.page) {
        throw new Error('Page is not initialized');
    }

    await this.page.reload();

    const collaborativeBuilder = this.page.getByTestId('collaborative-form-builder');
    await expect(collaborativeBuilder).toBeVisible({ timeout: 30_000 });

    // Give the Y.js provider a moment to reconnect and hydrate the store from
    // the persisted document before interacting with the canvas again.
    await this.page.waitForTimeout(1500);
});

/**
 * Verify the thank-you screen (in the builder's canvas) currently shows the
 * given message — used both right after saving via the Ending panel and after
 * a reload (see journey-rail.steps.ts for the Ending panel edit/save steps
 * that drive this canvas).
 */
Then('the thank you screen should show the message {string}', async function (this: CustomWorld, expectedMessage: string) {
    if (!this.page) {
        throw new Error('Page is not initialized');
    }

    const display = this.page.getByTestId('thank-you-display');
    await expect(display).toBeVisible({ timeout: 10_000 });

    // Not mid-edit — "Edit Mode" (not "Save"/"Cancel") should be showing.
    await expect(display.getByRole('button', { name: 'Edit Mode' })).toBeVisible({ timeout: 10_000 });

    const message = display.getByTestId('thank-you-message');
    await expect(message).toContainText(expectedMessage, { timeout: 10_000 });
});

// "I open the preview tab" is already defined in conditional-logic.steps.ts —
// reused as-is here (clicks `tab-preview`); do not redefine it in this file.

/**
 * Contextual Preview (#175): switch between the "Form" and "Finish" preview
 * steps in the Preview tab's step toggle. The "Finish" step renders the real
 * FormRenderer with screenOverride="thankYou" (no separate preview component).
 */
When('I switch the preview step to {string}', async function (this: CustomWorld, step: string) {
    if (!this.page) {
        throw new Error('Page is not initialized');
    }

    const normalizedStep = step.trim().toLowerCase();
    if (normalizedStep !== 'form' && normalizedStep !== 'finish') {
        throw new Error(`Unsupported preview step: ${step}`);
    }
    const toggle = this.page.getByTestId(`preview-step-${normalizedStep}`);
    await expect(toggle).toBeVisible({ timeout: 10_000 });
    await toggle.click();
});

Then('I should see the thank you message {string} in the preview step', async function (this: CustomWorld, expectedMessage: string) {
    if (!this.page) {
        throw new Error('Page is not initialized');
    }

    // Scoped to the preview overlay — the Content tab's canvas behind it can
    // also be showing the Thank You screen (rail selection is independent of
    // the preview overlay), which would otherwise make `thank-you-message` an
    // ambiguous, strict-mode-violating locator.
    const message = this.page.getByTestId('preview-overlay').getByTestId('thank-you-message');
    await expect(message).toBeVisible({ timeout: 10_000 });
    await expect(message).toContainText(expectedMessage);
});

Then('I should see the form in the preview step', async function (this: CustomWorld) {
    if (!this.page) {
        throw new Error('Page is not initialized');
    }

    const previewForm = this.page.locator('.preview-mode');
    await expect(previewForm).toBeVisible({ timeout: 10_000 });
});

/**
 * Fill and submit the thank you test form
 */
When('I fill and submit the thank you test form', async function (this: CustomWorld) {
    if (!this.viewerPage) {
        throw new Error('Viewer page is not initialized');
    }

    // Wait for form to be ready
    await this.viewerPage.waitForTimeout(2000);

    // Try to find any text input on the page
    let feedbackInput = this.viewerPage.locator('input[name="field-feedback"]');
    let inputVisible = await feedbackInput.isVisible().catch(() => false);

    if (!inputVisible) {
        feedbackInput = this.viewerPage.locator('input[type="text"]').first();
        inputVisible = await feedbackInput.isVisible({ timeout: 5000 }).catch(() => false);
    }

    if (!inputVisible) {
        throw new Error('Could not find any text input on the form viewer page');
    }

    await feedbackInput.fill('Test Feedback');

    // Wait for input to register
    await this.viewerPage.waitForTimeout(500);

    // Click submit button
    const submitButton = this.viewerPage.getByTestId('viewer-submit-button');
    await expect(submitButton).toBeVisible({ timeout: 10_000 });
    await submitButton.click();

    // Wait for submission to complete
    await this.viewerPage.waitForTimeout(3000);
});

/**
 * Verify the default thank you message is displayed (DEFAULT_THANK_YOU_CONTENT
 * from @dculus/types: '<h1>Thank you!</h1><p>Your response has been submitted.</p>')
 */
Then('I should see the default thank you message', async function (this: CustomWorld) {
    if (!this.viewerPage) {
        throw new Error('Viewer page is not initialized');
    }

    const thankYouDisplay = this.viewerPage.getByTestId('thank-you-display');
    await expect(thankYouDisplay).toBeVisible({ timeout: 15_000 });

    const message = this.viewerPage.getByTestId('thank-you-message');
    await expect(message).toContainText('Thank you!');
    await expect(message).toContainText('Your response has been submitted.');
});

/**
 * Verify a specific thank you message is displayed in the public form viewer
 * after submission (replaces the old default-vs-custom testid split — both
 * now render through the same `thank-you-message` element).
 */
Then('I should see the thank you message {string} in the form viewer', async function (this: CustomWorld, expectedMessage: string) {
    if (!this.viewerPage) {
        throw new Error('Viewer page is not initialized');
    }

    const thankYouDisplay = this.viewerPage.getByTestId('thank-you-display');
    await expect(thankYouDisplay).toBeVisible({ timeout: 15_000 });

    const message = this.viewerPage.getByTestId('thank-you-message');
    await expect(message).toContainText(expectedMessage);
});

/**
 * Fill the feedback field with a specific value
 */
When('I fill the feedback field with {string}', async function (this: CustomWorld, value: string) {
    if (!this.viewerPage) {
        throw new Error('Viewer page is not initialized');
    }

    // Wait for form to be ready
    await this.viewerPage.waitForTimeout(2000);

    // Try to find the feedback input
    let feedbackInput = this.viewerPage.locator('input[name="field-feedback"]');
    let inputVisible = await feedbackInput.isVisible().catch(() => false);

    if (!inputVisible) {
        feedbackInput = this.viewerPage.locator('input[type="text"]').first();
        inputVisible = await feedbackInput.isVisible({ timeout: 5000 }).catch(() => false);
    }

    if (!inputVisible) {
        throw new Error('Could not find feedback input on the form viewer page');
    }

    await feedbackInput.fill(value);
    await this.viewerPage.waitForTimeout(500);
});

/**
 * Submit the thank you test form (without filling - assumes already filled)
 */
When('I submit the thank you test form', async function (this: CustomWorld) {
    if (!this.viewerPage) {
        throw new Error('Viewer page is not initialized');
    }

    // Click submit button
    const submitButton = this.viewerPage.getByTestId('viewer-submit-button');
    await expect(submitButton).toBeVisible({ timeout: 10_000 });
    await submitButton.click();

    // Wait for submission to complete
    await this.viewerPage.waitForTimeout(3000);
});

/**
 * Verify the submitted value appears in the thank you message (field substitution)
 */
Then('I should see the submitted value {string} in the thank you message', async function (this: CustomWorld, expectedValue: string) {
    if (!this.viewerPage) {
        throw new Error('Viewer page is not initialized');
    }

    // Look for the thank you display element
    const thankYouDisplay = this.viewerPage.getByTestId('thank-you-display');
    await expect(thankYouDisplay).toBeVisible({ timeout: 15_000 });

    // Get the text content of the entire thank you display
    const displayText = await thankYouDisplay.textContent();

    if (!displayText?.includes(expectedValue)) {
        throw new Error(`Expected to find "${expectedValue}" in thank you message, but got: "${displayText}"`);
    }

    console.log(`Field substitution verified: Found "${expectedValue}" in thank you message`);
});
