/**
 * Conditional logic submit-strip data integrity steps
 *
 * Covers the surfaces where the submit-time strip matters beyond the stored
 * response row: file uploads never reaching /upload, the server-side strip on
 * direct GraphQL submissions (PR #131), DELETE tracking on response edits,
 * "send me a copy" against a hidden email field, and keep-while-filling
 * value restoration. Reuses the viewer/publish/stored-response steps from
 * conditional-logic.steps.ts and its fixture field ids (cond-*).
 */

import { When, Then } from '@cucumber/cucumber';
import { expect } from '@playwright/test';
import type { Page } from 'playwright';
import { CustomWorld } from '../support/world';
import { createFormViaGraphQL, fetchLatestResponse } from './helpers';

// Per-scenario state (each scenario runs to completion within one worker)
let uploadRequestCount = 0;
let editResponseId: string | null = null;

// ─────────────────────────────────────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────────────────────────────────────

const baseLayout = () => ({
  theme: 'light',
  textColor: '#000000',
  spacing: 'normal',
  code: 'L9',
  content: '<h1>Conditional Strip Integrity Test</h1>',
  customBackGroundColor: '#ffffff',
  backgroundImageKey: '',
  pageMode: 'multipage',
  isCustomBackgroundColorEnabled: false,
});

/**
 * Single page: a Yes/No trigger and a FileUpload target that only shows when
 * the trigger is "Yes" (default hidden).
 */
const hiddenFileUploadSchema = () => ({
  layout: baseLayout(),
  isShuffleEnabled: false,
  pages: [
    {
      id: 'strip-page-1',
      title: 'Attachments',
      order: 0,
      fields: [
        {
          id: 'strip-attach',
          type: 'radio_field',
          label: 'Attach a file?',
          defaultValue: '',
          prefix: '',
          hint: '',
          options: ['Yes', 'No'],
          validation: { required: false, type: 'fillable_form_field' },
        },
        {
          id: 'strip-file',
          type: 'file_upload_field',
          label: 'Attachment',
          hint: 'Upload a file.',
          maxFileSizeMb: 10,
          maxFiles: 1,
          allowedMimeTypes: [],
          validation: { required: false },
        },
      ],
    },
  ],
  conditions: [
    {
      id: 'rule-show-strip-file',
      enabled: true,
      combinator: 'all',
      terms: [{ fieldId: 'strip-attach', operator: 'equals', value: 'Yes' }],
      actions: [{ type: 'showField', fieldIds: ['strip-file'] }],
    },
  ],
});

/**
 * Single page: a Yes/No trigger, an EmailField target that only shows when the
 * trigger is "Yes" (default hidden), and an always-visible note field. The
 * scenario points the form's responseCopy settings at the email field.
 */
const hiddenCopyEmailSchema = () => ({
  layout: baseLayout(),
  isShuffleEnabled: false,
  pages: [
    {
      id: 'copy-page-1',
      title: 'Copy',
      order: 0,
      fields: [
        {
          id: 'copy-toggle',
          type: 'radio_field',
          label: 'Provide an email?',
          defaultValue: '',
          prefix: '',
          hint: '',
          options: ['Yes', 'No'],
          validation: { required: false, type: 'fillable_form_field' },
        },
        {
          id: 'copy-email',
          type: 'email_field',
          label: 'Copy Email',
          defaultValue: '',
          prefix: '',
          hint: '',
          placeholder: 'you@example.com',
          validation: { required: false, type: 'fillable_form_field' },
        },
        {
          id: 'copy-note',
          type: 'text_input_field',
          label: 'Copy Note',
          defaultValue: '',
          prefix: '',
          hint: '',
          placeholder: 'Note',
          validation: { required: false, type: 'text_field_validation' },
        },
      ],
    },
  ],
  conditions: [
    {
      id: 'rule-show-copy-email',
      enabled: true,
      combinator: 'all',
      terms: [{ fieldId: 'copy-toggle', operator: 'equals', value: 'Yes' }],
      actions: [{ type: 'showField', fieldIds: ['copy-email'] }],
    },
  ],
});

When(
  'I create a form via GraphQL with a conditionally hidden file upload field',
  async function (this: CustomWorld) {
    await createFormViaGraphQL(this, hiddenFileUploadSchema(), 'E2E Cond Hidden FileUpload Test');
  }
);

When(
  'I create a form via GraphQL with a conditionally hidden response copy email field',
  async function (this: CustomWorld) {
    await createFormViaGraphQL(this, hiddenCopyEmailSchema(), 'E2E Cond Response Copy Test');
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// Scenario 1 — hidden FileUpload never uploads
// ─────────────────────────────────────────────────────────────────────────────

When('I start recording viewer upload requests', async function (this: CustomWorld) {
  if (!this.viewerPage) throw new Error('Viewer page is not initialized');
  uploadRequestCount = 0;
  this.viewerPage.on('request', (request) => {
    if (request.method() === 'POST' && new URL(request.url()).pathname.endsWith('/upload')) {
      uploadRequestCount++;
    }
  });
});

When(
  'I attach a text file to the {string} upload field in the viewer',
  async function (this: CustomWorld, fieldId: string) {
    if (!this.viewerPage) throw new Error('Viewer page is not initialized');
    await this.viewerPage.evaluate((id) => {
      const dropZone = document.querySelector(
        `[data-testid="file-upload-drop-zone-${id}"]`
      ) as HTMLElement | null;
      if (!dropZone) throw new Error(`file-upload-drop-zone-${id} not found`);
      const dt = new DataTransfer();
      dt.items.add(new File(['strip me'], 'stripped-file.txt', { type: 'text/plain' }));
      dropZone.dispatchEvent(
        new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt })
      );
    }, fieldId);
    // The attach must land — the file chip shows the attached file's name
    await expect(
      this.viewerPage.getByText('stripped-file.txt', { exact: true })
    ).toBeVisible({ timeout: 5_000 });
  }
);

Then('no viewer upload request should have been recorded', async function (this: CustomWorld) {
  expect(
    uploadRequestCount,
    `expected zero POST /upload requests from the viewer, saw ${uploadRequestCount}`
  ).toBe(0);
});

// ─────────────────────────────────────────────────────────────────────────────
// Scenario 2 — server-side strip on a direct GraphQL submission (PR #131)
// ─────────────────────────────────────────────────────────────────────────────

When(
  'I submit a crafted response with hidden field values directly via GraphQL',
  async function (this: CustomWorld) {
    if (!this.viewerPage) throw new Error('Viewer page is not initialized');
    if (!this.currentFormId) throw new Error('No form created in this scenario');

    // "Show bonus field?" = No hides cond-bonus; "Skip details page?" = Yes
    // hides page cond-page-2 (cond-details). Both hidden values are injected
    // anyway — the server must strip them before persisting.
    const craftedData = {
      'cond-show-bonus': 'No',
      'cond-skip-details': 'Yes',
      'cond-bonus': 'bypass bonus value',
      'cond-details': 'bypass details value',
      'cond-contact': 'contact value kept',
    };

    const response = await this.viewerPage.evaluate(
      async ({ formId, backendUrl, data }) => {
        const res = await fetch(backendUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: `mutation SubmitResponse($input: SubmitResponseInput!) {
              submitResponse(input: $input) { id }
            }`,
            variables: { input: { formId, data } },
          }),
        });
        return res.json();
      },
      { formId: this.currentFormId, backendUrl: this.backendUrl, data: craftedData }
    );

    if (response.errors) {
      throw new Error(`Crafted submitResponse failed: ${JSON.stringify(response.errors)}`);
    }
    if (!response.data?.submitResponse?.id) {
      throw new Error(`Crafted submitResponse returned no id: ${JSON.stringify(response)}`);
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// Scenario 3 — EDIT mode records DELETE for a value hidden by the edit
// ─────────────────────────────────────────────────────────────────────────────

/** Container-scoped radio selection, shared by viewer and edit-mode pages. */
async function chooseRadioOption(page: Page, option: string, fieldLabel: string): Promise<void> {
  const container = page
    .locator('form div')
    .filter({ has: page.getByText(fieldLabel, { exact: true }) })
    .filter({ has: page.getByRole('radiogroup') })
    .last();
  await container.getByRole('radio', { name: option, exact: true }).click();
  // Give the store sync + evaluator a beat to re-render visibility
  await page.waitForTimeout(300);
}

When('I open the latest response in edit mode', async function (this: CustomWorld) {
  if (!this.page) throw new Error('Page is not initialized');
  if (!this.currentFormId) throw new Error('No form created in this scenario');

  const { id } = await fetchLatestResponse(this);
  editResponseId = id;

  await this.page.goto(
    `${this.baseUrl}/dashboard/form/${this.currentFormId}/responses/${id}/edit`
  );
  // The edit page renders the same form renderer — wait for the trigger radio
  await expect(this.page.getByRole('radiogroup').first()).toBeVisible({ timeout: 30_000 });
});

When(
  'I choose edit-mode radio option {string} for {string}',
  async function (this: CustomWorld, option: string, fieldLabel: string) {
    if (!this.page) throw new Error('Page is not initialized');
    await chooseRadioOption(this.page, option, fieldLabel);
  }
);

When('I save the response edit', async function (this: CustomWorld) {
  if (!this.page) throw new Error('Page is not initialized');

  // Walk to the last page (the fixture has up to 3 visible pages), then the
  // footer button becomes "Update Response" with the viewer-submit-button testid
  for (let i = 0; i < 5; i++) {
    if (await this.page.getByTestId('viewer-submit-button').isVisible()) break;
    await this.page.getByTestId('viewer-next-button').click();
    await this.page.waitForTimeout(500);
  }
  await this.page.getByTestId('viewer-submit-button').click();

  // A successful update navigates to the response's edit-history page
  await this.page.waitForURL('**/history', { timeout: 30_000 });
});

Then(
  'the response edit history should record a {string} change for {string}',
  async function (this: CustomWorld, changeType: string, fieldId: string) {
    if (!this.page) throw new Error('Page is not initialized');
    if (!editResponseId) throw new Error('No response was opened in edit mode');

    const response = await this.page.evaluate(
      async ({ responseId, backendUrl }) => {
        const res = await fetch(backendUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            query: `query ResponseEditHistory($responseId: ID!) {
              responseEditHistory(responseId: $responseId) {
                id
                editType
                fieldChanges { fieldId changeType previousValue newValue }
              }
            }`,
            variables: { responseId },
          }),
        });
        return res.json();
      },
      { responseId: editResponseId, backendUrl: this.backendUrl }
    );

    if (response.errors) {
      throw new Error(`GraphQL error fetching edit history: ${JSON.stringify(response.errors)}`);
    }

    const edits: Array<{
      fieldChanges: Array<{ fieldId: string; changeType: string }>;
    }> = response.data?.responseEditHistory ?? [];
    const allChanges = edits.flatMap((edit) => edit.fieldChanges);
    const match = allChanges.find(
      (change) => change.fieldId === fieldId && change.changeType === changeType
    );
    expect(
      match,
      `expected a ${changeType} field change for "${fieldId}" — got: ${JSON.stringify(allChanges)}`
    ).toBeTruthy();
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// Scenario 4 — send-me-a-copy against a conditionally hidden email field
// ─────────────────────────────────────────────────────────────────────────────

When(
  'I enable respondent-choice response copy for the {string} field',
  async function (this: CustomWorld, emailFieldId: string) {
    if (!this.page) throw new Error('Page is not initialized');
    if (!this.currentFormId) throw new Error('No form created in this scenario');

    const response = await this.page.evaluate(
      async ({ formId, backendUrl, fieldId }) => {
        const res = await fetch(backendUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            query: `mutation UpdateForm($id: ID!, $input: UpdateFormInput!) {
              updateForm(id: $id, input: $input) {
                id
                settings { responseCopy { enabled mode emailFieldId } }
              }
            }`,
            variables: {
              id: formId,
              input: {
                settings: {
                  responseCopy: {
                    enabled: true,
                    mode: 'respondentChoice',
                    emailFieldId: fieldId,
                  },
                },
              },
            },
          }),
        });
        return res.json();
      },
      { formId: this.currentFormId, backendUrl: this.backendUrl, fieldId: emailFieldId }
    );

    if (response.errors) {
      throw new Error(`GraphQL error enabling response copy: ${JSON.stringify(response.errors)}`);
    }
    const saved = response.data?.updateForm?.settings?.responseCopy;
    if (!saved?.enabled || saved.emailFieldId !== emailFieldId) {
      throw new Error(`Response copy settings not saved: ${JSON.stringify(saved)}`);
    }
  }
);

When('I tick the send-me-a-copy checkbox in the viewer', async function (this: CustomWorld) {
  if (!this.viewerPage) throw new Error('Viewer page is not initialized');
  const checkbox = this.viewerPage.getByTestId('send-response-copy-checkbox');
  await expect(checkbox).toBeVisible({ timeout: 10_000 });
  await checkbox.click();
});

Then(
  'the viewer should show the thank you screen without a copy notice',
  async function (this: CustomWorld) {
    if (!this.viewerPage) throw new Error('Viewer page is not initialized');
    await expect(this.viewerPage.getByTestId('thank-you-display')).toBeVisible({
      timeout: 30_000,
    });
    // The copy email was stripped, so no "a copy was sent to …" note may appear
    await expect(this.viewerPage.getByTestId('thank-you-copy-notice')).toHaveCount(0);
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// Scenario 5 — re-show restores the typed value
// ─────────────────────────────────────────────────────────────────────────────

Then(
  'the viewer input {string} should have value {string}',
  async function (this: CustomWorld, fieldId: string, value: string) {
    if (!this.viewerPage) throw new Error('Viewer page is not initialized');
    const input = this.viewerPage.locator(`input[name="${fieldId}"]`);
    await expect(input).toBeVisible({ timeout: 10_000 });
    await expect(input).toHaveValue(value, { timeout: 10_000 });
  }
);
