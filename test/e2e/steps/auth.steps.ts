/**
 * Authentication steps for E2E tests
 * Handles sign-in, session management, and authentication state
 */

import { Given, Then } from '@cucumber/cucumber';
import { expect } from '@playwright/test';
import { CustomWorld } from '../support/world';
import { hasStoredAuthState, saveAuthState } from '../support/authStorage';
import { signInViaUi } from './helpers';

/**
 * Navigate to sign-in page
 */
Given('I am on the sign in page', async function (this: CustomWorld) {
  await this.page?.goto('/signin');
});

/**
 * Sign in with valid credentials and wait for dashboard
 */
Given('I sign in with valid credentials', async function (this: CustomWorld) {
  await signInViaUi(this, { skipGoto: false });

  // Wait for sign-in to complete
  const sidebar = this.page!.getByTestId('app-sidebar');
  await expect(sidebar).toBeVisible({ timeout: 30_000 });
});

/**
 * Verify dashboard is visible after sign-in
 */
Then('I should see the dashboard', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  const sidebar = this.page.getByTestId('app-sidebar');
  await expect(sidebar).toBeVisible({ timeout: 30_000 });

  const bearerToken = await this.page.evaluate(() =>
    localStorage.getItem('bearer_token')
  );
  expect(bearerToken).toBeTruthy();

  await expect(this.page).not.toHaveURL(/signin/);
});

/**
 * Save authentication session for reuse
 */
Then('I save my session', async function (this: CustomWorld) {
  if (!this.context) {
    throw new Error('Context is not initialized');
  }
  await saveAuthState(this.context);
});

/**
 * Sign in via UI (deprecated, use "I use my saved session" instead)
 */
Given('I am signed in', async function (this: CustomWorld) {
  await signInViaUi(this, { skipGoto: false });

  const sidebar = this.page!.getByTestId('app-sidebar');
  await expect(sidebar).toBeVisible({ timeout: 30_000 });
});

/**
 * Use saved session or sign in if no session exists
 */
Given('I use my saved session', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  if (!hasStoredAuthState()) {
    // No session found, so we sign in and save the session
    await signInViaUi(this, { skipGoto: false });

    const sidebar = this.page.getByTestId('app-sidebar');
    await expect(sidebar).toBeVisible({ timeout: 30_000 });

    if (this.context) {
      await saveAuthState(this.context);
    }
    return;
  }

  // Navigate to dashboard and wait for network to be idle
  await this.page.goto('/dashboard', { waitUntil: 'networkidle' });

  // Wait a bit for any client-side routing or auth checks
  await this.page.waitForTimeout(2000);

  // Check if we're still on dashboard (not redirected to signin)
  const currentUrl = this.page.url();
  if (currentUrl.includes('/signin')) {
    // If token expired, try to sign in again
    await signInViaUi(this, { skipGoto: false });

    const sidebar = this.page.getByTestId('app-sidebar');
    await expect(sidebar).toBeVisible({ timeout: 30_000 });

    if (this.context) {
      await saveAuthState(this.context);
    }
    return;
  }

  const sidebar = this.page.getByTestId('app-sidebar');
  await expect(sidebar).toBeVisible({ timeout: 30_000 });
});
