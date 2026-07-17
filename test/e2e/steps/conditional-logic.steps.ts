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

const triggerMatrixFields = () => ({
  layout: {
    theme: 'light',
    textColor: '#000000',
    spacing: 'normal',
    code: 'L9',
    content: '<h1>Conditional Logic Trigger Matrix</h1>',
    customBackGroundColor: '#ffffff',
    backgroundImageKey: '',
    pageMode: 'multipage',
    isCustomBackgroundColorEnabled: false,
  },
  isShuffleEnabled: false,
  pages: [
    {
      id: 'matrix-page-1',
      title: 'Main Page',
      order: 0,
      fields: [
        // Triggers
        {
          id: 'trig-text',
          type: 'text_input_field',
          label: 'Text Trigger',
          defaultValue: '',
          prefix: '',
          hint: '',
          placeholder: 'Type something',
          validation: { required: false, type: 'text_field_validation' },
        },
        {
          id: 'trig-email',
          type: 'email_field',
          label: 'Email Trigger',
          defaultValue: '',
          prefix: '',
          hint: '',
          placeholder: 'Type email',
          validation: { required: false, type: 'fillable_form_field' },
        },
        {
          id: 'trig-phone',
          type: 'phone_number_field',
          label: 'Phone Trigger',
          defaultValue: '',
          prefix: '',
          hint: '',
          defaultCountry: 'IN',
          validation: { required: false, type: 'fillable_form_field' },
        },
        {
          id: 'trig-number',
          type: 'number_field',
          label: 'Number Trigger',
          defaultValue: '',
          prefix: '',
          hint: '',
          placeholder: 'Type number',
          validation: { required: false, type: 'fillable_form_field' },
        },
        {
          id: 'trig-date',
          type: 'date_field',
          label: 'Date Trigger',
          defaultValue: '',
          prefix: '',
          hint: '',
          placeholder: 'Pick a date',
          validation: { required: false, type: 'fillable_form_field' },
        },
        {
          id: 'trig-select',
          type: 'select_field',
          label: 'Select Trigger',
          defaultValue: '',
          prefix: '',
          hint: '',
          options: ['Option 1', 'Option 2'],
          validation: { required: false, type: 'fillable_form_field' },
        },
        {
          id: 'trig-checkbox',
          type: 'checkbox_field',
          label: 'Checkbox Trigger',
          defaultValues: [],
          prefix: '',
          hint: '',
          options: ['Option A', 'Option B'],
          validation: { required: false, type: 'checkbox_field_validation' },
        },
        {
          id: 'trig-file',
          type: 'file_upload_field',
          label: 'File Trigger',
          hint: 'Upload file',
          maxFileSizeMb: 10,
          maxFiles: 1,
          allowedMimeTypes: [],
          validation: { required: false },
        },

        // Probes
        {
          id: 'probe-text-equals',
          type: 'text_input_field',
          label: 'Probe Text Equals',
          defaultValue: '',
          prefix: '',
          hint: '',
          validation: { required: false, type: 'text_field_validation' },
        },
        {
          id: 'probe-text-contains',
          type: 'text_input_field',
          label: 'Probe Text Contains',
          defaultValue: '',
          prefix: '',
          hint: '',
          validation: { required: false, type: 'text_field_validation' },
        },
        {
          id: 'probe-text-starts',
          type: 'text_input_field',
          label: 'Probe Text Starts',
          defaultValue: '',
          prefix: '',
          hint: '',
          validation: { required: false, type: 'text_field_validation' },
        },
        {
          id: 'probe-text-ends',
          type: 'text_input_field',
          label: 'Probe Text Ends',
          defaultValue: '',
          prefix: '',
          hint: '',
          validation: { required: false, type: 'text_field_validation' },
        },
        {
          id: 'probe-text-empty',
          type: 'text_input_field',
          label: 'Probe Text Empty',
          defaultValue: '',
          prefix: '',
          hint: '',
          validation: { required: false, type: 'text_field_validation' },
        },
        {
          id: 'probe-email-ends',
          type: 'text_input_field',
          label: 'Probe Email Ends',
          defaultValue: '',
          prefix: '',
          hint: '',
          validation: { required: false, type: 'text_field_validation' },
        },
        {
          id: 'probe-phone-starts',
          type: 'text_input_field',
          label: 'Probe Phone Starts',
          defaultValue: '',
          prefix: '',
          hint: '',
          validation: { required: false, type: 'text_field_validation' },
        },
        {
          id: 'probe-number-gt',
          type: 'text_input_field',
          label: 'Probe Number GT',
          defaultValue: '',
          prefix: '',
          hint: '',
          validation: { required: false, type: 'text_field_validation' },
        },
        {
          id: 'probe-number-zero',
          type: 'text_input_field',
          label: 'Probe Number Zero',
          defaultValue: '',
          prefix: '',
          hint: '',
          validation: { required: false, type: 'text_field_validation' },
        },
        {
          id: 'probe-date-before',
          type: 'text_input_field',
          label: 'Probe Date Before',
          defaultValue: '',
          prefix: '',
          hint: '',
          validation: { required: false, type: 'text_field_validation' },
        },
        {
          id: 'probe-select-equals',
          type: 'text_input_field',
          label: 'Probe Select Equals',
          defaultValue: '',
          prefix: '',
          hint: '',
          validation: { required: false, type: 'text_field_validation' },
        },
        {
          id: 'probe-checkbox-contains',
          type: 'text_input_field',
          label: 'Probe Checkbox Contains',
          defaultValue: '',
          prefix: '',
          hint: '',
          validation: { required: false, type: 'text_field_validation' },
        },
        {
          id: 'probe-checkbox-not-contains',
          type: 'text_input_field',
          label: 'Probe Checkbox Not Contains',
          defaultValue: '',
          prefix: '',
          hint: '',
          validation: { required: false, type: 'text_field_validation' },
        },
        {
          id: 'probe-file-filled',
          type: 'text_input_field',
          label: 'Probe File Filled',
          defaultValue: '',
          prefix: '',
          hint: '',
          validation: { required: false, type: 'text_field_validation' },
        },
        {
          id: 'probe-multi-all',
          type: 'text_input_field',
          label: 'Probe Multi All',
          defaultValue: '',
          prefix: '',
          hint: '',
          validation: { required: false, type: 'text_field_validation' },
        },
        {
          id: 'probe-multi-any',
          type: 'text_input_field',
          label: 'Probe Multi Any',
          defaultValue: '',
          prefix: '',
          hint: '',
          validation: { required: false, type: 'text_field_validation' },
        },
      ],
    },
  ],
});

const conditionalLogicTriggerMatrixSchema = () => ({
  ...triggerMatrixFields(),
  conditions: [
    {
      id: 'rule-text-equals',
      enabled: true,
      combinator: 'all',
      terms: [{ fieldId: 'trig-text', operator: 'equals', value: 'hello' }],
      actions: [{ type: 'hideField', fieldIds: ['probe-text-equals'] }],
    },
    {
      id: 'rule-text-contains',
      enabled: true,
      combinator: 'all',
      terms: [{ fieldId: 'trig-text', operator: 'contains', value: 'mid' }],
      actions: [{ type: 'hideField', fieldIds: ['probe-text-contains'] }],
    },
    {
      id: 'rule-text-starts',
      enabled: true,
      combinator: 'all',
      terms: [{ fieldId: 'trig-text', operator: 'startsWith', value: 'start' }],
      actions: [{ type: 'hideField', fieldIds: ['probe-text-starts'] }],
    },
    {
      id: 'rule-text-ends',
      enabled: true,
      combinator: 'all',
      terms: [{ fieldId: 'trig-text', operator: 'endsWith', value: 'end' }],
      actions: [{ type: 'hideField', fieldIds: ['probe-text-ends'] }],
    },
    {
      id: 'rule-text-empty',
      enabled: true,
      combinator: 'all',
      terms: [{ fieldId: 'trig-text', operator: 'isEmpty' }],
      actions: [{ type: 'hideField', fieldIds: ['probe-text-empty'] }],
    },
    {
      id: 'rule-email-ends',
      enabled: true,
      combinator: 'all',
      terms: [{ fieldId: 'trig-email', operator: 'endsWith', value: '@acme.com' }],
      actions: [{ type: 'hideField', fieldIds: ['probe-email-ends'] }],
    },
    {
      id: 'rule-phone-starts',
      enabled: true,
      combinator: 'all',
      terms: [{ fieldId: 'trig-phone', operator: 'startsWith', value: '+91' }],
      actions: [{ type: 'hideField', fieldIds: ['probe-phone-starts'] }],
    },
    {
      id: 'rule-number-gt',
      enabled: true,
      combinator: 'all',
      terms: [{ fieldId: 'trig-number', operator: 'greaterThan', value: 10 }],
      actions: [{ type: 'hideField', fieldIds: ['probe-number-gt'] }],
    },
    {
      id: 'rule-number-zero',
      enabled: true,
      combinator: 'all',
      terms: [{ fieldId: 'trig-number', operator: 'equals', value: 0 }],
      actions: [{ type: 'hideField', fieldIds: ['probe-number-zero'] }],
    },
    {
      id: 'rule-date-before',
      enabled: true,
      combinator: 'all',
      terms: [{ fieldId: 'trig-date', operator: 'before', value: '2026-01-01' }],
      actions: [{ type: 'hideField', fieldIds: ['probe-date-before'] }],
    },
    {
      id: 'rule-select-equals',
      enabled: true,
      combinator: 'all',
      terms: [{ fieldId: 'trig-select', operator: 'equals', value: 'Option 1' }],
      actions: [{ type: 'hideField', fieldIds: ['probe-select-equals'] }],
    },
    {
      id: 'rule-checkbox-contains',
      enabled: true,
      combinator: 'all',
      terms: [{ fieldId: 'trig-checkbox', operator: 'contains', value: 'Option A' }],
      actions: [{ type: 'hideField', fieldIds: ['probe-checkbox-contains'] }],
    },
    {
      id: 'rule-checkbox-not-contains',
      enabled: true,
      combinator: 'all',
      terms: [{ fieldId: 'trig-checkbox', operator: 'notContains', value: 'Option B' }],
      actions: [{ type: 'hideField', fieldIds: ['probe-checkbox-not-contains'] }],
    },
    {
      id: 'rule-file-filled',
      enabled: true,
      combinator: 'all',
      terms: [{ fieldId: 'trig-file', operator: 'isFilled' }],
      actions: [{ type: 'hideField', fieldIds: ['probe-file-filled'] }],
    },
    {
      id: 'rule-multi-all',
      enabled: true,
      combinator: 'all',
      terms: [
        { fieldId: 'trig-text', operator: 'equals', value: 'hello' },
        { fieldId: 'trig-number', operator: 'greaterThan', value: 10 },
      ],
      actions: [{ type: 'hideField', fieldIds: ['probe-multi-all'] }],
    },
    {
      id: 'rule-multi-any',
      enabled: true,
      combinator: 'any',
      terms: [
        { fieldId: 'trig-text', operator: 'equals', value: 'hello' },
        { fieldId: 'trig-number', operator: 'greaterThan', value: 10 },
      ],
      actions: [{ type: 'hideField', fieldIds: ['probe-multi-any'] }],
    },
  ],
});

When(
  'I create a form via GraphQL with the conditional logic trigger matrix',
  async function (this: CustomWorld) {
    await createFormViaGraphQL(
      this,
      conditionalLogicTriggerMatrixSchema(),
      'E2E Conditional Logic Trigger Matrix'
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
    // blur() flushes React's onBlur/onChange so the evaluator re-runs.
    // When filling triggers a self-hiding page rule the input disappears from
    // the DOM before blur() resolves — that is the expected behaviour, so we
    // absorb the locator-not-found error here without masking real failures
    // (fill() already proved the element existed and the value was accepted).
    try {
      await input.blur();
    } catch {
      // element disappeared due to conditional visibility change — expected
    }
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

When(
  'I choose viewer dropdown option {string} for {string}',
  async function (this: CustomWorld, option: string, fieldLabel: string) {
    if (!this.viewerPage) throw new Error('Viewer page is not initialized');
    const labelElement = this.viewerPage.locator('label', { hasText: fieldLabel }).first();
    const container = labelElement.locator('..').locator('..');
    const trigger = container.locator('button').first();
    await trigger.click();
    const optionElement = this.viewerPage.getByRole('option', { name: option, exact: true });
    await optionElement.click();
    await this.viewerPage.waitForTimeout(300);
  }
);

When(
  'I choose viewer checkbox option {string} for {string}',
  async function (this: CustomWorld, option: string, fieldLabel: string) {
    if (!this.viewerPage) throw new Error('Viewer page is not initialized');
    const labelElement = this.viewerPage.locator('label', { hasText: fieldLabel }).first();
    const container = labelElement.locator('..').locator('..');
    const label = container.getByText(option, { exact: true });
    await label.click();
    await this.viewerPage.waitForTimeout(300);
  }
);

When(
  'I set the viewer date input {string} to {string}',
  async function (this: CustomWorld, name: string, value: string) {
    if (!this.viewerPage) throw new Error('Viewer page is not initialized');
    const input = this.viewerPage.locator(`input[name="${name}"]`);
    await input.waitFor({ state: 'attached', timeout: 10_000 });
    await input.fill(value, { force: true });
    await this.viewerPage.waitForTimeout(300);
  }
);

When(
  'I clear the viewer input {string}',
  async function (this: CustomWorld, fieldId: string) {
    if (!this.viewerPage) throw new Error('Viewer page is not initialized');
    const input = this.viewerPage.locator(`input[name="${fieldId}"]`);
    await expect(input).toBeVisible({ timeout: 10_000 });
    await input.fill('');
    // Same blur() safety as the fill step — clearing can also trigger page
    // visibility changes that remove the input before blur() resolves.
    try {
      await input.blur();
    } catch {
      // element disappeared due to conditional visibility change — expected
    }
    await this.viewerPage.waitForTimeout(300);
  }
);

When(
  'I remove the attached file {string} in the viewer',
  async function (this: CustomWorld, filename: string) {
    if (!this.viewerPage) throw new Error('Viewer page is not initialized');
    const chip = this.viewerPage
      .locator('div')
      .filter({ has: this.viewerPage.getByText(filename, { exact: true }) })
      .locator('button')
      .filter({ hasText: '×' })
      .first();
    await chip.click();
    await this.viewerPage.waitForTimeout(300);
  }
);

const conditionalLogicPageEdgesSchema = () => ({
  layout: {
    theme: 'light',
    textColor: '#000000',
    spacing: 'normal',
    code: 'L9',
    content: '<h1>Conditional Page Edges Test</h1>',
    customBackGroundColor: '#ffffff',
    backgroundImageKey: '',
    pageMode: 'multipage',
    isCustomBackgroundColorEnabled: false,
  },
  isShuffleEnabled: false,
  pages: [
    {
      id: 'p1',
      title: 'Page 1',
      order: 0,
      fields: [
        {
          id: 'edge-skip-p1',
          type: 'radio_field',
          label: 'Skip page 1?',
          defaultValue: '',
          prefix: '',
          hint: '',
          options: ['Yes', 'No'],
          validation: { required: false, type: 'fillable_form_field' },
        },
        {
          id: 'edge-hide-all',
          type: 'radio_field',
          label: 'Hide all pages?',
          defaultValue: '',
          prefix: '',
          hint: '',
          options: ['Yes', 'No'],
          validation: { required: false, type: 'fillable_form_field' },
        },
      ],
    },
    {
      id: 'p2',
      title: 'Page 2',
      order: 1,
      fields: [
        {
          id: 'edge-a',
          type: 'text_input_field',
          label: 'Text A',
          defaultValue: '',
          prefix: '',
          hint: '',
          placeholder: 'Enter text a',
          validation: { required: false, type: 'text_field_validation' },
        },
      ],
    },
    {
      id: 'p3',
      title: 'Page 3',
      order: 2,
      fields: [
        {
          id: 'edge-b',
          type: 'text_input_field',
          label: 'Text B',
          defaultValue: '',
          prefix: '',
          hint: '',
          placeholder: 'Enter text b',
          validation: { required: false, type: 'text_field_validation' },
        },
        {
          id: 'edge-hide-p1',
          type: 'radio_field',
          label: 'Hide page 1?',
          defaultValue: '',
          prefix: '',
          hint: '',
          options: ['Yes', 'No'],
          validation: { required: false, type: 'fillable_form_field' },
        },
      ],
    },
    {
      id: 'p4',
      title: 'Page 4',
      order: 3,
      fields: [
        {
          id: 'richtext',
          type: 'rich_text_field',
          content: '<p>Info page</p>',
        },
      ],
    },
  ],
  conditions: [
    {
      id: 'rule-edge-hide-p1',
      enabled: true,
      combinator: 'all',
      terms: [{ fieldId: 'edge-hide-p1', operator: 'equals', value: 'Yes' }],
      actions: [{ type: 'hidePage', pageId: 'p1' }],
    },
    {
      id: 'rule-edge-self-hide',
      enabled: true,
      combinator: 'all',
      terms: [{ fieldId: 'edge-a', operator: 'equals', value: 'hide me' }],
      actions: [{ type: 'hidePage', pageId: 'p2' }],
    },
    {
      id: 'rule-edge-skip-p2',
      enabled: true,
      combinator: 'all',
      terms: [{ fieldId: 'edge-b', operator: 'equals', value: 'skip p2' }],
      actions: [{ type: 'hidePage', pageId: 'p2' }],
    },
    {
      id: 'rule-edge-hide-p4-field',
      enabled: true,
      combinator: 'all',
      terms: [{ fieldId: 'edge-a', operator: 'equals', value: 'hide p4' }],
      actions: [{ type: 'hideField', fieldIds: ['richtext'] }],
    },
    {
      id: 'rule-edge-hide-all-p1',
      enabled: true,
      combinator: 'all',
      terms: [{ fieldId: 'edge-hide-all', operator: 'equals', value: 'Yes' }],
      actions: [{ type: 'hidePage', pageId: 'p1' }],
    },
    {
      id: 'rule-edge-hide-all-p2',
      enabled: true,
      combinator: 'all',
      terms: [{ fieldId: 'edge-hide-all', operator: 'equals', value: 'Yes' }],
      actions: [{ type: 'hidePage', pageId: 'p2' }],
    },
    {
      id: 'rule-edge-hide-all-p3',
      enabled: true,
      combinator: 'all',
      terms: [{ fieldId: 'edge-hide-all', operator: 'equals', value: 'Yes' }],
      actions: [{ type: 'hidePage', pageId: 'p3' }],
    },
    {
      id: 'rule-edge-hide-all-p4',
      enabled: true,
      combinator: 'all',
      terms: [{ fieldId: 'edge-hide-all', operator: 'equals', value: 'Yes' }],
      actions: [{ type: 'hidePage', pageId: 'p4' }],
    },
  ],
});

When(
  'I create a form via GraphQL with the conditional logic page edges matrix',
  async function (this: CustomWorld) {
    await createFormViaGraphQL(
      this,
      conditionalLogicPageEdgesSchema(),
      'E2E Conditional Page Edges Test'
    );
  }
);

When(
  'I create a form via GraphQL with the conditional logic all pages hidden schema',
  async function (this: CustomWorld) {
    const schema = conditionalLogicPageEdgesSchema() as any;
    const p1 = schema.pages.find((p: any) => p.id === 'p1');
    if (p1) {
      const f = p1.fields.find((field: any) => field.id === 'edge-hide-all');
      if (f) {
        f.defaultValue = 'No';
      }
    }
    schema.conditions = schema.conditions.map((rule: any) => {
      if (rule.id.startsWith('rule-edge-hide-all-')) {
        return {
          ...rule,
          terms: [{ fieldId: 'edge-hide-all', operator: 'notEquals', value: 'No' }],
        };
      }
      return rule;
    });
    await createFormViaGraphQL(
      this,
      schema,
      'E2E Conditional Page Edges - All Pages Hidden'
    );
  }
);

Then(
  'the viewer page indicator should be hidden',
  async function (this: CustomWorld) {
    if (!this.viewerPage) throw new Error('Viewer page is not initialized');
    const indicator = this.viewerPage.getByTestId('viewer-page-indicator');
    await expect(indicator).toHaveCount(0, { timeout: 10_000 });
  }
);

Then(
  'the viewer submit button should be visible',
  async function (this: CustomWorld) {
    if (!this.viewerPage) throw new Error('Viewer page is not initialized');
    const submitBtn = this.viewerPage.getByTestId('viewer-submit-button');
    await expect(submitBtn).toBeVisible({ timeout: 10_000 });
  }
);

When(
  'I click submit in the viewer',
  async function (this: CustomWorld) {
    if (!this.viewerPage) throw new Error('Viewer page is not initialized');
    await this.viewerPage.getByTestId('viewer-submit-button').click();
    await expect(
      this.viewerPage.getByTestId('viewer-submit-button')
    ).toHaveCount(0, { timeout: 30_000 });
  }
);

Then(
  'the stored response should be empty',
  async function (this: CustomWorld) {
    const { data } = await fetchLatestResponse(this);
    expect(Object.keys(data).length).toBe(0);
  }
);

Then(
  'I should see the rich text content {string} in the viewer',
  async function (this: CustomWorld, content: string) {
    if (!this.viewerPage) throw new Error('Viewer page is not initialized');
    await expect(
      this.viewerPage.getByText(content).first()
    ).toBeVisible({ timeout: 10_000 });
  }
);


