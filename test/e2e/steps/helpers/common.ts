/**
 * Common helper functions for E2E tests
 */

import type { Locator } from 'playwright';
import { expect } from '@playwright/test';
import { CustomWorld } from '../../support/world';

export type Credentials = {
  email: string;
  password: string;
};

/**
 * Get credentials from environment variables
 */
export function getCredentials(): Credentials {
  const email = process.env.E2E_EMAIL;
  const password = process.env.E2E_PASSWORD;

  if (!email || !password) {
    throw new Error('E2E_EMAIL and E2E_PASSWORD must be set for sign-in tests.');
  }

  return { email, password };
}

/**
 * Drag a source element onto a target element.
 * Uses slow manual mouse movement with timing delays to work with DND kit's
 * PointerSensor which requires actual pointer movement past an 8px threshold.
 */
export async function dragOnto(source: Locator, target: Locator): Promise<void> {
  const page = source.page();

  await source.scrollIntoViewIfNeeded();
  await target.scrollIntoViewIfNeeded();

  const sourceBB = await source.boundingBox();
  const targetBB = await target.boundingBox();

  if (!sourceBB || !targetBB) {
    throw new Error('Could not get bounding boxes for drag operation');
  }

  const startX = sourceBB.x + sourceBB.width / 2;
  const startY = sourceBB.y + sourceBB.height / 2;
  const endX = targetBB.x + targetBB.width / 2;
  const endY = targetBB.y + targetBB.height / 2;

  // Move to source, press down, then move slowly to activate DND kit
  await page.mouse.move(startX, startY);
  await page.waitForTimeout(50);
  await page.mouse.down();
  await page.waitForTimeout(100); // Let React process pointerdown

  // Move gradually past the 8px activation threshold
  for (let i = 1; i <= 15; i++) {
    await page.mouse.move(startX + i, startY);
    await page.waitForTimeout(10);
  }

  // Continue to the target with many steps for smooth DND detection
  await page.mouse.move(endX, endY, { steps: 50 });
  await page.waitForTimeout(300);
  await page.mouse.up();
  await page.waitForTimeout(600);
}

/**
 * Adds a field to the current builder page by clicking its tile in FieldTypesPanel.
 * More reliable than drag-and-drop in headless browsers.
 */
export async function addFieldToPage(world: CustomWorld, fieldTestId: string): Promise<void> {
  if (!world.page) throw new Error('Page is not initialized');
  const tile = world.page.getByTestId(fieldTestId);
  await tile.click();
  const droppable = world.page.getByTestId('droppable-page').first();
  await expect(droppable.locator('[data-testid^="field-content-"]').first()).toBeVisible({ timeout: 15_000 });
}

/**
 * Opens settings for the most recently added field (last in the list).
 * Hovers to reveal the settings button then clicks it.
 */
export async function openLastFieldSettings(world: CustomWorld): Promise<void> {
  if (!world.page) throw new Error('Page is not initialized');
  const fieldCards = world.page.locator('[data-testid^="draggable-field-"]');
  await expect(fieldCards.last()).toBeVisible({ timeout: 10_000 });
  await fieldCards.last().hover();
  const settingsBtn = fieldCards.last().locator('[data-testid^="field-settings-button-"]');
  await expect(settingsBtn).toBeVisible({ timeout: 5_000 });
  await settingsBtn.click({ force: true });
  const panel = world.page.getByTestId('field-settings-panel');
  await expect(panel).toBeVisible({ timeout: 15_000 });
  await world.page.waitForSelector('#field-label', { timeout: 10_000 });
}

/**
 * Creates a form via GraphQL using the currently signed-in user's organization.
 * Navigates to the form dashboard after creation.
 */
export async function createFormViaGraphQL(
  world: CustomWorld,
  schema: object,
  titlePrefix = 'E2E Test'
): Promise<string> {
  if (!world.page) throw new Error('Page is not initialized');

  await world.page.goto(`${world.baseUrl}/dashboard`);
  await world.page.waitForTimeout(2000);

  const organizationId = await world.page.evaluate(() => {
    const orgFromStorage = localStorage.getItem('organization_id');
    if (orgFromStorage) return orgFromStorage;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const apolloClient = (window as any).__APOLLO_CLIENT__;
    if (apolloClient?.cache) {
      try {
        const cacheData = apolloClient.cache.extract();
        const orgKey = Object.keys(cacheData).find((k: string) => k.startsWith('Organization:'));
        if (orgKey) return orgKey.split(':')[1];
      } catch { /* ignore */ }
    }
    return new URL(window.location.href).searchParams.get('org');
  });

  if (!organizationId) throw new Error('Organization ID not found');

  const formTitle = `${titlePrefix} ${Date.now()}`;
  const response = await world.page.evaluate(
    async ({ orgId, title, formSchema, backendUrl }) => {
      const res = await fetch(backendUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          query: `mutation CreateForm($input: CreateFormInput!) {
            createForm(input: $input) { id title shortUrl }
          }`,
          variables: { input: { title, formSchema, organizationId: orgId } },
        }),
      });
      return res.json();
    },
    { orgId: organizationId, title: formTitle, formSchema: schema, backendUrl: world.backendUrl }
  );

  if (response.errors) throw new Error(`GraphQL error: ${JSON.stringify(response.errors)}`);

  const formId = response.data.createForm.id;
  world.newFormTitle = formTitle;
  world.currentFormId = formId;
  await world.page.goto(`${world.baseUrl}/dashboard/form/${formId}`);
  await expect(world.page.getByTestId('app-sidebar')).toBeVisible({ timeout: 30_000 });
  return formId;
}

/**
 * Fetches the most recently submitted response for the scenario's form
 * (world.currentFormId) via the authenticated builder page. Returns the
 * response row's id and its stored data payload.
 */
export async function fetchLatestResponse(
  world: CustomWorld
): Promise<{ id: string; data: Record<string, unknown> }> {
  if (!world.page) throw new Error('Page is not initialized');
  if (!world.currentFormId) throw new Error('No form created in this scenario');

  const response = await world.page.evaluate(
    async ({ formId, backendUrl }) => {
      const res = await fetch(backendUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          query: `query ResponsesByForm($formId: ID!) {
            responsesByForm(formId: $formId, page: 1, limit: 1) {
              data { id data }
            }
          }`,
          variables: { formId },
        }),
      });
      return res.json();
    },
    { formId: world.currentFormId, backendUrl: world.backendUrl }
  );

  if (response.errors) {
    throw new Error(`GraphQL error fetching responses: ${JSON.stringify(response.errors)}`);
  }
  const first = response.data?.responsesByForm?.data?.[0];
  if (!first) throw new Error('No stored response found for the form');
  return { id: first.id as string, data: first.data as Record<string, unknown> };
}

/**
 * Sign in via UI
 */
export async function signInViaUi(world: CustomWorld, options?: { skipGoto?: boolean }) {
  if (!world.page) {
    throw new Error('Page is not initialized');
  }

  const { email, password } = getCredentials();

  if (!options?.skipGoto) {
    await world.page.goto('/signin');
  }

  await world.page.fill('input[name="email"]', email);
  await world.page.fill('input[name="password"]', password);
  await world.page.click('button[type="submit"]');
}
