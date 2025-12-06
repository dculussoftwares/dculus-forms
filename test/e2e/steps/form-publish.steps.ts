/**
 * Form publishing and viewer steps for E2E tests
 * Handles form publishing, short URL retrieval, and viewer navigation
 */

import { When, Then } from '@cucumber/cucumber';
import { expect } from '@playwright/test';
import { CustomWorld } from '../support/world';

/**
 * Publish the form
 */
When('I publish the form', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  const publishButton = this.page.getByTestId('publish-form-button');
  await expect(publishButton).toBeVisible({ timeout: 10_000 });
  await publishButton.click();

  // Wait for the status badge to update to "Live"
  const statusBadge = this.page.getByTestId('form-status-badge');
  await expect(statusBadge).toContainText(/live/i, { timeout: 15_000 });
});

/**
 * Verify form is published
 */
Then('the form should be published', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  const statusBadge = this.page.getByTestId('form-status-badge');
  await expect(statusBadge).toBeVisible({ timeout: 10_000 });
  await expect(statusBadge).toContainText(/live/i);

  // Verify unpublish button is now visible instead of publish
  const unpublishButton = this.page.getByTestId('unpublish-form-button');
  await expect(unpublishButton).toBeVisible({ timeout: 10_000 });
});

/**
 * Get the form short URL from Apollo cache
 */
When('I get the form short URL', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  // Extract the formId from URL
  const currentUrl = this.page.url();
  const formIdMatch = currentUrl.match(/\/dashboard\/form\/([^/?]+)/);

  if (!formIdMatch) {
    throw new Error('Could not extract form ID from URL');
  }

  const formId = formIdMatch[1];

  // Extract shortUrl from Apollo Client cache in the browser
  const shortUrl = await this.page.evaluate((id) => {
    // Access the Apollo Client cache
    const apolloState = (window as any).__APOLLO_STATE__;
    if (apolloState) {
      // Try to find the form in the cache
      const formKey = `Form:${id}`;
      if (apolloState[formKey] && apolloState[formKey].shortUrl) {
        return apolloState[formKey].shortUrl;
      }
    }

    // Fallback: try to get it from Apollo Client directly
    const apolloClient = (window as any).__APOLLO_CLIENT__;
    if (apolloClient) {
      try {
        const data = apolloClient.cache.readQuery({
          query: {
            kind: 'Document',
            definitions: [{
              kind: 'OperationDefinition',
              operation: 'query',
              selectionSet: {
                kind: 'SelectionSet',
                selections: [{
                  kind: 'Field',
                  name: { kind: 'Name', value: 'form' },
                  arguments: [{
                    kind: 'Argument',
                    name: { kind: 'Name', value: 'id' },
                    value: { kind: 'Variable', name: { kind: 'Name', value: 'id' } }
                  }],
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'shortUrl' } }
                    ]
                  }
                }]
              }
            }]
          },
          variables: { id }
        });
        if (data && data.form && data.form.shortUrl) {
          return data.form.shortUrl;
        }
      } catch (e) {
        console.error('Error reading from Apollo cache:', e);
      }
    }

    // Last resort: use formId as shortUrl
    return id;
  }, formId);

  this.formShortUrl = shortUrl;
});

/**
 * Navigate to form viewer with the short URL
 */
When('I navigate to the form viewer with the short URL', async function (this: CustomWorld) {
  if (!this.formShortUrl) {
    throw new Error('Form short URL is not set');
  }

  if (!this.browser) {
    throw new Error('Browser is not initialized');
  }

  // Create a new context and page for the viewer
  const viewerContext = await this.browser.newContext({
    baseURL: this.formViewerUrl,
    viewport: { width: 1280, height: 720 },
  });

  this.viewerPage = await viewerContext.newPage();

  // Navigate to the form viewer with the short URL (format: /f/{shortUrl})
  await this.viewerPage.goto(`/f/${this.formShortUrl}`);

  // Wait for either success or error state
  await this.viewerPage.waitForSelector(
    '[data-testid="form-viewer-loading"], [data-testid="form-viewer-error"], [data-testid="form-viewer-renderer"]',
    { timeout: 30_000 }
  );
});

/**
 * Verify form is visible in viewer
 */
Then('I should see the form in the viewer', async function (this: CustomWorld) {
  if (!this.viewerPage) {
    throw new Error('Viewer page is not initialized');
  }

  // Wait for the form renderer to be visible (not loading or error)
  const formRenderer = this.viewerPage.getByTestId('form-viewer-renderer');
  await expect(formRenderer).toBeVisible({ timeout: 30_000 });

  // Ensure no error state is shown
  const errorState = this.viewerPage.getByTestId('form-viewer-error');
  await expect(errorState).not.toBeVisible();
});

/**
 * Verify form title is visible in viewer
 */
Then('I should see the form title in the viewer', async function (this: CustomWorld) {
  if (!this.viewerPage) {
    throw new Error('Viewer page is not initialized');
  }

  if (!this.newFormTitle) {
    throw new Error('Form title is not set');
  }

  // The form title should be visible somewhere in the viewer
  // This might be in the FormRenderer component or in the page metadata
  await expect(this.viewerPage.getByText(this.newFormTitle)).toBeVisible({ timeout: 10_000 });
});

/**
 * Verify form viewer shows an error
 */
Then('the form viewer should show an error', async function (this: CustomWorld) {
  if (!this.viewerPage) {
    throw new Error('Viewer page is not initialized');
  }

  // Wait for the error state to be visible
  const errorState = this.viewerPage.getByTestId('form-viewer-error');
  await expect(errorState).toBeVisible({ timeout: 30_000 });

  // Verify the error message indicates form is not accessible
  // Could be "not yet published" or "doesn't exist" depending on the exact error
  const errorMessage = this.viewerPage.getByTestId('form-viewer-error-message');
  const messageText = await errorMessage.textContent();

  // Accept either "not yet published" or "doesn't exist" as valid error messages
  const isValidError = messageText?.includes('not yet published') || messageText?.includes("doesn't exist");

  if (!isValidError) {
    throw new Error(`Unexpected error message: ${messageText}`);
  }
});
