/**
 * Conditional logic collaboration E2E steps
 */

import { Given, When, Then } from '@cucumber/cucumber';
import { expect, type Page } from '@playwright/test';
import { CustomWorld } from '../support/world';
import { STORAGE_STATE_PATH } from '../support/authStorage';
import { expectPoll } from '../support/expectPoll';
import { attachDiagnostics } from '../support/diagnostics';

/**
 * Get the Playwright Page object for the specified session name
 */
function getSessionPage(world: CustomWorld, sessionName: string): Page {
  const name = sessionName.toLowerCase();
  if (name.includes('a')) {
    if (!world.page) throw new Error('Session A page is not initialized');
    return world.page;
  }
  if (name.includes('b')) {
    if (!world.pageB) throw new Error('Session B page is not initialized');
    return world.pageB;
  }
  throw new Error(`Unknown session: ${sessionName}`);
}

/**
 * Open two collaborative builder sessions on the conditions tab
 */
Given('I open two collaborative builder sessions on the conditions tab', async function (this: CustomWorld) {
  if (!this.page) throw new Error('Page is not initialized');
  if (!this.currentFormId) throw new Error('No current form id');

  // Navigate session A to conditions tab
  await this.page.goto(`${this.baseUrl}/dashboard/form/${this.currentFormId}/builder/conditions`);
  const builderRootA = this.page.getByTestId('collaborative-form-builder');
  await expect(builderRootA).toBeVisible({ timeout: 45_000 });
  await expect(this.page.getByTestId('conditions-title')).toBeVisible({ timeout: 15_000 });

  // Launch session B
  this.contextB = await this.browser!.newContext({
    storageState: STORAGE_STATE_PATH,
    baseURL: this.baseUrl,
    viewport: { width: 1280, height: 720 },
  });
  this.pageB = await this.contextB.newPage();
  attachDiagnostics(this, this.pageB, 'pageB');
  
  // Navigate session B to conditions tab
  await this.pageB.goto(`${this.baseUrl}/dashboard/form/${this.currentFormId}/builder/conditions`);
  const builderRootB = this.pageB.getByTestId('collaborative-form-builder');
  await expect(builderRootB).toBeVisible({ timeout: 45_000 });
  await expect(this.pageB.getByTestId('conditions-title')).toBeVisible({ timeout: 15_000 });

  // Give a short delay for synchronization setup
  await this.page.waitForTimeout(2000);
  await this.pageB.waitForTimeout(2000);
});

/**
 * Add a condition rule showing a target field when a trigger is equal to option in specified session
 */
When(
  'In session {string} I add a rule showing {string} when {string} is equal to {string}',
  async function (this: CustomWorld, session: string, targetFieldId: string, triggerLabel: string, optionValue: string) {
    const page = getSessionPage(this, session);
    await page.getByTestId('condition-add-rule').click();

    // IF: trigger field → operator defaults to "is equal to" → option value
    await page.getByTestId('condition-term-field-0').click();
    await page.getByRole('option', { name: triggerLabel }).click();
    await page.getByTestId('condition-term-value-0').click();
    await page.getByRole('option', { name: optionValue, exact: true }).click();

    // THEN: default action type is "Show field(s)" — tick the target field
    await page.getByTestId(`condition-action-target-0-${targetFieldId}`).click();

    const save = page.getByTestId('condition-save');
    await expect(save).toBeEnabled({ timeout: 5_000 });
    await save.click();
    await page.waitForTimeout(1000);
  }
);

/**
 * Add a condition rule hiding a page when a trigger is equal to option in specified session
 */
When(
  'In session {string} I add a rule hiding page {string} when {string} is equal to {string}',
  async function (this: CustomWorld, session: string, pageLabel: string, triggerLabel: string, optionValue: string) {
    const page = getSessionPage(this, session);
    await page.getByTestId('condition-add-rule').click();

    // IF: trigger field → operator defaults to "is equal to" → option value
    await page.getByTestId('condition-term-field-0').click();
    await page.getByRole('option', { name: triggerLabel }).click();
    await page.getByTestId('condition-term-value-0').click();
    await page.getByRole('option', { name: optionValue, exact: true }).click();

    // THEN: action type to Hide page
    await page.getByTestId('condition-action-type-0').click();
    await page.getByRole('option', { name: 'Hide page' }).click();

    // Select page
    await page.getByTestId('condition-action-page-0').click();
    await page.getByRole('option', { name: pageLabel }).click();

    const save = page.getByTestId('condition-save');
    await expect(save).toBeEnabled({ timeout: 5_000 });
    await save.click();
    await page.waitForTimeout(1000);
  }
);

/**
 * Assert a condition rule card is visible in specified session
 */
Then(
  'In session {string} I should see a condition rule card for {string}',
  async function (this: CustomWorld, session: string, triggerLabel: string) {
    const page = getSessionPage(this, session);
    await expectPoll(async () => {
      const card = page.locator('[data-testid^="condition-card-"]').filter({ hasText: triggerLabel });
      return (await card.count()) > 0;
    }, { message: `Expected to see condition card for ${triggerLabel} in session ${session}`, timeout: 15_000 });
  }
);

/**
 * Assert condition rule card summary in specified session
 */
Then(
  'In session {string} the condition card for {string} should show {string} in its summary',
  async function (this: CustomWorld, session: string, triggerLabel: string, expectedText: string) {
    const page = getSessionPage(this, session);
    const card = page.locator('[data-testid^="condition-card-"]').filter({ hasText: triggerLabel }).first();
    await expect(card).toBeVisible({ timeout: 10_000 });
    
    const textContent = await card.textContent();
    if (!textContent) throw new Error('Card textContent is empty');
    
    const normalize = (str: string) => str.replace(/[\u201c\u201d]/g, '"').replace(/\s+/g, '').trim();
    
    const normalizedActual = normalize(textContent);
    const normalizedExpected = normalize(expectedText);
    
    if (!normalizedActual.includes(normalizedExpected)) {
      throw new Error(`Expected card summary to contain "${normalizedExpected}", but got "${normalizedActual}"`);
    }
  }
);

/**
 * Toggle condition rule in specified session
 */
When(
  'In session {string} I toggle the condition rule for {string}',
  async function (this: CustomWorld, session: string, triggerLabel: string) {
    const page = getSessionPage(this, session);
    const card = page.locator('[data-testid^="condition-card-"]').filter({ hasText: triggerLabel }).first();
    await expect(card).toBeVisible({ timeout: 10_000 });
    const toggle = card.locator('[data-testid^="condition-toggle-"]');
    await toggle.click();
    await page.waitForTimeout(1000);
  }
);

/**
 * Assert switch state is disabled (rule is toggled off) in specified session
 */
Then(
  'In session {string} the condition rule switch state should update to disabled',
  async function (this: CustomWorld, session: string) {
    const page = getSessionPage(this, session);
    const toggle = page.locator('[data-testid^="condition-toggle-"]').first();
    await expectPoll(async () => {
       const isChecked = await toggle.getAttribute('aria-checked');
       return isChecked === 'false';
    }, { message: 'Expected switch to update to disabled', timeout: 15_000 });
  }
);

/**
 * Delete condition rule in specified session
 */
When(
  'In session {string} I delete the condition rule for {string}',
  async function (this: CustomWorld, session: string, triggerLabel: string) {
    const page = getSessionPage(this, session);
    const card = page.locator('[data-testid^="condition-card-"]').filter({ hasText: triggerLabel }).first();
    await expect(card).toBeVisible({ timeout: 10_000 });
    const deleteBtn = card.locator('[data-testid^="condition-delete-"]');
    await deleteBtn.click();
    await page.waitForTimeout(1000);
  }
);

/**
 * Assert conditions empty state is visible in specified session
 */
Then(
  'In session {string} I should see the conditions empty state',
  async function (this: CustomWorld, session: string) {
    const page = getSessionPage(this, session);
    await expect(page.getByTestId('conditions-empty-state')).toBeVisible({ timeout: 15_000 });
  }
);

/**
 * Edit condition rule in specified session
 */
When(
  'In session {string} I edit the condition rule for {string}',
  async function (this: CustomWorld, session: string, triggerLabel: string) {
    const page = getSessionPage(this, session);
    const card = page.locator('[data-testid^="condition-card-"]').filter({ hasText: triggerLabel }).first();
    await expect(card).toBeVisible({ timeout: 10_000 });
    const editBtn = card.locator('[data-testid^="condition-edit-"]');
    await editBtn.click();
  }
);

/**
 * Update rule terms in specified session
 */
When(
  'In session {string} I update the rule terms at index {int} to field {string}, operator {string}, value {string}',
  async function (this: CustomWorld, session: string, index: number, fieldLabel: string, operatorKey: string, value: string) {
    const page = getSessionPage(this, session);
    
    // Select field
    await page.getByTestId(`condition-term-field-${index}`).click();
    await page.getByRole('option', { name: fieldLabel }).click();

    // Select operator
    const operatorLabels: Record<string, string> = {
      equals: 'is equal to',
      notEquals: 'is not equal to',
      contains: 'contains',
      notContains: 'does not contain',
      startsWith: 'starts with',
      endsWith: 'ends with',
      isEmpty: 'is empty',
      isFilled: 'is filled',
      lessThan: 'is less than',
      greaterThan: 'is greater than',
      before: 'is before',
      after: 'is after',
    };
    const opLabel = operatorLabels[operatorKey] || operatorKey;

    await page.getByTestId(`condition-term-operator-${index}`).click();
    await page.getByRole('option', { name: opLabel }).click();

    // Select/fill value
    const valInput = page.getByTestId(`condition-term-value-${index}`);
    const tagName = await valInput.evaluate(el => el.tagName.toLowerCase());
    if (tagName === 'button') {
      await valInput.click();
      await page.getByRole('option', { name: value, exact: true }).click();
    } else {
      await valInput.fill(value);
    }
  }
);

/**
 * Update rule action in specified session
 */
When(
  'In session {string} I update the rule action at index {int} to type {string} and target field {string}',
  async function (this: CustomWorld, session: string, index: number, actionTypeKey: string, targetFieldId: string) {
    const page = getSessionPage(this, session);

    const actionLabels: Record<string, string> = {
      showField: 'Show field(s)',
      hideField: 'Hide field(s)',
      hidePage: 'Hide page',
    };
    const actLabel = actionLabels[actionTypeKey] || actionTypeKey;

    await page.getByTestId(`condition-action-type-${index}`).click();
    await page.getByRole('option', { name: actLabel }).click();

    const checkbox = page.getByTestId(`condition-action-target-${index}-${targetFieldId}`);
    const isChecked = await checkbox.isChecked();
    if (!isChecked) {
      await checkbox.click();
    }
  }
);

/**
 * Save condition rule in specified session
 */
When(
  'In session {string} I save the condition rule',
  async function (this: CustomWorld, session: string) {
    const page = getSessionPage(this, session);
    const saveBtn = page.getByTestId('condition-save');
    await expect(saveBtn).toBeEnabled({ timeout: 5_000 });
    await saveBtn.click();
    await page.waitForTimeout(1000);
  }
);

/**
 * Assert exactly one rule card exists in both sessions
 */
Then(
  'In both sessions there should be exactly one condition rule card for {string}',
  async function (this: CustomWorld, triggerLabel: string) {
    const pageA = this.page;
    const pageB = this.pageB;
    if (!pageA || !pageB) throw new Error('Both pages must be initialized');

    // Poll until both sessions have exactly one card
    await expectPoll(async () => {
      const countA = await pageA.locator('[data-testid^="condition-card-"]').count();
      const countB = await pageB.locator('[data-testid^="condition-card-"]').count();
      return countA === 1 && countB === 1;
    }, { message: 'Expected exactly one condition card in both sessions', timeout: 15_000 });

    const countA = await pageA.locator('[data-testid^="condition-card-"]').count();
    const countB = await pageB.locator('[data-testid^="condition-card-"]').count();
    expect(countA).toBe(1);
    expect(countB).toBe(1);
  }
);

/**
 * Assert the rule card matches B's final write in both sessions
 */
Then(
  'In both sessions that rule card\'s summary should equal one of the two writes',
  async function (this: CustomWorld) {
    const pageA = this.page;
    const pageB = this.pageB;
    if (!pageA || !pageB) throw new Error('Both pages must be initialized');

    const cardA = pageA.locator('[data-testid^="condition-card-"]').first();
    const cardB = pageB.locator('[data-testid^="condition-card-"]').first();

    const expectedB = 'IF Show bonus field? is not equal to "Yes" THEN Show field(s) Bonus Field';
    const normalize = (str: string) => str.replace(/[\u201c\u201d]/g, '"').replace(/\s+/g, '').trim();
    const normExpected = normalize(expectedB);

    await expectPoll(async () => {
      const textA = await cardA.textContent();
      const textB = await cardB.textContent();
      if (!textA || !textB) return false;
      const normA = normalize(textA);
      const normB = normalize(textB);
      return normA === normB && normA.includes(normExpected);
    }, { message: 'Expected both rule cards to converge and match Session B\'s write', timeout: 15_000 });

    const textA = await cardA.textContent();
    const textB = await cardB.textContent();
    const normA = normalize(textA || '');
    const normB = normalize(textB || '');
    expect(normA).toBe(normB);
    expect(normA).toContain(normExpected);
  }
);

/**
 * Open the page builder tab in specified session
 */
When(
  'In session {string} I open the page builder tab',
  async function (this: CustomWorld, session: string) {
    const page = getSessionPage(this, session);
    await page.getByTestId('tab-page-builder').click();
    await page.waitForTimeout(1000);
  }
);

/**
 * Delete a field in the builder in specified session
 */
When(
  'In session {string} I delete the field {string} in the builder',
  async function (this: CustomWorld, session: string, fieldId: string) {
    const page = getSessionPage(this, session);
    const card = page.getByTestId(`draggable-field-${fieldId}`);
    await expect(card).toBeVisible({ timeout: 10_000 });
    const deleteBtn = card.getByTitle('Delete field');
    await deleteBtn.click({ force: true });
    await expect(card).toHaveCount(0, { timeout: 10_000 });
    await page.waitForTimeout(1000);
  }
);

/**
 * Assert a broken reference badge exists in specified session
 */
Then(
  'In session {string} I should see a broken reference badge for the rule {string}',
  async function (this: CustomWorld, session: string, triggerLabel: string) {
    const page = getSessionPage(this, session);
    let card = page.locator('[data-testid^="condition-card-"]').filter({ hasText: triggerLabel });
    if (await card.count() === 0) {
      card = page.locator('[data-testid^="condition-card-"]').filter({
        has: page.locator(':text("deleted field"), :text("நீக்கப்பட்ட புலம்")')
      }).first();
    }
    await expect(card).toBeVisible({ timeout: 15_000 });
    const brokenBadge = card.locator('[data-testid^="condition-broken-"]');
    await expect(brokenBadge).toBeVisible({ timeout: 15_000 });
  }
);
