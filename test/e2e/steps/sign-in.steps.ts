import { Given, Then, When } from '@cucumber/cucumber';
import { expect } from '@playwright/test';
import { CustomWorld } from '../support/world';

type Credentials = {
  email: string;
  password: string;
};

function getCredentials(): Credentials {
  const email = process.env.E2E_EMAIL;
  const password = process.env.E2E_PASSWORD;

  if (!email || !password) {
    throw new Error('E2E_EMAIL and E2E_PASSWORD must be set for sign-in tests.');
  }

  return { email, password };
}

async function signInViaUi(world: CustomWorld, options?: { skipGoto?: boolean }) {
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

Given('I am on the sign in page', async function (this: CustomWorld) {
  await this.page?.goto('/signin');
});

When('I sign in with valid credentials', async function (this: CustomWorld) {
  await signInViaUi(this, { skipGoto: true });
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

Given('I am signed in', async function (this: CustomWorld) {
  await signInViaUi(this, { skipGoto: false });

  const sidebar = this.page!.getByTestId('app-sidebar');
  await expect(sidebar).toBeVisible({ timeout: 30_000 });
});

When('I create a form from the first template', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  // Navigate to templates via dashboard CTA
  const createButton = this.page.getByRole('button', { name: /create form/i });
  await createButton.click();

  // Wait for templates to load and pick the first card
  const firstTemplateCard = this.page.getByTestId('template-card').first();
  await firstTemplateCard.waitFor({ timeout: 30_000 });
  await firstTemplateCard.scrollIntoViewIfNeeded();
  await firstTemplateCard.hover();

  const useTemplateButton = firstTemplateCard.getByRole('button', {
    name: /use template/i,
  });
  await useTemplateButton.click();

  // Fill popover form
  await this.page.waitForSelector('#form-title', { timeout: 10_000 });
  const formTitle = `E2E Form ${Date.now()}`;
  this.newFormTitle = formTitle;

  await this.page.fill('#form-title', formTitle);
  await this.page.fill('#form-description', 'Automated test form');

  const submitButton = this.page.getByRole('button', { name: /create form/i });
  await submitButton.click();
});

Then('I should be on the new form dashboard', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  await expect(this.page).toHaveURL(/\/dashboard\/form\/[^/]+$/, {
    timeout: 45_000,
  });

  const sidebar = this.page.getByTestId('app-sidebar');
  await expect(sidebar).toBeVisible({ timeout: 30_000 });
});
