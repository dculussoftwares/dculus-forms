/**
 * Conditional logic E2E steps
 *
 * Covers the viewer runtime (show/hide fields, hide pages, submit-time strip)
 * and the builder Conditions tab (rule authoring). Field/page/rule ids in the
 * fixture schema are stable so steps can address inputs by name attribute.
 */

import { When, Then } from '@cucumber/cucumber';
import { expect } from '@playwright/test';
import { CustomWorld } from '../support/world';
import { createFormViaGraphQL, fetchLatestResponse } from './helpers';

const conditionalLogicFields = () => ({
  layout: {
    theme: 'light',
    textColor: '#000000',
    spacing: 'normal',
    code: 'L9',
    content: '<h1>Conditional Logic Test</h1>',
    customBackGroundColor: '#ffffff',
    backgroundImageKey: '',
    pageMode: 'multipage',
    isCustomBackgroundColorEnabled: false,
  },
  isShuffleEnabled: false,
  pages: [
    {
      id: 'cond-page-1',
      title: 'About',
      order: 0,
      fields: [
        {
          id: 'cond-show-bonus',
          type: 'radio_field',
          label: 'Show bonus field?',
          defaultValue: '',
          prefix: '',
          hint: '',
          options: ['Yes', 'No'],
          validation: { required: false, type: 'fillable_form_field' },
        },
        {
          id: 'cond-skip-details',
          type: 'radio_field',
          label: 'Skip details page?',
          defaultValue: '',
          prefix: '',
          hint: '',
          options: ['Yes', 'No'],
          validation: { required: false, type: 'fillable_form_field' },
        },
        {
          id: 'cond-bonus',
          type: 'text_input_field',
          label: 'Bonus Field',
          defaultValue: '',
          prefix: '',
          hint: '',
          placeholder: 'Bonus answer',
          validation: { required: false, type: 'text_field_validation' },
        },
      ],
    },
    {
      id: 'cond-page-2',
      title: 'Details',
      order: 1,
      fields: [
        {
          id: 'cond-details',
          type: 'text_input_field',
          label: 'Details Text',
          defaultValue: '',
          prefix: '',
          hint: '',
          placeholder: 'Details',
          validation: { required: false, type: 'text_field_validation' },
        },
      ],
    },
    {
      id: 'cond-page-3',
      title: 'Contact',
      order: 2,
      fields: [
        {
          id: 'cond-contact',
          type: 'text_input_field',
          label: 'Contact Note',
          defaultValue: '',
          prefix: '',
          hint: '',
          placeholder: 'Contact note',
          validation: { required: false, type: 'text_field_validation' },
        },
      ],
    },
  ],
});

const conditionalLogicSchemaWithRules = () => ({
  ...conditionalLogicFields(),
  conditions: [
    {
      id: 'rule-show-bonus',
      enabled: true,
      combinator: 'all',
      terms: [{ fieldId: 'cond-show-bonus', operator: 'equals', value: 'Yes' }],
      actions: [{ type: 'showField', fieldIds: ['cond-bonus'] }],
    },
    {
      id: 'rule-skip-details',
      enabled: true,
      combinator: 'all',
      terms: [{ fieldId: 'cond-skip-details', operator: 'equals', value: 'Yes' }],
      actions: [{ type: 'hidePage', pageId: 'cond-page-2' }],
    },
  ],
});

When(
  'I create a form via GraphQL with conditional logic rules',
  async function (this: CustomWorld) {
    await createFormViaGraphQL(
      this,
      conditionalLogicSchemaWithRules(),
      'E2E Conditional Logic Test'
    );
  }
);

When(
  'I create a form via GraphQL with conditional logic fields',
  async function (this: CustomWorld) {
    await createFormViaGraphQL(
      this,
      conditionalLogicFields(),
      'E2E Conditional Builder Test'
    );
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// Viewer interactions
// ─────────────────────────────────────────────────────────────────────────────

Then(
  'the viewer field {string} should be hidden',
  async function (this: CustomWorld, label: string) {
    if (!this.viewerPage) throw new Error('Viewer page is not initialized');
    await expect(this.viewerPage.getByText(label, { exact: true })).toHaveCount(0, {
      timeout: 10_000,
    });
  }
);

Then(
  'the viewer field {string} should be visible',
  async function (this: CustomWorld, label: string) {
    if (!this.viewerPage) throw new Error('Viewer page is not initialized');
    await expect(this.viewerPage.getByText(label, { exact: true }).first()).toBeVisible({
      timeout: 10_000,
    });
  }
);

When(
  'I choose viewer radio option {string} for {string}',
  async function (this: CustomWorld, option: string, fieldLabel: string) {
    if (!this.viewerPage) throw new Error('Viewer page is not initialized');
    // Scope to the field's container — both radio fields share Yes/No options
    const container = this.viewerPage
      .locator('form div')
      .filter({ has: this.viewerPage.getByText(fieldLabel, { exact: true }) })
      .filter({ has: this.viewerPage.getByRole('radiogroup') })
      .last();
    await container.getByRole('radio', { name: option, exact: true }).click();
    // Give the store sync + evaluator a beat to re-render visibility
    await this.viewerPage.waitForTimeout(300);
  }
);

When(
  'I fill the viewer input {string} with {string}',
  async function (this: CustomWorld, fieldId: string, value: string) {
    if (!this.viewerPage) throw new Error('Viewer page is not initialized');
    const input = this.viewerPage.locator(`input[name="${fieldId}"]`);
    await expect(input).toBeVisible({ timeout: 10_000 });
    await input.fill(value);
    await input.blur();
    await this.viewerPage.waitForTimeout(300);
  }
);

When(
  'I submit the conditional logic form in the viewer',
  async function (this: CustomWorld) {
    if (!this.viewerPage) throw new Error('Viewer page is not initialized');
    await this.viewerPage.getByTestId('viewer-submit-button').click();
    // Submission finished once the form UI is replaced by the thank-you view
    await expect(
      this.viewerPage.getByTestId('viewer-submit-button')
    ).toHaveCount(0, { timeout: 30_000 });
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// Stored-response assertions (submit-time strip)
// ─────────────────────────────────────────────────────────────────────────────

Then(
  'the stored response should include values for {string}',
  async function (this: CustomWorld, fieldIdsCsv: string) {
    const { data } = await fetchLatestResponse(this);
    for (const fieldId of fieldIdsCsv.split(',').map((s) => s.trim())) {
      expect(
        data[fieldId],
        `expected response data to include a value for "${fieldId}" — got keys: ${Object.keys(data).join(', ')}`
      ).toBeTruthy();
    }
  }
);

Then(
  'the stored response should not include values for {string}',
  async function (this: CustomWorld, fieldIdsCsv: string) {
    const { data } = await fetchLatestResponse(this);
    for (const fieldId of fieldIdsCsv.split(',').map((s) => s.trim())) {
      expect(
        data[fieldId],
        `expected response data to NOT include "${fieldId}" — got keys: ${Object.keys(data).join(', ')}`
      ).toBeUndefined();
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// Builder Conditions tab
// ─────────────────────────────────────────────────────────────────────────────

When('I open the conditions tab', async function (this: CustomWorld) {
  if (!this.page) throw new Error('Page is not initialized');
  await this.page.getByRole('button', { name: 'Conditions' }).click();
  await expect(this.page.getByTestId('condition-add-rule')).toBeVisible({ timeout: 15_000 });
});

Then('I should see the conditions empty state', async function (this: CustomWorld) {
  if (!this.page) throw new Error('Page is not initialized');
  await expect(this.page.getByTestId('conditions-empty-state')).toBeVisible({ timeout: 10_000 });
});

When(
  'I add a rule showing {string} when {string} is equal to {string}',
  async function (this: CustomWorld, targetFieldId: string, triggerLabel: string, optionValue: string) {
    if (!this.page) throw new Error('Page is not initialized');

    await this.page.getByTestId('condition-add-rule').click();

    // IF: trigger field → operator defaults to "is equal to" → option value
    await this.page.getByTestId('condition-term-field-0').click();
    await this.page.getByRole('option', { name: triggerLabel }).click();
    await this.page.getByTestId('condition-term-value-0').click();
    await this.page.getByRole('option', { name: optionValue, exact: true }).click();

    // THEN: default action type is "Show field(s)" — tick the target field
    await this.page.getByTestId(`condition-action-target-0-${targetFieldId}`).click();

    const save = this.page.getByTestId('condition-save');
    await expect(save).toBeEnabled({ timeout: 5_000 });
    await save.click();
  }
);

Then(
  'I should see a condition rule card for {string}',
  async function (this: CustomWorld, triggerLabel: string) {
    if (!this.page) throw new Error('Page is not initialized');
    await expect(this.page.getByTestId('conditions-empty-state')).toHaveCount(0, {
      timeout: 10_000,
    });
    const card = this.page.locator('[data-testid^="condition-card-"]');
    await expect(card.first()).toBeVisible({ timeout: 10_000 });
    await expect(card.first()).toContainText(triggerLabel);
  }
);
