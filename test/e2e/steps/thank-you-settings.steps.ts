/**
 * Thank You Page settings steps for E2E tests
 * Handles configuration and verification of custom thank you messages
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

    // Navigate to the form dashboard
    await this.page.goto(`${this.baseUrl}/dashboard/form/${formId}`);

    // Wait for dashboard to load
    const sidebar = this.page.getByTestId('app-sidebar');
    await expect(sidebar).toBeVisible({ timeout: 30_000 });
});

/**
 * Click on the thank you section in settings sidebar
 */
When('I click on the thank you section', async function (this: CustomWorld) {
    if (!this.page) {
        throw new Error('Page is not initialized');
    }

    const thankYouButton = this.page.getByTestId('settings-section-thank-you');
    await expect(thankYouButton).toBeVisible({ timeout: 10_000 });
    await thankYouButton.click();

    // Wait for the section to load
    await this.page.waitForTimeout(1000);
});

/**
 * Enable the custom thank you message
 */
When('I enable the custom thank you message', async function (this: CustomWorld) {
    if (!this.page) {
        throw new Error('Page is not initialized');
    }

    const checkbox = this.page.getByTestId('thank-you-enabled-checkbox');
    await expect(checkbox).toBeVisible({ timeout: 10_000 });

    // Check if already enabled
    const isChecked = await checkbox.isChecked();
    if (!isChecked) {
        await checkbox.click();
    }

    // Wait for the message editor to appear
    const messageEditor = this.page.getByTestId('thank-you-message-editor');
    await expect(messageEditor).toBeVisible({ timeout: 5_000 });
});

/**
 * Set the custom thank you message
 */
When('I set the custom thank you message to {string}', async function (this: CustomWorld, message: string) {
    if (!this.page) {
        throw new Error('Page is not initialized');
    }

    const messageEditor = this.page.getByTestId('thank-you-message-editor');
    await expect(messageEditor).toBeVisible({ timeout: 5_000 });

    // The RichTextEditor uses contenteditable, so we need to click and type
    // Find the contenteditable element inside the editor
    const contentEditable = messageEditor.locator('[contenteditable="true"]');
    await expect(contentEditable).toBeVisible({ timeout: 5_000 });

    // Clear existing content and type new message
    await contentEditable.click();
    await contentEditable.fill('');
    await this.page.keyboard.type(message);

    // Wait for the message to be set
    await this.page.waitForTimeout(500);
});

/**
 * Save the thank you settings
 */
When('I save the thank you settings', async function (this: CustomWorld) {
    if (!this.page) {
        throw new Error('Page is not initialized');
    }

    const saveButton = this.page.getByTestId('save-thank-you-settings-button');
    await expect(saveButton).toBeVisible({ timeout: 10_000 });
    await saveButton.click();

    // Wait for save to complete
    await this.page.waitForTimeout(2000);
});

/**
 * Verify thank you settings are saved successfully
 */
Then('the thank you settings should be saved successfully', async function (this: CustomWorld) {
    if (!this.page) {
        throw new Error('Page is not initialized');
    }

    // Wait for save to complete and verify checkbox is still checked
    await this.page.waitForTimeout(1000);

    const checkbox = this.page.getByTestId('thank-you-enabled-checkbox');
    const isChecked = await checkbox.isChecked();

    if (!isChecked) {
        throw new Error('Thank you settings were not saved - checkbox is not checked');
    }
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
 * Verify the default thank you message is displayed
 */
Then('I should see the default thank you message', async function (this: CustomWorld) {
    if (!this.viewerPage) {
        throw new Error('Viewer page is not initialized');
    }

    // Look for the thank you display element
    const thankYouDisplay = this.viewerPage.getByTestId('thank-you-display');
    await expect(thankYouDisplay).toBeVisible({ timeout: 15_000 });

    // Verify the default "Success!" title is displayed
    const defaultTitle = this.viewerPage.getByTestId('thank-you-default-title');
    await expect(defaultTitle).toBeVisible({ timeout: 5_000 });
    await expect(defaultTitle).toHaveText('Success!');
});

/**
 * Verify the custom thank you message is displayed
 */
Then('I should see the custom thank you message', async function (this: CustomWorld) {
    if (!this.viewerPage) {
        throw new Error('Viewer page is not initialized');
    }

    // Look for the thank you display element
    const thankYouDisplay = this.viewerPage.getByTestId('thank-you-display');
    await expect(thankYouDisplay).toBeVisible({ timeout: 15_000 });

    // Verify the custom message container is displayed (not the default title)
    const customMessage = this.viewerPage.getByTestId('thank-you-custom-message');
    await expect(customMessage).toBeVisible({ timeout: 5_000 });

    // Verify the message contains our custom text
    const messageText = await customMessage.textContent();
    if (!messageText?.includes('Thank you for your feedback')) {
        throw new Error(`Expected custom message but got: ${messageText}`);
    }
});

/**
 * Add a field mention to the thank you message
 * This types @ to trigger the mention picker and selects the feedback field
 */
When('I add a field mention to the thank you message', async function (this: CustomWorld) {
    if (!this.page) {
        throw new Error('Page is not initialized');
    }

    const messageEditor = this.page.getByTestId('thank-you-message-editor');
    await expect(messageEditor).toBeVisible({ timeout: 5_000 });

    // Find the contenteditable element inside the editor
    const contentEditable = messageEditor.locator('[contenteditable="true"]');
    await expect(contentEditable).toBeVisible({ timeout: 5_000 });

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

    console.log(`✓ Field substitution verified: Found "${expectedValue}" in thank you message`);
});
