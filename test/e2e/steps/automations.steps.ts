/**
 * Automations E2E steps (#199): build a webhook-action automation in the builder,
 * verify Activate is blocked while the action is unconfigured, activate it once
 * configured, trigger it via a real public-viewer submission, and confirm the run
 * completes with a SUCCESS step.
 *
 * The webhook action's URL field only accepts `https://` (client-side regex in
 * WebhookConfigForm), so a self-hosted local capture endpoint would need a
 * self-signed cert plus NODE_TLS_REJECT_UNAUTHORIZED=0 on the backend process —
 * more risk (weakens TLS verification for every outbound call the backend makes
 * during the run) than it's worth for this scenario. Instead this points the
 * webhook at Postman's public echo endpoint, which always returns HTTP 200 over
 * a validly-signed cert, and only asserts run/step status — not delivered payload
 * content — matching the issue's own documented fallback.
 */

import { Given, When, Then } from '@cucumber/cucumber';
import { expect } from '@playwright/test';
import { CustomWorld } from '../support/world';
import { expectPoll } from '../support/expectPoll';
import { createFormViaGraphQL, createAutomationsHappyPathFormSchema } from './helpers';

const WEBHOOK_TEST_URL = 'https://postman-echo.com/post';

Given('I create a form via GraphQL for the automations happy path', async function (this: CustomWorld) {
  await createFormViaGraphQL(this, createAutomationsHappyPathFormSchema(), 'E2E Automations Test');
});

When('I open the automations tab', async function (this: CustomWorld) {
  if (!this.page) throw new Error('Page is not initialized');
  await this.page.getByTestId('quick-action-automations').click();
  await expect(this.page).toHaveURL(/\/automations$/, { timeout: 15_000 });
});

When('I create an automation named {string}', async function (this: CustomWorld, name: string) {
  if (!this.page) throw new Error('Page is not initialized');
  await this.page.getByTestId('create-automation-empty-button').click();
  await this.page.locator('#automation-name-input').fill(name);
  await this.page.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(this.page).toHaveURL(/\/automations\/[^/]+$/, { timeout: 20_000 });
});

Then('I should be in the automation builder', async function (this: CustomWorld) {
  if (!this.page) throw new Error('Page is not initialized');
  await expect(this.page.getByTestId('automation-canvas')).toBeVisible({ timeout: 20_000 });
});

When('I add a webhook action step', async function (this: CustomWorld) {
  if (!this.page) throw new Error('Page is not initialized');
  await this.page.getByRole('button', { name: 'Add a step' }).click();
  await this.page.getByRole('button', { name: 'Webhook', exact: true }).click();
  await expect(this.page.getByTestId('automation-node-config-panel')).toBeVisible({ timeout: 10_000 });
});

Then('the action node should show the setup required badge', async function (this: CustomWorld) {
  if (!this.page) throw new Error('Page is not initialized');
  await expect(
    this.page.getByTestId('automation-canvas').getByText('Setup required', { exact: true })
  ).toBeVisible({ timeout: 10_000 });
});

When('I close the node config panel', async function (this: CustomWorld) {
  if (!this.page) throw new Error('Page is not initialized');
  await this.page.getByRole('button', { name: 'Close panel' }).click();
  await expect(this.page.getByTestId('automation-node-config-panel')).not.toBeVisible({ timeout: 5_000 });
});

When('I save the automation graph', async function (this: CustomWorld) {
  if (!this.page) throw new Error('Page is not initialized');
  const saveButton = this.page.getByRole('button', { name: 'Save', exact: true });
  await saveButton.click();
  await expect(saveButton).toBeDisabled({ timeout: 10_000 });
});

When('I try to activate the automation', async function (this: CustomWorld) {
  if (!this.page) throw new Error('Page is not initialized');
  await this.page.getByRole('button', { name: 'Activate', exact: true }).click();
  // Give the setStatus mutation time to round-trip and reject before asserting on it.
  await this.page.waitForTimeout(1_500);
});

Then('the automation should still be in Draft status', async function (this: CustomWorld) {
  if (!this.page) throw new Error('Page is not initialized');
  await expect(this.page.getByText('Draft', { exact: true })).toBeVisible({ timeout: 5_000 });
  await expect(this.page.getByRole('button', { name: 'Activate', exact: true })).toBeVisible({ timeout: 5_000 });
});

When('I configure the webhook action with a test delivery URL', async function (this: CustomWorld) {
  if (!this.page) throw new Error('Page is not initialized');
  await this.page.getByTestId('automation-canvas').getByText('Webhook', { exact: true }).click();
  const panel = this.page.getByTestId('automation-node-config-panel');
  await expect(panel).toBeVisible({ timeout: 10_000 });

  await panel.locator('#name').fill('Welcome flow webhook');
  await panel.locator('#url').fill(WEBHOOK_TEST_URL);
  await panel.getByRole('button', { name: 'Save action', exact: true }).click();
  await expect(panel).not.toBeVisible({ timeout: 5_000 });
});

When('I activate the automation', async function (this: CustomWorld) {
  if (!this.page) throw new Error('Page is not initialized');
  await this.page.getByRole('button', { name: 'Activate', exact: true }).click();
});

Then('the automation status should be Active', async function (this: CustomWorld) {
  if (!this.page) throw new Error('Page is not initialized');
  await expect(this.page.getByText('Active', { exact: true })).toBeVisible({ timeout: 10_000 });
  await expect(this.page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible({ timeout: 10_000 });
});

When('I fill and submit the automations happy path form', async function (this: CustomWorld) {
  if (!this.viewerPage) throw new Error('Viewer page is not initialized');
  await this.viewerPage.locator('input[name="automation-e2e-name"]').fill('Automation E2E Runner');
  await this.viewerPage.locator('input[name="automation-e2e-email"]').fill('automation-e2e@example.com');

  const submitButton = this.viewerPage.getByTestId('viewer-submit-button');
  await expect(submitButton).toBeVisible({ timeout: 10_000 });
  await submitButton.click();
});

When('I open the automation runs view', async function (this: CustomWorld) {
  if (!this.page) throw new Error('Page is not initialized');
  await this.page.getByRole('button', { name: 'Runs', exact: true }).click();
  await expect(this.page).toHaveURL(/\/runs$/, { timeout: 15_000 });
});

Then('a run should reach COMPLETED status', async function (this: CustomWorld) {
  if (!this.page) throw new Error('Page is not initialized');
  const page = this.page;

  await expectPoll(
    async () => {
      await page.reload({ waitUntil: 'networkidle' });
      return page
        .getByText('Completed', { exact: true })
        .first()
        .isVisible()
        .catch(() => false);
    },
    {
      timeout: 90_000,
      interval: 3_000,
      message: 'Automation run did not reach COMPLETED status in time',
    }
  );
});

Then("the run's webhook action step should show SUCCESS", async function (this: CustomWorld) {
  if (!this.page) throw new Error('Page is not initialized');
  await this.page.getByText('Completed', { exact: true }).first().click();

  const dialog = this.page.getByRole('dialog');
  await expect(dialog).toBeVisible({ timeout: 15_000 });
  await expect(dialog.getByText('Webhook', { exact: true })).toBeVisible({ timeout: 10_000 });
  await expect(dialog.getByText('Success', { exact: true }).first()).toBeVisible({ timeout: 10_000 });
  await expect(dialog.getByText('Failed', { exact: true })).toHaveCount(0);
});
