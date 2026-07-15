/**
 * Form publishing and viewer steps for E2E tests
 * Handles form publishing, short URL retrieval, and viewer navigation
 */

import { When, Then } from '@cucumber/cucumber';
import { expect } from '@playwright/test';
import { CustomWorld } from '../support/world';
import { attachDiagnostics } from '../support/diagnostics';

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

  // Fetch shortUrl directly via GraphQL — reading it off Apollo Client's
  // browser-internal cache (window.__APOLLO_CLIENT__) is unreliable because
  // Apollo Client only exposes that global when devtools are connected,
  // which doesn't happen in a production Vite build (only `pnpm dev`).
  // That silently fell through to a "formId as shortUrl" fallback, which is
  // wrong since shortUrl is a separate, randomly generated value (see
  // formService.ts's generateUniqueShortUrl) — causing "Form Not Found" in
  // the viewer against any deployed (non-dev-server) environment.
  const response = await this.page.evaluate(async ({ id, backendUrl }) => {
    const query = `query GetForm($id: ID!) { form(id: $id) { id shortUrl } }`;
    const res = await fetch(backendUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ query, variables: { id } }),
    });
    return res.json();
  }, { id: formId, backendUrl: this.backendUrl });

  if (response.errors) {
    throw new Error(`GraphQL error fetching form shortUrl: ${JSON.stringify(response.errors)}`);
  }
  if (!response.data?.form?.shortUrl) {
    throw new Error(`Form ${formId} has no shortUrl: ${JSON.stringify(response)}`);
  }

  this.formShortUrl = response.data.form.shortUrl;
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
  attachDiagnostics(this, this.viewerPage, 'viewer');

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
