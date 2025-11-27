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

Then('I drag a long text field onto the page', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  const fieldTile = this.page.getByTestId('field-type-long-text');
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

  // Wait for settings button to be visible after hover
  const settingsButton = this.page.getByTestId('field-settings-button-1');
  await expect(settingsButton).toBeVisible({ timeout: 30_000 });
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

When('I open the short text field settings', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  // Hover and click settings button for the first field
  const fieldCard = this.page.locator('[data-testid^="draggable-field-"]').first();
  await fieldCard.hover();

  // Wait for settings button to be visible after hover
  const settingsButton = this.page.getByTestId('field-settings-button-1');
  await expect(settingsButton).toBeVisible({ timeout: 30_000 });
  await settingsButton.hover();
  await settingsButton.click();

  // Wait for settings panel to be visible
  const settingsPanel = this.page.getByTestId('field-settings-panel');
  await expect(settingsPanel).toBeVisible({ timeout: 15_000 });
  await this.page.waitForSelector('#field-label', { timeout: 10_000 });
});

When('I open the long text field settings', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  // Hover and click settings button for the first field
  const fieldCard = this.page.locator('[data-testid^="draggable-field-"]').first();
  await fieldCard.hover();

  // Wait for settings button to be visible after hover
  const settingsButton = this.page.getByTestId('field-settings-button-1');
  await expect(settingsButton).toBeVisible({ timeout: 30_000 });
  await settingsButton.hover();
  await settingsButton.click();

  // Wait for settings panel to be visible
  const settingsPanel = this.page.getByTestId('field-settings-panel');
  await expect(settingsPanel).toBeVisible({ timeout: 15_000 });
  await this.page.waitForSelector('#field-label', { timeout: 10_000 });
});

Then('I test invalid label data', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  // Test 1: Empty label (clear the default)
  await this.page.fill('#field-label', '');
  await this.page.locator('#field-hint').click(); // Blur to trigger validation
  
  // Check for error message
  const labelError = this.page.locator('text=/Field label is required/i').first();
  await expect(labelError).toBeVisible({ timeout: 5_000 });

  // Test 2: Label too long (201+ characters)
  const longLabel = 'A'.repeat(201);
  await this.page.fill('#field-label', longLabel);
  await this.page.locator('#field-hint').click(); // Blur to trigger validation
  
  const labelTooLongError = this.page.locator('text=/Label is too long/i').first();
  await expect(labelTooLongError).toBeVisible({ timeout: 5_000 });

  // Fix: Set valid label
  await this.page.fill('#field-label', 'Valid Label');
  await this.page.locator('#field-hint').click();
  
  // Verify error is gone
  await expect(labelError).not.toBeVisible();
  await expect(labelTooLongError).not.toBeVisible();
});

Then('I test invalid hint data', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  // Test: Hint too long (501+ characters)
  const longHint = 'H'.repeat(501);
  await this.page.fill('#field-hint', longHint);
  await this.page.locator('#field-label').click(); // Blur to trigger validation
  
  const hintError = this.page.locator('text=/Help text is too long/i').first();
  await expect(hintError).toBeVisible({ timeout: 5_000 });

  // Fix: Set valid hint
  await this.page.fill('#field-hint', 'Valid help text');
  await this.page.locator('#field-label').click();
  
  // Verify error is gone
  await expect(hintError).not.toBeVisible();
});

Then('I test invalid placeholder data', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  // Test: Placeholder too long (101+ characters)
  const longPlaceholder = 'P'.repeat(101);
  await this.page.fill('#field-placeholder', longPlaceholder);
  await this.page.locator('#field-label').click(); // Blur to trigger validation
  
  const placeholderError = this.page.locator('text=/Placeholder is too long/i').first();
  await expect(placeholderError).toBeVisible({ timeout: 5_000 });

  // Fix: Set valid placeholder
  await this.page.fill('#field-placeholder', 'Valid placeholder');
  await this.page.locator('#field-label').click();
  
  // Verify error is gone
  await expect(placeholderError).not.toBeVisible();
});

Then('I test invalid prefix data', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  // Test: Prefix too long (11+ characters)
  const longPrefix = 'PREFIX12345';
  await this.page.fill('#field-prefix', longPrefix);
  await this.page.locator('#field-label').click(); // Blur to trigger validation
  
  const prefixError = this.page.locator('text=/Prefix is too long/i').first();
  await expect(prefixError).toBeVisible({ timeout: 5_000 });

  // Fix: Set valid prefix
  await this.page.fill('#field-prefix', 'PRE');
  await this.page.locator('#field-label').click();
  
  // Verify error is gone
  await expect(prefixError).not.toBeVisible();
});

Then('I test invalid default value data', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  // Test: Default value too long (1001+ characters)
  const longDefaultValue = 'D'.repeat(1001);
  await this.page.fill('#field-defaultValue', longDefaultValue);
  await this.page.locator('#field-label').click(); // Blur to trigger validation
  
  const defaultValueError = this.page.locator('text=/Default value is too long/i').first();
  await expect(defaultValueError).toBeVisible({ timeout: 5_000 });

  // Fix: Set valid default value
  await this.page.fill('#field-defaultValue', 'Valid default');
  await this.page.locator('#field-label').click();
  
  // Verify error is gone
  await expect(defaultValueError).not.toBeVisible();
});

Then('I test invalid min length data', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  // Test 1: Negative number
  await this.page.fill('#field-validation\\.minLength', '-1');
  await this.page.locator('#field-label').click(); // Blur to trigger validation
  
  const negativeError = this.page.locator('text=/Minimum length must be 0 or greater/i').first();
  await expect(negativeError).toBeVisible({ timeout: 5_000 });

  // Test 2: Exceeds 5000 characters limit
  await this.page.fill('#field-validation\\.minLength', '5001');
  await this.page.locator('#field-label').click();
  
  const exceedsLimitError = this.page.locator('text=/Cannot exceed 5000 characters/i').first();
  await expect(exceedsLimitError).toBeVisible({ timeout: 5_000 });

  // Fix: Set valid min length
  await this.page.fill('#field-validation\\.minLength', '10');
  await this.page.locator('#field-label').click();
  
  // Verify errors are gone
  await expect(negativeError).not.toBeVisible();
  await expect(exceedsLimitError).not.toBeVisible();
});

Then('I test invalid max length data', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  // Test 1: Zero (must be at least 1)
  await this.page.fill('#field-validation\\.maxLength', '0');
  await this.page.locator('#field-label').click(); // Blur to trigger validation
  
  const zeroError = this.page.locator('text=/Maximum length must be 1 or greater/i').first();
  await expect(zeroError).toBeVisible({ timeout: 5_000 });

  // Test 2: Exceeds 5000 characters limit
  await this.page.fill('#field-validation\\.maxLength', '5001');
  await this.page.locator('#field-label').click();
  
  const exceedsLimitError = this.page.locator('text=/Cannot exceed 5000 characters/i').first();
  await expect(exceedsLimitError).toBeVisible({ timeout: 5_000 });

  // Fix: Set valid max length
  await this.page.fill('#field-validation\\.maxLength', '100');
  await this.page.locator('#field-label').click();
  
  // Verify errors are gone
  await expect(zeroError).not.toBeVisible();
  await expect(exceedsLimitError).not.toBeVisible();
});

Then('I test min greater than max validation', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  // Set min > max
  await this.page.fill('#field-validation\\.minLength', '100');
  await this.page.fill('#field-validation\\.maxLength', '50');
  await this.page.locator('#field-label').click(); // Blur to trigger validation
  
  const minMaxError = this.page.locator('text=/Minimum length must be less than or equal to maximum length/i').first();
  await expect(minMaxError).toBeVisible({ timeout: 5_000 });

  // Fix: Set valid range
  await this.page.fill('#field-validation\\.minLength', '10');
  await this.page.fill('#field-validation\\.maxLength', '100');
  await this.page.locator('#field-label').click();
  
  // Verify error is gone
  await expect(minMaxError).not.toBeVisible();
});

Then('I verify all validations work correctly', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  // Final check: Ensure form is in valid state
  const settingsPanel = this.page.getByTestId('field-settings-panel');
  await expect(settingsPanel).toBeVisible();

  // Verify the form has valid data by checking specific fields
  const labelValue = await this.page.locator('#field-label').inputValue();
  expect(labelValue).toBe('Valid Label');
  
  const minLengthValue = await this.page.locator('#field-validation\\.minLength').inputValue();
  expect(minLengthValue).toBe('10');
  
  const maxLengthValue = await this.page.locator('#field-validation\\.maxLength').inputValue();
  expect(maxLengthValue).toBe('100');
  
  // Ensure no validation error messages are visible (use exact error message patterns)
  const labelError = this.page.locator('text=/Field label is required/i');
  const labelTooLongError = this.page.locator('text=/Label is too long/i');
  const hintError = this.page.locator('text=/Help text is too long/i');
  const placeholderError = this.page.locator('text=/Placeholder is too long/i');
  const prefixError = this.page.locator('text=/Prefix is too long/i');
  const defaultValueError = this.page.locator('text=/Default value is too long/i');
  const minLengthNegativeError = this.page.locator('text=/Minimum length must be 0 or greater/i');
  const minLengthExceedsError = this.page.locator('text=/Minimum length cannot exceed 5000/i');
  const maxLengthZeroError = this.page.locator('text=/Maximum length must be 1 or greater/i');
  const maxLengthExceedsError = this.page.locator('text=/Maximum length cannot exceed 5000/i');
  const minMaxError = this.page.locator('text=/Minimum length must be less than or equal to maximum/i');
  
  await expect(labelError).not.toBeVisible();
  await expect(labelTooLongError).not.toBeVisible();
  await expect(hintError).not.toBeVisible();
  await expect(placeholderError).not.toBeVisible();
  await expect(prefixError).not.toBeVisible();
  await expect(defaultValueError).not.toBeVisible();
  await expect(minLengthNegativeError).not.toBeVisible();
  await expect(minLengthExceedsError).not.toBeVisible();
  await expect(maxLengthZeroError).not.toBeVisible();
  await expect(maxLengthExceedsError).not.toBeVisible();
  await expect(minMaxError).not.toBeVisible();
});

// Enhanced Long Text Validation Steps for Template Creation

Then('I test label and hint validation for long text', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  // Test 1: Empty label (required field)
  await this.page.fill('#field-label', '');
  await this.page.locator('#field-hint').click(); // Blur to trigger validation
  
  const emptyLabelError = this.page.locator('text=/Field label is required/i').first();
  await expect(emptyLabelError).toBeVisible({ timeout: 5_000 });

  // Test 2: Label too long (201 characters)
  const longLabel = 'A'.repeat(201);
  await this.page.fill('#field-label', longLabel);
  await this.page.locator('#field-hint').click();
  
  const labelTooLongError = this.page.locator('text=/Label is too long/i').first();
  await expect(labelTooLongError).toBeVisible({ timeout: 5_000 });

  // Test 3: Hint too long (501 characters)
  const longHint = 'B'.repeat(501);
  await this.page.fill('#field-hint', longHint);
  await this.page.locator('#field-label').click();
  
  const hintTooLongError = this.page.locator('text=/Help text is too long/i').first();
  await expect(hintTooLongError).toBeVisible({ timeout: 5_000 });

  // Verify all errors are visible
  await expect(labelTooLongError).toBeVisible();
  await expect(hintTooLongError).toBeVisible();
});

Then('I test min max length validation for long text', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  // Test 1: Negative min length
  await this.page.fill('#field-validation\\.minLength', '-1');
  await this.page.locator('#field-label').click(); // Blur
  
  const negativeMinError = this.page.locator('text=/Minimum length must be 0 or greater/i').first();
  await expect(negativeMinError).toBeVisible({ timeout: 5_000 });

  // Test 2: Max length = 0 (must be >= 1)
  await this.page.fill('#field-validation\\.maxLength', '0');
  await this.page.locator('#field-label').click();
  
  const zeroMaxError = this.page.locator('text=/Maximum length must be 1 or greater/i').first();
  await expect(zeroMaxError).toBeVisible({ timeout: 5_000 });

  // Test 3: Min > Max (set min=100, max=50)
  await this.page.fill('#field-validation\\.minLength', '100');
  await this.page.fill('#field-validation\\.maxLength', '50');
  await this.page.locator('#field-label').click();
  
  const minGreaterThanMaxError = this.page.locator('text=/Minimum length must be less than or equal to maximum length/i').first();
  await expect(minGreaterThanMaxError).toBeVisible({ timeout: 5_000 });
});

Then('I verify save button is disabled with errors', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  // Check if save button exists and is disabled
  const saveButton = this.page.getByRole('button', { name: /save/i });
  await expect(saveButton).toBeVisible({ timeout: 5_000 });
  await expect(saveButton).toBeDisabled({ timeout: 5_000 });

  // Verify validation summary is visible
  const validationSummary = this.page.locator('text=/Please fix the following issues to save/i').first();
  await expect(validationSummary).toBeVisible({ timeout: 5_000 });
});

Then('I fix all validation errors for long text', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  // Fix label: Set valid length (< 200 chars)
  await this.page.fill('#field-label', `Long Answer Field ${Date.now()}`);
  
  // Fix hint: Set valid length (< 500 chars)
  await this.page.fill('#field-hint', 'Please provide a detailed answer.');
  
  // Fix placeholder
  await this.page.fill('#field-placeholder', 'Type your answer here...');
  
  // Fix min/max length: Set valid values
  await this.page.fill('#field-validation\\.minLength', '10');
  await this.page.fill('#field-validation\\.maxLength', '500');

  // Blur to trigger final validation
  await this.page.locator('#field-label').click();
  
  // Wait a bit for validation to complete
  await this.page.waitForTimeout(1000);
});

Then('I verify save button is enabled', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  // Check if save button is now enabled
  const saveButton = this.page.getByRole('button', { name: /save/i });
  await expect(saveButton).toBeVisible({ timeout: 5_000 });
  await expect(saveButton).toBeEnabled({ timeout: 5_000 });

  // Verify no validation summary
  const validationSummary = this.page.locator('text=/Please fix the following issues to save/i').first();
  await expect(validationSummary).not.toBeVisible();
});

Then('I save the long text field settings', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  // Click save button
  const saveButton = this.page.getByRole('button', { name: /save/i });
  await saveButton.click();

  // Wait for save to complete (settings panel should close or show success)
  await this.page.waitForTimeout(1000);

  // Verify field is saved
  const fieldContent = this.page.getByTestId('field-content-1');
  await expect(fieldContent).toBeVisible({ timeout: 5_000 });
});

Then('I fill the long text field settings with valid data', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  // Fill settings with valid data
  const settingsPanel = this.page.getByTestId('field-settings-panel');
  await expect(settingsPanel).toBeVisible({ timeout: 15_000 });

  await this.page.waitForSelector('#field-label', { timeout: 10_000 });
  await this.page.fill('#field-label', `Long Answer ${Date.now()}`);
  await this.page.fill('#field-hint', 'Please provide a detailed answer.');
  await this.page.fill('#field-placeholder', 'Type your response here...');
  await this.page.fill('#field-defaultValue', 'Default long text response');

  // Validation: set min/max length
  await this.page.fill('#field-validation\\.minLength', '10');
  await this.page.fill('#field-validation\\.maxLength', '500');

  // Required toggle
  const requiredToggle = this.page.locator('#field-required');
  const isChecked = await requiredToggle.isChecked();
  if (!isChecked) {
    await requiredToggle.click();
  }

  // Assert values persisted
  await expect(this.page.locator('#field-label')).toHaveValue(/Long Answer/);
  await expect(this.page.locator('#field-placeholder')).toHaveValue('Type your response here...');
});

// Email Field Test Steps

Then('I drag an email field onto the page', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  const fieldTile = this.page.getByTestId('field-type-email');
  const droppablePage = this.page.getByTestId('droppable-page').first();

  await fieldTile.dragTo(droppablePage);

  const fieldContent = droppablePage.getByTestId('field-content-1');
  await expect(fieldContent).toBeVisible({ timeout: 15_000 });
});

When('I open the email field settings', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  // Hover and click settings button for the first field
  const fieldCard = this.page.locator('[data-testid^="draggable-field-"]').first();
  await fieldCard.hover();

  // Wait for settings button to be visible after hover
  const settingsButton = this.page.getByTestId('field-settings-button-1');
  await expect(settingsButton).toBeVisible({ timeout: 30_000 });
  await settingsButton.hover();
  await settingsButton.click();

  // Wait for settings panel to be visible
  const settingsPanel = this.page.getByTestId('field-settings-panel');
  await expect(settingsPanel).toBeVisible({ timeout: 15_000 });
  await this.page.waitForSelector('#field-label', { timeout: 10_000 });
});

Then('I fill the email field settings with valid data', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  // Fill settings with valid data
  const settingsPanel = this.page.getByTestId('field-settings-panel');
  await expect(settingsPanel).toBeVisible({ timeout: 15_000 });

  await this.page.waitForSelector('#field-label', { timeout: 10_000 });
  await this.page.fill('#field-label', `Email Address ${Date.now()}`);
  await this.page.fill('#field-hint', 'We will never share your email with anyone.');
  await this.page.fill('#field-placeholder', 'you@example.com');
  await this.page.fill('#field-defaultValue', 'test@example.com');

  // Required toggle
  const requiredToggle = this.page.locator('#field-required');
  const isChecked = await requiredToggle.isChecked();
  if (!isChecked) {
    await requiredToggle.click();
  }

  // Assert values persisted
  await expect(this.page.locator('#field-label')).toHaveValue(/Email Address/);
  await expect(this.page.locator('#field-placeholder')).toHaveValue('you@example.com');
});

Then('I test label and hint validation for email', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  // Test 1: Empty label (required field)
  await this.page.fill('#field-label', '');
  await this.page.locator('#field-hint').click(); // Blur to trigger validation
  
  const emptyLabelError = this.page.locator('text=/Field label is required/i').first();
  await expect(emptyLabelError).toBeVisible({ timeout: 5_000 });

  // Test 2: Label too long (201 characters)
  const longLabel = 'A'.repeat(201);
  await this.page.fill('#field-label', longLabel);
  await this.page.locator('#field-hint').click();
  
  const labelTooLongError = this.page.locator('text=/Label is too long/i').first();
  await expect(labelTooLongError).toBeVisible({ timeout: 5_000 });

  // Test 3: Hint too long (501 characters)
  const longHint = 'B'.repeat(501);
  await this.page.fill('#field-hint', longHint);
  await this.page.locator('#field-label').click();
  
  const hintTooLongError = this.page.locator('text=/Help text is too long/i').first();
  await expect(hintTooLongError).toBeVisible({ timeout: 5_000 });

  // Verify all errors are visible
  await expect(labelTooLongError).toBeVisible();
  await expect(hintTooLongError).toBeVisible();
});

Then('I test placeholder validation for email', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  // Test: Placeholder too long (101 characters)
  const longPlaceholder = 'C'.repeat(101);
  await this.page.fill('#field-placeholder', longPlaceholder);
  await this.page.locator('#field-label').click(); // Blur
  
  const placeholderTooLongError = this.page.locator('text=/Placeholder is too long/i').first();
  await expect(placeholderTooLongError).toBeVisible({ timeout: 5_000 });
});

Then('I test default value validation for email', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  // Test: Default value too long (1001 characters)
  const longDefaultValue = 'D'.repeat(1001);
  await this.page.fill('#field-defaultValue', longDefaultValue);
  await this.page.locator('#field-label').click(); // Blur
  
  const defaultValueTooLongError = this.page.locator('text=/Default value is too long/i').first();
  await expect(defaultValueTooLongError).toBeVisible({ timeout: 5_000 });
});

Then('I fix all validation errors for email', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  // Fix label: Set valid length (< 200 chars)
  await this.page.fill('#field-label', `Email Address ${Date.now()}`);
  
  // Fix hint: Set valid length (< 500 chars)
  await this.page.fill('#field-hint', 'We will never share your email.');
  
  // Fix placeholder: Set valid length (< 100 chars)
  await this.page.fill('#field-placeholder', 'you@example.com');
  
  // Fix default value: Set valid length (< 1000 chars)
  await this.page.fill('#field-defaultValue', 'test@example.com');

  // Blur to trigger final validation
  await this.page.locator('#field-label').click();
  
  // Wait a bit for validation to complete
  await this.page.waitForTimeout(1000);
});

Then('I save the email field settings', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  // Click save button
  const saveButton = this.page.getByRole('button', { name: /save/i });
  await saveButton.click();

  // Wait for save to complete
  await this.page.waitForTimeout(1000);

  // Verify field is saved
  const fieldContent = this.page.getByTestId('field-content-1');
  await expect(fieldContent).toBeVisible({ timeout: 5_000 });
});

// Number Field Test Steps

Then('I drag a number field onto the page', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  const fieldTile = this.page.getByTestId('field-type-number');
  const droppablePage = this.page.getByTestId('droppable-page').first();
  
  // Get initial field count
  const initialCount = await droppablePage.locator('[data-testid^="field-content-"]').count();

  await fieldTile.dragTo(droppablePage);

  // Wait for count to increase
  await expect(async () => {
    const newCount = await droppablePage.locator('[data-testid^="field-content-"]').count();
    expect(newCount).toBeGreaterThan(initialCount);
  }).toPass({ timeout: 15000 });
});

When('I open the number field settings', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  // Find the last field card (the one we just dragged)
  const fieldCards = this.page.locator('[data-testid^="draggable-field-"]');
  await expect(fieldCards.last()).toBeVisible({ timeout: 10_000 });
  const lastFieldCard = fieldCards.last();
  
  // Hover to show actions
  await lastFieldCard.hover();

  // Find the settings button within the last field card
  const settingsButton = lastFieldCard.locator('[data-testid^="field-settings-button-"]');
  await expect(settingsButton).toBeVisible({ timeout: 5_000 });
  
  // Wait for stability
  await this.page.waitForTimeout(1000);
  
  // Force click to avoid interception issues
  await settingsButton.click({ force: true });

  // Wait for settings panel to be visible
  const settingsPanel = this.page.getByTestId('field-settings-panel');
  await expect(settingsPanel).toBeVisible({ timeout: 15_000 });
  
  // Wait for specific number field input to ensure it's the right panel
  await this.page.waitForSelector('#field-label', { timeout: 10_000 });
});

Then('I fill the number field settings with valid data', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  // Fill settings with valid data
  const settingsPanel = this.page.getByTestId('field-settings-panel');
  await expect(settingsPanel).toBeVisible({ timeout: 15_000 });

  await this.page.waitForSelector('#field-label', { timeout: 10_000 });
  await this.page.fill('#field-label', `Quantity ${Date.now()}`);
  await this.page.fill('#field-hint', 'Enter the amount.');
  await this.page.fill('#field-placeholder', '0');
  await this.page.fill('#field-defaultValue', '10');

  // Validation: set min/max values
  await this.page.fill('#field-min', '0');
  await this.page.fill('#field-max', '100');

  // Required toggle
  const requiredToggle = this.page.locator('#field-required');
  const isChecked = await requiredToggle.isChecked();
  if (!isChecked) {
    await requiredToggle.click();
  }

  // Assert values persisted
  await expect(this.page.locator('#field-label')).toHaveValue(/Quantity/);
  await expect(this.page.locator('#field-placeholder')).toHaveValue('0');
});

Then('I test label validation for number', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  // Test 1: Empty label (required field)
  await this.page.fill('#field-label', '');
  await this.page.locator('#field-hint').click(); // Blur to trigger validation
  
  const emptyLabelError = this.page.locator('text=/Field label is required/i').first();
  await expect(emptyLabelError).toBeVisible({ timeout: 5_000 });

  // Test 2: Label too long (201 characters) - NEW validation added
  const longLabel = 'A'.repeat(201);
  await this.page.fill('#field-label', longLabel);
  await this.page.locator('#field-hint').click();
  
  const labelTooLongError = this.page.locator('text=/Label is too long/i').first();
  await expect(labelTooLongError).toBeVisible({ timeout: 5_000 });
});

Then('I test min max value validation for number', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  // Test: Min > Max (set min=100, max=50)
  await this.page.fill('#field-min', '100');
  await this.page.fill('#field-max', '50');
  await this.page.locator('#field-label').click(); // Blur
  
  const minGreaterThanMaxError = this.page.locator('text=/Minimum value must be less than or equal to maximum value/i').first();
  await expect(minGreaterThanMaxError).toBeVisible({ timeout: 5_000 });
});

Then('I test default value range validation for number', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  // Setup valid min/max first
  await this.page.fill('#field-min', '10');
  await this.page.fill('#field-max', '100');

  // Test 1: Default value < Min
  await this.page.fill('#field-defaultValue', '5');
  await this.page.locator('#field-label').click(); // Blur
  
  const defaultValueRangeError = this.page.locator('text=/Default value must be within the specified range/i').first();
  await expect(defaultValueRangeError).toBeVisible({ timeout: 5_000 });

  // Test 2: Default value > Max
  await this.page.fill('#field-defaultValue', '150');
  await this.page.locator('#field-label').click(); // Blur
  
  await expect(defaultValueRangeError).toBeVisible({ timeout: 5_000 });
});

Then('I fix all validation errors for number', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  // Fix label: Set valid length (< 200 chars)
  await this.page.fill('#field-label', `Quantity ${Date.now()}`);
  
  // Fix min/max: Set valid range
  await this.page.fill('#field-min', '0');
  await this.page.fill('#field-max', '100');
  
  // Fix default value: Set within range
  await this.page.fill('#field-defaultValue', '50');

  // Blur to trigger final validation
  await this.page.locator('#field-label').click();
  
  // Wait a bit for validation to complete
  await this.page.waitForTimeout(1000);
});

Then('I save the number field settings', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  // Click save button
  const saveButton = this.page.getByRole('button', { name: /save/i });
  await saveButton.click();

  // Wait for save to complete
  await this.page.waitForTimeout(1000);

  // Verify field is saved
  const fieldContent = this.page.getByTestId('field-content-1');
  await expect(fieldContent).toBeVisible({ timeout: 5_000 });
});

// Date Field Test Steps

Then('I drag a date field onto the page', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  const fieldTile = this.page.getByTestId('field-type-date');
  const droppablePage = this.page.getByTestId('droppable-page').first();
  
  // Get initial field count
  const initialCount = await droppablePage.locator('[data-testid^="field-content-"]').count();

  await fieldTile.dragTo(droppablePage);

  // Wait for count to increase
  await expect(async () => {
    const newCount = await droppablePage.locator('[data-testid^="field-content-"]').count();
    expect(newCount).toBeGreaterThan(initialCount);
  }).toPass({ timeout: 15000 });
});

When('I open the date field settings', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  // Find the last field card (the one we just dragged)
  const fieldCards = this.page.locator('[data-testid^="draggable-field-"]');
  await expect(fieldCards.last()).toBeVisible({ timeout: 10_000 });
  const lastFieldCard = fieldCards.last();
  
  // Hover to show actions
  await lastFieldCard.hover();

  // Find the settings button within the last field card
  const settingsButton = lastFieldCard.locator('[data-testid^="field-settings-button-"]');
  await expect(settingsButton).toBeVisible({ timeout: 5_000 });
  
  // Wait for stability
  await this.page.waitForTimeout(1000);
  
  // Force click to avoid interception issues
  await settingsButton.click({ force: true });

  // Wait for settings panel to be visible
  const settingsPanel = this.page.getByTestId('field-settings-panel');
  await expect(settingsPanel).toBeVisible({ timeout: 15_000 });
  
  // Wait for specific date field input to ensure it's the right panel
  await this.page.waitForSelector('#field-label', { timeout: 10_000 });
});

Then('I fill the date field settings with valid data', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  // Fill settings with valid data
  const settingsPanel = this.page.getByTestId('field-settings-panel');
  await expect(settingsPanel).toBeVisible({ timeout: 15_000 });

  await this.page.waitForSelector('#field-label', { timeout: 10_000 });
  await this.page.fill('#field-label', `Event Date ${Date.now()}`);
  await this.page.fill('#field-hint', 'Select the date of the event.');
  await this.page.fill('#field-placeholder', 'MM/DD/YYYY');
  
  // Set min/max dates (YYYY-MM-DD format for date inputs)
  await this.page.fill('#field-minDate', '2024-01-01');
  await this.page.fill('#field-maxDate', '2024-12-31');
  
  // Set default value
  await this.page.fill('#field-defaultValue', '2024-06-15');

  // Required toggle
  const requiredToggle = this.page.locator('#field-required');
  const isChecked = await requiredToggle.isChecked();
  if (!isChecked) {
    await requiredToggle.click();
  }

  // Assert values persisted
  await expect(this.page.locator('#field-label')).toHaveValue(/Event Date/);
  await expect(this.page.locator('#field-placeholder')).toHaveValue('MM/DD/YYYY');
});

Then('I test label and hint validation for date', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  // Test 1: Empty label (required field)
  await this.page.fill('#field-label', '');
  await this.page.locator('#field-hint').click(); // Blur to trigger validation
  
  const emptyLabelError = this.page.locator('text=/Field label is required/i').first();
  await expect(emptyLabelError).toBeVisible({ timeout: 5_000 });

  // Test 2: Label too long (201 characters)
  const longLabel = 'A'.repeat(201);
  await this.page.fill('#field-label', longLabel);
  await this.page.locator('#field-hint').click(); // Blur to trigger validation
  
  const labelTooLongError = this.page.locator('text=/Label is too long/i').first();
  await expect(labelTooLongError).toBeVisible({ timeout: 5_000 });

  // Test 3: Hint too long (501 characters)
  const longHint = 'B'.repeat(501);
  await this.page.fill('#field-hint', longHint);
  await this.page.locator('#field-label').click();
  
  const hintTooLongError = this.page.locator('text=/Help text is too long/i').first();
  await expect(hintTooLongError).toBeVisible({ timeout: 5_000 });

  // Test 4: Placeholder too long (101 characters)
  const longPlaceholder = 'C'.repeat(101);
  await this.page.fill('#field-placeholder', longPlaceholder);
  await this.page.locator('#field-label').click();
  
  const placeholderTooLongError = this.page.locator('text=/Placeholder is too long/i').first();
  await expect(placeholderTooLongError).toBeVisible({ timeout: 5_000 });
});

Then('I test min max date validation for date', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  // Test: Min date > Max date (set min=2024-12-31, max=2024-01-01)
  await this.page.fill('#field-minDate', '2024-12-31');
  await this.page.fill('#field-maxDate', '2024-01-01');
  await this.page.locator('#field-label').click(); // Blur
  
  const minGreaterThanMaxError = this.page.locator('text=/Minimum date must be before or equal to maximum date/i').first();
  await expect(minGreaterThanMaxError).toBeVisible({ timeout: 5_000 });
});

Then('I test default value date validation for date', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  // Setup valid min/max first
  await this.page.fill('#field-minDate', '2024-01-01');
  await this.page.fill('#field-maxDate', '2024-12-31');

  // Test 1: Default value < Min
  await this.page.fill('#field-defaultValue', '2023-12-31');
  await this.page.locator('#field-label').click(); // Blur
  
  const defaultValueRangeError = this.page.locator('text=/Default value must be within the specified date range/i').first();
  await expect(defaultValueRangeError).toBeVisible({ timeout: 5_000 });

  // Test 2: Default value > Max
  await this.page.fill('#field-defaultValue', '2025-01-01');
  await this.page.locator('#field-label').click(); // Blur
  
  await expect(defaultValueRangeError).toBeVisible({ timeout: 5_000 });
});

Then('I fix all validation errors for date', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  // Fix label: Set valid length (< 200 chars)
  await this.page.fill('#field-label', `Event Date ${Date.now()}`);
  
  // Fix hint: Set valid length (< 500 chars)
  await this.page.fill('#field-hint', 'Select the date of the event.');
  
  // Fix placeholder: Set valid length (< 100 chars)
  await this.page.fill('#field-placeholder', 'MM/DD/YYYY');
  
  // Fix min/max dates: Set valid range
  await this.page.fill('#field-minDate', '2024-01-01');
  await this.page.fill('#field-maxDate', '2024-12-31');
  
  // Fix default value: Set within range
  await this.page.fill('#field-defaultValue', '2024-06-15');

  // Blur to trigger final validation
  await this.page.locator('#field-label').click();
  
  // Wait a bit for validation to complete
  await this.page.waitForTimeout(1000);
});

Then('I save the date field settings', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  // Click save button
  const saveButton = this.page.getByRole('button', { name: /save/i });
  await saveButton.click();

  // Wait for save to complete
  await this.page.waitForTimeout(1000);

  // Verify field is saved
  const fieldContent = this.page.getByTestId('field-content-1');
  await expect(fieldContent).toBeVisible({ timeout: 5_000 });
});

// Dropdown (Select) Field Test Steps

Then('I drag a dropdown field onto the page', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  const fieldTile = this.page.getByTestId('field-type-dropdown');
  const droppablePage = this.page.getByTestId('droppable-page').first();
  
  // Get initial field count
  const initialCount = await droppablePage.locator('[data-testid^="field-content-"]').count();

  await fieldTile.dragTo(droppablePage);

  // Wait for count to increase
  await expect(async () => {
    const newCount = await droppablePage.locator('[data-testid^="field-content-"]').count();
    expect(newCount).toBeGreaterThan(initialCount);
  }).toPass({ timeout: 15000 });
});

When('I open the dropdown field settings', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  // Find the last field card (the one we just dragged)
  const fieldCards = this.page.locator('[data-testid^="draggable-field-"]');
  await expect(fieldCards.last()).toBeVisible({ timeout: 10_000 });
  const lastFieldCard = fieldCards.last();
  
  // Hover to show actions
  await lastFieldCard.hover();

  // Find the settings button within the last field card
  const settingsButton = lastFieldCard.locator('[data-testid^="field-settings-button-"]');
  await expect(settingsButton).toBeVisible({ timeout: 5_000 });
  
  // Wait for stability
  await this.page.waitForTimeout(1000);
  
  // Force click to avoid interception issues
  await settingsButton.click({ force: true });

  // Wait for settings panel to be visible
  const settingsPanel = this.page.getByTestId('field-settings-panel');
  await expect(settingsPanel).toBeVisible({ timeout: 15_000 });
  
  // Wait for specific dropdown field input to ensure it's the right panel
  await this.page.waitForSelector('#field-label', { timeout: 10_000 });
});

Then('I fill the dropdown field settings with valid data', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  // Fill settings with valid data
  const settingsPanel = this.page.getByTestId('field-settings-panel');
  await expect(settingsPanel).toBeVisible({ timeout: 15_000 });

  await this.page.waitForSelector('#field-label', { timeout: 10_000 });
  await this.page.fill('#field-label', `Country Selection ${Date.now()}`);
  await this.page.fill('#field-hint', 'Select your country from the list.');
  
  // Fill option values - we need to find option input fields
  const optionInputs = this.page.locator('input[placeholder="Enter option value"]');
  const optionCount = await optionInputs.count();
  
  if (optionCount > 0) {
    // Fill first option
    await optionInputs.nth(0).fill('USA');
    
    // Add more options if needed
    const addOptionButton = this.page.locator('button:has-text("Add Option")');
    if (await addOptionButton.count() > 0) {
      await addOptionButton.click();
      await this.page.waitForTimeout(500);
      await optionInputs.nth(1).fill('Canada');
      
      await addOptionButton.click();
      await this.page.waitForTimeout(500);
      await optionInputs.nth(2).fill('Mexico');
    }
  }

  // Required toggle
  const requiredToggle = this.page.locator('#field-required');
  const isChecked = await requiredToggle.isChecked();
  if (!isChecked) {
    await requiredToggle.click();
  }

  // Assert values persisted
  await expect(this.page.locator('#field-label')).toHaveValue(/Country Selection/);
});

Then('I test label and hint validation for dropdown', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  // Test 1: Empty label (required field)
  await this.page.fill('#field-label', '');
  await this.page.locator('#field-hint').click(); // Blur to trigger validation
  
  const emptyLabelError = this.page.locator('text=/Field label is required/i').first();
  await expect(emptyLabelError).toBeVisible({ timeout: 5_000 });

  // Test 2: Label too long (201 characters)
  const longLabel = 'A'.repeat(201);
  await this.page.fill('#field-label', longLabel);
  await this.page.locator('#field-hint').click(); // Blur to trigger validation
  
  const labelTooLongError = this.page.locator('text=/Label is too long/i').first();
  await expect(labelTooLongError).toBeVisible({ timeout: 5_000 });

  // Test 3: Hint too long (501 characters)
  const longHint = 'B'.repeat(501);
  await this.page.fill('#field-hint', longHint);
  await this.page.locator('#field-label').click();
  
  const hintTooLongError = this.page.locator('text=/Help text is too long/i').first();
  await expect(hintTooLongError).toBeVisible({ timeout: 5_000 });
});

Then('I test options validation for dropdown', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  // Test 1: Empty option
  const optionInputs = this.page.locator('input[placeholder="Enter option value"]');
  if (await optionInputs.count() > 0) {
    await optionInputs.nth(0).fill('');
    await this.page.locator('#field-label').click(); // Blur
    
    const emptyOptionError = this.page.locator('text=/All options must have values/i, text=/Option cannot be empty/i').first();
    await expect(emptyOptionError).toBeVisible({ timeout: 5_000 });
  }

  // Test 2: Option too long (101 characters)
  const longOption = 'C'.repeat(101);
  if (await optionInputs.count() > 0) {
    await optionInputs.nth(0).fill(longOption);
    await this.page.locator('#field-label').click(); // Blur
    
    const optionTooLongError = this.page.locator('text=/Option is too long/i').first();
    await expect(optionTooLongError).toBeVisible({ timeout: 5_000 });
  }

  // Test 3: Duplicate options
  if (await optionInputs.count() >= 2) {
    await optionInputs.nth(0).fill('USA');
    await optionInputs.nth(1).fill('USA'); // Same as first
    await this.page.locator('#field-label').click(); // Blur
    
    const duplicateError = this.page.locator('text=/Options must be unique/i').first();
    await expect(duplicateError).toBeVisible({ timeout: 5_000 });
  }
});

Then('I fix all validation errors for dropdown', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  // Fix label: Set valid length (< 200 chars)
  await this.page.fill('#field-label', `Country Selection ${Date.now()}`);
  
  // Fix hint: Set valid length (< 500 chars)
  await this.page.fill('#field-hint', 'Select your country from the list.');
  
  // Fix options: Set valid, unique options
  const optionInputs = this.page.locator('input[placeholder="Enter option value"]');
  if (await optionInputs.count() > 0) {
    await optionInputs.nth(0).fill('USA');
  }
  if (await optionInputs.count() > 1) {
    await optionInputs.nth(1).fill('Canada');
  }
  if (await optionInputs.count() > 2) {
    await optionInputs.nth(2).fill('Mexico');
  }

  // Blur to trigger final validation
  await this.page.locator('#field-label').click();
  
  // Wait a bit for validation to complete
  await this.page.waitForTimeout(1000);
});

Then('I save the dropdown field settings', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  // Click save button
  const saveButton = this.page.getByRole('button', { name: /save/i });
  await saveButton.click();

  // Wait for save to complete
  await this.page.waitForTimeout(1000);

  // Verify field is saved
  const fieldContent = this.page.getByTestId('field-content-1');
  await expect(fieldContent).toBeVisible({ timeout: 5_000 });
});

// Radio Field Test Steps

Then('I drag a radio field onto the page', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  const fieldTile = this.page.getByTestId('field-type-radio');
  const droppablePage = this.page.getByTestId('droppable-page').first();
  
  // Get initial field count
  const initialCount = await droppablePage.locator('[data-testid^="field-content-"]').count();

  await fieldTile.dragTo(droppablePage);

  // Wait for count to increase
  await expect(async () => {
    const newCount = await droppablePage.locator('[data-testid^="field-content-"]').count();
    expect(newCount).toBeGreaterThan(initialCount);
  }).toPass({ timeout: 15000 });
});

When('I open the radio field settings', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  // Find the last field card (the one we just dragged)
  const fieldCards = this.page.locator('[data-testid^="draggable-field-"]');
  await expect(fieldCards.last()).toBeVisible({ timeout: 10_000 });
  const lastFieldCard = fieldCards.last();
  
  // Hover to show actions
  await lastFieldCard.hover();

  // Find the settings button within the last field card
  const settingsButton = lastFieldCard.locator('[data-testid^="field-settings-button-"]');
  await expect(settingsButton).toBeVisible({ timeout: 5_000 });
  
  // Wait for stability
  await this.page.waitForTimeout(1000);
  
  // Force click to avoid interception issues
  await settingsButton.click({ force: true });

  // Wait for settings panel to be visible
  const settingsPanel = this.page.getByTestId('field-settings-panel');
  await expect(settingsPanel).toBeVisible({ timeout: 15_000 });
  
  // Wait for specific radio field input to ensure it's the right panel
  await this.page.waitForSelector('#field-label', { timeout: 10_000 });
});

Then('I fill the radio field settings with valid data', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  // Fill settings with valid data
  const settingsPanel = this.page.getByTestId('field-settings-panel');
  await expect(settingsPanel).toBeVisible({ timeout: 15_000 });

  await this.page.waitForSelector('#field-label', { timeout: 10_000 });
  await this.page.fill('#field-label', `Gender Selection ${Date.now()}`);
  await this.page.fill('#field-hint', 'Please select your gender.');
  
  // Fill option values
  const optionInputs = this.page.locator('input[placeholder="Enter option value"]');
  const optionCount = await optionInputs.count();
  
  if (optionCount > 0) {
    // Fill first option
    await optionInputs.nth(0).fill('Male');
    
    // Add more options if needed
    const addOptionButton = this.page.locator('button:has-text("Add Option")');
    if (await addOptionButton.count() > 0) {
      await addOptionButton.click();
      await this.page.waitForTimeout(500);
      await optionInputs.nth(1).fill('Female');
      
      await addOptionButton.click();
      await this.page.waitForTimeout(500);
      await optionInputs.nth(2).fill('Other');
    }
  }

  // Required toggle
  const requiredToggle = this.page.locator('#field-required');
  const isChecked = await requiredToggle.isChecked();
  if (!isChecked) {
    await requiredToggle.click();
  }

  // Assert values persisted
  await expect(this.page.locator('#field-label')).toHaveValue(/Gender Selection/);
});

Then('I test label and hint validation for radio', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  // Test 1: Empty label (required field)
  await this.page.fill('#field-label', '');
  await this.page.locator('#field-hint').click(); // Blur to trigger validation
  
  const emptyLabelError = this.page.locator('text=/Field label is required/i').first();
  await expect(emptyLabelError).toBeVisible({ timeout: 5_000 });

  // Test 2: Label too long (201 characters)
  const longLabel = 'A'.repeat(201);
  await this.page.fill('#field-label', longLabel);
  await this.page.locator('#field-hint').click(); // Blur to trigger validation
  
  const labelTooLongError = this.page.locator('text=/Label is too long/i').first();
  await expect(labelTooLongError).toBeVisible({ timeout: 5_000 });

  // Test 3: Hint too long (501 characters)
  const longHint = 'B'.repeat(501);
  await this.page.fill('#field-hint', longHint);
  await this.page.locator('#field-label').click();
  
  const hintTooLongError = this.page.locator('text=/Help text is too long/i').first();
  await expect(hintTooLongError).toBeVisible({ timeout: 5_000 });
});

Then('I test options validation for radio', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  // Test 1: Empty option
  const optionInputs = this.page.locator('input[placeholder="Enter option value"]');
  if (await optionInputs.count() > 0) {
    await optionInputs.nth(0).fill('');
    await this.page.locator('#field-label').click(); // Blur
    
    const emptyOptionError = this.page.locator('text=/All options must have values/i, text=/Option cannot be empty/i').first();
    await expect(emptyOptionError).toBeVisible({ timeout: 5_000 });
  }

  // Test 2: Option too long (101 characters)
  const longOption = 'C'.repeat(101);
  if (await optionInputs.count() > 0) {
    await optionInputs.nth(0).fill(longOption);
    await this.page.locator('#field-label').click(); // Blur
    
    const optionTooLongError = this.page.locator('text=/Option is too long/i').first();
    await expect(optionTooLongError).toBeVisible({ timeout: 5_000 });
  }

  // Test 3: Duplicate options
  if (await optionInputs.count() >= 2) {
    await optionInputs.nth(0).fill('Male');
    await optionInputs.nth(1).fill('Male'); // Same as first
    await this.page.locator('#field-label').click(); // Blur
    
    const duplicateError = this.page.locator('text=/Options must be unique/i').first();
    await expect(duplicateError).toBeVisible({ timeout: 5_000 });
  }
});

Then('I fix all validation errors for radio', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  // Fix label: Set valid length (< 200 chars)
  await this.page.fill('#field-label', `Gender Selection ${Date.now()}`);
  
  // Fix hint: Set valid length (< 500 chars)
  await this.page.fill('#field-hint', 'Please select your gender.');
  
  // Fix options: Set valid, unique options
  const optionInputs = this.page.locator('input[placeholder="Enter option value"]');
  if (await optionInputs.count() > 0) {
    await optionInputs.nth(0).fill('Male');
  }
  if (await optionInputs.count() > 1) {
    await optionInputs.nth(1).fill('Female');
  }
  if (await optionInputs.count() > 2) {
    await optionInputs.nth(2).fill('Other');
  }

  // Blur to trigger final validation
  await this.page.locator('#field-label').click();
  
  // Wait a bit for validation to complete
  await this.page.waitForTimeout(1000);
});

Then('I save the radio field settings', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  // Click save button
  const saveButton = this.page.getByRole('button', { name: /save/i });
  await saveButton.click();

  // Wait for save to complete
  await this.page.waitForTimeout(1000);

  // Verify field is saved
  const fieldContent = this.page.getByTestId('field-content-1');
  await expect(fieldContent).toBeVisible({ timeout: 5_000 });
});

// Checkbox Field Test Steps

Then('I drag a checkbox field onto the page', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  const fieldTile = this.page.getByTestId('field-type-checkbox');
  const droppablePage = this.page.getByTestId('droppable-page').first();
  
  // Get initial field count
  const initialCount = await droppablePage.locator('[data-testid^="field-content-"]').count();

  await fieldTile.dragTo(droppablePage);

  // Wait for count to increase
  await expect(async () => {
    const newCount = await droppablePage.locator('[data-testid^="field-content-"]').count();
    expect(newCount).toBeGreaterThan(initialCount);
  }).toPass({ timeout: 15000 });
});

When('I open the checkbox field settings', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  // Find the last field card (the one we just dragged)
  const fieldCards = this.page.locator('[data-testid^="draggable-field-"]');
  await expect(fieldCards.last()).toBeVisible({ timeout: 10_000 });
  const lastFieldCard = fieldCards.last();
  
  // Hover to show actions
  await lastFieldCard.hover();

  // Find the settings button within the last field card
  const settingsButton = lastFieldCard.locator('[data-testid^="field-settings-button-"]');
  await expect(settingsButton).toBeVisible({ timeout: 5_000 });
  
  // Wait for stability
  await this.page.waitForTimeout(1000);
  
  // Force click to avoid interception issues
  await settingsButton.click({ force: true });

  // Wait for settings panel to be visible
  const settingsPanel = this.page.getByTestId('field-settings-panel');
  await expect(settingsPanel).toBeVisible({ timeout: 15_000 });
  
  // Wait for specific checkbox field input to ensure it's the right panel
  await this.page.waitForSelector('#field-label', { timeout: 10_000 });
});

Then('I fill the checkbox field settings with valid data', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  // Fill settings with valid data
  const settingsPanel = this.page.getByTestId('field-settings-panel');
  await expect(settingsPanel).toBeVisible({ timeout: 15_000 });

  await this.page.waitForSelector('#field-label', { timeout: 10_000 });
  await this.page.fill('#field-label', `Hobbies ${Date.now()}`);
  await this.page.fill('#field-hint', 'Select your favorite hobbies.');
  
  // Fill option values
  const optionInputs = this.page.locator('input[placeholder="Enter option value"]');
  const optionCount = await optionInputs.count();
  
  if (optionCount > 0) {
    // Fill first option
    await optionInputs.nth(0).fill('Reading');
    
    // Add more options
    const addOptionButton = this.page.locator('button:has-text("Add Option")');
    if (await addOptionButton.count() > 0) {
      await addOptionButton.click();
      await this.page.waitForTimeout(500);
      await optionInputs.nth(1).fill('Gaming');
      
      await addOptionButton.click();
      await this.page.waitForTimeout(500);
      await optionInputs.nth(2).fill('Sports');
      
      await addOptionButton.click();
      await this.page.waitForTimeout(500);
      await optionInputs.nth(3).fill('Music');
    }
  }

  // Set selection limits
  await this.page.fill('input[name="validation.minSelections"]', '1');
  await this.page.fill('input[name="validation.maxSelections"]', '3');

  // Required toggle
  const requiredToggle = this.page.locator('#field-required');
  const isChecked = await requiredToggle.isChecked();
  if (!isChecked) {
    await requiredToggle.click();
  }

  // Assert values persisted
  await expect(this.page.locator('#field-label')).toHaveValue(/Hobbies/);
});

Then('I test label and hint validation for checkbox', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  // Test 1: Empty label (required field)
  await this.page.fill('#field-label', '');
  await this.page.locator('#field-hint').click(); // Blur to trigger validation
  
  const emptyLabelError = this.page.locator('text=/Field label is required/i').first();
  await expect(emptyLabelError).toBeVisible({ timeout: 5_000 });

  // Test 2: Label too long (201 characters)
  const longLabel = 'A'.repeat(201);
  await this.page.fill('#field-label', longLabel);
  await this.page.locator('#field-hint').click(); // Blur to trigger validation
  
  const labelTooLongError = this.page.locator('text=/Label is too long/i').first();
  await expect(labelTooLongError).toBeVisible({ timeout: 5_000 });

  // Test 3: Hint too long (501 characters)
  const longHint = 'B'.repeat(501);
  await this.page.fill('#field-hint', longHint);
  await this.page.locator('#field-label').click();
  
  const hintTooLongError = this.page.locator('text=/Help text is too long/i').first();
  await expect(hintTooLongError).toBeVisible({ timeout: 5_000 });
});

Then('I test options validation for checkbox', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  // Test 1: Empty option
  const optionInputs = this.page.locator('input[placeholder="Enter option value"]');
  if (await optionInputs.count() > 0) {
    await optionInputs.nth(0).fill('');
    await this.page.locator('#field-label').click(); // Blur
    
    const emptyOptionError = this.page.locator('text=/All options must have values/i, text=/Option cannot be empty/i').first();
    await expect(emptyOptionError).toBeVisible({ timeout: 5_000 });
  }

  // Test 2: Option too long (101 characters)
  const longOption = 'C'.repeat(101);
  if (await optionInputs.count() > 0) {
    await optionInputs.nth(0).fill(longOption);
    await this.page.locator('#field-label').click(); // Blur
    
    const optionTooLongError = this.page.locator('text=/Option is too long/i').first();
    await expect(optionTooLongError).toBeVisible({ timeout: 5_000 });
  }

  // Test 3: Duplicate options
  if (await optionInputs.count() >= 2) {
    await optionInputs.nth(0).fill('Reading');
    await optionInputs.nth(1).fill('Reading'); // Same as first
    await this.page.locator('#field-label').click(); // Blur
    
    const duplicateError = this.page.locator('text=/Options must be unique/i').first();
    await expect(duplicateError).toBeVisible({ timeout: 5_000 });
  }
});

Then('I test selection limits validation for checkbox', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  // First fix options to have valid values
  const optionInputs = this.page.locator('input[placeholder="Enter option value"]');
  if (await optionInputs.count() > 0) {
    await optionInputs.nth(0).fill('Reading');
  }
  if (await optionInputs.count() > 1) {
    await optionInputs.nth(1).fill('Gaming');
  }
  if (await optionInputs.count() > 2) {
    await optionInputs.nth(2).fill('Sports');
  }

  // Test 1: minSelections > maxSelections
  await this.page.fill('input[name="validation.minSelections"]', '3');
  await this.page.fill('input[name="validation.maxSelections"]', '2');
  await this.page.locator('#field-label').click(); // Blur
  
  const minMaxError = this.page.locator('text=/Minimum selections must be less than or equal to maximum selections/i').first();
  await expect(minMaxError).toBeVisible({ timeout: 5_000 });

  // Note: The maxSelections > options count validation exists in schema but is validated on form submit
  // We verify it prevents save in the "save button disabled" step
});

Then('I fix all validation errors for checkbox', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  // Fix label: Set valid length (< 200 chars)
  await this.page.fill('#field-label', `Hobbies ${Date.now()}`);
  
  // Fix hint: Set valid length (< 500 chars)
  await this.page.fill('#field-hint', 'Select your favorite hobbies.');
  
  // Fix options: Set valid, unique options
  const optionInputs = this.page.locator('input[placeholder="Enter option value"]');
  if (await optionInputs.count() > 0) {
    await optionInputs.nth(0).fill('Reading');
  }
  if (await optionInputs.count() > 1) {
    await optionInputs.nth(1).fill('Gaming');
  }
  if (await optionInputs.count() > 2) {
    await optionInputs.nth(2).fill('Sports');
  }
  if (await optionInputs.count() > 3) {
    await optionInputs.nth(3).fill('Music');
  }

  // Fix selection limits: Set valid range
  await this.page.fill('input[name="validation.minSelections"]', '1');
  await this.page.fill('input[name="validation.maxSelections"]', '3');

  // Force complete revalidation by clicking through fields multiple times
  await this.page.click('#field-label');
  await this.page.waitForTimeout(500);
  await this.page.click('#field-hint');
  await this.page.waitForTimeout(500);
  await this.page.click('input[name="validation.minSelections"]');
  await this.page.waitForTimeout(500);
  await this.page.click('input[name="validation.maxSelections"]');
  await this.page.waitForTimeout(500);
  await this.page.click('#field-label'); // Final blur
  
  // Wait longer for all validations to complete
  await this.page.waitForTimeout(3000);
});

Then('I save the checkbox field settings', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  // Click save button
  const saveButton = this.page.getByRole('button', { name: /save/i });
  await saveButton.click();

  // Wait for save to complete
  await this.page.waitForTimeout(1000);

  // Verify field is saved
  const fieldContent = this.page.getByTestId('field-content-1');
  await expect(fieldContent).toBeVisible({ timeout: 5_000 });
});

Then('I fix selection limits for checkbox', async function (this: CustomWorld) {
  if (!this.page) {
    throw new Error('Page is not initialized');
  }

  // Simply set valid selection limits without touching other fields
  await this.page.fill('input[name="validation.minSelections"]', '1');
  await this.page.fill('input[name="validation.maxSelections"]', '3');

  // Blur to trigger validation
  await this.page.click('#field-label');
  
  // Wait for validation to complete
  await this.page.waitForTimeout(1000);
});
