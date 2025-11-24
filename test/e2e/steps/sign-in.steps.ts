import { Given, Then, When } from '@cucumber/cucumber';
import { expect } from '@playwright/test';
import { CustomWorld } from '../support/world';
import { expectPoll } from '../support/expectPoll';
import { hasStoredAuthState, saveAuthState } from '../support/authStorage';

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

Then('I save my session', async function (this: CustomWorld) {
  if (!this.context) {
    throw new Error('Context is not initialized');
  }
  await saveAuthState(this.context);
});

Given('I am signed in', async function (this: CustomWorld) {
  await signInViaUi(this, { skipGoto: false });

  const sidebar = this.page!.getByTestId('app-sidebar');
  await expect(sidebar).toBeVisible({ timeout: 30_000 });
});

Given('I use my saved session', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  if (!hasStoredAuthState()) {
    throw new Error('No saved auth session found. Run the sign-in scenario first.');
  }

  await this.page.goto('/dashboard');
  const sidebar = this.page.getByTestId('app-sidebar');
  await expect(sidebar).toBeVisible({ timeout: 30_000 });
});

When('I create a form from the first template', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  // Ensure we're on the dashboard
  await this.page.goto('/dashboard');

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

When('I open the collaborative builder', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  const collaborateCard = this.page.getByRole('button', {
    name: /collaborate/i,
  });
  await collaborateCard.click();

  const builderRoot = this.page.getByTestId('collaborative-form-builder');
  await expect(builderRoot).toBeVisible({ timeout: 45_000 });
});

When('I add a new page in the builder', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  const addPageButton = this.page.getByTestId('add-page-button');
  await addPageButton.click();

  // Wait until a new page item appears (at least 2 pages)
  const pagesList = this.page.getByTestId('pages-list');
  await expectPoll(async () => {
    const count = await pagesList.locator('[data-testid^="page-item-"]').count();
    return count >= 2;
  }, { message: 'Expected at least 2 pages after adding', timeout: 15_000, interval: 500 });
});

Then('I drag a short text field onto the page', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  const fieldTile = this.page.getByTestId('field-type-short-text');
  const droppablePage = this.page.getByTestId('droppable-page').first();

  await fieldTile.dragTo(droppablePage);

  const fieldContent = droppablePage.getByTestId('field-content-1');
  await expect(fieldContent).toBeVisible({ timeout: 15_000 });
});

Then('I fill the short text field settings with valid data', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  // Hover and click settings button for the first field
  const fieldCard = this.page.locator('[data-testid^="draggable-field-"]').first();
  await fieldCard.hover();

  const settingsButton = this.page.getByTestId('field-settings-button-1');
  await settingsButton.hover();
  await settingsButton.click();

  // Fill settings
  const settingsPanel = this.page.getByTestId('field-settings-panel');
  await expect(settingsPanel).toBeVisible({ timeout: 15_000 });

  await this.page.waitForSelector('#field-label', { timeout: 10_000 });
  await this.page.fill('#field-label', `Short Answer ${Date.now()}`);
  await this.page.fill('#field-hint', 'Provide a concise answer.');
  await this.page.fill('#field-placeholder', 'Enter your response');
  await this.page.fill('#field-prefix', 'QA');
  await this.page.fill('#field-defaultValue', 'Default response');

  // Validation: set min/max length
  await this.page.fill('#field-validation\\.minLength', '1');
  await this.page.fill('#field-validation\\.maxLength', '50');

  // Required toggle
  const requiredToggle = this.page.locator('#field-required');
  const isChecked = await requiredToggle.isChecked();
  if (!isChecked) {
    await requiredToggle.click();
  }

  // Assert values persisted
  await expect(this.page.locator('#field-label')).toHaveValue(/Short Answer/);
  await expect(this.page.locator('#field-placeholder')).toHaveValue('Enter your response');
});
