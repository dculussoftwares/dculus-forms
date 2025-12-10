/**
 * Maximum responses limit steps for E2E tests
 * Handles form configuration for max responses and verification of limit enforcement
 */

import { When, Then } from '@cucumber/cucumber';
import { expect } from '@playwright/test';
import { CustomWorld } from '../support/world';

/**
 * Create form schema with a simple field for max responses testing
 */
function createFormSchemaForMaxResponses() {
    return {
        layout: {
            theme: "light",
            textColor: "#000000",
            spacing: "normal",
            code: "L9",
            content: "<h1>Max Responses Test Form</h1>",
            customBackGroundColor: "#ffffff",
            backgroundImageKey: "",
            pageMode: "multipage",
            isCustomBackgroundColorEnabled: false
        },
        pages: [
            {
                id: "page-1",
                title: "Max Responses Test Page",
                fields: [
                    {
                        id: "field-name",
                        type: "text_input_field",
                        label: "Your Name",
                        defaultValue: "",
                        prefix: "",
                        hint: "Enter your name",
                        placeholder: "Enter your name",
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
 * Create a form via GraphQL with max responses settings
 */
When('I create a form via GraphQL with max responses settings', async function (this: CustomWorld) {
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

    const formSchema = createFormSchemaForMaxResponses();
    const timestamp = Date.now();
    const formTitle = `E2E Max Responses Test ${timestamp}`;

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
 * Navigate to form settings page
 */
When('I navigate to the form settings page', async function (this: CustomWorld) {
    if (!this.page) {
        throw new Error('Page is not initialized');
    }

    const settingsButton = this.page.getByTestId('quick-action-settings');
    await expect(settingsButton).toBeVisible({ timeout: 10_000 });
    await settingsButton.click();

    // Wait for settings page to load
    await this.page.waitForTimeout(2000);
});

/**
 * Click on the submission limits section
 */
When('I click on the submission limits section', async function (this: CustomWorld) {
    if (!this.page) {
        throw new Error('Page is not initialized');
    }

    const submissionLimitsButton = this.page.getByTestId('settings-section-submission-limits');
    await expect(submissionLimitsButton).toBeVisible({ timeout: 10_000 });
    await submissionLimitsButton.click();

    // Wait for the section to load
    await this.page.waitForTimeout(1000);
});

/**
 * Enable the maximum responses limit
 */
When('I enable the maximum responses limit', async function (this: CustomWorld) {
    if (!this.page) {
        throw new Error('Page is not initialized');
    }

    const checkbox = this.page.getByTestId('max-responses-enabled-checkbox');
    await expect(checkbox).toBeVisible({ timeout: 10_000 });

    // Check if already enabled
    const isChecked = await checkbox.isChecked();
    if (!isChecked) {
        await checkbox.click();
    }

    // Wait for the limit input to appear
    const limitInput = this.page.getByTestId('max-responses-limit-input');
    await expect(limitInput).toBeVisible({ timeout: 5_000 });
});

/**
 * Set the maximum responses limit to a specific value
 */
When('I set the maximum responses limit to {int}', async function (this: CustomWorld, limit: number) {
    if (!this.page) {
        throw new Error('Page is not initialized');
    }

    const limitInput = this.page.getByTestId('max-responses-limit-input');
    await expect(limitInput).toBeVisible({ timeout: 5_000 });

    // Clear and fill the input
    await limitInput.fill(limit.toString());

    // Blur to trigger any validation
    await limitInput.blur();
    await this.page.waitForTimeout(500);
});

/**
 * Save the submission limits settings
 */
When('I save the submission limits settings', async function (this: CustomWorld) {
    if (!this.page) {
        throw new Error('Page is not initialized');
    }

    const saveButton = this.page.getByTestId('save-submission-limits-button');
    await expect(saveButton).toBeVisible({ timeout: 10_000 });
    await saveButton.click();

    // Wait for save to complete
    await this.page.waitForTimeout(2000);
});

/**
 * Verify submission limits are saved successfully
 */
Then('the submission limits should be saved successfully', async function (this: CustomWorld) {
    if (!this.page) {
        throw new Error('Page is not initialized');
    }

    // Wait for save to complete
    await this.page.waitForTimeout(1000);

    // Check that at least one of the limits is enabled
    const maxResponsesCheckbox = this.page.getByTestId('max-responses-enabled-checkbox');
    const timeWindowCheckbox = this.page.getByTestId('time-window-enabled-checkbox');

    // Get checked status of both checkboxes
    const maxResponsesChecked = await maxResponsesCheckbox.isChecked().catch(() => false);
    const timeWindowChecked = await timeWindowCheckbox.isChecked().catch(() => false);

    // At least one should be checked after saving
    if (!maxResponsesChecked && !timeWindowChecked) {
        throw new Error('Neither max responses nor time window is enabled after save');
    }
});

/**
 * Navigate from settings page to form dashboard
 */
When('I navigate from settings to the form dashboard', async function (this: CustomWorld) {
    if (!this.page) {
        throw new Error('Page is not initialized');
    }

    // Extract form ID from current URL (format: /dashboard/form/{formId}/settings)
    const currentUrl = this.page.url();
    const formIdMatch = currentUrl.match(/\/dashboard\/form\/([^/]+)/);

    if (!formIdMatch) {
        throw new Error(`Could not extract form ID from URL: ${currentUrl}`);
    }

    const formId = formIdMatch[1];

    // Navigate directly to the form dashboard
    await this.page.goto(`${this.baseUrl}/dashboard/form/${formId}`);

    // Wait for form dashboard to load
    const sidebar = this.page.getByTestId('app-sidebar');
    await expect(sidebar).toBeVisible({ timeout: 30_000 });

    // Wait for publish button to be visible (indicates dashboard is fully loaded)
    await this.page.waitForTimeout(2000);
});

/**
 * Click the CTA button to start the form
 */
When('I click the CTA button to start the form', async function (this: CustomWorld) {
    if (!this.viewerPage) {
        throw new Error('Viewer page is not initialized');
    }

    // Ensure the form renderer is visible first (React content loaded)
    const formRenderer = this.viewerPage.getByTestId('form-viewer-renderer');
    await expect(formRenderer).toBeVisible({ timeout: 30_000 });

    // Wait additional time for form content to render
    await this.viewerPage.waitForTimeout(3000);

    // Check if CTA button exists - some layouts show pages directly
    const ctaButton = this.viewerPage.getByTestId('viewer-cta-button');
    const ctaVisible = await ctaButton.isVisible().catch(() => false);

    if (ctaVisible) {
        console.log('CTA button found, clicking it');
        await ctaButton.click();
        // Wait for form to load after clicking CTA
        await this.viewerPage.waitForTimeout(1000);
    } else {
        console.log('No CTA button found, form fields should already be visible');
    }
});

/**
 * Fill and submit the max responses test form
 */
When('I fill and submit the max responses test form', async function (this: CustomWorld) {
    if (!this.viewerPage) {
        throw new Error('Viewer page is not initialized');
    }

    // Wait for form to be ready after CTA button click
    // The CTA button click should have been done before calling this step
    await this.viewerPage.waitForTimeout(2000);

    // Try to find any text input on the page
    // First try the specific field name, then fall back to finding any visible text input
    let nameInput = this.viewerPage.locator('input[name="field-name"]');
    let inputVisible = await nameInput.isVisible().catch(() => false);

    if (!inputVisible) {
        console.log('Field "field-name" not visible, trying to find input by type=text');
        nameInput = this.viewerPage.locator('input[type="text"]').first();
        inputVisible = await nameInput.isVisible({ timeout: 5000 }).catch(() => false);
    }

    if (!inputVisible) {
        // Debug: check if we need to scroll or if there's a rendering issue
        console.log('No text input visible, checking page state...');
        const pageContent = await this.viewerPage.content();
        console.log('Page HTML preview:', pageContent.substring(0, 1000));

        // Check if there's an error message that might explain why form is not visible
        const errorElement = this.viewerPage.getByTestId('form-viewer-error');
        const hasError = await errorElement.isVisible().catch(() => false);
        if (hasError) {
            const errorText = await errorElement.textContent();
            throw new Error(`Form viewer shows error instead of form: ${errorText}`);
        }

        throw new Error('Could not find any text input on the form viewer page. Make sure CTA button was clicked.');
    }

    await nameInput.fill('Test User');

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
 * Verify form submission succeeded
 */
Then('the form submission should succeed', async function (this: CustomWorld) {
    if (!this.viewerPage) {
        throw new Error('Viewer page is not initialized');
    }

    // Look for success message or thank you display
    // Use .first() to avoid strict mode violation when multiple elements match
    const successIndicator = this.viewerPage.locator('text=/success|thank you|submitted/i').first();
    await expect(successIndicator).toBeVisible({ timeout: 15_000 });
});

/**
 * Navigate to form viewer in a new context (simulating a different user)
 */
When('I navigate to the form viewer with the short URL in a new context', async function (this: CustomWorld) {
    if (!this.formShortUrl) {
        throw new Error('Form short URL is not set');
    }

    if (!this.browser) {
        throw new Error('Browser is not initialized');
    }

    // Create a completely new context (simulating a different user)
    const newContext = await this.browser.newContext({
        baseURL: this.formViewerUrl,
        viewport: { width: 1280, height: 720 },
    });

    // Replace the viewer page with a new one
    this.viewerPage = await newContext.newPage();

    // Navigate to the form viewer with the short URL (format: /f/{shortUrl})
    await this.viewerPage.goto(`/f/${this.formShortUrl}`);

    // Wait for either success or error state
    await this.viewerPage.waitForSelector(
        '[data-testid="form-viewer-loading"], [data-testid="form-viewer-error"], [data-testid="form-viewer-renderer"]',
        { timeout: 30_000 }
    );
});

/**
 * Verify the max responses error message is shown
 */
Then('I should see the max responses error message', async function (this: CustomWorld) {
    if (!this.viewerPage) {
        throw new Error('Viewer page is not initialized');
    }

    // Wait for the error state to be visible
    const errorState = this.viewerPage.getByTestId('form-viewer-error');
    await expect(errorState).toBeVisible({ timeout: 30_000 });

    // Verify the error message indicates max responses reached
    const errorMessage = this.viewerPage.getByTestId('form-viewer-error-message');
    await expect(errorMessage).toBeVisible({ timeout: 5_000 });

    const messageText = await errorMessage.textContent();

    // Accept error messages related to max responses
    const isMaxResponsesError = messageText?.toLowerCase().includes('maximum') ||
        messageText?.toLowerCase().includes('no longer accepting') ||
        messageText?.toLowerCase().includes('reached');

    if (!isMaxResponsesError) {
        throw new Error(`Expected max responses error but got: ${messageText}`);
    }
});

// ============================================
// TIME WINDOW STEPS
// ============================================

/**
 * Enable the time window setting
 */
When('I enable the time window', async function (this: CustomWorld) {
    if (!this.page) {
        throw new Error('Page is not initialized');
    }

    // Find and click the time window checkbox to enable it
    const checkbox = this.page.getByTestId('time-window-enabled-checkbox');
    await expect(checkbox).toBeVisible({ timeout: 10_000 });

    // Check if it's already enabled
    const isChecked = await checkbox.isChecked();
    if (!isChecked) {
        await checkbox.click();
        // Wait for the date pickers to appear
        await this.page.waitForTimeout(500);
    }
});

/**
 * Set the time window to past dates (already ended)
 */
When('I set the time window to past dates', async function (this: CustomWorld) {
    if (!this.page) {
        throw new Error('Page is not initialized');
    }

    // Calculate past dates: 30 days ago to 1 day ago
    const today = new Date();
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - 30);
    const endDate = new Date(today);
    endDate.setDate(endDate.getDate() - 1);

    // Format dates as YYYY-MM-DD
    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];

    // The DatePicker has a hidden input with name attribute that we can fill
    // Using fill() will trigger the change event handler in the DatePicker
    const startDateInput = this.page.locator('input[name="time-window-start-date"]');
    const endDateInput = this.page.locator('input[name="time-window-end-date"]');

    // Fill the hidden inputs - this triggers the handleNativeInputChange handler
    await startDateInput.fill(startDateStr);
    await this.page.waitForTimeout(300);
    await endDateInput.fill(endDateStr);
    await this.page.waitForTimeout(500);
});

/**
 * Set the time window to current active dates (now is within the window)
 */
When('I set the time window to current active dates', async function (this: CustomWorld) {
    if (!this.page) {
        throw new Error('Page is not initialized');
    }

    // The default behavior when enabling time window sets:
    // Start date: today
    // End date: 30 days from now
    // So we don't need to change anything - just verify it's within the window

    // Wait a moment for the dates to be set by the enable action
    await this.page.waitForTimeout(500);
});

/**
 * Verify the time window ended error message is shown
 */
Then('I should see the time window ended error message', async function (this: CustomWorld) {
    if (!this.viewerPage) {
        throw new Error('Viewer page is not initialized');
    }

    // Wait for the error state to be visible
    const errorState = this.viewerPage.getByTestId('form-viewer-error');
    await expect(errorState).toBeVisible({ timeout: 30_000 });

    // Verify the error message indicates time window has ended
    const errorMessage = this.viewerPage.getByTestId('form-viewer-error-message');
    await expect(errorMessage).toBeVisible({ timeout: 5_000 });

    const messageText = await errorMessage.textContent();

    // Accept error messages related to time window
    const isTimeWindowError = messageText?.toLowerCase().includes('time') ||
        messageText?.toLowerCase().includes('window') ||
        messageText?.toLowerCase().includes('closed') ||
        messageText?.toLowerCase().includes('period') ||
        messageText?.toLowerCase().includes('no longer accepting');

    if (!isTimeWindowError) {
        throw new Error(`Expected time window error but got: ${messageText}`);
    }
});
