import { Given, Then, When } from '@cucumber/cucumber';
import { expect } from '@playwright/test';
import { CustomWorld } from '../support/world';

Given('I am on the sign in page', async function (this: CustomWorld) {
  await this.page?.goto('/signin');
});

When('I sign in with valid credentials', async function (this: CustomWorld) {
  const email = process.env.E2E_EMAIL;
  const password = process.env.E2E_PASSWORD;

  if (!email || !password) {
    throw new Error('E2E_EMAIL and E2E_PASSWORD must be set for sign-in tests.');
  }

  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  await this.page.fill('input[name="email"]', email);
  await this.page.fill('input[name="password"]', password);
  await this.page.click('button[type="submit"]');
});

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
