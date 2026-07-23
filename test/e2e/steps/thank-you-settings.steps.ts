/**
 * Thank You screen steps for E2E tests.
 *
 * Thank-you content moved from a Settings-page section (and, briefly, a builder
 * "Finish" tab) onto `FormLayout.thankYouContent` — edited live inside the
 * builder's Layout tab via the intro/pages/thankYou screen toggle. It's rendered
 * by the shared `ThankYouScreen` component (packages/ui/src/layouts/shared),
 * reused by every layout (L1-L9) and by the public form-viewer post-submission.
 * See epic #170.
 */

import { When, Then } from '@cucumber/cucumber';
import { expect, type Locator } from '@playwright/test';
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
 * Switch the Layout tab's canvas (screen preview toggle) to the thank-you screen.
 */
When('I switch the layout canvas to the thank you screen', async function (this: CustomWorld) {
    if (!this.page) {
        throw new Error('Page is not initialized');
    }

    const toggle = this.page.getByTestId('layout-screen-toggle-thankYou');
    await expect(toggle).toBeVisible({ timeout: 10_000 });
    await toggle.click();

    const thankYouDisplay = this.page.getByTestId('thank-you-display');
    await expect(thankYouDisplay).toBeVisible({ timeout: 10_000 });
});

/**
 * Click into edit mode on the thank-you screen (BUILDER mode only). Scoped under
 * `thank-you-display` since the intro screen's editor uses the same "Edit Mode"
 * button text — only one of the two screens is ever mounted at a time, but
 * scoping keeps the locator unambiguous regardless.
 */
async function enterThankYouEditMode(
    world: CustomWorld
): Promise<{ display: Locator; contentEditable: Locator }> {
    if (!world.page) {
        throw new Error('Page is not initialized');
    }

    const display = world.page.getByTestId('thank-you-display');
    await expect(display).toBeVisible({ timeout: 10_000 });

    const editModeButton = display.getByRole('button', { name: 'Edit Mode' });
    await expect(editModeButton).toBeVisible({ timeout: 10_000 });
    await editModeButton.click();

    const contentEditable = display.getByTestId('thank-you-message').locator('[contenteditable="true"]');
    await expect(contentEditable).toBeVisible({ timeout: 5_000 });

    return { display, contentEditable };
}

/**
 * Save the currently edited thank-you message and wait for the editor to drop
 * back out of edit mode (the component's own save-completion signal).
 */
async function saveThankYouEdit(display: Locator): Promise<void> {
    const saveButton = display.getByRole('button', { name: 'Save' });
    await expect(saveButton).toBeVisible({ timeout: 5_000 });
    await saveButton.click();

    // Save exits edit mode synchronously — "Edit Mode" reappearing confirms the
    // *local* store update has been applied, not that it reached the Hocuspocus
    // server yet. Give the WebSocket flush a moment to land before any caller
    // proceeds to a page reload (which would otherwise race the persisted
    // document and intermittently read back the pre-edit content).
    await expect(display.getByRole('button', { name: 'Edit Mode' })).toBeVisible({ timeout: 10_000 });
    await display.page().waitForTimeout(800);
}

/**
 * Replace the thank-you message content entirely with the given text and save.
 */
When('I edit the thank you message to {string}', async function (this: CustomWorld, message: string) {
    if (!this.page) {
        throw new Error('Page is not initialized');
    }

    const { display, contentEditable } = await enterThankYouEditMode(this);

    await contentEditable.click();
    await contentEditable.fill('');
    await this.page.keyboard.type(message, { delay: 20 });
    await this.page.waitForTimeout(300);

    await saveThankYouEdit(display);
});

/**
 * Verify the thank-you screen (in the builder's Layout tab canvas) currently
 * shows the given message — used both right after saving and after a reload.
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

    const message = this.page.getByTestId('thank-you-message');
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
 * Add a field mention to the thank you message (in the builder's Layout tab
 * thank-you screen editor) and save.
 * This types @ to trigger the mention picker and selects the feedback field.
 */
When('I add a field mention to the thank you message', async function (this: CustomWorld) {
    if (!this.page) {
        throw new Error('Page is not initialized');
    }

    const { display, contentEditable } = await enterThankYouEditMode(this);

    // Click on the editor to focus it
    await contentEditable.click();
    await this.page.waitForTimeout(300);

    // Clear existing content - triple-click to select all (cross-platform)
    await contentEditable.click({ clickCount: 3 });
    await this.page.keyboard.press('Backspace');
    await this.page.waitForTimeout(200);

    // Type the message prefix
    await this.page.keyboard.type('Thank you ', { delay: 50 });

    // Type @ to trigger the mention picker
    await this.page.keyboard.type('@', { delay: 50 });

    // Wait for the mention picker dropdown to appear
    await this.page.waitForTimeout(1000);

    // Try to find and click the mention option - look for various selectors
    // The Lexical mention plugin usually creates a floating menu with options
    let mentionSelected = false;

    // Try clicking on a listbox option
    const listboxOption = this.page.locator('[role="listbox"] [role="option"]').first();
    let optionVisible = await listboxOption.isVisible({ timeout: 1000 }).catch(() => false);
    if (optionVisible) {
        await listboxOption.click();
        mentionSelected = true;
        console.log('Selected mention from listbox');
    }

    // Try menu item if listbox didn't work
    if (!mentionSelected) {
        const menuOption = this.page.locator('[role="menu"] [role="menuitem"]').first();
        optionVisible = await menuOption.isVisible({ timeout: 500 }).catch(() => false);
        if (optionVisible) {
            await menuOption.click();
            mentionSelected = true;
            console.log('Selected mention from menu');
        }
    }

    // Try simple option selector
    if (!mentionSelected) {
        const simpleOption = this.page.locator('[role="option"]').first();
        optionVisible = await simpleOption.isVisible({ timeout: 500 }).catch(() => false);
        if (optionVisible) {
            await simpleOption.click();
            mentionSelected = true;
            console.log('Selected mention from option');
        }
    }

    // Try finding any clickable dropdown that appeared after @
    if (!mentionSelected) {
        const dropdownItem = this.page.locator('.mention-menu-item, .mention-option, [data-mention-option]').first();
        optionVisible = await dropdownItem.isVisible({ timeout: 500 }).catch(() => false);
        if (optionVisible) {
            await dropdownItem.click();
            mentionSelected = true;
            console.log('Selected mention from dropdown item');
        }
    }

    // If no mention picker appeared, use keyboard to select (Enter or Tab might work)
    if (!mentionSelected) {
        console.log('No mention picker found, trying keyboard selection');
        // Try pressing Enter to select the first option if dropdown is showing
        await this.page.keyboard.press('Enter');
        await this.page.waitForTimeout(300);
    }

    // Type the rest of the message
    await this.page.keyboard.type(' for your submission!', { delay: 30 });

    await this.page.waitForTimeout(500);

    await saveThankYouEdit(display);
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
